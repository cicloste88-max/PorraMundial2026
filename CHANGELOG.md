# CHANGELOG — Porra Mundial 2026

Retención 90d. Auto-archivado a `CHANGELOG-archive-YYYYMM.md` si supera 30KB.

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

## 2026-04-30 — Turnstile DESACTIVADO (Supabase Auth dashboard)

**Auth / Decisión arquitectónica.** Tras 2 días con Cloudflare Turnstile en login (PR#39+PR#40, 29abr), CAPTCHA desactivado en Supabase Auth dashboard. Razones: app privada (porra entre amigos), fricción innecesaria, **Supabase Cloud expone un único secret slot por proyecto** (no se puede separar dev/prod) y **Cloudflare no acepta hostnames con port** (bloqueando `localhost:5173`). El widget HTML/JS en `index.html` y `auth.js` se mantiene intacto (no estorba; no ejecuta sin secret en Auth). No es bug del código — es limitación arquitectónica del stack. NO añadido a `errores_conocidos_porra.md` (no es ERR).

## 2026-04-30 — F7.X nuevo shell visual #page-elim (PR#44)

**Rediseño Fase final** (8 commits, +872 −66 LOC, merge SHA `5ddb974`).

- **Files nuevos**: `public/js/ui-elim-shell.js` (+545 LOC, controlador shell), `public/css/components/elim-shell.css` (+295), `public/css/components/elim-tokens.css` (+30 design tokens).
- **Wiring**: `js/main-entry.js` carga `ui-elim-shell.js` en chain; `public/js/ui-nav.js` invoca `mountElimShell()` al entrar a page-elim; `public/js/components/bottom-tab.js` retira el gate modal `_showGruposGateModal` (Fase final ahora accesible siempre, shell muestra estado coherente con `window._gruposComplete`).
- **Cards CORE preservadas**: las tarjetas de eliminatorias existentes (R32→R16→QF→SF→Final) NO tocadas — el nuevo shell envuelve manteniendo grilla + comportamiento.
- **Bug UI #3 corregido** (botón simular eliminatorias visible para todos): gate ahora chequea `is_admin` correctamente vía `window._isAdmin`.
- **Sub-vistas KO/Awards/finalizar-section diferidas**: scope estricto al shell + tokens + wiring. Iteración cosmética posterior.
- **Patrón multi-agente**: 4 subagentes Haiku 4.5 paralelos vía Task tool en 2 oleadas (oleada 1: PorraHeader + PhaseStepper; oleada 2: ElimRow + ElimExpanded). Split POR COMPONENTE — cada subagente portó un componente completo de JSX a vanilla JS + sus reglas CSS. Padre integró todo en `ui-elim-shell.js` + `elim-shell.css` y resolvió mismatches de selectores y escapes.
- **Design source v2 persistente**: bundle de referencia push-eado a branch dedicada `docs/quiniela-design-source-v2` (commit `fd95d08`). Patrón a seguir para futuros design source bundles (vs embed inline en briefs).

## 2026-04-30 — F7.4-D-2 cleanup IA Predictor widgets (PR#43)

**Cleanup CSS** (commit `0baaa4a`).

- **`public/css/base.css` −18 LOC**: bloque IA duplicado en líneas 701-713 eliminado; reglas huérfanas `.ia-loading`, `.ia-dot`, `@keyframes iaDot` (sin uso tras eliminar chip `.ia-hint` en post-F.2 y `hydrateIABar` actual no usa spinner) borradas.
- **`scoring.js` NO tocado**: la lógica de hidratación IA permanece intacta. Solo CSS muerto retirado.
- Reduce superficie de mantenimiento del Predictor sin tocar comportamiento. Smoke verde post-merge (cards de grupo siguen pintando `.ia-bar` con %, signo, quip).

## 2026-04-29 — Cloudflare Turnstile CAPTCHA (PR#39 + PR#40)

**Auth / Seguridad.**

- **PR#39** (`8b1dc30`): Cloudflare Turnstile CAPTCHA (Managed mode) en formulario de login. Script `api.js` en `<head>`, widget `cf-turnstile` antes del submit, token leído de `[name=cf-turnstile-response]` y pasado vía `options.captchaToken` en `signInWithPassword`. Widget reseteado con `window.turnstile.reset()` tras cada intento. Sitekey + secret en Vault (`TURNSTILE_SITE_KEY`, `TURNSTILE_SECRET_KEY`). Secret además configurada en Supabase Auth → Attack Protection.
- **PR#40** (`7467a4b`): test sitekey `1x00000000000000000000AA` (always-passes) en `localhost` para evitar error 110200; sitekey real `0x4AAAAAADFzAxFI4isPOuJx` en producción. Detección vía `window.location.hostname === 'localhost'`. Banner rojo "Solo para pruebas" en local es esperado.

## 2026-04-28 — Audit Postgres (Claude.ai + Code, ERR-33)

**Database (audit 28abr).**

- Aplicado vía Claude.ai (Supabase MCP) en sesión inicial: RLS en `orchestrator_jobs`; `search_path` + grants tightening en 4 funcs de control (`handle_new_user`, `enforce_max_leagues_per_user`, `schedule_match_crons`, `unschedule_match_crons`); fix `get_vault_secrets`; DROP `idx_award_picks_league` e `idx_ko_predictions_league`.
- Aplicado vía Claude Code (migrations preparadas + apply Supabase MCP desde Claude.ai, registradas en `schema_migrations` con timestamps `20260428020438`/`20260428020439`): DROP `_fix_encoding_temp`, DROP view `refactor_status`, `search_path` en `is_porra_abierta` (sin tocar grants — ver **ERR-33**), +7 índices en FKs (`award_picks.user_id`, `boost_picks.league_id`, `ia_predictions.snapshot_id`, `ko_predictions.user_id`, `leagues.created_by`, `predictions.user_id`, `whatsapp_subscribers.user_id`).
- Fix post-PR#36 (28abr 02:33 UTC): RLS+policy `service_only` en `tmp_upload_files` (advisor ERROR `0013_rls_disabled_in_public`). 1 ERROR → 0 en advisor security.
- Items 3+4 (28abr 03:00 UTC, migration `20260428030000`): DROP 4 dup SELECT policies (`award_picks_select`, `boost_picks_select`, `ko_predictions_select`, `predictions_select` con `USING(true)`) + 17 RLS rewrites `auth.uid()` → `(SELECT auth.uid())` en `award_picks`, `boost_picks`, `ko_predictions`, `predictions`, `league_members`, `leagues`, `profiles`. Diff advisor: `auth_rls_initplan` 19 WARN → 2; `multiple_permissive_policies` ~30 → ~5.
- Items 2+5 (28abr 04:00 UTC, migration `20260428040000`): DROP 4 storage listing policies (`flags_public_read`, `kits_public_read`, `miniatures_public_read`, `sites_public_read` — buckets `public:true` no necesitan RLS para servir objetos vía URL directa) + DROP `public.tmp_upload_files` (scripts Python backtest WC2022 Fase E ya cumplida; motor en TS en EF `porra-ia-compute v10`). Diff advisor: `public_bucket_allows_listing` 4 WARN → 0.
- Backlog tras esta sesión: solo queda **Auth dashboard leaked password protection** (HaveIBeenPwned, 1 click San en Supabase → Authentication → Policies). Items 1-5 del backlog post-audit cerrados.


---

*Entradas anteriores a 2026-04-28 archivadas en `CHANGELOG-archive-202604.md`.*
