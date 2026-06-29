// Versionado desde runtime el 10-jun-2026 (v6). Origen: deploy vía MCP sin commit previo.
// Fuente de verdad hasta esta fecha: runtime Supabase. A partir de ahora: este fichero.
// supabase/functions/porra-bridge-results/index.ts
// P4/D — Puente live_scores(finished) → results. BLOQUE CRITICO del torneo.
//   v10 (KO ESPN, 29-jun): la rama KO escribe SIEMPRE el resultado en cuanto el
//     partido esta finished (antes hacia bridge_skip si el empate no resolvia
//     ganador). winner = marcador a 90'/prorroga (l>v?home:v>l?away:null). En
//     empate (l===v → tanda) winner=null en Fase 1: el shape ESPN de la tanda
//     no esta verificado (TODO espn-poll), asi que NO se infiere el ganador de
//     penaltis aqui — se fija a mano hasta Fase 2. get-league-standings v1.5.1
//     puntua el marcador con l/v y SOLO el avance si winner ∈ {home,away}; con
//     winner=null el avance queda sin puntuar (correcto, no rectifica de mas).
//     Se retira koWinner (lectura score_agg/penaltyShootout estilo SofaScore);
//     Fase 2 reintroducira la deteccion de tanda contra el shape ESPN real.
//   v9 (ERR-93): playerToShortKey resuelve el nombre del feed contra el roster
//     por TOKENS normalizados (_shared/scorer-normalize.mjs), NO por substring
//     estricto. "Vinicius Junior" (feed) vs "7 · Vinicius Jr" (roster) fallaba
//     el includes y caia al ultimo token "Junior" ≠ key canonica "Vinicius" →
//     el +2 de goleador no casaba nunca. Empate por apellido compartido (2x
//     Rodriguez, Hwang/Heechan) → scorer_ambiguous, no se adivina. El fallback
//     CONSERVA LA CAJA (= v8 y picker) → re-bridge sin lockstep de deploy. El
//     matcher de scoring normaliza como defensa. Sin solape → scorer_unresolved.
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
//     - KO:     results.ko_results["{ko_match_id}"] = {l,v,scorers,winner,round,status}
//       winner = marcador (l>v?home:v>l?away). En empate (tanda) winner=null
//       en Fase 1 (ver v10) — se fija a mano hasta verificar el shape ESPN.
//   GUARDAS (no rectificar despues): solo escribe si status='finished' Y score no-null
//     Y la clave resuelve en diccionario. Si algo falla, NO escribe y lo loguea
//     en results.log. Idempotente (trigger + barrido de respaldo convergen aqui).
//
// Input (POST): { match_key?: string }. Sin match_key procesa todos los finished
// no-volcados. verify_jwt=false (auth secret==service_role).

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { matchPlayerKey, fallbackKey, resolveScorerKey } from "../_shared/scorer-normalize.mjs";

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

function playerToShortKey(nombre: string, iso3: string, oppIso3: string, eqMap: EquiposPlayersByIso3): string {
  if (!nombre) return "";
  // Resolucion por tokens normalizados contra el roster (name + key). Cubre la
  // clase-Vinicius (key != apellido: "Vinicius Junior"->Vinicius, y Son,
  // DeBruyne, VanDijk, MacAllister...) y separa Jimenez de Gimenez. ERR-97 Fix 2:
  // si cae a fallback Y ese fallback colisiona con una key PICKABLE del RIVAL, la
  // cualifica con el iso3 del goleador (SWE__Ayari) para que no haga falso-match
  // con la prediccion del jugador rival. Ver _shared/scorer-normalize.mjs.
  const r = resolveScorerKey(nombre, iso3, eqMap[iso3], eqMap[oppIso3]);
  if (r.status !== "resolved") {
    //   scorer_ambiguous  = empate entre apellidos compartidos → no adivinamos.
    //   scorer_unresolved = ningun token del roster solapo (jugador ausente).
    //   *_qualified       = fallback cualificado con iso3 por colision con rival.
    console.warn(`scorer_${r.status} iso3=${iso3} raw=${JSON.stringify(nombre)} -> ${r.key}`);
  }
  return r.key;
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
    const oppIso3 = projIsHome ? awayIso3 : homeIso3;
    const key = playerToShortKey(pname, iso3, oppIso3, eqMap);
    if (key) out.push(key);
  }
  return out;
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
    .select("match_key, status, score_home, score_away, events")
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
      // ── KO (FASE FINAL) ── round-genérico (r32→final), sin hardcodear ronda.
      // Marcador a 90'/prórroga (NO penaltis), orientado a proyecto vía teams_swapped.
      const l = dK.teams_swapped ? ls.score_away : ls.score_home;
      const v = dK.teams_swapped ? ls.score_home : ls.score_away;
      const scorers = extractScorers(ls.events, dK.home_iso3, dK.away_iso3, dK.teams_swapped, eqMap);
      // winner: el marcador decide salvo empate → tanda. En empate winner=null
      // (Fase 1): el shape ESPN de la tanda no está verificado, así que NO se
      // infiere el ganador de penaltis aquí; se fija a mano hasta Fase 2. El
      // resultado SÍ se escribe (a diferencia del skip anterior) para que el
      // marcador puntúe ya; get-league-standings solo deriva avance si
      // winner ∈ {home,away}.
      const winner: "home" | "away" | null = l > v ? "home" : (v > l ? "away" : null);
      const id = String(dK.ko_match_id);
      koResults[id] = { l, v, scorers, winner, round: dK.round, status: "finished" };
      bridgedK.push(id);
      if (winner === null) {
        log.push({ ts: nowIso, match_key: mk, event: "bridge_ko_tie_winner_pending", ko_match_id: id });
      }
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
