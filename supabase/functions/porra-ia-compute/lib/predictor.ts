// Motor IA predictor — Fase E.
//
// Port 1:1 de docs/fase_e/predictor.py. Pure functions, sin I/O, sin deps.
// Testeable en aislamiento. El test de paridad tests/backtest_parity.test.ts
// garantiza que este módulo produce los mismos números que la referencia Python
// sobre los 46 partidos limpios WC2022 (tolerancia 1e-3 en probs, exact en sign).
//
// Arquitectura: log-odds + softmax (sin clamp, sin multiplicadores mágicos).
//
// Decisiones cerradas (spec §5.1):
//   - Pesos default: ELO 75% / H2H 10% / Racha 15%
//   - Fallback sin H2H (min_sample=5): ELO 85% / Racha 15%
//   - Home advantage: +85 base, +95 México (altitud)
//   - sign = argmax(p_home, p_draw, p_away)
//   - confidence = {p_max, margin} con margin = p_max - p_second_max
//   - flag "partido dudoso" si margin < 0.08

// ─── Tipos ──────────────────────────────────────────────────────────────────

export interface Weights {
  elo: number;
  h2h: number;
  racha: number;
}

export interface EloData {
  elo_home: number;
  elo_away: number;
  is_host_match: boolean; // home es host Y juega en casa
  home_code: string; // para detectar altitud México
}

export interface H2HData {
  home_wins: number;
  away_wins: number;
  draws: number;
  total: number;
}

export interface TeamForm {
  wins: number;
  draws: number;
  losses: number;
  n_matches: number;
}

export interface RachaData {
  home: TeamForm;
  away: TeamForm;
}

export interface Prediction {
  p_home: number;
  p_draw: number;
  p_away: number;
  sign: "1" | "X" | "2";
  p_max: number;
  margin: number;
  is_dudoso: boolean;
  used_fallback: boolean;
  breakdown: {
    elo_signal: number;
    h2h_signal: number;
    racha_signal: number;
    draw_score: number;
    home_advantage: number;
    weights_used: Weights;
    scores: { home: number; draw: number; away: number };
  };
}

// ─── Configuración ──────────────────────────────────────────────────────────

export const PREDICTOR_CONFIG = {
  ELO_DIVISOR: 400,
  H2H_MIN_SAMPLE: 5,
  HOME_ADVANTAGE_BASE: 85,
  HOME_ADVANTAGE_ALTITUDE: 95,
  HOST_COUNTRIES: new Set(["MEX", "USA", "CAN"]),
  ALTITUDE_HOSTS: new Set(["MEX"]),
  MARGIN_DUDOSO: 0.08,
  WEIGHTS_DEFAULT: { elo: 0.75, h2h: 0.10, racha: 0.15 } as Weights,
  WEIGHTS_FALLBACK: { elo: 0.85, h2h: 0.00, racha: 0.15 } as Weights,
  DRAW_BASE: 0.20,
  DRAW_POW: 1.5,
  DRAW_DIVISOR: 200,
  H2H_SCALE: 2.0,   // escala h2h_signal a log-odds
  RACHA_SCALE: 0.5, // escala racha_signal a log-odds
} as const;

// Igualdad por valor para comparar pesos (Python usa == sobre dataclasses frozen).
function weightsEqual(a: Weights, b: Weights): boolean {
  return a.elo === b.elo && a.h2h === b.h2h && a.racha === b.racha;
}

// ─── Helpers matemáticos ────────────────────────────────────────────────────

// Softmax numéricamente estable. Resta el max antes de exponenciar (igual que Python).
export function softmax(scores: number[]): number[] {
  const maxScore = Math.max(...scores);
  const expScores = scores.map((s) => Math.exp(s - maxScore));
  const total = expScores.reduce((acc, v) => acc + v, 0);
  return expScores.map((e) => e / total);
}

// ─── Componentes de la predicción ───────────────────────────────────────────

// Señal ELO en log-odds: (ELO_home + home_adv − ELO_away) / 400.
export function eloSignal(
  eloHome: number,
  eloAway: number,
  homeAdvantage: number,
): number {
  const effectiveDiff = (eloHome + homeAdvantage) - eloAway;
  return effectiveDiff / PREDICTOR_CONFIG.ELO_DIVISOR;
}

// Señal H2H. Dominancia (W−L)/total escalada a log-odds vía H2H_SCALE.
// Devuelve 0 si total === 0.
export function h2hSignal(h2h: H2HData | null): number {
  if (!h2h || h2h.total === 0) return 0.0;
  const dominance = (h2h.home_wins - h2h.away_wins) / h2h.total;
  return dominance * PREDICTOR_CONFIG.H2H_SCALE;
}

// Señal de forma reciente. Diferencia de puntos/partido entre home y away,
// escalada por RACHA_SCALE. 3 pts por W, 1 por D, 0 por L. n_matches=0 → ppg=1
// (forma media, mismo fallback que Python).
function ppg(form: TeamForm): number {
  if (form.n_matches === 0) return 1.0;
  return (3 * form.wins + form.draws) / form.n_matches;
}

export function rachaSignal(racha: RachaData): number {
  const homePpg = ppg(racha.home);
  const awayPpg = ppg(racha.away);
  const diff = homePpg - awayPpg;
  return diff * PREDICTOR_CONFIG.RACHA_SCALE;
}

// Score del empate. Función del desequilibrio |Δ ELO|: base − (|diff|/200)^1.5.
// Cuando las fuerzas son iguales, el score del empate sube (base completa).
// Con gran favorito, baja por la penalización.
export function drawSignal(eloDiffAdjusted: number): number {
  const penalty = Math.pow(
    Math.abs(eloDiffAdjusted) / PREDICTOR_CONFIG.DRAW_DIVISOR,
    PREDICTOR_CONFIG.DRAW_POW,
  );
  return PREDICTOR_CONFIG.DRAW_BASE - penalty;
}

// ─── Motor principal ────────────────────────────────────────────────────────

export function predict(
  elo: EloData,
  h2h: H2HData | null,
  racha: RachaData,
  weights: Weights = PREDICTOR_CONFIG.WEIGHTS_DEFAULT,
): Prediction {
  // Home advantage solo si home juega "en casa" como host.
  let homeAdv = 0.0;
  if (elo.is_host_match) {
    homeAdv = PREDICTOR_CONFIG.ALTITUDE_HOSTS.has(elo.home_code)
      ? PREDICTOR_CONFIG.HOME_ADVANTAGE_ALTITUDE
      : PREDICTOR_CONFIG.HOME_ADVANTAGE_BASE;
  }

  const eloSig = eloSignal(elo.elo_home, elo.elo_away, homeAdv);
  const rachaSig = rachaSignal(racha);

  // Fallback H2H replicando Python L183-186:
  //   active_weights = W_FALLBACK if weights == W_DEFAULT else weights
  // Se preserva la semántica: si el llamador pasa pesos custom, se respetan;
  // si usa el default y hay fallback, se sustituye por WEIGHTS_FALLBACK.
  let usedFallback: boolean;
  let h2hSig: number;
  let activeWeights: Weights;

  if (!h2h || h2h.total < PREDICTOR_CONFIG.H2H_MIN_SAMPLE) {
    usedFallback = true;
    h2hSig = 0.0;
    activeWeights = weightsEqual(weights, PREDICTOR_CONFIG.WEIGHTS_DEFAULT)
      ? PREDICTOR_CONFIG.WEIGHTS_FALLBACK
      : weights;
  } else {
    usedFallback = false;
    h2hSig = h2hSignal(h2h);
    activeWeights = weights;
  }

  // Score home en log-odds; away es simétrico (lo que beneficia a home perjudica a away).
  const scoreHome = activeWeights.elo * eloSig
    + activeWeights.h2h * h2hSig
    + activeWeights.racha * rachaSig;
  const scoreAway = -scoreHome;

  // Score del empate a partir del desequilibrio ELO (con home adv incluido).
  const eloDiffForDraw = (elo.elo_home + homeAdv) - elo.elo_away;
  const scoreDraw = drawSignal(eloDiffForDraw);

  // Softmax final sobre (home, draw, away).
  const [pHome, pDraw, pAway] = softmax([scoreHome, scoreDraw, scoreAway]);

  // Signo = argmax. Blindaje orden "1" > "X" > "2" en empates exactos.
  const probs: [number, number, number] = [pHome, pDraw, pAway];
  const signs: Array<"1" | "X" | "2"> = ["1", "X", "2"];
  let idxMax = 0;
  let pMax = probs[0];
  for (let i = 1; i < 3; i++) {
    if (probs[i] > pMax) {
      pMax = probs[i];
      idxMax = i;
    }
  }
  const sign = signs[idxMax];

  // Margin = p_max − p_second_max.
  const sortedProbs = [...probs].sort((a, b) => b - a);
  const pSecond = sortedProbs[1];
  const margin = pMax - pSecond;
  const isDudoso = margin < PREDICTOR_CONFIG.MARGIN_DUDOSO;

  return {
    p_home: pHome,
    p_draw: pDraw,
    p_away: pAway,
    sign,
    p_max: pMax,
    margin,
    is_dudoso: isDudoso,
    used_fallback: usedFallback,
    breakdown: {
      elo_signal: eloSig,
      h2h_signal: h2hSig,
      racha_signal: rachaSig,
      draw_score: scoreDraw,
      home_advantage: homeAdv,
      weights_used: activeWeights,
      scores: { home: scoreHome, draw: scoreDraw, away: scoreAway },
    },
  };
}
