// Cross-validation 2-of-N + Jaccard nombres ≥ 0.7.
//
// Inputs:
//   parseResults: Array<ParseResult>  (una por fuente: AS, Sport, Olympics, Marca, ESPN)
//   opts:
//     minPlayers   default 22 — umbral mínimo de jugadores para contar como "FINAL".
//     maxPlayers   default 30 — techo: descarta pre-listas largas (40-55 jugadores)
//                               típicas de ARG/MEX/COL/CZE pre-cierre oficial.
//     jaccardThr   default 0.7 — umbral de solape nombres normalizados entre 2 fuentes.
//     calendar     Set<iso3>  — iso3 con "(definitiva)" futura. Si presente y 2+ fuentes
//                               coinciden, degrade a 'low' con reason="calendario Olympics
//                               marca definitiva pendiente — verificar manualmente".
//                               Si no se pasa o el iso3 no está en el set, NO degrade.
//
// Output: Map<iso3, ValidationResult>
//   ValidationResult = {
//     iso3,
//     confidence: 'high' | 'low' | 'reject',
//     sources: string[],          // ['as', 'olympics']
//     players: Array<Player>,     // roster mergeado (unión por mejor coincidencia)
//     coach?: string,
//     group?: string,
//     metrics: { sourceCount, perPairJaccard: Record<pair,number>, sizes: Record<source,number> },
//     reason?: string,            // razón de 'reject' o 'low'
//   }
//
// Reglas de combinación (cuando hay 2+ fuentes con high-confidence):
//   - Lista canónica de jugadores = la fuente con MÁS jugadores que pasen el match.
//   - posicion: si hay conflicto, gana la mayoría; empate → primera fuente alfabéticamente.
//   - coach / group: primer valor no nulo en orden olympics > as > sport.

import { normalize } from './name-matcher.mjs';

const DEFAULT_OPTS = { minPlayers: 22, maxPlayers: 30, jaccardThr: 0.7, calendar: null };

export function crossValidate(parseResults, opts = {}) {
  const { minPlayers, maxPlayers, jaccardThr, calendar } = { ...DEFAULT_OPTS, ...opts };

  const allIso3 = new Set();
  const bySource = new Map();
  for (const pr of parseResults) {
    if (!pr || !pr.byIso3) continue;
    bySource.set(pr.source, pr.byIso3);
    for (const iso3 of Object.keys(pr.byIso3)) allIso3.add(iso3);
  }

  const out = new Map();

  for (const iso3 of allIso3) {
    const presence = [];
    for (const [source, byIso3] of bySource.entries()) {
      const entry = byIso3[iso3];
      if (entry && Array.isArray(entry.players) && entry.players.length > 0) {
        presence.push({ source, entry });
      }
    }

    // Solo cuentan como elegibles las fuentes con roster en [minPlayers, maxPlayers].
    // Por encima de maxPlayers es pre-lista (40-55 jugadores) — no marcable como FINAL.
    const eligible = presence.filter(
      (p) => p.entry.players.length >= minPlayers && p.entry.players.length <= maxPlayers
    );
    const sourceCount = eligible.length;
    const hasPreList = presence.some((p) => p.entry.players.length > maxPlayers);

    const perPairJaccard = {};
    const sizes = {};
    for (const p of presence) sizes[p.source] = p.entry.players.length;
    for (let i = 0; i < eligible.length; i++) {
      for (let j = i + 1; j < eligible.length; j++) {
        const a = eligible[i];
        const b = eligible[j];
        perPairJaccard[`${a.source}|${b.source}`] = jaccardNames(a.entry.players, b.entry.players);
      }
    }

    let confidence = 'reject';
    let reason;
    if (sourceCount >= 2) {
      const pairs = Object.values(perPairJaccard);
      const goodPairs = pairs.filter((v) => v >= jaccardThr).length;
      if (goodPairs >= 1) {
        confidence = 'high';
      } else {
        confidence = 'low';
        reason = `2+ fuentes con ≥${minPlayers} jugadores pero ningún par alcanza Jaccard ≥${jaccardThr} (max=${Math.max(0, ...pairs).toFixed(2)})`;
      }
    } else if (sourceCount === 1) {
      confidence = 'low';
      reason = `solo 1 fuente con ${minPlayers}-${maxPlayers} jugadores (${eligible[0].source})`;
    } else if (hasPreList) {
      confidence = 'reject';
      reason = `pre-lista detectada (>${maxPlayers} jugadores) — esperar cierre oficial`;
    } else if (presence.length > 0) {
      confidence = 'reject';
      reason = `${presence.length} fuente(s) con roster < ${minPlayers} — no marcable como FINAL`;
    } else {
      continue;
    }

    if (confidence === 'high' && calendar instanceof Set && calendar.has(iso3)) {
      confidence = 'low';
      reason = `calendario Olympics marca "(definitiva)" pendiente — verificar manualmente`;
    }

    const canonical = pickCanonical(eligible.length > 0 ? eligible : presence);
    out.set(iso3, {
      iso3,
      confidence,
      sources: eligible.map((p) => p.source),
      players: canonical.players,
      coach: canonical.coach,
      group: canonical.group,
      metrics: { sourceCount, perPairJaccard, sizes },
      reason,
    });
  }

  return out;
}

function pickCanonical(presence) {
  const ordered = [...presence].sort((a, b) => b.entry.players.length - a.entry.players.length);
  const base = ordered[0].entry;
  // Prioridad para campos coach/group: olympics y as son los más fiables; marca
  // tiene errores conocidos en grupos (e.g. CRO=K cuando es L) → último lugar.
  // Prioridad de fuentes para campos coach/group cuando hay conflicto.
  // Olympics+AS+Sport tienen track record fiable; Marca tiene errores
  // conocidos en grupos (CRO=K en lugar de L 18-may) → último lugar.
  // ESPN es la fuente nueva (22-may, post-descarte Eurosport por geoblock):
  // posicionada antes de Marca por defecto, ajustar tras observar.
  const priority = ['olympics', 'as', 'sport', 'espn', 'marca'];
  const coach = priority.map((s) => presence.find((p) => p.source === s)?.entry.coach).find(Boolean);
  const group = priority.map((s) => presence.find((p) => p.source === s)?.entry.group).find(Boolean);
  return { players: base.players, coach, group };
}

export function jaccardNames(playersA, playersB) {
  const A = new Set(playersA.map((p) => normalizeFamilyKey(p.nombre)));
  const B = new Set(playersB.map((p) => normalizeFamilyKey(p.nombre)));
  if (A.size === 0 || B.size === 0) return 0;
  let inter = 0;
  for (const k of A) if (B.has(k)) inter++;
  const union = A.size + B.size - inter;
  return union === 0 ? 0 : inter / union;
}

function normalizeFamilyKey(name) {
  const norm = normalize(name);
  const toks = norm.split(' ').filter(Boolean);
  if (toks.length === 0) return '';
  if (toks.length === 1) return toks[0];
  return toks.slice(-2).join(' ');
}
