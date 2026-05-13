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
// F2.8.1: sub-overlay squad picker — 1 pick por partido (sin side parameter).
var _v3SquadPickerMatchIdx = null;

function v3FlagURLByEquipo(equipo) {
  var slug = V3_FLAG_SLUG[equipo.flag] || equipo.flag;
  return window.flagPath ? window.flagPath(slug) : '/flags/redesign v3/' + encodeURIComponent(slug + '.svg');
}

function v3FindEquipoByName(name) {
  return EQUIPOS.find(e => e.name === name);
}

function v3GetGrupoLetterIndex(letter) {
  return GRUPOS.findIndex(g => g.letra === letter);
}

function v3IsGroupComplete(letter) {
  var matchesInGroup = PARTIDOS.filter(m => m.group === letter);
  return matchesInGroup.every(m => {
    var key = getMatchKey(m);
    var p = predictions[key];
    return p && Number.isInteger(p.l) && Number.isInteger(p.v);
  });
}

function v3CountFilled(letter) {
  var matchesInGroup = PARTIDOS.filter(m => m.group === letter);
  return matchesInGroup.filter(m => {
    var key = getMatchKey(m);
    var p = predictions[key];
    return p && Number.isInteger(p.l) && Number.isInteger(p.v);
  }).length;
}

function v3ComputeStandings(letter) {
  var grupoIdx = v3GetGrupoLetterIndex(letter);
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

function v3RenderBoardGrupos() {
  var left = document.querySelector('.phone .v3-column-left');
  var right = document.querySelector('.phone .v3-column-right');
  if (!left || !right) return;
  left.innerHTML = '';
  right.innerHTML = '';

  GRUPOS.forEach((grupo, i) => {
    var el = v3RenderGroup(grupo);
    (i < 6 ? left : right).appendChild(el);
  });
}

function v3RenderGroup(grupo) {
  var div = document.createElement('div');
  div.className = 'v3-group';
  div.dataset.letter = grupo.letra;
  div.style.setProperty('--g-color', V3_GRUPO_COLORS[grupo.letra].color);
  div.style.setProperty('--g-glow', V3_GRUPO_COLORS[grupo.letra].glow);

  var isComplete = v3IsGroupComplete(grupo.letra);
  if (isComplete) div.classList.add('is-complete', 'has-standings');

  var tab = document.createElement('div');
  tab.className = 'v3-group__tab';
  tab.textContent = grupo.letra;
  div.appendChild(tab);

  var card = document.createElement('div');
  card.className = 'v3-group__card';

  if (isComplete) {
    var standings = v3ComputeStandings(grupo.letra);
    standings.forEach((row, idx) => {
      var equipo = v3FindEquipoByName(row.name);
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
      img.src = v3FlagURLByEquipo(equipo);
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
      var equipo = v3FindEquipoByName(name);
      var r = document.createElement('div');
      r.className = 'v3-team-row';

      var code = document.createElement('div');
      code.className = 'v3-team-row__code';
      code.textContent = equipo.name;
      r.appendChild(code);

      var flag = document.createElement('div');
      flag.className = 'v3-team-row__flag';
      var img = document.createElement('img');
      img.src = v3FlagURLByEquipo(equipo);
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
  _v3CurrentTab = v3IsGroupComplete(letter) ? 'standings' : 'predictions';

  // F2.6 defensive: si shell no se inicializó (race), asegurar overlay antes.
  if (!document.querySelector('.v3-zoom-overlay') && typeof window.mundialShellV3Init === 'function') {
    window.mundialShellV3Init();
  }

  v3RenderZoomGrupos();
  var overlay = document.querySelector('.v3-zoom-overlay');
  var inner = document.querySelector('.v3-zoom-panel__inner');
  console.log('[v3-grupos openZoom]', {
    letter: letter,
    overlayFound: !!overlay,
    innerFound: !!inner,
    innerHTMLLen: inner ? inner.innerHTML.length : 0,
    overlayParent: overlay ? overlay.parentNode.tagName + (overlay.parentNode.id ? '#' + overlay.parentNode.id : '') : 'NONE',
    panelSibling: overlay && overlay.nextElementSibling ? overlay.nextElementSibling.className : 'NONE'
  });
  if (overlay) overlay.classList.add('is-open');
  document.body.style.overflow = 'hidden';
}

function v3CloseZoomGrupos() {
  var overlay = document.querySelector('.v3-zoom-overlay');
  if (overlay) overlay.classList.remove('is-open');
  document.body.style.overflow = '';
  _v3CurrentLetter = null;
  v3RenderBoardGrupos();
}

function v3RenderZoomGrupos() {
  var grupo = GRUPOS.find(g => g.letra === _v3CurrentLetter);
  if (!grupo) return;

  var inner = document.querySelector('.v3-zoom-panel__inner');
  if (!inner) return;

  inner.style.setProperty('--zoom-color', V3_GRUPO_COLORS[_v3CurrentLetter].color);
  inner.style.setProperty('--zoom-glow', V3_GRUPO_COLORS[_v3CurrentLetter].glow);

  var matchesInGroup = PARTIDOS.filter(m => m.group === _v3CurrentLetter);
  var filled = v3CountFilled(_v3CurrentLetter);
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

  // F2.8: 3 tabs — Marcadores (rename de Pronósticos) + Goleadores (nuevo) + Clasificación (gated 6/6).
  var tabs = '<div class="v3-zoom-tabs">'
    + '<button class="v3-zoom-tab ' + (_v3CurrentTab==='predictions'?'is-active':'') + '" data-v3-tab="predictions">Marcadores</button>'
    + '<button class="v3-zoom-tab ' + (_v3CurrentTab==='goleadores'?'is-active':'') + '" data-v3-tab="goleadores">Goleadores</button>'
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
  } else if (_v3CurrentTab === 'goleadores') {
    body += '<div data-v3-view="goleadores">'
      + v3RenderGoleadoresTabGrupos(grupo, matchesInGroup)
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
  if (closeBtn) closeBtn.onclick = v3CloseZoomGrupos;

  inner.querySelectorAll('[data-v3-tab]').forEach(btn => {
    btn.onclick = () => {
      if (btn.disabled) return;
      _v3CurrentTab = btn.dataset.v3Tab;
      v3RenderZoomGrupos();
    };
  });

  var showSt = inner.querySelector('[data-v3-show-standings]');
  if (showSt) showSt.onclick = () => { _v3CurrentTab = 'standings'; v3RenderZoomGrupos(); };

  var showPr = inner.querySelector('[data-v3-show-predictions]');
  if (showPr) showPr.onclick = () => { _v3CurrentTab = 'predictions'; v3RenderZoomGrupos(); };

  inner.querySelectorAll('[data-v3-stepper]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      v3AdjustScoreGrupos(_v3CurrentLetter, +btn.dataset.v3Match, btn.dataset.v3Side, +btn.dataset.v3Delta);
    };
  });

  // F2.8.1: bind picks de goleadores en tab Goleadores (1 por partido, sin side).
  inner.querySelectorAll('[data-v3-goleador-pick]').forEach(btn => {
    btn.onclick = (e) => {
      e.stopPropagation();
      v3OpenGoleadorPickerGrupos(+btn.dataset.v3Match);
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

    var homeEquipo = v3FindEquipoByName(match.home);
    var awayEquipo = v3FindEquipoByName(match.away);
    var key = getMatchKey(match);
    var p = predictions[key] || {};

    var hasHome = Number.isInteger(p.l);
    var hasAway = Number.isInteger(p.v);
    var filled = hasHome && hasAway;

    html += '<div class="v3-match-card ' + (filled?'is-filled':'') + '">'
      + '<div class="v3-match-side v3-match-side--home">'
      + '<div class="v3-match-side__flag"><img src="' + v3FlagURLByEquipo(homeEquipo) + '" alt="' + homeEquipo.flag + '" loading="lazy" onerror="this.style.display=\'none\';this.parentNode.classList.add(\'is-broken\')"/></div>'
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
      + '<div class="v3-match-side__flag"><img src="' + v3FlagURLByEquipo(awayEquipo) + '" alt="' + awayEquipo.flag + '" loading="lazy" onerror="this.style.display=\'none\';this.parentNode.classList.add(\'is-broken\')"/></div>'
      + '<div class="v3-match-side__name">' + awayEquipo.flag + '</div>'
      + '</div>'
      + '</div>';

    // F2.8: chips de puntuación post-partido (3 estados: pre-kickoff nada, 0 pts gris, N pts stack).
    html += v3RenderChipsGrupos(match, p);
  });

  html += '</div>';
  return html;
}

function v3RenderStandingsTable(grupo) {
  var standings = v3ComputeStandings(grupo.letra);
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
    var equipo = v3FindEquipoByName(row.name);
    html += '<div class="v3-standings-row ' + (idx < 2 ? 'is-qualified' : '') + '">'
      + '<div class="v3-st-pos">' + (idx+1) + '</div>'
      + '<div class="v3-st-team">'
      + '<div class="v3-st-flag"><img src="' + v3FlagURLByEquipo(equipo) + '" alt="' + equipo.flag + '" onerror="this.style.display=\'none\';this.parentNode.classList.add(\'is-broken\')"/></div>'
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

// ─── F2.8 — Goleadores + chips puntuación ─────────────────────

// Wrapper sobre calcMatchPoints (scoring.js). Devuelve breakdown por tipo + total.
// shape return: { total, types: ['signo'|'exacto'|'gole'|'bonus'] }
function v3CalcMatchPointsGrupos(prediction, match) {
  if (!prediction || !prediction.saved) return { total: 0, types: [] };
  if (!match || match.realHome == null || match.realAway == null) return { total: 0, types: [] };
  // Sentinel: si realHome=0 AND realAway=0, asumimos no jugado (placeholder).
  if (match.realHome === 0 && match.realAway === 0) return { total: 0, types: [] };

  var realL = match.realHome;
  var realR = match.realAway;
  var types = [];

  // Replicamos la lógica de scoring.js calcMatchPoints SIN llamarla directamente
  // (queremos breakdown por tipo, no solo total). El total final debe coincidir
  // (verificar parity post-F2.8 si scoring.js cambia).
  var isExact = prediction.l === realL && prediction.v === realR;
  if (isExact) {
    types.push('exact');
  } else if (Math.sign(prediction.l - prediction.v) === Math.sign(realL - realR) && realL !== realR) {
    types.push('win');
  } else if (Math.sign(prediction.l - prediction.v) === Math.sign(realL - realR) && realL === realR) {
    // empate predicho + empate real
    types.push('win');
  }

  // Goleador (+2): coincide con el goleador real del equipo ganador.
  if (prediction.gol && realL !== realR && typeof EQUIPOS !== 'undefined') {
    var winnerTeam = realL > realR ? prediction.home : prediction.away;
    var team = EQUIPOS.find(function(e) { return e.name === winnerTeam; });
    var realScorer = team && team.players && team.players[0] ? team.players[0].key : null;
    if (realScorer && prediction.gol === realScorer) types.push('gole');
  }

  // Bonus IA contrario (+1). Sólo si iaBonusWillApply existe globalmente.
  var matchKey = (typeof getMatchKey === 'function') ? getMatchKey(match) : null;
  if (typeof iaBonusWillApply === 'function' && matchKey && iaBonusWillApply(matchKey, prediction, realL, realR)) {
    types.push('bonus');
  }

  // Llamamos a calcMatchPoints si disponible para el total canónico (incluye cap 7 + boost).
  var total;
  if (typeof calcMatchPoints === 'function') {
    total = calcMatchPoints(prediction, realL, realR, matchKey);
  } else {
    // Fallback computacional si scoring.js no cargado (sandbox sin scoring).
    total = 0;
    if (types.indexOf('exact') !== -1) total += 3;
    else if (types.indexOf('win') !== -1) total += 1;
    if (types.indexOf('gole') !== -1) total += 2;
    if (types.indexOf('bonus') !== -1) total += 1;
    total = Math.min(total, 7);
  }

  return { total: total, types: types };
}

// Render chips de puntuación bajo cada match-card.
// 3 estados: pre-kickoff (nada) / 0 pts gris / N pts stack con tipos + total.
function v3RenderChipsGrupos(match, prediction) {
  // Estado 1: pre-kickoff o placeholder 0-0 → no chip.
  if (!match || match.realHome == null || match.realAway == null) return '';
  if (match.realHome === 0 && match.realAway === 0) return '';

  var pts = v3CalcMatchPointsGrupos(prediction, match);

  // Estado 2: 0 pts → chip único gris.
  if (pts.total === 0) {
    return '<div class="v3-chip-stack"><span class="v3-chip v3-chip--zero">+0 pts</span></div>';
  }

  // Estado 3: N pts → stack por tipo + chip total destacado.
  var chips = '';
  if (pts.types.indexOf('win') !== -1) chips += '<span class="v3-chip v3-chip--win">✓ Signo</span>';
  if (pts.types.indexOf('exact') !== -1) chips += '<span class="v3-chip v3-chip--exact">★ Exacto</span>';
  if (pts.types.indexOf('gole') !== -1) chips += '<span class="v3-chip v3-chip--gole">⚽ Gol</span>';
  if (pts.types.indexOf('bonus') !== -1) chips += '<span class="v3-chip v3-chip--bonus">IA</span>';
  chips += '<span class="v3-chip v3-chip--total">+' + pts.total + ' pts</span>';
  return '<div class="v3-chip-stack">' + chips + '</div>';
}

// F2.8.1: Tab Goleadores — 1 pick UNIFICADO por partido (lista combinada home+away en el picker).
function v3RenderGoleadoresTabGrupos(grupo, matchesInGroup) {
  var html = '<div class="v3-goleadores-list">';
  var lastDay = null;

  matchesInGroup.forEach(function(match, idx) {
    var day = V3_MATCH_DAY[idx % 6];
    if (day !== lastDay) {
      html += '<div class="v3-match-day-label">Jornada ' + day.slice(1) + '</div>';
      lastDay = day;
    }

    var homeEquipo = v3FindEquipoByName(match.home);
    var awayEquipo = v3FindEquipoByName(match.away);
    var key = getMatchKey(match);
    var p = predictions[key] || {};

    html += '<div class="v3-goleador-row">'
      + '<div class="v3-goleador-row__match">' + homeEquipo.flag + ' vs ' + awayEquipo.flag + '</div>'
      + v3RenderGoleadorPickUnified(idx, match, homeEquipo, awayEquipo, p)
      + '</div>';
  });

  html += '</div>';
  return html;
}

// F2.8.1: render del pick unificado (1 por partido).
// Estados: unavailable (ambos squads vacíos) / empty (sin elegir) / filled (con jugador + chip equipo).
function v3RenderGoleadorPickUnified(idx, match, homeEquipo, awayEquipo, prediction) {
  var homeHasSquad = homeEquipo && homeEquipo.players && homeEquipo.players.length > 0;
  var awayHasSquad = awayEquipo && awayEquipo.players && awayEquipo.players.length > 0;
  var bothEmpty = !homeHasSquad && !awayHasSquad;

  if (bothEmpty) {
    return '<div class="v3-goleador-pick v3-goleador-pick--empty v3-goleador-pick--unavailable" aria-disabled="true">'
      + '<span class="v3-goleador-pick__hint">Squad pendiente — disponible al cargar plantilla</span>'
      + '</div>';
  }

  // Buscar el jugador elegido (si lo hay) entre ambos squads.
  var pickedPlayer = null;
  var pickedTeam = null;
  if (prediction.gol) {
    if (homeHasSquad) {
      var foundHome = homeEquipo.players.find(function(pl) { return pl.key === prediction.gol; });
      if (foundHome) { pickedPlayer = foundHome; pickedTeam = homeEquipo; }
    }
    if (!pickedPlayer && awayHasSquad) {
      var foundAway = awayEquipo.players.find(function(pl) { return pl.key === prediction.gol; });
      if (foundAway) { pickedPlayer = foundAway; pickedTeam = awayEquipo; }
    }
  }

  if (!pickedPlayer) {
    return '<button class="v3-goleador-pick v3-goleador-pick--empty" data-v3-goleador-pick data-v3-match="' + idx + '">'
      + '<span class="v3-goleador-pick__hint">— Elegir goleador</span>'
      + '<span class="v3-goleador-pick__chev">▾</span>'
      + '</button>';
  }

  // Filled: avatar (número extraído del prefijo "9 · Nombre") + nombre + chip equipo.
  var numberMatch = pickedPlayer.name.match(/^(\d+)\s*·\s*/);
  var avatarNum = numberMatch ? numberMatch[1] : '·';
  var playerName = numberMatch ? pickedPlayer.name.replace(/^\d+\s*·\s*/, '') : pickedPlayer.name;

  return '<button class="v3-goleador-pick is-filled" data-v3-goleador-pick data-v3-match="' + idx + '">'
    + '<span class="v3-goleador-pick__avatar">' + avatarNum + '</span>'
    + '<span class="v3-goleador-pick__name">' + playerName + '</span>'
    + '<span class="v3-goleador-pick__team">' + pickedTeam.flag + '</span>'
    + '<span class="v3-goleador-pick__chev">▾</span>'
    + '</button>';
}

// F2.8.1: Open squad picker sub-overlay (z-index 120 sobre el modal z-index 100). Sin side.
function v3OpenGoleadorPickerGrupos(matchIdx) {
  _v3SquadPickerMatchIdx = matchIdx;
  v3EnsureSquadPickerOverlay();
  v3RenderSquadPickerGrupos();
  var overlay = document.querySelector('.v3-squad-picker-overlay');
  if (overlay) overlay.classList.add('is-open');
}

function v3CloseGoleadorPickerGrupos() {
  var overlay = document.querySelector('.v3-squad-picker-overlay');
  if (overlay) overlay.classList.remove('is-open');
  // F2.8.2 defensive: limpiar innerHTML del inner para garantizar que descendientes
  // (botones de jugadores) no quedan en DOM capturando clicks aunque el CSS
  // ya gateé pointer-events. Belt + suspenders.
  var inner = document.querySelector('.v3-squad-picker-panel__inner');
  if (inner) inner.innerHTML = '';
  _v3SquadPickerMatchIdx = null;
}

// Crea overlay+panel del squad picker si no existe (singleton body level).
function v3EnsureSquadPickerOverlay() {
  if (document.querySelector('.v3-squad-picker-overlay')) return;
  var overlay = document.createElement('div');
  overlay.className = 'v3-squad-picker-overlay';
  overlay.setAttribute('aria-hidden', 'true');
  var panel = document.createElement('div');
  panel.className = 'v3-squad-picker-panel';
  var inner = document.createElement('div');
  inner.className = 'v3-squad-picker-panel__inner';
  panel.appendChild(inner);
  document.body.appendChild(overlay);
  document.body.appendChild(panel);
}

// F2.8.1: Render contenido del squad picker con 2 secciones (home + away combinadas).
function v3RenderSquadPickerGrupos() {
  var inner = document.querySelector('.v3-squad-picker-panel__inner');
  if (!inner) return;

  var matchesInGroup = PARTIDOS.filter(m => m.group === _v3CurrentLetter);
  var match = matchesInGroup[_v3SquadPickerMatchIdx];
  if (!match) return;

  var homeEquipo = v3FindEquipoByName(match.home);
  var awayEquipo = v3FindEquipoByName(match.away);
  var key = getMatchKey(match);
  var p = predictions[key] || {};

  var scoreLine = (Number.isInteger(p.l) && Number.isInteger(p.v))
    ? (p.l + ' – ' + p.v)
    : '— – —';

  var html = '<div class="v3-squad-picker-header">'
    + '<div class="v3-squad-picker-header__title">'
    + '<div class="v3-squad-picker-header__eyebrow">Partido ' + (_v3SquadPickerMatchIdx+1) + ' · Jornada ' + V3_MATCH_DAY[_v3SquadPickerMatchIdx].slice(1) + '</div>'
    + '<div class="v3-squad-picker-header__scoreline">' + match.home + ' ' + scoreLine + ' ' + match.away + '</div>'
    + '</div>'
    + '<button class="v3-zoom-close" data-v3-squad-close aria-label="Cerrar (ESC)">✕</button>'
    + '</div>'
    + '<div class="v3-squad-picker-body">'
    + '<h3 class="v3-squad-picker-body__title">Elige goleador</h3>';

  var bothEmpty = (!homeEquipo.players || !homeEquipo.players.length) && (!awayEquipo.players || !awayEquipo.players.length);
  if (bothEmpty) {
    html += '<div class="v3-squad-picker-empty">Plantillas no cargadas. Disponible al cargar las convocatorias oficiales.</div>';
  } else {
    // Sección equipo home + away (cada una si tiene squad).
    html += v3RenderSquadPickerTeamSection(homeEquipo, p.gol);
    html += v3RenderSquadPickerTeamSection(awayEquipo, p.gol);
    if (p.gol) {
      html += '<button class="v3-squad-picker-player v3-squad-picker-player--clear" data-v3-squad-player="">Quitar selección</button>';
    }
  }
  html += '</div>';

  inner.innerHTML = html;

  var closeBtn = inner.querySelector('[data-v3-squad-close]');
  if (closeBtn) closeBtn.onclick = v3CloseGoleadorPickerGrupos;

  inner.querySelectorAll('[data-v3-squad-player]').forEach(function(btn) {
    btn.onclick = function() {
      if (btn.disabled) return;
      v3SaveGoleadorGrupos(_v3SquadPickerMatchIdx, btn.dataset.v3SquadPlayer);
    };
  });
}

// F2.8.1: render sección por equipo (header + lista jugadores). Skipped si squad vacío.
function v3RenderSquadPickerTeamSection(equipo, currentPickKey) {
  if (!equipo.players || !equipo.players.length) {
    return '<div class="v3-squad-picker-team-section v3-squad-picker-team-section--empty">'
      + '<div class="v3-squad-picker-team-section__title">' + equipo.name + '</div>'
      + '<div class="v3-squad-picker-team-section__hint">Plantilla pendiente</div>'
      + '</div>';
  }
  var html = '<div class="v3-squad-picker-team-section">'
    + '<div class="v3-squad-picker-team-section__title">' + equipo.name + '</div>'
    + '<div class="v3-squad-picker-list">';
  equipo.players.forEach(function(pl) {
    var isPicked = currentPickKey === pl.key;
    html += '<button class="v3-squad-picker-player ' + (isPicked?'is-picked':'') + '" data-v3-squad-player="' + pl.key + '">'
      + '<span class="v3-squad-picker-player__name">' + pl.name + '</span>'
      + (isPicked ? '<span class="v3-squad-picker-player__check">✓</span>' : '')
      + '</button>';
  });
  html += '</div></div>';
  return html;
}

// F2.8.1: save infiere side por lookup playerKey en EQUIPOS de ambos equipos del partido.
function v3SaveGoleadorGrupos(matchIdx, playerKey) {
  var matchesInGroup = PARTIDOS.filter(m => m.group === _v3CurrentLetter);
  var match = matchesInGroup[matchIdx];
  if (!match) return;
  var key = getMatchKey(match);

  if (!predictions[key]) {
    predictions[key] = { l: 0, v: 0, saved: true, home: match.home, away: match.away };
  }

  if (playerKey) {
    // Infer side por lookup en home/away.
    var homeEquipo = v3FindEquipoByName(match.home);
    var awayEquipo = v3FindEquipoByName(match.away);
    var side = null;
    if (homeEquipo.players && homeEquipo.players.find(function(p) { return p.key === playerKey; })) {
      side = 'home';
    } else if (awayEquipo.players && awayEquipo.players.find(function(p) { return p.key === playerKey; })) {
      side = 'away';
    }
    predictions[key].gol = playerKey;
    predictions[key].goleadorSide = side; // backward compat; scoring.js lee gol, no side.
  } else {
    predictions[key].gol = null;
    predictions[key].goleadorSide = null;
  }
  predictions[key].home = match.home;
  predictions[key].away = match.away;
  predictions[key].saved = true;

  // Persistir + cerrar sub-overlay + forzar re-render del tab Goleadores.
  if (typeof savePredictions === 'function') savePredictions();
  v3CloseGoleadorPickerGrupos();
  // Asegurar que la tab activa es 'goleadores' (no reset accidental tras render).
  _v3CurrentTab = 'goleadores';
  v3RenderZoomGrupos();
}

function v3AdjustScoreGrupos(letter, matchIdx, side, delta) {
  var matchesInGroup = PARTIDOS.filter(m => m.group === letter);
  var match = matchesInGroup[matchIdx];
  if (!match) return;

  var key = getMatchKey(match);
  if (!predictions[key]) predictions[key] = { l: 0, v: 0, saved: false, home: match.home, away: match.away };

  var fieldKey = side === 'home' ? 'l' : 'v';
  var cur = Number.isInteger(predictions[key][fieldKey]) ? predictions[key][fieldKey] : 0;
  predictions[key][fieldKey] = Math.max(0, Math.min(15, cur + delta));

  var otherKey = side === 'home' ? 'v' : 'l';
  if (!Number.isInteger(predictions[key][otherKey])) {
    predictions[key][otherKey] = 0;
  }

  // F2.8: home/away team names + saved=true (requeridos por scoring.js calcMatchPoints).
  predictions[key].home = match.home;
  predictions[key].away = match.away;
  predictions[key].saved = true;
  savePredictions();
  v3RenderZoomGrupos();
}

function v3BindResetBtn() {
  var btn = document.querySelector('[data-v3-reset]');
  if (!btn) return;
  btn.onclick = () => {
    if (!confirm('¿Borrar todos los pronósticos guardados?')) return;
    predictions = {};
    savePredictions();
    v3RenderBoardGrupos();
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


function v3BindEscapeAndBackdrop() {
  document.addEventListener('keydown', (e) => {
    if (e.key !== 'Escape') return;
    // F2.8: jerarquía de cierre — si sub-overlay del squad picker abierto, cierra ese primero.
    if (_v3SquadPickerMatchIdx !== null) { v3CloseGoleadorPickerGrupos(); return; }
    if (_v3CurrentLetter) v3CloseZoomGrupos();
  });
  document.addEventListener('click', (e) => {
    // F2.8: backdrop del squad picker tiene prioridad sobre el de zoom-overlay.
    if (e.target && e.target.classList && e.target.classList.contains('v3-squad-picker-overlay')) {
      v3CloseGoleadorPickerGrupos();
      return;
    }
    if (e.target && e.target.classList && e.target.classList.contains('v3-zoom-overlay')) {
      v3CloseZoomGrupos();
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
    // F2.4: emoji fallback removido (San lo pidió eliminar — la imagen del logo
    // es el único elemento esperado en esta posición). Si la image falla,
    // queda vacío en lugar de emoji. onerror lo oculta para no mostrar broken-img icon.
    trophyImg.onerror = function () { trophyImg.style.display = 'none'; };
    trophyImg.src = WORLD_CUP_LOGO || 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/Logos/2026_FIFA_World_Cup.png';
    trophyImg.alt = 'FIFA World Cup 2026';
    trophyCol.appendChild(trophyImg);
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
    // v3OpenZoomGrupos/v3RenderZoomGrupos encuentran ese singleton y operan sobre él.

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

  v3RenderBoardGrupos();
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
