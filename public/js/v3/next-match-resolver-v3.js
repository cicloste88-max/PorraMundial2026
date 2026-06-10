/* F1.1d · Resolver puro v3 — Date.now() + fixtures JSON → {state, match}.
   Procedencia: plan F1.1d + decision R5 (data.js PARTIDOS[].date OUT of scope —
   este resolver usa SOLO /data/worldcup-2026-matches.json con date_utc + "Z"
   sufijo para parseo UTC explícito).
   Sin DOM. Sin dependencias. Cache de sesión 1 fetch. Classic script (loadScript)
   — expone window.resolveNextMatchV3 / window.resolveDayMatchesV3 /
   window._loadNextMatchFixtures. */

(function () {
  'use strict';

  var FIXTURES_URL  = '/data/worldcup-2026-matches.json';
  var MATCH_DUR_MS  = 110 * 60 * 1000; // 90' + descansos + extras = ~110 min ventana "live".
  var _fixturesP    = null; // Promise singleton (cache de sesión).
  var _fixturesArr  = null; // Array ordenado por timestamp asc.

  function loadFixtures() {
    if (_fixturesP) return _fixturesP;
    _fixturesP = fetch(FIXTURES_URL, { cache: 'force-cache' })
      .then(function (r) {
        if (!r.ok) throw new Error('Fixtures HTTP ' + r.status);
        return r.json();
      })
      .then(function (obj) {
        // obj keyed por wc2026_g{X}_{id}. Normalizar a array ordenado por ts.
        var arr = Object.keys(obj).map(function (k) {
          var m = obj[k];
          // date_utc llega como "2026-06-11T19:00" (sin Z). Forzar UTC explícito.
          var iso = (m.date_utc || '').length === 16
            ? (m.date_utc + ':00Z')
            : (m.date_utc + 'Z');
          var ts = new Date(iso).getTime();
          return {
            key: k,
            sofascore_id: m.sofascore_id,
            group: m.group,
            round: m.round,
            home_en: m.home_en, away_en: m.away_en,
            home_es: m.home_es, away_es: m.away_es,
            teams_swapped: !!m.teams_swapped,
            date_utc_ms: ts
          };
        }).filter(function (m) { return !isNaN(m.date_utc_ms); })
          .sort(function (a, b) { return a.date_utc_ms - b.date_utc_ms; });
        _fixturesArr = arr;
        return arr;
      })
      .catch(function (err) {
        console.warn('[next-match-resolver-v3] fetch fallido:', err);
        _fixturesP = null; // permitir retry en próximo tick.
        _fixturesArr = null;
        return [];
      });
    return _fixturesP;
  }
  window._loadNextMatchFixtures = loadFixtures;

  function resolveSync(now) {
    if (!_fixturesArr || !_fixturesArr.length) return null;
    var n = typeof now === 'number' ? now : Date.now();
    var liveMatch = null;
    var nextMatch = null;

    for (var i = 0; i < _fixturesArr.length; i++) {
      var m = _fixturesArr[i];
      var start = m.date_utc_ms;
      var end   = start + MATCH_DUR_MS;
      if (n >= start && n < end) {
        liveMatch = m;
        break;
      }
      if (n < start) {
        nextMatch = m;
        break;
      }
    }

    if (liveMatch) return { state: 'live', match: liveMatch };
    if (nextMatch) return { state: 'next', match: nextMatch };
    return { state: 'post', match: null }; // torneo acabado
  }

  /** Public API: resolveNextMatchV3(now?) → {state:'pre'|'live'|'next'|'post', match}.
   *  - state 'pre' solo se devuelve antes de que cargue el JSON (caller decide UX).
   *  - lanza load lazy en primer call; siguientes son sync. */
  function resolveNextMatch(now) {
    if (!_fixturesArr) {
      loadFixtures(); // fire-and-forget — caller re-llama tras el primer fetch.
      return { state: 'pre', match: null };
    }
    return resolveSync(now);
  }
  window.resolveNextMatchV3 = resolveNextMatch;

  // ── Carrusel partidos del día (fifa-bar-day-carousel, 10-jun) ──────────
  var _madridDayFmt = null; // Cache de módulo — Intl.DateTimeFormat es caro de construir.

  function madridDay(ts) {
    // en-CA devuelve YYYY-MM-DD directamente; timeZone fija el día Madrid.
    if (!_madridDayFmt) {
      _madridDayFmt = new Intl.DateTimeFormat('en-CA', {
        timeZone: 'Europe/Madrid', year: 'numeric', month: '2-digit', day: '2-digit'
      });
    }
    return _madridDayFmt.format(new Date(ts));
  }

  /** Public API: resolveDayMatchesV3(now?) → {state, matches, dayLabel}.
   *  - state: 'pre' (fixtures sin cargar aún) | 'today' | 'upcoming' | 'post'.
   *  - matches: partidos del día NO terminados (fin = start + MATCH_DUR_MS),
   *    orden asc, cada uno con campo extra isLive.
   *  - dayLabel: YYYY-MM-DD Madrid del grupo devuelto (null en pre/post).
   *  Regla de producto (San 10-jun): los terminados desaparecen; si hoy no
   *  queda ninguno, se devuelven los del próximo día con partidos. */
  function resolveDayMatches(now) {
    if (!_fixturesArr) {
      loadFixtures(); // fire-and-forget — caller re-llama tras el primer fetch.
      return { state: 'pre', matches: [], dayLabel: null };
    }
    var n = typeof now === 'number' ? now : Date.now();

    var candidates = _fixturesArr.filter(function (m) {
      return (m.date_utc_ms + MATCH_DUR_MS) > n; // no terminados (ya orden asc).
    });
    if (!candidates.length) return { state: 'post', matches: [], dayLabel: null };

    function withIsLive(m) {
      var copy = {};
      for (var k in m) { if (Object.prototype.hasOwnProperty.call(m, k)) copy[k] = m[k]; }
      copy.isLive = n >= m.date_utc_ms && n < (m.date_utc_ms + MATCH_DUR_MS);
      return copy;
    }

    var today = madridDay(n);
    var todays = candidates.filter(function (m) { return madridDay(m.date_utc_ms) === today; });
    if (todays.length) {
      return { state: 'today', matches: todays.map(withIsLive), dayLabel: today };
    }

    var nextDay = madridDay(candidates[0].date_utc_ms);
    var nexts = candidates.filter(function (m) { return madridDay(m.date_utc_ms) === nextDay; });
    return { state: 'upcoming', matches: nexts.map(withIsLive), dayLabel: nextDay };
  }
  window.resolveDayMatchesV3 = resolveDayMatches;

  // Pre-warm en el primer tick del event loop — el shell-v3 ya llama sync
  // pero esto deja la promesa lista antes del primer setInterval(1s).
  if (typeof window !== 'undefined') {
    loadFixtures();
  }
})();
