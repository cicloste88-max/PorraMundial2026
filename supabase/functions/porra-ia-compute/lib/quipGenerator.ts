// Generador de frases jocosas vía Claude Haiku 4.5 (spec §7).
//
// Contract: dada una predicción y su contexto, devolver UNA frase corta
// (≤15 palabras) en español ibérico con humor seco, sin drama, sin emojis,
// sin tropos prohibidos (política, guerras, tragedias, estereotipos
// problemáticos). Si la llamada a Anthropic falla, fallback silencioso
// a plantilla neutra — la frase es "nice to have", NO bloquea compute_match.

import type { H2HData, Prediction } from "./predictor.ts";
import { displayName, TEAM_NAMES_ES } from "./wc2026.ts";

// ─── Helpers ────────────────────────────────────────────────────────────────

function marginBand(margin: number): string {
  if (margin < 0.08) return "leve";
  if (margin < 0.20) return "clara";
  return "muy clara";
}

function signText(sign: "1" | "X" | "2"): string {
  if (sign === "1") return "victoria local";
  if (sign === "2") return "victoria visitante";
  return "empate";
}

function predictedWinnerName(
  sign: "1" | "X" | "2",
  homeCode: string,
  awayCode: string,
): string {
  if (sign === "1") return teamNameEs(homeCode);
  if (sign === "2") return teamNameEs(awayCode);
  return "el empate";
}

function teamNameEs(iso3: string): string {
  return TEAM_NAMES_ES[iso3] ?? displayName(iso3) ?? iso3;
}

function h2hSummary(
  h2h: H2HData | null,
  homeCode: string,
  awayCode: string,
): string {
  if (!h2h || h2h.total === 0) {
    return "sin partidos previos entre ambas";
  }
  const h = teamNameEs(homeCode);
  const a = teamNameEs(awayCode);
  return `${h2h.home_wins}W-${h2h.draws}D-${h2h.away_wins}L a favor de ${h} sobre ${a} en ${h2h.total} partidos`;
}

// ─── Prompt (literal, spec §7.2 — no paraphrasear) ──────────────────────────

function buildPrompt(ctx: {
  homeCode: string;
  awayCode: string;
  prediction: Prediction;
  eloHome: number;
  eloAway: number;
  h2h: H2HData | null;
  isHostMatch: boolean;
}): string {
  const homeName = teamNameEs(ctx.homeCode);
  const awayName = teamNameEs(ctx.awayCode);
  const signTextStr = signText(ctx.prediction.sign);
  const winnerName = predictedWinnerName(
    ctx.prediction.sign,
    ctx.homeCode,
    ctx.awayCode,
  );
  const band = marginBand(ctx.prediction.margin);
  const h2hStr = h2hSummary(ctx.h2h, ctx.homeCode, ctx.awayCode);

  return `Eres un comentarista de fútbol con humor seco y estilo español (tipo Maldini
o Roncero pero con menos drama). Tu tarea: generar UNA frase corta
(máximo 15 palabras) que comente la predicción de un partido del Mundial
2026, con humor picante pero benévolo.

DATOS:
- Partido: ${homeName} (${ctx.homeCode}) vs ${awayName} (${ctx.awayCode})
- Predicción IA: ${signTextStr} (${winnerName})
- Confianza: ${band}  (leve / clara / muy clara)
- ELO: ${homeName} ${ctx.eloHome} vs ${awayName} ${ctx.eloAway}
- H2H histórico: ${h2hStr}
- Partido anfitrión: ${ctx.isHostMatch ? "sí" : "no"}

REGLAS OBLIGATORIAS:
1. Máximo 15 palabras, en español ibérico.
2. Humor seco, NO emojis.
3. PROHIBIDO: política, guerras, religión, pobreza, comentarios raciales,
   comentarios sobre dopaje, tragedias (Heysel, Camerún-Colombia 94, etc.),
   países en conflicto actual (Irán, Rusia, Israel, etc.).
4. PROHIBIDO: referencias a jugadores fallecidos con humor negro.
5. PROHIBIDO: estereotipos sobre países africanos o asiáticos menores
   que sugieran inferioridad.
6. Estereotipos aceptables: estilos de juego clásicos, gestos icónicos,
   tradiciones futboleras (Inglaterra y los penaltis, Italia y el catenaccio,
   Alemania y la eficiencia, Brasil y la jogo bonito, etc.).
7. Si la predicción es dudosa (margen leve), reflejar esa duda con ironía.
   No inventar confianza donde no la hay.

DEVUELVE ÚNICAMENTE LA FRASE, sin comillas, sin preámbulo, sin explicación.`;
}

// ─── Fallback plantilla neutra ──────────────────────────────────────────────

function fallbackQuip(
  sign: "1" | "X" | "2",
  homeCode: string,
  awayCode: string,
): string {
  const winner = predictedWinnerName(sign, homeCode, awayCode);
  if (sign === "X") return "Según los datos, el empate parte con ligera ventaja.";
  return `Según los datos, ${winner} parte con ventaja.`;
}

// ─── Función principal ─────────────────────────────────────────────────────

export async function generateQuip(
  homeCode: string,
  awayCode: string,
  prediction: Prediction,
  eloHome: number,
  eloAway: number,
  h2h: H2HData | null,
  isHostMatch: boolean,
  anthropicKey: string | null,
): Promise<string> {
  // Sin key → fallback directo, sin log ruidoso.
  if (!anthropicKey) return fallbackQuip(prediction.sign, homeCode, awayCode);

  const prompt = buildPrompt({
    homeCode,
    awayCode,
    prediction,
    eloHome,
    eloAway,
    h2h,
    isHostMatch,
  });

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": anthropicKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify({
        model: "claude-haiku-4-5-20251001",
        max_tokens: 80, // ~15 palabras + margen
        temperature: 0.9,
        messages: [{ role: "user", content: prompt }],
      }),
      signal: AbortSignal.timeout(5000), // 5s hard timeout
    });

    if (!response.ok) {
      console.warn(
        `quip_generator: anthropic HTTP ${response.status} — fallback aplicado`,
      );
      return fallbackQuip(prediction.sign, homeCode, awayCode);
    }

    const data = await response.json();
    const text = data?.content?.[0]?.text;
    if (typeof text !== "string" || text.trim().length === 0) {
      console.warn("quip_generator: respuesta vacía — fallback aplicado");
      return fallbackQuip(prediction.sign, homeCode, awayCode);
    }

    return text.trim();
    // deno-lint-ignore no-explicit-any
  } catch (e: any) {
    console.warn(
      `quip_generator: fallo llamada anthropic (${String(e?.message || e)}) — fallback aplicado`,
    );
    return fallbackQuip(prediction.sign, homeCode, awayCode);
  }
}
