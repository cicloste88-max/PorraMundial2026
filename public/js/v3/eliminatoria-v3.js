// v3/eliminatoria-v3.js — Porte del bracket KO del prototipo v3
// Reusa koPredictions, resolvedSlots, resolveKO de ko.js
// Expone: window.v3ElimMount()
// NO auto-init — padre (página KO real) llama window.v3ElimMount()

// F2 integración (padre Opus): mapping 3-letras FIFA → slug v3 para flag URL.
// El brief lo proveía pero el agente Haiku no lo aplicó (construyó URL incorrecta
// "/flags/MEX.svg"). Reusa el mismo mapping que grupos-v3.js. F3 cleanup puede
// extraerlo a shell común.
var V3_FLAG_SLUG_ELIM = {
  MEX:'Mexico', RSA:'SouthAfrica', KOR:'KoreaRepublic', CZE:'Czechia',
  CAN:'Canada', BIH:'Bosnia', QAT:'Qatar', SUI:'Switzerland',
  BRA:'Brazil', MAR:'Morocco', HAI:'Haiti', SCO:'Scotland',
  USA:'USA', PAR:'Paraguay', AUS:'Australia', TUR:'Turkiye',
  GER:'Germany', CUW:'Curacao', CIV:'CoteIvoire', ECU:'Ecuador',
  NED:'Netherlands', JPN:'Japan', SWE:'Sweden', TUN:'Tunisia',
  BEL:'Belgium', EGY:'Egypt', IRN:'Iran', NZL:'NewZealand',
  ESP:'Spain', CPV:'CaboVerde', KSA:'SaudiArabia', URU:'Uruguay',
  FRA:'France', SEN:'Senegal', IRQ:'Iraq', NOR:'Norway',
  ARG:'Argentina', ALG:'Algeria', AUT:'Austria', JOR:'Jordan',
  POR:'Portugal', COD:'CongoDR', UZB:'Uzbekistan', COL:'Colombia',
  ENG:'England', CRO:'Croatia', GHA:'Ghana', PAN:'Panama'
};
function v3FlagURLByCode(code) {
  if (!code) return null;
  var slug = V3_FLAG_SLUG_ELIM[code] || code;
  return window.flagPath ? window.flagPath(slug) : '/flags/redesign v3/' + encodeURIComponent(slug + '.svg');
}

var _v3ElimInited = false;

window.v3ElimMount = function() {
  if (_v3ElimInited) {
    v3RenderAll();
    return;
  }
  _v3ElimInited = true;

  // Buscar o crear contenedor mount
  var mount = document.getElementById('v3-elim-mount');
  if (!mount) {
    var pageElim = document.getElementById('page-elim');
    if (!pageElim) return console.warn('No page-elim container found');
    mount = document.createElement('div');
    mount.id = 'v3-elim-mount';
    pageElim.appendChild(mount);
  }

  // Estructura HTML inicial
  mount.innerHTML = '';

  var switcher = document.createElement('div');
  switcher.className = 'v3-round-switcher';
  switcher.id = 'v3-round-switcher';
  mount.appendChild(switcher);

  var board = document.createElement('div');
  board.className = 'v3-bracket-board';
  board.id = 'v3-bracket-board';
  mount.appendChild(board);

  var actions = document.createElement('div');
  actions.className = 'v3-actions';
  actions.innerHTML = `
    <button class="v3-btn" data-v3-elim-dice>🎲 Simular KO</button>
    <button class="v3-btn v3-btn--danger" data-v3-elim-reset>Borrar KO</button>
  `;
  mount.appendChild(actions);

  // Bind event listeners
  v3BindButtonsAndSwitcher();

  // Initial render
  v3RenderAll();
};

// ─── State ──────────────────────────────────────────────────
var v3CurrentRound = 'r32';
var v3RoundMeta = {
  r32: { label: '16avos', color: '#60a5fa', glow: 'rgba(96,165,250,.55)' },
  r16: { label: '8vos', color: '#a78bfa', glow: 'rgba(167,139,250,.55)' },
  qf: { label: '4tos', color: '#fb923c', glow: 'rgba(251,146,60,.55)' },
  sf: { label: 'Semis', color: '#c4f046', glow: 'rgba(196,240,70,.55)' },
  f: { label: 'Final', color: '#C9A961', glow: 'rgba(201,169,97,.6)' }
};

var v3CurrentMatch = null;
var v3CurrentRoundObj = null;

// ─── Render switcher ────────────────────────────────────────
function v3RenderSwitcher() {
  var wrap = document.getElementById('v3-round-switcher');
  if (!wrap) return;
  wrap.innerHTML = '';

  var rounds = ['r32', 'r16', 'qf', 'sf', 'f'];
  rounds.forEach(function(key) {
    var meta = v3RoundMeta[key];
    if (!meta) return;

    var btn = document.createElement('button');
    btn.className = 'v3-round-pill' + (key === v3CurrentRound ? ' is-active' : '');
    btn.dataset.round = key;
    btn.textContent = meta.label.toUpperCase();

    if (key === v3CurrentRound) {
      btn.style.setProperty('--r-color', meta.color);
      btn.style.setProperty('--r-glow', meta.glow);
    }

    btn.onclick = function() {
      v3CurrentRound = key;
      v3RenderAll();
    };

    wrap.appendChild(btn);
  });
}

// ─── Render board (main bracket) ────────────────────────────
function v3RenderBoard() {
  var board = document.getElementById('v3-bracket-board');
  if (!board) return;
  board.innerHTML = '';

  var round = v3CurrentRound;
  var meta = v3RoundMeta[round];
  board.className = 'v3-bracket-board v3-ko-board--' + (round === 'f' ? 'F' : round.toUpperCase());
  board.style.setProperty('--k-color', meta.color);
  board.style.setProperty('--k-glow', meta.glow);

  if (round === 'f') {
    v3RenderFinalBlock();
    return;
  }

  // Get matches from BRACKET global
  var matches = (typeof BRACKET !== 'undefined') ? BRACKET[round] : [];
  if (!matches || !matches.length) return;

  // Split into left/right columns
  var half = Math.ceil(matches.length / 2);
  var leftMatches = matches.slice(0, half);
  var rightMatches = matches.slice(half);

  // Left column
  var leftCol = document.createElement('div');
  leftCol.className = 'v3-column v3-column-left';
  leftMatches.forEach(function(m) {
    leftCol.appendChild(v3RenderKoCard(m, meta));
  });
  board.appendChild(leftCol);

  // Right column
  var rightCol = document.createElement('div');
  rightCol.className = 'v3-column v3-column-right';
  rightMatches.forEach(function(m) {
    rightCol.appendChild(v3RenderKoCard(m, meta));
  });
  board.appendChild(rightCol);
}

function v3RenderKoCard(match, meta) {
  var div = document.createElement('div');
  div.className = 'v3-ko-card';
  div.dataset.match = match.id;
  div.style.setProperty('--k-color', meta.color);
  div.style.setProperty('--k-glow', meta.glow);

  var pred = (typeof koPredictions !== 'undefined') ? (koPredictions[match.id] || koPredictions[String(match.id)] || {}) : {};
  var decided = v3IsDecided(pred);
  if (decided) div.classList.add('is-decided');

  var homeSlot = match.home;
  var awaySlot = match.away;
  var homeLabel = v3ResolveSlotLabel(homeSlot);
  var awayLabel = v3ResolveSlotLabel(awaySlot);

  var homeFlag = v3FlagFor(homeSlot);
  var awayFlag = v3FlagFor(awaySlot);

  var homeScore = (pred.l !== null && pred.l !== undefined) ? pred.l : '–';
  var awayScore = (pred.v !== null && pred.v !== undefined) ? pred.v : '–';
  var homeEmpty = homeScore === '–' ? 'is-empty' : '';
  var awayEmpty = awayScore === '–' ? 'is-empty' : '';

  var winner = decided ? v3ResolveWinner(pred, homeSlot, awaySlot) : null;
  var homeWin = (winner === 'home') ? 'is-winner' : '';
  var awayWin = (winner === 'away') ? 'is-winner' : '';

  div.innerHTML = `
    <div class="v3-ko-card__tag">${match.id}</div>
    <div class="v3-ko-card__body">
      <div class="v3-ko-row ${homeWin}">
        <div class="v3-ko-row__code">${homeLabel}</div>
        <div class="v3-ko-row__flag">${homeFlag}</div>
        <div class="v3-ko-row__score ${homeEmpty}">${homeScore}</div>
      </div>
      <div class="v3-ko-row ${awayWin}">
        <div class="v3-ko-row__code">${awayLabel}</div>
        <div class="v3-ko-row__flag">${awayFlag}</div>
        <div class="v3-ko-row__score ${awayEmpty}">${awayScore}</div>
      </div>
    </div>
  `;

  div.onclick = function() {
    v3OpenZoom(match, v3RoundMeta[v3CurrentRound]);
  };

  return div;
}

// ─── Final block (round F) ──────────────────────────────────
function v3RenderFinalBlock() {
  var board = document.getElementById('v3-bracket-board');
  if (!board) return;

  var finalMatches = (typeof BRACKET !== 'undefined') ? BRACKET.final : [];
  var thirdMatches = (typeof BRACKET !== 'undefined') ? BRACKET.third : [];

  var meta = v3RoundMeta.f;

  // Trophy column
  var trophyCol = document.createElement('div');
  trophyCol.className = 'v3-trophy-col';

  // Final above
  var aboveStack = document.createElement('div');
  aboveStack.className = 'v3-final-stack v3-final-stack--above';
  if (finalMatches && finalMatches[0]) {
    aboveStack.appendChild(v3RenderFinalCard(finalMatches[0], meta, 'final'));
  }
  trophyCol.appendChild(aboveStack);

  // Trophy
  var trophy = document.createElement('img');
  trophy.className = 'v3-trophy';
  trophy.src = 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/trophy-2026.png';
  trophy.alt = 'Trophy';
  trophy.onerror = function() { this.style.display = 'none'; };
  trophyCol.appendChild(trophy);

  // Third below
  var belowStack = document.createElement('div');
  belowStack.className = 'v3-final-stack v3-final-stack--below';
  if (thirdMatches && thirdMatches[0]) {
    belowStack.appendChild(v3RenderFinalCard(thirdMatches[0], meta, 'third'));
  }
  trophyCol.appendChild(belowStack);

  board.appendChild(trophyCol);
}

function v3RenderFinalCard(match, meta, kind) {
  var div = document.createElement('div');
  div.className = 'v3-final-card' + (kind === 'third' ? ' v3-final-card--third' : '');
  div.dataset.match = match.id;

  var pred = (typeof koPredictions !== 'undefined') ? (koPredictions[match.id] || koPredictions[String(match.id)] || {}) : {};
  var decided = v3IsDecided(pred);
  if (decided) div.classList.add('is-decided');

  var winner = decided ? v3ResolveWinner(pred, match.home, match.away) : null;
  var winnerCode = null;
  if (winner === 'home') {
    winnerCode = v3ResolveSlotLabel(match.home);
  } else if (winner === 'away') {
    winnerCode = v3ResolveSlotLabel(match.away);
  }

  var homeLabel = v3ResolveSlotLabel(match.home);
  var awayLabel = v3ResolveSlotLabel(match.away);
  var homeFlag = v3FlagFor(match.home);
  var awayFlag = v3FlagFor(match.away);

  var homeScore = (pred.l !== null && pred.l !== undefined) ? pred.l : '–';
  var awayScore = (pred.v !== null && pred.v !== undefined) ? pred.v : '–';
  var empty = !pred || pred.l === null || pred.v === null;

  var eyebrow = (kind === 'final') ? '🏆 GRAN FINAL' : '🥉 3.er PUESTO';
  var winnerBadge = (winnerCode && decided)
    ? `<div class="v3-final-card__winner">${kind === 'final' ? '🏆 Campeón' : '🥉 Bronce'} · ${winnerCode}</div>`
    : '';

  div.innerHTML = `
    ${winnerBadge}
    <div class="v3-final-card__eyebrow">${eyebrow}</div>
    <div class="v3-final-card__match">
      <div class="v3-final-card__side">
        <div class="v3-final-card__flag">${homeFlag}</div>
        <div class="v3-final-card__code">${homeLabel}</div>
      </div>
      <div class="v3-final-card__score ${empty ? 'is-empty' : ''}">
        ${empty ? 'vs' : homeScore + ' – ' + awayScore}
      </div>
      <div class="v3-final-card__side">
        <div class="v3-final-card__flag">${awayFlag}</div>
        <div class="v3-final-card__code">${awayLabel}</div>
      </div>
    </div>
  `;

  div.onclick = function() {
    v3OpenZoom(match, meta);
  };

  return div;
}

// ─── Helpers ────────────────────────────────────────────────
function v3IsDecided(pred) {
  if (!pred || pred.l === null || pred.v === null) return false;
  if (pred.l === pred.v) return !!pred.classifier;
  return true;
}

function v3ResolveWinner(pred, homeSlot, awaySlot) {
  if (!pred) return null;
  if (pred.l === null || pred.v === null) return null;
  if (pred.l > pred.v) return 'home';
  if (pred.v > pred.l) return 'away';
  return pred.classifier ? (pred.classifier === v3ResolveSlotLabel(homeSlot) ? 'home' : 'away') : null;
}

function v3ResolveSlotLabel(slot) {
  // Try to get resolved name from resolvedSlots
  if (typeof resolvedSlots !== 'undefined' && resolvedSlots[slot]) {
    return resolvedSlots[slot];
  }
  // Fallback labels based on slot type
  if (slot.startsWith('W')) return 'G.M' + slot.slice(1);
  if (slot.startsWith('L')) return 'P.M' + slot.slice(1);
  if (slot.startsWith('T_')) return 'Mejor 3º';
  if (slot.length === 2) {
    var pos = slot[0] === '1' ? '1º' : '2º';
    return pos + ' Gr.' + slot[1];
  }
  return slot;
}

function v3FlagFor(slot) {
  if (typeof resolvedSlots === 'undefined' || !resolvedSlots[slot]) {
    return '<span style="font-size:11px">?</span>';
  }
  var teamName = resolvedSlots[slot];
  if (typeof EQUIPOS === 'undefined') return '';

  var team = EQUIPOS.find(function(e) { return e.name === teamName; });
  if (!team || !team.flag) return '';

  var flagUrl = v3FlagURLByCode(team.flag);
  if (!flagUrl) return '';
  return `<img src="${flagUrl}" alt="" onerror="this.remove()"/>`;
}

// ─── Zoom modal ──────────────────────────────────────────────
function v3OpenZoom(match, meta) {
  v3CurrentMatch = match;
  v3CurrentRoundObj = meta;
  v3RenderZoomKO();

  // Use shell's zoom overlay if available
  var overlay = document.querySelector('.v3-zoom-overlay') || document.querySelector('.zoom-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = 'v3-zoom-overlay';
    var panel = document.createElement('div');
    panel.className = 'v3-zoom-panel';
    var inner = document.createElement('div');
    inner.className = 'v3-zoom-panel__inner';
    panel.appendChild(inner);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);
  }

  overlay.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function v3CloseZoomKO() {
  var overlay = document.querySelector('.v3-zoom-overlay') || document.querySelector('.zoom-overlay');
  if (overlay) overlay.classList.remove('is-open');
  // F2.9 HOTFIX-03 (ERR-43 redux): limpiar inner para garantizar que descendientes
  // no quedan en DOM capturando clicks aunque el CSS ya gatee pointer-events.
  // Belt + suspenders consistente con F2.8.2 (v3CloseGoleadorPickerGrupos).
  var inner = document.querySelector('.v3-zoom-panel__inner') || document.querySelector('.zoom-panel__inner');
  if (inner) inner.innerHTML = '';
  document.body.style.overflow = '';
  v3CurrentMatch = null;
  v3RenderAll();
}

function v3RenderZoomKO() {
  var match = v3CurrentMatch;
  var meta = v3CurrentRoundObj;
  if (!match) return;

  var overlay = document.querySelector('.v3-zoom-overlay') || document.querySelector('.zoom-overlay');
  if (!overlay) return;

  var inner = document.querySelector('.v3-zoom-panel__inner') || document.querySelector('.zoom-panel__inner');
  if (!inner) return;

  inner.style.setProperty('--zoom-color', meta.color);
  inner.style.setProperty('--zoom-glow', meta.glow);

  var pred = (typeof koPredictions !== 'undefined') ? (koPredictions[match.id] || koPredictions[String(match.id)] || {}) : {};
  var hasHome = pred.l !== null && pred.l !== undefined;
  var hasAway = pred.v !== null && pred.v !== undefined;
  var isDraw = hasHome && hasAway && pred.l === pred.v;
  var decided = v3IsDecided(pred);

  var homeLabel = v3ResolveSlotLabel(match.home);
  var awayLabel = v3ResolveSlotLabel(match.away);
  var homeFlag = v3FlagFor(match.home);
  var awayFlag = v3FlagFor(match.away);

  var eyebrow = (meta.label || 'Ronda') + ' · ' + match.id;
  var title = homeLabel + ' vs ' + awayLabel;

  var homeScore = hasHome ? pred.l : '–';
  var awayScore = hasAway ? pred.v : '–';

  // F2.9 HF-05 #10-texto: el marcador del modal KO YA INCLUYE prórroga; el usuario
  // sólo indica quién clasifica (independiente del mecanismo prórroga gol o tanda final).
  var penaltyHtml = isDraw ? `
    <div class="v3-zoom-ko-penalty">
      <div class="v3-zoom-ko-penalty__label">⚽ Empate · Indica equipo que clasifica</div>
      <div class="v3-zoom-ko-penalty__btns">
        <button class="v3-zoom-ko-penalty__btn ${pred.classifier === homeLabel ? 'is-active' : ''}" data-pen="home">${homeLabel}</button>
        <button class="v3-zoom-ko-penalty__btn ${pred.classifier === awayLabel ? 'is-active' : ''}" data-pen="away">${awayLabel}</button>
      </div>
    </div>
  ` : '';

  var summaryHtml = decided
    ? `<div class="v3-zoom-ko-summary">Pasa: <strong>${v3ResolveWinner(pred, match.home, match.away) === 'home' ? homeLabel : awayLabel}</strong></div>`
    : `<div class="v3-zoom-ko-summary">${hasHome && hasAway ? '⚠️ Indica equipo que clasifica' : 'Introduce el marcador final'}</div>`;

  inner.innerHTML = `
    <div class="v3-zoom-header">
      <div class="v3-zoom-header__letter">${match.id}</div>
      <div class="v3-zoom-header__title">
        <div class="v3-zoom-header__eyebrow">${eyebrow}</div>
        <h2 class="v3-zoom-header__name">${title}</h2>
      </div>
      <button class="v3-zoom-close" aria-label="Cerrar (ESC)" data-close>✕</button>
    </div>
    <div class="v3-zoom-body">
      <div class="v3-zoom-ko-match">
        <div class="v3-zoom-ko-side">
          <div class="v3-zoom-ko-side__flag">${homeFlag}</div>
          <div class="v3-zoom-ko-side__code">${homeLabel}</div>
          <div class="v3-zoom-ko-side__label">Local</div>
        </div>
        <div class="v3-zoom-ko-score">
          <div class="v3-score-stepper">
            <button class="v3-score-btn" data-stepper data-side="home" data-delta="1">▲</button>
            <div class="v3-score-val ${hasHome ? '' : 'is-empty'}">${homeScore}</div>
            <button class="v3-score-btn" data-stepper data-side="home" data-delta="-1">▼</button>
          </div>
          <div class="v3-score-sep">:</div>
          <div class="v3-score-stepper">
            <button class="v3-score-btn" data-stepper data-side="away" data-delta="1">▲</button>
            <div class="v3-score-val ${hasAway ? '' : 'is-empty'}">${awayScore}</div>
            <button class="v3-score-btn" data-stepper data-side="away" data-delta="-1">▼</button>
          </div>
        </div>
        <div class="v3-zoom-ko-side">
          <div class="v3-zoom-ko-side__flag">${awayFlag}</div>
          <div class="v3-zoom-ko-side__code">${awayLabel}</div>
          <div class="v3-zoom-ko-side__label">Visitante</div>
        </div>
      </div>
      ${penaltyHtml}
      ${summaryHtml}
    </div>
  `;

  // Bind events
  inner.querySelector('[data-close]').onclick = v3CloseZoomKO;

  inner.querySelectorAll('[data-stepper]').forEach(function(btn) {
    btn.onclick = function(e) {
      e.stopPropagation();
      v3AdjustScoreKO(match.id, btn.dataset.side, +btn.dataset.delta);
    };
  });

  inner.querySelectorAll('[data-pen]').forEach(function(btn) {
    btn.onclick = function(e) {
      e.stopPropagation();
      v3SetPenaltyWinner(match.id, btn.dataset.pen === 'home' ? homeLabel : awayLabel);
    };
  });
}

function v3AdjustScoreKO(matchId, side, delta) {
  if (typeof koPredictions === 'undefined') return;

  if (!koPredictions[matchId]) koPredictions[matchId] = {};
  var p = koPredictions[matchId];

  var cur = (p[side === 'home' ? 'l' : 'v'] !== null && p[side === 'home' ? 'l' : 'v'] !== undefined)
    ? p[side === 'home' ? 'l' : 'v']
    : 0;
  var newVal = Math.max(0, Math.min(15, cur + delta));

  if (side === 'home') {
    p.l = newVal;
    if (p.v === null || p.v === undefined) p.v = 0;
  } else {
    p.v = newVal;
    if (p.l === null || p.l === undefined) p.l = 0;
  }

  // Reset classifier if no longer a draw
  if (p.l !== p.v) p.classifier = null;

  p.saved = true;
  if (typeof saveKO === 'function') saveKO();

  v3RenderZoomKO();
}

function v3SetPenaltyWinner(matchId, side) {
  if (typeof koPredictions === 'undefined') return;
  if (!koPredictions[matchId]) return;

  var p = koPredictions[matchId];
  p.classifier = side;
  p.saved = true;
  if (typeof saveKO === 'function') saveKO();

  v3RenderZoomKO();
}

// ─── Buttons ────────────────────────────────────────────────
function v3BindButtonsAndSwitcher() {
  // Reset button
  var resetBtn = document.querySelector('[data-v3-elim-reset]');
  if (resetBtn) {
    resetBtn.onclick = function() {
      if (!confirm('¿Borrar pronósticos KO?')) return;
      if (typeof koPredictions !== 'undefined') {
        koPredictions = {};
        if (typeof saveKO === 'function') saveKO();
        v3RenderAll();
      }
    };
  }

  // Dice button
  var diceBtn = document.querySelector('[data-v3-elim-dice]');
  if (diceBtn) {
    diceBtn.onclick = function() {
      if (!confirm('¿Simular pronósticos aleatorios?')) return;
      v3SimulateDice();
    };
  }

  // ESC key
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && v3CurrentMatch) v3CloseZoomKO();
  });

  // Overlay click
  var overlay = document.querySelector('.v3-zoom-overlay');
  if (overlay) {
    overlay.onclick = function(e) {
      if (e.target === overlay) v3CloseZoomKO();
    };
  }
}

function v3SimulateDice() {
  if (typeof BRACKET === 'undefined' || typeof koPredictions === 'undefined') return;

  // Fill R32 (M73-M88)
  var r32 = BRACKET.r32 || [];
  r32.forEach(function(m) {
    var h = Math.floor(Math.random() * 4);
    var a = Math.floor(Math.random() * 4);
    koPredictions[m.id] = {
      l: h, v: a,
      classifier: (h === a) ? 'home' : null,
      saved: true
    };
  });

  // Some R16 (M89-M92)
  var r16 = BRACKET.r16 || [];
  for (var i = 0; i < Math.min(4, r16.length); i++) {
    koPredictions[r16[i].id] = { l: 2, v: 1, classifier: null, saved: true };
  }

  // One QF (M97)
  var qf = BRACKET.qf || [];
  if (qf[0]) {
    koPredictions[qf[0].id] = { l: 0, v: 0, classifier: 'away', saved: true };
  }

  // Final + 3rd
  var final = BRACKET.final || [];
  var third = BRACKET.third || [];
  if (final[0]) koPredictions[final[0].id] = { l: 2, v: 1, classifier: null, saved: true };
  if (third[0]) koPredictions[third[0].id] = { l: 3, v: 2, classifier: null, saved: true };

  if (typeof saveKO === 'function') saveKO();
  v3RenderAll();
}

// ─── Main render ────────────────────────────────────────────
function v3RenderAll() {
  v3RenderSwitcher();
  v3RenderBoard();
}

// ─── Defensivo: pattern readyState ──────────────────────────
var v3RunInit = function() {
  // Inicialización la hace el padre al llamar window.v3ElimMount()
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', v3RunInit);
} else {
  v3RunInit();
}
