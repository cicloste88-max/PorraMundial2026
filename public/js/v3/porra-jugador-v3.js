/* ============================================================
 * porra-jugador-v3.js  ·  Screen 2 — "Porra de un jugador"
 * ------------------------------------------------------------
 * Todos los pronósticos de grupos de un jugador (consultable por
 * cualquier miembro tras el cierre del TARGET). Selector J1/J2/J3
 * (matchday, modelo V3_MATCH_DAY de grupos-v3.js).
 *
 * Expone openPorraJugador(userId, hints) / closePorraJugador() /
 * porraJugadorSetJornada(id). Entrada: fila del ranking del predictor
 * (delegación document; lee data-pl-user/name/rank/total).
 *
 * F5 — datos REALES vía Edge Function get-user-predictions
 * (PCShared.invokeEF, cliente JWT). league_id OBLIGATORIO (liga activa).
 *   - gated:true (porra del TARGET abierta) → empty-state.
 *   - gated:false → predictions[] crudas overlaid sobre los fixtures de
 *     grupos (PARTIDOS), + chip boost si el match_id está en boost_picks[].
 * Chips: motor real v3CalcMatchPointsGrupos → {types}; el total se
 * reconstruye del breakdown para aplicar el boost ×2 del TARGET (no el
 * boostPicks global del viewer que leería calcMatchPoints). Resultados
 * reales desde live_scores / PARTIDOS. Header (nombre) desde profiles.
 * ============================================================ */
(function () {
  'use strict';

  var WRAP_ID = 'page-porra-jugador';
  var PAGE_PREDICTOR_ID = 'page-predictor';
  var HIDE_IDS = ['page-jornada','page-directo','page-grupos','page-elim','page-score','page-admin','page-predictor','page-welcome'];
  var STATE_LABEL = { done: 'Cerrada', live: 'En juego', upcoming: 'Próximamente' };

  var returnTo = PAGE_PREDICTOR_ID;
  var _currentUid = null;
  var _state = { userId: null, payload: null, active: 'j1' };

  function _partidos() { return (typeof PARTIDOS !== 'undefined') ? PARTIDOS : (window.PARTIDOS || []); }
  function _equipos() { return (typeof EQUIPOS !== 'undefined') ? EQUIPOS : (window.EQUIPOS || []); }
  function _live() { return window._liveScoresByMatchKey || {}; }
  var PCS = function () { return window.PCShared || {}; };
  var esc = function (s) { return PCS().esc ? PCS().esc(s) : String(s == null ? '' : s); };
  var flagImg = function (name, cls) { return PCS().flagImg ? PCS().flagImg(name, cls) : ''; };
  var codeFor = function (name) { return PCS().codeFor ? PCS().codeFor(name) : String(name || '').slice(0, 3).toUpperCase(); };
  function _mk(m) { return (typeof getMatchKey === 'function') ? getMatchKey(m) : (m.group + '_' + m.home + '_' + m.away); }

  var CHEVRON = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 12 L5 8 L10 4"/></svg>';
  var SEP = '<span class="pcb-sep">–</span>';

  function _cleanName(s) { return String(s || '').replace(/^\s*\d+\s*·\s*/, '').trim(); }
  function _initials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]) : parts[0].slice(0, 1)).toUpperCase();
  }
  function _scorerName(key, matchObj) {
    if (!key) return '';
    var teams = [matchObj.home, matchObj.away];
    for (var i = 0; i < teams.length; i++) {
      var e = _equipos().find(function (t) { return t.name === teams[i]; });
      var p = ((e && e.players) || []).find(function (pp) { return pp.key === key; });
      if (p) return _cleanName(p.name || p.key);
    }
    return key;
  }
  function _timeLabel(match) {
    if (!match || !match.date) return (match && match.time) || '';
    var d = new Date(match.date);
    if (isNaN(d.getTime())) return match.time || '';
    var dow = d.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase().replace('.', '');
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    return dow + ' ' + d.getDate() + ' · ' + hh + ':' + mm;
  }

  // Jornadas de grupos = matchday J1/J2/J3 (V3_MATCH_DAY).
  function _matchDayMap() { return (typeof V3_MATCH_DAY !== 'undefined') ? V3_MATCH_DAY : (window.V3_MATCH_DAY || ['J1','J1','J2','J2','J3','J3']); }
  function _gruposJornadas() {
    var arr = _partidos().filter(function (m) { return m && m.group; });
    var byGroup = {};
    arr.forEach(function (m) { (byGroup[m.group] = byGroup[m.group] || []).push(m); });
    var dayMap = _matchDayMap();
    var out = { J1: [], J2: [], J3: [] };
    Object.keys(byGroup).sort().forEach(function (g) {
      var ms = byGroup[g].slice().sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')); });
      ms.forEach(function (m, i) { var d = dayMap[i % 6] || 'J1'; (out[d] = out[d] || []).push(m); });
    });
    return out;
  }
  function _jornadaDates(ms) {
    var ds = ms.map(function (m) { return m.date ? new Date(m.date) : null; }).filter(function (d) { return d && !isNaN(d.getTime()); });
    if (!ds.length) return '';
    ds.sort(function (a, b) { return a - b; });
    var f = ds[0], l = ds[ds.length - 1];
    var mon = l.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase().replace('.', '');
    return (f.getDate() === l.getDate() ? String(f.getDate()) : f.getDate() + '–' + l.getDate()) + ' ' + mon;
  }

  // Resultado real del fixture (finished/live) desde live_scores / PARTIDOS.
  // OJO (Item 6 post-J1): window._liveScoresByMatchKey está indexada por key
  // de BD (wc2026_gX_id), NO por la key legacy de _mk (grupo_local_visitante).
  // Resolver con window.matchKeyFor (live-sync.js, mismo mapper que
  // getDirectoKey en ui-directo). La legacy sigue siendo la correcta para
  // predByKey y boostSet — no tocar _mk en el resto.
  function _realFor(matchObj) {
    var liveKey = (typeof window.matchKeyFor === 'function') ? window.matchKeyFor(matchObj) : null;
    var live = liveKey ? _live()[liveKey] : null;
    if (live && live.status === 'finished') {
      var h = (live.score_home != null) ? live.score_home : (matchObj.realHome != null ? matchObj.realHome : null);
      var a = (live.score_away != null) ? live.score_away : (matchObj.realAway != null ? matchObj.realAway : null);
      if (h != null && a != null) return { h: h, a: a, phase: 'final' };
    }
    if (live && (live.status === 'inprogress' || live.status === 'halftime' || live.status === 'overtime' || live.status === 'penalties')) {
      return { h: live.score_home != null ? live.score_home : 0, a: live.score_away != null ? live.score_away : 0, phase: 'live', minute: live.minute || null };
    }
    return null;
  }

  // base del motor reconstruida del breakdown de tipos (para aplicar el boost
  // del TARGET, no el boostPicks global del viewer). Espejo de scoring.js:
  // signo +1, exacto +3 adicional (=4), goleador +2, vs-IA +1, cap 7.
  function _baseFromTypes(types) {
    var b = types.indexOf('exact') !== -1 ? 4 : types.indexOf('win') !== -1 ? 1 : 0;
    if (types.indexOf('gole') !== -1) b += 2;
    if (types.indexOf('bonus') !== -1) b += 1;
    return Math.min(b, 7);
  }

  function buildMatchCard(matchObj, pred, boostSet) {
    var matchKey = _mk(matchObj);
    var home = { n: matchObj.home, c: codeFor(matchObj.home) };
    var away = { n: matchObj.away, c: codeFor(matchObj.away) };
    var rf = _realFor(matchObj);
    var phase = rf ? rf.phase : 'pre';
    if (!pred) {
      return { home: home, away: away, time: _timeLabel(matchObj), phase: 'pre', pred: null, real: null, scorer: '', boost: false, boosted: false, pts: 0, scoringTypes: [] };
    }
    var out = {
      home: home, away: away,
      time: phase === 'live' ? (rf.minute ? rf.minute + '′' : 'directo') : _timeLabel(matchObj),
      phase: phase,
      pred: { h: pred.local, a: pred.visitante },
      real: phase === 'final' ? { h: rf.h, a: rf.a } : null,
      scorer: pred.scorer ? _scorerName(pred.scorer, matchObj) : '',
      boost: boostSet.has(matchKey), boosted: false, pts: 0, scoringTypes: [],
    };
    if (phase === 'live') out.live = { h: rf.h, a: rf.a };
    if (phase !== 'pre') {
      var predObj = { l: pred.local, v: pred.visitante, gol: pred.scorer, saved: true, home: matchObj.home, away: matchObj.away };
      // played:true — resultados REALES de live_scores (phase live/post): el
      // sentinel 0-0-placeholder de v3CalcMatchPointsGrupos no aplica aquí,
      // un 0-0 real puntúa y pinta chip (regla 0-0, fix 10-jun).
      var mWithReal = Object.assign({}, matchObj, { realHome: rf.h, realAway: rf.a, played: true });
      var calc = (typeof window.v3CalcMatchPointsGrupos === 'function') ? window.v3CalcMatchPointsGrupos(predObj, mWithReal) : { total: 0, types: [] };
      var types = calc.types || [];
      var base = _baseFromTypes(types);
      var exact = types.indexOf('exact') !== -1;
      var gole = types.indexOf('gole') !== -1;
      out.scoringTypes = types;
      // R3 (12-jun, regla canónica San): el ×2 del boost SOLO con exacto Y
      // goleador a la vez; el +1 anti-IA queda FUERA del multiplicador
      // (default BOOST_INCLUYE_IA=false, espejo scoring.js/_shared) — máx 13.
      out.boosted = out.boost && exact && gole;
      if (out.boosted) {
        var bonus = types.indexOf('bonus') !== -1 ? 1 : 0;
        out.pts = (base - bonus) * 2 + bonus;
      } else {
        out.pts = base;
      }
    }
    return out;
  }

  function buildPorra(ef, userId, hints, name) {
    var predByKey = {};
    (ef.predictions || []).forEach(function (p) { predByKey[p.match_id] = p; });
    var boostSet = new Set(ef.boost_picks || []);
    var md = _gruposJornadas();
    var defs = [
      { id: 'j1', short: 'J1', label: 'Jornada 1', key: 'J1' },
      { id: 'j2', short: 'J2', label: 'Jornada 2', key: 'J2' },
      { id: 'j3', short: 'J3', label: 'Jornada 3', key: 'J3' },
    ];
    var jornadas = defs.map(function (def) {
      var ms = (md[def.key] || []).slice().sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')); });
      var matches = ms.map(function (mo) { return buildMatchCard(mo, predByKey[_mk(mo)], boostSet); });
      var state = 'upcoming';
      if (matches.some(function (x) { return x.phase === 'live'; })) state = 'live';
      else if (matches.some(function (x) { return x.phase === 'final'; })) state = 'done';
      return { id: def.id, short: def.short, label: def.label, dates: _jornadaDates(ms), state: state, matches: matches };
    });

    var rank = (hints && hints.rank != null) ? hints.rank : null;
    var totalPlayers = (hints && hints.total != null) ? hints.total : null;
    if (rank == null || totalPlayers == null) {
      var sb = window._sbData;
      if (Array.isArray(sb) && sb.length) {
        if (totalPlayers == null) totalPlayers = sb.length;
        if (rank == null) { var idx = sb.findIndex(function (r) { return String(r.uid) === String(userId); }); if (idx >= 0) rank = idx + 1; }
      }
    }
    var meId = window.currentUser && window.currentUser.id;
    var isMe = !!(meId && String(meId) === String(userId));
    var leagueName = (window._activeLeague && window._activeLeague.nombre) || '';
    return { user: { name: name, initials: _initials(name), user_id: userId, leagueName: leagueName, isMe: isMe }, rank: rank, totalPlayers: totalPlayers, jornadas: jornadas };
  }

  // ── Render ──
  function _jornadaPts(j) { return j.matches.filter(function (m) { return m.phase === 'final'; }).reduce(function (s, m) { return s + (m.pts || 0); }, 0); }

  function renderMatchCard(m) {
    var isFinal = m.phase === 'final', isLive = m.phase === 'live';
    var types = m.scoringTypes || [];
    var signo = (isFinal || isLive) ? (types.indexOf('win') !== -1 || types.indexOf('exact') !== -1) : false;
    var exact = types.indexOf('exact') !== -1;
    var gole = types.indexOf('gole') !== -1;
    var vsIA = types.indexOf('bonus') !== -1;

    var cls = ['up-match'];
    if (isFinal) cls.push((m.pts || 0) > 0 ? (exact ? 'k-exact' : 'k-sign') : 'k-fail');
    else if (isLive) cls.push('live');
    else cls.push('pre');

    var status = isFinal ? 'Final'
      : isLive ? '<span class="dot"></span>En vivo · ' + esc(m.time)
      : esc(m.time);

    var chip = function (label, on, gold) {
      return '<span class="up-chip' + (on ? ' on' : '') + (on && gold ? ' gold' : '') + '">' + label + '</span>';
    };
    var chipsHtml = (isFinal || isLive)
      ? '<div class="up-chips">' + chip('Signo +1', signo) + chip('vs IA +1', vsIA) + chip('⚽ Gol +2', gole) + chip('Exacto +3', exact, true) + '</div>'
      : '';

    var scorerHtml = m.scorer
      ? '<div class="up-scorer">⚽ Goleador: <b class="' + (isFinal && gole ? 'gol-ok' : '') + '">' + esc(m.scorer) + '</b>' + (isFinal && gole ? ' ✓' : '') + '</div>'
      : '';

    var foot;
    if (isFinal) foot = '<span class="up-foot__real">Resultado <b>' + m.real.h + SEP + m.real.a + '</b></span><span class="up-foot__pts">' + (m.pts || 0) + ' pts' + (m.boosted ? ' · ⚡×2' : '') + '</span>';
    else if (isLive) foot = '<span class="up-foot__real">En directo <b>' + m.live.h + SEP + m.live.a + '</b></span><span class="up-foot__pts">' + (m.pts || 0) + ' pts prov.</span>';
    else foot = '<span class="up-foot__real">Aún por jugar</span>';

    var predHtml = m.pred
      ? '<span class="up-pred__score">' + m.pred.h + '<span class="up-pred__sep">–</span>' + m.pred.a + '</span>'
      : '<span class="up-pred__score" style="color:var(--ink-500)">—<span class="up-pred__sep">–</span>—</span>';

    return '<div class="' + cls.join(' ') + '">' +
      '<div class="up-match__head"><span class="up-match__status">' + status + '</span>' + (m.boost ? '<span class="up-boost">⚡ Boost ×2</span>' : '') + '</div>' +
      '<div class="up-match__teams">' +
        '<div class="up-team up-team--home">' + flagImg(m.home.n, 'up-team__flag') + '<span class="up-team__code">' + esc(m.home.c) + '</span></div>' +
        '<div class="up-pred"><span class="up-pred__lbl">Pronóstico</span>' + predHtml + '</div>' +
        '<div class="up-team up-team--away"><span class="up-team__code">' + esc(m.away.c) + '</span>' + flagImg(m.away.n, 'up-team__flag') + '</div>' +
      '</div>' +
      scorerHtml + chipsHtml +
      '<div class="up-match__foot">' + foot + '</div>' +
    '</div>';
  }

  function _nav(name) {
    return '<nav class="pc-nav"><button class="pc-nav__back" type="button" onclick="closePorraJugador()">' + CHEVRON + '<span>Predictor</span></button>' +
      '<div class="pc-nav__title">Porra de ' + esc(name) + '</div><div class="pc-nav__spacer"></div></nav>';
  }
  function _profile(name, isMe) {
    var lg = (window._activeLeague && window._activeLeague.nombre) || 'Liga';
    return '<div class="up-profile"><div class="up-avatar">' + esc(_initials(name)) + '</div>' +
      '<div class="up-id"><div class="up-id__name">' + esc(name) + '</div><div class="up-id__meta">' + esc(lg) + (isMe ? ' · <b>Tú</b>' : '') + '</div></div></div>';
  }

  function renderLoadingScreen(name) {
    return '<div class="pc-screen up-app"><div class="up-fixed">' + _nav(name) + _profile(name, false) + '</div>' +
      '<div class="up-scroll"><div class="pc-loading"><div class="pc-spinner"></div>Cargando porra…</div></div></div>';
  }
  function renderMsgScreen(name, msg, retryUid) {
    var retry = retryUid ? '<br><button class="pc-retry" type="button" onclick="openPorraJugador(\'' + retryUid + '\')">Reintentar</button>' : '';
    return '<div class="pc-screen up-app"><div class="up-fixed">' + _nav(name) + _profile(name, false) + '</div>' +
      '<div class="up-scroll"><div class="pc-body"><div class="pc-section__empty" style="padding:40px 0">' + esc(msg) + retry + '</div></div></div></div>';
  }

  function renderFullScreen(uc, active) {
    var aj = null;
    for (var i = 0; i < uc.jornadas.length; i++) { if (uc.jornadas[i].id === active) { aj = uc.jornadas[i]; break; } }
    if (!aj) aj = uc.jornadas[0];

    var allFinal = [];
    uc.jornadas.forEach(function (j) { j.matches.forEach(function (m) { if (m.phase === 'final') allFinal.push(m); }); });
    var totalPts = allFinal.reduce(function (s, m) { return s + (m.pts || 0); }, 0);
    var exactos = allFinal.filter(function (m) { return (m.scoringTypes || []).indexOf('exact') !== -1; }).length;
    var settled = allFinal.length;
    var ajFinal = aj.matches.filter(function (m) { return m.phase === 'final'; });
    var ajPts = ajFinal.reduce(function (s, m) { return s + (m.pts || 0); }, 0);

    var tabs = uc.jornadas.map(function (j) {
      var sub = j.state === 'done' ? (_jornadaPts(j) + ' pts') : j.state === 'live' ? 'en juego' : 'próx.';
      return '<button type="button" class="up-tab ' + j.state + (j.id === active ? ' active' : '') + '" onclick="porraJugadorSetJornada(\'' + j.id + '\')">' +
        '<span class="up-tab__t">' + esc(j.short) + '</span><span class="up-tab__s">' + sub + '</span></button>';
    }).join('');

    var rankNum = (uc.rank != null) ? '#' + uc.rank : '—';
    var rankLbl = (uc.totalPlayers != null) ? 'de ' + uc.totalPlayers + ' · liga' : 'liga';
    var footPos = (uc.rank != null) ? ' · posición #' + uc.rank : '';

    return '<div class="pc-screen up-app">' +
      '<div class="up-fixed">' +
        _nav(uc.user.name) + _profile(uc.user.name, uc.user.isMe) +
        '<div class="up-stats">' +
          '<div class="up-stat"><span class="up-stat__num"><b>' + totalPts + '</b></span><span class="up-stat__lbl">Puntos torneo</span></div>' +
          '<div class="up-stat"><span class="up-stat__num">' + rankNum + '</span><span class="up-stat__lbl">' + rankLbl + '</span></div>' +
          '<div class="up-stat"><span class="up-stat__num">' + exactos + '<small>/' + settled + '</small></span><span class="up-stat__lbl">Exactos</span></div>' +
        '</div>' +
        '<div class="up-tabs">' + tabs + '</div>' +
      '</div>' +
      '<div class="up-scroll"><div class="pc-body">' +
        '<div class="up-jornada">' + esc(aj.label) + ' <span>' + esc(aj.dates) + ' · ' + STATE_LABEL[aj.state] + (ajFinal.length ? ' · ' + ajPts + ' pts' : '') + '</span></div>' +
        '<div class="up-list">' + aj.matches.map(renderMatchCard).join('') + '</div>' +
      '</div></div>' +
      '<div class="pc-footer"><div class="pc-footer__l">' +
        '<div class="pc-footer__lbl">Total torneo' + footPos + '</div>' +
        '<div class="pc-footer__val"><b>' + totalPts + '</b> pts · ' + exactos + ' exactos</div>' +
      '</div></div>' +
    '</div>';
  }

  // ── Mount / unmount ──
  function hideOtherPages() {
    HIDE_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.style.display !== 'none') { el.dataset.pjPrevDisplay = el.style.display || ''; el.style.display = 'none'; }
    });
  }
  function restoreOtherPages() {
    var back = document.getElementById(returnTo);
    if (back) { back.style.display = back.dataset.pjPrevDisplay || 'block'; delete back.dataset.pjPrevDisplay; }
  }
  function _paint(uid, html) {
    if (_currentUid !== uid) return;
    var w = document.getElementById(WRAP_ID);
    if (!w) return;
    w.innerHTML = html;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function openPorraJugador(userId, hints) {
    if (!userId) { console.warn('[porra-jugador] userId vacío'); return; }
    _currentUid = userId;
    var visible = HIDE_IDS.find(function (id) { var el = document.getElementById(id); return el && el.style.display !== 'none'; });
    returnTo = visible || PAGE_PREDICTOR_ID;

    var name = (hints && hints.name) || 'Jugador';

    document.getElementById(WRAP_ID) && document.getElementById(WRAP_ID).remove();
    hideOtherPages();
    var wrap = document.createElement('div');
    wrap.id = WRAP_ID;
    document.body.appendChild(wrap);
    _paint(userId, renderLoadingScreen(name));

    var leagueId = PCS().activeLeagueId ? PCS().activeLeagueId() : (window._activeLeague && window._activeLeague.id);
    if (!leagueId) { _paint(userId, renderMsgScreen(name, 'Selecciona una liga para ver la porra.', null)); return; }

    PCS().invokeEF('get-user-predictions', { user_id: userId, league_id: leagueId })
      .then(function (ef) {
        if (_currentUid !== userId) return null;
        // Nombre autoritativo desde profiles (fallback al hint).
        return PCS().resolveNames([userId]).catch(function () { return {}; }).then(function (nm) {
          if (nm && nm[userId]) name = nm[userId];
          if (_currentUid !== userId) return;
          if (!ef) { _paint(userId, renderMsgScreen(name, 'Respuesta vacía del servidor.', userId)); return; }
          if (ef.gated) { _paint(userId, renderMsgScreen(name, 'Disponible tras el cierre de su porra.', null)); return; }
          var payload = buildPorra(ef, userId, hints, name);
          _state.userId = userId;
          _state.payload = payload;
          var liveJ = payload.jornadas.find(function (j) { return j.state === 'live'; });
          _state.active = (liveJ || payload.jornadas[0] || { id: 'j1' }).id;
          _paint(userId, renderFullScreen(payload, _state.active));
        });
      })
      .catch(function (err) {
        console.error('[porra-jugador] invoke falló:', err);
        _paint(userId, renderMsgScreen(name, 'No se pudo cargar. Inténtalo de nuevo.', userId));
      });
  }

  function porraJugadorSetJornada(id) {
    if (!_state.payload) return;
    _state.active = id;
    var wrap = document.getElementById(WRAP_ID);
    if (wrap) {
      wrap.innerHTML = renderFullScreen(_state.payload, id);
      var sc = wrap.querySelector('.up-scroll'); if (sc) sc.scrollTop = 0;
    }
  }

  function closePorraJugador() {
    _currentUid = null;
    var prev = document.getElementById(WRAP_ID); if (prev) prev.remove();
    restoreOtherPages();
  }

  // ── Fila del ranking clicable (delegación document; sobrevive re-render) ──
  if (!document._pjRowDelegated) {
    document.addEventListener('click', function (e) {
      if (!e.target || !e.target.closest) return;
      if (e.target.closest('.pred-ranking-share')) return;
      // pred-ranking-row (ranking inline) + tf-row/tf-pod (clasificación del
      // trofeo del Predictor, F5.1) — mismo handler, sin duplicar lógica.
      var row = e.target.closest('.pred-ranking-row[data-pl-user], .tf-row[data-pl-user], .tf-pod[data-pl-user]');
      if (!row) return;
      var uid = row.getAttribute('data-pl-user');
      if (!uid) return;
      var rankAttr = row.getAttribute('data-pl-rank');
      var totalAttr = row.getAttribute('data-pl-total');
      openPorraJugador(uid, {
        name: row.getAttribute('data-pl-name') || '',
        rank: rankAttr ? parseInt(rankAttr, 10) : null,
        total: totalAttr ? parseInt(totalAttr, 10) : null,
      });
    });
    document._pjRowDelegated = true;
  }

  window.openPorraJugador = openPorraJugador;
  window.closePorraJugador = closePorraJugador;
  window.porraJugadorSetJornada = porraJugadorSetJornada;
})();
