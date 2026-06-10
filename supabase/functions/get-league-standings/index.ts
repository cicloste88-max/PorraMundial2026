// supabase/functions/get-league-standings/index.ts
// PR-1 · Leaderboard de liga · v1.2.1
//   v1.2.1 (fix scoring assembly, 10-jun pre-kickoff):
//     - ERR-86: TODAS las queries paginadas con fetchAllRows (.range 1000 +
//       .order por columnas únicas). Un SELECT plano truncaba en db-max-rows
//       1000 de PostgREST: Porra gallos (17×72=1224 filas de predictions)
//       perdía 3 usuarios completos + 1 parcial del scoreboard, según orden
//       físico del heap (no determinista).
//     - Bono anti-IA: el lookup cruzaba match_id legacy contra claves
//       wc2026_g* (miss 100% — el +1 no se pagó nunca). Puente vía wc_matches
//       (ia-bridge.mjs) replicando computeIA+flipSign de get-league-predictions,
//       con flip 1<->2 en el fixture teams_swapped (BRA-ESC J3).
//     - ia_predictions: filtro por snapshot activo + match_id like 'wc2026_%'
//       (excluye ~491 filas ondemand_* de KO que inflaban la query hacia el
//       cap; la PK match_id ya impide duplicados entre snapshots — el filtro
//       es blindaje + higiene).
//   v1.2.0 (P4/D): KO con desempate. Pasa real.winner ('home'|'away') a
//     calcKOMatchPoints para que el avance de ronda puntue tambien cuando el
//     partido acaba en empate y se decide por prorroga/penaltis (el usuario
//     indica el clasificador en la card KO). Retrocompatible: si no hay winner,
//     el motor deriva de l/v como antes. Grupos intactos.
//   v1.1.0 (B2/T1): reader jsonb asObj, boost grupos boost_picks, merge overrides.
// verify_jwt=false (ES256 manual).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  calcMatchPoints,
  calcKOMatchPoints,
  calcAwardPoints,
  iaBonusPredicate,
} from "../_shared/scoring.mjs";
import { fetchAllRows } from "./fetch-all.mjs";
import { buildIaSignByLegacyKey } from "./ia-bridge.mjs";

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
    base["Access-Control-Allow-Origin"] = "*";
  }
  return base;
}

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

function asObj(v: unknown): any {
  if (v == null) return null;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return v;
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

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return new Response(JSON.stringify({ error: "missing_env" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const supa = createClient(SUPABASE_URL, SERVICE_KEY);

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

  // Snapshot IA activo (mismo mecanismo que el frontend, auth.js
  // loadIAPredictions). Sin snapshot activo → sin bono IA (iaRows vacío).
  let activeSnapshotId: number | string | null = null;
  {
    const { data: snap, error: snapErr } = await supa
      .from("ia_snapshots")
      .select("id")
      .eq("is_active", true)
      .maybeSingle();
    if (snapErr) {
      return new Response(JSON.stringify({ error: "query_failed", table: "ia_snapshots", detail: snapErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    activeSnapshotId = snap?.id ?? null;
  }

  // ERR-86: TODAS las listas via fetchAllRows (.range 1000) con .order por
  // columnas únicas (offset sin orden estable puede duplicar/saltar filas).
  // PKs: predictions/ko_predictions/award_picks/boost_picks = id;
  // league_members = (league_id,user_id) — league fijada, user_id basta;
  // ia_predictions = match_id; wc_matches = match_key.
  let members: { user_id: string }[];
  let preds: { user_id: string; match_id: string; local: number; visitante: number; scorer: string | null }[];
  let koPreds: { user_id: string; match_id: number; local: number; visitante: number; scorer: string | null; classifier: string | null }[];
  let awards: { user_id: string; golden_ball: string | null; golden_boot: string | null; golden_glove: string | null; young_player: string | null }[];
  let iaRows: { match_id: string; sign: string; home_code: string | null }[];
  let boosts: { user_id: string; match_id: string }[];
  let wcRows: { match_key: string; group_letter: string; home_es: string; away_es: string; home_iso3: string | null }[];
  let resultRow: { match_results: unknown; ko_results: unknown; award_winners: unknown; overrides: unknown } | null;

  try {
    const [membersR, predsR, koPredsR, awardsR, iaRowsR, boostsR, wcRowsR, resultR] = await Promise.all([
      fetchAllRows((from: number, to: number) => supa
        .from("league_members").select("user_id")
        .eq("league_id", leagueId)
        .order("user_id").range(from, to)),
      fetchAllRows((from: number, to: number) => supa
        .from("predictions").select("user_id, match_id, local, visitante, scorer")
        .eq("league_id", leagueId)
        .order("id").range(from, to)),
      fetchAllRows((from: number, to: number) => supa
        .from("ko_predictions").select("user_id, match_id, local, visitante, scorer, classifier")
        .eq("league_id", leagueId)
        .order("id").range(from, to)),
      fetchAllRows((from: number, to: number) => supa
        .from("award_picks").select("user_id, golden_ball, golden_boot, golden_glove, young_player")
        .eq("league_id", leagueId)
        .order("id").range(from, to)),
      activeSnapshotId != null
        ? fetchAllRows((from: number, to: number) => supa
            .from("ia_predictions").select("match_id, sign, home_code")
            .eq("snapshot_id", activeSnapshotId)
            .like("match_id", "wc2026_%")
            .order("match_id").range(from, to))
        : Promise.resolve({ rows: [] as never[], pages: 0 }),
      fetchAllRows((from: number, to: number) => supa
        .from("boost_picks").select("user_id, match_id")
        .eq("league_id", leagueId)
        .order("id").range(from, to)),
      fetchAllRows((from: number, to: number) => supa
        .from("wc_matches").select("match_key, group_letter, home_es, away_es, home_iso3")
        .order("match_key").range(from, to)),
      supa.from("results").select("match_results, ko_results, award_winners, overrides").limit(1).maybeSingle(),
    ]);
    if (resultR.error) throw new Error(`results: ${resultR.error.message}`);
    members  = membersR.rows as typeof members;
    preds    = predsR.rows as typeof preds;
    koPreds  = koPredsR.rows as typeof koPreds;
    awards   = awardsR.rows as typeof awards;
    iaRows   = iaRowsR.rows as typeof iaRows;
    boosts   = boostsR.rows as typeof boosts;
    wcRows   = wcRowsR.rows as typeof wcRows;
    resultRow = resultR.data as typeof resultRow;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: "query_failed", detail: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const memberUids = (members ?? []).map((m: { user_id: string }) => m.user_id);
  let profiles: { id: string; nombre: string | null }[];
  try {
    const profilesR = await fetchAllRows((from: number, to: number) => supa
      .from("profiles").select("id, nombre")
      .in("id", memberUids.length ? memberUids : ["00000000-0000-0000-0000-000000000000"])
      .order("id").range(from, to));
    profiles = profilesR.rows as typeof profiles;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: "profiles_query_failed", detail: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  let realMatchResults: Record<string, { l: number; v: number; scorers?: string[] }> | null = null;
  let realKoResults: Record<string, { l: number; v: number; scorers?: string[]; winner?: string }> | null = null;
  let realAwardWinners: Record<string, string> | null = null;
  if (resultRow) {
    realMatchResults = asObj(resultRow.match_results);
    realKoResults    = asObj(resultRow.ko_results);
    realAwardWinners = asObj(resultRow.award_winners);
    const overrides  = asObj(resultRow.overrides);
    if (overrides && typeof overrides === "object") {
      realMatchResults = { ...(realMatchResults ?? {}), ...overrides };
    }
  }

  // Puente IA: claves wc2026_* -> legacy "{grupo}_{home_es}_{away_es}" con
  // flip 1<->2 en el fixture teams_swapped (ia-bridge.mjs).
  const iaByMatchId: Record<string, { sign: string }> = buildIaSignByLegacyKey(iaRows, wcRows);

  const boostByUser: Record<string, Set<string>> = {};
  for (const b of boosts ?? []) {
    if (!b.user_id || !b.match_id) continue;
    (boostByUser[b.user_id] ??= new Set<string>()).add(b.match_id);
  }

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

  const rows: LeagueStandingsRow[] = (profiles ?? []).map((profile: { id: string; nombre: string | null }) => {
    const uid = profile.id;
    const userPreds  = predsByUser[uid]  ?? {};
    const userKoPreds = koByUser[uid]    ?? {};
    const userAwards = awardsByUser[uid] ?? null;

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
        boost: boostByUser[uid]?.has(matchId) ?? false,
      });
    }

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
        winner: real.winner ?? null,
      });
    }

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

  const filtered = rows
    .filter(r => r.hasPreds)
    .sort((a, b) => b.total - a.total || b.grpPts - a.grpPts);

  return new Response(
    JSON.stringify({ rows: filtered, league_id: leagueId, version: "1.2.1" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
