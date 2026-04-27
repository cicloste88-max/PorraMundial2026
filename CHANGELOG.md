# CHANGELOG — Porra Mundial 2026

Retención 90d. Auto-archivado a `CHANGELOG-archive-YYYYMM.md` si supera 30KB.

## 2026-04-27 — F7.4-D-A eliminar banner+btn legacy de page-grupos (PR pendiente)

**Cleanup app shell parte A** (commit `678ba5a`).

Tras la migración a pages dedicadas + bottom-tab + gate Fase final (F7.4-D-1, PR #31), el botón header `#btn-go-eliminatorias` y el banner inferior `#cta-eliminatorias` quedaban como UI duplicada de la navegación canónica. Se eliminan junto con todo el JS huérfano que mutaba sus nodos.

- **`index.html`**: borra btn header (9 líneas) + banner CTA completo (43 líneas, incluye `cta-locked-msg`, `cta-ready-msg`, `cta-filled`, `cta-groups-dots`, `cta-boost-pending`, `cta-boost-panel`).
- **`public/js/ui-groups.js`**:
  - `checkGroupsComplete` refactorizada de 124 LOC a 14 LOC: pasa a helper puro que solo computa `window._gruposComplete` (consumido por gate modal `#fc-gate-modal` en bottom-tab.js). Toda la mutación DOM del btn+banner eliminada.
  - `ctaExpandJornada` + export borrados (0 callers fuera del banner).
  - 4 líneas muertas en handler boost (re-render de `cta-boost-panel`) eliminadas.
- **`public/js/ui-nav.js`**: `goToEliminatoria` borrada (0 callers tras eliminar ambos onclick HTML); comentarios doc actualizados.
- Scope **estrictamente A**: NO toca `setView`, `view-tabs`, `ko-sub-bar` ni page-elim. La parte B se cierra acoplada a F7.4-F.

3 ficheros (9+ / 204−). Validado con `node --check` + `npm run build` (44 modules, 0 warnings, bundle 188.50 KB).

## 2026-04-27 — ERR-32 boost sync con boostPicks en focus mobile (PR #33)

**Boost check desincronizado en focus mobile** ✅ FIXED (commits `13f4ecd` + follow-up `9c4bc04`).

En el layer `mobile-focus`, los checks de boost de cada tarjeta y sus clases CSS (`boost-on`/`boost-active`) podían quedar desincronizados respecto a `boostPicks` cuando el usuario alternaba el boost desde el input directo de la card o tras una acción default. Síntoma: ✅ verde residual o `boost-active` en una card sin boost real (o viceversa).

- `refreshBoostRowsInFocus`: reconcilia el estado de `chk.checked` y las clases del row contra `boostPicks[date]` del día actual.
- Follow-up `9c4bc04`: `setTimeout(refresh, 0)` después del default-action del input directo, garantiza que la lectura post-handler ve el estado ya commit-eado.

## 2026-04-27 — ERR-30 mobile-locked persiste tras Deshacer (PR #32)

**Cards no se rehabilitan tras Deshacer en mobile focus** ✅ FIXED (commit `1a7a9b9`).

El handler `btn-undo` en `scoring.js` no liberaba los `mobile-locked` aplicados al guardar el grupo, dejando las cards inactivas tras Deshacer en el layer focus. Se añade `unlockCardsInFocus(group)` y `delete window.groupSaved[group]` al final del handler.

ERR-31 (btnRow residual tras Deshacer) sigue documentado pendiente — cosmético, scope F7.4-F.

## 2026-04-27 — F7.4-D-1 pages dedicadas Jornada/Directo/Predictor (PR #31)

**Pages dedicadas + cleanup app shell** (commit `7619eca`, PR #31 mergeado vía merge commit `cbc52e4` — docs end-of-session perdidos en ese merge parcial, recuperados en PR #34 docs-recovery).

- **5 tabs en bottom-tab navegan a pages reales**: `Grupos / Jornada / Directo / Fase final / Predictor`. Las routes null de F7.4-B ya tienen destino — clicar Jornada/Directo/Predictor abre su page propia (no más `console.debug "sin route"`).
- **Gate Fase final**: si `window._gruposComplete` es falsy, click en tab "Fase final" muestra modal `#fc-gate-modal` "Es necesario rellenar fase de grupos al completo (resultados, goleadores y boost de jornada) antes de acceder a las eliminatorias". Botón "Entendido" cierra. Modal global, fuera de cualquier page (auto-contained, ~50 líneas CSS+HTML+JS combined).
- **Limpieza interna page-grupos**: eliminados los 3 botones internos `#btn-vista-grupos/jornada/directo` con su contenedor selector. La función `setVistaGrupos` (ui-groups.js) y su override `setVistaGruposExtended` (ui-directo.js) eliminadas. `_vistaActual` reemplazado por `window._currentPage` expuesta por `showPage`.
- **Alias `quiniela→elim` retirado**: `_tabDefs` con id/icon `'elim'`; `fcMarkActiveTab` sin ternario alias; `icons.js` case `'elim'` (SVG trofeo intacto).
- **`boost-ticker` movido a page-jornada**: información de boosts por día, encaja conceptualmente con la vista por jornadas. Page-grupos mantiene su CTA banner inferior con pastillas de boosts pendientes (no se duplica info).
- **Hook `closeMobileFocus` global**: si page≠grupos y mobile-focus-layer abierto, se cierra automáticamente. Sustituye listeners obsoletos de los `#btn-vista-*` en `ui-groups-mobile.js`.
- **Persistencia ampliada**: VALID_PAGES y arrays de splash skip/hideSplash incluyen los 3 nuevos pages → recarga con `localStorage.porra_lastPage = 'jornada'`/`'directo'`/`'predictor'` restaura correctamente.
- **3 bugs preexistentes** detectados durante smoke (ERR-30/31/32) — verificados pre-existentes (scoring.js MD5 idéntico, reproducidos en producción), documentados en `errores_conocidos_porra.md`. **ERR-30 y ERR-32 ✅ FIXED en mini-PRs #32 (`1a7a9b9`) y #33 (`13f4ecd` + `9c4bc04` follow-up); ERR-31 sigue documentado pendiente.**

12 ficheros (198+ / 131-): `index.html`, `js/main-entry.js`, `public/js/{ui-nav,ui-groups,ui-directo,ui-groups-mobile,components/bottom-tab,components/icons,shell}.js`, `public/css/{base,directo,components/app-header}.css`.

## Histórico migrado del CLAUDE.md (24 abr 2026)

### Saga F5 v2.1 → v2.11 (3 capas defensivas, 20 abr 2026)

**Persistencia última página al F5** ✅ (HEAD `8bc7f30`).

F5/Ctrl+R en cualquier página (Grupos / Eliminatorias / Score / Admin) restaura la página donde el user estaba, sin flash welcome ni splash. Solo afecta a refresh con sesión válida; login fresco va a welcome por semántica.

**Diagnóstico final** (caza con MutationObserver, ver ERR-23): `#page-welcome` mutaba a `display:block` en T=612ms y volvía a `display:none` en T=1115ms — 503ms de flash. Causa: `main-entry.js:74` safety-net llamaba `showPage('welcome')` sin guard, lo que disparaba la lógica que retiraba el CSS lock de v2.9 antes de tiempo.

**Solución belt & suspenders en 3 capas:**

- **Capa 0 — `index.html` `<head>` (v2.6 + v2.8 + v2.9):** script inline síncrono lee `localStorage.porra_lastPage`, setea `window._pendingPageRestore`, salta el splash si hay restore, e inyecta `<style id="restore-lock-css">#page-welcome{display:none !important}</style>`.
- **Capa 1 — `main-entry.js:74-78` (v2.11):** safety-net con guard `if (!window._pendingPageRestore) showPage('welcome')`. Impide flash desde el chain.
- **Capa 2 — `public/js/ui-nav.js` `showPage()` (v2.10):** `if (lock && page==='welcome') return; if (lock && page!=='welcome') lock.remove()`. Lock self-healing: rogue `showPage('welcome')` no rompe el restore; `showPage(target)` retira el lock al pintar la página real.
- **Plus — `public/js/auth.js:325-339` (v2.1):** `onAuthStateChange` consume `_pendingPageRestore` solo en `INITIAL_SESSION` (no `SIGNED_IN`), revalidación admin explícita, ruta única `setTimeout(100) → showPage(finalPage)`.
- **Plus — `auth.js:349` (v2.7):** guard `if (!window._pendingPageRestore) showPage('welcome')` en arranque inicial + fallback en rama `else` por si la sesión está caducada.
- **Plus — `index.html:251` (v2.4):** `<div id="page-welcome" style="display:none">` (las otras 4 páginas ya lo tenían; welcome era la única visible por defecto).

**Limpieza key:** `porra_lastPage` con underscore — entra en barrido de `doLogout` (`auth.js:286`, `.includes('porra_')`).

**Diagrama del flujo de arranque con restore:**

```
T=0    HTML parse → <script inline> setea _pendingPageRestore + CSS lock + skip splash
T=~50  module bundle + chain → main-entry safety-net guard skipea welcome (capa 1)
T=~50  auth.js runAuthInit → guard skipea welcome (v2.7) + onAuthStateChange registrado
T=~60  Supabase emite INITIAL_SESSION → handler arranca await loadUserData
T=~500 loadUserData resuelve → consume _pendingPageRestore=null → setTimeout(100)
T=~600 showPage(target) → capa 2 retira lock + display:block en target
```

**Limitación aceptada:** ~500-600ms de pantalla oscura (background body) entre T=0 y `showPage(target)`. Aceptable porque no es welcome y no llama la atención. Si se queja en 3G, v3 con hidratación optimista de `currentUser` + `_activeLeague` desde localStorage.

**Limitaciones conocidas (sin resolver):** sub-tab Vista Directo no se preserva (vuelve a Grupos), scroll position no se preserva, URL siempre `/`. Multi-tab: `localStorage` compartido, gana último que escribe.

**Saga ruidosa pero documentada:** 11 iteraciones (v2.1 → v2.11) con varios reverts intermedios. Historia git no se squashea — los reverts documentan el aprendizaje.

### IA Predictor — Fases A–F (cronología commit-by-commit, 21-23 abr 2026)

| Fase | Acción | Commit | Estado |
|---|---|---|---|
| A | Migración 4 tablas + EF esqueleto | `968332a` (PR #10) | merged + aplicada |
| B | scrape_elo via `inside.fifa.com` | `4a32737` (PR #11) | deprecada por B.2 |
| B.2 | scrape_elo via Wikipedia Module | `c845f3e` (PR #12) | merged + desplegada |
| D | scrape_h2h via Wikipedia all-time_record | `cba5dcc` (PR #13) | deprecada por D.2 (ver ERR-24) |
| D.2 | scrape_h2h via 11v11.com/stats | `bbad657` (PR #14) | merged + desplegada |
| C | scrape_last_n via 11v11.com/matches | `2904025` (squash-merge de PR #15) | merged + desplegada |
| E | Motor IA log-odds+softmax + snapshots + compute_* | `8d8b667` (PR #16) | merged + desplegada (EF v9). Paridad Python↔TS 46/46 verde. |
| F | wiring frontend `auth.js` + `scoring.js` + `ko.js` + `data.js` | PR #17 `6b06880` (squash-merge a main, F.1–F.4) | merged |
| F.2b | simplificar chip `.ia-hint` tras QA | `eb729e7` | deprecado tras post-F.2 |
| post-F.1 | enriquecer `breakdown` de `ia_predictions` con raw context (ELO/H2H/forma/is_host) | `fb22648` + EF v10 vía supabase CLI (ERR-29) + compute_groups 72/72 | merged en rama + desplegado |
| post-F.2 | eliminar chip `.ia-hint` + extraer `hydrateIABar` + doc ERR-29 | `8dd691c` | smoke manual verde |
| post-F.3 | tooltip explainer en el % (`buildIAExplainer`, hover desktop / click mobile) + cierre Fase F | `6e46d2b` | Fase F COMPLETA |
| (cierre) | Doc sweep CLAUDE.md + CONTEXTO + migration-log | `a079fda` / `a24001a` | main fast-forward `615e52a → a24001a` |

**Estado tablas al cierre post-F (23 abr noche):** `ia_elo_fifa` 211 · `ia_h2h` 815 · `ia_last5_results` 48 · `ia_snapshots` 2 (1 activo: `initial_test_21apr`) · `ia_predictions` 72 partidos de grupos poblados por `compute_groups` con breakdown enriquecido (`elo_*_raw`, `h2h_*`, `form_*_ppg`, `is_host`) + entradas on-demand KO residuales (se repoblarán al freeze del 11 jun).

**Lecciones registradas en `errores_conocidos_porra.md`:** ERR-24 (Wikipedia inadecuada para H2H masivo — sólo ~3/48 tienen página `_all-time_record`); ERR-25 (3 headers obligatorios para 11v11.com); ERR-26 (`pg_net` sin PUT — bloquea merge vía GitHub API desde Supabase); ERR-27 (`vault.decrypted_secrets` no enruta; fix vía RPC `get_vault_secrets`); ERR-29 (MCP `deploy_edge_function` rompe con payloads >70KB).

### IA Predictor — Fase F wiring (cronología F.1 → post-F.3, 23-24 abr 2026)

- **F.1 — `auth.js`**: helper `loadIAPredictions()` añadido al `Promise.all` de `loadUserData`. Lee `ia_snapshots.is_active=true` + `ia_predictions.select('match_id,sign,confidence,breakdown,used_fallback').eq('snapshot_id',id)` en paralelo con `public/data/worldcup-2026-matches.json` para mapear `wc2026_gX_<id>` → `${group}_${home_es}_${away_es}` (formato `getMatchKey()`). Expone `window.iaPredictions`.
- **F.2 — `scoring.js` + `base.css`**: hidrata la `.ia-bar` existente al render, evita spinner stuck. Pinta signo + % + quip al usuario en cada tarjeta de partido de grupos.
- **F.3 — `ko.js` + `ko.css`**: en `buildKOCard`, si ambos equipos resueltos, `loadKOIAHint()` chequea sessionStorage `ia_ko_<home>_<away>`; si no hay hit invoca `porra-ia-compute` con `{action:'compute_match', home, away}` via `window._porraDb.functions.invoke`. Cachea en sessionStorage + espeja en `iaKoPredictions` para que `openModal` reutilice.
- **F.4 — `data.js` + `scoring.js`**: guard defensivo en `iaBonusWillApply` (`ia.sign ∈ {'1','X','2'}`) + 4 casos doc A/B/C/D verificados via Node stdout 4/4. El bonus se aplica DESPUÉS de signo/exacto/goleador y ANTES del cap `Math.min(pts,7)` y del boost ×2.
- **post-F.1 — `fb22648`**: enriquecer `breakdown` de `ia_predictions` con 9 raw-context fields (`elo_home_raw`, `elo_away_raw`, `h2h_home_wins/away_wins/draws/total`, `form_home_ppg`, `form_away_ppg`, `is_host`). EF v10 desplegada vía `supabase CLI` local por ERR-29 (MCP `deploy_edge_function` payload >70KB).
- **post-F.2 — `8dd691c`**: eliminar chip `.ia-hint` completo tras QA (pill "+1pt vs IA" + `.ia-bar` con quip ya cumplen). Función `renderIAHint` reemplazada por `hydrateIABar(idx, matchKey)`. 5 reglas `.ia-hint*` borradas de `base.css` (intactas en `ko.css` bajo `.ko-ia-hint`). Smoke verde (MEX-RSA + SUI-BIH).
- **post-F.3 — `6e46d2b`**: tooltip explainer sobre el % de la `.ia-bar`. `auth.js::loadIAPredictions` mapea los 9 raw-context fields al store. `scoring.js::hydrateIABar(idx, matchKey, match)` wrapea `(conf%)` en `<span class="ia-pct-trigger">` con role/aria. Nueva `buildIAExplainer(ia, home, away)` → narrativa 5-7 plantillas + lista ELO/H2H/Forma/is_host con fallbacks del spec. `setupIAExplainerOnce` singleton popover + event delegation: hover desktop, click mobile, teclado Enter/Espacio. **Fase F COMPLETA**.

### Bugs recientemente resueltos (abr 2026)

- `updateCardUI` race condition tras login (commit `ee2e25a`, ver ERR-07).
- CSS grid-areas roto en Vista Jornada (ver ERR-09).
- 404 masivos en consola por `extractUrl(linear-gradient(...))` (ver ERR-08).
- Header eliminatorias responsive en móvil (mismo patrón que fase grupos, ver ERR-10).
- Bracket-results móvil (commit `2600c1a` — min-width 260px por columna activa).
- Rediseño bracket: timeline vertical + live hero (commit `2600c1a`).
- `pg_net` timeout en `porra-match-live` (resuelto vía async + webhook Apify; arquitectura final del live scoring).
- **Vista Directo + sección simulacros admin** (PR #3, commits `d137d99` + `6d2c028` + `0421f0f`, merge `614b5ef`):
  - Banner superior `SIMULACRO · PARTIDO FUERA DEL MUNDIAL` (no se solapa con nombre equipo).
  - `checkIsAdmin` async con retries hasta 5s + re-render anti-loop (ver ERR-14).
  - Causa raíz original: `match_key` renombrado por error matinal `wc2026_gA_15186710` → `_historic_..._trial`. Revertido.
- **Rediseño móvil fase de grupos** (PR #9 mergeado en `9d651d5`, 4 commits `871592b` + `b812f41` + `c69f7de` + `e114c02`):
  - Commit 1/4: infra + `ui-groups-mobile.js` + `PHRASES_GRUPO` + placeholder `@media` + script en loadScript chain.
  - Commit 2/4: acordeón lista + barra progreso por grupo + helper `applyMobileGroupCollapse`.
  - Commit 3/4: focus layer + carrusel 6 slides + swipe + smart boost row (conflicto jornada).
  - Commit 4/4: slide 7 clasificación + botón Guardar/Deshacer + lock cards + persistencia BD (`league_members.groups_saved` JSONB).
- **Fixes producción móvil** (19 abr, 4 commits a `main`):
  - `b4a52e6` — ERR-18: `css/` → `public/css/` (Vite sólo copia `public/` a `dist/`).
  - `0aa78a9` — ERR-19: `openMobileFocus` defensivo con `try/catch` + toast para debug sin devtools en iPhone.
  - `40c0fe2` — ERR-20: eliminar `body.style.overflow='hidden'` (bloqueo persistente en Safari iOS).
  - `82b4753` — ERR-21: reglas base de `.mobile-focus-layer` fuera del `@media` + `visibility:hidden/visible` (evita layer fantasma en hit-testing Safari).
- **Refactor CSS extracción `<style>` inline** (commit `9e93fe8`): 4 bloques `<style>` de `index.html` con comentario "Archivo destino : X.css" nunca se habían migrado. Fix: contenido `<style>` prepended a cada fichero destino (para que reglas nuevas al final ganen por cascada), bloques eliminados de `index.html` (de 2970 a 1008 líneas), 4 `<link>` nuevos en cabecera. Causa raíz real de ERR-18/19/20/21.

### Limpieza repo (17 abr 2026)

Eliminados:

- 5 backups `.bak`: `index.html.bak`, `js/main.js.bak{,2,3}`, `js/auth.js.bak`.
- 3 duplicados bracket-results (raíz `.js/.css` + `js/bracket-results.js` viejo).
- 6 patches Python one-shot (`patch_*.py`).
- 5 markdowns de diseños ejecutados (`vista-jornada.md`, `jornada-redesign.md`, `fix-vista-jornada.md`, `boost-ticker-mejoras.md`, `new_bracket.txt`).
- `js/utils.js` huérfano (shims ya están inline en `index.html` líneas 1440-1445).
- `supabase-ef-patches/porra-apify-webhook-v6.ts` (producción en v7).
- 3 scripts exploratorios Apify.

Añadido a `.gitignore`: `apify-actors/*/node_modules/`.

### Playoffs UEFA marzo 2026 — resueltos

- Grupo A + República Checa
- Grupo B + Bosnia
- Grupo D + Turquía
- Grupo F + Suecia
- Grupo I + Irak
- Grupo K + RD Congo
