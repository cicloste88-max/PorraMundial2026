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

  // Cache de results.match_results (scorers canónicos del bridge, key legacy
  // "{grupo}_{home_es}_{away_es}"). La consume _realScorersFor (ui-directo.js)
  // para el +2 de goleador en partidos finished (Item 3+5 post-J1).
  window._matchResultsByKey = {};

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
  // KICKOFF UTC del partido (mismo instante que Directo) — fuente:
  // date_utc del JSON wc_matches (= live_scores.match_start_ts). La
  // pantalla Jornada lo consume vía window.kickoffUtcMsFor para pintar
  // la hora en Europe/Madrid sin asumir CEST en la sede (husos
  // US/Canadá/México → el +02:00 legacy desplazaba hasta 6-9h). ERR-92.
  // date_utc viene SIN designador de zona ("2026-06-11T19:00") → forzamos
  // 'Z' para que Date.parse lo interprete como UTC y no como hora local.
  // ─────────────────────────────────────────────────────────────
  function kickoffUtcMsFor(match) {
    const key = matchKeyFor(match);
    if (!key || !matchesByKey || !matchesByKey[key]) return null;
    const du = matchesByKey[key].date_utc;
    if (!du) return null;
    const iso = /[zZ]|[+-]\d{2}:?\d{2}$/.test(du) ? du : du + 'Z';
    const ms = Date.parse(iso);
    return Number.isFinite(ms) ? ms : null;
  }
  window.kickoffUtcMsFor = kickoffUtcMsFor;

  // ─────────────────────────────────────────────────────────────
  // NORMALIZAR row de live_scores → cache desde perspectiva de data.js
  // (aplica teams_swapped a score. events se traducirá en ui-directo.js
  //  usando la flag _teams_swapped)
  // ─────────────────────────────────────────────────────────────
  function normalizeRow(row) {
    if (!row || !row.match_key) return null;
    const meta = matchesByKey[row.match_key];
    if (!meta) {
      // KO (Fase Final): wc2026_ko_<slot> NO vive en worldcup-2026-matches.json
      // (ese JSON solo tiene los 72 de grupos). Las filas KO se siembran ya
      // orientadas a la malla (home/away = siembra, teams_swapped=false) con
      // nombres ES en home_team_name/away_team_name. Sin esta rama, normalizeRow
      // devolvía null y _liveScoresByMatchKey ignoraba las filas KO → la pantalla
      // Jornada nunca pintaba marcador en vivo de eliminatorias. Round-genérico:
      // cualquier slot r32→final (73..104) cae aquí por el patrón del match_key.
      const koM = /^wc2026_ko_(\d+)$/.exec(row.match_key);
      if (koM) {
        return {
          match_key:      row.match_key,
          status:         row.status,
          score_home:     row.score_home,
          score_away:     row.score_away,
          home_team_name: row.home_team_name,
          away_team_name: row.away_team_name,
          match_start_ts: row.match_start_ts,
          events:         Array.isArray(row.events) ? row.events : [],
          minute:         row.minute ?? null,
          _ko_slot:       Number(koM[1]),
          _is_ko:         true,
          _teams_swapped: false,
          raw:            row
        };
      }
      return null; // match_key de otra competición (UCL test, etc.)
    }

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
      // Kickoff canónico UTC (BIGINT seg/ms). Consumido por _kickoffHoraLabel
      // (ui-directo.js) para la hora Madrid de mini-rows y card expandida.
      // OJO: todo campo de la row de BD que el front consuma debe copiarse
      // aquí a primer nivel — la cache normalizada NO expone la row cruda
      // salvo via `raw` (ERR-87).
      match_start_ts: row.match_start_ts,
      events:         Array.isArray(row.events) ? row.events : [],
      // Desde el poller ESPN (12-jun) la columna live_scores.minute viene
      // poblada en vivo; ui-directo la pinta en la píldora live.
      minute:         row.minute ?? null,
      _teams_swapped: !!meta.teams_swapped,
      raw:            row
    };
  }

  // ─────────────────────────────────────────────────────────────
  // RESULTS (match_results del bridge) — scorers canónicos finished
  // ─────────────────────────────────────────────────────────────
  async function loadMatchResults() {
    const db = window._porraDb;
    if (!db) return;
    try {
      const { data, error } = await db.from('results').select('match_results').eq('id', 1).maybeSingle();
      if (error) {
        console.error('[live-sync] Error cargando match_results:', error);
        return;
      }
      // Lector defensivo (patrón asObj): si un writer regresara a jsonb
      // double-encoded (string), parsear en vez de romper el badge de puntos.
      let mr = data ? data.match_results : null;
      if (typeof mr === 'string') {
        try { mr = JSON.parse(mr); } catch (_) { mr = null; }
      }
      if (mr && typeof mr === 'object') {
        window._matchResultsByKey = mr;
        console.log('[live-sync] match_results:', Object.keys(mr).length, 'partidos bridgeados');
        // Recalcular el total legacy canónico (elim-shell / #total-points).
        try {
          if (typeof window.updateGlobalPoints === 'function') window.updateGlobalPoints();
        } catch (e) {
          console.warn('[live-sync] updateGlobalPoints tras match_results:', e);
        }
      }
    } catch (err) {
      console.error('[live-sync] match_results exception:', err);
    }
  }

  // Al pasar un partido a finished, el bridge escribe results en segundos
  // (trigger bridge_on_finished). Re-cargamos una vez con margen y repintamos
  // la tarjeta para promocionar el badge de events-derivados → canónicos.
  let _mrRefetchTimer = null;
  function scheduleMatchResultsRefresh(matchKey) {
    if (_mrRefetchTimer) clearTimeout(_mrRefetchTimer);
    _mrRefetchTimer = setTimeout(async () => {
      _mrRefetchTimer = null;
      await loadMatchResults();
      if (typeof window.updateDirectoCard === 'function') {
        window.updateDirectoCard(matchKey);
      }
    }, 8000);
  }

  // ─────────────────────────────────────────────────────────────
  // APLICAR row a la cache + disparar repintado de tarjeta
  // ─────────────────────────────────────────────────────────────
  function applyRow(row) {
    // Simulacros (partidos fuera del Mundial marcados is_historic).
    // Siempre cacheamos. Si la tarjeta DOM no existe (p.ej. el check admin aún
    // no ha completado, o el user no es admin), updateSimulacroCard hace early-
    // return silencioso — sin console.warn — y el cache queda disponible para
    // cuando se dispare el re-render tras resolver el check admin.
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
    if (norm.status === 'finished') scheduleMatchResultsRefresh(norm.match_key);
    // KO: ni la pantalla Directo ni la vista Jornada pintan las cards KO por
    // match_key indexado a PARTIDOS (updateDirectoCard solo cubre grupos). Ambas
    // construyen las secciones KO con _buildJKOCard a partir de la live cache,
    // así que un cambio KO en vivo dispara un re-render (debounced) de la
    // pantalla live activa. Los grupos siguen por updateDirectoCard sin cambios.
    if (norm._is_ko) {
      scheduleKORepaint();
    } else if (typeof window.updateDirectoCard === 'function') {
      window.updateDirectoCard(norm.match_key);
    }
  }

  // Repintado debounced de la pantalla live activa (Directo o Jornada) cuando
  // llega un cambio KO. _joSectionCollapsed / _expandedDays (módulos UI) viven
  // en memoria → el re-render conserva el estado de colapso del usuario.
  let _koRepaintTimer = null;
  function scheduleKORepaint() {
    const page = window._currentPage;
    if (page !== 'directo' && page !== 'jornada') return;
    if (_koRepaintTimer) clearTimeout(_koRepaintTimer);
    _koRepaintTimer = setTimeout(() => {
      _koRepaintTimer = null;
      if (window._currentPage === 'directo' && typeof window.renderVistaDirecto === 'function') {
        window.renderVistaDirecto();
      } else if (window._currentPage === 'jornada' && typeof window.renderVistaJornada === 'function') {
        window.renderVistaJornada();
      }
    }, 1200);
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
  //
  // Retry de init (ERR-88): el ÚNICO caller es main-entry.js al final de la
  // chain de loadScript, UNA vez. Antes, liveSyncInit latcheaba
  // `initialized=true` de entrada; si en ese instante auth.js aún no había
  // creado `_porraDb` (bootstrap lento, carga fría), snapshot+subscribe se
  // saltaban con un warn y NINGUNA llamada posterior podía reactivarlo
  // (`if (initialized) return`). Resultado: cache vacía para siempre →
  // ui-directo cae al fallback m.date (horas de sede) en todos los partidos,
  // de forma intermitente según el timing de cada carga. Mismo patrón de
  // race y mismo remedio que checkIsAdmin (ui-directo.js): reintentar con
  // backoff y solo latchear cuando hay db.
  // ─────────────────────────────────────────────────────────────
  let _initAttempts = 0;
  const _MAX_INIT_ATTEMPTS = 20; // 20 × 500 ms = 10 s máx

  function _scheduleInitRetry() {
    _initAttempts++;
    if (_initAttempts > _MAX_INIT_ATTEMPTS) {
      console.warn('[live-sync] init abandonado tras ' + _MAX_INIT_ATTEMPTS +
                    ' reintentos (sin _porraDb o sin JSON de partidos)');
      return;
    }
    setTimeout(liveSyncInit, 500);
  }

  async function liveSyncInit() {
    if (initialized) return;
    if (!window._porraDb) {
      _scheduleInitRetry();
      return;
    }
    initialized = true;

    const loaded = await loadMatchesJson();
    if (!loaded) {
      initialized = false; // fetch transitorio: permitir reintento
      _scheduleInitRetry();
      return;
    }

    await Promise.all([loadInitialSnapshot(), loadMatchResults()]);
    subscribe();

    // Si la vista Directo ya está visible, refresca completa
    const directoContainer = document.getElementById('directo-container');
    if (directoContainer && directoContainer.style.display !== 'none' &&
        typeof window.renderVistaDirecto === 'function') {
      window.renderVistaDirecto();
    }

    // Mismo anti-flash para Jornada (ERR-92): en carga fría la pantalla pinta
    // con el fallback de sede; al cargar el JSON repintamos para que las horas
    // pasen a Europe/Madrid real (date_utc). Mirror del bloque Directo de arriba.
    const jornadaContainer = document.getElementById('jornada-container');
    if (jornadaContainer && jornadaContainer.style.display !== 'none' &&
        typeof window.renderVistaJornada === 'function') {
      window.renderVistaJornada();
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
