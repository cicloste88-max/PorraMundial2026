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

// ───────────────────────────── Helpers de progreso ─────────────────────────────

// Devuelve el número de partidos del grupo con un pronóstico válido (0..6).
// Un pronóstico se considera válido cuando `predictions[key].l !== null`
// (mismo criterio usado en scoring.js: calcGroupTableAdvanced / getBestThirdsAll).
function getGroupCompleted(letra) {
  if (typeof PARTIDOS === 'undefined' || typeof predictions === 'undefined' ||
      typeof getMatchKey !== 'function') {
    return 0;
  }
  let count = 0;
  for (let i = 0; i < PARTIDOS.length; i++) {
    const m = PARTIDOS[i];
    if (m.group !== letra) continue;
    const pred = predictions[getMatchKey(m)];
    if (pred && pred.l !== null && pred.l !== undefined &&
        pred.v !== null && pred.v !== undefined) {
      count++;
    }
  }
  return count;
}

// Devuelve una frase estable (no aleatoria) del pool correspondiente al nivel.
function getPhraseForGroup(completed, total) {
  const pool = window.PHRASES_GRUPO || {};
  let key;
  if (completed <= 0) key = 'empty';
  else if (completed <= 2) key = 'low';
  else if (completed <= 4) key = 'mid';
  else if (completed < (total || 6)) key = 'high';
  else key = 'done';
  const list = pool[key];
  if (!list || !list.length) return '';
  return list[completed % list.length];
}

window.getGroupCompleted = getGroupCompleted;
window.getPhraseForGroup = getPhraseForGroup;

// ───────────────────────────── Colapso + progreso ─────────────────────────────

window.applyMobileGroupCollapse = function (sectionEl, letra) {
  if (!sectionEl || !IS_MOBILE()) return;
  sectionEl.classList.add('mobile-collapsed');
  sectionEl.dataset.grupo = letra;

  // Inyectar bloque de progreso si no existe
  let progress = sectionEl.querySelector('.mobile-group-progress');
  if (!progress) {
    progress = document.createElement('div');
    progress.className = 'mobile-group-progress';
    progress.innerHTML = [
      '<div class="mobile-group-progress-track">',
      '  <div class="mobile-group-progress-fill"></div>',
      '</div>',
      '<div class="mobile-group-progress-meta">',
      '  <span class="mobile-motivational-small"></span>',
      '  <span class="mobile-group-pct"></span>',
      '</div>'
    ].join('');

    // Estructura conocida (scoring.js renderAll):
    //   <div class="group-section">
    //     <div style="display:flex;..."> <h2/> <button.dice-btn/> </div>
    //     <div class="group-layout"> ... </div>
    //   </div>
    // Insertamos el progreso dentro del header (primer hijo del section)
    // para que aparezca justo bajo el título + botón de dado.
    const header = sectionEl.firstElementChild;
    if (header && header.querySelector('h2')) {
      header.appendChild(progress);
    } else {
      // Fallback: insertar al principio del section
      sectionEl.insertBefore(progress, sectionEl.firstChild);
    }
  }

  window.refreshMobileGroupProgress(letra);

  // Click en el header abre focus. Ignorar clicks que vengan del dado.
  const header = sectionEl.firstElementChild;
  if (header && !header.dataset.mobileFocusBound) {
    header.dataset.mobileFocusBound = '1';
    header.style.cursor = 'pointer';
    header.addEventListener('click', function (e) {
      if (!IS_MOBILE()) return;
      if (e.target && e.target.closest && e.target.closest('.dice-btn')) return;
      if (typeof window.openMobileFocus === 'function') {
        window.openMobileFocus(letra);
      }
    });
  }
};

window.refreshMobileGroupProgress = function (letra) {
  const section = document.querySelector('.group-section[data-grupo="' + letra + '"]');
  if (!section) return;
  const progress = section.querySelector('.mobile-group-progress');
  if (!progress) return;

  const completed = getGroupCompleted(letra);
  const pct = Math.round((completed / 6) * 100);

  const fill = progress.querySelector('.mobile-group-progress-fill');
  if (fill) fill.style.width = pct + '%';

  const motiv = progress.querySelector('.mobile-motivational-small');
  if (motiv) motiv.textContent = getPhraseForGroup(completed, 6);

  const pctEl = progress.querySelector('.mobile-group-pct');
  if (pctEl) pctEl.textContent = pct + '%';

  if (completed === 6) progress.classList.add('done');
  else progress.classList.remove('done');
};

// ───────────────────────────── Resize listener ─────────────────────────────

let __mobileGruposPrevIsMobile = IS_MOBILE();
let __mobileGruposResizeTimer = null;
window.addEventListener('resize', function () {
  if (__mobileGruposResizeTimer) clearTimeout(__mobileGruposResizeTimer);
  __mobileGruposResizeTimer = setTimeout(function () {
    const now = IS_MOBILE();
    if (now !== __mobileGruposPrevIsMobile) {
      console.log('[mobile-grupos] breakpoint cruzado (mobile=' + now + '), recargando');
      __mobileGruposPrevIsMobile = now;
      window.location.reload();
    }
  }, 150);
});

// ─────────────────────────── Init extendido ───────────────────────────

const initMobileGrupos = () => {
  console.log('[mobile-grupos] init, IS_MOBILE=' + IS_MOBILE());
  if (!IS_MOBILE()) return;
  const sections = document.querySelectorAll('.group-section');
  sections.forEach(function (section) {
    let letra = section.dataset.grupo;
    if (!letra) {
      // Fallback: extraer de h2 "Grupo X"
      const h2 = section.querySelector('h2');
      if (h2) {
        const m = h2.textContent.match(/Grupo\s+([A-L])/i);
        if (m) letra = m[1].toUpperCase();
      }
    }
    if (!letra) return;
    window.applyMobileGroupCollapse(section, letra);
  });
};
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initMobileGrupos);
} else {
  initMobileGrupos();
}
