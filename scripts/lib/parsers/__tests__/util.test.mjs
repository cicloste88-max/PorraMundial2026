// scripts/lib/parsers/__tests__/util.test.mjs
// Tests unitarios de _util.mjs (los del bug 18-may en KOR).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parsePlayerList } from '../_util.mjs';

test('parsePlayerList resiliente a paréntesis huérfano (typo AS 18-may KOR)', () => {
  // Caso real: typo en AS donde un jugador tiene ")Mainz 05)" con ) sin (
  // Antes del fix: 3 jugadores se fundían en uno (el split por "," se desactivaba
  // porque el parser pensaba que seguía dentro de paréntesis).
  // Después del fix: 3 jugadores independientes.
  const text = 'A (X), B )Mainz 05), C (Z), D (W)';
  const out = parsePlayerList(text);
  // 4 jugadores parseados, no fundidos
  assert.equal(out.length, 4, `esperaba 4 jugadores, recibí ${out.length}`);
  assert.equal(out[0].nombre, 'A');
  assert.equal(out[2].nombre, 'C');
  assert.equal(out[3].nombre, 'D');
});

test('parsePlayerList sigue split después de paréntesis huérfano múltiple', () => {
  // Caso patológico: 2 paréntesis huérfanos seguidos
  const text = 'A )X), B )Y), C (Z)';
  const out = parsePlayerList(text);
  assert.equal(out.length, 3);
  assert.equal(out[2].nombre, 'C');
  assert.equal(out[2].club, 'Z');
});

test('parsePlayerList maneja separador " e " (Olympics 18-may CRO)', () => {
  // Caso real: "Dominik Livakovic, Dominik Kotarski e Ivor Pandur"
  // " e " es alternativa española de " y " antes de palabras que empiezan por i/hi.
  const text = 'Dominik Livakovic, Dominik Kotarski e Ivor Pandur';
  const out = parsePlayerList(text);
  assert.equal(out.length, 3, `esperaba 3 jugadores, recibí ${out.length}`);
  assert.equal(out[2].nombre, 'Ivor Pandur');
});

test('parsePlayerList maneja typo " y" sin espacio (Olympics 18-may BEL)', () => {
  // Caso real Olympics: "Senne Lammens yMike Penders" (sin espacio tras "y")
  const text = 'Thibaut Courtois, Senne Lammens yMike Penders';
  const out = parsePlayerList(text);
  assert.equal(out.length, 3, `esperaba 3 jugadores, recibí ${out.length}`);
  assert.equal(out[2].nombre, 'Mike Penders');
});

test('parsePlayerList NO confunde " e " dentro de un nombre (palabra minúscula después)', () => {
  // Edge case: "Pedro e su amigo" no debe splittear si tras la "e" hay minúscula
  // (no es lista, es prosa). El regex requiere mayúscula después de " e ".
  const text = 'Pedro e su amigo, Juan';
  const out = parsePlayerList(text);
  // Debería interpretar "Pedro e su amigo" como UN solo jugador y "Juan" como otro
  assert.equal(out.length, 2);
  assert.equal(out[0].nombre, 'Pedro e su amigo');
});
