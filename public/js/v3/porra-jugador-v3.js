/* ============================================================
 * porra-jugador-v3.js  ·  Screen 2 — "Porra de un jugador"
 * ------------------------------------------------------------
 * Todos los pronósticos de grupos de un jugador (consultable por
 * cualquier miembro tras el cierre). Selector de jornada J1/J2/J3
 * (matchday, modelo V3_MATCH_DAY de grupos-v3.js).
 *
 * Expone:
 *   window.openPorraJugador(userId, nameHint)
 *   window.closePorraJugador()
 *   window.porraJugadorSetJornada(jornadaId)   (selector de jornada)
 *
 * Entrada: fila del ranking del predictor (ui-pred-shell.js
 * _renderRanking), clicable vía delegación a nivel document.
 *
 * Puntuación: motor real. v3CalcMatchPointsGrupos(pred, matchConReal)
 * da {total, types}; total via calcMatchPoints (scoring.js). NO se usa
 * PCutil.chips() del mock (brief 4.3).
 *
 * Datos (F3): mock. Resolución:
 *   1) window.fetchPorraJugador(userId)   -> Promise (F5, real)
 *   2) window._porraJugadorMock[userId]   -> override manual QA
 *   3) _synthPorra(userId)                 -> sintetizado (PARTIDOS+motor)
 * Forma payload = brief 4.4 (solo jornadas de grupos).
 * ============================================================ */
(function () {
  'use strict';

  var WRAP_ID = 'page-porra-jugador';
  var PAGE_PREDICTOR_ID = 'page-predictor';
  var HIDE_IDS = ['page-jornada','page-directo','page-grupos','page-elim','page-score','page-admin','page-predictor','page-welcome'];
  var STATE_LABEL = { done: 'Cerrada', live: 'En juego', upcoming: 'Próximamente' };

  var returnTo = PAGE_PREDICTOR_ID;
  var _state = { userId: null, payload: null, active: 'j1' };

  // ── globals seguros ──
  function _partidos() { return (typeof PARTIDOS !== 'undefined') ? PARTIDOS : (window.PARTIDOS || []); }
  function _equipos() { return (typeof EQUIPOS !== 'undefined') ? EQUIPOS : (window.EQUIPOS || []); }
  var PCS = function () { return window.PCShared || {}; };
  var esc = function (s) { return PCS().esc ? PCS().esc(s) : String(s == null ? '' : s); };
  var fmt = function (n) { return PCS().fmt ? PCS().fmt(n) : String(n); };
  var flagImg = function (name, cls) { return PCS().flagImg ? PCS().flagImg(name, cls) : ''; };
  var codeFor = function (name) { return PCS().codeFor ? PCS().codeFor(name) : String(name || '').slice(0, 3).toUpperCase(); };
  function _mk(m) { return (typeof getMatchKey === 'function') ? getMatchKey(m) : (m.group + '_' + m.home + '_' + m.away); }

  var CHEVRON = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 12 L5 8 L10 4"/></svg>';

  // ── PRNG determinista (seed por string) ──
  function _seed(str) { var h = 2166136261; for (var i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function _rng(seed) { var s = seed >>> 0; return function () { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function _cleanName(s) { return String(s || '').replace(/^\s*\d+\s*·\s*/, '').trim(); }
  function _initials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    var s = parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]) : parts[0].slice(0, 1);
    return s.toUpperCase();
  }
  function _timeLabel(match) {
    if (!match || !match.date) return match && match.time || '';
    var d = new Date(match.date);
    if (isNaN(d.getTime())) return match.time || '';
    var dow = d.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase().replace('.', '');
    var hh = String(d.getHours()).padStart(2, '0');
    var mm = String(d.getMinutes()).padStart(2, '0');
    return dow + ' ' + d.getDate() + ' · ' + hh + ':' + mm;
  }

  // ── Jornadas de grupos = matchday J1/J2/J3 (modelo V3_MATCH_DAY) ──
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

  function _fallbackCalc(pred, ref) {
    var types = [], total = 0;
    var exact = pred.l === ref.h && pred.v === ref.a;
    var signOk = Math.sign(pred.l - pred.v) === Math.sign(ref.h - ref.a);
    if (exact) { types.push('exact'); total += 3; } else if (signOk) { types.push('win'); total += 1; }
    return { total: Math.min(total, 7), types: types };
  }

  // ── Mock sintetizado (QA) ──
  function _synthMatch(userId, match, phase, isBoost) {
    var rnd = _rng(_seed(userId + '|' + _mk(match)));
    var ph = Math.floor(rnd() * 4), pa = Math.floor(rnd() * 3);
    var homeEq = _equipos().find(function (e) { return e.name === match.home; });
    var awayEq = _equipos().find(function (e) { return e.name === match.away; });
    var roster = ((rnd() < 0.6 ? homeEq : awayEq) || {}).players || [];
    var golObj = roster.length ? roster[Math.floor(rnd() * Math.min(roster.length, 5))] : null;
    var pred = { l: ph, v: pa, gol: golObj ? golObj.key : null, saved: true, home: match.home, away: match.away };
    var out = {
      home: { n: match.home, c: codeFor(match.home) }, away: { n: match.away, c: codeFor(match.away) },
      time: phase === 'live' ? (10 + Math.floor(rnd() * 80)) + '′' : _timeLabel(match),
      phase: phase, pred: { h: ph, a: pa }, real: null,
      scorer: golObj ? _cleanName(golObj.name || golObj.key) : '', boost: !!isBoost, boosted: false, pts: 0, scoringTypes: [],
    };
    if (phase === 'pre') return out;

    var rh = Math.floor(rnd() * 4), ra = Math.floor(rnd() * 3);
    if (rh === 0 && ra === 0) ra = 1; // evita sentinel 0-0 (no jugado) del motor v3
    var ref = { h: rh, a: ra };
    if (phase === 'live') out.live = ref; else out.real = ref;

    var mWithReal = Object.assign({}, match, { realHome: ref.h, realAway: ref.a });
    var calc = (typeof window.v3CalcMatchPointsGrupos === 'function') ? window.v3CalcMatchPointsGrupos(pred, mWithReal) : _fallbackCalc(pred, ref);
    var base = calc.total || 0, types = calc.types || [];
    var exact = types.indexOf('exact') !== -1;
    // El motor aplica ×2 si boostPicks real coincide (base>7). Si no, simulamos
    // el ×2 cosmético en el match marcado boost+exacto. No doble-aplicar.
    if (base > 7) { out.boosted = true; out.pts = base; }
    else if (isBoost && exact) { out.boosted = true; out.pts = base * 2; }
    else out.pts = base;
    out.scoringTypes = types;
    return out;
  }

  function _synthPorra(userId, nameHint) {
    var md = _gruposJornadas();
    var meId = window.currentUser && window.currentUser.id;
    var isMe = !!(meId && String(meId) === String(userId));
    var name = nameHint
      || (isMe && window.currentUser && (window.currentUser.nombre || window.currentUser.name))
      || ('Jugador ' + String(userId || '').slice(0, 4));
    var leagueName = window._plLeagueName || '';
    var defs = [
      { id: 'j1', short: 'J1', label: 'Jornada 1', state: 'done', key: 'J1' },
      { id: 'j2', short: 'J2', label: 'Jornada 2', state: 'live', key: 'J2' },
      { id: 'j3', short: 'J3', label: 'Jornada 3', state: 'upcoming', key: 'J3' },
    ];
    var jornadas = defs.map(function (def) {
      var ms0 = (md[def.key] || []).slice().sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')); });
      var brnd = _rng(_seed(userId + '|' + def.id));
      var boostIdx = ms0.length ? Math.floor(brnd() * ms0.length) : -1;
      var matches = ms0.map(function (m, i) {
        var phase = def.state === 'done' ? 'final'
          : def.state === 'upcoming' ? 'pre'
          : (i < 5 ? 'final' : i === 5 ? 'live' : 'pre'); // jornada en juego: mezcla
        return _synthMatch(userId, m, phase, i === boostIdx);
      });
      return { id: def.id, short: def.short, label: def.label, dates: _jornadaDates(ms0), state: def.state, matches: matches };
    });
    var rnd = _rng(_seed(String(userId)));
    var totalPlayers = 8 + Math.floor(rnd() * 18);
    var rank = 1 + Math.floor(rnd() * totalPlayers);
    return { user: { name: name, initials: _initials(name), user_id: userId, leagueName: leagueName, isMe: isMe }, rank: rank, totalPlayers: totalPlayers, jornadas: jornadas };
  }

  function _resolvePayload(userId, nameHint) {
    if (typeof window.fetchPorraJugador === 'function') return window.fetchPorraJugador(userId);
    var ov = window._porraJugadorMock && window._porraJugadorMock[userId];
    return ov || _synthPorra(userId, nameHint);
  }

  // ── Render ──
  function _jornadaPts(j) { return j.matches.filter(function (m) { return m.phase === 'final'; }).reduce(function (s, m) { return s + (m.pts || 0); }, 0); }

  function renderMatchCard(m) {
    var isFinal = m.phase === 'final', isLive = m.phase === 'live';
    var types = m.scoringTypes || [];
    var signo = isFinal || isLive ? (types.indexOf('win') !== -1 || types.indexOf('exact') !== -1) : false;
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
    if (isFinal) foot = '<span class="up-foot__real">Resultado <b>' + m.real.h + '–' + m.real.a + '</b></span><span class="up-foot__pts">' + (m.pts || 0) + ' pts' + (m.boosted ? ' · ⚡×2' : '') + '</span>';
    else if (isLive) foot = '<span class="up-foot__real">En directo <b>' + m.live.h + '–' + m.live.a + '</b></span><span class="up-foot__pts">' + (m.pts || 0) + ' pts prov.</span>';
    else foot = '<span class="up-foot__real">Aún por jugar</span>';

    return '<div class="' + cls.join(' ') + '">' +
      '<div class="up-match__head"><span class="up-match__status">' + status + '</span>' + (m.boost ? '<span class="up-boost">⚡ Boost ×2</span>' : '') + '</div>' +
      '<div class="up-match__teams">' +
        '<div class="up-team up-team--home">' + flagImg(m.home.n, 'up-team__flag') + '<span class="up-team__code">' + esc(m.home.c) + '</span></div>' +
        '<div class="up-pred"><span class="up-pred__lbl">Pronóstico</span><span class="up-pred__score">' + m.pred.h + '<span class="up-pred__sep">–</span>' + m.pred.a + '</span></div>' +
        '<div class="up-team up-team--away"><span class="up-team__code">' + esc(m.away.c) + '</span>' + flagImg(m.away.n, 'up-team__flag') + '</div>' +
      '</div>' +
      scorerHtml + chipsHtml +
      '<div class="up-match__foot">' + foot + '</div>' +
    '</div>';
  }

  function renderScreen(uc, active) {
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

    var meta = esc(uc.user.leagueName || 'Liga') + (uc.user.isMe ? ' · <b>Tú</b>' : '');

    return '<div class="pc-screen up-app">' +
      '<div class="up-fixed">' +
        '<nav class="pc-nav"><button class="pc-nav__back" type="button" onclick="closePorraJugador()">' + CHEVRON + '<span>Predictor</span></button>' +
          '<div class="pc-nav__title">Porra de ' + esc(uc.user.name) + '</div><div class="pc-nav__spacer"></div></nav>' +
        '<div class="up-profile"><div class="up-avatar">' + esc(uc.user.initials) + '</div>' +
          '<div class="up-id"><div class="up-id__name">' + esc(uc.user.name) + '</div><div class="up-id__meta">' + meta + '</div></div></div>' +
        '<div class="up-stats">' +
          '<div class="up-stat"><span class="up-stat__num"><b>' + totalPts + '</b></span><span class="up-stat__lbl">Puntos torneo</span></div>' +
          '<div class="up-stat"><span class="up-stat__num">#' + uc.rank + '</span><span class="up-stat__lbl">de ' + uc.totalPlayers + ' · liga</span></div>' +
          '<div class="up-stat"><span class="up-stat__num">' + exactos + '<small>/' + settled + '</small></span><span class="up-stat__lbl">Exactos</span></div>' +
        '</div>' +
        '<div class="up-tabs">' + tabs + '</div>' +
      '</div>' +
      '<div class="up-scroll"><div class="pc-body">' +
        '<div class="up-jornada">' + esc(aj.label) + ' <span>' + esc(aj.dates) + ' · ' + STATE_LABEL[aj.state] + (ajFinal.length ? ' · ' + ajPts + ' pts' : '') + '</span></div>' +
        '<div class="up-list">' + aj.matches.map(renderMatchCard).join('') + '</div>' +
      '</div></div>' +
      '<div class="pc-footer"><div class="pc-footer__l">' +
        '<div class="pc-footer__lbl">Total torneo · posición #' + uc.rank + '</div>' +
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

  function openPorraJugador(userId, nameHint) {
    if (!userId) { console.warn('[porra-jugador] userId vacío'); return; }
    Promise.resolve().then(function () { return _resolvePayload(userId, nameHint); }).then(function (payload) {
      if (!payload) payload = _synthPorra(userId, nameHint);
      _state.userId = userId;
      _state.payload = payload;
      var liveJ = payload.jornadas.find(function (j) { return j.state === 'live'; });
      _state.active = (liveJ || payload.jornadas[0] || { id: 'j1' }).id;

      var visible = HIDE_IDS.find(function (id) { var el = document.getElementById(id); return el && el.style.display !== 'none'; });
      returnTo = visible || PAGE_PREDICTOR_ID;

      var prev = document.getElementById(WRAP_ID); if (prev) prev.remove();
      hideOtherPages();
      var wrap = document.createElement('div');
      wrap.id = WRAP_ID;
      wrap.innerHTML = renderScreen(payload, _state.active);
      document.body.appendChild(wrap);
      window.scrollTo({ top: 0, behavior: 'instant' });
    }).catch(function (err) { console.error('[porra-jugador] fallo:', err); });
  }

  function porraJugadorSetJornada(id) {
    if (!_state.payload) return;
    _state.active = id;
    var wrap = document.getElementById(WRAP_ID);
    if (wrap) {
      wrap.innerHTML = renderScreen(_state.payload, id);
      var sc = wrap.querySelector('.up-scroll'); if (sc) sc.scrollTop = 0;
    }
  }

  function closePorraJugador() {
    var prev = document.getElementById(WRAP_ID); if (prev) prev.remove();
    restoreOtherPages();
  }

  // ── Fila del ranking clicable (delegación document, sobrevive re-render) ──
  if (!document._pjRowDelegated) {
    document.addEventListener('click', function (e) {
      if (!e.target || !e.target.closest) return;
      if (e.target.closest('.pred-ranking-share')) return;
      var row = e.target.closest('.pred-ranking-row[data-pl-user]');
      if (!row) return;
      var uid = row.getAttribute('data-pl-user');
      if (uid) openPorraJugador(uid, row.getAttribute('data-pl-name') || '');
    });
    document._pjRowDelegated = true;
  }

  window.openPorraJugador = openPorraJugador;
  window.closePorraJugador = closePorraJugador;
  window.porraJugadorSetJornada = porraJugadorSetJornada;
})();
