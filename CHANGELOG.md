# CHANGELOG — Porra Mundial 2026

Retención 90d. Auto-archivado a `CHANGELOG-archive-YYYYMM.md` si supera 30KB.

## [29-jun-2026] Fix: avance KO infravalorado → escalera coherente +5 (`fix/ko-advance-ladder`)

`KO_ROUND_PTS` en **ambos** motores (`_shared/scoring.mjs` + espejo
`public/js/scoring.js`, 1:1): `r32 5→10 · r16 10→15 · qf 15→20 · sf 20→25 ·
final 25→30` (`groups` sigue 5). **Podio** (30/20/15/10) intacto. Campeón
75 → **85**; toggle §1.5 "= 50" → "= 55". Sin avance KO hardcodeado fuera de
`KO_ROUND_PTS`. Suite **349/349** (3 ficheros KO realineados). Docs:
`scoring-engine.md` + ERR-98 §1.5. **Pendiente (Claude.ai):** redeploy
`get-league-standings` + reseed `user_points_cache`.

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

