// ui-groups.js - Porra Mundial 2026 / sub-bloque js-ui-groups
// UI de fase de grupos: savePredictions, checkGroupsComplete, finalizarPorra,
// renderMatchCard, openModal, updateCardUI, renderGroupTableCard, refreshGroupTables.
// Deps: data.js, scoring.js, auth.js, leagues.js

// ========== INICIALIZACIÓN ==========
  // ─────────────────────────────────────────────────────────────
  /*
     js-ui-groups — UI tarjetas grupos, modal, predicciones
     Archivo destino : ui-groups.js
     -----------------------------------------------------------
     Usa             : PARTIDOS, EQUIPOS, predictions, db, currentUser
     Expone          : renderMatchCard, updateCardUI, openModal, savePredictions, renderGroupTableCard, refreshGroupTables
     Deps            : js-data, js-auth, js-ligas
     Notas           : Bloque mas grande. Toda la UI de fase de grupos.
================================================================ */
// GUARDAR PREDICCIONES DE GRUPOS — savePredictions,
  //   checkGroupsComplete, finalizarPorra (inicio del bloque cerrar)
  // ─────────────────────────────────────────────────────────────
function savePredictions() {
  try { localStorage.setItem('porra_predictions', JSON.stringify(predictions)); } catch(e) {}
  // Sincronizar con Supabase si hay sesión activa
  if (currentUser) {
    if (window._porraCerrada) return; // porra cerrada — no escribir en DB
    const leagueId = getActiveLeagueId();
    if (!leagueId) return; // sin liga activa no se guarda
    const rows = Object.entries(predictions)
      .filter(([, p]) => p && p.saved)
      .map(([match_id, p]) => ({
        user_id:   currentUser.id,
        league_id: leagueId,
        match_id,
        local:     p.l,
        visitante: p.v,
        scorer:    p.gol || null
      }));
    if (rows.length > 0) {
      db.from('predictions').upsert(rows, { onConflict: 'league_id,user_id,match_id' })
        .then(({ error }) => {
          if (error) console.warn('Error guardando predictions:', error.message);
          // Llamar checkFinalizarReady tras confirmar guardado en DB
          checkFinalizarReady();
        });
      return; // checkFinalizarReady se llama en el .then
    }
  }
}

function checkGroupsComplete() {
  savePredictions(); // persistir siempre al verificar
  let filled = 0;
  PARTIDOS.forEach(m => {
    const p = predictions[getMatchKey(m)];
    if(p && p.saved) filled++;
  });
  const total = PARTIDOS.length; // 72
  const pct = Math.round(filled / total * 100);

  // Header button
  const btn = document.getElementById('btn-go-eliminatorias');
  const icon = document.getElementById('btn-elim-icon');
  const text = document.getElementById('btn-elim-text');
  const count = document.getElementById('btn-elim-count');
  if(btn) {
    count.textContent = filled+'/'+total;
    if(filled >= total) {
      btn.disabled = false;
      btn.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#4ade80;padding:6px 14px;border-radius:10px;border:1px solid #166534;background:#052e16;cursor:pointer;transition:all .3s;opacity:1;font-family:Inter,sans-serif;box-shadow:0 0 16px rgba(74,222,128,.2)';
      icon.textContent = '⚽';
      text.textContent = 'Ver Eliminatorias';
      count.style.display = 'none';
    } else {
      btn.disabled = true;
      btn.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#4b5563;padding:6px 14px;border-radius:10px;border:1px solid #27272a;background:#1c1c1e;cursor:not-allowed;transition:all .3s;opacity:.6;font-family:Inter,sans-serif';
      icon.textContent = '🔒';
      text.textContent = 'Eliminatorias';
      count.style.display = 'inline';
    }
  }

  // CTA banner
  const ctaLocked = document.getElementById('cta-locked-msg');
  const ctaReady  = document.getElementById('cta-ready-msg');
  const ctaFilled = document.getElementById('cta-filled');
  if(ctaFilled) ctaFilled.textContent = filled;

  // Group dots
  const dotsEl = document.getElementById('cta-groups-dots');
  if(dotsEl) {
    dotsEl.innerHTML = '';
    GRUPOS.forEach(g => {
      const gFilled = PARTIDOS.filter(m => m.group===g.letra && predictions[getMatchKey(m)]?.saved).length;
      const dot = document.createElement('div');
      dot.title = 'Grupo '+g.letra+' ('+gFilled+'/6)';
      dot.style.cssText = 'width:20px;height:20px;border-radius:50%;display:flex;align-items:center;justify-content:center;font-size:9px;font-weight:900;transition:all .3s;';
      if(gFilled >= 6) {
        dot.style.background = '#052e16';
        dot.style.border = '1.5px solid #166534';
        dot.style.color = '#4ade80';
        dot.textContent = g.letra;
      } else if(gFilled > 0) {
        dot.style.background = '#1c1003';
        dot.style.border = '1.5px solid #d97706';
        dot.style.color = '#fb923c';
        dot.textContent = g.letra;
      } else {
        dot.style.background = '#1c1c1e';
        dot.style.border = '1.5px solid #3a3a3e';
        dot.style.color = '#6b7280';
        dot.textContent = g.letra;
      }
      dotsEl.appendChild(dot);
    });
  }

  if(ctaLocked && ctaReady) {
    if(filled >= total) {
      ctaLocked.style.display = 'none';
      ctaReady.style.display = 'block';
    } else {
      ctaLocked.style.display = 'block';
      ctaReady.style.display = 'none';
    }
  }
}


function initGrupos() {
  // Mostrar barra global de dados si usuario logueado
  const diceBar = document.getElementById('dice-global-bar');
  if(diceBar && currentUser && !window._porraCerrada) diceBar.style.display = 'flex';
  window.scrollTo(0,0);
  renderAll(() => {
    // Cuando todos los grupos están en DOM, re-renderizar tablas con datos en memoria
    if (typeof refreshGroupTables === 'function') refreshGroupTables();
  });
  checkGroupsComplete();
  // Actualizar countdown cada 5s (no cada 1s — mejora rendimiento scroll)
  // Solo actualiza los pills de estado, no re-renderiza todo
  setInterval(() => {
    PARTIDOS.forEach((match, idx) => {
      const pill = document.getElementById('spill-'+idx);
      const stxt = document.getElementById('stxt-'+idx);
      if(!pill || !stxt) return;
      const estado = getEstadoPartido(match);
      if(estado==='open'){
        pill.className='status-pill open';
        const ms=new Date(match.date)-4*24*3600*1000-new Date();
        stxt.textContent='Abierta · '+fmtMs(ms);
      } else if(estado==='closing'){
        pill.className='status-pill closing';
        const ms=new Date(match.date)-2*24*3600*1000-new Date();
        stxt.textContent='¡Cierra en '+fmtMs(ms)+'!';
      } else if(estado==='live'){
        pill.className='status-pill live';
        const min=Math.min(Math.floor((new Date()-new Date(match.date))/60000),90);
        stxt.textContent='EN VIVO '+min+"'";
      }
      // closed y done no cambian — no actualizar
    });
    updateGlobalPoints();
    checkGroupsComplete(); // habilitar botón eliminatorias
  }, 1000);

}


