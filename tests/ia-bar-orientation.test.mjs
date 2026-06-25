// Regresión orientación barra IA PREDICE — Porra Mundial 2026 (fix 10-jun).
//
// Bug: en el único fixture con teams_swapped (wc2026_gC_15186861, BRA-ESC J3)
// ia_predictions computó con home_code=SCO/away_code=BRA (orden SofaScore) y
// la barra pintaba breakdown.p_home→LOCAL / p_away→VISITANTE en crudo, sin
// reorientar a wc_matches (home_iso3=BRA). Producción mostraba LOCAL 19 /
// EMP 10 / VISITANTE 71 con quip "Brasil ganará" (Brasil ES el local).
//
// Cubre 4 capas:
//   1. Unit v3IAOrientProbs: swap solo si ia_home_code !== wc_home_iso3
//      (MISMA condición que el flip del sign en la EF get-league-predictions);
//      passthrough sin metadata (on-demand KO) o con metadata parcial; NO muta
//      la entry (sign/confidence/p_* crudos intactos).
//   2. End-to-end v3RenderIABlock con los datos REALES de BD de BRA-ESC →
//      segmentos LOCAL 71 / EMP 10 / VISITANTE 19. Control alineado sin cambio.
//   3. Invariante del JSON de fixtures: 72/72 con home_iso3 y el ÚNICO
//      teams_swapped es wc2026_gC_15186861 (la premisa del fix).
//   4. Wiring guards: loadIAPredictions (auth.js) selecciona home_code y
//      adjunta ia_home_code/wc_home_iso3; v3RenderIABlock pasa por
//      v3IAOrientProbs (si alguien quita el wiring, esto pita).
import assert from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { buildIaSignByLegacyKey } from '../supabase/functions/get-league-standings/ia-bridge.mjs';
import { iaBonusPredicate } from '../supabase/functions/_shared/scoring.mjs';

const ELIM_SRC = readFileSync(new URL('../public/js/v3/eliminatoria-v3.js', import.meta.url), 'utf8');
const AUTH_SRC = readFileSync(new URL('../public/js/auth.js', import.meta.url), 'utf8');
const MATCHES = JSON.parse(readFileSync(new URL('../public/data/worldcup-2026-matches.json', import.meta.url), 'utf8'));

// Extracción por MARCADORES DE FUNCIÓN (patrón scoring.test.mjs, no por nº de
// línea). El span incluye _v3DistributeTo100 → v3RenderIABlock; `window` se
// neutraliza con un stub local y `iaPredictions` se inyecta como parámetro.
function loadIABarRenderer(iaPredictions) {
  const START = 'function _v3DistributeTo100';
  const END = 'window.v3RenderIABlock';
  const start = ELIM_SRC.indexOf(START);
  const end = ELIM_SRC.indexOf(END);
  assert.ok(start !== -1, 'marcador START (function _v3DistributeTo100) no encontrado en eliminatoria-v3.js');
  assert.ok(end !== -1 && end > start, 'marcador END (window.v3RenderIABlock) no encontrado en eliminatoria-v3.js');
  const slice = ELIM_SRC.slice(start, end);
  const fn = new Function(
    'iaPredictions',
    'var window = {};\n' + slice +
    '\nreturn { _v3DistributeTo100, v3IAOrientProbs, v3RenderIABlock };'
  );
  return fn(iaPredictions);
}

// Datos REALES de BD (verificados 10-jun): ia_predictions de wc2026_gC_15186861.
// La IA computó con Escocia como home → p_home es de SCO, p_away de BRA.
const BRA_SCO_ENTRY = {
  sign: '2',
  confidence: 71,
  quip: 'Brasil ganará',
  p_home: 0.19,
  p_draw: 0.10,
  p_away: 0.71,
  ia_home_code: 'SCO',
  wc_home_iso3: 'BRA',
};

test('v3IAOrientProbs — BRA-ESC (swapped): p_home/p_away se intercambian a la orientación de la porra', () => {
  const { v3IAOrientProbs, _v3DistributeTo100 } = loadIABarRenderer({});
  const probs = v3IAOrientProbs(BRA_SCO_ENTRY);
  assert.strictEqual(probs.p_home, 0.71, 'LOCAL (Brasil) debe llevar la prob de away_code=BRA');
  assert.strictEqual(probs.p_draw, 0.10, 'empate sin cambio');
  assert.strictEqual(probs.p_away, 0.19, 'VISITANTE (Escocia) debe llevar la prob de home_code=SCO');
  const pcts = _v3DistributeTo100([probs.p_home, probs.p_draw, probs.p_away]);
  assert.deepStrictEqual(pcts, [71, 10, 19], 'barra final: LOCAL 71 / EMP 10 / VISITANTE 19');
});

test('v3IAOrientProbs — NO muta la entry: sign/confidence/p_* crudos intactos', () => {
  const { v3IAOrientProbs } = loadIABarRenderer({});
  const entry = { ...BRA_SCO_ENTRY };
  v3IAOrientProbs(entry);
  assert.deepStrictEqual(entry, BRA_SCO_ENTRY, 'la orientación es solo presentación, la entry no cambia');
});

test('v3IAOrientProbs — partido alineado (home_code === home_iso3): passthrough exacto', () => {
  const { v3IAOrientProbs } = loadIABarRenderer({});
  const probs = v3IAOrientProbs({ p_home: 0.55, p_draw: 0.25, p_away: 0.20, ia_home_code: 'MEX', wc_home_iso3: 'MEX' });
  assert.deepStrictEqual(probs, { p_home: 0.55, p_draw: 0.25, p_away: 0.20 });
});

test('v3IAOrientProbs — sin metadata (entries on-demand KO) o metadata parcial: passthrough (guard EF)', () => {
  const { v3IAOrientProbs } = loadIABarRenderer({});
  // on-demand KO: la EF compute_match ya devuelve la orientación de la card.
  const ondemand = v3IAOrientProbs({ p_home: 0.40, p_draw: 0.30, p_away: 0.30 });
  assert.deepStrictEqual(ondemand, { p_home: 0.40, p_draw: 0.30, p_away: 0.30 });
  // Metadata parcial → misma guarda que la EF get-league-predictions
  // (solo flip con AMBOS códigos presentes y distintos).
  const partial = v3IAOrientProbs({ p_home: 0.40, p_draw: 0.30, p_away: 0.30, ia_home_code: 'SCO', wc_home_iso3: null });
  assert.deepStrictEqual(partial, { p_home: 0.40, p_draw: 0.30, p_away: 0.30 });
});

test('v3RenderIABlock end-to-end — BRA-ESC pinta LOCAL 71 / EMP 10 / VISITANTE 19 (coherente con el quip)', () => {
  const key = 'C_Brasil_Escocia';
  const { v3RenderIABlock } = loadIABarRenderer({ [key]: BRA_SCO_ENTRY });
  const html = v3RenderIABlock(key);
  assert.ok(html.includes('v3-zoom-ia__seg--home" style="width:71%"'), 'segmento LOCAL al 71% (Brasil favorito)');
  assert.ok(html.includes('v3-zoom-ia__seg--draw" style="width:10%"'), 'segmento EMPATE al 10%');
  assert.ok(html.includes('v3-zoom-ia__seg--away" style="width:19%"'), 'segmento VISITANTE al 19%');
  assert.ok(html.includes('Brasil ganará'), 'quip intacto');
});

test('v3RenderIABlock end-to-end — partido alineado: barra idéntica a los crudos (los otros 71 no cambian)', () => {
  const key = 'A_México_Sudáfrica';
  const entry = { sign: '1', quip: '', p_home: 0.55, p_draw: 0.25, p_away: 0.20, ia_home_code: 'MEX', wc_home_iso3: 'MEX' };
  const { v3RenderIABlock } = loadIABarRenderer({ [key]: entry });
  const html = v3RenderIABlock(key);
  assert.ok(html.includes('v3-zoom-ia__seg--home" style="width:55%"'), 'LOCAL 55% sin flip');
  assert.ok(html.includes('v3-zoom-ia__seg--draw" style="width:25%"'), 'EMPATE 25%');
  assert.ok(html.includes('v3-zoom-ia__seg--away" style="width:20%"'), 'VISITANTE 20%');
});

test('invariante fixtures — 72/72 con home_iso3 y único teams_swapped = wc2026_gC_15186861 (BRA local)', () => {
  const entries = Object.entries(MATCHES);
  assert.strictEqual(entries.length, 72, 'el JSON tiene 72 partidos');
  const sinIso = entries.filter(([, m]) => !m.home_iso3 || !m.away_iso3).map(([k]) => k);
  assert.deepStrictEqual(sinIso, [], 'todos los partidos llevan home_iso3/away_iso3 (los necesita la reorientación)');
  const swapped = entries.filter(([, m]) => m.teams_swapped).map(([k]) => k);
  assert.deepStrictEqual(swapped, ['wc2026_gC_15186861'], 'único fixture swapped del torneo');
  const braSco = MATCHES['wc2026_gC_15186861'];
  assert.strictEqual(braSco.home_iso3, 'BRA', 'la porra tiene a Brasil de LOCAL');
  assert.strictEqual(braSco.away_iso3, 'SCO', 'y a Escocia de VISITANTE');
});

test('wiring guard — loadIAPredictions selecciona home_code y adjunta la metadata de orientación', () => {
  assert.match(AUTH_SRC, /\.select\('match_id[^']*home_code[^']*'\)/, 'el select de ia_predictions debe incluir home_code');
  assert.ok(AUTH_SRC.includes('ia_home_code:'), 'la entry debe llevar ia_home_code');
  assert.ok(AUTH_SRC.includes('wc_home_iso3:'), 'la entry debe llevar wc_home_iso3');
});

test('wiring guard — v3RenderIABlock orienta vía v3IAOrientProbs antes de pintar la barra', () => {
  const start = ELIM_SRC.indexOf('function v3RenderIABlock');
  const end = ELIM_SRC.indexOf('window.v3RenderIABlock');
  assert.ok(start !== -1 && end > start, 'v3RenderIABlock no encontrado');
  const body = ELIM_SRC.slice(start, end);
  assert.ok(body.includes('v3IAOrientProbs('), 'la barra debe pasar por v3IAOrientProbs (no consumir pred.p_home/p_away en crudo)');
  assert.ok(!/_v3DistributeTo100\(\[pred\.p_home/.test(body), 'no debe volver el patrón crudo _v3DistributeTo100([pred.p_home, ...])');
});

// ── Orientación del SIGNO (espejo de buildIaSignByLegacyKey) ──────────────────
// Bug 25-jun (revelado al corregir el dato BRA-ESC a 3-0): loadIAPredictions
// guardaba el sign CRUDO (orden SofaScore) mientras el backend lo flipea en
// ia-bridge.mjs. En el fixture swapped el front creía que la IA predijo Escocia
// ('2') → pintaba "VS IA +1" a los Brasil-predictors (split-brain con la tabla,
// que sí flipea). iaSignForCard (auth.js) aplica el MISMO flip al cargar, de
// modo que TODOS los consumidores de signo del front (iaBonusWillApply, chip
// "vs IA", v3ComputeIAStandings, hydrateIABar, renderIA) hablan en orientación
// porra. La barra (probabilidades) ya se orientaba aparte vía v3IAOrientProbs.
const WC_ROWS_SIGN = [
  { match_key: 'wc2026_gC_15186861', group_letter: 'C', home_es: 'Brasil', away_es: 'Escocia', home_iso3: 'BRA' },
];

function loadIaSignForCard() {
  const startIdx = AUTH_SRC.indexOf('function iaSignForCard');
  assert.ok(startIdx !== -1, 'iaSignForCard no encontrada en auth.js (¿se quitó el flip del sign?)');
  const endIdx = AUTH_SRC.indexOf('\n}', startIdx);
  assert.ok(endIdx !== -1 && endIdx > startIdx, 'cierre de iaSignForCard no encontrado');
  return new Function(AUTH_SRC.slice(startIdx, endIdx + 2) + '\nreturn iaSignForCard;')();
}

test('iaSignForCard — BRA-ESC (swapped): 2(crudo)→1 y PARIDAD con buildIaSignByLegacyKey', () => {
  const iaSignForCard = loadIaSignForCard();
  assert.strictEqual(iaSignForCard('2', 'SCO', 'BRA'), '1',
    'sign crudo 2 (gana visitante=Brasil en SofaScore) → 1 (gana local=Brasil en la card)');
  const back = buildIaSignByLegacyKey(
    [{ match_id: 'wc2026_gC_15186861', sign: '2', home_code: 'SCO' }],
    WC_ROWS_SIGN,
  );
  assert.strictEqual(iaSignForCard('2', 'SCO', 'BRA'), back['C_Brasil_Escocia'].sign,
    'front (iaSignForCard) y backend (buildIaSignByLegacyKey) producen el MISMO signo orientado');
});

test('iaSignForCard — X invariante aunque el fixture esté swapped', () => {
  const iaSignForCard = loadIaSignForCard();
  assert.strictEqual(iaSignForCard('X', 'SCO', 'BRA'), 'X');
});

test('iaSignForCard — alineado (home_code === home_iso3) y metadata parcial: passthrough (los 71 no cambian)', () => {
  const iaSignForCard = loadIaSignForCard();
  assert.strictEqual(iaSignForCard('1', 'MEX', 'MEX'), '1', 'alineado → sin flip');
  assert.strictEqual(iaSignForCard('2', 'MEX', 'MEX'), '2', 'alineado → sin flip');
  assert.strictEqual(iaSignForCard('2', 'SCO', null), '2', 'sin home_iso3 → sin flip (misma guarda que el backend)');
  assert.strictEqual(iaSignForCard('2', null, 'BRA'), '2', 'sin home_code → sin flip');
});

test('parity scoring — con el sign YA orientado, el Brasil-predictor NO cobra +1 (= user_points_cache)', () => {
  const iaSignForCard = loadIaSignForCard();
  const orientedSign = iaSignForCard('2', 'SCO', 'BRA'); // '1'
  // Brasil 2-0 (sign '1'), real 3-0 (sign '1'): el user coincide con la IA → SIN bono.
  // Ese era exactamente el "+1 fantasma" del card antes del fix.
  assert.strictEqual(iaBonusPredicate({ sign: orientedSign }, { l: 2, v: 0 }, 3, 0), false,
    'coincide con la IA (ambos Brasil) → 0');
  // Control contra-IA: predijo empate (≠ IA '1') y acierta el empate real → +1.
  assert.strictEqual(iaBonusPredicate({ sign: orientedSign }, { l: 1, v: 1 }, 1, 1), true,
    'contra-IA acertando → +1');
});

test('wiring guard — loadIAPredictions asigna el sign vía iaSignForCard (no el crudo p.sign)', () => {
  assert.match(AUTH_SRC, /sign:\s*iaSignForCard\(/, 'el sign de la entry debe orientarse con iaSignForCard');
  assert.ok(!AUTH_SRC.includes('sign: p.sign,'),
    'el sign crudo (sign: p.sign) ya no debe asignarse en la entry IA');
});
