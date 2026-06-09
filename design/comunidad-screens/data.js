/* Datos mock para las pantallas de comunidad y porra de un jugador.
   Puntuación oficial (NORMAS_PUNTUACION.md) — 4 chips que apilan por partido:
     Signo +1 · vs IA +1 · Goleador +2 · Resultado exacto +3  (máx base 7)
     BOOST ×2 si se cumplen los 4 chips (excepción 0-0: goleador auto-OK). */
(function () {
  'use strict';

  window.PC = {
    match: {
      home: { name: 'Francia', code: 'FRA' },
      away: { name: 'España',  code: 'ESP' },
      eyebrow: 'Jornada 2 · Grupo F · Partido 3',
      time: 'JUE · 18 JUN · 21:00',
      stadium: 'MetLife Stadium · East Rutherford',
      real: { home: 2, away: 1 },
    },

    league: {
      name: 'Biwenger Team',
      total: 24,
      sign: { p1: 54, pX: 21, p2: 25 },
      myPick: '1',
      myScore: { home: 2, away: 1 },
      youName: 'Marc',
      scores: [
        { home: 2, away: 1, count: 6, players: ['Marc', 'Carlos M.', 'Laura P.', 'Dani R.', 'Javi S.', 'Marta L.'] },
        { home: 1, away: 0, count: 4, players: ['Edu', 'Sergio', 'Ana G.', 'Pau'] },
        { home: 2, away: 0, count: 3, players: ['Iván', 'Rubén', 'Clara'] },
        { home: 1, away: 1, count: 3, players: ['Marcos', 'Lucía', 'Hugo'] },
        { home: 0, away: 1, count: 2, players: ['Alba', 'Diego'] },
        { home: 1, away: 2, count: 2, players: ['Sara', 'Bruno'] },
        { home: 3, away: 1, count: 2, players: ['Pablo', 'Noa'] },
        { home: 2, away: 2, count: 1, players: ['Elena'] },
        { home: 0, away: 0, count: 1, players: ['Víctor'] },
      ],
      boosted: ['Marc', 'Sergio', 'Pablo'],
    },

    global: { total: 128412, sign: { winner: '1', pct: 58 }, topScore: { home: 2, away: 1, pct: 14 } },
    ia: { sign: '1', score: { home: 2, away: 1 }, confidence: 64 },
  };

  // ── Porra completa de un jugador (todo el torneo, agrupado por jornada/fase) ──
  // En partidos 'final': gol = acertó goleador · iaDiff = su signo ≠ IA (chip vs IA).
  window.PC.userCard = {
    user: { name: 'Marc', initials: 'M', league: 'Biwenger Team' },
    rank: 3, totalPlayers: 24,
    jornadas: [
      {
        id: 'j1', label: 'Jornada 1', short: 'J1', dates: '14–17 JUN', state: 'done',
        matches: [
          { home: { n: 'Francia', c: 'FRA' }, away: { n: 'Inglaterra', c: 'ENG' }, time: 'SÁB 14 · 18:00', phase: 'final', pred: { h: 2, a: 1 }, real: { h: 2, a: 0 }, scorer: 'Mbappé', gol: true, iaDiff: true },
          { home: { n: 'Alemania', c: 'GER' }, away: { n: 'México', c: 'MEX' }, time: 'SÁB 14 · 21:00', phase: 'final', pred: { h: 2, a: 0 }, real: { h: 1, a: 1 }, scorer: 'Musiala', gol: false, iaDiff: false },
          { home: { n: 'Brasil', c: 'BRA' }, away: { n: 'Japón', c: 'JPN' }, time: 'DOM 15 · 18:00', phase: 'final', pred: { h: 3, a: 0 }, real: { h: 3, a: 0 }, boost: true, scorer: 'Vinícius', gol: true, iaDiff: true },
          { home: { n: 'España', c: 'ESP' }, away: { n: 'Croacia', c: 'CRO' }, time: 'DOM 15 · 21:00', phase: 'final', pred: { h: 2, a: 1 }, real: { h: 2, a: 1 }, scorer: 'Yamal', gol: true, iaDiff: false },
          { home: { n: 'P. Bajos', c: 'NED' }, away: { n: 'Portugal', c: 'POR' }, time: 'LUN 16 · 21:00', phase: 'final', pred: { h: 1, a: 1 }, real: { h: 0, a: 2 }, scorer: 'Gakpo', gol: false, iaDiff: false },
          { home: { n: 'Argentina', c: 'ARG' }, away: { n: 'Marruecos', c: 'MAR' }, time: 'MAR 17 · 18:00', phase: 'final', pred: { h: 2, a: 0 }, real: { h: 2, a: 0 }, scorer: 'Messi', gol: false, iaDiff: true },
        ],
      },
      {
        id: 'j2', label: 'Jornada 2', short: 'J2', dates: '18–20 JUN', state: 'live',
        matches: [
          { home: { n: 'Argentina', c: 'ARG' }, away: { n: 'Croacia', c: 'CRO' }, time: 'JUE 18 · 18:00', phase: 'final', pred: { h: 2, a: 0 }, real: { h: 2, a: 1 }, scorer: 'Messi', gol: true, iaDiff: true },
          { home: { n: 'Francia', c: 'FRA' }, away: { n: 'España', c: 'ESP' }, time: 'JUE 18 · 21:00', phase: 'final', pred: { h: 2, a: 1 }, real: { h: 2, a: 1 }, boost: true, scorer: 'Mbappé', gol: true, iaDiff: true },
          { home: { n: 'Brasil', c: 'BRA' }, away: { n: 'Inglaterra', c: 'ENG' }, time: 'VIE 19 · 21:00', phase: 'final', pred: { h: 1, a: 1 }, real: { h: 2, a: 0 }, scorer: 'Vinícius', gol: false, iaDiff: false },
          { home: { n: 'Portugal', c: 'POR' }, away: { n: 'Marruecos', c: 'MAR' }, time: '64\u2032', phase: 'live', pred: { h: 2, a: 0 }, real: { h: 1, a: 0 }, live: { h: 1, a: 0 }, scorer: 'Ronaldo' },
          { home: { n: 'Alemania', c: 'GER' }, away: { n: 'Japón', c: 'JPN' }, time: 'SÁB 20 · 18:00', phase: 'pre', pred: { h: 3, a: 1 }, real: null, scorer: 'Musiala' },
          { home: { n: 'P. Bajos', c: 'NED' }, away: { n: 'México', c: 'MEX' }, time: 'SÁB 20 · 21:00', phase: 'pre', pred: { h: 1, a: 1 }, real: null, scorer: 'Gakpo' },
        ],
      },
      {
        id: 'j3', label: 'Jornada 3', short: 'J3', dates: '24–27 JUN', state: 'upcoming',
        matches: [
          { home: { n: 'España', c: 'ESP' }, away: { n: 'Francia', c: 'FRA' }, time: 'MIÉ 24 · 21:00', phase: 'pre', pred: { h: 1, a: 2 }, real: null, scorer: 'Mbappé' },
          { home: { n: 'Brasil', c: 'BRA' }, away: { n: 'Argentina', c: 'ARG' }, time: 'MIÉ 24 · 21:00', phase: 'pre', pred: { h: 1, a: 1 }, real: null, scorer: 'Vinícius' },
          { home: { n: 'Alemania', c: 'GER' }, away: { n: 'Inglaterra', c: 'ENG' }, time: 'JUE 25 · 18:00', phase: 'pre', pred: { h: 2, a: 1 }, real: null, scorer: 'Wirtz' },
          { home: { n: 'Portugal', c: 'POR' }, away: { n: 'P. Bajos', c: 'NED' }, time: 'JUE 25 · 21:00', phase: 'pre', pred: { h: 2, a: 2 }, real: null, scorer: 'Ronaldo' },
          { home: { n: 'México', c: 'MEX' }, away: { n: 'Japón', c: 'JPN' }, time: 'VIE 26 · 18:00', phase: 'pre', pred: { h: 1, a: 0 }, real: null, scorer: 'Giménez' },
          { home: { n: 'Croacia', c: 'CRO' }, away: { n: 'Marruecos', c: 'MAR' }, time: 'VIE 26 · 21:00', phase: 'pre', pred: { h: 2, a: 0 }, real: null, scorer: 'Kramarić' },
        ],
      },
      {
        id: 'r16', label: 'Octavos', short: '8vos', dates: '28 JUN–1 JUL', state: 'upcoming',
        matches: [
          { home: { n: 'Francia', c: 'FRA' }, away: { n: 'México', c: 'MEX' }, time: 'Octavos de final', phase: 'pre', pred: { h: 2, a: 0 }, real: null, scorer: 'Mbappé' },
          { home: { n: 'Brasil', c: 'BRA' }, away: { n: 'Japón', c: 'JPN' }, time: 'Octavos de final', phase: 'pre', pred: { h: 3, a: 1 }, real: null, scorer: 'Vinícius' },
          { home: { n: 'España', c: 'ESP' }, away: { n: 'Croacia', c: 'CRO' }, time: 'Octavos de final', phase: 'pre', pred: { h: 2, a: 1 }, real: null, scorer: 'Yamal' },
          { home: { n: 'Argentina', c: 'ARG' }, away: { n: 'P. Bajos', c: 'NED' }, time: 'Octavos de final', phase: 'pre', pred: { h: 2, a: 1 }, real: null, scorer: 'Messi' },
        ],
      },
      {
        id: 'qf', label: 'Cuartos', short: '4tos', dates: '3–4 JUL', state: 'upcoming',
        matches: [
          { home: { n: 'Francia', c: 'FRA' }, away: { n: 'Brasil', c: 'BRA' }, time: 'Cuartos de final', phase: 'pre', pred: { h: 1, a: 2 }, real: null, scorer: 'Vinícius' },
          { home: { n: 'España', c: 'ESP' }, away: { n: 'Argentina', c: 'ARG' }, time: 'Cuartos de final', phase: 'pre', pred: { h: 2, a: 1 }, real: null, scorer: 'Yamal' },
          { home: { n: 'Alemania', c: 'GER' }, away: { n: 'Portugal', c: 'POR' }, time: 'Cuartos de final', phase: 'pre', pred: { h: 2, a: 1 }, real: null, scorer: 'Musiala' },
          { home: { n: 'Inglaterra', c: 'ENG' }, away: { n: 'P. Bajos', c: 'NED' }, time: 'Cuartos de final', phase: 'pre', pred: { h: 1, a: 0 }, real: null, scorer: 'Bellingham' },
        ],
      },
      {
        id: 'sf', label: 'Semifinales', short: 'Semis', dates: '7–8 JUL', state: 'upcoming',
        matches: [
          { home: { n: 'Brasil', c: 'BRA' }, away: { n: 'Argentina', c: 'ARG' }, time: 'Semifinal', phase: 'pre', pred: { h: 2, a: 1 }, real: null, scorer: 'Vinícius' },
          { home: { n: 'Alemania', c: 'GER' }, away: { n: 'España', c: 'ESP' }, time: 'Semifinal', phase: 'pre', pred: { h: 1, a: 2 }, real: null, scorer: 'Yamal' },
        ],
      },
      {
        id: 'final', label: 'Final', short: 'Final', dates: '12 JUL', state: 'upcoming',
        matches: [
          { home: { n: 'Brasil', c: 'BRA' }, away: { n: 'España', c: 'ESP' }, time: 'Final · MetLife', phase: 'pre', pred: { h: 2, a: 1 }, real: null, scorer: 'Yamal' },
        ],
      },
    ],
  };

  // ── helpers compartidos ──
  window.PCutil = {
    signOf(h, a) { return h > a ? '1' : h < a ? '2' : 'X'; },
    label(h, a) { return h + '–' + a; },
    fmt(n) { return n.toLocaleString('es-ES'); },
    signText(s, home, away) {
      return s === '1' ? home + ' gana' : s === '2' ? away + ' gana' : 'Empate';
    },

    // 4 chips oficiales de un partido resuelto (m con pred/real + gol/iaDiff).
    // ref = marcador a evaluar (real o live). Devuelve los 4 chips, base y total.
    chips(m, ref) {
      const r = ref || m.real;
      const ps = this.signOf(m.pred.h, m.pred.a), rs = this.signOf(r.h, r.a);
      const signo = ps === rs;
      const exact = m.pred.h === r.h && m.pred.a === r.a;
      const gol = !!m.gol;
      const vsIA = !!m.iaDiff && signo;
      let base = (signo ? 1 : 0) + (vsIA ? 1 : 0) + (gol ? 2 : 0) + (exact ? 3 : 0);
      base = Math.min(base, 7);
      const isZeroZero = m.pred.h === 0 && m.pred.a === 0;
      const allChips = signo && exact && vsIA && (gol || isZeroZero);
      const boosted = !!m.boost && allChips;
      return { signo, vsIA, gol, exact, base, pts: boosted ? base * 2 : base, boosted };
    },

    // aplana scores[] → [{name, home, away, sign, you, boost}]
    flatUsers(lg) {
      const out = [];
      lg.scores.forEach(s => s.players.forEach(name => out.push({
        name, home: s.home, away: s.away,
        sign: (s.home > s.away ? '1' : s.home < s.away ? '2' : 'X'),
        you: name === lg.youName,
        boost: (lg.boosted || []).includes(name),
      })));
      return out;
    },
  };
})();
