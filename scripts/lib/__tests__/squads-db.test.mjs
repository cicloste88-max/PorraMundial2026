// scripts/lib/__tests__/squads-db.test.mjs
// Tests unitarios del merge de jugadores (regresión 19-may donde --mode=detect
// pisaba el enrich TM: fotos Storage, tm_player_id, edad, valor_eur, dorsal).

import { test } from 'node:test';
import assert from 'node:assert/strict';

import { mergeJugadores } from '../squads-db.mjs';

test('mergeJugadores preserva tm_player_id/foto_url/edad/valor_eur/dorsal del array previo', () => {
  const before = [
    {
      nombre: 'Mike Maignan',
      posicion: 'Portero',
      tm_player_id: 182906,
      foto_url: 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/player-photos/FRA/182906.jpg',
      edad: 30,
      valor_eur: 25000000,
      dorsal: 16,
      dob: '1995-07-03',
      posicion_tm: 'Goalkeeper',
    },
  ];
  const newP = [
    { nombre: 'Mike Maignan', club: 'AC Milan', posicion: 'Portero', es_titular: true },
  ];
  const merged = mergeJugadores(before, newP);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].tm_player_id, 182906);
  assert.equal(
    merged[0].foto_url,
    'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/player-photos/FRA/182906.jpg'
  );
  assert.equal(merged[0].edad, 30);
  assert.equal(merged[0].valor_eur, 25000000);
  assert.equal(merged[0].dorsal, 16);
  assert.equal(merged[0].dob, '1995-07-03');
  assert.equal(merged[0].posicion_tm, 'Goalkeeper');
  // El nuevo aporta club que el previo no tenía
  assert.equal(merged[0].club, 'AC Milan');
  assert.equal(merged[0].es_titular, true);
});

test('mergeJugadores: jugador nuevo sin previo entra tal cual', () => {
  const merged = mergeJugadores([], [{ nombre: 'Foo', posicion: 'Portero' }]);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].nombre, 'Foo');
});

test('mergeJugadores: jugador previo sin match en nuevos DESAPARECE', () => {
  const before = [{ nombre: 'Old Player', tm_player_id: 999 }];
  const newP = [{ nombre: 'New Player', posicion: 'Portero' }];
  const merged = mergeJugadores(before, newP);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].nombre, 'New Player');
  assert.equal(merged[0].tm_player_id, undefined);
});

test('mergeJugadores: nuevo aporta tm_player_id sobreescribe previo null', () => {
  const before = [{ nombre: 'X', tm_player_id: null }];
  const newP = [{ nombre: 'X', tm_player_id: 123 }];
  const merged = mergeJugadores(before, newP);
  assert.equal(merged[0].tm_player_id, 123);
});

test('mergeJugadores: match por nombre normalizado (acentos / mayúsculas)', () => {
  const before = [{ nombre: 'Théo Hernández', edad: 27, tm_player_id: 314353 }];
  const newP = [{ nombre: 'Theo Hernandez', club: 'Al-Hilal' }];
  const merged = mergeJugadores(before, newP);
  assert.equal(merged.length, 1);
  assert.equal(merged[0].edad, 27);
  assert.equal(merged[0].tm_player_id, 314353);
  assert.equal(merged[0].club, 'Al-Hilal');
});

test('mergeJugadores: array previo vacío devuelve newPlayers sin tocar', () => {
  const newP = [{ nombre: 'A' }, { nombre: 'B' }];
  const merged = mergeJugadores([], newP);
  assert.equal(merged, newP);
});
