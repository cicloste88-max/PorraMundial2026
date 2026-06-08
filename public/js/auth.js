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

/* ── Bootstrap IA Predictor (Fase F) ──
   Lee el snapshot activo + predicciones de fase de grupos ya computadas
   (cron 11 jun 00:10 o compute_match on-demand). Reindexa por legacyKey
   (${group}_${home_es}_${away_es}) para que encaje con getMatchKey(match)
   que usan scoring.js y data.js. */
async function loadIAPredictions() {
  try {
    const { data: snap } = await db.from('ia_snapshots')
      .select('id').eq('is_active', true).maybeSingle();
    if (!snap?.id) return {};
    // A.2 — exponer el snapshot activo para que los lookups KO on-demand
    // (v3RenderIABlock / v3FetchIAOnDemand) usen el sufijo correcto y no el
    // hardcoded _2. Mata la bomba de tiempo cuando se cree un snapshot nuevo.
    try { window._iaActiveSnapshotId = snap.id; } catch (_) {}
    const [{ data: preds }, matchesJson] = await Promise.all([
      db.from('ia_predictions')
        .select('match_id, sign, confidence, breakdown, used_fallback')
        .eq('snapshot_id', snap.id),
      fetch('/data/worldcup-2026-matches.json')
        .then(r => r.ok ? r.json() : {})
        .catch(() => ({})),
    ]);
    if (!preds || preds.length === 0) return {};
    const legacyByMatchId = {};
    for (const [mid, m] of Object.entries(matchesJson || {})) {
      if (m?.group && m?.home_es && m?.away_es) {
        legacyByMatchId[mid] = `${m.group}_${m.home_es}_${m.away_es}`;
      }
    }
    const out = {};
    for (const p of preds) {
      const key = legacyByMatchId[p.match_id] || p.match_id;
      const b = p.breakdown || {};
      out[key] = {
        sign: p.sign,
        confidence: p.confidence,
        quip: b.quip || '',
        is_dudoso: !!b.is_dudoso,
        p_home: b.p_home,
        p_draw: b.p_draw,
        p_away: b.p_away,
        // Post-F commit 1: raw context para el tooltip explainer (commit 3).
        // Opcional: entries computed pre-v10 no tendrán estos campos y el
        // tooltip hará fallback a no mostrar trigger.
        elo_home_raw: b.elo_home_raw,
        elo_away_raw: b.elo_away_raw,
        h2h_home_wins: b.h2h_home_wins,
        h2h_away_wins: b.h2h_away_wins,
        h2h_draws: b.h2h_draws,
        h2h_total: b.h2h_total,
        form_home_ppg: b.form_home_ppg,
        form_away_ppg: b.form_away_ppg,
        is_host: b.is_host,
      };
    }
    return out;
  } catch (e) {
    console.warn('[ia] loadIAPredictions:', e?.message || e);
    return {};
  }
}

/* ── Escucha cambios de sesión ── */
async function loadUserData(userId) {
  // Polish v1 Fix-Pack-2 Fix-3+4: arrays AW_PLAYERS y YOUNG_PLAYERS_NXGN
  // eliminados de scoring.js. La resolución de awPicks desde BD ahora se
  // hace via getAwardCandidates (cache _awardCandidatesCache) en el
  // bloque if (awData) más abajo.
  const leagueId = getActiveLeagueId();
  const [{ data: preds }, { data: koPreds }, { data: awData }, { data: lmData, error: lmErr }, iaMap] = await Promise.all([
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
    // ERR-78 iter 3 (mejora UX, NO fix del blank): race contra timeout de
    // 6s. loadIAPredictions ya tiene catch interno → {} on error, pero NO
    // protege contra fetch colgado (sin throw). Si IA tarda >6s el
    // Promise.all sigue con iaMap={} sin esperar. El fetch real sigue
    // corriendo en background — IA simplemente no aparece esta sesión.
    // Acortar la ventana de espera reduce probabilidad de caer en
    // fallback path (que aunque ya navega bien con el fix del lock,
    // es preferible no llegar a él).
    Promise.race([
      loadIAPredictions(),
      new Promise(resolve => setTimeout(() => {
        console.warn('[ia] timeout 6s en bootstrap; iaMap={} para no bloquear.');
        resolve({});
      }, 6000))
    ]),
  ]);

  // Fusionar predicciones IA en el store global.
  if (iaMap && Object.keys(iaMap).length > 0) {
    Object.assign(iaPredictions, iaMap);
    window.iaPredictions = iaPredictions;
  }
  if (preds && preds.length > 0) {
    preds.forEach(p => { predictions[p.match_id] = { l:p.local, v:p.visitante, gol:p.scorer, saved:true, lockedByUser:true }; });
    try { localStorage.setItem('porra_predictions', JSON.stringify(predictions)); } catch(e) {}
    // FG-1: avisar a listeners (board v3 Grupos en grupos-v3.js:1248) de que
    // predictions[] ya está hidratado. Sin esto, si el usuario aterriza en la
    // pestaña Grupos antes de que loadUserData termine, v3GruposMount() pinta
    // el board con predictions vacías y se queda stale hasta navegar fuera.
    document.dispatchEvent(new CustomEvent('mundial:predictions-changed', { detail: { source: 'auth-load' } }));
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
    // Polish v1 Fix-Pack-2 Fix-3+4: resolver keys guardados via
    // getAwardCandidates (BD-driven). Las 4 listas se cachean en
    // window._awardCandidatesCache (también usado por openPicker y
    // _v3SuggestGoldenBoot). Si BD no disponible, awPicks queda en
    // {key} placeholder con name=key como fallback visual mínimo.
    if (typeof window.getAwardCandidates === 'function') {
      try {
        const candLists = await Promise.all([
          window.getAwardCandidates('golden_ball'),
          window.getAwardCandidates('golden_boot'),
          window.getAwardCandidates('golden_glove'),
          window.getAwardCandidates('young_player'),
        ]);
        const byAward = {
          golden_ball: candLists[0],
          golden_boot: candLists[1],
          golden_glove: candLists[2],
          young_player: candLists[3],
        };
        ['golden_ball','golden_boot','golden_glove','young_player'].forEach(award => {
          if (awData[award]) {
            const p = byAward[award].find(p => p.key === awData[award]);
            if (p) awPicks[award] = p;
          }
        });
      } catch (e) {
        console.warn('[awards] resolve picks desde BD falló:', e);
      }
    }
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

/* ── Renderiza la barra de sesión (top-right) ──
   F1.1f v3 (D13 corregida): añade soporte para slots `[data-user-mount]` que
   inyecta el shell mundial-shell-v3.js dentro de .v3-fifa-bar__user en cada
   SHELL_PAGE. Coexiste con los 3 mounts viejos (#wc-auth-bar, #grupos-user-bar,
   #elim-user-bar) durante transición F1-F3; F4 cleanup elimina los 3 viejos. */
function renderAuthBar() {
  const bar      = document.getElementById('wc-auth-bar');
  const gruposBar = document.getElementById('grupos-user-bar');
  const elimBar  = document.getElementById('elim-user-bar');
  const v3Mounts = document.querySelectorAll('[data-user-mount]');
  if (currentUser) {
    const inicial = currentUser.nombre.charAt(0).toUpperCase();
    const adminBtn = currentUser.is_admin
      ? `<button onclick="event.stopPropagation();showPage('admin')" style="background:#1e1b4b;border:1px solid #3730a3;color:#a5b4fc;font-size:10px;font-weight:700;padding:4px 9px;border-radius:6px;cursor:pointer;letter-spacing:.04em;font-family:'Inter',sans-serif">⚙ ADMIN</button>`
      : '';
    const badgeHtml = `<div style="display:flex;align-items:center;gap:6px">${adminBtn}<div class="wc-user-badge" style="display:flex;align-items:center;gap:8px;background:rgba(17,19,24,.9);border:1px solid #27272a;border-radius:24px;padding:5px 12px 5px 7px"><div class="wc-user-avatar">${inicial}</div><span class="wc-user-name">${escapeHtml(currentUser.nombre)}</span></div><button class="wc-logout-btn do-logout">Cerrar sesión</button></div>`;
    if (bar)      bar.innerHTML      = badgeHtml;
    if (gruposBar) gruposBar.innerHTML = badgeHtml;
    if (elimBar)  elimBar.innerHTML  = badgeHtml;
    v3Mounts.forEach(el => { el.innerHTML = badgeHtml; });
  } else {
    const loginHtml = `<button class="wc-login-btn-bar do-login">Iniciar sesión</button>`;
    if (bar)      bar.innerHTML      = loginHtml;
    if (gruposBar) gruposBar.innerHTML = '';
    if (elimBar)  elimBar.innerHTML  = '';
    v3Mounts.forEach(el => { el.innerHTML = ''; });
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
  const captchaToken = document.querySelector('[name=cf-turnstile-response]')?.value || undefined;
  const { error } = await db.auth.signInWithPassword({ email, password: pass, options: { captchaToken } });
  setAuthLoading('login-btn', false);
  if (window.turnstile) window.turnstile.reset();
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

  // ERR-78: helper Promise.race con timeout para envolver awaits críticos
  // del bootstrap (Supabase fetch no expone signal de cancelación). Sin
  // esto, un fetch transitoriamente colgado dejaba el handler en pending
  // para siempre, sin llegar a showPage(), y la app quedaba con el shell
  // montado pero sin página activa (todos los hijos a height:0).
  const _withTimeout = (promise, ms, label) => {
    let timer;
    const timeout = new Promise(function (_, reject) {
      timer = setTimeout(function () {
        reject(new Error('timeout: ' + (label || 'op') + ' (' + ms + 'ms)'));
      }, ms);
    });
    return Promise.race([promise, timeout]).finally(function () { clearTimeout(timer); });
  };

  // ERR-78: loader del bootstrap. Visible al iniciar runAuthInit hasta la
  // primera navegación (o hasta el watchdog de 12s). Removido por
  // _bootstrapSession via _markNavigated() o por el path anónimo cuando
  // pinta welcome. NO depende del evento del listener — armado siempre.
  const _showBootstrapLoader = () => {
    if (document.getElementById('_auth-bootstrap-loader') || !document.body) return;
    const el = document.createElement('div');
    el.id = '_auth-bootstrap-loader';
    el.setAttribute('aria-live', 'polite');
    el.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);' +
      'z-index:99999;color:#a5b4fc;font:14px/1.4 Inter,system-ui,sans-serif;' +
      'text-align:center;padding:14px 22px;background:rgba(15,23,42,.88);' +
      'border:1px solid rgba(99,102,241,.45);border-radius:10px;pointer-events:none;';
    el.innerHTML = '<div style="font-size:20px;margin-bottom:6px">⚽</div><div>Cargando…</div>';
    document.body.appendChild(el);
  };
  const _hideBootstrapLoader = () => {
    const el = document.getElementById('_auth-bootstrap-loader');
    if (el && el.parentNode) el.parentNode.removeChild(el);
  };

  // ERR-78 iter 3: helper para fallback a welcome. SIEMPRE quita el lock
  // `#restore-lock-css` (inyectado inline en index.html cuando hay
  // porra_lastPage en localStorage) ANTES de llamar showPage('welcome').
  // El lock hace early-return en showPage('welcome'); si no lo quitamos
  // antes, el showPage retorna sin renderizar nada y la app queda en
  // blank. Causa raíz REAL del bug post-refresh (iter 1+2 atacaban
  // consecuencias — listener race, IA timeout — pero no el lock que
  // bloqueaba todos los fallback welcome).
  const _navigateFallbackWelcome = () => {
    _hideBootstrapLoader();
    const _lock = document.getElementById('restore-lock-css');
    if (_lock && _lock.parentNode) _lock.parentNode.removeChild(_lock);
    try { if (typeof showPage === 'function') showPage('welcome'); } catch (e) {}
  };

  // ERR-78 v2: loader + watchdog armados SIEMPRE al inicio de runAuthInit,
  // FUERA del onAuthStateChange handler. El gating previo por
  // `sessionStorage.porra_token` era frágil: ese token se ESCRIBE dentro
  // del handler tras el primer SIGNED_IN/INITIAL_SESSION; si el handler
  // nunca corre (race de listener tardío — auth.js carga al final de la
  // cadena loadScript, después de que supabase-js ya emitió INITIAL_SESSION
  // durante createClient/restauración interna), el gate fallaba, ni loader
  // ni watchdog se armaban, y la app quedaba indefinidamente vacía. El QA
  // de San en preview confirmó: con sesión válida persistida + F5, pasaron
  // MINUTOS sin que el watchdog rescatara. Ahora ambos se arman
  // incondicionalmente; se auto-ocultan apenas la primera navegación los
  // limpie (vía _bootstrapSession o welcome path).
  _showBootstrapLoader();
  // ERR-78 iter 3: watchdog redesignado. El trigger anterior ("loader
  // sigue visible") era frágil — `_hideBootstrapLoader()` se llama en
  // TODOS los caminos de fallback (incluido el path getSession sin
  // sesión), así que cuando el bug del lock aparece el loader ya está
  // oculto y el watchdog NUNCA disparaba. Verificado por San en
  // preview: durante el blank el #_auth-bootstrap-loader no existe.
  //
  // Trigger semántico nuevo: "¿hay alguna #page-* visible?". Si tras
  // 12s ninguna #page-* tiene display:block, la app está blank — sea
  // cual sea el camino que nos trajo aquí. Acción: _navigateFallbackWelcome
  // (quita lock + welcome). Cubre todos los caminos de fallback
  // presentes y futuros sin enumerarlos.
  setTimeout(function () {
    const _PAGES = ['welcome','grupos','jornada','directo','predictor','elim','score','admin'];
    const anyVisible = _PAGES.some(function (p) {
      const el = document.getElementById('page-' + p);
      return el && el.style.display !== 'none' && el.style.display !== '';
    });
    if (!anyVisible) {
      console.warn('[auth.bootstrap] watchdog 12s: ninguna #page-* visible. Forzando welcome (quita lock).');
      _navigateFallbackWelcome();
    }
  }, 12000);

  // ERR-78 v2: bootstrap de sesión EXTRAÍDO a función reutilizable. Se
  // invoca desde DOS puntos de entrada:
  //   (a) onAuthStateChange handler — cubre cambios futuros (SIGNED_IN,
  //       INITIAL_SESSION emitidos tras el registro del listener).
  //   (b) getSession() explícito tras registrar el listener — cubre el
  //       race donde supabase-js ya emitió INITIAL_SESSION durante
  //       createClient / restauración de sesión persistida ANTES de que
  //       auth.js cargue (auth.js está al final de la cadena loadScript,
  //       y el evento original se pierde porque nadie estaba suscrito).
  //
  // Idempotencia: `window._bootstrapInFlight` evita doble ejecución si
  // ambos paths se disparan. Primer ejecutor gana; el segundo retorna.
  // El guard `currentUser.id === session.user.id` adicional cubre el
  // caso ya-hidratado (background return, reemisiones de SIGNED_IN).
  //
  // Estructura interna del bootstrap (preservada del commit anterior):
  //   - Profile fetch con timeout (8s).
  //   - Retry x4 con backoff 0/400/800/1600ms sobre leagueLoadMyLeagues.
  //   - Promise.race timeout en cada await (8-10s).
  //   - Flag `_navigated` + try/finally garantiza showPage en TODOS los
  //     caminos (liga restaurada, no encontrada, error, hang).
  //   - Preserva savedLeagueId si tras 4 intentos _myLeagues sigue vacío
  //     (posible transient — el próximo refresh tiene otra oportunidad).
  const _bootstrapSession = async (session, eventType) => {
    if (!session || !session.user) return;
    if (window._bootstrapInFlight) {
      console.debug('[auth.bootstrap] _bootstrapSession in-flight, skip (' + eventType + ')');
      return;
    }
    // Mismo usuario ya hidratado → solo refrescar UI bar y cerrar loader.
    if (currentUser && currentUser.id === session.user.id) {
      _hideBootstrapLoader();
      renderAuthBar();
      updateCTAs();
      return;
    }
    window._bootstrapInFlight = true;

    // Token en memoria + sessionStorage (idempotente).
    window._porraToken = session.access_token;
    try { sessionStorage.setItem('porra_token', session.access_token); } catch (e) {}

    try {
      // Profile fetch con timeout.
      let _profile = null;
      try {
        const _res = await _withTimeout(
          db.from('profiles').select('nombre,is_admin').eq('id', session.user.id).single(),
          8000, 'profile fetch'
        );
        _profile = _res?.data;
      } catch (err) {
        console.warn('[auth.bootstrap] profile fetch falló:', err.message);
      }
      currentUser = {
        id: session.user.id,
        email: session.user.email,
        nombre: _profile?.nombre || session.user.email.split('@')[0],
        is_admin: _profile?.is_admin || false
      };

      // Flag _navigated + try/finally garantiza showPage en TODOS los caminos.
      let _navigated = false;
      const _markNavigated = () => { _navigated = true; _hideBootstrapLoader(); };

      try {
        if (eventType === 'INITIAL_SESSION') {
          let savedLeagueId = null;
          try { savedLeagueId = localStorage.getItem('porra_active_league_id'); } catch (e) {}

          if (savedLeagueId && typeof leagueLoadMyLeagues === 'function') {
            const _delays = [400, 800, 1600];
            let _foundLeague = null;
            for (let _attempt = 0; _attempt <= _delays.length; _attempt++) {
              try {
                await _withTimeout(leagueLoadMyLeagues(), 8000, 'leagueLoadMyLeagues#' + (_attempt + 1));
              } catch (err) {
                console.warn('[auth.bootstrap] leagueLoadMyLeagues intent ' + (_attempt + 1) + ' falló:', err.message);
              }
              const _myLg = (typeof _myLeagues !== 'undefined' && _myLeagues) ? _myLeagues : [];
              _foundLeague = _myLg.find(l => l.id === savedLeagueId);
              if (_foundLeague) break;
              if (_attempt < _delays.length) {
                await new Promise(r => setTimeout(r, _delays[_attempt]));
              }
            }

            if (_foundLeague) {
              try {
                // ERR-78 iter 4: llamar leagueSelect DIRECTAMENTE en lugar de
                // leagueSelectById. Razón: leagueSelectById internamente hace
                // `await leagueLoadMyLeagues()` (leagues.js:75) — un segundo
                // fetch REDUNDANTE porque la retry loop arriba YA populó
                // _myLeagues y _foundLeague YA fue validado contra esos datos.
                // Ese segundo fetch puede colgarse (network jitter) y dar
                // timeout 8s → catch → fall-through a Path 2 con target=null
                // (si listener premature null lo nullificó vía iter 3) →
                // finalPage='welcome' → app aterriza en welcome EN LUGAR DE
                // grupos. Eliminándolo, eliminamos esa ventana de fallo
                // específica que QA de San en iter 3 reveló (regresión UX
                // descubierta tras cerrar el blank).
                // leagueSelect es síncrono — sin timeout necesario.
                leagueSelect(_foundLeague);
                _markNavigated();
              } catch (err) {
                console.warn('[auth.bootstrap] leagueSelect falló:', err.message);
                // Cae al fall-through con loadUserData+showPage.
              }
            } else {
              const _myLg = (typeof _myLeagues !== 'undefined' && _myLeagues) ? _myLeagues : [];
              if (_myLg.length > 0) {
                try { localStorage.removeItem('porra_active_league_id'); } catch (e) {}
              } else {
                console.warn('[auth.bootstrap] leagueLoadMyLeagues vacío tras 4 intentos; preservo savedLeagueId=' + savedLeagueId + ' (posible transient).');
              }
            }
          }
        }

        if (!_navigated) {
          try {
            await _withTimeout(loadUserData(session.user.id), 10000, 'loadUserData');
          } catch (err) {
            console.warn('[auth.bootstrap] loadUserData falló:', err.message);
          }

          // Restaurar última página SOLO en refresh (INITIAL_SESSION).
          // En login fresco (SIGNED_IN) vamos a welcome por semántica.
          let target = null;
          if (eventType === 'INITIAL_SESSION') {
            target = window._pendingPageRestore;
            window._pendingPageRestore = null;
          }

          const finalPage = (target === 'admin' && !currentUser.is_admin)
            ? 'welcome'
            : (target || 'welcome');
          // ERR-78 iter 3: si finalPage === 'welcome' (target null o admin
          // rechazado por no-admin), el lock activo bloquearía showPage.
          // _navigateFallbackWelcome quita el lock antes. Para non-welcome
          // el showPage normal ya quita el lock en ui-nav.js:508.
          setTimeout(() => {
            if (finalPage === 'welcome') {
              _navigateFallbackWelcome();
            } else {
              _hideBootstrapLoader();
              showPage(finalPage);
            }
          }, 100);
          _markNavigated();
        }
      } finally {
        // Red de seguridad final: excepción sincrónica inesperada que escapó
        // del try sin haber navegado → forzar welcome navegable.
        if (!_navigated) {
          console.warn('[auth.bootstrap] _bootstrapSession no navegó; forzando welcome (red final).');
          // ERR-78 iter 3: helper en lugar de showPage directo — el lock
          // estaría activo si _pendingPageRestore se setó al cargar.
          setTimeout(() => _navigateFallbackWelcome(), 100);
        }
      }
    } finally {
      window._bootstrapInFlight = false;
      renderAuthBar();
      updateCTAs();
    }
  };

  // Registrar listener AHORA que todos los scripts están cargados
  db.auth.onAuthStateChange(async (event, session) => {
    // TOKEN_REFRESHED / USER_UPDATED — solo refrescar token en memoria.
    // Supabase emite TOKEN_REFRESHED al cambiar de pestaña; sin este guard
    // se re-disparaba todo el flujo (loadUserData + showPage) y la app
    // saltaba al selector de ligas perdiendo la vista actual.
    if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') {
      if (session?.access_token) {
        window._porraToken = session.access_token;
        try { sessionStorage.setItem('porra_token', session.access_token); } catch (e) {}
      }
      return;
    }

    if (session?.user && (event === 'SIGNED_IN' || event === 'INITIAL_SESSION')) {
      // ERR-78 v2: delegado a _bootstrapSession (idempotente). El flag
      // _bootstrapInFlight + guard currentUser.id===session.user.id
      // dentro de _bootstrapSession dedup contra el getSession() explícito
      // que también dispara el mismo flow. Conserva el comportamiento de
      // los guards originales sin reescribirlos in-line.
      await _bootstrapSession(session, event);
      return;
    }

    if (!session?.user) {
      // ERR-78 iter 4: distinguir entre eventos que confirman ausencia de
      // sesión (SIGNED_OUT, USER_DELETED — acción explícita del usuario o
      // del servidor) vs eventos prematuros (INITIAL_SESSION sin sesión
      // antes de que supabase-js termine de restaurar desde localStorage).
      //
      // ANTES de iter 4: TODO evento sin sesión nullificaba _pendingPageRestore
      // y llamaba _navigateFallbackWelcome → showPage('welcome'). Problema:
      // supabase-js v2 a veces emite INITIAL_SESSION sin sesión durante
      // arranque (race con persistSession async). Con _pendingPageRestore
      // nullificado, cuando getSession() explícito resuelve LATER con
      // sesión válida y _bootstrapSession Path 1 sufre cualquier hipo
      // (e.g., timeout del segundo leagueLoadMyLeagues dentro de
      // leagueSelectById), Path 2 lee target=null y aterriza en welcome
      // EN LUGAR DE grupos. Bug observado en iter 3 QA.
      //
      // En iter 4: ignoramos eventos sin sesión que NO sean acción explícita.
      // getSession() explícito (y _onNoSessionFromGetSession) es la fuente
      // de verdad para "¿hay sesión?". Eventos posteriores (SIGNED_IN tras
      // restauración tardía, SIGNED_OUT real, etc.) sí actúan normal.
      if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
        currentUser = null;
        window._porraToken = null;
        try { sessionStorage.removeItem('porra_token'); } catch (e) {}
        _hideBootstrapLoader();
        if (window._pendingPageRestore) {
          window._pendingPageRestore = null;
          _navigateFallbackWelcome();
          try { if (typeof initWelcome === 'function') initWelcome(); } catch (e) {}
        }
        renderAuthBar();
        updateCTAs();
      } else {
        // INITIAL_SESSION sin sesión / USER_UPDATED sin sesión / otros —
        // ignorar. getSession() explícito decidirá si hay sesión real.
        console.debug('[auth] evento sin sesión ignorado (esperando getSession): ' + event);
      }
    }
  });

  // ERR-78 v2: getSession() EXPLÍCITO tras registrar el listener. CRÍTICO
  // — sin esto, el bootstrap depende exclusivamente de que el listener
  // reciba INITIAL_SESSION, lo cual NO ocurre cuando supabase-js ya emitió
  // ese evento durante createClient/restauración persistida ANTES de que
  // auth.js cargue (auth.js está al final de la cadena loadScript). Verificado
  // en preview Vercel con Chrome MCP: getSession() devuelve {hasSession:true}
  // y el flow restaura la app correctamente; sin este path, la app quedaba
  // vacía indefinidamente porque el listener nunca recibía el evento.
  //
  // Fire-and-forget (NO await): la pintura del welcome inicial no se
  // bloquea para usuarios anónimos. Si hay sesión persistida,
  // _bootstrapSession navega y sobrescribe el welcome. Si no, ocultamos
  // el loader y el welcome ya pintado sigue visible.
  const _onNoSessionFromGetSession = () => {
    _hideBootstrapLoader();
    // Edge case: usuario anónimo con _pendingPageRestore obsoleto (sesión
    // expiró entre tab close y reopen). El branch sin sesión del listener
    // cubría esto cuando el listener fire, pero ahora puede no hacerlo
    // (race que motivó este fix). Garantizamos welcome navegable.
    // ERR-78 iter 3: usar helper para quitar el lock antes del showPage.
    // Sin esto el lock (inyectado en index.html cuando hay porra_lastPage)
    // hacía early-return en showPage('welcome') → app blank permanente.
    // Este era el camino más frecuente del bug — getSession timeout o
    // sesión expirada caía aquí, blocked, blank.
    if (window._pendingPageRestore) {
      window._pendingPageRestore = null;
      _navigateFallbackWelcome();
      try { if (typeof initWelcome === 'function') initWelcome(); } catch (e) {}
    }
  };
  _withTimeout(db.auth.getSession(), 8000, 'auth.getSession')
    .then(function (res) {
      var _s = res && res.data && res.data.session;
      if (_s && _s.user) {
        return _bootstrapSession(_s, 'INITIAL_SESSION');
      }
      _onNoSessionFromGetSession();
    })
    .catch(function (err) {
      console.warn('[auth.bootstrap] getSession explícito falló:', err.message);
      _onNoSessionFromGetSession();
    });

  // v2.7: si hay pagina pendiente de restaurar tras F5, no mostrar welcome
  // al arranque. onAuthStateChange / getSession() explícito decidirán qué
  // mostrar cuando cargue sesión.
  // ERR-78 v2: si NO hay pendingPageRestore, pintamos welcome ahora. Si
  // resulta que sí hay sesión persistida, _bootstrapSession (vía el
  // getSession() explícito) navegará por encima en cuanto resuelva.
  // Ocultamos el loader aquí para que el welcome anónimo no quede tapado.
  if (!window._pendingPageRestore) {
    _hideBootstrapLoader();
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
