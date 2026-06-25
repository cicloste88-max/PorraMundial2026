/* ============================================================================
 * predictor-ranks.js — Sistema de rangos del Predictor (10 niveles)
 *
 * Reemplaza placeholder "NIVEL 12" del mockup. Calcula a partir de los puntos
 * totales del usuario en la liga visualizada.
 *
 * Uso:
 *   var rank = getRank(95);
 *   // → { idx: 5, name: "Forofo", phrase: "...", threshold_next: 100, pts_to_next: 5 }
 *
 * Niveles (recalibrados 25-jun-2026 a la escala real del torneo):
 *   1 Chupetín            0–44
 *   2 Sotanita            45–67
 *   3 Pipero              68–79
 *   4 Cuchara de madera   80–87
 *   5 Forofo              88–99
 *   6 Crack               100–129
 *   7 Profeta             130–174
 *   8 Oráculo             175–224
 *   9 Sabio del VAR       225–299
 *  10 Maestro Mundialista 300+
 *
 * Calibración: a mitad de grupos el líder ronda 112 pts y la mediana 84
 * (n=42, ligas Gallos+Tilín); proyección fin de torneo del líder ~300
 * (grupos ~120 + bonus de avance KO). Umbrales anteriores (0/100/200/325/
 * 450/850/1400/2100/3000/4000) dejaban al ~90% en Chupetín toda la porra.
 *
 * Para nivel 10, threshold_next y pts_to_next devuelven null.
 * ========================================================================== */

var PREDICTOR_RANKS = [
  { idx: 1,  name: "Chupetín",            min: 0,   phrase: "No has visto un balón de futbol en tu vida, Hulio" },
  { idx: 2,  name: "Sotanita",            min: 45,  phrase: "Tus pronósticos están para no verlos…" },
  { idx: 3,  name: "Pipero",              min: 68,  phrase: "Grefusito es tu compañero de grada" },
  { idx: 4,  name: "Cuchara de madera",   min: 80,  phrase: "Ni pinchas ni cortas" },
  { idx: 5,  name: "Forofo",              min: 88,  phrase: "Te sabes el 11 titular de Marruecos" },
  { idx: 6,  name: "Crack",               min: 100, phrase: "El grupo te pide consejo antes de pronosticar" },
  { idx: 7,  name: "Profeta",             min: 130, phrase: "Florentino tiene una servilleta preparada para ti…" },
  { idx: 8,  name: "Oráculo",             min: 175, phrase: "La IA te tiene miedo" },
  { idx: 9,  name: "Sabio del VAR",       min: 225, phrase: "Ves los goles antes de que pasen" },
  { idx: 10, name: "Maestro Mundialista", min: 300, phrase: "El Mundial se escribe con tu nombre" }
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
