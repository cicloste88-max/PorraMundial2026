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

## Tablas de resultados (scoring) + puente live

Las tres se aplicaron/migraron **vía MCP (lane Claude.ai, sin migration file)** el 01-jun-2026; los `CREATE TABLE` de abajo son ilustrativos del estado vivo.

### `results`

Fila única (singleton) con todos los resultados canónicos que consume el scoring. **P1 (01-jun-2026)**: las columnas de payload migraron de `text` (con `JSON.parse` en cliente) a **`jsonb`**; `ko_results` se normalizó de array a objeto en el proceso.

```sql
CREATE TABLE results (
  id INT PRIMARY KEY,            -- singleton
  match_results JSONB,           -- grupos: { "{grupo}_{home_es}_{away_es}": {l,v,scorers[],status} }
  ko_results JSONB,              -- eliminatorias (normalizada array→objeto en P1)
  award_winners JSONB,           -- premios individuales resueltos
  classification JSONB,          -- clasificación final (1º/2º/3º/4º)
  overrides JSONB,               -- correcciones manuales: merge ENCIMA de match_results por clave
  log JSONB,                     -- traza de escrituras (puente / update-results)
  updated_at TIMESTAMPTZ
);
```

- **Clave de `match_results`** = `{grupo}_{home_es}_{away_es}` = `getMatchKey` (`data.js`) = `predictions.match_id` (`admin.js`).
- **Consumidores**: `get-league-standings` lee con reader type-tolerant `asObj()` (funciona pre/post jsonb) y mergea `overrides` encima del canónico; `update-results` (v5) escribe `match_results` como objeto; `porra-bridge-results` escribe `match_results[...]` vía `jsonb_set`.

### `wc_matches`

Espejo DB de `public/data/worldcup-2026-matches.json` (72 partidos de grupos). Fuente de runtime del puente `porra-bridge-results`: resuelve equipos/orientación por `match_key`.

```sql
CREATE TABLE wc_matches (
  match_key TEXT PRIMARY KEY,    -- wc2026_g{LETRA}_{sofascore_id}
  sofascore_id BIGINT,
  group_letter TEXT,             -- 'A'..'L'  (en el JSON el campo se llama "group")
  home_es TEXT,                  -- nombre canónico del proyecto (= keyspace de predictions/results)
  away_es TEXT,
  home_iso3 TEXT,                -- iso3 de home_es (añadidos en P3c)
  away_iso3 TEXT,                -- iso3 de away_es (añadidos en P3c)
  teams_swapped BOOLEAN,         -- true si SofaScore invierte home/away vs proyecto
  round INT,
  date_utc TEXT,
  updated_at TIMESTAMPTZ
);
```

### `equipos_players`

Espejo DB de `public/data/equipos-players.json` (48 selecciones). Fuente de la normalización de goleador del puente (`playerToShortKey`).

```sql
CREATE TABLE equipos_players (
  iso3 TEXT PRIMARY KEY,
  players JSONB,                 -- [{ key, name }] — key = goleador corto que usa el picker
  updated_at TIMESTAMPTZ
);
```

⚠️ **Dependencia de recarga (`wc_matches` + `equipos_players`)**: son espejos de JSON del repo. Si cambia el JSON fuente (p.ej. sync de squads enriquece `equipos-players.json`, o se añaden campos a `worldcup-2026-matches.json`), hay que **RECARGAR la tabla** (`UPDATE … FROM jsonb_each(...)`). Repo y tabla NO se sincronizan solos. Detalle del puente en `docs/live-scoring.md`.

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

## Tablas Pizarra Táctica

### `squads`

Una fila por selección clasificada al Mundial 2026 (48 filas). Consumida por la EF `get-squad` que sirve a la Pizarra Táctica modal (`public/js/ui-pizarra-tactica.js`).

```sql
CREATE TABLE squads (
  iso3 TEXT PRIMARY KEY,                       -- ISO-3 (ARG, ESP, MEX...)
  iso2 TEXT NOT NULL,                          -- ISO-2 para bandera
  equipo TEXT,                                 -- nombre largo en castellano
  formacion TEXT,                              -- '4-3-3' | '4-4-2' | ... (12 valores en POS_BY_FORMATION)
  entrenador TEXT,
  stat_edad NUMERIC,                           -- edad media de la plantilla
  stat_valor TEXT,                             -- valor de mercado (texto, ej. '€420M')
  stat_goles NUMERIC,                          -- goles/partido desde Qatar 2022
  color_ficha TEXT,                            -- color de los tokens del XI (hex o 'white')
  color_portero TEXT,                          -- color de la ficha del portero (hex)
  plantilla_completa BOOLEAN DEFAULT false,    -- legacy v5: true cuando los 11 titulares tienen nombre real
  jugadores JSONB,                             -- v5: array de 11 titulares (XI directo).
                                               -- v6: array completo 23-55 jugadores con flag `es_titular` (true para los 11 del XI).
  fuente TEXT,                                 -- 'ff' | 'as' | '365' | 'infobae' | 'fifa-official'
  updated_at TIMESTAMPTZ,
  -- ── Columnas nuevas v6 (aplicadas 13 may 2026 vía MCP, sin migration file) ──
  jugadores_is_final BOOLEAN NOT NULL DEFAULT false,  -- true cuando la plantilla es la prelista/lista FINAL FIFA (no provisional)
  jugadores_fuente TEXT,                              -- fuente concreta del array jugadores: 'ff' | 'as' | '365' | 'infobae' | 'fifa-official'
  jugadores_synced_at TIMESTAMPTZ,                    -- timestamp del último sync del array jugadores (distinto de updated_at general)
  tm_id INT                                           -- Transfermarkt verein id (canónico) — usado por enrich-tm. NULL para 42/48 hasta descubrirse
);
```

**Nombre del equipo en castellano**: columna `equipo` (NO `nombre_pais` ni
`team_name_es`). Cualquier consulta desde el frontend o EFs debe usar `equipo`.

**Estrategia de carga ratificada (13 may 2026)**: prioridad `FutbolFantasy` (primaria, info más fresca en castellano) → `AS` (backup) → `Transfermarkt` (enriquecimiento edad/valor) → `FIFA.com` snapshot final 2 jun (dorsales + fotos vía Chrome MCP).

**Estado (01-jun-2026, verificado MCP)**: 48 filas; **46 FINAL**
(`jugadores_is_final=true`, todas con ≥11 jugadores), **2 pendientes** de lista
FIFA — **TUR y UZB**, ambas vacías — a la espera de la publicación oficial
~2-jun. QAT cerró su lista FINAL (26, `as+espn+tm+tm-mw`) durante la sesión.
Detect cross-validate 2-of-N sobre 5 fuentes primarias (AS + Sport.es +
Olympics + Eurosport + Marca); FF queda como secundaria solo para XI titular
sobre selecciones ya marcadas FINAL. Enriquecimiento TM en step 2 del cron.
Detalle: `docs/sync-squads.md` + `.claude/rules/sync-squads.md`.

## Row-Level Security

Las cinco tablas `ia_*` tienen RLS habilitado.

- **`ia_predictions`**: policy `ia_predictions_public_read` — cualquier `authenticated` puede SELECT. El frontend la consume directamente.
- **`ia_elo_fifa`**: policy `ia_elo_fifa_select_authenticated` (creada 19-may en migración `20260519103959_fix_rls_ia_elo_fifa_select_authenticated.sql`, idempotente con `DROP POLICY IF EXISTS`). Necesaria para que `getAwardCandidates` (scoring.js BD-driven Polish v1 Fix Pack 2) lea el ranking Elo. Service role bypassea RLS — las EFs del pipeline no requieren policy.
- **`ia_h2h` y `ia_last5_results`**: **sin policy SELECT actualmente**. No consumidas por frontend (datos derivados llegan via `ia_predictions.breakdown` JSONB). **Pendiente sprint hardening security post-Mundial**: añadir policy SELECT authenticated si en algún momento se consumen directamente desde frontend, o policy explícita deny-all si se quiere reafirmar el acceso restricto a service_role.
- **`ia_snapshots`**: solo accesible por service role (las EFs del pipeline IA Predictor).

**Patrón ERR-58**: tabla con RLS enabled SIN policy SELECT devuelve `[]` silenciosamente para `authenticated` (no es error 403, es filtrado RLS deny-all por defecto). Smoke post-migración: query desde JWT `authenticated`, no `service_role` (bypasea RLS).

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
