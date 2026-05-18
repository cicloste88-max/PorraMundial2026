// Parser fuente AS — listas de convocados Mundial 2026.
// URL: https://as.com/futbol/mundial/listas-de-convocados-para-el-mundial-2026-...
//
// Estructura típica (validada manualmente 18-may con Chrome MCP):
//   - Una sola página listando las 48 selecciones por grupos A-L.
//   - Cada selección como bullet con cabecera (nombre país + grupo).
//   - Jugadores agrupados en líneas con prefijos:
//       "Porteros:" / "Defensas:" / "Mediocampistas:" / "Centrocampistas:" / "Delanteros:"
//
// Contrato y reglas: scripts/lib/parsers/README.md.
// El parseHtml() real lo aporta San tras consolidar samples del 18-may; este stub
// solo valida el contrato I/O para que el orquestador funcione.

import { decode } from 'html-entities';

export const SOURCE_NAME = 'as';
export const SOURCE_URL =
  'https://as.com/futbol/mundial/listas-de-convocados-para-el-mundial-2026-selecciones-y-todos-los-jugadores-que-estaran-en-la-copa-del-mundo-f202605-n-2/';

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

export async function fetchAndParse({ verbose = false, html = null } = {}) {
  let body = html;
  if (!body) {
    if (verbose) console.log(`  [${SOURCE_NAME}] GET ${SOURCE_URL}`);
    const r = await fetch(SOURCE_URL, {
      headers: {
        'User-Agent': UA,
        'Accept-Language': 'es-ES,es;q=0.9',
        Accept: 'text/html,application/xhtml+xml',
      },
    });
    if (!r.ok) throw new Error(`[${SOURCE_NAME}] HTTP ${r.status}`);
    body = await r.text();
  }
  const parsed = parseHtml(body);
  return { ...parsed, source: SOURCE_NAME, fetchedAt: new Date().toISOString(), _html: body };
}

/**
 * parseHtml — STUB. San implementa el parser real sobre samples de 18-may.
 * Devuelve byIso3 vacío para que cross-validate degrade a "0 fuentes" sin romper.
 *
 * @param {string} html
 * @returns {{ source: 'as', byIso3: Record<string, { group?: string, coach?: string, players: Array<{nombre:string,posicion:string,dorsal?:number|null,club?:string}> }> }}
 */
export function parseHtml(html) {
  // TODO(San): implementar parser AS. Pattern:
  //   1. cheerio o regex multiline para localizar bloques por grupo (A-L).
  //   2. dentro de cada bloque, regex sobre "Porteros: a, b, c" + "Defensas: ..."
  //   3. mapping nombre-país → iso3 vía country-map.json + normalizeCountryKey.
  //   4. todo string final pasa por decode() de html-entities.
  void decode;
  void html;
  return { source: SOURCE_NAME, byIso3: {} };
}
