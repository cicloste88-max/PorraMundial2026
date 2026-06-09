# Handoff: Pantallas de Comunidad y Porra de un Jugador

> Paquete para implementar **2 pantallas nuevas** de Porra Mundial 2026 en la app real
> (`public/js` + `public/css`, clásico + módulos como el resto del proyecto).

## Resumen

Dos pantallas móviles que amplían lo que hoy existe como sección **"La liga opina"** dentro de
`tarjeta-stats.js` ("Ver ficha / Datos del partido"):

1. **La comunidad opina** — para un partido concreto: qué pronostica la liga (signo y marcadores),
   la tendencia global de toda la porra y el pronóstico de la IA.
2. **Porra de un jugador** — para un usuario concreto: todos sus pronósticos del torneo,
   agrupados por jornada/fase, con el desglose de puntuación oficial (4 chips por partido).

## Sobre los archivos de diseño

Los archivos de `design/` son **referencias de diseño en HTML/React (vía Babel in-browser)** —
prototipos que muestran aspecto y comportamiento, **no código de producción para copiar tal cual**.
La tarea es **recrear estas pantallas en el entorno del proyecto** (este repo usa **JS clásico +
CSS plano**, p. ej. `public/js/tarjeta-stats.js` que renderiza con template strings; sigue ese
patrón, o un componente equivalente si introducís build). Las variables de color/tipografía y la
estética deben tomarse del sistema existente (`public/css/components/elim-tokens.css`).

## Fidelidad

**Alta (hifi).** Colores, tipografías, espaciados e interacciones son definitivos y están tomados
de los tokens reales del proyecto. Reprodúcelas con fidelidad de píxel usando el sistema visual
existente.

---

## Sistema visual (tokens reales del proyecto)

Heredados de `public/css/components/elim-tokens.css`. **No inventar colores nuevos.**

| Token | Valor | Uso |
|---|---|---|
| `--ink-900` | `#0A0E1A` | Fondo base (más oscuro) |
| `--ink-800` | `#141826` | Fondo superior del gradiente de pantalla |
| `--ink-700` | `#1F2433` | Bordes, líneas divisorias |
| `--ink-600` | `#2A3142` | Bordes secundarios |
| `--ink-500` | `#4A5163` | Texto deshabilitado, separadores |
| `--ink-400` | `#7A8194` | Texto terciario / etiquetas |
| `--ink-300` | `#B8BEC9` | Texto secundario |
| `--ink-200` | `#E2E5EB` | Texto |
| `--ink-100` | `#F2F4F8` | Texto principal / números |
| `--fifa-gold` | `#C9A961` | Acento principal (titulares, "tu pick", boost, IA) |
| `--fifa-gold-deep` | `#9A7B3A` | Degradado del oro |
| `--fifa-red` | `#E30613` | EN VIVO, acento visitante (team-b) |
| `--win` | `#4ade80` | Aciertos / "Final" / chips logrados (verde) |
| `--team-a` (local) | `#2851E1` | Azul equipo local (UI, no bandera) |
| `--team-b` (visitante) | `#E30613` | Rojo equipo visitante (UI, no bandera) |

Tipografía:
- **Display**: `--font-display: "Saira", "SF Pro Display", -apple-system, system-ui, sans-serif;`
  (titulares, números, etiquetas en mayúsculas).
- **Texto**: `--font-text: "Inter", -apple-system, system-ui, sans-serif;`
- Casi todo el texto de etiqueta va en Saira, MAYÚSCULAS, `font-weight: 800`, `letter-spacing` ≈ `.14em–.22em`.
- Los números (marcadores, %, puntos) usan `font-variant-numeric: tabular-nums` y pesos 800–900.

Recursos compartidos de pantalla (clase `.pc-screen`):
- Fondo: `linear-gradient(180deg, var(--ink-800) 0%, var(--ink-900) 100%)`.
- Borde `1px solid var(--ink-700)`, `border-radius: 22px`.
- Línea superior decorativa de 2px (`::before`): degradado azul→oro→rojo.
- Ancho de diseño base: **390px** (móvil).

### Banderas
En el prototipo las banderas son **degradados CSS** (`.pc-flag[data-c="FRA"]`, etc.) por no disponer
de los assets. **En la app real usa las imágenes de bandera del proyecto**: el patrón existente es
`SB + '/miniatures/flags-sm/' + iso2 + '.webp'` con el mapa `ISO3_TO_ISO2` (ver `tarjeta-stats.js`
y `ui-groups.js`). Sustituye `.pc-flag` por un `<img>` con ese `src` y `onerror` para ocultar.

---

## Pantalla 1 — "La comunidad opina"

**Propósito.** Para un partido, ver qué piensa la comunidad y la IA. Se accede desde la ficha del
partido. Adapta su contenido según el estado del partido (**pre-partido** vs **finalizado**).

**Archivos de referencia:** `Pronósticos Comunidad.html` → `screen-b.jsx` (componente `ScreenB`),
con utilidades en `shared.jsx` y datos en `data.js`. (El `app.jsx` + `design-canvas.jsx` son solo
el lienzo de presentación para comparar estados — **no forman parte de la pantalla**.)

**Layout (de arriba a abajo), dentro de `.pc-screen`, 390px de ancho:**

1. **Nav** (`.pc-nav`): botón atrás "‹ Ficha" (Saira 10px/800, `--ink-300`), título centrado
   "LA COMUNIDAD OPINA" (Saira 9px/800, `letter-spacing .22em`, `--fifa-gold`).
2. **Meta** (`.pc-meta`, centrado): eyebrow "Jornada 2 · Grupo F · Partido 3" (oro 9px),
   hora o "Finalizado" (Saira 11px `--ink-300`), estadio (Inter 10px `--ink-400`).
3. **Hero** (`.pc-hero`, grid `1fr auto 1fr`): bandera local (círculo 60px, borde azul) + nombre +
   "Local"; bloque central de marcador (label "Por jugar"/"Resultado", números Saira 34px/900); bandera
   visitante (borde rojo) + nombre + "Visitante". Pre-partido: marcador "– : –" atenuado.
4. **Secciones** (`.pc-section`, separadas por `border-bottom: 1px solid var(--ink-700)`), cada una con
   título Saira 10px/800 mayúsculas `--ink-300` y un contador a la derecha:

   - **Signo · tu liga** (`{total} votos`): **donut** (conic-gradient) con los % de 1/X/2 de la liga
     (`--team-a` azul / `--ink-400` empate / `--team-b` rojo), centro = % dominante. A la derecha,
     leyenda de 3 filas (Francia gana / Empate / España gana) con su %, resaltando "TU PICK" en oro.
   - **Marcadores más jugados** (`ranking ↓`): **podio**. Tarjeta #1 destacada (marcador 46px, nº de
     jugadores, chips con nombres). Debajo, lista del #2 en adelante con mini-barra proporcional al nº
     de votos (azul si signo 1, rojo si signo 2, gris si X; **oro si es el marcador real exacto** en
     finalizado).
   - **Tendencia global**: titular gigante con el nº total de pronósticos de toda la porra
     (`128.412`, Saira 44px), subtítulo, y 2 tarjetas: "Signo más elegido" (con %) y "Marcador top" (con %).
   - **Pronóstico de la IA**: tarjeta destacada (radial oro tenue) con marcador más probable grande,
     barra de confianza + % (`--fifa-gold`). En finalizado muestra "✓ La IA clavó el marcador" si acertó.
5. **Footer** (`.pc-footer`): "Tu pronóstico/Tu resultado" con tu marcador; en finalizado añade
   "✓ Exacto" / "✓ Signo" / "Fallado".

**Estados:**
- `state="pre"`: marcador "–:–", sin resaltado de aciertos, IA sin "acertó".
- `state="final"`: marcador real, marcador exacto en oro en el ranking, IA con indicador de acierto.

> Nota: en el prototipo existe una **Variante A (compacta, con barra segmentada en vez de donut)** que
> se descartó. La elegida es la **Variante B** (`screen-b.jsx`).

---

## Pantalla 2 — "Porra de un jugador"

**Propósito.** Ver **todos los pronósticos de un usuario** en el torneo. Las predicciones se cierran
antes del Mundial y **cualquiera puede consultarlas a demanda**. Pantalla **interactiva**: un selector
de jornadas/fases cambia la lista.

**Archivos de referencia:** `Porra de un Jugador.html` → `screen-userpicks.jsx` (componente
`ScreenUserPicks`), utilidades en `shared.jsx`, puntuación + datos en `data.js`.

**Layout (`.pc-screen.up-app`, columna flex, alto fijo tipo móvil, lista con scroll interno):**

1. **Cabecera fija** (`.up-fixed`):
   - **Nav**: "‹ Liga" · "PORRA DE {NOMBRE}".
   - **Perfil** (`.up-profile`): avatar circular 54px con inicial (degradado oro), nombre (Saira 21px/900),
     meta "{liga} · **Tú**".
   - **Stats** (`.up-stats`, 3 tarjetas): **Puntos torneo** (oro), **Posición** (`#3` de 24),
     **Exactos** (`4/9` = marcadores exactos clavados / partidos jugados).
   - **Selector** (`.up-tabs`, scroll horizontal): un chip por jornada/fase:
     `J1 · J2 · J3 · 8vos · 4tos · Semis · Final`. Cada chip: etiqueta (Saira 12px) + subtítulo
     (jornada cerrada → "{pts} pts" en verde; en juego → "en juego" en rojo; futura → "próx."). El chip
     activo lleva borde + texto oro. **No hay bloqueo**: todas las fases son consultables.
2. **Scroll** (`.up-scroll`, `overflow-y:auto`): divisor de jornada ("Jornada 2 · 18–20 JUN · En juego ·
   7 pts") + lista de tarjetas de partido.
3. **Footer fijo**: "Total torneo · posición #3" + "{pts} pts · {exactos} exactos".

**Tarjeta de partido (`.up-match`):**
- **Cabecera**: estado ("Final" / "● En vivo · 64′" en rojo / hora futura) + badge "⚡ Boost ×2" si aplica.
- **Equipos** (grid `1fr auto 1fr`): bandera+código local · bloque "Pronóstico" con marcador del usuario
  (Saira 24px) · código+bandera visitante.
- **Goleador previsto** (`.up-scorer`): "⚽ Goleador: **{nombre}**" (✓ verde si acertó, en finalizado).
- **Chips de puntuación** (`.up-chips`, solo finalizado/en vivo): los **4 chips oficiales** como tags;
  iluminados (verde; oro el de Exacto) los conseguidos, atenuados los fallados.
- **Footer de tarjeta**: "Resultado **X–Y**" + puntos del partido ("14 pts · ⚡×2" si boost).
- Borde lateral de color según resultado: oro (exacto), verde (signo), rojo (en vivo), gris (fallo).

---

## Modelo de puntuación (FUENTE DE VERDAD: `docs/NORMAS_PUNTUACION.md`)

Implementado en `data.js → PCutil.chips(match, ref)`. Cada partido = **4 chips que apilan**:

| Chip | Condición | Puntos |
|---|---|---|
| **Signo (1·X·2)** | Aciertas el sentido del marcador | **+1** |
| **vs IA** | Tu signo ≠ al de la IA **y** aciertas el signo | **+1** |
| **Goleador** | Aciertas cualquier goleador del partido | **+2** |
| **Resultado exacto** | Marcador exacto (apila sobre el +1 de signo) | **+3** |
| | **Máximo base** | **7** |

- **BOOST ×2** (riguroso): un partido por jornada; multiplica ×2 **solo si se logran los 4 chips**
  (máx. 14). **Excepción 0-0**: si predices 0-0, aciertas y vas contra la IA, el chip de goleador se
  da por auto-satisfecho ("no habrá goleador") y no bloquea el boost.
- **Fase final (eliminatoria)** — el prototipo solo cubre el caso **"el cruce coincide" → puntúa como
  grupos**. **Pendiente de implementar** (no está en el mock):
  - Si el cruce pronosticado NO coincide → puntos por **avance de equipos**:
    grupos→16avos +5 · 16avos→8vos +10 · 8vos→4tos +15 · semis +20 · final +30 (acumulativos por equipo).
  - **Cuadro de honor**: campeón +30 · subcampeón +20 · 3.º +15 · 4.º +10.

> Ojo: `public/js/scoring.js` tenía discrepancias con estas normas (ver §6 del doc). El motor real es
> la fuente; estas pantallas solo **visualizan** lo que devuelva el scoring engine.

---

## Estructuras de datos (ver `data.js`)

**Pantalla 1** lee `window.PC`:
```js
PC.match   = { home:{name,code}, away:{name,code}, eyebrow, time, stadium, real:{home,away} }
PC.league  = { total, sign:{p1,pX,p2}, myPick:'1'|'X'|'2', scores:[{home,away,count,players:[]}], ... }
PC.global  = { total, sign:{winner,pct}, topScore:{home,away,pct} }
PC.ia      = { sign, score:{home,away}, confidence }
```

**Pantalla 2** lee `window.PC.userCard`:
```js
userCard = {
  user:{name, initials, league}, rank, totalPlayers,
  jornadas: [{
    id, label, short, dates,
    state: 'done' | 'live' | 'upcoming',
    matches: [{
      home:{n,c}, away:{n,c}, time,
      phase: 'final' | 'live' | 'pre',
      pred:{h,a}, real:{h,a}|null, live:{h,a}?,
      scorer:'Nombre',            // goleador previsto
      boost:true?,                // partido con boost de la jornada
      gol:bool?, iaDiff:bool?,    // solo en 'final': acertó goleador / su signo ≠ IA
    }]
  }]
}
```

Helpers en `PCutil`: `signOf(h,a)`, `label(h,a)`, `fmt(n)`, `chips(match,ref)`, `flatUsers(lg)`.

## Interacciones
- **P2 selector de jornada**: estado local (`useState('j2')` en el prototipo). Al cambiar, se filtra
  la lista de partidos y se recalcula el subtotal. La lista hace scroll interno; cabecera y footer fijos.
- Sin animaciones complejas; transiciones suaves de color en hover de los chips del selector (`.15s`).

## Datos reales (de dónde sacarlos en el backend)
- **% de signo de liga / distribución de marcadores** (P1, secciones 1–2): agregados sobre `predictions`
  filtrados por `league_id` y `match`.
- **Tendencia global** (P1, sección 3): mismos agregados sin filtrar por liga.
- **IA** (P1, sección 4): tabla `ia_predictions` (ver `docs/ia-predictor.md`).
- **Porra de un jugador** (P2): `predictions` + `ko_predictions` del `user_id`, agrupadas por jornada,
  enriquecidas con `live_scores` y el resultado del scoring engine (`public/js/scoring.js`).

## Archivos en este bundle
- `design/Pronósticos Comunidad.html` — pantalla 1 (lienzo de presentación).
- `design/Porra de un Jugador.html` — pantalla 2 (interactiva, centrada).
- `design/screen-b.jsx` — componente de la pantalla 1.
- `design/screen-userpicks.jsx` — componente de la pantalla 2.
- `design/shared.jsx` — Nav, Hero, Footer, Flag compartidos.
- `design/data.js` — datos mock + `PCutil` (incluye `chips()` con la puntuación oficial).
- `design/comunidad.css` — todos los estilos (tokens + `.pc-*`, `.b-*`, `.up-*`).
- `design/app.jsx`, `design/design-canvas.jsx` — **solo presentación** (lienzo comparador); no portar.
```
