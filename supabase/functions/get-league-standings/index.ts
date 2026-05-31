// supabase/functions/get-league-standings/index.ts
// PR-1 · Pantalla Clasificación de liga (leaderboard multi-jugador)
// Versión 1.0.1 — 31-may-2026
//   v1.0.1: BUG-fix mapeo scorer→gol en predsByUser/koByUser. La v1.0.0
//   montaba `scorer: row.scorer` pero el motor _shared/scoring.mjs lee
//   `pred.gol` — el +2 de goleador NUNCA sumaba. Test de ensamblado
//   añadido en tests/scoring.test.mjs.
//
// Sustituye el cómputo cliente de scoreboard.js (que solo veía las
// predicciones del usuario logueado por RLS) por un cómputo server-side
// que reutiliza el motor _shared/scoring.mjs y devuelve SOLO totales
// agregados por usuario. Los picks ajenos NUNCA viajan en el payload.
//
// Reglas implementadas (espejo bit-a-bit del cliente actual scoreboard.js):
//   - Grupos: calcMatchPoints con iaBonus aplicado vía ia_predictions[match_id].
//   - KO: calcKOMatchPoints con avance de ronda. iaBonus NO se aplica
//     (paridad con scoreboard.js que invoca con matchKey=null).
//   - Awards: calcAwardPoints.
//   - Boost x2: NO aplicado en esta v1 (paridad — el cliente actual usa
//     boostPicks del usuario logueado para todos los rows, lo que es un
//     bug latente; cuando se quiera arreglar, leer boost_picks por user_id
//     y pasar { boost: true } a calcMatchPoints).
//
// Sin gate temporal: solo se devuelven totales agregados (seguro pre y
// post cierre de porra). El gate 10-jun (PR-3) afecta a una EF distinta
// (detalle de pronóstico ajeno), fuera del scope aquí.
//
// JWT: verify_jwt=false a nivel deploy (ERR-16). Validación manual abajo.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  calcMatchPoints,
  calcKOMatchPoints,
  calcAwardPoints,
  iaBonusPredicate,
} from "../_shared/scoring.mjs";

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
  if (origin && ALLOWED_ORIGINS.has(origin)) {
    base["Access-Control-Allow-Origin"] = origin;
  } else {
    // Permite invocaciones internas (SQL/MCP) sin Origin header.
    base["Access-Control-Allow-Origin"] = "*";
  }
  return base;
}

// ─── Mapa estático match_id (int KO) → round ────────────────────────
// Fuente de verdad: public/js/ko.js:19 BRACKET. 32 entradas.
// Si se actualiza el bracket en ko.js, replicar aquí.
const KO_ROUND_BY_ID: Record<number, "r32" | "r16" | "qf" | "sf" | "third" | "final"> = {
  73: "r32", 74: "r32", 75: "r32", 76: "r32", 77: "r32", 78: "r32", 79: "r32", 80: "r32",
  81: "r32", 82: "r32", 83: "r32", 84: "r32", 85: "r32", 86: "r32", 87: "r32", 88: "r32",
  89: "r16", 90: "r16", 91: "r16", 92: "r16", 93: "r16", 94: "r16", 95: "r16", 96: "r16",
  97: "qf",  98: "qf",  99: "qf",  100: "qf",
  101: "sf", 102: "sf",
  103: "third",
  104: "final",
};

interface LeagueStandingsRow {
  uid: string;
  nombre: string;
  grpPts: number;
  koPts: number;
  awPts: number;
  total: number;
  hasPreds: boolean;
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const corsHeaders = cors(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "method_not_allowed" }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ─── Service role client (lee TODO sin RLS) ───────────────────────
  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "missing_env" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supa = createClient(SUPABASE_URL, SERVICE_KEY);

  // ─── Auth: extraer user_id del JWT del caller ─────────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return new Response(JSON.stringify({ error: "missing_bearer" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const token = authHeader.slice(7).trim();
  let callerUid: string;
  try {
    const { data, error } = await supa.auth.getUser(token);
    if (error || !data?.user?.id) {
      return new Response(JSON.stringify({ error: "invalid_token" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    callerUid = data.user.id;
  } catch {
    return new Response(JSON.stringify({ error: "invalid_token" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ─── Parse body ───────────────────────────────────────────────────
  let body: { league_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const leagueId = body?.league_id;
  if (!leagueId || typeof leagueId !== "string") {
    return new Response(JSON.stringify({ error: "missing_league_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ─── Membership check: el caller debe estar en la liga ────────────
  {
    const { data: member, error: mErr } = await supa
      .from("league_members")
      .select("user_id")
      .eq("league_id", leagueId)
      .eq("user_id", callerUid)
      .maybeSingle();
    if (mErr) {
      return new Response(JSON.stringify({ error: "membership_check_failed", detail: mErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!member) {
      return new Response(JSON.stringify({ error: "not_a_member" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // ─── Leer todos los datos en paralelo ─────────────────────────────
  const [
    { data: members,   error: meErr },
    { data: preds,     error: pErr },
    { data: koPreds,   error: koErr },
    { data: awards,    error: aErr },
    { data: resultRow, error: rErr },
    { data: iaPreds,   error: iaErr },
  ] = await Promise.all([
    supa.from("league_members").select("user_id").eq("league_id", leagueId),
    supa.from("predictions").select("user_id, match_id, local, visitante, scorer").eq("league_id", leagueId),
    supa.from("ko_predictions").select("user_id, match_id, local, visitante, scorer, classifier").eq("league_id", leagueId),
    supa.from("award_picks").select("user_id, golden_ball, golden_boot, golden_glove, young_player").eq("league_id", leagueId),
    supa.from("results").select("match_results, ko_results, award_winners").limit(1).maybeSingle(),
    supa.from("ia_predictions").select("match_id, sign"),
  ]);

  for (const [err, label] of [
    [meErr, "league_members"],
    [pErr, "predictions"],
    [koErr, "ko_predictions"],
    [aErr, "award_picks"],
    [rErr, "results"],
    [iaErr, "ia_predictions"],
  ] as const) {
    if (err) {
      return new Response(JSON.stringify({ error: "query_failed", table: label, detail: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }

  // ─── Profiles de los miembros (id + nombre) ───────────────────────
  const memberUids = (members ?? []).map((m: { user_id: string }) => m.user_id);
  const { data: profiles, error: profErr } = await supa
    .from("profiles")
    .select("id, nombre")
    .in("id", memberUids.length ? memberUids : ["00000000-0000-0000-0000-000000000000"]);
  if (profErr) {
    return new Response(JSON.stringify({ error: "profiles_query_failed", detail: profErr.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // ─── Parse results JSON (tabla guarda como TEXT) ──────────────────
  let realMatchResults: Record<string, { l: number; v: number; scorers?: string[] }> | null = null;
  let realKoResults: Record<string, { l: number; v: number; scorers?: string[] }> | null = null;
  let realAwardWinners: Record<string, string> | null = null;
  if (resultRow) {
    try { if (resultRow.match_results) realMatchResults = JSON.parse(resultRow.match_results); } catch { /* malformed, treat as null */ }
    try { if (resultRow.ko_results)    realKoResults    = JSON.parse(resultRow.ko_results); }    catch { /* idem */ }
    try { if (resultRow.award_winners) realAwardWinners = JSON.parse(resultRow.award_winners); } catch { /* idem */ }
  }

  // ─── Index ia_predictions por match_id (string) → {sign} ──────────
  const iaByMatchId: Record<string, { sign: string }> = {};
  for (const ia of iaPreds ?? []) {
    if (ia.match_id && ia.sign) iaByMatchId[ia.match_id] = { sign: ia.sign };
  }

  // ─── Index predictions / ko / awards por user_id ──────────────────
  // BUG-fix: el motor _shared/scoring.mjs lee `pred.gol` (espejo del
  // browser). En BD la columna se llama `scorer` — aquí la mapeamos a
  // `gol` para que calcMatchPoints / calcKOMatchPoints sumen el +2 de
  // goleador. Si esto se rompe, los tests del motor puro NO lo cazan
  // (usan `gol` directamente). Ver test "EF assembly: gol acertado +2"
  // en tests/scoring.test.mjs.
  const predsByUser: Record<string, Record<string, { l: number; v: number; gol: string | null; saved: true }>> = {};
  for (const p of preds ?? []) {
    if (!predsByUser[p.user_id]) predsByUser[p.user_id] = {};
    predsByUser[p.user_id][p.match_id] = {
      l: p.local,
      v: p.visitante,
      gol: p.scorer,
      saved: true,
    };
  }

  const koByUser: Record<string, Record<number, { l: number; v: number; gol: string | null; classifier: string | null; saved: true }>> = {};
  for (const k of koPreds ?? []) {
    if (!koByUser[k.user_id]) koByUser[k.user_id] = {};
    koByUser[k.user_id][k.match_id] = {
      l: k.local,
      v: k.visitante,
      gol: k.scorer,
      classifier: k.classifier,
      saved: true,
    };
  }

  const awardsByUser: Record<string, { golden_ball: string | null; golden_boot: string | null; golden_glove: string | null; young_player: string | null }> = {};
  for (const a of awards ?? []) {
    awardsByUser[a.user_id] = {
      golden_ball:  a.golden_ball,
      golden_boot:  a.golden_boot,
      golden_glove: a.golden_glove,
      young_player: a.young_player,
    };
  }

  // ─── Computar pts por usuario ─────────────────────────────────────
  const rows: LeagueStandingsRow[] = (profiles ?? []).map((profile: { id: string; nombre: string | null }) => {
    const uid = profile.id;
    const userPreds  = predsByUser[uid]  ?? {};
    const userKoPreds = koByUser[uid]    ?? {};
    const userAwards = awardsByUser[uid] ?? null;

    // GRUPOS — iterar predicciones del usuario (no PARTIDOS; no necesitamos
    // calendario en backend). iaBonus per-match vía iaByMatchId.
    let grpPts = 0;
    for (const [matchId, pred] of Object.entries(userPreds)) {
      const real = realMatchResults?.[matchId];
      if (!real) continue;
      const pred2 = { ...pred, saved: true as const };
      const iaPred = iaByMatchId[matchId];
      const ia = iaPred ? iaBonusPredicate(iaPred, { l: pred.l, v: pred.v }, real.l, real.v) : false;
      grpPts += calcMatchPoints(pred2, real.l, real.v, {
        scorers: real.scorers ?? null,
        iaBonus: ia,
        boost: false, // v1 — parity con scoreboard.js cliente actual.
      });
    }

    // KO — iterar ko_predictions del usuario. round desde mapa estático.
    // iaBonus NO se aplica en KO (parity con cliente actual).
    let koPts = 0;
    for (const [matchIdStr, pred] of Object.entries(userKoPreds)) {
      const matchId = Number(matchIdStr);
      const round = KO_ROUND_BY_ID[matchId];
      if (!round) continue;
      const real = realKoResults?.[matchId];
      if (!real) continue;
      koPts += calcKOMatchPoints({ ...pred, saved: true as const }, real.l, real.v, round, {
        scorers: real.scorers ?? null,
        iaBonus: false,
        boost: false,
      });
    }

    // AWARDS
    let awPts = 0;
    if (userAwards && realAwardWinners) {
      awPts = calcAwardPoints(userAwards as Record<string, string>, realAwardWinners);
    }

    const total = grpPts + koPts + awPts;
    const hasPreds = Object.keys(userPreds).length > 0 || Object.keys(userKoPreds).length > 0;

    return {
      uid,
      nombre: profile.nombre ?? "—",
      grpPts,
      koPts,
      awPts,
      total,
      hasPreds,
    };
  });

  // Filtrar hasPreds + ordenar total desc, grpPts desc.
  const filtered = rows
    .filter(r => r.hasPreds)
    .sort((a, b) => b.total - a.total || b.grpPts - a.grpPts);

  return new Response(
    JSON.stringify({ rows: filtered, league_id: leagueId, version: "1.0.1" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
