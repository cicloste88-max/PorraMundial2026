// supabase/functions/espn-poll/index.ts
// EF espn-poll v1.0.0 — ESPN scoreboard como fuente primaria del directo
// (12-jun-2026, post-J1). Productiza el stopgap SQL public.espn_live_poll()
// aplicado en runtime el 11-jun cuando SofaScore empezó a responder 403
// challenge al actor Apify (per-IP datacenter + fingerprint; recapture de
// cookies insuficiente).
//
// Ventajas vs el SQL de dos fases: fetch SÍNCRONO en la misma invocación
// (elimina el retardo de un ciclo de pg_net), código versionado y testeable
// (parser puro en ./parser.mjs + tests/espn-poll-parser.test.mjs) y sitio
// natural para WhatsApp (el poller SQL no notificaba).
//
// Contrato:
//   POST {}                — ciclo normal: fetch + parse + UPDATE live_scores
//                            + WhatsApp (transiciones de estado y goles nuevos).
//   POST { dry_run: true } — smoke: fetch + parse COMPLETO (incluye partidos ya
//                            finished, para diffear events/ids contra lo
//                            almacenado) SIN escrituras y SIN WhatsApp.
//   Gate X-Cron-Key fail-closed (env IA_CRON_KEY con fallback Vault vía RPC
//   get_vault_secrets — ERR-27/ERR-04), patrón update-results v8+.
//   verify_jwt=false obligatorio (ERR-16).
//
// Invariantes:
//   - NUNCA toca filas live_scores con status='finished' (el bridge ya las
//     consumió): guard en memoria + .neq('status','finished') en el UPDATE.
//   - Ids de gol ESTABLES, bit-idénticos al scheme del poller SQL (ver
//     parser.mjs): la dedup de WhatsApp compara contra events ya escritos.
//   - Escritura formato webhook Apify (mismas columnas que porra-apify-webhook).
//     Objetos JS planos a supabase-js — NUNCA JSON.stringify (jsonb
//     double-encoded crashea lectores no defensivos; vivido con update-results v9).
//
// Monitoring: scoreboard no-200 o partido en ventana (kickoff−30min..+3h)
// ausente del scoreboard ≥3 ciclos consecutivos → console.error + entrada
// {event:'espn_poll_alert'} en results.log. Contadores en
// espn_poll_state.last_note (tabla del stopgap REUTILIZADA como estado del
// poller EF; ya no se dropea).
//
// Cron: espn-poll-mundial-2026 (* * * * *) — gate SQL EXISTS: solo invoca la
// EF si hay partido mapeado no-finished en kickoff−30min..+3h.
//
// KO (~28-jun): poblar espn_event_map con los cruces + extender a
// overtime/shootout verificando el shape ESPN real antes de confiar.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { crypto as stdCrypto } from "https://deno.land/std@0.224.0/crypto/mod.ts";
import {
  buildGoalEvents,
  mapEspnStatus,
  minuteFor,
  pollIntervalFor,
  scoresFor,
} from "./parser.mjs";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

const ESPN_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/soccer/fifa.world/scoreboard";
const ESPN_TIMEOUT_MS = 8000;
const WINDOW_BEFORE_S = 1800; // kickoff − 30 min
const WINDOW_AFTER_S = 10800; // kickoff + 3 h
const MISS_ALERT_CYCLES = 3;
const TWILIO_FROM = "whatsapp:+14155238886";

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-cron-key",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, "Content-Type": "application/json" },
  });
}

// ─── Gate X-Cron-Key (verify_jwt=false → auth manual; patrón update-results) ───

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// Vault vía RPC get_vault_secrets (el schema vault no está expuesto en
// api.schemas — ERR-27). trim() obligatorio (ERR-04).
async function readVaultSecrets(names: string[]): Promise<Record<string, string>> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_vault_secrets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SERVICE_KEY,
        "Authorization": `Bearer ${SERVICE_KEY}`,
      },
      body: JSON.stringify({ secret_names: names }),
    });
    if (!res.ok) {
      console.error("[espn-poll] Vault RPC error:", res.status);
      return {};
    }
    const out: Record<string, string> = {};
    // deno-lint-ignore no-explicit-any
    for (const r of await res.json()) out[(r as any).name] = String((r as any).secret).trim();
    return out;
  } catch (e) {
    console.error("[espn-poll] Vault RPC fetch error:", e);
    return {};
  }
}

// Fail closed: sin header, o sin secreto configurado en ningún lado, nadie pasa.
async function isCronAuthorized(req: Request): Promise<boolean> {
  const provided = (req.headers.get("x-cron-key") ?? "").trim();
  if (!provided) return false;
  const expected = (Deno.env.get("IA_CRON_KEY") ?? "").trim() ||
    (await readVaultSecrets(["IA_CRON_KEY"]))["IA_CRON_KEY"] || "";
  if (!expected) return false;
  return constantTimeEq(provided, expected);
}

// ─── id estable de gol: md5 (std/crypto, wasm) sobre bytes UTF-8 ───

async function md5HexAsync(input: string): Promise<string> {
  const buf = await stdCrypto.subtle.digest("MD5", new TextEncoder().encode(input));
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, "0")).join("");
}

// ─── Notificaciones WhatsApp — textos y destinatarios de porra-apify-webhook ───

function getStatusNotification(
  prevStatus: string, newStatus: string,
  home: string, away: string,
  scoreH: number | null, scoreA: number | null,
  hadOvertime: boolean, hadPenalties: boolean,
): string | null {
  if (prevStatus === newStatus) return null;
  const s = `${home} ${scoreH ?? 0}-${scoreA ?? 0} ${away}`;
  switch (newStatus) {
    case "inprogress":
      if (prevStatus === "notstarted") return `🟢 *¡Arranca el partido!*\n${home} vs ${away}`;
      if (prevStatus === "halftime") return `🟢 *¡Segunda parte!*\n${s}`;
      return null;
    case "halftime": return `⏸ *Descanso*\n${s}`;
    case "overtime": return prevStatus === "inprogress" ? `⚡ *¡Prórroga!*\n${s}` : null;
    case "penalties": return (prevStatus === "overtime" || prevStatus === "inprogress") ? `🤽 *¡Penaltis!*\n${s}` : null;
    case "finished": {
      const how = hadPenalties ? " (penaltis)" : hadOvertime ? " (prórroga)" : "";
      return `🏁 *Fin del partido${how}*\n${s}`;
    }
    default: return null;
  }
}

function detectNewGoals(prevEvents: unknown[], newEvents: unknown[]): Record<string, unknown>[] {
  const prevIds = new Set((prevEvents as Record<string, unknown>[]).map((e) => e?.id));
  return (newEvents as Record<string, unknown>[]).filter((e) =>
    (e.incidentType === "goal" ||
      (e.incidentType === "penaltyShootout" && e.incidentClass === "scored")) &&
    !prevIds.has(e.id)
  );
}

async function sendWhatsApp(
  supabase: ReturnType<typeof createClient>,
  secrets: Record<string, string>,
  message: string,
): Promise<void> {
  const { data: subs } = await supabase.from("whatsapp_subscribers").select("phone").eq("active", true);
  if (!subs?.length) {
    console.warn("[WhatsApp] No hay suscriptores activos");
    return;
  }

  const accountSid = secrets["TWILIO_ACCOUNT_SID"];
  const apiKey = secrets["TWILIO_API_KEY"];
  const apiSecret = secrets["TWILIO_API_SECRET"];

  if (!accountSid || !apiKey || !apiSecret) {
    console.error("[WhatsApp] Faltan credenciales Twilio:", {
      hasSid: !!accountSid, hasKey: !!apiKey, hasSecret: !!apiSecret,
    });
    return;
  }

  console.log(`[WhatsApp] Enviando a ${subs.length} suscriptor(es): ${message.substring(0, 80)}`);
  const credentials = btoa(`${apiKey}:${apiSecret}`);

  await Promise.all((subs as Record<string, string>[]).map(async (sub) => {
    const params = new URLSearchParams();
    params.append("From", TWILIO_FROM);
    params.append("To", `whatsapp:${sub.phone}`);
    params.append("Body", message);
    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: "POST",
        headers: { "Authorization": `Basic ${credentials}`, "Content-Type": "application/x-www-form-urlencoded" },
        body: params.toString(),
      });
      const body = await res.text();
      if (!res.ok) console.error(`[WhatsApp] Twilio ${res.status} para ${sub.phone}:`, body.substring(0, 200));
      else console.log(`[WhatsApp] OK → ${sub.phone}`);
    } catch (e) { console.error(`[WhatsApp] Fetch error para ${sub.phone}:`, e); }
  }));
}

// ─── Trazabilidad: results.log (alertas) + espn_poll_state (estado del poller) ───

async function appendResultsLog(supa: ReturnType<typeof createClient>, entry: Record<string, unknown>) {
  try {
    const { data } = await supa.from("results").select("log").eq("id", 1).maybeSingle();
    const log: unknown[] = Array.isArray(data?.log) ? (data!.log as unknown[]) : [];
    log.push({ ts: new Date().toISOString(), ...entry });
    await supa.from("results").update({ log, updated_at: new Date().toISOString() }).eq("id", 1);
  } catch (e) {
    console.error("[espn-poll] results.log append failed:", e);
  }
}

async function savePollState(supa: ReturnType<typeof createClient>, note: Record<string, unknown>) {
  const { error } = await supa.from("espn_poll_state").update({
    last_req_id: null,
    last_run_at: new Date().toISOString(),
    last_note: { source: "espn-poll-ef", ...note },
  }).eq("id", 1);
  if (error) console.error("[espn-poll] espn_poll_state update failed:", error.message);
}

// ─── Handler ───

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
  if (!(await isCronAuthorized(req))) return json({ ok: false, error: "unauthorized" }, 401);
  if (!SUPABASE_URL || !SERVICE_KEY) return json({ ok: false, error: "missing_env" }, 500);

  let body: { dry_run?: boolean } = {};
  try { body = await req.json(); } catch { /* sin body = ciclo normal */ }
  const dryRun = body?.dry_run === true;

  const supa = createClient(SUPABASE_URL, SERVICE_KEY);
  const nowEpoch = Math.floor(Date.now() / 1000);

  // 1) Mapping + estado del poller + filas live_scores de los partidos mapeados.
  const [{ data: mapRows, error: mapErr }, { data: stateRow }] = await Promise.all([
    supa.from("espn_event_map").select("espn_event_id, match_key, inverted"),
    supa.from("espn_poll_state").select("last_note").eq("id", 1).maybeSingle(),
  ]);
  if (mapErr || !mapRows?.length) {
    return json({ ok: false, error: "espn_event_map_unavailable", detail: mapErr?.message ?? "0 filas" }, 500);
  }
  const mapByEspnId = new Map<string, { match_key: string; inverted: boolean }>();
  const espnIdByKey = new Map<string, string>();
  for (const m of mapRows as Record<string, unknown>[]) {
    mapByEspnId.set(String(m.espn_event_id), { match_key: String(m.match_key), inverted: m.inverted === true });
    espnIdByKey.set(String(m.match_key), String(m.espn_event_id));
  }

  const { data: lsRows, error: lsErr } = await supa.from("live_scores")
    .select("match_key, status, events, score_home, score_away, match_start_ts, home_team_name, away_team_name, had_overtime, had_penalties")
    .in("match_key", [...espnIdByKey.keys()]);
  if (lsErr) return json({ ok: false, error: "live_scores_query_failed", detail: lsErr.message }, 500);
  const lsByKey = new Map((lsRows ?? []).map((r) => [String((r as Record<string, unknown>).match_key), r as Record<string, unknown>]));

  // Contadores de ciclos fallidos (persistidos entre invocaciones).
  const prevNote = (stateRow?.last_note ?? {}) as Record<string, unknown>;
  const misses: Record<string, number> = { ...((prevNote.misses as Record<string, number>) ?? {}) };

  // Partidos esperados en ventana activa (para monitoring de ausencias).
  const inWindow = (lsRows ?? []).filter((r) => {
    const row = r as Record<string, unknown>;
    const ts = row.match_start_ts as number | null;
    return row.status !== "finished" && ts != null &&
      nowEpoch >= ts - WINDOW_BEFORE_S && nowEpoch <= ts + WINDOW_AFTER_S;
  }).map((r) => (r as Record<string, unknown>).match_key as string);
  const inWindowSet = new Set(inWindow);
  for (const k of Object.keys(misses)) {
    if (k !== "_http" && !inWindowSet.has(k)) delete misses[k]; // limpia contadores fuera de ventana
  }

  // 2) Fetch scoreboard ESPN (rango UTC ayer-mañana, ~40KB).
  const day = (off: number) => new Date(Date.now() + off * 86400000).toISOString().slice(0, 10).replace(/-/g, "");
  const url = `${ESPN_SCOREBOARD}?limit=50&dates=${day(-1)}-${day(1)}`;

  let sb: Record<string, unknown>;
  let httpStatus = 0;
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(ESPN_TIMEOUT_MS) });
    httpStatus = res.status;
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    sb = await res.json();
  } catch (e) {
    const n = ((misses._http as number) ?? 0) + 1;
    misses._http = n;
    console.error(`[espn-poll] scoreboard fetch FAILED (${httpStatus || "network"}), ciclo ${n}:`, e);
    if (!dryRun) {
      if (n === MISS_ALERT_CYCLES) {
        await appendResultsLog(supa, { event: "espn_poll_alert", reason: `scoreboard_http_${httpStatus || "error"}`, consecutive: n });
      }
      await savePollState(supa, { http: httpStatus || 0, misses, updated: 0, in_window: inWindow.length });
    }
    return json({ ok: false, error: "espn_fetch_failed", status: httpStatus }, 502);
  }
  delete misses._http;

  const sbEvents = Array.isArray(sb?.events) ? (sb.events as Record<string, unknown>[]) : [];
  const presentEspnIds = new Set(sbEvents.map((e) => String(e?.id ?? "")));

  // 3) Procesar cada evento mapeado del scoreboard.
  let updated = 0;
  let notified = 0;
  const processed: Record<string, unknown>[] = [];
  let twilioSecrets: Record<string, string> | null = null;

  for (const ev of sbEvents) {
    const espnId = String(ev?.id ?? "");
    const map = mapByEspnId.get(espnId);
    if (!map) continue;
    const row = lsByKey.get(map.match_key);
    if (!row) {
      console.warn(`[espn-poll] mapping sin fila live_scores: ${map.match_key}`);
      continue;
    }
    // NUNCA tocar finished (el bridge ya lo consumió). En dry_run sí se parsea
    // (sin escribir) para poder diffear events/ids contra lo almacenado.
    const alreadyFinished = row.status === "finished";
    if (alreadyFinished && !dryRun) continue;

    const comp = ((ev?.competitions as unknown[])?.[0] ?? {}) as Record<string, unknown>;
    const compStatus = (comp?.status ?? {}) as Record<string, unknown>;
    const compType = (compStatus?.type ?? {}) as Record<string, unknown>;
    const st = mapEspnStatus(compType?.state, compType?.name, compStatus?.period);
    if (!st) continue; // 'pre' → se ignora

    const minute = minuteFor(st.status, compStatus?.displayClock);
    const { scoreHome, scoreAway, homeTeamId } = scoresFor(comp?.competitors, map.inverted);
    const events = await buildGoalEvents(espnId, comp?.details, map.inverted, homeTeamId, md5HexAsync);

    // Notificaciones (mismo set que porra-apify-webhook): transición + goles nuevos.
    const prevStatus = (row.status as string) ?? "notstarted";
    const prevEvents = Array.isArray(row.events) ? (row.events as unknown[]) : [];
    const homeName = (row.home_team_name as string) ?? "Local";
    const awayName = (row.away_team_name as string) ?? "Visitante";
    const notifications: string[] = [];
    const statusMsg = getStatusNotification(
      prevStatus, st.status, homeName, awayName,
      scoreHome, scoreAway, row.had_overtime === true, row.had_penalties === true,
    );
    if (statusMsg) notifications.push(statusMsg);
    for (const goal of detectNewGoals(prevEvents, events)) {
      const scorer = ((goal.player as Record<string, unknown>)?.name as string) ?? "Desconocido";
      const goalMinute = goal.time ?? "?";
      const team = (goal.isHome ?? true) ? homeName : awayName;
      const ownGoal = goal.incidentClass === "ownGoal" ? " (p.p.)" : "";
      const pen = goal.incidentClass === "penalty" ? " (pen.)" : "";
      notifications.push(`⚽ *¡GOL de ${team}!*\n${scorer}${ownGoal}${pen} (${goalMinute}')\n${homeName} ${scoreHome ?? 0}-${scoreAway ?? 0} ${awayName}`);
    }

    if (!dryRun) {
      if (notifications.length) {
        if (!twilioSecrets) twilioSecrets = await readVaultSecrets(["TWILIO_ACCOUNT_SID", "TWILIO_API_KEY", "TWILIO_API_SECRET"]);
        for (const msg of notifications) await sendWhatsApp(supa, twilioSecrets, msg);
        notified += notifications.length;
      }
      const { error: upErr } = await supa.from("live_scores").update({
        status: st.status,
        status_code: st.code,
        minute,
        score_home: scoreHome,
        score_away: scoreAway,
        events,
        poll_active: st.active,
        poll_interval: pollIntervalFor(st.status),
        updated_at: new Date().toISOString(),
      }).eq("match_key", map.match_key).neq("status", "finished");
      if (upErr) {
        console.error(`[espn-poll][${map.match_key}] UPDATE failed:`, upErr.message);
        continue;
      }
      console.log(`[espn-poll][${map.match_key}] ${prevStatus} → ${st.status} ${scoreHome ?? "-"}-${scoreAway ?? "-"} min=${minute ?? "-"} goles=${events.length} notif=${notifications.length}`);
    }

    updated++;
    delete misses[map.match_key];
    processed.push({
      match_key: map.match_key,
      status: st.status,
      minute,
      score: `${scoreHome ?? "-"}-${scoreAway ?? "-"}`,
      new_goals: notifications.length ? detectNewGoals(prevEvents, events).length : 0,
      notifications,
      ...(dryRun ? { events, write_skipped: alreadyFinished ? "finished" : undefined } : {}),
    });
  }

  // 4) Monitoring: partido en ventana ausente del scoreboard ≥3 ciclos.
  for (const mk of inWindow) {
    const espnId = espnIdByKey.get(mk);
    if (espnId && presentEspnIds.has(espnId)) {
      delete misses[mk];
      continue;
    }
    const n = (misses[mk] ?? 0) + 1;
    misses[mk] = n;
    console.error(`[espn-poll] partido en ventana AUSENTE del scoreboard: ${mk} (ciclo ${n})`);
    if (n === MISS_ALERT_CYCLES && !dryRun) {
      await appendResultsLog(supa, { event: "espn_poll_alert", reason: "event_missing", match_key: mk, consecutive: n });
    }
  }

  if (!dryRun) {
    await savePollState(supa, { http: httpStatus, misses, updated, in_window: inWindow.length });
  }

  return json({
    ok: true,
    dry_run: dryRun,
    updated,
    notified,
    in_window: inWindow.length,
    misses,
    processed,
  });
});
