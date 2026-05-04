# Porra Mundial 2026 — Contexto para Claude Code

App de pronósticos del Mundial 2026. Stack: Vite + vanilla JS/CSS, Supabase, Vercel.
Producción: porramundial2026-seven.vercel.app · Repo: github.com/cicloste88-max/PorraMundial2026

## Estado actual

Rama activa **main** HEAD `4fb8394` (post slim secrets, PR#47). En curso PR F7.7-IA C1+C2 — bot **IA Zayu** activo en 3 ligas (72 group + 32 KO + awards + groups_saved A-L lock), trigger DB replicate_bot_to_league + EF `porra-ia-compute` **v11** ACTIVE (SHA `af0f24a8`). Detalle en `CHANGELOG.md`. Próximo: cargar squads reales + ejecutar `update_ia_scorers` para rellenar `predictions.scorer`/`ko_predictions.scorer` (NULL en todas las ligas).

## Top-3 pendientes inmediatos

Detalle completo de las 13 inversiones priorizadas en `docs/sanity-check-20abr2026.md`. Top-3 críticos:

1. **Backend pre-11jun core**: WhatsApp Meta migration (ticket 63016) + activar pg_cron `update-results` el 11 jun + cargar squads reales en `EQUIPOS[].players`. Sin esto la app no funciona el día del Mundial.
2. **F7.7-IA**: bot oficial IA-jugador C1..C6 (sim 10 jun, miembro auto todas las ligas vía trigger, EF `porra-ia-compute` v11 con KO+awards+boost). Cierra la decisión #4 del Predictor.
3. **Tests motor de puntuación** (Vitest, 30 tests de `calc*Points` en `scoring.js`). Sin esto, disputas reales por puntos mal calculados el día de la final.

## Pendientes — Bugs UI

1. Cinta superior tabs ronda no se visualiza completa en móvil (eliminatorias).
2. Añadir hora CEST a píldora `Grupo · Estadio` en tarjeta de partido (conversión ET→CEST = +6h en jun-jul).
3. Auto-completar Pichichi torneo sumando goleadores seleccionados en pronósticos.
4. Enganche final frases IA para pronóstico signo partido (lógica incorporada, falta wiring final).

## Pendientes — Antes del 11 junio 2026

1. Migrar WhatsApp sandbox → Meta Business producción (error 63016 — parked).
2. Activar pg_cron `update-results` el 11 jun.
3. Cargar convocatorias reales (`EQUIPOS[].players`) y luego ejecutar action `update_ia_scorers` de `porra-ia-compute` para rellenar `predictions.scorer`/`ko_predictions.scorer` del bot IA Zayu (actualmente NULL en las 3 ligas).
4. Email confirmación cierre porra (Resend + EF) con copia de pronósticos al usuario.
5. Verificar estructura JSON `_results.ko_results` con `update-results` real (11 jun).
6. IDs SofaScore de KO (disponibles ~28 jun 2026, tras finalizar fase de grupos).

## Pendientes — Audit Postgres 28abr (backlog)

Items 1-5 cerrados (PR#37). Pendiente: activar leaked password protection (HaveIBeenPwned) en Supabase → Authentication → Policies (1 click San). Detalle en `docs/db/audit_28abr_section26_rls_planning.md`.

## Auth & Secrets

Detalle Vault/EF + Turnstile DESACTIVADO 30abr2026 en `docs/secrets.md`.

## Reglas CRÍTICAS

- **NUNCA push a main sin validar en localhost:5173 primero**.
- **Push inmediato tras cada commit** — nunca acumular. Tras pull, San reinicia Vite + hard-reload (ver `.claude/rules/multi-agent-sync.md`).
- **NO crear ni modificar `vercel.json`** (el wildcard corrompía MIME types de ES modules — ver ERR-06).
- **Actualizar `migration-log.md`** tras cada acción importante.
- **Consultar `errores_conocidos_porra.md`** antes de debuggear.
- **`schedule_match_crons(match_key, start_ts)`** para crons de partidos — nunca duplicar manualmente.
- **Verificación CSS/build obligatoria** tras modificar CSS: `npm run build && grep -l "<selector>" dist/css/*.css`. Si no aparece, abortar merge (ver ERR-22).
- **E13 — Subagentes Task con Write NO heredan `.claude/rules/`** (GH#23478). Pasar contexto inline o recuperar Write al padre.
- **Detectar decisiones autónomas** con `git diff --stat HEAD` antes de commit.
- **`dice.js` se mantiene dentro de `admin.js`** (no separar).
- **Badge-with-flag-fallback** es patrón permanente para imágenes de equipo.
- **NO `addEventListener('DOMContentLoaded')`** directo en classic scripts cargados via `loadScript` (ver ERR-01 + `.claude/rules/frontend-js.md`).
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

### `.claude/rules/` — auto-cargadas por path-scoping

| Rule | Globs | Cubre |
|---|---|---|
| `edge-functions.md` | `supabase/functions/**` | verify_jwt, deploy CLI vs MCP, secrets, RPC vault |
| `frontend-css.md` | `**/*.css`, `public/css/**` | Vite public, verificación post-build, migración inline |
| `frontend-js.md` | `public/js/**`, `js/main-entry.js` | DOMContentLoaded, var/const, shims, badge-fallback |
| `apify-actor.md` | `apify-actors/**` | Contrato I/O, push, eventId discovery, Cloudflare 403 |
| `multi-agent-sync.md` | `index.html`, `public/**`, `js/**`, `docs/**`, `supabase/**`, `apify-actors/**`, `.claude/rules/**`, `CLAUDE.md`, `migration-log.md` | Sync Code↔San: push inmediato, reinicio Vite tras pull, detección desincronía, switch branch limpio, post-squash cleanup |

### Errores conocidos — tabla-índice

Detalle completo en `errores_conocidos_porra.md`. Consultar antes de debuggear.

| ID | Título |
|----|--------|
| ERR-01 | DOMContentLoaded en classic scripts cargados async |
| ERR-02 | `const` top-level no se expone en `window` |
| ERR-03 | Vite public collision (dev vs prod sirven ficheros distintos) |
| ERR-04 | Whitespace invisible en secrets del Vault |
| ERR-05 | Cadena de fallos SofaScore live scoring (solución arquitectónica) |
| ERR-06 | `vercel.json` wildcard corrompe MIME types de ES modules |
| ERR-07 | `updateCardUI` race condition tras login |
| ERR-08 | 404 masivos en consola por `extractUrl(linear-gradient(...))` |
| ERR-09 | CSS grid-areas roto en Vista Jornada |
| ERR-10 | Header eliminatorias no responsive en móvil |
| ERR-11 | GitHub raw bloqueado por proxy de Claude.ai |
| ERR-12 | Ficheros de persistencia referenciados pero no existentes |
| ERR-13 | `porra-fix-encoding action:inspect` devuelve 404 erróneamente |
| ERR-14 | `checkIsAdmin` async no completa, sección admin-only no renderiza |
| ERR-15 | Sobrescritura de `encrypted_password` en QA es destructiva |
| ERR-16 | Plataforma Supabase rechaza JWT ES256 cuando `verify_jwt=true` |
| ERR-17 | Claude Code no puede borrar ramas remotas (HTTP 403 proxy git) |
| ERR-18 | Vite build no incluye `css/*.css` en `dist/` |
| ERR-19 | `openMobileFocus` dejaba `body.overflow=hidden` colgado en iPhone |
| ERR-20 | `body.style.overflow='hidden'` bloquea scroll persistente en iPhone Safari |
| ERR-21 | `.mobile-focus-layer` dentro de `@media` dejaba layer fantasma |
| ERR-22 | `index.html` `<style>` inline nunca migrados a CSS (causa raíz 18-21) |
| ERR-23 | Flash de welcome al F5 con sesión válida + restore de página |
| ERR-24 | Wikipedia inadecuada como fuente de H2H masivo entre selecciones |
| ERR-25 | 11v11.com devuelve 403 sin los 3 headers obligatorios |
| ERR-26 | `pg_net` no soporta HTTP PUT (bloquea merge PR vía GitHub API) |
| ERR-27 | `supabase-js` no enruta `from("vault.x")` ni `.schema("vault")` |
| ERR-28 | RLS `ia_snapshots` requiere policy `ia_snapshots_public_read_active` |
| ERR-29 | MCP `deploy_edge_function` rompe con payloads >70 KB |
| ERR-30 | `mobile-locked` persiste tras Deshacer (✅ PR#32) |
| ERR-31 | `btnRow` residual tras Deshacer (cosmético, pendiente) |
| ERR-32 | Boost check desincronizado con `boostPicks` en focus mobile (✅ PR#33) |
| ERR-33 | `REVOKE FROM PUBLIC` en función usada por RLS rompe `authenticated` |

### Otros ficheros de contexto

- `CHANGELOG.md` — histórico de bugs resueltos y limpiezas (retención 90d, auto-archivado a `CHANGELOG-archive-YYYYMM.md` si supera 30KB).
- `migration-log.md` — cronología append-only de acciones por sesión.
- `errores_conocidos_porra.md` — catálogo exhaustivo ERR-01..33 (síntoma/causa/fix/patrón).

## End-of-session protocol

1. Actualizar `Estado actual` + top-3 en este `CLAUDE.md` + commit.
2. Bugs resueltos → `CHANGELOG.md` (90d, auto-archive a `CHANGELOG-archive-YYYYMM.md` si >30KB). NO en `CLAUDE.md`.
3. Append `[HH:MM] ACCION: …` a `migration-log.md`.
4. Verificar tamaños con `.githooks/pre-commit` (10KB CLAUDE.md / 30KB CHANGELOG.md; activar one-time con `git config core.hooksPath .githooks`).
5. Revisar política retención CHANGELOG el 20 jul 2026 (post-Mundial: revertir a 30d).

## Frase inicio sesión

`Porra Mundial 2026. HEAD actual en main. Fase activa y últimos 3 prioritarios.` → invoca `/start-session`.
