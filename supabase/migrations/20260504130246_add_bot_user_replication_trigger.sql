-- F7.7-IA C1 — Bot IA Zayu: trigger replicate_bot_on_new_league
-- Aplicado vía Supabase MCP apply_migration el 2026-05-04 13:02 UTC.
--
-- Diseño: el bot es un usuario auth normal (is_bot=true en profiles). Sus
-- predictions/ko_predictions/award_picks/league_members son indistinguibles
-- de las de un humano. Cuando se crea una liga nueva, el trigger replica
-- automáticamente toda la "porra" del bot desde su liga source (1ª en
-- joined_at — Biwenger team) a la nueva liga.

ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_bot BOOLEAN NOT NULL DEFAULT false;
CREATE INDEX IF NOT EXISTS idx_profiles_is_bot ON profiles(is_bot) WHERE is_bot = true;

CREATE OR REPLACE FUNCTION public.replicate_bot_to_league(target_league_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $func$
DECLARE
  v_bot_id uuid;
  v_source_league_id uuid;
BEGIN
  SELECT id INTO v_bot_id FROM profiles WHERE is_bot = true LIMIT 1;
  IF v_bot_id IS NULL THEN RETURN; END IF;
  SELECT league_id INTO v_source_league_id
    FROM league_members WHERE user_id = v_bot_id ORDER BY joined_at LIMIT 1;
  IF v_source_league_id IS NULL OR v_source_league_id = target_league_id THEN RETURN; END IF;

  INSERT INTO league_members (league_id, user_id, joined_at, porra_cerrada, cerrada_at, groups_saved)
  SELECT target_league_id, v_bot_id, now(), porra_cerrada, cerrada_at, groups_saved
    FROM league_members WHERE user_id = v_bot_id AND league_id = v_source_league_id
  ON CONFLICT (league_id, user_id) DO NOTHING;

  INSERT INTO predictions (user_id, match_id, local, visitante, scorer, saved_at, league_id)
  SELECT user_id, match_id, local, visitante, scorer, now(), target_league_id
    FROM predictions WHERE user_id = v_bot_id AND league_id = v_source_league_id
  ON CONFLICT (league_id, user_id, match_id) DO NOTHING;

  INSERT INTO ko_predictions (user_id, match_id, local, visitante, classifier, scorer, saved_at, league_id)
  SELECT user_id, match_id, local, visitante, classifier, scorer, now(), target_league_id
    FROM ko_predictions WHERE user_id = v_bot_id AND league_id = v_source_league_id
  ON CONFLICT (league_id, user_id, match_id) DO NOTHING;

  INSERT INTO award_picks (user_id, golden_ball, golden_boot, golden_glove, young_player, saved_at, league_id)
  SELECT user_id, golden_ball, golden_boot, golden_glove, young_player, now(), target_league_id
    FROM award_picks WHERE user_id = v_bot_id AND league_id = v_source_league_id
  ON CONFLICT (league_id, user_id) DO NOTHING;
END;
$func$;

CREATE OR REPLACE FUNCTION public.trg_replicate_bot_on_new_league()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER
AS $trg$ BEGIN PERFORM public.replicate_bot_to_league(NEW.id); RETURN NEW; END; $trg$;

DROP TRIGGER IF EXISTS replicate_bot_on_new_league ON public.leagues;
CREATE TRIGGER replicate_bot_on_new_league
AFTER INSERT ON public.leagues FOR EACH ROW
EXECUTE FUNCTION public.trg_replicate_bot_on_new_league();
