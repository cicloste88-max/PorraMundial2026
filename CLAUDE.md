# Porra Mundial 2026 — Contexto para Claude Code

App de pronósticos del Mundial 2026. Stack: Vite + vanilla JS/CSS, Supabase, Vercel.
Producción: porramundial2026-seven.vercel.app · Repo: github.com/cicloste88-max/PorraMundial2026

## Estado actual

Rama activa **main**, último commit **a24001a**. IA Predictor **Fases A–F cerradas y mergeadas en main** (PR #17 `6b06880` + post-F `fb22648 / 8dd691c / 6e46d2b` + doc sweep `a079fda / a24001a`), paridad Python↔TS verde 46/46, smoke tests verdes. EF `porra-ia-compute` v10 ACTIVE con `breakdown` enriquecido (9 raw-context fields) para los 72 partidos de grupos. Feature `feat/mobile-grupos-focus` LIVE en producción (verificada en iPhone Safari + Chrome móvil).

## Top-3 pendientes inmediatos

Detalle completo de las 13 inversiones priorizadas en `docs/sanity-check-20abr2026.md`. Top-3 críticos:

1. **Tests motor de puntuación** (Vitest, 30 tests de `calc*Points` en `scoring.js`). Sin esto, disputas reales por puntos mal calculados el día de la final.
2. **GitHub Action CI** (build + `node --check` + tests cuando haya). Bloquea regresiones antes de merge.
3. **Code splitting `admin.js`** (dynamic import bajo `is_admin`) — bundle −25%.

## Pendientes — Bugs UI

1. Cinta superior tabs ronda no se visualiza completa en móvil (eliminatorias).
2. Añadir hora CEST a píldora `Grupo · Estadio` en tarjeta de partido (conversión ET→CEST = +6h en jun-jul).
3. Botón simular eliminatorias visible para todos los usuarios (actualmente solo admin).
4. Auto-completar Pichichi torneo sumando goleadores seleccionados en pronósticos.
5. Enganche final frases IA para pronóstico signo partido (lógica incorporada, falta wiring final).

## Pendientes — Antes del 11 junio 2026

1. Migrar WhatsApp sandbox → Meta Business producción (error 63016 — parked).
2. Activar pg_cron `update-results` el 11 jun.
3. Cargar convocatorias reales (`EQUIPOS[].players`).
4. Email confirmación cierre porra (Resend + EF) con copia de pronósticos al usuario.
5. Verificar estructura JSON `_results.ko_results` con `update-results` real (11 jun).
6. IDs SofaScore de KO (disponibles ~28 jun 2026, tras finalizar fase de grupos).

## Reglas CRÍTICAS

- **NUNCA push a main sin validar en localhost:5173 primero**.
- **Push inmediato tras cada commit** — nunca acumular.
- **NO crear ni modificar `vercel.json`** (el wildcard corrompía MIME types de ES modules — ver ERR-06).
- **Actualizar `migration-log.md`** tras cada acción importante.
- **Consultar `errores_conocidos_porra.md`** antes de debuggear.
- **`schedule_match_crons(match_key, start_ts)`** para crons de partidos — nunca duplicar manualmente.
- **Verificación CSS/build obligatoria** tras modificar CSS: `npm run build && grep -l "<selector>" dist/css/*.css`. Si no aparece, abortar merge (ver ERR-22).
- **Subagentes Task con tool Write NO heredan `.claude/rules/`** (GH#23478, caveat E13). Si se delega escritura a un subagente, pasar contexto inline o recuperar Write al padre.
- **Detectar decisiones autónomas** con `git diff --stat HEAD` antes de commit.
- **`dice.js` se mantiene dentro de `admin.js`** (no separar).
- **Badge-with-flag-fallback** es patrón permanente para imágenes de equipo.
- **NO `addEventListener('DOMContentLoaded')`** directo en classic scripts cargados via `loadScript` (ver ERR-01 + `.claude/rules/frontend-js.md`).
- **Actor Azzouzana `VzKtdb1t0Qnc07X8V`** tiene caché CDN — NO usar para datos live.

## Comandos útiles

```bash
npm run dev                                              # localhost:5173
npm run build                                            # genera dist/
git add -A && git commit -m "..." && git push origin main

# Lanzar actor Apify manualmente:
apify call N8vUChlhok5JU3cnL -i '{"eventId":"15832749"}' -t 90
```

Activación one-time del hook pre-commit en clones nuevos: `git config core.hooksPath .githooks`.

## Mapa de la documentación

### `docs/` — referencia por dominio

| Doc | Contenido | Cuándo consultarlo |
|---|---|---|
| `architecture.md` | Estructura JS, EFs, Stack, Secrets, tooling, historial dev | Cambios de organización del repo o tooling |
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

### Errores conocidos — tabla-índice

Detalle completo en `errores_conocidos_porra.md`. Consultar antes de debuggear.

| ERR | Síntoma corto |
|---|---|
| 01 | DOMContentLoaded en classic scripts cargados async |
| 02 | `const` top-level no se expone en `window` |
| 03 | Vite public collision (dev vs prod sirven ficheros distintos) |
| 04 | Whitespace invisible en secrets del Vault |
| 05 | Cadena de fallos SofaScore live scoring (solución arquitectónica) |
| 06 | `vercel.json` wildcard corrompe MIME types de ES modules |
| 07 | `updateCardUI` race condition tras login |
| 08 | 404 masivos en consola por `extractUrl(linear-gradient(...))` |
| 09 | CSS grid-areas roto en Vista Jornada |
| 10 | Header eliminatorias no responsive en móvil |
| 11 | GitHub raw bloqueado por proxy de Claude.ai |
| 12 | Ficheros de persistencia referenciados pero no existentes |
| 13 | `porra-fix-encoding action:inspect` devuelve 404 erróneamente |
| 14 | `checkIsAdmin` async no completa, sección admin-only no renderiza |
| 15 | Sobrescritura de `encrypted_password` en QA es destructiva |
| 16 | Plataforma Supabase rechaza JWT ES256 cuando `verify_jwt=true` |
| 17 | Claude Code no puede borrar ramas remotas (HTTP 403 proxy git) |
| 18 | Vite build no incluye `css/*.css` en `dist/` |
| 19 | `openMobileFocus` dejaba `body.overflow=hidden` colgado en iPhone |
| 20 | `body.style.overflow='hidden'` bloquea scroll persistente en iPhone Safari |
| 21 | `.mobile-focus-layer` dentro de `@media` dejaba layer fantasma |
| 22 | `index.html` `<style>` inline nunca migrados a CSS (causa raíz 18-21) |
| 23 | Flash de welcome al F5 con sesión válida + restore de página |
| 24 | Wikipedia inadecuada como fuente de H2H masivo entre selecciones |
| 25 | 11v11.com devuelve 403 sin los 3 headers obligatorios |
| 26 | `pg_net` no soporta HTTP PUT (bloquea merge PR vía GitHub API) |
| 27 | `supabase-js` no enruta `from("vault.x")` ni `.schema("vault")` |
| 29 | MCP `deploy_edge_function` rompe con payloads >70 KB |

### Otros ficheros de contexto

- `CHANGELOG.md` — histórico de bugs resueltos y limpiezas (retención 90d, auto-archivado a `CHANGELOG-archive-YYYYMM.md` si supera 30KB).
- `migration-log.md` — cronología append-only de acciones por sesión.
- `errores_conocidos_porra.md` — catálogo exhaustivo ERR-01..29 (síntoma/causa/fix/patrón).

## End-of-session protocol

1. Actualizar `Estado actual` y top-3 pendientes en este `CLAUDE.md` + commit.
2. Bugs resueltos durante la sesión → entrada en `CHANGELOG.md` (no en `CLAUDE.md`).
3. Append `[HH:MM] ACCION: descripción — ficheros afectados` a `migration-log.md`.
4. Verificar tamaños pre-commit (hook lo enforza si está activo): `wc -c CLAUDE.md` ≤ 10KB; `wc -c CHANGELOG.md` ≤ 30KB. Si CHANGELOG > 30KB, mover entradas antiguas a `CHANGELOG-archive-YYYYMM.md`.
5. Revisar política retención CHANGELOG el 20 jul 2026 (post-Mundial: revertir a 30d).

## Frase inicio sesión

`Porra Mundial 2026. HEAD actual en main. Fase activa y últimos 3 prioritarios.`

Provoca la respuesta del slash command `/start-session` (ver `.claude/commands/start-session.md`): leer §"Estado actual" + reportar HEAD + fase + top-3 sin pedir confirmación.
