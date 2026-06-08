# CHANGELOG — Porra Mundial 2026

Retención 90d. Auto-archivado a `CHANGELOG-archive-YYYYMM.md` si supera 30KB.

## [08-jun-2026] Gate de boosts obligatorios antes de cerrar la porra (v3)

Rama `claude/wonderful-thompson-K5LK5`. El cierre v3 (`v3FinalizarPorra` en
`public/js/v3/eliminatoria-v3.js`) **no validaba los boosts** de jornada
(obligatorios: 1 por día de grupos). El botón "Cerrar y enviar mi porra" saltaba
la regla publicada ("Sin todos los boosts asignados no se puede cerrar la
porra") — **7 usuarios cerraron con 0 boosts**. El cierre legacy
`close-porra.js` sí los gateaba; el path v3 no.

- **Fix**: el chequeo BD del cierre suma una 4.ª query (`boost_picks`) y exige
  **1 boost por jornada de grupos**, mapeando los días con el mismo calendario
  que usa el front (`PARTIDOS`). Validación por pertenencia de día (no `count≥N`):
  "2 boosts en un día y 0 en otro" bloquea igual.
- **UX**: si falta algún boost → mensaje claro + navegación al selector
  (`showPage('jornada')` + scroll a `#boost-ticker`), **sin** ejecutar el UPDATE
  de `league_members.porra_cerrada`. Fail-closed ante error de lectura.
- **Nota**: la regla son **17** jornadas (jun 11–27), no 12 — confirmado por
  `PARTIDOS`, `close-porra.js:150`, checklist `index.html` ("0/17") y la regla en
  `index.html`; el gate lo deriva dinámicamente. No se toca el selector de boosts
  (verificado operativo: escribe en `boost_picks`, `match_id` = clave de
  `predictions.match_id`). Pendiente: backfill de los 7 cierres previos.

## [02-jun-2026] Bloque crítico P4 — pipeline live→puntuación automático

Multi-lane (runtime Claude.ai/MCP + docs Code, rama `feat/docs-p4-bloque-critico`).
El volcado `live_scores` → `results` pasa a **automático**; cierra la vía del
**puente** (SofaScore). `update-results` (football-data.org) sigue pendiente e
independiente (pg_cron 11-jun) — el puente NO la sustituye.

### Runtime (lane Claude.ai/MCP — no vive en git)

- **Motor `get-league-standings` v1.1.0→v1.2.0**: `calcKOMatchPoints` acepta
  `opts.winner` con fallback `l`/`v` → arregla el avance de ronda en **KO por
  penaltis** (antes `realWinner=null` no puntuaba el classifier acertado, ERR-82).
- **Puente `porra-bridge-results` v3→v4**: rama **KO** (`wc_matches_ko` →
  `ko_results` con `winner` vía `koWinner()`/desempate por tanda; `penaltyShootout`
  fuera de `scorers`) + **guardas anti-dato-incompleto** (skip + `results.log`).
- **Trigger `bridge_on_finished`** + **cron `sweep-unbridged-finished` (`*/5min`)**
  = disparo automático del puente (antes manual). Validado en vivo (MEX-RSA) +
  simulacro KO penaltis.
- **Drift**: trigger/funciones/`dispatch-live-slots`/`wc_matches_ko` solo en
  runtime (sin migration file). Upstream verificado: match-live **v18**,
  apify-webhook **v9**.

### Docs (lane Code)

§Bloque crítico en `docs/live-scoring.md`; `wc_matches_ko` + contrato `ko_results`
+ `results.log` en `docs/db-schema.md`; **ERR-82**; tabla EF canónica
(`architecture.md` + `README.md`: standings v1.2.0, bridge v4, match-live v18,
apify-webhook v9); `CLAUDE.md`; `.claude/rules/edge-functions.md`.

## [01-jun-2026] Jornada motor + entrada + puente live (B1 #128 · B2 #127 · P1 · P3 · #126)

Sesión multi-lane (Code + Claude.ai). Code commitea docs/datos/tests; Claude.ai
opera runtime (migraciones + deploys EF) vía MCP. `main` cierra en `b89a5c9`.

### B2 — Ensamblado scoring server-side (PR#127 `ceb7be1`)

EF `get-league-standings` **v1.0.1→v1.1.0** (deploy version 3). El motor
`_shared/scoring.mjs` NO se toca — era correcto (**ERR-79 reformulado**: el bug
siempre fue de ENSAMBLADO). Cambios en `index.ts`:
- **Reader type-tolerant `asObj()`** sustituye los 3 `JSON.parse` → acepta TEXT u
  objeto ya parseado, sobrevive a la migración `results`→jsonb sin acoplarse.
- **Boost ×2 grupos** desde `boost_picks` (`boostByUser[uid]` Set por `match_id`).
  KO sigue sin boost (pendiente backend).
- **Merge de `results.overrides`** ENCIMA del canónico de grupos por clave.

`update-results` traída al repo desde el deploy v5 (escribe objetos jsonb; NO
computa puntos). `tests/scoring.test.mjs` extendido: paridad shared↔legacy a las
3 funciones + boost exacto + iaBonus + wiring de ensamblado; carga del legacy por
marcadores de función (no `slice` por nº de línea).

### B1 — Entrada UI Tier-0 (PR#128 `8791775`, validado en device real de San)

- **FX-13** scroll del picker de goleador (móvil): el `__inner` pasa a ser el
  scroller (`overflow-y:auto` + momentum iOS + `overscroll-behavior:contain`),
  `max-height: calc(100dvh - var(--fc-tab-h) - var(--fc-safe-bottom) - 28px)` con
  tokens en `public/css/components/tokens.css`. Causa raíz del recorte: tabbar
  `z-index` 300 > picker 130 (ERR-65/66).
- **FX-14** quitar porteros del picker (`getScorerCandidates` filtra
  `j.posicion !== 'Portero'`; fallback sin XI conserva plantilla). Clave de
  posición = `posicion` (NO `posicion_bucket`).
- **FX-01** verde indebido en grupos: selector CSS sin `.is-qualified` eliminado
  + gate `v3GroupHasRealResults()` (realce solo con resultados reales).

### P1 — `results` text→jsonb (runtime, lane Claude.ai/MCP)

Tabla `results` migrada a 6 columnas **jsonb** (contrato F3:
`match_results`/`ko_results`/`award_winners`/`classification`/`overrides`/`log`);
`ko_results` normalizada array→objeto. `get-league-standings` v1.1.0 desplegada.

### P3 — Puente `live_scores → results` (datos #129 + runtime bridge)

- **P3c (PR#129 `b89a5c9`)**: `home_iso3`/`away_iso3` en las 72 entradas de
  `public/data/worldcup-2026-matches.json` (144 valores, 0 nulls, todos ∈
  `squads.iso3`).
- **Runtime (lane Claude.ai/MCP)**: EF nueva **`porra-bridge-results` v3** +
  tablas `wc_matches` (72) y `equipos_players` (48), espejo de los JSON del repo.
  Lee `live_scores` finished + `wc_matches` → `results.match_results` vía
  `jsonb_set`, normaliza goleador (`extractScorers` + `playerToShortKey`, ignora
  `ownGoal`), aplica `teams_swapped`. Detalle en `docs/live-scoring.md` §Puente.
  ⚠️ Recargar `wc_matches`/`equipos_players` si cambian los JSON fuente.

### #126 — CI + sync (`b065f63`)

Cron Sync Squads `timeout-minutes` 15→30 (el run se cancelaba a 15m antes de
escribir BD). `country-map.json`: alias `catar`→QAT (Qatar se descartaba de las
fuentes primarias españolas).

### Docs (este sprint, rama `feat/docs-sync-01jun`)

Tabla EF canónica refrescada a 21 EFs ACTIVE en `docs/architecture.md` +
`README.md` (drift previo: `porra-match-live` v17, `admin-actions` v8,
`porra-ia-compute` v14, `get-squad` v8… + altas `get-league-standings` /
`porra-bridge-results` + 5 EF placeholder pendientes). Nuevas tablas en
`docs/db-schema.md` (`results`/`wc_matches`/`equipos_players`). Puente en
`docs/live-scoring.md`. ERR-79 reformulado. Squads (MCP): 48 filas, 46 FINAL, 2
vacías pendientes ~2-jun (TUR, UZB); QAT cerró FINAL (26) en la sesión.

## [01-jun-2026] PR-1 leaderboard liga — EF get-league-standings + render Trofeo (PR#123, `a1e3da9`)

Sprint pantalla "Clasificación de liga" cerrado. Arquitectura A
(server-side) sin plpgsql, reutilizando el motor JS para evitar
divergencia con el browser. **El botón trofeo del Predictor ahora abre
`page-score`** (clasificación) en lugar del modal viejo; el picker de
premios queda re-homenajeado en la tarjeta "Premios" del desglose.

### Capa 1 — Motor compartido + Edge Function

- **`supabase/functions/_shared/scoring.mjs`** (nuevo): port de
  `public/js/scoring.js` a ESM puro sin globals. `calcMatchPoints` /
  `calcKOMatchPoints` / `calcAwardPoints` / `calcClassificationPoints` /
  `iaBonusPredicate`. Constants `KO_ROUND_PTS` / `DEFAULT_AWARDS_PTS` /
  `FINAL_CLASSIFICATION_PTS` espejo del browser. Caller pasa
  `scorers/iaBonus/boost` evaluados.
- **`tests/scoring.test.mjs`** (extendido): canónicos shared + KO con
  avance + awards + `iaBonusPredicate` casos A/B/C/D + slice eval del
  legacy `public/js/scoring.js` + **parity 1:1** (8 inputs comparados
  shared vs legacy; si alguien edita uno y olvida el otro, falla aquí)
  + sección 7 "EF assembly" que ejerce el mapeo BD→motor (ver ERR-79).
- **`supabase/functions/get-league-standings/index.ts`** (nuevo, v1.0.1):
  POST + CORS whitelist, JWT manual (`verify_jwt=false`, ERR-16),
  membership check (`league_members` por uid + league_id, 403 si no),
  service role lee paralelo predictions/ko_predictions/award_picks/
  results/ia_predictions/profiles filtrados por liga. Devuelve **SOLO**
  totales agregados `[{uid,nombre,grpPts,koPts,awPts,total,hasPreds}]`
  — picks ajenos NUNCA viajan al cliente (respeta gate PR-3
  implícitamente, sin necesidad de RLS adicional). Deploy MCP version 2
  ACTIVE.

### Capa 2 — Cliente refactor

`public/js/scoreboard.js`: `sbLoad` reescrito a 1 sola invocación
`db.functions.invoke('get-league-standings', { body: { league_id } })`
— antes hacía 4 lecturas BD + cálculo cliente que sólo veía las
predicciones del usuario logueado por RLS. `_sbData`/`window._sbData`,
spinner/empty/guards/caso liga no seleccionada preservados. **RLS no
se toca**.

### Capa 3 — Render Trofeo + entry + re-home picker

- **`ui-pred-shell.js onTrophyTap`**: ahora `showPage('score')` (antes
  abría `_openTrophyModal`).
- **Re-home picker premios**: la card "Premios" del desglose pasa a
  tappable cuando `!window._porraCerrada`. Click/Enter/Space →
  `window.PorraPred._openTrophyModal`. Post-cierre queda display-only.
  Handler delegado idempotente (`_sbBreakdownDelegated`), a11y completa.
- **`public/css/clasificacion-v3.css`** (nuevo, 207 LOC): hero podio
  2·1·3 con anillos gold/silver/bronze + corona + spark gradient, lista
  con avatares iniciales + badges opcionales + trend ▲▼, desglose 4×1
  con card "Total" lime + modifier `.clz-bd-card--clickable`.
- **`scoreboard.js sbRender`**: render Trofeo (helpers `_sb*` en module
  scope). Contrato de fila idéntico y mismos IDs.
- **`index.html`**: link a `clasificacion-v3.css` tras `admin.css`.
  Refresh icónico 32×32 redondo en la appbar. DOM reordenado:
  `#sb-my-breakdown` entre `#sb-podium` y `#sb-table-wrap`.
  `.sb-table-header` legacy eliminado.

### Paridad explícita con el cliente actual

- Grupos: `iaBonus` aplicado vía `ia_predictions[match_id]`.
- KO: `iaBonus` NO aplicado (paridad con legacy `matchKey=null`).
- Boost ×2: NO aplicado en v1 (legacy también buggy, usa `boostPicks`
  del usuario logueado para todos los rows). Documentado para
  post-launch.

### Bugs cazados en QA + fixes

3 bugs detectados durante el sprint, todos resueltos:
- **ERR-79** (mapeo `scorer` BD vs `gol` motor): la EF v1.0.0 montaba
  `scorer: row.scorer` pero el motor lee `pred.gol` → +2 goleador no
  sumaba. Fix v1.0.1 (`gol: row.scorer` en los 2 mapeos) + test de
  ENSAMBLADO sección 7.
- **ERR-80** (`myId` undefined): el render Trofeo leía
  `window.currentUser`, pero `let currentUser` en `auth.js` no se
  expone a window (ERR-02). Ninguna fila recibía `is-me`,
  `#sb-my-breakdown` quedaba display:none, picker premios sin entrada.
  Fix Opción B (San): lookup coherente con `ui-groups-mobile.js` /
  `data.js` + **degradación elegante** (`me` con fallback `{0,0,0,0}`
  para pintar siempre el desglose con porra abierta).
- **ERR-81** (clipping esquinas fila #1): contenedor legacy `.sb-table`
  con `overflow:hidden` heredado recortaba `border-radius:11px` +
  box-shadow exterior de la primera `.tf-row`. 3 iteraciones falsas
  antes del runtime QA. Fix: `overflow:visible` + `padding-top:4px`.
  Lección: `getComputedStyle` NO detecta clipping del ancestor — usar
  `elementFromPoint` sobre el píxel del borde, o auditar ancestor chain
  con `overflow ≠ visible`.

### Commits clave (rama `feat/pr1-leaderboard`, squash `a1e3da9`)

`c8afa85` (Capa 1) → `bdc24cf` (Capa 2 + entry + re-home) → `5e74b29`
(render Trofeo + CSS) → `51d6314` (fix ERR-79 v1.0.1 + test ensamblado)
→ `76a7d86` (merge main) → `0ccdaeb` (fix ERR-80 + Opción B) →
`cf7567c`/`4770d18`/`55de970`/`cc4d2c5` (pulido visual 4 iters: refresh
icónico → reorder desglose → borde podio → fix raíz ERR-81). Merge
`a1e3da9` en main.

### Pendiente post-cierre

- QA del picker premios tras `window._porraCerrada=true` (cron 10-jun):
  la card "Premios" debe quedar display-only sin `--clickable` ni
  `role/tabindex/data-sb-action`. NO verificable con porra abierta —
  validar en simulacro de cierre.

### Backlog asociado (CLAUDE.md #5)

Reconciliar `public/js/scoring.js` ↔ `_shared/scoring.mjs` al 100%,
pasar la tabla canónica de puntuación a `docs/scoring-engine.md` con
tests por suceso. Activar boost ×2 en backend (v1 no aplicado por
paridad con cliente buggy). Origen: ERR-79.

## [01-jun-2026] Cierre saga refresh congelado — bug crítico resuelto, sub-síntoma de restauración deferred a feature futuro

Cierre formal del saga "refresh congelado / blank tras F5" (ver entrada
iter 1-4 más abajo + ERR-78 ampliado).

**Estado final:**

- **Bug crítico RESUELTO en producción** vía PR#125 (squash en main =
  `6e7c966`), que recogió iter 3+4. La pantalla en blanco tras F5 no
  vuelve a aparecer: `_navigateFallbackWelcome()` quita
  `#restore-lock-css` antes de cada `showPage('welcome')`, el watchdog
  redesignado con trigger semántico cubre todos los caminos de fallback,
  y el filtro de eventos no-session evita el welcome prematuro por
  INITIAL_SESSION con `session=null`. Confirmado en preview Vercel
  (Chrome MCP) + producción.
- **iter 5 NO mergeado.** El commit `1da350a` (rama
  `fix/auth-bootstrap-frozen-refresh`) añadía un gate de visibilidad
  al safety-net de `js/main-entry.js:114-115`. La hipótesis era que ese
  safety-net pisaba el `showPage('grupos')` del bootstrap. QA en preview
  con un wrapper persistente sobre `showPage` demostró que **`showPage('grupos')`
  ni siquiera se llama** en el escenario F5: el bootstrap no llega a
  invocar la restauración antes de que `main-entry.js` corra. Por tanto
  el safety-net de main-entry NO estaba pisando nada — iter 5 atacaba
  un culprit falso para ese síntoma. Rama y commit descartados.
- **Decisión de producto (San):** "restaurar la última página tras F5"
  NO es un bug crítico — es UX accesoria. El feature de persistir pantalla
  vía `porra_lastPage` / `_pendingPageRestore` nació el 20-abr
  (`feat(nav)`) y es frágil. Aterrizar en el selector de ligas tras
  refresh es comportamiento ACEPTABLE de producto. Cuando algún día se
  retome "restaurar pantalla", será como FEATURE nuevo con spec limpia,
  no parcheando el bootstrap.
- **Persistencia de DATOS intacta.** Las predicciones (216 + 96 KO
  verificadas server-side en Supabase) nunca estuvieron en riesgo. Lo
  único que se reseteaba al aterrizar en welcome era la `_activeLeague`
  en memoria, que se restaura en cuanto el usuario re-selecciona su
  liga.

**Rama cerrada:** `fix/auth-bootstrap-frozen-refresh` borrada en remoto
tras este commit. Los 5 commits de iteración quedan en el historial
de PR#125 + en el detalle de ERR-78.

**Lecciones acumuladas — saga 5 iters** (extendidas en ERR-78):

1. Validar que el handler de un listener REALMENTE corre antes de poner
   robustez dentro (iter 1→2: race de registro tardío de
   `onAuthStateChange`).
2. QA en browser real con DOM inspection es lo único definitivo —
   hipótesis sobre "qué bloquea" se confirman SOLO leyendo el DOM en el
   estado del bug, incluido CSS inyectado que no aparece en grep de
   `showPage` (iter 2→3: el lock CSS era invisible al análisis estático).
3. No todos los `null` significan "no hay sesión" — distinguir eventos
   definitivos (SIGNED_OUT, USER_DELETED) de eventos prematuros
   (INITIAL_SESSION pre-restauración). Eliminar awaits redundantes que
   abren ventanas de timing (iter 3→4).
4. **Verificar empíricamente que el código que asumes corre realmente
   corre** antes de teorizar overrides (iter 4→5: iter 5 asumía que el
   bootstrap llamaba `showPage('grupos')` y otro código lo pisaba, pero
   `showPage('grupos')` ni se llamaba). Wrapping persistente sobre
   funciones críticas (`showPage`) durante QA permite descartar
   hipótesis sin escribir código.
5. **Cuando un bug se vuelve intermitente con `readyState` o timing
   async/sync**, auditar TODOS los sitios que ejecutan durante el
   bootstrap, no solo el módulo bajo investigación (iter 4→5: 4 iters
   en `auth.js`, el ruido venía del bootstrap chain en `main-entry.js`
   — pero al final ni siquiera era el culprit).

**Sin cambios de código en este commit** (solo docs). `public/js/auth.js`
y `js/main-entry.js` quedan exactamente como están en `6e7c966`.

## [31-may-2026] Fix auth bootstrap: app congelada vacía tras refresh

**Bug (prod, iPhone + Android):** tras F5 / recarga del navegador (o con
carga lenta), la app queda "congelada": header visible (ADMIN, usuario,
"Cerrar sesión") pero el contenedor principal vacío (azul liso, sin grupos
ni nav funcional). Workaround del usuario: logout + login. Reproducido por
Claude.ai vía Chrome MCP en producción.

**Causa:** en `runAuthInit > onAuthStateChange` (`public/js/auth.js`), branch
`INITIAL_SESSION` (refresh con sesión persistida), el flujo encadena
`leagueLoadMyLeagues() → _myLeagues.find(savedLeagueId) → leagueSelectById
→ leagueSelect → showPage`. Tres fallos compuestos producían el shell mudo:

1. **`leagueLoadMyLeagues()` sin retry** — la query Supabase con
   `window._porraToken` fallaba o tardaba transitoriamente al arranque;
   `_myLeagues` quedaba `[]`, `.find()` devolvía `undefined`, NO entraba en
   `leagueSelectById`, `getActiveLeagueId()` quedaba null, y ninguna página
   se activaba. El shell `.fc-pred-shell` montado pero TODOS los hijos a
   `height:0` → pantalla vacía.
2. **Sin timeout en los `await`s** — `db.from(...).select(...)` no expone
   `signal` de cancelación nativo. Un fetch transitoriamente colgado dejaba
   el handler en estado "pending" para siempre, sin llegar a `showPage`.
   Re-ejecutar manualmente `window.leagueLoadMyLeagues()` en la consola
   resolvía en 862ms y restauraba los 7 cards — prueba de que la red
   funciona, solo el primer intento se ahogaba sin reintento.
3. **`if (found) {...; return;}` early-return** — si `leagueSelectById`
   throwba o se colgaba entre `find()` y `leagueSelect`, el handler salía
   sin que NINGÚN `showPage` se hubiera llamado.

**Fix (rama `fix/auth-bootstrap-frozen-refresh`, NO toca guards
TOKEN_REFRESHED/USER_UPDATED ni `currentUser.id === session.user.id` —
imprescindibles contra bucles al volver de segundo plano):**

- **Retry con backoff** sobre `leagueLoadMyLeagues()` — 4 intentos (0, 400,
  800, 1600ms entre fallos) hasta encontrar `savedLeagueId` en `_myLeagues`.
- **`_withTimeout` helper** (Promise.race) envolviendo los 4 awaits del
  bootstrap: `profile fetch` (8s), `leagueLoadMyLeagues` (8s), `leagueSelectById`
  (8s), `loadUserData` (10s). Timeout → throw → `try/catch` registra warn
  pero el flujo continúa hacia `showPage`.
- **`_navigated` flag + try/finally**: garantiza que `showPage` se llame
  en TODOS los caminos (liga restaurada, no encontrada, error, timeout,
  excepción inesperada). Final `finally` fuerza `showPage('welcome')` como
  red de seguridad.
- **Preservar `savedLeagueId`** si tras 4 intentos `_myLeagues` sigue vacío
  (posible transient; próximo refresh podría tener mejor suerte). Solo
  limpia si `_myLeagues` tiene ligas pero la guardada no está (stale id
  legítimo: usuario kickeado / liga borrada).
- **Loader visible** (`#_auth-bootstrap-loader`, fixed center, inline CSS)
  durante el bootstrap si hay token persistido o `_pendingPageRestore` —
  "lento" no parece "roto". Removido tras la primera navegación.
- **Watchdog 12s** que fuerza `showPage('welcome')` + oculta loader si nada
  navega (red extrema para el caso donde TODOS los timeouts individuales
  fallan).

**Verificación pendiente:** QA en preview Vercel (San) reproduciendo el
refresh múltiples veces. Lección PR#124: el test standalone no basta para
validar timing real de fetch — el QA en browser es obligatorio.

**Iteración 1 (commit `5405ebc`):** retry + timeout + `_navigated` flag +
watchdog DENTRO del handler de `onAuthStateChange`. QA en preview Vercel
reveló que el bug PERSISTE: el handler nunca se ejecuta porque
supabase-js ya emitió `INITIAL_SESSION` durante `createClient` /
restauración persistida ANTES de que `auth.js` cargue y registre su
listener (auth.js está al final de la cadena `loadScript`). Toda la
robustez añadida vive dentro de un handler huérfano.

**Iteración 2 (este commit):** refactor estructural atacando la causa
raíz — race de listener tardío.

- **`_bootstrapSession(session, eventType)` extraído** a función
  reutilizable con TODO el flujo (profile fetch, retry, loadUserData,
  showPage). Invocada desde DOS puntos: el handler de `onAuthStateChange`
  (cambios futuros) Y `db.auth.getSession()` explícito tras el registro
  del listener (snapshot de sesión ya existente).
- **Guard `window._bootstrapInFlight`** evita doble ejecución cuando
  ambas vías compiten. Más el guard preservado de
  `currentUser.id === session.user.id`.
- **Loader + watchdog 12s armados INCONDICIONALMENTE** al inicio de
  `runAuthInit`, fuera del handler. Antes el gating por
  `sessionStorage.porra_token` era circular (token solo se escribía
  desde el handler que no corría).
- **`_withTimeout` aplicado también a `db.auth.getSession()`** (8s) —
  protege contra hangs del cliente Supabase en la llamada explícita.
- **Edge case**: si `getSession()` devuelve sin sesión pero
  `_pendingPageRestore` estaba seteado (sesión expirada entre tab close
  y reopen), limpiar pending y mostrar welcome.

**Verificación pendiente (San en preview Vercel):** refresh con sesión
persistida + `_pendingPageRestore='grupos'` debe acabar mostrando grupos.
Refresh normal sin regresión. Refresh anónimo sin flash de loader
persistente. Login fresco normal. Background return sin bucle de
showPage. Lección reforzada de PR#124 y de iter 1 de este mismo ERR:
nada de test standalone sustituye al QA en browser.

**Stats iter 2:** 1 fichero tocado (`public/js/auth.js`, refactor
cohesivo). ERR-78 reescrito con causa atribuida a race de listener
tardío.

**Iteración 3 (este commit):** causa raíz REAL identificada vía QA en
preview Vercel con Chrome MCP + DOM inspection. Iter 2 NO resolvía
el bug. Diagnóstico definitivo:

`#restore-lock-css` (inyectado inline en `index.html` cuando hay
`porra_lastPage`) bloquea TODOS los fallback `showPage('welcome')` del
bootstrap. Y el watchdog estaba gateado por presencia del loader, que
se oculta en TODOS los caminos de fallback antes del watchdog disparar
→ watchdog nunca activaba.

Cadena causal real: usuario tiene sesión + página guardada → lock se
inyecta en parse time → bootstrap intenta restaurar; si CUALQUIER
camino acaba en fallback welcome (getSession timeout, sesión nula,
excepción inesperada, admin rejected, etc.), `showPage('welcome')`
hace early-return por el lock → ninguna `#page-*` queda en
`display:block` → blank permanente porque ningún `showPage(non-welcome)`
ejecuta para quitar el lock.

Iter 1 y 2 atacaban consecuencias correctas (listener tardío, fetch
hangs, retry) pero NO la causa raíz. Verificado por San:
`document.getElementById('restore-lock-css')` existe durante el blank;
test causal `lock.remove(); showPage('grupos')` recupera la app.

**Fix iter 3:**

- **Helper `_navigateFallbackWelcome()`**: quita `#restore-lock-css`
  ANTES de `showPage('welcome')` (evita el early-return). Sustituye
  la combinación `_hideBootstrapLoader + showPage('welcome')` en los
  4 sitios críticos: fall-through Path 2, red final del try/finally,
  listener no-session branch, `_onNoSessionFromGetSession`.
- **Watchdog redesignado** con trigger semántico ("¿hay alguna
  `#page-*` con `style.display !== 'none'`?"). Sustituye el trigger
  frágil (presencia del loader). Cubre TODOS los caminos de fallback
  presentes y futuros sin enumerarlos. Acción:
  `_navigateFallbackWelcome` (quita lock + welcome).
- **(Opcional, secundario)** `loadIAPredictions` envuelto en
  `Promise.race(..., setTimeout({}, 6000))` dentro de `loadUserData`'s
  `Promise.all`. NO es el fix del blank (la IA NO bloqueaba showPage
  en ningún camino verificable) — solo acorta la ventana de espera
  cuando IA cuelga (red lenta).

Descartado: B (auto-expire del lock en index.html inline). Discutido
con San. Razón: quitar el lock sin re-renderizar no recupera la app
(el `showPage('welcome')` que estaba bloqueado ya retornó early). El
watchdog redesignado absorbe el rol de B con un trigger
estructuralmente correcto.

Preservado intacto de iter 2: helpers `_withTimeout`,
`_bootstrapSession` extraído, `db.auth.getSession()` explícito,
guards `TOKEN_REFRESHED/USER_UPDATED` y
`currentUser.id===session.user.id`, retry+backoff sobre
`leagueLoadMyLeagues`, flag `_navigated` + try/finally.

**Verificación pendiente (San en preview Vercel):** refresh con
sesión persistida + `porra_lastPage='grupos'` + IA lenta (simular
6s+ timeout) → debe acabar mostrando grupos o welcome, NUNCA blank.
`#restore-lock-css` debe quitarse y alguna `#page-*` debe quedar
visible. Refresh happy path sin regresión. Refresh anónimo sin lock.

**Stats iter 3:** 1 fichero (`public/js/auth.js`, +60/-15 sobre iter
2). ERR-78 reescrito con causa raíz real (lock + watchdog gateado),
incluye recap de las 3 iteraciones y lecciones acumuladas.

**Iteración 4 (este commit):** fix regresión UX descubierta en QA de
iter 3. El blank está resuelto, pero tras F5 con sesión + liga + 
`porra_lastPage='grupos'`, la app aterrizaba en welcome en lugar de
restaurar grupos. Medido (Chrome MCP): `visible_pages=['page-welcome']`,
`getActiveLeagueId()=null`, `match_cards=0`, todas las queries
Supabase 200 (las ligas SÍ cargan).

**Causa raíz iter 4** (combinación de dos issues):

1. **Listener fire premature INITIAL_SESSION sin sesión**: supabase-js
   v2 a veces emite el evento ANTES de terminar de restaurar la sesión
   persistida desde localStorage. El handler en iter 3 trataba todo
   null como "no hay sesión" → nullificaba `_pendingPageRestore` y
   mostraba welcome.

2. **`leagueSelectById` redundante con timeout vulnerable**: cuando
   `getSession()` explícito later resolvía con sesión válida y Path 1
   se ejecutaba con `_foundLeague=true`, el `await
   _withTimeout(leagueSelectById, 8000)` internamente hacía un
   SEGUNDO `await leagueLoadMyLeagues()` redundante (la retry loop YA
   había populado `_myLeagues`). Ese segundo fetch podía colgarse
   (network jitter) → timeout 8s → catch → fall-through a Path 2.
   Path 2 leía `target = _pendingPageRestore` que ya estaba null
   (nullificado por issue 1) → `finalPage='welcome'` → showPage('welcome').
   `_activeLeague=null` porque `leagueSelect` nunca corrió.

**Fix iter 4:**

- **A) Listener: distinguir eventos prematuros vs acción explícita.**
  Solo `SIGNED_OUT` y `USER_DELETED` disparan clear+welcome. Otros
  eventos sin sesión (INITIAL_SESSION sin sesión, USER_UPDATED con
  null) se ignoran con `console.debug`. `getSession()` explícito
  (que SÍ espera la restauración persistida) es la fuente
  autoritativa.

- **B) Path 1 llama `leagueSelect(_foundLeague)` directo**, eliminando
  el `await leagueSelectById` y el segundo `leagueLoadMyLeagues`
  redundante. `leagueSelect` es síncrono — sin timeout, sin riesgo
  de hang. `_foundLeague` ya fue validado contra `_myLeagues`
  populado por la retry loop arriba.

Cualquiera de los dos por separado podría dejar el bug expuesto en
ciertos timings. Juntos blindan la restauración desde dos ángulos.

Preservado intacto de iter 3: `_navigateFallbackWelcome` con
quita-lock, watchdog semántico, helpers `_withTimeout` /
`_bootstrapSession` / `_onNoSessionFromGetSession`, retry+backoff,
flag `_navigated` + try/finally, IA timeout 6s.

**Verificación pendiente (San en preview Vercel):** F5 con sesión +
liga + `porra_lastPage='grupos'` → restaura grupos (page-grupos
visible, cards>0, `getActiveLeagueId` no null). NO welcome.
Refresh anónimo / login fresco / logout real / background return →
sin regresiones. Sin blank en ningún caso (iter 3 preservado).

**Stats iter 4:** 1 fichero (`public/js/auth.js`, +35/-7 sobre iter
3). Total acumulado en la rama: `public/js/auth.js` (~+365/-107
sobre main `f626714`). Rama `fix/auth-bootstrap-frozen-refresh`
(PR #125). ERR-78 extendido con iter 4 + lecciones acumuladas
(4 iteraciones).
