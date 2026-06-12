// F2 post-J1 (re-QA San) — el header de Jornada mostraba a Parrandas como
// "#15" con 3 pts cuando su posición real es 13: con empates a 3 pts
// (alexnovesh, jesusruedagar, Parrandas) v_league_rank usa rank() — los
// empates COMPARTEN posición y dejan hueco después — pero el header (y la
// lista top-10 de Jornada, la lista/podio de Clasificación y el fallback de
// porra-jugador) usaban el ÍNDICE del array (row_number) que desempata por
// orden de llegada/alfabético.
//
// Fix: helper único `rankConEmpates(rows, idx, getTotal)` en data.js y los 4
// consumidores cableados. Semántica unificada con v_league_rank y el widget
// Ranking del Predictor (R1).

import assert from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const DATA_SRC = readFileSync(new URL('../public/js/data.js', import.meta.url), 'utf8');
const UI_GROUPS_SRC = readFileSync(new URL('../public/js/ui-groups.js', import.meta.url), 'utf8');
const SCOREBOARD_SRC = readFileSync(new URL('../public/js/scoreboard.js', import.meta.url), 'utf8');
const JUGADOR_SRC = readFileSync(new URL('../public/js/v3/porra-jugador-v3.js', import.meta.url), 'utf8');

function extractFn(src, name) {
  const start = src.indexOf(`function ${name}(`);
  assert.ok(start > -1, `función ${name} no encontrada`);
  const end = src.indexOf('\n}', start);
  return src.slice(start, end + 2);
}

const rankConEmpates = new Function(`
  ${extractFn(DATA_SRC, 'rankConEmpates')}
  return rankConEmpates;
`)();

// Espejo de gallos post-reseed: 7 colíderes a 12, IA Zayu 6, 4 de relleno,
// y el empate a 3 de alexnovesh / jesusruedagar / Parrandas en idx 12-14.
const GALLOS = [
  ...Array.from({ length: 7 }, (_, i) => ({ uid: 'lider' + i, total: 12 })),
  { uid: 'zayu', total: 6 },
  { uid: 'r1', total: 4 }, { uid: 'r2', total: 4 }, { uid: 'r3', total: 4 }, { uid: 'r4', total: 4 },
  { uid: 'alexnovesh', total: 3 }, { uid: 'jesusruedagar', total: 3 }, { uid: 'parrandas', total: 3 },
  { uid: 'x1', total: 1 },
];

test('rankConEmpates: el caso Parrandas — idx 14 (row_number 15) es rank 13', () => {
  assert.strictEqual(rankConEmpates(GALLOS, 14, (r) => r.total), 13);
  // Los tres empatados a 3 comparten el 13.
  assert.strictEqual(rankConEmpates(GALLOS, 12, (r) => r.total), 13);
  assert.strictEqual(rankConEmpates(GALLOS, 13, (r) => r.total), 13);
  // Y el siguiente (1 pt) salta al 16 (hueco de los empates).
  assert.strictEqual(rankConEmpates(GALLOS, 15, (r) => r.total), 16);
});

test('rankConEmpates: colíderes comparten el 1 y el 8º es rank 8', () => {
  for (let i = 0; i < 7; i++) assert.strictEqual(rankConEmpates(GALLOS, i, (r) => r.total), 1);
  assert.strictEqual(rankConEmpates(GALLOS, 7, (r) => r.total), 8);
});

test('rankConEmpates: idx fuera de rango → fallback idx+1 sin throw', () => {
  assert.strictEqual(rankConEmpates(GALLOS, -1, (r) => r.total), 0);
  assert.strictEqual(rankConEmpates(null, 4, (r) => r.total), 5);
});

test('paridad con rank() de v_league_rank: 1 + count(total > mío)', () => {
  // Definición SQL: rank() over (order by total_pts desc).
  const sqlRank = (rows, idx) => 1 + rows.filter((r) => r.total > rows[idx].total).length;
  for (let i = 0; i < GALLOS.length; i++) {
    assert.strictEqual(rankConEmpates(GALLOS, i, (r) => r.total), sqlRank(GALLOS, i), 'idx ' + i);
  }
});

// ─── Wiring: los 4 consumidores usan el helper (cero idx+1 de posición) ───

test('wiring ui-groups: header strip y lista top-10 vía rankConEmpates', () => {
  const strip = extractFn(UI_GROUPS_SRC, '_renderUserStrip');
  assert.ok(strip.includes('rankConEmpates('));
  assert.ok(!strip.includes("'#' + (idx + 1)"));
  assert.match(strip, /rank <= 3 \? medals\[rank - 1\] : '#' \+ rank/);
  // Lista top-10 de Jornada
  const lista = UI_GROUPS_SRC.slice(UI_GROUPS_SRC.indexOf('jornada-ranking-title">🏆 Clasificación liga'), UI_GROUPS_SRC.indexOf('function _renderUserStrip'));
  assert.ok(lista.includes('rankConEmpates') || UI_GROUPS_SRC.includes('const _rk = (i) => (typeof rankConEmpates'));
});

test('wiring scoreboard: lista y medallas del podio vía rankConEmpates', () => {
  assert.ok(SCOREBOARD_SRC.includes('rankConEmpates'));
  assert.ok(SCOREBOARD_SRC.includes('const rank = _rk(i);'));
  assert.ok(!SCOREBOARD_SRC.includes('const rank = i + 1;'));
  assert.ok(SCOREBOARD_SRC.includes("medal: String(_rk(0))"));
});

test('wiring porra-jugador: fallback de rank vía rankConEmpates (no idx+1)', () => {
  const span = JUGADOR_SRC.slice(JUGADOR_SRC.indexOf('var sb = window._sbData'), JUGADOR_SRC.indexOf('var meId'));
  assert.ok(span.includes('window.rankConEmpates'));
  assert.ok(!span.includes('rank = idx + 1;'));
});
