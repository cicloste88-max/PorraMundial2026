/* ============================================================
   MUNDIAL 2026 — Grupos v3 (porter desde prototipo)
   Entry point: window.v3GruposMount()
   ============================================================ */

var V3_FLAG_SLUG = {
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

var V3_GRUPO_COLORS = {
  A: { color:'#34d399', glow:'rgba(52,211,153,.55)' },
  B: { color:'#f87171', glow:'rgba(248,113,113,.55)' },
  C: { color:'#fb923c', glow:'rgba(251,146,60,.55)' },
  D: { color:'#60a5fa', glow:'rgba(96,165,250,.55)' },
  E: { color:'#a78bfa', glow:'rgba(167,139,250,.55)' },
  F: { color:'#a3e635', glow:'rgba(163,230,53,.55)' },
  G: { color:'#f472b6', glow:'rgba(244,114,182,.55)' },
  H: { color:'#5eead4', glow:'rgba(94,234,212,.55)' },
  I: { color:'#c084fc', glow:'rgba(192,132,252,.55)' },
  J: { color:'#94a3b8', glow:'rgba(148,163,184,.55)' },
  K: { color:'#fb7185', glow:'rgba(251,113,133,.55)' },
  L: { color:'#38bdf8', glow:'rgba(56,189,248,.55)' }
};

var V3_PAIRINGS = [[0,1],[2,3], [0,2],[1,3], [0,3],[1,2]];
var V3_MATCH_DAY = ['J1','J1','J2','J2','J3','J3'];

var _v3GruposInited = false;
var _v3CurrentLetter = null;
var _v3CurrentTab = 'predictions';

function flagURL(equipo) {
  var slug = V3_FLAG_SLUG[equipo.flag] || equipo.flag;
  return window.flagPath ? window.flagPath(slug) : '/flags/redesign v3/' + encodeURIComponent(slug + '.svg');
}

function findEquipoByName(name) {
  return EQUIPOS.find(e => e.name === name);
}

function getGrupoLetterIndex(letter) {
  return GRUPOS.findIndex(g => g.letra === letter);
}

function isGroupComplete(letter) {
  var matchesInGroup = PARTIDOS.filter(m => m.group === letter);
  return matchesInGroup.every(m => {
    var key = getMatchKey(m);
    var p = predictions[key];
    return p && Number.isInteger(p.l) && Number.isInteger(p.v);
  });
}

function countFilled(letter) {
  var matchesInGroup = PARTIDOS.filter(m => m.group === letter);
  return matchesInGroup.filter(m => {
    var key = getMatchKey(m);
    var p = predictions[key];
    return p && Number.isInteger(p.l) && Number.isInteger(p.v);
  }).length;
}

function computeStandings(letter) {
  var grupoIdx = getGrupoLetterIndex(letter);
  var grupo = GRUPOS[grupoIdx];
  var stats = grupo.equipos.map((name, idx) => ({
    teamIdx: idx, name: name, pj: 0, pg: 0, pe: 0, pp: 0, gf: 0, gc: 0, gd: 0, pts: 0
  }));

  var matchesInGroup = PARTIDOS.filter(m => m.group === letter);
  matchesInGroup.forEach((match, idx) => {
    var key = getMatchKey(match);
    var p = predictions[key];
    if (!p || !Number.isInteger(p.l) || !Number.isInteger(p.v)) return;

    var homeIdx = grupo.equipos.indexOf(match.home);
    var awayIdx = grupo.equipos.indexOf(match.away);
    var h = stats[homeIdx], a = stats[awayIdx];

    h.pj++; a.pj++;
    h.gf += p.l; h.gc += p.v;
    a.gf += p.v; a.gc += p.l;

    if (p.l > p.v) { h.pts += 3; h.pg++; a.pp++; }
    else if (p.l < p.v) { a.pts += 3; a.pg++; h.pp++; }
    else { h.pts += 1; a.pts += 1; h.pe++; a.pe++; }
  });

  stats.forEach(s => s.gd = s.gf - s.gc);
  stats.sort((a,b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.teamIdx - b.teamIdx);
  return stats;
}

function renderBoard() {
  var left = document.querySelector('.phone .v3-column-left');
  var right = document.querySelector('.phone .v3-column-right');
  if (!left || !right) return;
  left.innerHTML = '';
  right.innerHTML = '';

  GRUPOS.forEach((grupo, i) => {
    var el = renderGroup(grupo);
    (i < 6 ? left : right).appendChild(el);
  });
}

function renderGroup(grupo) {
  var div = document.createElement('div');
  div.className = 'v3-group';
  div.dataset.letter = grupo.letra;
  div.style.setProperty('--g-color', V3_GRUPO_COLORS[grupo.letra].color);
  div.style.setProperty('--g-glow', V3_GRUPO_COLORS[grupo.letra].glow);

  var isComplete = isGroupComplete(grupo.letra);
  if (isComplete) div.classList.add('is-complete', 'has-standings');

  var tab = document.createElement('div');
  tab.className = 'v3-group__tab';
  tab.textContent = grupo.letra;
  div.appendChild(tab);

  var card = document.createElement('div');
  card.className = 'v3-group__card';

  if (isComplete) {
    var standings = computeStandings(grupo.letra);
    standings.forEach((row, idx) => {
      var equipo = findEquipoByName(row.name);
      var r = document.createElement('div');
      r.className = 'v3-team-row';
      if (idx < 2) r.classList.add('is-qualified');

      var pos = document.createElement('div');
      pos.className = 'v3-team-row__pos';
      pos.textContent = idx + 1;
      r.appendChild(pos);

      var code = document.createElement('div');
      code.className = 'v3-team-row__code';
      code.textContent = equipo.name;
      r.appendChild(code);

      var flag = document.createElement('div');
      flag.className = 'v3-team-row__flag';
      var img = document.createElement('img');
      img.src = flagURL(equipo);
      img.alt = equipo.flag;
      img.loading = 'lazy';
      img.onerror = function() {
        this.style.display = 'none';
        this.parentNode.classList.add('is-broken');
      };
      flag.appendChild(img);
      r.appendChild(flag);

      var pts = document.createElement('div');
      pts.className = 'v3-team-row__pts';
      pts.textContent = row.pts;
      r.appendChild(pts);

      card.appendChild(r);
    });
  } else {
    grupo.equipos.forEach(name => {
      var equipo = findEquipoByName(name);
      var r = document.createElement('div');
      r.className = 'v3-team-row';

      var code = document.createElement('div');
      code.className = 'v3-team-row__code';
      code.textContent = equipo.name;
      r.appendChild(code);

      var flag = document.createElement('div');
      flag.className = 'v3-team-row__flag';
      var img = document.createElement('img');
      img.src = flagURL(equipo);
      img.alt = equipo.flag;
      img.loading = 'lazy';
      img.onerror = function() {
        this.style.display = 'none';
        this.parentNode.classList.add('is-broken');
      };
      flag.appendChild(img);
      r.appendChild(flag);

      card.appendChild(r);
    });
  }

  div.appendChild(card);
  div.addEventListener('click', () => v3OpenZoomGrupos(grupo.letra));
  return div;
}

function v3OpenZoomGrupos(letter) {
  _v3CurrentLetter = letter;
  _v3CurrentTab = isGroupComplete(letter) ? 'standings' : 'predictions';
  v3RenderZoom();
  var overlay = document.querySelector('.v3-zoom-overlay');
  if (overlay) overlay.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function v3CloseZoom() {
  var overlay = document.querySelector('.v3-zoom-overlay');
  if (overlay) overlay.classList.remove('is-open');
  document.body.style.overflow = '';
  _v3CurrentLetter = null;
  renderBoard();
}

function v3RenderZoom() {
  var grupo = GRUPOS.find(g => g.letra === _v3CurrentLetter);
  if (!grupo) return;

  var inner = document.querySelector('.v3-zoom-panel__inner');
  if (!inner) return;

  inner.style.setProperty('--zoom-color', V3_GRUPO_COLORS[_v3CurrentLetter].color);
  inner.style.setProperty('--zoom-glow', V3_GRUPO_COLORS[_v3CurrentLetter].glow);

  var matchesInGroup = PARTIDOS.filter(m => m.group === _v3CurrentLetter);
  var filled = countFilled(_v3CurrentLetter);
  var total = matchesInGroup.length;
  var isDone = filled === total;

  var header = '<div class="v3-zoom-header">'
    + '<div class="v3-zoom-header__letter">' + _v3CurrentLetter + '</div>'
    + '<div class="v3-zoom-header__title">'
    + '<div class="v3-zoom-header__eyebrow">Grupo ' + _v3CurrentLetter + ' · Fase de Grupos</div>'
    + '<h2 class="v3-zoom-header__name">Pronostica el Grupo ' + _v3CurrentLetter + '</h2>'
    + '</div>'
    + '<button class="v3-zoom-close" aria-label="Cerrar (ESC)" data-v3-close>✕</button>'
    + '</div>';

  var tabs = '<div class="v3-zoom-tabs">'
    + '<button class="v3-zoom-tab ' + (_v3CurrentTab==='predictions'?'is-active':'') + '" data-v3-tab="predictions">Pronósticos</button>'
    + '<button class="v3-zoom-tab ' + (_v3CurrentTab==='standings'?'is-active':'') + '" data-v3-tab="standings" ' + (isDone?'':'disabled') + '>'
    + 'Clasificación ' + (isDone ? '' : '(' + filled + '/' + total + ')')
    + '</button>'
    + '</div>';

  var body = '<div class="v3-zoom-body">' + tabs;

  if (_v3CurrentTab === 'predictions') {
    body += '<div data-v3-view="predictions">'
      + v3RenderMatchesList(grupo, matchesInGroup)
      + '<div class="v3-zoom-footer">'
      + '<div class="v3-zoom-progress">'
      + '<div class="v3-zoom-progress__label">' + filled + ' de ' + total + ' marcadores</div>'
      + '<div class="v3-zoom-progress__bar"><div class="v3-zoom-progress__fill" style="width:' + (filled/total)*100 + '%"></div></div>'
      + '</div>'
      + '<button class="v3-zoom-cta" data-v3-show-standings ' + (isDone?'':'disabled') + '>'
      + (isDone ? 'Clasificación →' : ('Falta' + (total-filled===1?'':'n') + ' ' + (total-filled)))
      + '</button>'
      + '</div>'
      + '</div>';
  } else {
    body += '<div data-v3-view="standings">'
      + v3RenderStandingsTable(grupo)
      + '<div class="v3-qualif-legend">Top 2 clasifican a la fase eliminatoria</div>'
      + '<div class="v3-zoom-footer">'
      + '<div class="v3-zoom-progress">'
      + '<div class="v3-zoom-progress__label">Pronósticos guardados</div>'
      + '<div class="v3-zoom-progress__bar"><div class="v3-zoom-progress__fill" style="width:100%"></div></div>'
      + '</div>'
      + '<button class="v3-zoom-cta" data-v3-show-predictions>Editar</button>'
      + '</div>'
      + '</div>';
  }

  body += '</div>';
  inner.innerHTML = header + body;

  var closeBtn = inner.querySelector('[data-v3-close]');
  if (closeBtn) closeBtn.onclick = v3CloseZoom;

  inner.querySelectorAll('[data-v3-tab]').forEach(btn => {
    btn.onclick = () => {
      if (btn.disabled) return;
      _v3CurrentTab = btn.dataset.v3Tab;
      v3RenderZoom();
    };
  });

  var showSt = inner.querySelector('[data-v3-show-standings]');
  if (showSt) showSt.onclick = () => { _v3CurrentTab = 'standings'; v3RenderZoom(); };

  var showPr = inner.querySelector('[data-v3-show-predictions]');
  if (showPr) showPr.onclick = () => { _v3CurrentTab = 'predictions'; v3RenderZoom(); };

  inner.querySelectorAll('[data-v3-stepper]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      v3AdjustScore(_v3CurrentLetter, +btn.dataset.v3Match, btn.dataset.v3Side, +btn.dataset.v3Delta);
    };
  });
}

function v3RenderMatchesList(grupo, matchesInGroup) {
  var html = '<div class="v3-matches-list">';
  var lastDay = null;

  matchesInGroup.forEach((match, idx) => {
    var day = V3_MATCH_DAY[idx % 6];
    if (day !== lastDay) {
      html += '<div class="v3-match-day-label">Jornada ' + day.slice(1) + '</div>';
      lastDay = day;
    }

    var homeEquipo = findEquipoByName(match.home);
    var awayEquipo = findEquipoByName(match.away);
    var key = getMatchKey(match);
    var p = predictions[key] || {};

    var hasHome = Number.isInteger(p.l);
    var hasAway = Number.isInteger(p.v);
    var filled = hasHome && hasAway;

    html += '<div class="v3-match-card ' + (filled?'is-filled':'') + '">'
      + '<div class="v3-match-side v3-match-side--home">'
      + '<div class="v3-match-side__flag"><img src="' + flagURL(homeEquipo) + '" alt="' + homeEquipo.flag + '" loading="lazy" onerror="this.style.display=\'none\';this.parentNode.classList.add(\'is-broken\')"/></div>'
      + '<div class="v3-match-side__name">' + homeEquipo.flag + '</div>'
      + '</div>'
      + '<div class="v3-match-score">'
      + '<div class="v3-score-stepper">'
      + '<button class="v3-score-btn" data-v3-stepper data-v3-match="' + idx + '" data-v3-side="home" data-v3-delta="1" aria-label="+1 ' + homeEquipo.flag + '">▲</button>'
      + '<div class="v3-score-val ' + (hasHome?'':'is-empty') + '">' + (hasHome ? p.l : '–') + '</div>'
      + '<button class="v3-score-btn" data-v3-stepper data-v3-match="' + idx + '" data-v3-side="home" data-v3-delta="-1" aria-label="-1 ' + homeEquipo.flag + '">▼</button>'
      + '</div>'
      + '<div class="v3-score-sep">:</div>'
      + '<div class="v3-score-stepper">'
      + '<button class="v3-score-btn" data-v3-stepper data-v3-match="' + idx + '" data-v3-side="away" data-v3-delta="1" aria-label="+1 ' + awayEquipo.flag + '">▲</button>'
      + '<div class="v3-score-val ' + (hasAway?'':'is-empty') + '">' + (hasAway ? p.v : '–') + '</div>'
      + '<button class="v3-score-btn" data-v3-stepper data-v3-match="' + idx + '" data-v3-side="away" data-v3-delta="-1" aria-label="-1 ' + awayEquipo.flag + '">▼</button>'
      + '</div>'
      + '</div>'
      + '<div class="v3-match-side v3-match-side--away">'
      + '<div class="v3-match-side__flag"><img src="' + flagURL(awayEquipo) + '" alt="' + awayEquipo.flag + '" loading="lazy" onerror="this.style.display=\'none\';this.parentNode.classList.add(\'is-broken\')"/></div>'
      + '<div class="v3-match-side__name">' + awayEquipo.flag + '</div>'
      + '</div>'
      + '</div>';
  });

  html += '</div>';
  return html;
}

function v3RenderStandingsTable(grupo) {
  var standings = computeStandings(grupo.letra);
  var html = '<div class="v3-standings-table">'
    + '<div class="v3-standings-head">'
    + '<div class="v3-st-pos">#</div>'
    + '<div>Selección</div>'
    + '<div class="v3-st-num" title="Partidos jugados">PJ</div>'
    + '<div class="v3-st-num" title="Goles a favor">GF</div>'
    + '<div class="v3-st-num" title="Goles en contra">GC</div>'
    + '<div class="v3-st-num" title="Diferencia de goles">DG</div>'
    + '<div class="v3-st-pts" title="Puntos">PTS</div>'
    + '</div>';

  standings.forEach((row, idx) => {
    var equipo = findEquipoByName(row.name);
    html += '<div class="v3-standings-row ' + (idx < 2 ? 'is-qualified' : '') + '">'
      + '<div class="v3-st-pos">' + (idx+1) + '</div>'
      + '<div class="v3-st-team">'
      + '<div class="v3-st-flag"><img src="' + flagURL(equipo) + '" alt="' + equipo.flag + '" onerror="this.style.display=\'none\';this.parentNode.classList.add(\'is-broken\')"/></div>'
      + '<div class="v3-st-name">' + equipo.name + '</div>'
      + '</div>'
      + '<div class="v3-st-num">' + row.pj + '</div>'
      + '<div class="v3-st-num">' + row.gf + '</div>'
      + '<div class="v3-st-num">' + row.gc + '</div>'
      + '<div class="v3-st-num">' + (row.gd > 0 ? '+' + row.gd : row.gd) + '</div>'
      + '<div class="v3-st-pts">' + row.pts + '</div>'
      + '</div>';
  });

  html += '</div>';
  return html;
}

function v3AdjustScore(letter, matchIdx, side, delta) {
  var matchesInGroup = PARTIDOS.filter(m => m.group === letter);
  var match = matchesInGroup[matchIdx];
  if (!match) return;

  var key = getMatchKey(match);
  if (!predictions[key]) predictions[key] = { l: 0, v: 0, saved: false };

  var fieldKey = side === 'home' ? 'l' : 'v';
  var cur = Number.isInteger(predictions[key][fieldKey]) ? predictions[key][fieldKey] : 0;
  predictions[key][fieldKey] = Math.max(0, Math.min(15, cur + delta));

  var otherKey = side === 'home' ? 'v' : 'l';
  if (!Number.isInteger(predictions[key][otherKey])) {
    predictions[key][otherKey] = 0;
  }

  predictions[key].saved = false;
  savePredictions();
  v3RenderZoom();
}

function v3BindResetBtn() {
  var btn = document.querySelector('[data-v3-reset]');
  if (!btn) return;
  btn.onclick = () => {
    if (!confirm('¿Borrar todos los pronósticos guardados?')) return;
    predictions = {};
    savePredictions();
    renderBoard();
  };
}

function v3BindDiceBtn() {
  var btn = document.querySelector('[data-v3-dice]');
  if (!btn) return;
  btn.onclick = () => {
    if (!confirm('¿Simular aleatoriamente los 72 partidos?')) return;
    if (window.diceSimulateAllGroups) {
      window.diceSimulateAllGroups();
    }
  };
}

function v3BindTrophyFallback() {
  var img = document.querySelector('.phone .v3-trophy');
  if (!img) return;
  img.addEventListener('error', () => {
    var col = img.closest('.v3-trophy-col');
    if (col) col.classList.add('is-fallback');
  }, { once: true });
}

function v3BindEscapeAndBackdrop() {
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && _v3CurrentLetter) v3CloseZoom();
  });
  document.addEventListener('click', (e) => {
    if (e.target && e.target.classList && e.target.classList.contains('v3-zoom-overlay')) {
      v3CloseZoom();
    }
  });
}

window.v3GruposMount = function() {
  var container = document.querySelector('#page-grupos');
  if (!container) return;

  if (!_v3GruposInited) {
    var mount = document.createElement('div');
    mount.id = 'v3-grupos-mount';
    mount.className = 'phone';

    var board = document.createElement('div');
    board.className = 'v3-board';

    var colLeft = document.createElement('div');
    colLeft.className = 'v3-column v3-column-left';
    board.appendChild(colLeft);

    var trophyCol = document.createElement('div');
    trophyCol.className = 'v3-trophy-col';
    var trophyImg = document.createElement('img');
    trophyImg.className = 'v3-trophy';
    // F2.1 fix #4: bind onerror ANTES de set src para evitar race condition
    // (si el fetch falla antes de que se ate el listener, el evento se pierde).
    // Combinado con CSS donde `.v3-trophy-fallback { display: block }` por default
    // (emoji siempre visible debajo; image lo cubre si carga OK).
    trophyImg.onerror = function () { trophyCol.classList.add('is-fallback'); };
    trophyImg.src = WORLD_CUP_LOGO || 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/Logos/2026_FIFA_World_Cup.png';
    trophyImg.alt = 'Trophy';
    var trophyFallback = document.createElement('div');
    trophyFallback.className = 'v3-trophy-fallback';
    trophyFallback.textContent = '🏆';
    trophyCol.appendChild(trophyImg);
    trophyCol.appendChild(trophyFallback);
    board.appendChild(trophyCol);

    var colRight = document.createElement('div');
    colRight.className = 'v3-column v3-column-right';
    board.appendChild(colRight);

    mount.appendChild(board);

    var actions = document.createElement('div');
    actions.className = 'v3-actions';
    var diceBtn = document.createElement('button');
    diceBtn.className = 'v3-btn';
    diceBtn.setAttribute('data-v3-dice', '');
    diceBtn.textContent = '🎲 Simular';
    var resetBtn = document.createElement('button');
    resetBtn.className = 'v3-btn v3-btn--danger';
    resetBtn.setAttribute('data-v3-reset', '');
    resetBtn.textContent = 'Borrar pronósticos';
    actions.appendChild(diceBtn);
    actions.appendChild(resetBtn);
    mount.appendChild(actions);

    var hint = document.createElement('p');
    hint.className = 'v3-hint';
    hint.textContent = 'Toca un grupo para pronosticar sus 6 partidos · ESC para cerrar';
    mount.appendChild(hint);

    // F2.1 fix #5: NO crear .v3-zoom-overlay / .v3-zoom-panel propios. El shell
    // mundial-shell-v3.js ya monta un singleton en body via ensureZoomOverlay().
    // v3OpenZoomGrupos/v3RenderZoom encuentran ese singleton y operan sobre él.

    // F2.1 fix #3: NO wipe container.innerHTML (borraría el shell-mount con
    // fifa-bar/qualified-cta/stage-pill que ensurePageShellV3 inyectó).
    // En su lugar, remover sólo el mount viejo del grupos (si existe en re-mount).
    var existing = container.querySelector('#v3-grupos-mount');
    if (existing) existing.remove();
    container.appendChild(mount);

    v3BindDiceBtn();
    v3BindResetBtn();
    v3BindEscapeAndBackdrop();

    _v3GruposInited = true;
  }

  renderBoard();
};

// F2 integración (padre Opus): NO auto-mount. El padre (showPage('grupos') en F3
// SPA wiring, o sandbox explícito) llama window.v3GruposMount() bajo demanda.
// Auto-mount removido (el agente Haiku ignoró el brief que decía "NO auto-init").
var runInitV3 = function() { /* no-op — mount on-demand via window.v3GruposMount() */ };

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runInitV3);
} else {
  runInitV3();
}
