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
  // EXPOSICIÓN PARCIAL (B6 wirea el entry point completo)
  // ─────────────────────────────────────────────────────────────
  window.PorraPred = window.PorraPred || {};
  window.PorraPred._renderTile = _renderTile;
  window.PorraPred._state = _state;

})();
