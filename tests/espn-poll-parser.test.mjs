// EF espn-poll — parser ESPN puro (Item 1 post-J1, 12-jun-2026).
//
// El invariante crítico: los ids de gol deben ser BIT-IDÉNTICOS a los que
// generaba el stopgap SQL public.espn_live_poll() —
//   ('x' || substr(md5(evId || displayClock || athlete), 1, 7))::bit(28)::int
// — porque la dedup de WhatsApp compara contra los events que aquel poller ya
// escribió en live_scores. Si el scheme divergiera, el primer ciclo de la EF
// re-anunciaría TODOS los goles ya notificados.
//
// Vectores REALES verificados contra BD (MEX-RSA 11-jun, espn id 760415,
// md5 calculado por Postgres y comparado con live_scores.events):
//   Quiñones  9' → md5 be89fd62… → id 199794646
//   Jiménez  67' → md5 85781f23… → id 139952626
// Los nombres con acentos (Julián, Raúl) ejercitan el encoding UTF-8.

import assert from 'node:assert';
import { test } from 'node:test';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import {
  buildGoalEvents,
  goalIdFromMd5Hex,
  goalIdInput,
  leadingInt,
  mapEspnStatus,
  minuteFor,
  pollIntervalFor,
  scoresFor,
} from '../supabase/functions/espn-poll/parser.mjs';

const md5HexNode = (s) => Promise.resolve(
  createHash('md5').update(Buffer.from(String(s), 'utf8')).digest('hex'),
);

// Details REALES del scoreboard ESPN de MEX-RSA (760415), desordenados a
// propósito para probar el orden por clock.value. Tarjetas incluidas: deben
// filtrarse por scoringPlay=false.
const MEX_RSA_DETAILS = [
  { scoringPlay: false, shootout: false, ownGoal: false, penaltyKick: false, redCard: true, clock: { displayValue: "90'+2'", value: '5400.0' }, athletesInvolved: [{ displayName: 'César Montes' }], team: { id: '203' } },
  { scoringPlay: true, shootout: false, ownGoal: false, penaltyKick: false, clock: { displayValue: "67'", value: '3996.0' }, athletesInvolved: [{ displayName: 'Raúl Jiménez' }], team: { id: '203' } },
  { scoringPlay: false, shootout: false, ownGoal: false, penaltyKick: false, yellowCard: true, clock: { displayValue: "17'", value: '981.0' }, athletesInvolved: [{ displayName: 'Teboho Mokoena' }], team: { id: '467' } },
  { scoringPlay: true, shootout: false, ownGoal: false, penaltyKick: false, clock: { displayValue: "9'", value: '513.0' }, athletesInvolved: [{ displayName: 'Julián Quiñones' }], team: { id: '203' } },
  { scoringPlay: false, shootout: false, ownGoal: false, penaltyKick: false, redCard: true, clock: { displayValue: "49'", value: '2940.0' }, athletesInvolved: [{ displayName: 'Sphephelo Sithole' }], team: { id: '467' } },
];

const MEX_RSA_COMPETITORS = [
  { homeAway: 'home', score: '2', team: { id: '203' } },
  { homeAway: 'away', score: '0', team: { id: '467' } },
];

test('md5 UTF-8 reproduce los hex de Postgres (vectores reales)', async () => {
  assert.strictEqual(
    await md5HexNode(goalIdInput('760415', "9'", 'Julián Quiñones')),
    'be89fd622f64f72b09f2ff0fad440a0a',
  );
  assert.strictEqual(
    await md5HexNode(goalIdInput('760415', "67'", 'Raúl Jiménez')),
    '85781f2336e7be70ca242da9320d65b4',
  );
});

test('goalIdFromMd5Hex = bit(28)::int de los 7 primeros hex (siempre positivo)', () => {
  assert.strictEqual(goalIdFromMd5Hex('be89fd622f64f72b09f2ff0fad440a0a'), 199794646);
  assert.strictEqual(goalIdFromMd5Hex('85781f2336e7be70ca242da9320d65b4'), 139952626);
  assert.ok(goalIdFromMd5Hex('fffffff0') <= 0xFFFFFFF);
});

test('buildGoalEvents MEX-RSA: ids estables idénticos a live_scores.events, tarjetas fuera, orden por clock.value', async () => {
  const events = await buildGoalEvents('760415', MEX_RSA_DETAILS, false, '203', md5HexNode);
  assert.deepStrictEqual(events, [
    { id: 199794646, incidentType: 'goal', incidentClass: 'regular', player: { name: 'Julián Quiñones' }, time: 9, isHome: true },
    { id: 139952626, incidentType: 'goal', incidentClass: 'regular', player: { name: 'Raúl Jiménez' }, time: 67, isHome: true },
  ]);
});

test('inverted=true: isHome se invierte (XOR) y el marcador se gira', async () => {
  const events = await buildGoalEvents('760415', MEX_RSA_DETAILS, true, '203', md5HexNode);
  assert.strictEqual(events[0].isHome, false);
  assert.strictEqual(events[1].isHome, false);
  // El id NO cambia con inverted (depende solo de evId+clock+athlete).
  assert.strictEqual(events[0].id, 199794646);

  const { scoreHome, scoreAway } = scoresFor(MEX_RSA_COMPETITORS, true);
  assert.strictEqual(scoreHome, 0);
  assert.strictEqual(scoreAway, 2);
});

test('incidentClass: ownGoal gana a penalty; penaltyKick → penalty; shootout excluido', async () => {
  const details = [
    { scoringPlay: true, shootout: false, ownGoal: true, penaltyKick: true, clock: { displayValue: "12'", value: '720.0' }, athletesInvolved: [{ displayName: 'A' }], team: { id: '1' } },
    { scoringPlay: true, shootout: false, ownGoal: false, penaltyKick: true, clock: { displayValue: "30'", value: '1800.0' }, athletesInvolved: [{ displayName: 'B' }], team: { id: '2' } },
    { scoringPlay: true, shootout: true, ownGoal: false, penaltyKick: true, clock: { displayValue: "120'", value: '7200.0' }, athletesInvolved: [{ displayName: 'C' }], team: { id: '1' } },
  ];
  const events = await buildGoalEvents('999', details, false, '1', md5HexNode);
  assert.strictEqual(events.length, 2);
  assert.strictEqual(events[0].incidentClass, 'ownGoal');
  assert.strictEqual(events[1].incidentClass, 'penalty');
  assert.strictEqual(events[1].isHome, false);
});

test('athlete ausente: player.name null y el md5 usa cadena vacía (COALESCE del SQL)', async () => {
  const details = [
    { scoringPlay: true, shootout: false, clock: { displayValue: "5'", value: '300.0' }, athletesInvolved: [], team: { id: '1' } },
  ];
  const events = await buildGoalEvents('777', details, false, '1', md5HexNode);
  assert.strictEqual(events[0].player.name, null);
  const expected = goalIdFromMd5Hex(await md5HexNode("7775'"));
  assert.strictEqual(events[0].id, expected);
});

test('mapEspnStatus: tabla completa de estados', () => {
  assert.strictEqual(mapEspnStatus('pre', 'STATUS_SCHEDULED', null), null);
  assert.strictEqual(mapEspnStatus(null, null, null), null);
  assert.deepStrictEqual(mapEspnStatus('post', 'STATUS_FULL_TIME', '2'), { status: 'finished', code: 100, active: false });
  assert.deepStrictEqual(mapEspnStatus('in', 'STATUS_HALFTIME', '1'), { status: 'halftime', code: 31, active: true });
  assert.deepStrictEqual(mapEspnStatus('in', 'STATUS_FIRST_HALF', '1'), { status: 'inprogress', code: 6, active: true });
  assert.deepStrictEqual(mapEspnStatus('in', 'STATUS_SECOND_HALF', '2'), { status: 'inprogress', code: 7, active: true });
  assert.deepStrictEqual(mapEspnStatus('in', 'STATUS_OVERTIME', '3'), { status: 'inprogress', code: 7, active: true });
});

test("minuteFor: dígitos iniciales del displayClock; finished sin clock → 90", () => {
  assert.strictEqual(minuteFor('inprogress', "45'+2'"), 45);
  assert.strictEqual(minuteFor('finished', "90'+8'"), 90);
  assert.strictEqual(minuteFor('finished', null), 90);
  assert.strictEqual(minuteFor('inprogress', null), null);
  assert.strictEqual(leadingInt("0'"), 0);
});

test('scoresFor: score string→int, vacío/ausente → null', () => {
  assert.deepStrictEqual(scoresFor(MEX_RSA_COMPETITORS, false), { scoreHome: 2, scoreAway: 0, homeTeamId: '203' });
  const r = scoresFor([{ homeAway: 'home', score: '', team: { id: '9' } }, { homeAway: 'away', team: { id: '8' } }], false);
  assert.strictEqual(r.scoreHome, null);
  assert.strictEqual(r.scoreAway, null);
});

test('pollIntervalFor: 60 en juego, 120 descanso, 0 final', () => {
  assert.strictEqual(pollIntervalFor('inprogress'), 60);
  assert.strictEqual(pollIntervalFor('halftime'), 120);
  assert.strictEqual(pollIntervalFor('finished'), 0);
});

// ─── Wiring guards sobre index.ts (patrón update-results-matcher.test.mjs) ───

const INDEX_SRC = readFileSync(
  new URL('../supabase/functions/espn-poll/index.ts', import.meta.url),
  'utf8',
);

test('wiring: gate X-Cron-Key se evalúa ANTES del fetch a ESPN', () => {
  const gatePos = INDEX_SRC.indexOf('isCronAuthorized(req)');
  const fetchPos = INDEX_SRC.indexOf('ESPN_SCOREBOARD}?limit=50');
  assert.ok(gatePos > -1 && fetchPos > -1 && gatePos < fetchPos);
});

test("wiring: el UPDATE lleva el guard .neq('status','finished') — NUNCA tocar filas bridgeadas", () => {
  assert.match(INDEX_SRC, /\.eq\("match_key", map\.match_key\)\.neq\("status", "finished"\)/);
});

test('wiring: events va como objeto plano a supabase-js (sin JSON.stringify — jsonb double-encoded)', () => {
  assert.ok(!/JSON\.stringify\(events/.test(INDEX_SRC));
  assert.match(INDEX_SRC, /\n\s+events,\n/);
});

test('wiring: dry_run nunca escribe ni envía (sendWhatsApp y update bajo !dryRun)', () => {
  const block = INDEX_SRC.slice(INDEX_SRC.indexOf('if (!dryRun) {'), INDEX_SRC.indexOf('// 4) Monitoring'));
  assert.ok(block.includes('sendWhatsApp'));
  assert.ok(block.includes('.from("live_scores").update('));
});
