// Item 2 post-J1 — retirada de update-results + hardening de lectores jsonb.
//
// Contexto (11-jun): update-results v9 escribía con JSON.stringify → jsonb
// double-encoded tipo string que crasheaba porra-bridge-results con 500 MUDO
// (sin traza), y sobrescribía match_results/ko_results cada 20 min pisando al
// bridge. Decisión San (12-jun): RETIRAR (cron ya unscheduled; ESPN+bridge es
// el pipeline canónico). Hardening obligatorio en los lectores:
//   - bridge v8: asObj defensivo en match_results/ko_results + try/catch
//     global con stack a console.error.
//   - admin.js: 5 JSON.parse directos sobre campos jsonb → admAsObj (con el
//     results normalizado a OBJETO, JSON.parse crasheaba el panel admin).

import assert from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const BRIDGE_SRC = readFileSync(new URL('../supabase/functions/porra-bridge-results/index.ts', import.meta.url), 'utf8');
const ADMIN_SRC = readFileSync(new URL('../public/js/admin.js', import.meta.url), 'utf8');
const UR_SRC = readFileSync(new URL('../supabase/functions/update-results/index.ts', import.meta.url), 'utf8');

test('bridge v8: asObj definido y aplicado a match_results y ko_results', () => {
  assert.ok(BRIDGE_SRC.includes('function asObj(v: unknown)'));
  assert.match(BRIDGE_SRC, /asObj\(resultRow\?\.match_results\) \?\? \{\}/);
  assert.match(BRIDGE_SRC, /asObj\(resultRow\?\.ko_results\) \?\? \{\}/);
});

test('bridge v8: try/catch global con stack — el handler vive en handle() y serve() lo envuelve', () => {
  assert.ok(BRIDGE_SRC.includes('async function handle(req: Request): Promise<Response>'));
  const servePos = BRIDGE_SRC.indexOf('Deno.serve(async (req: Request) => {');
  const block = BRIDGE_SRC.slice(servePos);
  assert.ok(block.includes('return await handle(req);'));
  assert.ok(block.includes('e.stack'));
  assert.ok(block.includes('internal_uncaught'));
});

test('bridge v7 intacto bajo v8: refresh de user_points_cache tras bridge', () => {
  assert.ok(BRIDGE_SRC.includes('get-league-standings'));
  assert.ok(BRIDGE_SRC.includes('cache_refresh: cacheRefreshed'));
});

test('admin.js: cero JSON.parse directos sobre campos jsonb de results — todo vía admAsObj', () => {
  assert.ok(ADMIN_SRC.includes('function admAsObj(v)'));
  assert.ok(!/JSON\.parse\((?:r|resultsRes)\.data/.test(ADMIN_SRC));
  const uses = (ADMIN_SRC.match(/admAsObj\(/g) || []).length;
  assert.ok(uses >= 6, `esperaba ≥6 referencias admAsObj (def + 5 sites), hay ${uses}`);
});

test('update-results: marcada RETIRADA con instrucciones de no recrear el cron sin reescritura', () => {
  assert.ok(UR_SRC.includes('⛔ RETIRADA'));
  assert.ok(UR_SRC.includes('NO recrear el cron'));
});
