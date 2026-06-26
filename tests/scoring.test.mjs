// Smoke test scoring — Porra Mundial 2026.
//
// Cubre 4 capas:
//   1. Canónicos sobre el módulo compartido `_shared/scoring.mjs` (fuente de
//      verdad semántica de la EF get-league-standings): calcMatchPoints + KO +
//      awards + iaBonus, incluyendo boost ×2.
//   2. Carga del motor legacy `public/js/scoring.js` por MARCADORES DE FUNCIÓN
//      (NO por nº de línea — antes `slice(0,104)`, frágil ante cualquier
//      edición arriba del fichero). Extrae calcMatchPoints + calcKOMatchPoints
//      + calcAwardPoints.
//   3. Parity 1:1 shared↔legacy para las TRES funciones (incluye boost e IA).
//      Si alguien edita un motor y olvida el otro, pita aquí. Riesgo nº 1 del
//      sprint PR-1 (San).
//   4. EF assembly: guard del mapeo `scorer` (BD) → `gol` (motor).
//
// Reglas (ERR-67, San 21-may-2026):
//   +1 signo · +3 exacto APILA · +2 goleador · +1 bonus IA · cap 7.
// Boost ×2 — REGLA CANÓNICA R3 (San, 12-jun-2026): SOLO dobla con EXACTO y
// GOLEADOR a la vez. N3 (decisión San, madrugada 12-jun): el +1 anti-IA va
// DENTRO del multiplicador (BOOST_INCLUYE_IA=true) → máx 14 = (cap 7) ×2.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  calcMatchPoints as sharedCalcMatchPoints,
  calcKOMatchPoints as sharedCalcKOMatchPoints,
  calcKoPodiumPoints as sharedCalcKoPodiumPoints,
  calcAwardPoints as sharedCalcAwardPoints,
  iaBonusPredicate,
  KO_ROUND_PTS,
} from '../supabase/functions/_shared/scoring.mjs';

import {
  matchPlayerKey,
  fallbackKey,
  resolveScorerKey,
  scorerMatches,
} from '../supabase/functions/_shared/scorer-normalize.mjs';

// ════════════════════════════════════════════════════════════════════
// 1. SHARED MODULE — canónicos calcMatchPoints (incl. boost + iaBonus)
// ════════════════════════════════════════════════════════════════════
{
  const t1 = sharedCalcMatchPoints({ saved: true, l: 2, v: 0, gol: null }, 3, 1);
  assert.strictEqual(t1, 1, 'shared #1: solo signo correcto → +1');

  const t2 = sharedCalcMatchPoints({ saved: true, l: 3, v: 1, gol: null }, 3, 1);
  assert.strictEqual(t2, 4, 'shared #2: exacto sin goleador → +1 (signo) +3 (exacto) = 4');

  const t3 = sharedCalcMatchPoints(
    { saved: true, l: 3, v: 2, gol: 'lozano' }, 3, 2, { scorers: ['lozano'] }
  );
  assert.strictEqual(t3, 6, 'shared #3: exacto + goleador → +1 +3 +2 = 6');

  const t4 = sharedCalcMatchPoints(
    { saved: true, l: 3, v: 2, gol: 'lozano' }, 3, 2, { scorers: ['lozano'], iaBonus: true }
  );
  assert.strictEqual(t4, 7, 'shared #4: exacto + goleador + IA bonus → max 7');

  const t5 = sharedCalcMatchPoints({ saved: true, l: 3, v: 1, gol: null }, 3, 1, { boost: true });
  assert.strictEqual(t5, 4, 'shared #5 (R3): exacto SIN goleador + boost → NO dobla = 4');

  const t6 = sharedCalcMatchPoints({ saved: true, l: 2, v: 0, gol: null }, 3, 1, { boost: true });
  assert.strictEqual(t6, 1, 'shared #6: boost NO aplica sin exacto');

  // Goleador con pred.gol pero scorers sin él → 0 pts goleador
  const t7 = sharedCalcMatchPoints(
    { saved: true, l: 2, v: 1, gol: 'wrong' }, 2, 1, { scorers: ['lozano'] }
  );
  assert.strictEqual(t7, 4, 'shared #7: goleador no acierta → +1+3 = 4 (sin +2)');

  // saved=false ignora todo
  const t8 = sharedCalcMatchPoints({ saved: false, l: 3, v: 0, gol: null }, 3, 0);
  assert.strictEqual(t8, 0, 'shared #8: saved=false → 0');

  // N3 (decisión San 12-jun): el +1 anti-IA DENTRO del multiplicador
  // (BOOST_INCLUYE_IA=true): (1+3+2+1, cap 7) ×2 = 14 (máximo por partido).
  const t9 = sharedCalcMatchPoints(
    { saved: true, l: 3, v: 2, gol: 'lozano' }, 3, 2, { scorers: ['lozano'], iaBonus: true, boost: true }
  );
  assert.strictEqual(t9, 14, 'shared #9 (N3): (cap 7) × boost = 14 (máximo por partido)');

  // NUEVO (B2/T3): boost NO dobla sin exacto aunque haya gol acertado.
  const t10 = sharedCalcMatchPoints(
    { saved: true, l: 2, v: 1, gol: 'lozano' }, 3, 1, { scorers: ['lozano'], boost: true }
  );
  assert.strictEqual(t10, 3, 'shared #10: signo+gol=3, boost no aplica (no exacto)');

  // R3 — los 4 casos canónicos del boost (regla San 12-jun-2026):
  const b1 = sharedCalcMatchPoints({ saved: true, l: 2, v: 0, gol: 'wrong' }, 2, 0, { scorers: ['lozano'], boost: true });
  assert.strictEqual(b1, 4, 'R3 b1: solo exacto (goleador fallado) → NO dobla = 4');
  const b2 = sharedCalcMatchPoints({ saved: true, l: 1, v: 2, gol: 'lozano' }, 2, 1, { scorers: ['lozano'], boost: true });
  assert.strictEqual(b2, 2, 'R3 b2: solo goleador (signo fallado) → NO dobla = 2');
  const b3 = sharedCalcMatchPoints({ saved: true, l: 2, v: 0, gol: 'lozano' }, 2, 0, { scorers: ['lozano'], boost: true });
  assert.strictEqual(b3, 12, 'R3 b3: exacto + goleador → dobla = (1+3+2)×2 = 12');
  const b4 = sharedCalcMatchPoints({ saved: true, l: 0, v: 2, gol: 'wrong' }, 2, 0, { scorers: ['lozano'], boost: true });
  assert.strictEqual(b4, 0, 'R3 b4: ninguno → 0 (boost irrelevante)');
  // Caso real J1 (javion_89/daniel.castan20/josempurullena): exacto+boost con
  // goleador fallado estaba inflado a 8; canónico = 4 (cubierto por b1/t5).
  // Regla 0-0: el slot de goleador "sin goleador" acertado CUENTA para el ×2.
  const b5 = sharedCalcMatchPoints({ saved: true, l: 0, v: 0, gol: null }, 0, 0, { boost: true });
  assert.strictEqual(b5, 12, 'R3 b5: 0-0 clavado sin goleador + boost → (1+3+2)×2 = 12');
}

// ════════════════════════════════════════════════════════════════════
// 2. SHARED MODULE — calcKOMatchPoints (modelo normativo §1.3)
//    Dos componentes INDEPENDIENTES: (a) marcador estilo grupo SOLO si el
//    cruce de equipos coincide (igualdad de conjunto iso3, con orientación);
//    (b) avance por EQUIPO (predAdvancer===realAdvancer). boost OFF en KO.
// ════════════════════════════════════════════════════════════════════
{
  const KO = sharedCalcKOMatchPoints;

  // #1 cruce coincide + exacto + goleador + IA → marcador cap 7 (SIN boost
  // aunque haya boost pick) + avance r16 (10) = 17.
  const m1 = KO({ saved: true, l: 2, v: 0, gol: 'lozano' }, 2, 0, 'r16', {
    scorers: ['lozano'], boost: true,
    predHome: 'MEX', predAway: 'KOR', predAdvancer: 'MEX',
    realHome: 'MEX', realAway: 'KOR', realAdvancer: 'MEX',
    iaPred: { sign: '2' }, // IA dice gana visitante; user gana local y acierta → +1
  });
  assert.strictEqual(m1, 17, 'KO #1: cruce coincide exacto+gol+IA (cap7, sin boost) + avance r16 = 7+10');

  // #2 cruce coincide + solo signo, avanzador FALLA → 1 (sin avance).
  const m2 = KO({ saved: true, l: 2, v: 0, gol: null }, 1, 0, 'r32', {
    predHome: 'BRA', predAway: 'ARG', predAdvancer: 'BRA',
    realHome: 'BRA', realAway: 'ARG', realAdvancer: 'ARG',
  });
  assert.strictEqual(m2, 1, 'KO #2: cruce coincide, solo signo, avanzador falla = 1');

  // #3 CASO COREA/ALEMANIA (el bug): user KOR 2-1 avanza KOR; real GER 2-1
  // avanza GER. Mismo marcador y lado, equipos DISTINTOS → 0 (antes daba +8).
  const m3 = KO({ saved: true, l: 2, v: 1, gol: null }, 2, 1, 'r32', {
    predHome: 'KOR', predAway: 'JPN', predAdvancer: 'KOR',
    realHome: 'GER', realAway: 'BRA', realAdvancer: 'GER',
  });
  assert.strictEqual(m3, 0, 'KO #3 (Corea/Alemania): cruce distinto, mismo 2-1/lado → 0, NO +8');

  // #4 cruce NO coincide pero avanzador SÍ (user FRA-BRA avanza FRA; real
  // FRA-ITA avanza FRA) → 0 marcador + avance qf (15).
  const m4 = KO({ saved: true, l: 3, v: 0, gol: 'mbappe' }, 1, 0, 'qf', {
    scorers: ['otro'],
    predHome: 'FRA', predAway: 'BRA', predAdvancer: 'FRA',
    realHome: 'FRA', realAway: 'ITA', realAdvancer: 'FRA',
  });
  assert.strictEqual(m4, 15, 'KO #4: cruce distinto, avanzador coincide → 0 marcador + avance qf (15)');

  // #5 ORIENTACIÓN (ERR-95/96): user MEX(local) 0-2 KOR(visit); real KOR(local)
  // 2-0 MEX(visit). Mismo cruce; el 0-2 del user se orienta a 2-0 → exacto.
  const m5 = KO({ saved: true, l: 0, v: 2, gol: null }, 2, 0, 'r16', {
    predHome: 'MEX', predAway: 'KOR', predAdvancer: 'KOR',
    realHome: 'KOR', realAway: 'MEX', realAdvancer: 'KOR',
  });
  assert.strictEqual(m5, 14, 'KO #5: swap de lados, cruce coincide → marcador orientado exacto (4) + avance r16 (10)');

  // #6 EMPATE por penaltis: el avanzador lo decide el EQUIPO (no el lado).
  // user 2-2, real 1-1, ESP gana en penaltis → signo X (1) + avance sf (20).
  const m6 = KO({ saved: true, l: 2, v: 2, gol: null, classifier: 'ESP' }, 1, 1, 'sf', {
    predHome: 'ESP', predAway: 'GER', predAdvancer: 'ESP',
    realHome: 'ESP', realAway: 'GER', realAdvancer: 'ESP',
  });
  assert.strictEqual(m6, 21, 'KO #6: empate (2-2 vs 1-1, penaltis) avanzador por equipo ESP → 1 + avance sf (20)');

  // #7 slot 104 (final): marcador exacto (4) + avance FINAL (25) = 29 (campeón).
  const finalSlot = KO({ saved: true, l: 1, v: 0, gol: null }, 1, 0, 'final', {
    predHome: 'ARG', predAway: 'FRA', predAdvancer: 'ARG',
    realHome: 'ARG', realAway: 'FRA', realAdvancer: 'ARG',
  });
  assert.strictEqual(finalSlot, 29, 'KO #7: final exacto (4) + avance final (25) = 29');

  // #8 REGRESIÓN final_advance@sf: una semi acertada da SOLO sf 20 (no +45).
  const semiSlot = KO({ saved: true, l: 1, v: 0, gol: null }, 1, 0, 'sf', {
    predHome: 'ARG', predAway: 'CRO', predAdvancer: 'ARG',
    realHome: 'ARG', realAway: 'CRO', realAdvancer: 'ARG',
  });
  assert.strictEqual(semiSlot, 24, 'KO #8: semi exacta (4) + avance sf (20) = 24, NO 49 (bug final_advance@sf)');

  // #9 slot 103 (round 'third'): marcador sí, avance NO ('third' ∉ KO_ROUND_PTS).
  const thirdSlot = KO({ saved: true, l: 2, v: 1, gol: null }, 2, 1, 'third', {
    predHome: 'POR', predAway: 'NED', predAdvancer: 'POR',
    realHome: 'POR', realAway: 'NED', realAdvancer: 'POR',
  });
  assert.strictEqual(thirdSlot, 4, 'KO #9: 3er puesto exacto (4) SIN avance');

  // #10 degradación limpia: sin malla (mesh vacía) → 0 (marcador y avance off).
  const noMesh = KO({ saved: true, l: 2, v: 0, gol: 'lozano' }, 2, 0, 'r16', { scorers: ['lozano'] });
  assert.strictEqual(noMesh, 0, 'KO #10: sin malla (wc_matches_ko vacío) → 0 limpio');

  // KO_ROUND_PTS: final renombrado (no final_advance), third ausente.
  assert.strictEqual(KO_ROUND_PTS.final, 25, 'KO_ROUND_PTS.final = 25 (renombrado de final_advance)');
  assert.strictEqual(KO_ROUND_PTS.final_advance, undefined, 'KO_ROUND_PTS.final_advance eliminado');
  assert.strictEqual(KO_ROUND_PTS.third, undefined, 'KO_ROUND_PTS.third ausente (3er puesto sin avance)');
}

// ════════════════════════════════════════════════════════════════════
// 2b. SHARED MODULE — calcKoPodiumPoints (§1.5: 30/20/15/10)
// ════════════════════════════════════════════════════════════════════
{
  const realPod = { champion: 'ARG', runnerUp: 'FRA', third: 'CRO', fourth: 'MAR' };
  assert.strictEqual(
    sharedCalcKoPodiumPoints({ champion: 'ARG', runnerUp: 'FRA', third: 'CRO', fourth: 'MAR' }, realPod),
    75, 'podio 4/4 = 30+20+15+10');
  assert.strictEqual(
    sharedCalcKoPodiumPoints({ champion: 'ARG', runnerUp: 'BRA', third: 'X', fourth: 'Y' }, realPod),
    30, 'podio solo campeón = 30');
  assert.strictEqual(
    sharedCalcKoPodiumPoints({ champion: 'BRA', runnerUp: 'FRA', third: 'CRO', fourth: 'X' }, realPod),
    35, 'podio sub (20) + 3.º (15) = 35');
  assert.strictEqual(sharedCalcKoPodiumPoints(null, realPod), 0, 'podio sin pred = 0');
  assert.strictEqual(sharedCalcKoPodiumPoints({ champion: 'ARG' }, null), 0, 'podio sin real = 0');

  // §1.5 — el campeón acertado suma en su recta final: sf 20 (slot 101/102) +
  // final 25 (slot 104) + champion 30 (podio) = 75. Aislamos el AVANCE con
  // marcador fallido (0-0 vs 1-0 → 0 de marcador).
  const sfAdv = sharedCalcKOMatchPoints({ saved: true, l: 0, v: 0, gol: null }, 1, 0, 'sf', {
    predHome: 'ARG', predAway: 'GER', predAdvancer: 'ARG',
    realHome: 'ARG', realAway: 'GER', realAdvancer: 'ARG',
  });
  const finalAdv = sharedCalcKOMatchPoints({ saved: true, l: 0, v: 0, gol: null }, 1, 0, 'final', {
    predHome: 'ARG', predAway: 'FRA', predAdvancer: 'ARG',
    realHome: 'ARG', realAway: 'FRA', realAdvancer: 'ARG',
  });
  const champPod = sharedCalcKoPodiumPoints({ champion: 'ARG' }, { champion: 'ARG' });
  assert.strictEqual(sfAdv, 20, '§1.5 a: avance sf aislado = 20');
  assert.strictEqual(finalAdv, 25, '§1.5 b: avance final aislado = 25');
  assert.strictEqual(champPod, 30, '§1.5 c: podio campeón = 30');
  assert.strictEqual(sfAdv + finalAdv + champPod, 75, '§1.5: campeón = sf 20 + final 25 + champion 30 = 75');
}

// ════════════════════════════════════════════════════════════════════
// 3. SHARED MODULE — calcAwardPoints
// ════════════════════════════════════════════════════════════════════
{
  const picks   = { golden_ball: 'Yamal', golden_boot: 'Mbappe', golden_glove: 'Bono',       young_player: 'Mainoo' };
  const winners = { golden_ball: 'Yamal', golden_boot: 'Mbappe', golden_glove: 'Donnarumma', young_player: 'Mainoo' };
  // 3 aciertos: balón (15) + bota (15) + joven (20) = 50
  assert.strictEqual(sharedCalcAwardPoints(picks, winners), 50, 'awards 3/4 = 15+15+20');

  // Sin picks o sin winners → 0
  assert.strictEqual(sharedCalcAwardPoints(null, winners), 0, 'awards picks=null → 0');
  assert.strictEqual(sharedCalcAwardPoints(picks, null),    0, 'awards winners=null → 0');
}

// ════════════════════════════════════════════════════════════════════
// 4. SHARED MODULE — iaBonusPredicate (helper opcional para server)
// ════════════════════════════════════════════════════════════════════
{
  // Caso A: user coincide con IA (1 vs 1) → false
  assert.strictEqual(iaBonusPredicate({ sign: '1' }, { l: 2, v: 0 }, 1, 0), false, 'ia A: user==ia');
  // Caso B: user contra-IA y acierta signo real → true
  assert.strictEqual(iaBonusPredicate({ sign: '1' }, { l: 0, v: 2 }, 0, 1), true,  'ia B: user!=ia y acierta');
  // Caso C: user contra-IA pero falla → false
  assert.strictEqual(iaBonusPredicate({ sign: '1' }, { l: 0, v: 2 }, 1, 1), false, 'ia C: user!=ia y falla');
  // Caso D: sin IA → false
  assert.strictEqual(iaBonusPredicate(null,           { l: 2, v: 0 }, 1, 0), false, 'ia D: sin ia');
  assert.strictEqual(iaBonusPredicate({ sign: null }, { l: 2, v: 0 }, 1, 0), false, 'ia D bis: ia.sign=null');
}

// ════════════════════════════════════════════════════════════════════
// 5. LEGACY ENGINE — carga por MARCADORES DE FUNCIÓN (no por nº de línea)
//
// Antes: `fullSrc.split('\n').slice(0, 104)` — frágil: cualquier línea
// añadida arriba de calcMatchPoints corrompía el slice. Ahora se extrae el
// bloque del motor puro por identificadores estables de código (la constante
// de puntos KO hasta la función agregadora UI-coupled, que NO evaluamos).
// ════════════════════════════════════════════════════════════════════

// Globals que el motor legacy referencia en runtime (resuelven contra
// globalThis dentro del `new Function`):
globalThis.iaBonusWillApply = () => false;
globalThis.PARTIDOS = [];
globalThis.getMatchKey = (m) => `${m.group}_${m.home}_${m.away}`;  // espejo data.js:310
globalThis.boostPicks = {};
globalThis.EQUIPOS = [];                  // _hf09FallbackScorers → [] (sin +2 espurio)
globalThis.AWARDS_CFG = {                 // calcAwardPoints legacy itera AWARDS_CFG[k].pts
  golden_ball:  { pts: 15 },
  golden_boot:  { pts: 15 },
  golden_glove: { pts: 15 },
  young_player: { pts: 20 },
};

function loadLegacyEngine() {
  const src = readFileSync('public/js/scoring.js', 'utf8');
  // Marcadores estables: desde la constante de puntos KO hasta la función
  // agregadora UI-coupled (calcTotalUserPoints, que itera PARTIDOS y NO
  // queremos evaluar). Robusto ante shifts de línea.
  const START = 'const KO_ROUND_PTS';
  const END   = 'function calcTotalUserPoints';
  const start = src.indexOf(START);
  const end   = src.indexOf(END);
  assert.ok(start !== -1, 'legacy: marcador START (const KO_ROUND_PTS) no encontrado en scoring.js');
  assert.ok(end !== -1 && end > start, 'legacy: marcador END (function calcTotalUserPoints) no encontrado en scoring.js');
  const slice = src.slice(start, end);
  const fn = new Function(
    slice + '\nreturn { calcMatchPoints, calcKOMatchPoints, calcAwardPoints, calcKoPodiumPoints };'
  );
  return fn();
}

const {
  calcMatchPoints:    legacyCMP,
  calcKOMatchPoints:  legacyCKO,
  calcAwardPoints:    legacyCAW,
  calcKoPodiumPoints: legacyCPOD,
} = loadLegacyEngine();

// Canónicos legacy calcMatchPoints (los 4 originales).
{
  assert.strictEqual(legacyCMP({ saved: true, l: 2, v: 0, gol: null }, 3, 1, null, []), 1, 'legacy CMP #1');
  assert.strictEqual(legacyCMP({ saved: true, l: 3, v: 1, gol: null }, 3, 1, null, []), 4, 'legacy CMP #2');
  assert.strictEqual(legacyCMP({ saved: true, l: 3, v: 2, gol: 'lozano' }, 3, 2, null, ['lozano']), 6, 'legacy CMP #3');
  globalThis.iaBonusWillApply = () => true;
  assert.strictEqual(legacyCMP({ saved: true, l: 3, v: 2, gol: 'lozano' }, 3, 2, 'mock-key', ['lozano']), 7, 'legacy CMP #4');
  globalThis.iaBonusWillApply = () => false;
}

// R3 — paridad legacy↔shared de la regla canónica del boost (el legacy
// resuelve el boost vía PARTIDOS/boostPicks por fecha, no por opts).
{
  globalThis.PARTIDOS = [{ group: 'A', home: 'H', away: 'V', date: '2026-06-11T19:00' }];
  globalThis.boostPicks = { '2026-06-11': 'A_H_V' };
  const K = 'A_H_V';
  assert.strictEqual(legacyCMP({ saved: true, l: 2, v: 0, gol: 'wrong' }, 2, 0, K, ['lozano']), 4, 'legacy R3: solo exacto NO dobla');
  assert.strictEqual(legacyCMP({ saved: true, l: 1, v: 2, gol: 'lozano' }, 2, 1, K, ['lozano']), 2, 'legacy R3: solo goleador NO dobla');
  assert.strictEqual(legacyCMP({ saved: true, l: 2, v: 0, gol: 'lozano' }, 2, 0, K, ['lozano']), 12, 'legacy R3: exacto+goleador dobla = 12');
  assert.strictEqual(legacyCMP({ saved: true, l: 0, v: 2, gol: 'wrong' }, 2, 0, K, ['lozano']), 0, 'legacy R3: ninguno → 0');
  globalThis.iaBonusWillApply = () => true;
  assert.strictEqual(legacyCMP({ saved: true, l: 2, v: 0, gol: 'lozano' }, 2, 0, K, ['lozano']), 14, 'legacy N3: IA dentro del ×2 → 14 (parity shared #9)');
  globalThis.iaBonusWillApply = () => false;
  globalThis.PARTIDOS = [];
  globalThis.boostPicks = {};
}

// Canónicos legacy calcKOMatchPoints (modelo §1.3, nueva firma con malla).
{
  const mesh = (extra) => Object.assign({
    predHome: 'MEX', predAway: 'KOR', predAdvancer: 'MEX',
    realHome: 'MEX', realAway: 'KOR', realAdvancer: 'MEX',
  }, extra || {});
  // cruce coincide + exacto + avance r16 = 4 + 10 = 14
  assert.strictEqual(legacyCKO({ saved: true, l: 2, v: 0, gol: null }, 2, 0, 'r16', mesh()), 14, 'legacy CKO r16 exacto+avance');
  // final exacto + avance final (25) = 29
  assert.strictEqual(legacyCKO({ saved: true, l: 1, v: 0, gol: null }, 1, 0, 'final', mesh()), 29, 'legacy CKO final exacto+avance 25');
  // cruce distinto → 0 marcador; avanzador distinto → 0 avance
  assert.strictEqual(legacyCKO({ saved: true, l: 2, v: 1, gol: null }, 2, 1, 'r32', {
    predHome: 'KOR', predAway: 'JPN', predAdvancer: 'KOR', realHome: 'GER', realAway: 'BRA', realAdvancer: 'GER',
  }), 0, 'legacy CKO Corea/Alemania = 0');
  // sin malla → 0 (degradación limpia)
  assert.strictEqual(legacyCKO({ saved: true, l: 2, v: 0, gol: null }, 2, 0, 'r16'), 0, 'legacy CKO sin malla = 0');
}

// Canónicos legacy calcKoPodiumPoints.
{
  const realPod = { champion: 'ARG', runnerUp: 'FRA', third: 'CRO', fourth: 'MAR' };
  assert.strictEqual(legacyCPOD({ champion: 'ARG', runnerUp: 'FRA', third: 'CRO', fourth: 'MAR' }, realPod), 75, 'legacy CPOD 4/4 = 75');
  assert.strictEqual(legacyCPOD({ champion: 'ARG' }, realPod), 30, 'legacy CPOD solo campeón = 30');
  assert.strictEqual(legacyCPOD(null, realPod), 0, 'legacy CPOD sin pred = 0');
}

// Canónicos legacy calcAwardPoints (NUEVO).
{
  const picks   = { golden_ball: 'Yamal', golden_boot: 'Mbappe', golden_glove: 'Bono',       young_player: 'Mainoo' };
  const winners = { golden_ball: 'Yamal', golden_boot: 'Mbappe', golden_glove: 'Donnarumma', young_player: 'Mainoo' };
  assert.strictEqual(legacyCAW(picks, winners), 50, 'legacy CAW 3/4 = 50');
  assert.strictEqual(legacyCAW(null, winners), 0, 'legacy CAW picks=null → 0');
  assert.strictEqual(legacyCAW(picks, null),   0, 'legacy CAW winners=null → 0');
}

// ════════════════════════════════════════════════════════════════════
// 6. PARITY shared↔legacy — calcMatchPoints (incl. boost + IA)
//    Si alguien edita un motor y olvida el otro, esto pita.
// ════════════════════════════════════════════════════════════════════
{
  // Estado global para el legacy: un partido boosteado ('Z_AAA_BBB' el
  // 2026-06-20) + IA por matchKey ('IA_ON').
  globalThis.iaBonusWillApply = (mk) => mk === 'IA_ON';
  globalThis.getMatchKey = (m) => `${m.group}_${m.home}_${m.away}`;
  globalThis.PARTIDOS = [{ group: 'Z', home: 'AAA', away: 'BBB', date: '2026-06-20T20:00:00Z' }];
  globalThis.boostPicks = { '2026-06-20': 'Z_AAA_BBB' };

  const cases = [
    { name: 'solo signo',        pred: { saved: true,  l: 2, v: 0, gol: null },     rl: 3, rv: 1, scorers: null,       ia: false, boost: false, mk: null        },
    { name: 'exacto sin gol',    pred: { saved: true,  l: 3, v: 1, gol: null },     rl: 3, rv: 1, scorers: null,       ia: false, boost: false, mk: null        },
    { name: 'exacto + gol',      pred: { saved: true,  l: 3, v: 2, gol: 'lozano' }, rl: 3, rv: 2, scorers: ['lozano'], ia: false, boost: false, mk: null        },
    { name: 'exacto + gol + IA', pred: { saved: true,  l: 3, v: 2, gol: 'lozano' }, rl: 3, rv: 2, scorers: ['lozano'], ia: true,  boost: false, mk: 'IA_ON'     },
    { name: 'empate X-X',        pred: { saved: true,  l: 0, v: 0, gol: null },     rl: 1, rv: 1, scorers: null,       ia: false, boost: false, mk: null        },
    { name: 'saved=false',       pred: { saved: false, l: 3, v: 0, gol: null },     rl: 3, rv: 0, scorers: null,       ia: false, boost: false, mk: null        },
    { name: 'signo + gol-fail',  pred: { saved: true,  l: 2, v: 1, gol: 'wrong' },  rl: 3, rv: 1, scorers: ['lozano'], ia: false, boost: false, mk: null        },
    { name: 'falla todo',        pred: { saved: true,  l: 0, v: 3, gol: 'wrong' },  rl: 3, rv: 0, scorers: ['lozano'], ia: false, boost: false, mk: null        },
    { name: 'boost exacto',      pred: { saved: true,  l: 2, v: 1, gol: null },     rl: 2, rv: 1, scorers: null,       ia: false, boost: true,  mk: 'Z_AAA_BBB' },
  ];

  for (const c of cases) {
    const sharedPts = sharedCalcMatchPoints(c.pred, c.rl, c.rv, { scorers: c.scorers, iaBonus: c.ia, boost: c.boost });
    const legacyPts = legacyCMP(c.pred, c.rl, c.rv, c.mk, c.scorers);
    assert.strictEqual(
      sharedPts, legacyPts,
      `PARITY CMP [${c.name}]: shared=${sharedPts} ≠ legacy=${legacyPts}`,
    );
  }
}

// ════════════════════════════════════════════════════════════════════
// 6b. PARITY shared↔legacy — calcKOMatchPoints (modelo §1.3, firma con malla)
//     Ambos motores reciben el MISMO opts (malla + scorers + iaPred). Si uno
//     diverge del otro en gate de cruce, orientación, avance o IA, pita aquí.
// ════════════════════════════════════════════════════════════════════
{
  globalThis.iaBonusWillApply = () => false; // legacy calcMatchPoints con matchKey=null
  const M = { predHome: 'MEX', predAway: 'KOR', predAdvancer: 'MEX', realHome: 'MEX', realAway: 'KOR', realAdvancer: 'MEX' };
  const koCases = [
    { name: 'r16 exacto+avance',  pred: { saved: true, l: 2, v: 0, gol: null }, rl: 2, rv: 0, round: 'r16',   opts: { ...M } },
    { name: 'sf signo+avance',    pred: { saved: true, l: 2, v: 1, gol: null }, rl: 3, rv: 1, round: 'sf',    opts: { ...M } },
    { name: 'qf exacto+avance',   pred: { saved: true, l: 1, v: 0, gol: null }, rl: 1, rv: 0, round: 'qf',    opts: { ...M } },
    { name: 'final exacto+25',    pred: { saved: true, l: 2, v: 0, gol: null }, rl: 2, rv: 0, round: 'final', opts: { ...M } },
    { name: 'third exacto sinAv', pred: { saved: true, l: 1, v: 0, gol: null }, rl: 1, rv: 0, round: 'third', opts: { ...M } },
    { name: 'cruce distinto',     pred: { saved: true, l: 2, v: 1, gol: null }, rl: 2, rv: 1, round: 'r32',   opts: { predHome: 'KOR', predAway: 'JPN', predAdvancer: 'KOR', realHome: 'GER', realAway: 'BRA', realAdvancer: 'GER' } },
    { name: 'avanzador-solo',     pred: { saved: true, l: 3, v: 0, gol: null }, rl: 1, rv: 0, round: 'qf',    opts: { predHome: 'FRA', predAway: 'BRA', predAdvancer: 'FRA', realHome: 'FRA', realAway: 'ITA', realAdvancer: 'FRA' } },
    { name: 'orientación swap',   pred: { saved: true, l: 0, v: 2, gol: null }, rl: 2, rv: 0, round: 'r16',   opts: { predHome: 'MEX', predAway: 'KOR', predAdvancer: 'KOR', realHome: 'KOR', realAway: 'MEX', realAdvancer: 'KOR' } },
    { name: 'gol r16',            pred: { saved: true, l: 2, v: 0, gol: 'lozano' }, rl: 2, rv: 0, round: 'r16', opts: { ...M, scorers: ['lozano'] } },
    { name: 'gol-fail r16',       pred: { saved: true, l: 2, v: 0, gol: 'wrong' }, rl: 2, rv: 1, round: 'r16', opts: { ...M, scorers: ['lozano'] } },
    { name: 'IA KO bonus',        pred: { saved: true, l: 0, v: 1, gol: null }, rl: 0, rv: 1, round: 'r16',   opts: { ...M, iaPred: { sign: '1' } } },
    { name: 'sin malla',          pred: { saved: true, l: 2, v: 0, gol: null }, rl: 2, rv: 0, round: 'r16',   opts: {} },
  ];
  for (const c of koCases) {
    const sharedPts = sharedCalcKOMatchPoints(c.pred, c.rl, c.rv, c.round, c.opts);
    const legacyPts = legacyCKO(c.pred, c.rl, c.rv, c.round, c.opts);
    assert.strictEqual(
      sharedPts, legacyPts,
      `PARITY CKO [${c.name}]: shared=${sharedPts} ≠ legacy=${legacyPts}`,
    );
  }
}

// ════════════════════════════════════════════════════════════════════
// 6d. PARITY shared↔legacy — calcKoPodiumPoints
// ════════════════════════════════════════════════════════════════════
{
  const realPod = { champion: 'ARG', runnerUp: 'FRA', third: 'CRO', fourth: 'MAR' };
  const podCases = [
    { name: '4/4',   pred: { champion: 'ARG', runnerUp: 'FRA', third: 'CRO', fourth: 'MAR' } },
    { name: 'champ', pred: { champion: 'ARG', runnerUp: 'X', third: 'Y', fourth: 'Z' } },
    { name: '2y4',   pred: { champion: 'X', runnerUp: 'FRA', third: 'Y', fourth: 'MAR' } },
    { name: '0/4',   pred: { champion: 'A', runnerUp: 'B', third: 'C', fourth: 'D' } },
    { name: 'null',  pred: null },
  ];
  for (const c of podCases) {
    const sharedPts = sharedCalcKoPodiumPoints(c.pred, realPod);
    const legacyPts = legacyCPOD(c.pred, realPod);
    assert.strictEqual(sharedPts, legacyPts, `PARITY CPOD [${c.name}]: shared=${sharedPts} ≠ legacy=${legacyPts}`);
  }
}

// ════════════════════════════════════════════════════════════════════
// 6c. PARITY shared↔legacy — calcAwardPoints
// ════════════════════════════════════════════════════════════════════
{
  const awCases = [
    { name: '3/4',        picks:   { golden_ball: 'Yamal', golden_boot: 'Mbappe', golden_glove: 'Bono', young_player: 'Mainoo' },
                          winners: { golden_ball: 'Yamal', golden_boot: 'Mbappe', golden_glove: 'Donnarumma', young_player: 'Mainoo' } },
    { name: '0/4',        picks:   { golden_ball: 'A', golden_boot: 'B', golden_glove: 'C', young_player: 'D' },
                          winners: { golden_ball: 'W', golden_boot: 'X', golden_glove: 'Y', young_player: 'Z' } },
    { name: 'solo joven', picks:   { golden_ball: null, golden_boot: null, golden_glove: null, young_player: 'Mainoo' },
                          winners: { golden_ball: 'Yamal', golden_boot: 'Mbappe', golden_glove: 'Bono', young_player: 'Mainoo' } },
    { name: 'picks null', picks: null, winners: { golden_ball: 'Yamal' } },
  ];
  for (const c of awCases) {
    const sharedPts = sharedCalcAwardPoints(c.picks, c.winners);
    const legacyPts = legacyCAW(c.picks, c.winners);
    assert.strictEqual(
      sharedPts, legacyPts,
      `PARITY CAW [${c.name}]: shared=${sharedPts} ≠ legacy=${legacyPts}`,
    );
  }
}

// ════════════════════════════════════════════════════════════════════
// 7. EF ASSEMBLY — guard del mapeo `scorer` (BD) → `gol` (motor)
//
// El motor _shared/scoring.mjs lee pred.gol (espejo del browser). Las
// tablas predictions/ko_predictions guardan la columna como `scorer`.
// La EF get-league-standings hace el mapeo `gol: row.scorer` en index.ts;
// si alguien lo olvida, el +2 de goleador NUNCA suma (bug detectado en
// QA del PR-1 v1: la EF montaba `scorer: row.scorer` y los tests del
// motor puro no lo cazaban porque usan `gol` directamente).
//
// Este test ejercita el mapeo: si la EF lo rompe de nuevo, falla.
// ════════════════════════════════════════════════════════════════════
{
  // Mini-imitación del mapeo de get-league-standings/index.ts (predsByUser).
  function mapPredFromDbRow(p) {
    return { l: p.local, v: p.visitante, gol: p.scorer, saved: true };
  }
  const dbRow = { local: 3, visitante: 2, scorer: 'lozano' };
  const pred = mapPredFromDbRow(dbRow);
  // Exacto 3-2 + goleador acertado → 1 (signo) + 3 (exacto) + 2 (gol) = 6
  assert.strictEqual(
    sharedCalcMatchPoints(pred, 3, 2, { scorers: ['lozano'] }),
    6,
    'EF assembly grupos: row con scorer mapeado a gol debe sumar +2',
  );
  // Regresión guard: si alguien REVIERTE el mapeo y deja `scorer` raw,
  // el motor NO suma goleador → solo +1 +3 = 4.
  const badMap = { l: 3, v: 2, scorer: 'lozano', saved: true };
  assert.strictEqual(
    sharedCalcMatchPoints(badMap, 3, 2, { scorers: ['lozano'] }),
    4,
    'EF assembly grupos REGRESIÓN: sin mapear scorer→gol el motor NO suma goleador',
  );
}
{
  // Mismo guard para ko_predictions (koByUser en la EF).
  function mapKoFromDbRow(k) {
    return { l: k.local, v: k.visitante, gol: k.scorer, classifier: k.classifier, saved: true };
  }
  // pred 2-0 vs real 2-1: signo OK, NO exacto, goleador acertado. Cruce coincide
  // (MEX/KOR), avanzador coincide (MEX). r16: signo +1 + goleador +2 + avance +10 = 13.
  const dbRow = { local: 2, visitante: 0, scorer: 'lozano', classifier: null };
  const pred = mapKoFromDbRow(dbRow);
  assert.strictEqual(
    sharedCalcKOMatchPoints(pred, 2, 1, 'r16', {
      scorers: ['lozano'],
      predHome: 'MEX', predAway: 'KOR', predAdvancer: 'MEX',
      realHome: 'MEX', realAway: 'KOR', realAdvancer: 'MEX',
    }),
    13,
    'EF assembly KO: row scorer→gol + avance r16',
  );
}

// ════════════════════════════════════════════════════════════════════
// 8. EF ASSEMBLY — boost ×2 grupos-only (B2/T1)
//
// La EF construye boostByUser[uid]=Set(match_id) desde boost_picks y pasa
// boost: boostByUser[uid]?.has(matchId) a calcMatchPoints SOLO en grupos.
// Imitamos ese ensamblado para cazar regresiones del wiring del boost.
// ════════════════════════════════════════════════════════════════════
{
  const boostByUser = { u1: new Set(['A_Mex_Cro', 'B_Esp_Por']) };
  const has = (uid, mid) => boostByUser[uid]?.has(mid) ?? false;

  // R3: el ×2 exige exacto Y goleador — exacto+gol acertado → 6 × 2 = 12.
  assert.strictEqual(
    sharedCalcMatchPoints({ saved: true, l: 2, v: 1, gol: 'lozano' }, 2, 1, { scorers: ['lozano'], boost: has('u1', 'A_Mex_Cro') }),
    12,
    'EF assembly boost: match boosteado + exacto + goleador → ×2',
  );
  // R3: exacto solo (sin goleador) en match boosteado → NO dobla = 4.
  assert.strictEqual(
    sharedCalcMatchPoints({ saved: true, l: 2, v: 1, gol: null }, 2, 1, { boost: has('u1', 'A_Mex_Cro') }),
    4,
    'EF assembly boost (R3): exacto sin goleador NO dobla',
  );
  // u1 sin boost en match no boosteado → 4 (sin doblar).
  assert.strictEqual(
    sharedCalcMatchPoints({ saved: true, l: 2, v: 1, gol: null }, 2, 1, { boost: has('u1', 'C_Bra_Mar') }),
    4,
    'EF assembly boost: match NO boosteado → sin ×2',
  );
  // user sin boost_picks → boost false siempre.
  assert.strictEqual(
    sharedCalcMatchPoints({ saved: true, l: 2, v: 1, gol: null }, 2, 1, { boost: has('u2', 'A_Mex_Cro') }),
    4,
    'EF assembly boost: user sin picks → false',
  );
}

// ════════════════════════════════════════════════════════════════════
// 9. REGLA 0-0 — goleador opcional (canónica, confirmada San 10-jun-2026)
//
// Al pronosticar 0-0 el goleador es opcional: su ausencia es la apuesta
// "sin goleador". pred 0-0 + real 0-0 + sin gol → +2 de goleador (6 base).
// Con gol registrado y real 0-0, la apuesta de goleador falla (4). Cap 7 y
// boost ×2 sobre exacto intactos. Ver docs/scoring-engine.md §Regla 0-0.
// ════════════════════════════════════════════════════════════════════
{
  // Caso 1 (brief): pred 0-0 sin goleador vs real 0-0 → 1+3+2 = 6.
  assert.strictEqual(
    sharedCalcMatchPoints({ saved: true, l: 0, v: 0, gol: null }, 0, 0, { scorers: [] }),
    6,
    'regla00 #1: 0-0 sin goleador vs real 0-0 = 6',
  );
  // Caso 2 (brief): pred 0-0 CON goleador vs real 0-0 → la apuesta falla → 4.
  assert.strictEqual(
    sharedCalcMatchPoints({ saved: true, l: 0, v: 0, gol: 'lozano' }, 0, 0, { scorers: [] }),
    4,
    'regla00 #2: 0-0 con goleador vs real 0-0 = 4 (apuesta de gol falla)',
  );
  // Caso 3 (brief): pred 0-0 sin goleador + boost vs real 0-0 → (1+3+2)×2 = 12.
  assert.strictEqual(
    sharedCalcMatchPoints({ saved: true, l: 0, v: 0, gol: null }, 0, 0, { scorers: [], boost: true }),
    12,
    'regla00 #3: 0-0 sin goleador + boost = 12',
  );
  // Caso 4 (brief): pred 1-1 sin goleador vs real 0-0 → solo signo X = 1.
  assert.strictEqual(
    sharedCalcMatchPoints({ saved: true, l: 1, v: 1, gol: null }, 0, 0, { scorers: [] }),
    1,
    'regla00 #4: 1-1 sin goleador vs real 0-0 = 1 (la regla exige pred 0-0 exacto)',
  );
  // Defensivos: la regla NO dispara si el real no es 0-0…
  assert.strictEqual(
    sharedCalcMatchPoints({ saved: true, l: 0, v: 0, gol: null }, 1, 1, { scorers: ['lozano'] }),
    1,
    'regla00 #5: pred 0-0 vs real 1-1 = 1 (solo signo; sin +2)',
  );
  // …y con iaBonus el cap 7 sigue mandando: 1+3+2+1 = 7.
  assert.strictEqual(
    sharedCalcMatchPoints({ saved: true, l: 0, v: 0, gol: null }, 0, 0, { scorers: [], iaBonus: true }),
    7,
    'regla00 #6: 0-0 sin gol + iaBonus = 7 (cap)',
  );
}

// ════════════════════════════════════════════════════════════════════
// 9b. PARIDAD shared↔legacy de la regla 0-0 — si un motor la lleva y el
//     otro no, pita aquí (mismo patrón que la sección 6).
// ════════════════════════════════════════════════════════════════════
{
  globalThis.iaBonusWillApply = () => false;
  globalThis.PARTIDOS = [{ group: 'Z', home: 'AAA', away: 'BBB', date: '2026-06-20T20:00:00Z' }];
  globalThis.boostPicks = { '2026-06-20': 'Z_AAA_BBB' };

  const zeroCases = [
    { name: '0-0 sin gol vs 0-0',         pred: { saved: true, l: 0, v: 0, gol: null },     rl: 0, rv: 0, scorers: [], boost: false, mk: null        },
    { name: '0-0 con gol vs 0-0',         pred: { saved: true, l: 0, v: 0, gol: 'lozano' }, rl: 0, rv: 0, scorers: [], boost: false, mk: null        },
    { name: '0-0 sin gol + boost vs 0-0', pred: { saved: true, l: 0, v: 0, gol: null },     rl: 0, rv: 0, scorers: [], boost: true,  mk: 'Z_AAA_BBB' },
    { name: '1-1 sin gol vs 0-0',         pred: { saved: true, l: 1, v: 1, gol: null },     rl: 0, rv: 0, scorers: [], boost: false, mk: null        },
    { name: '0-0 sin gol vs 1-1',         pred: { saved: true, l: 0, v: 0, gol: null },     rl: 1, rv: 1, scorers: [], boost: false, mk: null        },
  ];
  for (const c of zeroCases) {
    const sharedPts = sharedCalcMatchPoints(c.pred, c.rl, c.rv, { scorers: c.scorers, iaBonus: false, boost: c.boost });
    const legacyPts = legacyCMP(c.pred, c.rl, c.rv, c.mk, c.scorers);
    assert.strictEqual(
      sharedPts, legacyPts,
      `PARITY regla00 [${c.name}]: shared=${sharedPts} ≠ legacy=${legacyPts}`,
    );
  }
  // KO hereda la regla 0-0 vía calcKOMatchPoints: cruce coincide, 0-0 sin gol
  // vs real 0-0 → marcador 6 (1+3+2) + avance r32 por equipo (5) = 11, en
  // ambos motores. Paridad shared↔legacy con la misma malla.
  const koMesh00 = { scorers: [], predHome: 'A', predAway: 'B', predAdvancer: 'A', realHome: 'A', realAway: 'B', realAdvancer: 'A' };
  const sharedKo = sharedCalcKOMatchPoints({ saved: true, l: 0, v: 0, gol: null }, 0, 0, 'r32', koMesh00);
  const legacyKo = legacyCKO({ saved: true, l: 0, v: 0, gol: null }, 0, 0, 'r32', koMesh00);
  assert.strictEqual(sharedKo, 11, 'regla00 KO shared: 0-0 sin gol (6) + avance r32 (5) = 11');
  assert.strictEqual(legacyKo, 11, 'regla00 KO legacy: 0-0 sin gol (6) + avance r32 (5) = 11');
}

// ════════════════════════════════════════════════════════════════════
// 10. MATCHER NORMALIZADO DE GOLEADOR (ERR-93)
//
// El +2 de goleador debe casar aunque la key persistida difiera en
// caja/acentos/jr-junior de la predicha (scorer "vinicius" vs pred
// "Vinicius"). Cubre el escenario raíz del bug (feed "Vinicius Junior" →
// "Junior" persistido) en AMBOS motores, con paridad shared↔legacy.
// ════════════════════════════════════════════════════════════════════
{
  // shared — caja distinta (p.ej. proveniente del fallback del bridge) casa.
  assert.strictEqual(
    sharedCalcMatchPoints({ saved: true, l: 2, v: 1, gol: 'Vinicius' }, 2, 1, { scorers: ['vinicius'] }),
    6, 'norm shared #1: caja distinta casa (1+3+2)',
  );
  // shared — acentos casan.
  assert.strictEqual(
    sharedCalcMatchPoints({ saved: true, l: 1, v: 0, gol: 'Jimenez' }, 1, 0, { scorers: ['Jiménez'] }),
    6, 'norm shared #2: acentos casan',
  );
  // shared — jugador distinto NO casa (sin falso positivo por subcadena).
  assert.strictEqual(
    sharedCalcMatchPoints({ saved: true, l: 1, v: 0, gol: 'Jimenez' }, 1, 0, { scorers: ['Gimenez'] }),
    4, 'norm shared #3: Giménez ≠ Jiménez (sin +2)',
  );

  // legacy — paridad exacta de los 3 casos (sin boost ni IA).
  globalThis.iaBonusWillApply = () => false;
  globalThis.PARTIDOS = [];
  globalThis.boostPicks = {};
  assert.strictEqual(legacyCMP({ saved: true, l: 2, v: 1, gol: 'Vinicius' }, 2, 1, null, ['vinicius']), 6, 'norm legacy #1: caja');
  assert.strictEqual(legacyCMP({ saved: true, l: 1, v: 0, gol: 'Jimenez' }, 1, 0, null, ['Jiménez']), 6, 'norm legacy #2: acentos');
  assert.strictEqual(legacyCMP({ saved: true, l: 1, v: 0, gol: 'Jimenez' }, 1, 0, null, ['Gimenez']), 4, 'norm legacy #3: Giménez≠Jiménez');
}

console.log('✓ scoring tests pasados: shared (canónicos + KO + awards + iaBonus + boost + regla 0-0 + matcher normalizado) + legacy por marcadores + parity 1:1 (CMP+CKO+CAW+regla00+norm) + EF assembly (scorer→gol + boost)');

// === 11. ERR-97 — matchPlayerKey: token no distintivo resuelve key erronea ===
// Regresion de las mal-atribuciones de produccion (van Hecke->VanDijk,
// Agustin Cano->Canobbio) + guarda anti-regresion ERR-93 (Vinicius). El
// resolver replica playerToShortKey del bridge: matchPlayerKey o fallbackKey.
{
  const resolve = (name, players) => {
    const m = matchPlayerKey(name, players);
    return (m && m.key) ? m.key : fallbackKey(name);
  };
  // equipos_players (8/equipo): van Hecke NO esta en NED; Cano NO esta en URU.
  const NED = [{ key: 'VanDijk', name: 'Virgil van Dijk' }, { key: 'Depay', name: 'Memphis Depay' }, { key: 'Gakpo', name: 'Cody Gakpo' }];
  const URU = [{ key: 'Canobbio', name: 'Agustin Canobbio' }, { key: 'Nunez', name: 'Darwin Nunez' }, { key: 'Pellistri', name: 'Facundo Pellistri' }];
  const BRA = [{ key: 'Vinicius', name: 'Vinicius Junior' }, { key: 'Raphinha', name: 'Raphinha' }, { key: 'Rodrygo', name: 'Rodrygo' }];
  const KOR = [{ key: 'Hwang', name: 'Hwang In-beom' }, { key: 'Heechan', name: 'Hwang Hee-chan' }, { key: 'SonHM', name: 'Son Heung-min' }];
  const CAN = [{ key: 'PromiseDavid', name: 'Promise David' }, { key: 'David', name: 'Jonathan David' }, { key: 'Davies', name: 'Alphonso Davies' }];
  const PAR = [{ key: 'Magalhaes', name: 'Mauricio Magalhaes' }, { key: 'Almiron', name: 'Miguel Almiron' }];

  assert.strictEqual(resolve('Jan Paul van Hecke', NED), 'Hecke', 'ERR-97 A: van Hecke -> fallback Hecke, NO VanDijk');
  assert.strictEqual(resolve('Agustin Cano', URU), 'Cano', 'ERR-97 B: Agustin Cano -> fallback Cano, NO Canobbio');
  assert.strictEqual(resolve('Vinicius Junior', BRA), 'Vinicius', 'ERR-97 guarda ERR-93: Vinicius Junior -> Vinicius');
  assert.strictEqual(resolve('Hwang In-Beom', KOR), 'Hwang', 'ERR-97: Hwang In-Beom -> Hwang, NO Heechan');
  assert.strictEqual(resolve('Promise David', CAN), 'PromiseDavid', 'ERR-97: Promise David -> PromiseDavid, NO David');
  assert.strictEqual(resolve('Mauricio', PAR), 'Magalhaes', 'ERR-97: Mauricio nombre de pila -> Magalhaes (no rompe match legitimo)');

  assert.strictEqual(matchPlayerKey('Jan Paul van Hecke', NED), null, 'ERR-97: van Hecke no resuelve key (apellido Hecke ausente del roster)');
  assert.strictEqual(matchPlayerKey('Agustin Cano', URU), null, 'ERR-97: Agustin Cano no resuelve (Cano != Canobbio)');
  assert.strictEqual(matchPlayerKey('Vinicius Junior', BRA).key, 'Vinicius', 'ERR-97: Vinicius resuelve por apellido distintivo');
  const KSA = [{ key: 'Alshehri', name: 'Saleh Alshehri' }, { key: 'Aldawsari', name: 'Salem Aldawsari' }];
  assert.strictEqual(resolve('Saleh Al-Shehri', KSA), 'Alshehri', 'ERR-97 KSA: articulo concatenado Al-Shehri -> Alshehri');
  assert.strictEqual(matchPlayerKey('Saleh Al-Shehri', KSA).key, 'Alshehri', 'ERR-97 KSA: matchPlayerKey resuelve articulo+apellido');
}

// ERR-97 Fix 2 — resolveScorerKey: cualifica el fallback que colisiona con un
// pickable del RIVAL (Yasin Ayari SWE fallback "Ayari" vs Khalil Ayari TUN).
{
  // colision con rival → cualifica con iso3
  assert.deepEqual(
    resolveScorerKey('Yasin Ayari', 'SWE', [], [{ key: 'Ayari', name: 'Khalil Ayari' }]),
    { key: 'SWE__Ayari', status: 'unresolved_qualified' });
  // resuelto a pickable propio → sin cambios
  assert.deepEqual(
    resolveScorerKey('Alexander Isak', 'SWE', [{ key: 'Isak', name: 'Alexander Isak' }], []),
    { key: 'Isak', status: 'resolved' });
  // fallback sin colision con rival → key pelada
  assert.deepEqual(
    resolveScorerKey('Jan Paul van Hecke', 'NED', [], [{ key: 'Mastouri', name: 'Hazem Mastouri' }]),
    { key: 'Hecke', status: 'unresolved' });
  // scorerMatches descarta la key cualificada y mantiene las normales
  assert.equal(scorerMatches(['SWE__Ayari', 'Isak'], 'Ayari'), false);
  assert.equal(scorerMatches(['SWE__Ayari', 'Isak'], 'Isak'), true);
}

console.log('OK ERR-97 matchPlayerKey regression: particulas peso 0 + apellido obligatorio + guarda ERR-93');
console.log('OK ERR-97 Fix 2 resolveScorerKey: fallback colisionante con rival se cualifica con iso3');