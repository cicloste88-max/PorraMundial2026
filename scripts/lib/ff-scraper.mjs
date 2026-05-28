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

/**
 * Parsea el HTML completo de /equipos/<slug> de FF y devuelve los 11 nombres
 * del XI titular. Robusto contra las 2 variantes de markup FF (con/sin
 * wrapper class "jugadores-titulares-X").
 *
 * @returns {string[]} array de hasta 11 nombres en orden DOM
 */
export function parseStartingXIFromHtml(html) {
  if (!html || html.length < 1000) return [];

  // Si FF aún no ha publicado el XI predicho, sirve la imagen de campo vacío.
  // El texto "Alineación aún no disponible" se inyecta por JS tras hidratación
  // cliente, no aparece en HTML servido — detectamos la imagen.
  if (/\/alineaciones\/0\.jpg/i.test(html)) return [];

  const $ = cheerio.load(html);

  // PRIMARIO: atributo semántico data-onceff="titular" (ambas variantes FF).
  let $players = $('[data-onceff="titular"]');

  // FALLBACK: wrapper-style legacy, por si FF dropea el data-attr.
  if ($players.length === 0) {
    const $tit = $('div[class*="jugadores-titulares-"]').first();
    if ($tit.length === 0) return [];
    $players = $tit.children('div.tipo_campo');
  }

  const names = [];
  $players.each((_, el) => {
    const $el = $(el);
    const classes = $el.attr('class') || '';
    // Defensa contra slots supl-N que pudieran caer aquí por marcado raro.
    if (/\bsupl-\d+\b/.test(classes)) return;

    // PRIMARIO: foto del jugador con alt poblado. FF tiene 4 <img> por slot —
    // escudo club (alt=""), bandera país (alt=""), bandera región (alt="") y
    // foto del jugador (alt="Nombre Completo"). Filtro img[alt] non-empty
    // garantiza que cogemos la foto, no el escudo. Validado en PR #106.
    const altName = $el
      .find('img[alt]')
      .filter((_, img) => ($(img).attr('alt') || '').trim() !== '')
      .first()
      .attr('alt');
    if (altName) {
      const n = decodeHtml(altName).trim();
      if (n) {
        names.push(n);
        return;
      }
    }

    // FALLBACK: slug del href de <a.camiseta> → "nico-williams" → "Nico Williams".
    // Pierde acentos pero garantiza algo extractable si la foto no cargó.
    const href = $el.find('a.camiseta').first().attr('href') || '';
    const slugMatch = href.match(/\/jugadores\/([^/]+)\//);
    if (slugMatch) {
      const slug = slugMatch[1];
      const fromSlug = slug
        .split('-')
        .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
        .join(' ');
      if (fromSlug) names.push(fromSlug);
    }
  });

  return names.slice(0, 11);
}

/**
 * @deprecated wrapper legacy que hace fetch + parse. Conservado por
 * compatibilidad con tests existentes. Producción usa parseStartingXIFromHtml
 * directamente sobre el HTML cacheado por fetch_sources.py.
 */
export async function parseStartingXI(slug, opts = {}) {
  const url = `${FF_BASE}/equipos/${slug}`;
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
  return await fetchText(`${FF_BASE}/equipos/${slug}`, { verbose });
}

// Pipeline completo para un país: detecta lista, parsea roster, parsea XI, cruza.
// Devuelve { roster: [...], is_final: bool, xi_names: [...], newsUrl: string|null }.
// Si refreshFinal=true forzamos parseStartingXI aunque ya tengamos roster.
// Si iso3 se proporciona, intenta leer el HTML del XI de cache/sources/ff-<iso3>.html
// (poblado por scripts/scraping/fetch_sources.py) antes de hacer fetch live.
export async function scrapeCountry(slug, opts = {}) {
  const { verbose = false, refreshFinal = false, iso3 = null } = opts;
  const result = {
    roster: [],
    is_final: false,
    xi_names: [],
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
      result.xi_names = parseStartingXIFromHtml(html);
    } catch (err) {
      if (verbose) console.log(`  ! parseStartingXI falló: ${err.message}`);
    }
  }

  // Cruzar XI con roster: marcar es_titular=true en los matches
  if (result.roster.length > 0 && result.xi_names.length > 0) {
    const { matches } = matchAgainstRoster(result.xi_names, result.roster, { minScore: 65 });
    for (const { matchIdx } of matches) {
      result.roster[matchIdx].es_titular = true;
    }
    result.titulares = matches.length;
    if (verbose) {
      console.log(`  → XI matched ${matches.length}/${result.xi_names.length}`);
    }
  }

  return result;
}

export { htmlToMd, fetchText };
