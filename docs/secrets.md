# Secrets — Porra Mundial 2026

## Cloudflare Turnstile

**DESACTIVADO 30abr2026** vía Supabase Auth dashboard. Decisión: app privada (~15 jugadores), fricción innecesaria + Supabase Cloud single-secret slot + Cloudflare no acepta ports localhost. Widget HTML/JS en `index.html` y `auth.js` permanecen (no estorban; no ejecutan sin secret en Auth).

## Clasificación Vault vs EF secrets

Regla mental:
- **Vault** = se consume desde SQL/pg_net (EFs entre sí, crons, flows MCP).
- **EF secrets** (`Deno.env.get`) = API keys externas consumidas directamente desde código de una EF.

## Vault de Supabase

Acceso: `vault.decrypted_secrets` desde SQL o RPC `get_vault_secrets`. Ver ERR-27 (`supabase-js` no enruta `from("vault.x")` ni `.schema("vault")`). Ver ERR-04 (whitespace invisible — siempre `TRIM()`).

| Secret | Consumidores |
|---|---|
| `GITHUB_TOKEN`, `GITHUB_REPO` | `porra-patch-deploy`, `porra-fix-encoding`, queries pg_net desde Claude.ai MCP |
| `APIFY_TOKEN` | `porra-match-live` lanza actor Webshare |
| `PROXY_URL` | Fallback scraping (legacy) |
| `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY`, `TWILIO_API_SECRET` | `porra-apify-webhook`, `porra-whatsapp-send` |
| `IA_CRON_KEY` | 64 chars hex. Header `X-Cron-Key` autentica pg_cron contra `porra-ia-compute` (Fase E) |
| `SUPABASE_SERVICE_ROLE_KEY` | Duplicado intencional del EF secret. Para que `net.http_post` desde SQL inserte `Authorization: Bearer ${service_role}`. Al rotar service_role: actualizar en AMBOS sitios |

## EF secrets (`Deno.env.get`)

| Secret | EF | Notas |
|---|---|---|
| `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_ANON_KEY` | Todas | Inyectadas automáticamente por Supabase |
| `ANTHROPIC_API_KEY` | `porra-ia-compute` | quipGenerator (Claude Haiku 4.5), Fase E |
| `FOOTBALL_DATA_API_KEY` | `update-results` | Sync resultados oficiales |

## Patrones de acceso

- **Desde SQL/pg_net**: `SELECT TRIM(decrypted_secret) FROM vault.decrypted_secrets WHERE name='X'`
- **Desde EF**: `Deno.env.get('SUPABASE_URL')`
- **Desde EF a Vault** (ej. `GITHUB_TOKEN`): RPC `get_vault_secrets` (ver `.claude/rules/edge-functions.md` §RPC vault).
- **Rotación de `SUPABASE_SERVICE_ROLE_KEY`**: actualizar en (1) Supabase project settings → API (auto-propaga a EFs) **Y** (2) Vault entry homónima (no auto-propaga).
