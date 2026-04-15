import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

function extractMatchState(eventData: unknown, incidents: unknown[]) {
  // Estructura: item.event.data.event = { status, homeScore, awayScore, ... }
  const ev = (((eventData as Record<string, unknown>)?.data as Record<string, unknown>)?.event ?? {}) as Record<string, unknown>;
  return {
    statusType:   ((ev?.status as Record<string, unknown>)?.type     as string) ?? 'notstarted',
    statusCode:   ((ev?.status as Record<string, unknown>)?.code     as number) ?? 0,
    minute:       ((ev?.time   as Record<string, unknown>)?.played   as number) ?? null,
    scoreHome:    ((ev?.homeScore as Record<string, unknown>)?.current    as number) ?? null,
    scoreAway:    ((ev?.awayScore as Record<string, unknown>)?.current    as number) ?? null,
    scoreAggHome: ((ev?.homeScore as Record<string, unknown>)?.aggregated as number) ?? null,
    scoreAggAway: ((ev?.awayScore as Record<string, unknown>)?.aggregated as number) ?? null,
    events:       incidents,
    referee:      ((ev?.referee  as Record<string, unknown>)?.name as string) ?? null,
    venue:        ((ev?.venue    as Record<string, unknown>)?.name as string) ?? null,
    homeTeamName: ((ev?.homeTeam as Record<string, unknown>)?.name as string) ?? 'Local',
    awayTeamName: ((ev?.awayTeam as Record<string, unknown>)?.name as string) ?? 'Visitante',
  };
}

function getNextInterval(statusType: string): number {
  switch (statusType) {
    case 'notstarted': return 300;
    case 'inprogress': return 60;
    case 'halftime':   return 120;
    case 'overtime':   return 60;
    case 'penalties':  return 30;
    case 'finished':   return 0;
    default:           return 60;
  }
}

function getStatusNotification(
  prevStatus: string, newStatus: string,
  home: string, away: string,
  scoreH: number | null, scoreA: number | null,
  hadOvertime: boolean, hadPenalties: boolean
): string | null {
  if (prevStatus === newStatus) return null;
  const s = `${home} ${scoreH ?? 0}-${scoreA ?? 0} ${away}`;
  switch (newStatus) {
    case 'inprogress':
      if (prevStatus === 'notstarted') return `🟢 *¡Arranca el partido!*\n${home} vs ${away}`;
      if (prevStatus === 'halftime')   return `🟢 *¡Segunda parte!*\n${s}`;
      return null;
    case 'halftime':  return `⏸ *Descanso*\n${s}`;
    case 'overtime':  return prevStatus === 'inprogress' ? `⚡ *¡Prórroga!*\n${s}` : null;
    case 'penalties': return (prevStatus === 'overtime' || prevStatus === 'inprogress') ? `🤽 *¡Penaltis!*\n${s}` : null;
    case 'finished': {
      const how = hadPenalties ? ' (penaltis)' : hadOvertime ? ' (prórroga)' : '';
      return `🏁 *Fin del partido${how}*\n${s}`;
    }
    default: return null;
  }
}

function detectNewGoals(prevEvents: unknown[], newEvents: unknown[]): unknown[] {
  const prevIds = new Set((prevEvents as Record<string, unknown>[]).map(e => e.id));
  return (newEvents as Record<string, unknown>[]).filter(e =>
    (e.incidentType === 'goal' ||
     (e.incidentType === 'inGamePenalty' && e.incidentClass === 'scored') ||
     (e.incidentType === 'penaltyShootout' && e.incidentClass === 'scored'))
    && !prevIds.has(e.id)
  );
}

async function sendWhatsApp(
  supabase: ReturnType<typeof createClient>,
  secrets: Record<string, string>,
  message: string
): Promise<void> {
  const { data: subs } = await supabase.from('whatsapp_subscribers').select('phone').eq('active', true);
  if (!subs?.length) {
    console.warn('[WhatsApp] No hay suscriptores activos');
    return;
  }

  const accountSid = secrets['TWILIO_ACCOUNT_SID'];
  const apiKey     = secrets['TWILIO_API_KEY'];
  const apiSecret  = secrets['TWILIO_API_SECRET'];

  if (!accountSid || !apiKey || !apiSecret) {
    console.error('[WhatsApp] Faltan credenciales Twilio:', {
      hasSid: !!accountSid,
      hasKey: !!apiKey,
      hasSecret: !!apiSecret,
      secretKeys: Object.keys(secrets),
    });
    return;
  }

  console.log(`[WhatsApp] Enviando a ${subs.length} suscriptor(es): ${message.substring(0, 80)}...`);

  const credentials = btoa(`${apiKey}:${apiSecret}`);

  await Promise.all((subs as Record<string, string>[]).map(async sub => {
    const params = new URLSearchParams();
    params.append('From', 'whatsapp:+14155238886');
    params.append('To',   `whatsapp:${sub.phone}`);
    params.append('Body', message);
    try {
      const res = await fetch(`https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`, {
        method: 'POST',
        headers: { 'Authorization': `Basic ${credentials}`, 'Content-Type': 'application/x-www-form-urlencoded' },
        body: params.toString(),
      });
      const body = await res.text();
      if (!res.ok) {
        console.error(`[WhatsApp] Twilio ${res.status} para ${sub.phone}:`, body.substring(0, 200));
      } else {
        console.log(`[WhatsApp] OK → ${sub.phone}`);
      }
    } catch (e) { console.error(`[WhatsApp] Fetch error para ${sub.phone}:`, e); }
  }));
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const url      = new URL(req.url);
  const matchKey = url.searchParams.get('match_key') ?? '';
  const secret   = url.searchParams.get('secret') ?? '';

  if (!matchKey || secret !== SUPABASE_SERVICE_KEY) {
    console.warn('[porra-apify-webhook] Auth inválida — matchKey:', matchKey);
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  let webhookBody: Record<string, unknown> = {};
  try { webhookBody = await req.json(); } catch (_) {}

  console.log('[porra-apify-webhook] Payload:', JSON.stringify(webhookBody).slice(0, 300));

  const eventType = (webhookBody.eventType as string) ?? '';
  let datasetId   = (webhookBody.datasetId as string) ?? '';
  let runId       = (webhookBody.runId     as string) ?? '';

  // FIX v6: resource está en la RAÍZ del payload de Apify, no dentro de eventData
  if (!datasetId) {
    const resource = (webhookBody.resource ?? {}) as Record<string, unknown>;
    datasetId = (resource.defaultDatasetId as string) ?? '';
    runId     = (resource.id               as string) ?? '';
  }

  console.log(`[porra-apify-webhook] matchKey:${matchKey} eventType:${eventType} runId:${runId} datasetId:${datasetId}`);

  if (eventType !== 'ACTOR.RUN.SUCCEEDED' || !datasetId) {
    console.warn(`[porra-apify-webhook] Skipped: eventType=${eventType} datasetId=${datasetId}`);
    return json({ ok: false, skipped: true, reason: eventType || 'no datasetId' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  const { data: matchRow, error: fetchErr } = await supabase
    .from('live_scores').select('*').eq('match_key', matchKey).single();

  if (fetchErr || !matchRow) {
    console.error('[porra-apify-webhook] Partido no encontrado:', matchKey);
    return json({ ok: false, error: 'Partido no encontrado' }, 404);
  }

  // Obtener secrets de Vault
  const vaultRes = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_vault_secrets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'apikey': SUPABASE_SERVICE_KEY,
    },
    body: JSON.stringify({ secret_names: ['APIFY_TOKEN', 'TWILIO_ACCOUNT_SID', 'TWILIO_API_KEY', 'TWILIO_API_SECRET'] }),
  });
  const secrets: Record<string, string> = {};
  if (!vaultRes.ok) {
    console.error('[porra-apify-webhook] Vault error:', vaultRes.status, await vaultRes.text().catch(() => ''));
  } else {
    for (const r of await vaultRes.json()) secrets[r.name] = r.secret;
  }
  console.log(`[porra-apify-webhook] Vault secrets resueltos: ${Object.keys(secrets).join(', ') || 'NINGUNO'}`);

  const apifyToken = secrets['APIFY_TOKEN'];
  if (!apifyToken) return json({ ok: false, error: 'APIFY_TOKEN no encontrado' }, 500);

  // Leer dataset del actor
  let items: unknown[] = [];
  try {
    const dsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}&format=json`);
    items = await dsRes.json();
  } catch (e) {
    console.error('[porra-apify-webhook] Error leyendo dataset:', e);
    return json({ ok: false, error: 'Error leyendo dataset' }, 500);
  }

  const item = (items as Record<string, unknown>[])?.[0] ?? {};

  // Estructura confirmada (ambos actores, live-proxy y webshare-proxy):
  // item.event     = { status, ok, data: { event: { status, homeScore, ... } } }
  // item.incidents = { status, ok, data: { incidents: [...] } }
  const eventData    = (item?.event     as Record<string, unknown>) ?? {};
  const incidentsObj = (item?.incidents as Record<string, unknown>) ?? {};
  const incidentsList = (((incidentsObj?.data as Record<string, unknown>)?.incidents) as unknown[]) ?? [];

  // Validar que el actor devolvió datos válidos
  const eventOk = (eventData?.ok as boolean) ?? false;
  if (!eventOk) {
    console.warn(`[porra-apify-webhook] Actor devolvió evento no-ok:`, JSON.stringify(eventData).slice(0, 200));
    return json({ ok: false, skipped: true, reason: 'actor returned non-ok event data' });
  }

  const state = extractMatchState(eventData, incidentsList);

  console.log(`[porra-apify-webhook] ${matchKey}: status=${state.statusType} score=${state.scoreHome ?? '-'}-${state.scoreAway ?? '-'}`);

  // Comparar con estado anterior en DB
  const prevStatus = (matchRow.status as string) ?? 'notstarted';
  const prevEvents = (matchRow.events as unknown[]) ?? [];
  const stateChanged = state.statusType !== prevStatus;
  const newHadOvertime  = state.statusType === 'overtime'  || (matchRow.had_overtime  as boolean) || false;
  const newHadPenalties = state.statusType === 'penalties' || (matchRow.had_penalties as boolean) || false;

  if (stateChanged) console.log(`[${matchKey}] ${prevStatus} → ${state.statusType}`);

  // Notificaciones WhatsApp
  const notifications: string[] = [];

  const statusMsg = getStatusNotification(
    prevStatus, state.statusType,
    state.homeTeamName, state.awayTeamName,
    state.scoreHome, state.scoreAway,
    newHadOvertime, newHadPenalties
  );
  if (statusMsg) notifications.push(statusMsg);

  if (state.statusType !== 'penalties') {
    const newGoals = detectNewGoals(prevEvents, state.events as unknown[]);
    for (const goal of newGoals as Record<string, unknown>[]) {
      const scorer  = ((goal.player as Record<string, unknown>)?.name as string) ?? 'Desconocido';
      const minute  = goal.time ?? goal.incidentTime ?? '?';
      const isHome  = goal.isHome ?? true;
      const team    = isHome ? state.homeTeamName : state.awayTeamName;
      const ownGoal = goal.incidentClass === 'ownGoal' ? ' (p.p.)' : '';
      const pen     = goal.incidentType  === 'inGamePenalty' ? ' (pen.)' : '';
      notifications.push(`⚽ *¡GOL de ${team}!*\n${scorer}${ownGoal}${pen} (${minute}')\n${state.homeTeamName} ${state.scoreHome ?? 0}-${state.scoreAway ?? 0} ${state.awayTeamName}`);
    }
  }

  for (const msg of notifications) await sendWhatsApp(supabase, secrets, msg);

  // Determinar si seguir polleando
  const pollActive = state.statusType !== 'finished';
  const nextInterval = getNextInterval(state.statusType);

  // Upsert live_scores
  await supabase.from('live_scores').upsert({
    match_key:          matchKey,
    sofascore_url:      matchRow.sofascore_url,
    sofascore_event_id: matchRow.sofascore_event_id,
    status:             state.statusType,
    status_code:        state.statusCode,
    score_home:         state.scoreHome,
    score_away:         state.scoreAway,
    score_agg_home:     state.scoreAggHome,
    score_agg_away:     state.scoreAggAway,
    events:             state.events,
    referee:            state.referee,
    venue:              state.venue,
    poll_active:        pollActive,
    poll_interval:      nextInterval,
    had_overtime:       newHadOvertime,
    had_penalties:      newHadPenalties,
    updated_at:         new Date().toISOString(),
  }, { onConflict: 'match_key' });

  console.log(`[porra-apify-webhook] ${matchKey} done: score=${state.scoreHome ?? '-'}-${state.scoreAway ?? '-'} poll_active=${pollActive} notifications=${notifications.length}`);

  return json({
    ok: true,
    matchKey,
    status: state.statusType,
    score: `${state.scoreHome ?? '-'}-${state.scoreAway ?? '-'}`,
    poll_active: pollActive,
    notifications: notifications.length,
  });
});
