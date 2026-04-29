/* F7.X · Shell visual de #page-elim (Fase final).
   Entry: renderElimShell(). Lee progress de PARTIDOS/predictions/BRACKET/
   koPredictions. NO duplica stores; NO toca scoring.js ni la lógica IA.
   Sub-vistas KO antiguas (view-bracket/stadium/bracket-results) y
   #finalizar-section quedan en DOM ocultas — recuperadas en sprints
   posteriores (Bracket / Perfil-Cierre).

   F7.X.2: PorraHeader + PhaseStepper.
   F7.X.3: ElimRow + ElimExpanded (lista 6 filas KO con carrusel).
   F7.X.4: wiring (showPage + main-entry + shell variant).
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

  // Lista de filas (6 entradas separando 'final' del stepper en third + final).
  // bracketBucket = clave en BRACKET (ko.js). Locking cascade gestionado en
  // _renderList (depende de bracketBucket de la fila previa).
  var _PHASE_ROWS = [
    { key: 'ko16',  shortLabel: '1/16',  label: '1/16',    bracketBucket: 'r32',   total: 16 },
    { key: 'ko8',   shortLabel: '1/8',   label: '1/8',     bracketBucket: 'r16',   total: 8  },
    { key: 'ko4',   shortLabel: '1/4',   label: '1/4',     bracketBucket: 'qf',    total: 4  },
    { key: 'sf',    shortLabel: 'SF',    label: 'Semis',   bracketBucket: 'sf',    total: 2  },
    { key: 'third', shortLabel: '3º-4º', label: '3º y 4º', bracketBucket: 'third', total: 1  },
    { key: 'final', shortLabel: 'F',     label: 'Final',   bracketBucket: 'final', total: 1  }
  ];

  // ─────────────────────────────────────────────────────────────
  // HELPERS
  // ─────────────────────────────────────────────────────────────
  function _doneInBucket(bucketName) {
    if (typeof BRACKET !== 'object' || typeof koPredictions !== 'object') return 0;
    if (!BRACKET[bucketName]) return 0;
    var arr = BRACKET[bucketName];
    var d = 0;
    for (var i = 0; i < arr.length; i++) {
      var pred = koPredictions[arr[i].id] || koPredictions[String(arr[i].id)];
      if (pred && pred.saved) d++;
    }
    return d;
  }

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
    var stepperBucketMap = { ko16: 'r32', ko8: 'r16', ko4: 'qf', sf: 'sf', final: 'final' };
    var bucket = stepperBucketMap[key];
    if (!bucket) return 0;
    var done = _doneInBucket(bucket);
    // Stepper 'final' suma Final + 3º/4º (total 2).
    if (key === 'final') done += _doneInBucket('third');
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
  // ─────────────────────────────────────────────────────────────
  // ELIM ROW (F7.X.3 — subagent A, integrado)
  // ─────────────────────────────────────────────────────────────
  function _renderElimRow(props) {
    var row = document.createElement('div');
    row.className = 'fc-elim-row';

    if (props.locked) {
      row.classList.add('is-locked');
    } else if (props.done === props.total && props.total > 0) {
      row.classList.add('is-complete');
    } else if (props.done > 0 && props.done < props.total) {
      row.classList.add('is-progress');
    }
    if (props.expanded) row.classList.add('is-expanded');

    var bar = document.createElement('div');
    bar.className = 'fc-elim-row__bar';

    var text = document.createElement('div');
    text.className = 'fc-elim-row__text';
    var eyebrow = document.createElement('div');
    eyebrow.className = 'fc-elim-row__eyebrow';
    eyebrow.textContent = props.shortLabel;
    var label = document.createElement('div');
    label.className = 'fc-elim-row__label';
    label.textContent = props.label;
    var sub = document.createElement('div');
    sub.className = 'fc-elim-row__sub';
    sub.textContent = props.total + ' partido' + (props.total === 1 ? '' : 's');
    text.appendChild(eyebrow);
    text.appendChild(label);
    text.appendChild(sub);

    var diceBtn = null;
    if (!props.locked) {
      diceBtn = document.createElement('button');
      diceBtn.type = 'button';
      diceBtn.className = 'fc-elim-dice-btn';
      diceBtn.textContent = '🎲';
      diceBtn.addEventListener('click', function (e) {
        e.stopPropagation();
        if (typeof props.onDice === 'function') props.onDice();
        else if (typeof diceSimulateAllKO === 'function') diceSimulateAllKO();
      });
    }

    var side = document.createElement('div');
    side.className = 'fc-elim-row__side';

    if (props.locked) {
      var lockLabel = document.createElement('span');
      lockLabel.style.cssText = 'font-size:9px;letter-spacing:.06em;color:rgba(255,255,255,.45);text-transform:uppercase';
      lockLabel.textContent = '🔒 BLOQUEADO';
      side.appendChild(lockLabel);
    }
    var counter = document.createElement('span');
    counter.className = 'fc-elim-row__counter';
    counter.textContent = props.locked ? ('—/' + props.total) : (props.done + '/' + props.total);
    side.appendChild(counter);

    var progress = document.createElement('div');
    progress.className = 'fc-elim-row__progress';
    var fill = document.createElement('i');
    var pct = props.locked ? 0 : Math.min(100, Math.floor((props.done / props.total) * 100));
    fill.style.width = pct + '%';
    progress.appendChild(fill);
    side.appendChild(progress);

    row.appendChild(bar);
    row.appendChild(text);
    if (diceBtn) row.appendChild(diceBtn);
    row.appendChild(side);

    if (!props.locked && typeof props.onToggle === 'function') {
      row.addEventListener('click', function () { props.onToggle(props.key); });
    }
    return row;
  }

  // ─────────────────────────────────────────────────────────────
  // ELIM EXPANDED (F7.X.3 — subagent B, integrado, escape fix)
  // ─────────────────────────────────────────────────────────────
  function _renderElimExpanded(props) {
    var container = document.createElement('div');
    container.className = 'fc-elim-expanded';

    if (!props || !Array.isArray(props.matches) || props.matches.length === 0) {
      var empty = document.createElement('div');
      empty.style.cssText = 'padding:14px 16px;color:#7A8194;font-size:12px';
      empty.textContent = 'Sin partidos disponibles';
      container.appendChild(empty);
      return container;
    }

    var header = document.createElement('div');
    header.className = 'fc-elim-expanded__header';
    var title = document.createElement('div');
    title.className = 'fc-elim-expanded__title';
    var currentIdx = 0;
    function updateTitle() {
      // textContent es seguro contra XSS — no necesita escapeHtml.
      title.textContent = 'Fase ' + props.label + ' · ' + (currentIdx + 1) + '/' + props.matches.length;
    }
    updateTitle();

    var rightSide = document.createElement('div');
    rightSide.style.cssText = 'display:flex;align-items:center;gap:8px';

    var diceBtn = document.createElement('button');
    diceBtn.type = 'button';
    diceBtn.className = 'fc-elim-dice-btn';
    diceBtn.textContent = '🎲';
    diceBtn.addEventListener('click', function () {
      if (typeof diceSimulateAllKO === 'function') diceSimulateAllKO();
    });
    rightSide.appendChild(diceBtn);

    if (props.complete === true) {
      var badge = document.createElement('span');
      badge.className = 'fc-elim-expanded__badge-complete';
      badge.textContent = 'COMPLETO ✓';
      rightSide.appendChild(badge);
    }
    header.appendChild(title);
    header.appendChild(rightSide);
    container.appendChild(header);

    var wrapper = document.createElement('div');
    wrapper.style.position = 'relative';
    var carousel = document.createElement('div');
    carousel.className = 'fc-elim-carousel';

    var slides = [];
    props.matches.forEach(function (match, idx) {
      var slide = document.createElement('div');
      slide.className = 'fc-elim-carousel__slide';
      if (idx === 0) slide.classList.add('is-current');
      if (typeof buildKOCard === 'function') {
        var card = buildKOCard(match, 'normal');
        if (card) slide.appendChild(card);
      }
      carousel.appendChild(slide);
      slides.push(slide);
    });
    wrapper.appendChild(carousel);

    if (props.matches.length > 1) {
      var slideGap = 10;
      var slideWidth = 0;
      var dots = [];

      function applyCurrent(newIdx) {
        if (newIdx === currentIdx) return;
        currentIdx = newIdx;
        slides.forEach(function (s, i) {
          if (i === currentIdx) s.classList.add('is-current'); else s.classList.remove('is-current');
        });
        dots.forEach(function (d, i) {
          if (i === currentIdx) d.classList.add('is-current'); else d.classList.remove('is-current');
        });
        updateTitle();
      }

      var leftArrow = document.createElement('button');
      leftArrow.type = 'button';
      leftArrow.className = 'fc-elim-arrow fc-elim-arrow--left';
      leftArrow.textContent = '‹';
      leftArrow.addEventListener('click', function () {
        var n = Math.max(0, currentIdx - 1);
        carousel.scrollTo({ left: n * (slideWidth + slideGap), behavior: 'smooth' });
        applyCurrent(n);
      });
      wrapper.appendChild(leftArrow);

      var rightArrow = document.createElement('button');
      rightArrow.type = 'button';
      rightArrow.className = 'fc-elim-arrow fc-elim-arrow--right';
      rightArrow.textContent = '›';
      rightArrow.addEventListener('click', function () {
        var n = Math.min(props.matches.length - 1, currentIdx + 1);
        carousel.scrollTo({ left: n * (slideWidth + slideGap), behavior: 'smooth' });
        applyCurrent(n);
      });
      wrapper.appendChild(rightArrow);

      var dotsContainer = document.createElement('div');
      dotsContainer.className = 'fc-elim-dots';
      props.matches.forEach(function (_, idx) {
        var dot = document.createElement('span');
        dot.className = 'fc-elim-dots__dot';
        if (idx === 0) dot.classList.add('is-current');
        dotsContainer.appendChild(dot);
        dots.push(dot);
      });
      wrapper.appendChild(dotsContainer);

      var rafId = null;
      carousel.addEventListener('scroll', function () {
        if (rafId !== null) cancelAnimationFrame(rafId);
        rafId = requestAnimationFrame(function () {
          if (slideWidth === 0 && slides[0]) {
            slideWidth = slides[0].getBoundingClientRect().width;
          }
          if (slideWidth > 0) {
            var newIdx = Math.round(carousel.scrollLeft / (slideWidth + slideGap));
            if (newIdx >= 0 && newIdx < props.matches.length) applyCurrent(newIdx);
          }
        });
      });

      // Medir slideWidth tras layout
      requestAnimationFrame(function measure() {
        if (slides[0]) {
          var rect = slides[0].getBoundingClientRect();
          if (rect.width > 0) { slideWidth = rect.width; return; }
          requestAnimationFrame(measure);
        }
      });
    }

    container.appendChild(wrapper);
    return container;
  }

  // ─────────────────────────────────────────────────────────────
  // LISTA — orquesta 6 ElimRow + ElimExpanded condicional
  // ─────────────────────────────────────────────────────────────
  function _renderList() {
    var mount = document.getElementById('fc-elim-list');
    if (!mount) return;
    mount.innerHTML = '';

    if (typeof BRACKET !== 'object') return;

    var gruposDone = _phaseDone('grupos');

    for (var i = 0; i < _PHASE_ROWS.length; i++) {
      var r = _PHASE_ROWS[i];
      var done = _doneInBucket(r.bracketBucket);

      // Cascada de bloqueo: ko16 depende de grupos=72; resto depende del bucket
      // de la fila anterior estando completo. Excepción: third Y final ambos
      // dependen de sf=2 (no encadenados entre sí).
      var locked;
      if (r.key === 'ko16')      locked = gruposDone < 72;
      else if (r.key === 'third' || r.key === 'final') locked = _doneInBucket('sf') < 2;
      else {
        var prev = _PHASE_ROWS[i - 1];
        locked = _doneInBucket(prev.bracketBucket) < prev.total;
      }

      var rowEl = _renderElimRow({
        key: r.key,
        shortLabel: r.shortLabel,
        label: r.label,
        total: r.total,
        done: done,
        locked: locked,
        expanded: _state.expandedPhase === r.key,
        onToggle: function (key) {
          _state.expandedPhase = (_state.expandedPhase === key) ? null : key;
          renderElimShell();
        }
      });
      mount.appendChild(rowEl);

      if (_state.expandedPhase === r.key && !locked) {
        var matches = (BRACKET[r.bracketBucket] || []).slice();
        var expEl = _renderElimExpanded({
          key: r.key,
          label: r.label,
          matches: matches,
          complete: done === r.total && r.total > 0
        });
        mount.appendChild(expEl);
      }
    }
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
        // Stepper key → row key (final stepper expande row 'final';
        // 'third' solo accesible vía click directo en su fila).
        _state.expandedPhase = key;
        renderElimShell();
      }
    });

    _renderList();
  }

  window.renderElimShell = renderElimShell;
  window._elimShellState = _state; // expuesto para debug
})();
