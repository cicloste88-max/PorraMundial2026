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
    const { action } = await req.json();
    switch (action) {
      case "status":
        return json(await handleStatus(supa));
      case "scrape_elo":
        return json({ status: "not_implemented", phase: "B" });
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

function json(body: any, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "content-type": "application/json" },
  });
}
