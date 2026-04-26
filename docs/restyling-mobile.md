# Restyling Mobile — Hub del proyecto

> Ubicación destino en repo: `docs/restyling-mobile.md`
> Subcarpeta hermana cuando arranque P2: `docs/restyling-mobile/`
> Origen del diseño objetivo: bundle Design System v2 (`/mnt/uploads/Design_System.zip` en sesiones de Claude.ai, no parte del repo).
> Última actualización: 26-abr-2026 — post-cierre P1 (F7.1-F7.3, main=`3ea205e`).

---

## 0 · Contexto

San tiene un Design System v2 entregado por Claude Design que rediseña la app para mobile. El bundle contiene tokens CSS, componentes React (atoms.jsx, MatchCard, JCard, DCard, KOCard) y 9 pantallas en JSX (`screens-v1/v2/v3.jsx`). El objetivo es **adaptar producción al diseño v2 sin perder ni una funcionalidad**, pantalla por pantalla, con gates humanos entre cada una.

**Decisiones globales ya cerradas en P1**:
- Tipografía: `Noto Sans` body + `Inter Tight` displays + `Space Mono Bold` para mobile-focus title (sustituto OFL de FWC 26 propietaria).
- Tokens: consolidados en `public/css/base.css` `:root` durante F7.0.
- Faux-bold prohibido sobre `--font-display` (FWC 26 / Bowlby One solo tienen weight 400 — engordar sintéticamente con `font-weight: 700+` queda mal).
- Eliminados en P1: stickers `+2pts`, `gbadge*`, ::after `mobile-locked`, variables sticker en `scoring.js`.
- Conservados intactos: lógica de scoring, tabs (Grupos / Jornada / Directo), submit predicciones, IA bar.

---

## 1 · Inventario de pantallas v2

| # | Slug | JSX en bundle | Estado | PR / Fase |
|---|---|---|---|---|
| **P1** | grupos-animadas | `ScreenGrupos` | ✅ Cerrada | F7.1–F7.3 · PR #22 · main=`3ea205e` |
| **P2** | jornada | `ScreenJornada` | 🟡 Próxima | F7.4 |
| **P3** | directo | `ScreenDirecto` | ⚪ Pendiente | F7.5 |
| **P4** | grupos-comprimida | `ScreenGruposComprimido` | ⚪ Pendiente | F7.6 |
| **P5** | predictor | `ScreenPredictions` | ⚪ Pendiente | F7.7 |
| **P6** | eliminatorias | `ScreenEliminatorias` | ⚪ Pendiente | F7.8 |
| **P7** | bracket-mine | `ScreenBracketMine` | ⚪ Pendiente | F7.9 |
| **P8** | bracket-oficial | `ScreenBracketOfficial` | ⚪ Pendiente | F7.10 |
| **P9** | premios | `ScreenPremios` | ⚪ Pendiente | F7.11 |

### Fuera de scope del Design System v2
Estas pantallas existen en producción pero NO tienen rediseño en el v2:

| Pantalla | Estado en producción | Plan |
|---|---|---|
| Welcome | Cinematic mosaic 13 sites posters (`welcome_tournament_v1.html`) | Cerrada por separado, no requiere restyling |
| Auth (login/registro) | Modal overlay `.auth-modal` | **Decisión pendiente** — ¿se rediseña sin guía v2? |
| Ligas (panel + modales create/join) | Overlay sobre welcome | **Decisión pendiente** |
| Clasificación (`#page-score`) | Podio + tabla + mi desglose | **Decisión pendiente** |
| Admin (`#page-admin`) | 4 tabs Resultados/Usuarios/Premios/Sistema | Probablemente fuera de scope (uso interno San) |

**Acción**: cerrar estas decisiones antes de arrancar P9 (premios) o como bloque post-F7.11.

### Orden propuesto y rationale

El orden no es arbitrario:

1. **P2 Jornada** primero porque vive bajo el mismo header que P1 (tabs Grupos/Jornada/Directo) y comparte componentes (status pills, mini cards). Cierra el primer tab block.
2. **P3 Directo** después: completa el tab block de grupos y reusa partículas live de P2.
3. **P4 Grupos comprimida** antes que predictor: variante visual de P1, debe ser rápida una vez fijado el lenguaje.
4. **P5 Predictor**: pantalla nueva, valor alto, requiere su propio espacio de iteración.
5. **P6→P8 Eliminatorias / Bracket mine / Bracket oficial**: bloque KO completo, comparten lenguaje del bracket y conviene atacar consecutivos.
6. **P9 Premios**: cierra el ciclo.

San puede reordenar; este orden minimiza retrabajo de componentes compartidos.

---

## 2 · Metodología por pantalla (espejo del flujo de P1)

Cada pantalla pasa por **5 fases** con gates humanos:

### A1 · Inventario producción (Claude.ai)
- Lectura del código actual vía GitHub raw API + Supabase MCP.
- Archivos típicos: `index.html` (sección de la pantalla), `public/css/{base,welcome,ko}.css`, `public/js/ui-{x}.js`, `scoring.js` si aplica.
- **Salida**: tabla `funcionalidad → ubicación (file:linea) → handler JS → estado (mantener/mover/eliminar)`.
- Es la garantía del "no perder ni una funcionalidad".

### A2 · Captura del objetivo (San)
- Screenshot anotado de la pantalla en el bundle v2 (`App.html` artboard correspondiente abierto en navegador) con marcas de:
  - ✅ qué mantener tal cual
  - 🔄 qué adaptar
  - ❌ qué eliminar
  - ❓ dudas a resolver
- Si el JSX del bundle es la fuente, Claude.ai lee `app/screens/screens-vN.jsx` directamente.

### A3 · Iteración preview (Claude.ai + San)
- Genero `preview-pantalla-NN.html` self-contained (incluye CSS y JS necesario, datos de prueba) que San puede abrir en local.
- Itero hasta que San apruebe visualmente — todo cosmético se cierra aquí, antes de tocar producción.

### A4 · Cierre decisiones (Claude.ai)
- Documento `docs/restyling-mobile/NN-nombre.md` con:
  - Inventario producción (tabla A1)
  - Inventario v2 (qué propone el bundle)
  - Decisiones de adaptación (qué se trae, qué se descarta, justificación)
  - DoD (definition of done) para QA
  - Snapshot CSS pre-cambio de zonas críticas (ej: `group-layout` grid)

### A5 · Brief Code en planning mode (Claude.ai → Claude Code)
- Documento `docs/restyling-mobile/NN-nombre-patch.md` con:
  - Plan de archivos a tocar (ruta exacta + scope)
  - Snippets de antes/después de los cambios críticos
  - Criterios de aceptación QA (mobile 375/414, desktop, console limpia)
  - Lista de NO tocar (zonas frágiles)
- Code arranca con `/plan` (planning mode, no edita) → produce su plan en markdown → San aprueba → Code ejecuta commits + push.

### A6 · QA Chrome MCP (Claude.ai)
- Navego a `localhost:5173` post-pull, ejecuto checklist DoD del A4.
- Screenshots before/after, validación console limpia.
- Si OK: PR #N abierto, San hace merge desde GitHub UI.

---

## 3 · Workflow con Claude Code en planning mode

```
┌─ Claude.ai ─────────────┐    ┌─ Claude Code ────────────┐
│ A1 lectura producción   │    │                          │
│ A3 preview iteraciones  │    │                          │
│ A4 doc decisiones       │    │                          │
│ A5 brief patch ─────────┼───►│ /plan → plan markdown    │
│                         │    │   ↓ San aprueba          │
│ A6 QA Chrome MCP ◄──────┼────│ Implementa + commit+push │
└─────────────────────────┘    └──────────────────────────┘
```

**Reglas de oro**:
- El brief A5 va a Code **inline en el chat** (Code no hereda CLAUDE.md de subagentes; necesita el contexto explícito).
- Code **siempre** arranca en planning mode (`/plan`) — nunca toca código sin plan aprobado.
- Si Code se desvía del plan durante implementación: PARAR, refrescar plan, volver a aprobar.
- Una pantalla = una rama de trabajo `feat/restyling-NN-slug`. Una pantalla = un PR.
- Tras merge San: borrar rama local + remota antes de arrancar la siguiente.

---

## 4 · Plantilla por pantalla (`docs/restyling-mobile/NN-slug.md`)

Cuando arranque P2, este documento (hub) suma una entrada al índice y se crea:

```markdown
# Pantalla NN · Slug

> Estado: 🟡 Activa · F7.X · branch `feat/restyling-NN-slug`
> A1 inventario: pendiente / en curso / cerrado
> A2 objetivo: pendiente / capturado
> A3 preview: en iteración v0/v1/...
> A4 decisiones: este documento (en evolución)
> A5 brief: `docs/restyling-mobile/NN-slug-patch.md` (cuando exista)

## 1 · Inventario producción
[tabla funcionalidad → file:linea → handler → estado]

## 2 · Inventario v2 (bundle)
[qué propone screens-vN.jsx, componentes implicados]

## 3 · Decisiones de adaptación
[qué se trae, qué se descarta, justificación]

## 4 · DoD (definition of done)
- [ ] Mobile 375px iPhone — OK
- [ ] Mobile 414px Pixel — OK
- [ ] Desktop ≥1024px — OK (no degradado)
- [ ] Console limpia (no errores ni warnings nuevos)
- [ ] Funcionalidades preservadas (lista del A1)
- [ ] Sin regresiones en pantallas vecinas
- [ ] CSS guards verificadas (group-layout grid, etc.)

## 5 · Snapshots CSS críticas pre-cambio
[fragmentos exactos de zonas frágiles para diff posterior]

## 6 · Riesgos detectados
[específicos de esta pantalla]
```

---

## 5 · Riesgos transversales (válidos para todas las pantallas)

| Riesgo | Mitigación |
|---|---|
| `group-layout` grid (1fr 340px) accidentalmente borrado | Snapshot CSS pre-cambio + verificación post-merge |
| Bug parpadeo on submit (#6 roadmap) puede pisarse | Aprovechar para fixearlo si la pantalla toca submit |
| Bug mobile bracket (#11 roadmap) puede colisionar con KO rediseñado | Resolverlo dentro del scope de P6/P7 |
| Splash hardcoded 4s (`index.html` L78-114) | Decidir antes de F7.4 si entra en restyling o se mantiene |
| Inline `display:none` en `page-*` puede chocar con CSS transitions nuevas | Si Code introduce transitions, migrar toggle de display a clases |
| Faux-bold sintético sobre `--font-display` | Auditar inline `font-weight: 700/800` en cada pantalla y forzar 400 |
| Code en subagentes Haiku NO hereda contexto | Brief A5 con contexto inline siempre |

---

## 6 · Decisiones pendientes de tomar antes de arrancar P2

1. **Pantallas fuera del v2** (Auth, Ligas, Clasificación, Admin): ¿entran en este sprint o se difieren a F8?
2. **Splash hardcoded**: ¿se rediseña o se conserva?
3. **Welcome**: ¿se considera cerrado por `welcome_tournament_v1.html` o el v2 va a proponer algo nuevo más adelante?
4. **Naming de fases**: ¿F7.4 = P2 una sola fase, o subdividir como hicimos en P1 con F7.1/7.2/7.3 según complejidad?
5. **¿Se incluye fix de #6 (parpadeo submit) en P2?** P2 toca submit en grupos compactos.

---

## 7 · Checklist arranque P2 · Jornada

Cuando San lo dé OK:

- [ ] Cerrar las decisiones pendientes del bloque 6 (mínimo 1, 4 y 5).
- [ ] San envía A2 (screenshot anotado del artboard `jornada` del bundle v2).
- [ ] Claude.ai lee `app/screens/screens-vN.jsx` para localizar `ScreenJornada` exacto y produce A1 desde GitHub raw API.
- [ ] Crear branch `feat/restyling-02-jornada` desde main (Code, primera tarea).
- [ ] Crear `docs/restyling-mobile/02-jornada.md` con plantilla del bloque 4.
- [ ] Iteración preview hasta visto bueno.
- [ ] Brief Code → planning → ejecución → QA → PR.

---

## 8 · Estado del proyecto

| Pantalla | A1 | A2 | A3 | A4 | A5 | A6 | PR |
|---|---|---|---|---|---|---|---|
| P1 grupos-animadas | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ | #22 merged |
| P2 jornada | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| P3 directo | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| P4 grupos-comprimida | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| P5 predictor | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| P6 eliminatorias | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| P7 bracket-mine | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| P8 bracket-oficial | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |
| P9 premios | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | ⬜ | — |

---

## 9 · Issues de seguimiento (no bloquean restyling pero conviene tener cerca)

| Issue | Tema | Cuándo atacar |
|---|---|---|
| #23 | Canvas `_boostFire` mobile-focus no pinta partículas | Antes de cerrar P3 (Directo) que reusa boost |
| #24 | ~14 inline-styles `Inter Tight`/`Inter` en `index.html` | Aprovechar cualquier PR de restyling para limpiar los de la pantalla tocada |
| #25 | Reglas CSS `.gbadge*` huérfanas | Cleanup post-F7.11 |
| #26 | Variables sticker muertas en `scoring.js` | Cleanup post-F7.11 |
| #27 | Formalizar `.claude/rules/multi-agent-sync.md` | Cualquier momento, branch separada |

---

## 10 · Cierre y archivado

Cuando F7.11 (P9) cierre:
- Mover este documento a `docs/restyling-mobile/00-readme.md`.
- Crear `docs/restyling-mobile/_summary.md` con executive summary del proyecto completo.
- Actualizar `CLAUDE.md` HOT con referencia a la nueva subcarpeta.
- Cerrar issues #23-#26 que se hayan resuelto en el camino.
- Archivar el Design System v2 zip en Drive privado (no entra al repo).
