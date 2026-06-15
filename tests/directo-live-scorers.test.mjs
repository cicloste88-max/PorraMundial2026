// Item 3+5 post-J1 — badge de puntos en Directo perdía el +2 de goleador.
//
// Causa: _getLivePts (ui-directo.js) llamaba a calcMatchPoints SIN el 5º
// parámetro realScorers → scoring.js caía a _hf09FallbackScorers (primer
// jugador de plantilla del ganador) y el +2 no se concedía nunca, ni en vivo
// ni al final. Casos reales J1: "GANASTE +8 PTS ×2" cuando el real es 12;
// "VAS GANANDO +1" cuando el real es 3.
//
// Fix testeado aquí:
//   1. deriveScorersFromEvents (scoring.js): events crudos de live_scores →
//      scorer keys, espejo del extractScorers del bridge, REUSANDO
//      playerToShortKey (lookup EQUIPOS[iso3].players + fallback NFD último
//      token). Fixtures = events REALES de MEX-RSA (BD, 11-jun).
//   2. Aceptación con el motor canónico (_shared/scoring.mjs): dogino19822
//      2-0 + Jimenez + boost → 12; en vivo 2:1 Quiñones a 2-0 → 3.
//   3. Wiring guards: _getLivePts pasa realScorers; copy "(boost ×2)";
//      live-sync carga match_results con lector defensivo asObj.

import assert from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { calcMatchPoints as sharedCalcMatchPoints } from '../supabase/functions/_shared/scoring.mjs';

const SCORING_SRC = readFileSync(new URL('../public/js/scoring.js', import.meta.url), 'utf8');
const DIRECTO_SRC = readFileSync(new URL('../public/js/ui-directo.js', import.meta.url), 'utf8');
const LIVESYNC_SRC = readFileSync(new URL('../public/js/live-sync.js', import.meta.url), 'utf8');

// Extracción por marcadores de función (patrón scoring.test.mjs — nunca por nº
// de línea). Las dos funciones son flat: terminan en el primer '\n}'.
function extractFn(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start > -1, `función ${name} no encontrada en scoring.js`);
  const end = src.indexOf('\n}', start);
  return src.slice(start, end + 2);
}

// EQUIPOS mínimo con shapes reales de data.js (keys que NO siempre son el
// último apellido: 'Martin' para Guillermo Martínez).
const EQUIPOS_FIXTURE = [
  {
    name: 'México', flag: 'MEX',
    players: [
      { key: 'Jimenez', name: '9 · Raúl Jiménez' },
      { key: 'Martin', name: '22 · Guillermo Martínez' },
      { key: 'Quinones', name: '16 · Julián Quiñones' },
    ],
  },
  {
    name: 'Sudáfrica', flag: 'RSA',
    players: [{ key: 'Zwane', name: '11 · Themba Zwane' }],
  },
  // clase-Vinicius (key ≠ último apellido del feed) + ambiguo (2× Rodriguez).
  { name: 'Suecia', flag: 'SWE', players: [{ key: 'Isak', name: '9 · Alexander Isak' }, { key: 'Gyokeres', name: '17 · Viktor Gyökeres' }] },
  { name: 'Brasil', flag: 'BRA', players: [{ key: 'Vinicius', name: '7 · Vinicius Jr' }, { key: 'Raphinha', name: '11 · Raphinha' }] },
  { name: 'Panamá', flag: 'PAN', players: [{ key: 'JoseLuisRodriguez', name: '15 · José Luis Rodríguez' }, { key: 'TomasRodriguez', name: '7 · Tomás Rodríguez' }] },
];

// ERR-94 (A): deriveScorersFromEvents resuelve vía matchPlayerKey/fallbackKey
// (espejo del bridge), no por el playerToShortKey legacy (substring). Se inyectan
// las deps del módulo espejado en scoring.js.
const factory = new Function('EQUIPOS', `
  ${extractFn(SCORING_SRC, 'normName')}
  ${extractFn(SCORING_SRC, 'toks')}
  ${extractFn(SCORING_SRC, 'matchPlayerKey')}
  ${extractFn(SCORING_SRC, 'fallbackKey')}
  ${extractFn(SCORING_SRC, '_liveScorerKey')}
  ${extractFn(SCORING_SRC, 'deriveScorersFromEvents')}
  return { deriveScorersFromEvents };
`);
const { deriveScorersFromEvents } = factory(EQUIPOS_FIXTURE);
const _goal = (name, isHome) => ({ isHome, player: { name }, incidentType: 'goal', incidentClass: 'regular' });

// Events REALES de live_scores wc2026_gA_15186710 (escritos por el poller ESPN).
const MEX_RSA_EVENTS = [
  { id: 199794646, time: 9, isHome: true, player: { name: 'Julián Quiñones' }, incidentType: 'goal', incidentClass: 'regular' },
  { id: 139952626, time: 67, isHome: true, player: { name: 'Raúl Jiménez' }, incidentType: 'goal', incidentClass: 'regular' },
];

test('derive MEX-RSA real: keys canónicas vía roster — mismas que escribió el bridge', () => {
  assert.deepStrictEqual(
    deriveScorersFromEvents(MEX_RSA_EVENTS, false, 'MEX', 'RSA'),
    ['Quinones', 'Jimenez'],
  );
});

test('key de roster que NO es el último apellido: Guillermo Martínez → Martin (path includes)', () => {
  const ev = [{ isHome: true, player: { name: 'Guillermo Martínez' }, incidentType: 'goal', incidentClass: 'regular' }];
  assert.deepStrictEqual(deriveScorersFromEvents(ev, false, 'MEX', 'RSA'), ['Martin']);
});

test('sin roster (iso3 desconocido): fallback NFD + último token — Raúl Jiménez → Jimenez', () => {
  assert.deepStrictEqual(
    deriveScorersFromEvents(MEX_RSA_EVENTS, false, 'XXX', 'YYY'),
    ['Quinones', 'Jimenez'],
  );
});

test('exclusiones espejo del bridge: ownGoal y penaltyShootout fuera; inGamePenalty dentro', () => {
  const ev = [
    { isHome: true, player: { name: 'Raúl Jiménez' }, incidentType: 'goal', incidentClass: 'ownGoal' },
    { isHome: false, player: { name: 'Themba Zwane' }, incidentType: 'penaltyShootout', incidentClass: 'scored' },
    { isHome: true, player: { name: 'Julián Quiñones' }, incidentType: 'inGamePenalty', incidentClass: 'scored' },
    { isHome: true, player: {}, incidentType: 'goal', incidentClass: 'regular' }, // sin nombre → skip
  ];
  assert.deepStrictEqual(deriveScorersFromEvents(ev, false, 'MEX', 'RSA'), ['Quinones']);
});

// ── ERR-94 (A): clase-Vinicius EN VIVO — feed nombre completo → key canónica ──
test('EN VIVO clase-Vinicius: feed completo → key canónica (espejo bridge)', () => {
  // Isak ya casaba (substring); Vinicius/Son eran el bug (substring fallaba →
  // último token "Junior"/"Min"). Ahora matchPlayerKey resuelve por tokens.
  assert.deepStrictEqual(deriveScorersFromEvents([_goal('Alexander Isak', true)], false, 'SWE', 'TUN'), ['Isak']);
  assert.deepStrictEqual(deriveScorersFromEvents([_goal('Vinicius Junior', true)], false, 'BRA', 'MAR'), ['Vinicius']);
  assert.deepStrictEqual(deriveScorersFromEvents([_goal('Vinícius Júnior', true)], false, 'BRA', 'MAR'), ['Vinicius']);
});

test('EN VIVO ambiguo (2× Rodriguez PAN): apellido a secas → fallback, nombre completo → jugador', () => {
  // {ambiguous} → fallbackKey (como el bridge): no acredita a un candidato concreto.
  assert.deepStrictEqual(deriveScorersFromEvents([_goal('Rodriguez', true)], false, 'PAN', 'XXX'), ['Rodriguez']);
  assert.deepStrictEqual(deriveScorersFromEvents([_goal('Tomás Rodríguez', true)], false, 'PAN', 'XXX'), ['TomasRodriguez']);
});

test('teamsSwapped reorienta el isHome igual que el bridge', () => {
  // isHome=true con swapped → equipo proyecto AWAY (RSA): Zwane resuelve por roster RSA.
  const ev = [{ isHome: true, player: { name: 'Themba Zwane' }, incidentType: 'goal', incidentClass: 'regular' }];
  assert.deepStrictEqual(deriveScorersFromEvents(ev, true, 'MEX', 'RSA'), ['Zwane']);
});

test('events no-array o vacío → [] (sin goles aún ≠ fallback)', () => {
  assert.deepStrictEqual(deriveScorersFromEvents(null, false, 'MEX', 'RSA'), []);
  assert.deepStrictEqual(deriveScorersFromEvents([], false, 'MEX', 'RSA'), []);
});

// ─── Aceptación del brief contra el motor canónico (_shared/scoring.mjs) ───

test('aceptación dogino19822: 2-0 + Jimenez + boost, real 2-0 [Quinones,Jimenez] → 12', () => {
  const pts = sharedCalcMatchPoints(
    { saved: true, l: 2, v: 0, gol: 'Jimenez' }, 2, 0,
    { scorers: ['Quinones', 'Jimenez'], boost: true },
  );
  assert.strictEqual(pts, 12); // (1 signo + 3 exacto + 2 gol) ×2
});

test('aceptación en vivo: pred 2:1 Quinones, marcador 2-0 → 3 (signo + gol)', () => {
  const pts = sharedCalcMatchPoints(
    { saved: true, l: 2, v: 1, gol: 'Quinones' }, 2, 0,
    { scorers: ['Quinones', 'Jimenez'] },
  );
  assert.strictEqual(pts, 3);
});

// ─── Wiring guards ───

test('wiring: _getLivePts pasa realScorers como 5º argumento a calcMatchPoints', () => {
  assert.match(DIRECTO_SRC, /calcMatchPoints\(predWithFlag, ctx\.scoreH, ctx\.scoreA, ctx\.matchKey, realScorers\)/);
  assert.ok(DIRECTO_SRC.includes('function _realScorersFor(ctx, m)'));
});

test('wiring: _realScorersFor prefiere scorers canónicos del bridge en finished', () => {
  const fn = DIRECTO_SRC.slice(DIRECTO_SRC.indexOf('function _realScorersFor'), DIRECTO_SRC.indexOf('function _buildDMini'));
  assert.ok(fn.includes('window._matchResultsByKey'));
  assert.ok(fn.includes('deriveScorersFromEvents'));
  assert.ok(fn.indexOf('_matchResultsByKey') < fn.indexOf('deriveScorersFromEvents'));
});

test('wiring: copy del boost es "(boost ×2)" — nunca "pts ×2" suelto', () => {
  assert.ok(DIRECTO_SRC.includes("' (boost ×2)'"));
  assert.ok(!DIRECTO_SRC.includes("' ×2'"));
});

test('wiring live-sync: carga match_results con lector defensivo asObj + refetch on finished', () => {
  assert.ok(LIVESYNC_SRC.includes("from('results')"));
  assert.match(LIVESYNC_SRC, /typeof mr === 'string'/);
  assert.ok(LIVESYNC_SRC.includes("norm.status === 'finished'") &&
            LIVESYNC_SRC.includes('scheduleMatchResultsRefresh(norm.match_key)'));
});

test('wiring live-sync: normalizeRow copia minute a primer nivel (ERR-87)', () => {
  const fn = LIVESYNC_SRC.slice(LIVESYNC_SRC.indexOf('function normalizeRow'), LIVESYNC_SRC.indexOf('function loadMatchResults'));
  assert.match(fn, /minute:\s+row\.minute \?\? null/);
});
