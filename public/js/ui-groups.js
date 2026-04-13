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
  // Verificar boosts: todas las jornadas deben tener boost asignado
  const diasConPartidos = [...new Set(PARTIDOS.map(m => m.date?.substring(0,10)).filter(Boolean))];
  const boostsCompletos = diasConPartidos.every(d => boostPicks[d]);

  if(btn) {
    count.textContent = filled+'/'+total;
    if(filled >= total && boostsCompletos) {
      btn.disabled = false;
      btn.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;font-weight:700;color:#4ade80;padding:6px 14px;border-radius:10px;border:1px solid #166534;background:#052e16;cursor:pointer;transition:all .3s;opacity:1;font-family:Inter,sans-serif;box-shadow:0 0 16px rgba(74,222,128,.2)';
      icon.textContent = '⚽';
      text.textContent = 'Ver Eliminatorias';
      count.style.display = 'none';
    } else {
      btn.disabled = true;
      btn.style.cssText = 'display:flex;align-items:center;gap:6px;font-size:12px;font-weight:600;color:#4b5563;padding:6px 14px;border-radius:10px;border:1px solid #27272a;background:#1c1c1e;cursor:not-allowed;transition:all .3s;opacity:.6;font-family:Inter,sans-serif';
      icon.textContent = '🔒';
      if(filled >= total && !boostsCompletos) {
        const pendientes = diasConPartidos.filter(d => !boostPicks[d]).length;
        text.textContent = 'Boost: faltan ' + pendientes + ' jornada' + (pendientes > 1 ? 's' : '');
        count.style.display = 'none';
      } else {
        text.textContent = 'Eliminatorias';
        count.style.display = 'inline';
      }
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
    if(filled >= total && boostsCompletos) {
      ctaLocked.style.display = 'none';
      ctaReady.style.display = 'block';
    } else {
      ctaLocked.style.display = 'block';
      ctaReady.style.display = 'none';

      // Pastillas boost pendientes bajo el CTA locked
      const boostPendingEl = document.getElementById('cta-boost-pending');
      if(boostPendingEl && filled >= total) {
        const pendientes = diasConPartidos.filter(d => !boostPicks[d]);
        if(pendientes.length > 0) {
          boostPendingEl.style.display = 'flex';
          boostPendingEl.innerHTML =
            '<span style="font-size:11px;font-weight:700;color:#fb923c;white-space:nowrap;flex-shrink:0">🔥 Boosts pendientes:</span>' +
            pendientes.map(d => {
              const dayLabel = new Date(d + 'T12:00:00').toLocaleDateString('es-ES', {day:'numeric', month:'short'});
              const nM = PARTIDOS.filter(m => m.date?.substring(0,10) === d).length;
              return '<button onclick="tickerExpandJornada(\'' + d + '\')" style="' +
                'display:inline-flex;align-items:center;gap:4px;' +
                'padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;' +
                'border:1.5px solid rgba(234,88,12,.5);' +
                'background:rgba(124,45,18,.35);color:rgb(251,146,60);' +
                'cursor:pointer;white-space:nowrap;' +
                'animation:boostPulse 1.5s ease-in-out infinite;' +
                '">🔥 ' + dayLabel + ' · ' + nM + ' partido' + (nM > 1 ? 's' : '') + '</button>';
            }).join('');
        } else {
          boostPendingEl.style.display = 'none';
        }
      } else if(boostPendingEl) {
        boostPendingEl.style.display = 'none';
      }
    }
  }
}


/* ── Ticker de jornadas de boost — pastillas en barra superior ── */
function renderBoostTicker() {
  const ticker = document.getElementById('boost-ticker');
  if (!ticker) return;

  // Calcular todas las jornadas de grupos
  const jornadasMap = {};
  PARTIDOS.forEach((m, idx) => {
    const date = m.date?.substring(0,10);
    if (!date) return;
    if (!jornadasMap[date]) jornadasMap[date] = [];
    jornadasMap[date].push({ idx, home: m.home, away: m.away });
  });

  const today = new Date().toISOString().substring(0,10);
  const jornadas = Object.keys(jornadasMap).sort();

  // Jornadas pendientes de boost (sin asignar)
  const pendientes = jornadas.filter(d => !boostPicks[d]);
  // Jornada de hoy si existe
  const jornadaHoy = jornadasMap[today];

  if (pendientes.length === 0 && !jornadaHoy) {
    ticker.style.display = 'none';
    return;
  }

  ticker.style.display = 'flex';
  ticker.style.flexWrap = 'wrap';
  ticker.style.gap = '8px';
  ticker.style.alignItems = 'center';
  ticker.style.padding = '8px 14px';

  let html = '<span style="font-size:11px;font-weight:700;color:#fb923c;white-space:nowrap;letter-spacing:.04em;flex-shrink:0">🔥 BOOST</span>';

  // Pastilla especial "HOY" si hay partidos hoy y falta el boost
  if (jornadaHoy && !boostPicks[today]) {
    html += `<button onclick="tickerExpandJornada('${today}')" style="
      display:inline-flex;align-items:center;gap:5px;
      padding:4px 12px;border-radius:20px;font-size:11px;font-weight:700;
      border:1.5px solid rgb(234,88,12);
      background:rgba(124,45,18,.5);color:rgb(251,191,36);
      cursor:pointer;animation:boostPulse 1.5s ease-in-out infinite;
      white-space:nowrap;
    ">⚡ HOY — Elige tu boost</button>`;
  } else if (jornadaHoy && boostPicks[today]) {
    const bMatch = PARTIDOS.find(m => getMatchKey(m) === boostPicks[today]);
    const label = bMatch ? bMatch.home.split(' ')[0] + ' vs ' + bMatch.away.split(' ')[0] : 'asignado';
    html += `<button onclick="tickerExpandJornada('${today}')" style="
      display:inline-flex;align-items:center;gap:5px;
      padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;
      border:1px solid rgba(74,222,128,.4);
      background:rgba(22,101,52,.3);color:rgb(74,222,128);
      cursor:pointer;white-space:nowrap;
    ">✓ HOY: ${label}</button>`;
  }

  // Pastillas de jornadas pendientes (próximas, no hoy)
  const pendientesSinHoy = pendientes.filter(d => d !== today);
  // Mostrar máx 3 jornadas pendientes para no saturar
  pendientesSinHoy.slice(0,3).forEach(d => {
    const dayLabel = new Date(d + 'T12:00:00').toLocaleDateString('es-ES', {day:'numeric',month:'short'});
    const nMatches = jornadasMap[d].length;
    html += `<button onclick="tickerExpandJornada('${d}')" style="
      display:inline-flex;align-items:center;gap:4px;
      padding:3px 10px;border-radius:20px;font-size:10px;font-weight:600;
      border:1px solid rgba(251,146,60,.25);
      background:rgba(67,20,7,.4);color:rgba(251,146,60,.7);
      cursor:pointer;white-space:nowrap;
    ">🔥 ${dayLabel} (${nMatches})</button>`;
  });

  // Si quedan más jornadas pendientes, mostrar contador
  if (pendientesSinHoy.length > 3) {
    html += `<span style="font-size:10px;color:#6b7280">+${pendientesSinHoy.length - 3} más</span>`;
  }

  ticker.innerHTML = html;

  // Panel expandible de partidos de la jornada (se crea dinámicamente)
  let panel = document.getElementById('boost-ticker-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'boost-ticker-panel';
    panel.style.cssText = 'display:none;width:100%;padding:8px 0 4px;border-top:1px solid rgba(124,45,18,.3);margin-top:4px;display:flex;gap:6px;flex-wrap:wrap';
    ticker.appendChild(panel);
  }
}

/* Expande/colapsa los partidos de una jornada en el ticker */
function tickerExpandJornada(date) {
  const panel = document.getElementById('boost-ticker-panel');
  if (!panel) return;

  // Si ya estaba expandido para esta fecha, colapsar
  if (panel.dataset.date === date && panel.style.display !== 'none') {
    panel.style.display = 'none';
    panel.dataset.date = '';
    return;
  }

  panel.dataset.date = date;
  panel.style.display = 'flex';

  const matchesOfDay = PARTIDOS.filter(m => m.date?.substring(0,10) === date);
  const boostedKey = boostPicks[date];
  const hora = (m) => new Date(m.date).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});

  panel.innerHTML = matchesOfDay.map(m => {
    const key = getMatchKey(m);
    const isActive = boostedKey === key;
    return `<button
      onclick="tickerBoostToggle('${key}','${date}')"
      style="
        display:inline-flex;align-items:center;gap:5px;
        padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;
        border:1px solid ${isActive ? 'rgb(234,88,12)' : 'rgba(255,255,255,.1)'};
        background:${isActive ? 'rgba(124,45,18,.7)' : 'rgba(255,255,255,.04)'};
        color:${isActive ? 'rgb(251,191,36)' : 'rgba(255,255,255,.55)'};
        cursor:pointer;white-space:nowrap;transition:all .2s;
      "
    >${isActive ? '🔥 ' : ''}${m.home} vs ${m.away}
    <span style="opacity:.45;font-size:10px">${hora(m)}</span></button>`;
  }).join('');
}
window.tickerExpandJornada = tickerExpandJornada;

/* Llamado desde el ticker al hacer click en un partido */
function tickerBoostToggle(matchKey, date) {
  // Desmarcar boost anterior del mismo día en las tarjetas
  if(boostPicks[date] && boostPicks[date] !== matchKey) {
    document.querySelectorAll('.card').forEach(card => {
      const oi = card.getAttribute('data-match-idx');
      if(oi === null) return;
      const om = PARTIDOS[Number(oi)];
      if(!om || getMatchKey(om) !== boostPicks[date]) return;
      const chk = card.querySelector('.boost-chk');
      const row = card.querySelector('.boost-row');
      if(chk){chk.checked=false;chk.disabled=false;}
      if(row){row.classList.remove('boost-on');row.style.opacity='';row.removeAttribute('title');}
      card.classList.remove('boost-active');
    });
  }

  // Si ya estaba activo, desactivar (toggle)
  if(boostPicks[date] === matchKey) {
    delete boostPicks[date];
    document.querySelectorAll('.card').forEach(card => {
      const oi = card.getAttribute('data-match-idx');
      if(oi === null) return;
      const om = PARTIDOS[Number(oi)];
      if(!om || getMatchKey(om) !== matchKey) return;
      const chk = card.querySelector('.boost-chk');
      const row = card.querySelector('.boost-row');
      if(chk){chk.checked=false;}
      if(row){row.classList.remove('boost-on');}
      card.classList.remove('boost-active');
    });
  } else {
    // Activar en el objeto boostPicks
    boostPicks[date] = matchKey;
    // Sincronizar con el check de la tarjeta correspondiente
    document.querySelectorAll('.card').forEach(card => {
      const oi = card.getAttribute('data-match-idx');
      if(oi === null) return;
      const om = PARTIDOS[Number(oi)];
      if(!om || getMatchKey(om) !== matchKey) return;
      const chk = card.querySelector('.boost-chk');
      const row = card.querySelector('.boost-row');
      if(chk){chk.checked=true;chk.disabled=false;}
      if(row){row.classList.add('boost-on');row.style.opacity='';row.removeAttribute('title');}
      card.classList.add('boost-active');
    });
  }

  saveBoostPicks();
  checkFinalizarReady?.();
  renderBoostTicker(); // re-render ticker con nuevo estado
}
window.tickerBoostToggle = tickerBoostToggle;

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
  // Ticker boost: mostrar partidos de hoy
  if(typeof renderBoostTicker === 'function') renderBoostTicker();
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


