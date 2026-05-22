// Parser fuente ESPN Deportes — listas de convocados Mundial 2026.
// URL: https://espndeportes.espn.com/futbol/mundial/nota/_/id/16715015/...
//
// Sustituye a Eurosport (descartada por geoblock 307 → /geoblocking.shtml
// irresoluble desde IPs USA — ver ERR-XX en errores_conocidos_porra.md).
// Aporta cobertura latinoamericana adicional vs las 4 fuentes españolas.
//
// Estructura HTML esperada (similar a AS — bullet `•` + buckets en <strong>
// o <b>): primer run productivo confirmará y se ajustará el parser si
// difiere significativamente. Si difiere, abrir follow-up sin bloquear el
// sprint (las otras 4 fuentes dan cobertura suficiente).
//
// Reusamos `parseHtml` de as.mjs con `requireBullet: false` (default ESPN
// puede no tener bullet — más conservador).
//
// Contrato y reglas: scripts/lib/parsers/README.md.

import { parseHtml as parseHtmlAS } from './as.mjs';
import { loadCachedHtml } from './_util.mjs';

export const SOURCE_NAME = 'espn';
export const SOURCE_URL =
  'https://espndeportes.espn.com/futbol/mundial/nota/_/id/16715015/mundial-2026-convocatorias-de-selecciones-todas-las-listas-de-jugadores';

export async function fetchAndParse({ verbose = false, html = null } = {}) {
  let body = html;
  if (!body) {
    body = loadCachedHtml(SOURCE_NAME);
    if (verbose) console.log(`  [${SOURCE_NAME}] cache hit (${body.length} bytes)`);
  }
  const parsed = parseHtml(body);
  return { ...parsed, source: SOURCE_NAME, fetchedAt: new Date().toISOString(), _html: body };
}

export function parseHtml(html) {
  const out = parseHtmlAS(html, { requireBullet: false });
  return { ...out, source: SOURCE_NAME };
}
