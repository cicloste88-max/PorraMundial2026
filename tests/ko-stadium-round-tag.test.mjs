// Cosmético KO (9-jul-2026): etiqueta de ronda en la vista stadium + subtítulo
// dinámico del Predictor.
//
// Bug 1 (ko.js buildStadiumPath): el ternario de rTag terminaba en 'sf', así
// que los slots 103 (3er puesto) y 104 (final) se etiquetaban 'SF'. Latente
// con los callers actuales (buildStadiumView pasa ids ≤102 a los paths;
// semis/3.º/final se pintan como compact cards del centro), pero el mapping
// queda total a prueba de callers futuros. QA visual imposible pre-18-jul
// (slots 101-104 sin sembrar): este test fija el mapping ejecutando las
// expresiones REALES extraídas del fuente (patrón new Function de
// league-ranking-r1.test.mjs — ko.js es classic script, no importable).
//
// Bug 2 (ui-pred-shell.js _subtitleFromMode): _detectModeFromCalendar devuelve
// 'groups' para todo el torneo (la transición a modos KO era F7.7, nunca
// llegó) → el subtítulo llevaba congelado "Jornada 1 · Fase de grupos" desde
// R32; además los cases muertos 'ko16'/'ko8' estaban mal etiquetados
// (ko16→'Octavos', ko8→'Cuartos'). Fix: cases muertos fuera + fase real desde
// window._mundialProgress (getMundialProgress, mismo dato que la timeline
// Trionda) con re-render del header al resolver el async.

import assert from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const KO_SRC = readFileSync(new URL('../public/js/ko.js', import.meta.url), 'utf8');
const SHELL_SRC = readFileSync(new URL('../public/js/ui-pred-shell.js', import.meta.url), 'utf8');

// ─── 1 · rTag/rTagText: ejecutar las expresiones reales del fuente ──────────

function extractLine(src, marker, label) {
  const line = src.split('\n').find((l) => l.includes(marker));
  assert.ok(line, `no se encontró la línea de ${label} en el fuente`);
  return line.trim();
}

const rTagLine = extractLine(KO_SRC, 'const rTag=', 'rTag');
const rTagTextLine = extractLine(KO_SRC, 'const rTagText=', 'rTagText');
// (id) => ({ rTag, rTagText }) con las expresiones literales del fichero.
const tagFor = new Function('id', `${rTagLine} ${rTagTextLine} return { rTag, rTagText };`);

test('stadium rTag: mapping total por slot (r32/r16/qf/sf/third/final)', () => {
  const expected = {
    73: 'r32', 88: 'r32',
    89: 'r16', 96: 'r16',
    97: 'qf', 100: 'qf',
    101: 'sf', 102: 'sf',
    103: 'third',
    104: 'final',
  };
  for (const [id, round] of Object.entries(expected)) {
    assert.strictEqual(tagFor(Number(id)).rTag, round, `slot ${id}`);
  }
});

test('stadium rTagText: etiquetas ES — 103 nunca más "SF"', () => {
  assert.strictEqual(tagFor(103).rTagText, '3ER');
  assert.strictEqual(tagFor(104).rTagText, 'FINAL');
  assert.strictEqual(tagFor(97).rTagText, 'QF');
  assert.strictEqual(tagFor(101).rTagText, 'SF');
  assert.strictEqual(tagFor(73).rTagText, 'R32');
});

test('stadium: el tag renderiza rTagText (no rTag.toUpperCase() directo)', () => {
  assert.match(KO_SRC, /<span class="st-tag \$\{rTag\}">\$\{rTagText\}<\/span>/);
});

// ─── 2 · Subtítulo Predictor (source-asserts de wiring) ─────────────────────

test('subtítulo: cases muertos ko16/ko8/sf/final eliminados del switch', () => {
  const fn = SHELL_SRC.slice(SHELL_SRC.indexOf('function _subtitleFromMode'), SHELL_SRC.indexOf('function _renderHeader'));
  assert.ok(!/case 'ko16'/.test(fn), "case 'ko16' (mal etiquetado 'Octavos') debía desaparecer");
  assert.ok(!/case 'ko8'/.test(fn), "case 'ko8' (mal etiquetado 'Cuartos') debía desaparecer");
  assert.match(fn, /case 'finalizado'/); // el único case extra vivo se conserva
});

test('subtítulo: fase KO real desde _mundialProgress con fallback a grupos', () => {
  assert.match(SHELL_SRC, /prog\.currentPhaseIdx > 0 && prog\.phaseLabel/);
  assert.match(SHELL_SRC, /'Eliminatorias · ' \+ prog\.phaseLabel/);
  assert.match(SHELL_SRC, /'Jornada ' \+ \(jornada \|\| 1\) \+ ' · Fase de grupos'/);
});

test('subtítulo: el header se re-renderiza cuando getMundialProgress resuelve', () => {
  const then = SHELL_SRC.slice(SHELL_SRC.indexOf('window.getMundialProgress().then'));
  const block = then.slice(0, then.indexOf('.catch'));
  assert.match(block, /_renderTile\(st3\);/);
  assert.match(block, /_renderHeader\(st3\);/);
});
