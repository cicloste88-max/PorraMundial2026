#!/usr/bin/env node
// scripts/sync-squads.mjs — sincronización de plantillas Mundial 2026.
//
// Modos:
//   --mode=detect    Cross-validate 2-of-N sobre AS + Sport + Olympics + Eurosport + Marca.
//                    Detecta listas FINAL y enriquece XI con FF (secundaria) sólo
//                    sobre selecciones ya confirmadas como FINAL → evita falsos
//                    positivos tipo Eurocopa 2024 (ver ERR-58).
//                    Sin selección: procesa los 48 iso3.
//   --mode=scrape    [LEGACY] Scrapea desde futbolfantasy.com (fuente primaria).
//                    Conservado para compatibilidad y dispatch manual; el cron
//                    NO lo usa más por defecto desde el 18-may-2026.
//     Selección: --iso3=FRA | --all-missing | --refresh-final | --all
//   --mode=enrich-tm Enriquece roster ya existente con Transfermarkt
//     Selección: --iso3=FRA | --all
//
// Flags:
//   --dry-run        No aplica UPDATE, solo loguea el diff propuesto
//   --force          Aplica UPDATE incluso si el diff es vacío (refresca synced_at)
//   --verbose        Log de cada fetch y match
//   --skip=A,B,C     iso3 a saltar (csv)
//   --delay=1500     Pausa entre fetches en ms (default 1500 ff, 2500 tm)
//   --no-enrich-xi   En --mode=detect, saltar el paso de XI titular con FF.
//
// Reqs: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY en env (o `node --env-file=.env ...`).

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { scrapeCountry } from './lib/ff-scraper.mjs';
import { fetchTmKader, enrichRosterWithTm } from './lib/tm-scraper.mjs';
import { uploadPlayerPhoto } from './lib/storage-upload.mjs';
import { getSquadRow, listAllSquads, upsertSquad } from './lib/squads-db.mjs';
import * as parserAS from './lib/parsers/as.mjs';
import * as parserSport from './lib/parsers/sport.mjs';
import * as parserOlympics from './lib/parsers/olympics.mjs';
import * as parserEurosport from './lib/parsers/eurosport.mjs';
import * as parserMarca from './lib/parsers/marca.mjs';
import { parseCalendar, pendingDefinitiveByDate } from './lib/parsers/calendar.mjs';
import { crossValidate } from './lib/cross-validate.mjs';
import { matchAgainstRoster } from './lib/name-matcher.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ISO3_TO_SLUG = JSON.parse(
  await fs.readFile(path.join(__dirname, 'lib', 'iso3-slugs.json'), 'utf8')
);
const TM_IDS = JSON.parse(
  await fs.readFile(path.join(__dirname, 'lib', 'tm-ids.json'), 'utf8')
);
const COUNTRY_MAP = JSON.parse(
  await fs.readFile(path.join(__dirname, 'lib', 'parsers', 'country-map.json'), 'utf8')
);

// ─── argv parsing ─────────────────────────────────────────────────────────
function parseArgs(argv) {
  const out = { _: [] };
  for (const arg of argv.slice(2)) {
    if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq > 0) out[arg.slice(2, eq)] = arg.slice(eq + 1);
      else out[arg.slice(2)] = true;
    } else {
      out._.push(arg);
    }
  }
  return out;
}

const argv = parseArgs(process.argv);
const MODE = argv.mode;
const VERBOSE = !!argv.verbose;
const DRY_RUN = !!argv['dry-run'];
const FORCE = !!argv.force;
const DELAY = parseInt(argv.delay || '0', 10);
const SKIP = new Set(
  String(argv.skip || '')
    .split(',')
    .map((s) => s.trim().toUpperCase())
    .filter(Boolean)
);

if (!MODE) {
  console.error('Error: falta --mode=detect | --mode=scrape | --mode=enrich-tm');
  printUsage();
  process.exit(1);
}

function printUsage() {
  console.error(`
Uso:
  node scripts/sync-squads.mjs --mode=detect                 (cron por defecto desde 18-may-2026)
  node scripts/sync-squads.mjs --mode=detect --iso3=FRA,JPN
  node scripts/sync-squads.mjs --mode=detect --no-enrich-xi
  node scripts/sync-squads.mjs --mode=scrape --iso3=FRA      [LEGACY]
  node scripts/sync-squads.mjs --mode=scrape --refresh-final [LEGACY]
  node scripts/sync-squads.mjs --mode=enrich-tm --iso3=FRA
  node scripts/sync-squads.mjs --mode=enrich-tm --all

Flags: --dry-run --force --verbose --skip=A,B --delay=2000 --no-enrich-xi
`);
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ─── selección de iso3 a procesar ─────────────────────────────────────────
async function resolveTargets() {
  // --iso3 (uno o csv)
  if (argv.iso3) {
    return String(argv.iso3)
      .split(',')
      .map((s) => s.trim().toUpperCase())
      .filter((c) => ISO3_TO_SLUG[c]);
  }

  // --all
  if (argv.all) return Object.keys(ISO3_TO_SLUG);

  // --all-missing: las que NO tienen lista o tienen is_final=false
  if (argv['all-missing']) {
    const rows = await listAllSquads();
    const missing = new Set();
    for (const iso3 of Object.keys(ISO3_TO_SLUG)) {
      const row = rows.find((r) => r.iso3 === iso3);
      const playersN = Array.isArray(row?.jugadores) ? row.jugadores.length : 0;
      if (!row || playersN === 0 || !row.jugadores_is_final) missing.add(iso3);
    }
    return Array.from(missing);
  }

  // --refresh-final: solo las FINAL ya marcadas en DB
  if (argv['refresh-final']) {
    const rows = await listAllSquads();
    return rows.filter((r) => r.jugadores_is_final === true).map((r) => r.iso3);
  }

  console.error('Error: indica selección — --iso3=XXX | --all-missing | --refresh-final | --all');
  process.exit(1);
}

// ─── status logger ────────────────────────────────────────────────────────
function logRow(iso3, status, n, titulares, fuente, error = '') {
  const pad = (s, w) => String(s).padEnd(w);
  console.log(
    `  ${pad(iso3, 4)} | ${pad(status, 9)} | ${pad(n, 3)}| ${pad(titulares, 9)} | ${pad(fuente || '-', 6)} | ${error}`
  );
}

// ─── modo scrape ──────────────────────────────────────────────────────────
async function runScrape(targets) {
  const delay = DELAY || 1500;
  const refreshFinal = !!argv['refresh-final'];

  console.log(`\nscrape: ${targets.length} países  dry=${DRY_RUN}  delay=${delay}ms\n`);
  console.log('  iso3 | status    | n  | titulares | fuente | error');
  console.log('  -----+-----------+----+-----------+--------+------');

  const results = [];
  for (const iso3 of targets) {
    if (SKIP.has(iso3)) {
      logRow(iso3, 'skipped', 0, 0, '-', 'manual --skip');
      results.push({ iso3, status: 'skipped' });
      continue;
    }
    const slug = ISO3_TO_SLUG[iso3];
    if (!slug) {
      logRow(iso3, 'unknown', 0, 0, '-', 'no slug ff');
      continue;
    }

    try {
      const scrape = await scrapeCountry(slug, { verbose: VERBOSE, refreshFinal });

      // Si refresh-final: preservar roster existente y solo actualizar es_titular
      let players = scrape.roster;
      let isFinal = scrape.is_final;
      let fuente = 'ff';

      if (refreshFinal) {
        // --refresh-final es siempre conservador: si hay roster en BD se preserva
        // tal cual (nombres + fuente con sufijo +tm intactos) y solo se reaplica
        // es_titular según el XI extraído. Bloquea pérdidas de enrichment TM
        // cuando aparezcan listas finales para países ya enriquecidos.
        const existing = await getSquadRow(iso3);
        if (Array.isArray(existing?.jugadores) && existing.jugadores.length > 0) {
          // Decodificar in-flight nombres y clubs por si quedaron entidades crudas de scrapes previos
          // (e.g. BIH con &scaron; / &Scaron; tras el round del 16-may pre html-entities)
          const { decode } = await import('html-entities');
          const decodeName = (s) => decode(String(s ?? ''))
            .replace(/[‘’‚′]/g, "'")
            .replace(/[“”„″]/g, '"');
          players = existing.jugadores.map((p) => ({
            ...p,
            nombre: decodeName(p.nombre),
            club: decodeName(p.club),
            es_titular: false,
          }));
          isFinal = !!existing.jugadores_is_final;
          fuente = existing.jugadores_fuente || 'ff';

          if (scrape.xi_names.length > 0) {
            const { matchAgainstRoster } = await import('./lib/name-matcher.mjs');
            const { matches } = matchAgainstRoster(scrape.xi_names, players, { minScore: 65 });
            for (const { matchIdx } of matches) {
              players[matchIdx].es_titular = true;
            }
            scrape.titulares = matches.length;
          }
        }
        // Si no hay existing roster, players queda con scrape.roster del flujo
        // normal (cae a no-list si vacío, o se inserta como nueva FINAL).
      }

      if (players.length === 0) {
        logRow(iso3, 'no-list', 0, 0, '-', '');
        results.push({ iso3, status: 'no-list' });
      } else {
        const up = await upsertSquad(iso3, players, {
          isFinal,
          fuente,
          dryRun: DRY_RUN,
          force: FORCE,
        });
        const status = up.noop ? 'no-op' : DRY_RUN ? 'dry-run' : 'updated';
        logRow(iso3, status, players.length, scrape.titulares, fuente);
        results.push({ iso3, status, n: players.length, titulares: scrape.titulares });
      }
    } catch (err) {
      logRow(iso3, 'error', 0, 0, '-', err.message.slice(0, 60));
      results.push({ iso3, status: 'error', error: err.message });
    }

    await sleep(delay);
  }
  return results;
}

// ─── modo enrich-tm ───────────────────────────────────────────────────────
async function runEnrichTm(targets) {
  const delay = DELAY || 2500;

  console.log(`\nenrich-tm: ${targets.length} países  dry=${DRY_RUN}  delay=${delay}ms\n`);
  console.log('  iso3 | status    | n  | enriched  | fuente  | error');
  console.log('  -----+-----------+----+-----------+---------+------');

  const results = [];
  for (const iso3 of targets) {
    if (SKIP.has(iso3)) {
      logRow(iso3, 'skipped', 0, 0, '-', 'manual --skip');
      continue;
    }
    const tmId = TM_IDS[iso3];
    if (!tmId) {
      logRow(iso3, 'no-tmid', 0, 0, '-', 'pobla scripts/lib/tm-ids.json');
      results.push({ iso3, status: 'no-tmid' });
      continue;
    }

    try {
      const row = await getSquadRow(iso3);
      if (!Array.isArray(row?.jugadores) || row.jugadores.length === 0) {
        logRow(iso3, 'no-roster', 0, 0, '-', 'run --mode=scrape primero');
        results.push({ iso3, status: 'no-roster' });
        continue;
      }

      const tmPlayers = await fetchTmKader(tmId, ISO3_TO_SLUG[iso3] || 'team', {
        verbose: VERBOSE,
      });
      const players = row.jugadores.map((p) => ({ ...p }));
      const { enriched } = enrichRosterWithTm(players, tmPlayers);

      // Upload de foto TM CDN → Supabase Storage. enrichRosterWithTm dejó la URL
      // de TM en `foto_url_tm` (temporal). Aquí la subimos al bucket
      // player-photos/{iso3}/{tm_player_id}.jpg y reemplazamos `foto_url`
      // con la URL pública. Idempotente: skip si ya existe en bucket.
      if (!DRY_RUN) {
        for (const player of players) {
          if (player.foto_url_tm && player.tm_player_id && !player.foto_url) {
            try {
              player.foto_url = await uploadPlayerPhoto(
                iso3,
                player.tm_player_id,
                player.foto_url_tm
              );
            } catch (e) {
              if (VERBOSE) {
                console.warn(
                  `  foto upload ${player.nombre} (${player.tm_player_id}): ${e.message}`
                );
              }
            }
            await sleep(200);
          }
          delete player.foto_url_tm;
        }
      } else {
        // Dry-run: limpiar el campo temporal pero no subir
        for (const player of players) delete player.foto_url_tm;
      }

      const fuente =
        row.jugadores_fuente && row.jugadores_fuente.includes('tm')
          ? row.jugadores_fuente
          : `${row.jugadores_fuente || 'ff'}+tm`;

      const up = await upsertSquad(iso3, players, {
        isFinal: !!row.jugadores_is_final,
        fuente,
        dryRun: DRY_RUN,
        force: FORCE,
      });
      const titulares = players.filter((p) => p.es_titular).length;
      const status = up.noop ? 'no-op' : DRY_RUN ? 'dry-run' : 'enriched';
      logRow(iso3, status, players.length, enriched, fuente);
      results.push({ iso3, status, n: players.length, enriched });
    } catch (err) {
      logRow(iso3, 'error', 0, 0, '-', err.message.slice(0, 60));
      results.push({ iso3, status: 'error', error: err.message });
    }

    await sleep(delay);
  }
  return results;
}

// ─── modo detect ──────────────────────────────────────────────────────────
// Pipeline:
//  1. Fetch en paralelo las 5 fuentes primarias (AS, Sport, Olympics, Eurosport, Marca).
//     Tolerante a fallos: si una falla, se sigue con las restantes.
//  2. Parsear calendario Olympics → cache/squads-calendar.json.
//  3. crossValidate() — 2-of-N + Jaccard ≥ 0.7 + filtro por calendario.
//  4. Para cada iso3 con confidence='high' o 'low': upsert con jugadores_is_final=true
//     y fuente = "as+olympics" (o lo que haya). 'reject' se loguea y se descarta.
//  5. Para cada FINAL recién escrita: enrich XI titular vía FF (filtro "Mundial 2026"
//     embebido en el scraper FF actual + es responsabilidad del orquestador validar
//     que la noticia detectada sea de Mundial — ver ERR-58).
//  6. Tras el paso XI: dejar el enrich-tm para una pasada posterior (step 2 del
//     workflow), no encadenarlo aquí para simplificar logs.
const PRIMARY_PARSERS = [parserAS, parserSport, parserOlympics, parserEurosport, parserMarca];

async function runDetect(targetsArg) {
  const enrichXi = argv['no-enrich-xi'] ? false : true;
  const today = new Date().toISOString().slice(0, 10);
  const sourceNames = PRIMARY_PARSERS.map((p) => p.SOURCE_NAME).join(' + ');
  console.log(`\ndetect: fuentes ${sourceNames}  dry=${DRY_RUN}  fecha=${today}\n`);

  const settled = await Promise.allSettled(
    PRIMARY_PARSERS.map((p) => p.fetchAndParse({ verbose: VERBOSE }))
  );

  const parseResults = [];
  for (const [i, src] of PRIMARY_PARSERS.entries()) {
    const r = settled[i];
    if (r.status === 'fulfilled') {
      const count = Object.keys(r.value.byIso3 || {}).length;
      console.log(`  fuente ${src.SOURCE_NAME.padEnd(10)} → ${count} iso3 parseados`);
      parseResults.push(r.value);
    } else {
      console.warn(`  fuente ${src.SOURCE_NAME.padEnd(10)} → FALLO: ${r.reason?.message || r.reason}`);
    }
  }
  if (parseResults.length === 0) {
    console.error('Todas las fuentes primarias fallaron. Abortando detect.');
    return [];
  }

  // calendar — best-effort sobre el HTML de Olympics si está disponible.
  const olympicsIdx = PRIMARY_PARSERS.indexOf(parserOlympics);
  const olympicsResult = settled[olympicsIdx];
  let calendarEntries = [];
  if (olympicsResult.status === 'fulfilled') {
    try {
      const olympicsHtml = olympicsResult.value._html || null;
      if (olympicsHtml) {
        const parsed = parseCalendar(olympicsHtml, COUNTRY_MAP, { year: 2026 });
        calendarEntries = parsed.entries;
        await fs.mkdir(path.join(process.cwd(), 'cache'), { recursive: true });
        await fs.writeFile(
          path.join(process.cwd(), 'cache', 'squads-calendar.json'),
          JSON.stringify({ generatedAt: new Date().toISOString(), entries: calendarEntries }, null, 2)
        );
        if (VERBOSE) console.log(`  calendario: ${calendarEntries.length} fechas detectadas`);
      } else if (VERBOSE) {
        console.log('  calendario: olympics no expuso _html en su ParseResult — skip');
      }
    } catch (err) {
      console.warn(`  calendario: parse error — ${err.message}`);
    }
  }
  // Set de iso3 con "(definitiva)" anunciada en fecha FUTURA — solo estos se
  // degradan a 'low' aunque 2+ fuentes coincidan (posible lista provisional).
  const pendingSet = pendingDefinitiveByDate(calendarEntries, today);

  const validated = crossValidate(parseResults, {
    minPlayers: 22,
    maxPlayers: 30,
    jaccardThr: 0.7,
    calendar: pendingSet.size > 0 ? pendingSet : null,
  });

  console.log('\n  iso3 | conf  | sources         | n   | reason');
  console.log('  -----+-------+-----------------+-----+-------');

  const targets = targetsArg && targetsArg.length > 0 ? new Set(targetsArg) : null;
  const results = [];

  for (const [iso3, v] of validated.entries()) {
    if (targets && !targets.has(iso3)) continue;
    if (SKIP.has(iso3)) {
      console.log(`  ${iso3.padEnd(4)} | skip  | ${v.sources.join('+').padEnd(15)} | ${String(v.players.length).padEnd(3)} | manual --skip`);
      results.push({ iso3, status: 'skipped' });
      continue;
    }
    const sources = v.sources.join('+') || '-';
    if (v.confidence === 'reject') {
      console.log(`  ${iso3.padEnd(4)} | reject| ${sources.padEnd(15)} | ${String(v.players.length).padEnd(3)} | ${v.reason || ''}`);
      results.push({ iso3, status: 'rejected', reason: v.reason });
      continue;
    }

    try {
      const existing = await getSquadRow(iso3);
      const fuente = sources;
      // upsertSquad hace mergeJugadores internamente — preserva enrichment
      // (tm_player_id, foto_url, edad, valor_eur, dorsal, dob, posicion_tm)
      // por nombre normalizado. No hace falta pre-merge aquí.
      const up = await upsertSquad(iso3, v.players, {
        isFinal: true,
        fuente: existing?.jugadores_fuente?.includes('tm') ? `${fuente}+tm` : fuente,
        dryRun: DRY_RUN,
        force: FORCE,
      });
      const status = up.noop ? 'no-op' : DRY_RUN ? 'dry-run' : 'updated';
      console.log(`  ${iso3.padEnd(4)} | ${v.confidence.padEnd(5)} | ${sources.padEnd(15)} | ${String(v.players.length).padEnd(3)} | ${status}${v.reason ? ` (${v.reason})` : ''}`);
      results.push({ iso3, status, confidence: v.confidence, n: v.players.length });
    } catch (err) {
      console.log(`  ${iso3.padEnd(4)} | error | ${sources.padEnd(15)} | -   | ${err.message.slice(0, 60)}`);
      results.push({ iso3, status: 'error', error: err.message });
    }
  }

  if (enrichXi && !DRY_RUN) {
    console.log('\n  Paso 2 — enrich XI titular vía FF (solo FINAL recién escritas)\n');
    for (const r of results) {
      if (!['updated', 'no-op'].includes(r.status)) continue;
      const slug = ISO3_TO_SLUG[r.iso3];
      if (!slug) continue;
      try {
        const scrape = await scrapeCountry(slug, { verbose: VERBOSE, refreshFinal: true });
        if (!scrape.xi_names || scrape.xi_names.length === 0) {
          if (VERBOSE) console.log(`    ${r.iso3} — FF sin XI titular`);
          continue;
        }
        const row = await getSquadRow(r.iso3);
        if (!Array.isArray(row?.jugadores) || row.jugadores.length === 0) continue;
        const players = row.jugadores.map((p) => ({ ...p, es_titular: false }));
        const { matches } = matchAgainstRoster(scrape.xi_names, players, { minScore: 65 });
        for (const { matchIdx } of matches) players[matchIdx].es_titular = true;
        await upsertSquad(r.iso3, players, {
          isFinal: true,
          fuente: row.jugadores_fuente || r.iso3,
          dryRun: false,
          force: false,
        });
        console.log(`    ${r.iso3} — XI matched: ${matches.length}/${scrape.xi_names.length}`);
        await sleep(1500);
      } catch (err) {
        console.warn(`    ${r.iso3} — FF enrich-xi falló: ${err.message.slice(0, 80)}`);
      }
    }
  }

  return results;
}

// ─── main ─────────────────────────────────────────────────────────────────
async function main() {
  let results;

  if (MODE === 'detect') {
    const targets = argv.iso3
      ? String(argv.iso3).split(',').map((s) => s.trim().toUpperCase()).filter((c) => ISO3_TO_SLUG[c])
      : [];
    results = await runDetect(targets);
  } else if (MODE === 'scrape') {
    const targets = await resolveTargets();
    if (targets.length === 0) {
      console.log('Sin targets a procesar.');
      process.exit(0);
    }
    results = await runScrape(targets);
  } else if (MODE === 'enrich-tm') {
    const targets = await resolveTargets();
    if (targets.length === 0) {
      console.log('Sin targets a procesar.');
      process.exit(0);
    }
    results = await runEnrichTm(targets);
  } else {
    console.error(`Modo desconocido: ${MODE}`);
    printUsage();
    process.exit(1);
  }

  // resumen
  const counts = results.reduce((a, r) => ((a[r.status] = (a[r.status] || 0) + 1), a), {});
  console.log('\nResumen:', counts);
  const hasErrors = results.some((r) => r.status === 'error');
  process.exit(hasErrors ? 2 : 0);
}

main().catch((err) => {
  console.error('Fallo fatal:', err);
  process.exit(1);
});
