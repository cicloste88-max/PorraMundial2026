// node --test tests/xi-slot-map.test.mjs
//
// Sprint A2 FIX C — Pizarra XI real. Valida lo más frágil del pipeline:
//   (1) el remapeo geométrico del once-tipo FF (orden DOM ≠ orden de slot) a
//       índice de slot, usando fixtures HTML reales (JPN GK primero, ESP GK
//       último, ESP Pedri entre líneas).
//   (2) el desempate por bucket de homónimos al construir squads.xi (JPN
//       Suzuki→Zion PO, Ito→Hiroki DEF).

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import { parseStartingXISlotsFromHtml } from '../scripts/lib/ff-scraper.mjs';
import { buildXi, assignSlotsByCoords, getPosCodes } from '../scripts/lib/xi-slot-map.mjs';

const __dir = dirname(fileURLToPath(import.meta.url));
const COORDS = JSON.parse(readFileSync(resolve(__dir, '../scripts/lib/formation-coords.json'), 'utf8'));
const fixture = (iso3) => readFileSync(resolve(__dir, `fixtures/ff/${iso3}.html`), 'utf8');

const jpnSlots = parseStartingXISlotsFromHtml(fixture('jpn'));
const espSlots = parseStartingXISlotsFromHtml(fixture('esp'));

test('once-tipo parser extrae 11 slots con coordenadas data-onceff-x/y', () => {
  for (const slots of [jpnSlots, espSlots]) {
    assert.equal(slots.length, 11);
    assert.ok(slots.every((s) => Number.isFinite(s.x) && Number.isFinite(s.y)));
  }
});

test('remap geométrico JPN (GK primero en DOM) → slot 0 = portero, slot 10 = DC', () => {
  const { assigned, mapped } = assignSlotsByCoords(jpnSlots, COORDS['3-4-2-1']);
  assert.equal(mapped, 11);
  assert.match(assigned[0].titular, /suzuki/i);
  assert.match(assigned[10].titular, /ueda/i);
});

test('remap geométrico ESP (GK ÚLTIMO en DOM) → slot 0 = Joan Garcia', () => {
  const { assigned } = assignSlotsByCoords(espSlots, COORDS['4-3-3']);
  assert.match(assigned[0].titular, /joan|garcia/i);
  assert.match(assigned[9].titular, /oyarzabal/i);
});

test('asignación global resuelve ESP entre-líneas (Pedri/Fabián a medio, no a delantero)', () => {
  const { assigned } = assignSlotsByCoords(espSlots, COORDS['4-3-3']);
  const pedri = assigned.findIndex((s) => /pedri/i.test(s?.titular || ''));
  const fabian = assigned.findIndex((s) => /fabi/i.test(s?.titular || ''));
  assert.ok(pedri >= 5 && pedri <= 7, `Pedri en slot ${pedri}, esperado 5-7 (medio)`);
  assert.ok(fabian >= 5 && fabian <= 7, `Fabián en slot ${fabian}, esperado 5-7 (medio)`);
  assert.ok(assigned.every(Boolean), 'los 11 slots asignados');
});

// Roster sintético JPN con homónimos reales (3 Suzuki / 2 Ito en distintos buckets).
const mk = (nombre, posicion, dorsal, tm) => ({
  nombre, posicion, dorsal, tm_player_id: tm,
  foto_url: `https://x/${tm}.jpg`, posicion_tm: posicion,
});
const JPN_ROSTER = [
  mk('Zion Suzuki', 'Portero', 1, 100), mk('Junnosuke Suzuki', 'Defensa', 25, 101), mk('Yuito Suzuki', 'Delantero', 17, 102),
  mk('Hiroki Ito', 'Defensa', 21, 103), mk('Junya Ito', 'Centrocampista', 14, 104),
  mk('Takehiro Tomiyasu', 'Defensa', 16, 105), mk('Ko Itakura', 'Defensa', 22, 106),
  mk('Ritsu Doan', 'Centrocampista', 8, 107), mk('Wataru Endo', 'Centrocampista', 6, 108),
  mk('Ao Tanaka', 'Centrocampista', 7, 109), mk('Kaito Nakamura', 'Delantero', 13, 110),
  mk('Takefusa Kubo', 'Delantero', 20, 111), mk('Daichi Kamada', 'Centrocampista', 15, 112),
  mk('Ayase Ueda', 'Delantero', 19, 113), mk('Suplente Banco', 'Defensa', 3, 114),
];

test('buildXi JPN — orden de slot, foto y sin duplicados', () => {
  const { xi, stats } = buildXi({
    ffSlots: jpnSlots, formacion: '3-4-2-1', coords: COORDS['3-4-2-1'], roster: JPN_ROSTER, iso3: 'JPN',
  });
  assert.equal(xi.length, 11);
  assert.deepEqual(xi.map((e) => e.pos), getPosCodes('3-4-2-1'));
  assert.ok(xi.every((e) => e.foto_url), 'todas las entradas con foto');
  assert.equal(new Set(xi.map((e) => e.tm_player_id)).size, 11, 'sin tm_player_id duplicado');
  assert.equal(stats.matched, 11);
});

test('buildXi JPN — desempate por bucket: Suzuki→Zion (PO), Ito→Hiroki (DFC)', () => {
  const { xi } = buildXi({
    ffSlots: jpnSlots, formacion: '3-4-2-1', coords: COORDS['3-4-2-1'], roster: JPN_ROSTER, iso3: 'JPN',
  });
  assert.equal(xi[0].nombre, 'Zion Suzuki');
  assert.equal(xi[0].pos, 'PO');
  const hiroki = xi.findIndex((e) => e.nombre === 'Hiroki Ito');
  assert.ok(hiroki >= 1 && hiroki <= 3 && xi[hiroki].pos === 'DFC', 'Hiroki Ito en un slot DFC');
  assert.ok(!xi.some((e) => e.nombre === 'Junya Ito'), 'Junya Ito (Centro) descartado por el bucket');
});

test('buildXi — slot sin once-tipo cae a placeholder, sin romper longitud', () => {
  const { xi } = buildXi({
    ffSlots: jpnSlots.slice(0, 10), formacion: '3-4-2-1', coords: COORDS['3-4-2-1'], roster: JPN_ROSTER, iso3: 'JPN',
  });
  assert.equal(xi.length, 11);
});
