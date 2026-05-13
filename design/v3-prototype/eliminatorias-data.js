// Bracket oficial Mundial 2026 — matchups extraídos del cuadro FIFA
// Numeración FIFA: M73-M88 (R32) · M89-M96 (R16) · M97-M100 (QF) ·
// M101-M102 (SF) · M103 (3er puesto) · M104 (Final).

window.KO_ROUNDS = [
  {
    key: 'R32',
    label: '16avos',
    short: '16',
    color: '#60a5fa',
    glow: 'rgba(96,165,250,.55)',
    matches: [
      // LEFT half (top → bottom según photo)
      { id:'M73', home:{code:'1E',      label:'1º Grupo E'},    away:{code:'3-ABCDF', label:'3º A/B/C/D/F'} },
      { id:'M74', home:{code:'1I',      label:'1º Grupo I'},    away:{code:'3-CDFGH', label:'3º C/D/F/G/H'} },
      { id:'M75', home:{code:'2A',      label:'2º Grupo A'},    away:{code:'2B',      label:'2º Grupo B'} },
      { id:'M76', home:{code:'1F',      label:'1º Grupo F'},    away:{code:'2C',      label:'2º Grupo C'} },
      { id:'M77', home:{code:'2K',      label:'2º Grupo K'},    away:{code:'2L',      label:'2º Grupo L'} },
      { id:'M78', home:{code:'1H',      label:'1º Grupo H'},    away:{code:'2J',      label:'2º Grupo J'} },
      { id:'M79', home:{code:'1D',      label:'1º Grupo D'},    away:{code:'3-BEFIJ', label:'3º B/E/F/I/J'} },
      { id:'M80', home:{code:'1G',      label:'1º Grupo G'},    away:{code:'3-AEHIJ', label:'3º A/E/H/I/J'} },
      // RIGHT half (top → bottom)
      { id:'M81', home:{code:'1C',      label:'1º Grupo C'},    away:{code:'2F',      label:'2º Grupo F'} },
      { id:'M82', home:{code:'2E',      label:'2º Grupo E'},    away:{code:'2I',      label:'2º Grupo I'} },
      { id:'M83', home:{code:'1A',      label:'1º Grupo A'},    away:{code:'3-CEFHI', label:'3º C/E/F/H/I'} },
      { id:'M84', home:{code:'1L',      label:'1º Grupo L'},    away:{code:'3-EHIJK', label:'3º E/H/I/J/K'} },
      { id:'M85', home:{code:'1J',      label:'1º Grupo J'},    away:{code:'2H',      label:'2º Grupo H'} },
      { id:'M86', home:{code:'2D',      label:'2º Grupo D'},    away:{code:'2G',      label:'2º Grupo G'} },
      { id:'M87', home:{code:'1B',      label:'1º Grupo B'},    away:{code:'3-EFGIJ', label:'3º E/F/G/I/J'} },
      { id:'M88', home:{code:'1K',      label:'1º Grupo K'},    away:{code:'3-DEIJL', label:'3º D/E/I/J/L'} }
    ]
  },
  {
    key: 'R16',
    label: '8vos',
    short: '8',
    color: '#a78bfa',
    glow: 'rgba(167,139,250,.55)',
    matches: [
      { id:'M89', home:{code:'G.M73', label:'Ganador M73'}, away:{code:'G.M74', label:'Ganador M74'} },
      { id:'M90', home:{code:'G.M75', label:'Ganador M75'}, away:{code:'G.M76', label:'Ganador M76'} },
      { id:'M91', home:{code:'G.M77', label:'Ganador M77'}, away:{code:'G.M78', label:'Ganador M78'} },
      { id:'M92', home:{code:'G.M79', label:'Ganador M79'}, away:{code:'G.M80', label:'Ganador M80'} },
      { id:'M93', home:{code:'G.M81', label:'Ganador M81'}, away:{code:'G.M82', label:'Ganador M82'} },
      { id:'M94', home:{code:'G.M83', label:'Ganador M83'}, away:{code:'G.M84', label:'Ganador M84'} },
      { id:'M95', home:{code:'G.M85', label:'Ganador M85'}, away:{code:'G.M86', label:'Ganador M86'} },
      { id:'M96', home:{code:'G.M87', label:'Ganador M87'}, away:{code:'G.M88', label:'Ganador M88'} }
    ]
  },
  {
    key: 'QF',
    label: '4tos',
    short: '4',
    color: '#fb923c',
    glow: 'rgba(251,146,60,.55)',
    matches: [
      { id:'M97',  home:{code:'G.M89', label:'Ganador M89'}, away:{code:'G.M90', label:'Ganador M90'} },
      { id:'M98',  home:{code:'G.M91', label:'Ganador M91'}, away:{code:'G.M92', label:'Ganador M92'} },
      { id:'M99',  home:{code:'G.M93', label:'Ganador M93'}, away:{code:'G.M94', label:'Ganador M94'} },
      { id:'M100', home:{code:'G.M95', label:'Ganador M95'}, away:{code:'G.M96', label:'Ganador M96'} }
    ]
  },
  {
    key: 'SF',
    label: 'Semis',
    short: 'SF',
    color: '#c4f046',
    glow: 'rgba(196,240,70,.55)',
    matches: [
      { id:'M101', home:{code:'G.M97',  label:'Ganador M97'},  away:{code:'G.M98',  label:'Ganador M98'} },
      { id:'M102', home:{code:'G.M99',  label:'Ganador M99'},  away:{code:'G.M100', label:'Ganador M100'} }
    ]
  },
  {
    key: 'F',
    label: 'Final',
    short: 'F',
    color: '#C9A961',
    glow: 'rgba(201,169,97,.6)',
    matches: [
      { id:'M104', kind:'final', home:{code:'G.M101', label:'Ganador SF 1'}, away:{code:'G.M102', label:'Ganador SF 2'} },
      { id:'M103', kind:'third', home:{code:'P.M101', label:'Perdedor SF 1'}, away:{code:'P.M102', label:'Perdedor SF 2'} }
    ]
  }
];
