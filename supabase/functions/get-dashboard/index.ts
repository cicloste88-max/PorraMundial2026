// supabase/functions/get-dashboard/index.ts
// Dashboard de la porra · detalle por jugador · v1.0.0
//
// Lee las predicciones de UN usuario en UNA liga y devuelve el desglose
// completo que consume `window.mountPorra` (porra-dashboard.js): totales,
// br por jornada, qh/qm (clasificados acertados/fallados), bracket predicho
// (bs/bp), itemización de grupos `gr` con flags por partido (signo/exacto/
// goleador/IA/boost) y KO `kr` con subtotales marcador+avance.
//
// El motor es exactamente el mismo de get-league-standings (_shared/scoring.mjs,
// calcMatchPointsBreakdown + calcKOMatchPointsBreakdown), que delegan en el
// total publicado — cero divergencia.
//
// DEUDA TÉCNICA POST-LAUNCH: el bloque de ingest se DUPLICA con
// get-league-standings (predictions/ko_predictions/award_picks/boost_picks +
// realKoTeamsBySlot + realRoundAdvancers + iaByLegacyKey + iaByKoSlot). El
// brief recomendaba extraer un helper compartido; se duplica aquí (~250 LOC)
// para minimizar blast radius en get-league-standings durante KO. Cuando
// pase el Mundial, fusionar en _shared/ingest-user.mjs.
//
// verify_jwt=false (ES256 manual, igual que el resto de EFs).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  calcMatchPointsBreakdown,
  calcKOMatchPointsBreakdown,
  calcKoPodiumPoints,
  calcAwardPoints,
  iaBonusPredicate,
  KO_ROUND_PTS,
} from "../_shared/scoring.mjs";
import { resolveBracket } from "../_shared/ko-bracket.mjs";
import { fetchAllRows } from "./fetch-all.mjs";
import { buildIaSignByLegacyKey, buildKoIaSignBySlot } from "./ia-bridge.mjs";

// deno-lint-ignore no-explicit-any
async function fetchAllCompat(pageFn: (from: number, to: number) => any) {
  try {
    const { rows } = await fetchAllRows(pageFn);
    return { data: rows, error: null };
  } catch (e) {
    return { data: null, error: { message: e instanceof Error ? e.message : String(e) } };
  }
}

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

const KO_ROUND_BY_ID: Record<number, "r32" | "r16" | "qf" | "sf" | "third" | "final"> = {
  73: "r32", 74: "r32", 75: "r32", 76: "r32", 77: "r32", 78: "r32", 79: "r32", 80: "r32",
  81: "r32", 82: "r32", 83: "r32", 84: "r32", 85: "r32", 86: "r32", 87: "r32", 88: "r32",
  89: "r16", 90: "r16", 91: "r16", 92: "r16", 93: "r16", 94: "r16", 95: "r16", 96: "r16",
  97: "qf",  98: "qf",  99: "qf",  100: "qf",
  101: "sf", 102: "sf",
  103: "third",
  104: "final",
};

const R32_SLOTS = Array.from({ length: 16 }, (_, i) => 73 + i);

// deno-lint-ignore no-explicit-any
function asObj(v: unknown): any {
  if (v == null) return null;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return v;
}

function fmtScore(l: number | null | undefined, v: number | null | undefined): string {
  if (l == null || v == null) return "";
  return `${l}-${v}`;
}

function sign(l: number | null | undefined, v: number | null | undefined): string {
  if (l == null || v == null) return "";
  if (l > v) return "1";
  if (l < v) return "2";
  return "X";
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
  const privileged = token.length > 0 && token === SERVICE_KEY;
  let callerUid: string | null = null;
  if (!privileged) {
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
  }

  let body: { league_id?: string; user_id?: string };
  try {
    body = await req.json();
  } catch {
    return new Response(JSON.stringify({ error: "invalid_json" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  const leagueId = body?.league_id;
  const userId   = body?.user_id;
  if (!leagueId || typeof leagueId !== "string") {
    return new Response(JSON.stringify({ error: "missing_league_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (!userId || typeof userId !== "string") {
    return new Response(JSON.stringify({ error: "missing_user_id" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  // Membership gate del CALLER. Post-cierre 10-jun: detalle ajeno permitido,
  // pero solo a miembros de la liga.
  if (!privileged) {
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

  // Snapshot IA activo para acotar ia_predictions (ERR-86).
  let activeSnapshotId: number | string | null = null;
  {
    const { data: snap, error: snapErr } = await supa
      .from("ia_snapshots").select("id").eq("is_active", true).maybeSingle();
    if (snapErr) {
      return new Response(JSON.stringify({ error: "query_failed", table: "ia_snapshots", detail: snapErr.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    activeSnapshotId = snap?.id ?? null;
  }

  // Fetch en paralelo. A diferencia de get-league-standings, las tablas de
  // predicciones / ko / awards / boost se filtran por user_id (servimos UN
  // jugador). Las tablas "globales" (results, wc_matches, wc_matches_ko,
  // ia_predictions, league/profile) son las mismas que en standings.
  const [
    { data: profile,   error: profErr },
    { data: preds,     error: pErr },
    { data: koPreds,   error: koErr },
    { data: awardRow,  error: aErr },
    { data: boosts,    error: bErr },
    { data: cacheRow,  error: cErr },
    { data: leagueRow, error: lgErr },
    { data: resultRow, error: rErr },
    { data: iaPreds,   error: iaErr },
    { data: wcRows,    error: wcErr },
    { data: wcKoRows,  error: wcKoErr },
    { data: iaKoRows,  error: iaKoErr },
  ] = await Promise.all([
    supa.from("profiles").select("id, nombre, is_bot").eq("id", userId).maybeSingle(),
    fetchAllCompat((from, to) => supa.from("predictions")
      .select("match_id, local, visitante, scorer")
      .eq("league_id", leagueId).eq("user_id", userId)
      .order("match_id").range(from, to)),
    fetchAllCompat((from, to) => supa.from("ko_predictions")
      .select("match_id, local, visitante, scorer, classifier")
      .eq("league_id", leagueId).eq("user_id", userId)
      .order("match_id").range(from, to)),
    supa.from("award_picks")
      .select("golden_ball, golden_boot, golden_glove, young_player")
      .eq("league_id", leagueId).eq("user_id", userId).maybeSingle(),
    supa.from("boost_picks").select("match_id").eq("league_id", leagueId).eq("user_id", userId),
    supa.from("user_points_cache").select("total_pts, breakdown")
      .eq("league_id", leagueId).eq("user_id", userId).maybeSingle(),
    supa.from("leagues").select("id, nombre").eq("id", leagueId).maybeSingle(),
    supa.from("results").select("match_results, ko_results, award_winners, overrides").limit(1).maybeSingle(),
    activeSnapshotId != null
      ? fetchAllCompat((from, to) => supa.from("ia_predictions").select("match_id, sign, home_code").eq("snapshot_id", activeSnapshotId).order("match_id").range(from, to))
      : Promise.resolve({ data: [], error: null }),
    supa.from("wc_matches").select("match_key, group_letter, home_es, away_es, home_iso3, away_iso3, teams_swapped, round"),
    supa.from("wc_matches_ko").select("ko_match_id, round, home_iso3, away_iso3"),
    supa.from("ia_predictions").select("home_code, away_code, sign").eq("is_ko_ondemand", true),
  ]);

  for (const [err, label] of [
    [profErr, "profiles"],
    [pErr, "predictions"],
    [koErr, "ko_predictions"],
    [aErr, "award_picks"],
    [bErr, "boost_picks"],
    [cErr, "user_points_cache"],
    [lgErr, "leagues"],
    [rErr, "results"],
    [iaErr, "ia_predictions"],
    [wcErr, "wc_matches"],
  ] as const) {
    if (err) {
      return new Response(JSON.stringify({ error: "query_failed", table: label, detail: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }
  // wc_matches_ko + ia_predictions on-demand soft-fail (degradan KO a 0).
  if (wcKoErr) console.error("[dashboard] wc_matches_ko query failed:", wcKoErr.message);
  if (iaKoErr) console.error("[dashboard] ia_predictions(is_ko_ondemand) query failed:", iaKoErr.message);

  // Diccionarios derivados de wc_matches (idéntico a standings + round map).
  const esNameToIso3: Record<string, string> = {};
  const roundByLegacyKey: Record<string, number> = {};
  for (const w of (wcRows ?? []) as Array<{ group_letter: string; home_es: string; away_es: string; home_iso3: string; away_iso3: string; round: number }>) {
    if (w.home_es && w.home_iso3) esNameToIso3[w.home_es] = w.home_iso3;
    if (w.away_es && w.away_iso3) esNameToIso3[w.away_es] = w.away_iso3;
    if (w.group_letter && w.home_es && w.away_es) {
      const legacyKey = `${w.group_letter}_${w.home_es}_${w.away_es}`;
      roundByLegacyKey[legacyKey] = Number(w.round) || 0;
    }
  }
  const toIso3 = (esName: string | null | undefined): string | null =>
    (esName != null && esNameToIso3[esName]) ? esNameToIso3[esName] : null;

  // Real results.
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

  // Puente IA grupos: ia_predictions (wc2026_*) → legacy keys.
  const iaByMatchId: Record<string, { sign: string }> = buildIaSignByLegacyKey(iaPreds ?? [], wcRows ?? []);

  // Slot KO → equipos reales (iso3).
  const realKoTeamsBySlot: Record<number, { home: string | null; away: string | null }> = {};
  for (const k of (wcKoRows ?? []) as Array<{ ko_match_id?: number; home_iso3?: string; away_iso3?: string }>) {
    if (k.ko_match_id == null) continue;
    realKoTeamsBySlot[Number(k.ko_match_id)] = { home: k.home_iso3 ?? null, away: k.away_iso3 ?? null };
  }

  // Clasificados reales a R32 (slots 73-88).
  const realQualifiers = new Set<string>();
  for (const s of R32_SLOTS) {
    const t = realKoTeamsBySlot[s];
    if (t?.home) realQualifiers.add(t.home);
    if (t?.away) realQualifiers.add(t.away);
  }

  function realSlotMesh(slot: number): { home: string | null; away: string | null; advancer: string | null; loser: string | null } | null {
    const teams = realKoTeamsBySlot[slot];
    if (!teams) return null;
    const home = teams.home ?? null;
    const away = teams.away ?? null;
    const res = realKoResults?.[String(slot)];
    let advancer: string | null = null;
    let loser: string | null = null;
    if (res && (res.winner === "home" || res.winner === "away")) {
      advancer = res.winner === "home" ? home : away;
      loser    = res.winner === "home" ? away : home;
    }
    return { home, away, advancer, loser };
  }
  const realFinalMesh = realSlotMesh(104);
  const realThirdMesh = realSlotMesh(103);
  const realPodium = (realFinalMesh || realThirdMesh)
    ? {
        champion: realFinalMesh?.advancer ?? null,
        runnerUp: realFinalMesh?.loser ?? null,
        third:    realThirdMesh?.advancer ?? null,
        fourth:   realThirdMesh?.loser ?? null,
      }
    : null;

  // IA KO on-demand → { slot: { sign } }.
  const iaByKoSlot: Record<number, { sign: string }> = buildKoIaSignBySlot(iaKoRows ?? [], realKoTeamsBySlot);

  // Set-based round advancers (real).
  const realRoundAdvancers: Record<string, Set<string>> = {
    r32: new Set<string>(), r16: new Set<string>(), qf: new Set<string>(),
    sf: new Set<string>(), final: new Set<string>(),
  };
  for (const [slotStr, rnd] of Object.entries(KO_ROUND_BY_ID)) {
    if (rnd === "third") continue;
    const mesh = realSlotMesh(Number(slotStr));
    if (mesh?.advancer) realRoundAdvancers[rnd].add(mesh.advancer);
  }

  // Boost set para este usuario.
  const boostSet = new Set<string>();
  for (const b of (boosts ?? []) as Array<{ match_id?: string }>) {
    if (b?.match_id) boostSet.add(b.match_id);
  }

  // Mapa pred grupos del usuario, indexado por match_id.
  type GrpPred = { l: number; v: number; gol: string | null; saved: true };
  const userPreds: Record<string, GrpPred> = {};
  const predRowsArr: Array<{ match_id: string; local: number; visitante: number }> = [];
  for (const p of (preds ?? []) as Array<{ match_id: string; local: number; visitante: number; scorer: string | null }>) {
    userPreds[p.match_id] = { l: p.local, v: p.visitante, gol: p.scorer, saved: true };
    predRowsArr.push({ match_id: p.match_id, local: p.local, visitante: p.visitante });
  }

  // Mapa pred KO del usuario.
  type KoPred = { l: number; v: number; gol: string | null; classifier: string | null; saved: true };
  const userKoPreds: Record<number, KoPred> = {};
  const koRowsArr: Array<{ match_id: number; local: number; visitante: number; classifier: string | null }> = [];
  for (const k of (koPreds ?? []) as Array<{ match_id: number; local: number; visitante: number; scorer: string | null; classifier: string | null }>) {
    userKoPreds[Number(k.match_id)] = { l: k.local, v: k.visitante, gol: k.scorer, classifier: k.classifier, saved: true };
    koRowsArr.push({ match_id: Number(k.match_id), local: k.local, visitante: k.visitante, classifier: k.classifier });
  }

  // Awards del usuario.
  const userAwards = awardRow
    ? {
        golden_ball:  awardRow.golden_ball  ?? null,
        golden_boot:  awardRow.golden_boot  ?? null,
        golden_glove: awardRow.golden_glove ?? null,
        young_player: awardRow.young_player ?? null,
      }
    : null;

  // ── Scoring (mismo motor que standings) ────────────────────────────
  let grpPts = 0;
  const grRows: Array<Record<string, unknown>> = [];
  for (const [matchId, pred] of Object.entries(userPreds)) {
    const real = realMatchResults?.[matchId];
    const round = roundByLegacyKey[matchId] || 0;
    const ia = iaByMatchId[matchId];
    if (!real) continue; // solo emitimos rows con partido jugado
    const iaApplied = ia ? iaBonusPredicate(ia, { l: pred.l, v: pred.v }, real.l, real.v) : false;
    const boost = boostSet.has(matchId);
    const bd = calcMatchPointsBreakdown(pred, real.l, real.v, {
      scorers: real.scorers ?? null,
      iaBonus: iaApplied,
      boost,
    });
    grpPts += bd.pts;

    grRows.push({
      r: round || null,
      m: matchId,
      ps: fmtScore(pred.l, pred.v),
      rs: fmtScore(real.l, real.v),
      pSg: sign(pred.l, pred.v),
      rSg: sign(real.l, real.v),
      ex: bd.exact ? 1 : 0,
      go: bd.golOk ? 1 : 0,
      si: bd.signOk ? 1 : 0,
      pg: pred.gol ?? "",
      rg: Array.isArray(real.scorers) ? real.scorers.join(", ") : "",
      b: boost ? 1 : 0,
      ia: ia?.sign ?? "",
      ib: bd.iaBonus ? 1 : 0,
      p: bd.pts,
    });
  }

  // Bracket predicho del usuario (cascada compartida; nombres ES).
  const userBracket = resolveBracket(predRowsArr, koRowsArr);
  const predSlots: Record<number, { home?: string | null; away?: string | null; winner?: string | null; loser?: string | null }> = userBracket.slots ?? {};

  // §1.7 — Clasificados de grupos (R32, slots 73-88).
  let koPts = 0;
  let qpPts = 0;
  const predQualifiers = new Set<string>();
  for (const s of R32_SLOTS) {
    const ps = predSlots[s];
    const h = toIso3(ps?.home); if (h) predQualifiers.add(h);
    const a = toIso3(ps?.away); if (a) predQualifiers.add(a);
  }
  const qh: string[] = [];
  const qm: string[] = [];
  for (const q of predQualifiers) {
    if (realQualifiers.has(q)) {
      qh.push(q);
      qpPts += KO_ROUND_PTS.groups;
    } else if (realQualifiers.size > 0) {
      // qm solo tiene sentido si hay clasificados reales (post-grupos)
      qm.push(q);
    }
  }
  koPts += qpPts;

  // Itemización KO (kr) + subtotal `rp` (puntos KO de slots R32 = 73-88).
  let rpPts = 0;
  const krRows: Array<Record<string, unknown>> = [];
  for (const [matchIdStr, pred] of Object.entries(userKoPreds)) {
    const matchId = Number(matchIdStr);
    const round = KO_ROUND_BY_ID[matchId];
    if (!round) continue;
    const real = realKoResults?.[String(matchId)] ?? null;
    const realMesh = realSlotMesh(matchId);
    const ps = predSlots[matchId] ?? {};

    const predHome = toIso3(ps.home);
    const predAway = toIso3(ps.away);
    const predAdvancer = toIso3(ps.winner);

    const bd = calcKOMatchPointsBreakdown(pred, real?.l ?? null, real?.v ?? null, round, {
      scorers: real?.scorers ?? null,
      boost: false,
      predHome, predAway, predAdvancer,
      realHome:     realMesh?.home ?? null,
      realAway:     realMesh?.away ?? null,
      realAdvancer: realMesh?.advancer ?? null,
      realRoundAdvancers: realRoundAdvancers[round] ?? null,
      iaPred:       iaByKoSlot[matchId] ?? null,
    });
    koPts += bd.pts;
    if (round === "r32") rpPts += bd.pts;

    // Emisión del row kr: además de tener resultado real o malla, emitimos
    // si el slot pagó avance set-based (predAdvancer ∈ realRoundAdvancers
    // por OTRO slot de la ronda). De lo contrario el dashboard mostraría
    // koPts > sum(kr[].p) sin que el usuario vea de dónde sale el avance.
    if (real == null && !realMesh && bd.advancePts === 0) continue;

    // Orientación: si swap, el marcador "oriented" (ops) coincide con la malla
    // real; ps queda como el marcador tal y como lo introdujo el usuario.
    const orientedL = bd.swap ? pred.v : pred.l;
    const orientedR = bd.swap ? pred.l : pred.v;

    const realHomeName = realMesh?.home ?? null;
    const realAwayName = realMesh?.away ?? null;

    krRows.push({
      m: matchId,
      rd: round,
      pc: `${ps.home ?? ""} vs ${ps.away ?? ""}`,
      rc: `${realHomeName ?? ""} vs ${realAwayName ?? ""}`,
      ps: fmtScore(pred.l, pred.v),
      ops: fmtScore(orientedL, orientedR),
      rs: real ? fmtScore(real.l, real.v) : "",
      cl: ps.winner ?? "",
      ra: realMesh?.advancer ?? "",
      pSg: sign(orientedL, orientedR),
      rSg: real ? sign(real.l, real.v) : "",
      pg: pred.gol ?? "",
      rg: real && Array.isArray(real.scorers) ? real.scorers.join(", ") : "",
      se: bd.matchupOk ? 1 : 0,
      ao: bd.advancePts > 0 ? 1 : 0,
      ko_si: bd.signOk ? 1 : 0,
      ko_ex: bd.exact ? 1 : 0,
      ko_go: bd.golOk ? 1 : 0,
      pm: bd.matchPts,
      pa: bd.advancePts,
      rpts: KO_ROUND_PTS[round] || 0,
      p: bd.pts,
    });
  }

  // Podio.
  if (realPodium) {
    const predPodium = {
      champion: toIso3(userBracket.podium?.champion),
      runnerUp: toIso3(userBracket.podium?.runnerUp),
      third:    toIso3(userBracket.podium?.third),
      fourth:   toIso3(userBracket.podium?.fourth),
    };
    koPts += calcKoPodiumPoints(predPodium, realPodium);
  }

  // Premios.
  let awPts = 0;
  if (userAwards && realAwardWinners) {
    awPts = calcAwardPoints(userAwards as Record<string, string>, realAwardWinners);
  }

  // br por jornada (1/2/3).
  const br: Record<string, number> = { "1": 0, "2": 0, "3": 0 };
  for (const r of grRows) {
    const rd = String(r.r ?? "");
    if (rd === "1" || rd === "2" || rd === "3") br[rd] = (br[rd] as number) + (r.p as number);
  }

  // bs (slots 101/102/103/104 del bracket predicho).
  const bs: Record<string, { home: string | null; away: string | null; winner: string | null; loser: string | null }> = {};
  for (const slot of [101, 102, 103, 104]) {
    const s = predSlots[slot] ?? {};
    bs[String(slot)] = {
      home:   s.home   ?? null,
      away:   s.away   ?? null,
      winner: s.winner ?? null,
      loser:  s.loser  ?? null,
    };
  }

  // bp (podium predicho en es names).
  const bp = {
    champion: userBracket.podium?.champion ?? null,
    runnerUp: userBracket.podium?.runnerUp ?? null,
    third:    userBracket.podium?.third    ?? null,
    fourth:   userBracket.podium?.fourth   ?? null,
  };

  const total = grpPts + koPts + awPts;
  const cached = Number((cacheRow?.total_pts) ?? 0);

  // Object `u` — shape exacto que consume mountPorra.
  const u = {
    u:  profile?.nombre ?? "—",
    ui: userId,
    l:  leagueId,
    ln: leagueRow?.nombre ?? "",
    cached,
    t:  total,
    g:  grpPts,
    k:  koPts,
    a:  awPts,
    br,
    qp: qpPts,
    rp: rpPts,
    qh,
    qm,
    bo: boostSet.size,
    aw: userAwards,
    gr: grRows,
    kr: krRows,
    bp,
    bs,
    is_bot: !!profile?.is_bot,
  };

  return new Response(
    JSON.stringify({ u, version: "1.0.0" }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
