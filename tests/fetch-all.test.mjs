// node --test tests/fetch-all.test.mjs
// Helper de paginación de get-league-standings (ERR-86): un SELECT plano de
// PostgREST trunca silenciosamente en db-max-rows (1000). fetchAllRows debe
// recuperar TODAS las filas, sin pérdida ni duplicados, paginando .range().
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { fetchAllRows, PAGE_SIZE } from '../supabase/functions/get-league-standings/fetch-all.mjs';

// Mock de pageFn sobre un dataset ordenado: simula PostgREST .order(id).range(from,to).
function mkPageFn(totalRows, { calls } = {}) {
  const dataset = Array.from({ length: totalRows }, (_, i) => ({ id: i + 1 }));
  return async (from, to) => {
    if (calls) calls.push([from, to]);
    return { data: dataset.slice(from, to + 1), error: null };
  };
}

test('fetchAllRows — dataset > 1000 (caso Porra gallos 1224): sin pérdida ni duplicados', async () => {
  const calls = [];
  const { rows, pages } = await fetchAllRows(mkPageFn(1224, { calls }));
  assert.equal(rows.length, 1224, 'todas las filas recuperadas');
  assert.equal(pages, 2, '2 páginas (1000 + 224)');
  const ids = new Set(rows.map((r) => r.id));
  assert.equal(ids.size, 1224, 'sin duplicados');
  assert.equal(rows[0].id, 1, 'primera fila');
  assert.equal(rows[1223].id, 1224, 'última fila');
  // El caller recibe rangos contiguos de PAGE_SIZE: el orden estable lo
  // garantiza el .order() que el caller aplica en pageFn (contrato).
  assert.deepEqual(calls, [[0, 999], [1000, 1999]], 'rangos offset contiguos');
});

test('fetchAllRows — múltiplo exacto del page size: página extra vacía y para', async () => {
  const { rows, pages } = await fetchAllRows(mkPageFn(2000));
  assert.equal(rows.length, 2000);
  assert.equal(pages, 3, '1000 + 1000 + página vacía de cierre');
});

test('fetchAllRows — dataset bajo el cap: una sola página', async () => {
  const { rows, pages } = await fetchAllRows(mkPageFn(72));
  assert.equal(rows.length, 72);
  assert.equal(pages, 1);
});

test('fetchAllRows — dataset vacío', async () => {
  const { rows, pages } = await fetchAllRows(mkPageFn(0));
  assert.equal(rows.length, 0);
  assert.equal(pages, 1);
});

test('fetchAllRows — error PostgREST se propaga como Error', async () => {
  await assert.rejects(
    fetchAllRows(async () => ({ data: null, error: { message: 'boom' } })),
    /boom/,
  );
});

test('fetchAllRows — pageSize custom respeta el contrato', async () => {
  const calls = [];
  const { rows } = await fetchAllRows(mkPageFn(25, { calls }), 10);
  assert.equal(rows.length, 25);
  assert.deepEqual(calls, [[0, 9], [10, 19], [20, 29]]);
});

test('PAGE_SIZE — espejo del db-max-rows de Supabase (1000)', () => {
  assert.equal(PAGE_SIZE, 1000);
});
