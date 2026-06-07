-- sent_receipts — registro de comprobantes (acuse de recibo) de porra enviados.
--
-- Feature ADITIVA de la EF send-porra-receipt (acuse de recibo al cierre de la
-- porra: copia íntegra de pronósticos, NO puntuación). Idempotencia por
-- (user_id, league_id): modelo per-(user,league) (hay 6 ligas; un usuario puede
-- estar en varias). Verificado: 0 duplicados reales bajo este modelo.
-- NO afecta al motor de puntuación ni al flujo de cierre.

create extension if not exists pgcrypto;

create table if not exists public.sent_receipts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null,
  league_id   uuid not null,
  email       text,
  resend_id   text,
  meta        jsonb,
  sent_at     timestamptz not null default now(),
  constraint sent_receipts_user_league_uniq unique (user_id, league_id)
);

create index if not exists sent_receipts_league_idx on public.sent_receipts (league_id);

-- RLS: solo la EF (service_role) accede. Con RLS habilitado y SIN policies,
-- authenticated/anon obtienen 0 filas (ERR-58) — comportamiento deseado: la
-- tabla no se expone en el frontend.
alter table public.sent_receipts enable row level security;

comment on table public.sent_receipts is
  'Comprobantes (acuse de recibo) de porra enviados por la EF send-porra-receipt. Idempotencia por (user_id, league_id).';
