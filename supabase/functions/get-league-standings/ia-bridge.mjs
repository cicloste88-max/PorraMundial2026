// supabase/functions/get-league-standings/ia-bridge.mjs
// Puente ia_predictions ↔ predictions — módulo PURO compartido Deno/Node.
//
// predictions.match_id  = "{grupo}_{home_es}_{away_es}"   (legacy, español)
// ia_predictions.match_id = "wc2026_g{grupo}_{sofascore_id}" == wc_matches.match_key
//
// Replica la semántica ya validada en producción de get-league-predictions
// (computeIA + flipSign, index.ts:58-91) y get-league-highlights (insight 4,
// oráculo 72/72 signos del bot): la IA computa en orientación SofaScore
// (home_code/away_code); en el único fixture teams_swapped del calendario
// (wc2026_gC_15186861, Brasil-Escocia J3: home_code=SCO vs home_iso3=BRA) el
// sign crudo viene invertido respecto a la card de la porra y hay que
// flipear 1<->2 (X invariante).

export function flipSign(s) {
  return s === "1" ? "2" : s === "2" ? "1" : s;
}

// iaRows: [{ match_id, sign, home_code }]   (solo claves wc2026_* de grupos)
// wcRows: [{ match_key, group_letter, home_es, away_es, home_iso3 }]
// Devuelve: { [legacyKey]: { sign } } con el sign en orientación porra.
export function buildIaSignByLegacyKey(iaRows, wcRows) {
  const wcByMatchKey = new Map();
  for (const wc of wcRows ?? []) {
    if (wc?.match_key) wcByMatchKey.set(wc.match_key, wc);
  }
  const out = {};
  for (const ia of iaRows ?? []) {
    if (!ia?.match_id || !ia?.sign) continue;
    const wc = wcByMatchKey.get(ia.match_id);
    if (!wc || !wc.group_letter || !wc.home_es || !wc.away_es) continue;
    const legacyKey = `${wc.group_letter}_${wc.home_es}_${wc.away_es}`;
    const swapped = !!(ia.home_code && wc.home_iso3 && ia.home_code !== wc.home_iso3);
    out[legacyKey] = { sign: swapped ? flipSign(String(ia.sign)) : String(ia.sign) };
  }
  return out;
}
