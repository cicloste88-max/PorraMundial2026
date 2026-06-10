-- ════════════════════════════════════════════════════════════════
-- Backfill de objetos runtime del pipeline live (creados vía MCP,
-- capturados del runtime el 10-jun-2026). Idempotente: aplicarla
-- sobre prod es no-op. NO ejecutar manualmente — solo versionado.
-- ════════════════════════════════════════════════════════════════

-- 1. Tabla wc_matches_ko (vacía hasta ~28-jun, KO partidos 73-104)
CREATE TABLE IF NOT EXISTS public.wc_matches_ko (
  match_key     text PRIMARY KEY,
  sofascore_id  bigint,
  ko_match_id   integer NOT NULL,
  round         text NOT NULL,
  home_iso3     text,
  away_iso3     text,
  teams_swapped boolean NOT NULL DEFAULT false,
  date_utc      text,
  updated_at    timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT wc_matches_ko_round_chk CHECK (round = ANY (ARRAY['r32','r16','qf','sf','third','final']))
);

ALTER TABLE public.wc_matches_ko ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS wc_matches_ko_select_all ON public.wc_matches_ko;
CREATE POLICY wc_matches_ko_select_all ON public.wc_matches_ko
  FOR SELECT TO anon, authenticated USING (true);
-- Nota: grants de tabla son los defaults del schema public; escrituras
-- bloqueadas por RLS (solo existe policy SELECT). No añadir más policies.

-- 2. Función del trigger puente live_scores(finished) → porra-bridge-results
CREATE OR REPLACE FUNCTION public.trg_bridge_on_finished()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net', 'vault'
AS $function$
DECLARE
  v_secret text;
BEGIN
  -- Guarda 1: solo transición real a finished (no re-dispara en polls posteriores).
  IF NEW.status = 'finished'
     AND COALESCE(OLD.status,'') <> 'finished'
     -- Guarda 2: marcador presente (no disparar con dato incompleto).
     AND NEW.score_home IS NOT NULL
     AND NEW.score_away IS NOT NULL
  THEN
    SELECT decrypted_secret INTO v_secret
      FROM vault.decrypted_secrets WHERE name='SUPABASE_SERVICE_ROLE_KEY';
    PERFORM net.http_post(
      url := 'https://cmyfyswystjgzdwbqyyb.supabase.co/functions/v1/porra-bridge-results',
      headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_secret),
      body := jsonb_build_object('match_key', NEW.match_key),
      timeout_milliseconds := 15000
    );
  END IF;
  RETURN NEW;
END;
$function$;

-- 3. Trigger
DROP TRIGGER IF EXISTS bridge_on_finished ON public.live_scores;
CREATE TRIGGER bridge_on_finished
  AFTER UPDATE OF status ON public.live_scores
  FOR EACH ROW EXECUTE FUNCTION trg_bridge_on_finished();

-- 4. Red de seguridad: barrido de finished sin puentear (cron /5min)
CREATE OR REPLACE FUNCTION public.sweep_unbridged_finished()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net', 'vault'
AS $function$
DECLARE
  v_secret    text;
  v_orphans   int;
BEGIN
  -- Defensa anti-solapamiento (añadido 2026-06-08)
  IF NOT pg_try_advisory_xact_lock(hashtext('sweep_unbridged_finished')) THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'concurrent_run');
  END IF;

  SELECT count(*) INTO v_orphans
  FROM live_scores ls
  WHERE ls.status='finished' AND ls.score_home IS NOT NULL AND ls.score_away IS NOT NULL
    AND (
      EXISTS (
        SELECT 1 FROM wc_matches g
        WHERE g.match_key=ls.match_key
          AND NOT ((SELECT match_results FROM results WHERE id=1) ? (g.group_letter||'_'||g.home_es||'_'||g.away_es))
      )
      OR EXISTS (
        SELECT 1 FROM wc_matches_ko k
        WHERE k.match_key=ls.match_key
          AND NOT ((SELECT ko_results FROM results WHERE id=1) ? (k.ko_match_id::text))
      )
    );

  IF v_orphans = 0 THEN
    RETURN jsonb_build_object('ts', now(), 'orphans', 0, 'action', 'noop');
  END IF;

  SELECT decrypted_secret INTO v_secret
    FROM vault.decrypted_secrets WHERE name='SUPABASE_SERVICE_ROLE_KEY';
  PERFORM net.http_post(
    url := 'https://cmyfyswystjgzdwbqyyb.supabase.co/functions/v1/porra-bridge-results',
    headers := jsonb_build_object('Content-Type','application/json','Authorization','Bearer '||v_secret),
    body := '{}'::jsonb,
    timeout_milliseconds := 30000
  );
  RETURN jsonb_build_object('ts', now(), 'orphans', v_orphans, 'action', 'bridge_all_invoked');
END;
$function$;

-- 5. Dispatcher de slots live (cron /3min, ventana T-45m → T+150/210m)
CREATE OR REPLACE FUNCTION public.dispatch_live_slots()
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'net', 'vault'
AS $function$
DECLARE
  v_now      bigint := extract(epoch FROM now())::bigint;
  v_url      text;
  v_secret   text;
  v_slot     record;
  v_keys     text[];
  v_launched int := 0;
  v_slots    int := 0;
BEGIN
  -- Defensa anti-solapamiento (añadido 2026-06-08)
  IF NOT pg_try_advisory_xact_lock(hashtext('dispatch_live_slots')) THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'concurrent_run');
  END IF;

  SELECT decrypted_secret INTO v_secret FROM vault.decrypted_secrets WHERE name='SUPABASE_SERVICE_ROLE_KEY';
  v_url := 'https://cmyfyswystjgzdwbqyyb.supabase.co/functions/v1/porra-match-live';

  FOR v_slot IN
    SELECT match_start_ts, array_agg(match_key) AS keys
    FROM (
      SELECT ls.match_key, ls.match_start_ts,
             CASE WHEN ls.match_key LIKE 'wc2026_g%' THEN 150 ELSE 210 END AS window_min
      FROM live_scores ls
      WHERE ls.status <> 'finished'
        AND ls.sofascore_event_id IS NOT NULL
        AND v_now >= ls.match_start_ts - 2700
        AND v_now <= ls.match_start_ts + (CASE WHEN ls.match_key LIKE 'wc2026_g%' THEN 150 ELSE 210 END) * 60
    ) elegibles
    GROUP BY match_start_ts
  LOOP
    v_keys := v_slot.keys;
    v_slots := v_slots + 1;
    PERFORM net.http_post(
      url := v_url,
      headers := jsonb_build_object('Content-Type','application/json',
                                    'Authorization','Bearer '||v_secret),
      body := jsonb_build_object('match_keys', to_jsonb(v_keys)),
      timeout_milliseconds := 15000
    );
    v_launched := v_launched + array_length(v_keys, 1);
  END LOOP;

  RETURN jsonb_build_object('ts', v_now, 'slots_launched', v_slots, 'matches_in_slots', v_launched);
END;
$function$;

-- 6. Crons (guardado por existencia de pg_cron — el shadow DB local no lo tiene)
DO $$
DECLARE jid bigint;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname='pg_cron') THEN
    SELECT jobid INTO jid FROM cron.job WHERE jobname='dispatch-live-slots';
    IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
    PERFORM cron.schedule('dispatch-live-slots','*/3 * * * *','SELECT public.dispatch_live_slots();');

    jid := NULL;
    SELECT jobid INTO jid FROM cron.job WHERE jobname='sweep-unbridged-finished';
    IF jid IS NOT NULL THEN PERFORM cron.unschedule(jid); END IF;
    PERFORM cron.schedule('sweep-unbridged-finished','*/5 * * * *','SELECT public.sweep_unbridged_finished();');
  END IF;
END $$;
