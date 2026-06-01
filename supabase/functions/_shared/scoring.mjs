// supabase/functions/_shared/scoring.mjs
// Motor de puntuación Porra Mundial 2026 — funciones puras (sin globals).
//
// Fuente de verdad SEMÁNTICA compartida entre:
//   - Edge Function `get-league-standings` (server-side, este import).
//   - public/js/scoring.js (browser, sigue siendo classic script con
//     globals; tests/scoring.test.mjs valida parity 1:1 contra este módulo
//     para evitar divergencia).
//
// NO importa nada del runtime de la app — todo viene por parámetro. El
// caller resuelve fechas (boost-day), nombres (scorers fallback) y el
// predicate IA (iaBonusWillApply) y se los pasa ya evaluados.

export const KO_ROUND_PTS = {
  groups:         5,
  r32:            5,
  r16:           10,
  qf:            15,
  sf:            20,
  final_advance: 25,
};

export const DEFAULT_AWARDS_PTS = {
  golden_ball:  15,
  golden_boot:  15,
  golden_glove: 15,
  young_player: 20,
};

export const FINAL_CLASSIFICATION_PTS = {
  champion:  30,
  runner_up: 20,
  third:     15,
  fourth:    10,
};

// ─── calcMatchPoints ─────────────────────────────────────────────────
// Espejo de public/js/scoring.js:51-91 (calcMatchPoints browser).
//
// pred:    { saved, l, v, gol, home, away }
// realL/R: ints (resultado real del partido)
// opts:
//   - scorers: string[] | null  player keys de goleadores reales.
//   - iaBonus: boolean          resultado de iaBonusWillApply ya evaluado.
//   - boost:   boolean          true si este match es el boost del día del usuario.
//
// Reglas (San 21-may-2026, ERR-67):
//   +1 signo correcto (1·X·2)
//   +3 marcador exacto APILA sobre el +1 del signo
//   +2 goleador correcto (si pred.gol y scorers incluye pred.gol)
//   +1 bonus vs IA (caller evalúa iaBonusWillApply)
//   cap 7 por partido antes del boost
//   boost: si exacto Y opts.boost → pts × 2 (máx 14)
export function calcMatchPoints(pred, realL, realR, opts = {}) {
  if (!pred || !pred.saved) return 0;
  let pts = 0;

  const isExact = pred.l === realL && pred.v === realR;

  if (pred.l !== null && pred.l !== undefined &&
      pred.v !== null && pred.v !== undefined &&
      Math.sign(pred.l - pred.v) === Math.sign(realL - realR)) {
    pts += 1;
  }

  if (isExact) pts += 3;

  if (pred.gol) {
    const scorers = opts.scorers;
    if (Array.isArray(scorers) && scorers.includes(pred.gol)) pts += 2;
  }

  if (opts.iaBonus) pts += 1;

  pts = Math.min(pts, 7);

  if (isExact && opts.boost) pts *= 2;

  return pts;
}

// ─── calcKOMatchPoints ───────────────────────────────────────────────
// Espejo de public/js/scoring.js:109-130.
//
// round: 'r32'|'r16'|'qf'|'sf'|'third'|'final'
//   - Cada ronda con valor > 0 en KO_ROUND_PTS suma roundPts si el
//     ganador predicho coincide con el real (incluido classifier en
//     empate predicho).
//   - 'sf' añade además KO_ROUND_PTS.final_advance (25 pts extra por
//     meter al equipo en la final).
//   - 'third' y 'final' NO suman roundPts (cubiertos por classification).
//
// opts: mismo que calcMatchPoints.
export function calcKOMatchPoints(pred, realL, realR, round, opts = {}) {
  if (!pred || !pred.saved) return 0;
  let pts = calcMatchPoints(pred, realL, realR, opts);

  const realWinner = realL > realR ? 'home' : realR > realL ? 'away' : null;
  const predWinner = pred.l > pred.v ? 'home'
                   : pred.v > pred.l ? 'away'
                   : pred.classifier;

  const roundPts = KO_ROUND_PTS[round] || 0;
  if (roundPts > 0 && realWinner && predWinner && realWinner === predWinner) {
    pts += roundPts;
  }

  if (round === 'sf' && realWinner && predWinner && realWinner === predWinner) {
    pts += KO_ROUND_PTS.final_advance;
  }

  return pts;
}

// ─── calcAwardPoints ─────────────────────────────────────────────────
// Espejo de public/js/scoring.js:145-156.
//
// userPicks: { golden_ball, golden_boot, golden_glove, young_player } strings
// realWinners: idem (claves que falten = 0 pts)
// awardsPts: { golden_ball: 15, ... } — default DEFAULT_AWARDS_PTS.
export function calcAwardPoints(userPicks, realWinners, awardsPts = DEFAULT_AWARDS_PTS) {
  if (!userPicks || !realWinners) return 0;
  let pts = 0;
  for (const [key, val] of Object.entries(awardsPts)) {
    if (userPicks[key] && realWinners[key] && userPicks[key] === realWinners[key]) {
      pts += val;
    }
  }
  return pts;
}

// ─── calcClassificationPoints ────────────────────────────────────────
// Espejo de public/js/scoring.js:159-170. Reservado para post-launch
// cuando exista `realResults.classification` derivada de KO.
export function calcClassificationPoints(userPicks, realResults) {
  if (!userPicks || !realResults) return 0;
  let pts = 0;
  for (const [pos, ptsVal] of Object.entries(FINAL_CLASSIFICATION_PTS)) {
    if (userPicks[pos] && realResults[pos] && userPicks[pos] === realResults[pos]) {
      pts += ptsVal;
    }
  }
  return pts;
}

// ─── iaBonusPredicate (helper opcional) ──────────────────────────────
// Espejo de public/js/data.js:323-332 (iaBonusWillApply). El caller del
// server-side puede usar este helper para evaluar iaBonus desde una row
// de ia_predictions; el browser legacy sigue usando la versión global.
//
// iaPred: { sign: '1'|'X'|'2' } o null
// pred:   { l, v } (predicción del usuario)
// realL/R: ints
export function iaBonusPredicate(iaPred, pred, realL, realR) {
  if (!iaPred || !iaPred.sign) return false;
  if (iaPred.sign !== '1' && iaPred.sign !== 'X' && iaPred.sign !== '2') return false;
  const mySign = _getSign(pred.l, pred.v);
  if (!mySign) return false;
  if (mySign === iaPred.sign) return false;
  const realSign = _getSign(realL, realR);
  return mySign === realSign;
}

function _getSign(l, v) {
  if (l === null || l === undefined || v === null || v === undefined) return null;
  if (l > v) return '1';
  if (l < v) return '2';
  return 'X';
}
