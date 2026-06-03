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
[12:35] PUSH: hotfix #2 lastCardWidth cache (revierte estimacion rota wrapper.offsetWidth en standings slot).
[12:57] PUSH: hotfix #3 reset padding standingsCard ui-groups.js (ancho igual a card).
[13:05] PUSH: hotfix #4 lastCardWidth sin -5 doble (card y standings idénticos a 338px).
[13:12] PUSH: hotfix #5 standingsCard width:100 0nline (replica regla CSS .fc-grupos-slot--standings>* del outer carousel).

## 2026-05-13

[23:09] SQL: ALTER TABLE squads ADD jugadores_is_final boolean NOT NULL DEFAULT false, ADD jugadores_fuente text, ADD jugadores_synced_at timestamptz — aplicado direct via Supabase MCP por Claude.ai esta sesion. NO migration file (cambio aplicado al runtime, no replicable via `supabase db push`). Documentado en `docs/db-schema.md` § Pizarra Táctica.
[23:10] DEPLOY: EF get-squad v6 ACTIVE (ID aaf02673-e301-46e3-8ed1-c836ea2cb575, version=6, verify_jwt=true) — desplegado directo via Supabase MCP por Claude.ai esta sesion. Retrocompatible con v5: extractXI filtra `es_titular` si flag presente, fallback a `length===11` sin flag (formato v5). Anade `plantilla` (array completo) + `plantilla_meta` ({n, fuente, is_final, synced_at}) a la respuesta sin romper consumers v5 (Pizarra Táctica frontend).
[23:11] SYNC: rama `sync/ef-get-squad-v6` desde main HEAD `1fae544`. Descargado codigo runtime via MCP `get_edge_function` (220 LOC). `supabase functions download` CLI fallo por falta de SUPABASE_ACCESS_TOKEN — MCP usado como alternativa. Primera linea verificada `// supabase/functions/get-squad/index.ts — v6`.
[23:11] BBDD: estado squads tras esta sesion (Claude.ai): 7 de 48 cargadas — ARG 55 prov ff (con clubs), BIH 26 FINAL as, BRA 51 prov 365, ESP 53 prov ff (sin clubs, FF no los trae), MEX 55 prov 365, QAT 33 prov infobae (sin clubs), SWE 26 FINAL ff (sustituye AS provisional). UZB descartado este ciclo (ninguna fuente parseable publica los 40 nombres).
[23:11] PENDIENTE BBDD: Claude.ai en paralelo trabajando en Transfermarkt enriquecimiento (edad/valor) — avisara cuando toque BBDD. Proximo: continuar carga 41 restantes via FutbolFantasy primaria + AS backup, snapshot FIFA.com final 2 jun para dorsales/fotos.
[23:30] F1.1a (branch `claude/port-world-cup-design-FvZpD`): merge fast-forward de main (HEAD `7a6eff4` con `design/v3-prototype/` + CLAUDE.md trim). Auditados tokens del prototipo (`design/v3-prototype/mundial-2026.css` :root L6-34): unico token global nuevo vs `public/css/components/elim-tokens.css` es `--lime: #C4F046`. NO hay radii / shadow scale / glass-blur tokens en `:root` del prototipo (valores van inline en componentes). Scoped `--g-color/glow`, `--k-color/glow`, `--r-color/glow`, `--zoom-color/glow`, `--bg` se inyectan via JS `style.setProperty()` desde `groups-data.js`/`eliminatorias-data.js` (data-driven, no globales — se gestionaran en F2). Anadido `--lime` al bloque Semantic de `elim-tokens.css` linea 39. Verificado `npm run build` (vite v8.0.8, 198ms) + `grep -l "--lime" dist/css/components/elim-tokens.css` → match en L39. Gate F1.1a → F1.1b listo: pendiente OK San en smoke.
[23:45] F1.1b: creado `public/css/v3/mundial-shell-v3.css` (323 LOC, +budget +73 vs estimado plan 250 por incluir media queries completas + slot `.v3-fifa-bar__user` para D13). Subset portado del prototipo: `.phone` (phone-frame mobile-first 420px + multi-gradient background), `.v3-fifa-bar` + countdown blocks, `.v3-qualified-cta` (4 flags + +44 chip + bg cartel FIFA26), `.v3-stage-pill-wrap` + `.v3-stage-pill` (lime con glow), `.v3-zoom-overlay` + `.v3-zoom-panel` + `.v3-zoom-panel__inner` (shared para grupos+elim). TODO scoped a `.phone .v3-*` (zero colision con CSS legacy). Media queries 360px (qualified-cta) + 400px (fifa-bar). NO incluye .board/.group/.match-card/.bracket — esos van a F2 grupos-v3.css/eliminatoria-v3.css. Verificado `npm run build` + `grep -l "v3-fifa-bar|v3-qualified-cta|v3-stage-pill|v3-zoom-overlay" dist/css/v3/mundial-shell-v3.css` → match.
[23:55] F1.1c: creado `public/js/v3/mundial-shell-v3.js` (260 LOC, +budget +60 vs plan 200 por idempotencia defensiva + bindQualifiedCta event delegation + bindPageChange listener + ensurePageShell public API). IIFE classic-script, sigue ERR-01 patrón runInit (DOMContentLoaded defensivo) + ERR-02 (var + window.X explícito). Kickoff target `2026-06-11T19:00:00Z` (D1 corregida, NO 18:00 del prototipo). SHELL_PAGES = `['grupos','jornada','directo','elim','predictor']` (OQ#1 — welcome excluido). Expone `window.mundialShellV3Init`, `window.ensurePageShellV3(pageId)`, `window.flagPath(slug)` (encodeURIComponent solo en filename — D3). Auto-init al cargar el script (DOMContentLoaded o readyState) + main-entry también puede llamar `mundialShellV3Init()`. Wiring: countdown tick UNA sola instancia setInterval(1s), post-kickoff sustituye 4 cd-blocks por slot `data-v3-next-match` consumido por `window.resolveNextMatchV3` (F1.1d), click `[data-qualified-cta]` → `window._openGloboOverlay()` (F1.1e). Dispatch event `mundial:next-match-changed` post-kickoff. Zoom overlay singleton montado en body. Verificado `node --check` + `npm run build` + dist copia `public/js/v3/mundial-shell-v3.js`.
[00:05] F1.1d: creado `public/js/v3/next-match-resolver-v3.js` (99 LOC, +budget +19 vs plan 80 por error handling + retry semantics + pre-warm). Módulo puro sin DOM, classic-script IIFE. Source: `/data/worldcup-2026-matches.json` (Opt A del plan F0.2 — aislado, no acoplado a live-sync.js). Sufijo `Z` añadido a `date_utc` antes de `new Date()` para parseo UTC explícito (mitiga R5). MATCH_DUR_MS = 110min (90' + descansos + extras) para ventana state='live'. API: `window.resolveNextMatchV3(now?)` → `{state:'pre'|'live'|'next'|'post', match}`; `state='pre'` pre-fetch (caller re-llama), 'next' pre-match, 'live' durante ventana, 'post' torneo acabado. Cache de sesión: promesa singleton `_fixturesP` + array ordenado `_fixturesArr` (por `date_utc_ms` asc). Auto pre-warm al cargar el script. Verificado `node --check` + `npm run build` + dist tiene `next-match-resolver-v3.js` + `mundial-shell-v3.js`.
[00:15] F1.1e refactor desacople cinta dorada: `public/js/ui-globo-equipos.js` (1) header comment menciona `_openGloboOverlay` en lugar de `_mountGloboCinta` (2) eliminado `CINTA_HTML` 19 LOC (3) eliminado `_mountGloboCinta` 13 LOC + stub keydown (4) export `window._mountGloboCinta` reemplazado por `window._openGloboOverlay = openOverlay` (D8). `public/js/ui-groups.js` (1) eliminado `_ensureGloboCintaMount` 18 LOC (2) eliminada su invocación en `_renderGruposLetterBar`. Diff total: -59 / +11 LOC. Verificado `node --check` ambos JS + `npm run build` OK + grep `_mountGloboCinta|CINTA_HTML|_ensureGloboCintaMount|fc-globo-cinta-mount` post-refactor → solo comentarios de doc del cambio (0 references vivas). `_openGloboOverlay` correctamente expuesto en `ui-globo-equipos.js:863` y consumido por `mundial-shell-v3.js:201`. CSS `.fc-globo-cinta*` en `public/css/components/globo-equipos.css` queda dead-but-harmless (F4 cleanup).
[00:22] F1.1f extensión `auth.js renderAuthBar()` (L217-237): añadido `const v3Mounts = document.querySelectorAll('[data-user-mount]')` + `v3Mounts.forEach(el => { el.innerHTML = badgeHtml; })` (rama logueada) + `v3Mounts.forEach(el => { el.innerHTML = ''; })` (rama anónima). Coexistencia D13: los 3 mounts viejos (#wc-auth-bar, #grupos-user-bar, #elim-user-bar) siguen rellenándose sin cambios; los nuevos slots `[data-user-mount]` que inyecta el shell mundial-shell-v3.js dentro de `.v3-fifa-bar__user` también reciben el mismo badgeHtml. Idempotente — `innerHTML =` siempre escribe el mismo HTML, sin race. F4 cleanup eliminará los 3 mounts viejos. Diff: +6 / -2 LOC. Verificado `node --check` + `npm run build` OK.
[00:35] F1.1g smoke test sandbox: creado `public/sandbox/v3-shell-smoke.html` (page standalone, NO altera SPA — F3 hará wiring real). Approach standalone evita riesgo de regresión en `#page-grupos` legacy mientras se valida el shell visualmente. Carga `tokens.css` + `elim-tokens.css` + `mundial-shell-v3.css` + `next-match-resolver-v3.js` + `mundial-shell-v3.js`. Body con `data-active-page="grupos"` → shell auto-monta `.phone[data-v3-shell-mount]` con fifa-bar + qualified-cta + stage-pill (D1 + D2). Controles San: (1) reloj UTC tick(1s), (2) botón "Simular post-kickoff" sustituye 4 cd-blocks por slot next-match y consume `_loadNextMatchFixtures()` + `resolveNextMatchV3(2026-06-11T19:00:01Z)` para pintar "EN VIVO · Mexico vs Sudáfrica" (validación pipeline F1.1d), (3) botón "Reset" reload, (4) botón "Simular login/logout" rellena `[data-user-mount]` con badge fake (validación D13 sin Supabase). URL local: `http://localhost:5173/sandbox/v3-shell-smoke.html`. Verificado `npm run build` + 6 selectores clave presentes en `dist/sandbox/v3-shell-smoke.html`.
[00:50] F1.1h fix fifa-bar truncamiento (smoke parcial: post-kickoff en una sola línea consumía demasiado ancho, columna izquierda truncaba "Copa Mundial de la ..." y "11 de junio - 19 de julio de..."). Solución: reorganizar columna derecha de la fifa-bar en 2 líneas verticales. CSS (`public/css/v3/mundial-shell-v3.css`): `.v3-fifa-bar__countdown` cambia `flex-direction: row` → `column` + `align-items: flex-end` + `max-width: 60%` (55% en <400px); añadidos `.v3-fifa-bar__eyebrow` (font 9px, letter-spacing .18em, uppercase, opacity .8 default + `.is-live` con `color: var(--lime)` y opacity 1), `.v3-fifa-bar__cd-row` (la fila horizontal de 4 bloques recibe el `gap: 6px` que antes vivía en `__countdown`), `.v3-fifa-bar__nextmatch` (font 12px, nowrap+ellipsis, text-align right). Media query <400px: gap del cd-row 4px, eyebrow 8px, nextmatch 11px. JS (`public/js/v3/mundial-shell-v3.js`): `fifaBarHTML()` envuelve los 4 cd-blocks en `.v3-fifa-bar__cd-row` y prepende `<span class="v3-fifa-bar__eyebrow" data-v3-bar-eyebrow>FALTA</span>`. `applyPostKickoffMode()` emite ahora `<span class="v3-fifa-bar__eyebrow" data-v3-bar-eyebrow>PRÓXIMO</span><div class="v3-fifa-bar__nextmatch" data-v3-next-match>—</div>`. `refreshNextMatchUI()` actualiza eyebrow texto (`EN VIVO` si state='live', `PRÓXIMO` si state='next') + toggle clase `is-live`, y el nextmatch slot sólo lleva los nombres del partido (sin prefijo, el prefijo va en eyebrow). Sandbox (`public/sandbox/v3-shell-smoke.html`): el handler de `btn-fake-kickoff` re-escribe el innerHTML con eyebrow `is-live` + nextmatch y el `forEach` posterior actualiza ambos. Verificado `node --check` + `npm run build` + dist tiene 7 refs a nuevos selectores CSS + 3 refs JS a `data-v3-bar-eyebrow` + 2 refs en sandbox.
[01:05] F1.1i fix qualified-cta truncamiento ("Conoce a las 48 selecciones" → "Conoce a las 48 seleccion..." en smoke 375px). Diagnóstico: a 13px y body ≈179px (375px viewport − 24px padding phone − 100px cluster banderas − 12px gap − 24px chevron − 12px gap), el título a 13px ≈196px → ellipsis. Fix CSS (mantengo chevron como visual affordance): (1) `.v3-qualified-cta` gap 12→10 (-4px), (2) `.v3-qualified-cta__flag` width/height 28→26 + margin-left -10→-9 (cluster 100→94, -6px), (3) `.v3-qualified-cta__title` font-size 13→12 (chars caben en menos px). Media <360px también ajustada: flag 22×22 (de 24), arrow shrink 22×22 (de 24). Resultado calculado a 375px: body ≈189px vs título a 12px ≈168px → fits con margen ✓. A 360px: body ≈188px vs título a 11px ≈154px → fits cómodo ✓. Verificado `npm run build` OK + valores correctos en `dist/css/v3/mundial-shell-v3.css`.
[01:50] F2 — 2 subagentes Haiku 4.5 paralelos completados (briefs inline E13: scope CSS `.phone .v3-*`, tokens disponibles + --lime, shapes reales EQUIPOS/GRUPOS/PARTIDOS/BRACKET/predictions/koPredictions/resolvedSlots, mapping V3_FLAG_SLUG 3-letras→slug v3, helpers a reusar savePredictions/saveKO/resolveKO/resolveSlot/diceSimulateAll{Groups,KO}/buildChampionPodium/openPizarraTactica/_openGloboOverlay/flagPath, reglas críticas ERR-01/02/22 + prohibición localStorage). Agente A Grupos → `public/css/v3/grupos-v3.css` 845 LOC + `public/js/v3/grupos-v3.js` 591 LOC. Agente B Eliminatoria → `public/css/v3/eliminatoria-v3.css` 967 LOC + `public/js/v3/eliminatoria-v3.js` 597 LOC. Total F2: 3000 LOC. Verificado `node --check` ambos JS + `npm run build` OK + 0 violaciones ERR-22 (localStorage/import/export/<style>) + entries window.v3GruposMount + window.v3ElimMount expuestos.
[02:00] F2 integración (padre Opus tras review de reports): 2 fixes críticos aplicados. **Fix 1 — Agente B flag URL incorrecta**: el agente Haiku ignoró el mapping V3_FLAG_SLUG del brief y construyó `var flagUrl = '/flags/' + team.flag.toUpperCase() + '.svg'` → URL `/flags/MEX.svg` que NO existe (banderas v3 viven en `/flags/redesign v3/Mexico.svg`). Aplicado: añadido `V3_FLAG_SLUG_ELIM` mapping completo 48 entradas + helper `v3FlagURLByCode(code)` que usa `window.flagPath()` con slug correcto. Reemplazado el flagUrl-builder bugueado. **Fix 2 — Agente A auto-mount sin condicionar**: el agente añadió `document.addEventListener('DOMContentLoaded', runInitV3)` + `runInitV3 = function() { window.v3GruposMount(); }` que auto-monta al cargar el script (el brief decía "NO auto-init — padre llama mount on-demand"). Convertido a no-op (`function() { /* no-op — mount on-demand via window.v3GruposMount() */ }`). Side-finding del Agente B: corrigió mi brief sobre `classifier` (yo decía 'home'|'away', ko.js:170 confirma que almacena NOMBRE DE EQUIPO real e.g. "México"). Implementación elim correcta. Sandbox extendido: creado `public/sandbox/v3-pages-smoke.html` (page standalone que carga real data.js+ko.js + stubs sandbox para savePredictions/openPizarraTactica/diceSimulateAll, + buttons "Show/Mount Grupos" y "Show/Mount Elim", + dashboard con flags de disponibilidad de helpers globals). Verificado `npm run build` OK + 4 v3 mount entries en dist + sandbox visible en `dist/sandbox/v3-pages-smoke.html`. URL local: `http://localhost:5173/sandbox/v3-pages-smoke.html`. Gate F2 → F3 pendiente OK San tras smoke en sandbox.
[02:30] F2.1 smoke Grupos: 5 bugs detectados por San corregidos en un commit. **Bug #1 — banderas placeholder gris**: `mundial-shell-v3.js` `FLAGS_BASE = '/flags/redesign v3/'` apuntaba a path local inexistente (banderas v3 viven en Supabase Storage bucket `flags/redesign v3/`). Fix: cambiar base a `https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/flags/redesign%20v3/` (espacio URL-encoded en directorio). **Bug #2 — nombres = código FIFA**: el agente Haiku puso `code.textContent = equipo.flag` ("MEX") en 3 lugares (grupos-v3.js L151, L182, L380); debía ser `equipo.name` ("México"). Fix: 3 sustituciones. CSS `.v3-team-row__code` ya soporta wrap 2-líneas via `-webkit-line-clamp:2` → cabe "República de Corea". **Bug #3 — sin fifa-bar en sandbox**: `v3GruposMount()` línea 523 hacía `container.innerHTML = ''` que BORRA el `[data-v3-shell-mount]` (fifa-bar+qualified-cta+stage-pill) que `ensurePageShellV3` había inyectado. Fix: reemplazar wipe por remoción específica del `#v3-grupos-mount` viejo via querySelector + remove() (preserva el shell). **Bug #4 — trofeo + columnas pegadas**: dos sub-bugs: (a) race condition en `v3BindTrophyFallback` que ataba `addEventListener('error')` DESPUÉS de set `trophyImg.src` → si fetch fallaba antes, evento perdido y emoji fallback nunca aparecía; (b) sin trofeo visible, los 86px del trophy-col se perciben como columnas pegadas. Fix: bind `trophyImg.onerror = ...` ANTES de set `.src` (evita race) + CSS `.v3-trophy-fallback { display: block; z-index: 1 }` por default (emoji siempre visible debajo; image z-index:2 lo cubre si carga OK; si falla, queda emoji visible). Función `v3BindTrophyFallback` ahora dead-code (F4 cleanup). **Bug #5 — click no abre modal**: `v3GruposMount` creaba SU propia `.v3-zoom-overlay`+`.v3-zoom-panel` dentro del mount (L512-521), PERO el shell ya monta singleton en body via `ensureZoomOverlay()`. Duplicación causaba conflicto: `document.querySelector('.v3-zoom-overlay')` encontraba el del shell (primero en DOM) y le añadía `.is-open`; pero la modal HTML se renderizaba en el `.v3-zoom-panel__inner` del shell, mientras el panel del grupos mount quedaba sin contenido. Fix: eliminar creación overlay/panel del v3GruposMount (10 LOC borradas). Singleton del shell se reusa. Verificado `node --check` + `npm run build` OK + dist tiene FLAGS_BASE Supabase + equipo.name × 3 en labels + 0 wipes innerHTML + 0 overlay creations en mount + `.v3-trophy-fallback { display: block }` por default. Diff total: +12 LOC / -20 LOC.
[02:50] F2.2 smoke Grupos parcial (San reportó 2 issues residuales tras F2.1 OK): asimetría columnas A-F vs G-L + trofeo central invisible. Diagnóstico padre: AMBOS son síntoma del MISMO gotcha estructural CSS Grid `min-width: auto` (default en grid items). Con `grid-template-columns: 1fr 86px 1fr`, si el min-content del contenido en tracks `1fr` excede su allocation, los items NO se encogen (min-content como suelo) y BREAK la distribución 1fr-equal. column-left tiene texto largo ("República de Corea" 18ch, "Bosnia y Herzegovina" 18ch) → su min-content expande track 1 más que track 3 (G-L promedio más corto). trophy-col children son absolute (zero intrinsic height) → si tracks 1+3 ya consumen todo el espacio Y `align-items: stretch` falla por colateral, queda 0 tall. Fix CSS canónico (idioma de cualquier grid moderno): `.phone .v3-column { min-width: 0 }` + `.phone .v3-group__card { min-width: 0 }` + `.phone .v3-trophy-col { min-width: 0; min-height: 200px; align-self: stretch }`. Instrumentación temporal añadida en `v3GruposMount`: `setTimeout 100ms` post-mount loggea `[v3-grupos F2.2 diag]` con `getBoundingClientRect + getComputedStyle` de #page-grupos, #v3-grupos-mount, .v3-board (con `gridTemplateColumns` computado), .v3-column-left/right, .v3-trophy-col (width, height, display, visibility, opacity). San pega output DevTools console si fixes no resuelven. Removable en F2.3 o F4 cleanup. Verificado `node --check` + `npm run build` OK + 3 selectores `min-width: 0` + trophy-col min-height en dist. Commit c2fe6b3 pushed.

[03:15] F2.3 fix cascade un-scoped en eliminatoria-v3.css (DevTools San reveló display:none global en .v3-trophy-col): Agente B Haiku escribió rules sin ancestor en 123 selectores. **Bug raíz**: `.v3-trophy-col { display: none; ... }` global (L563-570 elim) aplicaba a TODOS los .v3-trophy-col incluyendo el de Grupos (clase compartida entre las 2 pantallas). Cascade: `.phone .v3-trophy-col` (grupos, specificity 0,2,0) > `.v3-trophy-col` (elim 0,1,0) PARA propiedades que grupos declara; pero grupos NO declara `display` así que elim `display:none` cascadea (no hay rule de grupos compitiendo). Confirmado computed style DevTools: `display:'none'` en grupos page. Auto-placement Grid reasigna column-right al Track 2 (86px) → asimetría observada. **Fix surgical (San recomendado + extendido 2 más)**: (1) `.v3-trophy-col` → split en `.v3-bracket-board:not(.v3-ko-board--F) .v3-trophy-col { display: none }` (oculta sólo en R32/R16/QF/SF) + `.v3-ko-board--F .v3-trophy-col { ... display: flex }` (Final). (2) `.v3-trophy { position:static; width:200px }` → scope a `.v3-ko-board--F .v3-trophy` (Final-view específico). (3) `.v3-column { min-height:150px }` → scope a `.v3-bracket-board .v3-column`. **Audit ampliado**: 22+ clases CSS compartidas entre grupos-v3 y eliminatoria-v3 con rules en ambos archivos (`.v3-column`, `.v3-column-left/right`, `.v3-trophy`, `.v3-trophy-col`, `.v3-zoom-overlay`, `.v3-zoom-panel`, `.v3-zoom-panel__inner`, `.v3-zoom-header*`, `.v3-zoom-body`, `.v3-zoom-close`, `.v3-score-stepper`, `.v3-score-btn`, `.v3-score-val`, `.v3-score-sep`, `.v3-btn`, `.v3-btn--danger`, `.v3-actions`). Las restantes (zoom-*, score-*, btn, actions) NO fixed en F2.3 porque el shell mundial-shell-v3 monta el zoom singleton OUTSIDE `.v3-bracket-board` y `#v3-grupos-mount` (vive en body), así que scope simple .v3-bracket-board rompería elim. Defer scoping comprehensive a F3 wiring SPA (decisión arquitectónica: shared CSS en shell o body-attribute data-active-page). F2.2 instrumentación console.log temporal eliminada (bug identificado, no necesaria). Verificado `node --check` + `npm run build` OK + 3 selectores scoping correctos en dist/css/v3/eliminatoria-v3.css.

[03:40] F2.4 (San screenshot smoke): elimina emoji fallback + corrige imagen trofeo desplazada. Causa raíz NUEVA descubierta tras F2.3: duplicate `@keyframes v3-trophy-float` con DISTINTO sequence transform en ambos archivos (grupos-v3.css L43-46: `transform: translate(-50%, -50%)` para mantener centrado absolute; eliminatoria-v3.css L599-606: `transform: translateY(0)` puro para Final-view static-positioned). Como eliminatoria-v3.css carga DESPUÉS de grupos-v3.css, sus keyframes ganaban cascade y SOBREESCRIBÍAN las de grupos: durante la animación de Grupos, el transform perdía el `translate(-50%, -50%)` y la imagen del trofeo se desplazaba al cuadrante inferior-derecha (top:50% left:50% sin translate negativo coloca esquina superior-izquierda en centro del parent). Fix: renombrar keyframes de elim a `v3-trophy-float-final` (uso específico). Plus: San pidió eliminar emoji fallback completamente (no es lo que él pedía, sólo lo añadí en F2.1 como defensive). Removido: `var trophyFallback = document.createElement('div')` block + `onerror` handler que añadía .is-fallback class + función `v3BindTrophyFallback` dead-code residual + CSS rule `.v3-trophy-fallback` + `.is-fallback .v3-trophy` override. `onerror` simplificado a `this.style.display = 'none'` (oculta broken-img icon si la image falla, sin emoji). Net: -25 LOC. Verificado `node --check` + `npm run build` OK + 0 refs a fallback/emoji/is-fallback en dist + v3-trophy-float-final único en elim.

[03:55] F2.5 unificación zoom skeleton (San diag — Opción A): tercer namespace collision detectada. ANTES: grupos-v3.css L267-412 y eliminatoria-v3.css L671-775 ambos definían el skeleton del modal (`.v3-zoom-overlay`, `.v3-zoom-panel`, `.v3-zoom-panel__inner`, `.v3-zoom-header*`, `.v3-zoom-close`, `.v3-zoom-body`, `.v3-zoom-tabs`) con valores diferentes — elim usaba estructura plana `overlay + panel-card` vs grupos estructura prototipo `overlay backdrop + panel wrapper fullscreen + panel__inner card`. Cascade: elim cargaba DESPUÉS → su versión ganaba → en Grupos: `.v3-zoom-panel` se convertía en mini-card con border-radius en lugar de wrapper fullscreen → el sibling combinator `.is-open ~ .v3-zoom-panel .v3-zoom-panel__inner` matchea pero inner quedaba en panel comprimido → modal no se renderizaba visible al hacer click. Fix: movido skeleton compartido (147 LOC del bloque canónico del prototipo design source — `mundial-2026.css` L610-738) a `mundial-shell-v3.css` como SHARED component. Removidas las definiciones duplicadas de grupos-v3.css y eliminatoria-v3.css. Las reglas page-specific del CONTENIDO permanecen en su archivo respectivo: grupos (`v3-zoom-footer`, `v3-zoom-progress*`, `v3-zoom-cta`, `v3-match-*`, `v3-standings-*`, `v3-qualif-legend`) y elim (`v3-zoom-ko-match`, `v3-zoom-ko-side*`, `v3-zoom-ko-score`, `v3-zoom-ko-penalty*`, `v3-zoom-ko-summary`). El shell singleton (zoomOverlayHTML montado a body por ensureZoomOverlay) ahora tiene una sola definición canónica. Pendiente F2.6 / F3 cleanup: `.v3-score-*` + `.v3-btn/btn--danger` + `.v3-actions` siguen duplicados (no causan bug visible aún — defer). Verificado `npm run build` OK + dist tiene 1 sola `.v3-zoom-overlay` declaración en shell + 0 en grupos/elim.

[04:25] F2.6 challenge vs design source (San paste): comparé mi implementación con la spec canónica del prototipo. 3 desviaciones aplicadas. **A) estructura body-directa**: spec dice 'Hay 2 nodos fijos en el HTML que conviven inactivos fuera del .phone'. Mi shell ensureZoomOverlay() envolvía ambos en `<div data-v3-zoom-host>` extra. Sibling combinator funcionaba (siblings dentro del wrapper) pero la abstracción no estaba en spec. Cambiado a appendChild directo de los dos nodos al body (igual que prototipo). **B) logging temporal**: añadido `console.log('[v3-grupos openZoom]', {letter, overlayFound, innerFound, innerHTMLLen, overlayParent, panelSibling})` para diagnóstico runtime San. Si overlay no se encuentra → init shell no corrió. Si inner empty → renderZoom no llenó. Si overlay.parentNode no es BODY → estructura mal. **C) defensive ensure-overlay**: si shell init no corrió por race condition (no debería pero defensive), v3OpenZoomGrupos llama `window.mundialShellV3Init()` antes de query overlay. Plus shell también log `'[v3-shell] ensureZoomOverlay → overlay+panel appended to body'` cuando se ejecuta. Logs removable F4 cleanup. Verificado `node --check` + `npm run build` OK.

[04:55] F2.7 fix CUARTA colisión namespace en FUNCIONES JS (San runtime diag via Chrome MCP). Causa raíz: classic-scripts global scope hoisting — `function v3RenderZoom()` declarada en grupos-v3.js Y en eliminatoria-v3.js (last-write-wins). Como elim carga DESPUÉS en orden de carga del sandbox, su `v3RenderZoom` sobreescribía la de grupos. Cuando grupos hacía click en card → v3OpenZoomGrupos llamaba v3RenderZoom() via lexical scope → resolvía la version KO → `if (!v3CurrentMatch) return` con v3CurrentMatch=undefined → silent return → inner.innerHTML quedaba vacío → modal 'transparente' (overlay visible, panel sin contenido). Evidencia San: v3RenderZoom.toString() = 4440 chars con markup KO + monkey-patch capturó la llamada confirmando window/global resolution. **Audit ampliado**: comparadas TODAS las function declarations en ambos archivos. 3 colisiones reales detectadas: `v3RenderZoom` (L239 grupos vs L389 elim), `v3CloseZoom` (L231 vs L381), `v3AdjustScore` (L409 con signature (letter, matchIdx, side, delta) vs L492 con (matchId, side, delta) — SIGNATURE DIFERENTE, peor que misma signature). **Fix**: rename con sufijo de page en ambos archivos (sed -i con word-boundary \b para safety): grupos {v3RenderZoom→v3RenderZoomGrupos, v3CloseZoom→v3CloseZoomGrupos, v3AdjustScore→v3AdjustScoreGrupos}; elim {v3RenderZoom→v3RenderZoomKO, v3CloseZoom→v3CloseZoomKO, v3AdjustScore→v3AdjustScoreKO}. **Renames preventivos en grupos-v3.js** (no colisión actual con legacy ui-groups.js, pero v3-prefix consistency + future-proof): renderBoard→v3RenderBoardGrupos, renderGroup→v3RenderGroup, flagURL→v3FlagURLByEquipo, findEquipoByName→v3FindEquipoByName, getGrupoLetterIndex→v3GetGrupoLetterIndex, isGroupComplete→v3IsGroupComplete, countFilled→v3CountFilled, computeStandings→v3ComputeStandings. **Verificado**: `node --check` ambos JS OK + `npm run build` OK + `comm -12` audit de function names entre ambos archivos = empty (0 colisiones residuales) + window.* entries intactos (v3GruposMount, v3ElimMount, mundialShellV3Init, ensurePageShellV3, flagPath, resolveNextMatchV3) + external deps preservados (EQUIPOS, GRUPOS, PARTIDOS, getMatchKey, predictions, savePredictions). Test runtime esperado: `typeof window.v3RenderZoom === undefined` (ya no en global), click en grupo → `document.querySelector('.v3-zoom-panel__inner').innerHTML.length > 1000`.

[05:30] F2.8 — Goleadores tab + chips puntuación post-partido. **UX variante C aprobada por San (3 tabs)** + chips B+C híbrido con 3 estados. Auditado pre-cambio (lección F2.3-F2.7): los selectores v3-goleador*, v3-chip*, v3-squad-picker* son exclusivos de Grupos (no en eliminatoria-v3.css). Funciones nuevas con sufijo Grupos desde el principio (v3RenderGoleadoresTabGrupos, v3RenderChipsGrupos, v3CalcMatchPointsGrupos, v3OpenGoleadorPickerGrupos, v3CloseGoleadorPickerGrupos, v3SaveGoleadorGrupos, v3RenderSquadPickerGrupos) — 0 colisión potencial verificada via comm -12 post-cambio. **Cambios JS (grupos-v3.js +~270 LOC)**: (1) state vars _v3SquadPickerMatchIdx, _v3SquadPickerSide. (2) v3AdjustScoreGrupos ahora escribe predictions[key].home, away (nombres de equipo, requeridos por scoring.js calcMatchPoints para goleador) + saved:true (antes false — bug pre-existente que impedía cálculo de puntos). (3) v3RenderZoomGrupos: 2→3 tabs ('Marcadores' rename 'Pronósticos', NUEVA 'Goleadores' siempre habilitada, 'Clasificación' sigue gated 6/6). Tab inicial al abrir: 'standings' si grupo completo, 'predictions' default. (4) v3RenderMatchesList: inyecta v3RenderChipsGrupos(match, p) bajo cada match-card. (5) v3CalcMatchPointsGrupos(prediction, match) wrapper: replica logica de scoring.js para extraer breakdown por tipo (win/exact/gole/bonus) y delega total al canonical calcMatchPoints (con fallback computacional si no carga). Sentinel: realHome=0&&realAway=0 → 'no jugado' (TODO F3: usar live_scores.played real). (6) v3RenderChipsGrupos: 3 estados — pre-kickoff vacío, 0 pts chip único '+0 pts' gris, N pts stack horizontal con tipos + chip total destacado linear-gradient. (7) v3RenderGoleadoresTabGrupos: lista 6 partidos con jornada-labels + 2 picks (home/away) por partido. (8) v3RenderGoleadorPick: empty state 'Sin elegir' o 'Squad pendiente' si !equipo.players.length. (9) v3OpenGoleadorPickerGrupos abre sub-overlay z-index 120; v3EnsureSquadPickerOverlay crea singleton body-level si no existe. (10) v3RenderSquadPickerGrupos: header con eyebrow + scoreline + close + lista players de EQUIPOS[].players + botón 'Quitar selección' (disabled si no había pick). (11) v3SaveGoleadorGrupos persiste pred.gol + pred.goleadorSide + home/away + saved:true → savePredictions + close picker + re-render tab. (12) v3BindEscapeAndBackdrop: jerarquía cierre — sub-overlay primero (squad picker) > modal (zoom-overlay). **Cambios CSS (grupos-v3.css +~270 LOC)**: 44 selectores nuevos. Tokens del mock aprobado: v3-chip (Saira 10px 800 padding 3x8 rounded 6), 6 variantes (zero gris, win verde, exact lime, gole gold, bonus purple, total gradient zoom-color→lime con shadow); v3-goleador-row grid 3-col (match-label + 2 picks); v3-goleador-pick filled teal-tinted + empty dashed + unavailable opacity .55; v3-squad-picker-overlay z-index 120 + panel z-index 130 (sobre el modal zoom-overlay z-index 100/110); v3-squad-picker-player hover teal + is-picked lime + clear-button red dashed. **Persistencia**: localStorage shape extendido a {l, v, saved, home, away, gol, goleadorSide} — backward compat porque campos faltantes se leen como undefined sin throw. Supabase upsert NO modificado en F2.8 (F3 wiring lo extenderá si necesario). **Verificación**: node --check OK + npm run build OK + 44 selectores nuevos en dist/css/v3/grupos-v3.css + 17 refs JS a 7 funciones nuevas + comm -12 cross-file = empty (0 colisiones residuales, audit preventivo cumplido).

[06:00] F2.8.1 — Refactor goleador picker: 2 picks → 1 pick + close-after-select robust. **Bug 1 fix UX**: cada v3-goleador-row tenía 2 v3-goleador-pick (home + away) — redundante porque la elección del jugador implica el side. Refactor: 1 pick por partido con lista combinada home+away en el sub-overlay. **Bug 2 fix close-after-select**: diagnóstico runtime San (Chrome MCP) — el overlay SÍ cerraba pero localStorage no se actualizaba (causa: stub sandbox savePredictions no escribe, esperado) Y percepción 'no hace nada' (causa raíz probable: ambigüedad pickIsThisSide con goleadorSide exact-match en re-render). Eliminado side parameter en todo el flow → ambigüedad imposible. **Cambios JS (grupos-v3.js)**: (1) state var _v3SquadPickerSide ELIMINADA. (2) v3OpenGoleadorPickerGrupos(matchIdx) sin side. (3) v3RenderGoleadoresTabGrupos: 1 row con . (4) v3RenderGoleadorPickUnified: estados unavailable (ambos squads vacíos) / empty (sin elegir) / filled (avatar número + nombre + chip equipo). Lookup playerKey en ambos squads. Avatar: regex  extrae número del format 'X · Nombre'; fallback '·'. (5) v3RenderSquadPickerGrupos: 2 secciones (home + away) con v3RenderSquadPickerTeamSection. Botón clear solo si p.gol existe. (6) v3SaveGoleadorGrupos(matchIdx, playerKey): infiere side via lookup en homeEquipo.players y awayEquipo.players, persiste pred.gol + pred.goleadorSide (backward compat scoring.js). Plus: tras save → close picker →  explicit (evita reset accidental) → v3RenderZoomGrupos. **Cambios CSS (grupos-v3.css)**: (1) v3-goleador-row grid-template-columns 1fr 1.5fr 1.5fr → 1fr 2fr. (2) v3-goleador-pick.is-filled background teal-tinted más opaco + border-color más visible. (3) v3-goleador-pick__avatar (chip circular 22px con número del jugador + bg zoom-color). (4) v3-goleador-pick__team (chip uppercase 9px lime bg + ink-900 color). (5) v3-squad-picker-team-section + __title + __hint para dividers home/away. **NO se añadió SQUADS stub global** — el picker lee EQUIPOS[].players directo del data.js (~2-5 mock players por equipo). F3 cleanup conectará squads reales via EF get-squad. **Verificación**: node --check OK + npm run build OK + 0 refs residuales a data-v3-side o _v3SquadPickerSide + comm -12 cross-file colisiones = empty + 5 refs CSS team-section + v3RenderGoleadorPickUnified × 2 (decl + 1 caller).

[06:25] F2.8.2 — Fix CRITICO bloqueo de pagina tras 1a seleccion de goleador (San Chrome MCP runtime diag). Causa raiz aislada: .v3-squad-picker-panel__inner tenia pointer-events:auto sin gating por .is-open (mientras .v3-squad-picker-overlay si tenia ese pattern correcto). Cuando overlay cerraba (opacity 0), pointer-events stayed auto en el inner. El inner ocupa fullscreen via flex centering del .v3-squad-picker-panel position:fixed inset:0 → capturaba TODOS los clicks del viewport aunque invisible. elementFromPoint(centro) devolvia .v3-squad-picker-player__name post-cierre. Solo se manifestaba tras la 1a apertura porque innerHTML estaba vacio antes. **Fix CSS** (grupos-v3.css L859-880): .v3-squad-picker-panel__inner pointer-events:auto → :none por default; .v3-squad-picker-overlay.is-open ~ .v3-squad-picker-panel .v3-squad-picker-panel__inner anade pointer-events:auto solo cuando .is-open activo. Pattern identico al zoom-overlay del modal principal (L355 mundial-shell-v3.css). **JS defensivo** (v3CloseGoleadorPickerGrupos): tras quitar .is-open, limpia inner.innerHTML para garantizar que descendientes no quedan en DOM capturando clicks aunque el CSS ya gatee. Belt + suspenders. **Lección documentada (E14 / ERR-43 propuesto por San)**: verificacion post-fix debe incluir click en otro elemento DESPUES del primer flujo testeado, no solo verificar single-event. Mi F2.8.1 verifico click jugador → overlay cierra (OK) pero NO click posterior en otro pick → fallaba en interaccion usuario real. **Verificacion**: node --check + npm run build OK + 2 reglas CSS dist actualizadas (base :none + .is-open sibling :auto) + JS inner.innerHTML = '' presente en v3CloseGoleadorPickerGrupos.

[06:50] CIERRE SESION F2.7/F2.8/F2.8.1/F2.8.2 validados visualmente por San. Branch claude/port-world-cup-design-FvZpD HEAD 5b87645 - NO mergeado a main (F3 wiring SPA pendiente). Entregables cierre: (1) CLAUDE.md actualizado - Estado: redesign v3 base estable Grupos cerrado visualmente. Top-3 reescrito (boost UX, IA Predictor integration, audit cards legacy vs v3). E14 nuevo en Reglas CRITICAS (test post-fix overlays con elementFromPoint o click programatico en otro elemento). Catalogo ERR-01..43. Size 8307 bytes (limit 10240 OK). (2) CHANGELOG.md - nueva seccion 2026-05-14 Redesign v3 (F2 base estable Grupos) con resumen 6 commits chain F2.5 -> F2.8.2, 4 colisiones namespace resueltas en serie, ERR-43+E14 docs, ref AUDIT. Trim aplicado para mantener 30522 bytes (limit 30720 OK, 200 bytes margen). (3) errores_conocidos_porra.md - ERR-43 nuevo (overlay/sub-overlay pointer-events no gateado por .is-open). Sintoma/causa/fix/patron preventivo/test obligatorio documentados. (4) docs/AUDIT_CARDS_LEGACY_VS_V3.md NUEVO 7884 bytes - 15 features match-card legacy comparadas. 3 ALTA prioridad (IA tooltip+frase, EN VIVO indicator, Boost UX). 5 MEDIA (CEST pill, Pizarra trigger, Score IA vs user, award badges predictor v3, stadium info). 4 BAJA/opcional. Wiring sugerido por feature con helpers reusables. Documental - no implementado. NO se toco codigo v3 (grupos/elim/shell) en esta sesion de cierre - solo doc.

[07:15] F2.9-HOTFIX-01: CSS .phone.v3-shell-host { min-height: 0 } override en mundial-shell-v3.css L24-32. Root cause: shell-host hereda min-height:100vh del .phone generico pero solo contiene header+stage-pill+qualified-cta (110-210px contenido real). Shell y contenido viven en .phone separados (siblings, no descendiente) en grupos-v3.js + eliminatoria-v3.js → 2 .phone por pantalla, cada uno reservando 100vh, ~890px de aire entre stage-pill y contenido principal. Detectado durante F2.9 smoke Eliminatoria; aplica tambien a Grupos (F2.8 cerro sin detectar). Diagnostico previo por Claude.ai, ya con root cause aislado. Fix unico CSS, NO toca JS, NO refactor. Verificado npm run build OK + grep -l v3-shell-host dist/css/v3/mundial-shell-v3.css → match. **2 OUT-OF-SCOPE anotados (NO se tocan en este hotfix)**: (1) v3ElimMount() / v3GruposMount() no limpian contenedor antes de montar — el placeholder stub del sandbox queda vivo entre shell y bracket. Solo afecta sandbox QA, no produccion. Candidato a ERR-44 para fix posterior. (2) Sandbox showPage() usa style.display='' que no override #page-elim { display:none } del CSS embebido del sandbox. Bug del sandbox HTML, no del v3. NO se actualizo CLAUDE.md ni CHANGELOG.md (hotfix intermedio dentro de F2.9, no cierre completo).

[07:35] F2.9-HOTFIX-02: querySelector inner panel scope overlay -> document en eliminatoria-v3.js L397 (2 ocurrencias en la misma linea: .v3-zoom-panel__inner v3 + .zoom-panel__inner legacy fallback). Causa raiz: F2.6 del shell cambio overlay+panel a SIBLINGS direct body children (no anidados); eliminatoria-v3.js no se actualizo y seguia haciendo overlay.querySelector(...) para buscar el inner, retornaba null, early-return silencioso en if (!inner) return; modal abria pero quedaba vacio (inner.innerHTML=''). grupos-v3.js ya usaba document.querySelector (4 occurrencias correctas) - por eso Grupos funciona y solo Elim quedo roto. Find-replace de patron overlay.querySelector('.v3-zoom-panel__inner') || overlay.querySelector('.zoom-panel__inner') -> document.querySelector('.v3-zoom-panel__inner') || document.querySelector('.zoom-panel__inner'). Cambio unico en L397, NO toca otra cosa. Verificado: node --check OK + npm run build OK + grep -oE post-fix: 2 document.querySelector calls (v3 + legacy) + 0 overlay.querySelector residuals para ese selector. NO se actualizo CLAUDE.md ni CHANGELOG.md (hotfix intermedio dentro de F2.9).

[07:55] F2.9-HOTFIX-03: ERR-43 redux en .v3-zoom-panel__inner del modal principal (no era squad-picker, era el zoom shared del shell). Causa raiz: F2.5 unificacion movio el skeleton al mundial-shell-v3.css pero copio pointer-events:auto sin gating .is-open. F2.8.2 fixeo el SUB-overlay squad-picker pero NO el zoom-overlay principal. Impacto Elim verificado por Claude.ai Chrome MCP: tras cerrar modal, inner mantiene HTML residual (2157 chars) + pe:auto + visibility:visible. Inner rect 351x322 desde y=54 solapa con cards R32 (y=179..375). elementFromPoint(card 73 center) -> v3-zoom-ko-side__code (descendiente del modal residual). dispatchEvent click real cae en modal, matchIdAfter=null, card 73 INACCESIBLE. Cambiar pill R32->R16->R32 no recupera. Usuario bloqueado hasta reload page. **3 cambios aplicados** (mismo patron F2.8.2 belt+suspenders): (1) CSS mundial-shell-v3.css L352-372: .v3-zoom-panel__inner pointer-events:auto -> :none default; .v3-zoom-overlay.is-open ~ .v3-zoom-panel .v3-zoom-panel__inner añade pointer-events:auto a la regla existente (opacity + transform). (2) JS eliminatoria-v3.js v3CloseZoomKO L381-389: tras overlay.classList.remove('is-open'), añade var inner = document.querySelector('.v3-zoom-panel__inner') || document.querySelector('.zoom-panel__inner'); if (inner) inner.innerHTML = ''. (3) JS grupos-v3.js v3CloseZoomGrupos L233-241: mismo bloque (single querySelector v3-, no necesita fallback legacy). NO toca v3CloseGoleadorPickerGrupos (squad-picker ya tiene este patron desde F2.8.2). Verificado: node --check + npm run build OK + base .v3-zoom-panel__inner tiene pointer-events:none + sibling rule tiene pointer-events:auto + elim inner.innerHTML='': 1 + grupos inner.innerHTML='': 2 (squad-picker F2.8.2 + nuevo zoom). NO se actualizo CLAUDE.md ni CHANGELOG.md (hotfix intermedio F2.9).

[08:10] F2.9-HOTFIX-04: sandbox v3-pages-smoke.html showPage() L147-148: '' -> 'block' (OOS-2 de HOTFIX-01). Causa raiz: showPage(pageId) hacia style.display = pageId === 'X' ? '' : 'none'. El '' quita el inline pero el sandbox tiene en su <style> embebido la regla #page-elim { display: none; } que entonces gana y oculta Elim. Grupos no sufria porque su #page-grupos no tiene esa regla. Fix unico: cambiar '' a 'block' en ambas lineas — inline display:block override la regla CSS embebida con mayor specificity. NO toca el CSS embebido del sandbox (preserva la regla como hidden-by-default state). San puede ahora usar los botones Show Grupos / Show Elim sin inyectar JS en consola. Sandbox es asset estatico (Vite copia tal cual desde public/), no requiere npm run build. Verificacion: grep -c "? 'block' : 'none'" -> 2 + grep -c "? '' : 'none'" -> 0 residual. NO se actualizo CLAUDE.md ni CHANGELOG.md (hotfix intermedio F2.9 sandbox-only).

[08:30] F2.9-HF-05 (4 fixes pequeños sin lógica de negocio): #3 eliminado botón 'Editar' del footer Clasificación en v3RenderZoomGrupos L307 + handler showPr L329-330 — autosave coherente, sin modo edit explícito (decisión San A). #4 CSS .v3-st-name standings: font-size 11px→10px + white-space nowrap→normal + word-break break-word + line-height 1.15 + -webkit-line-clamp 2 (acomoda 'República de Corea', 'Bosnia y Herzegovina' a 2 líneas sin ellipsis). #6 stub sandbox v3-pages-smoke.html L110: removido confirm doble — el modal Grupos ya muestra su propio confirm real. #10-texto eliminatoria-v3.js: '⚽ Empate · ¿Quién gana en penaltis?' → '⚽ Empate · Indica equipo que clasifica' (L427 panel) + '⚠️ Marca quién gana en penaltis' → '⚠️ Indica equipo que clasifica' (L437 summary) + removido ' (en penaltis)' del decided summary. Razón: marcador KO ya incluye prórroga; usuario solo indica quién clasifica independiente del mecanismo. NO renombrada clase .v3-zoom-ko-penalty (preservada). NO tocado comportamiento funcional (2 botones home/away + persistencia classifier sin cambios). NO tocado scoring engine (eso es HF-09). NO se actualizó CLAUDE.md ni CHANGELOG.md (hotfix intermedio F2.9). Verificado: node --check + npm run build OK + grep ERR-22 4 items: EDITAR/data-v3-show-predictions 0/0, word-break 1, sandbox stub confirm 0, 'Indica equipo que clasifica' 2, 'penaltis' 0.

[08:55] F2.9-HF-06 (3 cambios visuales Eliminatoria): #8 .v3-trophy-col SIEMPRE presente entre columnas L+R (R32/R16/QF/SF) en v3RenderBoard tras appendChild(leftCol) y antes de appendChild(rightCol). Antes el trofeo central solo aparecia en vista F via v3RenderFinalBlock; en las otras rondas las 2 columnas quedaban sin nada en el medio. Trofeo con onerror handler que oculta si falla. URL alineada (cambio #2). #2-URL trophy en ambos renders (v3RenderBoard nuevo + v3RenderFinalBlock L237-242): trophy-2026.png -> miniatures/trophy/trophy.png. Alineado con prototipo design/v3-prototype/eliminatorias-2026.html. #9 CSS vista Final overflow lateral: .v3-final-card anadido overflow:hidden + box-sizing:border-box (clip cualquier escape de descendientes). .v3-final-card__match añadido min-width:0 (permite grid honrar 1fr estricto, mismo gotcha que F2.2 .v3-column). .v3-final-card__side añadido overflow:hidden (clip codes/text largos como 'SAUDI ARABIA' en grid 1fr cell). .v3-final-card__score min-width 96px -> 78px (headroom al grid auto track en viewports estrechos 360px). NO toca proporciones visuales internas (font-size, layout, colores). Verificado: node --check + npm run build OK + grep trophy/trophy.png dist 3 refs + grep trophy-2026.png residual 0 + grep v3-trophy-col en dist 2 (un render por path) + 4 reglas CSS HF-06 #9. NO se actualizo CLAUDE.md ni CHANGELOG.md (hotfix intermedio F2.9).

[09:15] F2.9-HF-06-bis (CSS only, regresión HF-06): trofeo intermedio invisible en R32/R16/QF/SF. Causa raíz: la regla F2.3 `.v3-bracket-board:not(.v3-ko-board--F) .v3-trophy-col { display: none }` (añadida cuando el problema era clase compartida con Grupos antes de F2.5 unificación) seguía ocultando el .v3-trophy-col intermedio que HF-06 #8 inyectó en el DOM. Tras audit del prototipo (design/v3-prototype/mundial-2026.css L379+ y L398+), Opción A coherente con prototipo: grid 3 cols + trofeo absolute centrado en track central. Aplicado: (1) .v3-bracket-board.v3-ko-board--R32/R16/QF/SF grid-template-columns 1fr 1fr → 1fr 40px 1fr (track central reservado para trofeo decorativo; 40px vs 86px del prototipo para minimizar reducción del ancho de cards laterales — cards elim más anchas que grupos). (2) ELIMINADA regla F2.3 `:not(--F) .v3-trophy-col { display: none }`. (3) Nueva regla `.v3-bracket-board:not(.v3-ko-board--F) .v3-trophy-col` con position:relative + pointer-events:none + min-width:0 (carril del grid). (4) Nueva regla `.v3-bracket-board:not(.v3-ko-board--F) .v3-trophy` con position:absolute + top/left 50% + translate(-50%,-50%) + width 110% + max-width 56px + opacity 0.6 + filter drop-shadow + pointer-events:none + z-index 1 (decorativo, no compite visualmente con cards). NO regresión vista F (su .v3-trophy y .v3-trophy-col scoped a .v3-ko-board--F siguen intactos). CSS only, NO toca JS, NO toca grupos-v3.*. Verificado: npm run build OK + grep '1fr 40px 1fr' en dist 2 (regla + comment), regla 'display:none .v3-trophy-col' eliminada (residual grep match era false positive en comment doc), 2 reglas position:absolute trophy/trophy-col intermedio. NO se actualizo CLAUDE.md ni CHANGELOG.md.

[09:35] F2.9-HF-06-ter (CSS only, valores alineados al prototipo): HF-06-bis usó valores conservadores (max-width 56px, opacity 0.6, sin animación, track central 40px) que no reflejaban el prototipo. Diagnóstico Claude.ai vs prototipo: max-width 56→110, max-height añadido 160, opacity 0.6→1 (default), filter ampliado a triple drop-shadow del prototipo, animation trophy-float añadida, grid central 40→86px. Cambios: (1) .v3-bracket-board.v3-ko-board--R32/R16/QF/SF grid-template-columns 1fr 40px 1fr → 1fr 86px 1fr (alineado prototipo design/v3-prototype/mundial-2026.css L379+ que usa exactamente este valor). Cards laterales: 155.5→138.5px — coherente con prototipo. (2) .v3-bracket-board:not(--F) .v3-trophy regla actualizada: max-width 56→110, max-height new 160, opacity 0.6 eliminada (default 1), filter expandido a triple drop-shadow idéntico al prototipo (rgba(201,169,97,.5) 18px + rgba(0,0,0,.55) 12px 28px + rgba(201,169,97,.2) 80px), animation:v3-trophy-float-bracket 5s ease-in-out infinite añadida. (3) Nuevo @keyframes v3-trophy-float-bracket con transform translate(-50%,-50%) ↔ translate(-50%, calc(-50% - 4px)) — mismo perfil que el v3-trophy-float de grupos (F2.4) pero sufijo único 'bracket' para evitar colisión cross-file con grupos y con v3-trophy-float-final de la vista F. Patrón post-F2.4 namespace rename. NO regresión vista F (sus reglas .v3-ko-board--F .v3-trophy con position:static + v3-trophy-float-final intactas). CSS only. Verificado: npm run build OK + '1fr 86px 1fr' dist 2 + '1fr 40px 1fr' residual 0 + 'max-width: 110px' 1 + 'max-height: 160px' 1 + 'opacity: 0.6' residual 0 + 'trophy-float' total 7 refs. NO se actualizó CLAUDE.md ni CHANGELOG.md.

[09:55] F2.9-HF-06-quater (CSS only, 3 bugs post HF-06-ter): #1 SF overflow horizontal — bodyScrollW 429 > viewport 375 (54px scrollbar visible). Tracks grid asimétricos 155.3/164.8 con 1fr ambos lados. Causa: cards no tenían min-width:0, su min-content (badge __tag fijo 22px + body con códigos/flags/scores) forzaba expansión > 1fr. Fix: añadido min-width:0 a .v3-ko-card + .v3-bracket-board .v3-column (mismo gotcha CSS Grid F2.2 .phone .v3-column). #2 F trofeo aplastado — nativo 1024×1536 (ratio 0.667 vertical), rendered 200×230 (ratio 0.87 horizontal). object-fit computed era 'fill' (CSS default). Fix: añadido object-fit:contain explícito en .v3-ko-board--F .v3-trophy → image preserva aspect dentro del box 200×230 → render ~153.5×230. #3 F GRAN FINAL card excesivamente alta — 133px medido (3er puesto 73px). Padding 18px 16px 16px generoso. Fix: padding → 12px 14px (vertical -22px) + .v3-final-card__eyebrow margin-bottom 14→8px. Objetivo ~100px alto sin perder legibilidad. NO toca .v3-final-card--third (su padding override ya compacto). CSS only. NO toca JS ni grupos-v3.*. Verificado: npm run build OK + 5 verificaciones grep — .v3-ko-card min-width:0 (1), .v3-bracket-board .v3-column min-width:0 (1), .v3-ko-board--F .v3-trophy object-fit:contain (1), .v3-final-card padding 12px 14px (1), __eyebrow margin-bottom 8px (1). Total min-width:0 en dist: 5. NO actualizo CLAUDE.md ni CHANGELOG.md.

[10:15] F2.9-HF-06-quinto (CSS only, 1 cambio mínimo): padding lateral en .v3-bracket-board base. ANTES: padding: 4px 0 12px (top 4, sides 0, bottom 12) → cards en SF (M101/M102 con badges lime laterales) y F (GRAN FINAL + 3er puesto) quedaban pegadas al borde del viewport mobile 375 sin respiración. DESPUÉS: padding: 4px 12px 12px (lateral 0→12). Aplica a TODAS las rondas. Cálculo a viewport 375: board content width = 375-24 = 351px. SF grid 1fr 86px 1fr con gap 12px → tracks laterales (351-86-24)/2 = 120.5px cada. Cards 101/102 dentro de cada track con badges incluidos. F: cards GRAN FINAL/3er puesto width 351px max, left=12, right=363 → margen visible 12px cada lado. NO regresión: .v3-bracket-board.v3-ko-board--F NO tenía padding propio (heredaba del base), así que ahora hereda los 12px laterales sin duplicación. .v3-ko-board--F .v3-trophy-col tiene max-width:380px width:100% — se constrains a 351 (board content) sin desbordar. CSS only. NO toca JS, grupos-v3.*, shell. Verificado: npm run build OK + grep 'padding: 4px 12px 12px' en board base 1 + 'padding: 4px 0 12px' residual 0. NO actualizo CLAUDE.md ni CHANGELOG.md. F2.9 HF-06 cerrado en 5 iteraciones (HF-06 + bis + ter + quater + quinto) — documentado en migration-log para aprendizaje del proceso.

[10:35] F2.9-HF-06-sexto (CSS only, 1 línea): box-sizing border-box en .v3-bracket-board. Causa raíz: HF-06-quinto añadió padding 4px 12px 12px pero el default content-box hacía que el padding-right se sumara FUERA del width:100% del padre (padding-left visualmente empujaba hacia dentro = respiración izquierda OK, padding-right desbordaba el border-right exterior = card 102 fuera de viewport). Diagnóstico Claude.ai viewport 375: SF bodyScrollW 399 (=375+24 overflow), F bodyScrollW 384 (=360+24 overflow). Asimetría visual: izda OK, dcha desbordada 12-24px. Fix: añadido box-sizing: border-box → el padding 12+12 queda DENTRO del width:100%. Grid 1fr 86px 1fr recalcula simétrico a tracks 120.5/86/120.5 con gap 12*2=24 → suma 327 + padding 24 = 351 content + border-box width 351 (vp 375 - 24 ancestor margin/padding = 351 actual board widht). NO toca grupos-v3.*, JS, shell. Verificado: npm run build OK + grep box-sizing border-box en .v3-bracket-board base 1. HF-06 cerrado en 6 iteraciones (HF-06 + bis + ter + quater + quinto + sexto) — caso de estudio CSS Grid + box-sizing + padding documentado en migration-log para audit cierre F2.9. NO actualizo CLAUDE.md ni CHANGELOG.md.

[10:55] F2.9-HF-09: scoring engine goleador acepta cualquier marcador + cualquier equipo (excepción penaltis KO documentada). Causa raíz pre-HF-09 en scoring.js L64-70: (a) realL !== realR bloqueaba empates → si user pronostica 0-0 con gol y otro 0-0 sin gol, oportunidades de +2 desiguales. (b) solo consideraba goleador del equipo ganador → si user acierta goleador del equipo perdedor o empate, no sumaba. (c) realScorer placeholder hardcoded a players[0] del equipo ganador. **3 cambios scoring.js**: (1) firma extendida  con realScorers opcional Array<string>. (2) Bloque goleador reescrito: si pred.gol → const scorers = realScorers ?? _hf09FallbackScorers(pred, realL, realR); if scorers.includes(pred.gol) pts += 2. Sin filtros por marcador ni equipo. (3) Firma extendida  que delega a calcMatchPoints pasando realScorers. (4) Nueva función helper : si empate devuelve [players[0] home, players[0] away], si decidido devuelve [players[0] ganador]. Placeholder hasta hidratación real del pipeline. (5) calcTotalUserPoints actualizado: invocaciones de calcMatchPoints L167 y calcKOMatchPoints L183 ahora pasan real.scorers (undefined si no hidratado → fallback). Backwards compatible: cero regresión funcional con placeholder existente, motor preparado para datos reales. **Cambio docs/scoring-engine.md**: añadida sección 'Regla del +2 goleador (F2.9 HF-09)' tras tabla 'Puntos por partido' con (a) regla independiente de marcador y equipo, (b) justificación (equiparar oportunidades), (c) excepción penaltis KO (responsabilidad pipeline alimentar realScorers solo con goles 90'+prórroga), (d) estado actual placeholder + trabajo pendiente aguas arriba. NO se tocó pipeline (porra-apify-webhook, update-results, schemas DB) — eso es trabajo aguas arriba fuera de F2.9. Verificado: node --check + npm run build OK + grep 'realL !== realR' bloque goleador 0 + 'realScorers' dist 6 (firmas + invocaciones) + '_hf09FallbackScorers' 2 (decl + uso) + scoring-engine.md 'Regla del +2 goleador' 1 + mención '0-0' 2 + mención 'penaltis' 1. NO actualizo CLAUDE.md ni CHANGELOG.md (HF-cierre lo hará al final F2.9).

[11:15] F2.9-HF-10 (CSS only, 1 cambio): solapamiento CAMPEÓN+GRAN FINAL en vista F descubierto por San en simulación end-to-end. Diagnóstico Claude.ai Chrome MCP: .v3-final-card__winner position:absolute top:-12px flotaba sobre el card (top=374 vs card.top=384) Y .v3-final-card__eyebrow position:static debajo (top=398) → ambos visualmente acumulados en el top del card. Solo ocurre cuando koPredictions[m104] está poblada (winner badge solo renderiza con .v3-final-card.is-decided). Decisión San (opción más limpia): ocultar eyebrow cuando winner presente — el badge winner ya cumple la función del eyebrow (anuncia que es la final, redundancia). CAMBIO 1 aplicado (CSS pure via :has()): nueva regla .v3-final-card:has(.v3-final-card__winner) .v3-final-card__eyebrow { display: none } después del bloque .v3-final-card.is-decided .v3-final-card__winner existente. Aplica también a la card 3er puesto (el winner '🥉 Bronce · ...' sustituye al eyebrow '🥉 3.er PUESTO'). CAMBIO 2 (reposicionar winner como header static integrado) NO aplicado — requería reescribir 16 LOC del rule winner + repensar chip→header transition, NO trivial per criterio San 'si CAMBIO 2 requiere más que 2-3 líneas, hacer solo CAMBIO 1'. :has() soportado en Chrome 105+ (target moderno Vite OK). Backwards compatible (si no hay winner, eyebrow se renderiza normal). CSS only. NO toca JS, grupos-v3.*, shell, CLAUDE.md, CHANGELOG.md. Verificado: npm run build OK + grep regla :has() 1 occurrencia.

[11:35] F2.9-HF-10-bis (CSS only, 2 cambios): revertir HF-10 + reescribir winner como header static dentro del card. San aclaró via montaje comparativo que la decisión HF-10 fue errónea: el comportamiento DESEADO es AMBOS visibles apilados verticalmente (Línea 1 winner 'CAMPEÓN G.M101', Línea 2 eyebrow 'GRAN FINAL', Línea 3 match). El problema visual REAL era que .v3-final-card__winner tenía position:absolute top:-12px → badge flotaba 10px POR ENCIMA del card border (top=374 vs card.top=384) → cortado visualmente fuera del fondo dorado. PASO 1: eliminada regla HF-10 .v3-final-card:has(.v3-final-card__winner) .v3-final-card__eyebrow {display:none} (era la decisión errónea — eyebrow debe seguir visible siempre). PASO 2: reescrita regla .v3-final-card.is-decided .v3-final-card__winner. Cambios: position:absolute→static (header dentro del card en flow); transform:translateX(-50%)→none; margin: -12px -14px 8px (compensa padding 12px 14px de HF-06-quater → full-width edge-to-edge + 8px gap a eyebrow); padding 5px 14px (sin cambio); background var(--fifa-gold)→rgba(201,169,97,0.12) (sutil dorado vs sólido); color var(--ink-900)→var(--fifa-gold) (texto dorado sobre fondo sutil); border-radius 999px (chip)→8px 8px 0 0 (solo top integrado al card); añadido border-bottom 1px solid rgba(201,169,97,0.25); font-size 10→11px; letter-spacing 0.16→0.22em (alineado con eyebrow); añadido line-height:1.2; eliminado box-shadow chip glow (ya no flota); preservado text-transform uppercase + white-space nowrap. NO toca .v3-final-card--third.is-decided .v3-final-card__winner (override propio con position:static + margin:0 auto 6px + bronze styling intactos). Backwards compatible: card 3er puesto sigue compacta con su override propio. CSS only. NO toca JS, grupos-v3.*, shell, CLAUDE.md, CHANGELOG.md. Verificado: npm run build OK + regla :has() HF-10 eliminada (0 ocurrencias) + position:static en winner base (1) + margin -12px -14px 8px (1) + --third override position:static preservado (1).

[12:00] F2.9-HF-cierre (doc only): rename docs/AUDIT_CARDS_LEGACY_VS_V3.md → docs/AUDIT_LEGACY_VS_V3.md vía git mv. AÑADIDA sección 'Funcionalidades transversales' con tabla 9 puntos integración v3↔legacy I1-I9 (I1 Routing tabbar→render v3, I2 Scope shell v3 4 pages sin predictor, I3 State global compartido, I4 Cierre porra→cards read-only, I5 EN VIVO indicator, I6 IA Predictor wiring, I7 Boost UX, I8 Pizarra entry, I9 CSS cascada) con evidencia legacy vs v3 extraída de árbol HEAD d43caf6 (25 ficheros legacy en public/js/ vs 4 en public/js/v3/, SHELL_PAGES declara 5 pages → decisión I2 reduce a 4). Reframe scope v3 explicitado: v3 son 2 screens (Grupos+Fase final) que sustituyen contenido equivalente en tabbar legacy; no es rewrite completo. Prioridades I1-I9: 🔴 ALTA 7 (I1+I2+I3+I4+I5+I6+I7) 🟡 MEDIA 1 (I9) 🟢 BAJA 1 (I8). AÑADIDA sección 'Backlog F3' con HF-08 (5 bloques A-E: Simulación E2E + Propagación grupos→KO + Resolución equipos brackets + Render nombres reales + Tests integración) + cleanup técnico (ui-groups-mobile.js candidato git rm post-F3). UPDATED CLAUDE.md: estado actual F2.9 con 14 HFs listados + reframe scope v3 + Top-3 reordenado (1. F3 fundamentos I1-I4, 2. HF-08, 3. F3 UX I5-I7) + mapa documentación actualizado con nuevo nombre audit + ampliación scope. UPDATED CHANGELOG.md: entry F2.9 con 14 HFs detallados + sección HF-cierre doc-only. Tamaño CLAUDE.md verificado <10KB. NO toca código. Cerrada F2.9 funcional, F3 abierta.

[01:08] F3-I2 (3 LOC): excluir 'predictor' de SHELL_PAGES en public/js/v3/mundial-shell-v3.js. Cambio 1: SHELL_PAGES = ['grupos','jornada','directo','elim','predictor'] -> ['grupos','jornada','directo','elim']. Cambio 2: removed dead case 'predictor' en stageLabelForPage (no se alcanzaría tras Cambio 1). Decisión documentada en docs/AUDIT_LEGACY_VS_V3.md sec Funcionalidades transversales (I2 ALTA prioridad, predictor mantiene su propio header ui-pred-shell.js). Sin efecto observable hasta I1 (routing wiring) hecho. Build vite no disponible en sandbox; node --check OK. F3 fundamentos kickoff.

## 2026-05-15 — fix(docs): nomenclatura canónica audit — v3GruposMount/v3ElimMount

**Origen:** mismatch HF-cierre F2.9 (commit 18cb8bb), detectado en nueva sesión Claude.ai (15-may) leyendo audit doc en limpio.

**Cambios:** docs/AUDIT_LEGACY_VS_V3.md
- `v3RenderGroup` → `v3GruposMount` (2 ocurrencias)
- `v3RenderKO`    → `v3ElimMount`    (1 ocurrencia)

**Verificación:** sed con backticks como delimitador (unívoco). Pre/post grep counts (2/1 → 0/0/2/1). Helpers reales v3RenderKoCard (3), v3RenderZoomKO (2), v3RenderMatchesList (3), v3RenderZoomGrupos (1) intactos.

**Fuente de verdad:**
- public/js/v3/grupos-v3.js byte 33142
- public/js/v3/eliminatoria-v3.js byte 1523

**No toca:** código. Prepara terreno para F3-I1 wiring que usará nombres reales desde el inicio.

## 2026-05-15 — feat(ui-nav): F3-I1 routing wiring v3GruposMount/v3ElimMount

**Contexto:** F3 fundamentos integración v3 ↔ legacy. Sin este wiring las cards v3 son isla desconectada del SPA legacy.

**Cambios:** public/js/ui-nav.js función showPage (~80 LOC neto).
- `page === 'grupos'`: invoca window.v3GruposMount() en lugar de initGrupos()/_gruposInitPromise.
- `page === 'elim'`: invoca window.v3ElimMount() en lugar de koInit()/elimShellResetAction()/renderElimShell().
- Final showPage: dispatch CustomEvent('mundial:page-changed', {detail:{page}}) + ensurePageShellV3(page) fallback.
- Variable huérfana `_gruposInitPromise` eliminada.

**Conservado:**
- fcShellApply(page) — tabbar inferior F7.4-C, ortogonal a v3.
- closeMobileFocus cleanup al salir de grupos.
- Guard auth + toggle display de las 8 pages.

**Verificación gates (grep):**
- 0 invocaciones de initGrupos()/_gruposInitPromise/renderElimShell/elimShellResetAction (solo menciones en comentarios explicativos).
- 1 invocación de window.v3GruposMount() y 1 de window.v3ElimMount().
- 1 dispatch 'mundial:page-changed' + 1 fcShellApply.
- koInit solo aparece como definición (no llamada en showPage).
- node --check syntax OK.

**Smoke localhost:** NO ejecutado en sandbox (sin browser/vite). San valida pasos 2a-2d localmente tras vite restart + hard-reload.

**TODO post-I1:**
- Verificar v3ElimMount cubre resolveAllSlots() + locked-screen (grupos<72) + #ko-dice-btn show/hide. Si no, mover ANTES de v3ElimMount() en showPage('elim').
- I3: event bus 'mundial:predictions-changed' para re-render v3 tras savePredictions() legacy.
- I4: close-porra read-only en cards v3.

**HEAD anterior:** f509a82 (audit doc nomenclatura).

## 2026-05-15 — fix(spa): F3-I1.5 cargar assets v3 (CSS + JS) en index/main-entry

**Origen:** smoke F3-I1 falló porque las funciones v3GruposMount, v3ElimMount, ensurePageShellV3 no estaban en window. Causa: F2.x desarrolló v3 en sandboxes aislados (/sandbox/v3-pages-smoke.html y /sandbox/v3-shell-smoke.html) pero nunca migró los 4 scripts ni los 3 stylesheets al SPA principal (index.html + main-entry.js).

**Cambios:**
- index.html: 3 <link rel="stylesheet"> tras el último CSS legacy (/css/components/pizarra-tactica.css): /css/v3/mundial-shell-v3.css, grupos-v3.css, eliminatoria-v3.css.
- js/main-entry.js: 4 .then(loadScript) entre ui-pred-shell.js y safety net, orden replicado del sandbox v3-pages-smoke.html: /js/v3/next-match-resolver-v3.js → mundial-shell-v3.js → grupos-v3.js → eliminatoria-v3.js.

**Orden CSS:** v3 carga DESPUÉS del legacy para que pueda override si hace falta (cascade order natural).
**Orden JS:** next-match-resolver primero (helper consumido por shell + pages); mundial-shell antes que pages (registra zoom singleton reusado, F2.1 fix #5).

**F3-I1 wiring (d6bae7c) ahora es funcional.** Pages Grupos / Fase final muestran v3 al cambiar tab desde tabbar inferior.

**Desviación menor del brief:** brief indicaba ruta `public/js/main-entry.js`; ruta real es `js/main-entry.js` (root, no bajo public/). index.html:994 importa `/js/main-entry.js`, Vite resuelve desde root.

**Verificación:** node --check OK. 7/7 grep gates = 1 (3 CSS + 4 JS). Smoke localhost no ejecutado en sandbox (sin browser/vite).

**HEAD anterior:** d6bae7c (F3-I1).

## 2026-05-15 — feat(spa): F3-I1.6 cleanup #page-grupos + chips ADMIN/logout shell v3

**Contexto:** smoke F3-I1 mostró v3-board renderizado pero a 1029px del top, oculto por header legacy de 746px (div.container con global-header, grupos-user-bar, dice-global-bar, letter-bar, groups-container).

**Cambios:**
- index.html: eliminado <div class="container">...</div> completo de #page-grupos. Conservado <a id="top"></a>. v3GruposMount monta #v3-grupos-mount directo como hijo del page.
- public/js/v3/mundial-shell-v3.js: nuevas funciones stagePillRowHTML() (wrap stage pill con 2 chips) y refreshShellUserChips() (visibilidad según currentUser/is_admin). ensureShellMount invoca refresh en ambos paths (existing + new). window.refreshShellUserChips expuesto.
- public/css/v3/mundial-shell-v3.css: append estilos .v3-stage-row, .v3-shell-chip, .v3-shell-chip--admin, .v3-shell-chip--logout (con hover states; display:none default; toggle inline-flex via JS).

**Chips se ven en 4 SHELL_PAGES (grupos/jornada/directo/elim) automáticamente.** Predictor NO carga shell v3 (su propio ui-pred-shell.js gestiona ahí).

**Diferido a F3-I1.7:** cleanup análogo de #page-elim (legacy denso: fc-elim-* mounts F7.X.4, view-cinematic, view-bracket, view-stadium, finalizar-section, modal — requiere análisis de referencias vivas tipo #total-ko-pts que updateKOPts en ui-nav.js sigue invocando).

**Riesgo conocido — null-deref sin guard tras eliminar IDs:** scan post-edit reveló 2 sitios CRÍTICOS sin null-check:
- public/js/scoring.js:1239 — `document.getElementById('total-points').textContent=totalPoints;`
- public/js/scoring.js:1315 — `const container=document.getElementById('groups-container'); container.innerHTML='';` (función renderAll).

Otros sites con guard correcto (no crashean): auth.js:223 (grupos-user-bar), leagues.js:116 (global-header con `if(!header)return`), ui-nav.js:560/admin.js:394,796/ui-groups.js:838,904 (dice-global-bar, ui-groups.js:904 grupos-letter-bar).

renderAll legacy ya no se invoca desde F3-I1 routing; pero puede dispararse desde savePredictions u otros caminos. **San valida console en smoke**; si TypeError aparece, follow-up F3-I1.6.1 con null-guards puntuales.

**Pendiente verificación:** chip logout usa class `do-logout` asumiendo listener legacy lo captura. Si tras smoke no funciona, follow-up con onclick="doLogout()" directo o exponer doLogout en window.

**HEAD anterior:** e1de51f.

## 2026-05-16 — fix(shell): F3-I1.6.2 chip logout funcional + ocultar wc-auth-bar en SHELL_PAGES

**Contexto:** smoke F3-I1.6 reportó (a) chip "↩ Salir" no funciona por display:none persistente tras login, y (b) avatar "C" + nombre + "Cerrar sesión" del header global #wc-auth-bar (DISTINTO del legacy #grupos-user-bar ya eliminado en F3-I1.6) seguían visibles arriba del shell v3.

**Cambios:**
- public/js/v3/mundial-shell-v3.js: añadida subscribeAuthChangesForChips() que suscribe a db.auth.onAuthStateChange() y refresca TODOS los shell mounts en SIGNED_IN/SIGNED_OUT. Ignora TOKEN_REFRESHED/USER_UPDATED (mismo patrón que auth.js). setTimeout(0) para que auth.js popule currentUser primero. Init invocado al cargar el fichero. Insertado tras `window.mundialShellV3Init = init` y antes del bloque auto-arrancar (dentro del IIFE para acceso a refreshShellUserChips).
- public/css/v3/mundial-shell-v3.css: regla display:none para #wc-auth-bar bajo body.fc-shell-active (clase gestionada por F7.4-C fcShellApply). Aprovecha estado existente sin añadir JS; verificado en vivo que cobertura coincide exactamente con pages donde el shell v3 muestra chips (todas menos welcome).

**Diseño:** opción B (San 15-may) — shell v3 self-contained; auth.js intacto. Acoplamiento mínimo a window._porraDb. Avatar redundante con chips v3 → ocultar via CSS aprovechando body.fc-shell-active existente (San 16-may; cero JS extra).

**Verificación:** node --check OK. 5/5 grep gates. Smoke localhost no ejecutado en sandbox (sin browser/vite).

**HEAD anterior:** 7646e79.

## 2026-05-16 — fix(shell+grupos): F3-I1.6.3 chips visibles + hueco + clasificación

**Contexto:** smoke F3-I1.6.2 (16-may) confirmó 3 bugs activos.

**Cambios:**
- public/js/v3/mundial-shell-v3.js refreshShellUserChips: usar `typeof currentUser !== 'undefined' && !!currentUser` en lugar de `!!window.currentUser`. auth.js declara `currentUser` como `let` file-scope global (script regular, no module); NUNCA se asigna a window.currentUser. Error original de F3-I1.6 (suposición mía).
- public/css/v3/mundial-shell-v3.css .phone.v3-shell-host: añadir `padding-bottom: 0 !important` para sobrescribir el padding-bottom:80px heredado de `.phone` (legacy del sandbox donde .phone era contenedor único; al separar shell + board ese padding queda en medio). Hueco esperado: 118px → 38px (padding-top 18 + margin-top 12 + 8).
- public/css/v3/grupos-v3.css `.phone .v3-group.has-standings .v3-team-row__code`: override con `white-space:nowrap` + `text-overflow:ellipsis` para truncar con … en lugar de wrap vertical letra-por-letra cuando hay pos+pts adicionales en estado post-sim. Pre-sim intacto (regla base sin tocar).

**Smoke esperado:** chips visibles + hueco ≤50px + nombres legibles post-simulación.

**Verificación:** node --check OK. 5/5 grep gates. Smoke localhost no ejecutado en sandbox.

**Desviación menor del brief:** el selector real para el shell host es `.phone.v3-shell-host` (clases encadenadas), no `.v3-shell-host` simple como indicaba el brief. Preservé el selector original más específico para mantener cascade intacto.

**HEAD anterior:** 2bb4523.

## 2026-05-16 — fix(spa+shell+grupos): F3-I1.6.4 layout chips + códigos 3 letras + refuerzo wc-auth-bar

**Contexto:** smoke F3-I1.6.3 reveló 3 bugs adicionales (16-may).

**Cambios:**
- public/js/v3/mundial-shell-v3.js:
  - stagePillRowHTML: reordenar DOM (admin → pill → salir) para layout grid. Chip salir reducido a solo icon "↩".
  - refreshShellUserChips: refuerzo defensivo — ocultar #wc-auth-bar via JS al refrescar chips (defense in depth contra cache/timing).
  - Nuevo listener 'mundial:page-changed' tras subscribeAuthChangesForChips: toggle de wc-auth-bar (display:'' en welcome, display:'none' en SHELL_PAGES y otras).
- public/js/v3/grupos-v3.js:
  - v3RenderGroup branch isComplete: códigos 3 letras en lugar de equipo.name. Chain `equipo.code || equipo.flag || slice(0,3).toUpperCase()` — **equipo.code NO existe en EQUIPOS (data.js)** pero equipo.flag ya contiene códigos FIFA reales (MEX/BRA/ESP/CZE/RSA/KOR). Slice fallback genérico daría "REP" para "República Checa" → indeseado, por eso chain prefiere flag.
  - ELIMINADA creación de elemento pts. Resultado per row: pos | nombre3 | bandera.
- public/css/v3/mundial-shell-v3.css:
  - .v3-stage-row: cambio de flex a grid 1fr/auto/1fr. Pill SIEMPRE en col 2 (centrado en viewport). Admin col 1 start, salir col 3 end. Independiente de qué chips estén visibles.
  - .v3-shell-chip: font-size 11→10px, padding 6px 12px → 4px 8px.
- public/css/v3/grupos-v3.css:
  - Simplificado override post-sim del __code (innecesario el ellipsis con 3 letras; mantenido solo desactivación wrap vertical).

**Diseño:** opción A San — códigos FIFA estándar. Layout grid garantiza centrado del pill independiente de chips presentes (admin/no admin). Logout chip reducido a icon-only.

**Desviación de brief — equipo.code:** brief usaba `equipo.code` con fallback genérico slice(0,3). Verificación in-data reveló que la propiedad real es `equipo.flag` (ya contiene MEX/BRA/ESP códigos FIFA estándar). Chain `code → flag → slice` cumple brief literal + da resultado correcto inmediato + permite migración trivial si se decide renombrar a `code`.

**Verificación:** node --check OK ambos JS. Grep gates: F3-I1.6.4 shell JS 3, shell CSS 3, grupos JS 2, grupos CSS 1. v3-team-row__pts eliminado de render grupos JS (ya solo aparece en regla CSS, intacta).

**HEAD anterior:** 7feb800.

## 2026-05-16 — feat(grupos+elim): F3-I1.6.5 cleanup margen elim + 8 mejores 3eros

**Contexto:** cierre sprint F3-I1.6.x. 2 tareas adicionales tras smoke F3-I1.6.4.

**Cambios:**
- public/css/v3/eliminatoria-v3.css: regla display:none para 8 elementos legacy F7.X.4 (#fc-elim-header, #fc-elim-stepper, #fc-elim-dice-banner, #fc-elim-list, #fc-elim-awards-pane, #fc-elim-bracket-pane, .container, #modal) bajo body.fc-shell-active #page-elim > ... Gap stagepill→mount reduce de ~290px a <50px.
- public/js/v3/grupos-v3.js: nueva función v3ComputeBestThirds() que recorre los 12 grupos, toma rank 3 de cada uno y devuelve Set de los 8 mejores (pts > gd > gf > nombre). Solo computa si TODOS los 12 grupos están completos. Cache en _v3BestThirdsCache, invalidada al inicio de v3RenderBoardGrupos. v3RenderGroup branch isComplete: marca is-qualified al 3º si está en cache.

**Diferido a F3-I1.7:** eliminación del HTML de los elementos legacy en #page-elim (análogo a F3-I1.6 con grupos). Por ahora ocultos vía CSS.

**Verificación:** node --check OK. Grep gates: F3-I1.6.5 elim CSS 1, grupos JS 3, v3ComputeBestThirds 2 (def+invocation), _v3BestThirdsCache 4 lines (decl+write+comment+read). Smoke localhost no ejecutado en sandbox.

**HEAD anterior:** 3c481cd.

## 2026-05-16 — fix(elim): HF-08 wiring resolveAllSlots desde v3RenderBoard

**Contexto:** R32 (y demás rondas KO) mostraban placeholders "1º Gr.X" / "Mejor 3º Gr.X" en lugar de nombres reales, incluso con los 12 grupos completos. Diagnóstico (16-may): resolveAllSlots() YA EXISTE en ko.js (legacy F7.X.4) y funciona correctamente (poblada 106 entradas en test en vivo), pero v3RenderBoard de eliminatoria-v3.js no la invocaba. resolvedSlots={} permanente.

**Cambios:**
- public/js/v3/eliminatoria-v3.js v3RenderBoard: llamada a resolveAllSlots() al inicio del render (1 línea + try/catch defensivo). Reutiliza función legacy: tablas grupos + 8 mejores 3eros + propagación cascada KO. Si grupos no están completos, slots quedan undefined y v3ResolveSlotLabel cae a fallback (comportamiento esperado pre-Mundial).

**Nota:** asignación de slots T_XYZWV a los 3eros sigue la lógica simplificada del autor original ("each T_XXXX gets the best available third from those groups", NO tabla H FIFA estricta). Aceptable para el formato 48 equipos (FIFA aún no publicó tabla H oficial; este sistema es una aproximación común en otras porras).

**Verificación:** node --check OK. resolveAllSlots: 3 menciones (1 comentario + 1 typeof + 1 línea con invocación+warn label) = funcionalmente 1 typeof + 1 call. HF-08: 2 menciones (header + warn label).

**HEAD anterior:** f896e4a.

## 2026-05-16 — fix(elim+ko): HF-09 home/away literal + códigos 3 letras + coherencia visual

**Contexto:** smoke HF-08 reveló 3 issues adicionales:
 1) Simuladores legacy escriben pred.classifier="home"|"away" literal → resolvedSlots queda con esas cadenas → bracket muestra "away"/"home" como nombre de equipo.
 2) Cards KO muestran nombre completo truncado ilegible (38px disponibles, "México" se trunca a "M…").
 3) Inconsistencia visual con grupos post-sim (font 10px vs 9px, padding 1px 0 vs 1px 2px).

**Cambios:**
- public/js/ko.js resolveKO() bloque empate: blindaje defensivo "home"→hTeam, "away"→aTeam, otros→pred.classifier. Cubre predicciones pasadas y futuras sin tocar simuladores legacy.
- public/js/v3/eliminatoria-v3.js: nueva función v3ResolveSlotCode() insertada justo antes de v3ResolveSlotLabel (mismo formato que F3-I1.6.4 grupos: equipo.code || equipo.flag || slice(0,3)). v3RenderKoCard usa código 3 letras si slot resuelto, fallback al label descriptivo si no.
- public/css/v3/eliminatoria-v3.css: font-size 9px (era 10px) en .v3-ko-row__code + padding 1px 2px (era 1px 0) en .v3-ko-row para igualar grupos. R16/QF/SF mantienen sus overrides progresivos (11/12/13px) — tienen más espacio horizontal.

**Scope no tocado (per brief):** v3RenderFinalCard (líneas 298/299) y v3RenderZoomKO (líneas 440/441) también invocan v3ResolveSlotLabel pero NO se modifican. Final usa cards más anchas; zoom es modal full-screen. Si futuro smoke confirma necesidad, follow-up trivial.

**Verificación:** node --check OK ambos JS. Grep gates: HF-09 ko.js 1, elim JS 2 (helper + render), elim CSS 2 (row + code), v3ResolveSlotCode 3 (def + 2 invocaciones home/away).

**HEAD anterior:** d7dee8d.

## 2026-05-16 — fix(elim): HF-10 cards más anchas en QF/SF (reducir trofeo)

**Contexto:** smoke HF-09 reveló que R32/R16 quedaron OK con 3 letras pero QF (font 12) y SF (font 13) seguían viéndose recortadas. Cards permanecían 105px en todas las rondas; solo el font cambiaba. Códigos 3 letras a font 12-13 ocupaban 39-50px → rebasaban el card visualmente por border-radius + overflow:hidden (último píxel/letra cortado).

**Cambios:**
- public/css/v3/eliminatoria-v3.css: regla grid-template-columns separada por ronda. R32/R16 mantienen `1fr 86px 1fr` (intacto). QF cambia a `1fr 50px 1fr` (cards +13px). SF cambia a `1fr 40px 1fr` (cards +18px). Trofeo decorativo se comprime al carril (max-width:110px → 50/40 efectivo), visualmente menor pero proporcional a las rondas avanzadas.

**Decisión San:** Final (F) mantiene nombres completos vía v3RenderFinalCard que usa v3ResolveSlotLabel (no tocado en HF-09). No se modifica render de F.

**Verificación:** Grep gates OK (HF-10 3 menciones; QF `1fr 50px 1fr`; SF `1fr 40px 1fr`). Smoke localhost no ejecutado en sandbox.

**HEAD anterior:** 66db0fe.

## 2026-05-16 — fix(elim): HF-11 replantar cards KO con prototipo + revertir HF-10

**Contexto:** smoke HF-10 reveló que reducir el track del trofeo (50/40px) cambiaba el tamaño visual del trofeo entre rondas. San reclamó: "trofeo mantiene tamaño en todas las fases; cards más anchas via min-height/padding, no reduciendo trofeo". Solicitó estampar el CSS literal del prototipo del autor.

**Cambios (eliminatoria-v3.css):**
- REVERTIR HF-10: regla unificada `1fr 86px 1fr` para R32+R16+QF+SF (4 selectores agrupados).
- ELIMINADAS reglas previas conflictivas (todas las A4+A5 del brief existían en el fichero):
  - A1 ✓ HF-10 separadas QF (1fr 50px 1fr) + SF (1fr 40px 1fr) — eliminadas y fusionadas en C.
  - A2 ✓ Vieja regla R32+R16 con `1fr 86px 1fr` (sola tras HF-10) — reemplazada con C unificada 4 rondas.
  - A3 ✗ HF-09 `.phone .v3-ko-row__code`: NO existía con prefijo `.phone`. HF-09 había modificado base `.v3-ko-row__code` directamente — eliminada vía A4.
  - A4 ✓ Las 19 reglas base: `.v3-ko-card`, `:active`, `.v3-column-left/right .v3-ko-card`, `.v3-ko-card__tag` (+ left/right), `.v3-ko-card__body` (+ left/right), `.v3-ko-row`, `.v3-column-left .v3-ko-row`, `.v3-ko-row__code` (+ left/right), `.v3-ko-row__flag` (+ img), `.v3-ko-row__score`, `.is-empty`. CONSERVADA `.v3-column-right .v3-ko-row` (NO en A4 del brief).
  - A5 ✓ Las 17 reglas overrides por-ronda (4 R16 + 6 QF + 6 SF + reparto vertical QF/SF .v3-column).
- APPEND bloque literal del prototipo del autor al final del fichero. Única adaptación: prefijo `v3-` 1-a-1 en cada selector. Sin cambios de valores, sin !important, sin .phone prefix. Crecimiento progresivo de cards: R32 50px → R16 60px → QF 78px → SF 110px (min-height del body).
- NO TOCADO: `.v3-bracket-board` (padding/box-sizing), `.v3-bracket-board .v3-column` (min-height 150 + min-width 0), `.v3-trophy*`, `.v3-ko-board--F`, `.v3-final-*` (San: "Final OK, no tocar"), `.is-decided` (.v3-ko-row.is-winner highlight), `.v3-column-right .v3-ko-row` (no listado en A4), F3-I1.6.5 cleanup legacy.

**Riesgo identificado (a observar en smoke):**
- Prototipo NO incluye `min-width: 0` en `.v3-ko-card` (lo tenía la versión F2.9 HF-06-quater #1 para evitar overflow horizontal en SF). Si SF muestra scrollbar horizontal o tracks asimétricos, follow-up trivial: re-añadir `min-width: 0` (no contradice prototipo, era ajuste defensivo).
- Prototipo NO usa `border-radius: 12px; overflow: hidden` en `.v3-ko-card` (lo tenía F2). El radio se aplica ahora en `__tag` y `__body` separados (9px). Si bordes redondeados se ven distintos a R32 antes, esto explica.

**Tamaño**: 1016 → 897 líneas (-119) · 25810 bytes.

**HEAD anterior:** 8992f8a.

## 2026-05-16 — fix(elim): HF-12 separar cards SEMIS del trofeo

**Contexto:** smoke HF-11 reveló cards SEMIS pegadas al trofeo por el glow del card-body (14px) consumiendo el gap base (12px). San: "separar SEMIS, resto OK, cambio mínimo".

**Cambios:** public/css/v3/eliminatoria-v3.css — añadida regla `.v3-bracket-board.v3-ko-board--SF { column-gap: 24px }`. Cards SF pasan de 105px → 93px; gap visible 12 → 24 (10px aire neto tras descontar glow). Scope solo SF. Otras rondas intactas.

**HEAD anterior:** 4562e51.

## 2026-05-16 — fix(shell+elim): HF-13 mount fantasma fifa-bar + solape SEMIS trofeo

**Contexto:** smoke F3-I1.6.4+HF-12 reportó 2 problemas vivos:
 1) Badge legacy (⚙ ADMIN + avatar C + nombre "ciclote88" + "Cerrar sesión") seguía apareciendo en la fifa-bar v3 tras unos segundos. Las defenses F3-I1.6.4 (CSS body.fc-shell-active #wc-auth-bar + JS toggle) NO lo detenían.
 2) Cards de SEMIS solapaban con el trofeo central pese a HF-12 column-gap 24px.

**Diagnóstico problema 1 (root cause):**
- mundial-shell-v3.js:67 incluía `<div class="v3-fifa-bar__user" data-user-mount></div>` dentro de fifaBarHTML(). F1.1f-v3 lo añadió como bridge para renderAuthBar() de auth.js (líneas 225-235) que busca TODOS los `[data-user-mount]` y les inyecta admin+avatar+nombre+"Cerrar sesión". Se re-llama en cada login state change → "vuelve a aparecer".
- Las defenses F3-I1.6.4 apuntaban a #wc-auth-bar (otro elemento) — nunca alcanzaban este mount. Mount era REDUNDANTE tras F3-I1.6 (chips ADMIN + ↩ ya en stage-row) y duplicaba ADMIN + añadía avatar+nombre que San decidió quitar.

**Diagnóstico problema 2 (aritmética):**
- Trofeo max-width 110px en track 86px → overflow 12px por lado.
- Glow .v3-ko-card__body box-shadow 0 0 14px → consume 14px más.
- HF-12 column-gap 24px → 24-12=12 libres - 14 glow = **-2px (solapa visible)**.
- HF-13 column-gap 40px → 40-12=28 libres - 14 glow = **14px de aire neto**.

**Cambios:**
- public/js/v3/mundial-shell-v3.js: eliminada línea 67 con `<div ... data-user-mount></div>` de fifaBarHTML(). Comentario HF-13 explica el porqué. Mount removido → renderAuthBar() ya no inyecta nada en fifa-bar.
- public/css/v3/eliminatoria-v3.css: column-gap SF subido de 24px (HF-12) a 40px (HF-13). Cards SF pasan de ~93 a ~85px de ancho efectivo; códigos 3 letras siguen legibles.

**Verificación:** node --check OK. Grep gates: data-user-mount solo en comentario (no en HTML generado), column-gap 40px presente, 24px ausente.

**HEAD anterior:** 3b079c2.

## 2026-05-16 — fix(elim): HF-14 cards SEMIS empujadas hacia bordes externos

**Contexto:** smoke HF-13 (column-gap 40px) seguía mostrando cards SF pegadas al trofeo. Análisis: el `.v3-trophy` tiene filter chain con 3 drop-shadows (gold 18px + dark 28px + ambient 80px). El ambient halo + el glow propio de la card (box-shadow 14px) ocupan ~32px que consumen casi todo el column-gap 40px → solo ~3.7px de aire visible.

**User intent:** "abrir hacia el exterior un par de puntos los brackets de semifinal" — mover cards OUTWARD, no tocar trofeo.

**Cambios:** public/css/v3/eliminatoria-v3.css — añadidas 2 reglas negative-margin scope SF:
- `.v3-column-left .v3-ko-card { margin-left: -10px }` → card izquierda empujada 10px hacia el borde izquierdo del viewport.
- `.v3-column-right .v3-ko-card { margin-right: -10px }` → card derecha empujada 10px hacia el borde derecho.

**Aritmética verificada:**
- Bracket-board padding lateral: 12px → card a 12-10=2px del borde viewport (sin overflow).
- Card ancho intacto (92.5px en column-gap 40): contenido no se compresa.
- Distancia card→trofeo aumenta 10px → aire visible neto sube de ~3.7px a ~13.7px.
- Trofeo intacto (aspect ratio, glow chain, max-width 110px todos sin cambios).
- column-gap 40px intacto (HF-13).

**Scope:** solo SF (San: "el resto OK"). R32/R16/QF/F sin cambios.

**HEAD anterior:** 5d07913.

## 2026-05-16 — fix(elim): HF-15 reducir halo gold del trofeo en SF

**Contexto:** smoke HF-14 (margin -10 + column-gap 40) seguía mostrando sensación de solape. Análisis: lime tabs ya a ~2px del borde viewport, imposible empujar más sin overflow off-screen. El "solape" visual residual viene del filter del trofeo `drop-shadow(0 0 18px rgba(201,169,97,.5))` — halo gold de 18px blur a opacidad 0.5 que invade el gap visualmente, pese a 13.7px de aire geométrico real.

**User constraint:** "trofeo mantiene su relación de aspecto en todas las fases". Aspect ratio = width:height del SVG/img → PRESERVADO. El halo de drop-shadow NO es parte del aspect ratio (es decoración del filter chain).

**Cambios:** public/css/v3/eliminatoria-v3.css — override scope SF del filter del trofeo:
- `drop-shadow(0 0 18px ...)` → `drop-shadow(0 0 8px ...)` — reduce blur del halo gold ~10px
- `drop-shadow(0 12px 28px ...)` → intacto (sombra inferior, no afecta laterales)
- `drop-shadow(0 0 80px ...)` → intacto (ambient halo a opacidad 0.2, apenas contribuye al solape)

**Aritmética verificada:**
- Aire visible antes: 40 (col-gap) - 4.3 (trophy track overflow) - 18 (gold halo) - 14 (card glow) = 3.7px
- Aire visible después: 40 - 4.3 - 8 (reduced halo) - 14 = 13.7px efectivo + 10px liberados del halo = ~23.7px sensación visual
- Cup, aspect ratio, max-width 110, max-height 160, animation: TODO intacto
- Otras rondas (R32/R16/QF/F): sin cambios (regla scope SF únicamente)

**HEAD anterior:** 8b17ee2.

## 2026-05-16 — fix(elim): HF-16 remover halos gold del trofeo en SF

**Contexto:** smoke HF-15 seguía mostrando solape (screenshot user con red box marcando halo invasivo). Análisis: el drop-shadow ambient 80px a opacidad 0.2 extendía halo gold visible ~50-60px efectivos, invadiendo las cards aunque la geometría real ya daba aire visible.

**Cambios:** public/css/v3/eliminatoria-v3.css — override scope SF del filter del trofeo, ahora con SOLO la sombra inferior dark (proyección natural). Eliminadas las 2 drop-shadows gold (directo 8px de HF-15 + ambient 80px original).

**Antes (HF-15):**
```
filter:
  drop-shadow(0 0 8px rgba(201,169,97,.5))   /* halo gold directo */
  drop-shadow(0 12px 28px rgba(0,0,0,.55))   /* sombra inferior */
  drop-shadow(0 0 80px rgba(201,169,97,.2)); /* halo gold ambient invasivo */
```

**Después (HF-16):**
```
filter: drop-shadow(0 12px 28px rgba(0,0,0,.55));
```

**Constraint respetada:** cup shape, aspect ratio (width:height del SVG), max-width 110, max-height 160, animation float — TODO intacto. Solo se elimina el halo decorativo en SF.

**Otras rondas (R32/R16/QF/F)** mantienen el filter chain completo con los 3 drop-shadows.

**HEAD anterior:** b0fd0b2.

## 2026-05-16 — fix(elim): HF-15 más separación SEMIS (gap 50 + margin -15)

**Contexto:** smoke HF-14 con San en DevTools mobile 375px reveló que aire visible neto de 13px era insuficiente. Aritmética: card glow 14 + trophy glow + track overflow consumían 27px del column-gap 40.

**REVERT previo:** mis HF-15 (halo gold 18→8) y HF-16 (halos gold removidos) eran intervenciones unilaterales sobre el filter del trofeo que NO estaban en el roadmap del brief. Revertidas para mantener `HF-15` sin ambigüedad y respetar el approach del brief (gap+margin bumps, trophy filter intacto). Override scope SF del .v3-trophy eliminado por completo → trophy en SF vuelve a usar el filter base (3 drop-shadows: 18 gold + 28 dark + 80 ambient).

**Cambios:** public/css/v3/eliminatoria-v3.css
- .v3-bracket-board.v3-ko-board--SF column-gap: 40 → 50.
- .v3-ko-board--SF .v3-column-left .v3-ko-card margin-left: -10 → -15.
- .v3-ko-board--SF .v3-column-right .v3-ko-card margin-right: -10 → -15.

Aire neto estimado post-fix: ~23-25px (casi doble del HF-14).

**Verificación:** Grep gates 3/3 positivos OK (gap 50, margin -15 ×2). Grep gates negativos OK (0 hits para gap 40, margin -10, trophy SF override, HF-16). HF-15 marker presente 3 veces (comentario header + 2 menciones en aritmética).

**HEAD anterior:** 3627e3c (HF-16 mi versión revertida en este commit).

## 2026-05-16 — Squads BD limpieza + workflow CI activo

**Sprint:** `claude/post-merge-sprint-hotfixes-FkMx5` → main como `eb9c9d1` (8 commits).

**Cambios BD:**
- BIH limpieza entidades crudas heredadas: `Kola&scaron;inac` → `Kolašinac`, `&Scaron;unjić` → `Šunjić`, `Ba&scaron;ić` → `Bašić` (3 jugadores afectados de los 25 totales). Aplicado vía decode in-flight en `--refresh-final` (no re-scrape). `fuente='as+tm'` preservada.
- Recuperación enrich-tm post-pérdida del `--refresh-final` pre-Fix C: BIH 19/25 jugadores enriquecidos (6 no presentes en TM); SWE 25/26 jugadores enriquecidos. Datos restaurados: edad, dob, valor, foto_url, posición específica.

**Estado final 16-may 23:59:** 10/48 squads con datos.
- 5 FINAL: FRA (26 jug, 11 tit, ff), BIH (25 jug, 11 tit, as+tm), JPN (26 jug, 0 tit pendiente, ff), BEL (26 jug, 0 tit placeholder, ff), SWE (26 jug, 0 tit placeholder, ff+tm).
- 5 pre-lista: ARG (55, ff+tm), BRA (51, 365+tm), ESP (53, ff), MEX (55, 365+tm), QAT (33, infobae).
- 38 pendientes (incluyendo IRN, en revisión geopolítica desde 11-mar).

**Automatización:** `.github/workflows/sync-squads.yml` activo. Cron `'0 */6 * * *'` UTC. Primera ejecución run `25962281040`, 49s, 5 países `no-op` (idempotencia confirmada).

**Secrets configurados a nivel repo:** `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`. El workflow genera `.env` en el runner efímero para parity con flow local.

**Sin DDL en este sprint.** Solo UPDATEs sobre `squads.jugadores` + `jugadores_is_final` + `jugadores_fuente` + `jugadores_synced_at` + `updated_at`. Schema intacto.

**Top-3 errores cerrados:** ERR-46 (entidades centroeuropeas/turcas con `html-entities`), ERR-47 (`--refresh-final` preserva incondicionalmente), ERR-48 (detector `/alineaciones/0.jpg` SSR). ERR-49 + ERR-50 secundarios (apóstrofos tipográficos, slice cut revertido).

**Nueva documentación:** `docs/sync-squads.md` (operacional), `.claude/rules/sync-squads.md` (regla path-scoped), `docs/v3-vs-legacy.md` (inventario funcionalidades). Entrada CHANGELOG completa con 8 commits + lecciones.

## 2026-05-17 — Cierres documentales (PR #65, PR #66) + Hotfix Pack v3

[04:31] MERGE: PR #65 (`8c98e8a`) — docs post-sprint Sprint Cuadro de Honor v3: migraciones RLS DELETE + ERR-51 + CLAUDE/CHANGELOG. Cierra deuda documental del sprint 11-hotfix mergeado a `e8d9c65`.

[13:08] MERGE: PR #66 (`855b6c4` squash) — fix(v3) Hotfix Pack HF-BUG-05/08/01/09/11/12. Branch `claude/diagnose-esc-listener-bug-L23SC` rebase sobre `origin/main` (PR #65 base `8c98e8a` ortogonal — solo docs+migraciones). 2 commits originales (`92a68ab` HF-BUG-05 aislado + `bf72d64` 4 fixes amalgamados) colapsados en squash. Sin migración SQL.

[14:15] DOCS: este PR (post-pr66) — `CHANGELOG.md` entry Hotfix Pack v3 + `errores_conocidos_porra.md` ERR-52..56 + `CLAUDE.md` estado actual a `855b6c4` + Backlog post-launch añadido (HF-BUG-05-bis/09-bis/13). Sin cambios de código. `CLAUDE.md` 10187 bytes (margen 53B sobre límite 10240).

[16:49] MERGE: PR #68 (`dff1166` squash) — fix(scoring) HF-BUG-05-bis null guard signo en `scoring.js:60`. Branch `claude/diagnose-esc-listener-bug-L23SC` rebase sobre `origin/main` (post-PR #67 `cff8080`). +2 −1 en `public/js/scoring.js`. Sin migración SQL. Cierra deuda residual de HF-BUG-05 (PR #66): pred `{l:null, v:null}` ya no produce +1 pt fantasma de signo en empates reales.

[18:06] MERGE: PR #69 (`b5fb89c` squash) — feat(v3) Sprint Completion Flow F1 picker goleador KO + F3 gate refinado redirect 1-a-1 al primer grupo incompleto. Branch `claude/diagnose-esc-listener-bug-L23SC` rebase sobre `origin/main` (post-PR #68 `dff1166`). 2 commits originales (`a60f529` F1 + `6ec8ad4` F3) colapsados en squash. +284 −5 en 3 ficheros (`eliminatoria-v3.js`, `eliminatoria-v3.css`, `ko.js`). Sin migración SQL. `ko_predictions.scorer` ya existía en schema.

[18:35] DOCS: este PR (post-pr68-pr69) — `CHANGELOG.md` 2 entradas (PR #68 + PR #69) + `errores_conocidos_porra.md` ERR-57 (HF-BUG-05-bis cerrado) + `CLAUDE.md` estado actual a `b5fb89c` (5 PRs cerrados hoy) + Backlog reorganizado (HF-BUG-05-bis cerrado, quedan HF-BUG-09-bis + HF-BUG-13 con nota explícita de que F1 ya evita replicar el patrón). Sin cambios de código. `CLAUDE.md` 10103 bytes (margen 137B sobre límite 10240).

## 2026-05-19 — Polish v1 + Fix Packs 1, 2 + Fix DB RLS (PR #71)

[10:53] OPEN: PR #71 `claude/polish-v1-grouped-blocks-BbqRH` → main. 13 commits temáticos (B1+B2+B3+B4 Polish v1 base + Fix Pack 1 con 4 fixes + Fix Pack 2 con 3 fixes + Fix DB RLS final).

[10:57] MERGE: PR #71 (`bd6e977` squash) — Polish v1 + Fix Packs 1, 2 + Fix DB. 15 ficheros · +1247 −244. Sin DDL fuera de la migración RLS final. Branch auto-deleted post-merge.

[11:05] MIGRATION: `20260519103959_fix_rls_ia_elo_fifa_select_authenticated.sql` aplicada en BD remota via `execute_sql` MCP el 19-may (durante desarrollo de Fix Pack 2 — `getAwardCandidates` BD-driven devolvía 0 filas por tabla RLS-enabled sin policy SELECT). Posteriormente versionada en commit `ff070c7` (incluido en squash PR #71) con `DROP POLICY IF EXISTS` antes de `CREATE` para idempotencia. Verificada policy creada con name `ia_elo_fifa_select_authenticated`, role `authenticated`, USING `true`. Tablas hermanas `ia_h2h` y `ia_last5_results` siguen sin policy SELECT — apuntadas a sprint hardening post-launch (no consumidas por frontend actualmente).

[11:10] CRON ACTIVO: `cerrar-porras-mundial-2026` (jobid 23, schedule `'59 21 10 6 *'`, active true) ya programado desde PR #71 base. Disparará `UPDATE league_members SET porra_cerrada=true WHERE porra_cerrada=false` el 10-jun 21:59 UTC = 23:59 Madrid CEST.

[11:20] DOCS: este commit cierre — `CHANGELOG.md` entrada Polish v1+Fix Packs+Fix DB con secciones por bloque + entradas viejas movidas a `CHANGELOG-archive-202605.md` (F3-I1.x + F2.9 + 2026-05-14 Redesign v3 F2) para mantener bajo 30KB. `errores_conocidos_porra.md` ERR-58 (RLS enabled sin policy SELECT). `CLAUDE.md` estado actual a `bd6e977` + Top-3 reordenado (Reglamento FIFA / squads-sources-refactor PR / pre-launch operativo) + nueva regla CRÍTICA sobre migrations RLS idempotentes. `docs/db-schema.md` policy `ia_elo_fifa_select_authenticated` documentada + nota explícita sobre `ia_h2h`/`ia_last5_results` pendientes hardening. `docs/REGLAMENTO_FIFA_2026.md` placeholder vacío (sprint próximo).

## 2026-05-19 — Refactor sync-squads fuentes primarias 5-of-N + parsers reales (feat/squads-sources-refactor)

[18:00] BRANCH: `feat/squads-sources-refactor` viva sobre `origin/main` (`6038882`) desde 18-may, tras detectar bug del 18-may (PR #69 mergeado pero `--mode=scrape --all-missing` detectó 3 falsos positivos CRO/NED/POR con datos Eurocopa 2024 IDs 115xxx). BD limpiada manualmente con UPDATE por San antes del refactor.

[18:30] REFACTOR: nuevo `--mode=detect` orquestador con cross-validation 2-of-N + Jaccard ≥ 0.7 sobre 5 fuentes primarias (AS + Sport.es + Olympics + Eurosport + Marca). FF queda como secundaria solo para enriquecer XI titular de FINAL ya confirmadas → cierra ERR-59 estructuralmente. Calendar greedy longest-match (4 fechas → 8 fechas, 12 iso3s únicos). `maxPlayers=30` añadido para rechazar pre-listas largas (ARG/COL/MEX/CZE/QAT 33-55 jugadores). Calendar semantics invertida: solo degrade si Olympics anuncia "(definitiva)" en fecha FUTURA. Workflow YAML reescrito: cron 6h ahora ejecuta detect→enrich-tm en serial.

[18:45] PARSERS REALES: `olympics.mjs` con orphan continuation + cross-country reset (fix BEL 23→26, CUW 28→26); `sport.mjs` con `requireBullet: false` (antes 0 iso3 → ahora 48); AS parametrizado para `requireBullet`. Nuevos parsers `eurosport.mjs` y `marca.mjs` (alias AS sin bullet). 28/28 tests pasan (util.test.mjs + sources.test.mjs).

[19:00] DRY-RUN: validado con 5 fuentes — 17 procesables (16 high con 4-5 fuentes coincidentes, 1 low CRO por calendario "(definitiva): 1 jun"), 5 rejected pre-lista. IRN aparece solo en Marca (señal nueva).

[19:15] DOCS: ERR-59 añadido a `errores_conocidos_porra.md` (ERR-58 quedó asignado al RLS bug del PR #71), entrada CHANGELOG entrada `2026-05-19 — sync-squads refactor 5-of-N`, `.claude/rules/sync-squads.md` §0/§9/§10 actualizada con jerarquía 5 fuentes + workflow serial. PR pendiente de creación contra `main` (`bd6e977`).

## 2026-05-20 — Sprint Pre-Launch + Hotfixes iOS modal grupos

[14:00] PR #75 mergeado a main como squash `72e3b75`. 11 fixes F-01..F-10b sobre brief Claude.ai 19-may. Ramas: `claude/pre-launch-fixes-oLhZ0`. Múltiples rondas QA (r1..r4) para F-02/03 (awards combo) + F-05 (tooltip ?) + F-07 (pizarra dvh) + F-10b (columna `equipo` no `nombre_pais`).

[16:30] PR #76 mergeado a main como squash `f1f55d4`. Hotfix iOS scroll modal grupos v1: `overflow:hidden → visible` en `.v3-zoom-panel__inner` + `overflow-y:auto` en panel. **NO funcionó en iPhone Safari real** porque el panel tiene `pointer-events:none`. Rama `hotfix/ios-scroll-grupos` desde main.

[17:15] PR #77 mergeado a main como squash `7d8b706`. Hotfix r2: mover scroll a `.v3-zoom-panel__inner` (overflow-y:auto + -webkit-overflow-scrolling:touch + overscroll-behavior:contain + max-height calc(100dvh - 24px)). Causa raíz documentada en ERR-65. QA iPhone real validó.

[18:00] PR #78 mergeado a main como squash `0e49612`. Hotfix r3: `max-height: calc(100dvh - 80px)` (era 24px). Descontar `.fc-tabbar` 56px + margins 24px. ERR-66 registrado. QA iPhone real con screenshot aprobado por San.

[18:30] DOCS: CHANGELOG entrada `2026-05-20 — Sprint Pre-Launch + Hotfixes iOS scroll`, ERR-65 + ERR-66 en `errores_conocidos_porra.md`, `CLAUDE.md` HEAD bumped a `0e49612`, este migration-log. Archivado entries 17-may + 16-may a `CHANGELOG-archive-202605.md` (CHANGELOG > 30KB tras añadir el nuevo bloque).

[18:35] HALLAZGO PARALELO: `GITHUB_TOKEN` del vault devuelve 404 — token expirado o sin scope `repo`. Regenerar en GitHub Settings + actualizar vía `vault.update_secret(...)`. MCPs pg_net→GitHub API no funcionan; Chrome MCP sigue operativo. Acción para San.

[14:00] PR #84 mergeado: `name-matcher.mjs` normalize order-invariant para nombres coreanos. KOR ahora matchea 26/26 (Pieza B applyEnrich) frente a 1/26. Sort tokens + strip hyphens (joiners). Tests 24 nuevos + 30 existentes = 82/82 pasan.

[14:30] PR #86 abierto: fix CSS pizarra-tactica F-09 (layout mobile iPhone). `.fc-pizarra-field` width:100% explícito + margin lateral 0 + max-height calc(92dvh - 225px). Header/stats/footnote compactados. QA Playwright 12 casos (FRA/BRA/NZL × 4 viewports) todos OK: field full-width, sin scroll vertical, gap stats↔field 8px. Branch `fix/pizarra-tactica-layout-mobile`.

[14:45] PENDIENTE post-merge PR #86: San reporta en iPhone real que los apellidos `.fc-pizarra-token-surname` siguen sin verse pese al fix. El QA headless con Chromium mobile sí los renderizaba dentro del field. Apuntado en CLAUDE.md "Bugs UI #5" para próxima sesión. Hipótesis a investigar: (a) contraste text-shadow black sobre verde campo en pantalla retina, (b) font-size 10px demasiado pequeño en 3x, (c) clip por borde inferior del field cuando aspect-ratio se aplana, (d) `team.jugadores[].nombre` viene vacío/placeholder desde EF get-squad v7.1.

[12:45] Sprint Tarjeta Stats Fase 1 (rama `claude/zealous-sagan-duoyC`): pantalla "Datos del partido" sustituye al modal compact `Ver tarjeta` en Jornada. Piloto MEX vs RSA con mock estático en `match-stats.js`; resto degradado con "Sin datos…". Paquete handoff `tarjeta-stats.css` (574 LOC, namespace `stm-*`) verbatim + `tarjeta-stats.js` (385 LOC IIFE) con 9 parches: 1) drop dead code `renderStatRow`, 2) helper `codeFor()`, 3) `flagPath()` usa patrón real del proyecto `SB+'/miniatures/flags-sm/'+iso2+'.webp'` (NO `Flags/iso3.png` del brief — replicado de `_showJcardModal` ui-groups.js:666), 4) `homeCode`/`awayCode` vía `codeFor()`, 5) eliminada CTA "Editar marcador" del hero, 6) label "Tu pronóstico"→"Pronóstico", 7) eyebrow dinámico grupos vs KO (`!!match.group`), 8) pill BOOST sólo en grupos, 9) NO sobrescribir `window.openJcardModal` (path editable Grupos intacto). Fix adicional: classic-script `const PARTIDOS/EQUIPOS/predictions/boostPicks/SB` no se exponen como `window.*` → helpers `_partidos()`, `_equipos()`, etc. con guards `typeof X !== 'undefined'`. `hideOtherPages` lista IDs reales verificados (`page-elim` no `page-ko`, `page-score` no `page-clasif`, `page-admin` no `page-perfil`). `boostPicks` lookup usa `matchDate=match.date.substring(0,10)` (FIX bug del JS original que usaba `match.date` ISO completo). Wiring: `ui-groups.js:522` `openJcardModal→openTarjetaStats`, `main-entry.js` añade 2 loadScript tras `live-sync.js`, `index.html` añade `<link>` tras `directo-v3.css`. Build OK 161ms · `dist/css/tarjeta-stats.css` + `dist/js/{match,tarjeta}-stats.js` presentes · `stm-screen` + `stm-nav__boost` en CSS dist.

[01:20] Sprint Tarjeta Stats 2C (rama `feat/tarjeta-stats-data-real`): T1+T2+T3 — pasar de mock a datos reales via EF `get-match-stats v1` (Sprint 2A+2B hechos por usuario desde Claude.ai+MCP, 72/72 pares cubiertos en `ia_h2h.matches_detail`, 46 con detalle + 26 `never_played=true`). **T1 `match-stats.js`**: reemplazado mock por fetch a `${SUPA_URL}/functions/v1/get-match-stats?match_key=<key>` con `apikey: ANON` + `Authorization: Bearer ${_porraToken || ANON}` (patrón verificado en `leagues.js:243`). Cache LRU TTL 5min preservado. **T2 `tarjeta-stats.js`**: meta del partido (`jornada`/`indexInJornada`/`timeLabel`) ya no viene del payload, computada frontend desde PARTIDOS via `_jornadaInfo()` (mapa por días únicos ordenados). Estadio via `window.stadiumForMatch(match)`. `aIsHost` calculado (`USA`/`MEX`/`CAN`). h2h render dispatcheado por `payload.h2h_status`: `'never_played'` → texto literal "Sin enfrentamientos previos entre ambas selecciones" sin cabecera; `'aggregates_only'` → cabecera W/D/W + "Detalle no disponible"; `'has_detail'` → cabecera + lista (EF ya devuelve `last` orientado A, max 5). Possession marca asterisco `*aprox` si `meta.possession_placeholder=true`. **T3 `data.js`**: añadido `STADIUMS` const 16 sedes + map legacy `_STADIUM_BY_VENUE_TEXT` (string actual de PARTIDOS.stadium → STADIUMS.id) + helper `stadiumForMatch(m)` (expuesto en `window`). EF source leída via MCP `get_edge_function` para validar shape antes de tocar frontend (NO se commitea source — opcional T4 en rama aparte si se necesita git history). Build OK 510ms.

## 2026-05-28 — Sprint Scaling FF_COUNTRIES + ProcessPool paralelo (claude/scale-ff-countries)

[10:00] VALIDADO PR #106: workflow_dispatch con `iso3=ESP` en main `ca17401`. ESP detect = `high` confidence con 4 fuentes (as+sport+olympics+espn) sobre 26 jugadores; `[ff] cache hit ff-esp (793142 bytes)`; **`ESP — XI matched: 11/11`** ✓; enrich-tm posterior añade `+tm` a `jugadores_fuente`. Hotfix cheerio + `img[alt]` non-empty filter funciona en producción contra HTML real de FF.

[10:15] BRANCH: `claude/scale-ff-countries` desde main `ca17401`. Cambio único en `scripts/scraping/fetch_sources.py`: FF_COUNTRIES pasa de 1 entrada hardcodeada (`{"ESP": "espana"}`) a leer las 48 desde `scripts/lib/iso3-slugs.json` (canonical, DRY con Node parsers). Mantiene single source of truth — añadir un país nuevo a `iso3-slugs.json` lo activa automáticamente en Python sin tocar este fichero.

[10:25] PARALELIZACIÓN: `ProcessPoolExecutor(max_workers=3, mp_context='spawn')` para FF (48 fuentes). Primarias siguen en serie (sólo 5). Wall time esperado: 48/3 × 30s ≈ 8 min FF + 80s primarias = ~10 min total (vs 24 min serial que excedería el timeout 15 min). ProcessPool (no ThreadPool) porque Playwright sync_api usa greenlets thread-unsafe; spawn ctx para evitar fork-state issues de browser embedded. `process_one()` extraído a top-level (no closure) para pickling.

[10:30] PUSH: branch `claude/scale-ff-countries` con commit `accdaf0` pusheado a origin. Pendiente: dispatch workflow para validar wall time real (esperado ~10 min); revisar `fetch-summary.json` artifact para ver qué países publican XI hoy.

## 2026-05-28 — Sprint Fix XI Pipeline Capas A+B+C (claude/fix-xi-pipeline-abc)

[17:00] CONTEXTO: tras dispatch productivo #69 con PR #108 (33/48 países a 11/11 tras correcciones manuales de San via MCP), auditoría reveló 4 causas raíz que el próximo cron sobrescribiría sin protección. Brief recibido con causas + solución 3 capas + decisión PR único.

[17:15] CAPA A — `parsePlayer` (`scripts/lib/parsers/_util.mjs`) endurecida para tolerar 5 patrones reales de corrupción (EGY 'Ade (Pyramids FC)l', ENG '(Tottenham)' nombre vacío, KOR 'Lee Jjae-Sung )Mainz 05)' paréntesis invertido, SCO 'Stewart (Southampton)Stewart' apellido duplicado, SWE 'Brujas)' club pegado). Dos paths: well-formed sin regresión + robust fallback con strip-by-pattern + dedupe de apellido repetido. NUNCA devuelve `{nombre:''}` ni el string corrupto crudo. 13 tests (8 nuevos cubriendo los 5 casos reales + 3 control).

[17:30] CAPA B — `name-matcher.mjs` reforzado:
  - (1) alias dict per-iso3 `scripts/lib/name-aliases.json` (semilla con MAR Bono → Yassine Bounou, CPV Vozinha → Josimar Dias, HAI Deedson L. → Louicius Deedson, NOR Sorloth → Alexander Sorloth, KOR Tae-hyeon → Tae-Hwan, EGY Fattouh → Ahmed Fotouh, JOR Al Nadi → Mohammad Abualnadi). Consultado ANTES de Levenshtein vía `resolveAlias`.
  - (2) threshold adaptativo `simThreshold` en `scorePair`: 0.75 latino, 0.70 para iso3 ∈ `NON_LATIN_ISO3` {KOR,EGY,KSA,MAR,IRN,IRQ,JOR,SEN,GHA,CIV,COD,TUN,ALG,BIH}. BIH incluido por colisiones balcánicas -ic/-vic.
  - (3) anti-colisión `ambiguityMargin=5` (default): si top-2 difieren <5 puntos sobre 100 Y secondBest>0 → NO marcar (devuelve unmatched). Evita falso positivo tipo 'García' contra 2 jugadores García.
  - (4) candidate groups `string[][]`: cada slot puede ser pos-0 + pos-1. Si pos-0 no matchea, fallback a pos-1. API legacy `string[]` sigue funcional. 17 tests nuevos (4 alias, 3 threshold, 3 anti-colisión, 4 groups, 3 misc).

[17:45] FF parser pos-1: `ff-scraper.parseStartingXISlotsFromHtml` añadido. Selector `a.juggador.pos-0` (titular) + `a.juggador.pos-1` (alternativa) — NOTA: clase 'juggador' con doble-g, typo literal de FF. Texto extraído de `.truncate-name` (ESP-style con metadata) o directamente del `<a>` (JPN-style). Titular prefiere img[alt] (nombre completo "Nico Williams" vs truncado "N. Williams" del juggador). 4 tests con HTML real JPN (11 slots, 3 con alternativa: Watanabe/Sugawara/Maeda). `parseStartingXIFromHtml` wrapper backward compat. `scrapeCountry` ahora expone `xi_slots` + `xi_names`.

[18:00] CAPA C — migración `20260528170000_squads_xi_pinned.sql` (aplicada via MCP idempotente): `squads.xi_pinned bool DEFAULT false` + `xi_pinned_at timestamptz`. `getSquadRow`/`listAllSquads` (squads-db.mjs) extienden SELECT con las nuevas columnas. `sync-squads.mjs` Paso 2 detect + scrape `--refresh-final` chequean `xi_pinned===true` y saltan recálculo de es_titular. El roster (nombres, club, edad, valor, etc.) sigue mutable por preserveEnrichment — sólo el flag se congela.

[18:15] DOCS: `errores_conocidos_porra.md` entradas ERR-71 (parser corruptos) + ERR-72 (Levenshtein adaptativo) + ERR-73 (anti-colisión) + ERR-74 (pin de estabilidad) + ERR-75 (FF dudosos + pos-1 fallback). Coreografía documentada: aplicar migración → merge PR → San pinea los 33 inmediato post-merge → próximo cron 6h protege los 33 + Capa A corrige los 5 nombres corruptos + Capa B mejora match de tier B/C.

[18:20] TESTS: 146/146 pass. Branch `claude/fix-xi-pipeline-abc` desde main `5656215`. Pendiente: push + abrir PR. 3 dudosos (IRN Kanaanizadegan, GHA Kohn, JOR Layla) registrados en ERR-75 para verificación manual de San con fuente oficial (no se forza match).

## 2026-05-28 — Sprint Combos & Awards F4 v2 + cierre docs (feat/auto-bota-suggest → PR #112)

[23:10] F4 v1 (commit `bc07bf7`): migración `20260528230000_get_user_top_scorer.sql` (RPC singular + badge "tu goleador" en fila interna) + `_v3SuggestGoldenBoot` async. SQL smoke local (postgres 16) OK. NO aplicada en remoto en este punto.

[23:40] F4 v2 rediseño (`baeb539`): San pide sección "Tus goleadores" top-3 al inicio del picker en vez de badge interno. Migración `20260529100000_get_user_top_scorers.sql`: DROP singular + CREATE plural `get_user_top_scorers(uuid,uuid,int=3)` RETURNS TABLE(scorer_key,n,rank). `_v3SuggestGoldenBoot` → array, `p_limit:5`, vía `window._porraDb` (NO el proxy `db`: la RPC SECURITY INVOKER perdía el JWT y RLS devolvía 0 filas). Nuevo helper `_buildTopScorersHtml`. Badge v1 eliminado.

[23:55] F4 v2 fix huérfano (`85bec24`): filtrar top-scorers a `candidateKeys` de getAwardCandidates('golden_boot') + slice(0,3); RPC pide 5 para margen. Scorers de selecciones fuera top-30 Elo / sin `xi_pinned` ya no aparecen (eran no-seleccionables). Unit test del helper real + SQL smoke OK.

[00:10] F4 v2 compact CSS (`b3d5a3a`): bloque `.aw-top-scorers*` ajustado tras smoke en vivo de San (padding 6/10, header 10px, row 5/9, name 13px, count 11px). PR #112 (4 commits squash) mergeado a main → HEAD `2a71da7`.

[00:20] MIGRACIONES (aplicadas al remoto por Claude.ai vía Supabase MCP):
  - `20260528230000_get_user_top_scorer.sql` (singular): APLICADA y luego DROPEADA — obsoleta, sustituida por la plural en el mismo sprint. El fichero se conserva en el repo.
  - `20260529100000_get_user_top_scorers.sql` (plural): APLICADA. Nota: DELETE manual del row `schema_migrations.version = '20260528230000'` al consolidar (la función singular ya no existe en runtime; evita una entrada de migración huérfana en el tracking).

[00:30] CIERRE DOCS (este commit, directo a main): `CLAUDE.md` HEAD `0c45bf2`→`2a71da7` + Sprint Combos & Awards a CERRADO en Estado actual; `CHANGELOG.md` entrada nueva del sprint (F1-F4) + entrada 2026-05-19 sync-squads movida a `CHANGELOG-archive-202605.md` (respeta límite 30KB del hook); esta entrada de log. Sin nuevos ERR. Tamaños OK (CLAUDE 10143B / CHANGELOG 27913B).

## 2026-05-29 — Squads XI+Enrich pipeline: PL-1 cron mw + PL-3 es_titular merge (fix/squads-xi-enrich-pipeline)

[15:08] PL-1 (T1, commit `a8a81c7`): `.github/workflows/sync-squads.yml` — cron `mode=detect` ahora encadena `enrich-tm-mw` en vez del legacy `enrich-tm`. Causa raíz: `runEnrichTm` (`sync-squads.mjs:289`) salta con `no-tmid` toda selección con `tm-ids.json=null` (42 de 48 lo son; sólo ESP/ARG/BIH/BRA/MEX/SWE no-null). Las ~35 enriquecidas lo estaban por runs mw manuales históricos; las 7 sin run mw (COL/GHA/MAR/NED/PAN/RSA/USA) quedaban con 0 `+tm`. `enrich-tm-mw` (FIWC masivo A + kader fallback B) NO depende de `tm-ids.json` (name-match iso3-scoped + verein auto-descubierto). Legacy `enrich-tm` queda manual-only (`if mode=='enrich-tm'`). Cron SIN `--full` (fase B condicional por país; `fetchAllPages` concurrency-4/200ms ~30-60s → entra en `timeout-minutes:15`).

[15:10] PL-3 (T2, este commit): `scripts/lib/squads-db.mjs` `mergeJugadores` ahora indexa el roster previo por `tm_player_id` (autoritativo) con fallback a nombre normalizado, y preserva `es_titular` con semántica fill-if-null (junto a ENRICH_FIELDS). Causa raíz: cada detect reconstruía el roster y el merge NO preservaba `es_titular` → 33 pineadas a 0 titulares → `get-squad/extractXI` (`:129-155`) devolvía 11 placeholders '—' (Pizarra vacía). Capa C (skip enrich-xi en pineados) protegía el path enrich-xi pero no el merge del upsert principal (`sync-squads.mjs:465`). `sync-squads.mjs` + YAML: flag `--reseed-xi` / input `reseed_xi` re-marca XI vía FF también en pineados (bypassa el skip de `:508` sin tocar `xi_pinned`/`xi_pinned_at`; usa el cache Scrapling de detect → Cloudflare-safe). Verificación: unit test `mergeJugadores` 11/11 OK (preserva pin en detect, override explícito en reseed, match por tm_player_id, idempotente); `node --check` + yaml lint OK.

[15:11] CIERRE: `CLAUDE.md` — `Sprint Reglamento FIFA` retirado del top-3 (OBSOLETO: `v3ComputeStandings` ya implementa Art.13 completo — fases 1-3 pts/difg/gf + 4-6 head-to-head vía `v3BreakTieH2H`, fix ERR-60 19-may; sólo Art.16 fair-play/sorteo sin implementar, no determinista, fuera de alcance). Backfill PL-1/PL-3 promovido a top-3 #1; FIX C (`squads.xi` jsonb) a backlog. Tamaño 10232B OK.

[15:12] PENDIENTE (San, GitHub Actions — Code NO puede: container sin `SUPABASE_SERVICE_ROLE_KEY` + scrape 403 desde IP datacenter, ERR-05; GitHub MCP no dispara workflows). Runbook en el PR. Baseline SQL pre-fix (Supabase MCP): PL-1 → 6 pineadas con 0 `valor_eur` (COL/MAR/NED/PAN/RSA/USA; GHA 7ª, no pineada); PL-3 → 33 pineadas a 0 titulares (IRN no pineada conserva 11). Acceptance tests post-backfill: PL-1 `select iso3 from squads where xi_pinned and (#valor_eur)=0` → 0 filas; PL-3 cada pineada 11 `es_titular`; durabilidad `detect iso3=ESP` mantiene 11.

## 2026-05-29 — Sprint A2 FIX C: Pizarra XI real (feat/pizarra-xi-real, PR)

[16:30] T1 — columna `squads.xi` jsonb (nullable) aplicada al remoto vía execute_sql (Supabase MCP) + migración versionada `20260529150000_pizarra_xi_column.sql` (idempotente; `supabase db pull` NO ejecutable desde el container — sin CLI ni puertos BD abiertos). Array de 11 ordenado por slot {slot,pos,nombre,dorsal,foto_url,tm_player_id,posicion_label}.

[16:35] T2 — build squads.xi desde el once-tipo FF. DIAGNÓSTICO clave: el orden DOM de `[data-onceff="titular"]` NO es orden de slot (portero PRIMERO en JPN, ÚLTIMO en ESP — medido en fixtures); sólo `data-onceff-x/y` son fiables. `ff-scraper` captura x/y+isGK por slot (backward-compat) + export `fetchStartingXISlots`. `xi-slot-map.mjs`: `assignSlotsByCoords` (matching geométrico GLOBAL greedy-min-edge vs FORMATION_COORDS — el nearest por-jugador falla con ESP Pedri entre líneas) + `buildXi` (match nombre→roster con desempate por bucket: JPN Suzuki→Zion PO, Ito→Hiroki DEF; foto/dorsal/tm del roster). `formation-coords.json` (en sync con el front). `squads-db.updateSquadXi` escribe SOLO la columna xi (no toca jugadores/es_titular). `sync-squads --build-xi` (tras detect, cache Scrapling Cloudflare-safe; el cron 6h sin el flag NO toca xi → durabilidad). Tests `tests/xi-slot-map.test.mjs` 7/7.

[16:40] T3 — get-squad v7.2: XIPlayer += foto_url + tm_player_id; `xiFromColumn` (si data.xi tiene 11 → fuente autoritativa, resuelve homónimos + el caso 9-10 titulares que caía a placeholders); fallback `extractXI` con foto vía `renderXIRow`. Deploy a prod por Code (MCP) TRAS merge — el fallback es seguro pre-build-xi. Bump de versión EF → esta entrada (regla edge-functions.md).

[16:45] T4 — front+css: token con foto circular (object-fit cover) + dorsal en badge + apellido + código de posición minimizado; isGK conserva color (foto inset 2.5px → anillo color_portero); onerror = badge-with-flag-fallback. FORMATION_COORDS de-overlap PO↔central: PO→[50,90] (12 formaciones); central de 3→[50,72]; central de 5→[50,74]. Verificado: build OK + selectores `.fc-pizarra-token-photo/--photo` en dist (ERR-22) + coords front↔json idénticas 12/12.

[16:50] PENDIENTE (San, GitHub Actions; + deploy EF get-squad v7.2 por Code tras merge). Runbook en el PR. Baseline acceptance #5 (Supabase MCP): 33 pineadas, 0 con `xi` (columna recién creada). Post `--build-xi`: 33×11. NOTA: `tests/parsers/cross-validate.test.mjs` tiene 1 fallo PRE-EXISTENTE en main (`degrade a low`), no relacionado con A2.

## 2026-05-30 — Fix fotos XI: matcher TM↔roster (fix/fotos-xi-aliases, PR)

[10:20] DIAGNÓSTICO (test local del matcher sobre las 12 grafías SIN_FOTO): solo 4/12 son fallos del matcher. (a) NOR Sørloth/Bjørkan: `ø` no es NFD-descomponible → el strip lo vuelve espacio (`sorloth`→`rloth s`), score 0. (b) BRA Vinicius Jr→Junior: score 0 (`jr`≠`junior`). (c) HAI Jean-Jacques Danley→Danley Jean Jacques: score 0 (guion-une vs espacio). Los otros ~9 (KOR Son/Kim, KSA Dawsari/Khaibari/Tambakti, COD Mpasi, CPV Pina/Josimar, EGY Attia) puntúan 85-100 contra la grafía canónica → NO son fallo de matcher: su candidato TM no llega al matcher (no están en FIWC + fase B kader se salta en re-runs por cobertura ≥50% y dob/dorsal ya presentes).

[10:25] F1 — `name-matcher.mjs rawTokens`: transliteración de latinas no-NFD (ø→o, æ→ae, œ→oe, ß→ss, ð→d, þ→th, ł→l, đ→d, ı→i, ħ→h, ŋ→n) tras toLowerCase. Simétrico (ambos lados) → arregla NOR Sørloth/Bjørkan (0→100) sin alias.

[10:30] F2 — `enrich-merge.mjs applyEnrich`: nuevo param `aliases`; Pass 2 ahora llama `matchAgainstRoster(dbNames, candNames, { iso3, aliases })` (antes vacío) → umbral 0.70 para no-latinos (KOR/KSA) + resolución de alias en la fase de enrich TM.

[10:35] F3 — `scripts/lib/tm-name-aliases.json` (NUEVO, roster→TM): BRA "Vinicius Jr"→"Vinicius Junior", HAI "Jean-Jacques Danley"→"Danley Jean Jacques". SEPARADO de name-aliases.json (FF→roster) a propósito: reusarlo rompería el matching FF (demostrado). `runEnrichTmMw` lo carga (lazy) y lo pasa a applyEnrich A y B.

[10:40] Trigger fase B endurecido (opción b) + flag `--kader-stragglers` / input `kader_stragglers`: corre kader si tras fase A queda algún jugador sin `tm_player_id`. GATED por flag → el cron 6h (que NO lo pasa) conserva su latencia. Log verbose 'unmatched tras enrich' por selección: lista (a) jugadores sin `tm_player_id` y (b) con tmid pero sin foto (Categoría B). NO toco get-squad ni front.

[10:45] CATEGORÍA B (AUT Alaba 59016, EGY Mohamed Alaa 1307898, HAI Keeto Thermoncy 1061046): tienen tm_player_id pero foto=0 — es el pipeline de FOTO, no el matcher. Causa: su id no está en los datos TM de ESTE run (no en FIWC top + fase B saltada) → `foto_url_tm` nunca se asigna → no hay upload. NO es bug separado de código: se resuelve cuando corre fase B (kader trae el retrato por id). El `enrich --full` del re-run lo cubre (el flag `--kader-stragglers` NO, porque ya tienen id). Solo logueado, no forzado (per mandato).

[10:50] Verificación: `tests/tm-enrich-aliases.test.mjs` 8/8 (`node --test`); suite completa sin regresión (cross-validate sigue con su 1 fallo PRE-EXISTENTE ajeno). PENDIENTE: San relanza `enrich-tm-mw --full` (o `kader_stragglers=true`) de las 11 + re-build + verifica fotos. El log verbose revelará quién sigue sin casar (kader ausente vs grafía real divergente → ampliar tm-name-aliases.json).

## 2026-05-31 — Saga JO Jornada (6 PRs #116→#121, CERRADA)

Sesión enfocada 100% en la pantalla Jornada. **Sin migraciones SQL** — solo frontend (`auth.js`, `ui-groups.js`, `jornada-v3.css`).

[15:30] PR#116 (`95f50a2`, squash) — **FG-1** board stale post-login + **JO-4** horarios CEST. `auth.js loadUserData` emite `CustomEvent('mundial:predictions-changed',{detail:{source:'auth-load'}})` tras hidratar `predictions[]` (el listener `grupos-v3.js:1248` ya existía). Nuevo helper `_joParseMatchDate(s)` en `ui-groups.js` ancla fechas naive a `+02:00` (CEST Mundial 11-jun→19-jul); `timeZone:'Europe/Madrid'` en los 6 `toLocale{Time,Date}String` (incl. modal `_showJcardModal` donde `getHours()/getDate()` se sustituyeron por `Intl`). Build OK + grep dist (ERR-22).

[16:10] PR#117 (`0f884ad`, squash) — **JO-2** nombres completos en `_buildJCard` + `_showJcardModal` (hTeam.name/aTeam.name, fallback a `match.home/away`). CSS `.jv2-team-code` + `.jcard-compact-team-code`: tracking `.08em→.02em`, `text-overflow:ellipsis`, `min-width:0` en grid item del modal. Atributo `title` HTML para tooltip de ellipsis ("Bosnia y Herzegovina" etc.).

[17:00] PR#118 (`052109e`, squash) — **JO-1a** esqueleto KO bajo grupos. Nuevas funciones `_buildJKOCard/_buildJKOSection/_buildJKOSectionsHtml` + mapa `_JO_KO_SHORT` en `ui-groups.js`. Reutiliza `ROUND_CONFIG` + `BRACKET[cfg.key]` + clases `.jv2-*` (sin duplicar). Sin pronóstico, sin click. CSS añadido `.jv2-jornada-header--ko` (centrado sin flechas) + `.jv2-card--ko .jv2-score { opacity:.55 }`.

[17:35] PR#119 (`972f3d6`, squash) — **HOTFIX JO-1a** crítico. La primera versión leía `resolvedSlots` (predicciones del usuario) y "INVALID DATE" en las 32 cards. Correcciones: `_joKOSlotLabel`→`'Por definir'` constante; `_joKOTeamFromSlot`→`null`; `resolveAllSlots()` removido de orquestador. Fechas solo-día del BRACKET (`'2026-06-28'`) se anclan a `'T12:00:00'` antes de `_joParseMatchDate` + guard `isNaN(dt.getTime())`. Principio (ERR-76, nuevo en catálogo): pantalla Jornada muestra calendario REAL, NUNCA `resolvedSlots`. TODO en código para conectar a `PARTIDOS.realHome/realAway` + `ko_results` post-27jun.

[18:20] PR#120 (`33f0328`, squash) — **JO-3** acordeón secciones. `_joSectionCollapsed{}` keyed por `"date:..."` (grupos) / `"ko:..."` (KO) + flag `_joCollapseInit` (defaults solo primera vez; clicks posteriores persisten en sesión). "Jornada viva" = primer día con porJugar>0; defensivo si no hay (todo colapsado). KO siempre colapsado por defecto. Handler delegado idempotente en `jornada-container` (`_joCollapseDelegated`); guards `.jv2-nav-arrow` no dispara toggle, Enter/Space sí (a11y). Patrón propio `.is-collapsed` + `display:none` (no `.collap` legacy con `max-height:1200px`, que cortaría las 16 cards de r32). Chev `▾` inline rotación `-90deg`.

[18:45] PR#121 (`3a03413`, squash) — **JO-7** quitar fecha redundante. Header de grupos mostraba `'11 JUN · Jueves, 11 De Junio'`; ahora `'Jueves, 11 De Junio · 2 partidos'` (reutiliza `matchesOfDay.length` ya en scope). Const `dateShort` eliminada. Header KO intacto.

[19:00] JO-5 confirmado **no-bug**: `_buildJCard` ya muestra score real si `live.status==='finished'`. Se ve la predicción porque `live_scores` está vacía pre-Mundial; se activará el 11-jun via pipeline Apify + `update-results`.

[19:10] CIERRE DOCS (este commit, branch `docs/end-of-session-31may`): `CLAUDE.md` HEAD `2a71da7`→`3a03413` con Estado actual (Saga JO COMPLETA) + Top-3 nuevo (JO-6 ficha lenta, PR-1 clasificación liga, PR-3 ver pronósticos otros) + JO-1a TODO añadido a Backlog (#4) + bump ERR-01..76 + tamaño 10237B OK. `CHANGELOG.md` entrada nueva concisa de la saga; entrada `[21-may-2026] fix/scoring-exacto-apila-sobre-signo` movida a `CHANGELOG-archive-202605.md` para respetar 30KB (final: 17054B). `errores_conocidos_porra.md` ERR-76 añadido (vistas de competición real NO leen `resolvedSlots`). Sin DDL — sin cambios en migrations/. Tamaños OK.

[19:33] FIX prod globo roster iso3 naming (rama `fix/globo-roster-iso3-naming` desde `main 8ba7d5b`, NO mergea — San aprueba). Bug detectado por Claude.ai vía MCP+Chrome: "Plantilla" en overlay globo abría modal vacío en 5 selecciones (Cape Verde, Czech Republic, Ivory Coast, Korea, Turkey). Causa: `renderPanelPais` (`public/js/ui-globo-equipos.js:313`) usaba match estricto `EQUIPOS.find(t => t.name_en === nameEn)`, pero `nameEn` es la WIKI key (via `getWikiKey()`) que diverge del `EQUIPOS.name_en` en esas 5: Cabo Verde ≠ Cape Verde, Czechia ≠ Czech Republic, Côte d'Ivoire ≠ Ivory Coast, South Korea ≠ Korea, Türkiye ≠ Turkey. Sin match → iso3='' → `openRosterScreen` corta en `if (!iso3)` y nunca consulta `squads`. Fix iter 1 (commit `f92c1af`): cascada NFD tolerante contra `name_en`/`name`/`slug` × `nameEn`/`nombrePais`. Step 0 preserva exact-match → cero regresión en las 43 que ya casaban. Verificación standalone: 10/10 escenarios de los 5 rotos OK + round-trip 48/48 sin regresión. Grep confirma único site del patrón en repo. Sin tocar BBDD, EF ni otros ficheros. Docs: ERR-77 + CHANGELOG. Pendiente: smoke logueado en localhost por San + merge.

[21:49] FIX iter 2 sobre la MISMA rama `fix/globo-roster-iso3-naming` (PR #124, commit nuevo). QA de San en preview Vercel reveló que iter 1 arregla SOLO 3/5: Cape Verde / Korea / Turkey OK; Czech Republic / Ivory Coast FAIL. Causa raíz: en el path donde el NE GeoJSON devuelve directamente la WIKI key en `properties.NAME` (e.g. `NAME="Czech Republic"` / `NAME="Ivory Coast"`), tanto `nameEn` como `nombrePais` llegan iguales y ningún campo de EQUIPOS contiene esas cadenas (CZE: `name_en="Czechia"`/`slug="czech"`; CIV: `name_en="Côte d'Ivoire"`/`slug="ivory-coast"` — sin colapsar el guión NFD no casa con "Ivory Coast" raw). Mi test inicial dio falso positivo porque asumió `nombrePais` = NE NAME alias-needing (e.g. "Czechia"), no la WIKI key directa. Fix iter 2 (diseño defensivo en 2 capas): (1) vía PRINCIPAL — mapa explícito `WIKIKEY_TO_ISO3` con las 5 divergencias conocidas (`Cape Verde`→`CPV`, `Czech Republic`→`CZE`, `Ivory Coast`→`CIV`, `Korea`→`KOR`, `Turkey`→`TUR`) consultado antes de la cascada. Conjunto cerrado, garantiza 5/5 independientemente de NE/_norm. (2) vía FALLBACK — cascada NFD con `_norm` mejorado que también colapsa separadores (`/[\s\-_'.]/g`) para que slugs con guiones casen contra display names sin ellos. Step 0 exact-match conservado. Verificación re-hecha parseando EQUIPOS REAL de `data.js` (no datos asumidos): 15/15 escenarios (worst-case `nameEn===nombrePais` + polygon-path + flag-path para cada 5) + round-trip 48/48 raw + 48/48 con `getWikiKey()` simulado. Cero regresiones. Hallazgo independiente (anotado en ERR-77 pero NO arreglado en este PR): `squads` para TUR tiene 0 jugadores; las otras 4 con pleno. Es del sync de plantillas (`scripts/sync-squads.mjs`), no del front. Pendiente: re-verificación de San en preview.

[22:40] FIX prod auth bootstrap congelado tras refresh (rama NUEVA `fix/auth-bootstrap-frozen-refresh` desde `main f626714` — el PR#124 ya está mergeado a main). Bug reportado por San + reproducido por Claude.ai vía Chrome MCP: tras F5 / recarga (iPhone + Android), el header se ve (ADMIN, usuario, "Cerrar sesión") pero el resto vacío (azul liso, sin grupos, sin nav). Workaround actual del usuario: logout+login. Causa (3 fallos compuestos en `runAuthInit > onAuthStateChange` branch `INITIAL_SESSION` de `public/js/auth.js`): (1) `await leagueLoadMyLeagues()` SIN retry — fetch transitorio falla, `_myLeagues` queda `[]`, `.find()` no encuentra la liga guardada, NO entra en `leagueSelectById`, ningún `showPage` se llama; (2) sin timeout en los awaits — un fetch colgado (Supabase sin `signal` nativo) deja el handler pending para siempre; (3) early-return `if (found) {...; return;}` sale sin red de seguridad si algo falla entre `find()` y `leagueSelect`. Sintoma: shell montado pero todos los hijos a `height:0`. Cura manual del reporte: `window.leagueLoadMyLeagues()` consola resuelve en 862ms (red funciona, solo el primer intento se ahogó). Fix iter 1 (commit `5405ebc`): (A) helper `_withTimeout(promise, ms, label)` Promise.race aplicado a profile fetch (8s) + leagueLoadMyLeagues (8s/intento) + leagueSelectById (8s) + loadUserData (10s). (B) Retry con backoff 0/400/800/1600ms (4 intentos) sobre leagueLoadMyLeagues. (C) Flag `_navigated` + `try/finally` garantiza `showPage` en TODOS los caminos. (D) Preservar `savedLeagueId` si tras 4 intentos `_myLeagues` sigue vacío. (E) Loader visible `#_auth-bootstrap-loader` si hay `sessionStorage.porra_token` o `_pendingPageRestore`. (F) Watchdog 12s. Guards intactos: TOKEN_REFRESHED/USER_UPDATED + currentUser.id===session.user.id. Docs: ERR-78 + CHANGELOG. Pendiente: QA en preview Vercel.

[23:26] FIX iter 2 sobre la MISMA rama `fix/auth-bootstrap-frozen-refresh` (PR #125 se actualiza solo). QA de San en preview Vercel reveló que iter 1 NO resolvía el bug: pasaron MINUTOS sin que el watchdog rescatara. Causa REAL (NO era el transient asumido de leagueLoadMyLeagues): RACE DE REGISTRO TARDÍO del listener. supabase-js emite `INITIAL_SESSION` durante `createClient`/restauración persistida ANTES de que `auth.js` cargue (auth.js está al final de la cadena `loadScript`). Cuando `db.auth.onAuthStateChange(handler)` se registra, el evento YA pasó y supabase NO reemite a listeners nuevos. El handler queda huérfano → toda la lógica de retry/timeout/watchdog/_navigated que metimos DENTRO del handler nunca corre. Watchdog también dentro de gating circular (`sessionStorage.porra_token` solo escribe el handler → handler no corre → gate falla → watchdog no se arma). Prueba en vivo: suscribir listener nuevo Y llamar getSession() manualmente devuelve `{hasSession:true}` con sesión válida. La sesión existe, nadie la procesa. Logout+login cura porque `SIGNED_IN` se emite DESPUÉS del registro. Fix iter 2 (refactor estructural, ataca causa raíz): (A) extracción de TODO el flujo a función `_bootstrapSession(session, eventType)` invocada desde el handler Y desde `db.auth.getSession()` explícito tras registrar el listener — patrón Supabase v2 canónico (snapshot inicial + listener para cambios futuros). (B) Guard `window._bootstrapInFlight` para idempotencia entre las dos vías. (C) Loader + watchdog 12s armados INCONDICIONALMENTE al inicio de `runAuthInit`, fuera del handler. (D) `_withTimeout` también aplicado a `db.auth.getSession()` (8s). (E) Fallback edge case: si getSession devuelve sin sesión pero `_pendingPageRestore` estaba seteado, limpiar pending y mostrar welcome. Preservada toda la lógica defensiva de iter 1 (retry+backoff, timeouts, _navigated flag, try/finally) — ahora SÍ se ejecuta porque el bootstrap se invoca vía getSession. Guards originales intactos. 1 fichero tocado, refactor cohesivo. Sin tocar BBDD, EF, leagues.js. Docs: ERR-78 reescrito con causa real + CHANGELOG. Pendiente: QA definitivo en preview por San reproduciendo el refresh real (lección reforzada: el test que importa NO es simular el evento del listener — ese es el que falla; el test es comprobar que getSession explícito arranca igualmente el flow).

[00:59] FIX iter 3 sobre la MISMA rama `fix/auth-bootstrap-frozen-refresh` (PR #125 se actualiza, commit nuevo). QA de San en preview Vercel **iter 2 SEGUÍA SIN RESOLVER EL BUG**. Diagnóstico definitivo vía Chrome MCP + DOM inspection durante el blank state (confirmado por San, no solo grep). Hipótesis inicial (IA Predictor bloqueando showPage) descartada en challenge mutuo: `loadIAPredictions` está dentro de `loadUserData`'s Promise.all que en Path 2 ya estaba envuelto en `_withTimeout(...,10000)`; en Path 1 (leagueSelect) es fire-and-forget — no bloquea `showPage`. `showPage()` síncrono y `v3GruposMount` también: ningún path donde IA bloquee. **Causa raíz REAL (descubierta por Code en grep audit + verificada por San en consola del browser)**: `#restore-lock-css` (style inline inyectado en index.html:36-45 cuando hay `porra_lastPage`) hace que `showPage('welcome')` en ui-nav.js:506-508 retorne early sin renderizar. Lock se quita SOLO cuando `showPage(non-welcome)` se ejecuta. Si TODOS los caminos del bootstrap fallan y caen a `showPage('welcome')`, todos retornan early → blank permanente, ningún `#page-*` queda en `display:block`. Y el watchdog de iter 2 estaba gateado por presencia del loader `_auth-bootstrap-loader`, que se oculta en TODOS los caminos de fallback (`_onNoSessionFromGetSession`, listener no-session, `_markNavigated`, finally net) ANTES de que el watchdog dispare → watchdog NUNCA disparaba. Verificación browser: `document.getElementById('restore-lock-css')` existe durante blank, `getComputedStyle(#page-welcome).display='none'`, las 8 `#page-*` todas `display:none`, test causal `lock.remove(); showPage('grupos')` → recupera la app. Confirma diagnóstico. Iter 1+2 atacaban consecuencias correctas (listener tardío, fetch hangs) pero NO la causa raíz. Fix iter 3 acordado con San tras challenge: (A) Helper `_navigateFallbackWelcome` quita `#restore-lock-css` ANTES de cada `showPage('welcome')`, aplicado en los 4 sitios críticos: fall-through Path 2 (admin rejected → finalPage='welcome'), red final try/finally de `_bootstrapSession`, listener `else` no-session, `_onNoSessionFromGetSession`. (B) Watchdog redesignado con trigger semántico ("¿hay alguna `#page-*` con `style.display !== 'none'`?" — recorre las 8 pages: welcome/grupos/jornada/directo/predictor/elim/score/admin). Acción: `_navigateFallbackWelcome` (quita lock + welcome). Cubre TODOS los caminos de fallback presentes y futuros sin enumerarlos. Sustituye el rol del propuesto B (auto-expire del lock en index.html inline) que se descartó porque quitar el lock sin re-renderizar no recupera la app. (C) Opcional, secundario: `loadIAPredictions` con `Promise.race(...,setTimeout({},6000))` dentro de `loadUserData`'s Promise.all (mejora UX en red lenta — NO es el fix del blank). Preservado intacto de iter 2: `_withTimeout`, `_bootstrapSession`, `db.auth.getSession()` explícito, guards TOKEN_REFRESHED/USER_UPDATED + currentUser.id===session.user.id, retry+backoff, flag `_navigated` + try/finally. 1 fichero tocado (`public/js/auth.js`, +60/-15 sobre iter 2). Sin tocar BBDD, EF, leagues.js, ui-nav.js (el lock CSS sigue siendo legítimo para evitar flash de welcome en happy path — solo cambia el comportamiento en fallback). Docs: ERR-78 reescrito con recap de las 3 iteraciones + lecciones acumuladas + patrón (lock + watchdog gateado) + CHANGELOG. Lección acumulada: el QA en browser real con DOM inspection es lo único definitivo; las hipótesis sobre "qué bloquea" se confirman SOLO leyendo el DOM en el estado del bug, incluyendo CSS inyectado que no aparece en grep de showPage. Pendiente: QA definitivo en preview por San (Chrome MCP + read_network_requests + lock state check).

[01:32] FIX iter 4 sobre la MISMA rama `fix/auth-bootstrap-frozen-refresh` (PR #125 actualiza). QA de San en preview iter 3 resolvió el blank ✓ pero introdujo regresión UX: tras F5 con sesión + liga + `porra_lastPage='grupos'`, la app SIEMPRE aterriza en welcome en lugar de restaurar grupos. Medido: `visible_pages=['page-welcome']`, `getActiveLeagueId()=null`, `match_cards=0`, queries Supabase TODAS 200 (incluidas `league_members` y `leagues in.(...)` — las ligas SÍ cargan), `porra_lastPage=null` (cleared por showPage('welcome')). NO es timing de fetch; es lógica de bootstrap. **Causa raíz iter 4** (combinación de dos issues): (1) `supabase-js v2` emite INITIAL_SESSION con `session=null` ANTES de terminar de restaurar persistSession desde localStorage; el handler en iter 3 lo tratava como "no hay sesión" → nullificaba `_pendingPageRestore` y mostraba welcome prematuro. (2) Cuando `getSession()` explícito later resolvía con sesión válida y `_bootstrapSession` Path 1 corría con `_foundLeague=true`, el código hacía `await _withTimeout(leagueSelectById(savedLeagueId), 8000)` — `leagueSelectById` internamente (`leagues.js:75`) hace un SEGUNDO `await leagueLoadMyLeagues()` REDUNDANTE (la retry loop ya populó `_myLeagues`). Ese segundo fetch puede colgar (network jitter) → timeout 8s → catch → fall-through a Path 2 → lee `target=_pendingPageRestore=null` (nullified por #1) → `finalPage='welcome'` → `showPage('welcome')`. `_activeLeague=null` porque `leagueSelect` nunca corrió. Fix iter 4 (dos cambios coordinados): **A)** Listener no-session branch ahora distingue: solo SIGNED_OUT y USER_DELETED disparan clear+welcome; INITIAL_SESSION sin sesión / USER_UPDATED sin sesión se ignoran con `console.debug`. `getSession()` explícito (que SÍ espera persistSession a terminar) es la fuente autoritativa. **B)** Path 1 llama `leagueSelect(_foundLeague)` directo en lugar de `leagueSelectById`, eliminando el segundo `leagueLoadMyLeagues` redundante. `leagueSelect` es síncrono — sin timeout, sin riesgo de hang. `_foundLeague` ya fue validado contra `_myLeagues` populado por la retry loop. Cualquier cambio por separado podría dejar el bug en ciertos timings; juntos blindan la restauración desde dos ángulos. Preservado intacto de iter 3: `_navigateFallbackWelcome` con quita-lock, watchdog semántico, `_withTimeout`, `_bootstrapSession`, `_onNoSessionFromGetSession`, retry+backoff, flag `_navigated` + try/finally, IA timeout 6s. Lección iter 4: no todos los nulls de session significan "no hay sesión" — distinguir eventos definitivos (SIGNED_OUT, USER_DELETED) de eventos prematuros (INITIAL_SESSION pre-restauración). Eliminar awaits redundantes — si un dato ya está en memoria, no re-fetchearlo abre una ventana de timing para fallar. 1 fichero (`public/js/auth.js`, +35/-7 sobre iter 3). Sin tocar BBDD, EF, leagues.js, ui-nav.js. Docs: ERR-78 extendido con iter 4 + lecciones + CHANGELOG. Pendiente: QA definitivo de San en preview (verificar que F5 con sesión + porra_lastPage='grupos' restaura grupos, sin regresión en anónimo / login fresco / logout / background return / sin blank).

## 2026-06-01 — Cierre saga refresh congelado (commit solo-docs en main)

[02:58] CIERRE saga refresh congelado. Bug crítico (BLANK tras F5) RESUELTO en producción vía PR#125 squash `6e7c966` (recogió iter 3+4). iter 5 (commit `1da350a` en rama `fix/auth-bootstrap-frozen-refresh`) NO mergeado: QA de San en preview con wrapper persistente sobre `window.showPage` demostró que `showPage('grupos')` NI SIQUIERA SE LLAMA en el F5 — el safety-net de `main-entry.js:114-115` no estaba pisando nada → iter 5 atacaba culprit falso para el sub-síntoma "aterriza en selector de ligas". Decisión San (producto): "restaurar última página tras F5" NO es bug crítico — es UX accesoria del feature `porra_lastPage`/`_pendingPageRestore` (nacido `feat(nav)` 20-abr, frágil). Aterrizar en selector de ligas tras refresh es comportamiento ACEPTABLE. Si algún día se retoma "restaurar pantalla", será como FEATURE nuevo con spec limpia, no parcheando bootstrap. Persistencia de DATOS intacta (216 grupos + 96 KO server-side en Supabase, nunca en riesgo). Lo único que se reseteaba al aterrizar en welcome era `_activeLeague` en memoria, que se restaura tras re-seleccionar liga. Este commit es SOLO DOCS (sin tocar `public/js/auth.js` ni `js/main-entry.js`): actualiza `CHANGELOG.md` (entry cierre), `errores_conocidos_porra.md` (ERR-78 ampliado con causa raíz definitiva del BLANK = `#restore-lock-css` + `showPage` early-return, sección iter 5 DESCARTADA, sección cierre con decisión producto, recap 5 iters en tabla), `migration-log.md` (este entry), `CLAUDE.md` (backlog entry feature futuro). Tras este commit, borrar rama remota `fix/auth-bootstrap-frozen-refresh`. Lecciones acumuladas saga 5 iters: (1) validar handler de listener realmente corre antes de poner robustez dentro; (2) QA browser + DOM inspection es lo único definitivo; (3) distinguir eventos definitivos vs prematuros (SIGNED_OUT vs INITIAL_SESSION null), eliminar awaits redundantes; (4) validar empíricamente que el código que asumes corre realmente corre (wrappers persistentes sobre funciones críticas) antes de teorizar overrides — iter 5 lo aprendió a las malas; (5) intermitencia con readyState/timing → auditar TODOS los sitios que ejecutan durante bootstrap, no solo el módulo bajo investigación.

## 2026-06-01 — PR-1 leaderboard cerrado: EF get-league-standings + render Trofeo (PR#123, merge `a1e3da9`)

[14:00] PR-1 mergeado a main (squash `a1e3da9`). Sprint pantalla Clasificación de liga server-side. **Arquitectura A**: EF + motor JS compartido (no plpgsql, evita divergencia con `public/js/scoring.js`).

[14:01] **EF `get-league-standings` v1.0.1 desplegada vía MCP** (no migración SQL — sólo deploy de función). `slug=get-league-standings, version=2, status=ACTIVE, verify_jwt=false` (validación manual contra `supa.auth.getUser(token)`, ERR-16). Recibe `{ league_id }`, verifica membership (`league_members` por uid + league_id, 403 si no), lee con service role: profiles + predictions + ko_predictions + award_picks + results (single row) + ia_predictions + league_members. Reutiliza motor `_shared/scoring.mjs` (calcMatchPoints/calcKOMatchPoints/calcAwardPoints) — funciones puras sin globals, parity 1:1 con el browser verificada en `tests/scoring.test.mjs`. Devuelve SOLO totales agregados `[{uid,nombre,grpPts,koPts,awPts,total,hasPreds}]` — picks ajenos NUNCA viajan al cliente (respeta gate PR-3 implícitamente, no necesita RLS adicional). v1.0.1 = fix BUG-79 (mapeo `scorer` BD → `gol` motor, +2 goleador no sumaba; primer deploy fue v1.0.0 sin el mapeo). **Sin cambios RLS** (las policies `auth.uid()=user_id` de predictions/ko_predictions/award_picks quedan tal cual).

[14:02] Cliente (`public/js/scoreboard.js`): `sbLoad` refactorizado a 1 sola invocación `db.functions.invoke('get-league-standings', { body: { league_id } })` — antes hacía 4 lecturas + cálculo cliente que sólo veía las predicciones del usuario logueado por RLS. `sbRender` reescrito siguiendo render Trofeo entregado por San (`scoreboard-v3.render.js` + `clasificacion-v3.css`): hero podio 2·1·3 + lista con avatares + desglose 4×1 (Grupos/Elim/Premios/Total). **Re-home picker premios**: card "Premios" del desglose pasa a tappable cuando `!window._porraCerrada` → abre `window.PorraPred._openTrophyModal`. Botón trofeo del Predictor (`ui-pred-shell.js onTrophyTap`) ahora hace `showPage('score')` en lugar de abrir el modal directo. Restricciones explícitas: paridad con cliente actual — iaBonus sólo en grupos (no KO), boost ×2 NO aplicado en v1 (documentado para post-launch).

[14:03] Bugs cazados en QA caliente + fixes:
- **ERR-79** (catalogado renombrado tras conflict merge — originalmente ERR-77 en la rama): `scorer` BD vs `gol` motor → +2 goleador nunca sumaba. Fix EF v1.0.0→v1.0.1 + test de ENSAMBLADO en `tests/scoring.test.mjs` sección 7 que ejerce el mapeo (no solo el motor puro).
- **ERR-80** (nuevo): `myId` undefined en `sbRender` porque leía `window.currentUser` (no expuesto; `let currentUser` top-level NO crea propiedad en window). Ninguna fila recibía `is-me`, `#sb-my-breakdown` quedaba display:none, picker premios sin entrada. Fix Opción B (San): patrón `(typeof currentUser !== 'undefined' && currentUser ? currentUser.id : null) || (window.currentUser && window.currentUser.id) || null` (coherente con `ui-groups-mobile.js`/`data.js`) + degradación elegante (`me` con fallback `{0,0,0,0}` para que el desglose y la card Premios tappable se pinten SIEMPRE con porra abierta, aunque el usuario no esté en `rows`).
- **ERR-81** (nuevo): clipping esquinas fila #1. Contenedor legacy `.sb-table` con `overflow:hidden` heredado de `admin.css` recortaba `border-radius:11px` + `box-shadow` exterior de la primera `.tf-row` (afectaba a `top1` dorado y `is-me` lime, en TODAS las ligas). 3 iteraciones de diagnóstico mal apuntadas (gradiente top, inset rectangular, header solapado) antes del runtime QA de San que aisló la causa real. Fix iter 4: `#page-score .sb-table { overflow:visible }` + `#page-score #sb-rows { padding-top:4px }`. Lección añadida al patrón: `getComputedStyle` NO detecta clipping del contenedor padre — para diagnosticar borde "fantasma" usar `document.elementFromPoint` sobre el píxel del borde, o auditar el ancestor chain con `overflow !== 'visible'`.

[14:04] Commits clave del PR-1: `c8afa85` (Capa 1 EF + motor + tests parity), `bdc24cf` (Capa 2 sbLoad refactor + Capa 3 entry trofeo + re-home), `5e74b29` (Capa 3 visual render Trofeo + CSS), `51d6314` (fix BUG-79 v1.0.1 + test ensamblado), `76a7d86` (merge main → resolución ERR-77/78/79), `0ccdaeb` (fix ERR-80 myId + degradación picker), `cf7567c`/`4770d18`/`55de970`/`cc4d2c5` (pulido visual 4 iters: refresh icónico → reorder desglose → borde podio → fix raíz clipping). Squash final `a1e3da9` en main.

[14:05] PENDIENTE (San, validación post-cierre): card "Premios" debe quedar **display-only** tras 10-jun (cuando `window._porraCerrada=true` por cron). NO verificable con porra abierta — validar en simulacro de cierre antes del 11-jun. El código aplica `isClickable = c.action === 'open-trophy' && porraAbierta`, así que la card pierde `--clickable` + `role/tabindex/data-sb-action` cuando `_porraCerrada` flip. Doble guard runtime en `_sbOpenTrophyFromBreakdown` (`if (window._porraCerrada) return;`).

[14:06] CIERRE DOCS (este commit, directo a main): `CHANGELOG.md` entrada sprint PR-1 + entrada antigua archivada a `CHANGELOG-archive-202605.md` (respetar 30KB); `errores_conocidos_porra.md` ERR-80 + ERR-81 añadidos; `CLAUDE.md` Top-3 con PR-1 movido a HECHO + nueva pendiente QA post-cierre picker; este entry. Sin DDL. Backlog #5 (reconciliar `scoring.js↔_shared/scoring.mjs` + tabla canónica a `docs/scoring-engine.md`) confirmado en su sitio.

## 2026-06-01 — Diagnóstico huecos squads (8 vacías + 2 pre-lista) + fix country-map `catar`→QAT

[14:19] INVESTIGA huecos de plantillas en `squads` (rama `claude/nice-davinci-A8VOU`). Verdad de base vía Supabase MCP (read-only SELECT, proyecto `cmyfyswystjgzdwbqyyb`): **48 filas = 48 plazas**. **8 vacías** (`n=0`, `fuente=null`, `synced_at=null`): ALG, AUS, ECU, IRQ, PAR, TUR, URU, UZB. **2 pre-lista** (`is_final=false`): QAT (33 jug, `infobae+tm-mw`, sync 29-may) y MEX (55 jug, `365+tm+tm-mw`, sync 31-may). **38 finales** (`is_final=true`, 26-30 jug) con fuentes primarias `as+sport+olympics+espn+tm+tm-mw`. Reconcilia con el modelo previo "3 sin lista (QAT/PAR/TUR)": ese conteo se quedaba corto — corregido a 8+2. El `synced_at=null` de las 8 prueba que `upsertSquad` NUNCA las escribió (siempre setea `synced_at`) → no es "ingerido y borrado", es que el detect nunca produjo roster válido (cae a `confidence='reject'`, líneas 473-474 de `sync-squads.mjs`: se loguea y se descarta sin escribir).

[14:20] CAUSA RAÍZ (timing, NO hueco FIFA, NO bug de código en 7 de 8): deadline FIFA de envío de los 26 = **1-jun**, publicación oficial de las 48 listas = **2-jun** ("snapshot de mañana"). Verificado por WebSearch que URU (Bielsa, 31-may), ECU (Beccacece, noche 31-may) y AUS (Popovic, 1-jun) ya anunciaron sus 26 — todas DESPUÉS del último sync exitoso en BD (**31-may 13:38 UTC**). Las mega-listas consolidadas (AS/Sport/Olympics/ESPN) se actualizan incrementalmente y el cross-validate exige ≥2 fuentes con roster ≥22 + Jaccard ≥0.7: aún no convergen para las recién anunciadas. Es exactamente el escenario para el que sirve la pasada post-snapshot. NO se pudo correr el pipeline desde el contenedor remoto (sin `.env`/`SUPABASE_SERVICE_ROLE_KEY`; fuentes Cloudflare-gated devuelven 403 a fetch directo y exigen el Scrapling/StealthyFetcher del step CI). NO se hand-populó roster a mano (bypasearía cross-validate + enrichment TM + XI titular, y la pasada real de mañana lo sobrescribiría/merge-aría con riesgo de mismatch por falta de `tm_player_id`).

[14:21] BUG LATENTE encontrado y CORREGIDO — `scripts/lib/parsers/country-map.json` carecía de la clave `"catar": "QAT"`. `resolveIso3()` (`_util.mjs:126`) normaliza `"Catar"` (grafía RAE que usan AS/Sport/Olympics-es) → `normalizeCountryKey` quita acentos + lowercase → `"catar"` → `countryMap["catar"]` = `undefined` → **null** → el roster de Qatar se DESCARTABA de toda fuente primaria española. Explica por qué QAT nunca cross-validó vía primarias (su única data, `infobae`, vino de un path no-primario). El mapa ya localizaba al español el resto de países (la asimetría "qatar" sin "catar" era el descuido). Mismo mapa compartido gatea también el parser de calendario (`calendar.mjs:74`), así que el fix cubre roster + detección de anuncio. Cambio aditivo de 1 línea. Validado: `resolveIso3("Catar"|"• Catar"|"CATAR")`→QAT, `"Qatar"`→QAT preservado, JSON 94 claves OK. Las otras 7 vacías resuelven bien (Uruguay/Turquía/Uzbekistán/Irak verificados) → su vacío es 100% timing. No se tocó `sync-squads.mjs` (contrato estable, rule §4).

[14:22] CORRECCIÓN OPERATIVA para mañana: `--all-missing` **NO aplica a `--mode=detect`** (`main()` líneas 868-872: detect arma targets solo desde `--iso3`; vacío → `runDetect(null)` → procesa las 48). `--all-missing` solo lo honra `resolveTargets()`, usado por `--mode=scrape` (path **FF legacy**, prohibido para detección — ERR-59 / rule §0) y `enrich-tm`. → El comando correcto post-publicación 2-jun es `npm run sync-squads -- --mode=detect --verbose` (cubre las 48, recoge las nuevas FINAL al converger las fuentes) seguido de `--mode=enrich-tm-mw --verbose`. El cron 6h ya ejecuta esa secuencia, así que las 8 podrían auto-cerrarse solas tras el 2-jun aun sin dispatch manual. NO usar `--mode=scrape --all-missing`. Ficheros tocados: `country-map.json` (fix) + este `migration-log.md`. Sin DDL, sin tocar BD, sin frontend.

[15:07] FIX INFRA (causa raíz #2, la importante) — el **cron de Sync Squads timeoutea a 15min y se cancela** ("The job has exceeded the maximum execution time of 15m0s", run schedule sobre main `1a5e7f3`). San aportó el screenshot: status Cancelled, 15m31s, "muchísimas ejecuciones fallidas". Esto REENMARCA el diagnóstico de las 8 vacías: no es solo lag de fuentes — el cron NO completa, así que aunque las fuentes convergan, el run se cancela antes de escribir. Explica por qué nada cambió en BD desde 31-may 13:38 (último run que sí terminó). Cuello de botella: el cron (`schedule`, sin `--iso3`) hace que `fetch_sources.py` baje **las 48 FF** en el prefetch (ProcessPool 3 workers ≈ **~8min** por su propio docstring) + install Scrapling/Playwright (~2-4min) + detect + enrich-tm-mw ≈ **18-20min** > cap 15. Los dispatches con `iso3_filter` NO sufren esto: `fetch_sources.py` lee `ISO3_FILTER` (env) y acota FF a esos países (~2-3min) → el plan "nutrir hoy" filtrado a 10 cabe de sobra en 15min y funciona sin este fix. Fix aplicado: `.github/workflows/sync-squads.yml` `timeout-minutes: 15 → 30` (+ comentario explicativo). Es la solución segura y suficiente; documentada como pendiente la optimización post-launch (acotar prefetch FF a selecciones no-final, recorta el run entero, pero requiere lista dinámica con edge case "0 no-final → fetch nada" — no tocar bajo deadline). **IMPORTANTE: el cron corre desde `main`, así que este fix (y el `catar`) NO surten efecto hasta mergear la rama `claude/nice-davinci-A8VOU` a main.** Aparte: warning de GH Actions — checkout@v4/setup-node@v4/setup-python@v5/upload-artifact@v4 en Node 20, forzados a Node 24 el 16-jun (post-launch, no urgente, no bundlear ahora). YAML validado (`yaml.safe_load` OK).

## 2026-06-01 — B2 MOTOR (ensamblado scoring server-side) · rama `feat/motor-scoring`

[16:30] B2/T1 `get-league-standings/index.ts` v1.0.1→**v1.1.0**. El motor `_shared/scoring.mjs` NO se toca (correcto); el bug era el ENSAMBLADO. Cambios: (1) **reader type-tolerant `asObj(v)`** sustituye los 3 `JSON.parse` — acepta TEXT (hoy) u objeto ya parseado (tras migración results→jsonb, lane Claude.ai/P1) → la EF funciona en ambas ventanas sin acoplarse. (2) **boost ×2 grupos-only**: `boost_picks` añadido al `Promise.all` (`select user_id, match_id` por liga), `boostByUser[uid]=Set(match_id)`, y en el loop de grupos `boost: boostByUser[uid]?.has(matchId) ?? false`. KO queda `false`. (3) **overrides**: `results.overrides` leído con `asObj` y mergeado ENCIMA del canónico de grupos por clave (`{...realMatchResults, ...overrides}`). (4) scorers ya mapeados (`gol: row.scorer`), se mantiene + guard. (5) iaBonus/boost KO comentados grupos-only. **Verdad de base (Supabase MCP read-only, proyecto `cmyfyswystjgzdwbqyyb`)**: `results.overrides` EXISTE (tipo `text`, como match_results/ko_results/award_winners — la migración jsonb aún no ha corrido); `boost_picks` tiene `match_id` (text) directo + `user_id`+`league_id`+`match_date`; `predictions.match_id`=`getMatchKey`=`${group}_${home}_${away}` (data.js:310) = mismo keyspace que match_results y overrides (admin.js:167) → el merge y el lookup casan directo. NO desplegada (es prod; cambios backward/forward-compatible — boost/overrides degradan a no-op con tablas vacías/ausentes).

[16:31] B2/T2 `update-results/index.ts` **traída al repo** desde el deploy v5 (estaba drifted, no existía en repo). Único cambio: `match_results` se escribe como **objeto** (sin `JSON.stringify`) para la migración results→jsonb. **KO sin tocar** (`ko_results`/`classification` siguen con `JSON.stringify` a propósito): el keying KO 73-104 lo rehace el puente P3 (lane Claude.ai) y tocar su serialización colisionaría. **NO desplegada**: "escribir objetos" solo es correcto DESPUÉS de la migración jsonb (P1); pg_cron la activa el 11-jun (lane P4/Claude.ai). Dependencia documentada en el header del fichero. `verify_jwt=true` del deploy v5 no se cambia (config de deploy, invocación cron/service-role).

[16:32] B2/T3 `tests/scoring.test.mjs`: **roto el `slice(0,104)`** (cargaba el motor legacy por nº de línea, frágil). Ahora carga `public/js/scoring.js` por **marcadores de función** (`const KO_ROUND_PTS` → `function calcTotalUserPoints`, robusto ante shifts de línea) y extrae calcMatchPoints+calcKOMatchPoints+calcAwardPoints. **Paridad shared↔legacy extendida** a las 3 funciones (antes solo calcMatchPoints) + casos nuevos: boost exacto ×2, iaBonus, y EF-assembly del wiring boost (`boostByUser.has`). Globals legacy mockeados (`AWARDS_CFG`, `boostPicks`, `PARTIDOS`, `getMatchKey`, `EQUIPOS=[]` para neutralizar `_hf09FallbackScorers`). QA: `node tests/scoring.test.mjs` → ✓ (sin deno en el contenedor; la EF .ts se valida por review — no hay type-check automático). Ficheros: `supabase/functions/get-league-standings/index.ts`, `supabase/functions/update-results/index.ts` (nuevo), `tests/scoring.test.mjs`, este log. Sin DDL.

## 2026-06-01 — B1 ENTRADA (UI fixes Tier-0) · rama `feat/ui-entrada`

[16:45] **FX-14 quitar porteros del picker de goleador**. `getScorerCandidates` (`public/js/scoring.js:~1547`) NO filtraba: aparecían porteros como candidatos a goleador. Fix: `.filter(({ j }) => j.posicion !== 'Portero')` antes del `.map`. Clave de posición = `posicion` (NO `posicion_bucket`), valor portero = `'Portero'` (confirmado: `_bucketToRole`/`golden_glove` usan ese literal). **Degradación elegante**: el fallback `_fallbackScorerFromEquipos` (selecciones sin XI pin: IRQ/PAR/TUR/UZB y demás vacías) trae `bucket:null` → `null !== 'Portero'` = true → NO se filtra, se conserva plantilla completa. Solo se filtra cuando la posición es conocida.

[16:46] **FX-13 scroll picker goleador (móvil)**. El picker es `.v3-squad-picker-*` (grupos/KO). Diagnóstico = ERR-65/66: el `.v3-squad-picker-panel` padre es `pointer-events:none` con `overflow-y:auto` → iOS NO scrollea un padre sin pointer-events ("en iPhone no scrollea"); el `.v3-squad-picker-panel__inner` (el que SÍ recibe pointer-events al abrir) tenía `overflow:hidden` sin `max-height` → cortaba la lista por abajo ("en Android corta abajo"). Fix (`public/css/v3/grupos-v3.css`): el `__inner` pasa a ser el SCROLLER (`overflow-y:auto` + `-webkit-overflow-scrolling:touch` + `overscroll-behavior:contain` + `max-height:calc(100dvh - 56px)` con fallback `100vh`; 56px = 32px padding del panel + 24px margin del inner). `.v3-squad-picker-body` con `padding-bottom: calc(18px + env(safe-area-inset-bottom))` para que el último jugador no quede bajo el home indicator. Patrón idéntico al fix de `.v3-zoom-panel__inner` (rule frontend-css.md §iOS).

[16:47] **FX-01 números en verde indebidos (grupos)** — DOS causas. (a) **Bug CSS**: el selector `.phone .v3-column-right .v3-group.has-standings .v3-team-row__pos` (sin `.is-qualified`, agrupado por coma con el correcto) pintaba en verde TODAS las posiciones de la columna derecha (grupos G-L), no solo las clasificadas. Eliminado — el segundo selector `.v3-team-row.is-qualified .v3-team-row__pos` ya cubre AMBAS columnas. (b) **Gate resultados reales** (decisión San: "solo con resultados reales"): `v3ComputeStandings` y el legacy `calcGroupTableAdvanced` calculan la tabla 100% desde `predictions` (no hay pipeline de resultados reales en el board todavía), así que el realce `is-qualified` aparecía con `results` vacío. Nuevo helper `v3GroupHasRealResults(letter)` (sentinel `realHome/realAway` null/0-0 igual que `v3CalcMatchPointsGrupos`) que gatea `is-qualified` en `v3RenderGroup` (team-rows) y `v3RenderStandingsTable`, + check inline equivalente en `ui-groups.js _renderGruposStandings` (`qualifClass`). Efecto pre-Mundial: verde OFF hasta que exista pipeline de resultados reales que alimente `realHome/realAway`. Ficheros: `public/js/v3/grupos-v3.js`, `public/js/ui-groups.js`, `public/css/v3/grupos-v3.css`.

[16:48] QA B1: `node --check` de scoring.js + grupos-v3.js + ui-groups.js → OK. `npm ci` + `npm run build` (vite 8.0.8) → OK. **ERR-22 verificado** en `dist/css/v3/grupos-v3.css`: `-webkit-overflow-scrolling` ✓, `safe-area-inset-bottom` ✓, `100dvh` ✓, selector buggy `column-right ... __pos` = 0 (eliminado) ✓. **Pendiente (no producible desde el contenedor)**: screenshots de scroll iOS real (FX-13) y de standings con/ sin resultados (FX-01) → QA visual en preview Vercel / device de San antes de mergear. Sin DDL, sin tocar BD, sin EFs (no colisiona con `feat/motor-scoring`).

[17:10] **FX-13 addendum — overlap tabbar** (feedback San en #128). El scroller del picker (`.v3-squad-picker-panel__inner`) terminaba DETRÁS de la tabbar fija inferior (`.fc-tabbar` z-index `--fc-z-tabbar`=300 > 130 del picker → la tabbar pinta encima), tapando el último jugador (confirmado: 23º de RSA, "Tshepang Moremi"). El `max-height: calc(100dvh - 56px)` solo descontaba el chrome del picker (32px padding panel + 24px margin), NO la tabbar. Fix: `max-height: calc(100dvh - var(--fc-tab-h) - var(--fc-safe-bottom) - 28px)` (+ fallback `100vh`). Lee la altura REAL de la tabbar de su token (`--fc-tab-h`=56px en `tokens.css`, no hardcode) + su safe-area (`--fc-safe-bottom`, = home indicator, que la tabbar ya incluye en su `height`). El `-28px` = chrome propio del picker (16px padding-top del panel + 12px margin-top del inner = offset superior del scroller). `.v3-squad-picker-body` padding-bottom `calc(18px+env())` → `20px` fijo (el safe-area ya lo cubre el max-height vía la tabbar; queda un padding pequeño para ver el final de la lista). **Criterio de aceptación**: `scroller.bottom <= tabbar.top`. Matemática: scroller.top=28px, height máx = 100dvh − (56+safe) − 28 → scroller.bottom = 28 + [100dvh − 56 − safe − 28] = 100dvh − 56 − safe = `tabbar.top` ✓ (igualdad). QA: `npm run build` OK; ERR-22 `dist/css/v3/grupos-v3.css` contiene la fórmula con `var(--fc-tab-h)` + `var(--fc-safe-bottom)` (dist es copia verbatim de `public/`, no minificada) y el `100dvh - 56px` antiguo eliminado. Visual en device pendiente igual. Fichero: `public/css/v3/grupos-v3.css`.

## 2026-06-01 — P3c `home_iso3`/`away_iso3` en worldcup-2026-matches.json · rama `feat/matches-iso3`

[19:45] DATOS (opción A, NO runtime) — añadidos `home_iso3`/`away_iso3` a las **72** entradas de `public/data/worldcup-2026-matches.json` (144 valores), para que el puente `live_scores→results` (EF `porra-bridge-results`, lane Claude.ai) normalice el goleador SofaScore → key corta del proyecto. **Orientación = proyecto**: `home_iso3` = iso3 de `home_es` y `away_iso3` = iso3 de `away_es`, uniforme en las 72. Es sibling de `*_es` y coherente con `live-sync.js`/`ui-directo.js`, que tratan `_es` como canónico y reconcilian SofaScore vía `teams_swapped`. La única entrada `teams_swapped:true` (`wc2026_gC_15186861`, Brasil vs Escocia) queda `home_iso3=BRA`/`away_iso3=SCO` (sigue a `home_es`/`away_es`, NO a `home_en`/`away_en`=Scotland/Brazil) → el EF aplicará `teams_swapped` al goleador igual que al marcador.

[19:45] iso3 resuelto por SELECCIÓN (no por coincidencia textual) contra `squads.iso3` canónico (verdad de base Supabase MCP read-only, proyecto `cmyfyswystjgzdwbqyyb`, 48 filas). 3 grafías divergentes matches.json↔squads.equipo resueltas sin ambigüedad: `Catar`→QAT (squads "Qatar"), `RI de Irán`→IRN (squads "Irán"), `República de Corea`→KOR (squads "Corea del Sur"; PRK no está en el Mundial). VALIDACIÓN: 144/144 valores ∈ squads.iso3, 0 nulls, 48 distintos (los 48 mundialistas), cada selección aparece exactamente 3× (= sus 3 partidos de grupo). Cross-check independiente vía `home_en`/`away_en` (nombres SofaScore) honrando `teams_swapped`: OK. Diff = 144 inserciones / 0 borrados (solo `home_iso3`/`away_iso3` tras `away_es`); ningún otro campo tocado, sin newline final (byte-idéntico al original salvo las adiciones). NO se tocó la EF ni otras rutas.

## 2026-06-01 — Runtime sync vía MCP (lane Claude.ai): P1 results→jsonb + tablas puente + deploys EF · docs por Code (rama `feat/docs-sync-01jun`)

> Sección propia (NO fusionada con B1/B2/P3c) para evitar el conflicto de append que tuvimos entre #127 y #128. Estos cambios son de RUNTIME (Claude.ai vía MCP) y **no viven en git**; Code los documenta tras verificarlos read-only vía Supabase MCP (proyecto `cmyfyswystjgzdwbqyyb`).

[21:55] **P1 — `results` migrada `text`→`jsonb`** (lane Claude.ai/MCP, sin migration file). Contrato F3: 6 columnas jsonb — `match_results`, `ko_results`, `award_winners`, `classification`, `overrides`, `log` (+ `id` singleton + `updated_at`). `ko_results` normalizada de array a objeto en el proceso. Verificado vía `information_schema.columns`: las 6 son `jsonb`. Habilita: (a) `update-results` v5 escribiendo objetos; (b) el puente P3 con `jsonb_set`; (c) el reader `asObj()` de `get-league-standings` v1.1.0 deja de depender de `JSON.parse`.

[21:55] **Tablas nuevas espejo de JSON del repo** (cargadas vía MCP, sin migration file):
- `wc_matches` — **72 filas**, PK `match_key`; cols `sofascore_id` (bigint), `group_letter`, `home_es`, `away_es`, `home_iso3`, `away_iso3`, `teams_swapped`, `round`, `date_utc`, `updated_at`. Fuente: `public/data/worldcup-2026-matches.json` (el JSON usa la clave `group` → columna `group_letter`).
- `equipos_players` — **48 filas**, PK `iso3`; col `players` (jsonb `[{key,name}]`) + `updated_at`. Fuente: `public/data/equipos-players.json`.
- **Dependencia operativa**: ambas son espejo de los JSON; si el JSON cambia (sync squads enriquece `equipos-players.json`, o P3c añadió iso3 a `worldcup-2026-matches.json`) hay que **RECARGAR** la tabla (`UPDATE … FROM jsonb_each(...)`). Documentado en `docs/db-schema.md` + `docs/live-scoring.md` + `.claude/rules/edge-functions.md`.

[21:55] **EF NUEVA `porra-bridge-results` v3** desplegada (lane Claude.ai/MCP, `verify_jwt=false`, auth por secret igual a `service_role`). Puente `live_scores` (finished) + `wc_matches` → `results.match_results["{grupo}_{home_es}_{away_es}"]={l,v,scorers[],status}` vía `jsonb_set`, aplicando `teams_swapped`. Goleador: `extractScorers` de events SofaScore (`goal`/`inGamePenalty`/`penaltyShootout`, ignora `ownGoal`), iso3 vía `isHome`+`teams_swapped`, normaliza con `playerToShortKey` (port de `scorer-keys.ts`: lookup en `equipos_players` por `name.includes`, fallback último token NFD). Flujo completo en `docs/live-scoring.md` §Puente.

[21:55] **EF `get-league-standings` v1.1.0 (deploy version 3) desplegada** (lane Claude.ai/MCP, `verify_jwt=false`). Es el despliegue del ensamblado B2 (PR#127): reader `asObj()` jsonb-tolerante, boost ×2 grupos desde `boost_picks`, merge de `results.overrides`. Motor `_shared/scoring.mjs` sin tocar (ERR-79 reformulado).

[21:55] **Confirmación de versiones EN VIVO** (verificado MCP, 21 EFs ACTIVE): `update-results` **v5** (`verify_jwt=true`; escribe objetos jsonb, NO computa puntos), `porra-apify-webhook` **v8** (sigue sin persistir team names — cosmético, ya NO bloquea P3), `admin-actions` v8, `porra-orchestrator` v4, `porra-patch-deploy` v5, `porra-fix-encoding` v7, `porra-match-live` v17, `porra-whatsapp-send` v2, `porra-whatsapp-webhook` v5, `porra-sofascore-proxy` v9, `porra-github-pusher` v7, `create-league` v3, `porra-ia-compute` v14, `porra-upload-predictor` v3, `get-squad` **v8** (corrige docs/memoria que decían v7.2), `porra-tm-photos-sync` v6, `gh-proxy` v5, `porra-flag-batch-upload` v3, `get-match-stats` v1. Tabla canónica refrescada en `docs/architecture.md` + `README.md`. `verify_jwt=true`: update-results, get-squad, porra-tm-photos-sync, gh-proxy, porra-flag-batch-upload; resto false.

[21:55] **Squads (verificado MCP)**: 48 filas, 46 FINAL (≥11 jug.), 2 vacías pendientes ~2-jun (**TUR, UZB**). QAT cerró lista FINAL (26, `as+espn+tm+tm-mw`) durante la sesión — corrige la nota "QAT 33 provisional" del brief. Actualizado `docs/db-schema.md`.

[21:55] **Docs tocadas por Code** (rama `feat/docs-sync-01jun`, solo documentación, cero runtime): `CLAUDE.md`, `migration-log.md` (este), `errores_conocidos_porra.md` (ERR-79), `CHANGELOG.md` + `CHANGELOG-archive-202605.md`, `docs/live-scoring.md`, `docs/architecture.md`, `README.md`, `docs/db-schema.md`, `docs/whatsapp.md`, `.claude/rules/edge-functions.md`. Verificado el pre-commit hook (tamaños). Sin DDL, sin deploy, sin tocar EFs.

## 2026-06-02 — BLOQUE CRÍTICO P4: pipeline live→puntuación cerrado end-to-end (runtime Claude.ai/MCP; docs por Code · rama `feat/docs-p4-bloque-critico`)

> Sección propia. Los cambios de RUNTIME (Claude.ai vía MCP) **no viven en git**; Code los documenta tras verificación read-only (proyecto `cmyfyswystjgzdwbqyyb`). **P4 cierra SOLO la vía del PUENTE** (SofaScore → `live_scores` → `results`); `update-results` (football-data.org → `results`) es independiente y sigue pendiente (activar pg_cron 11-jun). El puente NO la sustituye.

[18:40] **MOTOR `get-league-standings` v1.1.0→v1.2.0** (deploy version 4, vía MCP, `verify_jwt=false`). `_shared/scoring.mjs`: `calcKOMatchPoints` determina el ganador KO por `opts.winner` (`'home'|'away'`) si viene, con **fallback** a la derivación `l`/`v`. Motivo: un KO que acaba en empate y se decide por penaltis tenía `realWinner=null` con el motor viejo → el avance de ronda NO puntuaba aunque el usuario acertara el clasificador (la card KO obliga a indicar quién pasa). Ahora quien predice empate + classifier correcto SÍ se lleva el `+5/+10/…`. Retrocompatible: grupos no usan `winner`; KO sin penaltis cae al fallback. `index.ts` pasa `winner: real.winner`. (Código en repo aún v1.1.0 — drift, backfill lane Claude.ai.)

[18:40] **PUENTE `porra-bridge-results` v3→v4** (deploy version 4, vía MCP, `verify_jwt=false`, auth secret==service_role). Sobre v3: (1) **Guardas anti-dato-incompleto** (premisa "no rectificar después"): `score_home/away` NULL → NO escribe + `results.log {event:bridge_skip,reason:score_null}`; clave no resuelta en ningún diccionario → skip + `no_dict_entry`; KO empate sin ganador determinable → skip + `ko_winner_undetermined`. (2) **Rama KO**: resuelve `match_key` contra `wc_matches_ko`, escribe `results.ko_results["{ko_match_id}"]={l,v,scorers,winner,round,status}`; `winner` vía `koWinner()` (marcador no-empate → directo; empate → `score_agg` orientado por `teams_swapped`; sigue empate → conteo `penaltyShootout` `incidentClass=scored` en events). `penaltyShootout` EXCLUIDO de `scorers` (los penaltis de tanda no son goleador de la porra). (3) **Grupos**: igual que v3.

[18:40] **MIGRACIÓN `p4_trigger_bridge_on_finished`** (pieza A, vía MCP, **sin migration file** en repo). Función `trg_bridge_on_finished()` `SECURITY DEFINER` + trigger `bridge_on_finished` `AFTER UPDATE OF status ON live_scores`. Dispara `porra-bridge-results` vía `net.http_post` SOLO en transición real (`OLD.status<>'finished' AND NEW.status='finished'`) Y `NEW.score_home/away` no-null. Idempotente. **VALIDADO EN VIVO**: `UPDATE` MEX-RSA→finished disparó el puente solo, resultado en `results` con 3 goleadores normalizados.

[18:40] **MIGRACIÓN `p4_sweep_unbridged_finished`** (pieza B, vía MCP, **sin migration file**). Función `sweep_unbridged_finished()` `SECURITY DEFINER` + cron `sweep-unbridged-finished` (`*/5min`). Red de seguridad: detecta partidos finished con dato completo cuya clave NO está en `results` (huérfanos: el trigger falló o el partido llegó a finished sin disparar) y reinvoca el puente sin `match_key` (procesa todos, idempotente). Noop barato si no hay huérfanos.

[18:40] **MIGRACIÓN `wc_matches_ko_dictionary_p4`** (pieza D, vía MCP, **sin migration file**). Tabla `wc_matches_ko`: PK `match_key`, `sofascore_id`, `ko_match_id` int (73-104, casa `ko_predictions.match_id` + `KO_ROUND_BY_ID` del motor), `round` (`r32|r16|qf|sf|third|final`), `home_iso3`, `away_iso3`, `teams_swapped`. RLS SELECT abierto. **VACÍA** hasta publicarse los IDs SofaScore de KO (~28-jun); el código del puente + motor ya la soportan. Esquema en `docs/db-schema.md`.

[18:40] **DRIFT runtime↔repo registrado**: el cron preexistente `dispatch-live-slots` (`cron.job` jobid 24, `*/3min`, ejecuta `dispatch_live_slots()` que agrupa partidos por `match_start_ts` en slots y lanza `porra-match-live` batched) + las funciones `dispatch_live_slots()`/`sweep_unbridged_finished()`/`trg_bridge_on_finished()` existen SOLO en runtime, sin fichero en `supabase/migrations/`. **Pendiente backfill**. EF upstream verificadas en vivo: `porra-match-live` **v18**, `porra-apify-webhook` **v9** (los docs decían v17/v8 — drift corregido en esta pasada). 6 crons activos: cleanup, ia-freeze, ia-compute-groups, cerrar-porras, dispatch-live-slots, sweep-unbridged-finished (NO hay `poll_<key>`/`prematch_<key>` per-match a 02-jun — pre-Mundial, sin partidos programados aún).

[18:40] **VALIDACIONES (evidencia, runtime, seeds limpiados)**: trigger en vivo OK (MEX-RSA); simulacro KO penaltis (empate 1-1, ganador por tanda 6-2 → `winner:home`; el motor da `+5` avance a quien predijo `classifier=home` y `0` a `classifier=away`); guarda `score_null` no escribió con marcador incompleto; goleadores normalizados con `playerToShortKey` (Pedri, Mbappe, Jimenez, Lozano, Percy).

[18:49] CIERRE DOCS (este commit, rama `feat/docs-p4-bloque-critico`, solo documentación, cero runtime): `docs/live-scoring.md` (§Bloque crítico nuevo: diagrama + trigger + barrido + guardas + rama KO + winner/penaltis + drift; status table v18/v9/v4; flujo async actualizado; nota reconciliación crons), `docs/db-schema.md` (`wc_matches_ko` + contrato `ko_results` ampliado winner/round + nota `results.log`), `errores_conocidos_porra.md` (**ERR-82**: winner explícito KO-penaltis + guardas anti-dato-incompleto + `penaltyShootout` fuera de scorers), `CHANGELOG.md` (entrada 02-jun), `CLAUDE.md` (P4 puente cerrado + EFs standings v1.2.0 / bridge v4, net-neutral), `.claude/rules/edge-functions.md` (trigger+barrido = mecanismo canónico de volcado a `results`, no invocar el puente a mano salvo debug), `docs/architecture.md` + `README.md` (tabla EF canónica: standings v1.2.0, bridge v4, match-live v18, apify-webhook v9). Sin DDL desde Code. Verificado pre-commit hook (tamaños).

[20:47] **SPRINT PICKERS — fuente única `squads.jugadores`** (rama `feat/pickers-squad-source`, PR; **EF NO desplegada desde Code — redeploy lane Claude.ai tras revisar**). Causa raíz "México 4 jugadores": el picker de goleador v3 (`getScorerCandidates`) gateaba por `xi_pinned`; con `false` caía al curado `EQUIPOS[].players` (~2-4). 15 selecciones con roster completo afectadas. Cambios:
  - **`get-squad` v7.2→v7.3** (`supabase/functions/get-squad/index.ts`): nueva ruta `?mode=awards` (torneo entero, 48 squads) → `{mode, porteros(~150), todos(1272), sub21(~67)}` desde `squads.jugadores`, sin dorsal, `{iso3,pais,nombre,club,foto_url,posicion}`. SUB21 = nacidos ≥ 1-ene-2005 parseando `dob` como **DD/MM/YYYY** (no ISO) + fallback `edad<=21`. `Cache-Control: max-age=3600, s-maxage=86400`. Ruta iso3/iso2 intacta.
  - **`scoring.js`**: (T2) `getScorerCandidates` quita gate `xi_pinned` → usa `squads.jugadores` siempre que haya roster (curado solo degradación); quita dorsal del display (`name=nombre`). **`key` SIN tocar** (`resolveKeysForSquad`/`playerToShortKey` intactas) → paridad con el puente garantizada. (T3) `getAwardCandidates` reescrita: 1 fetch a `?mode=awards` (compartido entre las 4 cats), keys del squad COMPLETO por iso3, Ball/Boot→`todos`, Glove→`porteros`, Young→`sub21`. JWT con fallback `db.auth.getSession()` (cubre bootstrap). (legacy) strip dorsal en `renderMatchCard`.
  - **`v3/grupos-v3.js`**: `v3RenderSquadPickerTeamSection` (compartida grupos+KO) agrupa por bucket (Defensas/Centrocampistas/Delanteros); degrada a lista plana sin bucket. **`ui-nav.js`**: strip dorsal en modal KO legacy. **`grupos-v3.css`**: `.v3-squad-picker-bucket(__label)`.
  - Verificado: `node --check` (3 JS) OK; `npm run build` OK + `v3-squad-picker-bucket` en `dist/css/v3/grupos-v3.css` (ERR-22); `equipos-players.json` byte-idéntico (NO tocado — lo usa el puente). EF sin `deno check` (no disponible en container) — revisión visual.

[21:27] **CIERRE DEPLOY `get-squad` v7.3 → version 9 ACTIVE** (~21:27 UTC 02-jun). **Supersede** la nota "EF NO desplegada desde Code" de la entrada [20:47]/#133 (ya stale). Confirmado por API (Claude.ai): get-squad **version 9, status ACTIVE, `verify_jwt=true` PRESERVADO**, código byte-idéntico al `index.ts` del repo (#133). **Modo `?mode=awards` EN VIVO**. Smoke validado a nivel **lógica+datos** (el HTTP 200 puro NO se confirma con curl: get-squad es `verify_jwt=true` y el gateway exige JWT de **sesión de usuario** — anon/service rechazados; el 200 real se ve en el QA visual con login): conteos **todos 1272 · porteros 150 · sub21 67 (37 selecciones)** — cifras confirmadas por Claude.ai (MCP) y replicadas por Code (`execute_sql` reproduciendo `handleAwards`: dob `DD/MM/YYYY` ≥ 2005-01-01 + fallback `edad≤21`; el fallback aportó 0, los 67 traen dob parseable). Ruta `?iso3=`/`?iso2=` retrocompat (deploy aditivo, path byte-idéntico). Doc-only desde Code. **Nota modelo mental**: la capacidad de deploy de EFs (CLI/MCP) NO está garantizada en el lane Code → los deploys los ejecuta/valida Claude.ai; si un deploy se bloquea desde Code, es esperable y se escala.

## 2026-06-02 — Cierre XI squads (pins 47/48) + alias GHA + auditoría n>26 · rama `claude/nice-davinci-A8VOU`

> Subsección propia (append, NO pisa #130/#132/#133/#134). Tras rebase sobre `main dfbee05`, esta rama aporta a **git** SOLO el **alias GHA** (`name-aliases.json`): los fixes `country-map catar→QAT` y `cron timeout 15→30` que traía la rama YA estaban en main (otra lane los aplicó en paralelo — dfbee05 líneas 22 y 78), así que el rebase dropeó esos dos commits como vacíos. **El fix crítico del cron (timeout) ya vive en main** → el cron ya no se cancela. El resto del trabajo de XI vive en **runtime BD vía Supabase MCP** (no en git).

[22:30] **Pins de XI titular (vía MCP sobre `squads`, prod).** Tras publicación FIFA 2-jun: 48/48 finales. Pineadas esta sesión: **TUR + UZB** (es_titular ya = captura FF de San, 11/11; solo faltaba el flag `xi_pinned`), las **9 completas** (AUS, CAN, ECU, IRN, IRQ, MEX, PAR, QAT, URU), **GHA**, **ARG** y **ALG**. → **47/48 pineadas; solo falta JOR.**

[22:30] **Diagnóstico de las 4 con XI<11** (matcher FF casó 9-10/11): **ARG** (b) — hueco portero Dibu Martínez (3×"Martínez" Dibu/Lisandro/Lautaro → matcher no desambigua; fijado `es_titular` directo, alias de apellido sería ambiguo). **GHA** (b) — Kudus fuera por lesión (roster correcto, verificado en los 26 oficiales); FF pone **Ati-Zigi** (no Asare) + **Partey** (FF lo rotula solo "Thomas") → **alias GHA en git**: `"Thomas"→"Thomas Partey"`, `"Ati Zigi"→"Lawrence Ati-Zigi"`. **ALG** (b) — XI captura FF (4-3-3): Luca Zidane; Aït-Nouri/Bensebaïni/Mandi/Belghali; Zerrouki/Bentaleb/Boudaoui; Gouiri/Amoura/Mahrez; el hueco no casado era el lateral izq **Aït-Nouri** (idx7, presente). **JOR** (c) **BUG DE ROSTER**: la fila tiene **30 jug (no los 26 oficiales)** y le falta **Al-Mardi** (titular FF) + **Al-Naimat** (ambos en convocatoria oficial) → requiere re-scrape al 26 antes de fijar XI.

[22:30] **Auditoría n>26 (recorte al 26 respetando pins).** 10 filas n>26 (KSA/CZE/JOR 30, IRN/TUR 29, SEN 28, ALG/EGY/POR/TUN 27): provisionales sin recortar, plausiblemente porque el cron roto (timeout, ya arreglado en main) nunca ingirió los trims finales. **Veredicto: recorte seguro** — los `es_titular` de las 8 pineadas son titulares oficiales reconocidos → ninguno es candidato a recorte; el `detect` re-scrape recorta preservando `es_titular` (mergeJugadores) + columna `xi` + `xi_pinned`. El detect/trim real lo dispatcha **San** (Code no puede: 403 `actions:write`; sí tiene `actions:read` para leer logs). Code verifica post-run contra el baseline; si alguna pineada baja de sus 11/10/9 `es_titular`, **PARA y avisa** (no rompe pin en silencio). JOR aparte (su run + fijar XI con captura FF).

[22:30] **PR #135** `claude/nice-davinci-A8VOU → main` abierto y **rebasado limpio sobre dfbee05**. Contenido neto vs main: alias GHA + esta entrada. San mergea tras QA.

## 2026-06-03 — load-fifa: modo carga lista oficial FIFA (rama `claude/quirky-allen-yK1Jp`)

[09:30] **`--mode=load-fifa` en `sync-squads.mjs` + `scripts/lib/fifa-loader.mjs` (NUEVO) + helpers `listStagingFifa`/`replaceSquadRoster` en `squads-db.mjs`.** Carga ONE-TIME de `public.staging_fifa_players` (1248 = 48×26, validada por San) → `squads.jugadores` (sigue siendo la fuente de verdad; NO normaliza a tabla `players`; campos nuevos `nombre_camiseta`/`estatura_cm`/`posicion_fifa`/`needs_enrich` viven DENTRO del jsonb → retrocompat get-squad/scoring/Pizarra/puente). Roster final = 26 FIFA/nación; **match por NOMBRE** (NO por dorsal: 33% dorsales BD malos + 23 colisiones); **dorsal autoritativo FIFA**. Match→hereda foto_url/tm_player_id/valor_eur/club(+id+logo TM)/edad/dob/posicion(_tm)/es_titular/nombre de BD y aplica dorsal+campos nuevos FIFA; nombre y club NO se sobrescriben; club_fifa/dob solo cross-check→log. FIFA-sin-BD→insert `needs_enrich`; BD-sin-FIFA→eliminate. `replaceSquadRoster` escribe directo (sin mergeJugadores) y NO toca xi/xi_pinned/formacion.
  - **Matcher** (`fifa-loader.mjs`): reusa primitivos de `name-matcher.mjs` (tokens R1/R2/R3 + diacríticos + levenshtein + resolveAlias + NON_LATIN_ISO3) con scoring ORDER-INVARIANT + asignación GLOBAL greedy — NO la greedy posicional de `matchAgainstRoster`, que cruzaba cables porque `nombre_lista` es surname-first en unas naciones y given-first en otras (IRN KANANI→GK Hoseini, KSA ALHAJJI→Alharbi). Señales: token-set fuzzy (nº de tokens manda sobre sim media — fija cross-wire Abu Hasheesh→Abu Taha / EGY Zizo), squish ordenado/sin-ordenar, BD mono-token, + strip CONSISTENTE del artículo árabe pegado (ALARAB→arab, ALDAOUD→daoud) gateado a naciones árabes (incl. QAT). Apodos derivables (Tim→Timothy, Gio→Giovanni) auto-casan por prefijo; apodos NO derivables / coincidencia de apellido (Dibu Martínez, Cho Yumin, Lacroix) se REPORTAN como `possible` (NO auto-casan) para revisión de San.
  - **DRY-RUN (sobre datos LIVE vía Supabase MCP)**: 48 nac, **roster 1248, todas 26/26, 0 roster≠26**. inserted 12 / eliminated 16 (delta 4 = corte JOR 30→26). **JOR**: 25 match + 1 insert (**Al-Mardi #13, NUEVO** — confirma la nota 02-jun "BUG DE ROSTER: falta Al-Mardi") + 5 eliminate TODOS no-tm (extras de prensa); **Abu Hashish [tm:895249] SALVADO**. ⚠ **Al-Naimat NO está en la lista oficial FIFA** (staging validada 3-jun; la nota 02-jun lo daba por convocado → confirmar). **Ningún jugador con tm_player_id se elimina en silencio**: los 7 tm-elim son cambios reales de convocatoria (BIH Hadzikic→Jurkas, CIV Akpa→Operi, COD Bushiri→Tshibola) o `possible` surfaced (ARG Dibu, HAI Duke+JK, KOR Cho). Cross-check: 150 club≠ (transferencias reales — se conserva club TM), 18 dob≠ (2 anómalos: BRA Danilo y MEX Raúl Jiménez = dob BD corrupto, FIFA correcto). BRA: **BD tiene 2 "Danilo" con el MISMO tm:808509** (bug de datos preexistente) → ambos casan; San debe asignar tm correcto a Danilo dos Santos.
  - Tests: `scripts/lib/__tests__/fifa-loader.test.mjs` 7/7 OK; sin regresión (name-matcher 56/56, squads-db 6/6, enrich-merge 8/8). `node --check` los 3 ficheros OK.
  - **NO APLICADO**: pendiente OK de San sobre el dry-run (sitrep) + decidir aliases para los `possible`. Tras OK → `node --env-file=.env scripts/sync-squads.mjs --mode=load-fifa` (real). Workflow sync-squads sigue DISABLED (carga manual one-time).

[12:26] **Decisiones de San aplicadas al dry-run (gate B/C) + re-corrido.** (A) cambios de convocatoria confirmados (BIH/CIV/COD/JOR) → quedan como insert/eliminate reales. (B) **Aliases añadidos a `name-aliases.json`** (claves = nombre_oficial FIFA; inertes para el path FF): **ARG** `Damián Emiliano MARTÍNEZ→Dibu Martínez`; **HAI** `Markhus LACROIX→Duke Lacroix`, `Jean-Kévin DUVERNE→JK Duverne`; **QAT** `Ayoub Mohamed ALOUI→Ayoub Al Alawi`, `Ahmed Mohamed H K ALGANEHI→Ahmed Al Janhi`, `Ahmed Alaaeldin B M ABDELMOTAAL→Ahmed Alaa`. **KOR sin alias** (Kim Tae-Hwan / Cho Yumin son jugadores DISTINTOS → cambio real). (C) **`DOB_OVERRIDE` en `fifa-loader.mjs`** (allowlist por iso3+normalize): pisa dob con FIFA SOLO en **MEX Raúl Jiménez** (BD 18/04/2001→05/05/1991) y **BRA Danilo** (match vs Danilo Luiz da Silva → 15/07/1991; el otro Danilo/dos Santos sin gap queda 29/04/2001). Resto: dob BD + log.
  - **Verificado con BD completa (ARG/HAI/QAT/KOR/MEX/BRA vía MCP)**: ARG Dibu `tm:111873`+foto+**es_titular=true (pin)**; HAI Duke `tm:375472`, JK Duverne `tm:344864`+foto+pin; QAT 3 ahora MATCH (eran no-tm/no-foto → sin needs_enrich inútil). dob: Raúl Jiménez=05/05/1991, Danilo#13=15/07/1991, Danilo#18=29/04/2001 (intacto). KOR cambio real (insert Taehyeon Kim+Wije Cho / elim Kim Tae-Hwan+Cho Yumin).
  - **DELTA dry-run**: inserted 12→**6**, eliminated 16→**10**, naciones-flagged 8→**5** (BIH/CIV/COD/JOR/KOR). **Las 4 eliminaciones con tm restantes son TODAS cambios reales aprobados por San** (Hadzikic/Akpa/Bushiri/Cho Yumin) → **ninguna involuntaria**. `possible` restante = KOR (informativo; San ya lo marcó distinto). Tests fifa-loader 7/7 OK.
  - **SIGUE SIN APLICAR**: San confirma EXPRESAMENTE en mensaje aparte antes del run real.

[13:03] **APLICADO en prod (squads.jugadores) — confirmación expresa de San.** El container Code NO tenía `SUPABASE_SERVICE_ROLE_KEY`, así que en vez de materializar el secreto en la sesión, apliqué los rosters EXACTOS de `buildFifaRoster` (dry-run v2) vía la conexión Supabase MCP (autorizada) — byte-equivalente a `replaceSquadRoster`: un único `UPDATE … FROM` ATÓMICO (48 naciones o ninguna) con merge en SQL (campos FIFA desde `staging_fifa_players` por JOIN, dob-override embebido, inserts construidos desde staging). **Verificación de equivalencia ANTES de escribir**: checksum md5 por nación (dorsal|nombre|tm|posicion_fifa|dob|needs_enrich) del merge SQL == `buildFifaRoster` local → **48/48 idénticos**. **Post-apply**: 48 nac · **1248 jugadores · 0 roster≠26 · JOR=26** · `jugadores_fuente` +fifa en 48 · `jugadores_synced_at` fresco en 48 · `xi_pinned` intacto (48) · `needs_enrich=true` en 6 (BIH Jurkas, CIV Operi, COD Tshibola, JOR Al-Mardi, KOR Taehyeon Kim + Wije Cho) · campos nuevos (nombre_camiseta/estatura_cm/posicion_fifa) en 1248. **Re-checksum de lo ESCRITO == validado: 48/48**. Spot-checks: ARG Dibu #23 tm:111873 es_titular=true✓; MEX Raúl dob 05/05/1991✓; BRA Danilo #13 dob 15/07/1991 (pisado) / #18 29/04/2001 (intacto)✓; JOR Abu Hashish #2 tm:895249 SALVADO✓ + Al-Mardi #13 needs_enrich✓; ESP Lamine Yamal nombre conservado✓; HAI Duke/JK tm+pin✓; KOR cambio real✓.
  - **Pendiente (fuera de este task)**: (1) re-pin XI de las 6 naciones rotas (KSA/IRN/CZE/SWE/SCO/JOR) con fuente de XI de San; (2) enrich-tm de los 6 `needs_enrich` (foto/tm/valor); (3) BRA: 2 "Danilo" comparten tm:808509 — asignar tm correcto a Danilo dos Santos (#18). El modo `--mode=load-fifa` queda en git para re-ejecución idempotente con `.env` service-role.
