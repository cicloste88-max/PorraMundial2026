# Porra Mundial 2026 — Contexto para Claude Code

App de pronósticos del Mundial 2026. Stack: Vite + vanilla JS/CSS, Supabase, Vercel.
Producción: porramundial2026-seven.vercel.app · Repo: cicloste88-max/PorraMundial2026

## Estado actual

Main HEAD `6e7c966` (PR#125, 01-jun). **Sagas cerradas**: JO Jornada (31-may, PRs #116→#121) + refresh congelado / app blank tras F5 (PR#125, iter3+4 mergeados; iter5 descartado tras QA — culprit falso, `showPage('grupos')` ni se llamaba). Restaurar pantalla tras F5 = feature futuro NO bug (ERR-78). Squads pin XI tras PR#115. Detalle: `CHANGELOG.md`.

## Top-3 pendientes inmediatos

1. **JO-6 ficha lenta** — debug rendimiento ficha jugador (perfil/predictor): identificar bottleneck (query Supabase / render / stats).
2. **PR-1 clasificación liga** — en diseño por San. Tabla pos. por liga con scoring acumulado, refresh tras live updates.
3. **PR-3 ver pronósticos otros** — post-cierre 10-jun: consultar pronósticos resto liga (read-only).

## Pendientes — Bugs UI

1. Cinta tabs ronda incompleta móvil. 2. Hora CEST píldora `Grupo · Estadio`. 3. Auto-completar Pichichi torneo. 4. Wiring frases IA pronóstico signo. **5. Pizarra apellidos `.fc-pizarra-token-surname` invisibles iPhone real (QA Playwright los renderizó). Causas a investigar en `CHANGELOG.md`.**

## Pendientes — Antes del 11 junio 2026

1. WhatsApp sandbox → Meta Business prod (error 63016 — parked).
2. Activar pg_cron `update-results` el 11 jun.
3. Convocatorias reales `EQUIPOS[].players` + action `update_ia_scorers` de `porra-ia-compute` para rellenar `predictions.scorer`/`ko_predictions.scorer` del bot IA Zayu (NULL en 3 ligas).
4. Email confirmación cierre porra (Resend + EF) con copia de pronósticos.
5. Validar JSON `_results.ko_results` con `update-results` real (11 jun).
6. IDs SofaScore de KO (~28 jun 2026, post fase grupos).

## Backlog post-launch / Deuda técnica

1. **HF-BUG-09-bis** — extender `mundial:predictions-changed` al path KO (`diceSimulateAllKO` en `admin.js`, `v3SimulateDice` en `eliminatoria-v3.js`), eliminar `setTimeout(v3RenderBoardGrupos, 100)`. Post-launch.
2. **HF-BUG-13** — refactor `v3SaveGoleadorGrupos:783` (`grupos-v3.js`): `saved=true` solo desde path marcador, path goleador respeta `saved=(l!==null && v!==null)`. Defensa actual queda como red. F1 picker goleador KO (PR #69) YA EVITA replicar este patrón en `v3SaveGoleadorKO`. Post-launch — aplica solo al path grupos.
3. **PL-3 FIX C** (post-launch, opcional) — columna `squads.xi` (jsonb) fijada en el pin, leída por `extractXI` como XI autoritativo (hoy se deriva de `es_titular`, ya preservado en merge).
4. **JO-1a — resolver KO real** (post-27jun): `_joKOSlotLabel`/`_joKOTeamFromSlot` desde `realHome/realAway` + `ko_results`; **NUNCA** `resolvedSlots` (ERR-76).
5. **Reconciliar scoring.js↔`_shared/scoring.mjs`** (ERR-79). Tabla 1:1 a `docs/scoring-engine.md` + tests por suceso. Pdte boost ×2 backend.

## Pendientes — Audit Postgres 28abr (backlog)

Items 1-5 cerrados (PR#37). Pendiente: leaked password protection (HaveIBeenPwned) en Supabase Auth → Policies. Detalle: `docs/db/audit_28abr_section26_rls_planning.md`.

## Auth & Secrets

Vault/EF + Turnstile DESACTIVADO 30abr2026: ver `docs/secrets.md`.

## Reglas CRÍTICAS

- **NUNCA push a main sin validar en localhost:5173**.
- **Push inmediato tras cada commit**. Tras pull, San reinicia Vite + hard-reload (`.claude/rules/multi-agent-sync.md`).
- **NO tocar `vercel.json`** (wildcard corrompía MIME ES modules — ERR-06).
- **Actualizar `migration-log.md`** tras cada acción importante.
- **Consultar `errores_conocidos_porra.md`** antes de debuggear.
- **`schedule_match_crons(match_key, start_ts)`** para crons de partidos.
- **Verificación CSS/build obligatoria**: `npm run build && grep -l "<selector>" dist/css/*.css`. Si no aparece, abortar merge (ERR-22).
- **E13** — Subagentes Task con Write NO heredan `.claude/rules/` (GH#23478). Pasar contexto inline.
- **E14** — Verificación post-fix de overlays/sub-overlays: tras `classList.remove('is-open')`, hacer click programático en OTRO elemento de la página (modal padre, tab adyacente, botón close, backdrop) Y verificar que el handler responde. Single-event tests no capturan el bug de `pointer-events` no gateado (ERR-43). Alternativa: `document.elementFromPoint(window.innerWidth/2, window.innerHeight/2)` post-cierre — debe devolver elemento background, no descendiente del overlay.
- **Detectar decisiones autónomas** con `git diff --stat HEAD` antes de commit.
- **`dice.js` dentro de `admin.js`** (no separar).
- **Badge-with-flag-fallback** patrón permanente para imágenes de equipo.
- **NO `addEventListener('DOMContentLoaded')`** en classic scripts cargados via `loadScript` (ERR-01 + `.claude/rules/frontend-js.md`).
- **Actor Azzouzana `VzKtdb1t0Qnc07X8V`** tiene caché CDN — NO usar para datos live.
- **Migrations RLS idempotentes** — `DROP POLICY IF EXISTS` ANTES de `CREATE POLICY` (db push/reset). Tabla con RLS habilitado SIN policy → queries 0 filas silenciosamente para `authenticated` (ERR-58). Smoke desde JWT authenticated, no service_role.

## Comandos útiles

```bash
npm run dev                                                          # localhost:5173
npm run build                                                        # dist/
npm run sync-squads -- --mode=scrape --refresh-final --verbose       # update squads BD
apify call N8vUChlhok5JU3cnL -i '{"eventId":"15832749"}' -t 90
```

Dispatch manual del sync vía GitHub UI: `Actions → Sync Squads → Run workflow` (4 inputs configurables).

Hook pre-commit one-time en clones nuevos: `git config core.hooksPath .githooks`.

## Mapa de la documentación

### `docs/` — referencia por dominio

| Doc | Contenido | Cuándo consultarlo |
|---|---|---|
| `architecture.md` | Estructura JS, EFs, Stack, tooling, historial dev | Cambios de organización del repo o tooling |
| `secrets.md` | Vault, EF secrets, Cloudflare Turnstile, rotación | Cambios en credenciales o auth |
| `ia-predictor.md` | Fórmula motor + 4 fuentes datos + mapping WC2026_TEAMS | Cambios IA Predictor o scrapers |
| `live-scoring.md` | Pipeline async+webhook + actores Apify + SofaScore IDs | Bugs en live scores o nuevos eventIds |
| `scoring-engine.md` | Motor puntuación + estructura torneo + bonus IA | Cambios reglas de puntuación |
| `db-schema.md` | Schemas SQL + RLS + helpers `schedule_match_crons` | Cambios en tablas o crons de partidos |
| `whatsapp.md` | Twilio sandbox + notifs + migración Meta | Cambios notificaciones |
| `simulacros.md` | Workflow testing live pre-Mundial | Activar/desactivar simulacros |
| `sanity-check-20abr2026.md` | Deuda técnica priorizada 8 semanas | Decidir qué invertir antes del 11 jun |
| `globo-mundial.md` | Globo 3D — factory globe.gl, OVERRIDE/ALIAS, polygonsData re-render, panel detalle, banderas Supabase, WIKI_BIO v3 | Cambios en globo o países |
| `sync-squads.md` | CLI scripts/sync-squads.mjs + workflow CI: modos, pipeline FF/TM, calendario operativo, casos especiales | Cambios en sync de plantillas o frecuencia cron |
| `v3-vs-legacy.md` | Inventario funcionalidades v3 vs legacy + reminiscencias + gaps + roadmap consolidación estética | Audit redesign v3 / decidir recolocación de features |

### `.claude/rules/` — auto-cargadas por path-scoping

| Rule | Globs | Cubre |
|---|---|---|
| `edge-functions.md` | `supabase/functions/**` | verify_jwt, deploy CLI vs MCP, secrets, RPC vault |
| `frontend-css.md` | `**/*.css`, `public/css/**` | Vite public, verificación post-build, migración inline |
| `frontend-js.md` | `public/js/**`, `js/main-entry.js` | DOMContentLoaded, var/const, shims, badge-fallback |
| `apify-actor.md` | `apify-actors/**` | Contrato I/O, push, eventId discovery, Cloudflare 403 |
| `multi-agent-sync.md` | `index.html`, `public/**`, `js/**`, `docs/**`, `supabase/**`, `apify-actors/**`, `.claude/rules/**`, `CLAUDE.md`, `migration-log.md` | Sync Code↔San: push inmediato, reinicio Vite tras pull, detección desincronía, switch branch limpio, post-squash cleanup |
| `sync-squads.md` | `scripts/sync-squads*`, `scripts/lib/**`, `.github/workflows/sync-squads.yml` | `--refresh-final` semántica, añadir país, TM IDs, fuentes nuevas, cron schedule, decode in-flight |

### Errores conocidos

ERR-01..79: detalle completo en `errores_conocidos_porra.md`. **Consultar antes de debuggear.** Categorías: JS lifecycle, Vite/CSS, Auth/Secrets, Live scoring, EFs, UI mobile, KO/Globo, Overlay v3, sync-squads, RLS (51,58), HF Pack v3 (52-57), name-matcher (72-75), competición real (76), name globo (77), auth bootstrap (78), mapeo BD→motor (79).

### Otros ficheros de contexto

- `CHANGELOG.md` — histórico de bugs resueltos y limpiezas (retención 90d, auto-archivado a `CHANGELOG-archive-YYYYMM.md` si supera 30KB).
- `migration-log.md` — cronología append-only de acciones por sesión.
- `errores_conocidos_porra.md` — catálogo exhaustivo ERR-01..50 (síntoma/causa/fix/patrón).
- `docs/AUDIT_LEGACY_VS_V3.md` — audit features legacy vs redesign v3: 15 match-card features (IA tooltip, CEST, Pizarra long-press, EN VIVO, stadium, boost, awards, etc.) + **9 puntos integración v3↔legacy I1-I9** (routing, scope shell, state global, cierre porra, EN VIVO, IA wiring, Boost UX, Pizarra entry, CSS cascada) + **Backlog F3** con HF-08 detallado 5 bloques A-E. Generado F2.8.2, ampliado F2.9 HF-cierre (15 may). NO implementado — referencia para F3 wiring.

## End-of-session protocol

1. Actualizar `Estado actual` + top-3 en este `CLAUDE.md` + commit.
2. Bugs resueltos → `CHANGELOG.md` (90d, auto-archive a `CHANGELOG-archive-YYYYMM.md` si >30KB). NO en `CLAUDE.md`.
3. Append `[HH:MM] ACCION: …` a `migration-log.md`.
4. Verificar tamaños con `.githooks/pre-commit` (10KB CLAUDE.md / 30KB CHANGELOG.md; activar one-time con `git config core.hooksPath .githooks`).
5. Revisar política retención CHANGELOG el 20 jul 2026 (post-Mundial: revertir a 30d).

## Frase inicio sesión

`Porra Mundial 2026. HEAD actual en main. Fase activa y últimos 3 prioritarios.` → invoca `/start-session`.
