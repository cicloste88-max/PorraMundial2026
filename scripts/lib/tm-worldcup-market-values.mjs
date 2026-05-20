// scripts/lib/tm-worldcup-market-values.mjs
// Scraper de la página masiva FIWC marktwertaenderungen.
// 40 páginas × 25 filas = ~1000 jugadores Mundial 2026 (cobertura amplia
// que no requiere TM ID por país, descubrible byNation via verein_id).
//
// Pipeline:
//   1. fetchAllPages — concurrency 4, throttle 200ms, cache 6h.
//   2. parseRow extrae por jugador: tm_player_id, name, position_tm, age,
//      nation_name, iso3, verein_id, club, club_id, club_logo_url,
//      value_eur, photo_url_tm.
//   3. Deriva byNation: para cada iso3, el verein_id más frecuente entre sus
//      jugadores (resuelve conflictos esporádicos por amistosos friendlies).
//
// Output: { byTmId: Map<tm_player_id, player>, byNation: Map<iso3, verein_id>,
//           unmappedNations: Set<string>, duplicates: Array<...> }.

import fs from 'node:fs/promises';
import path from 'node:path';
import {
  decodeClean,
  stripTmImageQuery,
  extractProfileLink,
  extractClubLink,
  parseValorEs,
  mapConcurrent,
  sleep,
} from './tm-parse-utils.mjs';
import tmNationMap from './tm-nation-map.json' with { type: 'json' };

const BASE_URL =
  'https://www.transfermarkt.es/weltmeisterschaft/marktwertaenderungen/pokalwettbewerb/FIWC/saison_id/2025/page';
const TOTAL_PAGES = 40;
const CACHE_DIR = 'cache/tm-mw';
const TTL_MS = 6 * 60 * 60 * 1000;
const UA =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';

// ROW_RE con lookahead positivo al siguiente <tr class="odd|even"> o </tbody>.
// Resuelve el bug del parser viejo donde [\s\S]*? se trunca en </tr> interior
// de inline-table anidada (foto + nombre + posición van dentro de una tabla
// hija con sus propios <tr>).
const ROW_RE = /<tr class="(?:odd|even)">([\s\S]*?)(?=<tr class="(?:odd|even)"|<\/tbody>)/g;

export function parseRow(rowHtml) {
  const profile = extractProfileLink(rowHtml);
  if (!profile) return null;

  // Foto: TM mezcla 2 patrones de carga:
  //   - lazy-load: src="data:image/gif..." + data-src="https://img..." (mayoría)
  //   - eager-load: src="https://img..." (porteros TOP y algunos jugadores recientes)
  // Aceptamos ambos. El filtro por portrait/(small|medium|big) y .(jpg|png) descarta el
  // placeholder gif (no encaja con el patrón). Case-insensitive porque TM usa tanto .jpg
  // como .JPG y .png/.PNG en distintos jugadores.
  const photoMatch = rowHtml.match(
    /(?:data-src|src)="(https:\/\/img\.a\.transfermarkt\.technology\/portrait\/(?:small|medium|big)\/\d+-\d+\.(?:jpg|png)[^"]*)"/i
  );
  const photo_url_tm = photoMatch ? stripTmImageQuery(photoMatch[1]) : null;

  // Posición: segunda fila de la inline-table (.../<tr><td>POSICIÓN</td></tr></table>)
  const posMatch = rowHtml.match(/<tr>\s*<td>\s*([^<]+?)\s*<\/td>\s*<\/tr>\s*<\/table>/);
  const position_tm = posMatch ? decodeClean(posMatch[1]) : null;

  // Selección: PRIMER <a title="X" href="/X/startseite/verein/Y/...">
  const nationMatch = rowHtml.match(
    /<a\s+title="([^"]+)"\s+href="\/([^/]+)\/startseite\/verein\/(\d+)[^"]*"/
  );
  if (!nationMatch) return null;
  const nation_name = decodeClean(nationMatch[1]);
  const verein_id = parseInt(nationMatch[3], 10);

  // Edad: primer <td class="zentriert">N</td> con 2 dígitos entre 15-50
  // (defensa contra el rank al principio: 3-4 dígitos)
  const ageMatches = [...rowHtml.matchAll(/<td class="zentriert">(\d{2})<\/td>/g)];
  let age = null;
  for (const m of ageMatches) {
    const n = parseInt(m[1], 10);
    if (n >= 15 && n <= 50) {
      age = n;
      break;
    }
  }

  // Club: SEGUNDO <a title> (skip:1 — el primero es la nación)
  const clubInfo = extractClubLink(rowHtml, { skip: 1 });

  // Valor: <td class="rechts hauptlink">75,00 mill. €</td>
  const valorMatch = rowHtml.match(
    /<td class="rechts hauptlink">\s*([0-9.,]+)\s*(mill\.|mil)?\s*€/i
  );
  const value_eur = valorMatch ? parseValorEs(valorMatch[1], valorMatch[2]) : null;

  return {
    tm_player_id: profile.tm_player_id,
    name: profile.nombre,
    position_tm,
    age,
    nation_name,
    iso3: tmNationMap[nation_name] || null,
    verein_id,
    club: clubInfo?.club ?? null,
    club_id: clubInfo?.club_id ?? null,
    club_logo_url: clubInfo?.club_logo_url ?? null,
    value_eur,
    photo_url_tm,
  };
}

async function fetchPage(pageNum, { verbose, useCache }) {
  const cacheFp = path.join(CACHE_DIR, `page-${pageNum}.html`);
  if (useCache) {
    try {
      const stat = await fs.stat(cacheFp);
      if (Date.now() - stat.mtimeMs < TTL_MS) {
        if (verbose) console.log(`  cache hit page ${pageNum}`);
        return fs.readFile(cacheFp, 'utf8');
      }
    } catch {
      /* ignore */
    }
  }
  const url = `${BASE_URL}/${pageNum}`;
  if (verbose) console.log(`  GET page ${pageNum}`);
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8' },
  });
  if (!r.ok) throw new Error(`page ${pageNum} HTTP ${r.status}`);
  const html = await r.text();
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(cacheFp, html);
  } catch {
    /* ignore */
  }
  return html;
}

export async function fetchAllPages({ verbose = false, useCache = true } = {}) {
  const byTmId = new Map();
  const unmappedNations = new Set();
  const duplicates = [];
  const vereinIdConflicts = new Map(); // iso3 → Map<verein_id, count>

  const pageNums = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);

  await mapConcurrent(
    pageNums,
    async (pageNum) => {
      const html = await fetchPage(pageNum, { verbose, useCache });
      const rows = [...html.matchAll(ROW_RE)];
      if (verbose) console.log(`  page ${pageNum}: ${rows.length} rows`);

      for (const r of rows) {
        const player = parseRow(r[1]);
        if (!player) continue;

        // No descartar si falla iso3 — el jugador sigue siendo útil para
        // ID-first lookup contra rosters con tm_player_id ya conocido.
        if (!player.iso3) unmappedNations.add(player.nation_name);

        // Duplicados tm_player_id (mismo jugador aparece más de una vez).
        if (byTmId.has(player.tm_player_id)) {
          const existing = byTmId.get(player.tm_player_id);
          if (existing.value_eur !== player.value_eur || existing.club_id !== player.club_id) {
            duplicates.push({
              tm_player_id: player.tm_player_id,
              name: player.name,
              first: { value_eur: existing.value_eur, club_id: existing.club_id },
              dup: { value_eur: player.value_eur, club_id: player.club_id },
            });
          }
          continue;
        }
        byTmId.set(player.tm_player_id, player);

        // Conteo verein_id por iso3 (sólo si iso3 mapeado).
        if (player.iso3 && player.verein_id) {
          if (!vereinIdConflicts.has(player.iso3)) {
            vereinIdConflicts.set(player.iso3, new Map());
          }
          const counts = vereinIdConflicts.get(player.iso3);
          counts.set(player.verein_id, (counts.get(player.verein_id) || 0) + 1);
        }
      }
      await sleep(200);
    },
    { concurrency: 4 }
  );

  // Resolver byNation: para cada iso3, el verein_id más frecuente gana.
  const byNation = new Map();
  for (const [iso3, counts] of vereinIdConflicts) {
    if (counts.size > 1) {
      console.warn(
        `WARN: ${iso3} con múltiples verein_id TM: ${[...counts]
          .map(([id, c]) => `${id}(×${c})`)
          .join(', ')}`
      );
    }
    const winner = [...counts].sort((a, b) => b[1] - a[1])[0][0];
    byNation.set(iso3, winner);
  }

  if (verbose) {
    console.log(
      `  byTmId: ${byTmId.size}, byNation: ${byNation.size}, duplicates: ${duplicates.length}`
    );
  }
  if (unmappedNations.size > 0) {
    console.warn(`WARN: ${unmappedNations.size} selecciones sin mapping ISO3:`);
    for (const n of unmappedNations) console.warn(`  - "${n}"`);
  }

  return { byTmId, byNation, unmappedNations, duplicates };
}
