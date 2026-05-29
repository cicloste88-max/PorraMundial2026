-- Sprint A2 / FIX C (29-may-2026): columna squads.xi para la Pizarra Táctica.
--
-- Motivación: get-squad/extractXI deriva el XI de es_titular, que (a) cae a
-- placeholders cuando hay 9-10 titulares (homónimos no resueltos por el
-- anti-colisión del matcher) y (b) no expone foto_url. La columna xi guarda
-- el XI ya resuelto, ORDENADO por slot, con foto, intocable por el detect 6h.
--
-- Forma del dato (jsonb): array de EXACTAMENTE 11 entradas, en el orden de
-- POS_BY_FORMATION[formacion] (slot 0 = portero). Cada entrada:
--   {
--     "slot":          int,            -- índice 0..10 (= posición en el array)
--     "pos":           str,            -- código de slot (PO/LD/DFC/MC/MCO/DC/...)
--     "nombre":        str,            -- nombre canónico del roster (o del once-tipo si 0-match)
--     "dorsal":        int | null,
--     "foto_url":      str | null,     -- URL pública Storage (del roster enriquecido TM)
--     "tm_player_id":  int | null,
--     "posicion_label":str | null      -- posición específica TM ('Lateral derecho') opcional
--   }
--
-- Construcción: scripts/sync-squads.mjs --build-xi (mapea el once-tipo FF a slots
-- por coordenadas data-onceff-x/y → FORMATION_COORDS, match por nombre+bucket).
-- El cron 6h (sin --build-xi) NO toca esta columna → durabilidad del XI.
-- Consumo: get-squad EF v7.2 (service_role); por eso no requiere RLS/GRANT extra.
--
-- Aplicada al remoto vía execute_sql (Supabase MCP); este fichero la versiona
-- (supabase db pull no es ejecutable desde el container — sin CLI ni acceso a
-- los puertos de la BD). Idempotente (IF NOT EXISTS): seguro re-aplicar.

ALTER TABLE public.squads
  ADD COLUMN IF NOT EXISTS xi jsonb;

COMMENT ON COLUMN public.squads.xi IS
  'XI titular resuelto para la Pizarra Táctica: array jsonb de 11 entradas ordenadas por slot (POS_BY_FORMATION[formacion], slot 0=portero), cada una {slot,pos,nombre,dorsal,foto_url,tm_player_id,posicion_label}. Construida por sync-squads --build-xi; intocable por el detect 6h. Leída por get-squad v7.2. Sprint A2 FIX C 29-may-2026.';
