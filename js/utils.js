/* utils.js — Porra Mundial 2026
   Usa: (ninguna) · Expone: handleCTA, openAuthModal stub
   Notas: 8 líneas — absorber en auth.js al migrar a Vite
*/
// Shim temporal — las definiciones reales están al final del body tras el CDN
// Los onclick del HTML pueden llamar a estas funciones antes de que cargue el auth script
function handleCTA()        { window._pendingCTA = true; }
function openAuthModal(tab) { window._pendingAuth = tab; }
