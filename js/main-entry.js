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

// Orden: leagues → data → scoring → ui-groups → ko → ui-nav → auth → scoreboard → close-porra → admin
// main.js eliminado tras extraccion completa en 5 sub-bloques (data, scoring,
// ui-groups, ko, ui-nav). Cada sub-bloque es un classic script independiente.
//
// - leagues PRIMERO: los classic scripts extraidos pueden llamar
//   leagueLoadMyLeagues/_myLeagues en top-level
// - data → scoring → ui-groups → ko → ui-nav: los 5 sub-bloques de lo que
//   antes era main.js (PARTIDOS, EQUIPOS, predictions, BRACKET, showPage,
//   initWelcome, etc.). Se cargan antes que auth
// - auth → scoreboard → close-porra → admin: orden original preservado
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
    // Safety net: garantizar que la UI welcome arranca tras cargar toda
    // la chain. Idempotente con el fix readyState de auth.js — si auth.js
    // ya llamo a initWelcome, la segunda llamada solo reconstruye los
    // contenedores con el mismo contenido (no-op visible).
    if (typeof window.initWelcome === 'function') window.initWelcome();
    if (typeof window.showPage === 'function') window.showPage('welcome');
    if (typeof window.renderAuthBar === 'function') window.renderAuthBar();
  })
  .catch(e => console.error('Error cargando modulos:', e))
