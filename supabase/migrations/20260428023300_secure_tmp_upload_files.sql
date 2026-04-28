-- Fix advisor 0013_rls_disabled_in_public sobre public.tmp_upload_files.
-- Aplicado el 28abr2026 02:33 UTC desde Claude.ai (Supabase MCP).
-- Patrón idéntico a orchestrator_jobs_service_only (sesión audit 28abr, PR#36).

ALTER TABLE public.tmp_upload_files ENABLE ROW LEVEL SECURITY;

CREATE POLICY tmp_upload_files_service_only ON public.tmp_upload_files
  FOR ALL TO service_role
  USING (true) WITH CHECK (true);

REVOKE ALL ON public.tmp_upload_files FROM anon, authenticated;
