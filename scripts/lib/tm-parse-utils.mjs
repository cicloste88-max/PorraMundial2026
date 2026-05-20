// scripts/lib/tm-parse-utils.mjs
// Helpers compartidos por los scrapers TM (kader + marktwert).
// A (tm-worldcup-market-values.mjs) y B (tm-scraper.mjs::parseKaderTable)
// comparten ~80% del parseo — centralizamos para no duplicar.

export function stripTags(s) {
  return String(s || '').replace(/<[^>]+>/g, '');
}

/** Limpia HTML: tags + espacios + saltos + entities básicas. Idempotente. */
export function decodeClean(s) {
  return stripTags(s)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** "https://img.../portrait/medium/616341-1749417164.jpg?lm=1" → ".../616341-1749417164.jpg" */
export function stripTmImageQuery(url) {
  return String(url || '').replace(/\?.*$/, '');
}

/**
 * Extrae { tm_player_id, nombre } del enlace al perfil.
 * Soporta multilinea (Joan García en kader viene con saltos+espacios extra).
 */
export function extractProfileLink(html) {
  const m = html.match(/<a[^>]+href="\/[^"]+\/profil\/spieler\/(\d+)"[^>]*>([\s\S]+?)<\/a>/);
  if (!m) return null;
  return {
    tm_player_id: parseInt(m[1], 10),
    nombre: decodeClean(m[2]),
  };
}

/**
 * Extrae { club, club_id, club_logo_url } del enlace a equipo.
 * skip=1: el segundo <a title> de la fila (el primero suele ser la selección
 * en la página marktwertaenderungen). En kader skip=0 (solo aparece el club).
 */
export function extractClubLink(html, { skip = 1 } = {}) {
  const matches = [...html.matchAll(/<a\s+title="([^"]+)"\s+href="\/[^"]+\/startseite\/verein\/(\d+)/g)];
  if (matches.length <= skip) return null;
  const m = matches[skip];
  const club_id = parseInt(m[2], 10);
  return {
    club: decodeClean(m[1]),
    club_id,
    club_logo_url: `https://tmssl.akamaized.net/images/wappen/verysmall/${club_id}.png`,
  };
}

/**
 * "75,00 mill. €" → 75000000  ;  "800 mil €" → 800000  ;  "1,5 mill. €" → 1500000
 * Formato europeo .es (coma decimal, punto miles). Nunca usar con .com formato inglés.
 */
export function parseValorEs(numStr, unit) {
  if (numStr == null) return null;
  const clean = String(numStr).trim();
  const n = parseFloat(clean.replace(/\./g, '').replace(',', '.'));
  if (isNaN(n)) return null;
  const u = (unit || '').toLowerCase();
  if (u.startsWith('mill')) return Math.round(n * 1_000_000);
  if (u.startsWith('mil')) return Math.round(n * 1_000);
  return Math.round(n);
}

/**
 * Mapeo posición específica TM → bucket Porra. Tabla castellano + inglés legacy.
 * TM .es y .com pueden coexistir según endpoint.
 */
const POSITION_TM_TO_BUCKET = {
  // Castellano (.es)
  Portero: 'Portero',
  'Defensa central': 'Defensa',
  'Lateral derecho': 'Defensa',
  'Lateral izquierdo': 'Defensa',
  'Líbero': 'Defensa',
  Pivote: 'Centrocampista',
  Mediocentro: 'Centrocampista',
  'Mediocentro ofensivo': 'Centrocampista',
  'Mediocentro defensivo': 'Centrocampista',
  'Interior derecho': 'Centrocampista',
  'Interior izquierdo': 'Centrocampista',
  Mediapunta: 'Centrocampista',
  'Extremo derecho': 'Delantero',
  'Extremo izquierdo': 'Delantero',
  'Segundo delantero': 'Delantero',
  'Delantero centro': 'Delantero',
  // Inglés (.com legacy, mantener por compatibilidad)
  Goalkeeper: 'Portero',
  'Centre-Back': 'Defensa',
  'Left-Back': 'Defensa',
  'Right-Back': 'Defensa',
  'Defensive Midfield': 'Centrocampista',
  'Central Midfield': 'Centrocampista',
  'Attacking Midfield': 'Centrocampista',
  'Left Midfield': 'Centrocampista',
  'Right Midfield': 'Centrocampista',
  'Left Winger': 'Delantero',
  'Right Winger': 'Delantero',
  'Second Striker': 'Delantero',
  'Centre-Forward': 'Delantero',
};

export function positionToBucket(positionTm) {
  if (!positionTm) return null;
  return POSITION_TM_TO_BUCKET[positionTm] || null;
}

/** Concurrencia limitada: ejecuta fn(item) en paralelo de max N a la vez. */
export async function mapConcurrent(items, fn, { concurrency = 4 } = {}) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

/** Sleep helper para throttling. */
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
