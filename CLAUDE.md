# Porra Mundial 2026 — Contexto para Claude Code

App de pronósticos del Mundial 2026. Stack: Vite + vanilla JS/CSS, Supabase, Vercel.
Producción: porramundial2026-seven.vercel.app · Repo: cicloste88-max/PorraMundial2026

## Estado actual

Main HEAD `6f04b85`. **09-jun — Saneamiento Supabase**: incidente Disk IO 8-jun 21:50 UTC (restart San 22:41) → 8 migraciones M1-M8 (RLS/índices/grants/search_path) + healthcheck H1-H7 + cron 27 `purge_http_response`. Advisor Perf 5→0 WARN · Sec 4→3 ERROR. **Crones 20-26 PAUSADOS, reactivar (top-3)**. ERR-85; doc `db/saneamiento-supabase-09jun2026.md`. **08-jun**: #140 ko-card-polish + boost #137/#138/#139 (ERR-83/84). **02-jun — P4 puente**: `porra-bridge-results` v4 + `get-league-standings` v1.2.0 (ERR-82). `update-results` indep. 11-jun.

## Top-3 pendientes inmediatos

1. **Reactivar crones Mundial PAUSADOS** — 26 cierre porras 10-jun 21:59 UTC · 21/22 IA 11-jun 00:00/00:10 · 24/25 live+puente + 20 cleanup 11-jun ~16:00 UTC. `cron.alter_job(id,active:=true)`. Doc §7.
2. **Activar pg_cron `update-results` (11-jun)** — football-data.org→`results`, INDEPENDIENTE del puente (ya cerrado).
3. **JO-6 ficha lenta** + **QA picker premios** (10-jun display-only) + **PR-3 ver pronósticos** (read-only post-cierre).

## Pendientes — Bugs UI

1. Cinta tabs ronda incompleta móvil. 2. Hora CEST píldora `Grupo · Estadio`. 3. Auto-completar Pichichi torneo. 4. Wiring frases IA pronóstico signo. **5. Pizarra apellidos `.fc-pizarra-token-surname` invisibles iPhone real. Causas en `CHANGELOG.md`.**

## Pendientes — Antes del 11 junio 2026

1. WhatsApp sandbox → Meta Business prod (error 63016 — parked).
2. Convocatorias reales `EQUIPOS[].players` + `update_ia_scorers` (`porra-ia-compute`) para `predictions.scorer`/`ko_predictions.scorer` del bot Zayu (NULL en 3 ligas).
3. Validar JSON `_results.ko_results` con `update-results` real (11 jun).
4. IDs SofaScore KO (~28-jun, post grupos).

## Backlog post-launch / Deuda técnica

1. **HF-BUG-09-bis** — extender `mundial:predictions-changed` al path KO (`diceSimulateAllKO` en `admin.js`, `v3SimulateDice` en `eliminatoria-v3.js`), eliminar `setTimeout(v3RenderBoardGrupos, 100)`. Post-launch.
2. **HF-BUG-13** — refactor `v3SaveGoleadorGrupos:783` (`grupos-v3.js`): `saved=true` solo desde path marcador, path goleador respeta `saved=(l!==null && v!==null)`. Defensa actual queda como red. F1 picker goleador KO (PR #69) YA EVITA replicar este patrón en `v3SaveGoleadorKO`. Post-launch — aplica solo al path grupos.
3. **PL-3 FIX C** (post-launch, opcional) — columna `squads.xi` (jsonb) fijada en el pin, leída por `extractXI` como XI autoritativo (hoy se deriva de `es_titular`, ya preservado en merge).
4. **JO-1a — resolver KO real** (post-27jun): `_joKOSlotLabel`/`_joKOTeamFromSlot` desde `realHome/realAway` + `ko_results`; **NUNCA** `resolvedSlots` (ERR-76).
5. **ERR-79 residual**: **boost ×2 KO backend** + tabla canónica a `docs/scoring-engine.md` (motor OK; v1.1.0 cerrado).
6. **Hardening Supabase** (post-saneamiento 09-jun): leaked-pwd, `unaccent`→schema, 3 views DEFINER, fan-out UPSERTs. Ver `docs/db/saneamiento-supabase-09jun2026.md` §8.
7. **Cleanup `window.currentUser?.id`** (post-11-jun): `data.js` L435 + `ui-groups.js` L807/L830 usan el espejo #139; normalizar a `currentUser` directo. ERR-84.

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
| `db/saneamiento-supabase-09jun2026.md` | Incidente Disk IO + 8 migraciones RLS/grants + advisors + crones + monitoring | Saturación BD, reactivar crones, audit seguridad |
| `whatsapp.md` | Twilio sandbox + notifs + migración Meta | Cambios notificaciones |
| `simulacros.md` | Workflow testing live pre-Mundial | Activar/desactivar simulacros |
| `sanity-check-20abr2026.md` | Deuda técnica priorizada 8 semanas | Decidir qué invertir antes del 11 jun |
| `globo-mundial.md` | Globo 3D — globe.gl, OVERRIDE/ALIAS, re-render polygonsData, panel, banderas, WIKI_BIO v3 | Cambios en globo o países |
| `sync-squads.md` | CLI sync-squads.mjs + workflow CI: modos, pipeline FF/TM, calendario, casos especiales | Cambios en sync de plantillas o cron |
| `v3-vs-legacy.md` | Inventario v3 vs legacy + reminiscencias + gaps + roadmap estética | Audit redesign v3 / recolocación features |

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

ERR-01..85: detalle completo en `errores_conocidos_porra.md`. **Consultar antes de debuggear.** Categorías: JS lifecycle, Vite/CSS, Auth/Secrets, Live scoring, EFs, UI mobile, KO/Globo, Overlay v3, sync-squads, RLS (51,58), HF Pack v3 (52-57), name-matcher (72-75), competición real (76), name globo (77), auth bootstrap (78), ensamblado EF (79), window scope (80), clip overflow (81), puente P4 (82), cliente RLS (83), currentUser (84), IO/saturación BD (85).

### Otros ficheros de contexto

- `CHANGELOG.md` — histórico de bugs resueltos y limpiezas (retención 90d, auto-archivado a `CHANGELOG-archive-YYYYMM.md` si supera 30KB).
- `migration-log.md` — cronología append-only de acciones por sesión.
- `errores_conocidos_porra.md` — catálogo exhaustivo ERR-01..85 (síntoma/causa/fix/patrón).
- `docs/AUDIT_LEGACY_VS_V3.md` — audit features legacy vs v3: 15 match-card features + 9 puntos integración I1-I9 + Backlog F3 (HF-08, 5 bloques A-E). NO implementado — ref. F3 wiring.

## End-of-session protocol

1. Actualizar `Estado actual` + top-3 en este `CLAUDE.md` + commit.
2. Bugs resueltos → `CHANGELOG.md` (90d, auto-archive a `CHANGELOG-archive-YYYYMM.md` si >30KB). NO en `CLAUDE.md`.
3. Append `[HH:MM] ACCION: …` a `migration-log.md`.
4. Verificar tamaños con `.githooks/pre-commit` (10KB CLAUDE.md / 30KB CHANGELOG.md; activar one-time con `git config core.hooksPath .githooks`).
5. Revisar política retención CHANGELOG el 20 jul 2026 (post-Mundial: revertir a 30d).

## Frase inicio sesión

`Porra Mundial 2026. HEAD actual en main. Fase activa y últimos 3 prioritarios.` → invoca `/start-session`.
