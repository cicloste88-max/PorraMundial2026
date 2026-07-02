# Porra Mundial 2026 — Contexto para Claude Code

App de pronósticos del Mundial 2026. Stack: Vite + vanilla JS/CSS, Supabase, Vercel.
Producción: porramundial2026-seven.vercel.app · Repo: cicloste88-max/PorraMundial2026

## Estado actual

**02-jul** (fase **KO**): bloque KO en vivo (#171/#172). Pipeline ESPN R32 73–88 (`inverted=false`); bridge **v13** escribe `ko_results[slot]` en finished (empate→`winner=null` Fase 1). EF **`ko-winner-sync` v1** + cron jobid 31 (`*/2`, gated) cierran KO-pens leyendo `competitor.winner` ESPN (ERR-100, GER-PAR 3-4). Frontend KO completo + **Dashboard porra** v1. Bracket FIFA → `docs/ko-bracket.md`. Audit salud 02-jul → `docs/sanity-check-02jul2026.md`.

Deploy CLI EF: SIEMPRE `--no-verify-jwt`.

## Top-3 pendientes inmediatos

1. **`get-ko-crosses`** (`docs/ko-bracket.md`): derivar cruces R16+ de la clasificación real. **OJO `teams_swapped` al leer `live_scores` (ERR-99)**.
2. **Cablear `calcClassificationPoints`** antes de la Final (19-jul): definida pero SIN caller (hoy el podio va por `calcKoPodiumPoints`). Ver `docs/scoring-engine.md`.
3. **Sembrar R16+** (3 tablas KO) según resuelva R32; el render KO es round-genérico y los recoge solo.

## Pendientes — Bugs UI

1. Cinta tabs ronda incompleta móvil. 2. Hora CEST píldora `Grupo · Estadio`. 3. Auto-completar Pichichi torneo. 4. Wiring frases IA pronóstico signo. **5. Pizarra apellidos `.fc-pizarra-token-surname` invisibles iPhone real. Causas en `CHANGELOG.md`.**

## Pendientes — Antes del 11 junio 2026

1. WhatsApp sandbox → Meta Business prod (error 63016 — parked).
2. Convocatorias reales `EQUIPOS[].players` + `update_ia_scorers` (`porra-ia-compute`) para `predictions.scorer`/`ko_predictions.scorer` del bot Zayu (NULL en 3 ligas).

## Backlog post-launch / Deuda técnica

1. **HF-BUG-09-bis** — extender `mundial:predictions-changed` al path KO (`diceSimulateAllKO` en `admin.js`, `v3SimulateDice` en `eliminatoria-v3.js`), eliminar `setTimeout(v3RenderBoardGrupos, 100)`. Post-launch.
2. **HF-BUG-13** — refactor `v3SaveGoleadorGrupos:783` (`grupos-v3.js`): `saved=true` solo desde path marcador; goleador respeta `saved=(l!==null && v!==null)`. F1 (PR #69) ya evita el patrón en KO. Post-launch, solo grupos.
3. **PL-3 FIX C** (post-launch, opcional) — columna `squads.xi` (jsonb) fijada en el pin, leída por `extractXI` como XI autoritativo (hoy se deriva de `es_titular`, ya preservado en merge).
4. **Audit Postgres 28abr** (PR#37 cerró 1-5): pendiente leaked password protection (HaveIBeenPwned) en Supabase Auth. Detalle: `docs/db/audit_28abr_section26_rls_planning.md`.
5. **Cleanup `window.currentUser?.id`** (post-11-jun): `data.js` L435 + `ui-groups.js` L807/L830 usan el espejo #139; normalizar a `currentUser` directo. ERR-84.

## Auth & Secrets

Vault/EF + Turnstile DESACTIVADO 30abr2026: ver `docs/secrets.md`.

## Reglas CRÍTICAS

- **NUNCA push a main sin validar en localhost:5173**.
- **Push inmediato tras cada commit**. Tras pull, San reinicia Vite + hard-reload (`.claude/rules/multi-agent-sync.md`).
- **NO tocar `vercel.json`** (wildcard corrompía MIME ES modules — ERR-06).
- **Actualizar `migration-log.md`** tras cada acción importante.
- **Consultar `errores_conocidos_porra.md`** antes de debuggear.
- **`schedule_match_crons(match_key, start_ts)`** para crons de partidos.
- **Orientación fixture swapped** (BRA-ESC `wc2026_gC_15186861`, único `teams_swapped`): `live_scores`=orden-FUENTE, el writer NUNCA pre-orienta (`espn_event_map.inverted=false`); corregir UNA vez aguas abajo (`teams_swapped` puente+front; signo IA `iaSignForCard`). ERR-95/96, `docs/live-scoring.md`.
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
| `scoring-engine.md` | Motor puntuación + estructura torneo + bonus IA + KO | Cambios reglas de puntuación |
| `ko-bracket.md` | Cuadro KO (slots 73–104, feeders, plantilla R32, `resolveBracket`/ANNEX_C), verificado vs FIFA | Cambios de bracket o EF que lo lean |
| `db-schema.md` | Schemas SQL + RLS + helpers `schedule_match_crons` | Cambios en tablas o crons de partidos |
| `whatsapp.md` | Twilio sandbox + notifs + migración Meta | Cambios notificaciones |
| `simulacros.md` | Workflow testing live pre-Mundial | Activar/desactivar simulacros |
| `sanity-check-02jul2026.md` | Audit salud 02-jul: 52 hallazgos + runbook limpieza | Triage deuda técnica / limpieza |
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

ERR-01..100: detalle completo en `errores_conocidos_porra.md`. **Consultar antes de debuggear.** Categorías: JS lifecycle, Vite/CSS, Auth/Secrets, Live scoring, EFs, UI mobile, KO/Globo, Overlay v3, sync-squads, RLS (51,58), HF Pack v3 (52-57), name-matcher (72-75,93-94), competición real (76), name globo (77), auth bootstrap (78), ensamblado EF (79), window scope (80), clip overflow (81), puente P4 (82), cliente RLS (83), currentUser (84), actor lockfile (85), agregado liga RLS (86), forma cache normalizada (87), init latch live-sync (88), anti-bot per-IP (89), jsonb double-encoded (90), fallback param opcional (91), live-scoring KO (95-97/99), scoring KO gate (98), KO winner pens (100).

### Otros ficheros de contexto

- `CHANGELOG.md` — histórico de bugs resueltos y limpiezas (retención 90d, auto-archivado a `CHANGELOG-archive-YYYYMM.md` si supera 30KB).
- `migration-log.md` — cronología append-only de acciones por sesión.
- `docs/AUDIT_LEGACY_VS_V3.md` — audit features legacy vs v3: 15 match-card features + 9 puntos integración I1-I9 + Backlog F3 (HF-08, 5 bloques A-E). NO implementado — ref. F3 wiring.

## End-of-session protocol

1. Actualizar `Estado actual` + top-3 en este `CLAUDE.md` + commit.
2. Bugs resueltos → `CHANGELOG.md` (política retención: ver §Otros ficheros). NO en `CLAUDE.md`.
3. Append `[HH:MM] ACCION: …` a `migration-log.md`.
4. Verificar tamaños con `.githooks/pre-commit` (10KB CLAUDE.md / 30KB CHANGELOG.md).
5. Revisar política retención CHANGELOG el 20 jul 2026 (post-Mundial: revertir a 30d).

## Frase inicio sesión

`Porra Mundial 2026. HEAD actual en main. Fase activa y últimos 3 prioritarios.` → invoca `/start-session`.
