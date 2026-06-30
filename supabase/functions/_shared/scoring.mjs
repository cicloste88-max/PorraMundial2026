// supabase/functions/_shared/scoring.mjs
// Motor de puntuación Porra Mundial 2026 — funciones puras (sin globals).

import { scorerMatches } from "./scorer-normalize.mjs";

// Puntos de AVANCE por ronda KO — se otorgan por EQUIPO (predAdvancer ===
// realAdvancer), independientemente de que el cruce coincida. El motor aplica
// KO_ROUND_PTS[round(slot)] de forma uniforme:
//   slot 73-88 (r32) +10 · 89-96 (r16) +15 · 97-100 (qf) +20 · 101-102 (sf) +25
//   slot 104 (final) +30 (acertar al campeón) · slot 103 (third) SIN avance.
// §1.5 DECISIÓN (San, review): el campeón acertado suma sf 25 (llegar a la
// final) + final 30 (ganarla) + champion 30 (podio) = 85. TOGGLE reversible
// de 1 línea: para el esquema "campeón = 55" (sin el +30 de la final), BORRAR
// la clave `final` de aquí (y su espejo en public/js/scoring.js) — slot 104
// dejaría de otorgar avance automáticamente (KO_ROUND_PTS[round] || 0).
export const KO_ROUND_PTS = {
  groups:  5,
  r32:    10,
  r16:    15,
  qf:     20,
  sf:     25,
  final:  30,
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

// calcMatchPointsBreakdown — variante "todo lo que computé" para el dashboard
// y otras consumidoras que necesitan los flags individuales. calcMatchPoints
// es un wrapper trivial: devuelve .pts de aquí. Mantener la lógica EN UNA
// SOLA FUNCIÓN garantiza cero divergencia entre el total publicado y el
// breakdown (la suite de scoring.test.mjs verifica .pts contra los canónicos).
//
// Devuelve { pts, signOk, exact, golOk, iaBonus, doubled, capped }:
//   signOk  — Math.sign(pred.l-pred.v) === Math.sign(realL-realR), defensa null.
//   exact   — pred.l===realL && pred.v===realR.
//   golOk   — goleador acertado (matcher normalizado) o regla 0-0.
//   iaBonus — opts.iaBonus efectivamente aplicado (false si saved=false).
//   doubled — boost ×2 efectivo (exact+golOk+opts.boost===true).
//   capped  — true si el cap 7 recortó la suma base.
export function calcMatchPointsBreakdown(pred, realL, realR, opts = {}) {
  const empty = { pts: 0, signOk: false, exact: false, golOk: false, iaBonus: false, doubled: false, capped: false };
  if (!pred || !pred.saved) return empty;

  const exact = pred.l === realL && pred.v === realR;

  const signOk = (
    pred.l !== null && pred.l !== undefined &&
    pred.v !== null && pred.v !== undefined &&
    Math.sign(pred.l - pred.v) === Math.sign(realL - realR)
  );

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

  // Boost ×2 — REGLA CANÓNICA (San product owner, 12-jun-2026, R3 post-J1):
  // SOLO dobla cuando se aciertan RESULTADO EXACTO y GOLEADOR a la vez.
  // El bug previo (doblar con solo exacto) infló 8↔4 a 3 usuarios en J1.
  const doubled = exact && golOk && opts.boost === true;
  const iaBonus = !!opts.iaBonus;

  let pts = 0;
  if (signOk) pts += 1;
  if (exact)  pts += 3;
  if (golOk)  pts += 2;

  let capped = false;
  if (BOOST_INCLUYE_IA) {
    if (iaBonus) pts += 1;
    if (pts > 7) { pts = 7; capped = true; }
    if (doubled) pts *= 2; // máx 14
  } else {
    if (pts > 7) { pts = 7; capped = true; } // defensa; sin IA dentro, el máximo base es 6
    if (doubled) pts *= 2;
    if (iaBonus) pts += 1; // máx 13
  }

  return { pts, signOk, exact, golOk, iaBonus, doubled, capped };
}

export function calcMatchPoints(pred, realL, realR, opts = {}) {
  return calcMatchPointsBreakdown(pred, realL, realR, opts).pts;
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
// calcKOMatchPointsBreakdown — variante con flags y subtotales para el
// dashboard. calcKOMatchPoints delega aquí.
//
// Devuelve {
//   pts,           // total del slot (marcador + avance)
//   matchupOk,     // {predHome,predAway} ≡ {realHome,realAway}
//   swap,          // true si el marcador del usuario tuvo que invertirse
//   signOk,        // marcador: signo correcto (post-orientación)
//   exact,         // marcador: exacto (post-orientación)
//   golOk,         // marcador: goleador acertado
//   iaBonus,       // marcador: bono anti-IA aplicado
//   matchPts,      // subtotal del marcador (0 si matchupOk=false)
//   advanced,      // avance: predAdvancer ∈ realRoundAdvancers (o per-slot fallback)
//   advancePts,    // KO_ROUND_PTS[round] si avanzó, 0 en otro caso
// }
export function calcKOMatchPointsBreakdown(pred, realL, realR, round, opts = {}) {
  const empty = {
    pts: 0, matchupOk: false, swap: false,
    signOk: false, exact: false, golOk: false, iaBonus: false,
    matchPts: 0, advanced: false, advancePts: 0,
  };
  if (!pred || !pred.saved) return empty;

  const predHome = opts.predHome ?? null;
  const predAway = opts.predAway ?? null;
  const realHome = opts.realHome ?? null;
  const realAway = opts.realAway ?? null;
  const predAdvancer = opts.predAdvancer ?? null;
  const realAdvancer = opts.realAdvancer ?? null;

  // (a) Marcador — gate de cruce (igualdad de CONJUNTO de iso3).
  const matchupOk =
    predHome != null && predAway != null && realHome != null && realAway != null &&
    ((predHome === realHome && predAway === realAway) ||
     (predHome === realAway && predAway === realHome));

  let matchPts = 0;
  let swap = false;
  let signOk = false, exact = false, golOk = false, iaBonus = false;

  if (matchupOk) {
    // Orientar al marco real: si el usuario invirtió los lados (su home es el
    // away real), intercambiar su marcador antes de comparar (ERR-95/96).
    swap = predHome === realAway;
    const oriented = swap ? { ...pred, l: pred.v, v: pred.l } : pred;
    const ia = opts.iaPred
      ? iaBonusPredicate(opts.iaPred, { l: oriented.l, v: oriented.v }, realL, realR)
      : false;
    const bd = calcMatchPointsBreakdown(oriented, realL, realR, {
      scorers: opts.scorers ?? null,
      iaBonus: ia,
      boost: false,
    });
    matchPts = bd.pts;
    signOk   = bd.signOk;
    exact    = bd.exact;
    golOk    = bd.golOk;
    iaBonus  = bd.iaBonus;
  }

  // (b) Avance — SET-BASED por equipo (San 30-jun-2026). +KO_ROUND_PTS[round] si
  // el equipo que el usuario marcó avanzar en este slot está entre los que
  // REALMENTE avanzaron en la ronda (independiente de slot/cruce). Antes era
  // predAdvancer === realAdvancer (mismo slot) → ignoraba "equipo correcto, slot
  // equivocado". opts.realRoundAdvancers: Set<iso3> de avanzadores reales de la
  // ronda (solo slots resueltos; 103 'third' excluido vía KO_ROUND_PTS).
  // Fallback al criterio por-slot si el caller no pasa el set (compat).
  const roundPts = KO_ROUND_PTS[round] || 0;
  const advanced = (
    predAdvancer != null && (
      opts.realRoundAdvancers instanceof Set
        ? opts.realRoundAdvancers.has(predAdvancer)
        : (realAdvancer != null && predAdvancer === realAdvancer)
    )
  );
  const advancePts = (roundPts > 0 && advanced) ? roundPts : 0;

  return {
    pts: matchPts + advancePts,
    matchupOk, swap,
    signOk, exact, golOk, iaBonus,
    matchPts,
    advanced, advancePts,
  };
}

export function calcKOMatchPoints(pred, realL, realR, round, opts = {}) {
  return calcKOMatchPointsBreakdown(pred, realL, realR, round, opts).pts;
}

// calcKoPodiumPoints — clasificación final (§1.5), UNA vez por usuario tras la
// Final. Compara el podio PREDICHO (de la malla del usuario) contra el REAL,
// ambos en iso3:
//   champion  = avanzador del slot 104   → +30
//   runnerUp  = perdedor  del slot 104   → +20
//   third     = avanzador del slot 103   → +15
//   fourth    = perdedor  del slot 103   → +10
// Independiente del avance: un campeón acertado suma además sf 25 + final 30.
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
