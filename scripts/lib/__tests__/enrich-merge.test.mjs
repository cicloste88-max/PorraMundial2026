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

// ─── fuzzy fallback Pass 2 — 23-may-2026 ────────────────────────────────────

test('applyEnrich Pass 2 fuzzy: variantes árabes que sobreviven a R1+R2+R3', () => {
  // Casos reales JOR donde normalize() difiere pero scorePair ≥60 vía
  // last-token-equal o Levenshtein del apellido. Sin fuzzy fallback estos
  // jugadores se quedaban sin enrich (run 26340440262: 15/30 con TM solo).
  const roster = [
    { nombre: 'Yazid Abulaila' },          // TM: Yazeed Abulaila (R2 yazed≠yazid, last token match)
    { nombre: 'Odeh Al-Fakhouri' },        // TM: Odeh Fakhoury (R1 strip, Lev fakhouri≈fakhoury 0.875)
    { nombre: 'Mohammed Abu Hashish' },    // TM: Mohammad Abu Hasheesh (R2+R3, Lev hashish≈hashesh 0.857)
    { nombre: 'Mohammad Abu Taha' },       // TM: Mohannad Abu Taha (token-set 2/3 overlap)
  ];
  const tmMap = new Map([
    [261850, { tm_player_id: 261850, name: 'Yazeed Abulaila', valor_eur: 100_000, iso3: 'JOR' }],
    [870001, { tm_player_id: 870001, name: 'Odeh Fakhoury', valor_eur: 200_000, iso3: 'JOR' }],
    [870002, { tm_player_id: 870002, name: 'Mohammad Abu Hasheesh', valor_eur: 150_000, iso3: 'JOR' }],
    [883111, { tm_player_id: 883111, name: 'Mohannad Abu Taha', valor_eur: 250_000, iso3: 'JOR' }],
  ]);
  const { roster: out, stats } = applyEnrich(roster, tmMap, { iso3: 'JOR' });
  assert.equal(out[0].tm_player_id, 261850, 'Yazid → Yazeed');
  assert.equal(out[1].tm_player_id, 870001, 'Al-Fakhouri → Fakhoury');
  assert.equal(out[2].tm_player_id, 870002, 'Hashish → Hasheesh');
  assert.equal(out[3].tm_player_id, 883111, 'Mohammad Abu Taha → Mohannad Abu Taha');
  assert.equal(stats.matched, 4);
  assert.equal(stats.matched_fuzzy, 4, 'todos via Pass 2 fuzzy');
});

test('applyEnrich Pass 2 fuzzy NO roba TM ya asignado en Pass 1', () => {
  // Yazeed Abulaila ya tiene match exacto vía tm_player_id en Pass 1.
  // Yazid Abulaila NO debe pillarlo en Pass 2 (es el mismo TM 261850).
  const roster = [
    { nombre: 'Yazeed Abulaila', tm_player_id: 261850 },  // Pass 1 ID-match
    { nombre: 'Yazid Abulaila' },                          // Pass 2 quedaría sin TM
  ];
  const tmMap = new Map([
    [261850, { tm_player_id: 261850, name: 'Yazeed Abulaila', valor_eur: 100_000, iso3: 'JOR' }],
  ]);
  const { roster: out, stats } = applyEnrich(roster, tmMap, { iso3: 'JOR' });
  assert.equal(out[0].tm_player_id, 261850);
  assert.equal(out[1].tm_player_id, undefined, 'Yazid no roba TM ya usado');
  assert.equal(stats.matched, 1);
  assert.equal(stats.matched_fuzzy, 0);
});
