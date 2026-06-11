// Supabase Edge Function: update-results
// football-data.org → results (vía INDEPENDIENTE del puente P4 — no sustituir).
//
// v9 (11-jun-2026, review orquestador): el bucle de grupos filtra
//   m.stage === "GROUP_STAGE". Sin el filtro, un rematch KO entre compañeros
//   de grupo (posible de cuartos en adelante) casaba contra GROUP_MATCHES y
//   machacaba el resultado de grupos con el marcador del KO (pre-existente en
//   v7; el matching bidireccional doblaba la probabilidad del false-match).
// v8 (11-jun-2026, prep activación pg_cron):
//   - Gate X-Cron-Key: env IA_CRON_KEY (secret project-wide) con fallback a
//     Vault vía RPC get_vault_secrets (ERR-27; mismo secreto que valida
//     porra-ia-compute, así el caller pg_net del cron funciona aunque el env
//     secret falte). Sin key válida → 401. Necesario porque verify_jwt pasa a
//     false (ERR-16, JWT ES256) y la EF no puede quedar pública: el free tier
//     de football-data son 10 req/min.
//   - Matching bidireccional de grupos en ./matcher.mjs: el fixture oficial
//     puede venir invertido vs la convención app (caso real wc2026_gC_15186861
//     Brasil-Escocia, teams_swapped=true). Antes ese partido se saltaba EN
//     SILENCIO; ahora se guarda el marcador girado bajo la key canónica app.
//   - Path KO: sigue registrando la orientación de la API con winner explícito
//     por nombre — la canonicalización KO vive aguas abajo (wc_matches_ko /
//     JO-1a). Revisar cuando haya fixture KO real (~28-jun).
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { resolveGroupResult } from "./matcher.mjs";

const FOOTBALL_API_KEY = Deno.env.get("FOOTBALL_DATA_API_KEY") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL") ?? "";
const SUPABASE_SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const COMPETITION_CODE = "WC";

const TEAM_TLA: Record<string, string> = {
  "Alemania": "DEU", "Arabia Saudí": "KSA", "Argelia": "ALG",
  "Argentina": "ARG", "Australia": "AUS", "Austria": "AUT",
  "Bosnia y Herzegovina": "BIH", "Brasil": "BRA", "Bélgica": "BEL",
  "Cabo Verde": "CPV", "Canadá": "CAN", "Catar": "QAT",
  "Colombia": "COL", "Costa de Marfil": "CIV", "Croacia": "HRV",
  "Curazao": "ANT", "Ecuador": "ECU", "Egipto": "EGY",
  "Escocia": "SCO", "España": "ESP", "Estados Unidos": "USA",
  "Francia": "FRA", "Ghana": "GHA", "Haití": "HTI",
  "Inglaterra": "ENG", "Irak": "IRQ", "Japón": "JPN",
  "Jordania": "JOR", "Marruecos": "MAR", "México": "MEX",
  "Noruega": "NOR", "Nueva Zelanda": "NZL", "Panamá": "PAN",
  "Paraguay": "PRY", "Países Bajos": "NLD", "Portugal": "PRT",
  "RD Congo": "COD", "RI de Irán": "IRN", "República Checa": "CZE",
  "República de Corea": "KOR", "Senegal": "SEN", "Sudáfrica": "RSA",
  "Suecia": "SWE", "Suiza": "CHE", "Turquía": "TUR",
  "Túnez": "TUN", "Uruguay": "URY", "Uzbekistán": "UZB",
};

const TLA_TO_APP: Record<string, string> = Object.fromEntries(
  Object.entries(TEAM_TLA).map(([app, tla]) => [tla, app])
);

function matchByTla(tla: string): string | null {
  return TLA_TO_APP[tla] ?? null;
}

// ─── Gate X-Cron-Key (verify_jwt=false → auth manual) ──────────────────────

function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// Fallback Vault vía RPC get_vault_secrets (patrón porra-ia-compute/lib/auth.ts;
// el schema vault no está expuesto en api.schemas — ERR-27). trim() obligatorio
// (ERR-04, whitespace en secrets).
async function readVaultCronKey(): Promise<string> {
  try {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_vault_secrets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": SUPABASE_SERVICE_KEY,
        "Authorization": `Bearer ${SUPABASE_SERVICE_KEY}`,
      },
      body: JSON.stringify({ secret_names: ["IA_CRON_KEY"] }),
    });
    if (!res.ok) return "";
    const data = await res.json();
    // deno-lint-ignore no-explicit-any
    const row = Array.isArray(data) ? data.find((r: any) => r.name === "IA_CRON_KEY") : null;
    return row ? String(row.secret).trim() : "";
  } catch {
    return "";
  }
}

// Fail closed: sin header, o sin secreto configurado en ningún lado, nadie pasa.
async function isCronAuthorized(req: Request): Promise<boolean> {
  const provided = (req.headers.get("x-cron-key") ?? "").trim();
  if (!provided) return false;
  const expected = (Deno.env.get("IA_CRON_KEY") ?? "").trim() || (await readVaultCronKey());
  if (!expected) return false;
  return constantTimeEq(provided, expected);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
  }

  if (!(await isCronAuthorized(req))) {
    return new Response(JSON.stringify({ ok: false, error: "unauthorized" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const log: string[] = [];

  try {
    const apiRes = await fetch(
      `https://api.football-data.org/v4/competitions/${COMPETITION_CODE}/matches?season=2026`,
      { headers: { "X-Auth-Token": FOOTBALL_API_KEY } }
    );

    if (!apiRes.ok) {
      const err = await apiRes.text();
      throw new Error(`football-data.org error ${apiRes.status}: ${err}`);
    }

    const apiData = await apiRes.json();
    const matches = apiData.matches ?? [];
    log.push(`Partidos recibidos de API: ${matches.length}`);

    const matchResults: Record<string, { l: number; v: number }> = {};
    let groupMatchesUpdated = 0;

    for (const m of matches) {
      if (m.status !== "FINISHED") continue;
      // Solo fase de grupos: un rematch KO entre compañeros de grupo (cuartos
      // en adelante) casaría contra GROUP_MATCHES y machacaría el resultado
      // real de grupos con el marcador del KO.
      if (m.stage !== "GROUP_STAGE") continue;
      const homeTla: string = m.homeTeam?.tla ?? "";
      const awayTla: string = m.awayTeam?.tla ?? "";
      const homeApp = matchByTla(homeTla);
      const awayApp = matchByTla(awayTla);
      if (!homeApp || !awayApp) {
        log.push(`⚠️ Sin mapeo: ${homeTla} vs ${awayTla}`);
        continue;
      }
      const scoreHome = m.score?.fullTime?.home ?? m.score?.regularTime?.home ?? null;
      const scoreAway = m.score?.fullTime?.away ?? m.score?.regularTime?.away ?? null;
      if (scoreHome === null || scoreAway === null) continue;
      const resolved = resolveGroupResult(homeApp, awayApp, scoreHome, scoreAway);
      if (resolved) {
        matchResults[resolved.key] = { l: resolved.l, v: resolved.v };
        groupMatchesUpdated++;
        if (resolved.swapped) {
          log.push(`↔️ Orientación API invertida en ${resolved.key}: marcador girado a convención app`);
        }
      } else {
        log.push(`⚠️ Sin fixture en GROUP_MATCHES: ${homeApp} vs ${awayApp}`);
      }
    }
    log.push(`Partidos de grupos actualizados: ${groupMatchesUpdated}`);

    const STAGE_MAP: Record<string, string> = {
      "ROUND_OF_32": "r32", "ROUND_OF_16": "r16", "QUARTER_FINALS": "qf",
      "SEMI_FINALS": "sf", "THIRD_PLACE": "third", "FINAL": "final",
    };

    const koByTeams: Array<{ stage: string; homeApp: string; awayApp: string; scoreHome: number; scoreAway: number; winner: string | null }> = [];

    for (const m of matches) {
      if (m.status !== "FINISHED") continue;
      if (!STAGE_MAP[m.stage]) continue;
      const homeApp = matchByTla(m.homeTeam?.tla ?? "");
      const awayApp = matchByTla(m.awayTeam?.tla ?? "");
      if (!homeApp || !awayApp) continue;
      const scoreHome = m.score?.regularTime?.home ?? m.score?.fullTime?.home ?? null;
      const scoreAway = m.score?.regularTime?.away ?? m.score?.fullTime?.away ?? null;
      if (scoreHome === null || scoreAway === null) continue;
      const winner = m.score?.winner === "HOME_TEAM" ? homeApp : m.score?.winner === "AWAY_TEAM" ? awayApp : null;
      koByTeams.push({ stage: m.stage, homeApp, awayApp, scoreHome, scoreAway, winner });
    }
    log.push(`Partidos KO terminados: ${koByTeams.length}`);

    const classification: Record<string, string> = {};
    const finalMatch = koByTeams.find(m => m.stage === "FINAL");
    if (finalMatch) {
      if (finalMatch.winner) classification["champion"] = finalMatch.winner;
      classification["runner_up"] = finalMatch.winner === finalMatch.homeApp ? finalMatch.awayApp : finalMatch.homeApp;
    }
    const thirdMatch = koByTeams.find(m => m.stage === "THIRD_PLACE");
    if (thirdMatch) {
      if (thirdMatch.winner) classification["third"] = thirdMatch.winner;
      classification["fourth"] = thirdMatch.winner === thirdMatch.homeApp ? thirdMatch.awayApp : thirdMatch.homeApp;
    }

    const { error: upsertError } = await supabase.from("results").upsert({
      id: 1,
      match_results: JSON.stringify(matchResults),
      ko_results: JSON.stringify(koByTeams),
      classification: JSON.stringify(classification),
      updated_at: new Date().toISOString(),
    }, { onConflict: "id" });

    if (upsertError) throw upsertError;
    log.push(`✅ results actualizado — grupos: ${groupMatchesUpdated}, KO: ${koByTeams.length}`);

    return new Response(JSON.stringify({ ok: true, log, updatedAt: new Date().toISOString() }), { headers: { "Content-Type": "application/json" } });

  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    log.push(`❌ Error: ${message}`);
    return new Response(JSON.stringify({ ok: false, log, error: message }), { status: 500, headers: { "Content-Type": "application/json" } });
  }
});
