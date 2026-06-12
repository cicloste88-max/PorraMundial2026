// R2 post-J1 — Tarjeta Resultados (sección FINALIZADOS de Jornada): dos
// defectos con los datos reales de Parrandas (gallos: 2-1 Quinones sobre
// MEX-RSA 2-0 real).
//
// (a) Chips: _buildJCard marcaba "Goleador ✗" y "+1 pts" porque comparaba
//     pred.gol contra el PLACEHOLDER primer-jugador-de-plantilla del ganador
//     y llamaba calcMatchPoints sin el 5º argumento (ERR-91 — el mismo patrón
//     del Item 3+5 en un componente distinto). Ahora: scorers canónicos del
//     bridge (window._matchResultsByKey[matchKey].scorers) con fallback a
//     deriveScorersFromEvents, y el calc recibe los scorers.
// (b) Pill BOOST: loadBoostPicks leía localStorage con window._currentLeagueId
//     y consultaba BD con getActiveLeagueId() — keys divergentes → el cache
//     'boostPicks_default' rancio pintaba la pill en el partido equivocado, y
//     la rama de migración podía SUBIR locals de otra liga a boost_picks.
//     Ahora: key única _boostLsKey(), migración solo con locals de ESTA liga,
//     y repaint de Jornada tras cargar BD.
//
// Referencia de comportamiento correcto: porra-jugador (Item 6).

import assert from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const GROUPS_SRC = readFileSync(new URL('../public/js/ui-groups.js', import.meta.url), 'utf8');
const DATA_SRC = readFileSync(new URL('../public/js/data.js', import.meta.url), 'utf8');

function extractFn(src, name, isAsync) {
  const sig = (isAsync ? 'async function ' : 'function ') + name + '(';
  const start = src.indexOf(sig);
  assert.ok(start > -1, `función ${name} no encontrada`);
  const end = src.indexOf('\n}', start);
  return src.slice(start, end + 2);
}

// ─── (a) _buildJCard con el código REAL ───

const EQUIPOS_FIXTURE = [
  // players[0] = Jimenez a propósito: el placeholder viejo (primer jugador del
  // ganador) habría dado golMatch=false para el pick 'Quinones'.
  { name: 'México', flag: 'MEX', players: [{ key: 'Jimenez', name: '9 · Raúl Jiménez' }, { key: 'Quinones', name: '16 · Julián Quiñones' }] },
  { name: 'Sudáfrica', flag: 'RSA', players: [{ key: 'Zwane', name: '11 · Themba Zwane' }] },
];

const MEX_RSA = { group: 'A', home: 'México', away: 'Sudáfrica', date: '2026-06-11T12:00', stadium: 'Azteca' };
const KEY = 'A_México_Sudáfrica';
const LIVE = {
  status: 'finished', score_home: 2, score_away: 0, _teams_swapped: false,
  events: [
    { id: 199794646, time: 9, isHome: true, player: { name: 'Julián Quiñones' }, incidentType: 'goal', incidentClass: 'regular' },
    { id: 139952626, time: 67, isHome: true, player: { name: 'Raúl Jiménez' }, incidentType: 'goal', incidentClass: 'regular' },
  ],
};

function makeBuildJCard(opts) {
  const calls = [];
  const calcStub = (pred, l, r, key, scorers) => {
    calls.push({ key, scorers });
    let pts = 0;
    const exact = pred.l === l && pred.v === r;
    if (Math.sign(pred.l - pred.v) === Math.sign(l - r)) pts += 1;
    if (exact) pts += 3;
    const golOk = pred.gol ? (Array.isArray(scorers) && scorers.includes(pred.gol)) : false;
    if (golOk) pts += 2;
    return pts; // sin boost: el marker (boost ×2) se testea por separado
  };
  const factory = new Function(
    'window', 'getMatchKey', 'predictions', 'EQUIPOS', 'SB', 'ISO3_TO_ISO2',
    '_joParseMatchDate', 'deriveScorersFromEvents', 'iaBonusWillApply',
    'iaPredictions', 'getMySign', 'calcMatchPoints',
    `${extractFn(GROUPS_SRC, '_buildJCard')}
     return _buildJCard;`,
  );
  const build = factory(
    { _matchResultsByKey: opts.matchResults || {} },
    (m) => m.group + '_' + m.home + '_' + m.away,
    opts.predictions,
    EQUIPOS_FIXTURE,
    '',
    { MEX: 'MX', RSA: 'ZA' },
    (d) => new Date(d),
    opts.derive || (() => []),
    () => false,
    {},
    (p) => (p.l > p.v ? '1' : p.l < p.v ? '2' : 'X'),
    calcStub,
  );
  return { build, calls };
}

test('aceptación Parrandas: 2-1 Quinones sobre 2-0 → 1X2 ✓, Exacto ✗, Goleador ✓, +3 pts, SIN pill boost', () => {
  const { build, calls } = makeBuildJCard({
    predictions: { [KEY]: { l: 2, v: 1, gol: 'Quinones', saved: true } },
    matchResults: { [KEY]: { l: 2, v: 0, scorers: ['Quinones', 'Jimenez'], status: 'finished' } },
  });
  // boostKey = el boost REAL de Parrandas ese día (KOR-CZE), NO este partido.
  const html = build(MEX_RSA, 0, '2026-06-11', 'A_República de Corea_República Checa', LIVE);
  assert.ok(html.includes('1X2 ✓'));
  assert.ok(html.includes('Exacto ✗'));
  assert.ok(html.includes('Goleador ✓'));
  assert.ok(html.includes('+3 pts'));
  assert.ok(!html.includes('is-boost'));
  assert.ok(!html.includes('(boost ×2)'));
  // El calc recibió los scorers canónicos como 5º argumento (no ERR-91).
  assert.deepStrictEqual(calls[0].scorers, ['Quinones', 'Jimenez']);
});

test('fallback sin match_results: deriva de events crudos (espejo bridge)', () => {
  const { build } = makeBuildJCard({
    predictions: { [KEY]: { l: 2, v: 1, gol: 'Quinones', saved: true } },
    matchResults: {},
    derive: (events) => (Array.isArray(events) && events.length === 2 ? ['Quinones', 'Jimenez'] : []),
  });
  const html = build(MEX_RSA, 0, '2026-06-11', null, LIVE);
  assert.ok(html.includes('Goleador ✓'));
  assert.ok(html.includes('+3 pts'));
});

test('pill y marker (boost ×2): solo en el partido boosteado Y con exacto+goleador (R3)', () => {
  const fixtures = {
    predictions: { [KEY]: { l: 2, v: 0, gol: 'Quinones', saved: true } },
    matchResults: { [KEY]: { l: 2, v: 0, scorers: ['Quinones', 'Jimenez'], status: 'finished' } },
  };
  const exactGol = makeBuildJCard(fixtures).build(MEX_RSA, 0, '2026-06-11', KEY, LIVE);
  assert.ok(exactGol.includes('is-boost'));
  assert.ok(exactGol.includes('(boost ×2)'));

  // Exacto SIN goleador acertado: pill de boost sí (es su pick), marker ×2 NO.
  const exactSolo = makeBuildJCard({
    predictions: { [KEY]: { l: 2, v: 0, gol: 'Zwane', saved: true } },
    matchResults: fixtures.matchResults,
  }).build(MEX_RSA, 0, '2026-06-11', KEY, LIVE);
  assert.ok(exactSolo.includes('is-boost'));
  assert.ok(!exactSolo.includes('(boost ×2)'));
});

test('wiring: el placeholder primer-jugador-del-ganador ya no existe en _buildJCard', () => {
  const fn = extractFn(GROUPS_SRC, '_buildJCard');
  assert.ok(!fn.includes('players?.[0]?.key'));
  assert.ok(fn.includes('window._matchResultsByKey'));
  assert.ok(fn.includes('deriveScorersFromEvents'));
  assert.match(fn, /calcMatchPoints\(predWithSaved, realL, realR, matchKey, realScorers\)/);
});

// ─── (b) loadBoostPicks con el código REAL ───

function makeLoadBoost(env) {
  const factory = new Function(
    'window', 'localStorage', 'document', 'saveBoostPicks', 'console',
    `let boostPicks = {};
     ${extractFn(DATA_SRC, '_boostLsKey')}
     ${extractFn(DATA_SRC, 'loadBoostPicks', true)}
     return { load: loadBoostPicks, getBoost: () => boostPicks };`,
  );
  return factory(env.window, env.localStorage, env.document || { getElementById: () => null },
    env.saveBoostPicks || (() => {}), { warn: () => {}, log: () => {} });
}

function fakeLs(store) {
  return {
    store,
    reads: [],
    getItem(k) { this.reads.push(k); return this.store[k] ?? null; },
    setItem(k, v) { this.store[k] = v; },
  };
}

function dbWith(rows) {
  return {
    from() {
      const b = {
        select() { return b; }, eq() { return b; },
        then(res) { res({ data: rows, error: null }); },
      };
      return b;
    },
  };
}

const WIN = (rows) => ({
  getActiveLeagueId: () => 'liga-gallos',
  _currentLeagueId: undefined, // el global viejo divergente: ya NO debe usarse para la key
  currentUser: { id: 'u-parrandas' },
  _porraDb: dbWith(rows),
});

test('lee/escribe localStorage con la key de la liga ACTIVA (no _currentLeagueId/default)', async () => {
  const ls = fakeLs({ 'boostPicks_default': JSON.stringify({ '2026-06-11': 'A_México_Sudáfrica' }) });
  const api = makeLoadBoost({ window: WIN([{ match_date: '2026-06-11', match_id: 'A_República de Corea_República Checa' }]), localStorage: ls });
  await api.load();
  assert.deepStrictEqual(ls.reads, ['boostPicks_liga-gallos']); // el default rancio NI SE LEE
  assert.deepStrictEqual(api.getBoost(), { '2026-06-11': 'A_República de Corea_República Checa' });
  assert.ok(ls.store['boostPicks_liga-gallos'].includes('Corea'));
});

test('BD vacía + local rancio de OTRA key → boostPicks {} y NO se migra (sin contaminación cruzada)', async () => {
  let migrated = false;
  const ls = fakeLs({ 'boostPicks_default': JSON.stringify({ '2026-06-11': 'A_México_Sudáfrica' }) });
  const api = makeLoadBoost({
    window: WIN([]), localStorage: ls,
    saveBoostPicks: () => { migrated = true; },
  });
  await api.load();
  assert.strictEqual(migrated, false);
  assert.deepStrictEqual(api.getBoost(), {});
});

test('BD vacía + local DE ESTA liga → migración one-shot (recovery bug AUTH intacto)', async () => {
  let migrated = false;
  const ls = fakeLs({ 'boostPicks_liga-gallos': JSON.stringify({ '2026-06-11': 'X' }) });
  const api = makeLoadBoost({
    window: WIN([]), localStorage: ls,
    saveBoostPicks: () => { migrated = true; },
  });
  await api.load();
  assert.strictEqual(migrated, true);
});

test('repaint: con #jornada-container presente, re-renderiza Jornada tras cargar BD', async () => {
  let repainted = false;
  const win = WIN([{ match_date: '2026-06-11', match_id: 'K' }]);
  win.renderVistaJornada = () => { repainted = true; };
  const api = makeLoadBoost({
    window: win,
    localStorage: fakeLs({}),
    document: { getElementById: (id) => (id === 'jornada-container' ? {} : null) },
  });
  await api.load();
  assert.strictEqual(repainted, true);
});

// ─── R2a-bis: v3CalcMatchPointsGrupos (grupos-v3, consumido por porra-jugador) ───
// El MISMO placeholder primer-jugador-del-ganador vivía aquí: con dogino
// (gol=Jimenez=players[0]) coincidía de casualidad; con Parrandas (Quinones)
// el chip Gol de porra-jugador y de grupos marcaba ✗.

const GRUPOS_SRC = readFileSync(new URL('../public/js/v3/grupos-v3.js', import.meta.url), 'utf8');

function makeV3Calc(matchResults, calcRecorder) {
  const factory = new Function(
    'window', 'getMatchKey', 'EQUIPOS', 'iaBonusWillApply', 'calcMatchPoints',
    `${extractFn(GRUPOS_SRC, 'v3CalcMatchPointsGrupos')}
     return v3CalcMatchPointsGrupos;`,
  );
  return factory(
    { _matchResultsByKey: matchResults },
    (m) => m.group + '_' + m.home + '_' + m.away,
    EQUIPOS_FIXTURE,
    () => false,
    calcRecorder,
  );
}

test('R2a-bis: gole por scorers canónicos (Quinones ✓ aunque players[0] sea Jimenez) y calc con 5º arg', () => {
  const calls = [];
  const calc = makeV3Calc(
    { 'A_México_Sudáfrica': { l: 2, v: 0, scorers: ['Quinones', 'Jimenez'], status: 'finished' } },
    (p, l, r, k, sc) => { calls.push(sc); return 3; },
  );
  const out = calc(
    { saved: true, l: 2, v: 1, gol: 'Quinones', home: 'México', away: 'Sudáfrica' },
    { group: 'A', home: 'México', away: 'Sudáfrica', realHome: 2, realAway: 0, played: true },
  );
  assert.ok(out.types.indexOf('gole') !== -1);
  assert.ok(out.types.indexOf('win') !== -1);
  assert.deepStrictEqual(calls[0], ['Quinones', 'Jimenez']);
});

test('R2a-bis: goleador en EMPATE también cuenta (el placeholder viejo lo excluía)', () => {
  const calc = makeV3Calc(
    { 'A_México_Sudáfrica': { l: 1, v: 1, scorers: ['Quinones', 'Zwane'], status: 'finished' } },
    () => 3,
  );
  const out = calc(
    { saved: true, l: 1, v: 1, gol: 'Zwane', home: 'México', away: 'Sudáfrica' },
    { group: 'A', home: 'México', away: 'Sudáfrica', realHome: 1, realAway: 1, played: true },
  );
  assert.ok(out.types.indexOf('gole') !== -1);
});

test('R2a-bis: sin entrada canónica aún (lag del bridge) → sin gole y calc recibe []', () => {
  const calls = [];
  const calc = makeV3Calc({}, (p, l, r, k, sc) => { calls.push(sc); return 1; });
  const out = calc(
    { saved: true, l: 2, v: 1, gol: 'Quinones', home: 'México', away: 'Sudáfrica' },
    { group: 'A', home: 'México', away: 'Sudáfrica', realHome: 2, realAway: 0, played: true },
  );
  assert.ok(out.types.indexOf('gole') === -1);
  assert.deepStrictEqual(calls[0], []);
});
