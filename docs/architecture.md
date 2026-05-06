# Arquitectura — Porra Mundial 2026

## Estructura de ficheros JS

```
js/
  main-entry.js       entry point Vite (type=module)

public/js/
  data.js              datos torneo, estado global, boostPicks, PHRASES_GRUPO
  scoring.js           motor puntos, tarjetas, premios
  ui-groups.js         grupos, vista Jornada completa
  ui-groups-mobile.js  rediseño móvil fase grupos (acordeón, focus layer, slide 7)
  ko.js                bracket KO, IA pronósticos
  ui-nav.js            SPA nav, modal, welcome
  ui-directo.js        vista Directo, sección simulacros admin
  live-sync.js         realtime live_scores (postgres_changes, simulacros)
  auth.js              auth Supabase, bootstrap (predictions/ko/awards/groups_saved)
  leagues.js           ligas, selección de porra
  misc.js              utils UI
  scoreboard.js        clasificación multi-usuario
  close-porra.js       cierre de pronósticos
  admin.js             panel admin, dados, simulador (dice.js integrado)
  bracket-results.js   vista resultados reales bracket KO

public/css/
  base.css             reset, layout, match-cards, header, ligas, rediseño móvil @media 640px
  welcome.css
  ko.css               bracket KO, modal, awards
  admin.css            panel admin, dado, responsive
  boost.css
  bracket-results.css
  directo.css          vista Directo, tarjetas simulacro admin
```

Regla crítica: todo asset servido bajo `/xxx` debe vivir en `public/xxx/` o importarse desde el bundle JS. Vite ignora archivos en raíz del repo durante build (ver ERR-18).

## Cadena de carga

El bundle de Vite resuelve dependencias en orden:

```
misc.js (paralelo)
  ↓
leagues → data → scoring → ui-groups → ui-groups-mobile → ko → bracket-results
  ↓
ui-nav → auth → scoreboard → close-porra → admin → ui-directo → live-sync
```

Cada módulo exporta funciones que se ejecutan o se registran como event listeners. `auth.js` inicializa la sesión y carga predicciones, resultados KO, premios y grupos guardados desde la DB.

## Pantallas y patrones de carrusel

### Fase Final (#page-elim) — patrón de referencia

Página top-level (NO envuelta en `.container` legacy). Estructura:

```
#page-elim
  .fc-elim-header
  .fc-elim-stepper           pills 6 fases (grupos/16/8/4/3/F)
  .fc-elim-list { padding: 0 12px 80px }
    .fc-elim-row             header colapsable de cada fase
    .fc-elim-expanded        SIBLING insertado tras click
      .fc-elim-carousel
        .fc-elim-carousel__slide × N    width 86vw, max-width 360px
                                        scroll-snap-align:center
                                        :not(.is-current) → scale .92 opacity .55
        .fc-elim-dots / .fc-elim-arrow
```

Click en `.fc-elim-row` inserta `.fc-elim-expanded` como hermano (no anidado) → carousel container ~347px → slot 86vw cabe holgado.

### Grupos (#page-grupos) — réplica del patrón Fase Final post-Sprint B

Página anidada en `<div class="container">` (legacy wrapper); requiere override `#page-grupos > .container { padding: 0 }` para neutralizar 40px lateral (ver ERR-36). Estructura:

```
#page-grupos > .container (override)
  #grupos-letter-bar
    .fc-grupos-stepper-wrap (sticky)
      .fc-elim-stepper.fc-grupos-stepper      reusa CSS de Fase Final
        .fc-elim-stepper__item × 12 (A-L)
  #groups-container { padding: 0 12px 80px }
    .fc-grupos-card                            header colapsable
      .collap-toggle (barra estado + GRUPO X + 4 banderas + dado + N/6 + chev)
      .fc-grupos-card__source                  HIDDEN (display:none)
        #grid-{letra}                           tarjetas editables (source)
        #gtable-{letra}                         tabla clasificación (source)
    .fc-grupos-expanded                        SIBLING tras click
      .fc-grupos-carousel-wrap
        .fc-grupos-carousel { padding: 4px 5vw }
          .fc-grupos-slot--match × 6           compact .ko-card replicada
          .fc-grupos-slot--standings           gtable MOVIDO aquí on-open
        .fc-grupos-carousel__dots / __arrows
```

**`_toggleGruposExpanded(letra, sectionEl)`** maneja el toggle: cierra cualquier expanded actual (restituye gtable a su source), construye carousel via `_renderGruposCarousel(letra, partidos, gtable)`, lo envuelve en `<section class="fc-grupos-expanded">` e inserta como sibling via `parentNode.insertBefore(expanded, sectionEl.nextSibling)`.

**Compact card** (`_renderGruposCompactCard`) replica `.ko-card` de Fase Final exactamente (mismas clases `.ko-hero`/`.ko-team`/`.ko-vs-circle`/`.ko-pill`/`.ko-footer`) + body section adicional `.ko-body--saved` (TU PRONÓSTICO + marcador grande + goleador) o `.ko-body--empty` (CTA dorado). Click → `openJcardModal(matchKey, {editable: true})`.

### Modal editable Grupos — MOVE-original con navegación

`openJcardModal(matchKey, opts)` → `_showJcardModal(matchKey, opts)` con dos paths:

- **`opts.editable = false`** (default, Jornada `Ver tarjeta`): clone + disable inputs (read-only).
- **`opts.editable = true`** (Grupos compact click): MOVE el `cardEl` original al wrapper del modal preservando `originalParent`/`originalNextSibling`/`originalStyleAttr`. Listeners de `attachEvents` (boost, save, IA, ▲▼ marcador, dropdown goleador) quedan vivos en el Element. Al cerrar/navegar, `_restoreCurrent()` restituye style attr + posición exacta + dispatch `CustomEvent('jcard:updated', {detail:{matchKey}})`.

Si la lista del grupo (`PARTIDOS.filter(group=letra)`) tiene >1 partido, se renderiza nav header sticky con flechas ‹ › + counter `idx/N` que permite navegar entre partidos del mismo grupo sin cerrar el modal. Cada navegación restituye el actual y mueve el siguiente, manteniendo edición funcional en cada paso.

Listener `jcard:updated` registrado una vez (guard `window._jcardUpdatedListenerRegistered`) refresca:
1. Compact preview en `.fc-grupos-carousel .ko-card[data-match-key=...]` via `replaceWith(_renderGruposCompactCard(match))`.
2. Letterbar chip count via `_refreshGruposLetterBar()`.
3. Standings table via `renderGroupTableCard(match.group)`.
4. Card colapsable header (bar color + N/6) actualizados in-place sin rebuild.

### Globo de selecciones (cinta + overlay 3D + panel detalle)

Cinta dorada en `#page-grupos` (montada como sibling de `#dice-global-bar` vía `_ensureGloboCintaMount` en `ui-groups.js`) → click abre overlay full-screen `#fc-globo-overlay` con globo 3D `globe.gl@2.33.0` (lazy-loaded). Carrusel de 48 banderas circulares Supabase con separadores A→L, segunda fila con chips de las 16 sedes, leyenda de tipos (clasificados/sedes) en lateral derecho. Click bandera o polígono → highlight rojo del país + panel detalle (apodo + pill formación + frase + bio sport.es + bio_espn ESPN). Click chip o punto → highlight 3D rojo elevado + panel detalle sede.

Detalle completo: `docs/globo-mundial.md`. ERR relacionados: ERR-38 (globe.gl API surface), ERR-39 (regex non-greedy), ERR-40 (espacios falsos tildes), ERR-41 (pill flex stretch).

## Shims inline en index.html

Dos funciones declaradas en `<script>` inline (líneas 1440-1445):

- `handleCTA()` — handler onclick para CTA buttons; previene error si se dispara antes de que auth.js cargue.
- `openAuthModal()` — abre modal de autenticación en contextos donde HTML ya está renderizado.

Necesarias porque onclick HTML resuelve en parse-time, antes de que el DOM cargue los módulos.

## Edge Functions Supabase

| EF | Versión | Descripción |
|---|---|---|
| `admin-actions` | v7 | Gestión admin. Requiere JWT admin. |
| `create-league` | v2 | Liga para cualquier user autenticado. Límite 3 si no-admin; ilimitadas si admin. `verify_jwt=false` (validación manual dentro de EF con service_role). Ver ERR-16. |
| `update-results` | v4 | Sync football-data.org → results. Activar pg_cron el 11 jun. |
| `porra-orchestrator` | v3 | N agentes Haiku en paralelo → orchestrator_jobs. |
| `porra-patch-deploy` | v4 | Patches search/replace + commit GitHub. |
| `porra-fix-encoding` | v5 | Inspect/write ficheros GitHub via API. Defaults: CLAUDE.md / main. |
| `porra-match-live` | v16 | Async + webhook, live scores. Webshare `N8vUChlhok5JU3cnL` build 1.0.7 principal + `BYLtYcOxYkruVipwr` build 1.0.19 fallback. |
| `porra-apify-webhook` | v7 | Logging completo, detecta goles + status, Twilio directo. Bug pendiente v8: no persiste team names / competition / match_start_ts. |
| `porra-whatsapp-send` | v1 | Envío WhatsApp via Twilio (form-urlencoded fetch). |
| `porra-whatsapp-webhook` | v4 | Webhook entrada WhatsApp. |
| `porra-ia-compute` | v10 | IA Predictor. 7 actions, motor log-odds + softmax. Ver `docs/ia-predictor.md`. |
| `porra-sofascore-proxy` | v8 | OBSOLETA. |
| `porra-github-pusher` | v6 | PLACEHOLDER. |

## Stack infraestructura

**Hosting**: Vercel (`porramundial2026-seven.vercel.app`) — autodeploy desde rama `main`.

**DB + Auth**: Supabase (proyecto `cmyfyswystjgzdwbqyyb`).

**Build**: Vite copia `public/` a `dist/` as-is; bundlea JS desde `js/main-entry.js` e inyecta `<script>` en `index.html`.

**Deploys EF**: NO usan MCP desde Claude Code. Requieren `SUPABASE_ACCESS_TOKEN` en máquina local o Claude.ai con su MCP de Supabase.

## Secrets

Catálogo Vault + EF secrets + patrones de acceso en `docs/secrets.md`.

## Tooling de orquestación

### Supabase MCP

Disponible en Claude.ai (proyecto `cmyfyswystjgzdwbqyyb`): `execute_sql`, `get_logs`, `list_edge_functions`, `get_edge_function`, `deploy_edge_function`.

### Chrome MCP

QA autónomo en `localhost:5173` (desarrollo) y producción. Login producción: `_porraDb.auth.signInWithPassword({email,password})`. Login local: `window.__QA_EMAIL` / `window.__QA_PASS` via `.env.local`.

### Claude Code ↔ GitHub MCP

Suite oficial GitHub MCP (`mcp__github__*`): `list_branches`, `list_pull_requests`, `pull_request_read`, `create_pull_request`, `merge_pull_request`, `list_commits`, `get_commit`, `issue_read/write`, `push_files`, `create_branch`, etc. Repo scope restringido por config del host a `cicloste88-max/porramundial2026`.

`git push` / `git fetch` NO van por el MCP: el harness monta un proxy HTTP local (`http://127.0.0.1:<puerto>/git/...`) que firma requests con el OAuth token. Por eso push puede funcionar incluso cuando el MCP de GitHub se cae — son componentes independientes del harness.

Patrón merge habitual: `create_pull_request` → review → `merge_pull_request` con `merge_method=squash`. GitHub auto-borra rama remota tras squash (config del repo); local con `git branch -D`.

**Plan B desconexión MCP**: (1) re-auth `mcp__github__authenticate` con URL + callback en `mcp__github__complete_authentication`; (2) si no revive, squash-merge local (`git merge --squash <rama> && git commit -m "... Closes #N" && git push origin main` — cierra la PR por keyword match); (3) último recurso: mergear desde la UI de GitHub. Nunca inventar tokens en el chat — el PAT queda en el transcript.

### Claude Desktop ↔ Claude Code

Canal: Chrome MCP. Claude Desktop abre Chrome, detecta el textarea de Claude Code en la pestaña activa y escribe ahí los prompts.

El editor de Claude Code es **Tiptap** (wrapper sobre **ProseMirror**), no `<textarea>` ni `contenteditable` crudo. Inyección: `document.execCommand('insertText', false, <texto>)`. ProseMirror lo reconoce vía su plugin de DOM-observer y traduce a transacciones del schema; preserva saltos de línea, no dispara validaciones anti-XSS, mantiene cursor.

Alternativas descartadas: `textarea.value = ...` (no aplica), `ClipboardEvent`/`paste` (frágil — depende del plugin `clipboardTextParser`), `InputEvent` manual (admitido pero obliga a replicar la state machine).

Envío del prompt tras inyección: `KeyboardEvent('keydown', {key:'Enter'})` sobre el editor. `Shift+Enter` si hace falta salto de línea dentro del prompt.

Failure modes:

- ProseMirror endurece anti-`execCommand` → fallback a `InputEvent` manual.
- Menú slash command abierto → `Escape` antes de inyectar.
- Debouncing ~16ms → texto largo en chunks de ~200 chars con pausas de 50ms.

## Historial de desarrollo (11 abr → 24 abr 2026)

| Fecha | Hitos | Commits clave |
|---|---|---|
| 2026-04-11 | Migración Vite completa, merge a main, fix vercel.json MIME | — |
| 2026-04-12 | Extracción main.js en 5 módulos, race condition fixes, Bracket Fase 1 SVG, Splash, Boost x2, Vista Jornada | ee2e25a → ef39b3d |
| 2026-04-13/14 | Bracket de resultados reales, sistema WhatsApp live scores | cd4afa2 → 8e8ac44 |
| 2026-04-15/16 | Actor Webshare propio, async+webhook, fix datasetId, migración a Webshare ($13/torneo) | b95ba00 → 12e6c6c |
| 2026-04-17 | Responsive fixes, limpieza repo (24 ficheros), helpers DB `schedule_match_crons`, persistencia `errores_conocidos` + `migration-log` (PR #1), Vista Directo simulacros (PR #3, ERR-14) | 2600c1a → 614b5ef |
| 2026-04-18 | EF `create-league` v1: no-admin hasta 3 porras (PR #5) | 34c3532 |
| 2026-04-19 | Rediseño móvil grupos (PR #9, 4 commits acordeón + focus + carrusel + slide 7), fixes iPhone (ERR-18/19/20/21), extracción `<style>` inline | 9d651d5 → 9e93fe8 |
| 2026-04-20 | Persistencia última página al F5, saga v2.1 → v2.11 (3 capas defensivas, ERR-23) | 8bc7f30 |
| 2026-04-21 | Sanity check 20 abr (13 hallazgos), IA Predictor Fases A–E mergeadas (EFs v6 → v9 ACTIVE) | c5029ac → 8d8b667 |
| 2026-04-23 | IA Predictor Fase F (wiring frontend, F.1–F.4 + post-F.1/2/3) — breakdown enriquecido + tooltip explainer | 31f4dbb → 6e46d2b |
| 2026-04-24 | Merge Fase F a main (PR #17 squash) | a24001a |

Detalle commit-by-commit en `CHANGELOG.md`.
