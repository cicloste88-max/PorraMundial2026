-- F7.7-IA C1 — Hardening de funciones SECURITY DEFINER del bot.
-- Aplicado vía Supabase MCP apply_migration el 2026-05-04 13:03 UTC.
--
-- Resuelve advisors:
--   - function_search_path_mutable (trg_replicate_bot_on_new_league)
--   - anon/authenticated_security_definer_function_executable (ambas)
-- Nota ERR-33: REVOKE FROM PUBLIC en función usada por RLS rompe authenticated.
-- Esta función NO se usa en RLS — solo desde el trigger AFTER INSERT en leagues
-- y desde execute_sql con service_role (bypass RLS). REVOKE es seguro.

ALTER FUNCTION public.trg_replicate_bot_on_new_league() SET search_path = public;

REVOKE EXECUTE ON FUNCTION public.replicate_bot_to_league(uuid) FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.trg_replicate_bot_on_new_league() FROM PUBLIC, anon, authenticated;
