// logic.mjs — lógica pura del backfill de ko_predictions.classifier.
//
// El bracket dinámico (tabla de grupos + mejores terceros Anexo C + cascada
// 73→104) vive en el módulo COMPARTIDO ../_shared/ko-bracket.mjs (también lo
// consume send-porra-receipt para el cruce HOME vs AWAY del comprobante).
// Aquí solo queda la capa de inferencia/backfill: decidir qué filas con
// classifier NULL son rellenables y con qué warnings.
//
// Sin dependencias — testeable con node:test (tests/backfill-ko-classifiers.test.mjs).

import { ALL_KO_SLOTS, countGroupScores, resolveBracketFromMaps } from '../_shared/ko-bracket.mjs';

// Re-export del API histórico de este módulo (lo usan los tests; la
// implementación canónica está en _shared/ko-bracket.mjs).
export {
  ALL_KO_SLOTS,
  calcGroupTable,
  countGroupScores,
  getBestThirds,
  parseMatchKey,
  resolveGroupSlots,
} from '../_shared/ko-bracket.mjs';

const GROUP_MATCHES_TOTAL = 72;

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

  const { slots, usedFallback } = resolveBracketFromMaps(predsByKey, koRows);
  if (usedFallback) {
    warnings.push({ reason: 'annex_c_fallback', note: 'mapping secuencial de terceros (no debería ocurrir con 72 marcadores)' });
  }

  const koById = new Map();
  (koRows ?? []).forEach((r) => koById.set(Number(r.match_id), r));

  for (const m of ALL_KO_SLOTS) {
    const row = koById.get(m.id);
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

    const { home, away, winner } = slots[m.id];
    const existing = (row.classifier !== null && row.classifier !== undefined && String(row.classifier).trim() !== '')
      ? String(row.classifier).trim()
      : null;

    if (existing) {
      // Preservar SIEMPRE el valor del usuario; solo sanity-check contra el
      // ganador por marcador (en no-empate winner === ganador por marcador).
      const existingResolved = existing === 'home' ? home : existing === 'away' ? away : existing;
      if (l !== v && existingResolved && winner && existingResolved !== winner) {
        warnings.push({ slot: m.id, reason: 'contradiction', note: `classifier="${existing}" no cuadra con ${l}-${v} (ganador por marcador: "${winner}")` });
      }
    } else if (l !== v) {
      if (winner) {
        updates.push({ match_id: m.id, classifier: winner });
      } else {
        warnings.push({ slot: m.id, reason: 'unresolved_slot', note: `home=${m.home}→${home ?? '∅'}, away=${m.away}→${away ?? '∅'}` });
      }
    } else {
      // Empate sin classifier explícito: decisión del usuario, queda null.
      warnings.push({ slot: m.id, reason: 'draw_no_classifier', note: 'empate sin classifier explícito — queda null' });
    }
  }

  return { updates, warnings, skipped: false };
}
