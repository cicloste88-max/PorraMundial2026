# CHANGELOG — Porra Mundial 2026

Retención 90d. Auto-archivado a `CHANGELOG-archive-YYYYMM.md` si supera 30KB.

## 2026-05-20 — Sprint TM World Cup enrich (branch `feat/tm-worldcup-market-values`, PR pendiente)

7 commits independientes sobre `0be357c`, **sin squash al merge** (rollback granular). Cierra el ciclo de enrich completo: schema canónico squads + scraper masivo FIWC + applyEnrich ID-first + EF v7 + workflow.

- **`f6182cc` Pieza 0 — `tm-parse-utils.mjs` helpers + 10 tests.** Centraliza ~80% del parseo compartido entre A (marktwert) y B (kader): `decodeClean`, `stripTmImageQuery`, `extractProfileLink`, `extractClubLink({skip})`, `parseValorEs` (defensa contra el bug `40,00 mill.` → `4_000_000_000` del parser viejo), `positionToBucket` (.es + .com legacy), `mapConcurrent`, `sleep`.
- **`168f9a1` Pieza A — `tm-worldcup-market-values.mjs` + Nuno fixture + `tm-nation-map.json`.** Scraper FIWC marktwertaenderungen (40 páginas × 25 = ~1000 jugadores Mundial 2026). `ROW_RE` con lookahead positivo `(?=<tr class=odd|even|</tbody>)` resuelve el bug del `[\s\S]*?` que truncaba en `</tr>` interior de inline-table. Output: `byTmId` (lookup ID-first) + `byNation` (iso3 → verein_id descubierto, gana el más frecuente). Tolerancia: no descarta jugador si iso3 no mapea, sigue siendo útil para ID-first. Concurrencia 4 + throttle 200ms + cache 6h en `cache/tm-mw/`. 48 selecciones mapeadas en `tm-nation-map.json` (lookup directo por nombre TM con acentos).
- **`6bb6667` Pieza B — refactor `parseKaderTable` + Joan García fixture.** Resuelve 6 bugs del parser viejo: ROW_RE lookahead, foto en `data-src` no `src`, DOB español `DD/MM/YYYY (NN)` (era inglés), valor europeo `40,00 mill. €` vía `parseValorEs`, posición tolera saltos de línea, URL base `.es` por consistencia. Output ampliado al schema canónico completo: `{tm_player_id, nombre, dorsal, foto_url_tm, posicion_tm, posicion, dob, edad, club, club_id, club_logo_url, valor_eur}`. `enrichRosterWithTm` legacy queda como fill-missing alineado a los nuevos field names (modo `enrich-tm` legacy sigue funcional).
- **`c318e47` Pieza C-merge — `enrich-merge.mjs` con `applyEnrich` + 6 tests.** Una sola función que A y B llaman con maps de shape distinto (tolera `name/nombre`, `value_eur/valor_eur`, `photo_url_tm/foto_url_tm`). Reglas: ID-first; fallback por nombre+iso3; **FILL-MISSING** (nunca pisa valor existente — el roster previo ya pasó `mergeJugadores` de upsertSquad y es autoritativo); **PERSIST-BACK** del `tm_player_id` cuando match es por nombre. Stats per-campo en output para report multi-campo.
- **`cf2d1d9` Pieza D — `get-squad` EF v6 → v7.** `PlantillaPlayer` alineado al schema canónico: `posicion` (bucket) + `posicion_tm` (específica TM) + `valor_eur` (int) + `tm_player_id` + `club_logo_url`. `renderXIRow` prefiere `posicion_tm` sobre `posicion` sobre fallback de formación → pizarra muestra "Lateral derecho / Defensa central" en lugar de "Defensa / Defensa". Alias `posicion_bucket` mantenido por retrocompat (audit del frontend confirma sólo un comentario stale en `scoring.js`, ya limpiado).
- **`ec7422b` Pieza C-orquestador — `--mode=enrich-tm-mw` en `sync-squads.mjs`.** Fase 1: `fetchAllPages` + auto-fill `tm-ids.json` con `verein_id` descubiertos en `byNation` (dry-run sólo loguea). Fase 2 por país: 2a `applyEnrich(roster, byTmId, A)` → 2b si `--full` OR `coverageA<50%` OR `missingDobDorsal>30%` → `fetchTmKader(verein_id) + applyEnrich(roster, kaderMap, B)` (B aporta dorsal+dob que A no expone) → 2c upload fotos `foto_url_tm` → Storage idempotente con throttle 200ms → 2d `upsertSquad` (mergeJugadores interno preserva resto) → 2e report tabular con `tm | val | foto | club | logo | dob | dorsal | fromA | fromB` por iso3. Fuente queda `<original>+tm-mw`.
- **`a36c50f` Pieza E — workflow `sync-squads.yml`.** `enrich-tm-mw` añadido a `choices` del `workflow_dispatch`. Nuevo input `full: boolean` para forzar fase B siempre. Step `Run enrich-tm-mw` condicional. Cron actual sigue ejecutando `detect → enrich-tm` (cambio a tm-mw en cron pendiente de validar 1 semana en dispatch manual).

**Tests: 55/55 pass.** Smoke dry-run `--mode=enrich-tm` con ESP → 53 jugadores, 24 enriched, fuente `ff+tm` (validación del path legacy bajo schema canónico).

Post-merge en main, San dispatcha workflow `mode=enrich-tm-mw` (o `full=true` la primera vez), valida cobertura ≥80% en todos los iso3 + visual pizarra táctica con `posicion_tm` específica.

## 2026-05-20 — PR #81 schema canónico squads + merge upsert + Storage upload

**Branch:** `fix/squads-schema-canonico` mergeada a main (`0be357c`, squash). Cierra la regresión 19-may donde `--mode=detect` (tras mergear `feat/squads-sources-refactor`) pisaba el enrich TM de FRA/SWE/BIH (fotos, tm_player_id, edad, valor_eur, dorsal) al reemplazar `squads.jugadores` ciegamente.

- **Frente 1 (`squads-db.mjs`):** nueva función `mergeJugadores(beforePlayers, newPlayers)` que indexa el array previo por nombre normalizado (vía `normalize` de `name-matcher.mjs`) y rellena los `ENRICH_FIELDS` (`tm_player_id`, `foto_url`, `edad`, `valor_eur`, `dorsal`, `dob`, `posicion_tm`) cuando el nuevo no los aporta. `upsertSquad` la invoca antes del UPDATE, así toda escritura preserva enrich automáticamente. `preserveEnrichment` inline legacy en `sync-squads.mjs` (que usaba field names viejos `foto`/`valor`) eliminado. 6 tests en `scripts/lib/__tests__/squads-db.test.mjs`.
- **Frente 2 (`tm-scraper.mjs`):** schema canónico aplicado a `parseKaderTable` output: `tm_id` → `tm_player_id` (int), `valor` string → `valor_eur` (int), `posicion` raw → `posicion_tm`, `posicion_bucket` → `posicion` (el bucket es ahora el campo canónico). `enrichRosterWithTm` escribe `foto_url_tm` temporal (no pisa `foto_url` definitivo) para que el flow de upload lo reemplace.
- **Frente 3 (`storage-upload.mjs` NEW):** `uploadPlayerPhoto(iso3, tmPlayerId, sourceUrl)` sube al bucket `player-photos/{iso3}/{tm_player_id}.jpg` con `Referer: transfermarkt.com` (anti-hotlink). Idempotente: `supa.storage.list(iso3, {search})` previo evita re-descarga + re-upload. Integrado en `runEnrichTm`: tras `enrichRosterWithTm`, recorre el roster, sube las fotos pendientes, sustituye `foto_url_tm` por la URL pública Storage + limpia el campo temporal. Throttle 200ms entre uploads. En dry-run sólo limpia el campo temporal.
- **Frente 4 (frontend):** `scoring.js` awards bucket lookup pasa de `j.posicion_bucket` a `j.posicion`. `ui-globo-equipos.js` buildRosterHTML lee `j.posicion` para bucket detection + muestra `j.posicion_tm` en la columna "Pos." cuando existe (más informativo: "Centre-Back" vs "Defensa" repetido) + `j.valor_eur` en lugar de `j.valor`/`j.valor_mercado`. `ui-pizarra-tactica.js` intacto (su `team.jugadores` es shape ya transformado por la capa de la pizarra, no `squads.jugadores` raw).

**Migración SQL pre-PR (Claude.ai vía MCP):** schema canónico normalizado en `squads.jugadores` para los 48 iso3. Backup `public.squads_backup_19may_premigration` disponible. Tests 34/34, build OK.

## 2026-05-20 — Sprint Pre-Launch + Hotfixes iOS scroll (PR #75 + #77 + #78)

Tres PRs en cascada mergeados hoy. **main HEAD `0e49612`**.

### PR #75 (squash `72e3b75`) — fix: pre-launch bug batch (11 fixes F-01..F-10b)

Batch de 11 fixes pre-launch sobre brief Claude.ai 19-may. Cada uno en commit atómico.

- **F-02 awards combo no abría** (`ui-pred-shell.js:981`): `onChangeAward: null` impedía el wiring del botón "Cambiar" del trophy modal. Ahora cierra modal y llama `openPicker`. Round 2 reforzado con delegate document de `.aw-slot` (handler local en `renderAwardsBox4Legacy` se perdía al re-render del padre). Round 4 elimina gate `_awPicksSaved` — usuario edita awards mientras porra abierta; sólo `_porraCerrada` bloquea (en delegate + lockedStyle inline).
- **F-03 awards subgrupos por selección** (`ui-nav.js renderPickerList` + `base.css`): grupos colapsables `<button class="aw-picker-group--toggle">` con bandera + nombre + count + chevron. Body oculto hasta `.is-open`. Selección con pick previo o sugerencia arranca expandida.
- **F-01 logout en selector de liga desaparecía** (`mundial-shell-v3.js refreshShellUserChips`): ocultaba `#wc-auth-bar` incondicionalmente al dispararse `mundial:leagues-loaded`, escondiendo el botón segundos tras login. Ahora respeta visibilidad de `page-welcome` y NO oculta si la welcome está activa.
- **F-06 modal globo abre con análisis táctico colapsado** (`ui-globo-equipos.js`): quitar `open` del `<details>` "Sobre el equipo" en línea 298. Ambas secciones (bio + análisis táctico) ahora arrancan colapsadas.
- **F-09 chevron expandible en secciones del modal globo** (`globo-equipos.css`): añadir `::after` con `›` que rota 90° en `[open]` sobre `.fc-globo-detail__bio-toggle`. Señal visual de colapsable.
- **F-10a renombrar "Ver Plantilla" → "Pizarra táctica"** (`ui-globo-equipos.js:312`): texto del botón + emoji 📋.
- **F-07 dvh + scroll en pizarra táctica móvil** (`pizarra-tactica.css` + `ui-pizarra-tactica.js`): `max-height: 92dvh` con fallback `92vh`, `overflow-y:auto`, `-webkit-overflow-scrolling:touch` en `.fc-pizarra-modal`. Round QA: añadido `max-height: calc(92dvh - 220px)` al `.fc-pizarra-field` (campo no desborda viewport en Safari iPhone con barras URL+gestos), coords GK y=92→y=86 en las 12 formaciones para que el portero quede dentro del marco visible.
- **F-05 tooltip "?" en IA Predice** (`scoring.js` + `eliminatoria-v3.js` + `base.css`): no había texto legacy en `git log` (búsqueda confirmada). Redactado desde `docs/ia-predictor.md`: ELO FIFA (75%) + H2H (10%) + Forma reciente (15%) + ventaja anfitrión + bonus +1pt vs IA. Singleton popover en body con click-fuera-cierra + ESC. Round 2: `?` también en `.v3-zoom-ia__label` (match cards modal grupos). Round 3: `v3RenderIABlock` siempre renderiza la cabecera con `?` aunque `iaPredictions` no exista (pre-bootstrap o slots KO sin resolver) — antes devolvía `''`, dejando QF/SF/F sin la barra. `.ia-bar` arranca sin `display:none` para que el `?` sea visible aunque no haya predicción.
- **F-04 footer fase de grupos con reglas** (`grupos-v3.js` + `grupos-v3.css`): dos `<details>` colapsables al final del mount. Desempate Art.13 FIFA (H2H→GD H2H→GF H2H→GD→GF→fair play→sorteo) y criterio 8 mejores terceros (Art.16). Chevron rotatorio, en móvil colapsados por defecto.
- **F-10b screen Plantilla con roster completo** (`ui-globo-equipos.js` + `globo-equipos.css`): botón secundario `👥 Plantilla` debajo de Pizarra táctica. Modal con bandera + país, tabla agrupada por bucket (Porteros/Defensas/Centrocampistas/Delanteros) con scroll horizontal (Nombre+Club | Pos | Edad | Valor). Fuente `supabase.from('squads')`. **Causa raíz QA: la columna real es `equipo`, NO `nombre_pais`** — query devolvía error 400 y caía en placeholder "Datos no disponibles". Adicionalmente `posicion_bucket` no existe para FRA/BRA/SWE/BIH (sólo tienen `posicion`); buildRosterHTML deriva bucket vía regex sobre cualquiera de los dos campos. RLS confirmado via SQL: policy `squads_select_authenticated` con `polqual=true`.
- **F-08 apellido bajo pastilla en pizarra táctica** (`ui-pizarra-tactica.js` + `pizarra-tactica.css`): tercera línea `.fc-pizarra-token-surname` con último token del nombre, truncado a 10 chars con `…`. `max-width:60px` + `text-overflow:ellipsis`. Sólo renderiza si hay `nombre` en `squads.jugadores`.

QA validado vía Chrome MCP localhost (Chrome desktop) y producción Vercel (Chrome). F-07 verificado mobile real en sesión 20-may.

### PR #77 (squash `7d8b706`) — fix(grupos): move iOS scroll to inner (panel has pointer-events:none)

Bug reportado en producción iPhone real: el modal de grupos no permitía scroll vertical con touch, aunque funcionaba en Chrome desktop con mouse wheel.

**Iteración 1** (commit `f8bf621`, squash en PR #76 `f1f55d4`): quitar `overflow:hidden` del `.v3-zoom-panel__inner` y poner `overflow-y:auto` en `.v3-zoom-panel`. **NO funcionaba en iOS** porque `.v3-zoom-panel` tiene `pointer-events:none` (ERR-43 redux, para que el backdrop deje pasar clicks de cierre del modal). Un elemento con `pointer-events:none` no recibe touch events, así que aunque sea contenedor `overflow:auto` el gesto nunca le llega.

**Iteración 2** (squash `7d8b706`, mergeada): revertir el `overflow-y:auto` del panel; el scroller debe ser `.v3-zoom-panel__inner` (que sí recibe touch al `.is-open`). Añadir:
- `overflow-y: auto` en `.v3-zoom-panel__inner`
- `-webkit-overflow-scrolling: touch` (momentum scroll iOS)
- `overscroll-behavior: contain` (aislar de chained-scroll del body)
- `max-height: calc(100dvh - 24px)` con fallback `calc(100vh - 24px)` para Safari < 15.4

QA en iPhone Safari real (San): scroll touch funciona con momentum, no propaga al body.

### PR #78 (squash `0e49612`) — fix(grupos): reduce modal max-height to clear bottom tabbar (r3)

Bug visual residual tras PR #77: el contorno verde del `.v3-zoom-panel__inner` (border + halo box-shadow) terminaba demasiado abajo, quedando parcialmente cubierto por la `.fc-tabbar` (bottom navigation fija, 56px alto). Footer del modal "6 DE 6 MARCADORES · CLASIFICACIÓN →" también parcialmente tapado.

**Fix:** `max-height: calc(100dvh - 80px)` en `.v3-zoom-panel__inner` (era `- 24px`). 80px = 24px margins (12 top + 12 bottom) + 56px tabbar. Sin buffer extra para safe-area-inset porque ya se aplica a la tabbar por separado.

QA en iPhone Safari real (screenshot aprobado por San): contorno verde termina con margen sobre la tabbar, footer "6 de 6 marcadores" visible dentro del verde, separación limpia entre modal y tabbar.

### Bug latente, no regresión

El `overflow:hidden` original en `.v3-zoom-panel__inner` preexistía (no aparece en el diff de PR #75). Bug latente hasta que el contenido del modal creció lo suficiente para activarlo — el sprint pre-launch añadió contenido (12 grupos visibles + tooltips F-05 en cada match card) que hizo evidente el problema.

### Lecciones nuevas → ERR-65, ERR-66

Ambas en `errores_conocidos_porra.md` con detalle síntoma/causa/fix/patrón.

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

## 2026-05-19 — sync-squads: refactor fuentes primarias 5-of-N + parsers reales (PR feat/squads-sources-refactor)

**Branch:** `feat/squads-sources-refactor` (pendiente de merge a main). Sin migración SQL.

Resuelve el bug del 18-may en `--mode=scrape --all-missing`: 3 falsos positivos
(CRO/NED/POR) con datos de Eurocopa 2024 escritos a BD como "FINAL Mundial 2026".
**Ya limpiados manualmente con UPDATE** antes de este refactor.

### Cambios

- **Nuevo `--mode=detect`** (default del cron desde este PR): fetch en paralelo
  de **5 fuentes primarias** — AS / Sport.es / Olympics.com / Eurosport / Marca —
  y cross-validation 2-of-N + Jaccard ≥ 0.7 sobre nombres normalizados. Solo se
  marca FINAL si al menos 2 fuentes coinciden con roster en `[22, 30]` jugadores
  y solape ≥ 0.7. Calendario Olympics se parsea aparte y degrade `high → low`
  solo si Olympics anuncia "(definitiva)" en fecha FUTURA (semánticamente
  invertido vs versión inicial del PR).
- **Parsers reales** (no stub): `olympics.mjs` con orphan continuation
  (fix BEL 23→26, CUW 28→26), `sport.mjs` con bullet opcional (antes 0 iso3
  → ahora 48), AS parametrizado para `requireBullet`, calendar greedy
  longest-match (4 fechas → 8 fechas, 12 iso3s únicos).
- **FF degradada a fuente secundaria**: ya no se usa para *detectar* nuevas listas,
  solo para enriquecer XI titular de selecciones ya confirmadas FINAL por las
  primarias. Esto cierra estructuralmente el vector de ERR-59.
- **`maxPlayers=30`** en cross-validate: pre-listas largas (ARG/COL/MEX/CZE/QAT
  con 33-55 jugadores) van a `reject` con razón "pre-lista detectada — esperar
  cierre oficial".
- **Workflow YAML v2**: cron 6h ahora ejecuta `--mode=detect` + `--mode=enrich-tm`
  en serial. Se elimina el conflicto mutuamente excluyente `--refresh-final` vs
  `--all-missing`. Artifact incluye `cache/squads-calendar.json`.
- **`--mode=scrape` y `--mode=enrich-tm` conservados** para dispatch manual.
- **Marca aporta IRN** (Irán) como única fuente publicada para esa selección.

### Archivos

```
scripts/lib/parsers/_util.mjs           helpers compartidos (htmlToLines, etc.)
scripts/lib/parsers/as.mjs              parser AS (requireBullet param)
scripts/lib/parsers/sport.mjs           parser Sport.es
scripts/lib/parsers/olympics.mjs        parser Olympics + orphan continuation
scripts/lib/parsers/eurosport.mjs       parser Eurosport (nuevo)
scripts/lib/parsers/marca.mjs           parser Marca (nuevo)
scripts/lib/parsers/calendar.mjs        calendar greedy longest-match
scripts/lib/parsers/country-map.json    nombre país → iso3 (expandido)
scripts/lib/cross-validate.mjs          Jaccard + 2-of-N + maxPlayers + calendar invertido
scripts/sync-squads.mjs                 orquestador 5 fuentes
scripts/lib/parsers/__tests__/          util.test.mjs + sources.test.mjs (28 tests)
tests/fixtures/squads/                  as.html + sport.html + olympics.html
.github/workflows/sync-squads.yml       cron detect→enrich-tm en serial v2
```

### Dry-run validado

19-may con 5 fuentes: `as=48 sport=48 olympics=21 eurosport=47 marca=47`.
22 iso3 procesables → 17 dry-run (16 high con 4-5 fuentes, 1 low CRO por
calendario "(definitiva): 1 jun"), 5 rejected pre-lista.

### Detalle ERR-59 + caveats

Ver `errores_conocidos_porra.md` ERR-59 y `.claude/rules/sync-squads.md` §0/§9/§10.

## 2026-05-17 — Sprint Completion Flow F1 + F3 (PR #69)
