# Audit — Match-card features Legacy vs Redesign v3

**Fecha:** 14 may 2026 · **Sesión cierre:** F2.8.2 base estable redesign v3 (HEAD `5b87645`).

**Scope:** comparar features presentes en match-cards de la versión **legacy** (pre-redesign, archivos `public/js/ui-groups.js`, `public/js/ko.js`, `public/js/ui-elim-shell.js`) vs **redesign v3** (`public/js/v3/grupos-v3.js` + `public/js/v3/eliminatoria-v3.js`). Documental — no implementa nada.

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
