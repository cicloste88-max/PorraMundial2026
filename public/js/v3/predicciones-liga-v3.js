/* ============================================================
 * predicciones-liga-v3.js  ·  Screen 1 — "Predicciones de la liga"
 * ------------------------------------------------------------
 * Por partido: qué pronostica la comunidad (signo, marcadores,
 * goleadores) + tendencia global cross-liga + pronóstico IA.
 *
 * Entrada: chip "Liga" en el menú jornada (ui-groups.js _buildJCard).
 * Expone window.openPrediccionesLiga(matchKey) / closePrediccionesLiga().
 *
 * F5 — datos REALES vía Edge Function get-league-predictions
 * (PCShared.invokeEF, cliente JWT). league_id OBLIGATORIO (liga activa).
 * El hero/footer (equipos, eyebrow, estadio, mi pronóstico) se derivan
 * client-side (la EF sólo devuelve agregados, no meta del fixture).
 *   - gated:true  (porra del caller abierta) → bloques humanos en
 *     empty-state, PERO se muestra la tarjeta IA (ia viene igual).
 *   - gated:false → donut/podio/goleadores/global desde la EF; user_ids
 *     del podio → nombres vía profiles (1 query batch).
 * Tarjeta IA: la EF da SIGNO + CONFIANZA (ia_predictions no guarda marcador
 * ni goleador). El signo ya viene en orientación de la porra (flip
 * teams_swapped aplicado en la EF) → NO re-voltear.
 * ============================================================ */
(function () {
  'use strict';

  const WRAP_ID = 'page-predicciones-liga';
  const PAGE_JORNADA_ID = 'page-jornada';
  const PAGE_DIRECTO_ID = 'page-directo';
  const HIDE_IDS = ['page-jornada','page-directo','page-grupos','page-elim','page-score','page-admin','page-predictor','page-welcome'];

  let returnTo = PAGE_JORNADA_ID;
  let _currentKey = null; // guard anti-stale en flujos async

  function _partidos() { return (typeof PARTIDOS !== 'undefined') ? PARTIDOS : (window.PARTIDOS || []); }
  function _predictions() { return (typeof predictions !== 'undefined') ? predictions : (window.predictions || {}); }
  function _equipos() { return (typeof EQUIPOS !== 'undefined') ? EQUIPOS : (window.EQUIPOS || []); }
  function _live() { return window._liveScoresByMatchKey || {}; }
  const PCS = () => window.PCShared || {};
  const esc = (s) => (PCS().esc ? PCS().esc(s) : String(s ?? ''));
  const signOf = (h, a) => (PCS().signOf ? PCS().signOf(h, a) : (h > a ? '1' : h < a ? '2' : 'X'));
  const fmt = (n) => (PCS().fmt ? PCS().fmt(n) : String(n));
  const flagImg = (name, cls) => (PCS().flagImg ? PCS().flagImg(name, cls) : '');
  const codeFor = (name) => (PCS().codeFor ? PCS().codeFor(name) : String(name || '').slice(0, 3).toUpperCase());

  const CHEVRON = '<svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 12 L5 8 L10 4"/></svg>';
  const SEP = '<span class="pcb-sep">–</span>';

  function findMatch(matchKey) {
    const arr = _partidos();
    if (!Array.isArray(arr) || typeof window.getMatchKey !== 'function') return null;
    return arr.find((m) => window.getMatchKey(m) === matchKey) || null;
  }

  // ── Meta del fixture (réplica de tarjeta-stats) ──
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
    const mon = d.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase().replace('.', '');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${dow} · ${d.getDate()} ${mon} · ${hh}:${mm}`;
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
  function _cleanName(s) { return String(s || '').replace(/^\s*\d+\s*·\s*/, '').trim(); }
  function _scorerNameMap(match) {
    const map = {};
    [match.home, match.away].forEach((tn) => {
      const e = _equipos().find((t) => t.name === tn);
      ((e && e.players) || []).forEach((p) => { if (p && p.key) map[p.key] = _cleanName(p.name || p.key); });
    });
    return map;
  }

  function buildClientMatch(match, matchKey) {
    const { jornada, indexInJornada } = _jornadaInfo(match);
    const eyebrow = [jornada ? 'Jornada ' + jornada : null, match.group ? 'Grupo ' + match.group : null, indexInJornada ? 'Partido ' + indexInJornada : null].filter(Boolean).join(' · ');
    const real = _realResult(match, matchKey);
    const _stRaw = (typeof window.stadiumForMatch === 'function') ? window.stadiumForMatch(match) : (match.stadium || '');
    const stadium = !_stRaw ? '' : (typeof _stRaw === 'string' ? _stRaw : (_stRaw.name ? _stRaw.name + (_stRaw.city ? ' · ' + _stRaw.city : '') : ''));
    const pred = _predictions()[matchKey] || {};
    const hasPred = pred.l != null && pred.v != null;
    return {
      home: { name: match.home, code: codeFor(match.home) },
      away: { name: match.away, code: codeFor(match.away) },
      eyebrow, time: real ? 'Finalizado' : _timeLabel(match), stadium, real,
      myScore: hasPred ? { home: pred.l, away: pred.v } : null,
      myPick: hasPred ? signOf(pred.l, pred.v) : null,
    };
  }

  // ── Adaptadores: shape EF → shape de render ──
  function _adaptLeague(ef, match, names) {
    const s = ef.signo || { local: 0, empate: 0, visitante: 0, total: 0 };
    const total = s.total || 0;
    const pct = (n) => (total ? Math.round(n / total * 100) : 0);
    const nameMap = _scorerNameMap(match);
    return {
      total,
      sign: { p1: pct(s.local), pX: pct(s.empate), p2: pct(s.visitante) },
      myPick: ef._myPick,
      scores: (ef.podio || []).map((p) => ({ home: p.local, away: p.visitante, count: p.count, players: (p.users || []).map((u) => names[u] || '—') })),
      scorers: (ef.goleadores || []).map((g) => ({ name: nameMap[g.scorer] || g.scorer, count: g.count })),
    };
  }
  function _adaptGlobal(ef) {
    const g = ef.global || { total: 0, signo: { local: 0, empate: 0, visitante: 0 }, topScore: null };
    const t = g.total || 0;
    const gs = g.signo || { local: 0, empate: 0, visitante: 0 };
    const maxv = Math.max(gs.local, gs.empate, gs.visitante);
    const winner = (gs.local >= gs.empate && gs.local >= gs.visitante) ? '1' : (gs.visitante >= gs.empate ? '2' : 'X');
    const ts = g.topScore;
    return {
      total: t,
      sign: { winner, pct: t ? Math.round(maxv / t * 100) : 0 },
      topScore: ts ? { home: ts.local, away: ts.visitante, pct: t ? Math.round(ts.count / t * 100) : 0 } : { home: 0, away: 0, pct: 0 },
    };
  }

  // ── Render ──
  function navHtml() {
    return '<nav class="pc-nav"><button class="pc-nav__back" type="button" onclick="closePrediccionesLiga()">' + CHEVRON + '<span>Jornada</span></button>' +
      '<div class="pc-nav__title">Predicciones de la liga</div><div class="pc-nav__spacer"></div></nav>';
  }
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
        '<span class="pcb-restrow__score">' + s.home + SEP + s.away + (exact ? ' ✓' : '') + '</span>' +
        '<span class="pcb-restrow__track"><span class="pcb-restrow__fill" style="width:' + Math.round(s.count / max * 100) + '%"></span></span>' +
        '<span class="pcb-restrow__cnt">' + s.count + '</span></div>';
    }).join('');
    return (
      '<div class="pcb-podium">' +
        '<div class="pcb-top' + (topExact ? ' is-exact' : '') + '">' +
          '<div class="pcb-top__head"><span class="pcb-top__rank">#1 · Más jugado</span>' +
            (topExact ? '<span class="pcb-tag pcb-tag--exact">✓ Exacto</span>' : '') + '</div>' +
          '<div class="pcb-top__main"><span class="pcb-top__score">' + top.home + SEP + top.away + '</span>' +
            '<span class="pcb-top__count"><span class="pcb-top__countnum">' + top.count + '</span>' +
            '<span class="pcb-top__countlbl">jugadores</span></span></div>' +
          '<div class="pcb-names">' + names + '</div>' +
        '</div>' +
        '<div class="pcb-rest">' + restHtml + '</div>' +
      '</div>'
    );
  }
  function renderGolers(lg) {
    const scorers = lg.scorers || [];
    if (!scorers.length) return '<div class="pc-section__empty">Sin goleadores escogidos</div>';
    const max = Math.max.apply(null, scorers.map((s) => s.count).concat([1]));
    return '<div class="pcb-golers">' + scorers.map((s, i) =>
      '<div class="pcb-goler">' +
        '<span class="pcb-goler__rank">' + (i + 1) + '</span>' +
        '<span class="pcb-goler__name">' + esc(s.name) + '</span>' +
        '<span class="pcb-goler__track"><span class="pcb-goler__fill" style="width:' + Math.round(s.count / max * 100) + '%"></span></span>' +
        '<span class="pcb-goler__cnt">' + s.count + '</span></div>'
    ).join('') + '</div>';
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
            '<span class="pcb-gcard__v">' + g.topScore.home + SEP + g.topScore.away + '</span>' +
            '<span class="pcb-gcard__pct">' + g.topScore.pct + '%</span></div>' +
        '</div>' +
      '</div>'
    );
  }
  // Tarjeta IA: signo + confianza (NO marcador; ia_predictions no lo guarda).
  // sign ya en orientación de la porra (EF aplicó flip) → NO re-voltear.
  function renderIA(ia, m) {
    if (!ia || !ia.sign) return '<div class="pc-section__empty">Sin pronóstico de la IA</div>';
    const verdict = ia.sign === '1' ? ('Gana <b>' + esc(m.home.name) + '</b>')
      : ia.sign === '2' ? ('Gana <b>' + esc(m.away.name) + '</b>')
      : 'Empate <b>más probable</b>';
    const conf = (ia.confidence != null) ? ia.confidence : null;
    return (
      '<div class="pcb-ia">' +
        '<div class="pcb-ia__badge">✦</div>' +
        '<div class="pcb-ia__k">Pronóstico IA · estadística</div>' +
        '<div class="pcb-ia__verdict">' + verdict + '</div>' +
        (conf != null
          ? '<div class="pcb-ia__ring"><div class="pcb-ia__bartrack"><div class="pcb-ia__barfill" style="width:' + conf + '%"></div></div><span class="pcb-ia__conf">' + conf + '%</span></div>'
          : '') +
      '</div>'
    );
  }
  function renderFooter(m, final) {
    const mine = m.myScore;
    let tag = '';
    if (final && mine && m.real) {
      const exact = mine.home === m.real.home && mine.away === m.real.away;
      const signOk = signOf(mine.home, mine.away) === signOf(m.real.home, m.real.away);
      tag = exact ? '<span class="pc-chip-ok"> · ✓ Exacto</span>'
        : signOk ? '<span class="pc-chip-ok"> · ✓ Signo</span>'
        : '<span style="color:var(--ink-500)"> · Fallado</span>';
    }
    const val = mine
      ? esc(m.home.code) + ' <b>' + mine.home + SEP + mine.away + '</b> ' + esc(m.away.code) + tag
      : '<span style="color:var(--ink-500)">Sin pronóstico</span>';
    return '<div class="pc-footer"><div class="pc-footer__l">' +
      '<div class="pc-footer__lbl">' + (final ? 'Tu resultado' : 'Tu pronóstico') + '</div>' +
      '<div class="pc-footer__val">' + val + '</div></div></div>';
  }

  const section = (title, count, body) =>
    '<section class="pc-section"><div class="pc-section__title">' + title +
      (count ? '<span class="pc-section__count">' + count + '</span>' : '') + '</div>' + body + '</section>';

  function bodyLoading() {
    return '<div class="pc-loading"><div class="pc-spinner"></div>Cargando predicciones…</div>';
  }
  function bodyError(matchKey, msg, retry) {
    return '<div class="pc-section__empty" style="padding:40px 0">' + esc(msg) +
      (retry ? '<br><button class="pc-retry" type="button" onclick="openPrediccionesLiga(\'' + matchKey + '\')">Reintentar</button>' : '') + '</div>';
  }
  function bodyGated(m, ia) {
    const empty = '<div class="pc-section__empty">Disponible tras el cierre de la porra</div>';
    return section('Signo · tu liga', '', empty) +
      section('Marcadores más jugados', '', empty) +
      section('Goleadores más elegidos', '', empty) +
      section('Tendencia global', '', empty) +
      section('Pronóstico de la IA', '', renderIA(ia, m));
  }
  function bodyFull(payload) {
    const m = payload.match, lg = payload.league, g = payload.global, ia = payload.ia;
    const final = !!m.real;
    return section('Signo · tu liga', lg.total + ' votos', renderDonut(lg, m)) +
      section('Marcadores más jugados', 'ranking ↓', renderPodium(lg, m, final)) +
      section('Goleadores más elegidos', '', renderGolers(lg)) +
      section('Tendencia global', '', renderGlobal(g, m)) +
      section('Pronóstico de la IA', '', renderIA(ia, m));
  }
  function renderScreen(m, bodyHtml) {
    return '<div class="pc-screen">' + navHtml() + renderHero(m, !!m.real) +
      '<div class="pc-body">' + bodyHtml + '</div>' + renderFooter(m, !!m.real) + '</div>';
  }

  // ── Mount / unmount ──
  function hideOtherPages() {
    HIDE_IDS.forEach((id) => {
      const el = document.getElementById(id);
      if (el && el.style.display !== 'none') { el.dataset.plPrevDisplay = el.style.display || ''; el.style.display = 'none'; }
    });
  }
  function restoreOtherPages() {
    const back = document.getElementById(returnTo);
    if (back) { back.style.display = back.dataset.plPrevDisplay || 'block'; delete back.dataset.plPrevDisplay; }
  }
  function _paint(matchKey, m, bodyHtml) {
    if (_currentKey !== matchKey) return;
    const wrap = document.getElementById(WRAP_ID);
    if (!wrap) return;
    wrap.innerHTML = renderScreen(m, bodyHtml);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  async function openPrediccionesLiga(matchKey) {
    const match = findMatch(matchKey);
    if (!match) { console.warn('[predicciones-liga] match no encontrado:', matchKey); return; }
    _currentKey = matchKey;
    returnTo = [PAGE_JORNADA_ID, PAGE_DIRECTO_ID].find((id) => {
      const el = document.getElementById(id); return el && el.style.display !== 'none';
    }) || PAGE_JORNADA_ID;

    const m = buildClientMatch(match, matchKey);

    document.getElementById(WRAP_ID)?.remove();
    hideOtherPages();
    const wrap = document.createElement('div');
    wrap.id = WRAP_ID;
    document.body.appendChild(wrap);
    _paint(matchKey, m, bodyLoading());

    const leagueId = PCS().activeLeagueId ? PCS().activeLeagueId() : (window._activeLeague && window._activeLeague.id);
    if (!leagueId) { _paint(matchKey, m, bodyError(matchKey, 'Selecciona una liga para ver las predicciones.', false)); return; }

    let ef;
    try {
      ef = await PCS().invokeEF('get-league-predictions', { match_id: matchKey, league_id: leagueId });
    } catch (err) {
      console.error('[predicciones-liga] invoke falló:', err);
      _paint(matchKey, m, bodyError(matchKey, 'No se pudo cargar. Inténtalo de nuevo.', true));
      return;
    }
    if (_currentKey !== matchKey) return; // otro open superpuesto
    if (!ef) { _paint(matchKey, m, bodyError(matchKey, 'Respuesta vacía del servidor.', true)); return; }

    if (ef.gated) { _paint(matchKey, m, bodyGated(m, ef.ia)); return; }

    const uids = [];
    (ef.podio || []).forEach((p) => (p.users || []).forEach((u) => uids.push(u)));
    let names = {};
    try { names = await PCS().resolveNames(uids); } catch (_e) { /* nombres opcionales */ }
    if (_currentKey !== matchKey) return;

    ef._myPick = m.myPick;
    const payload = { match: m, league: _adaptLeague(ef, match, names), global: _adaptGlobal(ef), ia: ef.ia };
    _paint(matchKey, m, bodyFull(payload));
  }

  function closePrediccionesLiga() {
    _currentKey = null;
    document.getElementById(WRAP_ID)?.remove();
    restoreOtherPages();
  }

  window.openPrediccionesLiga = openPrediccionesLiga;
  window.closePrediccionesLiga = closePrediccionesLiga;
})();
