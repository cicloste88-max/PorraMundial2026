// supabase/functions/get-league-standings/index.ts
// PR-1 · Leaderboard de liga · v1.7.0
//   v1.7.0 (Dashboard PR #179): añade `leagueName` (string|null) top-level al
//     response leyendo leagues.nombre por league_id (soft-fail). Cero impacto
//     en scoring/ingest; permite al cliente (porra-dashboard.js) renderizar
//     el nombre real de la liga sin mantener un catálogo estático LEAGUE_NAME.
//   v1.6.0 (KO avance set-based): el +pts de avance KO se otorga si el equipo
//     que el usuario marcó avanzar está entre los que REALMENTE avanzaron en la
//     ronda (independiente del slot/cruce). Antes era predAdvancer===realAdvancer
//     del MISMO slot → ignoraba "equipo correcto, slot equivocado" (típico: Brasil
//     cae en otro cruce pero pasa). Se construye realRoundAdvancers (Set<iso3>
//     por ronda, solo slots resueltos; 103 'third' excluido vía KO_ROUND_PTS) y
//     se pasa a calcKOMatchPoints. El gate `if (!real) continue` se retira para
//     que el avance pueda pagar aunque MI slot no esté resuelto todavía (el
//     motor degrada limpio: sin scores → 0 marcador, set pasa el avance).
//   v1.5.1 (follow-up KO): anti-IA KO cableado. iaByKoSlot se puebla desde las
//     predicciones IA on-demand (ia_predictions.is_ko_ondemand=true) que el
//     usuario VIO al montar su bracket — se LEEN, no se recomputan. Una entrada
//     por slot orientada al marco real (buildKoIaSignBySlot, flip 1↔2 si la fila
//     está invertida; X invariante). Reparte el +1 anti-IA en KO (máx partido 7).
//     Soft-fail. (Antes era un dict vacío con un TODO incorrecto: el bot SÍ tenía
//     IA de cruces KO on-demand.)
//   v1.5.0 (KO scoring engine, Paso 6): motor KO reescrito al modelo normativo
//     §1.3. Antes el KO puntuaba marcador SIN gate de equipos y avance por LADO
//     ('home'/'away'), inflando puntos en cruces con equipos distintos (un slot
//     "Corea 2-1 avanza Corea" cobraba +8 contra "Alemania 2-1 avanza Alemania").
//     Ahora: (a) marcador estilo grupo SOLO si el cruce coincide (igualdad de
//     conjunto de iso3, con orientación ERR-95/96); (b) avance por EQUIPO
//     (predAdvancer===realAdvancer) con KO_ROUND_PTS[round] (final +25 en slot
//     104, no en semis); (c) podio 30/20/15/10. Reconstruye la malla predicha de
//     cada usuario con resolveBracket (_shared/ko-bracket.mjs) y la real con
//     wc_matches_ko + ko_results. IA KO cableada en v1.5.1 (ver arriba).
//     boost KO off (§1.6). Degradación limpia si wc_matches_ko no tiene el slot.
//   v1.4.0 (B11, Item 7 post-J1): (a) bearer service_role PRIVILEGIADO —
//     porra-bridge-results invoca esta EF tras cada partido bridgeado sin JWT
//     de usuario (salta getUser + membership check; mismo compare directo que
//     el gate del bridge); (b) write-through a user_points_cache: tras montar
//     rows (TODOS los miembros, también hasPreds=false con 0 pts) upserta
//     (user_id, league_id, total_pts, breakdown {grp,ko,aw}) — la leen el tile
//     del Predictor y las vistas v_user_global_rank v2 / v_league_rank. Un
//     fallo del upsert NO tumba la respuesta (console.error y sigue).
//   v1.3.0 (Fase 2 pre-kickoff): puente del bono anti-IA. ia_predictions usa
//     claves wc2026_g{X}_{sofascore_id} y predictions usa el formato legacy
//     {grupo}_{home_es}_{away_es}: el lookup directo daba overlap 0 y el +1
//     anti-IA no se pagó nunca en el scoreboard (el frontend sí lo pinta).
//     iaByMatchId se construye ahora vía ia-bridge.mjs (wc_matches como
//     diccionario + flipSign 1<->2 en el fixture teams_swapped BRA-ESC J3,
//     misma condición home_code !== home_iso3 que get-league-predictions).
//   v1.2.1 (ERR-86, Fase 1 pre-kickoff): paginación .range(1000)+.order en las
//     lecturas sin cota (predictions, ko_predictions, ia_predictions del
//     snapshot activo). PostgREST corta en db-max-rows (1000): Porra gallos
//     (17×72=1224 filas de predictions) perdía 3 usuarios completos + 1
//     parcial del scoreboard según orden físico del heap. Ensamblaje v1.1.0
//     (ERR-79) INTACTO: asObj, boost_picks, merge overrides, KO/awards.
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
  calcKoPodiumPoints,
  calcAwardPoints,
  iaBonusPredicate,
  KO_ROUND_PTS,
} from "../_shared/scoring.mjs";
import { resolveBracket } from "../_shared/ko-bracket.mjs";
import { fetchAllRows } from "./fetch-all.mjs";
import { buildIaSignByLegacyKey, buildKoIaSignBySlot } from "./ia-bridge.mjs";

// ERR-86: shape { data, error } compatible con el manejo de errores existente
// (loop [err, label]); pageFn debe aplicar .order() estable + .range(from, to).
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
  // v1.4.0: bearer service_role privilegiado (caller interno: porra-bridge-
  // results refrescando user_points_cache). Mismo compare directo que usa el
  // gate del propio bridge. Sin membership check: opera sobre cualquier liga.
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

  // ERR-86: snapshot IA activo para acotar ia_predictions (sin snapshot
  // activo → sin filas, mismo efecto neto que hoy). Mecanismo espejo del
  // frontend (auth.js loadIAPredictions).
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

  const [
    { data: members,   error: meErr },
    { data: preds,     error: pErr },
    { data: koPreds,   error: koErr },
    { data: awards,    error: aErr },
    { data: resultRow, error: rErr },
    { data: iaPreds,   error: iaErr },
    { data: boosts,    error: bErr },
    { data: wcRows,    error: wcErr },
    { data: wcKoRows,  error: wcKoErr },
    { data: iaKoRows,  error: iaKoErr },
    { data: leagueRow, error: lgErr },
  ] = await Promise.all([
    supa.from("league_members").select("user_id").eq("league_id", leagueId),
    fetchAllCompat((from, to) => supa.from("predictions").select("user_id, match_id, local, visitante, scorer").eq("league_id", leagueId).order("id").range(from, to)),
    fetchAllCompat((from, to) => supa.from("ko_predictions").select("user_id, match_id, local, visitante, scorer, classifier").eq("league_id", leagueId).order("id").range(from, to)),
    supa.from("award_picks").select("user_id, golden_ball, golden_boot, golden_glove, young_player").eq("league_id", leagueId),
    supa.from("results").select("match_results, ko_results, award_winners, overrides").limit(1).maybeSingle(),
    activeSnapshotId != null
      ? fetchAllCompat((from, to) => supa.from("ia_predictions").select("match_id, sign, home_code").eq("snapshot_id", activeSnapshotId).order("match_id").range(from, to))
      : Promise.resolve({ data: [], error: null }),
    supa.from("boost_picks").select("user_id, match_id").eq("league_id", leagueId),
    // Fase 2: diccionario wc_matches para el puente IA (72-104 filas, <1000,
    // sin fetchAll). teams_swapped acompaña como dato; el flip del bridge usa
    // la condición canónica home_code !== home_iso3 (get-league-predictions).
    supa.from("wc_matches").select("match_key, group_letter, home_es, away_es, home_iso3, away_iso3, teams_swapped"),
    // KO (Paso 6): diccionario slot→equipos reales (vacío hasta ~28-jun → KO
    // degrada limpio a 0). ko_results ya viene orientado a (home_iso3, away_iso3)
    // y winner relativo a ellos (el puente aplica teams_swapped al escribir),
    // así que el scoring consume la orientación canónica sin re-flip.
    supa.from("wc_matches_ko").select("ko_match_id, round, home_iso3, away_iso3"),
    // Anti-IA KO: predicciones IA de cruces KO calculadas ON-DEMAND cuando los
    // usuarios montaron su bracket (la IA que VIERON). ~520 filas (<1000, sin
    // fetchAll), una por par; sign independiente de orientación (se LEEN, no se
    // recomputan). Sin filtro de snapshot: el on-demand no cuelga del snapshot.
    supa.from("ia_predictions").select("home_code, away_code, sign").eq("is_ko_ondemand", true),
    // v1.7.0: leagueName en el response para que el cliente no tenga que
    // mantener un catálogo estático LEAGUE_NAME (Dashboard pill). SOFT-FAIL:
    // si la query falla, el cliente cae a un nombre vacío y muestra el icono.
    supa.from("leagues").select("nombre").eq("id", leagueId).maybeSingle(),
  ]);

  for (const [err, label] of [
    [meErr, "league_members"],
    [pErr, "predictions"],
    [koErr, "ko_predictions"],
    [aErr, "award_picks"],
    [rErr, "results"],
    [iaErr, "ia_predictions"],
    [bErr, "boost_picks"],
    [wcErr, "wc_matches"],
  ] as const) {
    if (err) {
      return new Response(JSON.stringify({ error: "query_failed", table: label, detail: err.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
  }
  // wc_matches_ko es SOFT-FAIL: un error (o tabla vacía pre-28-jun) NO debe
  // tumbar el scoring de grupos/premios. La rama KO degrada limpio a 0.
  if (wcKoErr) console.error("[standings] wc_matches_ko query failed (KO degrada a 0):", wcKoErr.message);
  // Anti-IA KO también soft-fail: si la query de ia_predictions on-demand falla,
  // el bonus +1 anti-IA KO degrada a 0 sin tumbar el scoreboard.
  if (iaKoErr) console.error("[standings] ia_predictions(is_ko_ondemand) query failed (anti-IA KO degrada a 0):", iaKoErr.message);
  // leagueName soft-fail: si la query falla (RLS, liga eliminada en concurrente),
  // el cliente recibe leagueName=null y muestra solo el icono.
  if (lgErr) console.error("[standings] leagues query failed (leagueName degrada a null):", lgErr.message);

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

  // Fase 2: puente ia_predictions (wc2026_*) -> claves legacy de predictions
  // "{grupo}_{home_es}_{away_es}", con flip 1<->2 en el fixture swapped
  // (ia-bridge.mjs). El lookup iaByMatchId[matchId] del bucle de scoring
  // encuentra ahora el sign en orientación porra.
  const iaByMatchId: Record<string, { sign: string }> = buildIaSignByLegacyKey(iaPreds ?? [], wcRows ?? []);

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

  // ── Malla KO (Paso 6) ──────────────────────────────────────────────────
  // El motor KO (§1.3) puntúa por equipos (gate de cruce + avance por equipo),
  // no por lado. La malla PREDICHA de cada usuario se reconstruye con la cascada
  // compartida resolveBracket (_shared/ko-bracket.mjs, en nombres ES); la REAL
  // sale de wc_matches_ko (equipos por slot en iso3) + ko_results (winner). El
  // puente de nombres ES→iso3 se deriva de wc_matches (home_es/away_es ≡ GRUPOS).
  const esNameToIso3: Record<string, string> = {};
  for (const w of (wcRows ?? []) as Array<{ home_es?: string; away_es?: string; home_iso3?: string; away_iso3?: string }>) {
    if (w.home_es && w.home_iso3) esNameToIso3[w.home_es] = w.home_iso3;
    if (w.away_es && w.away_iso3) esNameToIso3[w.away_es] = w.away_iso3;
  }
  const toIso3 = (esName: string | null | undefined): string | null =>
    (esName != null && esNameToIso3[esName]) ? esNameToIso3[esName] : null;

  // Slot → equipos reales (iso3). Vacío hasta ~28-jun → KO degrada a 0.
  const realKoTeamsBySlot: Record<number, { home: string | null; away: string | null }> = {};
  for (const k of (wcKoRows ?? []) as Array<{ ko_match_id?: number; home_iso3?: string; away_iso3?: string }>) {
    if (k.ko_match_id == null) continue;
    realKoTeamsBySlot[Number(k.ko_match_id)] = { home: k.home_iso3 ?? null, away: k.away_iso3 ?? null };
  }
  // §1.7 — clasificados de grupos (+5 por equipo que el usuario predice que pasa
  // a R32 y realmente pasa). Reales = los 32 participantes de R32 (slots 73-88
  // de wc_matches_ko). NO se computaba antes (decisión: incluirlo aquí). Vacío
  // hasta sembrar wc_matches_ko → 0 limpio. Es transición INDEPENDIENTE del
  // avance r32 (73→R16): aquí se premia pasar de grupos, no ganar el R32.
  const R32_SLOTS = Array.from({ length: 16 }, (_, i) => 73 + i);
  const realQualifiers = new Set<string>();
  for (const s of R32_SLOTS) {
    const t = realKoTeamsBySlot[s];
    if (t?.home) realQualifiers.add(t.home);
    if (t?.away) realQualifiers.add(t.away);
  }

  // Malla real de un slot: equipos + avanzador/perdedor (winner relativo a
  // home_iso3/away_iso3; el puente ya aplicó teams_swapped al escribir).
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

  // Anti-IA KO: { slot → { sign } } desde las predicciones IA on-demand que el
  // usuario VIO al montar su bracket (ia_predictions.is_ko_ondemand). Se LEEN,
  // no se recomputan. Orientadas al marco real (realHome=home) recorriendo
  // realKoTeamsBySlot; sin fila para el par → no se setea → anti-IA 0 limpio.
  // (Hasta sembrar wc_matches_ko, realKoTeamsBySlot está vacío → iaByKoSlot {}.)
  const iaByKoSlot: Record<number, { sign: string }> = buildKoIaSignBySlot(iaKoRows ?? [], realKoTeamsBySlot);

  // Avance SET-BASED por equipo (San 30-jun-2026): para cada ronda con avance
  // (r32 r16 qf sf final; slot 103 'third' excluido vía KO_ROUND_PTS), conjunto
  // de iso3 que REALMENTE avanzaron en CUALQUIER slot de la ronda (solo slots
  // resueltos). Permite puntuar el +pts cuando el usuario acierta el EQUIPO
  // aunque el slot/cruce no coincida (p.ej. Brasil cae en otro cruce pero pasa).
  const realRoundAdvancers: Record<string, Set<string>> = {
    r32: new Set<string>(), r16: new Set<string>(), qf: new Set<string>(),
    sf: new Set<string>(), final: new Set<string>(),
  };
  for (const [slotStr, rnd] of Object.entries(KO_ROUND_BY_ID)) {
    if (rnd === "third") continue;
    const mesh = realSlotMesh(Number(slotStr));
    if (mesh?.advancer) realRoundAdvancers[rnd].add(mesh.advancer);
  }

  // Rows crudas por usuario para resolveBracket (cascada de la malla predicha).
  const predRowsByUser: Record<string, Array<{ match_id: string; local: number; visitante: number }>> = {};
  for (const p of preds ?? []) {
    (predRowsByUser[p.user_id] ??= []).push({ match_id: p.match_id, local: p.local, visitante: p.visitante });
  }
  const koRowsByUser: Record<string, Array<{ match_id: number; local: number; visitante: number; classifier: string | null }>> = {};
  for (const k of koPreds ?? []) {
    (koRowsByUser[k.user_id] ??= []).push({ match_id: k.match_id, local: k.local, visitante: k.visitante, classifier: k.classifier });
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

    // Malla PREDICHA del usuario (cascada compartida; nombres ES → iso3).
    const userBracket = resolveBracket(predRowsByUser[uid] ?? [], koRowsByUser[uid] ?? []);
    const predSlots: Record<number, { home?: string | null; away?: string | null; winner?: string | null }> = userBracket.slots ?? {};

    let koPts = 0;

    // §1.7 — clasificados de grupos: +5 por equipo de R32 predicho que también
    // es clasificado real. Predichos = los 32 de la malla del usuario en slots
    // 73-88 (su simulación de tablas + terceros). Intersección × 5.
    if (realQualifiers.size > 0) {
      const predQualifiers = new Set<string>();
      for (const s of R32_SLOTS) {
        const ps = predSlots[s];
        const h = toIso3(ps?.home); if (h) predQualifiers.add(h);
        const a = toIso3(ps?.away); if (a) predQualifiers.add(a);
      }
      for (const q of predQualifiers) {
        if (realQualifiers.has(q)) koPts += KO_ROUND_PTS.groups;
      }
    }
    for (const [matchIdStr, pred] of Object.entries(userKoPreds)) {
      const matchId = Number(matchIdStr);
      const round = KO_ROUND_BY_ID[matchId];
      if (!round) continue;
      // Set-based: no se cortocircuita por falta de `real` o `realMesh` — el
      // avance puede pagar aunque MI slot no tenga resultado todavía, si mi
      // equipo avanzó en otro slot de la ronda (calcKOMatchPoints lee la set).
      const real = realKoResults?.[String(matchId)] ?? null;
      const realMesh = realSlotMesh(matchId);
      const ps = predSlots[matchId] ?? {};
      koPts += calcKOMatchPoints({ ...pred, saved: true as const }, real?.l ?? null, real?.v ?? null, round, {
        scorers: real?.scorers ?? null,
        boost: false,
        predHome:     toIso3(ps.home),
        predAway:     toIso3(ps.away),
        predAdvancer: toIso3(ps.winner),
        realHome:     realMesh?.home ?? null,
        realAway:     realMesh?.away ?? null,
        realAdvancer: realMesh?.advancer ?? null,
        realRoundAdvancers: realRoundAdvancers[round] ?? null,
        iaPred:       iaByKoSlot[matchId] ?? null,
      });
    }

    // Podio (§1.5) — una vez por usuario, plegado en koPts (dominio KO).
    if (realPodium) {
      const predPodium = {
        champion: toIso3(userBracket.podium?.champion),
        runnerUp: toIso3(userBracket.podium?.runnerUp),
        third:    toIso3(userBracket.podium?.third),
        fourth:   toIso3(userBracket.podium?.fourth),
      };
      koPts += calcKoPodiumPoints(predPodium, realPodium);
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

  // B11 (Item 7): write-through a user_points_cache con TODOS los miembros
  // (también hasPreds=false, a 0 pts — completan el denominador de las vistas
  // de rank). El bridge invoca esta EF tras cada partido bridgeado, así la
  // cache se actualiza al finalizar partido sin que nadie abra la app.
  try {
    const nowIso = new Date().toISOString();
    const cacheRows = rows.map((r) => ({
      user_id: r.uid,
      league_id: leagueId,
      total_pts: r.total,
      breakdown: { grp: r.grpPts, ko: r.koPts, aw: r.awPts },
      updated_at: nowIso,
    }));
    if (cacheRows.length) {
      const { error: cacheErr } = await supa
        .from("user_points_cache")
        .upsert(cacheRows, { onConflict: "user_id,league_id" });
      if (cacheErr) console.error("[standings] user_points_cache upsert failed:", cacheErr.message);
    }
  } catch (e) {
    console.error("[standings] user_points_cache write-through error:", e);
  }

  const filtered = rows
    .filter(r => r.hasPreds)
    .sort((a, b) => b.total - a.total || b.grpPts - a.grpPts);

  return new Response(
    JSON.stringify({
      rows: filtered,
      league_id: leagueId,
      leagueName: leagueRow?.nombre ?? null,
      version: "1.7.0",
    }),
    { headers: { ...corsHeaders, "Content-Type": "application/json" } },
  );
});
