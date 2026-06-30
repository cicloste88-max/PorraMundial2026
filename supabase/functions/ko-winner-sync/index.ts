// supabase/functions/ko-winner-sync/index.ts
// EF ko-winner-sync v1.0.0 — captura AUTOMÁTICA del ganador de cruces KO desde ESPN.
//
// Problema (29-jun-2026, GER-PAR slot 74): un cruce KO resuelto por penaltis
// acaba 1-1 en el marcador. espn-poll descarta la tanda (buildGoalEvents filtra
// shootout!==true) y solo escribe el 1-1 en live_scores; el bridge infiere el
// ganador del marcador (l vs v) → empate → winner=null → no se reparte el +N de
// avance ni se resuelve el bracket. El propio header de espn-poll ya lo avisaba.
//
// ESPN SÍ da el ganador explícito: competitions[0].competitors[].winner==="true"
// (+ shootoutScore para la tanda), presente con status.type.name=STATUS_FINAL_PEN
// / state=post. Este EF lo lee y lo fuerza sobre results.ko_results[slot].winner.
//
// Aditivo y de bajo riesgo: NO toca live_scores ni el bridge. Idempotente (solo
// escribe en diff). Orientación proyecto vía espn_event_map.inverted. Tras
// cualquier cambio reseedea user_points_cache de todas las ligas (write-through
// de get-league-standings).
//
// Contrato:
//   POST {}                 ciclo normal: ESPN → reconciliar winners → (si cambios)
//                           escribir ko_results + reseed standings.
//   POST { dry_run:true }   reporta stored vs ESPN de los KO finished en ventana,
//                           SIN escribir ni reseed.
//   POST { dates:"YYYYMMDD-YYYYMMDD" }  override del rango ESPN (test). Default
//                           ayer-mañana (igual que espn-poll).
//   Gate X-Cron-Key fail-closed (env IA_CRON_KEY + fallback Vault RPC). verify_jwt=false.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const ESPN_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
const ESPN_TIMEOUT_MS = 8000;

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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!(await isCronAuthorized(req))) return json({ ok: false, error: "unauthorized" }, 401);
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ ok: false, error: "missing_env" }, 500);

  let body: { dry_run?: boolean; dates?: string } = {};
  try { body = await req.json(); } catch { /* sin body = ciclo normal */ }
  const dryRun = body?.dry_run === true;

  const supa = createClient(SUPABASE_URL, SERVICE_KEY);

  // 1) Mapping KO (match_key wc2026_ko_<slot>) → { slot, inverted } por espn_event_id.
  const { data: mapRows, error: mapErr } = await supa.from("espn_event_map").select("espn_event_id, match_key, inverted");
  if (mapErr || !mapRows?.length) return json({ ok: false, error: "espn_event_map_unavailable", detail: mapErr?.message }, 500);
  const koByEspnId = new Map<string, { slot: string; inverted: boolean }>();
  for (const m of mapRows as Record<string, unknown>[]) {
    const mk = String(m.match_key);
    const mm = mk.match(/^wc2026_ko_(\d+)$/);
    if (!mm) continue;
    koByEspnId.set(String(m.espn_event_id), { slot: mm[1], inverted: m.inverted === true });
  }
  if (koByEspnId.size === 0) return json({ ok: true, note: "no_ko_mapping", changes: [] });

  // 2) ko_results actual.
  const { data: resRow, error: resErr } = await supa.from("results").select("ko_results, log").eq("id", 1).maybeSingle();
  if (resErr) return json({ ok: false, error: "results_read_failed", detail: resErr.message }, 500);
  const koResults: Record<string, Record<string, unknown>> = (resRow?.ko_results ?? {}) as Record<string, Record<string, unknown>>;

  // 3) Fetch scoreboard ESPN (rango ayer-mañana salvo override).
  const day = (off: number) => new Date(Date.now() + off * 86400000).toISOString().slice(0, 10).replace(/-/g, "");
  const dates = (typeof body.dates === "string" && /^\d{8}-\d{8}$/.test(body.dates)) ? body.dates : `${day(-1)}-${day(1)}`;
  const url = `${ESPN_SCOREBOARD}?limit=50&dates=${dates}`;
  let sb: Record<string, unknown>;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(ESPN_TIMEOUT_MS) });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    sb = await res.json();
  } catch (e) {
    console.error("[ko-winner-sync] ESPN fetch failed:", e);
    return json({ ok: false, error: "espn_fetch_failed" }, 502);
  }
  const events = Array.isArray(sb?.events) ? (sb.events as Record<string, unknown>[]) : [];

  // 4) Reconciliar cada evento KO finished con ganador explícito.
  const report: Record<string, unknown>[] = [];
  const changes: Record<string, unknown>[] = [];
  for (const ev of events) {
    const espnId = String((ev as Record<string, unknown>)?.id ?? "");
    const ko = koByEspnId.get(espnId);
    if (!ko) continue;
    const comp = (((ev as Record<string, unknown>)?.competitions as unknown[])?.[0] ?? {}) as Record<string, unknown>;
    const cType = ((comp?.status as Record<string, unknown>)?.type ?? {}) as Record<string, unknown>;
    const eType = (((ev as Record<string, unknown>)?.status as Record<string, unknown>)?.type ?? {}) as Record<string, unknown>;
    const state = String(cType?.state ?? eType?.state ?? "");
    const penName = String(cType?.name ?? eType?.name ?? "");
    if (state !== "post") continue; // aún no acabado
    const competitors = Array.isArray(comp?.competitors) ? (comp!.competitors as Record<string, unknown>[]) : [];
    const win = competitors.find((c) => String((c as Record<string, unknown>)?.winner) === "true");
    if (!win) continue; // sin ganador explícito todavía
    const espnSide = String((win as Record<string, unknown>)?.homeAway ?? "");
    if (espnSide !== "home" && espnSide !== "away") continue;
    const projWinner = ko.inverted ? (espnSide === "home" ? "away" : "home") : espnSide;

    // Tally penaltis (orientado a proyecto) si STATUS_FINAL_PEN.
    let pens: { home: number; away: number } | null = null;
    if (penName === "STATUS_FINAL_PEN") {
      const hC = competitors.find((c) => String((c as Record<string, unknown>)?.homeAway) === "home");
      const aC = competitors.find((c) => String((c as Record<string, unknown>)?.homeAway) === "away");
      const hs = Number.parseInt(String((hC as Record<string, unknown>)?.shootoutScore ?? ""), 10);
      const as_ = Number.parseInt(String((aC as Record<string, unknown>)?.shootoutScore ?? ""), 10);
      if (Number.isFinite(hs) && Number.isFinite(as_)) pens = ko.inverted ? { home: as_, away: hs } : { home: hs, away: as_ };
    }

    const cur = koResults[ko.slot];
    if (!cur || typeof cur !== "object") {
      // El bridge aún no ha escrito el resultado base (l/v/scorers). Esperar: NO
      // creamos el slot aquí porque no conocemos los goleadores.
      report.push({ slot: ko.slot, espn_winner: projWinner, stored_winner: null, pending_base: true, pens });
      continue;
    }
    const curWinner = (cur.winner ?? null) as string | null;
    const change = curWinner !== projWinner;
    report.push({ slot: ko.slot, status_name: penName, espn_winner: projWinner, stored_winner: curWinner, pens, change });
    if (change) {
      cur.winner = projWinner;
      if (pens) cur.pens = pens;
      koResults[ko.slot] = cur;
      changes.push({ slot: ko.slot, from: curWinner, to: projWinner, pens });
    }
  }

  if (dryRun) return json({ ok: true, dry_run: true, dates, evaluated: report.length, report });
  if (changes.length === 0) return json({ ok: true, dates, changes: [] });

  // 5) Persistir ko_results + log de trazabilidad.
  const log: unknown[] = Array.isArray(resRow?.log) ? (resRow!.log as unknown[]) : [];
  log.push({ ts: new Date().toISOString(), event: "ko_winner_sync", changes });
  const { error: upErr } = await supa.from("results").update({ ko_results: koResults, log }).eq("id", 1);
  if (upErr) return json({ ok: false, error: "results_update_failed", detail: upErr.message }, 500);

  // 6) Reseed user_points_cache de todas las ligas (write-through del standings EF).
  const { data: lgRows } = await supa.from("user_points_cache").select("league_id");
  const leagueIds = [...new Set((lgRows ?? []).map((r) => String((r as Record<string, unknown>).league_id)))];
  const reseeded: Record<string, unknown>[] = [];
  for (const lid of leagueIds) {
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/get-league-standings`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` },
        body: JSON.stringify({ league_id: lid }),
      });
      reseeded.push({ league_id: lid, status: res.status });
    } catch (e) { reseeded.push({ league_id: lid, error: String(e) }); }
  }

  return json({ ok: true, dates, changes, reseeded });
});
