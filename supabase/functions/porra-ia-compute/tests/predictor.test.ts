// Tests unitarios del predictor (spec §9.1). Deno built-in test runner.
// Ejecutar localmente o en CI con:
//   deno test supabase/functions/porra-ia-compute/tests/predictor.test.ts
//
// Cobertura: 13 assertions mínimas sobre invariantes del motor.

import {
  assert,
  assertAlmostEquals,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

import {
  type EloData,
  type H2HData,
  predict,
  PREDICTOR_CONFIG,
  type RachaData,
  softmax,
} from "../lib/predictor.ts";

const EQUAL_FORM = {
  wins: 5,
  draws: 2,
  losses: 1,
  n_matches: 8,
};

function makeElo(params: Partial<EloData> = {}): EloData {
  return {
    elo_home: 1700,
    elo_away: 1700,
    is_host_match: false,
    home_code: "ESP",
    ...params,
  };
}

function makeRacha(h: typeof EQUAL_FORM, a: typeof EQUAL_FORM): RachaData {
  return { home: h, away: a };
}

// ─── softmax ────────────────────────────────────────────────────────────────

Deno.test("softmax([0,0,0]) devuelve [1/3, 1/3, 1/3]", () => {
  const p = softmax([0, 0, 0]);
  assertAlmostEquals(p[0], 1 / 3, 1e-9);
  assertAlmostEquals(p[1], 1 / 3, 1e-9);
  assertAlmostEquals(p[2], 1 / 3, 1e-9);
});

Deno.test("softmax suma exactamente 1.0 ± 1e-9 para inputs arbitrarios", () => {
  const cases = [
    [1.0, 0.5, -0.5],
    [10, 0, -10],
    [-5, -5, -5],
    [0.1, 0.2, 0.3],
  ];
  for (const scores of cases) {
    const p = softmax(scores);
    const sum = p.reduce((acc, v) => acc + v, 0);
    assertAlmostEquals(sum, 1.0, 1e-9);
  }
});

// ─── predict: invariantes básicas ──────────────────────────────────────────

Deno.test("predict con ELOs iguales + racha igual + sin H2H → sign === X", () => {
  const p = predict(
    makeElo({ elo_home: 1700, elo_away: 1700 }),
    null,
    makeRacha(EQUAL_FORM, EQUAL_FORM),
  );
  // Con fuerzas totalmente simétricas y sin H2H, empate debe ser el argmax.
  assertEquals(p.sign, "X");
});

Deno.test("predict con ELO home +400 sin H2H → p_home > 0.90", () => {
  const p = predict(
    makeElo({ elo_home: 2100, elo_away: 1700 }),
    null,
    makeRacha(EQUAL_FORM, EQUAL_FORM),
  );
  assert(
    p.p_home > 0.90,
    `p_home esperado >0.90, obtenido ${p.p_home}`,
  );
  assertEquals(p.sign, "1");
});

Deno.test("predict con ELO away +400 sin H2H → p_away > 0.90", () => {
  const p = predict(
    makeElo({ elo_home: 1700, elo_away: 2100 }),
    null,
    makeRacha(EQUAL_FORM, EQUAL_FORM),
  );
  assert(
    p.p_away > 0.90,
    `p_away esperado >0.90, obtenido ${p.p_away}`,
  );
  assertEquals(p.sign, "2");
});

Deno.test("predict con h2h null → used_fallback === true", () => {
  const p = predict(
    makeElo(),
    null,
    makeRacha(EQUAL_FORM, EQUAL_FORM),
  );
  assertEquals(p.used_fallback, true);
});

Deno.test("predict con h2h.total=3 (<5) → used_fallback === true", () => {
  const h2h: H2HData = { home_wins: 1, away_wins: 2, draws: 0, total: 3 };
  const p = predict(
    makeElo(),
    h2h,
    makeRacha(EQUAL_FORM, EQUAL_FORM),
  );
  assertEquals(p.used_fallback, true);
});

Deno.test("predict con h2h.total=5 → used_fallback === false", () => {
  const h2h: H2HData = { home_wins: 2, away_wins: 2, draws: 1, total: 5 };
  const p = predict(
    makeElo(),
    h2h,
    makeRacha(EQUAL_FORM, EQUAL_FORM),
  );
  assertEquals(p.used_fallback, false);
});

// ─── Home advantage ────────────────────────────────────────────────────────

Deno.test("is_host_match=true para MEX aplica +95 (altitud)", () => {
  const p = predict(
    makeElo({ elo_home: 1700, elo_away: 1700, is_host_match: true, home_code: "MEX" }),
    null,
    makeRacha(EQUAL_FORM, EQUAL_FORM),
  );
  assertEquals(
    p.breakdown.home_advantage,
    PREDICTOR_CONFIG.HOME_ADVANTAGE_ALTITUDE,
  );
});

Deno.test("is_host_match=true para USA aplica +85 (base)", () => {
  const p = predict(
    makeElo({ elo_home: 1700, elo_away: 1700, is_host_match: true, home_code: "USA" }),
    null,
    makeRacha(EQUAL_FORM, EQUAL_FORM),
  );
  assertEquals(
    p.breakdown.home_advantage,
    PREDICTOR_CONFIG.HOME_ADVANTAGE_BASE,
  );
});

Deno.test("is_host_match=false → home_advantage = 0", () => {
  const p = predict(
    makeElo({ elo_home: 1700, elo_away: 1700, is_host_match: false, home_code: "MEX" }),
    null,
    makeRacha(EQUAL_FORM, EQUAL_FORM),
  );
  assertEquals(p.breakdown.home_advantage, 0);
});

// ─── Margen / dudoso ───────────────────────────────────────────────────────

Deno.test("margen < 0.08 → is_dudoso === true", () => {
  // Fuerzas casi iguales: ELO diff 10, racha igual, no H2H → margen pequeño.
  const p = predict(
    makeElo({ elo_home: 1700, elo_away: 1690 }),
    null,
    makeRacha(EQUAL_FORM, EQUAL_FORM),
  );
  assert(
    p.margin < PREDICTOR_CONFIG.MARGIN_DUDOSO,
    `margin esperado <0.08, obtenido ${p.margin}`,
  );
  assertEquals(p.is_dudoso, true);
});

// ─── Sign consistency ──────────────────────────────────────────────────────

Deno.test("sign === 1 si p_home > p_draw && p_home > p_away", () => {
  const p = predict(
    makeElo({ elo_home: 2000, elo_away: 1500 }),
    null,
    makeRacha(EQUAL_FORM, EQUAL_FORM),
  );
  assert(p.p_home > p.p_draw);
  assert(p.p_home > p.p_away);
  assertEquals(p.sign, "1");
});

// ─── Probabilidades suman 1 ────────────────────────────────────────────────

Deno.test("p_home + p_draw + p_away === 1.0 ± 1e-9 siempre", () => {
  const cases: EloData[] = [
    makeElo({ elo_home: 1500, elo_away: 1900 }),
    makeElo({ elo_home: 2100, elo_away: 1600, is_host_match: true, home_code: "MEX" }),
    makeElo({ elo_home: 1700, elo_away: 1700 }),
    makeElo({ elo_home: 1800, elo_away: 1600, is_host_match: true, home_code: "CAN" }),
  ];
  for (const elo of cases) {
    const p = predict(elo, null, makeRacha(EQUAL_FORM, EQUAL_FORM));
    const sum = p.p_home + p.p_draw + p.p_away;
    assertAlmostEquals(
      sum,
      1.0,
      1e-9,
      `caso ${elo.home_code} elos ${elo.elo_home}/${elo.elo_away}: sum=${sum}`,
    );
  }
});
