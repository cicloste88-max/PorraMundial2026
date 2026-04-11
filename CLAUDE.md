# Porra Mundial 2026 — Contexto para Claude Code

## Proyecto
App de pronósticos del Mundial 2026. Stack: HTML+CSS+JS vanilla, Supabase, Netlify.
Producción: tumundial.netlify.app
Repo: github.com/cicloste88-max/PorraMundial2026
Rama activa: vite-migration

## Estado actual (abril 2026)
Migración a Vite **COMPLETA** (QA validado 2026-04-11). Todos los módulos JS
del CLAUDE.md están fuera del index.html y se cargan dinámicamente desde
main-entry.js. El único script clásico que sigue inline en index.html es
main.js (~3250 líneas, excluido por tema de CRLF).
- js/main-entry.js como entry point (type="module")
- Supabase via npm, carga dinámica con loadScript()
- QA login con .env.local (VITE_QA_EMAIL / VITE_QA_PASS)

## Estructura ficheros JS
```
js/
  main-entry.js   ← entry point Vite — MODIFICAR AQUÍ para añadir módulos
  main.js         ← datos + scoring + UI (~3250 líneas, sigue inline en index.html por CRLF)
  auth.js         ← auth Supabase (migrado)
  leagues.js      ← ligas (migrado)
  misc.js         ← utils UI (migrado)
  scoreboard.js   ← clasificación (migrado)
  close-porra.js  ← cierre pronósticos (migrado)
  admin.js        ← panel admin + dados + lockAllCardsIfCerrada (migrado)
```

## main-entry.js actual (estado tras migración completa)
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
// misc.js es autónomo — en paralelo
loadScript('/js/misc.js').catch(e => console.error('misc.js:', e))

// Cadena con dependencias: leagues → auth → scoreboard → close-porra → admin
loadScript('/js/leagues.js')
  .then(() => loadScript('/js/auth.js'))
  .then(() => loadScript('/js/scoreboard.js'))
  .then(() => loadScript('/js/close-porra.js'))
  .then(() => loadScript('/js/admin.js'))
  .catch(e => console.error('Error cargando modulos:', e))
```

## Patrón de migración (seguir EXACTAMENTE)
Para cada módulo pendiente:
1. Leer js/[modulo].js para entender sus dependencias
2. Buscar el bloque inline en index.html con el comentario "Archivo destino : [modulo].js"
3. Eliminar ese bloque <script>...</script> completo del index.html
4. Añadir loadScript('/js/[modulo].js') al final de la cadena en main-entry.js
5. Verificar que el fichero js/[modulo].js ya existe y tiene el mismo contenido
6. Hacer commit individual por módulo

## Orden de carga actual (CRÍTICO — respetar dependencias)
- misc: en paralelo (sin deps)
- Cadena secuencial: leagues → auth → scoreboard → close-porra → admin

## Cómo identificar el bloque inline en index.html
Buscar: "Archivo destino : scoreboard.js" (o close-porra.js, admin.js)
El bloque empieza con el comentario <!-- === y termina con </script>

## Reglas importantes
- NUNCA tocar main (rama principal) ni Netlify — solo vite-migration
- Los scripts clásicos ejecutan ANTES que módulos ES — loadScript() resuelve esto
- js/main.js NO se puede importar como módulo ES (tiene CRLF) — dejarlo como está
- Un commit por módulo migrado
- Mensaje de commit: "feat: migrar [modulo].js — eliminar inline, carga dinámica"

## Comandos útiles
```bash
npm run dev   # localhost:5173
git add -A && git commit -m "..." && git push origin vite-migration
```

## Tarea actual
Migración Vite completa. No hay módulos pendientes del CLAUDE.md.
Próximos pasos posibles (a petición del usuario):
- Extraer main.js inline del index.html (requiere resolver tema CRLF)
- Extraer dice.js como módulo separado de admin.js (ya estaba anotado en el
  propio bloque con "Archivo destino : dice.js" pero queda dentro de admin.js
  por ahora)
- Validar `npm run build` para producción

## Log de cambios (OBLIGATORIO)
Tras cada acción importante (modificar fichero, eliminar bloque, commit, resolver bug),
añade una línea al fichero `migration-log.md` en la raíz del proyecto con este formato:

```
[HH:MM] ACCIÓN: descripción breve — ficheros afectados
```

Ejemplos:
```
[11:32] ELIMINAR: bloque inline scoreboard.js del index.html — index.html
[11:33] AÑADIR: loadScript('/js/scoreboard.js') a main-entry.js — js/main-entry.js
[11:34] COMMIT: feat: migrar scoreboard.js
[11:35] BUG: leagueSelect no responde — investigando js/leagues.js
[11:38] FIX: leagueSelect restaurado en window — js/close-porra.js línea 12
```

Si migration-log.md no existe, créalo. Nunca borres entradas anteriores.
