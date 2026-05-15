# CHANGELOG — Porra Mundial 2026

Retención 90d. Auto-archivado a `CHANGELOG-archive-YYYYMM.md` si supera 30KB.

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

## 2026-05-13 — Squads pre-listas Mundial + EF v6 (deploy directo Claude.ai) — rama `sync/ef-get-squad-v6`

Sesión liderada desde Claude.ai. Cambios aplicados directamente al runtime Supabase (BBDD + EF) vía MCP. Esta rama sincroniza el repo con ese runtime; **no contiene cambios de lógica nuevos** (commit etiquetado `[no-deploy]`).

### Backend — schema squads (aplicado runtime, sin migration file)

3 columnas nuevas en `public.squads` para soportar plantillas completas (no solo XI titular):

- `jugadores_is_final` `boolean NOT NULL DEFAULT false` — true si la plantilla es la prelista/lista FINAL FIFA (no provisional).
- `jugadores_fuente` `text` — fuente concreta del array jugadores (`ff` | `as` | `365` | `infobae` | `fifa-official`).
- `jugadores_synced_at` `timestamptz` — timestamp del último sync del array (distinto de `updated_at` general).

ALTER aplicado directo por Claude.ai vía Supabase MCP el 13 may. No replicable con `supabase db push` (no hay migration file canónico). Documentado en `docs/db-schema.md` § Tablas Pizarra Táctica.

### Backend — Edge Function `get-squad` v6 ACTIVE

Deploy directo vía Supabase MCP. ID `aaf02673-e301-46e3-8ed1-c836ea2cb575`, version=6, `verify_jwt=true`. Retrocompatible v5 (frontend Pizarra Táctica no requiere cambios). Código sincronizado en `supabase/functions/get-squad/index.ts` (220 LOC) — primera línea `// supabase/functions/get-squad/index.ts — v6` como marker de versión.

Cambios v5 → v6:
- `extractXI(jugadores, formacion)`: filtra `es_titular === true` si al menos un elemento del array tiene el flag; si el array tiene exactamente 11 elementos sin flag → formato v5 antiguo (XI directo); en caso contrario → placeholders desde formación.
- `buildPlantilla(jugadores)`: normaliza el array completo al schema `PlantillaPlayer` (nombre, club, posicion_bucket, es_titular, posicion, dorsal, foto_url, dob, fuente).
- Respuesta enriquecida con `plantilla` (array completo, variable 23-55 jugadores) + `plantilla_meta` ({n, fuente, is_final, synced_at}). Mantiene `jugadores` (11 elementos XI) + `plantilla_completa` (bool legacy) + `fuente` + `updated_at` del contrato v5.

### Carga de plantillas — estado 13 may

7 de 48 selecciones cargadas en `squads.jugadores`:

| ISO3 | N jugadores | Estado | Fuente | Notas |
|---|---|---|---|---|
| ARG | 55 | prov | ff | con clubs |
| BIH | 26 | **FINAL** | as | — |
| BRA | 51 | prov | 365 | — |
| ESP | 53 | prov | ff | SIN clubs (FF no los trae) |
| MEX | 55 | prov | 365 | — |
| QAT | 33 | prov | infobae | SIN clubs |
| SWE | 26 | **FINAL** | ff | sustituye AS provisional |

UZB descartado este ciclo: prelista anunciada pero ninguna fuente accesible publica los 40 nombres completos parseables.

### Estrategia de carga ratificada

1. **FutbolFantasy** primaria (info más fresca, castellano).
2. **AS** backup.
3. **Transfermarkt** enriquecimiento (edad, valor) — Claude.ai en flight 13 may.
4. **FIFA.com** snapshot final 2 jun (dorsales + fotos, probablemente vía Chrome MCP).

### Lecciones operativas

- **`supabase functions download` requiere `SUPABASE_ACCESS_TOKEN`** en env del sandbox. Si no está disponible, alternativa: MCP `get_edge_function` retorna el código deployado vía `files[].content`. Workflow validado esta sesión (token ausente → MCP usado como source of truth).
- **Sync runtime → repo** requerido tras deploys directos desde Claude.ai. Sin esta sync, cualquier deploy futuro desde Code (`supabase functions deploy get-squad` u otro) machacaría el runtime v6 con la versión vieja del repo (v5 anterior, o NINGUNA versión si nunca se commiteó — caso real esta sesión, el directorio `supabase/functions/get-squad/` no existía en repo).
- **ALTER TABLE sin migration file** rompe paridad `supabase db push` / nueva instancia. Estado del schema vive en runtime + en `docs/db-schema.md`; no en `supabase/migrations/`. Anotar en migration-log + db-schema obligatorio.

## 2026-05-08 — Sprint Pizarra Táctica + Cuadro de Honor restore (rama `claude/pizarra-tactica-modal-kmTEw`)

4 commits sobre `claude/pizarra-tactica-modal-kmTEw` (base `f6847ab` post-merge globo). HEAD `533ec15`. **Lista para PR a `main`** (squash-merge desde GitHub UI). Sprint dual: (1) modal "Pizarra Táctica" con ficha visual de selección (escudo + 11 tokens en formación + stats) abierto desde el Globo y desde tarjetas de partido en Directo; (2) restauración del Cuadro de Honor (cajas Campeón + Podio) bajo la fila Final del nuevo `fc-elim-list` (huérfano tras la migración F7.4-F al App Shell — ERR-42).

### Commits del sprint (orden cronológico)

| SHA | Mensaje | Fase |
|---|---|---|
| `d34db7c` | feat: pizarra táctica modal con squads + EF get-squad | Base modal + 4 patches |
| `02aed94` | fix(pizarra): banda bandera 90→130px + título sobre fondo blanco | Hot-fix banda |
| `5a3ddde` | fix(pizarra): dark mode + tooltip tap + stats alineadas | Dark mode + tooltip |
| `533ec15` | feat(ko): restaurar Cuadro de Honor (cajas 2+3) bajo fila Final | Cuadro Honor restore |

### Funcionalidad nueva consolidada

**Pizarra Táctica modal** (`public/js/ui-pizarra-tactica.js` 540 LOC + `public/css/components/pizarra-tactica.css` 8.5 KB):
- Entry point único `window.openPizarraTactica({iso3 | iso2 | nameEn})`. Acepta los 3 identificadores (mapping interno `NAME_EN_TO_ISO3` con 48 selecciones para entrada desde Globo en inglés).
- 12 formaciones predefinidas con coordenadas % en `FORMATION_COORDS`: 4-3-3, 4-4-2, 4-2-3-1, 3-5-2, 5-3-2, 4-1-4-1, 4-3-2-1, 3-4-3, 5-4-1, 4-4-1-1, 3-4-2-1, 4-1-3-2.
- Cache en memoria (`Map`) por iso3/iso2 — una sola request por selección por sesión.
- Auth: lee JWT de `window._porraToken` (publicado por `auth.js` en `SIGNED_IN`/`TOKEN_REFRESHED`) con fallback a `sessionStorage.porra_token`.
- UI: modal centrado mobile-first 380px, dark theme `#1f2937`, banda superior 130px con bandera + mask gradient destination-out fade 75%, escudo 80px con drop-shadow, tokens 11.5% width circulares con halo negro sólido (8px) en apellido, tres stats (edad media · valor plantilla · goles/partido) con icon button info que despliega tooltip oscuro con flecha (auto-cierra 4s, cierra al tap fuera).
- Render token: `j.dorsal` + `j.nombre.split(' ').slice(-1)[0]` (apellido); placeholder posicional si `nombre === '—'`. Color de ficha desde `team.color_ficha` (#fff blanco → border #1f2937; oscuro → border #fff). Portero usa `team.color_portero`.
- Hooks de entrada: `window._globoNavPlantilla` (botón "🏟 Ver plantilla" del panel detalle Globo) y listener delegado en `ui-directo.js` que captura clics en `.dv2-mini-flag-btn`/`.dv2-exp-flag-btn`.

**Cuadro de Honor (cajas 2+3 bajo fila Final)** (`public/js/ko.js` +133 LOC + `public/js/ui-elim-shell.js` +11 LOC):
- Nueva función pública `window.buildChampionPodium(matchFinal)` en `ko.js` justo antes de `buildFinalSection` (sin tocar la función original — sigue usándose en el legacy `#view-cinematic`). Devuelve un único bloque DOM con caja 2 (Campeón con gradient dorado + escudo + sub-banner "FIFA World Cup 2026" + dato de sede MetLife / placeholder "Pronostica la final…") y caja 3 (Podio 🥈/🥉/4️⃣ con escudos pequeños + nombres + labels de posición) apiladas mobile-first (column gap 12px).
- Hook en `ui-elim-shell.js#_renderList`: tras procesar la fila `r.key === 'final'` y el bloque expanded, invoca `window.buildChampionPodium(BRACKET.final[0])` y `appendChild` al mount, **siempre visible** (no condicional a `expanded` ni `locked`).
- Resolución de equipos vía `resolvedSlots[matchFinal.home/away]` + `koPredictions[matchFinal.id]`. Puesto 2 deducido del perdedor de la final; puestos 3/4 del partido `BRACKET.third[0]`. Empates: usa `classifier` si está presente.
- Premios (caja 4 awards) sigue intacto en `#fc-elim-awards-pane` y NO se duplica.

**Backend (ya en producción al iniciar el sprint, sin cambios desde Code en esta sesión):**
- Tabla `public.squads` (48 filas) con columnas `iso3`, `iso2`, `equipo`, `formacion`, `entrenador`, `stat_edad`, `stat_valor`, `stat_goles`, `color_ficha`, `color_portero`, `plantilla_completa`. Una fila por selección clasificada al Mundial 2026.
- Edge Function `get-squad` v4 ACTIVE (en `supabase/functions/get-squad/`). Acepta `?iso3=XXX` o `?iso2=XX`, devuelve `TeamData` listo para `loadTeam()` con `flag_url`, `badge_url`, jugadores serializados con dorsal/nombre/posición, stats agregados.
- Storage `miniatures/pizarra/campo.webp` (38 KB, fondo del campo de fútbol) + `miniatures/badges/{slug}.png` (43 archivos — faltan BIH/COD/CZE/IRQ/SWE) + `miniatures/flags/{ISO2}.png` (48) + `miniatures/flags-sm/{ISO2}.webp` (48 versión small 148× para banderas in-line).

### Patches mecánicos aplicados (4 sobre código existente)

- `index.html` (+1 line): nuevo `<link rel="stylesheet" href="/css/components/pizarra-tactica.css">` tras `globo-equipos.css`.
- `js/main-entry.js` (+1 line): `loadScript('/js/ui-pizarra-tactica.js')` entre `ui-globo-equipos.js` y `ko.js`.
- `public/js/ui-directo.js` (4 cambios): `<span class="dv2-mini-flag">` → `<button class="dv2-mini-flag dv2-mini-flag-btn" data-iso2="X">` (×2 home/away en `_buildDMini`) + `<div class="dv2-exp-flag">` → `<button class="dv2-exp-flag dv2-exp-flag-btn" data-iso2="X">` (×2 home/away en `_buildDExpanded`) + listener delegado al final del IIFE que invoca `window.openPizarraTactica({iso2})`.

### Iteraciones de UI (3 hot-fixes para llegar a la versión final)

1. **Banda + texto legible** (`02aed94`): banda bandera 90→130px, mask fade 60→75%; título antes blanco con shadow → ahora `#111827` plano (cae sobre fondo blanco tras el fade); coach antes blanco → `#4b5563`. Header `margin-top` -32→-50px para compensar banda más alta.
2. **Dark mode + tooltip tap + stats centradas** (`5a3ddde`): modal background `#fff` → `#1f2937` (todos los textos invertidos a paleta clara); nuevo `.fc-pizarra-stat-val-wrap` que envuelve valor+icono con `position:relative + inline-flex` para centrado correcto; `.fc-pizarra-stat-info` convertida a `<button>` posicionado absoluto `left:100% top:50%` (no afecta centrado del valor); nuevo `.fc-pizarra-stat-tooltip` oscuro con flecha CSS pseudo `::before`; listener delegado en `buildOverlay()` que tap abre / tap fuera cierra / auto-close 4s.
3. **Cuadro de Honor** (`533ec15`): diagnóstico Chrome MCP DOM inspection sobre localhost:5173 reveló panels[0]=view-cinematic con `display:none` ancho 0, fila row2 con `final-box4 + final-box3` existían pero nunca renderizadas. Fix: extracción de la lógica de cajas 2+3 a función pública independiente + hook en `_renderList`. ERR-42 documentado.

### Lecciones técnicas

- **Network blocking**: el sandbox de Code (proxy Anthropic) bloquea Supabase Storage (`Host not in allowlist`) y solo deja pasar GitHub vía API autenticada (private repos requieren MCP — `api.github.com` sin auth devuelve 404). Workflow validado: si un sprint requiere assets, San los sube a la rama `handoff-pizarra` del propio repo y Code los lee con `mcp__github__get_file_contents`.
- **Verificación byte-equivalence**: tras escribir un archivo desde MCP, comparar `wc -c` con tamaño esperado y hacer un re-fetch de verificación. La conversión de escape sequences `'—'` ↔ literal `'—'` (em-dash UTF-8) cambia bytes pero no semántica — restaurar con `python3 sed-like` para paridad exacta.
- **Documentación de bugs vivos**: cuando un sprint diagnostica un bug que ya estaba "vivo" en main pero no detectado, documentarlo en `errores_conocidos_porra.md` aunque se haya cerrado en el mismo commit. ERR-42 es ejemplo: bug introducido en F7.4-F (28 abr) detectado y cerrado en sprint del 08 may.

### Bugs conocidos cerrados / nuevos ERR documentados

- **ERR-42 nuevo**: Cuadro de Honor invisible tras F7.4-F (cajas 2+3 huérfanas en `#view-cinematic` legacy). Detalle en `errores_conocidos_porra.md`.

## 2026-05-06 — Sprint Globo PR2+PR3+Enrichment (rama `feature/globo-pr2-pr3`)

12 commits sobre `feature/globo-pr2-pr3` (base `99fb581`). Pendiente squash-merge a `main` desde GitHub UI por San. Convierte el globo MVP (PR#54) en una experiencia interactiva enriquecida: leyenda con banderas circulares Supabase + chips de sedes, panel de detalle con formación + frase + dos bios (sport.es narrativo + ESPN táctico), highlight rojo del país clickado, separadores A/B/C en carrusel, leyenda clasificados/sedes en lateral derecho.

### Commits del sprint (orden cronológico)

| SHA | Mensaje | Fase |
|---|---|---|
| `3c5801d` | feat: add wiki-data-globo.js with 45 teams + 16 venues | PR2 — datos |
| `c0f32ed` | feat(globo): PR2+PR3 flag legend + detail panel | PR2+PR3 — UI base |
| `a8ccd23` | feat(globo): UX polish — flag-only legend, venue chips, bio expand, squad stub | Polish |
| `11a7bde` | fix(globo): canvas flex + flag emoji from ISO3 table | Fix legend |
| `b8a2ef2` | fix(globo): badge images from Supabase (intermedio, superseded) | Iter |
| `6cb8f4b` | fix(globo): circular flag images from Supabase flags bucket | Iter final |
| `e205a84` | feat(globo): highlight país seleccionado en rojo + reset zoom al cerrar | Highlight |
| `adfff22` | fix(globo): clear flag is-active on reset | One-liner |
| `2a4bbad` | fix(globo): center extensive countries + sede highlight + tooltip cleanup | 3-fixes |
| `851ca93` | feat(globo): formación + frase ESPN + bios duales + grupos en carrusel | Enrichment v2 |
| `010b189` | polish(globo): fix wiki-bio textos + chip formación + leyenda lateral | Polish v2 |
| `6d058b2` | fix(globo): chip formación con ancho ajustado al contenido | Final fix |

### Funcionalidad nueva consolidada

- **Datos**: `public/js/data/wiki-data-globo.js` (45 selecciones + 16 sedes — apodo, grupo, confederación, mundiales, mejor resultado, entrenador, estrella, frase) + `public/js/data/wiki-bio.js` v3 (48 selecciones — apodo, formación, frase, bio sport.es, bio_espn ESPN). Las 4 selecciones nuevas en v3 (Turkey, Sweden, DR Congo, Iraq) ya tienen ficha completa.
- **Carrusel banderas**: rejilla horizontal scrollable con 48 banderas circulares 28×28 (`object-fit:cover; border-radius:50%`) servidas desde bucket Supabase `flags/<ISO3>.png`. Separadores A→L cada 4 banderas (mini-badge dorado monospace `pointer-events:none`).
- **Carrusel sedes**: segunda fila scrollable bajo banderas con 16 chips `📍 Nombre` clicables.
- **Leyenda tipos**: dos chips translúcidos verticales en lateral derecho (`position:absolute; right:12; top:50%; backdrop-filter:blur(4px)`), libera espacio inferior para los carruseles.
- **Panel detalle país** (`renderPanelPais`): header con título + apodo + pill formación (`Formación: 4-3-3` con `__pill-label` uppercase + valor monospace dorado, ancho ajustado al contenido) + frase italic con border-left dorado + grupo/confed/mundiales/mejor/coach + estrella card + dos `<details>` colapsables (sport.es abierto + ESPN cerrado) + botón `🏟 Ver plantilla` (stub PR4) + atribución dual.
- **Panel detalle sede** (`renderPanelSede`): estadio + país + capacidad + inauguración + equipo local + ronda máxima + dato destacado.
- **Highlight 3D del país clickado**: `_selectedNE` + `polygon*Color` callbacks usan `COL.SEL_CAP/SEL_STROK/SEL_SIDE` (`#d93025`/`#ff6b5b`/`#a01f16`). Re-render con `globe.polygonsData(globe.polygonsData())`. Cerrar panel → reset color + animación `pointOfView` al inicial.
- **Highlight de sede**: `_selectedSede` + `pointColor/Altitude/Radius` como funciones reactivas. Sede activa: roja + altitude `0.12` + radius `0.9`.
- **Centroides override** (`COUNTRY_LATLNG_OVERRIDE`): tabla manual de 12 países con bounding box engañoso (USA con Alaska, UK/France/Russia/Australia/Brasil/Norway/NZ con extensión continental). Override gana sobre EQUIPOS.lat/lng y sobre el centroide de `polygonsData`.
- **Tooltip cleanup** (`hideGlobeTooltip`): `display:none + setTimeout 50ms` reset, evita tooltip `.scene-tooltip` colgado cuando el panel cubre el cursor.
- **Canvas flex layout**: `.fc-globo-overlay { display:flex; flex-direction:column }` con `.is-open`. Canvas como `flex:1 1 0; min-height:0` y leg como `flex-shrink:0` reservan espacio. `globe.height(canvasEl.clientHeight || (window.innerHeight - 200))` con fallback + `requestAnimationFrame` en onResize / openOverlay-cached.

### Bugs conocidos cerrados / nuevos ERR documentados

- **ERR-39** (nuevo): ESPN scraping con regex non-greedy corta frases con comillas anidadas. Solución: regex greedy en `wiki-bio` v3.
- **ERR-40** (nuevo): ESPN HTML inserta espacios falsos tras vocales con tilde (`"Panam á"`). Solución: parser robusto con clean_html.
- **ERR-41** (nuevo): pill flex hijo en contenedor flex column hereda `align-items:stretch`. Solución: `align-self:flex-start + max-width:max-content`.

### Lecciones técnicas

- **Cherry-pick de commits inexistentes**: brief intermedio pidió `git cherry-pick 0dea54f` que solo vivía en local de San. Verificar `git rev-parse <SHA>` antes de aplicar; si el commit no está en remoto, reportar y proponer alternativas. Resultó ser no-op (los valores 5.0/4.2 ya estaban desde PR2).
- **Tabla ISO3 emoji incompleta**: el brief omitía TUR/SWE/COD de los 48 EQUIPOS. Verificación cruzada `EQUIPOS[].flag` vs tabla del brief evita fallback feo.
- **Patrón badge-with-flag-fallback** (`CLAUDE.md`): siempre dual-render. Cuando el brief solo render uno, mantener el patrón completo y notarlo como deviation. Regla de proyecto manda sobre el brief específico.
- **Inline `onclick` con escapes**: HTML entities (`&#39;`) más robustos que `\'` para single-quotes anidados en JS string → HTML attribute.
- **Subagentes**: ninguno en este sprint (tareas demasiado acopladas a `ui-globo-equipos.js`).

## 2026-05-06 — fix(ia): tooltip explainer z-index sobre cluster 9999 (PR#58)

PR #58 squash a main (`ae8090f`).

**Bug:** el tooltip explainer del IA Predictor (`#ia-explainer-popover`) quedaba detrás del modal de edición al hacer click en `.ia-pct-trigger` (76% / 78% etc). El popover se mostraba con su contenido correcto pero ofuscado por el modal.

**Causa:** `.ia-explainer` y `#jcard-modal-overlay` ambos con `z-index:9999` (`base.css:1170` y `ui-groups.js:615` inline respectivamente), ambos hijos directos de `body`. El modal se recrea en cada apertura → queda DESPUÉS en el DOM → gana por la regla CSS "empate de z-index → orden de pintado".

**Fix:** `.ia-explainer` `z-index 9999 → 10001` (sobre cluster `9999` completo: `#jcard-modal-overlay`, `#splash-screen`, `.adm-toast`, `.fc-globo-overlay`).

**Alternativa rechazada:** re-appendear el popover al `body` en cada `showFor()` era frágil — dependería del orden DOM y se rompería si futuro componente se appendea más tarde.

<!-- Entrada 2026-05-06 fix(grupos) PR#56 archivada en CHANGELOG-archive-202605.md el 2026-05-16 (cierre sprint F3-I1.6.x + HF-08..HF-15, CHANGELOG.md superaba 30KB) -->
<!-- Entrada 2026-05-06 Sprint Globo MVP archivada en CHANGELOG-archive-202605.md el 2026-05-15 (cierre F3-I1.x, CHANGELOG.md superaba 30KB) -->
