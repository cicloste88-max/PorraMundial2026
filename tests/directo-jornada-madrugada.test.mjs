// N1 post-J1 (captura San 03:35 Madrid) — el partido pendiente de madrugada
// desaparecía del Directo tras medianoche: la selección de jornada en curso
// era (a) primera con live → (b) HOY en Europe/Madrid → (c) primera futura →
// (d) última. De madrugada sin live, (a) fallaba y (b) elegía el día nuevo
// (J2) → la J1 no se materializaba aunque tuviera el KOR-CZE aún POR JUGAR
// (kickoff real 04:00 del viernes, día canónico jueves 11).
//
// Fix: prioridad (a-bis) entre (a) y (b): primera jornada con algún partido
// NO finished cuyo kickoff REAL (match_start_ts, sufijo +1 — no el día
// canónico de sede) esté vencido o a ≤6h (_KICKOFF_INMINENTE_MS). Se testea
// la función REAL _pickJornadaEnCurso extraída de ui-directo.js.

import assert from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../public/js/ui-directo.js', import.meta.url), 'utf8');

function extractFn(name) {
  const start = SRC.indexOf(`function ${name}(`);
  assert.ok(start > -1, `función ${name} no encontrada`);
  const end = SRC.indexOf('\n  }', start);
  return SRC.slice(start, end + 4);
}

const pick = new Function(`
  ${extractFn('_pickJornadaEnCurso')}
  return _pickJornadaEnCurso;
`)();

const DIAS = ['2026-06-11', '2026-06-12', '2026-06-13'];

function opts(over) {
  return Object.assign({
    liveCountOf: () => 0,
    hasPendingImminent: () => false,
    todayMadrid: '2026-06-12',
  }, over);
}

test('caso San 03:35 viernes: sin live, J1 con KOR-CZE pendiente e inminente → J1 (idx 0), no el día nuevo', () => {
  const idx = pick(DIAS, opts({
    hasPendingImminent: (d) => d === '2026-06-11', // KOR-CZE kickoff 04:00, a 25 min
  }));
  assert.strictEqual(idx, 0);
});

test('tras el FT del KOR-CZE: sin live ni inminentes → (b) hoy Madrid (J2), comportamiento actual', () => {
  assert.strictEqual(pick(DIAS, opts()), 1);
});

test('(a) live gana a (a-bis): partido en vivo en J2 con pendiente inminente en J1', () => {
  const idx = pick(DIAS, opts({
    liveCountOf: (d) => (d === '2026-06-12' ? 1 : 0),
    hasPendingImminent: (d) => d === '2026-06-11',
  }));
  assert.strictEqual(idx, 1);
});

test('(a-bis) no adelanta jornadas de tarde: kickoffs a >6h no son inminentes → hoy Madrid manda', () => {
  // hasPendingImminent ya devuelve false para todo (el predicado real filtra
  // por ≤6h); la prioridad cae a (b).
  assert.strictEqual(pick(DIAS, opts({ todayMadrid: '2026-06-13' })), 2);
});

test('fallbacks (c) primera futura y (d) última intactos', () => {
  assert.strictEqual(pick(DIAS, opts({ todayMadrid: '2026-06-10' })), 0); // (c)
  assert.strictEqual(pick(DIAS, opts({ todayMadrid: '2026-07-30' })), 2); // (d)
});

test('wiring: render usa _pickJornadaEnCurso con el predicado de kickoff real y el umbral 6h', () => {
  assert.ok(SRC.includes('_pickJornadaEnCurso(dias, {'));
  assert.ok(SRC.includes('const _KICKOFF_INMINENTE_MS = 6 * 60 * 60 * 1000;'));
  const pred = SRC.slice(SRC.indexOf('const _hasPendingImminent'), SRC.indexOf('const todayMadrid'));
  assert.ok(pred.includes('_kickoffMs(row)'));                 // kickoff REAL (match_start_ts)
  assert.ok(pred.includes("row.status === 'finished'"));       // los acabados no cuentan
  assert.ok(pred.includes('(ko - now) <= _KICKOFF_INMINENTE_MS')); // vencido o inminente
});
