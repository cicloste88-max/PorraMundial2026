// scripts/lib/fifa-loader.mjs
//
// Carga one-time de la lista oficial FIFA (tabla public.staging_fifa_players)
// sobre squads.jugadores (jsonb), que SIGUE siendo la fuente de verdad. NO
// normaliza a una tabla players. Los campos nuevos (nombre_camiseta,
// estatura_cm, posicion_fifa, needs_enrich) viven DENTRO del jsonb →
// retrocompatible con get-squad / scoring.js / Pizarra / playerToShortKey.
//
// Diseño (ver BRIEF load-fifa 03-jun-2026):
//   - Roster final = los 26 FIFA por nación (dorsal AUTORITATIVO de FIFA).
//   - MATCH por NOMBRE (NUNCA por dorsal: 33% de dorsales BD inservibles +
//     23 colisiones medidas; el dorsal bueno lo trae FIFA).
//   - MATCH  → hereda de BD (foto_url, tm_player_id, valor_eur, club+club_id+
//              club_logo_url de TM, edad, dob, posicion, posicion_tm,
//              es_titular, nombre) y aplica de FIFA dorsal + campos nuevos.
//              nombre y club NO se sobrescriben (Yamal sigue "Lamine Yamal";
//              club TM conserva logo). club_fifa y dob solo cross-check → log.
//   - FIFA sin match → INSERT con datos FIFA, sin foto/tm_id/valor,
//              es_titular=false, needs_enrich=true.
//   - BD sin match   → ELIMINAR (conjetura de prensa; San confirmó).
//
// Matching (matchFifaToBd):
//   Reusa los PRIMITIVOS battle-tested de name-matcher.mjs (tokens →
//   normalización árabe R1/R2/R3 + diacríticos + latin-ext + strip al-/el-
//   hyphenado; levenshtein; resolveAlias; NON_LATIN_ISO3) pero con un scoring
//   ORDER-INVARIANT y asignación GLOBAL, porque scorePair de matchAgainstRoster
//   asume "último token = apellido" y eso se rompe con los nombres FIFA:
//     · nombre_lista es surname-first en unas naciones (ESP "RAYA David") y
//       given-first en otras (JOR "ABDALLAH NASIB", IRN "KANANI Hossein") →
//       el heurístico de posición cruza cables (IRN KANANI→GK Hoseini,
//       KSA ALHAJJI→Alharbi) y elimina jugadores buenos (viola "no eliminar
//       un bueno" del brief).
//     · La greedy por orden de matchAgainstRoster consume el BD equivocado.
//   Señales por par (fifa, bd), todas order-invariant:
//     A) token-set con igualdad FUZZY (levenshtein) — exige given+apellido.
//     B) "squish" ordenado (tokens sort + join) — robusto a orden y a
//        tokenización (Bum Keun ↔ Bumkeun, Bani Ateyah ↔ Baniateyah).
//     C) "squish" sin ordenar — capta given-first vs surname-first idéntico
//        (Lawrence Ati Zigi ↔ Lawrence Ati-Zigi).
//     D) BD de un solo token (Otamendi, Pedri, Neymar) ↔ token FIFA fuerte.
//   + strip CONSISTENTE del artículo árabe pegado (ALARAB→arab, ALDAOUD→daoud)
//     en AMBOS lados, gateado a naciones árabes → cierra el grueso de JOR/KSA/
//     QAT/IRQ sin tocar el matcher compartido (que solo quita "al-" hyphenado).
//   Asignación: greedy GLOBAL por score descendente (cada FIFA y cada BD a lo
//   sumo una vez) → sin cross-wires por orden.

import { tokens as nmTokens, levenshtein, resolveAlias, NON_LATIN_ISO3 } from './name-matcher.mjs';

// FIFA pos (PO/DF/MC/DC) → posicion canónica en español usada por squads.jugadores.
// Verificado contra el vocabulario real de la BD (146 Portero / 425 Defensa /
// 370 Centrocampista / 311 Delantero).
const POS_MAP = { PO: 'Portero', DF: 'Defensa', MC: 'Centrocampista', DC: 'Delantero' };
export function mapFifaPos(pos) {
  return POS_MAP[pos] || null;
}

// FIFA dob llega como 'YYYY-MM-DD' (date). squads.jugadores usa 'DD/MM/YYYY'.
export function convertFifaDob(dob) {
  if (!dob) return null;
  const s = String(dob).slice(0, 10);
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : s;
}

// Naciones donde "Al/El" pegado es el artículo árabe (no parte del nombre como
// en latino Alaba/Álvarez). El strip se aplica SIMÉTRICO a FIFA y BD, así que
// es seguro: nunca rompe un match previo (ambos lados se transforman igual),
// solo une tokens que diferían por el artículo pegado vs hyphenado.
const ARABIC_ISO3 = new Set(['JOR', 'KSA', 'QAT', 'IRQ', 'EGY', 'MAR', 'TUN', 'ALG', 'IRN', 'SEN']);

// tokens battle-tested + strip del artículo árabe pegado (gateado). nmTokens ya
// quita "al-"/"el-" hyphenado; aquí quitamos también "al"/"el" pegado cuando el
// resto tiene ≥3 letras (preserva Ali/Alaa→ala, no toca Ala).
function fifaTokens(name, iso3) {
  let ts = nmTokens(name);
  if (ARABIC_ISO3.has(iso3)) {
    ts = ts.map((t) => {
      const m = /^(?:al|el)(.{3,})$/.exec(t);
      return m ? m[1] : t;
    });
  }
  return ts;
}

function tokenSim(a, b) {
  if (a === b) return 1;
  const L = Math.max(a.length, b.length);
  if (L < 3) return 0;
  // Prefix/abreviatura: Tim→Timothy, Gio→Giovanni, Dom→Dominic, Odil→Odiljon,
  // Aziz→Azizjon. El más corto (≥3) es prefijo del más largo → casi-igualdad.
  const short = a.length <= b.length ? a : b;
  const long = a.length <= b.length ? b : a;
  if (short.length >= 3 && long.startsWith(short)) return 0.92;
  return 1 - levenshtein(a, b) / L;
}

// Apellido(s) FIFA = último token de cada candidato + tokens de la camiseta.
function fifaSurnameTokens(fifaCandTokens) {
  const out = new Set();
  for (const ts of fifaCandTokens) {
    if (ts.length) out.add(ts[ts.length - 1]);
  }
  return out;
}

// Señal A: alineación greedy de tokens BD↔FIFA con igualdad fuzzy. Devuelve
// nº de tokens BD casados y la suma de similitud.
function tokenSetSignal(bdToks, fifaToks, simThr) {
  const used = new Set();
  let matched = 0;
  let simSum = 0;
  for (const bt of bdToks) {
    let best = 0;
    let bi = -1;
    for (let i = 0; i < fifaToks.length; i++) {
      if (used.has(i)) continue;
      const s = tokenSim(bt, fifaToks[i]);
      if (s > best) {
        best = s;
        bi = i;
      }
    }
    if (bi >= 0 && best >= simThr) {
      used.add(bi);
      matched++;
      simSum += best;
    }
  }
  return { matched, simSum };
}

function squishSim(bdToks, fifaToks, sorted) {
  const j = (t) => (sorted ? [...t].sort() : t).join('');
  const a = j(bdToks);
  const b = j(fifaToks);
  if (!a || !b) return 0;
  return 1 - levenshtein(a, b) / Math.max(a.length, b.length);
}

// Score 0-100 de un par (fifa, bd). Combina las 4 señales (todas
// order-invariant). simThr/squishThr se afinan por iso3 (no-latino más laxo).
function pairScore(fifaCandTokens, bdToks, { simTokThr }) {
  if (bdToks.length === 0) return 0;
  // Bag de tokens FIFA = unión de todos los candidatos (oficial+camiseta+lista).
  const bag = [];
  const seen = new Set();
  for (const ts of fifaCandTokens) {
    for (const t of ts) {
      if (!seen.has(t)) {
        seen.add(t);
        bag.push(t);
      }
    }
  }

  // A — token-set fuzzy (given + apellido). El nº de tokens casados DOMINA sobre
  // la similitud media: 3 tokens (uno fuzzy) debe ganar a 2 tokens perfectos,
  // si no "Abu Hasheesh" casaría "Abu Taha" (2 perfectos) en vez de "Abu
  // Hashish" (3, uno fuzzy). Cross-wire JOR/EGY.
  const A = tokenSetSignal(bdToks, bag, simTokThr);
  const avgSim = A.matched > 0 ? A.simSum / A.matched : 0;
  let aScore = 0;
  if (A.matched >= 2) aScore = Math.min(98, 62 + A.matched * 9 + Math.round(avgSim * 8));

  // B/C — squish (mejor candidato), ordenado y sin ordenar.
  let bcScore = 0;
  for (const ts of fifaCandTokens) {
    if (ts.length === 0) continue;
    bcScore = Math.max(bcScore, Math.round(squishSim(bdToks, ts, true) * 100));
    bcScore = Math.max(bcScore, Math.round(squishSim(bdToks, ts, false) * 100));
  }

  // D — BD de un solo token significativo (Otamendi/Pedri/Neymar): pide un
  // token FIFA casi idéntico (≥0.9) de longitud ≥5.
  let dScore = 0;
  if (bdToks.length === 1 && bdToks[0].length >= 5) {
    let best = 0;
    for (const t of bag) best = Math.max(best, tokenSim(bdToks[0], t));
    if (best >= 0.9) dScore = Math.round(60 + best * 30);
  }

  return Math.max(aScore, bcScore, dScore);
}

/**
 * Empareja los FIFA con los BD por nombre. Asignación greedy GLOBAL.
 * @returns { pairs: Map<fifaIdx, {bdIdx, score}>, matchedBd: Set<bdIdx> }
 */
export function matchFifaToBd(fifaList, bdList, { iso3, aliases = null, qual = 80 } = {}) {
  // QAT no está en NON_LATIN_ISO3 del matcher compartido pero es árabe → lo
  // tratamos como no-latino aquí (umbral más laxo) sin tocar el set compartido.
  const nonLatin = NON_LATIN_ISO3.has(iso3) || ARABIC_ISO3.has(iso3);
  const simTokThr = nonLatin ? 0.78 : 0.82;
  const QUAL = nonLatin ? qual - 2 : qual;

  // Pre-tokeniza cada FIFA (candidatos: lista, camiseta, oficial; alias-resueltos).
  const fifaTok = fifaList.map((f) => {
    const cands = [f.nombre_lista, f.camiseta, f.nombre_oficial]
      .map((x) => (x == null ? '' : String(x).trim()))
      .filter(Boolean)
      .map((c) => resolveAlias(c, iso3, aliases));
    return cands.map((c) => fifaTokens(c, iso3)).filter((t) => t.length > 0);
  });
  const bdTok = bdList.map((p) => fifaTokens(p.nombre || '', iso3));

  // Matriz de candidatos.
  const cands = [];
  for (let fi = 0; fi < fifaList.length; fi++) {
    for (let bi = 0; bi < bdList.length; bi++) {
      const s = pairScore(fifaTok[fi], bdTok[bi], { simTokThr });
      if (s >= QUAL) cands.push({ fi, bi, s });
    }
  }
  cands.sort((a, b) => b.s - a.s);

  const pairs = new Map();
  const matchedBd = new Set();
  const usedFifa = new Set();
  for (const c of cands) {
    if (usedFifa.has(c.fi) || matchedBd.has(c.bi)) continue;
    usedFifa.add(c.fi);
    matchedBd.add(c.bi);
    pairs.set(c.fi, { bdIdx: c.bi, score: c.s });
  }

  // ── Fase 2: entre los SOBRANTES, coincidencias SOLO por apellido. NO se
  //    auto-casan (un apellido común — Cho/Kim coreanos, Martínez — puede ser un
  //    cambio real de convocatoria con otro jugador del mismo apellido, no un
  //    apodo). Se REPORTAN como `possible` para que San confirme/aliasee. Los
  //    apodos derivables (Tim→Timothy) ya casaron en fase 1 por prefijo.
  const possible = [];
  const leftBd = [];
  for (let bi = 0; bi < bdList.length; bi++) if (!matchedBd.has(bi)) leftBd.push(bi);
  const pcands = [];
  for (let fi = 0; fi < fifaList.length; fi++) {
    if (usedFifa.has(fi)) continue;
    const surn = fifaSurnameTokens(fifaTok[fi]);
    for (const bi of leftBd) {
      const bt = bdTok[bi];
      if (bt.length === 0) continue;
      // Apellido FIFA contra CUALQUIER token BD (no solo el último): el orden
      // del apellido varía — surname-last (occidental) vs surname-first
      // (coreano "Cho Yumin", "Kim Tae-Hwan"). Así afloran los Kim/Cho/Lee.
      let best = 0;
      for (const ft of surn) {
        if (ft.length < 3) continue;
        for (const bdt of bt) best = Math.max(best, tokenSim(bdt, ft));
      }
      if (best >= 0.85) pcands.push({ fi, bi, s: best });
    }
  }
  pcands.sort((a, b) => b.s - a.s);
  const pf = new Set();
  const pb = new Set();
  for (const c of pcands) {
    if (pf.has(c.fi) || pb.has(c.bi)) continue;
    pf.add(c.fi);
    pb.add(c.bi);
    possible.push({ fifaIdx: c.fi, bdIdx: c.bi });
  }
  return { pairs, matchedBd, possible };
}

// ── club cross-check ────────────────────────────────────────────────────────
function normClub(c) {
  if (!c) return '';
  return String(c)
    .toLowerCase()
    .replace(/\([a-z]{3}\)/g, ' ')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[._'’`-]/g, ' ')
    .replace(/\b(fc|cf|ac|sc|cd|sd|rc|ud|fk|sk|if|bk|ssc|afc|club|de|the|1|calcio|spor|kulubu)\b/g, ' ')
    .replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}
export function clubsRoughlyEqual(a, b) {
  const na = normClub(a);
  const nb = normClub(b);
  if (!na || !nb) return true;
  if (na === nb) return true;
  const sig = (s) => s.split(' ').filter((t) => t.length >= 3);
  const ta = sig(na);
  const tb = sig(nb);
  if (ta.length === 0 || tb.length === 0) return na === nb;
  const setB = new Set(tb);
  return ta.some((t) => setB.has(t));
}

function dobConflict(bdDob, fifaDob) {
  if (!bdDob || !fifaDob) return false;
  return String(bdDob).trim() !== convertFifaDob(fifaDob);
}

/**
 * Construye el roster final de 26 (FIFA) para una nación. Función PURA.
 *
 * @param {object[]} fifaRows  filas staging de la nación (≤26).
 * @param {object[]} bdRoster  squads.jugadores actual de la nación.
 * @param {string}   iso3
 * @param {object|null} aliases  diccionario name-aliases.json (opcional).
 * @returns {{ roster: object[], report: object }}
 */
export function buildFifaRoster({ fifaRows, bdRoster, iso3, aliases = null }) {
  const fifa = [...(fifaRows || [])].sort((a, b) => (a.dorsal ?? 999) - (b.dorsal ?? 999));
  const bd = Array.isArray(bdRoster) ? bdRoster : [];

  const { pairs, matchedBd, possible } = matchFifaToBd(fifa, bd, { iso3, aliases });

  const report = {
    iso3,
    nFifa: fifa.length,
    nBd: bd.length,
    matched: 0,
    inserted: [],
    eliminated: [],
    clubDiffs: [],
    dobDiffs: [],
    reviewMatches: [], // score < 90 → ojo humano
    // Coincidencias SOLO por apellido entre sobrantes: ni se casan ni se dan por
    // cambio real; San decide (apodo no derivable vs cambio de convocatoria).
    possibleMatches: (possible || []).map((p) => ({
      fifa: fifa[p.fifaIdx].nombre_oficial,
      bd: bd[p.bdIdx].nombre,
      bd_tm: bd[p.bdIdx].tm_player_id ?? null,
    })),
  };
  const roster = [];

  for (let fi = 0; fi < fifa.length; fi++) {
    const f = fifa[fi];
    const hit = pairs.get(fi);
    if (hit) {
      const bdPlayer = bd[hit.bdIdx];
      report.matched++;
      if (hit.score < 90) {
        report.reviewMatches.push({ fifa: f.nombre_oficial, bd: bdPlayer.nombre, score: hit.score });
      }
      if (bdPlayer.club && f.club_fifa && !clubsRoughlyEqual(bdPlayer.club, f.club_fifa)) {
        report.clubDiffs.push({ nombre: bdPlayer.nombre, bd: bdPlayer.club, fifa: f.club_fifa });
      }
      if (dobConflict(bdPlayer.dob, f.dob)) {
        report.dobDiffs.push({ nombre: bdPlayer.nombre, bd: bdPlayer.dob, fifa: convertFifaDob(f.dob) });
      }
      // Hereda TODO de BD; aplica de FIFA dorsal + campos nuevos. nombre y club
      // se conservan (el spread de bdPlayer ya los trae; no los pisamos).
      roster.push({
        ...bdPlayer,
        dorsal: f.dorsal,
        nombre_camiseta: f.camiseta,
        estatura_cm: f.estatura_cm,
        posicion_fifa: f.pos,
      });
    } else {
      report.inserted.push(f.nombre_oficial);
      roster.push({
        nombre: f.nombre_oficial,
        dorsal: f.dorsal,
        nombre_camiseta: f.camiseta,
        estatura_cm: f.estatura_cm,
        posicion: mapFifaPos(f.pos),
        posicion_fifa: f.pos,
        dob: convertFifaDob(f.dob),
        club: f.club_fifa, // texto plano, sin club_id/logo
        es_titular: false,
        needs_enrich: true,
      });
    }
  }

  for (let bi = 0; bi < bd.length; bi++) {
    if (!matchedBd.has(bi)) {
      report.eliminated.push({ nombre: bd[bi].nombre, tm_player_id: bd[bi].tm_player_id ?? null });
    }
  }

  roster.sort((a, b) => (a.dorsal ?? 999) - (b.dorsal ?? 999));
  return { roster, report };
}

// Formatea el reporte dry-run de una nación a texto legible.
export function formatFifaReport(r) {
  const lines = [];
  lines.push(
    `${r.iso3}  fifa=${r.nFifa} bd=${r.nBd} → roster=${r.matched + r.inserted.length}` +
      ` | matched=${r.matched} inserted=${r.inserted.length} eliminated=${r.eliminated.length}` +
      (r.nFifa !== 26 ? ' ⚠FIFA≠26' : ''),
  );
  if (r.inserted.length) lines.push(`   + inserted(${r.inserted.length}): ${r.inserted.join(', ')}`);
  if (r.eliminated.length) {
    lines.push(
      `   - eliminated(${r.eliminated.length}): ` +
        r.eliminated.map((e) => `${e.nombre}${e.tm_player_id ? ` [tm:${e.tm_player_id}]` : ' [no-tm]'}`).join(', '),
    );
  }
  if (r.possibleMatches && r.possibleMatches.length) {
    lines.push(`   ? possible same-person (apellido) — CONFIRMAR/alias (${r.possibleMatches.length}):`);
    for (const p of r.possibleMatches) {
      lines.push(`       FIFA "${p.fifa}"  ?=  BD "${p.bd}"${p.bd_tm ? ` [tm:${p.bd_tm}]` : ' [no-tm]'}`);
    }
  }
  if (r.reviewMatches.length) {
    lines.push(`   ~ review matches (score<90) (${r.reviewMatches.length}):`);
    for (const w of r.reviewMatches) lines.push(`       ${w.score}  FIFA "${w.fifa}"  →  BD "${w.bd}"`);
  }
  if (r.clubDiffs.length) {
    lines.push(`   club≠ (${r.clubDiffs.length}):`);
    for (const c of r.clubDiffs) lines.push(`       ${c.nombre}: BD "${c.bd}"  vs FIFA "${c.fifa}"`);
  }
  if (r.dobDiffs.length) {
    lines.push(`   dob≠ (${r.dobDiffs.length}):`);
    for (const d of r.dobDiffs) lines.push(`       ${d.nombre}: BD ${d.bd}  vs FIFA ${d.fifa}`);
  }
  return lines.join('\n');
}
