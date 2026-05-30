// scripts/lib/enrich-merge.mjs
//
// applyEnrich — aplica enriquecimiento TM (de A=marktwert o B=kader) sobre
// un roster ya existente. Una sola función para ambas fuentes, diferencia
// es sólo el contenido del Map de entrada.
//
// Reglas:
//  - ID-first: si player.tm_player_id existe, lookup directo en tmByIdMap.
//  - Fallback por nombre: si no hay tm_player_id, match por nombre+iso3.
//  - FILL-MISSING: solo escribe campos null/undefined del player. Nunca pisa
//    valor existente — el roster previo (que ya pasó upsertSquad+merge) es
//    autoritativo para los campos que tenga.
//  - PERSIST-BACK tm_player_id: si match fue por nombre, escribir
//    tm_player_id en player para que la próxima ejecución sea ID-first.
//
// Decisión de diseño: A aporta valor_eur/edad/posicion/foto/club; B además
// aporta dorsal+dob. Por eso el orquestador llama applyEnrich dos veces
// (A primero — masivo, B después — kader por país si faltan dob/dorsal).

import { normalize as normalizeName, matchAgainstRoster } from './name-matcher.mjs';

export const ENRICH_FIELDS = [
  'tm_player_id',
  'valor_eur',
  'edad',
  'posicion_tm',
  'dorsal',
  'dob',
  'club',
  'club_id',
  'club_logo_url',
  'foto_url_tm',
];

/**
 * @param {Array<object>} roster - jugadores actuales de la squad
 * @param {Map<number, object>} tmByIdMap - lookup ID → TM player. Los
 *   objetos pueden venir de pieza A (name, value_eur, age, position_tm,
 *   photo_url_tm…) o de pieza B (nombre, valor_eur, edad, posicion_tm,
 *   foto_url_tm, dorsal, dob…). applyEnrich tolera ambos shapes.
 * @param {object} opts - { iso3, sourceLabel } — iso3 filtra fallback por
 *   nombre a esa nación; sourceLabel ('A' | 'B') sólo para logging externo.
 * @returns {{ roster: Array<object>, stats: object }}
 */
export function applyEnrich(roster, tmByIdMap, { iso3, sourceLabel, aliases = null } = {}) {
  // Lookup secundario por nombre+iso3 desde tmByIdMap.
  const tmByNameInNation = new Map();
  const tmCandidatesInNation = []; // para fuzzy fallback
  for (const tm of tmByIdMap.values()) {
    if (tm.iso3 === iso3 || tm.iso3 == null) {
      const name = tm.name || tm.nombre || '';
      if (name) {
        tmByNameInNation.set(normalizeName(name), tm);
        tmCandidatesInNation.push({ tm, name });
      }
    }
  }

  const stats = { matched: 0, matched_fuzzy: 0, source: sourceLabel || null };
  for (const f of ENRICH_FIELDS) stats[`with_${f}`] = 0;

  // ── Pass 1: ID-first y exact name match (Map.get sobre clave normalizada) ──
  // Track TMs ya consumidos para evitar que un fuzzy match en Pass 2 robe un
  // TM ya asignado por exact match en Pass 1.
  const usedTmIds = new Set();
  const usedTmNameKeys = new Set(); // para TMs sin tm_player_id (raro pero posible)
  const fuzzyPending = []; // {i, p} para Pass 2
  for (let i = 0; i < roster.length; i++) {
    const p = roster[i];
    let tm = null;

    if (p.tm_player_id != null) {
      tm = tmByIdMap.get(p.tm_player_id);
    }

    if (!tm) {
      tm = tmByNameInNation.get(normalizeName(p.nombre || ''));
    }

    if (!tm) {
      // Diferido a Pass 2 (fuzzy)
      if (p.nombre) fuzzyPending.push({ i, p });
      continue;
    }
    _assignTmToPlayer(roster, i, tm);
    stats.matched++;
    if (tm.tm_player_id != null) usedTmIds.add(tm.tm_player_id);
    else usedTmNameKeys.add(normalizeName(tm.name || tm.nombre || ''));
  }

  // ── Pass 2: fuzzy match de los residuales (cubre transliteraciones árabes
  //    Yazid↔Yazeed, Fakhouri↔Fakhoury, Hashish↔Hasheesh, Abu Taha↔Mohannad
  //    Abu Taha que sobreviven a R1+R2+R3 con string aún distinta). minScore
  //    default 60. matchAgainstRoster ya tiene usedIdx interno → no asigna
  //    dos DB players al mismo TM. Filtramos primero los TMs consumidos en
  //    Pass 1 para no crear conflicto.
  if (fuzzyPending.length > 0) {
    const availableCandidates = tmCandidatesInNation.filter((c) => {
      const id = c.tm.tm_player_id;
      if (id != null && usedTmIds.has(id)) return false;
      if (id == null && usedTmNameKeys.has(normalizeName(c.name))) return false;
      return true;
    });
    if (availableCandidates.length > 0) {
      const dbNames = fuzzyPending.map((x) => x.p.nombre);
      const candNames = availableCandidates.map((c) => c.name);
      // iso3 → umbral Levenshtein 0.70 para no-latinos (KOR/KSA…); aliases →
      // resolver grafías roster→TM (tm-name-aliases.json) antes de puntuar.
      // Antes iban vacíos: la fase B no aplicaba ni el umbral ni los alias.
      const { matches } = matchAgainstRoster(dbNames, candNames, { iso3, aliases });
      for (const { candidate, matchIdx } of matches) {
        const pendingIdx = fuzzyPending.findIndex((x) => x.p.nombre === candidate);
        if (pendingIdx < 0) continue;
        const { i } = fuzzyPending[pendingIdx];
        const tm = availableCandidates[matchIdx].tm;
        _assignTmToPlayer(roster, i, tm);
        stats.matched++;
        stats.matched_fuzzy++;
      }
    }
  }

  function _assignTmToPlayer(rosterArr, idx, tm) {
    const p = rosterArr[idx];
    const newPlayer = { ...p };
    if (newPlayer.tm_player_id == null && tm.tm_player_id != null) {
      newPlayer.tm_player_id = tm.tm_player_id;
    }
    // Aceptar nombres de campo de A (value_eur, age, position_tm, photo_url_tm)
    // y de B (valor_eur, edad, posicion_tm, foto_url_tm). El roster persiste
    // siempre en el shape canónico (valor_eur, edad, posicion_tm, foto_url_tm).
    const tmFields = {
      valor_eur: tm.valor_eur ?? tm.value_eur,
      edad: tm.edad ?? tm.age,
      posicion_tm: tm.posicion_tm ?? tm.position_tm,
      dorsal: tm.dorsal,
      dob: tm.dob,
      club: tm.club,
      club_id: tm.club_id,
      club_logo_url: tm.club_logo_url,
      foto_url_tm: tm.foto_url_tm ?? tm.photo_url_tm,
    };
    for (const [k, v] of Object.entries(tmFields)) {
      if (newPlayer[k] == null && v != null) newPlayer[k] = v;
    }
    rosterArr[idx] = newPlayer;
  }

  // Stats por campo tras el enrich (foto cuenta ambas variantes).
  for (const p of roster) {
    if (p.tm_player_id != null) stats.with_tm_player_id++;
    if (p.valor_eur != null) stats.with_valor_eur++;
    if (p.edad != null) stats.with_edad++;
    if (p.posicion_tm != null) stats.with_posicion_tm++;
    if (p.dorsal != null) stats.with_dorsal++;
    if (p.dob != null) stats.with_dob++;
    if (p.club != null) stats.with_club++;
    if (p.club_id != null) stats.with_club_id++;
    if (p.club_logo_url != null) stats.with_club_logo_url++;
    if (p.foto_url_tm != null || p.foto_url != null) stats.with_foto_url_tm++;
  }

  return { roster, stats };
}
