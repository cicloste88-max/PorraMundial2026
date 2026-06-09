/* ============================================================
 * predicciones-liga-v3.js  ·  Screen 1 — "Predicciones de la liga"
 * ────────────────────────────────────────────────────────────
 * Por partido: qué pronostica la comunidad (signo, marcadores,
 * goleadores) + tendencia global cross-liga + pronóstico IA.
 *
 * Entrada: chip "📊 Liga" en el menú jornada (ui-groups.js _buildJCard),
 *          entre el boost-row y "Ver tarjeta".
 *
 * Expone:
 *   window.openPrediccionesLiga(matchKey)
 *   window.closePrediccionesLiga()
 *
 * Patrón overlay copiado de tarjeta-stats.js (mount en <body>,
 * hide/restore de las page-*). Render con template strings (.pc- y .pcb-).
 *
 * Datos (F2): mock local. Orden de resolución:
 *   1) window.fetchPrediccionesLiga(matchKey)  → Promise (F5, real)
 *   2) window._prediccionesLigaMock[matchKey]  → override manual QA
 *   3) _synthPayload(match)                     → sintetizado del partido
 * Forma del payload = brief §3.4 (idéntica al data.js del bundle + scorers).
 * ============================================================ */
(function () {
  'use strict';

  const WRAP_ID = 'page-predicciones-liga';
  const PAGE_JORNADA_ID = 'page-jornada';
  const PAGE_DIRECTO_ID = 'page-directo';
  const HIDE_IDS = ['page-jornada','page-directo','page-grupos','page-elim','page-score','page-admin','page-predictor','page-welcome'];

  let returnTo = PAGE_JORNADA_ID;

  // ── Acceso seguro a globals (const top-level NO va a window — ERR-02) ──
  function _partidos() { return (typeof PARTIDOS !== 'undefined') ? PARTIDOS : (window.PARTIDOS || []); }
  function _predictions() { return (typeof predictions !== 'undefined') ? predictions : (window.predictions || {}); }
  function _equipos() { return (typeof EQUIPOS !== 'undefined') ? EQUIPOS : (window.EQUIPOS || []); }
  function _live() { return window._liveScoresByMatchKey || {}; }
  function _ia() { return (typeof iaPredictions !== 'undefined') ? iaPredictions : (window.iaPredictions || {}); }
  const PCS = () => window.PCShared || {};
  const esc = (s) => (PCS().esc ? PCS().esc(s) : String(s ?? ''));
  const signOf = (h, a) => (PCS().signOf ? PCS().signOf(h, a) : (h > a ? '1' : h < a ? '2' : 'X'));
  const fmt = (n) => (PCS().fmt ? PCS().fmt(n) : String(n));
  const flagImg = (name, cls) => (PCS().flagImg ? PCS().flagImg(name, cls) : '');
  const codeFor = (name) => (PCS().codeFor ? PCS().codeFor(name) : String(name || '').slice(0, 3).toUpperCase());

  const CHEVRON = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 12 L5 8 L10 4"/></svg>';

  function findMatch(matchKey) {
    const arr = _partidos();
    if (!Array.isArray(arr) || typeof window.getMatchKey !== 'function') return null;
    return arr.find((m) => window.getMatchKey(m) === matchKey) || null;
  }

  // ── Meta del partido (réplica de tarjeta-stats _jornadaInfo/_timeLabel) ──
  let _jornadaCache = null;
  function _jornadaInfo(match) {
    if (!_jornadaCache) {
      const byDate = {};
      _partidos().forEach((m) => {
        const d = m.date ? String(m.date).substring(0, 10) : null;
        if (!d) return;
        (byDate[d] = byDate[d] || []).push(m);
      });
      _jornadaCache = { byDate, days: Object.keys(byDate).sort() };
    }
    const d = match.date ? String(match.date).substring(0, 10) : null;
    if (!d) return { jornada: null, indexInJornada: null };
    const jornada = _jornadaCache.days.indexOf(d) + 1 || null;
    const list = _jornadaCache.byDate[d] || [];
    const idx = list.indexOf(match);
    return { jornada, indexInJornada: idx >= 0 ? idx + 1 : null };
  }
  function _timeLabel(match) {
    if (!match.date) return '';
    const d = new Date(match.date);
    if (isNaN(d.getTime())) return '';
    const dow = d.toLocaleDateString('es-ES', { weekday: 'short' }).toUpperCase().replace('.', '');
    const day = d.getDate();
    const mon = d.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase().replace('.', '');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${dow} · ${day} ${mon} · ${hh}:${mm}`;
  }
  function _realResult(match, matchKey) {
    const live = _live()[matchKey];
    if (live && live.status === 'finished') {
      const home = (live.score_home != null) ? live.score_home : (match.realHome != null ? match.realHome : null);
      const away = (live.score_away != null) ? live.score_away : (match.realAway != null ? match.realAway : null);
      if (home != null && away != null) return { home, away };
    }
    return null;
  }

  // ── Mock sintetizado (QA): payload §3.4 derivado del partido real ──
  function _seed(str) { let h = 2166136261; for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; }
  function _rng(seed) { let s = seed >>> 0; return () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return s / 4294967296; }; }
  function _cleanName(s) { return String(s || '').replace(/^\s*\d+\s*·\s*/, '').trim(); }
  function _teamScorers(teamName, n) {
    const e = _equipos().find((t) => t.name === teamName);
    return ((e && e.players) || []).slice(0, n).map((p) => ({ key: p.key, name: _cleanName(p.name || p.key) }));
  }
  const _MEMBERS = ['Tú','Carlos M.','Laura P.','Dani R.','Javi S.','Marta L.','Edu','Sergio','Ana G.','Pau','Iván','Rubén','Clara','Marcos','Lucía','Hugo','Alba','Diego','Sara','Bruno','Pablo','Noa','Elena','Víctor'];

  function _synthPayload(match, matchKey) {
    const homeName = match.home, awayName = match.away;
    const homeCode = codeFor(homeName), awayCode = codeFor(awayName);
    const { jornada, indexInJornada } = _jornadaInfo(match);
    const eyebrow = [jornada ? 'Jornada ' + jornada : null, match.group ? 'Grupo ' + match.group : null, indexInJornada ? 'Partido ' + indexInJornada : null].filter(Boolean).join(' · ');
    const real = _realResult(match, matchKey);
    const final = !!real;
    const stadium = (typeof window.stadiumForMatch === 'function') ? (window.stadiumForMatch(match) || '') : (match.stadium || '');

    const pred = _predictions()[matchKey] || {};
    const hasPred = pred.l != null && pred.v != null;
    const myScore = hasPred ? { home: pred.l, away: pred.v } : null;
    const myPick = hasPred ? signOf(pred.l, pred.v) : null;

    const rnd = _rng(_seed(matchKey));
    const total = 16 + Math.floor(rnd() * 14);          // 16–29 votos liga
    let p1 = 28 + Math.floor(rnd() * 34);               // 28–61
    let pX = 12 + Math.floor(rnd() * 20);               // 12–31
    let p2 = 100 - p1 - pX; if (p2 < 8) { p2 = 8; p1 = 100 - pX - p2; }

    // Marcadores: pool determinista incl. el del usuario.
    const pool = [[1,0],[2,1],[1,1],[0,0],[2,0],[0,1],[3,1],[1,2]];
    if (myScore && !pool.some((p) => p[0] === myScore.home && p[1] === myScore.away)) pool.unshift([myScore.home, myScore.away]);
    const weights = pool.map((_, i) => Math.max(1, 7 - i) + Math.floor(rnd() * 2));
    const wsum = weights.reduce((a, b) => a + b, 0);
    let mem = 0;
    let scores = pool.map((p, i) => ({ home: p[0], away: p[1], count: Math.max(1, Math.round(total * weights[i] / wsum)) }));
    scores.sort((a, b) => b.count - a.count);
    scores = scores.slice(0, 7);
    scores.forEach((s) => {
      const k = Math.min(s.count, 6), names = [];
      const isMine = myScore && s.home === myScore.home && s.away === myScore.away;
      for (let j = 0; j < k; j++) names.push(_MEMBERS[(mem++) % _MEMBERS.length]);
      if (isMine && names.indexOf('Tú') === -1) names[0] = 'Tú';
      s.players = names;
    });

    // Goleadores más elegidos: nombres reales de las plantillas.
    const golPool = _teamScorers(homeName, 3).concat(_teamScorers(awayName, 2));
    const scorers = golPool.map((g, i) => ({ name: g.name, count: Math.max(1, Math.round((total / 2) * (golPool.length - i) / golPool.length) + Math.floor(rnd() * 2)) }));
    scorers.sort((a, b) => b.count - a.count);
    if (final && scorers.length) scorers[0].hit = true; // demo estado oro

    const gTotal = 70000 + Math.floor(rnd() * 90000);
    const gWinner = p1 >= pX && p1 >= p2 ? '1' : p2 >= pX ? '2' : 'X';
    const gPct = Math.max(p1, pX, p2);
    const topScore = { home: scores[0].home, away: scores[0].away, pct: 10 + Math.floor(rnd() * 9) };

    const iaRaw = _ia()[matchKey] || {};
    const iaScore = (iaRaw.l != null && iaRaw.v != null) ? { home: iaRaw.l, away: iaRaw.v } : { home: scores[0].home, away: scores[0].away };
    const ia = { sign: iaRaw.sign || signOf(iaScore.home, iaScore.away), score: iaScore, confidence: iaRaw.confidence || iaRaw.conf || (55 + Math.floor(rnd() * 25)) };

    return {
      match: { home: { name: homeName, code: homeCode }, away: { name: awayName, code: awayCode }, eyebrow, time: final ? 'Finalizado' : _timeLabel(match), stadium, real },
      league: { total, sign: { p1, pX, p2 }, myPick, myScore, scores, scorers },
      global: { total: gTotal, sign: { winner: gWinner, pct: gPct }, topScore },
      ia,
    };
  }

  function _resolvePayload(matchKey, match) {
    if (typeof window.fetchPrediccionesLiga === 'function') return window.fetchPrediccionesLiga(matchKey);
    const ov = window._prediccionesLigaMock && window._prediccionesLigaMock[matchKey];
    return ov || _synthPayload(match, matchKey);
  }

  // ── Render ──────────────────────────────────────────────
  function renderHero(m, final) {
    return (
      '<div class="pc-meta">' +
        '<div class="pc-meta__eyebrow">' + esc(m.eyebrow) + '</div>' +
        '<div class="pc-meta__time">' + (final ? 'Finalizado' : esc(m.time)) + '</div>' +
        (m.stadium ? '<div class="pc-meta__stadium">' + esc(m.stadium) + '</div>' : '') +
      '</div>' +
      '<div class="pc-hero">' +
        '<div class="pc-team pc-team--a">' + flagImg(m.home.name, 'pc-team__flag') +
          '<div class="pc-team__name">' + esc(m.home.name) + '</div><div class="pc-team__sub">Local</div></div>' +
        '<div class="pc-score' + (final ? ' pc-score--final' : '') + '">' +
          '<div class="pc-score__label">' + (final ? 'Resultado' : 'Por jugar') + '</div>' +
          '<div class="pc-score__nums' + (final ? '' : ' is-empty') + '">' +
            '<span>' + (final ? m.real.home : '–') + '</span><span class="pc-score__sep">:</span><span>' + (final ? m.real.away : '–') + '</span>' +
          '</div>' +
        '</div>' +
        '<div class="pc-team pc-team--b">' + flagImg(m.away.name, 'pc-team__flag') +
          '<div class="pc-team__name">' + esc(m.away.name) + '</div><div class="pc-team__sub">Visitante</div></div>' +
      '</div>'
    );
  }

  function renderDonut(lg, m) {
    const { p1, pX, p2 } = lg.sign;
    const a = p1, b = p1 + pX;
    const dom = Math.max(p1, pX, p2);
    const domSign = p1 === dom ? '1' : pX === dom ? 'X' : '2';
    const grad = 'conic-gradient(var(--team-a) 0 ' + a + '%, var(--ink-400) ' + a + '% ' + b + '%, var(--team-b) ' + b + '% 100%)';
    const row = (sign, label, pct) =>
      '<div class="pcb-signleg__row' + (lg.myPick === sign ? ' mine' : '') + '">' +
        '<span class="pcb-signleg__dot pcb-signleg__dot--' + (sign === 'X' ? 'x' : sign) + '"></span>' +
        '<span class="pcb-signleg__name">' + label + '</span>' +
        '<span class="pcb-signleg__pct">' + pct + '%</span></div>';
    return (
      '<div class="pcb-sign">' +
        '<div class="pcb-donut" style="background:' + grad + '">' +
          '<div class="pcb-donut__center"><div class="pcb-donut__pct">' + dom + '%</div>' +
          '<div class="pcb-donut__lbl">' + esc(domSign === '1' ? m.home.code : domSign === '2' ? m.away.code : 'Empate') + '</div></div>' +
        '</div>' +
        '<div class="pcb-signleg">' +
          row('1', esc(m.home.name) + ' gana', p1) + row('X', 'Empate', pX) + row('2', esc(m.away.name) + ' gana', p2) +
        '</div>' +
      '</div>'
    );
  }

  function renderPodium(lg, m, final) {
    const scores = lg.scores || [];
    if (!scores.length) return '<div class="pc-section__empty">Sin pronósticos</div>';
    const top = scores[0], rest = scores.slice(1);
    const max = Math.max.apply(null, scores.map((s) => s.count).concat([1]));
    const topExact = final && m.real && top.home === m.real.home && top.away === m.real.away;
    const names = (top.players || []).map((p) => '<span class="pcb-name">' + esc(p) + '</span>').join('');
    const restHtml = rest.map((s, i) => {
      const sign = signOf(s.home, s.away);
      const exact = final && m.real && s.home === m.real.home && s.away === m.real.away;
      return '<div class="pcb-restrow sign' + sign + (exact ? ' is-exact' : '') + '">' +
        '<span class="pcb-restrow__rank">' + (i + 2) + '</span>' +
        '<span class="pcb-restrow__score">' + s.home + '–' + s.away + (exact ? ' ✓' : '') + '</span>' +
        '<span class="pcb-restrow__track"><span class="pcb-restrow__fill" style="width:' + Math.round(s.count / max * 100) + '%"></span></span>' +
        '<span class="pcb-restrow__cnt">' + s.count + '</span></div>';
    }).join('');
    return (
      '<div class="pcb-podium">' +
        '<div class="pcb-top' + (topExact ? ' is-exact' : '') + '">' +
          '<div class="pcb-top__head"><span class="pcb-top__rank">#1 · Más jugado</span>' +
            (topExact ? '<span class="pcb-tag pcb-tag--exact">✓ Exacto</span>' : '') + '</div>' +
          '<div class="pcb-top__main"><span class="pcb-top__score">' + top.home + '–' + top.away + '</span>' +
            '<span class="pcb-top__count"><span class="pcb-top__countnum">' + top.count + '</span>' +
            '<span class="pcb-top__countlbl">jugadores</span></span></div>' +
          '<div class="pcb-names">' + names + '</div>' +
        '</div>' +
        '<div class="pcb-rest">' + restHtml + '</div>' +
      '</div>'
    );
  }

  function renderGolers(lg, final) {
    const scorers = lg.scorers || [];
    if (!scorers.length) return '<div class="pc-section__empty">Sin goleadores escogidos</div>';
    const max = Math.max.apply(null, scorers.map((s) => s.count).concat([1]));
    return '<div class="pcb-golers">' + scorers.map((s, i) => {
      const hit = final && !!s.hit;
      return '<div class="pcb-goler' + (hit ? ' is-exact' : '') + '">' +
        '<span class="pcb-goler__rank">' + (i + 1) + '</span>' +
        '<span class="pcb-goler__name">' + esc(s.name) + (hit ? ' ✓' : '') + '</span>' +
        '<span class="pcb-goler__track"><span class="pcb-goler__fill" style="width:' + Math.round(s.count / max * 100) + '%"></span></span>' +
        '<span class="pcb-goler__cnt">' + s.count + '</span></div>';
    }).join('') + '</div>';
  }

  function renderGlobal(g, m) {
    return (
      '<div class="pcb-global">' +
        '<div class="pcb-global__num">' + fmt(g.total) + '</div>' +
        '<div class="pcb-global__sub">pronósticos en toda la porra</div>' +
        '<div class="pcb-global__cards">' +
          '<div class="pcb-gcard"><span class="pcb-gcard__k">Signo más elegido</span>' +
            '<span class="pcb-gcard__v">' + esc(g.sign.winner === '1' ? m.home.code : g.sign.winner === '2' ? m.away.code : 'X') + '</span>' +
            '<span class="pcb-gcard__pct">' + g.sign.pct + '%</span></div>' +
          '<div class="pcb-gcard"><span class="pcb-gcard__k">Marcador top</span>' +
            '<span class="pcb-gcard__v">' + g.topScore.home + '–' + g.topScore.away + '</span>' +
            '<span class="pcb-gcard__pct">' + g.topScore.pct + '%</span></div>' +
        '</div>' +
      '</div>'
    );
  }

  function renderIA(ia, m, final) {
    const hit = final && m.real && ia.score.home === m.real.home && ia.score.away === m.real.away;
    return (
      '<div class="pcb-ia">' +
        '<div class="pcb-ia__badge">✦</div>' +
        '<div class="pcb-ia__k">Resultado más probable · IA + estadística</div>' +
        '<div class="pcb-ia__score">' + ia.score.home + ' – ' + ia.score.away + '</div>' +
        '<div class="pcb-ia__ring"><div class="pcb-ia__bartrack"><div class="pcb-ia__barfill" style="width:' + ia.confidence + '%"></div></div>' +
          '<span class="pcb-ia__conf">' + ia.confidence + '%</span></div>' +
        (hit ? '<div class="pcb-ia__hit">✓ La IA clavó el marcador</div>' : '') +
      '</div>'
    );
  }

  function renderFooter(m, lg, final) {
    const mine = lg.myScore;
    let tag = '';
    if (final && mine && m.real) {
      const exact = mine.home === m.real.home && mine.away === m.real.away;
      const signOk = signOf(mine.home, mine.away) === signOf(m.real.home, m.real.away);
      tag = exact ? '<span class="pc-chip-ok"> · ✓ Exacto</span>'
        : signOk ? '<span class="pc-chip-ok"> · ✓ Signo</span>'
        : '<span style="color:var(--ink-500)"> · Fallado</span>';
    }
    const val = mine
      ? esc(m.home.code) + ' <b>' + mine.home + '–' + mine.away + '</b> ' + esc(m.away.code) + tag
      : '<span style="color:var(--ink-500)">Sin pronóstico</span>';
    return (
      '<div class="pc-footer"><div class="pc-footer__l">' +
        '<div class="pc-footer__lbl">' + (final ? 'Tu resultado' : 'Tu pronóstico') + '</div>' +
        '<div class="pc-footer__val">' + val + '</div>' +
      '</div></div>'
    );
  }

  function renderScreen(payload) {
    const m = payload.match, lg = payload.league, g = payload.global, ia = payload.ia;
    const final = !!m.real;
    const section = (title, count, body) =>
      '<section class="pc-section"><div class="pc-section__title">' + title +
        (count ? '<span class="pc-section__count">' + count + '</span>' : '') + '</div>' + body + '</section>';
    return (
      '<div class="pc-screen">' +
        '<nav class="pc-nav">' +
          '<button class="pc-nav__back" type="button" onclick="closePrediccionesLiga()">' + CHEVRON + '<span>Jornada</span></button>' +
          '<div class="pc-nav__title">Predicciones de la liga</div><div class="pc-nav__spacer"></div>' +
        '</nav>' +
        renderHero(m, final) +
        '<div class="pc-body">' +
          section('Signo · tu liga', lg.total + ' votos', renderDonut(lg, m)) +
          section('Marcadores más jugados', 'ranking ↓', renderPodium(lg, m, final)) +
          section('Goleadores más elegidos', '', renderGolers(lg, final)) +
          section('Tendencia global', '', renderGlobal(g, m)) +
          section('Pronóstico de la IA', '', renderIA(ia, m, final)) +
        '</div>' +
        renderFooter(m, lg, final) +
      '</div>'
    );
  }

  // ── Mount / unmount (réplica de tarjeta-stats) ──────────
  function hideOtherPages() {
    HIDE_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.style.display !== 'none') {
        el.dataset.plPrevDisplay = el.style.display || '';
        el.style.display = 'none';
      }
    });
  }
  function restoreOtherPages() {
    const back = document.getElementById(returnTo);
    if (back) { back.style.display = back.dataset.plPrevDisplay || 'block'; delete back.dataset.plPrevDisplay; }
  }

  async function openPrediccionesLiga(matchKey) {
    const match = findMatch(matchKey);
    if (!match) { console.warn('[predicciones-liga] match no encontrado:', matchKey); return; }

    returnTo = [PAGE_JORNADA_ID, PAGE_DIRECTO_ID].find((id) => {
      const el = document.getElementById(id); return el && el.style.display !== 'none';
    }) || PAGE_JORNADA_ID;

    let payload = null;
    try { payload = await Promise.resolve(_resolvePayload(matchKey, match)); }
    catch (err) { console.error('[predicciones-liga] fetchPrediccionesLiga falló:', err); }
    if (!payload) payload = _synthPayload(match, matchKey); // QA: nunca pantalla vacía

    document.getElementById(WRAP_ID)?.remove();
    hideOtherPages();

    const wrap = document.createElement('div');
    wrap.id = WRAP_ID;
    wrap.innerHTML = renderScreen(payload);
    document.body.appendChild(wrap);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function closePrediccionesLiga() {
    document.getElementById(WRAP_ID)?.remove();
    restoreOtherPages();
  }

  window.openPrediccionesLiga = openPrediccionesLiga;
  window.closePrediccionesLiga = closePrediccionesLiga;
})();
