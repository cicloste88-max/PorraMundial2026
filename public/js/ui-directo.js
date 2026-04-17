// ui-directo.js — Porra Mundial 2026
// Vista "Directo": marcadores en tiempo real por jornada/día.
// Clonada de Vista Jornada (renderVistaJornada / _buildJCard).
//
// Usa: PARTIDOS, EQUIPOS, predictions, getMatchKey, SB, calcMatchPoints,
//      iaPredictions, boostPicks (todos globals de data.js/scoring.js)
// Lee: window._liveScoresByMatchKey (poblado por live-sync.js — Map de match_key → row)
// Expone: window.renderVistaDirecto, window.updateDirectoCard, window.setVistaGrupos (override)
//
// El flujo de realtime vive en live-sync.js. Este módulo solo renderiza
// y expone updateDirectoCard(matchKey, liveRow) para que live-sync lo llame
// en cada cambio sin recrear toda la vista.

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // Estado
  // ─────────────────────────────────────────────────────────────
  // liveByMatchKey: cache local de live_scores indexado por match_key (del Mundial)
  // lo puebla live-sync.js al cargar
  window._liveScoresByMatchKey = window._liveScoresByMatchKey || {};

  // ─────────────────────────────────────────────────────────────
  // Admin flag (cache) — para mostrar la sección "Simulacros"
  // window._isAdminCached: undefined=no comprobado, true/false=resultado
  // ─────────────────────────────────────────────────────────────
  async function checkIsAdmin() {
    if (window._isAdminCached !== undefined) return window._isAdminCached;
    const db = window._porraDb;
    if (!db) return false;
    try {
      const { data: { user } } = await db.auth.getUser();
      if (!user) { window._isAdminCached = false; return false; }
      const { data, error } = await db
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();
      if (error) {
        console.warn('[ui-directo] No se pudo leer profile.is_admin:', error);
        window._isAdminCached = false;
        return false;
      }
      window._isAdminCached = !!(data && data.is_admin);
      return window._isAdminCached;
    } catch (err) {
      console.warn('[ui-directo] Excepción checkIsAdmin:', err);
      window._isAdminCached = false;
      return false;
    }
  }

  // match_key suele ser alfanumérico + underscores, pero sanitizamos por seguridad
  function sanitizeMatchKey(k) {
    return String(k || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  // Hora local (Europe/Madrid) + día/mes desde match_start_ts (BIGINT en BD).
  // Acepta segundos (10 dígitos) o milisegundos (13) — detecta por magnitud.
  function formatStartCEST(ts) {
    if (ts == null) return '';
    const num = Number(ts);
    if (!Number.isFinite(num) || num <= 0) return '';
    const ms = num > 1e12 ? num : num * 1000;
    const d = new Date(ms);
    try {
      return new Intl.DateTimeFormat('es-ES', {
        timeZone: 'Europe/Madrid',
        day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit'
      }).format(d);
    } catch {
      return d.toLocaleString('es-ES');
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Override de setVistaGrupos para soportar 'directo' como 3er estado
  // ─────────────────────────────────────────────────────────────
  const _originalSetVistaGrupos = window.setVistaGrupos;

  function setVistaGruposExtended(vista) {
    const gruposContainer  = document.getElementById('groups-container');
    const jornadaContainer = document.getElementById('jornada-container');
    const directoContainer = document.getElementById('directo-container');
    const btnGrupos  = document.getElementById('btn-vista-grupos');
    const btnJornada = document.getElementById('btn-vista-jornada');
    const btnDirecto = document.getElementById('btn-vista-directo');

    // Ocultar todos, luego mostrar el elegido
    if (gruposContainer)  gruposContainer.style.display  = 'none';
    if (jornadaContainer) jornadaContainer.style.display = 'none';
    if (directoContainer) directoContainer.style.display = 'none';

    const resetBtn = (btn) => {
      if (!btn) return;
      btn.style.background = 'transparent';
      btn.style.color = '#6b7280';
    };
    const activateBtn = (btn) => {
      if (!btn) return;
      btn.style.background = '#27272a';
      btn.style.color = '#fff';
    };
    resetBtn(btnGrupos);
    resetBtn(btnJornada);
    resetBtn(btnDirecto);

    if (vista === 'grupos') {
      if (gruposContainer) gruposContainer.style.display = 'block';
      activateBtn(btnGrupos);
    } else if (vista === 'jornada') {
      if (jornadaContainer) jornadaContainer.style.display = 'block';
      activateBtn(btnJornada);
      if (typeof window.renderVistaJornada === 'function') window.renderVistaJornada();
    } else if (vista === 'directo') {
      if (directoContainer) directoContainer.style.display = 'block';
      activateBtn(btnDirecto);
      renderVistaDirecto();
    }
  }
  window.setVistaGrupos = setVistaGruposExtended;

  // ─────────────────────────────────────────────────────────────
  // Traducción status → etiqueta y clase
  // ─────────────────────────────────────────────────────────────
  function statusLabel(status) {
    switch (status) {
      case 'inprogress':  return { txt: 'EN VIVO',    cls: 'live' };
      case 'halftime':    return { txt: 'DESCANSO',   cls: 'halftime' };
      case 'overtime':    return { txt: 'PRÓRROGA',   cls: 'overtime' };
      case 'penalties':   return { txt: 'PENALTIS',   cls: 'penalties' };
      case 'finished':    return { txt: 'FINAL',      cls: 'final' };
      case 'notstarted':  return { txt: 'PRÓXIMO',    cls: 'notstarted' };
      default:            return { txt: (status || '').toUpperCase(), cls: 'notstarted' };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Filtrar eventos de SofaScore → solo goles y rojas
  // ─────────────────────────────────────────────────────────────
  function extractRelevantEvents(rawEvents, teamsSwapped, homeTeamName, awayTeamName) {
    if (!Array.isArray(rawEvents)) return [];
    const out = [];
    for (const e of rawEvents) {
      if (!e) continue;

      const isGoal =
        e.incidentType === 'goal' ||
        (e.incidentType === 'inGamePenalty'    && e.incidentClass === 'scored') ||
        (e.incidentType === 'penaltyShootout'  && e.incidentClass === 'scored');

      const isRedCard =
        e.incidentType === 'card' &&
        (e.incidentClass === 'red' || e.incidentClass === 'yellowRed');

      if (!isGoal && !isRedCard) continue;

      // Determinar a qué equipo pertenece (desde perspectiva de data.js)
      // Si teams_swapped, invertir home/away
      let isForHome = !!e.isHome;
      if (teamsSwapped) isForHome = !isForHome;
      const team = isForHome ? homeTeamName : awayTeamName;

      const player = e?.player?.name || e?.playerName || 'Desconocido';
      const minute = e.time ?? e.incidentTime ?? '?';

      if (isGoal) {
        const isOwnGoal  = e.incidentClass === 'ownGoal';
        const isPenalty  = e.incidentType === 'inGamePenalty';
        const isShootout = e.incidentType === 'penaltyShootout';
        let extra = '';
        if (isOwnGoal)  extra = 'p.p.';
        else if (isPenalty)  extra = 'pen.';
        else if (isShootout) extra = 'tanda pen.';
        out.push({
          kind: isOwnGoal ? 'own-goal' : 'goal',
          icon: '⚽',
          minute,
          player,
          team,
          extra
        });
      } else if (isRedCard) {
        out.push({
          kind: 'red-card',
          icon: '🟥',
          minute,
          player,
          team,
          extra: e.incidentClass === 'yellowRed' ? 'doble amarilla' : ''
        });
      }
    }
    // Ordenar por minuto
    out.sort((a, b) => {
      const ma = typeof a.minute === 'number' ? a.minute : 999;
      const mb = typeof b.minute === 'number' ? b.minute : 999;
      return ma - mb;
    });
    return out;
  }

  // ─────────────────────────────────────────────────────────────
  // Resolver el match_key desde un partido de PARTIDOS
  // Delega en window.matchKeyFor (expuesto por live-sync.js)
  // ─────────────────────────────────────────────────────────────
  function getDirectoKey(m) {
    if (typeof window.matchKeyFor === 'function') return window.matchKeyFor(m);
    return null;
  }

  // ─────────────────────────────────────────────────────────────
  // Construir una tarjeta Directo
  // ─────────────────────────────────────────────────────────────
  function _buildDCard(m, idx) {
    const directoKey = getDirectoKey(m);
    const liveRow = directoKey ? (window._liveScoresByMatchKey[directoKey] || null) : null;

    // Datos de equipos y flags (desde data.js)
    const hTeam = EQUIPOS.find(e => e.name === m.home);
    const aTeam = EQUIPOS.find(e => e.name === m.away);
    const hFlag = hTeam ? SB + '/flags/' + hTeam.flag + '.png' : '';
    const aFlag = aTeam ? SB + '/flags/' + aTeam.flag + '.png' : '';

    // Color lateral por grupo
    const gc = {A:'#4ade80',B:'#60a5fa',C:'#f472b6',D:'#fb923c',E:'#a78bfa',
      F:'#34d399',G:'#fbbf24',H:'#f87171',I:'#38bdf8',J:'#c084fc',K:'#86efac',L:'#fcd34d'}[m.group] || '#4ade80';

    // Determinar marcador y estado
    let scoreH = null, scoreA = null, status = 'notstarted', events = [];
    let teamsSwapped = false;
    if (liveRow) {
      status = liveRow.status || 'notstarted';
      // live-sync.js nos da el row con los scores YA desde la perspectiva de data.js
      // (ya ha aplicado teams_swapped antes de cachear). Pero guardamos teams_swapped
      // para traducir events.
      teamsSwapped = !!liveRow._teams_swapped;
      scoreH = liveRow.score_home;
      scoreA = liveRow.score_away;
      events = extractRelevantEvents(liveRow.events, teamsSwapped, m.home, m.away);
    }

    const hasScore  = scoreH != null && scoreA != null;
    const isLive    = status === 'inprogress' || status === 'halftime' ||
                      status === 'overtime'   || status === 'penalties';
    const isFinal   = status === 'finished';

    // Labels de marcador
    const lTxt = hasScore ? String(scoreH) : '—';
    const vTxt = hasScore ? String(scoreA) : '—';
    const scoreCls = hasScore ? 'dcard-score' : 'dcard-score pending';

    // Estado pill
    const { txt: statusTxt, cls: statusCls } = statusLabel(status);
    let minuteStr = '';
    if (isLive && liveRow) {
      if (status === 'inprogress' && liveRow.minute != null) {
        minuteStr = liveRow.minute + "'";
      }
    }

    // Pronóstico + puntos vivos
    const matchKey = typeof getMatchKey === 'function' ? getMatchKey(m) : null;
    const pred = matchKey ? (predictions[matchKey] || {}) : {};
    const hasPred = pred.l !== null && pred.l !== undefined &&
                    pred.v !== null && pred.v !== undefined;

    let predScoreHtml = '<span class="dcard-pred-score pending">—:—</span>';
    if (hasPred) {
      predScoreHtml = '<span class="dcard-pred-score">' + pred.l + ':' + pred.v + '</span>';
    }

    // Puntos vivos (solo si hay pronóstico y marcador)
    let ptsHtml = '';
    if (hasPred && hasScore && (isLive || isFinal) && typeof calcMatchPoints === 'function') {
      const predWithFlag = Object.assign({}, pred, { saved: pred.saved !== false });
      const pts = calcMatchPoints(predWithFlag, scoreH, scoreA, matchKey);
      // boostPicks es const global de data.js
      const bpSource = (typeof boostPicks !== 'undefined') ? boostPicks : {};
      const boostKey = bpSource[m.date?.substring(0, 10)];
      const isBoost = boostKey === matchKey;
      const isExact = pred.l === scoreH && pred.v === scoreA;
      const finalPts = isBoost && isExact ? pts * 2 : pts;
      const ptsCls = finalPts === 0 ? 'dcard-pts-live zero' :
                     (isBoost && isExact ? 'dcard-pts-live won boost' : 'dcard-pts-live won');
      ptsHtml = '<div class="' + ptsCls + '">' +
                (finalPts >= 0 ? '+' : '') + finalPts + ' pt' + (finalPts === 1 ? '' : 's') +
                '</div>';
    }

    // Hora de inicio + estadio
    const hora = new Date(m.date).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'});
    const stadium = m.stadium ? m.stadium.replace(' Stadium','').replace(' Estadio','') : '';

    // Eventos HTML
    let eventsHtml = '';
    if (events.length > 0) {
      eventsHtml = '<div class="dcard-events">';
      for (const ev of events) {
        const extraHtml = ev.extra ? '<span class="evt-extra">(' + ev.extra + ')</span>' : '';
        eventsHtml += '<div class="dcard-event ' + ev.kind + '">' +
          '<span class="evt-icon">' + ev.icon + '</span>' +
          "<span class=\"evt-min\">" + ev.minute + "'</span>" +
          '<span class="evt-player">' + ev.player + '</span>' +
          extraHtml +
          '<span style="font-size:10px;color:#4b5563">· ' + ev.team + '</span>' +
        '</div>';
      }
      eventsHtml += '</div>';
    }

    const classes = 'dcard' + (isLive ? ' is-live' : '') + (isFinal ? ' is-final' : '');

    return (
      '<div class="' + classes + '" id="dcard-' + idx + '" data-match-key="' + (directoKey || '') + '">' +
        '<div class="dcard-main">' +
          '<div class="dcard-stripe" style="background:' + gc + '"></div>' +
          '<div class="dcard-body">' +
            '<div class="dcard-teams-row">' +
              '<div class="dcard-team">' +
                '<div class="dcard-flag"><img src="' + hFlag + '" loading="lazy"></div>' +
                '<span class="dcard-team-name">' + m.home + '</span>' +
              '</div>' +
              '<div class="dcard-score-wrap">' +
                '<span class="' + scoreCls + '">' + lTxt + '</span>' +
                '<span class="dcard-score-sep">:</span>' +
                '<span class="' + scoreCls + '">' + vTxt + '</span>' +
              '</div>' +
              '<div class="dcard-team" style="justify-content:flex-end">' +
                '<span class="dcard-team-name" style="text-align:right">' + m.away + '</span>' +
                '<div class="dcard-flag"><img src="' + aFlag + '" loading="lazy"></div>' +
              '</div>' +
            '</div>' +
            '<div class="dcard-status">' +
              '<span class="dcard-status-pill ' + statusCls + '">' + statusTxt + '</span>' +
              (minuteStr ? '<span>' + minuteStr + '</span>' : '') +
              (status === 'notstarted' ? '<span>⏰ ' + hora + '</span>' : '') +
              '<span class="sep">·</span>' +
              '<span>🏟️ ' + stadium + '</span>' +
              '<span class="sep">·</span>' +
              '<span style="color:#4b5563">Grupo ' + m.group + '</span>' +
            '</div>' +
            eventsHtml +
          '</div>' +
          '<div class="dcard-pred">' +
            '<div class="dcard-pred-label">Tu pronóstico</div>' +
            predScoreHtml +
            ptsHtml +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Construir tarjeta de SIMULACRO (partido fuera del Mundial, is_historic=true)
  // Lee directamente campos de live_scores: home_team_name, away_team_name,
  // competition, venue, match_start_ts, status, score_home, score_away, events.
  // ─────────────────────────────────────────────────────────────
  function _buildSimulacroCard(row) {
    const mk = row.match_key;
    const id = 'simulacro-card-' + sanitizeMatchKey(mk);
    const home = row.home_team_name || '?';
    const away = row.away_team_name || '?';
    const comp = row.competition || '';
    const venue = row.venue || '';
    const startStr = formatStartCEST(row.match_start_ts);

    const status = row.status || 'notstarted';
    const hasScore = row.score_home != null && row.score_away != null;
    const isLive   = status === 'inprogress' || status === 'halftime' ||
                     status === 'overtime'   || status === 'penalties';
    const isFinal  = status === 'finished';

    const lTxt = hasScore ? String(row.score_home) : '—';
    const vTxt = hasScore ? String(row.score_away) : '—';
    const scoreCls = hasScore ? 'dcard-score' : 'dcard-score pending';
    const { txt: statusTxt, cls: statusCls } = statusLabel(status);

    // Eventos (no hay teams_swapped en simulacros: isHome viene directo de la fuente)
    const events = extractRelevantEvents(row.events, false, home, away);
    let eventsHtml = '';
    if (events.length > 0) {
      eventsHtml = '<div class="dcard-events">';
      for (const ev of events) {
        const extraHtml = ev.extra ? '<span class="evt-extra">(' + ev.extra + ')</span>' : '';
        eventsHtml += '<div class="dcard-event ' + ev.kind + '">' +
          '<span class="evt-icon">' + ev.icon + '</span>' +
          "<span class=\"evt-min\">" + ev.minute + "'</span>" +
          '<span class="evt-player">' + ev.player + '</span>' +
          extraHtml +
          '<span style="font-size:10px;color:#4b5563">· ' + ev.team + '</span>' +
        '</div>';
      }
      eventsHtml += '</div>';
    }

    // Pie: competición · estadio · hora CEST
    const footerParts = [];
    if (comp) footerParts.push(comp);
    if (venue) footerParts.push('🏟️ ' + venue);
    if (startStr && !isLive && !isFinal) footerParts.push('⏰ ' + startStr);
    const footerHtml = footerParts.length
      ? '<div class="dcard-status">' +
          '<span class="dcard-status-pill ' + statusCls + '">' + statusTxt + '</span>' +
          footerParts.map((p, i) =>
            (i === 0 ? '' : '<span class="sep">·</span>') +
            '<span>' + p + '</span>'
          ).join('') +
        '</div>'
      : '';

    const classes = 'dcard dcard-simulacro' + (isLive ? ' is-live' : '') + (isFinal ? ' is-final' : '');

    return (
      '<div class="' + classes + '" id="' + id + '" data-sim-key="' + mk + '">' +
        '<span class="dcard-simulacro-badge">🧪 SIMULACRO</span>' +
        '<div class="dcard-main">' +
          '<div class="dcard-stripe" style="background:#facc15"></div>' +
          '<div class="dcard-body">' +
            '<div class="dcard-teams-row">' +
              '<div class="dcard-team">' +
                '<span class="dcard-team-name">' + home + '</span>' +
              '</div>' +
              '<div class="dcard-score-wrap">' +
                '<span class="' + scoreCls + '">' + lTxt + '</span>' +
                '<span class="dcard-score-sep">:</span>' +
                '<span class="' + scoreCls + '">' + vTxt + '</span>' +
              '</div>' +
              '<div class="dcard-team" style="justify-content:flex-end">' +
                '<span class="dcard-team-name" style="text-align:right">' + away + '</span>' +
              '</div>' +
            '</div>' +
            footerHtml +
            eventsHtml +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function _buildSimulacrosSectionHtml() {
    const sims = (typeof window.getSimulacros === 'function') ? window.getSimulacros() : [];
    if (!sims || sims.length === 0) return '';
    const cards = sims.map(_buildSimulacroCard).join('');
    return (
      '<div class="directo-simulacros-section">' +
        '<div class="directo-simulacros-header">🧪 Simulacros activos <span style="opacity:.7">(solo admin)</span></div>' +
        cards +
      '</div>'
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Render completo de la vista Directo
  // ─────────────────────────────────────────────────────────────
  function renderVistaDirecto() {
    const container = document.getElementById('directo-container');
    if (!container) return;

    // Disparar comprobación admin si aún no está cacheada; re-render cuando llegue.
    if (window._isAdminCached === undefined) {
      checkIsAdmin().then((v) => {
        // Re-render solo si hay algo que mostrar y la vista sigue visible
        if (container.style.display !== 'none') renderVistaDirecto();
      });
    }

    // PARTIDOS es const global de data.js, accesible por scope léxico
    // (NO via window.* porque const/let top-level no se adjuntan a window)
    if (typeof PARTIDOS === 'undefined' || !Array.isArray(PARTIDOS) || PARTIDOS.length === 0) {
      container.innerHTML = '<div class="directo-empty">Cargando partidos…</div>';
      return;
    }

    // Agrupar por fecha (misma lógica que Jornada)
    const jornadasMap = {};
    PARTIDOS.forEach((m, idx) => {
      const date = m.date?.substring(0, 10);
      if (!date) return;
      if (!jornadasMap[date]) jornadasMap[date] = [];
      jornadasMap[date].push({ m, idx });
    });
    const dias = Object.keys(jornadasMap).sort();

    // Reusa la función de ranking de jornada si existe
    const sidebarHtml = (typeof window._buildJornadaRanking === 'function')
      ? window._buildJornadaRanking()
      : '';

    let sectionsHtml = '';
    dias.forEach((date, dIdx) => {
      const jNum = dIdx + 1;
      const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long'
      });

      // Contar cuántos partidos están EN VIVO hoy
      let liveCount = 0;
      jornadasMap[date].forEach(({ m }) => {
        const dk = getDirectoKey(m);
        const row = dk ? window._liveScoresByMatchKey[dk] : null;
        if (row && (row.status === 'inprogress' || row.status === 'halftime' ||
                    row.status === 'overtime'   || row.status === 'penalties')) liveCount++;
      });
      const liveBadge = liveCount > 0
        ? '<span class="directo-live-count">🔴 ' + liveCount + ' EN VIVO</span>'
        : '';

      sectionsHtml += '<div class="directo-section" id="directo-' + date + '">';
      sectionsHtml += '<div class="directo-header">';
      sectionsHtml += '<span class="directo-label">J' + jNum + '</span>';
      sectionsHtml += '<span class="directo-date">' + dayLabel + '</span>';
      sectionsHtml += liveBadge;
      sectionsHtml += '</div>';

      jornadasMap[date].forEach(({ m, idx }) => {
        sectionsHtml += _buildDCard(m, idx);
      });

      sectionsHtml += '</div>';
    });

    // Sección simulacros (solo admin, solo si hay alguno)
    const simsHtml = (window._isAdminCached === true) ? _buildSimulacrosSectionHtml() : '';

    if (sidebarHtml) {
      container.innerHTML =
        '<div class="directo-wrap">' +
          '<div class="directo-main">' + simsHtml + sectionsHtml + '</div>' +
          '<div class="directo-sidebar">' + sidebarHtml + '</div>' +
        '</div>';
    } else {
      container.innerHTML = '<div class="directo-main">' + simsHtml + sectionsHtml + '</div>';
    }
  }
  window.renderVistaDirecto = renderVistaDirecto;

  // ─────────────────────────────────────────────────────────────
  // Actualizar una tarjeta de SIMULACRO (llamado por live-sync.js)
  // ─────────────────────────────────────────────────────────────
  function updateSimulacroCard(matchKey) {
    const container = document.getElementById('directo-container');
    if (!container || container.style.display === 'none') return;
    if (window._isAdminCached !== true) return; // no admin: no hay sección

    const id = 'simulacro-card-' + sanitizeMatchKey(matchKey);
    const existing = document.getElementById(id);
    const row = (window._simulacrosByKey || {})[matchKey];

    // Si la fila deja de ser simulacro o desaparece, no tocamos (solo repintado)
    if (!row) return;

    if (!existing) {
      // Primera aparición: re-render completo para insertar la sección si faltaba
      renderVistaDirecto();
      return;
    }

    const tmp = document.createElement('div');
    tmp.innerHTML = _buildSimulacroCard(row);
    const newCard = tmp.firstElementChild;
    if (newCard) existing.replaceWith(newCard);
  }
  window.updateSimulacroCard = updateSimulacroCard;

  // ─────────────────────────────────────────────────────────────
  // Actualizar una tarjeta individual (llamado por live-sync.js)
  // ─────────────────────────────────────────────────────────────
  function updateDirectoCard(matchKey) {
    // Solo repinta si la vista Directo está visible (optimización)
    const container = document.getElementById('directo-container');
    if (!container || container.style.display === 'none') return;

    // Buscar la tarjeta existente por data-match-key
    const existing = container.querySelector('[data-match-key="' + matchKey + '"]');
    if (!existing) return;

    const idx = parseInt(existing.id.replace('dcard-', ''), 10);
    if (isNaN(idx)) return;
    const m = PARTIDOS[idx];
    if (!m) return;

    // Reemplazar con versión actualizada
    const tmp = document.createElement('div');
    tmp.innerHTML = _buildDCard(m, idx);
    const newCard = tmp.firstElementChild;
    if (newCard) existing.replaceWith(newCard);
  }
  window.updateDirectoCard = updateDirectoCard;

})();
