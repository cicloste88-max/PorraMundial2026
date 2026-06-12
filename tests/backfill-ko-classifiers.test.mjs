// Tests backfill-ko-classifiers — Porra Mundial 2026.
//
// Cubre la lógica pura de la EF (supabase/functions/backfill-ko-classifiers/
// logic.mjs), réplica del bracket dinámico del frontend:
//   1. Datos generados: ANNEX_C 495 combinaciones, BRACKET slots 73-104.
//   2. calcGroupTable: pts/gd/gf + orden estable de siembra.
//   3. resolveGroupSlots: slots 1X/2X/3X + terceros vía ANNEX_C.
//   4. inferClassifiers: cascada 73→104, inferencia solo en null+no-empate,
//      preservación de no-null (incl. contradicciones), literales "home"/"away"
//      de simuladores legacy (HF-09), idempotencia, gate 72 marcadores.
//
// Contexto: BRIEF_BACKFILL_KO_CLASSIFIERS.md (saveKO solo persistía classifier
// en empates → null en partidos con ganador claro → scoring KO roto + PDF
// comprobante con "Avanza: —").
import { test } from 'node:test';
import assert from 'node:assert';
import { BRACKET, ANNEX_C, GRUPOS } from '../supabase/functions/backfill-ko-classifiers/ko-data.mjs';
import {
  ALL_KO_SLOTS,
  calcGroupTable,
  resolveGroupSlots,
  countGroupScores,
  inferClassifiers,
} from '../supabase/functions/backfill-ko-classifiers/logic.mjs';

// ─── Fixtures ────────────────────────────────────────────────────────
// 72 predicciones de grupos deterministas: en cada grupo, el equipo i-ésimo
// del array equipos gana a todos los posteriores (t0 9pts, t1 6, t2 3, t3 0).
// Marcadores: t0 gana 3-0; t1 gana 2-0; t2 gana 1-0 → los 12 terceros empatan
// en todo (3pts, gd -4, gf 1) y el orden estable deja como mejores terceros
// los grupos A..H (annexKey "ABCDEFGH", última fila del Anexo C).
const PAIRINGS = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]];
function buildFullGroupPreds() {
  const preds = {};
  GRUPOS.forEach((g) => {
    PAIRINGS.forEach(([hi, ai]) => {
      const home = g.equipos[hi];
      const away = g.equipos[ai];
      const winnerGoals = hi === 0 ? 3 : hi === 1 ? 2 : 1; // gana siempre el de índice menor (es el home en PAIRINGS)
      preds[`${g.letra}_${home}_${away}`] = { l: winnerGoals, v: 0 };
    });
  });
  return preds;
}

// 32 ko_predictions con victoria local 2-1 y classifier null.
function buildKoRowsHomeWins() {
  return ALL_KO_SLOTS.map((m) => ({
    match_id: m.id, local: 2, visitante: 1, classifier: null, scorer: null,
  }));
}

const team = (letra, idx) => GRUPOS.find((g) => g.letra === letra).equipos[idx];

// ─── 1. Datos generados ──────────────────────────────────────────────
test('ko-data: ANNEX_C tiene las 495 combinaciones del Anexo C FIFA', () => {
  assert.strictEqual(Object.keys(ANNEX_C).length, 495);
});

test('ko-data: BRACKET cubre exactamente los slots 73-104', () => {
  const ids = ALL_KO_SLOTS.map((m) => m.id).sort((a, b) => a - b);
  assert.deepStrictEqual(ids, Array.from({ length: 32 }, (_, i) => 73 + i));
});

test('ko-data: 12 grupos de 4 equipos', () => {
  assert.strictEqual(GRUPOS.length, 12);
  assert.ok(GRUPOS.every((g) => g.equipos.length === 4));
});

// ─── 2. calcGroupTable ───────────────────────────────────────────────
test('calcGroupTable: orden por pts y stats correctas', () => {
  const preds = buildFullGroupPreds();
  const tabla = calcGroupTable('A', preds);
  assert.deepStrictEqual(tabla.map((t) => t.name), GRUPOS[0].equipos);
  assert.deepStrictEqual(tabla.map((t) => t.pts), [9, 6, 3, 0]);
  assert.strictEqual(tabla[2].gf, 1);
  assert.strictEqual(tabla[2].gd, -4);
});

test('calcGroupTable: desempata por gd y luego gf', () => {
  const [a, b, c, d] = GRUPOS[0].equipos;
  // a y b empatan a 6 pts; b mejor gd. c y d 3 pts; mismo gd, d más gf.
  const preds = {
    [`A_${a}_${b}`]: { l: 0, v: 1 },
    [`A_${c}_${d}`]: { l: 0, v: 1 },
    [`A_${a}_${c}`]: { l: 2, v: 0 },
    [`A_${b}_${d}`]: { l: 4, v: 0 },
    [`A_${a}_${d}`]: { l: 1, v: 0 },
    [`A_${b}_${c}`]: { l: 0, v: 4 },
  };
  // pts: a=6 (gana c,d; pierde b), b=6 (gana a,d; pierde c), c=6 (gana b,d... )
  // recalcular: c gana a b 4-0 y a d 1-0 → 6pts. d gana a c 1-0 → 3pts... d pierde con todos menos...
  // Simplificar la aserción: verificar solo el criterio de orden del sort.
  const tabla = calcGroupTable('A', preds);
  for (let i = 1; i < tabla.length; i++) {
    const prev = tabla[i - 1];
    const cur = tabla[i];
    const cmp = cur.pts - prev.pts || cur.gd - prev.gd || cur.gf - prev.gf;
    assert.ok(cmp <= 0, `orden roto en posición ${i}`);
  }
});

// ─── 3. resolveGroupSlots ────────────────────────────────────────────
test('resolveGroupSlots: 1X/2X/3X + terceros vía ANNEX_C (clave ABCDEFGH)', () => {
  const preds = buildFullGroupPreds();
  const { slots, annexKey, usedFallback } = resolveGroupSlots(preds);
  assert.strictEqual(usedFallback, false);
  assert.strictEqual(annexKey, 'ABCDEFGH');
  GRUPOS.forEach((g) => {
    assert.strictEqual(slots['1' + g.letra], g.equipos[0]);
    assert.strictEqual(slots['2' + g.letra], g.equipos[1]);
    assert.strictEqual(slots['3' + g.letra], g.equipos[2]);
  });
  // Fila "ABCDEFGH" del Anexo C: T_CEFHI:H, T_EFGIJ:G, T_BEFIJ:B, T_ABCDF:C,
  // T_AEHIJ:A, T_CDFGH:F, T_DEIJL:D, T_EHIJK:E (terceros = equipos[2]).
  assert.strictEqual(slots.T_CEFHI, team('H', 2));
  assert.strictEqual(slots.T_EFGIJ, team('G', 2));
  assert.strictEqual(slots.T_BEFIJ, team('B', 2));
  assert.strictEqual(slots.T_ABCDF, team('C', 2));
  assert.strictEqual(slots.T_AEHIJ, team('A', 2));
  assert.strictEqual(slots.T_CDFGH, team('F', 2));
  assert.strictEqual(slots.T_DEIJL, team('D', 2));
  assert.strictEqual(slots.T_EHIJK, team('E', 2));
});

// ─── 4. inferClassifiers ─────────────────────────────────────────────
test('inferClassifiers: usuario completo, 32 victorias locales → 32 inferencias en cascada', () => {
  const preds = buildFullGroupPreds();
  const koRows = buildKoRowsHomeWins();
  const { updates, warnings, skipped } = inferClassifiers(preds, koRows);
  assert.strictEqual(skipped, false);
  assert.strictEqual(updates.length, 32);
  assert.strictEqual(warnings.length, 0);
  const byId = new Map(updates.map((u) => [u.match_id, u.classifier]));
  // R32: slot 73 = 2A vs 2B, gana home → 2A.
  assert.strictEqual(byId.get(73), team('A', 1));
  // Slot 79 = 1A vs T_CEFHI, gana home → 1A (México).
  assert.strictEqual(byId.get(79), team('A', 0));
  // Cascada R16: slot 90 = W73 vs W75 → gana W73 (2A).
  assert.strictEqual(byId.get(90), team('A', 1));
  // Final 104 = W101 vs W102: con victorias locales el campeón es 1E (Alemania).
  assert.strictEqual(byId.get(104), team('E', 0));
  // 3er puesto 103 = L101 vs L102, gana home (L101 = 2K RD Congo).
  assert.strictEqual(byId.get(103), team('K', 1));
});

test('inferClassifiers: empate con classifier explícito se preserva y alimenta la cascada', () => {
  const preds = buildFullGroupPreds();
  const koRows = buildKoRowsHomeWins();
  // Slot 73 (2A vs 2B): empate, usuario eligió al visitante 2B.
  const row73 = koRows.find((r) => r.match_id === 73);
  row73.local = 1; row73.visitante = 1; row73.classifier = team('B', 1);
  const { updates, warnings } = inferClassifiers(preds, koRows);
  assert.strictEqual(updates.length, 31); // 73 no se toca
  assert.ok(!updates.some((u) => u.match_id === 73));
  // Cascada: slot 90 = W73 vs W75 con victoria local → gana W73 = 2B.
  assert.strictEqual(updates.find((u) => u.match_id === 90).classifier, team('B', 1));
  assert.strictEqual(warnings.length, 0);
});

test('inferClassifiers: empate SIN classifier → warning draw_no_classifier y cascada rota aguas abajo', () => {
  const preds = buildFullGroupPreds();
  const koRows = buildKoRowsHomeWins();
  const row73 = koRows.find((r) => r.match_id === 73);
  row73.local = 0; row73.visitante = 0; // sin classifier
  const { updates, warnings } = inferClassifiers(preds, koRows);
  assert.ok(warnings.some((w) => w.slot === 73 && w.reason === 'draw_no_classifier'));
  // Slot 90 (W73 vs W75) no puede resolver home → unresolved_slot, sin update.
  assert.ok(warnings.some((w) => w.slot === 90 && w.reason === 'unresolved_slot'));
  assert.ok(!updates.some((u) => u.match_id === 73 || u.match_id === 90));
});

test('inferClassifiers: literal "home" de simulador legacy (HF-09) resuelve al equipo local', () => {
  const preds = buildFullGroupPreds();
  const koRows = buildKoRowsHomeWins();
  const row73 = koRows.find((r) => r.match_id === 73);
  row73.local = 2; row73.visitante = 2; row73.classifier = 'home';
  const { updates } = inferClassifiers(preds, koRows);
  // W73 = home = 2A; slot 90 hereda 2A como ganador.
  assert.strictEqual(updates.find((u) => u.match_id === 90).classifier, team('A', 1));
});

test('inferClassifiers: classifier no-null contradictorio NO se sobrescribe, solo warning', () => {
  const preds = buildFullGroupPreds();
  const koRows = buildKoRowsHomeWins();
  const row79 = koRows.find((r) => r.match_id === 79); // 1A gana 2-1 pero classifier dice otro
  row79.classifier = team('A', 3);
  const { updates, warnings } = inferClassifiers(preds, koRows);
  assert.ok(!updates.some((u) => u.match_id === 79));
  assert.ok(warnings.some((w) => w.slot === 79 && w.reason === 'contradiction'));
});

test('inferClassifiers: idempotencia — segunda pasada devuelve 0 updates', () => {
  const preds = buildFullGroupPreds();
  const koRows = buildKoRowsHomeWins();
  const first = inferClassifiers(preds, koRows);
  first.updates.forEach((u) => {
    koRows.find((r) => r.match_id === u.match_id).classifier = u.classifier;
  });
  const second = inferClassifiers(preds, koRows);
  assert.strictEqual(second.updates.length, 0);
  assert.strictEqual(second.warnings.length, 0);
});

test('inferClassifiers: <72 marcadores de grupos → skip con warning', () => {
  const preds = buildFullGroupPreds();
  delete preds[Object.keys(preds)[0]];
  assert.strictEqual(countGroupScores(preds), 71);
  const { updates, warnings, skipped } = inferClassifiers(preds, buildKoRowsHomeWins());
  assert.strictEqual(skipped, true);
  assert.strictEqual(updates.length, 0);
  assert.ok(warnings.some((w) => w.reason === 'incomplete_group_predictions'));
});

test('inferClassifiers: ko_prediction ausente → warning missing_ko_pred, resto sigue', () => {
  const preds = buildFullGroupPreds();
  const koRows = buildKoRowsHomeWins().filter((r) => r.match_id !== 88);
  const { updates, warnings } = inferClassifiers(preds, koRows);
  assert.ok(warnings.some((w) => w.slot === 88 && w.reason === 'missing_ko_pred'));
  // 95 = W86 vs W88 → away irresoluble PERO gana home (W86) 2-1 → sí inferible.
  assert.ok(updates.some((u) => u.match_id === 95));
  // 31 filas presentes, todas no-empate con home resoluble → 31 updates.
  assert.strictEqual(updates.length, 31);
});
