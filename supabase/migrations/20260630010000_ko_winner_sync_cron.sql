-- Cron: ko-winner-sync (jobid 31 en prod, creado vía MCP 30-jun-2026).
--
-- Captura automática del ganador de cruces KO desde ESPN. Resuelve el bug
-- vivido el 29-jun (slot 74 GER-PAR 1-1 + pens 3-4 → bridge inferia winner=null
-- por marcador empatado). La EF `ko-winner-sync` lee competitor.winner ===
-- "true" del scoreboard ESPN (STATUS_FINAL_PEN / state=post) y lo fuerza sobre
-- results.ko_results[slot].winner; tras cualquier cambio reseedea
-- user_points_cache de todas las ligas (write-through de get-league-standings).
-- Idempotente y aditivo: NO toca live_scores ni el bridge.
--
-- Gate INTERNO del cron: el net.http_post SOLO se dispara si existe al menos un
-- KO finished con winner=null en results.ko_results. En reposo (todos los KO
-- jugados tienen ganador) el cron NO llama a ESPN: la consulta del WHERE
-- termina en milisegundos. Esto evita busy-loop durante los días sin KO.
--
-- Auth: header x-cron-key con el secreto Vault IA_CRON_KEY (mismo patrón que
-- los crons existentes; la EF acepta el fallback Vault RPC + env IA_CRON_KEY).
--
-- Idempotente (unschedule + schedule). El alta en runtime ya fue hecha vía
-- MCP el 30-jun; esta migración versionada es backfill / replay-safe en
-- cualquier entorno (dev / branch / restore).

SELECT cron.unschedule('ko-winner-sync')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ko-winner-sync');

SELECT cron.schedule(
    'ko-winner-sync',
    '*/2 * * * *',
    $job$
      SELECT net.http_post(
        url := 'https://cmyfyswystjgzdwbqyyb.supabase.co/functions/v1/ko-winner-sync',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-key', (SELECT trim(decrypted_secret) FROM vault.decrypted_secrets WHERE name = 'IA_CRON_KEY')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 25000
      )
      WHERE EXISTS (
        SELECT 1
          FROM public.results r,
               LATERAL jsonb_each(r.ko_results) e
         WHERE r.id = 1
           AND e.value->>'status' = 'finished'
           AND (e.value->>'winner') IS NULL
      );
    $job$
);
