(function() {
  function renderAppHeader(variant, props) {
    // F7.4-A: no-op deliberado. F7.4-C montará headers por variante.
    // variant: 'global' | 'page' | 'modal'
    // props:   { title, showBack, backFn, actions }
    console.debug('[shell] app-header no-op (F7.4-A)', variant, props);
  }

  window.renderAppHeader = renderAppHeader;
})();
