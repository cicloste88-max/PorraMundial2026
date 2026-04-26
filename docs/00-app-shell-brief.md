# F7.4 · P0 App Shell — Brief para Code

> **Ubicación destino en repo**: `docs/restyling-mobile/00-app-shell-brief.md`
> **Hub padre**: `docs/restyling-mobile.md`
> **Última actualización**: 26-abr-2026 — post-challenge Code + decisiones D1-D4
> **Estado**: 🟡 Activa · branch a crear `feat/restyling-00-app-shell`
> **Modo de uso**: Code debe leer este fichero en `/plan` antes de cualquier acción. NO arranca implementación hasta que San apruebe el plan que Code derive de aquí.

---

## 0 · TL;DR

Implementar el App Shell del rediseño mobile en **5 PRs incrementales** (F7.4-A a F7.4-E), cada uno mergeable y con rollback granular. Bottom-tab persistente de 5 tabs (Grupos / Jornada / Directo / Predictor / Perfil), header reusable con 3 variantes, header global mínimo (nombre liga + puntos + posición), consolidación de Auth/Ligas/Clasificación/Admin bajo Perfil.

**Reglas de oro inviolables**:
- Plan siempre primero (`/plan`), implementación solo tras aprobación de San.
- Una pantalla = una branch = un PR. Tras merge: borrar local + remoto.
- Push tras cada commit. No acumular.
- No pisar zonas frágiles documentadas (CLAUDE.md HOT + `.claude/rules/`).

---

## 1 · Contexto

### 1.1 Estado del repo
- Main HEAD: `3ea205e` (post-merge F7.1-F7.3, P1 grupos animadas cerrada).
- Hub del proyecto: `docs/restyling-mobile.md` en main.
- Issues abiertos relevantes: #6 (parpadeo submit), #11 (mobile bracket), #23 (canvas mobile-focus). NO se resuelven en P0; quedan para sus pantallas correspondientes.

### 1.2 Origen del diseño objetivo
- Bundle Design System v2 (no parte del repo, vive en chats Claude.ai).
- Componentes reusables ya existen en el bundle:
  - `BottomTabs` → `app/screens/screens-v1.jsx:459-477`
  - `Icon` (17 SVGs) → `app/components/atoms.jsx:24-46`
  - Tokens base → `app/design-tokens.css:9-40`
  - CSS tabbar → `app/design-tokens.css:92-115`
  - CSS screen root → `app/design-tokens.css:52-67`

### 1.3 Decisiones cerradas (Bloque A + D1-D4)
| ID | Decisión | Resolución |
|---|---|---|
| A1 | Routing del bottom nav | State interno + `localStorage` (`porra_lastPage` ya existe). NO tocar URL. |
| A2 | P10 Perfil sin diseño v2 | Diseño interno scope mínimo (cuenta + ligas + clasif + admin si aplica). |
| A3 | Auth/Ligas/Clasificación | Consolidados bajo P10 Perfil. |
| A4 | Admin (`#page-admin`) | Sub-vista visible desde Perfil solo si `is_admin`. |
| A5 | Header | Componente reusable con **3 variantes** + inline solo para 1 caso justificado (welcome hero). |
| A6 | `#wc-auth-bar` | Se reduce a header global mínimo: **nombre liga · puntos · posición ranking**. Resto migra a Perfil. |
| D1 | CLASIF dentro de Perfil | Confirmado. Mitigación: posición ranking visible en header global tap → Perfil/Clasif. |
| D2 | Contenido header global | "Liga X · 2,847 pts · #4" |
| D3 | `_gruposInited` migración | Promise singleton (`_gruposInitPromise = _gruposInitPromise \|\| initGrupos()`) |
| D4 | Audit del zip | Hecho por Claude.ai. Ver §6 anexo. |

---

## 2 · Hallazgos del challenge (Code, 26-abr-2026)

Estos hallazgos modifican el plan. Code los detectó leyendo el repo real. **Code los conoce**, pero los re-listo aquí para que el plan los integre explícitamente.

### 2.1 Riesgos críticos no mapeados originalmente

| ID | Riesgo | File:linea | Mitigación |
|---|---|---|---|
| R1 | Triple capa restore-lock-css vs splash. Bottom-tab puede aparecer sobre splash o sobre welcome bloqueado durante 100-700ms del race | `index.html:36-46`, `:92-141`, `js/ui-nav.js:501-505` | `fcShellApply` debe esperar `window.splashDone === true` antes de montar. F7.4-A. |
| R2 | `VALID_PAGES` hardcoded en 3 sitios | `index.html:38`, `js/main-entry.js:9`, implícito en `js/ui-nav.js:520-524` | Añadir `'perfil'` sincrónico en los 3. F7.4-B. |
| R3 | `_gruposInited` flag de un solo disparo | `js/ui-nav.js:499` | Promise singleton (D3). F7.4-B. |

### 2.2 Conflictos con código actual

**Bloqueantes** (resolver en P0):

| Archivo | Problema | Acción |
|---|---|---|
| `js/scoring.js:588-600` | `MutationObserver` con `subtree:true, attributeFilter:['class']` sobre `#page-grupos`. Si bottom-tab vive **dentro** de page-grupos, dispara false-positives de boost detection | Bottom-tab vive **fuera** de las pages (singleton hijo de `<body>`). Guard explícito en el observer: `if (target.classList.contains('fc-tabbar') \|\| target.closest('.fc-tabbar')) return;`. F7.4-A. |
| `js/auth.js:217` `renderAuthBar()` | Inyecta innerHTML completo (avatar + nombre + logout + flecha login) en `#wc-auth-bar`. Reducirlo rompe función | Refactor en dos: `renderAuthHeader()` (logo+puntos+pos para header global) y `renderPerfilHeader()` (avatar+nombre+logout para Perfil). F7.4-E. |
| `js/auth.js:241` listener `.do-logout` | Delegación global, sigue funcionando aunque botón se mueva | OK, no requiere cambio salvo que se mueva el handler junto al botón |
| Splash inline `index.html:57-91` + hard-cap 10.2s `:132` + min 7s `:130` | `fcShellApply` debe respetar el min/max del splash | Flag `window.splashDone = true` se setea cuando splash hace `splash.parentNode.removeChild`. F7.4-A. |

**No bloqueantes** (documentar en pantalla correspondiente cuando toque):
- `js/scoring.js:963-965` scroll listener IA tooltip — podría romperse si bottom-tab cambia overflow body. → Verificar en QA P5 (Predictor).
- `js/ui-nav.js:607` resize listener wcSizeRow2 — cosmético en welcome.
- `js/misc.js:36` resize listener applyFinalSectionMobile — cosmético.
- `js/ko.js:1121-1124` drag-scroll horizontal — bottom-tab fixed reduce altura disponible pero no rompe. → Verificar en QA P6/P7/P8.

### 2.3 Inventario código muerto post-shell

Total identificado por Code: **~150-200 líneas HTML + ~80 JS** a eliminar. Tabla completa por PR:

| Componente | File:linea | Estado tras shell | Acción | PR |
|---|---|---|---|---|
| `view-tabs` page-elim (Rondas/Resultados/Cuadro) | `index.html:678-681` | Sub-modos del tab QUINIELA accesibles vía stage-tabs | Eliminar HTML + CSS `css/ko.css:70-82` y `:772-784` (duplicado) | F7.4-D |
| `setView()` | `js/ui-nav.js:415-418` | Código muerto | Eliminar | F7.4-D |
| `btn-vista-grupos/jornada/directo` | `index.html:553-565` | Cada vista pasa a tab top-level | Eliminar HTML | F7.4-D |
| `setVistaGrupos()` | `js/ui-groups.js:442` | Código muerto | Eliminar | F7.4-D |
| Override en `ui-directo.js` (lee IDs btn-vista-*) | `js/ui-directo.js:132-176` | Código muerto | Eliminar o refactor | F7.4-D |
| `#global-header` inline page-grupos | `index.html:512-550` | Reemplazado por header reusable | Eliminar inline | F7.4-C |
| 3 botones del header inline (← Inicio, Eliminatorias, Score) | `index.html` dentro de `:512-550` | Reemplazados por bottom-tab | Eliminar | F7.4-C |
| `.global-header` inline page-elim | `index.html:650-676` | Reemplazado por header reusable | Eliminar inline | F7.4-C |
| `.sb-header` page-score | `css/admin.css:89` y `:643` (duplicado) | Reemplazado por header reusable | Migrar a componente | F7.4-C |
| `.adm-header` page-admin | (existing) | Mantener (admin queda fuera del bottom-tab, accede desde Perfil) | Solo back-button funcional a Perfil | F7.4-E |
| `wc-auth-bar` HTML | `index.html:154` (singleton vacío) | Header global mínimo | Mantener pero `renderAuthBar` simplificado | F7.4-E |
| `score-user-bar` clone | `js/ui-nav.js:529-533` | Innecesario si CLASIF tiene header propio | Eliminar bloque | F7.4-E |
| Botón ← Volver page-score + lógica `_sbPrevPage` | `index.html:202` + lógica asociada | Reemplazado por bottom-tab tap | Eliminar | F7.4-E |

---

## 3 · Plan F7.4 — 5 PRs

### F7.4-A · Esqueleto inerte

**Scope**: Crear todos los componentes nuevos pero **sin conectarlos** a `showPage`. Visualmente la app es idéntica.

**Archivos nuevos**:
- `public/css/components/bottom-tab.css` (basado en `app/design-tokens.css:92-115` del bundle)
- `public/css/components/app-header.css`
- `public/js/components/bottom-tab.js` (basado en `BottomTabs` de `app/screens/screens-v1.jsx:459-477`)
- `public/js/components/app-header.js`
- `public/js/components/icons.js` (basado en `Icon` de `app/components/atoms.jsx:24-46`, los 17 SVGs)
- `public/js/shell.js` con `fcShellApply` no-op (solo console.log)

**Archivos modificados**:
- `index.html`:
  - +`<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">` (si no existe).
  - +Mount points para bottom-tab (singleton fuera de pages, hijo directo de `<body>`).
  - +`<link>` y `<script>` de los nuevos archivos.
  - +Tokens nuevos en `:root` de `css/base.css`: `--fc-safe-top: env(safe-area-inset-top)`, `--fc-safe-bot: env(safe-area-inset-bottom)`, `--fc-tab-height: 78px`.

**Guards explícitos** (CRÍTICO):
- `fcShellApply` espera `window.splashDone === true` antes de montar (R1). Sin flag, NO monta.
- `js/scoring.js:588-600` MutationObserver: añadir guard `if (target.classList?.contains('fc-tabbar') \|\| target.closest?.('.fc-tabbar')) return;` al inicio del callback.

**DoD F7.4-A**:
- [ ] App idéntica visualmente a antes del PR.
- [ ] `console.log` desde `fcShellApply` confirma que se llama pero no monta (porque shell-active flag está off).
- [ ] No hay errores en console.
- [ ] No hay regresiones en P1 grupos animadas.
- [ ] Splash cuenta hasta 7s mínimo, 10.2s máximo (sin cambios).
- [ ] `git diff --stat` muestra solo archivos nuevos + líneas añadidas en index.html. No hay líneas eliminadas.

### F7.4-B · Conexión + auth gate

**Scope**: Activar el shell. Bottom-tab visible en `grupos/elim/score`, tap navega vía `showPage` existente.

**Archivos modificados**:
- `js/ui-nav.js`:
  - +1 línea en `showPage()` (~`:550`): `fcShellApply(page);`
  - Migrar `_gruposInited` a Promise singleton (R3 / D3).
- `js/auth.js`: +1 línea en `:416` y `:426` (login/logout llaman a `fcShellApply`).
- `js/main-entry.js:9`: +`'perfil'` en `VALID_PAGES`.
- `index.html:38`: +`'perfil'` en lista whitelist del bootstrap inline.
- `css/welcome.css`: media queries afectadas → guard con `:not(.fc-shell-active)` para no aplicar margen negativo cuando shell está activo.
- `js/shell.js`: implementar `fcShellApply` real:
  - Coordina splash via `window.splashDone` flag (R1).
  - Toggle `body.fc-shell-active` class.
  - Active tab según `page` argumento.
  - Hide en `welcome` y durante splash.

**Guards adicionales**:
- Body `padding-bottom: var(--fc-tab-height)` solo cuando `body.fc-shell-active`.
- z-index bottom-tab: `< 200` (respeta auth-modal z:999 y wc-auth-bar z:200 — aunque auth-bar va a desaparecer en F7.4-E, durante B-D coexisten).

**DoD F7.4-B**:
- [ ] Login → bottom-tab aparece. Logout → desaparece.
- [ ] Tap en cada tab → page correcta.
- [ ] F5 con `porra_lastPage` setado → restaura page Y bottom-tab activa correcta.
- [ ] Mobile-focus se abre/cierra sin choque visual con bottom-tab.
- [ ] Console limpia.
- [ ] No regresiones en P1 grupos animadas (verificar group-layout grid `1fr 340px`).
- [ ] Tab Predictor todavía no implementado: tap muestra placeholder "próximamente" o no es tappable (Code decide cuál).

### F7.4-C · Headers reusables

**Scope**: Migrar 3 headers inline (grupos / elim / score) → componente `app-header.js` con 3 variantes.

**Archivos modificados**:
- `index.html`: eliminar las ~130 líneas inline de `:512-550` y `:650-676`.
- `css/admin.css`: eliminar `.sb-header` 2 ocurrencias (`:89` y `:643`).
- `css/ko.css`: eliminar `:70-82` y `:772-784` (preparación para F7.4-D que termina la limpieza).
- `js/components/app-header.js`: configuración per-page (variant, title, actions).
- `js/ui-nav.js`: `showPage` ahora también llama a `appHeaderApply(page)`.

**3 variantes del header**:
- `back-title-action` — back button izq + título centro + 1 icon dcha (usado en grupos detalle, elim detalle).
- `eyebrow-nav` — eyebrow izq + nav arrows + label dcha (usado en jornada, KO).
- `tabs` — back izq + 3 sub-tabs centro (KO sub-vistas).

**Inline permitido**: solo welcome hero (decisión A5). Si Code detecta otro caso "raro", marcar como blocker y consultar a San.

**DoD F7.4-C**:
- [ ] Visual parity con anterior. Headers idénticos en estructura.
- [ ] `git diff --stat` muestra reducción neta de líneas (~130 eliminadas vs nuevo componente ~80 líneas).
- [ ] No console errors.
- [ ] Mobile + desktop OK.

### F7.4-D · Eliminación sub-tabs internas

**Scope**: Las sub-tabs `view-tabs` (page-elim) y `btn-vista-*` (page-grupos) desaparecen — sus 3 vistas pasan a tabs top-level del bottom-tab.

**Archivos modificados**:
- `index.html`: eliminar `:553-565` (btn-vista-grupos/jornada/directo) y `:678-681` (view-tabs page-elim) ~50 líneas.
- `js/ui-nav.js:415-418`: eliminar `setView()`.
- `js/ui-groups.js:442-462`: eliminar `setVistaGrupos()`.
- `js/ui-directo.js:132-176`: eliminar override que lee btn-vista-* IDs.

**Decisión técnica para Code**: el bottom-tab debe distinguir "Grupos / Jornada / Directo" como pages distintas. ¿Tres pages reales (`page-grupos`, `page-jornada`, `page-directo`) o una page con state interno? **Recomendación inicial**: state interno en el componente `app-header`, una única page `page-grupos` que muestra una de 3 vistas según state. Justifica si Code propone otra cosa.

**DoD F7.4-D**:
- [ ] Navegación entre Grupos/Jornada/Directo solo vía bottom-tab.
- [ ] Funcionalidad existente preservada: ticker boost jornada, dice-global-bar, jornada-user-strip, directo-container.
- [ ] Sub-tabs internas KO (cinematic / bracket-results / stadium) **se conservan** — son sub-vistas del mismo dato KO.
- [ ] No regresiones en submit predicciones (issue #6 NO se resuelve aquí — queda para P2).

### F7.4-E · P10 Perfil + cleanup wc-auth-bar

**Scope**: Crear `#page-perfil`, mover panel-ligas + logout + admin-link, simplificar `renderAuthBar`, eliminar `score-user-bar` clone.

**Archivos modificados**:
- `index.html`:
  - +Nueva sección `#page-perfil` (HTML básico con secciones Cuenta / Ligas / Clasificación / Admin).
  - Eliminar botón `← Volver` de page-score (`:202`).
- `js/auth.js:217`: simplificar `renderAuthBar` → solo logo liga + puntos + pos. Crear `renderPerfilHeader` para avatar+nombre+logout.
- `js/ui-nav.js:529-533`: eliminar bloque `score-user-bar` clone.
- `js/leagues.js`: re-anchor del panel hacia `#page-perfil`.
- `js/components/app-header.js`: añadir variante para perfil si es necesaria.

**Header global mínimo** (D2):
- Contenido: `<nombre_liga> · <puntos> pts · #<posición>` (texto, no logo).
- Posición clickable → navega a Perfil → sub-sección Clasificación.
- Si user no tiene liga activa: header oculto.

**Sub-vistas de Perfil** (scope mínimo D1+A4):
- **Cuenta**: avatar + nombre + email + cambiar password (link, no inline).
- **Ligas**: panel actual de ligas (crear / unirse / cambiar liga activa).
- **Clasificación**: el contenido actual de page-score (podio + tabla + my-desglose).
- **Admin**: solo si `is_admin === true`. Link a page-admin.

**DoD F7.4-E**:
- [ ] Perfil tab funcional desde el bottom-tab.
- [ ] Logout funciona desde Perfil. `renderAuthBar` simplificado funciona en login/logout.
- [ ] Cambiar liga activa desde Perfil → todas las pantallas reflejan la nueva.
- [ ] Tap en posición ranking del header global → navega a Perfil → Clasificación.
- [ ] Admin link visible solo si user es admin (verificar con `checkIsAdmin()` de `js/auth.js`).
- [ ] No regresiones en page-score embebido como sub-vista.
- [ ] No queda código de `score-user-bar` clone.

---

## 4 · Cómo trabajar con este brief

### 4.1 Para Code (planning mode)

Al recibir este fichero (path: `docs/restyling-mobile/00-app-shell-brief.md`):

1. **Lee también** `docs/restyling-mobile.md` (hub padre) y `CLAUDE.md` (HOT).
2. **NO empieces a editar**. Modo `/plan` exclusivamente.
3. **Produce un plan** en markdown que cubra:
   - Confirmación de que entiendes los 5 PRs y sus DoDs.
   - Ficheros exactos que vas a tocar en F7.4-A (primer PR).
   - Snippets de antes/después de los cambios críticos (al menos R1, R2, R3 y el guard del MutationObserver).
   - Riesgos adicionales que detectes ahora que tienes este brief consolidado.
   - Estimación de tamaño del PR F7.4-A en líneas.
4. **Espera aprobación de San** antes de implementar.
5. **Tras aprobación**: crea branch `feat/restyling-00-app-shell`, ejecuta F7.4-A, commit + push inmediato, abre PR.
6. **Subagentes Haiku**: si los usas para tareas mecánicas (renombrar selectores, copiar SVGs), pasa contexto inline — NO heredan este brief.
7. **No alteres** zonas marcadas como NO TOCAR en `.claude/rules/`.

### 4.2 Para Claude.ai (supervisión)

- A6 QA Chrome MCP tras cada PR mergeado.
- Verificar `git diff --stat HEAD` antes de cada commit (detectar cambios autónomos).
- Mantener `migration-log.md` actualizado tras cada push de Code.
- Si el plan derivado por Code se desvía de este brief: PARAR, refrescar plan, volver a aprobar.

### 4.3 Para San (gates humanos)

- Aprobar el plan derivado tras `/plan`.
- Hard-merge en GitHub UI tras QA OK (Claude.ai no puede mergear).
- Borrar branch local + remota tras merge.
- Tras F7.4-E mergeada: cierre de P0. Empezar P2 (Jornada).

---

## 5 · Referencias indexadas

### 5.1 Bundle Design System v2 (NO en repo, solo referencia)

| Concepto | Path en bundle | Líneas |
|---|---|---|
| `BottomTabs` | `app/screens/screens-v1.jsx` | 459–477 |
| `Icon` (17 SVGs) | `app/components/atoms.jsx` | 24–46 |
| Tokens base (--ink-, --fifa-, --font-) | `app/design-tokens.css` | 9–40 |
| `.fc-screen` root | `app/design-tokens.css` | 52–67 |
| `.fc-tabbar` + `.fc-tab` | `app/design-tokens.css` | 92–115 |
| `.fc-appbar` (definido pero NO usado) | `app/design-tokens.css` | 117–130 |
| `.fc-eyebrow` | `app/design-tokens.css` | 72–77 |
| `.fc-display`, `.fc-num` | `app/design-tokens.css` | 69–70 |

### 5.2 Producción actual (paths reales)

| Concepto | Path | Líneas |
|---|---|---|
| Bootstrap inline restore-lock | `index.html` | 36–46, 92–141 |
| Splash inline | `index.html` | 57–91 |
| Splash hard-cap 10.2s | `index.html` | 132 |
| Splash min 7s | `index.html` | 130 |
| `wc-auth-bar` HTML | `index.html` | 154 |
| `#page-score` | `index.html` | 8659+ |
| `#page-grupos` | `index.html` | 29584+ |
| `#global-header` inline grupos | `index.html` | 512–550 |
| Buttons btn-vista-* | `index.html` | 553–565 |
| `.global-header` inline elim | `index.html` | 650–676 |
| `view-tabs` page-elim | `index.html` | 678–681 |
| Botón ← Volver page-score | `index.html` | 202 |
| `#page-admin` | `index.html` | 47555+ |
| `VALID_PAGES` (3 sitios) | `index.html:38`, `js/main-entry.js:9`, `js/ui-nav.js:520-524` | — |
| `setView()` | `js/ui-nav.js` | 415–418 |
| `_gruposInited` | `js/ui-nav.js` | 499 |
| Restore-lock | `js/ui-nav.js` | 501–505 |
| `showPage` body | `js/ui-nav.js` | 520–550 |
| `score-user-bar` clone | `js/ui-nav.js` | 529–533 |
| `wcSizeRow2` resize listener | `js/ui-nav.js` | 607 |
| `setVistaGrupos()` | `js/ui-groups.js` | 442–462 |
| Override btn-vista-* | `js/ui-directo.js` | 132–176 |
| `renderAuthBar()` | `js/auth.js` | 217 |
| `.do-logout` listener delegado | `js/auth.js` | 241 |
| Login/logout llaman `renderAuthBar` | `js/auth.js` | 416, 426 |
| `MutationObserver` boost detection | `js/scoring.js` | 588–600 |
| Scroll listener IA tooltip | `js/scoring.js` | 963–965 |
| `applyFinalSectionMobile` resize | `js/misc.js` | 36 |
| KO drag-scroll | `js/ko.js` | 1121–1124 |
| `.sb-header` (duplicado) | `css/admin.css` | 89, 643 |
| `.view-tabs` KO (duplicado) | `css/ko.css` | 70–82, 772–784 |
| `wc-auth-bar` z:200 sticky | `css/welcome.css` | 92, 200 |
| `auth-overlay` z:999 | `css/welcome.css` | 69 |

### 5.3 Decisiones / docs internos

- **Hub padre**: `docs/restyling-mobile.md`
- **Reglas de PR**: hub §3 + `CLAUDE.md` HOT
- **Subagentes Haiku no heredan rules**: hub §10 + ERR-relacionados
- **Errores conocidos**: `errores_conocidos_porra.md` ERR-01..29

---

## 6 · Anexo · Audit del bundle v2

Revisado por Claude.ai sobre `/Design_System.zip` extraído.

### 6.1 Animaciones del bundle

- `ScreenGrupos` aplica `animateIn delay={i*120}` a cada `GroupPredictionCard`. **Decisión**: NO portar animaciones de entrada a producción en P0. Quedan para cada pantalla individual cuando toque (P1 ya cerrada sin animaciones; mantener).
- `BottomTabs`: sin animación de entrada definida en el bundle. Aparece estático.
- Active state del tab: solo cambio de color, sin transición CSS explícita en el bundle. **Decisión**: añadir `transition: color 0.15s ease` en producción para suavizar.

### 6.2 Loading / error states

- El bundle no define loading skeleton ni error states para el shell. Solo para tarjetas individuales.
- **Decisión**: shell siempre visible cuando `splashDone === true && user logged in`. No hay estados intermedios.

### 6.3 Emojis legacy vs SVGs

- Producción usa emojis (🏆 ⚽ 🔥 🎲 🏟️ 📅 🔴) en buttons del header inline y view-tabs.
- Bundle usa SVGs (17 iconos en `Icon` component).
- **Decisión**: en P0, los SVGs se usan **solo en bottom-tab y header reusable**. Los emojis del contenido de pages (badges, indicadores en cards) se conservan tal cual. Esto evita re-tocar P1 cerrada y minimiza scope de P0.

### 6.4 Tokens completos del bundle

Los 17 tokens del `:root` del bundle (`design-tokens.css:9-40`) que **podrían** entrar a producción:

```css
--fifa-red: #E30613;
--fifa-green: #006341;
--fifa-blue: #0A4595;
--fifa-gold: #C9A961;
--fifa-gold-deep: #9A7B3A;
--ink-900: #0A0E1A; --ink-800: #141826; --ink-700: #1F2433;
--ink-600: #2A3142; --ink-500: #4A5163; --ink-400: #7A8194;
--ink-300: #B8BEC9; --ink-200: #E2E5EB; --ink-100: #F2F4F8;
--ink-50:  #F8F9FB; --bg: #FFFFFF;
--live: #E30613; --win: #00834A; --draw: #B7860B; --loss: #6F1E22;
--font-display: "FWC 26", "Saira", "SF Pro Display", -apple-system, system-ui, sans-serif;
--font-text: "Noto Sans", "Inter", -apple-system, system-ui, sans-serif;
--font-numeric: "FWC 26", "Saira", "SF Mono", ui-monospace, monospace;
```

**Decisión**: producción ya tiene tokens consolidados en `:root` de `css/base.css` post-F7.0. **NO sobrescribir** `:root` de base.css. En F7.4-A solo añadir tokens **nuevos**: `--fc-safe-top`, `--fc-safe-bot`, `--fc-tab-height`. Si Code detecta tokens del bundle no presentes en base.css y necesarios para el shell, listarlos en su plan derivado para que San apruebe explícitamente.

### 6.5 `--font-display` en producción

Producción usa **Space Mono Bold** como sustituto OFL de FWC 26 (decisión P1). El bundle usa "FWC 26" como primario. **Importante para el shell**: el label del bottom-tab usa `--font-display` con `font-size: 10px` y `font-weight: 600`. Verificar que Space Mono Bold renderiza bien a ese tamaño. Si no: fallback a `--font-text` para labels del tab.

---

## 7 · Checklist final antes de arrancar Code

San debe confirmar antes de pasar este brief a Code:

- [x] Decisiones D1-D4 tomadas e integradas (§1.3).
- [x] Hallazgos del challenge integrados (§2).
- [x] Plan F7.4-A/B/C/D/E definido (§3).
- [x] Audit del bundle hecho (§6).
- [ ] Brief subido a `docs/restyling-mobile/00-app-shell-brief.md` en main.
- [ ] Code arranca con `/plan` y produce plan derivado para revisión.
- [ ] San aprueba plan derivado.
- [ ] Code crea branch `feat/restyling-00-app-shell` y ejecuta F7.4-A.

---

> **Nota final para Code**: Este brief es la fuente de verdad para P0. Si hay conflicto con CLAUDE.md o `.claude/rules/`, prevalecen estos últimos. Si detectas conflicto, márcalo en tu plan derivado y pregunta a San antes de proceder.
