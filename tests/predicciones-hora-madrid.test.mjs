// Regresión hora kickoff Europe/Madrid en vistas de PREDICCIONES — Porra
// Mundial 2026 (fix 13-jun, rama fix/jornada-hora-madrid / ERR-92, brief 2).
//
// Mismo bug que Jornada (ERR-92) en dos vistas más: porra-jugador-v3.js y
// predicciones-liga-v3.js pintaban la hora con new Date(match.date) +
// getHours/getMinutes/getDate → hora de SEDE interpretada como local del
// navegador (un usuario fuera de España vería su propia hora). El fix usa el
// instante UTC real (window.kickoffUtcMsFor, date_utc) y formatea SIEMPRE en
// Europe/Madrid. Este test extrae los dos _timeLabel reales + el kickoffUtcMsFor
// real + el JSON real y verifica MEX-RSA "21:00" (19:00Z) y USA-PAR "03:00"
// (01:00Z, huso US → madrugada Madrid).
import assert from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const LIVE_SYNC_SRC = readFileSync(new URL('../public/js/live-sync.js', import.meta.url), 'utf8');
const JUGADOR_SRC = readFileSync(new URL('../public/js/v3/porra-jugador-v3.js', import.meta.url), 'utf8');
const LIGA_SRC = readFileSync(new URL('../public/js/v3/predicciones-liga-v3.js', import.meta.url), 'utf8');
const MATCHES = JSON.parse(readFileSync(new URL('../public/data/worldcup-2026-matches.json', import.meta.url), 'utf8'));

function sliceBetween(src, startMarker, endMarker, file) {
  const start = src.indexOf(startMarker);
  const end = src.indexOf(endMarker);
  assert.ok(start !== -1, `marcador START (${startMarker}) no encontrado en ${file}`);
  assert.ok(end !== -1 && end > start, `marcador END (${endMarker}) no encontrado en ${file}`);
  return src.slice(start, end);
}

// EQUIPOS mínimo (data.js): name = m.home/m.away español, name_en = JSON home_en.
const EQUIPOS = [
  { name: 'México',          name_en: 'Mexico' },
  { name: 'Sudáfrica',       name_en: 'South Africa' },
  { name: 'Estados Unidos',  name_en: 'USA' },
  { name: 'Paraguay',        name_en: 'Paraguay' },
];

// Índice firma→key idéntico al de loadMatchesJson (live-sync.js).
const keyByMatchSignature = {};
for (const [key, m] of Object.entries(MATCHES)) {
  const sig = [m.home_en, m.away_en].sort().join('|') + '|' + m.group;
  keyByMatchSignature[sig] = key;
}

// kickoffUtcMsFor real, colgado de un window compartido que leen los _timeLabel.
const sharedWindow = {};
(function loadKickoffUtcMsFor() {
  const slice = sliceBetween(LIVE_SYNC_SRC, 'function matchKeyFor', 'function normalizeRow', 'live-sync.js');
  const fn = new Function('window', 'EQUIPOS', 'keyByMatchSignature', 'matchesByKey',
    slice + '\nreturn kickoffUtcMsFor;');
  fn(sharedWindow, EQUIPOS, keyByMatchSignature, MATCHES); // setea sharedWindow.kickoffUtcMsFor
})();

function loadTimeLabel(src, endMarker, file) {
  const slice = sliceBetween(src, 'function _timeLabel(match)', endMarker, file);
  const fn = new Function('window', slice + '\nreturn _timeLabel;');
  return fn(sharedWindow);
}

const timeLabelJugador = loadTimeLabel(JUGADOR_SRC, 'function _matchDayMap', 'porra-jugador-v3.js');
const timeLabelLiga = loadTimeLabel(LIGA_SRC, 'function _realResult', 'predicciones-liga-v3.js');

// Matches de PARTIDOS (data.js): m.date = hora de SEDE sin TZ, a propósito
// distinta de la hora Madrid real para probar que el fix la ignora.
const M_MEX_RSA = { group: 'A', home: 'México',          away: 'Sudáfrica', date: '2026-06-11T15:00:00' }; // → Madrid 21:00
const M_USA_PAR = { group: 'D', home: 'Estados Unidos',  away: 'Paraguay',  date: '2026-06-12T21:00:00' }; // huso US → Madrid 03:00 (+1)

test('porra-jugador _timeLabel: MEX-RSA → "21:00" Madrid', () => {
  const out = timeLabelJugador(M_MEX_RSA);
  assert.ok(out.includes('21:00'), `esperaba "21:00" en "${out}"`);
});

test('porra-jugador _timeLabel: USA-PAR (huso US) → "03:00" Madrid', () => {
  const out = timeLabelJugador(M_USA_PAR);
  assert.ok(out.includes('03:00'), `esperaba "03:00" en "${out}"`);
});

test('predicciones-liga _timeLabel: MEX-RSA → "21:00" Madrid', () => {
  const out = timeLabelLiga(M_MEX_RSA);
  assert.ok(out.includes('21:00'), `esperaba "21:00" en "${out}"`);
});

test('predicciones-liga _timeLabel: USA-PAR (huso US) → "03:00" Madrid', () => {
  const out = timeLabelLiga(M_USA_PAR);
  assert.ok(out.includes('03:00'), `esperaba "03:00" en "${out}"`);
});

test('ambas etiquetas ignoran la hora de SEDE (no contienen la 15:00 local naïve de MEX-RSA)', () => {
  // Con kickoffUtcMsFor resolviendo, la hora de sede (15:00) NO debe aparecer.
  assert.ok(!timeLabelJugador(M_MEX_RSA).includes('15:00'));
  assert.ok(!timeLabelLiga(M_MEX_RSA).includes('15:00'));
});

test('fallback sin kickoffUtcMsFor (carga fría): no rompe, formatea con Madrid sobre m.date', () => {
  // Sin helper en window → cae a new Date(match.date) (= sede +local). Solo
  // verificamos que devuelve una etiqueta no vacía con hora, sin lanzar.
  const coldWindow = {};
  const tlJ = (function () {
    const slice = sliceBetween(JUGADOR_SRC, 'function _timeLabel(match)', 'function _matchDayMap', 'porra-jugador-v3.js');
    return new Function('window', slice + '\nreturn _timeLabel;')(coldWindow);
  })();
  const out = tlJ(M_MEX_RSA);
  assert.match(out, /\d{2}:\d{2}/);
});
