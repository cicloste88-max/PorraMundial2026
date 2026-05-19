# CHANGELOG — Porra Mundial 2026

Retención 90d. Auto-archivado a `CHANGELOG-archive-YYYYMM.md` si supera 30KB.

## 2026-05-19 — Polish v1 + Fix Packs 1, 2 + Fix DB (PR #71)

**Branch:** `claude/polish-v1-grouped-blocks-BbqRH` mergeada a main (`bd6e977`, squash de 13 commits, 10:57 UTC). Base rebase: `6038882` (post-PR #70). Sin migración SQL fuera del fix RLS final (`20260519103959_fix_rls_ia_elo_fifa_select_authenticated.sql`, idempotente, ya aplicada en BD).

Sesión grande de polish v3 post-Completion Flow. 4 bloques temáticos + 2 fix packs reactivos a QA visual + 1 fix DB crítico. +1247 −244 en 15 ficheros.

### Polish v1 base (4 commits)

- **B1 textos + chips dinámicos** (`mundial-shell-v3.js`, `leagues.js`, `mundial-shell-v3.css`): stage pill `GROUP STAGE → FASE DE GRUPOS`, `KNOCKOUT → FASE FINAL`. CTA eyebrow `QUALIFIED → CLASIFICADAS`. Chip izquierda dinámico según `is_admin` (mantiene `⚙ ADMIN`) vs nombre liga activa (>1 liga → navega selector; 1 sola → disabled). Chip derecha dual: `>1 liga` → cambiar liga, `1 sola` → logout. Nuevo event `mundial:leagues-loaded` que dispara `leagueLoadMyLeagues` para refresco de chips.
- **B2 panel IA en Clasificación + Cuadro Honor compacto** (`grupos-v3.js`, `grupos-v3.css`, `eliminatoria-v3.css`): sustitución de barra `Pronósticos guardados` (100% inane) por panel `🤖 IA PREDICE` con top-4 banderitas + iso3 según ranking sign-based. Nueva `v3ComputeIAStandings(letter)` + `v3RenderIAPredictionPanel`. Cuadro Honor `gap 14→10, margin-top 24→16, divider padding 4→2` (~30% más compacto).
- **B3 IA Predictor visual en modales** (`eliminatoria-v3.js`, `grupos-v3.js`, `eliminatoria-v3.css`): nueva `v3RenderIABlock(matchKey)` reusable. Microbarra 3 segmentos (home/draw/away) con % visibles + labels + quip cursiva. Insertado en `v3RenderZoomKO` y en cada match-card del modal Grupos (`v3RenderMatchesList`).
- **B4 Awards card v3 + Cerrar porra v3 + pg_cron 10-jun** (`eliminatoria-v3.js`, `scoring.js`, `ui-nav.js`, `eliminatoria-v3.css`, migración cron): nueva `v3RenderAwardsCard` (sustituida después en Fix Pack 1 por wrapper legacy), `_v3SuggestGoldenBoot` (cuenta scorers en predictions + KO, filtra rol≠gk), `renderPickerList` retrocompatible con `suggestion` opcional + badge `💡 Sugerido`. Botón v3 "Cerrar y enviar mi porra" + `v3FinalizarPorra` self-contained (chequea 72+32+4 en BD, sin DOM legacy). Helper `v3IsPorraCerrada` + lock al inicio de mutaciones v3. Migración `cerrar-porras-mundial-2026` schedule `'59 21 10 6 *'` (10-jun 21:59 UTC = 23:59 Madrid CEST) — `UPDATE league_members SET porra_cerrada=true WHERE porra_cerrada=false`.

### Fix Pack 1 (4 fixes QA visual)

- **Fix-1 leyenda dinámica 3º** (`grupos-v3.js`): texto pie tab Clasificación adapta a si el 3º está en `_v3BestThirdsCache` (Top 2 + 3º vs Top 2). Reusa lógica HF-BUG-12 (PR #66).
- **Fix-2 IA % suma 100 + labels alineados + paleta integrada** (`eliminatoria-v3.js`, `eliminatoria-v3.css`): nuevo helper `_v3DistributeTo100` con largest remainder method (Hamilton) — antes 39+31+29=99 por rounding. Labels Local/Empate/Visitante con `width:N%` proporcional (antes `justify-content space-between` ponía Empate fuera del centro cuando draw<15%). Paleta gradientes azul-medio/slate/rojo-profundo (antes saturados `#60a5fa/#6b7280/#ef4444`). Wrap `rgba(0,0,0,.25)` + bordes sutiles.
- **Fix-3 lookup IA correcto en modal KO** (`eliminatoria-v3.js`): `v3RenderIABlock` acepta string (grupos) o objeto match (KO). Para KO resuelve iso3 home/away via nuevo `v3GetMatchTeamIso3` y construye key `ondemand_{ISO3_A}_{ISO3_B}_2`. Prueba ambos órdenes porque BD no tiene simetría garantizada. Confirmado vía `execute_sql`: 218 filas ondemand en `ia_predictions` con breakdown completo.
- **Fix-4 awards card legacy con imágenes Maradona/Ronaldo/Casillas** (`ko.js`, `eliminatoria-v3.js`, `eliminatoria-v3.css`): San prefiere el diseño legacy `renderBox4` (`ko.js:944`). Nuevo `window.renderAwardsBox4Legacy()` factory standalone que crea instancia independiente del box4 con su propio closure `renderBox4Local`. IDs distintos (`#awards-box4-v3`, `#aw-grid-v3`, etc.) para no colisionar con legacy. `v3RenderAwardsCard` simplificada a wrapper 5-líneas. CSS `.v3-aw-slot` v3 eliminado (88 LOC); reutiliza `.aw-slot/.aw-grid/.aw-header/.aw-footer/.aw-player-bg` de `base.css`.

### Fix Pack 2 (3 fixes QA visual)

- **Fix-1 picker awards modal flotante** (`base.css`, `admin.css`): de bottom-sheet (`flex-end + translateY 100%`) a modal centrado (`align-items center + scale .96→1 + opacity`). `z-index 10000` (tabbar v3 = `--fc-z-tabbar: 300`). `padding-bottom: 100px` (deja respiro para tabbar). `border-radius: 20px` en todos los corners. `max-height: calc(100vh - 140px)`. `box-shadow` para flotación. base.css tenía 2 copias duplicadas del bloque (líneas 473 y 919) — replace_all aplicó ambas.
- **Fix-2 paleta v3 picker awards** (`base.css`): reescritura completa del bloque `.aw-picker-header → .aw-pts-possible` con tokens v3 alineados a Fix Pack 1. Slate-900 fondo, slate-100/400/500 texto, blue-400 `#60a5fa` accent. Eliminados: amarillo (`#fbbf24`/`rgba(250,204,21,...)`), verde (`#4ade80/#052e16/#166534`), `'Noto Sans' weight 900` (ahora `font-family: inherit` + `font-weight: 700`). Replace_all aplicado a ambas copias.
- **Fix-3+4 listas dinámicas BD-driven** (`scoring.js`, `auth.js`, `ko.js`, `eliminatoria-v3.js`): arrays hardcoded `AW_PLAYERS` (22) y `YOUNG_PLAYERS_NXGN` (50) ELIMINADOS. Nueva `getAwardCandidates(award)` async + cache `_awardCandidatesCache`. Matriz: Balón top 20 Elo cualquier rol; Bota top 30 + bucket IN (Centrocampista, Delantero); Guante top 30 + bucket = Portero; Joven top 30 + edad ≤21 (Transfermarkt enrich-tm). Consulta paralela `ia_elo_fifa` + `squads.jugadores`. `_bucketToRole` helper. `openPicker` async con indicador "Cargando jugadores…" + empty state si BD 0 candidatos. `selectAward` y `_v3SuggestGoldenBoot` usan cache. `auth.js loadUserData` resuelve picks guardados via `getAwardCandidates` (las arrays ya no existen). Precarga 4 listas en background al render. Schema BD `award_picks` (TEXT keys) sin cambios — claves nuevas con formato `Lamine_Yamal` (vs legacy `Yamal`); picks legacy huérfanos esperados, aceptable pre-launch.

### Fix DB (1 commit, idempotente)

- **Fix RLS `ia_elo_fifa` SELECT authenticated** (`20260519103959_fix_rls_ia_elo_fifa_select_authenticated.sql`, commit `ff070c7`): tabla con RLS habilitado SIN policy SELECT bloqueaba `getAwardCandidates` (`db.from('ia_elo_fifa')…` devolvía 0 filas silenciosamente para todos los roles). Policy nueva `ia_elo_fifa_select_authenticated FOR SELECT TO authenticated USING (true)`. Migración idempotente (`DROP POLICY IF EXISTS` antes `CREATE`). Aplicada via `execute_sql` MCP el 19-may + versionada en commit `ff070c7` antes del merge para que `db push`/`db reset` reproduzcan estado consistente. **Pendiente sprint hardening post-launch**: `ia_h2h` y `ia_last5_results` siguen sin policy SELECT (no consumidas por frontend actualmente).

### Stats consolidados

15 ficheros · +1247 −244. CSS dominante (paleta + reescrituras): `base.css` +132 −80, `eliminatoria-v3.css` +192 −41, `grupos-v3.css` +51, `mundial-shell-v3.css` +19, `admin.css` +14 −10. JS: `eliminatoria-v3.js` +268, `grupos-v3.js` +83 −3, `mundial-shell-v3.js` +117 −32, `scoring.js` +200 −41, `ko.js` +137, `ui-nav.js` +14 −3, `auth.js` +39 −10, `leagues.js` +22, `v3/eliminatoria-v3.js` +268. SQL: 1 migración nueva pg_cron + 1 fix RLS.

### Bugs resueltos

- **ERR-58** — detalle completo en `errores_conocidos_porra.md`.

## 2026-05-17 — Sprint Completion Flow F1 + F3 (PR #69)

**Branch:** `claude/diagnose-esc-listener-bug-L23SC` mergeada a main (`b5fb89c`, squash 18:06 UTC). Base rebase: `dff1166` (post-PR #68). Sin migración SQL.

Cierra los dos features pendientes pre-launch 11-jun. **`ko_predictions.scorer` ya existía en BD.**

### F1 — Picker goleador KO (~280 LOC, `eliminatoria-v3.js` + `eliminatoria-v3.css`)

- **UI**: bloque `.v3-zoom-ko-goleador` insertado en `v3RenderZoomKO` entre `penaltyHtml` y `summaryHtml`. Estado vacío = botón gold "Elige goleador"; estado lleno = nombre del jugador + Cambiar/Quitar.
- **Funciones nuevas**: `v3OpenGoleadorPickerKO`, `v3RenderGoleadorPickerKO`, `v3CloseGoleadorPickerKO`, `v3SaveGoleadorKO`, `_v3GetRoundMetaForMatch`. Reutiliza `v3RenderSquadPickerTeamSection` (`grupos-v3.js:740`, agnóstica) y el singleton `.v3-squad-picker-overlay` (montado por `v3EnsureSquadPickerOverlay`).
- **CRÍTICO**: `v3SaveGoleadorKO` **NO replica HF-BUG-13**. `saved=true` se controla solo por `v3AdjustScoreKO` y `v3SetPenaltyWinner` (que introducen marcador o classifier). Goleador puro deja `saved` como estaba.
- **Jerarquía de cierre extendida** en `v3BindButtonsAndSwitcher`: ESC y backdrop click priorizan sub-overlay del picker sobre zoom KO. Compatible con HF-BUG-08/01 guard (mismo `_v3ElimGlobalListenersBound`).
- **Persistencia BD sin cambios**: `saveKO` (`ko.js:102`) ya mapea `p.gol → scorer` en upsert; hidratación inicial (`auth.js:166`) ya mapea `p.scorer → koPredictions[id].gol`. In-memory unificado a `.gol` → `scoring.js` sin tocar.
- **Tests sanity in-runtime**: T-KO-1 (solo goleador empate=2 pts gracias a HF-BUG-05-bis), T-KO-2 (exact + goleador=5), T-KO-3 (exact empate con classifier=3). **3/3 PASS**.

### F3 — Hard lock grupos→KO refinado (~30 LOC, `ko.js` + `eliminatoria-v3.js`)

- `getGroupsProgress()` (`ko.js:239`) amplía return con `firstIncompleteLetter`: letra A–L del primer grupo con marcadores faltantes (los 6 partidos con `l!==null && v!==null && saved`), `null` si todos completos.
- Botón del gate en `eliminatoria-v3.js:64-86`: label dinámico "Ir al Grupo X →" + binding programático `data-v3-elim-gate-cta` → `showPage('grupos')` + `setTimeout 250ms` + `v3OpenZoomGrupos(letter)`. Fallback "Ir a Grupos →" si `firstIncompleteLetter` es `null`.
- **Sanity Node**: escenario A completo + B incompleto devuelve `'B'`. UX in-vivo pendiente Vercel preview.

### Stats

`eliminatoria-v3.js` +192 −4, `eliminatoria-v3.css` +77, `ko.js` +15 −1. Total +284 −5 en 3 ficheros.

### Backlog post-launch restante

HF-BUG-09-bis (path KO sigue con `setTimeout` en `v3SimulateDice`), HF-BUG-13 (refactor `v3SaveGoleadorGrupos:783` — el picker goleador KO ya evita replicar el patrón).

## 2026-05-17 — HF-BUG-05-bis null guard signo (PR #68)

**Branch:** `claude/diagnose-esc-listener-bug-L23SC` mergeada a main (`dff1166`, squash 16:49 UTC). Base rebase: `cff8080`. Sin migración SQL.

Cierra la deuda residual de HF-BUG-05 (PR #66) documentada en CHANGELOG, ERR-52 y CLAUDE Backlog #1.

### Bug

Tras PR #66, `pred = {l:null, v:null, gol:'X', saved:true}` llegaba al check de signo en `scoring.js:60`. `Math.sign(null - null) === 0` coincide con `Math.sign(realL - realR) === 0` cuando el resultado real es empate (0-0, 1-1, 2-2, ...) → **+1 pt fantasma de signo** cuando la intención del usuario era "solo apuesto goleador". HF-BUG-05 cubrió el caso exact (línea 55, `pred.l === realL` falla con `null === 2`) pero no el signo.

### Fix

One-liner añadiendo guard `pred.l !== null && pred.v !== null` antes del check de signo. Patrón consistente con `getMySign(pred)` en `data.js:250`. Path IA verificado: `iaBonusWillApply` (`data.js:262`) usa `getMySign` que ya bloquea null-null devolviendo `null`, y `if (!mySign) return false` corta antes — **no hay BUG-05-ter latente**.

### Tests sanity

T1 (1-1 + solo goleador acertado) y T4 (0-0 + solo goleador acertado) pasan de **3 → 2 pts**. Validación inversa pre-fix confirmó que los tests detectaban el bug. **6/6 PASS** post-fix (T1, T4 + 4 casos de control). QA in-vivo en localhost contra `calcMatchPoints` real cargado en Vite: 6/6 PASS (no replica).

### Stats

+2 −1 en `public/js/scoring.js`. Sin migración SQL.

### Bugs resueltos

- **ERR-57** — detalle completo en `errores_conocidos_porra.md`.

## 2026-05-17 — Hotfix Pack HF-BUG-05/08/01/09/11/12 (PR #66)

**Branch:** `claude/diagnose-esc-listener-bug-L23SC` mergeada a main (`855b6c4`, squash). Base `8c98e8a`. Sin migración SQL.

### 5 hotfixes

- **HF-BUG-05** (severidad ALTA, `grupos-v3.js` `v3SaveGoleadorGrupos`) — scoring fantasma con solo goleador. Antes inicializaba `predictions[key] = {l:0, v:0, saved:true}` cuando no existía → `scoring.js` puntuaba como pronóstico 0-0 válido. Ahora `{l:null, v:null, saved:false}`; la línea 783 sigue marcando `saved=true` al final del path normal pero `scoring.js` descarta marcador con `l===null` (falla isExact y signo). Goleador puntúa (+2) si acierta. Path `null + delta` cuando usuario añade marcador después defendido por `Number.isInteger` guard en `v3AdjustScoreGrupos:802`. **DEUDA RESIDUAL:** HF-BUG-05-bis (`scoring.js:60` evalúa signo por delta, `null-null===0` coincide con signo empate real → +1pt fantasma cuando pred es `null-null` Y resultado empate). Cubre 90% del bug, no el caso empate. Trazado completo en PR#66 comment: https://github.com/cicloste88-max/PorraMundial2026/pull/66#issuecomment-4470743039
- **HF-BUG-08/BUG-01** (severidad MEDIA, `eliminatoria-v3.js` líneas 31 y 868) — listeners `keydown` ESC y `click` backdrop ambos detrás del guard `_v3ElimGlobalListenersBound` (module-scope, nunca reseteado). Antes ESC quedaba fuera del guard y se acumulaba en cada re-mount de `v3BindButtonsAndSwitcher` tras `gate-locked → unlocked`. Tras N navegaciones, ESC disparaba N veces `v3CloseZoomKO()`. Roza ERR-43.
- **HF-BUG-09** (severidad BAJA-MEDIA, `admin.js:633` + `grupos-v3.js:970`) — evento `mundial:predictions-changed` desacopla `admin.js` ↔ v3. `diceSimulateAllGroups()` dispara el evento tras `savePredictions()`; listener en `v3GruposMount()` refresca el board solo si la página grupos visible y `_v3GruposInited===true`. Sustituye llamada directa a `v3RenderBoardGrupos()`. Caso KO sigue con `setTimeout` (I3 pendiente, HF-BUG-09-bis).
- **HF-BUG-11** (severidad BAJA, `grupos-v3.js:103`) — tiebreaker alfabético vía `localeCompare` antes del índice de array arbitrario. FIFA real usa head-to-head + sorteo no implementables; `localeCompare` es predecible y documentado.
- **HF-BUG-12** (severidad MEDIA, `grupos-v3.js:473`) — `is-qualified` también para el 3º si está en `_v3BestThirdsCache`. Antes la tabla detallada solo pintaba los 2 primeros, inconsistencia visual con el board principal en formato Mundial 2026 (8 mejores 3os clasifican).

### QA

Matriz ejecutada por Claude.ai: **8 PASS** + **1 PARTIAL** (BUG-05 residual de empate, documentado en PR comment) + **3 SKIPPED** (UX visual flow solo-goleador-sin-marcador, no reproducible sin mutar datos; código de render no cambió en este PR).

### Backlog post-launch derivado

- **HF-BUG-05-bis** — one-liner pre-F1/F3, guard `pred.l!==null && pred.v!==null` en `scoring.js:60` antes del check de signo.
- **HF-BUG-09-bis** — extender `mundial:predictions-changed` al path KO post-launch.
- **HF-BUG-13** — refactor `v3SaveGoleadorGrupos:783` post-launch (importante para F1 picker goleador KO).

### Bugs resueltos

- **ERR-52..ERR-56** — uno por HF, detalle en `errores_conocidos_porra.md`.

## 2026-05-17 — Sprint Cuadro de Honor v3 + HF Reset/Bootstrap + RLS DELETE

**Branch:** `claude/hf-sim01-fix-dice-button` mergeada a main (`e8d9c65`, +824/-98 LOC, 17 commits).

### 11 hotfixes incluidos

- **HF-CdH-01..05** — Cuadro de Honor v3: champion card + escudo glow `v3GoldPulse` + auto-shrink texto + podio 2º/3º/4º + chips de puntos.
- **HF-SIM-01** — Fix dice button KO: delegación a `diceSimulateAllKO` + `koPredictions` in-place delete (evitaba pérdida de referencia que rompía resolver de slots).
- **HF-Deadline** — Ocultar sim buttons cuando `_porraCerrada=true` o `Date.now() >= T-24h` respecto al kickoff del primer partido.
- **HF-Reset-01** — Reset de grupos también limpia KO + `resolvedSlots` (coherencia memoria-DOM, evita slots zombi tras vaciar grupos).
- **HF-Reset-02** — DELETE explícito a Supabase en handlers async de reset (los `savePredictions`/`saveKO` solo UPSERT-ean, no eliminan rows previas). Reset visual ya no deja basura en BD.
- **HF-Empty-State** — Guard `hasGroupScores` en `resolveAllSlots` (ko.js) evita poblar slots basura cuando `predictions` está vacío.
- **HF-Gate-Groups** — Gate síncrono en `v3ElimMount`: `areGroupsComplete()` + `_porraCerrada` antes de mount. Evita render parcial de eliminatoria cuando faltan resultados de grupos.
- **HF-Reset-Bootstrap** — Persist `_activeLeague.id` en `localStorage.porra_active_league_id` (escrito en `leagueSelect`) + auto-restore en INITIAL_SESSION via `leagueSelectById`. Stale id → cleanup + fallback al panel. Logout barre el key automáticamente vía `includes('porra_')`. Bug P2 pendiente: race condition con bootstrap de auth (mejorar sprint siguiente).
- **Fix dice confirm** — Eliminar doble popup + añadir `v3RenderBoardGrupos` tras simulación.

### 2 migraciones RLS DELETE (aplicadas via MCP)

Documentadas retroactivamente en repo:

- `20260517000001_rls_delete_predictions_ko.sql` — `CREATE POLICY predictions_delete` + `ko_predictions_delete` con USING `(SELECT auth.uid())=user_id AND (league_id IS NULL OR is_porra_abierta(...))`.
- `20260517000002_rls_delete_award_boost_picks.sql` — Mismo patrón para `award_picks` + `boost_picks`.

Bug raíz: las 4 tablas tenían RLS habilitado SIN policy `FOR DELETE`. `db.from(...).delete()` devolvía `{data:null,error:null}` (false-positive éxito) pero las rows NO se borraban en BD. Memoria del cliente coincidía con expectativa, pero F5 traía datos de vuelta.

### Bugs resueltos

- **ERR-51** — RLS DELETE policies ausentes → false-positive éxito (rows no se borran). Síntoma + causa + patrón preventivo de auditoría documentados.

### Cambios de código relevantes

- `public/js/leagues.js` — `leagueSelect` persiste leagueId + respeta `window._pendingPageRestore`.
- `public/js/auth.js` — INITIAL_SESSION restaura saved league via `leagueSelectById` antes del `loadUserData` directo. Stale id → `localStorage.removeItem` + fallback.
- `public/js/v3/grupos-v3.js` + `public/js/v3/eliminatoria-v3.js` — DELETE explícito en handlers de reset (HF-Reset-02).
- `public/js/ko.js` — Guard `hasGroupScores` en `resolveAllSlots` (HF-Empty-State).
- Cuadro de Honor v3 — nuevos estilos podio + chips + escudo glow.

## 2026-05-16 — Sprint sync-squads + GitHub Actions workflow

**Branch:** `claude/post-merge-sprint-hotfixes-FkMx5` mergeada a main (`eb9c9d1`).

### Funcionalidades nuevas

- **CLI `scripts/sync-squads.mjs`** — sincronización idempotente de `squads.jugadores`
  desde futbolfantasy.com (3 pasos: detect lista → parse roster → extract XI con fuzzy
  match) y enrich con Transfermarkt (edad/dob/valor/foto, cache 24h). Modos
  `--mode=scrape` (con `--iso3` / `--all-missing` / `--refresh-final` / `--all`) y
  `--mode=enrich-tm`. Flags transversales `--dry-run` / `--force` / `--verbose` /
  `--skip=...` / `--delay=...`.
- **Workflow CI `.github/workflows/sync-squads.yml`** — schedule cron `'0 */6 * * *'`
  + `workflow_dispatch` con 4 inputs configurables desde la UI de GitHub Actions
  (mode, refresh_final, iso3_filter, verbose). Log artifact retention 14d, sanity
  check del input libre con regex `^[A-Z]{3}(,[A-Z]{3})*$`.

### 8 commits del sprint

- `8e4d4ee` `feat(squads)` — script inicial (CLI + ff-scraper + tm-scraper +
  name-matcher + squads-db) + 48 iso3-slugs + 6 TM IDs conocidos + brief md.
- `e874b0c` `fix(sync-squads)` — decode HTML entities (tabla manual ~70 entradas
  Latin-1/escandinavas/tipográficas) + filtro `Alineación` / `Formación` /
  `Titulares` etc. en parseStartingXI.
- `e81e058` `fix(sync-squads)` — normalizar apóstrofos U+2018/2019/201A/2032 → `'`
  ASCII y U+201C/201D/201E/2033 → `"` ASCII para idempotencia contra BD escrita
  con teclado normal.
- `58979b5` `fix(sync-squads)` — Fix B (overzealous slice cut, revertido en
  `89e5d51`) + Fix C: `--refresh-final` preserva incondicionalmente roster +
  fuente +tm con decode in-flight de nombre/club.
- `89e5d51` `fix(sync-squads)` — revertir Fix B + intento de detector regex de
  texto "Alineación aún no disponible" (inviable, texto inyectado por JS).
- `b54fff8` `fix(sync-squads)` — detector definitivo del placeholder vía imagen
  SSR `/alineaciones/0.jpg`.
- `0d51fa4` `fix(sync-squads)` — migrar a paquete `html-entities` v2.6
  (HTML5 completo ~2000 entidades) reemplazando tabla manual. Cubre eslavo-sur
  (BIH/CRO), eslavo-occidental (CZE) y turco (TUR).
- `2cf8327` `feat(ci)` — workflow `.github/workflows/sync-squads.yml`.

### Bugs resueltos

- **ERR-46** — HTML entities centroeuropeas/turcas no decodificadas con tabla manual.
- **ERR-47** — `--refresh-final` pisaba enrichment TM cuando había noticia nueva.
- **ERR-48** — `parseStartingXI` extraía escudos de rivales cuando página sin XI.
- **ERR-49** — Apóstrofos tipográficos U+2019 rompen idempotencia ASCII en BD.
- **ERR-50** — `END_MARKERS_RE` corte de slice overzealous (intervención contraproducente).

### BD

- 10/48 squads operativas: 5 FINAL (FRA 11/11 titulares, BIH 11/11 + TM tras
  recuperación, JPN pendiente XI, BEL/SWE con `/alineaciones/0.jpg` SSR → sin XI
  publicado todavía), 5 pre-listas (ARG/BRA/ESP/MEX/QAT).
- `synced_at` automatizado vía cron cada 6h UTC.
- Limpieza in-flight de entidades crudas heredadas (BIH `Kola&scaron;inac` →
  `Kolašinac` y similares) sin re-scrapear, preservando `fuente=as+tm`.

### Lecciones

- **Lib oficial > tabla manual** para parsers de HTML. La tabla manual fue válida
  para 5 países, frágil para 10, insostenible para 48.
- **Flags `preserve` deben preservar incondicionalmente** — no solo en cierto
  branch del if. El nombre del flag es contrato. ERR-47 lo viola con un predicado
  innecesario.
- **Marcadores SSR > marcadores hidratados-JS** para parsing server-side. ERR-48
  costó 2 rounds de intentos especulativos antes de pedir screenshot real.
- **No especular sobre estructura HTML sin ver la página servida** (`curl`).
  ERR-50 dobla la apuesta sobre un diagnóstico sin verificación.

### Primera ejecución del workflow CI

Run `25962281040`, duración 49s, resultado: 5 países `no-op` (idempotencia
confirmada). Sin pérdida ni cambio espurio.

## 2026-05-16 — Sprint F3-I1.6.x + HF-08..HF-15: KO bracket visual completo + bug fixes

**Branch:** `claude/port-world-cup-design-FvZpD` HEAD `ffb360a` (NO mergeado a main, listo para fast-forward).

### F3-I1.6.x — 5 sub-iter (cerradas previas, 14-15 may)
- `e048815` F3-I1.6: cleanup `<div class="container">` legacy de `#page-grupos` (-61 LOC) + chips ADMIN/logout en stage-row del shell v3 (`stagePillRowHTML` + `refreshShellUserChips`).
- `2bb4523` F3-I1.6.2: chip logout funcional vía `db.auth.onAuthStateChange` + ocultar `#wc-auth-bar` legacy en SHELL_PAGES bajo `body.fc-shell-active`.
- `7feb800` F3-I1.6.3: fix `currentUser` file-scope global (no `window.currentUser`) + reducir hueco stage-pill↔board grupos a 38px + override post-sim código wrap.
- `3c481cd` F3-I1.6.4: layout grid `1fr auto 1fr` en stage-row (admin izq / pill centro / salir der) + códigos 3 letras post-sim grupos + refuerzo defensivo wc-auth-bar.
- `f896e4a` F3-I1.6.5: cleanup CSS rápido `#page-elim` legacy (8 elementos F7.X.4 ocultos) + computar 8 mejores 3eros (`v3ComputeBestThirds`) y marcar `is-qualified` en cards.

### Hotfixes 16-may (8 commits)
- `d7dee8d` **HF-08** wiring `resolveAllSlots()` en `v3RenderBoard` (R32 muestra nombres reales tras simular 12 grupos completos). 1 LOC. Función legacy ya existía en `ko.js` pero no se invocaba desde el render v3.
- `66db0fe` **HF-09** blindaje defensivo `home`/`away` literal en `resolveKO` empate + nueva `v3ResolveSlotCode` con códigos 3 letras (chain `equipo.code || equipo.flag || slice(0,3)`) + coherencia visual con grupos (`.v3-ko-row__code` font 9px + `.v3-ko-row` padding 1px 2px). Causa: simuladores legacy (`diceSimulateKOMatch`, `v3SimulateDice`) escribían `pred.classifier="home"|"away"` literal.
- `8992f8a` **HF-10** reducir track trofeo QF/SF (50/40px). **REVERTIDO en HF-11** por decisión San: "trofeo mantiene tamaño en todas las fases".
- `4562e51` **HF-11** replantar CSS cards KO con prototipo literal del autor (sistema de diseño), prefijo `v3-` 1-a-1, sin valores modificados. Crecimiento progresivo `min-height` 50→60→78→110px por ronda. Eliminadas 36 reglas previas conflictivas (A4+A5 del brief). Total **-119 LOC**, +reglas prototipo al final del fichero.
- `3b079c2` **HF-12** separar cards SEMIS del trofeo via `column-gap: 24px` SF únicamente.
- `5d07913` **HF-13** eliminar **mount fantasma `data-user-mount`** en `mundial-shell-v3.js:67` (root cause real del badge fantasma — defensas F3-I1.6.2/4 apuntaban a `#wc-auth-bar` legacy, sospechoso equivocado; `renderAuthBar` busca todos los `[data-user-mount]` y reinyecta) + bump column-gap SF a 40.
- `8b17ee2` **HF-14** margin negativo -10px en cards SF (empujar hacia bordes viewport sin tocar trofeo ni column-gap).
- `ffb360a` **HF-15** bump final tras report San de aire visible insuficiente: column-gap 40→50 + margin -10→-15. Aire neto estimado ~23-25px (casi doble del HF-14).

**Resultado visual:** Bracket KO v3 completo con códigos 3 letras, propagación grupos→KO funcional via `resolveAllSlots`, SEMIS con aire visible al trofeo (cup intacto en todas las rondas), fifa-bar limpia (sin badge duplicado). Listo para merge a main.

**Lecciones:**
- Cuando un bug visual persiste pese a defensas, buscar TODOS los mount points relacionados (HF-13: el sospechoso obvio `#wc-auth-bar` no era el verdadero — había un mount nuevo en el shell v3 que `renderAuthBar` interceptaba).
- Estampar CSS literal del prototipo del autor es a veces el camino más limpio (HF-11: -119 LOC vs iterar overrides).

<!-- 2026-05-19: entradas F3-I1.x + F2.9 + 2026-05-14 movidas a CHANGELOG-archive-202605.md (CHANGELOG.md superaba 30KB hook límite). -->


