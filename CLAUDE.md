# Porra Mundial 2026 — Contexto para Claude Code

## Proyecto
App de pronósticos del Mundial 2026. Stack: Vite + vanilla JS/CSS, Supabase, Vercel.
**Producción: porramundial2026-seven.vercel.app**
Repo: github.com/cicloste88-max/PorraMundial2026
Rama activa: **main** | Último commit estable: **34c3532** (merge PR #5 — feat no-admin crear porras, 18 abr 2026)

---

## 🔴 Pendientes abiertos

### Bugs UI
1. **Parpadeo botón envío porra** — pendiente diagnóstico
2. **Cinta superior tabs ronda** no se visualiza completa en móvil (eliminatorias)
3. **Añadir hora CEST** a píldora `Grupo · Estadio` en tarjeta de partido (datos FIFA ya publicados, conversión ET→CEST = +6h en jun-jul)
4. **Botón simular eliminatorias** visible para todos los usuarios (actualmente solo admin)
5. **Auto-completar Pichichi torneo** sumando goleadores seleccionados en pronósticos (ayuda lógica al usuario)
6. **Enganche final frases IA** para pronóstico signo partido (lógica incorporada, falta wiring final)

### Antes del 11 junio 2026
1. Migrar WhatsApp sandbox → Meta Business producción (error 63016 — parked)
2. Activar pg_cron `update-results` el 11 jun
3. Cargar convocatorias reales (`EQUIPOS[].players`)
4. Email confirmación cierre porra (Resend + EF) **con copia de pronósticos al usuario** para que tenga registro
5. Verificar estructura JSON `_results.ko_results` con update-results real (11 jun)
6. ✅ ~~Desactivar signup público cuando entren todos los amigos~~ — innecesario desactivarlo para testear: no-admin puede crear sus propias porras (límite 3) vía EF `create-league`
7. IDs SofaScore de KO (disponibles ~28 jun 2026, tras finalizar fase de grupos)

### Playoffs UEFA marzo 2026 — resueltos
- Grupo A + República Checa
- Grupo B + Bosnia
- Grupo D + Turquía
- Grupo F + Suecia
- Grupo I + Irak
- Grupo K + RD Congo

---

## ✅ Bugs recientemente resueltos
- updateCardUI race condition ✅ (commit ee2e25a)
- CSS grid-areas Vista Jornada ✅
- 404 masivos consola (extractUrl linear-gradient) ✅
- Header eliminatorias responsive ✅ (mismo patrón que fase grupos)
- Bracket-results móvil ✅ (commit 2600c1a — min-width 260px por columna activa)
- Rediseño bracket: timeline vertical + live hero ✅ (commit 2600c1a)
- pg_net timeout en `porra-match-live` ✅ (async + webhook Apify)
- **Vista Directo + sección simulacros admin ✅** (PR #3, commits `d137d99` + `6d2c028` + `0421f0f`, merge `614b5ef`)
  - Banner superior `🧪 SIMULACRO · PARTIDO FUERA DEL MUNDIAL` (no se solapa con nombre equipo)
  - `checkIsAdmin` async con retries hasta 5s + re-render anti-loop (ver ERR-14)
  - Causa raíz original: `match_key` renombrado por error matinal `wc2026_gA_15186710` → `_historic_..._trial`. Revertido.

---

## 🧹 Limpieza repo — sesión 17 abr 2026

Eliminados del repo:
- 5 backups `.bak`: `index.html.bak`, `js/main.js.bak{,2,3}`, `js/auth.js.bak`
- 3 duplicados bracket-results (raíz `.js/.css` + `js/bracket-results.js` viejo)
- 6 patches Python one-shot (`patch_*.py`)
- 5 markdowns de diseños ejecutados (`vista-jornada.md`, `jornada-redesign.md`, `fix-vista-jornada.md`, `boost-ticker-mejoras.md`, `new_bracket.txt`)
- `js/utils.js` huérfano (shims ya están inline en `index.html` líneas 1440-1445)
- `supabase-ef-patches/porra-apify-webhook-v6.ts` (producción en v7)
- 3 scripts exploratorios Apify

Añadido a `.gitignore`:
- `apify-actors/*/node_modules/`

---

## 📊 Estado del sistema live

| Componente | Versión | Estado |
|---|---|---|
| Actor **sofascore-webshare-proxy** `N8vUChlhok5JU3cnL` | build 1.0.6 | ✅ **PRODUCCIÓN** — proxy Webshare residencial (~$0.001/run) |
| Actor sofascore-live-proxy `BYLtYcOxYkruVipwr` | build 1.0.19 | ✅ FALLBACK — proxies Apify residenciales (~$0.03/run) |
| `porra-match-live` EF | v13 | ✅ async + webhook |
| `porra-apify-webhook` EF | v7 | ✅ logging completo, detecta goles + status, llama Twilio directo |
| `porra-whatsapp-send` EF | v1 | ✅ form-urlencoded via fetch |
| `porra-whatsapp-webhook` EF | v4 | ✅ |
| Actor Azzouzana `VzKtdb1t0Qnc07X8V` | — | ❌ Caché CDN ~15min, NO usar live |

### Costes live scoring
- **Actor Webshare (producción):** ~**$13 total** torneo completo
- Fallback anterior: ~$318 estimados
- Webshare: 1GB gratis/mes + $3.50/mes plan pagado

---

## 🤖 Actor Apify principal — sofascore-webshare-proxy

**ID:** `N8vUChlhok5JU3cnL` | **Build:** 1.0.6 | **En producción**

**Cómo funciona:**
- Proxy Webshare residencial rotativo
- Fetch directo a `api.sofascore.com/api/v1/event/{id}` y `/incidents`
- Cookies SofaScore reutilizables entre requests (no IP-bound)

**Input:** `{ "eventId": "15832749" }`
**Output JSON:** `item.event={status,ok,data:{event:{...}}}` y `item.incidents={status,ok,data:{incidents:[]}}`

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
  admin.js            <- panel admin + dados/simulador (dice.js integrado)
  bracket-results.js  <- vista resultados reales bracket KO

css/ (raíz, no en public/)
  base.css
  admin.css
  ko.css
  welcome.css
  boost.css
  bracket-results.css
```

**Referencias CSS en index.html:** `/css/fichero.css`

**Cadena de carga (main-entry.js):**
```
misc.js (paralelo)
leagues → data → scoring → ui-groups → ko → bracket-results → ui-nav
  → auth → scoreboard → close-porra → admin
```

**Shims inline en index.html (líneas 1440-1445):** `handleCTA()`, `openAuthModal()` — previene error si onclick HTML dispara antes de que auth.js cargue.

---

## 🛢️ Base de datos — tablas live

```sql
live_scores (
  match_key TEXT PRIMARY KEY,
  sofascore_url TEXT,
  sofascore_event_id TEXT,
  status TEXT,               -- notstarted/inprogress/halftime/overtime/penalties/finished
  status_code INT,
  score_home INT,
  score_away INT,
  score_agg_home INT,
  score_agg_away INT,
  events JSONB,
  lineups JSONB,
  statistics JSONB,
  referee TEXT,
  venue TEXT,
  poll_active BOOLEAN,
  poll_interval INT,
  had_overtime BOOLEAN,
  had_penalties BOOLEAN,
  match_start_ts BIGINT,
  is_historic BOOLEAN DEFAULT false,  -- true = trial runs / pruebas, referencia consultiva de formatos. NO usar en scoring ni UI live (filtrar WHERE is_historic=false)
  home_team_name TEXT,                -- usado por simulacros (partidos fuera del Mundial). Para el Mundial los nombres salen de EQUIPOS via match_key
  away_team_name TEXT,                -- idem
  competition TEXT,                   -- ej. "Copa del Rey 2026 · Final" — render en pie de tarjeta simulacro
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
| `create-league` | v2 | Crear liga para cualquier user autenticado. Límite 3 ligas si no-admin. Admins ilimitados. **`verify_jwt=false`** (plataforma Supabase rechaza JWT ES256 cuando `verify_jwt=true` — validación manual con service_role dentro de la EF). Ver ERR-16. |
| `update-results` | v4 | Sync football-data.org → results. Activar pg_cron el 11 jun |
| `porra-orchestrator` | v3 | N agentes Haiku en paralelo → orchestrator_jobs |
| `porra-patch-deploy` | v4 | Patches search/replace + commit GitHub |
| `porra-fix-encoding` | v5 | Inspect/write ficheros GitHub via API. Defaults: CLAUDE.md / main |
| `porra-match-live` | v13 | Async + webhook, live scores |
| `porra-apify-webhook` | v7 | Logging completo, detecta goles + status, llama Twilio directo |
| `porra-whatsapp-send` | v1 | Envío WhatsApp via Twilio (form-urlencoded fetch) |
| `porra-whatsapp-webhook` | v4 | Webhook entrada WhatsApp |
| `porra-sofascore-proxy` | v8 | ❌ OBSOLETA |
| `porra-github-pusher` | v6 | ❌ PLACEHOLDER — ignorar |

---

## 🔧 Funciones DB helpers

| Función | Descripción |
|---|---|
| `schedule_match_crons(match_key TEXT, start_ts TIMESTAMPTZ)` | Genera automáticamente los dos crons de un partido: **prematch T-45min** (1 call) + **polling `*/3 * * * *` durante 150min** desde `start_ts`. Ambos invocan `porra-match-live` con el `match_key`. |
| `unschedule_match_crons(match_key TEXT)` | Elimina los crons `prematch_<match_key>` y `poll_<match_key>`. Uso: limpieza tras cambio de fecha o cancelación. |

Ejemplo:
```sql
SELECT schedule_match_crons('wc_mex_rsa', '2026-06-11 20:00:00+00'::timestamptz);
-- ...si se cancela o se reprograma:
SELECT unschedule_match_crons('wc_mex_rsa');
```

**Regla:** para programar crons de partidos usar **siempre** `schedule_match_crons`, nunca duplicar crons manualmente (evita crons huérfanos).

---

## 🧪 Simulacros (testing live)

**Propósito:** probar el pipeline live (Apify → webhook → live_scores → realtime → UI + WhatsApp) con partidos reales fuera del Mundial **antes del 11 jun**, sin contaminar datos del torneo.

**Cómo activar un simulacro:**
1. Crear fila en `live_scores` con `is_historic = true` y los campos necesarios:
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
2. Programar crons:
   ```sql
   SELECT schedule_match_crons('copadelrey_final_atm_rso', '2026-04-18 19:00:00+00'::timestamptz);
   ```

**Visibilidad:**
- Sólo usuarios con `profiles.is_admin = true` ven la sección **🧪 Simulacros activos** dentro de la vista Directo.
- La fila se sigue procesando por el pipeline normal (Apify, webhook, WhatsApp si está suscrito), pero **no aparece** en las 72 tarjetas del Mundial ni se considera para scoring (filtro `is_historic = false`).

**Simulacro actualmente activo:**
- `copadelrey_final_atm_rso` — Atlético de Madrid vs Real Sociedad, 18 abr 2026 19:00 UTC (21:00 CEST), `sofascore_event_id = 15664537`. Crons: `prematch_copadelrey_final_atm_rso` (18:15 UTC) + `poll_copadelrey_final_atm_rso` (cada 3 min, 19–22 UTC).

---

## 🔄 Flujo live scores (async + webhook)

```
pg_cron (cada minuto durante partido)
  → net.http_post → porra-match-live EF
      → Apify API: lanzar actor N8vUChlhok5JU3cnL async (no espera)
  → (Apify termina ~5-10s con Webshare)
      → Apify webhook → porra-apify-webhook EF
          → leer dataset: { event, incidents }
          → detectar cambios vs DB
          → detecta goles + cambios status
          → Twilio directo (form-urlencoded fetch)
          → upsert live_scores
```

**Pattern live cron:** Pre-match T-45min (1 call) → polling cada 3min durante partido → estados: `notstarted/inprogress/halftime/overtime/penalties/finished`

---

## 📱 WhatsApp — Twilio sandbox

- Número: +14155238886
- Código de acceso: `join load-herd`
- Credenciales Twilio (AccountSid, API Key SID + Secret): **solo en Supabase Vault** (nunca hardcodear en código ni docs)
- Secrets en Vault: `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY`, `TWILIO_API_SECRET`

**Notificaciones:** 🟢 Arranca / ⏸ Descanso / 🟢 2ª parte / ⚽ Gol (jugador + minuto + marcador) / ⚡ Prórroga / 🤽 Penaltis / 🏁 Fin

---

## 🏆 Motor de puntuación

**Por partido (máx 7pts · 14pts con boost x2):**
- Signo correcto (1/X/2): +1
- Resultado exacto: +3 (no acumula con signo)
- Goleador correcto: +2
- Bonus vs IA (pronóstico opuesto a IA y aciertas): +1

**KO avance por equipo:** Grupos→R32 +5 / R32→R16 +5 / R16→QF +10 / QF→SF +15 / SF→Final +20 / Campeón +25

**Clasificación final:** Campeón +30 / Subcampeón +20 / 3º +15 / 4º +10

**Premios individuales (AWARDS_CFG):** Balón/Bota/Guante Oro +15pts, Mejor Joven ≤21 +20pts

---

## 🌍 Estructura torneo

48 equipos, 12 grupos (A–L) de 4, 72 partidos grupos, 17 jornadas.
2 primeros + 8 mejores terceros = 32 equipos.
R32 → R16 → QF → SF → 3er puesto → Final = **104 partidos total**.
**Inicio:** 11 jun 2026 — México vs Sudáfrica en Azteca (eventId=15186710).

---

## 🔑 SofaScore IDs

| Torneo | tournament | season |
|---|---|---|
| UCL 2025/26 | 7 | 61644 |
| World Cup 2026 | 16 | 58210 |

- 72 partidos grupos mapeados en `worldcup-2026-sofascore-ids.json` (repo)
- IDs KO disponibles ~28 jun 2026
- Primer partido WC: eventId=15186710

---

## 🔧 Herramientas disponibles en Claude.ai

**Supabase MCP** (`cmyfyswystjgzdwbqyyb`):
- `execute_sql`, `get_logs`, `list_edge_functions`, `get_edge_function`, `deploy_edge_function`

**Claude in Chrome:**
- QA autónomo en `localhost:5173` y producción
- Login prod: `_porraDb.auth.signInWithPassword({email:'cicloste88@gmail.com', password:'910500'})`
- Login local: usar `window.__QA_EMAIL` / `window.__QA_PASS` via `.env.local`

**Canva MCP:** disponible (no usado en porra)

---

## Comandos útiles

```bash
npm run dev     # localhost:5173
npm run build   # genera dist/
git add -A && git commit -m "..." && git push origin main

# Lanzar actor Apify manualmente:
apify call N8vUChlhok5JU3cnL -i '{"eventId":"15832749"}' -t 90

# Push actor Apify:
cd apify-actors/sofascore-webshare-proxy
apify push --actor-id N8vUChlhok5JU3cnL
```

---

## Reglas CRÍTICAS

- **NUNCA push a main sin validar en localhost:5173 primero**
- **Push inmediato tras cada commit** — nunca acumular
- **NO crear ni modificar vercel.json** (borrarlo fue el fix correcto; el wildcard `source: "/(.*)"` corrompía MIME types de ES modules)
- **Actualizar migration-log.md** tras cada acción importante
- **NO usar addEventListener DOMContentLoaded** en classic scripts cargados via loadScript
- Actor Azzouzana `VzKtdb1t0Qnc07X8V` tiene caché CDN — NO usar para datos live
- **Consultar `errores_conocidos_porra.md`** (ERR-01 a ERR-20) antes de debuggear
- **Detectar decisiones autónomas de Claude Code** con `git diff --stat HEAD` antes de commit
- dice.js se mantiene dentro de admin.js (no separar)
- **Badge-with-flag-fallback** es patrón permanente para imágenes de equipo
- **Para programar crons de partidos usar `schedule_match_crons(match_key, start_ts)`**, nunca duplicar crons manualmente

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
Red de seguridad adicional en `main-entry.js`.

---

## End-of-session protocol (OBLIGATORIO)

1. Actualizar **CLAUDE.md** + commit
2. Actualizar **CONTEXTO_PORRA_2026.md** si hay cambios estructurales
3. Generar/actualizar **ESQUEMA_SISTEMA_PORRA2026.xlsx** y push al repo
4. Notificar a Claude.ai para actualizar memorias

**Frase inicio sesión:** "Continuamos con la Porra Mundial 2026. Revisa tus memorias y dime el estado actual del proyecto."

---

## Stack infraestructura

- **Hosting:** Vercel (porramundial2026-seven.vercel.app) — autodeploy desde `main`
- **DB + Auth:** Supabase (proyecto: `cmyfyswystjgzdwbqyyb`)
- **Secrets Vault:** `GITHUB_TOKEN`, `GITHUB_REPO`, `ANTHROPIC_API_KEY`, `APIFY_TOKEN`, `PROXY_URL`, `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY`, `TWILIO_API_SECRET`

---

## Log de cambios (OBLIGATORIO)

Añadir línea a `migration-log.md` tras cada acción:
```
[HH:MM] ACCION: descripción — ficheros afectados
```
Nunca borrar entradas anteriores.
