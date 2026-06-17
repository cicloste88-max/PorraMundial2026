// ui-directo.js — Porra Mundial 2026
// Vista "Directo": marcadores en tiempo real por jornada/día.
// Clonada de Vista Jornada (renderVistaJornada / _buildJCard).
//
// Usa: PARTIDOS, EQUIPOS, predictions, getMatchKey, SB, calcMatchPoints,
//      iaPredictions, boostPicks (todos globals de data.js/scoring.js)
// Lee: window._liveScoresByMatchKey (poblado por live-sync.js — Map de match_key → row)
// Expone: window.renderVistaDirecto, window.updateDirectoCard
//
// El flujo de realtime vive en live-sync.js. Este módulo solo renderiza
// y expone updateDirectoCard(matchKey, liveRow) para que live-sync lo llame
// en cada cambio sin recrear toda la vista.

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // Estado
  // ─────────────────────────────────────────────────────────────
  // liveByMatchKey: cache local de live_scores indexado por match_key (del Mundial)
  // lo puebla live-sync.js al cargar
  window._liveScoresByMatchKey = window._liveScoresByMatchKey || {};

  // ─────────────────────────────────────────────────────────────
  // Mapping ISO3 → ISO2 alineado con bucket miniatures/flags-sm/<ISO2>.webp.
  // 48 entradas, una por equipo del Mundial 2026.
  // Notas custom (no estándar ISO): ENG→EN (Inglaterra), SCO→SC (Escocia).
  // Usado por _buildDMini y _buildDExpanded para inyectar --flag-rect-url.
  // ─────────────────────────────────────────────────────────────
  const ISO3_TO_ISO2 = {
    MEX:'MX', RSA:'ZA', KOR:'KR', CZE:'CZ', CAN:'CA', BIH:'BA', QAT:'QA', SUI:'CH',
    BRA:'BR', MAR:'MA', HAI:'HT', SCO:'SC', USA:'US', PAR:'PY', AUS:'AU', TUR:'TR',
    GER:'DE', CUW:'CW', CIV:'CI', ECU:'EC', NED:'NL', JPN:'JP', SWE:'SE', TUN:'TN',
    BEL:'BE', EGY:'EG', IRN:'IR', NZL:'NZ', ESP:'ES', CPV:'CV', KSA:'SA', URU:'UY',
    FRA:'FR', SEN:'SN', IRQ:'IQ', NOR:'NO', ARG:'AR', ALG:'DZ', AUT:'AT', JOR:'JO',
    POR:'PT', COD:'CD', UZB:'UZ', COL:'CO', ENG:'EN', CRO:'HR', GHA:'GH', PAN:'PA'
  };

  // ─────────────────────────────────────────────────────────────
  // Admin flag (cache) — para mostrar la sección "Simulacros"
  // window._isAdminCached: undefined/null = no comprobado, true/false = resultado
  //
  // Problema histórico: tras un refresh, ui-directo.js corre antes de que
  // auth.js haya rehidratado la sesión, así que _porraDb.auth.getUser() devuelve
  // null y el cache se quedaba cerrado como `false` para siempre. Ahora:
  //  - Si db o user no están listos, NO cacheamos; reintentamos hasta 10 veces
  //    (cada 500 ms ⇒ 5 s máx).
  //  - Al completar con valor definitivo, si cambia respecto al último render,
  //    disparamos renderVistaDirecto() para que la sección simulacros aparezca.
  // ─────────────────────────────────────────────────────────────
  let _checkInProgress = false;
  let _checkAttempts = 0;
  const _MAX_CHECK_ATTEMPTS = 10;
  let _lastRenderAdminValue; // snapshot de _isAdminCached usado en el último render

  function _triggerReRenderIfChanged() {
    if (_lastRenderAdminValue === window._isAdminCached) return;
    _lastRenderAdminValue = window._isAdminCached;
    const container = document.getElementById('directo-container');
    if (container && container.style.display !== 'none' &&
        typeof window.renderVistaDirecto === 'function') {
      window.renderVistaDirecto();
    }
  }

  function _scheduleCheckRetry() {
    _checkAttempts++;
    if (_checkAttempts >= _MAX_CHECK_ATTEMPTS) {
      window._isAdminCached = false;
      _triggerReRenderIfChanged();
      return;
    }
    setTimeout(() => { checkIsAdmin(); }, 500);
  }

  async function checkIsAdmin() {
    if (window._isAdminCached === true || window._isAdminCached === false) {
      return window._isAdminCached;
    }
    if (_checkInProgress) return undefined;
    _checkInProgress = true;
    try {
      const db = window._porraDb;
      if (!db) {
        _scheduleCheckRetry();
        return undefined;
      }
      const { data: { user } } = await db.auth.getUser();
      if (!user) {
        _scheduleCheckRetry();
        return undefined;
      }
      const { data: profileData, error } = await db
        .from('profiles')
        .select('is_admin')
        .eq('id', user.id)
        .single();
      if (error) {
        console.warn('[ui-directo] checkIsAdmin: error leyendo profile:', error);
        window._isAdminCached = false;
        _triggerReRenderIfChanged();
        return false;
      }
      window._isAdminCached = !!(profileData && profileData.is_admin);
      _triggerReRenderIfChanged();
      return window._isAdminCached;
    } catch (err) {
      console.warn('[ui-directo] checkIsAdmin: excepción:', err);
      _scheduleCheckRetry();
      return undefined;
    } finally {
      _checkInProgress = false;
    }
  }

  // match_key suele ser alfanumérico + underscores, pero sanitizamos por seguridad
  function sanitizeMatchKey(k) {
    return String(k || '').replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  // Hora local (Europe/Madrid) + día/mes desde match_start_ts (BIGINT en BD).
  // Acepta segundos (10 dígitos) o milisegundos (13) — detecta por magnitud.
  function formatStartCEST(ts) {
    if (ts == null) return '';
    const num = Number(ts);
    if (!Number.isFinite(num) || num <= 0) return '';
    const ms = num > 1e12 ? num : num * 1000;
    const d = new Date(ms);
    try {
      return new Intl.DateTimeFormat('es-ES', {
        timeZone: 'Europe/Madrid',
        day: 'numeric', month: 'short',
        hour: '2-digit', minute: '2-digit'
      }).format(d);
    } catch {
      return d.toLocaleString('es-ES');
    }
  }

  // Epoch ms del kickoff canónico desde live_scores.match_start_ts.
  // m.date (PARTIDOS, data.js legacy) lleva hora de sede SIN timezone y NO
  // sirve para formatear horas reales. Misma detección seg/ms que formatStartCEST.
  // liveRow puede ser la row normalizada de live-sync (match_start_ts a primer
  // nivel desde ERR-87, con la row de BD en .raw) o una row cruda (simulacros).
  function _kickoffMs(liveRow) {
    if (!liveRow) return null;
    let ts = liveRow.match_start_ts;
    if (ts == null && liveRow.raw) ts = liveRow.raw.match_start_ts;
    if (ts == null) return null;
    const num = Number(ts);
    if (!Number.isFinite(num) || num <= 0) return null;
    return num > 1e12 ? num : num * 1000;
  }

  // N1 post-J1 — umbral "inminente" para la prioridad (a-bis) de la jornada
  // en curso: kickoff REAL vencido o a ≤6h. Cubre el hueco medianoche→último
  // slot de madrugada (04:00 Madrid) sin adelantar jornadas de tarde.
  const _KICKOFF_INMINENTE_MS = 6 * 60 * 60 * 1000;

  // Jornada en curso, por prioridad: (a) primera con partido live →
  // (a-bis) primera con pendiente de kickoff real vencido/inminente →
  // (b) hoy en Europe/Madrid → (c) primera futura → (d) última si todo pasado.
  // Pura (accessors inyectados) para testearla con escenarios de madrugada.
  function _pickJornadaEnCurso(dias, opts) {
    let idx = dias.findIndex(d => opts.liveCountOf(d) > 0);
    if (idx === -1) idx = dias.findIndex(d => opts.hasPendingImminent(d));
    if (idx === -1) idx = dias.indexOf(opts.todayMadrid);
    if (idx === -1) idx = dias.findIndex(d => d > opts.todayMadrid);
    if (idx === -1) idx = dias.length - 1;
    return idx;
  }

  // Solo-hora en Europe/Madrid, 24h (para fecha+hora usar formatStartCEST).
  function _formatHoraMadrid(ms) {
    const d = new Date(ms);
    try {
      return new Intl.DateTimeFormat('es-ES', {
        timeZone: 'Europe/Madrid',
        hour: '2-digit', minute: '2-digit', hourCycle: 'h23'
      }).format(d);
    } catch {
      return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }
  }

  // Fecha YYYY-MM-DD en Europe/Madrid (en-CA emite formato ISO). Usada para
  // el sufijo +1 de kickoffs de madrugada y para elegir la jornada en curso.
  // NO se usa para agrupar: la jornada canónica sigue siendo m.date (sede).
  function _madridDateStr(ms) {
    const d = new Date(ms);
    try {
      return new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Madrid',
        year: 'numeric', month: '2-digit', day: '2-digit'
      }).format(d);
    } catch {
      return d.toISOString().substring(0, 10);
    }
  }

  // Hora de kickoff para UI (mini-row Y card expandida, misma etiqueta):
  // hora Madrid desde el ts canónico de live_scores, con sufijo ' +1' si en
  // Madrid cae en el día siguiente al día canónico de la sección (madrugadas).
  // m.date (hora de sede, sin TZ) queda solo como fallback para no dejar la
  // vista sin hora.
  function _kickoffHoraLabel(ctx, m) {
    const koMs = _kickoffMs(ctx.liveRow);
    if (koMs == null) {
      return new Date(m.date).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    }
    let hora = _formatHoraMadrid(koMs);
    const canonDate = m.date ? m.date.substring(0, 10) : '';
    if (canonDate && _madridDateStr(koMs) > canonDate) hora += ' +1';
    return hora;
  }

  // ─────────────────────────────────────────────────────────────
  // F7.4-D-1: setVistaGruposExtended eliminado. El toggle entre pages
  // grupos/jornada/directo lo gobierna showPage desde el bottom-tab.
  // ─────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────
  // Separador del marcador = balón Trionda (ITEM C, PR #156).
  // SOLO en la card expandida: en mini-rows el balón se solapaba con
  // los '—' placeholder (QA San 11-jun) y la mini conserva el ':'.
  // Mismo asset que la timeline del Predictor (TRIONDA_URL en
  // ui-pred-shell.js; CSS legacy ballSpin en base.css/.vs-ball).
  // Estructura: wrapper .dv2-score-ball (oscilación translateY) + img
  // interna (rotación) — estilos y reduced-motion en directo-v3.css.
  // El wrapper CONSERVA la clase -sep legacy: si la img falla, onerror
  // degrada a ':' con el estilo del separador de siempre.
  // ─────────────────────────────────────────────────────────────
  var TRIONDA_URL = 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/Ball/Trionda-official-ball.png';
  function _buildScoreBall(sepClass) {
    return '<span class="' + sepClass + ' dv2-score-ball" aria-hidden="true">' +
      '<img src="' + TRIONDA_URL + '" alt="" loading="lazy" ' +
      'onerror="this.parentNode.classList.add(\'is-fallback\');this.parentNode.textContent=\':\'">' +
    '</span>';
  }

  // ─────────────────────────────────────────────────────────────
  // Traducción status → etiqueta y clase
  // ─────────────────────────────────────────────────────────────
  function statusLabel(status) {
    switch (status) {
      case 'inprogress':  return { txt: 'EN VIVO',    cls: 'live' };
      case 'halftime':    return { txt: 'DESCANSO',   cls: 'halftime' };
      case 'overtime':    return { txt: 'PRÓRROGA',   cls: 'overtime' };
      case 'penalties':   return { txt: 'PENALTIS',   cls: 'penalties' };
      case 'finished':    return { txt: 'FINAL',      cls: 'final' };
      case 'notstarted':  return { txt: 'PRÓXIMO',    cls: 'notstarted' };
      default:            return { txt: (status || '').toUpperCase(), cls: 'notstarted' };
    }
  }

  // ─────────────────────────────────────────────────────────────
  // Filtrar eventos de SofaScore → solo goles y rojas
  // ─────────────────────────────────────────────────────────────
  function extractRelevantEvents(rawEvents, teamsSwapped, homeTeamName, awayTeamName) {
    if (!Array.isArray(rawEvents)) return [];
    const out = [];
    for (const e of rawEvents) {
      if (!e) continue;

      const isGoal =
        e.incidentType === 'goal' ||
        (e.incidentType === 'inGamePenalty'    && e.incidentClass === 'scored') ||
        (e.incidentType === 'penaltyShootout'  && e.incidentClass === 'scored');

      const isRedCard =
        e.incidentType === 'card' &&
        (e.incidentClass === 'red' || e.incidentClass === 'yellowRed');

      if (!isGoal && !isRedCard) continue;

      // Determinar a qué equipo pertenece (desde perspectiva de data.js)
      // Si teams_swapped, invertir home/away
      let isForHome = !!e.isHome;
      if (teamsSwapped) isForHome = !isForHome;
      const team = isForHome ? homeTeamName : awayTeamName;

      const player = e?.player?.name || e?.playerName || 'Desconocido';
      const minute = e.time ?? e.incidentTime ?? '?';

      if (isGoal) {
        const isOwnGoal  = e.incidentClass === 'ownGoal';
        const isPenalty  = e.incidentType === 'inGamePenalty';
        const isShootout = e.incidentType === 'penaltyShootout';
        let extra = '';
        if (isOwnGoal)  extra = 'p.p.';
        else if (isPenalty)  extra = 'pen.';
        else if (isShootout) extra = 'tanda pen.';
        out.push({
          kind: isOwnGoal ? 'own-goal' : 'goal',
          icon: '⚽',
          minute,
          player,
          team,
          extra
        });
      } else if (isRedCard) {
        out.push({
          kind: 'red-card',
          icon: '🟥',
          minute,
          player,
          team,
          extra: e.incidentClass === 'yellowRed' ? 'doble amarilla' : ''
        });
      }
    }
    // Ordenar por minuto
    out.sort((a, b) => {
      const ma = typeof a.minute === 'number' ? a.minute : 999;
      const mb = typeof b.minute === 'number' ? b.minute : 999;
      return ma - mb;
    });
    return out;
  }

  // ─────────────────────────────────────────────────────────────
  // Resolver el match_key desde un partido de PARTIDOS
  // Delega en window.matchKeyFor (expuesto por live-sync.js)
  // ─────────────────────────────────────────────────────────────
  function getDirectoKey(m) {
    if (typeof window.matchKeyFor === 'function') return window.matchKeyFor(m);
    return null;
  }

  // ─────────────────────────────────────────────────────────────
  // Construir una tarjeta Directo
  // ─────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────
  // Helper: extrae el contexto live de un partido del Mundial.
  //   { directoKey, liveRow, status, isLive, isFinal, scoreH, scoreA,
  //     events, hasScore, minuteStr, matchKey, pred, hasPred }
  // ─────────────────────────────────────────────────────────────
  function _getMatchCtx(m) {
    const directoKey = getDirectoKey(m);
    const liveRow = directoKey ? (window._liveScoresByMatchKey[directoKey] || null) : null;

    let scoreH = null, scoreA = null, status = 'notstarted', events = [];
    let teamsSwapped = false;
    if (liveRow) {
      status = liveRow.status || 'notstarted';
      teamsSwapped = !!liveRow._teams_swapped;
      scoreH = liveRow.score_home;
      scoreA = liveRow.score_away;
      events = extractRelevantEvents(liveRow.events, teamsSwapped, m.home, m.away);
    }

    const hasScore = scoreH != null && scoreA != null;
    const isLive   = status === 'inprogress' || status === 'halftime' ||
                     status === 'overtime'   || status === 'penalties';
    const isFinal  = status === 'finished';

    let minuteStr = '';
    if (isLive && liveRow) {
      if (status === 'inprogress' && liveRow.minute != null) minuteStr = liveRow.minute + "'";
      else if (status === 'halftime') minuteStr = 'DESCANSO';
    }

    const matchKey = (typeof getMatchKey === 'function') ? getMatchKey(m) : null;
    const pred = matchKey ? (predictions[matchKey] || {}) : {};
    const hasPred = pred.l !== null && pred.l !== undefined &&
                    pred.v !== null && pred.v !== undefined;

    return { directoKey, liveRow, status, isLive, isFinal, scoreH, scoreA,
             events, hasScore, minuteStr, matchKey, pred, hasPred, teamsSwapped };
  }

  // ─────────────────────────────────────────────────────────────
  // Calcula puntos vivos del usuario para un partido.
  // Devuelve { pts, isExact, isBoost, finalPts } o null si no aplica.
  // ─────────────────────────────────────────────────────────────
  function _getLivePts(ctx, m) {
    if (!ctx.hasPred || !ctx.hasScore || !(ctx.isLive || ctx.isFinal)) return null;
    if (typeof calcMatchPoints !== 'function') return null;
    const predWithFlag = Object.assign({}, ctx.pred, { saved: ctx.pred.saved !== false });
    const realScorers = _realScorersFor(ctx, m);
    const pts = calcMatchPoints(predWithFlag, ctx.scoreH, ctx.scoreA, ctx.matchKey, realScorers);
    const bpSource = (typeof boostPicks !== 'undefined') ? boostPicks : {};
    const boostKey = bpSource[m.date?.substring(0, 10)];
    const isBoost  = boostKey === ctx.matchKey;
    const isExact  = ctx.pred.l === ctx.scoreH && ctx.pred.v === ctx.scoreA;
    // R3 (regla canónica San 12-jun): el ×2 SOLO con exacto Y goleador a la
    // vez — calcMatchPoints ya lo aplica internamente; aquí se replica la
    // condición SOLO para el sufijo "(boost ×2)" del copy.
    const golOk = ctx.pred.gol
      ? (Array.isArray(realScorers) && realScorers.indexOf(ctx.pred.gol) !== -1)
      : (ctx.pred.l === 0 && ctx.pred.v === 0 && ctx.scoreH === 0 && ctx.scoreA === 0);
    return { pts, isExact, isBoost, isDoubled: isBoost && isExact && golOk, finalPts: pts };
  }

  // ─────────────────────────────────────────────────────────────
  // Goleadores reales para el +2 (Item 3+5 post-J1). Sin 5º argumento,
  // calcMatchPoints caía a _hf09FallbackScorers (primer jugador de plantilla
  // del ganador) y el +2 de goleador no se concedía nunca en Directo.
  //   - finished: scorers canónicos del bridge (results.match_results, key
  //     legacy == ctx.matchKey), cargados por live-sync en
  //     window._matchResultsByKey.
  //   - en vivo (o finished aún sin bridge): derivados de los events crudos
  //     de live_scores vía deriveScorersFromEvents (scoring.js, espejo del
  //     extractScorers del bridge). [] = aún sin goles (NO usar fallback).
  // ─────────────────────────────────────────────────────────────
  function _realScorersFor(ctx, m) {
    if (ctx.isFinal && ctx.matchKey && window._matchResultsByKey) {
      const entry = window._matchResultsByKey[ctx.matchKey];
      if (entry && Array.isArray(entry.scorers)) return entry.scorers;
    }
    if (typeof deriveScorersFromEvents !== 'function' || !ctx.liveRow) return undefined;
    const hIso3 = (EQUIPOS.find(e => e.name === m.home) || {}).flag || null;
    const aIso3 = (EQUIPOS.find(e => e.name === m.away) || {}).flag || null;
    return deriveScorersFromEvents(ctx.liveRow.events, ctx.teamsSwapped, hIso3, aIso3);
  }

  // ─────────────────────────────────────────────────────────────
  // _buildDMini — fila compacta clickable (estado base de Directo).
  // REDISEÑO dvm (marcador contraído FIFA). Pixel-exact con la captura.
  // D1=A: sin columna de estado. Sin resultado → "—" "—".
  // Hooks conservados: outer .dvm (role/tabindex/id/data-match-key/
  // data-match-idx) + banderas .dv2-mini-flag-btn[data-iso3].
  // ─────────────────────────────────────────────────────────────
  function _buildDMini(m, idx) {
    const ctx = _getMatchCtx(m);
    const hTeam = EQUIPOS.find(e => e.name === m.home);
    const aTeam = EQUIPOS.find(e => e.name === m.away);

    const hCode = hTeam ? hTeam.flag : (m.home || '').substring(0, 3).toUpperCase();
    const aCode = aTeam ? aTeam.flag : (m.away || '').substring(0, 3).toUpperCase();

    // Bandera rectangular: bucket miniatures/flags-sm/<ISO2>.webp (sistema PR#93).
    // Fallback a /flags/<ISO3>.png si falta ISO2; onerror oculta el <img>.
    const hIso2 = hTeam && ISO3_TO_ISO2[hTeam.flag];
    const aIso2 = aTeam && ISO3_TO_ISO2[aTeam.flag];
    const hSrc = hIso2 ? (SB + '/miniatures/flags-sm/' + hIso2 + '.webp')
                       : (hTeam ? (SB + '/flags/' + hTeam.flag + '.png') : '');
    const aSrc = aIso2 ? (SB + '/miniatures/flags-sm/' + aIso2 + '.webp')
                       : (aTeam ? (SB + '/flags/' + aTeam.flag + '.png') : '');

    const lTxt = ctx.hasScore ? String(ctx.scoreH) : '—';
    const vTxt = ctx.hasScore ? String(ctx.scoreA) : '—';

    const TROPHY = SB + '/miniatures/Logos/2026_FIFA_World_Cup.png';

    const flagImg = (src) => src
      ? '<img src="' + src + '" loading="lazy" onerror="this.style.display=\'none\'">'
      : '';

    // Mismo markup en ambos lados; el espejado del lado derecho lo hace el CSS
    // (.dvm__side.is-right { flex-direction: row-reverse }).
    const side = (cls, code, src, teamName, dotCls) =>
      '<div class="dvm__side ' + cls + '">' +
        '<div class="dvm__id">' +
          '<button type="button" class="dvm__flag dv2-mini-flag-btn" data-iso3="' + code + '" ' +
            'aria-label="Ver plantilla ' + (teamName || '') + '">' + flagImg(src) + '</button>' +
          '<span class="dvm__dot ' + dotCls + '"></span>' +
        '</div>' +
        '<span class="dvm__code">' + code + '</span>' +
      '</div>';

    return (
      '<div class="dvm" role="button" tabindex="0" id="dcard-' + idx + '" ' +
        'data-match-key="' + (ctx.directoKey || '') + '" data-match-idx="' + idx + '">' +
        '<div class="dvm__bar">' +
          side('is-left', hCode, hSrc, m.home, 'is-home') +
          '<div class="dvm__center">' +
            '<div class="dvm__score is-l">' + lTxt + '</div>' +
            '<div class="dvm__badge">' +
              '<img src="' + TROPHY + '" alt="" ' +
                'onerror="this.style.display=\'none\';this.nextElementSibling.style.display=\'block\'">' +
              '<span class="dvm__fallback">🏆</span>' +
            '</div>' +
            '<div class="dvm__score is-r">' + vTxt + '</div>' +
          '</div>' +
          side('is-right', aCode, aSrc, m.away, 'is-away') +
        '</div>' +
      '</div>'
    );
  }

  // ─────────────────────────────────────────────────────────────
  // _buildDExpanded — card grande con todos los detalles del partido.
  // ─────────────────────────────────────────────────────────────
  // ─────────────────────────────────────────────────────────────
  // _buildDExpanded — v3 con kit hero (port legacy ko-card)
  // Cambios sobre v1:
  //   · Hero kit camiseta (.dv2-exp-kits con 2 halves) reemplaza .dv2-exp-mid
  //   · header + score + period flotan dentro como .dv2-exp-center
  //   · .dv2-exp recibe modificador .dv2-exp--kits
  //   · meta + scorers + pred + collapse SIN cambios
  // Compat: id="dcard-N", data-match-key, data-match-idx, .dv2-exp-flag-btn,
  //         data-iso3 (código de 3 letras, antes mal llamado data-iso2),
  //         data-collapse → todo preservado, wiring intacto
  // ─────────────────────────────────────────────────────────────

  // ─────────────────────────────────────────────────────────────
  // Detección cromática de conflicto de kits (adaptación legacy v3).
  // Reusa getDominantColor + colorDistance + kitUrl globales (scoring.js).
  // Llamado con setTimeout(800) tras inyectar la card expanded para dar
  // tiempo a que las imágenes carguen.
  // ─────────────────────────────────────────────────────────────
  function _checkKitConflictV3(card, hTeam, aTeam, hType, aType) {
    if (!card || !hTeam || !aTeam) return;
    if (typeof getDominantColor !== 'function' || typeof colorDistance !== 'function' || typeof kitUrl !== 'function') return;

    const hKitEl = card.querySelector('.dv2-exp-half.left .dv2-exp-kit-bg');
    const aKitEl = card.querySelector('.dv2-exp-half.right .dv2-exp-kit-bg');
    if (!hKitEl || !aKitEl) return;

    const extractUrl = bg => {
      const m = (bg || '').match(/url\(['"]?([^'")\s]+)['"]?\)/);
      return m ? m[1] : '';
    };
    const hUrl = extractUrl(hKitEl.style.backgroundImage);
    const aUrl = extractUrl(aKitEl.style.backgroundImage);
    if (!hUrl || !aUrl) return;

    function analyzeKit(url, callback) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload  = () => { try { callback(getDominantColor(img)); } catch(e) { callback(null); } };
      img.onerror = () => callback(null);
      img.src = url;
    }

    analyzeKit(hUrl, hColor => {
      if (!hColor) return;
      analyzeKit(aUrl, aColor => {
        if (!aColor) return;
        const dist = colorDistance(hColor, aColor);
        // Umbral 80: misma constante que checkKitConflict legacy (scoring.js L1345)
        if (dist < 80 && dist > 0) {
          const altType = aType === 'home' ? 'away' : 'home';
          const altUrl = kitUrl(aTeam.slug, altType);
          aKitEl.style.backgroundImage = "url('" + altUrl + "')";
        }
      });
    });
  }

  // Helper unificado para todo lo que necesita ejecutarse tras inyectar
  // una card expanded en el DOM (actualmente solo checkKitConflict, pero
  // futuras hooks visuales irán aquí).
  function _postInjectExpanded(card, m) {
    const hTeam = EQUIPOS.find(e => e.name === m.home);
    const aTeam = EQUIPOS.find(e => e.name === m.away);
    if (!hTeam || !aTeam) return;
    const FORCE_AWAY = ['Túnez','Irak','Curazao'];
    const hType = FORCE_AWAY.includes(m.home) ? 'away' : 'home';
    const aType = FORCE_AWAY.includes(m.away) ? 'away' : 'home';
    setTimeout(() => _checkKitConflictV3(card, hTeam, aTeam, hType, aType), 800);
  }

  function _buildDExpanded(m, idx) {
    const ctx = _getMatchCtx(m);
    const hTeam = EQUIPOS.find(e => e.name === m.home);
    const aTeam = EQUIPOS.find(e => e.name === m.away);
    const hFlag = hTeam ? SB + '/flags/' + hTeam.flag + '.png' : '';
    const aFlag = aTeam ? SB + '/flags/' + aTeam.flag + '.png' : '';

    // ⭐ Kit defaults: ambos equipos llevan home kit por defecto. Excepciones
    //    legacy de equipos cuyo home kit causa problemas universales
    //    (mismo array que en scoring.js createMatchCard L1149-1150).
    //    La detección de colisión cromática se hace después del render
    //    vía _checkKitConflictV3 con setTimeout(800).
    const FORCE_AWAY = ['Túnez','Irak','Curazao'];
    const hType = FORCE_AWAY.includes(m.home) ? 'away' : 'home';
    const aType = FORCE_AWAY.includes(m.away) ? 'away' : 'home';
    const hKit = hTeam
      ? (typeof kitUrl === 'function' ? kitUrl(hTeam.slug, hType) : SB + '/kits/' + hTeam.slug + '/' + hType + '.jpg')
      : '';
    const aKit = aTeam
      ? (typeof kitUrl === 'function' ? kitUrl(aTeam.slug, aType) : SB + '/kits/' + aTeam.slug + '/' + aType + '.jpg')
      : '';

    const lTxt = ctx.hasScore ? String(ctx.scoreH) : '—';
    const vTxt = ctx.hasScore ? String(ctx.scoreA) : '—';
    const stadium = m.stadium ? m.stadium.replace(' Stadium', '').replace(' Estadio', '') : '';
    // Misma etiqueta de hora que la mini-row (Madrid + sufijo +1, fallback
    // m.date). dayShort sigue siendo el día canónico de la sección (m.date).
    const hora = _kickoffHoraLabel(ctx, m);
    const dayShort = new Date(m.date).toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' });

    // ── Header: badge de estado (igual que v1) ──
    let headerHtml;
    if (ctx.isLive) {
      headerHtml = '<div class="dv2-exp-header live">' +
        '<span class="dv2-exp-live-dot"></span>' +
        '<span class="dv2-exp-live-label">EN VIVO</span>' +
        (ctx.minuteStr ? '<span class="dv2-exp-live-min">· ' + ctx.minuteStr + '</span>' : '') +
        '</div>';
    } else if (ctx.isFinal) {
      headerHtml = '<div class="dv2-exp-header final"><span class="dv2-exp-live-label">FINAL</span></div>';
    } else {
      headerHtml = '<div class="dv2-exp-header upcoming">' +
        '<span class="dv2-exp-live-label">PRÓXIMO</span>' +
        '<span class="dv2-exp-live-min">· ' + dayShort + ' · ' + hora + '</span>' +
        '</div>';
    }

    // Período (1T/2T/DESCANSO) si LIVE
    let periodHtml = '';
    if (ctx.isLive && ctx.minuteStr) {
      const period = ctx.status === 'halftime' ? 'DESCANSO'
                   : (ctx.liveRow && ctx.liveRow.minute != null && ctx.liveRow.minute > 45 ? '2T · ' + ctx.minuteStr : '1T · ' + ctx.minuteStr);
      periodHtml = '<div class="dv2-exp-period">' + period + '</div>';
    }

    // Goleadores (igual que v1)
    let scorersHtml = '';
    if (ctx.events && ctx.events.length > 0) {
      const homeEv = ctx.events.filter(e => e.team === m.home);
      const awayEv = ctx.events.filter(e => e.team === m.away);
      const renderEv = (ev) => {
        const extra = ev.extra ? ' <span class="dv2-exp-ev-extra">(' + ev.extra + ')</span>' : '';
        return '<div class="dv2-exp-ev ' + ev.kind + '">' +
          '<span class="dv2-exp-ev-icon">' + ev.icon + '</span>' +
          '<span class="dv2-exp-ev-min">' + ev.minute + "'</span>" +
          '<span class="dv2-exp-ev-player">' + ev.player + '</span>' +
          extra +
        '</div>';
      };
      scorersHtml =
        '<div class="dv2-exp-scorers">' +
          '<div class="dv2-exp-scorers-title">Goleadores</div>' +
          '<div class="dv2-exp-scorers-cols">' +
            '<div class="dv2-exp-scorers-col">' + (homeEv.length ? homeEv.map(renderEv).join('') : '<div class="dv2-exp-ev-empty">—</div>') + '</div>' +
            '<div class="dv2-exp-scorers-col right">' + (awayEv.length ? awayEv.map(renderEv).join('') : '<div class="dv2-exp-ev-empty">—</div>') + '</div>' +
          '</div>' +
        '</div>';
    }

    // Tu predicción (igual que v1)
    let predHtml = '';
    if (ctx.matchKey) {
      const pred = ctx.pred;
      const predScoreTxt = ctx.hasPred ? (pred.l + ':' + pred.v) : '—:—';
      const golLabel = pred.gol ? '⚽ ' + pred.gol : '—';

      let predStatusHtml = '';
      const live = _getLivePts(ctx, m);
      if (live && (ctx.isLive || ctx.isFinal)) {
        const cls = live.finalPts > 0 ? 'win' : 'zero';
        const verb = ctx.isFinal ? (live.finalPts > 0 ? 'GANASTE' : 'SIN PUNTOS')
                                 : (live.finalPts > 0 ? 'VAS GANANDO' : '0 PTS POR AHORA');
        // Copy boost: la cifra YA lleva el ×2 aplicado — "(boost ×2)" como
        // aclaración, nunca "pts ×2" (sugería multiplicación pendiente).
        // R3: el sufijo solo cuando el ×2 realmente aplicó (exacto Y goleador).
        const ptsTxt = live.finalPts > 0 ? '+' + live.finalPts + ' pts' + (live.isDoubled ? ' (boost ×2)' : '') : '';
        predStatusHtml = '<div class="dv2-exp-pred-status ' + cls + '">' + verb + (ptsTxt ? ' ' + ptsTxt : '') + '</div>';
      }

      predHtml =
        '<div class="dv2-exp-pred">' +
          '<div class="dv2-exp-pred-title">Tu predicción</div>' +
          '<div class="dv2-exp-pred-row">' +
            '<span class="dv2-exp-pred-score">' + predScoreTxt + '</span>' +
            '<span class="dv2-exp-pred-gol">' + golLabel + '</span>' +
          '</div>' +
          predStatusHtml +
        '</div>';
    }

    // ⭐ NUEVO: helper para construir cada media-card (kit + vignette + flag pin + nombre)
    const buildHalf = (side, kitUrl, flagUrl, isoCode, teamName) => {
      // Construir URL de flag rectangular (miniatures/flags-sm/<ISO2>.webp)
      // a partir del mapping ISO3→ISO2. Si no hay match, no se inyecta var
      // y el ::after queda transparente (fallback al <img> que está hidden por CSS,
      // así que el botón será visible pero vacío — caso edge que no debería ocurrir
      // con los 48 equipos del Mundial).
      const iso2 = isoCode && ISO3_TO_ISO2[isoCode];
      const flagRectUrl = iso2 ? SB + '/miniatures/flags-sm/' + iso2 + '.webp' : '';
      const flagStyleAttr = flagRectUrl ? ' style="--flag-rect-url:url(\'' + flagRectUrl + '\')"' : '';
      const flagBtn = isoCode
        ? '<button type="button" class="dv2-exp-half-flag dv2-exp-flag-btn" data-iso3="' + isoCode + '"' + flagStyleAttr + ' aria-label="Ver plantilla ' + (teamName || '') + '">' +
            (flagUrl ? '<img src="' + flagUrl + '" loading="lazy" onerror="this.style.display=\'none\'">' : '') +
          '</button>'
        : '';
      // Auto-shrink agresivo del nombre según longitud (cubre los 48 nombres del Mundial 2026).
      // Casos extremos: "Bosnia y Herzegovina" (20), "República de Corea" (18),
      // "República Checa" (15), "Costa de Marfil" (15) — todos caben en el half
      // sin clip gracias al floor de 7px. nowrap garantizado por CSS.
      const nameLen = (teamName || '').length;
      const nameFs = nameLen <= 7 ? 13 : nameLen <= 9 ? 12 : nameLen <= 11 ? 10 : nameLen <= 13 ? 9 : nameLen <= 16 ? 8 : 7;
      return '<div class="dv2-exp-half ' + side + '">' +
        '<div class="dv2-exp-kit-color"></div>' +
        '<div class="dv2-exp-kit-bg" style="background-image:url(\'' + kitUrl + '\')"></div>' +
        '<div class="dv2-exp-kit-vign"></div>' +
        '<div class="dv2-exp-half-name">' +
          flagBtn +
          '<div class="dv2-exp-team-name" style="font-size:' + nameFs + 'px">' + teamName + '</div>' +
        '</div>' +
      '</div>';
    };

    return (
      '<div class="dv2-exp dv2-exp--kits" id="dcard-' + idx + '" data-match-key="' + (ctx.directoKey || '') + '" data-match-idx="' + idx + '">' +

        // ⭐ HERO con camisetas
        '<div class="dv2-exp-kits">' +
          buildHalf('left',  hKit, hFlag, hTeam ? hTeam.flag : '', m.home) +
          buildHalf('right', aKit, aFlag, aTeam ? aTeam.flag : '', m.away) +
          '<div class="dv2-exp-center">' +
            headerHtml +
            '<div class="dv2-exp-score">' +
              '<span class="dv2-exp-score-num">' + lTxt + '</span>' +
              _buildScoreBall('dv2-exp-score-sep') +
              '<span class="dv2-exp-score-num">' + vTxt + '</span>' +
            '</div>' +
            periodHtml +
          '</div>' +
        '</div>' +

        // Resto IGUAL que v1
        '<div class="dv2-exp-meta">Grupo ' + m.group + ' · 🏟️ ' + stadium + '</div>' +
        scorersHtml +
        predHtml +
        '<button class="dv2-exp-collapse" type="button" data-collapse="1" aria-label="Contraer tarjeta">▲ Contraer</button>' +
      '</div>'
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Construir tarjeta de SIMULACRO (partido fuera del Mundial, is_historic=true)
  // Lee directamente campos de live_scores: home_team_name, away_team_name,
  // competition, venue, match_start_ts, status, score_home, score_away, events.
  // ─────────────────────────────────────────────────────────────
  function _buildSimulacroCard(row) {
    const mk = row.match_key;
    const id = 'simulacro-card-' + sanitizeMatchKey(mk);
    const home = row.home_team_name || '?';
    const away = row.away_team_name || '?';
    const comp = row.competition || '';
    const venue = row.venue || '';
    const startStr = formatStartCEST(row.match_start_ts);

    const status = row.status || 'notstarted';
    const hasScore = row.score_home != null && row.score_away != null;
    const isLive   = status === 'inprogress' || status === 'halftime' ||
                     status === 'overtime'   || status === 'penalties';
    const isFinal  = status === 'finished';

    const lTxt = hasScore ? String(row.score_home) : '—';
    const vTxt = hasScore ? String(row.score_away) : '—';
    const scoreCls = hasScore ? 'dcard-score' : 'dcard-score pending';
    const { txt: statusTxt, cls: statusCls } = statusLabel(status);

    // Eventos (no hay teams_swapped en simulacros: isHome viene directo de la fuente)
    const events = extractRelevantEvents(row.events, false, home, away);
    let eventsHtml = '';
    if (events.length > 0) {
      eventsHtml = '<div class="dcard-events">';
      for (const ev of events) {
        const extraHtml = ev.extra ? '<span class="evt-extra">(' + ev.extra + ')</span>' : '';
        eventsHtml += '<div class="dcard-event ' + ev.kind + '">' +
          '<span class="evt-icon">' + ev.icon + '</span>' +
          "<span class=\"evt-min\">" + ev.minute + "'</span>" +
          '<span class="evt-player">' + ev.player + '</span>' +
          extraHtml +
          '<span style="font-size:10px;color:#4b5563">· ' + ev.team + '</span>' +
        '</div>';
      }
      eventsHtml += '</div>';
    }

    // Pie: competición · estadio · hora CEST
    const footerParts = [];
    if (comp) footerParts.push(comp);
    if (venue) footerParts.push('🏟️ ' + venue);
    if (startStr && !isLive && !isFinal) footerParts.push('⏰ ' + startStr);
    const footerHtml = footerParts.length
      ? '<div class="dcard-status">' +
          '<span class="dcard-status-pill ' + statusCls + '">' + statusTxt + '</span>' +
          footerParts.map((p, i) =>
            (i === 0 ? '' : '<span class="sep">·</span>') +
            '<span>' + p + '</span>'
          ).join('') +
        '</div>'
      : '';

    const classes = 'dcard dcard-simulacro' + (isLive ? ' is-live' : '') + (isFinal ? ' is-final' : '');

    return (
      '<div class="' + classes + '" id="' + id + '" data-sim-key="' + mk + '">' +
        '<div class="dcard-simulacro-banner">🧪 SIMULACRO · PARTIDO FUERA DEL MUNDIAL</div>' +
        '<div class="dcard-main">' +
          '<div class="dcard-stripe" style="background:#facc15"></div>' +
          '<div class="dcard-body">' +
            '<div class="dcard-teams-row">' +
              '<div class="dcard-team">' +
                '<span class="dcard-team-name">' + home + '</span>' +
              '</div>' +
              '<div class="dcard-score-wrap">' +
                '<span class="' + scoreCls + '">' + lTxt + '</span>' +
                '<span class="dcard-score-sep">:</span>' +
                '<span class="' + scoreCls + '">' + vTxt + '</span>' +
              '</div>' +
              '<div class="dcard-team" style="justify-content:flex-end">' +
                '<span class="dcard-team-name" style="text-align:right">' + away + '</span>' +
              '</div>' +
            '</div>' +
            footerHtml +
            eventsHtml +
          '</div>' +
        '</div>' +
      '</div>'
    );
  }

  function _buildSimulacrosSectionHtml() {
    const sims = (typeof window.getSimulacros === 'function') ? window.getSimulacros() : [];
    if (!sims || sims.length === 0) return '';
    const cards = sims.map(_buildSimulacroCard).join('');
    return (
      '<div class="directo-simulacros-section">' +
        '<div class="directo-simulacros-header">🧪 Simulacros activos <span style="opacity:.7">(solo admin)</span></div>' +
        cards +
      '</div>'
    );
  }

  // ─────────────────────────────────────────────────────────────
  // Estado local: matchKey de la card expandida (null = ninguna).
  // Solo UNA expandida a la vez. Click en mini-row alterna.
  // ─────────────────────────────────────────────────────────────
  let _expandedKey = null;

  // Fechas (YYYY-MM-DD) de secciones colapsables expandidas por el usuario.
  // Mismo patrón que _expandedKey: variable de módulo, sobrevive los
  // re-render disparados por live-sync.
  const _expandedDays = new Set();

  // ─────────────────────────────────────────────────────────────
  // Render completo de la vista Directo
  // ─────────────────────────────────────────────────────────────
  function renderVistaDirecto() {
    const container = document.getElementById('directo-container');
    if (!container) return;

    // Comprobación admin asíncrona — NO bloquea el render del Mundial.
    // Si aún no está cacheada (undefined/null), se dispara fire-and-forget.
    // La propia checkIsAdmin llamará a renderVistaDirecto() cuando cambie el valor.
    if (window._isAdminCached !== true && window._isAdminCached !== false) {
      checkIsAdmin();
    }

    // PARTIDOS es const global de data.js, accesible por scope léxico
    // (NO via window.* porque const/let top-level no se adjuntan a window)
    if (typeof PARTIDOS === 'undefined' || !Array.isArray(PARTIDOS) || PARTIDOS.length === 0) {
      container.innerHTML = '<div class="directo-empty">Cargando partidos…</div>';
      return;
    }

    // Agrupar por fecha (misma lógica que Jornada)
    const jornadasMap = {};
    PARTIDOS.forEach((m, idx) => {
      const date = m.date?.substring(0, 10);
      if (!date) return;
      if (!jornadasMap[date]) jornadasMap[date] = [];
      jornadasMap[date].push({ m, idx });
    });
    const dias = Object.keys(jornadasMap).sort();

    // Resolver expanded match (validar que existe en PARTIDOS y aún tiene matchKey)
    let expandedEntry = null;
    if (_expandedKey) {
      for (let i = 0; i < PARTIDOS.length; i++) {
        if (getDirectoKey(PARTIDOS[i]) === _expandedKey) {
          expandedEntry = { m: PARTIDOS[i], idx: i };
          break;
        }
      }
      if (!expandedEntry) _expandedKey = null;
    }

    // Recolectar partidos en vivo (excluyendo el expandido).
    const otherLive = [];
    PARTIDOS.forEach((m, idx) => {
      const dk = getDirectoKey(m);
      if (!dk || dk === _expandedKey) return;
      const row = window._liveScoresByMatchKey[dk];
      if (row && (row.status === 'inprogress' || row.status === 'halftime' ||
                  row.status === 'overtime'   || row.status === 'penalties')) {
        otherLive.push({ m, idx });
      }
    });
    // Solo se extraen de su sección cuando el bloque "Otros partidos en vivo"
    // existe (hay card expandida); sin expandida, el live se queda en su
    // jornada — si no, desaparecería de la vista (badge "EN VIVO" sin fila).
    const otherLiveKeys = expandedEntry
      ? new Set(otherLive.map(x => getDirectoKey(x.m)))
      : new Set();

    // Reusa la función de ranking de jornada si existe
    const sidebarHtml = (typeof window._buildJornadaRanking === 'function')
      ? window._buildJornadaRanking()
      : '';

    // ── Bloque expanded + "Otros partidos en vivo" (si aplica) ──
    let topHtml = '';
    if (expandedEntry) {
      topHtml += '<div class="dv2-expanded-wrap">' + _buildDExpanded(expandedEntry.m, expandedEntry.idx) + '</div>';
      if (otherLive.length > 0) {
        topHtml += '<div class="dv2-section-label">Otros partidos en vivo</div>';
        topHtml += '<div class="dv2-mini-list">';
        otherLive.forEach(({ m, idx }) => { topHtml += _buildDMini(m, idx); });
        topHtml += '</div>';
      }
    }

    // ── Listado por día con mini-rows ──
    // Excluir: el expandido y los inprogress que ya están en "Otros en vivo".
    //
    // Colapso de jornadas: solo se renderizan DOS secciones — la jornada EN
    // CURSO (expandida, como siempre) y la siguiente (contraída, header
    // toggleable). Si la en curso es la última, la contraída es la ANTERIOR.
    // El resto de jornadas no se pinta. La agrupación canónica por m.date
    // (17 jornadas) NO cambia: solo cambia qué secciones se materializan.
    const _liveCountOf = (date) => {
      let n = 0;
      jornadasMap[date].forEach(({ m }) => {
        const dk = getDirectoKey(m);
        const row = dk ? window._liveScoresByMatchKey[dk] : null;
        if (row && (row.status === 'inprogress' || row.status === 'halftime' ||
                    row.status === 'overtime'   || row.status === 'penalties')) n++;
      });
      return n;
    };

    // (a-bis) — N1 post-J1 (captura San 03:35 Madrid): jornada con algún
    // partido NO finished cuyo kickoff REAL (match_start_ts, con sufijo +1 —
    // NO el día canónico de sede) esté vencido o a ≤6h. De madrugada sin
    // live, (b) saltaba al día nuevo y la J1 desaparecía ENTERA con KOR-CZE
    // aún por jugar (kickoff 04:00 del viernes, día canónico jueves 11); se
    // autocuraba al pitido vía (a) pero el hueco medianoche→kickoff confundía.
    // 6h cubre el peor hueco (medianoche → slot 04:00) sin adelantar de más
    // las jornadas de tarde.
    const _hasPendingImminent = (date) => {
      const now = Date.now();
      return jornadasMap[date].some(({ m }) => {
        const dk = getDirectoKey(m);
        const row = dk ? window._liveScoresByMatchKey[dk] : null;
        if (row && row.status === 'finished') return false;
        const ko = _kickoffMs(row);
        return ko != null && (ko - now) <= _KICKOFF_INMINENTE_MS;
      });
    };

    const todayMadrid = _madridDateStr(Date.now());
    const currentIdx = _pickJornadaEnCurso(dias, {
      liveCountOf: _liveCountOf,
      hasPendingImminent: _hasPendingImminent,
      todayMadrid: todayMadrid
    });
    const secondaryIdx = (currentIdx + 1 < dias.length) ? currentIdx + 1 : currentIdx - 1;

    let sectionsHtml = '';
    dias.forEach((date, dIdx) => {
      if (dIdx !== currentIdx && dIdx !== secondaryIdx) return;
      const jNum = dIdx + 1;
      const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('es-ES', {
        weekday: 'long', day: 'numeric', month: 'long'
      });

      const matchesOfDay = jornadasMap[date].filter(({ m }) => {
        const dk = getDirectoKey(m);
        if (dk === _expandedKey) return false;
        if (otherLiveKeys.has(dk)) return false;
        return true;
      });
      if (matchesOfDay.length === 0) return;

      const liveCount = _liveCountOf(date);
      const liveBadge = liveCount > 0
        ? '<span class="directo-live-count">🔴 ' + liveCount + ' EN VIVO</span>'
        : '';

      const isCollapsible = dIdx === secondaryIdx;
      const isCollapsed = isCollapsible && !_expandedDays.has(date);

      sectionsHtml += '<div class="directo-section' + (isCollapsed ? ' is-collapsed' : '') +
                      '" id="directo-' + date + '" data-date="' + date + '">';
      sectionsHtml += isCollapsible
        ? '<div class="directo-header is-collapsible" role="button" tabindex="0" aria-expanded="' + String(!isCollapsed) + '">'
        : '<div class="directo-header">';
      sectionsHtml += '<span class="directo-label">J' + jNum + '</span>';
      sectionsHtml += '<span class="directo-date">' + dayLabel + '</span>';
      sectionsHtml += liveBadge;
      if (isCollapsible) sectionsHtml += '<span class="directo-chevron" aria-hidden="true">▾</span>';
      sectionsHtml += '</div>';
      sectionsHtml += '<div class="dv2-mini-list">';
      matchesOfDay.forEach(({ m, idx }) => { sectionsHtml += _buildDMini(m, idx); });
      sectionsHtml += '</div>';
      sectionsHtml += '</div>';
    });

    // Sección simulacros (solo admin, solo si hay alguno)
    const simsHtml = (window._isAdminCached === true) ? _buildSimulacrosSectionHtml() : '';

    const mainHtml = simsHtml + topHtml + sectionsHtml;

    if (sidebarHtml) {
      container.innerHTML =
        '<div class="directo-wrap">' +
          '<div class="directo-main">' + mainHtml + '</div>' +
          '<div class="directo-sidebar">' + sidebarHtml + '</div>' +
        '</div>';
    } else {
      container.innerHTML = '<div class="directo-main">' + mainHtml + '</div>';
    }

    // Detectar todas las cards expanded en el render inicial y disparar
    // el checkKitConflict para cada una.
    container.querySelectorAll('.dv2-exp').forEach(card => {
      const idx = parseInt(card.getAttribute('data-match-idx'), 10);
      if (!isNaN(idx) && PARTIDOS[idx]) {
        _postInjectExpanded(card, PARTIDOS[idx]);
      }
    });

    // Wire click handler delegado (asignación directa para no acumular listeners
    // en sucesivos render — sustituye el handler anterior si existía).
    container.onclick = _onDirectoClick;
    container.onkeydown = _onDirectoClick;
  }
  window.renderVistaDirecto = renderVistaDirecto;

  // Click delegado: alterna expandido al pulsar mini-row;
  // pulsar Contraer (botón en la expanded) la cierra.
  // También soporta keydown (Space/Enter) en las mini-rows (role=button).
  function _onDirectoClick(e) {
    // Si viene de keydown, solo respondemos a Space/Enter
    if (e.type === 'keydown') {
      if (e.key !== 'Enter' && e.key !== ' ') return;
      e.preventDefault();
    }
    const collapseBtn = e.target.closest('[data-collapse]');
    if (collapseBtn) {
      _expandedKey = null;
      renderVistaDirecto();
      return;
    }
    // Toggle de la sección colapsable (header de la jornada secundaria).
    // In-place (sin re-render): solo cambia visibilidad de la lista; el Set
    // _expandedDays conserva la elección a través de los re-render de live-sync.
    const collHeader = e.target.closest('.directo-header.is-collapsible');
    if (collHeader) {
      const section = collHeader.closest('.directo-section');
      const date = section ? section.getAttribute('data-date') : '';
      if (!section || !date) return;
      const collapsed = section.classList.toggle('is-collapsed');
      if (collapsed) _expandedDays.delete(date); else _expandedDays.add(date);
      collHeader.setAttribute('aria-expanded', String(!collapsed));
      return;
    }
    const mini = e.target.closest('.dvm');
    if (!mini) return;
    const key = mini.getAttribute('data-match-key');
    if (!key) return;
    _expandedKey = (_expandedKey === key) ? null : key;
    renderVistaDirecto();
  }

  // ─────────────────────────────────────────────────────────────
  // Actualizar una tarjeta de SIMULACRO (llamado por live-sync.js)
  // ─────────────────────────────────────────────────────────────
  function updateSimulacroCard(matchKey) {
    const container = document.getElementById('directo-container');
    if (!container || container.style.display === 'none') return;
    if (window._isAdminCached !== true) return; // no admin: no hay sección

    const id = 'simulacro-card-' + sanitizeMatchKey(matchKey);
    const existing = document.getElementById(id);
    const row = (window._simulacrosByKey || {})[matchKey];

    // Si la fila deja de ser simulacro o desaparece, no tocamos (solo repintado)
    if (!row) return;

    if (!existing) {
      // Primera aparición: re-render completo para insertar la sección si faltaba
      renderVistaDirecto();
      return;
    }

    const tmp = document.createElement('div');
    tmp.innerHTML = _buildSimulacroCard(row);
    const newCard = tmp.firstElementChild;
    if (newCard) existing.replaceWith(newCard);
  }
  window.updateSimulacroCard = updateSimulacroCard;

  // ─────────────────────────────────────────────────────────────
  // Actualizar una tarjeta individual (llamado por live-sync.js)
  // ─────────────────────────────────────────────────────────────
  function updateDirectoCard(matchKey) {
    // Solo repinta si la vista Directo está visible (optimización)
    const container = document.getElementById('directo-container');
    if (!container || container.style.display === 'none') return;

    // Buscar la tarjeta existente por data-match-key. Puede ser un mini o el
    // expanded; el atributo está presente en ambos.
    const existing = container.querySelector('[data-match-key="' + matchKey + '"]');
    if (!existing) return;

    const idx = parseInt(existing.getAttribute('data-match-idx') ||
                         (existing.id ? existing.id.replace('dcard-', '') : ''), 10);
    if (isNaN(idx)) return;
    const m = PARTIDOS[idx];
    if (!m) return;

    // Si un partido pasa a inprogress y no tenemos nada expandido, podríamos
    // re-render para que aparezca en "Otros en vivo" — por simplicidad solo
    // hacemos repintado in-place del nodo. Cambios estructurales (e.g. de
    // notstarted → inprogress fuera del expandido) se reflejan en el siguiente
    // renderVistaDirecto natural.
    const isExpanded = existing.classList && existing.classList.contains('dv2-exp');
    const html = isExpanded ? _buildDExpanded(m, idx) : _buildDMini(m, idx);
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const newCard = tmp.firstElementChild;
    if (newCard) {
      existing.replaceWith(newCard);
      if (isExpanded) _postInjectExpanded(newCard, m);
    }
  }
  window.updateDirectoCard = updateDirectoCard;

  // ── Click delegado en banderas → abre pizarra táctica
  document.addEventListener('click', function (e) {
    const btn = e.target.closest && e.target.closest('.dv2-mini-flag-btn, .dv2-exp-flag-btn');
    if (!btn || !btn.dataset.iso3) return;
    if (typeof window.openPizarraTactica === 'function') {
      e.preventDefault();
      e.stopPropagation();
      window.openPizarraTactica({ iso3: btn.dataset.iso3 });
    }
  });

})();
