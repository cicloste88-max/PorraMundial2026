// matcher.mjs — fixture de grupos + matching bidireccional (módulo PURO, sin
// Deno APIs; patrón select.mjs de get-league-highlights para que node --test
// lo importe tal cual).
//
// GROUP_MATCHES fija la orientación CANÓNICA de la app: la misma que usan las
// keys de results.match_results (`{grupo}_{local}_{visitante}`) y las
// predicciones. El fixture oficial puede venir invertido — caso real:
// wc2026_gC_15186861 (Brasil-Escocia J3, teams_swapped=true; football-data
// sigue el fixture oficial con Escocia de local). El matching es
// bidireccional: orientación directa primero y, si falla, la inversa GIRANDO
// el marcador para que `l` siga siendo el local de la app bajo la key
// canónica. Sin esto, el partido se saltaba EN SILENCIO (audit 11-jun).
//
// Smoke: tests/update-results-matcher.test.mjs (node --test, CI).

export const GROUP_MATCHES = [
  { group: "A", home: "México", away: "Sudáfrica" },
  { group: "A", home: "República de Corea", away: "República Checa" },
  { group: "A", home: "República Checa", away: "Sudáfrica" },
  { group: "A", home: "México", away: "República de Corea" },
  { group: "A", home: "República Checa", away: "México" },
  { group: "A", home: "Sudáfrica", away: "República de Corea" },
  { group: "B", home: "Canadá", away: "Bosnia y Herzegovina" },
  { group: "B", home: "Catar", away: "Suiza" },
  { group: "B", home: "Suiza", away: "Bosnia y Herzegovina" },
  { group: "B", home: "Canadá", away: "Catar" },
  { group: "B", home: "Suiza", away: "Canadá" },
  { group: "B", home: "Bosnia y Herzegovina", away: "Catar" },
  { group: "C", home: "Brasil", away: "Marruecos" },
  { group: "C", home: "Haití", away: "Escocia" },
  { group: "C", home: "Escocia", away: "Marruecos" },
  { group: "C", home: "Brasil", away: "Haití" },
  { group: "C", home: "Brasil", away: "Escocia" },
  { group: "C", home: "Marruecos", away: "Haití" },
  { group: "D", home: "Estados Unidos", away: "Paraguay" },
  { group: "D", home: "Australia", away: "Turquía" },
  { group: "D", home: "Estados Unidos", away: "Australia" },
  { group: "D", home: "Turquía", away: "Paraguay" },
  { group: "D", home: "Turquía", away: "Estados Unidos" },
  { group: "D", home: "Paraguay", away: "Australia" },
  { group: "E", home: "Alemania", away: "Curazao" },
  { group: "E", home: "Costa de Marfil", away: "Ecuador" },
  { group: "E", home: "Alemania", away: "Costa de Marfil" },
  { group: "E", home: "Ecuador", away: "Curazao" },
  { group: "E", home: "Curazao", away: "Costa de Marfil" },
  { group: "E", home: "Ecuador", away: "Alemania" },
  { group: "F", home: "Países Bajos", away: "Japón" },
  { group: "F", home: "Suecia", away: "Túnez" },
  { group: "F", home: "Países Bajos", away: "Suecia" },
  { group: "F", home: "Túnez", away: "Japón" },
  { group: "F", home: "Japón", away: "Suecia" },
  { group: "F", home: "Túnez", away: "Países Bajos" },
  { group: "G", home: "Bélgica", away: "Egipto" },
  { group: "G", home: "RI de Irán", away: "Nueva Zelanda" },
  { group: "G", home: "Bélgica", away: "RI de Irán" },
  { group: "G", home: "Nueva Zelanda", away: "Egipto" },
  { group: "G", home: "Egipto", away: "RI de Irán" },
  { group: "G", home: "Nueva Zelanda", away: "Bélgica" },
  { group: "H", home: "España", away: "Cabo Verde" },
  { group: "H", home: "Arabia Saudí", away: "Uruguay" },
  { group: "H", home: "España", away: "Arabia Saudí" },
  { group: "H", home: "Uruguay", away: "Cabo Verde" },
  { group: "H", home: "Cabo Verde", away: "Arabia Saudí" },
  { group: "H", home: "Uruguay", away: "España" },
  { group: "I", home: "Francia", away: "Senegal" },
  { group: "I", home: "Colombia", away: "Jordania" },
  { group: "I", home: "Francia", away: "Colombia" },
  { group: "I", home: "Senegal", away: "Jordania" },
  { group: "I", home: "Colombia", away: "Senegal" },
  { group: "I", home: "Jordania", away: "Francia" },
  { group: "J", home: "Inglaterra", away: "Panamá" },
  { group: "J", home: "Argentina", away: "Irak" },
  { group: "J", home: "Argentina", away: "Panamá" },
  { group: "J", home: "Inglaterra", away: "Irak" },
  { group: "J", home: "Panamá", away: "Irak" },
  { group: "J", home: "Argentina", away: "Inglaterra" },
  { group: "K", home: "Portugal", away: "Uzbekistán" },
  { group: "K", home: "Austria", away: "RD Congo" },
  { group: "K", home: "Portugal", away: "Austria" },
  { group: "K", home: "Uzbekistán", away: "RD Congo" },
  { group: "K", home: "Austria", away: "Uzbekistán" },
  { group: "K", home: "RD Congo", away: "Portugal" },
  { group: "L", home: "Croacia", away: "Argelia" },
  { group: "L", home: "Noruega", away: "Ghana" },
  { group: "L", home: "Noruega", away: "Argelia" },
  { group: "L", home: "Croacia", away: "Ghana" },
  { group: "L", home: "Ghana", away: "Argelia" },
  { group: "L", home: "Noruega", away: "Croacia" },
];

export function getMatchKey(group, home, away) {
  return `${group}_${home}_${away}`;
}

// Resuelve un partido de grupos (nombres ya en convención app) contra
// GROUP_MATCHES en ambas orientaciones.
// → { key, l, v, swapped } con key canónica app y l/v en orientación app,
//   o null si el par no es un fixture de grupos (el caller decide loguear).
export function resolveGroupResult(homeApp, awayApp, scoreHome, scoreAway) {
  const direct = GROUP_MATCHES.find((gm) => gm.home === homeApp && gm.away === awayApp);
  if (direct) {
    return {
      key: getMatchKey(direct.group, direct.home, direct.away),
      l: scoreHome,
      v: scoreAway,
      swapped: false,
    };
  }
  const inverted = GROUP_MATCHES.find((gm) => gm.home === awayApp && gm.away === homeApp);
  if (inverted) {
    return {
      key: getMatchKey(inverted.group, inverted.home, inverted.away),
      l: scoreAway,
      v: scoreHome,
      swapped: true,
    };
  }
  return null;
}
