/* close-porra.js — Porra Mundial 2026
   Usa: PARTIDOS, currentUser, predictions, db, window.getActiveLeagueId
   Expone: checkFinalizarReady, finalizarPorra, setCheck, setCheckClosed,
           window._porraCerrada
   Deps: auth.js, leagues.js, data.js
*/
// ════════════════════════════════════════════════
// FINALIZAR PRONÓSTICOS
// ════════════════════════════════════════════════

// checkFinalizarReady: verifica contra la DB (no contra memoria local)
// para evitar que un usuario pueda cerrar la porra con datos no guardados.
let _finalizarChecking = false;
let _finalizarExecId   = 0;
let _finalizarDone     = false;  // true cuando 72+32+4 confirmados en DB — no volver a verificar
let _finalizarDebounceTimer = null;
function checkFinalizarReady() {
  if (_finalizarDone) return;  // ya verificado y completo — no repetir
  clearTimeout(_finalizarDebounceTimer);
  _finalizarDebounceTimer = setTimeout(() => {
    if (_finalizarDone) return;
    _finalizarChecking = false;
    _finalizarExecId++;
    _checkFinalizarReadyDB(_finalizarExecId);
  }, 400);
}
async function _checkFinalizarReadyDB(execId) {
  const section = document.getElementById('finalizar-section');
  if (!section || !currentUser) return;

  // Si ya está cerrada: mostrar la sección y consultar DB para mostrar counts reales
  if (window._porraCerrada) {
    section.style.display = 'block';
    const btn = document.getElementById('finalizar-btn');
    const btnIcon = document.getElementById('finalizar-btn-icon');
    const btnText = document.getElementById('finalizar-btn-text');
    const card = document.getElementById('finalizar-card');
    if (btn) { btn.disabled = true; btn.className = 'finalizar-btn sent'; }
    if (btnIcon) btnIcon.textContent = '✅';
    if (btnText) btnText.textContent = 'Pronósticos cerrados — ¡suerte!';
    if (card) card.classList.add('ready');
    // Consultar DB para mostrar counts reales en los checks
    try {
      const db = window._porraDb;
      const uid = currentUser.id;
      const _cLeagueId = getActiveLeagueId();
      const [resG, resKO, resAw] = await Promise.all([
        _cLeagueId
          ? db.from('predictions').select('*', { count: 'exact', head: true }).eq('user_id', uid).eq('league_id', _cLeagueId)
          : db.from('predictions').select('*', { count: 'exact', head: true }).eq('user_id', uid),
        _cLeagueId
          ? db.from('ko_predictions').select('*', { count: 'exact', head: true }).eq('user_id', uid).eq('league_id', _cLeagueId)
          : db.from('ko_predictions').select('*', { count: 'exact', head: true }).eq('user_id', uid),
        _cLeagueId
          ? db.from('award_picks').select('golden_ball,golden_boot,golden_glove,young_player').eq('user_id', uid).eq('league_id', _cLeagueId).maybeSingle()
          : db.from('award_picks').select('golden_ball,golden_boot,golden_glove,young_player').eq('user_id', uid).maybeSingle(),
      ]);
      const gF = resG.count ?? 0;
      const kF = resKO.count ?? 0;
      const aD = resAw.data;
      const aF = (aD?.golden_ball && aD?.golden_boot && aD?.golden_glove && aD?.young_player) ? 4 : 0;
      function setCheckClosed(id, countId, filled, total) {
        const el = document.getElementById(id);
        const ct = document.getElementById(countId);
        if (el) el.classList.toggle('done', filled >= total);
        if (ct) ct.textContent = filled + ' / ' + total + (total === 4 ? ' premios' : ' partidos');
        const icon = el?.querySelector('.fin-check-icon');
        if (icon) icon.textContent = filled >= total ? '✅' : (id === 'fincheck-grupos' ? '⚽' : id === 'fincheck-ko' ? '⚡' : '🏆');
      }
      setCheckClosed('fincheck-grupos', 'fincheck-grupos-count', gF, 72);
      setCheckClosed('fincheck-ko',     'fincheck-ko-count',     kF, 32);
      setCheckClosed('fincheck-awards', 'fincheck-awards-count', aF, 4);
    } catch(_) {}
    return;
  }

  // Sin liga activa: ocultar sección
  if (!getActiveLeagueId()) { section.style.display = 'none'; _finalizarChecking = false; return; }

  // Verificación rápida en memoria
  const gruposEnMemoria = PARTIDOS.filter(m => {
    const p = predictions[getMatchKey(m)]; return p && p.saved;
  }).length;

  // Si hay liga activa, siempre mostrar la sección para que la DB pueda verificar
  // (la sección muestra "verificando..." mientras la DB responde)
  section.style.display = 'block';
  if (gruposEnMemoria < 72) {
    // Hay datos pero no todos en memoria aún — dejar que la DB decida
    // Si la DB tampoco los tiene, el botón quedará bloqueado con el mensaje de falta
    if (gruposEnMemoria === 0) {
      // Sin datos en memoria ni en DB esperada — ocultar hasta que carguen
      section.style.display = 'none';
      return;
    }
  }

  // Evitar llamadas simultáneas
  if (_finalizarChecking) return;
  _finalizarChecking = true;
  // Timeout de seguridad: liberar el flag si tarda más de 10s
  let _checkingTimeout = setTimeout(() => { _finalizarChecking = false; }, 10000);

  // Mostrar estado de carga en el botón mientras verificamos
  const btn     = document.getElementById('finalizar-btn');
  const btnIcon = document.getElementById('finalizar-btn-icon');
  const btnText = document.getElementById('finalizar-btn-text');
  const card    = document.getElementById('finalizar-card');
  if (btn) { btn.disabled = true; btn.className = 'finalizar-btn'; }
  if (btnIcon) btnIcon.textContent = '⏳';
  if (btnText) btnText.textContent = 'Verificando en base de datos...';

  function setCheck(id, countId, done, filled, total) {
    const el = document.getElementById(id);
    const ct = document.getElementById(countId);
    if (el) el.classList.toggle('done', done);
    if (ct) ct.textContent = filled + ' / ' + total + (total === 4 ? ' premios' : ' partidos');
    const icon = el?.querySelector('.fin-check-icon');
    if (icon) icon.textContent = done ? '✅' : (id === 'fincheck-grupos' ? '⚽' : id === 'fincheck-ko' ? '⚡' : '🏆');
  }

  try {
    const db = window._porraDb;
    const uid = currentUser.id;

    // Consultar DB en paralelo — queries individuales para mejor diagnóstico
    const leagueId = getActiveLeagueId();
    if (!leagueId) {
      // Sin liga activa: ocultar la sección silenciosamente
      section.style.display = 'none';
      _finalizarChecking = false; return;
    }
    const [resGrupos, resKO, resAwards] = await Promise.all([
      db.from('predictions').select('*', { count: 'exact', head: true }).eq('user_id', uid).eq('league_id', leagueId),
      db.from('ko_predictions').select('*', { count: 'exact', head: true }).eq('user_id', uid).eq('league_id', leagueId),
      db.from('award_picks').select('golden_ball,golden_boot,golden_glove,young_player').eq('user_id', uid).eq('league_id', leagueId).maybeSingle(),
    ]);

    // Si llegó una nueva ejecución mientras esperábamos, ignorar esta
    if (execId !== _finalizarExecId) { _finalizarChecking = false; return; }

    const gruposFilled = resGrupos.count ?? 0;
    const koFilled     = resKO.count ?? 0;
    const awardsDB     = resAwards.data;
    const awFilled     = (awardsDB?.golden_ball && awardsDB?.golden_boot && awardsDB?.golden_glove && awardsDB?.young_player) ? 4 : 0;
    console.log('[checkFinalizar] DB:', gruposFilled, 'grupos,', koFilled, 'KO, awards:', awFilled);

    // Calcular días de grupos con partidos y cuántos tienen burn asignado
    const diseWithMatches = [...new Set(PARTIDOS.map(m => m.date?.substring(0,10)).filter(Boolean))].sort();
    const boostTotal  = diseWithMatches.length;  // 17 jornadas
    const boostFilled = diseWithMatches.filter(d => boostPicks[d]).length;
    const boostDone   = boostFilled >= boostTotal;

    const gruposDone = gruposFilled >= 72;
    const koDone     = koFilled >= 32;
    const awDone     = awFilled >= 4;
    const allDone    = gruposDone && koDone && awDone && boostDone;

    setCheck('fincheck-grupos', 'fincheck-grupos-count', gruposDone, gruposFilled, 72);
    setCheck('fincheck-ko',     'fincheck-ko-count',     koDone,     koFilled,     32);
    setCheck('fincheck-awards', 'fincheck-awards-count', awDone,     awFilled,     4);

    // Check de burns (nuevo)
    const boostCheckEl = document.getElementById('fincheck-boost');
    const boostCountEl = document.getElementById('fincheck-boost-count');
    if (boostCheckEl) boostCheckEl.classList.toggle('done', boostDone);
    if (boostCountEl) boostCountEl.textContent = boostFilled + ' / ' + boostTotal + ' jornadas';
    const boostIcon = boostCheckEl?.querySelector('.fin-check-icon');
    if (boostIcon) boostIcon.textContent = boostDone ? '✅' : '🔥';

    if (allDone) {
      _finalizarDone = true;  // marcar como verificado — no volver a consultar DB
      if (btn) { btn.disabled = false; btn.className = 'finalizar-btn ready'; }
      if (btnIcon) btnIcon.textContent = '🏁';
      if (btnText) btnText.textContent = 'Cerrar pronósticos definitivamente';
      if (card) card.classList.add('ready');
    } else {
      if (btn) { btn.disabled = true; btn.className = 'finalizar-btn'; }
      if (btnIcon) btnIcon.textContent = '🔒';
      const missing = [];
      if (!gruposDone) missing.push((72 - gruposFilled) + ' grupos sin guardar');
      if (!koDone)     missing.push((32 - koFilled) + ' KO sin guardar');
      if (!awDone)     missing.push('premios incompletos');
      if (!boostDone)  missing.push((boostTotal - boostFilled) + ' boosts de jornada sin asignar');
      if (btnText) btnText.textContent = 'Falta: ' + missing.join(' · ');
      if (card) card.classList.remove('ready');
    }
  } catch(err) {
    console.error('[checkFinalizar]', err);
    if (btn) { btn.disabled = false; btn.className = 'finalizar-btn'; }
    if (btnIcon) btnIcon.textContent = '🔄';
    if (btnText) btnText.textContent = 'Error verificando — pulsa aquí para reintentar';
    if (btn) btn.onclick = () => { _finalizarChecking = false; _checkFinalizarReadyDB(); };
  } finally {
    _finalizarChecking = false;
    clearTimeout(_checkingTimeout);
  }
}

async function finalizarPorra() {
  const btn     = document.getElementById('finalizar-btn');
  const btnText = document.getElementById('finalizar-btn-text');
  const btnIcon = document.getElementById('finalizar-btn-icon');
  if (!btn || btn.disabled) return;

  // Confirmación
  const ok = confirm(
    '¿Cerrar pronósticos definitivamente?\n\n' +
    'Una vez cerrada la porra no podrás modificar ningún pronóstico.\n\n' +
    'Pulsa Aceptar para confirmar.'
  );
  if (!ok) return;

  // UI: loading
  btn.disabled = true;
  btn.className = 'finalizar-btn';
  btnIcon.textContent = '⏳';
  btnText.textContent = 'Cerrando pronósticos…';

  try {
    const db = window._porraDb;
    const user = currentUser || window.currentUser;
    if (!db) throw new Error('Sin conexión a BD');
    if (!user) throw new Error('Sin sesión activa');

    // Marcar en league_members que el usuario ha cerrado su porra en esta liga
    const leagueId = getActiveLeagueId();
    if (!leagueId) throw new Error('Sin liga activa — no se puede cerrar la porra');
    const updatePromise = db
      .from('league_members')
      .update({ porra_cerrada: true, cerrada_at: new Date().toISOString() })
      .eq('user_id', user.id)
      .eq('league_id', leagueId);
    const timeoutPromise = new Promise(resolve => setTimeout(() => resolve({ error: { message: 'timeout' } }), 4000));
    const { error } = await Promise.race([updatePromise, timeoutPromise]);

    if (error) {
      console.warn('[finalizar] Supabase error (se ignora):', error.message);
    }

    // Marcar cerrada independientemente del resultado de Supabase
    window._porraCerrada = true;
    btn.disabled = true;
    btn.className = 'finalizar-btn sent';
    btnIcon.textContent = '✅';
    btnText.textContent = '¡Pronósticos cerrados! — Mucha suerte 🍀';
    document.getElementById('finalizar-card')?.classList.add('ready');

  } catch (err) {
    console.error('[finalizar] Error inesperado:', err.message);
    // Marcar cerrada igualmente — el usuario ya confirmó
    window._porraCerrada = true;
    btn.disabled = true;
    btn.className = 'finalizar-btn sent';
    btnIcon.textContent = '✅';
    btnText.textContent = '¡Pronósticos cerrados! — Mucha suerte 🍀';
    document.getElementById('finalizar-card')?.classList.add('ready');
  }
}

// Exports explicitos para inline onclick="finalizarPorra()" en index.html.
// Function declarations de classic scripts dinamicamente inyectados no
// siempre hoistean a window de forma fiable: asignacion explicita.
window.finalizarPorra      = finalizarPorra;
window.checkFinalizarReady = checkFinalizarReady;
