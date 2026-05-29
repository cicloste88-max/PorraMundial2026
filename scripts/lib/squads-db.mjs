// Supabase client + idempotent upsert para la tabla squads.
// Lee SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY desde process.env.
// (Node 22+ soporta --env-file=.env si quieres autoload sin código extra).

import { createClient } from '@supabase/supabase-js';
import { normalize as normalizeName } from './name-matcher.mjs';

// Campos que se preservan al hacer merge contra la fila previa con semántica
// FILL-IF-NULL: si el array nuevo no aporta valor (null/undefined) para uno de
// estos, se hereda del jugador previo correspondiente; si lo aporta, el nuevo
// gana. Cierra dos regresiones:
//  - Enrich TM (19-may): `--mode=detect` pisaba fotos Storage, tm_player_id,
//    edad, valor_eur, dorsal, dob, posicion_tm.
//  - es_titular (PL-3): cada detect reconstruía el roster y, al NO preservar
//    es_titular, borraba el XI pineado. Los 33 squads pineados caían a 0
//    titulares y get-squad/extractXI devolvía 11 placeholders '—' (Pizarra
//    vacía). es_titular es boolean: el `undefined` del path detect (los parsers
//    primarios no emiten el flag) hereda el pin; el `true`/`false` EXPLÍCITO de
//    enrich-xi / refresh-final / reseed-xi pisa al previo (re-marcado del XI).
const ENRICH_FIELDS = [
  'tm_player_id',
  'foto_url',
  'edad',
  'valor_eur',
  'dorsal',
  'dob',
  'posicion_tm',
];
const PRESERVE_FIELDS = [...ENRICH_FIELDS, 'es_titular'];

/**
 * Merge de jugadores nuevos vs previos:
 *  - Para cada jugador nuevo, localiza su previo por tm_player_id (autoritativo)
 *    y, en su defecto, por nombre normalizado (name-matcher.mjs).
 *  - Si hay match, preserva PRESERVE_FIELDS (enrich + es_titular) del previo
 *    cuando el nuevo no los aporta (fill-if-null).
 *  - Jugadores nuevos sin match en previo entran tal cual.
 *  - Jugadores previos sin match en nuevos DESAPARECEN (correcto: convocatoria cambió).
 */
export function mergeJugadores(beforePlayers, newPlayers) {
  if (!Array.isArray(beforePlayers) || beforePlayers.length === 0) return newPlayers;
  if (!Array.isArray(newPlayers)) return newPlayers;

  const beforeById = new Map();
  const beforeByName = new Map();
  for (const p of beforePlayers) {
    if (p?.tm_player_id != null) beforeById.set(p.tm_player_id, p);
    if (p?.nombre) beforeByName.set(normalizeName(p.nombre), p);
  }

  return newPlayers.map((np) => {
    const prev =
      (np?.tm_player_id != null ? beforeById.get(np.tm_player_id) : undefined) ||
      beforeByName.get(normalizeName(np?.nombre || ''));
    if (!prev) return np;
    const merged = { ...np };
    for (const field of PRESERVE_FIELDS) {
      if (merged[field] == null && prev[field] != null) {
        merged[field] = prev[field];
      }
    }
    return merged;
  });
}

const URL = process.env.SUPABASE_URL || 'https://cmyfyswystjgzdwbqyyb.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

let _client = null;
export function getClient() {
  if (_client) return _client;
  if (!KEY) {
    throw new Error(
      'SUPABASE_SERVICE_ROLE_KEY no está en el entorno. Exporta o usa --env-file=.env'
    );
  }
  _client = createClient(URL, KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return _client;
}

// SELECT row de un país. 28-may-2026 — añadido xi_pinned/xi_pinned_at (Capa C)
// para que el motor sepa si debe saltar el recálculo de es_titular.
export async function getSquadRow(iso3) {
  const supa = getClient();
  const { data, error } = await supa
    .from('squads')
    .select(
      'iso3, jugadores, jugadores_is_final, jugadores_fuente, jugadores_synced_at, xi_pinned, xi_pinned_at',
    )
    .eq('iso3', iso3)
    .maybeSingle();
  if (error) throw error;
  return data;
}

// SELECT todas las filas (para --all / --all-missing)
export async function listAllSquads() {
  const supa = getClient();
  const { data, error } = await supa
    .from('squads')
    .select(
      'iso3, jugadores, jugadores_is_final, jugadores_fuente, jugadores_synced_at, xi_pinned, xi_pinned_at',
    )
    .order('iso3');
  if (error) throw error;
  return data || [];
}

// Comparación deep-equal de arrays jugadores (orden + valores).
export function deepEqualPlayers(a, b) {
  if (!Array.isArray(a) || !Array.isArray(b)) return a === b;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (!shallowEqualObj(a[i] || {}, b[i] || {})) return false;
  }
  return true;
}

function shallowEqualObj(a, b) {
  const ka = Object.keys(a).sort();
  const kb = Object.keys(b).sort();
  if (ka.length !== kb.length) return false;
  for (let i = 0; i < ka.length; i++) {
    if (ka[i] !== kb[i]) return false;
    if (a[ka[i]] !== b[ka[i]]) return false;
  }
  return true;
}

// Upsert idempotente. Devuelve { changed: bool, before, after }.
export async function upsertSquad(iso3, players, { isFinal, fuente, dryRun = false, force = false }) {
  const supa = getClient();
  const before = await getSquadRow(iso3);
  const beforeJugadores = before?.jugadores || [];
  const mergedPlayers = mergeJugadores(beforeJugadores, players);

  const same =
    deepEqualPlayers(beforeJugadores, mergedPlayers) &&
    (before?.jugadores_is_final ?? false) === !!isFinal &&
    (before?.jugadores_fuente ?? null) === fuente;

  if (same && !force) {
    return { changed: false, before, after: before, dryRun, noop: true };
  }

  if (dryRun) {
    return {
      changed: true,
      before,
      after: {
        ...before,
        jugadores: mergedPlayers,
        jugadores_is_final: isFinal,
        jugadores_fuente: fuente,
        jugadores_synced_at: new Date().toISOString(),
      },
      dryRun: true,
    };
  }

  const nowIso = new Date().toISOString();
  const { data, error } = await supa
    .from('squads')
    .update({
      jugadores: mergedPlayers,
      jugadores_is_final: isFinal,
      jugadores_fuente: fuente,
      jugadores_synced_at: nowIso,
      updated_at: nowIso,
    })
    .eq('iso3', iso3)
    .select()
    .maybeSingle();

  if (error) throw error;
  return { changed: true, before, after: data, dryRun: false };
}
