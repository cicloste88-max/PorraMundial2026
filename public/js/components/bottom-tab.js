(function() {
  var _tabDefs = [
    { id: 'grupos',    label: 'Grupos',    icon: 'grupos',    route: 'grupos' },
    { id: 'jornada',   label: 'Jornada',   icon: 'jornada',   route: 'jornada' },
    { id: 'directo',   label: 'Directo',   icon: 'directo',   route: 'directo' },
    { id: 'elim',      label: 'Fase final', icon: 'elim',     route: 'elim' },
    { id: 'predictor', label: 'Predictor', icon: 'predictor', route: 'predictor' }
  ];

  // F7.4-D-1: gate modal "Fase final bloqueada" (mostrar si _gruposComplete falsy).
  // El modal vive como #fc-gate-modal en index.html (fuera de cualquier page).
  function _showGruposGateModal() {
    var modal = document.getElementById('fc-gate-modal');
    if (modal) modal.classList.add('open');
  }
  function _closeGruposGateModal() {
    var modal = document.getElementById('fc-gate-modal');
    if (modal) modal.classList.remove('open');
  }
  window.fcGateModalClose = _closeGruposGateModal;

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
        // F7.4-D-1: gate Fase final si grupos no completos.
        if (def.route === 'elim' && !window._gruposComplete) {
          _showGruposGateModal();
          return;
        }
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
