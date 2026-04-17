// live-sync.js — Porra Mundial 2026
// Puente realtime entre live_scores (Supabase) y tarjetas del frontend.
//
// Usa: window._porraDb (auth.js), PARTIDOS + EQUIPOS (data.js),
//      fetch('/data/worldcup-2026-matches.json')
// Expone: window.liveSyncInit, window.liveSyncStop, window.matchKeyFor
//
// Flujo:
//   1. Al arrancar, carga el JSON de mapeo y lo indexa por match_key
//   2. Hace snapshot inicial: SELECT * FROM live_scores para pintar estado actual
//   3. Se suscribe a cambios en live_scores (INSERT/UPDATE)
//   4. Cada cambio: actualiza el DOM de la tarjeta correspondiente

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // ESTADO INTERNO
  // ─────────────────────────────────────────────────────────────
  let matchesByKey = null;         // Map<match_key, {sofascore_id, home_en, away_en, home_es, away_es, teams_swapped, group, ...}>
  let keyByMatchSignature = null;  // Map<"home_en|away_en|group", match_key>
  let channel = null;              // Supabase realtime channel
  let initialized = false;

  // ─────────────────────────────────────────────────────────────
  // CARGA DEL JSON DE MAPEO
  // ─────────────────────────────────────────────────────────────
  async function loadMatchesJson() {
    try {
      const res = await fetch('/data/worldcup-2026-matches.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      matchesByKey = data;

      // Índice inverso para resolver un match de PARTIDOS → match_key
      keyByMatchSignature = {};
      for (const [key, m] of Object.entries(data)) {
        // Firma canónica: equipos en orden alfabético (aguanta teams_swapped)
        const sig = [m.home_en, m.away_en].sort().join('|') + '|' + m.group;
        keyByMatchSignature[sig] = key;
      }
      console.log('[live-sync] JSON cargado:', Object.keys(data).length, 'partidos');
      return true;
    } catch (err) {
      console.error('[live-sync] Error cargando JSON:', err);
      return false;
    }
  }

  // ─────────────────────────────────────────────────────────────
  // RESOLUCIÓN match de PARTIDOS → match_key
  // ─────────────────────────────────────────────────────────────
  function matchKeyFor(match) {
    if (!match || !keyByMatchSignature) return null;

    // Encontrar los nombres en inglés vía EQUIPOS
    const equipos = window.EQUIPOS || [];
    const homeTeam = equipos.find(e => e.name === match.home);
    const awayTeam = equipos.find(e => e.name === match.away);
    if (!homeTeam?.name_en || !awayTeam?.name_en) {
      // Partidos de KO con placeholders (ej "1A", "2B") no tendrán match_key aún
      return null;
    }

    const sig = [homeTeam.name_en, awayTeam.name_en].sort().join('|') + '|' + match.group;
    return keyByMatchSignature[sig] || null;
  }

  // Exponer tempranamente por si otros módulos lo necesitan
  window.matchKeyFor = matchKeyFor;

  // ─────────────────────────────────────────────────────────────
  // RESOLUCIÓN match_key → idx de tarjeta (posición en PARTIDOS)
  // ─────────────────────────────────────────────────────────────
  function idxForMatchKey(matchKey) {
    const meta = matchesByKey[matchKey];
    if (!meta) return -1;

    const partidos = window.PARTIDOS || [];
    // Buscar el match de PARTIDOS cuyo par de equipos coincide con el de meta
    for (let i = 0; i < partidos.length; i++) {
      const p = partidos[i];
      if (p.group !== meta.group) continue;
      // Misma pareja de equipos (ambos órdenes)
      if ((p.home === meta.home_es && p.away === meta.away_es) ||
          (p.home === meta.away_es && p.away === meta.home_es)) {
        return i;
      }
    }
    return -1;
  }

  // ─────────────────────────────────────────────────────────────
  // APLICAR un registro de live_scores a la tarjeta correspondiente
  // ─────────────────────────────────────────────────────────────
  function applyLiveRowToCard(row) {
    if (!row || !row.match_key) return;

    const meta = matchesByKey[row.match_key];
    if (!meta) {
      // Puede ser un match_key de otra competición (UCL de prueba etc.) → ignorar silenciosamente
      return;
    }

    const idx = idxForMatchKey(row.match_key);
    if (idx === -1) {
      console.warn('[live-sync] match_key sin idx:', row.match_key);
      return;
    }

    // Determinar home/away score desde la perspectiva de data.js
    let scoreHome = row.score_home;
    let scoreAway = row.score_away;
    if (meta.teams_swapped) {
      scoreHome = row.score_away;
      scoreAway = row.score_home;
    }

    // Mostrar/ocultar contenedor y actualizar números
    const container = document.getElementById('score-live-' + idx);
    const rlEl = document.getElementById('rl-' + idx);
    const rrEl = document.getElementById('rr-' + idx);

    if (!container || !rlEl || !rrEl) {
      // Tarjeta aún no renderizada; se volverá a intentar cuando el usuario navegue a grupos
      return;
    }

    const hasScore = scoreHome != null && scoreAway != null;
    const isLive   = row.status === 'inprogress' || row.status === 'halftime'
                  || row.status === 'overtime'   || row.status === 'penalties';
    const isFinal  = row.status === 'finished';

    if (hasScore && (isLive || isFinal)) {
      container.style.display = '';
      rlEl.textContent = String(scoreHome);
      rrEl.textContent = String(scoreAway);

      // Badge de estado si existe la clase correspondiente
      container.classList.toggle('is-live',  isLive);
      container.classList.toggle('is-final', isFinal);
    }
    // Nota: no ocultamos la tarjeta aunque status vuelva a notstarted (no debería pasar)
  }

  // ─────────────────────────────────────────────────────────────
  // SNAPSHOT INICIAL: leer todos los live_scores al cargar
  // ─────────────────────────────────────────────────────────────
  async function loadInitialSnapshot() {
    const db = window._porraDb;
    if (!db) {
      console.warn('[live-sync] _porraDb no disponible, saltando snapshot');
      return;
    }
    try {
      const { data, error } = await db.from('live_scores').select('*');
      if (error) {
        console.error('[live-sync] Error snapshot:', error);
        return;
      }
      console.log('[live-sync] Snapshot inicial:', data.length, 'filas');
      for (const row of data) applyLiveRowToCard(row);
    } catch (err) {
      console.error('[live-sync] Snapshot exception:', err);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // SUBSCRIPCIÓN REALTIME
  // ─────────────────────────────────────────────────────────────
  function subscribe() {
    const db = window._porraDb;
    if (!db) {
      console.warn('[live-sync] _porraDb no disponible, saltando realtime');
      return;
    }

    channel = db
      .channel('live-scores-changes')
      .on('postgres_changes',
        { event: '*', schema: 'public', table: 'live_scores' },
        (payload) => {
          const row = payload.new || payload.record;
          if (row) {
            console.log('[live-sync] change:', payload.eventType, row.match_key, row.score_home, '-', row.score_away, row.status);
            applyLiveRowToCard(row);
          }
        }
      )
      .subscribe((status) => {
        if (status === 'SUBSCRIBED') {
          console.log('[live-sync] Canal subscrito correctamente');
        } else if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
          console.error('[live-sync] Error canal:', status);
        }
      });
  }

  // ─────────────────────────────────────────────────────────────
  // API pública
  // ─────────────────────────────────────────────────────────────
  async function liveSyncInit() {
    if (initialized) return;
    initialized = true;

    const loaded = await loadMatchesJson();
    if (!loaded) return;

    await loadInitialSnapshot();
    subscribe();
  }

  function liveSyncStop() {
    if (channel && window._porraDb) {
      window._porraDb.removeChannel(channel);
      channel = null;
    }
    initialized = false;
  }

  window.liveSyncInit = liveSyncInit;
  window.liveSyncStop = liveSyncStop;

  // ─────────────────────────────────────────────────────────────
  // Re-aplicación cuando se re-renderizan las tarjetas
  // (renderAll destruye y recrea #score-live-<idx>, hay que repintar)
  // ─────────────────────────────────────────────────────────────
  window.liveSyncRepaint = async function () {
    if (!matchesByKey) return;
    await loadInitialSnapshot();
  };

})();
