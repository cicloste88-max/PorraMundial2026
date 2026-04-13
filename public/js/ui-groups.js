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
  savePredictions(); // persistir siempre al verificar
  let filled = 0;
  PARTIDOS.forEach(m => {
    const p = predictions[getMatchKey(m)];
    if(p && p.saved) filled++;
  });
  const total = PARTIDOS.length; // 72
  const pct = Math.round(filled / total * 100);

  // Header button
  const btn = document.getElementById('btn-go-eliminatorias');
  const icon = document.getElementById('btn-elim-icon');
  const text = document.getElementById('btn-elim-text');
  const count = document.getElementById('btn-elim-count');
  // Verificar boosts: todas las jornadas deben tener boost asignado
  const diasConPartidos = [...new Set(PARTIDOS.map(m => m.date?.substring(0,10)).filter(Boolean))];
  const boostsCompletos = diasConPartidos.every(d => boostPicks[d]);

  if(btn) {
    count.textContent = filled+'/'+total;
    if(filled >= total && boostsCompletos) {
      btn.disabled = false;
      btn.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#4ade80;padding:6px 14px;border-radius:10px;border:1px solid #166534;background:#052e16;cursor:pointer;transition:all .3s;opacity:1;font-family:Inter,sans-serif;box-shadow:0 0 16px rgba(74,222,128,.2)';
      icon.textContent = '⚽';
      text.textContent = 'Ver Eliminatorias';
      count.style.display = 'none';
    } else {
      btn.disabled = true;
      btn.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#4b5563;padding:6px 14px;border-radius:10px;border:1px solid #27272a;background:#1c1c1e;cursor:not-allowed;transition:all .3s;opacity:.6;font-family:Inter,sans-serif';
      icon.textContent = '🔒';
      if(filled >= total && !boostsCompletos) {
        const pendientes = diasConPartidos.filter(d => !boostPicks[d]).length;
        text.textContent = 'Boost: faltan ' + pendientes + ' jornada' + (pendientes > 1 ? 's' : '');
        count.style.display = 'none';
      } else {
        text.textContent = 'Eliminatorias';
        count.style.display = 'inline';
      }
    }
  }

  // CTA banner
  const ctaLocked = document.getElementById('cta-locked-msg');
  const ctaReady  = document.getElementById('cta-ready-msg');
  const ctaFilled = document.getElementById('cta-filled');
  if(ctaFilled) ctaFilled.textContent = filled;

  // Group dots
  const dotsEl = document.getElementById('cta-groups-dots');
  if(dotsEl) {
    dotsEl.innerHTML = '';
    GRUPOS.forEach(g => {
      const gFilled = PARTIDOS.filter(m => m.group===g.letra && predictions[getMatchKey(m)]?.saved).length;
      const dot = document.createElement('div');
      dot.title = 'Grupo '+g.letra+' ('+gFilled+'/6)';
      dot.style.cssText = 'width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;transition:all .3s;';
      if(gFilled >= 6) {
        dot.style.background = '#052e16';
        dot.style.border = '1.5px solid #166534';
        dot.style.color = '#4ade80';
        dot.textContent = g.letra;
      } else if(gFilled > 0) {
        dot.style.background = '#1c1003';
        dot.style.border = '1.5px solid #d97706';
        dot.style.color = '#fb923c';
        dot.textContent = g.letra;
      } else {
        dot.style.background = '#1c1c1e';
        dot.style.border = '1.5px solid #3a3a3e';
        dot.style.color = '#6b7280';
        dot.textContent = g.letra;
      }
      dotsEl.appendChild(dot);
    });
  }

  if(ctaLocked && ctaReady) {
    if(filled >= total && boostsCompletos) {
      ctaLocked.style.display = 'none';
      ctaReady.style.display = 'block';
    } else {
      ctaLocked.style.display = 'block';
      ctaReady.style.display = 'none';

      // Pastillas boost pendientes bajo el CTA locked
      const boostPendingEl = document.getElementById('cta-boost-pending');
      if(boostPendingEl && filled >= total) {
        const pendientes = diasConPartidos.filter(d => !boostPicks[d]);
        if(pendientes.length > 0) {
          // Guardar qué jornada tiene el panel expandido antes de re-renderizar
          const openDate = document.getElementById('cta-boost-panel')?.dataset.date || null;

          boostPendingEl.style.display = 'flex';
          const label = '<span style="font-size:11px;font-weight:700;color:#fb923c;white-space:nowrap;flex-shrink:0">🔥 Boosts pendientes:</span>';
          const pills = pendientes.map(d => {
            const dayLabel = new Date(d + 'T12:00:00').toLocaleDateString('es-ES', {day:'numeric', month:'short'});
            const nM = PARTIDOS.filter(m => m.date?.substring(0,10) === d).length;
            const jNum = diasConPartidos.indexOf(d) + 1;
            return '<button onclick="ctaExpandJornada(\'' + d + '\')" style="' +
              'display:inline-flex;align-items:center;gap:4px;' +
              'padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;' +
              'border:1.5px solid rgba(234,88,12,.5);' +
              'background:rgba(124,45,18,.35);color:rgb(251,146,60);' +
              'cursor:pointer;white-space:nowrap;' +
              'animation:boostPulse 1.5s ease-in-out infinite;' +
              '">🔥 J' + jNum + ' · ' + dayLabel + ' (' + nM + ')</button>';
          }).join('');

          // Mantener el panel expandido si estaba abierto
          const existingPanel = document.getElementById('cta-boost-panel');
          const panelHtml = (openDate && existingPanel)
            ? '<div id="cta-boost-panel" data-date="' + openDate + '" style="width:100%;margin-top:8px;padding:8px;border-top:1px solid rgba(124,45,18,.3);flex-wrap:wrap;gap:6px;align-items:center;display:flex">' + existingPanel.innerHTML + '</div>'
            : '';

          boostPendingEl.innerHTML = label + pills + panelHtml;
        } else {
          boostPendingEl.style.display = 'none';
        }
      } else if(boostPendingEl) {
        boostPendingEl.style.display = 'none';
      }
    }
  }
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
function ctaExpandJornada(date) {
  const container = document.getElementById('cta-boost-pending');
  if (!container) return;

  let panel = document.getElementById('cta-boost-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'cta-boost-panel';
    panel.style.cssText = 'width:100%;margin-top:8px;padding:8px;border-top:1px solid rgba(124,45,18,.3);flex-wrap:wrap;gap:6px;align-items:center;display:flex';
    container.appendChild(panel);
  }

  // Toggle
  if (panel.dataset.date === date && panel.style.display !== 'none') {
    panel.style.display = 'none';
    panel.dataset.date = '';
    return;
  }

  panel.dataset.date = date;
  panel.style.display = 'flex';
  panel.innerHTML = _buildMatchButtons(date, 'tickerBoostToggle');

  // Scroll suave al panel
  setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
}
window.ctaExpandJornada = ctaExpandJornada;

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
  if (_vistaActual === 'jornada') setTimeout(() => renderVistaJornada(), 50);
  // Re-renderizar panel expandido si sigue abierto
  const openPanel = document.getElementById('boost-ticker-panel');
  if (openPanel && openPanel.dataset.date && openPanel.style.display !== 'none') {
    openPanel.innerHTML = _buildMatchButtons(openPanel.dataset.date, 'tickerBoostToggle');
  }
  const ctaPanel = document.getElementById('cta-boost-panel');
  if (ctaPanel && ctaPanel.dataset.date && ctaPanel.style.display !== 'none') {
    ctaPanel.innerHTML = _buildMatchButtons(ctaPanel.dataset.date, 'tickerBoostToggle');
  }
}
window.tickerBoostToggle = tickerBoostToggle;

/* ════════════════════════════════════════════════════════
   VISTA JORNADA — tarjetas compactas ordenadas por día
   ════════════════════════════════════════════════════════ */
let _vistaActual = 'grupos'; // 'grupos' | 'jornada'

function setVistaGrupos(vista) {
  _vistaActual = vista;
  const gruposContainer  = document.getElementById('groups-container');
  const jornadaContainer = document.getElementById('jornada-container');
  const btnGrupos  = document.getElementById('btn-vista-grupos');
  const btnJornada = document.getElementById('btn-vista-jornada');

  if (vista === 'grupos') {
    if (gruposContainer)  gruposContainer.style.display  = 'block';
    if (jornadaContainer) jornadaContainer.style.display = 'none';
    if (btnGrupos)  { btnGrupos.style.background  = '#27272a'; btnGrupos.style.color  = '#fff'; }
    if (btnJornada) { btnJornada.style.background = 'transparent'; btnJornada.style.color = '#6b7280'; }
  } else {
    if (gruposContainer)  gruposContainer.style.display  = 'none';
    if (jornadaContainer) jornadaContainer.style.display = 'block';
    if (btnGrupos)  { btnGrupos.style.background  = 'transparent'; btnGrupos.style.color  = '#6b7280'; }
    if (btnJornada) { btnJornada.style.background = '#27272a'; btnJornada.style.color = '#fff'; }
    renderVistaJornada();
  }
}
window.setVistaGrupos = setVistaGrupos;

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

  let html = '';
  dias.forEach((date, dIdx) => {
    const jNum = dIdx + 1;
    const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
    const boostKey  = boostPicks[date];
    const boostDone = !!boostKey;
    const badgeCls  = boostDone ? 'jornada-boost-badge done' : 'jornada-boost-badge';
    const badgeTxt  = boostDone ? '🔥 Boost asignado' : '🔥 Boost pendiente';

    html += '<div class="jornada-section" id="jornada-' + date + '">';
    html += '<div class="jornada-header">';
    html += '<span class="jornada-label">J' + jNum + '</span>';
    html += '<span class="jornada-date">' + dayLabel + '</span>';
    html += '<span class="' + badgeCls + '">' + badgeTxt + '</span>';
    html += '</div>';

    // Layout: tarjetas + sidebar ranking
    html += '<div class="jornada-layout">';
    html += '<div class="jornada-cards">';

    jornadasMap[date].forEach(({ m, idx }) => {
      html += _buildJCard(m, idx, date, boostKey);
    });

    html += '</div>'; // jornada-cards
    html += '<div class="jornada-sidebar">' + _buildJornadaRanking() + '</div>';
    html += '</div>'; // jornada-layout
    html += '</div>'; // jornada-section
  });

  container.innerHTML = html;
}
window.renderVistaJornada = renderVistaJornada;

function _buildJCard(m, idx, date, boostKey) {
  const matchKey = getMatchKey(m);
  const pred = predictions[matchKey] || {};
  const isBoost = boostKey === matchKey;

  const hTeam = EQUIPOS.find(e => e.name === m.home);
  const aTeam = EQUIPOS.find(e => e.name === m.away);
  const hFlag = hTeam ? SB + '/flags/' + hTeam.flag + '.png' : '';
  const aFlag = aTeam ? SB + '/flags/' + aTeam.flag + '.png' : '';

  const hasScore = pred.l !== null && pred.l !== undefined && pred.v !== null && pred.v !== undefined;
  const hasPred  = pred.saved;

  const lTxt = hasScore ? pred.l : '—';
  const vTxt = hasScore ? pred.v : '—';
  const scoreCls = hasScore ? 'jcard-score' : 'jcard-score pending';

  const ia = iaPredictions[matchKey];
  const mySign = getMySign(pred);
  const showIA = hasScore && ia && mySign && mySign !== ia.sign;
  const chipSign   = hasScore ? '<span class="jcard-chip on">1X2</span>' : '<span class="jcard-chip">1X2</span>';
  const chipExact  = hasScore ? '<span class="jcard-chip on">Exacto</span>' : '';
  const chipGol    = pred.gol ? '<span class="jcard-chip on">Gol</span>' : '';
  const chipIA     = showIA   ? '<span class="jcard-chip on">vsIA</span>' : '';

  let maxPts = 0;
  if (hasScore) {
    maxPts = 4;
    if (pred.gol) maxPts += 2;
    if (showIA)   maxPts += 1;
  }
  const ptsActual = hasPred && maxPts > 0 ? maxPts : 0;
  const ptsCls = isBoost ? 'jcard-pts-num boost' : (ptsActual > 0 ? 'jcard-pts-num' : 'jcard-pts-num pending');
  const ptsDisp = isBoost ? (ptsActual * 2) + '✕' : (ptsActual || '—');

  const chkChecked = isBoost ? 'checked' : '';
  const boostRowBg = isBoost ? 'background:rgba(28,14,6,.8);' : '';

  const groupColors = {A:'#4ade80',B:'#60a5fa',C:'#f472b6',D:'#fb923c',E:'#a78bfa',
    F:'#34d399',G:'#fbbf24',H:'#f87171',I:'#38bdf8',J:'#c084fc',K:'#86efac',L:'#fcd34d'};
  const groupColor = groupColors[m.group] || '#4ade80';

  const hora = new Date(m.date).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'});

  return '<div class="jcard' + (isBoost ? ' boost-active' : '') + '" id="jcard-' + idx + '">' +
    '<div class="jcard-inner">' +
    '<div class="jcard-group" style="background:' + groupColor + ';opacity:.6"></div>' +
    '<div class="jcard-match">' +
      '<div class="jcard-teams">' +
        '<div class="jcard-team-row">' +
          '<div class="jcard-flag"><img src="' + hFlag + '" alt=""/></div>' +
          '<span>' + m.home + '</span>' +
          '<span style="margin-left:auto;font-size:10px;color:#6b7280">Local · ' + m.group + '</span>' +
        '</div>' +
        '<div class="jcard-team-row">' +
          '<div class="jcard-flag"><img src="' + aFlag + '" alt=""/></div>' +
          '<span>' + m.away + '</span>' +
          '<span style="margin-left:auto;font-size:9px;color:#4b5563">' + hora + '</span>' +
        '</div>' +
        '<div class="jcard-chips" style="margin-top:4px">' + chipSign + chipExact + chipGol + chipIA + '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0;margin:0 8px;">' +
        '<span class="' + scoreCls + '">' + lTxt + '</span>' +
        '<span class="jcard-sep">:</span>' +
        '<span class="' + scoreCls + '">' + vTxt + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="jcard-pts">' +
      '<div class="' + ptsCls + '">' + ptsDisp + '</div>' +
      '<div class="jcard-pts-label">pts</div>' +
    '</div>' +
    '</div>' +
    '<div class="jcard-boost" style="' + boostRowBg + '">' +
      '<input type="checkbox" ' + chkChecked + ' ' +
        'onchange="jcardBoostToggle(\'' + matchKey + '\',\'' + date + '\',this)" ' +
        'style="width:16px;height:16px;accent-color:#ea580c;cursor:pointer;flex-shrink:0">' +
      '<span style="font-size:11px;color:' + (isBoost ? '#fb923c' : '#6b7280') + ';font-weight:500">🔥 Boost</span>' +
      '<button onclick="scrollToMatchCard(\'' + matchKey + '\')" ' +
        'style="margin-left:auto;font-size:10px;color:#4b5563;background:none;border:none;cursor:pointer;' +
        'padding:2px 6px;border-radius:6px;border:1px solid #27272a" ' +
        'title="Ver tarjeta completa">↓ Ver tarjeta</button>' +
    '</div>' +
  '</div>';
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
        if (_vistaActual === 'jornada') renderVistaJornada();
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


