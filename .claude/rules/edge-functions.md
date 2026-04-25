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

## Migration log obligatorio

Toda EF nueva o cambio de versión requiere entrada en `migration-log.md` con:

- Hora `[HH:MM]` y acción
- Nombre de la función + versión nueva
- Cambio realizado (creación, actualización, deprecación)
- Notas operativas relevantes

## Caveat E13 (subagentes)

Subagentes Task con tool Write NO heredan `.claude/rules/` (GH#23478). Si se delega escritura de EFs a un subagente, pasar contexto inline o recuperar Write al padre.
