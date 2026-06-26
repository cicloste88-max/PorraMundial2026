// Tests — buildKoIaSignBySlot (anti-IA en KO, follow-up de #169).
//
// `get-league-standings/ia-bridge.mjs` puebla `iaByKoSlot[slot] = { sign }` desde
// las predicciones IA de cruces KO calculadas ON-DEMAND (ia_predictions
// is_ko_ondemand=true) — la IA que el usuario VIO al montar su bracket. Se LEEN,
// no se recomputan. El sign queda orientado al marco real (realHome=home), que es
// el marco en el que calcKOMatchPoints aplica iaBonusPredicate.
//
// Cubre los 4 casos del brief: (1) usuario difiere del sign IA y acierta → +1;
// (2) usuario igual que el sign IA → sin bonus; (3) orientación invertida →
// flip correcto, mismo resultado; (4) par sin predicción IA → 0 limpio.
import { test } from 'node:test';
import assert from 'node:assert';
import { buildKoIaSignBySlot } from '../supabase/functions/get-league-standings/ia-bridge.mjs';
import { calcKOMatchPoints } from '../supabase/functions/_shared/scoring.mjs';

test('buildKoIaSignBySlot: par exacto → sign tal cual (orientado al marco real)', () => {
  const iaKoRows = [{ home_code: 'GER', away_code: 'FRA', sign: '1' }];
  const realKoTeamsBySlot = { 101: { home: 'GER', away: 'FRA' } };
  assert.deepStrictEqual(buildKoIaSignBySlot(iaKoRows, realKoTeamsBySlot), { 101: { sign: '1' } });
});

test('buildKoIaSignBySlot: orientación INVERTIDA → flip 1↔2 (X invariante)', () => {
  // La fila IA guarda FRA(home) vs GER(away) sign '1' (gana FRA). El slot real
  // tiene GER(home) vs FRA(away): orientado al marco real, gana el away → '2'.
  const iaKoRows = [
    { home_code: 'FRA', away_code: 'GER', sign: '1' }, // se invertirá a '2'
    { home_code: 'BRA', away_code: 'ARG', sign: 'X' }, // X no cambia al invertir
  ];
  const realKoTeamsBySlot = {
    101: { home: 'GER', away: 'FRA' },
    102: { home: 'ARG', away: 'BRA' },
  };
  assert.deepStrictEqual(buildKoIaSignBySlot(iaKoRows, realKoTeamsBySlot), {
    101: { sign: '2' },
    102: { sign: 'X' },
  });
});

test('buildKoIaSignBySlot: ambas orientaciones presentes → gana la EXACTA', () => {
  const iaKoRows = [
    { home_code: 'FRA', away_code: 'GER', sign: '1' }, // invertida (daría '2')
    { home_code: 'GER', away_code: 'FRA', sign: '1' }, // exacta → '1' debe ganar
  ];
  const realKoTeamsBySlot = { 101: { home: 'GER', away: 'FRA' } };
  assert.deepStrictEqual(buildKoIaSignBySlot(iaKoRows, realKoTeamsBySlot), { 101: { sign: '1' } });
});

test('buildKoIaSignBySlot: par sin predicción IA → no se setea (0 limpio)', () => {
  const iaKoRows = [{ home_code: 'GER', away_code: 'FRA', sign: '1' }];
  const realKoTeamsBySlot = {
    101: { home: 'ESP', away: 'POR' }, // sin fila IA para este par
    102: { home: 'GER', away: null },  // slot incompleto
  };
  assert.deepStrictEqual(buildKoIaSignBySlot(iaKoRows, realKoTeamsBySlot), {});
});

test('buildKoIaSignBySlot: entradas vacías/sucias no rompen', () => {
  assert.deepStrictEqual(buildKoIaSignBySlot(null, null), {});
  assert.deepStrictEqual(buildKoIaSignBySlot([{ home_code: 'GER', sign: '1' }], { 101: { home: 'GER', away: 'FRA' } }), {}, 'fila sin away_code se ignora');
  assert.deepStrictEqual(buildKoIaSignBySlot([{ home_code: 'GER', away_code: 'FRA' }], { 101: { home: 'GER', away: 'FRA' } }), {}, 'fila sin sign se ignora');
});

// ── End-to-end: iaByKoSlot → calcKOMatchPoints reparte el +1 anti-IA en KO ──
test('e2e: cruce coincide + usuario DIFIERE del sign IA + acierta → +1 (máx KO = 7)', () => {
  const iaByKoSlot = buildKoIaSignBySlot(
    [{ home_code: 'GER', away_code: 'FRA', sign: '2' }], // IA: gana FRA (away)
    { 89: { home: 'GER', away: 'FRA' } },
  );
  assert.deepStrictEqual(iaByKoSlot[89], { sign: '2' });
  // Usuario predice GER 2-0 (signo '1', difiere de la IA), real GER 2-0:
  // marcador signo+1 exacto+3 = 4, +1 anti-IA = 5; +avance r16 (10) = 15.
  const pts = calcKOMatchPoints({ saved: true, l: 2, v: 0, gol: null }, 2, 0, 'r16', {
    predHome: 'GER', predAway: 'FRA', predAdvancer: 'GER',
    realHome: 'GER', realAway: 'FRA', realAdvancer: 'GER',
    iaPred: iaByKoSlot[89],
  });
  assert.strictEqual(pts, 15, 'marcador 4 + anti-IA 1 + avance r16 10 = 15');

  // Cap 7: exacto+gol+IA en el marcador no pasa de 7. r16 exacto 2-0 + gol + IA.
  const capped = calcKOMatchPoints({ saved: true, l: 2, v: 0, gol: 'mueller' }, 2, 0, 'r16', {
    scorers: ['mueller'],
    predHome: 'GER', predAway: 'FRA', predAdvancer: 'GER',
    realHome: 'GER', realAway: 'FRA', realAdvancer: 'GER',
    iaPred: iaByKoSlot[89],
  });
  assert.strictEqual(capped, 17, 'marcador cap 7 (1+3+2+1) + avance r16 10 = 17');
});

test('e2e: cruce coincide + usuario IGUAL que el sign IA → sin bonus', () => {
  const iaByKoSlot = buildKoIaSignBySlot(
    [{ home_code: 'GER', away_code: 'FRA', sign: '1' }], // IA: gana GER (home)
    { 89: { home: 'GER', away: 'FRA' } },
  );
  // Usuario predice GER 2-0 (signo '1', IGUAL que la IA) → sin +1 anti-IA.
  const pts = calcKOMatchPoints({ saved: true, l: 2, v: 0, gol: null }, 2, 0, 'r16', {
    predHome: 'GER', predAway: 'FRA', predAdvancer: 'GER',
    realHome: 'GER', realAway: 'FRA', realAdvancer: 'GER',
    iaPred: iaByKoSlot[89],
  });
  assert.strictEqual(pts, 14, 'marcador 4 (sin anti-IA) + avance r16 10 = 14');
});

test('e2e: orientación invertida da el MISMO resultado que la exacta', () => {
  // Misma semántica (IA dice gana FRA) en orientación invertida vs el slot real.
  const inverted = buildKoIaSignBySlot(
    [{ home_code: 'FRA', away_code: 'GER', sign: '1' }], // gana FRA, fila invertida
    { 89: { home: 'GER', away: 'FRA' } },
  );
  assert.deepStrictEqual(inverted[89], { sign: '2' }, 'flip a marco real: gana away (FRA) = 2');
  // Usuario GER 2-0 difiere de "gana FRA" y acierta → +1, igual que el e2e exacto.
  const pts = calcKOMatchPoints({ saved: true, l: 2, v: 0, gol: null }, 2, 0, 'r16', {
    predHome: 'GER', predAway: 'FRA', predAdvancer: 'GER',
    realHome: 'GER', realAway: 'FRA', realAdvancer: 'GER',
    iaPred: inverted[89],
  });
  assert.strictEqual(pts, 15, 'orientación invertida → mismo +1 anti-IA → 15');
});

test('e2e: par sin predicción IA → iaPred null → 0 anti-IA limpio', () => {
  const iaByKoSlot = buildKoIaSignBySlot([], { 89: { home: 'GER', away: 'FRA' } });
  const pts = calcKOMatchPoints({ saved: true, l: 2, v: 0, gol: null }, 2, 0, 'r16', {
    predHome: 'GER', predAway: 'FRA', predAdvancer: 'GER',
    realHome: 'GER', realAway: 'FRA', realAdvancer: 'GER',
    iaPred: iaByKoSlot[89] ?? null,
  });
  assert.strictEqual(pts, 14, 'sin IA del par → marcador 4 + avance 10 = 14 (sin +1)');
});
