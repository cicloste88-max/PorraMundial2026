(function() {
  function fcShellApply(page) {
    if (!window._splashHidden) {
      // Splash aún visible — no mountar todavía.
      return;
    }
    // F7.4-B: toggle body.fc-shell-active + render mounts.
    // F7.4-A: no-op deliberado.
  }

  window.fcShellApply = fcShellApply;
})();
