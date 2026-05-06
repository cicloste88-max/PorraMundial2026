# CHANGELOG — Porra Mundial 2026

Retención 90d. Auto-archivado a `CHANGELOG-archive-YYYYMM.md` si supera 30KB.

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

## 2026-05-04 — Sprint A (Awards toggle Fase Final) + B (Restyling Jornada/Directo v2)

Branch `claude/fix-awards-card-display-BZMg5`. Cierra los 3 items del sprint UI.

**A — Awards toggle en Fase Final** (4 commits A.1..A.4):
- 2 subtabs en header de `#page-elim`: 'Cuadro oficial' (bracket-results.js — banner pre-torneo si Date.now() < 11-jun-2026) + 'Premios' (awards-box4). Click en subtab activo → reset a estado base (mis pronósticos, stepper+list+dice).
- `_state.activeAction` en `ui-elim-shell.js`: 'mis-pronosticos' | 'cuadro' | 'premios'. Mounts dedicados `#fc-elim-awards-pane` y `#fc-elim-bracket-pane`. Movimiento DOM de `awards-box4`/`brk-root` con placeholder Comment para restauración.
- Botón superior contextual: subtab activo → "← Volver"; estado base → "← Inicio". Estilo discreto link (sin pill).
- Subtab activo visualmente claro: fondo del color acento (#60A5FA azul / #FFD700 oro) + texto oscuro + box-shadow.
- `window.elimShellResetAction()` expuesto; `showPage('elim')` lo llama → re-entrada en bottom-tab arranca siempre en estado base.

**B1 — Jornada Design v2**:
- `_buildJCard` reescrito con prefijo `jv2-*` (CSS `public/css/components/jornada-v2.css`). Card dark `#1a1a1e` con stadium + día/hora top, banderas circulares 44px (`#2a2a2e` borde `#333`), score 28px bold, códigos 3 letras debajo.
- Chips de acierto solo en finalizados (status='finished' desde `_liveScoresByMatchKey`): 1X2/Exacto/Goleador/vs IA con ✓/✗ verde/rojo + chip dorado `+N pts` (con `×2` si boost+exacto). `calcMatchPoints` ya aplica el x2 internamente. Pre-mundial todo va a "Por jugar" sin chips.
- Header de jornada con flechas ‹ › nav (scroll suave entre secciones), "JORNADA N · GRUPOS", subtítulo agregado "X partidos · Y finalizados · Z por jugar", labels "Finalizados"/"Por jugar".
- Boost row debajo de los chips. `openJcardModal` y `jcardBoostToggle` preservados.

**B2 — Directo Design v2**:
- `_buildDCard` split en `_buildDMini` (compact row 20px flag) + `_buildDExpanded` (full card 42px score, banderas 48px). Estado local `_expandedKey` (solo 1 expandida). Click toggle.
- Expansion muestra: live badge "EN VIVO · 67'" / FINAL / PRÓXIMO, meta "Grupo · Estadio", score grande, periodo "1T·67'/2T·67'/DESCANSO" verde, GOLEADORES dos columnas (local izq, visitante der) con ⚽/🟥+min+player+extras, "Tu predicción" con marcador+goleador+estado "VAS GANANDO +N pts" verde / "0 PTS POR AHORA" gris / "GANASTE" si finalizado.
- Si hay expandido y otros inprogress: sección "Otros partidos en vivo" abajo del expandido (filtrando duplicados con la lista por día).
- Helpers reutilizables `_getMatchCtx(m)` y `_getLivePts(ctx, m)`. `updateDirectoCard` adaptado: detecta `.dv2-exp` vs mini.
- CSS `public/css/components/directo-v2.css` prefijo `dv2-`. Animación `dv2BlinkDot` para indicators rojos.

**fix(jornada)** Ver tarjeta mobile:
- **Goleador no cargaba**: `openJcardModal` busca `#card-wrap-${matchKey}` pero `createMatchCard` no asignaba ese id. Fix de un line en `scoring.js:646`. Además, `cloneNode(true)` no transfiere `.value` runtime de `<select>` (auth.js asigna `gselEl.value=pred.gol` solo a la propiedad), así que el clone perdía el goleador → copy manual orig→clone selects/inputs/checkbox.
- **Overflow mobile centrado**: tras descartar `transform:scale` (slider horizontal) y width:360px intrínseco (recortes), versión final en `_showJcardModal` (`ui-groups.js`): overlay `align-items:flex-start;padding:16px;overflow:hidden`; wrapper `margin:0 auto;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);overflow-x:hidden;overflow-y:auto;padding-bottom:24px`; clone `margin:0 auto`; tras montaje `clone.style.width=(offsetWidth-5)+'px'`. Tarjeta centrada con 16px lateral y borde inferior visible sin scroll horizontal.

**C diferido — Grupos compact view**: anotado en `CLAUDE.md` §Pendientes Bugs UI item 5. Replicar formato Fase Final (cards embebidas por letra A-L, ref `ui-elim-shell.js` ElimRow+ElimExpanded). Toca `createMatchCard` + `renderAll` + `ui-groups-mobile.js` mobile-collapse — scope grande, sprint dedicado.

**Cleanup pendiente**: reglas legacy `.jcard-*` en `directo.css` y `.dcard-*` (no simulacro) quedan inertes tras B1+B2. Borrar en commit posterior tras smoke OK confirmado.

## 2026-05-04 — F7.7-IA C1+C2 Bot IA Zayu (DDL + EF v11)

Sprint en curso, branch `claude/f77-ia-c1-c2`. Bot "IA Zayu" jugador en las 3 ligas con 72 group + 32 KO + awards + groups_saved A-L lock. Detalle técnico en `docs/ia-predictor.md` §Jugador IA Zayu.

**DDL** (mirror en `supabase/migrations/`): `profiles.is_bot` + índice parcial; función `replicate_bot_to_league(uuid)` SECURITY DEFINER; trigger `replicate_bot_on_new_league` AFTER INSERT en `leagues`; REVOKE EXECUTE FROM PUBLIC/anon/authenticated.

**EF `porra-ia-compute` v11** ACTIVE (SHA `af0f24a8`, 64705 B / 63.2 KB): 2 actions `seed_ia_user` (idempotente) + `seed_ia_user_predictions` (72 group desde ia_predictions snapshot + standings frontend + 32 KO via `predict()` + awards 4 web_search + Haiku integrador con fallback determinista).

**Bugs ejecución**:
- **ERR-34 (post-auth race)**: 1ª `seed_ia_user` creó auth.users pero 500 en INSERT profiles. Recovery SQL idempotente. Bot funcional sin tocar EF; pendiente retry/backoff.
- **Awards fallback**: 5ª Haiku cayó al determinista. Resultado: Messi/Messi/Dibu/Lamine_Yamal. Aceptable; mejora prompt diferida.

**Verificación 3 ligas** (Biwenger/Porrazo/Porrazo 2): preds=72, ko=32, awards=true, groups_locked=12/12. Champion Francia, top4 Francia/Argentina/España/Inglaterra.

**Pendiente**: `update_ia_scorers` tras cargar squads reales (`predictions.scorer`/`ko_predictions.scorer` NULL).

## 2026-05-02 — F7.7-VIS Predictor mobile redesign + Trionda Timeline (PR#46)

**Sprint completo cerrado.** 18 commits (B1..B16) mergeados a `main` vía PR#46 squash (SHA `d1be8bf5`). Diff +3784 / −13 LOC, 14 archivos. Bundle 188.61 KB (sin variación, los assets nuevos van en `public/` servidos verbatim).

### Cambios principales

**Frontend (4 archivos):**
- `public/css/components/predictor-shell.css` — bloque `.timeline-*` con balón Trionda real (270 KB asset Supabase Storage en `miniatures/Ball/Trionda-official-ball.png`), animaciones spin + glow respirando, badge con clamp en extremos + flecha móvil independiente.
- `public/js/ui-pred-shell.js` — render completo del Predictor (tile dorado, hero, rango, timeline, footer); cierra Gap A (chip rango con eyebrow "Tu rango") + Gap B (chips Liga/Global apilados con vistas SQL reales).
- `public/js/data.js` — helper `getMundialProgress()` con cálculo por-fase + vistas SQL ranking (`v_league_member_count`, `v_user_global_rank`); B14 fix off-by-one en frontera de fase (cambio `<=` → `<` estricto en cadena KO).
- `public/js/predictor-ranks.js` — sistema 10 niveles con thresholds 0/100/200/350/500/850/1400/2100/3000/4000 y frases (Chupetín → Sotanita → Pipero → Cuchara de madera → Forofo → Crack → Profeta → Oráculo → Sabio del VAR → Maestro Mundialista).

**Backend:**
- `supabase/migrations/20260430200000_predictor_ranking_views.sql` — 2 vistas para chips Liga + Global (`v_league_member_count` y `v_user_global_rank`). Aplicada a la BD remota por Claude.ai vía Supabase MCP `apply_migration` el 30 abr (Code en sandbox no podía).

### Decisiones de producto cerradas (6 de 6)

- Sistema rangos 10 niveles + frases — visible (chip + frase italic)
- Ranking liga local — real desde `v_league_member_count`
- Ranking global cross-league — real desde `v_user_global_rank`
- % Aciertos cableado — llena automáticamente el 11 jun
- Racha cableada — llena automáticamente el 11 jun
- IA-jugador — diferido a F7.7-IA (sprint nuevo)
- Tile pre-Mundial — visible y polished con countdown + badge `Faltan X días`
- Trophy modal — funcional, 4 premios reusando `#modal`

### Iteraciones críticas

- **B11**: implementación inicial del balón Trionda con marcas equidistantes
- **B12**: eyebrow simplificado + badge mid-Mundial `X/104`
- **B13**: línea verde alineada con balón (mismo sistema por-fase) + badge sin `%` con nombre de fase legible
- **B14**: off-by-one al cruzar frontera de fase (`<=` → `<` en cadena KO). Caso reportado por San: `matchesPlayed=100` mostraba "Cuartos" cuando debía mostrar "Semis"
- **B15**: clamp del badge en extremos + flecha móvil independiente (resolvió badge cortado en pre-Mundial)
- **B16**: subir badge 14px (`bottom: calc(100% + 24px)`) para compensar el cambio de contenedor en B15

### Cleanup CLAUDE.md (B14 + sesión-close)

CLAUDE.md de 10294 → 9790 bytes (-504 bytes en B14). Bug UI #3 cerrado eliminado, audit Postgres backlog comprimido. Esta sesión-close ajusta Estado actual y Top-3.

### Pendientes diferidos

- **F7.7-IA** (bot oficial IA-jugador C1..C6) — sprint candidato siguiente
- B10-active mid-Mundial (footer "Última: ESP 2-1 BRA · Ver todo ›")
- B11-points-cache cercano al 11 jun (`rank_global` con pts reales tras crear `user_points_cache` + trigger)
- B12 trophy modal interior dark
- Open-state cards internals dark
- Limpieza CSS DEPRECATED B9 tras smoke producción
- Admin chip especial "ADMIN" en lugar de fallback "—" cuando es admin

### Validación

- `npm run build` limpio en todos los commits
- Pre-commit hook OK en cada commit
- QA visual de San: 3 estados verificados (pre-Mundial 0%, mid 50%, finalizado 104%)
- Test mock: `window.__PRED_MOCK = { matchesPlayed: N }` con N en {0, 23, 71, 72, 75, 88, 96, 100, 102, 104}
- Vercel deploy automático tras merge

### Patrones validados durante el sprint

1. **Subagentes Haiku 4.5 paralelos** vía Task tool (B11: 3 agentes CSS+JS+data, padre Opus integra)
2. **Patch persistente vía archivos en `.claude/briefs/`** (B15+B16): brief self-contained descargable, instrucción a Code "Lee el brief X y ejecútalo"
3. **Claude.ai aplica migraciones SQL** que Code no puede (vía Supabase MCP `apply_migration`) — split de responsabilidades formalizado
4. **Patrón Tiptap composer en Chrome MCP**: `execCommand('insertText')` sin disparar eventos sintéticos para no romper ProseMirror
5. **PR creada por Code Explorer extensión Chrome** vía GitHub API directa (Code en container Anthropic no tiene gh CLI ni token)

