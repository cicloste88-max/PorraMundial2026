-- Cron schedules Fase E — IA Predictor (spec §10.2).
--
-- Requiere:
--   1. pg_cron + pg_net activados en el proyecto Supabase (ya lo están — usados
--      por update-results, porra-match-live, etc.).
--   2. Secreto IA_CRON_KEY en Vault (48+ chars aleatorios). Rotación:
--        SELECT vault.update_secret(
--            (SELECT id FROM vault.secrets WHERE name='IA_CRON_KEY'),
--            encode(gen_random_bytes(32), 'hex')
--        );
--
-- Calendario:
--   - 11 jun 00:00 UTC: freeze_snapshot (scrapes 3 fuentes + crea snapshot + activa)
--   - 11 jun 00:10 UTC: compute_groups (predicciones de los 72 partidos de grupos)
--   - cada noche 03:00 UTC: cleanup snapshots inactivos >7d (ya programado en
--     20260421_fase_e_ia_snapshots.sql)
--
-- Idempotente: unschedule antes de schedule para poder re-ejecutar esta
-- migración.

-- ─── 1. freeze_snapshot del Mundial 2026 ────────────────────────────────────
SELECT cron.unschedule('ia-freeze-snapshot-mundial')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ia-freeze-snapshot-mundial');

SELECT cron.schedule(
    'ia-freeze-snapshot-mundial',
    '0 0 11 6 *',  -- 11 jun 00:00 UTC
    $$
      SELECT net.http_post(
        url := 'https://cmyfyswystjgzdwbqyyb.supabase.co/functions/v1/porra-ia-compute',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='IA_CRON_KEY')
        ),
        body := jsonb_build_object(
          'action', 'freeze_snapshot',
          'label', 'pre_mundial_11jun',
          'activate', true
        ),
        timeout_milliseconds := 90000
      );
    $$
);


-- ─── 2. compute_groups 10 min después del freeze ────────────────────────────
SELECT cron.unschedule('ia-compute-groups-mundial')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ia-compute-groups-mundial');

SELECT cron.schedule(
    'ia-compute-groups-mundial',
    '10 0 11 6 *',  -- 11 jun 00:10 UTC (10 min después del freeze)
    $$
      SELECT net.http_post(
        url := 'https://cmyfyswystjgzdwbqyyb.supabase.co/functions/v1/porra-ia-compute',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name='IA_CRON_KEY')
        ),
        body := jsonb_build_object('action', 'compute_groups'),
        timeout_milliseconds := 120000
      );
    $$
);
