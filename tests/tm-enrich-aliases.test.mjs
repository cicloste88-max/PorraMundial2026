// node --test tests/tm-enrich-aliases.test.mjs
//
// Fix fotos XI (matcher TM↔roster). Cubre los 3 arreglos:
//   F1 — normalización de latinas no-NFD (ø→o, æ→ae, ß→ss…) en name-matcher.
//   F2 — applyEnrich pasa iso3+aliases a matchAgainstRoster en Pass 2 (umbral
//        0.70 no-latinos + resolución de alias).
//   F3 — tm-name-aliases.json (roster→TM) para grafías score-0 confirmadas.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { scorePair, resolveAlias } from '../scripts/lib/name-matcher.mjs';
import { applyEnrich } from '../scripts/lib/enrich-merge.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const tmAliases = JSON.parse(
  readFileSync(resolve(__dir, '../scripts/lib/tm-name-aliases.json'), 'utf8'),
);

const tm = (id, name, iso3) => [
  id, { tm_player_id: id, name, iso3, photo_url_tm: `https://img/${id}.jpg`, value_eur: 1, age: 25 },
];
function enrich(iso3, rosterName, tmName, id) {
  const { roster } = applyEnrich(
    [{ nombre: rosterName }],
    new Map([tm(id, tmName, iso3)]),
    { iso3, sourceLabel: 'B', aliases: tmAliases },
  );
  return roster[0];
}

test('F1 — ø no descomponible ya no parte el token (Sørloth/Bjørkan)', () => {
  assert.ok(scorePair('Alexander Sorloth', 'Alexander Sørloth') >= 90);
  assert.ok(scorePair('Fredrik Bjorkan', 'Fredrik Bjørkan') >= 90);
  assert.equal(scorePair('Muller', 'Müller'), 100); // NFD (ü→u) sigue intacto; no regresión
});

test('F3 — aliases roster→TM resuelven', () => {
  assert.equal(resolveAlias('Vinicius Jr', 'BRA', tmAliases), 'Vinicius Junior');
  assert.equal(resolveAlias('Jean-Jacques Danley', 'HAI', tmAliases), 'Danley Jean Jacques');
});

test('applyEnrich — NOR Sørloth casa por F1 (id + foto)', () => {
  const r = enrich('NOR', 'Alexander Sorloth', 'Alexander Sørloth', 1);
  assert.equal(r.tm_player_id, 1);
  assert.ok(r.foto_url_tm);
});

test('applyEnrich — BRA Vinicius Jr casa por alias (incl. variante acentuada)', () => {
  assert.equal(enrich('BRA', 'Vinicius Jr', 'Vinicius Junior', 533781).tm_player_id, 533781);
  assert.equal(enrich('BRA', 'Vinicius Jr', 'Vinícius Júnior', 533781).tm_player_id, 533781);
});

test('applyEnrich — HAI Jean-Jacques casa por alias', () => {
  const r = enrich('HAI', 'Jean-Jacques Danley', 'Danley Jean Jacques', 900);
  assert.equal(r.tm_player_id, 900);
  assert.ok(r.foto_url_tm);
});

test('applyEnrich — F2: transliteración KSA divergente casa con umbral 0.70', () => {
  assert.equal(enrich('KSA', 'Salem Al Dawsari', 'Salem Al-Dossari', 700).tm_player_id, 700);
});

test('no-regresión — grafías canónicas siguen casando', () => {
  assert.equal(enrich('KSA', 'Hassan Tambakti', 'Hassan Al-Tambakti', 701).tm_player_id, 701);
  assert.equal(enrich('COD', 'Lionel Mpasi', 'Lionel Mpasi', 702).tm_player_id, 702);
  assert.equal(enrich('EGY', 'Marwan Attia', 'Marwan Attia', 703).tm_player_id, 703);
});

test('guard — nombre no relacionado de otra nación NO casa (iso3 scoping)', () => {
  const { roster } = applyEnrich(
    [{ nombre: 'Zinedine Zidane' }],
    new Map([tm(999, 'Lionel Messi', 'ARG')]),
    { iso3: 'FRA', sourceLabel: 'B', aliases: tmAliases },
  );
  assert.equal(roster[0].tm_player_id, undefined);
});
