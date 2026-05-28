// match-stats.js — provee window.fetchMatchStats(matchKey)
//
// Cliente para la EF `get-match-stats` (Supabase, verify_jwt=false con validación
// manual del JWT para myPick). Devuelve el payload tal cual lo emite la EF y
// que tarjeta-stats.js consume:
//   { home_iso, away_iso,
//     form: {a,b}, stats: {fifaRank, goalsFor, goalsAg, possession, winRate, avgAge, value},
//     h2h: { aWins, draws, bWins, last: [{date, comp, scoreA, scoreB}] } | null,
//     h2h_status: 'never_played' | 'has_detail' | 'aggregates_only',
//     league: { total, pct1, pctX, pct2, myPick, topScore },
//     meta: { possession_placeholder: true, generated_at } }
//
// Auth: Bearer JWT si hay sesión (para myPick); fallback ANON si no.
// Cache LRU TTL 5min.

(function () {
  'use strict';

  const cache = new Map();
  const TTL_MS = 5 * 60 * 1000;

  function _jwt() {
    if (window._porraToken) return window._porraToken;
    try { return sessionStorage.getItem('porra_token') || null; } catch (_) { return null; }
  }

  function _efUrl(matchKey) {
    const base = window._supa_url || 'https://cmyfyswystjgzdwbqyyb.supabase.co';
    return base + '/functions/v1/get-match-stats?match_key=' + encodeURIComponent(matchKey);
  }

  window.fetchMatchStats = async function (matchKey) {
    if (!matchKey) return null;

    const cached = cache.get(matchKey);
    if (cached && Date.now() - cached.ts < TTL_MS) return cached.data;

    const anon = window._supa_anon;
    if (!anon) {
      console.warn('[match-stats] window._supa_anon no disponible — auth.js no cargado todavía.');
      return null;
    }
    const jwt = _jwt();

    try {
      const res = await fetch(_efUrl(matchKey), {
        headers: {
          'apikey': anon,
          'Authorization': 'Bearer ' + (jwt || anon),
        },
      });
      if (!res.ok) {
        console.warn('[match-stats] HTTP', res.status, 'para', matchKey);
        return null;
      }
      const data = await res.json();
      if (data && !data.error) cache.set(matchKey, { data, ts: Date.now() });
      return data && !data.error ? data : null;
    } catch (err) {
      console.error('[match-stats] fetch falló:', err);
      return null;
    }
  };
})();
