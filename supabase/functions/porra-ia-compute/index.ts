import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

import {
  PREDICTOR_CONFIG,
  predict,
  type H2HData,
  type Prediction,
} from "./lib/predictor.ts";
import {
  buildRachaData,
  findCachedPrediction,
  getActiveSnapshot,
  invalidateCache,
  loadCache,
  lookupElo,
  lookupH2H,
  type PredictionRawContext,
  type SnapshotCache,
  upsertPrediction,
} from "./lib/repository.ts";
import {
  requireAdmin,
  requireAdminOrCron,
  requireAuth,
} from "./lib/auth.ts";
import { generateQuip } from "./lib/quipGenerator.ts";
import {
  resolveIso3,
  WC2026_ISO3,
  WC2026_TEAMS,
} from "./lib/wc2026.ts";
import {
  pickDeterministicScorer,
  type EquiposPlayersByIso3,
  type SquadPlayer,
} from "./lib/scorer-keys.ts";

// ─── CORS whitelist ────────────────────────────────────────────────────────
const ALLOWED_ORIGIN_REGEXES: RegExp[] = [
  /^https:\/\/porramundial2026-seven\.vercel\.app$/,
  /^https:\/\/porramundial2026[\w-]*\.vercel\.app$/,
  /^http:\/\/localhost:5173$/,
];

function cors(origin: string | null): Record<string, string> {
  if (origin && ALLOWED_ORIGIN_REGEXES.some((re) => re.test(origin))) {
    return {
      "Access-Control-Allow-Origin": origin,
      "Access-Control-Allow-Headers":
        "authorization, content-type, x-cron-key, x-client-info, apikey",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    };
  }
  return {};
}

// Headers para respuestas internas (scraping / cron / compute_groups).
// Mantiene los headers anchos que se usaban antes para que los calls SQL
// desde Supabase MCP sigan funcionando si no mandan Origin.
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ─── Rate limit en memoria (spec §8.4) ─────────────────────────────────────
const RATE_LIMITS = new Map<string, { count: number; window_start: number }>();
const RATE_LIMIT_MAX = 30;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const entry = RATE_LIMITS.get(userId);
  if (!entry || now - entry.window_start > RATE_LIMIT_WINDOW_MS) {
    RATE_LIMITS.set(userId, { count: 1, window_start: now });
    return true;
  }
  if (entry.count >= RATE_LIMIT_MAX) return false;
  entry.count++;
  return true;
}

// ─── Cache del JSON de partidos del Mundial ────────────────────────────────
// El EF no tiene acceso al FS del proyecto Vite. Se sirve vía Vercel.
// Se cachea entre invocaciones calientes; se invalida implícitamente al frío.
// deno-lint-ignore no-explicit-any
let MATCHES_CACHE: Record<string, any> | null = null;
const MATCHES_URL =
  "https://porramundial2026-seven.vercel.app/data/worldcup-2026-matches.json";

// deno-lint-ignore no-explicit-any
async function loadMatches(): Promise<Record<string, any>> {
  if (MATCHES_CACHE) return MATCHES_CACHE;
  const res = await fetch(MATCHES_URL, {
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) throw new Error(`matches_fetch:HTTP ${res.status}`);
  MATCHES_CACHE = await res.json();
  return MATCHES_CACHE!;
}

// Sprint Combos & Awards F3 (28-may) — EQUIPOS[].players mapeados a JSON por
// scripts/export-equipos-players.mjs (prebuild). Consumido por update_ia_scorers
// para que playerToShortKey preserve keys históricas (Mbappe, Yamal, Kane…)
// idénticas a las del frontend (public/js/scoring.js).
const EQUIPOS_PLAYERS_URL =
  "https://porramundial2026-seven.vercel.app/data/equipos-players.json";
let EQUIPOS_PLAYERS_CACHE: EquiposPlayersByIso3 | null = null;
let EQUIPOS_PLAYERS_CACHE_TS = 0;
const EQUIPOS_PLAYERS_CACHE_TTL_MS = 60 * 60 * 1000; // 1h

async function loadEquiposPlayers(): Promise<EquiposPlayersByIso3> {
  const now = Date.now();
  if (
    EQUIPOS_PLAYERS_CACHE &&
    (now - EQUIPOS_PLAYERS_CACHE_TS) < EQUIPOS_PLAYERS_CACHE_TTL_MS
  ) {
    return EQUIPOS_PLAYERS_CACHE;
  }
  const res = await fetch(EQUIPOS_PLAYERS_URL, {
    headers: { "Accept": "application/json" },
  });
  if (!res.ok) throw new Error(`equipos_players_fetch:HTTP ${res.status}`);
  EQUIPOS_PLAYERS_CACHE = await res.json();
  EQUIPOS_PLAYERS_CACHE_TS = now;
  return EQUIPOS_PLAYERS_CACHE!;
}

const ALIAS_MAP: Record<string, string> = {
  "United States": "USA",
  "South Korea": "KOR",
  "North Korea": "PRK",
  "Turkey": "TUR",
  "Ivory Coast": "CIV",
  "Cape Verde": "CPV",
  "DR Congo": "COD",
  "Congo DR": "COD",
  "Congo": "CGO",
  "Czech Republic": "CZE",
  "Czechia": "CZE",
  "Bosnia and Herzegovina": "BIH",
  "North Macedonia": "MKD",
  "Saudi Arabia": "KSA",
  "United Arab Emirates": "UAE",
  "Trinidad and Tobago": "TRI",
  "Antigua and Barbuda": "ATG",
  "Saint Kitts and Nevis": "SKN",
  "Saint Vincent and the Grenadines": "VIN",
  "Saint Lucia": "LCA",
};

const MONTHS: Record<string, string> = {
  January: "01", February: "02", March: "03", April: "04",
  May: "05", June: "06", July: "07", August: "08",
  September: "09", October: "10", November: "11", December: "12",
};

const MONTHS_ABBR: Record<string, string> = {
  Jan: "01", Feb: "02", Mar: "03", Apr: "04",
  May: "05", Jun: "06", Jul: "07", Aug: "08",
  Sep: "09", Oct: "10", Nov: "11", Dec: "12",
};

// WC2026_TEAMS ahora vive en ./lib/wc2026.ts (importado arriba).

serve(async (req) => {
  const origin = req.headers.get("origin");
  const corsH = cors(origin);
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsH });

  // Supabase client con service_role para que las EFs internas puedan leer
  // de tablas con RLS restringida. La auth del caller se valida aparte abajo.
  let supa: any;
  try {
    supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
  } catch (e) {
    console.error("supa_init_error:", String((e as any)?.message || e));
    return errJson("internal", 500, origin);
  }

  const body = await req.json().catch(() => ({}));
  const action = body?.action;

  try {
    switch (action) {
      // ── Existentes (Fases A-D.2 + C) ──────────────────────────────────
      case "status":
        // Spec §8.1 marca "status: user" pero handler existente no tenía auth.
        // Mantengo el comportamiento previo (no auth) para no romper flows SQL.
        return json(await handleStatus(supa), 200, corsH);

      case "scrape_elo":
        await requireAdmin(req, supa);
        return json(await handleScrapeElo(supa, body), 200, corsH);

      case "scrape_h2h":
        await requireAdmin(req, supa);
        return json(await handleScrapeH2h(supa, body), 200, corsH);

      case "scrape_last5":
        await requireAdmin(req, supa);
        return json(await handleScrapeLast5(supa, body), 200, corsH);

      // ── Nuevas Fase E ─────────────────────────────────────────────────
      case "freeze_snapshot":
        await requireAdminOrCron(req, supa);
        return json(await handleFreezeSnapshot(supa, body), 200, corsH);

      case "compute_groups":
        await requireAdminOrCron(req, supa);
        return json(await handleComputeGroups(supa), 200, corsH);

      case "compute_match": {
        const userId = await requireAuth(req, supa);
        if (!checkRateLimit(userId)) {
          return errJson("rate_limit", 429, origin);
        }
        return json(await handleComputeMatch(supa, body), 200, corsH);
      }

      // ── F7.7-IA C2: Bot IA Zayu ───────────────────────────────────────
      case "seed_ia_user":
        await requireAdminOrCron(req, supa);
        return json(await handleSeedIaUser(supa), 200, corsH);

      case "seed_ia_user_predictions":
        await requireAdminOrCron(req, supa);
        return json(await handleSeedIaUserPredictions(supa, body), 200, corsH);

      // ── Sprint Combos & Awards F3 (28-may) — backfill bot Zayu scorers ──
      case "update_ia_scorers":
        await requireAdminOrCron(req, supa);
        return json(await handleUpdateIaScorers(supa, body), 200, corsH);

      default:
        return errJson("unknown_action", 400, origin);
    }
  } catch (e) {
    const msg = String((e as any)?.message || e);
    if (msg === "unauthorized") return errJson("unauthorized", 401, origin);
    if (msg === "forbidden") return errJson("forbidden", 403, origin);
    if (msg === "bad_input") return errJson("bad_input", 400, origin);
    if (msg.startsWith("not_found:")) return errJson("not_found", 404, origin);
    console.error(`action_${action}_error:`, msg);
    return errJson("internal", 500, origin);
  }
});

// ─── Helper error responses (sin leaking de stack / internals) ──────────────
function errJson(
  code: string,
  status: number,
  origin: string | null,
): Response {
  return new Response(
    JSON.stringify({ error: code }),
    {
      status,
      headers: { "content-type": "application/json", ...cors(origin) },
    },
  );
}

async function handleStatus(supa: any) {
  const [elo, last5, h2h, preds] = await Promise.all([
    supa.from("ia_elo_fifa").select("team_code,scraped_at", { count: "exact" }).order("scraped_at", { ascending: false }).limit(1),
    supa.from("ia_last5_results").select("team_code,scraped_at", { count: "exact" }).order("scraped_at", { ascending: false }).limit(1),
    supa.from("ia_h2h").select("team_a_code,scraped_at", { count: "exact" }).order("scraped_at", { ascending: false }).limit(1),
    supa.from("ia_predictions").select("match_id,computed_at", { count: "exact" }).order("computed_at", { ascending: false }).limit(1),
  ]);
  return {
    elo: { count: elo.count, last_scraped: elo.data?.[0]?.scraped_at ?? null },
    last5: { count: last5.count, last_scraped: last5.data?.[0]?.scraped_at ?? null },
    h2h: { count: h2h.count, last_scraped: h2h.data?.[0]?.scraped_at ?? null },
    predictions: { count: preds.count, last_computed: preds.data?.[0]?.computed_at ?? null },
  };
}

async function handleScrapeElo(supa: any, _body: any) {
  try {
    const url = "https://en.wikipedia.org/w/api.php?action=parse&page=Module:SportsRankings/data/FIFA_World_Rankings&prop=wikitext&format=json";
    const res = await fetch(url, {
      headers: { "User-Agent": "pm26-ia-predictor/1.0", "Accept": "application/json" },
    });
    if (!res.ok) {
      return { ok: false, step: "fetch_wikipedia", error: `HTTP ${res.status}` };
    }

    let data: any;
    try {
      data = await res.json();
    } catch (e: any) {
      return { ok: false, step: "parse_response", error: String(e?.message || e) };
    }
    const wikitext: string = data?.parse?.wikitext?.["*"];
    if (typeof wikitext !== "string" || wikitext.length === 0) {
      return { ok: false, step: "parse_response", error: "wikitext missing in response" };
    }

    const dateMatch = wikitext.match(/data\.updated\s*=\s*\{\s*day\s*=\s*(\d+),\s*month\s*=\s*'(\w+)',\s*year\s*=\s*(\d+)/);
    if (!dateMatch) {
      return { ok: false, step: "parse_date", error: "updated pattern not found" };
    }
    const day = dateMatch[1].padStart(2, "0");
    const monthName = dateMatch[2];
    const year = dateMatch[3];
    const monthNum = MONTHS[monthName];
    if (!monthNum) {
      return { ok: false, step: "parse_date", error: `unknown month: ${monthName}` };
    }
    const fifaUpdateDate = `${year}-${monthNum}-${day}`;

    const rowRegex = /\{\s*"([^"]+)"\s*,\s*(\d+)\s*,\s*(-?\d+)\s*,\s*([\d.]+)\s*\}/g;
    const matches: Array<{ name: string; rank: number; points: number }> = [];
    let m: RegExpExecArray | null;
    while ((m = rowRegex.exec(wikitext)) !== null) {
      matches.push({ name: m[1], rank: Number(m[2]), points: Number(m[4]) });
    }
    if (matches.length === 0) {
      return { ok: false, step: "parse_rankings", error: "no ranking rows matched" };
    }

    const { data: existing, error: selectError } = await supa
      .from("ia_elo_fifa")
      .select("team_code,team_name");
    if (selectError) {
      return { ok: false, step: "upsert", error: `select ia_elo_fifa: ${selectError.message}` };
    }
    const nameToCode = new Map<string, string>();
    for (const r of existing || []) {
      if (r?.team_name && r?.team_code) {
        nameToCode.set(String(r.team_name).toLowerCase(), r.team_code);
      }
    }

    const now = new Date().toISOString();
    const unmatched_names: string[] = [];
    const seen = new Set<string>();
    const rows: any[] = [];
    for (const row of matches) {
      let code = nameToCode.get(row.name.toLowerCase());
      if (!code) code = ALIAS_MAP[row.name];
      if (!code) {
        code = row.name.slice(0, 3).toUpperCase();
        unmatched_names.push(row.name);
      }
      if (seen.has(code)) continue;
      seen.add(code);
      rows.push({
        team_code: code,
        team_name: row.name,
        elo_points: row.points,
        rank_position: row.rank,
        scraped_at: now,
        source: "wikipedia:Module:SportsRankings",
      });
    }

    const { error: upsertError } = await supa
      .from("ia_elo_fifa")
      .upsert(rows, { onConflict: "team_code" });
    if (upsertError) {
      return { ok: false, step: "upsert", error: upsertError.message };
    }

    return {
      ok: true,
      source: "wikipedia:Module:SportsRankings",
      fifa_update_date: fifaUpdateDate,
      countries_upserted: rows.length,
      unmatched_names,
    };
  } catch (e: any) {
    return { ok: false, step: "unknown", error: String(e?.message || e) };
  }
}

async function handleScrapeH2h(supa: any, _body: any) {
  try {
    if (WC2026_TEAMS.length !== 48) {
      return { ok: false, step: "config", error: `WC2026_TEAMS has ${WC2026_TEAMS.length} teams, expected 48` };
    }

    // nombre_lower → iso3 para filtrar rivales mundialistas por el texto que 11v11
    // usa en <td class="opposition">.
    const nameToIso = new Map<string, string>();
    for (const [iso3, , opposition_name] of WC2026_TEAMS) {
      nameToIso.set(opposition_name.toLowerCase(), iso3);
    }

    const now = new Date().toISOString();
    const missing_pages: Array<{ team: string; status: number | string }> = [];
    const allRows: any[] = [];
    const unmatchedSet = new Set<string>();
    let teams_parsed = 0;

    const rowRegex = /<td class="opposition">([^<]+)<\/td>\s*<td>(\d+)<\/td>\s*<td>(\d+)<\/td>\s*<td>(\d+)<\/td>\s*<td>(\d+)<\/td>\s*<td>(\d+)<\/td>\s*<td>(\d+)<\/td>/g;

    const fetchHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    };

    for (const [iso3, owner_slug] of WC2026_TEAMS) {
      const url = `https://www.11v11.com/teams/${owner_slug}/tab/stats/`;

      let res: Response;
      try {
        res = await fetch(url, { headers: fetchHeaders });
      } catch (e: any) {
        missing_pages.push({ team: iso3, status: `fetch_error:${String(e?.message || e)}` });
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      if (!res.ok) {
        missing_pages.push({ team: iso3, status: res.status });
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      let html: string;
      try {
        html = await res.text();
      } catch {
        missing_pages.push({ team: iso3, status: "parse_error" });
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      if (!html || html.length === 0) {
        missing_pages.push({ team: iso3, status: "empty_html" });
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      let rowsParsed = 0;
      rowRegex.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = rowRegex.exec(html)) !== null) {
        rowsParsed++;
        const oppName = m[1].trim();
        const opp_iso3 = nameToIso.get(oppName.toLowerCase());
        if (!opp_iso3) {
          unmatchedSet.add(oppName);
          continue;
        }
        if (opp_iso3 === iso3) continue;

        const P = Number(m[2]);
        const W = Number(m[3]);
        const D = Number(m[4]);
        const L = Number(m[5]);
        const GF = Number(m[6]);
        const GA = Number(m[7]);

        const team_a = iso3 < opp_iso3 ? iso3 : opp_iso3;
        const team_b = iso3 < opp_iso3 ? opp_iso3 : iso3;
        const thisIsA = iso3 === team_a;
        const team_a_wins = thisIsA ? W : L;
        const team_b_wins = thisIsA ? L : W;
        const draws = D;

        allRows.push({
          team_a_code: team_a,
          team_b_code: team_b,
          team_a_wins,
          team_b_wins,
          draws,
          last_played: null,
          scraped_at: now,
          matches: {
            total: P,
            gf_team_a: thisIsA ? GF : GA,
            ga_team_a: thisIsA ? GA : GF,
            source_team: iso3,
            source: "11v11.com/stats",
          },
        });
      }

      if (rowsParsed > 0) teams_parsed++;

      await new Promise((r) => setTimeout(r, 500));
    }

    // Dedup por pair (Postgres ON CONFLICT no permite afectar la misma fila dos
    // veces en un batch). Cada pair llega hasta 2 veces — una por cada página de
    // los dos mundialistas implicados. Mantenemos la primera ocurrencia.
    const pairMap = new Map<string, any>();
    for (const row of allRows) {
      const key = `${row.team_a_code}|${row.team_b_code}`;
      if (!pairMap.has(key)) pairMap.set(key, row);
    }
    const dedupedRows = Array.from(pairMap.values());

    let pairs_upserted = 0;
    if (dedupedRows.length > 0) {
      const { error: upsertError } = await supa
        .from("ia_h2h")
        .upsert(dedupedRows, { onConflict: "team_a_code,team_b_code" });
      if (upsertError) {
        return { ok: false, step: "upsert", error: upsertError.message };
      }
      pairs_upserted = dedupedRows.length;
    }

    return {
      ok: true,
      source: "11v11.com/stats",
      teams_fetched: WC2026_TEAMS.length,
      teams_parsed,
      missing_pages,
      pairs_upserted,
      rows_processed: allRows.length,
      unmatched_opponents: Array.from(unmatchedSet).slice(0, 20),
    };
  } catch (e: any) {
    return { ok: false, step: "unknown", error: String(e?.message || e) };
  }
}

async function handleScrapeLast5(supa: any, body: any) {
  try {
    if (WC2026_TEAMS.length !== 48) {
      return { ok: false, step: "config", error: `WC2026_TEAMS has ${WC2026_TEAMS.length} teams, expected 48` };
    }

    const rawLimit = Number(body?.limit);
    // Default 10 desde 10-jun-2026 (pre-torneo): captura los amistosos de la
    // semana previa sin diluir la señal de racha (rango admitido 1-20).
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(20, Math.max(1, Math.floor(rawLimit)))
      : 10;

    // opposition_name.toLowerCase() → iso3. Mismo map que Fase D.2: sirve tanto
    // para detectar al owner (home/away) como para resolver al rival.
    const nameToIso = new Map<string, string>();
    for (const [iso3, , opposition_name] of WC2026_TEAMS) {
      nameToIso.set(opposition_name.toLowerCase(), iso3);
    }

    const now = new Date().toISOString();
    const missing_pages: Array<{ team: string; status: number | string }> = [];
    let teams_parsed = 0;
    let rows_upserted = 0;

    // 6 grupos: (1) date, (2) match "Home v Away", (3) W|D|L, (4) home_score,
    // (5) away_score, (6) competition (opcional). <a> envolviendo el match name
    // también opcional para tolerar variaciones entre equipos.
    const rowRegex = /<td[^>]*>\s*([^<]+)<\/td>\s*<td[^>]*>(?:<a[^>]*>)?([^<]+?)(?:<\/a>)?<\/td>\s*<td[^>]*><span[^>]*>([WDL])<\/span><\/td>\s*<td[^>]*>\s*(\d+)-(\d+)[^<]*<\/td>(?:\s*<td[^>]*>([^<]*)<\/td>)?/g;

    const fetchHeaders = {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      "Accept": "text/html,application/xhtml+xml",
      "Accept-Language": "en-US,en;q=0.9",
    };

    for (const [iso3, owner_slug, opposition_name] of WC2026_TEAMS) {
      const url = `https://www.11v11.com/teams/${owner_slug}/tab/matches/`;
      const ownerNameLower = opposition_name.toLowerCase();

      let res: Response;
      try {
        res = await fetch(url, { headers: fetchHeaders });
      } catch (e: any) {
        missing_pages.push({ team: iso3, status: `fetch_error:${String(e?.message || e)}` });
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      if (!res.ok) {
        missing_pages.push({ team: iso3, status: res.status });
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      let html: string;
      try {
        html = await res.text();
      } catch {
        missing_pages.push({ team: iso3, status: "parse_error" });
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }
      if (!html || html.length === 0) {
        missing_pages.push({ team: iso3, status: "empty_html" });
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      const allMatches: any[] = [];
      rowRegex.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = rowRegex.exec(html)) !== null) {
        const dateStr = m[1].trim();
        const matchStr = m[2].trim();
        const result = m[3] as "W" | "D" | "L";
        const homeScore = Number(m[4]);
        const awayScore = Number(m[5]);
        const competition = (m[6] || "").trim() || null;

        // "04 Sep 2025" → "2025-09-04"
        const dateParts = dateStr.split(/\s+/);
        if (dateParts.length !== 3) continue;
        const [d, monAbbr, y] = dateParts;
        const monNum = MONTHS_ABBR[monAbbr];
        if (!monNum) continue;
        const date_iso = `${y}-${monNum}-${d.padStart(2, "0")}`;

        // "Home v Away"
        const vIdx = matchStr.indexOf(" v ");
        if (vIdx === -1) continue;
        const home_name = matchStr.slice(0, vIdx).trim();
        const away_name = matchStr.slice(vIdx + 3).trim();

        let owner_is_home: boolean;
        if (home_name.toLowerCase() === ownerNameLower) owner_is_home = true;
        else if (away_name.toLowerCase() === ownerNameLower) owner_is_home = false;
        else continue; // owner not found en ninguno de los dos lados — skip

        const opponent_name = owner_is_home ? away_name : home_name;
        const opponent_iso3 = nameToIso.get(opponent_name.toLowerCase()) ?? null;
        const gf = owner_is_home ? homeScore : awayScore;
        const ga = owner_is_home ? awayScore : homeScore;

        allMatches.push({
          date: date_iso,
          opponent_name,
          opponent_iso3,
          venue: owner_is_home ? "H" : "A",
          result,
          gf,
          ga,
          competition,
        });
      }

      if (allMatches.length === 0) {
        await new Promise((r) => setTimeout(r, 500));
        continue;
      }

      teams_parsed++;

      // HTML llega en orden ASCENDENTE por fecha (más antiguo primero). Los
      // últimos N = más recientes. Mantenemos el orden ascendente al guardar
      // para que el JSONB siga el mismo criterio que 11v11.
      const lastN = allMatches.slice(-limit);
      let wins = 0, draws = 0, losses = 0;
      for (const match of lastN) {
        if (match.result === "W") wins++;
        else if (match.result === "D") draws++;
        else if (match.result === "L") losses++;
      }

      const { error: upsertError } = await supa
        .from("ia_last5_results")
        .upsert(
          {
            team_code: iso3,
            results: lastN,
            wins,
            draws,
            losses,
            scraped_at: now,
          },
          { onConflict: "team_code" }
        );
      if (!upsertError) rows_upserted++;

      await new Promise((r) => setTimeout(r, 500));
    }

    return {
      ok: true,
      source: "11v11.com/matches",
      teams_fetched: WC2026_TEAMS.length,
      teams_parsed,
      limit,
      missing_pages,
      rows_upserted,
    };
  } catch (e: any) {
    return { ok: false, step: "unknown", error: String(e?.message || e) };
  }
}

function json(
  body: any,
  status = 200,
  extraHeaders: Record<string, string> = {},
) {
  // Si el caller pasó CORS del origen del request, lo mergeamos encima del
  // corsHeaders ancho (que sigue sirviendo para calls SQL sin Origin header).
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      ...extraHeaders,
      "content-type": "application/json",
    },
  });
}

// ─── Nuevos handlers Fase E ────────────────────────────────────────────────

// handleFreezeSnapshot (spec §8.2)
// Dispara scrape_elo + scrape_h2h + scrape_last5 en serie (NO paralelo —
// 11v11.com no lo tolera), cuenta registros, inserta en ia_snapshots,
// activa si corresponde, invalida cache, envía WhatsApp al admin.
async function handleFreezeSnapshot(supa: any, body: any) {
  const label: string = typeof body?.label === "string" && body.label.trim()
    ? body.label.trim()
    : `snapshot_${new Date().toISOString().slice(0, 10)}`;
  const activate: boolean = body?.activate !== false; // default true

  const startedAt = Date.now();
  const errors: Array<{ step: string; error: string }> = [];

  // ── 1. scrape_elo ───────────────────────────────────────────────────
  try {
    const r = await handleScrapeElo(supa, {});
    if (r?.ok === false) {
      errors.push({ step: "scrape_elo", error: `${r.step}:${r.error}` });
    }
  } catch (e) {
    errors.push({ step: "scrape_elo", error: String((e as any)?.message || e) });
  }

  // ── 2. scrape_h2h ───────────────────────────────────────────────────
  try {
    const r = await handleScrapeH2h(supa, {});
    if (r?.ok === false) {
      errors.push({ step: "scrape_h2h", error: `${r.step}:${r.error}` });
    }
  } catch (e) {
    errors.push({ step: "scrape_h2h", error: String((e as any)?.message || e) });
  }

  // ── 3. scrape_last5 ─────────────────────────────────────────────────
  try {
    const r = await handleScrapeLast5(supa, {});
    if (r?.ok === false) {
      errors.push({ step: "scrape_last5", error: `${r.step}:${r.error}` });
    }
  } catch (e) {
    errors.push({
      step: "scrape_last5",
      error: String((e as any)?.message || e),
    });
  }

  // ── 4. Contadores resultantes ───────────────────────────────────────
  const [eloCnt, h2hCnt, last5Cnt] = await Promise.all([
    supa.from("ia_elo_fifa").select("team_code", { count: "exact", head: true }),
    supa.from("ia_h2h").select("team_a_code", { count: "exact", head: true }),
    supa.from("ia_last5_results").select("team_code", {
      count: "exact",
      head: true,
    }),
  ]);
  const elo_count = eloCnt.count ?? 0;
  const h2h_count = h2hCnt.count ?? 0;
  const last5_count = last5Cnt.count ?? 0;

  // ── 5. Insert ia_snapshots ──────────────────────────────────────────
  const { data: insData, error: insErr } = await supa
    .from("ia_snapshots")
    .insert({
      label,
      elo_count,
      h2h_count,
      last5_count,
      is_active: false,
      created_by: "freeze_snapshot",
    })
    .select("id")
    .single();

  if (insErr || !insData) {
    errors.push({
      step: "insert_snapshot",
      error: insErr?.message || "insert_returned_null",
    });
    return {
      ok: false,
      errors,
      duration_ms: Date.now() - startedAt,
    };
  }

  const snapshot_id = insData.id;

  // ── 6. Activar (transacción: desactivar anterior, activar nuevo) ────
  let activated = false;
  if (activate) {
    const { error: deactErr } = await supa
      .from("ia_snapshots")
      .update({ is_active: false })
      .eq("is_active", true);
    if (deactErr) {
      errors.push({ step: "deactivate_previous", error: deactErr.message });
    } else {
      const { error: actErr } = await supa
        .from("ia_snapshots")
        .update({ is_active: true })
        .eq("id", snapshot_id);
      if (actErr) {
        errors.push({ step: "activate", error: actErr.message });
      } else {
        activated = true;
        invalidateCache();
      }
    }
  }

  // ── 7. WhatsApp fire-and-forget ─────────────────────────────────────
  let whatsapp_sent = false;
  try {
    const payload = {
      text:
        `🧊 IA snapshot "${label}" creado (id=${snapshot_id}). ELO ${elo_count} · H2H ${h2h_count} · last5 ${last5_count}. ${
          activated ? "Activo ahora." : "NO activado."
        }`,
    };
    const whRes = await fetch(
      `${Deno.env.get("SUPABASE_URL")}/functions/v1/porra-whatsapp-send`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization":
            `Bearer ${Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")}`,
        },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(4000),
      },
    );
    whatsapp_sent = whRes.ok;
    if (!whRes.ok) {
      console.warn(`whatsapp_send HTTP ${whRes.status}`);
    }
  } catch (e) {
    console.warn(`whatsapp_send failed: ${String((e as any)?.message || e)}`);
  }

  return {
    ok: errors.length === 0,
    snapshot_id,
    elo_count,
    h2h_count,
    last5_count,
    activated,
    errors,
    notifications: { whatsapp_sent },
    duration_ms: Date.now() - startedAt,
  };
}

// ppg en unidades humanas para el breakdown del tooltip (commit 1 post-F).
// Mismo criterio que predictor.ts::ppg (3*W + D) / n_matches con fallback 1.0
// cuando no hay partidos. Redondeo a 2 decimales para display.
function computePpg(form: {
  wins: number;
  draws: number;
  losses: number;
  n_matches: number;
}): number {
  if (form.n_matches === 0) return 1.0;
  const raw = (3 * form.wins + form.draws) / form.n_matches;
  return Math.round(raw * 100) / 100;
}

// Concurrency limit para llamadas a Anthropic API en compute_groups.
async function mapConcurrent<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  async function worker() {
    while (true) {
      const i = cursor++;
      if (i >= items.length) break;
      results[i] = await fn(items[i], i);
    }
  }
  const workers = [];
  for (let i = 0; i < Math.min(concurrency, items.length); i++) {
    workers.push(worker());
  }
  await Promise.all(workers);
  return results;
}

// handleComputeGroups (spec §8.3)
// Procesa los 72 partidos de fase de grupos del Mundial y hace UPSERT en
// ia_predictions con el snapshot activo.
async function handleComputeGroups(supa: any) {
  const startedAt = Date.now();

  // Cache fresco (force=true) — el caller típico es cron/admin y queremos
  // los datos más recientes tras freeze.
  const cache: SnapshotCache = await loadCache(supa, true);

  const matches = await loadMatches();
  const matchIds = Object.keys(matches);

  if (matchIds.length === 0) {
    return {
      ok: false,
      step: "matches_empty",
      error: "worldcup-2026-matches.json vacío",
      duration_ms: Date.now() - startedAt,
    };
  }

  const anthropicKey = (Deno.env.get("ANTHROPIC_API_KEY") || "").trim() || null;

  const errors: Array<{ match_id: string; error: string }> = [];

  // Precomputar predictions (barato, in-memory), después quips en paralelo (5x).
  type WorkItem = {
    match_id: string;
    home_code: string;
    away_code: string;
    prediction: Prediction;
    eloHome: number;
    eloAway: number;
    h2h: H2HData | null;
    isHostMatch: boolean;
    rawContext: PredictionRawContext;
  };

  const workItems: WorkItem[] = [];
  for (const match_id of matchIds) {
    try {
      const m = matches[match_id];
      const home_name = m.home_en;
      const away_name = m.away_en;
      const home_code = resolveIso3(home_name);
      const away_code = resolveIso3(away_name);
      if (!home_code || !away_code) {
        errors.push({
          match_id,
          error: `resolve_iso3:home=${home_name}|away=${away_name}`,
        });
        continue;
      }

      const eloHome = lookupElo(cache, home_code);
      const eloAway = lookupElo(cache, away_code);
      const h2h = lookupH2H(cache, home_code, away_code);
      const racha = buildRachaData(cache, home_code, away_code);

      // En grupos, los hosts juegan en casa → is_host_match si home es host.
      const isHostMatch = PREDICTOR_CONFIG.HOST_COUNTRIES.has(home_code);

      const prediction = predict(
        { elo_home: eloHome, elo_away: eloAway, is_host_match: isHostMatch, home_code },
        h2h,
        racha,
      );

      const rawContext: PredictionRawContext = {
        elo_home_raw: eloHome,
        elo_away_raw: eloAway,
        h2h_home_wins: h2h?.home_wins ?? 0,
        h2h_away_wins: h2h?.away_wins ?? 0,
        h2h_draws: h2h?.draws ?? 0,
        h2h_total: h2h?.total ?? 0,
        form_home_ppg: computePpg(racha.home),
        form_away_ppg: computePpg(racha.away),
        is_host: isHostMatch,
      };

      workItems.push({
        match_id,
        home_code,
        away_code,
        prediction,
        eloHome,
        eloAway,
        h2h,
        isHostMatch,
        rawContext,
      });
    } catch (e) {
      errors.push({ match_id, error: String((e as any)?.message || e) });
    }
  }

  // Quip generation con concurrency 5 (spec §8.3 — saturación Anthropic).
  const QUIP_CONCURRENCY = 5;
  const quips = await mapConcurrent(workItems, QUIP_CONCURRENCY, (w) =>
    generateQuip(
      w.home_code,
      w.away_code,
      w.prediction,
      w.eloHome,
      w.eloAway,
      w.h2h,
      w.isHostMatch,
      anthropicKey,
    )
  );

  // UPSERTs secuenciales (baratos, <30s total para 72 filas).
  let predictions_upserted = 0;
  for (let i = 0; i < workItems.length; i++) {
    const w = workItems[i];
    try {
      await upsertPrediction(
        supa,
        w.match_id,
        w.home_code,
        w.away_code,
        w.prediction,
        cache.snapshot_id,
        false,
        quips[i],
        w.rawContext,
      );
      predictions_upserted++;
    } catch (e) {
      errors.push({
        match_id: w.match_id,
        error: String((e as any)?.message || e),
      });
    }
  }

  return {
    ok: errors.length === 0,
    snapshot_id: cache.snapshot_id,
    predictions_upserted,
    predictions_failed: errors.length,
    errors: errors.slice(0, 20), // no inflar response
    duration_ms: Date.now() - startedAt,
  };
}

// handleComputeMatch (spec §8.4)
// Una predicción on-demand. Si ya está cacheada en BD con el snapshot activo
// la devuelve. Si no, computa + UPSERT con is_ko_ondemand=true.
async function handleComputeMatch(supa: any, body: any) {
  const home = typeof body?.home === "string" ? body.home.toUpperCase() : null;
  const away = typeof body?.away === "string" ? body.away.toUpperCase() : null;

  if (!home || !away || home === away) throw new Error("bad_input");
  if (!WC2026_ISO3.has(home) || !WC2026_ISO3.has(away)) {
    throw new Error("bad_input");
  }

  const active = await getActiveSnapshot(supa);
  const snapshot_id = active.id;

  // Cache hit en BD → devolvemos directamente.
  const cached = await findCachedPrediction(supa, home, away, snapshot_id);
  if (cached) {
    const p = cached.prediction;
    return {
      ok: true,
      prediction: {
        p_home: p.p_home,
        p_draw: p.p_draw,
        p_away: p.p_away,
        sign: p.sign,
        p_max: p.p_max,
        margin: p.margin,
        is_dudoso: p.is_dudoso,
        used_fallback: p.used_fallback,
      },
      quip: cached.quip,
      snapshot_id,
      cached: true,
    };
  }

  // Miss → cargar cache + computar.
  const cache = await loadCache(supa);

  let eloHome: number;
  let eloAway: number;
  try {
    eloHome = lookupElo(cache, home);
    eloAway = lookupElo(cache, away);
  } catch (e) {
    throw new Error(`not_found:elo:${String((e as any)?.message || e)}`);
  }
  const h2h = lookupH2H(cache, home, away);
  const racha = buildRachaData(cache, home, away);

  // compute_match: spec §8.4.6 → always is_host_match=false (KO en sedes
  // rotativas/neutras). Los grupos se computan vía compute_groups.
  const prediction = predict(
    { elo_home: eloHome, elo_away: eloAway, is_host_match: false, home_code: home },
    h2h,
    racha,
  );

  const anthropicKey = (Deno.env.get("ANTHROPIC_API_KEY") || "").trim() || null;
  const quip = await generateQuip(
    home,
    away,
    prediction,
    eloHome,
    eloAway,
    h2h,
    false,
    anthropicKey,
  );

  // match_id sintético para compute_match on-demand. Formato distinto de los
  // de grupos (wc2026_gX_<sofascore_id>) para no colisionar.
  const match_id = `ondemand_${home}_${away}_${snapshot_id}`;

  const rawContext: PredictionRawContext = {
    elo_home_raw: eloHome,
    elo_away_raw: eloAway,
    h2h_home_wins: h2h?.home_wins ?? 0,
    h2h_away_wins: h2h?.away_wins ?? 0,
    h2h_draws: h2h?.draws ?? 0,
    h2h_total: h2h?.total ?? 0,
    form_home_ppg: computePpg(racha.home),
    form_away_ppg: computePpg(racha.away),
    is_host: false, // KO on-demand: sedes neutras/rotativas (spec §8.4.6)
  };

  await upsertPrediction(
    supa,
    match_id,
    home,
    away,
    prediction,
    snapshot_id,
    true, // is_ko_ondemand
    quip,
    rawContext,
  );

  return {
    ok: true,
    prediction: {
      p_home: prediction.p_home,
      p_draw: prediction.p_draw,
      p_away: prediction.p_away,
      sign: prediction.sign,
      p_max: prediction.p_max,
      margin: prediction.margin,
      is_dudoso: prediction.is_dudoso,
      used_fallback: prediction.used_fallback,
    },
    quip,
    snapshot_id,
    cached: false,
  };
}

// ════════════════════════════════════════════════════════════════════════════
// F7.7-IA C2 — Bot IA Zayu
// ════════════════════════════════════════════════════════════════════════════
// Diseño: el bot es un usuario auth normal (is_bot=true en profiles). Sus filas
// en predictions/ko_predictions/award_picks son indistinguibles de las de un
// humano. Trigger DB replicate_bot_on_new_league copia desde la liga "source"
// (1ª en joined_at) cuando se crea una liga nueva. Esta EF cubre dos acciones:
//
//   1. seed_ia_user             → crea el bot (auth + profile + Biwenger member)
//   2. seed_ia_user_predictions → genera 72 group preds + 32 KO + 4 awards
//                                 SOLO para la liga indicada (source = Biwenger).
//
// Llamadas a Anthropic API: 4 web_search + 1 razonamiento integrador (5 total).
// ════════════════════════════════════════════════════════════════════════════

const BOT_EMAIL = "ia-bot@porramundial2026.local";
const BOT_DISPLAY_NAME = "IA Zayu";
const BIWENGER_LEAGUE_ID = "8017e591-7996-4fe5-852b-bd66be49f17c";

// ISO3 → nombre español (debe coincidir con EQUIPOS[].name en public/js/data.js).
const ISO3_TO_NAME_ES: Record<string, string> = {
  ALG: "Argelia", ARG: "Argentina", AUS: "Australia", AUT: "Austria",
  BEL: "Bélgica", BIH: "Bosnia y Herzegovina", BRA: "Brasil", CAN: "Canadá",
  CIV: "Costa de Marfil", COD: "RD Congo", COL: "Colombia", CPV: "Cabo Verde",
  CRO: "Croacia", CUW: "Curazao", CZE: "República Checa", ECU: "Ecuador",
  EGY: "Egipto", ENG: "Inglaterra", ESP: "España", FRA: "Francia",
  GER: "Alemania", GHA: "Ghana", HAI: "Haití", IRN: "RI de Irán",
  IRQ: "Irak", JOR: "Jordania", JPN: "Japón", KOR: "República de Corea",
  KSA: "Arabia Saudí", MAR: "Marruecos", MEX: "México", NED: "Países Bajos",
  NOR: "Noruega", NZL: "Nueva Zelanda", PAN: "Panamá", PAR: "Paraguay",
  POR: "Portugal", QAT: "Catar", RSA: "Sudáfrica", SCO: "Escocia",
  SEN: "Senegal", SUI: "Suiza", SWE: "Suecia", TUN: "Túnez",
  TUR: "Turquía", URU: "Uruguay", USA: "Estados Unidos", UZB: "Uzbekistán",
};

// Grupos A-L (debe coincidir con GRUPOS en public/js/data.js).
const GROUP_TO_ISO3: Record<string, string[]> = {
  A: ["MEX", "RSA", "KOR", "CZE"], B: ["CAN", "BIH", "QAT", "SUI"],
  C: ["BRA", "MAR", "HAI", "SCO"], D: ["USA", "PAR", "AUS", "TUR"],
  E: ["GER", "CUW", "CIV", "ECU"], F: ["NED", "JPN", "SWE", "TUN"],
  G: ["BEL", "EGY", "IRN", "NZL"], H: ["ESP", "CPV", "KSA", "URU"],
  I: ["FRA", "SEN", "IRQ", "NOR"], J: ["ARG", "ALG", "AUT", "JOR"],
  K: ["POR", "COD", "UZB", "COL"], L: ["ENG", "CRO", "GHA", "PAN"],
};

const ISO3_TO_GROUP: Record<string, string> = (() => {
  const m: Record<string, string> = {};
  for (const [letra, list] of Object.entries(GROUP_TO_ISO3)) {
    for (const iso of list) m[iso] = letra;
  }
  return m;
})();

// Bracket KO — debe coincidir con BRACKET en public/js/ko.js.
type KOMatch = { id: number; home: string; away: string };
const BRACKET_KO_ROUNDS: Array<{ round: string; matches: KOMatch[] }> = [
  { round: "r32", matches: [
    { id: 73, home: "2A", away: "2B" }, { id: 74, home: "1E", away: "T_ABCDF" },
    { id: 75, home: "1F", away: "2C" }, { id: 76, home: "1C", away: "2F" },
    { id: 77, home: "1I", away: "T_CDFGH" }, { id: 78, home: "2E", away: "2I" },
    { id: 79, home: "1A", away: "T_CEFHI" }, { id: 80, home: "1L", away: "T_EHIJK" },
    { id: 81, home: "1D", away: "T_BEFIJ" }, { id: 82, home: "1G", away: "T_AEHIJ" },
    { id: 83, home: "2K", away: "2L" }, { id: 84, home: "1H", away: "2J" },
    { id: 85, home: "1B", away: "T_EFGIJ" }, { id: 86, home: "1J", away: "2H" },
    { id: 87, home: "1K", away: "T_DEIJL" }, { id: 88, home: "2D", away: "2G" },
  ]},
  { round: "r16", matches: [
    { id: 89, home: "W74", away: "W77" }, { id: 90, home: "W73", away: "W75" },
    { id: 91, home: "W76", away: "W78" }, { id: 92, home: "W79", away: "W80" },
    { id: 93, home: "W83", away: "W84" }, { id: 94, home: "W81", away: "W82" },
    { id: 95, home: "W86", away: "W88" }, { id: 96, home: "W85", away: "W87" },
  ]},
  { round: "qf", matches: [
    { id: 97, home: "W89", away: "W90" }, { id: 98, home: "W93", away: "W94" },
    { id: 99, home: "W91", away: "W92" }, { id: 100, home: "W95", away: "W96" },
  ]},
  { round: "sf", matches: [
    { id: 101, home: "W97", away: "W98" }, { id: 102, home: "W99", away: "W100" },
  ]},
  { round: "third", matches: [{ id: 103, home: "L101", away: "L102" }] },
  { round: "final", matches: [{ id: 104, home: "W101", away: "W102" }] },
];

// Slots T_* asignados en el orden declarado a los 8 mejores 3os (matches ko.js).
const THIRD_SLOT_ORDER = [
  "T_ABCDF", "T_CDFGH", "T_CEFHI", "T_EHIJK",
  "T_BEFIJ", "T_AEHIJ", "T_EFGIJ", "T_DEIJL",
];

// Roster awards — sincronizado con AW_PLAYERS en public/js/scoring.js.
const AW_PLAYERS_LIST = [
  { key: "Messi", name: "Leo Messi", team: "Argentina", role: "fw" },
  { key: "Alvarez", name: "Julián Álvarez", team: "Argentina", role: "fw" },
  { key: "Dibu", name: "E. Martínez", team: "Argentina", role: "gk" },
  { key: "Mbappe", name: "Kylian Mbappé", team: "Francia", role: "fw" },
  { key: "Yamal", name: "Lamine Yamal", team: "España", role: "fw" },
  { key: "Nico", name: "Nico Williams", team: "España", role: "fw" },
  { key: "Morata", name: "Álvaro Morata", team: "España", role: "fw" },
  { key: "Rodri", name: "Rodri", team: "España", role: "mf" },
  { key: "Bellingham", name: "Jude Bellingham", team: "Inglaterra", role: "mf" },
  { key: "Kane", name: "Harry Kane", team: "Inglaterra", role: "fw" },
  { key: "Saka", name: "Bukayo Saka", team: "Inglaterra", role: "fw" },
  { key: "Vinicius", name: "Vinícius Jr.", team: "Brasil", role: "fw" },
  { key: "Endrick", name: "Endrick", team: "Brasil", role: "fw" },
  { key: "Ronaldo", name: "C. Ronaldo", team: "Portugal", role: "fw" },
  { key: "Bruno", name: "Bruno Fernandes", team: "Portugal", role: "mf" },
  { key: "Musiala", name: "Jamal Musiala", team: "Alemania", role: "mf" },
  { key: "Wirtz", name: "Florian Wirtz", team: "Alemania", role: "mf" },
  { key: "VanDijk", name: "Virgil van Dijk", team: "Países Bajos", role: "df" },
  { key: "Nunez", name: "Darwin Núñez", team: "Uruguay", role: "fw" },
  { key: "Modric", name: "Luka Modrić", team: "Croacia", role: "mf" },
  { key: "DeBruyne", name: "Kevin De Bruyne", team: "Bélgica", role: "mf" },
  { key: "Haaland", name: "Erling Haaland", team: "Noruega", role: "fw" },
];

const YOUNG_PLAYERS_LIST = [
  { key: "Lamine_Yamal", name: "Lamine Yamal", team: "España" },
  { key: "Estevao", name: "Estevao", team: "Brasil" },
  { key: "Pau_Cubarsi", name: "Pau Cubarsí", team: "España" },
  { key: "Franco_Mastantuono", name: "Franco Mastantuono", team: "Argentina" },
  { key: "Lennart_Karl", name: "Lennart Karl", team: "Alemania" },
  { key: "Max_Dowman", name: "Max Dowman", team: "Inglaterra" },
  { key: "Luka_Vuskovic", name: "Luka Vuskovic", team: "Croacia" },
  { key: "Ayyoub_Bouaddi", name: "Ayyoub Bouaddi", team: "Marruecos" },
  { key: "Geovany_Quenda", name: "Geovany Quenda", team: "Portugal" },
  { key: "Ethan_Nwaneri", name: "Ethan Nwaneri", team: "Inglaterra" },
  { key: "Rodrigo_Mora", name: "Rodrigo Mora", team: "Portugal" },
  { key: "Ibrahim_Mbaye", name: "Ibrahim Mbaye", team: "Senegal" },
  { key: "Konstantinos_Karetsas", name: "Konstantinos Karetsas", team: "Bélgica" },
  { key: "Rio_Ngumoha", name: "Rio Ngumoha", team: "Inglaterra" },
  { key: "Gilberto_Mora", name: "Gilberto Mora", team: "México" },
  { key: "Marc_Bernal", name: "Marc Bernal", team: "España" },
  { key: "Dro_Fernandez", name: "Dro Fernández", team: "Argentina" },
  { key: "Mohamed_Kader_Meite", name: "Mohamed Kader Meite", team: "Costa de Marfil" },
  { key: "Kendry_Paez", name: "Kendry Páez", team: "Ecuador" },
  { key: "Jorthy_Mokio", name: "Jorthy Mokio", team: "Bélgica" },
  { key: "Robinio_Vaz", name: "Robinio Vaz", team: "Países Bajos" },
];

// ──────────────────────────────────────────────────────────────────────────
// Helpers — derivar marcador de la prediction IA + standings + bracket
// ──────────────────────────────────────────────────────────────────────────

// Convierte (sign, p_max) en un marcador concreto plausible. Determinista.
function deriveScoreFromPrediction(
  sign: "1" | "X" | "2",
  pMax: number,
): [number, number] {
  if (sign === "X") return [1, 1];
  if (sign === "1") {
    if (pMax >= 0.7) return [2, 0];
    if (pMax >= 0.55) return [2, 1];
    return [1, 0];
  }
  if (pMax >= 0.7) return [0, 2];
  if (pMax >= 0.55) return [1, 2];
  return [0, 1];
}

type GroupStat = {
  name: string;
  pj: number;
  g: number;
  e: number;
  p: number;
  gf: number;
  gc: number;
  pts: number;
  gd: number;
};

// breakTieH2H — FIFA Art. 13 pasos 4-6 para calcGroupStandings.
// Paridad con v3BreakTieH2H de grupos-v3.js (JS frontend).
function breakTieH2H(
  tiedTeams: GroupStat[],
  letra: string,
  predictions: Record<string, { l: number; v: number }>,
): GroupStat[] {
  const h2h: Record<string, { pts: number; gd: number; gf: number }> = {};
  for (const t of tiedTeams) h2h[t.name] = { pts: 0, gd: 0, gf: 0 };
  for (const t1 of tiedTeams) {
    for (const t2 of tiedTeams) {
      if (t1.name === t2.name) continue;
      const pred = predictions[`${letra}_${t1.name}_${t2.name}`];
      if (!pred) continue;
      const s1 = h2h[t1.name], s2 = h2h[t2.name];
      s1.gf += pred.l; s2.gf += pred.v;
      s1.gd += (pred.l - pred.v); s2.gd += (pred.v - pred.l);
      if (pred.l > pred.v)      { s1.pts += 3; }
      else if (pred.l < pred.v) { s2.pts += 3; }
      else                      { s1.pts += 1; s2.pts += 1; }
    }
  }
  return [...tiedTeams].sort((a, b) => {
    const ha = h2h[a.name], hb = h2h[b.name];
    return (hb.pts - ha.pts) || (hb.gd - ha.gd) || (hb.gf - ha.gf)
      || a.name.localeCompare(b.name);
  });
}

// Replica calcGroupTableAdvanced(letra) de public/js/scoring.js + Art. 13 H2H.
// Paridad con v3ComputeStandings de grupos-v3.js. Clave de predicciones:
// `${letra}_${teamNameES}_${teamNameES}` (local_visitante).
function calcGroupStandings(
  letra: string,
  predictions: Record<string, { l: number; v: number }>,
): GroupStat[] {
  const teams = GROUP_TO_ISO3[letra].map((iso) => ISO3_TO_NAME_ES[iso]);
  const stats: GroupStat[] = teams.map((name) => ({
    name, pj: 0, g: 0, e: 0, p: 0, gf: 0, gc: 0, pts: 0, gd: 0,
  }));
  // Iterar todas las parejas dentro del grupo (6 partidos por grupo)
  for (const home of teams) {
    for (const away of teams) {
      if (home === away) continue;
      const pred = predictions[`${letra}_${home}_${away}`];
      if (!pred) continue;
      const h = stats.find((s) => s.name === home);
      const a = stats.find((s) => s.name === away);
      if (!h || !a) continue;
      h.pj++; a.pj++;
      h.gf += pred.l; h.gc += pred.v;
      a.gf += pred.v; a.gc += pred.l;
      if (pred.l > pred.v)      { h.g++; h.pts += 3; a.p++; }
      else if (pred.l < pred.v) { a.g++; a.pts += 3; h.p++; }
      else                      { h.e++; a.e++; h.pts += 1; a.pts += 1; }
    }
  }
  for (const s of stats) s.gd = s.gf - s.gc;

  // FIFA Art. 13 fases 1-3
  stats.sort((a, b) => (b.pts - a.pts) || (b.gd - a.gd) || (b.gf - a.gf));

  // FIFA Art. 13 fases 4-6: H2H entre subgrupos empatados en (pts, gd, gf).
  const result: GroupStat[] = [];
  let i = 0;
  while (i < stats.length) {
    let j = i + 1;
    while (j < stats.length
        && stats[j].pts === stats[i].pts
        && stats[j].gd  === stats[i].gd
        && stats[j].gf  === stats[i].gf) { j++; }
    let group = stats.slice(i, j);
    if (group.length > 1) group = breakTieH2H(group, letra, predictions);
    result.push(...group);
    i = j;
  }
  return result;
}

// Mejores 8 terceros — mismo orden que getBestThirdsAll() del frontend.
function getBestThirds(
  tables: Record<string, GroupStat[]>,
): string[] {
  const thirds: Array<GroupStat & { group: string }> = [];
  for (const [letra, table] of Object.entries(tables)) {
    if (table[2]) thirds.push({ ...table[2], group: letra });
  }
  thirds.sort((a, b) => (b.pts - a.pts) || (b.gd - a.gd) || (b.gf - a.gf));
  return thirds.slice(0, 8).map((t) => t.name);
}

// ──────────────────────────────────────────────────────────────────────────
// handleSeedIaUser — crea el bot (auth user + profile + Biwenger member)
// ──────────────────────────────────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
async function handleSeedIaUser(supa: any) {
  const { data: existing } = await supa
    .from("profiles")
    .select("id, nombre")
    .eq("is_bot", true)
    .limit(1)
    .maybeSingle();
  if (existing?.id) {
    return { ok: true, bot_id: existing.id, created: false };
  }

  // Generar password 64 chars hex aleatorios
  const pwBytes = new Uint8Array(32);
  crypto.getRandomValues(pwBytes);
  const password = Array.from(pwBytes)
    .map((b) => b.toString(16).padStart(2, "0")).join("");

  const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

  const adminRes = await fetch(`${supabaseUrl}/auth/v1/admin/users`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "apikey": serviceRole,
      "Authorization": `Bearer ${serviceRole}`,
    },
    body: JSON.stringify({
      email: BOT_EMAIL,
      password,
      email_confirm: true,
      user_metadata: { is_bot: true, display_name: BOT_DISPLAY_NAME },
    }),
  });
  if (!adminRes.ok) {
    const txt = await adminRes.text();
    throw new Error(`auth_admin_create:${adminRes.status}:${txt.slice(0, 120)}`);
  }
  const userJson = await adminRes.json();
  const botId: string | undefined = userJson?.id || userJson?.user?.id;
  if (!botId) throw new Error("auth_admin_create:no_id");

  const nowIso = new Date().toISOString();
  const { error: profErr } = await supa.from("profiles").insert({
    id: botId,
    nombre: BOT_DISPLAY_NAME,
    is_bot: true,
    is_admin: false,
    inscrito: true,
    porra_cerrada: true,
    cerrada_at: nowIso,
  });
  if (profErr) throw new Error(`profile_insert:${profErr.message}`);

  const { error: lmErr } = await supa.from("league_members").insert({
    league_id: BIWENGER_LEAGUE_ID,
    user_id: botId,
    joined_at: nowIso,
    porra_cerrada: true,
    cerrada_at: nowIso,
    groups_saved: {},
  });
  if (lmErr) throw new Error(`league_member_insert:${lmErr.message}`);

  return { ok: true, bot_id: botId, created: true };
}

// ──────────────────────────────────────────────────────────────────────────
// handleSeedIaUserPredictions — genera 72 group + 32 KO + 4 awards
// ──────────────────────────────────────────────────────────────────────────
// deno-lint-ignore no-explicit-any
async function handleSeedIaUserPredictions(supa: any, body: any) {
  const leagueId: string | undefined = body?.league_id;
  if (!leagueId || typeof leagueId !== "string") throw new Error("bad_input");

  const { data: bot } = await supa
    .from("profiles").select("id").eq("is_bot", true).limit(1).maybeSingle();
  if (!bot?.id) throw new Error("not_found:bot");
  const botId: string = bot.id;

  const { data: member } = await supa
    .from("league_members").select("league_id")
    .eq("user_id", botId).eq("league_id", leagueId).maybeSingle();
  if (!member) throw new Error("forbidden");

  // ── 1) Group predictions desde ia_predictions del snapshot ACTIVE ────
  const active = await getActiveSnapshot(supa);
  const { data: iaRows, error: iaErr } = await supa
    .from("ia_predictions")
    .select("home_code, away_code, sign, breakdown")
    .eq("snapshot_id", active.id)
    .eq("is_ko_ondemand", false);
  if (iaErr) throw new Error(`ia_predictions_read:${iaErr.message}`);
  if (!iaRows || iaRows.length === 0) throw new Error("not_found:ia_groups");

  const groupPredictionsMap: Record<string, { l: number; v: number }> = {};
  const groupRows: Array<{
    user_id: string; match_id: string; local: number; visitante: number;
    scorer: null; saved_at: string; league_id: string;
  }> = [];
  const nowIso = new Date().toISOString();

  for (const row of iaRows) {
    const homeIso = row.home_code as string;
    const awayIso = row.away_code as string;
    const homeName = ISO3_TO_NAME_ES[homeIso];
    const awayName = ISO3_TO_NAME_ES[awayIso];
    const letra = ISO3_TO_GROUP[homeIso];
    if (!homeName || !awayName || !letra) continue;
    const sign = row.sign as "1" | "X" | "2";
    const pMax = (row.breakdown as { p_max?: number })?.p_max ?? 0.5;
    const [l, v] = deriveScoreFromPrediction(sign, pMax);
    const matchKey = `${letra}_${homeName}_${awayName}`;
    groupPredictionsMap[matchKey] = { l, v };
    groupRows.push({
      user_id: botId, match_id: matchKey, local: l, visitante: v,
      scorer: null, saved_at: nowIso, league_id: leagueId,
    });
  }
  if (groupRows.length === 0) throw new Error("not_found:ia_mapped");

  const { error: predErr } = await supa
    .from("predictions")
    .upsert(groupRows, { onConflict: "league_id,user_id,match_id" });
  if (predErr) throw new Error(`predictions_upsert:${predErr.message}`);

  // ── 2) groups_saved = {A:true,...,L:true} ────────────────────────────
  const groupsSavedFlag: Record<string, boolean> = {};
  for (const letra of Object.keys(GROUP_TO_ISO3)) groupsSavedFlag[letra] = true;
  const { error: lmErr } = await supa.from("league_members")
    .update({ groups_saved: groupsSavedFlag })
    .eq("league_id", leagueId).eq("user_id", botId);
  if (lmErr) throw new Error(`league_members_update:${lmErr.message}`);

  // ── 3) Standings → resolvedSlots ─────────────────────────────────────
  const tables: Record<string, GroupStat[]> = {};
  for (const letra of Object.keys(GROUP_TO_ISO3)) {
    tables[letra] = calcGroupStandings(letra, groupPredictionsMap);
  }
  const bestThirds = getBestThirds(tables);

  const slots: Record<string, string> = {};
  for (const [letra, table] of Object.entries(tables)) {
    if (table[0]) slots["1" + letra] = table[0].name;
    if (table[1]) slots["2" + letra] = table[1].name;
    if (table[2]) slots["3" + letra] = table[2].name;
  }
  THIRD_SLOT_ORDER.forEach((slot, i) => {
    if (bestThirds[i]) slots[slot] = bestThirds[i];
  });

  // ── 4) KO predictions: resolver, predict() de a pares, propagar ──────
  const cache = await loadCache(supa);
  const NAME_TO_ISO3: Record<string, string> = {};
  for (const [iso, name] of Object.entries(ISO3_TO_NAME_ES)) NAME_TO_ISO3[name] = iso;

  const koRows: Array<{
    user_id: string; match_id: number; local: number; visitante: number;
    classifier: string | null; scorer: null; saved_at: string; league_id: string;
  }> = [];

  for (const round of BRACKET_KO_ROUNDS) {
    for (const m of round.matches) {
      const homeName = slots[m.home];
      const awayName = slots[m.away];
      if (!homeName || !awayName || homeName === awayName) {
        // Slot sin resolver — no debería pasar si standings están completos
        continue;
      }
      const homeIso = NAME_TO_ISO3[homeName];
      const awayIso = NAME_TO_ISO3[awayName];
      if (!homeIso || !awayIso) continue;

      let l: number, v: number, classifier: string | null = null;
      try {
        const eloHome = lookupElo(cache, homeIso);
        const eloAway = lookupElo(cache, awayIso);
        const h2h = lookupH2H(cache, homeIso, awayIso);
        const racha = buildRachaData(cache, homeIso, awayIso);
        const pred = predict(
          { elo_home: eloHome, elo_away: eloAway, is_host_match: false, home_code: homeIso },
          h2h,
          racha,
        );
        [l, v] = deriveScoreFromPrediction(pred.sign, pred.p_max);
        if (l === v) {
          // Empate en KO — clasifica el de ELO más alto
          classifier = eloHome >= eloAway ? homeName : awayName;
        }
      } catch (_e) {
        // Fallback: el de ELO más alto gana 1-0 (o 0-0 con classifier al home)
        l = 1; v = 0;
      }

      koRows.push({
        user_id: botId, match_id: m.id, local: l, visitante: v,
        classifier, scorer: null, saved_at: nowIso, league_id: leagueId,
      });

      // Propagar W/L slots para próximas rondas
      let winner: string;
      let loser: string;
      if (l > v) { winner = homeName; loser = awayName; }
      else if (v > l) { winner = awayName; loser = homeName; }
      else { winner = classifier || homeName; loser = winner === homeName ? awayName : homeName; }
      slots["W" + m.id] = winner;
      slots["L" + m.id] = loser;
    }
  }

  if (koRows.length > 0) {
    const { error: koErr } = await supa
      .from("ko_predictions")
      .upsert(koRows, { onConflict: "league_id,user_id,match_id" });
    if (koErr) throw new Error(`ko_predictions_upsert:${koErr.message}`);
  }

  // ── 5) Awards: 4 web_search + 1 razonamiento Haiku 4.5 ───────────────
  const champion = slots["W104"] || null;
  const top4 = [slots["W101"], slots["W102"], slots["W103"], slots["L103"]].filter(Boolean);

  const awards = await pickAwardsViaAnthropic(champion, top4);

  const { error: awErr } = await supa.from("award_picks").upsert({
    user_id: botId,
    golden_ball: awards.golden_ball,
    golden_boot: awards.golden_boot,
    golden_glove: awards.golden_glove,
    young_player: awards.young_player,
    saved_at: nowIso,
    league_id: leagueId,
  }, { onConflict: "league_id,user_id" });
  if (awErr) throw new Error(`award_picks_upsert:${awErr.message}`);

  return {
    ok: true,
    bot_id: botId,
    league_id: leagueId,
    groups_count: groupRows.length,
    ko_count: koRows.length,
    champion,
    top4,
    awards,
  };
}

// ──────────────────────────────────────────────────────────────────────────
// pickAwardsViaAnthropic — 4 web_search + 1 razonamiento
// ──────────────────────────────────────────────────────────────────────────
async function pickAwardsViaAnthropic(
  champion: string | null,
  top4: string[],
): Promise<{
  golden_ball: string;
  golden_boot: string;
  golden_glove: string;
  young_player: string;
  razonamiento: string;
}> {
  const apiKey = (Deno.env.get("ANTHROPIC_API_KEY") || "").trim();
  // Fallback determinista si Anthropic no disponible o falla
  const deterministicFallback = () => {
    const fromTop = (list: typeof AW_PLAYERS_LIST) =>
      list.find((p) => top4.includes(p.team)) || list[0];
    const ball = fromTop(AW_PLAYERS_LIST.filter((p) => p.role !== "gk"));
    const boot = fromTop(AW_PLAYERS_LIST.filter((p) => p.role === "fw"));
    const glove = AW_PLAYERS_LIST.find((p) => p.role === "gk")!;
    const young = (YOUNG_PLAYERS_LIST.find((p) => top4.includes(p.team)) || YOUNG_PLAYERS_LIST[0]);
    return {
      golden_ball: ball.key, golden_boot: boot.key,
      golden_glove: glove.key, young_player: young.key,
      razonamiento: champion
        ? `Fallback determinista: campeón ${champion}, top4 ${top4.join(", ")}`
        : "Fallback determinista (sin campeón resuelto)",
    };
  };
  if (!apiKey) return deterministicFallback();

  const queries = [
    "Mundial 2026 Balón de Oro favoritos jugadores en forma 2026",
    "Mundial 2026 favoritos máximo goleador Bota de Oro",
    "Mundial 2026 favoritos mejor portero Guante de Oro",
    "Mundial 2026 mejor jugador joven sub21 promesa",
  ];
  const results: string[] = [];
  for (const q of queries) {
    try {
      const txt = await callAnthropicWebSearch(apiKey, q);
      results.push(txt);
    } catch (e) {
      results.push(`(search_error: ${String((e as Error).message).slice(0, 80)})`);
    }
  }

  // Razonamiento integrador
  const ballPool = AW_PLAYERS_LIST.map((p) => `${p.key}=${p.name} (${p.team}, ${p.role})`).join("; ");
  const youngPool = YOUNG_PLAYERS_LIST.map((p) => `${p.key}=${p.name} (${p.team})`).join("; ");
  const prompt = [
    `Predicción IA Mundial 2026:`,
    champion ? `- Campeón predicho: ${champion}` : `- Campeón: indefinido`,
    `- Top4 predicho: ${top4.join(", ") || "indefinido"}`,
    ``,
    `Resultados web_search abreviados:`,
    `1) Balón de Oro: ${results[0].slice(0, 600)}`,
    `2) Bota de Oro: ${results[1].slice(0, 600)}`,
    `3) Guante de Oro: ${results[2].slice(0, 600)}`,
    `4) Joven ≤21: ${results[3].slice(0, 600)}`,
    ``,
    `Pool jugadores (balón/bota/guante) — usa SOLO estas keys:`,
    ballPool,
    ``,
    `Pool jóvenes (≤21) — usa SOLO estas keys:`,
    youngPool,
    ``,
    `Reglas:`,
    `- balon_oro: del campeón si posible (key del pool de jugadores)`,
    `- bota_oro: rol fw, independiente del campeón`,
    `- guante_oro: rol gk del top4 si hay; sino el único gk del pool (Dibu)`,
    `- joven: ≤21 años, preferentemente del top4`,
    ``,
    `Devuelve SOLO JSON: {"balon_oro":"<key>","bota_oro":"<key>","guante_oro":"<key>","joven":"<key>","razonamiento":"<1-2 frases>"}`,
  ].join("\n");

  try {
    const res = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "x-api-key": apiKey,
        "anthropic-version": "2023-06-01",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 600,
        messages: [{ role: "user", content: prompt }],
      }),
    });
    if (!res.ok) throw new Error(`http_${res.status}`);
    const data = await res.json();
    const text = (data?.content || [])
      .filter((b: { type: string }) => b.type === "text")
      .map((b: { text: string }) => b.text).join("\n");
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error("no_json");
    const parsed = JSON.parse(jsonMatch[0]);
    const ballKeys = new Set(AW_PLAYERS_LIST.map((p) => p.key));
    const youngKeys = new Set(YOUNG_PLAYERS_LIST.map((p) => p.key));
    const validate = (key: string, set: Set<string>, fallback: string) =>
      set.has(key) ? key : fallback;
    const fb = deterministicFallback();
    return {
      golden_ball: validate(parsed.balon_oro, ballKeys, fb.golden_ball),
      golden_boot: validate(parsed.bota_oro, ballKeys, fb.golden_boot),
      golden_glove: validate(parsed.guante_oro, ballKeys, fb.golden_glove),
      young_player: validate(parsed.joven, youngKeys, fb.young_player),
      razonamiento: typeof parsed.razonamiento === "string"
        ? parsed.razonamiento.slice(0, 400) : fb.razonamiento,
    };
  } catch (_e) {
    return deterministicFallback();
  }
}

async function callAnthropicWebSearch(apiKey: string, query: string): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      tools: [{ type: "web_search_20250305", name: "web_search" }],
      messages: [{ role: "user", content: query }],
    }),
  });
  if (!res.ok) throw new Error(`http_${res.status}`);
  const data = await res.json();
  return (data?.content || [])
    .filter((b: { type: string }) => b.type === "text")
    .map((b: { text: string }) => b.text).join("\n");
}

// ──────────────────────────────────────────────────────────────────────────
// handleUpdateIaScorers — Sprint Combos & Awards F3 (28-may)
// ──────────────────────────────────────────────────────────────────────────
// Backfill de `scorer` para las predicciones del bot IA Zayu que se sembraron
// con scorer=NULL (handleSeedIaUserPredictions). Estrategia determinista:
// el delantero titular más caro (fallback centrocampista) del lado que más
// marca en la predicción. Keys formato corto (apellido sin diacríticos),
// idénticas a las del frontend.
//
// Body opcional: { league_id?: string } para procesar una sola liga.
// Skip: 0-0 (sin scorer); país sin xi_pinned (squad pendiente, registrado
// en skipped_iso3).
// deno-lint-ignore no-explicit-any
async function handleUpdateIaScorers(supa: any, body: any) {
  const leagueIdFilter: string | undefined = body?.league_id;

  const { data: bot } = await supa
    .from("profiles").select("id").eq("is_bot", true).limit(1).maybeSingle();
  if (!bot?.id) throw new Error("not_found:bot");
  const botId: string = bot.id;

  const { data: pinned, error: sqErr } = await supa
    .from("squads")
    .select("iso3, jugadores, xi_pinned")
    .eq("xi_pinned", true);
  if (sqErr) throw new Error(`squads_read:${sqErr.message}`);

  const squadByIso = new Map<string, SquadPlayer[]>();
  for (const s of (pinned || [])) {
    if (Array.isArray(s.jugadores) && s.jugadores.length > 0) {
      squadByIso.set(s.iso3, s.jugadores as SquadPlayer[]);
    }
  }

  let equiposPlayers: EquiposPlayersByIso3;
  try {
    equiposPlayers = await loadEquiposPlayers();
  } catch (e) {
    console.warn(
      "[update_ia_scorers] equipos_players fallback {}:",
      String((e as any)?.message || e),
    );
    equiposPlayers = {};
  }

  const NAME_TO_ISO3: Record<string, string> = {};
  for (const [iso, name] of Object.entries(ISO3_TO_NAME_ES)) {
    NAME_TO_ISO3[name] = iso;
  }

  // Cache scorer por iso3 dentro de la invocación.
  const scorerByIso = new Map<string, string | null>();
  const skipped_iso3 = new Set<string>();
  function pickScorerFor(iso3: string): string | null {
    if (scorerByIso.has(iso3)) return scorerByIso.get(iso3)!;
    const squad = squadByIso.get(iso3);
    if (!squad) {
      skipped_iso3.add(iso3);
      scorerByIso.set(iso3, null);
      return null;
    }
    const k = pickDeterministicScorer(squad, iso3, equiposPlayers);
    if (!k) skipped_iso3.add(iso3);
    scorerByIso.set(iso3, k);
    return k;
  }

  // ── 1) Group predictions ───────────────────────────────────────────────
  let groupQuery = supa.from("predictions")
    .select("user_id, match_id, league_id, local, visitante")
    .eq("user_id", botId).is("scorer", null);
  if (leagueIdFilter) groupQuery = groupQuery.eq("league_id", leagueIdFilter);
  const { data: groupRows, error: gErr } = await groupQuery;
  if (gErr) throw new Error(`group_pred_read:${gErr.message}`);

  const nowIso = new Date().toISOString();
  const groupUpdates: Array<{
    user_id: string;
    match_id: string;
    league_id: string;
    local: number;
    visitante: number;
    scorer: string;
    saved_at: string;
  }> = [];
  let group_filled = 0;

  for (const r of (groupRows || [])) {
    const parts = String(r.match_id).split("_");
    if (parts.length < 3) continue;
    const homeName = parts[1];
    const awayName = parts[2];
    const homeIso = NAME_TO_ISO3[homeName];
    const awayIso = NAME_TO_ISO3[awayName];
    if (!homeIso || !awayIso) continue;

    const l = Number(r.local);
    const v = Number(r.visitante);
    if (!Number.isFinite(l) || !Number.isFinite(v)) continue;
    if (l + v === 0) continue; // 0-0 sin scorer

    // Lado que más marca → de ahí sale el scorer. Empate con goles → local.
    const scorerIso = l > v ? homeIso : v > l ? awayIso : homeIso;
    const k = pickScorerFor(scorerIso);
    if (!k) continue;

    groupUpdates.push({
      user_id: botId,
      match_id: r.match_id,
      league_id: r.league_id,
      local: l,
      visitante: v,
      scorer: k,
      saved_at: nowIso,
    });
    group_filled++;
  }

  if (groupUpdates.length > 0) {
    const { error: upErr } = await supa.from("predictions")
      .upsert(groupUpdates, { onConflict: "league_id,user_id,match_id" });
    if (upErr) throw new Error(`group_pred_upsert:${upErr.message}`);
  }

  // ── 2) KO predictions ──────────────────────────────────────────────────
  // Para cada KO con scorer NULL, hay que resolver homeName/awayName via
  // standings simulados + propagación W/L slots. Hacemos por liga porque
  // los standings son por usuario+league.
  let koQuery = supa.from("ko_predictions")
    .select("user_id, match_id, league_id, local, visitante, classifier")
    .eq("user_id", botId).is("scorer", null);
  if (leagueIdFilter) koQuery = koQuery.eq("league_id", leagueIdFilter);
  const { data: koRows, error: kErr } = await koQuery;
  if (kErr) throw new Error(`ko_pred_read:${kErr.message}`);

  const koByLeague = new Map<string, Array<{
    user_id: string;
    match_id: number;
    league_id: string;
    local: number;
    visitante: number;
    classifier: string | null;
  }>>();
  for (const r of (koRows || [])) {
    const arr = koByLeague.get(r.league_id) || [];
    arr.push({
      user_id: r.user_id,
      match_id: Number(r.match_id),
      league_id: r.league_id,
      local: Number(r.local),
      visitante: Number(r.visitante),
      classifier: r.classifier || null,
    });
    koByLeague.set(r.league_id, arr);
  }

  const koUpdates: Array<{
    user_id: string;
    match_id: number;
    league_id: string;
    local: number;
    visitante: number;
    classifier: string | null;
    scorer: string;
    saved_at: string;
  }> = [];
  let ko_filled = 0;

  for (const [leagueId, koList] of koByLeague.entries()) {
    // Group predictions del bot en esta liga → standings.
    const { data: gRows } = await supa.from("predictions")
      .select("match_id, local, visitante")
      .eq("user_id", botId).eq("league_id", leagueId);
    const predMap: Record<string, { l: number; v: number }> = {};
    for (const g of (gRows || [])) {
      predMap[g.match_id] = { l: Number(g.local), v: Number(g.visitante) };
    }

    const tables: Record<string, GroupStat[]> = {};
    for (const letra of Object.keys(GROUP_TO_ISO3)) {
      tables[letra] = calcGroupStandings(letra, predMap);
    }
    const bestThirds = getBestThirds(tables);
    const slots: Record<string, string> = {};
    for (const [letra, table] of Object.entries(tables)) {
      if (table[0]) slots["1" + letra] = table[0].name;
      if (table[1]) slots["2" + letra] = table[1].name;
      if (table[2]) slots["3" + letra] = table[2].name;
    }
    THIRD_SLOT_ORDER.forEach((slot, i) => {
      if (bestThirds[i]) slots[slot] = bestThirds[i];
    });

    // W/L slots propagados desde las ko_predictions del bot en esta liga.
    const { data: allKo } = await supa.from("ko_predictions")
      .select("match_id, local, visitante, classifier")
      .eq("user_id", botId).eq("league_id", leagueId);
    const koPredMap = new Map<
      number,
      { l: number; v: number; classifier: string | null }
    >();
    for (const k of (allKo || [])) {
      koPredMap.set(Number(k.match_id), {
        l: Number(k.local),
        v: Number(k.visitante),
        classifier: k.classifier || null,
      });
    }
    for (const round of BRACKET_KO_ROUNDS) {
      for (const m of round.matches) {
        const homeName = slots[m.home];
        const awayName = slots[m.away];
        if (!homeName || !awayName) continue;
        const kPred = koPredMap.get(m.id);
        if (!kPred) continue;
        let winner: string;
        let loser: string;
        if (kPred.l > kPred.v) {
          winner = homeName;
          loser = awayName;
        } else if (kPred.v > kPred.l) {
          winner = awayName;
          loser = homeName;
        } else {
          winner = kPred.classifier || homeName;
          loser = winner === homeName ? awayName : homeName;
        }
        slots["W" + m.id] = winner;
        slots["L" + m.id] = loser;
      }
    }

    for (const r of koList) {
      const m = findKoMatchById(r.match_id);
      if (!m) continue;
      const homeName = slots[m.home];
      const awayName = slots[m.away];
      if (!homeName || !awayName) continue;
      const homeIso = NAME_TO_ISO3[homeName];
      const awayIso = NAME_TO_ISO3[awayName];
      if (!homeIso || !awayIso) continue;

      const l = r.local;
      const v = r.visitante;
      if (!Number.isFinite(l) || !Number.isFinite(v)) continue;
      // En KO con marcador 0-0, el ganador se decide por penaltis (classifier)
      // pero NO hay goleador en los 90'+prórroga → skip scorer.
      if (l + v === 0) continue;

      const scorerIso = l > v ? homeIso : v > l ? awayIso : homeIso;
      const k = pickScorerFor(scorerIso);
      if (!k) continue;

      koUpdates.push({
        user_id: botId,
        match_id: r.match_id,
        league_id: r.league_id,
        local: l,
        visitante: v,
        classifier: r.classifier,
        scorer: k,
        saved_at: nowIso,
      });
      ko_filled++;
    }
  }

  if (koUpdates.length > 0) {
    const { error: koUpErr } = await supa.from("ko_predictions")
      .upsert(koUpdates, { onConflict: "league_id,user_id,match_id" });
    if (koUpErr) throw new Error(`ko_pred_upsert:${koUpErr.message}`);
  }

  return {
    ok: true,
    bot_id: botId,
    group_filled,
    ko_filled,
    leagues_processed: koByLeague.size,
    skipped_iso3_count: skipped_iso3.size,
    skipped_iso3: Array.from(skipped_iso3).sort(),
  };
}

// Helper: localizar un KO match por id en cualquier ronda del BRACKET.
function findKoMatchById(
  id: number | string,
): { id: number; home: string; away: string } | null {
  const target = Number(id);
  if (!Number.isFinite(target)) return null;
  for (const round of BRACKET_KO_ROUNDS) {
    for (const m of round.matches) {
      if (m.id === target) return m;
    }
  }
  return null;
}
