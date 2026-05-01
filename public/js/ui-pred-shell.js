/* F7.7 · Shell visual de #page-predictor.
   Entry: mountPredShell(state). Renderiza header + tile + stats + filters
   + lista (PredictionCard). Lee desde stores existentes (predictions,
   ko_predictions, award_picks, boost_picks, EQUIPOS, iaPredictions).
   NO duplica stores; NO toca scoring.js (motor calc*Points) ni la EF IA v10.

   Sub-PRs:
     B2: PredictionTile (3 estados) + sistema rangos.
     B3: Header + StatsStrip + FilterChips.
     B4: PredictionCard + ScoreStepper.
     B5: Trophy modal (reusa #modal).
     B6: wiring main-entry + ui-nav + bottom-tab + leagues hook.
*/
(function () {

  // ─────────────────────────────────────────────────────────────
  // ESTADO + CONSTANTES
  // ─────────────────────────────────────────────────────────────
  var _state = {
    mode: 'pre-mundial',     // 'pre-mundial' | 'groups' | 'ko16' | 'ko8' | 'sf' | 'final' | 'finalizado'
    activeFilter: 'pending'  // 'pending' | 'today' | 'week' | 'resolved'
  };

  // 2026-06-11T20:00:00Z (kickoff Mundial). Compartida por _renderTile pre-mundial.
  var _KICKOFF_TS = Date.UTC(2026, 5, 11, 20, 0, 0);
  var _TILE_TOTAL_GROUP = 72;  // partidos fase de grupos (barra pre-mundial)

  // ─────────────────────────────────────────────────────────────
  // HELPERS GENÉRICOS
  // ─────────────────────────────────────────────────────────────
  function _esc(s) {
    return String(s == null ? '' : s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function _fmtPts(n) {
    var s = String(Math.round(Number(n) || 0));
    return s.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
  }

  function _buildChevron() {
    return '' +
      '<svg class="fc-pred-tile__chevron" viewBox="0 0 16 16" aria-hidden="true" focusable="false">' +
        '<path d="M5.5 3.5L10 8l-4.5 4.5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>' +
      '</svg>';
  }

  function _buildWatermark() {
    return '' +
      '<svg class="fc-pred-tile__watermark" viewBox="0 0 64 64" aria-hidden="true" focusable="false">' +
        '<path d="M20 8h24v6c0 8-4 14-10 16v6h6v4H24v-4h6v-6c-6-2-10-8-10-16V8zm-6 4h4v6c0 4 2 8 5 10-5-1-9-6-9-12v-4zm32 0h4v4c0 6-4 11-9 12 3-2 5-6 5-10v-6zM22 50h20v6H22z" fill="currentColor"/>' +
      '</svg>';
  }

  // ─────────────────────────────────────────────────────────────
  // [B2] PredictionTile (#fc-pred-tile) — 3 estados
  // ─────────────────────────────────────────────────────────────
  function _renderTile(state) {
    var mount = document.getElementById('fc-pred-tile');
    if (!mount) return;

    var mode = (state && state.mode) || 'pre-mundial';
    mount.dataset.state = mode;

    var html = '';
    if (mode === 'pre-mundial') {
      html = _renderTilePreMundial(state);
    } else if (mode === 'finalizado') {
      html = _renderTileFinalizado(state);
    } else {
      html = _renderTileActive(state);
    }
    mount.innerHTML = html;

    var footer = mount.querySelector('.fc-pred-tile__footer');
    if (footer && state && typeof state.onFooterTap === 'function') {
      footer.addEventListener('click', state.onFooterTap);
    }
  }

  function _renderTilePreMundial(state) {
    var days = Math.max(0, Number(state.daysToKickoff || 0));
    var daysLabel = days <= 0 ? 'Mañana arranca' : ('Faltan ' + days + (days === 1 ? ' día' : ' días'));

    var predicted = Number(state.predicted || 0);
    var total = Number(state.total || _TILE_TOTAL_GROUP);
    var pendingTotal = Number(state.pendingTotal || Math.max(0, total - predicted));

    var bar = _progressBar(predicted, total);
    var watermark = _buildWatermark();

    var footer =
      '<button type="button" class="fc-pred-tile__footer" aria-label="Ir a partidos pendientes">' +
        '<span class="fc-pred-tile__footer-flame" aria-hidden="true">🔥</span>' +
        '<span class="fc-pred-tile__footer-text">Te quedan ' + pendingTotal +
          (pendingTotal === 1 ? ' partido' : ' partidos') + ' por pronosticar</span>' +
        _buildChevron() +
      '</button>';

    return '' +
      '<div class="fc-pred-tile__body">' +
        watermark +
        '<div class="fc-pred-tile__eyebrow">PREDICTOR · LISTO PARA EL MUNDIAL</div>' +
        '<div class="fc-pred-tile__pre-grid">' +
          '<div class="fc-pred-tile__pre-col fc-pred-tile__pre-col--left">' +
            '<div class="fc-pred-tile__pre-trophy" aria-hidden="true">🏆</div>' +
            '<div class="fc-pred-tile__pre-days">' + _esc(daysLabel) + '</div>' +
          '</div>' +
          '<div class="fc-pred-tile__pre-col fc-pred-tile__pre-col--right">' +
            '<div class="fc-pred-tile__pre-label">Pronósticos</div>' +
            '<div class="fc-pred-tile__pre-count">' + predicted + '/' + total + '</div>' +
            '<div class="fc-pred-tile__pre-bar" aria-hidden="true">' + bar + '</div>' +
          '</div>' +
        '</div>' +
      '</div>' +
      footer;
  }

  function _renderTileActive(state) {
    var pts = Number(state.pts || 0);
    var rank = (typeof window.getRank === 'function') ? window.getRank(pts) : { name: '—', phrase: '' };
    var league = state.league || { rank: 0, total: 0 };
    var global = state.global || { rank: 0, delta: null };
    var pendingToday = Number(state.pendingToday || 0);

    var deltaChip = '';
    if (global.delta !== null && global.delta !== undefined) {
      var d = Number(global.delta);
      if (d > 0) {
        deltaChip = '<span class="fc-pred-tile__delta fc-pred-tile__delta--up">↑' + d + '</span>';
      } else if (d < 0) {
        deltaChip = '<span class="fc-pred-tile__delta fc-pred-tile__delta--down">↓' + Math.abs(d) + '</span>';
      }
    }

    var watermark = _buildWatermark();

    var footer = '';
    if (pendingToday > 0) {
      footer =
        '<button type="button" class="fc-pred-tile__footer" aria-label="Ir a partido pendiente">' +
          '<span class="fc-pred-tile__footer-flame" aria-hidden="true">🔥</span>' +
          '<span class="fc-pred-tile__footer-text">' + pendingToday +
            (pendingToday === 1 ? ' predicción pendiente' : ' predicciones pendientes') +
            ' para hoy</span>' +
          _buildChevron() +
        '</button>';
    }

    return '' +
      '<div class="fc-pred-tile__body">' +
        watermark +
        '<div class="fc-pred-tile__row fc-pred-tile__row--top">' +
          '<div class="fc-pred-tile__eyebrow">PREDICTOR · ' + _esc((rank.name || '').toUpperCase()) + '</div>' +
          '<div class="fc-pred-tile__chip fc-pred-tile__chip--gold">Liga: #' + league.rank + ' / ' + league.total + '</div>' +
        '</div>' +
        '<div class="fc-pred-tile__row fc-pred-tile__row--mid">' +
          '<div class="fc-pred-tile__pts">' + _fmtPts(pts) + ' <span class="fc-pred-tile__pts-unit">pts</span></div>' +
          '<div class="fc-pred-tile__chip fc-pred-tile__chip--secondary">Global #' + global.rank + ' ' + deltaChip + '</div>' +
        '</div>' +
        '<div class="fc-pred-tile__phrase">"' + _esc(rank.phrase || '') + '"</div>' +
      '</div>' +
      footer;
  }

  function _renderTileFinalizado(state) {
    var pts = Number(state.pts || 0);
    var rank = (typeof window.getRank === 'function') ? window.getRank(pts) : { name: '—', phrase: '' };
    var league = state.league || { rank: 0, total: 0 };

    var watermark = _buildWatermark();

    return '' +
      '<div class="fc-pred-tile__body">' +
        watermark +
        '<div class="fc-pred-tile__row fc-pred-tile__row--top">' +
          '<div class="fc-pred-tile__eyebrow">PREDICTOR · MUNDIAL FINALIZADO</div>' +
          '<div class="fc-pred-tile__chip fc-pred-tile__chip--gold">Liga: #' + league.rank + ' / ' + league.total + '</div>' +
        '</div>' +
        '<div class="fc-pred-tile__row fc-pred-tile__row--mid">' +
          '<div class="fc-pred-tile__pts">' + _fmtPts(pts) + ' <span class="fc-pred-tile__pts-unit">pts</span></div>' +
          '<div class="fc-pred-tile__chip fc-pred-tile__chip--rank">Tu rango: ' + _esc(rank.name) + '</div>' +
        '</div>' +
        '<div class="fc-pred-tile__phrase">"' + _esc(rank.phrase || '') + '"</div>' +
      '</div>';
  }

  function _progressBar(predicted, total) {
    var slots = 8;
    var filled = total > 0 ? Math.round((predicted / total) * slots) : 0;
    if (filled > slots) filled = slots;
    if (filled < 0) filled = 0;
    var out = '';
    for (var i = 0; i < slots; i++) {
      out += '<span class="fc-pred-tile__pre-dot' + (i < filled ? ' is-on' : '') + '"></span>';
    }
    return out;
  }

  // ─────────────────────────────────────────────────────────────
  // [B3] Helper subtitle dinámico
  // ─────────────────────────────────────────────────────────────
  function _subtitleFromMode(mode, jornada) {
    switch (mode) {
      case 'pre-mundial': return 'Cierre porra: 10 jun · 23:59';
      case 'groups':      return 'Jornada ' + (jornada || 1) + ' · Fase de grupos';
      case 'ko16':        return 'Octavos';
      case 'ko8':         return 'Cuartos';
      case 'sf':          return 'Semifinales';
      case 'final':       return 'Final';
      case 'finalizado':  return 'Mundial finalizado';
      default:            return '';
    }
  }

  // ─────────────────────────────────────────────────────────────
  // [B3] Header (#fc-pred-header)
  // ─────────────────────────────────────────────────────────────
  function _renderHeader(state) {
    var mount = document.getElementById('fc-pred-header');
    if (!mount) return;

    var subtitle = _subtitleFromMode(state.mode, state.jornada);

    var trophySvg =
      '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" ' +
      'stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' +
      '<path d="M6 4h12v3a6 6 0 0 1-12 0V4z"/>' +
      '<path d="M6 6H3a3 3 0 0 0 3 3"/>' +
      '<path d="M18 6h3a3 3 0 0 1-3 3"/>' +
      '<path d="M9 17h6"/><path d="M12 13v4"/><path d="M8 21h8"/>' +
      '</svg>';

    mount.className = 'fc-pred-header';
    mount.innerHTML =
      '<div class="fc-pred-eyebrow-row">' +
        '<span class="fc-eyebrow">PREDICTOR</span>' +
        '<button class="fc-pred-trophy-btn" type="button" aria-label="Mis premios individuales">' +
          trophySvg +
        '</button>' +
      '</div>' +
      '<h1 class="fc-pred-title">Tus predicciones</h1>' +
      '<p class="fc-pred-subtitle">' + _esc(subtitle) + '</p>';

    var trophyBtn = mount.querySelector('.fc-pred-trophy-btn');
    if (trophyBtn && typeof state.onTrophyTap === 'function') {
      trophyBtn.addEventListener('click', function () { state.onTrophyTap(); });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // [B3] Helpers puros — % aciertos + racha (§1.3 del bundle)
  // ─────────────────────────────────────────────────────────────
  function _computeAciertos(predictionsResolved, iaByMatch) {
    if (!predictionsResolved || !predictionsResolved.length) {
      return { pts: 0, max: 0, pct: null };
    }
    var pts = 0, max = 0;
    for (var i = 0; i < predictionsResolved.length; i++) {
      var p = predictionsResolved[i];
      var iaSign = (iaByMatch && iaByMatch[p.matchKey]) ? iaByMatch[p.matchKey] : null;
      var userSign = (p.pred.home > p.pred.away) ? '1'
                   : (p.pred.home < p.pred.away) ? '2' : 'X';
      var vsIA = !!(iaSign && userSign !== iaSign);
      max += vsIA ? 6 : 5;
      if (p.exactCorrect) pts += 3;
      if (p.scorerCorrect) pts += 2;
      if (vsIA && p.signCorrect) pts += 1;
    }
    var pct = max > 0 ? Math.round((pts / max) * 100) : null;
    return { pts: pts, max: max, pct: pct };
  }

  function _computeStreak(predictionsResolved) {
    if (!predictionsResolved || !predictionsResolved.length) return 0;
    // Asume array ordenado cronológicamente ASC; cuenta desde el final.
    var streak = 0;
    for (var i = predictionsResolved.length - 1; i >= 0; i--) {
      if (predictionsResolved[i].signCorrect) streak++;
      else break;
    }
    return streak;
  }

  // ─────────────────────────────────────────────────────────────
  // [B3] StatsStrip (#fc-pred-stats)
  // ─────────────────────────────────────────────────────────────
  function _renderStats(state) {
    var mount = document.getElementById('fc-pred-stats');
    if (!mount) return;

    var isPre = state.mode === 'pre-mundial';

    var flameSvg =
      '<svg class="fc-icon-flame" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<path d="M12 2c1 4-2 5-2 8a4 4 0 0 0 8 0c0-2-1-3-2-4 0 2-1 3-2 3 0-3 2-5-2-7zM7 13c-2 2-3 4-3 6a8 8 0 0 0 16 0c0-1-.3-2-.8-3-.7 2-2.4 3-4.2 3 1-1 1.5-2.5 1-4-1 1.5-2.5 2-4 2-3 0-5-2-5-4z"/>' +
      '</svg>';

    var boltSvg =
      '<svg class="fc-icon-bolt" width="16" height="16" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">' +
      '<path d="M13 2L4 14h6l-2 8 10-13h-6l1-7z"/>' +
      '</svg>';

    var pctVal, rachaVal, bonusVal;
    if (isPre) {
      pctVal = '—'; rachaVal = '—'; bonusVal = '—';
    } else {
      pctVal = (state.aciertosPct == null) ? '—' : (state.aciertosPct + '%');
      rachaVal = (state.racha == null) ? '0' : String(state.racha);
      bonusVal = String(state.bonusIa || 0);
    }

    var pctColorClass = (!isPre && state.aciertosPct != null && state.aciertosPct >= 60)
      ? ' fc-pred-stats__val--win' : '';

    var subPre = isPre ? '<span class="fc-pred-stats__sub">Disponible 11 jun</span>' : '';

    mount.innerHTML =
      '<div class="fc-pred-stats__col">' +
        '<span class="fc-eyebrow">% Aciertos</span>' +
        '<strong class="fc-pred-stats__val' + pctColorClass + '">' + pctVal + '</strong>' +
        subPre +
      '</div>' +
      '<div class="fc-pred-stats__col">' +
        '<span class="fc-eyebrow">Racha</span>' +
        '<strong class="fc-pred-stats__val">' + flameSvg + ' ' + rachaVal + '</strong>' +
        subPre +
      '</div>' +
      '<div class="fc-pred-stats__col">' +
        '<span class="fc-eyebrow">Bonus IA</span>' +
        '<strong class="fc-pred-stats__val">' + boltSvg + ' ' + bonusVal + '</strong>' +
        subPre +
      '</div>';
  }

  // ─────────────────────────────────────────────────────────────
  // [B3] FilterChips (#fc-pred-filters) — pre-mundial: quick-link
  // ─────────────────────────────────────────────────────────────
  function _renderFilters(state) {
    var mount = document.getElementById('fc-pred-filters');
    if (!mount) return;

    if (state.mode === 'pre-mundial') {
      var predicted = state.predicted || 0;
      var total = state.total || 72;
      mount.innerHTML =
        '<a class="fc-pred-quick-link" href="javascript:void(0)" data-target="grupos">' +
          'Tu porra · ' + predicted + '/' + total + ' &rarr;' +
        '</a>';
      var link = mount.querySelector('.fc-pred-quick-link');
      if (link && typeof state.onQuickLink === 'function') {
        link.addEventListener('click', function (e) {
          e.preventDefault();
          state.onQuickLink('grupos');
        });
      }
      return;
    }

    var active = state.activeFilter || 'pending';
    var todayN = (typeof state.todayCount === 'number') ? state.todayCount : 0;

    var chips = [
      { key: 'pending',  label: 'Por jugar' },
      { key: 'today',    label: 'Hoy · ' + todayN },
      { key: 'week',     label: 'Esta sem.' },
      { key: 'resolved', label: 'Resueltas' }
    ];

    var html = '';
    for (var i = 0; i < chips.length; i++) {
      var c = chips[i];
      var cls = 'fc-pred-filter-chip' + (c.key === active ? ' is-active' : '');
      html += '<button class="' + cls + '" data-filter="' + c.key + '" type="button">' +
              _esc(c.label) + '</button>';
    }
    mount.innerHTML = html;

    var btns = mount.querySelectorAll('.fc-pred-filter-chip');
    for (var j = 0; j < btns.length; j++) {
      btns[j].addEventListener('click', function (ev) {
        var k = ev.currentTarget.getAttribute('data-filter');
        for (var m = 0; m < btns.length; m++) btns[m].classList.remove('is-active');
        ev.currentTarget.classList.add('is-active');
        if (typeof state.onFilterChange === 'function') state.onFilterChange(k);
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // [B4] Helpers privados list/card
  // ─────────────────────────────────────────────────────────────
  function _signOf(h, a) {
    if (h == null || a == null) return null;
    if (h > a) return '1';
    if (h < a) return '2';
    return 'X';
  }

  function _shortName(team) {
    if (!team) return '';
    if (team.name_en) return team.name_en;
    if (team.name) return team.name.substring(0, 3).toUpperCase();
    return '';
  }

  function _teamImgSafe(name, size) {
    if (typeof teamImg === 'function') {
      try { return teamImg(name, size); } catch (e) {}
    }
    return '<div class="fc-pred-card__badge-fallback" style="width:' + size + 'px;height:' + size + 'px;"></div>';
  }

  // ─────────────────────────────────────────────────────────────
  // [B4] PredictionCard list (#fc-pred-list) — agrupado por eyebrow
  // ─────────────────────────────────────────────────────────────
  function _renderList(state) {
    var mount = document.getElementById('fc-pred-list');
    if (!mount) return;

    if (!state || state.mode === 'pre-mundial' || !state.matches || state.matches.length === 0) {
      mount.innerHTML = '<div class="fc-pred-list__empty"><span>No hay partidos en esta vista.</span></div>';
      return;
    }

    var groups = _groupByEyebrow(state.matches);
    var html = '';
    for (var i = 0; i < groups.length; i++) {
      var g = groups[i];
      html += '<div class="fc-pred-list__group">';
      html += '<h3 class="fc-eyebrow fc-pred-list__eyebrow">' + _esc(g.eyebrow) + '</h3>';
      html += '<div class="fc-pred-list__cards">';
      for (var j = 0; j < g.matches.length; j++) {
        html += _renderCard(g.matches[j]);
      }
      html += '</div>';
      html += '</div>';
    }
    mount.innerHTML = html;
  }

  function _groupByEyebrow(matches) {
    var map = {};
    var order = [];
    for (var i = 0; i < matches.length; i++) {
      var key = matches[i].eyebrow || '';
      if (!map[key]) {
        map[key] = { eyebrow: key, matches: [] };
        order.push(key);
      }
      map[key].matches.push(matches[i]);
    }
    var out = [];
    for (var k = 0; k < order.length; k++) out.push(map[order[k]]);
    return out;
  }

  // ─────────────────────────────────────────────────────────────
  // [B4] PredictionCard (3 estados: open / locked / resolved)
  // ─────────────────────────────────────────────────────────────
  function _renderCard(match) {
    if (!match) return '';
    var status = match.status || 'open';
    var pred = match.pred || null;
    var real = match.real || null;
    var correct = !!match.correct;

    var when = _esc(match.when || '');
    var chipHtml = '';
    if (status === 'open') {
      chipHtml = '<span class="fc-pred-card__chip fc-pred-card__chip--open">Cierra · ' + _esc(match.closesIn || '') + '</span>';
    } else if (status === 'locked') {
      var lockSvg = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>';
      chipHtml = '<span class="fc-pred-card__chip fc-pred-card__chip--locked">' + lockSvg + 'Bloqueada</span>';
    } else if (status === 'resolved') {
      if (correct) {
        chipHtml = '<span class="fc-pred-card__chip fc-pred-card__chip--win">+' + (match.points || 0) + ' pts</span>';
      } else {
        chipHtml = '<span class="fc-pred-card__chip fc-pred-card__chip--miss">' + (match.points || 0) + ' pts</span>';
      }
    }

    var homeBadge = _teamImgSafe(match.home && match.home.name, 36);
    var awayBadge = _teamImgSafe(match.away && match.away.name, 36);
    var homeShort = _esc(_shortName(match.home));
    var awayShort = _esc(_shortName(match.away));

    var scoreHtml = '';
    var scoreClass = 'fc-pred-card__score';
    if (status === 'resolved') {
      var scoreColor = correct ? 'fc-pred-card__score--win' : 'fc-pred-card__score--miss';
      var ph = (pred && pred.home != null) ? pred.home : '—';
      var pa = (pred && pred.away != null) ? pred.away : '—';
      scoreHtml =
        '<div class="' + scoreClass + ' ' + scoreColor + '">' +
          '<span class="fc-num">' + _esc(ph) + '</span>' +
          '<span class="fc-pred-card__score-sep">-</span>' +
          '<span class="fc-num">' + _esc(pa) + '</span>' +
        '</div>';
      if (real) {
        scoreHtml +=
          '<div class="fc-pred-card__real">Real: ' +
            '<span class="fc-num">' + _esc(real.home) + '</span>' +
            '<span>–</span>' +
            '<span class="fc-num">' + _esc(real.away) + '</span>' +
          '</div>';
      }
    } else {
      var sh = (pred && pred.home != null) ? pred.home : '—';
      var sa = (pred && pred.away != null) ? pred.away : '—';
      scoreHtml =
        '<div class="' + scoreClass + '">' +
          '<span class="fc-num">' + _esc(sh) + '</span>' +
          '<span class="fc-pred-card__score-sep">-</span>' +
          '<span class="fc-num">' + _esc(sa) + '</span>' +
        '</div>';
    }

    var cardClasses = ['fc-pred-card', 'fc-pred-card--' + status];
    if (status === 'resolved' && correct) cardClasses.push('fc-pred-card--win');

    var extras = '';
    if (status === 'open') {
      var hVal = (pred && pred.home != null) ? pred.home : 0;
      var aVal = (pred && pred.away != null) ? pred.away : 0;

      var userSign = (pred && pred.home != null && pred.away != null) ? _signOf(pred.home, pred.away) : null;
      var iaChip = _buildIaChip(userSign, match.iaSign || null);

      var players = [];
      if (match.home && match.home.players) players = players.concat(match.home.players);
      if (match.away && match.away.players) players = players.concat(match.away.players);
      var selectedScorer = (pred && pred.scorer) ? pred.scorer : '';
      var scorerOpts = '<option value="">— elige goleador —</option>';
      for (var p = 0; p < players.length; p++) {
        var pl = players[p];
        if (!pl || !pl.key) continue;
        var sel = (pl.key === selectedScorer) ? ' selected' : '';
        scorerOpts += '<option value="' + _esc(pl.key) + '"' + sel + '>' + _esc(pl.name || pl.key) + '</option>';
      }

      extras =
        '<div class="fc-pred-card__steppers">' +
          _renderStepper('home', match.home, hVal) +
          _renderStepper('away', match.away, aVal) +
        '</div>' +
        (iaChip ? iaChip : '') +
        '<select class="fc-pred-card__scorer" data-match-key="' + _esc(match.matchKey || '') + '" aria-label="Goleador">' +
          scorerOpts +
        '</select>' +
        _buildScoringBreakdown();
    }

    return '' +
      '<article class="' + cardClasses.join(' ') + '" data-match-key="' + _esc(match.matchKey || '') + '">' +
        '<header class="fc-pred-card__header">' +
          '<span class="fc-pred-card__when">' + when + '</span>' +
          chipHtml +
        '</header>' +
        '<div class="fc-pred-card__body">' +
          '<div class="fc-pred-card__team fc-pred-card__team--home">' +
            '<span class="fc-pred-card__badge">' + homeBadge + '</span>' +
            '<span class="fc-pred-card__teamname">' + homeShort + '</span>' +
          '</div>' +
          '<div class="fc-pred-card__score-wrap">' + scoreHtml + '</div>' +
          '<div class="fc-pred-card__team fc-pred-card__team--away">' +
            '<span class="fc-pred-card__badge">' + awayBadge + '</span>' +
            '<span class="fc-pred-card__teamname">' + awayShort + '</span>' +
          '</div>' +
        '</div>' +
        extras +
      '</article>';
  }

  function _renderStepper(side, team, value) {
    var name = _esc(_shortName(team));
    var flagHtml = _teamImgSafe(team && team.name, 24);
    var v = (value == null) ? 0 : value;
    return '' +
      '<div class="fc-pred-stepper" data-team="' + _esc(side) + '">' +
        '<span class="fc-pred-stepper__flag">' + flagHtml + '</span>' +
        '<span class="fc-pred-stepper__name">' + name + '</span>' +
        '<button class="fc-pred-stepper__btn" data-action="dec" type="button" aria-label="Restar">−</button>' +
        '<span class="fc-pred-stepper__val fc-num">' + _esc(v) + '</span>' +
        '<button class="fc-pred-stepper__btn" data-action="inc" type="button" aria-label="Sumar">+</button>' +
      '</div>';
  }

  function _buildIaChip(userSign, iaSign) {
    if (!userSign || !iaSign) return '';
    if (userSign === iaSign) {
      return '<div class="fc-pred-card__iachip fc-pred-card__iachip--match">Coincides con la IA</div>';
    }
    return '<div class="fc-pred-card__iachip fc-pred-card__iachip--against">Vas contra la IA · +1 si aciertas</div>';
  }

  function _buildScoringBreakdown() {
    return '' +
      '<div class="fc-pred-card__breakdown">' +
        '<span class="fc-pred-card__breakdown-item" data-tip="Acierto del resultado (1, X o 2). Suma 1 punto si no aciertas el exacto.">Signo: +1</span>' +
        '<span class="fc-pred-card__breakdown-sep">·</span>' +
        '<span class="fc-pred-card__breakdown-item" data-tip="Resultado exacto. Suma 3 puntos (incluye signo, no acumula con +1 signo).">Exacto: +3</span>' +
        '<span class="fc-pred-card__breakdown-sep">·</span>' +
        '<span class="fc-pred-card__breakdown-item" data-tip="Acierta el goleador del partido. Suma 2 puntos.">Goleador: +2</span>' +
        '<span class="fc-pred-card__breakdown-sep">·</span>' +
        '<span class="fc-pred-card__breakdown-item" data-tip="Si vas contra el pronóstico de la IA y aciertas el signo, suma 1 punto extra.">vs IA: +1</span>' +
      '</div>';
  }

  // ─────────────────────────────────────────────────────────────
  // EXPOSICIÓN PARCIAL (B6 wirea el entry point completo)
  // ─────────────────────────────────────────────────────────────
  window.PorraPred = window.PorraPred || {};
  window.PorraPred._renderTile = _renderTile;
  window.PorraPred._renderHeader = _renderHeader;
  window.PorraPred._renderStats = _renderStats;
  window.PorraPred._renderFilters = _renderFilters;
  window.PorraPred._renderList = _renderList;
  window.PorraPred._computeAciertos = _computeAciertos;
  window.PorraPred._computeStreak = _computeStreak;
  window.PorraPred._subtitleFromMode = _subtitleFromMode;
  window.PorraPred._state = _state;

})();
