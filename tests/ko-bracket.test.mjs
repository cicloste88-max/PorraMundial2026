// Tests ko-bracket — Porra Mundial 2026.
//
// Cubre el API de `supabase/functions/_shared/ko-bracket.mjs` (bracket dinámico
// compartido entre backfill-ko-classifiers y send-porra-receipt), en concreto
// `resolveBracket(predictionRows, koPredictionRows)` con rows en forma de BD:
//   1. Cruces HOME vs AWAY por slot (R32 desde grupos, R16+ en cascada).
//   2. Podium {champion, runnerUp, third, fourth} desde slots 104/103.
//   3. Empates decididos por classifier (incl. literal "home" — HF-09).
//   4. Slots irresolubles → home/away/winner null sin romper el resto.
//
// La lógica interna (tablas, terceros Anexo C, orden estable) ya está cubierta
// por tests/backfill-ko-classifiers.test.mjs — aquí se testea el contrato rows→bracket.
//
// Contexto: BRIEF_RENDER_KO_CROSSES.md (cruce de cada slot en el comprobante).
import { test } from 'node:test';
import assert from 'node:assert';
import { GRUPOS } from '../supabase/functions/_shared/ko-data.mjs';
import { ALL_KO_SLOTS, resolveBracket } from '../supabase/functions/_shared/ko-bracket.mjs';

// Mismas fixtures deterministas que backfill-ko-classifiers.test.mjs, pero en
// forma de ROWS de BD: t0 gana 3-0, t1 2-0, t2 1-0 → 1X=equipos[0],
// 2X=equipos[1], 3X=equipos[2]; mejores terceros = grupos A..H ("ABCDEFGH").
const PAIRINGS = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]];
function buildPredictionRows() {
  const rows = [];
  GRUPOS.forEach((g) => {
    PAIRINGS.forEach(([hi, ai]) => {
      rows.push({
        match_id: `${g.letra}_${g.equipos[hi]}_${g.equipos[ai]}`,
        local: hi === 0 ? 3 : hi === 1 ? 2 : 1,
        visitante: 0,
      });
    });
  });
  return rows;
}

function buildKoRowsHomeWins() {
  return ALL_KO_SLOTS.map((m) => ({
    match_id: m.id, local: 2, visitante: 1, classifier: null, scorer: null,
  }));
}

const team = (letra, idx) => GRUPOS.find((g) => g.letra === letra).equipos[idx];

test('resolveBracket: cruces R32 desde slots de grupo (73 = 2A vs 2B, 79 = 1A vs T_CEFHI)', () => {
  const { slots } = resolveBracket(buildPredictionRows(), buildKoRowsHomeWins());
  assert.strictEqual(slots[73].home, team('A', 1));
  assert.strictEqual(slots[73].away, team('B', 1));
  assert.strictEqual(slots[73].winner, team('A', 1)); // 2-1 gana home
  assert.strictEqual(slots[73].loser, team('B', 1));
  // 79 = 1A vs T_CEFHI; con clave ABCDEFGH el Anexo C asigna T_CEFHI = 3.º de H.
  assert.strictEqual(slots[79].home, team('A', 0));
  assert.strictEqual(slots[79].away, team('H', 2));
});

test('resolveBracket: cruces en cascada R16+ (90 = W73 vs W75) y final', () => {
  const { slots } = resolveBracket(buildPredictionRows(), buildKoRowsHomeWins());
  // 90 = W73 vs W75: home gana siempre → W73 = 2A, W75 = 1F.
  assert.strictEqual(slots[90].home, team('A', 1));
  assert.strictEqual(slots[90].away, team('F', 0));
  // 104 = W101 vs W102: con victorias locales, Alemania (1E) vs Brasil (1C).
  assert.strictEqual(slots[104].home, team('E', 0));
  assert.strictEqual(slots[104].away, team('C', 0));
  // 103 = L101 vs L102 = RD Congo (2K) vs Argentina (1J).
  assert.strictEqual(slots[103].home, team('K', 1));
  assert.strictEqual(slots[103].away, team('J', 0));
});

test('resolveBracket: podium = winners/losers de 104 y 103', () => {
  const { podium } = resolveBracket(buildPredictionRows(), buildKoRowsHomeWins());
  assert.deepStrictEqual(podium, {
    champion: team('E', 0),  // Alemania gana la final 2-1
    runnerUp: team('C', 0),  // Brasil
    third: team('K', 1),     // RD Congo gana el 3.er puesto 2-1
    fourth: team('J', 0),    // Argentina
  });
});

test('resolveBracket: empate decidido por classifier (nombre y literal "home") alimenta cruces aguas abajo', () => {
  const koRows = buildKoRowsHomeWins();
  const row73 = koRows.find((r) => r.match_id === 73);
  row73.local = 1; row73.visitante = 1; row73.classifier = team('B', 1); // away por nombre
  const row75 = koRows.find((r) => r.match_id === 75);
  row75.local = 0; row75.visitante = 0; row75.classifier = 'home'; // literal HF-09 → 1F
  const { slots } = resolveBracket(buildPredictionRows(), koRows);
  assert.strictEqual(slots[73].winner, team('B', 1));
  assert.strictEqual(slots[75].winner, team('F', 0));
  // 90 = W73 vs W75 hereda ambos.
  assert.strictEqual(slots[90].home, team('B', 1));
  assert.strictEqual(slots[90].away, team('F', 0));
});

test('resolveBracket: empate sin classifier → winner null y lado null aguas abajo, resto intacto', () => {
  const koRows = buildKoRowsHomeWins();
  const row73 = koRows.find((r) => r.match_id === 73);
  row73.local = 0; row73.visitante = 0;
  const { slots, podium } = resolveBracket(buildPredictionRows(), koRows);
  assert.strictEqual(slots[73].winner, null);
  assert.strictEqual(slots[90].home, null);            // W73 irresoluble
  assert.strictEqual(slots[90].away, team('F', 0));    // W75 sigue OK
  assert.strictEqual(slots[90].winner, null);          // gana home (2-1) pero home es null
  assert.strictEqual(podium.champion, team('E', 0));   // la otra mitad del cuadro no se ve afectada
});

test('resolveBracket: meta expone groupScores y annexKey', () => {
  const { meta } = resolveBracket(buildPredictionRows(), buildKoRowsHomeWins());
  assert.strictEqual(meta.groupScores, 72);
  assert.strictEqual(meta.annexKey, 'ABCDEFGH');
  assert.strictEqual(meta.usedFallback, false);
});
