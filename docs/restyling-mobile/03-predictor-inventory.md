# Predictor — Inventario actual del repo (A1)

**Generado:** 30 abr 2026
**Branch base:** `docs/predictor-design-source-v1` (parent main HEAD `82e25e3`, branch HEAD `4e5f775`)
**Bundle de referencia:** `docs/restyling-mobile/03-predictor-design-source.md`

---

## 1. Estado de `#page-predictor` en `index.html`

- **Líneas:** 631–636 (NO 36100-36300 como sugería el bundle — el archivo no llega tan lejos).
- **Contenido actual** (placeholder mínimo, 6 líneas):
  ```html
  <div id="page-predictor" style="display:none">
  <div class="container" style="padding:24px">
    <h1 style="font-family:'Inter Tight',sans-serif;font-size:22px;font-weight:900;color:#fff;letter-spacing:-.02em;margin:0 0 8px">🎯 Predictor IA</h1>
    <p style="color:#9ca3af;font-size:13px;margin:0">Widgets disponibles próximamente (F7.4-D-2).</p>
  </div>
  </div>
  ```
- **Diff esperado tras F7.7-VIS:** sustituir el bloque entero por mounts vacíos `#fc-pred-header` + `#fc-pred-tile` + `#fc-pred-stats` + `#fc-pred-filters` + `#fc-pred-list`. La lógica de mount + render vive en `public/js/ui-pred-shell.js` (NUEVO), análogo a F7.X (`ui-elim-shell.js`).

---

## 2. Modal genérico identificado

- **HTML:** `<div class="modal-overlay" id="modal">` en `index.html:658–663`. **Un solo modal reusable** (no hay variantes).
- **Funciones JS** en `public/js/ui-nav.js`:
  - `openModal(match)` — línea **56** (abre con contenido de partido; firma admite payload arbitrario).
  - `closeModal(e)` — línea **406** (cierra si click en overlay).
  - `closeModalBtn()` — línea **409** (quita `.open` y refresca vistas).
- **Animación CSS** en `public/css/ko.css:569–599`:
  - Clase `.open` activa: `opacity:1; pointer-events:all`.
  - `.modal-inner`: scale(.95→1) + translateY(20px→0), cubic-bezier(.34,1.2,.64,1).
  - Backdrop blur + overlay `rgba(0,0,0,.8)`.
- **Reusable para trophy modal:** ✅ SÍ. Trophy modal de §1.6 del bundle inyecta su contenido vía `#modal .content-wrap` y reusa la animación. No requiere nuevo modal ni rediseño.

---

## 3. Helper banderas (badge-with-flag-fallback)

- **Función:** `teamImg(name, size=36)`.
- **Archivo:** `public/js/ko.js:692–703`.
- **Comportamiento (3 fallbacks):**
  1. Badge primario (camiseta): `getBadgeUrl(team.slug)` → `<img>` con `object-fit:contain`.
  2. Bandera local: `${SB}/flags/${team.flag}.png`.
  3. Placeholder: `<div>` círculo gris (`#27272a`, border `#3a3a3e`) si `team` no resuelto.
- **Onerror chain:** la `<img>` tiene handler `onerror` → fallback automático a bandera si badge falla.
- **Reusable desde Predictor:** ✅ SÍ. F7.7 lo importa tal cual para `PredictionCard`.

---

## 4. `EQUIPOS[]` en `public/js/data.js`

- **Línea de declaración:** `data.js:23` (array literal).
- **Total entradas:** **48** ✅.
- **Estructura del objeto equipo:**
  ```js
  { name, name_en, slug, flag, players: [{ key, name }, ...] }
  ```
- **Estado playoffs UEFA:** completo, sin placeholders. (Plantillas con cobertura desigual: España 6 jugadores, Brasil 4, Argentina 5, Alemania 4 — backlog `EQUIPOS[].players` real pre-11jun.)

---

## 5. Componente goleador (búsqueda jugador)

- **¿Existe componente reusable?:** ❌ NO.
- **Estado actual:** dropdown `<select>` con `<option>` HTML inline construido por:
  - `public/js/scoring.js:603-639` — dentro de `createMatchCard(match, idx)` (cards de grupos).
  - `public/js/ui-nav.js:88-89` — dentro de `openModal(match)` (modal partido), duplicado.
- **Patrón actual:** `homeTeam.players.map(p => '<option value="' + p.key + '">' + p.name + '</option>').join('')` inline.
- **Reusable desde Predictor:** ❌ NO directo. Acoplado a la card de grupos. Decisión F7.7: usar el mismo patrón inline en `renderCard()` de `ui-pred-shell.js` (no extraer a helper en esta fase — over-engineering; alinear con regla "3 similares ≠ abstracción prematura"). Documentado como riesgo bajo.

---

## 6. Lectura `ia_predictions`

- **Helper:** `loadIAPredictions()` en `public/js/auth.js:58–109`.
- **Asignación global:** `window.iaPredictions` (auth.js:136).
- **Shape:**
  ```js
  {
    "${group}_${home_es}_${away_es}": {
      sign, confidence, quip, is_dudoso,
      p_home, p_draw, p_away,
      elo_home_raw, elo_away_raw, h2h_*, form_*, is_host
    }
  }
  ```
- **Key format:** `${group}_${home_es}_${away_es}` — equivalente a `getMatchKey()` (auth.js:75 `buildKey`).
- **Consumo actual:** `scoring.js:791, 895, 1097` (lookup directo `iaPredictions[matchKey]`).
- **Helper getter dedicado:** ❌ NO existe. Acceso directo al objeto. F7.7 chip "vs IA"/coincides reusa el mismo lookup.

---

## 7. Sistema boost x2

- **Tabla:** `boost_picks` (campos: `user_id`, `league_id`, `match_date`, `match_id`).
- **Helpers JS:**
  - Lectura: `loadBoostPicks()` — `public/js/data.js:213–244`.
  - Escritura: `saveBoostPicks()` — `public/js/data.js:198–211`.
  - Aplicación al scoring: `public/js/scoring.js:78–84`.
- **Lógica aplicación** (scoring.js:78–84):
  ```js
  if (isExact && matchKey) {
    const matchDate = PARTIDOS.find(...)?.date?.substring(0,10);
    if (matchDate && boostPicks[matchDate] === matchKey) {
      pts *= 2;  // máximo 14 pts
    }
  }
  ```
- **Estructura `boostPicks`:** `{ "YYYY-MM-DD": matchKey }` (1 boost por día).
- **Cambios en F7.7:** ❌ ninguno (NO TOCAR §8 del bundle). Solo se LEE para mostrar contexto si aplica.

---

## 8. CSS heredado relevante

### 8.1 Archivos en `public/css/components/`

| Archivo | Contenido one-liner |
|---|---|
| `app-header.css` | Header principal + estilos gate modal |
| `bottom-tab.css` | Navegación tab bar inferior |
| `elim-shell.css` | Shell visual `#page-elim` (F7.X — header, stepper, list, responsive) |
| `elim-tokens.css` | Brand + neutrals + semantic tokens (F7.X) |
| `tokens.css` | Layout/z-index/transitions/radii (legacy) |

### 8.2 Tokens existentes en `elim-tokens.css`

| Token | Valor | Línea | Estado para F7.7 |
|---|---|---|---|
| `--fifa-red` | `#E30613` | 8 | reusable |
| `--fifa-green` | `#006341` | 9 | reusable |
| `--fifa-blue` | `#0A4595` | 10 | reusable |
| `--fifa-gold` | `#C9A961` | 11 | reusable |
| `--fifa-gold-deep` | `#9A7B3A` | 12 | reusable ✅ ya existe |
| `--ink-900..50` | escala 9 | 15–24 | reusable |
| `--win` | `#00834A` | 28 | reusable ✅ ya existe |
| `--draw` | `#B7860B` | 29 | reusable ✅ ya existe |
| `--loss` | `#6F1E22` | 30 | reusable ✅ ya existe |

### 8.3 Tokens a añadir en F7.7

- `--fifa-gold-bg-from: #FFF8E1` (gradiente tile inicio).
- `--fifa-gold-bg-to: #FFEDB3` (gradiente tile fin).
- `--font-display`, `--font-text`, `--font-numeric`: **NO existen** como tokens (las families se inlinean en CSS hoy). F7.7 los introduce limpiamente. Decisión: **append a `elim-tokens.css`** (rename mental a `app-tokens.css` cuando convenga, no en esta fase).

### 8.4 Selectores en riesgo

- Ninguno crítico. El `#page-predictor` actual no expone ningún selector consumido fuera del propio contenedor (es placeholder).

---

## 9. JS hooks de actualización (rerender)

| Hook | Función | Archivo:línea |
|---|---|---|
| Cambio de liga seleccionada | `leagueSelect(league)` | `public/js/leagues.js:65–98` |
| Update live_scores (Realtime) | `liveSyncInit()` + cb `updateDirectoCard(matchKey)` | `public/js/live-sync.js` |
| Cierre/reapertura porra | `checkFinalizarReady()` | `public/js/close-porra.js:17–26` |
| Flag global porra cerrada | `window._porraCerrada` (set en leagues.js:71) | — |
| Cache live scores cliente | `window._liveScoresByMatchKey` | `live-sync.js` |

**Nota F7.7:** `ui-pred-shell.js` se suscribirá a estos 3 hooks vía `window.addEventListener` o callbacks expuestos. Sin reescribirlos.

---

## 10. RLS y queries necesarias

### 10.1 "Puntos por usuario en liga local"

- ❌ **NO existe vista SQL ni RPC.** Cálculo **client-side** en `scoring.js`.
- Funciones disponibles:
  - `calcMatchPoints(pred, realL, realR, matchKey)` — scoring.js:51
  - `calcKOMatchPoints(pred, realL, realR, round)` — scoring.js:92
  - `calcGroupsAdvancePoints(...)` — scoring.js:118
  - `calcAwardPoints(...)` — scoring.js:128
  - `calcClassificationPoints(...)` — scoring.js:142
  - `calcTotalUserPoints(...)` — scoring.js:157
- **Para Predictor:** F7.7 puede iterar las predictions ya cargadas en cliente y agregar por usuario. No requiere SQL nuevo para liga local.

### 10.2 "Puntos global cross-league"

- ❌ **NO existe.** Spec A5 §B3+B6: SQL nuevo o cálculo client-side iterando `predictions/ko_predictions/award_picks` sin filtro `league_id`.
- **Decisión recomendada A5:** crear **vista SQL** `v_user_points_global` (suma absoluta por usuario, sin agregación entre ligas porque el bundle aclara §1.2 que un mismo user tiene los mismos pronósticos en todas sus ligas → puntos absolutos únicos). Más barato que iterar en cliente con N usuarios crecientes.

### 10.3 Snapshot diario para `↑Δ` global

- ❌ **NO existe** tabla ni cron job para snapshot de ranking global.
- ✅ Existe pg_cron infra (Fase E IA crea cron nocturno cleanup IA en `20260421_fase_e_ia_snapshots.sql:82–96`).
- **A crear en F7.7:** tabla `user_global_rank_snapshots(user_id, snapshot_date, position, total_pts)` + pg_cron diario 04:00 UTC. Si no hay snapshot previo (pre-11jun): ocultar el `↑Δ` (spec).

---

## 11. Edge Function `porra-ia-compute` (estado v10)

- **Path:** `supabase/functions/porra-ia-compute/index.ts`.
- **LOC:** 1112.
- **Actions actuales** (líneas 157–189):
  - `status` — counts + last scraped por tabla IA.
  - `scrape_elo` — scraper Wikipedia ELO FIFA.
  - `scrape_h2h` — scraper 11v11.com/stats.
  - `scrape_last5` — últimos 5 resultados por equipo (11v11.com).
  - `freeze_snapshot` — congela snapshot pre-torneo + crea `ia_snapshots`.
  - `compute_groups` — predicciones 72 partidos grupos.
  - `compute_match` — predicción KO **on-demand**, rate-limited por user.
- **❌ NO cubre:** KO completo (32 partidos en bloque), premios individuales (balón/bota/guante/mejor joven), boost por jornada.
- **Extensión F7.7-IA (v11):** añadir `compute_ko_full`, `compute_awards`, `compute_boost_per_round`. Mantiene compatibilidad — solo añade actions, no toca las existentes (regla NO TOCAR §8).

---

## 12. Schema BD — tablas implicadas

| Tabla | Migración en repo | Notas |
|---|---|---|
| `live_scores` | `docs/db-schema.md` (sin migración SQL en repo) | match_key PK, status, score, is_historic, JSONB events/lineups |
| `ia_predictions` | `20260421_create_ia_predictor_tables.sql:41` + `20260421_fase_e_ia_snapshots.sql:40-48` | match_id PK, sign, confidence, breakdown JSONB, used_fallback, snapshot_id FK |
| `ia_snapshots` | `20260421_fase_e_ia_snapshots.sql:15-24` | id SERIAL PK, snapshot_date, label, is_active UNIQUE INDEX |
| `predictions` | ⚠️ NO en migraciones del repo | Schema inferido desde `scoring.js`: user_id, match_id, score_home, score_away, scorer, saved, pts |
| `ko_predictions` | ⚠️ NO en migraciones del repo | Inferido: user_id, match_id, score_home, score_away, classifier, pts |
| `award_picks` | ⚠️ NO en migraciones del repo | Inferido: user_id, balon_oro, bota_oro, guante_oro, mejor_joven |
| `boost_picks` | ⚠️ NO en migraciones del repo | Inferido: user_id, league_id, match_date, match_id |
| `league_members` | ⚠️ NO en migraciones del repo | Inferido: league_id, user_id, porra_cerrada |
| `profiles` | ⚠️ NO en migraciones del repo | Inferido: id (auth.uid), nombre, is_admin, created_at |

**Riesgo crítico:** las 6 tablas marcadas ⚠️ **no tienen migración versionada** en el repo. Existen en Supabase Cloud (la app funciona) pero fueron creadas en sesión anterior sin commit del SQL. Para F7.7-IA (que añade columna `is_bot` a `profiles` + trigger en `leagues`), la migración deberá ser idempotente (`ADD COLUMN IF NOT EXISTS`, `CREATE TRIGGER IF NOT EXISTS`) y **antes de ejecutar SQL**, San debe confirmar el schema vivo vía Supabase MCP/dashboard (`information_schema.columns`).

---

## 13. Side-effects detectados

Archivos que tocan o referencian `#page-predictor` actualmente y deben revisarse antes de modificar:

- `index.html:631-636` — el stub.
- `js/main-entry.js` — chain de loadScript (asegurar que carga `ui-pred-shell.js` cuando se cree).
- `public/js/ui-nav.js` — `showPage('predictor')` (verificar que no aplica lógica especial; F7.X confirma que es genérico).
- `public/js/components/bottom-tab.js` — tab `predictor` (verificar `_tabDefs` ya incluye `'predictor'` post-F7.4-D-1).
- `js/main-entry.js` — `VALID_PAGES` y splash skip arrays (post-F7.4-D-1 ya incluyen `'predictor'`).
- `public/js/auth.js` — `loadIAPredictions()` ya carga lo necesario; sin cambios.
- `public/js/leagues.js` — `leagueSelect()` debería disparar el rerender de Predictor; añadir hook si no lo hace ya.

**Sin colisiones esperadas con F7.X (page-elim).**

---

## 14. Riesgos identificados

1. **[ALTA prob, ALTO impacto] Migraciones BD ausentes**
   `predictions / ko_predictions / award_picks / boost_picks / league_members / profiles` no están en `supabase/migrations/`. F7.7-IA modifica `profiles` (añadir `is_bot`) y `leagues` (añadir trigger). Mitigación: antes de C1, dump del schema vivo vía Supabase MCP (`list_tables` + `information_schema.columns`) y commit de migraciones idempotentes que reflejen el estado real. NO ejecutar `ALTER TABLE` ciego.

2. **[MEDIA prob, MEDIO impacto] Componente goleador inline duplicado**
   Hoy vive como string HTML inline en 2 sitios (`scoring.js`, `ui-nav.js`). F7.7 añade un 3º callsite en `ui-pred-shell.js`. Decisión recomendada: NO extraer a helper (regla anti-abstracción prematura). Si tras B4 el código se ve incómodo, refactor en mini-PR posterior fuera de F7.7.

3. **[BAJA prob, ALTO impacto] Bundle EF v11 supera 70 KB (ERR-29)**
   `porra-ia-compute v10` tiene 1112 LOC. Añadir KO completo + awards + boost puede empujar a 1500+ LOC. Si el deploy MCP falla por payload, fallback al CLI local: `npx supabase functions deploy porra-ia-compute` (regla `.claude/rules/edge-functions.md`).

4. **[BAJA prob, MEDIO impacto] Snapshot diario ranking global en pre-Mundial**
   El cron debe arrancar ANTES del 11 jun para tener al menos 1 día de histórico al cierre porra. Si se programa mal o se olvida activar, el chip `↑Δ` queda oculto las primeras 24h del Mundial. Mitigación: documentar en `migration-log.md` la fecha exacta de activación + verificación.

5. **[MEDIA prob, BAJO impacto] LOC `ui-pred-shell.js` puede superar el de F7.X**
   F7.X cerró en 545 LOC para `ui-elim-shell.js`. Predictor añade 3 estados de PredictionTile + StatsStrip + FilterChips + PredictionCard con 3 estados + ScoreStepper + Trophy modal. Estimación realista: 700–800 LOC. Si supera 1000, partir en `ui-pred-shell.js` + `ui-pred-card.js` en B4.
