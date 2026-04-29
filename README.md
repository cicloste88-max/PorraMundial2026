# Porra Mundial 2026

App de pronósticos para el Mundial 2026 (Canadá · México · Estados Unidos). Grupos de amigos crean ligas privadas, predicen partidos (fase de grupos + eliminatorias + premios individuales) y compiten en un scoreboard en tiempo real.

**Producción:** [porramundial2026-seven.vercel.app](https://porramundial2026-seven.vercel.app)
**Arranque del torneo:** 11 de junio de 2026

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | Vite + vanilla JS/CSS (SPA) |
| Backend | Supabase (Postgres + Auth + RLS + Edge Functions) |
| Deploy | Vercel (autodeploy desde `main`) |
| Live scoring | Apify actor propio (Playwright + proxy residencial Webshare) |
| Notificaciones | Twilio WhatsApp |
| Agentes | Claude Haiku via Anthropic API + `porra-orchestrator` EF |
| Seguridad | Cloudflare Turnstile (CAPTCHA login, Managed mode) |

---

## Estructura del proyecto

```
porra-mundial-2026/
│
├── index.html                          ← SPA (checkpoint v15c)
├── vite.config.js                      ← Config Vite
├── package.json
│
├── css/                                ← Estilos
│   ├── base.css                        · Reset, variables, layout principal
│   ├── welcome.css                     · Welcome screen + auth modal
│   ├── ko.css                          · Bracket KO + modal partido + awards
│   ├── admin.css                       · Panel admin + dado
│   ├── boost.css                       · Boost x2 (llamas, ticker)
│   └── bracket-results.css             · Vista resultados KO
│
├── js/                                 ← Entry point Vite
│   └── main-entry.js                   · ESM entry, expone Supabase y carga la chain
│
├── public/js/                          ← Classic scripts cargados vía loadScript
│   ├── shell.js                        · Bootstrap de la app (carga chain de scripts)
│   ├── data.js                         · PARTIDOS, EQUIPOS, GRUPOS, BRACKET, predictions
│   ├── scoring.js                      · Motor de puntos + tarjetas + premios
│   ├── ui-groups.js                    · Vista Grupos + Vista Jornada
│   ├── ui-groups-mobile.js             · Vista móvil grupos (acordeón + focus layer + carrusel)
│   ├── ui-directo.js                   · Vista Directo (live scores + simulacros admin)
│   ├── ko.js                           · Bracket KO + predicciones IA
│   ├── ui-nav.js                       · SPA nav + modal + welcome
│   ├── auth.js                         · Autenticación Supabase
│   ├── leagues.js                      · Sistema de ligas (crear/unirse/seleccionar)
│   ├── scoreboard.js                   · Clasificación multi-usuario
│   ├── close-porra.js                  · Cierre de pronósticos
│   ├── admin.js                        · Panel admin + dado + simulador
│   ├── bracket-results.js              · Vista resultados reales del bracket KO
│   ├── live-sync.js                    · Sincronización en tiempo real (Supabase Realtime)
│   └── misc.js                         · Utilidades UI
│
├── apify-actors/                       ← Actores Apify custom
│   └── sofascore-webshare-proxy/       · Actor principal (producción)
│
├── supabase/
│   └── migrations/                     ← Migraciones SQL aplicadas a BD (timestamps)
│
├── supabase-ef-patches/                ← Snapshots de Edge Functions
│
├── docs/                               ← Documentación técnica histórica
│
├── CLAUDE.md                           ← Contexto para Claude Code
├── CONTEXTO_PORRA_2026.md              ← Contexto maestro
├── migration-log.md                    ← Bitácora cronológica
└── ESQUEMA_SISTEMA_PORRA2026.xlsx      ← Esquema sistema completo
```

---

## Base de datos (Supabase)

**Proyecto:** `cmyfyswystjgzdwbqyyb`

| Tabla | Descripción |
|-------|-------------|
| `profiles` | Usuarios registrados (`is_admin`, `nombre`) |
| `leagues` | Ligas creadas (`nombre`, `codigo`, `created_by`) |
| `league_members` | Membresías (`porra_cerrada`, `cerrada_at`) |
| `predictions` | Pronósticos de grupos `(user_id, league_id, match_id)` |
| `ko_predictions` | Pronósticos KO `(user_id, league_id, match_id)` |
| `award_picks` | Premios individuales `(user_id, league_id)` |
| `boost_picks` | Boosts diarios `(user_id, league_id, match_id, match_date)` |
| `results` | Resultados reales del torneo + overrides manuales (JSON, id=1) |
| `orchestrator_jobs` | Historial ejecuciones agentes Haiku |
| `live_scores` | Estado partidos en vivo (status, score, events, sofascore_event_id). Columna `is_historic BOOLEAN DEFAULT false`: `true` = trial runs / pruebas, conservado como referencia consultiva de formatos/estados. **No usar en scoring** (filtrar `WHERE is_historic = false`). |
| `whatsapp_subscribers` | Teléfonos activos para notificaciones |
| `ia_snapshots` | Snapshots del predictor IA (ELO, H2H, form) por fecha |
| `ia_predictions` | Predicciones IA por partido (signo, probabilidades) |

RLS habilitado en todas las tablas. Audit de seguridad completo aplicado 28-29abr2026 (PR#36-38).

---

## Edge Functions

| Función | Versión | Descripción |
|---------|---------|-------------|
| `admin-actions` | v7 | Gestión admin. Requiere JWT admin |
| `update-results` | v4 | Sync football-data.org → `results`. Activar pg_cron el 11 jun |
| `porra-orchestrator` | v3 | N agentes Haiku en paralelo → `orchestrator_jobs` |
| `porra-patch-deploy` | v4 | Patches search/replace + commit GitHub |
| `porra-fix-encoding` | v6 | Inspect/write ficheros GitHub via API |
| `porra-match-live` | v16 | Live scores async + webhook |
| `porra-apify-webhook` | v7 | Recibe webhooks Apify, detecta goles + status, llama Twilio |
| `porra-whatsapp-send` | v1 | Envía WhatsApp via Twilio (form-urlencoded fetch) |
| `porra-whatsapp-webhook` | v4 | Webhook entrada WhatsApp |
| `create-league` | v2 | Crear liga (cualquier usuario, max 3 no-admin). verify_jwt=false |
| `porra-ia-compute` | v10 | Motor IA Predictor (ELO+H2H+form+host). Genera ia_snapshots + ia_predictions |

---

## Funciones DB helpers

Helpers SQL para programar los crons de un partido sin duplicar lógica. Generan automáticamente un **prematch** (T-45min, 1 disparo) más **polling** (`*/3 * * * *` durante 150min desde `start_ts`).

| Función | Descripción |
|---------|-------------|
| `schedule_match_crons(match_key TEXT, start_ts TIMESTAMPTZ)` | Crea los crons `prematch_<match_key>` y `poll_<match_key>`, ambos invocando `porra-match-live`. |
| `unschedule_match_crons(match_key TEXT)` | Elimina ambos crons del partido. Uso: limpieza tras cambio de fecha o cancelación. |

```sql
-- Programar partido
SELECT schedule_match_crons('wc_mex_rsa', '2026-06-11 20:00:00+00'::timestamptz);

-- Limpiar
SELECT unschedule_match_crons('wc_mex_rsa');
```

**Nota:** patrón reutilizable para los 104 partidos del Mundial. Reemplaza duplicación manual de crons.

---

## Motor de puntuación

### Por partido (máximo 7 pts · 14 pts con boost x2)

| Concepto | Puntos |
|----------|--------|
| Signo correcto (1/X/2) | +1 |
| Resultado exacto (incluye signo, no acumula con +1) | +3 |
| Goleador correcto | +2 |
| Bonus vs IA (pronóstico opuesto a IA y aciertas) | +1 |

### Por equipos que avanzan en KO

| Ronda | Puntos |
|-------|--------|
| Grupos → R32 | +5 por equipo |
| R32 → R16 | +5 por equipo |
| R16 → QF | +10 por equipo |
| QF → SF | +15 por equipo |
| SF → Final | +20 por equipo |
| Campeón | +25 |

### Clasificación final

| Posición | Puntos |
|----------|--------|
| Campeón | +30 |
| Subcampeón | +20 |
| 3.º puesto | +15 |
| 4.º puesto | +10 |

### Premios individuales

Balón de Oro, Bota de Oro, Guante de Oro (+15 pts), Mejor Joven ≤21 (+20 pts). Configurados en `AWARDS_CFG`.

---

## Estructura del torneo

- 48 equipos · 12 grupos (A–L) de 4 equipos · 72 partidos de grupos · 17 jornadas
- Clasifican: 2 primeros de cada grupo + 8 mejores terceros = 32 equipos
- Rondas KO: R32 → R16 → QF → SF → 3er puesto → Final
- Total: 104 partidos

**Primer partido:** México vs Sudáfrica · 11 jun 2026 · Estadio Azteca

---

## Sistema live scores

Flujo asíncrono con webhook:

```
pg_cron (durante partido)
  → net.http_post → porra-match-live EF
      → Apify API: lanzar actor N8vUChlhok5JU3cnL async
  → Apify webhook → porra-apify-webhook EF
      → leer dataset: { event, incidents }
      → detectar goles + cambios status
      → Twilio directo (form-urlencoded fetch) → WhatsApp
      → upsert live_scores
```

**Actor principal (producción):** `sofascore-webshare-proxy` (~$0.001/run)
**Coste estimado torneo completo:** ~$13

**Patrón de polling:** Pre-match T-45min (1 call) → cada 3min durante partido → estados: `notstarted/inprogress/halftime/overtime/penalties/finished`

---

## Variables de entorno (Supabase Vault)

| Secret | Descripción |
|--------|-------------|
| `SUPABASE_URL` | Auto-inyectado |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-inyectado |
| `SUPABASE_ANON_KEY` | Auto-inyectado |
| `ANTHROPIC_API_KEY` | API Anthropic para agentes Haiku |
| `GITHUB_TOKEN` | Token acceso repo para `porra-patch-deploy` |
| `GITHUB_REPO` | Nombre del repo (`usuario/repo`) |
| `APIFY_TOKEN` | Token Apify para actores |
| `TWILIO_ACCOUNT_SID` | Twilio |
| `TWILIO_API_KEY` | Twilio |
| `TWILIO_API_SECRET` | Twilio |
| `TURNSTILE_SITE_KEY` | Cloudflare Turnstile sitekey público (login CAPTCHA) |
| `TURNSTILE_SECRET_KEY` | Cloudflare Turnstile secret key (validación servidor) |

---

## Seguridad

### CAPTCHA

Login protegido con Cloudflare Turnstile (Managed mode). En localhost se usa el test sitekey `1x00000000000000000000AA` (always-passes, banner rojo "Solo para pruebas" esperado). En producción se usa el sitekey real `0x4AAAAAADFzAxFI4isPOuJx`. Detección vía `window.location.hostname` en script inline. Secret en Supabase Auth → Attack Protection.

### Audit Postgres (28-29 abr 2026)

Auditoría completa de seguridad y rendimiento aplicada (PR#36-40):

- RLS habilitado en todas las tablas públicas expuestas.
- REVOKE/GRANT en funciones de control (`enforce_max_leagues`, `handle_new_user`, `schedule`/`unschedule_match_crons`).
- `search_path` fijado en todas las funciones públicas.
- 7 índices de FK creados (rendimiento).
- Policies duplicadas eliminadas; 17 RLS rewrites con `(SELECT auth.uid())`.
- Advisor Supabase: 0 ERRORs.

---

## Documentación interna

| Fichero | Propósito |
|---------|-----------|
| `CLAUDE.md` | Contexto de trabajo para Claude Code (sesiones). |
| `errores_conocidos_porra.md` | Histórico de bugs resueltos y patrones críticos (ERR-01 a ERR-33). |
| `migration-log.md` | Bitácora cronológica de etapas del proyecto. |
| `CONTEXTO_PORRA_2026.md` | Contexto maestro del proyecto. |
| `docs/db/audit_28abr_section26_rls_planning.md` | Planning 19 RLS rewrites pendientes |

---

## Desarrollo local

```bash
# Instalar
npm install

# Arrancar dev server
npm run dev          # localhost:5173

# Build producción
npm run build        # genera dist/
npm run preview      # previsualizar build
```

**Credenciales QA locales:** definir en `.env.local`:
```
VITE_QA_EMAIL=...
VITE_QA_PASS=...
```
Se exponen como `window.__QA_EMAIL` / `window.__QA_PASS` sólo en modo dev.

---

## Pipeline de deploy

1. Trabajar en local (`npm run dev` → localhost:5173)
2. QA visual + funcional
3. `git add -A && git commit -m "..." && git push origin main`
4. Vercel detecta el commit y despliega (~30s)
5. Verificar en `porramundial2026-seven.vercel.app`

**Reglas críticas:**
- Nunca push a `main` sin validación local previa
- Push inmediato tras cada commit — nunca acumular
- No crear ni modificar `vercel.json`
- Actualizar `migration-log.md` tras cada acción importante
- Actualizar `README.md` cuando haya cambios estructurales en arquitectura, stack, EFs, funciones DB o features visibles al usuario
- Para crons de partidos usar `schedule_match_crons`, nunca duplicar crons manualmente

---

## Roadmap

### Completado

- Sistema de ligas multijugador con códigos de invitación
- Panel admin completo (resultados, overrides, usuarios, ligas)
- Flujo cierre / reapertura de porra
- Bracket KO con predicciones + predicción IA
- Scoreboard en tiempo real
- Migración a Vite (5 módulos extraídos de `main.js`)
- Boost x2 diario con Canvas de fuego
- Vista Jornada (pestaña, tarjetas compactas, sidebar)
- Sistema live scores con actor Webshare (~$13 torneo completo)
- Notificaciones WhatsApp (goles, descanso, fin…)
- Bracket de resultados reales (timeline vertical + live hero)
- Vista Directo con pipeline live realtime (72 tarjetas Mundial + sección **🧪 Simulacros activos** sólo admin para testing con partidos fuera del torneo)
- Usuarios no-admin pueden crear sus propias porras (hasta 3, admin ilimitado) vía EF `create-league`
- Rediseño móvil de fase de grupos (acordeón por grupo + focus layer pantalla completa + carrusel 6 partidos + slide clasificación + botón Guardar/Deshacer con persistencia en BD)
- IA Predictor integrado (Fases A-F cerradas): motor ELO+H2H+form+host, snapshots en BD, 72 predicciones de grupos, tooltip explicativo +1pt bonus vs IA
- Audit Postgres seguridad completo (PR#36-40, 28-29abr2026): RLS, grants, índices FK, CAPTCHA Turnstile

### Antes del 11 de junio de 2026

- [ ] Migrar WhatsApp sandbox → Meta Business producción
- [ ] Activar pg_cron para `update-results`
- [ ] Cargar convocatorias reales (`EQUIPOS[].players`)
- [ ] Email de confirmación al cerrar porra **con copia de pronósticos al usuario** (Resend + EF)
- [ ] Desactivar signup público cuando entren todos los amigos
- [ ] Verificar estructura JSON `_results.ko_results` con `update-results` real
- [ ] Auto-completar Pichichi del torneo sumando goleadores seleccionados en pronósticos (ayuda lógica al usuario)
- [ ] Enganche final de frases IA para pronóstico signo de partido (lógica ya incorporada, falta wiring)

### Post-torneo

- [ ] Refactor `scoring.js`: separar lógica pura del render
- [ ] Tests unitarios del motor de puntuación (Vitest)
- [ ] Migrar `onclick=` inline a event delegation
- [x] ~~Consolidar CSS inline restante en ficheros separados~~ (resuelto 19 abr, commit `9e93fe8`)
- [ ] Migración completa a ES modules (eliminar `loadScript` chain)

---

## Arquitectura de agentes

```
Supervisor (Claude en conversación · claude.ai)
    └── porra-orchestrator (Edge Function en Supabase)
            └── N agentes Claude Haiku en paralelo
                    └── Resultados en orchestrator_jobs (Postgres)
```

---

*Proyecto personal · Mundial 2026 · cicloste88*
