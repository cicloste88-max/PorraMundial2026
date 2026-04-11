/* misc.js — Porra Mundial 2026
   Usa: (ninguna — solo DOM nativo)
   Expone: toggleRoundPopover, applyFinalSectionMobile
   Deps: (ninguna)
*/
function toggleRoundPopover(id, btn) {
  const pop = document.getElementById(id);
  if (!pop) return;
  const isOpen = pop.classList.contains('open');
  // Cerrar todos los demás
  document.querySelectorAll('.round-popover.open').forEach(p => p.classList.remove('open'));
  document.querySelectorAll('.round-info-btn.active').forEach(b => b.classList.remove('active'));
  if (!isOpen) {
    pop.classList.add('open');
    btn.classList.add('active');
  }
}
// Popover listener consolidado en el event delegation principal

// ── Adaptar layout final section a móvil ──
function applyFinalSectionMobile() {
  if (window.innerWidth > 640) return;
  const rows = document.querySelectorAll('.final-row1,.final-row2');
  rows.forEach(row => {
    row.style.flexDirection = 'column';
    row.style.gap = '12px';
  });
  const boxes = document.querySelectorAll('.final-box1,.final-box2,.final-box3,.final-box4');
  boxes.forEach(box => {
    box.style.flex = 'none';
    box.style.width = '100%';
    box.style.maxWidth = '100%';
    box.style.minWidth = '0';
  });
}
window.addEventListener('resize', applyFinalSectionMobile);

