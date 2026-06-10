// Smoke test selección time-aware de highlights — Porra Mundial 2026.
//
// Cubre el módulo PURO `get-league-highlights/select.mjs` (Stream 2, v1.0.2):
// los insights 1 (signo) y 2 (marcador) solo pueden elegir partidos con
// kickoff FUTURO de la jornada más baja con pendientes. `now` se inyecta como
// parámetro — aquí se simulan los tres momentos del torneo pedidos por San:
//   (a) un partido con date_utc pasado NO se elige;
//   (b) con la J1 entera jugada, los candidatos apuntan a J2;
//   (c) con now=hoy (todo pendiente) sigue eligiendo J1.
// Más el guard del parse UTC explícito: date_utc viene SIN segundos ni Z y
// new Date(date_utc) lo tomaría como hora local (desfase cerca del kickoff).

import assert from 'node:assert';
import { test } from 'node:test';
import {
  parseKickoffUTC,
  selectUpcomingRound,
} from '../supabase/functions/get-league-highlights/select.mjs';

// Fixture mínima estilo wc_matches: 2 partidos por jornada (J1/J2/J3).
const FIXTURE = [
  { matchId: 'A_Mexico_Sudafrica', dateUtc: '2026-06-11T19:00', round: 1 },
  { matchId: 'A_Canada_Catar', dateUtc: '2026-06-12T02:00', round: 1 },
  { matchId: 'A_Mexico_Catar', dateUtc: '2026-06-18T19:00', round: 2 },
  { matchId: 'A_Canada_Sudafrica', dateUtc: '2026-06-18T22:00', round: 2 },
  { matchId: 'A_Catar_Sudafrica', dateUtc: '2026-06-24T19:00', round: 3 },
  { matchId: 'A_Mexico_Canada', dateUtc: '2026-06-24T19:00', round: 3 },
];

test('parseKickoffUTC — date_utc sin Z se interpreta como UTC explícito, no hora local', () => {
  const d = parseKickoffUTC('2026-06-11T19:00');
  assert.ok(d instanceof Date);
  assert.strictEqual(d.getTime(), Date.UTC(2026, 5, 11, 19, 0, 0));
  assert.strictEqual(parseKickoffUTC(null), null);
  assert.strictEqual(parseKickoffUTC('no-es-fecha'), null);
});

test('(a) un partido con date_utc pasado NO se elige (kickoff <= now excluido)', () => {
  // now = 11-jun 22:00Z: México-Sudáfrica (19:00Z) ya jugado, Canadá-Catar (12-jun) pendiente.
  const now = new Date(Date.UTC(2026, 5, 11, 22, 0, 0));
  const sel = selectUpcomingRound(FIXTURE, now);
  assert.ok(sel, 'debe haber selección con pendientes');
  assert.strictEqual(sel.round, 1, 'la J1 sigue siendo la jornada inminente');
  assert.strictEqual(sel.ids.has('A_Mexico_Sudafrica'), false, 'el partido pasado queda fuera');
  assert.strictEqual(sel.ids.has('A_Canada_Catar'), true, 'el pendiente de J1 sigue dentro');
  // Borde exacto: un partido cuyo kickoff es exactamente now cuenta como en juego.
  const enJuego = selectUpcomingRound(FIXTURE, new Date(Date.UTC(2026, 5, 11, 19, 0, 0)));
  assert.strictEqual(enJuego.ids.has('A_Mexico_Sudafrica'), false);
});

test('(b) con la J1 entera jugada, los candidatos apuntan a J2 (y solo a J2)', () => {
  const now = new Date(Date.UTC(2026, 5, 13, 0, 0, 0)); // 13-jun: J1 completa
  const sel = selectUpcomingRound(FIXTURE, now);
  assert.ok(sel);
  assert.strictEqual(sel.round, 2, 'rota solo a la J2');
  assert.deepStrictEqual(
    [...sel.ids].sort(),
    ['A_Canada_Sudafrica', 'A_Mexico_Catar'],
    'solo los partidos de J2 son candidatos'
  );
  assert.strictEqual(sel.ids.has('A_Catar_Sudafrica'), false, 'J3 futura pero NO inminente queda fuera');
});

test('(c) con now=hoy (todo pendiente) sigue eligiendo J1', () => {
  const now = new Date(Date.UTC(2026, 5, 10, 12, 0, 0)); // 10-jun: nada jugado
  const sel = selectUpcomingRound(FIXTURE, now);
  assert.ok(sel);
  assert.strictEqual(sel.round, 1);
  assert.deepStrictEqual([...sel.ids].sort(), ['A_Canada_Catar', 'A_Mexico_Sudafrica']);
});

test('sin pendientes de grupos (post-28-jun) devuelve null → insights 1 y 2 no se emiten', () => {
  const now = new Date(Date.UTC(2026, 6, 1, 0, 0, 0)); // 01-jul
  assert.strictEqual(selectUpcomingRound(FIXTURE, now), null);
});

test('robustez: partidos sin date_utc parseable se excluyen sin romper la selección', () => {
  const now = new Date(Date.UTC(2026, 5, 10, 12, 0, 0));
  const sel = selectUpcomingRound(
    [...FIXTURE, { matchId: 'X_Sin_Fecha', dateUtc: null, round: 1 }],
    now
  );
  assert.strictEqual(sel.ids.has('X_Sin_Fecha'), false);
  assert.strictEqual(sel.round, 1);
});
