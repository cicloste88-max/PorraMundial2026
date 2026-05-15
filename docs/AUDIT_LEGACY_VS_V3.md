# Audit — Legacy vs Redesign v3

**Fecha:** 14 may 2026 (sección original match-cards) · **Ampliado:** 15 may 2026 (secciones Funcionalidades transversales + Backlog F3). **Sesión cierre:** F2.9 funcional cerrada con 14 HFs (HEAD `d43caf6`, HF-10-bis); HF-08 propagación grupos→KO en Backlog F3.

**Scope:** comparar features presentes en match-cards de la versión **legacy** (pre-redesign, archivos `public/js/ui-groups.js`, `public/js/ko.js`, `public/js/ui-elim-shell.js`) vs **redesign v3** (`public/js/v3/grupos-v3.js` + `public/js/v3/eliminatoria-v3.js`). Documental — no implementa nada.

**Reframe scope v3 (15 may 2026):** redesign v3 NO es un rewrite completo. v3 sustituye contenido de **2 screens del tabbar legacy** (Grupos y Fase final); resto pages siguen legacy. Shell v3 (fifa-bar+countdown+qualified-cta+stage-pill) se monta en `['grupos','jornada','directo','elim']` — decisión I2 quita `'predictor'` del array actual. La sección "Funcionalidades transversales" abajo documenta los 9 puntos de **integración v3↔legacy** (NO son features por portar a v3).

Las match-cards v3 viven en el modal zoom (`v3RenderMatchesList` + `v3RenderZoomGrupos` para Grupos; `v3RenderKoCard` + `v3RenderZoomKO` para Eliminatoria).

---

## Tabla de features

| # | Feature | Status legacy | Portada v3 | Effort | Prioridad | Notas |
|---|---|---|---|---|---|---|
| 1 | **Tooltip IA con predicción contraria** (frase) | ✅ `ui-groups.js:466` consume `iaBonusWillApply` + frase IA inline en card | ❌ NO portada | M (~80 LOC) | 🔴 ALTA | Sin esto la mecánica de bonus IA del scoring no es transparente al usuario. Goleadores tab v3 ya muestra chip "IA" si bonus aplica, pero no el preview previo a kickoff. Wire: `iaPredictions[matchKey]` global + `v3RenderMatchesList` añade tooltip por card. |
| 2 | **CEST pill / kickoff display en cards** | ✅ `ui-groups.js:174,444` (`hora` helper con toLocaleTimeString('es-ES')`) + estadio en `jv2-card-stadium` | ⚠️ PARCIAL — v3 no muestra hora ni en card ni en modal | S (~20 LOC) | 🟡 MEDIA | UX: en el modal v3 (3 tabs) cada match-card podría incluir píldora "🕒 21:00 CEST · 🏟️ Atlanta". Legacy lo tenía en cards de jornada (Vista Jornada). |
| 3 | **Long-press / tap-hold → Pizarra Táctica** | ⚠️ Trigger via flag-click en `ui-directo.js:769` (`window.openPizarraTactica({iso2})`), NO long-press | ❌ NO portada en v3 (helper expuesto pero no consumido) | M (~40 LOC) | 🟡 MEDIA | Decisión UX San: ¿long-press en flag del equipo en card v3? ¿O botón explícito en sub-overlay del goleador picker (link "Ver plantilla")? Helper `window.openPizarraTactica({nameEn})` ya disponible (ui-pizarra-tactica.js:378). |
| 4 | **EN VIVO / DIRECTO indicator durante partido** | ✅ `ko.js:867` (`stxt.textContent='EN VIVO '+min+"'"`) tras `live_scores` snapshot | ❌ NO portada | M (~60 LOC) | 🔴 ALTA | El día-D del Mundial los usuarios verán el bracket KO con marcadores live; sin indicador EN VIVO no saben qué partido está activo. Wire: `live-sync.js` ya carga `_liveScoresByMatchKey`; v3 cards consumen + render píldora pulsante. |
| 5 | **Stadium info / venue en cards** | ✅ Modal legacy abrir partido → muestra `m.stadium` o `m.venue` en pill | ❌ NO portada | S (~15 LOC) | 🟢 BAJA | Modal v3 podría mostrar estadio en el header (eyebrow). Lectura directa de `match.stadium` (PARTIDOS) o `match.venue` (BRACKET). |
| 6 | **Auto-Pichichi (Bota Oro) por goles pronosticados** | ❌ Legacy NO lo tenía auto — selección manual en AwardsForm | ❌ N/A | — | 🟢 BAJA | Top-3 #3 pre-existente. Algoritmo: tras 6/6 marcadores grupos, sumar goles por jugador previamente seleccionado como `gol`, sugerir como Bota Oro. Goleadores tab v3 ya recolecta `pred.gol` por partido — base perfecta para auto-sugerencia. |
| 7 | **Score IA vs Score usuario (comparativo visual)** | ✅ `ui-groups.js:476` lee `iaPredictions[matchKey]` y renderiza score IA bajo score usuario | ❌ NO portada | M (~50 LOC) | 🟡 MEDIA | Educativo: usuario ve qué predijo Zayu vs lo suyo. Útil para entender bonus IA. Modal v3 podría mostrarlo en el match-card via row secundaria pequeña. |
| 8 | **Award badges (Balón / Bota / Guante Oro / Mejor Joven)** | ✅ `scoring.js:1366` define `AWARDS_CFG` con icons + nombres + pts. Render en page Predictor + AwardsForm | ⚠️ PARCIAL — los premios viven en page-predictor, no en cards de grupo (correcto). En v3 ninguna parte los muestra | M (~100 LOC) | 🟡 MEDIA | Cuando F3 wire page-predictor, asegurar que los 4 awards (`golden_ball`/`golden_boot`/`golden_glove`/`young_player`) tienen UI v3. Independiente de cards-de-partido. |
| 9 | **Boost ticker / día ×2** | ✅ `ui-groups.js:53-150` (`boostPicks`, `boost-ticker`, indicador día activo) | ❌ NO portada | L (~200 LOC) | 🔴 ALTA | Top-3 #1 — pre-Mundial crítico. v3 necesita: (a) selector boost por jornada en modal o tab, (b) lock del 1er partido del día, (c) badge ×2 en cards de la jornada elegida, (d) defaults sugeridos por calendario FIFA. |
| 10 | **Botón Compartir pronóstico (share)** | ❌ Legacy NO lo tenía en cards de grupo (sí en page Predictor → `ui-pred-shell.js`) | ❌ N/A | — | 🟢 BAJA | Fuera de scope match-cards. Si se quiere "share my group A pronostico" → feature nueva post-F3. |
| 11 | **Confetti / animación al completar 6/6** | ❌ Legacy NO lo tenía | ❌ N/A | S (~30 LOC) | 🟢 BAJA | Mejora UX opcional. Modal v3 "Pronosticos guardados" footer podría disparar confetti emoji-rain al 6/6. |
| 12 | **Auto-show next match en jornada activa** | ✅ `live-sync.js` + `mundial-shell-v3.js` post-kickoff actualizan fifa-bar con "EN VIVO · X vs Y" (F1.1d-h) | ✅ PORTADA en shell (cabecera global), no en cards | — | — | OK. Cabecera global tiene `data-v3-next-match`. F2.9 elim podría replicar info por ronda. |
| 13 | **Cinta tabs ronda mobile** | ⚠️ Legacy tenía issue (Top-3 #3, item 1 pre-existente) | N/A v3 — round-switcher 5 pills sustituye la cinta (D9 plan v3) | — | — | Resuelto por design v3. |
| 14 | **Auto-completar Pichichi torneo** | ⚠️ Top-3 #3 pre-existente (legacy bug) | N/A v3 — pendiente backend (porra-ia-compute action `update_ia_scorers`) | — | — | Backend pre-11jun (item 3 del top-3 viejo). |
| 15 | **Frases IA wiring para pronóstico signo** | ⚠️ Top-3 #3 item 4 — wiring inacabado en legacy | ❌ NO portada | M (~40 LOC) | 🟡 MEDIA | Relacionado con item 1 (tooltip IA). Mismo trabajo, mismo wire `iaPredictions[matchKey].sign`. |

---

## Resumen ejecutivo

**Alta prioridad (3 features)** — bloquean experiencia del Mundial:
- IA tooltip + frase contraria (items 1, 15).
- EN VIVO indicator durante partido (item 4).
- Boost UX completo (item 9).

**Media prioridad (5 features)** — UX importante pero no bloquea Mundial:
- CEST pill + kickoff display (item 2).
- Pizarra trigger desde card v3 (item 3).
- Score IA vs usuario comparativo (item 7).
- Award badges en page-predictor v3 (item 8).
- Stadium info (item 5).

**Baja prioridad / opcional (4 features)** — quality-of-life:
- Auto-Pichichi sugerencia (item 6).
- Compartir pronóstico (item 10).
- Confetti 6/6 (item 11).

**OK / resueltos** — items 12, 13, 14.

---

## Wiring sugerido (F3 / F2.9)

| Feature | Wire en | Helper a reusar |
|---|---|---|
| IA tooltip + frase | `v3RenderMatchesList` modal Grupos + `v3RenderZoomKO` modal Elim | `iaPredictions[matchKey]` global · `iaBonusWillApply(matchKey, pred, realL, realR)` |
| EN VIVO indicator | `v3RenderGroup` cards del board + `v3RenderKoCard` | `window._liveScoresByMatchKey[matchKey]` (live-sync.js) |
| Boost ×2 | Nueva tab "Boost" en modal grupo + badge en `v3-match-card` de la jornada elegida | `boostPicks[date]` global · `savePredictions()` ya soporta |
| Stadium pill | Header del modal v3 + en cards de jornada | `match.stadium` (PARTIDOS) · `match.venue` (BRACKET) |
| Pizarra trigger | Flag click en card v3 con long-press 600ms OR botón en sub-overlay goleador | `window.openPizarraTactica({nameEn})` ya expuesto |

---

## Notas

- El audit NO contempla features del page-predictor v3 (`ui-pred-shell.js`) — solo match-cards.
- El audit asume F3 mantendrá la estructura modal 3 tabs Grupos + round-switcher Elim como contenedor principal. Cambios estructurales (nueva tab Boost, etc.) deben validarse con San antes de F3 implementation.
- Items 14 + 15 son pre-existentes del top-3 antiguo y aplican igualmente al redesign v3 — no son regresión.

---

## Funcionalidades transversales — Integración v3 ↔ legacy

**Scope:** puntos de **integración / colisión** entre v3 (los 2 screens grupos+elim + shell global) y resto del SPA legacy (tabbar, state global, modales, pages legacy). NO son features a portar a v3 — el reframe del 15 may aclara que v3 son 2 screens, no un rewrite completo.

**Análisis:** árbol legacy en `public/js/` (25 ficheros JS) vs v3 en `public/js/v3/` (4 ficheros: `mundial-shell-v3.js`, `grupos-v3.js`, `eliminatoria-v3.js`, `next-match-resolver-v3.js`). Shell v3 declara `SHELL_PAGES = ['grupos','jornada','directo','elim','predictor']` (5 pages); decisión I2 reduce a 4 (sin `'predictor'`).

| # | Punto de integración | Evidencia | Decisión / Effort F3 | Prioridad |
|---|---|---|---|---|
| **I1** | **Routing tabbar → render v3.** `ui-nav.showPage('grupos')` y `'elim')` deben (a) destruir contenido legacy del screen, (b) montar shell v3 + invocar `v3RenderGroup` / `v3RenderKO`. | Shell v3 escucha `mundial:page-changed`; `ui-nav.showPage` NO lo dispara. SPA stub. | M (~80 LOC en `ui-nav.js`: dispatch event + remove legacy render en 2 pages). | 🔴 ALTA |
| **I2** | **Scope shell v3.** Pages donde se monta fifa-bar+countdown+qualified-cta+stage-pill. | Actual: `SHELL_PAGES = ['grupos','jornada','directo','elim','predictor']`. Decisión San (15 may): **todas menos predictor** → `['grupos','jornada','directo','elim']`. Predictor mantiene su propio header legacy `ui-pred-shell.js`. | S (~3 LOC: ajustar array en `mundial-shell-v3.js`). | 🔴 ALTA |
| **I3** | **State global compartido.** `userPredictions`, `koPredictions`, `iaPredictions`, `boostPicks`, `currentLeague`, `_porraDb`. Legacy escribe, v3 lee. Mutaciones legacy deben re-renderizar v3. | v3 cards consumen `window.userPredictions` etc. Re-render tras `savePredictions()` legacy: no garantizado. | M (~60 LOC: event bus `mundial:predictions-changed` disparado en savePredictions + listeners en v3). | 🔴 ALTA |
| **I4** | **Cierre porra → cards v3 read-only.** Tras kickoff, `close-porra.js` legacy fija flag. Cards v3 grupos/elim deben respetarlo: deshabilitar chips, picker, save. | `close-porra.js` expone state porra-cerrada. v3 cards no lo consultan. | M (~50 LOC: read flag en `grupos-v3.js` + `eliminatoria-v3.js`). | 🔴 ALTA (bloqueador 11 jun) |
| **I5** | **EN VIVO indicator** en cards v3 grupos/elim durante partido. | `live-sync.js` carga `window._liveScoresByMatchKey`. v3 cards no consumen. Solapa audit item 4 match-cards. | M (~60 LOC). | 🔴 ALTA |
| **I6** | **IA Predictor wiring** (tooltip + frase IA + score IA vs usuario) en cards v3 grupos+elim. | `iaPredictions[matchKey]` ya global. Solapa audit items 1+7+15 match-cards. | M (~80 LOC). | 🔴 ALTA |
| **I7** | **Boost UX completo** en modal grupos v3 (no aplica a elim). | `boostPicks` global existe en legacy. v3 modal grupos no tiene selector boost ni badge ×2. Solapa audit item 9 match-cards. | L (~200 LOC). | 🔴 ALTA |
| **I8** | **Pizarra Táctica entry point** desde flag en cards v3 grupos/elim. | `window.openPizarraTactica({nameEn})` expuesta. v3 cards no la consumen. Solapa audit item 3 match-cards. | S (~30 LOC). | 🟢 BAJA |
| **I9** | **CSS cascada / z-index colisiones.** Modales legacy (banner cierre porra, toast, dropdowns leagues) vs zoom-overlay+panel v3 cuando coexisten en DOM. | Prefix `.v3-*` mitiga selector specificity, pero `position`/`z-index` no. Riesgo: overlay legacy sobre/debajo de panel v3 mal. | S-M (auditoría z-index map tras inspección). | 🟡 MEDIA |

**Resumen prioridades:**
- 🔴 ALTA (7): I1+I2+I3 fundamentos integración; I4 bloqueador 11 jun; I5+I6+I7 UX en cards (solapa audit match-cards).
- 🟡 MEDIA (1): I9 CSS cascada.
- 🟢 BAJA (1): I8 pizarra entry point.

**Notas implementación:**
- **I1 + I2 + I3 son los 3 fundamentos.** Sin ellos las cards v3 son "isla" desconectada del state legacy.
- **Orden sugerido F3:** I2 (3 LOC trivial) → I1 (wiring SPA) → I3 (event bus) → I4 (close-porra) → I5+I6+I7 (UX cards) → I8+I9 (refinamiento).
- **Solapamiento con audit match-cards (15 features tabla anterior):** I5↔item 4, I6↔items 1+7+15, I7↔item 9, I8↔item 3. La tabla transversales referencia el wiring; la tabla match-cards detalla las features específicas.
- **HF-08 (propagación grupos→KO + render nombres reales) NO está en transversales** — es trabajo de scoring/state interno de los 2 screens v3. Va en Backlog F3 abajo.

---

## Backlog F3

Trabajo diferido a F3 detectado durante F2.9. Independiente de las tablas anteriores.

### HF-08 — Simulación E2E + propagación grupos→KO + resolución equipos brackets + render nombres reales

**Origen:** sesión 14 may 2026. Code interrumpido durante implementación; brief de 5 bloques A-E no llegó a pushear. **No retomado en F2.9** por decisión San (15 may): cerrar F2.9 funcional sin HF-08, capturarlo en Backlog F3.

**Scope (5 bloques A-E):**

**A. Simulación E2E**
- Pipeline desde 6/6 marcadores grupos → cálculo standings → 16 mejores 2º (8 grupos × 2) + 8 mejores 3º → llenar R32 inicial.
- Test fixture: predicciones completas en `userPredictions` + `koPredictions` desde grupos hasta final.

**B. Propagación grupos→KO**
- Helper `propagateGroupsToKO(predictions)` calcula clasificados por grupo.
- Slots R32 (16 partidos) llenados con códigos canónicos (`A1`, `A2`, `T_BEST_3RD_1`…`T_BEST_3RD_8`).
- Tie-breaking: gol diferencia, goles a favor, fair play (FIFA rules).

**C. Resolución equipos en brackets**
- Helper `propagateKOWinner(matchKey, winnerCode)` actualiza slot correspondiente en siguiente round.
- Cascada R32 → R16 → QF → SF → Final + 3er puesto.
- Idempotente: re-llamada con mismo winner no duplica.

**D. Render con nombres reales**
- Cards eliminatoria v3 (`v3RenderKoCard`) deben mostrar nombres reales tras propagación.
- Placeholders previos ("Grupo A 1º", "Mejor 3º X") sustituidos por nombres equipo + banderas.
- Helper `resolveKoMatchTeams(matchKey)` consulta state propagado.

**E. Tests integración**
- Escenario 1: solo grupos cerrados (R32 lleno, R16+ placeholders).
- Escenario 2: grupos + R32 cerrado parcialmente (mix nombres reales + placeholders).
- Escenario 3: bracket completo hasta Final + 3er puesto.

**Notas:**
- El brief detallado de 5 bloques de la sesión anterior NO se conserva. Reconstruir desde código (`public/js/v3/eliminatoria-v3.js` + `public/js/scoring.js` + `public/js/ko.js` legacy) en próxima sesión.
- HF-09 (motor +2 goleador sin filtros) y HF-10-bis (winner header static) son prerequisitos OK.
- Estimación: 3-5h trabajo Code + brief Claude.ai.

### Cleanup técnico post-F3

- `public/js/ui-groups-mobile.js` (33.7KB) — variant específica móvil legacy. v3 unifica móvil/desktop → candidato a `git rm` tras F3 wiring de Grupos.
- Subagentes Haiku para análisis dead code en `public/js/` (módulos parcialmente sustituidos por v3 ports). Pasar contexto inline (E13).
