(function() {
  var _tabDefs = [
    { id: 'grupos',    label: 'Grupos',    icon: 'grupos',    route: 'grupos' },
    { id: 'jornada',   label: 'Jornada',   icon: 'jornada',   route: null },
    { id: 'directo',   label: 'Directo',   icon: 'directo',   route: null },
    { id: 'quiniela',  label: 'Quiniela',  icon: 'quiniela',  route: 'elim' },
    { id: 'predictor', label: 'Predictor', icon: 'predictor', route: null }
  ];

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
          console.debug('[shell] tab "' + tab + '" sin route — pendiente F7.4-D');
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
    // 'elim' se pinta como tab 'quiniela' (alias en F7.4-B; F7.4-D limpiará)
    var activeTabId = (activePage === 'elim') ? 'quiniela' : activePage;
    mount.querySelectorAll('.fc-tabbar__item').forEach(function(btn) {
      btn.classList.toggle('fc-tabbar__item--active', btn.dataset.tab === activeTabId);
    });
  }

  window.renderBottomTab = renderBottomTab;
  window.fcMarkActiveTab = fcMarkActiveTab;
  window._tabDefs = _tabDefs;
})();
