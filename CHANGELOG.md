# CHANGELOG — Porra Mundial 2026

Retención 90d. Auto-archivado a `CHANGELOG-archive-YYYYMM.md` si supera 30KB.

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

**Stats:** 1 fichero tocado en iter 2 (`public/js/auth.js`, refactor
cohesivo). Total acumulado en la rama: `public/js/auth.js` (+~270/-~85
sobre main `f626714`). Rama `fix/auth-bootstrap-frozen-refresh`. ERR-78
reescrito con la causa real (race de listener tardío, no transient de
leagueLoadMyLeagues).

## [31-may-2026] Fix globo: roster vacío en 5 selecciones por divergencia name_en

**Bug (prod):** en el overlay del globo 3D, pulsar "Plantilla" en Cape Verde,
Czech Republic, Ivory Coast, Korea o Turkey abría el modal con el mensaje
"Datos de plantilla aún no disponibles para esta selección" pese a que la
tabla `squads` tiene los jugadores (CPV 26 · CZE 30 · CIV 26 · KOR 26;
TUR 0 — ver pendiente separado). Las otras 43 selecciones funcionaban.
Detectado por Claude.ai vía MCP + Chrome en sesión paralela.

**Causa:** `renderPanelPais` (`public/js/ui-globo-equipos.js:313`) derivaba
`iso3` con match estricto `EQUIPOS.find(t => t.name_en === nameEn)`. El 3er
argumento `nameEn` que llega al panel es la key WIKI canónica (resuelta por
`getWikiKey()`), que para 5 selecciones diverge del `EQUIPOS.name_en`:
Cabo Verde ≠ Cape Verde · Czechia ≠ Czech Republic · Côte d'Ivoire ≠ Ivory
Coast · South Korea ≠ Korea · Türkiye ≠ Turkey. Sin match → `iso3=''` → el
botón `.fc-globo-detail__btn-roster` recibía `data-iso3=""` → `openRosterScreen`
cortaba en `if (!iso3)` con `console.warn('[roster] iso3 vacío')` y nunca
consultaba `squads`.

**Fix (2 commits sobre la rama `fix/globo-roster-iso3-naming`):**

- **Commit 1 (`f92c1af`)** — cascada NFD tolerante (`name_en`/`name`/`slug` ×
  `nameEn`/`nombrePais`). QA en preview Vercel reveló que arreglaba solo 3/5:
  con un GeoJSON donde `feat.properties.NAME` ya devuelve la WIKI key directa
  (p.ej. `NAME="Czech Republic"`, `NAME="Ivory Coast"`), tanto `nameEn` como
  `nombrePais` llegaban iguales y ningún campo de EQUIPOS contenía esas
  cadenas (`name_en="Czechia"`/`slug="czech"`; `name_en="Côte d'Ivoire"`/`slug="ivory-coast"`).
  Cape Verde / Korea / Turkey casaban porque EQUIPOS.name (es) o slug coincide
  con la WIKI key; Czech Republic e Ivory Coast no.

- **Commit 2 (este)** — diseño defensivo en 2 capas:
  1. **Vía principal**: mapa explícito `WIKIKEY_TO_ISO3` con las 5 divergencias
     conocidas (`Cape Verde`→`CPV`, `Czech Republic`→`CZE`, `Ivory Coast`→`CIV`,
     `Korea`→`KOR`, `Turkey`→`TUR`). Conjunto cerrado y conocido — garantiza
     5/5 independientemente de variaciones futuras en NE / `_norm`.
  2. **Vía fallback**: cascada NFD con `_norm` mejorado que ahora también
     colapsa separadores (`/[\s\-_'.]/g`). Step 0 preserva exact-match.
     Blinda contra slugs con guiones (`ivory-coast` ↔ `ivorycoast`) y casos
     similares futuros.

**Verificación:** script standalone parseando EQUIPOS REAL de `data.js`
(no datos asumidos) — 15/15 escenarios para las 5 divergentes (worst-case
`nameEn === nombrePais` + polygon-path + flag-button-path) + round-trip
48/48 con `EQUIPOS.name_en` raw + round-trip 48/48 simulando `getWikiKey()`.
Cero regresiones. Cero cambios en BBDD, EF u otros ficheros.

**Hallazgo independiente (no incluido en este PR):** `squads` para TUR
(ISO3=TUR) tiene 0 jugadores; las otras 4 tienen pleno (CPV 26 · CZE 30 ·
CIV 26 · KOR 26). Aunque el iso3 de Turquía ya quede bien resuelto, su
modal saldrá vacío por falta de datos. Es problema del sync de plantillas
(`scripts/sync-squads.mjs` + workflow), no del front. Anotado en
`errores_conocidos_porra.md` ERR-77 como pendiente separado.

**Stats:** 1 fichero tocado (`public/js/ui-globo-equipos.js`). Rama
`fix/globo-roster-iso3-naming` (PR #124). Nuevo ERR-77 (revisado).

## [31-may-2026] Saga JO Jornada — 6 PRs #116→#121 (CERRADA)

Sesión enfocada 100% en la pantalla Jornada y sus interacciones con login y
con el bracket KO. 6 PRs squash a main, todos solo frontend (sin DDL).

**PR#116 (`95f50a2`) — FG-1 (board stale post-login) + JO-4 (horarios CEST)**
- FG-1: `auth.js` `loadUserData` emite `CustomEvent('mundial:predictions-changed',{detail:{source:'auth-load'}})` tras hidratar `predictions[]` desde Supabase. El listener en `grupos-v3.js:1248` ya existía; sin el dispatch, el board v3 quedaba en orden inicial si el usuario aterrizaba en Grupos antes de que loadUserData terminara.
- JO-4: helper `_joParseMatchDate(s)` en `ui-groups.js` ancla fechas naive (`'2026-06-11T15:00:00'`) a `+02:00` (CEST, válido para todo el Mundial 11-jun→19-jul). `timeZone:'Europe/Madrid'` añadido a los 6 `toLocale{Time,Date}String` de la vista (incl. `_buildJCard`, `renderVistaJornada`, `_buildMatchButtons`, `renderBoostTicker`, modal `_showJcardModal`). En el modal `getHours()/getDate()` (siempre TZ del dispositivo) sustituidos por `Intl.toLocaleTimeString` con TZ Madrid.

**PR#117 (`0f884ad`) — JO-2 nombres completos en cards y modal compact**
- `_buildJCard` y `_showJcardModal`: ISO3 (`MEX`, `RSA`, `BIH`) sustituido por nombre completo (`hTeam.name`/`aTeam.name`) con fallback a `match.home/match.away`. Atributo `title` HTML duplicado para tooltip de nombres truncados en móvil.
- CSS `.jv2-team-code` y `.jcard-compact-team-code`: tracking reducido `.08em→.02em`, `text-overflow:ellipsis` + `white-space:nowrap` + `max-width:100%` para que "Bosnia y Herzegovina" / "República de Corea" no rompan el grid `1fr auto 1fr`. `.jcard-compact-team` recibe `min-width:0` (grid item shrink, necesario para ellipsis).

**PR#118 (`052109e`) + PR#119 hotfix (`972f3d6`) — JO-1a esqueleto KO**
- PR#118 añade 6 secciones nuevas debajo de las jornadas de grupos en `renderVistaJornada`: 16avos · Octavos · Cuartos · Semifinales · 3er y 4º · Final. Reutiliza `ROUND_CONFIG` + `BRACKET[cfg.key]` + clases `.jv2-*`. Nuevas funciones en `ui-groups.js`: `_buildJKOCard`, `_buildJKOSection`, `_buildJKOSectionsHtml`, mapa `_JO_KO_SHORT`. Sin pronóstico, sin clicks. Etiquetas P3a ("16AVOS · KO", etc.).
- **HOTFIX crítico PR#119**: la primera versión leía `resolvedSlots` (predicciones del usuario) y mostraba "INVALID DATE". Correcciones: `_joKOSlotLabel`→`'Por definir'` constante; `_joKOTeamFromSlot`→`null` constante; `resolveAllSlots()` removido de `_buildJKOSectionsHtml`. Fechas solo-día del BRACKET (`'2026-06-28'`) se anclan a `'T12:00:00'` antes de `_joParseMatchDate` + guard `isNaN(dt.getTime())`. **Principio (ERR-76)**: pantalla Jornada muestra calendario/competición REAL, NUNCA `resolvedSlots` (eso son predicciones). TODO documentado en código para conectar a resultados oficiales post-27jun.

**PR#120 (`33f0328`) — JO-3 acordeón de secciones**
- Cada `.jv2-section` (grupos + KO) pasa a colapsable. Estado en memoria `_joSectionCollapsed{}` keyed por `"date:YYYY-MM-DD"` (grupos) y `"ko:<cfg.key>"` (KO). Flag `_joCollapseInit` aplica defaults solo la primera vez; clicks posteriores del usuario se respetan en sesión.
- "Jornada viva" = primer día (cronológico) con algún partido aún no finalizado. Pre-Mundial sin `live_scores` → `aliveDate = J1 11-jun`. Defensivo: si todos finalizados (fin torneo), aliveDate=null y todo arranca colapsado. KO siempre arranca colapsado.
- Handler delegado en `jornada-container` idempotente con flag `_joCollapseDelegated`. Guards: `.jv2-nav-arrow` no dispara toggle (preserva navegación prev/next), `Enter`/`Space` sí (a11y). Patrón propio `.is-collapsed` + `display:none` (no `.collap` legacy con `max-height:1200px` — no escala a 16 cards de r32). Chev `▾` inline con rotación `-90deg`. `role="button"` + `tabindex="0"` + `aria-expanded` + `focus-visible` outline.

**PR#121 (`3a03413`) — JO-7 fecha redundante en header de grupos**
- Header mostraba `'11 JUN · Jueves, 11 De Junio'`. Sustitución de `dateShort` por contador de partidos (`matchesOfDay.length` ya en scope): `'Jueves, 11 De Junio · 2 partidos'`. Const `dateShort` eliminada (sin uso). Header KO intacto (usa `cfg.sub` de `ROUND_CONFIG`).

**JO-5 confirmado NO-bug**: `_buildJCard` ya muestra score real si `live.status==='finished'`. La razón de que pre-Mundial se vea la predicción es que `live_scores` está vacía. Se resolverá al activar pipeline live (Apify webhook + `update-results`) el 11-jun. Sin cambios de código.

**Bugs/errores nuevos**: ERR-76 — "Vistas de competición real NO leen `resolvedSlots`" (catalogado tras el hotfix #119).

**Stats**: 6 PRs squash, 6 ficheros tocados (`auth.js`, `ui-groups.js`, `jornada-v3.css`). Sin migraciones SQL. Sin tocar `vercel.json`, Pizarra, Grupos v3, Fase Final, Predictor.

## [28-may-2026] Sprint Combos & Awards (CERRADO 28-may-2026): F1+F2+F3 PR#111 + F4 v2 PR#112

Cierre completo del sprint de scorers/combos y premios individuales.

**F1+F2+F3 (PR #111)** — picker scorer dinámico + keys unificadas:
- **F1**: picker de goleador en grupos + KO poblado dinámicamente desde
  `squads.jugadores` (ya no arrays hardcoded).
- **F2**: keys de awards card v3 unificadas con el picker de scorer
  (`Mbappe` vs `Kylian_Mbappe`). Helpers en `window`: `playerToShortKey`,
  `resolveKeysForSquad`, `getScorerCandidates`, `getAwardCandidates`.
- **F3**: action `update_ia_scorers` en `porra-ia-compute` v14. Backfill del
  bot IA Zayu: **395 scorers** (260 grupos + 135 KO); 125 NULL residuales en
  países sin `xi_pinned` (ALG ARG AUS CAN ECU IRN MEX QAT TUR URU).
- SQL: migration `award_picks` con 4 rows raros normalizados por Claude.ai
  (`Kylian_Mbappe`→`Mbappe` ×2, `Nico_Wiliams`→`Nico`, `Borja_Iglesias`→
  `B. Iglesias`).

**F4 v2 (PR #112)** — auto-Bota sección "Tus goleadores":
- Migration `20260529100000_get_user_top_scorers.sql`: DROP RPC singular
  `get_user_top_scorer` + CREATE plural `get_user_top_scorers(uuid,uuid,
  int=3)` RETURNS TABLE(scorer_key, n, rank). Aplicada al remoto por Claude.ai
  con DELETE manual de `schema_migrations.version 20260528230000` (singular
  obsoleta, sustituida en el mismo sprint).
- `eliminatoria-v3.js`: `_v3SuggestGoldenBoot` devuelve array (sin gating de
  margin), `p_limit:5`, vía `window._porraDb` (no el proxy `db`, que pierde el
  JWT → la RPC `SECURITY INVOKER` devolvería 0 filas por RLS). Nuevo helper
  `_buildTopScorersHtml`: filtra por `candidateKeys` de
  `getAwardCandidates('golden_boot')` + `slice(0,3)`. Sección solo en
  `openPicker('golden_boot')`; click → `selectAward(key)` guarda en BD. Badge
  v1 (`.is-suggested` + `.aw-suggestion-badge`) eliminado.
- `eliminatoria-v3.css`: bloque `.aw-top-scorers*` compact (padding 6/10,
  header 10px dorado `#d4a017`, row 5/9, name 13px, count 11px, separator 4).
- **Caveat huérfano cerrado**: scorers no candidatos a Bota (bucket no
  ofensivo, selección fuera top-30 Elo, países sin `xi_pinned`) filtrados del
  top; RPC pide 5, cliente recorta a 3 tras filtrar → sin filas no-clicables.
- 4 commits squash: `bc07bf7` (v1 badge superado) → `baeb539` (sección top 3)
  → `85bec24` (fix huérfano) → `b3d5a3a` (compact CSS).

## [28-may-2026] fix/xi-pipeline-abc — endurecer pipeline XI titular (Capas A+B+C)

**Sprint contexto**: tras dispatch #69 productivo de PR #108 (scaling FF a 48
países), San auditó manualmente las 48 squads via MCP y dejó 33/48 a 11/11
titulares. La auditoría reveló 4 causas raíz que el próximo cron habría
sobrescrito. Las 3 capas resuelven el problema completo en un único PR.

**Capa A — Parser robusto** (`scripts/lib/parsers/_util.mjs`):
`parsePlayer` reescrito para tolerar 5 patrones reales de corrupción
observados en BD: EGY 'Ade (Pyramids FC)l' (letra cortada), ENG '(Tottenham)'
(nombre vacío), KOR 'Lee Jjae-Sung )Mainz 05)' (paréntesis invertido),
SCO 'Stewart (Southampton)Stewart' (apellido duplicado), SWE 'Brujas)'
(club pegado). Dos paths: well-formed sin regresión + robust fallback con
strip secuencial + dedupe de apellido repetido. NUNCA devuelve nombre
vacío ni el string corrupto. 8 tests nuevos cubriendo los 5 casos reales.

**Capa B — Matcher reforzado** (`scripts/lib/name-matcher.mjs` +
`scripts/lib/name-aliases.json`):
- **Alias dict per-iso3** consultado ANTES de Levenshtein. Semilla con
  MAR Bono → Yassine Bounou, CPV Vozinha → Josimar Dias, HAI Deedson L. →
  Louicius Deedson, NOR Sorloth → Alexander Sorloth, KOR Tae-hyeon →
  Tae-Hwan, EGY Fattouh → Ahmed Fotouh, JOR Al Nadi → Mohammad Abualnadi.
- **Threshold adaptativo**: `scorePair` acepta `simThreshold` (default 0.75).
  `matchAgainstRoster` baja a 0.70 cuando `iso3 ∈ NON_LATIN_ISO3`
  {KOR,EGY,KSA,MAR,IRN,IRQ,JOR,SEN,GHA,CIV,COD,TUN,ALG,BIH} (transliteración
  inestable; BIH por colisiones balcánicas -ic/-vic).
- **Anti-colisión** `ambiguityMargin=5`: si top-2 candidatos del roster
  están a <5 puntos sobre 100 Y secondBest>0 → NO marcar (devuelve
  unmatched). Evita falso positivo con apellidos compartidos.
- **Candidate groups** `string[][]`: cada slot puede ser pos-0 + pos-1
  desde FF. Si pos-0 no matchea, fallback a pos-1. Resuelve caso TUN
  Laidouni (FF) no convocado → match con Rani Khedira (pos-1 FF).

**FF parser pos-1**: `parseStartingXISlotsFromHtml` añadido en
`ff-scraper.mjs`. Selector `a.juggador.pos-{0,1}` (clase 'juggador' con
doble-g, typo literal de FF). Detección robusta vs ESP-style con
`.truncate-name` y JPN-style con texto directo. Validado con HTML real
JPN (11 slots, 3 alternativas confirmadas: Watanabe/Sugawara/Maeda).

**Capa C — Pin de estabilidad** (migración
`20260528170000_squads_xi_pinned.sql`):
`squads.xi_pinned boolean DEFAULT false` + `xi_pinned_at timestamptz`.
`sync-squads.mjs` Paso 2 detect + scrape `--refresh-final` chequean
`xi_pinned===true` y saltan recálculo de es_titular. El resto del roster
(nombres, club, edad, valor, dorsal, dob) sigue actualizable por
preserveEnrichment — sólo el flag se congela. Permite a Capa A corregir
los 5 nombres corruptos del roster aunque el XI esté pineado.

**Coreografía post-merge**:
1. PR merged (ya aplicada la migración via MCP antes del merge).
2. San pinea inmediato los 33 países corregidos:
   `UPDATE squads SET xi_pinned=true, xi_pinned_at=NOW() WHERE iso3 IN (...)`.
3. Próximo cron 6h: salta los 33 pineados (es_titular preservado), corrige
   los 5 nombres corruptos via Capa A, mejora match de tier B/C via Capa B.

**Tests**: 146/146 pass (8 nuevos parser, 17 nuevos matcher, 4 nuevos FF
pos-1, 117 regresión).

**3 dudosos** registrados en `errores_conocidos_porra.md` ERR-75 para
verificación manual de San con fuente oficial (no se forza match): IRN
Kanaanizadegan, GHA Kohn, JOR Layla portero.

**Documentación**: ERR-71 (parser corruptos), ERR-72 (Levenshtein
adaptativo), ERR-73 (anti-colisión), ERR-74 (pin estabilidad), ERR-75
(FF dudosos + pos-1 fallback).

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
