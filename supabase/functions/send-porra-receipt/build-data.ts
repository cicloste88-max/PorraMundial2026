// build-data.ts — send-porra-receipt
//
// Ensambla el modelo de datos del COMPROBANTE (acuse de recibo) de una porra
// para un (user_id, league_id). NO calcula puntuación: al cierre aún no se ha
// jugado nada. Solo refleja, íntegros, los pronósticos guardados del usuario.
//
// Decisiones verificadas contra la BD real (sustituyen al brief original):
//
//   GRUPOS — predictions.match_id = "{grupo}_{home_es}_{away_es}" con nombres
//   en español (p.ej. "A_México_República de Corea"); NO es wc_matches.match_key.
//   Los iso3 (para banderas) NO viven en predictions: se derivan de wc_matches
//   (72 filas, home_es/home_iso3/away_es/away_iso3) indexando AMBOS órdenes
//   (por teams_swapped). El goleador de grupos se resuelve dentro de los dos
//   equipos del partido.
//
//   FASE FINAL (KO) — ko_predictions.match_id INTEGER 73..104 = SLOT fijo del
//   cuadro (no id de partido real). La fila NO trae los dos equipos del cruce
//   (local/visitante son el marcador). Solo: slot + marcador + classifier
//   (NOMBRE en español de quién avanza) + scorer. Por tanto renderizamos solo
//   lo que la fila trae: ronda + marcador + "Avanza: <classifier>" + goleador.
//   classifier (ES) -> iso3 se resuelve contra wc_matches. El goleador KO se
//   busca en TODO el roster (no conocemos los dos equipos del cruce). Campeón =
//   classifier del slot 104; ganador del 3.er puesto = classifier del slot 103.
//   NO derivamos subcampeón ni 4.º (necesitan el cruce).

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

// Base de Supabase Storage para banderas (idéntico a SB en public/js/data.js).
export const SB_BASE =
  "https://cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public";

// ─── Slot KO -> ronda ──────────────────────────────────────────────────────
// Fuente de verdad confirmada contra get-league-standings KO_ROUND_BY_ID y
// porra-ia-compute BRACKET_KO_ROUNDS (ambos coinciden, espejo de ko.js BRACKET):
//   73-88 R32 · 89-96 R16 · 97-100 QF · 101-102 SF · 103 3.º · 104 Final.
export type KoRound = "r32" | "r16" | "qf" | "sf" | "third" | "final";

export function koRoundForSlot(slot: number): KoRound | null {
  if (slot >= 73 && slot <= 88) return "r32";
  if (slot >= 89 && slot <= 96) return "r16";
  if (slot >= 97 && slot <= 100) return "qf";
  if (slot === 101 || slot === 102) return "sf";
  if (slot === 103) return "third";
  if (slot === 104) return "final";
  return null;
}

export const KO_ROUND_LABEL: Record<KoRound, string> = {
  r32: "Dieciseisavos de final",
  r16: "Octavos de final",
  qf: "Cuartos de final",
  sf: "Semifinales",
  third: "Tercer y cuarto puesto",
  final: "Final",
};

const KO_ROUND_ORDER: KoRound[] = ["r32", "r16", "qf", "sf", "third", "final"];

// ─── Tipos del modelo de comprobante ───────────────────────────────────────
export interface GroupPred {
  group: string;
  homeName: string;
  homeIso3: string | null;
  awayName: string;
  awayIso3: string | null;
  l: number | null;
  v: number | null;
  scorer: string | null; // nombre legible resuelto (o la clave cruda)
  dateUtc: string | null;
}

export interface KoPred {
  slot: number;
  round: KoRound;
  roundLabel: string;
  l: number | null;
  v: number | null;
  classifierName: string | null; // nombre ES tal cual guardado (o null)
  classifierIso3: string | null;
  scorer: string | null;
}

export interface AwardPick {
  key: string;
  label: string;
  pts: number;
  player: string | null;
}

export interface ReceiptData {
  userId: string;
  leagueId: string;
  userName: string;
  userEmail: string | null; // email real del usuario (el destinatario lo decide index.ts)
  leagueName: string;
  generatedAt: string; // ISO
  groups: GroupPred[];
  ko: KoPred[];
  awards: AwardPick[];
  champion: string | null;
  championIso3: string | null;
  thirdPlace: string | null;
  thirdPlaceIso3: string | null;
  counts: { groups: number; ko: number; awards: number };
  verificationCode: string;
  flagsBase: string;
}

// Catálogo de premios (espejo de AWARDS_CFG en public/js/scoring.js).
const AWARDS: Array<{ key: keyof AwardRow; label: string; pts: number }> = [
  { key: "golden_ball", label: "Balón de Oro", pts: 15 },
  { key: "golden_boot", label: "Bota de Oro", pts: 15 },
  { key: "golden_glove", label: "Guante de Oro", pts: 15 },
  { key: "young_player", label: "Mejor Joven ≤21", pts: 20 },
];

interface AwardRow {
  golden_ball: string | null;
  golden_boot: string | null;
  golden_glove: string | null;
  young_player: string | null;
}

// Quita el prefijo de dorsal "N · " de los names de equipos_players
// ("9 · Raúl Jiménez" -> "Raúl Jiménez"). Espejo de _stripDorsal en scoring.js.
function stripDorsal(name: string): string {
  return (name || "").replace(/^\d+\s*·\s*/, "").trim();
}

// Los award picks se guardan como "Nombre_Apellido" (los arrays hardcoded
// AW_PLAYERS se eliminaron; ahora los candidatos salen de squads). Display =
// sustituir '_' por ' '. Tolera null.
function awardPlayerDisplay(raw: string | null): string | null {
  if (!raw) return null;
  return String(raw).replace(/_/g, " ").trim() || null;
}

// SHA-256 (hex, 12 chars upper) sobre las filas CRUDAS — código de
// verificación de auditoría. Determinista por snapshot de datos del usuario.
async function computeVerificationCode(
  // deno-lint-ignore no-explicit-any
  rawPreds: any[],
  // deno-lint-ignore no-explicit-any
  rawKo: any[],
  award: AwardRow | null,
): Promise<string> {
  const canon = {
    g: [...rawPreds]
      .map((p) => [p.match_id, p.local, p.visitante, p.scorer ?? null])
      .sort((a, b) => String(a[0]).localeCompare(String(b[0]))),
    k: [...rawKo]
      .map((p) => [p.match_id, p.local, p.visitante, p.classifier ?? null, p.scorer ?? null])
      .sort((a, b) => Number(a[0]) - Number(b[0])),
    a: award
      ? [award.golden_ball, award.golden_boot, award.golden_glove, award.young_player]
      : null,
  };
  const bytes = new TextEncoder().encode(JSON.stringify(canon));
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  const hex = Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
  return hex.slice(0, 12).toUpperCase();
}

// ─── Ensamblado principal ──────────────────────────────────────────────────
// Devuelve null si el usuario no tiene NINGÚN dato en la liga (sin grupos, sin
// KO, sin premios) — el caller lo trata como "no_data" (no se envía nada).
export async function buildReceiptData(
  supa: SupabaseClient,
  userId: string,
  leagueId: string,
): Promise<ReceiptData | null> {
  const [
    { data: preds, error: pErr },
    { data: koPreds, error: koErr },
    { data: award, error: aErr },
    { data: profile, error: prErr },
    { data: league, error: lErr },
    { data: wcRows, error: wErr },
    { data: rosterRows, error: rErr },
  ] = await Promise.all([
    supa.from("predictions").select("match_id, local, visitante, scorer")
      .eq("user_id", userId).eq("league_id", leagueId),
    supa.from("ko_predictions").select("match_id, local, visitante, classifier, scorer")
      .eq("user_id", userId).eq("league_id", leagueId),
    supa.from("award_picks").select("golden_ball, golden_boot, golden_glove, young_player")
      .eq("user_id", userId).eq("league_id", leagueId).maybeSingle(),
    supa.from("profiles").select("nombre").eq("id", userId).maybeSingle(),
    supa.from("leagues").select("nombre").eq("id", leagueId).maybeSingle(),
    supa.from("wc_matches").select("group_letter, home_es, away_es, home_iso3, away_iso3, date_utc"),
    supa.from("equipos_players").select("iso3, players"),
  ]);

  for (const [err, label] of [
    [pErr, "predictions"],
    [koErr, "ko_predictions"],
    [aErr, "award_picks"],
    [prErr, "profiles"],
    [lErr, "leagues"],
    [wErr, "wc_matches"],
    [rErr, "equipos_players"],
  ] as const) {
    if (err) throw new Error(`query_failed:${label}:${err.message}`);
  }

  const rawPreds = preds ?? [];
  const rawKo = koPreds ?? [];
  const awardRow: AwardRow | null = award
    ? {
      golden_ball: award.golden_ball ?? null,
      golden_boot: award.golden_boot ?? null,
      golden_glove: award.golden_glove ?? null,
      young_player: award.young_player ?? null,
    }
    : null;

  const hasAwards = !!awardRow &&
    [awardRow.golden_ball, awardRow.golden_boot, awardRow.golden_glove, awardRow.young_player]
      .some((x) => !!x);

  if (rawPreds.length === 0 && rawKo.length === 0 && !hasAwards) {
    return null; // sin nada que reflejar
  }

  // ── Maps derivados de wc_matches ──────────────────────────────────────────
  // groupFixtures: clave "{grupo}_{nameHome}_{nameAway}" -> {iso3 + names + date}
  // en AMBOS órdenes, para que la fila de predicción resuelva sus banderas sea
  // cual sea el orden con el que se guardó (teams_swapped). Dedup implícito:
  // claves idénticas (mismo par en mismo orden) sobreescriben sin duplicar.
  interface Fixture {
    homeName: string;
    awayName: string;
    homeIso3: string | null;
    awayIso3: string | null;
    group: string;
    dateUtc: string | null;
  }
  const groupFixtures = new Map<string, Fixture>();
  const esNameToIso3 = new Map<string, string>(); // nombre ES -> iso3 (para classifier KO)
  for (const r of wcRows ?? []) {
    const g = r.group_letter;
    const he = r.home_es, ae = r.away_es;
    const hi = r.home_iso3 ?? null, ai = r.away_iso3 ?? null;
    const d = r.date_utc ?? null;
    if (he && hi) esNameToIso3.set(he, hi);
    if (ae && ai) esNameToIso3.set(ae, ai);
    if (!g || !he || !ae) continue;
    groupFixtures.set(`${g}_${he}_${ae}`, {
      homeName: he, awayName: ae, homeIso3: hi, awayIso3: ai, group: g, dateUtc: d,
    });
    // orden invertido (teams_swapped)
    groupFixtures.set(`${g}_${ae}_${he}`, {
      homeName: ae, awayName: he, homeIso3: ai, awayIso3: hi, group: g, dateUtc: d,
    });
  }

  // playersByIso3: iso3 -> [{key, name}] ; keyToNameAll: clave -> nombre (todos)
  const playersByIso3 = new Map<string, Array<{ key: string; name: string }>>();
  const keyToNameAll = new Map<string, string>();
  for (const r of rosterRows ?? []) {
    const iso3 = r.iso3;
    const list = Array.isArray(r.players) ? r.players : [];
    playersByIso3.set(iso3, list);
    for (const pl of list) {
      if (pl?.key && !keyToNameAll.has(pl.key)) {
        keyToNameAll.set(pl.key, stripDorsal(pl.name));
      }
    }
  }

  // Goleador de grupos: buscar la clave SOLO en los dos equipos del partido.
  const resolveGroupScorer = (
    key: string | null,
    homeIso3: string | null,
    awayIso3: string | null,
  ): string | null => {
    if (!key) return null;
    for (const iso3 of [homeIso3, awayIso3]) {
      if (!iso3) continue;
      const hit = (playersByIso3.get(iso3) ?? []).find((p) => p.key === key);
      if (hit) return stripDorsal(hit.name);
    }
    return key; // fallback: clave cruda (apellido legible; rosters históricos)
  };

  // Goleador KO: no conocemos los dos equipos del cruce -> buscar en TODO el
  // roster (igual que el resolver de premios). Fallback: clave cruda.
  const resolveKoScorer = (key: string | null): string | null => {
    if (!key) return null;
    return keyToNameAll.get(key) ?? key;
  };

  // Parseo de respaldo de nombres desde el propio match_id ("{g}_{home}_{away}")
  // si la clave no estuviera en groupFixtures (cobertura verificada 100%, pero
  // defensivo). Los nombres ES no contienen '_', así que split('_') da 3 partes.
  const fallbackNames = (matchId: string): { group: string; home: string; away: string } | null => {
    const parts = String(matchId).split("_");
    if (parts.length < 3) return null;
    return { group: parts[0], home: parts[1], away: parts.slice(2).join("_") };
  };

  // ── GRUPOS ────────────────────────────────────────────────────────────────
  const groups: GroupPred[] = [];
  for (const p of rawPreds) {
    const fx = groupFixtures.get(p.match_id);
    let group: string, homeName: string, awayName: string;
    let homeIso3: string | null, awayIso3: string | null, dateUtc: string | null;
    if (fx) {
      group = fx.group; homeName = fx.homeName; awayName = fx.awayName;
      homeIso3 = fx.homeIso3; awayIso3 = fx.awayIso3; dateUtc = fx.dateUtc;
    } else {
      const fb = fallbackNames(p.match_id);
      group = fb?.group ?? "?";
      homeName = fb?.home ?? p.match_id;
      awayName = fb?.away ?? "";
      homeIso3 = esNameToIso3.get(homeName) ?? null;
      awayIso3 = esNameToIso3.get(awayName) ?? null;
      dateUtc = null;
    }
    groups.push({
      group, homeName, homeIso3, awayName, awayIso3,
      l: p.local ?? null,
      v: p.visitante ?? null,
      scorer: resolveGroupScorer(p.scorer ?? null, homeIso3, awayIso3),
      dateUtc,
    });
  }
  groups.sort((a, b) =>
    a.group.localeCompare(b.group) ||
    String(a.dateUtc ?? "").localeCompare(String(b.dateUtc ?? "")) ||
    a.homeName.localeCompare(b.homeName)
  );

  // ── FASE FINAL (KO) ────────────────────────────────────────────────────────
  const ko: KoPred[] = [];
  for (const k of rawKo) {
    const slot = Number(k.match_id);
    const round = koRoundForSlot(slot);
    if (!round) continue;
    const classifierName: string | null = k.classifier ?? null;
    ko.push({
      slot,
      round,
      roundLabel: KO_ROUND_LABEL[round],
      l: k.local ?? null,
      v: k.visitante ?? null,
      classifierName,
      classifierIso3: classifierName ? (esNameToIso3.get(classifierName) ?? null) : null,
      scorer: resolveKoScorer(k.scorer ?? null),
    });
  }
  ko.sort((a, b) =>
    KO_ROUND_ORDER.indexOf(a.round) - KO_ROUND_ORDER.indexOf(b.round) ||
    a.slot - b.slot
  );

  // Podio: campeón = classifier slot 104 ; ganador 3.er puesto = classifier 103.
  const slot104 = ko.find((x) => x.slot === 104);
  const slot103 = ko.find((x) => x.slot === 103);
  const champion = slot104?.classifierName ?? null;
  const championIso3 = slot104?.classifierIso3 ?? null;
  const thirdPlace = slot103?.classifierName ?? null;
  const thirdPlaceIso3 = slot103?.classifierIso3 ?? null;

  // ── PREMIOS ─────────────────────────────────────────────────────────────────
  const awards: AwardPick[] = AWARDS.map((cfg) => ({
    key: cfg.key,
    label: cfg.label,
    pts: cfg.pts,
    player: awardRow ? awardPlayerDisplay(awardRow[cfg.key]) : null,
  }));

  const verificationCode = await computeVerificationCode(rawPreds, rawKo, awardRow);

  // Email real del usuario (vía admin API; service role). El destinatario final
  // (override o real) lo decide index.ts.
  let userEmail: string | null = null;
  try {
    const { data: u } = await supa.auth.admin.getUserById(userId);
    userEmail = u?.user?.email ?? null;
  } catch {
    userEmail = null;
  }

  return {
    userId,
    leagueId,
    userName: profile?.nombre ?? "—",
    userEmail,
    leagueName: league?.nombre ?? "—",
    generatedAt: new Date().toISOString(),
    groups,
    ko,
    awards,
    champion,
    championIso3,
    thirdPlace,
    thirdPlaceIso3,
    counts: { groups: groups.length, ko: ko.length, awards: awards.filter((a) => a.player).length },
    verificationCode,
    flagsBase: SB_BASE,
  };
}
