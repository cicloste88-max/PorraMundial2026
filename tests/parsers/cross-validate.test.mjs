// node --test tests/parsers/cross-validate.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { crossValidate, jaccardNames } from '../../scripts/lib/cross-validate.mjs';

function mkPlayer(nombre) { return { nombre, posicion: 'Delantero' }; }
function mkRoster(names) { return names.map(mkPlayer); }

// Roster genérico de 23 nombres para no caer al threshold de 22.
const NAMES_ESP = [
  'Unai Simón', 'David Raya', 'Robert Sánchez',
  'Dani Carvajal', 'Aymeric Laporte', 'Robin Le Normand', 'Marc Cucurella', 'Pau Cubarsí', 'Jesús Navas', 'Dani Vivian',
  'Rodri Hernández', 'Martín Zubimendi', 'Fabián Ruiz', 'Mikel Merino', 'Pedri', 'Álex Baena',
  'Lamine Yamal', 'Nico Williams', 'Dani Olmo', 'Álvaro Morata', 'Mikel Oyarzabal', 'Joselu', 'Ferran Torres',
];

test('jaccardNames — 100% match con mismos nombres', () => {
  const a = mkRoster(NAMES_ESP);
  const b = mkRoster(NAMES_ESP);
  assert.equal(jaccardNames(a, b), 1);
});

test('jaccardNames — solape parcial', () => {
  const a = mkRoster(NAMES_ESP);
  const b = mkRoster(NAMES_ESP.slice(0, 18));
  const j = jaccardNames(a, b);
  assert.ok(j > 0.7, `expected >0.7, got ${j}`);
});

test('crossValidate — high confidence con 2 fuentes coincidentes', () => {
  const fakeAS = { source: 'as', byIso3: { ESP: { players: mkRoster(NAMES_ESP) } } };
  const fakeOly = { source: 'olympics', byIso3: { ESP: { players: mkRoster(NAMES_ESP) } } };
  const out = crossValidate([fakeAS, fakeOly]);
  const r = out.get('ESP');
  assert.equal(r.confidence, 'high');
  assert.deepEqual(r.sources.sort(), ['as', 'olympics']);
});

test('crossValidate — low confidence con 1 sola fuente', () => {
  const fakeAS = { source: 'as', byIso3: { POR: { players: mkRoster(NAMES_ESP) } } };
  const fakeOly = { source: 'olympics', byIso3: {} };
  const out = crossValidate([fakeAS, fakeOly]);
  const r = out.get('POR');
  assert.equal(r.confidence, 'low');
  assert.match(r.reason, /solo 1 fuente/);
});

test('crossValidate — reject con roster < 22 jugadores', () => {
  const short = NAMES_ESP.slice(0, 18);
  const fakeAS = { source: 'as', byIso3: { CRO: { players: mkRoster(short) } } };
  const out = crossValidate([fakeAS]);
  const r = out.get('CRO');
  assert.equal(r.confidence, 'reject');
});

// Semántica canónica de `opts.calendar` (docstring cross-validate.mjs L10-13 +
// caller único sync-squads.mjs runDetect + parser calendar.mjs): el set contiene
// los iso3 cuya "(definitiva)" está anunciada en fecha FUTURA (pendingDefinitiveByDate)
// — SOLO esos se degradan high→low aunque 2+ fuentes coincidan (posible lista
// provisional). El test original (skipped en PR #145) leía el set invertido
// ("calendario de confirmadas", degradar al ausente) y esperaba degradar a CRO
// con calendar=Set(['AUT']) — semántica inversa a impl+docstring+caller.
test('crossValidate — degrade a low si el calendario marca su "(definitiva)" como pendiente (futura)', () => {
  const fakeAS = { source: 'as', byIso3: { CRO: { players: mkRoster(NAMES_ESP) } } };
  const fakeOly = { source: 'olympics', byIso3: { CRO: { players: mkRoster(NAMES_ESP) } } };
  const calendar = new Set(['CRO']); // CRO pendiente según calendario Olympics
  const out = crossValidate([fakeAS, fakeOly], { calendar });
  const r = out.get('CRO');
  assert.equal(r.confidence, 'low');
  assert.match(r.reason, /calendario/i);
});

test('crossValidate — NO degrade si el iso3 no está en el set de pendientes', () => {
  const fakeAS = { source: 'as', byIso3: { CRO: { players: mkRoster(NAMES_ESP) } } };
  const fakeOly = { source: 'olympics', byIso3: { CRO: { players: mkRoster(NAMES_ESP) } } };
  const calendar = new Set(['AUT']); // CRO ausente → su definitiva no está pendiente
  const out = crossValidate([fakeAS, fakeOly], { calendar });
  const r = out.get('CRO');
  assert.equal(r.confidence, 'high');
  assert.equal(r.reason, undefined);
});
