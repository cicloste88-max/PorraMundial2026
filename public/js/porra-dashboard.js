/* porra-dashboard.js — Dashboard de la porra (vista por jugador).
 *
 * Versión adaptada del pack original (San, Claude.ai 30-jun-2026): los datos
 * estáticos `window.PORRA.DATA` se sustituyen por fetches LAZY a las EFs
 * `get-league-standings` (lista + totales) y `get-dashboard` (detalle por
 * jugador). FLAG/ISO_TO_ES/LEAGUE_* se inicializan al primer mount desde
 * EQUIPOS (data.js) + ISO3_TO_FLAG (ui-globo-equipos.js).
 *
 * Expone `window.mountPorra(root, opts)`:
 *   opts.league      — league_id (string) a mostrar. lockLeague=true asume
 *                      que es la liga del usuario logado.
 *   opts.lockLeague  — bool. Si true muestra la "league lock chip" en vez
 *                      de los tabs Gallos/Tilín (preview no-locked).
 *   opts.openGroups  — bool. Si true los <details> de jornadas se abren.
 *   opts.onBack      — fn. Si está definida, renderiza un botón "Predictor"
 *                      arriba a la izquierda que la invoca.
 *
 * Carga lazy desde ui-nav.js::showPage('dashboard'). NO usa DOMContentLoaded
 * (ERR-01) — al cargarse el script se ejecuta su IIFE y expone mountPorra.
 *
 * Deps runtime: window.db (Supabase client desde auth.js), window.EQUIPOS
 * (data.js), window.ISO3_TO_FLAG (ui-globo-equipos.js) — todos ya cargados
 * cuando llegamos al click en el botón Dashboard del Predictor.
 */
(function () {
  // ─────────────────────────────────────────────────────────────
  // Catálogos estáticos (inicializados perezosamente al primer mount).
  // ─────────────────────────────────────────────────────────────
  let FLAG = null;        // { es_name → emoji bandera }
  let ISO_TO_ES = null;   // { iso3 → es_name }
  let ES_TO_ISO = null;   // { es_name → iso3 } (inverso, para qh/qm si necesario)

  // ISO3 → emoji bandera (espejo de ui-globo-equipos.js::ISO3_TO_FLAG).
  // INLINED a propósito: el original vive dentro de un IIFE en
  // ui-globo-equipos.js (var dentro de `(function () { ... })()`) — NO está
  // expuesto en window (ERR-02). Replicado aquí para no acoplar a un módulo
  // que tendría que romper su encapsulación. Si añades países al
  // calendario, sincroniza ambas tablas.
  const ISO3_FLAGS = {
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
    'TUR': '🇹🇷', 'SWE': '🇸🇪', 'COD': '🇨🇩',
    'KAZ': '🇰🇿', 'ANG': '🇦🇴',
  };

  // EQUIPOS / db / getActiveLeagueId viven en classic scripts (data.js,
  // auth.js, leagues.js) que comparten el global lexical environment de
  // los scripts clásicos. Las declaraciones top-level `const` NO se exponen
  // en `window` (ERR-02), pero SÍ son visibles a través del scope chain
  // desde este IIFE. Helpers con guard `typeof` (espejo de
  // porra-jugador-v3.js::_equipos:35).
  function _equipos() {
    try { return (typeof EQUIPOS !== 'undefined') ? EQUIPOS : (window.EQUIPOS || []); }
    catch (_) { return (typeof window !== 'undefined' && window.EQUIPOS) || []; }
  }
  function _db() {
    try { return (typeof db !== 'undefined') ? db : (window.db || null); }
    catch (_) { return (typeof window !== 'undefined' && window.db) || null; }
  }
  function _getActiveLeagueId() {
    try {
      if (typeof getActiveLeagueId === 'function') return getActiveLeagueId();
      if (typeof window !== 'undefined' && typeof window.getActiveLeagueId === 'function') return window.getActiveLeagueId();
    } catch (_) {}
    return null;
  }
  function _activeLeague() {
    try {
      if (typeof window !== 'undefined' && window._activeLeague) return window._activeLeague;
    } catch (_) {}
    return null;
  }

  function _initCatalogs() {
    if (FLAG && ISO_TO_ES) return;
    FLAG = {};
    ISO_TO_ES = {};
    ES_TO_ISO = {};
    const equipos = _equipos();
    for (const e of equipos) {
      if (!e || !e.name || !e.flag) continue;
      ISO_TO_ES[e.flag] = e.name;
      ES_TO_ISO[e.name] = e.flag;
      if (ISO3_FLAGS[e.flag]) FLAG[e.name] = ISO3_FLAGS[e.flag];
    }
    // Fallback: ISO3 → emoji directo si entra una key iso3 en flagFor.
    for (const iso of Object.keys(ISO3_FLAGS)) {
      if (!FLAG[iso]) FLAG[iso] = ISO3_FLAGS[iso];
    }
  }

  // Icono de liga: solo los 2 canónicos están mapeados; cualquier otra
  // liga futura cae al icono genérico 🏆. El NOMBRE viene en vivo de
  // `get-league-standings` v1.7.0 (campo `leagueName`), así no
  // mantenemos un catálogo estático que se quede desincronizado.
  const LEAGUE_ICON = {
    'b735a3c0': '🐓',
    'd5cb4dd6': '🔔',
  };
  function leagueIconFor(id) { return LEAGUE_ICON[id] || '🏆'; }

  // Rondas KO en orden cronológico + etiquetas legibles. El render agrupa
  // u.kr por `rd` y emite UNA sección por ronda con filas (puro forward-
  // ready: R16+ aparecerán automáticamente cuando los slots se siembren).
  // 'third' va antes de 'final' por orden de partido (el 3er puesto se
  // disputa antes de la Final). KO_ROUND_PTS.third no da avance, por
  // diseño del motor — la sección sí se muestra cuando hay slot resuelto.
  const KO_ROUND_ORDER = ['r32', 'r16', 'qf', 'sf', 'third', 'final'];
  const KO_ROUND_LABEL = {
    r32:   'R32',
    r16:   'Octavos',
    qf:    'Cuartos',
    sf:    'Semifinales',
    third: '3er puesto',
    final: 'Final',
  };

  // ─────────────────────────────────────────────────────────────
  // Estado del mount actual + opts.
  // ─────────────────────────────────────────────────────────────
  let OPTS = { league: null, openGroups: false, lockLeague: false, onBack: null };

  // ─────────────────────────────────────────────────────────────
  // Helpers de render (puros).
  // ─────────────────────────────────────────────────────────────
  function flagFor(es) { return (FLAG && FLAG[es]) || '🏳️'; }
  function flagIso(iso) { return flagFor((ISO_TO_ES && ISO_TO_ES[iso]) || ''); }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c];
    });
  }
  function parseMatch(id) {
    const m = String(id || '').match(/^([A-L])_(.+?)_(.+)$/);
    return m ? { grp: m[1], home: m[2], away: m[3] } : null;
  }

  function statusBadge(r) {
    if (r.ex && r.go) return '<span class="badge badge--exact-gol">EXACTO + GOL</span>';
    if (r.ex) return '<span class="badge badge--exact">EXACTO</span>';
    if (r.si && r.go) return '<span class="badge badge--sign-gol">SIGNO + GOL</span>';
    if (r.si) return '<span class="badge badge--sign">SIGNO</span>';
    if (r.go) return '<span class="badge badge--gol">GOL</span>';
    return '<span class="badge badge--miss">FALLO</span>';
  }
  function ptsClass(p) { return p === 0 ? 'pts--zero' : p >= 4 ? 'pts--high' : 'pts--mid'; }

  function matchCard(r) {
    const m = parseMatch(r.m);
    const fh = m ? flagFor(m.home) : '';
    const fa = m ? flagFor(m.away) : '';
    const realList = (r.rg || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    const realHtml = realList.length
      ? realList.map(function (s) { return '<span class="pill">' + esc(s) + '</span>'; }).join('')
      : '<span class="pill pill--mute">sin goles</span>';
    const cls = ptsClass(r.p);
    const mods = [];
    if (r.b) mods.push('<span class="mod mod--boost">⚡ Boost</span>');
    if (r.ib) mods.push('<span class="mod mod--ia">🤖 anti-IA +1</span>');
    const signCls = (r.pSg === r.rSg) ? 'score--ok' : 'score--no';
    return ''
      + '<details class="match" data-pts="' + r.p + '" data-boost="' + (r.b ? 1 : 0) + '" data-ia="' + (r.ib ? 1 : 0) + '">'
      +   '<summary>'
      +     '<div class="match__line">'
      +       '<span class="match__grp">[' + esc(m ? m.grp : '?') + ']</span>'
      +       '<span class="match__team match__team--home"><span class="flag">' + fh + '</span>' + esc(m ? m.home : '') + '</span>'
      +       '<span class="match__score">'
      +         '<span class="score score--pred ' + signCls + '">' + esc(r.ps) + '</span>'
      +         '<span class="arrow">→</span>'
      +         '<span class="score score--real">' + esc(r.rs) + '</span>'
      +       '</span>'
      +       '<span class="match__team match__team--away"><span class="flag">' + fa + '</span>' + esc(m ? m.away : '') + '</span>'
      +       statusBadge(r)
      +       '<span class="pts ' + cls + '">' + r.p + '</span>'
      +     '</div>'
      +   '</summary>'
      +   '<div class="match__detail">'
      +     '<div class="kv">'
      +       '<div class="kv__row"><span class="kv__k">Signo pred / real</span>'
      +         '<span class="kv__v">' + esc(r.pSg) + ' ' + (r.si ? '✅' : '❌') + ' ' + esc(r.rSg) + '</span></div>'
      +       '<div class="kv__row"><span class="kv__k">Exacto</span>'
      +         '<span class="kv__v">' + (r.ex ? '✅ sí' : '❌ no') + '</span></div>'
      +       '<div class="kv__row"><span class="kv__k">Goleador predicho</span>'
      +         '<span class="kv__v">' + esc(r.pg) + ' ' + (r.go ? '✅' : '❌') + '</span></div>'
      +       '<div class="kv__row"><span class="kv__k">Goleadores reales</span>'
      +         '<span class="kv__v scorers">' + realHtml + '</span></div>'
      +       '<div class="kv__row"><span class="kv__k">IA dijo</span>'
      +         '<span class="kv__v">' + esc(r.ia || '—') + ' · ' + (r.ib ? '<strong>+1 anti-IA aplicado</strong>' : (r.ia === r.pSg ? '(coincide)' : '(no aplica)')) + '</span></div>'
      +       '<div class="kv__row"><span class="kv__k">Modificadores</span>'
      +         '<span class="kv__v">' + (mods.length ? mods.join(' ') : '—') + '</span></div>'
      +       '<div class="kv__row kv__row--total"><span class="kv__k">Puntos</span>'
      +         '<span class="kv__v"><strong class="' + cls + '">' + r.p + ' pts</strong></span></div>'
      +     '</div>'
      +   '</div>'
      + '</details>';
  }

  function koSlotCard(r) {
    const ph = (r.pc || '').split(' vs ');
    const rh = (r.rc || '').split(' vs ');
    const predHome = (ph[0] || '').trim() || '?';
    const predAway = (ph[1] || '').trim() || '?';
    const realHomeISO = (rh[0] || '').trim();
    const realAwayISO = (rh[1] || '').trim();
    const realHome = (ISO_TO_ES && ISO_TO_ES[realHomeISO]) || realHomeISO || '?';
    const realAway = (ISO_TO_ES && ISO_TO_ES[realAwayISO]) || realAwayISO || '?';
    const cls = r.p === 0 ? 'pts--zero' : r.p >= 10 ? 'pts--high' : 'pts--mid';
    const realList = (r.rg || '').split(',').map(function (s) { return s.trim(); }).filter(Boolean);
    const realHtml = realList.length
      ? realList.map(function (s) { return '<span class="pill">' + esc(s) + '</span>'; }).join('')
      : '<span class="pill pill--mute">sin goles</span>';
    const bdRows = [];
    if (r.se) {
      bdRows.push(['Cruce de equipos', '✅ coincide → marcador habilitado', null]);
      bdRows.push(['Signo predicho / real', esc(r.pSg) + ' ' + (r.ko_si ? '✅' : '❌') + ' ' + esc(r.rSg), r.ko_si ? '+1' : '0']);
      bdRows.push(['Exacto', esc(r.ops || r.ps) + ' vs ' + esc(r.rs) + ' → ' + (r.ko_ex ? '✅' : '❌'), r.ko_ex ? '+3' : '0']);
      bdRows.push(['Goleador predicho', esc(r.pg) + ' ' + (r.ko_go ? '✅' : '❌'), r.ko_go ? '+2' : '0']);
      bdRows.push(['Marcador (cap 7, sin boost en KO)', '—', '<strong>' + r.pm + '</strong>']);
    } else {
      bdRows.push(['Cruce de equipos', '❌ no coincide → marcador 0', '0']);
      bdRows.push(['Marcador (gate fallado)', 'No se evalúa signo/exacto/goleador', '0']);
    }
    bdRows.push(['Avance (clasificador)',
      'pred \'' + esc(r.cl || '—') + '\' / real \'' + esc((ISO_TO_ES && ISO_TO_ES[r.ra]) || r.ra || '—') + '\' → ' + (r.ao ? '✅' : '❌'),
      r.ao ? '+' + r.rpts : '0']);
    const bdHtml = bdRows.map(function (kvp) {
      const k = kvp[0], v = kvp[1], p = kvp[2];
      return '<div class="kv__row"><span class="kv__k">' + esc(k) + '</span>'
        + '<span class="kv__v">' + v + (p !== null ? ' <span class="pts-mini">' + p + '</span>' : '') + '</span></div>';
    }).join('');
    const ps = String(r.ps || '').split('-');
    const psHome = ps[0] || '?';
    const psAway = ps[1] || '?';
    const rs = String(r.rs || '').split('-');
    const rsHome = rs[0] || '?';
    const rsAway = rs[1] || '?';
    return ''
      + '<details class="match" data-pts="' + r.p + '">'
      +   '<summary>'
      +     '<div class="match__line match__line--ko">'
      +       '<span class="match__grp">' + esc(String(r.m)) + '·' + esc(r.rd) + '</span>'
      +       '<span class="match__score">'
      +         '<span class="score">' + esc(r.ps) + '</span><span class="arrow">→</span><span class="score">' + esc(r.rs) + '</span>'
      +       '</span>'
      +       '<span class="badge ' + (r.se ? 'badge--exact' : 'badge--miss') + '">' + (r.se ? 'CRUCE ✓' : 'CRUCE ✗') + '</span>'
      +       '<span class="badge ' + (r.ao ? 'badge--sign-gol' : 'badge--miss') + '">' + (r.ao ? 'AVANCE +' + r.rpts : 'AVANCE ✗') + '</span>'
      +       '<span class="pts ' + cls + '">' + r.p + '</span>'
      +     '</div>'
      +   '</summary>'
      +   '<div class="match__detail">'
      +     '<div class="ko-vs">'
      +       '<div class="ko-vs__col">'
      +         '<h4>Predicho</h4>'
      +         '<p>' + flagFor(predHome) + ' ' + esc(predHome) + ' <strong>' + esc(psHome) + '</strong></p>'
      +         '<p>' + flagFor(predAway) + ' ' + esc(predAway) + ' <strong>' + esc(psAway) + '</strong></p>'
      +         '<p>Goleador: <strong>' + esc(r.pg) + '</strong></p>'
      +         '<p class="adv">Clasifica → <strong>' + esc(r.cl || '—') + '</strong></p>'
      +       '</div>'
      +       '<div class="ko-vs__col ko-vs__col--real">'
      +         '<h4>Real</h4>'
      +         '<p>' + flagFor(realHome) + ' ' + esc(realHome) + ' <strong>' + esc(rsHome) + '</strong></p>'
      +         '<p>' + flagFor(realAway) + ' ' + esc(realAway) + ' <strong>' + esc(rsAway) + '</strong></p>'
      +         '<p>Goleadores: <span class="scorers" style="display:inline-flex">' + realHtml + '</span></p>'
      +         '<p class="adv">Avanza → <strong>' + flagIso(r.ra) + ' ' + esc((ISO_TO_ES && ISO_TO_ES[r.ra]) || r.ra || '—') + '</strong></p>'
      +       '</div>'
      +     '</div>'
      +     '<div class="kv" style="margin-top:10px">'
      +       bdHtml
      +       '<div class="kv__row kv__row--subtotal">'
      +         '<span class="kv__k">Subtotal marcador + avance</span>'
      +         '<span class="kv__v"><strong>' + r.pm + ' + ' + r.pa + ' = ' + r.p + ' pts</strong></span>'
      +       '</div>'
      +     '</div>'
      +   '</div>'
      + '</details>';
  }

  function bracketSlot(s) {
    if (!s) return '<span class="muted">—</span>';
    return flagFor(s.home) + ' ' + esc(s.home || '?') + ' <span class="vs">vs</span> '
      + flagFor(s.away) + ' ' + esc(s.away || '?') + ' → <strong>' + flagFor(s.winner) + ' ' + esc(s.winner || '?') + '</strong>';
  }

  function renderUser(root, u, leagueListSorted) {
    // leagueListSorted: array de standings filas {uid, total} ordenadas desc.
    // El render original calcula rankInLeague de DATA — aquí lo recibimos del
    // payload de get-league-standings para evitar refetch.
    const rankInLeague = leagueListSorted.findIndex(function (x) { return x.uid === u.ui; }) + 1;
    const totalInLeague = leagueListSorted.length;

    // Agrupa u.kr por ronda KO; el render emite UNA sección por cada ronda
    // que tenga al menos una fila. Forward-ready: R16/QF/SF/3er/Final
    // aparecerán automáticamente cuando los slots se siembren.
    const koByRound = { r32: [], r16: [], qf: [], sf: [], third: [], final: [] };
    for (let i = 0; i < (u.kr || []).length; i++) {
      const k = u.kr[i];
      if (koByRound[k.rd]) koByRound[k.rd].push(k);
    }
    // Cumulative KO pts por ronda (orden cronológico) para los hitos de la
    // sección Evolución — el usuario ve cómo crece su puntuación a medida
    // que avanza el torneo.
    const koCum = {};
    let _running = 0;
    for (const rd of KO_ROUND_ORDER) {
      _running += koByRound[rd].reduce(function (s, k) { return s + (k.p || 0); }, 0);
      koCum[rd] = _running;
    }
    const koGrandTotal = _running; // total KO sin podio ni qp (suma de kr[].p)

    // Hitos de evolución: grupos → bonus clasificados → fin de cada ronda KO
    // que ya tenga al menos un slot resuelto → premios (si > 0). El total
    // final del último hito === u.t.
    const milestones = [
      ['Fin J1 grupos', u.br['1'] || 0],
      ['Fin J2 grupos', (u.br['1'] || 0) + (u.br['2'] || 0)],
      ['Fin grupos', u.g],
      ['+ Clasificados', (u.g || 0) + (u.qp || 0)],
    ];
    let _evoCum = (u.g || 0) + (u.qp || 0);
    for (const rd of KO_ROUND_ORDER) {
      const rounSum = koByRound[rd].reduce(function (s, k) { return s + (k.p || 0); }, 0);
      if (rounSum > 0) {
        _evoCum += rounSum;
        milestones.push(['Tras ' + KO_ROUND_LABEL[rd], _evoCum]);
      }
    }
    if ((u.a || 0) > 0) milestones.push(['+ Premios', u.t]);
    const max = milestones.length
      ? milestones[milestones.length - 1][1]
      : (u.t || 1);

    const grpByRound = { 1: [], 2: [], 3: [] };
    for (let i = 0; i < (u.gr || []).length; i++) {
      const r = u.gr[i];
      if (grpByRound[r.r]) grpByRound[r.r].push(r);
    }
    for (let j = 1; j <= 3; j++) grpByRound[j].sort(function (a, b) { return b.p - a.p; });

    const html = ''
      + '<div class="pd-hero">'
      +   '<div class="pd-profile">'
      +     '<div class="pd-avatar">' + leagueIconFor(u.l) + '</div>'
      +     '<div class="pd-id">'
      +       '<div class="pd-id__name">' + esc(u.u) + '</div>'
      +       '<div class="pd-id__meta">' + esc(u.ln || '') + '</div>'
      +     '</div>'
      +     '<div class="pd-rank">#' + rankInLeague + '<small>/' + totalInLeague + '</small></div>'
      +   '</div>'
      +   '<div class="pd-total">'
      +     '<span class="pd-total__big">' + u.t + '</span>'
      +     '<span class="pd-total__lbl">pts totales</span>'
      +     '<span class="pd-total__delta">Caché ' + u.cached + ' · Δ ' + (u.t - u.cached) + ' ' + (u.t === u.cached ? '✓' : '⚠') + '</span>'
      +   '</div>'
      +   '<div class="pd-kpis">'
      +     '<div class="pd-kpi"><div class="pd-kpi__lbl">Grupos</div><div class="pd-kpi__val">' + u.g + '</div><div class="pd-kpi__sub">J1 ' + (u.br['1'] || 0) + ' · J2 ' + (u.br['2'] || 0) + ' · J3 ' + (u.br['3'] || 0) + '</div></div>'
      +     '<div class="pd-kpi"><div class="pd-kpi__lbl">KO</div><div class="pd-kpi__val">' + u.k + '</div><div class="pd-kpi__sub">' + (u.qh || []).length + '/32 clasif (+' + (u.qp || 0) + ') · ' + koGrandTotal + ' rondas</div></div>'
      +     '<div class="pd-kpi"><div class="pd-kpi__lbl">Premios</div><div class="pd-kpi__val">' + u.a + '</div><div class="pd-kpi__sub">' + ((u.a || 0) > 0 ? 'resueltos' : 'pdte.') + '</div></div>'
      +     '<div class="pd-kpi"><div class="pd-kpi__lbl">Boosts</div><div class="pd-kpi__val">' + (u.bo || 0) + '</div><div class="pd-kpi__sub">activados</div></div>'
      +   '</div>'
      + '</div>'

      + '<details class="section-collapsible" open>'
      +   '<summary><h2>Evolución <span class="pts-tot">' + u.t + ' pts</span></h2></summary>'
      +   '<div class="evo">'
      +     milestones.map(function (kv) {
            const lbl = kv[0], v = kv[1];
            const pct = (v / Math.max(max, 1) * 100).toFixed(1);
            return '<div class="evo-row">'
              + '<span class="evo-lbl">' + esc(lbl) + '</span>'
              + '<div class="evo-bar"><div class="evo-bar-fill" style="width:' + pct + '%"></div></div>'
              + '<span class="evo-val">' + v + '</span>'
              + '</div>';
          }).join('')
      +   '</div>'
      + '</details>'

      + '<details class="section-collapsible">'
      +   '<summary><h2>Bracket reconstruido</h2></summary>'
      +   '<div class="bracket">'
      +     '<div class="bracket-row"><span class="bracket-row__lbl">SF1 · 101</span><span>' + bracketSlot(u.bs && u.bs['101']) + '</span></div>'
      +     '<div class="bracket-row"><span class="bracket-row__lbl">SF2 · 102</span><span>' + bracketSlot(u.bs && u.bs['102']) + '</span></div>'
      +     '<div class="bracket-row"><span class="bracket-row__lbl">3.º · 103</span><span>' + bracketSlot(u.bs && u.bs['103']) + '</span></div>'
      +     '<div class="bracket-row bracket-row--final"><span class="bracket-row__lbl">FINAL · 104</span><span>' + bracketSlot(u.bs && u.bs['104']) + '</span></div>'
      +   '</div>'
      +   '<div class="podium">'
      +     '<div class="podium-card"><div class="podium-card__pos">🥇</div><div class="podium-card__flag">' + flagFor(u.bp && u.bp.champion) + '</div><div class="podium-card__team">' + esc((u.bp && u.bp.champion) || '—') + '</div></div>'
      +     '<div class="podium-card"><div class="podium-card__pos">🥈</div><div class="podium-card__flag">' + flagFor(u.bp && u.bp.runnerUp) + '</div><div class="podium-card__team">' + esc((u.bp && u.bp.runnerUp) || '—') + '</div></div>'
      +     '<div class="podium-card"><div class="podium-card__pos">🥉</div><div class="podium-card__flag">' + flagFor(u.bp && u.bp.third) + '</div><div class="podium-card__team">' + esc((u.bp && u.bp.third) || '—') + '</div></div>'
      +     '<div class="podium-card"><div class="podium-card__pos">4º</div><div class="podium-card__flag">' + flagFor(u.bp && u.bp.fourth) + '</div><div class="podium-card__team">' + esc((u.bp && u.bp.fourth) || '—') + '</div></div>'
      +   '</div>'
      + '</details>'

      + [1, 2, 3].map(function (J) {
        const open = OPTS.openGroups ? ' open' : '';
        const rows = grpByRound[J];
        return ''
          + '<details class="section-collapsible"' + open + '>'
          +   '<summary><h2>Jornada ' + J + ' grupos <span class="pts-tot">' + (u.br[J] || 0) + ' pts</span></h2></summary>'
          +   '<div class="filter-bar" data-scope="j' + J + '">'
          +     '<span class="chip chip--active" data-filter="all">Todos ' + rows.length + '</span>'
          +     '<span class="chip" data-filter="hit">Aciertos ' + rows.filter(function (r) { return r.p > 0; }).length + '</span>'
          +     '<span class="chip" data-filter="miss">Fallos ' + rows.filter(function (r) { return r.p === 0; }).length + '</span>'
          +     '<span class="chip" data-filter="boost">⚡ ' + rows.filter(function (r) { return r.b; }).length + '</span>'
          +     '<span class="chip" data-filter="ia">🤖 ' + rows.filter(function (r) { return r.ib; }).length + '</span>'
          +   '</div>'
          +   '<div class="match-list">' + rows.map(matchCard).join('') + '</div>'
          + '</details>';
      }).join('')

      + '<details class="section-collapsible">'
      +   '<summary><h2>KO · Clasificados a R32 <span class="pts-tot">+' + (u.qp || 0) + ' pts</span></h2></summary>'
      +   '<h4 class="grid-h grid-h--ok">✅ Aciertos (' + (u.qh || []).length + ')</h4>'
      +   '<div class="team-grid">'
      +     (u.qh || []).slice().sort().map(function (iso) {
            return '<div class="team-pill team-pill--ok">' + flagIso(iso) + ' ' + ((ISO_TO_ES && ISO_TO_ES[iso]) || iso) + '</div>';
          }).join('')
      +   '</div>'
      +   '<h4 class="grid-h grid-h--miss">❌ No clasificaron (' + (u.qm || []).length + ')</h4>'
      +   '<div class="team-grid">'
      +     ((u.qm || []).length
            ? (u.qm || []).map(function (iso) {
                return '<div class="team-pill team-pill--miss">' + flagIso(iso) + ' ' + ((ISO_TO_ES && ISO_TO_ES[iso]) || iso) + '</div>';
              }).join('')
            : '<div class="empty">¡Pleno!</div>')
      +   '</div>'
      + '</details>'

      // KO · una sección POR RONDA con filas. r32 → r16 → qf → sf → 3er →
      // final. Si una ronda no tiene filas en u.kr, su sección se omite. Si
      // NINGUNA ronda tiene filas, se muestra un único placeholder.
      + (function () {
          const sections = [];
          for (const rd of KO_ROUND_ORDER) {
            const rows = koByRound[rd];
            if (!rows.length) continue;
            const subtotal = rows.reduce(function (s, k) { return s + (k.p || 0); }, 0);
            sections.push(''
              + '<details class="section-collapsible">'
              +   '<summary><h2>KO · ' + esc(KO_ROUND_LABEL[rd]) + ' <span class="pts-tot">' + subtotal + ' pts</span></h2></summary>'
              +   '<div class="match-list">' + rows.map(koSlotCard).join('') + '</div>'
              + '</details>');
          }
          if (!sections.length) {
            return ''
              + '<details class="section-collapsible">'
              +   '<summary><h2>KO · slots cerrados <span class="pts-tot">0 pts</span></h2></summary>'
              +   '<div class="match-list"><div class="empty">Sin slots cerrados.</div></div>'
              + '</details>';
          }
          return sections.join('');
        })()

      + '<details class="section-collapsible">'
      +   '<summary><h2>Premios individuales '
      +     (u.aw
            ? '<span class="pts-tot">' + ((u.a || 0) > 0 ? (u.a + ' pts') : 'pdte.') + '</span>'
            : '')
      +   '</h2></summary>'
      +     (u.aw
            ? '<div class="awards">'
              + '<div class="award"><span class="award__k">Balón Oro</span><span class="award__v">' + esc(u.aw.golden_ball || '—') + '</span></div>'
              + '<div class="award"><span class="award__k">Bota Oro</span><span class="award__v">' + esc(u.aw.golden_boot || '—') + '</span></div>'
              + '<div class="award"><span class="award__k">Guante Oro</span><span class="award__v">' + esc(u.aw.golden_glove || '—') + '</span></div>'
              + '<div class="award"><span class="award__k">Mejor Joven</span><span class="award__v">' + esc(u.aw.young_player || '—') + '</span></div>'
              + '</div>'
            : '<div class="empty">Sin picks.</div>')
      + '</details>';

    const host = root.querySelector('#pd-dashboard');
    if (host) host.innerHTML = html;

    // Filtros (cada filter-bar opera sobre los .match de su sección).
    root.querySelectorAll('.filter-bar').forEach(function (bar) {
      const section = bar.closest('details');
      const chips = bar.querySelectorAll('.chip');
      chips.forEach(function (chip) {
        chip.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          chips.forEach(function (c) { c.classList.remove('chip--active'); });
          chip.classList.add('chip--active');
          const f = chip.dataset.filter;
          section.querySelectorAll('.match').forEach(function (m) {
            const pts = Number(m.dataset.pts);
            let show = true;
            if (f === 'hit') show = pts > 0;
            else if (f === 'miss') show = pts === 0;
            else if (f === 'boost') show = m.dataset.boost === '1';
            else if (f === 'ia') show = m.dataset.ia === '1';
            m.dataset.hidden = show ? '0' : '1';
          });
        });
      });
    });

    // Animación de barras de evolución (re-flow).
    root.querySelectorAll('.evo-bar-fill').forEach(function (b) {
      const w = b.style.width;
      b.style.width = '0%';
      requestAnimationFrame(function () { b.style.width = w; });
    });
  }

  // ─────────────────────────────────────────────────────────────
  // FETCHES — get-league-standings (selector) + get-dashboard (detalle).
  // ─────────────────────────────────────────────────────────────
  async function _fetchStandings(leagueId) {
    const dbRef = _db();
    if (!dbRef || !dbRef.functions) {
      throw new Error('db.functions no disponible (auth.js no inicializado)');
    }
    const res = await dbRef.functions.invoke('get-league-standings', {
      body: { league_id: leagueId },
    });
    if (res.error) throw res.error;
    if (!res.data || !Array.isArray(res.data.rows)) throw new Error('respuesta inválida de get-league-standings');
    // v1.7.0 del EF expone `leagueName` top-level; pre-v1.7.0 (mientras no
    // se redespliegue) es undefined → caller cae al fallback.
    return { rows: res.data.rows, leagueName: res.data.leagueName ?? null };
  }

  async function _fetchDashboard(leagueId, userId) {
    const dbRef = _db();
    if (!dbRef || !dbRef.functions) throw new Error('db.functions no disponible');
    const res = await dbRef.functions.invoke('get-dashboard', {
      body: { league_id: leagueId, user_id: userId },
    });
    if (res.error) throw res.error;
    if (!res.data || !res.data.u) throw new Error('respuesta inválida de get-dashboard');
    return res.data.u;
  }

  // Filtro bots + cicloste88 (acordado con San). Conservamos miembros de la
  // liga con `hasPreds=true` (la EF ya descarta los demás). is_bot lo añadimos
  // a través de un fetch a profiles si el response no lo trae — la EF actual
  // no devuelve is_bot, así que lo obtenemos del payload de get-dashboard al
  // pedirlo, o (más eficiente) con un join puntual.
  async function _enrichStandingsWithProfile(rows) {
    if (!rows.length) return rows;
    const dbRef = _db();
    if (!dbRef || typeof dbRef.from !== 'function') {
      return rows.map(function (row) { return Object.assign({}, row, { is_bot: false }); });
    }
    const uids = rows.map(function (r) { return r.uid; });
    try {
      const r = await dbRef.from('profiles').select('id, is_bot, nombre').in('id', uids);
      const map = {};
      (r.data || []).forEach(function (p) { map[p.id] = p; });
      return rows.map(function (row) {
        const p = map[row.uid] || {};
        return Object.assign({}, row, {
          is_bot: !!p.is_bot,
          nombre: row.nombre || p.nombre || '—',
        });
      });
    } catch (_e) {
      return rows.map(function (row) { return Object.assign({}, row, { is_bot: false }); });
    }
  }

  function _filterStandings(rows) {
    return rows.filter(function (r) {
      if (r.is_bot) return false;
      if ((r.nombre || '').toLowerCase() === 'cicloste88') return false;
      return true;
    });
  }

  // ─────────────────────────────────────────────────────────────
  // Helpers de UI: select + estado de carga.
  // ─────────────────────────────────────────────────────────────
  function _populateSelect(root, list, selectedUid) {
    const sel = root.querySelector('#pd-user-select');
    if (!sel) return;
    sel.innerHTML = list.map(function (u, i) {
      const sel = u.uid === selectedUid ? ' selected' : '';
      return '<option value="' + esc(u.uid) + '"' + sel + '>#' + (i + 1) + ' · ' + esc(u.nombre || '—') + ' — ' + u.total + ' pts</option>';
    }).join('');
  }

  function _setBodyState(root, mode, msg) {
    const host = root.querySelector('#pd-dashboard');
    if (!host) return;
    if (mode === 'loading') {
      host.innerHTML = '<div class="empty" style="padding:32px 14px">Cargando…</div>';
    } else if (mode === 'error') {
      host.innerHTML = '<div class="empty" style="padding:32px 14px">⚠ ' + esc(msg || 'Error') + '</div>';
    }
  }

  // ─────────────────────────────────────────────────────────────
  // mountPorra — entrada pública.
  // ─────────────────────────────────────────────────────────────
  async function mountPorra(root, opts) {
    if (!root) return;
    _initCatalogs();
    OPTS = Object.assign({ league: null, openGroups: false, lockLeague: true, onBack: null }, opts || {});

    // Marcar el root con la clase `.pd` (raíz de los estilos del pack).
    root.classList.add('pd');

    let currentLeague = OPTS.league;
    if (!currentLeague) currentLeague = _getActiveLeagueId();
    if (!currentLeague) {
      root.innerHTML = '<div class="empty" style="padding:64px 24px;text-align:center">Selecciona una liga para ver el dashboard.</div>';
      return;
    }

    // Liga: nombre real. Fallback inicial al _activeLeague (window-cached);
    // tras el fetch de get-league-standings v1.7.0 sustituimos por el
    // leagueName autoritativo de la BD. Si el EF está en v1.6.x (no
    // redesplegado todavía) seguimos con el fallback.
    let leagueName = '';
    const lg = _activeLeague();
    if (lg && lg.id === currentLeague && lg.nombre) leagueName = lg.nombre;

    // La pill se rellena de forma diferida con el nombre del fetch (línea de
    // abajo `#pd-league-name`). Hardcoded ICON, nombre dinámico.
    const leagueControl = OPTS.lockLeague
      ? '<div class="league-lock" title="Liga en la que estás logado">'
        + '<span class="league-lock__ico">' + leagueIconFor(currentLeague) + '</span>'
        + '<span class="league-lock__name" id="pd-league-name">' + esc(leagueName || 'Liga') + '</span>'
        + '<span class="league-lock__cnt" id="pd-league-cnt"></span>'
        + '</div>'
      : '';

    const backBtn = OPTS.onBack
      ? '<button class="pd-back" id="pd-back" type="button" aria-label="Volver al Predictor">'
        + '<svg width="15" height="15" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 12 L5 8 L10 4"/></svg>'
        + '<span>Predictor</span>'
        + '</button>'
      : '';

    root.innerHTML = ''
      + '<div class="pd-topbar">'
      +   backBtn
      +   '<div class="pd-brand">'
      +     '<div class="pd-brand__txt">'
      +       '<div class="pd-brand__t">Dashboard de la porra</div>'
      +       '<div class="pd-brand__s">Mundial 2026</div>'
      +     '</div>'
      +   '</div>'
      +   leagueControl
      +   '<div class="pd-select-wrap">'
      +     '<select id="pd-user-select" aria-label="Jugador"></select>'
      +   '</div>'
      + '</div>'
      + '<div class="pd-scroll">'
      +   '<div id="pd-dashboard"></div>'
      +   '<div class="pd-foot">Motor compartido scoring · datos en directo</div>'
      + '</div>';

    const backEl = root.querySelector('#pd-back');
    if (backEl && OPTS.onBack) backEl.addEventListener('click', OPTS.onBack);

    // 1. Fetch del leaderboard (selector) + enriquecimiento con is_bot.
    _setBodyState(root, 'loading');
    let standings;
    try {
      const stRes = await _fetchStandings(currentLeague);
      // v1.7.0 expone leagueName en el response. Sustituye el fallback inicial.
      if (stRes.leagueName) {
        leagueName = stRes.leagueName;
        const nameEl = root.querySelector('#pd-league-name');
        if (nameEl) nameEl.textContent = leagueName;
      }
      const enriched = await _enrichStandingsWithProfile(stRes.rows);
      standings = _filterStandings(enriched);
    } catch (err) {
      console.error('[porra-dashboard] standings fetch failed', err);
      _setBodyState(root, 'error', 'No se pudo cargar la clasificación.');
      return;
    }
    if (!standings.length) {
      _setBodyState(root, 'error', 'Sin jugadores en esta liga.');
      return;
    }
    standings.sort(function (a, b) { return b.total - a.total || b.grpPts - a.grpPts; });

    const cntEl = root.querySelector('#pd-league-cnt');
    if (cntEl) cntEl.textContent = standings.length + ' jugadores';

    _populateSelect(root, standings, standings[0].uid);

    // 2. Render del primer usuario (lazy fetch).
    let currentUid = standings[0].uid;
    async function _renderSelected() {
      const uid = root.querySelector('#pd-user-select').value;
      currentUid = uid;
      _setBodyState(root, 'loading');
      try {
        const u = await _fetchDashboard(currentLeague, uid);
        renderUser(root, u, standings);
        const scrollEl = root.querySelector('.pd-scroll');
        if (scrollEl) scrollEl.scrollTop = 0;
      } catch (err) {
        console.error('[porra-dashboard] dashboard fetch failed', err);
        _setBodyState(root, 'error', 'No se pudo cargar el detalle.');
      }
    }
    root.querySelector('#pd-user-select').addEventListener('change', _renderSelected);
    await _renderSelected();
  }

  window.mountPorra = mountPorra;
})();
