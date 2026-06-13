// Regresión hora kickoff Europe/Madrid en Vista Jornada — Porra Mundial 2026
// (fix 13-jun, rama fix/jornada-hora-madrid / ERR-92).
//
// Bug raíz (ERR-92): renderVistaJornada (ui-groups.js) formateaba la hora con
// _joParseMatchDate(m.date), que añade "+02:00" ASUMIENDO que todo el Mundial
// es CEST. Falso: las sedes están en husos US/Canadá/México y m.date (PARTIDOS,
// data.js) es hora de SEDE sin timezone. Efecto: MEX-RSA pintaba 15:00 en vez
// de 21:00. Directo NO sufría el bug porque usa el UTC real (match_start_ts).
//
// El fix añade _joKickoffMs (ui-groups.js) → window.kickoffUtcMsFor (live-sync.js),
// que lee date_utc del JSON wc_matches (= live_scores.match_start_ts, mismo
// instante que Directo). Este test extrae las DOS funciones reales + el JSON
// real, las cablea como en runtime (kickoffUtcMsFor colgado de window) y verifica
// la hora Madrid resultante. Esperado: MEX-RSA "21:00" (19:00Z), KOR-CZE "04:00"
// (02:00Z, madrugada), USA-PAR "03:00" (01:00Z, huso US → madrugada Madrid).
import assert from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const LIVE_SYNC_SRC = readFileSync(new URL('../public/js/live-sync.js', import.meta.url), 'utf8');
const UI_GROUPS_SRC = readFileSync(new URL('../public/js/ui-groups.js', import.meta.url), 'utf8');
const MATCHES = JSON.parse(readFileSync(new URL('../public/data/worldcup-2026-matches.json', import.meta.url), 'utf8'));

// Extracción por marcadores de función (patrón directo-hora-madrid.test.mjs).
function sliceBetween(src, startMarker, endMarker, file) {
  const start = src.indexOf(startMarker);
  const end = src.indexOf(endMarker);
  assert.ok(start !== -1, `marcador START (${startMarker}) no encontrado en ${file}`);
  assert.ok(end !== -1 && end > start, `marcador END (${endMarker}) no encontrado en ${file}`);
  return src.slice(start, end);
}

// EQUIPOS mínimo (data.js): name = m.home/m.away español, name_en = JSON home_en.
const EQUIPOS = [
  { name: 'México',              name_en: 'Mexico' },
  { name: 'Sudáfrica',           name_en: 'South Africa' },
  { name: 'República de Corea',  name_en: 'South Korea' },
  { name: 'República Checa',     name_en: 'Czechia' },
  { name: 'Estados Unidos',      name_en: 'USA' },
  { name: 'Paraguay',            name_en: 'Paraguay' },
];

// Índice firma→key idéntico al que construye loadMatchesJson (live-sync.js).
const keyByMatchSignature = {};
for (const [key, m] of Object.entries(MATCHES)) {
  const sig = [m.home_en, m.away_en].sort().join('|') + '|' + m.group;
  keyByMatchSignature[sig] = key;
}

// Window compartido: la slice de live-sync cuelga matchKeyFor + kickoffUtcMsFor
// de él, y la slice de ui-groups lo lee desde _joKickoffMs (mismo cableado que
// en el navegador).
const sharedWindow = {};

// kickoffUtcMsFor + matchKeyFor reales (con EQUIPOS / índice / JSON inyectados).
function loadKickoffUtcMsFor() {
  const slice = sliceBetween(LIVE_SYNC_SRC, 'function matchKeyFor', 'function normalizeRow', 'live-sync.js');
  const fn = new Function('window', 'EQUIPOS', 'keyByMatchSignature', 'matchesByKey',
    slice + '\nreturn kickoffUtcMsFor;');
  return fn(sharedWindow, EQUIPOS, keyByMatchSignature, MATCHES);
}

// _joKickoffMs + _joParseMatchDate reales (leen window.kickoffUtcMsFor).
function loadJoKickoffMs() {
  const slice = sliceBetween(UI_GROUPS_SRC, 'function _joParseMatchDate', 'function _joKOSlotLabel', 'ui-groups.js');
  const fn = new Function('window', slice + '\nreturn { _joKickoffMs, _joParseMatchDate };');
  return fn(sharedWindow);
}

const kickoffUtcMsFor = loadKickoffUtcMsFor(); // también setea sharedWindow.kickoffUtcMsFor
const { _joKickoffMs } = loadJoKickoffMs();

// Formateo idéntico al de producción (toLocaleTimeString TZ Madrid, 24h).
const horaMadrid = (ms) =>
  new Date(ms).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });

// Entradas de PARTIDOS (data.js): m.date = hora de SEDE sin timezone. El valor
// está puesto a propósito DISTINTO de la hora Madrid real para probar que el
// fix lo ignora y usa date_utc.
const M_MEX_RSA = { group: 'A', home: 'México',             away: 'Sudáfrica',      date: '2026-06-11T15:00:00' }; // sede 15:00 → Madrid 21:00
const M_KOR_CZE = { group: 'A', home: 'República de Corea', away: 'República Checa', date: '2026-06-11T22:00:00' }; // sede 22:00 → Madrid 04:00
const M_USA_PAR = { group: 'D', home: 'Estados Unidos',     away: 'Paraguay',       date: '2026-06-12T21:00:00' }; // sede US 21:00 → Madrid 03:00 (+1)
const M_UNRESOLVABLE = { group: 'Z', home: 'Atlantis',      away: 'Wakanda',        date: '2026-06-11T15:00:00' }; // no resuelve key → fallback

test('kickoffUtcMsFor: MEX-RSA → instante UTC real 2026-06-11T19:00Z (= match_start_ts Directo)', () => {
  // 1781204400000 ms = 2026-06-11T19:00:00Z (mismo valor del test de Directo).
  assert.strictEqual(kickoffUtcMsFor(M_MEX_RSA), 1781204400000);
});

test('MEX-RSA: _joKickoffMs → 21:00 Madrid (no 15:00 de sede)', () => {
  assert.strictEqual(horaMadrid(_joKickoffMs(M_MEX_RSA)), '21:00');
});

test('KOR-CZE: 02:00Z → 04:00 Madrid (madrugada)', () => {
  assert.strictEqual(horaMadrid(_joKickoffMs(M_KOR_CZE)), '04:00');
});

test('USA-PAR (huso US, 01:00Z): → 03:00 Madrid (madrugada), no la hora de sede', () => {
  assert.strictEqual(kickoffUtcMsFor(M_USA_PAR), Date.parse('2026-06-13T01:00Z'));
  assert.strictEqual(horaMadrid(_joKickoffMs(M_USA_PAR)), '03:00');
});

test('sin date_utc resoluble (key no encontrada): fallback a m.date no rompe', () => {
  const ms = _joKickoffMs(M_UNRESOLVABLE);
  assert.ok(Number.isFinite(ms), 'el fallback devuelve un instante finito, nunca null/NaN');
  // Fallback legacy: m.date 15:00 sede + '+02:00' = 13:00Z → Madrid 15:00.
  assert.strictEqual(horaMadrid(ms), '15:00');
});

test('kickoffUtcMsFor idempotente con designador Z explícito (no duplica zona)', () => {
  // El regex de kickoffUtcMsFor NO debe añadir un segundo 'Z' si ya lo trae.
  const withZ = { ...MATCHES.wc2026_gA_15186710, date_utc: '2026-06-11T19:00Z' };
  const synthMatches = { wc2026_gA_15186710: withZ };
  const slice = sliceBetween(LIVE_SYNC_SRC, 'function matchKeyFor', 'function normalizeRow', 'live-sync.js');
  const fn = new Function('window', 'EQUIPOS', 'keyByMatchSignature', 'matchesByKey',
    slice + '\nreturn kickoffUtcMsFor;');
  const synthWindow = {};
  const k = fn(synthWindow, EQUIPOS, keyByMatchSignature, synthMatches);
  assert.strictEqual(k(M_MEX_RSA), 1781204400000);
});
