// supabase/functions/get-user-predictions/index.ts
// F4 · Screen 2 "Porra de un jugador" — picks crudos de un jugador (grupos).
// Versión 1.0.0 — 09-jun-2026
//
// Devuelve los pronósticos de grupos (predictions) + boosts (boost_picks) de un
// user_id objetivo, CRUDOS. NO computa chips ni puntos: el motor real
// (v3CalcMatchPointsGrupos / calcMatchPoints) los calcula client-side en F5.
//
// Verja dura de cierre (Opción A, aprobada San): si la porra del TARGET en la
// liga NO está cerrada (is_porra_abierta(target, league)=true), responde
// gated:true sin picks. Sólo se exponen los picks de un jugador tras SU cierre.
// Gate canónico: league_members.porra_cerrada vía RPC is_porra_abierta.
//
// Caller: debe estar autenticado (JWT manual) y ser miembro de la liga.
// service_role bypasea RLS (patrón get-league-standings). KO fuera de scope
// (ko_predictions no se consulta; wc_matches_ko vacía hasta ~28-jun).
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
    return json({ gated: true, user_id: targetUid, league_id: leagueId, version: "1.0.0" }, 200, corsHeaders);
  }

  // ── Picks crudos del target en esta liga (grupos) ──
  const [
    { data: preds, error: pErr },
    { data: boosts, error: bErr },
  ] = await Promise.all([
    supa.from("predictions").select("match_id, local, visitante, scorer")
      .eq("user_id", targetUid).eq("league_id", leagueId),
    supa.from("boost_picks").select("match_id")
      .eq("user_id", targetUid).eq("league_id", leagueId),
  ]);
  if (pErr) return json({ error: "predictions_query_failed", detail: pErr.message }, 500, corsHeaders);
  if (bErr) return json({ error: "boost_query_failed", detail: bErr.message }, 500, corsHeaders);

  const predictions = (preds ?? []).map((p: { match_id: string; local: number; visitante: number; scorer: string | null }) => ({
    match_id: p.match_id, local: p.local, visitante: p.visitante, scorer: p.scorer,
  }));
  const boost_picks = (boosts ?? []).map((b: { match_id: string }) => b.match_id);

  return json({ gated: false, user_id: targetUid, league_id: leagueId, predictions, boost_picks, version: "1.0.0" }, 200, corsHeaders);
});
