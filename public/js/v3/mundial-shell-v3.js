/* F1.1c · Shell global v3 — fifa-bar (countdown → next-match) + qualified-cta
   + stage-pill + zoom-overlay wiring + user-badge mount.
   Procedencia: design/v3-prototype/{mundial,eliminatorias}-app.js (countdown)
   + decisiones D1/D8/D11/D12/D13 + OQ#1/OQ#4 bundle (13 may 2026).
   Classic script (loadScript) — sigue patrón runInit defensivo (ERR-01) +
   var top-level para exponer a window (ERR-02). NO addEventListener
   DOMContentLoaded directo (red de seguridad en main-entry).
   Idempotente: init() puede llamarse N veces, setInterval UNA sola vez. */

(function () {
  'use strict';

  // ── Constants ──────────────────────────────────────────
  // D1 corregida: kickoff target = 2026-06-11T19:00:00Z (NO 18:00 del prototipo).
  var KICKOFF_UTC = '2026-06-11T19:00:00Z';
  var KICKOFF_MS  = new Date(KICKOFF_UTC).getTime();

  // SHELL_PAGES donde la fifa-bar es visible (OQ#1 — welcome excluido).
  var SHELL_PAGES = ['grupos', 'jornada', 'directo', 'elim', 'predictor'];

  var FLAGS_BASE = 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/flags/redesign%20v3/'; // F2.1: Supabase Storage bucket `flags/redesign v3/` con espacio URL-encoded (%20). Antes era path local que no existía.
  var FIFA_LOGO  = 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/Logos/fifa-logo_brandlogos.net_flczz-512x512.png';

  // 4 banderas fijas del CTA D2 + chip +44.
  var CTA_FLAGS = [
    { slug: 'Spain',     bg: '#AA151B', alt: 'España' },
    { slug: 'Argentina', bg: '#75AADB', alt: 'Argentina' },
    { slug: 'Brazil',    bg: '#009C3B', alt: 'Brasil' },
    { slug: 'France',    bg: '#012169', alt: 'Francia' }
  ];

  // ── State (singleton — init idempotente) ──────────────
  var _initialized = false;
  var _tickInterval = null;
  var _kickoffPassed = false;

  // ── Utils ──────────────────────────────────────────────
  function pad2(n) { return String(n).padStart(2, '0'); }

  function flagPath(slug) {
    // encodeURIComponent solo en filename (D3) — el bucket lleva espacio %20.
    if (!slug) return '';
    return FLAGS_BASE + encodeURIComponent(slug + '.svg');
  }
  window.flagPath = flagPath;

  // ── Templates ──────────────────────────────────────────
  function fifaBarHTML() {
    return ''
      + '<header class="v3-fifa-bar" data-v3-fifa-bar>'
      +   '<div class="v3-fifa-bar__left">'
      +     '<img class="v3-fifa-bar__icon" src="' + FIFA_LOGO + '" alt="FIFA"/>'
      +     '<div class="v3-fifa-bar__txt">'
      +       '<div class="v3-fifa-bar__title">Copa Mundial de la FIFA 2026<sup>™</sup></div>'
      +       '<div class="v3-fifa-bar__subtitle" data-v3-bar-subtitle>11 de junio – 19 de julio de 2026</div>'
      +     '</div>'
      +   '</div>'
      +   '<div class="v3-fifa-bar__countdown" data-v3-bar-countdown aria-live="off">'
      +     '<span class="v3-fifa-bar__eyebrow" data-v3-bar-eyebrow>FALTA</span>'
      +     '<div class="v3-fifa-bar__cd-row">'
      +       '<div class="v3-cd-block"><span class="v3-cd-num" data-countdown="days">--</span><span class="v3-cd-lbl">días</span></div>'
      +       '<div class="v3-cd-block"><span class="v3-cd-num" data-countdown="hours">--</span><span class="v3-cd-lbl">horas</span></div>'
      +       '<div class="v3-cd-block"><span class="v3-cd-num" data-countdown="minutes">--</span><span class="v3-cd-lbl">min</span></div>'
      +       '<div class="v3-cd-block"><span class="v3-cd-num" data-countdown="seconds">--</span><span class="v3-cd-lbl">seg.</span></div>'
      +     '</div>'
      +   '</div>'
      +   '<div class="v3-fifa-bar__user" data-user-mount></div>'
      + '</header>';
  }

  function qualifiedCtaHTML() {
    var flagsHtml = CTA_FLAGS.map(function (f) {
      return '<span class="v3-qualified-cta__flag" style="--bg:' + f.bg + '">'
           +   '<img src="' + flagPath(f.slug) + '" alt="" loading="lazy"/>'
           + '</span>';
    }).join('');
    return ''
      + '<a class="v3-qualified-cta" href="#" data-qualified-cta aria-label="Conoce a las 48 selecciones clasificadas">'
      +   '<div class="v3-qualified-cta__flags" aria-hidden="true">'
      +     flagsHtml
      +     '<span class="v3-qualified-cta__flag v3-qualified-cta__flag--more">+44</span>'
      +   '</div>'
      +   '<div class="v3-qualified-cta__body">'
      +     '<div class="v3-qualified-cta__eyebrow">QUALIFIED</div>'
      +     '<div class="v3-qualified-cta__title">Conoce a las 48 selecciones</div>'
      +   '</div>'
      +   '<div class="v3-qualified-cta__arrow" aria-hidden="true">›</div>'
      + '</a>';
  }

  function stagePillHTML(label) {
    return '<div class="v3-stage-pill-wrap" data-v3-stage-pill-wrap>'
         +   '<div class="v3-stage-pill">' + label + '</div>'
         + '</div>';
  }

  function zoomOverlayHTML() {
    return '<div class="v3-zoom-overlay" data-v3-zoom-overlay aria-hidden="true"></div>'
         + '<div class="v3-zoom-panel" data-v3-zoom-panel>'
         +   '<div class="v3-zoom-panel__inner"></div>'
         + '</div>';
  }

  // ── Countdown / next-match tick ────────────────────────
  function tickCountdown() {
    var now = Date.now();
    var diff = KICKOFF_MS - now;

    if (diff <= 0) {
      // Post-kickoff: sustituir countdown por texto next-match (state pre/live/next).
      if (!_kickoffPassed) {
        _kickoffPassed = true;
        applyPostKickoffMode();
      }
      refreshNextMatchUI();
      return;
    }

    var d = Math.floor(diff / 86400000); diff -= d * 86400000;
    var h = Math.floor(diff / 3600000);  diff -= h * 3600000;
    var m = Math.floor(diff / 60000);    diff -= m * 60000;
    var s = Math.floor(diff / 1000);

    document.querySelectorAll('[data-countdown="days"]').forEach(function (el) { el.textContent = pad2(d); });
    document.querySelectorAll('[data-countdown="hours"]').forEach(function (el) { el.textContent = pad2(h); });
    document.querySelectorAll('[data-countdown="minutes"]').forEach(function (el) { el.textContent = pad2(m); });
    document.querySelectorAll('[data-countdown="seconds"]').forEach(function (el) { el.textContent = pad2(s); });
  }

  function applyPostKickoffMode() {
    // F1.1h: 2 líneas verticales — eyebrow (estado) + nextmatch (equipos).
    document.querySelectorAll('[data-v3-bar-countdown]').forEach(function (el) {
      el.innerHTML = ''
        + '<span class="v3-fifa-bar__eyebrow" data-v3-bar-eyebrow>PRÓXIMO</span>'
        + '<div class="v3-fifa-bar__nextmatch" data-v3-next-match>—</div>';
    });
  }

  function refreshNextMatchUI() {
    if (typeof window.resolveNextMatchV3 !== 'function') return;
    try {
      var info = window.resolveNextMatchV3(Date.now());
      if (!info || !info.match) return;
      var match = info.match;
      var isLive = info.state === 'live';
      var eyebrowText = isLive ? 'EN VIVO' : 'PRÓXIMO';
      var label = (match.home_es || match.home_en) + ' vs ' + (match.away_es || match.away_en);

      document.querySelectorAll('[data-v3-bar-eyebrow]').forEach(function (el) {
        el.textContent = eyebrowText;
        el.classList.toggle('is-live', isLive);
      });
      document.querySelectorAll('[data-v3-next-match]').forEach(function (el) {
        el.textContent = label;
      });
      // Event para que otras vistas (Vista Directo, Pichichi banner) puedan reaccionar.
      window.dispatchEvent(new CustomEvent('mundial:next-match-changed', { detail: info }));
    } catch (e) { /* swallow — resolver puede fallar pre-fetch */ }
  }

  // ── Mounting (idempotente por page) ────────────────────
  function ensureShellMount(pageId) {
    // pageId: 'grupos' | 'jornada' | 'directo' | 'elim' | 'predictor'.
    if (SHELL_PAGES.indexOf(pageId) === -1) return null;
    var pageEl = document.getElementById('page-' + pageId);
    if (!pageEl) return null;

    var existing = pageEl.querySelector('[data-v3-shell-mount]');
    if (existing) return existing;

    var mount = document.createElement('div');
    mount.className = 'phone v3-shell-host';
    mount.setAttribute('data-v3-shell-mount', '');
    mount.innerHTML = fifaBarHTML()
      + (pageId === 'grupos' ? qualifiedCtaHTML() : '')
      + stagePillHTML(stageLabelForPage(pageId));

    pageEl.insertBefore(mount, pageEl.firstChild);
    return mount;
  }

  function stageLabelForPage(pageId) {
    switch (pageId) {
      case 'grupos':    return '● GROUP STAGE';
      case 'jornada':   return '● JORNADA';
      case 'directo':   return '● EN DIRECTO';
      case 'elim':      return '● KNOCKOUT';
      case 'predictor': return '● PREDICTOR';
      default:          return '● MUNDIAL';
    }
  }

  function ensureZoomOverlay() {
    // F2.6: alinear con design source — 2 nodos siblings direct body children
    // (spec: "Hay 2 nodos fijos en el HTML... fuera del .phone"). Antes envolvía
    // ambos en [data-v3-zoom-host] (sibling combinator funcionaba pero la
    // abstracción extra desviaba de spec; remover para parity exacta).
    if (document.querySelector('[data-v3-zoom-overlay]')) return;
    var temp = document.createElement('div');
    temp.innerHTML = zoomOverlayHTML();
    while (temp.firstChild) {
      document.body.appendChild(temp.firstChild);
    }
    console.log('[v3-shell] ensureZoomOverlay → overlay+panel appended to body');
  }

  // ── Wiring ─────────────────────────────────────────────
  function bindQualifiedCta() {
    // Delegación a nivel body — sobrevive re-mounts del shell.
    if (document.body.dataset.v3CtaBound === '1') return;
    document.body.dataset.v3CtaBound = '1';
    document.body.addEventListener('click', function (e) {
      var el = e.target && e.target.closest ? e.target.closest('[data-qualified-cta]') : null;
      if (!el) return;
      e.preventDefault();
      if (typeof window._openGloboOverlay === 'function') {
        window._openGloboOverlay();
      } else {
        console.warn('[mundial-shell-v3] _openGloboOverlay no disponible aún (F1.1e pendiente).');
      }
    });
  }

  function bindPageChange() {
    // Escucha cambios de page (showPage dispatches mundial:page-changed o se llama
    // ensurePageShell manualmente desde ui-nav en F3 wiring). Mientras tanto,
    // el shell se monta on-demand cuando init() detecta una page visible.
    if (document.body.dataset.v3PageBound === '1') return;
    document.body.dataset.v3PageBound = '1';
    window.addEventListener('mundial:page-changed', function (e) {
      var pageId = e && e.detail && e.detail.page;
      if (pageId) ensureShellMount(pageId);
    });
  }

  // ── Public API ─────────────────────────────────────────
  function ensurePageShell(pageId) {
    if (!_initialized) init();
    return ensureShellMount(pageId);
  }
  window.ensurePageShellV3 = ensurePageShell;

  function init() {
    if (_initialized) return;
    _initialized = true;

    ensureZoomOverlay();
    bindQualifiedCta();
    bindPageChange();

    // Monta shell en la page activa si existe (F1.1g sandbox o F3 wiring real).
    var current = (typeof window._currentPage === 'string' && window._currentPage)
                || document.body.getAttribute('data-active-page')
                || null;
    if (current) ensureShellMount(current);

    // Countdown — tick inmediato + cada 1s (UNA sola instancia).
    if (_tickInterval) clearInterval(_tickInterval);
    if (Date.now() >= KICKOFF_MS) applyPostKickoffMode();
    tickCountdown();
    _tickInterval = setInterval(tickCountdown, 1000);

    window.addEventListener('beforeunload', function () {
      if (_tickInterval) { clearInterval(_tickInterval); _tickInterval = null; }
    });
  }
  window.mundialShellV3Init = init;

  // Auto-arrancar con red de seguridad (ERR-01) — main-entry también llama init().
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
