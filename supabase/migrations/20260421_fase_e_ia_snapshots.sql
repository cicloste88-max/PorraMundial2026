-- Migración Fase E — IA Predictor motor de cómputo
-- Decidida sesión Claude.ai 21abr2026. Spec en docs/fase_e/SPEC_FASE_E_CODE.md.
--
-- Principio de producto: la IA es un competidor más. Se congela con snapshot del
-- 11 jun 00:00 UTC y NO se adapta al torneo. Cualquier usuario en cualquier
-- momento consultando el mismo cruce recibe la MISMA predicción (fairness).
--
-- Contenido:
--   1. Tabla ia_snapshots (nueva) con invariante "solo 1 activo a la vez".
--   2. Alter ia_predictions: FK a snapshot + flag is_ko_ondemand + índice lookup.
--   3. CHECK defense-in-depth en ia_h2h (coexiste con h2h_alphabetical de Fase A).
--   4. Cron nocturno cleanup de snapshots inactivos >7d + sus predictions.

-- ─── 1. Tabla ia_snapshots ──────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS ia_snapshots (
    id              BIGSERIAL PRIMARY KEY,
    snapshot_date   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    label           TEXT NOT NULL,
    elo_count       INT NOT NULL,
    h2h_count       INT NOT NULL,
    last5_count     INT NOT NULL,
    is_active       BOOLEAN NOT NULL DEFAULT FALSE,
    created_by      TEXT
);

-- Solo 1 snapshot activo a la vez (invariante de dominio).
CREATE UNIQUE INDEX IF NOT EXISTS idx_ia_snapshots_one_active
    ON ia_snapshots (is_active) WHERE is_active = TRUE;

-- Índice para cleanup nocturno por fecha.
CREATE INDEX IF NOT EXISTS idx_ia_snapshots_inactive_old
    ON ia_snapshots (snapshot_date)
    WHERE is_active = FALSE;

ALTER TABLE ia_snapshots ENABLE ROW LEVEL SECURITY;
-- Sin policy pública: solo service_role accede desde las EFs.


-- ─── 2. Alter ia_predictions ────────────────────────────────────────────────
ALTER TABLE ia_predictions
    ADD COLUMN IF NOT EXISTS snapshot_id BIGINT REFERENCES ia_snapshots(id);

ALTER TABLE ia_predictions
    ADD COLUMN IF NOT EXISTS is_ko_ondemand BOOLEAN NOT NULL DEFAULT FALSE;

-- Índice para lookup rápido en compute_match (find cached prediction).
CREATE INDEX IF NOT EXISTS idx_ia_predictions_lookup
    ON ia_predictions (home_code, away_code, snapshot_id);


-- ─── 3. CHECK orden canónico en ia_h2h ──────────────────────────────────────
-- La tabla ya tiene "h2h_alphabetical CHECK (team_a_code < team_b_code)"
-- desde la migración Fase A. Este CHECK adicional es defensa en profundidad
-- nombrada explícitamente (nombres distintos, mismo predicado — coexisten sin
-- conflicto). Si ya existe por una re-ejecución previa, DO NOT error.
--
-- Pre-flight (requerido por spec §2.3): ejecutar antes de este bloque
--   SELECT COUNT(*) FROM ia_h2h WHERE team_a_code >= team_b_code;
-- Debe devolver 0. Si no, limpiar con:
--   DELETE FROM ia_h2h WHERE team_a_code >= team_b_code;
-- antes de aplicar el ALTER.
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'chk_h2h_canonical_order'
          AND conrelid = 'ia_h2h'::regclass
    ) THEN
        ALTER TABLE ia_h2h
            ADD CONSTRAINT chk_h2h_canonical_order
            CHECK (team_a_code < team_b_code);
    END IF;
END $$;


-- ─── 4. Cron cleanup nocturno snapshots >7d ─────────────────────────────────
-- Borra primero ia_predictions porque no hay CASCADE configurado en el FK.
-- Idempotente: unschedule antes de schedule para poder re-ejecutar esta migración.
SELECT cron.unschedule('ia-snapshots-cleanup')
    WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'ia-snapshots-cleanup');

SELECT cron.schedule(
    'ia-snapshots-cleanup',
    '0 3 * * *',  -- Todas las noches a las 03:00 UTC
    $$
        DELETE FROM ia_predictions
        WHERE snapshot_id IN (
            SELECT id FROM ia_snapshots
            WHERE is_active = FALSE
              AND snapshot_date < NOW() - INTERVAL '7 days'
        );
        DELETE FROM ia_snapshots
        WHERE is_active = FALSE
          AND snapshot_date < NOW() - INTERVAL '7 days';
    $$
);
