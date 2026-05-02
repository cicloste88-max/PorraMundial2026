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

  // B11-trionda: constantes de la timeline única (balón Trionda + 6 marcas).
  var TRIONDA_URL = 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/Ball/Trionda-official-ball.png';
  var TOTAL_MATCHES = 104;
  var PHASES = [
    { idx: 0, key: 'groups', label: 'Grupos', total: 72 },
    { idx: 1, key: 'r32',    label: '1/16',   total: 16 },
    { idx: 2, key: 'r16',    label: '1/8',    total: 8  },
    { idx: 3, key: 'qf',     label: '1/4',    total: 4  },
    { idx: 4, key: 'sf',     label: '1/2',    total: 2  },
    { idx: 5, key: 'final',  label: 'Final',  total: 2  }
  ];

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
  // [B11-trionda] Timeline única con balón Trionda + fallback pre-mundial.
  // Recibe progress = { matchesPlayed, pctGlobal, currentPhaseIdx, ballPos,
  //                     badgeText, ballState, marks }. data.js::getMundialProgress
  //                     lo computa async; mountPredShell lo wirea en state.
  // ─────────────────────────────────────────────────────────────
  function _defaultProgressForPreMundial(state) {
    var days = Math.max(0, Number((state && state.daysToKickoff) || 0));
    return {
      matchesPlayed: 0,
      pctGlobal: 0,
      currentPhaseIdx: 0,
      ballPos: 0,
      badgeText: '0% · ' + days + ' días',
      ballState: 'prematch',
      marks: [
        { idx: 0, label: 'Grupos', isPassed: false, isCurrent: false, isFinalCurrent: false, leftPct: 0   },
        { idx: 1, label: '1/16',   isPassed: false, isCurrent: false, isFinalCurrent: false, leftPct: 20  },
        { idx: 2, label: '1/8',    isPassed: false, isCurrent: false, isFinalCurrent: false, leftPct: 40  },
        { idx: 3, label: '1/4',    isPassed: false, isCurrent: false, isFinalCurrent: false, leftPct: 60  },
        { idx: 4, label: '1/2',    isPassed: false, isCurrent: false, isFinalCurrent: false, leftPct: 80  },
        { idx: 5, label: 'Final',  isPassed: false, isCurrent: false, isFinalCurrent: false, leftPct: 100 }
      ]
    };
  }

  function _renderTriondaTimeline(p) {
    if (!p || !Array.isArray(p.marks)) {
      p = _defaultProgressForPreMundial({});
    }

    var pct = Math.max(0, Math.min(100, Number(p.pctGlobal || 0)));
    var ballPos = Math.max(0, Math.min(100, Number(p.ballPos || 0)));

    // B12-info-fixes: badge mid-Mundial muestra "{pct}% · {matchesPlayed}/104"
    // (el nombre de la fase ya aparece en la marca activa de la timeline).
    // Pre-Mundial (prematch / matchesPlayed=0) y Finalizado (matchesPlayed=104)
    // mantienen el badgeText canónico computado en data.js::getMundialProgress.
    var matchesPlayed = Number(p.matchesPlayed || 0);
    var badgeText = p.badgeText || '';
    if (p.ballState !== 'prematch' && p.ballState !== 'finished'
        && matchesPlayed > 0 && matchesPlayed < TOTAL_MATCHES) {
      badgeText = pct + '% · ' + matchesPlayed + '/' + TOTAL_MATCHES;
    }

    var ballClasses = 'timeline-ball';
    if (p.ballState === 'prematch') ballClasses += ' is-prematch';
    else if (p.ballState === 'finished') ballClasses += ' is-finished';

    var marksHtml = '';
    for (var i = 0; i < p.marks.length; i++) {
      var m = p.marks[i] || {};
      var leftPct = Math.max(0, Math.min(100, Number(m.leftPct || 0)));

      var markCls = 'timeline-mark';
      if (m.isPassed) markCls += ' is-passed';
      if (m.isFinalCurrent) markCls += ' is-final-current';

      var labelCls = 'timeline-mark-label';
      if (m.isPassed) labelCls += ' is-passed';
      if (m.isCurrent && !m.isFinalCurrent) labelCls += ' is-current';

      var labelContent = m.isFinalCurrent ? '🏆' : _esc(m.label || '');

      marksHtml +=
        '<span class="' + markCls + '" style="left:' + leftPct + '%">' +
          '<span class="' + labelCls + '">' + labelContent + '</span>' +
        '</span>';
    }

    return '' +
      '<div class="timeline">' +
        '<div class="timeline-track">' +
          '<div class="timeline-progress" style="width:' + pct + '%"></div>' +
          '<div class="timeline-marks">' +
            marksHtml +
          '</div>' +
          '<div class="' + ballClasses + '" style="left:' + ballPos + '%">' +
            '<div class="timeline-ball-glow"></div>' +
            '<img src="' + TRIONDA_URL + '" alt="Trionda" loading="lazy"/>' +
            '<div class="timeline-badge">' + _esc(badgeText) + '</div>' +
          '</div>' +
        '</div>' +
      '</div>';
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

  // B11-trionda: tile pre-Mundial con eyebrow "MUNDIAL 2026 · 11 JUN – 19 JUL"
  // (UX-1), rank-row con eyebrow "Tu rango" (UX-2) y timeline única con balón
  // Trionda en lugar de las 2 barras GRUPOS/ELIMINATORIAS (UX-3). Los datos
  // de progreso del Mundial vienen de state.mundialProgress (poblado por
  // mountPredShell tras getMundialProgress()); fallback síncrono usa
  // _defaultProgressForPreMundial(state).
  function _renderTilePreMundial(state) {
    var days = Math.max(0, Number(state.daysToKickoff || 0));
    var daysLabel = days <= 0 ? 'Mañana arranca' : ('Faltan ' + days + (days === 1 ? ' día' : ' días'));

    var gruposUser = Number(state.predicted || 0);
    var koUser = Number(state.koPredicted || 0);
    var doneAll = gruposUser + koUser;
    var pendingAll = Math.max(0, TOTAL_MATCHES - doneAll);

    // Chip Liga (gold-ghost). Lee state.league.position con fallback a .rank.
    var league = state.league || {};
    var leaguePos = Number(league.position || league.rank || 0);
    var leagueTotal = Number(league.total || 0);
    var ligaChipHtml;
    if (leagueTotal > 0) {
      ligaChipHtml = '<span class="fc-pred-tile__chip fc-pred-tile__chip--liga">' +
        leaguePos + 'º de ' + leagueTotal + ' · Liga</span>';
    } else {
      ligaChipHtml = '<span class="fc-pred-tile__chip fc-pred-tile__chip--liga">Líder · Liga</span>';
    }

    // Chip Global (neutro). Lee state.global.position con fallback a .rank.
    var glob = state.global || {};
    var globalPos = Number(glob.position || glob.rank || 0);
    var globalChipHtml;
    if (globalPos > 0) {
      globalChipHtml = '<span class="fc-pred-tile__chip fc-pred-tile__chip--global">' +
        globalPos + 'º · Global</span>';
    } else {
      globalChipHtml = '<span class="fc-pred-tile__chip fc-pred-tile__chip--global">— · Global</span>';
    }

    // Rank row (eyebrow + nombre + frase). Pre-Mundial todos a 0 pts → "Chupetín".
    var pts = Number(state.totalPts || state.pts || 0);
    var rank = { name: '—', phrase: '' };
    if (typeof window.getRank === 'function') {
      try {
        var r = window.getRank(pts);
        if (r && typeof r === 'object') {
          rank.name = r.name || '—';
          rank.phrase = r.phrase || '';
        }
      } catch (e) { /* defensivo */ }
    }
    var rankRowHtml =
      '<div class="fc-pred-tile__rank-row">' +
        '<span class="fc-pred-tile__rank-eyebrow">Tu rango</span>' +
        '<span class="fc-pred-tile__rank-name">' + _esc(rank.name) + '</span>' +
        (rank.phrase ? '<span class="fc-pred-tile__rank-phrase">"' + _esc(rank.phrase) + '"</span>' : '') +
      '</div>';

    // Timeline Trionda. Si state.mundialProgress aún no está poblado, fallback síncrono.
    var progress = state.mundialProgress || _defaultProgressForPreMundial(state);
    var timelineHtml = _renderTriondaTimeline(progress);

    var watermark = _buildWatermark();

    var footer =
      '<button type="button" class="fc-pred-tile__footer" aria-label="Ir a partidos pendientes">' +
        '<span class="fc-pred-tile__footer-flame" aria-hidden="true">🔥</span>' +
        '<span class="fc-pred-tile__footer-text">Te quedan ' + pendingAll +
          (pendingAll === 1 ? ' partido' : ' partidos') + ' por pronosticar</span>' +
        _buildChevron() +
      '</button>';

    return '' +
      '<div class="fc-pred-tile__body">' +
        watermark +
        '<div class="fc-pred-tile__rank-stack">' +
          ligaChipHtml +
          globalChipHtml +
        '</div>' +
        '<div class="fc-pred-tile__row fc-pred-tile__row--top">' +
          '<div class="fc-pred-tile__eyebrow">11 JUN – 19 JUL</div>' +
        '</div>' +
        '<div class="fc-pred-tile__hero">' +
          '<span class="fc-pred-tile__hero-emoji" aria-hidden="true">🏆</span>' +
          '<div class="fc-pred-tile__hero-text">' + _esc(daysLabel) + '</div>' +
        '</div>' +
        rankRowHtml +
        timelineHtml +
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
      // B11-trionda UX-4: quick-link eliminado. Navegación ya cubierta por
      // bottom-tabs. Filtros ocultos en pre-mundial.
      mount.innerHTML = '';
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
  // [B5] Trophy modal — reusa #modal genérico (ui-nav.js gestiona close)
  // ─────────────────────────────────────────────────────────────
  function _findPlayerByKey(key) {
    if (!key || typeof EQUIPOS === 'undefined' || !Array.isArray(EQUIPOS)) return null;
    for (var i = 0; i < EQUIPOS.length; i++) {
      var team = EQUIPOS[i];
      if (!team || !team.players) continue;
      for (var j = 0; j < team.players.length; j++) {
        if (team.players[j] && team.players[j].key === key) {
          return {
            teamName: team.name,
            teamFlag: team.flag,
            playerName: team.players[j].name
          };
        }
      }
    }
    return null;
  }

  function _openTrophyModal(awards, ctx) {
    var modalEl = document.getElementById('modal');
    if (!modalEl) return;

    awards = awards || {};
    ctx = ctx || {};

    // Cascada defensiva para localizar el content-wrap del #modal
    var contentWrap = modalEl.querySelector('.modal-content-wrap')
                   || modalEl.querySelector('.content-wrap')
                   || modalEl.querySelector('[data-modal-content]');

    if (!contentWrap) {
      var inner = modalEl.querySelector('.modal-inner');
      if (!inner) return;
      contentWrap = inner.querySelector('.fc-pred-trophy-modal__inject');
      if (!contentWrap) {
        contentWrap = document.createElement('div');
        contentWrap.className = 'fc-pred-trophy-modal__inject';
        inner.appendChild(contentWrap);
      }
    }

    contentWrap.innerHTML = _renderTrophyContent(awards, ctx);
    modalEl.classList.add('open');

    var root = contentWrap.querySelector('.fc-pred-trophy-modal');
    if (root && ctx.porraAbierta && typeof ctx.onChangeAward === 'function') {
      root.addEventListener('click', function (ev) {
        var btn = ev.target && ev.target.closest && ev.target.closest('[data-award-change]');
        if (!btn) return;
        ev.preventDefault();
        var awardKey = btn.getAttribute('data-award-change');
        if (awardKey) ctx.onChangeAward(awardKey);
      });
    }
  }

  function _renderTrophyContent(awards, ctx) {
    var leagueName = (ctx && ctx.league && ctx.league.name) ? ctx.league.name : '';

    var svgTrophy = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M8 21h8M12 17v4M7 4h10v5a5 5 0 0 1-10 0V4z"/><path d="M17 5h3v3a3 3 0 0 1-3 3M7 5H4v3a3 3 0 0 0 3 3"/></svg>';
    var svgBoot   = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 17V6h6v6h6a4 4 0 0 1 4 4v1H4z"/><path d="M8 9h2M8 12h2"/></svg>';
    var svgGlove  = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M7 21V10a2 2 0 1 1 4 0V4a2 2 0 1 1 4 0v8h2a2 2 0 0 1 2 2v3a4 4 0 0 1-4 4z"/></svg>';
    var svgYoung  = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 21V11"/><path d="M12 11c0-3 2-5 5-5-1 3-2 5-5 5z"/><path d="M12 13c0-3-2-5-5-5 1 3 2 5 5 5z"/></svg>';

    var items = [
      _renderAwardItem('golden_ball',  'Balón de Oro',           svgTrophy, awards.golden_ball,  ctx),
      _renderAwardItem('golden_boot',  'Bota de Oro',            svgBoot,   awards.golden_boot,  ctx),
      _renderAwardItem('golden_glove', 'Guante de Oro',          svgGlove,  awards.golden_glove, ctx),
      _renderAwardItem('young_player', 'Mejor Joven (≤21)', svgYoung,  awards.young_player, ctx)
    ].join('');

    return '' +
      '<div class="fc-pred-trophy-modal" role="dialog" aria-label="Mis premios individuales">' +
        '<header class="fc-pred-trophy-modal__head">' +
          '<h2 class="fc-pred-trophy-modal__title">Mis premios individuales</h2>' +
          (leagueName ? '<p class="fc-pred-trophy-modal__subtitle">Liga: ' + _esc(leagueName) + '</p>' : '') +
        '</header>' +
        '<ul class="fc-pred-trophy-modal__list">' + items + '</ul>' +
      '</div>';
  }

  function _renderAwardItem(awardKey, awardLabel, awardIconSvg, playerKey, ctx) {
    var info = _findPlayerByKey(playerKey);
    var canEdit = !!(ctx && ctx.porraAbierta);

    var pickHtml;
    if (info) {
      var flag = info.teamFlag ? '<span class="fc-pred-trophy-modal__flag">' + _esc(info.teamFlag) + '</span>' : '';
      pickHtml = '' +
        '<div class="fc-pred-trophy-modal__pick">' +
          '<span class="fc-pred-trophy-modal__player">' + _esc(info.playerName) + '</span>' +
          '<span class="fc-pred-trophy-modal__sep">·</span>' +
          flag +
          '<span class="fc-pred-trophy-modal__team">' + _esc(info.teamName) + '</span>' +
        '</div>';
    } else {
      pickHtml = '<div class="fc-pred-trophy-modal__pick fc-pred-trophy-modal__pick--empty">— sin elegir —</div>';
    }

    var changeBtn = canEdit
      ? '<button type="button" class="fc-pred-trophy-modal__change" data-award-change="' + awardKey + '">Cambiar</button>'
      : '';

    return '' +
      '<li class="fc-pred-trophy-modal__item" data-award="' + awardKey + '">' +
        '<div class="fc-pred-trophy-modal__row">' +
          '<span class="fc-pred-trophy-modal__icon" aria-hidden="true">' + awardIconSvg + '</span>' +
          '<span class="fc-pred-trophy-modal__label">' + _esc(awardLabel) + '</span>' +
        '</div>' +
        '<div class="fc-pred-trophy-modal__row fc-pred-trophy-modal__row--bottom">' +
          pickHtml +
          changeBtn +
        '</div>' +
      '</li>';
  }

  // ─────────────────────────────────────────────────────────────
  // [B6] Entry point — mountPredShell()
  //
  // Llamado desde ui-nav.js::showPage('predictor') tras hacer visible
  // #page-predictor. Lee stores existentes (predictions, ko_predictions,
  // award_picks, EQUIPOS, iaPredictions, currentUser, _porraCerrada,
  // currentLeague) y compone state para los 5 renders.
  //
  // Mientras estamos pre-Mundial (today < KICKOFF), forzamos mode
  // 'pre-mundial' independiente del estado de la porra. La transición
  // a 'groups'/'ko*'/'finalizado' es trabajo de F7.7 sesiones futuras
  // (datos reales 11 jun) — el shell ya lo soporta.
  // ─────────────────────────────────────────────────────────────
  function _detectModeFromCalendar() {
    var now = Date.now();
    if (now < _KICKOFF_TS) return 'pre-mundial';
    // Post-kickoff: por ahora groups (transición fina KO/finalizado en
    // sesión futura cuando arranque el Mundial; A5 lo deja explícito).
    return 'groups';
  }

  function _daysToKickoff() {
    var diffMs = _KICKOFF_TS - Date.now();
    if (diffMs <= 0) return 0;
    return Math.ceil(diffMs / (1000 * 60 * 60 * 24));
  }

  function _countPredictionsHechas() {
    if (typeof predictions !== 'object' || !predictions) return 0;
    var n = 0;
    for (var k in predictions) {
      if (Object.prototype.hasOwnProperty.call(predictions, k)
          && predictions[k] && predictions[k].saved) n++;
    }
    return n;
  }

  // B9-redesign: cuenta KO predictions del user en la liga visualizada.
  // koPredictions es global poblado por auth.js; saved=true marca persistencia
  // confirmada. Las claves duplicadas number/string colapsan al mismo property
  // (JS coerciona a string), no hay riesgo de doble conteo.
  function _countKOPredictionsHechas() {
    if (typeof koPredictions !== 'object' || !koPredictions) return 0;
    var n = 0;
    for (var k in koPredictions) {
      if (Object.prototype.hasOwnProperty.call(koPredictions, k)
          && koPredictions[k] && koPredictions[k].saved) n++;
    }
    return n;
  }

  // B9-redesign: cuenta miembros de la liga activa.
  // _myLeagues (leagues.js) NO trae memberCount. _activeLeague tampoco. Como
  // el query asíncrono complicaría el render, devolvemos 0 por defecto y
  // el chip cae al fallback "Líder" hasta que B10/sesión futura wire el
  // member count tras un fetch en leagueSelect. Sub-decisión documentada.
  function _getLeagueMemberCount() {
    var lg = window._activeLeague || (typeof currentLeague === 'object' ? currentLeague : null);
    if (!lg) return 0;
    if (typeof lg.memberCount === 'number') return lg.memberCount;
    if (Array.isArray(lg.members)) return lg.members.length;
    return 0;
  }

  function _computeStateForCurrentPage() {
    var mode = _detectModeFromCalendar();
    var predicted = _countPredictionsHechas();
    var koPredicted = _countKOPredictionsHechas();
    var pendingTotal = Math.max(0, _TILE_TOTAL_GROUP - predicted);
    var memberCount = _getLeagueMemberCount();

    // B10-traceability: lee window._predictorRanking poblado por
    // loadPredictorRankingData() en data.js (vistas SQL). Si no está cargado
    // todavía (primera render antes de async resolve), cae al fallback
    // (memberCount inferido de _activeLeague + globalRank=0).
    var ranking = window._predictorRanking || null;
    var leagueMembersFinal = ranking ? Number(ranking.leagueMembers || 0) : memberCount;
    var leagueRankFinal = ranking ? Number(ranking.leagueRank || 0)
                                  : (memberCount > 0 ? 1 : 0);
    var globalRankFinal = ranking ? Number(ranking.globalRank || 0) : 0;
    var globalTotalFinal = ranking ? Number(ranking.globalTotal || 0) : 0;
    var totalPts = (typeof totalPoints === 'number') ? totalPoints : 0;

    var st = {
      mode: mode,
      jornada: null,
      // Tile
      pts: totalPts,
      totalPts: totalPts,
      // En pre-Mundial todos empatados a 0 → user es 1º. Mid-Mundial leerá
      // del cache real (sprint B11 user_points_cache).
      league: {
        rank: leagueRankFinal,        // alias compat
        position: leagueRankFinal,    // nuevo nombre canónico
        total: leagueMembersFinal
      },
      global: {
        rank: globalRankFinal,        // alias compat
        position: globalRankFinal,
        total: globalTotalFinal,
        delta: null
      },
      pendingToday: 0,                   // pendientes B6+: hoy real
      pendingTotal: pendingTotal,
      predicted: predicted,
      koPredicted: koPredicted,
      total: _TILE_TOTAL_GROUP,
      daysToKickoff: _daysToKickoff(),
      // B11-trionda: progress del Mundial (poblado por mountPredShell tras
      // getMundialProgress() async). Si null → render usa fallback.
      mundialProgress: window._mundialProgress || null,
      // Stats
      aciertosPct: null,
      racha: null,
      bonusIa: 0,
      // Filters
      todayCount: 0,
      activeFilter: _state.activeFilter,
      // List (vacío en pre-mundial)
      matches: [],
      // Callbacks
      onFooterTap: function () {
        // B9-redesign: si los 72 grupos están completos pero faltan KO,
        // mandar a Fase final; si no, a Grupos.
        var goElim = (predicted >= _TILE_TOTAL_GROUP) && (koPredicted < 32);
        if (typeof showPage === 'function') showPage(goElim ? 'elim' : 'grupos');
      },
      onTrophyTap: function () {
        var awards = (typeof awardPicks === 'object' && awardPicks) ? awardPicks : {};
        var leagueObj = (typeof currentLeague === 'object' && currentLeague)
          ? { name: currentLeague.nombre || '' } : { name: '' };
        var ctx = {
          porraAbierta: !window._porraCerrada,
          league: leagueObj,
          onChangeAward: null,  // C5/futuro flow award_picks
          onClose: null
        };
        _openTrophyModal({
          golden_ball:  awards.golden_ball  || null,
          golden_boot:  awards.golden_boot  || null,
          golden_glove: awards.golden_glove || null,
          young_player: awards.young_player || null
        }, ctx);
      },
      onFilterChange: function (key) {
        _state.activeFilter = key;
        // Re-render solo de la lista — Tile/Stats/Header no cambian
        // por filter.
        _renderList(_computeStateForCurrentPage());
      },
      onQuickLink: function (target) {
        if (typeof showPage === 'function') showPage(target);
      }
    };
    return st;
  }

  function mountPredShell() {
    if (!document.getElementById('page-predictor')) return;
    // Render inicial inmediato con datos cacheados (o fallback).
    var st = _computeStateForCurrentPage();
    _renderHeader(st);
    _renderTile(st);
    _renderStats(st);
    _renderFilters(st);
    _renderList(st);

    // B10-traceability: kickoff async para llenar window._predictorRanking
    // (chips Liga + Global con datos reales). Tras resolver, re-render
    // de Tile + Filters (los únicos que dependen del ranking).
    if (typeof window.loadPredictorRankingData === 'function') {
      window.loadPredictorRankingData().then(function (ranking) {
        if (!ranking) return;
        var st2 = _computeStateForCurrentPage();
        _renderTile(st2);
        _renderFilters(st2);
      }).catch(function (err) {
        console.warn('[predictor] loadPredictorRankingData failed', err);
      });
    }

    // B11-trionda: kickoff async para llenar window._mundialProgress
    // (timeline con balón Trionda). Tras resolver, re-render solo del
    // Tile (es el único que consume mundialProgress).
    if (typeof window.getMundialProgress === 'function') {
      window.getMundialProgress().then(function (progress) {
        if (!progress) return;
        window._mundialProgress = progress;
        var st3 = _computeStateForCurrentPage();
        _renderTile(st3);
      }).catch(function (err) {
        console.warn('[predictor] getMundialProgress failed', err);
      });
    }
  }

  // ─────────────────────────────────────────────────────────────
  // EXPOSICIÓN
  // ─────────────────────────────────────────────────────────────
  window.PorraPred = window.PorraPred || {};
  window.PorraPred.mount = mountPredShell;
  window.PorraPred._renderTile = _renderTile;
  window.PorraPred._renderHeader = _renderHeader;
  window.PorraPred._renderStats = _renderStats;
  window.PorraPred._renderFilters = _renderFilters;
  window.PorraPred._renderList = _renderList;
  window.PorraPred._openTrophyModal = _openTrophyModal;
  window.PorraPred._computeAciertos = _computeAciertos;
  window.PorraPred._computeStreak = _computeStreak;
  window.PorraPred._subtitleFromMode = _subtitleFromMode;
  window.PorraPred._state = _state;
  // Compatibilidad con la convención del repo (window.mountPredShell).
  window.mountPredShell = mountPredShell;

})();
