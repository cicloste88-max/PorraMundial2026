// Item 6 post-J1 — porra-jugador-v3: finalizados aparecían como "Aún por jugar".
//
// Causa: _realFor consultaba window._liveScoresByMatchKey con la key LEGACY de
// _mk (grupo_local_visitante), pero live-sync.js indexa la cache por key de BD
// (wc2026_gX_id). El lookup fallaba SIEMPRE → toda tarjeta caía a phase 'pre'
// (Aún por jugar, 0 pts, J1 PRÓX) aunque el partido estuviera finished.
//
// Fix: resolver la key de cache con window.matchKeyFor(matchObj) (live-sync,
// mismo mapper que getDirectoKey en ui-directo), con guard si no existe.
// La legacy sigue siendo correcta para predByKey/boostSet (no se toca _mk).
//
// Se ejecuta el _realFor REAL extraído por marcadores (patrón scoring.test.mjs).

import assert from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../public/js/v3/porra-jugador-v3.js', import.meta.url), 'utf8');

function extractFn(name) {
  const start = SRC.indexOf(`function ${name}(`);
  assert.ok(start > -1, `función ${name} no encontrada`);
  const end = SRC.indexOf('\n  }', start);
  return SRC.slice(start, end + 4);
}

// _realFor usa _live() y window.matchKeyFor — se inyectan estubadas.
function makeRealFor(cache, matchKeyForImpl) {
  const factory = new Function('_live', 'window', `
    ${extractFn('_realFor')}
    return _realFor;
  `);
  return factory(() => cache, { matchKeyFor: matchKeyForImpl });
}

const MEX_RSA = { group: 'A', home: 'México', away: 'Sudáfrica' };
const BD_KEY = 'wc2026_gA_15186710';
const CACHE = {
  [BD_KEY]: { match_key: BD_KEY, status: 'finished', score_home: 2, score_away: 0, minute: 90 },
};

test('finished: resuelve por key de BD vía matchKeyFor → phase final con marcador', () => {
  const realFor = makeRealFor(CACHE, (m) => (m === MEX_RSA ? BD_KEY : null));
  assert.deepStrictEqual(realFor(MEX_RSA), { h: 2, a: 0, phase: 'final' });
});

test('la key legacy ya NO se usa para la cache (regresión raíz del bug)', () => {
  // Cache indexada SOLO por legacy: con el fix (lookup por BD key) no debe encontrarla.
  const legacyCache = { 'A_México_Sudáfrica': CACHE[BD_KEY] };
  const realFor = makeRealFor(legacyCache, () => BD_KEY);
  assert.strictEqual(realFor(MEX_RSA), null);
});

test('guard: sin window.matchKeyFor → null (phase pre), sin throw', () => {
  const factory = new Function('_live', 'window', `
    ${extractFn('_realFor')}
    return _realFor;
  `);
  const realFor = factory(() => CACHE, {});
  assert.strictEqual(realFor(MEX_RSA), null);
});

test('en vivo: phase live con minuto', () => {
  const liveCache = { [BD_KEY]: { status: 'inprogress', score_home: 1, score_away: 0, minute: 37 } };
  const realFor = makeRealFor(liveCache, () => BD_KEY);
  assert.deepStrictEqual(realFor(MEX_RSA), { h: 1, a: 0, phase: 'live', minute: 37 });
});

test('wiring: buildMatchCard llama _realFor(matchObj) y _mk sigue para predByKey/boostSet', () => {
  assert.ok(SRC.includes('_realFor(matchObj)'));
  assert.ok(!/_realFor\(matchObj, matchKey\)/.test(SRC));
  assert.ok(SRC.includes('predByKey[_mk(mo)]'));
});
