// js/main-entry.js — punto de entrada Vite
import { createClient } from '@supabase/supabase-js'

// 1. Exponer Supabase ANTES de cargar auth.js y leagues.js
window.supabase = { createClient }

// 2. Exponer credenciales QA solo en dev
if (import.meta.env.DEV) {
  window.__QA_EMAIL = import.meta.env.VITE_QA_EMAIL
  window.__QA_PASS  = import.meta.env.VITE_QA_PASS
}

// 3. Cargar leagues y auth como scripts clasicos dinamicamente
//    (se ejecutan DESPUES de que window.supabase ya existe)
function loadScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement('script')
    s.src = src
    s.onload = resolve
    s.onerror = reject
    document.head.appendChild(s)
  })
}

// misc.js es autonomo (sin deps) → se carga en paralelo
loadScript('/js/misc.js')
  .catch(e => console.error('Error cargando misc.js:', e))

// Orden: leagues → data → scoring → ui-groups → main → auth → scoreboard → close-porra → admin
// - leagues PRIMERO: los classic scripts extraidos de main.js (ui-groups/main/etc)
//   pueden llamar leagueLoadMyLeagues/_myLeagues en top-level
// - data → scoring → ui-groups → main: classic scripts extraidos de main.js,
//   definen PARTIDOS, EQUIPOS, predictions, getMatchKey, etc.
//   Se cargan antes que auth para que onAuthStateChange callback encuentre
//   los simbolos cuando fire
// - auth → scoreboard → close-porra → admin: orden original preservado
loadScript('/js/leagues.js')
  .then(() => loadScript('/js/data.js'))
  .then(() => loadScript('/js/scoring.js'))
  .then(() => loadScript('/js/ui-groups.js'))
  .then(() => loadScript('/js/main.js'))
  .then(() => loadScript('/js/auth.js'))
  .then(() => loadScript('/js/scoreboard.js'))
  .then(() => loadScript('/js/close-porra.js'))
  .then(() => loadScript('/js/admin.js'))
  .catch(e => console.error('Error cargando modulos:', e))
