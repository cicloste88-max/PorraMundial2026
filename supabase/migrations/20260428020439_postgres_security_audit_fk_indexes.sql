-- 7 índices sobre FKs sin cobertura (advisor performance)
-- Tablas <500 filas → CREATE INDEX normal, sin CONCURRENTLY

CREATE INDEX IF NOT EXISTS idx_award_picks_user_id
  ON public.award_picks(user_id);

CREATE INDEX IF NOT EXISTS idx_boost_picks_league_id
  ON public.boost_picks(league_id);

CREATE INDEX IF NOT EXISTS idx_ia_predictions_snapshot_id
  ON public.ia_predictions(snapshot_id);

CREATE INDEX IF NOT EXISTS idx_ko_predictions_user_id
  ON public.ko_predictions(user_id);

CREATE INDEX IF NOT EXISTS idx_leagues_created_by
  ON public.leagues(created_by);

CREATE INDEX IF NOT EXISTS idx_predictions_user_id
  ON public.predictions(user_id);

CREATE INDEX IF NOT EXISTS idx_whatsapp_subscribers_user_id
  ON public.whatsapp_subscribers(user_id);
