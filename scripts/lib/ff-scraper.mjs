// futbolfantasy.com scraper — pipeline en 3 pasos.
//
// Paso 1: detectar URL de la noticia "anuncia la lista" en /world-cup/equipos/<slug>/noticias/1
// Paso 2: parsear el cuerpo de esa noticia → roster completo con secciones por posición
// Paso 3: extraer XI titular de /world-cup/equipos/<slug> ("Posible once tipo")
//
// Si el paso 1 no encuentra noticia → roster=[] e is_final=false (solo paso 3 disponible).
// El XI titular se cruza con el roster vía matchAgainstRoster (name-matcher.mjs).

import { matchAgainstRoster } from './name-matcher.mjs';

const FF_BASE = 'https://www.futbolfantasy.com/world-cup';
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

// Tabla de entidades HTML nombradas más frecuentes en futbolfantasy (Latin-1
// extendido + tipográficas). Necesario porque la página sirve nombres como
// "Th&eacute;o", "N&rsquo;Golo", "Za&iuml;re-Emery" que rompen el matcher
// y dejan basura en BD si no se decodifican.
const HTML_ENTITIES = {
  nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'",
  aacute: 'á', eacute: 'é', iacute: 'í', oacute: 'ó', uacute: 'ú',
  Aacute: 'Á', Eacute: 'É', Iacute: 'Í', Oacute: 'Ó', Uacute: 'Ú',
  agrave: 'à', egrave: 'è', igrave: 'ì', ograve: 'ò', ugrave: 'ù',
  Agrave: 'À', Egrave: 'È', Igrave: 'Ì', Ograve: 'Ò', Ugrave: 'Ù',
  acirc: 'â', ecirc: 'ê', icirc: 'î', ocirc: 'ô', ucirc: 'û',
  Acirc: 'Â', Ecirc: 'Ê', Icirc: 'Î', Ocirc: 'Ô', Ucirc: 'Û',
  auml: 'ä', euml: 'ë', iuml: 'ï', ouml: 'ö', uuml: 'ü', yuml: 'ÿ',
  Auml: 'Ä', Euml: 'Ë', Iuml: 'Ï', Ouml: 'Ö', Uuml: 'Ü', Yuml: 'Ÿ',
  ntilde: 'ñ', Ntilde: 'Ñ', atilde: 'ã', otilde: 'õ', Atilde: 'Ã', Otilde: 'Õ',
  ccedil: 'ç', Ccedil: 'Ç', szlig: 'ß',
  aring: 'å', Aring: 'Å', aelig: 'æ', AElig: 'Æ', oelig: 'œ', OElig: 'Œ',
  oslash: 'ø', Oslash: 'Ø',
  lsquo: "'", rsquo: "'", ldquo: '"', rdquo: '"',
  laquo: '«', raquo: '»',
  ndash: '–', mdash: '—', hellip: '…', middot: '·', bull: '•',
};

function decodeHtmlEntities(s) {
  return String(s)
    .replace(/&([a-zA-Z]+);/g, (m, name) =>
      HTML_ENTITIES[name] !== undefined ? HTML_ENTITIES[name] : m
    )
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(parseInt(n, 10)))
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
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
  s = decodeHtmlEntities(s);
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

// Paso 3 — extraer los 11 nombres del once tipo en /equipos/<slug>
export async function parseStartingXI(slug, opts = {}) {
  const url = `${FF_BASE}/equipos/${slug}`;
  const html = await fetchText(url, opts);

  // Si FF aún no ha publicado el XI predicho, sale placeholder
  // "Alineación aún no disponible" / "Once aún no disponible" /
  // "Sin alineación disponible". En esos casos devolvemos [] y
  // runScrape (--refresh-final) preserva el roster intacto sin
  // marcar titulares (Fix C).
  if (
    /[Aa]lineaci[óo]n\s+a[úu]n\s+no\s+disponible/i.test(html) ||
    /[Oo]nce\s+a[úu]n\s+no\s+disponible/i.test(html) ||
    /[Ss]in\s+alineaci[óo]n\s+disponible/i.test(html)
  ) {
    if (opts.verbose) console.log('  → XI placeholder detectado (página sin once tipo publicado), xi_names=[]');
    return [];
  }

  // Localizar el inicio de la sección "Posible once tipo" / "Once tipo" en el HTML
  const anchor = html.search(/Posible once tipo|Once tipo|Once probable/i);
  const slice = anchor >= 0 ? html.slice(anchor) : html;

  // Estrategia A: extraer todos los alt= de <img> dentro de la sección (los 11 primeros)
  const altRe = /<img\b[^>]*\balt="([^"]+)"/gi;
  const alts = [];
  let m;
  while ((m = altRe.exec(slice)) !== null) {
    const alt = decodeHtmlEntities(m[1]).trim();
    // filtrar alts genéricos (escudos, banderas, iconos, etiquetas de sección)
    if (/escudo|bandera|flag|icon|logo|sponsor|patrocinador|^once$|^xi$|^equipo$|^alineaci[óo]n$|^formaci[óo]n$|^titulares?$|^plantilla$|^banco$|^suplent/i.test(alt)) continue;
    if (alt.length < 3 || alt.length > 60) continue;
    alts.push(alt);
    if (alts.length >= 22) break; // margen para descartar duplicados/icons
  }

  // Estrategia B (fallback): regex del brief sobre markdown
  let xi = dedupePreserveOrder(alts).slice(0, 11);
  if (xi.length < 11) {
    const md = htmlToMd(slice);
    const mdRe = /\[!\[([^\]]+)\]\([^)]*\)\]\([^)]*\)/g;
    const mdNames = [];
    let mm;
    while ((mm = mdRe.exec(md)) !== null) {
      mdNames.push(mm[1].trim());
    }
    if (mdNames.length >= 11) {
      xi = dedupePreserveOrder(mdNames).slice(0, 11);
    }
  }
  return xi;
}

function dedupePreserveOrder(arr) {
  const seen = new Set();
  const out = [];
  for (const x of arr) {
    const k = x.toLowerCase();
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(x);
  }
  return out;
}

// Pipeline completo para un país: detecta lista, parsea roster, parsea XI, cruza.
// Devuelve { roster: [...], is_final: bool, xi_names: [...], newsUrl: string|null }.
// Si refreshFinal=true forzamos parseStartingXI aunque ya tengamos roster.
export async function scrapeCountry(slug, opts = {}) {
  const { verbose = false, refreshFinal = false } = opts;
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

  // XI: lo intentamos siempre que haya roster, o si refreshFinal está activo
  if (result.roster.length > 0 || refreshFinal) {
    try {
      result.xi_names = await parseStartingXI(slug, { verbose });
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
