# Pantalla 00 · App Shell

> Estado: ✅ **Cerrada** · F7.4-A merged · PR #28 (commit `dffd1ae`) · main=`0ddc6dc`
> A1 inventario: ✅ cerrado
> A2 objetivo: ✅ capturado (Bloque A bundle v2)
> A3 preview: ✅ aprobado
> A4 decisiones: este documento (final)
> A5 brief: plan inline en sesión Code (26 abr 2026)
> A6 QA: ✅ programático 12/12 + smoke visual OK

App shell global (bottom-tab + app-header + tokens) introducido como **esqueleto inerte** en F7.4-A. Las fases F7.4-B → F7.4-E lo conectan progresivamente. F7.4-A es el único PR con código nuevo neto del bloque sin cambios visuales — los siguientes activan la maquinaria.

---

## 1 · Inventario producción (pre-F7.4-A)

| Funcionalidad | Ubicación (file:linea) | Handler JS | Estado |
|---|---|---|---|
| Auth bar fixed (welcome) | `index.html:154` `#wc-auth-bar` | `renderAuthBar()` `public/js/auth.js:217-236` | Mantener (F7.4-E simplifica) |
| Header admin inline | `index.html:643` `.adm-header` | inline | Migrar a `.fc-appbar` (F7.4-C) |
| Header score (clasificación) | `index.html:200-206` `.sb-header` + `.sb-back-btn` | inline | Reutilizar back-btn como sub-vista de Perfil (F7.4-E) |
| Header eliminatorias | `index.html:650-676` `.global-header` | inline | Migrar a `.fc-appbar` (F7.4-C) |
| Sub-tabs page-grupos (3 botones vista) | `index.html:552-568` | `setVistaGrupos()` ui-groups.js | Eliminar y reemplazar por nav del shell (F7.4-D) |
| View-tabs page-elim (3 view-tabs) | `index.html:678-681` | inline | Eliminar (F7.4-D) |
| `renderAuthBar` escribe en 3 elementos | `auth.js:217-236` | escribe `#wc-auth-bar` + `#grupos-user-bar` + `#elim-user-bar` | Simplificar a un único target (F7.4-E) |
| Splash flag boolean | `index.html:104-107` (skip path) + `121-127` (hideSplash) | inline | Necesita `window._splashHidden` para gate del shell |
| VALID_PAGES (4 sitios divergentes) | `js/main-entry.js:9` + `index.html:38` + `index.html:92-141` + `public/js/ui-nav.js` | varios | F7.4-B unifica + añade 'perfil' |
| `_gruposInited` boolean lazy-init | `public/js/ui-nav.js:499` | inline | F7.4-B migra a Promise singleton |
| MutationObserver `.boost-active` | `public/js/scoring.js:588-600` | global, observa `#page-grupos` con `subtree:true` | Necesita guard contra mutations del shell |

**Conclusión A1**: 4 headers inline divergentes, 2 sub-tab sets internos, `renderAuthBar` con triple target, splash sin flag boolean. F7.4-A no toca ninguno de estos — solo añade el esqueleto que las fases siguientes consumirán.

---

## 2 · Inventario v2 (bundle Design System v2)

| Componente | Ubicación bundle | Función |
|---|---|---|
| **BottomTabs** | `app/screens/screens-v1.jsx:459-477` | Barra inferior fija con 5 items (Grupos / Jornada / Directo / Quiniela / Predictor) + safe-area inset |
| **Icon** | `app/components/atoms.jsx:24-46` | Helper SVG inline (sprite). Sirve para tabs + acciones header + perfil |
| **Tokens (design-tokens.css)** | `app/design-tokens.css:9-40` | `--color-*`, `--space-*`, `--radius-*`, `--font-*`. Adaptados a prefijo `--fc-*` para evitar choque con vars existentes en `public/css/base.css` |
| **AppBar (variantes)** | `app/components/atoms.jsx` | Header reusable con back-btn + título + acciones derecha. Variantes `--global` (fixed), `--page` (sticky), `--modal` (relative) |

El v2 propone shell global persistente (bottom-tab visible en tabs juego, oculto en sub-vistas) + un único componente header reusable que sustituye los 4 inline. El v2 NO contempla page-perfil (P10 nueva) — invención de Bloque A para meter Clasificación bajo Perfil (D6) y simplificar `renderAuthBar` (D5).

---

## 3 · Decisiones de adaptación (Bloque A consolidado, D1–D7)

| ID | Decisión | Implementación |
|---|---|---|
| **D1** | Mantener Clasificación accesible en ≤2 taps desde cualquier tab juego | F7.4-E: header global muestra #posición clickable → 1 tap a Perfil → 1 tap a Clasificación. La #posición visible siempre **mitiga** el coste del tap extra que mete Clasificación bajo Perfil. |
| **D2** | Tokens prefijo `--fc-*` (no `--*` ni `--ds-*`) | F7.4-A: `public/css/components/tokens.css` con 30 vars (--fc-bg, --fc-surface, --fc-text-*, --fc-tab-h, --fc-z-*, --fc-radius-*, --fc-transition, etc.) |
| **D3** | Iconos SVG inline (no font icons, no sprite externo) | F7.4-A: `public/js/components/icons.js` con `window.getIcon(name)`. 17 SVGs: 5 tabs juego + 5 auth/perfil + 7 acciones header. Stroke-width 2, viewBox 24x24, `currentColor`. |
| **D4** | Componente AppBar reusable con 3 variantes | F7.4-A: `public/css/components/app-header.css` define `.fc-appbar`, `.fc-appbar--global`, `.fc-appbar--page`, `.fc-appbar--modal` + slots `__back`/`__title`/`__actions`. F7.4-C migra los 3 headers inline. |
| **D5** | Header global = avatar + puntos + #posición clickable (sin nombre liga) | F7.4-A: clases `.fc-appbar__avatar`, `.fc-appbar__pts`, `.fc-appbar__rank` definidas en CSS. F7.4-E las renderiza. Tap avatar → Perfil home; tap #posición → Perfil → Clasificación. |
| **D6** | Clasificación como sub-página de Perfil | F7.4-E: `#page-score` se mantiene full-screen (no se inyecta dentro de `#page-perfil`) con `.sb-back-btn` (ya existente en `index.html:200-206`) + bottom-tab oculto durante la sub-vista (toggle `body.fc-shell-active` off al entrar, on al salir vía back). |
| **D7** | Inline criterio: solo welcome hero | F7.4-C: resto de pages debe usar `.fc-appbar`. Welcome hero queda como excepción autorizada. |

---

## 4 · DoD (definition of done) — F7.4-A

- [x] Mobile 375px iPhone — OK (sin cambios visuales)
- [x] Mobile 414px Pixel — OK (sin cambios visuales)
- [x] Desktop ≥1024px — OK (sin cambios visuales)
- [x] Console limpia (no errores ni warnings nuevos)
- [x] Funcionalidades preservadas (lista del A1 — ninguna tocada en F7.4-A)
- [x] Sin regresiones en pantallas vecinas (welcome, grupos, elim, score, admin, directo)
- [x] CSS guards verificadas: `npm run build && grep -l "fc-tabbar" dist/css/components/*.css` → `dist/css/components/bottom-tab.css` ✓
- [x] `node --check` OK en los 4 JS nuevos
- [x] `window._splashHidden === true` tras splash desaparecido (ambos paths)
- [x] `window.fcShellApply('grupos')` invocado manual → no-op silencioso
- [x] Boost MutationObserver sigue funcionando (guard no rompe el caso real)
- [x] Mounts `#fc-header-mount` / `#fc-tabbar-mount` invisibles (`hidden` attr)

**12/12 puntos OK.**

---

## 5 · Snapshots CSS críticas pre-cambio

Conservados antes de tocar el shell para diff posterior si F7.4-B/C introducen regresiones:

### Splash skip path (`index.html:100-108` original)

```js
try {
  var lastPage = localStorage.getItem('porra_lastPage');
  if (lastPage && ['grupos','elim','score','admin'].indexOf(lastPage) !== -1) {
    window._pendingPageRestore = lastPage;
    splash.style.display = 'none';
    if (splash.parentNode) splash.parentNode.removeChild(splash);
    window.splashDone = function(){};
    return;
  }
} catch(_) {}
```

Post-F7.4-A: línea `window._splashHidden = true;` añadida antes de `window.splashDone = function(){};`.

### hideSplash interno (`index.html:121-127` original)

```js
function hideSplash(){
  if (hidden) return;
  hidden = true;
  clearInterval(iv);
  splash.classList.add('hidden');
  setTimeout(function(){ if (splash.parentNode) splash.parentNode.removeChild(splash); }, 700);
}
```

Post-F7.4-A: callback `setTimeout` ahora es bloque multi-línea con `window._splashHidden = true;` después del `removeChild`.

### MutationObserver boost (`public/js/scoring.js:587-592` original)

```js
const _boostObserver = new MutationObserver(function() {
  const active = document.querySelector('.card.boost-active');
  if (active) _boostFire.attachTo(active);
  else _boostFire.detach();
});
```

Post-F7.4-A: callback acepta parámetro `mutations` y short-circuita si **todas** las mutations vienen de dentro de `.fc-tabbar` o `.fc-appbar`.

### Cadena loadScript (`js/main-entry.js:54-67` original)

Cadena lineal terminaba en `live-sync.js` → `.then(() => { /* safety net */ })`.

Post-F7.4-A: 4 nuevos `.then(() => loadScript(...))` insertados entre `live-sync.js` y el bloque safety-net (icons → bottom-tab → app-header → shell).

### Head HTML (`index.html:47-54` original)

7 `<link rel="stylesheet">` (base, welcome, ko, admin, bracket-results, boost, directo) seguidos de `</head>`.

Post-F7.4-A: 3 `<link>` adicionales antes de `</head>` (tokens.css, bottom-tab.css, app-header.css), comentario `<!-- App Shell CSS (F7.4) -->` separador.

### Body inicio (`index.html:55-56` original)

`<body>` directo seguido del comentario `<!-- ═══ SPLASH SCREEN ═══ -->`.

Post-F7.4-A: 2 mount points entre body y splash:
```html
<div id="fc-header-mount" hidden></div>
<div id="fc-tabbar-mount" hidden></div>
```

---

## 6 · Riesgos detectados (R1–R6, todos resueltos en F7.4-A)

| ID | Riesgo | Mitigación implementada (file:linea) |
|---|---|---|
| **R1** | `window.splashDone` es función, no boolean. Shell necesita gate boolean explícito. | `index.html:106` (skip path) + `index.html:127` (hideSplash) — `window._splashHidden = true;` añadido en ambos. Consumido por `public/js/shell.js:3` (`if (!window._splashHidden) return;`). |
| **R2** | VALID_PAGES en 4 sitios divergentes (`main-entry.js:9` + `index.html:38` + `index.html:92-141` + `ui-nav.js`). | F7.4-A: documentado, no tocado. **Pendiente F7.4-B**: unificar + añadir 'perfil'. |
| **R3** | `_gruposInited` boolean lazy-init en `ui-nav.js:499`. Si F7.4-B mountea al re-entrar, riesgo de re-init. | F7.4-A: documentado. **Pendiente F7.4-B**: migrar a Promise singleton. |
| **R4** | MutationObserver en `scoring.js:588-600` observa `#page-grupos` con `subtree:true`. Bottom-tab y app-header viven fuera de pages pero arquitectónicamente seguro añadir guard defensivo. | `public/js/scoring.js:589` — callback acepta `mutations` y short-circuita si todas las mutations están dentro de `.fc-tabbar` o `.fc-appbar`. |
| **R5** | `renderAuthBar` escribe en `#wc-auth-bar` + `#grupos-user-bar` + `#elim-user-bar` (`auth.js:217-236`). | F7.4-A: documentado. **Pendiente F7.4-E**: simplificar a un único target en header global. |
| **R6** | Carpetas `public/css/components/` y `public/js/components/` no existen. | F7.4-A: creadas en commit `dffd1ae`. 7 ficheros nuevos dentro. |

---

## 7 · Pendientes para F7.4-B / C / D / E (out of scope F7.4-A)

| Fase | Estado | Alcance | Ficheros |
|---|---|---|---|
| **F7.4-B** | ✅ **Cerrada** · PR #29 · commits `a5232cf` + `521991f` (27 abr 2026) | Conexión `showPage` → `fcShellApply` → toggle `body.fc-shell-active` + mount idempotente bottom-tab. `_gruposInited` → Promise singleton (R3). `'perfil'` añadido a VALID_PAGES en los 4 sitios divergentes (R2). Rename label `Quiniela` → `Fase final`. | `public/js/shell.js`, `public/js/components/bottom-tab.js`, `public/js/ui-nav.js`, `js/main-entry.js`, `index.html` (×2), `public/css/components/bottom-tab.css`. |
| **F7.4-C** | ✅ **Cerrada** · PR #30 · commits `6925ada` + `876ec5d` · merge `a021e71` (27 abr 2026) | Migración `.adm-header`/`.sb-header`/`.global-header` → `.fc-appbar.fc-appbar--page`. Sweep central icono back en `shell.js` (estrategia α). Franja transitoria `.elim-pts-strip` con "Mis puntos" + botón "🏆 Clasificación" (autorretirada en F7.4-E). Eliminados `#score-user-bar`, `#elim-user-bar`, subtítulos redundantes. Badge ADMIN en slot `.fc-appbar__actions` (fix `876ec5d` post-smoke 375px overflow). `renderAppHeader()` no activado (queda no-op stub para F7.4-E). | `index.html` (3 headers), `public/js/shell.js` (sweep), `public/js/ui-nav.js` (purga score-user-bar + sb-back-label), `public/css/admin.css` (purga selectores), `public/css/ko.css` (purga + franja), `docs/restyling-mobile/01-headers.md` (nuevo). |
| **F7.4-D-1** | ✅ **Cerrada** · PR #31 · commit `7619eca` · merge `cbc52e4` (27 abr 2026; merge commit incompleto — docs end-of-session recuperados en PR #34) | Pages dedicadas Jornada/Directo/Predictor + cleanup. `setVistaGrupos`/`_vistaActual` eliminados (no wrapper); `window._currentPage` expuesta por `showPage`. Alias `quiniela`→`elim` limpiado en `_tabDefs`, `fcMarkActiveTab` (sin ternario) e `icons.js` case. Gate Fase final con `window._gruposComplete` + modal global `#fc-gate-modal` (pivot R-6: `#modal` interno a page-elim no funcionaba). `boost-ticker` movido a `#page-jornada` (R-3 documentado). 3 bugs preexistentes detectados durante smoke (ERR-30/31/32) — verificados pre-existentes, NO arreglados en este PR. ERR-30 ✅ FIXED en PR #32, ERR-32 ✅ FIXED en PR #33; ERR-31 documentado pendiente. | `index.html`, `js/main-entry.js`, `public/js/ui-nav.js`, `public/js/ui-groups.js`, `public/js/ui-directo.js`, `public/js/ui-groups-mobile.js`, `public/js/components/bottom-tab.js`, `public/js/components/icons.js`, `public/js/shell.js`, `public/css/base.css`, `public/css/directo.css`, `public/css/components/app-header.css`. |
| **F7.4-D-2** | Pendiente | Predictor IA: widgets dentro de `#page-predictor`. Decisiones producto Pred-1..6 pendientes. | `public/js/components/predictor.js` (nuevo), `public/css/components/predictor.css` (nuevo), `index.html` (relleno de `#page-predictor`). |
| **F7.4-D (legacy banner+btn)** | Pendiente — limpieza fina | Eliminar `#cta-eliminatorias` banner inferior de page-grupos y `#btn-go-eliminatorias` legacy (ambos redundantes con tab Fase final + gate modal). Limpiar `setView` de page-elim y los `view-tabs` (3 botones internos `📋 Rondas / 📊 Resultados / 🏟️ Cuadro`). | `index.html`, `public/js/ui-groups.js` (limpieza `checkGroupsComplete`), `public/js/ui-nav.js` (`setView`). Probable acoplado a F7.4-F. |
| **F7.4-E** | Pendiente | Crear page-perfil (P10). Simplificar `renderAuthBar` para escribir solo en header global (R5). Implementar D5 (avatar + puntos + #posición), D6 (Clasificación como sub-vista con bottom-tab oculto), D7 (inline solo welcome hero). | `index.html` (page-perfil HTML), `public/js/auth.js` (`renderAuthBar`), `public/js/shell.js` (toggle off `body.fc-shell-active` durante page-score si origen=perfil), `public/css/components/app-header.css` (refinar D5). |

**Orden no-negociable**: F7.4-B (conexión) ✅ desbloquea F7.4-C/D/E. F7.4-C y F7.4-D pueden paralelizarse si la separación de scope es nítida; F7.4-E va al final por dependencia de D5/D6.

### F7.4-D-1 · DoD verificada

**Programático:**
- [x] `node --check` OK en los 7 JS tocados (ui-nav, ui-groups, ui-directo, ui-groups-mobile, bottom-tab, icons, shell).
- [x] `npm run build` OK (200ms).
- [x] `setVistaGrupos`/`_vistaActual`/`btn-vista-*` ausentes en código funcional (solo comentarios F7.4-D-1).
- [x] VALID_PAGES en 3 sitios canónicos contiene los 8 elementos (grupos, elim, score, admin, perfil, jornada, directo, predictor).
- [x] `dist/index.html`: 4 markers (`page-jornada`, `page-directo`, `page-predictor`, `fc-gate-modal`).
- [x] `dist/js/components/bottom-tab.js`: `'elim'` presente, 0 `'quiniela'`.
- [x] `dist/js/shell.js`: `SHELL_PAGES` con 5 elementos.
- [x] `dist/css/base.css` y `directo.css`: 0 reglas `display:none` zombie.

**Funcional (smoke San localhost:5173, mobile 375px):**
- [x] Click 5 tabs → page correspondiente + bottom-tab marca activa.
- [x] Gate Fase final con grupos incompletos → modal `#fc-gate-modal` centrado, no navega, botón "Entendido" cierra.
- [x] Re-entrada Grupos no re-invoca `initGrupos` (Promise singleton F7.4-B intacto).
- [x] Recarga con `localStorage.porra_lastPage = 'jornada'`/`'predictor'` → restaura.
- [x] `tickerBoostToggle` en page-jornada re-renderiza al togglear boost.
- [x] Hook `closeMobileFocus` funciona al navegar fuera de page-grupos.
- [x] Sin regresiones en welcome, score (botón volver), admin, modal login.
- [x] Console limpia salvo `console.debug` esperados.

**Bugs preexistentes detectados (ERR-30/31/32, NO en scope F7.4-D-1):** verificados pre-existentes (scoring.js MD5 idéntico main vs F7.4-D-1, `lockCardsInFocus` callsites iguales, reproducidos en producción). Documentados en `errores_conocidos_porra.md`. **ERR-30 ✅ FIXED en mini-PR #32** (`1a7a9b9` · `unlockCardsInFocus` + `delete groupSaved` en handler `btn-undo`). **ERR-32 ✅ FIXED en mini-PR #33** (`13f4ecd` reconciliación chk + classes con `boostPicks` en `refreshBoostRowsInFocus` + `9c4bc04` follow-up `setTimeout(refreshBoostRowsInFocus, 0)` para click directo en input nativo). **ERR-31 documentado pendiente** (cosmético, btnRow residual tras Deshacer).

### F7.4-C · DoD verificada

- [x] Mobile 375px iPhone — los 3 headers se ven con `.fc-appbar` (back-btn 36×36 con SVG flecha izquierda, título centrado, sin user-bar en Clasificación, badge ADMIN inline en `.fc-appbar__actions` tras fix `876ec5d`).
- [x] Click back en Clasificación vuelve a la página de origen (Grupos o Eliminatorias según `window._sbPrevPage`).
- [x] Click back en Eliminatorias vuelve a Grupos. Click back en Admin vuelve a Grupos.
- [x] Franja `.elim-pts-strip` debajo del header de Eliminatorias visible; contador `#total-ko-pts` se actualiza con `updateKOPts()` (id estable conservado — divergencia 1).
- [x] Botón "🏆 Clasificación" en franja navega a `#page-score` (1 tap, sin regresión vs F7.4-B).
- [x] Bottom-tab sigue funcionando como F7.4-B (visible en Grupos+Elim, oculto en Score/Admin).
- [x] Console limpia salvo `console.debug` esperados del shell.
- [x] Sin regresiones: welcome (auth bar), login modal, navegación a/desde Score, Admin, Directo, Predictor IA tooltip.
- [x] `node --check` OK en `public/js/shell.js` y `public/js/ui-nav.js`. `npm run build` OK.
- [x] `dist/css/components/app-header.css` contiene `.fc-appbar--page`. `dist/css/ko.css` contiene `.elim-pts-strip`. `dist/js/shell.js` contiene `fcAppbarFillBackIcons`. 0 reglas CSS reales `.global-header`/`.gh-*`/`.adm-header`/`.sb-header`/`.sb-back-btn` en `dist/`.
- [x] Smoke San OK + fix post-smoke `876ec5d` para badge ADMIN overflow (medición San: `badgeRight=335.28` vs `headerRight=328` con viewport 375px → reubicación al slot `__actions`, sin cambios CSS).

### F7.4-B · DoD verificada

- [x] Mobile 375px — bottom-tab visible en grupos + elim, oculta en welcome/admin/score (smoke San).
- [x] Tab Grupos → navega a grupos, marcado activo. Tab Fase final → navega a elim, marcado activo (alias `elim → quiniela`).
- [x] Tabs Jornada / Directo / Predictor → no-op + `console.debug "[shell] tab \"X\" sin route — pendiente F7.4-D"`.
- [x] Re-entrada Grupos no re-invoca `initGrupos` (Promise singleton `_gruposInitPromise`).
- [x] Console limpia: solo `console.debug` esperados.
- [x] Sin regresiones en welcome auth bar, login modal, score (botón volver), admin, directo.
- [x] `node --check` OK en `shell.js`, `bottom-tab.js`, `ui-nav.js`. `npm run build` OK. `body.fc-shell-active` presente en `dist/css/components/bottom-tab.css:81,86`. `fcShellApply` en `dist/js/shell.js` y `dist/js/ui-nav.js`.
- [x] **GAP simulacro**: registrado fuera de scope F7.4-B, se aborda al reactivar el flujo de simulacro live.

---

## 8 · Cierre

F7.4-A es el único PR del bloque shell que entra en main sin un solo cambio visual. Las 4 fases siguientes consumirán esta infraestructura. El esqueleto inerte cumple su función: cero riesgo, máxima preparación.

- **Commit**: `dffd1ae` (PR #28).
- **Merge a main**: `0ddc6dc` (26 abr 2026).
- **Branch borrada**: `claude/redesign-porramundial-app-xrKzB` auto-deleted post-squash.
- **QA programático**: 12/12 puntos DoD OK.
- **QA visual**: smoke OK (sin regresiones en welcome, grupos, elim, score, admin, directo).

Documento sellado. Próxima sesión arranca F7.4-B con brief inline.
