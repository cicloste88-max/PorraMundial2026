# Porra Mundial 2026 — Contexto para Claude Code

## Proyecto
App de pronósticos del Mundial 2026. Stack: HTML+CSS+JS vanilla, Supabase, Vite, Vercel.
**Producción: porramundial2026-seven.vercel.app**
Repo: github.com/cicloste88-max/PorraMundial2026
Rama activa: **main** | Último commit: **8e8ac44**

---

## ⚠️ PENDIENTE URGENTE — Próxima sesión

**Bug:** `porra-match-live` EF hace timeout porque el actor Apify tarda ~44s y pg_net corta antes.

**Fix — arquitectura async + webhook Apify:**
1. pg_cron lanza el actor de forma **async** (sin esperar)
2. Configurar webhook en Apify que llame a una EF cuando el actor termine
3. La EF del webhook procesa los datos, detecta cambios, envía WhatsApp

---

## 📊 Estado del sistema live (resumen)

| Componente | Versión | Estado |
|---|---|---|
| Actor sofascore-live-proxy `BYLtYcOxYkruVipwr` | build 1.0.19 | ✅ FUNCIONA (~44s, tiempo real) |
| `porra-match-live` EF | v9 | ⚠️ pg_net timeout |
| `porra-whatsapp-send` EF | v1 | ✅ FUNCIONA |
| `porra-whatsapp-webhook` EF | v4 | ✅ FUNCIONA |
| Actor Azzouzana `VzKtdb1t0Qnc07X8V` | — | ❌ Caché CDN ~15min, NO usar live |

---

## 🤖 Actor Apify propio

**ID:** `BYLtYcOxYkruVipwr` | **Build:** 1.0.19 | **Repo:** `apify-actors/sofascore-live-proxy/`

**Cómo funciona:**
- Playwright lanza Chrome con proxy RESIDENTIAL
- Carga `sofascore.com` para establecer contexto browser
- `page.evaluate(fetch)` llama en paralelo a:
  - `api.sofascore.com/api/v1/event/{id}` — status, score, equipos
  - `api.sofascore.com/api/v1/event/{id}/incidents` — goles, tarjetas
- Devuelve `{ eventId, event: {data}, incidents: {data} }`

**Input:** `{ "eventId": "15832749" }`

**Por qué bypasea Cloudflare:** el fetch se ejecuta desde dentro del browser con el mismo origen que sofascore.com.

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
  sofascore_event_id TEXT,   -- ID numérico de SofaScore API
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
| `porra-fix-encoding` | v4 | Write/inspect ficheros GitHub via API |
| `porra-match-live` | v9 | Live scores + WhatsApp. PROBLEMA: pg_net timeout |
| `porra-whatsapp-send` | v1 | Envío WhatsApp via Twilio |
| `porra-whatsapp-webhook` | v4 | Webhook entrada WhatsApp |
| `porra-sofascore-proxy` | v8 | OBSOLETA — sustituida por actor propio |

---

## 🔄 Flujo live scores

```
pg_cron (cada minuto durante partido)
  → net.http_post → porra-match-live EF
      → Apify: lanzar actor BYLtYcOxYkruVipwr con { eventId }
      → polling Apify hasta SUCCEEDED
      → leer dataset: { event, incidents }
      → detectar cambios vs DB
      → porra-whatsapp-send → Twilio → WhatsApp
      → upsert live_scores
```

**PROBLEMA ACTUAL:** pg_net timeout antes de que actor complete (44s > límite pg_net).

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

# Lanzar actor Apify manualmente desde carpeta actor:
apify call BYLtYcOxYkruVipwr -i '{"eventId":"15832749"}' -t 90

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
| 0 | **Fix pg_net timeout** (actor async + webhook Apify) | 🔴 URGENTE |
| 1 | Crons Bayern-Real Madrid y futuros partidos | 🔴 |
| 2 | Activar `pg_cron` para `update-results` el 11 jun | ⏳ |
| 3 | Actualizar `EQUIPOS[].players` con convocatorias reales | ⏳ |
| 4 | Desactivar signup público | ⏳ |
| 5 | Email confirmación al cerrar porra (Resend + EF) | ⏳ |
| 6 | Verificar estructura JSON `_results.ko_results` | ⏳ 11 jun |
| 7 | README — actualizar con URL Vercel | ⏳ |

---

## Log de cambios (OBLIGATORIO)

Añadir línea a migration-log.md tras cada acción:
```
[HH:MM] ACCION: descripción — ficheros afectados
```
Nunca borrar entradas anteriores.
