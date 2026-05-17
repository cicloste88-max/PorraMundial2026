-- HF-Reset-02 (continuación): añadir RLS DELETE policies a award_picks +
-- boost_picks. Mismo síntoma que predictions/ko_predictions: handlers de
-- reset hacían DELETE silencioso por falta de policy FOR DELETE.
-- Patrón USING idéntico al de INSERT/UPDATE (mismo gating de porra_abierta).
-- Aplicado 17may2026 desde Claude.ai (Supabase MCP). Documentado retroactivamente.
-- Ver ERR-51 en errores_conocidos_porra.md.

CREATE POLICY award_picks_delete ON public.award_picks
  FOR DELETE
  USING (
    (SELECT auth.uid()) = user_id
    AND (league_id IS NULL OR is_porra_abierta((SELECT auth.uid()), league_id))
  );

CREATE POLICY boost_picks_delete ON public.boost_picks
  FOR DELETE
  USING (
    (SELECT auth.uid()) = user_id
    AND (league_id IS NULL OR is_porra_abierta((SELECT auth.uid()), league_id))
  );
