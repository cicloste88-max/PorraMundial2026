// ═══════════════════════════════════════════════════════════════
// ui-globo-equipos.js — Sprint Globo MVP
// Overlay full-screen con globo 3D (globe.gl@2.33.0 lazy-loaded).
// Expone window._openGloboOverlay() — invocado desde el CTA "Conoce a las 48"
// del shell v3 (D8 ELIMINA la cinta dorada antigua; F1.1e refactor).
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

  // Coordenadas manuales para países con bounding box engañoso
  // (territorios remotos: Alaska, Hawaii, Guayana francesa, etc.)
  // Se aplican antes que el centroide de polygonsData.
  var COUNTRY_LATLNG_OVERRIDE = {
    'United States':  { lat: 39.5, lng:  -98.5 },
    'USA':            { lat: 39.5, lng:  -98.5 },
    'Canada':         { lat: 56.0, lng: -106.0 },
    'France':         { lat: 46.6, lng:    2.5 },
    'United Kingdom': { lat: 54.0, lng:   -2.5 },
    'England':        { lat: 52.5, lng:   -1.5 },
    'Scotland':       { lat: 56.5, lng:   -4.0 },
    'Norway':         { lat: 64.0, lng:   11.0 },
    'New Zealand':    { lat: -41.0, lng: 174.0 },
    'Brazil':         { lat: -10.5, lng: -53.0 },
    'Russia':         { lat: 60.0, lng:   95.0 },
    'Australia':      { lat: -25.0, lng: 134.0 }
  };

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

  // Devuelve la key canónica para WIKI_* dado un nombre crudo (NE o EQUIPOS).
  // Usado para mantener consistencia entre wikiData (WIKI_SELECCIONES) y bio
  // (WIKI_BIO) — ambos comparten el mismo espacio de keys.
  function getWikiKey(name_en) {
    if (!name_en) return '';
    return ALIAS_WIKI[name_en] || name_en;
  }

  // ── Códigos ISO 3-letras → emoji bandera ─────────────────────
  // EQUIPOS[].flag contiene 'MEX', 'BRA' etc. (ISO3), no emoji directo.
  // Cubre los 48 EQUIPOS + algunos extras (KAZ/ANG) por seguridad.
  var ISO3_TO_FLAG = {
    'MEX': '🇲🇽', 'RSA': '🇿🇦', 'KOR': '🇰🇷', 'CZE': '🇨🇿',
    'CAN': '🇨🇦', 'QAT': '🇶🇦', 'SUI': '🇨🇭', 'BIH': '🇧🇦',
    'BRA': '🇧🇷', 'MAR': '🇲🇦', 'HAI': '🇭🇹', 'SCO': '🏴󠁧󠁢󠁳󠁣󠁴󠁿',
    'USA': '🇺🇸', 'AUS': '🇦🇺', 'NZL': '🇳🇿', 'PAR': '🇵🇾',
    'GER': '🇩🇪', 'ECU': '🇪🇨', 'CIV': '🇨🇮', 'CUW': '🇨🇼',
    'NED': '🇳🇱', 'JPN': '🇯🇵', 'TUN': '🇹🇳',
    'BEL': '🇧🇪', 'EGY': '🇪🇬', 'IRN': '🇮🇷',
    'ESP': '🇪🇸', 'URU': '🇺🇾', 'KSA': '🇸🇦', 'CPV': '🇨🇻',
    'FRA': '🇫🇷', 'SEN': '🇸🇳', 'NOR': '🇳🇴', 'IRQ': '🇮🇶',
    'ARG': '🇦🇷', 'ALG': '🇩🇿', 'AUT': '🇦🇹', 'JOR': '🇯🇴',
    'POR': '🇵🇹', 'COL': '🇨🇴', 'UZB': '🇺🇿',
    'ENG': '🏴󠁧󠁢󠁥󠁮󠁧󠁿', 'CRO': '🇭🇷', 'GHA': '🇬🇭', 'PAN': '🇵🇦',
    // Extras de EQUIPOS no incluidos en el brief
    'TUR': '🇹🇷', 'SWE': '🇸🇪', 'COD': '🇨🇩',
    // Reservas
    'KAZ': '🇰🇿', 'ANG': '🇦🇴'
  };

  function getFlagEmoji(equipo) {
    if (!equipo) return '⚽';
    var f = equipo.flag || equipo.flag_emoji || '';
    // 1. Si ya viene como emoji directo (primer code point > ASCII)
    if (f && typeof f.codePointAt === 'function' && f.codePointAt(0) > 127) return f;
    // 2. Lookup ISO3 (case-insensitive)
    if (f && ISO3_TO_FLAG[f.toUpperCase()]) return ISO3_TO_FLAG[f.toUpperCase()];
    // 3. Fallback: inicial del nombre
    return (equipo.name || equipo.name_en || '?').charAt(0).toUpperCase();
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
    ATMOS:       '#7eb6d8',
    SEL_CAP:     '#d93025',
    SEL_STROK:   '#ff6b5b',
    SEL_SIDE:    '#a01f16'
  };

  // Estado: nombre NE del país actualmente resaltado en rojo (o null).
  var _selectedNE = null;
  // Estado: nombre de la sede actualmente resaltada en rojo (o null).
  var _selectedSede = null;

  // ── HTML templates ──────────────────────────────────────────
  // F1.1e: CINTA_HTML eliminado — el trigger del overlay vive ahora en
  // .v3-qualified-cta del shell mundial-shell-v3.js (data-qualified-cta),
  // que invoca window._openGloboOverlay() expuesto al final de este IIFE.

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
        '<div class="fc-globo-sedes" id="fc-globo-sedes"></div>' +
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

  // ── Highlight del país seleccionado ──────────────────────────
  // Usa _selectedNE como nombre NE normalizado (post-ALIAS_NE) para que
  // los polygon*Color callbacks puedan compararlo contra norm(f.properties.name).
  function selectCountry(nameEn, globe) {
    _selectedNE = nameEn ? (ALIAS_NE[nameEn] || nameEn) : null;
    if (globe && typeof globe.polygonsData === 'function') {
      globe.polygonsData(globe.polygonsData()); // fuerza re-render con nuevos colores
    }
  }

  // Highlight de sede activa: re-render de pointsData para que los
  // callbacks pointColor/Altitude/Radius vean el nuevo _selectedSede.
  function selectSede(name, globe) {
    _selectedSede = name || null;
    if (globe && typeof globe.pointsData === 'function') {
      globe.pointsData(globe.pointsData());
    }
  }

  // globe.gl crea tooltips flotantes con clase .scene-tooltip. Cuando se
  // abre el panel cubriendo el cursor, mouseleave del polígono no dispara
  // y el tooltip queda colgado. Forzar display:none + reset 50ms después
  // para no romper el siguiente hover real.
  function hideGlobeTooltip() {
    document.querySelectorAll('.scene-tooltip').forEach(function (el) {
      el.style.display = 'none';
      setTimeout(function () { el.style.display = ''; }, 50);
    });
  }

  function resetCountry(globe) {
    document.querySelectorAll('.fc-globo-flag-btn.is-active').forEach(function (b) { b.classList.remove('is-active'); });
    document.querySelectorAll('.fc-globo-sede-chip.is-active').forEach(function (c) { c.classList.remove('is-active'); });
    _selectedSede = null;
    if (globe && typeof globe.pointsData === 'function') {
      globe.pointsData(globe.pointsData());
    }
    if (!_selectedNE) return;
    _selectedNE = null;
    if (globe && typeof globe.polygonsData === 'function') {
      globe.polygonsData(globe.polygonsData());
    }
    var ctrl = (globe && typeof globe.controls === 'function') ? globe.controls() : null;
    if (ctrl) ctrl.autoRotate = false;
    var initialAlt = window.innerWidth < 768 ? 5.0 : 4.2;
    if (globe && typeof globe.pointOfView === 'function') {
      globe.pointOfView({ lat: 20, lng: 0, altitude: initialAlt }, 600);
    }
    setTimeout(function () {
      if (ctrl) { ctrl.autoRotate = true; ctrl.autoRotateSpeed = 0.4; }
    }, 1500);
  }

  // ── Panel de detalle (país / sede) ───────────────────────────
  function openDetail(html) {
    hideGlobeTooltip();
    var panel = document.getElementById('fc-globo-detail');
    var body  = document.getElementById('fc-globo-detail-body');
    if (!panel || !body) return;
    body.innerHTML = html;
    panel.classList.add('is-open');
  }

  function closeDetail() {
    resetCountry(window._globoInstance);
    var panel = document.getElementById('fc-globo-detail');
    if (panel) panel.classList.remove('is-open');
  }

  function renderPanelPais(wikiData, nombrePais, nameEn) {
    var w = wikiData || {};
    var bioEntry = (typeof window.WIKI_BIO !== 'undefined' && nameEn && window.WIKI_BIO[nameEn])
      ? window.WIKI_BIO[nameEn] : null;
    var b = bioEntry || {};
    var apodoDisplay = b.apodo || w.apodo || '';
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
    // WIKI_BIO v2: dos bios separadas (sport.es narrativo + ESPN táctico).
    // Reuso clases __bio/__bio-toggle/__bio-text que ya tienen CSS estilizado
    // (border dorado, summary marker custom, etc.). Primer details abierto.
    var bioHtml = '';
    if (b.bio) {
      bioHtml += '<details class="fc-globo-detail__bio" open>' +
        '<summary class="fc-globo-detail__bio-toggle">📖 Sobre el equipo</summary>' +
        '<p class="fc-globo-detail__bio-text">' + b.bio + '</p>' +
      '</details>';
    }
    if (b.bio_espn) {
      bioHtml += '<details class="fc-globo-detail__bio">' +
        '<summary class="fc-globo-detail__bio-toggle">⚽ Análisis táctico</summary>' +
        '<p class="fc-globo-detail__bio-text">' + b.bio_espn + '</p>' +
      '</details>';
    }
    var btnPlantilla = (
      '<button type="button" class="fc-globo-detail__btn-plantilla" ' +
        'data-name-en="' + (nameEn || '').replace(/"/g, '&quot;') + '">' +
        '📋 Pizarra táctica' +
      '</button>'
    );
    return (
      '<div class="fc-globo-detail__hdr">' +
        '<span class="fc-globo-detail__title">' + nombrePais + '</span>' +
        (apodoDisplay ? '<span class="fc-globo-detail__sub">' + apodoDisplay + '</span>' : '') +
        (b.formacion ? '<span class="fc-globo-detail__pill-formacion"><span class="fc-globo-detail__pill-label">Formación:</span> ' + b.formacion + '</span>' : '') +
      '</div>' +
      (b.frase ? '<p class="fc-globo-detail__frase">"' + b.frase + '"</p>' : '') +
      '<div class="fc-globo-detail__stats">' +
        (w.grupo  ? '<div class="fc-globo-detail__row"><span class="fc-globo-detail__lbl">Grupo</span><span>' + w.grupo + '</span></div>' : '') +
        (w.confed ? '<div class="fc-globo-detail__row"><span class="fc-globo-detail__lbl">Confederación</span><span>' + w.confed + '</span></div>' : '') +
        '<div class="fc-globo-detail__row"><span class="fc-globo-detail__lbl">Mundiales</span><span>' + (w.mundiales || '—') + '</span></div>' +
        (w.mejor  ? '<div class="fc-globo-detail__row"><span class="fc-globo-detail__lbl">Mejor resultado</span><span>' + w.mejor + '</span></div>' : '') +
        coachLine +
      '</div>' +
      (estrella ? '<div class="fc-globo-detail__section-lbl">Estrella</div>' + estrella : '') +
      bioHtml +
      btnPlantilla +
      '<div class="fc-globo-detail__attr">Datos: sport.es + ESPN / Wikipedia CC BY-SA</div>'
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

    var SUPABASE_FLAGS = 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/flags/';
    // EQUIPOS viene ordenado por grupos (4 consecutivos = grupo). Insertar
    // un mini-badge separador A/B/C... antes de cada bloque de 4.
    var GRUPO_LETTERS = ['A','B','C','D','E','F','G','H','I','J','K','L'];
    var html = '';
    arr.forEach(function (e, idx) {
      if (idx % 4 === 0) {
        var grupoLetra = GRUPO_LETTERS[Math.floor(idx / 4)] || '';
        html += '<div class="fc-globo-flags__grupo-sep" aria-hidden="true">' +
                  '<span class="fc-globo-flags__grupo-label">' + grupoLetra + '</span>' +
                '</div>';
      }
      var name   = e.name || e.name_en || '';
      var nameEn = e.name_en || name;
      var lat    = (typeof e.lat === 'number') ? e.lat : 0;
      var lng    = (typeof e.lng === 'number') ? e.lng : 0;
      var flagUrl = e.flag ? (SUPABASE_FLAGS + e.flag + '.png') : null;
      var flagContent = flagUrl
        ? '<img src="' + flagUrl + '" alt="' + name.replace(/"/g, '&quot;') + '" class="fc-globo-flag-btn__img" loading="lazy">'
        : (name || '?').substring(0, 3);
      html += '<button type="button" class="fc-globo-flag-btn" ' +
                'data-name-en="' + nameEn.replace(/"/g, '&quot;') + '" ' +
                'data-lat="' + lat + '" data-lng="' + lng + '" ' +
                'title="' + name + '">' +
                flagContent +
                '<span class="fc-globo-flag-btn__name">' + name + '</span>' +
              '</button>';
    });

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
      // Override manual primero — evita centroides erróneos por bounding
      // box que incluye Alaska (USA), territorios remotos (UK, Francia, etc.)
      var override = COUNTRY_LATLNG_OVERRIDE[nameEn] || COUNTRY_LATLNG_OVERRIDE[norm(nameEn)];
      if (override) {
        targetLat = override.lat;
        targetLng = override.lng;
      } else if (!lat && !lng) {
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
      // Resaltar polígono del país en rojo antes de abrir el panel.
      selectCountry(nameEn, globe);
      // Usar btn.title como display porque el .fc-globo-flag-btn__name
      // ahora es display:none (post-polish). nameEn aliado para bio lookup.
      openDetail(renderPanelPais(wikiData, btn.title || name, getWikiKey(nameEn)));

      flagsEl.querySelectorAll('.fc-globo-flag-btn').forEach(function (b) { b.classList.remove('is-active'); });
      btn.classList.add('is-active');
    });
  }

  // ── Chips de sedes (16 ciudades scrollables) ─────────────────
  function renderSedesLegend(globe) {
    var sedesEl = document.getElementById('fc-globo-sedes');
    if (!sedesEl || sedesEl._fcRendered) return;
    sedesEl._fcRendered = true;

    var html = SEDES.map(function (s) {
      return (
        '<button type="button" class="fc-globo-sede-chip" ' +
          'data-name="' + s.name.replace(/"/g, '&quot;') + '" ' +
          'data-lat="' + s.lat + '" data-lng="' + s.lng + '" ' +
          'title="' + s.name + '">' +
          '📍 ' + s.name +
        '</button>'
      );
    }).join('');

    sedesEl.innerHTML = html;

    sedesEl.addEventListener('click', function (e) {
      var btn = e.target.closest('.fc-globo-sede-chip');
      if (!btn || !globe) return;
      var name = btn.dataset.name;
      var lat  = parseFloat(btn.dataset.lat);
      var lng  = parseFloat(btn.dataset.lng);
      var wikiData = (typeof window.WIKI_SEDES !== 'undefined') ? window.WIKI_SEDES[name] : null;

      var ctrl = (typeof globe.controls === 'function') ? globe.controls() : null;
      if (ctrl) ctrl.autoRotate = false;
      globe.pointOfView({ lat: lat, lng: lng, altitude: 1.5 }, 800);
      setTimeout(function () {
        if (ctrl) { ctrl.autoRotate = true; ctrl.autoRotateSpeed = 0.4; }
      }, 3000);

      // Resaltar punto blanco → rojo + elevarlo, antes de abrir panel.
      selectSede(name, globe);
      openDetail(renderPanelSede(wikiData, name));

      sedesEl.querySelectorAll('.fc-globo-sede-chip').forEach(function (b) { b.classList.remove('is-active'); });
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
        // Fallback (window.innerHeight - 200) cuando clientHeight aún no está
        // calculado por el flex layout — evita canvas 0px en el primer paint.
        globe.height(canvasEl.clientHeight || (window.innerHeight - 200));

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
          // rAF para que el flex layout haya recalculado antes de medir.
          requestAnimationFrame(function () {
            globe.width(canvasEl.clientWidth);
            globe.height(canvasEl.clientHeight || (window.innerHeight - 200));
            var newAlt = window.innerWidth < 768 ? 5.0 : 4.2;
            var pov = globe.pointOfView();
            if (pov && Math.abs(pov.altitude - newAlt) > 0.5) {
              globe.pointOfView({ lat: pov.lat, lng: pov.lng, altitude: newAlt }, 400);
            }
          });
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
              .polygonCapColor(function (f) {
                if (_selectedNE && norm(f.properties.name) === _selectedNE) return COL.SEL_CAP;
                return f.properties.esMundial ? COL.GOLD : COL.LAND;
              })
              .polygonStrokeColor(function (f) {
                if (_selectedNE && norm(f.properties.name) === _selectedNE) return COL.SEL_STROK;
                return f.properties.esMundial ? COL.GOLD_STROKE : COL.LAND_STROKE;
              })
              .polygonAltitude(function (f) { return f.properties.esMundial ? 0.022 : 0.006; })
              .polygonSideColor(function (f) {
                if (_selectedNE && norm(f.properties.name) === _selectedNE) return COL.SEL_SIDE;
                return f.properties.esMundial ? COL.GOLD_SIDE : COL.LAND_SIDE;
              })
              .polygonLabel(function (f) {
                var n = f.properties.name || '';
                var b = f.properties.esMundial
                  ? ' <span style="background:#e8b830;color:#000;font-size:9px;padding:1px 5px;border-radius:3px;font-weight:700">⚽ CLASIFICADO</span>'
                  : '';
                return '<div style="background:rgba(20,28,44,.95);border:1px solid rgba(232,184,48,.4);border-radius:6px;padding:6px 10px;color:#fff;font-size:11px"><b>' + n + '</b>' + b + '</div>';
              });

            globe.pointsData(SEDES.map(function (s) { return { lat: s.lat, lng: s.lng, name: s.name, nameKey: s.nameKey }; }))
              .pointColor(function (p) { return _selectedSede === p.name ? '#d93025' : '#ffffff'; })
              .pointAltitude(function (p) { return _selectedSede === p.name ? 0.12 : 0.04; })
              .pointRadius(function (p) { return _selectedSede === p.name ? 0.9 : 0.5; })
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
                // Resaltar polígono en rojo. selectCountry normaliza el name
                // vía ALIAS_NE igual que el comparator en polygon*Color.
                selectCountry(name, globe);
                // 3er arg = key WIKI canónica (alias resuelto) para que el
                // bio lookup en WIKI_BIO funcione cuando el polígono NE
                // (ej. "United Kingdom") difiere de la key WIKI ("England").
                openDetail(renderPanelPais(wikiData, name, getWikiKey(name)));

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
                selectSede(point.name, globe);
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
    // detalle y botón "Ver plantilla" se delegan aquí (id/clase estable
    // en el DOM, evita inline onclick + escape de apóstrofes en nameEn).
    overlay.addEventListener('click', function (e) {
      if (e.target && e.target.id === 'fc-globo-detail-close') {
        closeDetail();
        return;
      }
      var plantillaBtn = e.target && e.target.closest && e.target.closest('.fc-globo-detail__btn-plantilla');
      if (plantillaBtn) {
        if (typeof window._globoNavPlantilla === 'function') {
          window._globoNavPlantilla(plantillaBtn.dataset.nameEn || '');
        }
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
      // Instancia cacheada → ajustar tamaño al viewport actual y mostrar.
      // rAF asegura que el flex layout haya calculado el canvas antes de medir.
      requestAnimationFrame(function () {
        try {
          window._globoInstance.width(canvas.clientWidth);
          window._globoInstance.height(canvas.clientHeight || (window.innerHeight - 200));
        } catch (_) { /* defensivo */ }
      });
      hideMsg(msg);
      renderFlagsLegend(window._globoInstance);
      renderSedesLegend(window._globoInstance);
      return;
    }

    showMsg(msg, 'Cargando librería…', false);
    initGlobo(canvas, msg)
      .then(function (g) {
        window._globoInstance = g;
        renderFlagsLegend(g);
        renderSedesLegend(g);
      })
      .catch(function (err) {
        console.error('[globo] init error:', err);
        showMsg(msg, 'No se pudo cargar el globo: ' + (err && err.message ? err.message : 'error desconocido'), true);
      });
  }

  function closeOverlay() {
    resetCountry(window._globoInstance);
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
    var sedes = document.getElementById('fc-globo-sedes');
    if (sedes) {
      sedes.querySelectorAll('.fc-globo-sede-chip.is-active').forEach(function (b) {
        b.classList.remove('is-active');
      });
    }
  }

  // Stub de navegación a la pantalla de plantilla (PR4 lo sobreescribirá
  // con el módulo real). Se registra solo si nadie lo definió antes para
  // no pisar una implementación futura cargada en otro orden.
  if (!window._globoNavPlantilla) {
    window._globoNavPlantilla = function (nameEn) {
      console.log('[globo] navPlantilla →', nameEn, '(stub — PR4 pendiente)');
      closeOverlay();
    };
  }

  // F1.1e — API pública para el CTA v3 (shell mundial-shell-v3.js).
  window._openGloboOverlay = openOverlay;
})();
