// supabase/functions/_shared/scoring.mjs
// Motor de puntuación Porra Mundial 2026 — funciones puras (sin globals).

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

// calcKOMatchPoints: puntos base de marcador (calcMatchPoints) + avance de ronda.
// El ganador REAL se determina, por prioridad:
//   1) opts.winner ('home'|'away') — lo provee el puente con el desenlace real
//      (incluye prorroga/penaltis). Imprescindible para KO que acaba en empate.
//   2) fallback: derivado de realL/realR (KO sin desempate, o datos antiguos).
// El ganador PREDICHO: del marcador del usuario, o su classifier si predijo empate.
export function calcKOMatchPoints(pred, realL, realR, round, opts = {}) {
  if (!pred || !pred.saved) return 0;
  let pts = calcMatchPoints(pred, realL, realR, opts);

  const realWinner = (opts.winner === 'home' || opts.winner === 'away')
    ? opts.winner
    : (realL > realR ? 'home' : realR > realL ? 'away' : null);

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
