/* ============================================================================
 * predictor-ranks.js — Sistema de rangos del Predictor (10 niveles lineales)
 *
 * Reemplaza placeholder "NIVEL 12" del mockup. Calcula a partir de los puntos
 * totales del usuario en la liga visualizada.
 *
 * Uso:
 *   var rank = getRank(1450);
 *   // → { idx: 7, name: "Profeta", phrase: "...", threshold_next: 2100, pts_to_next: 650 }
 *
 * Niveles:
 *   1 Chupetín            0–99
 *   2 Sotanita            100–199
 *   3 Pipero              200–324
 *   4 Cuchara de madera   325–449
 *   5 Forofo              450–849
 *   6 Crack               850–1399
 *   7 Profeta             1400–2099
 *   8 Oráculo             2100–2999
 *   9 Sabio del VAR       3000–3999
 *  10 Maestro Mundialista 4000+
 *
 * Para nivel 10, threshold_next y pts_to_next devuelven null.
 * ========================================================================== */

var PREDICTOR_RANKS = [
  { idx: 1,  name: "Chupetín",            min: 0,    phrase: "No has visto un balón de futbol en tu vida, Hulio" },
  { idx: 2,  name: "Sotanita",            min: 100,  phrase: "Tus pronósticos están para no verlos…" },
  { idx: 3,  name: "Pipero",              min: 200,  phrase: "Grefusito es tu compañero de grada" },
  { idx: 4,  name: "Cuchara de madera",   min: 325,  phrase: "Ni pinchas ni cortas" },
  { idx: 5,  name: "Forofo",              min: 450,  phrase: "Te sabes el 11 titular de Marruecos" },
  { idx: 6,  name: "Crack",               min: 850,  phrase: "El grupo te pide consejo antes de pronosticar" },
  { idx: 7,  name: "Profeta",             min: 1400, phrase: "Florentino tiene una servilleta preparada para ti…" },
  { idx: 8,  name: "Oráculo",             min: 2100, phrase: "La IA te tiene miedo" },
  { idx: 9,  name: "Sabio del VAR",       min: 3000, phrase: "Ves los goles antes de que pasen" },
  { idx: 10, name: "Maestro Mundialista", min: 4000, phrase: "El Mundial se escribe con tu nombre" }
];

function getRank(pts) {
  var p = Number(pts);
  if (!isFinite(p) || p < 0) p = 0;

  // Buscar el rango más alto cuyo min <= p
  var current = PREDICTOR_RANKS[0];
  for (var i = 0; i < PREDICTOR_RANKS.length; i++) {
    if (p >= PREDICTOR_RANKS[i].min) {
      current = PREDICTOR_RANKS[i];
    } else {
      break;
    }
  }

  var nextRank = PREDICTOR_RANKS[current.idx]; // current.idx es 1-based, array 0-based ⇒ siguiente
  var threshold_next = nextRank ? nextRank.min : null;
  var pts_to_next = nextRank ? Math.max(0, nextRank.min - p) : null;

  return {
    idx: current.idx,
    name: current.name,
    phrase: current.phrase,
    threshold_next: threshold_next,
    pts_to_next: pts_to_next
  };
}

// Exposición global (classic script: const/let no se exponen, var sí, pero asignamos explícito)
window.getRank = getRank;
window.PREDICTOR_RANKS = PREDICTOR_RANKS;
