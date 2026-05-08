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
    const matchesOfDay = jornadasMap[date];
    const boostKey  = boostPicks[date];

    // Separar finalizados / por jugar usando _liveScoresByMatchKey (status=finished).
    // Pre-mundial todos van a 'porJugar' — la sección 'FINALIZADOS' simplemente no se renderiza.
    const liveByKey = window._liveScoresByMatchKey || {};
    const finalizados = [];
    const porJugar    = [];
    matchesOfDay.forEach(({ m, idx }) => {
      const dk = (typeof window.matchKeyFor === 'function') ? window.matchKeyFor(m) : null;
      const live = dk ? liveByKey[dk] : null;
      if (live && live.status === 'finished') finalizados.push({ m, idx, live });
      else porJugar.push({ m, idx, live });
    });

    // Fecha humana corta para el header (rango si la jornada cubre >1 día — aquí siempre 1 día por agrupación).
    const dateObj = new Date(date + 'T12:00:00');
    const dayLabel = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });
    const dateShort = dateObj.toLocaleDateString('es-ES', { day: 'numeric', month: 'short' }).toUpperCase();

    const subTitle = matchesOfDay.length + ' partido' + (matchesOfDay.length === 1 ? '' : 's') +
                     ' · ' + finalizados.length + ' finalizado' + (finalizados.length === 1 ? '' : 's') +
                     ' · ' + porJugar.length + ' por jugar';

    const prevDate = dias[dIdx - 1] || null;
    const nextDate = dias[dIdx + 1] || null;
    const prevAttr = prevDate ? 'data-jump="jornada-' + prevDate + '"' : 'disabled';
    const nextAttr = nextDate ? 'data-jump="jornada-' + nextDate + '"' : 'disabled';

    let cardsHtml = '';
    if (finalizados.length) {
      cardsHtml += '<div class="jv2-section-label">Finalizados</div>';
      finalizados.forEach(({ m, idx, live }) => {
        cardsHtml += _buildJCard(m, idx, date, boostKey, live);
      });
    }
    if (porJugar.length) {
      cardsHtml += '<div class="jv2-section-label">Por jugar</div>';
      porJugar.forEach(({ m, idx, live }) => {
        cardsHtml += _buildJCard(m, idx, date, boostKey, live);
      });
    }

    sectionsHtml +=
      '<div class="jv2-section" id="jornada-' + date + '">' +
        '<div class="jv2-jornada-header">' +
          '<button class="jv2-nav-arrow" type="button" ' + prevAttr + ' aria-label="Jornada anterior">‹</button>' +
          '<div class="jv2-jornada-title">' +
            '<div class="jv2-jornada-name">JORNADA ' + jNum + ' · GRUPOS</div>' +
            '<div class="jv2-jornada-date">' + dateShort + ' · ' + dayLabel + '</div>' +
          '</div>' +
          '<button class="jv2-nav-arrow" type="button" ' + nextAttr + ' aria-label="Jornada siguiente">›</button>' +
        '</div>' +
        '<div class="jv2-results-block">' +
          '<div class="jv2-results-title">Resultados</div>' +
          '<div class="jv2-results-sub">' + subTitle + '</div>' +
        '</div>' +
        cardsHtml +
      '</div>';
  });

  // Layout: columna de jornadas + sidebar única sticky
  container.innerHTML =
    '<div class="jornada-wrap">' +
      '<div class="jornada-main jv2-main">' + sectionsHtml + '</div>' +
      '<div class="jornada-sidebar">' + sidebarHtml + '</div>' +
    '</div>';

  // Wire nav arrows (scroll suave a la sección anterior/siguiente).
  container.querySelectorAll('.jv2-nav-arrow[data-jump]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.getAttribute('data-jump'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // Cinta usuario móvil
  _renderUserStrip();
}
window.renderVistaJornada = renderVistaJornada;

// _buildJCard — tarjeta dark de Jornada (Design v2):
//   Top: 🏟️ estadio | día + hora.
//   Mid: bandera circular | marcador grande | bandera circular (códigos debajo).
//   Chips de acierto (solo finalizados): 1X2 ✓/✗, Exacto ✓/✗, Goleador ✓/✗, vs IA ✓/✗
//                                        + chip dorado pts ganados (con marca ×2 si boost+exacto).
//   Boost row debajo de chips.
// `live` es la fila de window._liveScoresByMatchKey si existe (puede ser null).
function _buildJCard(m, idx, date, boostKey, live) {
  const matchKey = getMatchKey(m);
  const pred = predictions[matchKey] || {};
  const isBoost = boostKey === matchKey;
  const isFinished = !!(live && live.status === 'finished');

  // Equipos y banderas
  const hTeam = EQUIPOS.find(e => e.name === m.home);
  const aTeam = EQUIPOS.find(e => e.name === m.away);
  const hFlag = hTeam ? SB + '/flags/' + hTeam.flag + '.png' : '';
  const aFlag = aTeam ? SB + '/flags/' + aTeam.flag + '.png' : '';
  const hCode = hTeam ? hTeam.flag : (m.home || '').substring(0, 3).toUpperCase();
  const aCode = aTeam ? aTeam.flag : (m.away || '').substring(0, 3).toUpperCase();

  // Estado del pronóstico
  const hasPred = pred.l !== null && pred.l !== undefined && pred.v !== null && pred.v !== undefined;

  // Marcador a mostrar:
  //   - finalizado → score real desde live (o realHome/realAway como fallback).
  //   - no finalizado → predicción del usuario o '—'.
  let scoreL, scoreR;
  if (isFinished) {
    scoreL = (live && live.score_home != null) ? live.score_home : (m.realHome != null ? m.realHome : '—');
    scoreR = (live && live.score_away != null) ? live.score_away : (m.realAway != null ? m.realAway : '—');
  } else {
    scoreL = hasPred ? pred.l : '—';
    scoreR = hasPred ? pred.v : '—';
  }

  // Hora y estadio
  const dt = new Date(m.date);
  const hora = dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
  const dayShort = dt.toLocaleDateString('es-ES', { weekday: 'short' }).replace('.', '').toUpperCase();
  const stadium = m.stadium ? m.stadium.replace(' Stadium', '').replace(' Estadio', '') : '';

  // Chips de acierto + pts ganados — solo si finalizado y tenemos resultado real numérico.
  let chipsHtml = '';
  let goldChipHtml = '';
  if (isFinished && hasPred && typeof scoreL === 'number' && typeof scoreR === 'number') {
    const realL = scoreL;
    const realR = scoreR;
    const predWithSaved = Object.assign({}, pred, { saved: pred.saved !== false });

    const isExact = pred.l === realL && pred.v === realR;
    const signMatch = Math.sign(pred.l - pred.v) === Math.sign(realL - realR);
    // Goleador: replicamos la lógica de calcMatchPoints.
    let golMatch = false;
    if (pred.gol && realL !== realR) {
      const winnerTeamName = realL > realR ? m.home : m.away;
      const winnerTeam = EQUIPOS.find(e => e.name === winnerTeamName);
      const realScorer = winnerTeam?.players?.[0]?.key || null;
      golMatch = !!(realScorer && pred.gol === realScorer);
    }
    const iaBonus = (typeof iaBonusWillApply === 'function') ? iaBonusWillApply(matchKey, predWithSaved, realL, realR) : false;

    const chip = (label, ok) => {
      const cls = ok ? 'jv2-chip jv2-chip--ok' : 'jv2-chip jv2-chip--ko';
      const mark = ok ? '✓' : '✗';
      return '<span class="' + cls + '">' + label + ' ' + mark + '</span>';
    };
    chipsHtml = chip('1X2', signMatch) + chip('Exacto', isExact);
    if (pred.gol) chipsHtml += chip('Goleador', golMatch);
    // vs IA: chip solo si había contra-IA (mySign !== ia.sign). Si ni siquiera había contra-IA, no se muestra.
    const ia = (typeof iaPredictions === 'object') ? iaPredictions[matchKey] : null;
    const mySign = (typeof getMySign === 'function') ? getMySign(pred) : null;
    if (ia && ia.sign && mySign && mySign !== ia.sign) chipsHtml += chip('vs IA', iaBonus);

    const pts = (typeof calcMatchPoints === 'function') ? calcMatchPoints(predWithSaved, realL, realR, matchKey) : 0;
    const isBoostX2 = isBoost && isExact;
    goldChipHtml = '<span class="jv2-chip jv2-chip--gold">+' + pts + ' pts' + (isBoostX2 ? ' ×2' : '') + '</span>';
  }

  const boostRowCls = isBoost ? 'jv2-boost active' : 'jv2-boost';
  const boostLabel = isBoost
    ? '<span class="jv2-boost-label active">🔥 Boost activo</span>'
    : '<span class="jv2-boost-label">🔥 Boost a este partido</span>';
  const chkChecked = isBoost ? 'checked' : '';

  return (
    '<div class="jv2-card' + (isBoost ? ' is-boost' : '') + (isFinished ? ' is-finished' : '') + '" id="jcard-' + idx + '">' +
      '<div class="jv2-card-top">' +
        '<div class="jv2-card-stadium">🏟️ ' + stadium + '</div>' +
        '<div class="jv2-card-when">' + dayShort + ' · ' + hora + '</div>' +
      '</div>' +
      '<div class="jv2-card-mid">' +
        '<div class="jv2-team">' +
          '<div class="jv2-flag"><img src="' + hFlag + '" loading="lazy" onerror="this.style.display=\'none\'"></div>' +
          '<div class="jv2-team-code">' + hCode + '</div>' +
        '</div>' +
        '<div class="jv2-score">' +
          '<span class="jv2-score-num">' + scoreL + '</span>' +
          '<span class="jv2-score-sep">:</span>' +
          '<span class="jv2-score-num">' + scoreR + '</span>' +
        '</div>' +
        '<div class="jv2-team">' +
          '<div class="jv2-flag"><img src="' + aFlag + '" loading="lazy" onerror="this.style.display=\'none\'"></div>' +
          '<div class="jv2-team-code">' + aCode + '</div>' +
        '</div>' +
      '</div>' +
      (chipsHtml || goldChipHtml
        ? '<div class="jv2-chips">' + chipsHtml + goldChipHtml + '</div>'
        : '') +
      '<div class="' + boostRowCls + '">' +
        '<input type="checkbox" ' + chkChecked + ' ' +
          'onchange="jcardBoostToggle(\'' + matchKey + '\',\'' + date + '\',this)" ' +
          'class="jv2-boost-check">' +
        boostLabel +
        '<button onclick="openJcardModal(\'' + matchKey + '\')" class="jv2-card-link" type="button">🔍 Ver tarjeta</button>' +
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

function openJcardModal(matchKey, opts) {
  opts = opts || {};
  const cardEl = document.getElementById('card-wrap-' + matchKey);
  if (!cardEl) {
    renderAll(() => _showJcardModal(matchKey, opts));
    return;
  }
  _showJcardModal(matchKey, opts);
}

function _showJcardModal(matchKey, opts) {
  opts = opts || {};
  const editable = !!opts.editable;

  const prev = document.getElementById('jcard-modal-overlay');
  if (prev) prev.remove();

  const initialCardEl = document.getElementById('card-wrap-' + matchKey);
  if (!initialCardEl) return;

  const overlay = document.createElement('div');
  overlay.id = 'jcard-modal-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:9999;' +
    'display:flex;align-items:flex-start;justify-content:center;padding:16px;' +
    'animation:fadeIn .15s ease;box-sizing:border-box;overflow:hidden;';

  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'margin:0 auto;max-width:calc(100vw - 32px);max-height:calc(100vh - 32px);' +
    'overflow-x:hidden;overflow-y:auto;border-radius:16px;padding-bottom:24px;' +
    'position:relative;box-sizing:border-box;left:0;right:0;';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '\u2715';
  closeBtn.style.cssText =
    'position:sticky;top:8px;float:right;margin:8px 8px 0 0;z-index:1;' +
    'background:rgba(0,0,0,.6);border:1px solid #3a3a3e;color:#9ca3af;' +
    'width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:12px;' +
    'display:flex;align-items:center;justify-content:center;';

  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // READ-ONLY (Jornada Ver tarjeta) \u2014 clone path intact.
  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  if (!editable) {
    const clone = initialCardEl.cloneNode(true);
    const origSelects  = initialCardEl.querySelectorAll('select');
    const cloneSelects = clone.querySelectorAll('select');
    origSelects.forEach((s, i) => { if (cloneSelects[i]) cloneSelects[i].value = s.value; });
    const origInputs  = initialCardEl.querySelectorAll('input');
    const cloneInputs = clone.querySelectorAll('input');
    origInputs.forEach((inp, i) => {
      if (!cloneInputs[i]) return;
      if (inp.type === 'checkbox' || inp.type === 'radio') cloneInputs[i].checked = inp.checked;
      else cloneInputs[i].value = inp.value;
    });
    clone.querySelectorAll('[id]').forEach(el => el.removeAttribute('id'));
    clone.querySelectorAll('button,input,select').forEach(el => {
      el.disabled = true;
      el.style.pointerEvents = 'none';
    });
    clone.style.margin = '0 auto';
    clone.style.left = '0';
    clone.style.right = '0';
    wrapper.appendChild(closeBtn);
    wrapper.appendChild(clone);
    overlay.appendChild(wrapper);
    document.body.appendChild(overlay);
    clone.style.width = (clone.offsetWidth - 5) + 'px';
    clone.style.margin = '0 auto';
    overlay.onclick = (e) => { if (e.target === overlay) overlay.remove(); };
    closeBtn.onclick = () => overlay.remove();
    return;
  }

  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // EDITABLE (Grupos compact card click) \u2014 MOVE original + nav.
  // Replica el patr\u00f3n de Fase Final (_renderElimExpanded): flechas
  // \u2039 \u203a + counter "X/N" para navegar entre los partidos del mismo
  // grupo. Cada navegaci\u00f3n restituye el actual y mueve el siguiente.
  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const startMatch = (typeof PARTIDOS !== 'undefined') ? PARTIDOS.find(function (m) {
    return (typeof getMatchKey === 'function') ? getMatchKey(m) === matchKey : false;
  }) : null;
  const matchList = (startMatch && typeof PARTIDOS !== 'undefined')
    ? PARTIDOS.filter(function (m) { return m.group === startMatch.group; })
    : [];
  let currentIdx = matchList.findIndex(function (m) {
    return (typeof getMatchKey === 'function') ? getMatchKey(m) === matchKey : false;
  });
  if (currentIdx < 0) currentIdx = 0;

  // Slide 7 (1-indexed): tabla de clasificación del grupo. Se monta como
  // overlay transient sin restitución (currentAnchors=null en _placeStandingsIntoModal).
  const totalSteps = matchList.length + 1;

  // Nav header (counter + arrows). Solo si hay >1 partido en el grupo.
  let navHeader = null;
  let prevBtn = null;
  let nextBtn = null;
  let counterEl = null;
  if (totalSteps > 1) {
    navHeader = document.createElement('div');
    navHeader.className = 'jcard-nav';

    prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'jcard-nav__arrow jcard-nav__arrow--prev';
    prevBtn.setAttribute('aria-label', 'Partido anterior');
    prevBtn.textContent = '\u2039';

    counterEl = document.createElement('span');
    counterEl.className = 'jcard-nav__counter';

    nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'jcard-nav__arrow jcard-nav__arrow--next';
    nextBtn.setAttribute('aria-label', 'Partido siguiente');
    nextBtn.textContent = '\u203a';

    navHeader.appendChild(prevBtn);
    navHeader.appendChild(counterEl);
    navHeader.appendChild(nextBtn);
    wrapper.appendChild(navHeader);
  }

  wrapper.appendChild(closeBtn);
  overlay.appendChild(wrapper);
  document.body.appendChild(overlay);

  // Estado de la tarjeta actualmente en el modal.
  let currentTarget = null;
  let currentAnchors = null; // { parent, nextSibling, styleAttr, matchKey }
  let lastCardWidth = null; // cacheo del offsetWidth de la última card colocada en el wrapper. Lo consume _placeStandingsIntoModal para mantener armonía visual con la slide standings.

  function _restoreCurrent() {
    if (!currentTarget) return;
    // Caso transient (slide standings): no hay restitución, solo remove.
    if (currentAnchors === null) {
      if (currentTarget.parentNode) currentTarget.parentNode.removeChild(currentTarget);
      currentTarget = null;
      return;
    }
    const t = currentTarget;
    const a = currentAnchors;
    if (a.styleAttr === null) t.removeAttribute('style');
    else t.setAttribute('style', a.styleAttr);
    if (a.nextSibling && a.nextSibling.parentNode === a.parent) {
      a.parent.insertBefore(t, a.nextSibling);
    } else {
      a.parent.appendChild(t);
    }
    try {
      document.dispatchEvent(new CustomEvent('jcard:updated', { detail: { matchKey: a.matchKey } }));
    } catch (e) { /* no-op */ }
    currentTarget = null;
    currentAnchors = null;
  }

  function _placeIntoModal(mk) {
    const cardEl = document.getElementById('card-wrap-' + mk);
    if (!cardEl) return null;
    currentAnchors = {
      parent: cardEl.parentNode,
      nextSibling: cardEl.nextSibling,
      styleAttr: cardEl.getAttribute('style'),
      matchKey: mk
    };
    cardEl.style.margin = '0 auto';
    cardEl.style.left = '0';
    cardEl.style.right = '0';
    wrapper.appendChild(cardEl);
    cardEl.style.width = (cardEl.offsetWidth - 5) + 'px';
    cardEl.style.margin = '0 auto';
    lastCardWidth = cardEl.offsetWidth;
    currentTarget = cardEl;
    // Volver al top del wrapper en cada navegaci\u00f3n.
    wrapper.scrollTop = 0;
    return cardEl;
  }

  function _placeStandingsIntoModal() {
    if (typeof window._renderGruposStandings !== 'function') return null;
    const letra = startMatch && startMatch.group;
    if (!letra) return null;
    const standingsCard = window._renderGruposStandings(letra);
    if (!standingsCard) return null;
    standingsCard.style.padding = '0';
    const slot = document.createElement('div');
    slot.className = 'jcard-modal-standings-slot';
    // Usar el ancho cacheado de la última card mostrada (lastCardWidth set
    // por _placeIntoModal). Garantiza armonía visual con slides 1-6.
    // Fallbacks: si ninguna card se mostró aún, intentar con .card del DOM
    // (grid hidden), luego viewport - margen, luego 320 absoluto.
    let targetWidth = lastCardWidth;
    if (!targetWidth || targetWidth < 200) {
      const refCard = document.querySelector('.card');
      if (refCard && refCard.offsetWidth > 200) {
        targetWidth = refCard.offsetWidth - 5;
      } else {
        targetWidth = Math.min(window.innerWidth - 40, 540);
      }
    }
    slot.style.cssText =
      'margin:0 auto;box-sizing:border-box;padding:0;width:' + targetWidth + 'px;';
    slot.appendChild(standingsCard);
    wrapper.appendChild(slot);
    currentTarget = slot;
    currentAnchors = null;
    wrapper.scrollTop = 0;
    return slot;
  }

  function _updateNavHeader() {
    if (!navHeader) return;
    counterEl.textContent = (currentIdx + 1) + ' / ' + totalSteps;
    if (currentIdx <= 0) prevBtn.setAttribute('aria-disabled', 'true');
    else prevBtn.removeAttribute('aria-disabled');
    if (currentIdx >= totalSteps - 1) nextBtn.setAttribute('aria-disabled', 'true');
    else nextBtn.removeAttribute('aria-disabled');
  }

  function _navigateTo(idx) {
    if (idx < 0 || idx >= totalSteps) return;
    if (idx === currentIdx && currentTarget) return;
    _restoreCurrent();
    currentIdx = idx;
    if (idx < matchList.length) {
      // Slide partido (0..matchList.length-1)
      const newKey = (typeof getMatchKey === 'function') ? getMatchKey(matchList[idx]) : null;
      if (!newKey) return;
      _placeIntoModal(newKey);
    } else {
      // Slide standings (idx === matchList.length)
      _placeStandingsIntoModal();
    }
    _updateNavHeader();
  }

  function closeModal() {
    _restoreCurrent();
    overlay.remove();
  }

  if (prevBtn) prevBtn.addEventListener('click', function () { _navigateTo(currentIdx - 1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { _navigateTo(currentIdx + 1); });
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  closeBtn.onclick = closeModal;

  // Initial placement.
  _placeIntoModal(matchKey);
  _updateNavHeader();
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



// ─────────────────────────────────────────────────────────────────────
// Sprint B · Grupos redesign helpers (G1: chips A-L, G2: card shell)
// G3 (carousel) y G4 (standings) viven más abajo. Reusa .collap pattern
// de predictor-shell.css. Ver docs: PR Sprint B.
// ─────────────────────────────────────────────────────────────────────

function _getGroupCount(letra) {
  if (typeof getGroupCompleted === 'function') return getGroupCompleted(letra);
  var matches = (typeof PARTIDOS !== 'undefined' ? PARTIDOS : []).filter(function (m) {
    return m.group === letra;
  });
  var done = 0;
  matches.forEach(function (m) {
    var matchKey = (typeof getMatchKey === 'function') ? getMatchKey(m) : null;
    var pred = (typeof predictions !== 'undefined' && matchKey) ? predictions[matchKey] : null;
    if (pred && pred.l != null && pred.v != null) done++;
  });
  return done;
}

// Sprint Globo MVP: monta cinta dorada como sibling previo de #dice-global-bar.
// Idempotente. Llamado desde _renderGruposLetterBar() para garantizar montaje
// en cada render del page-grupos sin tocar index.html.
function _ensureGloboCintaMount() {
  var diceBar = document.getElementById('dice-global-bar');
  if (!diceBar || !diceBar.parentNode) return;
  var mount = document.getElementById('fc-globo-cinta-mount');
  if (!mount) {
    mount = document.createElement('div');
    mount.id = 'fc-globo-cinta-mount';
    diceBar.parentNode.insertBefore(mount, diceBar);
  } else if (mount.nextSibling !== diceBar) {
    diceBar.parentNode.insertBefore(mount, diceBar);
  }
  if (typeof window._mountGloboCinta === 'function') {
    window._mountGloboCinta(mount);
  }
}

function _renderGruposLetterBar() {
  _ensureGloboCintaMount();
  var bar = document.getElementById('grupos-letter-bar');
  if (!bar) return;
  var letras = (typeof GRUPOS !== 'undefined' ? GRUPOS : []).map(function (g) { return g.letra; });
  // Replica visual del stepper de Fase Final (.fc-elim-stepper) — mismas
  // pills, mismos states (is-active dorado / is-complete verde / is-locked).
  // Sticky position via wrapper class .fc-grupos-stepper-wrap.
  var html = '<div class="fc-grupos-stepper-wrap"><div class="fc-elim-stepper fc-grupos-stepper" role="tablist">';
  letras.forEach(function (letra) {
    var count = _getGroupCount(letra);
    var classes = 'fc-elim-stepper__item';
    if (count === 6)        classes += ' is-complete';
    var lbl = (typeof escapeHtml === 'function') ? escapeHtml(letra) : letra;
    html += '<button type="button" class="' + classes +
              '" data-letra="' + lbl + '" role="tab" aria-label="Grupo ' + lbl +
              '" onclick="_scrollToGrupoCard(\'' + lbl + '\')">' +
              '<span class="fc-elim-stepper__label">' + lbl + '</span>' +
              '<span class="fc-elim-stepper__counter">' + count + '/6</span>' +
            '</button>';
  });
  html += '</div></div>';
  bar.innerHTML = html;
}

function _scrollToGrupoCard(letra) {
  var card = document.getElementById('grupo-card-' + letra);
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  _setActiveChip(letra);
}

function _setActiveChip(letra) {
  var chips = document.querySelectorAll('.fc-grupos-stepper .fc-elim-stepper__item');
  chips.forEach(function (c) {
    c.classList.toggle('is-active', c.getAttribute('data-letra') === letra);
  });
}

function _refreshGruposLetterBar() {
  var chips = document.querySelectorAll('.fc-grupos-stepper .fc-elim-stepper__item');
  chips.forEach(function (c) {
    var letra = c.getAttribute('data-letra');
    var count = _getGroupCount(letra);
    c.classList.toggle('is-complete', count === 6);
    var cnt = c.querySelector('.fc-elim-stepper__counter');
    if (cnt) cnt.textContent = count + '/6';
  });
}

window._renderGruposLetterBar = _renderGruposLetterBar;
window._refreshGruposLetterBar = _refreshGruposLetterBar;
window._scrollToGrupoCard = _scrollToGrupoCard;
window._setActiveChip = _setActiveChip;

// ─────────────────────────────────────────────────────────────────────
// G2 · Card colapsable header (12 grupos A-L). Reusa .collap pattern.
// El body interno mantiene #grid-{letra} y #gtable-{letra} hidden para
// que createMatchCard / renderGroupTableCard sigan teniendo destino.
// ─────────────────────────────────────────────────────────────────────

function _renderGruposCardShell(letra, partidosCount) {
  var grupo = (typeof GRUPOS !== 'undefined') ? GRUPOS.find(function (g) { return g.letra === letra; }) : null;
  if (!grupo) return null;
  var equipos = grupo.equipos || [];
  var done = (partidosCount && partidosCount.done != null) ? partidosCount.done : 0;
  var total = (partidosCount && partidosCount.total != null) ? partidosCount.total : 6;
  var stateClass = (done === total) ? 'is-completo' : (done > 0 ? 'is-parcial' : 'is-vacio');

  var section = document.createElement('section');
  section.className = 'fc-grupos-card collap';
  section.id = 'grupo-card-' + letra;

  var flagsHtml = equipos.slice(0, 4).map(function (teamName) {
    var team = (typeof EQUIPOS !== 'undefined') ? EQUIPOS.find(function (e) { return e.name === teamName; }) : null;
    var code = (team && team.flag) ? team.flag : (teamName || '').slice(0, 3).toUpperCase();
    var src = (team && team.flag && typeof SB !== 'undefined') ? (SB + '/flags/' + team.flag + '.png') : '';
    return '<span class="fc-grupos-card__flag" data-code="' + escapeHtml(code) + '">' +
             (src ? '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(code) + '" onerror="this.style.display=\'none\';this.parentNode.classList.add(\'is-fallback\');"/>' : '') +
             '<span class="fc-grupos-card__flag-code">' + escapeHtml(code) + '</span>' +
           '</span>';
  }).join('');

  section.innerHTML =
    '<button type="button" class="collap-toggle fc-grupos-card__toggle" aria-expanded="false">' +
      '<span class="fc-grupos-card__bar ' + stateClass + '"></span>' +
      '<span class="fc-grupos-card__title-block">' +
        '<span class="fc-grupos-card__label">GRUPO</span>' +
        '<span class="fc-grupos-card__letra">' + letra + '</span>' +
      '</span>' +
      '<span class="fc-grupos-card__flags">' + flagsHtml + '</span>' +
      '<span class="fc-grupos-card__spacer"></span>' +
      '<span class="fc-grupos-card__dice" role="button" aria-label="Simular grupo ' + letra +
        '" onclick="event.stopPropagation(); diceSimulateGroup(\'' + letra + '\');">🎲</span>' +
      '<span class="fc-grupos-card__progress ' + stateClass + '">' + done + '/' + total + '</span>' +
      '<span class="chev" aria-hidden="true">▾</span>' +
    '</button>' +
    // Source hidden: grid (tarjetas editables) + gtable (tabla clasificación).
    // El expanded se monta como SIBLING (insertAfter). El gtable se mueve al
    // slot 7 del carousel cuando se abre y se restituye al cerrar.
    '<div class="collap-body-inner fc-grupos-card__source">' +
      '<div class="cards-grid" id="grid-' + letra + '"></div>' +
      '<div id="gtable-' + letra + '" class="group-table-card"></div>' +
    '</div>';

  var btn = section.querySelector('.collap-toggle');
  btn.addEventListener('click', function (ev) {
    if (ev.target && ev.target.closest && ev.target.closest('.fc-grupos-card__dice')) return;
    if (typeof _toggleGruposExpanded === 'function') _toggleGruposExpanded(letra, section);
  });

  return section;
}

window._renderGruposCardShell = _renderGruposCardShell;

// Sprint B fix · monta el carousel expandido como SIBLING de la card del
// grupo (no anidado dentro). Replica el patrón de Fase Final donde
// .fc-elim-expanded vive como hermano del row → carousel container ~347px,
// slot 86vw (322px) cabe completo. Anidar dentro del card consumía
// 126px de margins+padding+borders → carousel solo 249px → overflow.
function _toggleGruposExpanded(letra, sectionEl) {
  if (!sectionEl) return;
  var existing = document.querySelector('.fc-grupos-expanded');
  var sameLetra = existing && existing.getAttribute('data-letra') === letra;

  // Cerrar cualquier expanded actual (también restituye su gtable a la source).
  if (existing) {
    var oldLetra = existing.getAttribute('data-letra');
    var oldSection = document.getElementById('grupo-card-' + oldLetra);
    var oldGtable = existing.querySelector('#gtable-' + oldLetra);
    if (oldGtable && oldSection) {
      var oldSource = oldSection.querySelector('.fc-grupos-card__source');
      if (oldSource) oldSource.appendChild(oldGtable);
    }
    existing.remove();
    if (oldSection) {
      oldSection.classList.remove('open');
      var oldBtn = oldSection.querySelector('.collap-toggle');
      if (oldBtn) oldBtn.setAttribute('aria-expanded', 'false');
    }
  }
  // Si era el mismo letra, ya cerramos — no abrir de nuevo.
  if (sameLetra) return;

  // Construir el expanded sibling. Refrescar la tabla (la regenerá el
  // override de renderGroupTableCard) antes de moverla al slot 7.
  if (typeof renderGroupTableCard === 'function') renderGroupTableCard(letra);

  var partidos = (typeof PARTIDOS !== 'undefined') ? PARTIDOS.filter(function (m) { return m.group === letra; }) : [];
  var gtable = sectionEl.querySelector('#gtable-' + letra);
  var carouselEl = (typeof _renderGruposCarousel === 'function') ? _renderGruposCarousel(letra, partidos, gtable) : null;
  if (!carouselEl) return;

  var expanded = document.createElement('section');
  expanded.className = 'fc-grupos-expanded';
  expanded.setAttribute('data-letra', letra);
  expanded.appendChild(carouselEl);

  // Insertar como sibling después de la card.
  if (sectionEl.parentNode) sectionEl.parentNode.insertBefore(expanded, sectionEl.nextSibling);

  // Marcar la card como abierta (chev rotation) y a11y.
  sectionEl.classList.add('open');
  var btn = sectionEl.querySelector('.collap-toggle');
  if (btn) btn.setAttribute('aria-expanded', 'true');
}

window._toggleGruposExpanded = _toggleGruposExpanded;

// ─────────────────────────────────────────────────────────────────────
// G3 · Carrusel scroll-snap (replica patrón Fase Final ui-elim-shell)
// Recibe tarjetas YA CREADAS por createMatchCard. NO las recrea —
// solo las MUEVE a slots con scroll-snap-align:center. Preserva
// listeners de attachEvents porque appendChild mueve el Element.
// ─────────────────────────────────────────────────────────────────────

// Compact preview card replicando el patrón visual de Fase Final (.ko-card).
// NO renderiza la tarjeta editable inline — esa vive en hidden #grid-{letra}
// para que openJcardModal pueda clonarla. Click compact → openJcardModal.
function _renderGruposCompactCard(match) {
  var matchKey = (typeof getMatchKey === 'function')
    ? getMatchKey(match)
    : (match.group + '_' + match.home + '_' + match.away);

  var hTeam = (typeof EQUIPOS !== 'undefined') ? EQUIPOS.find(function (e) { return e.name === match.home; }) : null;
  var aTeam = (typeof EQUIPOS !== 'undefined') ? EQUIPOS.find(function (e) { return e.name === match.away; }) : null;

  var hKit = (hTeam && typeof kitUrl === 'function') ? kitUrl(hTeam.slug, 'home') : '';
  var aKit = (aTeam && typeof kitUrl === 'function') ? kitUrl(aTeam.slug, 'away') : '';
  var hFlag = hTeam ? ((typeof SB !== 'undefined' ? SB : '') + '/flags/' + hTeam.flag + '.png') : '';
  var aFlag = aTeam ? ((typeof SB !== 'undefined' ? SB : '') + '/flags/' + aTeam.flag + '.png') : '';

  var pred = (typeof predictions !== 'undefined') ? (predictions[matchKey] || {}) : {};
  var estado = (typeof getEstadoPartido === 'function') ? getEstadoPartido(match) : 'open';

  var statusCls = 'open';
  var statusTxt = 'Pronosticar →';
  if (pred.saved) {
    statusCls = 'saved';
    if (pred.l != null && pred.v != null) statusTxt = '✓ ' + pred.l + '–' + pred.v;
    else statusTxt = '✓ Guardado';
  } else if (estado === 'closed') { statusCls = 'locked'; statusTxt = '🔒 Cerrado'; }
  else if (estado === 'live')     { statusCls = 'live';   statusTxt = '🔴 En vivo'; }
  else if (estado === 'done')     { statusCls = 'done';   statusTxt = 'Finalizado'; }

  // Truncate 14 chars sin sufijo — réplica de buildKOCard (ko.js:322).
  var hLabel = hTeam ? (match.home || '').substring(0, 14) : (match.home || '');
  var aLabel = aTeam ? (match.away || '').substring(0, 14) : (match.away || '');
  var dateLabel = (typeof fmtDate === 'function') ? fmtDate(match.date) : '';
  var timeLabel = (typeof fmtTime === 'function') ? fmtTime(match.date) : '';

  // Réplica EXACTA de buildKOCard (ko.js:251): mismas clases .ko-* + onclick directo.
  // No añadimos .fc-grupos-mini — esa clase introducía hover overrides que rompían
  // el match visual con Fase Final.
  var card = document.createElement('div');
  card.className = 'ko-card' + (pred.saved ? ' ko-saved' : '');
  card.setAttribute('data-match-key', matchKey);
  card.onclick = function () {
    if (typeof openJcardModal === 'function') openJcardModal(matchKey, { editable: true });
  };

  var hHalf = hTeam
    ? '<div class="ko-half L"><div class="ko-color" style="background:#fff"></div>' +
        '<div class="ko-kit" style="background-image:linear-gradient(to bottom, rgba(10,10,20,0.5) 0%, transparent 35%),linear-gradient(to bottom, transparent 60%, rgba(10,10,20,0.6) 100%),url(\'' + hKit + '\')"></div>' +
        '<div class="ko-vign"></div></div>'
    : '';
  var aHalf = aTeam
    ? '<div class="ko-half R"><div class="ko-color" style="background:#fff"></div>' +
        '<div class="ko-kit" style="background-image:linear-gradient(to bottom, rgba(10,10,20,0.5) 0%, transparent 35%),linear-gradient(to bottom, transparent 60%, rgba(10,10,20,0.6) 100%),url(\'' + aKit + '\')"></div>' +
        '<div class="ko-vign"></div></div>'
    : '';

  // Body section — replica espacio que dejaba el align-items:stretch del
  // carousel. Si pred saved muestra marcador grande + goleador. Si no,
  // CTA "Pronostica este partido →". Solo visible en .fc-grupos-carousel
  // (CSS scope), Fase Final no lo renderiza ni lo necesita.
  var bodyHtml;
  if (pred.saved && pred.l != null && pred.v != null) {
    var golLabel = '';
    if (pred.gol) {
      var golTeam = pred.gol.startsWith && pred.gol.indexOf('-') > 0 ? pred.gol.split('-')[0] : '';
      var golName = pred.gol.indexOf('-') > 0 ? pred.gol.split('-').slice(1).join('-') : pred.gol;
      golLabel = '<span class="ko-body__gol">⚽ ' + escapeHtml(golName.replace(/_/g, ' ')) + '</span>';
    }
    bodyHtml =
      '<div class="ko-body ko-body--saved">' +
        '<span class="ko-body__label">TU PRONÓSTICO</span>' +
        '<span class="ko-body__score">' + pred.l + ' <span class="ko-body__sep">–</span> ' + pred.v + '</span>' +
        golLabel +
      '</div>';
  } else {
    bodyHtml =
      '<div class="ko-body ko-body--empty">' +
        '<span class="ko-body__cta">⚡ Toca para pronosticar</span>' +
      '</div>';
  }

  card.innerHTML =
    '<div class="ko-hero">' +
      hHalf + aHalf +
      '<div class="ko-fade"></div>' +
      '<div class="ko-team home">' +
        '<div class="ko-flag">' + (hTeam ? '<img src="' + hFlag + '" alt="" onerror="this.remove()"/>' : '❓') + '</div>' +
        '<div class="ko-tname' + (!hTeam ? ' tbd' : '') + '">' + escapeHtml(hLabel) + '</div>' +
        '<div class="ko-trole">local</div>' +
      '</div>' +
      '<div class="ko-team away">' +
        '<div class="ko-flag">' + (aTeam ? '<img src="' + aFlag + '" alt="" onerror="this.remove()"/>' : '❓') + '</div>' +
        '<div class="ko-tname' + (!aTeam ? ' tbd' : '') + '">' + escapeHtml(aLabel) + '</div>' +
        '<div class="ko-trole">visitante</div>' +
      '</div>' +
      '<div class="ko-center">' +
        '<div class="ko-vs-circle"><div class="ko-ball-bg"></div><span class="ko-vs-text">VS</span></div>' +
        '<div class="ko-pill">' + escapeHtml(match.venue || ('Grupo ' + match.group)) + '</div>' +
        '<div style="font-size:8px;font-weight:600;color:rgba(255,255,255,.5);margin-top:3px;text-align:center;letter-spacing:.04em">' + escapeHtml(timeLabel) + '</div>' +
      '</div>' +
    '</div>' +
    bodyHtml +
    '<div class="ko-ia-hint" style="display:none"></div>' +
    '<div class="ko-footer">' +
      '<span class="ko-date">' + escapeHtml(dateLabel) + '</span>' +
      '<span class="ko-status ' + statusCls + '">' + escapeHtml(statusTxt) + '</span>' +
    '</div>';

  return card;
}

window._renderGruposCompactCard = _renderGruposCompactCard;

// Refresca el header progress N/6 + state class de la card colapsable de un
// grupo. Helper compartido entre el listener jcard:updated (close del modal
// editable) y los flujos de simulación masiva en admin.js que NO pasan por
// el modal (diceSimulateGroup, diceSimulateAllGroups). Disparar el evento
// jcard:updated por cada partido en una simulación masiva sería 72×
// re-renders de compact card + letterbar + tabla; este helper permite hacer
// un refresh batch de O(grupos) en vez de O(partidos).
function _refreshGrupoCardHeader(letra) {
  if (!letra) return;
  var cardSection = document.getElementById('grupo-card-' + letra);
  if (!cardSection) return;
  var partidos = (typeof PARTIDOS !== 'undefined') ? PARTIDOS.filter(function (m) { return m.group === letra; }) : [];
  var done = partidos.filter(function (m) {
    var p = (typeof predictions !== 'undefined') ? predictions[(typeof getMatchKey === 'function') ? getMatchKey(m) : null] : null;
    return p && p.l != null && p.v != null;
  }).length;
  var total = partidos.length;
  var stateClass = (done === total && total > 0) ? 'is-completo' : (done > 0 ? 'is-parcial' : 'is-vacio');
  var bar = cardSection.querySelector('.fc-grupos-card__bar');
  if (bar) {
    bar.classList.remove('is-completo', 'is-parcial', 'is-vacio');
    bar.classList.add(stateClass);
  }
  var prog = cardSection.querySelector('.fc-grupos-card__progress');
  if (prog) {
    prog.classList.remove('is-completo', 'is-parcial', 'is-vacio');
    prog.classList.add(stateClass);
    prog.textContent = done + '/' + total;
  }
}
window._refreshGrupoCardHeader = _refreshGrupoCardHeader;

// Sprint B fix · al cerrar el modal editable, refrescar:
//   1) compact card preview en el carrusel (estado/marcador del chip),
//   2) chip count del letterbar (N/6),
//   3) tabla clasificación del grupo afectado.
// Listener registrado UNA vez (guard con flag en window).
if (!window._jcardUpdatedListenerRegistered) {
  window._jcardUpdatedListenerRegistered = true;
  document.addEventListener('jcard:updated', function (ev) {
    var mk = ev && ev.detail && ev.detail.matchKey;
    if (!mk) return;
    var match = (typeof PARTIDOS !== 'undefined') ? PARTIDOS.find(function (m) {
      return (typeof getMatchKey === 'function') ? getMatchKey(m) === mk : false;
    }) : null;
    if (!match) return;
    // 1) Compact preview — selector corregido tras commit 98f4550 que
    // dropeó la clase .fc-grupos-mini. Ahora el data-match-key vive en
    // .ko-card directo. Scope a .fc-grupos-carousel para evitar matching
    // accidental con KO cards de Fase Final si compartieran attr.
    var existing = document.querySelector('.fc-grupos-carousel .ko-card[data-match-key="' + mk + '"]');
    if (existing && typeof _renderGruposCompactCard === 'function') {
      var fresh = _renderGruposCompactCard(match);
      if (fresh) existing.replaceWith(fresh);
    }
    // 2) Letterbar chip count
    if (typeof _refreshGruposLetterBar === 'function') _refreshGruposLetterBar();
    // 3) Standings table del grupo
    if (typeof renderGroupTableCard === 'function' && match.group) {
      renderGroupTableCard(match.group);
    }
    // 4) Header progress N/6 + state class del card colapsable
    _refreshGrupoCardHeader(match.group);
  });
}

function _renderGruposCarousel(letra, matches, gtableEl) {
  var wrap = document.createElement('div');
  wrap.className = 'fc-grupos-carousel-wrap';

  var carousel = document.createElement('div');
  carousel.className = 'fc-grupos-carousel';
  carousel.setAttribute('role', 'region');
  carousel.setAttribute('aria-label', 'Partidos del grupo ' + letra);

  // 6 match slots — compact preview cards (estilo Fase Final). Click → openJcardModal.
  // Las tarjetas editables siguen viviendo en hidden #grid-{letra} para que el
  // modal pueda clonarlas via cardEl = document.getElementById('card-wrap-{matchKey}').
  for (var i = 0; i < matches.length && i < 6; i++) {
    var slot = document.createElement('div');
    slot.className = 'fc-grupos-slot fc-grupos-slot--match';
    slot.setAttribute('data-slot-idx', String(i));
    var compact = _renderGruposCompactCard(matches[i]);
    if (compact) slot.appendChild(compact);
    carousel.appendChild(slot);
  }

  // Slot 7: standings (mover gtable Element — id preservado para refreshGroupTables)
  if (gtableEl) {
    var sslot = document.createElement('div');
    sslot.className = 'fc-grupos-slot fc-grupos-slot--standings';
    sslot.setAttribute('data-slot-idx', '6');
    sslot.appendChild(gtableEl);
    carousel.appendChild(sslot);
  }

  wrap.appendChild(carousel);

  // Dots indicator
  var dotsEl = document.createElement('div');
  dotsEl.className = 'fc-grupos-carousel__dots';
  dotsEl.setAttribute('data-letra', letra);
  var slotCount = (matches ? Math.min(matches.length, 6) : 0) + (gtableEl ? 1 : 0);
  for (var j = 0; j < slotCount; j++) {
    var dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'fc-grupos-carousel__dot' + (j === 0 ? ' is-active' : '');
    dot.setAttribute('data-dot-idx', String(j));
    dot.setAttribute('aria-label', 'Slot ' + (j + 1));
    dotsEl.appendChild(dot);
  }
  wrap.appendChild(dotsEl);

  // Arrows (desktop only via CSS)
  var prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'fc-grupos-carousel__arrow fc-grupos-carousel__arrow--prev';
  prev.setAttribute('aria-label', 'Anterior');
  prev.textContent = '‹';
  var next = document.createElement('button');
  next.type = 'button';
  next.className = 'fc-grupos-carousel__arrow fc-grupos-carousel__arrow--next';
  next.setAttribute('aria-label', 'Siguiente');
  next.textContent = '›';
  wrap.appendChild(prev);
  wrap.appendChild(next);

  function getSlotWidth() {
    var first = carousel.querySelector('.fc-grupos-slot');
    return first ? first.getBoundingClientRect().width + 12 : 1;
  }
  function setActiveDot(idx) {
    var dots = dotsEl.querySelectorAll('.fc-grupos-carousel__dot');
    for (var k = 0; k < dots.length; k++) {
      dots[k].classList.toggle('is-active', k === idx);
    }
    // Réplica patrón Fase Final: slot actual sin scale/opacity, los demás
    // con scale(.92) + opacity .55 (regla CSS .fc-grupos-slot:not(.is-current)).
    var slots = carousel.querySelectorAll('.fc-grupos-slot');
    for (var s = 0; s < slots.length; s++) {
      slots[s].classList.toggle('is-current', s === idx);
    }
  }
  function scrollToSlot(idx) {
    var slots = carousel.querySelectorAll('.fc-grupos-slot');
    var slot = slots[idx];
    if (slot) slot.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
  // Marcar el primer slot como current al montar.
  var initialSlots = carousel.querySelectorAll('.fc-grupos-slot');
  if (initialSlots[0]) initialSlots[0].classList.add('is-current');

  var rafPending = false;
  carousel.addEventListener('scroll', function () {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () {
      rafPending = false;
      var sw = getSlotWidth();
      var idx = Math.round(carousel.scrollLeft / sw);
      setActiveDot(Math.max(0, Math.min(slotCount - 1, idx)));
    });
  });
  dotsEl.addEventListener('click', function (ev) {
    var btn = ev.target.closest('.fc-grupos-carousel__dot');
    if (!btn) return;
    var idx = Number(btn.getAttribute('data-dot-idx'));
    scrollToSlot(idx);
  });
  prev.addEventListener('click', function () {
    var sw = getSlotWidth();
    var cur = Math.round(carousel.scrollLeft / sw);
    scrollToSlot(Math.max(0, cur - 1));
  });
  next.addEventListener('click', function () {
    var sw = getSlotWidth();
    var cur = Math.round(carousel.scrollLeft / sw);
    scrollToSlot(Math.min(slotCount - 1, cur + 1));
  });

  return wrap;
}

window._renderGruposCarousel = _renderGruposCarousel;

// ─────────────────────────────────────────────────────────────────────
// G4 · Slot 7 tabla clasificación restilada. Reusa calcGroupTableAdvanced
// (scoring.js:234) — NO reinventa el cálculo, solo restila el output.
// Override de renderGroupTableCard (cargado desde scoring.js:268) — esta
// definición gana porque ui-groups.js carga DESPUÉS (main-entry.js:57-58).
// Mantiene el contrato: pinta dentro de #gtable-{letra} para que
// refreshGroupTables siga funcionando.
// ─────────────────────────────────────────────────────────────────────

function _renderGruposStandings(letra) {
  if (typeof calcGroupTableAdvanced !== 'function') return null;
  var rows = calcGroupTableAdvanced(letra) || [];
  var rowsHtml = rows.slice(0, 4).map(function (t, idx) {
    var team = (typeof EQUIPOS !== 'undefined') ? EQUIPOS.find(function (e) { return e.name === t.name || e.slug === t.slug; }) : null;
    var code = (team && team.flag) ? team.flag : (t.name || '').slice(0, 3).toUpperCase();
    var src = (team && team.flag && typeof SB !== 'undefined') ? (SB + '/flags/' + team.flag + '.png') : '';
    var qualifClass = idx < 2 ? ' fc-grupos-standings__row--qualif' : '';
    var gd = t.gd != null ? t.gd : ((t.gf || 0) - (t.gc || 0));
    var gdLabel = gd > 0 ? '+' + gd : String(gd);
    return (
      '<div class="fc-grupos-standings__row' + qualifClass + '" role="row">' +
        '<span class="fc-grupos-standings__pos">' + (idx + 1) + '</span>' +
        '<span class="fc-grupos-standings__flag">' +
          (src ? '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(code) + '" onerror="this.style.display=\'none\';this.parentNode.classList.add(\'is-fallback\');"/>' : '') +
          '<span class="fc-grupos-standings__flag-code">' + escapeHtml(code) + '</span>' +
        '</span>' +
        '<span class="fc-grupos-standings__name">' + escapeHtml(t.name || '') + '</span>' +
        '<span class="fc-grupos-standings__pj">' + (t.pj || 0) + '</span>' +
        '<span class="fc-grupos-standings__gd">' + gdLabel + '</span>' +
        '<span class="fc-grupos-standings__pts">' + (t.pts || 0) + '</span>' +
      '</div>'
    );
  }).join('');

  var headerHtml =
    '<div class="fc-grupos-standings__head" role="row">' +
      '<span class="fc-grupos-standings__pos">#</span>' +
      '<span class="fc-grupos-standings__flag"></span>' +
      '<span class="fc-grupos-standings__name">EQUIPO</span>' +
      '<span class="fc-grupos-standings__pj">PJ</span>' +
      '<span class="fc-grupos-standings__gd">GD</span>' +
      '<span class="fc-grupos-standings__pts">PTS</span>' +
    '</div>';

  var card = document.createElement('div');
  card.className = 'fc-grupos-standings';
  card.innerHTML =
    '<h3 class="fc-grupos-standings__title">CLASIFICACIÓN GRUPO ' + letra + '</h3>' +
    '<div class="fc-grupos-standings__table" role="table">' +
      headerHtml +
      rowsHtml +
    '</div>' +
    '<div class="fc-grupos-standings__footer">Top 2 → 1/16 · 8 mejores 3os clasifican</div>';

  return card;
}

window._renderGruposStandings = _renderGruposStandings;

// Override renderGroupTableCard — wins over scoring.js:268 by load order.
// Conserva el contrato: pinta en #gtable-{letra} para que refreshGroupTables
// + diceSimulateGroup + savePredictions sigan funcionando.
function renderGroupTableCard(letra) {
  var gtable = document.getElementById('gtable-' + letra);
  if (!gtable) return;
  gtable.innerHTML = '';
  var card = window._renderGruposStandings && window._renderGruposStandings(letra);
  if (card) gtable.appendChild(card);
}

window.renderGroupTableCard = renderGroupTableCard;
