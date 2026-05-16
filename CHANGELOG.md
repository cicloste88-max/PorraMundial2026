# CHANGELOG — Porra Mundial 2026

Retención 90d. Auto-archivado a `CHANGELOG-archive-YYYYMM.md` si supera 30KB.

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

## F3-I1.x — Fundamentos integración v3 ↔ legacy SPA (15 may 2026 PM)

**Branch**: `claude/port-world-cup-design-FvZpD` HEAD `e048815` (NO mergeado a main). Detalle: `docs/AUDIT_LEGACY_VS_V3.md` tabla transversales (I1+I1.5+I1.6+I2 marcados ✅ DONE).

**4 commits (post F2.9 HF-cierre `18cb8bb`):**
- **`f509a82`** `fix(docs)` — corregir nomenclatura canónica audit (`v3RenderGroup`→`v3GruposMount` 2×, `v3RenderKO`→`v3ElimMount` 1×). Mismatch introducido en HF-cierre F2.9; helpers internos (`v3RenderKoCard`, `v3RenderZoomKO`, etc.) intactos.
- **`d6bae7c`** `feat(ui-nav): F3-I1` — `showPage` invoca `window.v3GruposMount()` / `window.v3ElimMount()` con guard `typeof === 'function'` (legacy `initGrupos`/`_gruposInitPromise`/`koInit`/`renderElimShell`/`elimShellResetAction` eliminados); dispatch `CustomEvent('mundial:page-changed')` + fallback síncrono `ensurePageShellV3(page)` antes de `fcShellApply`. Conservado tabbar inferior F7.4-C + `closeMobileFocus`. ~80 LOC neto.
- **`e1de51f`** `fix(spa): F3-I1.5 retroactivo` — F2.x estaba **sandbox-only** (`/sandbox/v3-pages-smoke.html` + `v3-shell-smoke.html`); scripts/CSS v3 nunca incluidos en SPA → I1 era `console.warn` no-op. Fix: 3 `<link rel="stylesheet">` en `index.html` tras último CSS legacy + 4 `loadScript('/js/v3/...')` en `js/main-entry.js` entre `ui-pred-shell.js` y safety net (orden replicado del sandbox: next-match-resolver → mundial-shell → grupos → eliminatoria).
- **`e048815`** `feat(spa): F3-I1.6` — cleanup `#page-grupos` legacy (`<div class="container">` entero eliminado, -61 LOC; conservado `<a id="top">`) + chips ADMIN/logout en shell v3. Nuevas funciones `stagePillRowHTML()` (wrap del stage pill con 2 chips) + `refreshShellUserChips()` (toggle visibilidad según `currentUser`/`is_admin`); expuesto `window.refreshShellUserChips`. CSS append `.v3-stage-row` + `.v3-shell-chip` con variantes admin/logout. Chips visibles automáticamente en las 4 `SHELL_PAGES`.

**Smoke OK**: grupos+elim v3 renderizan donde deben tras estos 4 commits.

**Bugs UX detectados (próxima sesión)**:
1. Hueco demasiado grande stage pill ↔ v3-board (CSS spacing).
2. Post-simulación grupos: "Clasificación" en cada bracket rompe estética.
3. Eliminatorias post-simulación: sin banderas / formato amigable.
4. **F3-I1.6.2** — chip logout no funciona (class `do-logout` no captura listener legacy). Fix ~5 LOC.
5. **F3-I1.6.1** — posible null-deref `scoring.js:1239` (`total-points`) y `:1315` (`groups-container`) tras cleanup. Verificar TypeError en consola; fix `if(el)` guards ~5 LOC.

**Diferido a F3-I1.7**: cleanup análogo `#page-elim` (legacy F7.X.4 mounts + view-cinematic/bracket/stadium + finalizar-section + modal — requiere análisis previo de referencias vivas tipo `#total-ko-pts` que `updateKOPts` en `ui-nav.js` sigue invocando).

**Lección persistida (audit doc + CLAUDE.md)**: F2.x cerrado en sandbox aislado ≠ integrado al SPA. Verificar SIEMPRE que scripts/CSS estén incluidos en `index.html` + `main-entry.js` antes de asumir wiring funcional.

## F2.9 — Eliminatoria smoke visual cerrado + HF-cierre doc (15 may 2026)

**Branch**: `claude/port-world-cup-design-FvZpD` (NO mergeado a main). HEAD del HF-cierre: `<sha_post_commit>`. 14 commits HF pusheados 14-may + 1 commit HF-cierre doc 15-may.

**HOTFIX visuales (4)**:
- **HOTFIX-01** — shell min-height para evitar layout shift al montar zoom-overlay.
- **HOTFIX-02** — modal inner querySelector roto en `eliminatoria-v3.js` (selector tras refactor namespace).
- **HOTFIX-03** — ERR-43 redux: pointer-events gating en sub-overlays goleador picker (replicado en KO).
- **HOTFIX-04** — sandbox `showPage` bypass para localhost sin auth.

**HF tematizados**:
- **HF-05** — quita botón EDITAR (redundante con tap directo) + overflow nombres largos + stub confirm doble + textos penaltis ("Penaltis" en vez de "P.").
- **HF-06** — trofeo intermedio entre cards finales + URL prototipo + overflow F + alineación al prototipo + simetría + box-sizing border-box. **6 iteraciones (a/bis/ter/quater/quinto/sexto)** por improvisar fix sin leer prototipo standalone primero — **lección persistida**: coherencia con prototipo > recomendación propia.
- **HF-09** — motor de puntuación: regla +2 goleador sin filtros por marcador ni equipo. `realScorers` parámetro nuevo en `calcMatchPoints` + `calcKOMatchPoints`. Fallback `_hf09FallbackScorers` placeholder hasta hidratación pipeline real. **7/7 tests pasan**. Backwards compatible. Doc `scoring-engine.md` añade sección "Regla del +2 goleador (F2.9 HF-09)".
- **HF-10-bis** — winner como header static dentro del card final (revierte HF-10 erróneo). Posicionamiento absolute → static, margin compensa padding, fondo dorado sutil + border-bottom + integración chip→header. Eyebrow GRAN FINAL visible debajo (línea 1 winner + línea 2 eyebrow + línea 3 match). **Lección persistida**: solapamiento visual ≠ ocultar un elemento; pedir referencia visual antes de proponer fix.

**HF-cierre doc-only (15 may, este entry)**:
- `git mv docs/AUDIT_CARDS_LEGACY_VS_V3.md docs/AUDIT_LEGACY_VS_V3.md`.
- Audit doc **+ sección "Funcionalidades transversales"** con 9 puntos integración v3↔legacy (I1-I9) — reframe scope v3 = 2 screens (Grupos+Fase final), no rewrite completo. Decisión I2: shell v3 en 4 pages (todas menos predictor).
- Audit doc **+ sección "Backlog F3"** con HF-08 detallado en 5 bloques A-E (simulación E2E + propagación grupos→KO + render nombres reales).
- Update CLAUDE.md (estado F2.9 cerrada + Top-3 reordenado priorizando fundamentos F3 I1-I4 + mapa doc actualizado).
- NO toca código.

**Pendientes inmediatos post-F2.9**:
- F3 fundamentos: I2 (3 LOC) → I1 (~80 LOC) → I3 (~60 LOC) → I4 (~50 LOC) [bloqueador 11 jun].
- HF-08 (3-5h estimadas).
- F3 UX: I5+I6+I7 (~340 LOC).
- F3 refinamiento: I8+I9.

## 2026-05-14 — Redesign v3 (F2 base estable Grupos) — rama `claude/port-world-cup-design-FvZpD`

HEAD `5b87645`. **NO mergeado a main** — F3 wiring SPA pendiente. Cierre sesión Code↔San tras validación visual completa Grupos. 6 commits F2.5 → F2.8.2.

**4 colisiones namespace v3 resueltas** (lección: classic-scripts last-write-wins. Solución: sufijo `Grupos`/`KO` + scope CSS bajo ancestor):

- **F2.3** `4a27043` — `.v3-trophy-col { display: none }` global elim ocultaba trofeo Grupos. Scope a `.v3-bracket-board:not(.v3-ko-board--F)`.
- **F2.4** `9a52346` — `@keyframes v3-trophy-float` duplicada. Rename elim a `v3-trophy-float-final`.
- **F2.5** `7f7d8fc` — skeleton modal duplicado en grupos+elim. Movido a `mundial-shell-v3.css` (Opción A San). -162 LOC.
- **F2.7** `97ff372` — `v3RenderZoom/CloseZoom/AdjustScore` declaradas en ambos (signature distinta). Hoisting global → grupos ejecutaba versión KO → modal "transparente". Rename `Grupos`/`KO` + 17 callers via `sed -i \b...\b`.

**F2.6** `3725ce0` — defensive shell init (removido wrapper `[data-v3-zoom-host]`) + diag logging Chrome MCP.

**F2.8** `c303ee9` — Goleadores tab + chips puntuación. 3 tabs (Marcadores/Goleadores/Clasificación). Chips 3 estados (pre-kickoff/0 pts/N pts stack+total). +636 LOC. Bug pre-existente: `saved: true` (antes `false` → impedía scoring).

**F2.8.1** `d77e02d` — Goleador picker unificado. 2 picks → 1. Sub-overlay con secciones home+away. Save infiere side via lookup.

**F2.8.2** `5b87645` — Fix CRÍTICO bloqueo página. `.v3-squad-picker-panel__inner` con `pointer-events: auto` sin gating `.is-open` capturaba clicks invisibles tras 1ª apertura. Fix: gating sibling + JS defensive `innerHTML = ''` al cerrar.

**ERR-43 + E14** documentados. **`docs/AUDIT_CARDS_LEGACY_VS_V3.md`** 15 features (3 ALTA: IA tooltip, EN VIVO, Boost UX). Referencia F3.

**Próximos**: F2.9 smoke Eliminatoria + F3 wiring SPA + squads reales EF `get-squad` v6.

