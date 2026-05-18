-- Polish v1 B4 — Cron cierre forzoso de porras pendientes
--
-- Spec: el 10-jun-2026 a las 23:59 Europe/Madrid (CEST = UTC+2),
-- forzar el cierre de todas las porras que sigan abiertas marcando
-- league_members.porra_cerrada = true. Coherente con el deadline
-- "T-24h pre-kickoff" (WC_PRESIM_DEADLINE_MS en eliminatoria-v3.js),
-- que oculta los botones de simulación 24h antes del kickoff (11-jun
-- 19:00 UTC) — equivalente a 10-jun 21:00 UTC.
--
-- Cron expression: '59 21 10 6 *' = 10-jun a las 21:59 UTC
--   = 23:59 Europe/Madrid (CEST verano CET+1, no aplicable: ya estamos
--     en horario de verano en junio. CEST = UTC+2 → 21:59 UTC = 23:59 CEST).
--
-- Email de confirmación: NO incluido (Resend pendiente). Queda en backlog
-- post-Mundial — el cierre formal en BD es suficiente para el motor de
-- puntuación. Recordatorios visuales ya cubiertos por el header azul
-- de cuenta atrás (mundial-shell-v3.js).
--
-- Idempotente: unschedule previo + schedule, para poder re-ejecutar.

SELECT cron.unschedule('cerrar-porras-mundial-2026')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'cerrar-porras-mundial-2026');

SELECT cron.schedule(
    'cerrar-porras-mundial-2026',
    '59 21 10 6 *',  -- 10-jun 21:59 UTC = 23:59 Europe/Madrid (CEST)
    $$
      UPDATE public.league_members
         SET porra_cerrada = true,
             cerrada_at    = NOW()
       WHERE porra_cerrada = false;
    $$
);
