/* ============================================================
 * comunidad-shared-v3.js
 * ------------------------------------------------------------
 * Helpers compartidos por las 2 pantallas de comunidad (grupos):
 *   · predicciones-liga-v3.js   (Screen 1)
 *   · porra-jugador-v3.js       (Screen 2)
 *
 * Expone window.PCShared:
 *   - Banderas: flagPath/codeFor/ISO3_TO_ISO2/flagImg (réplica de
 *     tarjeta-stats.js L35-68; NO toca las 3 copias existentes).
 *   - Display: esc/signOf/scoreLabel/fmt.
 *   - Backend (F5): queryDb()/activeLeagueId()/invokeEF()/resolveNames().
 *
 * Lee del estado global (data.js / auth.js / leagues.js): EQUIPOS, SB,
 * getQueryDb, window._activeLeague. Classic script vía loadScript →
 * IIFE + expose window.X (ERR-02).
 * ============================================================ */
(function () {
  'use strict';

  // Mapping ISO3->ISO2 alineado con bucket miniatures/flags-sm/<ISO2>.webp.
  const ISO3_TO_ISO2 = {
    MEX:'MX', RSA:'ZA', KOR:'KR', CZE:'CZ', CAN:'CA', BIH:'BA', QAT:'QA', SUI:'CH',
    BRA:'BR', MAR:'MA', HAI:'HT', SCO:'SC', USA:'US', PAR:'PY', AUS:'AU', TUR:'TR',
    GER:'DE', CUW:'CW', CIV:'CI', ECU:'EC', NED:'NL', JPN:'JP', SWE:'SE', TUN:'TN',
    BEL:'BE', EGY:'EG', IRN:'IR', NZL:'NZ', ESP:'ES', CPV:'CV', KSA:'SA', URU:'UY',
    FRA:'FR', SEN:'SN', IRQ:'IQ', NOR:'NO', ARG:'AR', ALG:'DZ', AUT:'AT', JOR:'JO',
    POR:'PT', COD:'CD', UZB:'UZ', COL:'CO', ENG:'EN', CRO:'HR', GHA:'GH', PAN:'PA'
  };

  function _equipos() { return (typeof EQUIPOS !== 'undefined') ? EQUIPOS : (window.EQUIPOS || []); }
  function _sb() { return (typeof SB !== 'undefined') ? SB : (window.SB || ''); }

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));

  function codeFor(teamName) {
    const e = _equipos().find((t) => t.name === teamName);
    return ((e && e.flag) || String(teamName || '').slice(0, 3)).toUpperCase();
  }
  function flagPath(teamName) {
    const iso3 = codeFor(teamName);
    const iso2 = ISO3_TO_ISO2[iso3] || iso3.slice(0, 2);
    return _sb() + '/miniatures/flags-sm/' + iso2 + '.webp';
  }
  function flagImg(teamName, spanClass) {
    return '<span class="' + esc(spanClass) + '">'
      + '<img src="' + esc(flagPath(teamName)) + '" alt="" loading="lazy" '
      + 'onerror="this.style.display=\'none\';this.parentNode.classList.add(\'is-broken\')">'
      + '</span>';
  }

  function signOf(h, a) { return h > a ? '1' : h < a ? '2' : 'X'; }
  function scoreLabel(h, a) { return h + '–' + a; }
  function fmt(n) { return Number(n || 0).toLocaleString('es-ES'); }

  // ── Backend (F5) ──────────────────────────────────────────
  // Cliente JWT authenticated (auth.js getQueryDb): adjunta el token del
  // usuario en functions.invoke / from(...). NO hacer fetch manual.
  function queryDb() {
    if (typeof getQueryDb === 'function') return getQueryDb();
    if (typeof window.getQueryDb === 'function') return window.getQueryDb();
    return window._porraDb || null;
  }

  // Liga activa canónica (la misma que usa predictor/ranking): in-memory
  // window._activeLeague.id (leagues.js); fallback getActiveLeagueId().
  function activeLeagueId() {
    if (window._activeLeague && window._activeLeague.id) return window._activeLeague.id;
    if (typeof getActiveLeagueId === 'function') { try { return getActiveLeagueId(); } catch (_e) { /* noop */ } }
    return null;
  }

  // Invoca una Edge Function. 200 → devuelve data. no-2xx → lanza Error con
  // el detalle del body (FunctionsHttpError → error.context.json()).
  async function invokeEF(name, body) {
    const db = queryDb();
    if (!db || !db.functions) throw new Error('sin cliente Supabase (queryDb)');
    const { data, error } = await db.functions.invoke(name, { body: body });
    if (error) {
      let detail = (error && error.message) || 'error';
      try {
        if (error.context && typeof error.context.json === 'function') {
          const b = await error.context.json();
          if (b && b.error) detail = b.error;
        }
      } catch (_e) { /* body no-JSON */ }
      const e = new Error('[' + name + '] ' + detail);
      e.efDetail = detail;
      throw e;
    }
    return data;
  }

  // Resuelve user_id → nombre en UNA query batch (profiles SELECT abierto).
  async function resolveNames(uids) {
    const uniq = Array.from(new Set((uids || []).filter(Boolean)));
    if (!uniq.length) return {};
    const db = queryDb();
    if (!db) return {};
    const { data, error } = await db.from('profiles').select('id, nombre').in('id', uniq);
    if (error) { console.warn('[comunidad] profiles batch:', error.message); return {}; }
    const map = {};
    for (const r of (data || [])) map[r.id] = r.nombre || '—';
    return map;
  }

  window.PCShared = {
    ISO3_TO_ISO2, esc, codeFor, flagPath, flagImg, signOf, scoreLabel, fmt,
    queryDb, activeLeagueId, invokeEF, resolveNames,
  };
})();
