# v3 vs Legacy — Inventario por pantalla

**Fecha:** 16-may-2026 · **Scope:** mapeo screen-by-screen del SPA Porra Mundial 2026 documentando qué se sustituyó por el redesign v3, qué quedó en redesign interno (CSS/UX retocada sin rewrite JS) y qué sigue legacy puro.

**Relación con otros docs:**
- `docs/AUDIT_LEGACY_VS_V3.md` — audit **por feature** (15 match-card features + 9 puntos de integración I1..I9). Complementa este inventario.
- `CLAUDE.md` § Top-3 #1 — uso operativo de este documento: asegurar que ninguna funcionalidad legacy se pierde y recolocar reminiscencias en el nuevo layout.

**Por qué este doc:** el reframe del 15-may aclara que v3 NO es un rewrite completo. v3 sustituye 2 screens visualmente + 2 más con redesign interno + monta un shell global (fifa-bar + countdown + qualified-cta + stage-pill) en 4 pages. El resto del SPA sigue legacy. Sin un mapa por pantalla, las decisiones sobre dónde recolocar features (boost, IA tooltip, EN VIVO, CEST, Pizarra, etc.) se toman a ciegas.

---

## Mapa de assets v3 vs legacy

### JS

| Path | Rol | LOC |
|---|---|---|
| `public/js/v3/mundial-shell-v3.js` | Shell global (`SHELL_PAGES = ['grupos','jornada','directo','elim']`) — fifa-bar + countdown + qualified-cta + stage-pill + chips usuario | 379 |
| `public/js/v3/grupos-v3.js` | Entry `window.v3GruposMount()` + board completo de Grupos | 944 |
| `public/js/v3/eliminatoria-v3.js` | Entry `window.v3ElimMount()` + bracket KO completo | 675 |
| `public/js/v3/next-match-resolver-v3.js` | Helper para resolver "próximo partido" alimentando shell global | 99 |
| `public/js/ui-groups.js` | Legacy Grupos (sustituido — sigue en repo para fallback o referencia) | 1446 |
| `public/js/ko.js` | Lógica BRACKET + `buildChampionPodium` (consumido aún por v3 y por shell elim) | 1380 |
| `public/js/ui-elim-shell.js` | Shell legacy de la antigua page-elim (F7.X) — coexiste pero ha sido cubierto por v3 | 701 |
| `public/js/ui-directo.js` | Legacy Directo (sigue activa — solo CSS v2) | 776 |
| `public/js/ui-pred-shell.js` | Legacy Predictor (fuera de SHELL_PAGES decisión I2) | 1378 |
| `public/js/ui-pizarra-tactica.js` | Modal Pizarra Táctica — feature transversal, no es v3 ni legacy de pantalla | — |
| `public/js/ui-globo-equipos.js` | Globo 3D — legacy puro, fuera de v3 | — |

### CSS

| Path | Rol |
|---|---|
| `public/css/v3/mundial-shell-v3.css` | Estilos del shell global v3 |
| `public/css/v3/grupos-v3.css` | Estilos pantalla Grupos v3 |
| `public/css/v3/eliminatoria-v3.css` | Estilos pantalla Eliminatorias v3 |
| `public/css/components/elim-shell.css` | Estilos shell antiguo F7.X — convive con v3 |
| `public/css/components/grupos-shell.css` | Estilos previos a v3 para Grupos — convive |
| `public/css/components/jornada-v2.css` | Redesign interno de Jornada (no v3) |
| `public/css/components/directo-v2.css` | Redesign interno de Directo (no v3) |
| `public/css/components/predictor-shell.css` | Shell del Predictor (no v3) |
| `public/css/components/app-header.css`, `bottom-tab.css`, `tokens.css` | Cross-page (header global, tabbar inferior, design tokens) |

---

## Inventario por pantalla

### 1 · `#page-grupos` — **v3 sustituye totalmente**

- **JS:** `public/js/v3/grupos-v3.js` (944 LOC) + shell v3.
- **CSS:** `public/css/v3/grupos-v3.css` + `mundial-shell-v3.css`.
- **HTML:** `<div id="page-grupos">` (index.html:528) — `<div class="container">` legacy eliminado en F3-I1.6 (commit `e048815`, 61 LOC -). Mount real: `#v3-grupos-mount` inyectado por `v3GruposMount()`.
- **Estado:** screen completamente reemplazada. Legacy `ui-groups.js` sigue en repo pero no se monta cuando `showPage('grupos')` se invoca (`v3GruposMount` toma el control).
- **Reminiscencias legacy presentes en v3:** board de 12 grupos visual, modal de pronóstico por partido (3 tabs internas), stage-pill con números de pronósticos completos, propagación grupos→KO via `resolveAllSlots()` (HF-08).
- **Reminiscencias legacy NO presentes (gap):**
  - **Tooltip IA con frase contraria** previo a kickoff (audit item 1). Legacy `ui-groups.js:466` lo tenía inline en card.
  - **CEST kickoff display + estadio** en match-card (audit item 2). Legacy lo mostraba en card de jornada.
  - **EN VIVO indicator** durante partido (audit item 4 / I5).
  - **Score IA vs usuario** comparativo (audit item 7).
  - **Boost ×2** completo: selector por jornada + lock 1er partido del día + badge ×2 + defaults FIFA (audit item 9 / I7).
  - **Pizarra Táctica entry** desde flag de card v3 (audit item 3 / I8).
  - **Cierre porra → read-only** cards (I4): tras kickoff, deshabilitar chips/picker/save en v3.
  - **Frases IA wiring** para pronóstico signo (audit item 15).
- **Bugs UI conocidos pendientes:** cinta tabs ronda incompleta móvil, hora CEST en píldora `Grupo · Estadio`. Detalle en `CLAUDE.md` § Pendientes Bugs UI.

### 2 · `#page-elim` — **v3 sustituye totalmente (bracket KO completo)**

- **JS:** `public/js/v3/eliminatoria-v3.js` (675 LOC) + shell v3.
- **CSS:** `public/css/v3/eliminatoria-v3.css` + `mundial-shell-v3.css`. Convive `elim-shell.css` del shell antiguo F7.X — el shell antiguo coexiste pero el bracket es 100% v3.
- **HTML:** `<div id="page-elim">` (index.html:606). Bracket renderizado por `v3RenderBoard()`.
- **Estado:** screen completamente reemplazada. Sprint F3-I1.6.x + HF-08..HF-15 (mergeado en `eb9c9d1`) deja el bracket KO visualmente completo, con códigos 3 letras, propagación funcional grupos→KO y SEMIS con aire visible al trofeo.
- **Reminiscencias legacy presentes en v3:** lógica BRACKET de `ko.js` reusada, `resolveKO` para empates blindado (HF-09), `buildChampionPodium` consumido en F3-I1.x para Cuadro de Honor bajo Final.
- **Reminiscencias legacy NO presentes (gap):**
  - **EN VIVO indicator** en cards KO durante partido (audit item 4 / I5). Legacy `ko.js:867` lo tenía via `stxt.textContent='EN VIVO '+min+"'"`.
  - **IA tooltip + frase IA + score IA** en match-cards KO (I6).
  - **Cierre porra → read-only** en bracket (I4).
  - **Pizarra Táctica entry** desde card KO (I8).
- **Caveats:**
  - `ui-elim-shell.js` (701 LOC) sigue en repo como remanente del F7.X. F3-I1.6.5 ocultó 8 elementos legacy via CSS pero NO se ha hecho cleanup definitivo del módulo. **TODO:** decidir si deprecar `ui-elim-shell.js` ahora que v3 cubre la screen, o conservarlo de fallback hasta post-Mundial.
  - Cuadro de Honor (cajas Campeón + Podio) restaurado en F3-I1.x (5a3ddde/533ec15 — ver archive 2026-05-08) bajo `_renderList` del shell legacy. **TODO:** verificar que sigue funcionando con el bracket v3 montado, o portar `buildChampionPodium` a `v3RenderBoard`.

### 3 · `#page-jornada` — **redesign interno (CSS v2) + shell v3**

- **JS:** sin módulo propio v2 — la lógica se invoca desde `js/main-entry.js` y/o `misc.js`. **TODO:** verificar entry point exacto (no localizado en este audit; probable `loadScript('/js/ui-jornada-v2.js')` ya hecho o pendiente).
- **CSS:** `public/css/components/jornada-v2.css` (redesign visual) + shell v3 (`mundial-shell-v3.css` monta fifa-bar arriba).
- **HTML:** `<div id="page-jornada">` (index.html:542) con sub-mounts `#boost-ticker`, `#jornada-user-strip`, `#jornada-container`.
- **Estado:** NO es un rewrite v3. El shell global v3 se monta encima porque `SHELL_PAGES` incluye `'jornada'`. La pantalla mantiene la lógica legacy de listado de partidos por jornada con CSS retocada (v2).
- **Reminiscencias legacy a vigilar:**
  - **Boost ticker** (`#boost-ticker`) existe como contenedor en HTML. Verificar que sigue renderizando bajo el shell v3 sin colisión z-index (I9).
  - **`#jornada-user-strip`** (mini-board del usuario) — `TODO:` verificar coexistencia con el stage-pill del shell v3.
- **Gaps respecto a Top-3:** Boost mechanic UX completo (audit item 9 / I7) probablemente vive aquí, no en el modal de grupos. **Decisión pendiente San:** ¿el selector boost va en modal grupos o en page-jornada?

### 4 · `#page-directo` — **redesign interno (CSS v2) + shell v3**

- **JS:** `public/js/ui-directo.js` (776 LOC) — sin port a v3.
- **CSS:** `public/css/components/directo-v2.css` + shell v3.
- **HTML:** `<div id="page-directo">` (index.html:561) con `#directo-container`.
- **Estado:** lógica legacy. Solo CSS retocada. `live-sync.js` alimenta `_liveScoresByMatchKey` consumido aquí.
- **Reminiscencias legacy presentes:**
  - Flag-click handler que dispara `window.openPizarraTactica({iso2})` (ui-directo.js:769).
  - Cards expandidas mini/exp con score live, EN VIVO pill, evento timeline.
- **Gaps:**
  - **Coexistencia con shell v3:** `mundial-shell-v3.js` monta fifa-bar arriba; verificar paridad visual (header height, padding-top de `#directo-container`).
  - **Migración futura a v3:** no planificada antes del Mundial. Este page se queda con lógica legacy.

### 5 · `#page-predictor` — **legacy puro + shell propio (no v3)**

- **JS:** `public/js/ui-pred-shell.js` (1378 LOC).
- **CSS:** `public/css/components/predictor-shell.css`.
- **HTML:** `<div id="page-predictor">` (index.html:581).
- **Estado:** **fuera de `SHELL_PAGES` por decisión I2 (commit `8bac28f`).** El shell v3 NO se monta aquí. El Predictor tiene su propio shell legacy.
- **Razón:** la pantalla del Predictor (campeón + 4 awards + scorers) no encaja en el patrón fifa-bar + countdown del shell global. Mantener `ui-pred-shell.js` aislado es correcto para F3.
- **Reminiscencias legacy a vigilar:**
  - **Award badges** (Balón / Bota / Guante Oro / Mejor Joven) renderizadas aquí (audit item 8). **Gap:** sin UI v3, pero correcto porque la screen entera es legacy.
  - **Auto-Pichichi** (audit item 6) — feature pendiente, depende de cálculo backend post-grupos.

### 6 · Pages cross-cutting (legacy puro, sin v3)

| Page | JS | Status |
|---|---|---|
| `#page-globo` | `ui-globo-equipos.js` | Legacy puro. NO en `SHELL_PAGES`. Globo 3D con panel detalle. Detalle: `docs/globo-mundial.md`. |
| `#page-admin` | `admin.js` (incluye `dice.js`, no separar — ver `CLAUDE.md` reglas críticas) | Legacy puro. Solo accesible si `currentUser.is_admin`. |
| `#page-welcome`, `#page-score` | `auth.js` | Auth flow (signup/login/recovery). Sin redesign v3. |

---

## Roadmap consolidación estética

**Objetivo:** dejar las 2 screens v3 (Grupos + Eliminatorias) sin pérdida de funcionalidad respecto a legacy, y las 2 screens con redesign interno (Jornada + Directo) coexistiendo limpiamente con el shell v3.

### Pre-11-jun (crítico, bloqueador Mundial)

Orden sugerido según prioridad de `docs/AUDIT_LEGACY_VS_V3.md` + integraciones I1-I9 pendientes:

1. **I4 — Cierre porra → read-only en cards v3** (Grupos + Elim). Sin esto, tras kickoff los usuarios pueden seguir guardando pronósticos. **Bloqueador 11 jun.**
2. **I6 — IA Predictor wiring v3** (tooltip + frase IA + score IA) en cards Grupos + Elim. Sin esto el bonus IA del scoring es invisible al usuario.
3. **I5 — EN VIVO indicator** en cards Grupos + Elim. Bloqueador UX día-D.
4. **I7 — Boost UX completo.** Selector + lock 1er partido + badge ×2 + defaults FIFA. Decidir dónde vive (modal grupos vs page-jornada — pendiente San).
5. **I3 — Event bus `mundial:predictions-changed`** disparado en `savePredictions()` legacy + listeners en grupos-v3 y eliminatoria-v3. Sin esto, mutaciones legacy no re-renderizan v3.

### Media prioridad (post-11-jun aceptable)

- **Audit item 2** — CEST kickoff display + estadio en match-card. Misma `<time>` que ya muestra Jornada legacy.
- **Audit item 3 / I8** — Pizarra Táctica entry desde flag de card v3.
- **Audit item 7** — Score IA vs usuario comparativo (depende de I6).
- **Cleanup `ui-elim-shell.js`** — decidir si deprecar o conservar como fallback.
- **I9 — Auditoría z-index** entre modales legacy y zoom-overlay v3.

### Baja prioridad / opcional

- Auto-Pichichi (audit item 6).
- Compartir pronóstico (audit item 10).
- Confetti 6/6 (audit item 11).

---

## Caveats y TODOs explícitos

- **TODO:** verificar entry point JS de Jornada v2 (módulo no localizado en `public/js/`; podría estar inline en `misc.js` o pendiente de extracción).
- **TODO:** verificar que `buildChampionPodium` sigue inyectándose bajo Final del bracket v3 tras los HFs HF-08..HF-15. La función legacy se invocaba desde `ui-elim-shell.js#_renderList`; con `eliminatoria-v3.js` controlando ahora, confirmar mount.
- **TODO:** decidir deprecación de `ui-elim-shell.js` (701 LOC) ahora que v3 cubre `#page-elim`. F3-I1.6.5 ocultó 8 elementos legacy via CSS pero el módulo sigue cargándose.
- **TODO:** auditar coexistencia de `#boost-ticker` y `#jornada-user-strip` con el shell v3 en `#page-jornada` (sin colisión z-index ni offset visual).
- **TODO:** confirmar si el shell v3 maneja correctamente `#page-directo` cuando hay `EN VIVO` pulsante en cards (live-sync.js dispara updates frecuentes — sin debounce, riesgo de jitter visual).
- **TODO:** registrar en este doc los wiring efectivos a medida que se cierre cada I3-I8. Sirve de checklist de cierre de la fase F3.

---

## Cierre Sprint Pre-Launch (20-may-2026)

Sprint cerrado con tres PRs mergeadas que cubren 11 fixes pre-launch + 2
hotfixes iOS:

- **PR#75 (`72e3b75`)** — F-01..F-10b: paquete pre-launch (11 fixes). Incluye
  cierre de gaps de integración v3↔legacy enumerados arriba en
  "Reminiscencias legacy NO presentes". Repasar AUDIT_LEGACY_VS_V3 contra el
  diff de esta PR para marcar cada gap I3-I8 efectivamente cubierto.
- **PR#77 (`7d8b706`)** — F-10b hotfix iOS: scroll trasladado de
  `.v3-zoom-panel` (con `pointer-events:none`) a `.v3-zoom-panel__inner`
  (con `pointer-events:auto`). Causa raíz: iOS Safari bloquea touch en
  elementos sin pointer events incluso si tienen `overflow-y:auto`
  (ERR-65). Patrón promovido a regla en `.claude/rules/frontend-css.md`.
- **PR#78 (`0e49612`)** — F-10b hotfix max-height: `calc(100dvh - 80px)`
  descontando `.fc-tabbar` 56px + 24px de margins. Sin descuento, el inner
  desbordaba bajo la tabbar fija (ERR-66).

**TODO post-cierre**: actualizar tabla "Inventario por pantalla" marcando
los gaps I3-I8 efectivamente cubiertos en PR#75 con SHA específico + screen
afectada.

## Cómo usar este doc

- **Al portar una feature legacy a v3:** consultar primero esta tabla por pantalla, identificar si es "gap reminiscencia" o "feature transversal" (audit doc), y wiring sugerido. Si la feature toca >1 screen (ej. EN VIVO), planear ambos cards Grupos + Elim en el mismo PR.
- **Al diseñar un screen nuevo:** decidir si entra en `SHELL_PAGES` (heredará fifa-bar + countdown + qualified-cta + stage-pill) o si tiene shell propio (como Predictor).
- **Al hacer cleanup de legacy:** verificar que la screen está marcada "v3 sustituye totalmente" antes de borrar el módulo legacy; si está "redesign interno" o "legacy puro", NO borrar.
- **Al cerrar la fase F3:** actualizar este doc marcando ✅ cada gap resuelto + actualizar `docs/AUDIT_LEGACY_VS_V3.md` § Funcionalidades transversales con el commit SHA.
