// ERR-93 — resolución nombre-de-feed → key canónica + matcher de goleador.
//
// Causa raíz: el puente porra-bridge-results resolvía el nombre del feed contra
// el roster con substring estricto (`p.name.includes(nombre)`) y, al fallar,
// caía al ÚLTIMO token. El feed "Vinicius Junior" vs el roster "7 · Vinicius
// Jr" fallaba ("Junior" ≠ "Jr") → persistía "Junior", pero la predicción guarda
// la key canónica "Vinicius" → el +2 de goleador no casaba nunca. Afecta a todo
// jugador cuyo último token del feed ≠ su key canónica.
//
// Fix: _shared/scorer-normalize.mjs (resolución por tokens normalizados +
// matcher por key normalizada), reusado en el bridge y en _shared/scoring.mjs,
// y espejado inline en public/js/scoring.js.

import assert from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  normName,
  toks,
  matchPlayerKey,
  fallbackKey,
  scorerMatches,
} from '../supabase/functions/_shared/scorer-normalize.mjs';

// Rosters con la forma real de `equipos_players` ({key, name:"<dorsal> · Nombre"}).
const BRA = [
  { key: 'Vinicius', name: '7 · Vinicius Jr' },
  { key: 'Raphinha', name: '11 · Raphinha' },
  { key: 'Paqueta',  name: '8 · Lucas Paquetá' },
];
const MEX = [
  { key: 'Jimenez',  name: '9 · Raúl Jiménez' },
  { key: 'Gimenez',  name: '11 · Santiago Giménez' },
  { key: 'Martin',   name: '22 · Guillermo Martínez' },
  { key: 'Quinones', name: '16 · Julián Quiñones' },
];

// ── normName / toks ──────────────────────────────────────────────────
test('normName: dorsal, "·", acentos fuera; junior→jr; minúsculas', () => {
  assert.strictEqual(normName('7 · Vinícius Júnior'), 'vinicius jr');
  assert.strictEqual(normName('9 · Raúl Jiménez'), 'raul jimenez');
  assert.strictEqual(normName('Vinicius Junior'), 'vinicius jr');
  assert.strictEqual(normName(null), '');
  assert.strictEqual(normName(undefined), '');
});

test('toks: divide en tokens no vacíos', () => {
  assert.deepStrictEqual(toks('7 · Vinicius Jr'), ['vinicius', 'jr']);
  assert.deepStrictEqual(toks('  '), []);
});

// ── matchPlayerKey — el caso raíz (obligatorio) ──────────────────────
test('CASO RAÍZ: "Vinicius Junior" (feed) → key "Vinicius"', () => {
  assert.strictEqual(matchPlayerKey('Vinicius Junior', BRA), 'Vinicius');
});

test('CASO RAÍZ: "Vinícius Júnior" (con acentos) → "Vinicius"', () => {
  assert.strictEqual(matchPlayerKey('Vinícius Júnior', BRA), 'Vinicius');
});

test('CASO RAÍZ: "Junior" suelto → "Vinicius" (único Jr del squad)', () => {
  assert.strictEqual(matchPlayerKey('Junior', BRA), 'Vinicius');
});

test('desambiguación: dos jugadores comparten "jr" — el token distintivo manda', () => {
  const TWO = [
    { key: 'Vinicius', name: '7 · Vinicius Jr' },
    { key: 'Lucas',    name: '8 · Lucas Junior' },
  ];
  // "jr" pesa 1; el apellido distintivo pesa 3 → gana el correcto.
  assert.strictEqual(matchPlayerKey('Lucas Junior', TWO), 'Lucas');
  assert.strictEqual(matchPlayerKey('Vinicius Junior', TWO), 'Vinicius');
  // "Junior" a secas es ambiguo (ambos puntúan 1): resuelve determinista al
  // primero del roster — documentado, no garantiza acierto sin token distintivo.
  assert.strictEqual(matchPlayerKey('Junior', TWO), 'Vinicius');
});

test('Jiménez ≠ Giménez: j/g distinguen la key correcta', () => {
  assert.strictEqual(matchPlayerKey('Raúl Jiménez', MEX), 'Jimenez');
  assert.strictEqual(matchPlayerKey('Santiago Giménez', MEX), 'Gimenez');
});

test('key ≠ último apellido del feed: "Guillermo Martínez" → "Martin"', () => {
  assert.strictEqual(matchPlayerKey('Guillermo Martínez', MEX), 'Martin');
  assert.strictEqual(matchPlayerKey('Julián Quiñones', MEX), 'Quinones');
});

test('substring estricto que ANTES fallaba ahora resuelve (regresión ERR-93)', () => {
  // El roster guarda "7 · Vinicius Jr"; el viejo includes("Vinicius Junior")
  // daba false. Token-match lo resuelve.
  assert.notStrictEqual(matchPlayerKey('Vinicius Junior', BRA), 'Junior');
  assert.strictEqual(matchPlayerKey('Vinicius Junior', BRA), 'Vinicius');
});

test('matchPlayerKey: sin solape → null; roster ausente → null', () => {
  assert.strictEqual(matchPlayerKey('Persona Desconocida', MEX), null);
  assert.strictEqual(matchPlayerKey('Cualquiera', undefined), null);
  assert.strictEqual(matchPlayerKey('', MEX), null);
});

// ── fallbackKey ──────────────────────────────────────────────────────
test('fallbackKey: último token normalizado (degradado, audita en el bridge)', () => {
  assert.strictEqual(fallbackKey('Nombre Apellido'), 'apellido');
  assert.strictEqual(fallbackKey('Algo Junior'), 'jr');
  assert.strictEqual(fallbackKey(''), '');
});

// ── scorerMatches — matcher normalizado (defensa en profundidad) ─────
test('scorerMatches: casa con caja/acentos/jr distintos a la key predicha', () => {
  assert.strictEqual(scorerMatches(['vinicius'], 'Vinicius'), true);
  assert.strictEqual(scorerMatches(['Jiménez'], 'Jimenez'), true);
  assert.strictEqual(scorerMatches(['Junior'], 'jr'), true);
});

test('scorerMatches: keys distintas NO colisionan; guards vacío/null', () => {
  assert.strictEqual(scorerMatches(['Gimenez'], 'Jimenez'), false);
  assert.strictEqual(scorerMatches(['Vinicius', 'Raphinha'], 'Paqueta'), false);
  assert.strictEqual(scorerMatches([], 'Vinicius'), false);
  assert.strictEqual(scorerMatches(null, 'Vinicius'), false);
  assert.strictEqual(scorerMatches(['Vinicius'], null), false);
  assert.strictEqual(scorerMatches(['Vinicius'], ''), false);
});

// ── Source guards — que las 3 superficies usen la lógica compartida y no
//    reincidan en substring estricto + último-token. ───────────────────
const BRIDGE_SRC = readFileSync(new URL('../supabase/functions/porra-bridge-results/index.ts', import.meta.url), 'utf8');
const SHARED_SCORING_SRC = readFileSync(new URL('../supabase/functions/_shared/scoring.mjs', import.meta.url), 'utf8');
const FRONTEND_SCORING_SRC = readFileSync(new URL('../public/js/scoring.js', import.meta.url), 'utf8');

test('guard bridge: importa scorer-normalize, usa matchPlayerKey/fallbackKey, audita, sin substring', () => {
  assert.match(BRIDGE_SRC, /from "\.\.\/_shared\/scorer-normalize\.mjs"/);
  assert.match(BRIDGE_SRC, /matchPlayerKey\(nombre, eqMap\[iso3\]\)/);
  assert.ok(BRIDGE_SRC.includes('fallbackKey(nombre)'));
  assert.ok(BRIDGE_SRC.includes('scorer_unresolved'));
  // El patrón roto (substring estricto contra el roster) NO debe volver.
  assert.ok(!/p\.name\.includes\(nombre\)/.test(BRIDGE_SRC),
    'el bridge no debe resolver scorers por substring estricto (ERR-93)');
});

test('guard _shared/scoring.mjs: matcher vía scorerMatches, sin includes(pred.gol)', () => {
  assert.match(SHARED_SCORING_SRC, /from "\.\/scorer-normalize\.mjs"/);
  assert.ok(SHARED_SCORING_SRC.includes('scorerMatches(opts.scorers, pred.gol)'));
  assert.ok(!/scorers\.includes\(pred\.gol\)/.test(SHARED_SCORING_SRC),
    'el matcher compartido no debe usar includes() crudo (ERR-93)');
});

test('guard frontend scoring.js: define y usa scorerMatches, sin includes(pred.gol)', () => {
  assert.ok(FRONTEND_SCORING_SRC.includes('function scorerMatches(scorers, gol)'));
  assert.ok(FRONTEND_SCORING_SRC.includes('function normName(s)'));
  assert.ok(FRONTEND_SCORING_SRC.includes('golOk = scorerMatches(scorers, pred.gol)'));
  assert.ok(!/golOk = scorers\.includes\(pred\.gol\)/.test(FRONTEND_SCORING_SRC),
    'la card por partido no debe usar includes() crudo (ERR-93)');
});
