-- F4 (auto-Bota de Oro) — RPC sugerencia top scorer del usuario.
-- Cuenta scorers en predictions (grupos) + ko_predictions del usuario/liga,
-- devuelve el líder (rn=1) con n y margin sobre el 2º (rn=2). El gating
-- (n >= 3 AND margin >= 2) lo aplica el cliente en _v3SuggestGoldenBoot.
-- SECURITY INVOKER: respeta RLS del usuario authenticated (solo ve sus filas).
CREATE OR REPLACE FUNCTION get_user_top_scorer(
  p_user_id uuid, p_league_id uuid
) RETURNS TABLE(scorer_key text, n int, margin int)
LANGUAGE sql STABLE SECURITY INVOKER AS $$
  WITH agg AS (
    SELECT scorer AS k, count(*)::int AS n FROM (
      SELECT scorer FROM predictions
        WHERE user_id=p_user_id AND league_id=p_league_id AND scorer IS NOT NULL
      UNION ALL
      SELECT scorer FROM ko_predictions
        WHERE user_id=p_user_id AND league_id=p_league_id AND scorer IS NOT NULL
    ) t GROUP BY scorer
  ),
  ranked AS (SELECT k, n, row_number() OVER (ORDER BY n DESC, k ASC) AS rn FROM agg)
  SELECT r1.k, r1.n, r1.n - COALESCE(r2.n, 0) AS margin
  FROM ranked r1 LEFT JOIN ranked r2 ON r2.rn=2
  WHERE r1.rn=1;
$$;
GRANT EXECUTE ON FUNCTION get_user_top_scorer(uuid, uuid) TO authenticated;
