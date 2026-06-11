// Matcher bidireccional de update-results (prep pg_cron 11-jun) — Porra Mundial 2026.
//
// Hallazgo del audit pre-activación: la EF v7 resolvía grupos con
// find(home AND away) en la orientación estricta de GROUP_MATCHES; el único
// fixture con teams_swapped (wc2026_gC_15186861, Brasil-Escocia J3 — el
// fixture oficial que sigue football-data trae a Escocia de local) se saltaba
// EN SILENCIO. v8 resuelve bidireccional en ./matcher.mjs: orientación directa
// primero y, si falla, la inversa GIRANDO el marcador bajo la key canónica app.
//
// Cubre los 3 casos pedidos (directo / invertido con swap de marcador / sin
// mapeo) + invariantes del fixture (72 únicos, lookup no ambiguo) + wiring
// guards del gate X-Cron-Key en index.ts (verify_jwt pasa a false — sin gate
// la EF quedaría pública y cualquiera quemaría el rate limit de football-data,
// 10 req/min free tier).
import assert from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import {
  GROUP_MATCHES,
  getMatchKey,
  resolveGroupResult,
} from '../supabase/functions/update-results/matcher.mjs';

const INDEX_SRC = readFileSync(
  new URL('../supabase/functions/update-results/index.ts', import.meta.url),
  'utf8'
);

test('caso directo — orientación API == app: key canónica y marcador tal cual', () => {
  const r = resolveGroupResult('México', 'Sudáfrica', 2, 1);
  assert.deepStrictEqual(r, { key: 'A_México_Sudáfrica', l: 2, v: 1, swapped: false });
});

test('caso invertido REAL (BRA-ESC J3, teams_swapped) — key canónica app y marcador girado', () => {
  // football-data (fixture oficial): Escocia 1 - 2 Brasil. La app tiene a
  // Brasil de LOCAL en wc2026_gC_15186861 → l=2 (Brasil), v=1 (Escocia).
  const r = resolveGroupResult('Escocia', 'Brasil', 1, 2);
  assert.deepStrictEqual(r, { key: 'C_Brasil_Escocia', l: 2, v: 1, swapped: true });
});

test('caso sin mapeo — par que no es fixture de grupos: null (el caller loguea, no rompe)', () => {
  // Cruce KO plausible entre equipos reales: no debe colarse como grupo.
  assert.strictEqual(resolveGroupResult('Brasil', 'Alemania', 1, 0), null);
  // Equipo fuera del torneo (TLA sin mapear aguas arriba nunca llega, pero
  // el matcher tampoco debe inventar nada).
  assert.strictEqual(resolveGroupResult('Atlántida', 'Brasil', 1, 0), null);
});

test('exhaustivo — los 72 fixtures resuelven en AMBAS orientaciones a su key canónica', () => {
  for (const gm of GROUP_MATCHES) {
    const key = getMatchKey(gm.group, gm.home, gm.away);
    const directo = resolveGroupResult(gm.home, gm.away, 3, 0);
    assert.deepStrictEqual(directo, { key, l: 3, v: 0, swapped: false }, `directo ${key}`);
    const invertido = resolveGroupResult(gm.away, gm.home, 0, 3);
    assert.deepStrictEqual(invertido, { key, l: 3, v: 0, swapped: true }, `invertido ${key}`);
  }
});

test('invariante fixture — 72 partidos sin par repetido en ninguna orientación (lookup no ambiguo)', () => {
  assert.strictEqual(GROUP_MATCHES.length, 72, '12 grupos × 6 partidos');
  const pares = new Set();
  for (const gm of GROUP_MATCHES) {
    const canon = [gm.home, gm.away].sort().join('|');
    assert.ok(!pares.has(canon), `par duplicado (rompería el lookup inverso): ${gm.home} vs ${gm.away}`);
    pares.add(canon);
  }
});

test('wiring guard — index.ts resuelve grupos vía ./matcher.mjs (no vuelve el find unidireccional)', () => {
  assert.match(INDEX_SRC, /import \{ resolveGroupResult \} from "\.\/matcher\.mjs"/, 'import del matcher');
  assert.ok(INDEX_SRC.includes('resolveGroupResult(homeApp, awayApp'), 'el loop de grupos pasa por el matcher');
  assert.ok(!INDEX_SRC.includes('GROUP_MATCHES.find('), 'sin find unidireccional inline en la EF');
});

test('wiring guard — gate X-Cron-Key activo y ANTES del fetch a football-data', () => {
  assert.ok(INDEX_SRC.includes('x-cron-key'), 'lee el header X-Cron-Key');
  assert.ok(INDEX_SRC.includes('IA_CRON_KEY'), 'valida contra IA_CRON_KEY (env con fallback Vault)');
  assert.ok(INDEX_SRC.includes('status: 401'), '401 si falta o no coincide');
  const gateAt = INDEX_SRC.indexOf('await isCronAuthorized(req)');
  const fetchAt = INDEX_SRC.indexOf('api.football-data.org');
  assert.ok(gateAt !== -1, 'el handler llama al gate');
  assert.ok(fetchAt !== -1, 'el fetch a football-data sigue presente');
  assert.ok(gateAt < fetchAt, 'el gate corta antes de quemar rate limit (10 req/min free tier)');
});
