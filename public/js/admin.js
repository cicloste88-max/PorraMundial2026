/* admin.js — Porra Mundial 2026
   Usa: PARTIDOS, BRACKET, GRUPOS, SUPA_ANON, currentUser, db,
        predictions, koPredictions, resolvedSlots, window._porraToken,
        getActiveLeagueId, escapeHtml
   Expone: admInit, admTab, admLoadResults, admLoadUsers, admViewUser,
           admResetPorraCerrada, admReopenDirect, admForceSync,
           admLoadSistema, admSaveAwards
   Deps: auth.js, leagues.js, data.js, misc.js
   Notas: Ya refactorizado en sesión anterior.
*/
/* ══════════════════════════════════════════════
   PANEL ADMIN — lógica completa
   Usa la Edge Function admin-actions para todas
   las operaciones privilegiadas en Supabase.
══════════════════════════════════════════════ */

const ADM_FN = 'https://cmyfyswystjgzdwbqyyb.supabase.co/functions/v1/admin-actions';

// Estado local del panel
let _admCurrentUser  = null;  // usuario seleccionado en pestaña usuarios
let _admResultsData  = null;  // { match_results, overrides }
let _admGroupFilter  = 'todos';
let _admInited       = false;

// ── Helper: llamada autenticada a admin-actions ──────────────────
async function admCall(action, extra = {}) {
  let token = window._porraToken || sessionStorage.getItem("porra_token") || "";
  try {
    const { data } = await window._porraDb.auth.getSession();
    if (data?.session?.access_token) token = data.session.access_token;
  } catch(_) {}
  if (!token) {
    try {
      const { data } = await window._porraDb.auth.refreshSession();
      if (data?.session?.access_token) { token = data.session.access_token; window._porraToken = token; }
    } catch(_) {}
  }
  if (!token) return { ok: false, error: "Sin sesion activa. Cierra sesion y vuelve a entrar." };
  const res = await fetch(ADM_FN, {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": "Bearer " + token, "apikey": SUPA_ANON },
    body: JSON.stringify({ action, ...extra }),
  });
  return res.json();
}

// ── Toast ────────────────────────────────────────────────────────
function admToast(msg, type = 'ok') {
  const el = document.getElementById('adm-toast');
  if (!el) return;
  el.textContent = msg;
  el.className = `adm-toast show ${type === 'ok' ? 'ok-toast' : 'err-toast'}`;
  setTimeout(() => { el.className = 'adm-toast'; }, 3200);
}

// ── Tabs ─────────────────────────────────────────────────────────
function admTab(name) {
  ['resultados','usuarios','premios','sistema'].forEach(t => {
    document.getElementById('adm-tab-' + t).style.display = t === name ? 'block' : 'none';
  });
  document.querySelectorAll('.adm-tab').forEach((btn, i) => {
    btn.classList.toggle('active', ['resultados','usuarios','premios','sistema'][i] === name);
  });
  if (name === 'usuarios') { admLoadLeagueSelector(); admLoadUsers(); }
  if (name === 'premios') admLoadAwards();
  if (name === 'sistema')  admLoadSistema();
}

// ── Inicialización del panel ─────────────────────────────────────
async function admInit() {
  _admInited = false;
  admRenderStatusBar('loading');
  // Esperar token: polling con hasta 6s de margen
  // El token llega via onAuthStateChange tras el login
  for (let i = 0; i < 12; i++) {
    if (window._porraToken || sessionStorage.getItem('porra_token')) break;
    await new Promise(r => setTimeout(r, 500));
  }
  if (!window._porraToken && !sessionStorage.getItem('porra_token')) {
    admRenderStatusBar('error');
    document.getElementById('adm-status-bar').innerHTML = '<span class="adm-dot red"></span> Sin sesión activa — cierra sesión y vuelve a entrar';
    const tbody = document.getElementById('adm-results-tbody');
    if (tbody) tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#ef4444;padding:16px">Sin sesión activa</td></tr>';
    return;
  }
  // Paralelizar stats + results para reducir latencia
  const [statsRes, resultsRes] = await Promise.all([
    admCall('get_stats'),
    admCall('get_results'),
  ]);
  if (statsRes.ok) {
    const d = statsRes.data;
    document.getElementById('adm-m-users').textContent     = d.users ?? '—';
    document.getElementById('adm-m-results').textContent   = `${d.results_count ?? 0} / 72`;
    document.getElementById('adm-m-overrides').textContent = d.overrides_count ?? 0;
    const sync = d.last_sync ? new Date(d.last_sync).toLocaleString('es-ES',{day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'}) : '—';
    document.getElementById('adm-m-sync').textContent = sync;
    admRenderStatusBar('ok', d);
  } else {
    admRenderStatusBar('error');
    const tbody = document.getElementById('adm-results-tbody');
    if (tbody) tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#ef4444;padding:16px">${statsRes.error || 'Error de conexión'}</td></tr>`;
    return;
  }
  // Renderizar resultados con los datos ya recibidos (sin segunda llamada)
  if (resultsRes.ok) {
    const matchResults = resultsRes.data?.match_results ? JSON.parse(resultsRes.data.match_results) : {};
    const overrides    = resultsRes.data?.overrides     ? JSON.parse(resultsRes.data.overrides)     : {};
    _admResultsData    = { matchResults, overrides };
    admRenderResultsTable();
  }
  _admInited = true;
}

// ── Status bar ───────────────────────────────────────────────────
function admRenderStatusBar(state, data) {
  const bar = document.getElementById('adm-status-bar');
  if (!bar) return;
  if (state === 'loading') {
    bar.innerHTML = '<span class="adm-spinner"></span> Cargando estado del sistema...';
    return;
  }
  if (state === 'error') {
    bar.innerHTML = '<span class="adm-dot red"></span> Error conectando con Supabase';
    return;
  }
  const syncTxt = data?.last_sync
    ? `Última sync: ${new Date(data.last_sync).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'})}`
    : 'Sin sincronizar';
  bar.innerHTML = `
    <span class="adm-dot green"></span><span>Edge Function activa</span>
    <span class="adm-status-sep">·</span>
    <span class="adm-dot amber"></span><span>pg_cron pausado hasta 11 jun</span>
    <span class="adm-status-sep">·</span>
    <span class="adm-dot gray"></span><span>${syncTxt}</span>
    <span style="margin-left:auto">
      <button class="adm-btn primary" onclick="admForceSync()" style="font-size:11px">⚡ Sync ahora</button>
    </span>`;
}

// ── TAB RESULTADOS ───────────────────────────────────────────────
async function admLoadResults() {
  const tbody = document.getElementById('adm-results-tbody');
  if (!tbody) return;
  tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;color:#4b5563;padding:16px"><span class="adm-spinner"></span> Cargando...</td></tr>';
  const r = await admCall('get_results');
  if (!r.ok) {
    tbody.innerHTML = `<tr><td colspan="5" style="text-align:center;color:#ef4444;padding:16px">Error: ${escapeHtml(r.error)}</td></tr>`;
    return;
  }
  const matchResults = r.data?.match_results ? JSON.parse(r.data.match_results) : {};
  const overrides    = r.data?.overrides     ? JSON.parse(r.data.overrides)     : {};
  _admResultsData    = { matchResults, overrides };
  admRenderResultsTable();
  if(typeof window.refreshBracketResults==='function') window.refreshBracketResults();
}

function admRenderResultsTable() {
  const tbody = document.getElementById('adm-results-tbody');
  if (!tbody || !_admResultsData) return;
  const { matchResults, overrides } = _admResultsData;
  const filter = _admGroupFilter;
  let rows = '';
  const lista = typeof PARTIDOS !== 'undefined' ? PARTIDOS : [];
  lista.forEach(m => {
    if (filter !== 'todos' && m.group !== filter) return;
    const key = `${m.group}_${m.home}_${m.away}`;
    const res = matchResults[key];
    const isOverride = !!overrides[key];
    const hasResult  = res !== undefined;
    const pillHtml   = isOverride
      ? '<span class="adm-pill override">Override manual</span>'
      : hasResult
        ? '<span class="adm-pill ok">OK (API)</span>'
        : '<span class="adm-pill pending">Pendiente</span>';
    const lVal = hasResult ? res.l : '';
    const vVal = hasResult ? res.v : '';
    const actionHtml = isOverride
      ? `<button class="adm-btn danger" onclick="admClearOverride('${key}')">Revertir a API</button>`
      : `<button class="adm-btn primary" onclick="admSaveOverride('${key}')">Guardar override</button>`;
    rows += `<tr data-group="${m.group}">
      <td style="white-space:nowrap">${m.home} vs ${m.away}</td>
      <td style="color:#6b7280">${m.group}</td>
      <td>
        <span style="display:flex;align-items:center;gap:4px">
          <input class="adm-score-inp" id="inp-l-${key.replace(/[^a-zA-Z0-9]/g,'_')}" value="${lVal}" placeholder="—">
          <span class="adm-vs">-</span>
          <input class="adm-score-inp" id="inp-v-${key.replace(/[^a-zA-Z0-9]/g,'_')}" value="${vVal}" placeholder="—">
        </span>
      </td>
      <td>${pillHtml}</td>
      <td>${actionHtml}</td>
    </tr>`;
  });
  tbody.innerHTML = rows || '<tr><td colspan="5" style="text-align:center;color:#4b5563;padding:16px">Sin partidos para este filtro</td></tr>';
}

function admFilterGroup(grp) {
  _admGroupFilter = grp;
  document.querySelectorAll('[id^="adm-grp-"]').forEach(b => {
    b.style.borderColor = ''; b.style.color = '';
  });
  const active = document.getElementById('adm-grp-' + grp);
  if (active) { active.style.borderColor = '#4b5563'; active.style.color = '#fff'; }
  admRenderResultsTable();
}

async function admSaveOverride(key) {
  const safeKey = key.replace(/[^a-zA-Z0-9]/g,'_');
  const lEl = document.getElementById('inp-l-' + safeKey);
  const vEl = document.getElementById('inp-v-' + safeKey);
  const l = parseInt(lEl?.value, 10);
  const v = parseInt(vEl?.value, 10);
  if (isNaN(l) || isNaN(v)) { admToast('Introduce marcador válido (números)', 'err'); return; }
  const r = await admCall('set_override', { match_key: key, l, v });
  if (r.ok) { admToast(`✓ Override guardado: ${l}-${v}`); await admLoadResults(); }
  else admToast('Error: ' + r.error, 'err');
}

async function admClearOverride(key) {
  if (!confirm(`¿Revertir "${key}" a los datos de la API?`)) return;
  const r = await admCall('clear_override', { match_key: key });
  if (r.ok) { admToast('✓ Override eliminado'); await admLoadResults(); }
  else admToast('Error: ' + r.error, 'err');
}

// ── TAB USUARIOS ─────────────────────────────────────────────────
let _admUsersCache = null;
let _admLeaguesCache = null;
let _admSelectedLeagueId = null;

async function admLoadLeagueSelector() {
  const sel = document.getElementById('adm-league-select');
  if (!sel) return;
  if (_admLeaguesCache) { _admPopulateSelector(sel); return; }
  const r = await admCall('get_leagues');
  if (!r.ok) return;
  _admLeaguesCache = (r.data ?? []).sort((a, b) => a.nombre.localeCompare(b.nombre));
  _admPopulateSelector(sel);
}

function _admPopulateSelector(sel) {
  const prev = sel.value;
  sel.innerHTML = '<option value="">— Selecciona una liga —</option>';
  (_admLeaguesCache ?? []).forEach(lg => {
    const opt = document.createElement('option');
    opt.value = lg.id;
    const members = lg.league_members?.length ?? '?';
    opt.textContent = lg.nombre + ' (' + lg.codigo + ') · ' + members + ' miembros';
    sel.appendChild(opt);
  });
  if (prev) { sel.value = prev; }
  else {
    const activeId = getActiveLeagueId();
    if (activeId) sel.value = activeId;
  }
  _admSelectedLeagueId = sel.value || null;
}

function admOnLeagueChange() {
  const sel = document.getElementById('adm-league-select');
  _admSelectedLeagueId = sel?.value || null;
  _admUsersCache = null;
  const container = document.getElementById('adm-users-list');
  if (!_admSelectedLeagueId) {
    if (container) container.innerHTML = '<div style="text-align:center;color:#4b5563;padding:20px">Selecciona una liga para ver sus usuarios.</div>';
    return;
  }
  admLoadUsers(true);
}

function admRenderUsers(users, container) {
  if (!users || !users.length) {
    container.innerHTML = '<div style="color:#4b5563;padding:12px">Sin usuarios en esta liga.</div>';
    return;
  }
  container.innerHTML = users.map(u => {
    const ini     = (u.nombre || '?').charAt(0).toUpperCase();
    const colors  = ['#1e1b4b','#14532d','#78350f','#1c1917','#0c4a6e'];
    const clr     = colors[ini.charCodeAt(0) % colors.length];
    const textClr = ['#a5b4fc','#86efac','#fcd34d','#a8a29e','#7dd3fc'][ini.charCodeAt(0) % 5];
    const adminBadge = u.is_admin ? '<span class="adm-pill admin" style="margin-left:6px">admin</span>' : '';
    const cerrBadge  = u.porra_cerrada
      ? '<span class="adm-pill" style="margin-left:6px;background:#78350f;color:#fcd34d">\uD83D\uDD12 Cerrada</span>'
      : '<span class="adm-pill ok" style="margin-left:6px">Abierta</span>';
    const predInfo = u.pred_count !== null
      ? `Grupos: ${u.pred_count} \u00b7 KO: ${u.ko_pred_count} \u00b7 Premios: ${u.has_awards ? 's\u00ed' : 'no'}`
      : 'Sin datos de pron\u00f3sticos';
    const nb = escapeHtml(u.nombre || u.id);
    return `<div class="adm-card adm-card-body" style="margin-bottom:8px">
      <div class="adm-row">
        <div class="adm-user-row">
          <div class="adm-avatar" style="background:${clr};color:${textClr}">${ini}</div>
          <div>
            <div style="font-size:13px;font-weight:600;color:#fff">${nb}${adminBadge}${cerrBadge}</div>
            <div style="font-size:11px;color:#6b7280;margin-top:2px">${predInfo}</div>
          </div>
        </div>
        <div style="display:flex;gap:6px;flex-wrap:wrap">
          ${u.porra_cerrada ? `<button class="adm-btn amber" onclick="admResetPorraCerrada('${u.id}','${nb}')">\uD83D\uDD13 Reabrir porra</button>` : ''}
          <button class="adm-btn primary" onclick="admViewUser('${u.id}','${nb}')">Ver pron\u00f3sticos</button>
        </div>
      </div>
      <div id="adm-upreds-${u.id}" style="display:none;margin-top:12px;font-size:11px;color:#6b7280;border-top:1px solid #1a1a22;padding-top:10px">Cargando...</div>
    </div>`;
  }).join('');
}

async function admLoadUsers(forceRefresh = false) {
  const container = document.getElementById('adm-users-list');
  if (!container) return;
  if (!_admSelectedLeagueId) {
    container.innerHTML = '<div style="text-align:center;color:#4b5563;padding:20px">Selecciona una liga para ver sus usuarios.</div>';
    return;
  }
  if (_admUsersCache && !forceRefresh) {
    admRenderUsers(_admUsersCache, container);
    return;
  }
  container.innerHTML = '<div style="text-align:center;color:#4b5563;padding:20px"><span class="adm-spinner"></span> Cargando...</div>';
  const r = await admCall('get_users', { league_id: _admSelectedLeagueId });
  if (!r.ok) { container.innerHTML = '<div style="color:#ef4444;padding:12px">Error: ' + escapeHtml(r.error) + '</div>'; return; }
  const users = r.data ?? [];
  _admUsersCache = users;
  admRenderUsers(users, container);
}

async function admViewUser(uid, nombre) {
  const el = document.getElementById('adm-upreds-' + uid);
  if (!el) return;
  if (el.style.display !== 'none') { el.style.display = 'none'; return; }
  const _admLeagueId = _admSelectedLeagueId || getActiveLeagueId();
  if (!_admLeagueId) {
    el.style.display = 'block';
    el.innerHTML = '<span style="color:#f59e0b;font-size:11px">⚠ Selecciona una liga en el selector para ver pronósticos.</span>';
    return;
  }
  el.style.display = 'block';
  el.innerHTML = '<span class="adm-spinner"></span> Cargando pronósticos...';
  const r = await admCall('get_user_predictions', { user_id: uid, league_id: _admLeagueId });
  if (!r.ok || !r.data) { el.innerHTML = `<span style="color:#ef4444">Error: ${escapeHtml(r.error || 'Sin datos')}</span>`; return; }
  const preds   = r.data.predictions   ?? [];
  const koPreds = r.data.ko_predictions ?? [];
  const awards  = r.data.awards;

  let html = `<div style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">⚽ Fase de grupos (${preds.length})</div>`;
  if (preds.length) {
    html += '<table style="font-size:11px;border-collapse:collapse;width:100%;margin-bottom:12px">';
    html += '<tr><th style="text-align:left;color:#4b5563;padding:2px 8px 4px 0;font-weight:500">Match ID</th><th style="color:#4b5563;padding:2px 8px;font-weight:500">Resultado</th><th style="color:#4b5563;padding:2px 8px;font-weight:500">Goleador</th><th style="color:#4b5563;padding:2px 0;font-weight:500">Acción</th></tr>';
    preds.forEach(p => {
      html += `<tr><td style="color:#9ca3af;padding:2px 8px 2px 0;font-family:monospace;font-size:10px">${p.match_id}</td><td style="color:#4ade80;padding:2px 8px;font-weight:600">${p.local}-${p.visitante}</td><td style="color:#9ca3af;padding:2px 8px">${escapeHtml(p.scorer)||'—'}</td><td style="padding:2px 0"><button class="adm-btn primary" style="font-size:10px;padding:2px 8px" onclick="admReopenDirect('${uid}','groups','${p.match_id}')">Reabrir</button></td></tr>`;
    });
    html += '</table>';
  } else { html += '<div style="color:#4b5563;font-size:11px;margin-bottom:12px">Ninguno</div>'; }

  html += `<div style="font-size:11px;font-weight:600;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-bottom:6px">🏆 Eliminatorias (${koPreds.length})</div>`;
  if (koPreds.length) {
    html += '<table style="font-size:11px;border-collapse:collapse;width:100%;margin-bottom:12px">';
    html += '<tr><th style="text-align:left;color:#4b5563;padding:2px 8px 4px 0;font-weight:500">Partido</th><th style="color:#4b5563;padding:2px 8px;font-weight:500">Resultado</th><th style="color:#4b5563;padding:2px 8px;font-weight:500">Clasifica</th><th style="color:#4b5563;padding:2px 0;font-weight:500">Acción</th></tr>';
    const _allBracket = [...BRACKET.r32,...BRACKET.r16,...BRACKET.qf,...BRACKET.sf,...BRACKET.third,...BRACKET.final];
    const _koRoundLabel = id => {
      if(id<=88) return 'R32'; if(id<=96) return 'Oct'; if(id<=100) return 'QF';
      if(id<=102) return 'SF'; if(id===103) return '3º'; return 'Final';
    };
    koPreds.forEach(p => {
      const bMatch = _allBracket.find(m => m.id === p.match_id);
      const homeSlot = bMatch ? (resolvedSlots[bMatch.home] || bMatch.home) : '?';
      const awaySlot = bMatch ? (resolvedSlots[bMatch.away] || bMatch.away) : '?';
      const matchName = `${homeSlot} vs ${awaySlot}`;
      const roundTag = _koRoundLabel(p.match_id);
      html += `<tr><td style="color:#9ca3af;padding:2px 8px 2px 0;font-size:10px"><span style="color:#4b5563;font-size:9px;margin-right:4px">${roundTag}</span>${matchName}</td><td style="color:#4ade80;padding:2px 8px;font-weight:600">${p.local}-${p.visitante}</td><td style="color:#a5b4fc;padding:2px 8px;font-size:10px">${escapeHtml(p.classifier)||'—'}</td><td style="padding:2px 0"><button class="adm-btn primary" style="font-size:10px;padding:2px 8px" onclick="admReopenDirect('${uid}','ko',${p.match_id})">Reabrir</button></td></tr>`;
    });
    html += '</table>';
  } else { html += '<div style="color:#4b5563;font-size:11px;margin-bottom:12px">Ninguno</div>'; }

  if (awards) html += `<div style="font-size:11px;color:#6b7280;border-top:1px solid #1a1a22;padding-top:8px;margin-top:4px">🏅 Premios — Balón: <span style="color:#d1d5db">${awards.golden_ball||'—'}</span> · Bota: <span style="color:#d1d5db">${awards.golden_boot||'—'}</span> · Guante: <span style="color:#d1d5db">${awards.golden_glove||'—'}</span> · Joven: <span style="color:#d1d5db">${awards.young_player||'—'}</span></div>`;
  el.innerHTML = html;
}

async function admResetPorraCerrada(uid, nombre) {
  if(!confirm(`¿Reabrir la porra de ${nombre}? Podrá volver a editar y cerrar sus pronósticos.`)) return;
  const _rrLeagueId = _admSelectedLeagueId || getActiveLeagueId();
  const r = await admCall('reset_porra_cerrada', { user_id: uid, league_id: _rrLeagueId });
  if(r.ok) {
    // Si es el mismo usuario que está logueado, actualizar estado en memoria
    if (currentUser && currentUser.id === uid) {
      window._porraCerrada = false;
      // Re-habilitar todos los controles bloqueados
      document.querySelectorAll('.sbn,.gsel,.btn-save,.dice-btn').forEach(el => {
        el.disabled = false;
        el.style.pointerEvents = '';
        el.style.display = '';
      });
      const diceBar = document.getElementById('dice-global-bar');
      if(diceBar) diceBar.style.display = 'flex';
      checkFinalizarReady();
    }
    admToast('✓ Porra reabierta. Si es otro usuario debe recargar la página.');
    _admUsersCache = null;
    admLoadUsers(true);
  } else admToast('Error: ' + (r.error || 'desconocido'), 'err');
}

async function admReopenDirect(uid, type, matchId) {
  const action  = type === 'ko' ? 'reopen_ko_prediction' : 'reopen_prediction';
  const _rLeagueId = _admSelectedLeagueId || getActiveLeagueId();
  const payload = { user_id: uid, match_id: matchId, league_id: _rLeagueId };
  const r = await admCall(action, payload);
  if (r.ok) {
    // Si el admin está reabriendo su propio pronóstico, limpiar estado en memoria
    if (currentUser && currentUser.id === uid) {
      if (type === 'groups' && typeof matchId === 'string') {
        if (predictions[matchId]) {
          predictions[matchId].saved = false;
          predictions[matchId].lockedByUser = false;
        }
      } else if (type === 'ko' && typeof matchId === 'number') {
        if (koPredictions[matchId]) koPredictions[matchId].saved = false;
        if (koPredictions[String(matchId)]) koPredictions[String(matchId)].saved = false;
      }
      window._porraCerrada = false;
      if (typeof refreshAllViews === 'function') refreshAllViews();
      if (typeof renderGroupTableCard === 'function') GRUPOS.forEach(g => renderGroupTableCard(g.letra));
      checkFinalizarReady();
    }
    admToast('✓ Reabierto. Si es otro usuario debe recargar la página.');
    _admUsersCache = null; admLoadUsers(true);
  } else admToast('Error: ' + (r.error || 'desconocido'), 'err');
}


// admShowReopen / admReopenPrediction eliminados — el panel inline fue reemplazado
// por los botones "Reabrir" directamente en cada fila de admViewUser.



// ── TAB PREMIOS ──────────────────────────────────────────────────
async function admLoadAwards() {
  const r = await admCall('get_results');
  if (!r.ok || !r.data?.award_winners) return;
  const aw = JSON.parse(r.data.award_winners);
  ['golden_ball','golden_boot','golden_glove','young_player'].forEach(k => {
    const el = document.getElementById('adm-aw-' + k);
    if (el && aw[k]) el.value = aw[k];
  });
}

async function admSaveAwards() {
  const winners = {};
  ['golden_ball','golden_boot','golden_glove','young_player'].forEach(k => {
    const v = document.getElementById('adm-aw-' + k)?.value.trim();
    if (v) winners[k] = v;
  });
  const r = await admCall('set_award_winners', { winners });
  if (r.ok) admToast('✓ Premios guardados');
  else admToast('Error: ' + r.error, 'err');
}

// ── TAB SISTEMA ──────────────────────────────────────────────────
async function admLoadSistema() {
  const r = await admCall('get_stats');
  if (!r.ok) return;
  const d = r.data;
  const statsEl = document.getElementById('adm-db-stats');
  if (statsEl) {
    statsEl.innerHTML = `
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px 20px">
        <div><span style="color:#6b7280">Usuarios registrados:</span> <strong style="color:#fff">${d.users}</strong></div>
        <div><span style="color:#6b7280">Pronósticos grupos:</span> <strong style="color:#fff">${d.predictions}</strong></div>
        <div><span style="color:#6b7280">Pronósticos KO:</span> <strong style="color:#fff">${d.ko_predictions}</strong></div>
        <div><span style="color:#6b7280">Picks de premios:</span> <strong style="color:#fff">${d.award_picks}</strong></div>
        <div><span style="color:#6b7280">Resultados cargados:</span> <strong style="color:#22c55e">${d.results_count} / 72</strong></div>
        <div><span style="color:#6b7280">Overrides activos:</span> <strong style="color:#f59e0b">${d.overrides_count}</strong></div>
      </div>`;
  }
  // Log
  const logEl = document.getElementById('adm-sync-log');
  if (logEl && d.last_sync) {
    logEl.innerHTML = `<span class="lg-ok">✓ Última actualización: ${new Date(d.last_sync).toLocaleString('es-ES')}</span><br><span class="lg-info">ℹ Resultados en DB: ${d.results_count}</span>`;
  }
}

async function admForceSync() {
  admToast('Sincronizando con football-data.org...');
  const r = await admCall('force_sync');
  if (r.ok && r.data?.ok) {
    const log = (r.data.log ?? []).join('\n');
    admToast('✓ Sync completada');
    const logEl = document.getElementById('adm-sync-log');
    if (logEl) logEl.innerHTML = (r.data.log ?? []).map(l =>
      `<span class="${l.startsWith('✅')||l.startsWith('✓')?'lg-ok':l.startsWith('⚠')?'lg-warn':l.startsWith('❌')?'lg-err':'lg-info'}">${l}</span>`
    ).join('<br>');
    await admInit();
  } else {
    admToast('Error en sync: ' + (r.data?.error ?? r.error ?? 'desconocido'), 'err');
  }
}

async function admCronPause() {
  if (!confirm('¿Pausar el pg_cron? Los resultados dejarán de actualizarse automáticamente.')) return;
  const r = await admCall('cron_pause');
  if (r.ok) admToast('✓ pg_cron pausado');
  else admToast('Error: ' + r.error, 'err');
  admLoadSistema();
}

async function admCronResume() {
  if (!confirm('¿Activar el pg_cron? Actualizará resultados cada 5 minutos.')) return;
  const r = await admCall('cron_resume');
  if (r.ok) admToast('✓ pg_cron activado (cada 5 min)');
  else admToast('Error: ' + r.error, 'err');
  admLoadSistema();
}

async function admClearAllOverrides() {
  if (!confirm('¿Limpiar TODOS los overrides manuales? Los resultados volverán a los datos de la API.')) return;
  const r = await admCall('clear_all_overrides');
  if (r.ok) { admToast('✓ Overrides eliminados'); await admInit(); }
  else admToast('Error: ' + r.error, 'err');
}

async function admResetResults() {
  if (!confirm('⚠ PELIGRO: ¿Resetear la tabla results? Se borrarán TODOS los resultados y overrides. Esta acción es irreversible.')) return;
  if (!confirm('Segunda confirmación: ¿estás seguro?')) return;
  const r = await admCall('reset_results');
  if (r.ok) { admToast('Tabla results reseteada'); await admInit(); }
  else admToast('Error: ' + r.error, 'err');
}


/* ══════════════════════════════════════════════
   DADO ALEATORIO — Simulación de pronósticos
   Genera resultados realistas y ponderados.
   Archivo destino : dice.js
   ─────────────────────────────────────────────────────────────
   Usa             : PARTIDOS, BRACKET, predictions, koPredictions
   Expone          : dicePickScore, diceSimulateMatch, diceSimulateAllKO
   Deps            : js-main, js-ligas
   Notas           : Bajo riesgo de extracción.
══════════════════════════════════════════════ */

// Marcadores ponderados (más frecuentes los bajos)
  // ─────────────────────────────────────────────────────────────
  // DADOS ALEATORIOS — dicePickScore, diceSimulateMatch,
  //   diceSimulateGroup, diceSimulateAllGroups, diceSimulateAllKO,
  //   diceSimulateKOMatch, _diceKOAndRefresh
  // ─────────────────────────────────────────────────────────────
const DICE_SCORES = [
  [0,0],[0,1],[1,0],[1,1],[2,0],[0,2],
  [2,1],[1,2],[2,2],[3,0],[0,3],[3,1],
  [1,3],[3,2],[2,3],[4,0],[0,4],[4,1],[1,4]
];
const DICE_WEIGHTS = [
  4, 8, 8, 7, 7, 7,
  9, 9, 5, 4, 4, 5,
  5, 3, 3, 2, 2, 2, 2
]; // suma = 96

function dicePickScore() {
  const total = DICE_WEIGHTS.reduce((a,b)=>a+b,0);
  let r = Math.random() * total;
  for(let i=0;i<DICE_SCORES.length;i++){
    r -= DICE_WEIGHTS[i];
    if(r <= 0) return DICE_SCORES[i];
  }
  return DICE_SCORES[0];
}

function dicePickScorer(match) {
  // Recoger opciones del select de goleador
  const allIdx = PARTIDOS.findIndex(p=>p===match);
  if(allIdx<0) return '';
  const sel = document.getElementById('gsel-'+allIdx);
  if(!sel) return '';
  const opts = [...sel.options].filter(o=>o.value && o.value !== '');
  if(!opts.length) return '';
  return opts[Math.floor(Math.random()*opts.length)].value;
}

// Simula UN partido de grupos
function diceSimulateMatch(match) {
  if(window._porraCerrada) return; // porra cerrada, no modificar
  const idx  = PARTIDOS.findIndex(p=>p===match);
  if(idx < 0) return;
  const key  = getMatchKey(match);
  const pred = predictions[key] || (predictions[key] = {});
  if(pred.saved || pred.lockedByUser) return; // no tocar bloqueados

  const [l, v] = dicePickScore();
  const gol    = dicePickScorer(match);

  Object.assign(pred, { l, v, gol, saved: true, lockedByUser: true });

  // Actualizar UI de la tarjeta completa
  const slEl  = document.getElementById('sl-'+idx);
  const svEl  = document.getElementById('sv-'+idx);
  const gselEl= document.getElementById('gsel-'+idx);
  if(slEl)   { slEl.textContent = l; slEl.className = 'sbox on'; }
  if(svEl)   { svEl.textContent = v; svEl.className = 'sbox on'; }
  if(gselEl) { gselEl.value = gol; }

  // Actualizar la UI de la tarjeta completa (estado guardado)
  if(typeof updateCardUI === 'function') updateCardUI(idx, match);
}

// Simula todos los partidos de un grupo y guarda en Supabase
function diceSimulateGroup(letra) {
  const matches = PARTIDOS.filter(m=>m.group===letra);
  matches.forEach(m=>diceSimulateMatch(m));
  if(typeof renderGroupTableCard==='function') renderGroupTableCard(letra);
  savePredictions();
}

// Simula TODOS los grupos (72 partidos) y guarda en Supabase
function diceSimulateAllGroups() {
  if(window._porraCerrada) return;
  if(!confirm('¿Simular aleatoriamente los 72 partidos de grupos que aún no están guardados?')) return;
  PARTIDOS.forEach(m=>diceSimulateMatch(m));
  GRUPOS.forEach(g=>{ if(typeof renderGroupTableCard==='function') renderGroupTableCard(g.letra); });
  // Guardar en Supabase — checkFinalizarReady se llama desde savePredictions tras confirmar
  savePredictions();
}

// Función global que simula un partido KO y refresca el modal
window._diceKOAndRefresh = function(matchId) {
  diceSimulateKOMatch(matchId);
  // Forzar refresh del modal completo para que updateModalUI coja el nuevo estado
  // Buscamos el match en los brackets
  const allMatches = [
    ...BRACKET.r32,...BRACKET.r16,...BRACKET.qf,
    ...BRACKET.sf,...BRACKET.third,...BRACKET.final
  ];
  const match = allMatches.find(m => m.id === matchId);
  if(match) {
    // Usar openModal que ya tiene updateModalUI en su closure
    openModal(match);
  }
};

// Simula UN partido KO individual (desde el modal)
function diceSimulateKOMatch(matchId) {
  const pred = koPredictions[matchId] || koPredictions[String(matchId)];
  if(pred && pred.saved) return; // no tocar guardados

  // Resolver equipos del slot
  const home = resolvedSlots[
    [...BRACKET.r32,...BRACKET.r16,...BRACKET.qf,...BRACKET.sf,...BRACKET.third,...BRACKET.final]
    .find(m=>m.id===matchId)?.home || ''
  ] || null;
  const away = resolvedSlots[
    [...BRACKET.r32,...BRACKET.r16,...BRACKET.qf,...BRACKET.sf,...BRACKET.third,...BRACKET.final]
    .find(m=>m.id===matchId)?.away || ''
  ] || null;

  let [l, v] = dicePickScore();
  let classifier = null;

  if(home && away) {
    classifier = l > v ? home : l < v ? away : (Math.random() < 0.5 ? home : away);
  }

  // Seleccionar goleador aleatorio del select del modal
  let gol = null;
  const gselModal = document.getElementById('modal-gsel');
  if(gselModal) {
    const opts = [...gselModal.options].filter(o => o.value && o.value !== '');
    if(opts.length) gol = opts[Math.floor(Math.random() * opts.length)].value;
  }
  // Si 0-0, sin goleador
  if(l === 0 && v === 0) gol = null;

  koPredictions[matchId] = { l, v, classifier, gol, saved: true };
  koPredictions[String(matchId)] = koPredictions[matchId];

  // Actualizar display del marcador en el modal
  const scoreL = document.getElementById('modal-sl');
  const scoreR = document.getElementById('modal-sv');
  if(scoreL) { scoreL.textContent = l; scoreL.classList.add('on'); }
  if(scoreR) { scoreR.textContent = v; scoreR.classList.add('on'); }
  if(gselModal && gol) gselModal.value = gol;

  // Actualizar clasificado si hay empate
  const penSel = document.getElementById('modal-pen-sel');
  if(penSel && l === v && classifier) penSel.value = classifier;
}

// Simula todos los partidos KO (32 partidos) procesando ronda a ronda
// para que resolvedSlots se actualice entre rondas
function diceSimulateAllKO() {
  if(window._porraCerrada) return;
  if(!confirm('¿Simular aleatoriamente los 32 partidos de eliminatorias que aún no están guardados?')) return;

  // Resolver los slots base (desde grupos) antes de empezar
  if(typeof resolveAllSlots === 'function') resolveAllSlots();

  // Procesar ronda a ronda: r32 → r16 → qf → sf → third → final
  // Después de cada partido, registrar el clasificado en resolvedSlots
  // para que la siguiente ronda pueda resolverse correctamente
  const rounds = [BRACKET.r32, BRACKET.r16, BRACKET.qf, BRACKET.sf, BRACKET.third, BRACKET.final];

  rounds.forEach(roundMatches => {
    roundMatches.forEach(m => {
      const pred = koPredictions[m.id] || koPredictions[String(m.id)];
      if(pred && pred.saved) {
        // Ya guardado: registrar ganador y perdedor en resolvedSlots
        if(pred.classifier) {
          resolvedSlots[`W${m.id}`] = pred.classifier;
          // Calcular el perdedor para el partido de 3er puesto
          const _h = resolvedSlots[m.home] || m.home;
          const _a = resolvedSlots[m.away] || m.away;
          const _loser = pred.classifier === _h ? _a : _h;
          if(_loser && _loser !== m.home && _loser !== m.away) resolvedSlots[`L${m.id}`] = _loser;
        }
        return;
      }

      const homeTeam = resolvedSlots[m.home] || m.home;
      const awayTeam = resolvedSlots[m.away] || m.away;

      // Saltar si los slots siguen siendo códigos sin resolver
      const isUnresolved = (t) => !t || t === m.home || t === m.away ||
        /^[12][A-L]$/.test(t) || /^[3-8][A-L]/.test(t) || t.startsWith('Mejor');
      if(isUnresolved(homeTeam) || isUnresolved(awayTeam)) return;

      let [l, v] = dicePickScore();
      const classifier = l > v ? homeTeam : l < v ? awayTeam : (Math.random() < 0.5 ? homeTeam : awayTeam);

      koPredictions[m.id] = { l, v, classifier, gol: null, saved: true };
      koPredictions[String(m.id)] = koPredictions[m.id];

      // Registrar ganador (W) y perdedor (L) para 3er puesto
      resolvedSlots[`W${m.id}`] = classifier;
      const loser = classifier === homeTeam ? awayTeam : homeTeam;
      resolvedSlots[`L${m.id}`] = loser;
    });
  });

  // Guardar en Supabase y refrescar
  saveKO();
  if(typeof refreshAllViews === 'function') refreshAllViews();
  if(typeof koInit === 'function') koInit();
  checkFinalizarReady();
}


// Bloquear TODAS las tarjetas cuando porra_cerrada = true
// Se llama tras cargar el perfil del usuario para asegurar que
// las tarjetas ya renderizadas también quedan bloqueadas.
  // ─────────────────────────────────────────────────────────────
  // BLOQUEO DE PORRA CERRADA — lockAllCardsIfCerrada()
  //   Deshabilita toda edición en UI cuando porra_cerrada=true.
  //   Se llama desde onAuthStateChange y desde renderNextGroup.
  // ─────────────────────────────────────────────────────────────
function lockAllCardsIfCerrada() {
  if (!window._porraCerrada) return;
  // 1. Bloquear steppers
  document.querySelectorAll('.sbn').forEach(el => {
    el.style.pointerEvents = 'none';
    el.style.opacity = '0.3';
  });
  // 2. Bloquear selects de goleador
  document.querySelectorAll('.gsel').forEach(el => {
    el.disabled = true;
    el.style.cursor = 'not-allowed';
    el.style.opacity = '0.6';
  });
  // 3. Bloquear botones guardar
  document.querySelectorAll('.btn-save').forEach(el => {
    el.disabled = true;
    el.style.opacity = '0.3';
  });
  // 4. Ocultar botones "Deshacer" — clave para evitar modificaciones
  document.querySelectorAll('.btn-undo').forEach(el => {
    el.style.display = 'none';
  });
  // 5. En el modal KO, ocultar el botón Deshacer
  document.querySelectorAll('[onclick*="undoKO"]').forEach(el => {
    el.style.display = 'none';
  });
  // 6. Ocultar dados
  document.querySelectorAll('.dice-btn').forEach(el => {
    el.style.display = 'none';
  });
  // 7. Ocultar barras globales de dados
  const diceBar = document.getElementById('dice-global-bar');
  if (diceBar) diceBar.style.display = 'none';
  const koDiceBtn = document.getElementById('ko-dice-btn');
  if (koDiceBtn) koDiceBtn.style.display = 'none';
  // 8. Añadir overlay visual sobre la sección de finalizar
  const finCard = document.getElementById('finalizar-card');
  if (finCard) finCard.style.pointerEvents = 'none';
}
// Cargar premios cuando se entra a la pestaña premios
const _admTabOrig = window.admTab;
