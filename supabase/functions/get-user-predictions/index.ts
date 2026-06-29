// supabase/functions/get-user-predictions/index.ts
// F4 · Screen 2 "Porra de un jugador" — picks crudos de un jugador (grupos + KO).
// Versión 1.1.0 — 29-jun-2026
//
// Devuelve los pronósticos de grupos (predictions) + boosts (boost_picks) +
// KO (ko_predictions) de un user_id objetivo, CRUDOS. NO computa chips ni
// puntos: el motor real (v3CalcMatchPointsGrupos / calcKOMatchPoints) los
// calcula client-side. Para la comparación KO contra la competición real,
// devuelve también ko_real: el cruce sembrado (wc_matches_ko) + resultado
// (results.ko_results) por slot — el frontend no tiene acceso a esas tablas.
//
// Verja dura de cierre (Opción A, aprobada San): si la porra del TARGET en la
// liga NO está cerrada (is_porra_abierta(target, league)=true), responde
// gated:true sin picks. Sólo se exponen los picks de un jugador tras SU cierre.
// Gate canónico: league_members.porra_cerrada vía RPC is_porra_abierta.
//
// Caller: debe estar autenticado (JWT manual) y ser miembro de la liga.
// service_role bypasea RLS (patrón get-league-standings). ko_real NO es
// user-specific (es la competición real); wc_matches_ko/ko_results son
// SOFT-FAIL (degradan a {} sin tumbar la respuesta) y vacíos hasta ~28-jun.
//
// JWT: verify_jwt=false a nivel deploy (ES256 → 401 con verify_jwt=true, ERR-16).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  let body: { user_id?: string; league_id?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400, corsHeaders); }
  const targetUid = body?.user_id;
  if (!targetUid || typeof targetUid !== "string") return json({ error: "missing_user_id" }, 400, corsHeaders);

  // ── Resolver liga (provista o única membresía del caller) + verja de membresía del caller ──
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

  // ── Verja: cierre del TARGET en esta liga (canónico vía RPC) ──
  let targetOpen = true;
  try {
    const { data: ab, error } = await supa.rpc("is_porra_abierta", { p_user_id: targetUid, p_league_id: leagueId });
    if (error) return json({ error: "gate_check_failed", detail: error.message }, 500, corsHeaders);
    targetOpen = ab === true;
  } catch (e) { return json({ error: "gate_check_failed", detail: String(e) }, 500, corsHeaders); }

  if (targetOpen) {
    return json({ gated: true, user_id: targetUid, league_id: leagueId, version: "1.1.0" }, 200, corsHeaders);
  }

  // ── Picks crudos del target en esta liga (grupos + KO) + KO real ──
  const [
    { data: preds, error: pErr },
    { data: boosts, error: bErr },
    { data: koPreds, error: koErr },
    { data: resultRow, error: rErr },
    { data: wcKoRows, error: wcKoErr },
  ] = await Promise.all([
    supa.from("predictions").select("match_id, local, visitante, scorer")
      .eq("user_id", targetUid).eq("league_id", leagueId),
    supa.from("boost_picks").select("match_id")
      .eq("user_id", targetUid).eq("league_id", leagueId),
    supa.from("ko_predictions").select("match_id, local, visitante, scorer, classifier")
      .eq("user_id", targetUid).eq("league_id", leagueId),
    supa.from("results").select("ko_results").limit(1).maybeSingle(),
    supa.from("wc_matches_ko").select("ko_match_id, round, home_iso3, away_iso3, teams_swapped, date_utc").order("ko_match_id"),
  ]);
  if (pErr) return json({ error: "predictions_query_failed", detail: pErr.message }, 500, corsHeaders);
  if (bErr) return json({ error: "boost_query_failed", detail: bErr.message }, 500, corsHeaders);
  if (koErr) return json({ error: "ko_predictions_query_failed", detail: koErr.message }, 500, corsHeaders);
  // results(ko_results) y wc_matches_ko son SOFT-FAIL: la comparación KO degrada
  // a {} (bracket propio sin lado real) sin tumbar la respuesta de grupos.
  if (rErr) console.error("[get-user-predictions] results(ko_results) query failed (KO real → {}):", rErr.message);
  if (wcKoErr) console.error("[get-user-predictions] wc_matches_ko query failed (KO real → {}):", wcKoErr.message);

  const predictions = (preds ?? []).map((p: { match_id: string; local: number; visitante: number; scorer: string | null }) => ({
    match_id: p.match_id, local: p.local, visitante: p.visitante, scorer: p.scorer,
  }));
  const boost_picks = (boosts ?? []).map((b: { match_id: string }) => b.match_id);
  const ko_predictions = (koPreds ?? []).map((k: { match_id: number; local: number; visitante: number; scorer: string | null; classifier: string | null }) => ({
    match_id: k.match_id, local: k.local, visitante: k.visitante, scorer: k.scorer, classifier: k.classifier,
  }));

  // KO real — cruces sembrados (wc_matches_ko) ⨝ resultado (results.ko_results),
  // por slot. ko_results ya viene orientado a (home_iso3, away_iso3) y winner
  // relativo a ellos (el puente aplica teams_swapped al escribir, ERR-99), así
  // que el frontend lo consume sin re-flip. Slots no sembrados (R16+ pre-cuadre)
  // simplemente no aparecen → el frontend muestra "pendiente".
  const koResultsRaw: Record<string, { l?: number; v?: number; winner?: string; status?: string; scorers?: string[] }> =
    (resultRow && resultRow.ko_results && typeof resultRow.ko_results === "object") ? resultRow.ko_results : {};
  const ko_real: Record<string, {
    home_iso3: string | null; away_iso3: string | null; round: string | null; date_utc: string | null;
    teams_swapped: boolean; l: number | null; v: number | null; winner: string | null; status: string | null; scorers: string[];
  }> = {};
  for (const row of (wcKoRows ?? []) as Array<{ ko_match_id: number; round: string | null; home_iso3: string | null; away_iso3: string | null; teams_swapped: boolean | null; date_utc: string | null }>) {
    const slot = String(row.ko_match_id);
    const res = (koResultsRaw[slot] && typeof koResultsRaw[slot] === "object") ? koResultsRaw[slot] : null;
    ko_real[slot] = {
      home_iso3: row.home_iso3 ?? null,
      away_iso3: row.away_iso3 ?? null,
      round: row.round ?? null,
      date_utc: row.date_utc ?? null,
      teams_swapped: !!row.teams_swapped,
      l: res && res.l != null ? res.l : null,
      v: res && res.v != null ? res.v : null,
      winner: res && res.winner ? res.winner : null,   // 'home' | 'away' (relativo a home_iso3/away_iso3)
      status: res && res.status ? res.status : null,
      scorers: res && Array.isArray(res.scorers) ? res.scorers : [],
    };
  }

  return json({ gated: false, user_id: targetUid, league_id: leagueId, predictions, boost_picks, ko_predictions, ko_real, version: "1.1.0" }, 200, corsHeaders);
});
