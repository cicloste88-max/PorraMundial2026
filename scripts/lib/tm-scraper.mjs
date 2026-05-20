// scripts/lib/tm-scraper.mjs — Transfermarkt kader scraper (un país por verein_id).
//
// Pieza B del sprint 20-may: refactor completo de parseKaderTable apoyado en
// los helpers compartidos de tm-parse-utils.mjs. Resuelve los bugs del parser
// viejo:
//   1. ROW_RE con lookahead positivo en lugar de [\s\S]*? (evitaba truncar en
//      </tr> interior de inline-table anidada).
//   2. Foto desde data-src (NO src — eso es el placeholder gif lazy).
//   3. DOB en formato español "DD/MM/YYYY (NN)" en lugar de inglés.
//   4. Valor en formato europeo "40,00 mill. €" parseado vía parseValorEs
//      (el parser viejo devolvía 4_000_000_000 al confundir punto decimal).
//   5. Posición tolera saltos de línea internos en inline-table.
//   6. URL TM .es para consistencia con tm-nation-map.json castellano.
//
// API:
//   - fetchTmKader(tmId, slug, opts) → Array<player>
//   - parseKaderTable(html) → Array<player>
//   - enrichRosterWithTm(roster, tmPlayers) → { enriched, unmatched }  [legacy]
//
// Para el flow nuevo enrich-tm-mw, usar applyEnrich de ./enrich-merge.mjs.

import fs from 'node:fs/promises';
import path from 'node:path';
import { matchAgainstRoster } from './name-matcher.mjs';
import {
  decodeClean,
  stripTmImageQuery,
  extractProfileLink,
  extractClubLink,
  parseValorEs,
  positionToBucket,
} from './tm-parse-utils.mjs';

const TM_BASE = 'https://www.transfermarkt.es';
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const CACHE_DIR = 'cache/tm';
const TTL_MS = 24 * 60 * 60 * 1000;

// Lookahead positivo: termina cada fila al siguiente <tr class=odd|even> o
// </tbody>, no en el primer </tr> interior. Resuelve el bug del parser viejo.
const ROW_RE = /<tr class="(?:odd|even)">([\s\S]*?)(?=<tr class="(?:odd|even)"|<\/tbody>)/g;

async function fetchText(url, { verbose = false } = {}) {
  if (verbose) console.log(`  GET ${url}`);
  const r = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
      Accept: 'text/html,application/xhtml+xml',
    },
  });
  if (!r.ok) throw new Error(`HTTP ${r.status} on ${url}`);
  return await r.text();
}

async function readCache(tmId) {
  try {
    const fp = path.join(CACHE_DIR, `${tmId}.json`);
    const stat = await fs.stat(fp);
    if (Date.now() - stat.mtimeMs > TTL_MS) return null;
    const txt = await fs.readFile(fp, 'utf8');
    return JSON.parse(txt);
  } catch {
    return null;
  }
}

async function writeCache(tmId, data) {
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(path.join(CACHE_DIR, `${tmId}.json`), JSON.stringify(data, null, 2));
  } catch {
    /* ignore */
  }
}

export function parseKaderTable(html) {
  const players = [];
  const rows = [...html.matchAll(ROW_RE)];

  for (const r of rows) {
    const rowHtml = r[1];

    const profile = extractProfileLink(rowHtml);
    if (!profile) continue;

    // Dorsal: <div class=rn_nummer>18</div>
    const dorsalMatch = rowHtml.match(/<div\s+class=rn_nummer[^>]*>(\d+)<\/div>/);
    const dorsal = dorsalMatch ? parseInt(dorsalMatch[1], 10) : null;

    // Foto: TM mezcla lazy-load (data-src=URL real, src=gif placeholder) y eager-load
    // (src=URL directa, sobre todo en porteros TOP). Aceptamos ambos. El filtro por
    // portrait/(small|medium|big) y .(jpg|png) descarta el placeholder. Case-insensitive
    // porque TM usa .jpg/.JPG/.png/.PNG indistintamente.
    const photoMatch = rowHtml.match(
      /(?:data-src|src)="(https:\/\/img\.a\.transfermarkt\.technology\/portrait\/(?:small|medium|big)\/\d+-\d+\.(?:jpg|png)[^"]*)"/i
    );
    const foto_url_tm = photoMatch ? stripTmImageQuery(photoMatch[1]) : null;

    // Posición específica TM: segunda fila de la inline-table.
    const posMatch = rowHtml.match(/<tr>\s*<td>\s*([^<]+?)\s*<\/td>\s*<\/tr>\s*<\/table>/);
    const posicion_tm = posMatch ? decodeClean(posMatch[1]) : null;
    const posicion = positionToBucket(posicion_tm);

    // DOB + edad: formato español "04/05/2001 (25)".
    const dobMatch = rowHtml.match(
      /<td class="zentriert">(\d{2}\/\d{2}\/\d{4})\s*\((\d{1,2})\)<\/td>/
    );
    const dob = dobMatch ? dobMatch[1] : null;
    const edad = dobMatch ? parseInt(dobMatch[2], 10) : null;

    // Club: en kader sólo hay UN <a title=Club> (no aparece la nación).
    const clubInfo = extractClubLink(rowHtml, { skip: 0 });

    // Valor: <td class="rechts hauptlink"><a ...>40,00 mill. €</a>.
    const valorMatch = rowHtml.match(
      /<td class="rechts hauptlink">[^>]*>?\s*(?:<a[^>]*>)?\s*([0-9.,]+)\s*(mill\.|mil)?\s*€/i
    );
    const valor_eur = valorMatch ? parseValorEs(valorMatch[1], valorMatch[2]) : null;

    players.push({
      tm_player_id: profile.tm_player_id,
      nombre: profile.nombre,
      dorsal,
      foto_url_tm,
      posicion_tm,
      posicion,
      dob,
      edad,
      club: clubInfo?.club ?? null,
      club_id: clubInfo?.club_id ?? null,
      club_logo_url: clubInfo?.club_logo_url ?? null,
      valor_eur,
    });
  }

  return players;
}

// Fetch kader completo de un país (con cache 24h).
export async function fetchTmKader(tmId, slug = 'team', opts = {}) {
  const { verbose = false, noCache = false } = opts;
  if (!noCache) {
    const cached = await readCache(tmId);
    if (cached) {
      if (verbose) console.log(`  TM cache hit ${tmId}`);
      return cached;
    }
  }
  const url = `${TM_BASE}/${slug}/kader/verein/${tmId}/plus/1`;
  const html = await fetchText(url, { verbose });
  const players = parseKaderTable(html);
  await writeCache(tmId, players);
  return players;
}

// Enrich legacy: muta el roster en sitio aplicando fill-missing (no pisa
// campos ya presentes). Reservado para `--mode=enrich-tm` clásico; el flow
// nuevo enrich-tm-mw usa applyEnrich de ./enrich-merge.mjs.
export function enrichRosterWithTm(roster, tmPlayers) {
  if (!Array.isArray(roster) || !Array.isArray(tmPlayers) || tmPlayers.length === 0) {
    return { enriched: 0, unmatched: roster.length };
  }
  const candidates = roster.map((p) => p.nombre);
  const { matches } = matchAgainstRoster(candidates, tmPlayers, { minScore: 70 });
  let enriched = 0;
  for (const { candidate, match } of matches) {
    const i = roster.findIndex((p) => p.nombre === candidate);
    if (i < 0) continue;
    const tm = match;
    if (tm.tm_player_id != null && roster[i].tm_player_id == null) {
      roster[i].tm_player_id = tm.tm_player_id;
    }
    if (tm.edad != null && roster[i].edad == null) roster[i].edad = tm.edad;
    if (tm.dob && roster[i].dob == null) roster[i].dob = tm.dob;
    if (tm.valor_eur != null && roster[i].valor_eur == null) roster[i].valor_eur = tm.valor_eur;
    if (tm.foto_url_tm && !roster[i].foto_url_tm) roster[i].foto_url_tm = tm.foto_url_tm;
    if (tm.dorsal != null && roster[i].dorsal == null) roster[i].dorsal = tm.dorsal;
    if (tm.posicion_tm && roster[i].posicion_tm == null) roster[i].posicion_tm = tm.posicion_tm;
    if (tm.club && roster[i].club == null) roster[i].club = tm.club;
    if (tm.club_id != null && roster[i].club_id == null) roster[i].club_id = tm.club_id;
    if (tm.club_logo_url && roster[i].club_logo_url == null) {
      roster[i].club_logo_url = tm.club_logo_url;
    }
    enriched++;
  }
  return { enriched, unmatched: roster.length - enriched };
}
