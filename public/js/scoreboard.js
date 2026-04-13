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
    // 1. Todos los profiles
    const { data: profiles, error: pe } = await db.from('profiles').select('id,nombre');
    if (pe) throw pe;

    // 2. Predictions filtradas por liga activa
    const _sbLeagueId = getActiveLeagueId();
    if (!_sbLeagueId) {
      document.getElementById('sb-loading').style.display = 'none';
      const emptyEl = document.getElementById('sb-empty');
      emptyEl.style.display = 'block';
      emptyEl.querySelector('.sb-empty-text').innerHTML = 'Selecciona una liga para ver la clasificación.';
      if (refreshBtn) refreshBtn.classList.remove('spinning');
      return;
    }
    const { data: preds, error: pre } = await db.from('predictions').select('*').eq('league_id', _sbLeagueId);
    if (pre) throw pre;

    // 3. Ko_predictions filtradas por liga activa
    const { data: koPreds, error: koe } = await db.from('ko_predictions').select('*').eq('league_id', _sbLeagueId);
    if (koe) throw koe;

    // 4. Award_picks filtrados por liga activa
    const { data: awards, error: ae } = await db.from('award_picks').select('*').eq('league_id', _sbLeagueId);
    if (ae) throw ae;

    // Guardia RLS: si profiles viene vacío, avisar con mensaje claro
    if (!profiles || profiles.length === 0) {
      document.getElementById('sb-loading').style.display = 'none';
      const emptyEl = document.getElementById('sb-empty');
      emptyEl.style.display = 'block';
      emptyEl.querySelector('.sb-empty-text').innerHTML =
        'Sin acceso a datos de participantes.<br>' +
        '<span style="font-size:11px;color:#374151;margin-top:6px;display:block">' +
        'Ejecuta las políticas RLS públicas en Supabase para el scoreboard.</span>';
      if (refreshBtn) refreshBtn.classList.remove('spinning');
      return;
    }

    // 5. Resultados reales (si existe la tabla)
    let realMatchResults   = null;
    let realKoResults      = null;
    let realAwardWinners   = null;
    let realClassification = null;
    try {
      const { data: res } = await db.from('results').select('*').single();
      if (res) {
        realMatchResults   = res.match_results   ? JSON.parse(res.match_results)   : null;
        realKoResults      = res.ko_results       ? JSON.parse(res.ko_results)       : null;
        realAwardWinners   = res.award_winners    ? JSON.parse(res.award_winners)    : null;
        realClassification = res.classification   ? JSON.parse(res.classification)   : null;
      }
    } catch(_) { /* tabla results aún no existe o vacía — modo simulación */ }

    // 6. Agrupar datos por usuario
    const predsByUser  = {};
    const koPredsByUser = {};
    const awardsByUser = {};

    preds.forEach(p => {
      if (!predsByUser[p.user_id]) predsByUser[p.user_id] = {};
      // Reconstruir clave match_id → { l, v, gol, saved }
      // La clave en memoria es "GROUP_home_away"; en DB está como match_id string
      predsByUser[p.user_id][p.match_id] = { l: p.local, v: p.visitante, gol: p.scorer, saved: true };
    });

    koPreds.forEach(p => {
      if (!koPredsByUser[p.user_id]) koPredsByUser[p.user_id] = {};
      koPredsByUser[p.user_id][p.match_id] = { l: p.local, v: p.visitante, gol: p.scorer, classifier: p.classifier, saved: true };
    });

    awards.forEach(a => { awardsByUser[a.user_id] = a; });

    // 7. Calcular puntos por usuario
    const rows = profiles.map(profile => {
      const uid        = profile.id;
      const userPreds  = predsByUser[uid]  || {};
      const userKoPreds= koPredsByUser[uid] || {};
      const userAwards = awardsByUser[uid]  || null;

      // --- Puntos grupos ---
      let grpPts = 0;
      PARTIDOS.forEach(m => {
        const key  = getMatchKey(m);
        const pred = userPreds[key];
        const real = realMatchResults?.[key];
        if (pred && real) grpPts += calcMatchPoints(pred, real.l, real.v, key);
      });

      // --- Puntos KO ---
      let koPts = 0;
      const KO_ROUNDS_SB = [
        { matches: BRACKET.r32,   round: 'r32' },
        { matches: BRACKET.r16,   round: 'r16' },
        { matches: BRACKET.qf,    round: 'qf'  },
        { matches: BRACKET.sf,    round: 'sf'  },
        { matches: BRACKET.third, round: 'third'},
        { matches: BRACKET.final, round: 'final'},
      ];
      KO_ROUNDS_SB.forEach(({ matches, round }) => {
        matches.forEach(m => {
          const pred = userKoPreds[m.id] || userKoPreds[String(m.id)];
          const real = realKoResults?.[m.id];
          if (pred && real) koPts += calcKOMatchPoints(pred, real.l, real.v, round);
        });
      });

      // --- Premios awards ---
      let awPts = 0;
      if (userAwards && realAwardWinners) {
        awPts = calcAwardPoints(
          { golden_ball: userAwards.golden_ball, golden_boot: userAwards.golden_boot,
            golden_glove: userAwards.golden_glove, young_player: userAwards.young_player },
          realAwardWinners
        );
      }

      const total = grpPts + koPts + awPts;
      const hasPreds = Object.keys(userPreds).length > 0 || Object.keys(userKoPreds).length > 0;

      return { uid, nombre: profile.nombre || '—', grpPts, koPts, awPts, total, hasPreds };
    })
    .filter(r => r.hasPreds)
    .sort((a, b) => b.total - a.total || b.grpPts - a.grpPts);

    _sbData = rows;
    window._sbData = rows; // exponer para vista jornada
    _sbLoaded = true;
    sbRender(rows, realMatchResults);

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

function sbRender(rows, realMatchResults) {
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
      const cards = [
        { label: 'Grupos', val: me.grpPts, sub: 'pts de fase de grupos' },
        { label: 'Eliminatorias', val: me.koPts, sub: 'pts KO + avance' },
        { label: 'Premios', val: me.awPts, sub: 'awards individuales' },
        { label: 'Total', val: me.total, sub: 'puntos acumulados' },
      ];
      document.getElementById('sb-breakdown-cards').innerHTML = cards.map(c =>
        `<div class="sb-breakdown-card">
          <div class="sb-breakdown-label">${c.label}</div>
          <div class="sb-breakdown-val">${c.val}</div>
          <div class="sb-breakdown-sub">${c.sub}</div>
        </div>`
      ).join('');
      document.getElementById('sb-my-breakdown').style.display = 'block';
    }
  }
}
