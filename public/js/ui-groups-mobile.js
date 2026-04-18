// ui-groups-mobile.js — rediseño móvil fase de grupos
// Activo solo bajo @media (max-width: 640px)

const IS_MOBILE = () => window.matchMedia('(max-width: 640px)').matches;

if (!window.groupSaved) window.groupSaved = {};

function openMobileFocus(letra) {
  console.log('[mobile-grupos] openMobileFocus stub', letra);
}
function closeMobileFocus() {
  console.log('[mobile-grupos] closeMobileFocus stub');
}

window.openMobileFocus = openMobileFocus;
window.closeMobileFocus = closeMobileFocus;

const initMobileGrupos = () => {
  console.log('[mobile-grupos] init, IS_MOBILE=' + IS_MOBILE());
};
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMobileGrupos);
} else {
  initMobileGrupos();
}
