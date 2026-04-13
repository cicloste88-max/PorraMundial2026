# Porra Mundial 2026 — Contexto para Claude Code

## Proyecto
App de pronósticos del Mundial 2026. Stack: HTML+CSS+JS vanilla, Supabase, Vite, Vercel.
**Producción: porramundial2026-seven.vercel.app**
Repo: github.com/cicloste88-max/PorraMundial2026
Rama activa: **main**

## Estado actual (2026-04-13)
**Migración Vite COMPLETA. Bracket de resultados COMPLETO. Splash screen COMPLETO. Boost x2 COMPLETO. Vista Jornada COMPLETA. Último commit: 82b6a77.**

- Todos los módulos JS en `public/js/` (scripts clásicos, cargados via loadScript)
- `main.js` ELIMINADO — dividido en 5 sub-módulos (data, scoring, ui-groups, ko, ui-nav)
- `js/main-entry.js` como entry point Vite (type="module", importa Supabase npm)
- Build: `npm run build` genera `dist/` con `assets/` + `js/`
- QA login con `.env.local` (VITE_QA_EMAIL / VITE_QA_PASS)
- `vercel.json` eliminado — causaba MIME text/html en .js (rompía módulos ES)

## Estructura ficheros JS
```
js/
  main-entry.js       <- entry point Vite (type=module) — importa Supabase npm

public/js/
  data.js             <- datos torneo + estado global + utils
                         SB, EQUIPOS, GRUPOS, PARTIDOS, KIT_OVERRIDES,
                         predictions, iaPredictions, totalPoints,
                         getMatchKey, getMySign, iaBonusWillApply, escapeHtml
  scoring.js          <- motor puntos + tabla + tarjetas + premios
                         KO_ROUND_PTS, FINAL_CLASSIFICATION_PTS, calc*, AWARDS_CFG,
                         AW_PLAYERS, YOUNG_PLAYERS_NXGN, renderAll,
                         refreshGroupTables, updateCardUI, openPicker, selectAward
  ui-groups.js        <- init grupos
                         initGrupos, savePredictions, checkGroupsComplete
  ko.js               <- bracket KO + IA pronósticos (vista "Rondas"/"Bracket"/"Cuadro")
                         BRACKET, koPredictions, ROUND_CONFIG, ROUND_BREAKDOWN,
                         BADGE_MAP, areGroupsComplete, buildBracketView,
                         fetchIAforKO, findMatch, getTeamForSlot, saveKO,
                         normKoPredictions, buildCinematicView, resolvedSlots
  ui-nav.js           <- SPA nav + modal + welcome
                         showPage, openModal, closeModal, initWelcome,
                         updateAwardsFooter, renderPickerList, koInit,
                         refreshAllViews, setView (gestiona tabs + oculta finalizar en Resultados)
  auth.js             <- auth Supabase
                         doLogin, doRegister, onAuthStateChange,
                         loadUserData, renderAuthBar, updateCTAs
  leagues.js          <- ligas y selección de porra
                         leagueLoadMyLeagues, leagueSelect, getActiveLeagueId
  misc.js             <- utils UI (sin deps, carga en paralelo)
  scoreboard.js       <- clasificación multi-usuario
  close-porra.js      <- cierre de pronósticos
                         checkFinalizarReady, finalizarPorra
  admin.js            <- panel admin + dados/simulador + lockAllCardsIfCerrada
                         llama refreshBracketResults() tras actualizar resultados
  bracket-results.js  <- [NUEVO 2026-04-13] vista de resultados reales del bracket KO
                         SIN lógica de pronósticos. Lee window._results.
                         Expone: initBracketResults, refreshBracketResults, brkSetPhase

public/css/
  bracket-results.css <- [NUEVO 2026-04-13] estilos del bracket de resultados
                         Prefijo brk- en todas las clases
  boost.css          <- [NUEVO 2026-04-13] estilos boost x2: checkbox, badge, glow,
                         Canvas 2D fuego. card-inner hereda overflow:hidden de .card
```

## Cadena de carga en main-entry.js
```
misc.js (paralelo)
leagues → data → scoring → ui-groups → ko → ui-nav
  → auth → scoreboard → close-porra → admin → bracket-results
```

## Bracket de Resultados — bracket-results.js (2026-04-13)

### Propósito
Vista "Resultados" en page-elim. Muestra el estado real del torneo KO sin pronósticos.
Se activa con el tab "Resultados" (reemplaza el antiguo tab "Bracket").

### Estructura de fases
```
BRK_PHASES: r32 → r16 → oct → qf → sf → final
BRK_COLS:
  r32: left=[73-80]  right=[81-88]   (16 partidos, IDs de BRACKET.r32)
  r16: left=[89-92]  right=[93-96]   (8 partidos,  IDs de BRACKET.r16)
  oct: left=[97,98]  right=[99,100]  (4 partidos,  IDs de BRACKET.qf)
  qf:  left=[101]    right=[102]     (2 partidos,  IDs de BRACKET.sf)
  sf:  left=[]       right=[]        (semis — vacío hasta que existan IDs)
  final: caja propia (no columna del bracket)
BRK_FINAL_ID = 104   (BRACKET.final[0].id)
BRK_THIRD_ID = 103   (BRACKET.third[0].id)
```

### Comportamiento
- Fases r32/r16/oct/qf/sf: muestra bracket simétrico izquierda/derecha
  - Fase activa: columna expandida con cards completas
  - Fases pasadas: columna estrecha con mini-scores
  - Fases futuras: columna ghost (siluetas semitransparentes)
- Fase "final": oculta el bracket, muestra `#brk-final-area` con caja
  horizontal (Final + 3er Puesto) similar a "Cerrar pronósticos"
- "Cerrar pronósticos" (#finalizar-section) se oculta automáticamente
  en esta vista (setView lo gestiona en ui-nav.js)

### Cards
- Hero: bandera equipo de fondo (blur/oscuro) + badge/escudo oficial centrado
- Score bar: marcador local:visitante
- Footer: venue + status badge (Finalizado/En vivo con minuto/Próximo/Por definir)
- BRK_BADGE_MAP: 42 slugs mapeados a ficheros en Supabase Storage /badges/

### Conexión con datos reales
```js
// brkLoadResults() lee:
window._results?.ko_results  // estructura: {"89":{local,visitante,estado,minuto},...}
// Si null → todos los partidos en estado 'upcoming' (correcto pre-torneo)
// Activar con pg_cron update-results el 11 jun 2026
```

### API pública
```js
window.initBracketResults()    // inicializa/re-renderiza el bracket
window.refreshBracketResults() // recarga _results y re-renderiza (llamado por admin.js)
window.brkSetPhase(id)         // navega entre fases: 'r32','r16','oct','qf','sf','final'
```

## Comandos útiles
```bash
npm run dev     # localhost:5173
npm run build   # genera dist/ — verificar antes de push a main
git add -A && git commit -m "..." && git push origin main
```

## Reglas CRÍTICAS
- NUNCA push a main sin validar en localhost:5173 primero
- Push inmediato tras cada commit — nunca acumular
- NO crear ni modificar vercel.json
- Actualizar migration-log.md tras cada acción importante
- Un commit por tarea/fix — mensajes descriptivos
- NO usar addEventListener DOMContentLoaded en classic scripts cargados via loadScript

## Patrón DOMContentLoaded en classic scripts
Los scripts en `public/js/*.js` se cargan via loadScript (async, post-parse).
`DOMContentLoaded` ya ha disparado cuando se evalúan. Patrón correcto:
```js
const runInit = () => { /* ... */ };
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runInit);
} else {
  runInit();
}
```

## Patrón diceSimulateMatch — CRÍTICO
Siempre mutar el objeto prediction con `Object.assign`, nunca reemplazar la referencia.
Los closures de `attachEvents` dependen de ella:
```js
// CORRECTO:
Object.assign(pred, { l, v, gol, saved: true, lockedByUser: true });
// MAL — rompe closures:
predictions[key] = { l, v, gol, saved: true };
```

## Patrón listeners attachEvents — CRÍTICO
Los listeners de `.sbn` y `gsel` en `attachEvents` deben leer `predictions[matchKey]`
en tiempo real dentro del listener, NO capturar `pred` como const en el closure:
```js
// CORRECTO — lee la referencia actual:
btn.addEventListener('click', () => {
  const p = predictions[matchKey];
  ...
});
// MAL — closure huérfano si loadUserData reemplaza el objeto:
const pred = predictions[matchKey];
btn.addEventListener('click', () => { pred.l = ...; });
```

## Patrón drawBracketLines
Llamar solo cuando el panel es visible. Desde `switchView('bracket')` con `rAF + 50ms`.

## Stack de infraestructura
- Hosting: Vercel (porramundial2026-seven.vercel.app) — autodeploy desde main
- DB + Auth: Supabase (proyecto: cmyfyswystjgzdwbqyyb)
- Secrets en Vault: GITHUB_TOKEN, GITHUB_REPO, ANTHROPIC_API_KEY

## Edge Functions Supabase
| EF | Versión | Descripción |
|---|---|---|
| admin-actions | v7 | Gestión admin (results/overrides/users/leagues/reopen). Requiere JWT admin |
| update-results | v2 | Sync football-data.org → tabla results. **Activar pg_cron el 11 jun 2026** |
| porra-orchestrator | v3 | N agentes Haiku en paralelo → orchestrator_jobs. Coste <$0.01 |
| porra-patch-deploy | v4 | Patches search/replace + commit GitHub |
| porra-fix-encoding | v5 | Write/inspect ficheros en GitHub via API |
| porra-github-pusher | v6 | PLACEHOLDER — ignorar |

## Sistema de agentes
```
Supervisor (Claude.ai) → porra-orchestrator EF → N Claude Haiku → orchestrator_jobs
```
Coste <$0.01. ANTHROPIC_API_KEY en Vault.
Invocar desde Claude.ai: Supabase MCP `execute_sql → net.http_post → SELECT FROM net._http_response WHERE id=N`

## Conectores Claude.ai activos
- **Supabase MCP**: execute_sql, get_logs, list/get/deploy_edge_function
- **Claude in Chrome**: navigate, screenshot, javascript_tool, read_console_messages, tabs_context_mcp

## Flujo QA con Claude in Chrome
```
1. tabs_context_mcp(createIfEmpty=true) → obtener tabId
2. navigate → localhost:5173 o producción
3. read_console_messages(onlyErrors) — debe ser []
4. Login local:  _porraDb.auth.signInWithPassword({email:window.__QA_EMAIL, password:window.__QA_PASS})
   Login prod:   _porraDb.auth.signInWithPassword({email:'cicloste88@gmail.com', password:'910500'})
5. showPage('elim') → activar panel view-bracket-results → initBracketResults()
6. Verificar: typeof initBracketResults, typeof brkSetPhase
7. Probar fases: ['r32','r16','oct','qf','sf','final'].forEach(id=>brkSetPhase(id))
8. Screenshot por sección
```

## Motor de puntuación
- Partido: +1 signo / +3 exacto (no acumula) / +2 goleador / +1 bonus vs IA (max 7pts)
- KO avance: grupos+5, r32+5, r16+10, qf+15, sf+20, campeón+25
- Clasificación final: campeón+30, subcampeón+20, 3º+15, 4º+10
- Premios: Balón/Bota/Guante Oro 15pts, Mejor Joven ≤21 20pts (en AWARDS_CFG)

## Estructura torneo
- 48 equipos, 12 grupos (A-L) de 4, 72 partidos grupos
- 2 primeros + 8 mejores terceros = 32 a eliminatorias
- R32 → R16 → QF → SF → 3er puesto → Final — 104 partidos total
- Resultados en tabla `results` (id=1), overrides via admin-actions

## Assets Supabase Storage (miniatures/)
```
badges/          — 42 escudos oficiales de selecciones (spain.png, germany.png, ...)
flags/           — banderas por código (ESP.png, GER.png, ...)
kits/            — equipaciones por slug/home|away.jpg
Logos/           — logos FIFA 2026 (general + por sede: Canada, Mexico, USA)
Ball/            — balón oficial Trionda
awards/          — trofeos individuales (ballon d'or, golden boot, golden glove, young)
MVP/             — imágenes jugadores MVP
```

## Pendientes antes del 11 jun 2026
| # | Tarea | Estado |
|---|---|---|
| 1 | Activar `pg_cron` para `update-results` el 11 jun | ⏳ |
| 2 | Actualizar `EQUIPOS[].players` con convocatorias reales | ⏳ jun |
| 3 | Desactivar signup público cuando entren todos los amigos | ⏳ |
| 4 | Email confirmación al cerrar porra (Resend + EF) | ⏳ |
| 5 | Verificar estructura JSON `_results.ko_results` con update-results real | ⏳ 11 jun |
| 6 | README — actualizar con URL Vercel (dice Netlify) | ⏳ |

## Historial de sesiones clave
| Fecha | Hito | Commit |
|---|---|---|
| 2026-04-11 | Migración Vite completa, merge a main, fix vercel.json MIME | — |
| 2026-04-12 AM | Extracción main.js en 5 módulos, fixes race condition y DOMContentLoaded | ee2e25a |
| 2026-04-12 PM | Bracket Fase 1 SVG overlay. Fix dado/undo Object.assign | 187a764 |
| 2026-04-13 | **Bracket de resultados reales** — bracket-results.js + CSS, 6 fases, cards badge+flag, vista Final en caja propia, QA local+producción OK | cd4afa2 |
| 2026-04-13 PM | **Splash screen** — inline script (fix timing), hero/scroll-cue reposicionados, márgenes móvil welcome | 3473c76 |
| 2026-04-13 PM | **Boost x2 completo** — comodín diario, Canvas 2D fuego, persistencia Supabase, puntuación x2, ticker jornadas, bloqueo eliminatorias/finalizar | 6c3d30b |
| 2026-04-13 PM | **Vista Jornada** — pestaña tarjetas compactas por día, sidebar clasificación sticky, boost CTA editable, scroll a tarjeta | 82b6a77 |

## Log de cambios (OBLIGATORIO)
Añadir línea a migration-log.md tras cada acción:
```
[HH:MM] ACCION: descripción — ficheros afectados
```
Nunca borrar entradas anteriores.
