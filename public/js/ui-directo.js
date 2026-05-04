// ui-directo.js — Porra Mundial 2026
// Vista "Directo": marcadores en tiempo real por jornada/día.
// Clonada de Vista Jornada (renderVistaJornada / _buildJCard).
//
// Usa: PARTIDOS, EQUIPOS, predictions, getMatchKey, SB, calcMatchPoints,
//      iaPredictions, boostPicks (todos globals de data.js/scoring.js)
// Lee: window._liveScoresByMatchKey (poblado por live-sync.js — Map de match_key → row)
// Expone: window.renderVistaDirecto, window.updateDirectoCard
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
  // window._isAdminCached: undefined/null = no comprobado, true/false = resultado
  //
  // Problema histórico: tras un refresh, ui-directo.js corre antes de que
  // auth.js haya rehidratado la sesión, así que _porraDb.auth.getUser() devuelve
  // null y el cache se quedaba cerrado como `false` para siempre. Ahora:
  //  - Si db o user no están listos, NO cacheamos; reintentamos hasta 10 veces
  //    (cada 500 ms ⇒ 5 s máx).
  //  - Al completar con valor definitivo, si cambia respecto al último render,
  //    disparamos renderVistaDirecto() para que la sección simulacros aparezca.
  // ─────────────────────────────────────────────────────────────
  let _checkInProgress = false;
  let _checkAttempts = 0;
  const _MAX_CHECK_ATTEMPTS = 10;
  let _lastRenderAdminValue; // snapshot de _isAdminCached usado en el último render

  function _triggerReRenderIfChanged() {
    if (_lastRenderAdminValue === window._isAdminCached) return;
    _lastRenderAdminValue = window._isAdminCached;
    const container = document.getElementById('directo-container');
    if (container && container.style.display !== 'none' &&
        typeof window.renderVistaDirecto === 'function') {
      console.log('[ui-directo] checkIsAdmin: cache actualizado, re-renderizando');
      window.renderVistaDirecto();
    }
  }

  function _scheduleCheckRetry(reason) {
    _checkAttempts++;
    if (_checkAttempts >= _MAX_CHECK_ATTEMPTS) {
      console.log('[ui-directo] checkIsAdmin: máximo intentos (' + _MAX_CHECK_ATTEMPTS + ') alcanzado, asumiendo no-admin');
      window._isAdminCached = false;
      _triggerReRenderIfChanged();
      return;
    }
    console.log('[ui-directo] checkIsAdmin: ' + reason + ', reintentando en 500ms (intento ' + (_checkAttempts + 1) + '/' + _MAX_CHECK_ATTEMPTS + ')');
    setTimeout(() => { checkIsAdmin(); }, 500);
  }

  async function checkIsAdmin() {
    if (window._isAdminCached === true || window._isAdminCached === false) {
      return window._isAdminCached;
    }
    if (_checkInProgress) return undefined;
    _checkInProgress = true;
    try {
      console.log('[ui-directo] checkIsAdmin: iniciando (intento ' + (_checkAttempts + 1) + '/' + _MAX_CHECK_ATTEMPTS + ')');
      const db = window._porraDb;
      if (!db) {
        _scheduleCheckRetry('_porraDb no disponible');
        return undefined;
      }
      const { data: { user } } = await db.auth.getUser();
      console.log('[ui-directo] checkIsAdmin: user =', user ? user.id : null);
      if (!user) {
        _scheduleCheckRetry('sesión aún no hidratada');
        return undefined;
      }
      const { data: profileData, error } = await db
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();
      if (error) {
        console.warn('[ui-directo] checkIsAdmin: error leyendo profile:', error);
        window._isAdminCached = false;
        _triggerReRenderIfChanged();
        return false;
      }
      console.log('[ui-directo] checkIsAdmin: is_admin =', profileData ? profileData.is_admin : null);
      window._isAdminCached = !!(profileData && profileData.is_admin);
      _triggerReRenderIfChanged();
      return window._isAdminCached;
    } catch (err) {
      console.warn('[ui-directo] checkIsAdmin: excepción:', err);
      _scheduleCheckRetry('excepción');
      return undefined;
    } finally {
      _checkInProgress = false;
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
  // F7.4-D-1: setVistaGruposExtended eliminado. El toggle entre pages
  // grupos/jornada/directo lo gobierna showPage desde el bottom-tab.
  // ─────────────────────────────────────────────────────────────

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
  // ─────────────────────────────────────────────────────────────
  // Helper: extrae el contexto live de un partido del Mundial.
  //   { directoKey, liveRow, status, isLive, isFinal, scoreH, scoreA,
  //     events, hasScore, minuteStr, matchKey, pred, hasPred }
  // ─────────────────────────────────────────────────────────────
  function _getMatchCtx(m) {
    const directoKey = getDirectoKey(m);
    const liveRow = directoKey ? (window._liveScoresByMatchKey[directoKey] || null) : null;

    let scoreH = null, scoreA = null, status = 'notstarted', events = [];
    let teamsSwapped = false;
    if (liveRow) {
      status = liveRow.status || 'notstarted';
      teamsSwapped = !!liveRow._teams_swapped;
      scoreH = liveRow.score_home;
      scoreA = liveRow.score_away;
      events = extractRelevantEvents(liveRow.events, teamsSwapped, m.home, m.away);
    }

    const hasScore = scoreH != null && scoreA != null;
    const isLive   = status === 'inprogress' || status === 'halftime' ||
                     status === 'overtime'   || status === 'penalties';
    const isFinal  = status === 'finished';

    let minuteStr = '';
    if (isLive && liveRow) {
      if (status === 'inprogress' && liveRow.minute != null) minuteStr = liveRow.minute + "'";
      else if (status === 'halftime') minuteStr = 'DESCANSO';
    }

    const matchKey = (typeof getMatchKey === 'function') ? getMatchKey(m) : null;
    const pred = matchKey ? (predictions[matchKey] || {}) : {};
    const hasPred = pred.l !== null && pred.l !== undefined &&
                    pred.v !== null && pred.v !== undefined;

    return { directoKey, liveRow, status, isLive, isFinal, scoreH, scoreA,
             events, hasScore, minuteStr, matchKey, pred, hasPred };
  }

  // ─────────────────────────────────────────────────────────────
  // Calcula puntos vivos del usuario para un partido.
  // Devuelve { pts, isExact, isBoost, finalPts } o null si no aplica.
  // ─────────────────────────────────────────────────────────────
  function _getLivePts(ctx, m) {
    if (!ctx.hasPred || !ctx.hasScore || !(ctx.isLive || ctx.isFinal)) return null;
    if (typeof calcMatchPoints !== 'function') return null;
    const predWithFlag = Object.assign({}, ctx.pred, { saved: ctx.pred.saved !== false });
    const pts = calcMatchPoints(predWithFlag, ctx.scoreH, ctx.scoreA, ctx.matchKey);
    const bpSource = (typeof boostPicks !== 'undefined') ? boostPicks : {};
    const boostKey = bpSource[m.date?.substring(0, 10)];
    const isBoost  = boostKey === ctx.matchKey;
    const isExact  = ctx.pred.l === ctx.scoreH && ctx.pred.v === ctx.scoreA;
    // calcMatchPoints ya aplica el x2 internamente cuando boost+exact.
    return { pts, isExact, isBoost, finalPts: pts };
  }

  // ─────────────────────────────────────────────────────────────
  // _buildDMini — fila compacta clickable (estado base de Directo).
  // ─────────────────────────────────────────────────────────────
  function _buildDMini(m, idx) {
    const ctx = _getMatchCtx(m);
    const hTeam = EQUIPOS.find(e => e.name === m.home);
    const aTeam = EQUIPOS.find(e => e.name === m.away);
    const hFlag = hTeam ? SB + '/flags/' + hTeam.flag + '.png' : '';
    const aFlag = aTeam ? SB + '/flags/' + aTeam.flag + '.png' : '';
    const hCode = hTeam ? hTeam.flag : (m.home || '').substring(0, 3).toUpperCase();
    const aCode = aTeam ? aTeam.flag : (m.away || '').substring(0, 3).toUpperCase();

    const lTxt = ctx.hasScore ? String(ctx.scoreH) : '—';
    const vTxt = ctx.hasScore ? String(ctx.scoreA) : '—';

    let rightHtml;
    if (ctx.isLive) {
      rightHtml = '<span class="dv2-mini-live"><span class="dv2-mini-live-dot"></span>' +
                  (ctx.minuteStr || 'EN VIVO') + '</span>';
    } else if (ctx.isFinal) {
      rightHtml = '<span class="dv2-mini-status final">FINAL</span>';
    } else {
      const hora = new Date(m.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
      rightHtml = '<span class="dv2-mini-status">⏰ ' + hora + '</span>';
    }

    const classes = 'dv2-mini' + (ctx.isLive ? ' is-live' : '') + (ctx.isFinal ? ' is-final' : '');

    return (
      '<button class="' + classes + '" type="button" id="dcard-' + idx + '" ' +
        'data-match-key="' + (ctx.directoKey || '') + '" data-match-idx="' + idx + '">' +
        '<span class="dv2-mini-team">' +
          '<span class="dv2-mini-flag">' + (hFlag ? '<img src="' + hFlag + '" loading="lazy" onerror="this.style.display=\'none\'">' : '') + '</span>' +
          '<span class="dv2-mini-code">' + hCode + '</span>' +
        '</span>' +
        '<span class="dv2-mini-score">' +
          '<span class="dv2-mini-score-num">' + lTxt + '</span>' +
          '<span class="dv2-mini-score-sep">:</span>' +
          '<span class="dv2-mini-score-num">' + vTxt + '</span>' +
        '</span>' +
        '<span class="dv2-mini-team right">' +
          '<span class="dv2-mini-code">' + aCode + '</span>' +
          '<span class="dv2-mini-flag">' + (aFlag ? '<img src="' + aFlag + '" loading="lazy" onerror="this.style.display=\'none\'">' : '') + '</span>' +
        '</span>' +
        '<span class="dv2-mini-right">' + rightHtml + '</span>' +
      '</button>'
    );
  }

  // ─────────────────────────────────────────────────────────────
  // _buildDExpanded — card grande con todos los detalles del partido.
  // ─────────────────────────────────────────────────────────────
  function _buildDExpanded(m, idx) {
    const ctx = _getMatchCtx(m);
    const hTeam = EQUIPOS.find(e => e.name === m.home);
    const aTeam = EQUIPOS.find(e => e.name === m.away);
    const hFlag = hTeam ? SB + '/flags/' + hTeam.flag + '.png' : '';
    const aFlag = aTeam ? SB + '/flags/' + aTeam.flag + '.png' : '';

    const lTxt = ctx.hasScore ? String(ctx.scoreH) : '—';
    const vTxt = ctx.hasScore ? String(ctx.scoreA) : '—';
    const stadium = m.stadium ? m.stadium.replace(' Stadium', '').replace(' Estadio', '') : '';
    const hora = new Date(m.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const dayShort = new Date(m.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

    // Header: badge de estado
    let headerHtml;
    if (ctx.isLive) {
      headerHtml = '<div class="dv2-exp-header live">' +
        '<span class="dv2-exp-live-dot"></span>' +
        '<span class="dv2-exp-live-label">EN VIVO</span>' +
        (ctx.minuteStr ? '<span class="dv2-exp-live-min">· ' + ctx.minuteStr + '</span>' : '') +
        '</div>';
    } else if (ctx.isFinal) {
      headerHtml = '<div class="dv2-exp-header final"><span class="dv2-exp-live-label">FINAL</span></div>';
    } else {
      headerHtml = '<div class="dv2-exp-header upcoming">' +
        '<span class="dv2-exp-live-label">PRÓXIMO</span>' +
        '<span class="dv2-exp-live-min">· ' + dayShort + ' · ' + hora + '</span>' +
        '</div>';
    }

    // Tiempo de juego (verde) si live
    let periodHtml = '';
    if (ctx.isLive && ctx.minuteStr) {
      const period = ctx.status === 'halftime' ? 'DESCANSO'
                   : (ctx.liveRow && ctx.liveRow.minute != null && ctx.liveRow.minute > 45 ? '2T · ' + ctx.minuteStr : '1T · ' + ctx.minuteStr);
      periodHtml = '<div class="dv2-exp-period">' + period + '</div>';
    }

    // Goleadores: dos columnas (local | visitante).
    let scorersHtml = '';
    if (ctx.events && ctx.events.length > 0) {
      const homeEv = ctx.events.filter(e => e.team === m.home);
      const awayEv = ctx.events.filter(e => e.team === m.away);
      const renderEv = (ev) => {
        const extra = ev.extra ? ' <span class="dv2-exp-ev-extra">(' + ev.extra + ')</span>' : '';
        return '<div class="dv2-exp-ev ' + ev.kind + '">' +
          '<span class="dv2-exp-ev-icon">' + ev.icon + '</span>' +
          '<span class="dv2-exp-ev-min">' + ev.minute + "'</span>" +
          '<span class="dv2-exp-ev-player">' + ev.player + '</span>' +
          extra +
        '</div>';
      };
      scorersHtml =
        '<div class="dv2-exp-scorers">' +
          '<div class="dv2-exp-scorers-title">Goleadores</div>' +
          '<div class="dv2-exp-scorers-cols">' +
            '<div class="dv2-exp-scorers-col">' + (homeEv.length ? homeEv.map(renderEv).join('') : '<div class="dv2-exp-ev-empty">—</div>') + '</div>' +
            '<div class="dv2-exp-scorers-col right">' + (awayEv.length ? awayEv.map(renderEv).join('') : '<div class="dv2-exp-ev-empty">—</div>') + '</div>' +
          '</div>' +
        '</div>';
    }

    // Tu predicción
    let predHtml = '';
    if (ctx.matchKey) {
      const pred = ctx.pred;
      const predScoreTxt = ctx.hasPred ? (pred.l + ':' + pred.v) : '—:—';
      const golLabel = pred.gol ? '⚽ ' + pred.gol : '—';

      // Estado: VAS GANANDO / 0 PTS / pre-match (sin estado)
      let predStatusHtml = '';
      const live = _getLivePts(ctx, m);
      if (live && (ctx.isLive || ctx.isFinal)) {
        const cls = live.finalPts > 0 ? 'win' : 'zero';
        const verb = ctx.isFinal ? (live.finalPts > 0 ? 'GANASTE' : 'SIN PUNTOS')
                                 : (live.finalPts > 0 ? 'VAS GANANDO' : '0 PTS POR AHORA');
        const ptsTxt = live.finalPts > 0 ? '+' + live.finalPts + ' pts' + (live.isBoost && live.isExact ? ' ×2' : '') : '';
        predStatusHtml = '<div class="dv2-exp-pred-status ' + cls + '">' + verb + (ptsTxt ? ' ' + ptsTxt : '') + '</div>';
      }

      predHtml =
        '<div class="dv2-exp-pred">' +
          '<div class="dv2-exp-pred-title">Tu predicción</div>' +
          '<div class="dv2-exp-pred-row">' +
            '<span class="dv2-exp-pred-score">' + predScoreTxt + '</span>' +
            '<span class="dv2-exp-pred-gol">' + golLabel + '</span>' +
          '</div>' +
          predStatusHtml +
        '</div>';
    }

    return (
      '<div class="dv2-exp" id="dcard-' + idx + '" data-match-key="' + (ctx.directoKey || '') + '" data-match-idx="' + idx + '">' +
        headerHtml +
        '<div class="dv2-exp-meta">Grupo ' + m.group + ' · 🏟️ ' + stadium + '</div>' +
        '<div class="dv2-exp-mid">' +
          '<div class="dv2-exp-team">' +
            '<div class="dv2-exp-flag">' + (hFlag ? '<img src="' + hFlag + '" loading="lazy" onerror="this.style.display=\'none\'">' : '') + '</div>' +
            '<div class="dv2-exp-team-name">' + m.home + '</div>' +
          '</div>' +
          '<div class="dv2-exp-score">' +
            '<span class="dv2-exp-score-num">' + lTxt + '</span>' +
            '<span class="dv2-exp-score-sep">:</span>' +
            '<span class="dv2-exp-score-num">' + vTxt + '</span>' +
          '</div>' +
          '<div class="dv2-exp-team">' +
            '<div class="dv2-exp-flag">' + (aFlag ? '<img src="' + aFlag + '" loading="lazy" onerror="this.style.display=\'none\'">' : '') + '</div>' +
            '<div class="dv2-exp-team-name">' + m.away + '</div>' +
          '</div>' +
        '</div>' +
        periodHtml +
        scorersHtml +
        predHtml +
        '<button class="dv2-exp-collapse" type="button" data-collapse="1" aria-label="Contraer tarjeta">▲ Contraer</button>' +
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
        '<div class="dcard-simulacro-banner">🧪 SIMULACRO · PARTIDO FUERA DEL MUNDIAL</div>' +
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
  // Estado local: matchKey de la card expandida (null = ninguna).
  // Solo UNA expandida a la vez. Click en mini-row alterna.
  // ─────────────────────────────────────────────────────────────
  let _expandedKey = null;

  // ─────────────────────────────────────────────────────────────
  // Render completo de la vista Directo
  // ─────────────────────────────────────────────────────────────
  function renderVistaDirecto() {
    const container = document.getElementById('directo-container');
    if (!container) return;

    // Comprobación admin asíncrona — NO bloquea el render del Mundial.
    // Si aún no está cacheada (undefined/null), se dispara fire-and-forget.
    // La propia checkIsAdmin llamará a renderVistaDirecto() cuando cambie el valor.
    if (window._isAdminCached !== true && window._isAdminCached !== false) {
      checkIsAdmin();
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

    // Resolver expanded match (validar que existe en PARTIDOS y aún tiene matchKey)
    let expandedEntry = null;
    if (_expandedKey) {
      for (let i = 0; i < PARTIDOS.length; i++) {
        if (getDirectoKey(PARTIDOS[i]) === _expandedKey) {
          expandedEntry = { m: PARTIDOS[i], idx: i };
          break;
        }
      }
      if (!expandedEntry) _expandedKey = null;
    }

    // Recolectar partidos en vivo (excluyendo el expandido).
    const otherLive = [];
    PARTIDOS.forEach((m, idx) => {
      const dk = getDirectoKey(m);
      if (!dk || dk === _expandedKey) return;
      const row = window._liveScoresByMatchKey[dk];
      if (row && (row.status === 'inprogress' || row.status === 'halftime' ||
                  row.status === 'overtime'   || row.status === 'penalties')) {
        otherLive.push({ m, idx });
      }
    });
    const otherLiveKeys = new Set(otherLive.map(x => getDirectoKey(x.m)));

    // Reusa la función de ranking de jornada si existe
    const sidebarHtml = (typeof window._buildJornadaRanking === 'function')
      ? window._buildJornadaRanking()
      : '';

    // ── Bloque expanded + "Otros partidos en vivo" (si aplica) ──
    let topHtml = '';
    if (expandedEntry) {
      topHtml += '<div class="dv2-expanded-wrap">' + _buildDExpanded(expandedEntry.m, expandedEntry.idx) + '</div>';
      if (otherLive.length > 0) {
        topHtml += '<div class="dv2-section-label">Otros partidos en vivo</div>';
        topHtml += '<div class="dv2-mini-list">';
        otherLive.forEach(({ m, idx }) => { topHtml += _buildDMini(m, idx); });
        topHtml += '</div>';
      }
    }

    // ── Listado por día con mini-rows ──
    // Excluir: el expandido y los inprogress que ya están en "Otros en vivo".
    let sectionsHtml = '';
    dias.forEach((date, dIdx) => {
      const jNum = dIdx + 1;
      const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long'
      });

      const matchesOfDay = jornadasMap[date].filter(({ m }) => {
        const dk = getDirectoKey(m);
        if (dk === _expandedKey) return false;
        if (otherLiveKeys.has(dk)) return false;
        return true;
      });
      if (matchesOfDay.length === 0) return;

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
      sectionsHtml += '<div class="dv2-mini-list">';
      matchesOfDay.forEach(({ m, idx }) => { sectionsHtml += _buildDMini(m, idx); });
      sectionsHtml += '</div>';
      sectionsHtml += '</div>';
    });

    // Sección simulacros (solo admin, solo si hay alguno)
    const simsHtml = (window._isAdminCached === true) ? _buildSimulacrosSectionHtml() : '';

    const mainHtml = simsHtml + topHtml + sectionsHtml;

    if (sidebarHtml) {
      container.innerHTML =
        '<div class="directo-wrap">' +
          '<div class="directo-main">' + mainHtml + '</div>' +
          '<div class="directo-sidebar">' + sidebarHtml + '</div>' +
        '</div>';
    } else {
      container.innerHTML = '<div class="directo-main">' + mainHtml + '</div>';
    }

    // Wire click handler delegado (asignación directa para no acumular listeners
    // en sucesivos render — sustituye el handler anterior si existía).
    container.onclick = _onDirectoClick;
  }
  window.renderVistaDirecto = renderVistaDirecto;

  // Click delegado: alterna expandido al pulsar mini-row;
  // pulsar Contraer (botón en la expanded) la cierra.
  function _onDirectoClick(e) {
    const collapseBtn = e.target.closest('[data-collapse]');
    if (collapseBtn) {
      _expandedKey = null;
      renderVistaDirecto();
      return;
    }
    const mini = e.target.closest('.dv2-mini');
    if (!mini) return;
    const key = mini.getAttribute('data-match-key');
    if (!key) return;
    _expandedKey = (_expandedKey === key) ? null : key;
    renderVistaDirecto();
  }

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

    // Buscar la tarjeta existente por data-match-key. Puede ser un mini o el
    // expanded; el atributo está presente en ambos.
    const existing = container.querySelector('[data-match-key="' + matchKey + '"]');
    if (!existing) return;

    const idx = parseInt(existing.getAttribute('data-match-idx') ||
                         (existing.id ? existing.id.replace('dcard-', '') : ''), 10);
    if (isNaN(idx)) return;
    const m = PARTIDOS[idx];
    if (!m) return;

    // Si un partido pasa a inprogress y no tenemos nada expandido, podríamos
    // re-render para que aparezca en "Otros en vivo" — por simplicidad solo
    // hacemos repintado in-place del nodo. Cambios estructurales (e.g. de
    // notstarted → inprogress fuera del expandido) se reflejan en el siguiente
    // renderVistaDirecto natural.
    const isExpanded = existing.classList && existing.classList.contains('dv2-exp');
    const html = isExpanded ? _buildDExpanded(m, idx) : _buildDMini(m, idx);
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const newCard = tmp.firstElementChild;
    if (newCard) existing.replaceWith(newCard);
  }
  window.updateDirectoCard = updateDirectoCard;

})();
