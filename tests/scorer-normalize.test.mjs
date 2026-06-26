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

// matchPlayerKey devuelve { key } | { ambiguous:true } | null. Helper: en match
// claro devuelve la key (string); ambiguo/sin-match se asertan sobre el objeto.
const mk = (n, p) => { const r = matchPlayerKey(n, p); return r && r.key ? r.key : r; };

// ── matchPlayerKey — el caso raíz (obligatorio) ──────────────────────
test('CASO RAÍZ: "Vinicius Junior" (feed) → key "Vinicius"', () => {
  assert.strictEqual(mk('Vinicius Junior', BRA), 'Vinicius');
  assert.deepStrictEqual(matchPlayerKey('Vinicius Junior', BRA), { key: 'Vinicius' }); // envoltorio
});

test('CASO RAÍZ: "Vinícius Júnior" (con acentos) → "Vinicius"', () => {
  assert.strictEqual(mk('Vinícius Júnior', BRA), 'Vinicius');
});

test('CASO RAÍZ: "Junior" suelto → "Vinicius" (único Jr del squad)', () => {
  assert.strictEqual(mk('Junior', BRA), 'Vinicius');
});

test('desambiguación por "jr": el token distintivo manda', () => {
  const TWO = [
    { key: 'Vinicius', name: '7 · Vinicius Jr' },
    { key: 'Lucas',    name: '8 · Lucas Junior' },
  ];
  // "jr" pesa 1; el apellido distintivo pesa 3 → gana el correcto.
  assert.strictEqual(mk('Lucas Junior', TWO), 'Lucas');
  assert.strictEqual(mk('Vinicius Junior', TWO), 'Vinicius');
  // "Junior" a secas empata (ambos 1) y ninguna key == "jr" → AMBIGUO,
  // no se adivina (ajuste supervisión).
  assert.deepStrictEqual(matchPlayerKey('Junior', TWO), { ambiguous: true });
});

test('Jiménez ≠ Giménez: j/g distinguen la key correcta', () => {
  assert.strictEqual(mk('Raúl Jiménez', MEX), 'Jimenez');
  assert.strictEqual(mk('Santiago Giménez', MEX), 'Gimenez');
});

test('key ≠ último apellido del feed: "Guillermo Martínez" → "Martin"', () => {
  assert.strictEqual(mk('Guillermo Martínez', MEX), 'Martin');
  assert.strictEqual(mk('Julián Quiñones', MEX), 'Quinones');
});

test('clase-Vinicius: key distinta del apellido (Son, DeBruyne, VanDijk, MacAllister)', () => {
  const SQUAD = [
    { key: 'Son',         name: '7 · Son Heung-Min' },
    { key: 'DeBruyne',    name: '7 · Kevin De Bruyne' },
    { key: 'VanDijk',     name: '4 · Virgil van Dijk' },
    { key: 'MacAllister', name: '20 · Alexis Mac Allister' },
  ];
  assert.strictEqual(mk('Son Heung-Min', SQUAD), 'Son');
  assert.strictEqual(mk('Kevin De Bruyne', SQUAD), 'DeBruyne');
  assert.strictEqual(mk('Virgil van Dijk', SQUAD), 'VanDijk');
  assert.strictEqual(mk('Alexis Mac Allister', SQUAD), 'MacAllister');
});

test('substring estricto que ANTES fallaba ahora resuelve (regresión ERR-93)', () => {
  // El roster guarda "7 · Vinicius Jr"; el viejo includes("Vinicius Junior")
  // daba false. Token-match lo resuelve.
  assert.notStrictEqual(mk('Vinicius Junior', BRA), 'Junior');
  assert.strictEqual(mk('Vinicius Junior', BRA), 'Vinicius');
});

test('matchPlayerKey: sin solape → null; roster ausente → null', () => {
  assert.strictEqual(matchPlayerKey('Persona Desconocida', MEX), null);
  assert.strictEqual(matchPlayerKey('Cualquiera', undefined), null);
  assert.strictEqual(matchPlayerKey('', MEX), null);
});

// ── matchPlayerKey — desempate de apellidos compartidos (ajuste supervisión) ──
const PAN = [
  { key: 'JoseLuisRodriguez', name: '15 · José Luis Rodríguez' },
  { key: 'TomasRodriguez',    name: '7 · Tomás Rodríguez' },
];
const KOR = [
  { key: 'Hwang',   name: '6 · Hwang In-Beom' },
  { key: 'Heechan', name: '11 · Hwang Hee-Chan' },
];

test('apellido compartido: nombre completo resuelve al jugador correcto', () => {
  assert.strictEqual(mk('José Luis Rodríguez', PAN), 'JoseLuisRodriguez');
  assert.strictEqual(mk('Tomás Rodríguez', PAN), 'TomasRodriguez');
  assert.strictEqual(mk('Hwang In-Beom', KOR), 'Hwang');
  assert.strictEqual(mk('Hwang Hee-Chan', KOR), 'Heechan');
});

test('apellido a secas SIN key exacta → AMBIGUO (no acreditar al equivocado)', () => {
  assert.deepStrictEqual(matchPlayerKey('Rodriguez', PAN), { ambiguous: true });
  assert.deepStrictEqual(matchPlayerKey('Rodríguez', PAN), { ambiguous: true });
});

test('apellido a secas CON key exacta → preferir esa key (feed "Hwang" → "Hwang")', () => {
  assert.strictEqual(mk('Hwang', KOR), 'Hwang');
});

// ── fallbackKey — CONSERVA LA CAJA (ajuste supervisión: sin lockstep deploy) ──
test('fallbackKey: último token, diacríticos/dorsal/puntuación fuera, CASO intacto', () => {
  assert.strictEqual(fallbackKey('Nombre Apellido'), 'Apellido');
  assert.strictEqual(fallbackKey('9 · Raúl Jiménez'), 'Jimenez');
  assert.strictEqual(fallbackKey('Algo Junior'), 'Junior'); // sin junior→jr (espejo v8/picker)
  assert.strictEqual(fallbackKey(''), '');
});

test('fallbackKey == v8 para los scorers fallback de J1 (re-bridge sin regresión)', () => {
  // Estas keys ya viven en results con esa caja; el picker guarda igual → casan.
  for (const [feed, key] of [
    ['Sasa Lukic', 'Lukic'], ['Cyle Larin', 'Larin'], ['Boualem Khoukhi', 'Khoukhi'],
    ['John McGinn', 'McGinn'], ['Ladislav Krejčí', 'Krejci'],
  ]) {
    assert.strictEqual(fallbackKey(feed), key, `fallback "${feed}" → "${key}"`);
  }
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

test('guard bridge: importa scorer-normalize, delega en resolveScorerKey, audita, sin substring', () => {
  assert.match(BRIDGE_SRC, /from "\.\.\/_shared\/scorer-normalize\.mjs"/);
  // ERR-97 Fix 2: el bridge delega la resolucion (incl. cualificacion por
  // colision con rival) en resolveScorerKey, pasando ambos rosters.
  assert.match(BRIDGE_SRC, /resolveScorerKey\(nombre, iso3, eqMap\[iso3\], eqMap\[oppIso3\]\)/);
  assert.ok(BRIDGE_SRC.includes('scorer_${r.status}'), 'el bridge debe auditar el status no-resuelto');
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
