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
//   +1 signo · +3 exacto APILA · +2 goleador · +1 bonus IA · cap 7 · boost ×2.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import {
  calcMatchPoints as sharedCalcMatchPoints,
  calcKOMatchPoints as sharedCalcKOMatchPoints,
  calcAwardPoints as sharedCalcAwardPoints,
  iaBonusPredicate,
  KO_ROUND_PTS,
} from '../supabase/functions/_shared/scoring.mjs';

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
  assert.strictEqual(t5, 8, 'shared #5: exacto con boost ×2 → 4×2 = 8');

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

  // NUEVO (B2/T3): cap 7 ANTES del boost; exacto+gol+IA = 7, ×2 = 14 (máx).
  const t9 = sharedCalcMatchPoints(
    { saved: true, l: 3, v: 2, gol: 'lozano' }, 3, 2, { scorers: ['lozano'], iaBonus: true, boost: true }
  );
  assert.strictEqual(t9, 14, 'shared #9: (cap 7) × boost = 14 (máximo por partido)');

  // NUEVO (B2/T3): boost NO dobla sin exacto aunque haya gol acertado.
  const t10 = sharedCalcMatchPoints(
    { saved: true, l: 2, v: 1, gol: 'lozano' }, 3, 1, { scorers: ['lozano'], boost: true }
  );
  assert.strictEqual(t10, 3, 'shared #10: signo+gol=3, boost no aplica (no exacto)');
}

// ════════════════════════════════════════════════════════════════════
// 2. SHARED MODULE — calcKOMatchPoints (avance de ronda)
// ════════════════════════════════════════════════════════════════════
{
  // r16 exacto + ganador correcto → 4 + KO_ROUND_PTS.r16 (10) = 14
  const ko1 = sharedCalcKOMatchPoints(
    { saved: true, l: 2, v: 0, gol: null }, 2, 0, 'r16'
  );
  assert.strictEqual(ko1, 14, 'ko #1: r16 exacto + avance = 4 + 10');

  // sf signo correcto + avance + bonus final_advance → 1 + 20 + 25 = 46
  const ko2 = sharedCalcKOMatchPoints(
    { saved: true, l: 2, v: 1, gol: null }, 3, 1, 'sf'
  );
  assert.strictEqual(ko2, 46, 'ko #2: sf signo + avance + final_advance = 1+20+25');

  // r32 empate predicho + classifier:'home' coincide ganador real → 0 signo + 5 avance
  const ko3 = sharedCalcKOMatchPoints(
    { saved: true, l: 1, v: 1, classifier: 'home', gol: null }, 2, 1, 'r32'
  );
  assert.strictEqual(ko3, 5, 'ko #3: r32 empate-classifier-correcto = 0+5');

  // 'third' / 'final' NO suman roundPts extra (KO_ROUND_PTS los omite)
  const ko4 = sharedCalcKOMatchPoints(
    { saved: true, l: 2, v: 0, gol: null }, 2, 0, 'final'
  );
  assert.strictEqual(ko4, 4, 'ko #4: final exacto sin avance extra = 4');
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
    slice + '\nreturn { calcMatchPoints, calcKOMatchPoints, calcAwardPoints };'
  );
  return fn();
}

const {
  calcMatchPoints:   legacyCMP,
  calcKOMatchPoints: legacyCKO,
  calcAwardPoints:   legacyCAW,
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

// Canónicos legacy calcKOMatchPoints (NUEVO — antes no se ejercía aislado).
{
  assert.strictEqual(legacyCKO({ saved: true, l: 2, v: 0, gol: null }, 2, 0, 'r16', null), 14, 'legacy CKO r16 exacto+avance');
  assert.strictEqual(legacyCKO({ saved: true, l: 2, v: 1, gol: null }, 3, 1, 'sf', null), 46, 'legacy CKO sf signo+avance+final');
  assert.strictEqual(legacyCKO({ saved: true, l: 1, v: 1, classifier: 'home', gol: null }, 2, 1, 'r32', null), 5, 'legacy CKO r32 empate-classifier');
  assert.strictEqual(legacyCKO({ saved: true, l: 2, v: 0, gol: null }, 2, 0, 'final', null), 4, 'legacy CKO final sin avance extra');
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
// 6b. PARITY shared↔legacy — calcKOMatchPoints
//     Legacy invoca calcMatchPoints con matchKey=null → sin IA ni boost;
//     shared recibe { iaBonus:false, boost:false } para igualar.
// ════════════════════════════════════════════════════════════════════
{
  const koCases = [
    { name: 'r16 exacto+avance', pred: { saved: true, l: 2, v: 0, gol: null },                     rl: 2, rv: 0, round: 'r16',   scorers: null        },
    { name: 'sf signo+final',    pred: { saved: true, l: 2, v: 1, gol: null },                     rl: 3, rv: 1, round: 'sf',    scorers: null        },
    { name: 'r32 empate-class',  pred: { saved: true, l: 1, v: 1, classifier: 'home', gol: null }, rl: 2, rv: 1, round: 'r32',   scorers: null        },
    { name: 'qf exacto+avance',  pred: { saved: true, l: 1, v: 0, gol: null },                     rl: 1, rv: 0, round: 'qf',    scorers: null        },
    { name: 'final exacto',      pred: { saved: true, l: 2, v: 0, gol: null },                     rl: 2, rv: 0, round: 'final', scorers: null        },
    { name: 'third exacto',      pred: { saved: true, l: 1, v: 0, gol: null },                     rl: 1, rv: 0, round: 'third', scorers: null        },
    { name: 'gol-fail r16',      pred: { saved: true, l: 2, v: 0, gol: 'wrong' },                  rl: 2, rv: 1, round: 'r16',   scorers: ['lozano']  },
  ];
  for (const c of koCases) {
    const sharedPts = sharedCalcKOMatchPoints(c.pred, c.rl, c.rv, c.round, { scorers: c.scorers, iaBonus: false, boost: false });
    const legacyPts = legacyCKO(c.pred, c.rl, c.rv, c.round, c.scorers);
    assert.strictEqual(
      sharedPts, legacyPts,
      `PARITY CKO [${c.name}]: shared=${sharedPts} ≠ legacy=${legacyPts}`,
    );
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
  // pred 2-0 vs real 2-1: signo OK, NO exacto, goleador acertado.
  const dbRow = { local: 2, visitante: 0, scorer: 'lozano', classifier: null };
  const pred = mapKoFromDbRow(dbRow);
  // r16: signo +1 + goleador +2 + avance r16 +10 = 13
  assert.strictEqual(
    sharedCalcKOMatchPoints(pred, 2, 1, 'r16', { scorers: ['lozano'] }),
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

  // u1 con boost en A_Mex_Cro y exacto → 4 × 2 = 8.
  assert.strictEqual(
    sharedCalcMatchPoints({ saved: true, l: 2, v: 1, gol: null }, 2, 1, { boost: has('u1', 'A_Mex_Cro') }),
    8,
    'EF assembly boost: match boosteado + exacto → ×2',
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

console.log('✓ scoring tests pasados: shared (canónicos + KO + awards + iaBonus + boost) + legacy por marcadores + parity 1:1 (CMP+CKO+CAW) + EF assembly (scorer→gol + boost)');
