-- F4 (rediseño PR #112) — sección "Tus goleadores": top N goleadores del
-- usuario. Sustituye la RPC singular get_user_top_scorer (badge interno) por
-- la plural get_user_top_scorers (sin gating de margin; el usuario decide
-- entre el top 3). DROP IF EXISTS de la singular: idempotente, segura tanto si
-- la singular ya está aplicada en remoto como si no.
-- SECURITY INVOKER: respeta RLS del authenticated (solo ve sus filas).
DROP FUNCTION IF EXISTS get_user_top_scorer(uuid, uuid);

CREATE OR REPLACE FUNCTION get_user_top_scorers(
  p_user_id uuid, p_league_id uuid, p_limit int DEFAULT 3
) RETURNS TABLE(scorer_key text, n int, rank int)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  WITH agg AS (
    SELECT scorer AS k, count(*)::int AS n FROM (
      SELECT scorer FROM predictions
        WHERE user_id=p_user_id AND league_id=p_league_id AND scorer IS NOT NULL
      UNION ALL
      SELECT scorer FROM ko_predictions
        WHERE user_id=p_user_id AND league_id=p_league_id AND scorer IS NOT NULL
    ) t GROUP BY scorer
  )
  SELECT k, n, row_number() OVER (ORDER BY n DESC, k ASC)::int
  FROM agg
  ORDER BY n DESC, k ASC
  LIMIT p_limit;
$$;
GRANT EXECUTE ON FUNCTION get_user_top_scorers(uuid, uuid, int) TO authenticated;
