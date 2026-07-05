-- Cron: ko-round-seeder (*/15 min) — siembra automática de rondas KO R16→final.
--
-- La EF `ko-round-seeder` deriva por SLOT los cruces de la siguiente ronda
-- desde results.ko_results (winners; para el 103 los losers de semis) contra
-- wc_matches_ko, los matchea contra el scoreboard ESPN por pareja de
-- abbreviations (== iso3 en KO) y siembra wc_matches_ko + espn_event_map +
-- live_scores (esqueleto orientado a proyecto; si el partido ya está post,
-- marcador final + events de scoringPlays e invocación explícita del bridge —
-- el trigger bridge_on_finished es AFTER UPDATE y no salta en INSERT).
-- Idempotente y fail-safe: slot ya sembrado → skip (solo reconcilia fecha);
-- 0 o >1 candidatos ESPN → no siembra y reporta.
--
-- Gate INTERNO del cron: el net.http_post SOLO se dispara mientras el cuadro
-- KO esté incompleto (wc_matches_ko < 32 filas = 16 R32 + 8 R16 + 4 QF + 2 SF
-- + third + final) o quede alguna fila KO R16+ sin su esqueleto live_scores
-- (run anterior caído a medias → la EF lo auto-repara). Con el cuadro completo
-- el cron queda en reposo: el WHERE resuelve en milisegundos sin llamar a la EF.
--
-- Auth: header x-cron-key con el secreto Vault IA_CRON_KEY (mismo patrón que
-- ko-winner-sync; la EF acepta env IA_CRON_KEY + fallback Vault RPC).
--
-- ⚠️ NO aplicar desde Code: la aplica Claude.ai vía MCP execute_sql tras
-- validar el primer run real de la EF (gate del brief 5-jul-2026). Idempotente
-- (unschedule + schedule) — replay-safe en cualquier entorno.

SELECT cron.unschedule('ko-round-seeder')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ko-round-seeder');

SELECT cron.schedule(
    'ko-round-seeder',
    '*/15 * * * *',
    $job$
      SELECT net.http_post(
        url := 'https://cmyfyswystjgzdwbqyyb.supabase.co/functions/v1/ko-round-seeder',
        headers := jsonb_build_object(
          'Content-Type', 'application/json',
          'x-cron-key', (SELECT trim(decrypted_secret) FROM vault.decrypted_secrets WHERE name = 'IA_CRON_KEY')
        ),
        body := '{}'::jsonb,
        timeout_milliseconds := 25000
      )
      WHERE (SELECT count(*) FROM public.wc_matches_ko) < 32
         OR EXISTS (
              SELECT 1
                FROM public.wc_matches_ko k
               WHERE k.ko_match_id BETWEEN 89 AND 104
                 AND NOT EXISTS (
                       SELECT 1 FROM public.live_scores ls
                        WHERE ls.match_key = k.match_key
                     )
            );
    $job$
);
