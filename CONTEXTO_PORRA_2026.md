# CONTEXTO MAESTRO — Porra Mundial 2026
> Actualizado: 2026-04-21 noche | Fuente: checkpoint tras IA Predictor **Fases A–E cerradas y desplegadas** (EF v9 ACTIVE, paridad 46/46, smoke tests verdes)
> Cargar este fichero al inicio de cada sesión para contexto completo inmediato.

---

## 🌐 URLs y accesos

| Recurso | Valor |
|---|---|
| **Producción** | porramundial2026-seven.vercel.app |
| **Repo** | github.com/cicloste88-max/PorraMundial2026 |
| **Rama activa** | `main` |
| **Supabase proyecto** | `cmyfyswystjgzdwbqyyb` |
| **Último commit estable** | `8d8b667` (fase E squash-merge, PR #16 cerrado). IA Predictor **Fases A–E** en main, desplegadas y validadas (EF `porra-ia-compute` v9 ACTIVE, paridad Python↔TS 46/46, smoke tests verdes, snapshot activo `initial_test_21apr`). Fase F (wiring frontend) pendiente. |

---

## 🔴 Pendientes abiertos

### Bugs UI
| Bug | Prioridad |
|---|---|
| Parpadeo botón envío porra (recurrente) | 🟡 |
| Cinta tabs ronda no se visualiza completa en móvil (eliminatorias) | 🟡 |
| Añadir hora CEST a píldora `Grupo · Estadio` en tarjeta de partido | 🟡 |
| Botón simular eliminatorias visible para todos (actualmente solo admin) | 🟢 |
| Auto-completar Pichichi del torneo sumando goleadores seleccionados en pronósticos | 🟢 |
| Enganche final de frases IA para pronóstico signo partido (lógica incorporada, falta wiring) | 🟢 |

### Antes del 11 junio 2026
| # | Tarea | Estado |
|---|---|---|
| 1 | Migrar WhatsApp sandbox → Meta Business (error 63016, parked) | ⏳ |
| 2 | Activar `pg_cron` para `update-results` | ⏳ 11 jun |
| 3 | Cargar convocatorias reales (`EQUIPOS[].players`) | ⏳ jun |
| 4 | Email confirmación al cerrar porra (Resend + EF) **con copia de pronósticos al usuario** | ⏳ |
| 5 | ~~Desactivar signup público~~ | ✅ innecesario (no-admin crea porras, límite 3) |
| 6 | Verificar estructura JSON `_results.ko_results` con update-results real | ⏳ 11 jun |
| 7 | IDs SofaScore de KO (disponibles ~28 jun) | ⏳ 28 jun |

### Playoffs UEFA marzo 2026 — resueltos
Grupo A + República Checa · B + Bosnia · D + Turquía · F + Suecia · I + Irak · K + RD Congo

---

## 🧹 Limpieza repo — sesión 17 abr 2026

Eliminados del repo (24 ficheros tracked, ~1.1 MB):
- 5 backups `.bak`: `index.html.bak`, `js/main.js.bak{,2,3}`, `js/auth.js.bak`
- 3 duplicados bracket-results (raíz + `js/bracket-results.js` versión vieja)
- 6 patches Python one-shot
- 5 markdowns de diseños ya ejecutados
- `js/utils.js` huérfano
- `supabase-ef-patches/porra-apify-webhook-v6.ts` (producción en v7)
- 3 scripts exploratorios Apify

Añadido a `.gitignore`: `apify-actors/*/node_modules/`

---

## ✅ Bugs recientemente resueltos

| Fix | Commit / sesión |
|---|---|
| Auth persistencia sesión (2 clientes Supabase, navigator.locks, storage custom) | 12e6c6c (15 abr PM) |
| Boost UI (guard, parpadeo, savePredictions spam) | 12e6c6c (15 abr PM) |
| Botonera KO móvil (flex-wrap) | 12e6c6c (15 abr PM) |
| `porra-apify-webhook` datasetId extraction (v5 → v7) | 16 abr |
| 404 masivos consola (extractUrl linear-gradient en scoring.js) | 502a464 (16 abr) |
| Header eliminatorias responsive | 43d466c (17 abr) |
| Bracket-results móvil (columnas min-width) | ef82fea (17 abr) |
| Rediseño bracket: timeline vertical + live hero | 2600c1a (17 abr) |
| Pipeline live definitivo async+webhook + actor Webshare | 6aeb470 (17 abr) |
| Vista Directo + sección simulacros admin + fix checkIsAdmin async (ERR-14) | 614b5ef (17 abr PM) |
| Usuarios no-admin pueden crear porras (límite 3) vía EF `create-league` | 34c3532 (18 abr AM) |
| Rediseño móvil fase de grupos (PR #9): acordeón + focus layer + carrusel + slide-7 + persistencia BD | 9d651d5 (19 abr) |
| Fixes producción iPhone: ERR-18 css→public, ERR-19 openFocus defensivo, ERR-20 no body.overflow, ERR-21 layer fuera @media | b4a52e6 · 0aa78a9 · 40c0fe2 · 82b4753 (19 abr) |
| Extracción `<style>` inline de index.html a `public/css/` (commits 2/3/4 de PR #9 no aplicaban en prod) | 9e93fe8 (19 abr) |

---

## 🏗️ Stack

| Capa | Tecnología |
|---|---|
| Frontend | Vite + vanilla JS/CSS, SPA |
| DB + Auth | Supabase (Postgres + Auth + Storage + Edge Functions) |
| Hosting | Vercel (autodeploy desde `main`) |
| Live scores | Apify actor propio (proxy Webshare residencial) |
| Notificaciones | Twilio WhatsApp sandbox |

---

## 📊 Estado del sistema live — tabla resumen

| Componente | Versión | Estado | Notas |
|---|---|---|---|
| **Actor sofascore-webshare-proxy** | build 1.0.7 | ✅ **PRODUCCIÓN** | Proxy Webshare residencial rotativo. ~5-10s por run. ~$0.001/run |
| **Actor sofascore-live-proxy** | build 1.0.19 | ✅ FALLBACK | Playwright + proxy Apify RESIDENTIAL. ~44s por run. ~$0.03/run. Intacto como backup |
| **porra-match-live EF** | v16 | ✅ FUNCIONA | Async (<1s), lanza actor + webhook |
| **porra-apify-webhook EF** | v7 | ⚠️ FUNCIONA con bug | Logging completo, detecta goles + status, llama Twilio directo. **Bug conocido:** no persiste `home_team_name`/`away_team_name`/`competition`/`match_start_ts` (pending v8) |
| **porra-whatsapp-send EF** | v1 | ✅ FUNCIONA | Twilio sandbox, form-urlencoded |
| **porra-whatsapp-webhook EF** | v4 | ✅ FUNCIONA | Captura WaId del suscriptor |
| **Actor Azzouzana `VzKtdb1t0Qnc07X8V`** | — | ❌ NO USAR LIVE | Caché CDN ~15min |
| **porra-sofascore-proxy EF** | v8 | ❌ OBSOLETA | Sustituida por actor propio |

**Coste estimado torneo completo:** ~$13 con Webshare (antes: ~$318 con Apify residential)

---

## 🔄 Flujo de llamadas actual (async + webhook)

```
pg_cron (cada minuto durante partido)
  → net.http_post → porra-match-live EF (<1s)
      → Apify API (lanzar actor N8vUChlhok5JU3cnL async, no espera)
  → (actor termina ~5-10s con Webshare)
      → Apify webhook → porra-apify-webhook EF
          → leer dataset: { event, incidents }
          → detectar cambios vs DB
          → detecta goles + cambios status
          → Twilio directo (form-urlencoded fetch) → WhatsApp
          → upsert live_scores (status, score, events)
```

**Arquitectura async RESUELTA:** pg_net no soporta llamadas >30s, por eso lanza+webhook en vez de request-response.

**Pattern cron:** Pre-match T-45min (1 call) → polling cada 3min durante partido → estados: `notstarted/inprogress/halftime/overtime/penalties/finished`

---

## 🗄️ Base de datos Supabase

| Tabla | Descripción |
|---|---|
| `profiles` | Usuarios (`is_admin`, `nombre`) |
| `leagues` | Ligas (`nombre`, `codigo`, `created_by`) |
| `league_members` | Membresías (`porra_cerrada`, `cerrada_at`) |
| `predictions` | Pronósticos grupos `(user_id, league_id, match_id)` |
| `ko_predictions` | Pronósticos KO `(user_id, league_id, match_id)` |
| `award_picks` | Premios individuales `(user_id, league_id)` |
| `boost_picks` | Boosts diarios `(user_id, league_id, match_id, match_date)` |
| `results` | Resultados reales + overrides manuales (JSON, id=1) |
| `orchestrator_jobs` | Historial ejecuciones agentes |
| `live_scores` | Estado partidos en vivo |
| `whatsapp_subscribers` | Teléfonos activos para notificaciones |

**Campos clave `live_scores`:**
- `match_key` — identificador único del partido (PK)
- `sofascore_event_id` — ID numérico del evento en SofaScore API
- `sofascore_url` — URL completa del partido en sofascore.com
- `status` — notstarted/inprogress/halftime/overtime/penalties/finished
- `score_home`, `score_away` — marcador actual
- `events` — array JSON de incidents (goles, tarjetas, sustituciones)
- `poll_active` — si el cron debe seguir llamando
- `had_overtime`, `had_penalties` — para contextualizar mensaje de fin
- `is_historic BOOLEAN DEFAULT false` — `true` = trial runs / simulacros. **Filtrar `WHERE is_historic=false`** en scoring y UI live del Mundial
- `home_team_name`, `away_team_name`, `competition` — usado por simulacros (partidos fuera del Mundial). Para el Mundial, los nombres se resuelven vía `EQUIPOS` a partir de `match_key`

---

## ⚙️ Edge Functions Supabase

| EF | Versión | Estado | Descripción |
|---|---|---|---|
| `admin-actions` | v7 | ✅ | Gestión admin. Requiere JWT admin |
| `create-league` | v1 | ✅ | Crear liga para cualquier user autenticado. Límite 3 ligas si no-admin. Admins ilimitados. |
| `update-results` | v4 | ⏳ | Sync football-data.org → `results`. Activar pg_cron el 11 jun 2026 |
| `porra-orchestrator` | v3 | ✅ | N agentes Haiku en paralelo → `orchestrator_jobs` |
| `porra-patch-deploy` | v4 | ✅ | Patches search/replace + commit GitHub |
| `porra-fix-encoding` | v5 | ✅ | Inspect/write ficheros en GitHub via API |
| `porra-match-live` | v16 | ✅ | Async (<1s), lanza actor Webshare `N8vUChlhok5JU3cnL` build 1.0.7 (fallback `BYLtYcOxYkruVipwr` build 1.0.19) + webhook |
| `porra-apify-webhook` | v7 | ⚠️ | Detecta goles + status, llama Twilio directo. **Bug:** no persiste `home_team_name`/`away_team_name`/`competition`/`match_start_ts` (pending v8) |
| `porra-whatsapp-send` | v1 | ✅ | Envía mensajes WhatsApp via Twilio |
| `porra-whatsapp-webhook` | v4 | ✅ | Webhook entrada WhatsApp, captura WaId |
| `porra-ia-compute` | v9 | ✅ | IA Predictor (Fases A–E cerradas). 7 actions: `status / scrape_elo / scrape_h2h / scrape_last5 / freeze_snapshot / compute_groups / compute_match`. Motor log-odds+softmax, pesos 75/10/15 (fallback 85/0/15), home adv +85/+95 MEX. Rate limit 30/min. Quip Haiku 4.5. `verify_jwt=false` |
| `porra-sofascore-proxy` | v8 | ❌ | Obsoleta, sustituida por actor propio |
| `porra-github-pusher` | v6 | ❌ | PLACEHOLDER — ignorar |

---

## 🔧 Funciones DB helpers

| Función | Descripción |
|---|---|
| `schedule_match_crons(match_key TEXT, start_ts TIMESTAMPTZ)` | Genera los dos crons de un partido: **prematch T-45min** (1 call) + **polling `*/3 * * * *` durante 150min** desde `start_ts`. Ambos invocan `porra-match-live`. |
| `unschedule_match_crons(match_key TEXT)` | Elimina los crons `prematch_<match_key>` y `poll_<match_key>`. Uso: limpieza tras cambio de fecha o cancelación. |

**Regla:** para programar crons de partidos usar **siempre** `schedule_match_crons`. Nunca duplicar crons manualmente (evita huérfanos).

---

## 🧪 Simulacros (testing live)

Probar el pipeline live con partidos reales fuera del Mundial antes del 11 jun, sin contaminar datos del torneo.

- **Activación:** insert en `live_scores` con `is_historic = true` y `home_team_name`/`away_team_name`/`competition` rellenos; luego `SELECT schedule_match_crons(...)`.
- **Visibilidad:** sólo admin (`profiles.is_admin = true`) ve la sección **🧪 Simulacros activos** en la vista Directo.
- **Activo ahora:** `copadelrey_final_atm_rso` — Atlético de Madrid vs Real Sociedad, 18 abr 19:00 UTC, `sofascore_event_id = 15664537`. Polling ampliado manualmente a 3 h (19–22 UTC) para cubrir prórroga + penaltis.
- **Detalle completo:** ver `CLAUDE.md` sección *Simulacros (testing live)*.

---

## 🤖 IA Predictor

Sistema de pronóstico IA por partido que alimenta el bonus **+1 pt si predicción del usuario opuesta a IA y aciertas** del motor de puntuación. Arquitectura en 3 capas.

**Capa 1 — Ingesta (EF `porra-ia-compute` v6 ACTIVE, 4 scrapers):**

| Action | Fuente | Tabla destino | Estado |
|---|---|---|---|
| `scrape_elo` | Wikipedia `Module:SportsRankings/data/FIFA_World_Rankings` (MediaWiki API) | `ia_elo_fifa` | ✅ Fase B.2 |
| `scrape_h2h` | 11v11.com/teams/{slug}/tab/stats/ (HTML) | `ia_h2h` | ✅ Fase D.2 |
| `scrape_last5` | 11v11.com/teams/{slug}/tab/matches/ (HTML) | `ia_last5_results` | ✅ Fase C (en rama, EF desplegada) |
| `compute` | Las 3 tablas anteriores | `ia_predictions` | ⏳ Fase E pendiente |

**Capa 2 — Cómputo (Fase E, cerrada y desplegada en EF v9):** motor log-odds+softmax con fórmula **ELO 75% + H2H 10% + Racha 15%** (fallback **85/0/15** si H2H<5 partidos). Home advantage +85 base hosts / +95 MEX (solo en grupos). Sign = argmax; margen dudoso <0.08. Tabla `ia_snapshots` con invariante "1 activo" → fairness absoluta (misma predicción para todos los users). Paridad Python↔TS validada 46/46 sobre WC2022 con tolerancia 1e-3. Back-test: accuracy 63.0%, log-loss 0.932, Brier 0.560. Pesos revisados tras análisis de colinealidad ELO↔Racha (previos 50/25/25 obsoletos).

**Capa 3 — Consumo (Fase F, pendiente):** `scoring.js` / `ko.js` leen `ia_predictions` (RLS policy `ia_predictions_public_read` lo permite), pintan pronóstico + quip en tarjeta, calculan el bonus IA opuesta.

**Estado tablas al 21 abr noche:**
- `ia_elo_fifa`: **211 filas** (FIFA actualizada al 2026-04-01).
- `ia_h2h`: **815 pairs únicos** de los ~1.128 teóricos entre los 48 mundialistas (~72% cobertura).
- `ia_last5_results`: **48 filas** (N=8 partidos por selección en `results JSONB`).
- `ia_snapshots`: **2 filas** (snapshot activo: `initial_test_21apr`, id=2).
- `ia_predictions`: poblada por `compute_match` on-demand; batch completa prevista en cron `ia-compute-groups-mundial` 11 jun 00:10 UTC (72 filas de fase de grupos).

**Profundidad racha dinámica:** `N=8` default, ampliable a `N=10` antes del 11 jun vía `{"action":"scrape_last5","limit":10}` cuando 11v11 publique el primer amistoso pre-Mundial. Activación manual.

**Headers obligatorios para 11v11.com** (sin los 3 → 403, ver ERR-25):
```
User-Agent: Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36
Accept: text/html,application/xhtml+xml
Accept-Language: en-US,en;q=0.9
```

**Mapping 48 mundialistas** (`WC2026_TEAMS` en la EF, tipo `[iso3, owner_slug, opposition_name, display_name]`): fuente de verdad en `supabase/functions/porra-ia-compute/index.ts`. Actualizar ahí si 11v11 renombra alguna selección.

**Detalle completo:** ver `CLAUDE.md` sección *IA Predictor (Fases A–F)*. Historial de commits en `migration-log.md` entrada 21-04-2026.

---

## 🤖 Actor Apify principal — sofascore-webshare-proxy

| Campo | Valor |
|---|---|
| **Actor ID** | `N8vUChlhok5JU3cnL` |
| **Build** | 1.0.6 |
| **Repo** | `apify-actors/sofascore-webshare-proxy/` en GitHub |
| **Input** | `{ "eventId": "15832749" }` |
| **Output** | `{ eventId, event: {data:{event}}, incidents: {data:{incidents:[]}} }` |
| **Latencia** | ~5-10s por run |
| **Coste** | ~$0.001 por run |
| **Técnica** | Proxy Webshare residencial rotativo + fetch directo a `api.sofascore.com` |

**Por qué funciona:** las IPs residenciales no están en las listas negras de Cloudflare Bot Management. Las cookies SofaScore no están ligadas a IP — se pueden reutilizar entre requests desde IPs distintas.

**Ventaja vs actor previo (sofascore-live-proxy):** ~$13 coste total torneo vs ~$318. No requiere Playwright ni browser context; Webshare resuelve el problema de Cloudflare con solo rotación de IP.

---

## 🤖 Actor Apify fallback — sofascore-live-proxy

| Campo | Valor |
|---|---|
| **Actor ID** | `BYLtYcOxYkruVipwr` |
| **Build** | 1.0.19 |
| **Imagen Docker** | `apify/actor-node-playwright-chrome:20` |
| **Repo** | `apify-actors/sofascore-live-proxy/` en GitHub |
| **Latencia** | ~30-44s por run |
| **Coste** | ~$0.03 por run |
| **Técnica** | Playwright lanza Chrome + proxy Apify RESIDENTIAL → carga sofascore.com → `page.evaluate(fetch)` llama a api.sofascore.com desde contexto browser → bypasea Cloudflare |

**Por qué se mantiene:** fallback si Webshare falla o su plan expira. Más caro pero robusto.

---

## 📱 Sistema WhatsApp

| Campo | Valor |
|---|---|
| **Twilio sandbox** | +14155238886 |
| **Código de acceso** | join load-herd |
| **AccountSid** | `AC519cc59a65a9b28a71c178325b6307a5` |
| **API Key** | `SK4d89720c0f1a25825542156cfea170f1` |
| **Suscriptores activos** | +34618874646 |
| **Secrets en Vault** | `TWILIO_ACCOUNT_SID`, `TWILIO_API_KEY`, `TWILIO_API_SECRET` |

**Notificaciones configuradas:**
- 🟢 Arranca el partido
- ⏸ Descanso (con marcador)
- 🟢 Segunda parte
- ⚽ Gol (jugador, minuto, marcador)
- ⚡ Prórroga
- 🤽 Penaltis
- 🏁 Fin del partido

**Pendiente:** migración a Meta Business producción. Bloqueado por error Meta 63016 (parked).

---

## 🏆 Motor de puntuación

**Por partido:**
| Acierto | Puntos |
|---|---|
| Signo correcto (1/X/2) | +1 |
| Resultado exacto | +3 (no acumula con signo) |
| Goleador correcto | +2 |
| Pronóstico opuesto a IA y aciertas | +1 bonus |
| **Máximo por partido** | **7 pts** |
| **Con boost x2 si exacto** | **14 pts** |

**KO:** grupos+5 / r32+5 / r16+10 / qf+15 / sf+20 / campeón+25
**Clasificación final:** Campeón+30 / Subcampeón+20 / 3º+15 / 4º+10
**Premios individuales:** Balón/Bota/Guante Oro 15pts, Mejor Joven ≤21 20pts

---

## 🌍 Estructura del torneo
- 48 equipos, 12 grupos (A-L) de 4, 72 partidos grupos, 17 jornadas
- 2 primeros + 8 mejores terceros = 32 equipos
- R32 → R16 → QF → SF → 3er puesto → Final — **104 partidos total**
- **Primer partido:** México vs Sudáfrica · 11 jun 2026 · Azteca · eventId=15186710

---

## 🔑 SofaScore IDs

| Torneo | tournament | season |
|---|---|---|
| UCL 2025/26 | 7 | 61644 |
| World Cup 2026 | 16 | 58210 |

72 partidos grupos mapeados en `worldcup-2026-sofascore-ids.json` (repo).
IDs KO disponibles ~28 jun 2026 (tras finalizar fase de grupos).

---

## 🔧 Herramientas disponibles en Claude.ai

**Supabase MCP** (`cmyfyswystjgzdwbqyyb`):
- `execute_sql` — ejecutar SQL
- `get_logs` — logs de Edge Functions
- `list_edge_functions` / `get_edge_function` / `deploy_edge_function`

**Claude in Chrome:**
- QA visual en `localhost:5173` y producción
- Login producción: `_porraDb.auth.signInWithPassword({email:'cicloste88@gmail.com', password:'910500'})`
- Login local: `window.__QA_EMAIL` / `window.__QA_PASS` via `.env.local`

**Canva MCP:** disponible, no usado en porra.

---

## 🚦 Flujo de trabajo (reglas de oro)
1. San describe bug/mejora
2. Claude analiza y genera fix
3. Fix se prueba en **LOCAL** (`npm run dev` → localhost:5173)
4. Claude in Chrome hace QA visual autónomo
5. Solo cuando validado: `commit + push` a `main` → Vercel autodeploy
6. Claude verifica en producción

**NUNCA push sin validación local previa.**
**NO tocar vercel.json.**
**Push inmediato tras cada commit — nunca acumular.**

---

## 📅 Historial de sesiones

| Fecha | Hitos | Commit |
|---|---|---|
| 2026-04-11 | Migración Vite completa, merge a main, fix vercel.json MIME | — |
| 2026-04-12 AM | Extracción main.js en 5 módulos, fixes race condition | ee2e25a |
| 2026-04-12 PM | Bracket Fase 1 SVG overlay. Fix dado/undo Object.assign | 187a764 |
| 2026-04-13 AM | Bracket de resultados reales — bracket-results.js + CSS | cd4afa2 |
| 2026-04-13 PM | Splash screen — inline script, hero/scroll-cue | 3473c76 |
| 2026-04-13 tarde | Boost x2 completo — Canvas fuego, Supabase, ticker | 6c3d30b |
| 2026-04-13 noche | Vista Jornada — pestaña, tarjetas compactas, sidebar | ef39b3d |
| 2026-04-14 | Vista Jornada fixes. Sistema WhatsApp live scores completo | 8e8ac44 |
| 2026-04-15 AM | Actor propio BYLtYcOxYkruVipwr. Arquitectura async+webhook resuelta. match-live v13 + apify-webhook v5 | b95ba00 |
| 2026-04-15 PM | Fix auth persistencia, boost UI, botonera KO móvil. Diagnóstico bug webhook datasetId | 12e6c6c |
| 2026-04-16 | Fix `porra-apify-webhook` datasetId (v7). Migración actor a Webshare (~$0.001/run, ~$13 torneo) | — |
| 2026-04-17 AM | Fix 404 linear-gradient, header eliminatorias responsive, bracket móvil, rediseño bracket timeline | 2600c1a |
| 2026-04-17 PM | Revisión profunda del código + limpieza repo (24 ficheros eliminados) | — |
| 2026-04-17 PM | Pipeline live definitivo async+webhook + actor Webshare. Helpers DB `schedule_match_crons`. Flag `is_historic` | 6aeb470 |
| 2026-04-17 PM | Persistencia histórica: `errores_conocidos_porra.md` + `migration-log.md` en repo (PR #1) | 549746e |
| 2026-04-17 PM | Vista Directo + sección simulacros admin (PR #3). Fix `checkIsAdmin` async con retries (ERR-14) | 614b5ef |
| 2026-04-18 AM | EF `create-league` v1 + frontend `leagues.js`: no-admin puede crear hasta 3 porras (PR #5) | 34c3532 |
| 2026-04-19 | Rediseño móvil fase de grupos (PR #9): 4 commits acordeón + focus layer + carrusel + slide-7 | 9d651d5 |
| 2026-04-19 | Fixes producción iPhone (ERR-18/19/20/21): css→public, openFocus defensivo, no body.overflow, layer fuera @media | 82b4753 |
| 2026-04-19 | Extracción `<style>` inline de index.html a `public/css/` (hace aplicar commits 2/3/4 de PR #9) | 9e93fe8 |
| 2026-04-20 noche | Persistencia última página al F5 + skip splash. Saga v2.1→v2.11 (3 capas defensivas: HTML script inline, main-entry guard, ui-nav lock guard). ERR-23 documentado | 8bc7f30 |
| 2026-04-21 AM | Sanity check 20 abr — 4 commits pequeños a `docs/sanity-check-20abr2026.md` (13 hallazgos priorizados) + `CONTEXTO` deuda técnica reescrita por niveles | c5029ac |
| 2026-04-21 AM→PM | **IA Predictor Fases A–D.2** en main (EF `porra-ia-compute` v6). Fase A migración + EF esqueleto (#10); Fase B.2 `scrape_elo` vía Wikipedia Module (#12, B #11 deprecada); Fase D.2 `scrape_h2h` vía 11v11.com/stats (#14, D #13 deprecada por Wikipedia inadecuada ERR-24). Estado tablas: ELO 211 · H2H 815 · last5 pendiente | bbad657 |
| 2026-04-21 PM | **Fase C IA Predictor** — `scrape_last_n` vía 11v11.com/matches (N=8 default, ampliable). EF v6 desplegada desde rama (bypass merge por ERR-26) y PR #15 squash-mergeada localmente con `Closes #15` cuando MCP GitHub estaba disponible. Smoke: teams_parsed 48/48, rows_upserted 48/48 | 2904025 |
| 2026-04-21 PM | **Fase E IA Predictor (código)** — motor log-odds+softmax en rama `claude/fase-e-motor`. 8 commits: migration `ia_snapshots` + alter `ia_predictions` + CHECK `ia_h2h`, `lib/predictor.ts` (port fiel de Python, paridad 1e-3), `lib/repository.ts` + `lib/wc2026.ts` + `TEAM_NAMES_ES`, `lib/auth.ts` (require + cron + service_role bypass) + `lib/quipGenerator.ts` (Claude Haiku + fallback), refactor `index.ts` con 3 nuevas actions (`freeze_snapshot/compute_groups/compute_match`) + rate limit 30/min + CORS whitelist, tests (13 unitarios + paridad 46 casos WC2022), cron 11 jun 00:00 UTC + 00:10, docs consolidados. | rama claude/fase-e-motor |
| 2026-04-21 noche | **Fase E IA Predictor — deploy + validación + merge.** 2 migraciones aplicadas, secrets `IA_CRON_KEY` (Vault 64 chars) + `ANTHROPIC_API_KEY` (EF secrets). 3 fixes sobre la rama durante smoke tests: (fa79699) `ANTHROPIC_API_KEY` via `Deno.env.get` en lugar de Vault — spec §3.1 erróneo, corregido; (36ba6b3) `.schema("vault")` en supabase-js v2 (no funciona en runtime porque el schema no está expuesto); (a210598) fix definitivo vía RPC `get_vault_secrets` con `fetch` directo (ver ERR-27). EF `porra-ia-compute` **v9 ACTIVE**. Paridad Python↔TS **46/46 verde** con tolerancia 1e-3 (ejecutada vía Node `--experimental-strip-types` porque `deno.land` bloqueado en sandbox). Smoke tests todos verdes. PR #16 squash-mergeada a main. | `8d8b667` |

---

## 🐛 Patrones críticos

**DOMContentLoaded en scripts dinámicos:**
```js
if (document.readyState === 'loading') { addEventListener('DOMContentLoaded', fn) } else { fn() }
```
Los classic scripts cargados via `loadScript` chain se ejecutan después de `DOMContentLoaded`, por lo que `addEventListener('DOMContentLoaded', fn)` a secas NO se dispara.

**SofaScore API — por qué 403 desde servidor:**
Cloudflare Bot Management detecta peticiones no-browser. Soluciones posibles:
- **Webshare residential** (actor actual): IPs residenciales rotativas bypasean Cloudflare directamente
- **Playwright + page.evaluate(fetch)** (fallback): fetch desde contexto browser real con el mismo origen

**pg_net timeout:** llamadas que tardan >30s deben usar patrón async (lanzar + no esperar) y recoger resultado via webhook. Aplicado en `porra-match-live` v16.

**boost_picks upsert:** `onConflict:'user_id,league_id,match_date'` — no DELETE. Evita parpadeo UI.

**vercel.json:** NO crear ni modificar. Vercel gestiona MIME types correctamente por defecto. El wildcard `source: "/(.*)"` corrompe MIME de ES modules.

**Vite + public/ colisión de rutas:** si hay un fichero en raíz y otro en `public/` con la misma URL, **raíz gana en dev, sólo public/ existe en build**. Causa desincronización silenciosa dev vs prod. Aprendido tras descubrir que `js/bracket-results.js` (raíz, viejo) ganaba en dev sobre `public/js/bracket-results.js` (nuevo).

**Shims inline en index.html:** `handleCTA()` y `openAuthModal()` están inline (líneas 1440-1445) como fallback para onclick HTML que dispara antes de que `auth.js` cargue vía loadScript chain.

**Chequeos async que condicionan render (ERR-14):** cualquier chequeo asíncrono que decida si una sección del DOM se pinta debe (1) reintentarse si recursos *upstream* (auth, BD) no están listos, (2) disparar re-render al completar, (3) tener guard anti-loop comparando con el último valor renderizado. Aplicado en `checkIsAdmin` (`public/js/ui-directo.js`).

---

## 🔍 Deuda técnica identificada (sanity check 20 abr 2026)

> Detalle completo en **`docs/sanity-check-20abr2026.md`**. Resumen:

### Crítico (invertir antes del 11 jun 2026)

| Área | Detalle | Prioridad |
|---|---|---|
| **IA fake** | `scoring.js:941` y `ui-nav.js:49` fetchean `api.anthropic.com` **sin `x-api-key`** → 401 silencioso → fallback hardcoded. La feature IA aparenta funcionar sin funcionar. | 🔴 Crítica |
| **Tests** | 0 tests sobre 8.626 LOC JS. Motor de puntuación (`calc*Points`) decidirá quién gana el bote. Riesgo de disputas reales. | 🔴 Crítica |
| **CI/CD** | `.github/workflows/` vacío. Cada push a `main` llega a Vercel sin gates. Origen directo del coste de la saga v2.1→v2.11 (11 iteraciones). | 🔴 Crítica |

### Alto (mantenibilidad / escala)

| Área | Detalle | Prioridad |
|---|---|---|
| Estado global | **105 símbolos** `window.*` leídos, **59 asignaciones** `window.X = ...`. Sin contrato, difícil debug. | 🟠 Alta |
| `onclick=` inline | **62 ocurrencias** en `index.html` obligan a funciones globales. `ReferenceError` silenciosos al renombrar. | 🟠 Alta |
| `scoring.js` mixto | 1.438 LOC mezcla reglas puras (testeables), render DOM (`createMatchCard`, `updateCardUI`), datos (`KIT_OVERRIDES`, `STICKER_POOL`) y la llamada muerta a IA. | 🟠 Alta |
| `ui-groups.js` / `ui-groups-mobile.js` | Paralelos, ~36 funciones entre ambos. Riesgo de divergencia desktop/móvil ya visto dos veces (ERR-22). | 🟠 Alta |
| Saga meta F5 | No había tooling rápido para diagnóstico visual (`MutationObserver` llegó en la iteración 11). Causa meta de ERR-23. | 🟠 Alta |

### Medio (performance / UX)

| Área | Detalle | Prioridad |
|---|---|---|
| Bundle único | `dist/assets/index-*.js` = 188 kB (49 kB gzip). Sin code splitting. Admin + KO + Live se descargan siempre. | 🟡 Media |
| `loadScript` chain | **14 requests HTTP secuenciales** en `main-entry.js`. En 3G añade 2-3s al arranque. | 🟡 Media |
| `setTimeout` magic | **27 números mágicos** dispersos. Parte del coste de la saga F5. | 🟡 Media |
| Splash 4s hardcoded | Amigos nuevos esperan 4s fijos cada primera visita por dispositivo. | 🟡 Media |
| Auth en localStorage | Tokens expuestos a XSS. Tolerable pero requiere auditoría de `innerHTML` (~70 usos) + `escapeHtml` en datos de usuario. | 🟡 Media |

### Bajo (cosmético / infra)

| Área | Detalle | Prioridad |
|---|---|---|
| `console.log/warn/error` | **56 ocurrencias** en producción sin gate por env. | 🟢 Baja |
| CSP / SRI | Google Fonts sin `integrity`. Sin `Content-Security-Policy` header. | 🟢 Baja |
| Analytics / errors | Sin Sentry, Plausible ni equivalente. Durante el Mundial los errores móviles se perderán. | 🟢 Baja |

### ✅ Resuelto durante abr 2026

- ~~4 bloques `<style>` inline en `index.html` duplicados con `css/*.css`~~ → ✅ 19 abr (`9e93fe8`)
- ~~`css/` fuera de `public/` no llegaba al build de Vite~~ → ✅ 18 abr (`b4a52e6`)
- ~~Flash welcome al F5 con sesión válida~~ → ✅ 20 abr saga v2.1→v2.11 (HEAD `8bc7f30`)

### Plan 8 semanas (20 abr → 11 jun)

- **S1-S2** — Tests motor puntuación · CI básica · EF `porra-ia-predict` (4 días)
- **S3-S4** — Code splitting · Logger · Sentry · Auditoría innerHTML (3 días)
- **S5-S6** — Split `scoring.js` · Consolidación `ui-groups*` · Event delegation (3-4 días, requiere tests S1)
- **S7-S8** — Tooling debug · Splash condicional · `AppState` + `TIMINGS` (2-3 días)

**Plan NO hacer antes del Mundial:** TypeScript, hash routing, Service Worker, Redux, cookies `httpOnly`. Todo ello sobredimensionado vs la inversión crítica.

---

### Plan de 6 fases histórico (mantenido como referencia)

Fase 0 higiene · Fase 1 CSS · Fase 2 tests · Fase 3 onclick delegation · Fase 4 refactor scoring · Fase 5 ES modules. Fase 0 ejecutada 17 abr 2026. Fase 1 ejecutada 19 abr (`9e93fe8`). Fases 2-5 incorporadas al plan 8 semanas arriba.
