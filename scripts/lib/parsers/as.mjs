// Parser fuente AS — listas de convocados Mundial 2026.
// URL: https://as.com/futbol/mundial/listas-de-convocados-para-el-mundial-2026-...
//
// Estructura típica (validada manualmente 18-may con Chrome MCP):
//   <article>
//     <h3><b>Grupo A</b></h3>             ← separador de grupo
//     <h3>• México</h3>                    ← header sin plantilla (skip por falta de <p>)
//     <h3>• Corea del Sur</h3>
//     <p><b>Porteros</b>: Kim Seung-Gyu (FC Tokyo), ...</p>
//     <p><b>Defensas</b>: ...</p>
//     <p><b>Centrocampistas</b>: ...</p>
//     <p><b>Delanteros</b>: ...</p>
//     <h3>• República Checa</h3>           ← sin plantilla
//     <h3><b>Grupo B</b></h3>
//     ...
//   </article>
//
// Formato jugador: "Nombre (Club)" — sin código país tras el club.
//
// Contrato y reglas: scripts/lib/parsers/README.md.

import { decode } from 'html-entities';
import {
  htmlToLines,
  detectGroupLine,
  detectCountryHeader,
  detectBucketLine,
  parsePlayerList,
  loadCachedHtml,
} from './_util.mjs';

export const SOURCE_NAME = 'as';
export const SOURCE_URL =
  'https://as.com/futbol/mundial/listas-de-convocados-para-el-mundial-2026-selecciones-y-todos-los-jugadores-que-estaran-en-la-copa-del-mundo-f202605-n-2/';

/**
 * @param {object} opts
 * @param {boolean} [opts.verbose] log a stdout cuando se carga del cache
 * @param {string|null} [opts.html] HTML inyectado (tests). Si null, lee del
 *   cache/sources/as.html que escribió scripts/scraping/fetch_sources.py.
 */
export async function fetchAndParse({ verbose = false, html = null } = {}) {
  let body = html;
  if (!body) {
    body = loadCachedHtml(SOURCE_NAME);
    if (verbose) console.log(`  [${SOURCE_NAME}] cache hit (${body.length} bytes)`);
  }
  const parsed = parseHtml(body);
  return { ...parsed, source: SOURCE_NAME, fetchedAt: new Date().toISOString(), _html: body };
}

/**
 * parseHtml — pura, sin side-effects.
 *
 * Estrategia:
 *  1. Convierte HTML → array de líneas (block-level boundaries preservadas).
 *  2. Itera. Estado mínimo: currentIso3, currentGroup.
 *  3. Línea "Grupo X" → guarda letra en currentGroup.
 *  4. Línea "• País" → abre selección. Si no tiene jugadores después, queda con players=[].
 *  5. Línea "Bucket: lista" → añade jugadores a la selección abierta.
 *
 * Opciones:
 *   requireBullet (default true) — exige bullet `•` en header de país (AS-style).
 *     Pasar `false` para fuentes que usan `<strong>País</strong>` sin bullet (Sport.es).
 *
 * Idempotente con respecto a textos repetidos (la repetición de un header se ignora).
 */
export function parseHtml(html, { requireBullet = true } = {}) {
  // El bucle interno ya decodifica entidades dentro de htmlToLines (decode aplicado).
  // No-op explícito sobre `decode` para que el linter sepa que el helper sí lo usa.
  void decode;

  const lines = htmlToLines(html);
  const byIso3 = {};
  let currentIso3 = null;
  let currentGroup = null;
  // Defensa contra splits inesperados: si un bucket termina en coma, la
  // siguiente línea sin prefijo se trata como continuación. Reset al cambiar
  // de país (header) o al detectar grupo nuevo. Ver olympics.mjs para el caso
  // canónico (BEL Olympics 18-may).
  let lastBucket = null;
  let lastBucketTrailingComma = false;

  for (const line of lines) {
    // 1. Línea de grupo
    const groupLetter = detectGroupLine(line);
    if (groupLetter) {
      currentGroup = groupLetter;
      lastBucket = null;
      lastBucketTrailingComma = false;
      continue;
    }

    // 2. Línea de header de selección
    const header = detectCountryHeader(line, { requireBullet });
    if (header) {
      currentIso3 = header.iso3;
      if (!byIso3[currentIso3]) {
        byIso3[currentIso3] = { players: [] };
        if (currentGroup) byIso3[currentIso3].group = currentGroup;
      }
      lastBucket = null;
      lastBucketTrailingComma = false;
      continue;
    }

    if (!currentIso3) continue;

    // 3. Línea de bucket (Porteros: / Defensas: / ...)
    const bucket = detectBucketLine(line);
    if (bucket) {
      const players = parsePlayerList(bucket.listText);
      for (const p of players) {
        const entry = { nombre: p.nombre, posicion: bucket.posicion };
        if (p.club) entry.club = p.club;
        byIso3[currentIso3].players.push(entry);
      }
      lastBucket = bucket.posicion;
      lastBucketTrailingComma = /,\s*$/.test(bucket.listText);
      continue;
    }

    // 4. Continuación huérfana — solo si bucket previo dejó coma colgada.
    if (lastBucket && lastBucketTrailingComma) {
      const players = parsePlayerList(line);
      for (const p of players) {
        const entry = { nombre: p.nombre, posicion: lastBucket };
        if (p.club) entry.club = p.club;
        byIso3[currentIso3].players.push(entry);
      }
      lastBucketTrailingComma = false;
    }
  }

  return { source: SOURCE_NAME, byIso3 };
}
