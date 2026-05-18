// Parser fuente Olympics.com — listas de convocados Mundial 2026.
// URL: https://www.olympics.com/es/noticias/mundial-2026-listas-48-selecciones
//
// Estructura típica (validada manualmente 18-may con Chrome MCP):
//   - Bloque por selección con cabecera (nombre país).
//   - Líneas con prefijos: "Arqueros:" / "Defensores:" / "Mediocampistas:" / "Delanteros:"
//   - "Entrenador:" opcional al final de cada bloque.
//   - **Bonus**: bloque final con calendario de futuras publicaciones por fecha.
//     Ese bloque lo extrae `calendar.mjs`, NO este módulo.
//
// Olympics es la fuente más fiable según el sitrep 18-may (caso CRO: AS marcaba
// final, Olympics decía 1-jun → Olympics tenía razón). El cross-validate puede
// dar más peso a esta fuente si surge un caso de empate 1-1.
//
// Contrato y reglas: scripts/lib/parsers/README.md.

import { decode } from 'html-entities';

export const SOURCE_NAME = 'olympics';
export const SOURCE_URL =
  'https://www.olympics.com/es/noticias/mundial-2026-listas-48-selecciones';

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
 *
 * Notas operativas:
 *  - El bloque por país suele estar wrapped en una sección con un H3 que contiene
 *    el nombre del país.
 *  - "Entrenador:" no siempre está; tratarlo como opcional.
 *  - Algunos países aparecen SIN jugadores (solo nombre + "Lista por anunciar el N de mes").
 *    En ese caso devolver { players: [] } — el cross-validate los descarta.
 *  - El bloque de calendario NO va en byIso3 — lo procesa calendar.mjs.
 */
export function parseHtml(html) {
  // TODO(San): implementar parser Olympics. Pattern:
  //   1. localizar secciones por país (probablemente <section> o <div> con h3).
  //   2. dentro: regex sobre "Arqueros:" + "Defensores:" + ...
  //   3. capturar "Entrenador:" si está.
  //   4. mapping nombre-país → iso3 vía country-map.json.
  //   5. ignorar la sección del calendario (la procesa calendar.mjs aparte).
  void decode;
  void html;
  return { source: SOURCE_NAME, byIso3: {} };
}
