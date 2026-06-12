// logic.mjs — lógica pura del backfill de ko_predictions.classifier.
//
// Réplica controlada del bracket dinámico del frontend (BRIEF_BACKFILL_KO_CLASSIFIERS):
//   - calcGroupTable        ≡ calcGroupTableAdvanced (public/js/scoring.js:257)
//   - getBestThirds         ≡ getBestThirdsAll       (public/js/scoring.js:279)
//   - resolveGroupSlots     ≡ resolveAllSlots, rama grupos+terceros (public/js/ko.js:637)
//   - inferClassifiers      ≡ cascada resolveKO (public/js/ko.js:700) + inferencia
//
// Cualquier cambio en la lógica de desempate del frontend debe replicarse aquí.
// Los datos (BRACKET/ANNEX_C/GRUPOS) NO se replican: se regeneran con
// scripts/gen-backfill-ko-data.mjs desde los literales del frontend.
//
// Sin dependencias — testeable con node:test (tests/backfill-ko-classifiers.test.mjs).

import { BRACKET, ANNEX_C, GRUPOS } from './ko-data.mjs';

export const ALL_KO_SLOTS = [
  ...BRACKET.r32, ...BRACKET.r16, ...BRACKET.qf,
  ...BRACKET.sf, ...BRACKET.third, ...BRACKET.final,
];

const GROUP_MATCHES_TOTAL = 72;

// predictions.match_id en BD = `${group}_${home}_${away}` (getMatchKey del frontend).
// Los nombres de equipo no contienen "_", por lo que el split es seguro.
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

// Cuenta marcadores de grupos completos (l y v enteros) — gate de 72.
export function countGroupScores(predsByKey) {
  return Object.values(predsByKey).filter(
    (p) => p && Number.isInteger(p.l) && Number.isInteger(p.v),
  ).length;
}

// Núcleo del backfill para UN usuario.
//
// predsByKey: { matchKey: {l, v} } — predicciones de grupos del usuario.
// koRows:     [{ match_id, local, visitante, classifier, scorer }] — sus ko_predictions.
//
// Devuelve { updates, warnings, skipped }:
//   updates  — [{ match_id, classifier }] solo para filas con classifier null/''
//              y ganador claro por marcador (idempotente: no toca no-null).
//   warnings — [{ slot?, reason, note? }]
//   skipped  — true si el usuario no tiene los 72 marcadores de grupos.
export function inferClassifiers(predsByKey, koRows) {
  const warnings = [];
  const updates = [];

  const scored = countGroupScores(predsByKey);
  if (scored < GROUP_MATCHES_TOTAL) {
    warnings.push({ reason: 'incomplete_group_predictions', note: `${scored}/${GROUP_MATCHES_TOTAL} marcadores de grupos` });
    return { updates, warnings, skipped: true };
  }

  const { slots, usedFallback } = resolveGroupSlots(predsByKey);
  if (usedFallback) {
    warnings.push({ reason: 'annex_c_fallback', note: 'mapping secuencial de terceros (no debería ocurrir con 72 marcadores)' });
  }

  const koById = new Map();
  koRows.forEach((r) => koById.set(Number(r.match_id), r));

  const winnerBySlot = {};
  const loserBySlot = {};

  const resolveKey = (key) => {
    const mW = /^W(\d+)$/.exec(key);
    if (mW) return winnerBySlot[Number(mW[1])] || null;
    const mL = /^L(\d+)$/.exec(key);
    if (mL) return loserBySlot[Number(mL[1])] || null;
    return slots[key] || null;
  };

  // Cascada en orden 73→104, ≡ resolveKO del frontend: el ganador por marcador
  // manda; classifier solo decide en empates (los simuladores legacy escriben
  // "home"/"away" literal — HF-09 — se resuelven aquí igual que en frontend).
  for (const m of ALL_KO_SLOTS) {
    const row = koById.get(m.id);
    const hTeam = resolveKey(m.home);
    const aTeam = resolveKey(m.away);

    if (!row) {
      warnings.push({ slot: m.id, reason: 'missing_ko_pred' });
      continue;
    }
    const l = row.local;
    const v = row.visitante;
    if (!Number.isInteger(l) || !Number.isInteger(v)) {
      warnings.push({ slot: m.id, reason: 'null_score' });
      continue;
    }

    const existing = (row.classifier !== null && row.classifier !== undefined && String(row.classifier).trim() !== '')
      ? String(row.classifier).trim()
      : null;
    const existingResolved = existing === 'home' ? hTeam : existing === 'away' ? aTeam : existing;

    let winner = null;
    let loser = null;
    if (l > v) { winner = hTeam; loser = aTeam; }
    else if (v > l) { winner = aTeam; loser = hTeam; }
    else if (existingResolved) {
      winner = existingResolved;
      loser = winner === hTeam ? aTeam : hTeam;
    }

    if (existing) {
      // Preservar SIEMPRE el valor del usuario; solo sanity-check.
      if (l !== v && existingResolved && winner && existingResolved !== winner) {
        warnings.push({ slot: m.id, reason: 'contradiction', note: `classifier="${existing}" no cuadra con ${l}-${v} (ganador por marcador: "${winner}")` });
      }
    } else if (l !== v) {
      if (winner) {
        updates.push({ match_id: m.id, classifier: winner });
      } else {
        warnings.push({ slot: m.id, reason: 'unresolved_slot', note: `home=${m.home}→${hTeam ?? '∅'}, away=${m.away}→${aTeam ?? '∅'}` });
      }
    } else {
      // Empate sin classifier explícito: decisión del usuario, queda null.
      warnings.push({ slot: m.id, reason: 'draw_no_classifier', note: 'empate sin classifier explícito — queda null' });
    }

    winnerBySlot[m.id] = winner;
    loserBySlot[m.id] = loser;
  }

  return { updates, warnings, skipped: false };
}
