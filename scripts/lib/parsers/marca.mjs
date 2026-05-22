// Parser fuente Marca.com — listas de convocados Mundial 2026.
// URL: https://www.marca.com/futbol/mundial/2026/05/16/convocatorias-oficiales-...
//
// Estructura HTML (validada 19-may):
//   <h2>Grupo A</h2>
//   <h2>República Checa</h2>      ← header de país sin bullet
//   <h2>México</h2>
//   <h2>Corea del Sur</h2>
//   <p><strong>Porteros:</strong> ... </p>
//   <p><strong>Defensas:</strong> ... </p>
//   ...
//
// Reusamos `parseHtml` de as.mjs con `requireBullet: false` (igual que sport.mjs).
//
// Diferencia clave vs AS:
//   - Headers de país en `<h2>` (no `<h3>`), sin bullet `•`.
//   - Cobertura tiende a las 48 con grupos completos.
//
// Contrato y reglas: scripts/lib/parsers/README.md.

import { parseHtml as parseHtmlAS } from './as.mjs';
import { loadCachedHtml } from './_util.mjs';

export const SOURCE_NAME = 'marca';
export const SOURCE_URL =
  'https://www.marca.com/futbol/mundial/2026/05/16/convocatorias-oficiales-selecciones-disputaran-mundial.html';

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
