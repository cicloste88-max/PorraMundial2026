// Parser fuente Olympics.com — listas de convocados Mundial 2026.
// URL: https://www.olympics.com/es/noticias/mundial-2026-listas-48-selecciones
//
// Estructura típica (validada manualmente 18-may con Chrome MCP):
//   <h3>Bosnia y Herzegovina</h3>           ← header SIN bullet (a diferencia de AS)
//   <p>Arqueros: Vasilj (FC St. Pauli, ALE), ...</p>
//   <p>Defensores: ...</p>
//   <p>Mediocampistas: ...</p>
//   <p>Delanteros: ...</p>
//   <p>Entrenador: Sergej Barbarez</p>      ← opcional
//   <h3>República de Corea</h3>
//   ...
//   <h2>¿Cuándo publican sus listas?</h2>    ← FRONTERA: a partir de aquí es calendario
//   <h3>18 de mayo</h3><p>Austria</p>...
//
// IMPORTANTE: el bloque del calendario lo procesa `calendar.mjs` separadamente.
// Este parser SE DETIENE en cuanto detecta la transición a la sección de calendario.
//
// Formato jugador: "Nombre (Club, PAIS)" — el ", PAIS" es código 2-4 letras
// del país del club (no del jugador). Lo strippeamos en parsePlayer().
//
// Buckets Olympics:
//   Arqueros|Porteros → Portero
//   Defensores|Defensas → Defensa
//   Mediocampistas|Centrocampistas → Centrocampista
//   Delanteros → Delantero
//
// Contrato y reglas: scripts/lib/parsers/README.md.

import { decode } from 'html-entities';
import {
  htmlToLines,
  detectCountryHeader,
  detectBucketLine,
  detectCoachLine,
  parsePlayerList,
  loadCachedHtml,
} from './_util.mjs';

export const SOURCE_NAME = 'olympics';
export const SOURCE_URL =
  'https://www.olympics.com/es/noticias/mundial-2026-listas-48-selecciones';

// Detecta la frontera con el bloque de calendario. A partir de aquí, dejamos
// de procesar (calendar.mjs se encarga).
const CALENDAR_BOUNDARY_RE = /cu[áa]ndo\s+publican.*listas|calendario.*publicaci[óo]n|fechas?\s+de\s+anuncio/i;

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
 *  1. Convierte HTML → array de líneas.
 *  2. Itera. Estado: currentIso3.
 *  3. NO usa bullets para detectar headers (Olympics no los usa).
 *  4. Detecta "Entrenador: ..." y lo guarda en byIso3[iso3].coach.
 *  5. Cuando encuentra "¿Cuándo publican sus listas?" (o regex equivalente),
 *     CORTA — el resto del documento es calendario, no plantillas.
 */
export function parseHtml(html) {
  void decode;

  const lines = htmlToLines(html);
  const byIso3 = {};
  let currentIso3 = null;
  let lastBucket = null;
  // True solo si la última línea de bucket terminó en coma (lista incompleta).
  // Señal estructural: Olympics SOLO parte un bucket en dos líneas cuando la
  // primera deja una coma colgada. Evita absorber prosa decorativa con comas.
  let lastBucketTrailingComma = false;

  for (const line of lines) {
    // FRONTERA: a partir de aquí es calendario, no plantillas
    if (CALENDAR_BOUNDARY_RE.test(line)) break;

    // Header de selección (Olympics NO usa bullets)
    const header = detectCountryHeader(line, { requireBullet: false });
    if (header) {
      currentIso3 = header.iso3;
      if (!byIso3[currentIso3]) byIso3[currentIso3] = { players: [] };
      // Reset al cambiar de selección — evita leak entre países
      lastBucket = null;
      lastBucketTrailingComma = false;
      continue;
    }

    if (!currentIso3) continue;

    // Entrenador?
    const coach = detectCoachLine(line);
    if (coach) {
      byIso3[currentIso3].coach = coach;
      // El coach suele cerrar el país; consumimos el flag de continuación
      // (cualquier línea posterior antes del siguiente header NO es continuación).
      lastBucketTrailingComma = false;
      continue;
    }

    // Bucket: lista de jugadores?
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

    // Continuación huérfana: solo se acepta si el bucket previo dejó una
    // coma colgada. Caso real BEL Olympics 18-may: "Defensas: ..., Meunier,"
    // (línea con coma final) y los 3 restantes en el siguiente <p>.
    if (lastBucket && lastBucketTrailingComma) {
      const players = parsePlayerList(line);
      for (const p of players) {
        const entry = { nombre: p.nombre, posicion: lastBucket };
        if (p.club) entry.club = p.club;
        byIso3[currentIso3].players.push(entry);
      }
      // Una continuación por bucket: si la línea de continuación también queda
      // con coma final, se asume cierre (Olympics no parte en 3+ líneas).
      lastBucketTrailingComma = false;
    }
  }

  return { source: SOURCE_NAME, byIso3 };
}
