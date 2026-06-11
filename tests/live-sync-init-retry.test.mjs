// Regresión init de live-sync — Porra Mundial 2026 (fix 11-jun, PR #156 / ERR-88).
//
// Bug raíz (ERR-88): liveSyncInit latcheaba `initialized=true` ANTES de
// comprobar `window._porraDb`. El único caller (main-entry.js, final de la
// chain de loadScript) lo invoca UNA vez: si en ese instante auth.js aún no
// había creado el cliente, snapshot+subscribe se saltaban con un warn y
// ninguna llamada posterior podía reactivar el módulo. Cache vacía para
// siempre → ui-directo cae al fallback m.date (horas de sede) en TODOS los
// partidos, de forma intermitente según el timing de cada carga.
//
// Estos tests ejecutan el live-sync.js REAL completo en un sandbox VM
// (window/document/fetch/setTimeout stubeados) y reproducen los tres
// escenarios: db tardío (la race real), fetch del JSON transitorio, y
// abandono tras el tope de reintentos. La row de live_scores usada es la
// forma REAL del SELECT (match_start_ts BIGINT segundos, ERR-87).
import assert from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const SRC = readFileSync(new URL('../public/js/live-sync.js', import.meta.url), 'utf8');

// Row REAL de live_scores (verificada en BD 11-jun) — MEX-RSA 19:00Z.
const ROW_MEX_RSA = {
  match_key: 'wc2026_gA_15186710',
  status: 'notstarted',
  score_home: null,
  score_away: null,
  events: [],
  match_start_ts: 1781204400,
  is_historic: false,
};

const MATCHES_JSON = {
  wc2026_gA_15186710: {
    home_en: 'Mexico', away_en: 'South Africa', group: 'A', teams_swapped: false,
  },
};

const okFetch = async () => ({ ok: true, json: async () => MATCHES_JSON });

function makeDbMock() {
  const channelChain = {
    on() { return this; },
    subscribe() { return this; },
  };
  return {
    from: () => ({ select: async () => ({ data: [ROW_MEX_RSA], error: null }) }),
    channel: () => channelChain,
    removeChannel: () => {},
  };
}

// Ejecuta el IIFE real de live-sync.js en un contexto aislado.
function bootSandbox(fetchImpl) {
  const timeouts = [];
  const warns = [];
  const sandbox = {
    window: {},
    document: { getElementById: () => null },
    console: {
      log: () => {},
      warn: (...a) => warns.push(a.join(' ')),
      error: (...a) => warns.push(a.join(' ')),
    },
    fetch: fetchImpl,
    setTimeout: (fn, ms) => { timeouts.push({ fn, ms }); return timeouts.length; },
    clearTimeout: () => {},
  };
  vm.createContext(sandbox);
  vm.runInContext(SRC, sandbox);
  return { w: sandbox.window, timeouts, warns };
}

const flush = async (n = 4) => {
  for (let i = 0; i < n; i++) await new Promise((r) => setImmediate(r));
};

test('race real: sin _porraDb NO latchea — reintenta y al aparecer el cliente puebla la cache', async () => {
  const { w, timeouts } = bootSandbox(okFetch);
  assert.strictEqual(typeof w.liveSyncInit, 'function');

  w.liveSyncInit(); // boot de main-entry: auth.js aún no creó el cliente
  await flush();
  assert.strictEqual(timeouts.length, 1, 'debe programar reintento');
  assert.strictEqual(timeouts[0].ms, 500, 'backoff de 500 ms');
  // (no deepStrictEqual contra {} del host: el objeto nace en el realm del VM)
  assert.strictEqual(Object.keys(w._liveScoresByMatchKey).length, 0, 'cache aún vacía');

  timeouts[0].fn(); // retry 1: sigue sin db
  await flush();
  assert.strictEqual(timeouts.length, 2, 'sigue reintentando');

  w._porraDb = makeDbMock(); // auth.js termina el bootstrap
  timeouts[1].fn();          // retry 2: ahora sí
  await flush();

  const norm = w._liveScoresByMatchKey['wc2026_gA_15186710'];
  assert.ok(norm, 'snapshot poblado tras el retry');
  assert.strictEqual(norm.match_start_ts, 1781204400,
    'match_start_ts a primer nivel de la row normalizada (ERR-87)');
  assert.strictEqual(timeouts.length, 2, 'init completado: no programa más reintentos');

  w.liveSyncInit(); // idempotencia post-init
  await flush();
  assert.strictEqual(timeouts.length, 2, 'llamada extra es no-op');
});

test('fetch del JSON transitorio: des-latchea initialized y recupera al reintentar', async () => {
  let calls = 0;
  const flakyFetch = async () => {
    calls++;
    if (calls === 1) throw new Error('network');
    return { ok: true, json: async () => MATCHES_JSON };
  };
  const { w, timeouts } = bootSandbox(flakyFetch);
  w._porraDb = makeDbMock(); // db listo desde el principio

  w.liveSyncInit(); // 1ª: fetch falla
  await flush();
  assert.strictEqual(timeouts.length, 1, 'fallo de JSON programa reintento');
  assert.strictEqual(Object.keys(w._liveScoresByMatchKey).length, 0, 'cache vacía tras el fallo');

  timeouts[0].fn(); // 2ª: fetch ok
  await flush();
  const norm = w._liveScoresByMatchKey['wc2026_gA_15186710'];
  assert.ok(norm, 'recuperado tras fallo transitorio del JSON');
  assert.strictEqual(norm.match_start_ts, 1781204400);
});

test('sin _porraDb nunca: abandona tras 20 reintentos con warn, sin bucle infinito', async () => {
  const { w, timeouts, warns } = bootSandbox(okFetch);
  w.liveSyncInit();
  await flush(1);
  // Drenar reintentos sin db: cada invocación puede programar otro.
  let i = 0;
  while (i < timeouts.length && i < 50) {
    timeouts[i].fn();
    i++;
  }
  await flush();
  assert.strictEqual(timeouts.length, 20, 'tope: 20 reintentos programados (10 s)');
  assert.ok(warns.some((m) => m.includes('init abandonado')), 'warn de abandono emitido');
});
