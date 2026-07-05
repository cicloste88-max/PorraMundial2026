// EF ko-round-seeder — lógica pura de siembra de rondas KO (5-jul-2026).
//
// Tres invariantes críticos:
//   1. KO_FEEDERS (espejo local del seeder, para no embarcar los 59KB de
//      ANNEX_C en el bundle MCP) debe ser 1:1 con BRACKET.{r16,qf,sf,third,
//      final} de _shared/ko-data.mjs — la fuente de verdad del cuadro. Si el
//      bracket cambia, este test rompe ANTES de que el seeder siembre cruces
//      contra un cuadro viejo.
//   2. deriveSeedableSlots resuelve la MALLA REAL (wc_matches_ko + ko_results)
//      por slot: W74 = ganador del 74, L101 = perdedor de la semi (slot 103).
//      Nunca proponer un slot ya sembrado ni uno con feeders sin resolver.
//   3. matchEspnEvent exige EXACTAMENTE 1 candidato por pareja de equipos
//      (abbreviation == iso3, sin orden). 0 o >1 → no sembrar (fail-safe).
//      inverted = home ESPN != home proyecto (mismo contrato espn_event_map).

import assert from 'node:assert';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { BRACKET } from '../supabase/functions/_shared/ko-data.mjs';
import {
  KO_FEEDERS,
  deriveSeedableSlots,
  espnDateToProject,
  liveRowStateFor,
  matchEspnEvent,
  normTeamName,
} from '../supabase/functions/ko-round-seeder/seeder-logic.mjs';

const md5HexNode = (s) => Promise.resolve(
  createHash('md5').update(Buffer.from(String(s), 'utf8')).digest('hex'),
);

// ─── 1 · KO_FEEDERS ≡ BRACKET (fuente de verdad) ────────────────────────────

test('KO_FEEDERS es espejo 1:1 de BRACKET r16..final (id/round/home/away)', () => {
  const fromBracket = ['r16', 'qf', 'sf', 'third', 'final'].flatMap((round) =>
    BRACKET[round].map((m) => ({ id: m.id, round, home: m.home, away: m.away })),
  );
  assert.deepStrictEqual(KO_FEEDERS, fromBracket);
});

// ─── 2 · deriveSeedableSlots (malla real) ───────────────────────────────────

// wc_matches_ko sintético: R32 completo con iso3 distinguibles H<slot>/A<slot>.
const R32_ROWS = BRACKET.r32.map((m) => ({
  ko_match_id: m.id, home_iso3: `H${m.id}`, away_iso3: `A${m.id}`,
}));
// ko_results sintético: todos los R32 resueltos, home gana los pares, away los
// impares (74 → away = A74, 77 → home... 77 impar → away).
const R32_RESULTS = Object.fromEntries(BRACKET.r32.map((m) => [
  String(m.id), { winner: m.id % 2 === 0 ? 'home' : 'away', status: 'finished' },
]));
const winnerOf = (slot) => (slot % 2 === 0 ? `H${slot}` : `A${slot}`);

test('R32 completo → los 8 slots de R16 sembrables con el ganador correcto', () => {
  const { seedable, pending } = deriveSeedableSlots(R32_ROWS, R32_RESULTS);
  assert.strictEqual(seedable.length, 8);
  // Slot 89 = W74 vs W77 (feeders NO secuenciales — cuadrante del bracket FIFA).
  const s89 = seedable.find((s) => s.slot === 89);
  assert.deepStrictEqual(s89, { slot: 89, round: 'r16', home_iso3: winnerOf(74), away_iso3: winnerOf(77) });
  // Slot 95 = W86 vs W88.
  const s95 = seedable.find((s) => s.slot === 95);
  assert.deepStrictEqual(s95, { slot: 95, round: 'r16', home_iso3: winnerOf(86), away_iso3: winnerOf(88) });
  // QF/SF/third/final pendientes: sus feeders (R16) aún no están sembrados.
  assert.strictEqual(pending.length, 8);
  assert.ok(pending.every((p) => ['qf', 'sf', 'third', 'final'].includes(p.round)));
  const p97 = pending.find((p) => p.slot === 97);
  assert.deepStrictEqual(p97.waiting_on, ['W89', 'W90']);
});

test('winner pendiente (null) bloquea SOLO los slots alimentados por él', () => {
  const results = { ...R32_RESULTS, '77': { winner: null, status: 'finished' } };
  const { seedable, pending } = deriveSeedableSlots(R32_ROWS, results);
  assert.strictEqual(seedable.length, 7);
  const p89 = pending.find((p) => p.slot === 89);
  assert.deepStrictEqual(p89.waiting_on, ['W77']); // W74 sí resuelve
});

test('slot ya sembrado no se re-propone (idempotencia)', () => {
  const rows = [...R32_ROWS, { ko_match_id: 89, home_iso3: winnerOf(74), away_iso3: winnerOf(77) }];
  const { seedable } = deriveSeedableSlots(rows, R32_RESULTS);
  assert.ok(!seedable.some((s) => s.slot === 89));
  assert.strictEqual(seedable.length, 7);
});

test('cascada QF: sembrable en cuanto sus DOS octavos tienen winner (parcial)', () => {
  const rows = [
    ...R32_ROWS,
    { ko_match_id: 89, home_iso3: 'MAR', away_iso3: 'CAN' },
    { ko_match_id: 90, home_iso3: 'FRA', away_iso3: 'PAR' },
  ];
  const results = {
    ...R32_RESULTS,
    '89': { winner: 'home', status: 'finished' },   // MAR
    '90': { winner: 'home', status: 'finished' },   // FRA
  };
  const { seedable } = deriveSeedableSlots(rows, results);
  const s97 = seedable.find((s) => s.slot === 97);
  assert.deepStrictEqual(s97, { slot: 97, round: 'qf', home_iso3: 'MAR', away_iso3: 'FRA' });
  // El resto de QF sigue pendiente: solo 89/90 resueltos.
  assert.ok(!seedable.some((s) => [98, 99, 100].includes(s.slot)));
});

test('slot 103 (3er puesto) toma los LOSERS de las semis', () => {
  const rows = [
    { ko_match_id: 101, home_iso3: 'ESP', away_iso3: 'ARG' },
    { ko_match_id: 102, home_iso3: 'BRA', away_iso3: 'FRA' },
  ];
  const results = {
    '101': { winner: 'home', status: 'finished' },  // gana ESP → loser ARG
    '102': { winner: 'away', status: 'finished' },  // gana FRA → loser BRA
  };
  const { seedable } = deriveSeedableSlots(rows, results);
  const s103 = seedable.find((s) => s.slot === 103);
  assert.deepStrictEqual(s103, { slot: 103, round: 'third', home_iso3: 'ARG', away_iso3: 'BRA' });
  const s104 = seedable.find((s) => s.slot === 104);
  assert.deepStrictEqual(s104, { slot: 104, round: 'final', home_iso3: 'ESP', away_iso3: 'FRA' });
});

// ─── 3 · matchEspnEvent (scoreboard mock) ───────────────────────────────────

function espnEvent(id, homeAbbr, awayAbbr, opts = {}) {
  return {
    id,
    date: opts.date ?? '2026-07-06T19:00Z',
    competitions: [{
      status: opts.status ?? { type: { state: 'pre', name: 'STATUS_SCHEDULED' } },
      competitors: [
        { homeAway: 'home', team: { id: `t-${homeAbbr}`, abbreviation: homeAbbr, displayName: opts.homeName ?? homeAbbr }, score: opts.homeScore },
        { homeAway: 'away', team: { id: `t-${awayAbbr}`, abbreviation: awayAbbr, displayName: opts.awayName ?? awayAbbr }, score: opts.awayScore },
      ],
      details: opts.details ?? [],
    }],
  };
}

const SB = [
  espnEvent('760504', 'BRA', 'NOR'),          // NOR @ BRA (shortName AWAY @ HOME)
  espnEvent('760506', 'POR', 'ESP'),
  espnEvent('760509', 'ARG', 'EGY'),
];

test('matching normal: pareja en orden proyecto → inverted=false', () => {
  const m = matchEspnEvent(SB, 'BRA', 'NOR');
  assert.strictEqual(m.ok, true);
  assert.strictEqual(m.espn_event_id, '760504');
  assert.strictEqual(m.inverted, false);
  assert.strictEqual(m.via, 'abbreviation');
});

test('matching invertido: home ESPN != home proyecto → inverted=true', () => {
  const m = matchEspnEvent(SB, 'ESP', 'POR'); // proyecto ESP-POR, ESPN POR@home
  assert.strictEqual(m.ok, true);
  assert.strictEqual(m.espn_event_id, '760506');
  assert.strictEqual(m.inverted, true);
});

test('0 candidatos → no sembrar (no_espn_match)', () => {
  const m = matchEspnEvent(SB, 'MEX', 'ENG');
  assert.strictEqual(m.ok, false);
  assert.strictEqual(m.reason, 'no_espn_match');
  assert.deepStrictEqual(m.candidates, []);
});

test('2 candidatos con la misma pareja → ambiguo, no sembrar', () => {
  const dup = [...SB, espnEvent('999999', 'NOR', 'BRA')];
  const m = matchEspnEvent(dup, 'BRA', 'NOR');
  assert.strictEqual(m.ok, false);
  assert.strictEqual(m.reason, 'ambiguous_espn_match');
  assert.deepStrictEqual(m.candidates, ['760504', '999999']);
});

test('fallback por nombre normalizado cuando abbreviation no resuelve', () => {
  const sb = [espnEvent('760777', 'XXX', 'ARG', { homeName: 'Canadá' })];
  const dict = { [normTeamName('Canadá')]: 'CAN', [normTeamName('Argentina')]: 'ARG' };
  const m = matchEspnEvent(sb, 'CAN', 'ARG', dict);
  assert.strictEqual(m.ok, true);
  assert.strictEqual(m.via, 'name');
  assert.strictEqual(m.inverted, false);
});

// ─── 4 · espnDateToProject ──────────────────────────────────────────────────

test('fecha ESPN → date_utc formato siembra R32 + epoch segundos', () => {
  const { dateUtc, epochSeconds } = espnDateToProject('2026-07-04T19:00Z');
  assert.strictEqual(dateUtc, '2026-07-04T19:00'); // fila referencia wc2026_ko_73
  assert.strictEqual(epochSeconds, Date.UTC(2026, 6, 4, 19, 0) / 1000);
});

// ─── 5 · liveRowStateFor (estado inicial del esqueleto) ─────────────────────

test('evento pre → esqueleto notstarted (code 0, interval 300, sin marcador)', async () => {
  const row = await liveRowStateFor(espnEvent('760504', 'BRA', 'NOR'), false, md5HexNode);
  assert.deepStrictEqual(row, {
    status: 'notstarted', status_code: 0, minute: null,
    score_home: null, score_away: null, events: [],
    poll_active: true, poll_interval: 300, had_penalties: false, espn_state: 'pre',
  });
});

test('evento post → finished/100 con marcador y goles; inverted orienta ambos', async () => {
  const details = [
    { scoringPlay: true, shootout: false, ownGoal: false, penaltyKick: false, clock: { displayValue: "23'", value: '1380.0' }, athletesInvolved: [{ displayName: 'Achraf Hakimi' }], team: { id: 't-MAR' } },
    { scoringPlay: true, shootout: true, clock: { displayValue: "120'", value: '7200.0' }, athletesInvolved: [{ displayName: 'Tanda NoCuenta' }], team: { id: 't-CAN' } },
  ];
  const post = espnEvent('760502', 'CAN', 'MAR', {
    status: { type: { state: 'post', name: 'STATUS_FINAL_PEN' }, displayClock: "120'" },
    homeScore: '1', awayScore: '1', details,
  });
  // Proyecto MAR-CAN, ESPN CAN@home → inverted=true.
  const row = await liveRowStateFor(post, true, md5HexNode);
  assert.strictEqual(row.status, 'finished');
  assert.strictEqual(row.status_code, 100);
  assert.strictEqual(row.had_penalties, true);
  assert.strictEqual(row.poll_active, false);
  assert.strictEqual(row.poll_interval, 0);
  assert.strictEqual(row.score_home, 1);
  assert.strictEqual(row.score_away, 1);
  // Solo el gol en juego (la tanda se filtra, premisa del bridge); el gol de
  // MAR (away ESPN) con inverted=true es HOME de proyecto.
  assert.strictEqual(row.events.length, 1);
  assert.strictEqual(row.events[0].player.name, 'Achraf Hakimi');
  assert.strictEqual(row.events[0].isHome, true);
  assert.strictEqual(row.events[0].incidentType, 'goal');
});

test('evento post con marcador desigual: inverted reorienta el marcador', async () => {
  const post = espnEvent('760503', 'PAR', 'FRA', {
    status: { type: { state: 'post', name: 'STATUS_FULL_TIME' }, displayClock: "90'" },
    homeScore: '2', awayScore: '3',
  });
  // Proyecto FRA-PAR, ESPN PAR@home → inverted=true → 3-2 en marco proyecto.
  const row = await liveRowStateFor(post, true, md5HexNode);
  assert.strictEqual(row.score_home, 3);
  assert.strictEqual(row.score_away, 2);
  assert.strictEqual(row.had_penalties, false);
  assert.strictEqual(row.minute, 90);
});
