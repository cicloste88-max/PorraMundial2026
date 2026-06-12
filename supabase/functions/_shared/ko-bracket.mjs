// ko-bracket.mjs — bracket dinámico KO compartido (réplica del frontend).
//
// Resuelve, para los pronósticos de UN usuario, quién juega y quién gana cada
// slot KO 73..104: tabla de grupos + mejores terceros (Anexo C FIFA 2026) +
// cascada de winners/losers R32→R16→QF→SF→3.º→Final.
//
// Réplica controlada de:
//   - calcGroupTable    ≡ calcGroupTableAdvanced (public/js/scoring.js:257)
//   - getBestThirds     ≡ getBestThirdsAll       (public/js/scoring.js:279)
//   - resolveGroupSlots ≡ resolveAllSlots, rama grupos+terceros (public/js/ko.js:637)
//   - cascada de resolveBracketFromMaps ≡ resolveKO (public/js/ko.js:700)
// Cualquier cambio en la lógica de desempate del frontend debe replicarse aquí.
// Los datos (BRACKET/ANNEX_C/GRUPOS) NO se replican: se regeneran con
// scripts/gen-ko-data.mjs desde los literales del frontend.
//
// Consumidores: backfill-ko-classifiers (inferencia de classifier) y
// send-porra-receipt (cruce HOME vs AWAY por slot en el comprobante).
// Sin dependencias — testeable con node:test (tests/ko-bracket.test.mjs).

import { ANNEX_C, BRACKET, GRUPOS } from './ko-data.mjs';

export const ALL_KO_SLOTS = [
  ...BRACKET.r32, ...BRACKET.r16, ...BRACKET.qf,
  ...BRACKET.sf, ...BRACKET.third, ...BRACKET.final,
];

// predictions.match_id en BD = `${group}_{home}_${away}` (getMatchKey del
// frontend). Los nombres de equipo no contienen "_", el split es seguro.
export function parseMatchKey(key) {
  const parts = String(key).split('_');
  if (parts.length !== 3) return null;
  const [group, home, away] = parts;
  if (!GRUPOS.some((g) => g.letra === group)) return null;
  return { group, home, away };
}

// predsByKey: { "A_México_Sudáfrica": { l, v }, ... }
// Igual que calcGroupTableAdvanced: siembra en orden GRUPOS[].equipos (el sort
// estable preserva ese orden en empates totales), pts/gd/gf desc.
export function calcGroupTable(letra, predsByKey) {
  const grupo = GRUPOS.find((g) => g.letra === letra);
  if (!grupo) return [];
  const stats = grupo.equipos.map((e) => ({ name: e, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0 }));
  for (const [key, pred] of Object.entries(predsByKey)) {
    const m = parseMatchKey(key);
    if (!m || m.group !== letra) continue;
    if (!pred || pred.l === null || pred.l === undefined || pred.v === null || pred.v === undefined) continue;
    const h = stats.find((s) => s.name === m.home);
    const a = stats.find((s) => s.name === m.away);
    if (!h || !a) continue;
    h.pj++; a.pj++;
    h.gf += pred.l; h.gc += pred.v;
    a.gf += pred.v; a.gc += pred.l;
    if (pred.l > pred.v) { h.g++; h.pts += 3; a.p++; }
    else if (pred.l < pred.v) { a.g++; a.pts += 3; h.p++; }
    else { h.e++; a.e++; h.pts += 1; a.pts += 1; }
  }
  stats.forEach((s) => { s.gd = s.gf - s.gc; });
  stats.sort((a, b) => b.pts - a.pts || b.gd - a.gd || b.gf - a.gf);
  return stats;
}

// ≡ getBestThirdsAll, pero devolviendo {name, group} (los nombres son únicos).
export function getBestThirds(predsByKey, tables) {
  const thirds = [];
  GRUPOS.forEach((g) => {
    const filled = Object.entries(predsByKey).filter(([key, pred]) => {
      const m = parseMatchKey(key);
      return m && m.group === g.letra && pred && pred.l !== null && pred.l !== undefined;
    }).length;
    if (filled < 6) return;
    const t = tables[g.letra];
    if (t && t[2]) thirds.push({ ...t[2], group: g.letra });
  });
  thirds.sort((a, b) => b.pts - a.pts || (b.gf - b.gc) - (a.gf - a.gc) || b.gf - a.gf);
  return thirds.slice(0, 8).map((t) => ({ name: t.name, group: t.group }));
}

// ≡ resolveAllSlots (rama grupos): slots '1A'..'3L' + 'T_XXXXX' vía ANNEX_C.
// Devuelve { slots, annexKey, usedFallback }.
export function resolveGroupSlots(predsByKey) {
  const slots = {};
  const tables = {};
  GRUPOS.forEach((g) => { tables[g.letra] = calcGroupTable(g.letra, predsByKey); });
  const bestThirds = getBestThirds(predsByKey, tables);

  GRUPOS.forEach((g) => {
    const t = tables[g.letra];
    if (t && t[0]) slots['1' + g.letra] = t[0].name;
    if (t && t[1]) slots['2' + g.letra] = t[1].name;
    if (t && t[2]) slots['3' + g.letra] = t[2].name;
  });

  const thirdSlotsFallback = ['T_ABCDF', 'T_CDFGH', 'T_CEFHI', 'T_EHIJK', 'T_BEFIJ', 'T_AEHIJ', 'T_EFGIJ', 'T_DEIJL'];
  let annexKey = null;
  let usedFallback = false;

  if (bestThirds.length === 8) {
    annexKey = bestThirds.map((e) => e.group).sort().join('');
    const row = ANNEX_C[annexKey];
    if (row) {
      Object.entries(row).forEach(([slot, groupLetter]) => {
        const entry = bestThirds.find((e) => e.group === groupLetter);
        if (entry) slots[slot] = entry.name;
      });
    } else {
      usedFallback = true;
      bestThirds.forEach((e, i) => { if (thirdSlotsFallback[i]) slots[thirdSlotsFallback[i]] = e.name; });
    }
  } else {
    usedFallback = true;
    bestThirds.forEach((e, i) => { if (thirdSlotsFallback[i]) slots[thirdSlotsFallback[i]] = e.name; });
  }

  return { slots, annexKey, usedFallback };
}

// Cuenta marcadores de grupos completos (l y v enteros) — gate de 72 del backfill.
export function countGroupScores(predsByKey) {
  return Object.values(predsByKey).filter(
    (p) => p && Number.isInteger(p.l) && Number.isInteger(p.v),
  ).length;
}

const cleanClassifier = (c) =>
  (c !== null && c !== undefined && String(c).trim() !== '') ? String(c).trim() : null;

// Núcleo de la cascada — ≡ resolveKO del frontend, en orden 73→104.
//
// predsByKey: { matchKey: {l, v} } — predicciones de grupos del usuario.
// koRows:     [{ match_id, local, visitante, classifier }] — sus ko_predictions.
//
// Devuelve { slots, groupSlots, annexKey, usedFallback }:
//   slots — { 73: { home, away, winner, loser }, ..., 104: {...} } con nombres
//           ES o null si el lado/resultado no es resoluble. El ganador por
//           marcador manda; classifier solo decide en empates (los simuladores
//           legacy escriben "home"/"away" literal — HF-09 — se resuelven aquí
//           igual que en frontend).
export function resolveBracketFromMaps(predsByKey, koRows) {
  const { slots: groupSlots, annexKey, usedFallback } = resolveGroupSlots(predsByKey);

  const koById = new Map();
  (koRows ?? []).forEach((r) => koById.set(Number(r.match_id), r));

  const slots = {};
  const winnerBySlot = {};
  const loserBySlot = {};

  const resolveKey = (key) => {
    const mW = /^W(\d+)$/.exec(key);
    if (mW) return winnerBySlot[Number(mW[1])] || null;
    const mL = /^L(\d+)$/.exec(key);
    if (mL) return loserBySlot[Number(mL[1])] || null;
    return groupSlots[key] || null;
  };

  for (const m of ALL_KO_SLOTS) {
    const home = resolveKey(m.home);
    const away = resolveKey(m.away);
    const row = koById.get(m.id);

    let winner = null;
    let loser = null;
    if (row && Number.isInteger(row.local) && Number.isInteger(row.visitante)) {
      const l = row.local;
      const v = row.visitante;
      const existing = cleanClassifier(row.classifier);
      const existingResolved = existing === 'home' ? home : existing === 'away' ? away : existing;
      if (l > v) { winner = home; loser = away; }
      else if (v > l) { winner = away; loser = home; }
      else if (existingResolved) {
        winner = existingResolved;
        loser = winner === home ? away : home;
      }
    }

    slots[m.id] = { home, away, winner, loser };
    winnerBySlot[m.id] = winner;
    loserBySlot[m.id] = loser;
  }

  return { slots, groupSlots, annexKey, usedFallback };
}

// API principal (firma del brief RENDER_KO_CROSSES): rows crudas de BD.
//
// @param predictionRows   rows de predictions    [{ match_id, local, visitante }]
// @param koPredictionRows rows de ko_predictions [{ match_id, local, visitante, classifier }]
// @returns { slots: { 73: { home, away, winner, loser }, ... },
//            podium: { champion, runnerUp, third, fourth },
//            meta: { annexKey, usedFallback, groupScores } }
export function resolveBracket(predictionRows, koPredictionRows) {
  const predsByKey = {};
  (predictionRows ?? []).forEach((r) => {
    predsByKey[r.match_id] = { l: r.local ?? null, v: r.visitante ?? null };
  });

  const { slots, annexKey, usedFallback } = resolveBracketFromMaps(predsByKey, koPredictionRows ?? []);

  const final = slots[104] ?? {};
  const third = slots[103] ?? {};
  return {
    slots,
    podium: {
      champion: final.winner ?? null,
      runnerUp: final.loser ?? null,
      third: third.winner ?? null,
      fourth: third.loser ?? null,
    },
    meta: { annexKey, usedFallback, groupScores: countGroupScores(predsByKey) },
  };
}
