# Quiniela Design Source v2 — Bundle de referencia

> Procedencia: `Design_System__1_.zip` entregado por Claude Design el 29-abr-2026.
> Contexto: rediseño visual de la pestaña Quiniela (= "Fase Final" actual del bottom-tab).
> Branch destino del rediseño: `claude/f7x-quiniela-shell` (a crear desde main).

## Decisiones arquitectónicas (cerradas con San)

1. **"Quiniela" = botón "Fase Final" actual del bottom-tab**, renombrado. Cubre Eliminatorias + Bracket + Premios. Si visualmente queda compacto, San valorará absorber Grupos también — DEFERIDO, no asumir.
2. **Stack: vanilla JS**. Portar JSX → vanilla en `public/js/ui-quiniela.js` (nuevo). NO React/Preact.
3. **Tokens: coexisten** — `--fc-*` shell global ya consolidado, NUEVOS `--fifa-*` y `--ink-*` para contenido Quiniela en `public/css/components/quiniela-tokens.css` (nuevo).
4. **Tipografía: postpuesta**. Usar las del proyecto (Inter Tight + Noto Sans).
5. **Tarjetas de pronóstico: CORE INTOCABLES**. Diseño y funcionalidad cerrados. ÚNICO ajuste permitido: REDIMENSIONAR (densidad) si no encajan en el carrusel del nuevo diseño.
6. **MiniPredCard del mockup DESCARTADO**. Usar las cards REALES embebidas en `GroupExpanded`/`PhaseExpanded`.
7. **JerseyBg DESCARTADO** (no se necesita catálogo de colores por equipo).
8. **Predictor**: pestaña separada del bottom-tab, NO en este sprint.
9. **Bracket+Premios**: NO en este sprint, fase posterior.
10. **FWC 26 fuente**: postpuesta (cosmética).
11. **Target**: responsive Android/iOS, NO chasis 360 fijo.

## Tokens del diseño

```css
:root {
  /* Brand — FIFA oficial premium */
  --fifa-red: #E30613;
  --fifa-green: #006341;
  --fifa-blue: #0A4595;
  --fifa-gold: #C9A961;
  --fifa-gold-deep: #9A7B3A;

  /* Neutrals — premium sport */
  --ink-900: #0A0E1A;
  --ink-800: #141826;
  --ink-700: #1F2433;
  --ink-600: #2A3142;
  --ink-500: #4A5163;
  --ink-400: #7A8194;
  --ink-300: #B8BEC9;
  --ink-200: #E2E5EB;
  --ink-100: #F2F4F8;
  --ink-50:  #F8F9FB;

  /* Semantic */
  --live: #E30613;
  --win:  #00834A;
  --draw: #B7860B;
  --loss: #6F1E22;
}
```

## Componentes a portar (JSX → vanilla)

Las 4 piezas críticas a portar a `public/js/ui-quiniela.js` son: `PorraHeader`, `PhaseStepper`, `GroupRow + GroupExpanded`, `PhaseRow + PhaseExpanded`.

El JSX completo de cada uno está adjunto en este mismo bundle abajo. Notas clave:

- `Icon` viene del sistema vanilla `getIcon(name)` ya existente en `public/js/components/icons.js` (creado en F7.4-A).
- `Flag` viene de `components.jsx` del bundle pero se debe sustituir por el helper de banderas existente del proyecto.
- `MiniPredCard` y `JerseyBg` están REFERENCIADOS en el JSX pero DESCARTADOS — sustituir por las cards reales del proyecto, redimensionadas si hace falta.
- Constantes de color: ver tokens arriba.

### PorraHeader — Header de la pestaña Quiniela

Sustituye al `.fc-appbar` global cuando el usuario está en Quiniela. Dimensiones: padding `50px 16px 0`. Contiene:
- Botón ← Inicio (top-left, fondo `#1F2433`, border `#2A3142`)
- Logo "Porra Mundial 2026" + subtítulo contextual (top-right)
- 2 botones acción contextual: Cuadro oficial (azul `#60A5FA`), Premios (dorado `#FFD700`)
- Línea Puntos: N + badge ADMIN

Props: `points, subtitle, onPremios, onCuadro, activeAction ∈ {null, 'cuadro', 'premios'}`.

### PhaseStepper — Cinta horizontal de fases

Navegación interna de la pestaña Quiniela. 6 pasos: Grupos (72) / 1/16 (16) / 1/8 (8) / 1/4 (4) / Semis (2) / Final (2 incluye 3º/4º).

- Activa: agrandada `flex: 1.4`, fondo `#1F2433`, borde dorado `#FFD700`, underline 2px dorado
- Completa: borde verde `rgba(34,197,94,0.3)`, label verde `#22C55E`
- Bloqueada: opacity 0.5, candado, label `rgba(255,255,255,0.2)`, dash en counter
- Bloqueo cascada: una fase está bloqueada si la anterior no está completa
- Separador `›` entre pasos

Props: `active, progress` (object con done/total por fase: `{ grupos:{done:72,total:72}, ko16:{done,total}, ... }`).

### GroupRow — Fila colapsada de grupo (A-H)

Layout horizontal:
- Barra color izquierda 4×36px (verde `#22C55E` si completo, gris si pendiente)
- Columna texto: eyebrow "GRUPO" + letra grande 26px font-display
- Botón "🎲 Simular" individual del grupo (fondo `rgba(124,58,237,0.15)`, borde violeta, color `#A78BFA`)
- Progress bar horizontal 3px alto
- Counter `done/6`

Padding row: `12px 14px`. Border 1px verde si expandido, transparente si no. Cursor pointer.

### GroupExpanded — Marco expandido del grupo

Marco verde `#22C55E` cuando expandido, fondo `#0A0E1A`, padding `14px 0 18px`, marginBottom 10.

Estructura:
1. Header: "Grupo X · idx/total" + badge "COMPLETO ✓" (verde `#22C55E`)
2. Carrusel scroll-x con cards reales (gap 10, padding 0 16, scrollbar oculta). Card actual sin transform, otras `scale(0.92)` opacity 0.55.
3. Dots paginación: span 5px o 16px (current), gap 5, color verde si current.
4. Caja Clasificación Proyectada: padding 10, fondo `#0E1320`, border `#1F2433`, eyebrow + lista 4 equipos con posición/bandera/nombre/pts.

### PhaseRow — Fila colapsada de fase eliminatoria

Equivalente a GroupRow pero para fases. Layout vertical en columna texto:
- Eyebrow shortLabel ("1/16", "SF", "F", "3º/4º")
- Label grande 22px font-display
- Subtítulo "{total} partido{s}"

Side badge derecho: counter `done/total` color del estado + progress bar 60×3px. Si bloqueada: candado + texto "BLOQUEADO" en `rgba(255,255,255,0.45)`.

Estados color (`accent`):
- Bloqueada: `rgba(255,255,255,0.2)`
- En progreso: dorado `#FFD700`
- Completa: verde `#22C55E`

### PhaseExpanded — Marco expandido de fase

Igual que GroupExpanded pero con flechas `◀ ▶` posicionadas absolutas sobre el carrusel:
- Botón izquierdo: 30×30 circle, fondo `rgba(0,0,0,0.7)`, backdrop-filter blur(10px), border `rgba(255,255,255,0.1)`, transform rotate(180deg) translateY(-50%)
- Botón derecho: idem sin rotate

Botón "🎲 Simular" en el header (similar al de GroupRow pero por fase entera).

## Composición — pantallas Grupos y Eliminatorias

```
┌─ PorraHeader ──────────────────┐
│ ← Inicio   Porra Mundial 2026  │
│            Quiniela · F. grupos │
│ [Cuadro oficial] [Premios]     │
│ Puntos: 32 · ADMIN             │
├─ PhaseStepper ─────────────────┤
│ [Grupos][1/16][1/8][1/4][SF][F]│
├─ Banner Simular global ────────┤
│ 🎲 Simular al azar [Todos 72]  │
├─ Lista colapsada ──────────────┤
│ ┌ Grupo A · 6/6 · 🎲 ▕▔▔▔▔▔  │
│ ├─ Grupo B EXPANDIDO ─────────┤│
│ │  Grupo B · 1/6 · COMPLETO ✓  ││
│ │  ◀ [Card real][Card real] ▶ ││
│ │  · · · · ·                  ││
│ │  Clasif. proyectada          ││
│ ├─ Grupo C ...                ││
│ └ Grupo H 🔒 BLOQUEADO         │
└─ BottomTabs ───────────────────┘
```

ScreenEliminatorias usa el mismo shell pero PhaseRow en vez de GroupRow. Solo cambia el active del PhaseStepper y la lista interna.

`ScreenGruposComprimido` y `ScreenEliminatorias` ambos ponen `BottomTabs active="grupos"` en el mockup → ambas viven bajo la pestaña "Quiniela" (= "Fase Final" actual renombrada).

## CRÍTICO — Simulación de partidos

El mockup tiene 3 puntos donde aparece "🎲 Simular":
1. **Banner global** "Simular al azar: Todos los grupos (72)" en la parte superior de ScreenGruposComprimido
2. **Botón individual** en cada GroupRow ("Simular un grupo")
3. **Botón en header** de PhaseExpanded ("Simular fase entera")

Actualmente la lógica de simulación vive en `dice.js` DENTRO de `admin.js` (solo accesible para admin). Hay un bug pendiente del backlog #3: "Botón simular eliminatorias visible para todos los usuarios". Esta fase es buen momento para EXTRAER `dice.js` a su propio módulo y hacerlo accesible al usuario normal. Documentar en el plan.

## Tareas para Code (gates humanos)

### A1 — Inventario producción (sin editar)

Lee y produce inventario:
- `index.html`: secciones `page-grupos`, `page-elim` (= la pestaña "Fase Final" actual), `page-bracket` si existe
- `public/js/scoring.js` (~línea 715-770): `renderMatchCard`
- `public/js/scoring.js` (~línea 880-960): explainer popover IA
- `public/js/ui-groups.js`: navegación grupos
- `public/js/ui-groups-mobile.js`: focus mobile grupos
- `public/js/ko.js`: bracket + IA
- `public/css/base.css`: estilos `.match-card` (o equivalente)
- bottom-tab JS (`public/js/components/bottom-tab.js` o donde esté): localiza el botón "Fase Final"
- `dice.js` o equivalente dentro de `admin.js`: lógica de simulación

Output A1:
- Tabla `funcionalidad → file:linea → handler JS → estado (intacto / redimensionar / migrar / extraer-de-admin)`
- Dimensiones reales de la card en mobile 375px y 414px (calcula desde CSS — width, padding, border, total horizontal)
- Lista eventos JS por card (boost click, marcador change, etc.)
- Bottom-tab actual: dónde se define el botón "Fase Final" (ahora hay que renombrar a "Quiniela")
- Estado del módulo de simulación: ¿qué hay que hacer para sacarlo de admin?

### A5 — Plan markdown (sin editar)

Tras A1, produce plan en markdown con:
- Rama: `claude/f7x-quiniela-shell` desde main
- Ficheros a CREAR: `public/js/ui-quiniela.js`, `public/css/components/quiniela.css`, `public/css/components/quiniela-tokens.css`
- Ficheros a TOCAR: `index.html` (estructura `page-quiniela`), `public/js/main-entry.js` (loadScript), bottom-tab JS (renombrar)
- Snippets antes/después de los cambios críticos
- Estimación LOC neto por fichero
- Lista NO tocar
- DoD QA
- Pregunta abierta: ¿extraer simulación de admin como parte de este sprint o diferir?

NO EDITAR IMPLEMENTACIÓN HASTA APROBACIÓN DE SAN.

## NO TOCAR (verificado fuera de scope)

- `scoring.js` lógica `calc*Points` + `iaBonusWillApply`
- EF `porra-ia-compute`, tablas `ia_snapshots` / `ia_predictions` / `ia_models`
- `iaPredictions` store, `iakoPredictions` store
- `buildIAExplainer` / `setupIAExplainerOnce`
- `loadIAPredictions` y su mapping `legacyByMatchId`
- `ko-ia-hint` chip (queda para fase Bracket posterior)
- `public/css/base.css` salvo si necesitas micro-fix para que la card encaje en el slot del carrusel

## Workflow

1. Plan primero, San aprueba, ejecutas
2. 1 commit por tarea lógica
3. Push inmediato tras cada commit
4. PR cuando esté listo
