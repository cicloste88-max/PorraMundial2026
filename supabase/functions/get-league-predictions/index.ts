// supabase/functions/get-league-predictions/index.ts
// F4 · Screen 1 "Predicciones de la liga" — agregados por partido (grupos).
// Versión 1.0.0 — 09-jun-2026
//
// Devuelve agregados CRUDOS (counts, user_ids, scorers) por fixture de grupos.
// NO computa chips ni puntos: el motor (scoring.js / v3CalcMatchPointsGrupos)
// es la fuente única client-side en F5.
//
// Verja dura de cierre (Opción A, aprobada San): si la porra del CALLER en la
// liga NO está cerrada (is_porra_abierta(caller, league)=true), responde
// gated:true e incluye SOLO el bloque IA (la pred IA es pública pre-cierre,
// mecánica vs-IA), sin agregados humanos. Cuando el caller ha cerrado, devuelve
// todo (incluido el bloque global cross-liga). El gate canónico es
// league_members.porra_cerrada vía RPC is_porra_abierta(uid, league_id).
//
// JWT: verify_jwt=false a nivel deploy (ES256 → 401 con verify_jwt=true, ERR-16).
// Validación manual abajo con service_role (bypasea RLS, patrón
// get-league-standings). El service_role lee predictions de TODAS las ligas
// para el bloque global; nada cruza al cliente salvo lo que pasa la verja.
//
// Bridges de match_id (verificados in vivo, 72/72):
//   predictions.match_id   = "{grupo}_{home_es}_{away_es}"  (legacy, español)
//   wc_matches: group_letter || '_' || home_es || '_' || away_es == predictions.match_id
//               wc_matches.match_key                          == ia_predictions.match_id
//   ia_predictions.match_id = "wc2026_g{grupo}_{sofascore_id}"
// La IA sólo guarda sign + confidence (sin marcador ni goleador). Orientación:
// si ia.home_code != wc.home_iso3 (1 fixture swapped), se invierte el signo
// 1<->2 a la orientación de la porra.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// ─── CORS ───────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = new Set([
  "https://porramundial2026-seven.vercel.app",
  "http://localhost:5173",
]);
function cors(origin: string | null): Record<string, string> {
  const base: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, content-type, x-client-info, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  base["Access-Control-Allow-Origin"] = (origin && ALLOWED_ORIGINS.has(origin)) ? origin : "*";
  return base;
}
function json(body: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Caché in-memory 5 min (agregados ungated; el gate se evalúa por request) ──
const TTL_MS = 5 * 60 * 1000;
// deno-lint-ignore no-explicit-any
const aggCache = new Map<string, { ts: number; data: any }>();
// deno-lint-ignore no-explicit-any
let wcMapCache: { ts: number; map: Map<string, any> } | null = null;

function flipSign(s: string): string { return s === "1" ? "2" : s === "2" ? "1" : s; }

// deno-lint-ignore no-explicit-any
async function getWcMap(supa: any): Promise<Map<string, any>> {
  if (wcMapCache && Date.now() - wcMapCache.ts < TTL_MS) return wcMapCache.map;
  const { data, error } = await supa
    .from("wc_matches")
    .select("match_key, group_letter, home_es, away_es, home_iso3, away_iso3");
  if (error) throw new Error("wc_matches: " + error.message);
  const map = new Map<string, unknown>();
  for (const w of data ?? []) {
    map.set(`${w.group_letter}_${w.home_es}_${w.away_es}`, w);
  }
  wcMapCache = { ts: Date.now(), map };
  return map;
}

// IA bridge: predictions match_id -> wc_matches -> ia_predictions. Sólo sign +
// confidence (la tabla no guarda marcador ni goleador). null si no hay match.
// deno-lint-ignore no-explicit-any
async function computeIA(supa: any, matchId: string) {
  let wcMap: Map<string, any>;
  try { wcMap = await getWcMap(supa); } catch { return null; }
  const wc = wcMap.get(matchId);
  if (!wc || !wc.match_key) return null;
  const { data: iaRow, error } = await supa
    .from("ia_predictions")
    .select("sign, confidence, home_code, away_code")
    .eq("match_id", wc.match_key)
    .maybeSingle();
  if (error || !iaRow) return null;
  let sign = String(iaRow.sign ?? "").trim();
  // Orientación porra: si la IA tiene el local en el visitante de la porra, invertir 1<->2.
  if (wc.home_iso3 && iaRow.home_code && iaRow.home_code !== wc.home_iso3) sign = flipSign(sign);
  return { sign: sign || null, confidence: iaRow.confidence ?? null };
}

// Agregados humanos (sólo se sirven post-cierre). 1 query a predictions por
// fixture (todas las ligas) → split liga / global.
// deno-lint-ignore no-explicit-any
async function computeAggregates(supa: any, matchId: string, leagueId: string) {
  const { data: preds, error } = await supa
    .from("predictions")
    .select("user_id, local, visitante, scorer, league_id")
    .eq("match_id", matchId);
  if (error) throw new Error("predictions: " + error.message);
  const all = preds ?? [];
  const league = all.filter((p: { league_id: string }) => p.league_id === leagueId);

  // deno-lint-ignore no-explicit-any
  const signoOf = (rows: any[]) => {
    let local = 0, empate = 0, visitante = 0;
    for (const p of rows) {
      if (p.local > p.visitante) local++;
      else if (p.local < p.visitante) visitante++;
      else empate++;
    }
    return { local, empate, visitante, total: rows.length };
  };

  // Podio liga: top 3 marcadores (local-visitante) por count, con user_ids.
  // deno-lint-ignore no-explicit-any
  const scoreMap = new Map<string, any>();
  for (const p of league) {
    const k = p.local + "-" + p.visitante;
    let o = scoreMap.get(k);
    if (!o) { o = { local: p.local, visitante: p.visitante, count: 0, users: [] }; scoreMap.set(k, o); }
    o.count++;
    o.users.push(p.user_id);
  }
  const podio = [...scoreMap.values()].sort((a, b) => b.count - a.count).slice(0, 3);

  // Goleadores liga: top 5 scorer no vacío por count.
  const golMap = new Map<string, number>();
  for (const p of league) {
    const s = (p.scorer ?? "").trim();
    if (!s) continue;
    golMap.set(s, (golMap.get(s) ?? 0) + 1);
  }
  const goleadores = [...golMap.entries()]
    .map(([scorer, count]) => ({ scorer, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);

  // Global cross-liga (mismo fixture, todas las ligas): signo + total + topScore.
  const gScoreMap = new Map<string, { local: number; visitante: number; count: number }>();
  for (const p of all) {
    const k = p.local + "-" + p.visitante;
    const o = gScoreMap.get(k);
    if (o) o.count++;
    else gScoreMap.set(k, { local: p.local, visitante: p.visitante, count: 1 });
  }
  let topScore: { local: number; visitante: number; count: number } | null = null;
  for (const o of gScoreMap.values()) if (!topScore || o.count > topScore.count) topScore = o;
  const global = { total: all.length, signo: signoOf(all), topScore };

  const ia = await computeIA(supa, matchId);
  return { signo: signoOf(league), podio, goleadores, global, ia };
}

serve(async (req: Request) => {
  const corsHeaders = cors(req.headers.get("origin"));
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405, corsHeaders);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "missing_env" }, 500, corsHeaders);
  const supa = createClient(SUPABASE_URL, SERVICE_KEY);

  // ── JWT manual ──
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return json({ error: "missing_bearer" }, 401, corsHeaders);
  }
  let callerUid: string;
  try {
    const { data, error } = await supa.auth.getUser(authHeader.slice(7).trim());
    if (error || !data?.user?.id) return json({ error: "invalid_token" }, 401, corsHeaders);
    callerUid = data.user.id;
  } catch { return json({ error: "invalid_token" }, 401, corsHeaders); }

  // ── Body ──
  let body: { match_id?: string; league_id?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400, corsHeaders); }
  const matchId = body?.match_id;
  if (!matchId || typeof matchId !== "string") return json({ error: "missing_match_id" }, 400, corsHeaders);

  // ── Resolver liga (provista o única membresía del caller) + verja de membresía ──
  let leagueId: string;
  if (body.league_id && typeof body.league_id === "string") {
    const { data: m, error } = await supa
      .from("league_members").select("league_id")
      .eq("league_id", body.league_id).eq("user_id", callerUid).maybeSingle();
    if (error) return json({ error: "membership_check_failed", detail: error.message }, 500, corsHeaders);
    if (!m) return json({ error: "not_a_member" }, 403, corsHeaders);
    leagueId = body.league_id;
  } else {
    const { data, error } = await supa.from("league_members").select("league_id").eq("user_id", callerUid);
    if (error) return json({ error: "membership_lookup_failed", detail: error.message }, 500, corsHeaders);
    const ids = (data ?? []).map((r: { league_id: string }) => r.league_id);
    if (ids.length === 0) return json({ error: "no_league" }, 403, corsHeaders);
    if (ids.length > 1) return json({ error: "league_id_required" }, 400, corsHeaders);
    leagueId = ids[0];
  }

  // ── Verja: cierre del caller en esta liga (canónico vía RPC) ──
  let open = true;
  try {
    const { data: ab, error } = await supa.rpc("is_porra_abierta", { p_user_id: callerUid, p_league_id: leagueId });
    if (error) return json({ error: "gate_check_failed", detail: error.message }, 500, corsHeaders);
    open = ab === true;
  } catch (e) { return json({ error: "gate_check_failed", detail: String(e) }, 500, corsHeaders); }

  if (open) {
    // Porra del caller abierta → sólo IA (pública pre-cierre), sin agregados humanos.
    let ia = null;
    try { ia = await computeIA(supa, matchId); } catch { ia = null; }
    return json({ gated: true, match_id: matchId, league_id: leagueId, ia, version: "1.0.0" }, 200, corsHeaders);
  }

  // Cerrada → agregados completos (caché 5 min por match_id|league_id).
  const cacheKey = `${matchId}|${leagueId}`;
  const cached = aggCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return json({ gated: false, match_id: matchId, league_id: leagueId, ...cached.data, cached: true, version: "1.0.0" }, 200, corsHeaders);
  }
  try {
    const data = await computeAggregates(supa, matchId, leagueId);
    aggCache.set(cacheKey, { ts: Date.now(), data });
    return json({ gated: false, match_id: matchId, league_id: leagueId, ...data, version: "1.0.0" }, 200, corsHeaders);
  } catch (e) {
    return json({ error: "aggregate_failed", detail: String(e) }, 500, corsHeaders);
  }
});
