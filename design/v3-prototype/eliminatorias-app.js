/* ============================================================
   ELIMINATORIAS 2026 — App
   ============================================================ */

(function () {
  const STORAGE_KEY = 'mundial2026_ko_predictions_v1';

  // predictions[matchId] = { home: int, away: int, penaltyWinner: 'home'|'away'|null }
  let predictions = loadPredictions();

  function loadPredictions() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)) || {}; }
    catch { return {}; }
  }
  function savePredictions() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(predictions)); } catch {}
  }

  function flagPath(slug) {
    if (!slug) return null;
    return `flags/${slug}.svg`;
  }

  let currentRound = 'R32';

  // ─── Render switcher ─────────────────────────────────
  function renderSwitcher() {
    const wrap = document.querySelector('.round-switcher');
    wrap.innerHTML = '';
    KO_ROUNDS.forEach(r => {
      const btn = document.createElement('button');
      btn.className = 'round-pill' + (r.key === currentRound ? ' is-active' : '');
      btn.dataset.round = r.key;
      btn.textContent = r.label;
      if (r.key === currentRound) {
        btn.style.setProperty('--r-color', r.color);
        btn.style.setProperty('--r-glow', r.glow);
      }
      btn.onclick = () => {
        currentRound = r.key;
        renderAll();
      };
      wrap.appendChild(btn);
    });
  }

  // ─── Render board ────────────────────────────────────
  function renderBoard() {
    const board = document.querySelector('.board');
    const left = board.querySelector('.column-left');
    const right = board.querySelector('.column-right');
    const finalAbove = document.querySelector('.final-stack--above');
    const finalBelow = document.querySelector('.final-stack--below');

    // Clean
    left.innerHTML = '';
    right.innerHTML = '';
    if (finalAbove) finalAbove.innerHTML = '';
    if (finalBelow) finalBelow.innerHTML = '';

    // Round class on board
    board.className = 'board ko-board--' + currentRound;

    const round = KO_ROUNDS.find(r => r.key === currentRound);

    if (round.key === 'F') {
      renderFinalBlock(round);
      return;
    }

    // Bracket: split matches in 2 columns
    const half = Math.ceil(round.matches.length / 2);
    const leftMatches  = round.matches.slice(0, half);
    const rightMatches = round.matches.slice(half);

    leftMatches.forEach(m => left.appendChild(renderKoCard(m, round)));
    rightMatches.forEach(m => right.appendChild(renderKoCard(m, round)));
  }

  function renderKoCard(match, round) {
    const div = document.createElement('div');
    div.className = 'ko-card';
    div.dataset.match = match.id;
    div.style.setProperty('--k-color', round.color);
    div.style.setProperty('--k-glow', round.glow);

    const pred = predictions[match.id];
    const decided = isDecided(pred);
    if (decided) div.classList.add('is-decided');

    const homeFlag = match.home.flag ? `<img src="${flagPath(match.home.flag)}" alt=""/>` : '';
    const awayFlag = match.away.flag ? `<img src="${flagPath(match.away.flag)}" alt=""/>` : '';

    const homeScore = pred && Number.isInteger(pred.home) ? pred.home : '–';
    const awayScore = pred && Number.isInteger(pred.away) ? pred.away : '–';
    const homeEmpty = homeScore === '–' ? 'is-empty' : '';
    const awayEmpty = awayScore === '–' ? 'is-empty' : '';

    const winner = decided ? resolveWinner(pred) : null;
    const homeWin = winner === 'home' ? 'is-winner' : '';
    const awayWin = winner === 'away' ? 'is-winner' : '';

    div.innerHTML = `
      <div class="ko-card__tag">${match.id}</div>
      <div class="ko-card__body">
        <div class="ko-row ${homeWin}">
          <div class="ko-row__code">${match.home.code}</div>
          <div class="ko-row__flag">${homeFlag}</div>
          <div class="ko-row__score ${homeEmpty}">${homeScore}</div>
        </div>
        <div class="ko-row ${awayWin}">
          <div class="ko-row__code">${match.away.code}</div>
          <div class="ko-row__flag">${awayFlag}</div>
          <div class="ko-row__score ${awayEmpty}">${awayScore}</div>
        </div>
      </div>
    `;
    div.addEventListener('click', () => openZoom(match, round));
    return div;
  }

  function renderFinalBlock(round) {
    const aboveContainer = document.querySelector('.final-stack--above');
    const belowContainer = document.querySelector('.final-stack--below');
    if (!aboveContainer || !belowContainer) return;

    const finalMatch = round.matches.find(m => m.kind === 'final');
    const thirdMatch = round.matches.find(m => m.kind === 'third');

    // FINAL encima del trofeo · 3er puesto debajo
    if (finalMatch) aboveContainer.appendChild(renderFinalCard(finalMatch, round, 'final'));
    if (thirdMatch) belowContainer.appendChild(renderFinalCard(thirdMatch, round, 'third'));
  }

  function renderFinalCard(match, round, kind) {
    const div = document.createElement('div');
    div.className = 'final-card' + (kind === 'third' ? ' final-card--third' : '');
    div.dataset.match = match.id;

    const pred = predictions[match.id];
    const decided = isDecided(pred);
    if (decided) div.classList.add('is-decided');

    const winner = decided ? resolveWinner(pred) : null;
    const winnerCode = winner === 'home' ? match.home.code : winner === 'away' ? match.away.code : null;

    const homeFlag = match.home.flag ? `<img src="${flagPath(match.home.flag)}" alt=""/>` : '';
    const awayFlag = match.away.flag ? `<img src="${flagPath(match.away.flag)}" alt=""/>` : '';

    const homeScore = pred && Number.isInteger(pred.home) ? pred.home : '–';
    const awayScore = pred && Number.isInteger(pred.away) ? pred.away : '–';
    const empty = !pred || !Number.isInteger(pred.home);

    const eyebrow = kind === 'final' ? '🏆 GRAN FINAL' : '🥉 3.er PUESTO';
    const winnerBadge = winnerCode
      ? `<div class="final-card__winner">${kind === 'final' ? '🏆 Campeón' : '🥉 Bronce'} · ${winnerCode}</div>`
      : '';

    div.innerHTML = `
      ${winnerBadge}
      <div class="final-card__eyebrow">${eyebrow}</div>
      <div class="final-card__match">
        <div class="final-card__side">
          <div class="final-card__flag">${homeFlag}</div>
          <div class="final-card__code">${match.home.code}</div>
        </div>
        <div class="final-card__score ${empty ? 'is-empty' : ''}">
          ${empty ? 'vs' : `${homeScore} – ${awayScore}`}
        </div>
        <div class="final-card__side">
          <div class="final-card__flag">${awayFlag}</div>
          <div class="final-card__code">${match.away.code}</div>
        </div>
      </div>
    `;
    div.addEventListener('click', () => openZoom(match, round));
    return div;
  }

  // ─── Predicción helpers ──────────────────────────────
  function isDecided(pred) {
    if (!pred || !Number.isInteger(pred.home) || !Number.isInteger(pred.away)) return false;
    if (pred.home === pred.away) return !!pred.penaltyWinner;
    return true;
  }
  function resolveWinner(pred) {
    if (!pred) return null;
    if (pred.home > pred.away) return 'home';
    if (pred.away > pred.home) return 'away';
    return pred.penaltyWinner || null;
  }

  // ─── Zoom overlay ────────────────────────────────────
  let currentMatch = null;
  let currentRoundObj = null;

  function openZoom(match, round) {
    currentMatch = match;
    currentRoundObj = round;
    renderZoom();
    document.querySelector('.zoom-overlay').classList.add('is-open');
    document.body.style.overflow = 'hidden';
  }

  function closeZoom() {
    document.querySelector('.zoom-overlay').classList.remove('is-open');
    document.body.style.overflow = '';
    currentMatch = null;
    renderAll();
  }

  function renderZoom() {
    const match = currentMatch;
    const round = currentRoundObj;
    if (!match) return;

    const inner = document.querySelector('.zoom-panel__inner');
    inner.style.setProperty('--zoom-color', round.color);
    inner.style.setProperty('--zoom-glow', round.glow);

    const pred = predictions[match.id] || {};
    const hasHome = Number.isInteger(pred.home);
    const hasAway = Number.isInteger(pred.away);
    const isDraw = hasHome && hasAway && pred.home === pred.away;
    const decided = isDecided(pred);
    const winner = decided ? resolveWinner(pred) : null;

    const eyebrow = match.kind === 'final' ? 'Gran Final · M' + match.id.replace('M','')
                  : match.kind === 'third' ? 'Tercer Puesto · M' + match.id.replace('M','')
                  : `${round.label} · ${match.id}`;
    const title = match.kind === 'final' ? '🏆 Final del Mundial'
                : match.kind === 'third' ? '🥉 3.er Puesto'
                : `${match.home.code} vs ${match.away.code}`;

    const homeFlag = match.home.flag ? `<img src="${flagPath(match.home.flag)}" alt=""/>` : '';
    const awayFlag = match.away.flag ? `<img src="${flagPath(match.away.flag)}" alt=""/>` : '';

    inner.innerHTML = `
      <div class="zoom-header">
        <div class="zoom-header__letter">${match.id.replace('M','')}</div>
        <div class="zoom-header__title">
          <div class="zoom-header__eyebrow">${eyebrow}</div>
          <h2 class="zoom-header__name">${title}</h2>
        </div>
        <button class="zoom-close" aria-label="Cerrar (ESC)" data-close>✕</button>
      </div>
      <div class="zoom-body">
        <div class="zoom-ko-match">
          <div class="zoom-ko-side">
            <div class="zoom-ko-side__flag">${homeFlag}</div>
            <div class="zoom-ko-side__code">${match.home.code}</div>
            <div class="zoom-ko-side__label">${match.home.label}</div>
          </div>
          <div class="zoom-ko-score">
            <div class="score-stepper">
              <button class="score-btn" data-stepper data-side="home" data-delta="1">▲</button>
              <div class="score-val ${hasHome?'':'is-empty'}">${hasHome ? pred.home : '–'}</div>
              <button class="score-btn" data-stepper data-side="home" data-delta="-1">▼</button>
            </div>
            <div class="score-sep">:</div>
            <div class="score-stepper">
              <button class="score-btn" data-stepper data-side="away" data-delta="1">▲</button>
              <div class="score-val ${hasAway?'':'is-empty'}">${hasAway ? pred.away : '–'}</div>
              <button class="score-btn" data-stepper data-side="away" data-delta="-1">▼</button>
            </div>
          </div>
          <div class="zoom-ko-side">
            <div class="zoom-ko-side__flag">${awayFlag}</div>
            <div class="zoom-ko-side__code">${match.away.code}</div>
            <div class="zoom-ko-side__label">${match.away.label}</div>
          </div>
        </div>

        ${isDraw ? `
        <div class="zoom-ko-penalty">
          <div class="zoom-ko-penalty__label">⚽ Empate · ¿Quién gana en penaltis?</div>
          <div class="zoom-ko-penalty__btns">
            <button class="zoom-ko-penalty__btn ${pred.penaltyWinner==='home'?'is-active':''}" data-pen="home">${match.home.code}</button>
            <button class="zoom-ko-penalty__btn ${pred.penaltyWinner==='away'?'is-active':''}" data-pen="away">${match.away.code}</button>
          </div>
        </div>` : ''}

        ${decided ? `
        <div class="zoom-ko-summary">
          Pasa a la siguiente ronda: <strong>${winner === 'home' ? match.home.code : match.away.code}</strong>
          ${isDraw ? ' (en penaltis)' : ''}
        </div>` : `
        <div class="zoom-ko-summary">
          ${hasHome && hasAway ? '⚠️ Marca quién gana en penaltis' : 'Introduce el marcador final'}
        </div>`}
      </div>
    `;

    inner.querySelector('[data-close]').onclick = closeZoom;
    inner.querySelectorAll('[data-stepper]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        adjustScore(match.id, btn.dataset.side, +btn.dataset.delta);
      };
    });
    inner.querySelectorAll('[data-pen]').forEach(btn => {
      btn.onclick = (e) => {
        e.stopPropagation();
        setPenaltyWinner(match.id, btn.dataset.pen);
      };
    });
  }

  function adjustScore(matchId, side, delta) {
    if (!predictions[matchId]) predictions[matchId] = {};
    const p = predictions[matchId];
    const cur = Number.isInteger(p[side]) ? p[side] : 0;
    p[side] = Math.max(0, Math.min(15, cur + delta));
    const other = side === 'home' ? 'away' : 'home';
    if (!Number.isInteger(p[other])) p[other] = 0;
    // Si ya no hay empate, reseteamos penaltyWinner
    if (p.home !== p.away) p.penaltyWinner = null;
    savePredictions();
    renderZoom();
  }

  function setPenaltyWinner(matchId, side) {
    if (!predictions[matchId]) return;
    predictions[matchId].penaltyWinner = side;
    savePredictions();
    renderZoom();
  }

  // ─── ESC + backdrop close ────────────────────────────
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && currentMatch) closeZoom();
  });
  document.addEventListener('click', (e) => {
    if (e.target.classList.contains('zoom-overlay')) closeZoom();
  });

  // ─── Buttons ─────────────────────────────────────────
  function bindResetBtn() {
    const btn = document.querySelector('[data-reset]');
    if (!btn) return;
    btn.onclick = () => {
      if (!confirm('¿Borrar todos los pronósticos de eliminatorias?')) return;
      predictions = {};
      savePredictions();
      renderAll();
    };
  }
  function bindDemoBtn() {
    const btn = document.querySelector('[data-demo]');
    if (!btn) return;
    btn.onclick = () => {
      // R32 (M73-M88) todos pronosticados
      for (let i = 73; i <= 88; i++) {
        const h = Math.floor(Math.random()*4);
        const a = Math.floor(Math.random()*4);
        predictions['M'+i] = { home: h, away: a, penaltyWinner: h===a?'home':null };
      }
      // R16 algunas (M89-M92)
      for (let i = 89; i <= 92; i++) {
        predictions['M'+i] = { home: 2, away: 1, penaltyWinner: null };
      }
      // Una QF (M97)
      predictions['M97'] = { home: 0, away: 0, penaltyWinner: 'away' };
      // Final + 3rd place demo
      predictions['M104'] = { home: 2, away: 1, penaltyWinner: null };
      predictions['M103'] = { home: 3, away: 2, penaltyWinner: null };
      savePredictions();
      renderAll();
    };
  }

  // ─── Trophy fallback ─────────────────────────────────
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
    const $days = document.querySelector('[data-countdown="days"]');
    const $hours = document.querySelector('[data-countdown="hours"]');
    const $minutes = document.querySelector('[data-countdown="minutes"]');
    const $seconds = document.querySelector('[data-countdown="seconds"]');
    if (!$days) return;
    function pad(n) { return String(n).padStart(2, '0'); }
    function tick() {
      let diff = Math.max(0, target - Date.now());
      const d = Math.floor(diff / 86400000); diff -= d * 86400000;
      const h = Math.floor(diff / 3600000);  diff -= h * 3600000;
      const m = Math.floor(diff / 60000);    diff -= m * 60000;
      const s = Math.floor(diff / 1000);
      $days.textContent = pad(d);
      $hours.textContent = pad(h);
      $minutes.textContent = pad(m);
      $seconds.textContent = pad(s);
    }
    tick();
    setInterval(tick, 1000);
  }

  // ─── Render all ──────────────────────────────────────
  function renderAll() {
    renderSwitcher();
    renderBoard();
  }

  // ─── Init ────────────────────────────────────────────
  document.addEventListener('DOMContentLoaded', () => {
    renderAll();
    bindResetBtn();
    bindDemoBtn();
    bindTrophyFallback();
    startCountdown();
  });
})();
