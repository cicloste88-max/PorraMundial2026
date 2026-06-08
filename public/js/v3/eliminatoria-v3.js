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

// HF-BUG-08/BUG-01: guard anti-acumulacion. Cubre TANTO el listener keydown (ESC)
// como el backdrop click delegado. Nombre refleja el scope real del flag.
// Set una sola vez por page-load; independiente de _v3ElimInited (que se resetea
// en la rama gate-locked). Ver analisis 2026-05-17.
var _v3ElimGlobalListenersBound = false;

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
      ? getGroupsProgress() : { filled: 0, total: 72, pct: 0, firstIncompleteLetter: null };
    var ctaLabel = progress.firstIncompleteLetter
      ? 'Ir al Grupo ' + progress.firstIncompleteLetter + ' →'
      : 'Ir a Grupos →';
    mountGate.innerHTML =
      '<div class="v3-gate-locked">' +
        '<div class="v3-gate-locked__icon">🔒</div>' +
        '<h2 class="v3-gate-locked__title">Fase Final bloqueada</h2>' +
        '<p class="v3-gate-locked__desc">Completa los 72 marcadores de la fase de grupos para desbloquear el bracket.</p>' +
        '<div class="v3-gate-locked__progress">' + progress.filled + ' / ' + progress.total + ' marcadores</div>' +
        '<button class="v3-btn v3-btn--gold" data-v3-elim-gate-cta>' + ctaLabel + '</button>' +
      '</div>';
    // F3: bind programático del CTA — redirige al modal del primer grupo
    // incompleto (más directo que showPage('grupos') sin contexto). Si por
    // alguna razón firstIncompleteLetter es null pero groupsComplete es false
    // (race), fallback a solo showPage sin abrir modal.
    var ctaBtn = mountGate.querySelector('[data-v3-elim-gate-cta]');
    if (ctaBtn) {
      ctaBtn.onclick = function () {
        if (typeof showPage === 'function') showPage('grupos');
        var letter = progress.firstIncompleteLetter;
        if (letter && typeof v3OpenZoomGrupos === 'function') {
          setTimeout(function () { v3OpenZoomGrupos(letter); }, 250);
        }
      };
    }
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

  // Polish v1 B4 Items 12+13: bloque cerrar porra v3 — botón principal +
  // bind a v3FinalizarPorra. Outside del .v3-actions data-v3-actions
  // (que se oculta T-24h pre-kickoff por HF-Deadline). Cierre puede
  // dispararse hasta el deadline manual o el cron 10-jun 21:59 UTC.
  var cerrarWrap = document.createElement('div');
  cerrarWrap.className = 'v3-actions v3-actions--cerrar';
  cerrarWrap.innerHTML = `
    <button class="v3-btn v3-btn--gold v3-btn--cerrar" data-v3-finalizar>
      ✅ Cerrar y enviar mi porra
    </button>
  `;
  mount.appendChild(cerrarWrap);

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

  // Polish v1 B4 Item 10: Awards Card v3 bajo el Cuadro de Honor.
  try {
    var awards = v3RenderAwardsCard();
    if (awards) board.appendChild(awards);
  } catch (e) {
    console.warn('[Awards-v3] error rendering:', e);
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

// Polish v1 B3: bloque "IA PREDICE" reutilizable (modal KO + modal Grupos).
// matchKey: para grupos es getMatchKey(match) = "A_México_Sudáfrica".
// Para KO es match.id (M81…), que normalmente no tendrá entry en
// iaPredictions (loadIAPredictions solo reindexa partidos con `group`).
// Defensa: retorna '' si no hay datos — no rompe el render.
// Quip SIEMPRE visible si existe (sin badge dudoso; San: consistencia).
// Polish v1 Fix-2 sub-1: largest remainder method (Hamilton). Garantiza
// que pHome+pDraw+pAway sume exactamente 100 (antes 3x Math.round daban
// 99 o 101 por rounding error).
function _v3DistributeTo100(probs) {
  var raw = probs.map(function (p) { return (p || 0) * 100; });
  var floors = raw.map(function (r) { return Math.floor(r); });
  var sum = floors.reduce(function (a, b) { return a + b; }, 0);
  var diff = 100 - sum;
  if (diff <= 0) return floors;
  var remainders = raw.map(function (r, i) { return { idx: i, dec: r - Math.floor(r) }; });
  remainders.sort(function (a, b) { return b.dec - a.dec; });
  for (var i = 0; i < diff; i++) {
    floors[remainders[i % remainders.length].idx]++;
  }
  return floors;
}

// Polish v1 Fix-3: helper para obtener ISO3 de un slot (KO).
// Reusa v3ResolveSlotCode (ya implementa la cadena resolvedSlots→EQUIPOS→
// team.code||team.flag) para devolver el código FIFA 3 letras.
function v3GetMatchTeamIso3(match, side) {
  if (!match) return null;
  var slot = (side === 'home') ? match.home : match.away;
  if (typeof v3ResolveSlotCode === 'function') {
    return v3ResolveSlotCode(slot);
  }
  if (typeof resolvedSlots !== 'undefined' && resolvedSlots[slot] && typeof EQUIPOS !== 'undefined') {
    var name = resolvedSlots[slot];
    var team = EQUIPOS.find(function (e) { return e.name === name; });
    return team ? (team.code || team.flag) : null;
  }
  return null;
}
window.v3GetMatchTeamIso3 = v3GetMatchTeamIso3;

// Polish v1 Fix-3: acepta string key (grupos: "A_México_Sudáfrica") o
// objeto match (KO: construye key "ondemand_{ISO3_A}_{ISO3_B}_2" desde
// slots resueltos). BD ia_predictions.match_id formato confirmado:
// 218 filas KO con prefijo "ondemand_". No hay simetría garantizada,
// probamos ambos órdenes.
function v3RenderIABlock(matchKeyOrMatch) {
  // F-05 (round 3): NO devolver '' aunque iaPredictions no esté disponible.
  // Renderizar siempre al menos la cabecera label + '?' para que el tooltip
  // explicativo esté accesible en TODAS las cards (grupos + KO QF/SF/F).
  var iaMap = (typeof iaPredictions === 'object' && iaPredictions) ? iaPredictions : {};
  var pred = null;

  if (typeof matchKeyOrMatch === 'string') {
    pred = iaMap[matchKeyOrMatch];
  } else if (typeof matchKeyOrMatch === 'object' && matchKeyOrMatch !== null) {
    var match = matchKeyOrMatch;
    if (match.group && typeof getMatchKey === 'function') {
      pred = iaMap[getMatchKey(match)];
    } else {
      var homeIso3 = v3GetMatchTeamIso3(match, 'home');
      var awayIso3 = v3GetMatchTeamIso3(match, 'away');
      if (homeIso3 && awayIso3) {
        pred = iaMap['ondemand_' + homeIso3 + '_' + awayIso3 + '_2']
            || iaMap['ondemand_' + awayIso3 + '_' + homeIso3 + '_2'];
      }
    }
  }

  // F-05: si no hay predicción IA, igualmente renderizar la cabecera con
  // label + botón "?" (tooltip generico de cómo funciona la IA). El bloque
  // de probabilidades queda oculto hasta que llegue la data.
  if (!pred || pred.p_home == null || pred.p_away == null) {
    return '<div class="v3-zoom-ia v3-zoom-ia--empty">'
      + '<div class="v3-zoom-ia__label">🤖 IA PREDICE'
      +   '<button type="button" class="ia-info-btn" aria-label="Cómo funciona IA Predice" onclick="event.stopPropagation();window.showIAInfoTooltip&&window.showIAInfoTooltip(this)">?</button>'
      + '</div>'
      + '<div class="v3-zoom-ia__empty">— Datos IA pendientes —</div>'
      + '</div>';
  }

  var pcts = _v3DistributeTo100([pred.p_home, pred.p_draw, pred.p_away]);
  var pHome = pcts[0], pDraw = pcts[1], pAway = pcts[2];
  var quip = pred.quip || '';
  var quipSafe = (typeof escapeHtml === 'function')
    ? escapeHtml(quip)
    : String(quip).replace(/[&<>"']/g, function (c) {
        return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
      });

  // Ocultar % en segmentos demasiado finos (< 10%) — texto desbordaría.
  function seg(pct, cls) {
    var label = pct >= 10 ? ('<span class="v3-zoom-ia__pct">' + pct + '%</span>') : '';
    return '<div class="v3-zoom-ia__seg ' + cls + '" style="width:' + pct + '%">' + label + '</div>';
  }

  return '<div class="v3-zoom-ia">'
    + '<div class="v3-zoom-ia__label">🤖 IA PREDICE'
    +   '<button type="button" class="ia-info-btn" aria-label="Cómo funciona IA Predice" onclick="event.stopPropagation();window.showIAInfoTooltip&&window.showIAInfoTooltip(this)">?</button>'
    + '</div>'
    + '<div class="v3-zoom-ia__bar">'
    +   seg(pHome, 'v3-zoom-ia__seg--home')
    +   seg(pDraw, 'v3-zoom-ia__seg--draw')
    +   seg(pAway, 'v3-zoom-ia__seg--away')
    + '</div>'
    // Polish v1 Fix-2 sub-2: labels con width = % del segmento (antes 3 spans
    // con justify-content space-between los ponía en extremos del contenedor;
    // "Empate" caía fuera cuando draw <15%).
    + '<div class="v3-zoom-ia__teams">'
    +   '<div class="v3-zoom-ia__team" style="width:' + pHome + '%">Local</div>'
    +   '<div class="v3-zoom-ia__team" style="width:' + pDraw + '%">Empate</div>'
    +   '<div class="v3-zoom-ia__team" style="width:' + pAway + '%">Visitante</div>'
    + '</div>'
    + (quip ? '<div class="v3-zoom-ia__quip">"' + quipSafe + '"</div>' : '')
    + '</div>';
}
window.v3RenderIABlock = v3RenderIABlock;

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

  // F1 — picker goleador KO. Lookup nombre del jugador desde EQUIPOS resueltos
  // + fallback en window._scorerCandidatesCache (poblado al abrir el picker
  // la primera vez con squad pinneado de BD).
  var scorerKey = pred.gol || null;
  var scorerName = null;
  if (scorerKey) {
    var homeName = (typeof resolvedSlots !== 'undefined') ? resolvedSlots[match.home] : null;
    var awayName = (typeof resolvedSlots !== 'undefined') ? resolvedSlots[match.away] : null;
    var homeEq = homeName ? v3FindEquipoByName(homeName) : null;
    var awayEq = awayName ? v3FindEquipoByName(awayName) : null;
    var found = (homeEq && homeEq.players || []).find(function (p) { return p.key === scorerKey; })
             || (awayEq && awayEq.players || []).find(function (p) { return p.key === scorerKey; });
    if (!found) {
      var cacheH = (homeEq && homeEq.flag && window._scorerCandidatesCache)
        ? window._scorerCandidatesCache[homeEq.flag] : null;
      var cacheA = (awayEq && awayEq.flag && window._scorerCandidatesCache)
        ? window._scorerCandidatesCache[awayEq.flag] : null;
      found = (Array.isArray(cacheH) && cacheH.find(function (p) { return p.key === scorerKey; }))
           || (Array.isArray(cacheA) && cacheA.find(function (p) { return p.key === scorerKey; }))
           || null;
    }
    scorerName = found ? found.name : scorerKey;
  }
  var goleadorHtml = `
    <div class="v3-zoom-ko-goleador">
      <div class="v3-zoom-ko-goleador__label">Goleador</div>
      ${scorerKey
        ? `<div class="v3-zoom-ko-goleador__picked">
             <span class="v3-zoom-ko-goleador__name">${escapeHtml(scorerName)}</span>
             <div class="v3-zoom-ko-goleador__actions">
               <button class="v3-zoom-ko-goleador__btn" data-v3-ko-gol-change>Cambiar</button>
               <button class="v3-zoom-ko-goleador__btn v3-zoom-ko-goleador__btn--clear" data-v3-ko-gol-clear>Quitar</button>
             </div>
           </div>`
        : `<button class="v3-zoom-ko-goleador__pick" data-v3-ko-gol-pick>Elige goleador</button>`}
    </div>
  `;

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
      ${goleadorHtml}
      ${v3RenderIABlock(match)}
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

  // F1 — goleador picker bindings.
  var pickBtn = inner.querySelector('[data-v3-ko-gol-pick]') || inner.querySelector('[data-v3-ko-gol-change]');
  if (pickBtn) pickBtn.onclick = function (e) {
    e.stopPropagation();
    v3OpenGoleadorPickerKO(match.id);
  };
  var clearBtn = inner.querySelector('[data-v3-ko-gol-clear]');
  if (clearBtn) clearBtn.onclick = function (e) {
    e.stopPropagation();
    v3SaveGoleadorKO(match.id, null);
  };
}

function v3AdjustScoreKO(matchId, side, delta) {
  if (typeof koPredictions === 'undefined') return;
  if (v3IsPorraCerrada()) return;  // Polish v1 B4: lock tras cerrar porra

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
  if (v3IsPorraCerrada()) return;  // Polish v1 B4: lock tras cerrar porra
  if (!koPredictions[matchId]) return;

  var p = koPredictions[matchId];
  p.classifier = side;
  p.saved = true;
  if (typeof saveKO === 'function') saveKO();

  v3RenderZoomKO();
}

// ─── F1 — Picker de goleador KO ─────────────────────────────
// Reutiliza el sub-overlay singleton `.v3-squad-picker-overlay` montado por grupos-v3
// (v3EnsureSquadPickerOverlay) y la sección de jugadores por equipo
// (v3RenderSquadPickerTeamSection). Funciones de grupos asumidas globales (classic scripts).
// Sprint Combos & Awards F1 (28-may): async — carga candidates desde
// getScorerCandidates(iso3) para usar squad pinneado en BD (no solo
// EQUIPOS[].players de data.js).
var _v3KOGoleadorPickerMatchId = null;
var _v3KOPickerHomeCands = [];
var _v3KOPickerAwayCands = [];
var _v3KOPickerLoading = false;

async function v3OpenGoleadorPickerKO(matchId) {
  _v3KOGoleadorPickerMatchId = matchId;
  _v3KOPickerHomeCands = [];
  _v3KOPickerAwayCands = [];
  _v3KOPickerLoading = true;
  if (typeof v3EnsureSquadPickerOverlay === 'function') v3EnsureSquadPickerOverlay();
  v3RenderGoleadorPickerKO();
  var overlay = document.querySelector('.v3-squad-picker-overlay');
  if (overlay) overlay.classList.add('is-open');

  // Resolver equipos del match para cargar candidates.
  var allKO = (typeof BRACKET !== 'undefined')
    ? [].concat(BRACKET.r32 || [], BRACKET.r16 || [], BRACKET.qf || [], BRACKET.sf || [], BRACKET.third || [], BRACKET.final || [])
    : [];
  var match = allKO.find(function (m) { return m.id === matchId; });
  if (!match) { _v3KOPickerLoading = false; return; }
  var homeName = (typeof resolvedSlots !== 'undefined') ? resolvedSlots[match.home] : null;
  var awayName = (typeof resolvedSlots !== 'undefined') ? resolvedSlots[match.away] : null;
  var homeEquipo = homeName && typeof v3FindEquipoByName === 'function' ? v3FindEquipoByName(homeName) : null;
  var awayEquipo = awayName && typeof v3FindEquipoByName === 'function' ? v3FindEquipoByName(awayName) : null;
  if (typeof getScorerCandidates !== 'function' || !homeEquipo || !awayEquipo) {
    _v3KOPickerLoading = false;
    v3RenderGoleadorPickerKO();
    return;
  }
  try {
    var pair = await Promise.all([
      getScorerCandidates(homeEquipo.flag),
      getScorerCandidates(awayEquipo.flag),
    ]);
    if (_v3KOGoleadorPickerMatchId !== matchId) return; // user moved on
    _v3KOPickerHomeCands = pair[0] || [];
    _v3KOPickerAwayCands = pair[1] || [];
  } catch (e) {
    console.warn('[v3-ko-picker] error cargando candidates', e);
  }
  _v3KOPickerLoading = false;
  v3RenderGoleadorPickerKO();
}

function v3RenderGoleadorPickerKO() {
  var matchId = _v3KOGoleadorPickerMatchId;
  if (matchId === null) return;

  var inner = document.querySelector('.v3-squad-picker-panel__inner');
  if (!inner) return;

  // Localizar match en BRACKET (todas las rondas).
  var allKO = (typeof BRACKET !== 'undefined')
    ? [].concat(BRACKET.r32 || [], BRACKET.r16 || [], BRACKET.qf || [], BRACKET.sf || [], BRACKET.third || [], BRACKET.final || [])
    : [];
  var match = allKO.find(function (m) { return m.id === matchId; });
  if (!match) return;

  var pred = (typeof koPredictions !== 'undefined')
    ? (koPredictions[matchId] || koPredictions[String(matchId)] || {})
    : {};
  var currentPickKey = pred.gol || null;

  // Resolver nombres reales de equipos desde resolvedSlots para encontrar los EQUIPOS.
  var homeName = (typeof resolvedSlots !== 'undefined') ? resolvedSlots[match.home] : null;
  var awayName = (typeof resolvedSlots !== 'undefined') ? resolvedSlots[match.away] : null;
  var homeEquipo = homeName ? v3FindEquipoByName(homeName) : { name: v3ResolveSlotLabel(match.home), players: [] };
  var awayEquipo = awayName ? v3FindEquipoByName(awayName) : { name: v3ResolveSlotLabel(match.away), players: [] };

  var homeLabel = v3ResolveSlotLabel(match.home);
  var awayLabel = v3ResolveSlotLabel(match.away);
  var roundMeta = _v3GetRoundMetaForMatch(matchId);
  var eyebrow = (roundMeta ? roundMeta.label : 'Eliminatoria') + ' · ' + matchId;

  var html = '<div class="v3-squad-picker-header">'
    + '<div class="v3-squad-picker-header__title">'
    + '<div class="v3-squad-picker-header__eyebrow">' + eyebrow + '</div>'
    + '<div class="v3-squad-picker-header__scoreline">' + escapeHtml(homeLabel) + ' vs ' + escapeHtml(awayLabel) + '</div>'
    + '</div>'
    + '<button class="v3-zoom-close" data-v3-ko-gol-close aria-label="Cerrar (ESC)">✕</button>'
    + '</div>'
    + '<div class="v3-squad-picker-body">'
    + '<h3 class="v3-squad-picker-body__title">Elige goleador</h3>';

  // Sprint Combos & Awards F1: usar caches cargadas por v3OpenGoleadorPickerKO.
  if (_v3KOPickerLoading && !_v3KOPickerHomeCands.length && !_v3KOPickerAwayCands.length) {
    html += '<div class="v3-squad-picker-empty">Cargando jugadores…</div>';
  } else {
    var bothEmpty = !_v3KOPickerHomeCands.length && !_v3KOPickerAwayCands.length;
    if (bothEmpty) {
      html += '<div class="v3-squad-picker-empty">Plantillas no cargadas. Disponible al cargar las convocatorias oficiales.</div>';
    } else {
      html += v3RenderSquadPickerTeamSection(homeEquipo, _v3KOPickerHomeCands, currentPickKey, 'home');
      html += v3RenderSquadPickerTeamSection(awayEquipo, _v3KOPickerAwayCands, currentPickKey, 'away');
      if (currentPickKey) {
        html += '<button class="v3-squad-picker-player v3-squad-picker-player--clear" data-v3-squad-player="">Quitar selección</button>';
      }
    }
  }
  html += '</div>';

  inner.innerHTML = html;

  var closeBtn = inner.querySelector('[data-v3-ko-gol-close]');
  if (closeBtn) closeBtn.onclick = v3CloseGoleadorPickerKO;

  inner.querySelectorAll('[data-v3-squad-player]').forEach(function (btn) {
    btn.onclick = function () {
      if (btn.disabled) return;
      v3SaveGoleadorKO(matchId, btn.dataset.v3SquadPlayer || null);
    };
  });
}

function v3CloseGoleadorPickerKO() {
  var overlay = document.querySelector('.v3-squad-picker-overlay');
  if (overlay) overlay.classList.remove('is-open');
  var inner = document.querySelector('.v3-squad-picker-panel__inner');
  if (inner) inner.innerHTML = '';
  _v3KOGoleadorPickerMatchId = null;
}

// CRÍTICO: NO replica HF-BUG-13 (CLAUDE.md Backlog #3). saved=true NO se marca
// indiscriminadamente desde el path goleador. v3AdjustScoreKO y v3SetPenaltyWinner
// lo controlan (introducen marcador o classifier). Goleador puro deja saved como estaba.
// Coherente con HF-BUG-05 + HF-BUG-05-bis: pred {l:null, v:null, gol:'X', saved:false}
// puntúa solo goleador en scoring (+2 si acierta), sin signo/exact fantasma.
function v3SaveGoleadorKO(matchId, playerKey) {
  if (typeof koPredictions === 'undefined') return;
  if (v3IsPorraCerrada()) return;  // Polish v1 B4: lock tras cerrar porra
  if (!koPredictions[matchId]) {
    koPredictions[matchId] = { l: null, v: null, classifier: null, gol: null, saved: false };
    koPredictions[String(matchId)] = koPredictions[matchId];
  }
  koPredictions[matchId].gol = playerKey || null;
  // saved se preserva en su valor previo. NO marcar saved=true aquí.
  if (typeof saveKO === 'function') saveKO();
  v3CloseGoleadorPickerKO();
  v3RenderZoomKO();
}

// ─── Polish v1 B4 Item 10 + Fix-4 — Awards Card v3 ──────────
// Reutiliza diseño legacy renderBox4 (ko.js): imágenes de fondo
// Maradona/Ronaldo/Casillas/Mejor sub21, header Premios Individuales +
// Copa Mundial 2026, footer progress dots + botón guardar/deshacer.
// Cambio Fix-4: NO replicamos la card en JS+CSS v3, sino que
// invocamos window.renderAwardsBox4Legacy (factory expuesto en
// ko.js que crea una instancia INDEPENDIENTE del box4 legacy con
// su propio closure renderBox4). CSS reutilizado de base.css/admin.css
// (.aw-slot, .aw-grid, .aw-header, etc.). Persistencia + suggestion
// + lock _porraCerrada los maneja el motor legacy.
function v3RenderAwardsCard() {
  if (typeof window.renderAwardsBox4Legacy !== 'function') {
    console.warn('[Awards-v3] renderAwardsBox4Legacy no disponible');
    return null;
  }
  var wrap = document.createElement('div');
  wrap.className = 'v3-awards-wrap';
  var box = window.renderAwardsBox4Legacy();
  if (box) wrap.appendChild(box);
  return wrap;
}
window.v3RenderAwardsCard = v3RenderAwardsCard;

// F4 (rediseño PR #112) — top 3 goleadores del usuario para la sección "Tus
// goleadores" del picker golden_boot (sustituye el badge interno por una
// sección destacada arriba con click-to-select). Devuelve array
// [{scorer_key, n, rank}] (top 5, con margen). El render (_buildTopScorersHtml)
// filtra a candidatos válidos de Bota y recorta a 3. [] si no hay sesión/liga,
// error, o sin scorers. Sin gating de margin: el usuario decide.
// Async: openPicker la await-ea. window._porraDb = cliente auth (RLS necesita
// el JWT del usuario; el proxy `db` enruta al query client sin sesión).
async function _v3SuggestGoldenBoot() {
  var uid = currentUser?.id;
  var leagueId = (typeof getActiveLeagueId === 'function') ? getActiveLeagueId() : null;
  if (!uid || !leagueId || !window._porraDb) return [];
  try {
    const { data, error } = await window._porraDb.rpc('get_user_top_scorers', {
      p_user_id: uid, p_league_id: leagueId, p_limit: 5
    });
    return (error || !data) ? [] : data;
  } catch (_e) { return []; }
}
window._v3SuggestGoldenBoot = _v3SuggestGoldenBoot;

// ─── Polish v1 B4 Items 12+13 — Cerrar porra v3 (sin email) ──
// Equivalente self-contained a finalizarPorra legacy (close-porra.js)
// pero sin dependencias DOM (`finalizar-btn`, etc.). Comprueba grupos+KO+
// awards+boosts en BD, confirma, UPDATE league_members.porra_cerrada, set
// window._porraCerrada, re-render. Email queda fuera (Resend pendiente).
async function v3FinalizarPorra() {
  if (typeof db === 'undefined' || typeof currentUser === 'undefined' || !currentUser) {
    alert('Sesión no activa');
    return;
  }
  var leagueId = (typeof getActiveLeagueId === 'function') ? getActiveLeagueId() : null;
  if (!leagueId) {
    alert('No hay liga activa');
    return;
  }
  if (window._porraCerrada) {
    alert('La porra ya está cerrada.');
    return;
  }

  // Chequeo BD (en paralelo) — mismo criterio que checkFinalizarReady legacy:
  // 72 grupos + 32 KO + 4 awards + boosts de jornada (1 por día de grupos).
  // El gate de boosts (antes ausente en v3 — los cierres saltaban la regla
  // publicada en index.html: "Sin todos los boosts asignados no se puede
  // cerrar la porra") se valida aquí leyendo boost_picks y mapeando cada
  // jornada de grupos con el MISMO calendario que usa el front (PARTIDOS),
  // igual que el cierre legacy en close-porra.js. No basta count>=N: exige 1
  // boost por jornada (evita 2 en un día y 0 en otro).

  // Pre-flight de sincronización: garantiza que boost_picks esté al día
  // antes de validar. loadBoostPicks() ya incorpora la auto-migración
  // one-shot localStorage→DB del PR #139 (commit 4700d2e), así que esto
  // cubre el escenario "usuario que no había recargado la app tras el
  // fix y tiene boosts atrapados en localStorage". Idempotente y silencioso
  // si ya está sincronizado. Si falla, el gate sigue y lo detecta abajo.
  try {
    if (typeof loadBoostPicks === 'function') await loadBoostPicks();
  } catch (e) {
    console.warn('[v3FinalizarPorra] pre-flight loadBoostPicks fallo (sigue):', e && e.message);
  }

  try {
    var responses = await Promise.all([
      db.from('predictions').select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id).eq('league_id', leagueId),
      db.from('ko_predictions').select('*', { count: 'exact', head: true })
        .eq('user_id', currentUser.id).eq('league_id', leagueId),
      db.from('award_picks').select('golden_ball,golden_boot,golden_glove,young_player')
        .eq('user_id', currentUser.id).eq('league_id', leagueId).maybeSingle(),
      db.from('boost_picks').select('match_date, match_id')
        .eq('user_id', currentUser.id).eq('league_id', leagueId)
    ]);
    var gF = responses[0].count || 0;
    var kF = responses[1].count || 0;
    var aD = responses[2].data;
    var aF = (aD && aD.golden_ball && aD.golden_boot && aD.golden_glove && aD.young_player) ? 4 : 0;

    // ── Gate de boosts obligatorios ──
    // Fail-closed si la lectura de boost_picks falla: no cerrar con datos
    // parciales (la premisa "no rectificar después" aplica también aquí).
    if (responses[3].error) {
      console.error('[v3FinalizarPorra] boost_picks read error:', responses[3].error);
      alert('No se pudieron verificar tus boosts. Reintenta en unos segundos.');
      return;
    }
    // Días de grupos que el usuario YA tiene cubiertos con un boost (DB =
    // fuente de verdad). Normalizamos match_date a YYYY-MM-DD por si la
    // columna llega como timestamp.
    var boostedDates = new Set(
      (responses[3].data || [])
        .filter(function (r) { return r && r.match_id; })
        .map(function (r) { return String(r.match_date).substring(0, 10); })
    );
    // Jornadas de grupos = días distintos con partido en PARTIDOS (calendario
    // del front). Solo grupos: PARTIDOS no contiene KO.
    var jornadasGrupos = (typeof PARTIDOS !== 'undefined' && Array.isArray(PARTIDOS))
      ? Array.from(new Set(
          PARTIDOS
            .map(function (m) { return (m && m.date) ? m.date.substring(0, 10) : null; })
            .filter(Boolean)
        ))
      : [];
    var missingBoosts = jornadasGrupos.filter(function (d) { return !boostedDates.has(d); });

    var missing = [];
    if (gF < 72) missing.push((72 - gF) + ' partidos de grupos');
    if (kF < 32) missing.push((32 - kF) + ' partidos de eliminatorias');
    if (aF < 4)  missing.push('premios individuales');

    // Boost gate: bloquea el cierre y lleva al selector si falta algún boost.
    if (missingBoosts.length > 0) {
      var extra = missing.length
        ? '\n\nAdemás falta:\n• ' + missing.join('\n• ')
        : '';
      alert(
        'Debes elegir tus ' + jornadasGrupos.length + ' boosts, 1 por jornada, ' +
        'antes de cerrar tus pronósticos.\n\n' +
        'Te faltan ' + missingBoosts.length + ' boost(s) de jornada por asignar.' + extra
      );
      // Llevar/scroll al selector de boosts (#boost-ticker en #page-jornada).
      try {
        if (typeof showPage === 'function') showPage('jornada');
        setTimeout(function () {
          if (typeof renderBoostTicker === 'function') renderBoostTicker();
          var ticker = document.getElementById('boost-ticker');
          if (ticker && ticker.scrollIntoView) {
            ticker.scrollIntoView({ behavior: 'smooth', block: 'start' });
          }
        }, 150);
      } catch (_navErr) { /* navegación best-effort */ }
      return;
    }

    if (missing.length > 0) {
      alert('Aún no puedes cerrar la porra.\n\nFalta:\n• ' + missing.join('\n• '));
      return;
    }
  } catch (e) {
    console.error('[v3FinalizarPorra] check error:', e);
    alert('Error verificando pronósticos. Reintenta.');
    return;
  }

  if (!confirm(
    '¿Cerrar pronósticos definitivamente?\n\n' +
    'Una vez cerrada la porra no podrás modificar ningún pronóstico.\n\n' +
    'Pulsa Aceptar para confirmar.'
  )) return;

  try {
    var result = await db.from('league_members')
      .update({ porra_cerrada: true, cerrada_at: new Date().toISOString() })
      .eq('user_id', currentUser.id).eq('league_id', leagueId);
    if (result.error) console.warn('[v3FinalizarPorra] update warning:', result.error);
  } catch (e) {
    console.warn('[v3FinalizarPorra] update exception:', e);
  }

  // Marcar cerrada y refrescar UI independiente del resultado del UPDATE.
  window._porraCerrada = true;
  alert('¡Pronósticos cerrados! Mucha suerte 🍀');
  if (typeof v3RenderAll === 'function') v3RenderAll();
}
window.v3FinalizarPorra = v3FinalizarPorra;

// Polish v1 B4: helper de lock state.
// Llamado al inicio de las mutaciones v3 (adjustScore, save goleador, etc.)
// para bloquear edición tras cerrar la porra (manual o cron 10-jun 21:59 UTC).
function v3IsPorraCerrada() {
  return window._porraCerrada === true;
}
window.v3IsPorraCerrada = v3IsPorraCerrada;

function _v3GetRoundMetaForMatch(matchId) {
  if (typeof BRACKET === 'undefined') return null;
  var rounds = [
    { key: 'r32', label: '16avos' },
    { key: 'r16', label: '8vos' },
    { key: 'qf',  label: '4tos' },
    { key: 'sf',  label: 'Semis' },
    { key: 'third', label: '3er puesto' },
    { key: 'final', label: 'Final' }
  ];
  for (var i = 0; i < rounds.length; i++) {
    var arr = BRACKET[rounds[i].key] || [];
    if (arr.find(function (m) { return m.id === matchId; })) return rounds[i];
  }
  return null;
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

  // Polish v1 B4 Items 12+13: bind cerrar porra v3.
  var cerrarBtn = document.querySelector('[data-v3-finalizar]');
  if (cerrarBtn) {
    cerrarBtn.onclick = function (e) {
      e.preventDefault();
      v3FinalizarPorra();
    };
  }

  // HF-BUG-08/BUG-01: listeners delegados en document -- cubren backdrop click Y ESC.
  // _v3ElimGlobalListenersBound (module-scope, nunca reseteado) garantiza registro unico
  // por page-load aunque _v3ElimInited se resetee en la rama gate-locked.
  // F1: jerarquía de cierre — picker goleador KO tiene prioridad sobre el zoom KO.
  if (!_v3ElimGlobalListenersBound) {
    _v3ElimGlobalListenersBound = true;
    document.addEventListener('keydown', function (e) {
      if (e.key !== 'Escape') return;
      if (_v3KOGoleadorPickerMatchId !== null) { v3CloseGoleadorPickerKO(); return; }
      if (v3CurrentMatch) v3CloseZoomKO();
    });
    document.addEventListener('click', function(e) {
      if (!e.target || !e.target.classList) return;
      // Sub-overlay del picker goleador tiene prioridad.
      if (e.target.classList.contains('v3-squad-picker-overlay')) {
        if (_v3KOGoleadorPickerMatchId !== null) v3CloseGoleadorPickerKO();
        return;
      }
      if (e.target.classList.contains('v3-zoom-overlay')) v3CloseZoomKO();
    });
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
