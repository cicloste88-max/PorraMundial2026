import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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

async function handleScrapeElo(supa: any, body: any) {
  try {
    let dateId: string | undefined = body?.date_id;

    if (!dateId) {
      const htmlRes = await fetch("https://inside.fifa.com/fifa-world-ranking/men", {
        headers: { "User-Agent": "Mozilla/5.0", "Accept": "text/html" },
      });
      if (!htmlRes.ok) {
        return { ok: false, step: "fetch_html", error: `HTTP ${htmlRes.status}` };
      }
      const html = await htmlRes.text();
      const m = html.match(/"(id\d{4,6})"/);
      if (!m) {
        return { ok: false, step: "parse_date", error: "id pattern not found in HTML" };
      }
      dateId = m[1];
    }

    const jsonUrl = `https://inside.fifa.com/api/ranking-overview?locale=en&dateId=${encodeURIComponent(dateId)}`;
    const jsonRes = await fetch(jsonUrl, {
      headers: { "User-Agent": "Mozilla/5.0", "Accept": "application/json" },
    });
    if (!jsonRes.ok) {
      return { ok: false, step: "fetch_json", error: `HTTP ${jsonRes.status}` };
    }
    const data = await jsonRes.json();
    const rankings = Array.isArray(data?.rankings) ? data.rankings : [];
    if (rankings.length === 0) {
      return { ok: false, step: "fetch_json", error: "empty rankings, likely stale dateId" };
    }

    const fifaLastUpdate = rankings[0]?.lastUpdateDate ?? null;
    const now = new Date().toISOString();
    const rows = rankings
      .map((r: any) => {
        const item = r?.rankingItem;
        if (!item) return null;
        return {
          team_code: item.countryCode,
          team_name: item.name,
          elo_points: item.totalPoints,
          rank_position: item.rank,
          scraped_at: now,
          source: "fifa.com/api/ranking-overview",
        };
      })
      .filter((x: any) => x && x.team_code && typeof x.elo_points === "number");

    const { error: upsertError } = await supa
      .from("ia_elo_fifa")
      .upsert(rows, { onConflict: "team_code" });
    if (upsertError) {
      return { ok: false, step: "upsert", error: upsertError.message };
    }

    return {
      ok: true,
      date_id: dateId,
      countries_upserted: rows.length,
      fifa_last_update: fifaLastUpdate,
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
