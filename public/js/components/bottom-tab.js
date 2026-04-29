(function() {
  var _tabDefs = [
    { id: 'grupos',    label: 'Grupos',    icon: 'grupos',    route: 'grupos' },
    { id: 'jornada',   label: 'Jornada',   icon: 'jornada',   route: 'jornada' },
    { id: 'directo',   label: 'Directo',   icon: 'directo',   route: 'directo' },
    { id: 'elim',      label: 'Fase final', icon: 'elim',     route: 'elim' },
    { id: 'predictor', label: 'Predictor', icon: 'predictor', route: 'predictor' }
  ];

  // F7.X.8: gate modal "Fase final bloqueada" RETIRADO. El PhaseStepper del
  // shell #page-elim ya comunica visualmente el bloqueo cascada (estado
  // is-locked + 🔒 + counter '—/N'). UX más fluida sin modal interruptivo.
  // window.fcGateModalClose se conserva como no-op para no romper handlers
  // antiguos (ej. botón inline en #fc-gate-modal del index.html).
  window.fcGateModalClose = function () {
    var modal = document.getElementById('fc-gate-modal');
    if (modal) modal.classList.remove('open');
  };

  function renderBottomTab(activePage) {
    var mount = document.getElementById('fc-tabbar-mount');
    if (!mount || mount.dataset.rendered === '1') {
      fcMarkActiveTab(activePage);
      return;
    }
    var html = '<nav class="fc-tabbar" role="navigation" aria-label="Navegación principal">';
    _tabDefs.forEach(function(t) {
      var ico = (typeof window.getIcon === 'function') ? window.getIcon(t.icon) : '';
      html += '<button class="fc-tabbar__item" type="button" data-tab="' + t.id + '" aria-label="' + t.label + '">'
            +   '<span class="fc-tabbar__icon">' + ico + '</span>'
            +   '<span class="fc-tabbar__label">' + t.label + '</span>'
            + '</button>';
    });
    html += '</nav>';
    mount.innerHTML = html;
    mount.dataset.rendered = '1';

    mount.querySelectorAll('.fc-tabbar__item').forEach(function(btn) {
      btn.addEventListener('click', function() {
        var tab = btn.dataset.tab;
        var def = _tabDefs.find(function(d) { return d.id === tab; });
        if (!def || !def.route) {
          console.debug('[shell] tab "' + tab + '" sin route');
          return;
        }
        // F7.X.8: gate modal retirado. Navegación a 'elim' ahora SIEMPRE
        // permitida; el PhaseStepper del shell page-elim comunica el bloqueo
        // cascada visualmente (filas con 🔒 + counter '—/N').
        if (typeof window.showPage === 'function') window.showPage(def.route);
      });
    });

    fcMarkActiveTab(activePage);
  }

  function fcMarkActiveTab(activePage) {
    var mount = document.getElementById('fc-tabbar-mount');
    if (!mount) return;
    mount.querySelectorAll('.fc-tabbar__item').forEach(function(btn) {
      btn.classList.toggle('fc-tabbar__item--active', btn.dataset.tab === activePage);
    });
  }

  window.renderBottomTab = renderBottomTab;
  window.fcMarkActiveTab = fcMarkActiveTab;
  window._tabDefs = _tabDefs;
})();
