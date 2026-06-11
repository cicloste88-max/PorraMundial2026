/* F1.1c · Shell global v3 — fifa-bar (countdown → carrusel partidos del día) + qualified-cta
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

  // SHELL_PAGES donde la fifa-bar es visible (OQ#1 — welcome excluido; predictor incluido desde este fix, antes excluido F3-I2 — convive con ui-pred-shell.js).
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

  // Carrusel partidos del día (fifa-bar-day-carousel, 10-jun).
  var ROTATE_MS = 6000;
  var _carouselInterval = null;
  var _carouselIdx = 0;
  var _madridTimeFmt = null;

  // Hook de QA: window._v3CarouselDebugNow (número) simula cualquier instante
  // del torneo desde consola — afecta al cálculo de kickoff y al carrusel.
  window._v3CarouselDebugNow = window._v3CarouselDebugNow || null;
  function nowMs() {
    return typeof window._v3CarouselDebugNow === 'number'
      ? window._v3CarouselDebugNow
      : Date.now();
  }

  // ── Utils ──────────────────────────────────────────────
  function pad2(n) { return String(n).padStart(2, '0'); }

  function madridHM(ts) {
    // Hora kickoff en Europe/Madrid → {h, m} para los bloques v3-cd-num.
    if (!_madridTimeFmt) {
      _madridTimeFmt = new Intl.DateTimeFormat('es-ES', {
        timeZone: 'Europe/Madrid', hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      });
    }
    var parts = _madridTimeFmt.format(new Date(ts)).split(':');
    return { h: pad2(parts[0]), m: pad2(parts[1]) };
  }

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
      // HF-13: eliminado <div class="v3-fifa-bar__user" data-user-mount></div>.
      // F1.1f-v3 lo añadió como bridge para que renderAuthBar() inyectara
      // admin+avatar+nombre+logout en la fifa-bar. Tras F3-I1.6 los chips
      // ADMIN + ↩ ya viven en el stage-row del shell; este mount duplicaba
      // ADMIN y añadía avatar+nombre (que San decidió quitar). Mount fantasma
      // recreado en cada renderAuthBar() → defenses F3-I1.6.4 no podían
      // detenerlo (apuntaban a #wc-auth-bar, otro elemento distinto).
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
      +     '<div class="v3-qualified-cta__eyebrow">CLASIFICADAS</div>'
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

  // ── Countdown / carrusel tick ──────────────────────────
  function tickCountdown() {
    var now = nowMs();
    var diff = KICKOFF_MS - now;

    if (diff <= 0) {
      // Post-kickoff: parar el tick 1s y arrancar modo carrusel (rotación 6s).
      if (!_kickoffPassed) {
        _kickoffPassed = true;
        if (_tickInterval) { clearInterval(_tickInterval); _tickInterval = null; }
        applyPostKickoffMode();
        refreshCarouselUI();
        startCarouselRotation();
      }
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
    // Carrusel partidos del día: eyebrow (estado) + slide rotatorio.
    // Idempotente por elemento — re-mounts del shell (cambio de page) pasan
    // por aquí vía refreshCarouselUI sin machacar el slide en transición.
    document.querySelectorAll('[data-v3-bar-countdown]').forEach(function (el) {
      if (el.querySelector('[data-v3-carousel]')) return;
      el.innerHTML = ''
        + '<span class="v3-fifa-bar__eyebrow" data-v3-bar-eyebrow>MUNDIAL</span>'
        + '<div class="v3-fifa-bar__carousel" data-v3-carousel>'
        +   '<div class="v3-carousel-slide"></div>'
        + '</div>';
    });
  }

  // Item 8 post-J1: códigos ISO3 — los nombres completos (República de Corea
  // vs República Checa) truncaban ilegibles junto al countdown a 360px.
  // codeFor compartido de window.PCShared (comunidad-shared-v3, el mismo que
  // usa porra-jugador-v3); ese módulo carga DESPUÉS de este en main-entry, de
  // ahí el fallback inline a EQUIPOS por nombre (y 3 letras en último término).
  function teamCode(name) {
    if (window.PCShared && typeof window.PCShared.codeFor === 'function') {
      return window.PCShared.codeFor(name);
    }
    var eqs = (typeof EQUIPOS !== 'undefined') ? EQUIPOS : (window.EQUIPOS || []);
    var e = (eqs && eqs.find) ? eqs.find(function (t) { return t && t.name === name; }) : null;
    return ((e && e.flag) || String(name || '').slice(0, 3)).toUpperCase();
  }

  function carouselSlideHTML(match) {
    var home = teamCode(match.home_es || match.home_en || '—');
    var away = teamCode(match.away_es || match.away_en || '—');
    var mid;
    if (match.isLive) {
      mid = '<span class="v3-carousel-live is-live">EN VIVO</span>';
    } else {
      var t = madridHM(match.date_utc_ms);
      mid = '<div class="v3-carousel-time">'
        + '<div class="v3-cd-block"><span class="v3-cd-num">' + t.h + '</span><span class="v3-cd-lbl">h</span></div>'
        + '<div class="v3-cd-block"><span class="v3-cd-num">' + t.m + '</span><span class="v3-cd-lbl">min</span></div>'
        + '</div>';
    }
    return '<span class="v3-carousel-team">' + home + '</span>'
      + mid
      + '<span class="v3-carousel-team">' + away + '</span>';
  }

  // Swap con fade 300ms — keyed para no re-animar si el contenido no cambia
  // (refreshCarouselUI se llama también en mounts, no solo en rotación).
  function setSlideContent(carouselEl, key, html) {
    var slide = carouselEl.querySelector('.v3-carousel-slide');
    if (!slide) return;
    if (slide.getAttribute('data-slide-key') === key) return;
    if (!slide.innerHTML) {
      // Primer render del slide — sin fade-out previo.
      slide.setAttribute('data-slide-key', key);
      slide.innerHTML = html;
      return;
    }
    slide.setAttribute('data-slide-key', key);
    slide.classList.add('is-leaving');
    setTimeout(function () {
      // Guard: si otro refresh re-keyó el slide durante el fade, ese timeout gana.
      if (slide.getAttribute('data-slide-key') !== key) return;
      slide.innerHTML = html;
      slide.classList.remove('is-leaving');
    }, 300);
  }

  function refreshCarouselUI() {
    if (typeof window.resolveDayMatchesV3 !== 'function') return;
    try {
      applyPostKickoffMode(); // mounts nuevos post-kickoff reciben el markup carrusel.
      var n = nowMs();
      var day = window.resolveDayMatchesV3(n);
      var eyebrows = document.querySelectorAll('[data-v3-bar-eyebrow]');
      var carousels = document.querySelectorAll('[data-v3-carousel]');

      if (!day || day.state === 'pre' || !day.matches.length) {
        // 'pre' (fixtures cargando) o 'post' (torneo acabado): neutro.
        eyebrows.forEach(function (el) {
          el.textContent = 'MUNDIAL';
          el.classList.remove('is-live');
        });
        carousels.forEach(function (el) {
          setSlideContent(el, 'empty', '<span class="v3-carousel-team">—</span>');
        });
      } else {
        var N = day.matches.length;
        _carouselIdx = ((_carouselIdx % N) + N) % N;
        var match = day.matches[_carouselIdx];
        var isLive = !!match.isLive;
        var counter = (_carouselIdx + 1) + '/' + N;
        var eyebrowText = isLive
          ? ('EN VIVO · ' + counter)
          : ((day.state === 'upcoming' ? 'PRÓXIMOS' : 'HOY') + ' · ' + counter);
        var key = match.key + (isLive ? ':live' : ':time');
        var html = carouselSlideHTML(match);

        eyebrows.forEach(function (el) {
          el.textContent = eyebrowText;
          el.classList.toggle('is-live', isLive);
        });
        carousels.forEach(function (el) { setSlideContent(el, key, html); });
      }

      // CONTRATO LEGACY: mundial:next-match-changed sigue despachándose para
      // consumidores externos (Vista Directo, Pichichi banner).
      if (typeof window.resolveNextMatchV3 === 'function') {
        var info = window.resolveNextMatchV3(n);
        if (info && info.match) {
          window.dispatchEvent(new CustomEvent('mundial:next-match-changed', { detail: info }));
        }
      }
    } catch (e) { /* swallow — resolver puede fallar pre-fetch */ }
  }

  function startCarouselRotation() {
    // Patrón idempotente idéntico a _tickInterval: clear antes de set.
    if (_carouselInterval) clearInterval(_carouselInterval);
    _carouselInterval = setInterval(function () {
      _carouselIdx++;
      refreshCarouselUI();
    }, ROTATE_MS);
  }

  // ── Mounting (idempotente por page) ────────────────────
  function ensureShellMount(pageId) {
    // pageId: 'grupos' | 'jornada' | 'directo' | 'elim'.
    if (SHELL_PAGES.indexOf(pageId) === -1) return null;
    var pageEl = document.getElementById('page-' + pageId);
    if (!pageEl) return null;

    var existing = pageEl.querySelector('[data-v3-shell-mount]');
    if (existing) {
      refreshShellUserChips(existing); // F3-I1.6
      return existing;
    }

    var mount = document.createElement('div');
    mount.className = 'phone v3-shell-host';
    mount.setAttribute('data-v3-shell-mount', '');
    mount.innerHTML = fifaBarHTML()
      + (pageId === 'grupos' ? qualifiedCtaHTML() : '')
      + stagePillRowHTML(stageLabelForPage(pageId));

    pageEl.insertBefore(mount, pageEl.firstChild);
    refreshShellUserChips(mount); // F3-I1.6
    // Post-kickoff: el mount nuevo nace con markup countdown — pintarle el
    // carrusel YA (no esperar hasta 6s al siguiente tick de rotación).
    if (_kickoffPassed) refreshCarouselUI();
    return mount;
  }

  function stageLabelForPage(pageId) {
    switch (pageId) {
      case 'grupos':    return '● FASE DE GRUPOS';
      case 'jornada':   return '● JORNADA';
      case 'directo':   return '● EN DIRECTO';
      case 'elim':      return '● FASE FINAL';
      case 'predictor': return '● PREDICTOR';
      default:          return '● MUNDIAL';
    }
  }

  // F3-I1.6 + Polish v1 B1: wrap stage pill con chips dinámicos
  // (left: ADMIN o nombre liga / right: logout o cambiar liga).
  // Contenido + onclick + aria-label se asignan en refreshShellUserChips
  // según currentUser.is_admin + window._myLeagues.length.
  function stagePillRowHTML(label) {
    return '' +
      '<div class="v3-stage-row">' +
        '<button class="v3-shell-chip v3-shell-chip--admin" data-v3-admin-chip>⚙ ADMIN</button>' +
        stagePillHTML(label) +
        '<button class="v3-shell-chip v3-shell-chip--logout" data-v3-logout-chip>↩</button>' +
      '</div>';
  }

  // F3-I1.6 + Polish v1 B1: refresca contenido + comportamiento de chips.
  // - Left chip: admin → "⚙ ADMIN" (→admin); non-admin → nombre liga
  //   (>1 liga → welcome / 1 liga → disabled).
  // - Right chip: >1 liga → "Cambiar liga" (→welcome) / 1 liga → logout.
  // _myLeagues vive en leagues.js y se publica a window._myLeagues + dispara
  // 'mundial:leagues-loaded' tras leagueLoadMyLeagues. Defensivo: si _myLeagues
  // aún no carga, asume 1 liga (caso seguro).
  function refreshShellUserChips(mount) {
    if (!mount) return;
    var leftChip   = mount.querySelector('[data-v3-admin-chip]');
    var logoutChip = mount.querySelector('[data-v3-logout-chip]');
    var hasUser = (typeof currentUser !== 'undefined') && !!currentUser;
    var isAdmin = hasUser && !!currentUser.is_admin;
    var leagues = (window._myLeagues && window._myLeagues.length) || 0;
    var leagueName = (window._activeLeague && window._activeLeague.nombre) || '';

    if (leftChip) {
      if (!hasUser) {
        leftChip.style.display = 'none';
      } else if (isAdmin) {
        leftChip.style.display = 'inline-flex';
        leftChip.textContent = '⚙ ADMIN';
        leftChip.setAttribute('aria-label', 'Panel admin');
        leftChip.style.opacity = '';
        leftChip.style.cursor = '';
        leftChip.classList.add('v3-shell-chip--admin');
        leftChip.classList.remove('v3-shell-chip--league');
        leftChip.onclick = function () {
          if (typeof showPage === 'function') showPage('admin');
        };
      } else if (leagueName) {
        leftChip.style.display = 'inline-flex';
        leftChip.textContent = leagueName;
        leftChip.classList.remove('v3-shell-chip--admin');
        leftChip.classList.add('v3-shell-chip--league');
        if (leagues > 1) {
          leftChip.setAttribute('aria-label', 'Cambiar de liga');
          leftChip.style.opacity = '';
          leftChip.style.cursor = '';
          leftChip.onclick = function () {
            if (typeof showPage === 'function') showPage('welcome');
          };
        } else {
          leftChip.setAttribute('aria-label', leagueName);
          leftChip.style.opacity = '0.5';
          leftChip.style.cursor = 'default';
          leftChip.onclick = null;
        }
      } else {
        leftChip.style.display = 'none';
      }
    }

    if (logoutChip) {
      if (!hasUser) {
        logoutChip.style.display = 'none';
      } else {
        logoutChip.style.display = 'inline-flex';
        logoutChip.textContent = '↩';
        if (leagues > 1) {
          logoutChip.setAttribute('aria-label', 'Cambiar de liga');
          logoutChip.onclick = function () {
            if (typeof showPage === 'function') showPage('welcome');
          };
        } else {
          logoutChip.setAttribute('aria-label', 'Cerrar sesión');
          logoutChip.onclick = function () {
            if (typeof doLogout === 'function') doLogout();
          };
        }
      }
    }

    // F3-I1.6.4: refuerzo defensivo — ocultar wc-auth-bar legacy en
    // shell pages. F-01 (19-may): NO ocultar cuando la welcome (selector
    // de liga) está visible — su botón "Cerrar sesión" vive en wc-auth-bar
    // y este refresh se dispara por mundial:leagues-loaded justo después
    // de mostrar el panel, escondiéndolo a los segundos del login.
    var authBar = document.getElementById('wc-auth-bar');
    if (authBar) {
      var welcomeEl = document.getElementById('page-welcome');
      var welcomeVisible = welcomeEl && welcomeEl.style.display !== 'none';
      if (!welcomeVisible) authBar.style.display = 'none';
    }
  }
  window.refreshShellUserChips = refreshShellUserChips;

  // Polish v1 B1: re-render chips cuando _myLeagues carga (post-login o tras
  // navegar a welcome). leagues.js dispara este event tras leagueLoadMyLeagues.
  window.addEventListener('mundial:leagues-loaded', function () {
    document.querySelectorAll('[data-v3-shell-mount]').forEach(refreshShellUserChips);
  });

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
    // Si init() ya es post-kickoff: sin tick 1s, directo a modo carrusel.
    if (_tickInterval) { clearInterval(_tickInterval); _tickInterval = null; }
    if (nowMs() >= KICKOFF_MS) {
      _kickoffPassed = true;
      applyPostKickoffMode();
      refreshCarouselUI();
      startCarouselRotation();
    } else {
      tickCountdown();
      _tickInterval = setInterval(tickCountdown, 1000);
    }

    window.addEventListener('beforeunload', function () {
      if (_tickInterval) { clearInterval(_tickInterval); _tickInterval = null; }
      if (_carouselInterval) { clearInterval(_carouselInterval); _carouselInterval = null; }
    });
  }
  window.mundialShellV3Init = init;

  // F3-I1.6.2: suscribir a cambios de auth para refrescar chips
  // ADMIN/logout cuando el user state cambie DESPUÉS del primer mount.
  // Causa raíz del bug "logout no funciona": refreshShellUserChips
  // solo se llamaba 1 vez al montar shell, leyendo currentUser en ese
  // momento (típicamente welcome con user=null). Tras login, branch
  // idempotente del ensureShellMount NO re-evaluaba → chips quedaban
  // display:none → no recibían clicks aunque listener .do-logout de
  // auth.js es correcto.
  function subscribeAuthChangesForChips() {
    if (window._v3ShellAuthSubscribed) return;
    if (!window._porraDb || !window._porraDb.auth) {
      // Retry: data.js debería haber creado el cliente antes que
      // mundial-shell-v3 en main-entry, pero seguro por si load order.
      return setTimeout(subscribeAuthChangesForChips, 200);
    }
    window._v3ShellAuthSubscribed = true;
    window._porraDb.auth.onAuthStateChange(function (event, session) {
      // TOKEN_REFRESHED / USER_UPDATED: auth.js los ignora (se emiten
      // al cambiar de pestaña). Nosotros tampoco refrescamos.
      if (event === 'TOKEN_REFRESHED' || event === 'USER_UPDATED') return;
      // setTimeout(0): dejar que el handler de auth.js termine primero
      // (es quien popula window.currentUser tras consultar profiles).
      setTimeout(function () {
        var mounts = document.querySelectorAll('[data-v3-shell-mount]');
        for (var i = 0; i < mounts.length; i++) {
          refreshShellUserChips(mounts[i]);
        }
      }, 0);
    });
  }

  // Init: la suscripción es seguro hacerla pre-DOM ready (sólo
  // registra callback).
  subscribeAuthChangesForChips();

  // F3-I1.6.4: restaurar wc-auth-bar al volver a welcome. Listener
  // del mismo event que dispara showPage (ui-nav.js F3-I1).
  window.addEventListener('mundial:page-changed', function (e) {
    var page = e && e.detail && e.detail.page;
    var bar = document.getElementById('wc-auth-bar');
    if (!bar) return;
    if (page === 'welcome') {
      // En welcome, restaurar visibilidad (CSS default = flex via renderAuthBar).
      bar.style.removeProperty('display');
    } else {
      // SHELL_PAGES y otras: oculto.
      bar.style.display = 'none';
    }
  });

  // Auto-arrancar con red de seguridad (ERR-01) — main-entry también llama init().
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
