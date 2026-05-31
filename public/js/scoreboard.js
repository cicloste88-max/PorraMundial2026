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

function sbRender(rows) {
  document.getElementById('sb-loading').style.display = 'none';

  if (!rows.length) {
    document.getElementById('sb-empty').style.display = 'block';
    return;
  }

  const maxPts  = rows[0]?.total || 0;
  const myId    = currentUser?.id;

  // ── Podio top 3 ──
  const podiumEl = document.getElementById('sb-podium');
  const top3 = rows.slice(0, 3);
  const medals = ['🥇','🥈','🥉'];
  const rankCls = ['rank-1','rank-2','rank-3'];
  const crowns  = ['👑','',''];

  // Reordenar: 2º · 1º · 3º para el podio visual
  const podiumOrder = top3.length >= 3
    ? [top3[1], top3[0], top3[2]]
    : top3.length === 2 ? [top3[1], top3[0]] : [top3[0]];
  const podiumRanks = top3.length >= 3 ? [1, 0, 2] : top3.length === 2 ? [1, 0] : [0];

  podiumEl.innerHTML = podiumOrder.map((u, i) => {
    const realRank = podiumRanks[i];
    const ini = (u.nombre || '?').charAt(0).toUpperCase();
    return `<div class="sb-podium-card ${rankCls[realRank]}">
      ${crowns[realRank] ? `<div class="sb-podium-crown">${crowns[realRank]}</div>` : ''}
      <div class="sb-podium-rank">${medals[realRank]}</div>
      <div class="sb-podium-avatar">${ini}</div>
      <div class="sb-podium-name">${escapeHtml(u.nombre)}</div>
      <div class="sb-podium-pts">${u.total}<span>pts</span></div>
    </div>`;
  }).join('');
  podiumEl.style.display = 'grid';

  // ── Tabla completa ──
  const rowsEl = document.getElementById('sb-rows');
  rowsEl.innerHTML = rows.map((u, i) => {
    const rank   = i + 1;
    const isMe   = u.uid === myId;
    const ini    = (u.nombre || '?').charAt(0).toUpperCase();
    const rankCl = rank === 1 ? 'top1' : rank === 2 ? 'top2' : rank === 3 ? 'top3' : '';
    const ptsCl  = u.total === maxPts ? 'pts-total best' : 'pts-total';
    return `<div class="sb-row${isMe ? ' is-me' : ''}">
      <div class="sb-rank-badge ${rankCl}">${rank}</div>
      <div class="sb-row-user">
        <div class="sb-row-avatar">${ini}</div>
        <div>
          <div class="sb-row-name">${escapeHtml(u.nombre)}${isMe ? ' <span style="font-size:9px;color:#3b82f6;font-weight:700">TÚ</span>' : ''}</div>
        </div>
      </div>
      <div class="sb-cell">${u.grpPts}</div>
      <div class="sb-cell">${u.koPts}</div>
      <div class="sb-cell">${u.awPts}</div>
      <div class="sb-cell ${ptsCl}">${u.total}</div>
    </div>`;
  }).join('');
  document.getElementById('sb-table-wrap').style.display = 'block';

  // ── Mi desglose ──
  if (myId) {
    const me = rows.find(r => r.uid === myId);
    if (me) {
      // PR-1 Capa 3: re-home del picker de premios desde el botón trofeo
      // del Predictor (que ahora abre page-score). La tarjeta "Premios" es
      // tappable SOLO con porra abierta — post-cierre queda display only.
      const porraAbierta = !window._porraCerrada;
      const cards = [
        { label: 'Grupos',        val: me.grpPts, sub: 'pts de fase de grupos' },
        { label: 'Eliminatorias', val: me.koPts,  sub: 'pts KO + avance' },
        { label: 'Premios',       val: me.awPts,  sub: 'awards individuales', action: 'open-trophy' },
        { label: 'Total',         val: me.total,  sub: 'puntos acumulados' },
      ];
      document.getElementById('sb-breakdown-cards').innerHTML = cards.map(c => {
        const isClickable = c.action === 'open-trophy' && porraAbierta;
        const cls = 'sb-breakdown-card' + (isClickable ? ' sb-breakdown-card--clickable' : '');
        const attrs = isClickable
          ? ` role="button" tabindex="0" data-sb-action="${c.action}" aria-label="Cambiar mis premios individuales"`
          : '';
        return `<div class="${cls}"${attrs}>
          <div class="sb-breakdown-label">${c.label}</div>
          <div class="sb-breakdown-val">${c.val}</div>
          <div class="sb-breakdown-sub">${c.sub}</div>
        </div>`;
      }).join('');
      document.getElementById('sb-my-breakdown').style.display = 'block';

      // Handler delegado idempotente: click/Enter/Space en la card Premios
      // abre el _openTrophyModal expuesto por PorraPred (ui-pred-shell.js).
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
  }
}

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
