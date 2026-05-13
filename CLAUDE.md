# Porra Mundial 2026 — Contexto para Claude Code

App de pronósticos del Mundial 2026. Stack: Vite + vanilla JS/CSS, Supabase, Vercel.
Producción: porramundial2026-seven.vercel.app · Repo: cicloste88-max/PorraMundial2026

## Estado actual

Rama **`claude/port-world-cup-design-FvZpD`** HEAD `5b87645` — **redesign v3 base estable** Grupos cerrado visualmente por San (14 may). Modal 3 tabs (Marcadores / Goleadores / Clasificación), chips puntuación 3 estados, goleador picker unificado (1 pick por partido, sub-overlay con secciones home+away). 4 colisiones namespace resueltas en serie (trophy-col display, @keyframes trophy-float, .v3-zoom-panel skeleton, function declarations grupos↔elim). **ERR-43** nuevo (pointer-events gating en sub-overlays). **NO mergeado a main** — F3 wiring SPA pendiente. Rama paralela `sync/ef-get-squad-v6` (squads 7/48, runtime EF `get-squad` v6) sigue abierta. Próximo: F2.9 smoke Eliminatoria + F3 wiring SPA + audit cards legacy → v3 (`docs/AUDIT_CARDS_LEGACY_VS_V3.md`).

## Top-3 pendientes inmediatos

1. **Boost UX en v3**: defaults ×2 / FIFA-calendar / lock-1er-partido. Legacy `ui-groups.js` lo tenía via `boostPicks` + `boost-ticker`. Sin esto el día-boost no funciona en redesign.
2. **Integración IA Predictor + Bot Zayu en v3**: tooltip IA contraria + frase IA + `iaBonusWillApply` wiring en cards modal. Legacy lo tenía, redesign aún no.
3. **Audit cards-de-partido legacy vs v3**: deliverable `docs/AUDIT_CARDS_LEGACY_VS_V3.md` lista features no portadas (tooltip IA, CEST pill, Pizarra long-press, EN VIVO indicator, stadium info, award badges, etc.). NO implementar — solo documentar antes de F3.

## Pendientes — Bugs UI

1. Cinta tabs ronda incompleta móvil. 2. Hora CEST en píldora `Grupo · Estadio`. 3. Auto-completar Pichichi torneo. 4. Wiring frases IA para pronóstico signo. Detalle: Top-3 #3 + `CHANGELOG.md`.

## Pendientes — Antes del 11 junio 2026

1. WhatsApp sandbox → Meta Business prod (error 63016 — parked).
2. Activar pg_cron `update-results` el 11 jun.
3. Convocatorias reales `EQUIPOS[].players` + action `update_ia_scorers` de `porra-ia-compute` para rellenar `predictions.scorer`/`ko_predictions.scorer` del bot IA Zayu (NULL en 3 ligas).
4. Email confirmación cierre porra (Resend + EF) con copia de pronósticos.
5. Validar JSON `_results.ko_results` con `update-results` real (11 jun).
6. IDs SofaScore de KO (~28 jun 2026, post fase grupos).

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

## Comandos útiles

```bash
npm run dev    # localhost:5173
npm run build  # dist/
apify call N8vUChlhok5JU3cnL -i '{"eventId":"15832749"}' -t 90
```

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

### `.claude/rules/` — auto-cargadas por path-scoping

| Rule | Globs | Cubre |
|---|---|---|
| `edge-functions.md` | `supabase/functions/**` | verify_jwt, deploy CLI vs MCP, secrets, RPC vault |
| `frontend-css.md` | `**/*.css`, `public/css/**` | Vite public, verificación post-build, migración inline |
| `frontend-js.md` | `public/js/**`, `js/main-entry.js` | DOMContentLoaded, var/const, shims, badge-fallback |
| `apify-actor.md` | `apify-actors/**` | Contrato I/O, push, eventId discovery, Cloudflare 403 |
| `multi-agent-sync.md` | `index.html`, `public/**`, `js/**`, `docs/**`, `supabase/**`, `apify-actors/**`, `.claude/rules/**`, `CLAUDE.md`, `migration-log.md` | Sync Code↔San: push inmediato, reinicio Vite tras pull, detección desincronía, switch branch limpio, post-squash cleanup |

### Errores conocidos

ERR-01..43: detalle completo (síntoma/causa/fix/patrón) en `errores_conocidos_porra.md`. **Consultar antes de debuggear.** Categorías: JS lifecycle (01-02), Vite/CSS (03,06,18-22), Auth/Secrets (04,07,11-17,23-28,33), Live scoring (05,29), Edge functions (33-34), UI mobile (08-10,19-21,30-32,35-41), KO/Globo (38,42), Overlay v3 (43).

### Otros ficheros de contexto

- `CHANGELOG.md` — histórico de bugs resueltos y limpiezas (retención 90d, auto-archivado a `CHANGELOG-archive-YYYYMM.md` si supera 30KB).
- `migration-log.md` — cronología append-only de acciones por sesión.
- `errores_conocidos_porra.md` — catálogo exhaustivo ERR-01..43 (síntoma/causa/fix/patrón).
- `docs/AUDIT_CARDS_LEGACY_VS_V3.md` — audit features match-card legacy vs redesign v3 (tooltip IA, CEST, Pizarra long-press, EN VIVO, stadium, boost, award badges, etc.). Generado F2.8.2 cierre. NO implementado — referencia para F3 wiring.

## End-of-session protocol

1. Actualizar `Estado actual` + top-3 en este `CLAUDE.md` + commit.
2. Bugs resueltos → `CHANGELOG.md` (90d, auto-archive a `CHANGELOG-archive-YYYYMM.md` si >30KB). NO en `CLAUDE.md`.
3. Append `[HH:MM] ACCION: …` a `migration-log.md`.
4. Verificar tamaños con `.githooks/pre-commit` (10KB CLAUDE.md / 30KB CHANGELOG.md; activar one-time con `git config core.hooksPath .githooks`).
5. Revisar política retención CHANGELOG el 20 jul 2026 (post-Mundial: revertir a 30d).

## Frase inicio sesión

`Porra Mundial 2026. HEAD actual en main. Fase activa y últimos 3 prioritarios.` → invoca `/start-session`.
