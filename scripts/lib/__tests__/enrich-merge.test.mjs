// scripts/lib/__tests__/enrich-merge.test.mjs
// Tests del applyEnrich: ID-first, fallback por nombre, fill-missing, persist-back.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { applyEnrich } from '../enrich-merge.mjs';

test('applyEnrich fill-missing NO pisa campos buenos del roster previo', () => {
  const roster = [
    {
      nombre: 'Mike Maignan',
      tm_player_id: 182906,
      foto_url:
        'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/player-photos/FRA/182906.jpg',
      edad: 30,
    },
  ];
  // Pieza A shape: name/value_eur/age/photo_url_tm
  const tmMap = new Map([
    [
      182906,
      {
        tm_player_id: 182906,
        name: 'Mike Maignan',
        value_eur: 25_000_000,
        age: 31, // distinto de 30 — NO debe pisar
        dorsal: 16,
        photo_url_tm: 'https://img.../182906-new.jpg', // distinto — NO pisa foto_url Storage
        iso3: 'FRA',
      },
    ],
  ]);
  const { roster: out, stats } = applyEnrich(roster, tmMap, { iso3: 'FRA', sourceLabel: 'A' });
  assert.equal(out[0].edad, 30); // NO pisa el 30 con el 31
  assert.equal(
    out[0].foto_url,
    'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/player-photos/FRA/182906.jpg'
  ); // foto_url Storage intacta
  assert.equal(out[0].valor_eur, 25_000_000); // rellena lo que faltaba (canonizado)
  assert.equal(out[0].dorsal, 16); // pieza A no aporta dorsal normalmente, pero si lo aporta lo coge
  assert.equal(out[0].foto_url_tm, 'https://img.../182906-new.jpg'); // foto_url_tm temporal sí entra
  assert.equal(stats.matched, 1);
  assert.equal(stats.with_dorsal, 1);
  assert.equal(stats.source, 'A');
});

test('applyEnrich persist-back tm_player_id cuando match es por nombre', () => {
  const roster = [{ nombre: 'Théo Hernández' }]; // sin tm_player_id
  const tmMap = new Map([
    [123, { tm_player_id: 123, name: 'Theo Hernandez', iso3: 'FRA' }],
  ]);
  const { roster: out } = applyEnrich(roster, tmMap, { iso3: 'FRA' });
  assert.equal(out[0].tm_player_id, 123); // persisted-back
});

test('applyEnrich fallback por nombre sólo aplica a misma iso3', () => {
  const roster = [{ nombre: 'Juan Pérez' }];
  // Mismo nombre pero iso3 distinto: NO debe matchear.
  const tmMap = new Map([
    [999, { tm_player_id: 999, name: 'Juan Pérez', iso3: 'ARG', value_eur: 1_000_000 }],
  ]);
  const { roster: out, stats } = applyEnrich(roster, tmMap, { iso3: 'ESP' });
  assert.equal(out[0].tm_player_id, undefined);
  assert.equal(out[0].valor_eur, undefined);
  assert.equal(stats.matched, 0);
});

test('applyEnrich pieza B shape (valor_eur, edad, posicion_tm, dorsal, dob)', () => {
  const roster = [{ nombre: 'Joan García', tm_player_id: 561613 }];
  const tmMap = new Map([
    [
      561613,
      {
        tm_player_id: 561613,
        nombre: 'Joan García',
        valor_eur: 40_000_000,
        edad: 25,
        dob: '04/05/2001',
        dorsal: 18,
        posicion_tm: 'Portero',
        club: 'FC Barcelona',
        club_id: 131,
        club_logo_url: 'https://tmssl.akamaized.net/images/wappen/verysmall/131.png',
        foto_url_tm: 'https://img.../561613.jpg',
      },
    ],
  ]);
  const { roster: out, stats } = applyEnrich(roster, tmMap, { iso3: 'ESP', sourceLabel: 'B' });
  assert.equal(out[0].valor_eur, 40_000_000);
  assert.equal(out[0].edad, 25);
  assert.equal(out[0].dob, '04/05/2001');
  assert.equal(out[0].dorsal, 18);
  assert.equal(out[0].posicion_tm, 'Portero');
  assert.equal(out[0].club, 'FC Barcelona');
  assert.equal(out[0].club_id, 131);
  assert.equal(stats.matched, 1);
  assert.equal(stats.with_dob, 1);
  assert.equal(stats.with_dorsal, 1);
});

test('applyEnrich ID-first prioriza sobre fallback por nombre', () => {
  const roster = [{ nombre: 'Player A', tm_player_id: 100 }];
  const tmMap = new Map([
    [100, { tm_player_id: 100, name: 'Player A renamed', value_eur: 50_000, iso3: 'ESP' }],
    [200, { tm_player_id: 200, name: 'Player A', value_eur: 999_999, iso3: 'ESP' }],
  ]);
  const { roster: out } = applyEnrich(roster, tmMap, { iso3: 'ESP' });
  // ID 100 gana porque player.tm_player_id era 100, aunque el name match
  // hubiera sido al ID 200.
  assert.equal(out[0].tm_player_id, 100);
  assert.equal(out[0].valor_eur, 50_000);
});

test('applyEnrich roster sin nombre lo ignora sin romperse', () => {
  const roster = [{ nombre: '' }, { nombre: 'OK', tm_player_id: 1 }];
  const tmMap = new Map([[1, { tm_player_id: 1, valor_eur: 100, iso3: 'ESP' }]]);
  const { roster: out, stats } = applyEnrich(roster, tmMap, { iso3: 'ESP' });
  assert.equal(out[0].nombre, '');
  assert.equal(out[1].valor_eur, 100);
  assert.equal(stats.matched, 1);
});
