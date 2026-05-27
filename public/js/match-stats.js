// match-stats.js — provee window.fetchMatchStats(matchKey)
// Fase 1: mock estático para 1 partido piloto.
// Fase 2 (futuro sprint, brief aparte): EF Supabase + tablas teams_stats + h2h + match_league_consensus.

(function() {
  'use strict';

  const cache = new Map();
  const TTL_MS = 5 * 60 * 1000;

  // matchKey real desde getMatchKey(): `${m.group}_${m.home}_${m.away}` en español.
  const MOCK_PAYLOADS = {
    'A_México_Sudáfrica': {
      match: {
        jornada: 1,
        indexInJornada: 1,
        timeLabel: 'JUE 11 JUN · 17:00 CDMX',
        stadium: 'Estadio Azteca',
        city: 'Ciudad de México',
        capacity: 87000,
        aIsHost: true
      },
      form: { a: 'WWDWL', b: 'LWDDL' },
      stats: {
        fifaRank:   { a: 14,   b: 58 },
        goalsFor:   { a: 2.4,  b: 1.1 },
        goalsAg:    { a: 0.6,  b: 1.8 },
        possession: { a: 58,   b: 42 },
        winRate:    { a: 72,   b: 38 },
        avgAge:     { a: 26.4, b: 28.1 },
        value:      { a: 580,  b: 45 }
      },
      h2h: {
        aWins: 3, draws: 1, bWins: 1,
        last: [
          { date: '2018', comp: 'Amistoso',                  scoreA: 2, scoreB: 1 },
          { date: '2010', comp: 'Mundial · F. de grupos',    scoreA: 1, scoreB: 0 },
          { date: '2005', comp: 'Copa Confederaciones',      scoreA: 3, scoreB: 1 },
          { date: '1999', comp: 'Amistoso',                  scoreA: 1, scoreB: 1 },
          { date: '1997', comp: 'Copa de Oro',               scoreA: 1, scoreB: 2 }
        ]
      },
      league: {
        total: 32,
        pct1: 64, pctX: 22, pct2: 14,
        myPick: '1',
        topScore: { label: '2 — 1', count: 8 }
      }
    }
  };

  window.fetchMatchStats = async function(matchKey) {
    const cached = cache.get(matchKey);
    if (cached && Date.now() - cached.ts < TTL_MS) return cached.data;
    const data = MOCK_PAYLOADS[matchKey] || null;
    if (data) cache.set(matchKey, { data, ts: Date.now() });
    return data;
  };
})();
