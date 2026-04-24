// Capa de datos: único punto de acceso a Supabase para el motor IA (spec §6).
//
// Responsabilidades:
//   1. Obtener el snapshot activo (is_active = true) — 1 por invariante DB.
//   2. Cargar ELO / H2H / Racha en cache de módulo (1h TTL, force-invalidate
//      tras freeze_snapshot).
//   3. Canonicalizar lookup H2H: el par en BD siempre es team_a < team_b en
//      alfabético; aquí se reorienta a la perspectiva de `home`.
//   4. Upsert de predicciones + lookup de predicción cacheada por snapshot.
//
// Cache en memoria de módulo: persiste entre invocaciones calientes del EF.
// Se invalida con loadCache(..., force=true) tras freeze_snapshot.

import type {
  H2HData,
  Prediction,
  RachaData,
  TeamForm,
} from "./predictor.ts";

// Supabase client se importa de forma lazy para no arrastrar tipos desde aquí.
// El caller pasa una instancia ya construida.
// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

// ─── Cache de módulo ────────────────────────────────────────────────────────

export interface SnapshotCache {
  snapshot_id: number;
  snapshot_label: string;
  loaded_at: number;
  elo: Map<string, number>;
  // Clave canonical `${team_a}|${team_b}` con team_a < team_b alfabético.
  // Valores: home_wins / away_wins son alias de team_a_wins / team_b_wins —
  // NO renombrar (spec §6.3). La orientación al home real se hace en lookupH2H.
  h2h: Map<string, H2HData>;
  racha: Map<string, TeamForm>;
}

let CACHE: SnapshotCache | null = null;
const CACHE_TTL_MS = 60 * 60 * 1000; // 1h fallback (spec §6.1)

// ─── Snapshot activo ────────────────────────────────────────────────────────

export async function getActiveSnapshot(supa: SupabaseClient): Promise<{
  id: number;
  snapshot_date: string;
  label: string;
}> {
  const { data, error } = await supa
    .from("ia_snapshots")
    .select("id, snapshot_date, label")
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`get_active_snapshot: ${error.message}`);
  if (!data) throw new Error("no_active_snapshot");
  return data;
}

// ─── Carga del cache ────────────────────────────────────────────────────────

export async function loadCache(
  supa: SupabaseClient,
  force = false,
): Promise<SnapshotCache> {
  if (!force && CACHE && Date.now() - CACHE.loaded_at < CACHE_TTL_MS) {
    return CACHE;
  }

  const active = await getActiveSnapshot(supa);

  const [eloRes, h2hRes, last5Res] = await Promise.all([
    supa.from("ia_elo_fifa").select("team_code, elo_points"),
    supa.from("ia_h2h").select(
      "team_a_code, team_b_code, team_a_wins, team_b_wins, draws, matches",
    ),
    supa.from("ia_last5_results").select("team_code, wins, draws, losses"),
  ]);

  if (eloRes.error) throw new Error(`load_elo: ${eloRes.error.message}`);
  if (h2hRes.error) throw new Error(`load_h2h: ${h2hRes.error.message}`);
  if (last5Res.error) {
    throw new Error(`load_last5: ${last5Res.error.message}`);
  }

  const elo = new Map<string, number>();
  for (const row of eloRes.data || []) {
    if (row.team_code && typeof row.elo_points === "number") {
      elo.set(row.team_code, Number(row.elo_points));
    }
  }

  // H2H: guardamos perspectiva team_a (home_wins = team_a_wins).
  // total = matches.total si existe, si no = sum(wins/draws/losses).
  const h2h = new Map<string, H2HData>();
  for (const row of h2hRes.data || []) {
    const ta = row.team_a_code;
    const tb = row.team_b_code;
    if (!ta || !tb) continue;
    const teamAWins = Number(row.team_a_wins) || 0;
    const teamBWins = Number(row.team_b_wins) || 0;
    const draws = Number(row.draws) || 0;
    let total = teamAWins + teamBWins + draws;
    const matchesJson = row.matches;
    if (matchesJson && typeof matchesJson.total === "number") {
      total = matchesJson.total;
    }
    h2h.set(`${ta}|${tb}`, {
      home_wins: teamAWins, // alias de team_a_wins — ver spec §6.3
      away_wins: teamBWins,
      draws,
      total,
    });
  }

  const racha = new Map<string, TeamForm>();
  for (const row of last5Res.data || []) {
    if (!row.team_code) continue;
    const wins = Number(row.wins) || 0;
    const draws = Number(row.draws) || 0;
    const losses = Number(row.losses) || 0;
    racha.set(row.team_code, {
      wins,
      draws,
      losses,
      n_matches: wins + draws + losses,
    });
  }

  CACHE = {
    snapshot_id: active.id,
    snapshot_label: active.label,
    loaded_at: Date.now(),
    elo,
    h2h,
    racha,
  };
  return CACHE;
}

// Permite invalidación explícita (p.ej. tras freeze_snapshot).
export function invalidateCache(): void {
  CACHE = null;
}

// ─── Lookups ────────────────────────────────────────────────────────────────

// Lookup H2H canonical: la BD siempre almacena con team_a < team_b. Reorientamos
// la perspectiva al `home` real del partido que vamos a computar.
export function lookupH2H(
  cache: SnapshotCache,
  home: string,
  away: string,
): H2HData | null {
  const [a, b] = home < away ? [home, away] : [away, home];
  const key = `${a}|${b}`;
  const raw = cache.h2h.get(key);
  if (!raw) return null;

  const homeIsA = home === a;
  return {
    // raw.home_wins ≡ team_a_wins. Si home es team_a, ese es su contador.
    home_wins: homeIsA ? raw.home_wins : raw.away_wins,
    away_wins: homeIsA ? raw.away_wins : raw.home_wins,
    draws: raw.draws,
    total: raw.total,
  };
}

// ELO es bloqueante: si falta el team, no podemos predecir (el motor requiere
// ambos ELO como inputs obligatorios). El caller debe capturar y devolver 500
// con `elo_missing:XXX` al usuario.
export function lookupElo(cache: SnapshotCache, iso3: string): number {
  const v = cache.elo.get(iso3);
  if (v === undefined) throw new Error(`elo_missing:${iso3}`);
  return v;
}

// Racha es best-effort: si el team no tiene racha poblada, devolvemos
// TeamForm con n_matches=0. El motor trata ese caso como ppg=1 (forma media).
export function lookupTeamForm(cache: SnapshotCache, iso3: string): TeamForm {
  return cache.racha.get(iso3) ??
    { wins: 0, draws: 0, losses: 0, n_matches: 0 };
}

export function buildRachaData(
  cache: SnapshotCache,
  home: string,
  away: string,
): RachaData {
  return {
    home: lookupTeamForm(cache, home),
    away: lookupTeamForm(cache, away),
  };
}

// ─── Persistencia de predicciones ───────────────────────────────────────────

// Datos crudos en unidades humanas (ELO absoluto, W-D-L absolutos, ppg real).
// El motor trabaja con señales normalizadas en [-1,+1]; estos crudos se
// persisten en breakdown sólo para que el frontend pueda construir el
// tooltip explicativo del % de confianza sin tener que replicar la fórmula.
// Opcional en upsertPrediction para no romper tests y calls históricas.
export interface PredictionRawContext {
  elo_home_raw: number;
  elo_away_raw: number;
  h2h_home_wins: number;
  h2h_away_wins: number;
  h2h_draws: number;
  h2h_total: number;
  form_home_ppg: number;
  form_away_ppg: number;
  is_host: boolean;
}

export async function upsertPrediction(
  supa: SupabaseClient,
  match_id: string,
  home: string,
  away: string,
  prediction: Prediction,
  snapshot_id: number,
  is_ko_ondemand: boolean,
  quip: string | null,
  rawContext?: PredictionRawContext,
): Promise<void> {
  const confidence = Math.round(prediction.p_max * 100);
  // deno-lint-ignore no-explicit-any
  const breakdown: Record<string, any> = {
    elo_signal: prediction.breakdown.elo_signal,
    h2h_signal: prediction.breakdown.h2h_signal,
    racha_signal: prediction.breakdown.racha_signal,
    draw_score: prediction.breakdown.draw_score,
    home_advantage: prediction.breakdown.home_advantage,
    weights_used: prediction.breakdown.weights_used,
    scores: prediction.breakdown.scores,
    raw_home_pct: prediction.p_home,
    p_home: prediction.p_home,
    p_draw: prediction.p_draw,
    p_away: prediction.p_away,
    p_max: prediction.p_max,
    margin: prediction.margin,
    is_dudoso: prediction.is_dudoso,
    quip,
  };
  if (rawContext) {
    breakdown.elo_home_raw = rawContext.elo_home_raw;
    breakdown.elo_away_raw = rawContext.elo_away_raw;
    breakdown.h2h_home_wins = rawContext.h2h_home_wins;
    breakdown.h2h_away_wins = rawContext.h2h_away_wins;
    breakdown.h2h_draws = rawContext.h2h_draws;
    breakdown.h2h_total = rawContext.h2h_total;
    breakdown.form_home_ppg = rawContext.form_home_ppg;
    breakdown.form_away_ppg = rawContext.form_away_ppg;
    breakdown.is_host = rawContext.is_host;
  }
  const row = {
    match_id,
    home_code: home,
    away_code: away,
    sign: prediction.sign,
    confidence,
    breakdown,
    used_fallback: prediction.used_fallback,
    snapshot_id,
    is_ko_ondemand,
    computed_at: new Date().toISOString(),
  };

  const { error } = await supa
    .from("ia_predictions")
    .upsert(row, { onConflict: "match_id" });
  if (error) throw new Error(`upsert_prediction: ${error.message}`);
}

// Busca una predicción cacheada en BD (para compute_match, evita recomputar).
// Devuelve null si no existe para el snapshot activo.
export async function findCachedPrediction(
  supa: SupabaseClient,
  home: string,
  away: string,
  snapshot_id: number,
): Promise<{ prediction: Prediction; quip: string | null } | null> {
  const { data, error } = await supa
    .from("ia_predictions")
    .select("sign, confidence, breakdown, used_fallback")
    .eq("home_code", home)
    .eq("away_code", away)
    .eq("snapshot_id", snapshot_id)
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`find_cached_prediction: ${error.message}`);
  if (!data || !data.breakdown) return null;

  const b = data.breakdown;
  // Reconstruir la Prediction desde el breakdown denso que guardamos.
  const prediction: Prediction = {
    p_home: b.p_home,
    p_draw: b.p_draw,
    p_away: b.p_away,
    sign: data.sign,
    p_max: b.p_max,
    margin: b.margin,
    is_dudoso: b.is_dudoso,
    used_fallback: data.used_fallback,
    breakdown: {
      elo_signal: b.elo_signal,
      h2h_signal: b.h2h_signal,
      racha_signal: b.racha_signal,
      draw_score: b.draw_score,
      home_advantage: b.home_advantage,
      weights_used: b.weights_used,
      scores: b.scores,
    },
  };
  return { prediction, quip: b.quip ?? null };
}
