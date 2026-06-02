---
description: Reglas para tocar Edge Functions de Supabase
globs:
  - supabase/functions/**
---

# Reglas — Edge Functions Supabase

## Cuándo se carga esta regla

Al tocar archivos dentro de `supabase/functions/**`.

## verify_jwt — caveat plataforma

Supabase rechaza JWT con algoritmo ES256 cuando `verify_jwt=true` en la configuración de una Edge Function. La solución es desactivar la verificación automática (`verify_jwt=false`) e implementar validación manual dentro de la función utilizando la clave `service_role`.

Referencia: ERR-16.

## Deploy: CLI local vs MCP

Deployments de Edge Functions con payload superior a 70 KB no se pueden procesar a través del MCP `deploy_edge_function` (timeout). En estos casos, ejecutar desde terminal local:

```bash
npx supabase functions deploy <function-name>
```

Este workflow preventivo evita bloqueos. Referencia: ERR-29.

## Secrets: Vault vs EF secrets

**Decisión rápida:**
- **Vault**: secretos consumidos desde SQL, `pg_net`, crons o flows MCP.
- **EF secrets** (`Deno.env.get`): API keys externas consumidas directamente en código Deno.

**Vault contiene:** `GITHUB_TOKEN`, `APIFY_TOKEN`, `TWILIO_*`, `IA_CRON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (mirror).

**EF secrets contienen:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` (auto-inyectadas), `ANTHROPIC_API_KEY`, `FOOTBALL_DATA_API_KEY`.

Detalle completo en `docs/architecture.md` §Secrets.

## Acceder a Vault desde una EF

La consulta directa a `vault.decrypted_secrets` mediante `.from("vault.decrypted_secrets")` no enruta al schema `vault`. `.schema("vault")` tampoco funciona porque el schema no está expuesto en `api.schemas`.

**Solución:** utilizar la RPC `get_vault_secrets` mediante `fetch` directo desde la Edge Function.

Referencia: ERR-27.

## ANTHROPIC_API_KEY pattern

Vive en EF secrets de `porra-ia-compute` (no en Vault). Consumir vía:

```typescript
const apiKey = Deno.env.get("ANTHROPIC_API_KEY");
```

Mismo patrón aplica para `FOOTBALL_DATA_API_KEY` en `update-results`.

## Tablas de runtime espejo de JSON del repo (recarga obligatoria)

Algunas EFs leen tablas que son **espejo 1:1 de ficheros JSON versionados en el repo**, cargadas vía MCP (sin migration file):

| Tabla | Filas | Fuente repo | EF consumidora |
|---|---|---|---|
| `wc_matches` | 72 | `public/data/worldcup-2026-matches.json` | `porra-bridge-results` |
| `equipos_players` | 48 | `public/data/equipos-players.json` | `porra-bridge-results` |

**Regla**: editar el JSON en el repo **NO** actualiza la tabla. Tras cualquier cambio en el JSON fuente (p.ej. el sync de squads enriquece `equipos-players.json`, o se añaden campos a `worldcup-2026-matches.json` como en P3c), hay que **RECARGAR la tabla** vía MCP (`UPDATE … FROM jsonb_each(...)`). Si no, la EF queda leyendo datos viejos silenciosamente. Esquema en `docs/db-schema.md`; flujo del puente en `docs/live-scoring.md` §Puente.

## Puente `porra-bridge-results` — invocación canónica (trigger + barrido)

El volcado `live_scores` → `results` es **automático** (P4, 02-jun-2026). **NO invocar el puente a mano** salvo debug puntual:

- **Camino feliz**: trigger `bridge_on_finished` (`AFTER UPDATE OF status ON live_scores`) dispara el puente vía `net.http_post` en la transición real a `finished` con marcador no-null.
- **Red de seguridad**: cron `sweep-unbridged-finished` (`*/5min`) reprocesa partidos finished huérfanos (finished con dato completo pero sin entrada en `results`).

El puente trae **guardas anti-dato-incompleto**: si el marcador es NULL, la clave no resuelve, o un KO empatado no tiene ganador determinable, **NO escribe** y loguea `{event:'bridge_skip', reason}` en `results.log` (premisa "no rectificar después"). Ante un partido finished ausente de `results`, **mirar `results.log` antes de re-disparar a mano** — probablemente fue un skip deliberado y el barrido lo reintentará al completarse el dato.

**Rama KO**: resuelve el `match_key` de KO contra `wc_matches_ko` (tabla diccionario, runtime-only, vacía hasta ~28-jun) y escribe `ko_results` con `winner` (incluye desempate por penaltis; `penaltyShootout` NO cuenta como goleador). Detalle: `docs/live-scoring.md` §Bloque crítico + ERR-82.

> ⚠️ **Drift**: el trigger `trg_bridge_on_finished()`, las funciones `sweep_unbridged_finished()` / `dispatch_live_slots()` (cron `dispatch-live-slots`, `*/3min`) y la tabla `wc_matches_ko` viven **solo en runtime** (creados vía MCP, sin migration file). Pendiente backfill a `supabase/migrations/`.

## Migration log obligatorio

Toda EF nueva o cambio de versión requiere entrada en `migration-log.md` con:

- Hora `[HH:MM]` y acción
- Nombre de la función + versión nueva
- Cambio realizado (creación, actualización, deprecación)
- Notas operativas relevantes

## Caveat E13 (subagentes)

Subagentes Task con tool Write NO heredan `.claude/rules/` (GH#23478). Si se delega escritura de EFs a un subagente, pasar contexto inline o recuperar Write al padre.
