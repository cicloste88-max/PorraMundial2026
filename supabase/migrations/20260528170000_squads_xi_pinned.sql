-- Capa C del fix XI pipeline (28-may-2026): pin de estabilidad para
-- impedir que el cron de detect re-escriba es_titular en países cuyo XI
-- ha sido corregido manualmente por San via MCP.
--
-- Semántica del pin:
--   xi_pinned=true        → el motor (sync-squads.mjs Paso 2 + scrape mode
--                           con --refresh-final) NO recalcula es_titular.
--                           El resto de campos del roster (nombre, club,
--                           edad, valor, dorsal, dob, foto_url, etc.)
--                           SIGUEN siendo actualizables por detect/enrich-tm
--                           con preserveEnrichment activo. El pin congela
--                           SOLO el flag es_titular del array jugadores.
--   xi_pinned_at          → timestamp del último pin. Útil para auditoría
--                           y para detectar pins antiguos que pudieran
--                           necesitar refresco manual tras un cambio de XI.
--
-- Pin manual via MCP (San lo aplicará tras merge para los 33 países que
-- corrigió a 11/11 titulares):
--   UPDATE squads
--   SET xi_pinned = true, xi_pinned_at = NOW()
--   WHERE iso3 IN (...);
--
-- Para despinar (e.g. tras anunciar XI distinto en un partido):
--   UPDATE squads SET xi_pinned = false, xi_pinned_at = NULL WHERE iso3 = '<XXX>';
--
-- Idempotente (IF NOT EXISTS): seguro re-aplicar sin efecto.

ALTER TABLE public.squads
  ADD COLUMN IF NOT EXISTS xi_pinned boolean NOT NULL DEFAULT false;

ALTER TABLE public.squads
  ADD COLUMN IF NOT EXISTS xi_pinned_at timestamptz;

COMMENT ON COLUMN public.squads.xi_pinned IS
  'Si true, sync-squads NO recalcula es_titular de los jugadores (preserva pin manual). Capa C fix XI pipeline 28-may-2026.';

COMMENT ON COLUMN public.squads.xi_pinned_at IS
  'Timestamp del último pin manual del XI. NULL = nunca pineado o despinado.';
