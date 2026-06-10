// supabase/functions/get-league-highlights/index.ts
// Highlights "DESTACADOS DE TU LIGA" — hasta 5 insights VERDADEROS del user vs su liga.
// Versión 1.0.1 — 10-jun-2026 (1.0.1: verja de cierre mirror F4, aprobada San)
//
// Sustituye los agregados client-side de loadLeagueHighlights (data.js), que
// leían predictions/award_picks/league_members con RLS own-rows-only
// (SELECT auth.uid()=user_id): el "agregado de liga" veía como mucho la fila
// propia y montaba frases falsas (ERR-86). Aquí se agrega con service_role
// sobre el universo real y se devuelven las frases ya montadas:
// { highlights: [{ icon, text }] } (máx 5, ordenadas por impacto).
//
// Patrón F4 (get-league-predictions): verify_jwt=false a nivel deploy (ES256
// rompe verify_jwt=true, ERR-16), validación manual del JWT, verja de
// membresía del caller (y del user objetivo) en league_id, service_role para
// leer. Nunca se afirma "solo tú" sobre el resultset propio: todo cálculo
// corre sobre el universo vía service_role.
//
// Verja dura de cierre (mirror F4, Opción A): si la porra del CALLER en la
// liga NO está cerrada (is_porra_abierta(caller, league)=true), responde
// { gated: true, highlights: [] } SIN computar — las frases filtran señal
// agregada (distribuciones de signo/marcador/premio) que un caller con porra
// abierta podría usar para ajustar picks. El gate canónico es
// league_members.porra_cerrada vía RPC is_porra_abierta(uid, league_id)
// (true = abierta; NO revocar EXECUTE de authenticated — la usan policies RLS).
//
// Universo de comparación: miembros con porra COMPLETA (league_members.
// porra_cerrada=true). Si hay menos de MIN_CLOSED cerradas se amplía a
// miembros con alguna prediction; el user objetivo se incluye siempre que
// tenga predictions (sus picks se comparan contra el cohort aunque no haya
// cerrado aún).
//
// Insights (cada uno se emite solo si hay dato; orden final por impacto,
// los "solo tú" primero):
//   1 🎯 Pick más solitario (signo)  — partido con ≥MIN_VOTERS votantes donde
//        el 1/X/2 del user es el más raro (idealmente count=1).
//   2 🔥 Marcador más atrevido       — resultado exacto del user que (casi)
//        nadie más firma.
//   3 🥇 Premio a contracorriente    — dim de award_picks donde el user está
//        más solo. Dims: golden_boot/golden_ball/golden_glove/young_player.
//        champion está VACÍA (0/36 a 10-jun) — NO se usa.
//   4 🤖 Sintonía con la IA          — coincidencias de signo vs ia_predictions
//        (snapshot activo). Flip F4: si ia.home_code != wc.home_iso3 se
//        invierte 1<->2 (en grupos solo afecta a Brasil-Escocia).
//   5 ⚡ Termómetro rebelde          — ranking de signos-minoría del user en
//        la liga (reusa las distribuciones del insight 1).
//
// Bridges de match_id (idénticos a F4, verificados in vivo 72/72):
//   predictions.match_id = "{grupo}_{home_es}_{away_es}"   (legacy, español)
//   wc_matches: group_letter||'_'||home_es||'_'||away_es == predictions.match_id
//               wc_matches.match_key == ia_predictions.match_id
//   ia_predictions.match_id = "wc2026_g{grupo}_{sofascore_id}"
//
// Los keys de award_picks son el formato corto acordado (apellido sin
// diacríticos, p.ej. "Mbappe", "B. Iglesias") — legibles tal cual en la frase.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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
  base["Access-Control-Allow-Origin"] = (origin && ALLOWED_ORIGINS.has(origin)) ? origin : "*";
  return base;
}
function json(body: unknown, status: number, corsHeaders: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// ─── Caché in-memory 5 min por league|user ──────────────────────────
const TTL_MS = 5 * 60 * 1000;
// deno-lint-ignore no-explicit-any
const hlCache = new Map<string, { ts: number; data: any }>();

// Umbrales del universo: por debajo de MIN_CLOSED porras cerradas se amplía
// el universo a miembros con predictions; MIN_VOTERS escala con el universo
// (techo 8, suelo 4) para no afirmar rarezas sobre 2-3 votos.
const MIN_CLOSED = 8;
const PAGE = 1000; // max-rows de PostgREST por request → paginar predictions

function flipSign(s: string): string { return s === "1" ? "2" : s === "2" ? "1" : s; }
function signOf(local: number, visitante: number): string {
  return local > visitante ? "1" : local < visitante ? "2" : "X";
}

// predictions de la liga completa (Gallos: 17×72=1224 filas > PAGE) — paginado
// con orden estable para no perder filas por el cap de PostgREST.
// deno-lint-ignore no-explicit-any
async function fetchLeaguePredictions(supa: any, leagueId: string) {
  // deno-lint-ignore no-explicit-any
  const rows: any[] = [];
  for (let page = 0; ; page++) {
    const { data, error } = await supa
      .from("predictions")
      .select("user_id, match_id, local, visitante")
      .eq("league_id", leagueId)
      .order("user_id", { ascending: true })
      .order("match_id", { ascending: true })
      .range(page * PAGE, (page + 1) * PAGE - 1);
    if (error) throw new Error("predictions: " + error.message);
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE) break;
  }
  return rows;
}

// Nombres home/away para frases: wc_matches por legacy key; fallback al parse
// del propio match_id ("E_Alemania_Curazao" → home/away en español).
// deno-lint-ignore no-explicit-any
function matchNames(wcByLegacy: Map<string, any>, matchId: string) {
  const wc = wcByLegacy.get(matchId);
  if (wc && wc.home_es && wc.away_es) return { home: wc.home_es, away: wc.away_es };
  const parts = String(matchId).split("_");
  if (parts.length === 3) return { home: parts[1], away: parts[2] };
  return null;
}

// deno-lint-ignore no-explicit-any
async function computeHighlights(supa: any, leagueId: string, userId: string) {
  // ── Universo ──
  const { data: lm, error: lmErr } = await supa
    .from("league_members")
    .select("user_id, porra_cerrada")
    .eq("league_id", leagueId);
  if (lmErr) throw new Error("league_members: " + lmErr.message);
  const memberIds = new Set<string>((lm ?? []).map((m: { user_id: string }) => m.user_id));
  const closed = (lm ?? [])
    .filter((m: { porra_cerrada: boolean }) => m.porra_cerrada === true)
    .map((m: { user_id: string }) => m.user_id);

  const allPreds = (await fetchLeaguePredictions(supa, leagueId))
    .filter((p) => memberIds.has(p.user_id));
  const havePreds = new Set<string>(allPreds.map((p) => p.user_id));

  const universe = new Set<string>(closed);
  if (universe.size < MIN_CLOSED) for (const u of havePreds) universe.add(u);
  if (havePreds.has(userId)) universe.add(userId);
  const M = universe.size;

  // deno-lint-ignore no-explicit-any
  const candidates: any[] = [];
  if (M === 0) return { highlights: [], universe: 0 };

  // ── Distribuciones por partido (solo universo) ──
  // agg: matchId → { voters, signCounts, scoreCounts, signByUser, userScore }
  // deno-lint-ignore no-explicit-any
  const agg = new Map<string, any>();
  for (const p of allPreds) {
    if (!universe.has(p.user_id)) continue;
    if (typeof p.local !== "number" || typeof p.visitante !== "number") continue;
    let a = agg.get(p.match_id);
    if (!a) {
      a = { voters: 0, signCounts: { "1": 0, "X": 0, "2": 0 }, scoreCounts: new Map<string, number>(), signByUser: new Map<string, string>(), scoreByUser: new Map<string, string>() };
      agg.set(p.match_id, a);
    }
    const sign = signOf(p.local, p.visitante);
    const score = p.local + "-" + p.visitante;
    a.voters++;
    a.signCounts[sign]++;
    a.scoreCounts.set(score, (a.scoreCounts.get(score) ?? 0) + 1);
    a.signByUser.set(p.user_id, sign);
    a.scoreByUser.set(p.user_id, score);
  }
  const MIN_VOTERS = Math.max(4, Math.min(8, M));

  // ── wc_matches: nombres + puente IA ──
  const { data: wcRows, error: wcErr } = await supa
    .from("wc_matches")
    .select("match_key, group_letter, home_es, away_es, home_iso3");
  if (wcErr) throw new Error("wc_matches: " + wcErr.message);
  // deno-lint-ignore no-explicit-any
  const wcByLegacy = new Map<string, any>();
  for (const w of wcRows ?? []) {
    wcByLegacy.set(`${w.group_letter}_${w.home_es}_${w.away_es}`, w);
  }

  // ── Insight 1 · Pick más solitario (signo) ──
  // deno-lint-ignore no-explicit-any
  let best1: any = null;
  for (const [matchId, a] of agg) {
    if (a.voters < MIN_VOTERS) continue;
    const userSign = a.signByUser.get(userId);
    if (!userSign) continue;
    const cnt = a.signCounts[userSign];
    if (!best1 || cnt < best1.cnt || (cnt === best1.cnt && a.voters > best1.voters) ||
        (cnt === best1.cnt && a.voters === best1.voters && matchId < best1.matchId)) {
      best1 = { matchId, cnt, voters: a.voters, sign: userSign };
    }
  }
  if (best1 && (best1.cnt <= 2 || best1.cnt * 3 <= best1.voters)) {
    const nm = matchNames(wcByLegacy, best1.matchId);
    if (nm) {
      const N = best1.voters;
      let text: string;
      if (best1.cnt === 1) {
        text = best1.sign === "X"
          ? `Eres el único de ${N} que ve empate en ${nm.home}-${nm.away}.`
          : `Eres el único de ${N} que da la victoria a ${best1.sign === "1" ? nm.home : nm.away} ante ${best1.sign === "1" ? nm.away : nm.home}.`;
      } else if (best1.cnt === 2) {
        text = best1.sign === "X"
          ? `Solo tú y otro veis empate en ${nm.home}-${nm.away} (2 de ${N}).`
          : `Solo tú y otro dais la victoria a ${best1.sign === "1" ? nm.home : nm.away} ante ${best1.sign === "1" ? nm.away : nm.home} (2 de ${N}).`;
      } else {
        text = best1.sign === "X"
          ? `Solo ${best1.cnt} de ${N} veis empate en ${nm.home}-${nm.away} — tú entre ellos.`
          : `Solo ${best1.cnt} de ${N} dais la victoria a ${best1.sign === "1" ? nm.home : nm.away} ante ${best1.sign === "1" ? nm.away : nm.home} — tú entre ellos.`;
      }
      const impact = best1.cnt === 1 ? 120 + N / 100 : best1.cnt === 2 ? 90 + N / 100 : 60;
      candidates.push({ icon: "🎯", text, impact });
    }
  }

  // ── Insight 2 · Marcador más atrevido (resultado exacto) ──
  // deno-lint-ignore no-explicit-any
  let best2: any = null;
  for (const [matchId, a] of agg) {
    if (a.voters < MIN_VOTERS) continue;
    const userScore = a.scoreByUser.get(userId);
    if (!userScore) continue;
    const cnt = a.scoreCounts.get(userScore) ?? 0;
    const goals = userScore.split("-").reduce((s: number, x: string) => s + (parseInt(x, 10) || 0), 0);
    if (!best2 || cnt < best2.cnt ||
        (cnt === best2.cnt && a.voters > best2.voters) ||
        (cnt === best2.cnt && a.voters === best2.voters && goals > best2.goals) ||
        (cnt === best2.cnt && a.voters === best2.voters && goals === best2.goals && matchId < best2.matchId)) {
      best2 = { matchId, cnt, voters: a.voters, score: userScore, goals };
    }
  }
  if (best2 && best2.cnt <= 3) {
    const nm = matchNames(wcByLegacy, best2.matchId);
    if (nm) {
      const text = best2.cnt === 1
        ? `Tu ${best2.score} en ${nm.home}-${nm.away} no lo firma nadie más de tu liga.`
        : `Tu ${best2.score} en ${nm.home}-${nm.away} solo lo firmáis ${best2.cnt} de ${best2.voters}.`;
      const impact = best2.cnt === 1 ? 110 + best2.voters / 100 : 75;
      candidates.push({ icon: "🔥", text, impact });
    }
  }

  // ── Insight 3 · Premio a contracorriente (champion VACÍA — no se usa) ──
  const AWARD_DIMS = [
    { col: "golden_boot", label: "Bota de Oro", art: "la" },
    { col: "golden_ball", label: "Balón de Oro", art: "lo" },
    { col: "golden_glove", label: "Guante de Oro", art: "lo" },
    { col: "young_player", label: "Mejor Joven", art: "lo" },
  ];
  const { data: awRows, error: awErr } = await supa
    .from("award_picks")
    .select("user_id, golden_boot, golden_ball, golden_glove, young_player")
    .eq("league_id", leagueId);
  if (awErr) throw new Error("award_picks: " + awErr.message);
  const aw = (awRows ?? []).filter((r: { user_id: string }) => universe.has(r.user_id));
  const mineAw = aw.find((r: { user_id: string }) => r.user_id === userId);
  if (mineAw) {
    // deno-lint-ignore no-explicit-any
    let best3: any = null;
    for (const dim of AWARD_DIMS) {
      const myPick = (mineAw[dim.col] ?? "").toString().trim();
      if (!myPick) continue;
      const votes = aw.filter((r: Record<string, string>) => ((r[dim.col] ?? "").toString().trim()) !== "");
      const total = votes.length;
      if (total < 4) continue;
      const same = votes.filter((r: Record<string, string>) => (r[dim.col] ?? "").toString().trim() === myPick).length;
      if (!best3 || same < best3.same || (same === best3.same && total > best3.total)) {
        best3 = { dim, myPick, same, total };
      }
    }
    if (best3 && (best3.same === 1 || best3.same * 3 <= best3.total)) {
      const text = best3.same === 1
        ? `Eres el único de ${best3.total} con ${best3.myPick} como ${best3.dim.label}.`
        : `Tu ${best3.dim.label}, ${best3.myPick}, solo ${best3.dim.art === "la" ? "la" : "lo"} comparten ${best3.same - 1} de ${best3.total} contigo.`;
      const impact = best3.same === 1 ? 115 + best3.total / 100 : 70;
      candidates.push({ icon: "🥇", text, impact });
    }
  }

  // ── Insight 4 · Sintonía con la IA (snapshot activo + flip F4) ──
  try {
    const { data: snap } = await supa
      .from("ia_snapshots").select("id").eq("is_active", true).maybeSingle();
    if (snap?.id) {
      const { data: iaRows, error: iaErr } = await supa
        .from("ia_predictions")
        .select("match_id, sign, home_code")
        .eq("snapshot_id", snap.id)
        .like("match_id", "wc2026_g%");
      if (iaErr) throw new Error("ia_predictions: " + iaErr.message);
      // deno-lint-ignore no-explicit-any
      const iaByKey = new Map<string, any>();
      for (const r of iaRows ?? []) iaByKey.set(r.match_id, r);
      let total = 0, hits = 0;
      for (const [matchId, a] of agg) {
        const userSign = a.signByUser.get(userId);
        if (!userSign) continue;
        const wc = wcByLegacy.get(matchId);
        if (!wc || !wc.match_key) continue;
        const ia = iaByKey.get(wc.match_key);
        if (!ia || !ia.sign) continue;
        let iaSign = String(ia.sign).trim();
        if (wc.home_iso3 && ia.home_code && ia.home_code !== wc.home_iso3) iaSign = flipSign(iaSign);
        total++;
        if (iaSign === userSign) hits++;
      }
      if (total >= 8) {
        candidates.push({
          icon: "🤖",
          text: `Coincides con la IA en ${hits} de ${total} pronósticos de grupos; la desafías en ${total - hits}.`,
          impact: 40,
        });
      }
    }
  } catch (e) {
    console.warn("[highlights] insight IA omitido:", String(e));
  }

  // ── Insight 5 · Termómetro rebelde (signos-minoría por miembro) ──
  const contrarian = new Map<string, number>();
  const participants = new Set<string>();
  for (const [, a] of agg) {
    if (a.voters < MIN_VOTERS) continue;
    const plurality = Math.max(a.signCounts["1"], a.signCounts["X"], a.signCounts["2"]);
    for (const [uid, sign] of a.signByUser) {
      participants.add(uid);
      if (a.signCounts[sign] < plurality) {
        contrarian.set(uid, (contrarian.get(uid) ?? 0) + 1);
      }
    }
  }
  const userK = contrarian.get(userId) ?? 0;
  if (participants.has(userId) && userK > 0) {
    let rank = 1;
    for (const [uid, k] of contrarian) {
      if (uid !== userId && k > userK) rank++;
    }
    const Mr = participants.size;
    const text = rank === 1
      ? `${userK} de tus pronósticos van contra la mayoría de tu liga — eres el más atrevido de ${Mr}.`
      : `${userK} de tus pronósticos van contra la mayoría — eres el ${rank}º más atrevido de ${Mr}.`;
    candidates.push({ icon: "⚡", text, impact: rank === 1 ? 45 : 35 });
  }

  candidates.sort((a, b) => b.impact - a.impact);
  return {
    highlights: candidates.slice(0, 5).map(({ icon, text }) => ({ icon, text })),
    universe: M,
  };
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
  let body: { league_id?: string; user_id?: string };
  try { body = await req.json(); } catch { return json({ error: "invalid_json" }, 400, corsHeaders); }
  const leagueId = body?.league_id;
  if (!leagueId || typeof leagueId !== "string") return json({ error: "missing_league_id" }, 400, corsHeaders);
  const targetUid = (body?.user_id && typeof body.user_id === "string") ? body.user_id : callerUid;

  // ── Verja de membresía: caller (y objetivo, si difiere) deben ser miembros ──
  {
    const { data: m, error } = await supa
      .from("league_members").select("league_id")
      .eq("league_id", leagueId).eq("user_id", callerUid).maybeSingle();
    if (error) return json({ error: "membership_check_failed", detail: error.message }, 500, corsHeaders);
    if (!m) return json({ error: "not_a_member" }, 403, corsHeaders);
  }
  if (targetUid !== callerUid) {
    const { data: m, error } = await supa
      .from("league_members").select("league_id")
      .eq("league_id", leagueId).eq("user_id", targetUid).maybeSingle();
    if (error) return json({ error: "membership_check_failed", detail: error.message }, 500, corsHeaders);
    if (!m) return json({ error: "target_not_a_member" }, 403, corsHeaders);
  }

  // ── Verja: cierre del CALLER en esta liga (canónico vía RPC, mirror F4).
  //    El gate se evalúa por request — la caché solo guarda agregados. ──
  let open = true;
  try {
    const { data: ab, error } = await supa.rpc("is_porra_abierta", { p_user_id: callerUid, p_league_id: leagueId });
    if (error) return json({ error: "gate_check_failed", detail: error.message }, 500, corsHeaders);
    open = ab === true;
  } catch (e) { return json({ error: "gate_check_failed", detail: String(e) }, 500, corsHeaders); }

  if (open) {
    // Porra del caller ABIERTA → gated SIN computar (no filtrar señal agregada).
    return json({ gated: true, highlights: [], league_id: leagueId, user_id: targetUid, version: "1.0.1" }, 200, corsHeaders);
  }

  // ── Cerrada → insights completos (caché 5 min por league|user) ──
  const cacheKey = `${leagueId}|${targetUid}`;
  const cached = hlCache.get(cacheKey);
  if (cached && Date.now() - cached.ts < TTL_MS) {
    return json({ gated: false, league_id: leagueId, user_id: targetUid, ...cached.data, cached: true, version: "1.0.1" }, 200, corsHeaders);
  }

  try {
    const data = await computeHighlights(supa, leagueId, targetUid);
    hlCache.set(cacheKey, { ts: Date.now(), data });
    return json({ gated: false, league_id: leagueId, user_id: targetUid, ...data, version: "1.0.1" }, 200, corsHeaders);
  } catch (e) {
    return json({ error: "highlights_failed", detail: String(e) }, 500, corsHeaders);
  }
});
