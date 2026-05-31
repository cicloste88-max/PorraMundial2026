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
| Notificaciones | Twilio WhatsApp (sandbox; migración Meta Business pre-11-jun) |
| Agentes | Claude Haiku via Anthropic API + `porra-orchestrator` EF |
| Seguridad | Vault EF secrets + RLS Supabase (Turnstile desactivado 30-abr-2026) |

---

## Estructura del proyecto

```
porra-mundial-2026/
│
├── index.html                          ← SPA (checkpoint v15c)
├── vite.config.js                      ← Config Vite
├── package.json
│
├── public/css/                         ← Estilos (Vite copia public/ a dist/)
│   ├── base.css / welcome.css / ko.css / admin.css / boost.css / directo.css / bracket-results.css
│   ├── v3/                             · mundial-shell-v3 + grupos-v3 + eliminatoria-v3
│   └── components/                     · app-header, bottom-tab, tokens, jornada-v2, directo-v2, predictor-shell, elim-shell, grupos-shell, globo-equipos
│
├── js/                                 ← Entry point Vite
│   └── main-entry.js                   · ESM entry, expone Supabase y carga la chain
│
├── public/js/                          ← Classic scripts cargados vía loadScript
│   ├── shell.js                        · Bootstrap de la app (carga chain de scripts)
│   ├── data.js                         · PARTIDOS, EQUIPOS, GRUPOS, BRACKET, predictions
│   ├── scoring.js                      · Motor de puntos + tarjetas + premios
│   ├── ui-groups.js / ui-groups-mobile.js · Vista Grupos legacy (sustituida por v3/)
│   ├── ui-directo.js                   · Vista Directo (live scores + simulacros admin)
│   ├── ko.js                           · Bracket KO legacy + lógica BRACKET reusada por v3
│   ├── ui-elim-shell.js                · Shell legacy F7.X (convive con v3)
│   ├── ui-pred-shell.js                · Predictor (shell propio, fuera de v3)
│   ├── ui-pizarra-tactica.js           · Modal Pizarra Táctica (XI + convocatoria)
│   ├── ui-globo-equipos.js             · Globo 3D (cinta + overlay + panel detalle)
│   ├── ui-nav.js                       · SPA nav + modal + welcome
│   ├── auth.js                         · Autenticación Supabase
│   ├── leagues.js                      · Sistema de ligas (crear/unirse/seleccionar)
│   ├── scoreboard.js                   · Clasificación multi-usuario
│   ├── close-porra.js                  · Cierre de pronósticos
│   ├── admin.js                        · Panel admin + dado + simulador
│   ├── bracket-results.js              · Vista resultados reales del bracket KO
│   ├── live-sync.js                    · Sincronización en tiempo real (Supabase Realtime)
│   ├── misc.js                         · Utilidades UI
│   ├── v3/                             · Shell global v3 + Grupos v3 + Eliminatoria v3
│   └── data/                           · wiki-bio.js (48 fichas) + wiki-data-globo.js
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
| `ia_predictions` | Predicciones IA por partido (signo, probabilidades + breakdown raw context) |
| `ia_elo_fifa` / `ia_h2h` / `ia_last5_results` | Señales del motor IA (ELO/H2H/form). RLS select-authenticated en `ia_elo_fifa` (PR `20260519103959`) |
| `squads` | Plantillas 48 selecciones (XI + roster + entrenador + stats). Sync vía CLI `scripts/sync-squads.mjs`. Cobertura 10/48 (20-may-2026) |

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
| `get-squad` | v* | Sirve datos de `squads` (XI + roster + entrenador) a la Pizarra Táctica |

Versiones canónicas en `docs/architecture.md` § Edge Functions.

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

Cloudflare Turnstile **desactivado el 30-abr-2026**. Login protegido por
Supabase Auth + rate-limits + Attack Protection. Detalle: `docs/secrets.md`.

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
| `CLAUDE.md` | Contexto de trabajo para Claude Code (sesiones). Incluye top-3 prioridades y reglas críticas. |
| `errores_conocidos_porra.md` | Catálogo bugs resueltos y patrones críticos (ERR-01 a ERR-66). Consultar antes de debuggear. |
| `migration-log.md` | Bitácora cronológica append-only de etapas del proyecto. |
| `CHANGELOG.md` | Histórico bugs resueltos y limpiezas (retención 90d). |
| `docs/architecture.md` | Estructura JS, EFs, stack, tooling, historial dev. |
| `docs/db-schema.md` | Schemas SQL + RLS + helpers `schedule_match_crons`. |
| `docs/ia-predictor.md` | Motor IA + 4 fuentes datos + mapping WC2026_TEAMS. |
| `docs/live-scoring.md` | Pipeline async+webhook + actores Apify + IDs SofaScore. |
| `docs/scoring-engine.md` | Motor puntuación + estructura torneo + bonus IA. |
| `docs/sync-squads.md` + `docs/globo-mundial.md` + `docs/v3-vs-legacy.md` + `docs/simulacros.md` + `docs/whatsapp.md` + `docs/secrets.md` | Referencias de dominio. |
| `docs/AUDIT_LEGACY_VS_V3.md` | Audit features legacy vs redesign v3 + 9 puntos integración I1-I9. |
| `.claude/rules/*.md` | Reglas path-scoped auto-cargadas al editar áreas específicas (CSS, JS, EFs, sync-squads, multi-agent-sync, apify-actor). |

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
- Vista Jornada (pestaña, tarjetas compactas, sidebar, esqueleto KO bajo grupos + acordeón colapsar/expandir por sección)
- Sistema live scores con actor Webshare (~$13 torneo completo)
- Notificaciones WhatsApp (goles, descanso, fin…)
- Bracket de resultados reales (timeline vertical + live hero)
- Vista Directo con pipeline live realtime (72 tarjetas Mundial + sección **🧪 Simulacros activos** sólo admin para testing con partidos fuera del torneo)
- Usuarios no-admin pueden crear sus propias porras (hasta 3, admin ilimitado) vía EF `create-league`
- Rediseño móvil de fase de grupos (acordeón por grupo + focus layer pantalla completa + carrusel 6 partidos + slide clasificación + botón Guardar/Deshacer con persistencia en BD)
- IA Predictor integrado (Fases A-F cerradas): motor ELO+H2H+form+host, snapshots en BD, 72 predicciones de grupos, tooltip explicativo +1pt bonus vs IA
- Audit Postgres seguridad completo (PR#36-40, 28-29abr2026): RLS, grants, índices FK, CAPTCHA Turnstile
- Globo Mundial 3D (PR#54 + enrichment): cinta + overlay full-screen globe.gl, 48 banderas Supabase, 16 sedes, panel detalle país/sede con bio sport.es + ESPN (WIKI_BIO v3)
- Redesign v3: shell global (fifa-bar + countdown + qualified-cta + stage-pill) + Grupos v3 (`v3GruposMount`) + Eliminatoria v3 (`v3ElimMount` con propagación grupos→KO HF-08..HF-15)
- CLI sync-squads + workflow CI 6h (5 fuentes primarias 2-of-N + FF secundaria XI titular + enrich Transfermarkt). Pizarra Táctica modal alimentada por tabla `squads`
- Sprint Pre-Launch cerrado (20-may-2026): PR#75 F-01..F-10b (11 fixes) + PR#77/#78 hotfix iOS scroll modal grupos (ERR-65/66)

### Antes del 11 de junio de 2026

- [ ] Migrar WhatsApp sandbox → Meta Business producción (error 63016 parked)
- [ ] Activar pg_cron `update-results` el 11 jun
- [ ] Sprint Reglamento FIFA: Art13 head-to-head + Art16 al scoring engine + `v3ComputeStandings`
- [ ] Cobertura sync-squads 38/48 (snapshot oficial FIFA 2-jun)
- [ ] Convocatorias reales `EQUIPOS[].players` + action `update_ia_scorers` de `porra-ia-compute` para rellenar `predictions.scorer`/`ko_predictions.scorer` del bot IA Zayu
- [ ] Email confirmación cierre porra **con copia de pronósticos** (Resend + EF)
- [ ] Verificar JSON `_results.ko_results` con `update-results` real
- [ ] IDs SofaScore de KO (~28 jun, post fase grupos)
- [ ] Auto-completar Pichichi torneo + wiring frases IA pronóstico signo v3

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
