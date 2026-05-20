// scripts/lib/__tests__/tm-parse-utils.test.mjs
// Tests unitarios de los helpers compartidos por A (marktwert) y B (kader).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  decodeClean,
  stripTmImageQuery,
  extractProfileLink,
  extractClubLink,
  parseValorEs,
  positionToBucket,
  mapConcurrent,
} from '../tm-parse-utils.mjs';

test('decodeClean limpia tags + entities + multilinea', () => {
  assert.equal(decodeClean('  <a>Joan&nbsp;García</a>\n  '), 'Joan García');
  assert.equal(decodeClean('<a>Mike\n            Maignan</a>'), 'Mike Maignan');
  assert.equal(decodeClean('FC&amp;Barcelona &#039;B&#039;'), "FC&Barcelona 'B'");
  assert.equal(decodeClean(null), '');
});

test('stripTmImageQuery quita ?lm=...', () => {
  assert.equal(
    stripTmImageQuery('https://img.a.transfermarkt.technology/portrait/medium/123-456.jpg?lm=1'),
    'https://img.a.transfermarkt.technology/portrait/medium/123-456.jpg'
  );
  assert.equal(stripTmImageQuery(null), '');
});

test('extractProfileLink soporta multilinea', () => {
  const html = `<a href="/joan-garcia/profil/spieler/561613">
                Joan García            </a>`;
  const r = extractProfileLink(html);
  assert.equal(r.tm_player_id, 561613);
  assert.equal(r.nombre, 'Joan García');
});

test('extractProfileLink devuelve null si no hay match', () => {
  assert.equal(extractProfileLink('<div>nada aquí</div>'), null);
});

test('extractClubLink skip=1 devuelve el segundo (club, no nación)', () => {
  const html = `
    <a title="España" href="/spanien/startseite/verein/3375">...</a>
    <a title="FC Barcelona" href="/fc-barcelona/startseite/verein/131">...</a>
  `;
  const r = extractClubLink(html, { skip: 1 });
  assert.equal(r.club, 'FC Barcelona');
  assert.equal(r.club_id, 131);
  assert.equal(r.club_logo_url, 'https://tmssl.akamaized.net/images/wappen/verysmall/131.png');
});

test('extractClubLink skip=0 devuelve el primero (kader: solo aparece el club)', () => {
  const html = `<a title="FC Barcelona" href="/fc-barcelona/startseite/verein/131">...</a>`;
  const r = extractClubLink(html, { skip: 0 });
  assert.equal(r.club, 'FC Barcelona');
  assert.equal(r.club_id, 131);
});

test('extractClubLink devuelve null cuando faltan matches', () => {
  assert.equal(extractClubLink('<div>nada</div>', { skip: 1 }), null);
});

test('parseValorEs formatos', () => {
  assert.equal(parseValorEs('75,00', 'mill.'), 75_000_000);
  assert.equal(parseValorEs('1,5', 'mill.'), 1_500_000);
  assert.equal(parseValorEs('150,00', 'mill.'), 150_000_000);
  assert.equal(parseValorEs('800', 'mil'), 800_000);
  assert.equal(parseValorEs('500', null), 500);
  assert.equal(parseValorEs(null, 'mill.'), null);
  assert.equal(parseValorEs('foo', 'mill.'), null);
  // Defensa contra el bug 5 del brief: 40,00 mill. NO debe ser 4_000_000_000
  assert.equal(parseValorEs('40,00', 'mill.'), 40_000_000);
});

test('positionToBucket castellano + inglés', () => {
  assert.equal(positionToBucket('Lateral derecho'), 'Defensa');
  assert.equal(positionToBucket('Pivote'), 'Centrocampista');
  assert.equal(positionToBucket('Extremo izquierdo'), 'Delantero');
  assert.equal(positionToBucket('Goalkeeper'), 'Portero');
  assert.equal(positionToBucket('Centre-Back'), 'Defensa');
  assert.equal(positionToBucket(null), null);
  assert.equal(positionToBucket('Inventada'), null);
});

test('mapConcurrent procesa en batches y preserva orden', async () => {
  const items = [1, 2, 3, 4, 5];
  const result = await mapConcurrent(items, async (n) => n * 2, { concurrency: 2 });
  assert.deepEqual(result, [2, 4, 6, 8, 10]);
});
