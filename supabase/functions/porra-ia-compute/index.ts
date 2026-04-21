import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const supa = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    const body = await req.json().catch(() => ({}));
    const action = body?.action;
    switch (action) {
      case "status":
        return json(await handleStatus(supa));
      case "scrape_elo":
        return json(await handleScrapeElo(supa, body));
      case "scrape_last5":
        return json({ status: "not_implemented", phase: "C" });
      case "scrape_h2h":
        return json({ status: "not_implemented", phase: "D" });
      case "compute":
        return json({ status: "not_implemented", phase: "E" });
      default:
        return json({ error: "unknown_action", valid: ["status","scrape_elo","scrape_last5","scrape_h2h","compute"] }, 400);
    }
  } catch (e) {
    return json({ error: String((e as any)?.message || e) }, 500);
  }
});

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

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
