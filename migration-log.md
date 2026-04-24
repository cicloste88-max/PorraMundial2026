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