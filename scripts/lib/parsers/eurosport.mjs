// Parser fuente Eurosport.es — listas de convocados Mundial 2026.
// URL: https://www.eurosport.es/futbol/mundial/2026/convocatorias-selecciones-nacionales-todas-listas-jugadores-mundial-2026_sto23300837/story.shtml
//
// Estructura HTML (validada 19-may):
//   <b>• MÉXICO</b>
//   <b>Porteros:</b> ...
//   <b>Defensas:</b> ...
//   <b>Centrocampistas:</b> ...
//   <b>Delanteros:</b> ...
//   <b>• REPÚBLICA CHECA</b> ...
//
// Headers de país con bullet en `<b>` (no `<h3>`), buckets también en `<b>`.
// La función `parseHtml` de as.mjs maneja este patrón out-of-the-box porque
// `htmlToLines` colapsa cualquier `<b>` a texto inline y los bullets `• ` los
// detecta `detectCountryHeader` vía `BULLET_PREFIX_RE`.
//
// Diferencia con AS:
//   - Más cobertura "TOC" (lista 47 países, ~14 publicados a 19-may).
//   - Cuerpos sin "Grupo X" entre headers.
//   - Bucket "Delanteros" puede faltar en algunos países (e.g. CRO 19-may sin
//     publicar atacantes aún) → conteo parcial es correcto, no es bug del parser.
//
// Contrato y reglas: scripts/lib/parsers/README.md.

import { parseHtml as parseHtmlAS } from './as.mjs';

export const SOURCE_NAME = 'eurosport';
export const SOURCE_URL =
  'https://www.eurosport.es/futbol/mundial/2026/convocatorias-selecciones-nacionales-todas-listas-jugadores-mundial-2026_sto23300837/story.shtml';

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

export function parseHtml(html) {
  const out = parseHtmlAS(html);
  return { ...out, source: SOURCE_NAME };
}
