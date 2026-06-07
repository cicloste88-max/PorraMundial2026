/* ============================================================
 * tarjeta-stats.js
 * ────────────────────────────────────────────────────────────
 * Render de la pantalla "Tarjeta · Datos del partido".
 *
 * Sustituye AL MODAL "Ver tarjeta" de Jornada (read-only) por
 * una pantalla completa informativa. El flujo editable de
 * openJcardModal (usado desde Grupos) queda intacto.
 *
 * Expone:
 *   window.openTarjetaStats(matchKey)   ← entry point
 *   window.closeTarjetaStats()          ← cierra y vuelve
 *
 * Lee del estado global del proyecto (data.js / live-sync.js):
 *   PARTIDOS, EQUIPOS, predictions, boostPicks,
 *   _liveScoresByMatchKey, getMatchKey(), SB
 *
 * Lee del backend (match-stats.js):
 *   window.fetchMatchStats(matchKey) → Promise<MatchStatsPayload|null>
 *   Si devuelve null, la pantalla renderiza "Sin datos…" en cada
 *   sección y hero con pronóstico del usuario o "—".
 * ============================================================ */

(function () {
  'use strict';

  const SCREEN_ID = 'tarjeta-stats-screen';
  const PAGE_JORNADA_ID = 'page-jornada';
  const PAGE_DIRECTO_ID = 'page-directo';

  let returnTo = PAGE_JORNADA_ID;

  // Mapping ISO3→ISO2 alineado con bucket miniatures/flags-sm/<ISO2>.webp.
  // Duplicado de ui-groups.js + ui-directo.js — mantenerlos sincronizados.
  const ISO3_TO_ISO2 = {
    MEX:'MX', RSA:'ZA', KOR:'KR', CZE:'CZ', CAN:'CA', BIH:'BA', QAT:'QA', SUI:'CH',
    BRA:'BR', MAR:'MA', HAI:'HT', SCO:'SC', USA:'US', PAR:'PY', AUS:'AU', TUR:'TR',
    GER:'DE', CUW:'CW', CIV:'CI', ECU:'EC', NED:'NL', JPN:'JP', SWE:'SE', TUN:'TN',
    BEL:'BE', EGY:'EG', IRN:'IR', NZL:'NZ', ESP:'ES', CPV:'CV', KSA:'SA', URU:'UY',
    FRA:'FR', SEN:'SN', IRQ:'IQ', NOR:'NO', ARG:'AR', ALG:'DZ', AUT:'AT', JOR:'JO',
    POR:'PT', COD:'CD', UZB:'UZ', COL:'CO', ENG:'EN', CRO:'HR', GHA:'GH', PAN:'PA'
  };

  // ── Acceso seguro a globals (classic scripts: const top-level NO se expone como window.X) ──
  function _equipos() { return (typeof EQUIPOS !== 'undefined') ? EQUIPOS : (window.EQUIPOS || []); }
  function _partidos() { return (typeof PARTIDOS !== 'undefined') ? PARTIDOS : (window.PARTIDOS || []); }
  function _predictions() { return (typeof predictions !== 'undefined') ? predictions : (window.predictions || {}); }
  function _boostPicks() { return (typeof boostPicks !== 'undefined') ? boostPicks : (window.boostPicks || {}); }
  function _sb() { return (typeof SB !== 'undefined') ? SB : (window.SB || ''); }

  // ── Utils ───────────────────────────────────────────────
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => (
    { '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]
  ));

  // Parche 2 — Helper de código país desde EQUIPOS.
  function codeFor(teamName) {
    const e = _equipos().find(t => t.name === teamName);
    return ((e && e.flag) || String(teamName || '').slice(0, 3)).toUpperCase();
  }

  // Parche 3 — Patrón real del proyecto (replica _showJcardModal en ui-groups.js:666-667):
  // SB + '/miniatures/flags-sm/' + iso2 + '.webp' usando el map ISO3_TO_ISO2.
  function flagPath(teamName) {
    const iso3 = codeFor(teamName);
    const iso2 = ISO3_TO_ISO2[iso3] || iso3.slice(0, 2);
    return _sb() + '/miniatures/flags-sm/' + iso2 + '.webp';
  }

  function findMatch(matchKey) {
    const arr = _partidos();
    if (!Array.isArray(arr) || typeof window.getMatchKey !== 'function') return null;
    return arr.find(m => window.getMatchKey(m) === matchKey) || null;
  }

  function safeNum(v) { return (typeof v === 'number' && isFinite(v)) ? v : null; }

  // Para una métrica con dos valores, devuelve {leftPct, rightPct, leftWins, rightWins}
  // donde la suma de pcts <= 100 (cada lado proporcional al total).
  //   higherWins=true  → mayor gana (goles, posesión, %victorias)
  //   higherWins=false → menor gana (ranking FIFA, goles encajados)
  function splitBar(a, b, higherWins = true) {
    a = safeNum(a); b = safeNum(b);
    if (a == null || b == null) return { leftPct: 0, rightPct: 0, leftWins: false, rightWins: false };
    if (a === 0 && b === 0)     return { leftPct: 25, rightPct: 25, leftWins: false, rightWins: false };

    // Para "menor gana", invertimos antes de proporcionar.
    let na = higherWins ? a : (1 / Math.max(a, 0.0001));
    let nb = higherWins ? b : (1 / Math.max(b, 0.0001));
    const total = na + nb;
    const leftPct  = Math.round((na / total) * 50);  // 50 = mitad del ancho total
    const rightPct = Math.round((nb / total) * 50);
    const leftWins  = higherWins ? a > b : a < b;
    const rightWins = higherWins ? b > a : b < a;
    return { leftPct, rightPct, leftWins, rightWins };
  }

  function fmtVal(v, suffix) {
    if (v == null) return '—';
    const s = (typeof v === 'number') ? String(v) : esc(v);
    return suffix ? `${s}<small>${esc(suffix)}</small>` : s;
  }

  // ── Render ──────────────────────────────────────────────
  // Parche 1 — renderStatRow eliminada (dead code, statsHtml hace su propio inline).

  function renderFormDots(form /* "WWDLW" */) {
    if (!form) return '';
    const map = { W:'is-w G', D:'is-d E', L:'is-l P' };
    return form.split('').slice(0, 5).map(ch => {
      const cls = map[ch.toUpperCase()] || 'is-d E';
      const [mod, lbl] = cls.split(' ');
      return `<span class="stm-form__dot ${mod}">${lbl}</span>`;
    }).join('');
  }

  function renderH2HItem(item, homeCode, awayCode, homeTeam, awayTeam) {
    const winnerCls =
      item.scoreA > item.scoreB ? 'is-a-win' :
      item.scoreA < item.scoreB ? 'is-b-win' : 'is-draw';
    return `
      <div class="stm-h2h-item ${winnerCls}">
        <div class="stm-h2h-item__side">
          <span class="stm-h2h-item__flag"><img src="${flagPath(homeTeam)}" alt="" onerror="this.style.display='none'"/></span>
          <span>${esc(homeCode)}</span>
        </div>
        <div class="stm-h2h-item__core">
          <div class="stm-h2h-item__score">${item.scoreA} — ${item.scoreB}</div>
          <div class="stm-h2h-item__meta">${esc(item.date)} · ${esc(item.comp || '')}</div>
        </div>
        <div class="stm-h2h-item__side stm-h2h-item__side--away">
          <span class="stm-h2h-item__flag"><img src="${flagPath(awayTeam)}" alt="" onerror="this.style.display='none'"/></span>
          <span>${esc(awayCode)}</span>
        </div>
      </div>`;
  }

  // ── Meta del partido desde PARTIDOS + STADIUMS (no viene del payload EF) ──

  // Jornada N = índice (1-based) del día único entre los días distintos de PARTIDOS.
  // Partido M = posición (1-based) del match dentro de los partidos del mismo día.
  let _jornadaCache = null;
  function _jornadaInfo(match) {
    if (!_jornadaCache) {
      const arr = _partidos();
      const byDate = {};
      arr.forEach((m) => {
        const d = m.date ? String(m.date).substring(0, 10) : null;
        if (!d) return;
        if (!byDate[d]) byDate[d] = [];
        byDate[d].push(m);
      });
      const days = Object.keys(byDate).sort();
      _jornadaCache = { byDate, days };
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
    const monthShort = d.toLocaleDateString('es-ES', { month: 'short' }).toUpperCase().replace('.', '');
    const hh = String(d.getHours()).padStart(2, '0');
    const mm = String(d.getMinutes()).padStart(2, '0');
    return `${dow} · ${day} ${monthShort} · ${hh}:${mm}`;
  }

  function renderScreen(match, payload) {
    const matchKey = window.getMatchKey(match);
    const homeTeam = match.home, awayTeam = match.away;

    // Parche 4 — homeCode/awayCode vía EQUIPOS+codeFor().
    const homeCode = codeFor(homeTeam);
    const awayCode = codeFor(awayTeam);

    const pred = _predictions()[matchKey] || {};
    const hasPred = pred.l != null && pred.v != null;
    const live    = (window._liveScoresByMatchKey || {})[matchKey];
    const isFinal = live && live.status === 'finished';

    // boostPicks keyed por YYYY-MM-DD; match.date es ISO completo.
    const matchDate = match.date ? String(match.date).substring(0, 10) : '';
    const boostKey = matchDate ? _boostPicks()[matchDate] : null;
    const isBoost  = boostKey === matchKey;

    // Parche 7/8 — isGroupMatch: grupos llevan letra A-L en match.group; KO no.
    const isGroupMatch = !!match.group;

    // Sprint 2C — host = país anfitrión del Mundial (USA/MEX/CAN).
    const homeIso3 = codeFor(homeTeam);
    const aIsHost  = ['USA','MEX','CAN'].includes(homeIso3);

    // Sprint 2C — meta partido desde PARTIDOS + STADIUMS (no del payload).
    const { jornada, indexInJornada } = _jornadaInfo(match);
    const timeLine = _timeLabel(match);
    const stadium = (typeof window.stadiumForMatch === 'function')
      ? window.stadiumForMatch(match)
      : null;

    const s = payload || {};
    const stats = s.stats || {};
    const formA = s.form?.a || '';
    const formB = s.form?.b || '';
    // Sprint 2C — h2h_status drive el render (never_played / aggregates_only / has_detail).
    const h2hStatus = s.h2h_status || (s.h2h ? 'aggregates_only' : null);
    const h2h   = s.h2h || { aWins: 0, draws: 0, bWins: 0, last: [] };
    const league = s.league || null;
    const possPlaceholder = !!s.meta?.possession_placeholder;

    const rows = [
      { key:'fifaRank',  label:'Ranking FIFA',     suffix:null, prefix:'#', higherWins:false },
      { key:'goalsFor',  label:'Goles / partido',  suffix:null, higherWins:true },
      { key:'goalsAg',   label:'Goles encajados',  suffix:null, higherWins:false },
      { key:'possession',label:'Posesión media',   suffix:'%',  higherWins:true },
      { key:'winRate',   label:'% Victorias · forma',suffix:'%',  higherWins:true },
      { key:'avgAge',    label:'Edad media',       suffix:null, higherWins:null },
      { key:'value',     label:'Valor plantilla',  suffix:'M €',higherWins:true },
    ];

    const hasStatsData = rows.some(r => stats[r.key]?.a != null || stats[r.key]?.b != null);

    const statsHtml = rows.map(r => {
      const a = stats[r.key]?.a, b = stats[r.key]?.b;
      // Posesión es 50/50 placeholder en Sprint 2C — neutralizar barra y marcar
      // con asterisco "* aprox" mientras no haya fuente real.
      const isPlaceholderRow = r.key === 'possession' && possPlaceholder;
      // Si higherWins === null o placeholder → métrica neutral (no marca ganador).
      const sp = (r.higherWins == null || isPlaceholderRow)
        ? { leftPct: 25, rightPct: 25, leftWins: false, rightWins: false }
        : splitBar(a, b, r.higherWins);
      const sufA = isPlaceholderRow ? '% *' : r.suffix;
      const sufB = isPlaceholderRow ? '% *' : r.suffix;
      const valA = r.prefix ? `<small>${r.prefix}</small>${fmtVal(a)}` : fmtVal(a, sufA);
      const valB = r.prefix ? `<small>${r.prefix}</small>${fmtVal(b)}` : fmtVal(b, sufB);
      return `
        <div class="stm-stat-row">
          <div class="stm-stat-row__val stm-stat-row__val--left ${sp.leftWins ? 'is-winner' : ''}">${valA}</div>
          <div class="stm-stat-row__label">${esc(r.label)}${isPlaceholderRow ? ' <small style="opacity:.6">*aprox</small>' : ''}</div>
          <div class="stm-stat-row__val stm-stat-row__val--right ${sp.rightWins ? 'is-winner' : ''}">${valB}</div>
          <div class="stm-stat-row__bar">
            <span class="stm-stat-row__bar-left"  style="width:${sp.leftPct}%"></span>
            <span class="stm-stat-row__bar-right" style="width:${sp.rightPct}%"></span>
          </div>
        </div>`;
    }).join('');

    // h2h render según status (Sprint 2C):
    //  - never_played    → texto literal sin cabecera ni lista.
    //  - aggregates_only → cabecera W/D/W + mensaje "Detalle no disponible".
    //  - has_detail      → cabecera + lista (DESC, máx 5; EF ya devuelve last orientado A).
    let h2hSectionHtml;
    let h2hTotal = 0;
    if (h2hStatus === 'never_played') {
      h2hSectionHtml = '<div class="stm-section__empty">Sin enfrentamientos previos entre ambas selecciones</div>';
    } else if (h2hStatus === 'aggregates_only') {
      h2hTotal = (h2h.aWins || 0) + (h2h.draws || 0) + (h2h.bWins || 0);
      h2hSectionHtml =
        `<div class="stm-h2h-summary">
          <div class="stm-h2h-cell stm-h2h-cell--a"><div class="stm-h2h-cell__num">${h2h.aWins || 0}</div><div class="stm-h2h-cell__lbl">Victorias ${esc(homeCode)}</div></div>
          <div class="stm-h2h-cell stm-h2h-cell--d"><div class="stm-h2h-cell__num">${h2h.draws || 0}</div><div class="stm-h2h-cell__lbl">Empates</div></div>
          <div class="stm-h2h-cell stm-h2h-cell--b"><div class="stm-h2h-cell__num">${h2h.bWins || 0}</div><div class="stm-h2h-cell__lbl">Victorias ${esc(awayCode)}</div></div>
        </div>
        <div class="stm-section__empty">Detalle de partidos no disponible</div>`;
    } else if (h2hStatus === 'has_detail') {
      h2hTotal = (h2h.aWins || 0) + (h2h.draws || 0) + (h2h.bWins || 0);
      const list = (h2h.last || []).slice(0, 5)
        .map(item => renderH2HItem(item, homeCode, awayCode, homeTeam, awayTeam))
        .join('');
      h2hSectionHtml =
        `<div class="stm-h2h-summary">
          <div class="stm-h2h-cell stm-h2h-cell--a"><div class="stm-h2h-cell__num">${h2h.aWins || 0}</div><div class="stm-h2h-cell__lbl">Victorias ${esc(homeCode)}</div></div>
          <div class="stm-h2h-cell stm-h2h-cell--d"><div class="stm-h2h-cell__num">${h2h.draws || 0}</div><div class="stm-h2h-cell__lbl">Empates</div></div>
          <div class="stm-h2h-cell stm-h2h-cell--b"><div class="stm-h2h-cell__num">${h2h.bWins || 0}</div><div class="stm-h2h-cell__lbl">Victorias ${esc(awayCode)}</div></div>
        </div>
        <div class="stm-h2h-list">${list}</div>`;
    } else {
      // Sin payload aún o status desconocido → mensaje genérico.
      h2hSectionHtml = '<div class="stm-section__empty">Sin datos…</div>';
    }

    const leagueHtml = league
      ? `
        <div class="stm-league">
          <div class="stm-league__row stm-league__row--a ${league.myPick === '1' ? 'is-my-pick' : ''}">
            <div class="stm-league__name">
              <span class="stm-league__flag"><img src="${flagPath(homeTeam)}" alt="" onerror="this.style.display='none'"/></span>
              <span class="stm-league__code">${esc(homeCode)} gana</span>
            </div>
            <div class="stm-league__track"><span class="stm-league__fill" style="width:${league.pct1}%"></span></div>
            <div class="stm-league__pct">${league.pct1}%</div>
          </div>
          <div class="stm-league__row stm-league__row--d ${league.myPick === 'X' ? 'is-my-pick' : ''}">
            <div class="stm-league__name"><span class="stm-league__code" style="color:var(--ink-400)">Empate</span></div>
            <div class="stm-league__track"><span class="stm-league__fill" style="width:${league.pctX}%"></span></div>
            <div class="stm-league__pct">${league.pctX}%</div>
          </div>
          <div class="stm-league__row stm-league__row--b ${league.myPick === '2' ? 'is-my-pick' : ''}">
            <div class="stm-league__name">
              <span class="stm-league__flag"><img src="${flagPath(awayTeam)}" alt="" onerror="this.style.display='none'"/></span>
              <span class="stm-league__code">${esc(awayCode)} gana</span>
            </div>
            <div class="stm-league__track"><span class="stm-league__fill" style="width:${league.pct2}%"></span></div>
            <div class="stm-league__pct">${league.pct2}%</div>
          </div>
          ${league.topScore ? `
            <div class="stm-league__hint">
              <span>Marcador más predicho</span>
              <b>${esc(league.topScore.label)} · ${league.topScore.count} ${league.topScore.count === 1 ? 'jugador' : 'jugadores'}</b>
            </div>` : ''}
        </div>`
      : '<div class="stm-section__empty">Sin datos…</div>';

    // Sprint 2C — stadium line desde STADIUMS lookup, con fallback al texto crudo.
    const stadiumLine = stadium
      ? `📍 ${esc(stadium.name)} · ${esc(stadium.city)} · ${stadium.capacity.toLocaleString('es')} plazas`
      : (match.stadium ? `📍 ${esc(match.stadium)}` : '');

    // Parche 7 — eyebrow dinámico grupos vs KO. Jornada/Partido computados frontend.
    const stageLabel = isGroupMatch
      ? `Grupo ${esc(match.group)}`
      : esc(match.stage || 'Eliminatoria');
    const eyebrow = `Jornada ${esc(jornada || '?')} · ${stageLabel} · Partido ${esc(indexInJornada || '?')}`;

    return `
      <article class="stm-screen ${isFinal ? 'is-final' : ''}" id="${SCREEN_ID}" data-match-key="${esc(matchKey)}" aria-label="Datos comparativos ${esc(homeCode)} vs ${esc(awayCode)}">

        <nav class="stm-nav">
          <button class="stm-nav__back" type="button" onclick="closeTarjetaStats()" aria-label="Volver">
            <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M10 12 L5 8 L10 4"/></svg>
            <span>Jornada</span>
          </button>
          <div class="stm-nav__title">Datos del partido</div>
          ${isGroupMatch ? `
            <button class="stm-nav__boost ${isBoost ? '' : 'is-inactive'}" type="button"
                    onclick="jcardBoostToggle('${esc(matchKey)}','${esc(matchDate)}', {checked: ${!isBoost}})">
              ⚡ BOOST ×2
            </button>` : ''}
        </nav>

        <div class="stm-meta">
          <div class="stm-meta__eyebrow">${eyebrow}</div>
          ${timeLine ? `<div class="stm-meta__time">${esc(timeLine)}</div>` : ''}
          ${stadiumLine ? `<div class="stm-meta__stadium">${stadiumLine}</div>` : ''}
        </div>

        <div class="stm-hero">
          <div class="stm-team stm-team--a">
            <div class="stm-team__flag"><img src="${flagPath(homeTeam)}" alt="" onerror="this.style.display='none'"/></div>
            <div class="stm-team__name">${esc(homeTeam)}</div>
            ${aIsHost ? '<div class="stm-team__sub">Anfitrión · Local</div>' : '<div class="stm-team__sub">Local</div>'}
          </div>

          <div class="stm-score">
            <div class="stm-score__label">${isFinal ? 'Resultado' : 'Pronóstico'}</div>
            <div class="stm-score__nums ${hasPred || isFinal ? '' : 'is-empty'}">
              <span>${isFinal ? live.score_home : (hasPred ? pred.l : '—')}</span>
              <span class="stm-score__sep">–</span>
              <span>${isFinal ? live.score_away : (hasPred ? pred.v : '—')}</span>
            </div>
          </div>

          <div class="stm-team stm-team--b">
            <div class="stm-team__flag"><img src="${flagPath(awayTeam)}" alt="" onerror="this.style.display='none'"/></div>
            <div class="stm-team__name">${esc(awayTeam)}</div>
            <div class="stm-team__sub">Visitante</div>
          </div>
        </div>

        <div class="stm-body">

          <section class="stm-section">
            <div class="stm-section__title">Forma reciente <span class="stm-section__count">Últimos 5</span></div>
            ${formA || formB ? `
              <div class="stm-form">
                <div class="stm-form__side stm-form__side--left">${renderFormDots(formA)}</div>
                <div class="stm-form__sep">vs</div>
                <div class="stm-form__side stm-form__side--right">${renderFormDots(formB)}</div>
              </div>` : '<div class="stm-section__empty">Sin datos…</div>'}
          </section>

          <section class="stm-section">
            <div class="stm-section__title">Comparativa</div>
            ${hasStatsData ? statsHtml : '<div class="stm-section__empty">Sin datos…</div>'}
          </section>

          <section class="stm-section">
            <div class="stm-section__title">Cara a cara${h2hStatus === 'has_detail' || h2hStatus === 'aggregates_only' ? ` <span class="stm-section__count">${h2hTotal} enfrentamiento${h2hTotal === 1 ? '' : 's'}</span>` : ''}</div>
            ${h2hSectionHtml}
          </section>

          <section class="stm-section">
            <div class="stm-section__title">La liga opina <span class="stm-section__count">${league?.total || 0} pronósticos</span></div>
            ${leagueHtml}
          </section>

        </div>

        <div class="stm-footer">
          <div class="stm-footer__pts">
            <div class="stm-footer__pts-lbl">${isFinal ? 'Puntos obtenidos' : 'Pronóstico actual'}</div>
            <div class="stm-footer__pts-val">${
              isFinal
                ? `${esc(homeCode)} <b>${live.score_home} – ${live.score_away}</b> ${esc(awayCode)} · ${pred.points || 0} pts${isBoost ? ' ×2' : ''}`
                : hasPred
                  ? `${esc(homeCode)} <b>${pred.l} – ${pred.v}</b> ${esc(awayCode)}${isBoost ? ' · ⚡ Boost activo' : ''}`
                  : 'Sin pronóstico'
            }</div>
          </div>
          <button class="stm-footer__cta" type="button" onclick="closeTarjetaStats()">Volver</button>
        </div>
      </article>
    `;
  }

  // ── Mount / unmount ─────────────────────────────────────
  // El paquete original asumía que las pages vivían dentro de un .phone shell
  // y por eso hacía phone.appendChild. En este proyecto las pages
  // (page-jornada, page-grupos, ...) son hijas DIRECTAS de <body>, y .phone
  // es solo el header FIFA decorativo creado por mundial-shell-v3.js (109px).
  // Montar dentro del .phone deja la pantalla invisible.
  // Diagnóstico de San in-vivo: w:0 h:0 dentro de .phone vs w:358 h:1392 en body.
  function getMountTarget() {
    return document.body;
  }

  function hideOtherPages() {
    // IDs reales del index.html (verificados): page-welcome, page-grupos,
    // page-jornada, page-directo, page-predictor, page-elim, page-score, page-admin.
    ['page-jornada','page-directo','page-grupos','page-elim','page-score','page-admin','page-predictor','page-welcome'].forEach(id => {
      const el = document.getElementById(id);
      if (el && el.style.display !== 'none') {
        el.dataset.stmPrevDisplay = el.style.display || '';
        el.style.display = 'none';
      }
    });
  }

  function restoreOtherPages() {
    const back = document.getElementById(returnTo);
    if (back) {
      back.style.display = back.dataset.stmPrevDisplay || 'block';
      delete back.dataset.stmPrevDisplay;
    }
  }

  async function openTarjetaStats(matchKey) {
    const match = findMatch(matchKey);
    if (!match) { console.warn('[tarjeta-stats] match no encontrado:', matchKey); return; }

    // Memoria de retorno: última page visible antes de abrir.
    const visible = ['page-jornada','page-directo'].find(id => {
      const el = document.getElementById(id);
      return el && el.style.display !== 'none';
    });
    returnTo = visible || PAGE_JORNADA_ID;

    // Pintar shell con placeholders mientras llega payload.
    let payload = null;
    try {
      payload = (typeof window.fetchMatchStats === 'function')
        ? await window.fetchMatchStats(matchKey)
        : (window._tarjetaStatsMock?.[matchKey] || null);
    } catch (err) {
      console.error('[tarjeta-stats] fetchMatchStats falló:', err);
    }

    // Eliminar instancia previa.
    document.getElementById('page-tarjeta-stats')?.remove();
    document.getElementById(SCREEN_ID)?.remove();

    hideOtherPages();

    const wrap = document.createElement('div');
    wrap.id = 'page-tarjeta-stats';
    wrap.style.padding = '12px';
    wrap.innerHTML = renderScreen(match, payload);
    getMountTarget().appendChild(wrap);

    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function closeTarjetaStats() {
    document.getElementById('page-tarjeta-stats')?.remove();
    restoreOtherPages();
  }

  // ── Wire up ─────────────────────────────────────────────
  window.openTarjetaStats  = openTarjetaStats;
  window.closeTarjetaStats = closeTarjetaStats;

  // Parche 9 — NO sobrescribir window.openJcardModal. El flujo editable
  // desde Grupos sigue usando openJcardModal. La conexión Jornada → tarjeta
  // se hace cambiando el onclick del botón "Ver tarjeta" en ui-groups.js (§5.A).
})();
