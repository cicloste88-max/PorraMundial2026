#!/usr/bin/env node
// scripts/sync-squads.mjs — sincronización de plantillas Mundial 2026.
//
// Modos:
//   --mode=scrape    Scrapea desde futbolfantasy.com
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
//
// Reqs: SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY en env (o `node --env-file=.env ...`).

import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { scrapeCountry } from './lib/ff-scraper.mjs';
import { fetchTmKader, enrichRosterWithTm } from './lib/tm-scraper.mjs';
import { getSquadRow, listAllSquads, upsertSquad } from './lib/squads-db.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ISO3_TO_SLUG = JSON.parse(
  await fs.readFile(path.join(__dirname, 'lib', 'iso3-slugs.json'), 'utf8')
);
const TM_IDS = JSON.parse(
  await fs.readFile(path.join(__dirname, 'lib', 'tm-ids.json'), 'utf8')
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
  console.error('Error: falta --mode=scrape o --mode=enrich-tm');
  printUsage();
  process.exit(1);
}

function printUsage() {
  console.error(`
Uso:
  node scripts/sync-squads.mjs --mode=scrape --iso3=FRA
  node scripts/sync-squads.mjs --mode=scrape --all-missing
  node scripts/sync-squads.mjs --mode=scrape --refresh-final
  node scripts/sync-squads.mjs --mode=scrape --all
  node scripts/sync-squads.mjs --mode=enrich-tm --iso3=FRA
  node scripts/sync-squads.mjs --mode=enrich-tm --all

Flags: --dry-run --force --verbose --skip=A,B --delay=2000
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

      if (refreshFinal && (players.length === 0 || !isFinal)) {
        // No hay noticia nueva: cargar roster existente y solo aplicar titulares scraped
        const existing = await getSquadRow(iso3);
        if (Array.isArray(existing?.jugadores) && existing.jugadores.length > 0) {
          players = existing.jugadores.map((p) => ({ ...p, es_titular: false }));
          isFinal = !!existing.jugadores_is_final;
          fuente = existing.jugadores_fuente || 'ff';

          // Aplicar XI titular vía matcher
          if (scrape.xi_names.length > 0) {
            const { matchAgainstRoster } = await import('./lib/name-matcher.mjs');
            const { matches } = matchAgainstRoster(scrape.xi_names, players, { minScore: 65 });
            for (const { matchIdx } of matches) {
              players[matchIdx].es_titular = true;
            }
            scrape.titulares = matches.length;
          }
        }
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

// ─── main ─────────────────────────────────────────────────────────────────
async function main() {
  const targets = await resolveTargets();
  if (targets.length === 0) {
    console.log('Sin targets a procesar.');
    process.exit(0);
  }

  let results;
  if (MODE === 'scrape') {
    results = await runScrape(targets);
  } else if (MODE === 'enrich-tm') {
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
