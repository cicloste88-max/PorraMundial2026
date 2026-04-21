-- Migración: crear tablas para sistema IA Predictor
-- Arquitectura 3 capas: ingesta (actores Apify) → cálculo (EF porra-ia-compute) → consumo (frontend)
-- Decidida sesión Claude.ai 21abr2026
-- Fórmula: ELO 50 / H2H 25 / Racha 25, fallback a ELO+modulación racha si H2H inexistente

-- Tabla 1: ELO FIFA (211 selecciones aprox)
CREATE TABLE IF NOT EXISTS ia_elo_fifa (
  team_code TEXT PRIMARY KEY,
  team_name TEXT NOT NULL,
  elo_points NUMERIC(7,2) NOT NULL,
  rank_position INT,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source TEXT DEFAULT 'fifa.com/ranking/men'
);

-- Tabla 2: últimos 5 resultados (48 mundialistas)
CREATE TABLE IF NOT EXISTS ia_last5_results (
  team_code TEXT PRIMARY KEY REFERENCES ia_elo_fifa(team_code) ON DELETE CASCADE,
  results JSONB NOT NULL,
  wins INT NOT NULL DEFAULT 0,
  draws INT NOT NULL DEFAULT 0,
  losses INT NOT NULL DEFAULT 0,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Tabla 3: head to head (pares alfabéticamente ordenados)
CREATE TABLE IF NOT EXISTS ia_h2h (
  team_a_code TEXT NOT NULL,
  team_b_code TEXT NOT NULL,
  matches JSONB,
  team_a_wins INT DEFAULT 0,
  team_b_wins INT DEFAULT 0,
  draws INT DEFAULT 0,
  last_played DATE,
  scraped_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (team_a_code, team_b_code),
  CONSTRAINT h2h_alphabetical CHECK (team_a_code < team_b_code)
);

-- Tabla 4: predicciones finales calculadas
CREATE TABLE IF NOT EXISTS ia_predictions (
  match_id TEXT PRIMARY KEY,
  home_code TEXT NOT NULL,
  away_code TEXT NOT NULL,
  sign CHAR(1) NOT NULL CHECK (sign IN ('1','X','2')),
  confidence SMALLINT NOT NULL CHECK (confidence BETWEEN 0 AND 100),
  breakdown JSONB NOT NULL,
  used_fallback BOOLEAN NOT NULL DEFAULT FALSE,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_ia_predictions_computed ON ia_predictions(computed_at DESC);
CREATE INDEX IF NOT EXISTS idx_ia_last5_scraped ON ia_last5_results(scraped_at DESC);

-- RLS: lectura pública solo en ia_predictions; resto solo service role
ALTER TABLE ia_elo_fifa ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_last5_results ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_h2h ENABLE ROW LEVEL SECURITY;
ALTER TABLE ia_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ia_predictions_public_read" ON ia_predictions
  FOR SELECT USING (true);
