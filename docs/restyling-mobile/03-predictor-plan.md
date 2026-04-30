# Predictor — Plan PRs (A5)

**Generado:** 30 abr 2026
**Tras:** A1 inventario 30 abr 2026 (`03-predictor-inventory.md`)
**Bundle de referencia:** `03-predictor-design-source.md` (decisiones cerradas con San)
**Estructura referencia:** F7.X (B1–B6 visual + C1–C5 IA, ~1240 LOC total)

---

## Premisa

F7.7 se descompone en 2 sub-fases con PRs independientes:

- **F7.7-VIS:** rediseño visual Predictor (B1..B6).
- **F7.7-IA:** IA como jugador real (C1..C6).

Pueden trabajarse en paralelo respetando NO TOCAR (§8 del bundle). VIS no depende de IA hasta el último PR de cada lado (cuando se conectan los chips "vs IA" y la integración del miembro IA en scoreboard).

Cada PR es **auto-contenido**, **≤200 LOC ideal** (con margen hasta ~280 cuando un componente lo justifica), validado con `node --check` + `npm run build` + smoke localhost antes de merge.

---

## F7.7-VIS — Rediseño visual

| PR | Título | Scope | Archivos | LOC est. | Bloqueante para |
|----|---|---|---|---|---|
| **B1** | F7.7-VIS-1: tokens + shell HTML + sustitución stub | Append `--font-display/text/numeric` + `--fifa-gold-bg-from/to` a `elim-tokens.css`. Sustituir el stub `#page-predictor` (líneas 631-636 actuales) por mounts vacíos `#fc-pred-header`, `#fc-pred-tile`, `#fc-pred-stats`, `#fc-pred-filters`, `#fc-pred-list`. Crear `predictor-shell.css` vacío con sección de imports. Wiring inicial en `main-entry.js` para cargar `predictor-shell.css`. | `public/css/components/elim-tokens.css` (+10), `public/css/components/predictor-shell.css` (NEW, +20), `index.html` (-5/+8), `js/main-entry.js` (+2) | **~50 LOC** | B2..B6 |
| **B2** | F7.7-VIS-2: PredictionTile (3 estados) + sistema rangos | Crear `predictor-ranks.js` con `getRank(pts) → {idx, name, phrase, threshold_next, pts_to_next}` (10 niveles tabla §1.1). Crear `ui-pred-shell.js` con `mountPredShell()` + `renderTile(state)` cubriendo `pre-mundial` / `active` / `finalizado` (§3.2 y §1.5 del bundle). CSS de tile dorado (gradient, watermark trofeo, footer rojo, breakpoints). | `public/js/predictor-ranks.js` (NEW, +60), `public/js/ui-pred-shell.js` (NEW, +180), `public/css/components/predictor-shell.css` (+120) | **~360 LOC** | B6 |
| **B3** | F7.7-VIS-3: Header + StatsStrip + FilterChips | Add `renderHeader()` (eyebrow + trophy btn + H1 + subtitle dinámico §3.1), `renderStats()` (3 columnas con `% Aciertos` + `Racha` + `Bonus IA` §3.3), `renderFilters()` (chips horizontal scroll §3.4). Helpers privados en `ui-pred-shell.js`: `computeAciertos()`, `computeStreak()` (NUEVO en `scoring.js` o helper local). Estado pre-Mundial: stats `—`, filters reemplazados por quick-link `Tu porra · N/72 →`. | `public/js/ui-pred-shell.js` (+150), `public/css/components/predictor-shell.css` (+90), `public/js/scoring.js` (+25 — solo `computeStreak()` puro, no toca motor existente) | **~265 LOC** | B6 |
| **B4** | F7.7-VIS-4: PredictionCard + ScoreStepper | `renderList()` agrupado por eyebrow (HOY · CIERRA EN / MAÑANA / RESUELTAS). `renderCard()` con 3 estados (`open` / `locked` / `resolved`) y status chips por estado. ScoreStepper con `data-team`/`data-action`. Goleador inline con `<select>` (mismo patrón scoring.js:603-639, sin extraer). Indicador IA chip ("Coincides con la IA" / "Vas contra la IA · +1 si aciertas"). Scoring breakdown con valores reales `Signo: +1 · Exacto: +3 · Goleador: +2 · vs IA: +1`. Tooltip por item. | `public/js/ui-pred-shell.js` (+220), `public/css/components/predictor-shell.css` (+130) | **~350 LOC** | B6 |
| **B5** | F7.7-VIS-5: Trophy modal | Reusar `#modal` existente (`index.html:658-663`) con `openModal()` (`ui-nav.js:56`). Renderer dedicado `renderTrophyModal()` que pinta los 4 premios (Balón / Bota / Guante / Mejor Joven) leyendo `award_picks` actual del usuario. Si porra abierta: botón "Cambiar" por premio reusando flow existente; si cerrada: solo lectura. Sin nuevo modal HTML. | `public/js/ui-pred-shell.js` (+80), `public/css/components/predictor-shell.css` (+30) | **~110 LOC** | — |
| **B6** | F7.7-VIS-6: Wiring + sincronización | `main-entry.js` carga `predictor-ranks.js` + `ui-pred-shell.js` en chain. `ui-nav.js::showPage('predictor')` invoca `mountPredShell()`. Suscripción a 3 hooks (`leagueSelect()` desde `leagues.js`, callback `liveSyncInit()`, `checkFinalizarReady()`). Smoke end-to-end: estado pre-Mundial visible (estamos en abr2026), tile dorado, stats `—`, quick-link a porra. **Verificación CSS post-build (ERR-22):** `npm run build && grep -l "fc-pred-header" dist/css/*.css`. | `js/main-entry.js` (+5), `public/js/ui-nav.js` (+10), `public/js/components/bottom-tab.js` (+5), `public/js/leagues.js` (+5 hook) | **~25 LOC** | — |

**Subtotal F7.7-VIS:** ~1160 LOC en 6 PRs.

### Dependencias visuales

```
B1 (tokens + mounts vacíos)
  ├─→ B2 (Tile + getRank)        ─┐
  ├─→ B3 (Header + Stats + Chips) ─┼─→ B6 (wiring + smoke)
  ├─→ B4 (Card + Stepper)         ─┤
  └─→ B5 (Trophy modal)           ─┘
```

B2/B3/B4/B5 son **paralelizables** (split por componente, patrón Haiku 4.5 paralelo §7 multi-agent-sync.md). El padre integra outputs en oleadas de 2 (B2+B3 oleada 1; B4+B5 oleada 2) para no saturar contexto al consolidar.

---

## F7.7-IA — IA como jugador real

| PR | Título | Scope | Archivos | LOC est. | Bloqueante para |
|----|---|---|---|---|---|
| **C1** | F7.7-IA-1: schema `is_bot` + seed `ia_user_id` + auto-membership | Migración idempotente: `ALTER TABLE profiles ADD COLUMN IF NOT EXISTS is_bot BOOLEAN DEFAULT false NOT NULL`. INSERT seed `INSERT INTO profiles (id, nombre, is_bot) VALUES ('<UUID_FIJO>', 'IA Predictor', true) ON CONFLICT (id) DO NOTHING`. Trigger `after_league_insert`: añade automáticamente `ia_user_id` a `league_members` con `porra_cerrada = true`. Backfill ligas existentes vía INSERT idempotente. **PRE-CHECK obligatorio** (San via Supabase MCP): confirmar schema vivo de `profiles`, `leagues`, `league_members` antes de aplicar. | `supabase/migrations/2026MMDDhhmmss_predictor_ia_jugador_schema.sql` (NEW, +60) | **~60 LOC SQL** | C2..C6 |
| **C2** | F7.7-IA-2: extender `porra-ia-compute` v11 — `compute_ko_full` | Añadir action que simula los 32 partidos KO completos. Para cada round: simular probabilidades de avance ELO+H2H+form+host, tomar argmax como ganador, score más probable como pronóstico. NO toca actions existentes (regla NO TOCAR). Validar paridad simulando 1 KO de prueba. | `supabase/functions/porra-ia-compute/index.ts` (+180) | **~180 LOC** | C4, C6 |
| **C3** | F7.7-IA-3: extender `porra-ia-compute` v11 — `compute_awards` + `compute_boost_per_round` | Añadir 2 actions más: (a) premios individuales (Balón/Bota/Guante/Mejor Joven §6.3) con heurística sobre `goals_per_match × matches_expected`. (b) boost por jornada eligiendo argmax `pts_esperados(match)` (§6.4 fórmula). Insertar 17+6 boosts (grupos+KO). | `supabase/functions/porra-ia-compute/index.ts` (+150) | **~150 LOC** | C4, C6 |
| **C4** | F7.7-IA-4: panel admin "Lanzar IA" + insert masivo | Botón admin (en `admin.js`, no en EF nueva) que: (1) llama `compute_groups` + `compute_ko_full` + `compute_awards` + `compute_boost_per_round`. (2) lee outputs y hace INSERT masivo en `predictions` (72) + `ko_predictions` (32) + `award_picks` (1) + `boost_picks` (23) con `user_id = ia_user_id`. Idempotente con `ON CONFLICT DO NOTHING`. Modal de confirmación con preview de 5-10 pronósticos al azar (gate humano §C). | `public/js/admin.js` (+100), `public/js/ui-admin-ia-launch.js` (NEW, +60) | **~160 LOC** | C5 |
| **C5** | F7.7-IA-5: visualización IA en scoreboard + chip "Bot oficial" | En el scoreboard actual (cualquier vista que lista miembros de liga), detectar `is_bot=true` y renderizar avatar 🤖 + chip "IA Predictor · Bot oficial". Decisión sobre nombre + avatar pendiente con San (sub-decisiones, ver final). | `public/js/leagues.js` o `public/js/scoreboard.js` según donde viva el render (Code identifica antes de B1) (+50), `public/css/components/predictor-shell.css` (+10) | **~60 LOC** | — |
| **C6** | F7.7-IA-6: enriquecer Predictor con métricas vs IA | Stats strip Col 3 "Bonus IA ⚡" sublabel `+12 vs IA` (diferencia de puntos absolutos del usuario menos puntos IA en la liga visualizada). Tile dorado chip secundario opcional `vs IA: +12 pts`. Requiere C5 + B6 mergeados. | `public/js/ui-pred-shell.js` (+40) | **~40 LOC** | — |

**Subtotal F7.7-IA:** ~650 LOC en 6 PRs.

### Dependencias IA

```
C1 (schema + seed + trigger)
  ├─→ C2 (compute_ko_full) ─┐
  ├─→ C3 (compute_awards + boost) ─┤
  └─                                  ├─→ C4 (admin launcher) ─→ C5 (scoreboard) ─→ C6 (chips Predictor)
```

C2 y C3 paralelizables tras C1. C4 espera ambos. C5 espera C4. C6 espera C5 + B6.

---

## Cross-fase: punto de unión VIS ↔ IA

- **B6** valida shell visual sin IA — el chip "Vas contra la IA" funciona desde el día 1 si `ia_predictions` está poblada (ya lo está, EF v10 cerró 72 grupos).
- **C6** es el único PR que cruza fases: requiere que `ui-pred-shell.js` (B3 + B4) + scoreboard (C5) + EF (C2/C3) estén todos vivos.

---

## Gates humanos

- ✅ **Tras A5 (este doc):** San revisa, aprueba o ajusta antes de B1.
- ⚠️ **Antes de C1 (schema migration):** San dump del schema vivo de `profiles`/`leagues`/`league_members` vía Supabase MCP y commit de las migraciones reales. NO ejecutar SQL ciego.
- ⚠️ **Tras B6:** validación visual end-to-end por San (smoke localhost en estado pre-Mundial) antes de mergear toda F7.7-VIS.
- ⚠️ **Antes de C4 (insert masivo IA):** San valida 5-10 pronósticos al azar de C2+C3 antes de insertar las 128 filas (regla "no datos en producción sin gate humano").
- ⚠️ **Antes de cierre porras 11 jun:** ejecutar C4 (lanzamiento real IA). NO antes (los pronósticos IA deben generarse con los datos 11v11.com más actualizados, post-amistosos).

---

## Total estimado

| Sub-fase | PRs | LOC | Sesiones esperadas |
|---|---|---|---|
| F7.7-VIS | 6 | ~1160 | 2-3 |
| F7.7-IA | 6 | ~650 | 2 |
| **Total F7.7** | **12** | **~1810** | **4-5** |

> **Nota:** estimación supera ~1240 LOC de F7.X (referencia inicial). El delta viene de: (a) 3 estados de PredictionTile vs 1 en F7.X header, (b) 3 estados de PredictionCard vs 1 en ElimRow, (c) sub-fase IA al completo (extender EF + admin launcher + scoreboard + métricas). Si LOC reales empujan B2/B4 sobre 280, considerar split en mini-PR adicional.

---

## Riesgos (refinados desde A1)

1. **[ALTA / ALTO] Migraciones BD ausentes para `profiles`/`leagues`/`league_members`.** C1 requiere pre-check Supabase MCP por San. Si el schema real difiere del inferido, ajustar la migración antes de aplicar. Mitigación: dump vía `list_tables` + `information_schema.columns` documentado en `migration-log.md`.

2. **[BAJA / ALTO] EF v11 supera 70 KB tras añadir KO + awards + boost (ERR-29).** v10 ya tiene 1112 LOC. v11 estimada 1450+ LOC. Si MCP `deploy_edge_function` falla, fallback a `npx supabase functions deploy porra-ia-compute` desde CLI local de San.

3. **[BAJA / MEDIO] Snapshot diario ranking global olvidado pre-Mundial.** Cron debe activarse antes del 10 jun para tener histórico al cierre porra. Documentar en `migration-log.md` la fecha exacta de activación. Mitigación: incluir el cron en C1 (mismo PR del schema), no como mini-PR aparte.

4. **[MEDIA / BAJO] Componente goleador inline duplicado.** B4 añade 3º callsite del patrón inline. Decisión: NO extraer (anti-abstracción prematura). Refactor opcional fuera de F7.7 si tras B4 incomoda.

5. **[MEDIA / BAJO] LOC `ui-pred-shell.js` puede superar el de F7.X.** Estimación 700-800 LOC. Si supera 1000, partir en B4-bis: `ui-pred-shell.js` + `ui-pred-card.js`.

6. **[BAJA / MEDIO] Bundle Vite +KB tras añadir Predictor completo.** Bundle actual ~188 KB (post-F7.X). Estimación post-F7.7: ~210 KB. Si supera 250 KB, evaluar code-splitting de `ui-pred-shell.js` con dynamic import (mismo patrón que el Top-3 pendiente "code splitting admin.js" — ahora reemplazado por F7.7 en el Top-3).

---

## Sub-decisiones pendientes (no bloqueantes para arquitectura)

Documentadas para que San las cierre en cualquier momento del flujo, idealmente antes de C5:

1. **Apariencia IA (§6.5 bundle)** — pendiente:
   - **Nombre:** "IA Predictor" (default) / "Botín del Mundial" / "Oráculo IA" / otro.
   - **Avatar:** 🤖 emoji simple (default) / SVG custom robot / robot estilizado FIFA / etc.
   - **Chip diferenciador:** "Bot oficial" (default) / "IA · No-humano" / etc.
   - **Recomendación Code:** "IA Predictor" + 🤖 emoji + "Bot oficial" — minimal, sin assets nuevos, coherente con el feature único de la app. Cambiable en C5 sin migración.

2. **Helper `getMatchesPendingForUser()`** — A1 no detectó si existe ya; B2 (Tile pre-mundial) y B3 (filter chips) lo necesitan para "60/72 pronósticos" + "12 partidos por pronosticar". Code identifica en B2 si hay que extraerlo (probablemente desde `data.js`) o crearlo nuevo.

3. **Vista SQL `v_user_points_global` vs cálculo client-side** — para el chip Global. A1 recomienda vista SQL para escalar. Si San prefiere cliente (más fácil de iterar visualmente), refactor posible sin cambiar UI. Decisión idealmente antes de B3.

4. **Dónde vive el render de scoreboard** (C5) — A1 detectó `leagues.js` pero el listing de miembros puede vivir en otro fichero. Code confirma antes de C5.

5. **`predictor-tokens.css` separado vs append a `elim-tokens.css`** — Bundle dice "decisión Code". Recomendación: append a `elim-tokens.css` mientras quepa (~20 LOC nuevas, total <80 LOC). Si rebasa, extraer en F7.8 o futuro.

6. **Cron snapshot ranking: incluir en C1 o mini-PR aparte** — Recomendación A5: en C1 (mismo schema migration). Si San prefiere separar, mini-PR `C1-bis` antes de B6.

---

**FIN DEL PLAN.** Esperando gate humano de San tras revisar este documento + A1.
