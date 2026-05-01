# Predictor — Snapshot schema BD vivo (pre-C1)

**Generado:** 30 abr 2026 por San (queries Supabase MCP desde Claude.ai)
**Propósito:** referencia para F7.7-IA / C1 (`ALTER TABLE profiles ADD is_bot` + trigger `after_league_insert` + seed `ia_user_id`).

> **Aviso (riesgo #1 del A1).** Las tablas listadas a continuación **no tienen migración versionada** en `supabase/migrations/`. La app funciona contra Supabase Cloud porque fueron creadas en sesiones anteriores sin commit del SQL. Este documento captura el estado real para que C1 escriba migraciones idempotentes correctas (sin asumir nombres del bundle inicial — confirmados aquí).

---

## `profiles`

| Columna | Tipo | Default / Notas |
|---|---|---|
| `id` | uuid | sin default (1:1 con `auth.users.id`) |
| `nombre` | text | |
| `inscrito` | bool | |
| `is_admin` | bool | |
| `created_at` | timestamptz | |
| `porra_cerrada` | bool | (legado a nivel perfil — `league_members.porra_cerrada` es la fuente de verdad por liga) |
| `cerrada_at` | timestamptz | |

**C1 añade:** `is_bot BOOLEAN DEFAULT false NOT NULL`.

---

## `leagues`

| Columna | Tipo | Default / Notas |
|---|---|---|
| `id` | uuid | `gen_random_uuid()` |
| `nombre` | text | |
| `codigo` | text | |
| `created_by` | uuid | FK auth.users |
| `created_at` | timestamptz | |

**C1 añade:** trigger `after_league_insert` que inserta el bot IA en `league_members`.

---

## `league_members`

| Columna | Tipo | Default / Notas |
|---|---|---|
| `league_id` | uuid | |
| `user_id` | uuid | |
| `joined_at` | timestamptz | |
| `porra_cerrada` | bool | default false |
| `cerrada_at` | timestamptz | |
| `groups_saved` | jsonb | (mobile-focus persistencia) |

**C1:** trigger `after_league_insert` aprovecha `porra_cerrada` ya existente — INSERT `(league_id, ia_user_id, porra_cerrada=true)`.

---

## `award_picks`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | (PK) | |
| `user_id` | uuid | |
| `golden_ball` | text | ⚠️ nombres en INGLÉS |
| `golden_boot` | text | ⚠️ |
| `golden_glove` | text | ⚠️ |
| `young_player` | text | ⚠️ |
| `saved_at` | timestamptz | |
| `league_id` | uuid | |

**Ajuste vs bundle:** §1.6 del bundle hablaba de `balon_oro / bota_oro / guante_oro / mejor_joven`. **Los nombres reales en BD están en inglés** (`golden_ball / golden_boot / golden_glove / young_player`). B5 (Trophy modal renderer) y C4 (insert masivo) usan estos nombres tal cual.

**Mapping ES→EN para UI:**
- "Balón de Oro" → `golden_ball`
- "Bota de Oro" → `golden_boot`
- "Guante de Oro" → `golden_glove`
- "Mejor Joven (≤21)" → `young_player`

---

## `predictions`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | (PK) | |
| `user_id` | uuid | |
| `match_id` | text | identificador partido grupos |
| `local` | int | goles equipo local pronosticados |
| `visitante` | int | goles equipo visitante pronosticados |
| `scorer` | text | clave goleador (formato `EQUIPOS[].players[].key`) |
| `saved_at` | timestamptz | |
| `league_id` | uuid | |

---

## `ko_predictions`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | (PK) | |
| `user_id` | uuid | |
| `match_id` | **integer** | ⚠️ tipo distinto de `predictions.match_id` (text) — para C2/C4 |
| `local` | int | |
| `visitante` | int | |
| `classifier` | text | clasificado a la siguiente ronda (clave equipo) |
| `scorer` | text | |
| `saved_at` | timestamptz | |
| `league_id` | uuid | |

---

## `boost_picks`

| Columna | Tipo | Notas |
|---|---|---|
| `id` | (PK) | |
| `user_id` | uuid | |
| `league_id` | uuid | |
| `match_id` | text | ⚠️ text (igual que `predictions`, distinto de `ko_predictions`) — para C3 |
| `match_date` | date | clave por la que se indexa el boost diario |
| `created_at` | timestamptz | |

---

## Notas para implementación

1. **C1 migración idempotente**: usar `ADD COLUMN IF NOT EXISTS`, `CREATE TRIGGER IF NOT EXISTS`, `INSERT … ON CONFLICT (id) DO NOTHING`.
2. **C4 insert masivo IA**: 72 filas en `predictions`, 32 en `ko_predictions` (ojo `match_id integer`), 1 en `award_picks` (campos en inglés), 23 en `boost_picks` (17 grupos + 6 KO, `match_id text`).
3. **C3 cálculo boost por jornada**: el `match_date` es la clave operativa — un boost por día. Confirmar con el calendario que cada jornada tiene un día único de cierre o ajustar a uno por jornada agrupando partidos del mismo día.
4. **B5 trophy modal renderer**: leer columnas `golden_ball / golden_boot / golden_glove / young_player` de `award_picks` filtrado por `user_id` + `league_id` activa.
