# Esquema de base de datos — Porra Mundial 2026

## Tablas live

### `live_scores`

Tabla principal con el estado en tiempo real de cada partido (Mundial + simulacros). Alimentada por la EF `porra-apify-webhook` (ver `docs/live-scoring.md`).

```sql
CREATE TABLE live_scores (
  match_key TEXT PRIMARY KEY,
  sofascore_url TEXT,
  sofascore_event_id TEXT,
  status TEXT,                 -- notstarted/inprogress/halftime/overtime/penalties/finished
  status_code INT,
  score_home INT,
  score_away INT,
  score_agg_home INT,
  score_agg_away INT,
  events JSONB,                -- timeline de goles, tarjetas, cambios
  lineups JSONB,
  statistics JSONB,
  referee TEXT,
  venue TEXT,
  poll_active BOOLEAN,
  poll_interval INT,
  had_overtime BOOLEAN,
  had_penalties BOOLEAN,
  match_start_ts BIGINT,
  is_historic BOOLEAN DEFAULT false,
  -- is_historic=true: simulacros / pruebas. NO usar en scoring ni UI live (filtrar WHERE is_historic=false)
  home_team_name TEXT,         -- nombres para simulacros (partidos fuera del Mundial)
  away_team_name TEXT,         -- idem; para el Mundial los nombres salen de EQUIPOS via match_key
  competition TEXT,            -- ej. "Copa del Rey 2026 · Final" — render en pie de tarjeta simulacro
  updated_at TIMESTAMPTZ
);
```

### `whatsapp_subscribers`

Suscriptores activos para entrega de notificaciones live.

```sql
CREATE TABLE whatsapp_subscribers (
  phone TEXT,
  active BOOLEAN,
  wa_id TEXT
);
```

## Tablas IA Predictor

Cuatro tablas que sustentan el motor de predicción descrito en `docs/ia-predictor.md`. Migración canónica: `supabase/migrations/20260421_create_ia_predictor_tables.sql` (Fase A). Todas con RLS habilitado.

### `ia_elo_fifa`

Ranking ELO/FIFA de cada selección. ~211 filas tras `scrape_elo`.

```sql
CREATE TABLE ia_elo_fifa (
  team_code TEXT PRIMARY KEY,     -- ISO-3 (ej. MEX, ARG, BRA)
  team_name TEXT,
  elo_points NUMERIC(7,2),
  rank_position INT,
  scraped_at TIMESTAMPTZ,
  source TEXT
);
```

### `ia_last5_results`

Últimos N resultados de cada equipo para la señal de forma reciente. 48 filas (1 por mundialista).

```sql
CREATE TABLE ia_last5_results (
  team_code TEXT PRIMARY KEY REFERENCES ia_elo_fifa(team_code),
  results JSONB,
  -- array ascendente de N objects: {date, opponent_name, opponent_iso3, venue, result, gf, ga, competition}
  wins INT,
  draws INT,
  losses INT,
  scraped_at TIMESTAMPTZ
);
```

### `ia_h2h`

Historial agregado de encuentros directos entre pares de equipos (orden alfabético por código).

```sql
CREATE TABLE ia_h2h (
  team_a_code TEXT,               -- alfabético: team_a < team_b
  team_b_code TEXT,
  matches JSONB,                  -- {total, gf_team_a, ga_team_a, source_team, source}
  team_a_wins INT,
  team_b_wins INT,
  draws INT,
  last_played DATE,               -- null en el origen 11v11/stats (agregado sin fecha)
  scraped_at TIMESTAMPTZ,
  PRIMARY KEY (team_a_code, team_b_code),
  CONSTRAINT h2h_alphabetical CHECK (team_a_code < team_b_code)
);
```

### `ia_predictions`

Predicción final por partido + desglose `breakdown` con raw context post-Fase F.

```sql
CREATE TABLE ia_predictions (
  match_id TEXT PRIMARY KEY,
  home_code TEXT,
  away_code TEXT,
  sign CHAR(1) CHECK (sign IN ('1','X','2')),
  confidence SMALLINT CHECK (confidence BETWEEN 0 AND 100),
  breakdown JSONB,
  -- {elo_score, h2h_score, last5_score, raw_home_pct} + 9 raw context fields post-Fase F:
  -- elo_home_raw, elo_away_raw, h2h_home_wins, h2h_away_wins, h2h_draws, h2h_total,
  -- form_home_ppg, form_away_ppg, is_host
  used_fallback BOOLEAN,          -- true si se aplicó ELO 85 + Racha 15 (H2H<5)
  computed_at TIMESTAMPTZ
);
```

### `ia_snapshots`

Tabla complementaria (Fase E). Garantiza que la snapshot congelada el 11 jun 00:00 UTC es inmutable durante el torneo. Schema canónico en la migración de Fase E. Invariante crítico: **exactamente 1 fila con `is_active=true`** y FK desde `ia_predictions` apuntando al `snapshot_id` activo.

## Row-Level Security

Las cuatro tablas `ia_*` tienen RLS habilitado.

- **Política pública**: `ia_predictions_public_read` — cualquier `authenticated` puede SELECT en `ia_predictions`. El frontend la consume directamente.
- **Acceso restringido**: `ia_elo_fifa`, `ia_last5_results`, `ia_h2h`, `ia_snapshots` solo accesibles por service role (las EFs del pipeline).

## Funciones helper

### `schedule_match_crons(match_key TEXT, start_ts TIMESTAMPTZ)`

Genera automáticamente los dos crons de un partido:

- `prematch_<match_key>`: 1 call a T-45min antes del kickoff.
- `poll_<match_key>`: polling `*/3 * * * *` durante 150min desde `start_ts`.

Ambos invocan `porra-match-live` con el `match_key` recibido.

```sql
SELECT schedule_match_crons('wc2026_gA_15186710', '2026-06-11 20:00:00+00'::timestamptz);
```

### `unschedule_match_crons(match_key TEXT)`

Elimina los dos crons asociados al partido. Uso: limpieza tras cambio de fecha o cancelación.

```sql
SELECT unschedule_match_crons('wc2026_gA_15186710');
```

## Convenciones

- **Crons de partidos**: usar **siempre** `schedule_match_crons`, nunca duplicar manualmente. Esto evita crons huérfanos y garantiza consistencia.
- **`match_key` interno**: formato `wc2026_g{LETRA}_{sofascore_id}` (ej. `wc2026_gA_15186710`). PK en `live_scores` y clave en `public/data/worldcup-2026-matches.json`. El sufijo numérico coincide con `sofascore_id` para cross-lookup rápido entre nuestras estructuras y el actor Apify (ver `docs/live-scoring.md`).
- **`is_historic` filter**: todo SELECT sobre `live_scores` que alimente UI del Mundial debe filtrar `WHERE is_historic = false` (los simulacros se procesan por el mismo pipeline pero no son del torneo — ver `docs/simulacros.md`).
