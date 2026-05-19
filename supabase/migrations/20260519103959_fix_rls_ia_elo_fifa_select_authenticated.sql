-- Fix: permitir SELECT a usuarios authenticated en ia_elo_fifa.
-- Sin esta policy, lecturas autenticadas a la tabla retornan 0 filas por RLS.

CREATE POLICY "ia_elo_fifa_select_authenticated"
  ON public.ia_elo_fifa FOR SELECT
  TO authenticated USING (true);
