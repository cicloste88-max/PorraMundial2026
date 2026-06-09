// send-porra-receipt — Acuse de recibo (comprobante) de la porra.
//
// Cuando se cierra la porra, envía a cada usuario un email ligero (resumen +
// podio + premios + código) con un BOTÓN al comprobante completo, que se ALOJA
// en Supabase Storage (bucket público `receipts`): la chuleta íntegra de sus
// pronósticos (72 grupos + 32 KO + premios + boosts). NO es puntuación: al
// cierre aún no se ha jugado nada. Feature ADITIVA (función + tabla
// sent_receipts + 1 paso de cron). No toca el motor de puntuación ni el cierre.
//
// Auth: requireAdminOrCron (./auth.ts) — header X-Cron-Key == Vault IA_CRON_KEY,
//       o service_role, o JWT admin. verify_jwt=false en deploy (ERR-16).
//
// Body:
//   { user_id, league_id }                  → individual
//   { league_id, bulk:true }                → bulk: todos los miembros (no bots,
//                                             solo con datos) de la liga
//   { ..., to_override:"email" }            → (solo autorizado) sustituye el
//                                             destinatario; el comprobante se
//                                             construye con los datos reales del
//                                             user_id indicado. Para pruebas sin
//                                             remitente verificado en Brevo.
//
// Idempotencia: UNIQUE(user_id, league_id) en sent_receipts. 2ª llamada → skipped.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { readVaultSecret, requireAdminOrCron } from "./auth.ts";
import { buildReceiptData } from "./build-data.ts";
import { renderReceiptBody, renderReceiptHtml } from "./render.ts";

// ─── CORS ──────────────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = new Set([
  "https://porramundial2026-seven.vercel.app",
  "http://localhost:5173",
]);
function cors(origin: string | null): Record<string, string> {
  const base: Record<string, string> = {
    "Access-Control-Allow-Headers": "authorization, content-type, x-cron-key, x-client-info, apikey",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };
  base["Access-Control-Allow-Origin"] = origin && ALLOWED_ORIGINS.has(origin) ? origin : "*";
  return base;
}

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DEFAULT_FROM = "Porra Mundial 2026 <adminmundialapp@gmail.com>";
// Origen del front (Vercel) que sirve la página de render del comprobante.
const FRONT_BASE = "https://porramundial2026-seven.vercel.app";

// deno-lint-ignore no-explicit-any
function jsonResponse(body: any, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json" },
  });
}

// ─── Brevo ───────────────────────────────────────────────────────────────────
// Parsea "Name <email>" → { name, email } para el campo sender de Brevo.
function parseSender(from: string): { name: string; email: string } {
  const m = from.match(/^\s*(.*?)\s*<([^>]+)>\s*$/);
  if (m && m[2]) {
    return { name: (m[1] || "").trim() || "Porra Mundial 2026", email: m[2].trim() };
  }
  const bare = from.trim();
  if (bare.includes("@")) return { name: "Porra Mundial 2026", email: bare };
  return { name: "Porra Mundial 2026", email: "adminmundialapp@gmail.com" };
}

// apiKey = BREVO_API_KEY (llega en cfg.resendKey por compat de firma legacy).
// SIN adjunto: el comprobante completo va por hosted link (uploadReceipt, ver A).
async function sendEmail(
  apiKey: string,
  from: string,
  to: string,
  subject: string,
  bodyHtml: string,
): Promise<string> {
  const sender = parseSender(from);
  const res = await fetch("https://api.brevo.com/v3/smtp/email", {
    method: "POST",
    headers: {
      "api-key": apiKey,
      "accept": "application/json",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      sender,
      to: [{ email: to }],
      subject,
      htmlContent: bodyHtml,
    }),
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`brevo_http_${res.status}:${t.slice(0, 240)}`);
  }
  const j = await res.json().catch(() => ({}));
  return j?.messageId ?? "";
}

// ─── Supabase Storage: comprobante alojado ──────────────────────────────────
// Sube el HTML completo al bucket público `receipts` (PUT REST) y devuelve la
// URL pública. Las keys sb_secret_ exigen AMBAS cabeceras apikey + Authorization
// (gotcha conocido). Fail-loud: lanza si la respuesta no es 2xx — el caller NO
// registra sent_receipts y la EF retorna failed (sin fallback a adjunto).
//
// Content-Type = "text/html" SIN "; charset=utf-8": el bucket tiene
// allowed_mime_types=["text/html"] y storage-api (validateMimeType) compara el
// subtipo EXACTO contra la cabecera cruda — "html; charset=utf-8" !== "html"
// daría InvalidMimeType (422) y, fail-loud, abortaría todos los envíos. El
// charset es irrelevante para el render: el documento ya lleva <meta charset>.
async function uploadReceipt(
  supabaseUrl: string,
  serviceKey: string,
  filename: string,
  html: string,
): Promise<string> {
  const res = await fetch(`${supabaseUrl}/storage/v1/object/receipts/${filename}`, {
    method: "PUT",
    headers: {
      "apikey": serviceKey,
      "Authorization": `Bearer ${serviceKey}`,
      "Content-Type": "text/html",
      "x-upsert": "true",
    },
    body: html,
  });
  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`storage_http_${res.status}:${t.slice(0, 240)}`);
  }
  return `${supabaseUrl}/storage/v1/object/public/receipts/${filename}`;
}

interface SendConfig {
  resendKey: string; // legacy: el campo se mantiene pero contiene la BREVO_API_KEY
  from: string;
  supabaseUrl: string;
  serviceKey: string;
}

interface ProcessResult {
  user_id: string;
  status: "sent" | "skipped" | "no_data" | "failed";
  email?: string | null;
  resend_id?: string;
  code?: string;
  error?: string;
  receipt_url?: string;
}

// deno-lint-ignore no-explicit-any
async function processReceipt(
  supa: any,
  userId: string,
  leagueId: string,
  toOverride: string | null,
  cfg: SendConfig,
): Promise<ProcessResult> {
  // 1. Idempotencia: ¿ya enviado para (user, league)?
  const { data: existing, error: exErr } = await supa
    .from("sent_receipts")
    .select("email")
    .eq("user_id", userId)
    .eq("league_id", leagueId)
    .maybeSingle();
  if (exErr) return { user_id: userId, status: "failed", error: `lookup:${exErr.message}` };
  if (existing) return { user_id: userId, status: "skipped", email: existing.email };

  // 2. Construir el comprobante con los datos REALES del user.
  let data;
  try {
    data = await buildReceiptData(supa, userId, leagueId);
  } catch (e) {
    return { user_id: userId, status: "failed", error: String((e as Error)?.message || e) };
  }
  if (!data) return { user_id: userId, status: "no_data" };

  // 3. Destinatario: override (autorizado) o email real del usuario.
  const recipient = toOverride || data.userEmail;
  if (!recipient || !EMAIL_RE.test(recipient)) {
    return { user_id: userId, status: "failed", error: "no_recipient_email" };
  }

  // 4. Render del comprobante completo + alojamiento en Storage + envío.
  if (!cfg.resendKey) {
    return { user_id: userId, status: "failed", error: "resend_key_missing" };
  }
  const fullHtml = renderReceiptHtml(data); // comprobante completo (se aloja)

  // 4a. Subir a Storage. Nombre NO adivinable: code + slice de UUID. Fail-loud:
  //     si la subida falla NO se envía ni se registra (sin fallback a adjunto).
  const filename = `${data.verificationCode}-${crypto.randomUUID().slice(0, 8)}.html`;
  let storageUrl: string;
  try {
    storageUrl = await uploadReceipt(cfg.supabaseUrl, cfg.serviceKey, filename, fullHtml);
  } catch (e) {
    return { user_id: userId, status: "failed", error: String((e as Error)?.message || e) };
  }
  // URL pública para el cliente = página del front (Vercel) que renderiza el
  // comprobante. NO se enlaza ni Storage ni la EF directamente: Supabase fuerza
  // text/html → text/plain + CSP sandbox (anti-phishing) tanto en Storage como en
  // Functions, así que el HTML se pinta client-side. comprobante.html hace fetch
  // a get-receipt (que resuelve code → storageUrl) y lo inyecta en un <iframe
  // srcdoc>. Es función pura del code, no hace falta guardarla.
  const viewUrl = `${FRONT_BASE}/comprobante.html?code=${data.verificationCode}`;
  data.receiptUrl = viewUrl; // el cuerpo lleva el botón → página de render

  // 4b. Cuerpo ejecutivo ligero (con botón al comprobante) + envío SIN adjunto.
  const bodyHtml = renderReceiptBody(data);
  const subject = `Comprobante de tu porra · ${data.leagueName}`;
  let resendId = "";
  try {
    resendId = await sendEmail(cfg.resendKey, cfg.from, recipient, subject, bodyHtml);
  } catch (e) {
    return { user_id: userId, status: "failed", error: String((e as Error)?.message || e) };
  }

  // 5. Registrar el envío (idempotencia + auditoría). Guarda receipt_url.
  const { error: insErr } = await supa.from("sent_receipts").insert({
    user_id: userId,
    league_id: leagueId,
    email: recipient,
    resend_id: resendId || null,
    meta: {
      code: data.verificationCode,
      counts: data.counts,
      override: !!toOverride,
      receipt_url: storageUrl, // URL de Storage que get-receipt resuelve y proxya
    },
  });
  if (insErr) {
    // El email ya salió; un conflicto aquí (carrera) es benigno.
    console.warn(`sent_receipts insert warn user=${userId}: ${insErr.message}`);
  }

  return {
    user_id: userId,
    status: "sent",
    email: recipient,
    resend_id: resendId,
    code: data.verificationCode,
    receipt_url: viewUrl,
  };
}

serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return jsonResponse({ error: "method_not_allowed" }, 405, origin);

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) return jsonResponse({ error: "missing_env" }, 500, origin);

  // deno-lint-ignore no-explicit-any
  let supa: any;
  try {
    supa = createClient(SUPABASE_URL, SERVICE_KEY);
  } catch (e) {
    console.error("supa_init_error:", String((e as Error)?.message || e));
    return jsonResponse({ error: "internal" }, 500, origin);
  }

  // ── Auth: admin / cron-key (IA_CRON_KEY) / service_role ──────────────────
  try {
    await requireAdminOrCron(req, supa);
  } catch (e) {
    const msg = String((e as Error)?.message || e);
    if (msg === "forbidden") return jsonResponse({ error: "forbidden" }, 403, origin);
    return jsonResponse({ error: "unauthorized" }, 401, origin);
  }

  // ── Body ──────────────────────────────────────────────────────────────────
  const body = await req.json().catch(() => ({}));
  const leagueId: string | undefined = body?.league_id;
  const userId: string | undefined = body?.user_id;
  const bulk: boolean = body?.bulk === true;
  const toOverrideRaw: string | undefined = body?.to_override;

  if (!leagueId || typeof leagueId !== "string") {
    return jsonResponse({ error: "missing_league_id" }, 400, origin);
  }
  let toOverride: string | null = null;
  if (toOverrideRaw != null && String(toOverrideRaw).trim() !== "") {
    const candidate = String(toOverrideRaw).trim();
    if (!EMAIL_RE.test(candidate)) {
      return jsonResponse({ error: "bad_to_override" }, 400, origin);
    }
    toOverride = candidate; // honrado: la request ya pasó requireAdminOrCron
  }

  // ── Config Brevo (env → Vault → fallback from) ───────────────────────────
  // resendKey = nombre legacy del campo; contiene la BREVO_API_KEY.
  const resendKey =
    (Deno.env.get("BREVO_API_KEY") || "").trim() ||
    (await readVaultSecret(SUPABASE_URL, SERVICE_KEY, "BREVO_API_KEY")) ||
    "";
  const from =
    (Deno.env.get("PORRA_FROM_EMAIL") || "").trim() ||
    (await readVaultSecret(SUPABASE_URL, SERVICE_KEY, "PORRA_FROM_EMAIL")) ||
    DEFAULT_FROM;
  const cfg: SendConfig = { resendKey, from, supabaseUrl: SUPABASE_URL, serviceKey: SERVICE_KEY };

  // ── BULK ────────────────────────────────────────────────────────────────
  if (bulk) {
    const { data: members, error: mErr } = await supa
      .from("league_members").select("user_id").eq("league_id", leagueId);
    if (mErr) return jsonResponse({ error: "members_query_failed", detail: mErr.message }, 500, origin);
    const ids: string[] = (members ?? []).map((m: { user_id: string }) => m.user_id);

    // Excluir bots (email ficticio ia-bot@…local rebotaría).
    const { data: profs } = await supa.from("profiles").select("id, is_bot").in(
      "id",
      ids.length ? ids : ["00000000-0000-0000-0000-000000000000"],
    );
    const botSet = new Set((profs ?? []).filter((p: { is_bot: boolean }) => p.is_bot).map((p: { id: string }) => p.id));
    const targets = ids.filter((id) => !botSet.has(id));

    const results: ProcessResult[] = [];
    for (const id of targets) {
      results.push(await processReceipt(supa, id, leagueId, toOverride, cfg));
      // Throttle suave para no chocar con el rate-limit de Brevo.
      await new Promise((r) => setTimeout(r, 350));
    }
    const tally = {
      sent: results.filter((r) => r.status === "sent").length,
      skipped: results.filter((r) => r.status === "skipped").length,
      no_data: results.filter((r) => r.status === "no_data").length,
      failed: results.filter((r) => r.status === "failed").length,
    };
    return jsonResponse(
      { ok: tally.failed === 0, bulk: true, league_id: leagueId, members: targets.length, tally, results },
      200,
      origin,
    );
  }

  // ── INDIVIDUAL ────────────────────────────────────────────────────────────
  if (!userId || typeof userId !== "string") {
    return jsonResponse({ error: "missing_user_id" }, 400, origin);
  }
  const result = await processReceipt(supa, userId, leagueId, toOverride, cfg);
  const httpStatus = result.status === "failed"
    ? (result.error === "resend_key_missing" ? 500 : 502)
    : 200;
  return jsonResponse({ ok: result.status !== "failed", ...result }, httpStatus, origin);
});
