// futbolfantasy.com scraper — pipeline en 3 pasos.
//
// Paso 1: detectar URL de la noticia "anuncia la lista" en /world-cup/equipos/<slug>/noticias/1
// Paso 2: parsear el cuerpo de esa noticia → roster completo con secciones por posición
// Paso 3: extraer XI titular de /world-cup/equipos/<slug> ("Posible once tipo")
//
// Si el paso 1 no encuentra noticia → roster=[] e is_final=false (solo paso 3 disponible).
// El XI titular se cruza con el roster vía matchAgainstRoster (name-matcher.mjs).
//
// 27-may-2026: paso 3 refactorizado a parser cheerio que extrae los 11 desde el
// contenedor estable div[class*="jugadores-titulares-"] > div.tipo_campo (con sus
// data-* attrs). El parser previo basado en <img alt> perdía nombres que vivían
// como texto bajo la camiseta (PO Joan García, MC Pedri/Fabián en ESP), causando
// el XI 8/11 sistemático en Tier A. Selector validado por San con HTML real ESP.

import * as cheerio from 'cheerio';
import { matchAgainstRoster } from './name-matcher.mjs';
import { loadCachedHtml } from './parsers/_util.mjs';
import { decode } from 'html-entities';

const FF_BASE = 'https://www.futbolfantasy.com';
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

const SECTION_TO_BUCKET = {
  Porteros: 'Portero',
  Defensas: 'Defensa',
  Mediocampistas: 'Centrocampista',
  Centrocampistas: 'Centrocampista',
  Centrocampos: 'Centrocampista',
  Delanteros: 'Delantero',
};

async function fetchText(url, { verbose = false } = {}) {
  if (verbose) console.log(`  GET ${url}`);
  const r = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'es-ES,es;q=0.9',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} on ${url}`);
  return await r.text();
}

/**
 * Decodifica TODAS las entidades HTML5 (~2000 nombradas + numéricas decimales y hex)
 * y normaliza apóstrofos/comillas tipográficas a ASCII para idempotencia.
 * Reemplaza la tabla manual previa, que era frágil ante fuentes nuevas o idiomas no contemplados
 * (eslavo-sur con &scaron;/&Scaron;, eslavo-occidental con &dstrok;/&rcaron;, turco con &gbreve;...).
 */
function decodeHtml(s) {
  return decode(String(s))
    .replace(/[‘’‚′]/g, "'")
    .replace(/[“”„″]/g, '"');
}

// Convierte HTML a un texto markdown-ish donde:
//   <h1..h6>, <strong>, <b>  → **texto**
//   <br>, </p>, </li>        → newline
//   <img alt="X">            → preserva alt como texto plano
// Suficiente para que los regex del brief funcionen contra el output.
function htmlToMd(html) {
  let s = String(html || '');
  s = s.replace(/<script[\s\S]*?<\/script>/gi, '');
  s = s.replace(/<style[\s\S]*?<\/style>/gi, '');
  s = s.replace(/<!--[\s\S]*?-->/g, '');
  // bold/heading → **...**
  s = s.replace(/<(h[1-6]|strong|b)\b[^>]*>/gi, '**');
  s = s.replace(/<\/(h[1-6]|strong|b)>/gi, '**\n');
  // br/p/li → newline
  s = s.replace(/<br\s*\/?>/gi, '\n');
  s = s.replace(/<\/(p|li|div|tr)>/gi, '\n');
  // <img alt="X"> → texto plano del alt (útil para XI)
  s = s.replace(/<img\b[^>]*\balt="([^"]*)"[^>]*>/gi, '$1');
  // links: conservar el texto interno
  s = s.replace(/<a\b[^>]*>([\s\S]*?)<\/a>/gi, '$1');
  // strip resto de tags
  s = s.replace(/<[^>]+>/g, '');
  // decodificar entidades (numéricas + nombradas Latin-1/tipográficas)
  s = decodeHtml(s);
  // colapsar whitespace
  s = s.replace(/\r/g, '');
  s = s.replace(/\n{3,}/g, '\n\n');
  s = s.replace(/[ \t]+\n/g, '\n');
  return s.trim();
}

// Paso 1 — buscar URL de noticia "anuncia la lista" o "lista definitiva"
export async function findFinalListUrl(slug, opts = {}) {
  const indexUrl = `${FF_BASE}/equipos/${slug}/noticias/1`;
  const html = await fetchText(indexUrl, opts);
  // Regex pesimista: capturamos `/world-cup/noticias/<id>-<slug-noticia>` donde el slug
  // contiene alguno de los marcadores. Tolerante a comillas/atributos extra.
  const re = /\/world-cup\/noticias\/(\d+)-([a-z0-9-]*(?:anuncia-la-lista|lista-definitiva|convocatoria-oficial)[a-z0-9-]*)/i;
  const m = html.match(re);
  if (!m) return null;
  return {
    id: m[1],
    slug: m[2],
    url: `https://www.futbolfantasy.com/world-cup/noticias/${m[1]}-${m[2]}`,
  };
}

// Paso 2 — parsear el cuerpo de la noticia → roster con buckets
export async function parseNewsRoster(newsUrl, opts = {}) {
  const html = await fetchText(newsUrl, opts);
  const md = htmlToMd(html);

  // Brief regex (ajustado: las secciones siguientes pueden empezar por <strong> o `**`)
  const SECTION_RE = /\*\*\s*(Porteros|Defensas|Mediocampistas|Centrocampistas|Delanteros)\s*\*\*\s*\n([\s\S]*?)(?=\n\s*\*\*\s*(?:Porteros|Defensas|Mediocampistas|Centrocampistas|Delanteros)\s*\*\*|\n\s*Ver comentarios|\n\s*####|$)/g;
  const PLAYER_LINE_RE = /^\s*([^()]+?)\s+\(([^/)]+?)(?:\/[^)]+)?\)\s*$/;

  const players = [];
  let m;
  while ((m = SECTION_RE.exec(md)) !== null) {
    const section = m[1];
    const block = m[2];
    const bucket = SECTION_TO_BUCKET[section] || section;
    for (const rawLine of block.split('\n')) {
      const line = rawLine.trim();
      if (!line) continue;
      const pm = line.match(PLAYER_LINE_RE);
      if (!pm) continue;
      const nombre = pm[1].trim().replace(/\s{2,}/g, ' ');
      const club = pm[2].trim();
      if (!nombre || /^[-•·]+$/.test(nombre)) continue;
      players.push({
        nombre,
        club,
        posicion: bucket,
        posicion_bucket: bucket,
        es_titular: false,
        dorsal: null,
        edad: null,
        valor: null,
        dob: null,
        foto_url: null,
        fuente: 'ff',
      });
    }
  }
  return players;
}

// ────────────────────────────────────────────────────────────────────────────
// Paso 3 — XI titular vía cheerio sobre [data-onceff="titular"]
// ────────────────────────────────────────────────────────────────────────────
//
// FF tiene DOS variantes de markup observadas:
//
// Variante A — ESP-style (con wrapper class, validado 27-may con HTML real):
//   <div class="jugadores-titulares-22208 mod lesionados mb-0">
//     <div class="jugador_7279 tipo_campo camiseta-wrapper portero"
//          data-onceff="titular" data-equipo="ESP" ...>
//       <a class="camiseta"><img alt="Joan Garcia" .../></a>
//     </div>
//     ... x10 más
//   </div>
//
// Variante B — JPN-style (sin wrapper, detectada 28-may en JPN/BEL/BIH/SWE):
//   <div class="jugador_0 campo camiseta-wrapper"
//        data-onceff="titular" data-onceff-x="23%" data-onceff-y="69%" ...>
//     <a class="camiseta"><img alt="Itakura" .../></a>
//   </div>
//   ... x10 más, sin <div class="jugadores-titulares-X"> wrapper
//
// SELECTOR PRIMARIO: [data-onceff="titular"] — atributo semántico presente en
// AMBAS variantes (verificado en fixture ESP real: 11 titular + 15 suplente).
// El wrapper-style queda como fallback defensivo si FF cambiara el data attr.
//
// Suplentes excluidos automáticamente: tienen data-onceff="suplente", no
// "titular". El selector ya los filtra sin necesidad de chequeo de clase.
//
// 28-may-2026 — `parseStartingXISlotsFromHtml` añadida para extraer pos-0
// (titular) + pos-1 (alternativa) por slot. FF en /equipos/<slug> coloca:
//   <a class="juggador pos-0 flex-column">Titular</a>
//   <a class="juggador pos-1 flex-column">Alternativa</a>  (opcional)
// dentro del slot div[data-onceff="titular"]. ATENCIÓN: la clase es "juggador"
// con doble-g (typo literal de FF). El texto va dentro de <a> directamente
// (JPN-style) o anidado en <span class="truncate-name"> (ESP-style con
// metadata price/age). El helper `juggadorText` cubre ambas.

function juggadorText($el, posClass) {
  const $a = $el.find(`a.juggador.${posClass}`).first();
  if ($a.length === 0) return '';
  // Preferir .truncate-name si existe (ESP-style con metadata adicional).
  const $trunc = $a.find('.truncate-name').first();
  if ($trunc.length > 0) return decodeHtml($trunc.text()).trim();
  // Fallback JPN-style: el texto del <a> es directamente el nombre.
  return decodeHtml($a.text()).trim();
}

/**
 * Versión enriquecida: devuelve por slot { titular, alternativa? } con la
 * pos-1 cuando FF la publica. Cubre Causa 4 del brief 28-may (FF lista
 * titulares no convocados): si el matcher no encuentra el titular en el
 * roster oficial, hace fallback a la alternativa.
 *
 * @returns {Array<{titular: string, alternativa?: string}>} hasta 11 slots
 */
export function parseStartingXISlotsFromHtml(html) {
  if (!html || html.length < 1000) return [];
  if (/\/alineaciones\/0\.jpg/i.test(html)) return [];

  const $ = cheerio.load(html);

  let $players = $('[data-onceff="titular"]');
  if ($players.length === 0) {
    const $tit = $('div[class*="jugadores-titulares-"]').first();
    if ($tit.length === 0) return [];
    $players = $tit.children('div.tipo_campo');
  }

  const slots = [];
  $players.each((_, el) => {
    const $el = $(el);
    const classes = $el.attr('class') || '';
    if (/\bsupl-\d+\b/.test(classes)) return;

    // Coordenadas de pista del once-tipo (data-onceff-x/y, ej. "23%"). FF las
    // expone en porcentaje con el mismo convenio que FORMATION_COORDS del front
    // (y alto = portería propia: portero ~87%, x=50 centro). Imprescindibles
    // para remapear el orden DOM (que NO es orden de slot — el portero aparece
    // primero en JPN y último en ESP) a índice de slot vía asignación geométrica
    // en --build-xi. parseFloat tolera "23%"/"23"/null.
    const parsePct = (v) => {
      const n = parseFloat(String(v ?? '').replace('%', ''));
      return Number.isFinite(n) ? n : null;
    };
    const x = parsePct($el.attr('data-onceff-x'));
    const y = parsePct($el.attr('data-onceff-y'));
    const isGK = /\bportero\b/.test(classes);

    // TITULAR — orden de preferencia:
    //   1) img[alt] non-empty: nombre completo "Nico Williams" (vs truncado
    //      "N. Williams" del juggador.pos-0). Validado en HTML real ESP/JPN.
    //   2) Fallback a a.juggador.pos-0 si no hay img alt utilizable.
    //   3) Fallback final a slug del href.
    // 10-jun-2026: FF añadió un overlay "Más info" cuyo alt/texto se colaba
    // como nombre de titular (6 selecciones afectadas en el refresh pre-torneo).
    // Cualquier texto de UI (no-nombre) se descarta y se cae al siguiente fallback.
    const isUiArtifact = (s) => /^(m[áa]s\s+info|ver\s+m[áa]s|info)$/i.test(String(s || '').trim());
    let titular = '';
    const altName = $el
      .find('img[alt]')
      .filter((_, img) => {
        const alt = ($(img).attr('alt') || '').trim();
        return alt !== '' && !isUiArtifact(alt);
      })
      .first()
      .attr('alt');
    if (altName) titular = decodeHtml(altName).trim();

    if (!titular) titular = juggadorText($el, 'pos-0');
    if (isUiArtifact(titular)) titular = '';

    if (!titular) {
      const href = $el.find('a.camiseta').first().attr('href') || '';
      const slugMatch = href.match(/\/jugadores\/([^/]+)\//);
      if (slugMatch) {
        titular = slugMatch[1]
          .split('-')
          .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
          .join(' ');
      }
    }

    // ALTERNATIVA — sólo desde a.juggador.pos-1 (no hay otra fuente). El
    // truncado "M. Penders" del juggador funciona bien para el matcher (path
    // last-name) cuando pos-0 no está convocado oficialmente.
    let alternativa = juggadorText($el, 'pos-1') || null;
    if (isUiArtifact(alternativa)) alternativa = null;

    // Si el titular quedó vacío (artefacto UI descartado) pero hay alternativa,
    // promoverla: mejor un candidato real que perder el slot entero.
    if (!titular && alternativa) {
      titular = alternativa;
      alternativa = null;
    }

    if (titular) {
      const slot = { titular, x, y, isGK };
      if (alternativa) slot.alternativa = alternativa;
      slots.push(slot);
    }
  });

  return slots.slice(0, 11);
}

/**
 * Wrapper backward compat — devuelve sólo los 11 nombres titulares como
 * array plano de strings. Equivale a parseStartingXISlotsFromHtml(html)
 * mapeado a `s.titular`.
 *
 * @returns {string[]} array de hasta 11 nombres en orden DOM
 */
export function parseStartingXIFromHtml(html) {
  return parseStartingXISlotsFromHtml(html).map((s) => s.titular);
}

/**
 * @deprecated wrapper legacy que hace fetch + parse. Conservado por
 * compatibilidad con tests existentes. Producción usa parseStartingXIFromHtml
 * directamente sobre el HTML cacheado por fetch_sources.py.
 */
export async function parseStartingXI(slug, opts = {}) {
  // 10-jun-2026: FF movió las páginas de equipo a /world-cup/equipos/<slug>
  // (la ruta /equipos/<slug> devuelve 404 desde ~jun-2026).
  const url = `${FF_BASE}/world-cup/equipos/${slug}`;
  const html = await fetchText(url, opts);
  return parseStartingXIFromHtml(html);
}

// Helper para obtener HTML de FF: cache primero, fallback fetch live.
async function getFFLineupHtml(slug, { iso3, verbose = false } = {}) {
  if (iso3) {
    try {
      const html = loadCachedHtml(`ff-${iso3.toLowerCase()}`);
      if (verbose) console.log(`  [ff] cache hit ff-${iso3.toLowerCase()} (${html.length} bytes)`);
      return html;
    } catch (e) {
      if (verbose) console.log(`  [ff] cache miss para ${iso3} (${e.message.slice(0, 60)}), fallback fetch live`);
    }
  }
  return await fetchText(`${FF_BASE}/world-cup/equipos/${slug}`, { verbose });
}

// Devuelve sólo los slots del once-tipo (titular + alternativa? + x/y/isGK) sin
// tocar roster ni matching. Lee del cache Scrapling (ff-<iso3>.html) si iso3
// está disponible, fallback fetch live. Usado por --build-xi para construir
// squads.xi con coordenadas sin re-ejecutar el pipeline completo de scrapeCountry.
export async function fetchStartingXISlots(slug, { iso3 = null, verbose = false } = {}) {
  const html = await getFFLineupHtml(slug, { iso3, verbose });
  return parseStartingXISlotsFromHtml(html);
}

// Pipeline completo para un país: detecta lista, parsea roster, parsea XI, cruza.
// Devuelve { roster, is_final, xi_names, xi_slots, newsUrl, titulares }.
// Si refreshFinal=true forzamos parseStartingXI aunque ya tengamos roster.
// Si iso3 se proporciona, intenta leer el HTML del XI de cache/sources/ff-<iso3>.html
// (poblado por scripts/scraping/fetch_sources.py) antes de hacer fetch live.
//
// 28-may-2026 — `xi_slots` añadido (Array<{titular, alternativa?}>) para
// soportar fallback pos-0 → pos-1 en el matcher. `xi_names` mantenido como
// array plano de titulares por compat con llamadores legacy.
export async function scrapeCountry(slug, opts = {}) {
  const { verbose = false, refreshFinal = false, iso3 = null } = opts;
  const result = {
    roster: [],
    is_final: false,
    xi_names: [],
    xi_slots: [],
    newsUrl: null,
    titulares: 0,
  };

  const newsLink = await findFinalListUrl(slug, { verbose }).catch(() => null);
  if (newsLink) {
    if (verbose) console.log(`  → noticia: ${newsLink.url}`);
    result.newsUrl = newsLink.url;
    try {
      result.roster = await parseNewsRoster(newsLink.url, { verbose });
      result.is_final = result.roster.length > 0;
    } catch (err) {
      if (verbose) console.log(`  ! parseNewsRoster falló: ${err.message}`);
    }
  }

  // XI: lo intentamos siempre que haya roster, o si refreshFinal está activo.
  // Lee del cache cuando iso3 está disponible (FF_COUNTRIES en fetch_sources.py).
  if (result.roster.length > 0 || refreshFinal) {
    try {
      const html = await getFFLineupHtml(slug, { iso3, verbose });
      result.xi_slots = parseStartingXISlotsFromHtml(html);
      result.xi_names = result.xi_slots.map((s) => s.titular);
    } catch (err) {
      if (verbose) console.log(`  ! parseStartingXI falló: ${err.message}`);
    }
  }

  // Cruzar XI con roster: marcar es_titular=true en los matches.
  // Usa xi_slots (con pos-0 + pos-1) + iso3 para alias dict + threshold adaptativo.
  if (result.roster.length > 0 && result.xi_slots.length > 0) {
    // Lazy-load alias dict: only when needed, sync import via JSON file read.
    let aliases = null;
    try {
      const { readFileSync } = await import('node:fs');
      const { fileURLToPath } = await import('node:url');
      const { dirname, resolve } = await import('node:path');
      const __dirname = dirname(fileURLToPath(import.meta.url));
      aliases = JSON.parse(readFileSync(resolve(__dirname, 'name-aliases.json'), 'utf-8'));
    } catch (e) {
      if (verbose) console.log(`  ! name-aliases.json no cargado: ${e.message}`);
    }
    const candidateGroups = result.xi_slots.map((s) =>
      s.alternativa ? [s.titular, s.alternativa] : [s.titular],
    );
    const { matches } = matchAgainstRoster(candidateGroups, result.roster, {
      minScore: 65,
      iso3,
      aliases,
    });
    for (const { matchIdx } of matches) {
      result.roster[matchIdx].es_titular = true;
    }
    result.titulares = matches.length;
    if (verbose) {
      console.log(`  → XI matched ${matches.length}/${result.xi_slots.length}`);
    }
  }

  return result;
}

export { htmlToMd, fetchText };
