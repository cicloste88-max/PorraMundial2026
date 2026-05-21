// Smoke test scoring — fix del else-if que impedía apilar exacto sobre signo.
// Verifica los 4 casos canónicos confirmados por San 21-may-2026.
//
// Estrategia: scoring.js es 1728 líneas con código browser-específico a
// top-level (MutationObserver, document.addEventListener, window.*).
// Para aislar calcMatchPoints, slice las primeras ~103 líneas (todas las
// definiciones que necesita calcMatchPoints y su helper) y evalúa solo eso.
import assert from 'node:assert';
import { readFileSync } from 'node:fs';

// Mocks mínimos
globalThis.iaBonusWillApply = () => false;
globalThis.PARTIDOS = [];
globalThis.getMatchKey = () => null;
globalThis.boostPicks = {};
globalThis.EQUIPOS = [];

// Slice scoring.js hasta el cierre de _hf09FallbackScorers (L103)
const fullSrc = readFileSync('public/js/scoring.js', 'utf8');
const slice = fullSrc.split('\n').slice(0, 104).join('\n');

// Evaluar el slice; expone calcMatchPoints
const fn = new Function(slice + '\nreturn { calcMatchPoints };');
const { calcMatchPoints } = fn();

// Test 1: solo signo correcto
const t1 = calcMatchPoints({ saved: true, l: 2, v: 0, gol: null }, 3, 1, null, []);
assert.strictEqual(t1, 1, 'Solo signo debe dar +1');

// Test 2: exacto sin goleador
const t2 = calcMatchPoints({ saved: true, l: 3, v: 1, gol: null }, 3, 1, null, []);
assert.strictEqual(t2, 4, 'Exacto sin goleador debe dar +1 (signo) +3 (exacto) = 4');

// Test 3: exacto + goleador
const t3 = calcMatchPoints({ saved: true, l: 3, v: 2, gol: 'lozano' }, 3, 2, null, ['lozano']);
assert.strictEqual(t3, 6, 'Exacto + goleador debe dar +1 +3 +2 = 6');

// Test 4: exacto + goleador + bonus IA
globalThis.iaBonusWillApply = () => true;
const t4 = calcMatchPoints({ saved: true, l: 3, v: 2, gol: 'lozano' }, 3, 2, 'mock-key', ['lozano']);
assert.strictEqual(t4, 7, 'Exacto + goleador + IA bonus debe dar 1+3+2+1 = 7 (max)');

console.log('✓ 4 smoke tests pasados');
