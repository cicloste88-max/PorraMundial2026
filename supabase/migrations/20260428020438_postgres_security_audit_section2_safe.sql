-- Sección 2.1-2.3 del audit Postgres del 28abr2026
-- NO incluye REVOKE/GRANT sobre is_porra_abierta (rompe RLS de predictions/ko/award/boost)
-- NO incluye DROP tmp_upload_files (7 filas a verificar antes — ver backlog)

-- 2.1 DROP tabla residual (0 filas, 0 referencias en código y BD)
DROP TABLE IF EXISTS public._fix_encoding_temp;

-- 2.2 DROP view residual del refactor F4 (sin dependientes)
DROP VIEW IF EXISTS public.refactor_status;

-- 2.3 search_path explícito en is_porra_abierta (advisor F0001)
-- NO se tocan los grants: la función es invocada desde RLS de predictions,
-- ko_predictions, award_picks, boost_picks (8 policies) y necesita
-- EXECUTE para authenticated. SECURITY DEFINER ya filtra internamente por user_id.
ALTER FUNCTION public.is_porra_abierta(uuid, uuid)
  SET search_path = public, pg_temp;
