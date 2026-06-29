/* ============================================================
 * porra-jugador-v3.js  ·  Screen 2 — "Porra de un jugador"
 * ------------------------------------------------------------
 * Todos los pronósticos de grupos de un jugador (consultable por
 * cualquier miembro tras el cierre del TARGET). Selector J1/J2/J3
 * (matchday, modelo V3_MATCH_DAY de grupos-v3.js).
 *
 * Expone openPorraJugador(userId, hints) / closePorraJugador() /
 * porraJugadorSetJornada(id). Entrada: fila del ranking del predictor
 * (delegación document; lee data-pl-user/name/rank/total).
 *
 * F5 — datos REALES vía Edge Function get-user-predictions
 * (PCShared.invokeEF, cliente JWT). league_id OBLIGATORIO (liga activa).
 *   - gated:true (porra del TARGET abierta) → empty-state.
 *   - gated:false → predictions[] crudas overlaid sobre los fixtures de
 *     grupos (PARTIDOS), + chip boost si el match_id está en boost_picks[].
 * Chips: motor real v3CalcMatchPointsGrupos → {types}; el total se
 * reconstruye del breakdown para aplicar el boost ×2 del TARGET (no el
 * boostPicks global del viewer que leería calcMatchPoints). Resultados
 * reales desde live_scores / PARTIDOS. Header (nombre) desde profiles.
 * ============================================================ */
(function () {
  'use strict';

  var WRAP_ID = 'page-porra-jugador';
  var PAGE_PREDICTOR_ID = 'page-predictor';
  var HIDE_IDS = ['page-jornada','page-directo','page-grupos','page-elim','page-score','page-admin','page-predictor','page-welcome'];
  var STATE_LABEL = { done: 'Cerrada', live: 'En juego', upcoming: 'Próximamente' };

  var returnTo = PAGE_PREDICTOR_ID;
  var _currentUid = null;
  var _state = { userId: null, payload: null, active: 'j1' };

  function _partidos() { return (typeof PARTIDOS !== 'undefined') ? PARTIDOS : (window.PARTIDOS || []); }
  function _equipos() { return (typeof EQUIPOS !== 'undefined') ? EQUIPOS : (window.EQUIPOS || []); }
  function _live() { return window._liveScoresByMatchKey || {}; }
  var PCS = function () { return window.PCShared || {}; };
  var esc = function (s) { return PCS().esc ? PCS().esc(s) : String(s == null ? '' : s); };
  var flagImg = function (name, cls) { return PCS().flagImg ? PCS().flagImg(name, cls) : ''; };
  var codeFor = function (name) { return PCS().codeFor ? PCS().codeFor(name) : String(name || '').slice(0, 3).toUpperCase(); };
  function _mk(m) { return (typeof getMatchKey === 'function') ? getMatchKey(m) : (m.group + '_' + m.home + '_' + m.away); }

  var CHEVRON = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 12 L5 8 L10 4"/></svg>';
  var SEP = '<span class="pcb-sep">–</span>';

  function _cleanName(s) { return String(s || '').replace(/^\s*\d+\s*·\s*/, '').trim(); }
  function _initials(name) {
    var parts = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (!parts.length) return '?';
    return (parts.length > 1 ? (parts[0][0] + parts[parts.length - 1][0]) : parts[0].slice(0, 1)).toUpperCase();
  }
  function _scorerName(key, matchObj) {
    if (!key) return '';
    var teams = [matchObj.home, matchObj.away];
    for (var i = 0; i < teams.length; i++) {
      var e = _equipos().find(function (t) { return t.name === teams[i]; });
      var p = ((e && e.players) || []).find(function (pp) { return pp.key === key; });
      if (p) return _cleanName(p.name || p.key);
    }
    return key;
  }
  function _timeLabel(match) {
    if (!match || !match.date) return (match && match.time) || '';
    // ERR-92: instante real del kickoff (date_utc, igual que Directo) vía
    // window.kickoffUtcMsFor; m.date es hora de SEDE (no CEST) → formatear
    // SIEMPRE en Europe/Madrid, nunca con getHours/getDate (hora del navegador).
    var ms = (typeof window.kickoffUtcMsFor === 'function') ? window.kickoffUtcMsFor(match) : null;
    var d = ms != null ? new Date(ms) : new Date(match.date);
    if (isNaN(d.getTime())) return match.time || '';
    var dow = d.toLocaleDateString('es-ES', { weekday: 'short', timeZone: 'Europe/Madrid' }).toUpperCase().replace('.', '');
    var dd = d.toLocaleDateString('es-ES', { day: 'numeric', timeZone: 'Europe/Madrid' });
    var hhmm = d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Madrid' });
    return dow + ' ' + dd + ' · ' + hhmm;
  }

  // Jornadas de grupos = matchday J1/J2/J3 (V3_MATCH_DAY).
  function _matchDayMap() { return (typeof V3_MATCH_DAY !== 'undefined') ? V3_MATCH_DAY : (window.V3_MATCH_DAY || ['J1','J1','J2','J2','J3','J3']); }
  function _gruposJornadas() {
    var arr = _partidos().filter(function (m) { return m && m.group; });
    var byGroup = {};
    arr.forEach(function (m) { (byGroup[m.group] = byGroup[m.group] || []).push(m); });
    var dayMap = _matchDayMap();
    var out = { J1: [], J2: [], J3: [] };
    Object.keys(byGroup).sort().forEach(function (g) {
      var ms = byGroup[g].slice().sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')); });
      ms.forEach(function (m, i) { var d = dayMap[i % 6] || 'J1'; (out[d] = out[d] || []).push(m); });
    });
    return out;
  }
  function _jornadaDates(ms) {
    var ds = ms.map(function (m) { return m.date ? new Date(m.date) : null; }).filter(function (d) { return d && !isNaN(d.getTime()); });
    if (!ds.length) return '';
    ds.sort(function (a, b) { return a - b; });
    var f = ds[0], l = ds[ds.length - 1];
    var mon = l.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase().replace('.', '');
    return (f.getDate() === l.getDate() ? String(f.getDate()) : f.getDate() + '–' + l.getDate()) + ' ' + mon;
  }

  // Resultado real del fixture (finished/live) desde live_scores / PARTIDOS.
  // OJO (Item 6 post-J1): window._liveScoresByMatchKey está indexada por key
  // de BD (wc2026_gX_id), NO por la key legacy de _mk (grupo_local_visitante).
  // Resolver con window.matchKeyFor (live-sync.js, mismo mapper que
  // getDirectoKey en ui-directo). La legacy sigue siendo la correcta para
  // predByKey y boostSet — no tocar _mk en el resto.
  function _realFor(matchObj) {
    var liveKey = (typeof window.matchKeyFor === 'function') ? window.matchKeyFor(matchObj) : null;
    var live = liveKey ? _live()[liveKey] : null;
    if (live && live.status === 'finished') {
      var h = (live.score_home != null) ? live.score_home : (matchObj.realHome != null ? matchObj.realHome : null);
      var a = (live.score_away != null) ? live.score_away : (matchObj.realAway != null ? matchObj.realAway : null);
      if (h != null && a != null) return { h: h, a: a, phase: 'final' };
    }
    if (live && (live.status === 'inprogress' || live.status === 'halftime' || live.status === 'overtime' || live.status === 'penalties')) {
      return { h: live.score_home != null ? live.score_home : 0, a: live.score_away != null ? live.score_away : 0, phase: 'live', minute: live.minute || null };
    }
    return null;
  }

  // base del motor reconstruida del breakdown de tipos (para aplicar el boost
  // del TARGET, no el boostPicks global del viewer). Espejo de scoring.js:
  // signo +1, exacto +3 adicional (=4), goleador +2, vs-IA +1, cap 7.
  function _baseFromTypes(types) {
    var b = types.indexOf('exact') !== -1 ? 4 : types.indexOf('win') !== -1 ? 1 : 0;
    if (types.indexOf('gole') !== -1) b += 2;
    if (types.indexOf('bonus') !== -1) b += 1;
    return Math.min(b, 7);
  }

  function buildMatchCard(matchObj, pred, boostSet) {
    var matchKey = _mk(matchObj);
    var home = { n: matchObj.home, c: codeFor(matchObj.home) };
    var away = { n: matchObj.away, c: codeFor(matchObj.away) };
    var rf = _realFor(matchObj);
    var phase = rf ? rf.phase : 'pre';
    if (!pred) {
      return { home: home, away: away, time: _timeLabel(matchObj), phase: 'pre', pred: null, real: null, scorer: '', boost: false, boosted: false, pts: 0, scoringTypes: [] };
    }
    var out = {
      home: home, away: away,
      time: phase === 'live' ? (rf.minute ? rf.minute + '′' : 'directo') : _timeLabel(matchObj),
      phase: phase,
      pred: { h: pred.local, a: pred.visitante },
      real: phase === 'final' ? { h: rf.h, a: rf.a } : null,
      scorer: pred.scorer ? _scorerName(pred.scorer, matchObj) : '',
      boost: boostSet.has(matchKey), boosted: false, pts: 0, scoringTypes: [],
    };
    if (phase === 'live') out.live = { h: rf.h, a: rf.a };
    if (phase !== 'pre') {
      var predObj = { l: pred.local, v: pred.visitante, gol: pred.scorer, saved: true, home: matchObj.home, away: matchObj.away };
      // played:true — resultados REALES de live_scores (phase live/post): el
      // sentinel 0-0-placeholder de v3CalcMatchPointsGrupos no aplica aquí,
      // un 0-0 real puntúa y pinta chip (regla 0-0, fix 10-jun).
      var mWithReal = Object.assign({}, matchObj, { realHome: rf.h, realAway: rf.a, played: true });
      var calc = (typeof window.v3CalcMatchPointsGrupos === 'function') ? window.v3CalcMatchPointsGrupos(predObj, mWithReal) : { total: 0, types: [] };
      var types = calc.types || [];
      var base = _baseFromTypes(types);
      var exact = types.indexOf('exact') !== -1;
      var gole = types.indexOf('gole') !== -1;
      out.scoringTypes = types;
      // R3 (12-jun, regla canónica San): el ×2 del boost SOLO con exacto Y
      // goleador a la vez. N3 (decisión San, madrugada 12-jun): el +1 anti-IA
      // va DENTRO del multiplicador — base (cap 7, bonus incluido) ×2, máx 14.
      out.boosted = out.boost && exact && gole;
      out.pts = out.boosted ? base * 2 : base;
    }
    return out;
  }

  // ═══════════════════════════════════════════════════════════════
  // KO — bracket del jugador VISITADO (16avos … Final) + comparación real
  // ───────────────────────────────────────────────────────────────
  // Reutiliza el resolvedor real (resolveAllSlots, ko.js) y el motor de puntos
  // (calcKOMatchPoints, scoring.js), ambos globales de classic-script. La malla
  // del jugador se reconstruye con un swap SÍNCRONO de los globales compartidos
  // (predictions/koPredictions/resolvedSlots); el lado real viene del EF
  // (ko_real = wc_matches_ko ⨝ results.ko_results). Visualización pura (brief
  // pronósticos KO en detalle de usuario, 29-jun).

  // Defs de ronda → pestañas. 'kofinal' agrega el 3.º/4.º puesto (slot 103).
  var KO_ROUND_DEFS = [
    { id: 'ko16',    short: '16avos', label: 'Dieciseisavos de final', round: 'r32' },
    { id: 'ko8',     short: '8vos',   label: 'Octavos de final',       round: 'r16' },
    { id: 'ko4',     short: '4tos',   label: 'Cuartos de final',       round: 'qf'  },
    { id: 'kosf',    short: 'Semis',  label: 'Semifinales',            round: 'sf'  },
    { id: 'kofinal', short: 'Final',  label: 'Final',                  round: 'final', includeThird: true },
  ];
  function _koBracket() { return (typeof BRACKET !== 'undefined') ? BRACKET : (window.BRACKET || null); }
  function _koRoundPts() { return (typeof KO_ROUND_PTS !== 'undefined') ? KO_ROUND_PTS : (window.KO_ROUND_PTS || { r32: 5, r16: 10, qf: 15, sf: 20, final: 25, third: 0 }); }
  function _isoForName(name) {
    if (!name) return null;
    var e = _equipos().find(function (t) { return t.name === name; });
    return e ? e.flag : null;
  }
  function _nameForIso(iso) {
    if (!iso) return null;
    var e = _equipos().find(function (t) { return t.flag === iso; });
    return e ? e.name : null;
  }
  // Etiqueta de feeder (Opción B, espejo de ui-directo _koSeedLabel) cuando la
  // malla del jugador no resuelve un lado (porra incompleta, o ronda colgada de
  // cruces aún sin decidir): W74 / RU101 / 2.º A / 3.º (A/B/C/D/F).
  function _koSeedLabel(seed) {
    if (!seed) return 'TBD';
    var s = String(seed), m;
    if ((m = /^W(\d+)$/.exec(s))) return 'W' + m[1];
    if ((m = /^L(\d+)$/.exec(s))) return 'RU' + m[1];
    if ((m = /^([12])([A-L])$/.exec(s))) return m[1] + '.º ' + m[2];
    if ((m = /^T_([A-L]+)$/.exec(s))) return '3.º (' + m[1].split('').join('/') + ')';
    return s;
  }
  function _koLiveFor(slot) { return _live()['wc2026_ko_' + slot] || null; }
  // Fecha+hora KO en Europe/Madrid. Prioriza match_start_ts de la fila live
  // (epoch, ya en cache); fallback a date_utc del cruce sembrado (UTC). NUNCA
  // formatear m.date crudo (hora de SEDE, no CEST) — regla ERR-92.
  function _koWhenLabel(real, live) {
    var ms = null;
    if (live && live.match_start_ts != null) {
      var n = Number(live.match_start_ts);
      if (isFinite(n) && n > 0) ms = n > 1e12 ? n : n * 1000;
    }
    if (ms == null && real && real.date_utc) {
      var s = String(real.date_utc);
      if (!/[zZ]|[+-]\d\d:?\d\d$/.test(s)) s = s + (s.length === 16 ? ':00Z' : 'Z');
      var d = new Date(s);
      if (!isNaN(d.getTime())) ms = d.getTime();
    }
    if (ms == null) return '';
    var dt = new Date(ms);
    var dow = dt.toLocaleDateString('es-ES', { weekday: 'short', timeZone: 'Europe/Madrid' }).toUpperCase().replace('.', '');
    var dd = dt.toLocaleDateString('es-ES', { day: 'numeric', timeZone: 'Europe/Madrid' });
    var hhmm = dt.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: 'Europe/Madrid' });
    return dow + ' ' + dd + ' · ' + hhmm;
  }

  // Reconstruye la malla del jugador visitado reutilizando resolveAllSlots, que
  // opera sobre los globales del usuario LOGUEADO. Swap síncrono: guardar →
  // inyectar los del visitado → resolver → capturar copia → restaurar (finally).
  // Sin await entre medias → sin reentrancia. Paridad exacta con el predictor
  // propio (ANNEX_C/ERR-61) por reutilizar el mismo resolvedor.
  function _resolveVisitedBracket(efPreds, efKoPreds) {
    var vKo = {};
    (efKoPreds || []).forEach(function (k) {
      var o = { l: k.local, v: k.visitante, classifier: k.classifier, gol: k.scorer, saved: true };
      vKo[k.match_id] = o;
      vKo[String(k.match_id)] = o;
    });
    if (typeof resolveAllSlots !== 'function' || typeof predictions === 'undefined' ||
        typeof koPredictions === 'undefined' || typeof resolvedSlots === 'undefined') {
      return { rs: {}, vKo: vKo };
    }
    var vPreds = {};
    (efPreds || []).forEach(function (p) {
      vPreds[p.match_id] = { l: p.local, v: p.visitante, gol: p.scorer, saved: true };
    });
    var savedP = predictions, savedK = koPredictions, savedR = resolvedSlots, rs = {};
    try {
      predictions = vPreds;
      koPredictions = vKo;
      resolvedSlots = {};
      resolveAllSlots();
      rs = Object.assign({}, resolvedSlots);
    } catch (e) {
      console.warn('[porra-jugador] resolución de bracket KO falló:', e);
    } finally {
      predictions = savedP;
      koPredictions = savedK;
      resolvedSlots = savedR;
    }
    return { rs: rs, vKo: vKo };
  }

  // View-object de una card KO para el slot m (entrada BRACKET de su ronda).
  // rs = resolvedSlots del visitado (nombres ES); vKo = sus ko_predictions;
  // koReal = mapa slot→cruce/resultado real (EF). round = 'r32'…'final'|'third'.
  function buildKoCard(m, round, rs, vKo, koReal, opts) {
    opts = opts || {};
    var advPts = _koRoundPts()[round] || 0;

    // ── Lado del jugador (su predicción) ──
    var predHomeName = rs[m.home] || null;            // nombre ES si su malla lo resuelve
    var predAwayName = rs[m.away] || null;
    var homeIso = predHomeName ? _isoForName(predHomeName) : null;
    var awayIso = predAwayName ? _isoForName(predAwayName) : null;
    var homeCode = predHomeName ? codeFor(predHomeName) : _koSeedLabel(m.home);
    var awayCode = predAwayName ? codeFor(predAwayName) : _koSeedLabel(m.away);
    var pk = vKo[m.id] || vKo[String(m.id)] || null;
    var hasPred = !!(pk && pk.l != null && pk.v != null);
    var predAdvName = rs['W' + m.id] || null;
    // resolveAllSlots() NO itera BRACKET.final (ko.js:750-754) → 'W104' nunca se
    // resuelve; un empate sin classifier tampoco deja 'W<slot>'. Derivar el
    // avanzador del marcador/classifier del propio pick (espejo de resolveKO,
    // ko.js:721-747) para que la card de la Final muestre al campeón y compute
    // el avance (+25), y para slots empatados sin classifier explícito.
    if (!predAdvName && hasPred) {
      if (pk.l > pk.v) predAdvName = predHomeName;
      else if (pk.v > pk.l) predAdvName = predAwayName;
      else if (pk.classifier === 'home') predAdvName = predHomeName;
      else if (pk.classifier === 'away') predAdvName = predAwayName;
      else if (pk.classifier) predAdvName = pk.classifier;
    }
    var predAdvIso = predAdvName ? _isoForName(predAdvName) : null;

    // ── Lado real (competición) ──
    var real = koReal ? (koReal[String(m.id)] || koReal[m.id] || null) : null;
    var live = _koLiveFor(m.id);
    // Cruce real: preferir ko_real (iso3 sembrado, autoritativo); si falta,
    // derivar del nombre ES de la fila live (_liveScoresByMatchKey YA trae el
    // cruce real sembrado, orientado, ERR-99) → la comparación funciona aunque
    // la EF (ko_real) aún no esté desplegada o no cubra el slot.
    var realHomeName = (real && real.home_iso3) ? _nameForIso(real.home_iso3) : ((live && live.home_team_name) || null);
    var realAwayName = (real && real.away_iso3) ? _nameForIso(real.away_iso3) : ((live && live.away_team_name) || null);
    var realHomeIso = (real && real.home_iso3) ? real.home_iso3 : _isoForName(realHomeName);
    var realAwayIso = (real && real.away_iso3) ? real.away_iso3 : _isoForName(realAwayName);

    // Fase + marcador real: live (en juego) > ko_results finished > live finished.
    var phase = 'pre', realL = null, realV = null, minute = null;
    var ls = live ? live.status : null;
    if (ls === 'inprogress' || ls === 'halftime' || ls === 'overtime' || ls === 'penalties') {
      phase = 'live'; realL = live.score_home != null ? live.score_home : 0; realV = live.score_away != null ? live.score_away : 0; minute = live.minute || null;
    } else if (real && real.status === 'finished' && real.l != null && real.v != null) {
      phase = 'final'; realL = real.l; realV = real.v;
    } else if (ls === 'finished' && live.score_home != null && live.score_away != null) {
      phase = 'final'; realL = live.score_home; realV = live.score_away;
    }
    // Avanzador real: ko_real.winner (autoritativo, incluye tanda de penaltis);
    // si falta, derivar del marcador final (más goles pasa; empate sin winner
    // explícito → indeterminado, null).
    var realAdvIso = null;
    if (real && real.winner) realAdvIso = (real.winner === 'home') ? realHomeIso : realAwayIso;
    else if (phase === 'final' && realL != null && realV != null && realL !== realV) realAdvIso = (realL > realV) ? realHomeIso : realAwayIso;
    var crossKnown = !!(realHomeIso && realAwayIso);

    // ── Comparación cruce / marcador / avance (iso3) ──
    var cruceMatch = false, signOk = false, exactOk = false, goleOk = false, pasaMatch = false;
    if (crossKnown && homeIso && awayIso) {
      cruceMatch = (homeIso === realHomeIso && awayIso === realAwayIso) ||
                   (homeIso === realAwayIso && awayIso === realHomeIso);
    }
    if (realAdvIso && predAdvIso) pasaMatch = (predAdvIso === realAdvIso);
    if (cruceMatch && hasPred && (phase === 'final' || phase === 'live')) {
      // Orientar el marcador del jugador al marco real (su home puede ser el away real).
      var swap = (homeIso === realAwayIso);
      var pl = swap ? pk.v : pk.l;
      var pv = swap ? pk.l : pk.v;
      signOk = Math.sign(pl - pv) === Math.sign(realL - realV);
      exactOk = (pl === realL && pv === realV);
      if (pk.gol && real && Array.isArray(real.scorers) && typeof scorerMatches === 'function') {
        goleOk = scorerMatches(real.scorers, pk.gol);
      } else if (!pk.gol && pl === 0 && pv === 0 && realL === 0 && realV === 0) {
        goleOk = true;
      }
    }

    // ── Puntos: motor real calcKOMatchPoints (marcador con gate de cruce +
    //    avance por equipo). Anti-IA omitido (la IA por cruce no se carga en
    //    este modal; divergencia ≤ +1/cruce vs leaderboard). Solo finished. ──
    var pts = 0;
    if (phase === 'final' && hasPred && typeof calcKOMatchPoints === 'function') {
      pts = calcKOMatchPoints(
        { saved: true, l: pk.l, v: pk.v, gol: pk.gol, home: predHomeName, away: predAwayName },
        realL, realV, round,
        {
          predHome: homeIso, predAway: awayIso,
          realHome: realHomeIso, realAway: realAwayIso,
          predAdvancer: predAdvIso, realAdvancer: realAdvIso,
          scorers: (real && real.scorers) || null,
        }
      ) || 0;
    }

    return {
      id: m.id, round: round, isThird: !!opts.isThird,
      homeCode: homeCode, awayCode: awayCode, homeName: predHomeName, awayName: predAwayName,
      homeResolved: !!predHomeName, awayResolved: !!predAwayName,
      pred: hasPred ? { l: pk.l, v: pk.v } : null,
      scorer: (pk && pk.gol) ? _scorerName(pk.gol, { home: predHomeName, away: predAwayName }) : '',
      predAdvName: predAdvName,
      phase: phase, real: (phase === 'final' || phase === 'live') ? { l: realL, v: realV } : null, minute: minute,
      realHomeName: realHomeName, realAwayName: realAwayName,
      realAdvName: realAdvIso ? _nameForIso(realAdvIso) : null,
      crossKnown: crossKnown, cruceMatch: cruceMatch,
      signOk: signOk, exactOk: exactOk, goleOk: goleOk, pasaMatch: pasaMatch, advPts: advPts,
      when: _koWhenLabel(real, live), pts: pts,
    };
  }

  function _buildKoRounds(rs, vKo, koReal) {
    var B = _koBracket();
    if (!B) return [];
    var ptsTable = _koRoundPts();
    return KO_ROUND_DEFS.map(function (def) {
      var slots = Array.isArray(B[def.round]) ? B[def.round] : [];
      var cards = slots.map(function (m) { return buildKoCard(m, def.round, rs, vKo, koReal); });
      if (def.includeThird && Array.isArray(B.third)) {
        B.third.forEach(function (m) { cards.push(buildKoCard(m, 'third', rs, vKo, koReal, { isThird: true })); });
      }
      var state = 'upcoming';
      if (cards.some(function (c) { return c.phase === 'live'; })) state = 'live';
      else if (cards.some(function (c) { return c.phase === 'final'; })) state = 'done';
      return {
        id: def.id, kind: 'ko', short: def.short, label: def.label, round: def.round,
        sub: '+' + (ptsTable[def.round] || 0) + ' pts/avance',
        state: state, cards: cards,
        pts: cards.reduce(function (s, c) { return s + (c.pts || 0); }, 0),
        settled: cards.filter(function (c) { return c.phase === 'final'; }).length,
        exact: cards.filter(function (c) { return c.cruceMatch && c.exactOk; }).length,
      };
    });
  }

  function buildPorra(ef, userId, hints, name) {
    var predByKey = {};
    (ef.predictions || []).forEach(function (p) { predByKey[p.match_id] = p; });
    var boostSet = new Set(ef.boost_picks || []);
    var md = _gruposJornadas();
    var defs = [
      { id: 'j1', short: 'J1', label: 'Jornada 1', key: 'J1' },
      { id: 'j2', short: 'J2', label: 'Jornada 2', key: 'J2' },
      { id: 'j3', short: 'J3', label: 'Jornada 3', key: 'J3' },
    ];
    var jornadas = defs.map(function (def) {
      var ms = (md[def.key] || []).slice().sort(function (a, b) { return String(a.date || '').localeCompare(String(b.date || '')); });
      var matches = ms.map(function (mo) { return buildMatchCard(mo, predByKey[_mk(mo)], boostSet); });
      var state = 'upcoming';
      if (matches.some(function (x) { return x.phase === 'live'; })) state = 'live';
      else if (matches.some(function (x) { return x.phase === 'final'; })) state = 'done';
      return { id: def.id, short: def.short, label: def.label, dates: _jornadaDates(ms), state: state, matches: matches };
    });

    var rank = (hints && hints.rank != null) ? hints.rank : null;
    var totalPlayers = (hints && hints.total != null) ? hints.total : null;
    if (rank == null || totalPlayers == null) {
      var sb = window._sbData;
      if (Array.isArray(sb) && sb.length) {
        if (totalPlayers == null) totalPlayers = sb.length;
        if (rank == null) {
          var idx = sb.findIndex(function (r) { return String(r.uid) === String(userId); });
          // F2: rank() con empates compartidos (helper data.js), no row_number.
          if (idx >= 0) {
            rank = (typeof window.rankConEmpates === 'function')
              ? window.rankConEmpates(sb, idx, function (r) { return r.total; })
              : idx + 1;
          }
        }
      }
    }
    jornadas.forEach(function (j) { j.kind = 'group'; });

    // KO: malla del jugador visitado (16avos…Final) + comparación con la real.
    var bracket = _resolveVisitedBracket(ef.predictions, ef.ko_predictions);
    var koRounds = _buildKoRounds(bracket.rs, bracket.vKo, ef.ko_real || {});
    var tabs = jornadas.concat(koRounds);

    var meId = window.currentUser && window.currentUser.id;
    var isMe = !!(meId && String(meId) === String(userId));
    var leagueName = (window._activeLeague && window._activeLeague.nombre) || '';
    return { user: { name: name, initials: _initials(name), user_id: userId, leagueName: leagueName, isMe: isMe }, rank: rank, totalPlayers: totalPlayers, jornadas: jornadas, koRounds: koRounds, tabs: tabs };
  }

  // ── Render ──
  function _jornadaPts(j) { return j.matches.filter(function (m) { return m.phase === 'final'; }).reduce(function (s, m) { return s + (m.pts || 0); }, 0); }

  function renderMatchCard(m) {
    var isFinal = m.phase === 'final', isLive = m.phase === 'live';
    var types = m.scoringTypes || [];
    var signo = (isFinal || isLive) ? (types.indexOf('win') !== -1 || types.indexOf('exact') !== -1) : false;
    var exact = types.indexOf('exact') !== -1;
    var gole = types.indexOf('gole') !== -1;
    var vsIA = types.indexOf('bonus') !== -1;

    var cls = ['up-match'];
    if (isFinal) cls.push((m.pts || 0) > 0 ? (exact ? 'k-exact' : 'k-sign') : 'k-fail');
    else if (isLive) cls.push('live');
    else cls.push('pre');

    var status = isFinal ? 'Final'
      : isLive ? '<span class="dot"></span>En vivo · ' + esc(m.time)
      : esc(m.time);

    var chip = function (label, on, gold) {
      return '<span class="up-chip' + (on ? ' on' : '') + (on && gold ? ' gold' : '') + '">' + label + '</span>';
    };
    var chipsHtml = (isFinal || isLive)
      ? '<div class="up-chips">' + chip('Signo +1', signo) + chip('vs IA +1', vsIA) + chip('⚽ Gol +2', gole) + chip('Exacto +3', exact, true) + '</div>'
      : '';

    var scorerHtml = m.scorer
      ? '<div class="up-scorer">⚽ Goleador: <b class="' + (isFinal && gole ? 'gol-ok' : '') + '">' + esc(m.scorer) + '</b>' + (isFinal && gole ? ' ✓' : '') + '</div>'
      : '';

    var foot;
    if (isFinal) foot = '<span class="up-foot__real">Resultado <b>' + m.real.h + SEP + m.real.a + '</b></span><span class="up-foot__pts">' + (m.pts || 0) + ' pts' + (m.boosted ? ' · ⚡×2' : '') + '</span>';
    else if (isLive) foot = '<span class="up-foot__real">En directo <b>' + m.live.h + SEP + m.live.a + '</b></span><span class="up-foot__pts">' + (m.pts || 0) + ' pts prov.</span>';
    else foot = '<span class="up-foot__real">Aún por jugar</span>';

    var predHtml = m.pred
      ? '<span class="up-pred__score">' + m.pred.h + '<span class="up-pred__sep">–</span>' + m.pred.a + '</span>'
      : '<span class="up-pred__score" style="color:var(--ink-500)">—<span class="up-pred__sep">–</span>—</span>';

    return '<div class="' + cls.join(' ') + '">' +
      '<div class="up-match__head"><span class="up-match__status">' + status + '</span>' + (m.boost ? '<span class="up-boost">⚡ Boost ×2</span>' : '') + '</div>' +
      '<div class="up-match__teams">' +
        '<div class="up-team up-team--home">' + flagImg(m.home.n, 'up-team__flag') + '<span class="up-team__code">' + esc(m.home.c) + '</span></div>' +
        '<div class="up-pred"><span class="up-pred__lbl">Pronóstico</span>' + predHtml + '</div>' +
        '<div class="up-team up-team--away"><span class="up-team__code">' + esc(m.away.c) + '</span>' + flagImg(m.away.n, 'up-team__flag') + '</div>' +
      '</div>' +
      scorerHtml + chipsHtml +
      '<div class="up-match__foot">' + foot + '</div>' +
    '</div>';
  }

  function _koTeamSide(side, code, name, resolved) {
    var flag = resolved ? flagImg(name, 'up-team__flag') : '<span class="up-team__flag up-team__flag--tbd"></span>';
    var codeHtml = '<span class="up-team__code' + (resolved ? '' : ' is-tbd') + '">' + esc(code) + '</span>';
    return side === 'home'
      ? '<div class="up-team up-team--home">' + flag + codeHtml + '</div>'
      : '<div class="up-team up-team--away">' + codeHtml + flag + '</div>';
  }

  function renderKoCard(c) {
    var isFinal = c.phase === 'final', isLive = c.phase === 'live';
    var cls = ['up-match', 'up-match--ko'];
    if (isFinal) cls.push((c.pts || 0) > 0 ? ((c.cruceMatch && c.exactOk) ? 'k-exact' : 'k-sign') : 'k-fail');
    else if (isLive) cls.push('live');
    else cls.push('pre');

    // "Finalizado" (no "Final": en KO se confunde con la ronda Final).
    var status = isFinal ? 'Finalizado'
      : isLive ? '<span class="dot"></span>En vivo' + (c.minute ? ' · ' + esc(c.minute) + '′' : '')
      : (c.when ? esc(c.when) : 'Por jugar');
    if (c.isThird) status = '3.º y 4.º · ' + status;

    var crossChip = c.crossKnown
      ? '<span class="up-ko-cross ' + (c.cruceMatch ? 'on' : 'off') + '">Cruce ' + (c.cruceMatch ? '✓' : '✗') + '</span>'
      : '';

    var predHtml = c.pred
      ? '<span class="up-pred__score">' + c.pred.l + '<span class="up-pred__sep">–</span>' + c.pred.v + '</span>'
      : '<span class="up-pred__score" style="color:var(--ink-500)">—<span class="up-pred__sep">–</span>—</span>';

    var scorerHtml = c.scorer
      ? '<div class="up-scorer">⚽ Goleador: <b class="' + (c.goleOk ? 'gol-ok' : '') + '">' + esc(c.scorer) + '</b>' + (c.goleOk ? ' ✓' : '') + '</div>'
      : '';

    // Clasificado: a quién pronosticó el jugador que pasa + a quién pasó en REAL.
    // La marca ✓/✗ solo cuando hay pick (no penalizar la ausencia de pronóstico).
    var advLbl = c.isThird ? 'Gana 3.º' : 'Pasa';
    var advMark = (c.realAdvName != null && c.predAdvName) ? (c.pasaMatch ? ' <span class="up-ko-ok">✓</span>' : ' <span class="up-ko-no">✗</span>') : '';
    var advReal = (c.realAdvName != null)
      ? ' <span class="up-ko-adv__real">· Real: <b>' + esc(c.realAdvName) + '</b></span>' + advMark
      : '';
    var advHtml = '<div class="up-ko-adv">' + advLbl + ': <b>' + (c.predAdvName ? esc(c.predAdvName) : '—') + '</b>' + advReal + '</div>';

    var chip = function (label, on, gold) {
      return '<span class="up-chip' + (on ? ' on' : '') + (on && gold ? ' gold' : '') + '">' + label + '</span>';
    };
    var chipsHtml = '';
    if (c.crossKnown && (isFinal || isLive)) {
      var inner = '';
      if (c.cruceMatch) inner += chip('Signo +1', c.signOk) + chip('⚽ Gol +2', c.goleOk) + chip('Exacto +3', c.exactOk, true);
      if (!c.isThird) inner += chip('Avance +' + c.advPts, c.pasaMatch);
      if (inner) chipsHtml = '<div class="up-chips">' + inner + '</div>';
    }

    var foot;
    if (isFinal) {
      var rc = (c.realHomeName && c.realAwayName)
        ? (esc(codeFor(c.realHomeName)) + ' <b>' + c.real.l + SEP + c.real.v + '</b> ' + esc(codeFor(c.realAwayName)))
        : ('<b>' + c.real.l + SEP + c.real.v + '</b>');
      foot = '<span class="up-foot__real">Real ' + rc + '</span><span class="up-foot__pts">' + (c.pts || 0) + ' pts</span>';
    } else if (isLive) {
      foot = '<span class="up-foot__real">En directo <b>' + c.real.l + SEP + c.real.v + '</b></span><span class="up-foot__pts">en juego</span>';
    } else if (c.crossKnown) {
      foot = '<span class="up-foot__real">Cruce real: ' + esc(c.realHomeName ? codeFor(c.realHomeName) : '?') + ' vs ' + esc(c.realAwayName ? codeFor(c.realAwayName) : '?') + '</span><span class="up-foot__pts">—</span>';
    } else {
      foot = '<span class="up-foot__real">Cruce por definir</span>';
    }

    return '<div class="' + cls.join(' ') + '">' +
      '<div class="up-match__head"><span class="up-match__status">' + status + '</span>' + crossChip + '</div>' +
      '<div class="up-match__teams">' +
        _koTeamSide('home', c.homeCode, c.homeName, c.homeResolved) +
        '<div class="up-pred"><span class="up-pred__lbl">Pronóstico</span>' + predHtml + '</div>' +
        _koTeamSide('away', c.awayCode, c.awayName, c.awayResolved) +
      '</div>' +
      scorerHtml + advHtml + chipsHtml +
      '<div class="up-match__foot">' + foot + '</div>' +
    '</div>';
  }

  function _nav(name) {
    return '<nav class="pc-nav"><button class="pc-nav__back" type="button" onclick="closePorraJugador()">' + CHEVRON + '<span>Predictor</span></button>' +
      '<div class="pc-nav__title">Porra de ' + esc(name) + '</div><div class="pc-nav__spacer"></div></nav>';
  }
  function _profile(name, isMe) {
    var lg = (window._activeLeague && window._activeLeague.nombre) || 'Liga';
    return '<div class="up-profile"><div class="up-avatar">' + esc(_initials(name)) + '</div>' +
      '<div class="up-id"><div class="up-id__name">' + esc(name) + '</div><div class="up-id__meta">' + esc(lg) + (isMe ? ' · <b>Tú</b>' : '') + '</div></div></div>';
  }

  function renderLoadingScreen(name) {
    return '<div class="pc-screen up-app"><div class="up-fixed">' + _nav(name) + _profile(name, false) + '</div>' +
      '<div class="up-scroll"><div class="pc-loading"><div class="pc-spinner"></div>Cargando porra…</div></div></div>';
  }
  function renderMsgScreen(name, msg, retryUid) {
    var retry = retryUid ? '<br><button class="pc-retry" type="button" onclick="openPorraJugador(\'' + retryUid + '\')">Reintentar</button>' : '';
    return '<div class="pc-screen up-app"><div class="up-fixed">' + _nav(name) + _profile(name, false) + '</div>' +
      '<div class="up-scroll"><div class="pc-body"><div class="pc-section__empty" style="padding:40px 0">' + esc(msg) + retry + '</div></div></div></div>';
  }

  function renderFullScreen(uc, active) {
    var allTabs = uc.tabs || uc.jornadas;
    var at = null;
    for (var i = 0; i < allTabs.length; i++) { if (allTabs[i].id === active) { at = allTabs[i]; break; } }
    if (!at) at = allTabs[0];

    // Totales de cabecera = grupos (final, con anti-IA) + KO disputado (marcador
    // + avance; anti-IA omitido). Incluir KO mantiene "Puntos torneo" coherente
    // según avanza la eliminatoria; el rank/posición sigue siendo autoritativo.
    var groupFinal = [];
    uc.jornadas.forEach(function (j) { j.matches.forEach(function (m) { if (m.phase === 'final') groupFinal.push(m); }); });
    var totalPts = groupFinal.reduce(function (s, m) { return s + (m.pts || 0); }, 0);
    var exactos = groupFinal.filter(function (m) { return (m.scoringTypes || []).indexOf('exact') !== -1; }).length;
    var settled = groupFinal.length;
    (uc.koRounds || []).forEach(function (r) { totalPts += r.pts || 0; exactos += r.exact || 0; settled += r.settled || 0; });

    var tabs = allTabs.map(function (t) {
      var sub = t.state === 'done' ? ((t.kind === 'ko' ? t.pts : _jornadaPts(t)) + ' pts') : t.state === 'live' ? 'en juego' : 'próx.';
      var koCls = t.kind === 'ko' ? ' up-tab--ko' : '';
      return '<button type="button" class="up-tab' + koCls + ' ' + t.state + (t.id === active ? ' active' : '') + '" onclick="porraJugadorSetJornada(\'' + t.id + '\')">' +
        '<span class="up-tab__t">' + esc(t.short) + '</span><span class="up-tab__s">' + esc(sub) + '</span></button>';
    }).join('');

    var headerHtml, bodyHtml;
    if (at.kind === 'ko') {
      var koStateLbl = at.state === 'done' ? 'Disputada' : at.state === 'live' ? 'En juego' : 'Por jugar';
      headerHtml = '<div class="up-jornada">' + esc(at.label) + ' <span>' + esc(at.sub) + ' · ' + koStateLbl + (at.settled ? ' · ' + at.pts + ' pts' : '') + '</span></div>';
      bodyHtml = '<div class="up-list">' + at.cards.map(renderKoCard).join('') + '</div>';
    } else {
      var atFinal = at.matches.filter(function (m) { return m.phase === 'final'; });
      var atPts = atFinal.reduce(function (s, m) { return s + (m.pts || 0); }, 0);
      headerHtml = '<div class="up-jornada">' + esc(at.label) + ' <span>' + esc(at.dates) + ' · ' + STATE_LABEL[at.state] + (atFinal.length ? ' · ' + atPts + ' pts' : '') + '</span></div>';
      bodyHtml = '<div class="up-list">' + at.matches.map(renderMatchCard).join('') + '</div>';
    }

    var rankNum = (uc.rank != null) ? '#' + uc.rank : '—';
    var rankLbl = (uc.totalPlayers != null) ? 'de ' + uc.totalPlayers + ' · liga' : 'liga';
    var footPos = (uc.rank != null) ? ' · posición #' + uc.rank : '';

    return '<div class="pc-screen up-app">' +
      '<div class="up-fixed">' +
        _nav(uc.user.name) + _profile(uc.user.name, uc.user.isMe) +
        '<div class="up-stats">' +
          '<div class="up-stat"><span class="up-stat__num"><b>' + totalPts + '</b></span><span class="up-stat__lbl">Puntos torneo</span></div>' +
          '<div class="up-stat"><span class="up-stat__num">' + rankNum + '</span><span class="up-stat__lbl">' + rankLbl + '</span></div>' +
          '<div class="up-stat"><span class="up-stat__num">' + exactos + '<small>/' + settled + '</small></span><span class="up-stat__lbl">Exactos</span></div>' +
        '</div>' +
        '<div class="up-tabs">' + tabs + '</div>' +
      '</div>' +
      '<div class="up-scroll"><div class="pc-body">' +
        headerHtml +
        bodyHtml +
      '</div></div>' +
      '<div class="pc-footer"><div class="pc-footer__l">' +
        '<div class="pc-footer__lbl">Total torneo' + footPos + '</div>' +
        '<div class="pc-footer__val"><b>' + totalPts + '</b> pts · ' + exactos + ' exactos</div>' +
      '</div></div>' +
    '</div>';
  }

  // ── Mount / unmount ──
  function hideOtherPages() {
    HIDE_IDS.forEach(function (id) {
      var el = document.getElementById(id);
      if (el && el.style.display !== 'none') { el.dataset.pjPrevDisplay = el.style.display || ''; el.style.display = 'none'; }
    });
  }
  function restoreOtherPages() {
    var back = document.getElementById(returnTo);
    if (back) { back.style.display = back.dataset.pjPrevDisplay || 'block'; delete back.dataset.pjPrevDisplay; }
  }
  function _paint(uid, html) {
    if (_currentUid !== uid) return;
    var w = document.getElementById(WRAP_ID);
    if (!w) return;
    w.innerHTML = html;
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function openPorraJugador(userId, hints) {
    if (!userId) { console.warn('[porra-jugador] userId vacío'); return; }
    _currentUid = userId;
    var visible = HIDE_IDS.find(function (id) { var el = document.getElementById(id); return el && el.style.display !== 'none'; });
    returnTo = visible || PAGE_PREDICTOR_ID;

    var name = (hints && hints.name) || 'Jugador';

    document.getElementById(WRAP_ID) && document.getElementById(WRAP_ID).remove();
    hideOtherPages();
    var wrap = document.createElement('div');
    wrap.id = WRAP_ID;
    document.body.appendChild(wrap);
    _paint(userId, renderLoadingScreen(name));

    var leagueId = PCS().activeLeagueId ? PCS().activeLeagueId() : (window._activeLeague && window._activeLeague.id);
    if (!leagueId) { _paint(userId, renderMsgScreen(name, 'Selecciona una liga para ver la porra.', null)); return; }

    PCS().invokeEF('get-user-predictions', { user_id: userId, league_id: leagueId })
      .then(function (ef) {
        if (_currentUid !== userId) return null;
        // Nombre autoritativo desde profiles (fallback al hint).
        return PCS().resolveNames([userId]).catch(function () { return {}; }).then(function (nm) {
          if (nm && nm[userId]) name = nm[userId];
          if (_currentUid !== userId) return;
          if (!ef) { _paint(userId, renderMsgScreen(name, 'Respuesta vacía del servidor.', userId)); return; }
          if (ef.gated) { _paint(userId, renderMsgScreen(name, 'Disponible tras el cierre de su porra.', null)); return; }
          var payload = buildPorra(ef, userId, hints, name);
          _state.userId = userId;
          _state.payload = payload;
          // Pestaña por defecto: la primera en juego (grupo o KO), si no la J1.
          var liveTab = (payload.tabs || payload.jornadas).find(function (t) { return t.state === 'live'; });
          _state.active = (liveTab || payload.jornadas[0] || { id: 'j1' }).id;
          _paint(userId, renderFullScreen(payload, _state.active));
        });
      })
      .catch(function (err) {
        console.error('[porra-jugador] invoke falló:', err);
        _paint(userId, renderMsgScreen(name, 'No se pudo cargar. Inténtalo de nuevo.', userId));
      });
  }

  function porraJugadorSetJornada(id) {
    if (!_state.payload) return;
    _state.active = id;
    var wrap = document.getElementById(WRAP_ID);
    if (wrap) {
      wrap.innerHTML = renderFullScreen(_state.payload, id);
      var sc = wrap.querySelector('.up-scroll'); if (sc) sc.scrollTop = 0;
    }
  }

  function closePorraJugador() {
    _currentUid = null;
    var prev = document.getElementById(WRAP_ID); if (prev) prev.remove();
    restoreOtherPages();
  }

  // ── Fila del ranking clicable (delegación document; sobrevive re-render) ──
  if (!document._pjRowDelegated) {
    document.addEventListener('click', function (e) {
      if (!e.target || !e.target.closest) return;
      if (e.target.closest('.pred-ranking-share')) return;
      // pred-ranking-row (ranking inline) + tf-row/tf-pod (clasificación del
      // trofeo del Predictor, F5.1) — mismo handler, sin duplicar lógica.
      var row = e.target.closest('.pred-ranking-row[data-pl-user], .tf-row[data-pl-user], .tf-pod[data-pl-user]');
      if (!row) return;
      var uid = row.getAttribute('data-pl-user');
      if (!uid) return;
      var rankAttr = row.getAttribute('data-pl-rank');
      var totalAttr = row.getAttribute('data-pl-total');
      openPorraJugador(uid, {
        name: row.getAttribute('data-pl-name') || '',
        rank: rankAttr ? parseInt(rankAttr, 10) : null,
        total: totalAttr ? parseInt(totalAttr, 10) : null,
      });
    });
    document._pjRowDelegated = true;
  }

  window.openPorraJugador = openPorraJugador;
  window.closePorraJugador = closePorraJugador;
  window.porraJugadorSetJornada = porraJugadorSetJornada;
})();
