// supabase/functions/get-ko-crosses/index.ts
// get-ko-crosses · v1.0.0 — agregados de bracket KO por liga (READ-ONLY).
//
//   Dada una liga y (opcionalmente) una lista de slots KO, agrega sobre TODOS
//   los usuarios de la liga los datos que alimentan las "previas KO" (Format A)
//   que Claude.ai formatea on-demand. Devuelve DATOS, no texto. No escribe nada
//   (sin riesgo de regresión de puntos): la lógica de malla es la MISMA que
//   get-league-standings v1.5.1 usa para puntuar KO, aquí extraída y expuesta.
//
//   Por cada slot solicitado:
//     · cruce_exacto    — usuarios cuyo cruce predicho {home,away} (iso3, como
//                         conjunto) == cruce real sembrado en wc_matches_ko.
//     · quien_pasa      — reparto de quién predice cada usuario que avanza
//                         (bucketeado a los 2 reales + "otros" si hay cruce real).
//     · acierto_avanzador — si ko_results[slot].winner está resuelto, nº de
//                         usuarios que predijeron al avanzador REAL.
//     · goleador_top    — goleador más repetido en ko_predictions del slot + %.
//     · ia_line (opc.)  — signo IA del cruce real (compartido entre ligas).
//
//   Auth dual idéntica a get-league-standings v14: bearer==SERVICE_KEY →
//   privilegiado (caller interno: generador de previas, salta membership);
//   bearer JWT → getUser + membership check contra league_members.
//
// verify_jwt=false (ES256 manual).

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { resolveBracket } from "../_shared/ko-bracket.mjs";
import { fetchAllRows } from "./fetch-all.mjs";
import { buildKoIaSignBySlot } from "./ia-bridge.mjs";

// ERR-86: shape { data, error } compatible con el manejo de errores existente;
// pageFn aplica .order() estable + .range(from, to).
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
const KO_SLOT_SET = new Set<number>(Object.keys(KO_ROUND_BY_ID).map(Number));

function asObj(v: unknown): any {
  if (v == null) return null;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return v;
}

function jsonResponse(body: unknown, status: number, corsHeaders: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  const corsHeaders = cors(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") {
    return jsonResponse({ error: "method_not_allowed" }, 405, corsHeaders);
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return jsonResponse({ error: "missing_env" }, 500, corsHeaders);
  }
  const supa = createClient(SUPABASE_URL, SERVICE_KEY);

  // ── Auth dual (idéntica a get-league-standings v14) ─────────────────────
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return jsonResponse({ error: "missing_bearer" }, 401, corsHeaders);
  }
  const token = authHeader.slice(7).trim();
  const privileged = token.length > 0 && token === SERVICE_KEY;
  let callerUid: string | null = null;
  if (!privileged) {
    try {
      const { data, error } = await supa.auth.getUser(token);
      if (error || !data?.user?.id) {
        return jsonResponse({ error: "invalid_token" }, 401, corsHeaders);
      }
      callerUid = data.user.id;
    } catch {
      return jsonResponse({ error: "invalid_token" }, 401, corsHeaders);
    }
  }

  // ── Body ────────────────────────────────────────────────────────────────
  let body: { league_id?: string; slots?: unknown };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ error: "invalid_json" }, 400, corsHeaders);
  }
  const leagueId = body?.league_id;
  if (!leagueId || typeof leagueId !== "string") {
    return jsonResponse({ error: "missing_league_id" }, 400, corsHeaders);
  }
  // slots opcional: array de enteros KO 73..104. Inválidos/fuera de rango se
  // descartan. Missing / no-array / vacío → default = todos los slots sembrados.
  let requestedSlots: number[] | null = null;
  if (Array.isArray(body.slots)) {
    const cleaned = (body.slots as unknown[])
      .map((s) => Number(s))
      .filter((n) => Number.isInteger(n) && KO_SLOT_SET.has(n));
    requestedSlots = cleaned.length ? Array.from(new Set(cleaned)) : null;
  }

  // ── Membership check (solo JWT de usuario) ──────────────────────────────
  if (!privileged) {
    const { data: member, error: mErr } = await supa
      .from("league_members")
      .select("user_id")
      .eq("league_id", leagueId)
      .eq("user_id", callerUid)
      .maybeSingle();
    if (mErr) {
      return jsonResponse({ error: "membership_check_failed", detail: mErr.message }, 500, corsHeaders);
    }
    if (!member) {
      return jsonResponse({ error: "not_a_member" }, 403, corsHeaders);
    }
  }

  // ── Fuentes de datos (mismo patrón que standings) ───────────────────────
  const [
    { data: members,  error: meErr },
    { data: preds,    error: pErr },
    { data: koPreds,  error: koErr },
    { data: wcRows,   error: wcErr },
    { data: wcKoRows, error: wcKoErr },
    { data: resultRow, error: rErr },
    { data: iaKoRows, error: iaKoErr },
  ] = await Promise.all([
    supa.from("league_members").select("user_id").eq("league_id", leagueId),
    fetchAllCompat((from, to) => supa.from("predictions").select("user_id, match_id, local, visitante").eq("league_id", leagueId).order("id").range(from, to)),
    fetchAllCompat((from, to) => supa.from("ko_predictions").select("user_id, match_id, local, visitante, scorer, classifier").eq("league_id", leagueId).order("id").range(from, to)),
    // Puente nombres ES→iso3 (home_es≡home_iso3, away_es≡away_iso3).
    supa.from("wc_matches").select("home_es, away_es, home_iso3, away_iso3"),
    // Equipos reales por slot (iso3). Vacío hasta sembrar → degrada limpio.
    // round NO se lee de aquí: la ronda sale de KO_ROUND_BY_ID (determinista).
    supa.from("wc_matches_ko").select("ko_match_id, home_iso3, away_iso3"),
    // Avanzador real: ko_results[slot].winner (relativo a home_iso3/away_iso3;
    // el bridge ya aplicó teams_swapped al escribir).
    supa.from("results").select("ko_results").limit(1).maybeSingle(),
    // IA line on-demand (independiente de liga; soft-fail).
    supa.from("ia_predictions").select("home_code, away_code, sign").eq("is_ko_ondemand", true),
  ]);

  // Hard-fail en las tablas núcleo.
  for (const [err, label] of [
    [meErr, "league_members"],
    [pErr, "predictions"],
    [koErr, "ko_predictions"],
    [wcErr, "wc_matches"],
  ] as const) {
    if (err) {
      return jsonResponse({ error: "query_failed", table: label, detail: err.message }, 500, corsHeaders);
    }
  }
  // Soft-fail (degradan limpio sin tumbar la respuesta):
  if (wcKoErr) console.error("[ko-crosses] wc_matches_ko query failed (slots reales degradan a vacío):", wcKoErr.message);
  if (rErr)    console.error("[ko-crosses] results query failed (advancer degrada a null):", rErr.message);
  if (iaKoErr) console.error("[ko-crosses] ia_predictions(is_ko_ondemand) query failed (ia_line omitida):", iaKoErr.message);

  const memberUids = (members ?? []).map((m: { user_id: string }) => m.user_id);
  const memberSet = new Set<string>(memberUids);

  const { data: profiles, error: profErr } = await supa
    .from("profiles")
    .select("id, nombre")
    .in("id", memberUids.length ? memberUids : ["00000000-0000-0000-0000-000000000000"]);
  if (profErr) {
    return jsonResponse({ error: "profiles_query_failed", detail: profErr.message }, 500, corsHeaders);
  }
  const nombreByUid: Record<string, string> = {};
  for (const p of (profiles ?? []) as Array<{ id: string; nombre: string | null }>) {
    nombreByUid[p.id] = p.nombre ?? "—";
  }

  // ── Puente nombres ES → iso3 (de wc_matches) ────────────────────────────
  const esNameToIso3: Record<string, string> = {};
  for (const w of (wcRows ?? []) as Array<{ home_es?: string; away_es?: string; home_iso3?: string; away_iso3?: string }>) {
    if (w.home_es && w.home_iso3) esNameToIso3[w.home_es] = w.home_iso3;
    if (w.away_es && w.away_iso3) esNameToIso3[w.away_es] = w.away_iso3;
  }
  const toIso3 = (esName: string | null | undefined): string | null =>
    (esName != null && esNameToIso3[esName]) ? esNameToIso3[esName] : null;

  // ── Equipos reales por slot (iso3) + ko_results ─────────────────────────
  const realKoTeamsBySlot: Record<number, { home: string | null; away: string | null }> = {};
  for (const k of (wcKoRows ?? []) as Array<{ ko_match_id?: number; home_iso3?: string; away_iso3?: string }>) {
    if (k.ko_match_id == null) continue;
    realKoTeamsBySlot[Number(k.ko_match_id)] = { home: k.home_iso3 ?? null, away: k.away_iso3 ?? null };
  }
  const realKoResults: Record<string, { l?: number; v?: number; winner?: string; scorers?: string[] }> | null =
    resultRow ? asObj(resultRow.ko_results) : null;

  // Malla real de un slot: equipos + avanzador (winner relativo a home/away iso3).
  function realSlotMesh(slot: number): { home: string | null; away: string | null; advancer: string | null } | null {
    const teams = realKoTeamsBySlot[slot];
    if (!teams) return null;
    const home = teams.home ?? null;
    const away = teams.away ?? null;
    const res = realKoResults?.[String(slot)];
    let advancer: string | null = null;
    if (res && (res.winner === "home" || res.winner === "away")) {
      advancer = res.winner === "home" ? home : away;
    }
    return { home, away, advancer };
  }

  // ── Slots a procesar ────────────────────────────────────────────────────
  // default = todos los slots con cruce real sembrado (claves de wc_matches_ko).
  const sewnSlots = Object.keys(realKoTeamsBySlot).map(Number).sort((a, b) => a - b);
  const targetSlots = (requestedSlots ?? sewnSlots).slice().sort((a, b) => a - b);

  // ── Acumuladores por slot ───────────────────────────────────────────────
  // Pobladas lazy con el idiom `(map[slot] ??= …)` (igual que standings con
  // boostByUser/predRowsByUser): el operador devuelve un valor NO-undefined, así
  // que el acceso es type-safe sin pre-init ni aserciones, también bajo
  // noUncheckedIndexedAccess. La lectura en el ensamblado usa `?? fallback`.
  const cruceNombres: Record<number, string[]> = {};
  const advanceCounts: Record<number, Map<string, number>> = {};
  const scorerCounts: Record<number, Map<string, number>> = {};
  const scorerDenom: Record<number, number> = {};
  const targetSet = new Set<number>(targetSlots);

  // ── Goleador: barrido directo de ko_predictions (1 fila/usuario/slot) ────
  for (const k of (koPreds ?? []) as Array<{ user_id: string; match_id: number; scorer: string | null }>) {
    const slot = Number(k.match_id);
    if (!targetSet.has(slot)) continue;
    if (!memberSet.has(k.user_id)) continue;
    const scorer = (k.scorer != null && String(k.scorer).trim() !== "") ? String(k.scorer).trim() : null;
    if (!scorer) continue;
    const sc = (scorerCounts[slot] ??= new Map<string, number>());
    sc.set(scorer, (sc.get(scorer) ?? 0) + 1);
    scorerDenom[slot] = (scorerDenom[slot] ?? 0) + 1;
  }

  // ── Rows crudas por usuario para resolveBracket (malla predicha) ────────
  const predRowsByUser: Record<string, Array<{ match_id: string; local: number; visitante: number }>> = {};
  for (const p of (preds ?? []) as Array<{ user_id: string; match_id: string; local: number; visitante: number }>) {
    (predRowsByUser[p.user_id] ??= []).push({ match_id: p.match_id, local: p.local, visitante: p.visitante });
  }
  const koRowsByUser: Record<string, Array<{ match_id: number; local: number; visitante: number; classifier: string | null }>> = {};
  for (const k of (koPreds ?? []) as Array<{ user_id: string; match_id: number; local: number; visitante: number; classifier: string | null }>) {
    (koRowsByUser[k.user_id] ??= []).push({ match_id: k.match_id, local: k.local, visitante: k.visitante, classifier: k.classifier });
  }

  // ── Barrido por usuario: cruce exacto + quién pasa ──────────────────────
  for (const uid of memberUids) {
    const userBracket = resolveBracket(predRowsByUser[uid] ?? [], koRowsByUser[uid] ?? []);
    const predSlots: Record<number, { home?: string | null; away?: string | null; winner?: string | null }> =
      userBracket.slots ?? {};

    for (const slot of targetSlots) {
      const ps = predSlots[slot] ?? {};
      const real = realKoTeamsBySlot[slot];
      const rh = real?.home ?? null;
      const ra = real?.away ?? null;

      // 🎯 Cruce exacto (igualdad de conjunto de iso3).
      const ph = toIso3(ps.home);
      const pa = toIso3(ps.away);
      if (rh && ra && ph && pa) {
        const exact = (ph === rh && pa === ra) || (ph === ra && pa === rh);
        if (exact) (cruceNombres[slot] ??= []).push(nombreByUid[uid] ?? "—");
      }

      // 🔮 Quién pasa (clave por iso3 del avanzador predicho).
      const pw = toIso3(ps.winner);
      if (pw) {
        const adv = (advanceCounts[slot] ??= new Map<string, number>());
        adv.set(pw, (adv.get(pw) ?? 0) + 1);
      }
    }
  }

  // ── IA line (compartida entre ligas; soft-fail) ─────────────────────────
  // buildKoIaSignBySlot orienta el sign al marco real. Sin filas o query fallida
  // → ia_line omitida del response.
  let iaLine: Record<string, { sign: string }> | null = null;
  if (!iaKoErr) {
    const allIaBySlot = buildKoIaSignBySlot(iaKoRows ?? [], realKoTeamsBySlot);
    const filtered: Record<string, { sign: string }> = {};
    for (const slot of targetSlots) {
      const entry = allIaBySlot[slot];
      if (entry?.sign) filtered[String(slot)] = { sign: String(entry.sign) };
    }
    if (Object.keys(filtered).length > 0) iaLine = filtered;
  }

  // ── Ensamblar output por slot ───────────────────────────────────────────
  const slotsOut: Record<string, unknown> = {};
  for (const slot of targetSlots) {
    const mesh = realSlotMesh(slot);
    const rh = mesh?.home ?? null;
    const ra = mesh?.away ?? null;
    const advancer = mesh?.advancer ?? null;

    // quien_pasa: si hay cruce real → bucket {realHome, realAway, otros};
    // si no (slot no sembrado) → mapa crudo iso3→count (aún informativo).
    const counts = advanceCounts[slot] ?? new Map<string, number>();
    let quienPasa: Record<string, number>;
    if (rh && ra) {
      let otros = 0;
      for (const [iso, c] of counts) {
        if (iso !== rh && iso !== ra) otros += c;
      }
      quienPasa = { [rh]: counts.get(rh) ?? 0, [ra]: counts.get(ra) ?? 0, otros };
    } else {
      quienPasa = {};
      for (const [iso, c] of counts) quienPasa[iso] = c;
    }

    // goleador_top: argmax sobre scorerCounts + % sobre denominador del slot.
    let goleadorTop: { scorer: string; count: number; pct: number } | null = null;
    const denom = scorerDenom[slot] ?? 0;
    if (denom > 0) {
      let topScorer: string | null = null;
      let topCount = 0;
      for (const [scorer, c] of (scorerCounts[slot] ?? new Map<string, number>())) {
        if (c > topCount) { topCount = c; topScorer = scorer; }
      }
      if (topScorer != null) {
        goleadorTop = { scorer: topScorer, count: topCount, pct: Math.round((topCount * 100) / denom) };
      }
    }

    // nombres ordenados (locale ES) para una respuesta determinista.
    const nombres = (cruceNombres[slot] ?? []).slice().sort((a, b) => a.localeCompare(b, "es"));

    slotsOut[String(slot)] = {
      round: KO_ROUND_BY_ID[slot] ?? null,
      real: { home: rh, away: ra, advancer },
      cruce_exacto: { count: nombres.length, nombres },
      quien_pasa: quienPasa,
      acierto_avanzador: advancer ? (counts.get(advancer) ?? 0) : null,
      goleador_top: goleadorTop,
    };
  }

  const out: Record<string, unknown> = {
    league_id: leagueId,
    version: "1.0.0",
    slots: slotsOut,
  };
  if (iaLine) out.ia_line = iaLine;

  return jsonResponse(out, 200, corsHeaders);
});
