# CHANGELOG — Porra Mundial 2026

Retención 90d. Auto-archivado a `CHANGELOG-archive-YYYYMM.md` si supera 30KB.

## [28-may-2026] feat/scale-ff-countries — FF_COUNTRIES 1→48 + ProcessPool paralelo

**Sprint contexto**: tras hotfix PR #106 (parser FF cheerio + `img[alt]` non-empty filter), ESP valida 11/11 XI matched contra HTML real cacheado por Scrapling. Pero `FF_COUNTRIES` en `fetch_sources.py` aún tenía sólo `{"ESP": "espana"}` — los otros 47 países WC 2026 caen al fallback `fetch live` en `getFFLineupHtml`, sin estar pre-cacheados.

**Cambio**:
- `scripts/scraping/fetch_sources.py` carga `FF_COUNTRIES` desde `scripts/lib/iso3-slugs.json` (canonical, DRY con Node parsers) — pasa de 1 a 48 entradas.
- `process_one()` extraído a top-level (no closure) para ser pickeable.
- FF se procesa en paralelo con `ProcessPoolExecutor(max_workers=3, mp_context='spawn')`. Primarias siguen en serie (sólo 5, no vale la pena).

**Por qué ProcessPool no ThreadPool**: Playwright sync_api usa greenlets que no son thread-safe. Cada worker necesita su event loop. `spawn` (vs fork) evita inheritance de estado de browsers embedded.

**Wall time esperado**:
- Serial 48 países × ~30s = ~24 min → excede timeout 15 min.
- Paralelo 48 / 3 workers ≈ ~8 min + 80s primarias = ~10 min ✓

**Países sin XI publicado**: FF sirve `/alineaciones/0.jpg` placeholder. `parseStartingXIFromHtml` lo detecta y retorna `[]`. Coste: ~30s wasted por país no-FINAL pero sin daño. A medida que países publiquen su lista oficial, el cron 6h poblará XI 11/11 automáticamente sin tocar código.

## [25-may-2026] feat/mini-flags-rect (PR #93) — completa sprint banderas planas

**Cierra el sprint banderas planas** iniciado con PR #91 (card expandida con `--flag-rect-url`) y continuado con PR #92 (reupload bucket `miniatures/flags-sm/` con WebPs croppeados al bbox no-blanco + remoción del border CSS sobre el rectángulo).

Esta PR migra las **mini cards** del Directo (listado J1-J18 sin expandir) al mismo patrón de banderas rectangulares planas:

- **JS** `ui-directo.js`: constante `ISO3_TO_ISO2` movida del scope cercano a `_buildDExpanded` al scope superior del IIFE (acceso compartido con `_buildDMini`). `_buildDMini` ahora inyecta `style="--flag-rect-url:url(.../miniatures/flags-sm/<ISO2>.webp)"` en cada `button.dv2-mini-flag-btn`.
- **CSS** `directo-v3.css`: `.dv2-mini-flag` pasa de `<img>` con `object-fit:cover` a `background-image: var(--flag-rect-url)` sobre el button. Eliminado border dorado `rgba(201,169,97,.35)` y inset shadow blanco al 6% (ambos contornos visibles sobre `ink-900`). Reflejo banner `::after` atenuado 18%/25% → 8%/15% para no competir con la flag plana. `.dv2-mini.is-live` cambia `border-color` rojo por `outline` (mantiene glow EN VIVO sin reintroducir border base). `<img>` legacy con `display:none` como fallback semántico.

**Estado del bucket** `miniatures/flags-sm/<ISO2>.webp` tras los 3 PRs: 48 banderas planas (flagcdn.com source) sin marco blanco, listas para uso inline rectangular. Pizarra Táctica ya las usaba con `mask-image` linear-gradient — sin regresión.

**NO se tocan** en este PR: Grupos, KO, Globo equipos (siguen con flags circulares `flags/<ISO3>.png` — backlog post-launch para evaluar visualmente si conviene unificar).

## [22-may-2026] feat/scrapling-integration-opt-a — Scrapling pre-fetch en sync-squads

**Sprint contexto**: detect step en `sync-squads.yml` falla en 4/5 fuentes
primarias por HTTP 403 Cloudflare/Akamai desde IPs USA de GH Actions (TLS
fingerprint pobre de `node fetch()`). 6 runs cron consecutivos confirman el
patrón. Eurosport además bloqueada por geoblock 307 server-side, irresoluble.

**Solución**: Python/Scrapling como step previo. Métodos por fuente validados
en 4 probes (`26279588881`, `26281337027`, `26293035353`, `26293757651`):

| Fuente | Método Scrapling | Status | Latencia |
|---|---|---|---|
| Sport | `Fetcher.get(impersonate=chrome)` | 200 OK | 24-177ms |
| Olympics | idem | 200 OK | 700-2000ms |
| Marca | idem | 200 OK | 40-170ms |
| AS | `StealthyFetcher.fetch(solve_cloudflare=False)` | 200 OK | 3.6s |
| ESPN | idem | 200 OK | 6.8s |
| ~~Eurosport~~ | descartada | 307 → /geoblocking.shtml | - |

**Cambios**:
- `scripts/scraping/fetch_sources.py` — pre-fetcha las 5 URLs, escribe
  `cache/sources/<source>.html`. Sentinel empty file en fallo. exit 2 si
  alguna falla (continue-on-error en YAML).
- `scripts/lib/parsers/{as,sport,olympics,marca}.mjs` — refactor:
  `fetchAndParse()` ahora llama `loadCachedHtml(SOURCE_NAME)` en vez de
  `node fetch()`. Helper compartido en `_util.mjs`.
- `scripts/lib/parsers/eurosport.mjs` — **eliminado**. Geoblock irresoluble.
- `scripts/lib/parsers/espn.mjs` — **nuevo**. ESPN Deportes (Disney/Hearst)
  como 5ª fuente. Reusa `parseHtmlAS({ requireBullet: false })` por
  similitud asumida; primer run productivo confirmará.
- `scripts/sync-squads.mjs` — `parserEurosport` → `parserESPN` en
  `PRIMARY_PARSERS`.
- `scripts/lib/cross-validate.mjs` — priority list eurosport → espn.
- `.github/workflows/sync-squads.yml` — 3 nuevos steps (Setup Python 3.11,
  Install Scrapling, Fetch source HTMLs) condicionados a `mode=detect`.
  `continue-on-error: true` en el fetch para no bloquear el motor Node.
- `.gitignore` — `cache/sources/.gitkeep` tracked, HTML regenerable
  ignorado.
- Tests: `sources.test.mjs` actualizado (eurosport test → espn fixture
  AS-like). 77/77 pasan.
- ERR-68 (HTTP 403 IPs GH Actions), ERR-69 (Eurosport geoblock), ERR-70
  (setup-python cache:pip sin requirements.txt) registrados.

**Pendiente post-merge** (San):
- Cleanup branches probe pre-existentes (`probe/scrapling-viability`,
  `fix/scrapling-probe-cache`, `probe/scrapling-v2`, `probe/scrapling-v3-mini`,
  `probe/scrapling-v4-espn`).
- Eliminar EF `gh-proxy` (creada por Claude.ai para descomprimir artifacts).
- Eliminar `scripts/scraping/probe_scrapling.py` + `.github/workflows/scrapling-probe.yml`.
- Validar parser ESPN con HTML real del 1er run y ajustar si difiere.

## [21-may-2026] fix/scoring-exacto-apila-sobre-signo

**⚠️ CAMBIO DE COMPORTAMIENTO** (no regresión, no bug fix puro):

- `scoring.js` L58-63: `else if` → 2 `if` separados. Acertar el exacto ahora apila el +1 del signo (regla canónica confirmada por San 21-may).
- Pts máximo por partido: ANTES 6 efectivo (cap `Math.min(pts, 7)` nunca disparaba). AHORA 7 efectivo (1+3+2+1).
- Boost ×2 sin cambio en lógica pero techo sube de 12 a 14 (7×2).
- Comentario L39 corregido (ya no dice "no acumula").
- `docs/scoring-engine.md` tabla actualizada ("apila sobre el +1 del signo").
- Predicciones ya guardadas en BD que tengan exacto + (goleador o IA bonus) reciben +1 pt más automáticamente en próxima carga (cálculo no cacheado en BD).
- Smoke tests añadidos en `tests/scoring.test.mjs` — 4 casos canónicos (solo signo, exacto solo, exacto+goleador, exacto+goleador+IA). Slice de las primeras 104 líneas de `scoring.js` para aislar `calcMatchPoints` del código browser-específico.
- Registrado como ERR-67.

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
