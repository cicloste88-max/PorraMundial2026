// Test de paridad Python↔TS (spec §9.2). Gate de merge.
//
// Carga los 46 partidos limpios del WC2022 desde parity_fixture.json
// (generado por docs/fase_e/generate_parity_fixture.py) y verifica que el
// motor TS produce los mismos números que la referencia Python.
//
// Tolerancia: 1e-3 en probabilidades (p_home, p_draw, p_away, p_max, margin).
// Exact match: sign, used_fallback, is_dudoso.
//
// Ejecutar con:
//   deno test --allow-read supabase/functions/porra-ia-compute/tests/backtest_parity.test.ts

import {
  assertAlmostEquals,
  assertEquals,
} from "https://deno.land/std@0.168.0/testing/asserts.ts";

import {
  type EloData,
  type H2HData,
  predict,
  type RachaData,
} from "../lib/predictor.ts";

interface FixtureCase {
  match_id: string;
  stage: string;
  home: string;
  away: string;
  real_goals: { home: number; away: number };
  real_sign: string;
  inputs: {
    elo_home: number;
    elo_away: number;
    h2h: {
      home_wins: number;
      away_wins: number;
      draws: number;
      total: number;
    } | null;
    racha_home: {
      wins: number;
      draws: number;
      losses: number;
      n_matches: number;
    };
    racha_away: {
      wins: number;
      draws: number;
      losses: number;
      n_matches: number;
    };
    is_host_match: boolean;
  };
  expected: {
    p_home: number;
    p_draw: number;
    p_away: number;
    sign: string;
    p_max: number;
    margin: number;
    is_dudoso: boolean;
    used_fallback: boolean;
  };
}

interface Fixture {
  version: string;
  generated_at: string;
  description: string;
  n_cases: number;
  tolerance: {
    probabilities: number;
    p_max: number;
    margin: number;
    sign: string;
    used_fallback: string;
    is_dudoso: string;
  };
  cases: FixtureCase[];
}

// URL relativa a este test file; Deno resuelve contra el fichero TS.
const FIXTURE_PATH = new URL("./parity_fixture.json", import.meta.url);

async function loadFixture(): Promise<Fixture> {
  const text = await Deno.readTextFile(FIXTURE_PATH);
  return JSON.parse(text);
}

Deno.test("parity fixture carga 46 casos con tolerancia 1e-3", async () => {
  const fx = await loadFixture();
  assertEquals(fx.n_cases, 46);
  assertEquals(fx.cases.length, 46);
  assertEquals(fx.tolerance.probabilities, 0.001);
});

Deno.test("paridad Python↔TS sobre 46 casos WC2022", async () => {
  const fx = await loadFixture();
  const tol = fx.tolerance.probabilities; // 1e-3

  const failures: string[] = [];

  for (const c of fx.cases) {
    const elo: EloData = {
      elo_home: c.inputs.elo_home,
      elo_away: c.inputs.elo_away,
      is_host_match: c.inputs.is_host_match,
      home_code: c.home,
    };
    const h2h: H2HData | null = c.inputs.h2h
      ? {
        home_wins: c.inputs.h2h.home_wins,
        away_wins: c.inputs.h2h.away_wins,
        draws: c.inputs.h2h.draws,
        total: c.inputs.h2h.total,
      }
      : null;
    const racha: RachaData = {
      home: c.inputs.racha_home,
      away: c.inputs.racha_away,
    };

    const got = predict(elo, h2h, racha);

    // Exact matches primero (más explícitos en failure).
    if (got.sign !== c.expected.sign) {
      failures.push(
        `${c.match_id}: sign esperado ${c.expected.sign}, obtenido ${got.sign}`,
      );
    }
    if (got.used_fallback !== c.expected.used_fallback) {
      failures.push(
        `${c.match_id}: used_fallback esperado ${c.expected.used_fallback}, obtenido ${got.used_fallback}`,
      );
    }
    if (got.is_dudoso !== c.expected.is_dudoso) {
      failures.push(
        `${c.match_id}: is_dudoso esperado ${c.expected.is_dudoso}, obtenido ${got.is_dudoso}`,
      );
    }

    // Probabilidades dentro de tolerancia.
    const pairs: Array<[string, number, number]> = [
      ["p_home", got.p_home, c.expected.p_home],
      ["p_draw", got.p_draw, c.expected.p_draw],
      ["p_away", got.p_away, c.expected.p_away],
      ["p_max", got.p_max, c.expected.p_max],
      ["margin", got.margin, c.expected.margin],
    ];
    for (const [name, gotVal, expVal] of pairs) {
      if (Math.abs(gotVal - expVal) > tol) {
        failures.push(
          `${c.match_id}: ${name} esperado ${expVal}, obtenido ${gotVal} ` +
            `(Δ=${Math.abs(gotVal - expVal).toExponential(3)}, tol=${tol})`,
        );
      }
    }
  }

  if (failures.length > 0) {
    const head = failures.slice(0, 10).join("\n  ");
    const tail = failures.length > 10
      ? `\n  ... +${failures.length - 10} más`
      : "";
    throw new Error(
      `Paridad rota (${failures.length} fallos):\n  ${head}${tail}`,
    );
  }
});

// Spot-check individual para trazabilidad si el test grande falla.
Deno.test("paridad spot-check QAT vs ECU (fallback activado)", async () => {
  const fx = await loadFixture();
  const c = fx.cases.find((x) => x.match_id === "wc2022_ga_QAT_ECU");
  if (!c) throw new Error("case QAT_ECU no encontrado en fixture");

  const got = predict(
    {
      elo_home: c.inputs.elo_home,
      elo_away: c.inputs.elo_away,
      is_host_match: c.inputs.is_host_match,
      home_code: c.home,
    },
    c.inputs.h2h,
    { home: c.inputs.racha_home, away: c.inputs.racha_away },
  );

  assertEquals(got.sign, c.expected.sign);
  assertEquals(got.used_fallback, c.expected.used_fallback);
  assertAlmostEquals(got.p_home, c.expected.p_home, 1e-3);
  assertAlmostEquals(got.p_draw, c.expected.p_draw, 1e-3);
  assertAlmostEquals(got.p_away, c.expected.p_away, 1e-3);
});
