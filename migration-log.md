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