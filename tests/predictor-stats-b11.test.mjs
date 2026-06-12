// Item 7 post-J1 (mini-sprint B11) — Predictor tile sin cablear.
//
// Síntomas: PUNTOS TORNEO 0 (leía el global legacy `totalPoints`, muerto
// contra PARTIDOS.realHome 0-0); Liga #1 hardcodeado para todos; Global #N
// por fecha de registro (vista stub); % aciertos / racha / bonus IA vacíos
// (helpers B3 sin invocar, y _computeAciertos no era espejo del motor: no
// sumaba el +1 de signo simple y usaba max 5/6 en vez de 6/7 cap 7).
//
// Fix testeado aquí (frontend; las vistas SQL se verificaron en runtime):
//   1. _computeAciertos reescrito espejo del motor: +1 signo, +3 exacto,
//      +2 goleador, +1 vsIA, cap 7; max 6 (o 7 si el bono IA era alcanzable);
//      boost ×2 FUERA. Parity contra _shared/scoring.mjs.
//   2. _resolvePlayedPredictions: predictions × match_results canónicos
//      (window._matchResultsByKey), orden cronológico ASC, regla 0-0.
//   3. Wiring guards: tile lee ranking.totalPts (user_points_cache), stats
//      cableadas, data.js usa total_count (Zayu cuenta) + vistas nuevas,
//      updateGlobalPoints ya no puntúa contra los 0-0 estáticos.

import assert from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { calcMatchPoints as sharedCalcMatchPoints } from '../supabase/functions/_shared/scoring.mjs';

const SHELL_SRC = readFileSync(new URL('../public/js/ui-pred-shell.js', import.meta.url), 'utf8');
const DATA_SRC = readFileSync(new URL('../public/js/data.js', import.meta.url), 'utf8');
const SCORING_SRC = readFileSync(new URL('../public/js/scoring.js', import.meta.url), 'utf8');
const MIGRATION_SRC = readFileSync(new URL('../supabase/migrations/20260612001000_b11_user_points_cache.sql', import.meta.url), 'utf8');

function extractFn(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start > -1, `función ${name} no encontrada`);
  const end = src.indexOf('\n  }', start);
  return src.slice(start, end + 4);
}

const helpersFactory = new Function(`
  ${extractFn(SHELL_SRC, '_computeAciertos')}
  ${extractFn(SHELL_SRC, '_computeStreak')}
  return { _computeAciertos, _computeStreak };
`);
const { _computeAciertos, _computeStreak } = helpersFactory();

test('_computeAciertos espejo del motor: signo 1/6, exacto+gol 6/6, todo+IA 7/7 (cap)', () => {
  assert.deepStrictEqual(
    _computeAciertos([{ signCorrect: true, exactCorrect: false, scorerCorrect: false, iaDistinct: false, iaBonus: false }]),
    { pts: 1, max: 6, pct: 17 },
  );
  assert.deepStrictEqual(
    _computeAciertos([{ signCorrect: true, exactCorrect: true, scorerCorrect: true, iaDistinct: false, iaBonus: false }]),
    { pts: 6, max: 6, pct: 100 },
  );
  // 1+3+2+1 = 7, cap 7, máximo alcanzable 7 (IA distinta disponible).
  assert.deepStrictEqual(
    _computeAciertos([{ signCorrect: true, exactCorrect: true, scorerCorrect: true, iaDistinct: true, iaBonus: true }]),
    { pts: 7, max: 7, pct: 100 },
  );
  // IA distinta disponible pero fallada: el max sube a 7 igualmente.
  assert.deepStrictEqual(
    _computeAciertos([{ signCorrect: false, exactCorrect: false, scorerCorrect: false, iaDistinct: true, iaBonus: false }]),
    { pts: 0, max: 7, pct: 0 },
  );
  assert.deepStrictEqual(_computeAciertos([]), { pts: 0, max: 0, pct: null });
});

test('parity con _shared/scoring.mjs (sin boost): los pts por partido coinciden con el motor', () => {
  // pred 2-1 gol Quinones, real 2-0 [Quinones, Jimenez] → motor 3 (signo+gol).
  const motorPts = sharedCalcMatchPoints(
    { saved: true, l: 2, v: 1, gol: 'Quinones' }, 2, 0, { scorers: ['Quinones', 'Jimenez'] },
  );
  const stats = _computeAciertos([{ signCorrect: true, exactCorrect: false, scorerCorrect: true, iaDistinct: false, iaBonus: false }]);
  assert.strictEqual(stats.pts, motorPts);
  assert.strictEqual(stats.pts, 3);
});

test('_computeStreak: consecutivos con signo desde el último hacia atrás', () => {
  const mk = (s) => ({ signCorrect: s });
  assert.strictEqual(_computeStreak([mk(true), mk(true), mk(false), mk(true), mk(true)]), 2);
  assert.strictEqual(_computeStreak([mk(false)]), 0);
  assert.strictEqual(_computeStreak([mk(true)]), 1);
});

// ─── _resolvePlayedPredictions con el código REAL ───

const resolveFactory = new Function(
  'window', 'PARTIDOS', 'predictions', 'getMatchKey', 'iaPredictions', 'iaBonusWillApply',
  `${extractFn(SHELL_SRC, '_resolvePlayedPredictions')}
   return _resolvePlayedPredictions;`,
);

const P_MEX = { group: 'A', home: 'México', away: 'Sudáfrica', date: '2026-06-11T19:00' };
const P_KOR = { group: 'A', home: 'República de Corea', away: 'República Checa', date: '2026-06-12T02:00' };
const KEY = (m) => m.group + '_' + m.home + '_' + m.away;

test('_resolvePlayedPredictions: solo jugados con pronóstico, orden ASC, flags del motor', () => {
  const mr = { 'A_México_Sudáfrica': { l: 2, v: 0, scorers: ['Quinones', 'Jimenez'], status: 'finished' } };
  const preds = { 'A_México_Sudáfrica': { l: 2, v: 1, gol: 'Quinones', saved: true } };
  const ia = { 'A_México_Sudáfrica': { sign: '1' } };
  const resolve = resolveFactory(
    { _matchResultsByKey: mr },
    [P_KOR, P_MEX],            // desordenados a propósito
    preds,
    KEY,
    ia,
    (key, pred, l, v) => false, // misma señal que el motor: signo igual a IA → sin bono
  );
  const out = resolve();
  assert.strictEqual(out.length, 1); // KOR sin resultado → fuera
  assert.strictEqual(out[0].matchKey, 'A_México_Sudáfrica');
  assert.strictEqual(out[0].signCorrect, true);
  assert.strictEqual(out[0].exactCorrect, false);
  assert.strictEqual(out[0].scorerCorrect, true);  // scorers canónicos del bridge
  assert.strictEqual(out[0].iaDistinct, false);    // user 1 == ia 1
  assert.strictEqual(out[0].iaBonus, false);
});

test('_resolvePlayedPredictions: regla 0-0 (sin goleador apostado, 0-0 clavado paga)', () => {
  const mr = { 'A_México_Sudáfrica': { l: 0, v: 0, scorers: [], status: 'finished' } };
  const preds = { 'A_México_Sudáfrica': { l: 0, v: 0, gol: null, saved: true } };
  const resolve = resolveFactory({ _matchResultsByKey: mr }, [P_MEX], preds, KEY, {}, () => false);
  assert.strictEqual(resolve()[0].scorerCorrect, true);
});

test('_resolvePlayedPredictions: partido jugado SIN pronóstico no entra en el %', () => {
  const mr = { 'A_México_Sudáfrica': { l: 2, v: 0, scorers: [], status: 'finished' } };
  const resolve = resolveFactory({ _matchResultsByKey: mr }, [P_MEX], {}, KEY, {}, () => false);
  assert.strictEqual(resolve().length, 0);
});

// ─── Wiring guards ───

test('wiring tile: pts del torneo desde ranking.totalPts (user_points_cache), no del legacy totalPoints', () => {
  assert.match(SHELL_SRC, /var totalPts = ranking \? Number\(ranking\.totalPts \|\| 0\) : 0;/);
  assert.ok(!SHELL_SRC.includes("(typeof totalPoints === 'number') ? totalPoints : 0"));
});

test('wiring stats: aciertosPct/racha/bonusIa cableados (fuera los null/0 hardcodeados)', () => {
  assert.match(SHELL_SRC, /aciertosPct: aciertos\.pct/);
  assert.match(SHELL_SRC, /racha: resolved\.length \? rachaVal : null/);
  assert.match(SHELL_SRC, /bonusIa: bonusIaCount/);
  assert.ok(SHELL_SRC.includes('title="Puntos conseguidos sobre el máximo posible'));
});

test('wiring data.js: leagueRank real de v_league_rank, global por (user,league), Zayu en denominador', () => {
  assert.ok(DATA_SRC.includes("from('v_league_rank')"));
  assert.match(DATA_SRC, /total_count \|\| leagueData\.human_count/);
  assert.ok(!DATA_SRC.includes('memberCount > 0 ? 1 : 0'));
  const globalFn = DATA_SRC.slice(DATA_SRC.indexOf('async function loadGlobalRank'), DATA_SRC.indexOf('async function loadPredictorRankingData'));
  assert.ok(globalFn.includes(".eq('league_id', leagueId)"));
});

test('wiring scoring.js: updateGlobalPoints puntúa contra match_results canónicos, no contra los 0-0 estáticos', () => {
  const fn = SCORING_SRC.slice(SCORING_SRC.indexOf('function updateGlobalPoints'), SCORING_SRC.indexOf('/* ══ DETECCIÓN CROMÁTICA'));
  assert.ok(fn.includes('window._matchResultsByKey'));
  assert.ok(!fn.includes('m.realHome'));
  assert.ok(fn.includes('real.l != null && real.v != null'));
});

test('migración B11: policy SELECT authenticated + sin policies de escritura + vistas security_invoker', () => {
  assert.ok(MIGRATION_SRC.includes('drop policy if exists user_points_cache_select_auth'));
  assert.ok(MIGRATION_SRC.includes('for select to authenticated using (true)'));
  assert.ok(!/for (insert|update|delete)/i.test(MIGRATION_SRC));
  assert.strictEqual((MIGRATION_SRC.match(/security_invoker = on/g) || []).length, 2);
  assert.ok(MIGRATION_SRC.includes('rank() over (partition by league_id order by total_pts desc)'));
});
