// ui-groups-mobile.js — rediseño móvil fase de grupos
// Activo solo bajo @media (max-width: 640px)

const IS_MOBILE = () => window.matchMedia('(max-width: 640px)').matches;

// FIX ERR-20: recuperación defensiva — si una ejecución previa dejó
// body.overflow bloqueado, restaurarlo al cargar el módulo. iPhone Safari
// a veces persiste este estado entre navegaciones del SPA.
if (typeof document !== 'undefined' && document.body) {
  if (document.body.style.overflow === 'hidden') {
    document.body.style.overflow = '';
  }
}

if (!window.groupSaved) window.groupSaved = {};

// ═══════════════════════════════════════════════════════════════════════════
// PART 1 — FOCUS LAYER + CARRUSEL + SWIPE
// ═══════════════════════════════════════════════════════════════════════════

// Estado privado del focus layer
const __mobileFocusState = { letra: null, slide: 0 };
const __mobileOriginalGrid = { letra: null, gridEl: null, cards: [] };
const __mobileOriginalGtable = { letra: null, gtableEl: null, originalParent: null };

// Helpers: valida si un pronóstico existe (mismo criterio que getGroupCompleted)
function __mobileIsPredValid(pred) {
  return !!(pred && pred.l !== null && pred.l !== undefined &&
            pred.v !== null && pred.v !== undefined);
}

// Devuelve los 6 partidos del grupo en el mismo orden que el DOM del grid
function __mobileMatchesForLetra(letra) {
  if (typeof PARTIDOS === 'undefined') return [];
  return PARTIDOS.filter(function (m) { return m.group === letra; });
}

// Un goleador es válido si existe y no es cadena vacía.
function hasValidScorer(match) {
  if (typeof predictions === 'undefined' || typeof getMatchKey !== 'function') return false;
  const pred = predictions[getMatchKey(match)];
  return !!(pred && pred.gol && String(pred.gol).trim() !== '');
}

// Puede guardarse el grupo si todos los 6 partidos tienen pronóstico Y goleador válidos.
function canSaveGroup(letra) {
  if (typeof PARTIDOS === 'undefined' || typeof predictions === 'undefined' ||
      typeof getMatchKey !== 'function') return false;
  const matches = __mobileMatchesForLetra(letra);
  if (matches.length < 6) return false;
  for (let i = 0; i < matches.length; i++) {
    const m = matches[i];
    const pred = predictions[getMatchKey(m)];
    if (!__mobileIsPredValid(pred)) return false;
    if (!hasValidScorer(m)) return false;
  }
  return true;
}

// Construye el focus layer una única vez y cablea listeners estáticos
function ensureFocusLayer() {
  let layer = document.getElementById('mobile-focus-layer');
  if (layer) return layer;

  layer = document.createElement('div');
  layer.id = 'mobile-focus-layer';
  layer.className = 'mobile-focus-layer';
  layer.setAttribute('aria-hidden', 'true');
  layer.innerHTML = [
    '<div class="mobile-focus-header">',
    '  <div class="mobile-focus-header-top">',
    '    <button class="mobile-back-btn" id="mobile-back-btn">‹ Grupos</button>',
    '    <h2 class="mobile-focus-title" id="mobile-focus-title">Grupo A</h2>',
    '    <button class="dice-btn mobile-focus-dice" id="mobile-focus-dice">🎲</button>',
    '  </div>',
    '  <div class="mobile-motivational" id="mobile-motivational"></div>',
    '  <div class="mobile-dots-row" id="mobile-dots-row"></div>',
    '</div>',
    '<div class="mobile-focus-progress">',
    '  <div class="mobile-focus-progress-track"><div class="mobile-focus-progress-fill" id="mobile-focus-progress-fill" style="width:0%"></div></div>',
    '</div>',
    '<div class="mobile-focus-body" id="mobile-focus-body">',
    '  <button class="mobile-arrow left" id="mobile-arrow-left">‹</button>',
    '  <button class="mobile-arrow right" id="mobile-arrow-right">›</button>',
    '  <div class="mobile-carousel" id="mobile-carousel"></div>',
    '</div>'
  ].join('');
  document.body.appendChild(layer);

  // ── Listeners estáticos: botones cabecera y flechas ──
  const backBtn = layer.querySelector('#mobile-back-btn');
  if (backBtn) backBtn.addEventListener('click', function () { closeMobileFocus(); });

  const diceBtn = layer.querySelector('#mobile-focus-dice');
  if (diceBtn) diceBtn.addEventListener('click', function () {
    if (typeof window.diceSimulateGroup === 'function' && __mobileFocusState.letra) {
      window.diceSimulateGroup(__mobileFocusState.letra);
    }
  });

  const arrowL = layer.querySelector('#mobile-arrow-left');
  const arrowR = layer.querySelector('#mobile-arrow-right');
  if (arrowL) arrowL.addEventListener('click', function () { gotoSlide(__mobileFocusState.slide - 1); });
  if (arrowR) arrowR.addEventListener('click', function () { gotoSlide(__mobileFocusState.slide + 1); });

  // ── Swipe en el body (touch + mouse fallback) ──
  const body = layer.querySelector('#mobile-focus-body');
  if (body) {
    let startX = 0, startY = 0, isDragging = false, axisLocked = null;

    const onStart = function (x, y) {
      startX = x; startY = y; isDragging = true; axisLocked = null;
    };
    const onMove = function (x, y) {
      if (!isDragging) return;
      const dx = x - startX;
      const dy = y - startY;
      if (axisLocked === null && (Math.abs(dx) > 6 || Math.abs(dy) > 6)) {
        axisLocked = Math.abs(dy) > Math.abs(dx) ? 'v' : 'h';
      }
      if (axisLocked === 'v') {
        // scroll vertical: cancelar swipe
        isDragging = false;
      }
    };
    const onEnd = function (x, y) {
      if (!isDragging) return;
      const dx = x - startX;
      const dy = y - startY;
      isDragging = false;
      if (Math.abs(dy) > Math.abs(dx)) return;
      if (Math.abs(dx) > 50) {
        if (dx < 0) gotoSlide(__mobileFocusState.slide + 1);
        else gotoSlide(__mobileFocusState.slide - 1);
      }
    };

    body.addEventListener('touchstart', function (e) {
      const t = e.touches && e.touches[0]; if (!t) return;
      onStart(t.clientX, t.clientY);
    }, { passive: true });
    body.addEventListener('touchmove', function (e) {
      const t = e.touches && e.touches[0]; if (!t) return;
      onMove(t.clientX, t.clientY);
    }, { passive: true });
    body.addEventListener('touchend', function (e) {
      const t = (e.changedTouches && e.changedTouches[0]) || null;
      if (!t) { isDragging = false; return; }
      onEnd(t.clientX, t.clientY);
    });

    body.addEventListener('mousedown', function (e) { onStart(e.clientX, e.clientY); });
    body.addEventListener('mousemove', function (e) { if (isDragging) onMove(e.clientX, e.clientY); });
    body.addEventListener('mouseup', function (e) { onEnd(e.clientX, e.clientY); });
    body.addEventListener('mouseleave', function () { isDragging = false; });

    // ── Delegated click handler para boost-row (capture phase, ver PART 2) ──
    body.addEventListener('click', __mobileBoostRowClickHandler, true);
  }

  // F7.4-D-1: listeners de cierre por tab eliminados. Los botones internos
  // #btn-vista-jornada/#btn-vista-directo ya no existen — el toggle entre
  // pages lo gobierna showPage desde el bottom-tab. Cierre del focus layer
  // al salir de page-grupos: hook en showPage (ui-nav.js).

  return layer;
}

function openMobileFocus(letra) {
  // FIX ERR-19: wrap defensivo para iPhone Safari.
  // FIX ERR-20: eliminado body.overflow=hidden — bloqueaba scroll persistente.
  let __openedLayerOk = false;
  try {
    ensureFocusLayer();
    __mobileFocusState.letra = letra;
    __mobileFocusState.slide = 0;

    const gridEl = document.getElementById('grid-' + letra);
    if (!gridEl) {
      if (typeof showMobileToast === 'function') showMobileToast('✗ [DEBUG] grid-' + letra + ' no existe', 'error');
      console.log('[mobile-grupos] openMobileFocus: grid no encontrado', letra);
      return;
    }
    const cards = Array.prototype.slice.call(gridEl.querySelectorAll('.card'));

    __mobileOriginalGrid.letra = letra;
    __mobileOriginalGrid.gridEl = gridEl;
    __mobileOriginalGrid.cards = cards.slice();

    const carousel = document.getElementById('mobile-carousel');
    if (!carousel) {
      if (typeof showMobileToast === 'function') showMobileToast('✗ [DEBUG] carousel no existe', 'error');
      return;
    }
    while (carousel.firstChild) carousel.removeChild(carousel.firstChild);
    cards.forEach(function (card) {
      const slide = document.createElement('div');
      slide.className = 'mobile-carousel-slide';
      slide.appendChild(card);
      carousel.appendChild(slide);
    });

    // Slide 7 — puede fallar aquí en Safari iOS si hay quirk
    try {
      const summary = buildSummarySlide(letra);
      carousel.appendChild(summary);
    } catch (errSummary) {
      if (typeof showMobileToast === 'function') showMobileToast('✗ [DEBUG] summary: ' + (errSummary && errSummary.message || errSummary), 'error');
      // Continuamos sin slide 7
    }

    carousel.style.transform = 'translateX(0%)';

    const title = document.getElementById('mobile-focus-title');
    if (title) title.textContent = 'Grupo ' + letra;

    try { updateFocusUI(); } catch (e) { console.warn('updateFocusUI error:', e); }

    const layer = document.getElementById('mobile-focus-layer');
    if (!layer) {
      if (typeof showMobileToast === 'function') showMobileToast('✗ [DEBUG] layer no existe tras ensureFocusLayer', 'error');
      return;
    }
    // PRIMERO abrir el layer, DESPUÉS bloquear scroll
    layer.classList.add('open');
    layer.setAttribute('aria-hidden', 'false');
    __openedLayerOk = true;

    // FIX ERR-20: NO bloqueamos body.overflow — en iPhone Safari causa bloqueo
    // persistente de scroll si algo falla. El layer position:fixed ya cubre
    // la pantalla visualmente.

    if (window.groupSaved[letra]) {
      try { lockCardsInFocus(letra); } catch (e) { console.warn('lockCards error:', e); }
    }
    try { updateSaveBtnState(letra); } catch (e) { console.warn('updateSaveBtn error:', e); }
    try { refreshBoostRowsInFocus(); } catch (e) { console.warn('refreshBoost error:', e); }

    console.log('[mobile-grupos] openMobileFocus OK', letra);
  } catch (err) {
    // FIX ERR-20: sin restore de body.overflow — no lo tocamos nunca
    const msg = (err && err.message) ? err.message : String(err);
    console.error('[mobile-grupos] openMobileFocus EXCEPTION', msg, err);
    if (typeof showMobileToast === 'function') {
      showMobileToast('✗ [DEBUG] ' + msg.slice(0, 60), 'error');
    }
  }
}

function closeMobileFocus() {
  if (__mobileFocusState.letra == null) return;
  const letra = __mobileFocusState.letra;

  // Devolver cards al grid original en el orden guardado
  const gridEl = __mobileOriginalGrid.gridEl;
  const cards = __mobileOriginalGrid.cards || [];
  if (gridEl) {
    cards.forEach(function (card) {
      gridEl.appendChild(card);
    });
  }

  // Restaurar el #gtable-${letra} a su padre original (vino movido del DOM)
  if (__mobileOriginalGtable.gtableEl && __mobileOriginalGtable.originalParent) {
    __mobileOriginalGtable.originalParent.appendChild(__mobileOriginalGtable.gtableEl);
  }
  __mobileOriginalGtable.letra = null;
  __mobileOriginalGtable.gtableEl = null;
  __mobileOriginalGtable.originalParent = null;

  // Desbloquear tarjetas por si quedó estado visual residual
  unlockCardsInFocus(letra);

  // Limpiar los wrappers .mobile-carousel-slide (incluido el summary slide)
  const carousel = document.getElementById('mobile-carousel');
  if (carousel) {
    while (carousel.firstChild) carousel.removeChild(carousel.firstChild);
    carousel.style.transform = 'translateX(0%)';
  }

  const layer = document.getElementById('mobile-focus-layer');
  if (layer) {
    layer.classList.remove('open');
    layer.classList.remove('done');
    layer.setAttribute('aria-hidden', 'true');
  }
  // FIX ERR-20: no tocamos body.overflow aquí tampoco

  __mobileFocusState.letra = null;
  __mobileFocusState.slide = 0;
  __mobileOriginalGrid.letra = null;
  __mobileOriginalGrid.gridEl = null;
  __mobileOriginalGrid.cards = [];

  if (typeof window.refreshMobileGroupProgress === 'function') {
    window.refreshMobileGroupProgress(letra);
  }
  console.log('[mobile-grupos] closeMobileFocus', letra);
}

function gotoSlide(i) {
  if (i < 0) i = 0;
  if (i > 6) i = 6;
  __mobileFocusState.slide = i;
  const carousel = document.getElementById('mobile-carousel');
  if (carousel) carousel.style.transform = 'translateX(-' + (i * 100) + '%)';
  updateFocusUI();
  if (i === 6 && __mobileFocusState.letra) {
    // Re-renderizar la tabla por si cambiaron pronósticos tras la última visita
    if (typeof window.renderGroupTableCard === 'function') {
      window.renderGroupTableCard(__mobileFocusState.letra);
    }
    updateSaveBtnState(__mobileFocusState.letra);
  }
}

function updateFocusUI() {
  const letra = __mobileFocusState.letra;
  if (!letra) return;

  const matches = __mobileMatchesForLetra(letra);
  const preds = (typeof predictions !== 'undefined') ? predictions : {};
  const getKey = (typeof getMatchKey === 'function') ? getMatchKey : null;

  // Dots (6 numéricos + 1 summary)
  const dotsRow = document.getElementById('mobile-dots-row');
  if (dotsRow) {
    const parts = [];
    for (let i = 0; i < 6; i++) {
      const m = matches[i];
      let done = false;
      if (m && getKey) {
        const k = getKey(m);
        done = __mobileIsPredValid(preds[k]);
      }
      const cur = (i === __mobileFocusState.slide);
      parts.push(
        '<button class="mobile-dot' + (cur ? ' current' : '') + (done ? ' done' : '') +
        '" data-slide="' + i + '"><span>' + (i + 1) + '</span></button>'
      );
    }
    // Summary dot (slide 6)
    const ready = canSaveGroup(letra);
    const curSummary = (__mobileFocusState.slide === 6);
    parts.push(
      '<button class="mobile-dot summary' + (curSummary ? ' current' : '') +
      (ready ? ' ready' : '') + '" data-slide="6"><span>🏁</span></button>'
    );
    dotsRow.innerHTML = parts.join('');
    Array.prototype.forEach.call(dotsRow.querySelectorAll('.mobile-dot'), function (btn) {
      btn.addEventListener('click', function () {
        const n = parseInt(btn.getAttribute('data-slide'), 10);
        if (!isNaN(n)) gotoSlide(n);
      });
    });
  }

  // Completed count (usa getGroupCompleted para consistencia)
  const completed = (typeof getGroupCompleted === 'function') ? getGroupCompleted(letra) : 0;

  // Motivational
  const motiv = document.getElementById('mobile-motivational');
  if (motiv) {
    motiv.textContent = (typeof getPhraseForGroup === 'function')
      ? getPhraseForGroup(completed, 6) : '';
  }

  // Progress fill
  const fill = document.getElementById('mobile-focus-progress-fill');
  if (fill) fill.style.width = Math.round((completed / 6) * 100) + '%';

  // Done flag on layer
  const layer = document.getElementById('mobile-focus-layer');
  if (layer) {
    if (completed === 6) layer.classList.add('done');
    else layer.classList.remove('done');
  }

  // Flechas
  const arrowL = document.getElementById('mobile-arrow-left');
  const arrowR = document.getElementById('mobile-arrow-right');
  if (arrowL) arrowL.disabled = (__mobileFocusState.slide <= 0);
  if (arrowR) arrowR.disabled = (__mobileFocusState.slide >= 6);
}

window.openMobileFocus = openMobileFocus;
window.closeMobileFocus = closeMobileFocus;
window.gotoSlide = gotoSlide;
window.updateFocusUI = updateFocusUI;

// ─────────────────────────── SLIDE 7 (resumen) ───────────────────────────

// Construye el slide resumen con la tabla de clasificación simulada del grupo
// y el botón contextual guardar/deshacer.
function buildSummarySlide(letra) {
  const slide = document.createElement('div');
  slide.className = 'mobile-carousel-slide mobile-summary-slide';

  const wrap = document.createElement('div');
  wrap.className = 'mobile-summary-wrap';

  // Localizar #gtable-${letra} y MOVERLO al wrap (mismo patrón que las 6 tarjetas)
  const gtableEl = document.getElementById('gtable-' + letra);
  if (gtableEl) {
    __mobileOriginalGtable.letra = letra;
    __mobileOriginalGtable.gtableEl = gtableEl;
    __mobileOriginalGtable.originalParent = gtableEl.parentElement;
    wrap.appendChild(gtableEl);
    // Refrescar contenido (renderGroupTableCard usa getElementById, el move no rompe)
    if (typeof window.renderGroupTableCard === 'function') {
      window.renderGroupTableCard(letra);
    }
  } else {
    const p = document.createElement('p');
    p.textContent = 'No se pudo cargar la clasificación';
    wrap.appendChild(p);
  }

  slide.appendChild(wrap);

  const btn = document.createElement('button');
  btn.className = 'mobile-save-btn';
  btn.id = 'mobile-save-btn';
  btn.type = 'button';
  slide.appendChild(btn);

  const note = document.createElement('p');
  note.className = 'mobile-save-note';
  note.id = 'mobile-save-note';
  slide.appendChild(note);

  return slide;
}

// Actualiza el estado (texto / clases / disabled / onclick) del botón guardar.
function updateSaveBtnState(letra) {
  const btn = document.getElementById('mobile-save-btn');
  const note = document.getElementById('mobile-save-note');
  if (!btn || !note) return;

  const predicted = (typeof getGroupCompleted === 'function') ? getGroupCompleted(letra) : 0;
  let scorersMissing = 0;
  if (typeof PARTIDOS !== 'undefined' && typeof predictions !== 'undefined' &&
      typeof getMatchKey === 'function') {
    const groupMatches = PARTIDOS.filter(function (m) { return m.group === letra; });
    const predictedMatches = groupMatches.filter(function (m) {
      return __mobileIsPredValid(predictions[getMatchKey(m)]);
    });
    scorersMissing = predictedMatches.filter(function (m) {
      return !hasValidScorer(m);
    }).length;
  }

  const saved = !!window.groupSaved[letra];
  const ready = !saved && canSaveGroup(letra);

  if (saved) {
    btn.textContent = '↻ Deshacer edición';
    btn.className = 'mobile-save-btn saved';
    btn.disabled = false;
    btn.onclick = function () { unsaveGroup(letra); };
  } else if (ready) {
    btn.textContent = '💾 Guardar grupo';
    btn.className = 'mobile-save-btn';
    btn.disabled = false;
    btn.onclick = function () { saveGroup(letra); };
  } else if (predicted >= 6 && scorersMissing > 0) {
    btn.textContent = 'Faltan ' + scorersMissing + ' goleador' + (scorersMissing === 1 ? '' : 'es');
    btn.className = 'mobile-save-btn disabled';
    btn.disabled = true;
    btn.onclick = null;
  } else {
    btn.textContent = 'Completa las 6 tarjetas (' + predicted + '/6)';
    btn.className = 'mobile-save-btn disabled';
    btn.disabled = true;
    btn.onclick = null;
  }

  if (saved) {
    note.textContent = '✓ Tus pronósticos de este grupo están guardados';
    note.className = 'mobile-save-note ok';
  } else {
    note.textContent = 'Al guardar, los pronósticos se bloquearán hasta la fecha de cierre';
    note.className = 'mobile-save-note';
  }
}

// Persiste el grupo guardado en league_members.groups_saved (JSONB)
async function saveGroup(letra) {
  const uid = (typeof currentUser !== 'undefined' ? (currentUser && currentUser.id) : (window.currentUser && window.currentUser.id));
  const lid = (typeof window.getActiveLeagueId === 'function') ? window.getActiveLeagueId() : null;
  if (!uid || !lid || !window._porraDb) {
    showMobileToast('✗ No hay sesión/liga activa', 'error');
    return;
  }
  window.groupSaved[letra] = true;
  try {
    const { error } = await window._porraDb.from('league_members')
      .update({ groups_saved: window.groupSaved })
      .eq('user_id', uid).eq('league_id', lid);
    if (error) throw error;
    showMobileToast('✓ Grupo ' + letra + ' guardado');
    lockCardsInFocus(letra);
    updateSaveBtnState(letra);
    if (typeof window.refreshMobileGroupProgress === 'function') {
      window.refreshMobileGroupProgress(letra);
    }
  } catch (e) {
    delete window.groupSaved[letra];
    console.warn('[mobile-grupos] saveGroup error:', e);
    showMobileToast('✗ Error al guardar', 'error');
  }
}

// Deshace el guardado (vuelve a editable)
async function unsaveGroup(letra) {
  const uid = (typeof currentUser !== 'undefined' ? (currentUser && currentUser.id) : (window.currentUser && window.currentUser.id));
  const lid = (typeof window.getActiveLeagueId === 'function') ? window.getActiveLeagueId() : null;
  if (!uid || !lid || !window._porraDb) {
    showMobileToast('✗ No hay sesión/liga activa', 'error');
    return;
  }
  const prev = window.groupSaved[letra];
  delete window.groupSaved[letra];
  try {
    const { error } = await window._porraDb.from('league_members')
      .update({ groups_saved: window.groupSaved })
      .eq('user_id', uid).eq('league_id', lid);
    if (error) throw error;
    showMobileToast('↻ Grupo ' + letra + ' editable');
    unlockCardsInFocus(letra);
    updateSaveBtnState(letra);
    if (typeof window.refreshMobileGroupProgress === 'function') {
      window.refreshMobileGroupProgress(letra);
    }
  } catch (e) {
    if (prev) window.groupSaved[letra] = prev;
    console.warn('[mobile-grupos] unsaveGroup error:', e);
    showMobileToast('✗ Error al deshacer', 'error');
  }
}

// Añade/quita la clase `mobile-locked` a las tarjetas del grupo dentro del focus
function lockCardsInFocus(letra) {
  const body = document.getElementById('mobile-focus-body');
  if (!body) return;
  const cards = body.querySelectorAll('.card[data-grupo="' + letra + '"]');
  Array.prototype.forEach.call(cards, function (c) { c.classList.add('mobile-locked'); });
}

function unlockCardsInFocus(letra) {
  const body = document.getElementById('mobile-focus-body');
  if (!body) return;
  const cards = body.querySelectorAll('.card[data-grupo="' + letra + '"]');
  Array.prototype.forEach.call(cards, function (c) { c.classList.remove('mobile-locked'); });
}

// Toast efímero en el focus layer
function showMobileToast(msg, type) {
  let toast = document.getElementById('mobile-toast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'mobile-toast';
    document.body.appendChild(toast);
  }
  toast.textContent = msg;
  toast.className = 'mobile-toast show' + (type === 'error' ? ' error' : '');
  if (toast.__hideTimer) clearTimeout(toast.__hideTimer);
  toast.__hideTimer = setTimeout(function () {
    toast.classList.remove('show');
  }, 2200);
}

window.buildSummarySlide = buildSummarySlide;
window.updateSaveBtnState = updateSaveBtnState;
window.saveGroup = saveGroup;
window.unsaveGroup = unsaveGroup;
window.canSaveGroup = canSaveGroup;
window.hasValidScorer = hasValidScorer;
window.lockCardsInFocus = lockCardsInFocus;
window.unlockCardsInFocus = unlockCardsInFocus;
window.showMobileToast = showMobileToast;

// ═══════════════════════════════════════════════════════════════════════════
// PART 2 — SMART BOOST ROW (sección independiente)
// ═══════════════════════════════════════════════════════════════════════════

// Etiqueta legible ("Local - Visitante") a partir de un matchKey
function matchLabelFromKey(matchKey) {
  if (typeof PARTIDOS === 'undefined' || typeof getMatchKey !== 'function') return '?';
  for (let i = 0; i < PARTIDOS.length; i++) {
    const m = PARTIDOS[i];
    if (getMatchKey(m) === matchKey) {
      return (m.home || '?') + ' - ' + (m.away || '?');
    }
  }
  return '?';
}

// Refresca el estado visual de las boost-rows dentro del focus layer
function refreshBoostRowsInFocus() {
  if (!IS_MOBILE()) return;
  if (__mobileFocusState.letra == null) return;
  if (typeof PARTIDOS === 'undefined' || typeof getMatchKey !== 'function') return;

  const bp = (typeof boostPicks !== 'undefined') ? boostPicks : {};
  const body = document.getElementById('mobile-focus-body');
  if (!body) return;

  const rows = body.querySelectorAll('.boost-row');
  Array.prototype.forEach.call(rows, function (row) {
    const card = row.closest && row.closest('.card');
    if (!card) return;
    const idxStr = card.getAttribute('data-match-idx');
    if (idxStr == null) return;
    const idx = parseInt(idxStr, 10);
    if (isNaN(idx)) return;
    const m = PARTIDOS[idx];
    if (!m || !m.date) return;
    const date = m.date.slice(0, 10);
    const matchKey = getMatchKey(m);
    const boostedKey = bp[date];
    if (boostedKey && boostedKey !== matchKey) {
      row.classList.add('boost-blocked');
    } else {
      row.classList.remove('boost-blocked');
    }
  });
}

// Handler delegado (capture phase) para clicks en boost-row dentro del focus
function __mobileBoostRowClickHandler(e) {
  const body = document.getElementById('mobile-focus-body');
  if (!body) return;
  const row = e.target && e.target.closest && e.target.closest('.boost-row');
  if (!row) return;
  if (!body.contains(row)) return;
  if (typeof PARTIDOS === 'undefined' || typeof getMatchKey !== 'function') return;

  // Interceptar ANTES del listener original (capture + stopImmediate)
  e.stopImmediatePropagation();
  e.preventDefault();

  const card = row.closest('.card');
  if (!card) return;
  const idxStr = card.getAttribute('data-match-idx');
  if (idxStr == null) return;
  const idx = parseInt(idxStr, 10);
  if (isNaN(idx)) return;
  const m = PARTIDOS[idx];
  if (!m || !m.date) return;

  const date = m.date.slice(0, 10);
  const matchKey = getMatchKey(m);
  const bp = (typeof boostPicks !== 'undefined') ? boostPicks : {};
  const boostedKey = bp[date];

  // Conflicto: otro partido ya tiene el boost del día
  if (boostedKey && boostedKey !== matchKey) {
    const label = matchLabelFromKey(boostedKey);
    const ok = confirm('Ya has asignado boost a ' + label + ' en esta jornada. ¿Cambiar a este partido?');
    if (!ok) return;
  }

  if (typeof window.tickerBoostToggle === 'function') {
    window.tickerBoostToggle(matchKey, date);
  }

  refreshBoostRowsInFocus();
  if (typeof window.renderBoostTicker === 'function') {
    window.renderBoostTicker();
  }
}

window.refreshBoostRowsInFocus = refreshBoostRowsInFocus;
window.matchLabelFromKey = matchLabelFromKey;

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
