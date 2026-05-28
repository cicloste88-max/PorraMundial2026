// Sprint Combos & Awards F3 (28-may) — port TS de las helpers de
// public/js/scoring.js para resolver keys de scorers con el mismo formato
// corto (apellido sin diacríticos, "I. " inicial+punto+espacio en colisión).
// Mantener la lógica espejada con scoring.js evita drift entre cliente y EF.

export type EquiposPlayer = { key: string; name: string };
export type EquiposPlayersByIso3 = Record<string, EquiposPlayer[]>;

// deno-lint-ignore no-explicit-any
export type SquadPlayer = {
  nombre: string;
  posicion?: string | null;
  valor_eur?: number | null;
  es_titular?: boolean;
  dorsal?: number | null;
  // deno-lint-ignore no-explicit-any
  [k: string]: any;
};

// Lookup primero en EQUIPOS[].players (preserva keys históricas); fallback
// al último token NFD-normalizado. iso3 obligatorio para anti-colisión.
export function playerToShortKey(
  nombre: string,
  iso3: string,
  equiposPlayers: EquiposPlayersByIso3,
): string {
  if (!nombre) return "";
  const eq = equiposPlayers[iso3];
  if (Array.isArray(eq)) {
    const hit = eq.find((p) => p.name && p.name.includes(nombre));
    if (hit) return hit.key;
  }
  // ̀-ͯ = bloque Unicode "Combining Diacritical Marks" producido por NFD.
  const norm = String(nombre).normalize("NFD").replace(/[̀-ͯ]/g, "");
  const parts = norm.trim().split(/\s+/);
  return parts[parts.length - 1] || "";
}

// Dado el squad completo, devuelve [{j, key}] con keys únicos. Si dos
// jugadores producen el mismo key, ambos reciben "Inicial. Apellido".
export function resolveKeysForSquad(
  jugadores: SquadPlayer[],
  iso3: string,
  equiposPlayers: EquiposPlayersByIso3,
): Array<{ j: SquadPlayer; key: string }> {
  if (!Array.isArray(jugadores)) return [];
  const tentative = jugadores.map((j) => ({
    j,
    key: playerToShortKey(j.nombre, iso3, equiposPlayers),
  }));
  const counts: Record<string, number> = {};
  for (const t of tentative) counts[t.key] = (counts[t.key] || 0) + 1;
  return tentative.map((t) => {
    if (counts[t.key] > 1) {
      const first = String(t.j.nombre || "").trim().split(/\s+/)[0];
      const initial = first ? first.charAt(0).toUpperCase() : "";
      return { j: t.j, key: initial ? `${initial}. ${t.key}` : t.key };
    }
    return t;
  });
}

// Sprint Combos & Awards F3: estrategia determinista de pick scorer.
// Para un iso3 del squad ya cargado, prioriza:
//   1. Delantero titular con mayor valor_eur.
//   2. Centrocampista titular con mayor valor_eur (fallback).
// Devuelve la key formato corto resuelta por resolveKeysForSquad, o null
// si el squad no tiene titulares en esos buckets.
export function pickDeterministicScorer(
  jugadores: SquadPlayer[],
  iso3: string,
  equiposPlayers: EquiposPlayersByIso3,
): string | null {
  if (!Array.isArray(jugadores) || jugadores.length === 0) return null;
  const resolved = resolveKeysForSquad(jugadores, iso3, equiposPlayers);
  const keyByJugador = new Map<SquadPlayer, string>();
  for (const r of resolved) keyByJugador.set(r.j, r.key);

  const titulares = jugadores.filter((j) => j.es_titular);
  if (titulares.length === 0) return null;
  const val = (j: SquadPlayer) =>
    (typeof j.valor_eur === "number" ? j.valor_eur : 0);

  const fws = titulares
    .filter((j) => j.posicion === "Delantero")
    .sort((a, b) => val(b) - val(a));
  if (fws.length > 0) return keyByJugador.get(fws[0]) || null;

  const mfs = titulares
    .filter((j) => j.posicion === "Centrocampista")
    .sort((a, b) => val(b) - val(a));
  if (mfs.length > 0) return keyByJugador.get(mfs[0]) || null;

  return null;
}
