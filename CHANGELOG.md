# CHANGELOG — Porra Mundial 2026

Retención 90d. Auto-archivado a `CHANGELOG-archive-YYYYMM.md` si supera 30KB.

## 2026-05-08 — Sprint Pizarra Táctica + Cuadro de Honor restore (rama `claude/pizarra-tactica-modal-kmTEw`)

4 commits sobre `claude/pizarra-tactica-modal-kmTEw` (base `f6847ab` post-merge globo). HEAD `533ec15`. **Lista para PR a `main`** (squash-merge desde GitHub UI). Sprint dual: (1) modal "Pizarra Táctica" con ficha visual de selección (escudo + 11 tokens en formación + stats) abierto desde el Globo y desde tarjetas de partido en Directo; (2) restauración del Cuadro de Honor (cajas Campeón + Podio) bajo la fila Final del nuevo `fc-elim-list` (huérfano tras la migración F7.4-F al App Shell — ERR-42).

### Commits del sprint (orden cronológico)

| SHA | Mensaje | Fase |
|---|---|---|
| `d34db7c` | feat: pizarra táctica modal con squads + EF get-squad | Base modal + 4 patches |
| `02aed94` | fix(pizarra): banda bandera 90→130px + título sobre fondo blanco | Hot-fix banda |
| `5a3ddde` | fix(pizarra): dark mode + tooltip tap + stats alineadas | Dark mode + tooltip |
| `533ec15` | feat(ko): restaurar Cuadro de Honor (cajas 2+3) bajo fila Final | Cuadro Honor restore |

### Funcionalidad nueva consolidada

**Pizarra Táctica modal** (`public/js/ui-pizarra-tactica.js` 540 LOC + `public/css/components/pizarra-tactica.css` 8.5 KB):
- Entry point único `window.openPizarraTactica({iso3 | iso2 | nameEn})`. Acepta los 3 identificadores (mapping interno `NAME_EN_TO_ISO3` con 48 selecciones para entrada desde Globo en inglés).
- 12 formaciones predefinidas con coordenadas % en `FORMATION_COORDS`: 4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 5-3-2, 4-1-4-1, 4-3-2-1, 3-4-3, 5-4-1, 4-4-1-1, 3-4-2-1, 4-1-3-2.
- Cache en memoria (`Map`) por iso3/iso2 — una sola request por selección por sesión.
- Auth: lee JWT de `window._porraToken` (publicado por `auth.js` en `SIGNED_IN`/`TOKEN_REFRESHED`) con fallback a `sessionStorage.porra_token`.
- UI: modal centrado mobile-first 380px, dark theme `#1f2937`, banda superior 130px con bandera + mask gradient destination-out fade 75%, escudo 80px con drop-shadow, tokens 11.5% width circulares con halo negro sólido (8px) en apellido, tres stats (edad media · valor plantilla · goles/partido) con icon button info que despliega tooltip oscuro con flecha (auto-cierra 4s, cierra al tap fuera).
- Render token: `j.dorsal` + `j.nombre.split(' ').slice(-1)[0]` (apellido); placeholder posicional si `nombre === '—'`. Color de ficha desde `team.color_ficha` (#fff blanco → border #1f2937; oscuro → border #fff). Portero usa `team.color_portero`.
- Hooks de entrada: `window._globoNavPlantilla` (botón "🏟 Ver plantilla" del panel detalle Globo) y listener delegado en `ui-directo.js` que captura clics en `.dv2-mini-flag-btn`/`.dv2-exp-flag-btn`.

**Cuadro de Honor (cajas 2+3 bajo fila Final)** (`public/js/ko.js` +133 LOC + `public/js/ui-elim-shell.js` +11 LOC):
- Nueva función pública `window.buildChampionPodium(matchFinal)` en `ko.js` justo antes de `buildFinalSection` (sin tocar la función original — sigue usándose en el legacy `#view-cinematic`). Devuelve un único bloque DOM con caja 2 (Campeón con gradient dorado + escudo + sub-banner "FIFA World Cup 2026" + dato de sede MetLife / placeholder "Pronostica la final…") y caja 3 (Podio 🥈/🥉/4️⃣ con escudos pequeños + nombres + labels de posición) apiladas mobile-first (column gap 12px).
- Hook en `ui-elim-shell.js#_renderList`: tras procesar la fila `r.key === 'final'` y el bloque expanded, invoca `window.buildChampionPodium(BRACKET.final[0])` y `appendChild` al mount, **siempre visible** (no condicional a `expanded` ni `locked`).
- Resolución de equipos vía `resolvedSlots[matchFinal.home/away]` + `koPredictions[matchFinal.id]`. Puesto 2 deducido del perdedor de la final; puestos 3/4 del partido `BRACKET.third[0]`. Empates: usa `classifier` si está presente.
- Premios (caja 4 awards) sigue intacto en `#fc-elim-awards-pane` y NO se duplica.

**Backend (ya en producción al iniciar el sprint, sin cambios desde Code en esta sesión):**
- Tabla `public.squads` (48 filas) con columnas `iso3`, `iso2`, `equipo`, `formacion`, `entrenador`, `stat_edad`, `stat_valor`, `stat_goles`, `color_ficha`, `color_portero`, `plantilla_completa`. Una fila por selección clasificada al Mundial 2026.
- Edge Function `get-squad` v4 ACTIVE (en `supabase/functions/get-squad/`). Acepta `?iso3=XXX` o `?iso2=XX`, devuelve `TeamData` listo para `loadTeam()` con `flag_url`, `badge_url`, jugadores serializados con dorsal/nombre/posición, stats agregados.
- Storage `miniatures/pizarra/campo.webp` (38 KB, fondo del campo de fútbol) + `miniatures/badges/{slug}.png` (43 archivos — faltan BIH/COD/CZE/IRQ/SWE) + `miniatures/flags/{ISO2}.png` (48) + `miniatures/flags-sm/{ISO2}.webp` (48 versión small 148× para banderas in-line).

### Patches mecánicos aplicados (4 sobre código existente)

- `index.html` (+1 line): nuevo `<link rel="stylesheet" href="/css/components/pizarra-tactica.css">` tras `globo-equipos.css`.
- `js/main-entry.js` (+1 line): `loadScript('/js/ui-pizarra-tactica.js')` entre `ui-globo-equipos.js` y `ko.js`.
- `public/js/ui-directo.js` (4 cambios): `<span class="dv2-mini-flag">` → `<button class="dv2-mini-flag dv2-mini-flag-btn" data-iso2="X">` (×2 home/away en `_buildDMini`) + `<div class="dv2-exp-flag">` → `<button class="dv2-exp-flag dv2-exp-flag-btn" data-iso2="X">` (×2 home/away en `_buildDExpanded`) + listener delegado al final del IIFE que invoca `window.openPizarraTactica({iso2})`.

### Iteraciones de UI (3 hot-fixes para llegar a la versión final)

1. **Banda + texto legible** (`02aed94`): banda bandera 90→130px, mask fade 60→75%; título antes blanco con shadow → ahora `#111827` plano (cae sobre fondo blanco tras el fade); coach antes blanco → `#4b5563`. Header `margin-top` -32→-50px para compensar banda más alta.
2. **Dark mode + tooltip tap + stats centradas** (`5a3ddde`): modal background `#fff` → `#1f2937` (todos los textos invertidos a paleta clara); nuevo `.fc-pizarra-stat-val-wrap` que envuelve valor+icono con `position:relative + inline-flex` para centrado correcto; `.fc-pizarra-stat-info` convertida a `<button>` posicionado absoluto `left:100% top:50%` (no afecta centrado del valor); nuevo `.fc-pizarra-stat-tooltip` oscuro con flecha CSS pseudo `::before`; listener delegado en `buildOverlay()` que tap abre / tap fuera cierra / auto-close 4s.
3. **Cuadro de Honor** (`533ec15`): diagnóstico Chrome MCP DOM inspection sobre localhost:5173 reveló panels[0]=view-cinematic con `display:none` ancho 0, fila row2 con `final-box4 + final-box3` existían pero nunca renderizadas. Fix: extracción de la lógica de cajas 2+3 a función pública independiente + hook en `_renderList`. ERR-42 documentado.

### Lecciones técnicas

- **Network blocking**: el sandbox de Code (proxy Anthropic) bloquea Supabase Storage (`Host not in allowlist`) y solo deja pasar GitHub vía API autenticada (private repos requieren MCP — `api.github.com` sin auth devuelve 404). Workflow validado: si un sprint requiere assets, San los sube a la rama `handoff-pizarra` del propio repo y Code los lee con `mcp__github__get_file_contents`.
- **Verificación byte-equivalence**: tras escribir un archivo desde MCP, comparar `wc -c` con tamaño esperado y hacer un re-fetch de verificación. La conversión de escape sequences `'—'` ↔ literal `'—'` (em-dash UTF-8) cambia bytes pero no semántica — restaurar con `python3 sed-like` para paridad exacta.
- **Documentación de bugs vivos**: cuando un sprint diagnostica un bug que ya estaba "vivo" en main pero no detectado, documentarlo en `errores_conocidos_porra.md` aunque se haya cerrado en el mismo commit. ERR-42 es ejemplo: bug introducido en F7.4-F (28 abr) detectado y cerrado en sprint del 08 may.

### Bugs conocidos cerrados / nuevos ERR documentados

- **ERR-42 nuevo**: Cuadro de Honor invisible tras F7.4-F (cajas 2+3 huérfanas en `#view-cinematic` legacy). Detalle en `errores_conocidos_porra.md`.

## 2026-05-06 — Sprint Globo PR2+PR3+Enrichment (rama `feature/globo-pr2-pr3`)

12 commits sobre `feature/globo-pr2-pr3` (base `99fb581`). Pendiente squash-merge a `main` desde GitHub UI por San. Convierte el globo MVP (PR#54) en una experiencia interactiva enriquecida: leyenda con banderas circulares Supabase + chips de sedes, panel de detalle con formación + frase + dos bios (sport.es narrativo + ESPN táctico), highlight rojo del país clickado, separadores A/B/C en carrusel, leyenda clasificados/sedes en lateral derecho.

### Commits del sprint (orden cronológico)

| SHA | Mensaje | Fase |
|---|---|---|
| `3c5801d` | feat: add wiki-data-globo.js with 45 teams + 16 venues | PR2 — datos |
| `c0f32ed` | feat(globo): PR2+PR3 flag legend + detail panel | PR2+PR3 — UI base |
| `a8ccd23` | feat(globo): UX polish — flag-only legend, venue chips, bio expand, squad stub | Polish |
| `11a7bde` | fix(globo): canvas flex + flag emoji from ISO3 table | Fix legend |
| `b8a2ef2` | fix(globo): badge images from Supabase (intermedio, superseded) | Iter |
| `6cb8f4b` | fix(globo): circular flag images from Supabase flags bucket | Iter final |
| `e205a84` | feat(globo): highlight país seleccionado en rojo + reset zoom al cerrar | Highlight |
| `adfff22` | fix(globo): clear flag is-active on reset | One-liner |
| `2a4bbad` | fix(globo): center extensive countries + sede highlight + tooltip cleanup | 3-fixes |
| `851ca93` | feat(globo): formación + frase ESPN + bios duales + grupos en carrusel | Enrichment v2 |
| `010b189` | polish(globo): fix wiki-bio textos + chip formación + leyenda lateral | Polish v2 |
| `6d058b2` | fix(globo): chip formación con ancho ajustado al contenido | Final fix |

### Funcionalidad nueva consolidada

- **Datos**: `public/js/data/wiki-data-globo.js` (45 selecciones + 16 sedes — apodo, grupo, confederación, mundiales, mejor resultado, entrenador, estrella, frase) + `public/js/data/wiki-bio.js` v3 (48 selecciones — apodo, formación, frase, bio sport.es, bio_espn ESPN). Las 4 selecciones nuevas en v3 (Turkey, Sweden, DR Congo, Iraq) ya tienen ficha completa.
- **Carrusel banderas**: rejilla horizontal scrollable con 48 banderas circulares 28×28 (`object-fit:cover; border-radius:50%`) servidas desde bucket Supabase `flags/<ISO3>.png`. Separadores A→L cada 4 banderas (mini-badge dorado monospace `pointer-events:none`).
- **Carrusel sedes**: segunda fila scrollable bajo banderas con 16 chips `📍 Nombre` clicables.
- **Leyenda tipos**: dos chips translúcidos verticales en lateral derecho (`position:absolute; right:12; top:50%; backdrop-filter:blur(4px)`), libera espacio inferior para los carruseles.
- **Panel detalle país** (`renderPanelPais`): header con título + apodo + pill formación (`Formación: 4-3-3` con `__pill-label` uppercase + valor monospace dorado, ancho ajustado al contenido) + frase italic con border-left dorado + grupo/confed/mundiales/mejor/coach + estrella card + dos `<details>` colapsables (sport.es abierto + ESPN cerrado) + botón `🏟 Ver plantilla` (stub PR4) + atribución dual.
- **Panel detalle sede** (`renderPanelSede`): estadio + país + capacidad + inauguración + equipo local + ronda máxima + dato destacado.
- **Highlight 3D del país clickado**: `_selectedNE` + `polygon*Color` callbacks usan `COL.SEL_CAP/SEL_STROK/SEL_SIDE` (`#d93025`/`#ff6b5b`/`#a01f16`). Re-render con `globe.polygonsData(globe.polygonsData())`. Cerrar panel → reset color + animación `pointOfView` al inicial.
- **Highlight de sede**: `_selectedSede` + `pointColor/Altitude/Radius` como funciones reactivas. Sede activa: roja + altitude `0.12` + radius `0.9`.
- **Centroides override** (`COUNTRY_LATLNG_OVERRIDE`): tabla manual de 12 países con bounding box engañoso (USA con Alaska, UK/France/Russia/Australia/Brasil/Norway/NZ con extensión continental). Override gana sobre EQUIPOS.lat/lng y sobre el centroide de `polygonsData`.
- **Tooltip cleanup** (`hideGlobeTooltip`): `display:none + setTimeout 50ms` reset, evita tooltip `.scene-tooltip` colgado cuando el panel cubre el cursor.
- **Canvas flex layout**: `.fc-globo-overlay { display:flex; flex-direction:column }` con `.is-open`. Canvas como `flex:1 1 0; min-height:0` y leg como `flex-shrink:0` reservan espacio. `globe.height(canvasEl.clientHeight || (window.innerHeight - 200))` con fallback + `requestAnimationFrame` en onResize / openOverlay-cached.

### Bugs conocidos cerrados / nuevos ERR documentados

- **ERR-39** (nuevo): ESPN scraping con regex non-greedy corta frases con comillas anidadas. Solución: regex greedy en `wiki-bio` v3.
- **ERR-40** (nuevo): ESPN HTML inserta espacios falsos tras vocales con tilde (`"Panam á"`). Solución: parser robusto con clean_html.
- **ERR-41** (nuevo): pill flex hijo en contenedor flex column hereda `align-items:stretch`. Solución: `align-self:flex-start + max-width:max-content`.

### Lecciones técnicas

- **Cherry-pick de commits inexistentes**: brief intermedio pidió `git cherry-pick 0dea54f` que solo vivía en local de San. Verificar `git rev-parse <SHA>` antes de aplicar; si el commit no está en remoto, reportar y proponer alternativas. Resultó ser no-op (los valores 5.0/4.2 ya estaban desde PR2).
- **Tabla ISO3 emoji incompleta**: el brief omitía TUR/SWE/COD de los 48 EQUIPOS. Verificación cruzada `EQUIPOS[].flag` vs tabla del brief evita fallback feo.
- **Patrón badge-with-flag-fallback** (`CLAUDE.md`): siempre dual-render. Cuando el brief solo render uno, mantener el patrón completo y notarlo como deviation. Regla de proyecto manda sobre el brief específico.
- **Inline `onclick` con escapes**: HTML entities (`&#39;`) más robustos que `\'` para single-quotes anidados en JS string → HTML attribute.
- **Subagentes**: ninguno en este sprint (tareas demasiado acopladas a `ui-globo-equipos.js`).

## 2026-05-06 — fix(ia): tooltip explainer z-index sobre cluster 9999 (PR#58)

PR #58 squash a main (`ae8090f`).

**Bug:** el tooltip explainer del IA Predictor (`#ia-explainer-popover`) quedaba detrás del modal de edición al hacer click en `.ia-pct-trigger` (76% / 78% etc). El popover se mostraba con su contenido correcto pero ofuscado por el modal.

**Causa:** `.ia-explainer` y `#jcard-modal-overlay` ambos con `z-index:9999` (`base.css:1170` y `ui-groups.js:615` inline respectivamente), ambos hijos directos de `body`. El modal se recrea en cada apertura → queda DESPUÉS en el DOM → gana por la regla CSS "empate de z-index → orden de pintado".

**Fix:** `.ia-explainer` `z-index 9999 → 10001` (sobre cluster `9999` completo: `#jcard-modal-overlay`, `#splash-screen`, `.adm-toast`, `.fc-globo-overlay`).

**Alternativa rechazada:** re-appendear el popover al `body` en cada `showFor()` era frágil — dependería del orden DOM y se rompería si futuro componente se appendea más tarde.

## 2026-05-06 — fix(grupos): badge done/total stale tras simular (PR#56)

PR #56 squash a main (`fa56a92`).

**Bug:** tras click "Todos los grupos (72)" o el dado individual de un grupo, los badges `done/N` de los headers de cards colapsables se quedaban con valor pre-simulación (`0/6`) aunque las tarjetas internas y las tablas de clasificación sí reflejaban los resultados.

**Causa:** `diceSimulateMatch` (admin.js) actualiza `predictions` y los DOM `sl-N/sv-N` por partido pero NO dispara `jcard:updated`, único punto que refresca el header progress + state class `.fc-grupos-card__bar` / `.fc-grupos-card__progress`. `diceSimulateAllGroups` solo refrescaba manualmente las tablas, no los headers ni el letterbar.

**Fix:** `ui-groups.js` extrae helper `_refreshGrupoCardHeader(letra)` del bloque correspondiente del listener `jcard:updated` (DRY). Expuesto en `window._refreshGrupoCardHeader`. `admin.js`: `diceSimulateAllGroups` y `diceSimulateGroup` añaden batch refresh tras los `forEach` y antes de `savePredictions` — `1×` letterbar + `12×` (o `1×`) header. Coste O(grupos) en lugar de O(partidos): disparar `jcard:updated` por partido en simulación masiva sería 72× re-renders del listener completo (compact card + letterbar + tabla + header) y empeoraría el handler ya lento.

**Out of scope:** click handler `'click' took 1019ms` queda en backlog item 12. Optimizar requiere profiling DevTools previo (Performance tab) para identificar qué partes del trabajo dominan; no se aborda con batches a ciegas.

## 2026-05-06 — Sprint Globo MVP (PR#54)

Branch `claude/globo-mvp-setup-QqBiE`. 5 commits squash-mergeados a main vía PR#54 (SHA `8e6681c`). Cinta dorada en `page-grupos` que abre overlay full-screen con globo 3D mostrando los 48 mundialistas y las 16 sedes anfitrionas.

### Funcionalidad nueva

- Cinta dorada en `#page-grupos` insertada como sibling previo de `#dice-global-bar` (mount idempotente vía `_ensureGloboCintaMount` llamado desde `_renderGruposLetterBar`).
- Click en cinta → overlay full-screen con globo 3D interactivo (globe.gl@2.33.0 lazy-loaded desde jsdelivr al primer click, cero impacto bundle inicial).
- 47 polígonos dorados (los 48 mundialistas, UK cubre England+Scotland) sobre tierra verde-oliva en GeoJSON Natural Earth 50m (fetch externo a CDN nvkelso).
- 16 sedes del Mundial 2026 como puntos blancos (LA, SF, Seattle, Dallas, Houston, KC, Atlanta, Miami, Boston, NY, Philadelphia, CDMX, Monterrey, Guadalajara, Vancouver, Toronto).
- Tooltips on hover con badge `⚽ CLASIFICADO` para mundialistas y `📍 Sede Mundial 2026` para puntos.
- Auto-rotación 0.4 con pause 0.08 on `pointerdown`, restore 1500ms post `pointerup`.
- Cierre por X (botón top-right), ESC y click backdrop. Instancia cacheada en `window._globoInstance` → reabrir es instantáneo.

### Commits

- `1dfa393` MVP inicial: IIFE + paleta + ALIAS_NE 13 entradas + lazy-load + overlay lifecycle.
- `9ed9e25` Altitude responsive (mobile/desktop) con bonus resize handler que preserva zoom manual del usuario (umbral 0.5).
- `da6d796` 5 perf opts (revertido luego — afectaban apariencia).
- `f5f97e6` Revert + zoom out preliminar 7.0/6.2.
- `0dea54f` Tune final: zoom 5.0/4.2 + atmósfera 0.10 + pixelRatio cap 1.5 retina.

### Archivos

**Nuevos (2):**
- `public/js/ui-globo-equipos.js` — 297 LoC IIFE, expone `window._mountGloboCinta(container)`.
- `public/css/components/globo-equipos.css` — 220 LoC namespace `fc-globo-*` (cinta variante C: shimmer + glow + SVG rotando con `clip-path`; overlay: header + close + msg + canvas + leg).

**Modificados (3):**
- `public/js/ui-groups.js` — `+_ensureGloboCintaMount` (20 LoC) invocado al inicio de `_renderGruposLetterBar`.
- `index.html` — `+1 link` `/css/components/globo-equipos.css`.
- `js/main-entry.js` — `+1 loadScript('/js/ui-globo-equipos.js')` tras `ui-groups-mobile.js`.

### Decisiones técnicas

- **Lazy-load on first click** vía `<script>` injection dinámica (`globe.gl` no contamina el bundle inicial).
- **Fetch externo CDN nvkelso** para GeoJSON NE 50m: cero archivos de datos en repo, payload `~3 MB` solo descargado al primer click.
- **Fuente única** de mundialistas: `EQUIPOS.map(e => norm(e.name_en))` con tabla `ALIAS_NE` para mapear `England`/`Scotland` → `United Kingdom`, `Türkiye` → `Turkey`, `Cape Verde` → `Cabo Verde`, `Ivory Coast` → `Côte d'Ivoire`, `DR Congo` → `Dem. Rep. Congo`, etc. Console warning si algún `name_en` sin polígono NE.
- **Paleta cartográfica**: océano `#1e4d6b`, tierra `#3d4f2e`, mundialistas `#e8b830`, atmósfera `#7eb6d8`. Atmósfera HEX puro (no rgba con alpha — `THREE.Color` rompe).
- **Performance**: atmósfera `0.10` (overdraw mínimo), pixelRatio cap `1.5` en retina, altitude responsive (mobile `5.0` / desktop `4.2`), `showGraticules(false)`.
- **Sin modales en MVP** — solo tooltips on hover. Modales país/sede planificados en PR3.

### Lecciones técnicas clave

- **globe.gl@2.33.0 API surface** documentada como ERR-38: factory `Globe()` (no `new Globe()`), controles vía `globe.controls()` (Three.js OrbitControls), atmósfera HEX puro. Métodos alucinados por LLMs (`graticuleLabels`, `rendererConfig().chain()`, `autoRotate()`, `zoom()`) NO existen en 2.33.0.
- **Lib pinneada → leer API en `unpkg.com/<lib>@<version>/`**, NO en README del default branch (puede ser de versión más reciente).
- **Reverts limpios sin `git revert`**: cuando hay que deshacer cambios no solicitados (5 perf opts intermedias), commit nuevo aplicando los opuestos mantiene el historial linear y squashable.

## 2026-05-05 — Sprint B Grupos screen redesign (PR#52)

Branch `claude/sprint-b-grupos-redesign`. 14 commits squash-mergeados a main vía PR#52 (SHA `aebbd22`). Refactor completo de la pantalla Grupos replicando el patrón visual de Fase Final.

**Estructura final**: chips A-L sticky letterbar (réplica `.fc-elim-stepper`) + 12 cards colapsables A-L con header (barra vertical estado-coloured + GRUPO X + 4 banderas overlap + dado + N/6 + chevron) + carrusel scroll-snap sibling con 6 compact cards (réplica `.ko-card`) + tabla clasificación slot 7 + modal editable con flechas nav prev/next.

### Commits principales

- `5a223eb` scaffold mount points + grupos-shell.css skeleton.
- **Oleada A** `26d2658`: G1 chips A-L + G2 card colapsable shell — 4 subagentes Haiku paralelos integrados por Opus padre.
- **Oleada B** `31ff5d8`: G3 carrusel scroll-snap (slot 288→320 tras smoke check).
- **Oleada C** `1d35651`: G4 tabla clasificación restilada (override `renderGroupTableCard` en ui-groups.js).
- `00ac929` letterbar replica Fase Final + compact preview cards (drop tarjeta editable inline en carrusel).
- `4785883` modal editable MOVE-original (en lugar de clonar) — preserva listeners de attachEvents (boost ×2, save, IA, ▲▼ marcador, dropdown goleador).
- `a900757` Bug 1 `[hidden]` UA stylesheet override + Bug 2 nav flechas en modal editable replicando `_renderElimExpanded` (counter idx/N + arrows + dispatch jcard:updated por navegación).
- `67399b9` slot responsive + tabla clasificación visible (drop attr `hidden` rely on CSS scope).
- `98f4550` compact card visual replica EXACTA Fase Final (drop `.fc-grupos-mini` que rompía hover, 14-char truncate, `.ko-ia-hint` placeholder).
- `7d8f9c6` compact card más estrecha (revertido luego en `7f9b9ff`).
- `05f5dd4` expanded como SIBLING de la card (no anidado) — replica patrón Fase Final donde `.fc-elim-expanded` vive como hermano del row.
- `2d8aec8` padding centralizado (réplica `.fc-elim-list { padding: 0 12px 80px }`).
- `b66aea9` neutralizar `.container` legacy padding 20px lateral en `#page-grupos`.
- `412fddf` ko-body fill space (TU PRONÓSTICO + marcador o CTA).
- `7f9b9ff` revert compresión vertical agresiva + centrar card en slot match.
- `8cad0d3` fix selector stale `.fc-grupos-mini` post-class-drop.

### Lecciones técnicas clave

- **Patrón sibling vs anidado**: scroll-snap carousel con slot 86vw NO encaja dentro de container colapsable (margins+padding+borders consumen 60-100px de ancho). Modelo correcto Fase Final: expanded como sibling del header via `parentNode.insertBefore(expanded, sectionEl.nextSibling)`. El padding lateral lo da el container padre (`#groups-container { padding: 0 12px 80px }`), no la card individual.
- **MOVE original vs clone para modal editable**: `appendChild(originalEl)` MUEVE el Element preservando listeners de `attachEvents`. Restituir al cerrar via `originalParent.insertBefore(target, originalNextSibling)` con captura de `originalStyleAttr` para preservar inline styles. Patrón también compatible con navegación prev/next en modal (cada navegación restituye + mueve el siguiente).
- **`[hidden]` HTML attribute persistencia**: el atributo `<div hidden>` aplica via UA stylesheet `display: none` y persiste tras `appendChild` a otro contenedor (no se limpia automáticamente). Para hidden-source patterns: dropear el attr y rely en CSS scoped (`.fc-grupos-card__source { display: none !important }`) que solo aplica mientras el Element vive en su origen.
- **`.container` legacy wrapper**: `ko.css` define `.container { padding: 0 20px 60px }` global. Pages anidadas en `<div class="container">` pierden 40px lateral vs pages top-level (`#page-elim`). Override scoped: `#page-grupos > .container { padding-left: 0; padding-right: 0 }`.
- **Stale selector tras refactor de clases**: cuando se dropea/renombra una clase CSS, grep TODOS los selectores en JS (`querySelector`, `querySelectorAll`, `closest`, `matches`) ANTES del commit. ERR-35 documentado.

