// node --test tests/parsers/calendar.test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { parseCalendar, expectedByDate } from '../../scripts/lib/parsers/calendar.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const COUNTRY_MAP = JSON.parse(
  await fs.readFile(path.join(__dirname, '..', '..', 'scripts', 'lib', 'parsers', 'country-map.json'), 'utf8')
);

test('parseCalendar — extrae fechas y mapea países a iso3', () => {
  const html = `
    <h2>Calendario de anuncios</h2>
    <p>18 de mayo</p>
    <ul><li>Austria, Brasil, RD Congo</li></ul>
    <p>19 de mayo</p>
    <ul><li>Portugal</li></ul>
    <p>21 de mayo</p>
    <ul><li>Alemania, Marruecos y Noruega</li></ul>
    <p>1 de junio</p>
    <ul><li>Australia, Croacia</li></ul>
  `;
  const { entries } = parseCalendar(html, COUNTRY_MAP, { year: 2026 });
  const byDate = Object.fromEntries(entries.map((e) => [e.date, e.iso3s.sort()]));

  assert.deepEqual(byDate['2026-05-18'], ['AUT', 'BRA', 'COD']);
  assert.deepEqual(byDate['2026-05-19'], ['POR']);
  assert.deepEqual(byDate['2026-05-21'], ['GER', 'MAR', 'NOR']);
  assert.deepEqual(byDate['2026-06-01'], ['AUS', 'CRO']);
});

test('parseCalendar — dedupe entradas idénticas', () => {
  const html = `18 de mayo: Austria 18 de mayo: Austria`;
  const { entries } = parseCalendar(html, COUNTRY_MAP, { year: 2026 });
  assert.equal(entries.length, 1);
  assert.deepEqual(entries[0].iso3s, ['AUT']);
});

test('expectedByDate — incluye fechas pasadas y hoy', () => {
  const entries = [
    { date: '2026-05-18', iso3s: ['AUT', 'BRA'] },
    { date: '2026-05-19', iso3s: ['POR'] },
    { date: '2026-06-01', iso3s: ['AUS', 'CRO'] },
  ];
  const expected = expectedByDate(entries, '2026-05-19');
  assert.equal(expected.has('AUT'), true);
  assert.equal(expected.has('BRA'), true);
  assert.equal(expected.has('POR'), true);
  assert.equal(expected.has('CRO'), false);
});
