// Constantes de los 48 mundialistas WC2026.
//
// Extraído de index.ts v6 (el mismo array que usan scrape_h2h y scrape_last5
// para resolver rivales por opposition_name en 11v11.com).
//
// Tupla: [iso3, owner_slug (kebab-lowercase), opposition_name (capitalizado),
//         display_name (nombre visible al usuario)].

export const WC2026_TEAMS: Array<[string, string, string, string]> = [
  ["ALG", "algeria", "Algeria", "Algeria"],
  ["ARG", "argentina", "Argentina", "Argentina"],
  ["AUS", "australia", "Australia", "Australia"],
  ["AUT", "austria", "Austria", "Austria"],
  ["BEL", "belgium", "Belgium", "Belgium"],
  ["BIH", "bosnia-and-herzegovina", "Bosnia and Herzegovina", "Bosnia and Herzegovina"],
  ["BRA", "brazil", "Brazil", "Brazil"],
  ["CPV", "cape-verde-islands", "Cape Verde Islands", "Cabo Verde"],
  ["CAN", "canada", "Canada", "Canada"],
  ["COL", "colombia", "Colombia", "Colombia"],
  ["CIV", "ivory-coast", "Ivory Coast", "Côte d'Ivoire"],
  ["CRO", "croatia", "Croatia", "Croatia"],
  ["CUW", "curacao", "Curacao", "Curaçao"],
  ["CZE", "czech-republic", "Czech Republic", "Czechia"],
  ["COD", "congo-dr", "Congo DR", "DR Congo"],
  ["ECU", "ecuador", "Ecuador", "Ecuador"],
  ["EGY", "egypt", "Egypt", "Egypt"],
  ["ENG", "england", "England", "England"],
  ["FRA", "france", "France", "France"],
  ["GER", "germany", "Germany", "Germany"],
  ["GHA", "ghana", "Ghana", "Ghana"],
  ["HAI", "haiti", "Haiti", "Haiti"],
  ["IRN", "iran", "Iran", "Iran"],
  ["IRQ", "iraq", "Iraq", "Iraq"],
  ["JPN", "japan", "Japan", "Japan"],
  ["JOR", "jordan", "Jordan", "Jordan"],
  ["MEX", "mexico", "Mexico", "Mexico"],
  ["MAR", "morocco", "Morocco", "Morocco"],
  ["NED", "netherlands", "Netherlands", "Netherlands"],
  ["NZL", "new-zealand", "New Zealand", "New Zealand"],
  ["NOR", "norway", "Norway", "Norway"],
  ["PAN", "panama", "Panama", "Panama"],
  ["PAR", "paraguay", "Paraguay", "Paraguay"],
  ["POR", "portugal", "Portugal", "Portugal"],
  ["QAT", "qatar", "Qatar", "Qatar"],
  ["KSA", "saudi-arabia", "Saudi Arabia", "Saudi Arabia"],
  ["SCO", "scotland", "Scotland", "Scotland"],
  ["SEN", "senegal", "Senegal", "Senegal"],
  ["RSA", "south-africa", "South Africa", "South Africa"],
  ["KOR", "korea-republic", "Korea Republic", "South Korea"],
  ["ESP", "spain", "Spain", "Spain"],
  ["SWE", "sweden", "Sweden", "Sweden"],
  ["SUI", "switzerland", "Switzerland", "Switzerland"],
  ["TUN", "tunisia", "Tunisia", "Tunisia"],
  ["TUR", "turkey", "Turkey", "Türkiye"],
  ["URU", "uruguay", "Uruguay", "Uruguay"],
  ["USA", "usa", "USA", "USA"],
  ["UZB", "uzbekistan", "Uzbekistan", "Uzbekistan"],
];

// Set de ISO3 para lookups O(1).
export const WC2026_ISO3: Set<string> = new Set(WC2026_TEAMS.map((t) => t[0]));

// Nombres en español para el prompt del quipGenerator (spec §7.6).
export const TEAM_NAMES_ES: Record<string, string> = {
  ALG: "Argelia",
  ARG: "Argentina",
  AUS: "Australia",
  AUT: "Austria",
  BEL: "Bélgica",
  BIH: "Bosnia",
  BRA: "Brasil",
  CAN: "Canadá",
  CIV: "Costa de Marfil",
  COD: "RD del Congo",
  COL: "Colombia",
  CPV: "Cabo Verde",
  CRO: "Croacia",
  CUW: "Curaçao",
  CZE: "Chequia",
  ECU: "Ecuador",
  EGY: "Egipto",
  ENG: "Inglaterra",
  ESP: "España",
  FRA: "Francia",
  GER: "Alemania",
  GHA: "Ghana",
  HAI: "Haití",
  IRN: "Irán",
  IRQ: "Irak",
  JPN: "Japón",
  JOR: "Jordania",
  KOR: "Corea del Sur",
  KSA: "Arabia Saudí",
  MAR: "Marruecos",
  MEX: "México",
  NED: "Países Bajos",
  NOR: "Noruega",
  NZL: "Nueva Zelanda",
  PAN: "Panamá",
  PAR: "Paraguay",
  POR: "Portugal",
  QAT: "Qatar",
  RSA: "Sudáfrica",
  SCO: "Escocia",
  SEN: "Senegal",
  SUI: "Suiza",
  SWE: "Suecia",
  TUN: "Túnez",
  TUR: "Turquía",
  URU: "Uruguay",
  USA: "Estados Unidos",
  UZB: "Uzbekistán",
};

// Resolución amigable de iso3 → display_name (preserva las tildes/diacríticos
// que WC2026_TEAMS usa en la 4ª columna, p.ej. "Türkiye", "Côte d'Ivoire").
export function displayName(iso3: string): string {
  const row = WC2026_TEAMS.find((t) => t[0] === iso3);
  return row ? row[3] : iso3;
}

// Lookup inverso nombre → iso3. Prueba el display_name (columna 4) primero,
// luego opposition_name (columna 3), luego alias conocidos de divergencias
// reales entre public/data/worldcup-2026-matches.json y WC2026_TEAMS.
// Devuelve null si no encuentra — el caller decide si es warning o blocker.
const NAME_ALIASES_TO_ISO3: Record<string, string> = {
  // matches JSON usa "&", WC2026_TEAMS usa "and".
  "Bosnia & Herzegovina": "BIH",
};

export function resolveIso3(name: string): string | null {
  if (!name) return null;
  const alias = NAME_ALIASES_TO_ISO3[name];
  if (alias) return alias;
  const byDisplay = WC2026_TEAMS.find((t) => t[3] === name);
  if (byDisplay) return byDisplay[0];
  const byOpposition = WC2026_TEAMS.find((t) => t[2] === name);
  if (byOpposition) return byOpposition[0];
  return null;
}
