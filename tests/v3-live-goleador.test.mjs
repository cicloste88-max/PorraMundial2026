// ERR-94 (B) — v3 (porra-jugador / PREDICTOR) muestra el +2 de goleador EN VIVO.
//
// Antes: v3CalcMatchPointsGrupos solo leía window._matchResultsByKey (scorers
// canónicos del bridge), VACÍO en vivo → el chip GOL +2 quedaba gris hasta el
// cierre (San: "26 pickers de Isak sin +2 en vivo hasta el cierre"), aunque
// signo/exacto/vs-IA sí calculaban en vivo.
//
// Ahora: si no hay entrada del bridge, deriva scorers de live_scores.events con
// el MISMO resolver que el bridge (deriveScorersFromEvents → _liveScorerKey →
// matchPlayerKey), así el +2 provisional casa con el cierre. Tras el cierre,
// sigue usando los scorers canónicos del bridge.
//
// Se ejecuta el v3CalcMatchPointsGrupos REAL extraído por marcadores, con sus
// deps de scoring.js (resolver) inyectadas y las globales mockeadas.

import assert from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const SC = readFileSync(new URL('../public/js/scoring.js', import.meta.url), 'utf8');
const GV = readFileSync(new URL('../public/js/v3/grupos-v3.js', import.meta.url), 'utf8');
function ext(src, name) {
  const s = src.indexOf('function ' + name + '(');
  assert.ok(s > -1, `función ${name} no encontrada`);
  const e = src.indexOf('\n}', s);
  return src.slice(s, e + 2);
}

const EQUIPOS = [
  { name: 'Suecia', flag: 'SWE', players: [{ key: 'Isak', name: '9 · Alexander Isak' }] },
  { name: 'Túnez',  flag: 'TUN', players: [{ key: 'Skhiri', name: '5 · Ellyes Skhiri' }] },
  { name: 'Brasil', flag: 'BRA', players: [{ key: 'Vinicius', name: '7 · Vinicius Jr' }] },
  { name: 'Marruecos', flag: 'MAR', players: [{ key: 'Diaz', name: '10 · Brahim Díaz' }] },
];

// window mock con cache de results (bridge) y live_scores. matchKeyFor lee
// match.__livekey; getMatchKey lee match.__key (legacy).
const win = { _matchResultsByKey: {}, _liveScoresByMatchKey: {}, matchKeyFor: (m) => m.__livekey || null };

const factory = new Function('EQUIPOS', 'window', 'getMatchKey', 'iaBonusWillApply', 'calcMatchPoints', `
  ${ext(SC, 'normName')}
  ${ext(SC, 'toks')}
  ${ext(SC, 'matchPlayerKey')}
  ${ext(SC, 'fallbackKey')}
  ${ext(SC, '_liveScorerKey')}
  ${ext(SC, 'deriveScorersFromEvents')}
  ${ext(SC, 'scorerMatches')}
  ${ext(GV, 'v3CalcMatchPointsGrupos')}
  return v3CalcMatchPointsGrupos;
`);
// calcMatchPoints stub: sólo nos importa el breakdown `types`, no el total.
const v3calc = factory(EQUIPOS, win, (m) => m.__key, () => false, () => 0);

const goal = (name) => ({ isHome: true, player: { name }, incidentType: 'goal', incidentClass: 'regular' });

test('EN VIVO sin bridge: deriva goleador de live_scores.events → chip GOL +2', () => {
  win._matchResultsByKey = {}; // sin entrada del bridge (en vivo)
  win._liveScoresByMatchKey = { LK1: { events: [goal('Alexander Isak')], _teams_swapped: false } };
  const match = { home: 'Suecia', away: 'Túnez', realHome: 1, realAway: 0, played: true, __key: 'A_Suecia_Tunez', __livekey: 'LK1' };
  const r = v3calc({ saved: true, l: 1, v: 0, gol: 'Isak' }, match);
  assert.ok(r.types.includes('gole'), 'Isak debe puntuar +2 en vivo');
});

test('EN VIVO clase-Vinicius: feed "Vinicius Junior" → key "Vinicius" → +2', () => {
  win._matchResultsByKey = {};
  win._liveScoresByMatchKey = { LK2: { events: [goal('Vinicius Junior')], _teams_swapped: false } };
  const match = { home: 'Brasil', away: 'Marruecos', realHome: 1, realAway: 0, played: true, __key: 'C_Brasil_Marruecos', __livekey: 'LK2' };
  const r = v3calc({ saved: true, l: 1, v: 0, gol: 'Vinicius' }, match);
  assert.ok(r.types.includes('gole'), 'Vinicius (clase-Vinicius) debe puntuar +2 en vivo');
});

test('EN VIVO pick que no marcó: sin +2', () => {
  win._matchResultsByKey = {};
  win._liveScoresByMatchKey = { LK3: { events: [goal('Alexander Isak')], _teams_swapped: false } };
  const match = { home: 'Suecia', away: 'Túnez', realHome: 1, realAway: 0, played: true, __key: 'A_Suecia_Tunez', __livekey: 'LK3' };
  const r = v3calc({ saved: true, l: 1, v: 0, gol: 'Gyokeres' }, match);
  assert.ok(!r.types.includes('gole'), 'Gyokeres no marcó → sin +2');
});

test('CIERRE: con entrada del bridge usa los scorers canónicos (no live events)', () => {
  win._matchResultsByKey = { A_Suecia_Tunez: { l: 1, v: 0, scorers: ['Isak'] } };
  win._liveScoresByMatchKey = {}; // ya no hace falta el live
  const match = { home: 'Suecia', away: 'Túnez', realHome: 1, realAway: 0, played: true, __key: 'A_Suecia_Tunez', __livekey: 'LK4' };
  const r = v3calc({ saved: true, l: 1, v: 0, gol: 'Isak' }, match);
  assert.ok(r.types.includes('gole'), 'cierre: +2 desde scorers canónicos del bridge');
});
