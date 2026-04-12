# Porra Mundial 2026 — Contexto para Claude Code

## Proyecto
App de pronósticos del Mundial 2026. Stack: HTML+CSS+JS vanilla, Supabase, Vite, Vercel.
**Producción: porramundial2026-seven.vercel.app**
Repo: github.com/cicloste88-max/PorraMundial2026
Rama activa: **main** (vite-migration ya mergeada)

## Estado actual (2026-04-12)
**Migración Vite COMPLETA + extracción de main.js COMPLETA.** Deploy en Vercel operativo. Último commit: **744d3f4**.

- Todos los módulos JS en `public/js/` (scripts clásicos, cargados via loadScript)
- `main.js` ELIMINADO del repo — dividido en 5 sub-módulos (data, scoring, ui-groups, ko, ui-nav)
- `js/main-entry.js` como entry point Vite (type="module", importa Supabase npm)
- Build: `npm run build` genera `dist/` con `assets/` + `js/` (11 classic scripts + 1 bundle)
- QA login con `.env.local` (VITE_QA_EMAIL / VITE_QA_PASS)
- `vercel.json` eliminado — causaba MIME text/html en .js (rompía módulos ES)
- BOM UTF-8 en index.html — emojis correctos en producción
- Bug patrón `DOMContentLoaded` dead-code handler resuelto (ver sección Patrones)

## Estructura ficheros JS
```
js/
  main-entry.js     <- entry point Vite (type=module) — importa Supabase npm
public/js/
  data.js           <- datos torneo + estado global + utils (215 lineas, 12 decls)
                      SB, EQUIPOS, GRUPOS, PARTIDOS, KIT_OVERRIDES,
                      predictions, iaPredictions, totalPoints,
                      getMatchKey, getMySign, iaBonusWillApply, escapeHtml
  scoring.js        <- motor puntos + tabla + tarjetas + premios (1184 lineas, 50 decls)
                      KO_ROUND_PTS, FINAL_CLASSIFICATION_PTS, calc*, AWARDS_CFG,
                      AW_PLAYERS, YOUNG_PLAYERS_NXGN, CLASSIFICATION_PTS, renderAll,
                      refreshGroupTables, updateCardUI, openPicker, selectAward
  ui-groups.js      <- init grupos (167 lineas, 3 decls)
                      initGrupos, savePredictions, checkGroupsComplete
  ko.js             <- bracket KO + IA (1048 lineas, 28 decls)
                      BRACKET, koPredictions, ROUND_CONFIG, ROUND_BREAKDOWN,
                      BADGE_MAP, areGroupsComplete, buildBracketView,
                      fetchIAforKO, findMatch, getTeamForSlot, saveKO,
                      normKoPredictions, ...
  ui-nav.js         <- SPA nav + modal + welcome (653 lineas, 17 decls)
                      showPage, openModal, closeModal, initWelcome,
                      updateAwardsFooter, renderPickerList, koInit,
                      refreshAllViews, fetchIAforKO, showIAresultInModal
  auth.js           <- auth Supabase (doLogin, doRegister, onAuthStateChange,
                      loadUserData, renderAuthBar, updateCTAs)
  leagues.js        <- ligas y seleccion de porra (leagueLoadMyLeagues,
                      leagueSelect, getActiveLeagueId, _myLeagues via getter)
  misc.js           <- utils UI (sin deps, carga en paralelo)
  scoreboard.js     <- clasificacion multi-usuario
  close-porra.js    <- cierre de pronosticos (checkFinalizarReady, finalizarPorra)
  admin.js          <- panel admin + dados/simulador + lockAllCardsIfCerrada
```

Total extraido de main.js: 3267 lineas, 110 decls top-level, 0 solapes entre ficheros.

## Cadena de carga en main-entry.js
```js
import { createClient } from '@supabase/supabase-js'
window.supabase = { createClient }
if (import.meta.env.DEV) {
  window.__QA_EMAIL = import.meta.env.VITE_QA_EMAIL
  window.__QA_PASS  = import.meta.env.VITE_QA_PASS
}
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src; s.onload = resolve; s.onerror = reject
    document.head.appendChild(s)
  })
}
// misc.js es autonomo — carga en paralelo
loadScript('/js/misc.js').catch(e => console.error('misc.js:', e))

// Cadena con dependencias (orden CRITICO):
// - leagues PRIMERO: los classic scripts extraidos pueden llamar
//   leagueLoadMyLeagues/_myLeagues en top-level
// - data -> scoring -> ui-groups -> ko -> ui-nav: los 5 sub-modulos de
//   lo que antes era main.js. Se cargan antes que auth para que
//   onAuthStateChange callback encuentre PARTIDOS, predictions, etc.
//   cuando fire.
// - auth -> scoreboard -> close-porra -> admin: orden original
loadScript('/js/leagues.js')
  .then(() => loadScript('/js/data.js'))
  .then(() => loadScript('/js/scoring.js'))
  .then(() => loadScript('/js/ui-groups.js'))
  .then(() => loadScript('/js/ko.js'))
  .then(() => loadScript('/js/ui-nav.js'))
  .then(() => loadScript('/js/auth.js'))
  .then(() => loadScript('/js/scoreboard.js'))
  .then(() => loadScript('/js/close-porra.js'))
  .then(() => loadScript('/js/admin.js'))
  .then(() => {
    // Safety net: garantiza que la UI welcome arranca tras cargar toda
    // la chain. Idempotente con el readyState check de auth.js.
    if (typeof window.initWelcome === 'function') window.initWelcome();
    if (typeof window.showPage === 'function') window.showPage('welcome');
    if (typeof window.renderAuthBar === 'function') window.renderAuthBar();
  })
  .catch(e => console.error('Error cargando modulos:', e))
```

## Comandos útiles
```bash
npm run dev     # localhost:5173
npm run build   # genera dist/ — verificar antes de push a main
git add -A && git commit -m "..." && git push origin main
```

## Reglas CRITICAS
- NUNCA push a main sin validar en localhost:5173 primero
- Push inmediato tras cada commit — nunca acumular
- NO crear ni modificar vercel.json — Vercel sirve MIME correctamente por defecto
- Actualizar migration-log.md tras cada accion importante
- Un commit por tarea/fix — mensajes descriptivos
- NO usar addEventListener DOMContentLoaded en classic scripts cargados
  via loadScript — ver seccion Patrones abajo

## Patrones — Bug DOMContentLoaded dead-code handler

**Problema**: los classic scripts en `public/js/*.js` se cargan via loadScript
chain en `main-entry.js`, que es un modulo ES diferido. La chain arranca DESPUES
del parseo del HTML y se ejecuta async. Cuando un script se evalua via loadScript,
`DOMContentLoaded` **ya ha disparado** hace ~100-300ms.

Codigo asi es DEAD CODE:
```js
document.addEventListener('DOMContentLoaded', () => {
  initWelcome();  // NUNCA se ejecuta
});
```

Fix correcto — chequear readyState antes de attach:
```js
const runInit = () => { initWelcome(); /* ... */ };
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runInit);
} else {
  runInit();  // DOM ya listo, correr inmediato
}
```

Safety net adicional en el `.then()` final de la loadScript chain de
main-entry.js — garantiza que la UI welcome arranca tras cargar toda la chain
aunque el readyState check falle por algun edge case. Las funciones llamadas
por el safety net deben ser IDEMPOTENTES (guard `if (window._xInited) return`).

Casos conocidos ya arreglados: `initWelcome` (commit 744d3f4), `checkFinalizarReady`
(commit d81f2dd via exports explicitos en close-porra.js).

Si apareciera otra funcion con sintoma similar (no se ejecuta tras login), buscar
si su unico call site esta dentro de un `DOMContentLoaded` handler.

## Stack de infraestructura
- Hosting: Vercel (porramundial2026-seven.vercel.app) — autodeploy desde main
- DB + Auth: Supabase (proyecto: cmyfyswystjgzdwbqyyb)
- Secrets en Vault: GITHUB_TOKEN, GITHUB_REPO, ANTHROPIC_API_KEY

## Edge Functions Supabase
- admin-actions v7: gestión admin (results/overrides/users/leagues/reopen). Requiere JWT admin
- update-results v2: sync football-data.org. Activar pg_cron el 11 jun 2026
- porra-orchestrator v3: N agentes Haiku en paralelo → orchestrator_jobs
- porra-patch-deploy v4: patches search/replace + commit GitHub
- porra-fix-encoding v5: write/inspect ficheros en GitHub via API
- porra-github-pusher v6: PLACEHOLDER — ignorar

## Sistema de agentes
Supervisor (Claude.ai) → porra-orchestrator EF → N Claude Haiku en paralelo → orchestrator_jobs
Coste < $0.01. ANTHROPIC_API_KEY en Vault.
Para invocar desde Claude.ai: Supabase MCP execute_sql → net.http_post → SELECT FROM net._http_response WHERE id=N

## Conectores Claude.ai
- Supabase MCP: execute_sql, get_logs, list/get/deploy_edge_function
- Claude in Chrome: navigate, screenshot, javascript_tool, read_console_messages, tabs_context_mcp

## Flujo QA con Claude in Chrome
1. tabs_context_mcp → obtener tabId
2. navigate → localhost:5173 o producción
3. read_console_messages(onlyErrors)
4. Login: doLogin(window.__QA_EMAIL, window.__QA_PASS) via javascript_tool
5. Verificar: typeof doLogin, admInit, getActiveLeagueId, _porraDb
6. Screenshot por sección

## Motor de puntuación
- Partido: +1 signo / +3 exacto (no acumula) / +2 goleador / +1 bonus vs IA (max 7pts)
- KO avance: grupos+5, r32+5, r16+10, qf+15, sf+20, campeon+25
- Clasificacion final: campeon+30, subcampeon+20, 3o+15, 4o+10
- Premios: Balon/Bota/Guante Oro 15pts, Mejor Joven 21 20pts (en AWARDS_CFG)

## Estructura torneo
- 48 equipos, 12 grupos (A-L) de 4, 72 partidos grupos
- 2 primeros + 8 mejores terceros = 32 a eliminatorias
- R32, R16, QF, SF, 3er puesto, Final — 104 partidos total
- Resultados en tabla `results`, overrides via admin-actions

## Pendientes antes del 11 jun 2026
1. Activar pg_cron update-results el 11 jun
2. Seguridad auth: autoconfirm off, pwd min 8, enable_signup false
3. Email confirmacion al cerrar porra (Resend + EF)
4. README — actualizar con URL Vercel (actualmente dice Netlify)

Sin pendientes criticos. Bugs recientes resueltos en esta sesion:
- updateCardUI TypeError (commit ee2e25a): early-return si tarjeta no en DOM
- checkFinalizarReady/finalizarPorra undefined (commit d81f2dd): exports
  explicitos en close-porra.js + eliminacion de bloque exports dead-code
- initWelcome nunca ejecutaba (commit 744d3f4): readyState check + safety net
- Venues gallery vacia (mismo 744d3f4): consecuencia del initWelcome fix

## Log de cambios (OBLIGATORIO)
Añadir línea a migration-log.md tras cada accion:
[HH:MM] ACCION: descripcion — ficheros afectados
Nunca borrar entradas anteriores.