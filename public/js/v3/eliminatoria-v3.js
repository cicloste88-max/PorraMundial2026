// v3/eliminatoria-v3.js — Porte del bracket KO del prototipo v3
// Reusa koPredictions, resolvedSlots, resolveKO de ko.js
// Expone: window.v3ElimMount()
// NO auto-init — padre (página KO real) llama window.v3ElimMount()

// F2 integración (padre Opus): mapping 3-letras FIFA → slug v3 para flag URL.
// El brief lo proveía pero el agente Haiku no lo aplicó (construyó URL incorrecta
// "/flags/MEX.svg"). Reusa el mismo mapping que grupos-v3.js. F3 cleanup puede
// extraerlo a shell común.
var V3_FLAG_SLUG_ELIM = {
  MEX: 'Mexico', RSA: 'SouthAfrica', KOR: 'KoreaRepublic', CZE: 'Czechia',
  CAN: 'Canada', BIH: 'Bosnia', QAT: 'Qatar', SUI: 'Switzerland',
  BRA: 'Brazil', MAR: 'Morocco', HAI: 'Haiti', SCO: 'Scotland',
  USA: 'USA', PAR: 'Paraguay', AUS: 'Australia', TUR: 'Turkiye',
  GER: 'Germany', CUW: 'Curacao', CIV: 'CoteIvoire', ECU: 'Ecuador',
  NED: 'Netherlands', JPN: 'Japan', SWE: 'Sweden', TUN: 'Tunisia',
  BEL: 'Belgium', EGY: 'Egypt', IRN: 'Iran', NZL: 'NewZealand',
  ESP: 'Spain', CPV: 'CaboVerde', KSA: 'SaudiArabia', URU: 'Uruguay',
  FRA: 'France', SEN: 'Senegal', IRQ: 'Iraq', NOR: 'Norway',
  ARG: 'Argentina', ALG: 'Algeria', AUT: 'Austria', JOR: 'Jordan',
  POR: 'Portugal', COD: 'CongoDR', UZB: 'Uzbekistan', COL: 'Colombia',
  ENG: 'England', CRO: 'Croatia', GHA: 'Ghana', PAN: 'Panama'
};
function v3FlagURLByCode(code) {
  if (!code) return null;
  var slug = V3_FLAG_SLUG_ELIM[code] || code;
  return window.flagPath ? window.flagPath(slug) : '/flags/redesign v3/' + encodeURIComponent(slug + '.svg');
}

var _v3ElimInited = false;

// HF-Deadline: deadline global pre-Mundial para validación de envíos.
// Duplicada de mundial-shell-v3.js KICKOFF_UTC (classic scripts, sin module
// imports). Si cambia KICKOFF_UTC, actualizar también aquí y el guard
// análogo en admin.js diceSimulateAllKO.
var WC_KICKOFF_UTC = '2026-06-11T19:00:00Z';
var WC_PRESIM_DEADLINE_MS = new Date(WC_KICKOFF_UTC).getTime() - 24 * 60 * 60 * 1000;

window.v3ElimMount = function () {
  // HF-Gate-Groups: bloquear acceso si grupos incompletos. Cuando la porra
  // está cerrada, mostrar bracket en modo read-only. Se chequea ANTES del
  // guard idempotente porque _v3ElimInited cachearía el gate inicial y no
  // re-evaluaría tras completarse los grupos.
  var groupsComplete = (typeof areGroupsComplete === 'function')
    ? areGroupsComplete() : true;
  var cerrada = !!window._porraCerrada;

  if (!cerrada && !groupsComplete) {
    var pageElim = document.getElementById('page-elim');
    if (!pageElim) return console.warn('No page-elim container found');
    var mountGate = document.getElementById('v3-elim-mount');
    if (!mountGate) {
      mountGate = document.createElement('div');
      mountGate.id = 'v3-elim-mount';
      pageElim.appendChild(mountGate);
    }
    var progress = (typeof getGroupsProgress === 'function')
      ? getGroupsProgress() : { filled: 0, total: 72, pct: 0 };
    mountGate.innerHTML =
      '<div class="v3-gate-locked">' +
        '<div class="v3-gate-locked__icon">🔒</div>' +
        '<h2 class="v3-gate-locked__title">Fase Final bloqueada</h2>' +
        '<p class="v3-gate-locked__desc">Completa los 72 marcadores de la fase de grupos para desbloquear el bracket.</p>' +
        '<div class="v3-gate-locked__progress">' + progress.filled + ' / ' + progress.total + ' marcadores</div>' +
        '<button class="v3-btn v3-btn--gold" onclick="showPage(\'grupos\')">Ir a Grupos →</button>' +
      '</div>';
    _v3ElimInited = false;
    return;
  }

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
  actions.setAttribute('data-v3-actions', '');  // HF-Deadline: selector para visibility helper
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
  rounds.forEach(function (key) {
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

    btn.onclick = function () {
      v3CurrentRound = key;
      v3RenderAll();
    };

    wrap.appendChild(btn);
  });
}

// ─── Render board (main bracket) ────────────────────────────
function v3RenderBoard() {
  // HF-08: poblar resolvedSlots desde grupos completados antes de
  // renderizar bracket. resolveAllSlots() (ko.js legacy) computa:
  //  - 12×3 = 36 slots de grupos (1A..3L)
  //  - 8 slots de mejores 3eros (T_ABCDF..T_DEIJL) — orden simple,
  //    no tabla H FIFA estricta (comentario del autor original)
  //  - W/L slots propagados en cascada R32→R16→QF→SF→Third
  // Si los grupos NO están completos, slots quedan undefined y
  // v3ResolveSlotLabel() cae a fallback ("1º Gr.A", "Mejor 3º"…)
  // que es el comportamiento esperado en pre-Mundial.
  if (typeof resolveAllSlots === 'function') {
    try { resolveAllSlots(); } catch (e) { console.warn('HF-08 resolveAllSlots:', e); }
  }
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
  leftMatches.forEach(function (m) {
    leftCol.appendChild(v3RenderKoCard(m, meta));
  });
  board.appendChild(leftCol);

  // F2.9 HF-06 #8: trofeo central SIEMPRE entre las 2 columnas (R32/R16/QF/SF).
  // En F lo gestiona v3RenderFinalBlock (early-return arriba). Sin .final-stack
  // aquí porque no aplican fuera de F.
  var trophyCol = document.createElement('div');
  trophyCol.className = 'v3-trophy-col';
  var trophy = document.createElement('img');
  trophy.className = 'v3-trophy';
  trophy.src = 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/trophy/trophy.png';
  trophy.alt = 'Trophy';
  trophy.onerror = function () { this.style.display = 'none'; };
  trophyCol.appendChild(trophy);
  board.appendChild(trophyCol);

  // Right column
  var rightCol = document.createElement('div');
  rightCol.className = 'v3-column v3-column-right';
  rightMatches.forEach(function (m) {
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
  // HF-09: si el slot está resuelto, mostrar código 3 letras
  // (legible en card de 105px). Si no, fallback al label
  // descriptivo ("1º Gr.A", "Mejor 3º", "G.M97"…).
  var homeLabel = v3ResolveSlotCode(homeSlot) || v3ResolveSlotLabel(homeSlot);
  var awayLabel = v3ResolveSlotCode(awaySlot) || v3ResolveSlotLabel(awaySlot);

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

  div.onclick = function () {
    v3OpenZoom(match, v3RoundMeta[v3CurrentRound]);
  };

  return div;
}

// ─── Cuadro de Honor — data helper (HF-CdH-01) ──────────────
// Extrae los 4 puestos del torneo (Campeón, Subcampeón, 3.º, 4.º) desde el
// state global (BRACKET, resolvedSlots, koPredictions, EQUIPOS). Idempotente.
// Retorna null si BRACKET aún no existe (pre-load) o {champion, runnerUp,
// third, fourth, finalPred, thirdPred} con NAMES (o null) en cada puesto.
// Lógica portada 1:1 de buildChampionPodium (ko.js:676) — NO modificar legacy.
function _v3ComputePodium() {
  if (typeof BRACKET === 'undefined' || !BRACKET.final || !BRACKET.final[0]) return null;
  if (typeof EQUIPOS === 'undefined') return null;

  var matchFinal = BRACKET.final[0];
  var matchThird = BRACKET.third && BRACKET.third[0];

  var hName = (typeof resolvedSlots === 'object' && resolvedSlots) ? resolvedSlots[matchFinal.home] : null;
  var aName = (typeof resolvedSlots === 'object' && resolvedSlots) ? resolvedSlots[matchFinal.away] : null;
  var finalPred = (typeof koPredictions === 'object' && koPredictions)
    ? (koPredictions[matchFinal.id] || koPredictions[String(matchFinal.id)] || {})
    : {};

  var champion = null;
  if (finalPred.saved && finalPred.l !== null && finalPred.l !== undefined) {
    if (finalPred.l > finalPred.v) champion = hName;
    else if (finalPred.v > finalPred.l) champion = aName;
    else if (finalPred.classifier) champion = finalPred.classifier;
  }
  var runnerUp = champion ? (champion === hName ? aName : hName) : null;

  var third = null, fourth = null;
  var thirdPred = matchThird && (typeof koPredictions === 'object' && koPredictions)
    ? (koPredictions[matchThird.id] || koPredictions[String(matchThird.id)] || {})
    : {};
  if (matchThird && thirdPred.saved && thirdPred.l !== null && thirdPred.l !== undefined) {
    var t3h = resolvedSlots[matchThird.home];
    var t3a = resolvedSlots[matchThird.away];
    if (thirdPred.l > thirdPred.v) { third = t3h; fourth = t3a; }
    else if (thirdPred.v > thirdPred.l) { third = t3a; fourth = t3h; }
    else if (thirdPred.classifier) {
      third = thirdPred.classifier;
      fourth = (thirdPred.classifier === t3h) ? t3a : t3h;
    }
  }

  return { champion: champion, runnerUp: runnerUp, third: third, fourth: fourth, finalPred: finalPred, thirdPred: thirdPred };
}

// ─── Cuadro de Honor — render (HF-CdH-01) ───────────────────
// Retorna un <div.v3-podium-wrap> con divider + caja Campeón + caja
// Clasificación Final. Si no hay champion saved → caja Campeón muestra
// placeholder. Si no hay 3.er puesto saved → filas 3º/4º muestran "—".
// Reusa v3FlagURLByCode + EQUIPOS para escudos. NO inventa URL nueva.
function v3RenderCuadroHonor() {
  var podium = _v3ComputePodium();
  if (!podium) return null;

  var PTS = (typeof window !== 'undefined' && window.FINAL_CLASSIFICATION_PTS)
    ? window.FINAL_CLASSIFICATION_PTS
    : { champion: 30, runner_up: 20, third: 15, fourth: 10 };

  // Helper: bandera 32×32 cuadrada redondeada a partir de NAME de equipo.
  function _flagByName(name) {
    if (!name) return '<div class="v3-class-row__flag v3-class-row__flag--empty"></div>';
    if (typeof EQUIPOS === 'undefined') return '<div class="v3-class-row__flag v3-class-row__flag--empty"></div>';
    var team = EQUIPOS.find(function (e) { return e.name === name; });
    if (!team || !team.flag) return '<div class="v3-class-row__flag v3-class-row__flag--empty"></div>';
    var flagUrl = v3FlagURLByCode(team.flag);
    if (!flagUrl) return '<div class="v3-class-row__flag v3-class-row__flag--empty"></div>';
    return '<div class="v3-class-row__flag"><img src="' + flagUrl + '" alt="" onerror="this.parentNode.classList.add(\'v3-class-row__flag--empty\');this.remove();"/></div>';
  }

  var WC_LOGO = (typeof WORLD_CUP_LOGO !== 'undefined') ? WORLD_CUP_LOGO : '';

  // Wrap externo
  var wrap = document.createElement('div');
  wrap.className = 'v3-podium-wrap';

  // Divider "★ CUADRO DE HONOR ★"
  var divider = document.createElement('div');
  divider.className = 'v3-podium-divider';
  divider.innerHTML =
    '<span class="v3-podium-divider__line"></span>' +
    '<span class="v3-podium-divider__star">★</span>' +
    '<span class="v3-podium-divider__label">CUADRO DE HONOR</span>' +
    '<span class="v3-podium-divider__star">★</span>' +
    '<span class="v3-podium-divider__line"></span>';
  wrap.appendChild(divider);

  // ─ Caja Campeón ─
  var champCard = document.createElement('div');
  champCard.className = 'v3-champion-card' + (podium.champion ? '' : ' v3-champion-card--empty');

  if (podium.champion) {
    // HF-CdH-02: resolver escudo del equipo campeón.
    // getBadgeUrl(slug) en ko.js prioriza badge oficial (PNG en BADGE_MAP);
    // fallback a v3FlagURLByCode(flag) para mantener consistencia con el resto
    // del bracket v3 que ya usa esa función para banderas.
    var champTeam = (typeof EQUIPOS !== 'undefined')
      ? EQUIPOS.find(function (e) { return e.name === podium.champion; })
      : null;
    var champBadge = (champTeam && typeof getBadgeUrl === 'function')
      ? getBadgeUrl(champTeam.slug) : null;
    var champFlag = (champTeam && champTeam.flag && typeof v3FlagURLByCode === 'function')
      ? v3FlagURLByCode(champTeam.flag) : '';
    var champImgSrc = champBadge || champFlag;
    var champBadgeHtml = champImgSrc
      ? '<div class="v3-champion-card__team">' +
      '<div class="v3-champion-card__team-glow"></div>' +
      '<img class="v3-champion-card__team-badge" src="' + champImgSrc + '" alt="" ' +
      (champFlag && champImgSrc !== champFlag
        ? 'onerror="this.src=\'' + champFlag + '\'"'
        : 'onerror="this.style.display=\'none\'"') +
      '/>' +
      '</div>'
      : '';

    champCard.innerHTML =
      '<img class="v3-champion-card__logo" src="' + WC_LOGO + '" alt="" onerror="this.style.display=\'none\'"/>' +
      '<div class="v3-champion-card__sep"></div>' +
      champBadgeHtml +
      '<div class="v3-champion-card__body">' +
      '<div class="v3-champion-card__eyebrow">CAMPEÓN</div>' +
      '<div class="v3-champion-card__name">' + podium.champion + '</div>' +
      '</div>' +
      '<div class="v3-podium-pts v3-podium-pts--gold">+' + PTS.champion + ' pts</div>';
  } else {
    champCard.innerHTML =
      '<img class="v3-champion-card__logo v3-champion-card__logo--muted" src="' + WC_LOGO + '" alt="" onerror="this.style.display=\'none\'"/>' +
      '<div class="v3-champion-card__placeholder">Pronostica la Gran Final para ver el campeón</div>';
  }
  wrap.appendChild(champCard);

  // ─ Caja Clasificación Final ─
  var classCard = document.createElement('div');
  classCard.className = 'v3-classification-card';

  var rows = [
    { medal: '🥈', name: podium.runnerUp, label: '2.º Subcampeón', pts: PTS.runner_up },
    { medal: '🥉', name: podium.third, label: '3.º Puesto', pts: PTS.third },
    { medal: '④', name: podium.fourth, label: '4.º Puesto', pts: PTS.fourth }
  ];

  var rowsHtml = rows.map(function (r, i) {
    var isLast = (i === rows.length - 1);
    return '<div class="v3-class-row' + (isLast ? ' v3-class-row--last' : '') + '">' +
      '<div class="v3-class-row__medal">' + r.medal + '</div>' +
      _flagByName(r.name) +
      '<div class="v3-class-row__info">' +
      '<div class="v3-class-row__name">' + (r.name || '—') + '</div>' +
      '<div class="v3-class-row__label">' + r.label + '</div>' +
      '</div>' +
      '<div class="v3-podium-pts">+' + r.pts + ' pts</div>' +
      '</div>';
  }).join('');

  classCard.innerHTML =
    '<div class="v3-classification-card__eyebrow">CLASIFICACIÓN FINAL</div>' +
    rowsHtml;
  wrap.appendChild(classCard);

  // HF-CdH-05: programar auto-shrink del nombre tras el primer layout.
  // requestAnimationFrame asegura que el wrap esté insertado por el caller
  // (v3RenderFinalBlock) y que clientWidth del body refleje el ancho real.
  if (podium.champion && typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(v3FitChampionName);
  }

  return wrap;
}

// HF-CdH-05 · Auto-shrink del nombre del campeón. El clamp() CSS solo
// escala por viewport (vw), pero el body interno del champion-card tiene
// un ancho fijo ≈180px tras logo (44) + separador (1) + escudo (64) +
// gaps (3×14) + paddings (2×14) — invariante respecto al vw. Reducimos
// font-size en pasos de 1px desde 24 hasta 11 hasta que `scrollWidth`
// (ancho real del texto) deje de exceder `clientWidth` (ancho disponible
// del contenedor). Máx 14 iteraciones; si a 11px aún no cabe, el
// text-overflow:ellipsis del CSS toma el control como fallback final.
function v3FitChampionName() {
  var el = document.querySelector('.v3-champion-card__name');
  if (!el || el.clientWidth <= 0) return;
  for (var fs = 24; fs >= 11; fs--) {
    el.style.fontSize = fs + 'px';
    if (el.scrollWidth <= el.clientWidth) return;
  }
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
  // F2.9 HF-06: URL alineada con prototipo (miniatures/trophy/trophy.png) — antes apuntaba a trophy-2026.png.
  trophy.src = 'https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/miniatures/trophy/trophy.png';
  trophy.alt = 'Trophy';
  trophy.onerror = function () { this.style.display = 'none'; };
  trophyCol.appendChild(trophy);

  // Third below
  var belowStack = document.createElement('div');
  belowStack.className = 'v3-final-stack v3-final-stack--below';
  if (thirdMatches && thirdMatches[0]) {
    belowStack.appendChild(v3RenderFinalCard(thirdMatches[0], meta, 'third'));
  }
  trophyCol.appendChild(belowStack);

  board.appendChild(trophyCol);

  // HF-CdH-01: Cuadro de Honor (Campeón + Clasificación Final) bajo el bracket.
  // Solo se ejecuta cuando round === 'f' (v3RenderBoard:144 early-return arriba),
  // así que no hace falta guard extra de ronda. Idempotente y defensivo.
  try {
    var cdh = v3RenderCuadroHonor();
    if (cdh) board.appendChild(cdh);
  } catch (e) {
    console.warn('[HF-CdH] error rendering Cuadro de Honor:', e);
  }
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

  div.onclick = function () {
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

// HF-09: helper para obtener código 3 letras del slot resuelto.
// Mismo formato que grupos post-sim (F3-I1.6.4): equipo.code ||
// equipo.flag || slice(0,3).toUpperCase(). equipo.flag en EQUIPOS
// ya contiene códigos FIFA estándar (MEX, BRA, USA, KOR…).
function v3ResolveSlotCode(slot) {
  if (typeof resolvedSlots === 'undefined' || !resolvedSlots[slot]) {
    return null;
  }
  var teamName = resolvedSlots[slot];
  if (typeof EQUIPOS === 'undefined') return teamName;
  var team = EQUIPOS.find(function (e) { return e.name === teamName; });
  if (!team) return teamName;
  return team.code
    || team.flag
    || teamName.slice(0, 3).toUpperCase();
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

  var team = EQUIPOS.find(function (e) { return e.name === teamName; });
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

  inner.querySelectorAll('[data-stepper]').forEach(function (btn) {
    btn.onclick = function (e) {
      e.stopPropagation();
      v3AdjustScoreKO(match.id, btn.dataset.side, +btn.dataset.delta);
    };
  });

  inner.querySelectorAll('[data-pen]').forEach(function (btn) {
    btn.onclick = function (e) {
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
    resetBtn.onclick = async function() {
      // HF-Reset-01: confirm explícito sobre la asimetría intencional. R32 leerá
      // de los slots 1A/2B/T_* (derivados de grupos) y mostrará equipos resueltos
      // aunque hayas borrado tus KO predictions — esto es coherencia con grupos.
      if (!confirm('¿Borrar pronósticos KO?\n\nLos emparejamientos R32 (España vs Argentina…) seguirán visibles según tu clasificación de grupos. Para resetear todo el torneo usa "Borrar pronósticos" en la pantalla de grupos.')) return;

      // ─── 1. Vaciar memoria (UX inmediato) ───
      // HF-SIM-01: mutar in-place — koPredictions es let en ko.js.
      if (typeof koPredictions !== 'undefined') {
        Object.keys(koPredictions).forEach(function(k){ delete koPredictions[k]; });
      }
      if (typeof resolvedSlots !== 'undefined') {
        Object.keys(resolvedSlots).forEach(function(k){
          if (k.startsWith('W') || k.startsWith('L')) delete resolvedSlots[k];
        });
      }
      if (typeof saveKO === 'function') saveKO();
      v3RenderAll();

      // ─── 2. HF-Reset-02: DELETE explícito en Supabase ko_predictions ───
      // Sin esto, saveKO (UPSERT, no SYNC) deja las rows antiguas en BBDD
      // y reaparecen al recargar la página.
      try {
        var leagueId = typeof getActiveLeagueId === 'function' ? getActiveLeagueId() : null;
        var uid = (typeof currentUser !== 'undefined' && currentUser && currentUser.id) || null;
        if (!uid || !leagueId || !db) {
          console.warn('[HF-Reset-02 elim] No uid/leagueId/db, skip Supabase DELETE');
          return;
        }
        var { error } = await db.from('ko_predictions').delete()
          .eq('user_id', uid)
          .eq('league_id', leagueId);
        if (error) console.warn('[HF-Reset-02 elim] ko_predictions delete error:', error);
      } catch (e) {
        console.warn('[HF-Reset-02 elim] Supabase DELETE exception:', e);
      }
    };
  }

  // Dice button
  var diceBtn = document.querySelector('[data-v3-elim-dice]');
  if (diceBtn) {
    // HF-SIM-01: sin confirm duplicado — diceSimulateAllKO (admin.js:702)
    // muestra su propio confirm con texto más informativo.
    diceBtn.onclick = function () {
      v3SimulateDice();
    };
  }

  // ESC key
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && v3CurrentMatch) v3CloseZoomKO();
  });

  // Overlay click
  var overlay = document.querySelector('.v3-zoom-overlay');
  if (overlay) {
    overlay.onclick = function (e) {
      if (e.target === overlay) v3CloseZoomKO();
    };
  }
}

// HF-SIM-01 · Delegación al motor real. La implementación previa era un stub
// hardcoded (R32 random + R16 89-92 fijo 2-1 + QF 97 fijo 0-0 + Final/3.er
// puesto fijos), que dejaba SF 101-102 + R16 93-96 + QF 98-100 sin pred y
// rompía la propagación de slots → el Cuadro de Honor v3 (HF-CdH-01) no
// recibía W101/W102 resueltos. diceSimulateAllKO (admin.js:700) sí recorre
// las 6 rondas con propagación slot-by-slot.
//
// setTimeout post-call: diceSimulateAllKO no emite `mundial:predictions-changed`
// (I3 pendiente), así que forzamos re-render del board v3 con un tick de
// margen para que saveKO()/refreshAllViews() terminen sus mutaciones.
function v3SimulateDice() {
  if (typeof diceSimulateAllKO !== 'function') return;
  diceSimulateAllKO();
  setTimeout(function () { if (typeof v3RenderAll === 'function') v3RenderAll(); }, 100);
}

// ─── Main render ────────────────────────────────────────────

// HF-Deadline: regla de visibilidad de los botones de simulación KO.
// Oculta si el usuario finalizó (profiles.porra_cerrada → window._porraCerrada)
// O si estamos dentro de las últimas 24h pre-kickoff (deadline global para
// que San valide envíos antes del primer partido).
function v3ShouldShowSimActions() {
  if (window._porraCerrada) return false;
  if (Date.now() >= WC_PRESIM_DEADLINE_MS) return false;
  return true;
}

function v3RefreshActionsVisibility() {
  var el = document.querySelector('[data-v3-actions]');
  if (!el) return;
  el.style.display = v3ShouldShowSimActions() ? '' : 'none';
}

function v3RenderAll() {
  v3RenderSwitcher();
  v3RenderBoard();
  v3RefreshActionsVisibility();  // HF-Deadline
}

// ─── Defensivo: pattern readyState ──────────────────────────
var v3RunInit = function () {
  // Inicialización la hace el padre al llamar window.v3ElimMount()
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', v3RunInit);
} else {
  v3RunInit();
}
