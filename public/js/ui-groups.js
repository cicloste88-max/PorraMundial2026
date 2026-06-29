// ui-groups.js - Porra Mundial 2026 / sub-bloque js-ui-groups
// UI de fase de grupos: savePredictions, checkGroupsComplete, finalizarPorra,
// renderMatchCard, openModal, updateCardUI, renderGroupTableCard, refreshGroupTables.
// Deps: data.js, scoring.js, auth.js, leagues.js

// JO-4 / ERR-92: m.date (PARTIDOS, data.js) es la hora de la SEDE sin timezone
// ("2026-06-11T15:00:00"). Las sedes del Mundial 2026 están en husos
// US/Canadá/México, NO en CEST → asumir +02:00 sobre m.date desplazaba la hora
// real hasta 6-9h (MEX-RSA pintaba 15:00 en vez de 21:00). Para la HORA real
// del kickoff usamos _joKickoffMs (date_utc del JSON, igual que Directo).
// _joParseMatchDate queda SOLO para:
//   · etiquetas de fecha ancladas a mediodía (date + 'T12:00:00') — correctas,
//     no dependen del huso porque el mediodía no cruza de día;
//   · fallback de _joKickoffMs cuando live-sync aún no cargó el JSON.
function _joParseMatchDate(s) {
  if (!s) return null;
  return new Date(/([Zz]|[+-]\d{2}:?\d{2})$/.test(s) ? s : s + '+02:00');
}

// Instante UTC real del kickoff (igual que Directo). Fuente: date_utc del JSON
// wc_matches vía window.kickoffUtcMsFor (live-sync). m.date es hora de SEDE y NO
// es CEST → el +02:00 de _joParseMatchDate estaba mal en sedes US. Cuando
// live-sync aún no cargó el JSON (carga fría) cae al fallback legacy: nunca
// devuelve null si m.date existe. Ref. ERR-92.
function _joKickoffMs(m) {
  if (typeof window.kickoffUtcMsFor === 'function') {
    const ms = window.kickoffUtcMsFor(m);
    if (ms != null) return ms;
  }
  const d = _joParseMatchDate(m && m.date);
  return d && !isNaN(d.getTime()) ? d.getTime() : null;
}

// JO-3: estado de colapso por sección Jornada (acordeón multi-abierto).
// Keys: "date:YYYY-MM-DD" para jornadas de grupos, "ko:<cfg.key>" para KO.
// Valor: true = colapsada, false = abierta. Estado en memoria de módulo
// (sin localStorage) → pervive en la sesión, se resetea al recargar.
// _joCollapseInit asegura que los defaults (jornada viva expandida, resto
// colapsadas) solo se aplican la primera vez; los clicks del usuario en
// renders posteriores se respetan.
var _joSectionCollapsed = {};
var _joCollapseInit = false;

// JO-1a: esqueleto KO en pantalla Jornada.
// Etiquetas cortas por ronda (P3a). El CSS .jv2-jornada-name aplica
// text-transform:uppercase, así que basta capital case en el origen.
var _JO_KO_SHORT = {
  r32:   '16avos · KO',
  r16:   'Octavos · KO',
  qf:    'Cuartos · KO',
  sf:    'Semifinales · KO',
  third: '3er y 4º · KO',
  final: 'Final · KO',
};

// Etiqueta para un slot del bracket. HOTFIX JO-1a: Jornada muestra el
// calendario/competición REAL, no las predicciones del usuario, así que el
// esqueleto se ve siempre vacío hasta que haya resultados oficiales.
// TODO: resolver por resultado real de grupos (PARTIDOS realHome/realAway
// + ko_results) cuando exista el pipeline live (post 27-jun 2026).
// NUNCA leer `resolvedSlots` aquí — eso refleja las predicciones del usuario,
// no la competición real.
function _joKOSlotLabel(slot) {
  return 'Por definir';
}

// Equipo EQUIPOS{name,flag,...} para un slot. HOTFIX JO-1a: devuelve null
// mientras no haya resultados reales (ver _joKOSlotLabel). Sin equipo
// resuelto → sin bandera (`.jv2-flag` cae al gris ink-700 por defecto).
// TODO: derivar de resultados oficiales cuando el pipeline esté activo.
function _joKOTeamFromSlot(slot) {
  return null;
}

// Fila de live_scores para un slot KO (match.id de BRACKET). La cache la
// rellena normalizeRow (live-sync.js) con nombres ES + marcador + status.
// Null mientras no exista la fila. ROUND-GENÉRICO: vale r32→final (73..104).
function _joKOLiveRow(match) {
  if (!match || match.id == null) return null;
  var cache = window._liveScoresByMatchKey || {};
  return cache['wc2026_ko_' + match.id] || null;
}

// Equipo EQUIPOS{name,flag,...} desde el nombre ES del feed KO
// (home_team_name/away_team_name de live_scores ≡ EQUIPOS.name). Null si no
// resuelve (banderas caen al fallback gris, patrón badge-with-flag-fallback).
function _joKOTeamFromName(name) {
  if (!name || typeof EQUIPOS === 'undefined') return null;
  return EQUIPOS.find(function (e) { return e.name === name; }) || null;
}

// Etiqueta día (+ hora si hay kickoff real) para una card KO no empezada.
// Prefiere match_start_ts del feed (instante UTC real, igual que Directo);
// fallback a match.date (solo-día del BRACKET) anclado a mediodía para no
// generar Invalid Date con el "+02:00" de _joParseMatchDate.
function _joKODayLabel(match, live) {
  var raw = (live && live.match_start_ts != null) ? Number(live.match_start_ts) : null;
  var ms = (raw != null && isFinite(raw)) ? (raw < 1e12 ? raw * 1000 : raw) : null;
  if (ms != null) {
    var d = new Date(ms);
    var ds = d.toLocaleDateString('es-ES', { weekday: 'short', timeZone: 'Europe/Madrid' }).replace('.', '').toUpperCase();
    var hh = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
    return ds + ' · ' + hh;
  }
  if (match && match.date) {
    var rawDate = match.date.indexOf('T') === -1 ? match.date + 'T12:00:00' : match.date;
    var dt = _joParseMatchDate(rawDate);
    if (dt && !isNaN(dt.getTime())) {
      var dayShort = dt.toLocaleDateString('es-ES', { weekday: 'short', timeZone: 'Europe/Madrid' }).replace('.', '').toUpperCase();
      var dayNum = dt.toLocaleDateString('es-ES', { day: 'numeric', timeZone: 'Europe/Madrid' });
      var monthShort = dt.toLocaleDateString('es-ES', { month: 'short', timeZone: 'Europe/Madrid' }).replace('.', '').toUpperCase();
      return dayShort + ' · ' + dayNum + ' ' + monthShort;
    }
  }
  return '';
}

// Tarjeta KO con marcador EN VIVO (JO-1a live). Misma estructura visual que
// _buildJCard pero sin pronóstico (KO se predice en Fase Final). Los equipos
// REALES + marcador salen de la fila live_scores del slot (competición real,
// NUNCA resolvedSlots de predicciones — ERR-76). Si aún no hay fila, degrada al
// esqueleto "Por definir". ROUND-GENÉRICO (r32→final).
function _buildJKOCard(match) {
  var live = _joKOLiveRow(match);

  var hName, aName, hTeam, aTeam;
  if (live && live.home_team_name && live.away_team_name) {
    hName = live.home_team_name;
    aName = live.away_team_name;
    hTeam = _joKOTeamFromName(live.home_team_name) || _joKOTeamFromSlot(match.home);
    aTeam = _joKOTeamFromName(live.away_team_name) || _joKOTeamFromSlot(match.away);
  } else {
    hName = _joKOSlotLabel(match.home);
    aName = _joKOSlotLabel(match.away);
    hTeam = _joKOTeamFromSlot(match.home);
    aTeam = _joKOTeamFromSlot(match.away);
  }

  // Bandera rectangular del bucket miniatures (ISO2) cuando hay team.
  // Reutilizamos ISO3_TO_ISO2 que ya está en top-level de este fichero.
  var SB_LOCAL = (typeof SB !== 'undefined') ? SB : '';
  var hIso2 = hTeam && ISO3_TO_ISO2[hTeam.flag];
  var aIso2 = aTeam && ISO3_TO_ISO2[aTeam.flag];
  var hFlagRectStyle = hIso2 ? ' style="--flag-rect-url:url(\'' + SB_LOCAL + '/miniatures/flags-sm/' + hIso2 + '.webp\')"' : '';
  var aFlagRectStyle = aIso2 ? ' style="--flag-rect-url:url(\'' + SB_LOCAL + '/miniatures/flags-sm/' + aIso2 + '.webp\')"' : '';
  var hFlagFallback  = hTeam ? (SB_LOCAL + '/flags/' + hTeam.flag + '.png') : '';
  var aFlagFallback  = aTeam ? (SB_LOCAL + '/flags/' + aTeam.flag + '.png') : '';

  // Estado + marcador en vivo desde la fila live.
  var status = live ? (live.status || 'notstarted') : 'notstarted';
  var isLive = status === 'inprogress' || status === 'halftime' ||
               status === 'overtime'   || status === 'penalties';
  var isFinished = status === 'finished';
  var hasScore = !!(live && live.score_home != null && live.score_away != null);
  var scoreL = hasScore ? live.score_home : '—';
  var scoreR = hasScore ? live.score_away : '—';

  // Píldora superior derecha: live → minuto/estado; finalizado → FINAL; si no,
  // día (+ hora si hay kickoff real en el feed).
  var whenLabel;
  if (isLive) {
    if (status === 'halftime') whenLabel = '🔴 DESCANSO';
    else if (status === 'penalties') whenLabel = '🔴 PENALTIS';
    else if (status === 'overtime') whenLabel = '🔴 PRÓRROGA';
    else if (live && live.minute != null) whenLabel = '🔴 ' + live.minute + "'";
    else whenLabel = '🔴 EN VIVO';
  } else if (isFinished) {
    whenLabel = 'FINAL';
  } else {
    whenLabel = _joKODayLabel(match, live);
  }

  var venue = match.venue || '';
  var cardCls = 'jv2-card jv2-card--ko' + (isLive ? ' is-live' : '') + (isFinished ? ' is-finished' : '');

  return (
    '<div class="' + cardCls + '">' +
      '<div class="jv2-card-top">' +
        (venue ? '<div class="jv2-card-stadium">🏟️ ' + venue + '</div>' : '<div class="jv2-card-stadium"></div>') +
        (whenLabel ? '<div class="jv2-card-when">' + whenLabel + '</div>' : '<div class="jv2-card-when"></div>') +
      '</div>' +
      '<div class="jv2-card-mid">' +
        '<div class="jv2-team">' +
          '<div class="jv2-flag"' + hFlagRectStyle + '>' +
            (hFlagFallback ? '<img src="' + hFlagFallback + '" loading="lazy" onerror="this.style.display=\'none\'">' : '') +
          '</div>' +
          '<div class="jv2-team-code" title="' + hName + '">' + hName + '</div>' +
        '</div>' +
        '<div class="jv2-score">' +
          '<span class="jv2-score-num">' + scoreL + '</span>' +
          '<span class="jv2-score-sep">:</span>' +
          '<span class="jv2-score-num">' + scoreR + '</span>' +
        '</div>' +
        '<div class="jv2-team">' +
          '<div class="jv2-flag"' + aFlagRectStyle + '>' +
            (aFlagFallback ? '<img src="' + aFlagFallback + '" loading="lazy" onerror="this.style.display=\'none\'">' : '') +
          '</div>' +
          '<div class="jv2-team-code" title="' + aName + '">' + aName + '</div>' +
        '</div>' +
      '</div>' +
    '</div>'
  );
}

// Sección KO completa para una ronda de ROUND_CONFIG. Devuelve string vacío
// si BRACKET[cfg.key] no existe (defensa contra race u olvido).
// JO-3: header clickable (acordeón). KO siempre colapsado por defecto;
// _joSectionCollapsed['ko:<key>'] respeta clicks posteriores del usuario.
function _buildJKOSection(cfg) {
  if (typeof BRACKET !== 'object' || !BRACKET || !Array.isArray(BRACKET[cfg.key])) return '';
  var matches = BRACKET[cfg.key];
  var name = _JO_KO_SHORT[cfg.key] || cfg.name || cfg.key;
  // cfg.sub ya viene con rango fechas + n partidos ("16 partidos · 28 jun – 3 jul").
  var sub = cfg.sub || '';

  var cardsHtml = matches.map(_buildJKOCard).join('');

  var collapseKey = 'ko:' + cfg.key;
  // Si nunca se ha tocado y los defaults aún no se inicializaron, KO arranca
  // colapsado. Si _joCollapseInit ya corrió, leemos lo que haya (default
  // true para KO, o lo que el usuario decidió).
  var isCollapsed = (_joSectionCollapsed[collapseKey] !== false);
  var sectionCls = 'jv2-section jv2-section--ko' + (isCollapsed ? ' is-collapsed' : '');
  var ariaExpanded = isCollapsed ? 'false' : 'true';

  return (
    '<div class="' + sectionCls + '" id="jornada-ko-' + cfg.key + '" data-collapse-key="' + collapseKey + '">' +
      '<div class="jv2-jornada-header jv2-jornada-header--ko" role="button" tabindex="0" aria-expanded="' + ariaExpanded + '">' +
        '<div class="jv2-jornada-title">' +
          '<div class="jv2-jornada-name">' + name +
            ' <span class="jv2-section__chev" aria-hidden="true">▾</span>' +
          '</div>' +
          (sub ? '<div class="jv2-jornada-date">' + sub + '</div>' : '') +
        '</div>' +
      '</div>' +
      cardsHtml +
    '</div>'
  );
}

// Devuelve el bloque HTML con las 6 secciones KO concatenadas. Vacío si
// las globals de ko.js no están disponibles (defensa contra orden de carga
// si renderVistaJornada se llamara antes de tiempo).
// HOTFIX JO-1a: NO llamamos resolveAllSlots() — esa función rellena
// `resolvedSlots` a partir de las predicciones del usuario, y Jornada
// muestra calendario/competición REAL. Las cards quedan en "Por definir"
// hasta que el pipeline de resultados reales esté activo (post 27-jun).
function _buildJKOSectionsHtml() {
  if (typeof ROUND_CONFIG !== 'object' || !Array.isArray(ROUND_CONFIG)) return '';
  if (typeof BRACKET !== 'object' || !BRACKET) return '';
  return ROUND_CONFIG.map(_buildJKOSection).join('');
}

// ========== INICIALIZACIÓN ==========
  // ─────────────────────────────────────────────────────────────
  /*
     js-ui-groups — UI tarjetas grupos, modal, predicciones
     Archivo destino : ui-groups.js
     -----------------------------------------------------------
     Usa             : PARTIDOS, EQUIPOS, predictions, db, currentUser
     Expone          : renderMatchCard, updateCardUI, openModal, savePredictions, renderGroupTableCard, refreshGroupTables
     Deps            : js-data, js-auth, js-ligas
     Notas           : Bloque mas grande. Toda la UI de fase de grupos.
================================================================ */
// GUARDAR PREDICCIONES DE GRUPOS — savePredictions,
  //   checkGroupsComplete, finalizarPorra (inicio del bloque cerrar)
  // ─────────────────────────────────────────────────────────────
function savePredictions() {
  try { localStorage.setItem('porra_predictions', JSON.stringify(predictions)); } catch(e) {}
  // Sincronizar con Supabase si hay sesión activa
  if (currentUser) {
    if (window._porraCerrada) return; // porra cerrada — no escribir en DB
    const leagueId = getActiveLeagueId();
    if (!leagueId) return; // sin liga activa no se guarda
    const rows = Object.entries(predictions)
      .filter(([, p]) => p && p.saved)
      .map(([match_id, p]) => ({
        user_id:   currentUser.id,
        league_id: leagueId,
        match_id,
        local:     p.l,
        visitante: p.v,
        scorer:    p.gol || null
      }));
    if (rows.length > 0) {
      db.from('predictions').upsert(rows, { onConflict: 'league_id,user_id,match_id' })
        .then(({ error }) => {
          if (error) console.warn('Error guardando predictions:', error.message);
          // Llamar checkFinalizarReady tras confirmar guardado en DB
          checkFinalizarReady();
        });
      return; // checkFinalizarReady se llama en el .then
    }
  }
}

function checkGroupsComplete() {
  // F7.4-D-A: helper puro — solo computa el flag global consumido por
  // el gate Fase final en bottom-tab.js (#fc-gate-modal). El btn header y
  // el banner CTA fueron eliminados con la migración a pages dedicadas.
  if (!boostPicks) return;
  let filled = 0;
  PARTIDOS.forEach(m => {
    const p = predictions[getMatchKey(m)];
    if (p && p.saved) filled++;
  });
  const total = PARTIDOS.length;
  const diasConPartidos = [...new Set(PARTIDOS.map(m => m.date?.substring(0,10)).filter(Boolean))];
  const boostsCompletos = diasConPartidos.every(d => boostPicks[d]);
  window._gruposComplete = (filled >= total && boostsCompletos);
}


/* ── Ticker de jornadas de boost — barra v3 (refactor B1, sprint Jornada UX) ──
   Container .jv2-boost-bar con paleta v3 (dorado-azul). Chips usan CSS classes
   en jornada-v3.css en lugar de inline styles. Funcionalidad intacta:
   click chip → tickerExpandJornada(date). */
function renderBoostTicker() {
  const ticker = document.getElementById('boost-ticker');
  if (!ticker) return;

  // Calcular todas las jornadas de grupos
  const jornadasMap = {};
  PARTIDOS.forEach((m, idx) => {
    const date = m.date?.substring(0,10);
    if (!date) return;
    if (!jornadasMap[date]) jornadasMap[date] = [];
    jornadasMap[date].push({ idx, home: m.home, away: m.away });
  });

  const today = new Date().toISOString().substring(0,10);
  const jornadas = Object.keys(jornadasMap).sort();

  // Jornadas pendientes de boost (sin asignar)
  const pendientes = jornadas.filter(d => !boostPicks[d]);
  // Jornada de hoy si existe
  const jornadaHoy = jornadasMap[today];

  if (pendientes.length === 0 && !jornadaHoy) {
    ticker.style.display = 'none';
    return;
  }

  // Reset inline styles del CSS embebido viejo (por si quedó cacheado en el DOM)
  ticker.removeAttribute('style');
  ticker.className = 'jv2-boost-bar';

  let html = '<span class="jv2-boost-bar-label">🔥 Boosts</span>';

  // Pastilla "HOY" — distinta clase según boost ya marcado o no
  if (jornadaHoy && !boostPicks[today]) {
    html += `<button type="button" class="jv2-boost-chip is-today-pending" onclick="tickerExpandJornada('${today}')">⚡ HOY · Elige boost</button>`;
  } else if (jornadaHoy && boostPicks[today]) {
    const bMatch = PARTIDOS.find(m => getMatchKey(m) === boostPicks[today]);
    const label = bMatch ? bMatch.home.split(' ')[0] + ' vs ' + bMatch.away.split(' ')[0] : 'asignado';
    html += `<button type="button" class="jv2-boost-chip is-today-done" onclick="tickerExpandJornada('${today}')">✓ HOY: ${label}</button>`;
  }

  // Pastillas de jornadas pendientes (próximas, no hoy)
  const pendientesSinHoy = pendientes.filter(d => d !== today);
  pendientesSinHoy.slice(0,3).forEach(d => {
    const dayLabel = _joParseMatchDate(d + 'T12:00:00').toLocaleDateString('es-ES', {day:'numeric', month:'short', timeZone:'Europe/Madrid'});
    const nMatches = jornadasMap[d].length;
    html += `<button type="button" class="jv2-boost-chip is-pending" onclick="tickerExpandJornada('${d}')">🔥 ${dayLabel} (${nMatches})</button>`;
  });

  // Si quedan más jornadas pendientes, mostrar contador
  if (pendientesSinHoy.length > 3) {
    html += `<span class="jv2-boost-bar-more">+${pendientesSinHoy.length - 3} más</span>`;
  }

  ticker.innerHTML = html;

  // Panel expandible de partidos de la jornada (se crea dinámicamente — mantener compat)
  let panel = document.getElementById('boost-ticker-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'boost-ticker-panel';
    panel.style.cssText = 'display:none;width:100%;padding:8px 0 4px;border-top:1px solid rgba(201,169,97,.15);margin-top:6px;gap:6px;flex-wrap:wrap;';
    ticker.appendChild(panel);
  }
}

/* Scroll suave a la tarjeta de un partido */
function scrollToMatchCard(matchKey) {
  const idx = PARTIDOS.findIndex(m => getMatchKey(m) === matchKey);
  if (idx === -1) return;
  const card = document.querySelector('.card[data-match-idx="' + idx + '"]');
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  // Flash visual para identificar la tarjeta
  card.style.transition = 'box-shadow .3s';
  card.style.boxShadow = '0 0 0 3px rgb(251,146,60), 0 0 40px rgba(234,88,12,.6)';
  setTimeout(() => { card.style.boxShadow = ''; }, 1800);
}
window.scrollToMatchCard = scrollToMatchCard;

/* Expande/colapsa los partidos de una jornada — usado por ticker superior y CTA inferior */
function _buildMatchButtons(date, onClickFn) {
  const matchesOfDay = PARTIDOS.filter(m => m.date?.substring(0,10) === date);
  const boostedKey = boostPicks[date];
  const hora = (m) => {
    const ms = _joKickoffMs(m);
    const d = ms != null ? new Date(ms) : _joParseMatchDate(m.date);
    return d.toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit', timeZone:'Europe/Madrid'});
  };
  const jNum = [...new Set(PARTIDOS.map(m => m.date?.substring(0,10)).filter(Boolean))].sort().indexOf(date) + 1;
  const dayLabel = _joParseMatchDate(date + 'T12:00:00').toLocaleDateString('es-ES', {weekday:'short', day:'numeric', month:'short', timeZone:'Europe/Madrid'});

  const header = '<div style="width:100%;display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
    '<span style="font-size:10px;font-weight:700;color:#fb923c;background:rgba(124,45,18,.4);padding:2px 8px;border-radius:20px;border:1px solid rgba(234,88,12,.3)">J' + jNum + '</span>' +
    '<span style="font-size:10px;color:#6b7280">' + dayLabel + '</span>' +
    '</div>';

  const buttons = matchesOfDay.map(m => {
    const key = getMatchKey(m);
    const isActive = boostedKey === key;
    return '<div style="display:inline-flex;align-items:center;gap:4px;">' +
      '<button onclick="' + onClickFn + '(\'' + key + '\',\'' + date + '\')" style="' +
        'display:inline-flex;align-items:center;gap:5px;' +
        'padding:4px 12px;border-radius:20px 0 0 20px;font-size:11px;font-weight:600;' +
        'border:1px solid ' + (isActive ? 'rgb(234,88,12)' : 'rgba(255,255,255,.1)') + ';border-right:none;' +
        'background:' + (isActive ? 'rgba(124,45,18,.7)' : 'rgba(255,255,255,.04)') + ';' +
        'color:' + (isActive ? 'rgb(251,191,36)' : 'rgba(255,255,255,.55)') + ';' +
        'cursor:pointer;white-space:nowrap;transition:all .2s;' +
      '">' + (isActive ? '🔥 ' : '') + m.home + ' vs ' + m.away +
      ' <span style="opacity:.45;font-size:10px">' + hora(m) + '</span></button>' +
      '<button onclick="scrollToMatchCard(\'' + key + '\')" title="Ir a la tarjeta" style="' +
        'display:inline-flex;align-items:center;justify-content:center;' +
        'padding:4px 8px;border-radius:0 20px 20px 0;font-size:10px;' +
        'border:1px solid ' + (isActive ? 'rgb(234,88,12)' : 'rgba(255,255,255,.1)') + ';border-left:none;' +
        'background:' + (isActive ? 'rgba(124,45,18,.5)' : 'rgba(255,255,255,.03)') + ';' +
        'color:rgba(255,255,255,.4);cursor:pointer;transition:all .2s;' +
        '" onmouseover="this.style.color=\'rgba(255,255,255,.8)\'" onmouseout="this.style.color=\'rgba(255,255,255,.4)\'">↓</button>' +
      '</div>';
  }).join('');

  return header + buttons;
}

function tickerExpandJornada(date) {
  // Buscar o crear panel en el ticker superior
  const ticker = document.getElementById('boost-ticker');
  if (!ticker) return;

  let panel = document.getElementById('boost-ticker-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'boost-ticker-panel';
    panel.style.cssText = 'width:100%;padding:8px 0 4px;border-top:1px solid rgba(124,45,18,.3);margin-top:4px;flex-wrap:wrap;gap:6px;align-items:center';
    ticker.appendChild(panel);
  }

  // Toggle: colapsar si ya está abierto para esta fecha
  if (panel.dataset.date === date && panel.style.display !== 'none') {
    panel.style.display = 'none';
    panel.dataset.date = '';
    return;
  }

  panel.dataset.date = date;
  panel.style.display = 'flex';
  panel.innerHTML = _buildMatchButtons(date, 'tickerBoostToggle');
}
window.tickerExpandJornada = tickerExpandJornada;

/* Expande panel de jornada dentro del CTA inferior */
/* Llamado desde el ticker al hacer click en un partido */
function tickerBoostToggle(matchKey, date) {
  // Desmarcar boost anterior del mismo día en las tarjetas
  if(boostPicks[date] && boostPicks[date] !== matchKey) {
    document.querySelectorAll('.card').forEach(card => {
      const oi = card.getAttribute('data-match-idx');
      if(oi === null) return;
      const om = PARTIDOS[Number(oi)];
      if(!om || getMatchKey(om) !== boostPicks[date]) return;
      const chk = card.querySelector('.boost-chk');
      const row = card.querySelector('.boost-row');
      if(chk){chk.checked=false;chk.disabled=false;}
      if(row){row.classList.remove('boost-on');row.style.opacity='';row.removeAttribute('title');}
      card.classList.remove('boost-active');
    });
  }

  // Si ya estaba activo, desactivar (toggle)
  if(boostPicks[date] === matchKey) {
    delete boostPicks[date];
    document.querySelectorAll('.card').forEach(card => {
      const oi = card.getAttribute('data-match-idx');
      if(oi === null) return;
      const om = PARTIDOS[Number(oi)];
      if(!om || getMatchKey(om) !== matchKey) return;
      const chk = card.querySelector('.boost-chk');
      const row = card.querySelector('.boost-row');
      if(chk){chk.checked=false;}
      if(row){row.classList.remove('boost-on');}
      card.classList.remove('boost-active');
    });
  } else {
    // Activar en el objeto boostPicks
    boostPicks[date] = matchKey;
    // Sincronizar con el check de la tarjeta correspondiente
    document.querySelectorAll('.card').forEach(card => {
      const oi = card.getAttribute('data-match-idx');
      if(oi === null) return;
      const om = PARTIDOS[Number(oi)];
      if(!om || getMatchKey(om) !== matchKey) return;
      const chk = card.querySelector('.boost-chk');
      const row = card.querySelector('.boost-row');
      if(chk){chk.checked=true;chk.disabled=false;}
      if(row){row.classList.add('boost-on');row.style.opacity='';row.removeAttribute('title');}
      card.classList.add('boost-active');
    });
  }

  saveBoostPicks();
  checkFinalizarReady?.();
  renderBoostTicker();
  checkGroupsComplete();
  // Re-renderizar vista jornada si está activa
  if (window._currentPage === 'jornada') setTimeout(() => renderVistaJornada(), 50);
  // Re-renderizar panel expandido si sigue abierto
  const openPanel = document.getElementById('boost-ticker-panel');
  if (openPanel && openPanel.dataset.date && openPanel.style.display !== 'none') {
    openPanel.innerHTML = _buildMatchButtons(openPanel.dataset.date, 'tickerBoostToggle');
  }
}
window.tickerBoostToggle = tickerBoostToggle;

/* ════════════════════════════════════════════════════════
   VISTA JORNADA — tarjetas compactas ordenadas por día
   F7.4-D-1: setVistaGrupos + _vistaActual eliminados.
   El toggle entre vistas lo gobierna showPage('grupos'|'jornada'|'directo')
   desde el bottom-tab. window._currentPage es la fuente de verdad.
   ════════════════════════════════════════════════════════ */

function renderVistaJornada() {
  const container = document.getElementById('jornada-container');
  if (!container) return;

  // Agrupar PARTIDOS por fecha
  const jornadasMap = {};
  PARTIDOS.forEach((m, idx) => {
    const date = m.date?.substring(0, 10);
    if (!date) return;
    if (!jornadasMap[date]) jornadasMap[date] = [];
    jornadasMap[date].push({ m, idx });
  });
  const dias = Object.keys(jornadasMap).sort();

  // Wrapper con sidebar única a la derecha
  const sidebarHtml = _buildJornadaRanking();

  // JO-3: jornada "viva" = primer día (cronológico) con algún partido aún
  // no finalizado. Pre-Mundial sin _liveScoresByMatchKey, todos cuentan
  // como por jugar → aliveDate = dias[0] (= J1 11-jun). Si TODAS las
  // jornadas están finalizadas (fin de torneo), aliveDate queda null y
  // el bloque init dejará todo colapsado por defecto. Solo se busca entre
  // jornadas de grupos; las 6 secciones KO arrancan siempre colapsadas.
  const _joLiveByKey = window._liveScoresByMatchKey || {};
  let aliveDate = null;
  for (let i = 0; i < dias.length; i++) {
    const _d = dias[i];
    const hasPorJugar = jornadasMap[_d].some(function (entry) {
      const dk = (typeof window.matchKeyFor === 'function') ? window.matchKeyFor(entry.m) : null;
      const live = dk ? _joLiveByKey[dk] : null;
      return !(live && live.status === 'finished');
    });
    if (hasPorJugar) { aliveDate = _d; break; }
  }

  // JO-1a live: ronda KO "actual" (round-genérico r32→final) = primera ronda de
  // ROUND_CONFIG con algún partido aún no finalizado. Solo se auto-expande cuando
  // la fase KO está activa: grupos terminados (aliveDate===null) o ya hay
  // actividad KO (algún slot con status ≠ 'notstarted'). Antes de eso el foco
  // queda en los grupos y las secciones KO arrancan colapsadas como hasta ahora.
  // "Avanzar la jornada actual a la ronda KO": al terminar los grupos, la ronda
  // KO en curso queda expandida y las jornadas de grupos colapsadas.
  let koAliveKey = null;
  let koPhaseActive = (aliveDate === null);
  if (typeof ROUND_CONFIG !== 'undefined' && Array.isArray(ROUND_CONFIG) &&
      typeof BRACKET === 'object' && BRACKET) {
    ROUND_CONFIG.forEach(function (cfg) {
      const rmatches = Array.isArray(BRACKET[cfg.key]) ? BRACKET[cfg.key] : [];
      if (!rmatches.length) return;
      let allFinished = true;
      rmatches.forEach(function (mm) {
        const krow = _joLiveByKey['wc2026_ko_' + mm.id];
        const st = krow && krow.status;
        if (st && st !== 'notstarted') koPhaseActive = true;
        if (st !== 'finished') allFinished = false;
      });
      if (koAliveKey === null && !allFinished) koAliveKey = cfg.key;
    });
  }

  // JO-3: aplicar defaults SOLO la primera vez. Después respetamos clicks
  // del usuario. Si una sección nueva aparece en re-renders posteriores
  // (poco probable, calendario fijo), por defecto queda colapsada.
  if (!_joCollapseInit) {
    dias.forEach(function (d) {
      _joSectionCollapsed['date:' + d] = (d !== aliveDate);
    });
    if (typeof ROUND_CONFIG !== 'undefined' && Array.isArray(ROUND_CONFIG)) {
      ROUND_CONFIG.forEach(function (cfg) {
        // Expandida solo la ronda KO en curso cuando la fase KO está activa.
        _joSectionCollapsed['ko:' + cfg.key] = !(koPhaseActive && cfg.key === koAliveKey);
      });
    }
    _joCollapseInit = true;
  }

  let sectionsHtml = '';
  dias.forEach((date, dIdx) => {
    const jNum = dIdx + 1;
    const matchesOfDay = jornadasMap[date];
    const boostKey  = boostPicks[date];

    // Separar finalizados / por jugar usando _liveScoresByMatchKey (status=finished).
    // Pre-mundial todos van a 'porJugar' — la sección 'FINALIZADOS' simplemente no se renderiza.
    const liveByKey = window._liveScoresByMatchKey || {};
    const finalizados = [];
    const porJugar    = [];
    matchesOfDay.forEach(({ m, idx }) => {
      const dk = (typeof window.matchKeyFor === 'function') ? window.matchKeyFor(m) : null;
      const live = dk ? liveByKey[dk] : null;
      if (live && live.status === 'finished') finalizados.push({ m, idx, live });
      else porJugar.push({ m, idx, live });
    });

    // Fecha humana corta para el header (rango si la jornada cubre >1 día — aquí siempre 1 día por agrupación).
    const dateObj = _joParseMatchDate(date + 'T12:00:00');
    const dayLabel = dateObj.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'Europe/Madrid' });

    const subTitle = matchesOfDay.length + ' partido' + (matchesOfDay.length === 1 ? '' : 's') +
                     ' · ' + finalizados.length + ' finalizado' + (finalizados.length === 1 ? '' : 's') +
                     ' · ' + porJugar.length + ' por jugar';

    const prevDate = dias[dIdx - 1] || null;
    const nextDate = dias[dIdx + 1] || null;
    const prevAttr = prevDate ? 'data-jump="jornada-' + prevDate + '"' : 'disabled';
    const nextAttr = nextDate ? 'data-jump="jornada-' + nextDate + '"' : 'disabled';

    let cardsHtml = '';
    if (finalizados.length) {
      cardsHtml += '<div class="jv2-section-label">Finalizados</div>';
      finalizados.forEach(({ m, idx, live }) => {
        cardsHtml += _buildJCard(m, idx, date, boostKey, live);
      });
    }
    if (porJugar.length) {
      cardsHtml += '<div class="jv2-section-label">Por jugar</div>';
      porJugar.forEach(({ m, idx, live }) => {
        cardsHtml += _buildJCard(m, idx, date, boostKey, live);
      });
    }

    // JO-3: estado de colapso para esta jornada. Default ya aplicado en el
    // bloque init de arriba; aquí solo leemos.
    const _collapseKey = 'date:' + date;
    const _isCollapsed = (_joSectionCollapsed[_collapseKey] === true);
    const _sectionCls = 'jv2-section' + (_isCollapsed ? ' is-collapsed' : '');
    const _ariaExpanded = _isCollapsed ? 'false' : 'true';

    sectionsHtml +=
      '<div class="' + _sectionCls + '" id="jornada-' + date + '" data-collapse-key="' + _collapseKey + '">' +
        '<div class="jv2-jornada-header" role="button" tabindex="0" aria-expanded="' + _ariaExpanded + '">' +
          '<button class="jv2-nav-arrow" type="button" ' + prevAttr + ' aria-label="Jornada anterior">‹</button>' +
          '<div class="jv2-jornada-title">' +
            '<div class="jv2-jornada-name">JORNADA ' + jNum + ' · GRUPOS' +
              ' <span class="jv2-section__chev" aria-hidden="true">▾</span>' +
            '</div>' +
            '<div class="jv2-jornada-date">' + dayLabel + ' · ' + matchesOfDay.length + ' partido' + (matchesOfDay.length === 1 ? '' : 's') + '</div>' +
          '</div>' +
          '<button class="jv2-nav-arrow" type="button" ' + nextAttr + ' aria-label="Jornada siguiente">›</button>' +
        '</div>' +
        '<div class="jv2-results-block">' +
          '<div class="jv2-results-title">Resultados</div>' +
          '<div class="jv2-results-sub">' + subTitle + '</div>' +
        '</div>' +
        cardsHtml +
      '</div>';
  });

  // JO-1a: esqueleto KO (16avos → Final). 6 secciones debajo de las jornadas
  // de grupos, mismo estilo .jv2-section + tarjetas con clases jv2-*. Lectura
  // pura (sin pronóstico KO, sin clicks) — pronósticos viven en Fase Final.
  var koSectionsHtml = _buildJKOSectionsHtml();

  // Layout: columna de jornadas + sidebar única sticky
  container.innerHTML =
    '<div class="jornada-wrap">' +
      '<div class="jornada-main jv2-main">' + sectionsHtml + koSectionsHtml + '</div>' +
      '<div class="jornada-sidebar">' + sidebarHtml + '</div>' +
    '</div>';

  // Wire nav arrows (scroll suave a la sección anterior/siguiente).
  container.querySelectorAll('.jv2-nav-arrow[data-jump]').forEach(btn => {
    btn.addEventListener('click', () => {
      const target = document.getElementById(btn.getAttribute('data-jump'));
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });

  // JO-3: handler delegado para toggle colapsar/expandir. Registro
  // idempotente con flag en el container — sobrevive a renderVistaJornada
  // (innerHTML replace en el container no destruye listeners propios del
  // container). Guards: clicks en .jv2-nav-arrow no disparan el toggle.
  if (!container._joCollapseDelegated) {
    container.addEventListener('click', function (ev) {
      if (ev.target.closest && ev.target.closest('.jv2-nav-arrow')) return;
      const header = ev.target.closest && ev.target.closest('.jv2-jornada-header');
      if (!header) return;
      const section = header.closest('.jv2-section');
      if (!section) return;
      const key = section.dataset.collapseKey;
      if (!key) return;
      const nowCollapsed = !section.classList.contains('is-collapsed');
      section.classList.toggle('is-collapsed', nowCollapsed);
      header.setAttribute('aria-expanded', String(!nowCollapsed));
      _joSectionCollapsed[key] = nowCollapsed;
    });
    // Keyboard a11y: Enter/Space en el header dispara el toggle.
    container.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      if (ev.target.closest && ev.target.closest('.jv2-nav-arrow')) return;
      const header = ev.target.closest && ev.target.closest('.jv2-jornada-header');
      if (!header) return;
      ev.preventDefault();
      header.click();
    });
    container._joCollapseDelegated = true;
  }

  // Cinta usuario móvil
  _renderUserStrip();
}
window.renderVistaJornada = renderVistaJornada;

// _buildJCard — tarjeta dark de Jornada (Design v2):
//   Top: 🏟️ estadio | día + hora.
//   Mid: bandera circular | marcador grande | bandera circular (códigos debajo).
//   Chips de acierto (solo finalizados): 1X2 ✓/✗, Exacto ✓/✗, Goleador ✓/✗, vs IA ✓/✗
//                                        + chip dorado pts ganados (con marca ×2 si boost+exacto).
//   Boost row debajo de chips.
// `live` es la fila de window._liveScoresByMatchKey si existe (puede ser null).

// Mapping ISO3 → ISO2 alineado con bucket miniatures/flags-sm/<ISO2>.webp.
// 48 entradas, una por equipo del Mundial 2026.
// Notas custom (no estándar ISO): ENG→EN (Inglaterra), SCO→SC (Escocia).
// Duplicado de ui-directo.js IIFE — mantenerlos sincronizados.
const ISO3_TO_ISO2 = {
  MEX:'MX', RSA:'ZA', KOR:'KR', CZE:'CZ', CAN:'CA', BIH:'BA', QAT:'QA', SUI:'CH',
  BRA:'BR', MAR:'MA', HAI:'HT', SCO:'SC', USA:'US', PAR:'PY', AUS:'AU', TUR:'TR',
  GER:'DE', CUW:'CW', CIV:'CI', ECU:'EC', NED:'NL', JPN:'JP', SWE:'SE', TUN:'TN',
  BEL:'BE', EGY:'EG', IRN:'IR', NZL:'NZ', ESP:'ES', CPV:'CV', KSA:'SA', URU:'UY',
  FRA:'FR', SEN:'SN', IRQ:'IQ', NOR:'NO', ARG:'AR', ALG:'DZ', AUT:'AT', JOR:'JO',
  POR:'PT', COD:'CD', UZB:'UZ', COL:'CO', ENG:'EN', CRO:'HR', GHA:'GH', PAN:'PA'
};

function _buildJCard(m, idx, date, boostKey, live) {
  const matchKey = getMatchKey(m);
  const pred = predictions[matchKey] || {};
  const isBoost = boostKey === matchKey;
  const isFinished = !!(live && live.status === 'finished');

  // Equipos y banderas
  const hTeam = EQUIPOS.find(e => e.name === m.home);
  const aTeam = EQUIPOS.find(e => e.name === m.away);
  const hFlag = hTeam ? SB + '/flags/' + hTeam.flag + '.png' : '';
  const aFlag = aTeam ? SB + '/flags/' + aTeam.flag + '.png' : '';
  const hCode = hTeam ? hTeam.flag : (m.home || '').substring(0, 3).toUpperCase();
  const aCode = aTeam ? aTeam.flag : (m.away || '').substring(0, 3).toUpperCase();
  // JO-2: la card muestra el nombre completo de la selección (no el ISO3).
  // Fallback al nombre del PARTIDOS si no resolvemos el equipo en EQUIPOS.
  const hName = hTeam ? hTeam.name : (m.home || hCode);
  const aName = aTeam ? aTeam.name : (m.away || aCode);

  // Rectangular flags planas (sprint Jornada Flags Rect) — URL del bucket
  // miniatures/flags-sm/<ISO2>.webp. Se inyecta como CSS var --flag-rect-url
  // leída por .jv2-flag (CSS). El <img> legacy queda como fallback hidden por CSS.
  const hIso2 = hTeam && ISO3_TO_ISO2[hTeam.flag];
  const aIso2 = aTeam && ISO3_TO_ISO2[aTeam.flag];
  const hFlagRectStyle = hIso2 ? ' style="--flag-rect-url:url(\'' + SB + '/miniatures/flags-sm/' + hIso2 + '.webp\')"' : '';
  const aFlagRectStyle = aIso2 ? ' style="--flag-rect-url:url(\'' + SB + '/miniatures/flags-sm/' + aIso2 + '.webp\')"' : '';

  // Estado del pronóstico
  const hasPred = pred.l !== null && pred.l !== undefined && pred.v !== null && pred.v !== undefined;

  // Marcador a mostrar:
  //   - finalizado → score real desde live (o realHome/realAway como fallback).
  //   - no finalizado → predicción del usuario o '—'.
  let scoreL, scoreR;
  if (isFinished) {
    scoreL = (live && live.score_home != null) ? live.score_home : (m.realHome != null ? m.realHome : '—');
    scoreR = (live && live.score_away != null) ? live.score_away : (m.realAway != null ? m.realAway : '—');
  } else {
    scoreL = hasPred ? pred.l : '—';
    scoreR = hasPred ? pred.v : '—';
  }

  // Hora y estadio — instante real del kickoff (date_utc, igual que Directo).
  // El día corto (weekday) se deriva del MISMO instante Madrid para que no
  // baile en partidos de madrugada (02:00Z → 04:00 Madrid del día siguiente
  // a la fecha de sede). ERR-92.
  const _koMs = _joKickoffMs(m);
  const dt = _koMs != null ? new Date(_koMs) : _joParseMatchDate(m.date);
  const hora = dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Madrid' });
  const dayShort = dt.toLocaleDateString('es-ES', { weekday: 'short', timeZone: 'Europe/Madrid' }).replace('.', '').toUpperCase();
  const stadium = m.stadium ? m.stadium.replace(' Stadium', '').replace(' Estadio', '') : '';

  // Chips de acierto + pts ganados — solo si finalizado y tenemos resultado real numérico.
  let chipsHtml = '';
  let goldChipHtml = '';
  if (isFinished && hasPred && typeof scoreL === 'number' && typeof scoreR === 'number') {
    const realL = scoreL;
    const realR = scoreR;
    const predWithSaved = Object.assign({}, pred, { saved: pred.saved !== false });

    const isExact = pred.l === realL && pred.v === realR;
    const signMatch = Math.sign(pred.l - pred.v) === Math.sign(realL - realR);
    // Goleador (R2a post-J1): scorers CANÓNICOS del bridge — la key legacy
    // matchKey ES la de results.match_results (window._matchResultsByKey,
    // live-sync). Fallback: derivar de los events crudos con el helper
    // compartido de scoring.js (espejo del extractScorers del bridge). El
    // placeholder anterior (primer jugador de plantilla del ganador) marcaba
    // ✗ goleadores acertados (Parrandas: 2-1 Quinones sobre MEX-RSA 2-0) y
    // el calc sin 5º argumento caía al mismo placeholder (ERR-91) → +1 pts
    // en vez de +3.
    let realScorers;
    const mrEntry = (window._matchResultsByKey || {})[matchKey];
    if (mrEntry && Array.isArray(mrEntry.scorers)) {
      realScorers = mrEntry.scorers;
    } else if (typeof deriveScorersFromEvents === 'function' && live) {
      realScorers = deriveScorersFromEvents(
        live.events, !!live._teams_swapped,
        hTeam ? hTeam.flag : null, aTeam ? aTeam.flag : null);
    }
    // golOk espejo del motor: pick acertado, o regla 0-0 (slot "sin goleador").
    const golMatch = pred.gol
      ? (Array.isArray(realScorers) && realScorers.indexOf(pred.gol) !== -1)
      : (pred.l === 0 && pred.v === 0 && realL === 0 && realR === 0);
    const iaBonus = (typeof iaBonusWillApply === 'function') ? iaBonusWillApply(matchKey, predWithSaved, realL, realR) : false;

    const chip = (label, ok) => {
      const cls = ok ? 'jv2-chip jv2-chip--ok' : 'jv2-chip jv2-chip--ko';
      const mark = ok ? '✓' : '✗';
      return '<span class="' + cls + '">' + label + ' ' + mark + '</span>';
    };
    chipsHtml = chip('1X2', signMatch) + chip('Exacto', isExact);
    if (pred.gol) chipsHtml += chip('Goleador', golMatch);
    // vs IA: chip solo si había contra-IA (mySign !== ia.sign). Si ni siquiera había contra-IA, no se muestra.
    const ia = (typeof iaPredictions === 'object') ? iaPredictions[matchKey] : null;
    const mySign = (typeof getMySign === 'function') ? getMySign(pred) : null;
    if (ia && ia.sign && mySign && mySign !== ia.sign) chipsHtml += chip('vs IA', iaBonus);

    const pts = (typeof calcMatchPoints === 'function') ? calcMatchPoints(predWithSaved, realL, realR, matchKey, realScorers) : 0;
    // R3: el ×2 SOLO con exacto Y goleador a la vez (regla canónica San) —
    // misma condición que el motor; copy alineado con Directo (Item 5).
    const isBoostX2 = isBoost && isExact && golMatch;
    goldChipHtml = '<span class="jv2-chip jv2-chip--gold">+' + pts + ' pts' + (isBoostX2 ? ' (boost ×2)' : '') + '</span>';
  }

  const boostRowCls = isBoost ? 'jv2-boost active' : 'jv2-boost';
  // Rótulo recortado a "Boost" para dejar sitio al chip "Liga" (brief §3.1).
  // El estado activo se distingue por la clase .active (CSS) + checkbox checked.
  const boostLabel = isBoost
    ? '<span class="jv2-boost-label active">🔥 Boost</span>'
    : '<span class="jv2-boost-label">🔥 Boost</span>';
  const chkChecked = isBoost ? 'checked' : '';

  return (
    '<div class="jv2-card' + (isBoost ? ' is-boost' : '') + (isFinished ? ' is-finished' : '') + '" id="jcard-' + idx + '">' +
      '<div class="jv2-card-top">' +
        '<div class="jv2-card-stadium">🏟️ ' + stadium + '</div>' +
        '<div class="jv2-card-when">' + dayShort + ' · ' + hora + '</div>' +
      '</div>' +
      '<div class="jv2-card-mid">' +
        '<div class="jv2-team">' +
          '<div class="jv2-flag"' + hFlagRectStyle + '><img src="' + hFlag + '" loading="lazy" onerror="this.style.display=\'none\'"></div>' +
          '<div class="jv2-team-code" title="' + hName + '">' + hName + '</div>' +
        '</div>' +
        '<div class="jv2-score">' +
          '<span class="jv2-score-num">' + scoreL + '</span>' +
          '<span class="jv2-score-sep">:</span>' +
          '<span class="jv2-score-num">' + scoreR + '</span>' +
        '</div>' +
        '<div class="jv2-team">' +
          '<div class="jv2-flag"' + aFlagRectStyle + '><img src="' + aFlag + '" loading="lazy" onerror="this.style.display=\'none\'"></div>' +
          '<div class="jv2-team-code" title="' + aName + '">' + aName + '</div>' +
        '</div>' +
      '</div>' +
      (chipsHtml || goldChipHtml
        ? '<div class="jv2-chips">' + chipsHtml + goldChipHtml + '</div>'
        : '') +
      '<div class="' + boostRowCls + '">' +
        '<input type="checkbox" ' + chkChecked + ' ' +
          'onchange="jcardBoostToggle(\'' + matchKey + '\',\'' + date + '\',this)" ' +
          'class="jv2-boost-check">' +
        boostLabel +
        '<button onclick="openPrediccionesLiga(\'' + matchKey + '\')" class="jv2-card-link" type="button">📊 Liga</button>' +
        '<button onclick="openTarjetaStats(\'' + matchKey + '\')" class="jv2-card-link" type="button">🔍 Ver tarjeta</button>' +
      '</div>' +
    '</div>'
  );
}

function jcardBoostToggle(matchKey, date, checkbox) {
  if (window.tickerBoostToggle) {
    const wasActive = boostPicks[date] === matchKey;
    if (checkbox.checked && !wasActive) {
      tickerBoostToggle(matchKey, date);
    } else if (!checkbox.checked && wasActive) {
      tickerBoostToggle(matchKey, date);
    }
  }
  setTimeout(() => renderVistaJornada(), 50);
}
window.jcardBoostToggle = jcardBoostToggle;

function _buildJornadaRanking() {
  // Si _sbData no está disponible, disparar carga y devolver placeholder
  if (!window._sbData || window._sbData.length === 0) {
    // Intentar cargar scoreboard si la función existe
    if (typeof sbLoad === 'function') {
      sbLoad().then(() => {
        // Tras cargar, re-renderizar si seguimos en vista jornada
        if (window._currentPage === 'jornada') renderVistaJornada();
      });
    }
    return '<div class="jornada-ranking">' +
      '<div class="jornada-ranking-title">🏆 Clasificación</div>' +
      '<div style="font-size:11px;color:#4b5563;text-align:center;padding:12px 0">' +
        'Cargando clasificación...' +
      '</div></div>';
  }
  const myId = window.currentUser?.id;
  const rows = window._sbData.slice(0, 10);
  // F2: posición rank() con empates compartidos (helper data.js) — misma
  // semántica que v_league_rank y el widget del Predictor.
  const _rk = (i) => (typeof rankConEmpates === 'function')
    ? rankConEmpates(rows, i, (u) => u.total) : (i + 1);
  return '<div class="jornada-ranking">' +
    '<div class="jornada-ranking-title">🏆 Clasificación liga</div>' +
    rows.map((u, i) => {
      const isMe = u.uid === myId;
      const ini  = (u.nombre || '?').charAt(0).toUpperCase();
      const rank = _rk(i);
      const posCls = rank <= 3 ? 'jrank-pos top' : 'jrank-pos';
      const medals = ['🥇','🥈','🥉'];
      const posStr = rank <= 3 ? medals[rank - 1] : rank;
      return '<div class="jrank-row' + (isMe ? ' jrank-me' : '') + '">' +
        '<span class="' + posCls + '">' + posStr + '</span>' +
        '<div class="jrank-avatar">' + ini + '</div>' +
        '<span class="jrank-name">' + escapeHtml(u.nombre) + '</span>' +
        '<span class="jrank-pts">' + u.total + '</span>' +
      '</div>';
    }).join('') +
  '</div>';
}

function _renderUserStrip() {
  const el = document.getElementById('jornada-user-strip');
  if (!el) return;
  const myId = window.currentUser?.id;
  if (!myId || !window._sbData || window._sbData.length === 0) return;
  const idx = window._sbData.findIndex(u => u.uid === myId);
  if (idx === -1) return;
  const u = window._sbData[idx];
  // F2: rank() con empates compartidos — el índice (row_number) mostraba
  // #15 a Parrandas cuando su posición real con empates a 3 pts es #13.
  const rank = (typeof rankConEmpates === 'function')
    ? rankConEmpates(window._sbData, idx, (r) => r.total) : (idx + 1);
  const medals = ['\u{1F947}','\u{1F948}','\u{1F949}'];
  const pos = rank <= 3 ? medals[rank - 1] : '#' + rank;
  el.innerHTML =
    '<span class="jus-pos">' + pos + '</span>' +
    '<span class="jus-name">' + escapeHtml(u.nombre) + '</span>' +
    '<span class="jus-pts">' + u.total + ' pts</span>';
}
window._renderUserStrip = _renderUserStrip;

function openJcardModal(matchKey, opts) {
  opts = opts || {};
  const cardEl = document.getElementById('card-wrap-' + matchKey);
  if (!cardEl) {
    // Si estamos en Grupos pero la card no está montada todavía → lazy renderAll
    // Si estamos en Jornada (no hay groups-container) → ir directo al modal compact
    const groupsContainer = document.getElementById('groups-container');
    if (groupsContainer) {
      renderAll(() => _showJcardModal(matchKey, opts));
    } else {
      _showJcardModal(matchKey, opts);
    }
    return;
  }
  _showJcardModal(matchKey, opts);
}

function _showJcardModal(matchKey, opts) {
  opts = opts || {};
  const editable = !!opts.editable;

  const prev = document.getElementById('jcard-modal-overlay');
  if (prev) prev.remove();

  const initialCardEl = document.getElementById('card-wrap-' + matchKey);
  // El branch !editable (modal compact desde Jornada) NO necesita initialCardEl.
  // El branch editable (Grupos compact card click) sí lo necesita para clonarlo.
  if (!initialCardEl && !!opts.editable) return;

  const overlay = document.createElement('div');
  overlay.id = 'jcard-modal-overlay';
  overlay.style.cssText =
    'position:fixed;inset:0;background:rgba(0,0,0,.8);z-index:9999;' +
    'display:flex;align-items:flex-start;justify-content:center;padding:16px;' +
    'animation:fadeIn .15s ease;box-sizing:border-box;overflow:hidden;';

  const wrapper = document.createElement('div');
  wrapper.style.cssText =
    'margin:0 auto;width:min(360px, calc(100vw - 32px));max-height:calc(100vh - 32px);' +
    'overflow-x:hidden;overflow-y:auto;border-radius:16px;padding-bottom:24px;' +
    'position:relative;box-sizing:border-box;left:0;right:0;';

  const closeBtn = document.createElement('button');
  closeBtn.textContent = '\u2715';
  closeBtn.style.cssText =
    'position:sticky;top:8px;float:right;margin:8px 8px 0 0;z-index:1;' +
    'background:rgba(0,0,0,.6);border:1px solid #3a3a3e;color:#9ca3af;' +
    'width:28px;height:28px;border-radius:50%;cursor:pointer;font-size:12px;' +
    'display:flex;align-items:center;justify-content:center;';

  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // READ-ONLY (Jornada Ver tarjeta) \u2014 clone path intact.
  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  if (!editable) {
    // Limpiar overlay si fue insertado (defensivo - puede no estar aún en el DOM)
    if (overlay.parentNode) overlay.remove();

    // Localizar el partido y la predicción del usuario
    const match = (typeof PARTIDOS !== 'undefined') ? PARTIDOS.find(m => getMatchKey(m) === matchKey) : null;
    if (!match) return;

    const pred = (typeof predictions !== 'undefined' && predictions[matchKey]) ? predictions[matchKey] : {};
    const matchDate = match.date ? match.date.substring(0, 10) : null;
    const isBoost = !!(matchDate && (typeof boostPicks !== 'undefined') && boostPicks[matchDate] === matchKey);

    // Calcular flags rectangulares (mismo patrón que builder de cards)
    const SB_LOCAL = (typeof SB !== 'undefined') ? SB : '';
    const hTeam = (typeof EQUIPOS !== 'undefined') ? EQUIPOS.find(t => t.name === match.home) : null;
    const aTeam = (typeof EQUIPOS !== 'undefined') ? EQUIPOS.find(t => t.name === match.away) : null;
    // ISO3_TO_ISO2 ya disponible en top-level (añadido en PR #95 sprint jornada-flags-rect)
    const hIso2 = hTeam && ISO3_TO_ISO2[hTeam.flag];
    const aIso2 = aTeam && ISO3_TO_ISO2[aTeam.flag];
    const hFlagUrl = hIso2 ? (SB_LOCAL + '/miniatures/flags-sm/' + hIso2 + '.webp') : '';
    const aFlagUrl = aIso2 ? (SB_LOCAL + '/miniatures/flags-sm/' + aIso2 + '.webp') : '';

    // Formateo de día/hora
    const stadium = match.stadium || '';
    let whenLabel = '';
    if (match.date) {
      // Instante real del kickoff (date_utc, igual que Directo) — dow/día se
      // derivan del mismo ms para no bailar en partidos de madrugada. ERR-92.
      const _koMs = _joKickoffMs(match);
      const d = _koMs != null ? new Date(_koMs) : _joParseMatchDate(match.date);
      const TZ = 'Europe/Madrid';
      const dow = d.toLocaleDateString('es-ES', { weekday: 'short', timeZone: TZ }).toUpperCase().replace('.', '');
      // JO-4: getDate() devuelve hora local del dispositivo; usar Intl con TZ Madrid.
      const day = d.toLocaleDateString('es-ES', { day: 'numeric', timeZone: TZ });
      const monthShort = d.toLocaleDateString('es-ES', { month: 'short', timeZone: TZ }).toUpperCase().replace('.', '');
      const hhmm = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: TZ });
      whenLabel = `${dow} · ${day} ${monthShort} · ${hhmm}`;
    }

    // Score predicho (puede estar vacío si el usuario no guardó nada)
    const hasScore = pred && pred.local !== undefined && pred.local !== null && pred.local !== '';
    const scoreH = hasScore ? pred.local : '—';
    const scoreA = hasScore ? pred.visitante : '—';

    // Goleador (solo si está)
    const scorer = (pred && pred.scorer) ? pred.scorer : null;

    // Multiplicador puntos
    const ptsLabel = isBoost ? '×2 pts' : '×1 pts';

    // ─── HTML del modal compact ───
    const compactOverlay = document.createElement('div');
    compactOverlay.id = 'jcard-modal-overlay';
    compactOverlay.className = 'jcard-modal-overlay';

    const card = document.createElement('div');
    card.className = 'jcard-compact' + (isBoost ? ' is-boost' : '');

    card.innerHTML =
      (isBoost ? '<div class="jcard-compact-badge">🔥 BOOST ACTIVO</div>' : '') +
      '<button type="button" class="jcard-compact-close" aria-label="Cerrar">✕</button>' +
      '<div class="jcard-compact-context">' +
        (stadium ? '<div class="jcard-compact-stadium">🏟️ ' + stadium + '</div>' : '') +
        (whenLabel ? '<div class="jcard-compact-when">' + whenLabel + '</div>' : '') +
      '</div>' +
      '<div class="jcard-compact-teams">' +
        '<div class="jcard-compact-team">' +
          (hFlagUrl ? '<div class="jcard-compact-flag" style="background-image:url(\'' + hFlagUrl + '\')"></div>' : '<div class="jcard-compact-flag"></div>') +
          // JO-2: nombre completo (no ISO3). Fallback a match.home si no resolvemos el equipo.
          '<div class="jcard-compact-team-code" title="' + (hTeam ? hTeam.name : match.home) + '">' + (hTeam ? hTeam.name : match.home) + '</div>' +
        '</div>' +
        '<div class="jcard-compact-score">' +
          '<div class="jcard-compact-score-label">Tu predicción</div>' +
          '<div class="jcard-compact-score-num">' +
            (hasScore ? scoreH : '<span class="jcard-compact-score-empty">—</span>') +
            '<span class="jcard-compact-score-sep">:</span>' +
            (hasScore ? scoreA : '<span class="jcard-compact-score-empty">—</span>') +
          '</div>' +
        '</div>' +
        '<div class="jcard-compact-team">' +
          (aFlagUrl ? '<div class="jcard-compact-flag" style="background-image:url(\'' + aFlagUrl + '\')"></div>' : '<div class="jcard-compact-flag"></div>') +
          '<div class="jcard-compact-team-code" title="' + (aTeam ? aTeam.name : match.away) + '">' + (aTeam ? aTeam.name : match.away) + '</div>' +
        '</div>' +
      '</div>' +
      (scorer ? (
        '<div class="jcard-compact-scorer">' +
          '<span class="jcard-compact-scorer-icon">⚽</span>' +
          '<div class="jcard-compact-scorer-body">' +
            '<div class="jcard-compact-scorer-label">Goleador</div>' +
            '<div class="jcard-compact-scorer-name">' + scorer + '</div>' +
          '</div>' +
        '</div>'
      ) : '') +
      '<div class="jcard-compact-footer">' +
        '<span class="jcard-compact-footer-pts">' + ptsLabel + '</span>' +
      '</div>';

    compactOverlay.appendChild(card);
    document.body.appendChild(compactOverlay);

    compactOverlay.onclick = (e) => { if (e.target === compactOverlay) compactOverlay.remove(); };
    card.querySelector('.jcard-compact-close').onclick = () => compactOverlay.remove();
    return;
  }

  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  // EDITABLE (Grupos compact card click) \u2014 MOVE original + nav.
  // Replica el patr\u00f3n de Fase Final (_renderElimExpanded): flechas
  // \u2039 \u203a + counter "X/N" para navegar entre los partidos del mismo
  // grupo. Cada navegaci\u00f3n restituye el actual y mueve el siguiente.
  // \u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500\u2500
  const startMatch = (typeof PARTIDOS !== 'undefined') ? PARTIDOS.find(function (m) {
    return (typeof getMatchKey === 'function') ? getMatchKey(m) === matchKey : false;
  }) : null;
  const matchList = (startMatch && typeof PARTIDOS !== 'undefined')
    ? PARTIDOS.filter(function (m) { return m.group === startMatch.group; })
    : [];
  let currentIdx = matchList.findIndex(function (m) {
    return (typeof getMatchKey === 'function') ? getMatchKey(m) === matchKey : false;
  });
  if (currentIdx < 0) currentIdx = 0;

  // Slide 7 (1-indexed): tabla de clasificación del grupo. Se monta como
  // overlay transient sin restitución (currentAnchors=null en _placeStandingsIntoModal).
  const totalSteps = matchList.length + 1;

  // Nav header (counter + arrows). Solo si hay >1 partido en el grupo.
  let navHeader = null;
  let prevBtn = null;
  let nextBtn = null;
  let counterEl = null;
  if (totalSteps > 1) {
    navHeader = document.createElement('div');
    navHeader.className = 'jcard-nav';

    prevBtn = document.createElement('button');
    prevBtn.type = 'button';
    prevBtn.className = 'jcard-nav__arrow jcard-nav__arrow--prev';
    prevBtn.setAttribute('aria-label', 'Partido anterior');
    prevBtn.textContent = '\u2039';

    counterEl = document.createElement('span');
    counterEl.className = 'jcard-nav__counter';

    nextBtn = document.createElement('button');
    nextBtn.type = 'button';
    nextBtn.className = 'jcard-nav__arrow jcard-nav__arrow--next';
    nextBtn.setAttribute('aria-label', 'Partido siguiente');
    nextBtn.textContent = '\u203a';

    navHeader.appendChild(prevBtn);
    navHeader.appendChild(counterEl);
    navHeader.appendChild(nextBtn);
    wrapper.appendChild(navHeader);
  }

  wrapper.appendChild(closeBtn);
  overlay.appendChild(wrapper);
  document.body.appendChild(overlay);

  // Estado de la tarjeta actualmente en el modal.
  let currentTarget = null;
  let currentAnchors = null; // { parent, nextSibling, styleAttr, matchKey }
  let lastCardWidth = null; // cacheo del offsetWidth de la última card colocada en el wrapper. Lo consume _placeStandingsIntoModal para mantener armonía visual con la slide standings.

  function _restoreCurrent() {
    if (!currentTarget) return;
    // Caso transient (slide standings): no hay restitución, solo remove.
    if (currentAnchors === null) {
      if (currentTarget.parentNode) currentTarget.parentNode.removeChild(currentTarget);
      currentTarget = null;
      return;
    }
    const t = currentTarget;
    const a = currentAnchors;
    if (a.styleAttr === null) t.removeAttribute('style');
    else t.setAttribute('style', a.styleAttr);
    if (a.nextSibling && a.nextSibling.parentNode === a.parent) {
      a.parent.insertBefore(t, a.nextSibling);
    } else {
      a.parent.appendChild(t);
    }
    try {
      document.dispatchEvent(new CustomEvent('jcard:updated', { detail: { matchKey: a.matchKey } }));
    } catch (e) { /* no-op */ }
    currentTarget = null;
    currentAnchors = null;
  }

  function _placeIntoModal(mk) {
    const cardEl = document.getElementById('card-wrap-' + mk);
    if (!cardEl) return null;
    currentAnchors = {
      parent: cardEl.parentNode,
      nextSibling: cardEl.nextSibling,
      styleAttr: cardEl.getAttribute('style'),
      matchKey: mk
    };
    cardEl.style.margin = '0 auto';
    cardEl.style.left = '0';
    cardEl.style.right = '0';
    wrapper.appendChild(cardEl);
    cardEl.style.width = '100%';
    cardEl.style.margin = '0 auto';
    lastCardWidth = cardEl.offsetWidth;
    currentTarget = cardEl;
    // Volver al top del wrapper en cada navegaci\u00f3n.
    wrapper.scrollTop = 0;
    return cardEl;
  }

  function _placeStandingsIntoModal() {
    if (typeof window._renderGruposStandings !== 'function') return null;
    const letra = startMatch && startMatch.group;
    if (!letra) return null;
    const standingsCard = window._renderGruposStandings(letra);
    if (!standingsCard) return null;
    standingsCard.style.padding = '0';
    standingsCard.style.width = '100%';
    standingsCard.style.boxSizing = 'border-box';
    const slot = document.createElement('div');
    slot.className = 'jcard-modal-standings-slot';
    slot.style.cssText =
      'margin:0 auto;box-sizing:border-box;padding:0;width:100%;';
    slot.appendChild(standingsCard);
    wrapper.appendChild(slot);
    currentTarget = slot;
    currentAnchors = null;
    wrapper.scrollTop = 0;
    return slot;
  }

  function _updateNavHeader() {
    if (!navHeader) return;
    counterEl.textContent = (currentIdx + 1) + ' / ' + totalSteps;
    if (currentIdx <= 0) prevBtn.setAttribute('aria-disabled', 'true');
    else prevBtn.removeAttribute('aria-disabled');
    if (currentIdx >= totalSteps - 1) nextBtn.setAttribute('aria-disabled', 'true');
    else nextBtn.removeAttribute('aria-disabled');
  }

  function _navigateTo(idx) {
    if (idx < 0 || idx >= totalSteps) return;
    if (idx === currentIdx && currentTarget) return;
    _restoreCurrent();
    currentIdx = idx;
    if (idx < matchList.length) {
      // Slide partido (0..matchList.length-1)
      const newKey = (typeof getMatchKey === 'function') ? getMatchKey(matchList[idx]) : null;
      if (!newKey) return;
      _placeIntoModal(newKey);
    } else {
      // Slide standings (idx === matchList.length)
      _placeStandingsIntoModal();
    }
    _updateNavHeader();
  }

  function closeModal() {
    _restoreCurrent();
    overlay.remove();
  }

  if (prevBtn) prevBtn.addEventListener('click', function () { _navigateTo(currentIdx - 1); });
  if (nextBtn) nextBtn.addEventListener('click', function () { _navigateTo(currentIdx + 1); });
  overlay.onclick = (e) => { if (e.target === overlay) closeModal(); };
  closeBtn.onclick = closeModal;

  // Initial placement.
  _placeIntoModal(matchKey);
  _updateNavHeader();
}
window.openJcardModal = openJcardModal;

function initGrupos() {
  // Mostrar barra global de dados si usuario logueado
  const diceBar = document.getElementById('dice-global-bar');
  if(diceBar && currentUser && !window._porraCerrada) diceBar.style.display = 'flex';
  window.scrollTo(0,0);
  renderAll(() => {
    // Cuando todos los grupos están en DOM, re-renderizar tablas con datos en memoria
    if (typeof refreshGroupTables === 'function') refreshGroupTables();
  });
  checkGroupsComplete();
  // Ticker boost: mostrar partidos de hoy
  if(typeof renderBoostTicker === 'function') renderBoostTicker();
  // Actualizar countdown cada 5s (no cada 1s — mejora rendimiento scroll)
  // Solo actualiza los pills de estado, no re-renderiza todo
  setInterval(() => {
    PARTIDOS.forEach((match, idx) => {
      const pill = document.getElementById('spill-'+idx);
      const stxt = document.getElementById('stxt-'+idx);
      if(!pill || !stxt) return;
      const estado = getEstadoPartido(match);
      if(estado==='open'){
        pill.className='status-pill open';
        const ms=new Date(match.date)-4*24*3600*1000-new Date();
        stxt.textContent='Abierta · '+fmtMs(ms);
      } else if(estado==='closing'){
        pill.className='status-pill closing';
        const ms=new Date(match.date)-2*24*3600*1000-new Date();
        stxt.textContent='¡Cierra en '+fmtMs(ms)+'!';
      } else if(estado==='live'){
        pill.className='status-pill live';
        const min=Math.min(Math.floor((new Date()-new Date(match.date))/60000),90);
        stxt.textContent='EN VIVO '+min+"'";
      }
      // closed y done no cambian — no actualizar
    });
    updateGlobalPoints();
    checkGroupsComplete(); // habilitar botón eliminatorias
  }, 1000);

}



// ─────────────────────────────────────────────────────────────────────
// Sprint B · Grupos redesign helpers (G1: chips A-L, G2: card shell)
// G3 (carousel) y G4 (standings) viven más abajo. Reusa .collap pattern
// de predictor-shell.css. Ver docs: PR Sprint B.
// ─────────────────────────────────────────────────────────────────────

function _getGroupCount(letra) {
  if (typeof getGroupCompleted === 'function') return getGroupCompleted(letra);
  var matches = (typeof PARTIDOS !== 'undefined' ? PARTIDOS : []).filter(function (m) {
    return m.group === letra;
  });
  var done = 0;
  matches.forEach(function (m) {
    var matchKey = (typeof getMatchKey === 'function') ? getMatchKey(m) : null;
    var pred = (typeof predictions !== 'undefined' && matchKey) ? predictions[matchKey] : null;
    if (pred && pred.l != null && pred.v != null) done++;
  });
  return done;
}

// F1.1e: _ensureGloboCintaMount eliminado — la cinta dorada (D8) deja de
// existir; el trigger del overlay vive ahora en .v3-qualified-cta del shell v3,
// que invoca window._openGloboOverlay() (expuesto en ui-globo-equipos.js).

function _renderGruposLetterBar() {
  var bar = document.getElementById('grupos-letter-bar');
  if (!bar) return;
  var letras = (typeof GRUPOS !== 'undefined' ? GRUPOS : []).map(function (g) { return g.letra; });
  // Replica visual del stepper de Fase Final (.fc-elim-stepper) — mismas
  // pills, mismos states (is-active dorado / is-complete verde / is-locked).
  // Sticky position via wrapper class .fc-grupos-stepper-wrap.
  var html = '<div class="fc-grupos-stepper-wrap"><div class="fc-elim-stepper fc-grupos-stepper" role="tablist">';
  letras.forEach(function (letra) {
    var count = _getGroupCount(letra);
    var classes = 'fc-elim-stepper__item';
    if (count === 6)        classes += ' is-complete';
    var lbl = (typeof escapeHtml === 'function') ? escapeHtml(letra) : letra;
    html += '<button type="button" class="' + classes +
              '" data-letra="' + lbl + '" role="tab" aria-label="Grupo ' + lbl +
              '" onclick="_scrollToGrupoCard(\'' + lbl + '\')">' +
              '<span class="fc-elim-stepper__label">' + lbl + '</span>' +
              '<span class="fc-elim-stepper__counter">' + count + '/6</span>' +
            '</button>';
  });
  html += '</div></div>';
  bar.innerHTML = html;
}

function _scrollToGrupoCard(letra) {
  var card = document.getElementById('grupo-card-' + letra);
  if (card) card.scrollIntoView({ behavior: 'smooth', block: 'start' });
  _setActiveChip(letra);
}

function _setActiveChip(letra) {
  var chips = document.querySelectorAll('.fc-grupos-stepper .fc-elim-stepper__item');
  chips.forEach(function (c) {
    c.classList.toggle('is-active', c.getAttribute('data-letra') === letra);
  });
}

function _refreshGruposLetterBar() {
  var chips = document.querySelectorAll('.fc-grupos-stepper .fc-elim-stepper__item');
  chips.forEach(function (c) {
    var letra = c.getAttribute('data-letra');
    var count = _getGroupCount(letra);
    c.classList.toggle('is-complete', count === 6);
    var cnt = c.querySelector('.fc-elim-stepper__counter');
    if (cnt) cnt.textContent = count + '/6';
  });
}

window._renderGruposLetterBar = _renderGruposLetterBar;
window._refreshGruposLetterBar = _refreshGruposLetterBar;
window._scrollToGrupoCard = _scrollToGrupoCard;
window._setActiveChip = _setActiveChip;

// ─────────────────────────────────────────────────────────────────────
// G2 · Card colapsable header (12 grupos A-L). Reusa .collap pattern.
// El body interno mantiene #grid-{letra} y #gtable-{letra} hidden para
// que createMatchCard / renderGroupTableCard sigan teniendo destino.
// ─────────────────────────────────────────────────────────────────────

function _renderGruposCardShell(letra, partidosCount) {
  var grupo = (typeof GRUPOS !== 'undefined') ? GRUPOS.find(function (g) { return g.letra === letra; }) : null;
  if (!grupo) return null;
  var equipos = grupo.equipos || [];
  var done = (partidosCount && partidosCount.done != null) ? partidosCount.done : 0;
  var total = (partidosCount && partidosCount.total != null) ? partidosCount.total : 6;
  var stateClass = (done === total) ? 'is-completo' : (done > 0 ? 'is-parcial' : 'is-vacio');

  var section = document.createElement('section');
  section.className = 'fc-grupos-card collap';
  section.id = 'grupo-card-' + letra;

  var flagsHtml = equipos.slice(0, 4).map(function (teamName) {
    var team = (typeof EQUIPOS !== 'undefined') ? EQUIPOS.find(function (e) { return e.name === teamName; }) : null;
    var code = (team && team.flag) ? team.flag : (teamName || '').slice(0, 3).toUpperCase();
    var src = (team && team.flag && typeof SB !== 'undefined') ? (SB + '/flags/' + team.flag + '.png') : '';
    return '<span class="fc-grupos-card__flag" data-code="' + escapeHtml(code) + '">' +
             (src ? '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(code) + '" onerror="this.style.display=\'none\';this.parentNode.classList.add(\'is-fallback\');"/>' : '') +
             '<span class="fc-grupos-card__flag-code">' + escapeHtml(code) + '</span>' +
           '</span>';
  }).join('');

  section.innerHTML =
    '<button type="button" class="collap-toggle fc-grupos-card__toggle" aria-expanded="false">' +
      '<span class="fc-grupos-card__bar ' + stateClass + '"></span>' +
      '<span class="fc-grupos-card__title-block">' +
        '<span class="fc-grupos-card__label">GRUPO</span>' +
        '<span class="fc-grupos-card__letra">' + letra + '</span>' +
      '</span>' +
      '<span class="fc-grupos-card__flags">' + flagsHtml + '</span>' +
      '<span class="fc-grupos-card__spacer"></span>' +
      '<span class="fc-grupos-card__dice" role="button" aria-label="Simular grupo ' + letra +
        '" onclick="event.stopPropagation(); diceSimulateGroup(\'' + letra + '\');">🎲</span>' +
      '<span class="fc-grupos-card__progress ' + stateClass + '">' + done + '/' + total + '</span>' +
      '<span class="chev" aria-hidden="true">▾</span>' +
    '</button>' +
    // Source hidden: grid (tarjetas editables) + gtable (tabla clasificación).
    // El expanded se monta como SIBLING (insertAfter). El gtable se mueve al
    // slot 7 del carousel cuando se abre y se restituye al cerrar.
    '<div class="collap-body-inner fc-grupos-card__source">' +
      '<div class="cards-grid" id="grid-' + letra + '"></div>' +
      '<div id="gtable-' + letra + '" class="group-table-card"></div>' +
    '</div>';

  var btn = section.querySelector('.collap-toggle');
  btn.addEventListener('click', function (ev) {
    if (ev.target && ev.target.closest && ev.target.closest('.fc-grupos-card__dice')) return;
    if (typeof _toggleGruposExpanded === 'function') _toggleGruposExpanded(letra, section);
  });

  return section;
}

window._renderGruposCardShell = _renderGruposCardShell;

// Sprint B fix · monta el carousel expandido como SIBLING de la card del
// grupo (no anidado dentro). Replica el patrón de Fase Final donde
// .fc-elim-expanded vive como hermano del row → carousel container ~347px,
// slot 86vw (322px) cabe completo. Anidar dentro del card consumía
// 126px de margins+padding+borders → carousel solo 249px → overflow.
function _toggleGruposExpanded(letra, sectionEl) {
  if (!sectionEl) return;
  var existing = document.querySelector('.fc-grupos-expanded');
  var sameLetra = existing && existing.getAttribute('data-letra') === letra;

  // Cerrar cualquier expanded actual (también restituye su gtable a la source).
  if (existing) {
    var oldLetra = existing.getAttribute('data-letra');
    var oldSection = document.getElementById('grupo-card-' + oldLetra);
    var oldGtable = existing.querySelector('#gtable-' + oldLetra);
    if (oldGtable && oldSection) {
      var oldSource = oldSection.querySelector('.fc-grupos-card__source');
      if (oldSource) oldSource.appendChild(oldGtable);
    }
    existing.remove();
    if (oldSection) {
      oldSection.classList.remove('open');
      var oldBtn = oldSection.querySelector('.collap-toggle');
      if (oldBtn) oldBtn.setAttribute('aria-expanded', 'false');
    }
  }
  // Si era el mismo letra, ya cerramos — no abrir de nuevo.
  if (sameLetra) return;

  // Construir el expanded sibling. Refrescar la tabla (la regenerá el
  // override de renderGroupTableCard) antes de moverla al slot 7.
  if (typeof renderGroupTableCard === 'function') renderGroupTableCard(letra);

  var partidos = (typeof PARTIDOS !== 'undefined') ? PARTIDOS.filter(function (m) { return m.group === letra; }) : [];
  var gtable = sectionEl.querySelector('#gtable-' + letra);
  var carouselEl = (typeof _renderGruposCarousel === 'function') ? _renderGruposCarousel(letra, partidos, gtable) : null;
  if (!carouselEl) return;

  var expanded = document.createElement('section');
  expanded.className = 'fc-grupos-expanded';
  expanded.setAttribute('data-letra', letra);
  expanded.appendChild(carouselEl);

  // Insertar como sibling después de la card.
  if (sectionEl.parentNode) sectionEl.parentNode.insertBefore(expanded, sectionEl.nextSibling);

  // Marcar la card como abierta (chev rotation) y a11y.
  sectionEl.classList.add('open');
  var btn = sectionEl.querySelector('.collap-toggle');
  if (btn) btn.setAttribute('aria-expanded', 'true');
}

window._toggleGruposExpanded = _toggleGruposExpanded;

// ─────────────────────────────────────────────────────────────────────
// G3 · Carrusel scroll-snap (replica patrón Fase Final ui-elim-shell)
// Recibe tarjetas YA CREADAS por createMatchCard. NO las recrea —
// solo las MUEVE a slots con scroll-snap-align:center. Preserva
// listeners de attachEvents porque appendChild mueve el Element.
// ─────────────────────────────────────────────────────────────────────

// Compact preview card replicando el patrón visual de Fase Final (.ko-card).
// NO renderiza la tarjeta editable inline — esa vive en hidden #grid-{letra}
// para que openJcardModal pueda clonarla. Click compact → openJcardModal.
function _renderGruposCompactCard(match) {
  var matchKey = (typeof getMatchKey === 'function')
    ? getMatchKey(match)
    : (match.group + '_' + match.home + '_' + match.away);

  var hTeam = (typeof EQUIPOS !== 'undefined') ? EQUIPOS.find(function (e) { return e.name === match.home; }) : null;
  var aTeam = (typeof EQUIPOS !== 'undefined') ? EQUIPOS.find(function (e) { return e.name === match.away; }) : null;

  var hKit = (hTeam && typeof kitUrl === 'function') ? kitUrl(hTeam.slug, 'home') : '';
  var aKit = (aTeam && typeof kitUrl === 'function') ? kitUrl(aTeam.slug, 'away') : '';
  var hFlag = hTeam ? ((typeof SB !== 'undefined' ? SB : '') + '/flags/' + hTeam.flag + '.png') : '';
  var aFlag = aTeam ? ((typeof SB !== 'undefined' ? SB : '') + '/flags/' + aTeam.flag + '.png') : '';

  var pred = (typeof predictions !== 'undefined') ? (predictions[matchKey] || {}) : {};
  var estado = (typeof getEstadoPartido === 'function') ? getEstadoPartido(match) : 'open';

  var statusCls = 'open';
  var statusTxt = 'Pronosticar →';
  if (pred.saved) {
    statusCls = 'saved';
    if (pred.l != null && pred.v != null) statusTxt = '✓ ' + pred.l + '–' + pred.v;
    else statusTxt = '✓ Guardado';
  } else if (estado === 'closed') { statusCls = 'locked'; statusTxt = '🔒 Cerrado'; }
  else if (estado === 'live')     { statusCls = 'live';   statusTxt = '🔴 En vivo'; }
  else if (estado === 'done')     { statusCls = 'done';   statusTxt = 'Finalizado'; }

  // Truncate 14 chars sin sufijo — réplica de buildKOCard (ko.js:322).
  var hLabel = hTeam ? (match.home || '').substring(0, 14) : (match.home || '');
  var aLabel = aTeam ? (match.away || '').substring(0, 14) : (match.away || '');
  var dateLabel = (typeof fmtDate === 'function') ? fmtDate(match.date) : '';
  var timeLabel = (typeof fmtTime === 'function') ? fmtTime(match.date) : '';

  // Réplica EXACTA de buildKOCard (ko.js:251): mismas clases .ko-* + onclick directo.
  // No añadimos .fc-grupos-mini — esa clase introducía hover overrides que rompían
  // el match visual con Fase Final.
  var card = document.createElement('div');
  card.className = 'ko-card' + (pred.saved ? ' ko-saved' : '');
  card.setAttribute('data-match-key', matchKey);
  card.onclick = function () {
    if (typeof openJcardModal === 'function') openJcardModal(matchKey, { editable: true });
  };

  var hHalf = hTeam
    ? '<div class="ko-half L"><div class="ko-color" style="background:#fff"></div>' +
        '<div class="ko-kit" style="background-image:linear-gradient(to bottom, rgba(10,10,20,0.5) 0%, transparent 35%),linear-gradient(to bottom, transparent 60%, rgba(10,10,20,0.6) 100%),url(\'' + hKit + '\')"></div>' +
        '<div class="ko-vign"></div></div>'
    : '';
  var aHalf = aTeam
    ? '<div class="ko-half R"><div class="ko-color" style="background:#fff"></div>' +
        '<div class="ko-kit" style="background-image:linear-gradient(to bottom, rgba(10,10,20,0.5) 0%, transparent 35%),linear-gradient(to bottom, transparent 60%, rgba(10,10,20,0.6) 100%),url(\'' + aKit + '\')"></div>' +
        '<div class="ko-vign"></div></div>'
    : '';

  // Body section — replica espacio que dejaba el align-items:stretch del
  // carousel. Si pred saved muestra marcador grande + goleador. Si no,
  // CTA "Pronostica este partido →". Solo visible en .fc-grupos-carousel
  // (CSS scope), Fase Final no lo renderiza ni lo necesita.
  var bodyHtml;
  if (pred.saved && pred.l != null && pred.v != null) {
    var golLabel = '';
    if (pred.gol) {
      var golTeam = pred.gol.startsWith && pred.gol.indexOf('-') > 0 ? pred.gol.split('-')[0] : '';
      var golName = pred.gol.indexOf('-') > 0 ? pred.gol.split('-').slice(1).join('-') : pred.gol;
      golLabel = '<span class="ko-body__gol">⚽ ' + escapeHtml(golName.replace(/_/g, ' ')) + '</span>';
    }
    bodyHtml =
      '<div class="ko-body ko-body--saved">' +
        '<span class="ko-body__label">TU PRONÓSTICO</span>' +
        '<span class="ko-body__score">' + pred.l + ' <span class="ko-body__sep">–</span> ' + pred.v + '</span>' +
        golLabel +
      '</div>';
  } else {
    bodyHtml =
      '<div class="ko-body ko-body--empty">' +
        '<span class="ko-body__cta">⚡ Toca para pronosticar</span>' +
      '</div>';
  }

  card.innerHTML =
    '<div class="ko-hero">' +
      hHalf + aHalf +
      '<div class="ko-fade"></div>' +
      '<div class="ko-team home">' +
        '<div class="ko-flag">' + (hTeam ? '<img src="' + hFlag + '" alt="" onerror="this.remove()"/>' : '❓') + '</div>' +
        '<div class="ko-tname' + (!hTeam ? ' tbd' : '') + '">' + escapeHtml(hLabel) + '</div>' +
        '<div class="ko-trole">local</div>' +
      '</div>' +
      '<div class="ko-team away">' +
        '<div class="ko-flag">' + (aTeam ? '<img src="' + aFlag + '" alt="" onerror="this.remove()"/>' : '❓') + '</div>' +
        '<div class="ko-tname' + (!aTeam ? ' tbd' : '') + '">' + escapeHtml(aLabel) + '</div>' +
        '<div class="ko-trole">visitante</div>' +
      '</div>' +
      '<div class="ko-center">' +
        '<div class="ko-vs-circle"><div class="ko-ball-bg"></div><span class="ko-vs-text">VS</span></div>' +
        '<div class="ko-pill">' + escapeHtml(match.venue || ('Grupo ' + match.group)) + '</div>' +
        '<div style="font-size:8px;font-weight:600;color:rgba(255,255,255,.5);margin-top:3px;text-align:center;letter-spacing:.04em">' + escapeHtml(timeLabel) + '</div>' +
      '</div>' +
    '</div>' +
    bodyHtml +
    '<div class="ko-ia-hint" style="display:none"></div>' +
    '<div class="ko-footer">' +
      '<span class="ko-date">' + escapeHtml(dateLabel) + '</span>' +
      '<span class="ko-status ' + statusCls + '">' + escapeHtml(statusTxt) + '</span>' +
    '</div>';

  return card;
}

window._renderGruposCompactCard = _renderGruposCompactCard;

// Refresca el header progress N/6 + state class de la card colapsable de un
// grupo. Helper compartido entre el listener jcard:updated (close del modal
// editable) y los flujos de simulación masiva en admin.js que NO pasan por
// el modal (diceSimulateGroup, diceSimulateAllGroups). Disparar el evento
// jcard:updated por cada partido en una simulación masiva sería 72×
// re-renders de compact card + letterbar + tabla; este helper permite hacer
// un refresh batch de O(grupos) en vez de O(partidos).
function _refreshGrupoCardHeader(letra) {
  if (!letra) return;
  var cardSection = document.getElementById('grupo-card-' + letra);
  if (!cardSection) return;
  var partidos = (typeof PARTIDOS !== 'undefined') ? PARTIDOS.filter(function (m) { return m.group === letra; }) : [];
  var done = partidos.filter(function (m) {
    var p = (typeof predictions !== 'undefined') ? predictions[(typeof getMatchKey === 'function') ? getMatchKey(m) : null] : null;
    return p && p.l != null && p.v != null;
  }).length;
  var total = partidos.length;
  var stateClass = (done === total && total > 0) ? 'is-completo' : (done > 0 ? 'is-parcial' : 'is-vacio');
  var bar = cardSection.querySelector('.fc-grupos-card__bar');
  if (bar) {
    bar.classList.remove('is-completo', 'is-parcial', 'is-vacio');
    bar.classList.add(stateClass);
  }
  var prog = cardSection.querySelector('.fc-grupos-card__progress');
  if (prog) {
    prog.classList.remove('is-completo', 'is-parcial', 'is-vacio');
    prog.classList.add(stateClass);
    prog.textContent = done + '/' + total;
  }
}
window._refreshGrupoCardHeader = _refreshGrupoCardHeader;

// Sprint B fix · al cerrar el modal editable, refrescar:
//   1) compact card preview en el carrusel (estado/marcador del chip),
//   2) chip count del letterbar (N/6),
//   3) tabla clasificación del grupo afectado.
// Listener registrado UNA vez (guard con flag en window).
if (!window._jcardUpdatedListenerRegistered) {
  window._jcardUpdatedListenerRegistered = true;
  document.addEventListener('jcard:updated', function (ev) {
    var mk = ev && ev.detail && ev.detail.matchKey;
    if (!mk) return;
    var match = (typeof PARTIDOS !== 'undefined') ? PARTIDOS.find(function (m) {
      return (typeof getMatchKey === 'function') ? getMatchKey(m) === mk : false;
    }) : null;
    if (!match) return;
    // 1) Compact preview — selector corregido tras commit 98f4550 que
    // dropeó la clase .fc-grupos-mini. Ahora el data-match-key vive en
    // .ko-card directo. Scope a .fc-grupos-carousel para evitar matching
    // accidental con KO cards de Fase Final si compartieran attr.
    var existing = document.querySelector('.fc-grupos-carousel .ko-card[data-match-key="' + mk + '"]');
    if (existing && typeof _renderGruposCompactCard === 'function') {
      var fresh = _renderGruposCompactCard(match);
      if (fresh) existing.replaceWith(fresh);
    }
    // 2) Letterbar chip count
    if (typeof _refreshGruposLetterBar === 'function') _refreshGruposLetterBar();
    // 3) Standings table del grupo
    if (typeof renderGroupTableCard === 'function' && match.group) {
      renderGroupTableCard(match.group);
    }
    // 4) Header progress N/6 + state class del card colapsable
    _refreshGrupoCardHeader(match.group);
  });
}

function _renderGruposCarousel(letra, matches, gtableEl) {
  var wrap = document.createElement('div');
  wrap.className = 'fc-grupos-carousel-wrap';

  var carousel = document.createElement('div');
  carousel.className = 'fc-grupos-carousel';
  carousel.setAttribute('role', 'region');
  carousel.setAttribute('aria-label', 'Partidos del grupo ' + letra);

  // 6 match slots — compact preview cards (estilo Fase Final). Click → openJcardModal.
  // Las tarjetas editables siguen viviendo en hidden #grid-{letra} para que el
  // modal pueda clonarlas via cardEl = document.getElementById('card-wrap-{matchKey}').
  for (var i = 0; i < matches.length && i < 6; i++) {
    var slot = document.createElement('div');
    slot.className = 'fc-grupos-slot fc-grupos-slot--match';
    slot.setAttribute('data-slot-idx', String(i));
    var compact = _renderGruposCompactCard(matches[i]);
    if (compact) slot.appendChild(compact);
    carousel.appendChild(slot);
  }

  // Slot 7: standings (mover gtable Element — id preservado para refreshGroupTables)
  if (gtableEl) {
    var sslot = document.createElement('div');
    sslot.className = 'fc-grupos-slot fc-grupos-slot--standings';
    sslot.setAttribute('data-slot-idx', '6');
    sslot.appendChild(gtableEl);
    carousel.appendChild(sslot);
  }

  wrap.appendChild(carousel);

  // Dots indicator
  var dotsEl = document.createElement('div');
  dotsEl.className = 'fc-grupos-carousel__dots';
  dotsEl.setAttribute('data-letra', letra);
  var slotCount = (matches ? Math.min(matches.length, 6) : 0) + (gtableEl ? 1 : 0);
  for (var j = 0; j < slotCount; j++) {
    var dot = document.createElement('button');
    dot.type = 'button';
    dot.className = 'fc-grupos-carousel__dot' + (j === 0 ? ' is-active' : '');
    dot.setAttribute('data-dot-idx', String(j));
    dot.setAttribute('aria-label', 'Slot ' + (j + 1));
    dotsEl.appendChild(dot);
  }
  wrap.appendChild(dotsEl);

  // Arrows (desktop only via CSS)
  var prev = document.createElement('button');
  prev.type = 'button';
  prev.className = 'fc-grupos-carousel__arrow fc-grupos-carousel__arrow--prev';
  prev.setAttribute('aria-label', 'Anterior');
  prev.textContent = '‹';
  var next = document.createElement('button');
  next.type = 'button';
  next.className = 'fc-grupos-carousel__arrow fc-grupos-carousel__arrow--next';
  next.setAttribute('aria-label', 'Siguiente');
  next.textContent = '›';
  wrap.appendChild(prev);
  wrap.appendChild(next);

  function getSlotWidth() {
    var first = carousel.querySelector('.fc-grupos-slot');
    return first ? first.getBoundingClientRect().width + 12 : 1;
  }
  function setActiveDot(idx) {
    var dots = dotsEl.querySelectorAll('.fc-grupos-carousel__dot');
    for (var k = 0; k < dots.length; k++) {
      dots[k].classList.toggle('is-active', k === idx);
    }
    // Réplica patrón Fase Final: slot actual sin scale/opacity, los demás
    // con scale(.92) + opacity .55 (regla CSS .fc-grupos-slot:not(.is-current)).
    var slots = carousel.querySelectorAll('.fc-grupos-slot');
    for (var s = 0; s < slots.length; s++) {
      slots[s].classList.toggle('is-current', s === idx);
    }
  }
  function scrollToSlot(idx) {
    var slots = carousel.querySelectorAll('.fc-grupos-slot');
    var slot = slots[idx];
    if (slot) slot.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }
  // Marcar el primer slot como current al montar.
  var initialSlots = carousel.querySelectorAll('.fc-grupos-slot');
  if (initialSlots[0]) initialSlots[0].classList.add('is-current');

  var rafPending = false;
  carousel.addEventListener('scroll', function () {
    if (rafPending) return;
    rafPending = true;
    requestAnimationFrame(function () {
      rafPending = false;
      var sw = getSlotWidth();
      var idx = Math.round(carousel.scrollLeft / sw);
      setActiveDot(Math.max(0, Math.min(slotCount - 1, idx)));
    });
  });
  dotsEl.addEventListener('click', function (ev) {
    var btn = ev.target.closest('.fc-grupos-carousel__dot');
    if (!btn) return;
    var idx = Number(btn.getAttribute('data-dot-idx'));
    scrollToSlot(idx);
  });
  prev.addEventListener('click', function () {
    var sw = getSlotWidth();
    var cur = Math.round(carousel.scrollLeft / sw);
    scrollToSlot(Math.max(0, cur - 1));
  });
  next.addEventListener('click', function () {
    var sw = getSlotWidth();
    var cur = Math.round(carousel.scrollLeft / sw);
    scrollToSlot(Math.min(slotCount - 1, cur + 1));
  });

  return wrap;
}

window._renderGruposCarousel = _renderGruposCarousel;

// ─────────────────────────────────────────────────────────────────────
// G4 · Slot 7 tabla clasificación restilada. Reusa calcGroupTableAdvanced
// (scoring.js:234) — NO reinventa el cálculo, solo restila el output.
// Override de renderGroupTableCard (cargado desde scoring.js:268) — esta
// definición gana porque ui-groups.js carga DESPUÉS (main-entry.js:57-58).
// Mantiene el contrato: pinta dentro de #gtable-{letra} para que
// refreshGroupTables siga funcionando.
// ─────────────────────────────────────────────────────────────────────

function _renderGruposStandings(letra) {
  if (typeof calcGroupTableAdvanced !== 'function') return null;
  var rows = calcGroupTableAdvanced(letra) || [];
  // FX-01: el verde de clasificación solo con resultados reales. La tabla se
  // deriva de predictions (calcGroupTableAdvanced lee predictions[key]); sin
  // pipeline de resultados reales el realce de "clasificado" sería engañoso.
  // Sentinel realHome/realAway igual que el board v3 (0-0 = placeholder).
  var _hasRealLeg = (typeof PARTIDOS !== 'undefined') && PARTIDOS.some(function (m) {
    return m.group === letra && m.realHome != null && m.realAway != null && !(m.realHome === 0 && m.realAway === 0);
  });
  var rowsHtml = rows.slice(0, 4).map(function (t, idx) {
    var team = (typeof EQUIPOS !== 'undefined') ? EQUIPOS.find(function (e) { return e.name === t.name || e.slug === t.slug; }) : null;
    var code = (team && team.flag) ? team.flag : (t.name || '').slice(0, 3).toUpperCase();
    var src = (team && team.flag && typeof SB !== 'undefined') ? (SB + '/flags/' + team.flag + '.png') : '';
    var qualifClass = (_hasRealLeg && idx < 2) ? ' fc-grupos-standings__row--qualif' : '';
    var gd = t.gd != null ? t.gd : ((t.gf || 0) - (t.gc || 0));
    var gdLabel = gd > 0 ? '+' + gd : String(gd);
    return (
      '<div class="fc-grupos-standings__row' + qualifClass + '" role="row">' +
        '<span class="fc-grupos-standings__pos">' + (idx + 1) + '</span>' +
        '<span class="fc-grupos-standings__flag">' +
          (src ? '<img src="' + escapeHtml(src) + '" alt="' + escapeHtml(code) + '" onerror="this.style.display=\'none\';this.parentNode.classList.add(\'is-fallback\');"/>' : '') +
          '<span class="fc-grupos-standings__flag-code">' + escapeHtml(code) + '</span>' +
        '</span>' +
        '<span class="fc-grupos-standings__name">' + escapeHtml(t.name || '') + '</span>' +
        '<span class="fc-grupos-standings__pj">' + (t.pj || 0) + '</span>' +
        '<span class="fc-grupos-standings__gd">' + gdLabel + '</span>' +
        '<span class="fc-grupos-standings__pts">' + (t.pts || 0) + '</span>' +
      '</div>'
    );
  }).join('');

  var headerHtml =
    '<div class="fc-grupos-standings__head" role="row">' +
      '<span class="fc-grupos-standings__pos">#</span>' +
      '<span class="fc-grupos-standings__flag"></span>' +
      '<span class="fc-grupos-standings__name">EQUIPO</span>' +
      '<span class="fc-grupos-standings__pj">PJ</span>' +
      '<span class="fc-grupos-standings__gd">GD</span>' +
      '<span class="fc-grupos-standings__pts">PTS</span>' +
    '</div>';

  var card = document.createElement('div');
  card.className = 'fc-grupos-standings';
  card.innerHTML =
    '<h3 class="fc-grupos-standings__title">CLASIFICACIÓN GRUPO ' + letra + '</h3>' +
    '<div class="fc-grupos-standings__table" role="table">' +
      headerHtml +
      rowsHtml +
    '</div>' +
    '<div class="fc-grupos-standings__footer">Top 2 → 1/16 · 8 mejores 3os clasifican</div>';

  return card;
}

window._renderGruposStandings = _renderGruposStandings;

// Override renderGroupTableCard — wins over scoring.js:268 by load order.
// Conserva el contrato: pinta en #gtable-{letra} para que refreshGroupTables
// + diceSimulateGroup + savePredictions sigan funcionando.
function renderGroupTableCard(letra) {
  var gtable = document.getElementById('gtable-' + letra);
  if (!gtable) return;
  gtable.innerHTML = '';
  var card = window._renderGruposStandings && window._renderGruposStandings(letra);
  if (card) gtable.appendChild(card);
}

window.renderGroupTableCard = renderGroupTableCard;
