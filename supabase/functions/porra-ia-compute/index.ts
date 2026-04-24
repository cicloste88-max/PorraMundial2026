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

// ─── CORS whitelist ────────────────────────────────────────────────────────
const ALLOWED_ORIGINS = new Set([
  "https://porramundial2026-seven.vercel.app",
  "http://localhost:5173",
]);

function cors(origin: string | null): Record<string, string> {
  if (origin && ALLOWED_ORIGINS.has(origin)) {
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
    const limit = Number.isFinite(rawLimit) && rawLimit > 0
      ? Math.min(20, Math.max(1, Math.floor(rawLimit)))
      : 8;

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
