# Porra Mundial 2026 — Contexto para Claude Code

## Proyecto
App de pronósticos del Mundial 2026. Stack: HTML+CSS+JS vanilla, Supabase, Vite, Vercel.
**Producción: porramundial2026-seven.vercel.app**
Repo: github.com/cicloste88-max/PorraMundial2026
Rama activa: **main** (vite-migration ya mergeada)

## Estado actual (abril 2026)
**Migración Vite COMPLETA.** Deploy en Vercel operativo. Último commit: 7df47ab.

- Todos los módulos JS en `public/js/` (scripts clásicos, cargados via loadScript)
- `js/main-entry.js` como entry point Vite (type="module", importa Supabase npm)
- Build: `npm run build` genera `dist/` con `assets/` + `js/`
- QA login con `.env.local` (VITE_QA_EMAIL / VITE_QA_PASS)
- `vercel.json` eliminado — causaba MIME text/html en .js (rompía módulos ES)
- BOM UTF-8 en index.html — emojis correctos en producción

## Estructura ficheros JS
```
js/
  main-entry.js     <- entry point Vite (type=module) — importa Supabase npm
public/js/
  main.js           <- datos + scoring + UI (~3250 líneas, script clásico)
  auth.js           <- auth Supabase
  leagues.js        <- ligas y selección de porra
  misc.js           <- utils UI (sin deps, carga en paralelo)
  scoreboard.js     <- clasificación
  close-porra.js    <- cierre de pronósticos
  admin.js          <- panel admin + dados/simulador + lockAllCardsIfCerrada
```

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
// misc.js es autónomo — carga en paralelo
loadScript('/js/misc.js').catch(e => console.error('misc.js:', e))

// Cadena con dependencias
loadScript('/js/leagues.js')
  .then(() => loadScript('/js/auth.js'))
  .then(() => loadScript('/js/scoreboard.js'))
  .then(() => loadScript('/js/close-porra.js'))
  .then(() => loadScript('/js/admin.js'))
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
- Actualizar migration-log.md tras cada acción importante
- Un commit por tarea/fix — mensajes descriptivos

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
1. Bug updateCardUI en auth.js:64 — TypeError tarjetas no en DOM al cargar. No bloquea. Fix pendiente.
2. Activar pg_cron update-results el 11 jun
3. Seguridad auth: autoconfirm off, pwd min 8, enable_signup false
4. Email confirmacion al cerrar porra (Resend + EF)
5. README — actualizar con URL Vercel

## Log de cambios (OBLIGATORIO)
Añadir línea a migration-log.md tras cada accion:
[HH:MM] ACCION: descripcion — ficheros afectados
Nunca borrar entradas anteriores.