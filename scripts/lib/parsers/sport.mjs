// Parser fuente Sport.es — listas de convocados Mundial 2026.
// URL: https://www.sport.es/es/noticias/mundial-futbol/listas-convocados-mundial-2026-...
//
// Estructura HTML (validada 19-may):
//   <h2>Grupo A</h2>
//   <div>
//     <p class="ft-text"><strong>México</strong></p>
//     <p class="ft-text">Lista por confirmar</p>
//     <p class="ft-text"><strong>Bélgica</strong></p>
//     <ul class="ft-list ft-list--primary">
//       <li class="ft-list__item"><strong>Porteros</strong>: Courtois (Real Madrid), ...</li>
//       <li class="ft-list__item"><strong>Defensas</strong>: ...</li>
//       <li class="ft-list__item"><strong>Centrocampistas</strong>: ...</li>
//       <li class="ft-list__item"><strong>Delanteros</strong>: ...</li>
//     </ul>
//
// Diferencia vs AS:
//   - País SIN bullet `•` (AS usa `<h3>• País</h3>`, Sport usa `<strong>País</strong>`).
//   - Grupos en `<h2>Grupo X</h2>` (AS también).
//   - "Lista por confirmar" para países sin plantilla → el parser abre el iso3
//     pero queda con players=[].
//
// Reusamos `parseHtml` de as.mjs pasando `requireBullet: false`.
//
// Contrato y reglas: scripts/lib/parsers/README.md.

import { parseHtml as parseHtmlAS } from './as.mjs';
import { loadCachedHtml } from './_util.mjs';

export const SOURCE_NAME = 'sport';
export const SOURCE_URL =
  'https://www.sport.es/es/noticias/mundial-futbol/listas-convocados-mundial-2026-jugadores-plantillas-selecciones-130245904';

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
