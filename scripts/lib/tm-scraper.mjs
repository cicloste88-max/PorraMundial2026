// Transfermarkt scraper — enrich de jugadores con edad/valor/dob/foto/posicion específica.
//
// Estrategia minimal y resiliente:
//   1. GET https://www.transfermarkt.com/<slug>/kader/verein/<id>
//   2. Parsear filas de la tabla #yw1 (kader): para cada fila, extraer
//        nombre, posición específica (p.ej. "Right-Back"), dorsal, edad, dob, valor, foto
//   3. Cache local en cache/tm/<id>.json con TTL 24h
//
// El parser HTML es regex-based (sin cheerio): TM rota markup pero los atributos data-*
// suelen ser estables. Si el parsing falla para una fila, se ignora silenciosamente.

import fs from 'node:fs/promises';
import path from 'node:path';
import { matchAgainstRoster } from './name-matcher.mjs';

const TM_BASE = 'https://www.transfermarkt.com';
const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const CACHE_DIR = 'cache/tm';
const TTL_MS = 24 * 60 * 60 * 1000;

const POSICION_TM_TO_BUCKET = {
  Goalkeeper: 'Portero',
  'Centre-Back': 'Defensa',
  'Left-Back': 'Defensa',
  'Right-Back': 'Defensa',
  'Defensive Midfield': 'Centrocampista',
  'Central Midfield': 'Centrocampista',
  'Attacking Midfield': 'Centrocampista',
  'Left Midfield': 'Centrocampista',
  'Right Midfield': 'Centrocampista',
  'Left Winger': 'Delantero',
  'Right Winger': 'Delantero',
  'Second Striker': 'Delantero',
  'Centre-Forward': 'Delantero',
};

async function fetchText(url, { verbose = false } = {}) {
  if (verbose) console.log(`  GET ${url}`);
  const r = await fetch(url, {
    headers: {
      'User-Agent': UA,
      'Accept-Language': 'en-US,en;q=0.9',
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

// Parser regex sobre las filas de la tabla del kader.
// Cada jugador suele venir en un <tr> con:
//   <a href="/spieler/.../profil/spieler/<pid>" title="Nombre">
//   <td>edad o "Age" formatted</td>
//   <td>"Centre-Back"</td>
//   <td>"€80.00m" valor de mercado</td>
function parseKaderTable(html) {
  const players = [];
  // bloques <tr class="odd|even"> ... </tr>
  const rowRe = /<tr class="(?:odd|even)">([\s\S]*?)<\/tr>/g;
  let rm;
  while ((rm = rowRe.exec(html)) !== null) {
    const row = rm[1];
    const nameMatch = row.match(/<a[^>]+href="\/[^"]+\/profil\/spieler\/(\d+)"[^>]*>([^<]+)<\/a>/);
    if (!nameMatch) continue;
    const nombre = nameMatch[2].replace(/\s+/g, ' ').trim();
    const photoMatch = row.match(/<img[^>]+src="(https?:\/\/img\.[^"]+\.(?:jpg|jpeg|png|webp))"/i);
    const dobMatch = row.match(/>(\w{3,12} \d{1,2}, \d{4})\s*\(\d+\)</);
    const ageMatch = row.match(/\((\d{2})\)<\/td>/) || row.match(/>\s*(\d{2})\s*<\/td>/);
    const valorMatch = row.match(/€\s*([\d.,]+)\s*([mk]?)/i);
    const posMatch = row.match(/inline-table[^>]*>[\s\S]*?<tr><td[^>]*>[^<]*<\/td><\/tr>[\s\S]*?<tr><td[^>]*>([^<]+)<\/td>/);
    const dorsalMatch = row.match(/rn_nummer[^>]*>(\d+)<\/div>/);

    const posicionRaw = posMatch ? posMatch[1].trim() : null;
    const bucket = posicionRaw && POSICION_TM_TO_BUCKET[posicionRaw] ? POSICION_TM_TO_BUCKET[posicionRaw] : null;

    players.push({
      tm_player_id: parseInt(nameMatch[1], 10),
      nombre,
      foto_url: photoMatch ? photoMatch[1] : null,
      dob: dobMatch ? dobMatch[1] : null,
      edad: ageMatch ? parseInt(ageMatch[1], 10) : null,
      valor_eur: valorMatch ? parseValor(valorMatch[1], valorMatch[2]) : null,
      posicion_tm: posicionRaw,
      posicion: bucket,
      dorsal: dorsalMatch ? parseInt(dorsalMatch[1], 10) : null,
    });
  }
  return players;
}

// "€80.00m" → 80000000  ;  "€800k" → 800000
function parseValor(num, unit) {
  const n = parseFloat(num.replace(/\./g, '').replace(',', '.'));
  if (isNaN(n)) return null;
  const u = (unit || '').toLowerCase();
  if (u === 'm') return Math.round(n * 1_000_000);
  if (u === 'k') return Math.round(n * 1_000);
  return Math.round(n);
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

// Enriquecer un roster scraped de ff con los datos de TM.
// Muta in-place: añade edad, dob, valor, foto_url y refina posicion (específica) cuando matchea.
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
    if (tm.tm_player_id != null) roster[i].tm_player_id = tm.tm_player_id;
    if (tm.edad != null) roster[i].edad = tm.edad;
    if (tm.dob) roster[i].dob = tm.dob;
    if (tm.valor_eur != null) roster[i].valor_eur = tm.valor_eur;
    // Guardamos URL TM CDN aparte; el flow de upload la reemplazará por la URL
    // pública de Supabase Storage antes de persistir (ver storage-upload.mjs).
    if (tm.foto_url) roster[i].foto_url_tm = tm.foto_url;
    if (tm.dorsal != null) roster[i].dorsal = tm.dorsal;
    if (tm.posicion_tm) roster[i].posicion_tm = tm.posicion_tm;
    // posicion (bucket) NO la sobrescribe TM: la fuente primaria manda.
    enriched++;
  }
  return { enriched, unmatched: roster.length - enriched };
}

export { parseKaderTable, parseValor };
