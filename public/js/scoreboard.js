/* scoreboard.js — Porra Mundial 2026
   Usa: PARTIDOS, BRACKET, currentUser, db, window.getActiveLeagueId
   Expone: sbLoad, sbRender
   Deps: auth.js, leagues.js, data.js
*/
// ════════════════════════════════════════════════
// SCOREBOARD — clasificación multi-jugador
// ════════════════════════════════════════════════

let _sbLoaded = false;
let _sbData   = [];

async function sbLoad(forceRefresh = false) {
  // Esperar hasta 3s a que _porraDb esté listo
  let db = window._porraDb;
  if (!db) {
    for (let i = 0; i < 6; i++) {
      await new Promise(r => setTimeout(r, 500));
      db = window._porraDb;
      if (db) break;
    }
  }

  const refreshBtn = document.getElementById('sb-refresh-btn');

  if (!db) {
    if (refreshBtn) refreshBtn.classList.remove('spinning');
    document.getElementById('sb-loading').style.display = 'none';
    const emptyEl = document.getElementById('sb-empty');
    if (emptyEl) {
      emptyEl.style.display = 'block';
      emptyEl.querySelector('.sb-empty-text').textContent = 'Sin conexión a la base de datos. Recarga la página.';
    }
    return;
  }

  if (refreshBtn) refreshBtn.classList.add('spinning');

  document.getElementById('sb-loading').style.display = 'block';
  document.getElementById('sb-podium').style.display  = 'none';
  document.getElementById('sb-table-wrap').style.display = 'none';
  document.getElementById('sb-empty').style.display   = 'none';
  document.getElementById('sb-my-breakdown').style.display = 'none';

  try {
    // PR-1 Capa 2: el cómputo ahora vive en la Edge Function
    // `get-league-standings`. Reemplaza las 4 lecturas de tablas + el cálculo
    // cliente con 1 invocación. La EF aplica el motor _shared/scoring.mjs
    // (parity 1:1 con public/js/scoring.js, validado por tests) y devuelve
    // SOLO totales agregados — los picks ajenos NUNCA llegan al cliente,
    // así que no necesitamos relajar las RLS de predictions/ko_predictions/
    // award_picks. Ver supabase/functions/get-league-standings/index.ts.
    const _sbLeagueId = getActiveLeagueId();
    if (!_sbLeagueId) {
      document.getElementById('sb-loading').style.display = 'none';
      const emptyEl = document.getElementById('sb-empty');
      emptyEl.style.display = 'block';
      emptyEl.querySelector('.sb-empty-text').innerHTML = 'Selecciona una liga para ver la clasificación.';
      if (refreshBtn) refreshBtn.classList.remove('spinning');
      return;
    }

    const { data, error } = await db.functions.invoke('get-league-standings', {
      body: { league_id: _sbLeagueId },
    });
    if (error) throw error;
    if (!data || !Array.isArray(data.rows)) {
      throw new Error('respuesta inválida (sin rows)');
    }

    const rows = data.rows;
    _sbData = rows;
    window._sbData = rows; // exponer para vista jornada
    _sbLoaded = true;
    sbRender(rows);

  } catch (err) {
    console.error('[scoreboard] Error:', err);
    document.getElementById('sb-loading').style.display = 'none';
    document.getElementById('sb-empty').style.display   = 'block';
    document.getElementById('sb-empty').querySelector('.sb-empty-text').textContent =
      'Error cargando clasificación. Intenta de nuevo.';
  } finally {
    const ts = new Date().toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' });
    const el = document.getElementById('sb-last-updated');
    if (el) el.textContent = `Actualizado a las ${ts}`;
    if (refreshBtn) refreshBtn.classList.remove('spinning');
  }
}

// PR-1 Capa 3 — render "Trofeo".
// Helpers locales: avatar color determinista, iniciales, esc HTML, trend.
// (Fusión del cuerpo de scoreboard-v3.render.js entregado por San.)
const _SB_AV = [
  'linear-gradient(135deg,#2851E1,#1A3AAE)',
  'linear-gradient(135deg,#C9A961,#9A7B3A)',
  'linear-gradient(135deg,#3A6E5A,#1F4A3A)',
  'linear-gradient(135deg,#7A4FA8,#4A2E78)',
  'linear-gradient(135deg,#C26A4A,#8A3F28)',
  'linear-gradient(135deg,#4A5163,#2A3142)',
  'linear-gradient(135deg,#2E8AA8,#1A5A70)',
  'linear-gradient(135deg,#A8546E,#702E48)',
];
function _sbAvColor(seed) {
  seed = seed || '?';
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return _SB_AV[h % _SB_AV.length];
}
function _sbInitials(name) {
  const p = (name || '?').trim().split(/\s+/);
  if (p.length === 1) return p[0].slice(0, 2).toUpperCase();
  return (p[0][0] + p[p.length - 1][0]).toUpperCase();
}
function _sbEsc(s) {
  if (typeof escapeHtml === 'function') return escapeHtml(s);
  return String(s == null ? '' : s).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
function _sbTrendInfo(t) {
  if (typeof t !== 'number') return null;
  if (t > 0) return { cls: 'up', sym: '▲', n: t };
  if (t < 0) return { cls: 'down', sym: '▼', n: Math.abs(t) };
  return { cls: 'flat', sym: '—', n: '' };
}

function sbRender(rows) {
  const loading = document.getElementById('sb-loading');
  if (loading) loading.style.display = 'none';

  if (!rows || !rows.length) {
    const empty = document.getElementById('sb-empty');
    if (empty) empty.style.display = 'block';
    return;
  }

  // PR-1 fix lookup: el render Trofeo original leía `window.currentUser`,
  // pero `currentUser` se declara como `let` top-level en auth.js — no se
  // expone a window (ERR-02). Usamos el patrón ya presente en
  // ui-groups-mobile.js:490 y data.js:256: variable global directa con
  // fallback a window por si algún día sí se expone explícitamente.
  const myId = (typeof currentUser !== 'undefined' && currentUser ? currentUser.id : null)
            || (window.currentUser && window.currentUser.id)
            || null;

  // ── HERO PODIO (top-3 con orden visual 2 · 1 · 3) ────────
  const podiumEl = document.getElementById('sb-podium');
  const top3 = rows.slice(0, 3);
  let order, meta, rowCls;
  if (top3.length >= 3) {
    order = [top3[1], top3[0], top3[2]];
    meta = [{ cls: 'tf-pod--2', medal: '2' }, { cls: 'tf-pod--1', medal: '1' }, { cls: 'tf-pod--3', medal: '3' }];
    rowCls = '';
  } else if (top3.length === 2) {
    order = [top3[0], top3[1]];
    meta = [{ cls: 'tf-pod--1', medal: '1' }, { cls: 'tf-pod--2', medal: '2' }];
    rowCls = ' duo';
  } else {
    order = [top3[0]];
    meta = [{ cls: 'tf-pod--1', medal: '1' }];
    rowCls = ' solo';
  }

  const pods = order.map((u, i) => {
    const m = meta[i];
    const tr = _sbTrendInfo(u.trend);
    const first = (u.nombre || '?').split(' ')[0];
    return '' +
      '<div class="tf-pod ' + m.cls + '">' +
        '<div class="tf-pod__medal">' + m.medal + '</div>' +
        '<div class="tf-pod__ring">' +
          (m.cls === 'tf-pod--1' ? '<div class="tf-pod__crown">👑</div>' : '') +
          '<div class="tf-pod__av" style="background:' + _sbAvColor(u.nombre) + '">' + _sbEsc(_sbInitials(u.nombre)) + '</div>' +
        '</div>' +
        '<div class="tf-pod__name">' + _sbEsc(first) + '</div>' +
        '<div class="tf-pod__pts">' + u.total + '<span>pts</span></div>' +
        (tr ? '<div class="tf-pod__trend ' + tr.cls + '">' + tr.sym + (tr.n !== '' ? ' ' + tr.n : ' =') + '</div>' : '') +
      '</div>';
  }).join('');

  podiumEl.innerHTML = '<div class="tf-hero"><div class="tf-hero__spark"></div><div class="tf-pod-row' + rowCls + '">' + pods + '</div></div>';
  podiumEl.style.display = 'block';

  // ── LISTA completa ────────────────────────────────────────
  const rowsEl = document.getElementById('sb-rows');
  rowsEl.innerHTML = rows.map((u, i) => {
    const rank = i + 1;
    const isMe = u.uid === myId;
    const topCls = rank === 1 ? ' top1' : rank === 2 ? ' top2' : rank === 3 ? ' top3' : '';
    const tr = _sbTrendInfo(u.trend);
    let badges = '';
    if (typeof u.boosts === 'number') badges += '<span class="tf-badge">🔥 <b>' + u.boosts + '</b></span>';
    if (typeof u.exa === 'number') badges += '<span class="tf-badge">🎯 <b>' + u.exa + '</b> exactos</span>';
    return '' +
      '<div class="tf-row' + topCls + (isMe ? ' is-me' : '') + '">' +
        '<div class="tf-row__rank">' + rank + '</div>' +
        '<div class="tf-row__l">' +
          '<div class="tf-av" style="background:' + _sbAvColor(u.nombre) + '">' + _sbEsc(_sbInitials(u.nombre)) + '</div>' +
          '<div class="tf-row__info">' +
            '<div class="tf-row__name">' + _sbEsc(u.nombre) + (isMe ? '<span class="tf-tag-me">TÚ</span>' : '') + '</div>' +
            '<div class="tf-row__badges">' + badges + '</div>' +
          '</div>' +
        '</div>' +
        '<div class="tf-row__r">' +
          (tr ? '<div class="tf-row__trend ' + tr.cls + '">' + tr.sym + '<small>' + (tr.n !== '' ? tr.n : '') + '</small></div>' : '') +
          '<div class="tf-row__total">' + u.total + '<span>pts</span></div>' +
        '</div>' +
      '</div>';
  }).join('');
  document.getElementById('sb-table-wrap').style.display = 'block';

  // ── MI DESGLOSE (4 cards: Grupos · Elim. · Premios · Total) ──
  // PR-1 Capa 3: la card "Premios" es TAPPABLE sólo con porra abierta —
  // abre el picker via window.PorraPred._openTrophyModal (re-home del
  // botón trofeo del Predictor). Post-cierre queda display only.
  //
  // Degradación elegante (San validó B): el desglose se pinta SIEMPRE
  // para garantizar que el picker de premios tenga entrada visible
  // aunque el usuario no esté en `rows` (el payload de la EF filtra por
  // hasPreds; un usuario nuevo o sin pronósticos guardados todavía no
  // viaja en filtered). Sin pronósticos los 4 valores se quedan en 0 —
  // display puro, no engañoso.
  const me = (myId && rows.find(r => r.uid === myId))
          || { grpPts: 0, koPts: 0, awPts: 0, total: 0 };
  const porraAbierta = !window._porraCerrada;
  const cards = [
    { lbl: 'Grupos',  val: me.grpPts },
    { lbl: 'Elim.',   val: me.koPts },
    { lbl: 'Premios', val: me.awPts, action: 'open-trophy' },
    { lbl: 'Total',   val: me.total, total: true },
  ];
  document.getElementById('sb-breakdown-cards').innerHTML = cards.map(c => {
    const isClickable = c.action === 'open-trophy' && porraAbierta;
    let cls = 'clz-bd-card';
    if (c.total) cls += ' clz-bd-card--total';
    if (isClickable) cls += ' clz-bd-card--clickable';
    const attrs = isClickable
      ? ` role="button" tabindex="0" data-sb-action="${c.action}" aria-label="Cambiar mis premios individuales"`
      : '';
    return '<div class="' + cls + '"' + attrs + '>' +
             '<div class="clz-bd-card__lbl">' + c.lbl + '</div>' +
             '<div class="clz-bd-card__val">' + c.val + '</div>' +
           '</div>';
  }).join('');
  document.getElementById('sb-my-breakdown').style.display = 'block';

  // Handler delegado idempotente: click / Enter / Space en la card
  // Premios → _openTrophyModal.
  const breakdownEl = document.getElementById('sb-breakdown-cards');
  if (breakdownEl && !breakdownEl._sbBreakdownDelegated) {
    breakdownEl.addEventListener('click', function (ev) {
      const card = ev.target.closest && ev.target.closest('[data-sb-action="open-trophy"]');
      if (!card) return;
      _sbOpenTrophyFromBreakdown();
    });
    breakdownEl.addEventListener('keydown', function (ev) {
      if (ev.key !== 'Enter' && ev.key !== ' ') return;
      const card = ev.target.closest && ev.target.closest('[data-sb-action="open-trophy"]');
      if (!card) return;
      ev.preventDefault();
      _sbOpenTrophyFromBreakdown();
    });
    breakdownEl._sbBreakdownDelegated = true;
  }
}
window.sbRender = sbRender;

// Abre el picker de premios desde la card Premios del desglose. Reusa
// _openTrophyModal expuesto por ui-pred-shell.js en window.PorraPred.
// awPicks es const top-level de scoring.js — accesible en el global scope.
function _sbOpenTrophyFromBreakdown() {
  if (window._porraCerrada) return; // doble guard runtime
  const open = window.PorraPred && window.PorraPred._openTrophyModal;
  if (typeof open !== 'function') {
    console.warn('[scoreboard] _openTrophyModal no disponible aún');
    return;
  }
  // awPicks puede traer {key, name} o el key directo según el flujo previo;
  // _openTrophyModal espera el formato flat con keys/strings.
  const picks = (typeof awPicks === 'object' && awPicks) ? awPicks : {};
  const flat = {
    golden_ball:  (picks.golden_ball  && picks.golden_ball.key)  || picks.golden_ball  || null,
    golden_boot:  (picks.golden_boot  && picks.golden_boot.key)  || picks.golden_boot  || null,
    golden_glove: (picks.golden_glove && picks.golden_glove.key) || picks.golden_glove || null,
    young_player: (picks.young_player && picks.young_player.key) || picks.young_player || null,
  };
  const leagueName = (window.currentLeague && window.currentLeague.nombre) || '';
  open(flat, {
    porraAbierta: !window._porraCerrada,
    league: { name: leagueName },
    onChangeAward: function (awardKey) {
      const modalEl = document.getElementById('modal');
      if (modalEl) modalEl.classList.remove('open');
      if (typeof window.openPicker === 'function') window.openPicker(awardKey);
    },
    onClose: null,
  });
}
