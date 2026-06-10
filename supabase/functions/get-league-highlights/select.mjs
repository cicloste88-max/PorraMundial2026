// supabase/functions/get-league-highlights/select.mjs
// Stream 2 (v1.0.2) — selección time-aware de partidos candidatos para los
// insights 1 (signo más solitario) y 2 (marcador más atrevido).
//
// PURA: recibe `now` como parámetro — el reloj se lee UNA vez en el handler
// de la EF, nunca dentro de la lógica de selección. Sin APIs Deno: la suite
// `npm test` (Node) importa este módulo tal cual (patrón _shared/scoring.mjs).
//
// Los insights 3 (premio), 4 (IA) y 5 (rebelde) son de torneo completo y NO
// pasan por aquí.

// `wc_matches.date_utc` es TEXT "2026-06-11T19:00" (sin segundos ni Z).
// `new Date(date_utc)` lo interpretaría como hora LOCAL del runtime y se
// desfasaría horas cerca del kickoff → sufijo ":00Z" para UTC explícito.
// Regex previa porque el parser de Date es laxo y acepta basura (p.ej.
// 'no-es-fecha:00Z' → 2000-01-01 en V8); segundos opcionales por resiliencia.
const DATE_UTC_RE = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(:\d{2})?$/;
export function parseKickoffUTC(dateUtc) {
  if (typeof dateUtc !== 'string') return null;
  const m = DATE_UTC_RE.exec(dateUtc.trim());
  if (!m) return null;
  const d = new Date(m[1] + (m[2] || ':00') + 'Z');
  return Number.isNaN(d.getTime()) ? null : d;
}

// matches: [{ matchId, dateUtc, round }] · now: Date (o epoch ms).
// Devuelve { round, ids: Set<matchId> } con los partidos AÚN NO jugados de la
// jornada (`wc_matches.round` 1/2/3 = J1/J2/J3) más baja que tenga pendientes
// — el destacado rota solo J1→J2→J3 según avanza el torneo. Devuelve null si
// no queda ningún partido pendiente (post-28-jun: insights 1 y 2 no se
// emiten). Exclusiones: kickoff <= now (jugado o en juego) y partidos sin
// date_utc parseable (no se afirma nada sobre un kickoff desconocido).
export function selectUpcomingRound(matches, now) {
  const nowMs = now instanceof Date ? now.getTime() : Number(now);
  if (!Number.isFinite(nowMs)) return null;
  let bestRound = null;
  const byRound = new Map();
  for (const m of matches || []) {
    if (!m || m.matchId == null) continue;
    const ko = parseKickoffUTC(m.dateUtc);
    if (!ko || ko.getTime() <= nowMs) continue;
    const r = Number.isInteger(m.round) ? m.round : Number.MAX_SAFE_INTEGER;
    let set = byRound.get(r);
    if (!set) { set = new Set(); byRound.set(r, set); }
    set.add(m.matchId);
    if (bestRound === null || r < bestRound) bestRound = r;
  }
  if (bestRound === null) return null;
  return { round: bestRound, ids: byRound.get(bestRound) };
}
