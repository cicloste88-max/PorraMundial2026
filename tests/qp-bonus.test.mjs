// get-user-predictions v1.2.0 — "Puntos torneo" autoritativo + tile CLASIFICADOS.
//
// (a) calcQualifiedBonus (qp-bonus.mjs): bonus §1.7 clasificados de grupos,
//     espejo del cómputo inline de get-league-standings v1.7.0 —
//     +KO_ROUND_PTS.groups por equipo de R32 predicho (malla resolveBracket)
//     que también es clasificado real (wc_matches_ko slots 73-88). null si el
//     bonus no es liquidable aún (pre-siembra); 0 es legítimo.
// (b) source-asserts de wiring: la cabecera de porra-jugador-v3.js usa el
//     total canónico de user_points_cache (fallback a suma local) y pinta el
//     tile CLASIFICADOS antes del primer tab KO; el EF selecciona
//     user_points_cache y delega el §1.7 en calcQualifiedBonus.
//
// Contexto del bug: la suma local de la cabecera omitía §1.7 y anti-IA KO →
// "Puntos torneo" 270 vs user_points_cache.total_pts 415 (luisalvarez15 /
// GALLOS, pre-octavos). El usuario veía #1 con 270 aquí y 415 en Clasificación.

import assert from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { GRUPOS } from '../supabase/functions/_shared/ko-data.mjs';
import { KO_ROUND_PTS } from '../supabase/functions/_shared/scoring.mjs';
import { resolveBracket } from '../supabase/functions/_shared/ko-bracket.mjs';
import { calcQualifiedBonus } from '../supabase/functions/get-user-predictions/qp-bonus.mjs';

// Fixture determinista (patrón ko-bracket.test.mjs): en cada grupo t0 gana
// 3-0, t1 2-0, t2 1-0 → 1X=equipos[0], 2X=equipos[1], 3X=equipos[2]; mejores
// terceros = grupos A..H.
const PAIRINGS = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]];
function buildPredictionRows() {
  const rows = [];
  GRUPOS.forEach((g) => {
    PAIRINGS.forEach(([hi, ai]) => {
      rows.push({
        match_id: `${g.letra}_${g.equipos[hi]}_${g.equipos[ai]}`,
        local: hi === 0 ? 3 : hi === 1 ? 2 : 1,
        visitante: 0,
      });
    });
  });
  return rows;
}
const PRED_ROWS = buildPredictionRows();

// Puente ES → iso3 sintético (consistente entre wcRows y wcKoRows): X01..X48.
const ISO_BY_NAME = {};
GRUPOS.forEach((g, gi) => g.equipos.forEach((name, ti) => {
  ISO_BY_NAME[name] = 'X' + String(gi * 4 + ti + 1).padStart(2, '0');
}));
const WC_ROWS = PRED_ROWS.map((r) => {
  const [, home, away] = r.match_id.split('_');
  return { home_es: home, away_es: away, home_iso3: ISO_BY_NAME[home], away_iso3: ISO_BY_NAME[away] };
});

// wc_matches_ko "real" = la propia malla R32 predicha (predicción perfecta).
function buildRealR32FromPrediction() {
  const { slots } = resolveBracket(PRED_ROWS, []);
  const rows = [];
  for (let s = 73; s <= 88; s++) {
    rows.push({ ko_match_id: s, home_iso3: ISO_BY_NAME[slots[s].home], away_iso3: ISO_BY_NAME[slots[s].away] });
  }
  return rows;
}

test('§1.7: predicción perfecta → 32 aciertos × groups (5) = 160', () => {
  const qp = calcQualifiedBonus(PRED_ROWS, [], buildRealR32FromPrediction(), WC_ROWS);
  assert.strictEqual(qp, 32 * KO_ROUND_PTS.groups);
});

test('§1.7: 2 clasificados reales que el usuario NO predijo → 30 × 5 = 150', () => {
  const real = buildRealR32FromPrediction();
  // El usuario nunca clasifica a los 4.º de grupo (equipos[3]) — sustituir los
  // dos equipos del slot 73 por dos cuartos → 2 predichos dejan de acertar.
  real[0] = { ko_match_id: 73, home_iso3: ISO_BY_NAME[GRUPOS[0].equipos[3]], away_iso3: ISO_BY_NAME[GRUPOS[1].equipos[3]] };
  const qp = calcQualifiedBonus(PRED_ROWS, [], real, WC_ROWS);
  assert.strictEqual(qp, 30 * KO_ROUND_PTS.groups);
});

test('§1.7: wc_matches_ko sin sembrar → null (no liquidable, tile oculto)', () => {
  assert.strictEqual(calcQualifiedBonus(PRED_ROWS, [], [], WC_ROWS), null);
  // Solo filas R16+ (89+) tampoco liquida: reales = participantes de R32.
  assert.strictEqual(
    calcQualifiedBonus(PRED_ROWS, [], [{ ko_match_id: 89, home_iso3: 'X01', away_iso3: 'X05' }], WC_ROWS),
    null,
  );
});

test('§1.7: 0 aciertos es 0 (número), NO null', () => {
  // Reales sintéticos = los 32 "cuartos" imposibles (fuera de toda malla
  // predicha): 16 slots con iso3 inventados que no colisionan con X01..X48.
  const real = Array.from({ length: 16 }, (_, i) => ({
    ko_match_id: 73 + i, home_iso3: 'Z' + (i * 2), away_iso3: 'Z' + (i * 2 + 1),
  }));
  assert.strictEqual(calcQualifiedBonus(PRED_ROWS, [], real, WC_ROWS), 0);
});

test('§1.7: sin predicciones de grupos → semántica del motor (24 × 5, sin terceros)', () => {
  // Espejo EXACTO de standings: calcGroupTable siembra la tabla en orden
  // GRUPOS[].equipos aun sin picks → 1X/2X resuelven igualmente (24 equipos);
  // los terceros exigen 6 marcadores rellenos → no aportan. Con el fixture
  // "real = malla del orden de siembra", esos 24 son todos clasificados
  // reales → 24 × groups. Irrelevante en producción (porra cerrada = picks
  // completos), pero fija que NO divergimos del cómputo del motor.
  assert.strictEqual(calcQualifiedBonus([], [], buildRealR32FromPrediction(), WC_ROWS), 24 * KO_ROUND_PTS.groups);
});

// ─── Wiring (source-asserts, patrón bridge-hardening) ───────────────────────

const FRONT_SRC = readFileSync(new URL('../public/js/v3/porra-jugador-v3.js', import.meta.url), 'utf8');
const EF_SRC = readFileSync(new URL('../supabase/functions/get-user-predictions/index.ts', import.meta.url), 'utf8');

test('cabecera: total autoritativo de caché con fallback a suma local', () => {
  assert.match(FRONT_SRC, /var totalPts = \(uc\.cacheTotal != null\) \? uc\.cacheTotal : localPts;/);
  assert.match(FRONT_SRC, /typeof ef\.cache_total === 'number'/);
});

test('tile CLASIFICADOS: se pinta solo con qpPts liquidado, antes del primer tab KO', () => {
  assert.match(FRONT_SRC, /up-tab--qp/);
  assert.match(FRONT_SRC, /Clasificados<\/span><span class="up-tab__s">\+' \+ uc\.qpPts \+ ' pts/);
  assert.match(FRONT_SRC, /if \(uc\.qpPts != null\)/);
  assert.match(FRONT_SRC, /tabParts\.splice\(firstKo, 0, qpTile\)/);
});

test('EF v1.2.0: selecciona user_points_cache y delega §1.7 en calcQualifiedBonus', () => {
  assert.match(EF_SRC, /from\("user_points_cache"\)\.select\("total_pts"\)/);
  assert.match(EF_SRC, /calcQualifiedBonus\(predictions, ko_predictions/);
  assert.match(EF_SRC, /version: "1\.2\.0"/);
});
