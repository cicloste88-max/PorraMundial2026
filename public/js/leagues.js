/* leagues.js — Porra Mundial 2026
   Usa: db, currentUser, predictions, koPredictions, awPicks
   Expone: getActiveLeagueId, leagueSelect, leagueSelectById, leagueRenderPanel,
           leagueShowCreate, leagueShowJoin, leagueDoCreate, leagueDoJoin,
           leagueCloseModals, requireLeagueId, window._activeLeague
   Deps: js-auth, js-data
*/
// ─────────────────────────────────────────────────────────────
// ESTADO DE LIGA
// _activeLeague: { id, nombre, codigo } — liga seleccionada en sesión
// _myLeagues:    array de ligas del usuario actual
// ─────────────────────────────────────────────────────────────
let _activeLeague = null;   // liga activa en esta sesión
let _myLeagues    = [];     // ligas a las que pertenece el usuario

function getActiveLeague()   { return _activeLeague; }
function getActiveLeagueId() { return _activeLeague?.id ?? null; }

// ─────────────────────────────────────────────────────────────
// CARGAR LIGAS DEL USUARIO
// ─────────────────────────────────────────────────────────────
async function leagueLoadMyLeagues() {
  if (!currentUser) return [];

  // Paso 1: obtener los IDs de liga y estado porra_cerrada
  const { data: members, error: mErr } = await db
    .from('league_members')
    .select('league_id, porra_cerrada')
    .eq('user_id', currentUser.id);

  if (mErr) { console.warn('[leagues] Error leyendo membresías:', mErr.message); return []; }
  if (!members || members.length === 0) { _myLeagues = []; return []; }

  // Paso 2: obtener los datos de cada liga
  const leagueIds = members.map(m => m.league_id);
  const { data: leagues, error: lErr } = await db
    .from('leagues')
    .select('id, nombre, codigo, created_by')
    .in('id', leagueIds);

  if (lErr) { console.warn('[leagues] Error leyendo ligas:', lErr.message); return []; }

  // Combinar
  _myLeagues = (leagues ?? []).map(lg => {
    const member = members.find(m => m.league_id === lg.id);
    return { ...lg, porra_cerrada: member?.porra_cerrada ?? false };
  });

  console.log('[leagues] Ligas cargadas:', _myLeagues.length, _myLeagues.map(l => l.nombre));
  return _myLeagues;
}

// ─────────────────────────────────────────────────────────────
// SELECCIONAR LIGA ACTIVA
// ─────────────────────────────────────────────────────────────
// Seleccionar liga por ID (usado tras crear)
async function leagueSelectById(id) {
  // Recargar las ligas para obtener el objeto completo
  await leagueLoadMyLeagues();
  const league = _myLeagues.find(l => l.id === id);
  if (league) leagueSelect(league);
  else await leagueRenderPanel(); // fallback: volver al panel
}

function leagueSelect(league) {
  _activeLeague = league;
  window._activeLeague = league;
  _finalizarDone = false;  // nueva liga — re-verificar estado

  // Restaurar estado porra_cerrada de esta liga en concreto
  window._porraCerrada = !!league.porra_cerrada;

  // Si la porra de esta liga está cerrada, bloquear tarjetas
  if (window._porraCerrada) {
    requestAnimationFrame(() => lockAllCardsIfCerrada());
  } else {
    // Asegurar que los controles están activos si la liga está abierta
    window._porraCerrada = false;
  }

  // Recargar datos del usuario para esta liga
  if (currentUser) {
    predictions = {}; koPredictions = {};
    // awPicks es const — limpiar propiedades sin reasignar
    awPicks.golden_ball = null; awPicks.golden_boot = null;
    awPicks.golden_glove = null; awPicks.young_player = null;
    window._awPicksSaved = false;
    loadUserData(currentUser.id);
  }

  // Actualizar pill en la barra de navegación
  leagueUpdateNavPill();
  // Mostrar la porra
  showPage('grupos');
  // Tras cargar datos de la liga, re-evaluar sección de cerrar porra
  // loadUserData llama checkFinalizarReady al terminar, pero por si acaso:
  setTimeout(() => { if (typeof checkFinalizarReady === 'function') checkFinalizarReady(); }, 500);
}

function leagueUpdateNavPill() {
  // Inyectar o actualizar un pill de liga en el global-header
  let pill = document.getElementById('league-nav-pill');
  if (!_activeLeague) {
    if (pill) pill.style.display = 'none';
    return;
  }
  if (!pill) {
    const header = document.getElementById('global-header');
    if (!header) return;
    pill = document.createElement('div');
    pill.id = 'league-nav-pill';
    pill.className = 'league-nav-pill';
    pill.onclick = () => { showPage('welcome'); };
    // Insertar al inicio del header
    header.insertBefore(pill, header.firstChild);
  }
  pill.style.display = 'inline-flex';
  pill.innerHTML = `<span class="lnp-dot"></span>🏆 ${escapeHtml(_activeLeague.nombre)}<span class="lnp-label">· cambiar</span>`;

  // Sincronizar también en barra de eliminatorias
  let elimPill = document.getElementById('elim-league-pill');
  if (!elimPill) {
    const elimBar = document.getElementById('elim-user-bar');
    if (elimBar) {
      elimPill = document.createElement('div');
      elimPill.id = 'elim-league-pill';
      elimPill.className = 'league-nav-pill';
      elimPill.style.marginRight = 'auto';
      elimPill.onclick = () => showPage('welcome');
      elimBar.parentElement.insertBefore(elimPill, elimBar);
    }
  }
  if (elimPill) {
    elimPill.style.display = 'inline-flex';
    elimPill.innerHTML = `<span class="lnp-dot"></span>🏆 ${escapeHtml(_activeLeague.nombre)}<span class="lnp-label">· cambiar</span>`;
  }
}

// ─────────────────────────────────────────────────────────────
// RENDER DEL PANEL DE LIGAS EN WELCOME
// ─────────────────────────────────────────────────────────────
async function leagueRenderPanel() {
  const panel = document.getElementById('league-panel');
  if (!panel || !currentUser) return;
  // Solo mostrar el panel si page-welcome está activa o recién activada
  const welcomePage = document.getElementById('page-welcome');
  if (!welcomePage || welcomePage.style.display === 'none') return;

  await leagueLoadMyLeagues();

  const list = document.getElementById('my-leagues-list');
  const divider = document.getElementById('league-actions-divider');

  if (_myLeagues.length > 0) {
    // Con ligas: tarjeta con nombre, código y botón "Empezar a pronosticar"
    list.innerHTML = _myLeagues.map(lg => {
      const lgJson = JSON.stringify(lg).replace(/"/g,'&quot;');
      return `
      <div style="background:rgba(15,15,25,.6);border:1px solid rgba(99,82,199,.3);border-radius:14px;padding:14px 16px;margin-bottom:10px">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px">
          <div>
            <div style="font-size:16px;font-weight:800;color:#fff;text-shadow:0 1px 4px rgba(0,0,0,.8)">${escapeHtml(lg.nombre)}</div>
            <div style="font-size:11px;color:#9ca3af;margin-top:2px">${lg.porra_cerrada ? '🔒 Porra cerrada' : '✏️ Pronósticos abiertos'}</div>
          </div>
          <div style="display:flex;align-items:center;gap:5px">
            <div style="background:rgba(99,82,199,.25);border:1px solid rgba(99,82,199,.4);border-radius:6px;padding:3px 9px;font-family:'Inter Tight',monospace;font-size:12px;font-weight:700;color:#a5b4fc;letter-spacing:.1em">${escapeHtml(lg.codigo)}</div>
            <button onclick="event.stopPropagation();navigator.clipboard.writeText('${lg.codigo}').then(()=>{this.textContent='✓';setTimeout(()=>this.textContent='📋',1500)}).catch(()=>{})"
              style="background:rgba(99,82,199,.15);border:1px solid rgba(99,82,199,.25);border-radius:5px;padding:3px 7px;font-size:11px;color:#a5b4fc;cursor:pointer"
              title="Copiar código">📋</button>
          </div>
        </div>
        <button onclick="leagueSelectById('${lg.id}')"
          style="width:100%;padding:11px;background:linear-gradient(135deg,#16a34a,#15803d);border:none;border-radius:9px;color:#fff;font-family:'Inter',sans-serif;font-size:14px;font-weight:700;cursor:pointer;display:flex;align-items:center;justify-content:center;gap:8px"
          onmouseover="this.style.filter='brightness(1.1)'" onmouseout="this.style.filter=''">
          ⚽ Empezar a pronosticar →
        </button>
      </div>`;
    }).join('');
    if (divider) divider.style.display = 'block';
  } else {
    list.innerHTML = `<div style="text-align:center;padding:16px 0 8px;color:#d1d5db;font-size:13px;line-height:1.6;text-shadow:0 1px 4px rgba(0,0,0,.8)">
      Aún no estás en ninguna porra.<br>Crea una o únete a una existente.</div>`;
    if (divider) divider.style.display = 'none';
  }

  panel.style.display = 'flex';
  // Ocultar el botón CTA del hero y el scroll cue cuando el panel está activo
  const heroCta   = document.getElementById('hero-cta-btn');
  const scrollCue = document.getElementById('wc-scroll-cue');
  const bottomCta = document.querySelector('.wc-bottom-cta');
  if (heroCta)   heroCta.style.display   = 'none';
  if (scrollCue) scrollCue.style.display = 'none';
  if (bottomCta) bottomCta.style.display = 'none';
}

// ─────────────────────────────────────────────────────────────
// CREAR LIGA
// ─────────────────────────────────────────────────────────────
function leagueShowCreate() {
  document.getElementById('league-create-name').value = '';
  document.getElementById('league-create-msg').textContent = '';
  document.getElementById('league-modal-create').style.display = 'flex';
  setTimeout(() => document.getElementById('league-create-name').focus(), 100);
}

async function leagueDoCreate() {
  const nombre = document.getElementById('league-create-name').value.trim();
  const msgEl  = document.getElementById('league-create-msg');
  if (!nombre) { msgEl.textContent = 'Escribe un nombre para la porra'; msgEl.className = 'league-modal-msg error'; return; }
  if (!currentUser) return;

  msgEl.textContent = 'Creando…'; msgEl.className = 'league-modal-msg';

  // Llamar a la Edge Function para crear la liga (service_role genera el código)
  const token = window._porraToken || sessionStorage.getItem('porra_token') || '';
  try {
    const res = await fetch(`${window._supa_url}/functions/v1/admin-actions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`, 'apikey': window._supa_anon },
      body: JSON.stringify({ action: 'create_league', nombre, admin_id: currentUser.id })
    });
    const data = await res.json();
    if (!data.ok) throw new Error(data.error || 'Error desconocido');

    const codigo = data.data.codigo;
    const ligaNombre = data.data.nombre;
    // Mostrar código con botón copiar — no cerrar automáticamente
    document.querySelector('#league-modal-create .league-modal').innerHTML = `
      <div class="league-modal-title">✅ ¡Liga creada!</div>
      <div class="league-modal-sub">Comparte este código con tus amigos para que puedan unirse.</div>
      <div style="background:#0d1117;border:2px solid #6652c9;border-radius:12px;padding:18px;text-align:center;margin-bottom:16px">
        <div style="font-size:11px;color:#6b7280;margin-bottom:8px;text-transform:uppercase;letter-spacing:.1em">Código de la liga</div>
        <div style="font-family:'Inter Tight',monospace;font-size:32px;font-weight:900;color:#a5b4fc;letter-spacing:.2em">${escapeHtml(codigo)}</div>
        <div style="font-size:12px;color:#9ca3af;margin-top:6px">${escapeHtml(ligaNombre)}</div>
      </div>
      <button onclick="navigator.clipboard.writeText('${codigo}').then(()=>{this.textContent='✓ Copiado';this.style.background='#166534'}).catch(()=>{})" 
        style="width:100%;padding:10px;background:#1e1b4b;border:1px solid #6652c9;border-radius:8px;color:#a5b4fc;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;cursor:pointer;margin-bottom:10px;transition:all .15s">
        📋 Copiar código
      </button>
      <button onclick="document.getElementById('league-modal-create').style.display='none'; leagueSelectById('${data.data.id}');"
        style="width:100%;padding:10px;background:#16a34a;border:none;border-radius:8px;color:#fff;font-family:'Inter',sans-serif;font-size:13px;font-weight:600;cursor:pointer">
        ✓ Entrar a mi porra →
      </button>
    `;
  } catch(err) {
    msgEl.textContent = err.message;
    msgEl.className = 'league-modal-msg error';
  }
}

// ─────────────────────────────────────────────────────────────
// UNIRSE A LIGA
// ─────────────────────────────────────────────────────────────
function leagueShowJoin() {
  document.getElementById('league-join-code').value = '';
  document.getElementById('league-join-msg').textContent = '';
  document.getElementById('league-modal-join').style.display = 'flex';
  setTimeout(() => document.getElementById('league-join-code').focus(), 100);
}

async function leagueDoJoin() {
  const codigo = document.getElementById('league-join-code').value.trim().toUpperCase();
  const msgEl  = document.getElementById('league-join-msg');

  if (codigo.length < 4) {
    msgEl.textContent = 'El código debe tener 6 caracteres';
    msgEl.className = 'league-modal-msg error'; return;
  }
  if (!currentUser) return;

  msgEl.textContent = 'Buscando…'; msgEl.className = 'league-modal-msg';

  try {
    // Buscar la liga por código
    const { data: league, error: leagueErr } = await db
      .from('leagues').select('*').eq('codigo', codigo).single();
    if (leagueErr || !league) throw new Error('Código no encontrado. Comprueba que está bien escrito.');

    // Verificar si ya es miembro
    const { data: existing } = await db
      .from('league_members')
      .select('league_id')
      .eq('league_id', league.id)
      .eq('user_id', currentUser.id)
      .maybeSingle();
    if (existing) throw new Error(`Ya eres miembro de "${league.nombre}"`);

    // Unirse
    const { error: joinErr } = await db
      .from('league_members')
      .insert({ league_id: league.id, user_id: currentUser.id });
    if (joinErr) throw new Error('Error al unirse: ' + joinErr.message);

    msgEl.textContent = `✓ Te has unido a "${league.nombre}"`;
    msgEl.className = 'league-modal-msg ok';

    setTimeout(() => {
      leagueCloseModals();
      // Entrar directamente a la porra sin pasar por el panel
      leagueSelect({ ...league, porra_cerrada: false });
    }, 1000);
  } catch(err) {
    msgEl.textContent = err.message;
    msgEl.className = 'league-modal-msg error';
  }
}

// ─────────────────────────────────────────────────────────────
// CERRAR MODALES
// ─────────────────────────────────────────────────────────────
function leagueCloseModals(e) {
  // Solo cerrar si se llama sin evento (botón Cancelar)
  // NO cerrar al hacer click en el overlay — evita perder el código
  if (e) return;
  document.getElementById('league-modal-create').style.display = 'none';
  document.getElementById('league-modal-join').style.display   = 'none';
}

// ─────────────────────────────────────────────────────────────
// OBTENER league_id PARA QUERIES
// Todas las funciones de guardar predicciones deben llamar a esto.
// Si no hay liga activa, bloquea el guardado.
// ─────────────────────────────────────────────────────────────
function requireLeagueId() {
  if (!_activeLeague?.id) {
    console.warn('[leagues] No hay liga activa — redirigiendo a welcome');
    showPage('welcome');
    return null;
  }
  return _activeLeague.id;
}

// Exponer al ámbito global
window._activeLeague     = null;
window.leagueSelect      = leagueSelect;
window.leagueSelectById  = leagueSelectById;
window.leagueRenderPanel = leagueRenderPanel;
window.leagueShowCreate  = leagueShowCreate;
window.leagueShowJoin    = leagueShowJoin;
window.leagueDoCreate    = leagueDoCreate;
window.leagueDoJoin      = leagueDoJoin;
window.leagueCloseModals = leagueCloseModals;
window.requireLeagueId   = requireLeagueId;
window.getActiveLeagueId = getActiveLeagueId;
// Getter dinámico: siempre devuelve el valor actual de _myLeagues
// (necesario porque _myLeagues se reasigna en leagueLoadMyLeagues)
Object.defineProperty(window, '_myLeagues', {
  get: () => _myLeagues,
  configurable: true
});
