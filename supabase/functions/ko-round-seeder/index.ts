// supabase/functions/ko-round-seeder/index.ts
// EF ko-round-seeder v1.0.3 — siembra AUTOMÁTICA de rondas KO (R16→final).
//
// Problema (5-jul-2026): R32 completo (16/16 en results.ko_results) pero los
// octavos (slots 89-96) NO existían en wc_matches_ko / espn_event_map /
// live_scores → el pipeline entero (espn-poll → bridge → standings) estaba
// ciego a R16 con 2 octavos YA jugados en ESPN (MAR@CAN, FRA@PAR 4-jul).
// ko-winner-sync no siembra: solo corrige winners de slots ya mapeados.
//
// Diseño — granularidad POR SLOT (no por ronda): un slot de ronda N+1 es
// sembrable cuando sus alimentadores están resueltos (winner en ko_results;
// para third=103 los LOSERS de las semis) Y hay exactamente 1 evento ESPN
// matcheable por pareja de equipos (abbreviation == iso3 en KO, verificado).
// Así los QF parciales se siembran en cuanto se conocen sin esperar la ronda
// completa. La cascada R16→QF→SF→final emerge sola entre runs del cron (*/15):
// el bridge puentea los R16 a ko_results y el siguiente run ya deriva QF.
//
// Por slot sembrable: INSERT wc_matches_ko (orientación canónica del bracket,
// teams_swapped=false) + espn_event_map (inverted = home ESPN != home proyecto)
// + live_scores esqueleto (estado según ESPN: pre→notstarted, in→inprogress,
// post→finished con marcador final orientado). Nombres ES desde wc_matches
// (home_es/away_es ≡ EQUIPOS.name, la fuente canónica que casó la siembra R32).
//
// DECISIÓN goleadores de partidos post: el seeder copia los scoringPlays ESPN
// a live_scores.events (formato webhook vía buildGoalEvents de espn-poll, ids
// estables idénticos) EN LA PROPIA SIEMBRA. Razón: espn-poll NUNCA toca filas
// finished (guard .neq status finished), así que una fila sembrada ya-finished
// jamás recibiría sus events del poller aunque el partido esté en su ventana
// ayer-mañana — sin events, el bridge escribiría scorers=[] y el +2 de
// goleador no puntuaría. Con los events copiados, el bridge extrae scorers
// completos en el primer puente.
//
// DECISIÓN puente de partidos post: el trigger bridge_on_finished es AFTER
// UPDATE OF status — un INSERT ya-finished NO lo dispara. El seeder invoca
// porra-bridge-results explícitamente (bearer service_role, por match_key)
// para cada fila sembrada finished; el cron sweep-unbridged-finished (*/5min)
// queda como red de seguridad. El bridge es idempotente y refresca él mismo
// user_points_cache de todas las ligas; si el marcador quedó empatado (tanda),
// escribe winner=null y el cron ko-winner-sync (gate: finished con winner
// null) lo cierra leyendo competitor.winner de ESPN en ≤2 min.
//
// Idempotencia / self-healing: slot ya en wc_matches_ko → no se re-siembra
// (solo reconcilia date_utc/match_start_ts si ESPN cambió la fecha y el
// partido no arrancó). Piezas huérfanas de un run fallido a medias (fila
// wc_matches_ko sin espn_event_map o sin live_scores) se completan en el
// siguiente run. Ante 0 o >1 candidatos ESPN NO siembra y reporta (fail-safe).
//
// Contrato:
//   POST {}                 ciclo normal: deriva + matchea + siembra + puentea.
//   POST { dry_run:true }   reporte completo (slots, cruces, espn ids, inverted,
//                           estados) SIN escribir ni invocar el bridge.
//   POST { dates:"YYYYMMDD-YYYYMMDD" }  override de la ventana ESPN (default
//                           hoy-2 → hoy+14).
//   Gate X-Cron-Key fail-closed (env IA_CRON_KEY + fallback Vault RPC
//   get_vault_secrets, comparación constant-time). verify_jwt=false (ERR-16).
//
// Bundle: index.ts + seeder-logic.mjs + ../espn-poll/parser.mjs (~30KB, <70KB
// deploy MCP). NO importa _shared/ko-data.mjs (59KB de ANNEX_C irrelevante en
// R16+): los feeders viven en seeder-logic.mjs::KO_FEEDERS, verificados 1:1
// contra BRACKET por tests/ko-round-seeder.test.mjs.
//
// Changelog (v1.0.1-1.0.3 = hotfixes de los runs reales del 5-jul, bugs de
// constraints de BD viva + concurrencia no detectables en container):
//   v1.0.1  live_scores ANTES que espn_event_map — espn_event_map.match_key
//           tiene FK → live_scores(match_key); el orden inverso violaba el FK
//           en todos los slots.
//   v1.0.2  live_scores.sofascore_url es NOT NULL sin default (único NOT NULL
//           además de match_key) → se rellena con la URL ESPN del evento
//           (patrón siembra R32, fila referencia wc2026_ko_73).
//   v1.0.3  bridges SECUENCIALES — en paralelo (Promise.allSettled) dos
//           bridges hacen read-modify-write de results.ko_results (id=1) y se
//           pisan: el write del slot 89 machacó el del 90 (re-puente a mano).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto as stdCrypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";
import {
  KO_FEEDERS,
  deriveSeedableSlots,
  espnDateToProject,
  liveRowStateFor,
  matchEspnEvent,
  normTeamName,
} from "./seeder-logic.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ESPN_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
const ESPN_TIMEOUT_MS = 8000;
const BRIDGE_TIMEOUT_MS = 10000;
const COMPETITION = "FIFA World Cup 2026";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-key",
};
function json(b: unknown, s = 200) {
  return new Response(JSON.stringify(b), { status: s, headers: { ...CORS, "Content-Type": "application/json" } });
}
function ctEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i); return d === 0;
}
async function readVaultSecrets(names: string[]): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_vault_secrets`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` },
      body: JSON.stringify({ secret_names: names }),
    });
    if (!res.ok) return {};
    const out: Record<string, string> = {};
    // deno-lint-ignore no-explicit-any
    for (const r of await res.json()) out[(r as any).name] = String((r as any).secret).trim();
    return out;
  } catch { return {}; }
}
async function isCronAuthorized(req: Request): Promise<boolean> {
  const provided = (req.headers.get("x-cron-key") ?? "").trim();
  if (!provided) return false;
  const expected = (Deno.env.get("IA_CRON_KEY") ?? "").trim() || (await readVaultSecrets(["IA_CRON_KEY"]))["IA_CRON_KEY"] || "";
  if (!expected) return false;
  return ctEq(provided, expected);
}

// id estable de gol: md5 std/crypto sobre bytes UTF-8 (mismo scheme espn-poll).
async function md5HexAsync(input: string): Promise<string> {
  const buf = await stdCrypto.subtle.digest("MD5", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// Reader defensivo jsonb (patrón asObj del bridge — ERR-90).
function asObj(v: unknown): Record<string, unknown> | null {
  if (v == null) return null;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return typeof v === "object" ? (v as Record<string, unknown>) : null;
}

type Rec = Record<string, unknown>;

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!(await isCronAuthorized(req))) return json({ ok: false, error: "unauthorized" }, 401);
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ ok: false, error: "missing_env" }, 500);

  let body: { dry_run?: boolean; dates?: string } = {};
  try { body = await req.json(); } catch { /* sin body = ciclo normal */ }
  const dryRun = body?.dry_run === true;

  const supa = createClient(SUPABASE_URL, SERVICE_KEY);
  const koKeys = KO_FEEDERS.map((f) => `wc2026_ko_${f.id}`);

  // 1) Estado actual: diccionario KO + resultados + mapping ESPN + live rows
  //    de los slots 89-104 + puente de nombres ES (wc_matches).
  const [
    { data: wcKoRows, error: wcKoErr },
    { data: resRow, error: resErr },
    { data: mapRows, error: mapErr },
    { data: liveRows, error: liveErr },
    { data: wcRows, error: wcErr },
  ] = await Promise.all([
    supa.from("wc_matches_ko").select("match_key, ko_match_id, round, home_iso3, away_iso3, date_utc"),
    supa.from("results").select("ko_results").eq("id", 1).maybeSingle(),
    supa.from("espn_event_map").select("espn_event_id, match_key, inverted"),
    supa.from("live_scores").select("match_key, status, match_start_ts").in("match_key", koKeys),
    supa.from("wc_matches").select("home_es, away_es, home_iso3, away_iso3"),
  ]);
  for (const [err, label] of [
    [wcKoErr, "wc_matches_ko"], [resErr, "results"], [mapErr, "espn_event_map"],
    [liveErr, "live_scores"], [wcErr, "wc_matches"],
  ] as const) {
    if (err) return json({ ok: false, error: "query_failed", table: label, detail: err.message }, 500);
  }

  const koResults = asObj(resRow?.ko_results) ?? {};
  const wcKoBySlot = new Map<number, Rec>();
  for (const r of (wcKoRows ?? []) as Rec[]) {
    if (r.ko_match_id != null) wcKoBySlot.set(Number(r.ko_match_id), r);
  }
  const mapByKey = new Map<string, { espn_event_id: string; inverted: boolean }>();
  const keyByEspnId = new Map<string, string>();
  for (const m of (mapRows ?? []) as Rec[]) {
    mapByKey.set(String(m.match_key), { espn_event_id: String(m.espn_event_id), inverted: m.inverted === true });
    keyByEspnId.set(String(m.espn_event_id), String(m.match_key));
  }
  const liveByKey = new Map<string, Rec>();
  for (const r of (liveRows ?? []) as Rec[]) liveByKey.set(String(r.match_key), r);

  // Nombres ES canónicos (≡ EQUIPOS.name, ≡ siembra R32) + dict para el
  // fallback por nombre del matcher. Todo mundialista aparece en wc_matches.
  const esByIso3: Record<string, string> = {};
  const nameToIso3: Record<string, string> = {};
  for (const w of (wcRows ?? []) as Rec[]) {
    for (const [es, iso] of [[w.home_es, w.home_iso3], [w.away_es, w.away_iso3]] as const) {
      if (typeof es === "string" && typeof iso === "string" && es && iso) {
        esByIso3[iso] = es;
        nameToIso3[normTeamName(es)] = iso;
      }
    }
  }

  // 2) Derivación por slot: nuevos sembrables + piezas huérfanas a reparar.
  const { seedable, pending } = deriveSeedableSlots(wcKoRows ?? [], koResults);
  const repairs: Array<{ slot: number; round: string; home_iso3: string; away_iso3: string; missing: string[] }> = [];
  for (const f of KO_FEEDERS) {
    const row = wcKoBySlot.get(f.id);
    if (!row) continue;
    const mk = `wc2026_ko_${f.id}`;
    const missing: string[] = [];
    if (!mapByKey.has(mk)) missing.push("espn_event_map");
    if (!liveByKey.has(mk)) missing.push("live_scores");
    if (missing.length) {
      repairs.push({ slot: f.id, round: String(row.round ?? f.round), home_iso3: String(row.home_iso3 ?? ""), away_iso3: String(row.away_iso3 ?? ""), missing });
    }
  }

  // 3) Scoreboard ESPN, ventana hoy-2 → hoy+14 (los KO se publican con ~2
  //    semanas de horizonte; la final 19-jul cabe desde el 5-jul).
  const day = (off: number) => new Date(Date.now() + off * 86400000).toISOString().slice(0, 10).replace(/-/g, "");
  const dates = (typeof body.dates === "string" && /^\d{8}-\d{8}$/.test(body.dates)) ? body.dates : `${day(-2)}-${day(14)}`;
  let sbEvents: Rec[] = [];
  try {
    const res = await fetch(`${ESPN_SCOREBOARD}?limit=50&dates=${dates}`, { signal: AbortSignal.timeout(ESPN_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const sb = await res.json();
    sbEvents = Array.isArray(sb?.events) ? (sb.events as Rec[]) : [];
  } catch (e) {
    console.error("[ko-round-seeder] ESPN fetch failed:", e);
    return json({ ok: false, error: "espn_fetch_failed", dates }, 502);
  }
  const sbById = new Map<string, Rec>(sbEvents.map((ev) => [String(ev?.id ?? ""), ev]));

  // 4) Sembrar / reparar cada slot candidato.
  const report: Rec[] = [];
  const bridgeKeys: string[] = [];

  for (const cand of [...seedable.map((s) => ({ ...s, missing: null as string[] | null })), ...repairs]) {
    const mk = `wc2026_ko_${cand.slot}`;
    const entry: Rec = {
      slot: cand.slot, round: cand.round, match_key: mk,
      cross: `${cand.home_iso3}-${cand.away_iso3}`,
      mode: cand.missing ? `repair:${cand.missing.join("+")}` : "seed",
    };
    report.push(entry);

    const homeEs = esByIso3[cand.home_iso3];
    const awayEs = esByIso3[cand.away_iso3];
    if (!homeEs || !awayEs) {
      // Sin nombre ES canónico NO se siembra: el front resuelve equipos KO por
      // nombre exacto contra EQUIPOS (live-sync/_joKOTeamFromName).
      entry.action = "skip"; entry.reason = "missing_es_name";
      continue;
    }

    // Matching ESPN: en reparación con mapping previo se respeta el mapping
    // (consistencia con lo ya sembrado); si no, matching por pareja de equipos.
    let espnEventId: string; let inverted: boolean; let via: string;
    const prevMap = mapByKey.get(mk);
    if (cand.missing && prevMap) {
      espnEventId = prevMap.espn_event_id; inverted = prevMap.inverted; via = "existing_map";
    } else {
      const m = matchEspnEvent(sbEvents, cand.home_iso3, cand.away_iso3, nameToIso3);
      if (!m.ok) {
        entry.action = "skip"; entry.reason = m.reason; entry.candidates = m.candidates;
        continue;
      }
      espnEventId = m.espn_event_id; inverted = m.inverted; via = m.via;
      const mappedTo = keyByEspnId.get(espnEventId);
      if (mappedTo && mappedTo !== mk) {
        // El evento ya pertenece a otro match_key → conflicto, no sembrar.
        entry.action = "skip"; entry.reason = "espn_id_already_mapped"; entry.mapped_to = mappedTo;
        continue;
      }
    }
    const ev = sbById.get(espnEventId);
    if (!ev) {
      entry.action = "skip"; entry.reason = "espn_event_not_in_window"; entry.espn_event_id = espnEventId;
      continue;
    }

    const { dateUtc, epochSeconds } = espnDateToProject((ev as Rec).date);
    const live = await liveRowStateFor(ev, inverted, md5HexAsync);
    Object.assign(entry, {
      espn_event_id: espnEventId, inverted, matched_via: via,
      espn_state: live.espn_state, status: live.status,
      score: live.status === "notstarted" ? null : `${live.score_home ?? "-"}-${live.score_away ?? "-"}`,
      goals: Array.isArray(live.events) ? live.events.length : 0,
      had_penalties: live.had_penalties, date_utc: dateUtc,
    });

    if (dryRun) { entry.action = "would_seed"; continue; }

    // 4a) wc_matches_ko (solo siembra nueva; en repair la fila ya existe).
    if (!cand.missing) {
      const { error } = await supa.from("wc_matches_ko").insert({
        match_key: mk, sofascore_id: null, ko_match_id: cand.slot, round: cand.round,
        home_iso3: cand.home_iso3, away_iso3: cand.away_iso3, teams_swapped: false, date_utc: dateUtc,
      });
      if (error) { entry.action = "error"; entry.reason = `wc_matches_ko_insert: ${error.message}`; continue; }
    }
    // 4b) live_scores esqueleto (orientado a proyecto — el writer nunca
    //     pre-orienta: inverted vive en espn_event_map y aquí ya se aplicó).
    //     ⚠️ INVARIANTE de orden (v1.0.1, descubierto en el run real 5-jul):
    //     live_scores DEBE insertarse ANTES que espn_event_map —
    //     espn_event_map.match_key tiene FK → live_scores(match_key) y el
    //     orden inverso violaba el FK en todos los slots. Lo fija un
    //     source-assert en tests/ko-round-seeder.test.mjs.
    if (!liveByKey.has(mk)) {
      const { error } = await supa.from("live_scores").insert({
        match_key: mk,
        // sofascore_url es NOT NULL sin default (v1.0.2, run real 5-jul):
        // se rellena con la URL ESPN del evento (patrón de la siembra R32).
        sofascore_url: `https://www.espn.com/soccer/match/_/gameId/${espnEventId}`,
        status: live.status, status_code: live.status_code, minute: live.minute,
        score_home: live.score_home, score_away: live.score_away, events: live.events,
        poll_active: live.poll_active, poll_interval: live.poll_interval,
        had_penalties: live.had_penalties, match_start_ts: epochSeconds,
        is_historic: false, home_team_name: homeEs, away_team_name: awayEs,
        competition: COMPETITION, updated_at: new Date().toISOString(),
      });
      if (error) { entry.action = "error"; entry.reason = `live_scores_insert: ${error.message}`; continue; }
      if (live.status === "finished") bridgeKeys.push(mk);
    }
    // 4c) espn_event_map (SIEMPRE después de live_scores — FK, ver 4b).
    if (!mapByKey.has(mk)) {
      const { error } = await supa.from("espn_event_map").insert({ espn_event_id: espnEventId, match_key: mk, inverted });
      if (error) { entry.action = "error"; entry.reason = `espn_event_map_insert: ${error.message}`; continue; }
    }
    entry.action = "seeded";
  }

  // 5) Reconciliación de fecha en slots ya completos y sin arrancar.
  const reconciled: Rec[] = [];
  for (const f of KO_FEEDERS) {
    const row = wcKoBySlot.get(f.id);
    const mk = `wc2026_ko_${f.id}`;
    const map = mapByKey.get(mk);
    const liveRow = liveByKey.get(mk);
    if (!row || !map || !liveRow) continue;
    const ev = sbById.get(map.espn_event_id);
    if (!ev || String(liveRow.status) !== "notstarted") continue;
    const { dateUtc, epochSeconds } = espnDateToProject((ev as Rec).date);
    const changes: Rec = { slot: f.id, match_key: mk };
    let changed = false;
    if (dateUtc && dateUtc !== String(row.date_utc ?? "")) {
      changes.date_utc = { from: row.date_utc ?? null, to: dateUtc };
      if (!dryRun) await supa.from("wc_matches_ko").update({ date_utc: dateUtc }).eq("match_key", mk);
      changed = true;
    }
    if (epochSeconds != null && Number(liveRow.match_start_ts) !== epochSeconds) {
      changes.match_start_ts = { from: liveRow.match_start_ts ?? null, to: epochSeconds };
      if (!dryRun) await supa.from("live_scores").update({ match_start_ts: epochSeconds, updated_at: new Date().toISOString() }).eq("match_key", mk).neq("status", "finished");
      changed = true;
    }
    if (changed) reconciled.push({ ...changes, dry_run: dryRun });
  }

  // 6) Puente explícito de las filas sembradas ya-finished (el trigger AFTER
  //    UPDATE no salta en INSERT; el sweep */5min queda de red de seguridad).
  //    SECUENCIAL, nunca en paralelo (v1.0.3, race REAL observada 5-jul): el
  //    bridge hace read-modify-write del jsonb results.ko_results (fila única
  //    id=1); dos bridges concurrentes leen el mismo snapshot y el último
  //    write pisa al otro (el del slot 89 machacó el del 90 → re-puente a mano).
  const bridged: Rec[] = [];
  if (!dryRun && bridgeKeys.length) {
    for (const mk of bridgeKeys) {
      try {
        const r = await fetch(`${SUPABASE_URL}/functions/v1/porra-bridge-results`, {
          method: "POST",
          headers: { "Content-Type": "application/json", "Authorization": `Bearer ${SERVICE_KEY}` },
          body: JSON.stringify({ match_key: mk }),
          signal: AbortSignal.timeout(BRIDGE_TIMEOUT_MS),
        });
        bridged.push({ match_key: mk, status: r.status, body: await r.json().catch(() => null) });
      } catch (e) {
        bridged.push({ match_key: mk, error: String(e) });
      }
    }
  }

  const seededCount = report.filter((r) => r.action === "seeded").length;
  return json({
    ok: true,
    version: "1.0.3",
    dry_run: dryRun,
    dates,
    already_seeded: [...wcKoBySlot.keys()].filter((s) => s >= 89).sort((a, b) => a - b),
    seeded: seededCount,
    report,
    pending,
    reconciled,
    bridged,
  });
}

// try/catch global (patrón bridge v8): un throw inesperado devuelve detail y
// deja stack en logs en vez de un 500 mudo.
Deno.serve(async (req: Request) => {
  try {
    return await handle(req);
  } catch (e) {
    console.error("[ko-round-seeder] UNCAUGHT:", e instanceof Error ? (e.stack ?? e.message) : String(e));
    return json({ ok: false, error: "internal_uncaught", detail: e instanceof Error ? e.message : String(e) }, 500);
  }
});
