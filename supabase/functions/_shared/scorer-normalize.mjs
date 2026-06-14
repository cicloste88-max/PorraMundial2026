// supabase/functions/_shared/scorer-normalize.mjs
// Normalización canónica: nombre-de-feed → key de roster + matcher de goleador.
// Fuente de verdad ÚNICA del algoritmo de resolución/comparación de scorers.
//
// Consumido por:
//   - porra-bridge-results (extractScorers → playerToShortKey): nombre del feed
//     SofaScore/ESPN → key canónica de `equipos_players`.
//   - _shared/scoring.mjs (calcMatchPoints): comparar pred.gol vs scorers[].
//   - public/js/scoring.js: ESPEJO INLINE de normName/scorerMatches (es un
//     classic script y NO puede importar ESM). Si tocas la lógica aquí, replica
//     allí — la suite tiene parity shared↔legacy en tests/scoring.test.mjs.
//
// Origen: ERR-93. El bridge resolvía con substring estricto
// (`p.name.includes(nombre)`) + fallback al ÚLTIMO token: el feed "Vinicius
// Junior" contra el roster "7 · Vinicius Jr" fallaba el includes ("Junior" ≠
// "Jr") y caía a "Junior", pero la predicción guarda la key canónica
// "Vinicius" → el +2 de goleador no casaba nunca. Aquí la resolución es por
// TOKENS normalizados y el matcher compara keys normalizadas.

// Normaliza un nombre/key a forma comparable: sin diacríticos, minúsculas,
// junior/júnior → jr, sin dorsales ("7 · ") ni puntuación ("·", ".", "'").
// El rango ̀-ͯ es el bloque Unicode "Combining Diacritical Marks"
// que produce normalize("NFD").
export function normName(s) {
  return String(s ?? "")
    .normalize("NFD").replace(/[̀-ͯ]/g, "") // fuera diacríticos
    .toLowerCase()
    .replace(/\bjunior\b/g, "jr")                       // junior/júnior → jr
    .replace(/[^a-z0-9\s]/g, " ")                        // fuera "·", ".", "'"…
    .replace(/\b\d+\b/g, " ")                            // fuera dorsales sueltos
    .replace(/\s+/g, " ").trim();
}

export function toks(s) {
  return normName(s).split(" ").filter(Boolean);
}

// nombre del feed → key del roster por solapamiento de tokens. Los tokens
// distintivos pesan 3; el genérico "jr" pesa 1 — así un apellido distintivo
// gana SIEMPRE una desambiguación frente a dos jugadores que comparten "jr".
// Devuelve la key del mejor candidato, o null si ningún token solapa (el
// caller decide el fallback).
export function matchPlayerKey(nombre, players) {
  const feed = toks(nombre);
  if (!Array.isArray(players) || feed.length === 0) return null;
  let best = null;
  for (const p of players) {
    const cand = toks(`${p?.name ?? ""} ${p?.key ?? ""}`);
    const score = feed.reduce(
      (a, t) => a + (cand.includes(t) ? (t === "jr" ? 1 : 3) : 0),
      0,
    );
    if (score > 0 && (!best || score > best.score)) best = { key: p.key, score };
  }
  return best ? best.key : null;
}

// Fallback cuando ningún jugador del roster solapa: último token normalizado.
export function fallbackKey(nombre) {
  const parts = toks(nombre);
  return parts.length ? parts[parts.length - 1] : "";
}

// Matcher de goleador: ¿alguno de los scorers (keys canónicas persistidas)
// coincide con la key predicha? Comparación NORMALIZADA de la key entera —
// absorbe drift de caja/acentos/jr-junior entre lo persistido y lo predicho
// (defensa en profundidad sobre el fix del bridge). NO hace match por
// subcadena: dos keys distintas no colisionan.
export function scorerMatches(scorers, gol) {
  if (!gol || !Array.isArray(scorers) || scorers.length === 0) return false;
  const g = normName(gol);
  if (!g) return false;
  return scorers.some((s) => normName(s) === g);
}
