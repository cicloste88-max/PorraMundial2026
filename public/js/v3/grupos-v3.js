// ════════════════════════════════════════════════════════════════
// FASE DE GRUPOS v3 — Porra Mundial 2026
// Portado del prototipo design/v3-prototype/grupos-app.js
// ════════════════════════════════════════════════════════════════

(function() {
  var _v3GruposInited = false;
  var _currentLetter = null;
  var _currentTab = 'predictions';
  var _mountContainer = null;

  // ─── Mapping 3-letras FIFA → slug v3 ─────────────────────────
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

  // ─── Colores por grupo ────────────────────────────────────────
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

  // ─── Pairings round-robin (4 equipos → 6 partidos) ────────────
  var V3_PAIRINGS = [[0,1],[2,3], [0,2],[1,3], [0,3],[1,2]];
  var V3_MATCH_DAY = ['J1','J1','J2','J2','J3','J3'];

  // ─── Helper: URL bandera v3 ──────────────────────────────────
  function flagURL(equipo) {
    var slug = V3_FLAG_SLUG[equipo.flag] || equipo.flag;
    return window.flagPath ? window.flagPath(slug) :
           '/flags/redesign v3/' + encodeURIComponent(slug + '.svg');
  }

  // ─── Helper: obtener equipo por name (español) ───────────────
  function findEquipo(name) {
    if (!window.EQUIPOS) return null;
    return window.EQUIPOS.find(function(e) { return e.name === name; });
  }

  // ─── Helper: obtener 6 partidos reales de un grupo ──────────
  function getGroupMatches(letra) {
    if (!window.PARTIDOS) return [];
    return window.PARTIDOS.filter(function(m) { return m.group === letra; });
  }

  // ─── Helper: verificar si grupo está completo ────────────────
  function isGroupComplete(letra) {
    var pred = predictions[letra];
    if (!pred || !Array.isArray(pred)) return false;
    return pred.length >= 6 &&
           pred.slice(0, 6).every(function(m) {
             return m && typeof m.l === 'number' && typeof m.v === 'number';
           });
  }

  // ─── Helper: contar predicciones rellenas ────────────────────
  function countFilled(letra) {
    var pred = predictions[letra] || [];
    if (!Array.isArray(pred)) return 0;
    return pred.slice(0, 6).filter(function(m) {
      return m && typeof m.l === 'number' && typeof m.v === 'number';
    }).length;
  }

  // ─── Calcular standings de un grupo ──────────────────────────
  function computeStandings(letra) {
    var grupo = window.GRUPOS.find(function(g) { return g.letra === letra; });
    if (!grupo) return [];
    var pred = predictions[letra] || [];
    if (!Array.isArray(pred)) return [];

    var stats = grupo.equipos.map(function(name, i) {
      return {
        teamIdx: i,
        name: name,
        pj: 0, pg: 0, pe: 0, pp: 0,
        gf: 0, gc: 0, gd: 0, pts: 0
      };
    });

    V3_PAIRINGS.forEach(function(pair, idx) {
      if (idx >= 6) return;
      var m = pred[idx];
      if (!m || typeof m.l !== 'number' || typeof m.v !== 'number') return;
      var hi = pair[0], ai = pair[1];
      var h = stats[hi], a = stats[ai];
      h.pj++; a.pj++;
      h.gf += m.l; h.gc += m.v;
      a.gf += m.v; a.gc += m.l;
      if (m.l > m.v)      { h.pts += 3; h.pg++; a.pp++; }
      else if (m.l < m.v) { a.pts += 3; a.pg++; h.pp++; }
      else                { h.pts += 1; a.pts += 1; h.pe++; a.pe++; }
    });

    stats.forEach(function(s) { s.gd = s.gf - s.gc; });
    stats.sort(function(a, b) {
      return b.pts - a.pts || b.gd - a.gd || b.gf - a.gf || a.teamIdx - b.teamIdx;
    });
    return stats;
  }

  // ─── Renderizar board (6 grupos izq + trofeo + 6 grupos der) ──
  function renderBoard() {
    if (!_mountContainer) return;
    var left = _mountContainer.querySelector('.v3-column-left');
    var right = _mountContainer.querySelector('.v3-column-right');
    if (!left || !right) return;
    left.innerHTML = '';
    right.innerHTML = '';

    if (!window.GRUPOS) return;
    window.GRUPOS.forEach(function(g, i) {
      var el = renderGroup(g);
      (i < 6 ? left : right).appendChild(el);
    });
  }

  // ─── Renderizar una tarjeta de grupo ─────────────────────────
  function renderGroup(grupo) {
    var div = document.createElement('div');
    div.className = 'v3-group';
    div.dataset.letter = grupo.letra;
    div.setAttribute('data-letter', grupo.letra);
    var colors = V3_GRUPO_COLORS[grupo.letra] || V3_GRUPO_COLORS.A;
    div.style.setProperty('--g-color', colors.color);
    div.style.setProperty('--g-glow', colors.glow);

    var isComplete = isGroupComplete(grupo.letra);
    if (isComplete) div.classList.add('is-complete', 'has-standings');

    // Pestaña vertical
    var tab = document.createElement('div');
    tab.className = 'v3-group__tab';
    tab.textContent = grupo.letra;
    div.appendChild(tab);

    // Card con 4 equipos
    var card = document.createElement('div');
    card.className = 'v3-group__card';

    if (isComplete) {
      // Mostrar standings (pos + name + flag + pts)
      var standings = computeStandings(grupo.letra);
      standings.forEach(function(row, idx) {
        var teamName = row.name;
        var equipo = findEquipo(teamName);
        var r = document.createElement('div');
        r.className = 'v3-team-row';
        if (idx < 2) r.classList.add('is-qualified');

        var posEl = document.createElement('div');
        posEl.className = 'v3-team-row__pos';
        posEl.textContent = (idx + 1);
        r.appendChild(posEl);

        var codeEl = document.createElement('div');
        codeEl.className = 'v3-team-row__code';
        codeEl.textContent = teamName;
        r.appendChild(codeEl);

        var flagEl = document.createElement('div');
        flagEl.className = 'v3-team-row__flag';
        var img = document.createElement('img');
        img.src = equipo ? flagURL(equipo) : '';
        img.alt = equipo ? equipo.flag : '';
        img.loading = 'lazy';
        img.onerror = function() {
          this.style.display = 'none';
          this.parentNode.classList.add('is-broken');
        };
        flagEl.appendChild(img);
        r.appendChild(flagEl);

        var ptsEl = document.createElement('div');
        ptsEl.className = 'v3-team-row__pts';
        ptsEl.textContent = row.pts;
        r.appendChild(ptsEl);

        card.appendChild(r);
      });
    } else {
      // Mostrar solo code + flag
      grupo.equipos.forEach(function(teamName) {
        var equipo = findEquipo(teamName);
        var r = document.createElement('div');
        r.className = 'v3-team-row';

        var codeEl = document.createElement('div');
        codeEl.className = 'v3-team-row__code';
        codeEl.textContent = teamName;
        r.appendChild(codeEl);

        var flagEl = document.createElement('div');
        flagEl.className = 'v3-team-row__flag';
        var img = document.createElement('img');
        img.src = equipo ? flagURL(equipo) : '';
        img.alt = equipo ? equipo.flag : '';
        img.loading = 'lazy';
        img.onerror = function() {
          this.style.display = 'none';
          this.parentNode.classList.add('is-broken');
        };
        flagEl.appendChild(img);
        r.appendChild(flagEl);

        card.appendChild(r);
      });
    }

    div.appendChild(card);
    div.addEventListener('click', function() { v3OpenZoomGrupos(grupo.letra); });
    return div;
  }

  // ─── Renderizar lista de 6 partidos (con steppers) ─────────────
  function renderMatchesList(letra) {
    var grupo = window.GRUPOS.find(function(g) { return g.letra === letra; });
    if (!grupo) return '';
    var pred = predictions[letra] || [];
    if (!Array.isArray(pred)) pred = [];

    var html = '<div class="v3-matches-list">';
    var lastDay = null;

    V3_PAIRINGS.forEach(function(pair, idx) {
      if (idx >= 6) return;
      var day = V3_MATCH_DAY[idx];
      if (day !== lastDay) {
        html += '<div class="v3-match-day-label">Jornada ' + day.slice(1) + '</div>';
        lastDay = day;
      }

      var homeName = grupo.equipos[pair[0]];
      var awayName = grupo.equipos[pair[1]];
      var homeEq = findEquipo(homeName);
      var awayEq = findEquipo(awayName);
      var m = pred[idx] || {};
      var hasHome = typeof m.l === 'number';
      var hasAway = typeof m.v === 'number';
      var filled = hasHome && hasAway;

      html += '<div class="v3-match-card ' + (filled ? 'is-filled' : '') + '">';
      html += '<div class="v3-match-side v3-match-side--home">';
      html += '<div class="v3-match-side__flag">' +
              '<img src="' + (homeEq ? flagURL(homeEq) : '') + '" ' +
              'alt="' + (homeEq ? homeEq.flag : '') + '" loading="lazy" ' +
              'onerror="this.style.display=\'none\';this.parentNode.classList.add(\'is-broken\')"/>' +
              '</div>';
      html += '<div class="v3-match-side__name">' + homeName + '</div>';
      html += '</div>';

      html += '<div class="v3-match-score">';
      html += '<div class="v3-score-stepper">';
      html += '<button class="v3-score-btn v3--stepper-btn" data-stepper data-idx="' + idx +
              '" data-side="l" data-delta="1" aria-label="+1 ' + homeName + '">▲</button>';
      html += '<div class="v3-score-val ' + (hasHome ? '' : 'is-empty') + '">' +
              (hasHome ? m.l : '–') + '</div>';
      html += '<button class="v3-score-btn v3-stepper-btn" data-stepper data-idx="' + idx +
              '" data-side="l" data-delta="-1" aria-label="-1 ' + homeName + '">▼</button>';
      html += '</div>';

      html += '<div class="v3-score-sep">:</div>';

      html += '<div class="v3-score-stepper">';
      html += '<button class="v3-score-btn v3-stepper-btn" data-stepper data-idx="' + idx +
              '" data-side="v" data-delta="1" aria-label="+1 ' + awayName + '">▲</button>';
      html += '<div class="v3-score-val ' + (hasAway ? '' : 'is-empty') + '">' +
              (hasAway ? m.v : '–') + '</div>';
      html += '<button class="v3-score-btn v3-stepper-btn" data-stepper data-idx="' + idx +
              '" data-side="v" data-delta="-1" aria-label="-1 ' + awayName + '">▼</button>';
      html += '</div>';
      html += '</div>';

      html += '<div class="v3-match-side v3-match-side--away">';
      html += '<div class="v3-match-side__flag">' +
              '<img src="' + (awayEq ? flagURL(awayEq) : '') + '" ' +
              'alt="' + (awayEq ? awayEq.flag : '') + '" loading="lazy" ' +
              'onerror="this.style.display=\'none\';this.parentNode.classList.add(\'is-broken\')"/>' +
              '</div>';
      html += '<div class="v3-match-side__name">' + awayName + '</div>';
      html += '</div>';
      html += '</div>';
    });

    html += '</div>';
    return html;
  }

  // ─── Renderizar tabla de standings ────────────────────────────
  function renderStandingsTable(letra) {
    var standings = computeStandings(letra);
    var html = '<div class="v3-standings-table">';
    html += '<div class="v3-standings-head">';
    html += '<div class="v3-st-pos">#</div>';
    html += '<div>Selección</div>';
    html += '<div class="v3-st-num" title="Partidos jugados">PJ</div>';
    html += '<div class="v3-st-num" title="Goles a favor">GF</div>';
    html += '<div class="v3-st-num" title="Goles en contra">GC</div>';
    html += '<div class="v3-st-num" title="Diferencia de goles">DG</div>';
    html += '<div class="v3-st-pts" title="Puntos">PTS</div>';
    html += '</div>';

    standings.forEach(function(row, idx) {
      var teamName = row.name;
      var equipo = findEquipo(teamName);
      html += '<div class="v3-standings-row ' + (idx < 2 ? 'is-qualified' : '') + '">';
      html += '<div class="v3-st-pos">' + (idx + 1) + '</div>';
      html += '<div class="v3-st-team">';
      html += '<div class="v3-st-flag">' +
              '<img src="' + (equipo ? flagURL(equipo) : '') + '" ' +
              'alt="' + (equipo ? equipo.flag : '') + '"/>' +
              '</div>';
      html += '<div class="v3-st-name">' + teamName + '</div>';
      html += '</div>';
      html += '<div class="v3-st-num">' + row.pj + '</div>';
      html += '<div class="v3-st-num">' + row.gf + '</div>';
      html += '<div class="v3-st-num">' + row.gc + '</div>';
      html += '<div class="v3-st-num">' + (row.gd > 0 ? '+' + row.gd : row.gd) + '</div>';
      html += '<div class="v3-st-pts">' + row.pts + '</div>';
      html += '</div>';
    });

    html += '</div>';
    return html;
  }

  // ─── Renderizar zoom overlay (predicciones / clasificación) ────
  function renderZoom() {
    var grupo = window.GRUPOS.find(function(g) { return g.letra === _currentLetter; });
    if (!grupo) return;

    var inner = document.querySelector('.v3-zoom-panel__inner');
    if (!inner) return;

    var colors = V3_GRUPO_COLORS[_currentLetter] || V3_GRUPO_COLORS.A;
    inner.style.setProperty('--zoom-color', colors.color);
    inner.style.setProperty('--zoom-glow', colors.glow);

    var filled = countFilled(grupo.letra);
    var total = 6;
    var isDone = filled === total;

    var html = '<div class="v3-zoom-header">';
    html += '<div class="v3-zoom-header__letter">' + grupo.letra + '</div>';
    html += '<div class="v3-zoom-header__title">';
    html += '<div class="v3-zoom-header__eyebrow">Grupo ' + grupo.letra + ' · Fase de Grupos</div>';
    html += '<h2 class="v3-zoom-header__name">Pronostica el Grupo ' + grupo.letra + '</h2>';
    html += '</div>';
    html += '<button class="v3-zoom-close" aria-label="Cerrar (ESC)" data-close>✕</button>';
    html += '</div>';

    html += '<div class="v3-zoom-body">';
    html += '<div class="v3-zoom-tabs">';
    html += '<button class="v3-zoom-tab ' + (_currentTab === 'predictions' ? 'is-active' : '') +
            '" data-tab="predictions">Pronósticos</button>';
    html += '<button class="v3-zoom-tab ' + (_currentTab === 'standings' ? 'is-active' : '') +
            '" data-tab="standings" ' + (isDone ? '' : 'disabled') + '>';
    html += 'Clasificación ' + (isDone ? '' : '(' + filled + '/' + total + ')');
    html += '</button>';
    html += '</div>';

    html += '<div data-view="predictions" ' + (_currentTab === 'predictions' ? '' : 'hidden') + '>';
    html += renderMatchesList(grupo.letra);
    html += '<div class="v3-zoom-footer">';
    html += '<div class="v3-zoom-progress">';
    html += '<div class="v3-zoom-progress__label">' + filled + ' de ' + total + ' marcadores</div>';
    html += '<div class="v3-zoom-progress__bar"><div class="v3-zoom-progress__fill" ' +
            'style="width:' + (filled / total * 100) + '%"></div></div>';
    html += '</div>';
    html += '<button class="v3-zoom-cta" data-show-standings ' + (isDone ? '' : 'disabled') + '>';
    html += isDone ? 'Clasificación →' : ('Falta' + (total - filled === 1 ? '' : 'n') + ' ' + (total - filled));
    html += '</button>';
    html += '</div>';
    html += '</div>';

    html += '<div data-view="standings" ' + (_currentTab === 'standings' ? '' : 'hidden') + '>';
    html += renderStandingsTable(grupo.letra);
    html += '<div class="v3-qualif-legend">Top 2 clasifican a la fase eliminatoria</div>';
    html += '<div class="v3-zoom-footer">';
    html += '<div class="v3-zoom-progress">';
    html += '<div class="v3-zoom-progress__label">Pronósticos guardados</div>';
    html += '<div class="v3-zoom-progress__bar"><div class="v3-zoom-progress__fill" ' +
            'style="width:100%"></div></div>';
    html += '</div>';
    html += '<button class="v3-zoom-cta" data-show-predictions>Editar</button>';
    html += '</div>';
    html += '</div>';

    inner.innerHTML = html;

    // Event bindings
    inner.querySelector('[data-close]').onclick = function() { v3CloseZoomGrupos(); };
    inner.querySelectorAll('[data-tab]').forEach(function(btn) {
      btn.onclick = function() {
        if (btn.disabled) return;
        _currentTab = btn.dataset.tab;
        renderZoom();
      };
    });

    var showSt = inner.querySelector('[data-show-standings]');
    if (showSt) {
      showSt.onclick = function() {
        _currentTab = 'standings';
        renderZoom();
      };
    }

    var showPr = inner.querySelector('[data-show-predictions]');
    if (showPr) {
      showPr.onclick = function() {
        _currentTab = 'predictions';
        renderZoom();
      };
    }

    inner.querySelectorAll('[data-stepper]').forEach(function(btn) {
      btn.onclick = function(e) {
        e.stopPropagation();
        v3AdjustScore(grupo.letra, +btn.dataset.idx, btn.dataset.side, +btn.dataset.delta);
      };
    });
  }

  // ─── Ajustar score (▲/▼) ────────────────────────────────────
  function v3AdjustScore(letra, matchIdx, side, delta) {
    if (!predictions[letra]) predictions[letra] = [];
    var p = predictions[letra];
    if (!p[matchIdx]) p[matchIdx] = {};

    var cur = typeof p[matchIdx][side] === 'number' ? p[matchIdx][side] : 0;
    p[matchIdx][side] = Math.max(0, Math.min(15, cur + delta));

    var other = side === 'l' ? 'v' : 'l';
    if (typeof p[matchIdx][other] !== 'number') p[matchIdx][other] = 0;

    p[matchIdx].saved = true;
    if (window.savePredictions) window.savePredictions();
    renderZoom();
  }

  // ─── Abrir zoom ──────────────────────────────────────────────
  function v3OpenZoomGrupos(letra) {
    _currentLetter = letra;
    var grupo = window.GRUPOS.find(function(g) { return g.letra === letra; });
    if (!grupo) return;
    _currentTab = isGroupComplete(letra) ? 'standings' : 'predictions';
    renderZoom();

    var overlay = document.querySelector('.v3-zoom-overlay');
    if (overlay) {
      overlay.classList.add('is-open');
      document.body.style.overflow = 'hidden';
    }
  }

  // ─── Cerrar zoom ─────────────────────────────────────────────
  function v3CloseZoomGrupos() {
    var overlay = document.querySelector('.v3-zoom-overlay');
    if (overlay) {
      overlay.classList.remove('is-open');
      document.body.style.overflow = '';
    }
    _currentLetter = null;
    renderBoard();
  }

  // ─── Helper: Simular (llama función global) ──────────────────
  function v3SimulateAll() {
    if (!confirm('¿Simular aleatoriamente los 72 partidos?')) return;
    if (window.diceSimulateAllGroups) {
      window.diceSimulateAllGroups();
    }
    renderBoard();
  }

  // ─── Helper: Borrar todos los pronósticos ────────────────────
  function v3ResetAll() {
    if (!confirm('¿Borrar todos los pronósticos guardados?')) return;
    predictions = {};
    if (window.savePredictions) window.savePredictions();
    renderBoard();
  }

  // ─── Mount principal (idempotente) ────────────────────────────
  window.v3GruposMount = function() {
    var pageGrupos = document.getElementById('page-grupos');
    if (!pageGrupos) return;

    // Crear contenedor si no existe
    if (!_mountContainer) {
      var existing = pageGrupos.querySelector('#v3-grupos-mount');
      if (existing) {
        _mountContainer = existing;
      } else {
        _mountContainer = document.createElement('div');
        _mountContainer.id = 'v3-grupos-mount';
        pageGrupos.appendChild(_mountContainer);
      }
    }

    // Inyectar HTML estructura si es primera vez
    if (!_v3GruposInited) {
      _mountContainer.innerHTML =
        '<div class="v3-board">' +
        '<div class="v3-column v3-column-left"></div>' +
        '<div class="v3-trophy-col">' +
        '<img class="v3-trophy" src="' + (window.WORLD_CUP_LOGO || '') + '" alt="Trophy" loading="lazy">' +
        '<div class="v3-trophy-fallback">🏆</div>' +
        '</div>' +
        '<div class="v3-column v3-column-right"></div>' +
        '</div>' +
        '<div class="v3-actions">' +
        '<button class="v3-btn" data-v3-grupos-dice>🎲 Simular</button>' +
        '<button class="v3-btn v3-btn--danger" data-v3-grupos-reset>Borrar pronósticos</button>' +
        '</div>' +
        '<p class="v3-hint">Toca un grupo para pronosticar sus 6 partidos · ESC para cerrar</p>';

      // Bind button events
      var diceBtn = _mountContainer.querySelector('[data-v3-grupos-dice]');
      if (diceBtn) {
        diceBtn.onclick = v3SimulateAll;
      }
      var resetBtn = _mountContainer.querySelector('[data-v3-grupos-reset]');
      if (resetBtn) {
        resetBtn.onclick = v3ResetAll;
      }

      // Crear zoom overlay en body si no existe
      if (!document.querySelector('.v3-zoom-overlay')) {
        var overlay = document.createElement('div');
        overlay.className = 'v3-zoom-overlay';
        var panel = document.createElement('div');
        panel.className = 'v3-zoom-panel';
        var inner = document.createElement('div');
        inner.className = 'v3-zoom-panel__inner';
        panel.appendChild(inner);
        document.body.appendChild(overlay);
        document.body.appendChild(panel);

        // Eventos ESC y backdrop
        document.addEventListener('keydown', function(e) {
          if (e.key === 'Escape' && _currentLetter) v3CloseZoomGrupos();
        });
        overlay.addEventListener('click', function() {
          if (_currentLetter) v3CloseZoomGrupos();
        });

        // Trophy fallback
        var trophyImg = _mountContainer.querySelector('.v3-trophy');
        if (trophyImg) {
          trophyImg.addEventListener('error', function() {
            var col = this.closest('.v3-trophy-col');
            if (col) col.classList.add('is-fallback');
          }, { once: true });
        }
      }

      _v3GruposInited = true;
    }

    // Renderizar board (siempre, para re-render tras cambios)
    renderBoard();
  };

  // Export también para acceso externo si es necesario
  window.v3OpenZoomGrupos = v3OpenZoomGrupos;
  window.v3CloseZoomGrupos = v3CloseZoomGrupos;
  window.v3AdjustScore = v3AdjustScore;
})();
