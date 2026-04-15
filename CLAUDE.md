# Porra Mundial 2026 — Contexto para Claude Code

## Proyecto
App de pronósticos del Mundial 2026. Stack: HTML+CSS+JS vanilla, Supabase, Vite, Vercel.
**Producción: porramundial2026-seven.vercel.app**
Repo: github.com/cicloste88-max/PorraMundial2026
Rama activa: **main** | Último commit: **8e8ac44**

---

## ⚠️ ESTADO ACTUAL — 2026-04-15

No hay pendiente urgente de código frontend. El foco de la sesión anterior fue:

**Fix pg_net timeout en sistema live — RESUELTO ✅**

Arquitectura nueva (2 EFs):

```
pg_cron (cada minuto)
  → porra-match-live v11 (<1s, async)
      → Apify lanza actor BYLtYcOxYkruVipwr con webhook configurado
      → retorna run_id inmediatamente

~44s después
  → Apify llama → porra-apify-webhook v2
      → lee dataset actor
      → detecta cambios estado/goles
      → WhatsApp via Twilio
      → upsert live_scores
```

**Nota clave:** el `sofascore_event_id` en `live_scores` puede ser el slug de SofaScore (ej: `xdbsEgb`) además del ID numérico. El actor lo acepta.

---

## 📊 Estado sistema live

| Componente | Versión | Estado |
|---|---|---|
| Actor sofascore-live-proxy `BYLtYcOxYkruVipwr` | build 1.0.19 | ✅ FUNCIONA (~44s, tiempo real) |
| `porra-match-live` EF | v11 | ✅ Async (<1s), lanza actor + webhook |
| `porra-apify-webhook` EF | v2 | ✅ Nueva EF, procesa webhook Apify |
| `porra-whatsapp-send` EF | v1 | ✅ FUNCIONA |
| `porra-whatsapp-webhook` EF | v4 | ✅ FUNCIONA |
| Actor Azzouzana `VzKtdb1t0Qnc07X8V` | — | ❌ Caché CDN ~15min, NO usar live |

## 🎯 Partido configurado

Bayern-Real Madrid UCL QF vuelta (2026-04-15 21:00 CET):
- `match_key`: `ucl_qf2_bayern_realmadrid`
- `sofascore_event_id`: `xdbsEgb`
- Crons: `prematch_bayern_realmadrid` (18:15 UTC) + `poll_bayern_realmadrid` (cada min 19-23 UTC)

---

## 📁 Estructura ficheros JS

```
js/
  main-entry.js       <- entry point Vite (type=module)

public/js/
  data.js             <- datos torneo + estado global + boostPicks
  scoring.js          <- motor puntos + tarjetas + premios
  ui-groups.js        <- grupos + vista Jornada completa
  ko.js               <- bracket KO + IA pronósticos
  ui-nav.js           <- SPA nav + modal + welcome
  auth.js             <- auth Supabase
  leagues.js          <- ligas y selección de porra
  misc.js             <- utils UI
  scoreboard.js       <- clasificación multi-usuario
  close-porra.js      <- cierre de pronósticos
  admin.js            <- panel admin + dados/simulador
  bracket-results.js  <- vista resultados reales bracket KO

public/css/
  bracket-results.css
  boost.css
```

## Cadena de carga
```
misc.js (paralelo)
leagues → data → scoring → ui-groups → ko → ui-nav
  → auth → scoreboard → close-porra → admin → bracket-results
```

---

## 🛢️ Base de datos — tablas live

```sql
live_scores (
  match_key TEXT PRIMARY KEY,
  sofascore_url TEXT,
  sofascore_event_id TEXT,   -- ID numérico O slug SofaScore
  status TEXT,               -- notstarted/inprogress/halftime/overtime/penalties/finished
  status_code INT,
  score_home INT,
  score_away INT,
  score_agg_home INT,
  score_agg_away INT,
  events JSONB,              -- array de incidents
  lineups JSONB,
  statistics JSONB,
  referee TEXT,
  venue TEXT,
  poll_active BOOLEAN,
  poll_interval INT,
  had_overtime BOOLEAN,
  had_penalties BOOLEAN,
  match_start_ts BIGINT,
  updated_at TIMESTAMPTZ
)

whatsapp_subscribers (
  phone TEXT,
  active BOOLEAN,
  wa_id TEXT
)
```

---

## ⚙️ Edge Functions Supabase

| EF | Versión | Descripción |
|---|---|---|
| `admin-actions` | v7 | Gestión admin. Requiere JWT admin |
| `update-results` | v2 | Sync football-data.org → results. Activar pg_cron el 11 jun |
| `porra-orchestrator` | v3 | N agentes Haiku en paralelo → orchestrator_jobs |
| `porra-patch-deploy` | v4 | Patches search/replace + commit GitHub |
| `porra-fix-encoding` | v5 | Write/inspect ficheros GitHub via API |
| `porra-match-live` | v11 | Lanza actor Apify ASYNC + webhook. NO espera resultado. |
| `porra-apify-webhook` | v2 | NUEVA. Recibe callback Apify, procesa datos, WhatsApp, upsert DB |
| `porra-whatsapp-send` | v1 | Envía mensajes WhatsApp via Twilio |
| `porra-whatsapp-webhook` | v4 | Webhook entrada WhatsApp, captura WaId |
| `porra-sofascore-proxy` | v8 | OBSOLETA — sustituida por actor propio |
| `porra-github-pusher` | v6 | PLACEHOLDER — ignorar |

---

## 🔄 Flujo live scores (ACTUALIZADO)

```
pg_cron (cada minuto durante partido)
  → net.http_post → porra-match-live v11
      → lee match_key de live_scores
      → si poll_active=false: retorna skipped
      → obtiene APIFY_TOKEN de Vault
      → lanza actor BYLtYcOxYkruVipwr ASYNC via Apify API
        (con ?webhooks=BASE64_JSON apuntando a porra-apify-webhook)
      → retorna {ok:true, async:true, run_id, dataset_id} — ya terminó, <1s

~44s después (cuando actor termina)
  → Apify llama POST → porra-apify-webhook v2
      → verifica secret en query param
      → lee payload: {eventType, eventData.resource.defaultDatasetId}
      → lee dataset Apify con APIFY_TOKEN
      → extractMatchState: status, score, incidents
      → detecta cambios vs DB
      → notificaciones WhatsApp si estado cambió o hay goles nuevos
      → upsert live_scores
```

---

## 📱 WhatsApp — Twilio sandbox

- Número: +14155238886
- Código: join load-herd
- Secrets en Vault: TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET

---

## 🏆 Motor de puntuación

- Partido: +1 signo / +3 exacto (no acumula) / +2 goleador / +1 bonus vs IA (máx 7pts)
- Boost x2: si exacto + partido es el boost del día → pts ×2 (máx 14pts)
- KO avance: grupos+5, r32+5, r16+10, qf+15, sf+20, campeón+25
- Clasificación final: campeón+30, subcampeón+20, 3º+15, 4º+10
- Premios: Balón/Bota/Guante Oro 15pts, Mejor Joven ≤21 20pts

---

## Comandos útiles

```bash
npm run dev     # localhost:5173
npm run build   # genera dist/
git add -A && git commit -m "..." && git push origin main

# Lanzar actor Apify manualmente:
apify call BYLtYcOxYkruVipwr -i '{"eventId":"xdbsEgb"}' -t 90

# Push actor Apify:
cd apify-actors/sofascore-live-proxy
apify push --actor-id BYLtYcOxYkruVipwr
```

---

## Reglas CRÍTICAS

- NUNCA push a main sin validar en localhost:5173 primero
- Push inmediato tras cada commit — nunca acumular
- NO crear ni modificar vercel.json
- Actualizar migration-log.md tras cada acción importante
- NO usar addEventListener DOMContentLoaded en classic scripts cargados via loadScript
- Actor Azzouzana VzKtdb1t0Qnc07X8V tiene caché CDN — NO usar para datos live
- sofascore_event_id puede ser slug (ej: xdbsEgb) O ID numérico — ambos funcionan

---

## Patrón DOMContentLoaded en classic scripts

```js
const runInit = () => { /* ... */ };
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runInit);
} else {
  runInit();
}
```

---

## Stack infraestructura

- Hosting: Vercel (porramundial2026-seven.vercel.app) — autodeploy desde main
- DB + Auth: Supabase (proyecto: cmyfyswystjgzdwbqyyb)
- Secrets en Vault: GITHUB_TOKEN, GITHUB_REPO, ANTHROPIC_API_KEY, APIFY_TOKEN, PROXY_URL, TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET

---

## Pendientes antes del 11 jun 2026

| # | Tarea | Estado |
|---|---|---|
| 1 | Activar `pg_cron` para `update-results` el 11 jun | ⏳ |
| 2 | Actualizar `EQUIPOS[].players` con convocatorias reales | ⏳ jun |
| 3 | Desactivar signup público | ⏳ |
| 4 | Email confirmación al cerrar porra (Resend + EF) | ⏳ |
| 5 | Verificar estructura JSON `_results.ko_results` con update-results real | ⏳ 11 jun |
| 6 | README — actualizar con URL Vercel | ⏳ |

---

## Log de cambios (OBLIGATORIO)

Añadir línea a migration-log.md tras cada acción:
```
[HH:MM] ACCION: descripción — ficheros afectados
```
Nunca borrar entradas anteriores.
