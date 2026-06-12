// R1 post-J1 — widget RANKING LIGA del Predictor roto: "Vas Nº1 de 1, líder
// <yo> con 0 pts".
//
// Causa (verificada en BD): league_members tiene policy SELECT self-only
// (auth.uid() = user_id) → la query legacy de loadLeagueRanking veía SOLO la
// fila del caller, con points:0 hardcodeado del stub pre-Mundial.
//
// Fix: misma fuente que el panel TU POSICIÓN — v_league_rank (sobre
// user_points_cache, SELECT authenticated using(true)) + profiles (RLS
// lectura pública) SIN tocar league_members. Se ejecuta el loadLeagueRanking
// REAL extraído de data.js contra un cliente PostgREST estubado.

import assert from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const DATA_SRC = readFileSync(new URL('../public/js/data.js', import.meta.url), 'utf8');

function extractFn(name) {
  const start = DATA_SRC.indexOf(`async function ${name}(`);
  assert.ok(start > -1, `función ${name} no encontrada`);
  const end = DATA_SRC.indexOf('\n}', start);
  return DATA_SRC.slice(start, end + 2);
}

// Cliente PostgREST mínimo: thenable encadenable que resuelve fixtures por tabla.
function fakeDb(fixtures) {
  return {
    queried: [],
    from(table) {
      this.queried.push(table);
      const result = fixtures[table] ?? { data: [], error: null };
      const builder = {
        select() { return builder; },
        eq() { return builder; },
        in() { return builder; },
        order() { return builder; },
        then(resolve) { resolve(result); },
      };
      return builder;
    },
  };
}

function makeLoad(db) {
  const factory = new Function('window', `
    ${extractFn('loadLeagueRanking')}
    return loadLeagueRanking;
  `);
  return factory({ _porraDb: db });
}

const RANKS_GALLOS = {
  data: [
    { user_id: 'u-dogino', total_pts: 12, rank_league: 1 },
    { user_id: 'u-parrandas', total_pts: 3, rank_league: 13 },
    { user_id: 'u-zayu', total_pts: 6, rank_league: 8 },
  ],
  error: null,
};
const PROFILES = {
  data: [
    { id: 'u-dogino', nombre: 'dogino19822', is_bot: false },
    { id: 'u-parrandas', nombre: 'Parrandas', is_bot: false },
    { id: 'u-zayu', nombre: 'IA Zayu', is_bot: true },
  ],
  error: null,
};

test('lee v_league_rank + profiles y NUNCA league_members (RLS self-only)', async () => {
  const db = fakeDb({ v_league_rank: RANKS_GALLOS, profiles: PROFILES });
  const rows = await makeLoad(db)('liga-gallos');
  assert.deepStrictEqual(db.queried, ['v_league_rank', 'profiles']);
  assert.ok(!db.queried.includes('league_members'));
  assert.strictEqual(rows.length, 3);
});

test('shape del widget: position/points reales de la cache, is_bot de profiles, orden por rank', async () => {
  const db = fakeDb({ v_league_rank: RANKS_GALLOS, profiles: PROFILES });
  const rows = await makeLoad(db)('liga-gallos');
  assert.deepStrictEqual(rows[0], { user_id: 'u-dogino', nombre: 'dogino19822', is_bot: false, points: 12, position: 1 });
  assert.deepStrictEqual(rows[1], { user_id: 'u-zayu', nombre: 'IA Zayu', is_bot: true, points: 6, position: 8 });
  assert.deepStrictEqual(rows[2], { user_id: 'u-parrandas', nombre: 'Parrandas', is_bot: false, points: 3, position: 13 });
});

test('cache vacía (liga sin sembrar) → [] sin tocar profiles', async () => {
  const db = fakeDb({ v_league_rank: { data: [], error: null } });
  const rows = await makeLoad(db)('liga-x');
  assert.deepStrictEqual(rows, []);
  assert.deepStrictEqual(db.queried, ['v_league_rank']);
});

test('error de la vista → [] (contrato previo del widget)', async () => {
  const db = fakeDb({ v_league_rank: { data: null, error: { message: 'boom' } } });
  const rows = await makeLoad(db)('liga-x');
  assert.deepStrictEqual(rows, []);
});

test('wiring fuente: el legacy points:0 y el select de league_members ya no existen', () => {
  const fn = extractFn('loadLeagueRanking');
  assert.ok(!fn.includes("from('league_members')"));
  assert.ok(!fn.includes('points: 0'));
  assert.ok(fn.includes("from('v_league_rank')"));
});
