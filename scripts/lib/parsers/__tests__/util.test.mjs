// scripts/lib/parsers/__tests__/util.test.mjs
// Tests unitarios de _util.mjs (los del bug 18-may en KOR).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { parsePlayer, parsePlayerList } from '../_util.mjs';

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

// ────────────────────────────────────────────────────────────────────────────
// parsePlayer — regresión 28-may-2026 sobre 5 patrones reales de corrupción
// observados en BD tras auditoría manual de 48 países por San.
// ────────────────────────────────────────────────────────────────────────────

test('parsePlayer well-formed sigue funcionando (regresión)', () => {
  assert.deepEqual(parsePlayer('Maignan (Milan)'), { nombre: 'Maignan', club: 'Milan' });
  assert.deepEqual(parsePlayer('Lautaro Martínez (Inter, ITA)'), {
    nombre: 'Lautaro Martínez',
    club: 'Inter',
  });
  assert.deepEqual(parsePlayer('Cristiano'), { nombre: 'Cristiano' });
});

test('parsePlayer caso 1 EGY: "Ibrahim Ade (Pyramids FC)l" → "Ibrahim Adel"', () => {
  // Letra cortada del nombre por mala segmentación upstream. El club se descarta
  // (mejor sin club que con club erróneo). El nombre se reune correctamente.
  const out = parsePlayer('Ibrahim Ade (Pyramids FC)l');
  assert.equal(out?.nombre, 'Ibrahim Adel', `recibí ${JSON.stringify(out)}`);
});

test('parsePlayer caso 2 ENG: "(Tottenham)" → null (nombre vacío)', () => {
  // Sólo club entre paréntesis, sin nombre — entrada inválida. Devuelve null
  // y el llamador (parsePlayerList con filter(Boolean)) descarta. NO debe
  // dejar entrada con nombre='' o nombre='(Tottenham)' en BD.
  const out = parsePlayer('(Tottenham)');
  assert.equal(out, null);
});

test('parsePlayer caso 3 KOR: "Lee Jjae-Sung )Mainz 05)" → "Lee Jjae-Sung"', () => {
  // Paréntesis invertido — ) sin ( de apertura. El typo 'Jjae' se preserva
  // (no es trabajo del parser corregir typos, lo hace el matcher Levenshtein).
  const out = parsePlayer('Lee Jjae-Sung )Mainz 05)');
  assert.equal(out?.nombre, 'Lee Jjae-Sung', `recibí ${JSON.stringify(out)}`);
});

test('parsePlayer caso 4 SCO: "Ross Stewart (Southampton)Stewart" → "Ross Stewart"', () => {
  // Apellido duplicado tras `)`. El dedupe detecta "StewartStewart" y elimina
  // la repetición del último token (mínimo N=3 chars).
  const out = parsePlayer('Ross Stewart (Southampton)Stewart');
  assert.equal(out?.nombre, 'Ross Stewart', `recibí ${JSON.stringify(out)}`);
});

test('parsePlayer caso 5 SWE: "Gustaf Nilsson Brujas)" → "Gustaf Nilsson"', () => {
  // Club pegado sin paréntesis abierto. El stripping de "\\s+\\S+\\)$" sólo
  // se aplica cuando NO hay ningún `(` en el string (señal clara de malformación).
  const out = parsePlayer('Gustaf Nilsson Brujas)');
  assert.equal(out?.nombre, 'Gustaf Nilsson', `recibí ${JSON.stringify(out)}`);
});

test('parsePlayer: nombre simple sin paréntesis se preserva intacto', () => {
  assert.equal(parsePlayer('Bono')?.nombre, 'Bono');
  assert.equal(parsePlayer('Pelé')?.nombre, 'Pelé');
});

test('parsePlayer: apellidos cortos no caen en falso positivo de dedupe', () => {
  // El dedupe exige N≥3 en la mitad repetida. Apellidos cortos no deben
  // colapsar (e.g. 'Vavá' no debería convertirse en 'V').
  assert.equal(parsePlayer('Vavá')?.nombre, 'Vavá');
  assert.equal(parsePlayer('Lee Jo')?.nombre, 'Lee Jo');
});
