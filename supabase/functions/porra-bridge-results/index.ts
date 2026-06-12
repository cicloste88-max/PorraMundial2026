// Versionado desde runtime el 10-jun-2026 (v6). Origen: deploy vía MCP sin commit previo.
// Fuente de verdad hasta esta fecha: runtime Supabase. A partir de ahora: este fichero.
// supabase/functions/porra-bridge-results/index.ts
// P4/D — Puente live_scores(finished) → results. BLOQUE CRITICO del torneo.
//   v8 (Item 2 post-J1, hardening OBLIGATORIO tras el incidente update-results
//     v9 del 11-jun): (a) reader defensivo asObj en match_results/ko_results —
//     un writer que regrese a jsonb double-encoded (string) ya no crashea el
//     bridge con 500 mudo (el spread de un string producía basura {0:'{',...});
//     (b) try/catch GLOBAL con console.error del stack — el 500 de aquella
//     noche no dejó traza alguna en logs.
//   v7 (B11, Item 7 post-J1): tras un bridge con éxito, refresca
//     user_points_cache invocando get-league-standings v1.4.0 (bearer
//     service_role privilegiado) para TODAS las ligas — el tile del Predictor
//     y las vistas v_user_global_rank/v_league_rank leen de esa cache, que
//     así se actualiza al finalizar cada partido. Fallos del refresh NO
//     tumban el bridge (console.error + cache_refresh en la respuesta).
//   v4: GUARDAS (no escribe con dato incompleto) + soporte FASE FINAL (KO).
//     - Grupos: results.match_results["{grupo}_{home_es}_{away_es}"] = {l,v,scorers,status}
//     - KO:     results.ko_results["{ko_match_id}"] = {l,v,scorers,winner,status}
//       winner ('home'|'away') derivado de prorroga/penaltis (score_agg / shootout)
//       — imprescindible para que el avance de ronda puntue en empates resueltos
//       por penaltis (el usuario indica classifier en la card KO).
//   GUARDAS (no rectificar despues): solo escribe si status='finished' Y score no-null
//     Y la clave resuelve en diccionario. Si algo falla, NO escribe y lo loguea
//     en results.log. Idempotente (trigger + barrido de respaldo convergen aqui).
//
// Input (POST): { match_key?: string }. Sin match_key procesa todos los finished
// no-volcados. verify_jwt=false (auth secret==service_role).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// Reader defensivo jsonb (patrón asObj de get-league-standings): si el campo
// llega como string (double-encoded por un writer con JSON.stringify, vivido
// con update-results v9 el 11-jun), parsear en vez de crashear.
function asObj(v: unknown): Record<string, unknown> | null {
  if (v == null) return null;
  if (typeof v === "string") {
    try { return JSON.parse(v); } catch { return null; }
  }
  return typeof v === "object" ? (v as Record<string, unknown>) : null;
}

type EquiposPlayer = { key: string; name: string };
type EquiposPlayersByIso3 = Record<string, EquiposPlayer[]>;

function playerToShortKey(nombre: string, iso3: string, eqMap: EquiposPlayersByIso3): string {
  if (!nombre) return "";
  const eq = eqMap[iso3];
  if (Array.isArray(eq)) {
    const hit = eq.find((p) => p.name && p.name.includes(nombre));
    if (hit) return hit.key;
  }
  const norm = String(nombre).normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const parts = norm.trim().split(/\s+/);
  return parts[parts.length - 1] || "";
}

function extractScorers(
  events: unknown,
  homeIso3: string,
  awayIso3: string,
  teamsSwapped: boolean,
  eqMap: EquiposPlayersByIso3,
): string[] {
  if (!Array.isArray(events)) return [];
  const GOAL_TYPES = new Set(["goal", "inGamePenalty", "penaltyShootout"]);
  const out: string[] = [];
  for (const ev of events) {
    if (!ev || typeof ev !== "object") continue;
    const e = ev as Record<string, unknown>;
    const itype = String(e.incidentType ?? "");
    if (!GOAL_TYPES.has(itype)) continue;
    if (String(e.incidentClass ?? "") === "ownGoal") continue;
    // penaltyShootout cuenta para goleador? NO: los penaltis de tanda no son 'gol' de jugador
    // a efectos de la porra (el scorer se predice sobre goles en juego). Excluimos shootout.
    if (itype === "penaltyShootout") continue;
    const player = e.player as Record<string, unknown> | undefined;
    const pname = player && typeof player.name === "string" ? player.name : "";
    if (!pname) continue;
    const sofaIsHome = e.isHome === true;
    const projIsHome = teamsSwapped ? !sofaIsHome : sofaIsHome;
    const iso3 = projIsHome ? homeIso3 : awayIso3;
    const key = playerToShortKey(pname, iso3, eqMap);
    if (key) out.push(key);
  }
  return out;
}

// Determina el ganador KO (perspectiva PROYECTO: home_es/away_es) considerando
// prorroga (score regular) y penaltis (score_agg o tanda). Devuelve 'home'|'away'|null.
function koWinner(
  ls: Record<string, unknown>,
  l: number,
  v: number,
  teamsSwapped: boolean,
): string | null {
  // 1) Si el marcador (ya orientado a proyecto) no es empate, ese es el ganador.
  if (l > v) return "home";
  if (v > l) return "away";
  // 2) Empate en regular/prorroga → penaltis. Usar score_agg (SofaScore aggregated
  //    suele reflejar el global; en KO a partido unico, el desempate). Orientar a proyecto.
  const aggHomeSofa = ls.score_agg_home as number | null;
  const aggAwaySofa = ls.score_agg_away as number | null;
  if (aggHomeSofa != null && aggAwaySofa != null && aggHomeSofa !== aggAwaySofa) {
    const aggHome = teamsSwapped ? aggAwaySofa : aggHomeSofa;
    const aggAway = teamsSwapped ? aggHomeSofa : aggAwaySofa;
    return aggHome > aggAway ? "home" : "away";
  }
  // 3) Contar penaltis de tanda en events (incidentType penaltyShootout, incidentClass scored).
  const events = ls.events;
  if (Array.isArray(events)) {
    let homeSo = 0, awaySo = 0;
    for (const ev of events) {
      const e = ev as Record<string, unknown>;
      if (String(e.incidentType ?? "") !== "penaltyShootout") continue;
      if (String(e.incidentClass ?? "") !== "scored") continue;
      const sofaIsHome = e.isHome === true;
      const projIsHome = teamsSwapped ? !sofaIsHome : sofaIsHome;
      if (projIsHome) homeSo++; else awaySo++;
    }
    if (homeSo !== awaySo) return homeSo > awaySo ? "home" : "away";
  }
  // 4) No determinable con los datos → null (no se fuerza; el barrido reintentará).
  return null;
}

async function handle(req: Request): Promise<Response> {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (req.method !== "POST") return json({ error: "method_not_allowed" }, 405);
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ error: "missing_env" }, 500);

  const url = new URL(req.url);
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.toLowerCase().startsWith("bearer ")
    ? authHeader.slice(7).trim() : "";
  const secret = url.searchParams.get("secret") ?? bearer;
  if (secret !== SERVICE_KEY) return json({ error: "unauthorized" }, 401);

  let body: { match_key?: string } = {};
  try { body = await req.json(); } catch { /* sin body = todos */ }
  const onlyKey = (body?.match_key ?? "").trim();

  const supa = createClient(SUPABASE_URL, SERVICE_KEY);

  let q = supa.from("live_scores")
    .select("match_key, status, score_home, score_away, score_agg_home, score_agg_away, events, had_penalties, had_overtime")
    .eq("status", "finished");
  if (onlyKey) q = q.eq("match_key", onlyKey);

  const [
    { data: finished, error: lsErr },
    { data: eqRows,   error: eqErr },
  ] = await Promise.all([
    q,
    supa.from("equipos_players").select("iso3, players"),
  ]);
  if (lsErr) return json({ error: "live_scores_query_failed", detail: lsErr.message }, 500);
  if (eqErr) return json({ error: "equipos_players_query_failed", detail: eqErr.message }, 500);
  if (!finished || finished.length === 0) {
    return json({ ok: true, bridged: 0, note: onlyKey ? "match_key no finished o inexistente" : "sin partidos finished" });
  }

  const eqMap: EquiposPlayersByIso3 = {};
  for (const r of eqRows ?? []) eqMap[r.iso3] = (r.players as EquiposPlayer[]) ?? [];

  const keys = finished.map((r) => r.match_key);
  // Diccionarios: grupos (wc_matches) y KO (wc_matches_ko).
  const [{ data: dictG }, { data: dictK }] = await Promise.all([
    supa.from("wc_matches").select("match_key, group_letter, home_es, away_es, teams_swapped, home_iso3, away_iso3").in("match_key", keys),
    supa.from("wc_matches_ko").select("match_key, ko_match_id, round, home_iso3, away_iso3, teams_swapped").in("match_key", keys),
  ]);
  const dictGByKey: Record<string, any> = {};
  for (const d of dictG ?? []) dictGByKey[d.match_key] = d;
  const dictKByKey: Record<string, any> = {};
  for (const d of dictK ?? []) dictKByKey[d.match_key] = d;

  const { data: resultRow, error: rErr } = await supa
    .from("results").select("match_results, ko_results, log").eq("id", 1).maybeSingle();
  if (rErr) return json({ error: "results_query_failed", detail: rErr.message }, 500);
  // v8: asObj — un match_results/ko_results double-encoded (string) ya no
  // revienta el merge (spread de string = basura) ni pierde lo acumulado.
  const matchResults: Record<string, unknown> = asObj(resultRow?.match_results) ?? {};
  const koResults: Record<string, unknown> = asObj(resultRow?.ko_results) ?? {};
  const log: unknown[] = Array.isArray(resultRow?.log) ? (resultRow!.log as unknown[]) : [];

  const bridgedG: string[] = [];
  const bridgedK: string[] = [];
  const skipped: Array<{ match_key: string; reason: string }> = [];
  const nowIso = new Date().toISOString();

  for (const ls of finished) {
    const mk = ls.match_key as string;
    // GUARDA 1: score no-null (no puntuar con dato incompleto).
    if (ls.score_home == null || ls.score_away == null) {
      skipped.push({ match_key: mk, reason: "score_null" });
      log.push({ ts: nowIso, match_key: mk, event: "bridge_skip", reason: "score_null" });
      continue;
    }
    const dG = dictGByKey[mk];
    const dK = dictKByKey[mk];
    // GUARDA 2: clave debe resolver en exactamente un diccionario.
    if (!dG && !dK) {
      skipped.push({ match_key: mk, reason: "no_dict_entry" });
      log.push({ ts: nowIso, match_key: mk, event: "bridge_skip", reason: "no_dict_entry" });
      continue;
    }

    if (dG) {
      // ── GRUPOS ──
      const l = dG.teams_swapped ? ls.score_away : ls.score_home;
      const v = dG.teams_swapped ? ls.score_home : ls.score_away;
      const scorers = extractScorers(ls.events, dG.home_iso3, dG.away_iso3, dG.teams_swapped, eqMap);
      const rk = `${dG.group_letter}_${dG.home_es}_${dG.away_es}`;
      matchResults[rk] = { l, v, scorers, status: "finished" };
      bridgedG.push(rk);
    } else {
      // ── KO (FASE FINAL) ──
      const l = dK.teams_swapped ? ls.score_away : ls.score_home;
      const v = dK.teams_swapped ? ls.score_home : ls.score_away;
      const scorers = extractScorers(ls.events, dK.home_iso3, dK.away_iso3, dK.teams_swapped, eqMap);
      const winner = koWinner(ls as Record<string, unknown>, l, v, dK.teams_swapped);
      // GUARDA 3 (KO): si es empate y no se pudo determinar ganador, NO escribir
      // (el avance quedaria sin puntuar mal). Reintenta el barrido cuando llegue el dato.
      if (l === v && !winner) {
        skipped.push({ match_key: mk, reason: "ko_winner_undetermined" });
        log.push({ ts: nowIso, match_key: mk, event: "bridge_skip", reason: "ko_winner_undetermined" });
        continue;
      }
      const id = String(dK.ko_match_id);
      koResults[id] = { l, v, scorers, winner: winner ?? (l > v ? "home" : "away"), round: dK.round, status: "finished" };
      bridgedK.push(id);
    }
  }

  const totalBridged = bridgedG.length + bridgedK.length;
  if (totalBridged > 0) {
    const { error: upErr } = await supa
      .from("results")
      .update({ match_results: matchResults, ko_results: koResults, log, updated_at: nowIso })
      .eq("id", 1);
    if (upErr) return json({ error: "results_update_failed", detail: upErr.message }, 500);
  } else if (skipped.length > 0) {
    // Persistir el log de skips aunque no haya bridged (trazabilidad).
    await supa.from("results").update({ log, updated_at: nowIso }).eq("id", 1);
  }

  // v7 (B11): refrescar user_points_cache vía get-league-standings (bearer
  // service_role privilegiado) para todas las ligas. Solo si hubo bridge real.
  let cacheRefreshed = 0;
  if (totalBridged > 0) {
    try {
      const { data: allLeagues } = await supa.from("leagues").select("id");
      const refreshes = await Promise.allSettled((allLeagues ?? []).map((lg: { id: string }) =>
        fetch(`${SUPABASE_URL}/functions/v1/get-league-standings`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_KEY}`,
          },
          body: JSON.stringify({ league_id: lg.id }),
        }).then((r) => {
          if (!r.ok) throw new Error(`HTTP ${r.status}`);
        })
      ));
      cacheRefreshed = refreshes.filter((r) => r.status === "fulfilled").length;
      const failedRefreshes = refreshes.length - cacheRefreshed;
      if (failedRefreshes > 0) {
        console.error(`[bridge] user_points_cache refresh: ${failedRefreshes} liga(s) fallida(s)`);
      }
    } catch (e) {
      console.error("[bridge] user_points_cache refresh error:", e);
    }
  }

  return json({ ok: true, bridged: totalBridged, groups: bridgedG, ko: bridgedK, skipped, cache_refresh: cacheRefreshed });
}

// v8: try/catch GLOBAL — un throw inesperado (shape imprevisto, lector roto)
// devolvía 500 SIN traza en logs (vivido 11-jun con el jsonb double-encoded
// de update-results v9). Ahora: stack completo a console.error + detail.
Deno.serve(async (req: Request) => {
  try {
    return await handle(req);
  } catch (e) {
    console.error("[bridge] UNCAUGHT:", e instanceof Error ? (e.stack ?? e.message) : String(e));
    return json({ error: "internal_uncaught", detail: e instanceof Error ? e.message : String(e) }, 500);
  }
});
