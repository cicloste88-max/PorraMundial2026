# Predictor — Design Source v1

**Fase:** F7.7 (rediseño visual Predictor) + F7.7-IA (IA como jugador real)
**Branch:** `docs/predictor-design-source-v1` (este fichero)
**Generado:** 30 abr 2026 por Claude.ai tras decisiones cerradas con San
**Patrón:** equivalente a `docs/quiniela-design-source-v2` (commit `fd95d08`, F7.X)

---

## 0 · Cómo usar este bundle (Claude Code)

Este documento es **fuente única de verdad** para F7.7 y F7.7-IA. Inmutable durante toda la fase salvo edición explícita por San.

**Flujo:**
1. Leer este bundle de principio a fin.
2. Ejecutar **A1 — Inventario** (§9). Output: `docs/restyling-mobile/03-predictor-inventory.md`.
3. Ejecutar **A5 — Plan PRs** (§10). Output: `docs/restyling-mobile/03-predictor-plan.md`.
4. **Gate humano:** San revisa A5. NO implementar antes de su OK.
5. Tras OK, ejecutar mini-PRs según A5 (uno por componente, igual que F7.X).

**Reglas duras durante la fase:**
- Cada PR = una pieza autónoma.
- Push inmediato tras cada commit (regla `multi-agent-sync`).
- Verificación CSS post-build obligatoria (ERR-22).
- NO tocar lo listado en §8 NO TOCAR.
- Subagentes Haiku con Write **no heredan** `.claude/rules/` (E13). Pasar contexto inline.

---

## 1 · Decisiones cerradas

### 1.1 Sistema de rangos (10 niveles, lineales, no-repetibles)

Reemplaza el placeholder "NIVEL 12" del mockup. El rango se calcula a partir de **puntos totales del usuario en la liga visualizada**.

| # | Rango | Threshold (pts) | Frase complementaria |
|---|---|---|---|
| 1 | Chupetín | 0–99 | No has visto un balón de futbol en tu vida, Hulio |
| 2 | Sotanita | 100–199 | Tus pronósticos están para no verlos… |
| 3 | Pipero | 200–324 | Grefusito es tu compañero de grada |
| 4 | Cuchara de madera | 325–449 | Ni pinchas ni cortas |
| 5 | Forofo | 450–849 | Te sabes el 11 titular de Marruecos |
| 6 | Crack | 850–1399 | El grupo te pide consejo antes de pronosticar |
| 7 | Profeta | 1400–2099 | Florentino tiene una servilleta preparada para ti… |
| 8 | Oráculo | 2100–2999 | La IA te tiene miedo |
| 9 | Sabio del VAR | 3000–3999 | Ves los goles antes de que pasen |
| 10 | Maestro Mundialista | 4000+ | El Mundial se escribe con tu nombre |

**Implementación esperada:** función pura `getRank(pts) → { idx, name, phrase, threshold_next }` en `public/js/scoring.js` o nuevo `public/js/predictor-ranks.js`. Devuelve también `pts_to_next` para barra de progreso visual (opcional).

### 1.2 Sistema de ranking (liga local + global)

| Sitio | Contenido |
|---|---|
| **Tile dorado, esquina sup-derecha (línea 1)** | `Liga · #N / total` (donde N = posición del usuario en la liga **que está visualizando**, total = miembros activos de esa liga) |
| **Tile dorado, esquina sup-derecha (línea 2, chip pequeño)** | `Global #M ↑Δ` (donde M = posición del usuario en el ranking cross-league por puntos absolutos del usuario) |
| **Tap en chip "Global"** | Modal con top 50 del ranking global (avatar + nombre + pts + posición) |

**Modelo BD:**
- Liga local: query existente sobre `predictions + ko_predictions + award_picks` filtrada por `league_id`.
- Global cross-league: como **un mismo usuario tiene los mismos pronósticos en todas sus ligas**, sus puntos absolutos son únicos. Query: `SELECT user_id, SUM(pts) AS total FROM <vista_pts> GROUP BY user_id ORDER BY total DESC`. NO hay agregación entre ligas (cada usuario aparece una vez).
- `↑Δ`: diferencia respecto a la posición global de hace 24h. Requiere snapshot diario (puede usar `pg_cron` que ya existe). Si no hay snapshot previo (primer día Mundial), ocultar el delta.

### 1.3 Métricas del usuario

#### 1.3.a `% Aciertos` (porcentaje "absoluto")

`% = (pts_obtenidos / pts_max_dinámico) × 100`

`pts_max_dinámico` se calcula sumando, partido a partido del usuario:
- Si pronóstico = pronóstico IA → `5 pts max` (3 exacto + 2 goleador). El `+1 signo` y `+1 bonus IA` no aplican porque (a) signo no acumula con exacto, (b) bonus IA requiere ir contra IA.
- Si pronóstico ≠ pronóstico IA → `6 pts max` (3 exacto + 2 goleador + 1 bonus IA).

**Nota motor:** `+1 signo` NUNCA acumula con `+3 exacto`. Si aciertas exacto, sumas 3 (que ya incluye el signo). El +1 solo se da cuando aciertas signo pero no resultado exacto. Por eso `pts_max_por_partido` siempre es 5 ó 6 (depende de si vas con/contra IA).

**Estados especiales:**
- Antes del 11 jun (no hay partidos jugados aún): mostrar `—` en lugar de `0%`.
- Partidos no pronosticados (porra cerrada con huecos): cuentan como 0/max → bajan el %.

#### 1.3.b `Racha` (streak)

Contador de **signos correctos consecutivos** (incluye empate). Se rompe al fallar UN signo. Acertar exacto cuenta como signo correcto. Goleador y bonus IA NO afectan a la racha.

**Tooltip/sublabel:** "Signos correctos consecutivos."

**Estados especiales:**
- Antes del 11 jun: `—`.
- Si el usuario nunca acertó un signo: `0`.

### 1.4 Stats strip (3 columnas debajo del tile dorado)

| Columna | Métrica | Color/icon |
|---|---|---|
| 1 | `% Aciertos` (§1.3.a) | `--win` verde si ≥60%, `--ink-900` si <60% |
| 2 | `Racha` 🔥 con icono `flame` | `--fifa-red` |
| 3 | `Bonus IA` ⚡ acumulado | `--fifa-blue` |

**Bonus IA acumulado** = suma de los `+1 pts` que el usuario ha ganado por pronosticar contra IA y acertar el signo. Este número da identidad propia al feature único de tu app y es el "marcador" del duelo humano vs IA visible para el usuario.

### 1.5 Estado pre-Mundial (1 jun → 10 jun, antes de cierre porras)

Tile dorado **mutado** en `state="pre-mundial"`:

```
┌───────────────────────────────────────────────────┐
│ PREDICTOR · LISTO PARA EL MUNDIAL                 │
│                                                    │
│ 🏆 Faltan 41 días        Pronósticos              │
│                          60/72  ●●●●●●○○          │
├───────────────────────────────────────────────────┤
│ 🔥 Te quedan 12 partidos por pronosticar       >  │
└───────────────────────────────────────────────────┘
```

- "Faltan N días": calculado contra `2026-06-11T20:00:00Z`. Si está dentro del último día, mostrar "Mañana arranca" en lugar del número.
- "Pronósticos N/72": número de partidos de fase de grupos pronosticados (de los 72 totales). Barra ●● segmentada en 8 huecos visuales.
- Footer rojo: nº de partidos pendientes + chevron tap → ruta a `page-grupos` (o a `page-elim` si los grupos están al 100% pero KO/awards faltan).

Stats strip durante pre-Mundial: las 3 métricas (Aciertos / Racha / Bonus IA) muestran `—` con tooltip "Disponible cuando arranque el Mundial".

Filter chips durante pre-Mundial: ocultar (no hay nada que filtrar). Mostrar lista única "Tu porra · 60/72" como atajo a las pantallas correspondientes.

### 1.6 Botón trophy (header, arriba-derecha)

Tap → modal con los 4 premios individuales del usuario:

| Premio | Lectura BD | Comportamiento |
|---|---|---|
| Balón de Oro | `award_picks.balon_oro` | Avatar jugador + nombre + equipo |
| Bota de Oro | `award_picks.bota_oro` | Idem (auto-completable desde goleadores pronosticados — ver `CLAUDE.md` Top-3) |
| Guante de Oro | `award_picks.guante_oro` | Idem |
| Mejor Joven (≤21) | `award_picks.mejor_joven` | Idem |

**Si porra abierta:** botón "Cambiar" por premio → reusar el flow de `award_picks` ya existente.
**Si porra cerrada:** modo solo lectura.

**Reuso modal:** identificar en A1 cuál de los modales existentes es el "modal estándar" (probablemente `#modal` en `index.html` con `closeModal()`/`closeModalBtn()`) y reusarlo. Adaptar tamaño solo si fuera necesario; respetar diseño/animación existentes.

---

## 2 · Tokens visuales

### 2.1 Heredados de F7.X (mantener exactos)

```css
/* Brand */
--fifa-red: #E30613;
--fifa-green: #006341;
--fifa-blue: #0A4595;
--fifa-gold: #C9A961;

/* Neutrals (escala 9) */
--ink-900..50: #0A0E1A → #F8F9FB
--bg: #FFFFFF;

/* Type */
--font-display: "Saira", "SF Pro Display", -apple-system, system-ui, sans-serif;
--font-text: "Inter", -apple-system, system-ui, sans-serif;
--font-numeric: "Saira", "SF Mono", ui-monospace, monospace;
```

### 2.2 Nuevos para Predictor (añadir a `elim-tokens.css` o crear `predictor-tokens.css`)

```css
/* Brand extra */
--fifa-gold-deep: #9A7B3A;     /* Tile dorado borde + watermark trofeo */
--fifa-gold-bg-from: #FFF8E1;  /* Gradiente tile inicio */
--fifa-gold-bg-to:   #FFEDB3;  /* Gradiente tile fin */

/* Semantic adicionales */
--win:  #00834A;   /* Acierto exacto, %≥60, posición clasificación */
--draw: #B7860B;   /* Estado neutro, empates */
--loss: #6F1E22;   /* Fallo (placeholder) */
```

### 2.3 No usar

- `--font-fifa` (FWC 26 .otf) — no necesario en Predictor.
- Emojis bandera del DS (`FLAGS={MEX:'🇲🇽',...}`) — usar patrón existente (§5.2).

---

## 3 · Spec de componentes

Todos los componentes son vanilla JS/CSS (no React). Nombres propuestos para selectores: prefijo `fc-pred-` consistente con `fc-elim-` de F7.X.

### 3.1 Header `#fc-pred-header`

```html
<header class="fc-pred-header">
  <div class="fc-pred-eyebrow-row">
    <span class="fc-eyebrow">PREDICTOR</span>
    <button class="fc-pred-trophy-btn" aria-label="Mis premios individuales">
      <svg><!-- trophy icon, size 18, stroke ink-700 --></svg>
    </button>
  </div>
  <h1 class="fc-pred-title">Tus predicciones</h1>
  <p class="fc-pred-subtitle"><!-- contexto dinámico, ver abajo --></p>
</header>
```

**Subtitle dinámico:**
- Pre-Mundial: `"Cierre porra: 10 jun · 23:59"`
- Durante grupos: `"Jornada N · Fase de grupos"` (N = jornada actual según fecha)
- Durante KO: `"Octavos"` / `"Cuartos"` / `"Semifinales"` / `"Final"`
- Post-Mundial: `"Mundial finalizado"`

**Estilo H1:** `font-family: var(--font-display); font-size: 30px; font-weight: 800; letter-spacing: -0.02em; color: var(--ink-900); margin: 0 0 4px;`

### 3.2 PredictionTile (tile dorado)

3 estados controlados por atributo `data-state`:

#### 3.2.a `data-state="pre-mundial"`
Ver §1.5. Layout 2 columnas: izquierda countdown, derecha progreso porra. Footer rojo con CTA.

#### 3.2.b `data-state="active"` (default durante torneo)

```
┌─────────────────────────────────────────────────────┐
│ PREDICTOR · {RANGO}              Liga: #N / total   │ ← Línea 1
│ {pts} pts                        Global #M ↑Δ       │ ← Línea 2 (val grande L, chip R)
│ "{frase rango}"                                     │ ← Línea 3 (italic, ink-700)
│ ─────────────────────────────────────────────────── │
│ 🔥 N predicciones pendientes para hoy            >  │ ← Footer
└─────────────────────────────────────────────────────┘
```

- Watermark trofeo opacity 0.18, color `--fifa-gold-deep`, esquina superior derecha.
- Borde 1px `rgba(201,169,97,0.3)`, gradiente lineal 135deg `--fifa-gold-bg-from → --fifa-gold-bg-to`.
- Footer rojo separado por `border-top: 1px solid rgba(201,169,97,0.3)`. Tap → ruta a primer partido pendiente del día.

#### 3.2.c `data-state="finalizado"` (post-Mundial)

Variante de `active` con:
- Texto "PREDICTOR · MUNDIAL FINALIZADO" en eyebrow.
- Sin footer rojo (no hay partidos pendientes).
- Resaltar posición final liga + chip "Tu rango: {RANGO}".

### 3.3 StatsStrip `#fc-pred-stats`

3 columnas equiespaciadas, separadas por gaps de 1px sobre fondo `--ink-200`. Border-radius 14px. Cada columna: label uppercase eyebrow + valor grande `--font-display` 22/800.

Si pre-Mundial: cada valor = `—` con sublabel "Disponible 11 jun".

### 3.4 FilterChips `#fc-pred-filters`

Scroll horizontal, gap 8, `overflow-x: auto; scrollbar-width: none;`.

Chips:
- `Por jugar` (default activo): muestra partidos no-resueltos cuya porra aún no se ha cerrado para ese partido.
- `Hoy · N` (N dinámico): partidos del día actual pronosticables.
- `Esta sem.`: partidos en los próximos 7 días.
- `Resueltas`: partidos jugados con resultado, ordenados desc por fecha.

Estilo activo: `bg: --ink-900; color: #fff;` Inactivo: `bg: --ink-100; color: --ink-700;`. Padding 7×14, radius 999, font-display 12/600.

**Estado pre-Mundial:** ocultar todo el componente. Mostrar en su lugar `<a class="fc-pred-quick-link">Tu porra · 60/72  →</a>`.

### 3.5 PredictionCard `.fc-pred-card`

3 estados (`open`, `locked`, `resolved`). Layout base:

```
┌─────────────────────────────────────────────────────┐
│ {WHEN}                            [STATUS_CHIP]     │ ← Header
│                                                      │
│  {Badge home}  {Score / —}  {Badge away}            │ ← Cuerpo (3-col grid)
│                                                      │
│  [solo open: stepper rows + scoring breakdown]      │
└─────────────────────────────────────────────────────┘
```

**Header:**
- WHEN: eyebrow ej. "HOY · 20:00", "MAÑ 18:30", "DOM" (resuelto).
- STATUS_CHIP varía por estado:
  - `open` → `bg: #E8F1FF; color: --fifa-blue;` texto `Cierra · {closesIn}`
  - `locked` → `bg: --ink-100; color: --ink-500;` icono lock + `Bloqueada`
  - `resolved` correcto → `bg: rgba(0,131,74,0.1); color: --win;` `+{pts} pts`
  - `resolved` fallo → `bg: --ink-100; color: --ink-500;` `{pts} pts`

**Cuerpo:**
- Badge: ver §5.2 (badge-with-flag-fallback).
- Score:
  - `open`: muestra el pronóstico actual del usuario, valor `--font-display` 24/700, color `--ink-900` (o placeholder `—` si no pronosticado).
  - `locked`: `—` o último pronóstico congelado (porra cerrada).
  - `resolved`: muestra mi score, color `--win` si correcto exacto, `--ink-400` si fallo. Línea inferior pequeña `Real: {h}–{a}` (`fc-num`, fontWeight 600).

**Si correcto exacto** (resolved + correct): borde `1px solid rgba(0,131,74,0.3)` + barra superior 3px verde `--win`.

**Si `open`:**
- ScoreStepper home + ScoreStepper away dentro de wrapper `bg: --ink-50; radius: 12; padding: 10;`.
- Debajo, scoring breakdown en `font-size: 11px; color: --ink-500;`:
  - **Importante:** sustituir los literales del mockup `+50 / +30 / +10` por el motor real:
    `Signo: +1 · Exacto: +3 · Goleador: +2 · vs IA: +1`
  - Tap en cualquier item → tooltip explicativo (info icon discreto).

**Goleador (nuevo, no en mockup):** dropdown/buscador para seleccionar 1 jugador del equipo que el usuario cree que marcará. Reusar componente existente si ya hay uno en `data.js` / `ui-groups.js`. Si no existe en pure UI predictor (probable), usar el patrón ya definido en grupos.

**Indicador IA (nuevo, no en mockup):** chip pequeño justo encima del scoring breakdown:
- Si pronóstico_user = pronóstico_ia: `chip: "Coincides con la IA"; color: --ink-500;`
- Si pronóstico_user ≠ pronóstico_ia: `chip: "Vas contra la IA · +1 si aciertas"; color: --fifa-blue;`
- Si pronóstico vacío: ocultar chip.

### 3.6 ScoreStepper `.fc-pred-stepper`

Idéntico al mockup. Grid `auto 1fr auto auto auto` con flag · nombre · botón menos · valor numérico · botón más. Botones circulares 26×26, fondo `#fff`, borde `--ink-200`. Reusar lógica de + / − con `data-* attrs` (`data-team="home"`, `data-action="inc"`).

### 3.7 BottomTabs (no rediseñar)

Reusar componente existente `#bottom-tab` con `active="pred"`. Pestañas según convención del repo (`bottom-tab.js`).

---

## 4 · Composición de pantalla `#page-predictor`

```
┌──────────────────────────────┐
│ Header (sticky?)             │
├──────────────────────────────┤
│ PredictionTile               │
├──────────────────────────────┤
│ StatsStrip                   │
├──────────────────────────────┤
│ FilterChips                  │
├──────────────────────────────┤
│ HOY · CIERRA EN 4H 22M       │ ← eyebrow grupo 1
│ ┌ Card 1 (open) ─┐           │
│ ┌ Card 2 (open) ─┐           │
│ ┌ Card 3 (locked) ─┐         │
│                              │
│ MAÑANA                       │ ← eyebrow grupo 2 (si aplica)
│ ┌ Card 4 (locked) ─┐         │
│                              │
│ RESUELTAS                    │ ← eyebrow grupo 3 (si aplica)
│ ┌ Card 5 (resolved) ─┐       │
│ ┌ Card 6 (resolved) ─┐       │
├──────────────────────────────┤
│ BottomTabs (active=pred)     │
└──────────────────────────────┘
```

**Padding global:** 18px lateral (consistente F7.X). Padding superior 56px (safe-area iOS).

---

## 5 · Adaptación a la realidad de la app

### 5.1 Scoring (sustitución crítica)

| Mockup | Realidad |
|---|---|
| `Ganador exacto +50` | `Exacto: +3` |
| `Resultado +30` | (no existe, fusionado con exacto) |
| `1×2: +10` | `Signo: +1` |
| (no aparece) | `Goleador: +2` |
| (no aparece) | `vs IA: +1` (si pronóstico contra IA y aciertas signo) |

**Total max por partido:** 7 pts (3 + 2 + 1 + 1 si se den los 4). Pero el `pts_max_dinámico` usa solo 5 ó 6 (ver §1.3.a porque `+1 signo` y `+3 exacto` no acumulan).

**Boost x2 diario:** mantener tal cual está en `boost_picks` actual. No requiere cambios en F7.7.

### 5.2 Banderas: badge-with-flag-fallback

**NO usar** los emojis del DS (`FLAGS={MEX:'🇲🇽',...}`).

Patrón establecido en repo (regla permanente, ver `CLAUDE.md`):
1. Intentar cargar imagen camiseta primaria del equipo (asset).
2. Fallback a SVG de bandera local si camiseta no disponible.
3. Fallback a placeholder si ninguno disponible.

Reusar helper existente (probablemente en `data.js` o `ui-groups.js`). Code lo identifica en A1.

### 5.3 48 selecciones del Mundial 2026

NO usar los 22 países de `C_NAMES` del DS. Usar `EQUIPOS[]` de `public/js/data.js` (48 equipos cargados según convención del repo). El mapping `código → nombre largo` debe salir de ahí.

Si falta algún equipo en `EQUIPOS[]` (porque playoffs UEFA aún no cerrados): mantener placeholder genérico (visible solo en KO).

### 5.4 Datos en tiempo real

- Stats strip: leer `predictions + ko_predictions + award_picks + ia_predictions` desde Supabase con la liga seleccionada.
- Tile dorado posición liga: query existente.
- Tile dorado posición global: nueva query (ver A5).
- Cards `open`: leer `predictions` para pronóstico actual + `ia_predictions` para indicador IA.
- Cards `resolved`: leer `live_scores` (filtrado `is_historic = false`) + `predictions` + cálculo `scoring.js`.

---

## 6 · F7.7-IA: IA como jugador real

Sub-fase paralela a F7.7-VIS. PR separado pero misma fase.

### 6.1 Concepto

La IA es **un jugador virtual** con `user_id = ia_user_id` (UUID fijo, generado una vez). Pronostica los 104 partidos + 4 premios individuales **una sola vez** el 10 jun (post-amistosos, datos 11v11.com actualizados). Sus pronósticos no cambian. Aparece como miembro automático en TODAS las ligas (existentes + futuras). Sus puntos se calculan por el motor existente (`scoring.js`) sin cambios. Aparece flagged en scoreboard.

### 6.2 Cambios BD

**Nuevo perfil:**
```sql
-- ia_user_id fijo, usar UUID v4 generado una vez y constante
INSERT INTO profiles (id, nombre, is_admin, created_at, is_bot)
VALUES ('<UUID_FIJO>', 'IA Predictor', false, now(), true);
```

Añadir columna `is_bot BOOLEAN DEFAULT false NOT NULL` a `profiles`.

**Auto-membership:**
- Trigger `after_league_insert`: añade automáticamente `ia_user_id` a `league_members` con `porra_cerrada = true` (la IA siempre tiene porra cerrada).
- Backfill manual para ligas existentes: `INSERT INTO league_members (league_id, user_id, porra_cerrada) SELECT id, '<UUID_FIJO>', true FROM leagues;`

**Pronósticos:**
- INSERT 72 filas en `predictions` (fase grupos) con `user_id = ia_user_id`.
- INSERT 32 filas en `ko_predictions` (KO completo) con `user_id = ia_user_id`.
- INSERT 1 fila en `award_picks` (4 premios) con `user_id = ia_user_id`.
- INSERT 17 filas en `boost_picks` (uno por jornada, partido con mayor `pts_esperados` — ver §6.4) con `user_id = ia_user_id`.

### 6.3 Cambios EF — `porra-ia-compute v11`

Extender la EF actual (`v10`, ya cubre 72 grupos) para:
1. Generar pronósticos KO completos. Algoritmo: para cada round, simular probabilidades de avance en función de ELO+H2H+form+host. Tomar equipo más probable como ganador, score más probable como pronóstico.
2. Generar premios individuales:
   - Balón Oro: jugador con mayor `goals_per_match × matches_expected_in_tournament` según datos pre-torneo.
   - Bota Oro: idem por goles totales esperados.
   - Guante Oro: portero del equipo con mayor probabilidad de llegar a SF + menor `goals_conceded`.
   - Mejor Joven (≤21): jugador <22 con mayor `goals + assists per match` según datos pre-torneo.
3. Tras computar todo, INSERT masivo en `predictions / ko_predictions / award_picks / boost_picks` con `user_id = ia_user_id`.

**Cuándo se dispara:** manualmente por San el 10 jun via panel admin (o cron `pg_cron` programado para ese día). NO automático antes.

### 6.4 Boost de la IA (§4.2 confirmado)

Para cada jornada (17 totales en grupos + 6 en KO), la IA elige el partido con **mayor puntos esperados**, calculado:

```
pts_esperados(match) = P(signo_correcto) × 1
                     + P(score_exacto) × 3      ← 3, no acumula con signo
                     + P(goleador_correcto) × 2
                     /* +1 vs IA NO aplica: la IA contra sí misma siempre coincide */
```

Donde las P(.) salen del modelo del Predictor para ese partido. Insertar en `boost_picks` con `match_id = argmax`.

### 6.5 Apariencia de la IA (TBD)

Pendiente de cierre con San (sub-decisión menor, no bloqueante para arquitectura). Code documenta opciones en A5:

- Nombre: "IA Predictor" / "Botín del Mundial" / "Oráculo IA" / otro.
- Avatar: 🤖 emoji simple / SVG custom / robot estilizado FIFA / etc.
- Chip diferenciador: "Bot oficial" / "IA · No-humano" / etc.

### 6.6 Métricas en Predictor

Cuando F7.7-IA esté implementada:
- Stats strip Col 3 "Bonus IA ⚡" se enriquece con sublabel: `"+12 vs IA"` (diferencia de puntos absolutos contra la IA).
- Tile dorado, debajo de "Global #M ↑Δ", chip secundario opcional: `"vs IA: +12 pts"` (tu puntuación − puntuación IA en la liga visualizada).

---

## 7 · Mapping a archivos del repo

Pieza → fichero esperado (Code confirma en A1, ajusta si difiere):

| Pieza | Archivo | Notas |
|---|---|---|
| HTML mounts (`#fc-pred-header`, `#fc-pred-tile`, `#fc-pred-stats`, `#fc-pred-filters`, `#fc-pred-list`) | `index.html` (sustituir el stub `#page-predictor` actual) | Líneas ~36100-36300 |
| Componentes JS (`renderHeader`, `renderTile`, `renderStats`, `renderFilters`, `renderList`, `renderCard`) | `public/js/ui-pred-shell.js` (NUEVO, paralelo a `ui-elim-shell.js` de F7.X) | ~500 LOC esperadas |
| Sistema rangos | `public/js/predictor-ranks.js` (NUEVO) | Función pura `getRank(pts)` |
| Tokens CSS | `css/predictor-tokens.css` (NUEVO) o append a `elim-tokens.css` | Decisión Code |
| Estilos componentes | `css/predictor-shell.css` (NUEVO) | Selectores `fc-pred-*` |
| Wiring | `js/main-entry.js` + `public/js/ui-nav.js` + `public/js/bottom-tab.js` | Mismo patrón F7.X |
| EF IA Predictor | `supabase/functions/porra-ia-compute/index.ts` (extender v10 → v11) | KO + awards + boost |
| Migraciones BD | `supabase/migrations/2026MMDDhhmmss_*.sql` | `is_bot`, ia_user_id seed, trigger |

---

## 8 · NO TOCAR

- `vercel.json` (ERR-06).
- `dice.js` permanece en `admin.js` (regla permanente).
- Motor de puntuación `scoring.js` (función pura `calc*Points`): NO modificar. Solo se lee desde Predictor para mostrar valores.
- Modal `#modal` (estructura HTML + `closeModal` / `closeModalBtn`): reusar, no rediseñar.
- BottomTabs: reusar tal cual.
- Awards y bracket KO existentes: el Predictor solo LEE de ellos para el modal trophy.
- IA Predictor v10 actual (`porra-ia-compute`): **se extiende, no se reescribe**. Mantener compatibilidad con `ia_predictions` y `ia_snapshots` actuales.

---

## 9 · A1 — Inventario (instrucciones para Code)

**Output esperado:** `docs/restyling-mobile/03-predictor-inventory.md`

Plantilla:

```markdown
# Predictor — Inventario actual del repo (A1)

Generado: <fecha>
Branch base: main HEAD <SHA>

## 1. Estado de #page-predictor en index.html
- Líneas: <inicio>-<fin>
- Contenido actual: <copia textual>
- Diff esperado tras F7.7-VIS: <descripción>

## 2. Modal genérico identificado
- ID: #modal (o el que sea)
- Funciones: closeModal(), closeModalBtn(), …
- Animación: <descripción>
- Reusable para trophy modal: SÍ/NO + ajustes necesarios

## 3. Helper banderas (badge-with-flag-fallback)
- Función: <nombre>(<args>)
- Archivo: <archivo>:<línea>
- Comportamiento: <descripción flujo 3-pasos>

## 4. EQUIPOS[] en data.js
- Total entradas: <n>
- 48 esperadas: SÍ/NO
- Si NO, listar faltantes y por qué.

## 5. Componente goleador (búsqueda jugador)
- ¿Existe en repo?: SÍ/NO
- Ubicación: <archivo>:<línea>
- API: <signature>
- Reusable: SÍ/NO

## 6. Lectura ia_predictions
- ¿Existe helper para leer pronósticos IA por match_id?: SÍ/NO
- Ubicación: <archivo>:<línea>

## 7. Sistema boost x2
- Tabla: boost_picks
- Helper: <nombre>
- Ubicación: <archivo>:<línea>

## 8. CSS heredado relevante
- Tokens existentes que reusamos (--fifa-*, --ink-*, --font-*): listar
- Tokens duplicados/conflictivos: listar
- Selectores que F7.7 podría romper: listar

## 9. JS hooks de actualización (rerender)
- Función que escucha cambios de liga seleccionada: <nombre>
- Función que escucha refresh tras live_scores update: <nombre>
- Función que se llama al cerrar/reabrir porra: <nombre>

## 10. RLS y queries necesarias
- Query existente "puntos liga local": ¿usable tal cual?: SÍ/NO
- Query NO existente "puntos global cross-league": especificar.
- Snapshot diario para ↑Δ: ¿existe pg_cron?: SÍ/NO

## 11. Side-effects detectados
- Cualquier archivo que parezca tocar #page-predictor y deba avisarse a San antes de modificar.

## 12. Riesgos identificados
- Tres riesgos numerados con probabilidad/impacto.
```

**Tiempo estimado A1:** 30-45 min de Code (lectura + escritura). Sin tocar implementación.

---

## 10 · A5 — Plan PRs (instrucciones para Code)

**Output esperado:** `docs/restyling-mobile/03-predictor-plan.md`

**Premisa:** F7.7 se descompone en 2 sub-fases con PRs independientes:
- **F7.7-VIS:** rediseño visual Predictor (PRs B1..Bn).
- **F7.7-IA:** IA como jugador real (PRs C1..Cn).

Pueden trabajarse en paralelo si se respeta NO TOCAR (§8). PRs F7.7-VIS no dependen de F7.7-IA hasta el último (que conecta los chips "vs IA").

Plantilla:

```markdown
# Predictor — Plan PRs (A5)

Generado: <fecha>
Tras: A1 inventario <fecha>

## F7.7-VIS — Rediseño visual

| PR | Título | Scope | Archivos | LOC est. | Bloqueante para |
|----|---|---|---|---|---|
| B1 | F7.7-VIS-1: predictor-tokens.css + shell HTML | tokens CSS + sustituir stub #page-predictor por mounts vacíos | css/predictor-tokens.css (NEW), index.html | +50 / -10 | B2..B6 |
| B2 | F7.7-VIS-2: PredictionTile (3 estados) | Tile dorado pre-mundial/active/finalizado | public/js/ui-pred-shell.js (NEW), css/predictor-shell.css (NEW), public/js/predictor-ranks.js (NEW) | +180 | B6 |
| B3 | F7.7-VIS-3: Header + StatsStrip + FilterChips | resto del bloque superior | ui-pred-shell.js, predictor-shell.css | +150 | B6 |
| B4 | F7.7-VIS-4: PredictionCard + ScoreStepper | lista de cards (estados open/locked/resolved) | ui-pred-shell.js, predictor-shell.css | +220 | B6 |
| B5 | F7.7-VIS-5: Trophy modal + integración | modal premios reusando #modal | ui-pred-shell.js, css/predictor-shell.css | +80 | — |
| B6 | F7.7-VIS-6: Wiring + sincronización | main-entry, ui-nav, bottom-tab.js, listeners realtime | js/main-entry.js, public/js/ui-nav.js, public/js/bottom-tab.js | +60 | — |

## F7.7-IA — IA como jugador

| PR | Título | Scope | Archivos | LOC est. | Bloqueante para |
|----|---|---|---|---|---|
| C1 | F7.7-IA-1: schema is_bot + seed ia_user_id | columna profiles + INSERT seed + trigger auto-membership | supabase/migrations/<ts>_predictor_ia_jugador.sql | +80 | C2..C5 |
| C2 | F7.7-IA-2: extender porra-ia-compute v11 (KO) | añadir cómputo KO completo | supabase/functions/porra-ia-compute/index.ts | +150 | C4, C5 |
| C3 | F7.7-IA-3: extender porra-ia-compute v11 (awards + boost) | premios individuales + boost por jornada | supabase/functions/porra-ia-compute/index.ts | +120 | C4, C5 |
| C4 | F7.7-IA-4: insert masivo IA tras compute | acción admin que llama EF + inserta en predictions/ko_predictions/award_picks/boost_picks | supabase/functions/admin-actions/index.ts | +80 | C5 |
| C5 | F7.7-IA-5: visualización IA en scoreboard + stats Predictor | flag avatar + chip "Bot" + sublabel Bonus IA | public/js/scoreboard.js, public/js/ui-pred-shell.js | +60 | — |

## Gates humanos

- **Tras A5 (este doc):** San revisa, aprueba o ajusta antes de B1.
- **Tras B6:** validación visual end-to-end por San antes de mergear toda F7.7-VIS.
- **Antes de C4 (insert masivo IA):** San valida los pronósticos generados por C2+C3 (revisar 5-10 al azar antes de insertar).
- **Antes de cierre porras 10 jun:** ejecutar C4 (lanzamiento real IA).

## Total estimado

| Sub-fase | PRs | LOC | Sesiones esperadas |
|---|---|---|---|
| F7.7-VIS | 6 | ~750 | 2-3 |
| F7.7-IA | 5 | ~490 | 2 |
| **Total F7.7** | **11** | **~1240** | **4-5** |

## Riesgos

1. (rellenar Code tras A1)
2.
3.
```

---

## 11 · Apéndice — Mockup React original

El mockup React de referencia vive en el bundle `Design_System__1_.zip` (no commiteado al repo). Estructura clave:

- `screens.jsx:168-242` → `ScreenPredictions` (composición global de la pantalla).
- `screens.jsx:104-134` → `PredictionTile` (tile dorado, en mockup solo `state="active"`).
- `screens.jsx:244-314` → `PredictionCard` (los 3 estados).
- `screens.jsx:316-326` → `ScoreStepper`.
- `components.jsx` → `Flag`, `Icon` (SVG inline, 16 iconos), `FLAGS`/`C_NAMES` (22 países, reemplazar por 48 reales).
- `styles.css` → tokens FIFA (heredados) + utilidades `fc-eyebrow`, `fc-num`, `pred-chip`, `score`, etc.

**Importante:** el mockup usa puntos `+50/+30/+10` y banderas emoji. Estos NO se portan tal cual — sustituir por scoring real (§5.1) y badge-with-flag-fallback (§5.2).

---

**FIN DEL DOCUMENTO.**
