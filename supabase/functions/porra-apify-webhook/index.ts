// Versionado desde runtime el 10-jun-2026 (v11). Origen: deploy vía MCP sin commit previo.
// Fuente de verdad hasta esta fecha: runtime Supabase. A partir de ahora: este fichero.
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

// Taxonomía verificada en vivo (BRA-PAN 02-jun): el penalti es incidentType:'goal' +
// incidentClass:'penalty', NO 'inGamePenalty'. ownGoal cuenta en marcador (vía event)
// pero NO se anuncia como gol del autor. penaltyShootout:'scored' se conserva para KO.
function detectNewGoals(prevEvents: unknown[], newEvents: unknown[]): unknown[] {
  const prevIds = new Set((prevEvents as Record<string, unknown>[]).map(e => e.id));
  return (newEvents as Record<string, unknown>[]).filter(e =>
    (e.incidentType === 'goal' ||
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
      hasSid: !!accountSid, hasKey: !!apiKey, hasSecret: !!apiSecret,
      secretKeys: Object.keys(secrets),
    });
    return;
  }

  console.log(`[WhatsApp] Enviando a ${subs.length} suscriptor(es): ${message.substring(0, 80)}`);
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
      if (!res.ok) console.error(`[WhatsApp] Twilio ${res.status} para ${sub.phone}:`, body.substring(0, 200));
      else console.log(`[WhatsApp] OK → ${sub.phone}`);
    } catch (e) { console.error(`[WhatsApp] Fetch error para ${sub.phone}:`, e); }
  }));
}

// Procesa UN item del dataset (un partido) de forma independiente.
// Resuelve match_key por sofascore_event_id (fallback: urlMatchKey de la query).
async function processItem(
  supabase: ReturnType<typeof createClient>,
  secrets: Record<string, string>,
  item: Record<string, unknown>,
  urlMatchKey: string,
): Promise<Record<string, unknown>> {
  const eventId      = item?.eventId != null ? String(item.eventId) : '';
  const eventData    = (item?.event     as Record<string, unknown>) ?? {};
  const incidentsObj = (item?.incidents as Record<string, unknown>) ?? {};
  const incidentsList = (((incidentsObj?.data as Record<string, unknown>)?.incidents) as unknown[]) ?? [];

  const eventOk = (eventData?.ok as boolean) ?? false;
  if (!eventOk) {
    console.warn(`[v9] item eventId=${eventId}: evento no-ok, skip`);
    return { eventId, skipped: true, reason: 'non-ok event' };
  }

  // Resolver el partido. Preferencia: sofascore_event_id == item.eventId.
  let matchRow: Record<string, unknown> | null = null;
  if (eventId) {
    const { data } = await supabase.from('live_scores').select('*').eq('sofascore_event_id', eventId).maybeSingle();
    matchRow = (data as Record<string, unknown>) ?? null;
  }
  // Fallback: match_key de la URL (retrocompat con disparo single).
  if (!matchRow && urlMatchKey) {
    const { data } = await supabase.from('live_scores').select('*').eq('match_key', urlMatchKey).maybeSingle();
    matchRow = (data as Record<string, unknown>) ?? null;
  }
  if (!matchRow) {
    console.error(`[v9] No se resolvió match para eventId=${eventId} urlMatchKey=${urlMatchKey}`);
    return { eventId, skipped: true, reason: 'match not found' };
  }

  const matchKey = matchRow.match_key as string;
  const state = extractMatchState(eventData, incidentsList);

  const prevStatus = (matchRow.status as string) ?? 'notstarted';
  const prevEvents = (matchRow.events as unknown[]) ?? [];
  const newHadOvertime  = state.statusType === 'overtime'  || (matchRow.had_overtime  as boolean) || false;
  const newHadPenalties = state.statusType === 'penalties' || (matchRow.had_penalties as boolean) || false;

  if (state.statusType !== prevStatus) console.log(`[v9][${matchKey}] ${prevStatus} → ${state.statusType}`);

  const notifications: string[] = [];
  const statusMsg = getStatusNotification(
    prevStatus, state.statusType, state.homeTeamName, state.awayTeamName,
    state.scoreHome, state.scoreAway, newHadOvertime, newHadPenalties
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
      const pen     = goal.incidentClass === 'penalty' ? ' (pen.)' : '';
      notifications.push(`⚽ *¡GOL de ${team}!*\n${scorer}${ownGoal}${pen} (${minute}')\n${state.homeTeamName} ${state.scoreHome ?? 0}-${state.scoreAway ?? 0} ${state.awayTeamName}`);
    }
  }

  for (const msg of notifications) await sendWhatsApp(supabase, secrets, msg);

  const pollActive = state.statusType !== 'finished';
  const nextInterval = getNextInterval(state.statusType);

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

  console.log(`[v9][${matchKey}] done: score=${state.scoreHome ?? '-'}-${state.scoreAway ?? '-'} status=${state.statusType} notif=${notifications.length}`);

  return {
    eventId, matchKey, status: state.statusType,
    score: `${state.scoreHome ?? '-'}-${state.scoreAway ?? '-'}`,
    poll_active: pollActive, notifications: notifications.length,
  };
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const url         = new URL(req.url);
  const urlMatchKey = url.searchParams.get('match_key') ?? ''; // fallback opcional
  const secret      = url.searchParams.get('secret') ?? '';

  if (secret !== SUPABASE_SERVICE_KEY) {
    console.warn('[v9] Auth inválida');
    return json({ ok: false, error: 'Unauthorized' }, 401);
  }

  let webhookBody: Record<string, unknown> = {};
  try { webhookBody = await req.json(); } catch (_) {}

  const eventType = (webhookBody.eventType as string) ?? '';
  let datasetId   = (webhookBody.datasetId as string) ?? '';
  let runId       = (webhookBody.runId     as string) ?? '';
  if (!datasetId) {
    const resource = (webhookBody.resource ?? {}) as Record<string, unknown>;
    datasetId = (resource.defaultDatasetId as string) ?? '';
    runId     = (resource.id               as string) ?? '';
  }

  console.log(`[v9] eventType:${eventType} runId:${runId} datasetId:${datasetId} urlMatchKey:${urlMatchKey}`);

  if (eventType !== 'ACTOR.RUN.SUCCEEDED' || !datasetId) {
    return json({ ok: false, skipped: true, reason: eventType || 'no datasetId' });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  // Vault secrets (una vez para todo el batch)
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
  if (!vaultRes.ok) console.error('[v9] Vault error:', vaultRes.status, await vaultRes.text().catch(() => ''));
  else for (const r of await vaultRes.json()) secrets[r.name] = r.secret;

  const apifyToken = secrets['APIFY_TOKEN'];
  if (!apifyToken) return json({ ok: false, error: 'APIFY_TOKEN no encontrado' }, 500);

  // Leer dataset (N items, uno por eventId)
  let items: Record<string, unknown>[] = [];
  try {
    const dsRes = await fetch(`https://api.apify.com/v2/datasets/${datasetId}/items?token=${apifyToken}&format=json`);
    items = await dsRes.json();
  } catch (e) {
    console.error('[v9] Error leyendo dataset:', e);
    return json({ ok: false, error: 'Error leyendo dataset' }, 500);
  }

  if (!Array.isArray(items) || items.length === 0) {
    return json({ ok: false, skipped: true, reason: 'dataset vacío' });
  }

  console.log(`[v9] dataset items=${items.length}`);

  // Procesar cada partido de forma independiente. Un fallo aislado no tumba el resto.
  const results: Record<string, unknown>[] = [];
  for (const item of items) {
    try {
      results.push(await processItem(supabase, secrets, item, urlMatchKey));
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error('[v9] processItem error:', msg);
      results.push({ eventId: item?.eventId ?? null, error: msg });
    }
  }

  return json({ ok: true, processed: results.length, results });
});
