-- HF-Reset-02: añadir RLS DELETE policies a predictions + ko_predictions.
-- Bug raíz: handlers async de reset hacían DELETE silencioso (data:null,
-- error:null) pero las rows NO se borraban en BD porque la tabla tenía RLS
-- habilitado SIN policy FOR DELETE. Postgres filtraba silenciosamente.
-- Patrón USING idéntico al de INSERT/UPDATE (mismo gating de porra_abierta).
-- Aplicado 17may2026 desde Claude.ai (Supabase MCP). Documentado retroactivamente.
-- Ver ERR-51 en errores_conocidos_porra.md.

CREATE POLICY predictions_delete ON public.predictions
  FOR DELETE
  USING (
    (SELECT auth.uid()) = user_id
    AND (league_id IS NULL OR is_porra_abierta((SELECT auth.uid()), league_id))
  );

CREATE POLICY ko_predictions_delete ON public.ko_predictions
  FOR DELETE
  USING (
    (SELECT auth.uid()) = user_id
    AND (league_id IS NULL OR is_porra_abierta((SELECT auth.uid()), league_id))
  );
