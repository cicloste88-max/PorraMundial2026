// public/js/ui-pizarra-tactica.js
//
// Modal "Pizarra Táctica" — muestra ficha visual de una selección con:
//   • Banda superior con bandera (degradado destination-out hacia el campo)
//   • Escudo + nombre + entrenador + pill de formación
//   • Campo de fútbol con 11 tokens posicionados según formación
//   • Footer con stats (edad media · valor de plantilla · GPP post-Mundial 2022)
//
// Entry point único:
//   window.openPizarraTactica({ iso3, iso2, nameEn })
// Requiere al menos uno de los 3 identificadores.
//
// Eventos engendrados:
//   • Globo: window._globoNavPlantilla(nameEn) → handler ya registrado en globo
//   • Tarjeta partido: click sobre <button class="dv2-mini-flag-btn">
//
// Backend: EF /functions/v1/get-squad?iso3=XXX | ?iso2=XX (requiere JWT)
// ─────────────────────────────────────────────────────────────────────────

(function () {
  'use strict';

  // ── CONFIG ──────────────────────────────────────────────────────────
  const SUPABASE_BASE  = 'https://cmyfyswystjgzdwbqyyb.supabase.co';
  const EF_GET_SQUAD   = SUPABASE_BASE + '/functions/v1/get-squad';
  const CAMPO_URL      = SUPABASE_BASE + '/storage/v1/object/public/miniatures/pizarra/campo.webp';

  // ── MAPPING nameEn → iso3 (para entrada desde Globo) ─────────────────
  // El globo usa los nombres en inglés según wiki-bio.js. La EF usa ISO3.
  const NAME_EN_TO_ISO3 = {
    'Algeria': 'ALG',  'Argentina': 'ARG',  'Australia': 'AUS',
    'Austria': 'AUT',  'Belgium': 'BEL',    'Bosnia & Herzegovina': 'BIH',
    'Brazil': 'BRA',   'Canada': 'CAN',     'Ivory Coast': 'CIV',
    'DR Congo': 'COD', 'Colombia': 'COL',   'Cape Verde': 'CPV',
    'Croatia': 'CRO',  'Curaçao': 'CUW',    'Czech Republic': 'CZE',
    'Ecuador': 'ECU',  'Egypt': 'EGY',      'England': 'ENG',
    'Spain': 'ESP',    'France': 'FRA',     'Germany': 'GER',
    'Ghana': 'GHA',    'Haiti': 'HAI',      'Iran': 'IRN',
    'Iraq': 'IRQ',     'Jordan': 'JOR',     'Japan': 'JPN',
    'Korea': 'KOR',    'Saudi Arabia': 'KSA','Morocco': 'MAR',
    'Mexico': 'MEX',   'Netherlands': 'NED','Norway': 'NOR',
    'New Zealand': 'NZL','Panama': 'PAN',   'Paraguay': 'PAR',
    'Portugal': 'POR', 'Qatar': 'QAT',      'South Africa': 'RSA',
    'Scotland': 'SCO', 'Senegal': 'SEN',    'Switzerland': 'SUI',
    'Sweden': 'SWE',   'Tunisia': 'TUN',    'Turkey': 'TUR',
    'Uruguay': 'URU',  'USA': 'USA',        'Uzbekistan': 'UZB',
  };

  // ── COORDENADAS DE TOKENS POR FORMACIÓN ──────────────────────────────
  // Coordenadas en porcentajes [x%, y%] con el campo orientado vertical
  // (porterías arriba/abajo). Token 0 = portero abajo, token 10 = delantero.
  // y=0 arriba (portería rival), y=100 abajo (portería propia).
  // x=0 izquierda, x=100 derecha (desde nuestra perspectiva atacando hacia arriba).
  const FORMATION_COORDS = {
    '4-3-3': [
      [50, 86], // PO
      [82, 75], [62, 76], [38, 76], [18, 75], // 4 def
      [68, 56], [50, 54], [32, 56],            // 3 mc
      [78, 28], [50, 18], [22, 28],            // 3 del (ED, DC, EI)
    ],
    '4-4-2': [
      [50, 86],
      [82, 75], [62, 76], [38, 76], [18, 75],
      [82, 50], [62, 52], [38, 52], [18, 50],
      [60, 22], [40, 22],
    ],
    '4-2-3-1': [
      [50, 86],
      [82, 75], [62, 76], [38, 76], [18, 75],
      [62, 60], [38, 60],                       // doble pivote
      [78, 38], [50, 36], [22, 38],             // 3 mco
      [50, 18],                                 // dc único
    ],
    '3-5-2': [
      [50, 86],
      [70, 76], [50, 78], [30, 76],             // 3 cb
      [88, 56], [62, 54], [50, 60], [38, 54], [12, 56], // 5 mp
      [60, 22], [40, 22],
    ],
    '5-3-2': [
      [50, 86],
      [82, 78], [62, 76], [50, 80], [38, 76], [18, 78], // 5 def
      [68, 56], [50, 54], [32, 56],
      [60, 22], [40, 22],
    ],
    '4-1-4-1': [
      [50, 86],
      [82, 75], [62, 76], [38, 76], [18, 75],
      [50, 64],                                 // pivote
      [82, 46], [60, 44], [40, 44], [18, 46],
      [50, 22],
    ],
    '4-3-2-1': [
      [50, 86],
      [82, 75], [62, 76], [38, 76], [18, 75],
      [70, 58], [50, 56], [30, 58],
      [62, 38], [38, 38],
      [50, 18],
    ],
    '3-4-3': [
      [50, 86],
      [70, 76], [50, 78], [30, 76],
      [82, 56], [62, 54], [38, 54], [18, 56],
      [78, 28], [50, 18], [22, 28],
    ],
    '5-4-1': [
      [50, 86],
      [82, 78], [62, 76], [50, 80], [38, 76], [18, 78],
      [82, 52], [62, 50], [38, 50], [18, 52],
      [50, 22],
    ],
    '4-4-1-1': [
      [50, 86],
      [82, 75], [62, 76], [38, 76], [18, 75],
      [82, 50], [62, 52], [38, 52], [18, 50],
      [50, 32],                                 // mediapunta
      [50, 18],
    ],
    '3-4-2-1': [
      [50, 86],
      [70, 76], [50, 78], [30, 76],
      [82, 56], [62, 54], [38, 54], [18, 56],
      [62, 36], [38, 36],
      [50, 18],
    ],
    '4-1-3-2': [
      [50, 86],
      [82, 75], [62, 76], [38, 76], [18, 75],
      [50, 64],
      [70, 44], [50, 42], [30, 44],
      [60, 22], [40, 22],
    ],
  };

  // ── HELPERS ──────────────────────────────────────────────────────────
  function getJWT() {
    // auth.js publica window._porraToken en cada SIGNED_IN/TOKEN_REFRESHED
    // y lo persiste en sessionStorage como backup.
    if (window._porraToken) return window._porraToken;
    try {
      return sessionStorage.getItem('porra_token') || null;
    } catch (_) {
      return null;
    }
  }

  function resolveIso3(opts) {
    if (opts.iso3) return opts.iso3.toUpperCase();
    if (opts.iso2) return null;       // EF acepta iso2 directamente
    if (opts.nameEn) {
      const norm = opts.nameEn.trim();
      return NAME_EN_TO_ISO3[norm] || null;
    }
    return null;
  }

  // Cache simple en memoria (sesión)
  const _cache = new Map();

  async function fetchSquad(opts) {
    const iso3 = resolveIso3(opts);
    const iso2 = opts.iso2 ? opts.iso2.toUpperCase() : null;
    const cacheKey = iso3 || iso2;
    if (!cacheKey) throw new Error('Falta iso3, iso2 o nameEn válido');

    if (_cache.has(cacheKey)) return _cache.get(cacheKey);

    const qs = iso3 ? '?iso3=' + iso3 : '?iso2=' + iso2;
    const jwt = getJWT();
    if (!jwt) throw new Error('No hay sesión activa (JWT)');

    const r = await fetch(EF_GET_SQUAD + qs, {
      headers: { 'Authorization': 'Bearer ' + jwt },
    });
    if (!r.ok) throw new Error('get-squad ' + r.status);
    const data = await r.json();
    _cache.set(cacheKey, data);
    return data;
  }

  // ── RENDER ───────────────────────────────────────────────────────────
  function getCoords(formacion) {
    return FORMATION_COORDS[formacion] || FORMATION_COORDS['4-3-3'];
  }

  function buildOverlay() {
    let overlay = document.getElementById('fc-pizarra-overlay');
    if (overlay) return overlay;

    overlay = document.createElement('div');
    overlay.id = 'fc-pizarra-overlay';
    overlay.className = 'fc-pizarra-overlay';
    overlay.setAttribute('aria-hidden', 'true');
    overlay.innerHTML =
      '<div class="fc-pizarra-modal" role="dialog" aria-modal="true">' +
        '<button type="button" class="fc-pizarra-close" id="fc-pizarra-close" aria-label="Cerrar">×</button>' +
        '<div class="fc-pizarra-content" id="fc-pizarra-content">' +
          '<div class="fc-pizarra-loading">Cargando…</div>' +
        '</div>' +
      '</div>';
    document.body.appendChild(overlay);

    // Cerrar: botón × o click en backdrop
    overlay.addEventListener('click', function (e) {
      if (e.target === overlay || (e.target.id === 'fc-pizarra-close')) {
        closePizarra();
      }
    });
    // ESC cierra
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && overlay.classList.contains('is-open')) {
        closePizarra();
      }
    });

    // Tooltip toggle al tap en .fc-pizarra-stat-info
    overlay.addEventListener('click', function (e) {
      const btn = e.target.closest && e.target.closest('.fc-pizarra-stat-info');
      // Si hay un tooltip abierto y se clickó en otro sitio → cerrarlo
      const existing = overlay.querySelector('.fc-pizarra-stat-tooltip');
      if (existing) existing.remove();

      if (!btn) return;
      e.stopPropagation();
      const txt = btn.getAttribute('data-tooltip');
      if (!txt) return;

      const tip = document.createElement('div');
      tip.className = 'fc-pizarra-stat-tooltip';
      tip.textContent = txt;
      // Insertar como hermano del icono dentro del wrap
      btn.parentElement.appendChild(tip);

      // Auto-cerrar tras 4 segundos
      setTimeout(function () {
        if (tip.parentElement) tip.remove();
      }, 4000);
    });

    return overlay;
  }

  function fmtNumberEs(n) {
    if (n == null) return '—';
    return Number(n).toString().replace('.', ',');
  }

  function renderContent(team) {
    const coords = getCoords(team.formacion);
    const ficha = team.color_ficha || '#ffffff';
    const fichaPo = team.color_portero || '#f5c518';
    // borde del token: si fondo blanco, borde gris; si oscuro, blanco
    const isLight = (ficha.toLowerCase() === '#ffffff' || ficha.toLowerCase() === 'white');
    const borderColor = isLight ? '#1f2937' : '#ffffff';

    let tokensHtml = '';
    team.jugadores.forEach((j, i) => {
      const c = coords[i] || [50, 50];
      const isGK = j.posicion === 'PO';
      const bg = isGK ? fichaPo : ficha;
      const textColor = (isLight && !isGK) ? '#111827' : '#ffffff';
      const isPlaceholder = !j.nombre || j.nombre === '—' || j.nombre === '\u2014';
      // F-08: pastilla = dorsal + posicion + apellido (3a linea solo cuando
      // hay nombre). Apellido = ultimo token, truncado a 10 chars con ellipsis.
      let apellidoHtml = '';
      if (!isPlaceholder) {
        let surname = j.nombre.split(' ').slice(-1)[0];
        if (surname.length > 10) surname = surname.slice(0, 10) + '…';
        apellidoHtml = '<span class="fc-pizarra-token-surname">' + surname + '</span>';
      }

      tokensHtml +=
        '<div class="fc-pizarra-token" ' +
          'style="left:' + c[0] + '%;top:' + c[1] + '%;' +
                 'background:' + bg + ';color:' + textColor + ';' +
                 'border-color:' + borderColor + '">' +
          '<span class="fc-pizarra-token-num">' + j.dorsal + '</span>' +
          '<span class="fc-pizarra-token-name">' + j.posicion + '</span>' +
          apellidoHtml +
        '</div>';
    });

    const escudo = team.badge_url
      ? '<img src="' + team.badge_url + '" class="fc-pizarra-badge" alt="" loading="lazy">'
      : '<div class="fc-pizarra-badge fc-pizarra-badge--placeholder">' + team.iso3 + '</div>';

    const stats = team.stats || {};
    const golesPeriodo = (stats.goles_periodo || '').replace(/"/g, '&quot;');
    const golesLine = stats.goles != null
      ? '<span class="fc-pizarra-stat-val-wrap">' +
          '<span class="fc-pizarra-stat-val">' + fmtNumberEs(stats.goles) + '</span>' +
          '<button type="button" class="fc-pizarra-stat-info" ' +
                  'data-tooltip="Media de goles por partido ' + golesPeriodo + '. Una vez se anuncien los partidos disputados a posteriori, este dato se actualizará."' +
                  ' aria-label="Información sobre el cálculo">i</button>' +
        '</span>'
      : '<span class="fc-pizarra-stat-val">—</span>';

    return (
      '<div class="fc-pizarra-card">' +
        // BANDERA SUPERIOR (degradado hacia el campo)
        '<div class="fc-pizarra-flag-band" style="background-image:url(\'' + team.flag_url + '\')"></div>' +

        // HEADER (escudo + nombres + formación)
        '<div class="fc-pizarra-header">' +
          escudo +
          '<div class="fc-pizarra-titles">' +
            '<h2 class="fc-pizarra-title">' + team.equipo + '</h2>' +
            '<p class="fc-pizarra-coach">' + (team.entrenador || '') + '</p>' +
          '</div>' +
          '<div class="fc-pizarra-form-pill">' + (team.formacion || '?') + '</div>' +
        '</div>' +

        // CAMPO + TOKENS
        '<div class="fc-pizarra-field" style="background-image:url(\'' + CAMPO_URL + '\')">' +
          tokensHtml +
        '</div>' +

        // STATS FOOTER
        '<div class="fc-pizarra-stats">' +
          '<div class="fc-pizarra-stat">' +
            '<span class="fc-pizarra-stat-lbl">Edad media</span>' +
            '<span class="fc-pizarra-stat-val-wrap">' +
              '<span class="fc-pizarra-stat-val">' + fmtNumberEs(stats.edad) + '</span>' +
            '</span>' +
          '</div>' +
          '<div class="fc-pizarra-stat-sep"></div>' +
          '<div class="fc-pizarra-stat">' +
            '<span class="fc-pizarra-stat-lbl">Valor plantilla</span>' +
            '<span class="fc-pizarra-stat-val-wrap">' +
              '<span class="fc-pizarra-stat-val">' + (stats.valor || '—') + '</span>' +
            '</span>' +
          '</div>' +
          '<div class="fc-pizarra-stat-sep"></div>' +
          '<div class="fc-pizarra-stat">' +
            '<span class="fc-pizarra-stat-lbl">Goles / partido</span>' +
            golesLine +
          '</div>' +
        '</div>' +

        // FOOTNOTE
        '<p class="fc-pizarra-footnote">' +
          (team.plantilla_completa
            ? 'Plantilla oficial · Datos: Transfermarkt + Soccerphile'
            : 'Plantilla provisional. Una vez se anuncien los partidos disputados a posteriori, añadiremos esta leyenda con datos confirmados.') +
        '</p>' +
      '</div>'
    );
  }

  function renderError(msg) {
    return '<div class="fc-pizarra-error">' +
      '<p>No se pudo cargar la pizarra</p>' +
      '<p class="fc-pizarra-error-detail">' + msg + '</p>' +
    '</div>';
  }

  // ── API PÚBLICA ──────────────────────────────────────────────────────
  async function openPizarraTactica(opts) {
    const overlay = buildOverlay();
    const content = overlay.querySelector('#fc-pizarra-content');
    content.innerHTML = '<div class="fc-pizarra-loading">Cargando…</div>';
    overlay.classList.add('is-open');
    overlay.setAttribute('aria-hidden', 'false');
    document.body.style.overflow = 'hidden';

    try {
      const team = await fetchSquad(opts);
      content.innerHTML = renderContent(team);
    } catch (err) {
      console.error('[pizarra] error', err);
      content.innerHTML = renderError(err.message || String(err));
    }
  }

  function closePizarra() {
    const overlay = document.getElementById('fc-pizarra-overlay');
    if (!overlay) return;
    overlay.classList.remove('is-open');
    overlay.setAttribute('aria-hidden', 'true');
    document.body.style.overflow = '';
  }

  // Exponer API global
  window.openPizarraTactica = openPizarraTactica;
  window.closePizarraTactica = closePizarra;

  // Hook para el Globo: ya existe el listener que invoca a este función.
  // Lo registramos aquí para que el globo no necesite saber de la pizarra.
  window._globoNavPlantilla = function (nameEn) {
    openPizarraTactica({ nameEn: nameEn });
  };
})();
