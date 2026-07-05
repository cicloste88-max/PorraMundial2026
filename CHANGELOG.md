# CHANGELOG — Porra Mundial 2026

Retención 90d. Auto-archivado a `CHANGELOG-archive-YYYYMM.md` si supera 30KB.

## [05-jul-2026] Feat: EF `ko-round-seeder` — siembra automática de rondas KO R16→final (`claude/ko-round-seeder-oauzvw`, PR #180)

R32 estaba 16/16 en `ko_results` pero octavos (89-96) inexistentes en las 3
tablas KO → pipeline ciego a R16 con 2 octavos ya jugados (MAR@CAN, FRA@PAR
4-jul). Nueva EF por-slot: alimentadores resueltos en `ko_results` (losers de
semis para el 103) + exactamente 1 evento ESPN por pareja de abbreviations
(== iso3 en KO) → INSERT `wc_matches_ko` + `espn_event_map` + esqueleto
`live_scores` (nombres ES de `wc_matches`, estados/codes de espn-poll; post →
marcador final + events de scoringPlays con ids estables idénticos). Los post
se puentean explícitamente (trigger `bridge_on_finished` es AFTER UPDATE, no
salta en INSERT); empate → `winner=null` → lo cierra `ko-winner-sync`.
Idempotente + self-healing + reconcilia `date_utc`. Migración cron `*/15`
gated (`wc_matches_ko` < 32) — la aplica Claude.ai tras validar el run real.
Bundle 33KB (<70KB MCP): `KO_FEEDERS` local verificado 1:1 contra `BRACKET`
por test (no embarca los 59KB de `ko-data.mjs`). 16 tests nuevos; simulación
local con BD real derivó los 8 octavos exactos (760502-760509, inverted=false).
Hallazgo pestaña "8vos" Predictor: sin lock real (`.up-tab.locked` es CSS
muerto) — pasa de "PRÓX." a "en juego"/"N pts" con el primer slot 89-96 live o
finished; el run real la desbloquea al puentear los 2 post. CHANGELOG rotado
(>30KB) → entradas 02..10-jun a `CHANGELOG-archive-202606.md`.

## [30-jun-2026] Feat: Dashboard de la porra — vista por jugador (`claude/predictor-league-dashboard-u0zjzt`)

Nueva pantalla **Dashboard de la porra** accesible desde el botón
**Dashboard** (icono grid 4-cell) a la **izquierda de Clasificación** en el
header del Predictor. Permite consultar el desglose completo de puntuación
de cualquier miembro de la liga (post-cierre 10-jun el detalle ajeno está
permitido entre miembros): hero (totales), evolución por hitos, bracket
reconstruido + podio predicho, jornadas 1-3 partido a partido (signo/exacto/
goleador/IA/boost desglosados), KO clasificados a R32 (aciertos+fallos),
KO R32 cerrados (marcador+avance subtotales), premios individuales.

**Backend**: nueva EF `get-dashboard` v1.0.0 (`verify_jwt=false`, mismo
contrato auth que `get-league-standings`: bearer del usuario +
service_role privileged + membership gate del caller). Reutiliza el motor
compartido (`_shared/scoring.mjs` con las nuevas funciones
`calcMatchPointsBreakdown` + `calcKOMatchPointsBreakdown` que devuelven
flags individuales) + `_shared/ko-bracket.mjs` (cascada del bracket
predicho) + `ia-bridge.mjs` (puente ia_predictions ↔ predictions). El
bloque de ingest se duplica con `get-league-standings` (~250 LOC, anotado
como deuda técnica post-launch).

**Frontend**: `public/js/porra-dashboard.js` (adaptación del pack de San,
30-jun) expone `window.mountPorra(root, opts)`. Selector poblado con
`get-league-standings` (lista + totales, filtra bots + `cicloste88`);
detalle por usuario con `get-dashboard` (lazy fetch al cambiar `<select>`,
evita servir 290KB+ de payload sin necesidad). Catálogos FLAG/ISO_TO_ES
derivados de `EQUIPOS` (data.js) + `ISO3_TO_FLAG` (ui-globo-equipos.js).
CSS `public/css/porra-dashboard.css` scoped bajo `.pd` para no chocar con
clases legacy unprefixed (`.match`, `.score`, `.chip`, `.badge`, `.pts`).

**Refactor motor**: `_shared/scoring.mjs` introduce `calcMatchPointsBreakdown`
y `calcKOMatchPointsBreakdown` con `{ pts, signOk, exact, golOk, iaBonus,
doubled, matchupOk, swap, matchPts, advanced, advancePts }`.
`calcMatchPoints` y `calcKOMatchPoints` son ahora wrappers triviales que
devuelven `.pts` del breakdown — **cero divergencia** entre total publicado
y flags emitidos al dashboard. `public/js/scoring.js` (legacy) **intacto**;
parity tests shared↔legacy 1:1 siguen verdes. Suite 228/228 ok.

**Nav**: `showPage('dashboard')` añade auth gate, toggle de
`#page-dashboard`, lazy-load idempotente de `porra-dashboard.js`+`.css`
(`<link data-porra-dashboard>` + `<script>` inyectados al primer toque,
cached via `_dashLoadPromise`); invoca `mountPorra` con `lockLeague:true`
+ `onBack:()=>showPage('predictor')`.

**Build**: `dist/css/porra-dashboard.css` + `dist/js/porra-dashboard.js`
en `dist/` (ERR-22 ✓). Botón verificado en `dist/css/components/
predictor-shell.css` (`.fc-pred-dashboard-btn`).

## [30-jun-2026] Feat: avance KO SET-BASED por equipo (`claude/ko-advancement-set-based-lqb9xf`)

`calcKOMatchPoints` (`_shared/scoring.mjs` + espejo `public/js/scoring.js`,
1:1): el +pts de avance se otorga si el equipo que el usuario marcó avanzar en
un slot está entre los que REALMENTE avanzaron en la **ronda** (cualquier slot),
no solo si coincide con el avanzador del MISMO slot. Antes: tarjeta de Brasil en
cruce vs Marruecos, real Brasil cae en otro cruce pero pasa → 0 avance. Ahora:
+15 (avance r16). Nuevo opts `realRoundAdvancers: Set<iso3>` (compat: fallback
al criterio per-slot si el caller no lo pasa). Callers cableados:
`get-league-standings` v1.6.0 construye `realRoundAdvancers` por ronda (solo
slots resueltos; 103 'third' excluido vía `KO_ROUND_PTS`) y retira el gate
`if (!real) continue` (set puede pagar aunque MI slot no esté resuelto);
`porra-jugador-v3.js` espejo del wiring + drop de la línea "Real: X" en cards
non-third (slot-bound, engañoso con set-based) + ✓/✗ basado en pertenencia a la
set. Tests: 4 casos set-based (equipo correcto slot equivocado, no en set,
regresión slot correcto, set vacío) + parity shared↔legacy. Marcador/§1.7/boost/
podio intactos.

## [30-jun-2026] Fix: ganador de cruces KO automático desde ESPN (`claude/ko-winner-sync-espn-d43pyo`)

Nueva EF **`ko-winner-sync`** v1.0.0 (`verify_jwt=false`, gate `X-Cron-Key`).
Lee `competitions[0].competitors[].winner === "true"` del scoreboard ESPN
(`STATUS_FINAL_PEN`/`state=post`), proyecta vía `espn_event_map.inverted` y
fuerza `results.ko_results[slot].winner` (+ `pens` si tanda). **Aditivo**: NO
toca `live_scores` ni el bridge; idempotente (solo escribe en diff). Tras
cualquier cambio reseedea `user_points_cache` invocando `get-league-standings`
por liga. Modos: `POST {}` (ciclo), `{dry_run:true}` (informe), `{dates:"…"}`
(override ventana). Cron `ko-winner-sync` jobid 31 (`*/2 * * * *`), gate
interno `EXISTS (KO finished con winner=null)` — en reposo no llama a ESPN.
Migración versionada `20260630010000_ko_winner_sync_cron.sql` (idempotente,
backfill del alta runtime via MCP). **Origen del bug** (vivido 29-jun, slot 74
GER-PAR 1-1 + pens 3-4 Paraguay, batacazo): bridge infiere `winner` del
marcador (empate → null) y `espn-poll` descarta la tanda (`buildGoalEvents`
filtra `shootout!==true`). Slot 74 parcheado en caliente, impacto 0 en porra
(nadie acertó el batacazo). Detalle ERR-100; **deploy EF y cron ya live**, este
push solo mirror al repo. **Pendiente menor**: gate sin recencia
(busy-loop benigno si un KO queda `null` fuera de ventana ESPN; idea:
acotar por `wc_matches_ko.date_utc`).

## [29-jun-2026] Fix: avance KO infravalorado → escalera coherente +5 (`fix/ko-advance-ladder`)

`KO_ROUND_PTS` en **ambos** motores (`_shared/scoring.mjs` + espejo
`public/js/scoring.js`, 1:1): `r32 5→10 · r16 10→15 · qf 15→20 · sf 20→25 ·
final 25→30` (`groups` sigue 5). **Podio** (30/20/15/10) intacto. Campeón
75 → **85**; toggle §1.5 "= 50" → "= 55". Sin avance KO hardcodeado fuera de
`KO_ROUND_PTS`. Suite **349/349** (3 ficheros KO realineados). Docs:
`scoring-engine.md` + ERR-98 §1.5. **Pendiente (Claude.ai):** redeploy
`get-league-standings` + reseed `user_points_cache`.

## [29-jun-2026] Pronósticos KO en el detalle de usuario (Porra de un jugador)

`Predictor → clasificación → (pinchar usuario)` ahora muestra, tras `J1·J2·J3`,
las pestañas KO **16avos · 8vos · 4tos · Semis · Final** (el 3.º/4.º puesto,
slot 103, se pliega en la pestaña Final). Cada pestaña pinta el **bracket que ESE
jugador pronosticó** para la ronda, con la misma lógica de comparación vs. la
competición real que ya usan las cards de grupos. Feature **solo lectura**.

**Arquitectura (Caso B):** el modal `porra-jugador-v3.js` es renderer propio
(no reusa `mountPredShell`). El bracket del jugador visitado se reconstruye
**reutilizando** `resolveAllSlots()` (ko.js) mediante un **swap síncrono** de los
globales compartidos `predictions`/`koPredictions`/`resolvedSlots` (guardar →
inyectar los del visitado → resolver → capturar copia → restaurar en `finally`;
sin `await` entre medias → sin reentrancia). Los puntos por card salen de
`calcKOMatchPoints` (scoring.js) — paridad exacta con el predictor propio
(ANNEX_C/ERR-61). Anti-IA KO omitido en este modal (la IA por cruce no se carga
aquí; divergencia ≤ +1/cruce vs. leaderboard, documentada).

**EF `get-user-predictions` v1.1.0** (deploy Supabase pendiente — lane Claude.ai):
además de `predictions`/`boost_picks`, devuelve `ko_predictions` del target y
`ko_real` = `wc_matches_ko` (cruces iso3 sembrados) ⨝ `results.ko_results`
(`winner`/`l`/`v`/`scorers`/`status`) por slot. El frontend no tiene acceso a esas
tablas; `wc_matches_ko`/`ko_results` son **soft-fail** (degradan a `{}`). Mismo
gate de cierre del target (Opción A) que los picks de grupos.

**Comparación por card** (espejo de `calcKOMatchPoints`, iso3): cruce ✓ (par
`{home,away}` == par real como conjunto), pasa ✓ (avanzador == real), y si el
cruce coincide, marcador estilo grupo (signo/exacto/gol). Rondas no sembradas
(R16+) y porras incompletas degradan a **Opción B** (etiquetas feeder
`W74`/`RU101`/`2.º A`/`3.º (A/B/C/D/F)`), reutilizando el patrón del Directo.
Fechas KO en `Europe/Madrid` (match_start_ts live → `date_utc` fallback, nunca
`m.date` crudo, ERR-92). Ficheros: `public/js/v3/porra-jugador-v3.js`,
`public/css/v3/comunidad-v3.css`, `supabase/functions/get-user-predictions/index.ts`.

## [29-jun-2026] Bloque KO en vivo: pipeline ESPN + bridge scoring + frontend completo (PRs #171, #172)

Cableado E2E de las eliminatorias en directo. Tres frentes:

**1) Pipeline KO live (DB, lane Claude.ai/MCP):** `espn_event_map` + `live_scores`
cubren los **16 slots R32 (73–88)** — verificado: 16 filas en cada tabla + 16 en
`wc_matches_ko`. ESPN event IDs **760486–760501**, todos `inverted=false`
(abreviaturas ESPN == iso3, orientación home/away == seed del bracket). El cron
`espn-poll` itera `espn_event_map` sin cambios (gated a la ventana kickoff−30min).

**2) Bridge KO scoring** (`porra-bridge-results` **v13** — contador deploy Supabase):
rama KO genérica (round-genérica r32→final), escribe
`ko_results[slot]={l,v,scorers,winner,round,status}` **siempre** al pasar a
`finished` (antes hacía `bridge_skip` si el empate no resolvía ganador). Empate
(tanda) → `winner=null` en Fase 1 (se fija a mano; el shape ESPN de la tanda no
está verificado). `koWinner()` (lectura `score_agg`/`penaltyShootout` estilo
SofaScore) **eliminado**. Validado **E2E** con el slot 73 (RSA-CAN): el trigger
`bridge_on_finished` escribió `ko_results['73']={l:0,v:1,winner:"away",
scorers:["Eustaquio"],round:"r32",status:"finished"}`.

**3) Frontend KO completo (PRs #171 + #172 en main):**
- **Jornada KO**: `_buildJKOCard` pinta equipos reales + marcador en vivo + status
  pill; `renderVistaJornada` auto-expande la ronda KO en curso (round-genérica).
- **Directo**: cruces KO con el formato `.dvm` "marcador FIFA" (helper compartido
  `_buildDvmCard`), ordenados cronológicamente, con fecha/hora Madrid encima de
  cada card.
- **Expansión hero**: clic en card KO abre la hero (camisetas + marcador) vía
  `_buildDExpanded` + match sintético (`_directoKey`/`_is_ko`), sin duplicar.
- **Opción B**: lados sin resolver muestran la etiqueta del feeder (`W74`,
  `RU101`, `2.º A`, `3.º (A/B/C/D/F)`) en vez de "TBD".
- **`_liveScoresByMatchKey`** ahora incluye las keys `wc2026_ko_*` (fix
  `normalizeRow` en `live-sync.js`); repaint debounced de la pantalla live activa.
- **Fix posición fecha** (#172): la fecha sale del marco `.dvm` a una cabecera
  con ~8px de clearance sobre el trofeo (medido en headless).

Docs de esta sesión: `docs/ko-bracket.md` (nuevo, bracket verificado vs FIFA),
ERR-99 (`teams_swapped` en standings reales), `docs/scoring-engine.md`
(`calcClassificationPoints` sin cablear). Fase 2 (ganador de tanda desde ESPN):
pendiente, NO antes de verificar el shape real.

## [26-jun-2026] Fix matcher de goleador `matchPlayerKey` (ERR-97) + correccion de datos MCP (rama `fix/err97-matchplayerkey`)

**Code (este PR):** `matchPlayerKey` (`_shared/scorer-normalize.mjs`) -- particulas/`jr` a peso 0 + se exige solape de apellido. Resuelve A (van Hecke->VanDijk) y B (Agustin Cano->Canobbio) de la auditoria 62-finished (4 mal-atribuciones, 2 con impacto). Backend-only, drop-in; regresion en `tests/scoring.test.mjs` seccion 11. Fix 2 (cualificar `scorers` por iso3 -> resuelve C: Yasin Ayari/Khalil Ayari) y Fix 3 (matchear contra `squads`) en PR aparte.

**Runtime (lane Claude.ai/MCP, ya aplicado):** parche de datos `results.match_results` en 3 partidos (Tunez-Paises Bajos, Suecia-Tunez, Uruguay-Cabo Verde) + `results.overrides` como capa anti-re-bridge + reseed `user_points_cache` (-2 a lauratorres2002 / aha2701 / mrobledanovalverde / mavc_999). TODO tras desplegar y re-bridgear: retirar `results.overrides` (`UPDATE results SET overrides='{}'::jsonb WHERE id=1`).

## [13-jun-2026] Jornada: hora de kickoff en Europe/Madrid vía `date_utc` real (rama `fix/jornada-hora-madrid`)

- **Síntoma**: la pantalla Jornada mostraba la hora de la SEDE, no la de Madrid —
  MEX-RSA pintaba 15:00 en vez de 21:00. Afectaba a todos los partidos de grupos.
  Directo ya era correcto.
- **Causa** (ERR-92): `renderVistaJornada` (`_buildJCard` / `_buildMatchButtons` /
  modal "Ver tarjeta") formateaba con `_joParseMatchDate(m.date)`, que asume
  `+02:00` (CEST) sobre la hora de sede sin TZ. Las sedes 2026 están en husos
  US/Canadá/México → offset de 6-9h. Directo no sufría el bug porque usa el UTC
  real (`live_scores.match_start_ts`).
- **Fix**: helper compartido `window.kickoffUtcMsFor` (live-sync.js) lee `date_utc`
  del JSON wc_matches (mismo instante que Directo; sin designador de zona → fuerza
  'Z'). `_joKickoffMs` (ui-groups.js) lo consume con fallback al parse legacy en
  carga fría. Las 3 lecturas de hora real usan el instante real y derivan el
  weekday del MISMO instante (no baila en partidos de madrugada). Anti-flash:
  `liveSyncInit` repinta Jornada al cargar el JSON. Las etiquetas de fecha ancladas
  a mediodía (cabecera de jornada incluida) NO cambian.
- **Vistas de predicciones (mismo bug, brief 2)**: `_timeLabel` en
  `public/js/v3/porra-jugador-v3.js` y `public/js/v3/predicciones-liga-v3.js`
  formateaban con `new Date(match.date)` + `getHours/getMinutes/getDate` (hora de
  sede como LOCAL del navegador → fuera de España se veía la hora del usuario).
  Migradas al instante real (`window.kickoffUtcMsFor`, fallback `new Date(match.date)`)
  formateado SIEMPRE en Europe/Madrid, preservando el formato de salida de cada
  fichero. NO tocados `scoreboard.js` (hora actual local, correcto) ni
  `next-match-resolver-v3.js` (ya UTC + Madrid).
- **Tests**: `tests/jornada-hora-madrid.test.mjs` (6, instante real vs JSON real:
  MEX-RSA 21:00, KOR-CZE 04:00, USA-PAR huso US 03:00, fallback, idempotencia 'Z')
  + `tests/predicciones-hora-madrid.test.mjs` (6, ambas `_timeLabel`: MEX-RSA 21:00,
  USA-PAR 03:00). `tests/jcard-r2.test.mjs` inyecta el `_joKickoffMs` real (nueva
  dependencia de `_buildJCard`). Suite 270/274 (4 fallos pre-existentes por `cheerio`
  ausente en el container, no relacionados).
- Gate San: QA en preview Vercel. **NO merge.**

## [12-jun-2026] Comprobante: cruce HOME vs AWAY en cada slot KO + bracket dinámico a `_shared/` (rama `fix/ko-classifier-backfill`, PR #158)

- **Síntoma**: el PDF del comprobante mostraba cada slot KO como "1-3 → Avanza:
  Francia" sin decir contra quién — y en R16+ el cruce depende del bracket
  dinámico de cada usuario.
- **Refactor DRY**: bracket dinámico extraído a `_shared/ko-bracket.mjs`
  (`resolveBracket(predictionRows, koRows)` → `{slots:{id:{home,away,winner,
  loser}}, podium, meta}`); `ko-data.mjs` movido a `_shared/` (generador
  renombrado a `scripts/gen-ko-data.mjs`). `backfill-ko-classifiers/logic.mjs`
  queda como capa fina de inferencia — mismo comportamiento (smoke vs Porra
  Gallos: 22 usuarios, 0 filas, mismas 2 warnings).
- **Render**: `build-data.ts` adjunta `home/away` (+iso3) a cada `KoPred` vía
  `resolveBracket` (defensivo: si falla, cruces null = render pre-v11);
  `render.ts` formato compacto `<home> <l · v> <away>` + Avanza + goleador en
  las 6 rondas.
- **Fix idempotencia QA**: los envíos con `to_override` NI consultan NI
  registran `sent_receipts` (v10 los bloqueaba si había envío real previo y,
  de enviarse, habrían bloqueado el envío real posterior).
- **Validación**: bracket de Parrandas 16/16 cruces == referencia de San (SF
  101 Francia-España 1-1 → Francia; final Francia-Portugal 2-1) + podio
  coherente; aha2701 32/32 consistencia interna y cruces distintos (bracket
  por usuario). QA enviado a cicloste88@gmail.com (code `D036509EBB9B`) sin
  tocar `sent_receipts`. Tests: +6 `tests/ko-bracket.test.mjs`, suite 204/204.

## [12-jun-2026] `ko_predictions.classifier` NULL en KO con ganador claro — backfill BD + fix `saveKO()` (rama `fix/ko-classifier-backfill`)

- **Síntoma**: comprobante PDF (send-porra-receipt v10) con "Avanza: —" en 29/32
  partidos KO de Parrandas (Porra Gallos) y podio vacío; 20/20 humanos afectados.
  Impacto mayor: el scoring KO usa `classifier` para puntuar avances
  (+5/+10/+15/+20/+25) — habría fallado desde el 28-jun.
- **Causa**: `saveKO()` (ko.js) persiste `p.classifier || null` y la UI solo pide
  "quién avanza" en empates → en victorias claras quedaba null en BD.
- **Fix A (BD)**: EF `backfill-ko-classifiers` v1.0.0 — réplica del bracket
  dinámico del frontend (`logic.mjs`; `ko-data.mjs` GENERADO de los literales
  BRACKET/ANNEX_C/GRUPOS por `scripts/gen-backfill-ko-data.mjs`, no copiado a
  mano), inferencia en cascada 73→104, `dry_run` default true, idempotente,
  preserva todo classifier no-null (empates elegidos + literales HF-09).
  Ejecutada sobre Porra Gallos: 22 usuarios, 545 filas, 0 errores; SQL 20/20
  humanos `sin_classifier=0`; 2ª pasada `rows_updated=0`. 2 contradicciones
  (ambas cicloste88) preservadas con warning.
- **Fix C (UI)**: `saveKO()` infiere classifier desde el marcador antes de
  persistir (`resolveAllSlots()` + guard EQUIPOS contra etiquetas '1A'/'W74');
  `v3AdjustScoreKO` ya resetea classifier al dejar de ser empate, así que un
  cambio de marcador re-infiere solo.
- **Regresión**: `tests/backfill-ko-classifiers.test.mjs` (14 tests: ANNEX_C 495,
  slots 73-104, cascada, empates con/sin pick, literales home/away, contradicción
  no sobrescrita, idempotencia, gate 72 marcadores). Suite 198/198.
- **Pendiente**: backfill resto de ligas (Biwenger team, Mundial 2026 TILÍN,
  Mundialito, Porrazo, Porrazo 2) — misma invocación cambiando `league_id`.

## [12-jun-2026] Post-J1: ESPN fuente primaria del directo + 9 fixes — rama `fix/j1-incidencias` (gate San)

Contexto: SofaScore 403 challenge al actor Apify desde 11-jun ~18:54Z (ERR-89);
stopgap SQL `espn_live_poll()` aplicado esa noche por Claude.ai vía MCP.

- **Item 1 — EF `espn-poll` v1.0.0**: productiza el poller ESPN (fetch síncrono,
  parser puro testeable, WhatsApp con textos/destinatarios de porra-apify-webhook
  y dedup por ids md5 BIT-idénticos al scheme SQL — verificado contra BD),
  monitoring a results.log, gate X-Cron-Key. Cron `espn-poll-mundial-2026`
  (1min, gate EXISTS ventana kickoff−30m..+3h). Cutover: job 29 unscheduled +
  DROP espn_live_poll(); espn_event_map y espn_poll_state SE MANTIENEN.
- **Items 3+5 — badge pts Directo**: `_getLivePts` no pasaba realScorers y el +2
  de goleador no se concedía nunca (ERR-91). Finished → scorers canónicos del
  bridge (live-sync carga match_results, lector asObj + refetch al finalizar);
  en vivo → `deriveScorersFromEvents` (espejo bridge, reusa playerToShortKey).
  Copy: `+12 pts (boost ×2)`. Colateral: normalizeRow copia `minute` (ERR-87).
- **Item 6 — porra-jugador-v3**: `_realFor` consultaba la cache live con la key
  legacy (siempre miss → todo "Aún por jugar"); ahora `window.matchKeyFor`.
- **Item 7 — B11 user_points_cache**: tabla + v_user_global_rank v2 (decisión
  San: pts de la liga vista vs mejor total de cada usuario) + v_league_rank;
  standings v1.4.0 (write-through + bearer service_role privilegiado); bridge
  v7 refresca cache al finalizar partido. Tile/stats reales: fuera leagueRank=1
  y stub global; Zayu cuenta (de 22); _computeAciertos espejo motor; audit 0-0:
  updateGlobalPoints ya no puntúa contra los 0-0 estáticos pre-pitido.
- **Item 2 — update-results RETIRADA** (decisión San) + hardening: bridge v8
  (asObj + try/catch global con stack — el 500 del 11-jun fue mudo) y admin.js
  (5 JSON.parse → admAsObj; el panel crasheaba con results normalizado). ERR-90.
- **Item 4 — pastilla EN VIVO**: `.dv2-exp-header.live` pisaba el #fff del pill
  kits con --fifa-red a especificidad igual → rojo sobre rojo. Override 0,3,0
  patrón FINAL (texto claro, fondo sólido .92, z-index 2).
- **Item 8 — banner FIFA**: códigos ISO3 (KOR-CZE) vía PCShared.codeFor en el
  carrusel (nombres largos truncaban a 360px); aplica también al slide EN VIVO.
- **Item 9 — trofeo Predictor**: pill dorada 44px + label "Clasificación"
  (paleta --fifa-gold de los chips); aria-label corregido.

Tests nuevos: espn-poll-parser (14), directo-live-scorers (13), jugador-v3-livekey
(5), predictor-stats-b11 (11), bridge-hardening (5), fifa-bar-codes (4) — suite
236/0. ERR-89/90/91 documentados. Detalle por acción: migration-log sesión 12-jun.

## [10-jun-2026] Fix barra IA PREDICE invertida en el único fixture teams_swapped (BRA-ESC J3) — rama `fix/ia-bar-orientation`

- **Síntoma**: en `wc2026_gC_15186861` (Brasil-Escocia, J3, grupo C) la barra
  mostraba LOCAL 19 / EMP 10 / VISITANTE 71 con quip "Brasil ganará" (Brasil
  ES el local). Único partido de 72 con `ia_predictions.home_code` (SCO, orden
  SofaScore con el que computó la IA) distinto de `wc_matches.home_iso3` (BRA);
  los otros 71 alineados ocultaban el caso límite.
- **Causa**: `v3RenderIABlock` (eliminatoria-v3.js) mapeaba `breakdown.p_home`
  →LOCAL / `p_away`→VISITANTE en crudo. La re-key a legacy key en
  `loadIAPredictions` (auth.js) reorienta la KEY (`home_es/away_es`) pero no
  los valores. Regresión del mismo desfase que ya corrigió el flip del sign en
  la EF `get-league-predictions` (`home_code !== home_iso3`).
- **Fix (solo presentación)**: `loadIAPredictions` selecciona `home_code` y
  adjunta `ia_home_code`/`wc_home_iso3` a cada entry (crudos intactos);
  helper nuevo `v3IAOrientProbs` (eliminatoria-v3.js) intercambia
  p_home↔p_away solo si `ia_home_code !== wc_home_iso3` — misma condición que
  el flip del sign de la EF. Entries on-demand KO (sin metadata) passthrough.
  Sign/confidence/motor/BD sin tocar.
- **Regresión**: `tests/ia-bar-orientation.test.mjs` (9 tests) — unit del
  helper con datos reales de BD, end-to-end del HTML (LOCAL 71 / EMP 10 /
  VISITANTE 19), invariante del JSON (único swapped) y wiring guards en
  auth.js + eliminatoria-v3.js.

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
- **v1.0.2 — Stream 2, insights 1 y 2 conscientes del tiempo**: candidatos =
  solo partidos con kickoff FUTURO (parse de `wc_matches.date_utc` como UTC
  EXPLÍCITO — el TEXT "2026-06-11T19:00" sin Z se desfasaría horas como hora
  local; regex previa porque el parser de Date acepta basura), restringidos a
  la jornada (`round` 1/2/3) más baja con pendientes → el destacado rota solo
  J1→J2→J3 y nunca menciona un partido pasado; sin pendientes (post-28-jun)
  los insights 1-2 no se emiten y quedan 3/4/5 (torneo completo, intactos).
  Umbral de votantes intacto, aplicado dentro del subconjunto. Selección
  factorizada PURA en `select.mjs` (`now` inyectado, compartido Deno/Node) +
  smoke `tests/highlights-select.test.mjs` (6 tests: pasado excluido, J1
  jugada→J2, hoy→J1, post-grupos→null, parse UTC, date_utc malformado).
  Verificado vs BD: 24/24/24 por round, 0 `date_utc` no parseables; paridad
  deploy↔repo de los 2 ficheros + boot 401 OK. Suite 143/143.

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

