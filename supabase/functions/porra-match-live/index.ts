// Versionado desde runtime el 10-jun-2026 (v20). Origen: deploy vía MCP sin commit previo.
// Fuente de verdad hasta esta fecha: runtime Supabase. A partir de ahora: este fichero.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
// v18 (02jun2026): lanzador BATCHED. Acepta {match_keys:[...]} (slot) o {match_key} (single, retrocompat).
// Un solo run del actor con eventIds[] -> 1 Chromium launch para N partidos (respeta limite Apify 2-paralelo).
// El webhook v9 resuelve cada item por sofascore_event_id, por eso ya NO se pasa ?match_key= en la URL.
const ACTOR_ID = 'N8vUChlhok5JU3cnL'; // sofascore-webshare-proxy (Webshare residential rotativo)
// Fallback manual: ACTOR_ID = 'BYLtYcOxYkruVipwr' + re-deploy.

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) {}

  // Normalizar entrada: match_keys[] (batched) o match_key (single, retrocompat).
  let matchKeys: string[] = [];
  if (Array.isArray(body.match_keys)) matchKeys = (body.match_keys as unknown[]).map(String);
  else if (body.match_key) matchKeys = [String(body.match_key)];
  matchKeys = matchKeys.map((k) => k.trim()).filter(Boolean);

  if (matchKeys.length === 0) return json({ ok: false, error: 'match_key o match_keys[] requerido' }, 400);

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: rows, error: fetchErr } = await supabase
    .from('live_scores')
    .select('match_key, sofascore_event_id, poll_active, status')
    .in('match_key', matchKeys);

  if (fetchErr) return json({ ok: false, error: fetchErr.message }, 500);
  if (!rows || rows.length === 0) return json({ ok: false, error: 'Ningun partido encontrado' }, 404);

  // Filtrar: descartar finished (no relanzar) y sin eventId. Auto-activar poll_active.
  const activeRows = (rows as Record<string, unknown>[]).filter((r) => r.status !== 'finished' && r.sofascore_event_id);
  const skipped = (rows as Record<string, unknown>[])
    .filter((r) => r.status === 'finished' || !r.sofascore_event_id)
    .map((r) => ({ match_key: r.match_key, reason: r.status === 'finished' ? 'finished' : 'no eventId' }));

  if (activeRows.length === 0) {
    return json({ ok: true, skipped: true, reason: 'no hay partidos activos en el slot', detail: skipped });
  }

  // Auto-activar poll_active en los que estaban inactivos.
  const toActivate = activeRows.filter((r) => !r.poll_active).map((r) => r.match_key as string);
  if (toActivate.length > 0) {
    await supabase.from('live_scores').update({ poll_active: true }).in('match_key', toActivate);
    console.log(`[porra-match-live] Auto-activados: ${toActivate.join(', ')}`);
  }

  const eventIds = activeRows.map((r) => String(r.sofascore_event_id));

  try {
    const vaultRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_vault_secrets`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
        'apikey': SUPABASE_SERVICE_KEY,
      },
      body: JSON.stringify({ secret_names: ['APIFY_TOKEN'] }),
    });
    const secrets: Record<string, string> = {};
    for (const r of (vaultRes.ok ? await vaultRes.json() : [])) secrets[r.name] = r.secret;
    const apifyToken = secrets['APIFY_TOKEN'];
    if (!apifyToken) throw new Error('APIFY_TOKEN no encontrado en Vault');

    // Webhook SIN match_key: el webhook v9 resuelve cada item por sofascore_event_id.
    const webhookUrl = `${SUPABASE_URL}/functions/v1/porra-apify-webhook?secret=${encodeURIComponent(SUPABASE_SERVICE_KEY)}`;

    // Un solo run para todo el slot.
    const runBody = { eventIds };

    const runUrl = new URL(`https://api.apify.com/v2/acts/${ACTOR_ID}/runs`);
    runUrl.searchParams.set('token', apifyToken);
    const webhookConfig = JSON.stringify([{
      eventTypes: ['ACTOR.RUN.SUCCEEDED', 'ACTOR.RUN.FAILED'],
      requestUrl: webhookUrl,
    }]);
    runUrl.searchParams.set('webhooks', btoa(webhookConfig));

    const runRes = await fetch(runUrl.toString(), {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(runBody),
    });

    const runData = await runRes.json();
    const runId = runData?.data?.id;
    const datasetId = runData?.data?.defaultDatasetId;

    if (!runId) {
      console.error('[porra-match-live] No runId:', JSON.stringify(runData));
      return json({ ok: false, error: 'No se pudo lanzar el actor', detail: runData }, 500);
    }

    console.log(`[porra-match-live] Run batched lanzado — runId:${runId} eventIds:[${eventIds.join(',')}] (${eventIds.length} partidos)`);

    return json({
      ok: true,
      async: true,
      actor_id: ACTOR_ID,
      event_ids: eventIds,
      count: eventIds.length,
      skipped,
      run_id: runId,
      dataset_id: datasetId,
      message: 'Run batched lanzado. Resultados via webhook (resolucion por eventId).',
    });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[porra-match-live]', msg);
    return json({ ok: false, error: msg }, 500);
  }
});
