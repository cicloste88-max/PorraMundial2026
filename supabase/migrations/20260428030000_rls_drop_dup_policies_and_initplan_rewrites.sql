-- Item 3: DROP 4 policies SELECT duplicadas con USING(true).
-- Decision: los usuarios NO ven predicciones de otros usuarios.
-- Item 4: 17 RLS rewrites auth.uid() -> (SELECT auth.uid()) para evitar
-- re-evaluacion por fila (advisor auth_rls_initplan). 19 WARN -> 2.
-- Aplicado 28abr2026 desde Claude.ai (Supabase MCP). Verificado 4/4 PASS.

DROP POLICY IF EXISTS award_picks_select    ON public.award_picks;
DROP POLICY IF EXISTS boost_picks_select    ON public.boost_picks;
DROP POLICY IF EXISTS ko_predictions_select ON public.ko_predictions;
DROP POLICY IF EXISTS predictions_select    ON public.predictions;

ALTER POLICY "Ver mis award_picks" ON public.award_picks
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY award_picks_insert ON public.award_picks
  WITH CHECK (((SELECT auth.uid()) = user_id) AND ((league_id IS NULL) OR is_porra_abierta((SELECT auth.uid()), league_id)));
ALTER POLICY award_picks_update ON public.award_picks
  USING (((SELECT auth.uid()) = user_id) AND ((league_id IS NULL) OR is_porra_abierta((SELECT auth.uid()), league_id)));

ALTER POLICY "Ver mis boost_picks" ON public.boost_picks
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY boost_picks_insert ON public.boost_picks
  WITH CHECK (((SELECT auth.uid()) = user_id) AND ((league_id IS NULL) OR is_porra_abierta((SELECT auth.uid()), league_id)));
ALTER POLICY boost_picks_update ON public.boost_picks
  USING (((SELECT auth.uid()) = user_id) AND ((league_id IS NULL) OR is_porra_abierta((SELECT auth.uid()), league_id)));

ALTER POLICY "Ver mis ko_predictions" ON public.ko_predictions
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY ko_predictions_insert ON public.ko_predictions
  WITH CHECK (((SELECT auth.uid()) = user_id) AND ((league_id IS NULL) OR is_porra_abierta((SELECT auth.uid()), league_id)));
ALTER POLICY ko_predictions_update ON public.ko_predictions
  USING (((SELECT auth.uid()) = user_id) AND ((league_id IS NULL) OR is_porra_abierta((SELECT auth.uid()), league_id)));

ALTER POLICY "Ver mis predictions" ON public.predictions
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY predictions_insert ON public.predictions
  WITH CHECK (((SELECT auth.uid()) = user_id) AND ((league_id IS NULL) OR is_porra_abierta((SELECT auth.uid()), league_id)));
ALTER POLICY predictions_update ON public.predictions
  USING (((SELECT auth.uid()) = user_id) AND ((league_id IS NULL) OR is_porra_abierta((SELECT auth.uid()), league_id)));

ALTER POLICY lm_insert ON public.league_members
  WITH CHECK ((SELECT auth.uid()) = user_id);
ALTER POLICY lm_select ON public.league_members
  USING ((SELECT auth.uid()) = user_id);
ALTER POLICY lm_update ON public.league_members
  USING ((SELECT auth.uid()) = user_id)
  WITH CHECK (((SELECT auth.uid()) = user_id) AND (porra_cerrada = false));

ALTER POLICY "Crear liga" ON public.leagues
  WITH CHECK ((SELECT auth.uid()) = created_by);

ALTER POLICY "Usuario actualiza solo nombre e inscrito" ON public.profiles
  USING ((SELECT auth.uid()) = id)
  WITH CHECK (
    ((SELECT auth.uid()) = id)
    AND ((SELECT p.is_admin FROM profiles p WHERE p.id = (SELECT auth.uid())) = is_admin)
    AND ((SELECT p.porra_cerrada FROM profiles p WHERE p.id = (SELECT auth.uid())) = porra_cerrada)
    AND (NOT ((SELECT p.cerrada_at FROM profiles p WHERE p.id = (SELECT auth.uid())) IS DISTINCT FROM cerrada_at))
  );
