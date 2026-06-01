// supabase/functions/update-results/index.ts
// Sync football-data.org → tabla `results`. pg_cron lo activa el 11-jun (lane
// Claude.ai/P4). Traído al repo desde el deploy v5 (estaba drifted) — B2/T2.
//
// CAMBIO B2/T2 (01-jun-2026): se escribe `match_results` como OBJETO (sin
// JSON.stringify) para la migración results→jsonb (lane Claude.ai/P1). El
// reader de get-league-standings ya es type-tolerant (asObj), así que funciona
// con la columna en TEXT (hoy) y en jsonb (tras P1).
//
// FUERA DE SCOPE (NO TOCAR — lane Claude.ai/P3): el keying KO 73-104 y la
// serialización de `ko_results`/`classification` (derivados del array
// koByTeams) los rehace el puente P3. Se dejan con JSON.stringify a propósito
// para no colisionar con ese trabajo; cuando P1+P3 estén, P3 quita esos
// JSON.stringify restantes.
//
// JWT: el deploy v5 tiene verify_jwt=true (invocación vía pg_cron/service role).
// No se cambia aquí — es config de deploy, no de código.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

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

const GROUP_MATCHES = [
  { group: "A", home: "México", away: "Sudáfrica" },
  { group: "A", home: "República de Corea", away: "República Checa" },
  { group: "A", home: "República Checa", away: "Sudáfrica" },
  { group: "A", home: "México", away: "República de Corea" },
  { group: "A", home: "República Checa", away: "México" },
  { group: "A", home: "Sudáfrica", away: "República de Corea" },
  { group: "B", home: "Canadá", away: "Bosnia y Herzegovina" },
  { group: "B", home: "Catar", away: "Suiza" },
  { group: "B", home: "Suiza", away: "Bosnia y Herzegovina" },
  { group: "B", home: "Canadá", away: "Catar" },
  { group: "B", home: "Suiza", away: "Canadá" },
  { group: "B", home: "Bosnia y Herzegovina", away: "Catar" },
  { group: "C", home: "Brasil", away: "Marruecos" },
  { group: "C", home: "Haití", away: "Escocia" },
  { group: "C", home: "Escocia", away: "Marruecos" },
  { group: "C", home: "Brasil", away: "Haití" },
  { group: "C", home: "Brasil", away: "Escocia" },
  { group: "C", home: "Marruecos", away: "Haití" },
  { group: "D", home: "Estados Unidos", away: "Paraguay" },
  { group: "D", home: "Australia", away: "Turquía" },
  { group: "D", home: "Estados Unidos", away: "Australia" },
  { group: "D", home: "Turquía", away: "Paraguay" },
  { group: "D", home: "Turquía", away: "Estados Unidos" },
  { group: "D", home: "Paraguay", away: "Australia" },
  { group: "E", home: "Alemania", away: "Curazao" },
  { group: "E", home: "Costa de Marfil", away: "Ecuador" },
  { group: "E", home: "Alemania", away: "Costa de Marfil" },
  { group: "E", home: "Ecuador", away: "Curazao" },
  { group: "E", home: "Curazao", away: "Costa de Marfil" },
  { group: "E", home: "Ecuador", away: "Alemania" },
  { group: "F", home: "Países Bajos", away: "Japón" },
  { group: "F", home: "Suecia", away: "Túnez" },
  { group: "F", home: "Países Bajos", away: "Suecia" },
  { group: "F", home: "Túnez", away: "Japón" },
  { group: "F", home: "Japón", away: "Suecia" },
  { group: "F", home: "Túnez", away: "Países Bajos" },
  { group: "G", home: "Bélgica", away: "Egipto" },
  { group: "G", home: "RI de Irán", away: "Nueva Zelanda" },
  { group: "G", home: "Bélgica", away: "RI de Irán" },
  { group: "G", home: "Nueva Zelanda", away: "Egipto" },
  { group: "G", home: "Egipto", away: "RI de Irán" },
  { group: "G", home: "Nueva Zelanda", away: "Bélgica" },
  { group: "H", home: "España", away: "Cabo Verde" },
  { group: "H", home: "Arabia Saudí", away: "Uruguay" },
  { group: "H", home: "España", away: "Arabia Saudí" },
  { group: "H", home: "Uruguay", away: "Cabo Verde" },
  { group: "H", home: "Cabo Verde", away: "Arabia Saudí" },
  { group: "H", home: "Uruguay", away: "España" },
  { group: "I", home: "Francia", away: "Senegal" },
  { group: "I", home: "Colombia", away: "Jordania" },
  { group: "I", home: "Francia", away: "Colombia" },
  { group: "I", home: "Senegal", away: "Jordania" },
  { group: "I", home: "Colombia", away: "Senegal" },
  { group: "I", home: "Jordania", away: "Francia" },
  { group: "J", home: "Inglaterra", away: "Panamá" },
  { group: "J", home: "Argentina", away: "Irak" },
  { group: "J", home: "Argentina", away: "Panamá" },
  { group: "J", home: "Inglaterra", away: "Irak" },
  { group: "J", home: "Panamá", away: "Irak" },
  { group: "J", home: "Argentina", away: "Inglaterra" },
  { group: "K", home: "Portugal", away: "Uzbekistán" },
  { group: "K", home: "Austria", away: "RD Congo" },
  { group: "K", home: "Portugal", away: "Austria" },
  { group: "K", home: "Uzbekistán", away: "RD Congo" },
  { group: "K", home: "Austria", away: "Uzbekistán" },
  { group: "K", home: "RD Congo", away: "Portugal" },
  { group: "L", home: "Croacia", away: "Argelia" },
  { group: "L", home: "Noruega", away: "Ghana" },
  { group: "L", home: "Noruega", away: "Argelia" },
  { group: "L", home: "Croacia", away: "Ghana" },
  { group: "L", home: "Ghana", away: "Argelia" },
  { group: "L", home: "Noruega", away: "Croacia" },
];

function getMatchKey(group: string, home: string, away: string): string {
  return `${group}_${home}_${away}`;
}

function matchByTla(tla: string): string | null {
  return TLA_TO_APP[tla] ?? null;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: { "Access-Control-Allow-Origin": "*" } });
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
      const groupMatch = GROUP_MATCHES.find(gm => gm.home === homeApp && gm.away === awayApp);
      if (groupMatch) {
        matchResults[getMatchKey(groupMatch.group, groupMatch.home, groupMatch.away)] = { l: scoreHome, v: scoreAway };
        groupMatchesUpdated++;
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
      // B2/T2: objeto directo para la migración results→jsonb (lane P1).
      // get-league-standings lo lee con asObj (type-tolerant TEXT|jsonb).
      match_results: matchResults,
      // NO TOCAR (lane Claude.ai/P3): keying KO 73-104 + serialización.
      // koByTeams es array-por-equipos; P3 lo reescribe a dict-por-73-104 y,
      // junto con P1, quitará estos JSON.stringify.
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
