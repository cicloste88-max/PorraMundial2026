-- F7.7-VIS-10 (B10-traceability) — vistas para chips Liga + Global del Predictor
-- Generado: 30 abr 2026
-- Branch: docs/predictor-design-source-v1
-- Aplicación: por San vía Supabase Dashboard SQL Editor o `npx supabase db push`
--             (Claude Code remoto no puede aplicar). Verificar GRANTS post-apply.
--
-- Las vistas son SELECT-only sobre tablas existentes (profiles, league_members).
-- No requieren ALTER ni RLS propio: heredan privilegios de las tablas base + filtros del SELECT.
-- F7.7-IA C1 añadirá profiles.is_bot — el COALESCE garantiza compat retroactiva.

-- ────────────────────────────────────────────────────────────────────
-- Vista 1: count miembros activos por liga
-- Uso: chip "Nº de N · Liga" en #fc-pred-tile pre-Mundial.
-- human_count excluye admins (mientras no exista is_bot). total_count = humanos + admins.
-- ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_league_member_count AS
SELECT
  lm.league_id,
  count(*) FILTER (
    WHERE NOT COALESCE(
      (SELECT p.is_admin FROM public.profiles p WHERE p.id = lm.user_id),
      false
    )
  ) AS human_count,
  count(*) AS total_count
FROM public.league_members lm
GROUP BY lm.league_id;

GRANT SELECT ON public.v_league_member_count TO authenticated;

-- ────────────────────────────────────────────────────────────────────
-- Vista 2: ranking global cross-league por puntos absolutos
-- Uso: chip "Nº · Global" en #fc-pred-tile.
-- TODO scoring-cache (sprint B11): mientras no exista
-- public.user_points_cache, total_pts = 0 para todos los users. En
-- pre-Mundial es correcto (todos a 0). RANK() con tiebreak por
-- created_at ASC garantiza orden estable y único pre-Mundial.
-- Excluye admins; filtro is_bot llegará en F7.7-IA C1.
-- ────────────────────────────────────────────────────────────────────

CREATE OR REPLACE VIEW public.v_user_global_rank AS
SELECT
  p.id AS user_id,
  0::int AS total_pts,  -- placeholder hasta sprint B11 user_points_cache
  RANK() OVER (ORDER BY 0 DESC, p.created_at ASC) AS rank_global,
  count(*) OVER () AS total_users
FROM public.profiles p
WHERE COALESCE(p.is_admin, false) = false;

GRANT SELECT ON public.v_user_global_rank TO authenticated;
