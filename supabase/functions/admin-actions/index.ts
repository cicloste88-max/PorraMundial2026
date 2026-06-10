// Versionado desde runtime el 10-jun-2026 (v10). Origen: deploy vía MCP sin commit previo.
// Fuente de verdad hasta esta fecha: runtime Supabase. A partir de ahora: este fichero.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const SUPABASE_ANON_KEY    = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const CRON_JOB_NAME = 'update-results-job';
const CRON_SCHEDULE = '*/5 * * * *';
const CRON_COMMAND  = `SELECT net.http_post(url:='${SUPABASE_URL}/functions/v1/update-results', headers:='{"Authorization": "Bearer ${SUPABASE_ANON_KEY}", "apikey": "${SUPABASE_ANON_KEY}"}', body:='{}') AS request_id;`;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

async function resetPorraCerrada(svc: ReturnType<typeof createClient>, userId: string, leagueId: string) {
  await svc.from('league_members')
    .update({ porra_cerrada: false, cerrada_at: null })
    .eq('user_id', userId)
    .eq('league_id', leagueId);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace('Bearer ', '').trim();
  if (!jwt) return json({ ok: false, error: 'No autorizado: falta JWT' }, 401);

  const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: { user }, error: authErr } = await svc.auth.getUser(jwt);
  if (authErr || !user) return json({ ok: false, error: 'JWT invalido o expirado' }, 401);

  const { data: profile } = await svc.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) return json({ ok: false, error: 'Acceso denegado' }, 403);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) {}
  const action = (body.action as string) ?? '';

  try {
    switch (action) {

      // ── CRON ──────────────────────────────────────────────────────────────
      case 'cron_status': {
        const { data, error } = await svc.rpc('execute_sql', { query: `SELECT jobname, schedule, active, jobid FROM cron.job WHERE jobname = '${CRON_JOB_NAME}'` });
        if (error) return json({ ok: true, data: null, note: error.message });
        return json({ ok: true, data });
      }
      case 'cron_pause': {
        const { error } = await svc.rpc('execute_sql', { query: `SELECT cron.unschedule('${CRON_JOB_NAME}')` });
        if (error) throw error;
        return json({ ok: true, message: 'pg_cron pausado' });
      }
      case 'cron_resume': {
        const { error } = await svc.rpc('execute_sql', { query: `SELECT cron.schedule('${CRON_JOB_NAME}', '${CRON_SCHEDULE}', $$${CRON_COMMAND}$$)` });
        if (error) throw error;
        return json({ ok: true, message: 'pg_cron activado (cada 5 min)' });
      }

      // ── SYNC ──────────────────────────────────────────────────────────────
      case 'force_sync': {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/update-results`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}`, 'apikey': SUPABASE_ANON_KEY, 'Content-Type': 'application/json' },
          body: '{}',
        });
        return json({ ok: res.ok, data: await res.json() });
      }

      // ── RESULTS ───────────────────────────────────────────────────────────
      case 'get_results': {
        const { data, error } = await svc.from('results').select('*').eq('id', 1).maybeSingle();
        if (error) throw error;
        return json({ ok: true, data });
      }
      case 'set_override': {
        const matchKey = body.match_key as string;
        const l = body.l as number, v = body.v as number;
        if (!matchKey || l === undefined || v === undefined) throw new Error('Faltan parametros: match_key, l, v');
        const { data: res } = await svc.from('results').select('match_results,overrides').eq('id', 1).maybeSingle();
        const matchResults = res?.match_results ? JSON.parse(res.match_results as string) : {};
        const overrides    = res?.overrides     ? JSON.parse(res.overrides as string)     : {};
        matchResults[matchKey] = { l, v }; overrides[matchKey] = true;
        const { error } = await svc.from('results').upsert({ id: 1, match_results: JSON.stringify(matchResults), overrides: JSON.stringify(overrides), updated_at: new Date().toISOString() }, { onConflict: 'id' });
        if (error) throw error;
        return json({ ok: true, message: `Override guardado: ${matchKey} ${l}-${v}` });
      }
      case 'clear_override': {
        const matchKey = body.match_key as string;
        if (!matchKey) throw new Error('Falta match_key');
        const { data: res } = await svc.from('results').select('match_results,overrides').eq('id', 1).maybeSingle();
        const matchResults = res?.match_results ? JSON.parse(res.match_results as string) : {};
        const overrides    = res?.overrides     ? JSON.parse(res.overrides as string)     : {};
        delete matchResults[matchKey]; delete overrides[matchKey];
        const { error } = await svc.from('results').upsert({ id: 1, match_results: JSON.stringify(matchResults), overrides: JSON.stringify(overrides), updated_at: new Date().toISOString() }, { onConflict: 'id' });
        if (error) throw error;
        return json({ ok: true, message: `Override eliminado: ${matchKey}` });
      }
      case 'clear_all_overrides': {
        const { data: res } = await svc.from('results').select('match_results,overrides').eq('id', 1).maybeSingle();
        const matchResults = res?.match_results ? JSON.parse(res.match_results as string) : {};
        const overrides    = res?.overrides     ? JSON.parse(res.overrides as string)     : {};
        Object.keys(overrides).forEach(key => delete matchResults[key]);
        const { error } = await svc.from('results').upsert({ id: 1, match_results: JSON.stringify(matchResults), overrides: JSON.stringify({}), updated_at: new Date().toISOString() }, { onConflict: 'id' });
        if (error) throw error;
        return json({ ok: true, message: 'Todos los overrides eliminados' });
      }
      case 'reset_results': {
        const { error } = await svc.from('results').delete().eq('id', 1);
        if (error) throw error;
        return json({ ok: true, message: 'Tabla results reseteada' });
      }
      case 'set_award_winners': {
        const winners = body.winners as Record<string, string>;
        if (!winners) throw new Error('Falta campo winners');
        const { data: res } = await svc.from('results').select('*').eq('id', 1).maybeSingle();
        const { error } = await svc.from('results').upsert({ id: 1, ...(res ?? {}), award_winners: JSON.stringify(winners), updated_at: new Date().toISOString() }, { onConflict: 'id' });
        if (error) throw error;
        return json({ ok: true, message: 'Premios guardados' });
      }

      // ── STATS ─────────────────────────────────────────────────────────────
      case 'get_stats': {
        const [{ count: users }, { count: preds }, { count: koPreds }, { count: awards }, { count: leaguesCount }, { count: membersCount }] = await Promise.all([
          svc.from('profiles').select('*', { count: 'exact', head: true }),
          svc.from('predictions').select('*', { count: 'exact', head: true }),
          svc.from('ko_predictions').select('*', { count: 'exact', head: true }),
          svc.from('award_picks').select('*', { count: 'exact', head: true }),
          svc.from('leagues').select('*', { count: 'exact', head: true }),
          svc.from('league_members').select('*', { count: 'exact', head: true }),
        ]);
        const { data: res } = await svc.from('results').select('match_results,overrides,updated_at').eq('id', 1).maybeSingle();
        const matchResults = res?.match_results ? JSON.parse(res.match_results as string) : {};
        const overrides    = res?.overrides     ? JSON.parse(res.overrides as string)     : {};
        return json({ ok: true, data: { users, predictions: preds, ko_predictions: koPreds, award_picks: awards, leagues: leaguesCount, league_members: membersCount, results_count: Object.keys(matchResults).length, overrides_count: Object.keys(overrides).length, last_sync: res?.updated_at ?? null }});
      }

      // ── USERS (con filtro por liga) ────────────────────────────────────────
      case 'get_users': {
        const leagueId = body.league_id as string | undefined;

        const { data: profiles, error } = await svc.from('profiles').select('id, nombre, is_admin, created_at');
        if (error) throw error;

        // Si se pasa league_id, sólo devolvemos miembros de esa liga con datos por liga
        if (leagueId) {
          const [{ data: members }, { data: predRows }, { data: koRows }, { data: awardRows }] = await Promise.all([
            svc.from('league_members').select('user_id, porra_cerrada').eq('league_id', leagueId),
            svc.from('predictions').select('user_id').eq('league_id', leagueId),
            svc.from('ko_predictions').select('user_id').eq('league_id', leagueId),
            svc.from('award_picks').select('user_id').eq('league_id', leagueId),
          ]);

          const memberMap   = new Map((members ?? []).map(m => [m.user_id, m.porra_cerrada]));
          const predCount   = (predRows  ?? []).reduce((acc: Record<string,number>, r) => { acc[r.user_id] = (acc[r.user_id] ?? 0) + 1; return acc; }, {});
          const koCount     = (koRows    ?? []).reduce((acc: Record<string,number>, r) => { acc[r.user_id] = (acc[r.user_id] ?? 0) + 1; return acc; }, {});
          const awardSet    = new Set((awardRows ?? []).map(r => r.user_id));

          const result = (profiles ?? [])
            .filter(p => memberMap.has(p.id))
            .map(p => ({
              ...p,
              porra_cerrada: memberMap.get(p.id) ?? false,
              pred_count:    predCount[p.id]  ?? 0,
              ko_pred_count: koCount[p.id]    ?? 0,
              has_awards:    awardSet.has(p.id),
            }));

          return json({ ok: true, data: result });
        }

        // Sin league_id: vista global (todos los usuarios con sus memberships)
        const { data: members } = await svc.from('league_members').select('user_id, league_id, porra_cerrada');
        const result = (profiles ?? []).map(p => ({
          ...p,
          memberships: (members ?? []).filter(m => m.user_id === p.id),
          porra_cerrada: false,
          pred_count: null,
          ko_pred_count: null,
          has_awards: false,
        }));
        return json({ ok: true, data: result });
      }

      // ── LIGAS ─────────────────────────────────────────────────────────────
      case 'get_leagues': {
        const { data, error } = await svc.from('leagues').select('*, league_members(user_id, porra_cerrada, profiles(nombre))');
        if (error) throw error;
        return json({ ok: true, data });
      }

      case 'create_league': {
        const nombre  = (body.nombre as string)?.trim();
        const adminId = body.admin_id as string;
        if (!nombre) throw new Error('Falta nombre de la liga');
        if (!adminId) throw new Error('Falta admin_id');
        const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
        let codigo = '';
        for (let i = 0; i < 6; i++) codigo += chars[Math.floor(Math.random() * chars.length)];
        const { data: league, error } = await svc.from('leagues').insert({ nombre, codigo, created_by: adminId }).select().single();
        if (error) throw error;
        await svc.from('league_members').insert({ league_id: league.id, user_id: adminId });
        return json({ ok: true, data: league });
      }

      case 'delete_league': {
        const leagueId = body.league_id as string;
        if (!leagueId) throw new Error('Falta league_id');
        const { error } = await svc.from('leagues').delete().eq('id', leagueId);
        if (error) throw error;
        return json({ ok: true, message: 'Liga eliminada' });
      }

      case 'remove_member': {
        const leagueId = body.league_id as string;
        const userId   = body.user_id as string;
        if (!leagueId || !userId) throw new Error('Faltan league_id o user_id');
        const { error } = await svc.from('league_members').delete().eq('league_id', leagueId).eq('user_id', userId);
        if (error) throw error;
        return json({ ok: true, message: 'Miembro eliminado de la liga' });
      }

      // ── REABRIR PRONÓSTICOS ───────────────────────────────────────────────
      case 'reopen_prediction': {
        const userId   = body.user_id  as string;
        const matchId  = body.match_id as string;
        const leagueId = body.league_id as string;
        if (!userId || !matchId || !leagueId) throw new Error('Faltan user_id, match_id o league_id');
        const { error, count } = await svc.from('predictions').delete({ count: 'exact' })
          .eq('user_id', userId).eq('match_id', matchId).eq('league_id', leagueId);
        if (error) throw error;
        if (count === 0) return json({ ok: false, error: `No se encontro pronostico para \"${matchId}\"` });
        await resetPorraCerrada(svc, userId, leagueId);
        return json({ ok: true, message: `Pronostico reabierto: ${matchId}` });
      }

      case 'reopen_ko_prediction': {
        const userId     = body.user_id as string;
        const matchIdRaw = body.match_id;
        const leagueId   = body.league_id as string;
        if (!userId || !leagueId) throw new Error('Faltan user_id o league_id');
        const matchId = parseInt(String(matchIdRaw), 10);
        if (isNaN(matchId) || matchId < 73 || matchId > 104) throw new Error(`match_id KO debe ser 73-104`);
        const { error, count } = await svc.from('ko_predictions').delete({ count: 'exact' })
          .eq('user_id', userId).eq('match_id', matchId).eq('league_id', leagueId);
        if (error) throw error;
        if (count === 0) return json({ ok: false, error: `No se encontro pronostico KO ${matchId}` });
        await resetPorraCerrada(svc, userId, leagueId);
        return json({ ok: true, message: `KO P${matchId} reabierto` });
      }

      case 'reset_porra_cerrada': {
        const userId   = body.user_id as string;
        const leagueId = body.league_id as string;
        if (!userId || !leagueId) throw new Error('Faltan user_id y league_id');
        await resetPorraCerrada(svc, userId, leagueId);
        return json({ ok: true, message: 'porra_cerrada reseteada en liga' });
      }

      case 'get_user_predictions': {
        const userId   = body.user_id as string;
        const leagueId = body.league_id as string;
        if (!userId || !leagueId) throw new Error('Faltan user_id y league_id');
        const [{ data: preds }, { data: koPreds }, { data: awards }] = await Promise.all([
          svc.from('predictions').select('*').eq('user_id', userId).eq('league_id', leagueId),
          svc.from('ko_predictions').select('*').eq('user_id', userId).eq('league_id', leagueId),
          svc.from('award_picks').select('*').eq('user_id', userId).eq('league_id', leagueId).maybeSingle(),
        ]);
        return json({ ok: true, data: { predictions: preds, ko_predictions: koPreds, awards } });
      }

      case 'get_edge_log': {
        const { data, error } = await svc.from('results').select('log, updated_at').eq('id', 1).maybeSingle();
        if (error) throw error;
        return json({ ok: true, data });
      }

      default:
        return json({ ok: false, error: `Accion desconocida: \"${action}\"` }, 400);
    }
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[admin-actions]', msg);
    return json({ ok: false, error: msg }, 500);
  }
});

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}
