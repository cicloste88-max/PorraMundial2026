// Datos de los 12 grupos del Mundial 2026 (formato móvil compacto)
// code = código FIFA de 3 letras

window.GROUPS = [
  { letter: "A", color: "#34d399", glow: "rgba(52,211,153,.55)",
    teams: [
      { name: "MEXICO",          code: "MEX", flag: "Mexico" },
      { name: "SOUTH AFRICA",    code: "RSA", flag: "SouthAfrica" },
      { name: "KOREA REPUBLIC",  code: "KOR", flag: "KoreaRepublic" },
      { name: "CZECHIA",         code: "CZE", flag: "Czechia" }
    ]},
  { letter: "B", color: "#f87171", glow: "rgba(248,113,113,.55)",
    teams: [
      { name: "CANADA",                 code: "CAN", flag: "Canada" },
      { name: "BOSNIA AND HERZEGOVINA", code: "BIH", flag: "Bosnia" },
      { name: "QATAR",                  code: "QAT", flag: "Qatar" },
      { name: "SWITZERLAND",            code: "SUI", flag: "Switzerland" }
    ]},
  { letter: "C", color: "#fb923c", glow: "rgba(251,146,60,.55)",
    teams: [
      { name: "BRAZIL",   code: "BRA", flag: "Brazil" },
      { name: "MOROCCO",  code: "MAR", flag: "Morocco" },
      { name: "HAITI",    code: "HAI", flag: "Haiti" },
      { name: "SCOTLAND", code: "SCO", flag: "Scotland" }
    ]},
  { letter: "D", color: "#60a5fa", glow: "rgba(96,165,250,.55)",
    teams: [
      { name: "USA",       code: "USA", flag: "USA" },
      { name: "PARAGUAY",  code: "PAR", flag: "Paraguay" },
      { name: "AUSTRALIA", code: "AUS", flag: "Australia" },
      { name: "TÜRKIYE",   code: "TUR", flag: "Turkiye" }
    ]},
  { letter: "E", color: "#a78bfa", glow: "rgba(167,139,250,.55)",
    teams: [
      { name: "GERMANY",       code: "GER", flag: "Germany" },
      { name: "CURAÇAO",       code: "CUW", flag: "Curacao" },
      { name: "CÔTE D'IVOIRE", code: "CIV", flag: "CoteIvoire" },
      { name: "ECUADOR",       code: "ECU", flag: "Ecuador" }
    ]},
  { letter: "F", color: "#a3e635", glow: "rgba(163,230,53,.55)",
    teams: [
      { name: "NETHERLANDS", code: "NED", flag: "Netherlands" },
      { name: "JAPAN",       code: "JPN", flag: "Japan" },
      { name: "SWEDEN",      code: "SWE", flag: "Sweden" },
      { name: "TUNISIA",     code: "TUN", flag: "Tunisia" }
    ]},
  { letter: "G", color: "#f472b6", glow: "rgba(244,114,182,.55)",
    teams: [
      { name: "BELGIUM",     code: "BEL", flag: "Belgium" },
      { name: "EGYPT",       code: "EGY", flag: "Egypt" },
      { name: "IR IRAN",     code: "IRN", flag: "Iran" },
      { name: "NEW ZEALAND", code: "NZL", flag: "NewZealand" }
    ]},
  { letter: "H", color: "#5eead4", glow: "rgba(94,234,212,.55)",
    teams: [
      { name: "SPAIN",        code: "ESP", flag: "Spain" },
      { name: "CABO VERDE",   code: "CPV", flag: "CaboVerde" },
      { name: "SAUDI ARABIA", code: "KSA", flag: "SaudiArabia" },
      { name: "URUGUAY",      code: "URU", flag: "Uruguay" }
    ]},
  { letter: "I", color: "#c084fc", glow: "rgba(192,132,252,.55)",
    teams: [
      { name: "FRANCE",  code: "FRA", flag: "France" },
      { name: "SENEGAL", code: "SEN", flag: "Senegal" },
      { name: "IRAQ",    code: "IRQ", flag: "Iraq" },
      { name: "NORWAY",  code: "NOR", flag: "Norway" }
    ]},
  { letter: "J", color: "#94a3b8", glow: "rgba(148,163,184,.55)",
    teams: [
      { name: "ARGENTINA", code: "ARG", flag: "Argentina" },
      { name: "ALGERIA",   code: "ALG", flag: "Algeria" },
      { name: "AUSTRIA",   code: "AUT", flag: "Austria" },
      { name: "JORDAN",    code: "JOR", flag: "Jordan" }
    ]},
  { letter: "K", color: "#fb7185", glow: "rgba(251,113,133,.55)",
    teams: [
      { name: "PORTUGAL",   code: "POR", flag: "Portugal" },
      { name: "CONGO DR",   code: "COD", flag: "CongoDR" },
      { name: "UZBEKISTAN", code: "UZB", flag: "Uzbekistan" },
      { name: "COLOMBIA",   code: "COL", flag: "Colombia" }
    ]},
  { letter: "L", color: "#38bdf8", glow: "rgba(56,189,248,.55)",
    teams: [
      { name: "ENGLAND",  code: "ENG", flag: "England" },
      { name: "CROATIA",  code: "CRO", flag: "Croatia" },
      { name: "GHANA",    code: "GHA", flag: "Ghana" },
      { name: "PANAMA",   code: "PAN", flag: "Panama" }
    ]}
];

// Round-robin para 4 equipos → 6 partidos
window.PAIRINGS = [
  [0,1],[2,3], // J1
  [0,2],[1,3], // J2
  [0,3],[1,2]  // J3
];

window.MATCH_DAY = ["J1","J1","J2","J2","J3","J3"];
