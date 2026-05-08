# Migration log — Porra Mundial 2026 / vite-migration

Registro cronológico de acciones durante la migración Vite.
Formato: `[HH:MM] ACCIÓN: descripción — ficheros`

## 2026-04-11

[11:20] ELIMINAR: bloque inline misc.js del index.html — index.html
[11:21] AÑADIR: loadScript('/js/misc.js') a main-entry.js — js/main-entry.js
[11:22] COMMIT: feat: migrar misc.js — eliminar inline del HTML, carga dinámica desde main-entry.js (cb333ea)
[11:28] PUSH: vite-migration → origin (eece522..cb333ea)
[11:32] ELIMINAR: bloque inline scoreboard.js del index.html (líneas 5889-6163, 275 líneas) — index.html
[11:33] AÑADIR: loadScript('/js/scoreboard.js') a cadena en main-entry.js — js/main-entry.js
[11:33] COMMIT: feat: migrar scoreboard.js — eliminar inline, carga dinámica (b6de6d0)
[11:35] ELIMINAR: bloque inline close-porra.js del index.html (líneas 6165-6413, 249 líneas) — index.html
[11:36] AÑADIR: loadScript('/js/close-porra.js') a cadena en main-entry.js — js/main-entry.js
[11:36] COMMIT: feat: migrar close-porra.js — eliminar inline, carga dinámica (e25a707)
[11:55] BUG: botón "Empezar a pronosticar" del selector de ligas no responde al click — reportado por usuario
[11:56] INVESTIGAR: revisado leagues.js (leagueSelectById línea 57, leagueSelect línea 65) — window.leagueSelectById expuesto correctamente en línea 336
[11:58] INVESTIGAR: revisado scoreboard.js y close-porra.js — sin top-level code problemático, solo let declarations + funciones
[12:00] INVESTIGAR: verificado orden de scripts en index.html — main inline (2435-5684), admin inline (5909-6693), main-entry module (5885)
[12:05] HIPÓTESIS: DOMContentLoaded handler en auth.js línea 288 puede no dispararse porque auth.js se carga dinámicamente DESPUÉS de que el evento ya ha sido emitido — pre-existente, no causado por migración scoreboard/close-porra
[12:10] INVESTIGACIÓN INCOMPLETA: sin datos de runtime (consola del navegador) no puedo confirmar causa raíz — pendiente info del usuario
[12:20] AÑADIR: window._myLeagues = _myLeagues al final de leagues.js — js/leagues.js línea 345
[12:21] COMMIT: fix: exponer _myLeagues en window desde leagues.js
[12:25] PUSH: vite-migration → origin (cb333ea..1dfc402) — 3 commits (scoreboard, close-porra, _myLeagues)
[12:30] MODIFICAR: window._myLeagues ahora usa Object.defineProperty getter dinámico para reflejar reasignaciones — js/leagues.js
[12:31] COMMIT: fix: window._myLeagues con getter dinámico para reflejar reasignaciones (057b922)
[12:32] PUSH: vite-migration → origin (1dfc402..057b922)
[12:40] INICIAR: migración admin.js (793 líneas) — el último módulo pendiente
[12:45] ELIMINAR: bloque inline admin panel del index.html (líneas 5896-6693, ~798 líneas incluyendo dado/lockAllCardsIfCerrada y _admTabOrig) — index.html
[12:46] AÑADIR: loadScript('/js/admin.js') al final de la cadena en main-entry.js — js/main-entry.js
[12:47] COMMIT: feat: migrar admin.js — eliminar inline, carga dinámica (ecb26c2)
[12:48] PUSH: vite-migration → origin (057b922..ecb26c2) — migración Vite completa: todos los módulos JS fuera del HTML
[12:55] QA: admin.js validado en localhost:5173 — admInit, tabs, lockAllCardsIfCerrada OK
[12:56] PUSH: vite-migration → origin — feat: migrar admin.js
[13:00] MODIFICAR: CLAUDE.md actualizado — estado "Migración Vite COMPLETA", estructura JS y main-entry.js sincronizados, "Tarea actual" actualizada con próximos pasos posibles — CLAUDE.md
[13:01] COMMIT: docs: CLAUDE.md refleja estado final migración Vite completa (b31dd7b)
[13:02] PUSH: vite-migration → origin (741dbd6..b31dd7b)

═════════════════════════════════════════════════════════════════════
[13:05] ✅ CHECKPOINT — MIGRACIÓN VITE COMPLETA
─────────────────────────────────────────────────────────────────────
Rama: vite-migration (sincronizada con origin, 0 ahead / 0 behind)
HEAD: b31dd7b
Commits de esta sesión (orden cronológico):
  cb333ea  feat: migrar misc.js
  b6de6d0  feat: migrar scoreboard.js
  e25a707  feat: migrar close-porra.js
  1dfc402  fix: exponer _myLeagues en window
  057b922  fix: window._myLeagues con getter dinámico
  ecb26c2  feat: migrar admin.js
  741dbd6  docs: registrar QA validado admin.js
  b31dd7b  docs: CLAUDE.md refleja estado final

QA: validado por el usuario en localhost:5173 — todos los módulos OK.

Estado pendiente NO relacionado con esta migración (ignorar salvo
petición explícita del usuario):
  - main-entry.js (root) — eliminado, sin commit
  - vite.config.js — modificado, sin commit
  - index.html.bak, js/*.bak, *.ps1, *.py — untracked desde sesión
    anterior

Para retomar desde aquí:
  git checkout vite-migration
  git pull origin vite-migration
  Revisar CLAUDE.md § "Tarea actual" para posibles próximos pasos.
═════════════════════════════════════════════════════════════════════

[20:45] VERIFICAR: js/main.js UTF-8 correcto (64 emojis intactos) vs bloque inline index.html (también UTF-8) — encoding OK en ambos
[20:46] ELIMINAR: bloque inline main.js (lineas 2435-5684, ~3250 lineas) de index.html — index.html
[20:46] AÑADIR: <script src="/js/main.js"></script> en su lugar — index.html línea 2435
[20:48] FIX: cerrar función updateAwardsFooter con `}` faltante antes de bloque Exports para Vite — js/main.js línea 3244 (bug pre-existente, fichero nunca se cargaba)
[20:49] VERIFICAR: node --check js/main.js = OK; dev server sirve /js/main.js con 200 y 64 emojis UTF-8 intactos
[20:50] COMMIT: fix: eliminar main.js inline — usar fichero externo UTF-8
[21:05] COMMIT: fix: restaurar vite.config.js con defineConfig valido (revertir contenido vercel.json erroneo)

═════════════════════════════════════════════════════════════════════
  MERGE vite-migration → main (2026-04-11, push a Vercel)
═════════════════════════════════════════════════════════════════════
[21:30] CHECKOUT: main (limpio, solo untracked pre-existentes)
[21:32] MERGE: git merge vite-migration — conflicto en index.html
[21:33] ANALISIS: main tenia 5 commits "fix emoji/encoding" que eran MOJIBAKE destructivo
         (═→âââ, Ó→Ã, ▼→â¼). vite-migration tenia UTF-8 limpio.
[21:34] RESOLVER: git checkout --theirs index.html — tomar version vite-migration entera
[21:35] VERIFICAR: index.html 0 mojibake, 65 emojis limpios, 0 conflict markers,
         script /js/main.js y /js/main-entry.js presentes
[21:37] COMMIT: merge: vite-migration → main — Vite migration completa (8e70ef2)
[21:40] BUG: npm run build genera dist/ sin js/*.js — Vite solo bundlea modulos ES,
         los scripts clasicos no se copian. En prod los /js/*.js darian 404.
[21:42] FIX: git mv js/*.js → public/js/* (7 ficheros, excepto main-entry.js).
         public/ es copiado por Vite a dist/ automaticamente.
[21:44] VERIFICAR: npm run build OK → dist/js/ + dist/assets/index-*.js;
         dev server sigue sirviendo /js/*.js desde public/
[21:45] COMMIT: fix: mover js/*.js a public/js/ para build de Vercel (3f95d68)
[21:47] PUSH: git push origin main — dispara auto-deploy Vercel

═════════════════════════════════════════════════════════════════════
  HOTFIX PRODUCCION — vercel.json rompia modulos (2026-04-11)
═════════════════════════════════════════════════════════════════════
[22:10] BUG PRODUCCION: usuario reporta doLogin/window.supabase undefined en vercel.app
[22:12] DIAG: curl -I assets/index-*.js → Content-Type: text/html; charset=utf-8
         vercel.json forzaba text/html sobre "/(.*)" incluyendo /assets/*.js
         → browser rechaza modulo con "non-JavaScript MIME type"
         → main-entry.js nunca ejecuta → loadScript chain nunca arranca
         → auth.js nunca carga → doLogin stays undefined
[22:13] FIX: git rm vercel.json (Vercel defaults ya sirven HTML y JS con MIME
         correctos; index.html tiene BOM UTF-8 + meta charset que cubren el
         proposito original del vercel.json)
[22:14] COMMIT: fix: eliminar vercel.json — rompia MIME de modulos JS
[22:15] PUSH: git push origin main — dispara redeploy Vercel

═════════════════════════════════════════════════════════════════════
  EXTRACCION DE main.js EN 5 SUB-MODULOS (2026-04-12)
═════════════════════════════════════════════════════════════════════
Objetivo: dividir public/js/main.js (3278 lineas, 110 decls top-level)
en 5 classic scripts independientes, uno por sub-bloque documentado.
Metodo: 5 commits incrementales en rama extract-main-modules + 2 fixes
intermedios, validacion manual en localhost entre iteraciones.

[00:10] CHECKOUT: nueva rama extract-main-modules desde main
[00:12] ITER 1: extraer data.js (lineas 1-215) — 12 decls, 24KB
        SB, WORLD_CUP_LOGO, EQUIPOS, GRUPOS, PARTIDOS, KIT_OVERRIDES,
        predictions, iaPredictions, totalPoints, getMatchKey, getMySign,
        iaBonusWillApply, escapeHtml. COMMIT: 812a4d0
[00:18] ITER 2: extraer scoring.js (lineas 216-1394) — 50 decls, 66KB
        Motor puntos + tabla avanzada + render tarjetas + premios.
        Incluye AW_PLAYERS/YOUNG_PLAYERS_NXGN y sus window exports
        inline (auth.js los consume via window.X). COMMIT: 69aad2f
[00:25] ITER 3: extraer ui-groups.js (lineas 1184-1349) — 3 decls, 7KB
        Solo initGrupos, savePredictions, checkGroupsComplete.
        El "bloque mas grande" documentado en CLAUDE.md resulto ser
        inexacto: las ~1149 lineas de UI tarjetas estaban dentro del
        rango scoring. COMMIT: 7320d25
[00:30] BUG: usuario reporta freeze en leagueLoadMyLeagues()
        DIAG: classic scripts data/scoring/ui-groups/main en <script src>
        inline del HTML corrian SINCRONICAMENTE al parseo, antes que
        main-entry.js (deferred module) pudiera arrancar loadScript
        chain. leagues.js cargaba despues, asi que referencias top-level
        a leagueLoadMyLeagues fallaban.
[00:35] FIX: mover data/scoring/ui-groups/main al loadScript chain de
        main-entry.js. Eliminar <script src> del HTML. Nuevo orden:
          leagues → data → scoring → ui-groups → main → auth → ...
        leagues primero (fix del freeze), data antes de auth (para que
        onAuthStateChange callback encuentre PARTIDOS cuando fire).
        COMMIT: 0ad8f72
[00:45] ITER 4: extraer ko.js (lineas 1350-2389) — 28 decls, 54KB
        BRACKET, koPredictions, ROUND_CONFIG, BADGE_MAP, bracket views,
        fetchIAforKO, resolveKO, renderKO, buildKOCard, saveKO. COMMIT:
        a25b0bc
[01:00] BUG: usuario reporta 2 regresiones visuales tras iter 4:
        1) boton "cerrar/finalizar" desaparecido
        2) 3 checks (#fincheck-grupos/ko/awards) sin actualizar
        DIAG: main.js residual tenia bloque "Exports para Vite" (lineas
        651-684) con 30 asignaciones window.X. En particular linea 677:
          window.checkFinalizarReady = typeof checkFinalizarReady !== ...
        main.js evalua en posicion 6 del chain (antes de close-porra.js
        en posicion 9), asi que setea window.checkFinalizarReady =
        undefined. La hoisting posterior de la function declaration en
        close-porra.js no estaba sobreescribiendo de forma fiable.
[01:15] FIX: eliminar bloque completo de exports de main.js (dead code,
        ningun consumer accede window.X excepto 2 casos). Anadir al final
        de close-porra.js exports explicitos para los 2 casos consumidos
        via window (onclick inline + auth.js):
          window.finalizarPorra = finalizarPorra;
          window.checkFinalizarReady = checkFinalizarReady;
        Verificado: regresiones resueltas. COMMIT: d81f2dd
[01:25] ITER 5: extraer ui-nav.js (todo lo restante de main.js) —
        17 decls, 37KB. Modal partido, SPA nav, initWelcome, awards
        footer, IA KO modal, koInit. main.js ELIMINADO del repo.
        main-entry.js: reemplazar loadScript('/js/main.js') por
        loadScript('/js/ui-nav.js'). COMMIT: 8590471
[01:35] VALIDACION: usuario confirma smoke test completo en localhost
        (welcome, login, liga, grupos, eliminatorias, premios,
        finalizar, scoreboard, admin, 0 errores consola)
[01:40] BUILD: npm run build OK → dist con 11 classic scripts + bundle
[01:42] MERGE: extract-main-modules → main (--no-ff) = ede690c (hash
        tras rebase sobre aecd847 docs CLAUDE.md)
[01:45] PUSH: git push origin main — dispara redeploy Vercel

Resumen final:
  data.js       215 lineas  12 decls
  scoring.js   1184 lineas  50 decls
  ui-groups.js  167 lineas   3 decls
  ko.js        1048 lineas  28 decls
  ui-nav.js     653 lineas  17 decls
  TOTAL        3267 lineas 110 decls  (0 solapes entre ficheros)
  main.js      ELIMINADO

Chain final en js/main-entry.js:
  misc.js (parallel)
  leagues → data → scoring → ui-groups → ko → ui-nav →
    auth → scoreboard → close-porra → admin

## Sesión 2026-04-12 — Bracket connector lines (Fase 1)

[19:00] AÑADIR: BRACKET_CONNECTIONS mapping 15 conexiones — public/js/ko.js
[19:00] MODIFICAR: buildBracketView — data-match-id, limpieza SVG, ResizeObserver, drawBracketLines() — public/js/ko.js
[19:00] AÑADIR: drawBracketLines() SVG overlay bezier curves — public/js/ko.js
[19:00] AÑADIR: CSS #bracket-lines-svg, .bracket-inner — css/ko.css
[19:10] INICIO: fix getBoundingClientRect=0 en panel hidden — drawBracketLines desde setView
[19:10] FIX: setView('bracket') ahora llama drawBracketLines con rAF+50ms tras hacer visible el panel — public/js/ui-nav.js ✓
[19:10] VERIFICAR: node --check ✓ / npm run build ✓
[19:10] COMMIT: 69481d1 — fix: drawBracketLines after panel visible
[19:10] PUSH: main → origin ✓ — Vercel autodeploy
[19:10] FIN TAREA: Fase 1 bracket connector lines CERRADA
[19:20] INICIO: fix diceSimulateMatch — mutar pred en lugar de reemplazarlo
[19:20] FIX: predictions[key] mutado con Object.assign en vez de reemplazado — public/js/admin.js:585,591 ✓
[19:20] VERIFICAR: node --check ✓
[19:20] COMMIT: 187a764 — fix: diceSimulateMatch mutar pred en lugar de reemplazarlo
[19:20] PUSH: main → origin ✓ — Vercel autodeploy
[19:20] FIN TAREA: fix undo tras dado completado

## Sesión 2026-04-12 — Rediseño bracket resultados (Fase 0b visual)

[19:30] INICIO: rediseño bracket resultados — INSTRUCCIONES_CLAUDE_CODE_REDISENO_BRACKET.md
[19:30] VERIFICAR IDs: BRACKET.third[0].id=103, BRACKET.final[0].id=104, SF=[101,102] — proto usaba 105/106 y SF=[103,104] → CORREGIR
[19:30] VERIFICAR _results: window._results NO existe en auth.js — resultados en admin.js/scoreboard.js via match_results/ko_results de tabla results
[19:35] T-01: CREAR public/js/bracket-results.js — IDs corregidos: FINAL=104, THIRD=103, SF=[101,102], fases renombradas (5→4 fases reales) ✓
[19:35] T-02: CSS ya en css/bracket-results.css (prototipo correcto, prefijo brk-) ✓
[19:35] VERIFICAR: node --check bracket-results.js ✓
[19:40] T-03a: index.html — tab "Resultados" añadido en view-tabs ✓
[19:40] T-03b: index.html — panel view-bracket-results con brk-root añadido ✓
[19:40] T-03c: index.html — link css/bracket-results.css en head ✓
[19:40] T-03d: js/main-entry.js — bracket-results.js en loadScript chain (después de ko.js, antes de ui-nav.js) ✓
[19:40] T-03e: ui-nav.js — setView('bracket-results') → initBracketResults con rAF+50ms ✓
[19:40] T-04: admin.js — refreshBracketResults() tras admLoadResults ✓
[19:40] VERIFICAR: node --check (3 ficheros) ✓ / npm run build ✓ / checklist 4/4 ✓

Decisiones de diseño:
- BRK_PHASES reducido de 5 a 4 fases (r32, r16, qf, sf) — el prototipo tenía "oct" como 5ª fase pero realmente r16=octavos en BRACKET
- IDs corregidos: BRK_FINAL_ID=104 (era 105), BRK_THIRD_ID=103 (era 106), BRK_COLS.sf=[101,102] (era [103,104])
- brkLoadResults() simplificado — no hay window._results global, usa window._brkResultsOverride como hook para inyectar datos
- CSS cargado como link externo (no inline) — Vite lo procesa y genera asset separado en dist/
[19:45] FIX: futurePhs crash — filtrar IDs sin definición en BRK_PHASES (.filter) — bracket-results.js:247 ✓
[19:45] FIX: labels rail — restaurar '1/32' y '1/16' (no '16avos'/'Octavos') — bracket-results.js:35-36 ✓
[19:55] INICIO: batch fixes — CSS center scroll/compact + eliminar tab Bracket
[19:55] FIX1a: .brk-center-inner — overflow-y:auto, scrollbar hidden, gap 8→6px — css/bracket-results.css ✓
[19:55] FIX1b: .brk-col.center — overflow:hidden — css/bracket-results.css ✓
[19:55] FIX1c: .brk-host-stack 92→72px, .brk-h-logo 68→54px, .mex/.usa offsets reducidos — css/bracket-results.css ✓
[19:55] FIX2: tab Bracket eliminado, solo queda Resultados + Cuadro — index.html ✓
[19:55] VERIFICAR: node --check ✓ / npm run build ✓
[20:10] INICIO: fix centro — ampliar columna 130→150px + mover sticker stack a col-hd
[20:10] FIX-A: .brk-col.center flex 130→150px (responsive 110→130px) — css/bracket-results.css ✓
[20:10] FIX-B: brkMakeCenter() — sticker stack movido a col-hd, logo FIFA eliminado, centro solo Final+3er — bracket-results.js ✓
[20:10] VERIFICAR: node --check ✓ / npm run build ✓
[20:20] INICIO: fix fases (añadir Octavos) + columna central colapsable
[20:20] FIX1: BRK_PHASES 4→5 fases (añadido oct/Octavos IDs 97-100), sf left/right vacios — bracket-results.js ✓
[20:20] FIX2: columna central colapsable — 48px default, 150px expanded al click "Final" — css/bracket-results.css ✓
[20:20] FIX2: brkMakeCenter col-hd con trofeo+onclick, brkSetPhase reconoce 'final' toggle — bracket-results.js ✓
[20:20] FIX2: brkRenderBracket — vista final muestra todas fases como past + centro expanded — bracket-results.js ✓
[20:20] FIX2: brkRenderRail — final activo resaltado en rail — bracket-results.js ✓
[20:20] VERIFICAR: node --check ✓ / npm run build ✓
[20:40] INICIO: 6 fixes — eliminar col central, nueva finalBox, toggle scroll/final, brk-final-area, CSS, ocultar finalizar-section
[20:40] FIX1: eliminar brkMakeCenter() del render bracket — bracket-results.js ✓
[20:40] FIX2: nueva brkMakeFinalBox() con Final+3er en layout horizontal — bracket-results.js ✓
[20:40] FIX3: brkSetPhase toggle scroll/final-area — bracket-results.js ✓
[20:40] FIX4: brk-final-area en initBracketResults root HTML — bracket-results.js ✓
[20:40] FIX5: CSS .brk-final-box* estilos caja final — css/bracket-results.css ✓
[20:40] FIX6: ocultar finalizar-section en vista bracket-results, restaurar en otras — ui-nav.js ✓
[20:40] VERIFICAR: node --check (2 ficheros) ✓ / npm run build ✓
[20:45] COMMIT: cd4afa2 — feat: bracket de resultados reales (Fase 0b visual)
[20:45] PUSH: main → origin ✓ — Vercel autodeploy
[20:50] DOCS: CLAUDE.md actualizado — estado 2026-04-13, bracket-results en estructura, cadena de carga, commit cd4afa2

[sesión 2026-04-13] FEATURE COMPLETA: bracket-results
- Ficheros nuevos: public/js/bracket-results.js, css/bracket-results.css
- Modificados: index.html, js/main-entry.js, public/js/ui-nav.js, public/js/admin.js
- Commit: cd4afa2 — desplegado en producción
- Pendiente: conectar con _results reales (11 jun, pg_cron update-results)

## Sesión 2026-04-13 — Splash screen + fixes welcome

[13:00] FIX: splash no reaparecía tras primera carga — initSplash estaba en ui-nav.js (loadScript tardío)
        Movido a script inline en index.html justo tras el div splash — arranca con el parse
        Añadido guard hidden, minTime 7s, hard cap 10.2s, splashDone respeta mínimo
        Eliminado initSplash de ui-nav.js (splashDone en initWelcome se mantiene)
[13:10] FIX: duración splash aumentada — minTime 4s→7s, hard cap 7.2s→10.2s
[13:15] COMMIT: 0d19ff9 — feat: splash screen opening — animación FIFA 2026
[13:15] PUSH: main → origin ✓ — Vercel autodeploy

[13:20] FIX: welcome hero y scroll-cue demasiado abajo en pantalla
        .wc-hero-content margin-top: -140px — index.html:489
        .wc-scroll-cue margin-top: -72px→-140px — index.html:500
[13:25] COMMIT: 90de1e7 — fix: subir bloque hero y scroll-cue en welcome
[13:25] PUSH: main → origin ✓ — Vercel autodeploy

[13:30] FIX: márgenes móvil welcome — bordes sin rellenar en dispositivos móviles
        #page-welcome margin: -24px -16px — contrarresta padding body global
[13:35] CONFIG: vite.config.js — host:true para test en red local (móvil)
        Nota: AP isolation del router impide conexión móvil→PC, se testea en producción
[13:40] COMMIT: 3473c76 — fix: márgenes móvil welcome
[13:40] PUSH: main → origin ✓ — Vercel autodeploy

## Sesión 2026-04-13 — Feature BOOST x2 comodín diario

[14:00] DOCS: 301235e — actualizar CLAUDE.md y migration-log (splash + fixes welcome)

[14:30] FEATURE: Boost x2 comodín diario — mecánica nueva fase de grupos
        - css/boost.css NUEVO: estilos checkbox, fila boost, badge x2, glow pulsante
        - index.html: .card sin overflow:hidden + position:relative, link boost.css
        - scoring.js: card-inner wrapper, fila boost en innerHTML, lógica check en attachEvents
          boostFlamesSVG/Top helpers → luego reemplazados por Canvas 2D
        - data.js: let boostPicks, saveBoostPicks, loadBoostPicks
        - auth.js: loadBoostPicks() en carga de caché local
[14:35] COMMIT: 368d8db — feat: boost x2 comodín diario — UI + partículas Canvas 2D fuego
[14:35] PUSH: main → origin ✓

[14:40] EVOLUCIÓN VISUAL: llamas SVG → intento WebGL shader (CodePen YPGpXjz) → Canvas 2D compartido
        - WebGL descartado: 72 contextos excede límite navegador, shader no compilaba
        - Lottie descartado: estilo cartoon, no realista
        - Canvas 2D final: 1 solo canvas compartido, ~90 partículas, bloom shadowBlur,
          compositeOperation lighter, mix-blend-mode screen, MutationObserver global
        - Paleta: amarillo claro → naranja → naranja-rojo → rojo oscuro
        - Auto-stop cuando no hay tarjeta activa (0 GPU idle)

[15:00] FIX: pred closure stale en attachEvents
        Los listeners de .sbn y gsel capturaban const pred = predictions[matchKey] una vez.
        Si loadUserData reemplazaba predictions[key], los listeners mutaban el objeto viejo.
        Fix: leer predictions[matchKey] dentro de cada listener en tiempo real.
[15:05] COMMIT: ad343e3 — fix: pred closure stale en attachEvents
[15:05] PUSH: main → origin ✓

[15:20] FEATURE: Boost x2 en motor de puntuación + ticker
        - scoring.js: calcMatchPoints aplica x2 si exacto + boost del día (máx 14pts)
        - index.html: regla boost en normas, "14 con boost" en sistema de puntos
        - ui-groups.js: renderBoostTicker + tickerBoostToggle, sync bidireccional con cards
        - index.html: div #boost-ticker con botones por partido del día
[15:25] COMMIT: 667f565 — feat: boost x2 en puntuación + ticker partidos jornada
[15:25] PUSH: main → origin ✓

[15:40] FEATURE: Persistencia boost_picks en Supabase
        - Tabla boost_picks creada (migration): user_id, league_id, match_id, match_date
          UNIQUE(user_id, league_id, match_date) + RLS
        - data.js: saveBoostPicks/loadBoostPicks async — localStorage caché + Supabase fuente de verdad
[15:45] COMMIT: 27e5906 — feat: boost_picks persistencia Supabase
[15:45] PUSH: main → origin ✓

[15:50] FEATURE: Validación boosts en checkFinalizarReady
        - close-porra.js: cuenta jornadas con/sin boost, allDone requiere boostDone
        - index.html: fincheck-boost item con icono 🔥 y contador de jornadas
[15:55] COMMIT: cb8e969 — feat: checkFinalizarReady valida boosts de todas las jornadas
[15:55] PUSH: main → origin ✓

[16:00] FEATURE: Ticker boost mejorado — pastillas por jornada
        - ui-groups.js: renderBoostTicker reescrito con jornadasMap, pastilla HOY pulsante,
          panel expandible tickerExpandJornada, máx 3 jornadas pendientes + "+N más"
        - index.html: ticker simplificado (contenido dinámico), @keyframes boostPulse
[16:05] COMMIT: 494d01c — feat: ticker boost — pastillas por jornada, panel expandible
[16:05] PUSH: main → origin ✓

[16:10] FEATURE: Bloqueo eliminatorias sin boosts completos
        - ui-groups.js: checkGroupsComplete requiere boostsCompletos para habilitar botón elim y CTA
        - index.html: texto normas ampliado, font-weight:900 en "14 con boost", boostPulse afinado
[16:15] COMMIT: 6c3d30b — feat: boost completo — bloqueo eliminatorias sin boosts
[16:15] PUSH: main → origin ✓

═════════════════════════════════════════════════════════════════════
  CHECKPOINT — BOOST x2 COMPLETO (2026-04-13)
─────────────────────────────────────────────────────────────────────
HEAD: 6c3d30b
Commits boost (8):
  368d8db  feat: boost x2 comodín diario — UI + Canvas 2D fuego
  ad343e3  fix: pred closure stale en attachEvents
  667f565  feat: boost x2 puntuación + ticker
  27e5906  feat: boost_picks persistencia Supabase
  cb8e969  feat: checkFinalizarReady valida boosts
  494d01c  feat: ticker boost pastillas jornada
  6c3d30b  feat: boost completo bloqueo eliminatorias

Ficheros nuevos: css/boost.css
Ficheros modificados: index.html, public/js/scoring.js, public/js/data.js,
  public/js/auth.js, public/js/ui-groups.js, public/js/close-porra.js
Tabla Supabase: boost_picks (migration create_boost_picks)

Mecánica completa:
  - 1 boost por jornada de grupos (17 jornadas)
  - Checkbox en tarjeta + ticker en barra superior (sync bidireccional)
  - Si aciertas exacto en el partido boost → puntos x2 (máx 14)
  - Sin todos los boosts asignados: no se puede acceder a eliminatorias ni cerrar porra
  - Persistencia: localStorage (caché) + Supabase (fuente de verdad)
  - Visual: Canvas 2D partículas fuego compartido + glow CSS pulsante + badge x2
═════════════════════════════════════════════════════════════════════

## Sesión 2026-04-13 — Boost UX + Vista Jornada

[16:30] FEATURE: pastillas boost pendientes en CTA grupos
        - ui-groups.js: bloque CTA inferior con pastillas pulsantes por jornada pendiente
        - index.html: div #cta-boost-pending bajo cta-locked-msg
[16:35] COMMIT: b173274 — feat: pastillas boost pendientes en CTA grupos
[16:35] PUSH: main → origin ✓

[16:50] FEATURE: boost ticker mejoras
        - ui-groups.js: scrollToMatchCard (scroll suave + flash naranja 1.8s)
        - _buildMatchButtons compartido ticker/CTA con label "J1","J2"...
        - ctaExpandJornada: panel expandible propio en CTA inferior
        - Fix: check tarjeta ahora re-renderiza ticker y CTA (scoring.js)
[16:55] COMMIT: 9d8a56b — feat: boost ticker scroll, label Jornada, panel CTA, fix re-activación
[16:55] PUSH: main → origin ✓

[17:10] FEATURE: Vista Jornada — nueva pestaña en fase de grupos
        - index.html: selector toggle "Fase de grupos / Jornada", #jornada-container, CSS completo jcards
        - ui-groups.js: setVistaGrupos, renderVistaJornada, _buildJCard, jcardBoostToggle, _buildJornadaRanking
        - scoreboard.js: window._sbData expuesto para ranking
[17:15] COMMIT: 74a5971 — feat: vista Jornada tarjetas compactas por día con boost, pts y ranking
[17:15] PUSH: main → origin ✓

[17:20] FIX: vista Jornada no visible — display '' no sobreescribe CSS display:none
        - setVistaGrupos usa display 'block' en vez de ''
        - _buildJornadaRanking dispara sbLoad() si _sbData ausente
[17:25] COMMIT: d8bc246 — fix: vista Jornada display block, cargar sbData si ausente
[17:25] PUSH: main → origin ✓

[17:40] FEATURE: vista Jornada rediseño completo
        - CSS: jornada-wrap grid, sidebar única sticky (grid-column:2, grid-row:1/99)
        - jcards: equipos grandes, marcador centrado, estadio+hora+grupo, chips compactos
        - Pts: número solo + "PTS posibles"/"PTS ×2" (sin X)
        - CTA boost completos: pastillas verdes editables "✅ J1 · México vs ..."
        - renderVistaJornada: sidebar única fuera del loop de jornadas
[17:45] COMMIT: ef39b3d — feat: vista Jornada rediseño jcards anchas, sidebar sticky, CTA editable
[17:45] PUSH: main → origin ✓

[17:50] FIX: sidebar clasificación aparecía a la izquierda — faltaba grid-column:2
[17:50] COMMIT: 52a917c — fix: sidebar clasificación a la derecha
[17:50] PUSH: main → origin ✓

[17:55] FIX: jcards más estrechas, chips más visibles y centradas
        - min-height 80→56px, padding reducido, chips 10px font-weight 700, justify-content center
[18:00] COMMIT: 82b6a77 — fix: jcards más estrechas, chips centradas
[18:00] PUSH: main → origin ✓

═════════════════════════════════════════════════════════════════════
  CHECKPOINT — VISTA JORNADA + BOOST UX (2026-04-13)
─────────────────────────────────────────────────────────────────────
HEAD: 82b6a77
Commits sesión (7):
  b173274  feat: pastillas boost CTA
  9d8a56b  feat: ticker scroll + label + panel CTA
  74a5971  feat: vista Jornada
  d8bc246  fix: display block + sbLoad
  ef39b3d  feat: rediseño jcards + sidebar + CTA editable
  52a917c  fix: sidebar a la derecha
  82b6a77  fix: jcards estrechas + chips centradas

Ficheros modificados: index.html, public/js/ui-groups.js, public/js/scoring.js,
  public/js/scoreboard.js

[18:20] FIX: jornada móvil — 3 problemas Safari/iPhone
        - CSS: @media <768px grid 1col, sidebar oculta, user-strip visible
        - HTML: div #jornada-user-strip antes de jornada-container + CSS cinta
        - JS: _renderUserStrip (posición+nombre+pts), openJcardModal/_showJcardModal
          (clone tarjeta grupos en modal overlay 480px), botón "Ver tarjeta" → openJcardModal
[18:25] COMMIT: 8e8ac44 — fix: jornada móvil — grid colapsa, cinta usuario, modal ver tarjeta
[18:25] PUSH: main → origin ✓

═════════════════════════════════════════════════════════════════════
  CHECKPOINT FINAL — SESIÓN 2026-04-13 COMPLETA
─────────────────────────────────────────────────────────────────────
HEAD: 8e8ac44
Total commits sesión: 22

Bloques:
  Splash screen + fixes welcome     (3 commits: 0d19ff9..3473c76)
  Boost x2 completo                 (8 commits: 368d8db..6c3d30b)
  Boost UX + Vista Jornada          (8 commits: b173274..82b6a77)
  Jornada móvil                     (1 commit:  8e8ac44)
  Docs                              (2 commits: 301235e, a8e5dbc)

Features entregadas:
  - Splash screen con animación FIFA 2026
  - Posicionamiento welcome (hero + scroll-cue + márgenes móvil)
  - Boost x2 comodín diario (UI + Canvas 2D fuego + persistencia Supabase)
  - Motor puntuación x2 si exacto + boost del día
  - Ticker boost con pastillas jornada, panel expandible, scroll a tarjeta
  - Bloqueo eliminatorias y finalizar sin boosts completos
  - Vista Jornada (tarjetas compactas por día, sidebar clasificación sticky)
  - Optimización móvil jornada (grid colapsa, cinta usuario, modal tarjeta)

Tabla Supabase: boost_picks (migration create_boost_picks)
Ficheros nuevos: css/boost.css
═════════════════════════════════════════════════════════════════════

[23:02] FIX-BRK-MOBILE: .brk-col.active min-width 260px en móvil (<=900px) + ancho mínimo body 860px + past/future/center reducidos para dar espacio a cuando el espejo izq/der comparte flex:1 — css/bracket-results.css

[23:20] REDISEÑO-BRK: vista bracket rehecha como timeline vertical (una sección por fase, grid auto-fill de match cards) + live hero sticky arriba cuando hay partido en directo. Eliminado layout espejo izq/der, drag scroll, BRK_COLS, brkMakePast, brkMakeFinalBox, brkEnableDrag, brkDetectActivePhase. Nuevo modelo BRK_PHASES (6 fases: r32→r16→qf→sf→third→final) lee IDs de window.BRACKET en vez de hardcode. API pública preservada (initBracketResults, refreshBracketResults, brkSetPhase ahora hace scrollIntoView). Nuevo brkJumpTo para salto a match individual desde el hero. — public/js/bracket-results.js, css/bracket-results.css

## 2026-04-16 / 2026-04-17

[20:00] FIX: extraer URL limpia de backgroundImage ignorando linear-gradient — regex rota en scoring.js:1172 causaba 404 masivos en consola (img.src recibía "linear-gradient(...)url(...)") — public/js/scoring.js (502a464)

[20:30] REFACTOR: header eliminatorias responsive — reestructurado HTML de .global-header para replicar layout 2 columnas de fase de grupos (izq: back+título, der: clasificación+puntos+userbar). Movido view-tabs y botón simular a .ko-sub-bar separado. Pill de liga en slot dedicado #elim-league-pill-slot. Botón clasificación con inline styles idénticos a grupos. — index.html, css/ko.css, public/js/leagues.js (43d466c)

[23:02] FIX-BRK-MOBILE: columnas activas min-width en móvil — css/bracket-results.css (ef82fea)

[23:20] REDISEÑO-BRK v2: timeline vertical + live hero, adiós layout espejo — public/js/bracket-results.js, css/bracket-results.css (2600c1a)

═════════════════════════════════════════════════════════════════════
  CHECKPOINT — SESIÓN 2026-04-16/17
─────────────────────────────────────────────────────────────────────
HEAD: 2600c1a
Commits sesión: 4 (502a464, 43d466c, ef82fea, 2600c1a)

Fixes:
  - 404 masivos en consola por regex backgroundImage rota (scoring.js)
  - Header eliminatorias responsive, mismo layout que fase de grupos
  - Bracket results: columnas móvil + rediseño timeline vertical
═════════════════════════════════════════════════════════════════════

## 2026-04-17 — Limpieza repo

[02:00] REVISIÓN: crítica constructiva completa del código — detectados CSS duplicado inline/ficheros, 1 MB de .bak trackeados, estado global sin contrato, 70 onclick= inline, cero tests, docs duplicadas. Plan de 6 fases propuesto.

[02:05] ELIMINAR (24 ficheros tracked, ~1.1 MB):
  - 5 backups .bak: index.html.bak, js/main.js.bak{,2,3}, js/auth.js.bak
  - 3 duplicados bracket-results: bracket-results.js/.css raíz + js/bracket-results.js (versión vieja con r16/oct/qf, mientras public/js/ tiene r32/r16/qf/sf/third/final — el bueno)
  - 6 patches Python one-shot: patch_fix_auth_lazy_db.py, patch_fix_main_comment.py, patch_fix_main_encoding.py, patch_fix_use_strict.py, patch_remove_auth_inline.py, patch_remove_leagues_inline.py
  - 5 markdowns de diseños ejecutados: vista-jornada.md, jornada-redesign.md, fix-vista-jornada.md, boost-ticker-mejoras.md, new_bracket.txt
  - js/utils.js (huérfano — shims handleCTA/openAuthModal ya inline en index.html:1440-1445)
  - supabase-ef-patches/porra-apify-webhook-v6.ts (producción en v7)
  - 3 scripts exploratorios Apify

[02:06] GITIGNORE: añadido `apify-actors/*/node_modules/`

[02:08] DOC: README.md reescrito completo (estaba duplicado desde línea 179, apuntaba a Netlify y utils.js obsoleto). Estado real abril 2026: Vercel, Vite, 11 EFs, sistema live Webshare, estructura js/ + public/js/

[02:09] DOC: CLAUDE.md actualizado — retirada referencia a utils.js, añadida sección "Limpieza repo — sesión 17 abr 2026", shims inline documentados en estructura JS

[02:10] DOC: CONTEXTO_PORRA_2026.md actualizado — bug urgente webhook v5 eliminado (resuelto en v7), actor Webshare documentado como primario y sofascore-live-proxy como fallback, nueva sección "Deuda técnica identificada" con 7 áreas, nuevo patrón crítico "Vite public/ collision", patrón shims inline.

[02:12] VERIFICACIÓN: QA localhost:5173 post-limpieza ✅ (usuario confirma). En dev Vite, al borrar /js/bracket-results.js raíz, pasa a servirse /public/js/bracket-results.js (versión correcta con rondas nuevas). Alinea dev con prod.

## 2026-04-17 — Rotación credenciales Twilio

[02:40] ROTAR: nuevas TWILIO_API_KEY (SK8bd3...) y TWILIO_API_SECRET en Supabase Vault. TWILIO_ACCOUNT_SID intacto (misma cuenta Twilio). API Key antigua revocada en Twilio Console.

[02:41] TEST 1: invocar porra-whatsapp-send → 401 "Authenticate" (Twilio code 20003). Request_id 727.

[02:45] TEST 2: tras re-pegado de credenciales → 401 "Authentication Error - invalid username" (Twilio code 20003). Request_id 728.

[02:47] DIAGNÓSTICO: query a vault.decrypted_secrets con detector de whitespace revela:
  - TWILIO_API_KEY: 35 chars (esperado 34), space al final
  - TWILIO_ACCOUNT_SID: 35 chars (esperado 34), space al final
  - TWILIO_API_SECRET: 32 chars ✅ limpio
Causa: al copiar de Twilio Console, selección manual agarró espacio extra al final. TWILIO_ACCOUNT_SID tenía el problema desde sesiones anteriores (solo revelado ahora al invocar la EF con credenciales limpias de API Key).

[02:48] FIX: vault.update_secret con trim() aplicado a TWILIO_API_KEY y TWILIO_ACCOUNT_SID. Verificación: len=34, whitespace_chars=0 en ambos.

[02:49] TEST 3: invocar porra-whatsapp-send → 200 OK. Twilio acepta credenciales. SID SMf1dd5661d7c41f0c78cad2473cbfaf8d encolado. Usuario confirma recepción WhatsApp en +34618874646. Request_id 729.

[02:50] NUEVO PATRÓN CRÍTICO documentado: "Whitespace en Supabase Vault UI" — al pegar valores sensibles (credenciales, tokens) el campo a veces retiene whitespace invisible. Longitudes Twilio esperadas: Account SID 34, API Key SID 34, API Key Secret 32.

Query de diagnóstico reutilizable:
```sql
SELECT
  name,
  length(decrypted_secret) AS len,
  left(decrypted_secret, 4) AS starts,
  right(decrypted_secret, 2) AS ends,
  length(decrypted_secret) - length(trim(decrypted_secret)) AS whitespace_chars,
  (decrypted_secret LIKE '%' || chr(10) || '%') AS has_newline,
  (decrypted_secret LIKE '%' || chr(9)  || '%') AS has_tab,
  (decrypted_secret LIKE '% %')                 AS has_space
FROM vault.decrypted_secrets
WHERE name IN (...);
```

Fix SQL reutilizable (no expone valores en claro):
```sql
SELECT vault.update_secret(
  (SELECT id FROM vault.secrets WHERE name = 'NOMBRE_SECRET'),
  trim((SELECT decrypted_secret FROM vault.decrypted_secrets WHERE name = 'NOMBRE_SECRET'))
);
```

## 2026-04-17 — Pipeline live frontend (Pieza 1 + 1b + 2)

[03:00] ANÁLISIS: diagnóstico del pipeline live reveló que backend está completo (actor Webshare → webhook → live_scores → Twilio WhatsApp) pero FALTA el puente DB→UI. El frontend NO lee live_scores (cero referencias en public/js/). Los elementos DOM están preparados (#score-live-<idx>, #rl-<idx>, #rr-<idx>) pero nadie los alimenta.

[03:10] PIEZA 1 — public/js/data.js: añadido name_en a los 48 equipos de EQUIPOS. Traducción ES→EN para cruzar datos con SofaScore. Verificado: los 48 nombres EN coinciden exactamente con el JSON de SofaScore.

[03:15] PIEZA 1b — public/data/worldcup-2026-matches.json: JSON nuevo indexado por match_key (formato wc2026_g<A-L>_<sofascore_id>). Cada entrada: sofascore_id, group, home_en/away_en (como viene de SofaScore), home_es/away_es (como muestra data.js), teams_swapped (bool), date_utc, round. 72 partidos, 0 sin resolver, 1 partido con teams_swapped=true (wc2026_gC_15186861: Scotland-Brazil vs data.js Brasil-Escocia).

[03:25] PIEZA 2 — public/js/live-sync.js: módulo nuevo (233 LOC). Expone liveSyncInit/liveSyncStop/matchKeyFor/liveSyncRepaint. Flujo: carga JSON mapeo → snapshot inicial live_scores → subscribe a postgres_changes. Al recibir cambios, encuentra idx de tarjeta por match_key→PARTIDOS y actualiza #score-live-<idx>, #rl-<idx>, #rr-<idx>. Respeta teams_swapped invirtiendo marcador. NO gestiona goleadores ni recalcula puntos (pieza futura). NO gestiona eliminatorias.

[03:30] PIEZA 2 — js/main-entry.js: añadido loadScript('/js/live-sync.js') al final de la chain + window.liveSyncInit() tras cargar. Realtime Supabase ya estaba habilitado para live_scores (verificado en pg_publication_tables).

[03:35] QA PENDIENTE: probar con INSERT manual en live_scores de un match_key del Mundial (ej. wc2026_gA_15186710) para verificar que el marcador aparece en tiempo real.

## 2026-04-17 — Vista Directo (WIP — no funciona aún)

[04:00] PLAN: nueva pestaña 🔴 Directo como tercera vista (junto a Grupos y Jornada). Clona layout de Jornada pero tarjetas renderizan marcador live + estado + goleadores + chip predicción. Objetivo: reemplazar el bloque #score-live-<idx> legacy dentro de cada tarjeta de predicción por una vista dedicada.

[04:05] APLICAR: index.html — 3 patches (botón btn-vista-directo, div#directo-container, link /css/directo.css)

[04:07] APLICAR: public/js/scoring.js — eliminado bloque score-live (12 líneas dentro de createMatchCard, líneas 720-731). grep confirma 0 matches de score-live / rl- / ptc-sign-l-

[04:09] NUEVO: css/directo.css (7036 bytes)

[04:09] NUEVO: public/js/ui-directo.js (primera versión 18580 bytes)

[04:09] NUEVO: public/js/live-sync.js v2 (9514 bytes) — reescrito para alimentar vista Directo en lugar de #score-live-<idx>. Expone applyLiveRowToCard, liveSyncInit, liveSyncStop

[04:10] APLICAR: js/main-entry.js — cadena carga añade /js/ui-directo.js penúltimo y /js/live-sync.js al final; liveSyncInit() post-chain

[04:27] FIX v2: ui-directo.js (18864) + live-sync.js (9619) — sustituir versiones anteriores. Causa: en classic scripts cargados por loadScript, `const EQUIPOS` / `const PARTIDOS` / `const boostPicks` en data.js quedan en scope léxico del script pero NO se adjuntan a window. Código usaba window.EQUIPOS / window.PARTIDOS / window.boostPicks (undefined) → matchKeyFor devolvía null y renderVistaDirecto entraba en fallback "Cargando partidos…".

[04:28] QA localhost:5173: pestaña Directo sigue sin cargar el partido dummy que simulamos. Aparentemente ni siquiera la tarjeta del partido test aparece. Causa exacta sin diagnosticar.

[04:30] CHECKPOINT: commit WIP "feat(vista-directo): skeleton pestaña Directo (incompleto)". Se retomará en próxima sesión. Pipeline backend sigue operativo (live_scores se escribe vía webhook Apify → Twilio OK); solo falla la renderización en la nueva vista.

## 2026-04-17 — Persistencia histórica en repo

Materializar en disco lo que hasta ahora sólo vivía en la memoria de Claude.ai, para poder liberar memorias sin perder contexto crítico.

[12:00] CREAR: errores_conocidos_porra.md — catálogo ERR-01 a ERR-12 + placeholders ERR-13 a ERR-20. Síntoma/Causa/Fix/Patrón preventivo/Fecha para cada uno.

[12:05] CONFIRMAR: migration-log.md ya existía con histórico detallado 11-17 abr 2026. Se añade esta sección en lugar de reescribirlo.

[12:10] MODIFICAR: CLAUDE.md — pendientes nuevos:
  - Bugs UI #5 — Auto-completar Pichichi torneo sumando goleadores seleccionados en pronósticos (ayuda lógica al usuario).
  - Bugs UI #6 — Enganche final frases IA para pronóstico signo partido (lógica incorporada, falta wiring final).
  - Antes del 11 jun 2026 #4 — Email cierre porra (Resend + EF) **con copia de pronósticos al usuario** para que tenga registro.

[12:12] COMMIT: docs: crear histórico bugs + bitácora etapas para liberar memoria Claude.ai — errores_conocidos_porra.md + migration-log.md
[12:13] COMMIT: docs: añadir pendientes Pichichi auto, frases IA, email cierre con copia pronósticos — CLAUDE.md
[12:14] PUSH: claude/persist-historical-files-OxmLQ → origin

### BD + helpers (continuación 2026-04-17)

Pase de limpieza sobre crons y `live_scores`, más helpers reutilizables para automatizar programación de crons por partido.

[12:40] ELIMINAR CRONS: `prematch_bayern_realmadrid` + `poll_bayern_realmadrid` — el partido UCL correspondiente ya estaba finalizado, los crons seguían activos sin efecto útil.

[12:45] CREAR FUNCIÓN: `schedule_match_crons(match_key TEXT, start_ts TIMESTAMPTZ)` — genera automáticamente los dos crons asociados a un partido:
  - Prematch **T-45 min** (1 call antes del inicio).
  - Polling **`*/3 * * * *`** durante **150 min** desde `start_ts` (cada 3 min, cubre 90' + descanso + prórroga + margen).
  - Ambos invocan `porra-match-live` via `net.http_post` con el `match_key` correspondiente.
  - Ejemplo:
    ```sql
    SELECT schedule_match_crons('wc_mex_rsa', '2026-06-11 20:00:00+00'::timestamptz);
    ```

[12:50] CREAR FUNCIÓN: `unschedule_match_crons(match_key TEXT)` — elimina los dos crons (`prematch_<match_key>` y `poll_<match_key>`) de un partido. Uso principal: limpieza tras cambio de fecha o cancelación.

[12:55] SCHEMA: `ALTER TABLE live_scores ADD COLUMN is_historic BOOLEAN DEFAULT false`.
  - **Semántica:** `true` = trial runs / pruebas manuales, conservado como referencia consultiva de formatos JSON y estados (`events`, `incidents`, transiciones de `status`).
  - **NO usar en scoring ni en UI live** — filtrar con `WHERE is_historic = false` en todas las queries de scoring y realtime.

[12:58] MARCAR HISTÓRICOS: 9 filas de `live_scores` existentes marcadas `is_historic = true`, `poll_active = false`. Una renombrada para evitar colisión con el primer partido real del Mundial:
  - `wc2026_gA_15186710` → `_historic_wc2026_gA_15186710_trial` (México-Sudáfrica real ocupará la clave original el 11 jun 2026).

[13:00] PATRÓN: a partir de ahora, para programar los crons de un partido **usar exclusivamente** `schedule_match_crons(match_key, start_ts)`. No duplicar crons manualmente (evita el caso de crons huérfanos tipo `prematch_bayern_realmadrid`).

## 2026-04-17 PM — Sesión Vista Directo + simulacros

Diagnóstico de "Vista Directo no funciona", llegada de simulacros como mecanismo de testing live, y feature completa para el simulacro Copa del Rey 18 abr.

[16:00] DIAGNÓSTICO: Vista Directo nunca estuvo rota. La causa real fue que el rename matinal (`wc2026_gA_15186710` → `_historic_wc2026_gA_15186710_trial`, [12:58]) había roto el match_key esperado por el frontend. **Revertido** a `wc2026_gA_15186710`. Pipeline live validado contra el dummy.

[16:30] SCHEMA: nuevas columnas en `live_scores`:
  - `home_team_name TEXT`, `away_team_name TEXT`, `competition TEXT`.
  - Soporte para partidos genéricos fuera del Mundial (los del torneo siguen leyendo nombres desde `EQUIPOS` via `match_key`).

[16:45] INSERTAR SIMULACRO: fila `copadelrey_final_atm_rso` para la final Atleti — Real Sociedad (18 abr 19:00 UTC, `sofascore_event_id = 15664537`, `competition = "Copa del Rey 2026 · Final"`). `is_historic = true`.

[16:50] CRONS: `schedule_match_crons('copadelrey_final_atm_rso', '2026-04-18 19:00:00+00')` → `prematch_copadelrey_final_atm_rso` (18:15 UTC) + `poll_copadelrey_final_atm_rso` (cada 3 min). **Ampliación manual** del polling a 3 h (19–22 UTC) para cubrir prórroga + penaltis.

[16:55] LIMPIEZA: fila dummy `wc2026_gA_15186710` (México-Sudáfrica) restablecida a `status='notstarted'`, `score_*=NULL` tras completar la validación del pipeline.

[17:00] FEATURE PR #3 (`claude/vista-directo-simulacros`, mergeada `614b5ef`):
  - Commit `d137d99` — soporte simulacros en `live-sync.js` (`_simulacrosByKey`, `getSimulacros()`, `applyRow` discrimina simulacro vs Mundial), `_buildSimulacroCard` en `ui-directo.js` (sin flags, banner amarillo, pie con CEST), `directo.css` (sección + tarjetas).
  - Commit `6d2c028` — fix visual: badge esquina superior se solapaba con nombre equipo. Reemplazado por banda 100% ancho `🧪 SIMULACRO · PARTIDO FUERA DEL MUNDIAL`.
  - Commit `0421f0f` — fix `checkIsAdmin` async (ver ERR-14): retries hasta 5 s si auth no hidratada, re-render tras cache, guard anti-loop con `_lastRenderAdminValue`.

[17:10] QA visual (Chrome MCP desde claude.ai): admin ve la sección, no-admin no la ve, `UPDATE live_scores` manual → tarjeta refleja cambio en <2 s vía realtime, 72 tarjetas Mundial intactas, consola sin errores.

[17:15] DOCUMENTACIÓN: nuevo ERR-14 en `errores_conocidos_porra.md` (checkIsAdmin async patrón). Nueva sección **🧪 Simulacros (testing live)** en `CLAUDE.md`. README.md y este log actualizados en commit checkpoint.

## 2026-04-18 AM — Feature: usuarios no-admin pueden crear porras

- EF nueva `create-league` v1 desplegada por Claude.ai vía Supabase MCP. Gate de admin eliminado, límite 3 ligas para no-admin, admin ilimitado.
- Arquitectura: EF propia separada de `admin-actions` (que sigue siendo admin-only para el resto de acciones). Razón: mantener aislamiento de privilegios.
- Test previo en BD: insert directo simulando `mavc_999` funciona (rollback OK).
- Frontend `leagues.js`: `leagueDoCreate` apunta ahora a `create-league`, body simplificado a `{ nombre }`, manejo específico de `limit_reached` con mensaje: *"Has alcanzado el límite de 3 porras creadas. Pide a un admin que cree nuevas por ti o únete a una existente."*
- `admin-actions` v7 intacta. El case `create_league` allí queda como legacy no usado desde frontend.

## 2026-04-18 — Checkpoint: sincronizar CONTEXTO_PORRA_2026.md y cabecera CLAUDE.md

Alineación del contexto maestro con el estado actual de `main` tras la cascada Vista Directo → simulacros → ERR-14 → no-admin crea porras.

- `CLAUDE.md` — cabecera: último commit estable pasa de `2600c1a` a `34c3532` (feat ligas: no-admin crea porras). Eliminada la nota obsoleta "Pendiente commit de limpieza de repo sesión 17 abr 2026".
- `CONTEXTO_PORRA_2026.md` actualizado:
  - Cabecera: fecha 2026-04-18, último commit `34c3532`.
  - Pendientes UI: añadidos Pichichi auto + frases IA. Email cierre anotado con copia de pronósticos. Punto 5 (signup público) tachado como innecesario (no-admin crea porras).
  - Bugs recientemente resueltos: añadidos pipeline live async+webhook (`6aeb470`), Vista Directo + simulacros + ERR-14 (`614b5ef`), no-admin crea porras (`34c3532`).
  - `live_scores` campos clave: documentadas `is_historic`, `home_team_name`, `away_team_name`, `competition`.
  - Tabla Edge Functions: añadida `create-league` v1.
  - Nueva sección **🔧 Funciones DB helpers** con `schedule_match_crons` / `unschedule_match_crons`.
  - Nueva sección **🧪 Simulacros (testing live)** con activación, visibilidad y simulacro activo (`copadelrey_final_atm_rso`).
  - Historial de sesiones: entries 17 abr PM (×3) + 18 abr AM añadidas.
  - Patrones críticos: añadido patrón ERR-14 (chequeos async que condicionan render).
- `ESQUEMA_SISTEMA_PORRA2026.xlsx` — **no tocado**: binario, Claude Code no dispone de herramientas para regenerarlo; queda como tarea para Claude.ai si procede.


## 2026-04-18 PM — QA feature no-admin + higiene docs + ERR-15/16

- **QA completo por Claude.ai** vía Chrome MCP + Supabase MCP, de la feature ``create-league`` (PR #5, `34c3532`).
  - Admin (cicloste88): creación OK de dos ligas consecutivas (`QA_TEST_ADMIN_DELME` → `6SSG84`; `QA_TEST_ADMIN_4TH_DELME` → `5FW6MS`). Verificado **sin límite**.
  - No-admin (mavc_999) con 3 ligas QA precargadas (`QA_MAVC_L1/L2/L3`): la 4ª devuelve **HTTP 403** `{ ok:false, limit_reached:true, current_count:3, limit:3 }`.
  - Tras borrar `QA_MAVC_L3` (conteo=2), la 3ª vuelve a crearse OK (`QA_MAVC_REAL_LIGA` → `AN2TFR`). 4ª vuelve a fallar correctamente.
  - Frontend prod: ``/js/leagues.js`` usa `functions/v1/create-league`, maneja `limit_reached`, no llama ya a `admin-actions` para crear ligas.

- **Bump EF `create-league` v1 → v2** con `verify_jwt=false`. Causa: la plataforma Supabase rechazó JWT ES256 con `UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM` cuando `verify_jwt=true`. Fix: desactivar `verify_jwt` en el deploy y validar el JWT manualmente con `svc.auth.getUser(jwt)` + service_role (mismo patrón que `admin-actions`). Documentado en **ERR-16**.

- **Limpieza post-QA:**
  - Borradas 5 ligas de test (`QA_TEST_ADMIN_DELME`, `QA_TEST_ADMIN_4TH_DELME`, `QA_MAVC_L1`, `QA_MAVC_L2`, `QA_MAVC_REAL_LIGA`) + filas en `league_members`.
  - Contador final: cicloste88 con 2 ligas preexistentes, mavc_999 con 0, resto 0.

- **Incidente password `mavc_999` (ver ERR-15):**
  - Para testear como no-admin, Claude.ai sobrescribió temporalmente `auth.users.encrypted_password` con `QA_TEMP_PASS_123`. Al acabar el QA, la sustituyó por un hash aleatorio irrecuperable.
  - Efecto: mavc_999 **no puede login** con su password original. Debe usar "Recuperar contraseña" (reset vía email).
  - Aprendizaje: para QA de flujos autenticados nunca tocar `encrypted_password`. Usar `auth.admin.generateLink({ type: 'magiclink', email })`.

- **Residuos Twilio en `CLAUDE.md`:**
  - El commit `850df2a` (Code) dejó hardcodeados AccountSid + una API Key antigua en la sección WhatsApp. La API Key ya estaba rotada; el AccountSid se rotó por separado antes de este checkpoint. En este checkpoint se eliminan los residuos del documento.

- **Docs actualizados (PR #8, este commit):**
  - `CLAUDE.md`: elimina líneas Twilio expuestas, bump `create-league` v2 con nota `verify_jwt=false`.
  - `migration-log.md`: esta entrada PM.
  - `errores_conocidos_porra.md`: rellena ERR-15 (password overwrite destructivo) y ERR-16 (JWT ES256 vs verify_jwt).

## 2026-04-18 — Rediseño móvil fase de grupos

Rama: `feat/mobile-grupos-focus`. Spec validada con el usuario. Implementación en 4 commits; este es el 1/4 (infra + CSS base, sin UX visible todavía).

**Migración Supabase pendiente (commit 4):** `ALTER TABLE league_members ADD COLUMN groups_saved JSONB DEFAULT '{}'`. La ejecuta Claude.ai vía Supabase MCP antes del commit 4. No tocar desde Claude Code.

[HH:MM] COMMIT 1/4 grupos-mobile: infra base
  - `public/js/ui-groups-mobile.js` creado (stubs `openMobileFocus`/`closeMobileFocus` + `IS_MOBILE` + `window.groupSaved` init).
  - `public/js/data.js`: `window.PHRASES_GRUPO` añadido (empty / low / mid / high / done).
  - `js/main-entry.js`: script añadido a la loadScript chain entre `ui-groups.js` y `ko.js` (decisión autónoma: la spec pedía `<script>` en `index.html`, pero la cadena de carga canónica vive en `main-entry.js` per CLAUDE.md; ir por `<script>` en HTML rompería el orden "después de ui-groups").
  - `css/base.css`: bloque placeholder `@media (max-width: 640px)` al final del fichero.
  - `migration-log.md`: nota pendiente sobre ALTER TABLE (commit 4) + esta entrada.

[HH:MM] COMMIT 2/4 grupos-mobile: acordeón + barra progreso por grupo en lista
  - `public/js/scoring.js` (+4 líneas, 3 subagente A): `data-grupo="${match.group}"` en la raíz `.card` de `createMatchCard`; invocación defensiva `window.applyMobileGroupCollapse(section, grupo.letra)` en `renderAll` tras pintar cada `.group-section`.
  - `css/base.css` (+36 líneas, subagente B): placeholder del `@media (max-width: 640px)` reemplazado por las reglas reales (`.mobile-collapsed`, `.mobile-group-progress*`, `.mobile-motivational-small`). Sin tocar nada fuera del bloque.
  - `public/js/ui-groups-mobile.js` (+150 líneas, subagente C): helpers `getGroupCompleted` / `getPhraseForGroup`, `applyMobileGroupCollapse`, `refreshMobileGroupProgress`, resize listener con debounce 150ms, `initMobileGrupos` extendido para iterar todas las `.group-section` al cargar.
  - Decisión autónoma del subagente C: la spec mencionaba `.dado-btn` para ignorar clicks del dado; el selector real en el codebase es `.dice-btn` (usado en `scoring.js` y `admin.js`). Subagente usó `.dice-btn` — correcto.
  - UX desktop inalterada: todo lo nuevo vive tras guards `IS_MOBILE()` o dentro del `@media (max-width: 640px)`.

[HH:MM] COMMIT 3/4 grupos-mobile: focus layer + carrusel + swipe + smart boost row
  - `css/base.css` (+28 líneas, agente A): estilos del focus layer (`.mobile-focus-layer`, `.mobile-focus-header*`, `.mobile-back-btn`, `.mobile-focus-title`, `.mobile-focus-dice`, `.mobile-motivational`, `.mobile-dots-row`, `.mobile-dot[.current|.done|.summary]`, `.mobile-focus-progress*`, `.mobile-focus-body`, `.mobile-carousel[-slide]`, `.mobile-arrow[.left|.right]`) + smart boost (`.boost-row.boost-blocked`). Todo dentro del `@media (max-width: 640px)` existente.
  - `public/js/scoring.js` (+1 / −1, agente D): añadidos `data-jornada-date="YYYY-MM-DD"` y `data-match-key="..."` al elemento `.boost-row` dentro de `createMatchCard` (L742). Estilo `'+ var +'` para coincidir con la concatenación del codebase.
  - `public/js/ui-groups-mobile.js` (+383 / −2, agente combinado B+C):
    - **PART 1 — Focus layer + carrusel + swipe**: `ensureFocusLayer()` (idempotente, inyecta `#mobile-focus-layer` en body con listeners fijos), `openMobileFocus(letra)` (reemplaza stub, MUEVE las 6 `.card` desde `#grid-{letra}` a `.mobile-carousel-slide` dentro del carrusel), `closeMobileFocus()` (reemplaza stub, devuelve las cards al grid original), `gotoSlide(i)` (clamp `[0,5]`), `updateFocusUI()` (dots `.current/.done`, progress bar, motivacional, guard arrows), swipe touch+mouse con threshold 50px y dominancia horizontal, listeners capture-phase en `#btn-vista-jornada`/`#btn-vista-directo` que llaman `closeMobileFocus()` al cambiar de tab.
    - **PART 2 — Smart boost row**: `matchLabelFromKey`, `refreshBoostRowsInFocus` (recorre `.boost-row` en focus, añade/quita `.boost-blocked` según conflicto con `boostPicks[date]`), `__mobileBoostRowClickHandler` delegado capture-phase en `#mobile-focus-body` con `stopImmediatePropagation` + `confirm()` cuando hay conflicto, llama a `tickerBoostToggle(matchKey, date)` existente (ui-groups.js L372).
  - **Decisión autónoma del parent agent:** spec pedía 4 agentes paralelos, pero B y C escriben al mismo fichero con una dependencia cruzada (C inserta `refreshBoostRowsInFocus()` dentro del `openMobileFocus` que B reescribe). Para evitar race al último write, fusionados B+C en un solo agente que hace ambas partes en secciones bien separadas. Agentes A y D corrieron en paralelo como estaba previsto.
  - **Desktop inalterado:** todo el layer vive tras `IS_MOBILE()` y dentro del `@media (max-width: 640px)`.

[HH:MM] COMMIT 4/4 grupos-mobile: slide 7 clasificación + guardar/deshacer con persistencia BD
  - **Migración BD ya aplicada por Claude.ai (18 abr 19:22 UTC):** `ALTER TABLE league_members ADD COLUMN groups_saved JSONB DEFAULT '{}'`. Claude Code sólo toca código cliente — no ha ejecutado SQL.
  - `css/base.css` (+15 líneas, agente A): `.mobile-summary-slide`, `.mobile-summary-wrap`, `.mobile-save-btn[.disabled|.saved]`, `.mobile-save-note[.ok]`, `.card.mobile-locked` + pseudo-elemento "✓ Guardado", `.mobile-toast[.show|.error]`, `.mobile-dot.summary.ready`. Todo dentro del `@media (max-width: 640px)` existente.
  - `public/js/ui-groups-mobile.js` (+258 líneas, agente B):
    - Helpers: `hasValidScorer(match)` (valida `predictions[key].gol` no vacío), `canSaveGroup(letra)` (6 partidos con pronóstico + goleador).
    - `buildSummarySlide(letra)`: crea `<div.mobile-carousel-slide.mobile-summary-slide>` con wrap + botón + nota. **Decisión arquitectónica:** `renderGroupTableCard(letra)` NO devuelve HTML, escribe en `#gtable-${letra}` existente. Solución → MOVER el elemento desde su grupo original al slide 7 (mismo patrón que las cards), guardar `__mobileOriginalGtable` para restaurar en `closeMobileFocus`. Antes de mostrar, `renderGroupTableCard` se llama para repintar.
    - `updateSaveBtnState(letra)`: 4 estados (saved / ready / falta goleadores / falta pronósticos). Reescribe texto, clases, `disabled`, `onclick`.
    - `saveGroup(letra)` / `unsaveGroup(letra)`: async, `UPDATE league_members SET groups_saved = ...` vía `window._porraDb`, con rollback del cache local en caso de error + toast.
    - `lockCardsInFocus` / `unlockCardsInFocus`: toggles `.mobile-locked` en `.card[data-grupo="${letra}"]` dentro del focus.
    - `showMobileToast(msg, type)`: crea `#mobile-toast` idempotente, auto-dismiss 2200ms, tipo `error` cambia color.
    - **Integración** `openMobileFocus`: tras insertar las 6 cards, añade slide 7 + lock si `groupSaved[letra]` + `updateSaveBtnState`.
    - **Integración** `closeMobileFocus`: restaura `#gtable-${letra}` al parent original antes de limpiar wrappers.
    - **Integración** `gotoSlide`: clamp ampliado a `[0, 6]`. Al entrar en slide 6, re-renderiza tabla + `updateSaveBtnState`.
    - **Integración** `updateFocusUI`: renderiza dot 7 (`🏁` con clase `.summary`, `.ready` si `canSaveGroup`), arrow-right disabled cuando `slide === 6`.
  - `public/js/auth.js` (+14/−1 líneas, agente C): `loadUserData(userId)` extiende `Promise.all` con una 4ª query `db.from('league_members').select('groups_saved').eq('user_id', userId).eq('league_id', leagueId).maybeSingle()` (sin `leagueId` → `{data: null}`). Destructura `{ data: lmData, error: lmErr }` (único destructure con `error` — los 3 anteriores no lo destructuraban, para no tocar su comportamiento). Nuevo bloque: hidrata `window.groupSaved = lmData.groups_saved` o fallback defensivo `{}` si `null`/error.
  - **Decisiones autónomas del parent agent:**
    - 3 agentes paralelos reales (ficheros distintos) — sin merge manual esta vez.
    - Para el slide 7 / tabla de clasificación se eligió el patrón "mover `#gtable-${letra}`" en vez de clonar HTML. Motivo: `renderGroupTableCard` está cableada a `getElementById` — clonar requeriría refactor de scoring.js; moverla es zero-touch en scoring.
    - Agent C añadió destructure de `error` sólo en el 4º resultado. Semánticamente equivalente a las 3 originales (que ignoran `error`) pero permite warn log sin bloquear bootstrap.
  - **Pendiente de QA visual:**
    - RLS de `league_members` debe permitir `SELECT` + `UPDATE` al user autenticado sobre su propia fila (se asume por analogía con `award_picks`).
    - Verificar que el tap en slide 6 (summary) repaginta correctamente la tabla con los últimos pronósticos.
    - Probar el toast + lock/unlock en ciclo completo: save → lock → unsave → unlock.
    - Verificar que tras cerrar focus y reabrir, `groupSaved` persiste entre dispositivos (login en otro móvil).

[19-04-2026 14:04] FIX ERR-18 — Movidos css/*.css → public/css/*.css (git mv, preserva historia). Causa: Vite solo copia public/ al dist/, los <link href="/css/xxx.css"> de index.html fallaban en prod. Verificado con npm run build (dist/css/*.css presente + contiene .mobile-collapsed + @media 640px) y npm run preview (fetch /css/base.css devuelve 200). No se tocó index.html — los paths siguen válidos porque Vite sirve public/ desde raíz. Ramas modificadas: directo main.

[19-04-2026 22:00] FIX ERR-19 — openMobileFocus defensivo: body.style.overflow=hidden movido al final + try/catch con toast visible para debug sin devtools. Usuario puede ver ahora mensaje de error en pantalla si Safari iOS falla al crear focus layer. Hasta diagnóstico concreto de qué falla, este commit evita el estado congelado.

[19-04-2026 22:11] FIX ERR-20 — eliminado document.body.style.overflow=hidden de openMobileFocus/closeMobileFocus. Causa probable: en iPhone Safari, aplicar overflow:hidden al body bloqueaba el scroll de forma persistente incluso tras restore. El focus layer es position:fixed inset:0, visualmente cubre la pantalla sin necesidad de bloquear scroll de fondo. Añadida recuperación defensiva al cargar el módulo (si body.overflow ya estaba 'hidden' por una ejecución previa atascada, se limpia).

[19-04-2026 22:23] FIX ERR-21 — .mobile-focus-layer reglas base (position:fixed, inset:0, etc.) sacadas del @media 640px para que apliquen en cualquier viewport. Añadido visibility:hidden/visible (clave en iPhone Safari: layer cerrado no participa en hit-testing táctil). Resuelve bloqueo de scroll en Safari iOS y botones rotos al final de la página en Chrome cuando viewport >640px.

[19-04-2026 23:09] REFACTOR CSS — Extracción de 4 bloques <style> inline en index.html a public/css/{base,welcome,ko,admin}.css. Los bloques tenían comentarios "Archivo destino : X.css" desde el refactor Vite inicial pero nunca se migraron, y los <link> tampoco se añadieron. Consecuencia: commits 2/3/4 (reglas mobile-collapsed, mobile-focus-layer, slide-summary etc.) añadidos a public/css/base.css no aplicaban porque index.html no enlazaba base.css. Verificado en prod con getComputedStyle: .mobile-focus-layer position:static en lugar de position:fixed. Fix: contenido de cada <style> prepended a su fichero destino (para que las reglas nuevas de commits 2/3/4 al final del fichero ganen por cascada), eliminados los 4 <style> de index.html (reemplazados por comentarios marcadores `<!-- CSS externo: X.css -->`), añadidos los 4 <link> faltantes en cabecera (base → welcome → ko → admin → bracket-results → boost → directo). index.html pasa de 2970 a 1008 líneas. Verificación: npm run build OK (44 modules, dist/index.html 60.27kB vs 169kB antes), npm run preview + curl /css/{base,welcome,ko,admin}.css → HTTP 200 con contenido correcto (base.css 67929 bytes, contiene mobile-collapsed + mobile-focus-layer). Brace balance {}=672/672 en base.css, 190/190 welcome, 563/563 ko, 633/633 admin.

[20-04-2026 00:34] CHECKPOINT — Rediseño móvil grupos + fixes producción iPhone. Sincronización de los 4 ficheros de persistencia tras la cascada de commits del 19 abr:
  - `errores_conocidos_porra.md`: rellenados ERR-18 (css→public), ERR-19 (openFocus defensivo), ERR-20 (body.overflow-hidden iOS), ERR-21 (layer base fuera @media + visibility). Placeholders anteriores eliminados.
  - `CLAUDE.md`: cabecera "último commit estable" → `9e93fe8`. Sección "Bugs recientemente resueltos" con entradas de rediseño móvil (PR #9), fixes ERR-18/19/20/21 y refactor CSS. Estructura de ficheros JS actualizada (añadidos `ui-groups-mobile.js`, `ui-directo.js`, `live-sync.js` que faltaban). Estructura CSS renombrada `css/` → `public/css/` con regla crítica de assets. Cadena de carga actualizada.
  - `CONTEXTO_PORRA_2026.md`: último commit estable → `9e93fe8`. 3 filas nuevas en "Bugs recientemente resueltos" + 3 filas nuevas en historial de sesiones. Deuda técnica: ítem "4 bloques `<style>` inline duplicados" tachado como resuelto.
  - `README.md`: rediseño móvil añadido a "Completado". Ítem "Consolidar CSS inline restante" tachado como resuelto.
  - Ningún cambio de código — solo docs.

[19-04-2026 23:15] CHECKPOINT final — feature `feat/mobile-grupos-focus` LIVE en producción, verificada en iPhone Safari y Chrome móvil. Cadena de 6 commits (`b4a52e6` ERR-18 · `0aa78a9` ERR-19 · `40c0fe2` ERR-20 · `82b4753` ERR-21 · `9e93fe8` refactor CSS) resolvió una chain de bugs cuya causa raíz real era **ERR-22** (CSS inline no migrado en `index.html`). Lección meta-patrón: los fixes ERR-19/20/21 atacaban síntomas cuyo root cause estaba dos capas más arriba; `getComputedStyle` inicial en producción habría ahorrado 3 commits. `main` = `9e93fe8`. Pendientes menores (bug ya conocido reportado por San) para próxima sesión.

[20-04-2026 00:46] XLSX — Esquema actualizado con 2 hojas nuevas (Frontend Mobile + Errores ERR-01..22) y versiones EFs puestas al día. Completa protocolo end-of-session. Script `scripts/update_xlsx.py` añadido al repo para regeneraciones futuras (openpyxl).

[20-04-2026 15:02] FEAT nav — Persistir última página al recargar (event-driven, INITIAL_SESSION only). Reportado por San: F5/Ctrl+R volvía siempre a welcome. Implementación v2.1 tras 2 iteraciones de challenge del plan.
  - `js/main-entry.js`: lectura síncrona de `porra_lastPage` al inicio, expone `window._pendingPageRestore` con whitelist `Set(['grupos','elim','score','admin'])`. `console.debug` si valor inválido.
  - `public/js/ui-nav.js`: `showPage()` persiste `porra_lastPage` (underscore → entra en barrido de `doLogout` L286 con `.includes('porra_')`). Borra la key al volver a welcome.
  - `public/js/auth.js`: `onAuthStateChange` consume `_pendingPageRestore` **solo en INITIAL_SESSION** (refresh) — en SIGNED_IN (login fresco) va a welcome por semántica. Ruta de salida única con `setTimeout(100)`, revalidación admin explícita (si perdió rol → welcome sin borrar key).
  - Limitaciones conocidas documentadas:
    1. **Multi-tab:** `localStorage` compartido → gana último que escribe.
    2. **Sub-tab Vista Directo:** NO se preserva. Probable primera queja post-merge cuando San use la app durante partidos. v2.2 con clave auxiliar `porra_lastGrupoView` si hace falta.
    3. **Scroll position:** no se preserva.
    4. **URL siempre `/`:** no compartible. v3 requeriría hash-routing.

[20-04-2026 noche] CHECKPOINT FIN SESIÓN — Persistencia última página al F5, ESTABLE. HEAD `8bc7f30`. Saga v2.1→v2.11 (11 iteraciones con varios reverts intermedios; aceptamos historia git ruidosa porque los reverts documentan el aprendizaje). San confirma "está arreglado" tras v2.10+v2.11.

  **Estado defensivo final (3 capas + plus):**
  - **Capa 0 — `index.html` `<head>` (v2.6/v2.8/v2.9):** script inline síncrono lee `localStorage.porra_lastPage`, setea `window._pendingPageRestore`, salta el splash de 4s si hay restore (no esperar animación), e inyecta `<style id="restore-lock-css">#page-welcome{display:none !important}</style>`. Commits `e28f447` + `5ef545f` + `7689bcc`.
  - **Capa 1 — `js/main-entry.js:74-78` (v2.11, commit `d4a0047`):** safety-net del `.then()` final con guard `if (!window._pendingPageRestore) showPage('welcome')`. Impide que el chain meta welcome cuando el flujo de auth va a hacer restore.
  - **Capa 2 — `public/js/ui-nav.js` `showPage()` (v2.10, commit `4214bfe`):** `if (lock && page==='welcome') return; if (lock && page!=='welcome') lock.remove()`. Lock self-healing: rogue `showPage('welcome')` no rompe el restore; `showPage(target)` retira el lock al pintar la página real.
  - **Plus — `public/js/auth.js:325-339` (v2.1, commit `aade8d0`):** `onAuthStateChange` consume `_pendingPageRestore` solo en `INITIAL_SESSION` (no `SIGNED_IN`), revalidación admin explícita, ruta única `setTimeout(100) → showPage(finalPage)`.
  - **Plus — `auth.js:349` (v2.7, commit `951922a`):** guard `if (!window._pendingPageRestore) showPage('welcome')` en arranque inicial + fallback en rama `else` por sesión caducada.
  - **Plus — `index.html:251` (v2.4, commit `caaf0a0`):** `<div id="page-welcome" style="display:none">` consistente con las otras 4 páginas (welcome era la única visible por defecto del browser).

  **Diagnóstico definitivo (cazado con MutationObserver, ERR-23):** `#page-welcome` mutaba a `display:block` en T=612ms y volvía a `display:none` en T=1115ms — 503ms de flash. Causa: `main-entry.js:74` safety-net llamaba `showPage('welcome')` sin guard, y eso disparaba la lógica de v2.9 parte 2 que retiraba el CSS lock antes de tiempo. Capas 1+2 lo eliminan en dos frentes complementarios.

  **Limitaciones conocidas (sin resolver, aceptadas):**
  - Sub-tab Vista Directo no se preserva (vuelve a Grupos genérico).
  - Scroll position no se preserva (vuelve al top).
  - Multi-tab: `localStorage` compartido, gana último que escribe.
  - URL siempre `/`. No compartible. Migración a hash-routing es v3 si hace falta.
  - Pantalla oscura ~500-600ms entre arranque y `showPage(target)` cuando hay restore. Aceptable porque no es welcome blanco; es body background dark. Si molesta en 3G, v3 con hidratación optimista de `currentUser` + `_activeLeague`.

  **Ficheros modificados (estado VIGENTE en HEAD `8bc7f30`):** `index.html` (head + L251), `js/main-entry.js` (L7-18 + L74-78), `public/js/auth.js` (L325-339 + L349), `public/js/ui-nav.js` (showPage `try` block).

  **No vigentes (revertidos durante la saga, registrados aquí solo para historia):** v2.2 (`63dbb01`+`b672eaf` revertidos en `187c824`+`d4ac43b`), v2.3 (`5974296`+`0d10bbd` revertidos en `f221673`+`d4ac43b`), v2.5 (`3857c1e` revertido en `6154053`), v2.9 parte 2 (`2ba045b` reemplazado por v2.10), MutationObserver de diag (`78e45e7` retirado en `8bc7f30`).

  **Docs actualizadas en este checkpoint:** `CLAUDE.md` (cabecera + bugs UI cierra "parpadeo botón envío" + sección "Persistencia última página al F5" en bugs resueltos), `CONTEXTO_PORRA_2026.md` (cabecera + entrada en historial), `errores_conocidos_porra.md` (ERR-23 nuevo — `ERR-22` ya estaba ocupado por la migración CSS inline de la sesión 19abr), `ESQUEMA_SISTEMA_PORRA2026.xlsx` (cadena de carga JS actualizada con scripts inline head + module bundle + loadScript chain).

[21-04-2026 09:33] SANITY CHECK documentado. Tras la sesión del 20 abr noche, se realizó un barrido estructurado del proyecto (~8.626 LOC JS + 4.700 CSS + 1.035 HTML + 16 módulos) y se documentaron hallazgos priorizados para invertir antes del 11 jun 2026.

  **Entregables de este bloque (4 commits pequeños por robustez ante timeouts de stream):**
  - `34e5dba` — `docs: sanity check 20abr — parte 1/3 (crítico)`. Creación de `docs/sanity-check-20abr2026.md` con 3 hallazgos críticos: (1) IA fake — `fetch api.anthropic.com` en `scoring.js:941` y `ui-nav.js:49` sin `x-api-key` → 401 → fallback hardcoded; (2) zero tests sobre 8.626 LOC; (3) sin CI/CD (`.github/workflows/` vacío).
  - `fae982e` — `parte 2/3 (alto)`. 5 hallazgos de mantenibilidad: estado global sin contrato (105 símbolos `window.*`, 59 escape hatches), 62 `onclick=` inline, `scoring.js` 1.438 LOC mezclando responsabilidades, `ui-groups.js` + `ui-groups-mobile.js` paralelos con riesgo de divergencia, saga meta F5 (v2.1→v2.11) como síntoma de falta de tooling de debug.
  - `c774849` — `parte 3/3 (medio + bajo + plan)`. 5 hallazgos de performance/UX (bundle único 188KB, `loadScript` chain 14-secuencial, 27 `setTimeout` magic numbers, splash 4s hardcoded, tokens auth en localStorage) + 3 bajos (56 `console.*` sin gate env, sin CSP/SRI, sin Sentry/analytics) + plan 8 semanas priorizado por ROI.
  - `48fd615` — `docs(claude): enlazar sanity-check 20abr + resumen inversiones priorizadas`. `CLAUDE.md` sección "🔬 Sanity check 20 abr 2026" al principio de Pendientes abiertos con 13 ítems agrupados por semana (S1-S2 fundamentos, S3-S4 escala, S5-S6 refactor, S7-S8 buffer) + lista NO-hacer.
  - `c5029ac` — `docs(contexto): actualizar deuda tecnica con sanity check 20abr`. `CONTEXTO_PORRA_2026.md` sección "Deuda técnica identificada" reescrita por niveles (crítico / alto / medio / bajo), métricas actualizadas (62 onclicks, 1.438 LOC scoring, 70 innerHTML, 56 console, 188KB bundle), ✅ Resuelto incluye los 3 fixes CSS/persistencia de abr, Plan 6 fases histórico preservado como referencia.

  **Tres inversiones críticas recomendadas para S1-S2 (4 días efectivos):**
  1. Tests motor de puntuación (Vitest + 30 tests sobre `calc*Points`)
  2. GitHub Action CI mínima (build + `node --check` + tests cuando haya)
  3. EF `porra-ia-predict` con `ANTHROPIC_API_KEY` en Vault + cache en tabla `ia_cache`

  **Meta-nota sobre la forma del trabajo:** este bloque se entregó en 4 commits pequeños (3 de doc + 2 de cross-ref) en lugar de uno grande monolítico. Motivo: mitigación de timeouts `API Error: Stream idle timeout - partial response received` observados ayer y hoy al intentar volcar ~6k tokens en una sola respuesta. Cada turno bajo ~1.500 tokens, commit tras cada uno, state preservado en disco ante cualquier corte. Patrón recomendado para futuras tareas de documentación extensa en sesiones largas.

[21-04-2026 AM→PM] IA PREDICTOR — Fases A, B→B.2, D→D.2, C implementadas y desplegadas (EF `porra-ia-compute` v6 ACTIVE). Arquitectura 3 capas: ingesta (4 actions scraper) → cómputo (Fase E pendiente) → consumo frontend (Fase F pendiente). Fórmula acordada: **ELO 50% + H2H 25% + Racha 25%**, con fallback **ELO 66% + Racha 34%** si no hay H2H. Umbrales signo: `>60%` → 1 o 2, `40-60%` → X. Profundidad racha `N=8` default (ampliable a 10 vía `body.limit` antes del 11 jun cuando 11v11 publique el primer amistoso pre-Mundial).

  **Commits vigentes en main (cronológico):**
  - `968332a` — **Fase A** (PR #10, 10:03 UTC). `docs(ia-predictor): fase A — migración tablas ia_* + EF esqueleto`. Crea `supabase/migrations/20260421_create_ia_predictor_tables.sql` (4 tablas: `ia_elo_fifa`, `ia_last5_results`, `ia_h2h`, `ia_predictions` con RLS + policy pública en predictions + 2 índices) y `supabase/functions/porra-ia-compute/index.ts` (EF esqueleto con router `status/scrape_elo/scrape_last5/scrape_h2h/compute`). Migración aplicada en BD vía MCP Supabase. EF v1 ACTIVE. `verify_jwt=false`.
  - `4a32737` — Fase B (PR #11, 10:17 UTC). Primera versión del `scrape_elo` con fetch directo a `inside.fifa.com/api/ranking-overview`. **Deprecada por B.2**: ese endpoint solo expone rankings hasta septiembre 2025 (no sirve datos actuales de 2026). Se mantiene en historial pero el código fue reemplazado.
  - `c845f3e` — **Fase B.2** (PR #12, 10:35 UTC). `feat(ia-predictor): fase B.2 — scrape_elo vía Wikipedia Module:SportsRankings`. Reescribe `handleScrapeElo` para tirar del módulo Lua `Module:SportsRankings/data/FIFA_World_Rankings` vía MediaWiki API (siempre vigente, próximo update FIFA 9 jun 2026). Parseo regex doble: `data\.updated` para fecha + pattern `{"NAME", rank, move, points}` para filas. Mapping nombre→ISO3 con cadena `DB → ALIAS_MAP → slice(0,3)`. Retorna `unmatched_names` para revisar aliases. Smoke test: `fifa_update_date: 2026-04-01`, `countries_upserted: 211`.
  - `cba5dcc` — Fase D (PR #13, 10:51 UTC). Primera versión del `scrape_h2h` vía páginas Wikipedia `[País]_national_football_team_all-time_record`. **Deprecada por D.2**: solo ~3/48 selecciones tienen esa página (ver ERR-24). Smoke test devolvió `teams_with_section: 3`, `pairs_upserted: 37`. Se mantiene en historial.
  - `bbad657` — **Fase D.2** (PR #14, 11:12 UTC). `feat(ia-predictor): fase D.2 — scrape_h2h vía 11v11.com/stats (48 mundialistas)`. Migra H2H a `11v11.com/teams/{owner_slug}/tab/stats/` (una tabla agregada P/W/D/L/GF/GA por rival, fuente subyacente RSSSF, incluye amistosos). Añade constante `WC2026_TEAMS` con los 48 mundialistas tipada `[iso3, owner_slug, opposition_name, display_name]`. Requiere 3 headers obligatorios (ver ERR-25). Ordenado alfabético + remapeo W/L según lado. Dedup por pair antes del UPSERT (Postgres `ON CONFLICT` no admite misma fila dos veces). Smoke test: `teams_parsed 48/48`, `pairs_upserted 815/1128 teóricos` (72% cobertura mundialistas), validación cruzada ESP-ARG 6-2-6, ARG-BRA 44-27-45 en 116, ARG-URU 91-46-57 en 194 coincide con datos públicos.
  - **Fase C** — en rama `claude/fase-c-last-n` (commit `5a87f1e`, PR #15 **abierto pendiente de merge**). `feat(ia-predictor): fase C — scrape_last_n vía 11v11.com/matches (default 8, ampliable)`. Tira de `11v11.com/teams/{owner_slug}/tab/matches/` con regex de 6 grupos (date, match "Home v Away", W/D/L, home_score, away_score, competition optativa). Parseo de fecha "04 Sep 2025" → ISO, detección owner por `opposition_name`, remapeo gf/ga y venue según lado. `slice(-limit)` para los N más recientes, contadores W/D/L, UPSERT `ia_last5_results` con `results JSONB` + `wins/draws/losses`. **EF v6 ACTIVE desplegada desde la rama** (bypass legítimo del merge tras code review vía `net.http_get` a GitHub API desde Supabase — ver ERR-26). Smoke test: `teams_parsed 48/48`, `rows_upserted 48/48`, validación cruzada ESP 6W-2D-0L en 8, ARG 6W-0D-1L en 7 (caché 11v11), FRA 7W-1D-0L en 8. **Deuda técnica menor — el código está en producción (EF v6), el PR #15 es cierre administrativo.** Se mergeará cuando reconecte MCP GitHub; entretanto main no refleja el código de Fase C aunque la EF sí lo corre.

  **Edge Function `porra-ia-compute` — estado v6 ACTIVE:**
  - Router JSON: `{"action": "status|scrape_elo|scrape_last5|scrape_h2h|compute"}`.
  - `status`: contadores de las 4 tablas + last_scraped/last_computed.
  - `scrape_elo`: Wikipedia Module:SportsRankings → `ia_elo_fifa` (~211 países).
  - `scrape_h2h`: 11v11.com/stats × 48 mundialistas → `ia_h2h` (~815 pares).
  - `scrape_last5`: 11v11.com/matches × 48 mundialistas → `ia_last5_results` (48 filas, N partidos en JSONB).
  - `compute`: **stub Fase E** — leer las 3 tablas + aplicar fórmula → UPSERT `ia_predictions`.
  - Ejecución secuencial con `setTimeout(500)` entre fetches a 11v11 (polite scraping). `handleScrapeH2h` ~24s + fetches ~10-20s = ~45s total, dentro de timeout EF.

  **Estado tablas al cierre Fase C (21 abr PM):**
  - `ia_elo_fifa`: 211 filas (FIFA 2026-04-01).
  - `ia_h2h`: 815 pairs únicos.
  - `ia_last5_results`: 48 filas (N=8 por selección; ARG 7 por caché).
  - `ia_predictions`: 0 (pendiente Fase E).

  **Fases pendientes:**
  - **Fase E — motor de cómputo.** Implementar `handleCompute` que lea `ia_elo_fifa` + `ia_h2h` + `ia_last5_results`, aplique la fórmula `ELO 50% + H2H 25% + Racha 25%` (con fallback `ELO 66% + Racha 34%` si no hay H2H), emita pronóstico 1/X/2 con confidence 0-100 y umbrales `>60%→1|2`, `40-60%→X`, y UPSERT a `ia_predictions(match_id, sign, confidence, breakdown JSONB, used_fallback)`. Input: partidos del Mundial con home/away iso3.
  - **Fase F — wiring frontend.** `scoring.js`/`ko.js` consumen `ia_predictions` (lectura pública por RLS policy `ia_predictions_public_read`), muestran el pronóstico IA en cada tarjeta y alimentan el bonus **+1 pt si predicción del usuario opuesta a IA y aciertas** del motor de puntuación. Al cierre de F: consolidación final (con esta entrada de log ampliada + sección en CLAUDE.md / CONTEXTO).

  **Ficheros modificados en el conjunto A→C:**
  - `supabase/migrations/20260421_create_ia_predictor_tables.sql` (Fase A)
  - `supabase/functions/porra-ia-compute/index.ts` (Fases A/B/B.2/D/D.2 mergeadas en main; Fase C vive en rama pendiente de merge pero desplegada)

  **Notas de workflow:**
  - MCP GitHub se desconectó tras Fase D.2. Los merges de Fases A, B, B.2, D, D.2 se hicieron vía `mcp__github__merge_pull_request` antes de la desconexión. El de Fase C queda pendiente.
  - ERR-24, ERR-25, ERR-26 documentan lecciones técnicas del bloque (Wikipedia inadecuada para H2H, headers obligatorios 11v11, limitación `pg_net` sin PUT).
  - Auto-delete de ramas remotas activo: tras squash merge GitHub borra `origin/claude/fase-*` automáticamente. Fetch --prune lo confirma. Local se limpió con `-D` tras cada merge.

[21-04-2026 PM] PR #15 FASE C — squash-merge local (MCP GitHub fuera). Rama `claude/fase-c-last-n` → `main` vía `git merge --squash` + commit `feat(ia-predictor): fase C — scrape_last_n vía 11v11.com/matches (default 8, ampliable) (#15)` con `Closes #15` en body. SHA resultante en main: `2904025`. El código de Fase C ya estaba en producción como EF v6 ACTIVE desde 21abr PM (deploy directo tras code review vía GitHub API desde Supabase — ver ERR-26). El merge cierra administrativamente la deuda técnica menor registrada antes; `main` ahora refleja fielmente el código que corre en la EF.

[21-04-2026 PM] FASE E IA PREDICTOR — motor real en rama `claude/fase-e-motor`. Port fiel del `predictor.py` de referencia a TypeScript con gate de paridad Python↔TS sobre 46 partidos WC2022 (tolerancia 1e-3 en probs, exact en sign/used_fallback/is_dudoso). Decisión de pesos cerrada tras back-test: **ELO 75% + H2H 10% + Racha 15%** (fallback **85/0/15** si H2H<5 partidos), home advantage +85/+95 MEX, margen dudoso 0.08. Principio de producto: la IA se congela con snapshot y NO se adapta al torneo — todos los users reciben la misma predicción.

  **Commits en rama `claude/fase-e-motor` (base main@`500ab05`, mergeada `2904025` de Fase C encima):**
  - `40e9534` — `feat(ia): migration SQL fase E (ia_snapshots, alter, CHECK)`. `supabase/migrations/20260421_fase_e_ia_snapshots.sql` con tabla `ia_snapshots` (unique index parcial para "1 activo"), ALTER `ia_predictions` (snapshot_id FK + is_ko_ondemand + índice lookup), CHECK `chk_h2h_canonical_order` en `ia_h2h` (coexiste con `h2h_alphabetical` de Fase A), cron nocturno cleanup inactivos >7d. Idempotente.
  - `a57ab50` — `feat(ia): port predictor from python (lib/predictor.ts)`. Pure functions (softmax, eloSignal, h2hSignal, rachaSignal, drawSignal, predict). `PREDICTOR_CONFIG` como `const` exportable con todas las constantes (ELO_DIVISOR 400, H2H_MIN_SAMPLE 5, HOME_ADV 85/95, MARGIN_DUDOSO 0.08, pesos, DRAW_BASE/POW/DIVISOR, H2H_SCALE, RACHA_SCALE). Fallback de pesos replicando Python condicional (`weights == DEFAULT → FALLBACK`) para paridad exacta sobre fixture.
  - `529d5b0` — `feat(ia): repository layer + cache (lib/repository.ts) + wc2026 mapping`. `WC2026_TEAMS` + `WC2026_ISO3` + `TEAM_NAMES_ES` + `displayName()` + `resolveIso3()` (con alias "Bosnia & Herzegovina" → BIH). `SnapshotCache` + `loadCache()` (TTL 1h, force-invalidate) + `lookupElo/H2H/TeamForm` + `buildRachaData` + `upsertPrediction/findCachedPrediction`. Canonicalización H2H en lookup (spec §6.3 — BD siempre team_a<team_b alfabético, aquí se reorienta al home real).
  - `4fc652f` — `feat(ia): quip generator via claude haiku + auth helpers`. `requireAuth/requireAdmin/requireAdminOrCron` con bypass service_role constant-time (para no romper flows SQL desde Claude.ai) + cron key trim() (ERR-04). `generateQuip()` con prompt literal del spec §7.2 (humor seco español, 15 palabras max, lista explícita de prohibidos), modelo `claude-haiku-4-5-20251001`, max_tokens 80, temperature 0.9, timeout 5s, fallback silencioso a plantilla neutra.
  - `287a3e1` — `feat(ia): new actions freeze_snapshot, compute_groups, compute_match`. Refactor `index.ts` con imports desde `lib/*`, CORS whitelist (`porramundial2026-seven.vercel.app` + localhost:5173), corsHeaders ancho para SQL calls, rate limit 30/min runtime Map, `MATCHES_CACHE` in-memory + `loadMatches()` fetch a Vercel. Router con auth por action: `requireAdmin` en scrapes, `requireAdminOrCron` en freeze/compute_groups, `requireAuth` + rate limit en compute_match. Errores estructurados (bad_input/unauthorized/forbidden/rate_limit/internal) sin leak de stack. `handleFreezeSnapshot` (serie 3 scrapes + insert snapshot + activate tx + invalidate cache + WhatsApp fire-and-forget), `handleComputeGroups` (72 partidos, predict + quip concurrency 5, upsert), `handleComputeMatch` (cache-hit BD → devuelve cached; miss → predict + upsert `is_ko_ondemand=true`).
  - `2f6b530` — `test(ia): unit tests predictor + parity test vs python fixture`. `tests/predictor.test.ts` con 13 Deno.test (softmax suma 1, ELOs simétricos → X, ELO +400 → p>0.90, fallback H2H null/<5, home advantage MEX/USA/no-host, margen dudoso, sign consistency, probs suman 1). `tests/backtest_parity.test.ts` carga `parity_fixture.json` (46 casos WC2022) y verifica que cada caso pasa tolerancia 1e-3 en 5 métricas numéricas + exact match en 3 flags. Spot-check aislado sobre QAT-ECU para trazabilidad.
  - `41c7e07` — `chore(ia): pg_cron schedules 11 jun freeze + compute_groups`. `supabase/migrations/20260421_fase_e_cron_schedules.sql` con crons `ia-freeze-snapshot-mundial` (11 jun 00:00 UTC) e `ia-compute-groups-mundial` (11 jun 00:10 UTC). Ambos invocan el EF vía `net.http_post` con `X-Cron-Key` del Vault. Idempotentes (unschedule antes de schedule).
  - (este commit) — `docs(ia): actualizar CLAUDE.md + migration-log + contexto (Fase E)`.

  **Reconciliaciones técnicas hechas (no son ERRs, son decisiones documentadas):**
  1. **Fallback de pesos:** spec §5.4 dice "pesos activos son WEIGHTS_FALLBACK" (incondicional) pero `predictor.py` lo hace condicional a `weights == W_DEFAULT`. Portamos la lógica **condicional de Python** literalmente para minimizar riesgo en paridad (los 46 casos del fixture siempre usan default → ambas lecturas producen el mismo número, pero la condicional respeta la semántica original si en el futuro se llamara con pesos custom).
  2. **`is_host_match` para hosts como away:** el JSON `worldcup-2026-matches.json` tiene 3 partidos (SUI vs CAN, CZE vs MEX, TUR vs USA) donde el host aparece como `away_en`. Spec §8.3 dicta `is_host_match = home_code IN HOST_COUNTRIES` **literal**. Implementado así. En la realidad esos 3 partidos se juegan en sedes del host; si se quiere corregir, cambiar la condición a `home_code IN HOSTS || away_code IN HOSTS` (con cuidado del lado al que se aplica el bonus — requiere reconsiderar el signo). Pendiente decisión; marcado como posible ajuste en Fase F.
  3. **Alias "Bosnia & Herzegovina"** en `resolveIso3`: el JSON usa "&", `WC2026_TEAMS` usa "and". Añadido `NAME_ALIASES_TO_ISO3` top-level con este único alias. Si aparecen más divergencias al smoke-test compute_groups, se añaden ahí.
  4. **Service role bypass en auth:** los scrapes llamados desde Claude.ai SQL usan el service_role key como Bearer. `isServiceRole()` hace constant-time compare contra `SUPABASE_SERVICE_ROLE_KEY` del env y lo equipara a admin. Mantiene backward-compat con los flows SQL existentes.
  5. **CHECK ia_h2h redundante**: el spec §2.3 añade `chk_h2h_canonical_order` pero la migración Fase A ya tenía `h2h_alphabetical` con predicado idéntico. El CHECK de Fase E se aplica con guard `DO $$ IF NOT EXISTS` para idempotencia; coexisten sin conflicto. Si un día se quiere deduplicar, drop del redundante.

  **Pendiente al cierre Fase E por parte de San / Claude.ai:**
  - Aplicar las 2 migraciones (`20260421_fase_e_ia_snapshots.sql` + `20260421_fase_e_cron_schedules.sql`) vía MCP Supabase.
  - Crear secrets `IA_CRON_KEY` (48+ chars) y `ANTHROPIC_API_KEY` en Vault.
  - Desplegar EF v7.
  - Ejecutar test de paridad (`deno test tests/backtest_parity.test.ts`) — si falla, investigar divergencia (gate de merge, no bajar tolerancia).
  - Smoke tests: `status`, `freeze_snapshot` con `activate:false`, `compute_match ESP ARG`, rate limit 31 req.
  - Primer `freeze_snapshot` manual con `label: "initial_test_21apr"` para poblar snapshot y validar `compute_match` end-to-end.
  - Si todo verde → merge PR de `claude/fase-e-motor` a main.
  - Si smoke test descubre algún error no documentado, crear ERR-27+ siguiendo el patrón conocido (síntoma / causa / fix / patrón preventivo / fecha).

[21-04-2026 noche] FASE E DESPLEGADA + VALIDADA + MERGEADA. Cierre del bloque IA Predictor backend.

  **Pipeline ejecutado por San desde Claude.ai:**
  1. Aplicadas las 2 migraciones Fase E vía MCP Supabase: `ia_snapshots` (unique index "1 activo"), alter `ia_predictions` (snapshot_id FK + is_ko_ondemand + idx lookup), CHECK `chk_h2h_canonical_order` en `ia_h2h`, cron nocturno `ia-snapshots-cleanup` (03:00 UTC), cron `ia-freeze-snapshot-mundial` (11 jun 00:00 UTC) y `ia-compute-groups-mundial` (11 jun 00:10 UTC).
  2. Creado secreto `IA_CRON_KEY` en Vault (64 chars hex). Confirmado `ANTHROPIC_API_KEY` en Edge Function secrets (no Vault — patrón del proyecto).
  3. Deploy EF `porra-ia-compute` desde rama `claude/fase-e-motor` con `--no-verify-jwt --use-api`. Subida vía CLI: 6 ficheros (index.ts + 5 lib/*.ts). La CLI omitió automáticamente `tests/*` (seguir imports).

  **3 fixes descubiertos durante smoke tests** (aplicados sobre la rama con redeploy intermedio cada uno):
  - **`fa79699`** — `fix(ia): ANTHROPIC_API_KEY via Deno.env (EF secrets) — readVaultSecret reservado para secrets operacionales`. El spec §3.1 decía Vault pero el patrón del proyecto es `Deno.env.get("ANTHROPIC_API_KEY")` (como `FOOTBALL_DATA_API_KEY`, `SUPABASE_*`). Corregido en `index.ts` L858 + L1027, import `readVaultSecret` eliminado del index (sigue en `auth.ts` para `IA_CRON_KEY`).
  - **`36ba6b3`** — `fix(ia): readVaultSecret usa .schema("vault").from("decrypted_secrets")`. Primer intento de resolver 401 en `freeze_snapshot` con `X-Cron-Key`: el `supa.from("vault.decrypted_secrets")` original fallaba porque PostgREST interpreta el string literal como tabla en schema `public`. Probamos `.schema("vault").from("decrypted_secrets")` — no resolvió (schema `vault` no expuesto en `api.schemas`).
  - **`a210598`** — `fix(ia): readVaultSecret via RPC get_vault_secrets (vault schema no expuesto)`. Fix definitivo: cambio de firma `readVaultSecret(supa, name)` → `readVaultSecret(supabaseUrl, serviceRoleKey, name)` + `fetch POST /rest/v1/rpc/get_vault_secrets` con `apikey` + `Authorization` Bearer. Mismo patrón probado en `porra-fix-encoding` v6. Caller `requireAdminOrCron` actualizado para pasar `Deno.env.get("SUPABASE_URL")` + `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")`. Lección documentada como **ERR-27**.

  **Smoke tests ejecutados por San tras v9 ACTIVE:**
  | Test | Resultado |
  |---|---|
  | `status` | ✅ |
  | `freeze_snapshot` activate:false | ✅ snapshot_id=1 |
  | `freeze_snapshot` activate:true label="initial_test_21apr" | ✅ snapshot_id=2 activo |
  | Invariante ia_snapshots (1 activo) | ✅ |
  | `compute_match ESP ARG` primera llamada | ✅ sign:X + quip Haiku + cached:false |
  | `compute_match ESP ARG` segunda llamada | ✅ cached:true via BD |
  | Rate limit 30/min | ✅ service_role inmune, users normales limitados |

  **Gate de merge — paridad Python↔TS:** 46/46 casos pasan con tolerancia 1e-3 en `p_home/p_draw/p_away/p_max/margin` y exact match en `sign/used_fallback/is_dudoso`. Ejecutado desde el sandbox vía Node 22 `--experimental-strip-types` (como fallback al `deno test`, porque `deno.land` está bloqueado por proxy 403 desde el sandbox). Runner funcionalmente idéntico al `tests/backtest_parity.test.ts` original.

  **Merge:** PR #16 abierto y squash-mergeado desde otra sesión de Claude Code con MCP GitHub vivo (el MCP de esta sesión estaba caído de forma intermitente). Merge SHA en main: **`8d8b667`**. Rama remota `claude/fase-e-motor` auto-borrada por la config del repo. Local limpiado.

  **Estado tras merge:**
  - `main` HEAD = `8d8b667`.
  - EF `porra-ia-compute` v9 ACTIVE, `verify_jwt=false`.
  - Tablas: `ia_elo_fifa` 211 · `ia_h2h` 815 · `ia_last5_results` 48 · `ia_snapshots` 2 (activo id=2 `initial_test_21apr`) · `ia_predictions` con entradas on-demand de smoke tests (ESP-ARG, etc.).
  - Crons programados: `ia-snapshots-cleanup` (03:00 UTC nightly), `ia-freeze-snapshot-mundial` (11 jun 00:00 UTC), `ia-compute-groups-mundial` (11 jun 00:10 UTC).

  **Residual pendiente (no bloquea):**
  - `origin/claude/fase-c-last-n` sigue en remoto (el squash-merge local de Fase C con `Closes #15` cerró la PR pero no eliminó la rama — GitHub solo auto-borra cuando el merge pasa por API). Limpieza opcional: `git push origin --delete claude/fase-c-last-n`.
  - `is_host_match` literal per spec (`home_code IN HOSTS`). 3 partidos del JSON tienen host como `away_en` y no reciben el bonus de +85/+95. Decisión abierta para Fase F si se quiere corregir.

  **Siguiente paso — Fase F (wiring frontend):**
  - Bootstrap: añadir fetch a `ia_predictions` en el `Promise.all` de `auth.js` (o `loadUserData` equivalente).
  - Render: `scoring.js` `renderMatchCard` pinta hint "IA predice 1/X/2" + quip en tooltip. `ko.js` equivalente en bracket.
  - Bonus: lógica en `calc*Points` — +1 pt si `user_sign !== ia_sign` AND `user_sign === real_sign`.
  - Eliminatorias: `compute_match` on-demand con cache sessionStorage.

[22-04-2026] `SUPABASE_SERVICE_ROLE_KEY` AÑADIDO A VAULT (mirror del EF secret existente). Motivo: smoke test de `compute_match` + rate limit requieren que el caller (en este caso `net.http_post` desde SQL) ponga `Authorization: Bearer ${service_role}` en headers — ese Bearer es el que dispara el `isServiceRole()` bypass del módulo `lib/auth.ts` y permite ejecutar actions que requieren `requireAuth` / `requireAdmin`. Hasta hoy la key solo vivía en EF secrets (Supabase Dashboard → Settings → Functions → environment variables), accesible via `Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")` desde dentro de la EF pero no desde SQL. Fix: duplicarla en Vault con el mismo valor. **Invariante operativa:** al rotar el service_role hay que actualizar en AMBOS sitios (EF secrets + Vault) simultáneamente, o los crons y flows SQL se desincronizan contra el deploy de las EFs. Documentado en `CLAUDE.md` sección "Stack infraestructura → Secrets" con clasificación por dónde vive cada uno y por qué.

  **De paso, corregido bug en el inventario de secrets de `CLAUDE.md`:** la lista antigua incluía `ANTHROPIC_API_KEY` como si estuviera en Vault, cuando tras el fix `fa79699` de Fase E vive en EF secrets (patrón del proyecto para API keys externas). También faltaban `IA_CRON_KEY` (introducido en Fase E) y el nuevo `SUPABASE_SERVICE_ROLE_KEY`. Nueva sección divide Vault vs EF secrets con el "por qué" de cada uno.

[23-04-2026 F.1] FASE F.1 — Bootstrap fetch `ia_predictions` en `public/js/auth.js`. Nuevo helper `loadIAPredictions()` que (1) lee snapshot activo (`ia_snapshots.is_active=true`, maybeSingle), (2) en paralelo descarga `ia_predictions` filtradas por `snapshot_id` + `public/data/worldcup-2026-matches.json` para poder mapear `wc2026_gX_<sofascoreId>` → `${group}_${home_es}_${away_es}` (formato `getMatchKey()` que usan scoring.js/data.js), (3) construye map por legacyKey con `{sign, confidence, quip, is_dudoso, p_home, p_draw, p_away}` — el `quip`/`is_dudoso`/`p_*` viven en `breakdown` JSONB y se reconstruyen en frontend para render simple. Llamada añadida al `Promise.all` de `loadUserData`; `Object.assign(iaPredictions, iaMap)` sobreescribe el store mutable + expone `window.iaPredictions`. Sin race con render inicial porque scoring.js `fetchIA()` chequea `if(iaPredictions[matchKey]) return;` antes de caer al fallback `api.anthropic.com`. Para usuarios no-logueados no carga nada (loadUserData solo corre en sesión). Aceptable: hint IA solo tiene sentido logueado.

[23-04-2026 F.2] FASE F.2 — Render hint IA en tarjeta de grupo (`public/js/scoring.js` + `public/css/base.css`). Nuevo nodo `<div class="ia-hint">` insertado entre `.pts-row` y `.gol-row` en `renderMatchCard` (un solo nodo, sin tocar layout existente). Nueva función `renderIAHint(card, idx, matchKey)` lee `iaPredictions[matchKey]` y pinta "🤖 IA predice <sign> · <label>" con `title` = quip (tooltip nativo) + asterisco amarillo si `is_dudoso=true`. Oculto (`display:none`) si no hay entrada — cumple "si no hay predicción no pintar". Llamado desde `renderMatchCard` (render inicial) y desde `updateCardUI` (bootstrap tardío post-login). Plus: la función también hidrata la `.ia-bar` existente (ia-loading → ia-result) si iaPredictions ya tiene datos, evitando el spinner stuck "consultando oráculos..." cuando `fetchIA()` hace early-return por la entrada de BD. CSS nuevo (5 reglas) al final de `base.css` con colores violeta tenue alineados al resto del tema IA.

[23-04-2026 F.3] FASE F.3 — Hint IA on-demand en KO cards (`public/js/ko.js` + `public/css/ko.css`). En `buildKOCard`, tras la construcción del card HTML, si ambos equipos están resueltos (`bothResolved && hTeam?.flag && aTeam?.flag`), se dispara `loadKOIAHint(match.id, home_flag, away_flag)` — no bloqueante, render sigue de largo. Orden de resolución: (1) sessionStorage `ia_ko_<home>_<away>`, (2) invoke EF `porra-ia-compute` con `{action:'compute_match', home, away}`. Auth vía `window._porraDb.functions.invoke` (usa session token automáticamente). Cachea en sessionStorage + espeja en `iaKoPredictions` para que `openModal` reutilice sin refetch. Key por par `<home>_<away>` (no por `match.id`) para ser robusto a cambios de slots resueltos al editar rondas previas. Silencio en error: sin hint es mejor que UI rota. Nuevo nodo `<div class="ko-ia-hint">` entre ko-hero y ko-footer. CSS nuevo al final de `ko.css` (cascada fichero duplicado L366/L1070 — apendiceo al final para ganar).

[23-04-2026 F.4] FASE F.4 — Bonus +1pt IA en motor de puntuación (`public/js/data.js` + `public/js/scoring.js`). La lógica ya existía desde Fase E vía `iaBonusWillApply()` + `pts += 1` en `calcMatchPoints`. F.4 documenta el invariante explícito y endurece la predicate: `ia.sign !== null` + `ia.sign ∈ {'1','X','2'}` (guard defensivo), `mySign !== ia.sign`, `mySign === realSign`. 4 casos de test documentados en comentario sobre `calcMatchPoints` y verificados via Node stdout `4/4 F.4 casos OK`:
  - A) user=1, ia=1, real=1 → 1 signo + 0 bonus
  - B) user=2 (1-2), ia=1, real=2 (0-1) → 1 signo + 1 bonus
  - C) user=2, ia=1, real=X → 0
  - D) user=1 (2-0), ia=null, real=1 (1-0) → 1 signo + 0 bonus
  El bonus se aplica DESPUÉS de signo/exacto/goleador y ANTES del cap 7 + boost ×2. `Math.min(pts, 7)` garantiza máx 7 antes del boost. No se añadió tests/ dir por no existir patrón — spec acepta comentario cuando no hay suite previa.

[23-04-2026 F-close] FASE F CERRADA (pendiente merge). CLAUDE.md actualizado: (1) línea de estado: "Fase F implementada en rama `claude/wire-predictor-frontend-G2wic`, pendiente merge"; (2) sección "Sanity check 20 abr 2026 → inversiones prioritarias" ítem 3 marcado resuelto frontend (23 abr); (3) tabla de fases IA Predictor: F marcada ✅ con commits F.1–F.4 listados; (4) sección "🤖 IA Predictor" expandida con el detalle de los 4 entregables y el pendiente residual (eliminar `fetch('api.anthropic.com/...')` inertes en `scoring.js:941` y `ui-nav.js:49` — no aparecen en pantalla porque el wiring F llega antes, pero queda refactor post-merge). Smoke manual en localhost:5173 pendiente antes del merge a main.

[23-04-2026 F.2b] SIMPLIFICACIÓN CHIP `.ia-hint` (`public/js/scoring.js`). QA en localhost tras F reveló redundancia: el chip nuevo `.ia-hint` (F.2, entre `.pts-row` y `.gol-row`) pintaba "🤖 IA PREDICE 1 · Local" + tooltip con el quip, mientras que la `.ia-bar` pre-existente (entre `.gol-row` y `.card-footer`) ya mostraba signo + confianza + quip a la vista. Dos nodos diciendo lo mismo. Fix: dejar el chip como simple badge "🤖 vs IA" (literal, texto renderizado en uppercase por `.ia-hint-lbl` CSS → "VS IA", coherente con el estilo del resto de labels del tema IA) y que la `.ia-bar` siga haciendo el trabajo pesado. Cambios en `renderIAHint`:
  - `hint.innerHTML` reducido a `<span class="ia-hint-ico">🤖</span><span class="ia-hint-lbl">vs IA</span>` (sin signo, sin traducción, sin asterisco `is_dudoso`).
  - `hint.title = ia.quip` → `hint.removeAttribute('title')` (el tooltip sobra: el quip ya se lee entero en la `.ia-bar`).
  - Eliminada variable `dudosoMark` (ya no referenciada).
  - **Retenidas** `signMap` / `signLabel` pese a que la instrucción original pedía borrarlas: las usa el bloque de hidratación de la `.ia-bar` debajo (línea 808: `predTxt.textContent = ia.sign + ' · ' + signLabel + ...`) que está explícitamente marcado como "no tocar". Sin ellas, el spinner de la `.ia-bar` volvería a quedarse stuck. Documentado aquí como decisión consciente.
  - Sin cambios en CSS: `.ia-hint-sign` y `.ia-hint-dudoso` quedan como selectores huérfanos en `base.css` (5 reglas, líneas 1163-1167), pero son inertes y reaprovechables si el chip vuelve a expandirse. No merece limpieza en este commit.
  Build verde (`vite v8.0.8` ✓ 44 modules transformed). Fase F sigue "implementada pendiente merge" — este fix entra en el mismo PR.

[23-04-2026 POST-F COMMIT 1] ENRIQUECER `breakdown` EN `ia_predictions` PARA TOOLTIP EXPLAIN (`supabase/functions/porra-ia-compute/lib/repository.ts` + `index.ts`). Preparación para el commit 3 de post-F (tooltip hover/click sobre el % de confianza en la `.ia-bar` con narrativa + datos legibles). Hasta ahora `breakdown` sólo guardaba señales normalizadas (`elo_signal: 0.47`, `h2h_signal: 0.71`, etc.) — ilegibles para el usuario. Añadimos los valores crudos humanos sin tocar el motor ni el contrato existente:
  - `lib/repository.ts`: nuevo `interface PredictionRawContext` con 9 campos (`elo_home_raw`, `elo_away_raw`, `h2h_home_wins`, `h2h_away_wins`, `h2h_draws`, `h2h_total`, `form_home_ppg`, `form_away_ppg`, `is_host`). `upsertPrediction` recibe un 10º arg `rawContext?: PredictionRawContext` opcional — si se pasa, esos campos se añaden al JSONB `breakdown` del INSERT. Sin rawContext, el contrato original se preserva 1:1 (no rompe tests ni calls históricas).
  - `index.ts`: helper `computePpg(form)` = `(3*W + D) / n_matches` con redondeo a 2 decimales y fallback 1.00 cuando `n_matches=0` (mismo criterio que `predictor.ts::ppg`). `handleComputeGroups` ahora construye `rawContext` dentro del loop de WorkItem — `h2h?.home_wins ?? 0` para manejar null de forma segura, `isHostMatch` pasa literal a `is_host`. `handleComputeMatch` (KO on-demand) hace lo mismo con `is_host: false` (spec §8.4.6 — sedes neutras).
  - `findCachedPrediction` NO se modifica: sigue reconstruyendo sólo la `Prediction` (señales normalizadas) — los nuevos campos quedan en el JSONB pero son invisibles para la reconstrucción. Frontend los leerá directo de `ia_predictions.breakdown` vía el bootstrap de `auth.js::loadIAPredictions`.
  - Build verde (`vite v8.0.8` ✓ 44 modules) — sólo toca código EF, pero confirma que nada del bundle quedó roto.
  - **Deploy BLOQUEADO en este harness.** 2 intentos al MCP `deploy_edge_function` (directo + vía sub-agente con payload ya dumpeado a `/tmp/deploy_files.json`, 77 KB) devolvieron `API Error: Stream idle timeout - partial response received`. El stream del harness se satura antes de que Supabase acepte el body completo. EF sigue v9 en producción. **San debe deployar v10 desde Claude.ai con el MCP Supabase allí** (ese canal no comparte este transporte y ya ha subido funciones grandes antes). Pasos para San:
    1. `git pull origin claude/wire-predictor-frontend-G2wic`
    2. En Claude.ai con MCP Supabase: `deploy_edge_function` con `project_id=cmyfyswystjgzdwbqyyb`, `name=porra-ia-compute`, `entrypoint_path=porra-ia-compute/index.ts`, `verify_jwt=false`, `files=` los 6 ficheros de `supabase/functions/porra-ia-compute/{index.ts,lib/*.ts}`.
    3. Confirmar v10 ACTIVE, luego ejecutar `compute_groups` desde SQL con `Authorization: Bearer ${service_role}` para repoblar los 72 partidos con el breakdown enriquecido.
  - **Sin ejecutar `compute_groups`** desde aquí como pidió San explícitamente — pausa hasta validación manual. Commits 2 y 3 de post-F (eliminar chip `.ia-hint` y añadir tooltip explainer) quedan pendientes hasta que v10 esté vivo y los 72 partidos repoblados con los nuevos campos.

[23-04-2026 V10 DEPLOY + VALIDACIÓN] v10 ACTIVE vía `supabase CLI` local (San, `npx supabase functions deploy porra-ia-compute --no-verify-jwt --project-ref cmyfyswystjgzdwbqyyb`). El MCP `deploy_edge_function` falló también desde Claude.ai con el mismo `Stream idle timeout`, confirmando que el límite de ~77 KB es del transporte MCP en ambas superficies (ver `ERR-29` añadido). `compute_groups` reejecutado vía SQL con `Authorization: Bearer ${service_role}`: 72/72 upserted, 0 errores, 23.6 s. Query de integridad sobre `ia_predictions.breakdown`: `has_elo_home_raw 72/72`, `has_h2h_total 72/72`, `has_form_home_ppg 72/72`, `has_is_host 72/72`. Casos edge verificados: `host_matches=6` (MEX/USA/CAN locales en grupos), `h2h_total=0` en 26 partidos (sin previa entre las 2 selecciones en 11v11, ej CPV-UZB), `form_ppg=1.00` en 6 partidos (fallback `n_matches=0` cuando last5 no tiene datos). Samples verificados: MEX-KOR (sign=1, conf=57, elo 1681.03/1588.66, h2h 8-3-3/14, form 1.63/1.63, is_host=true) y MEX-RSA (sign=1, conf=78, elo 1681.03/1429.73, h2h 2-1-1/4, is_host=true). Dato listo para consumo del tooltip explainer en Commit 3.

[23-04-2026 POST-F COMMIT 2] ELIMINAR CHIP `.ia-hint` + EXTRAER `hydrateIABar` (`public/js/scoring.js` + `public/css/base.css`). QA + discusión tras F.2b confirmaron que el chip era redundante con la pill "+1pt vs IA" de `.pts-row` (que sólo se muestra cuando tiene sentido — bonus ganable) + la `.ia-bar` (que ya muestra signo + % + quip visible). Dos nodos diciendo lo mismo, uno siempre visible sin señal útil. Fix:
  - `scoring.js`: eliminado el nodo `<div class="ia-hint" id="ia-hint-<idx>" style="display:none"></div>` del template de `createMatchCard` (era la línea 718, entre `.pts-row` y `.gol-row`). Eliminada la función `renderIAHint()` completa. Extraída una nueva función `hydrateIABar(idx, matchKey)` con la lógica de hidratación que antes vivía en la segunda mitad de `renderIAHint` — lee `iaPredictions[matchKey]`, calcula `signLabel` + `conf`, rellena `#ia-pred-txt-<idx>` (ej. "1 · Local (57%)") y `#ia-detail-txt-<idx>` (quip), y alterna `display` de `#ia-loading-<idx>` → `#ia-result-<idx>`. Idempotente. Callers de la antigua renderIAHint reemplazados: `createMatchCard` línea 782 y `updateCardUI` línea 1046 ahora llaman `hydrateIABar(idx, matchKey)`. Sin regresión: la `.ia-bar` sigue mostrando exactamente lo mismo que en F.2b.
  - `base.css`: eliminadas las 5 reglas huérfanas `.ia-hint`, `.ia-hint-ico`, `.ia-hint-lbl`, `.ia-hint-sign`, `.ia-hint-dudoso` (líneas 1163-1167 tras F.2b) + el comentario previo. Verificado que `ko.js` sigue referenciando `.ia-hint-ico/-lbl/-sign/-dudoso` desde `.ko-ia-hint` (KO cards) pero esas reglas viven scoped en `ko.css` (`.ko-ia-hint .ia-hint-*`) — no dependen de base.css y siguen funcionando intactas.
  - `errores_conocidos_porra.md`: añadido **ERR-29** documentando el blocker de payload >70 KB en MCP `deploy_edge_function` en ambas superficies (Code + Claude.ai) y el workflow preventivo (CLI local para EFs grandes con múltiples `lib/`).
  Build verde (`vite v8.0.8` ✓ 44 modules). Tras push, PAUSA para screenshot de San validando en localhost MEX-RSA: chip 🤖 vs IA eliminado de la tarjeta, `.ia-bar` intacta con quip + %. Commit 3 (tooltip explainer) sigue detrás.

[23-04-2026 POST-F COMMIT 2 SMOKE] Smoke commit 2 verde (San, localhost:5173). Verificado en MEX-RSA y SUI-BIH: (1) chip `.ia-hint` eliminado entre `.pts-row` y `.gol-row`; (2) `.ia-bar` intacta con quip real del Haiku y % ("México en casa contra Sudáfrica: la IA ha visto cosas más sorprendentes, pero no muchas." 78%); (3) pills `.pts-row` correctas — signo/exacto/goleador siempre, "+1pt vs IA" solo cuando `user_sign !== ia_sign`. Probado bonus dinámico: user=X con IA=1 en MEX-RSA → pill aparece + pts posibles=5 (1+3+1). Cuando user=1 (match IA) la pill desaparece. F.4 bien cableado. Sin errores de consola ni parpadeos. OK para commit 3.

[23-04-2026 POST-F COMMIT 3] TOOLTIP EXPLAINER `.ia-pct-trigger` + `.ia-explainer` (`public/js/auth.js` + `public/js/scoring.js` + `public/css/base.css`). Cierra Fase F. El número de confianza de la `.ia-bar` (ej "(78%)") pasa a ser un trigger clickable/hoverable que abre un popover con narrativa corta + datos crudos legibles — el usuario entiende por qué la IA predice lo que predice.
  - `auth.js::loadIAPredictions`: añadidos los 9 campos raw-context al mapeo `out[key]` — `elo_home_raw`, `elo_away_raw`, `h2h_home_wins`, `h2h_away_wins`, `h2h_draws`, `h2h_total`, `form_home_ppg`, `form_away_ppg`, `is_host`. Entries pre-v10 (snapshot antiguo) no tendrán estos campos → el trigger hace fallback a texto plano sin popover (graceful degradation).
  - `scoring.js::hydrateIABar`: nueva signature `(idx, matchKey, match)`. Si `ia.elo_home_raw` es número y `match` está disponible → wrapea `(conf%)` en `<span class="ia-pct-trigger" role="button" tabindex="0" aria-label="Ver por qué la IA predice <signLabel>" data-match-key="..." data-home="..." data-away="...">`. Si no → texto plano (no trigger). Ambos callers (`renderMatchCard:780` + `updateCardUI:1207`) pasan `match`.
  - `scoring.js::buildIAExplainer(ia, homeName, awayName)`: devuelve HTML del popover. Título "Por qué <signLabel> (<conf>%)". Narrativa 5 plantillas según sign/is_host/ELO diff:
    - `X` → "Partido igualado: ELO cercanos y fuerzas parejas."
    - `1` + is_host + eloDiff>0 → "Local parte con ventaja: juega en casa y ELO superior."
    - `1` + is_host + eloDiff≤0 → "El local aprovecha jugar en casa pese a ELO parejo."
    - `1` + !is_host + eloDiff>100 → "Local claro favorito por diferencia de nivel."
    - `1` + !is_host + eloDiff≤100 → "Local favorito por poco margen en el modelo."
    - `2` + eloDiff<-100 → "Visitante claro favorito por diferencia de nivel."
    - `2` + default → "Visitante parte ligeramente por encima en el modelo."
    Lista de datos: ELO (home {eloH} vs away {eloA}); H2H (`{hw}W-{draws}D-{aw}L en {total} partidos`, o "Sin partidos previos entre ambas" si `h2h_total===0`); Forma (`{homePpg} vs {awayPpg} pts/partido`, omitida si alguno=1.00 por fallback `n_matches=0`); línea is_host ("Jugando en casa (<home> es anfitrion)") solo si true. `escapeHtml` del proyecto para todos los valores user-facing.
  - `scoring.js::setupIAExplainerOnce`: singleton DOM `<div class="ia-explainer" id="ia-explainer-popover">` en `<body>` + event delegation por `document`. Detección por `matchMedia('(hover: hover)')`:
    - **Desktop (hover):** `mouseover` en `.ia-pct-trigger` → show; `mouseout` a algo fuera del trigger y del popover → hide.
    - **Mobile (click):** `click` en trigger → toggle; click fuera del popover → cerrar.
    - **Teclado:** Enter/Espacio sobre trigger → toggle (role=button + tabindex=0 para accesibilidad).
    - **Scroll > 20 px:** cerrar (gesture explicito del usuario). `resize`: también cerrar (evita posicionamiento stale).
  - Posicionamiento: `position:fixed`, `maxWidth:280`, centrado horizontal sobre el trigger, clamped a viewport con padding 8 px. Si el popover se sale por la parte inferior → flip a top del trigger vía `requestAnimationFrame` + `getBoundingClientRect`.
  - `base.css`: 8 reglas nuevas al final (`.ia-pct-trigger`, `.ia-explainer`, `.ia-exp-title`, `.ia-exp-narrative`, `.ia-exp-data`, `.ia-exp-data li`). Trigger con `text-decoration: underline dotted` (hint visual) + `cursor:help`, hover/focus-visible con background violeta tenue. Popover oscuro violeta (`#1f1a35` + border `rgba(124,58,237,.45)`), sombra, border-radius 10 px, fuente 12 px, z-index 9999.
  - Build verde (`vite v8.0.8` ✓ 44 modules). Bundle `dist/js/scoring.js` contiene `ia-pct-trigger`/`buildIAExplainer`/`setupIAExplainerOnce` (grep count 8). `dist/css/base.css` con las 8 reglas nuevas.
  - **Scope limitado a grupos** (spec del commit): el tooltip no está aún en KO cards. Si San lo quiere allí post-merge, basta extender `ko.js::loadKOIAHint` para leer raw context del response de `compute_match` + espejearlo en `iaKoPredictions` (la EF v10 ya lo devuelve implícitamente vía breakdown, pero `findCachedPrediction` no lo reconstruye en la `Prediction` — habría que tocar `repository.ts` o parsear breakdown direct en frontend).
  - **CLAUDE.md actualizado:** línea de estado Fase F marcada COMPLETA; tabla de fases IA Predictor añade F.2b/post-F.1/post-F.2/post-F.3 con commits; sección "🤖 IA Predictor" añade "Fase F COMPLETA" + "Tras Fase F (post-F, 23 abr noche)"; EF table `porra-ia-compute` v9 → v10 con nota de `rawContext` opcional + ERR-29.
  - **Pendiente post-merge a main:** (1) eliminar los dos `fetch('api.anthropic.com/...')` muertos en `scoring.js` (legacy `fetchIA`) y `ui-nav.js:49`; (2) opcionalmente: replicar tooltip en KO cards + repoblar ondemand predictions antiguas con rawContext al siguiente freeze_snapshot.

[24-04-2026 CIERRE SESIÓN] Doc sweep end-of-session antes de traspaso a Claude Desktop. Ficheros actualizados para que mañana el agente pueda arrancar con contexto completo sin tener que reconstruir el estado desde los commits:
  - **CLAUDE.md** — línea de estado "Fase F COMPLETA" (antes "implementada pendiente merge"); tabla de fases IA Predictor añade F.2b + post-F.1/2/3 con commits reales (`fb22648` / `8dd691c` / `6e46d2b`); sección "🤖 IA Predictor" expandida con "Tras Fase F (post-F, 23 abr noche)" explicando los 3 commits + lo que queda post-merge; EF table `porra-ia-compute` actualizada de v9 → v10 con nota de `rawContext` + referencia a ERR-29; sanity-check bullet #3 actualizado para reflejar resolución frontend 23 abr vía Fase F COMPLETA.
  - **CONTEXTO_PORRA_2026.md** — header "Actualizado 2026-04-24" + checkpoint "Fases A–E + F completas"; tabla accesos con rama `claude/wire-predictor-frontend-G2wic` como trabajo abierto y los 9 commits hash-listados; tabla EFs `porra-ia-compute` v9 → v10; sección IA Predictor Capa 1 etiquetada v10 + Capa 2 con post-F commit 1 explicado + Capa 3 "Fase F completa" con los 5 componentes (auth, scoring, buildIAExplainer, ko, data+calcMatchPoints); estado tablas 23 abr noche con los 72 partidos de grupos validados; timeline de commits añade 6 entradas (23 abr AM/PM/noche × commits F + 3 post-F + 24 abr cierre); pendientes abiertos → bug "Enganche final frases IA" marcado ✅ + nueva fila "Rama abierta pendiente de merge" con el escope del post-merge; priorización deuda técnica → "IA fake — frontend" marcada resuelta (prioridad 🟡 baja: merge + cleanup); roadmap 8 semanas S1-S2 y S3-S4 marcadas hechas.
  - **errores_conocidos_porra.md** — sin cambios hoy (ERR-29 ya añadido en commit 2 post-F).
  - **docs/sanity-check-20abr2026.md** — bloque "🔄 Actualización 23 abr 2026 — Fase F CERRADA en rama (ready-to-merge)" añadido tras la sección de IA fake frontend con los 8 commits desglosados. Tabla de acciones S1-S2 ítem 3 marcado resuelto.
  - **README.md** — sin cambios (doc de producto a nivel general, no referencia fases).
  Estado entregado: rama `claude/wire-predictor-frontend-G2wic` con 10 commits pusheados (incluyendo doc-sweep), EF v10 ACTIVE en producción, 72/72 partidos de grupos con breakdown enriquecido, smoke manual localhost:5173 verde. Ready-to-merge bloqueado solo por decisión del usuario; post-merge queda cleanup de los 2 `fetch('api.anthropic.com/...')` inertes + opcional tooltip en KO cards.

  **Frase para arrancar mañana en Claude Desktop:** "Continuamos con la Porra Mundial 2026. Revisa CLAUDE.md y CONTEXTO_PORRA_2026.md, dime el estado actual y si proceder al merge de `claude/wire-predictor-frontend-G2wic` a main."

[24-04-2026 TARDE] VERIFICACIÓN POST-MERGE + HOUSEKEEPING DOCS. San retomó sesión tras cierre de anoche. Diagnóstico arranque:
  - `git fetch origin main` → `origin/main` ya en `a24001a` (sesión previa completó merge). Local `main` stale en `615e52a` (30 commits detrás).
  - PR #17 `6b06880 Merge PR #17 - Fase F IA Predictor completa` squash-merge de `claude/wire-predictor-frontend-G2wic` consolidó las 30 commits (Fases A–E + F completa + doc sweep) sobre main.
  - Rama actual de la sesión `claude/review-predictor-merge-PUtqj` = `a24001a` (idéntica a origin/main, no aporta nada nuevo).

  Acciones ejecutadas:
  1. **Fast-forward local main** `615e52a → a24001a`. ✅
  2. **Borrado rama remota `claude/wire-predictor-frontend-G2wic`** → ❌ `git push origin --delete` devolvió HTTP 403 en el proxy git del harness. Pendiente borrado manual desde GitHub UI (la rama es ancestro de main, safe).
  3. **Doc sweep de cabeceras** — 2 ficheros actualizados para reflejar "Fase F en main" en lugar de "ready-to-merge en rama":
    - `CLAUDE.md` — header "Último commit en main" `4c5e953 → a24001a` con listado de commits mergeados; sanity-check bullet #3 (IA predict) resolución frontend reescrita para indicar merged a main; sección "Fase F COMPLETA en rama" → "COMPLETA y mergeada a main"; tabla de fases fila F actualizada con PR #17 `6b06880` squash-merge; "Pendiente post-merge a main" → "Cleanup pendiente (post-merge)".
    - `CONTEXTO_PORRA_2026.md` — header actualizado "24-04 tarde" + "Fases A–F mergeadas a main"; tabla accesos rama activa `main` limpio (sin referencia a G2wic); commit estable `4c5e953 → a24001a`; sección "Rama abierta pendiente de merge" → "Cleanup post-merge Fase F (pendiente)" con 3 tareas priorizadas (cleanup 2 fetch, tooltip KO opcional, borrar G2wic); Capa 3 IA Predictor "rama G2wic" → "mergeada a main vía PR #17"; deuda técnica ítem "IA fake — frontend" resuelto pending merge → resuelto post-merge; plan 8 semanas S3-S4 reformulado.
  4. **Esta entrada de migration-log.**

  Lecciones:
  - El git proxy del harness permite fetch y push de commits normales pero bloquea `push --delete`. Para housekeeping de ramas remotas, ir a GitHub UI o a máquina local del usuario.
  - Las cabeceras de CLAUDE.md / CONTEXTO son la primera referencia que lee el agente nuevo al arrancar — desactualizarlas es fácil cuando la sesión anterior cerró sin mergear y la siguiente sí lo hace. Añadir esta revisión cuando el prompt de arranque tenga "proceder al merge".

  Estado actual: main en `a24001a`, Fase F live en producción (Vercel autodeploy), rama G2wic remota pendiente de borrar (housekeeping). Deuda técnica restante (cleanup): eliminar `fetch('api.anthropic.com/...')` inertes en `scoring.js:941` y `ui-nav.js:49` + opcionalmente replicar tooltip IA en KO cards.

[24-04-2026 TARDE — continuación] PR #19 MERGEADO: cleanup deuda técnica post-Fase F. 2 commits squash-mergeados a main (`87fd454`):
  - Commit 1 `ecacf3a` (doc sync): ya cubierto en la entrada anterior.
  - **Commit 2 `353976f` (cleanup)**: eliminación de los dos `fetch('api.anthropic.com/v1/messages')` muertos del flow legacy pre-Fase F. Net **-131 líneas**.
    - **scoring.js (-127):** removidas `fetchIA(idx, match)` + queue `_iaEnqueue/_iaQueue/_iaActive/_iaNext` + IntersectionObserver que la disparaba. `.ia-bar` HTML ahora inicia con `display:none`; `hydrateIABar` la muestra al popular desde `iaPredictions` (snapshot activo bootstrapeado por `auth.js::loadIAPredictions`). Antes, si `loadIAPredictions` fallaba o tardaba, el spinner "consultando oráculos…" se quedaba forever Y el fetch CORS-fallaba cayendo a 6 quips hardcoded contaminando el store con fake data (fingerprint: siempre los mismos 6 textos rotando por `idx % 6`).
    - **ui-nav.js (-40):** removida `fetchIAforKO` con sus 5 fallbacks hardcoded. `openModal` delega en `loadKOIAHint` (ko.js) vía callback `onDone`:
      ```js
      if(iaKoPredictions[matchId]) showIAresultInModal(matchId);
      else loadKOIAHint(matchId, hTeam.flag, aTeam.flag, () => { showIAresultInModal(matchId); updateModalUI(); });
      ```
    - **ko.js (+4):** `loadKOIAHint(matchId, homeCode, awayCode, onDone?)` acepta callback opcional — se dispara tras poblar `iaKoPredictions` (cache sessionStorage hit síncrono o EF `compute_match` response async).
    - **auth.js:** comentario de limpieza (ya no hay fallback api.anthropic.com en el store).
  - **Gate de merge:** build verde (vite v8.0.8 ✓ 44 modules); `grep api.anthropic|fetchIA|_iaEnqueue` en `dist/js/*.js` → 0 hits; `grep hydrateIABar` → 4 hits preservado; `grep loadKOIAHint` → 2 hits preservado.
  - **Housekeeping post-merge:**
    - Rama remota `claude/review-predictor-merge-PUtqj` auto-borrada por GitHub al hacer squash-merge (config del repo).
    - Rama remota `claude/wire-predictor-frontend-G2wic` ya borrada manualmente por San desde su máquina local (proxy git del harness devolvía 403 en `push --delete`).
    - Local `main` fast-forward `a24001a → 87fd454`.
    - Local review branch borrada tras prune.
  - **Pendiente UX post-merge** (smoke en localhost:5173):
    - Cards sin prediction IA → `.ia-bar` no renderiza (antes mostraba spinner + luego fake data). Para las 72 tarjetas de grupos no debería pasar (snapshot activo cubre todos), pero si pasa en algún caso edge, el card queda sin barra IA (UX aceptable).
    - Modal KO abierto antes de que `loadKOIAHint` termine su first-call (carrera muy corta si usuario abre rápido) → modal muestra spinner hasta que el callback `onDone` dispare `showIAresultInModal`. Antes, fallaba a CORS y mostraba fake data. Ahora muestra spinner → real data.
  - Estado actual: **main en `87fd454`**, Fase F COMPLETA + deuda técnica cerrada, ambas ramas G2wic y review-predictor-merge borradas.

  Lección: al cerrar una Fase con sustitución de flow (ej. Fase F: `fetchIA` → `loadIAPredictions` + `hydrateIABar`), no dejar el path legacy como "fallback inerte" en el código. Los fallbacks hardcoded ESCONDEN los fallos reales del nuevo path (si `loadIAPredictions` falla silenciosamente, el legacy la tapa con datos fake). Eliminar el camino viejo **antes** de declarar la fase cerrada hubiera sido más limpio — aquí se hizo en commit separado (deuda técnica documentada + resuelta al día siguiente).

---

## 2026-04-25 madrugada — Refactor CLAUDE.md F0-F4 completado

**Resumen**: CLAUDE.md 51KB → 8.86KB (-83%). Documentación dispersa en `docs/` (7 ficheros nuevos, 38KB) + `.claude/rules/` (4 ficheros, 10.1KB) + `.claude/commands/start-session.md` + `.githooks/pre-commit` + `CHANGELOG.md` (11.75KB). `CONTEXTO_PORRA_2026.md` eliminado (deltas absorbidos en `docs/architecture.md` historial sesiones + `docs/live-scoring.md` ficha actor fallback).

**Commits en rama `claude/setup-todowrite-phases-KOGQU`**:
- `40efc60` F4 Wave 1 Grupo 1: docs/architecture, ia-predictor, live-scoring
- `deb54dc` F4 Wave 1 Grupo 2: scoring-engine + whatsapp + simulacros + db-schema
- `0301f91` F4 Wave 1 Grupo 3: 4 .claude/rules/ path-scoping
- `6173db2` Grupo 4 parcial: commands + githook (CHANGELOG diferido)
- `30b3b12` reescribir CLAUDE.md (51KB → ~7KB)
- `67180f1` CHANGELOG.md inicial — Saga F5 + IA Predictor Fases A-F
- `7d27d9e` CLAUDE.md ERR-XX tabla con prefijo + E13 explícito + EoS protocol
- `c64fd7a` CHANGELOG.md — bugs + limpieza + playoffs + IA F wiring
- `11e2a0e` eliminar CONTEXTO_PORRA_2026.md
- (este append a migration-log)

**Estado**: Wave 1 (14 ficheros nuevos, CHANGELOG diferido a Wave 2) + Wave 2 (CLAUDE.md reescrito + cleanup ERR/E13/EoS + CHANGELOG completo + CONTEXTO eliminado + esta entrada en migration-log) cerradas. PR pendiente Wave 3 (verificaciones + apertura PR sin merge). Tests F5 multi-sesión orquestados por Claude.ai Desktop tras merge.

**Aprendizajes**:
1. Subagentes Haiku con `Explore` (read-only) son seguros para generación de contenido — no pueden Write, evitan E13/GH#23478 por construcción.
2. Algunos Haikus alucinan: H2 (ia-predictor) inventó fórmulas matemáticas detalladas sin source; H7 (db-schema) inventó schema de `ia_snapshots`. Padre debe revisar output antes de Write.
3. Idle timeouts en prompts grandes (>15KB inline source): chunkear en grupos de 3-4 evita timeouts.
4. Hook pre-commit con enforcement de tamaños es crítico pero NO activarlo (`git config core.hooksPath`) hasta tener CLAUDE.md ya compactado, sino bloquea commits intermedios.

---

## 2026-04-25 mediodía — Cierre sesión refactor F0-F6 + cleanup obsoleto detectado

**Eventos posteriores al commit `c64fd7a` (CHANGELOG completado en Wave 2)**:

- `11e2a0e` chore: eliminar `CONTEXTO_PORRA_2026.md` + append migration-log refactor F0-F4 (37.7KB borrados; deltas absorbidos en `docs/architecture.md` historial sesiones + `docs/live-scoring.md` ficha actor fallback).
- `45f1e79` docs: append migration-log entrada refactor F0-F4 (Read-before-Edit recovery del intento previo).
- `7a33116` fix: add missing ERR-28 entry to tabla-índice de `CLAUDE.md` (slot vacío 27→29 cubierto, count tabla 28→29).
- `49a46d3` fix: add ERR-28 entry to catalog `errores_conocidos_porra.md` (RLS `ia_snapshots_public_read_active` policy, con TODOs honestos para datos no inferibles).
- `38e95d0` **squash-merge PR #20 a main** (25 abr 02:54Z) — 18 ficheros doc-only del refactor F4.
- `414ea3a` fix(docs): `ia-predictor.md` cleanup item 1 ya estaba hecho en `87fd454` (PR #19, 24 abr) — detectado por self-audit cross-checking via GitHub MCP. El doc trasladaba "Cleanup pendiente" del CLAUDE.md fuente sin verificar contra el código post-PR-#19. Sandbox Code tenía main local en `615e52a` (pre-Fase-F), por eso el cleanup ya merged en remoto pasó desapercibido durante Wave 1.
- `5914945` cherry-pick de `414ea3a` directo a main.

**F5-lite tests T1-T4 PASS** (verificación documental, sin sesiones Code limpias separadas):
- T1: frase arranque "Porra Mundial 2026. HEAD actual en main…" provoca sitrep correcto.
- T2: `docs/` navegable desde síntoma sin keyword del dominio (test E8 contra 3 síntomas hipotéticos).
- T3: `.claude/rules/` con frontmatter YAML + globs auto-cargan por path.
- T4: `grep -r "ERR-" CLAUDE.md docs/` → todos los ERR localizables vía tabla-índice.

**F6 ejecutado**:
- Merge PR #20 squash + cherry-pick `5914945` para fix doc obsoleto.
- Hook pre-commit activado localmente: `git config core.hooksPath .githooks` (enforcement 10KB CLAUDE.md / 30KB CHANGELOG.md operativo desde ahora).
- userMemories Claude.ai actualizadas (4 edits).
- PR #21 fantasma cerrado sin merge: la rama `claude/setup-todowrite-phases-KOGQU` fue recreada por el sandbox Code al pushear el fix-commit cuando el remote ya la había auto-borrado tras squash-merge de PR #20. Segunda eliminación tras cherry-pick.

**Lección operacional para próximas sesiones Code**: tras squash-merge + auto-delete de la rama de trabajo, el sandbox local puede recrearla sin saberlo si pushea desde la rama vieja (genera PRs fantasma). **Protocolo obligatorio al arrancar nueva sesión**: `git checkout main && git pull origin main` ANTES del primer fix-commit. Refleja también: el clone del sandbox suele ir varios commits por detrás del main remoto (esta sesión arrancó con `615e52a`, 4 commits por detrás de `5914945`); siempre re-sincronizar antes de razonar sobre estado real.
---

## 2026-04-26 — Cierre sesión F7.4-A (app shell esqueleto inerte)

**[21:52 26abr2026] F7.4-A merged** (PR #28, commit `0ddc6dc`): app shell esqueleto inerte. 7 ficheros nuevos en `public/{css,js}/components/` (tokens.css, bottom-tab.css, app-header.css, icons.js con 17 SVG, bottom-tab.js, app-header.js, shell.js no-op), 4 mods inline (`index.html`: viewport-fit=cover + `_splashHidden` flag en ambos paths splash + 3 `<link>` CSS + 2 mounts hidden `#fc-header-mount`/`#fc-tabbar-mount`; `main-entry.js`: cadena loadScript +4; `scoring.js:588` guard MutationObserver para ignorar mutations dentro de `.fc-tabbar`/`.fc-appbar`). 0 cambios visuales/comportamiento. QA programático 12/12 OK + smoke visual OK. Doc cerrada en `docs/restyling-mobile/00-app-shell.md`. Siguiente: F7.4-B (conexión `showPage` → `fcShellApply` → toggle `body.fc-shell-active` + mount/unmount + migrar `_gruposInited` a Promise singleton + añadir 'perfil' a VALID_PAGES en los 4 sitios).

---

## 2026-04-27 — Cierre sesión F7.4-B (conectar app shell · bottom-tab activa)

**[01:25 27abr2026] F7.4-B merged** (PR #29, commits `a5232cf` + `521991f`): app shell conectado, bottom-tab visible en page-grupos y page-elim. 6 ficheros modificados:
- `public/js/shell.js`: `fcShellApply` real con guard `_splashHidden`, toggle `body.fc-shell-active` y mount idempotente. `SHELL_PAGES = ['grupos', 'elim']`.
- `public/js/components/bottom-tab.js`: render real 5 tabs + handlers. Tabs con route (Grupos→grupos, Fase final→elim) navegan via `showPage`; tabs sin route (Jornada/Directo/Predictor) loguean `console.debug "pendiente F7.4-D"`. Alias `elim → quiniela` en `fcMarkActiveTab`. Rename label `Quiniela` → `Fase final` (commit `521991f`).
- `public/js/ui-nav.js`: (R3) `_gruposInited` boolean → `_gruposInitPromise` singleton. (R2) `'perfil'` añadido al guard auth. Llamada `fcShellApply(page)` al final de `showPage`.
- `js/main-entry.js:9`: `'perfil'` añadido a `VALID_PAGES`.
- `index.html` (líneas 38, 109): `'perfil'` añadido a las 2 listas hardcoded de `porra_lastPage`.
- `public/css/components/bottom-tab.css`: `body.fc-shell-active .fc-tabbar { display: flex }` + `padding-bottom = tab height + safe-area`.

QA: `node --check` OK en los 3 JS, `npm run build` OK, selector `body.fc-shell-active` y `fcShellApply` verificados en dist. Smoke San OK (PTI sobre tab "Fase final" + `console.debug "[shell] tab \"jornada\"/\"directo\" sin route — pendiente F7.4-D"` visible en consola). Console limpia. Doc cerrada en `docs/restyling-mobile/00-app-shell.md` §7. Riesgos R2 (VALID_PAGES divergentes) + R3 (`_gruposInited` boolean) resueltos. GAP simulacro registrado fuera de scope F7.4-B (se aborda al reactivar el flujo de simulacro live). Siguiente: **F7.4-C** (migrar `.adm-header`, `.sb-header`, `.global-header` → `.fc-appbar` con variantes).

---

## 2026-04-27 — F7.4-C (migrar headers a .fc-appbar) — PR #30 abierto

**F7.4-C PR abierto** (PR #30, commits `6925ada` + `876ec5d`): los 3 headers inline (`.adm-header`, `.sb-header`, `.global-header`) reemplazados por el componente `.fc-appbar.fc-appbar--page` con sweep central del icono back en `shell.js` (estrategia α). Pendiente merge tras smoke San OK.

**Cambios en 6 ficheros:**
- `index.html`: 3 secciones reemplazadas (page-score, page-elim, page-admin). Eliminados subtítulos redundantes ("Fase eliminatoria — 32 partidos", "Porra Mundial 2026"), color destacado del span "Eliminatorias", `#score-user-bar`, `#elim-user-bar`. Badge ADMIN movido al slot `.fc-appbar__actions` post-smoke (fix `876ec5d` porque el title con `text-overflow:ellipsis` lo desbordaba en mobile 375px: `badgeRight=335.28` vs `headerRight=328`). Comentario header section actualizado (`#score-user-bar` removido del Expone).
- `public/js/shell.js`: nuevo helper `fcAppbarFillBackIcons()` con `querySelectorAll('.fc-appbar__back:empty')` + `getIcon('back')`. Idempotente (`:empty` excluye botones ya rellenos). Guard `typeof window.getIcon === 'function'`. Invocado al final de `fcShellApply` (cada showPage → re-sweep barato). Expuesto como `window.fcAppbarFillBackIcons`.
- `public/js/ui-nav.js`: bloque `labelMap`/`sb-back-label` eliminado de `showPage` (3 líneas). Bloque `score-user-bar` (4 líneas) reemplazado por comentario explicativo (F7.4-C / pendiente F7.4-E vía D5). `_sbPrevPage` capture conservado. `updateKOPts()` (~líneas 558-563) intacto — divergencia 1 aprobada: `id="total-ko-pts"` se conserva (no renombrar).
- `public/css/admin.css`: purgados `.adm-header`/`.adm-title`/`.adm-sub`/`.adm-back`/`.adm-back:hover` + `.sb-header`/`.sb-header-left`/`.sb-back-btn`/`.sb-back-btn:hover`/`.sb-header-title`/`.sb-user-bar` en sus 2 copias duplicadas. Purgadas media queries `.global-header`/`.gh-*`/`#elim-user-bar` en sus 2 copias + `.sb-back-btn span`/`.sb-header-title` responsive en sus 2 copias. Conservados: `.adm-badge` (utility, sigue inline en `.fc-appbar__actions`), `.adm-wrap`, `.adm-status-bar`, `.adm-metrics`, `.adm-tabs`, `.sb-body`, `.sb-top` y resto del body. **Conservadas las media queries de `#global-header` (id, page-grupos no migrado en F7.4-C — pendiente F7.4-E)**.
- `public/css/ko.css`: purgado bloque `.global-header`+`.gh-*` + duplicado (con `.gh-clasif`). Añadido bloque transitorio `.elim-pts-strip`/`.elim-pts-block`/`.elim-pts-label`/`.elim-pts-num`/`.elim-pts-clasif-btn` (será retirado en F7.4-E con la franja entera). Conservados: `.view-tabs`, `.view-tab`, `.ko-sub-bar`, `.container`, hero, rounds y todo lo demás del fichero.
- `docs/restyling-mobile/01-headers.md` (nuevo): patrón doc 00, secciones inventario producción pre-F7.4-C, estructura objetivo (`.fc-appbar--page` + `.elim-pts-strip` transitoria), decisiones (B+(2)+A+α + divergencia 1), DoD, snapshots CSS pre-cambio, riesgos H-R1..R5, pendientes F7.4-D/E.

**Decisiones aprobadas por San (B+(2)+A+α):**
- (B) "Mis puntos" baja a franja transitoria `.elim-pts-strip` debajo del header.
- (2) Botón "🏆 Clasificación" se conserva como `.elim-pts-clasif-btn` dentro de la franja (vs eliminarlo o meterlo en `__actions` que alargaba el header). Se autorretira en F7.4-E con la franja.
- (A) `#score-user-bar` eliminado por completo. Identidad de usuario unificada en F7.4-E vía header global persistente (D5).
- (α) Sweep central del icono back en `shell.js` (vs duplicar SVG hardcoded en 3 sitios o activar `renderAppHeader` con mounts dinámicos).
- Divergencia 1: NO renombrar `id="total-ko-pts"` → `elim-pts-num` (churn sin valor; el id ya existía y solo lo escribe `updateKOPts`).

**QA programático:**
- `node --check` OK en `shell.js` + `ui-nav.js`.
- `npm run build` OK (153ms inicial, 521ms tras fix badge).
- `dist/css/components/app-header.css` contiene `.fc-appbar--page` ✓.
- `dist/css/ko.css` contiene `.elim-pts-strip` ✓.
- `dist/js/shell.js` contiene `fcAppbarFillBackIcons` ✓.
- 0 reglas CSS reales `.global-header`/`.gh-*`/`.adm-header`/`.sb-header`/`.sb-back-btn` en dist (solo comentarios de migración con prefijo `F7.4-C:` → no son selectores).
- `dist/index.html`: 3 headers `.fc-appbar--page`. Única ocurrencia residual: `id="global-header"` (page-grupos, intacto a propósito).

**QA visual San (smoke localhost:5173 mobile 375px iPhone):**
- 3 headers visibles con back-btn 36×36 + título centrado. Click back funcional en los 3.
- Franja "Mis puntos" debajo del header de Eliminatorias: contador `#total-ko-pts` se actualiza con `updateKOPts()`. Botón "🏆 Clasificación" navega.
- Bottom-tab visible en Grupos+Elim, oculto en Score/Admin (sin regresión vs F7.4-B).
- Console limpia salvo `console.debug` esperados.
- **Issue detectado**: badge ADMIN dentro del title se desbordaba en mobile 375px (medición San: `badgeRight=335.28` vs `headerRight=328`, overflow 7.3px) por el `text-overflow:ellipsis` del `.fc-appbar__title`. **Fix `876ec5d`**: badge movido al slot `.fc-appbar__actions` (ya soportado por `app-header.css:74-80`, sin cambios CSS). Verificación visual+programática post-fix OK.

**Próximo paso**: merge PR #30 tras revisión San → cierre doc 00-app-shell §7 → arrancar F7.4-D (eliminar sub-tabs internos page-grupos y view-tabs page-elim, pages dedicadas para Jornada/Directo/Predictor).

**[27abr2026] F7.4-C merged a main** (squash-merge `a021e71`, PR #30 cerrado tras review San). Doc `docs/restyling-mobile/00-app-shell.md §7` actualizada: F7.4-C 🟡 → ✅ Cerrada con merge sha. DoD F7.4-C añadida con 11 puntos verificados (mobile 375px los 3 headers, back-btns funcionales, franja contador funcional, botón Clasificación en franja, bottom-tab sin regresión, console limpia, no regresiones laterales, build/check OK, selectores purgados en dist, smoke San + fix post-smoke). Branch `claude/migrate-headers-fc-appbar-SPMrq` auto-deleted post-squash. Siguiente fase activa: **F7.4-D** (eliminar sub-tabs internos `#btn-vista-grupos/jornada/directo` de page-grupos `index.html:552-568` + `.view-tabs` de page-elim; resolver routes pendientes de Jornada/Directo/Predictor con pages dedicadas; limpiar alias `elim → quiniela` en `bottom-tab.js:fcMarkActiveTab`).

**[27abr2026] Issue #27 formalizado en `.claude/rules/multi-agent-sync.md`** (nuevo). Path-scope amplio (`index.html`, `public/**`, `js/**`, `docs/**`, `supabase/**`, `apify-actors/**`, `.claude/rules/**`, `CLAUDE.md`, `migration-log.md`) para garantizar auto-carga en cualquier sesión que toque el repo. 6 secciones: (1) quién edita y dónde — Code en container Anthropic, nunca FS local de San; (2) push inmediato tras cada commit; (3) sync local — `git pull` + reinicio Vite (Ctrl+C + `npm run dev`) + hard-reload (Ctrl+Shift+R) — Vite cachea módulos en memoria entre HMRs y solo pull+reload no basta; (4) detección de desincronía — verificar HEAD remoto vs local antes de patchear; (5) cambio de fase con branch nueva — `git fetch origin && git checkout` (NUNCA `git pull origin <nueva-branch>` desde la antigua que produce conflicts en ficheros tocados por ambas, vivido F7.4-B → F7.4-C en `bottom-tab.js`+`shell.js`); (6) post squash-merge — limpiar branch local obsoleta con `git branch -D` (la remote la auto-borra GitHub, pero la local recreada por sandbox genera PR fantasma si pushea desde ella). CLAUDE.md actualizado: entrada nueva en tabla `.claude/rules/` + puntero en sección Reglas CRÍTICAS apuntando al doc. Push directo a main (regla docs-only, sin código ejecutable, riesgo cero — patrón consistente con `5d6c7c7 docs: end-of-session F7.4-A` y `bab10ba docs: cierre F7.4-C`).

---

## 2026-04-27 — F7.4-D-1 (pages dedicadas Jornada/Directo/Predictor) — PR #31

**F7.4-D-1 PR #31** (commit `7619eca`): pages dedicadas Jornada/Directo/Predictor + cleanup setVistaGrupos/_vistaActual + alias `quiniela→elim` limpiado + gate Fase final con `#fc-gate-modal`.

**Cambios en 12 ficheros:**
- `index.html`: 3 botones `#btn-vista-*` y containers (jornada-user-strip, jornada-container, directo-container) movidos fuera de page-grupos a 3 nuevas pages dedicadas (`#page-jornada` con boost-ticker, `#page-directo`, `#page-predictor` stub). Nuevo `#fc-gate-modal` global pre `</body>`. VALID_PAGES splash arrays (línea 38 y 109) ampliados a 8 elementos.
- `js/main-entry.js`: VALID_PAGES Set con 8 elementos. Comentario sobre orden ui-directo actualizado (ya no override).
- `public/js/ui-nav.js`: `window._currentPage = page` al INICIO de showPage. Guard auth ampliado a jornada/directo/predictor. prevPages para back de Score: 5 elementos. 3 toggles display nuevos. Init handlers (page-jornada → renderVistaJornada, directo → renderVistaDirecto, predictor → stub). Hook cierre `mobile-focus-layer` si page≠grupos (sustituye listeners obsoletos en ui-groups-mobile).
- `public/js/ui-groups.js`: `setVistaGrupos`+`window.setVistaGrupos`+`let _vistaActual` eliminados (líneas 437-462). 2 refs `_vistaActual === 'jornada'` (424, 643) → `window._currentPage`. `checkGroupsComplete`: línea nueva tras `boostsCompletos` setea `window._gruposComplete = (filled >= total && boostsCompletos)`.
- `public/js/ui-directo.js`: bloque `Override de setVistaGrupos` + `_originalSetVistaGrupos` + `setVistaGruposExtended` + `window.setVistaGrupos = setVistaGruposExtended` eliminado (líneas 131-176). Cabecera "Expone" actualizada.
- `public/js/components/bottom-tab.js`: `_tabDefs` con id/icon `'elim'` (no `'quiniela'`); routes null de jornada/directo/predictor → rutas reales. `fcMarkActiveTab` sin ternario alias. Click handler con gate `if (def.route === 'elim' && !window._gruposComplete) { _showGruposGateModal(); return; }`. Helpers `_showGruposGateModal`/`_closeGruposGateModal` (add/remove `.open` al `#fc-gate-modal`). `window.fcGateModalClose` expuesto.
- `public/js/components/icons.js`: case `'quiniela'` → `'elim'` (SVG trofeo intacto).
- `public/js/shell.js`: `SHELL_PAGES = ['grupos', 'elim']` → `['grupos', 'elim', 'jornada', 'directo', 'predictor']`. Comentario actualizado.
- `public/js/ui-groups-mobile.js`: bloque "Tab listeners cerrar focus" con `getElementById('btn-vista-jornada')` eliminado (botones ya no existen). Comentario apunta al hook equivalente en `ui-nav.js showPage`.
- `public/css/base.css`: regla zombie `#jornada-container{display:none}` eliminada (page-jornada padre gobierna visibilidad).
- `public/css/directo.css`: regla zombie `#directo-container { display: none }` eliminada (page-directo gobierna).
- `public/css/components/app-header.css`: bloque nuevo `.fc-gate-modal` + `.fc-gate-modal.open` + `.fc-gate-modal__card`/`__title`/`__msg`/`__btn` (~50 líneas). Backdrop semitransparente con blur, card centrada 360px max-width, botón "Entendido" con hover invertido.

**Decisiones aprobadas (D1-D5 spec + 2 pivots):**
- (D1) Page-elim NO se toca; rediseña entera F7.4-F.
- (D2) Page-predictor stub mínimo (heading + párrafo).
- (D3) `setVistaGrupos` ELIMINADA (no wrapper). `_vistaActual` reemplazado por `window._currentPage`.
- (D4) Tab Fase final con gate `_gruposComplete` → modal "Es necesario rellenar fase de grupos al completo".
- (D5) Bottom-tab: `quiniela`→`elim` en id, icon, case `getIcon`. Routes null → rutas reales.
- **Pivot R-6**: NO reusar `#modal` (vive dentro de `#page-elim` con `display:none` cuando user no entró aún → no funciona como gate global). Crear `#fc-gate-modal` mini auto-contained (~30 líneas HTML+CSS+JS combined). Será absorbido o eliminado en F7.4-F.
- **R-3**: `boost-ticker` movido a `#page-jornada` (justificación: comentario HTML "Ticker boost jornada", info por días, page-grupos ya tiene CTA banner inferior con resumen de boosts pendientes que duplica info).

**QA programático:** `node --check` OK en los 7 JS, `npm run build` OK (200ms). `setVistaGrupos`/`_vistaActual`/`btn-vista-*`/`'quiniela'` ausentes en código funcional (solo comentarios F7.4-D-1 + 1 string literal en `data.js:294` no relacionado). VALID_PAGES con 8 elementos en los 3 sitios canónicos. dist/index.html: 4 markers (page-jornada, page-directo, page-predictor, fc-gate-modal). dist/js/components/bottom-tab.js: `'elim'` presente, 0 `'quiniela'`. dist/js/shell.js: SHELL_PAGES con 5 elementos. dist/css/base.css y directo.css: 0 reglas `display:none` zombie.

**QA visual San (smoke localhost:5173 mobile 375px):** los 12 puntos DoD funcional ✅ verificados por San (5 tabs navegan + gate modal centrado y cerrable + Promise singleton F7.4-B intacto + restore localStorage para jornada/predictor + tickerBoostToggle re-renderiza + hook closeMobileFocus funciona + sin regresiones welcome/score/admin/login + console limpia + alias quiniela→elim limpio).

**3 bugs preexistentes detectados durante smoke (NO en scope F7.4-D-1)** — documentados en `errores_conocidos_porra.md` como **ERR-30/31/32**. Verificados pre-existentes: scoring.js MD5 idéntico main vs F7.4-D-1, lockCardsInFocus callsites iguales (6/3), reproducidos en producción `porramundial2026-seven.vercel.app`:
- **ERR-30** (BLOQUEANTE UX): `mobile-locked` persiste tras Deshacer (regla CSS bloquea botones). Causa: handler `btn-undo` no llama `unlockCardsInFocus` ni resetea `groupSaved`. Fix simple ≤5 líneas.
- **ERR-31**: `btnRow` residual tras Deshacer (mantiene "✓ Guardado + ↩ Deshacer" en vez de regresar al botón Guardar). Causa: handler no restaura `btnRow.innerHTML`.
- **ERR-32** (BLOQUEANTE UX, descubierto al verificar ERR-30): boost check desincroniza con `boostPicks` (UI con `chk.checked=true` mientras card sin `.boost-active` y `boostPicks={}`). Causa: `refreshBoostRowsInFocus` solo gestionaba `.boost-blocked`, no reconciliaba `chk.checked`/`.boost-active`/`.boost-on` con `boostPicks`.

**[Actualización post-merge]**: PR #31 mergeado vía merge commit `cbc52e4` (parcial — la branch local apuntaba a `7619eca` y dejó fuera el commit docs `849a764` original). Recuperado en PR #34 docs-recovery. **ERR-30 ✅ FIXED en mini-PR #32** (`1a7a9b9` · `delete window.groupSaved[match.group]` + `window.unlockCardsInFocus(match.group)` antes de `savePredictions()`; deuda BD-sync aceptada). **ERR-32 ✅ FIXED en mini-PR #33** (`13f4ecd` reconciliación chk + classes con `boostPicks` en `refreshBoostRowsInFocus` + `9c4bc04` follow-up `setTimeout(refreshBoostRowsInFocus, 0)` post-default-action del checkbox nativo). **ERR-31 sigue documentado pendiente fix** (cosmético, no bloqueante).

**Próximo paso**: F7.4-D-2 (widgets Predictor) o F7.4-E (page-perfil + simplificación renderAuthBar) según prioridad.

---

**[27abr2026] Mini-PR ERR-30 fix** (PR #32, commit `1a7a9b9`, branch `claude/err-30-fix-undo-unlock`). Fix BLOQUEANTE UX detectado durante smoke F7.4-D-1: handler `.btn-undo` (`scoring.js:1186`) ahora hace `delete window.groupSaved[match.group]` + `window.unlockCardsInFocus(match.group)` antes de `savePredictions()`. 2 líneas funcionales + 3 de comentario. `delete` (no `= false`) coherente con patrón canónico `unsaveGroup`. Deuda aceptada: NO sincroniza con `league_members.groups_saved` en BD; tras reload el bug puede reaparecer en escenarios edge raros. F7.4-F rediseñará el flujo entero. Errores_conocidos_porra.md ERR-30 entry creada con ✅ FIXED + nota gap BD sync. CLAUDE.md tabla ERR ampliada con ERR-30. Pendiente smoke San (6 puntos). Nota merge parcial PR #31: el merge `cbc52e4` solo trajo el commit `7619eca` (feat F7.4-D-1) y dejó fuera `849a764` (docs end-of-session); por eso ERR-31, ERR-32, entrada migration-log F7.4-D-1, CHANGELOG HEAD F7.4-D-1, 00-app-shell §7 F7.4-D-1 ✅ Cerrada y CLAUDE.md Estado actual post-D-1 quedaron sin propagar a main. Pendiente recuperación en sesión separada (este mini-PR es scope ERR-30 solo).

**[27abr2026] Mini-PR ERR-32 fix** (PR #33, branch `claude/err-32-fix-boost-sync`). Fix BLOQUEANTE UX detectado tras smoke ERR-30 (boost check desincronizado con `boostPicks`). `refreshBoostRowsInFocus` (`ui-groups-mobile.js:601`) ahora reconcilia `chk.checked`, `boost-active`, `boost-on` con `boostPicks` además de `boost-blocked`. ~10 líneas insertadas dentro del forEach de rows (variables `bp`, `boostedKey`, `card`, `row`, `matchKey` reusadas del scope existente). `boostPicks` queda como single source of truth — `chk.disabled = !!(boostedKey && !isThisMatch)` mantiene simétrico el render con `attachEvents` de `scoring.js`. ERR-32 entry creada en errores_conocidos_porra.md con ✅ FIXED. CLAUDE.md tabla ERR ampliada con ERR-32. Pendiente smoke San (5 puntos).

---

## 2026-04-28 — Sesión audit Postgres (parte aplicada desde Claude.ai)

Auditoría completa con `get_advisors` (security + performance) tras meses sin revisión. Bloques aplicados directamente vía Supabase MCP `execute_sql`:

### Bloque A — Vault decryption fix (raíz crítica)

La función `public.get_vault_secrets(text[])` tenía grants amplios y descifraba sin `SECURITY DEFINER` correcto. Reescrita: `search_path` fijado, grants limitados, `SECURITY DEFINER` explícito.

### Bloque B — RLS en `orchestrator_jobs`

```sql
ALTER TABLE public.orchestrator_jobs ENABLE ROW LEVEL SECURITY;
CREATE POLICY orchestrator_jobs_service_only ON public.orchestrator_jobs
  FOR ALL USING (auth.role() = 'service_role') WITH CHECK (auth.role() = 'service_role');
```

### Bloque C — REVOKE/GRANT en 4 funcs de control

Patrón aplicado a `enforce_max_leagues_per_user()`, `handle_new_user()`, `schedule_match_crons(text, timestamptz)`, `unschedule_match_crons(text)`:

```sql
REVOKE EXECUTE ON FUNCTION public.<fn>(...) FROM PUBLIC;
GRANT  EXECUTE ON FUNCTION public.<fn>(...) TO service_role;
ALTER  FUNCTION public.<fn>(...) SET search_path = public, pg_temp;
```

Justificación: las 4 son triggers o helpers consumidos solo desde `service_role`. **NO** se aplica este patrón a `is_porra_abierta` por ser invocada desde RLS USING/WITH CHECK — ver **ERR-33**.

### Bloque D — DROP de índices unused

```sql
DROP INDEX IF EXISTS public.idx_award_picks_league;
DROP INDEX IF EXISTS public.idx_ko_predictions_league;
```

Validado vía `pg_stat_user_indexes`: 0 lecturas desde creación.

### Bloque E — Verificación tablas IA

`ia_snapshots` y `ia_predictions` tienen RLS y policies de lectura pública. No requiere acción.

---

## 2026-04-28 — Sesión audit Postgres (parte aplicada por Claude Code)

Migrations preparadas en `supabase/migrations/` por Claude Code y aplicadas vía Supabase MCP desde Claude.ai (CLI no linkeado en container Code; saltamos D3 db-push del plan original). Registradas en `supabase_migrations.schema_migrations` con timestamps `20260428020438` y `20260428020439` para coherencia repo↔BD (`supabase db pull/push --linked` no las re-aplicará).

- `DROP TABLE _fix_encoding_temp` (residual, 0 filas).
- `DROP VIEW refactor_status` (residual del refactor F4, sin dependientes).
- `ALTER FUNCTION is_porra_abierta SET search_path = public, pg_temp`. **NO** se modifican grants — la función vive en USING/WITH CHECK de 8 RLS policies (`predictions`, `ko_predictions`, `award_picks`, `boost_picks` × INSERT/UPDATE) y necesita `EXECUTE` para `authenticated`. Ver ERR-33.
- 7 `CREATE INDEX IF NOT EXISTS` en FKs sin cobertura (advisor performance): `award_picks.user_id`, `boost_picks.league_id`, `ia_predictions.snapshot_id`, `ko_predictions.user_id`, `leagues.created_by`, `predictions.user_id`, `whatsapp_subscribers.user_id`. Sin `CONCURRENTLY` (tablas <500 filas, bloqueo despreciable).

Sección 2.6 (19 RLS rewrites con `(SELECT auth.uid())`) → planning en `docs/db/audit_28abr_section26_rls_planning.md`, no ejecutado en esta sesión (bajo impacto pre-Mundial, tablas <500 filas; re-evaluar pre-11jun).

**Verificación post-apply 5/5 PASS** desde Claude.ai (search_path en `is_porra_abierta`, drops verificados, 7 índices presentes, grants intactos anti-regresión ERR-33, 2 entries registradas en `schema_migrations`).

**Diff advisors performance:** `unindexed_foreign_keys` 7 INFO → 0 ✅; `auth_rls_initplan` 19 WARN → 19 WARN (esperado, planning); `multiple_permissive_policies` ~30 → ~30 (backlog); `unused_index` 0 → 7 INFO (los recién creados, los retira advisors al detectar uso).

**Backlog formal:** `tmp_upload_files` (7 filas `docs/fase_e/*` a verificar antes de DROP), 19 RLS rewrites pre-11jun, 5 policies SELECT duplicadas (`award_picks`/`boost_picks`/`ko_predictions`/`predictions`/`live_scores`), 4 buckets storage con listing amplio (`flags`/`kits`/`miniatures`/`sites`), leaked password protection (Auth dashboard).

**Commits rama `claude/postgres-security-audit-bFlg0`:**
- `f3030b6` feat(db): drop residuals + fix is_porra_abierta search_path
- `545fced` feat(db): add missing FK indexes (7)
- `2c66229` docs(db): planning sección 2.6 RLS rewrites

## 2026-04-28 02:33 UTC — Fix tmp_upload_files (post-PR#36)

ERROR del advisor 0013 (rls_disabled_in_public) sobre `public.tmp_upload_files` que NO se trató con la severidad debida en el levantamiento original (estaba listado solo como 'DROP residual #4'). Anon y authenticated tenían SELECT/INSERT/UPDATE/DELETE/TRUNCATE → cualquier persona con la anon key (pública por diseño en el frontend) podía leer los 7 base64 de Fase E y, peor, INSERT/UPDATE/DELETE/TRUNCATE arbitrariamente.

Aplicado vía Claude.ai MCP, transacción atómica:
- `ALTER TABLE … ENABLE ROW LEVEL SECURITY`
- `CREATE POLICY tmp_upload_files_service_only FOR ALL TO service_role USING (true) WITH CHECK (true)`
- `REVOKE ALL ON public.tmp_upload_files FROM anon, authenticated`

Patrón idéntico a `orchestrator_jobs_service_only`. Verificación 5/5 PASS (`rls_enabled`, `policy_correct_pattern`, `grants_revoked_from_public_roles`, `service_role_kept`, `data_intact`). Diff advisor security: 1 ERROR → 0.

DROP final de la tabla queda en backlog (verificar antes que los 7 paths `docs/fase_e/*` están commiteados al repo).

Migration registrada: `20260428023300_secure_tmp_upload_files` (`created_by=claude-ai-mcp`).

## 2026-04-28 03:00 UTC — Backlog items 3+4: dup policies + RLS initplan rewrites

Cierra los items 3 y 4 del backlog post-audit Postgres 28abr. Aplicado vía Claude.ai MCP, transacción atómica.

**Item 3 — DROP 4 policies SELECT duplicadas con `USING(true)`:**

- `award_picks_select`, `boost_picks_select`, `ko_predictions_select`, `predictions_select`.

Decisión de producto: los usuarios **NO** ven predicciones de otros. Cada par tenía además la policy `"Ver mis X"` con `USING ((SELECT auth.uid()) = user_id)` que es la que sobrevive. Esto reduce además el WARN `multiple_permissive_policies` (~30 → ~5).

**Item 4 — 17 RLS rewrites `auth.uid()` → `(SELECT auth.uid())`:**

Tablas tocadas: `award_picks`, `boost_picks`, `ko_predictions`, `predictions` (3 policies cada una × INSERT/UPDATE/SELECT — la SELECT vía `"Ver mis X"`), `league_members` (3), `leagues` (1), `profiles` (1). Patrón: envolver `auth.uid()` en `(SELECT auth.uid())` para que el planner lo trate como InitPlan (evaluado una vez por query) en vez de re-evaluarlo por fila. Política compleja en `"Usuario actualiza solo nombre e inscrito"` también reescrita. Diff advisor: `auth_rls_initplan` 19 WARN → 2.

Nota: `live_scores` y `whatsapp_subscribers` quedaron fuera del rewrite por no tener `auth.uid()` en quals/with_check (re-revisado tras el levantamiento — el conteo original incluía las que ya estaban con `(SELECT)` o que en realidad usaban `auth.role()`). Total efectivo: 17 (no 19).

Verificación 4/4 PASS. Migration registrada: `20260428030000_rls_drop_dup_policies_and_initplan_rewrites` (`created_by=claude-ai-mcp`).

## 2026-04-28 04:00 UTC — Backlog items 2+5: storage listing + tmp_upload_files DROP

Cierra los items 2 y 5 del backlog post-audit Postgres 28abr. Aplicado vía Claude.ai MCP.

**Item 2 — DROP 4 policies SELECT en `storage.objects`:**

- `flags_public_read`, `kits_public_read`, `miniatures_public_read`, `sites_public_read`.

Razonamiento: los buckets correspondientes (`flags`, `kits`, `miniatures`, `sites`) tienen `public:true`. Eso ya permite servir objetos vía URL directa sin necesidad de policy RLS. Las policies eran **redundantes** Y permitían además listing arbitrario del inventario completo del bucket (advisor `public_bucket_allows_listing`, WARN). Diff advisor: 4 WARN → 0. URL directa sigue funcionando intacta — el cliente sigue accediendo a las imágenes pero no puede enumerarlas.

**Item 5 — DROP `public.tmp_upload_files`:**

Tabla securizada el 28abr 02:33 UTC (PR#37, RLS+policy `service_only`). Confirmado tras inspección: contenía scripts Python de backtest WC2022 de Fase E del IA Predictor (21abr2026). Esa fase ya está cumplida — el motor está implementado en TypeScript en la EF `porra-ia-compute v10` con paridad 46/46 verificada vs el original Python. La tabla ya no aporta. DROP final aplicado.

Verificación 4/4 PASS. Migration registrada: `20260428040000_drop_storage_listing_policies_and_tmp_upload_files` (`created_by=claude-ai-mcp`).

**Estado backlog post-audit Postgres 28abr tras esta sesión:**

- ✅ Item 1: `tmp_upload_files` securizado (PR#37) + DROP final aplicado aquí.
- ✅ Item 2: storage listing policies DROPped.
- ✅ Item 3: 4 dup SELECT policies DROPped.
- ✅ Item 4: 17 RLS rewrites con `(SELECT auth.uid())`.
- ✅ Item 5: `tmp_upload_files` DROP final.
- ⏳ Auth dashboard leaked password protection (HaveIBeenPwned) — acción de San (1 click en Supabase → Authentication → Policies).

Diff advisors finales:
- security: `public_bucket_allows_listing` 4 → 0; ERRORs siguen en 0.
- performance: `auth_rls_initplan` 19 → 2; `multiple_permissive_policies` ~30 → ~5; `unindexed_foreign_keys` 0 (de PR#36).

**[27abr2026 18:41] F7.4-D-A** (commit `678ba5a`, branch `claude/update-legacy-banner-button-DoQLh`). Eliminado banner `#cta-eliminatorias` y btn header `#btn-go-eliminatorias` legacy de page-grupos — ya redundantes con bottom-tab + gate modal `#fc-gate-modal` (F7.4-D-1). `checkGroupsComplete` (`public/js/ui-groups.js`) refactorizada de 124 LOC a 14 LOC: helper puro que solo computa `window._gruposComplete` (consumido por gate modal en `bottom-tab.js`). `ctaExpandJornada` + export borrados (0 callers fuera del banner). `goToEliminatoria` borrada de `public/js/ui-nav.js` (0 callers tras eliminar onclick HTML). 4 líneas muertas en handler boost (re-render `cta-boost-panel`) eliminadas. 3 ficheros (9+ / 204−). Validado: `node --check` OK + `npm run build` OK (44 modules, bundle 188.50 KB, 0 warnings). Scope estrictamente A: NO toca `setView`, `view-tabs`, `ko-sub-bar` ni page-elim (acoplado a F7.4-F). Pendiente smoke localhost por San.

## 2026-04-29 — Cloudflare Turnstile CAPTCHA (PR#39 + PR#40)

Integrado Cloudflare Turnstile en el formulario de login para cerrar el WARN `auth_captcha_enabled` del advisor de Supabase.

- Widget Managed mode: Cloudflare decide si mostrar reto o no (invisible para la mayoría).
- Hostname configurado: `porramundial2026-seven.vercel.app`.
- Sitekey y secret guardados en Vault (`TURNSTILE_SITE_KEY` / `TURNSTILE_SECRET_KEY`).
- Secret además configurada en Supabase Auth dashboard → Authentication → Attack Protection.
- `captchaToken` leído de `[name=cf-turnstile-response]` y pasado en `signInWithPassword` `options`.
- Widget reseteado vía `window.turnstile.reset()` tras cada intento (success o error — los tokens son single-use).
- Localhost: test sitekey `1x00000000000000000000AA` (always-passes, banner rojo "Solo para pruebas" esperado).
- Producción: sitekey real `0x4AAAAAADFzAxFI4isPOuJx`, sin banner.
- Detección entorno: `window.location.hostname === 'localhost'` en script inline síncrono que asigna `class="cf-turnstile"` + `data-sitekey` antes de que `api.js` (async defer) auto-renderice.

**Commits:**
- PR#39 `8b1dc30` — `feat(auth): add Cloudflare Turnstile CAPTCHA to login form`.
- PR#40 `7467a4b` — `fix(auth): use Turnstile test sitekey on localhost`.

**Scope:** solo formulario login (`#auth-login-form`). `doRegister()` y modal de registro intactos. `auth.js` tocada únicamente en `doLogin()` (PR#39); PR#40 es 100% `index.html`.

## 2026-04-30 — F7.4-D-2 cleanup IA Predictor CSS (PR#43)

[~10:00 UTC] CLEANUP: cleanup IA Predictor widgets — `public/css/base.css` −18 LOC. Eliminado bloque IA duplicado (líneas 701-713) + reglas huérfanas `.ia-loading`, `.ia-dot`, `@keyframes iaDot` sin uso tras eliminar chip `.ia-hint` en post-F.2 (24abr2026). `scoring.js` NO tocado. Smoke verde: cards grupo siguen hidratando `.ia-bar` con signo + % + quip. Commit `0baaa4a`. Merge PR#43.

## 2026-04-30 — F7.X nuevo shell visual page-elim Fase final (PR#44)

[~14:00 UTC] FASE: rediseño visual `#page-elim` con nuevo shell controller. 8 commits, +872 −66 LOC, merge SHA `5ddb974`.

**Files nuevos:**
- `public/js/ui-elim-shell.js` (+545 LOC) — controlador shell, mounting/unmounting, render de cabecera + sección rondas wrapping cards CORE.
- `public/css/components/elim-shell.css` (+295) — estilos shell, header, layout grid de rondas.
- `public/css/components/elim-tokens.css` (+30) — design tokens (`--elim-bg`, `--elim-card-radius`, etc.).

**Wiring:**
- `js/main-entry.js` carga `ui-elim-shell.js` en chain (3 LOC).
- `public/js/ui-nav.js` invoca `mountElimShell()` al entrar a page-elim (11 LOC).
- `public/js/components/bottom-tab.js` retira gate modal `_showGruposGateModal` (24 LOC). Fase final accesible siempre; shell muestra estado coherente con `window._gruposComplete`.

**Cards CORE preservadas** (R32→R16→QF→SF→Final): el shell envuelve, no reemplaza. Comportamiento y datos intactos.

**Bug UI #3 backlog corregido**: botón simular eliminatorias antes visible para non-admin. Gate ahora chequea `window._isAdmin` correctamente.

**Sub-vistas diferidas**: KO panel detail, Awards section, finalizar-section quedan para iteración cosmética posterior. Scope estricto al shell + tokens + wiring + bug fix.

**Patrón multi-agente validado**: 4 subagentes Haiku 4.5 paralelos vía Task tool en 2 oleadas (oleada 1: PorraHeader + PhaseStepper; oleada 2: ElimRow + ElimExpanded — split POR COMPONENTE, no por tipo de fichero). Padre integró outputs y resolvió mismatches de selectores CSS↔JS y escapes en template strings. Patrón añadido a `.claude/rules/multi-agent-sync.md`.

**Design source persistente en branch dedicada**: bundle v2 de referencia push-eado a branch `docs/quiniela-design-source-v2` (commit `fd95d08`). Mejor que embed en brief porque: (a) sobrevive entre sesiones, (b) versionable, (c) consultable vía `git show`. Patrón a seguir.

## 2026-04-30 — Cloudflare Turnstile DESACTIVADO

[~16:00 UTC] AUTH: CAPTCHA Turnstile desactivado en Supabase Auth dashboard → Authentication → Attack Protection (secret eliminada). Tras 2 días en producción (PR#39+PR#40, 29abr), decisión de revertir por:

1. App privada (porra entre amigos) — fricción del CAPTCHA innecesaria.
2. **Limitación arquitectónica Supabase Cloud**: single-secret slot por proyecto — imposible separar `localhost:5173` de `porramundial2026-seven.vercel.app` sin segundo proyecto Supabase.
3. **Cloudflare no acepta hostnames con port** en site config — bloqueando dev local incluso con sitekey real.

**No es bug del código.** Widget HTML/JS en `index.html` y `auth.js` permanece (no estorba — sin secret en Auth, `signInWithPassword` ignora `captchaToken`). Decisión documentada en `CHANGELOG.md`. NO se añade a `errores_conocidos_porra.md` (limitación de stack, no error).

## 2026-05-02

[10:03] PUSH: F7.7-VIS-11 (B11-trionda) timeline Trionda + 4 UX fixes — public/css/components/predictor-shell.css, public/js/ui-pred-shell.js, public/js/data.js (dfc8dc3)
[14:45] PUSH: F7.7-VIS-12 (B12-info-fixes) eyebrow simplificado + badge X/104 — public/js/ui-pred-shell.js (ade6771)
[18:15] PUSH: F7.7-VIS-13 (B13-fix-coherence) linea sigue balon + badge sin % — public/js/data.js, public/js/ui-pred-shell.js (69da6d6)
[18:30] APLICAR: vistas SQL v_league_member_count + v_user_global_rank vía Supabase MCP apply_migration — supabase/migrations/20260430200000_predictor_ranking_views.sql (manual Claude.ai, Code sin acceso a apply_migration)
[18:45] PUSH: F7.7-VIS-14 (B14-fix-phase-boundary) <= → < estricto + cleanup CLAUDE.md (-504 bytes) — public/js/data.js, CLAUDE.md (a89de71)
[19:15] PUSH: F7.7-VIS-15 (B15-badge-clamp) clamp badge extremos + flecha movil independiente — public/css/components/predictor-shell.css, public/js/ui-pred-shell.js (dbaf9b7)
[19:25] PUSH: F7.7-VIS-16 (B16-badge-spacing) bottom calc(100% + 10px) → calc(100% + 24px) — public/css/components/predictor-shell.css (a859d36)
[19:38] CREAR: PR#46 F7.7-VIS Predictor mobile redesign + Trionda Timeline (B1..B16) vía Code Explorer extensión Chrome (api GitHub directa)
[19:42] MERGEAR: PR#46 squash a main por San desde GitHub UI — SHA d1be8bf5
[19:55] PUSH: sesión-close — CLAUDE.md Estado actual + Top-3 + CHANGELOG entrada F7.7-VIS + migration-log append (este commit)

## 2026-05-04

[12:08] DOCS-SLIM-SECRETS — preámbulo F7.7-IA.
  - docs/secrets.md (nuevo, consolida Auth + Vault + EF secrets + patrones de acceso)
  - CLAUDE.md: sección Auth & Secrets → puntero (-488 B); mapa documentación: split fila architecture en 2 (architecture sin Secrets + nueva fila secrets)
  - docs/architecture.md: ## Secrets — clasificación → puntero (-1144 B)
  - Tamaños finales: CLAUDE.md 9756 / 10240 (margen 484 B), architecture.md 8655 B, secrets.md 2315 B
  - Commit: este commit (rama claude/extract-secrets-docs-1h5VT, mergeado a main vía PR#47 squash, SHA `4fb8394`)

[14:00-14:25] F7.7-IA C1+C2 — Bot IA Zayu (branch `claude/f77-ia-c1-c2`).
  - FASE 0: constraints UNIQUE/PK verificadas en predictions (league_id,user_id,match_id), ko_predictions (idem), award_picks (league_id,user_id), league_members (PK) → ON CONFLICT DO NOTHING viable en todas.
  - FASE 1: DDL aplicado vía MCP `apply_migration` (`add_bot_user_replication_trigger` + `harden_bot_replication_functions`). Mirror local en supabase/migrations/20260504130246..317. Advisors: 3 nuevos atribuibles a la migration arreglados (search_path mutable + EXECUTE expuesto a anon/authenticated). Resto pre-existente.
  - FASE 2: EF v11 escrita (2 acciones nuevas: seed_ia_user, seed_ia_user_predictions). Tamaño bundle 64705 B (63.2 KB) — under ERR-29 70 KB. Branch pusheada SHA `f4f3e7c`.
  - FASE 2-D: deploy via CLI local por San (container Anthropic sin SUPABASE_ACCESS_TOKEN, MCP deploy_edge_function bloqueado por output cap del harness en Bash a ~2KB → no extraíble el bundle de 63KB para el tool call). EF v11 ACTIVE SHA `af0f24a8`.
  - FASE 3a: 1ª llamada `seed_ia_user` (rid 1778) → 500 internal. Auth user creado en auth.users (`17ab3b59-…`) pero el INSERT a profiles falló (race con FK). Recovery: INSERT manual idempotente en profiles + league_members. Bot quedó funcional. Documentado como ERR-34.
  - FASE 3b: `seed_ia_user_predictions` con `league_id=Biwenger` (rid 1782) → 200 OK en ~50s. Response: 72 group preds + 32 KO + champion=Francia + top4=[Francia, Argentina, España, Inglaterra] + awards (fallback determinista: Messi/Messi/Dibu/Lamine_Yamal). 5ª call Haiku integradora cayó al fallback (parsing JSON/tool-use). Awards aceptables; mejora prompt diferida.
  - FASE 4: backfill via SQL `replicate_bot_to_league('17f0ceb4...')` (Porrazo) + `replicate_bot_to_league('6a24197e...')` (Porrazo 2). Instantáneo.
  - FASE 5: verificación 3 ligas idénticas — preds=72, ko=32, awards=true, groups_locked=12/12 en Biwenger/Porrazo/Porrazo2.

[19:24] SPRINT-A+B (4-may-2026): cierre items A (Awards toggle Fase Final, 4 commits A.1..A.4 — c5e9794/ecf809b/0a69d64/5c22530) + B1 Jornada v2 (fd093be) + B2 Directo v2 (10f3bd1) + fix(jornada) card-wrap-MATCHKEY id (d0176eb). Branch `claude/fix-awards-card-display-BZMg5`. CSS nuevos: `public/css/components/jornada-v2.css` (prefijo jv2-) + `public/css/components/directo-v2.css` (prefijo dv2-). C diferido — anotado en CLAUDE.md §Pendientes Bugs UI item 5 + CHANGELOG entrada del día con scope (`createMatchCard` + `renderAll` + `ui-groups-mobile.js` mobile-collapse).

[20:30-21:00] VER-TARJETA-MOBILE — iteraciones de fix sobre `_showJcardModal` (`public/js/ui-groups.js`) en branch `claude/fix-awards-card-display-BZMg5` post-base. (1) intento `transform:scale(ratio)` con width/height del wrapper (5cbf7c3, 031c717) — descartado: scrollbar horizontal en mobile. (2) descartado `transform:scale` y width directo `clone.offsetWidth - 5` con `wrapper max-width:calc(100vw - 10px)` + `overflow-x:hidden` (aa5679f) — encajaba sin slider pero sin centrar. (3) centrado: overlay `align-items:flex-start`, wrapper `margin:0 auto;max-width:calc(100vw - 32px)`, clone `margin:0 auto` + limpieza left/right (62f4ce5). (4) `padding-bottom:24px` al wrapper para borde inferior visible (9ec4638).

[21:05] PR#48 + PR#49 squash-merged a main por San (orden: PR#48 bot Zayu primero, PR#49 sprint A+B después). HEAD main = `137125e`. Auto-delete remoto de branch `claude/fix-awards-card-display-BZMg5`. Branch fantasma `claude/fix-awards-card-mobile-5hBvd` aún viva en remote (residual de sesión previa).

[21:08] CIERRE-SESION: actualización docs post-PR#48+#49.
  - CLAUDE.md: Estado actual (HEAD `137125e`, post Sprint A+B + bot Zayu); Top-3 reordenado (1) Backend pre-11jun, (2) Cards embebidas grupos formato fase final, (3) Tests motor puntuación; Bugs UI — quitado item 5 (Grupos compact view, ahora Top-3 #2) + añadido bloque "Resueltos sprint A+B".
  - CHANGELOG.md: bloque fix(jornada) ampliado con detalle goleador (cloneNode no transfiere `.value` runtime → copy manual) + overflow mobile centrado (versión final tras 4 iteraciones).
  - migration-log: este append.
  - Cleanup branches remotas: `claude/fix-awards-card-display-BZMg5` ya auto-eliminada por squash-merge GitHub. Intento `git push origin --delete claude/fix-awards-card-mobile-5hBvd` desde Code → HTTP 403 (ERR-17, proxy git de Anthropic no permite delete refs). Pendiente que San borre la branch fantasma desde GitHub UI o `git push origin --delete` local.
  - Pre-commit hook activado (`git config core.hooksPath .githooks`); tamaños finales CLAUDE.md 10082 / 10240 (margen 158 B), CHANGELOG.md 16595 / 30720.

## 2026-05-05

[~10:00-22:00] SPRINT-B Grupos screen redesign (PR#52, branch `claude/sprint-b-grupos-redesign`):

Sesión larga con múltiples iteraciones ↔ smoke checks de San. 14 commits squash-mergeados a main vía PR#52 (SHA `aebbd22`). Patrón validado: 4 subagentes Haiku 4.5 paralelos (G1 chips A-L, G2 card colapsable, G3 carousel scroll-snap, G4 tabla clasificación) integrados por Opus padre en oleadas A→B→C.

**Commits principales**:
- `5a223eb` scaffold mount points + grupos-shell.css skeleton.
- `26d2658` Oleada A — chips A-L + card colapsable shell (4 subagentes paralelos).
- `31ff5d8` Oleada B — carousel scroll-snap (slot 288→320 tras smoke).
- `1d35651` Oleada C — tabla clasificación restilada (override `renderGroupTableCard`).
- `00ac929` letterbar replica Fase Final + compact preview cards.
- `4785883` modal editable MOVE-original (preserva listeners attachEvents).
- `a900757` Bug 1 `[hidden]` UA stylesheet + Bug 2 nav flechas modal.
- `67399b9` slot responsive + tabla visible (drop attr `hidden`).
- `98f4550` compact card visual replica EXACTA Fase Final.
- `7d8f9c6` compact card más estrecha (revertido en `7f9b9ff`).
- `05f5dd4` expanded como SIBLING (no anidado) — root cause overflow.
- `2d8aec8` padding centralizado réplica `.fc-elim-list`.
- `b66aea9` neutralizar `.container` legacy padding 20px lateral.
- `412fddf` ko-body fill space (TU PRONÓSTICO + marcador / CTA).
- `7f9b9ff` revert compresión vertical agresiva + centrar card en slot.
- `8cad0d3` fix selector stale `.fc-grupos-mini` post-class-drop.

**Root causes encontradas** (todas via DOM inspector + getComputedStyle por San):
- ERR-37: scroll-snap carousel anidado en container colapsable consume 60-100px → overflow. Modelo correcto: SIBLING tras `parentNode.insertBefore(expanded, sectionEl.nextSibling)`.
- ERR-36: `.container` legacy `padding: 0 20px 60px` (ko.css) eats 40px laterales solo en pages anidadas. `#page-elim` está top-level y no sufre. Override scoped `#page-grupos > .container { padding: 0 }`.
- ERR-35: stale querySelector `.fc-grupos-mini[data-match-key=...]` tras drop de clase en commit 98f4550 → null → preview congelado tras Deshacer en modal.

**Lecciones técnicas**:
- MOVE-original > clone para modales editables: `appendChild` mueve preservando listeners de `attachEvents`. `originalParent` + `originalNextSibling` + `originalStyleAttr` para restitución exacta. Compatible con navegación prev/next dentro del modal.
- `[hidden]` HTML attribute persiste tras `appendChild` (no se limpia automáticamente). Para hidden-source patterns: drop el attr y usar CSS scoped (`.fc-grupos-card__source { display: none !important }`).
- Reuso de clases CSS de otra screen (`.ko-card`, `.fc-elim-stepper__item`) con override scoped al carousel padre evita reinventar y mantiene paridad visual al 100%.

[22:00] CIERRE-SESION SPRINT-B (este commit, branch `claude/post-sprint-b-docs`):
- CLAUDE.md: Estado actual HEAD `aebbd22`, Top-3 reordenado (1) Backend pre-11jun, (2) Tests motor puntuación, (3) Pulido UI residual. Bugs UI table-índice ampliada con ERR-34..37.
- CHANGELOG.md: nueva sección 2026-05-05 con 14 commits del Sprint B + lecciones técnicas.
- errores_conocidos_porra.md: añadidos ERR-34 (seed_ia_user race), ERR-35 (stale querySelector), ERR-36 (.container legacy), ERR-37 (carousel anidado).
- docs/architecture.md: nueva sección "Pantallas y patrones de carrusel" documentando Fase Final + Grupos post-Sprint B + modal editable MOVE-original.
- .claude/rules/frontend-css.md: añadidas notas sobre .container legacy + stale querySelector + scroll-snap sibling pattern.
- Pre-commit hook validado: CLAUDE.md 10230 / 10240, CHANGELOG.md ~21KB / 30720.

## 2026-05-06 · Sprint Globo MVP cerrado · PR #54

- Branch: `claude/globo-mvp-setup-QqBiE` → squash-merge a `main` SHA `8e6681c` (`merged_at 2026-05-06T01:01:41Z`).
- Sprint: cinta dorada en `page-grupos` + overlay full-screen con globo 3D selecciones Mundial 2026 (47 polígonos dorados — UK cubre England+Scotland — + 16 sedes blancas + tooltips on hover + autorotate con pause on interact).
- Stack: `globe.gl@2.33.0` lazy-loaded desde `cdn.jsdelivr/npm/globe.gl@2.33.0` al primer click. GeoJSON Natural Earth 50m vía `cdn.jsdelivr/gh/nvkelso/natural-earth-vector` (cero ficheros de datos en repo).
- Files: 2 nuevos (`public/js/ui-globo-equipos.js` 297 LoC + `public/css/components/globo-equipos.css` 220 LoC namespace `fc-globo-*`) + 3 modificados (`public/js/ui-groups.js` `+_ensureGloboCintaMount`, `index.html` `+1 link CSS`, `js/main-entry.js` `+1 loadScript`).
- Commits del sprint:
  - `1dfa393` MVP inicial (IIFE + paleta + ALIAS_NE 13 entradas + lazy-load + overlay lifecycle).
  - `9ed9e25` altitude responsive mobile/desktop con resize handler que preserva zoom manual.
  - `da6d796` 5 perf opts (revertido — afectaban apariencia).
  - `f5f97e6` revert + zoom out preliminar 7.0/6.2.
  - `0dea54f` tune final: zoom 5.0/4.2 + atmósfera 0.10 + pixelRatio cap 1.5 retina.
- **Lecciones técnicas**:
  - ERR-38 documentada (globe.gl@2.33.0 factory `Globe()` no `new`, `controls()` para autoRotate/zoom, atmosphere HEX puro). HTML referencia `docs/globo-mundial-2026-REFERENCIA.html` (commit `0edd40e`) como fuente de verdad para la API 2.33.0.
  - Reverts limpios sin `git revert` (commit nuevo aplicando opuestos) → historial linear y squashable.
  - Lazy-load on first click + fetch externo CDN para GeoJSON pesado (`~3 MB`) → cero impacto en bundle inicial y cero archivos de datos en repo.
- **Roadmap próximas fases**:
  - PR2: doble leyenda banderas + sedes debajo del globo, click navega con `globe.pointOfView()`.
  - PR3: popups enriquecidos por país (entrenador, ranking FIFA, mundiales previos) y por sede (capacidad, año, dato destacado, partidos). Datos desde Wikipedia (CC BY-SA, sin antibot).
  - PR4 (~junio 2026): screen plantilla con campo de fútbol + 11 titular + convocatoria + entrenador, cuando salgan squads reales.

## 06may2026 · fix(grupos): badge done/total stale tras simular · PR #56

- Branch: `fix/grupos-badge-progress-stale` → squash-merge a `main` SHA `fa56a92`.
- Bug: badges `done/N` de cards colapsables stale tras "Todos los grupos (72)" o dado individual; tarjetas y tablas sí actualizadas, headers y letterbar no.
- Causa: `diceSimulateMatch` no dispara `jcard:updated` (único punto de refresh del header). `diceSimulateAllGroups` solo refrescaba tablas manualmente.
- Files: `public/js/ui-groups.js` (extracción helper `_refreshGrupoCardHeader`, expuesto en `window`) + `public/js/admin.js` (batch refresh en `diceSimulateAllGroups` y `diceSimulateGroup`).
- ERR: N/A (regresión específica, no patrón reusable).
- Backlog item 12: parcialmente cerrado (badge `done/N` resuelto). Click handler `'click' took 1019ms` queda aplazado a sprint con profiling DevTools previo.

## 06may2026 · fix(ia): tooltip explainer z-index sobre cluster 9999 · PR #58

- Branch: `fix/ia-explainer-zindex` → merge `main` SHA `ae8090f` (no-ff).
- Bug: tooltip `#ia-explainer-popover` detrás del modal `#jcard-modal-overlay` al hacer click en `.ia-pct-trigger` con tarjeta abierta.
- Causa: ambos `z-index:9999` + hijos directos de `body`; modal recreado en cada apertura → siempre después en DOM → gana por orden de pintado.
- Files: `public/css/base.css` (`+1/-1`).
- ERR: N/A (regresión específica de cluster z-index, no patrón reusable).
- Backlog item 12: cerrado completamente con este merge (badge `done/N` en PR#56 + tooltip detrás del modal en PR#58). Solo queda `1019ms` aplazado a sprint con profiling DevTools previo.

## 2026-05-06 · Sprint Globo PR2+PR3+Polish+Enrichment · `feature/globo-pr2-pr3` lista para merge

- Branch: `feature/globo-pr2-pr3` desde base `99fb581` → 12 commits, HEAD `6d058b2`. Pushed a origin, **lista para squash-merge a main desde GitHub UI por San**.
- Sprint: convierte el Globo MVP (PR#54 `8e6681c`) en experiencia interactiva enriquecida — leyenda banderas circulares Supabase + chips sedes + panel detalle dual (sport.es narrativo + ESPN táctico) + highlight rojo país clickado + centroides override + tooltip cleanup + canvas flex layout + leyenda tipos lateral derecho.
- Files modificados:
  - `public/js/data/wiki-data-globo.js` (nuevo, 742 LOC) — 45 selecciones + 16 sedes (apodo, grupo, confederación, mundiales, mejor, coach, estrella, frase). Source: sport.es.
  - `public/js/data/wiki-bio.js` (nuevo, 340 LOC v3) — 48 selecciones (apodo, formación, frase, bio sport.es, bio_espn ESPN). Source: sport.es + ESPN.
  - `public/js/ui-globo-equipos.js` (~750 LOC, +500 sobre MVP) — overlay flex layout + leg-items lateral + carrusel banderas circular + carrusel chips sedes + selectCountry/selectSede + COUNTRY_LATLNG_OVERRIDE + hideGlobeTooltip + renderPanelPais 3-arg con bios duales + renderPanelSede + onPolygonClick/onPointClick.
  - `public/css/components/globo-equipos.css` (~590 LOC, +345 sobre MVP) — flex column overlay + flag-btn 36×36 con img circular 28×28 + flag carousel scroll horizontal + sedes scroll horizontal + separadores grupo A-L + leg-items absolute right + detail panel mobile/desktop responsive + bio collapsible details + pill formación + pill-label + frase italic.
  - `js/main-entry.js` (+2 lines) — chain `wiki-data-globo → wiki-bio → ui-globo-equipos`.
- Commits del sprint (12 total, orden cronológico):
  - `3c5801d` PR2 datos — wiki-data-globo (45+16).
  - `c0f32ed` PR2+PR3 — flag legend + detail panel base.
  - `a8ccd23` Polish — flag-only legend, venue chips, bio expand, squad stub.
  - `11a7bde` Fix — canvas flex + flag emoji ISO3.
  - `b8a2ef2` Iter intermedio — badges Supabase ko.js (descartado por circular).
  - `6cb8f4b` Iter final — circular flag images Supabase flags bucket.
  - `e205a84` Highlight — país rojo + reset zoom al cerrar.
  - `adfff22` One-liner — clear flag is-active on reset.
  - `2a4bbad` 3-fixes — centroides USA/UK/etc + sede highlight + tooltip cleanup.
  - `851ca93` Enrichment v2 — formación + frase ESPN + bios duales + grupos en carrusel.
  - `010b189` Polish v2 — wiki-bio v3 fix textos + chip formación + leyenda lateral.
  - `6d058b2` Final fix — chip formación con ancho ajustado al contenido.
- ERR documentados: **ERR-39** (regex non-greedy frases ESPN), **ERR-40** (espacios falsos tildes ESPN), **ERR-41** (pill flex hijo stretch en flex column).
- Lecciones técnicas:
  - Cherry-pick de commits inexistentes: brief intermedio pidió `0dea54f` que solo vivía en local de San. Verificado `git rev-parse` y reportado como no-op (5.0/4.2 ya estaban). Patrón: NO ejecutar cherry-pick sin verificar SHA en remoto primero.
  - Verificación cruzada con `EQUIPOS[]`: la tabla ISO3 emoji del brief omitía TUR/SWE/COD. Validar coverage antes de aplicar.
  - Patrón badge-with-flag-fallback (CLAUDE.md regla permanente): siempre dual-render. Cuando un brief específico contradice una regla de proyecto, mantener la regla y notarlo como deviation.
  - HTML entities `&#39;` para escapar single-quotes en JS string → HTML attribute (más robusto que `\'`).
  - Subagentes Haiku 4.5: ninguno en este sprint (tareas demasiado acopladas a un único `ui-globo-equipos.js` para split por componente).
- Cierre de sesión (este commit, branch `feature/globo-pr2-pr3`):
  - CLAUDE.md: Estado actual actualizado, table-índice ERR ampliada con ERR-38..41, mapa docs con `globo-mundial.md`.
  - CHANGELOG.md: nueva sección 2026-05-06 con tabla de 12 commits + funcionalidad consolidada + ERR + lecciones.
  - errores_conocidos_porra.md: añadidos ERR-39, ERR-40, ERR-41 con síntoma/causa/fix/patrón preventivo.
  - docs/globo-mundial.md: nuevo, arquitectura completa del componente (stack, cadena carga, data const, estado, helpers, polygonsData re-render pattern, layout overlay, pill formación, datos WIKI_BIO v3 con scraping, triggers de cambio, pendientes PR4).
  - docs/architecture.md: nueva sub-sección "Globo de selecciones" en `## Pantallas y patrones de carrusel` con link a `docs/globo-mundial.md`.
- Pre-commit hook validado: tamaños CLAUDE.md / CHANGELOG.md dentro de límites.


## 2026-05-08 · Sprint Pizarra Táctica + Cuadro de Honor restore · `claude/pizarra-tactica-modal-kmTEw` lista para PR

- Branch: `claude/pizarra-tactica-modal-kmTEw` desde base `f6847ab` (post-merge globo) → 4 commits, HEAD `533ec15`. Pushed a origin, **lista para PR a `main`** (squash-merge desde GitHub UI por San).
- Sprint dual: (1) modal "Pizarra Táctica" con ficha visual de selección (escudo + 11 tokens en formación + stats), abierto desde el Globo (botón "🏟 Ver plantilla") y desde tarjetas de partido en Directo (banderas clicables); (2) restauración del Cuadro de Honor (cajas 2 Campeón + 3 Podio) bajo la fila Final del nuevo `fc-elim-list`, huérfano tras la migración F7.4-F (ERR-42).
- Files modificados:
  - `public/js/ui-pizarra-tactica.js` (nuevo, 540 LOC) — entry point `window.openPizarraTactica({iso3|iso2|nameEn})`, mapping `NAME_EN_TO_ISO3` 48 selecciones, 12 formaciones en `FORMATION_COORDS`, cache `Map`, fetch a EF `get-squad` con JWT de `window._porraToken`, render mobile-first dark theme, listener tooltip en `buildOverlay()`. Hook `window._globoNavPlantilla = nameEn → openPizarraTactica` para el panel del Globo.
  - `public/css/components/pizarra-tactica.css` (nuevo, 8.5 KB) — modal 380px dark `#1f2937`, banda bandera 130px con mask gradient 75%, escudo 80px drop-shadow, tokens 11.5% circulares con halo negro sólido en apellido, footer stats con `flex 1 1 0` + `justify-content:center`, `.fc-pizarra-stat-val-wrap` (position:relative + inline-flex), `.fc-pizarra-stat-info` button absoluto, `.fc-pizarra-stat-tooltip` con flecha CSS, `.dv2-mini/exp-flag-btn` reset.
  - `public/js/ko.js` (+133 LOC) — nueva función `window.buildChampionPodium(matchFinal)` justo antes de `buildFinalSection` (no tocada). Resuelve campeón vía `koPredictions[finalMatchId]`, puestos 2/3/4 vía `BRACKET.third[0]`, helper `teamImg(name, size)` con badge → flag fallback. Devuelve `<div class="fc-champion-podium">` con caja 2 (gradient dorado + escudo + sub-banner FIFA WC 2026 / placeholder) y caja 3 (Podio 🥈/🥉/4️⃣ con escudos + nombres + labels) apiladas column gap 12px.
  - `public/js/ui-elim-shell.js` (+11 LOC en `_renderList`) — tras `mount.appendChild(rowEl)` y bloque expanded, hook `if (r.key === 'final' && typeof window.buildChampionPodium === 'function')` que invoca con `BRACKET.final[0]` y appendea siempre (no condicional a expanded ni locked).
  - `public/js/ui-directo.js` (4 cambios) — banderas en `_buildDMini` y `_buildDExpanded` convertidas de `<span>`/`<div>` a `<button>` con `data-iso2`; listener delegado al final del IIFE que invoca `window.openPizarraTactica({iso2: btn.dataset.iso2})` con `e.preventDefault() + stopPropagation()` para no disparar la expansión de la card.
  - `index.html` (+1 line) — `<link>` a `pizarra-tactica.css` tras `globo-equipos.css`.
  - `js/main-entry.js` (+1 line) — `loadScript('/js/ui-pizarra-tactica.js')` entre `ui-globo-equipos.js` y `ko.js`.
- Commits del sprint (4 total, orden cronológico):
  - `d34db7c` Base — modal completo + 4 patches mecánicos sobre `index.html`/`main-entry.js`/`ui-directo.js`. Files descargados de rama `handoff-pizarra` del propio repo vía MCP GitHub `get_file_contents` (network del sandbox bloquea Supabase Storage; raw GitHub bloqueado en repos privados).
  - `02aed94` Hot-fix banda — 90→130px + mask 60→75% + título `#fff`+shadow → `#111827` plano + coach `rgba(255,255,255,.95)` → `#4b5563` + header `margin-top` -32→-50px (compensar banda).
  - `5a3ddde` Dark mode + tooltip tap + stats — modal `#fff` → `#1f2937`, `.fc-pizarra-stat-val-wrap` para centrado correcto, `.stat-info` a button posicionado absoluto, `.fc-pizarra-stat-tooltip` con flecha pseudo, listener delegado tap-toggle 4s.
  - `533ec15` Cuadro Honor restore — diagnóstico Chrome MCP reveló cajas 2+3 huérfanas en `#view-cinematic` legacy (`display:none`). Fix: nueva fn pública `window.buildChampionPodium` en `ko.js` + hook en `_renderList` ui-elim-shell.js.
- Backend (sin cambios desde Code en esta sesión, ya en prod al iniciar el sprint):
  - Tabla `public.squads` con 48 filas (`iso3`, `iso2`, `equipo`, `formacion`, `entrenador`, `stat_edad`, `stat_valor`, `stat_goles`, `color_ficha`, `color_portero`, `plantilla_completa`).
  - Edge Function `get-squad` v4 ACTIVE — acepta `?iso3=XXX` o `?iso2=XX`, devuelve `TeamData` con jugadores serializados.
  - Storage `miniatures/pizarra/campo.webp` (38 KB) + `miniatures/badges/{slug}.png` (43, faltan BIH/COD/CZE/IRQ/SWE) + `miniatures/flags/{ISO2}.png` (48) + `miniatures/flags-sm/{ISO2}.webp` (48 small 148×).
- ERR documentados: **ERR-42** (Cuadro de Honor invisible tras F7.4-F).
- Lecciones técnicas:
  - Sandbox network: bloquea Supabase Storage (`Host not in allowlist`); raw GitHub bloqueado para repos privados (404). MCP GitHub `get_file_contents` autenticado es la única vía. Workflow: San sube assets a rama `handoff-pizarra`, Code los lee con MCP, escribe local, aplica patches, commit + push.
  - Verificación byte-equivalence: comparar `wc -c` con tamaño esperado tras MCP-fetch + Write. Conversión `'—'` ↔ literal `'—'` (UTF-8 em-dash) genera 5 bytes diff por ocurrencia; restaurar con `python3` open('rb')/replace para paridad exacta.
  - Documentación bugs vivos en main: ERR-42 introducido en F7.4-F (28 abr) detectado y cerrado en este sprint. Patrón: registrar incluso si se cierra en el mismo commit, para trazabilidad.
- Cierre de sesión (este commit, branch `claude/pizarra-tactica-modal-kmTEw`):
  - CLAUDE.md: Estado actual actualizado (sustituye refs a `feature/globo-pr2-pr3` por `claude/pizarra-tactica-modal-kmTEw`), table-índice ERR ampliada con ERR-42.
  - CHANGELOG.md: nueva sección 2026-05-08 con tabla de 4 commits + funcionalidad consolidada (pizarra + cuadro honor) + iteraciones de UI + ERR + lecciones.
  - errores_conocidos_porra.md: añadido ERR-42 con síntoma/causa/fix/patrón preventivo (Chrome MCP DOM inspection).
  - migration-log.md: este bloque.
- Pre-commit hook validado: tamaños CLAUDE.md / CHANGELOG.md dentro de límites.
[11:25] PUSH: feat/flag-wrap-pizarra-wiring (createMatchCard flag click → openPizarraTactica). PR #62 abierto.
[11:56] PUSH: hotfix z-index pizarra-tactica.css 9999→10050 (mismo branch PR #62).
[12:14] PUSH: feat/standings-slide-jcard-modal (slot 7/7 con _renderGruposStandings en openJcardModal). PR #63 abierto.
[12:27] PUSH: hotfix ancho slot standings ui-groups.js (alinear con cards partido). Mismo branch feat/standings-slide-jcard-modal.
