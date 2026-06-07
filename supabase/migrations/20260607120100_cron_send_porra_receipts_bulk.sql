-- Cron: cierre de porras + dispatch de comprobantes (acuse de recibo) en bulk.
--
-- Extiende el job existente 'cerrar-porras-mundial-2026' (cierre forzoso
-- 10-jun 21:59 UTC = 23:59 Europe/Madrid). Tras marcar porra_cerrada=true,
-- dispara un net.http_post POR LIGA a la EF send-porra-receipt en modo bulk
-- (patrón de las migraciones fase_e). Header X-Cron-Key = Vault IA_CRON_KEY.
--
-- La EF en modo bulk recorre los miembros de cada liga (excluye bots y a quien
-- no tenga datos) y es idempotente (UNIQUE(user_id, league_id) en
-- sent_receipts), por lo que re-ejecutar no reenvía.
--
-- Idempotente (unschedule + schedule). ROLLBACK = re-schedular el job dejando
-- SOLO el UPDATE (quitar el bloque SELECT net.http_post ... FROM leagues).

SELECT cron.unschedule('cerrar-porras-mundial-2026')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cerrar-porras-mundial-2026');

SELECT cron.schedule(
    'cerrar-porras-mundial-2026',
    '59 21 10 6 *',  -- 10-jun 21:59 UTC = 23:59 Europe/Madrid (CEST)
    $job$
      UPDATE public.league_members
         SET porra_cerrada = true,
             cerrada_at    = NOW()
       WHERE porra_cerrada = false;

      SELECT net.http_post(
        url := 'https://cmyfyswystjgzdwbqyyb.supabase.co/functions/v1/send-porra-receipt',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'X-Cron-Key', (SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'IA_CRON_KEY')
        ),
        body := jsonb_build_object('league_id', l.id, 'bulk', true),
        timeout_milliseconds := 150000
      )
      FROM public.leagues l;
    $job$
);
