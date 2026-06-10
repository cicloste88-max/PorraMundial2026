# CHANGELOG — Porra Mundial 2026

Retención 90d. Auto-archivado a `CHANGELOG-archive-YYYYMM.md` si supera 30KB.

## [10-jun-2026] Destacados de liga REALES — EF `get-league-highlights` v1.0.0 + rewrite `loadLeagueHighlights` (rama `claude/vibrant-turing-qcbhp3`)

El panel DESTACADOS DE TU LIGA del Predictor montaba frases falsas: los items
client-side agregaban sobre tablas con RLS own-rows-only (`ko_predictions`,
`award_picks`, `league_members` — SELECT `auth.uid()=user_id` → solo la fila propia;
ERR-86). Sustituye a la rama great-wozniak (neutralización; OBSOLETA, no mergear).

- **EF `get-league-highlights` v1.0.0** (patrón F4: `verify_jwt=false` + JWT manual +
  verja de membresía + service_role; caché 5 min). Universo = miembros
  `porra_cerrada=true` (si <8, amplía a quien tenga predictions; el user objetivo
  siempre entra si tiene preds). Devuelve hasta 5 insights formateados y ordenados
  por impacto ("solo tú" primero): 🎯 signo más solitario por partido (≥8 votantes),
  🔥 marcador exacto más raro, 🥇 premio donde está más solo (4 dims; `champion`
  vacía NO se usa), 🤖 sintonía de signos con la IA (snapshot activo + flip
  Brasil-Escocia F4), ⚡ ranking de signos-minoría. Paginación `.range()` en
  predictions (Gallos 1224 filas > max-rows 1000 PostgREST).
- **Frontend**: `loadLeagueHighlights` (`data.js`) reescrito a `functions.invoke`
  con cliente `getQueryDb` (F5); fuera los 3 items capados + contador falso. Panel
  3→5 tarjetas (`ui-pred-shell.js` + `predictor-shell.css`, items como cards).
  Fallback genérico "Tu liga está lista para jugar." si EF falla o vacía.
- **Verificado**: 401 `missing_bearer`/`invalid_token` sin auth (vía pg_net);
  oráculo bot Zayu 72/72 signos vs IA con el puente+flip replicado en SQL;
  Gallos tiene 16 solo-picks reales de signo (16 votantes) → frases "eres el único"
  verdaderas; `npm run build` + grep dist (ERR-22) + 137/137 tests OK.
- **v1.0.1 — verja de cierre (mirror F4, aprobada San)**: tras la verja de
  membresía y ANTES de computar, RPC `is_porra_abierta(caller, league)` con
  service_role (solo invocación; sin tocar GRANTs — la usan policies RLS).
  Porra ABIERTA → `{ gated: true, highlights: [] }` sin computar (no filtra
  señal agregada); cerrada → `gated: false` + insights (gate por request, la
  caché solo guarda agregados). Frontend: con `gated:true` el panel pinta
  "🔒 Cierra tu porra para desbloquear los highlights de tu liga"
  (`pred-destacados__empty`), NO el fallback genérico. Verificado RPC vs flag
  canónico sobre los 47 miembros reales: 30 cerradas→false (insights) /
  17 abiertas→true (gated), 0 incoherencias.

## [10-jun-2026] Pizarra reescrita: XI 48/48 + 18 formaciones + rachas N=10 (rama `claude/upbeat-hopper-s4qe2t`)

Refresh pre-torneo completo de XIs y datos IA, con 4 bugs cerrados por el camino
(QA San en localhost OK):

- **FF movió las páginas de equipo a `/world-cup/equipos/<slug>`** — la ruta vieja
  devolvía 404 y el scrape de XI fallaba silenciosamente. Fix en `ff-scraper.mjs`.
- **Artefacto "Más info"**: overlay nuevo de FF cuyo `img[alt]` se colaba como nombre
  de titular (6 selecciones, slot PO sobre todo). Filtro `isUiArtifact` + promoción de
  la alternativa al slot vacío.
- **Aliases post-load-fifa** (+13): los nombres FIFA del 03-jun rompieron matches FF
  (Vinicius Junior→Vinicius Jr, Ben Doak→Ben Gannon-Doak, Kevin Lenini→Kevin Pina
  confirmado por San…) y un alias KOR apuntaba a un nombre extinto (→Taehyeon KIM).
  **Gemelo Aldawsari (KSA)**: el fuzzy ponía a Nasser en el xi cuando FF alinea a
  Salem ("Salem Al Dawsari" con espacios).
- **18 formaciones desfasadas** (pin de mayo): nueva `detectFormacion()` en
  `xi-slot-map.mjs` — prueba las 12 rejillas contra las coords FF, cambia
  `squads.formacion` solo con 11 coords + mejora ≥15%. CRO/CUW→3-5-2,
  JPN/CZE/PAN/SUI→3-4-3, SCO/URU→4-4-2, GER/NED/POR/MEX/KSA/QAT/JOR/COD/NOR/PAR→4-3-3.
  maxDist anómalos resueltos (MEX 61→15, KSA 49→20).
- **Pipeline**: `--reseed-xi` ahora funciona en `scrape --refresh-final` (re-marca XI
  pineados con el roster FIFA-official ÍNTEGRO — NUNCA usar detect para esto:
  pisaría nombre_camiseta/estatura_cm/posicion_fifa) + `--build-xi` tras scrape.
- **IA/rachas**: default `scrape_last5` 8→10 + re-scrape elo/h2h/last5 (amistosos
  hasta 09-jun en BD). ⚠️ Deploy CLI de EFs: **SIEMPRE `--no-verify-jwt`** — el 1er
  deploy sin flag reseteó `verify_jwt=true` y habría tumbado el cron freeze del 11-jun.

Final BD: 48/48 `squads.xi`=11 sin placeholders · 48/48 `es_titular`=11 · formaciones
4-3-3×23 / 4-2-3-1×9 / 3-4-3×8 / 4-4-2×4 / 3-5-2×4. Smoke `get-squad` CRO OK.

## [10-jun-2026] Actor webshare 1.0.13 — drift cerrado + modo auto + secrets (rama `claude/upbeat-hopper-s4qe2t`)

**Drift descubierto**: el repo tenía el actor pre-batch (1.0.7) mientras producción corría
1.0.10 (`eventIds[]`) — el PR #131 que portaba el batch al repo quedó abierto sin mergear.
Reconciliado vía `apify pull` + refactor Nivel 1 encima, **deploy build 1.0.13**:

- **Modo `auto` (default)**: reuse de cookies del KV Store SIN cargar sofascore.com
  (~5-6s/run, mínimo bandwidth Webshare); self-healing — si 403/timeout, recapture +
  retry solo de los ids fallidos. `capture`/`reuse`/`normal` quedan para debug.
- **Batch paralelo**: todos los ids en 1 `page.evaluate` con `AbortSignal.timeout(15s)`
  por fetch (antes serial, sin timeout). 3 partidos en ~1,7s.
- **Credenciales Webshare fuera del código** → `apify secrets` + refs `@` en
  `.actor/actor.json` (rotación de password pendiente, trámite documentado).
- **Dockerfile**: `COPY package.json` + `--no-package-lock` → **ERR-85** (lockfile
  rompía el build por API Y por `apify push`; supersede la lección "ERR-82" del PR #131).
- **defaultRunOptions vía API**: 2048MB (antes 4096 → ~50% coste/run) + timeout 300s
  (antes 3600 — un run colgado facturaba 1h).

**Validación**: smokes single/batch/capture/reuse 200 + **partido EN DIRECTO**
(Ponte Preta-Cuiabá, `inprogress` 2nd half, 1-2 live con goleadores correctos, ~2s).

**Docs portadas del PR #131** (que se cierra sin merge — superseded): §Batching por slot
(seed 72, índice `live_scores_match_key_uidx`, clustering 60 slots, supersede
`schedule_match_crons` para grupos), descubrimiento eventId vía `og:image` (SofaScore
retiró `#id:` de URLs), EF `porra-sofascore-proxy` MUERTA, modelo `incidentClass` del
goleador. Pendiente heredado del #131: **rotar `APIFY_TOKEN`** (quedó expuesto en chat MCP).

## [08-jun-2026] #137 — feat(receipt): comprobante de porra por email (squash `2da570e`)

EF `send-porra-receipt` v3: al cierre envía al usuario un email con copia íntegra
de sus pronósticos (cuerpo ligero + adjunto HTML para evitar el recorte de Gmail).
Resend + Vault `RESEND_API_KEY`. Tabla `sent_receipts` (UNIQUE `user_id`+`league_id`,
RLS on). Cron `cerrar-porras-mundial-2026` extendido (`bulk:true`, 1 POST/liga).
Podio derivado solo de classifiers. Auth `requireAdminOrCron` + opcional `to_override`.

## [08-jun-2026] #139 — fix(boost): cliente JWT + espejo currentUser (squash `617577e`)

`boost_picks` vacía server-side pese a usuarios con boosts marcados. Dos capas:

1. `saveBoostPicks`/`loadBoostPicks` usaban `window._porraDb` (cliente AUTH sin
   JWT) → la RLS `auth.uid()=user_id` rechazaba el INSERT y devolvía `[]` en
   SELECT, en silencio. Fix: usar `getQueryDb()` (con `accessToken` vía
   `window._porraToken`) + auto-migración one-shot localStorage→DB en
   `loadBoostPicks`. → **ERR-83**.
2. `data.js` L256/L285 leían `window.currentUser?.id` pero `auth.js` declara `let
   currentUser` (scope global de script clásico, NO va a `window`) → el guard
   salía silencioso. Fix: espejo `window.currentUser = currentUser` tras cada
   mutación (L586 post-restore, L740 post-logout); repara 5 call sites de golpe.
   → **ERR-84**.

Validado vía Chrome MCP sobre preview de Vercel: tras `606ea7f`, el flujo normal
de bootstrap inserta las filas sin forzar nada.

## [08-jun-2026] Gate de boosts obligatorios antes de cerrar la porra (v3, #138)

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
  `predictions.match_id`). Los 7 cierres previos sin boosts eran el bot Zayu
  (×6 ligas + 1 huérfana), NO humanos → sin backfill.
- **Pre-flight + rebase (2.º commit)**: `await loadBoostPicks()` antes del
  `Promise.all` — auto-curativo, sube a DB los boosts atrapados en localStorage
  pre-#139 antes de validar (try/catch aislado: si falla, el gate sigue).
  Rebaseado sobre main post-#139 sin conflictos; validado E2E vía Chrome MCP.

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
