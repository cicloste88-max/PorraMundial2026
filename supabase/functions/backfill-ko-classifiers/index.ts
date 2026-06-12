// backfill-ko-classifiers v1.0.0 — rellena ko_predictions.classifier inferido
// del marcador cuando está NULL y hay ganador claro (local != visitante).
//
// Contexto (BRIEF_BACKFILL_KO_CLASSIFIERS): saveKO() del frontend solo persistía
// classifier en empates (la UI solo lo pide ahí). En partidos con ganador por
// marcador quedaba null → PDF del comprobante con "Avanza: —" y scoring KO sin
// poder puntuar avances. Este backfill reconstruye el bracket dinámico de cada
// usuario (réplica del frontend en logic.mjs) y rellena los null inferibles.
//
// Idempotente: NO toca valores no-null (los empates con elección explícita del
// usuario se preservan). Re-ejecutar es no-op (rows_updated=0).
//
// Auth: requireAdminOrCron (./auth.ts) — X-Cron-Key == Vault IA_CRON_KEY, o
//       service_role, o JWT admin. verify_jwt=false en deploy (ERR-16).
//
// Body:
//   { league_id: "<uuid>", dry_run?: boolean }   // dry_run default TRUE:
//                                                 // escribir exige dry_run:false
//
// Response: { ok, league_id, dry_run, processed_users, rows_updated,
//             by_user: [{ user_id, nombre, is_bot, before_null, after_null, updated, skipped }],
//             warnings: [{ user_id, slot?, reason, note? }], errors: [] }

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import { requireAdminOrCron } from "./auth.ts";
import { inferClassifiers } from "./logic.mjs";

const VERSION = "1.0.0";

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

// deno-lint-ignore no-explicit-any
function jsonResponse(body: any, status: number, origin: string | null): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors(origin), "Content-Type": "application/json" },
  });
}

const isNullClassifier = (c: unknown) =>
  c === null || c === undefined || String(c).trim() === "";

serve(async (req: Request) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") {
    return jsonResponse({ ok: false, error: "method_not_allowed" }, 405, origin);
  }

  const supa = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    await requireAdminOrCron(req, supa);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "unauthorized";
    return jsonResponse({ ok: false, error: msg }, msg === "forbidden" ? 403 : 401, origin);
  }

  let body: { league_id?: string; dry_run?: boolean };
  try {
    body = await req.json();
  } catch {
    return jsonResponse({ ok: false, error: "invalid_json_body" }, 400, origin);
  }
  const leagueId = body.league_id;
  if (!leagueId || typeof leagueId !== "string") {
    return jsonResponse({ ok: false, error: "league_id_required" }, 400, origin);
  }
  // Default conservador: solo escribe con dry_run === false explícito.
  const dryRun = body.dry_run !== false;

  // deno-lint-ignore no-explicit-any
  const byUser: any[] = [];
  // deno-lint-ignore no-explicit-any
  const warnings: any[] = [];
  // deno-lint-ignore no-explicit-any
  const errors: any[] = [];
  let rowsUpdated = 0;

  try {
    // Usuarios con ko_predictions en la liga (incluye bots: el scoring KO
    // también los puntúa; se reportan con is_bot para distinguirlos).
    const { data: koUserRows, error: koUsersErr } = await supa
      .from("ko_predictions")
      .select("user_id")
      .eq("league_id", leagueId);
    if (koUsersErr) throw new Error(`ko_predictions users: ${koUsersErr.message}`);
    const userIds = [...new Set((koUserRows ?? []).map((r: { user_id: string }) => r.user_id))];

    if (userIds.length === 0) {
      return jsonResponse({
        ok: true, version: VERSION, league_id: leagueId, dry_run: dryRun,
        processed_users: 0, rows_updated: 0, by_user: [], warnings: [], errors: [],
      }, 200, origin);
    }

    const { data: profiles, error: profErr } = await supa
      .from("profiles")
      .select("id, nombre, is_bot")
      .in("id", userIds);
    if (profErr) throw new Error(`profiles: ${profErr.message}`);
    const profById = new Map((profiles ?? []).map((p: { id: string }) => [p.id, p]));

    for (const userId of userIds) {
      const prof = profById.get(userId) as { nombre?: string; is_bot?: boolean } | undefined;
      const nombre = prof?.nombre ?? "(sin perfil)";
      const isBot = prof?.is_bot === true;
      try {
        // Por-usuario para no rozar el límite de filas de PostgREST (72×N).
        const [{ data: preds, error: pErr }, { data: koRows, error: kErr }] = await Promise.all([
          supa.from("predictions")
            .select("match_id, local, visitante")
            .eq("league_id", leagueId).eq("user_id", userId),
          supa.from("ko_predictions")
            .select("match_id, local, visitante, classifier, scorer")
            .eq("league_id", leagueId).eq("user_id", userId),
        ]);
        if (pErr) throw new Error(`predictions: ${pErr.message}`);
        if (kErr) throw new Error(`ko_predictions: ${kErr.message}`);

        const predsByKey: Record<string, { l: number | null; v: number | null }> = {};
        (preds ?? []).forEach((r: { match_id: string; local: number | null; visitante: number | null }) => {
          predsByKey[r.match_id] = { l: r.local, v: r.visitante };
        });

        const beforeNull = (koRows ?? []).filter((r: { classifier: unknown }) => isNullClassifier(r.classifier)).length;
        const { updates, warnings: userWarnings, skipped } = inferClassifiers(predsByKey, koRows ?? []);
        userWarnings.forEach((w: Record<string, unknown>) => warnings.push({ user_id: userId, nombre, ...w }));

        if (!dryRun && updates.length > 0) {
          const koById = new Map((koRows ?? []).map((r: { match_id: number }) => [Number(r.match_id), r]));
          const upsertRows = updates.map((u: { match_id: number; classifier: string }) => {
            const row = koById.get(u.match_id) as { local: number; visitante: number; scorer: string | null };
            return {
              user_id: userId,
              league_id: leagueId,
              match_id: u.match_id,
              local: row.local,
              visitante: row.visitante,
              classifier: u.classifier,
              scorer: row.scorer ?? null,
            };
          });
          const { error: upErr } = await supa
            .from("ko_predictions")
            .upsert(upsertRows, { onConflict: "league_id,user_id,match_id" });
          if (upErr) throw new Error(`upsert: ${upErr.message}`);
        }

        const updated = updates.length;
        rowsUpdated += updated;
        byUser.push({
          user_id: userId,
          nombre,
          is_bot: isBot,
          skipped: skipped === true,
          before_null: beforeNull,
          after_null: beforeNull - updated,
          updated,
        });
      } catch (e) {
        errors.push({ user_id: userId, nombre, error: e instanceof Error ? e.message : String(e) });
      }
    }

    byUser.sort((a, b) => String(a.nombre).localeCompare(String(b.nombre)));

    return jsonResponse({
      ok: errors.length === 0,
      version: VERSION,
      league_id: leagueId,
      dry_run: dryRun,
      processed_users: byUser.length,
      rows_updated: rowsUpdated,
      by_user: byUser,
      warnings,
      errors,
    }, 200, origin);
  } catch (e) {
    return jsonResponse({
      ok: false,
      version: VERSION,
      error: e instanceof Error ? e.message : String(e),
    }, 500, origin);
  }
});
