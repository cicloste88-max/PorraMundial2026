# Simulacros — Testing live pre-Mundial

## Propósito

Probar el pipeline live completo (Apify → webhook → `live_scores` → realtime → UI + WhatsApp) con partidos reales fuera del Mundial **antes del 11 jun**, sin contaminar los datos del torneo. Sirve como entorno de validación del flujo de scoring en directo antes de que comience la competición oficial.

## Cómo activar un simulacro

**Paso 1: insertar fila en `live_scores`** con `is_historic = true`:

```sql
INSERT INTO live_scores (
  match_key, sofascore_event_id,
  home_team_name, away_team_name, competition,
  match_start_ts, status, is_historic
) VALUES (
  'copadelrey_final_atm_rso', '15664537',
  'Atlético de Madrid', 'Real Sociedad', 'Copa del Rey 2026 · Final',
  extract(epoch FROM '2026-04-18 19:00:00+00'::timestamptz)::bigint,
  'notstarted', true
);
```

**Paso 2: programar crons** con el helper canónico:

```sql
SELECT schedule_match_crons(
  'copadelrey_final_atm_rso',
  '2026-04-18 19:00:00+00'::timestamptz
);
```

Esto crea automáticamente: `prematch_<match_key>` (1 call a T-45min) + `poll_<match_key>` (cada 3 min durante 150min desde `start_ts`).

## Visibilidad

- Sólo usuarios con `profiles.is_admin = true` ven la sección 🧪 Simulacros activos dentro de la vista Directo.
- La fila se procesa por el pipeline normal (Apify, webhook, WhatsApp si está suscrito), pero **no aparece** en las 72 tarjetas del Mundial ni se considera para scoring (filtro `is_historic = false`).

## Caso de referencia (cerrado)

**Copa del Rey 2026 — Final**

| Campo | Valor |
|---|---|
| Partido | Atlético de Madrid vs Real Sociedad |
| Fecha/hora | 18 abr 2026 19:00 UTC (21:00 CEST) |
| `match_key` | `copadelrey_final_atm_rso` |
| `sofascore_event_id` | `15664537` |
| Crons | `prematch_copadelrey_final_atm_rso` (18:15 UTC) + `poll_copadelrey_final_atm_rso` (cada 3 min, 19:00–22:00 UTC) |

Este simulacro validó el pipeline completo antes del Mundial.

---

Pipeline async + webhook detallado en `docs/live-scoring.md`. Workflow de descubrimiento de `eventId` también en `docs/live-scoring.md`. Schema de `live_scores` y helpers DB en `docs/db-schema.md`. Errores conocidos en `errores_conocidos_porra.md`.
