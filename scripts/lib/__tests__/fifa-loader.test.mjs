// scripts/lib/__tests__/fifa-loader.test.mjs
// Tests del load-fifa: mapeos, cross-check de club, y la lógica clave de
// buildFifaRoster (herencia, dorsal autoritativo, artículo árabe pegado,
// anti-cross-wire por nº de tokens, insert/eliminate, y apodos no derivables
// que se reportan como `possible` en vez de auto-casar).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  mapFifaPos,
  convertFifaDob,
  clubsRoughlyEqual,
  buildFifaRoster,
} from '../fifa-loader.mjs';

test('mapFifaPos + convertFifaDob', () => {
  assert.equal(mapFifaPos('PO'), 'Portero');
  assert.equal(mapFifaPos('DF'), 'Defensa');
  assert.equal(mapFifaPos('MC'), 'Centrocampista');
  assert.equal(mapFifaPos('DC'), 'Delantero');
  assert.equal(mapFifaPos('??'), null);
  assert.equal(convertFifaDob('1995-09-15'), '15/09/1995');
  assert.equal(convertFifaDob(null), null);
});

test('clubsRoughlyEqual: mismo club con sufijo país no flaggea; club distinto sí', () => {
  assert.ok(clubsRoughlyEqual('Arsenal', 'Arsenal FC (ENG)'));
  assert.ok(clubsRoughlyEqual('Atlético De Madrid', 'Atlético De Madrid (ESP)'));
  assert.ok(clubsRoughlyEqual('FC Barcelona', 'FC Barcelona (ESP)'));
  assert.ok(!clubsRoughlyEqual('Al Nassr', 'Al Hilal (KSA)'));
  assert.ok(!clubsRoughlyEqual('KVC Westerlo', 'FC Stade Nyonnais (SUI)'));
});

test('match exacto: hereda BD, aplica dorsal+campos FIFA, conserva nombre/club BD', () => {
  const fifaRows = [
    {
      dorsal: 1, pos: 'PO', camiseta: 'RAYA',
      nombre_oficial: 'David RAYA MARTÍN', nombre_lista: 'RAYA David',
      dob: '1995-09-15', club_fifa: 'Arsenal FC (ENG)', estatura_cm: 186,
    },
  ];
  const bd = [
    {
      nombre: 'David Raya', dorsal: 23, tm_player_id: 262749, club: 'Arsenal',
      club_id: 11, club_logo_url: 'logo', foto_url: 'foto', valor_eur: 35000000,
      edad: 30, dob: '15/09/1995', posicion: 'Portero', posicion_tm: 'Portero', es_titular: true,
    },
  ];
  const { roster, report } = buildFifaRoster({ fifaRows, bdRoster: bd, iso3: 'ESP' });
  assert.equal(roster.length, 1);
  const p = roster[0];
  assert.equal(report.matched, 1);
  assert.equal(p.nombre, 'David Raya'); // BD nombre conservado (no nombre_oficial)
  assert.equal(p.club, 'Arsenal'); // club TM conservado
  assert.equal(p.dorsal, 1); // dorsal autoritativo FIFA
  assert.equal(p.tm_player_id, 262749); // heredado
  assert.equal(p.foto_url, 'foto'); // heredado
  assert.equal(p.es_titular, true); // heredado
  assert.equal(p.nombre_camiseta, 'RAYA'); // nuevo
  assert.equal(p.estatura_cm, 186); // nuevo
  assert.equal(p.posicion_fifa, 'PO'); // nuevo
  assert.ok(!('needs_enrich' in p));
});

test('artículo árabe pegado: ALARAB casa BD "Al-Arab" (no se elimina el bueno)', () => {
  const fifaRows = [
    {
      dorsal: 5, pos: 'DF', camiseta: 'ALARAB',
      nombre_oficial: 'Yazan Mousa Mahmoud ALARAB', nombre_lista: 'YAZAN ALARAB',
      dob: '1998-03-04', club_fifa: 'Al-Wehdat (JOR)', estatura_cm: 180,
    },
  ];
  const bd = [{ nombre: 'Yazan Al-Arab', tm_player_id: 539961, dorsal: 5, club: 'Al-Wehdat' }];
  const { roster, report } = buildFifaRoster({ fifaRows, bdRoster: bd, iso3: 'JOR' });
  assert.equal(report.matched, 1);
  assert.equal(report.eliminated.length, 0);
  assert.equal(roster[0].tm_player_id, 539961);
});

test('insert FIFA-sin-BD (needs_enrich) + eliminate BD-sin-FIFA; roster = nº FIFA', () => {
  const fifaRows = [
    {
      dorsal: 13, pos: 'DC', camiseta: 'ALMARDI',
      nombre_oficial: 'Mahmoud Nayef Ahmad ALMARDI', nombre_lista: 'MAHMOUD ALMARDI',
      dob: '2000-06-07', club_fifa: 'Al-Hussein (JOR)', estatura_cm: 182,
    },
  ];
  const bd = [{ nombre: 'Ahmad Assaf', tm_player_id: null }];
  const { roster, report } = buildFifaRoster({ fifaRows, bdRoster: bd, iso3: 'JOR' });
  assert.equal(roster.length, 1); // = nº FIFA
  assert.equal(report.inserted.length, 1);
  assert.equal(report.eliminated.length, 1);
  assert.equal(report.eliminated[0].nombre, 'Ahmad Assaf');
  const ins = roster[0];
  assert.equal(ins.needs_enrich, true);
  assert.equal(ins.es_titular, false);
  assert.equal(ins.nombre, 'Mahmoud Nayef Ahmad ALMARDI');
  assert.equal(ins.posicion, 'Delantero'); // DC → mapeado
  assert.equal(ins.posicion_fifa, 'DC');
  assert.equal(ins.dob, '07/06/2000'); // convertido
  assert.equal(ins.club, 'Al-Hussein (JOR)'); // texto plano
  assert.ok(!('tm_player_id' in ins) && !('foto_url' in ins));
});

test('anti cross-wire: nº de tokens manda (Abu Hasheesh→Abu Hashish, no Abu Taha)', () => {
  const mk = (dorsal, camiseta, oficial, lista) => ({
    dorsal, pos: 'DF', camiseta, nombre_oficial: oficial, nombre_lista: lista,
    dob: '1995-01-01', club_fifa: 'c', estatura_cm: 180,
  });
  const fifaRows = [
    mk(2, 'ABU HASHEESH', 'Mohammad Ali Hasan ABUHASHEESH', 'MOHAMMAD ABUHASHEESH'),
    mk(20, 'ABU TAHA', 'Mohannad Mahmoud Saleh ABU TAHA', 'MOHANNAD ABUTAHA'),
  ];
  const bd = [
    { nombre: 'Mohammed Abu Hashish', tm_player_id: 895249 },
    { nombre: 'Mohannad Abu Taha', tm_player_id: 883111 },
    { nombre: 'Mohammad Abu Taha', tm_player_id: null }, // duplicado de prensa
  ];
  const { roster, report } = buildFifaRoster({ fifaRows, bdRoster: bd, iso3: 'JOR' });
  assert.equal(report.matched, 2);
  const hash = roster.find((p) => p.nombre === 'Mohammed Abu Hashish');
  assert.ok(hash && hash.tm_player_id === 895249); // NO robado por Abu Taha
  const taha = roster.find((p) => p.nombre === 'Mohannad Abu Taha');
  assert.ok(taha && taha.tm_player_id === 883111);
  assert.equal(report.eliminated.length, 1);
  assert.equal(report.eliminated[0].nombre, 'Mohammad Abu Taha'); // el dup no-tm
});

test('apodo no derivable se reporta como possible (no auto-casa): Dibu Martínez', () => {
  const mk = (dorsal, camiseta, oficial, lista, dob) => ({
    dorsal, pos: 'DC', camiseta, nombre_oficial: oficial, nombre_lista: lista,
    dob, club_fifa: 'c (ARG)', estatura_cm: 180,
  });
  const fifaRows = [
    mk(1, 'MARTINEZ E', 'Damián Emiliano MARTÍNEZ', 'MARTINEZ Damian', '1992-09-02'),
    mk(22, 'L MARTINEZ', 'Lautaro Javier MARTÍNEZ', 'MARTINEZ Lautaro', '1997-08-22'),
  ];
  const bd = [
    { nombre: 'Dibu Martínez', tm_player_id: 111873 },
    { nombre: 'Lautaro Martínez', tm_player_id: 222 },
  ];
  const { report } = buildFifaRoster({ fifaRows, bdRoster: bd, iso3: 'ARG' });
  assert.equal(report.matched, 1); // solo Lautaro (given+apellido)
  assert.equal(report.possibleMatches.length, 1); // Dibu ?= Damián
  assert.equal(report.possibleMatches[0].bd, 'Dibu Martínez');
  assert.equal(report.possibleMatches[0].bd_tm, 111873);
});
