// Supabase client + idempotent upsert para la tabla squads.
// Lee SUPABASE_URL y SUPABASE_SERVICE_ROLE_KEY desde process.env.
// (Node 22+ soporta --env-file=.env si quieres autoload sin código extra).

import { createClient } from '@supabase/supabase-js';

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

// SELECT row de un país: { iso3, jugadores, jugadores_is_final, jugadores_fuente, jugadores_synced_at }
export async function getSquadRow(iso3) {
  const supa = getClient();
  const { data, error } = await supa
    .from('squads')
    .select('iso3, jugadores, jugadores_is_final, jugadores_fuente, jugadores_synced_at')
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
    .select('iso3, jugadores, jugadores_is_final, jugadores_fuente, jugadores_synced_at')
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

  const same =
    deepEqualPlayers(beforeJugadores, players) &&
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
        jugadores: players,
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
      jugadores: players,
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
