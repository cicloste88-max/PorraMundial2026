/* ============================================================
 * comunidad-shared-v3.js
 * ────────────────────────────────────────────────────────────
 * Helpers compartidos por las 2 pantallas de comunidad (grupos):
 *   · predicciones-liga-v3.js   (Screen 1)
 *   · porra-jugador-v3.js       (Screen 2)
 *
 * Expone window.PCShared con el patrón flagPath del proyecto
 * (réplica de tarjeta-stats.js L35-68 / ui-groups.js) para no
 * crear una copia por pantalla. NO toca las copias existentes de
 * tarjeta-stats/ui-groups/ui-directo (cleanup aparte).
 *
 * Lee del estado global (data.js): EQUIPOS, SB.
 * Classic script vía loadScript → IIFE + expose window.X (ERR-02).
 * ============================================================ */
(function () {
  'use strict';

  // Mapping ISO3→ISO2 alineado con bucket miniatures/flags-sm/<ISO2>.webp.
  // Sincronizado con tarjeta-stats.js / ui-groups.js / ui-directo.js.
  const ISO3_TO_ISO2 = {
    MEX:'MX', RSA:'ZA', KOR:'KR', CZE:'CZ', CAN:'CA', BIH:'BA', QAT:'QA', SUI:'CH',
    BRA:'BR', MAR:'MA', HAI:'HT', SCO:'SC', USA:'US', PAR:'PY', AUS:'AU', TUR:'TR',
    GER:'DE', CUW:'CW', CIV:'CI', ECU:'EC', NED:'NL', JPN:'JP', SWE:'SE', TUN:'TN',
    BEL:'BE', EGY:'EG', IRN:'IR', NZL:'NZ', ESP:'ES', CPV:'CV', KSA:'SA', URU:'UY',
    FRA:'FR', SEN:'SN', IRQ:'IQ', NOR:'NO', ARG:'AR', ALG:'DZ', AUT:'AT', JOR:'JO',
    POR:'PT', COD:'CD', UZB:'UZ', COL:'CO', ENG:'EN', CRO:'HR', GHA:'GH', PAN:'PA'
  };

  // Acceso seguro a globals (const top-level NO se expone como window.X).
  function _equipos() { return (typeof EQUIPOS !== 'undefined') ? EQUIPOS : (window.EQUIPOS || []); }
  function _sb() { return (typeof SB !== 'undefined') ? SB : (window.SB || ''); }

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => (
    { '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' }[c]
  ));

  // Código ISO3 (flag) desde EQUIPOS por nombre de equipo.
  function codeFor(teamName) {
    const e = _equipos().find((t) => t.name === teamName);
    return ((e && e.flag) || String(teamName || '').slice(0, 3)).toUpperCase();
  }

  // SB + '/miniatures/flags-sm/' + iso2 + '.webp'
  function flagPath(teamName) {
    const iso3 = codeFor(teamName);
    const iso2 = ISO3_TO_ISO2[iso3] || iso3.slice(0, 2);
    return _sb() + '/miniatures/flags-sm/' + iso2 + '.webp';
  }

  // Markup de bandera: <span class="<spanClass>"><img …onerror→is-broken></span>.
  // Patrón badge-with-flag-fallback (CLAUDE.md): si la imagen falla, el span
  // queda como círculo neutro vía .is-broken.
  function flagImg(teamName, spanClass) {
    return '<span class="' + esc(spanClass) + '">'
      + '<img src="' + esc(flagPath(teamName)) + '" alt="" loading="lazy" '
      + 'onerror="this.style.display=\'none\';this.parentNode.classList.add(\'is-broken\')">'
      + '</span>';
  }

  // Display helpers (puros — NO motor de puntuación; ese es scoring.js).
  function signOf(h, a) { return h > a ? '1' : h < a ? '2' : 'X'; }
  function scoreLabel(h, a) { return h + '–' + a; }            // n–n (en dash)
  function fmt(n) { return Number(n || 0).toLocaleString('es-ES'); }

  window.PCShared = {
    ISO3_TO_ISO2,
    esc,
    codeFor,
    flagPath,
    flagImg,
    signOf,
    scoreLabel,
    fmt,
  };
})();
