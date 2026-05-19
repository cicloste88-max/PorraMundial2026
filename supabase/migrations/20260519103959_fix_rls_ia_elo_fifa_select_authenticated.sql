-- Fix: permitir SELECT a usuarios authenticated en ia_elo_fifa.
-- Sin esta policy, lecturas autenticadas a la tabla retornan 0 filas por RLS.
--
-- Idempotente: la policy ya fue aplicada en remoto vía execute_sql MCP. Este
-- fichero es la representación versionada del cambio. Postgres no soporta
-- `CREATE POLICY IF NOT EXISTS`, así que dropeamos antes de crear.

DROP POLICY IF EXISTS "ia_elo_fifa_select_authenticated" ON public.ia_elo_fifa;

CREATE POLICY "ia_elo_fifa_select_authenticated"
  ON public.ia_elo_fifa FOR SELECT
  TO authenticated USING (true);
