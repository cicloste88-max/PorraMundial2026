(function() {
  var _tabDefs = [
    { id: 'grupos',    label: 'Grupos',    icon: 'grupos' },
    { id: 'jornada',   label: 'Jornada',   icon: 'jornada' },
    { id: 'directo',   label: 'Directo',   icon: 'directo' },
    { id: 'quiniela',  label: 'Quiniela',  icon: 'quiniela' },
    { id: 'predictor', label: 'Predictor', icon: 'predictor' }
  ];

  function renderBottomTab() {
    // F7.4-A: no-op deliberado. F7.4-B conectará fcShellApply y montará tabs.
    console.debug('[shell] bottom-tab no-op (F7.4-A)');
  }

  window.renderBottomTab = renderBottomTab;
  window._tabDefs = _tabDefs;
})();
