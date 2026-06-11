-- B11 (Item 7 post-J1, 12-jun-2026) — user_points_cache + vistas de rank reales.
--
-- Sustituye los stubs pre-Mundial: v_user_global_rank (total_pts 0 fijo + rank
-- por created_at) y el leagueRank=1 hardcodeado del frontend.
--
-- Flujo de datos: get-league-standings v1.4.0 (motor canónico) hace
-- write-through a user_points_cache en cada cómputo; porra-bridge-results v7
-- invoca standings (bearer service_role privilegiado) para TODAS las ligas
-- tras cada partido bridgeado → la cache se actualiza al finalizar partido.
--
-- Decisiones San (12-jun-2026):
--   · Rank global: mis puntos EN LA LIGA DESDE LA QUE MIRO contra el MEJOR
--     total de cada otro usuario de la app. Con 2 ligas y mismos puntos,
--     misma posición; donde tengo más, estoy más arriba.
--   · IA Zayu COMPITE y cuenta en denominador y posiciones (de 22 en gallos).
--
-- Idempotente (DROP POLICY/VIEW IF EXISTS antes de CREATE — regla migrations).

create table if not exists public.user_points_cache (
  user_id    uuid not null,
  league_id  uuid not null references public.leagues(id) on delete cascade,
  total_pts  integer not null default 0,
  breakdown  jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, league_id)
);

alter table public.user_points_cache enable row level security;

-- Lectura para usuarios logueados; escritura SOLO service_role (sin policies
-- de INSERT/UPDATE/DELETE a propósito: service_role bypasea RLS). Audit de
-- las 4 policies: SELECT explícita aquí; INSERT/UPDATE/DELETE deliberadamente
-- ausentes (deny por defecto para anon/authenticated). ERR-58: RLS habilitado
-- SIN policy de SELECT devolvería 0 filas en silencio para authenticated.
drop policy if exists user_points_cache_select_auth on public.user_points_cache;
create policy user_points_cache_select_auth on public.user_points_cache
  for select to authenticated using (true);

-- v_user_global_rank v2 — semántica San: rank contextual a la liga.
-- security_invoker: la RLS de user_points_cache aplica al caller (authenticated
-- tiene SELECT; anon ve vacío — el Predictor requiere login).
drop view if exists public.v_user_global_rank;
create view public.v_user_global_rank
with (security_invoker = on) as
with best as (
  select user_id, max(total_pts) as best_pts
  from public.user_points_cache
  group by user_id
)
select c.user_id,
       c.league_id,
       c.total_pts,
       1 + (select count(*) from best b
             where b.user_id <> c.user_id and b.best_pts > c.total_pts) as rank_global,
       (select count(*) from best) as total_users
from public.user_points_cache c;

-- Posición dentro de la liga. rank() clásico: empates comparten posición y
-- dejan hueco después (2 colíderes → siguiente es 3º). Zayu cuenta.
drop view if exists public.v_league_rank;
create view public.v_league_rank
with (security_invoker = on) as
select user_id,
       league_id,
       total_pts,
       rank() over (partition by league_id order by total_pts desc) as rank_league,
       count(*) over (partition by league_id) as ranked_members
from public.user_points_cache;
