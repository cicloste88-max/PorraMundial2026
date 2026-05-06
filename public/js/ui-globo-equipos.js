// ═══════════════════════════════════════════════════════════════
// ui-globo-equipos.js — Sprint Globo MVP
// Cinta dorada en #page-grupos + overlay full-screen con globo 3D
// (globe.gl@2.33.0 lazy-loaded). Expone window._mountGloboCinta(container).
// Referencia API: docs/globo-mundial-2026-REFERENCIA.html
// ═══════════════════════════════════════════════════════════════
(function () {
  'use strict';

  // ── Config externa ───────────────────────────────────────────
  var GLOBE_GL_CDN = 'https://cdn.jsdelivr.net/npm/globe.gl@2.33.0/dist/globe.gl.min.js';
  var GEOJSON_URL  = 'https://cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector@master/geojson/ne_50m_admin_0_countries.geojson';

  // ── Aliases EQUIPOS.name_en → propiedad NAME en NE 50m ───────
  var ALIAS_NE = {
    'England': 'United Kingdom',
    'Scotland': 'United Kingdom',
    'Bosnia & Herzegovina': 'Bosnia and Herz.',
    'Bosnia and Herzegovina': 'Bosnia and Herz.',
    'Türkiye': 'Turkey',
    'Cape Verde': 'Cabo Verde',
    'Ivory Coast': "Côte d'Ivoire",
    'DR Congo': 'Dem. Rep. Congo',
    'Democratic Republic of the Congo': 'Dem. Rep. Congo',
    'Korea': 'South Korea',
    'Republic of Korea': 'South Korea',
    'USA': 'United States',
    'United States of America': 'United States'
  };

  function norm(n) {
    if (!n) return '';
    var t = ('' + n).trim();
    return ALIAS_NE[t] || t;
  }

  // ── 16 sedes Mundial 2026 ────────────────────────────────────
  var SEDES = [
    { name: 'Los Ángeles',      lat: 34.05, lng: -118.24, nameKey: 'Los Ángeles' },
    { name: 'San Francisco',    lat: 37.35, lng: -121.95, nameKey: 'San Francisco' },
    { name: 'Seattle',          lat: 47.61, lng: -122.33, nameKey: 'Seattle' },
    { name: 'Dallas',           lat: 32.74, lng:  -97.09, nameKey: 'Dallas' },
    { name: 'Houston',          lat: 29.76, lng:  -95.37, nameKey: 'Houston' },
    { name: 'Kansas City',      lat: 39.10, lng:  -94.58, nameKey: 'Kansas City' },
    { name: 'Atlanta',          lat: 33.75, lng:  -84.39, nameKey: 'Atlanta' },
    { name: 'Miami',            lat: 25.96, lng:  -80.24, nameKey: 'Miami' },
    { name: 'Boston',           lat: 42.07, lng:  -71.25, nameKey: 'Boston' },
    { name: 'Nueva York',       lat: 40.82, lng:  -74.07, nameKey: 'Nueva York' },
    { name: 'Filadelfia',       lat: 39.90, lng:  -75.17, nameKey: 'Filadelfia' },
    { name: 'Ciudad de México', lat: 19.43, lng:  -99.13, nameKey: 'Ciudad de México' },
    { name: 'Monterrey',        lat: 25.67, lng: -100.31, nameKey: 'Monterrey' },
    { name: 'Guadalajara',      lat: 20.67, lng: -103.35, nameKey: 'Guadalajara' },
    { name: 'Vancouver',        lat: 49.26, lng: -123.11, nameKey: 'Vancouver' },
    { name: 'Toronto',          lat: 43.65, lng:  -79.38, nameKey: 'Toronto' }
  ];

  // ── Lookup EQUIPOS.name_en → clave en WIKI_SELECCIONES ───────
  var ALIAS_WIKI = {
    'Bosnia & Herzegovina':      'Bosnia & Herzegovina',
    'Bosnia and Herzegovina':    'Bosnia & Herzegovina',
    'Ivory Coast':               'Ivory Coast',
    "Côte d'Ivoire":             'Ivory Coast',
    'Korea':                     'Korea',
    'Republic of Korea':         'Korea',
    'South Korea':               'Korea',
    'USA':                       'USA',
    'United States':             'USA',
    'United States of America':  'USA',
    'Netherlands':               'Netherlands',
    'Curaçao':                   'Curaçao',
    'Türkiye':                   'Turkey',
    'England':                   'England',
    'Scotland':                  'Scotland',
    // Aliases NE 50m → key WIKI (cuando el click viene de un polígono)
    'United Kingdom':            'England',
    'Bosnia and Herz.':          'Bosnia & Herzegovina',
    'Cabo Verde':                'Cape Verde',
    'Dem. Rep. Congo':           'DR Congo',
    'Czechia':                   'Czech Republic'
  };

  function getWikiSel(name_en) {
    if (!name_en) return null;
    var key = ALIAS_WIKI[name_en] || name_en;
    var data = (typeof window.WIKI_SELECCIONES !== 'undefined') ? window.WIKI_SELECCIONES : null;
    return data ? (data[key] || null) : null;
  }

  // ── Paleta cartográfica (HEX puros, NO rgba para atmosphere) ─
  var COL = {
    OCEAN:       '#1e4d6b',
    LAND:        '#3d4f2e',
    LAND_STROKE: '#5d6f4a',
    LAND_SIDE:   '#2a3520',
    GOLD:        '#e8b830',
    GOLD_STROKE: '#ffd866',
    GOLD_SIDE:   '#c89420',
    ATMOS:       '#7eb6d8'
  };

  // ── HTML templates ──────────────────────────────────────────
  var CINTA_HTML =
    '<div class="fc-globo-cinta" role="button" tabindex="0" aria-label="Conoce las selecciones del Mundial 2026">' +
      '<svg class="fc-globo-cinta__svg" viewBox="0 0 24 24" aria-hidden="true">' +
        '<defs><clipPath id="fc-globo-clip"><circle cx="12" cy="12" r="9.6"/></clipPath></defs>' +
        '<circle cx="12" cy="12" r="9.6" fill="rgba(232,184,48,0.08)" stroke="#e8b830" stroke-width="1.3"/>' +
        '<ellipse cx="12" cy="12" rx="9.6" ry="3.5" fill="none" stroke="#e8b830" stroke-width="0.8" opacity="0.55"/>' +
        '<line x1="2.4" y1="12" x2="21.6" y2="12" stroke="#e8b830" stroke-width="0.8" opacity="0.55"/>' +
        '<g class="continents" clip-path="url(#fc-globo-clip)">' +
          '<path d="M5 9 Q7 7 9 9 T12 10 Q11 12 9 12 Q7 11 5 9 Z" fill="#e8b830" opacity="0.85"/>' +
          '<path d="M14 7 Q17 6 18 9 Q17 11 15 10 Q14 9 14 7 Z" fill="#ffd866" opacity="0.9"/>' +
          '<ellipse cx="10" cy="16" rx="3" ry="1.4" fill="#e8b830" opacity="0.8"/>' +
          '<circle cx="17" cy="15" r="1.3" fill="#ffd866" opacity="0.85"/>' +
        '</g>' +
      '</svg>' +
      '<div class="fc-globo-cinta__txt">' +
        '<div class="fc-globo-cinta__main">Conoce las selecciones</div>' +
        '<div class="fc-globo-cinta__sub">Recorre los 48 mundialistas y sus 16 sedes</div>' +
      '</div>' +
      '<span class="fc-globo-cinta__chev" aria-hidden="true">›</span>' +
    '</div>';

  var OVERLAY_HTML =
    '<div class="fc-globo-overlay" id="fc-globo-overlay" role="dialog" aria-modal="true" aria-label="Globo Mundial 2026">' +
      '<div class="fc-globo-overlay__hdr">' +
        '<span class="fc-globo-overlay__tit">🌍 GLOBO MUNDIAL <span class="g">2026</span></span>' +
        '<button type="button" class="fc-globo-overlay__close" id="fc-globo-close" aria-label="Cerrar">✕</button>' +
      '</div>' +
      '<div class="fc-globo-overlay__msg" id="fc-globo-msg">Cargando librería…</div>' +
      '<div class="fc-globo-overlay__canvas" id="fc-globo-canvas"></div>' +
      '<div class="fc-globo-overlay__leg">' +
        '<div class="fc-globo-overlay__leg-items">' +
          '<span><span class="fc-globo-overlay__dot fc-globo-overlay__dot--gold"></span>clasificados</span>' +
          '<span><span class="fc-globo-overlay__dot fc-globo-overlay__dot--white"></span>sedes</span>' +
        '</div>' +
        '<div class="fc-globo-flags" id="fc-globo-flags"></div>' +
      '</div>' +
      '<div class="fc-globo-detail" id="fc-globo-detail" aria-live="polite">' +
        '<button type="button" class="fc-globo-detail__close" id="fc-globo-detail-close" aria-label="Cerrar detalle">✕</button>' +
        '<div class="fc-globo-detail__body" id="fc-globo-detail-body"></div>' +
      '</div>' +
    '</div>';

  // ── Helpers ─────────────────────────────────────────────────
  function showMsg(msgEl, txt, isError) {
    if (!msgEl) return;
    msgEl.textContent = (isError ? '⚠ ' : '') + txt;
    msgEl.classList.remove('is-hidden');
    msgEl.classList.toggle('is-error', !!isError);
  }

  function hideMsg(msgEl) {
    if (msgEl) msgEl.classList.add('is-hidden');
  }

  // ── Panel de detalle (país / sede) ───────────────────────────
  function openDetail(html) {
    var panel = document.getElementById('fc-globo-detail');
    var body  = document.getElementById('fc-globo-detail-body');
    if (!panel || !body) return;
    body.innerHTML = html;
    panel.classList.add('is-open');
  }

  function closeDetail() {
    var panel = document.getElementById('fc-globo-detail');
    if (panel) panel.classList.remove('is-open');
  }

  function renderPanelPais(wikiData, nombrePais) {
    var w = wikiData || {};
    var coachLine = w.coach
      ? '<div class="fc-globo-detail__row"><span class="fc-globo-detail__lbl">Entrenador</span><span>' + w.coach + '</span></div>'
      : '';
    var estrella = w.estrella ? (
      '<div class="fc-globo-detail__estrella">' +
        '<span class="fc-globo-detail__estrella-pos">' + (w.estrella_pos || '') + '</span>' +
        '<span class="fc-globo-detail__estrella-nom">' + w.estrella + '</span>' +
        (w.estrella_club ? '<span class="fc-globo-detail__estrella-club">' + w.estrella_club + '</span>' : '') +
      '</div>'
    ) : '';
    return (
      '<div class="fc-globo-detail__hdr">' +
        '<span class="fc-globo-detail__title">' + nombrePais + '</span>' +
        '<span class="fc-globo-detail__sub">' + (w.apodo || '') + '</span>' +
      '</div>' +
      '<div class="fc-globo-detail__stats">' +
        (w.grupo  ? '<div class="fc-globo-detail__row"><span class="fc-globo-detail__lbl">Grupo</span><span>' + w.grupo + '</span></div>' : '') +
        (w.confed ? '<div class="fc-globo-detail__row"><span class="fc-globo-detail__lbl">Confederación</span><span>' + w.confed + '</span></div>' : '') +
        '<div class="fc-globo-detail__row"><span class="fc-globo-detail__lbl">Mundiales</span><span>' + (w.mundiales || '—') + '</span></div>' +
        (w.mejor  ? '<div class="fc-globo-detail__row"><span class="fc-globo-detail__lbl">Mejor resultado</span><span>' + w.mejor + '</span></div>' : '') +
        coachLine +
      '</div>' +
      (estrella ? '<div class="fc-globo-detail__section-lbl">Estrella</div>' + estrella : '') +
      (w.frase ? '<p class="fc-globo-detail__frase">"' + w.frase + '"</p>' : '') +
      '<div class="fc-globo-detail__attr">Datos: sport.es / Wikipedia CC BY-SA</div>'
    );
  }

  function renderPanelSede(wikiData, nombreSede) {
    var w = wikiData || {};
    var isFinal = w.max_ronda && w.max_ronda.indexOf('FINAL') !== -1;
    var capacidad = (typeof w.capacidad === 'number')
      ? w.capacidad.toLocaleString('es')
      : (w.capacidad || '');
    return (
      '<div class="fc-globo-detail__hdr fc-globo-detail__hdr--sede">' +
        '<span class="fc-globo-detail__title">📍 ' + (w.estadio || nombreSede) + '</span>' +
        '<span class="fc-globo-detail__sub">' + (w.pais || '') + '</span>' +
      '</div>' +
      '<div class="fc-globo-detail__stats">' +
        (capacidad      ? '<div class="fc-globo-detail__row"><span class="fc-globo-detail__lbl">Capacidad</span><span>' + capacidad + '</span></div>' : '') +
        (w.inauguracion ? '<div class="fc-globo-detail__row"><span class="fc-globo-detail__lbl">Inaugurado</span><span>' + w.inauguracion + '</span></div>' : '') +
        (w.equipo_local ? '<div class="fc-globo-detail__row"><span class="fc-globo-detail__lbl">Equipo local</span><span>' + w.equipo_local + '</span></div>' : '') +
        (w.max_ronda    ? '<div class="fc-globo-detail__row"><span class="fc-globo-detail__lbl">Hasta</span><span class="' + (isFinal ? 'fc-globo-detail__final' : '') + '">' + w.max_ronda + '</span></div>' : '') +
      '</div>' +
      (w.dato ? '<p class="fc-globo-detail__frase">' + w.dato + '</p>' : '') +
      '<div class="fc-globo-detail__attr">Datos: sport.es</div>'
    );
  }

  // ── Leyenda de banderas (rejilla scrollable de 48) ───────────
  function renderFlagsLegend(globe) {
    var flagsEl = document.getElementById('fc-globo-flags');
    if (!flagsEl) return;
    var arr = (typeof window.EQUIPOS !== 'undefined') ? window.EQUIPOS
            : (typeof EQUIPOS !== 'undefined')        ? EQUIPOS : [];
    if (!arr.length) return;
    if (flagsEl._fcRendered) return; // idempotente
    flagsEl._fcRendered = true;

    var html = arr.map(function (e) {
      var flag   = e.flag || e.flag_emoji || '';
      var name   = e.name || e.name_en || '';
      var nameEn = e.name_en || name;
      var lat    = (typeof e.lat === 'number') ? e.lat : 0;
      var lng    = (typeof e.lng === 'number') ? e.lng : 0;
      return (
        '<button type="button" class="fc-globo-flag-btn" ' +
          'data-name-en="' + nameEn.replace(/"/g, '&quot;') + '" ' +
          'data-lat="' + lat + '" data-lng="' + lng + '" ' +
          'title="' + name + '">' +
          '<span class="fc-globo-flag-btn__flag">' + flag + '</span>' +
          '<span class="fc-globo-flag-btn__name">' + name + '</span>' +
        '</button>'
      );
    }).join('');

    flagsEl.innerHTML = html;

    // Event delegation: click bandera → animar globo + abrir panel
    flagsEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.fc-globo-flag-btn');
      if (!btn || !globe) return;
      var nameEn = btn.dataset.nameEn;
      var lat    = parseFloat(btn.dataset.lat);
      var lng    = parseFloat(btn.dataset.lng);
      var name   = btn.querySelector('.fc-globo-flag-btn__name').textContent;

      // Si EQUIPOS no trae lat/lng, derivar centroide aproximado del polígono
      var targetLat = lat;
      var targetLng = lng;
      if (!lat && !lng) {
        var feats = (typeof globe.polygonsData === 'function') ? globe.polygonsData() : [];
        var feat = feats.find(function (f) {
          if (!f || !f.properties) return false;
          var n = f.properties.name || '';
          return n === nameEn || norm(nameEn) === n;
        });
        if (feat && feat.geometry && feat.geometry.coordinates) {
          var coords = feat.geometry.type === 'Polygon'
            ? feat.geometry.coordinates[0]
            : feat.geometry.type === 'MultiPolygon' ? feat.geometry.coordinates[0][0] : [];
          if (coords.length) {
            var lons = coords.map(function (c) { return c[0]; });
            var lats = coords.map(function (c) { return c[1]; });
            targetLng = (Math.min.apply(null, lons) + Math.max.apply(null, lons)) / 2;
            targetLat = (Math.min.apply(null, lats) + Math.max.apply(null, lats)) / 2;
          }
        }
      }

      var ctrl = (typeof globe.controls === 'function') ? globe.controls() : null;
      if (ctrl) ctrl.autoRotate = false;

      if (typeof targetLat === 'number' && typeof targetLng === 'number' && !isNaN(targetLat) && !isNaN(targetLng)) {
        globe.pointOfView({ lat: targetLat, lng: targetLng, altitude: 2.2 }, 800);
      }

      setTimeout(function () {
        if (ctrl) { ctrl.autoRotate = true; ctrl.autoRotateSpeed = 0.4; }
      }, 3000);

      var wikiData = getWikiSel(nameEn);
      openDetail(renderPanelPais(wikiData, name));

      flagsEl.querySelectorAll('.fc-globo-flag-btn').forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
    });
  }

  // Lazy-load globe.gl la primera vez. Resuelve con window.Globe.
  var _libPromise = null;
  function loadGlobeGL() {
    if (typeof window.Globe === 'function') return Promise.resolve(window.Globe);
    if (_libPromise) return _libPromise;
    _libPromise = new Promise(function (resolve, reject) {
      var s = document.createElement('script');
      s.src = GLOBE_GL_CDN;
      s.async = true;
      s.onload = function () {
        if (typeof window.Globe === 'function') resolve(window.Globe);
        else reject(new Error('globe.gl cargado pero window.Globe no expuesto'));
      };
      s.onerror = function () { reject(new Error('No se pudo cargar globe.gl desde el CDN')); };
      document.head.appendChild(s);
    });
    return _libPromise;
  }

  // Construir Set de países mundialistas desde EQUIPOS (fuente única).
  function buildPaisesSet() {
    var paises = new Set();
    var faltanInfo = [];
    var arr = (typeof window.EQUIPOS !== 'undefined' && Array.isArray(window.EQUIPOS)) ? window.EQUIPOS
            : (typeof EQUIPOS    !== 'undefined' && Array.isArray(EQUIPOS))            ? EQUIPOS
            : null;
    if (!arr) {
      console.warn('[globo] EQUIPOS no disponible al construir Set de países');
      return { paises: paises, source: [] };
    }
    arr.forEach(function (e) {
      var raw = e && e.name_en;
      if (!raw) { faltanInfo.push({ name: e && e.name, reason: 'sin name_en' }); return; }
      paises.add(norm(raw));
    });
    if (faltanInfo.length) console.warn('[globo] EQUIPOS sin name_en:', faltanInfo);
    return { paises: paises, source: arr };
  }

  // Crear textura ocean 4×4 → dataURL para globeImageUrl
  function buildOceanTexture() {
    var c = document.createElement('canvas');
    c.width = 4; c.height = 4;
    var ctx = c.getContext('2d');
    ctx.fillStyle = COL.OCEAN;
    ctx.fillRect(0, 0, 4, 4);
    return c.toDataURL();
  }

  // Inicializar globo dentro de canvasEl. Devuelve Promise<globeInstance>.
  function initGlobo(canvasEl, msgEl) {
    return loadGlobeGL()
      .then(function (Globe) {
        showMsg(msgEl, 'Cargando datos…', false);

        var oceanTex = buildOceanTexture();
        // Factory pattern (NO `new Globe()`)
        var globe = Globe();
        globe(canvasEl);

        // Limitar pixel ratio retina (mobile 2x/3x → 1.5 max). Nitidez
        // suficiente sin overdraw en displays de alta densidad.
        var renderer = globe.renderer && globe.renderer();
        if (renderer && typeof renderer.setPixelRatio === 'function') {
          renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
        }

        globe
          .globeImageUrl(oceanTex)
          .backgroundImageUrl('')
          .atmosphereColor(COL.ATMOS)
          .atmosphereAltitude(0.10)
          .showGraticules(false);
        globe.width(canvasEl.clientWidth);
        globe.height(canvasEl.clientHeight);

        var ctrl = globe.controls();
        if (ctrl) {
          ctrl.autoRotate = true;
          ctrl.autoRotateSpeed = 0.4;
          ctrl.enableZoom = true;
        }
        // Altitude responsive: mobile (<768) cámara más lejos para que el
        // globo entre completo en el ancho del viewport vertical estrecho.
        var initialAlt = window.innerWidth < 768 ? 5.0 : 4.2;
        globe.pointOfView({ lat: 20, lng: 0, altitude: initialAlt });

        // Pause autoRotate durante interacción
        var rotateTimer;
        canvasEl.addEventListener('pointerdown', function () {
          clearTimeout(rotateTimer);
          if (ctrl) ctrl.autoRotateSpeed = 0.08;
        });
        canvasEl.addEventListener('pointerup', function () {
          rotateTimer = setTimeout(function () {
            if (ctrl) ctrl.autoRotateSpeed = 0.4;
          }, 1500);
        });

        // Resize listener (overlay full-screen → ajustar al viewport).
        // Recalcula altitude responsive en rotación de dispositivo, pero
        // solo si la diferencia con la actual >0.5 (no resetea zoom manual).
        var onResize = function () {
          globe.width(canvasEl.clientWidth);
          globe.height(canvasEl.clientHeight);
          var newAlt = window.innerWidth < 768 ? 5.0 : 4.2;
          var pov = globe.pointOfView();
          if (pov && Math.abs(pov.altitude - newAlt) > 0.5) {
            globe.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: newAlt }, 400);
          }
        };
        window.addEventListener('resize', onResize);
        globe._fcOnResize = onResize;

        // Fetch GeoJSON con manejo robusto de errores
        return fetch(GEOJSON_URL)
          .then(function (r) {
            if (!r.ok) throw new Error('HTTP ' + r.status + ' al pedir GeoJSON');
            return r.json();
          })
          .then(function (geo) {
            if (!geo || !Array.isArray(geo.features)) {
              throw new Error('GeoJSON sin features válidas');
            }
            var built = buildPaisesSet();
            var PAISES = built.paises;

            var feats = geo.features.map(function (f) {
              var props = f.properties || {};
              var n = props.NAME || props.ADMIN || '';
              var es = PAISES.has(norm(n));
              return Object.assign({}, f, {
                properties: Object.assign({}, props, { name: n, esMundial: es })
              });
            });

            // Diagnóstico: países en EQUIPOS sin polígono NE
            var encontradosNE = new Set();
            feats.forEach(function (f) { if (f.properties.esMundial) encontradosNE.add(f.properties.name); });
            var faltan = [];
            PAISES.forEach(function (p) { if (!encontradosNE.has(p)) faltan.push(p); });
            console.log('[globo] OK: ' + encontradosNE.size + ' polígonos pintados (UK cubre England+Scotland → ' + PAISES.size + ' selecciones lógicas)');
            if (faltan.length) console.warn('[globo] Países en EQUIPOS sin polígono NE:', faltan);

            globe.polygonsData(feats)
              .polygonCapColor(function (f) { return f.properties.esMundial ? COL.GOLD : COL.LAND; })
              .polygonStrokeColor(function (f) { return f.properties.esMundial ? COL.GOLD_STROKE : COL.LAND_STROKE; })
              .polygonAltitude(function (f) { return f.properties.esMundial ? 0.022 : 0.006; })
              .polygonSideColor(function (f) { return f.properties.esMundial ? COL.GOLD_SIDE : COL.LAND_SIDE; })
              .polygonLabel(function (f) {
                var n = f.properties.name || '';
                var b = f.properties.esMundial
                  ? ' <span style="background:#e8b830;color:#000;font-size:9px;padding:1px 5px;border-radius:3px;font-weight:700">⚽ CLASIFICADO</span>'
                  : '';
                return '<div style="background:rgba(20,28,44,.95);border:1px solid rgba(232,184,48,.4);border-radius:6px;padding:6px 10px;color:#fff;font-size:11px"><b>' + n + '</b>' + b + '</div>';
              });

            globe.pointsData(SEDES.map(function (s) { return { lat: s.lat, lng: s.lng, name: s.name, nameKey: s.nameKey }; }))
              .pointColor(function () { return '#ffffff'; })
              .pointAltitude(0.04)
              .pointRadius(0.5)
              .pointResolution(20)
              .pointLabel(function (p) {
                return '<div style="background:rgba(20,28,44,.95);border:1px solid rgba(232,184,48,.4);border-radius:6px;padding:6px 10px;color:#fff;font-size:11px"><b>📍 ' + p.name + '</b><br><span style="color:#aaa;font-size:10px">Sede Mundial 2026</span></div>';
              });

            // Click en país → panel detalle + navegar (si hay coords del click)
            if (typeof globe.onPolygonClick === 'function') {
              globe.onPolygonClick(function (feat) {
                if (!feat || !feat.properties) return;
                var name = feat.properties.name || '';
                var wikiData = getWikiSel(name);
                // Ignorar países no clasificados sin datos wiki
                if (!wikiData && !feat.properties.esMundial) return;
                openDetail(renderPanelPais(wikiData, name));

                var ctrl = (typeof globe.controls === 'function') ? globe.controls() : null;
                if (ctrl) ctrl.autoRotate = false;
                if (globe._lastClickCoords) {
                  globe.pointOfView({
                    lat: globe._lastClickCoords.lat,
                    lng: globe._lastClickCoords.lng,
                    altitude: 2.2
                  }, 600);
                }
                setTimeout(function () {
                  if (ctrl) { ctrl.autoRotate = true; ctrl.autoRotateSpeed = 0.4; }
                }, 3000);
              });
            }

            // Click en sede (punto blanco) → panel sede + zoom
            if (typeof globe.onPointClick === 'function') {
              globe.onPointClick(function (point) {
                if (!point) return;
                var key = point.nameKey || point.name;
                var wikiData = (typeof window.WIKI_SEDES !== 'undefined') ? window.WIKI_SEDES[key] : null;
                openDetail(renderPanelSede(wikiData, point.name));

                var ctrl = (typeof globe.controls === 'function') ? globe.controls() : null;
                if (ctrl) ctrl.autoRotate = false;
                globe.pointOfView({ lat: point.lat, lng: point.lng, altitude: 1.5 }, 800);
                setTimeout(function () {
                  if (ctrl) { ctrl.autoRotate = true; ctrl.autoRotateSpeed = 0.4; }
                }, 3000);
              });
            }

            // Guardar coords del último click sobre el canvas para que
            // onPolygonClick navegue al punto exacto donde el usuario tocó.
            // toGlobeCoords es API pública de globe.gl v2.x.
            canvasEl.addEventListener('click', function (e) {
              if (typeof globe.toGlobeCoords === 'function') {
                var rect = canvasEl.getBoundingClientRect();
                var x = e.clientX - rect.left;
                var y = e.clientY - rect.top;
                var coords = globe.toGlobeCoords(x, y);
                if (coords) globe._lastClickCoords = coords;
              }
            });

            hideMsg(msgEl);
            return globe;
          });
      });
  }

  // ── Overlay lifecycle ───────────────────────────────────────
  function ensureOverlay() {
    var overlay = document.getElementById('fc-globo-overlay');
    if (overlay) return overlay;
    var wrap = document.createElement('div');
    wrap.innerHTML = OVERLAY_HTML;
    overlay = wrap.firstElementChild;
    document.body.appendChild(overlay);

    var closeBtn = overlay.querySelector('#fc-globo-close');
    if (closeBtn) closeBtn.addEventListener('click', closeOverlay);

    // Click en backdrop (no en hijos) cierra. Botón cerrar del panel
    // detalle se delega en el mismo listener (id estable en el DOM).
    overlay.addEventListener('click', function (e) {
      if (e.target && e.target.id === 'fc-globo-detail-close') {
        closeDetail();
        return;
      }
      if (e.target === overlay) closeOverlay();
    });

    // ESC cierra. Si el panel detalle está abierto, primero lo cierra;
    // un segundo ESC cierra el overlay completo.
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape' || !overlay.classList.contains('is-open')) return;
      var detail = document.getElementById('fc-globo-detail');
      if (detail && detail.classList.contains('is-open')) {
        closeDetail();
      } else {
        closeOverlay();
      }
    });

    return overlay;
  }

  function openOverlay() {
    var overlay = ensureOverlay();
    overlay.classList.add('is-open');
    document.body.style.overflow = 'hidden';

    var canvas = overlay.querySelector('#fc-globo-canvas');
    var msg    = overlay.querySelector('#fc-globo-msg');

    if (window._globoInstance) {
      // Instancia cacheada → ajustar tamaño al viewport actual y mostrar
      try {
        window._globoInstance.width(canvas.clientWidth);
        window._globoInstance.height(canvas.clientHeight);
      } catch (_) { /* defensivo */ }
      hideMsg(msg);
      renderFlagsLegend(window._globoInstance);
      return;
    }

    showMsg(msg, 'Cargando librería…', false);
    initGlobo(canvas, msg)
      .then(function (g) {
        window._globoInstance = g;
        renderFlagsLegend(g);
      })
      .catch(function (err) {
        console.error('[globo] init error:', err);
        showMsg(msg, 'No se pudo cargar el globo: ' + (err && err.message ? err.message : 'error desconocido'), true);
      });
  }

  function closeOverlay() {
    var overlay = document.getElementById('fc-globo-overlay');
    if (overlay) overlay.classList.remove('is-open');
    document.body.style.overflow = '';
    closeDetail();
    var flags = document.getElementById('fc-globo-flags');
    if (flags) {
      flags.querySelectorAll('.fc-globo-flag-btn.is-active').forEach(function (b) {
        b.classList.remove('is-active');
      });
    }
  }

  // ── API pública: monta la cinta dentro de container ─────────
  // Idempotente: si ya hay .fc-globo-cinta dentro, no duplica.
  function _mountGloboCinta(container) {
    if (!container || container.querySelector('.fc-globo-cinta')) return;
    var wrap = document.createElement('div');
    wrap.innerHTML = CINTA_HTML;
    var cinta = wrap.firstElementChild;
    cinta.addEventListener('click', openOverlay);
    cinta.addEventListener('keydown', function (e) {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        openOverlay();
      }
    });
    container.appendChild(cinta);
  }

  window._mountGloboCinta = _mountGloboCinta;
})();
