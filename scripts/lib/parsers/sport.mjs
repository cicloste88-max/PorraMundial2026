// Parser fuente Sport.es — listas de convocados Mundial 2026.
// URL: https://www.sport.es/es/noticias/mundial-futbol/listas-convocados-mundial-2026-...
//
// Mismo grupo editorial que AS — el parser puede ser muy similar pero NO idéntico
// (HTML wrappers, clases CSS y orden de secciones difieren). Implementar como módulo
// propio mantiene la independencia de cross-validate y permite que una fuente caiga
// sin afectar a la otra.
//
// Contrato y reglas: scripts/lib/parsers/README.md.

import { decode } from 'html-entities';

export const SOURCE_NAME = 'sport';
export const SOURCE_URL =
  'https://www.sport.es/es/noticias/mundial-futbol/listas-convocados-mundial-2026-jugadores-plantillas-selecciones-130245904';

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
 */
export function parseHtml(html) {
  // TODO(San): implementar parser Sport.es. Si el HTML acaba siendo casi idéntico
  // a AS, considerar extraer la lógica común a un helper compartido en este mismo
  // módulo (NO importar desde as.mjs — mantener independencia de fallo).
  void decode;
  void html;
  return { source: SOURCE_NAME, byIso3: {} };
}
