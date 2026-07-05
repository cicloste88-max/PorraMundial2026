// qp-bonus.mjs — bonus §1.7 "clasificados de grupos" (get-user-predictions v1.2.0).
//
// PURO (testeable con node:test) y espejo EXACTO del cómputo inline de
// get-league-standings v1.7.0: +KO_ROUND_PTS.groups (5) por equipo de R32
// PREDICHO que también es clasificado REAL. Reales = los 32 iso3 de
// wc_matches_ko slots 73-88; predichos = los 32 de la malla del usuario
// (resolveBracket, la MISMA cascada compartida que usa el motor: tablas de
// grupo + terceros Anexo C) en esos slots, nombres ES → iso3 vía wc_matches.
// Si el cómputo de standings cambia, replicar aquí (y viceversa).
//
// → number (0 es legítimo: liquidado sin aciertos) | null si el bonus aún no
//   es liquidable (wc_matches_ko sin sembrar). El caller decide la degradación
//   (el frontend oculta el tile CLASIFICADOS con null).

import { resolveBracket } from '../_shared/ko-bracket.mjs';
import { KO_ROUND_PTS } from '../_shared/scoring.mjs';

const R32_SLOTS = Array.from({ length: 16 }, (_, i) => 73 + i);

// predictionRows:   [{ match_id, local, visitante }]           (picks grupos del target)
// koPredictionRows: [{ match_id, local, visitante, classifier }] (picks KO del target)
// wcKoRows:         [{ ko_match_id, home_iso3, away_iso3 }]     (cruces reales sembrados)
// wcRows:           [{ home_es, away_es, home_iso3, away_iso3 }] (puente ES → iso3)
export function calcQualifiedBonus(predictionRows, koPredictionRows, wcKoRows, wcRows) {
  const realQualifiers = new Set();
  for (const row of Array.isArray(wcKoRows) ? wcKoRows : []) {
    const id = Number(row?.ko_match_id);
    if (!(id >= 73 && id <= 88)) continue;
    if (row.home_iso3) realQualifiers.add(row.home_iso3);
    if (row.away_iso3) realQualifiers.add(row.away_iso3);
  }
  if (realQualifiers.size === 0) return null;

  const esNameToIso3 = {};
  for (const w of Array.isArray(wcRows) ? wcRows : []) {
    if (w && w.home_es && w.home_iso3) esNameToIso3[w.home_es] = w.home_iso3;
    if (w && w.away_es && w.away_iso3) esNameToIso3[w.away_es] = w.away_iso3;
  }

  const { slots } = resolveBracket(predictionRows ?? [], koPredictionRows ?? []);
  const predQualifiers = new Set();
  for (const s of R32_SLOTS) {
    const ps = slots ? slots[s] : null;
    const h = (ps && ps.home != null) ? esNameToIso3[ps.home] : null;
    const a = (ps && ps.away != null) ? esNameToIso3[ps.away] : null;
    if (h) predQualifiers.add(h);
    if (a) predQualifiers.add(a);
  }

  let hits = 0;
  for (const q of predQualifiers) if (realQualifiers.has(q)) hits++;
  return hits * KO_ROUND_PTS.groups;
}
