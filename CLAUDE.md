# Porra Mundial 2026 — Contexto para Claude Code

## Proyecto
App de pronósticos del Mundial 2026. Stack: Vite + vanilla JS/CSS, Supabase, Vercel.
**Producción: porramundial2026-seven.vercel.app**
Repo: github.com/cicloste88-max/PorraMundial2026
Rama activa: **main** | Último commit en main: **8d8b667** (fase E squash-mergeada, PR #16 cerrada). IA Predictor Fases A–E cerradas en main con EF `porra-ia-compute` v9 ACTIVE, paridad Python↔TS verde (46/46), smoke tests verdes. Fase F (wiring frontend) pendiente. Feature `feat/mobile-grupos-focus` **LIVE en producción** (verificada en iPhone Safari + Chrome móvil).

---

## 🔴 Pendientes abiertos

### 🔬 Sanity check 20 abr 2026 — inversiones prioritarias antes del 11 jun
> Detalle completo en **`docs/sanity-check-20abr2026.md`**. Resumen accionable:

**Semanas 1-2 (crítico, 4 días):**
1. **Tests motor de puntuación** (Vitest, 30 tests de `calc*Points` en `scoring.js`). Sin esto, disputas reales por puntos mal calculados el día de la final.
2. **GitHub Action CI** (build + `node --check` + tests cuando haya). Bloquea regresiones antes de merge.
3. ~~**EF `porra-ia-predict`** — mueve el `fetch('https://api.anthropic.com/...')` de `scoring.js:941` y `ui-nav.js:49` a una Edge Function con `ANTHROPIC_API_KEY` en Vault.~~ ✅ **Resuelto backend (21 abr)** vía EF `porra-ia-compute` v9 (Fases A–E cerradas, `ia_predictions` pobladas on-demand + batch 11 jun). ⏳ **Pendiente frontend (Fase F)**: reemplazar los `fetch('api.anthropic.com/...')` muertos en `scoring.js:941` y `ui-nav.js:49` por lectura directa de `ia_predictions` (RLS policy `ia_predictions_public_read`) + llamada a `compute_match` on-demand para eliminatorias. Hasta entonces, esos dos fetches siguen cayendo al fallback hardcoded.

**Semanas 3-4 (escala):**
4. Code splitting `admin.js` (dynamic import bajo `is_admin`) — bundle −25%.
5. Logger con gate por env para los 56 `console.log/warn/error` en producción.
6. Sentry error tracking — descubrir errores móvil reales.
7. Auditoría `innerHTML` + `escapeHtml` (~70 usos).

**Semanas 5-6 (refactor, pre-requisito: tests del paso 1):**
8. Split `scoring.js` (1.438 LOC) en engine puro + render + assets.
9. Consolidación `ui-groups.js` + `ui-groups-mobile.js` con helpers compartidos.
10. Event delegation — eliminar los 62 `onclick=` inline de `index.html`.

**Semanas 7-8 (buffer):**
11. `window._trace` helper de debug (MutationObserver reutilizable).
12. Splash 4s acortado o condicional por primera visita.
13. `AppState` proxy + `TIMINGS` centralizados.

### Bugs UI
1. **Cinta superior tabs ronda** no se visualiza completa en móvil (eliminatorias)
2. **Añadir hora CEST** a píldora `Grupo · Estadio` en tarjeta de partido (datos FIFA ya publicados, conversión ET→CEST = +6h en jun-jul)
3. **Botón simular eliminatorias** visible para todos los usuarios (actualmente solo admin)
4. **Auto-completar Pichichi torneo** sumando goleadores seleccionados en pronósticos (ayuda lógica al usuario)
5. **Enganche final frases IA** para pronóstico signo partido (lógica incorporada, falta wiring final)

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
- **Rediseño móvil fase de grupos ✅** (PR #9 mergeado en `9d651d5`, 4 commits `871592b`+`b812f41`+`c69f7de`+`e114c02`)
  - Commit 1/4: infra + `ui-groups-mobile.js` + `PHRASES_GRUPO` + placeholder `@media` + script en loadScript chain.
  - Commit 2/4: acordeón lista + barra progreso por grupo + helper `applyMobileGroupCollapse`.
  - Commit 3/4: focus layer + carrusel 6 slides + swipe + smart boost row (conflicto jornada).
  - Commit 4/4: slide 7 clasificación + botón Guardar/Deshacer + lock cards + persistencia BD (`league_members.groups_saved` JSONB).
- **Fixes producción móvil ✅** (19 abr, 4 commits a `main`):
  - `b4a52e6` — ERR-18: `css/` → `public/css/` (Vite sólo copia `public/` a `dist/`).
  - `0aa78a9` — ERR-19: `openMobileFocus` defensivo con `try/catch` + toast para debug sin devtools en iPhone.
  - `40c0fe2` — ERR-20: eliminar `body.style.overflow='hidden'` (bloqueo persistente en Safari iOS).
  - `82b4753` — ERR-21: reglas base de `.mobile-focus-layer` fuera del `@media` + `visibility:hidden/visible` (evita layer fantasma en hit-testing Safari).
- **Refactor CSS extracción `<style>` inline ✅** (commit `9e93fe8`)
  - Los 4 bloques `<style>` de `index.html` con comentario "Archivo destino : X.css" nunca se habían migrado. Commits 2/3/4 del rediseño móvil añadían reglas a `public/css/base.css` pero `index.html` no enlazaba `base.css`. Fix: contenido `<style>` prepended a cada fichero destino (para que reglas nuevas al final ganen por cascada), bloques eliminados de `index.html` (de 2970 a 1008 líneas), 4 `<link>` nuevos en cabecera.
- **Persistencia última página al F5 ✅** (saga v2.1 → v2.11, 20 abr, HEAD `8bc7f30`)
  - F5/Ctrl+R en cualquier página (Grupos / Eliminatorias / Score / Admin) restaura la página donde el user estaba, sin flash welcome ni splash. Solo afecta a refresh con sesión válida; login fresco va a welcome por semántica.
  - **Diagnóstico final** (caza con MutationObserver, ver ERR-23): `#page-welcome` mutaba a `display:block` en T=612ms y volvía a `display:none` en T=1115ms — 503ms de flash. Causa: `main-entry.js:74` safety-net llamaba `showPage('welcome')` sin guard, lo que disparaba la lógica que retiraba el CSS lock de v2.9 antes de tiempo.
  - **Solución belt & suspenders en 3 capas:**
    - **Capa 0 — `index.html` `<head>` (v2.6 + v2.8 + v2.9):** script inline síncrono lee `localStorage.porra_lastPage`, setea `window._pendingPageRestore`, salta el splash si hay restore, e inyecta `<style id="restore-lock-css">#page-welcome{display:none !important}</style>`.
    - **Capa 1 — `main-entry.js:74-78` (v2.11):** safety-net con guard `if (!window._pendingPageRestore) showPage('welcome')`. Impide flash desde el chain.
    - **Capa 2 — `public/js/ui-nav.js` `showPage()` (v2.10):** `if (lock && page==='welcome') return; if (lock && page!=='welcome') lock.remove()`. Hace que el lock sea self-healing: rogue `showPage('welcome')` no rompe el restore; `showPage(target)` retira el lock al pintar la página real.
    - **Plus — `public/js/auth.js:325-339` (v2.1):** `onAuthStateChange` consume `_pendingPageRestore` solo en `INITIAL_SESSION` (no `SIGNED_IN`), revalidación admin explícita, ruta única `setTimeout(100) → showPage(finalPage)`.
    - **Plus — `auth.js:349` (v2.7):** guard `if (!window._pendingPageRestore) showPage('welcome')` en arranque inicial + fallback en rama `else` por si la sesión está caducada.
    - **Plus — `index.html:251` (v2.4):** `<div id="page-welcome" style="display:none">` (las otras 4 páginas ya lo tenían; welcome era la única visible por defecto).
  - **Limpieza key:** `porra_lastPage` con underscore — entra en barrido de `doLogout` (`auth.js:286`, `.includes('porra_')`).
  - **Diagrama del flujo de arranque con restore:**
    ```
    T=0    HTML parse → <script inline> setea _pendingPageRestore + CSS lock + skip splash
    T=~50  module bundle + chain → main-entry safety-net guard skipea welcome (capa 1)
    T=~50  auth.js runAuthInit → guard skipea welcome (v2.7) + onAuthStateChange registrado
    T=~60  Supabase emite INITIAL_SESSION → handler arranca await loadUserData
    T=~500 loadUserData resuelve → consume _pendingPageRestore=null → setTimeout(100)
    T=~600 showPage(target) → capa 2 retira lock + display:block en target
    ```
  - **Limitación aceptada:** ~500-600ms de pantalla oscura (background body) entre T=0 y `showPage(target)`. Aceptable porque no es welcome y no llama la atención. Si se queja en 3G, v3 con hidratación optimista de `currentUser` + `_activeLeague` desde localStorage.
  - **Limitaciones conocidas (sin resolver):** sub-tab Vista Directo no se preserva (vuelve a Grupos), scroll position no se preserva, URL siempre `/`. Multi-tab: `localStorage` compartido, gana último que escribe.
  - **Saga ruidosa pero documentada:** 11 iteraciones (v2.1 → v2.11) con varios reverts intermedios. Historia git no se squashea — los reverts documentan el aprendizaje.

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
| Actor **sofascore-webshare-proxy** `N8vUChlhok5JU3cnL` | build 1.0.7 | ✅ **PRODUCCIÓN** — proxy Webshare residencial (~$0.001/run) |
| Actor sofascore-live-proxy `BYLtYcOxYkruVipwr` | build 1.0.19 | ✅ FALLBACK — proxies Apify residenciales (~$0.03/run) |
| `porra-match-live` EF | v16 | ✅ async + webhook (Webshare principal `N8vUChlhok5JU3cnL` build 1.0.7 + fallback `BYLtYcOxYkruVipwr` build 1.0.19) |
| `porra-apify-webhook` EF | v7 | ✅ logging completo, detecta goles + status, llama Twilio directo. **Bug conocido:** no persiste `home_team_name`/`away_team_name`/`competition`/`match_start_ts` (pending v8) |
| `porra-whatsapp-send` EF | v1 | ✅ form-urlencoded via fetch |
| `porra-whatsapp-webhook` EF | v4 | ✅ |
| Actor Azzouzana `VzKtdb1t0Qnc07X8V` | — | ❌ Caché CDN ~15min, NO usar live |

### Costes live scoring
- **Actor Webshare (producción):** ~**$13 total** torneo completo
- Fallback anterior: ~$318 estimados
- Webshare: 1GB gratis/mes + $3.50/mes plan pagado

---

## 🤖 Actor Apify principal — sofascore-webshare-proxy

**ID:** `N8vUChlhok5JU3cnL` | **Build:** 1.0.7 | **En producción**

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
  data.js              <- datos torneo + estado global + boostPicks + PHRASES_GRUPO
  scoring.js           <- motor puntos + tarjetas + premios
  ui-groups.js         <- grupos + vista Jornada completa
  ui-groups-mobile.js  <- rediseño móvil fase grupos (acordeón + focus layer + slide 7)
  ko.js                <- bracket KO + IA pronósticos
  ui-nav.js            <- SPA nav + modal + welcome
  ui-directo.js        <- vista Directo + sección simulacros admin
  live-sync.js         <- realtime live_scores (postgres_changes + simulacros)
  auth.js              <- auth Supabase + bootstrap (predictions/ko/awards/groups_saved)
  leagues.js           <- ligas y selección de porra
  misc.js              <- utils UI
  scoreboard.js        <- clasificación multi-usuario
  close-porra.js       <- cierre de pronósticos
  admin.js             <- panel admin + dados/simulador (dice.js integrado)
  bracket-results.js   <- vista resultados reales bracket KO

public/css/          <- TODOS los CSS viven aquí (Vite sólo copia public/ a dist/)
  base.css           <- reset, layout, match-cards, header, ligas + rediseño móvil @media 640px
  welcome.css
  ko.css             <- bracket KO + modal + awards (pendiente split awards.css)
  admin.css          <- panel admin + dado + responsive admin
  boost.css
  bracket-results.css
  directo.css        <- vista Directo + tarjetas simulacro admin
```

**Referencias CSS en index.html:** `/css/fichero.css` (7 `<link rel="stylesheet">` en `<head>`; los `<style>` inline se extrajeron en commit `9e93fe8`).

**Regla crítica assets:** TODO lo que se sirva bajo `/xxx` debe vivir en `public/xxx/` o ser importado desde el bundle JS. Si pones algo en la raíz del repo (como estaba `css/` antes), Vite lo ignora en el build (ver ERR-18).

**Cadena de carga (main-entry.js):**
```
misc.js (paralelo)
leagues → data → scoring → ui-groups → ui-groups-mobile → ko → bracket-results
  → ui-nav → auth → scoreboard → close-porra → admin → ui-directo → live-sync
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
| `porra-match-live` | v16 | Async + webhook, live scores. Webshare `N8vUChlhok5JU3cnL` build 1.0.7 principal + `BYLtYcOxYkruVipwr` build 1.0.19 fallback |
| `porra-apify-webhook` | v7 | Logging completo, detecta goles + status, llama Twilio directo. **Bug:** no persiste `home_team_name`/`away_team_name`/`competition`/`match_start_ts` (pending v8) |
| `porra-whatsapp-send` | v1 | Envío WhatsApp via Twilio (form-urlencoded fetch) |
| `porra-whatsapp-webhook` | v4 | Webhook entrada WhatsApp |
| `porra-ia-compute` | v9 | IA Predictor (Fases A–E cerradas). 7 actions: `status/scrape_elo/scrape_h2h/scrape_last5/freeze_snapshot/compute_groups/compute_match`. Motor log-odds+softmax (pesos 75/10/15, fallback 85/0/15, home adv +85/+95 MEX). Rate limit 30/min (service_role inmune). Quip via Claude Haiku 4.5. `ia_snapshots` (1 activo). Cron 11 jun 00:00 freeze + 00:10 compute_groups. `verify_jwt=false`. Ver sección "🤖 IA Predictor" |
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

## 🤖 IA Predictor (Fases A–F)

Sistema de pronóstico IA por partido que alimenta el bonus **+1 pt si la predicción del usuario es opuesta a la IA y acierta** del motor de puntuación.

**Arquitectura 3 capas:**
```
Capa 1 — Ingesta         Capa 2 — Cómputo        Capa 3 — Consumo
EF porra-ia-compute  →   ia_predictions  →        frontend
 (4 actions scraper)      (fórmula 50/25/25)      (scoring.js / ko.js)
```

**Fórmula del pronóstico** (Fase E, cerrada — motor log-odds+softmax):

| Señal | Peso | Fuente |
|---|---|---|
| ELO FIFA | **50%** | `ia_elo_fifa` (Wikipedia `Module:SportsRankings/data/FIFA_World_Rankings`) |
| H2H histórico | **25%** | `ia_h2h` (11v11.com/stats, RSSSF-backed, incluye amistosos) |
| Racha últimos N | **25%** | `ia_last5_results` (11v11.com/matches, `N=8` default) |

**Fallback sin H2H:** si el par no tiene partido histórico entre ambas selecciones, rebalancear a **ELO 66% + Racha 34%**.

**Umbrales signo 1/X/2** sobre `raw_home_pct`:
- `raw_home_pct > 60%` → signo **1** (local)
- `40% ≤ raw_home_pct ≤ 60%` → signo **X** (empate)
- `raw_home_pct < 40%` → signo **2** (visitante)

**Profundidad racha dinámica:**
- Default `N=8` (lo que 11v11 sirve actualmente en su tabla de últimos partidos).
- Ampliable a `N=10` antes del 11 jun cuando se publique el primer amistoso pre-Mundial, vía `{"action":"scrape_last5","limit":10}`. Activación **manual** (no automática).

**Headers obligatorios para 11v11.com** (ver ERR-25 — sin los 3 → 403):
```ts
const fetchHeaders = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};
```

**Tablas (migración `20260421_create_ia_predictor_tables.sql`, Fase A):**

```sql
ia_elo_fifa (
  team_code TEXT PRIMARY KEY,     -- ISO-3
  team_name TEXT,
  elo_points NUMERIC(7,2),
  rank_position INT,
  scraped_at TIMESTAMPTZ,
  source TEXT
)

ia_last5_results (
  team_code TEXT PRIMARY KEY REFERENCES ia_elo_fifa(team_code),
  results JSONB,                  -- array de N objects: {date, opponent_name, opponent_iso3, venue, result, gf, ga, competition}
  wins INT, draws INT, losses INT,
  scraped_at TIMESTAMPTZ
)

ia_h2h (
  team_a_code TEXT,               -- alfabético: team_a < team_b
  team_b_code TEXT,
  matches JSONB,                  -- {total, gf_team_a, ga_team_a, source_team, source}
  team_a_wins INT, team_b_wins INT, draws INT,
  last_played DATE,               -- null en el origen 11v11/stats (agregado sin fecha)
  scraped_at TIMESTAMPTZ,
  PRIMARY KEY (team_a_code, team_b_code),
  CONSTRAINT h2h_alphabetical CHECK (team_a_code < team_b_code)
)

ia_predictions (
  match_id TEXT PRIMARY KEY,
  home_code TEXT, away_code TEXT,
  sign CHAR(1) CHECK (sign IN ('1','X','2')),
  confidence SMALLINT CHECK (confidence BETWEEN 0 AND 100),
  breakdown JSONB,                -- {elo_score, h2h_score, last5_score, raw_home_pct}
  used_fallback BOOLEAN,          -- true si se aplicó ELO 66 / Racha 34
  computed_at TIMESTAMPTZ
)
```

**RLS:** las 4 tablas con RLS enabled. Única policy pública: `ia_predictions_public_read` (cualquier `authenticated` puede SELECT). El frontend la consume directamente. Resto de tablas solo accesibles por service role (las EFs del pipeline).

**48 mundialistas — mapping `WC2026_TEAMS`** (en la EF, tipo `[iso3, owner_slug, opposition_name, display_name]`):

- `owner_slug` = kebab-lowercase de 11v11 (ej. `bosnia-and-herzegovina`, `korea-republic`, `congo-dr`, `cape-verde-islands`, `usa`).
- `opposition_name` = texto que 11v11 usa en `<td class="opposition">` para listar a esa selección cuando es rival (ej. "Korea Republic", "Congo DR", "Cape Verde Islands"). Se usa lowercased como clave del `Map<name, iso3>` para cruzar rivales entre páginas.
- `display_name` = cómo se renderiza al usuario final (ej. "Türkiye", "Côte d'Ivoire", "Curaçao").
- **Fuente de verdad:** la constante en `supabase/functions/porra-ia-compute/index.ts`. Si se cambia el nombre de una selección en 11v11, actualizar ahí y redesplegar.

**Fases — estado y commits en main:**

| Fase | Acción | Commit | Estado |
|---|---|---|---|
| A | Migración 4 tablas + EF esqueleto | `968332a` (PR #10) | ✅ merged + aplicada |
| B | scrape_elo via `inside.fifa.com` | `4a32737` (PR #11) | ⚠️ deprecada por B.2 |
| B.2 | scrape_elo via Wikipedia Module | `c845f3e` (PR #12) | ✅ merged + desplegada |
| D | scrape_h2h via Wikipedia all-time_record | `cba5dcc` (PR #13) | ⚠️ deprecada por D.2 (ver ERR-24) |
| D.2 | scrape_h2h via 11v11.com/stats | `bbad657` (PR #14) | ✅ merged + desplegada |
| C | scrape_last_n via 11v11.com/matches | `2904025` (squash-merge de PR #15) | ✅ merged + desplegada |
| E | Motor IA log-odds+softmax + snapshots + compute_* | `8d8b667` (PR #16) | ✅ merged + desplegada (EF v9). Paridad 46/46 verde. |
| F | wiring frontend `scoring.js` / `ko.js` | — | ⏳ pendiente |

**Estado tablas al cierre E (21 abr PM):** `ia_elo_fifa` 211 · `ia_h2h` 815 · `ia_last5_results` 48 · `ia_snapshots` 2 (1 activo: `initial_test_21apr`) · `ia_predictions` pobladas por compute_match on-demand (quedará batch-poblada al cron del 11 jun 00:10 UTC con los 72 partidos de grupos).

**Lecciones registradas:** ERR-24 (Wikipedia inadecuada para H2H masivo — sólo ~3/48 tienen página `_all-time_record`). ERR-25 (3 headers obligatorios para 11v11.com). ERR-26 (`pg_net` sin PUT — bloquea merge vía GitHub API desde Supabase). ERR-27 (`supa.from("vault.decrypted_secrets")` no enruta al schema `vault`; `.schema("vault")` tampoco porque `vault` no está expuesto en `api.schemas`; fix: RPC `get_vault_secrets` vía `fetch`).

**Fórmula del motor IA (Fase E, decidida tras back-test WC2022 46 partidos):**
- Pesos default: **ELO 75% + H2H 10% + Racha 15%**
- Fallback (H2H con <5 partidos): **ELO 85% + Racha 15%**
- Home advantage: +85 base hosts / +95 México (altitud), solo aplica si `home_code ∈ {MEX, USA, CAN}` en grupos. En eliminatorias siempre `is_host_match=false` (sedes rotativas/neutras).
- Margen dudoso: `margin < 0.08` → flag `is_dudoso` para UI.
- Back-test WC2022: accuracy 63.0%, log-loss 0.932, Brier 0.560 (supera baseline).
- Snapshot fairness: la IA se congela con `freeze_snapshot` el 11 jun 00:00 UTC y NO se adapta al torneo. Misma predicción para todos los users siempre. `ia_snapshots` con invariante "1 activo" + FK desde `ia_predictions`.
- Gate de merge: test de paridad Python↔TS (46 casos, tolerancia 1e-3) debe pasar.

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

### 🛠️ Cómo interactúa Claude Code con GitHub (sesiones de coding)

- Usa **GitHub MCP** (`mcp__github__*`): suite oficial con `list_branches`, `list_pull_requests`, `pull_request_read`, `create_pull_request`, `merge_pull_request`, `list_commits`, `get_commit`, `issue_read/write`, `push_files`, `create_branch`, etc.
- **Repo scope** restringido por config del host a `cicloste88-max/porramundial2026` — llamadas a otros repos se rechazan.
- **`git push` / `git fetch`** NO van por el MCP: el harness monta un **proxy HTTP local** (`http://127.0.0.1:<puerto>/git/...`) que firma requests con el OAuth token. Por eso push puede funcionar incluso cuando el MCP de GitHub se cae — son componentes independientes del harness.
- **Patrón de merge habitual:** `create_pull_request` → review (`pull_request_read get_diff` si hace falta) → `merge_pull_request` con `merge_method=squash`. GitHub auto-borra la rama remota al hacer squash via API (la config del repo lo tiene activado). Local se limpia con `git branch -D`.
- **Plan B cuando el MCP de GitHub se desconecta** a mitad de sesión: (1) re-auth vía `mcp__github__authenticate` (abre URL, pega callback en `mcp__github__complete_authentication`); (2) si no revive, squash-merge local (`git merge --squash <rama> && git commit -m "... Closes #N" && git push origin main`) — cierra la PR por keyword match; (3) mergear desde UI GitHub. **Nunca inventar tokens** en el chat — el PAT queda en el transcript.
- Los deploys de Edge Functions Supabase NO usan MCP desde Claude Code — requieren `SUPABASE_ACCESS_TOKEN` que vive solo en la máquina local de San o en Claude.ai con su MCP de Supabase.

### 🖱️ Cómo Claude Desktop habla con Claude Code (vía MCP Chrome)

- El canal es el **Chrome MCP**: Claude Desktop abre una sesión con Chrome, detecta en la pestaña activa el textarea de Claude Code y escribe ahí mis prompts.
- **El editor de Claude Code es Tiptap** (wrapper encima de **ProseMirror**). NO es un `<textarea>` plano ni `contenteditable` crudo — tiene modelo interno de documento, parser Markdown, undo stack propio.
- **Método de inyección:** `document.execCommand('insertText', false, <texto>)`. ProseMirror lo reconoce vía su plugin de DOM-observer y traduce a transacciones del schema. `insertText` preserva saltos de línea, no dispara las validaciones anti-XSS de ProseMirror, y mantiene el cursor en la posición esperada.
- Alternativas descartadas: `textarea.value = ...` no aplica (no es textarea); `ClipboardEvent`/`paste` es frágil (depende del plugin `clipboardTextParser`); `Input` event manual requiere construir un `InputEvent('beforeinput', {inputType: 'insertText', data})` que ProseMirror sí admite pero obliga a replicar su state machine interna.
- Para envío del prompt tras inyección: simular `Enter` con `KeyboardEvent('keydown', {key:'Enter'})` sobre el editor. Shift+Enter si se necesita salto de línea dentro del prompt.
- **Failure modes conocidos:**
  - Si Claude Code compila con una versión de ProseMirror que endurece el plugin anti-`execCommand`, esto se rompe — fallback a `InputEvent` manual.
  - Si el textarea está en modo "slash command menu" abierto, `insertText` se traga el texto — hay que cerrar el menú con `Escape` antes.
  - Tiptap tiene debouncing interno de ~16ms para batch de inputs — inyecciones muy rápidas seguidas (<10ms) se pueden perder; insertar chunks de ~200 chars con pausas de 50ms si el texto es largo.

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
- **Consultar `errores_conocidos_porra.md`** (ERR-01 a ERR-27) antes de debuggear
- **Detectar decisiones autónomas de Claude Code** con `git diff --stat HEAD` antes de commit
- dice.js se mantiene dentro de admin.js (no separar)
- **Badge-with-flag-fallback** es patrón permanente para imágenes de equipo
- **Para programar crons de partidos usar `schedule_match_crons(match_key, start_ts)`**, nunca duplicar crons manualmente
- **Verificación CSS/build obligatoria tras modificar CSS** (aprendido en ERR-22):
  - Si un estilo no se ve en producción, primer diagnóstico: `getComputedStyle(elementoAfectado).propiedadRelevante`. Valor default/initial = el CSS no está aplicándose (no es bug de lógica). Entonces buscar si ese fichero CSS está enlazado en `index.html`.
  - Antes de mergear cambios de diseño a `main`: `npm run build && ls dist/css/ && grep -l "<selector-esperado>" dist/css/*.css`. Si el selector no aparece en ningún CSS del `dist/`, abortar merge.
  - Si `index.html` tiene `<style>` inline con comentarios `Archivo destino : X.css`, es migración pendiente — ejecutarla ANTES de añadir reglas nuevas a los ficheros destino.

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
