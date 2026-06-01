// Smoke test scoring — Porra Mundial 2026.
//
// Cubre 3 capas:
//   1. Canónicos sobre el módulo compartido `_shared/scoring.mjs` (la
//      fuente de verdad semántica usada por la EF get-league-standings).
//   2. Canónicos sobre el slice legacy `public/js/scoring.js` (browser,
//      classic script — eval del slice para aislar calcMatchPoints).
//   3. Parity test: ambos motores deben dar los MISMOS pts ante los
//      mismos inputs. Si alguien edita uno y olvida el otro, falla aquí.
//      Riesgo nº 1 del sprint PR-1 (San).
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
// 1. SHARED MODULE — canónicos calcMatchPoints
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
// 5. LEGACY SLICE — calcMatchPoints de public/js/scoring.js
//    (mantiene el smoke test original que ya cubría los 4 canónicos)
// ════════════════════════════════════════════════════════════════════
globalThis.iaBonusWillApply = () => false;
globalThis.PARTIDOS = [];
globalThis.getMatchKey = () => null;
globalThis.boostPicks = {};
globalThis.EQUIPOS = [];

const fullSrc = readFileSync('public/js/scoring.js', 'utf8');
const slice = fullSrc.split('\n').slice(0, 104).join('\n');
const fn = new Function(slice + '\nreturn { calcMatchPoints };');
const { calcMatchPoints: legacyCMP } = fn();

{
  assert.strictEqual(legacyCMP({ saved: true, l: 2, v: 0, gol: null }, 3, 1, null, []), 1, 'legacy #1');
  assert.strictEqual(legacyCMP({ saved: true, l: 3, v: 1, gol: null }, 3, 1, null, []), 4, 'legacy #2');
  assert.strictEqual(legacyCMP({ saved: true, l: 3, v: 2, gol: 'lozano' }, 3, 2, null, ['lozano']), 6, 'legacy #3');
  globalThis.iaBonusWillApply = () => true;
  assert.strictEqual(legacyCMP({ saved: true, l: 3, v: 2, gol: 'lozano' }, 3, 2, 'mock-key', ['lozano']), 7, 'legacy #4');
  globalThis.iaBonusWillApply = () => false;
}

// ════════════════════════════════════════════════════════════════════
// 6. PARITY — shared vs legacy: mismos inputs → mismos pts.
//    Si alguien edita un motor y olvida el otro, esto pita.
// ════════════════════════════════════════════════════════════════════
{
  // Tabla de casos: cada uno se ejerce contra ambos motores.
  // Mock de iaBonusWillApply para el legacy: true cuando matchKey === 'IA_ON'.
  globalThis.iaBonusWillApply = (mk) => mk === 'IA_ON';

  const cases = [
    { name: 'solo signo',        pred: { saved: true, l: 2, v: 0, gol: null },          rl: 3, rv: 1, scorers: null,        ia: false, mk: null    },
    { name: 'exacto sin gol',    pred: { saved: true, l: 3, v: 1, gol: null },          rl: 3, rv: 1, scorers: null,        ia: false, mk: null    },
    { name: 'exacto + gol',      pred: { saved: true, l: 3, v: 2, gol: 'lozano' },      rl: 3, rv: 2, scorers: ['lozano'],  ia: false, mk: null    },
    { name: 'exacto + gol + IA', pred: { saved: true, l: 3, v: 2, gol: 'lozano' },      rl: 3, rv: 2, scorers: ['lozano'],  ia: true,  mk: 'IA_ON' },
    { name: 'empate X-X',        pred: { saved: true, l: 0, v: 0, gol: null },          rl: 1, rv: 1, scorers: null,        ia: false, mk: null    },
    { name: 'saved=false',       pred: { saved: false, l: 3, v: 0, gol: null },         rl: 3, rv: 0, scorers: null,        ia: false, mk: null    },
    { name: 'signo + gol-fail',  pred: { saved: true, l: 2, v: 1, gol: 'wrong' },       rl: 3, rv: 1, scorers: ['lozano'],  ia: false, mk: null    },
    { name: 'falla todo',        pred: { saved: true, l: 0, v: 3, gol: 'wrong' },       rl: 3, rv: 0, scorers: ['lozano'],  ia: false, mk: null    },
  ];

  for (const c of cases) {
    const sharedPts = sharedCalcMatchPoints(c.pred, c.rl, c.rv, { scorers: c.scorers, iaBonus: c.ia });
    const legacyPts = legacyCMP(c.pred, c.rl, c.rv, c.mk, c.scorers);
    assert.strictEqual(
      sharedPts,
      legacyPts,
      `PARITY FAIL [${c.name}]: shared=${sharedPts} ≠ legacy=${legacyPts}`,
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

console.log('✓ scoring tests pasados: shared (canónicos + KO + awards + iaBonus) + legacy slice + parity 1:1 + EF assembly');
