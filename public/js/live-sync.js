// live-sync.js — Porra Mundial 2026 (v2)
// Puente realtime entre live_scores (Supabase) y la vista Directo del frontend.
//
// Usa: window._porraDb (auth.js), PARTIDOS + EQUIPOS (data.js)
//      fetch('/data/worldcup-2026-matches.json')
// Expone:
//   - window.liveSyncInit()     — arranca todo
//   - window.liveSyncStop()     — desconecta canal realtime
//   - window.matchKeyFor(match) — utility: dado un match de PARTIDOS, devuelve match_key (o null)
//   - window._liveScoresByMatchKey — cache indexada por match_key, lee ui-directo.js
//
// Flujo:
//   1. Carga /data/worldcup-2026-matches.json → indexa por match_key
//   2. Snapshot inicial: SELECT * FROM live_scores y actualiza la cache
//   3. Subscribe a postgres_changes de live_scores
//   4. Cada cambio: actualiza cache y llama window.updateDirectoCard(matchKey)

(function () {
  'use strict';

  // ─────────────────────────────────────────────────────────────
  // ESTADO
  // ─────────────────────────────────────────────────────────────
  let matchesByKey = null;         // del JSON: {match_key: {home_en, home_es, teams_swapped, ...}}
  let keyByMatchSignature = null;  // índice: "home_en|away_en|group" → match_key
  let channel = null;
  let initialized = false;

  // Cache que consume ui-directo.js. Row normalizada desde perspectiva de data.js:
  // {match_key, status, score_home, score_away, events, minute, _teams_swapped}
  window._liveScoresByMatchKey = {};

  // Cache de simulacros (is_historic=true con team_names). Indexada por match_key.
  // La expone window.getSimulacros() como array.
  window._simulacrosByKey = {};

  // ─────────────────────────────────────────────────────────────
  // Detectar row de simulacro (histórica con nombres rellenos)
  // ─────────────────────────────────────────────────────────────
  function isSimulacroRow(row) {
    return !!(row && row.is_historic === true && row.home_team_name && row.away_team_name);
  }

  // ─────────────────────────────────────────────────────────────
  // CARGA JSON MAPEO
  // ─────────────────────────────────────────────────────────────
  async function loadMatchesJson() {
    try {
      const res = await fetch('/data/worldcup-2026-matches.json');
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      matchesByKey = data;

      keyByMatchSignature = {};
      for (const [key, m] of Object.entries(data)) {
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
  // RESOLVER match de PARTIDOS → match_key
  // ─────────────────────────────────────────────────────────────
  function matchKeyFor(match) {
    if (!match || !keyByMatchSignature) return null;
    // EQUIPOS es const global de data.js, accesible por scope léxico
    // (NO via window.* porque const/let top-level no se adjuntan a window)
    const homeTeam = EQUIPOS.find(e => e.name === match.home);
    const awayTeam = EQUIPOS.find(e => e.name === match.away);
    if (!homeTeam?.name_en || !awayTeam?.name_en) return null;
    const sig = [homeTeam.name_en, awayTeam.name_en].sort().join('|') + '|' + match.group;
    return keyByMatchSignature[sig] || null;
  }
  window.matchKeyFor = matchKeyFor;

  // ─────────────────────────────────────────────────────────────
  // NORMALIZAR row de live_scores → cache desde perspectiva de data.js
  // (aplica teams_swapped a score. events se traducirá en ui-directo.js
  //  usando la flag _teams_swapped)
  // ─────────────────────────────────────────────────────────────
  function normalizeRow(row) {
    if (!row || !row.match_key) return null;
    const meta = matchesByKey[row.match_key];
    if (!meta) return null; // match_key de otra competición (UCL test, etc.)

    let scoreHome = row.score_home;
    let scoreAway = row.score_away;
    if (meta.teams_swapped) {
      scoreHome = row.score_away;
      scoreAway = row.score_home;
    }

    return {
      match_key:      row.match_key,
      status:         row.status,
      score_home:     scoreHome,
      score_away:     scoreAway,
      events:         Array.isArray(row.events) ? row.events : [],
      minute:         null, // pendiente: SofaScore pone minuto en status.time.played (no está en la tabla actual)
      _teams_swapped: !!meta.teams_swapped,
      raw:            row
    };
  }

  // ─────────────────────────────────────────────────────────────
  // APLICAR row a la cache + disparar repintado de tarjeta
  // ─────────────────────────────────────────────────────────────
  function applyRow(row) {
    // Simulacros (partidos fuera del Mundial marcados is_historic)
    if (isSimulacroRow(row)) {
      window._simulacrosByKey[row.match_key] = row;
      if (typeof window.updateSimulacroCard === 'function') {
        window.updateSimulacroCard(row.match_key);
      }
      return;
    }

    // Partido del Mundial
    const norm = normalizeRow(row);
    if (!norm) return; // silencioso: match_key no del Mundial ni simulacro válido
    window._liveScoresByMatchKey[norm.match_key] = norm;
    if (typeof window.updateDirectoCard === 'function') {
      window.updateDirectoCard(norm.match_key);
    }
  }

  // ─────────────────────────────────────────────────────────────
  // API simulacros
  // ─────────────────────────────────────────────────────────────
  window.getSimulacros = function () {
    return Object.values(window._simulacrosByKey || {});
  };

  // ─────────────────────────────────────────────────────────────
  // SNAPSHOT INICIAL
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
      let relevantes = 0;
      let simulacros = 0;
      for (const row of data) {
        if (isSimulacroRow(row)) {
          window._simulacrosByKey[row.match_key] = row;
          simulacros++;
          continue;
        }
        const norm = normalizeRow(row);
        if (norm) {
          window._liveScoresByMatchKey[norm.match_key] = norm;
          relevantes++;
        }
      }
      console.log('[live-sync] Relevantes para el Mundial:', relevantes,
                  '· Simulacros activos:', simulacros);
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
            console.log('[live-sync] change:', payload.eventType, row.match_key,
              row.score_home, '-', row.score_away, row.status);
            applyRow(row);
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

    // Si la vista Directo ya está visible, refresca completa
    const directoContainer = document.getElementById('directo-container');
    if (directoContainer && directoContainer.style.display !== 'none' &&
        typeof window.renderVistaDirecto === 'function') {
      window.renderVistaDirecto();
    }
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

})();
