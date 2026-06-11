// Regresión hora kickoff Europe/Madrid en Vista Directo — Porra Mundial 2026
// (fix 11-jun, PR #156 / ERR-87).
//
// Bug raíz (ERR-87): normalizeRow (live-sync.js) construye la cache
// window._liveScoresByMatchKey SIN match_start_ts a primer nivel (el campo
// quedaba solo dentro de .raw). _kickoffMs (ui-directo.js) leía
// liveRow.match_start_ts → undefined → fallback a m.date (hora de sede sin
// timezone) en TODOS los partidos. El smoke original pasó porque la row
// sintética sí llevaba el campo a primer nivel: smoke con datos sintéticos
// no valida la FORMA del dato real.
//
// Este test pasa rows REALES de live_scores (forma exacta del SELECT,
// match_start_ts BIGINT en segundos, verificadas en BD 11-jun) por el
// normalizeRow REAL (extraído de live-sync.js con el JSON wc_matches real)
// y el resultado por el _kickoffHoraLabel REAL (extraído de ui-directo.js).
// Esperado: MEX-RSA "21:00" (19:00Z) · KOR-CZE "04:00 +1" (02:00Z día
// siguiente al día canónico 2026-06-11).
import assert from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const LIVE_SYNC_SRC = readFileSync(new URL('../public/js/live-sync.js', import.meta.url), 'utf8');
const UI_DIRECTO_SRC = readFileSync(new URL('../public/js/ui-directo.js', import.meta.url), 'utf8');
const MATCHES = JSON.parse(readFileSync(new URL('../public/data/worldcup-2026-matches.json', import.meta.url), 'utf8'));

// Extracción por marcadores de función (patrón ia-bar-orientation.test.mjs).
function sliceBetween(src, startMarker, endMarker, file) {
  const start = src.indexOf(startMarker);
  const end = src.indexOf(endMarker);
  assert.ok(start !== -1, `marcador START (${startMarker}) no encontrado en ${file}`);
  assert.ok(end !== -1 && end > start, `marcador END (${endMarker}) no encontrado en ${file}`);
  return src.slice(start, end);
}

// normalizeRow real, con el matchesByKey real inyectado.
function loadNormalizeRow() {
  const slice = sliceBetween(LIVE_SYNC_SRC, 'function normalizeRow', 'function applyRow', 'live-sync.js');
  const fn = new Function(
    'matchesByKey',
    'var window = {};\n' + slice + '\nreturn normalizeRow;'
  );
  return fn(MATCHES);
}

// Helpers de hora reales: _kickoffMs → _formatHoraMadrid → _madridDateStr → _kickoffHoraLabel.
function loadHoraHelpers() {
  const slice = sliceBetween(UI_DIRECTO_SRC, 'function _kickoffMs', 'function statusLabel', 'ui-directo.js');
  const fn = new Function(
    'var window = {};\n' + slice +
    '\nreturn { _kickoffMs, _formatHoraMadrid, _madridDateStr, _kickoffHoraLabel };'
  );
  return fn();
}

// Rows REALES de live_scores (SELECT match_key, status, score_home,
// score_away, events, match_start_ts — valores verificados en BD 11-jun).
const ROW_MEX_RSA = {
  match_key: 'wc2026_gA_15186710',
  status: 'notstarted',
  score_home: null,
  score_away: null,
  events: [],
  match_start_ts: 1781204400, // 2026-06-11T19:00:00Z, BIGINT segundos
};
const ROW_KOR_CZE = {
  match_key: 'wc2026_gA_15186720',
  status: 'notstarted',
  score_home: null,
  score_away: null,
  events: [],
  match_start_ts: 1781229600, // 2026-06-12T02:00:00Z (madrugada Madrid)
};

// Entradas REALES de PARTIDOS (data.js): m.date = hora de sede SIN timezone.
const M_MEX_RSA = { group: 'A', home: 'México', away: 'Sudáfrica', date: '2026-06-11T15:00:00' };
const M_KOR_CZE = { group: 'A', home: 'República de Corea', away: 'República Checa', date: '2026-06-11T22:00:00' };

test('normalizeRow expone match_start_ts a primer nivel (forma real de la cache, ERR-87)', () => {
  const normalizeRow = loadNormalizeRow();
  const norm = normalizeRow(ROW_MEX_RSA);
  assert.ok(norm, 'row del Mundial debe normalizar (match_key presente en wc_matches JSON)');
  assert.strictEqual(norm.match_start_ts, 1781204400,
    'match_start_ts debe copiarse a primer nivel de la row normalizada, no solo quedar en .raw');
  assert.strictEqual(norm.raw.match_start_ts, 1781204400, '.raw conserva la row de BD');
});

test('MEX-RSA: cache real → 21:00 Madrid (no 15:00 de sede)', () => {
  const normalizeRow = loadNormalizeRow();
  const { _kickoffHoraLabel } = loadHoraHelpers();
  const ctx = { liveRow: normalizeRow(ROW_MEX_RSA) };
  assert.strictEqual(_kickoffHoraLabel(ctx, M_MEX_RSA), '21:00');
});

test('KOR-CZE: cache real → 04:00 +1 (02:00Z cae en el día siguiente al canónico)', () => {
  const normalizeRow = loadNormalizeRow();
  const { _kickoffHoraLabel } = loadHoraHelpers();
  const ctx = { liveRow: normalizeRow(ROW_KOR_CZE) };
  assert.strictEqual(_kickoffHoraLabel(ctx, M_KOR_CZE), '04:00 +1');
});

test('cache vieja sin match_start_ts a primer nivel: _kickoffMs cae a .raw (mixed-deploy)', () => {
  const { _kickoffHoraLabel } = loadHoraHelpers();
  // Forma de la cache ANTERIOR al fix de normalizeRow: solo .raw lleva el ts.
  const staleNorm = {
    match_key: ROW_MEX_RSA.match_key,
    status: 'notstarted',
    score_home: null,
    score_away: null,
    events: [],
    minute: null,
    _teams_swapped: false,
    raw: ROW_MEX_RSA,
  };
  assert.strictEqual(_kickoffHoraLabel({ liveRow: staleNorm }, M_MEX_RSA), '21:00');
});

test('sin row de live_scores: fallback legacy a m.date (hora de sede, fila nunca vacía)', () => {
  const { _kickoffHoraLabel } = loadHoraHelpers();
  assert.strictEqual(_kickoffHoraLabel({ liveRow: null }, M_MEX_RSA), '15:00');
});

test('detección seg/ms: el mismo kickoff en milisegundos da la misma hora', () => {
  const { _kickoffMs } = loadHoraHelpers();
  assert.strictEqual(_kickoffMs({ match_start_ts: 1781204400 }), 1781204400000, 'segundos → ms');
  assert.strictEqual(_kickoffMs({ match_start_ts: 1781204400000 }), 1781204400000, 'ms pasan tal cual');
});
