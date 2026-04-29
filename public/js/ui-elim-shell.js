/* F7.X · Shell visual de #page-elim (Fase final).
   Entry: renderElimShell(). Lee progress de PARTIDOS/predictions/BRACKET/
   koPredictions. NO duplica stores; NO toca scoring.js ni la lógica IA.
   Sub-vistas KO antiguas (view-bracket/stadium/bracket-results) y
   #finalizar-section quedan en DOM ocultas — recuperadas en sprints
   posteriores (Bracket / Perfil-Cierre).

   F7.X.2: PorraHeader + PhaseStepper.
   F7.X.3: ElimRow + ElimExpanded (lista 6 filas KO con carrusel).
*/
(function () {

  // ─────────────────────────────────────────────────────────────
  // ESTADO
  // ─────────────────────────────────────────────────────────────
  var _state = {
    active: 'ko16',          // paso seleccionado del stepper (no 'grupos')
    expandedPhase: null      // phase key expandida en la lista (null = ninguna)
  };

  var _PHASES = [
    { key: 'grupos', label: 'Grupos', total: 72 },
    { key: 'ko16',   label: '1/16',   total: 16 },
    { key: 'ko8',    label: '1/8',    total: 8  },
    { key: 'ko4',    label: '1/4',    total: 4  },
    { key: 'sf',     label: 'Semis',  total: 2  },
    { key: 'final',  label: 'Final',  total: 2  }
  ];

  // ─────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────
  function _phaseDone(key) {
    if (key === 'grupos') {
      if (typeof PARTIDOS !== 'object' || typeof predictions !== 'object') return 0;
      var n = 0;
      for (var i = 0; i < PARTIDOS.length; i++) {
        var k = (typeof getMatchKey === 'function') ? getMatchKey(PARTIDOS[i]) : null;
        if (k && predictions[k] && predictions[k].saved) n++;
      }
      return n;
    }
    if (typeof BRACKET !== 'object' || typeof koPredictions !== 'object') return 0;
    var bucket = ({ ko16: 'r32', ko8: 'r16', ko4: 'qf', sf: 'sf', final: 'final' })[key];
    if (!bucket || !BRACKET[bucket]) return 0;
    var arr = BRACKET[bucket];
    var done = 0;
    for (var j = 0; j < arr.length; j++) {
      var pred = koPredictions[arr[j].id] || koPredictions[String(arr[j].id)];
      if (pred && pred.saved) done++;
    }
    // Final agrupa Final + 3º/4º (2 partidos totales). 'final' bucket en BRACKET
    // típicamente solo es la final; sumamos third si existe.
    if (key === 'final' && BRACKET.third) {
      for (var t = 0; t < BRACKET.third.length; t++) {
        var tp = koPredictions[BRACKET.third[t].id] || koPredictions[String(BRACKET.third[t].id)];
        if (tp && tp.saved) done++;
      }
    }
    return done;
  }

  function _computeProgress() {
    var out = {};
    for (var i = 0; i < _PHASES.length; i++) {
      var p = _PHASES[i];
      out[p.key] = { done: _phaseDone(p.key), total: p.total };
    }
    return out;
  }

  function _getSubtitle() {
    var item = _PHASES.find(function (p) { return p.key === _state.active; });
    return item ? ('Eliminatorias · ' + item.label) : 'Eliminatorias';
  }

  function _totalPoints() {
    if (typeof totalPoints === 'number') return totalPoints;
    if (typeof window.totalPoints === 'number') return window.totalPoints;
    return 0;
  }

  // ─────────────────────────────────────────────────────────────
  // PORRA HEADER (F7.X.2 — subagent A, integrado y alineado a CSS)
  // ─────────────────────────────────────────────────────────────
  function _renderPorraHeader(state) {
    var mount = document.getElementById('fc-elim-header');
    if (!mount) return;

    var backIcon = (typeof window.getIcon === 'function') ? window.getIcon('back') : '';
    if (!backIcon) backIcon = '←';

    var isAdmin = !!(window.currentUser && window.currentUser.is_admin);
    var adminBadgeHtml = isAdmin
      ? '<span class="fc-elim-header__admin-badge">ADMIN</span>'
      : '';

    var cuadroActiveClass = state.activeAction === 'cuadro' ? ' is-active' : '';
    var premiosActiveClass = state.activeAction === 'premios' ? ' is-active' : '';
    var cuadroDisabled = !state.onCuadro ? ' style="cursor:not-allowed;opacity:.5"' : '';
    var premiosDisabled = !state.onPremios ? ' style="cursor:not-allowed;opacity:.5"' : '';

    var sub = (typeof escapeHtml === 'function')
      ? escapeHtml(state.subtitle || '')
      : (state.subtitle || '');

    mount.innerHTML =
      '<div class="fc-elim-header__top">' +
        '<button class="fc-elim-header__back" type="button">' + backIcon + ' Inicio</button>' +
        '<div class="fc-elim-header__brand">' +
          '<div class="fc-elim-header__brand-title">Porra Mundial 2026</div>' +
          '<div class="fc-elim-header__brand-sub">' + sub + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="fc-elim-header__actions">' +
        '<button class="fc-elim-header__action fc-elim-header__action--cuadro' + cuadroActiveClass + '" type="button"' + cuadroDisabled + '>Cuadro oficial</button>' +
        '<button class="fc-elim-header__action fc-elim-header__action--premios' + premiosActiveClass + '" type="button"' + premiosDisabled + '>Premios</button>' +
      '</div>' +
      '<div class="fc-elim-header__points">' +
        'Puntos: <strong>' + Math.floor(state.points || 0) + '</strong>' +
        adminBadgeHtml +
      '</div>';

    var backBtn = mount.querySelector('.fc-elim-header__back');
    if (backBtn) backBtn.addEventListener('click', function () { showPage('welcome'); });

    if (state.onCuadro) {
      var cuadroBtn = mount.querySelector('.fc-elim-header__action--cuadro');
      if (cuadroBtn) cuadroBtn.addEventListener('click', state.onCuadro);
    }
    if (state.onPremios) {
      var premiosBtn = mount.querySelector('.fc-elim-header__action--premios');
      if (premiosBtn) premiosBtn.addEventListener('click', state.onPremios);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // PHASE STEPPER (F7.X.2 — subagent B, integrado)
  // ─────────────────────────────────────────────────────────────
  function _renderPhaseStepper(state) {
    var container = document.getElementById('fc-elim-stepper');
    if (!container) return;

    var progress = state.progress || {};
    var html = '';

    for (var i = 0; i < _PHASES.length; i++) {
      var phase = _PHASES[i];
      var pp = progress[phase.key] || { done: 0, total: phase.total };
      var done = pp.done;
      var total = pp.total;

      var isLocked = false;
      if (phase.key !== 'grupos') {
        var prev = _PHASES[i - 1];
        var prevP = progress[prev.key] || { done: 0, total: prev.total };
        isLocked = prevP.done < prevP.total;
      }
      var isActive = state.active === phase.key;
      var isComplete = done === total && total > 0;

      var classes = 'fc-elim-stepper__item';
      if (isActive)        classes += ' is-active';
      else if (isLocked)   classes += ' is-locked';
      else if (isComplete) classes += ' is-complete';

      var lbl = (typeof escapeHtml === 'function') ? escapeHtml(phase.label) : phase.label;
      html += '<button class="' + classes + '" type="button" data-phase="' + phase.key + '">' +
                '<span class="fc-elim-stepper__label">' + lbl + '</span>';
      if (isLocked) {
        html += '<span class="fc-elim-stepper__lock">🔒</span>' +
                '<span class="fc-elim-stepper__counter">—/' + total + '</span>';
      } else {
        html += '<span class="fc-elim-stepper__counter">' + done + '/' + total + '</span>';
      }
      html += '</button>';

      if (i < _PHASES.length - 1) {
        html += '<span class="fc-elim-stepper__sep" aria-hidden="true">›</span>';
      }
    }
    container.innerHTML = html;

    container.querySelectorAll('.fc-elim-stepper__item').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var key = btn.getAttribute('data-phase');
        var locked = btn.classList.contains('is-locked');
        if (key === 'grupos') {
          showPage('grupos');
          return;
        }
        if (locked) return;
        if (typeof state.onSelectPhase === 'function') state.onSelectPhase(key);
      });
    });
  }

  // ─────────────────────────────────────────────────────────────
  // ENTRY
  // ─────────────────────────────────────────────────────────────
  function renderElimShell() {
    var progress = _computeProgress();

    _renderPorraHeader({
      points: _totalPoints(),
      subtitle: _getSubtitle(),
      activeAction: null,
      onCuadro: null,
      onPremios: null
    });

    _renderPhaseStepper({
      active: _state.active,
      progress: progress,
      onSelectPhase: function (key) {
        _state.active = key;
        _state.expandedPhase = key;
        renderElimShell();
      }
    });

    // F7.X.3: render lista #fc-elim-list (ElimRow + ElimExpanded).
    // De momento mount queda vacío.
  }

  window.renderElimShell = renderElimShell;
  window._elimShellState = _state; // expuesto para debug
})();
