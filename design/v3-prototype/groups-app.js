/* ============================================================
   MUNDIAL 2026 — Group Stage App (mobile)
   ============================================================ */

(function () {
  const STORAGE_KEY = 'mundial2026_predictions_v2';

  let predictions = loadPredictions();

  function loadPredictions() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  }
  function savePredictions() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(predictions)); } catch {}
  }

  function flagPath(slug) { return `flags/${slug}.svg`; }

  // ─── Board render ────────────────────────────────────
  function renderBoard() {
    const left  = document.querySelector('.column-left');
    const right = document.querySelector('.column-right');
    left.innerHTML = '';
    right.innerHTML = '';
    GROUPS.forEach((g, i) => {
      const el = renderGroup(g);
      (i < 6 ? left : right).appendChild(el);
    });
  }

  function renderGroup(group) {
    const div = document.createElement('div');
    div.className = 'group';
    div.dataset.letter = group.letter;
    div.style.setProperty('--g-color', group.color);
    div.style.setProperty('--g-glow', group.glow);

    const isComplete = isGroupComplete(group.letter);
    if (isComplete) div.classList.add('is-complete', 'has-standings');

    const tab = document.createElement('div');
    tab.className = 'group__tab';
    tab.textContent = group.letter;
    div.appendChild(tab);

    const card = document.createElement('div');
    card.className = 'group__card';

    if (isComplete) {
      const standings = computeStandings(group);
      standings.forEach((row, idx) => {
        const team = group.teams[row.teamIdx];
        const r = document.createElement('div');
        r.className = 'team-row';
        if (idx < 2) r.classList.add('is-qualified');
        r.innerHTML = `
          <div class="team-row__pos">${idx + 1}</div>
          <div class="team-row__code">${team.name}</div>
          <div class="team-row__flag"><img src="${flagPath(team.flag)}" alt="${team.code}" loading="lazy"/></div>
          <div class="team-row__pts">${row.pts}</div>
        `;
        card.appendChild(r);
      });
    } else {
      group.teams.forEach(team => {
        const r = document.createElement('div');
        r.className = 'team-row';
        r.innerHTML = `
          <div class="team-row__code">${team.name}</div>
          <div class="team-row__flag"><img src="${flagPath(team.flag)}" alt="${team.code}" loading="lazy"/></div>
        `;
        card.appendChild(r);
      });
    }

    div.appendChild(card);
    div.addEventListener('click', () => openZoom(group.letter));
    return div;
  }

  function isGroupComplete(letter) {
    const p = predictions[letter];
    if (!p) return false;
    return p.length === 6 && p.every(m => Number.isInteger(m.home) && Number.isInteger(m.away));
  }
  function countFilled(letter) {
    const p = predictions[letter] || [];
    return p.filter(m => Number.isInteger(m.home) && Number.isInteger(m.away)).length;
  }

  // ─── Standings calc ──────────────────────────────────
  function computeStandings(group) {
    const p = predictions[group.letter] || [];
    const stats = group.teams.map((_, i) => ({
      teamIdx: i, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, gd: 0, pts: 0
    }));
    PAIRINGS.forEach((pair, idx) => {
      const m = p[idx];
      if (!m || !Number.isInteger(m.home) || !Number.isInteger(m.away)) return;
      const [hi, ai] = pair;
      const h = stats[hi], a = stats[ai];
      h.pj++; a.pj++;
      h.gf += m.home; h.gc += m.away;
      a.gf += m.away; a.gc += m.home;
      if (m.home > m.away)      { h.pts += 3; h.pg++; a.pp++; }
      else if (m.home < m.away) { a.pts += 3; a.pg++; h.pp++; }
      else                      { h.pts += 1; a.pts += 1; h.pe++; a.pe++; }
    });
    stats.forEach(s => s.gd = s.gf - s.gc);
    stats.sort((a,b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.teamIdx - b.teamIdx);
    return stats;
  }

  // ─── Zoom Overlay ────────────────────────────────────
  let currentLetter = null;
  let currentTab = 'predictions';

  function openZoom(letter) {
    currentLetter = letter;
    currentTab = isGroupComplete(letter) ? 'standings' : 'predictions';
    renderZoom();
    document.querySelector('.zoom-overlay').classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeZoom() {
    document.querySelector('.zoom-overlay').classList.remove('is-open');
    document.body.style.overflow = '';
    currentLetter = null;
    renderBoard();
  }

  function renderZoom() {
    const group = GROUPS.find(g => g.letter === currentLetter);
    if (!group) return;
    const inner = document.querySelector('.zoom-panel__inner');
    inner.style.setProperty('--zoom-color', group.color);
    inner.style.setProperty('--zoom-glow', group.glow);

    const filled = countFilled(group.letter);
    const total = 6;
    const isDone = filled === total;

    inner.innerHTML = `
      <div class="zoom-header">
        <div class="zoom-header__letter">${group.letter}</div>
        <div class="zoom-header__title">
          <div class="zoom-header__eyebrow">Grupo ${group.letter} · Fase de Grupos</div>
          <h2 class="zoom-header__name">Pronostica el Grupo ${group.letter}</h2>
        </div>
        <button class="zoom-close" aria-label="Cerrar (ESC)" data-close>✕</button>
      </div>
      <div class="zoom-body">
        <div class="zoom-tabs">
          <button class="zoom-tab ${currentTab==='predictions'?'is-active':''}" data-tab="predictions">Pronósticos</button>
          <button class="zoom-tab ${currentTab==='standings'?'is-active':''}" data-tab="standings" ${isDone?'':'disabled'}>
            Clasificación ${isDone ? '' : `(${filled}/${total})`}
          </button>
        </div>
        <div data-view="predictions" ${currentTab==='predictions'?'':'hidden'}>
          ${renderMatchesList(group)}
          <div class="zoom-footer">
            <div class="zoom-progress">
              <div class="zoom-progress__label">${filled} de ${total} marcadores</div>
              <div class="zoom-progress__bar"><div class="zoom-progress__fill" style="width:${(filled/total)*100}%"></div></div>
            </div>
            <button class="zoom-cta" data-show-standings ${isDone?'':'disabled'}>
              ${isDone ? 'Clasificación →' : `Falta${total-filled===1?'':'n'} ${total-filled}`}
            </button>
          </div>
        </div>
        <div data-view="standings" ${currentTab==='standings'?'':'hidden'}>
          ${renderStandingsTable(group)}
          <div class="qualif-legend">Top 2 clasifican a la fase eliminatoria</div>
          <div class="zoom-footer">
            <div class="zoom-progress">
              <div class="zoom-progress__label">Pronósticos guardados</div>
              <div class="zoom-progress__bar"><div class="zoom-progress__fill" style="width:100%"></div></div>
            </div>
            <button class="zoom-cta" data-show-predictions>Editar</button>
          </div>
        </div>
      </div>
    `;

    inner.querySelector('[data-close]').onclick = closeZoom;
    inner.querySelectorAll('[data-tab]').forEach(btn => {
      btn.onclick = () => { if (btn.disabled) return; currentTab = btn.dataset.tab; renderZoom(); };
    });
    const showSt = inner.querySelector('[data-show-standings]');
    if (showSt) showSt.onclick = () => { currentTab = 'standings'; renderZoom(); };
    const showPr = inner.querySelector('[data-show-predictions]');
    if (showPr) showPr.onclick = () => { currentTab = 'predictions'; renderZoom(); };
    inner.querySelectorAll('[data-stepper]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        adjustScore(group.letter, +btn.dataset.match, btn.dataset.side, +btn.dataset.delta);
      };
    });
  }

  function renderMatchesList(group) {
    const p = predictions[group.letter] || [];
    let html = '<div class="matches-list">';
    let lastDay = null;
    PAIRINGS.forEach((pair, idx) => {
      const day = MATCH_DAY[idx];
      if (day !== lastDay) {
        html += `<div class="match-day-label">Jornada ${day.slice(1)}</div>`;
        lastDay = day;
      }
      const home = group.teams[pair[0]];
      const away = group.teams[pair[1]];
      const m = p[idx] || {};
      const hasHome = Number.isInteger(m.home);
      const hasAway = Number.isInteger(m.away);
      const filled = hasHome && hasAway;
      html += `
        <div class="match-card ${filled?'is-filled':''}">
          <div class="match-side match-side--home">
            <div class="match-side__flag"><img src="${flagPath(home.flag)}" alt="${home.code}" loading="lazy"/></div>
            <div class="match-side__name">${home.code}</div>
          </div>
          <div class="match-score">
            <div class="score-stepper">
              <button class="score-btn" data-stepper data-match="${idx}" data-side="home" data-delta="1" aria-label="+1 ${home.code}">▲</button>
              <div class="score-val ${hasHome?'':'is-empty'}">${hasHome ? m.home : '–'}</div>
              <button class="score-btn" data-stepper data-match="${idx}" data-side="home" data-delta="-1" aria-label="-1 ${home.code}">▼</button>
            </div>
            <div class="score-sep">:</div>
            <div class="score-stepper">
              <button class="score-btn" data-stepper data-match="${idx}" data-side="away" data-delta="1" aria-label="+1 ${away.code}">▲</button>
              <div class="score-val ${hasAway?'':'is-empty'}">${hasAway ? m.away : '–'}</div>
              <button class="score-btn" data-stepper data-match="${idx}" data-side="away" data-delta="-1" aria-label="-1 ${away.code}">▼</button>
            </div>
          </div>
          <div class="match-side match-side--away">
            <div class="match-side__flag"><img src="${flagPath(away.flag)}" alt="${away.code}" loading="lazy"/></div>
            <div class="match-side__name">${away.code}</div>
          </div>
        </div>
      `;
    });
    html += '</div>';
    return html;
  }

  function renderStandingsTable(group) {
    const standings = computeStandings(group);
    let html = `
      <div class="standings-table">
        <div class="standings-head">
          <div class="st-pos">#</div>
          <div>Selección</div>
          <div class="st-num" title="Partidos jugados">PJ</div>
          <div class="st-num" title="Goles a favor">GF</div>
          <div class="st-num" title="Goles en contra">GC</div>
          <div class="st-num" title="Diferencia de goles">DG</div>
          <div class="st-pts" title="Puntos">PTS</div>
        </div>
    `;
    standings.forEach((row, idx) => {
      const team = group.teams[row.teamIdx];
      html += `
        <div class="standings-row ${idx < 2 ? 'is-qualified' : ''}">
          <div class="st-pos">${idx+1}</div>
          <div class="st-team">
            <div class="st-flag"><img src="${flagPath(team.flag)}" alt="${team.code}"/></div>
            <div class="st-name">${team.code}</div>
          </div>
          <div class="st-num">${row.pj}</div>
          <div class="st-num">${row.gf}</div>
          <div class="st-num">${row.gc}</div>
          <div class="st-num">${row.gd > 0 ? '+'+row.gd : row.gd}</div>
          <div class="st-pts">${row.pts}</div>
        </div>
      `;
    });
    html += '</div>';
    return html;
  }

  function adjustScore(letter, matchIdx, side, delta) {
    if (!predictions[letter]) predictions[letter] = [];
    const p = predictions[letter];
    if (!p[matchIdx]) p[matchIdx] = {};
    const cur = Number.isInteger(p[matchIdx][side]) ? p[matchIdx][side] : 0;
    p[matchIdx][side] = Math.max(0, Math.min(15, cur + delta));
    const other = side === 'home' ? 'away' : 'home';
    if (!Number.isInteger(p[matchIdx][other])) p[matchIdx][other] = 0;
    savePredictions();
    renderZoom();
  }

  // ─── ESC + backdrop close ─────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && currentLetter) closeZoom();
  });
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('zoom-overlay')) closeZoom();
  });

  // ─── Demo/reset ──────────────────────────────────────
  function bindResetBtn() {
    const btn = document.querySelector('[data-reset]');
    if (!btn) return;
    btn.onclick = () => {
      if (!confirm('¿Borrar todos los pronósticos guardados?')) return;
      predictions = {};
      savePredictions();
      renderBoard();
    };
  }
  function bindDemoBtn() {
    const btn = document.querySelector('[data-demo]');
    if (!btn) return;
    btn.onclick = () => {
      predictions = {
        'A': [{home:2,away:1},{home:1,away:1},{home:0,away:2},{home:3,away:0},{home:1,away:2},{home:2,away:2}],
        'B': [{home:1,away:0},{home:2,away:2},{home:3,away:1},{home:0,away:1},{home:1,away:1},{home:2,away:0}],
        'C': [{home:3,away:0},{home:1,away:2}],
        'H': [{home:2,away:0},{home:0,away:1},{home:3,away:0},{home:1,away:0},{home:2,away:1},{home:0,away:0}]
      };
      savePredictions();
      renderBoard();
    };
  }

  // ─── Trophy image fallback ───────────────────────────
  function bindTrophyFallback() {
    const img = document.querySelector('.trophy');
    if (!img) return;
    img.addEventListener('error', () => {
      img.closest('.trophy-col').classList.add('is-fallback');
    }, { once: true });
  }

  // ─── Countdown a kickoff (11 jun 2026 18:00 UTC) ─────
  function startCountdown() {
    const target = new Date('2026-06-11T18:00:00Z').getTime();
    const $d = document.querySelector('[data-countdown="days"]');
    const $h = document.querySelector('[data-countdown="hours"]');
    const $m = document.querySelector('[data-countdown="minutes"]');
    const $s = document.querySelector('[data-countdown="seconds"]');
    if (!$d) return;
    const pad = n => String(n).padStart(2, '0');
    function tick() {
      let diff = Math.max(0, target - Date.now());
      const d = Math.floor(diff / 86400000); diff -= d * 86400000;
      const h = Math.floor(diff / 3600000);  diff -= h * 3600000;
      const m = Math.floor(diff / 60000);    diff -= m * 60000;
      const s = Math.floor(diff / 1000);
      $d.textContent = pad(d);
      $h.textContent = pad(h);
      $m.textContent = pad(m);
      $s.textContent = pad(s);
    }
    tick();
    setInterval(tick, 1000);
  }

  // ─── Init ────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    renderBoard();
    bindResetBtn();
    bindDemoBtn();
    bindTrophyFallback();
    startCountdown();
  });
})();
