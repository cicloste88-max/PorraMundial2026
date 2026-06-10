// node --test tests/ia-bridge.test.mjs
// Puente ia_predictions (claves wc2026_g*) ↔ predictions (claves legacy
// "{grupo}_{home_es}_{away_es}") de get-league-standings v1.2.1.
// El bug original (fix 10-jun): el lookup cruzaba la clave legacy contra la
// tabla cruda → miss 100% → el +1 anti-IA no se pagó nunca. Y sin flip, el
// único fixture teams_swapped (BRA-ESC J3) pagaría el bono con el signo
// invertido. Datos espejo de producción (wc2026_gC_15186861: home_code=SCO,
// home_iso3=BRA, sign crudo '2' = gana Brasil en orientación SofaScore).
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { buildIaSignByLegacyKey, flipSign } from '../supabase/functions/get-league-standings/ia-bridge.mjs';
import { iaBonusPredicate } from '../supabase/functions/_shared/scoring.mjs';

const WC_ROWS = [
  { match_key: 'wc2026_gA_15186490', group_letter: 'A', home_es: 'México', away_es: 'Sudáfrica', home_iso3: 'MEX' },
  { match_key: 'wc2026_gC_15186861', group_letter: 'C', home_es: 'Brasil', away_es: 'Escocia',   home_iso3: 'BRA' },
];

test('flipSign — 1<->2, X invariante', () => {
  assert.equal(flipSign('1'), '2');
  assert.equal(flipSign('2'), '1');
  assert.equal(flipSign('X'), 'X');
});

test('puente — clave wc2026 normal mapea a legacy con sign crudo', () => {
  const out = buildIaSignByLegacyKey(
    [{ match_id: 'wc2026_gA_15186490', sign: '1', home_code: 'MEX' }],
    WC_ROWS,
  );
  assert.deepEqual(out['A_México_Sudáfrica'], { sign: '1' });
});

test('puente — fixture swapped BRA-ESC: flip 1<->2 a orientación porra', () => {
  // Producción real: la IA computó SCO como home (sign '2' = gana el away,
  // Brasil). En la card de la porra el home es Brasil → sign correcto '1'.
  const out = buildIaSignByLegacyKey(
    [{ match_id: 'wc2026_gC_15186861', sign: '2', home_code: 'SCO' }],
    WC_ROWS,
  );
  assert.deepEqual(out['C_Brasil_Escocia'], { sign: '1' }, 'sign flipeado a orientación porra');

  // Y el predicate del motor con el sign YA orientado: un usuario que predijo
  // empate (contra el '1' de la IA) y acierta el empate real cobra el bono;
  // uno que predijo '1' como la IA, no.
  assert.equal(iaBonusPredicate(out['C_Brasil_Escocia'], { l: 1, v: 1 }, 0, 0), true,  'contra-IA acertando → bono');
  assert.equal(iaBonusPredicate(out['C_Brasil_Escocia'], { l: 2, v: 0 }, 2, 0), false, 'mismo signo que la IA → sin bono');
});

test('puente — X no se flipa aunque el fixture esté swapped', () => {
  const out = buildIaSignByLegacyKey(
    [{ match_id: 'wc2026_gC_15186861', sign: 'X', home_code: 'SCO' }],
    WC_ROWS,
  );
  assert.deepEqual(out['C_Brasil_Escocia'], { sign: 'X' });
});

test('puente — claves sin entrada en wc_matches (ondemand_* KO) se ignoran', () => {
  const out = buildIaSignByLegacyKey(
    [
      { match_id: 'ondemand_ALG_BEL_2', sign: '2', home_code: 'ALG' },
      { match_id: 'wc2026_gA_15186490', sign: '1', home_code: 'MEX' },
    ],
    WC_ROWS,
  );
  assert.equal(Object.keys(out).length, 1, 'solo la clave de grupos mapea');
  assert.ok(out['A_México_Sudáfrica']);
});

test('puente — filas defectuosas no rompen ni contaminan', () => {
  const out = buildIaSignByLegacyKey(
    [
      { match_id: 'wc2026_gA_15186490', sign: null, home_code: 'MEX' },
      { match_id: null, sign: '1', home_code: 'MEX' },
      { match_id: 'wc2026_gA_15186490', sign: '1', home_code: null }, // sin home_code → sin flip (sign crudo)
    ],
    WC_ROWS,
  );
  assert.deepEqual(out['A_México_Sudáfrica'], { sign: '1' });
  assert.equal(Object.keys(out).length, 1);
});

test('puente — entradas vacías', () => {
  assert.deepEqual(buildIaSignByLegacyKey([], WC_ROWS), {});
  assert.deepEqual(buildIaSignByLegacyKey(null, WC_ROWS), {});
  assert.deepEqual(buildIaSignByLegacyKey([{ match_id: 'wc2026_gA_15186490', sign: '1', home_code: 'MEX' }], []), {});
});
