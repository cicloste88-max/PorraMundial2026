// Tests integración — ruta KO de get-league-standings (Paso 6).
//
// La EF get-league-standings/index.ts NO se puede ejecutar fuera de Deno, así
// que este test replica su LÓGICA DE PEGAMENTO pura con las mismas piezas
// compartidas: (1) malla predicha del usuario vía resolveBracket
// (_shared/ko-bracket.mjs, en nombres ES); (2) puente ES→iso3 derivado de
// public/data/worldcup-2026-matches.json (espejo de wc_matches, mismas columnas
// home_es/away_es/home_iso3/away_iso3); (3) malla real desde un wc_matches_ko +
// ko_results simulados; (4) scoring con calcKOMatchPoints + calcKoPodiumPoints.
//
// Valida el invariante clave del PR (gate de equipos del modelo §1.3): un slot
// con el MISMO marcador/lado pero equipos DISTINTOS puntúa 0 de marcador, y el
// avance se paga solo si el EQUIPO que avanza coincide. Cubre además que TODOS
// los nombres ES de GRUPOS resuelven a iso3 (sin huecos en el puente).
import { test } from 'node:test';
import assert from 'node:assert';
import { readFileSync } from 'node:fs';
import { GRUPOS } from '../supabase/functions/_shared/ko-data.mjs';
import { resolveBracket } from '../supabase/functions/_shared/ko-bracket.mjs';
import { calcKOMatchPoints, calcKoPodiumPoints } from '../supabase/functions/_shared/scoring.mjs';

// Puente ES→iso3 idéntico al que monta la EF desde wc_matches.
const MATCHES = JSON.parse(readFileSync('public/data/worldcup-2026-matches.json', 'utf8'));
const esNameToIso3 = {};
for (const k of Object.keys(MATCHES)) {
  const e = MATCHES[k];
  if (e.home_es && e.home_iso3) esNameToIso3[e.home_es] = e.home_iso3;
  if (e.away_es && e.away_iso3) esNameToIso3[e.away_es] = e.away_iso3;
}
const toIso3 = (es) => (es != null && esNameToIso3[es]) ? esNameToIso3[es] : null;

// Usuario determinista: team[0] gana 3-0, team[1] 2-0, team[2] 1-0 (≡ fixtures
// de ko-bracket.test.mjs). 1X=equipos[0], 2X=equipos[1], 3X=equipos[2];
// mejores terceros = grupos A..H.
const PAIRINGS = [[0, 1], [2, 3], [0, 2], [1, 3], [0, 3], [1, 2]];
function buildPredictionRows() {
  return GRUPOS.flatMap((g) =>
    PAIRINGS.map(([hi, ai]) => ({
      match_id: `${g.letra}_${g.equipos[hi]}_${g.equipos[ai]}`,
      local: hi === 0 ? 3 : hi === 1 ? 2 : 1,
      visitante: 0,
    })),
  );
}
// KO: el local gana 2-1 en todos los slots → winner = home.
function buildKoRows(slots) {
  return slots.map((id) => ({ match_id: id, local: 2, visitante: 1, classifier: null, scorer: null }));
}

const team = (letra, idx) => GRUPOS.find((g) => g.letra === letra).equipos[idx];

test('puente ES→iso3 cubre los 48 mundialistas (todos los nombres de GRUPOS resuelven)', () => {
  const missing = [];
  GRUPOS.forEach((g) => g.equipos.forEach((nombre) => { if (!toIso3(nombre)) missing.push(nombre); }));
  assert.deepStrictEqual(missing, [], `nombres ES sin iso3: ${missing.join(', ')}`);
});

test('gate de equipos §1.3: mismo 2-1/lado, equipos distintos → 0 (el bug)', () => {
  const allSlots = Array.from({ length: 104 - 73 + 1 }, (_, i) => 73 + i);
  const bracket = resolveBracket(buildPredictionRows(), buildKoRows(allSlots));
  const s73 = bracket.slots[73];
  // Malla predicha del usuario en iso3: 2A vs 2B, avanza 2A.
  const predHome = toIso3(s73.home);      // Sudáfrica (2A) → RSA
  const predAway = toIso3(s73.away);      // Bosnia (2B)   → BIH
  const predAdvancer = toIso3(s73.winner);
  assert.strictEqual(predHome, toIso3(team('A', 1)));
  assert.strictEqual(predAway, toIso3(team('B', 1)));
  assert.strictEqual(predAdvancer, predHome);

  const userKoPred = { saved: true, l: 2, v: 1, gol: null, classifier: null };

  // (1) Cruce coincide exactamente (mismos equipos, misma orientación) → marcador
  //     exacto 4 + avance r32 10 = 14.
  const ptsMatch = calcKOMatchPoints(userKoPred, 2, 1, 'r32', {
    predHome, predAway, predAdvancer,
    realHome: predHome, realAway: predAway, realAdvancer: predHome,
  });
  assert.strictEqual(ptsMatch, 14, 'cruce coincide: marcador exacto (4) + avance r32 (10)');

  // (2) Equipos DISTINTOS, mismo 2-1/lado → 0 de marcador y 0 de avance.
  const ptsGate = calcKOMatchPoints(userKoPred, 2, 1, 'r32', {
    predHome, predAway, predAdvancer,
    realHome: 'GER', realAway: 'FRA', realAdvancer: 'GER',
  });
  assert.strictEqual(ptsGate, 0, 'gate: equipos distintos, mismo 2-1 → 0 (antes daba +8)');

  // (3) Cruce distinto pero el avanzador coincide → 0 marcador + avance r32 (10).
  const ptsAdv = calcKOMatchPoints(userKoPred, 2, 1, 'r32', {
    predHome, predAway, predAdvancer,
    realHome: predHome, realAway: 'FRA', realAdvancer: predHome,
  });
  assert.strictEqual(ptsAdv, 10, 'avanzador coincide, cruce no: 0 marcador + avance r32 (10)');
});

test('§1.7 clasificados de grupos: +5 por participante de R32 predicho que clasifica de verdad', () => {
  const allSlots = Array.from({ length: 104 - 73 + 1 }, (_, i) => 73 + i);
  const bracket = resolveBracket(buildPredictionRows(), buildKoRows(allSlots));
  // Participantes R32 predichos (slots 73-88, home+away) en iso3 = los 32
  // clasificados de la simulación del usuario (≡ lógica de la EF).
  const R32 = Array.from({ length: 16 }, (_, i) => 73 + i);
  const predQualifiers = new Set();
  for (const s of R32) {
    const ps = bracket.slots[s];
    const h = toIso3(ps.home); if (h) predQualifiers.add(h);
    const a = toIso3(ps.away); if (a) predQualifiers.add(a);
  }
  assert.strictEqual(predQualifiers.size, 32, 'la simulación del usuario produce 32 clasificados');

  const score = (realQ) => {
    let pts = 0;
    for (const q of predQualifiers) if (realQ.has(q)) pts += 5;
    return pts;
  };
  // Real == predicho → 32 × 5 = 160.
  assert.strictEqual(score(new Set(predQualifiers)), 160, 'todos los clasificados acertados = 160');
  // Real vacío (wc_matches_ko sin sembrar) → 0 limpio.
  assert.strictEqual(score(new Set()), 0, 'sin clasificados reales → 0 limpio');
  // Solo 3 coinciden → 15.
  const three = new Set([...predQualifiers].slice(0, 3));
  assert.strictEqual(score(three), 15, '3 clasificados acertados = 15');
});

test('podio §1.5 desde mallas predicha/real en iso3 (30/20/15/10)', () => {
  const allSlots = Array.from({ length: 104 - 73 + 1 }, (_, i) => 73 + i);
  const bracket = resolveBracket(buildPredictionRows(), buildKoRows(allSlots));
  const predPodium = {
    champion: toIso3(bracket.podium.champion),
    runnerUp: toIso3(bracket.podium.runnerUp),
    third:    toIso3(bracket.podium.third),
    fourth:   toIso3(bracket.podium.fourth),
  };
  // Con victorias locales: final 104 = 1E vs 1C (Alemania vs Brasil), 3.º 103 = 2K vs 1J.
  assert.strictEqual(predPodium.champion, toIso3(team('E', 0))); // Alemania → GER
  assert.strictEqual(predPodium.runnerUp, toIso3(team('C', 0))); // Brasil → BRA

  // Podio real idéntico al predicho → 75; totalmente distinto → 0.
  assert.strictEqual(calcKoPodiumPoints(predPodium, predPodium), 75, 'podio clavado = 75');
  assert.strictEqual(
    calcKoPodiumPoints(predPodium, { champion: 'X', runnerUp: 'Y', third: 'Z', fourth: 'W' }),
    0, 'podio fallado = 0');
  // Solo campeón acertado → 30.
  assert.strictEqual(
    calcKoPodiumPoints(predPodium, { champion: predPodium.champion, runnerUp: 'Y', third: 'Z', fourth: 'W' }),
    30, 'solo campeón = 30');
});
