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

const WC2026_TEAMS: Array<[string, string, string, string]> = [
  // [iso3, owner_slug (kebab-lowercase), opposition_name (capitalizado con espacios), display_name]
  ["ALG", "algeria", "Algeria", "Algeria"],
  ["ARG", "argentina", "Argentina", "Argentina"],
  ["AUS", "australia", "Australia", "Australia"],
  ["AUT", "austria", "Austria", "Austria"],
  ["BEL", "belgium", "Belgium", "Belgium"],
  ["BIH", "bosnia-and-herzegovina", "Bosnia and Herzegovina", "Bosnia and Herzegovina"],
  ["BRA", "brazil", "Brazil", "Brazil"],
  ["CPV", "cape-verde-islands", "Cape Verde Islands", "Cabo Verde"],
  ["CAN", "canada", "Canada", "Canada"],
  ["COL", "colombia", "Colombia", "Colombia"],
  ["CIV", "ivory-coast", "Ivory Coast", "Côte d'Ivoire"],
  ["CRO", "croatia", "Croatia", "Croatia"],
  ["CUW", "curacao", "Curacao", "Curaçao"],
  ["CZE", "czech-republic", "Czech Republic", "Czechia"],
  ["COD", "congo-dr", "Congo DR", "DR Congo"],
  ["ECU", "ecuador", "Ecuador", "Ecuador"],
  ["EGY", "egypt", "Egypt", "Egypt"],
  ["ENG", "england", "England", "England"],
  ["FRA", "france", "France", "France"],
  ["GER", "germany", "Germany", "Germany"],
  ["GHA", "ghana", "Ghana", "Ghana"],
  ["HAI", "haiti", "Haiti", "Haiti"],
  ["IRN", "iran", "Iran", "Iran"],
  ["IRQ", "iraq", "Iraq", "Iraq"],
  ["JPN", "japan", "Japan", "Japan"],
  ["JOR", "jordan", "Jordan", "Jordan"],
  ["MEX", "mexico", "Mexico", "Mexico"],
  ["MAR", "morocco", "Morocco", "Morocco"],
  ["NED", "netherlands", "Netherlands", "Netherlands"],
  ["NZL", "new-zealand", "New Zealand", "New Zealand"],
  ["NOR", "norway", "Norway", "Norway"],
  ["PAN", "panama", "Panama", "Panama"],
  ["PAR", "paraguay", "Paraguay", "Paraguay"],
  ["POR", "portugal", "Portugal", "Portugal"],
  ["QAT", "qatar", "Qatar", "Qatar"],
  ["KSA", "saudi-arabia", "Saudi Arabia", "Saudi Arabia"],
  ["SCO", "scotland", "Scotland", "Scotland"],
  ["SEN", "senegal", "Senegal", "Senegal"],
  ["RSA", "south-africa", "South Africa", "South Africa"],
  ["KOR", "korea-republic", "Korea Republic", "South Korea"],
  ["ESP", "spain", "Spain", "Spain"],
  ["SWE", "sweden", "Sweden", "Sweden"],
  ["SUI", "switzerland", "Switzerland", "Switzerland"],
  ["TUN", "tunisia", "Tunisia", "Tunisia"],
  ["TUR", "turkey", "Turkey", "Türkiye"],
  ["URU", "uruguay", "Uruguay", "Uruguay"],
  ["USA", "usa", "USA", "USA"],
  ["UZB", "uzbekistan", "Uzbekistan", "Uzbekistan"],
];

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
        return json(await handleScrapeH2h(supa, body));
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

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
