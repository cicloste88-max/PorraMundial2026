// supabase/functions/_shared/scoring.mjs
// Motor de puntuación Porra Mundial 2026 — funciones puras (sin globals).

import { scorerMatches } from "./scorer-normalize.mjs";

// Puntos de AVANCE por ronda KO — se otorgan por EQUIPO (predAdvancer ===
// realAdvancer), independientemente de que el cruce coincida. El motor aplica
// KO_ROUND_PTS[round(slot)] de forma uniforme:
//   slot 73-88 (r32) +5 · 89-96 (r16) +10 · 97-100 (qf) +15 · 101-102 (sf) +20
//   slot 104 (final) +25 (acertar al campeón) · slot 103 (third) SIN avance.
// §1.5 DECISIÓN (San, review): el campeón acertado suma sf 20 (llegar a la
// final) + final 25 (ganarla) + champion 30 (podio) = 75. TOGGLE reversible
// de 1 línea: para el esquema "campeón = 50" (sin el +25 de la final), BORRAR
// la clave `final` de aquí (y su espejo en public/js/scoring.js) — slot 104
// dejaría de otorgar avance automáticamente (KO_ROUND_PTS[round] || 0).
export const KO_ROUND_PTS = {
  groups:  5,
  r32:     5,
  r16:    10,
  qf:     15,
  sf:     20,
  final:  25,
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

// Interacción anti-IA × boost — DECIDIDO por San (12-jun-2026, madrugada):
// el +1 anti-IA va DENTRO del multiplicador — (1 signo + 3 exacto + 2 goleador
// + 1 vs IA, cap 7) ×2 = MÁXIMO 14 por partido. Con false, el +1 quedaría
// fuera y se sumaría después (máx 13). Espejo frontend:
// window.BOOST_INCLUYE_IA (scoring.js; false para volver al alternativo).
export const BOOST_INCLUYE_IA = true;

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

  // Goleador (+2). golOk alimenta también la condición del boost (R3).
  // Matcher NORMALIZADO (ERR-93, _shared/scorer-normalize.mjs): absorbe drift
  // de caja/acentos/jr-junior entre la key persistida y la predicha.
  let golOk = false;
  if (pred.gol) {
    golOk = scorerMatches(opts.scorers, pred.gol);
  } else if (pred.l === 0 && pred.v === 0 && realL === 0 && realR === 0) {
    // Regla 0-0 (canónica, confirmada San 10-jun-2026): el goleador es opcional
    // al pronosticar 0-0 — su ausencia es la apuesta "sin goleador". Si el
    // real también es 0-0, paga el +2 de goleador (un 0-0 clavado vale
    // 1+3+2=6 base, paridad con cualquier otro exacto). Si el usuario SÍ
    // registró goleador y el real es 0-0, su apuesta falla (rama de arriba:
    // scorers vacío → no suma). A efectos del boost, ese slot de goleador
    // acertado CUENTA (golOk=true).
    golOk = true;
  }
  if (golOk) pts += 2;

  // Boost ×2 — REGLA CANÓNICA (San product owner, 12-jun-2026, R3 post-J1):
  // SOLO dobla cuando se aciertan RESULTADO EXACTO y GOLEADOR a la vez.
  // El bug previo (doblar con solo exacto) infló 8↔4 a 3 usuarios en J1.
  const doubled = isExact && golOk && opts.boost === true;

  if (BOOST_INCLUYE_IA) {
    if (opts.iaBonus) pts += 1;
    pts = Math.min(pts, 7);
    if (doubled) pts *= 2; // máx 14
  } else {
    pts = Math.min(pts, 7); // defensa; sin IA dentro, el máximo base es 6
    if (doubled) pts *= 2;
    if (opts.iaBonus) pts += 1; // máx 13
  }

  return pts;
}

// calcKOMatchPoints — modelo KO normativo (brief 26-jun-2026, §1.3). Dos
// componentes INDEPENDIENTES, sumados:
//
//   (a) MARCADOR (estilo grupo, máx 7, SIN boost) — SOLO si el cruce coincide:
//       el conjunto {predHome, predAway} (iso3 de la malla del usuario) es igual
//       al conjunto {realHome, realAway} (iso3 de wc_matches_ko). Si coincide se
//       orienta el marcador del usuario al marco real (swap si el usuario puso a
//       un equipo en local que el real tiene en visitante — invariante ERR-95/96)
//       y se puntúa signo/exacto/goleador/IA vía calcMatchPoints. Si NO coincide:
//       0 de marcador (ni signo, ni exacto, ni goleador, ni IA).
//
//   (b) AVANCE (por EQUIPO) — independiente del cruce: si predAdvancer ===
//       realAdvancer (iso3) se suma KO_ROUND_PTS[round]. Se otorga aunque el
//       cruce no coincida (acertar solo quién avanza paga el avance, nada del
//       marcador). El slot 103 (3.er puesto) NO da avance (round 'third' ∉
//       KO_ROUND_PTS).
//
// opts (malla, todos iso3 o null; degradan limpio si faltan):
//   { predHome, predAway, predAdvancer, realHome, realAway, realAdvancer,
//     scorers, iaPred }  · iaPred = { sign } de la IA para el CRUCE REAL (1.4).
// pred.l/pred.v vienen orientados a (predHome, predAway). realL/realR a
// (realHome, realAway). boost SIEMPRE off en KO (§1.6).
export function calcKOMatchPoints(pred, realL, realR, round, opts = {}) {
  if (!pred || !pred.saved) return 0;
  let pts = 0;

  const predHome = opts.predHome ?? null;
  const predAway = opts.predAway ?? null;
  const realHome = opts.realHome ?? null;
  const realAway = opts.realAway ?? null;
  const predAdvancer = opts.predAdvancer ?? null;
  const realAdvancer = opts.realAdvancer ?? null;

  // (a) Marcador — gate de cruce (igualdad de CONJUNTO de iso3).
  const matchupCoincide =
    predHome != null && predAway != null && realHome != null && realAway != null &&
    ((predHome === realHome && predAway === realAway) ||
     (predHome === realAway && predAway === realHome));

  if (matchupCoincide) {
    // Orientar al marco real: si el usuario invirtió los lados (su home es el
    // away real), intercambiar su marcador antes de comparar (ERR-95/96).
    const swap = predHome === realAway;
    const oriented = swap ? { ...pred, l: pred.v, v: pred.l } : pred;
    const iaBonus = opts.iaPred
      ? iaBonusPredicate(opts.iaPred, { l: oriented.l, v: oriented.v }, realL, realR)
      : false;
    pts += calcMatchPoints(oriented, realL, realR, {
      scorers: opts.scorers ?? null,
      iaBonus,
      boost: false,
    });
  }

  // (b) Avance — por equipo, KO_ROUND_PTS[round] (slot 103 → undefined → 0).
  const roundPts = KO_ROUND_PTS[round] || 0;
  if (roundPts > 0 && predAdvancer != null && realAdvancer != null &&
      predAdvancer === realAdvancer) {
    pts += roundPts;
  }

  return pts;
}

// calcKoPodiumPoints — clasificación final (§1.5), UNA vez por usuario tras la
// Final. Compara el podio PREDICHO (de la malla del usuario) contra el REAL,
// ambos en iso3:
//   champion  = avanzador del slot 104   → +30
//   runnerUp  = perdedor  del slot 104   → +20
//   third     = avanzador del slot 103   → +15
//   fourth    = perdedor  del slot 103   → +10
// Independiente del avance: un campeón acertado suma además sf 20 + final 25.
export function calcKoPodiumPoints(predPodium, realPodium) {
  if (!predPodium || !realPodium) return 0;
  let pts = 0;
  const cmp = (predKey, realKey, ptsKey) => {
    const p = predPodium[predKey];
    const r = realPodium[realKey];
    if (p != null && r != null && p === r) pts += FINAL_CLASSIFICATION_PTS[ptsKey];
  };
  cmp('champion', 'champion', 'champion');
  cmp('runnerUp', 'runnerUp', 'runner_up');
  cmp('third',    'third',    'third');
  cmp('fourth',   'fourth',   'fourth');
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
