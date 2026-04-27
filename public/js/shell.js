(function() {
  // Pages que muestran el shell (bottom-tab visible)
  // F7.4-D ampliará: jornada, directo, predictor (cuando se separen como pages)
  // F7.4-E ampliará: perfil
  var SHELL_PAGES = ['grupos', 'elim'];

  function fcShellApply(page) {
    if (!window._splashHidden) return;

    var isShellPage = SHELL_PAGES.indexOf(page) !== -1;

    if (isShellPage) {
      document.body.classList.add('fc-shell-active');
      var mount = document.getElementById('fc-tabbar-mount');
      if (!mount) return;
      // Mount idempotente: render solo la primera vez
      if (mount.dataset.rendered !== '1' && typeof window.renderBottomTab === 'function') {
        window.renderBottomTab(page);
        mount.removeAttribute('hidden');
      } else if (typeof window.fcMarkActiveTab === 'function') {
        window.fcMarkActiveTab(page);
      }
    } else {
      document.body.classList.remove('fc-shell-active');
      // Mount queda en DOM, oculto por CSS (display:none default)
    }
  }

  window.fcShellApply = fcShellApply;
})();
