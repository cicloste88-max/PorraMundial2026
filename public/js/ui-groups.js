// ui-groups.js - Porra Mundial 2026 / sub-bloque js-ui-groups
// UI de fase de grupos: savePredictions, checkGroupsComplete, finalizarPorra,
// renderMatchCard, openModal, updateCardUI, renderGroupTableCard, refreshGroupTables.
// Deps: data.js, scoring.js, auth.js, leagues.js

// ========== INICIALIZACIÓN ==========
  // ─────────────────────────────────────────────────────────────
  /*
     js-ui-groups — UI tarjetas grupos, modal, predicciones
     Archivo destino : ui-groups.js
     -----------------------------------------------------------
     Usa             : PARTIDOS, EQUIPOS, predictions, db, currentUser
     Expone          : renderMatchCard, updateCardUI, openModal, savePredictions, renderGroupTableCard, refreshGroupTables
     Deps            : js-data, js-auth, js-ligas
     Notas           : Bloque mas grande. Toda la UI de fase de grupos.
================================================================ */
// GUARDAR PREDICCIONES DE GRUPOS — savePredictions,
  //   checkGroupsComplete, finalizarPorra (inicio del bloque cerrar)
  // ─────────────────────────────────────────────────────────────
function savePredictions() {
  try { localStorage.setItem('porra_predictions', JSON.stringify(predictions)); } catch(e) {}
  // Sincronizar con Supabase si hay sesión activa
  if (currentUser) {
    if (window._porraCerrada) return; // porra cerrada — no escribir en DB
    const leagueId = getActiveLeagueId();
    if (!leagueId) return; // sin liga activa no se guarda
    const rows = Object.entries(predictions)
      .filter(([, p]) => p && p.saved)
      .map(([match_id, p]) => ({
        user_id:   currentUser.id,
        league_id: leagueId,
        match_id,
        local:     p.l,
        visitante: p.v,
        scorer:    p.gol || null
      }));
    if (rows.length > 0) {
      db.from('predictions').upsert(rows, { onConflict: 'league_id,user_id,match_id' })
        .then(({ error }) => {
          if (error) console.warn('Error guardando predictions:', error.message);
          // Llamar checkFinalizarReady tras confirmar guardado en DB
          checkFinalizarReady();
        });
      return; // checkFinalizarReady se llama en el .then
    }
  }
}

function checkGroupsComplete() {
  // F7.4-D-A: helper puro — solo computa el flag global consumido por
  // el gate Fase final en bottom-tab.js (#fc-gate-modal). El btn header y
  // el banner CTA fueron eliminados con la migración a pages dedicadas.
  if (!boostPicks) return;
  let filled = 0;
  PARTIDOS.forEach(m => {
    const p = predictions[getMatchKey(m)];
    if (p && p.saved) filled++;
  });
  const total = PARTIDOS.length;
  const diasConPartidos = [...new Set(PARTIDOS.map(m => m.date?.substring(0,10)).filter(Boolean))];
  const boostsCompletos = diasConPartidos.every(d => boostPicks[d]);
  window._gruposComplete = (filled >= total && boostsCompletos);
}


/* ── Ticker de jornadas de boost — pastillas en barra superior ── */
function renderBoostTicker() {
  const ticker = document.getElementById('boost-ticker');
  if (!ticker) return;

  // Calcular todas las jornadas de grupos
  const jornadasMap = {};
  PARTIDOS.forEach((m, idx) => {
    const date = m.date?.substring(0,10);
    if (!date) return;
    if (!jornadasMap[date]) jornadasMap[date] = [];
    jornadasMap[date].push({ idx, home: m.home, away: m.away });
  });

  const today = new Date().toISOString().substring(0,10);
  const jornadas = Object.keys(jornadasMap).sort();

  // Jornadas pendientes de boost (sin asignar)
  const pendientes = jornadas.filter(d => !boostPicks[d]);
  // Jornada de hoy si existe
  const jornadaHoy = jornadasMap[today];

  if (pendientes.length === 0 && !jornadaHoy) {
    ticker.style.display = 'none';
    return;
  }

  ticker.style.display = 'flex';
  ticker.style.flexWrap = 'wrap';
  ticker.style.gap = '8px';
  ticker.style.alignItems = 'center';
  ticker.style.padding = '8px 14px';

  let html = '<span style="font-size:11px;font-weight:700;color:#fb923c;white-space:nowrap;letter-spacing:.04em;flex-shrink:0">🔥 BOOST</span>';

  // Pastilla especial "HOY" si hay partidos hoy y falta el boost
  if (jornadaHoy && !boostPicks[today]) {
    html += `<button onclick="tickerExpandJornada('${today}')" style="
      display:inline-flex;align-items:center;gap:5px;
      padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;
      border:1.5px solid rgb(234,88,12);
      background:rgba(124,45,18,.5);color:rgb(251,191,36);
      cursor:pointer;animation:boostPulse 1.5s ease-in-out infinite;
      white-space:nowrap;
    ">⚡ HOY — Elige tu boost</button>`;
  } else if (jornadaHoy && boostPicks[today]) {
    const bMatch = PARTIDOS.find(m => getMatchKey(m) === boostPicks[today]);
    const label = bMatch ? bMatch.home.split(' ')[0] + ' vs ' + bMatch.away.split(' ')[0] : 'asignado';
    html += `<button onclick="tickerExpandJornada('${today}')" style="
      display:inline-flex;align-items:center;gap:5px;
      padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;
      border:1px solid rgba(74,222,128,.4);
      background:rgba(22,101,52,.3);color:rgb(74,222,128);
      cursor:pointer;white-space:nowrap;
    ">✓ HOY: ${label}</button>`;
  }

  // Pastillas de jornadas pendientes (próximas, no hoy)
  const pendientesSinHoy = pendientes.filter(d => d !== today);
  // Mostrar máx 3 jornadas pendientes para no saturar
  pendientesSinHoy.slice(0,3).forEach(d => {
    const dayLabel = new Date(d + 'T12:00:00').toLocaleDateString('es-ES', {day:'numeric',month:'short'});
    const nMatches = jornadasMap[d].length;
    html += `<button onclick="tickerExpandJornada('${d}')" style="
      display:inline-flex;align-items:center;gap:4px;
      padding:3px 10px;border-radius:20px;font-size:10px;font-weight:600;
      border:1px solid rgba(251,146,60,.25);
      background:rgba(67,20,7,.4);color:rgba(251,146,60,.7);
      cursor:pointer;white-space:nowrap;
      animation:boostPulse 1.5s ease-in-out infinite;
    ">🔥 ${dayLabel} (${nMatches})</button>`;
  });

  // Si quedan más jornadas pendientes, mostrar contador
  if (pendientesSinHoy.length > 3) {
    html += `<span style="font-size:10px;color:#6b7280">+${pendientesSinHoy.length - 3} más</span>`;
  }

  ticker.innerHTML = html;

  // Panel expandible de partidos de la jornada (se crea dinámicamente)
  let panel = document.getElementById('boost-ticker-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'boost-ticker-panel';
    panel.style.cssText = 'display:none;width:100%;padding:8px 0 4px;border-top:1px solid rgba(124,45,18,.3);margin-top:4px;display:flex;gap:6px;flex-wrap:wrap';
    ticker.appendChild(panel);
  }
}

/* Scroll suave a la tarjeta de un partido */
function scrollToMatchCard(matchKey) {
  const idx = PARTIDOS.findIndex(m => getMatchKey(m) === matchKey);
  if (idx === -1) return;
  const card = document.querySelector('.card[data-match-idx="' + idx + '"]');
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  // Flash visual para identificar la tarjeta
  card.style.transition = 'box-shadow .3s';
  card.style.boxShadow = '0 0 0 3px rgb(251,146,60), 0 0 40px rgba(234,88,12,.6)';
  setTimeout(() => { card.style.boxShadow = ''; }, 1800);
}
window.scrollToMatchCard = scrollToMatchCard;

/* Expande/colapsa los partidos de una jornada — usado por ticker superior y CTA inferior */
function _buildMatchButtons(date, onClickFn) {
  const matchesOfDay = PARTIDOS.filter(m => m.date?.substring(0,10) === date);
  const boostedKey = boostPicks[date];
  const hora = (m) => new Date(m.date).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'});
  const jNum = [...new Set(PARTIDOS.map(m => m.date?.substring(0,10)).filter(Boolean))].sort().indexOf(date) + 1;
  const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('es-ES', {weekday:'short', day:'numeric', month:'short'});

  const header = '<div style="width:100%;display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
    '<span style="font-size:10px;font-weight:700;color:#fb923c;background:rgba(124,45,18,.4);padding:2px 8px;border-radius:20px;border:1px solid rgba(234,88,12,.3)">J' + jNum + '</span>' +
    '<span style="font-size:10px;color:#6b7280">' + dayLabel + '</span>' +
    '</div>';

  const buttons = matchesOfDay.map(m => {
    const key = getMatchKey(m);
    const isActive = boostedKey === key;
    return '<div style="display:inline-flex;align-items:center;gap:4px;">' +
      '<button onclick="' + onClickFn + '(\'' + key + '\',\'' + date + '\')" style="' +
        'display:inline-flex;align-items:center;gap:5px;' +
        'padding:4px 12px;border-radius:20px 0 0 20px;font-size:11px;font-weight:600;' +
        'border:1px solid ' + (isActive ? 'rgb(234,88,12)' : 'rgba(255,255,255,.1)') + ';border-right:none;' +
        'background:' + (isActive ? 'rgba(124,45,18,.7)' : 'rgba(255,255,255,.04)') + ';' +
        'color:' + (isActive ? 'rgb(251,191,36)' : 'rgba(255,255,255,.55)') + ';' +
        'cursor:pointer;white-space:nowrap;transition:all .2s;' +
      '">' + (isActive ? '🔥 ' : '') + m.home + ' vs ' + m.away +
      ' <span style="opacity:.45;font-size:10px">' + hora(m) + '</span></button>' +
      '<button onclick="scrollToMatchCard(\'' + key + '\')" title="Ir a la tarjeta" style="' +
        'display:inline-flex;align-items:center;justify-content:center;' +
        'padding:4px 8px;border-radius:0 20px 20px 0;font-size:10px;' +
        'border:1px solid ' + (isActive ? 'rgb(234,88,12)' : 'rgba(255,255,255,.1)') + ';border-left:none;' +
        'background:' + (isActive ? 'rgba(124,45,18,.5)' : 'rgba(255,255,255,.03)') + ';' +
        'color:rgba(255,255,255,.4);cursor:pointer;transition:all .2s;' +
        '" onmouseover="this.style.color=\'rgba(255,255,255,.8)\'" onmouseout="this.style.color=\'rgba(255,255,255,.4)\'">↓</button>' +
      '</div>';
  }).join('');

  return header + buttons;
}

function tickerExpandJornada(date) {
  // Buscar o crear panel en el ticker superior
  const ticker = document.getElementById('boost-ticker');
  if (!ticker) return;

  let panel = document.getElementById('boost-ticker-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'boost-ticker-panel';
    panel.style.cssText = 'width:100%;padding:8px 0 4px;border-top:1px solid rgba(124,45,18,.3);margin-top:4px;flex-wrap:wrap;gap:6px;align-items:center';
    ticker.appendChild(panel);
  }

  // Toggle: colapsar si ya está abierto para esta fecha
  if (panel.dataset.date === date && panel.style.display !== 'none') {
    panel.style.display = 'none';
    panel.dataset.date = '';
    return;
  }

  panel.dataset.date = date;
  panel.style.display = 'flex';
  panel.innerHTML = _buildMatchButtons(date, 'tickerBoostToggle');
}
window.tickerExpandJornada = tickerExpandJornada;

/* Expande panel de jornada dentro del CTA inferior */
/* Llamado desde el ticker al hacer click en un partido */
function tickerBoostToggle(matchKey, date) {
  // Desmarcar boost anterior del mismo día en las tarjetas
  if(boostPicks[date] && boostPicks[date] !== matchKey) {
    document.querySelectorAll('.card').forEach(card => {
      const oi = card.getAttribute('data-match-idx');
      if(oi === null) return;
      const om = PARTIDOS[Number(oi)];
      if(!om || getMatchKey(om) !== boostPicks[date]) return;
      const chk = card.querySelector('.boost-chk');
      const row = card.querySelector('.boost-row');
      if(chk){chk.checked=false;chk.disabled=false;}
      if(row){row.classList.remove('boost-on');row.style.opacity='';row.removeAttribute('title');}
      card.classList.remove('boost-active');
    });
  }

  // Si ya estaba activo, desactivar (toggle)
  if(boostPicks[date] === matchKey) {
    delete boostPicks[date];
    document.querySelectorAll('.card').forEach(card => {
      const oi = card.getAttribute('data-match-idx');
      if(oi === null) return;
      const om = PARTIDOS[Number(oi)];
      if(!om || getMatchKey(om) !== matchKey) return;
      const chk = card.querySelector('.boost-chk');
      const row = card.querySelector('.boost-row');
      if(chk){chk.checked=false;}
      if(row){row.classList.remove('boost-on');}
      card.classList.remove('boost-active');
    });
  } else {
    // Activar en el objeto boostPicks
    boostPicks[date] = matchKey;
    // Sincronizar con el check de la tarjeta correspondiente
    document.querySelectorAll('.card').forEach(card => {
      const oi = card.getAttribute('data-match-idx');
      if(oi === null) return;
      const om = PARTIDOS[Number(oi)];
      if(!om || getMatchKey(om) !== matchKey) return;
      const chk = card.querySelector('.boost-chk');
      const row = card.querySelector('.boost-row');
      if(chk){chk.checked=true;chk.disabled=false;}
      if(row){row.classList.add('boost-on');row.style.opacity='';row.removeAttribute('title');}
      card.classList.add('boost-active');
    });
  }

  saveBoostPicks();
  checkFinalizarReady?.();
  renderBoostTicker();
  checkGroupsComplete();
  // Re-renderizar vista jornada si está activa
  if (window._currentPage === 'jornada') setTimeout(() => renderVistaJornada(), 50);
  // Re-renderizar panel expandido si sigue abierto
  const openPanel = document.getElementById('boost-ticker-panel');
  if (openPanel && openPanel.dataset.date && openPanel.style.display !== 'none') {
    openPanel.innerHTML = _buildMatchButtons(openPanel.dataset.date, 'tickerBoostToggle');
  }
}
window.tickerBoostToggle = tickerBoostToggle;

/* ════════════════════════════════════════════════════════
   VISTA JORNADA — tarjetas compactas ordenadas por día
   F7.4-D-1: setVistaGrupos + _vistaActual eliminados.
   El toggle entre vistas lo gobierna showPage('grupos'|'jornada'|'directo')
   desde el bottom-tab. window._currentPage es la fuente de verdad.
   ════════════════════════════════════════════════════════ */

function renderVistaJornada() {
  const container = document.getElementById('jornada-container');
  if (!container) return;

  // Agrupar PARTIDOS por fecha
  const jornadasMap = {};
  PARTIDOS.forEach((m, idx) => {
    const date = m.date?.substring(0, 10);
    if (!date) return;
    if (!jornadasMap[date]) jornadasMap[date] = [];
    jornadasMap[date].push({ m, idx });
  });
  const dias = Object.keys(jornadasMap).sort();

  // Wrapper con sidebar única a la derecha
  const sidebarHtml = _buildJornadaRanking();

  let sectionsHtml = '';
  dias.forEach((date, dIdx) => {
    const jNum = dIdx + 1;
    const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
    const boostKey  = boostPicks[date];
    const boostDone = !!boostKey;
    const badgeCls  = boostDone ? 'jornada-boost-badge done' : 'jornada-boost-badge';
    const badgeTxt  = boostDone ? '✅ Boost asignado' : '🔥 Pendiente';

    sectionsHtml += '<div class="jornada-section" id="jornada-' + date + '">';
    sectionsHtml += '<div class="jornada-header">';
    sectionsHtml += '<span class="jornada-label">J' + jNum + '</span>';
    sectionsHtml += '<span class="jornada-date">' + dayLabel + '</span>';
    sectionsHtml += '<span class="' + badgeCls + '">' + badgeTxt + '</span>';
    sectionsHtml += '</div>';

    jornadasMap[date].forEach(({ m, idx }) => {
      sectionsHtml += _buildJCard(m, idx, date, boostKey);
    });

    sectionsHtml += '</div>'; // jornada-section
  });

  // Layout: columna de jornadas + sidebar única sticky
  container.innerHTML =
    '<div class="jornada-wrap">' +
      '<div class="jornada-main">' + sectionsHtml + '</div>' +
      '<div class="jornada-sidebar">' + sidebarHtml + '</div>' +
    '</div>';

  // Cinta usuario móvil
  _renderUserStrip();
}
window.renderVistaJornada = renderVistaJornada;

function _buildJCard(m, idx, date, boostKey) {
  const matchKey = getMatchKey(m);
  const pred = predictions[matchKey] || {};
  const isBoost = boostKey === matchKey;

  // Equipos y banderas
  const hTeam = EQUIPOS.find(e => e.name === m.home);
  const aTeam = EQUIPOS.find(e => e.name === m.away);
  const hFlag = hTeam ? SB + '/flags/' + hTeam.flag + '.png' : '';
  const aFlag = aTeam ? SB + '/flags/' + aTeam.flag + '.png' : '';

  // Estado del pronóstico
  const hasScore = pred.l !== null && pred.l !== undefined && pred.v !== null && pred.v !== undefined;

  // Marcador pronosticado
  const lTxt = hasScore ? pred.l : '—';
  const vTxt = hasScore ? pred.v : '—';
  const scoreCls = hasScore ? 'jcard-score' : 'jcard-score pending';

  // Chips
  const ia = iaPredictions[matchKey];
  const mySign = getMySign(pred);
  const showIA = hasScore && ia && mySign && mySign !== ia.sign;
  const chips =
    (hasScore ? '<span class="jcard-chip on">1X2</span>' : '<span class="jcard-chip">1X2</span>') +
    (hasScore ? '<span class="jcard-chip on">Exacto</span>' : '') +
    (pred.gol ? '<span class="jcard-chip on">⚽ ' + pred.gol + '</span>' : '') +
    (showIA   ? '<span class="jcard-chip on">vs IA</span>' : '');

  // Pts posibles
  let maxPts = 0;
  if (hasScore) {
    maxPts = 4;
    if (pred.gol) maxPts += 2;
    if (showIA)   maxPts += 1;
  }
  const ptsVal  = isBoost ? maxPts * 2 : maxPts;
  const ptsCls  = isBoost ? 'jcard-pts-num boost' : (maxPts > 0 ? 'jcard-pts-num' : 'jcard-pts-num pending');
  const ptsDisp = ptsVal || '—';

  // Hora y estadio
  const hora = new Date(m.date).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'});
  const stadium = m.stadium ? m.stadium.replace(' Stadium','').replace(' Estadio','') : '';

  // Color lateral por grupo
  const gc = {A:'#4ade80',B:'#60a5fa',C:'#f472b6',D:'#fb923c',E:'#a78bfa',
    F:'#34d399',G:'#fbbf24',H:'#f87171',I:'#38bdf8',J:'#c084fc',K:'#86efac',L:'#fcd34d'}[m.group] || '#4ade80';

  // Boost row
  const chkChecked = isBoost ? 'checked' : '';
  const boostRowCls = isBoost ? 'jcard-boost active' : 'jcard-boost';
  const boostLabel  = isBoost
    ? '<span style="font-size:11px;color:#fb923c;font-weight:600">🔥 Boost activo</span>'
    : '<span style="font-size:11px;color:#6b7280">🔥 Boost a este partido</span>';

  return (
    '<div class="jcard' + (isBoost ? ' boost-active' : '') + '" id="jcard-' + idx + '">' +
      '<div class="jcard-main">' +
        '<div class="jcard-stripe" style="--gc:' + gc + ';background:' + gc + '"></div>' +
        '<div class="jcard-body">' +
          '<div class="jcard-teams-row">' +
            '<div class="jcard-team">' +
              '<div class="jcard-flag"><img src="' + hFlag + '" loading="lazy"></div>' +
              '<span class="jcard-team-name">' + m.home + '</span>' +
            '</div>' +
            '<div class="jcard-score-wrap">' +
              '<span class="' + scoreCls + '">' + lTxt + '</span>' +
              '<span class="jcard-score-sep">:</span>' +
              '<span class="' + scoreCls + '">' + vTxt + '</span>' +
            '</div>' +
            '<div class="jcard-team" style="justify-content:flex-end">' +
              '<span class="jcard-team-name" style="text-align:right">' + m.away + '</span>' +
              '<div class="jcard-flag"><img src="' + aFlag + '" loading="lazy"></div>' +
            '</div>' +
          '</div>' +
          '<div class="jcard-venue">' +
            '<span>🏟️ ' + stadium + '</span>' +
            '<span style="color:#3a3a3e">·</span>' +
            '<span>⏰ ' + hora + '</span>' +
            '<span style="color:#3a3a3e">·</span>' +
            '<span style="color:#4b5563">Grupo ' + m.group + '</span>' +
          '</div>' +
          (chips ? '<div class="jcard-chips">' + chips + '</div>' : '') +
        '</div>' +
        '<div class="jcard-pts">' +
          '<div class="' + ptsCls + '">' + ptsDisp + '</div>' +
          '<div class="jcard-pts-label">' + (isBoost ? 'PTS ×2' : 'PTS posibles') + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="' + boostRowCls + '">' +
        '<input type="checkbox" ' + chkChecked + ' ' +
          'onchange="jcardBoostToggle(\'' + matchKey + '\',\'' + date + '\',this)" ' +
          'style="width:16px;height:16px;accent-color:#ea580c;cursor:pointer;flex-shrink:0">' +
        boostLabel +
        '<button onclick="openJcardModal(\'' + matchKey + '\')" ' +
          'style="margin-left:auto;font-size:10px;color:#4b5563;background:none;border:none;' +
          'cursor:pointer;padding:2px 8px;border-radius:6px;border:1px solid #27272a;' +
          'transition:all .15s" ' +
          'onmouseover="this.style.borderColor=\'#4ade80\';this.style.color=\'#4ade80\'" ' +
          'onmouseout="this.style.borderColor=\'#27272a\';this.style.color=\'#4b5563\'">🔍 Ver tarjeta</button>' +
      '</div>' +
    '</div>'
  );
}

function jcardBoostToggle(matchKey, date, checkbox) {
  if (window.tickerBoostToggle) {
    const wasActive = boostPicks[date] === matchKey;
    if (checkbox.checked && !wasActive) {
      tickerBoostToggle(matchKey, date);
    } else if (!checkbox.checked && wasActive) {
      tickerBoostToggle(matchKey, date);
    }
  }
  setTimeout(() => renderVistaJornada(), 50);
}
window.jcardBoostToggle = jcardBoostToggle;

function _buildJornadaRanking() {
  // Si _sbData no está disponible, disparar carga y devolver placeholder
  if (!window._sbData || window._sbData.length === 0) {
    // Intentar cargar scoreboard si la función existe
    if (typeof sbLoad === 'function') {
      sbLoad().then(() => {
        // Tras cargar, re-renderizar si seguimos en vista jornada
        if (window._currentPage === 'jornada') renderVistaJornada();
      });
    }
    return '<div class="jornada-ranking">' +
      '<div class="jornada-ranking-title">🏆 Clasificación</div>' +
      '<div style="font-size:11px;color:#4b5563;text-align:center;padding:12px 0">' +
        'Cargando clasificación...' +
      '</div></div>';
  }
  const myId = window.currentUser?.id;
  const rows = window._sbData.slice(0, 10);
  return '<div class="jornada-ranking">' +
    '<div class="jornada-ranking-title">🏆 Clasificación liga</div>' +
    rows.map((u, i) => {
      const isMe = u.uid === myId;
      const ini  = (u.nombre || '?').charAt(0).toUpperCase();
      const posCls = i < 3 ? 'jrank-pos top' : 'jrank-pos';
      const medals = ['🥇','🥈','🥉'];
      const posStr = i < 3 ? medals[i] : (i + 1);
      return '<div class="jrank-row' + (isMe ? ' jrank-me' : '') + '">' +
        '<span class="' + posCls + '">' + posStr + '</span>' +
        '<div class="jrank-avatar">' + ini + '</div>' +
        '<span class="jrank-name">' + escapeHtml(u.nombre) + '</span>' +
        '<span class="jrank-pts">' + u.total + '</span>' +
      '</div>';
    }).join('') +
  '</div>';
}

function _renderUserStrip() {
  const el = document.getElementById('jornada-user-strip');
  if (!el) return;
  const myId = window.currentUser?.id;
  if (!myId || !window._sbData || window._sbData.length === 0) return;
  const idx = window._sbData.findIndex(u => u.uid === myId);
  if (idx === -1) return;
  const u = window._sbData[idx];
  const medals = ['\u{1F947}','\u{1F948}','\u{1F949}'];
  const pos = idx < 3 ? medals[idx] : '#' + (idx + 1);
  el.innerHTML =
    '<span class="jus-pos">' + pos + '</span>' +
    '<span class="jus-name">' + escapeHtml(u.nombre) + '</span>' +
    '<span class="jus-pts">' + u.total + ' pts</span>';
}
window._renderUserStrip = _renderUserStrip;

function openJcardModal(matchKey) {
  const cardEl = document.getElementById('card-wrap-' + matchKey);
  if (!cardEl) {
    renderAll(() => _showJcardModal(matchKey));
    return;
  }
  _showJcardModal(matchKey);
}

function _showJcardModal(matchKey) {
  const prev = document.getElementById('jcard-modal-overlay');
  if (prev) prev.remove();

  const cardEl = document.getElementById('card-wrap-' + matchKey);
  if (!cardEl) return;

  const overlay = document.createElement('div');
  overlay.id = 'jcard-modal-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:9999;' +
    'display:flex;align-items:center;justify-content:center;padding:16px;' +
    'animation:fadeIn .15s ease;';
  overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };

  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'max-width:480px;width:100%;max-height:90vh;overflow-y:auto;' +
    'border-radius:16px;position:relative;';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '\u2715';
  closeBtn.style.cssText =
    'position:sticky;top:8px;float:right;margin:8px 8px 0 0;z-index:1;' +
    'background:rgba(0,0,0,.6);border:1px solid #3a3a3e;color:#9ca3af;' +
    'width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:12px;' +
    'display:flex;align-items:center;justify-content:center;';
  closeBtn.onclick = () => overlay.remove();

  const clone = cardEl.cloneNode(true);
  clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
  clone.querySelectorAll('button,input').forEach(el => {
    el.disabled = true;
    el.style.pointerEvents = 'none';
  });

  wrapper.appendChild(closeBtn);
  wrapper.appendChild(clone);
  overlay.appendChild(wrapper);
  document.body.appendChild(overlay);
}
window.openJcardModal = openJcardModal;

function initGrupos() {
  // Mostrar barra global de dados si usuario logueado
  const diceBar = document.getElementById('dice-global-bar');
  if(diceBar && currentUser && !window._porraCerrada) diceBar.style.display = 'flex';
  window.scrollTo(0,0);
  renderAll(() => {
    // Cuando todos los grupos están en DOM, re-renderizar tablas con datos en memoria
    if (typeof refreshGroupTables === 'function') refreshGroupTables();
  });
  checkGroupsComplete();
  // Ticker boost: mostrar partidos de hoy
  if(typeof renderBoostTicker === 'function') renderBoostTicker();
  // Actualizar countdown cada 5s (no cada 1s — mejora rendimiento scroll)
  // Solo actualiza los pills de estado, no re-renderiza todo
  setInterval(() => {
    PARTIDOS.forEach((match, idx) => {
      const pill = document.getElementById('spill-'+idx);
      const stxt = document.getElementById('stxt-'+idx);
      if(!pill || !stxt) return;
      const estado = getEstadoPartido(match);
      if(estado==='open'){
        pill.className='status-pill open';
        const ms=new Date(match.date)-4*24*3600*1000-new Date();
        stxt.textContent='Abierta · '+fmtMs(ms);
      } else if(estado==='closing'){
        pill.className='status-pill closing';
        const ms=new Date(match.date)-2*24*3600*1000-new Date();
        stxt.textContent='¡Cierra en '+fmtMs(ms)+'!';
      } else if(estado==='live'){
        pill.className='status-pill live';
        const min=Math.min(Math.floor((new Date()-new Date(match.date))/60000),90);
        stxt.textContent='EN VIVO '+min+"'";
      }
      // closed y done no cambian — no actualizar
    });
    updateGlobalPoints();
    checkGroupsComplete(); // habilitar botón eliminatorias
  }, 1000);

}


