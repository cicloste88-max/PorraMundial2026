/* auth.js — Porra Mundial 2026
   Usa: PARTIDOS, AW_PLAYERS (de data.js)
   Expone: db, SUPA_URL, SUPA_ANON, currentUser, loadUserData,
           doLogin, doLogout, doRegister, renderAuthBar, saveAwPicks,
           window._porraDb, window._porraToken
   Deps: Supabase CDN, data.js
   Notas: Inicializa el cliente Supabase. Cargar antes que leagues.js.
*/
/* ══════════════════════════════════════════════
   SUPABASE AUTH
══════════════════════════════════════════════ */
const SUPA_URL  = 'https://cmyfyswystjgzdwbqyyb.supabase.co';
window._supa_url  = SUPA_URL;
const SUPA_ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImNteWZ5c3d5c3RqZ3pkd2JxeXliIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ4NzU4MDcsImV4cCI6MjA5MDQ1MTgwN30.HtOTJ6VHXMStNH3ASLj5zDabViARzF6vJgHfeSytEKQ';
window._supa_anon = SUPA_ANON;
// Storage síncrono custom — persiste sesión en localStorage sin navigator locks
const _storage = {
  getItem: (key) => localStorage.getItem(key),
  setItem: (key, value) => localStorage.setItem(key, value),
  removeItem: (key) => localStorage.removeItem(key),
};
// Cliente AUTH — solo para autenticación (signIn, onAuthStateChange, getSession)
function getDb() {
  if (!window._porraDb) {
    window._porraDb = window.supabase.createClient(SUPA_URL, SUPA_ANON, {
      auth: { persistSession: true, storageKey: 'porra_auth', storage: _storage, autoRefreshToken: true, detectSessionInUrl: false }
    });
  }
  return window._porraDb;
}
// Cliente QUERY — para todos los from(...) de datos, bypasea getSession()/lock
function getQueryDb() {
  if (!window._porraQueryDb) {
    window._porraQueryDb = window.supabase.createClient(SUPA_URL, SUPA_ANON, {
      accessToken: async () => window._porraToken || '',
      auth: { persistSession: false }
    });
  }
  return window._porraQueryDb;
}
window._porraQueryDb = null;
// Proxy: db.auth → cliente auth, db.from(...) → cliente query
const db = new Proxy({}, {
  get(_, prop) {
    if (prop === 'auth') return getDb().auth;
    return getQueryDb()[prop];
  }
});
window._porraDb = window._porraDb || null;

let currentUser = null; // { id, email, nombre }

/* ── Escucha cambios de sesión ── */
async function loadUserData(userId) {
  const AW_P   = window.AW_PLAYERS        || [];
  const YOUNG_P = window.YOUNG_PLAYERS_NXGN || [];
  const allPlayers = [...AW_P, ...YOUNG_P];
  const leagueId = getActiveLeagueId();
  const [{ data: preds }, { data: koPreds }, { data: awData }, { data: lmData, error: lmErr }] = await Promise.all([
    leagueId
      ? db.from('predictions').select('*').eq('user_id', userId).eq('league_id', leagueId)
      : db.from('predictions').select('*').eq('user_id', userId).limit(0), // sin liga, sin datos
    leagueId
      ? db.from('ko_predictions').select('*').eq('user_id', userId).eq('league_id', leagueId)
      : db.from('ko_predictions').select('*').eq('user_id', userId).limit(0),
    leagueId
      ? db.from('award_picks').select('*').eq('user_id', userId).eq('league_id', leagueId).maybeSingle()
      : Promise.resolve({ data: null }),
    leagueId
      ? db.from('league_members').select('groups_saved').eq('user_id', userId).eq('league_id', leagueId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);
  if (preds && preds.length > 0) {
    preds.forEach(p => { predictions[p.match_id] = { l:p.local, v:p.visitante, gol:p.scorer, saved:true, lockedByUser:true }; });
    try { localStorage.setItem('porra_predictions', JSON.stringify(predictions)); } catch(e) {}
    // Re-renderizar tarjetas y tablas tras DOM listo (100ms para que initGrupos haya terminado)
    setTimeout(() => {
      PARTIDOS.forEach((match, idx) => {
        const key = getMatchKey(match);
        if (predictions[key]?.saved) {
          const slEl = document.getElementById('sl-' + idx);
          const svEl = document.getElementById('sv-' + idx);
          const gselEl = document.getElementById('gsel-' + idx);
          const pred = predictions[key];
          if (slEl) { slEl.textContent = pred.l; slEl.className = 'sbox on'; }
          if (svEl) { svEl.textContent = pred.v; svEl.className = 'sbox on'; }
          if (gselEl && pred.gol) gselEl.value = pred.gol;
          if (typeof updateCardUI === 'function' && document.getElementById('spill-' + idx)) updateCardUI(idx, match);
        }
      });
      // Re-renderizar todas las tablas de clasificación de grupos
      if (typeof refreshGroupTables === 'function') refreshGroupTables();
    }, 100);
    // Segunda pasada a 600ms — por si initGrupos tardó más (12 grupos con setTimeout encadenados)
    setTimeout(() => {
      if (typeof refreshGroupTables === 'function') refreshGroupTables();
    }, 600);
  }
  if (koPreds && koPreds.length > 0) {
    koPreds.forEach(p => {
      koPredictions[p.match_id] = { l:p.local, v:p.visitante, classifier:p.classifier, gol:p.scorer, saved:true };
      koPredictions[String(p.match_id)] = koPredictions[p.match_id];
    });
    try { localStorage.setItem('porra_ko_predictions', JSON.stringify(koPredictions)); } catch(e) {}
  }
  if (awData) {
    ['golden_ball','golden_boot','golden_glove','young_player'].forEach(award => {
      if (awData[award]) { const p = allPlayers.find(p=>p.key===awData[award]); if(p) awPicks[award]=p; }
    });
    try { localStorage.setItem('porra_aw_picks', JSON.stringify(awPicks)); } catch(e) {}
    // Marcar como guardado y refrescar UI
    window._awPicksSaved = true;
    if (typeof window._renderBox4 === 'function') window._renderBox4();
  }

  // Sincronizar groups_saved (tarjetas bloqueadas en vista focus móvil) desde BD
  if (lmErr) {
    console.warn('Error cargando league_members.groups_saved:', lmErr.message || lmErr);
    window.groupSaved = window.groupSaved || {};
  } else if (lmData && lmData.groups_saved && typeof lmData.groups_saved === 'object') {
    window.groupSaved = lmData.groups_saved;
  } else {
    window.groupSaved = window.groupSaved || {};
  }

  // Tras cargar todos los datos, re-evaluar la sección de cerrar porra
  // Usamos setTimeout para dejar que el DOM se actualice primero
  setTimeout(() => {
    if (typeof checkFinalizarReady === 'function') checkFinalizarReady();
  }, 200);
}

function saveAwPicks() {
  try { localStorage.setItem('porra_aw_picks', JSON.stringify(awPicks)); } catch(e) {}
  if (currentUser && window._porraDb) {
    if (window._porraCerrada) return; // porra cerrada — no escribir en DB
    const leagueId = getActiveLeagueId();
    if (!leagueId) return;
    const row = { user_id:currentUser.id, league_id:leagueId, golden_ball:awPicks.golden_ball?.key||null, golden_boot:awPicks.golden_boot?.key||null, golden_glove:awPicks.golden_glove?.key||null, young_player:awPicks.young_player?.key||null };
    getQueryDb().from('award_picks').upsert(row,{onConflict:'league_id,user_id'})
      .then(({error})=>{
        if(error) console.warn('Error award_picks:',error.message);
        else if(typeof checkFinalizarReady==='function') checkFinalizarReady();
      });
  }
}

// onAuthStateChange se registra dentro de runAuthInit() para garantizar
// que todos los scripts de la cadena ya están cargados

/* ── Renderiza la barra de sesión (top-right) ── */
function renderAuthBar() {
  const bar      = document.getElementById('wc-auth-bar');
  const gruposBar = document.getElementById('grupos-user-bar');
  const elimBar  = document.getElementById('elim-user-bar');
  if (currentUser) {
    const inicial = currentUser.nombre.charAt(0).toUpperCase();
    const adminBtn = currentUser.is_admin
      ? `<button onclick="event.stopPropagation();showPage('admin')" style="background:#1e1b4b;border:1px solid #3730a3;color:#a5b4fc;font-size:10px;font-weight:700;padding:4px 9px;border-radius:6px;cursor:pointer;letter-spacing:.04em;font-family:'Inter',sans-serif">⚙ ADMIN</button>`
      : '';
    const badgeHtml = `<div style="display:flex;align-items:center;gap:6px">${adminBtn}<div class="wc-user-badge" style="display:flex;align-items:center;gap:8px;background:rgba(17,19,24,.9);border:1px solid #27272a;border-radius:24px;padding:5px 12px 5px 7px"><div class="wc-user-avatar">${inicial}</div><span class="wc-user-name">${escapeHtml(currentUser.nombre)}</span></div><button class="wc-logout-btn do-logout">Cerrar sesión</button></div>`;
    if (bar)      bar.innerHTML      = badgeHtml;
    if (gruposBar) gruposBar.innerHTML = badgeHtml;
    if (elimBar)  elimBar.innerHTML  = badgeHtml;
  } else {
    const loginHtml = `<button class="wc-login-btn-bar do-login">Iniciar sesión</button>`;
    if (bar)      bar.innerHTML      = loginHtml;
    if (gruposBar) gruposBar.innerHTML = '';
    if (elimBar)  elimBar.innerHTML  = '';
  }
}
// Event delegation unificado — logout, login y cierre de popover
// capture:true para que funcione en Safari iOS con elementos sticky/backdrop
document.addEventListener('click', e => {
  // Logout / Login
  if (e.target.closest('.do-logout')) { doLogout(); return; }
  if (e.target.closest('.do-login'))  { openAuthModal('login'); return; }
  // Cerrar popovers de ronda al hacer click fuera
  if (!e.target.closest('.round-info-btn') && !e.target.closest('.round-popover')) {
    document.querySelectorAll('.round-popover.open').forEach(p => p.classList.remove('open'));
    document.querySelectorAll('.round-info-btn.active').forEach(b => b.classList.remove('active'));
  }
}, true);

/* ── Actualiza los CTAs de la welcome ── */
function updateCTAs() {
  const heroCTA   = document.getElementById('hero-cta-btn');
  const bottomCTA = document.getElementById('bottom-cta-btn');
  if (currentUser) {
    if (heroCTA)   { heroCTA.textContent   = '⚽  Elegir liga';           heroCTA.onclick   = () => getActiveLeagueId() ? showPage('grupos') : showPage('welcome'); }
    if (bottomCTA) { bottomCTA.textContent = '⚽  Elegir liga';           bottomCTA.onclick = () => getActiveLeagueId() ? showPage('grupos') : showPage('welcome'); }
  } else {
    if (heroCTA)   { heroCTA.textContent   = '⚽  Iniciar sesión';        heroCTA.onclick   = () => openAuthModal('login'); }
    if (bottomCTA) { bottomCTA.textContent = '⚽  Iniciar sesión';        bottomCTA.onclick = () => openAuthModal('login'); }
  }
}

/* ── Abrir / cerrar modal ── */
function openAuthModal(tab = 'login') {
  switchAuthTab(tab);
  document.getElementById('auth-overlay').classList.add('open');
  document.getElementById('auth-msg').textContent = '';
  setTimeout(() => {
    const first = tab === 'login'
      ? document.getElementById('login-email')
      : document.getElementById('reg-nombre');
    if (first) first.focus();
  }, 300);
}
function closeAuthModal() {
  document.getElementById('auth-overlay').classList.remove('open');
}
function switchAuthTab(tab) {
  document.getElementById('auth-login-form').style.display    = tab === 'login'    ? 'block' : 'none';
  document.getElementById('auth-register-form').style.display = tab === 'register' ? 'block' : 'none';
  document.getElementById('tab-login').classList.toggle('active', tab === 'login');
  document.getElementById('tab-register').classList.toggle('active', tab === 'register');
  document.getElementById('auth-msg').textContent = '';
}

/* ── Botón CTA (comportamiento según sesión) ── */
function handleCTA() {
  if (currentUser) {
    // Con sistema de ligas: ir a welcome para elegir/ver ligas
    // Si ya hay liga activa, ir directamente a grupos
    if (getActiveLeagueId()) showPage('grupos');
    else showPage('welcome');
  } else openAuthModal('login');
}

/* ── Mensaje de feedback en modal ── */
function setAuthMsg(msg, type = 'error') {
  const el = document.getElementById('auth-msg');
  el.textContent = msg;
  el.className = 'auth-msg ' + type;
}
function setAuthLoading(btnId, loading) {
  const btn = document.getElementById(btnId);
  btn.disabled = loading;
  btn.textContent = loading ? 'Un momento…' : (btnId === 'login-btn' ? 'Entrar' : 'Crear cuenta');
}

/* ── Login ── */
async function doLogin() {
  const email = document.getElementById('login-email').value.trim();
  const pass  = document.getElementById('login-pass').value;
  if (!email || !pass) return setAuthMsg('Rellena email y contraseña.');
  setAuthLoading('login-btn', true);
  const { error } = await db.auth.signInWithPassword({ email, password: pass });
  setAuthLoading('login-btn', false);
  if (error) {
    setAuthMsg(error.message.includes('Invalid') ? 'Email o contraseña incorrectos.' : error.message);
  } else {
    setAuthMsg('¡Bienvenido! Cargando…', 'ok');
    setTimeout(() => { closeAuthModal(); showPage('welcome'); }, 800);
  }
}

/* ── Registro ── */
async function doRegister() {
  const nombre = document.getElementById('reg-nombre').value.trim();
  const email  = document.getElementById('reg-email').value.trim();
  const pass   = document.getElementById('reg-pass').value;
  if (!nombre) return setAuthMsg('Introduce tu nombre.');
  if (!email)  return setAuthMsg('Introduce tu email.');
  if (pass.length < 6) return setAuthMsg('La contraseña debe tener al menos 6 caracteres.');
  setAuthLoading('register-btn', true);
  const { data, error } = await db.auth.signUp({ email, password: pass });
  if (error) {
    setAuthLoading('register-btn', false);
    return setAuthMsg(error.message.includes('already') ? 'Este email ya está registrado.' : error.message);
  }
  // Actualizar nombre en profiles (el trigger crea la fila con email, la actualizamos)
  if (data?.user) {
    await db.from('profiles').update({ nombre }).eq('id', data.user.id);
  }
  setAuthLoading('register-btn', false);
  setAuthMsg('¡Cuenta creada! Ya puedes entrar.', 'ok');
  setTimeout(() => switchAuthTab('login'), 1200);
}

/* ── Logout ── */
async function doLogout() {
  // Limpiar localStorage inmediatamente — no esperar a Supabase
  Object.keys(localStorage)
    .filter(k => k.includes('porra_') || k.includes('supabase'))
    .forEach(k => localStorage.removeItem(k));
  // signOut en background — si tarda o falla, igual recargamos
  const _db = window._porraDb || db;
  try {
    await Promise.race([
      _db.auth.signOut(),
      new Promise(r => setTimeout(r, 1500)) // máximo 1.5s de espera
    ]);
  } catch(_) {}
  window.location.reload();
}

// Exponer funciones de auth como globales accesibles desde onclick inline
window.doLogout=doLogout; window.doLogin=doLogin; window.doRegister=doRegister;
window.openAuthModal=openAuthModal; window.closeAuthModal=closeAuthModal;
window.switchAuthTab=switchAuthTab; window.handleCTA=handleCTA; window.saveAwPicks=saveAwPicks;

// Notificar que las funciones de auth ya están disponibles
document.dispatchEvent(new Event('authReady'));
// auth.js se carga via loadScript chain DESPUES de DOMContentLoaded,
// asi que addEventListener('DOMContentLoaded', ...) nunca ejecutaria.
// Detectar readyState y correr inmediato si ya esta listo.
const runAuthInit = async () => {
  // Cargar caché local mientras llega la sesión de Supabase
  try {
    const gp = localStorage.getItem('porra_predictions');
    if (gp) { const p = JSON.parse(gp); Object.assign(predictions, p); }
    loadBoostPicks();
    const kp = localStorage.getItem('porra_ko_predictions');
    if (kp) { koPredictions = JSON.parse(kp); normKoPredictions(); }
  } catch(e) {}

  // Registrar listener AHORA que todos los scripts están cargados
  db.auth.onAuthStateChange(async (event, session) => {
    if (session?.user) {
      window._porraToken = session.access_token; sessionStorage.setItem("porra_token", session.access_token);
      const { data: profile } = await db.from('profiles').select('nombre,is_admin').eq('id', session.user.id).single();
      currentUser = { id:session.user.id, email:session.user.email, nombre:profile?.nombre||session.user.email.split('@')[0], is_admin:profile?.is_admin||false };
      if (event === 'SIGNED_IN' || event === 'INITIAL_SESSION') {
        await loadUserData(session.user.id);

        // Restaurar última página SOLO en refresh (INITIAL_SESSION).
        // En login fresco (SIGNED_IN) vamos a welcome por semántica.
        let target = null;
        if (event === 'INITIAL_SESSION') {
          target = window._pendingPageRestore;
          window._pendingPageRestore = null;
        }

        const finalPage = (target === 'admin' && !currentUser.is_admin)
          ? 'welcome'
          : (target || 'welcome');
        setTimeout(() => showPage(finalPage), 100);
      }
    } else {
      currentUser = null;
      window._porraToken = null; sessionStorage.removeItem("porra_token");
      // v2.7: si skipeamos welcome esperando restaurar y no hay sesion valida, mostrar welcome ahora
      if (window._pendingPageRestore) {
        window._pendingPageRestore = null;
        showPage('welcome');
        initWelcome();
      }
    }
    renderAuthBar();
    updateCTAs();
  });

  // v2.7: si hay pagina pendiente de restaurar tras F5, no mostrar welcome
  // al arranque. onAuthStateChange decidira que mostrar cuando cargue sesion.
  if (!window._pendingPageRestore) {
    showPage('welcome');
    initWelcome();
  }
  renderAuthBar();
  updateCTAs();
};
if (document.readyState === 'complete') {
  runAuthInit();
} else {
  window.addEventListener('load', runAuthInit, { once: true });
}

// Procesar llamadas que llegaron antes de que cargara el auth
if (window._pendingAuth) { openAuthModal(window._pendingAuth); window._pendingAuth = null; }
if (window._pendingCTA)  { handleCTA(); window._pendingCTA = false; }
