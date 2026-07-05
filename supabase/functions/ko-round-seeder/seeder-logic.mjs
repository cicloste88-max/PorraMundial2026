// seeder-logic.mjs — lógica PURA del ko-round-seeder (derivación de cruces +
// matching ESPN + estado inicial live_scores). Sin supabase-js ni Deno APIs:
// compartido entre la EF (index.ts) y la suite Node (tests/ko-round-seeder.test.mjs),
// patrón parser.mjs de espn-poll.
//
// Reutiliza los parsers de espn-poll (mapEspnStatus/scoresFor/buildGoalEvents…)
// para que las filas sembradas sean bit-idénticas a las que el poller escribe
// (mismos status_code, mismos ids estables de gol → la dedup WhatsApp no
// re-anuncia nada cuando espn-poll tome el relevo de una fila no-finished).

import {
  buildGoalEvents,
  mapEspnStatus,
  minuteFor,
  pollIntervalFor,
  scoresFor,
} from '../espn-poll/parser.mjs';

// Feeders KO de las rondas SEMBRABLES (R16→final, slots 89..104).
//
// Espejo VERIFICADO POR TEST de BRACKET.{r16,qf,sf,third,final} de
// _shared/ko-data.mjs (tests/ko-round-seeder.test.mjs asserts igualdad 1:1 con
// la fuente de verdad). NO importamos ko-data.mjs entero a la EF: son 59KB
// (99% ANNEX_C, que solo aplica a terceros de grupos — irrelevante en R16+
// donde los feeders son W/L puros) y reventaría el límite ~70KB del deploy MCP
// (ERR-29). Cualquier cambio de cuadro toca ko.js + ko-data.mjs + esto.
export const KO_FEEDERS = [
  { id: 89, round: 'r16', home: 'W74', away: 'W77' },
  { id: 90, round: 'r16', home: 'W73', away: 'W75' },
  { id: 91, round: 'r16', home: 'W76', away: 'W78' },
  { id: 92, round: 'r16', home: 'W79', away: 'W80' },
  { id: 93, round: 'r16', home: 'W83', away: 'W84' },
  { id: 94, round: 'r16', home: 'W81', away: 'W82' },
  { id: 95, round: 'r16', home: 'W86', away: 'W88' },
  { id: 96, round: 'r16', home: 'W85', away: 'W87' },
  { id: 97, round: 'qf', home: 'W89', away: 'W90' },
  { id: 98, round: 'qf', home: 'W93', away: 'W94' },
  { id: 99, round: 'qf', home: 'W91', away: 'W92' },
  { id: 100, round: 'qf', home: 'W95', away: 'W96' },
  { id: 101, round: 'sf', home: 'W97', away: 'W98' },
  { id: 102, round: 'sf', home: 'W99', away: 'W100' },
  { id: 103, round: 'third', home: 'L101', away: 'L102' },
  { id: 104, round: 'final', home: 'W101', away: 'W102' },
];

// Deriva los slots sembrables desde la MALLA REAL: wc_matches_ko (equipos iso3
// de slots ya sembrados) + results.ko_results (winner 'home'|'away' por slot).
// La malla real NO usa resolveBracket (ese resuelve la malla PREDICHA de un
// usuario — ver docs/ko-bracket.md §Resolución): aquí un feeder 'W74' resuelve
// leyendo ko_results['74'].winner contra los iso3 de wc_matches_ko[74], y 'L101'
// (solo slot 103) el perdedor. Un slot es sembrable cuando AMBOS feeders
// resuelven y aún no existe en wc_matches_ko. La cascada entre rondas es
// implícita entre runs del cron: QF no resuelve hasta que sus R16 estén
// sembrados por un run anterior Y puenteados a ko_results.
//
// wcKoRows:  [{ ko_match_id, home_iso3, away_iso3 }] — filas ya sembradas.
// koResults: results.ko_results ({ "74": { winner: 'home'|'away'|null, … } }).
// → { seedable: [{ slot, round, home_iso3, away_iso3 }],
//     pending:  [{ slot, round, waiting_on: ['W83', …] }] }
export function deriveSeedableSlots(wcKoRows, koResults) {
  const teamsBySlot = new Map();
  for (const r of Array.isArray(wcKoRows) ? wcKoRows : []) {
    if (r && r.ko_match_id != null) {
      teamsBySlot.set(Number(r.ko_match_id), { home: r.home_iso3 ?? null, away: r.away_iso3 ?? null });
    }
  }
  const results = (koResults && typeof koResults === 'object') ? koResults : {};

  const feederIso = (key) => {
    const m = /^([WL])(\d+)$/.exec(String(key));
    if (!m) return null;
    const teams = teamsBySlot.get(Number(m[2]));
    const winner = results[m[2]] ? results[m[2]].winner : null;
    if (!teams || (winner !== 'home' && winner !== 'away')) return null;
    const side = (winner === 'home') === (m[1] === 'W') ? 'home' : 'away';
    return teams[side] ?? null;
  };

  const seedable = [];
  const pending = [];
  for (const f of KO_FEEDERS) {
    if (teamsBySlot.has(f.id)) continue; // ya sembrado → idempotencia
    const home = feederIso(f.home);
    const away = feederIso(f.away);
    if (home && away) {
      seedable.push({ slot: f.id, round: f.round, home_iso3: home, away_iso3: away });
    } else {
      const waiting = [];
      if (!home) waiting.push(f.home);
      if (!away) waiting.push(f.away);
      pending.push({ slot: f.id, round: f.round, waiting_on: waiting });
    }
  }
  return { seedable, pending };
}

// Normalización para el fallback por nombre (diacríticos fuera, lowercase).
export function normTeamName(s) {
  return String(s ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().trim();
}

// Matchea el cruce { home_iso3, away_iso3 } contra los events del scoreboard
// ESPN. Primario: competitors[].team.abbreviation — en KO ESPN usa iso3
// exactos (verificado 5-jul sobre los 16 de octavos: MAR CAN FRA PAR NOR BRA
// ENG MEX ESP POR BEL USA EGY ARG COL SUI). Fallback SOLO para el lado cuya
// abbreviation no resuelva: team.name/displayName/shortDisplayName normalizado
// contra nameToIso3 (nombres ES de wc_matches; coincide tras normalizar en
// Portugal/Argentina/Colombia/Canada…, NO en Brazil/Brasil — por eso es
// fallback reportado via='name', no camino primario). Match SIN orden
// {home,away}; inverted = (home ESPN !== home_iso3 proyecto).
//
// → { ok:true, event, espn_event_id, inverted, via } con EXACTAMENTE 1
//   candidato; si 0 o >1 → { ok:false, reason, candidates } y el caller NO
//   siembra ese slot (fail-safe: mejor no sembrar que sembrar mal).
export function matchEspnEvent(sbEvents, homeIso3, awayIso3, nameToIso3 = {}) {
  const want = new Set([homeIso3, awayIso3]);
  const isoOf = (c) => {
    const abbr = String(c?.team?.abbreviation ?? '').toUpperCase().trim();
    if (abbr && want.has(abbr)) return { iso: abbr, via: 'abbreviation' };
    for (const nm of [c?.team?.name, c?.team?.displayName, c?.team?.shortDisplayName]) {
      const iso = nameToIso3[normTeamName(nm)];
      if (iso && want.has(iso)) return { iso, via: 'name' };
    }
    return null;
  };

  const candidates = [];
  for (const ev of Array.isArray(sbEvents) ? sbEvents : []) {
    const comp = (Array.isArray(ev?.competitions) ? ev.competitions[0] : null) ?? {};
    const list = Array.isArray(comp.competitors) ? comp.competitors : [];
    const h = isoOf(list.find((c) => c && c.homeAway === 'home'));
    const a = isoOf(list.find((c) => c && c.homeAway === 'away'));
    if (!h || !a || h.iso === a.iso) continue; // pareja incompleta o repetida
    candidates.push({
      event: ev,
      espn_event_id: String(ev?.id ?? ''),
      inverted: h.iso !== homeIso3,
      via: (h.via === 'name' || a.via === 'name') ? 'name' : 'abbreviation',
    });
  }
  if (candidates.length === 1) return { ok: true, ...candidates[0] };
  return {
    ok: false,
    reason: candidates.length === 0 ? 'no_espn_match' : 'ambiguous_espn_match',
    candidates: candidates.map((c) => c.espn_event_id),
  };
}

// ESPN ev.date ("2026-07-04T19:00Z") → date_utc formato siembra R32
// ("2026-07-04T19:00", sin sufijo Z — fila de referencia wc2026_ko_73) + epoch
// SEGUNDOS UTC para live_scores.match_start_ts (BIGINT seg, contrato espn-poll).
export function espnDateToProject(dateStr) {
  const s = String(dateStr ?? '').trim();
  const m = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2})(?::\d{2}(?:\.\d+)?)?Z$/.exec(s);
  const dateUtc = m ? m[1] : s.replace(/Z$/, '');
  const ms = Date.parse(m ? `${m[1]}:00Z` : s);
  return { dateUtc, epochSeconds: Number.isFinite(ms) ? Math.floor(ms / 1000) : null };
}

// Estado inicial de la fila live_scores según el estado ESPN al sembrar.
//
//   pre  → esqueleto notstarted (status_code 0 + poll_interval 300 = convención
//          porra-apify-webhook para notstarted; espn-poll nunca escribe 'pre'
//          así que estos valores persisten hasta el kickoff). poll_active=true
//          (webhook: activo mientras no finished; inocuo para el dispatcher
//          Apify, que exige sofascore_event_id NOT NULL — aquí null).
//   in   → inprogress/halftime con marcador + goles, mismos codes que espn-poll
//          (6/7/31), que toma el relevo en su siguiente ciclo.
//   post → finished/100 con marcador FINAL orientado a proyecto + events
//          (scoringPlays → formato webhook vía buildGoalEvents, ids estables
//          idénticos a espn-poll) + had_penalties si STATUS_FINAL_PEN. El
//          marcador ESPN excluye la tanda (shootoutScore aparte) — l/v a
//          90'/prórroga, la premisa del bridge.
//
// md5HexAsync inyectado (std/crypto en la EF, node:crypto en tests).
export async function liveRowStateFor(espnEvent, inverted, md5HexAsync) {
  const comp = (Array.isArray(espnEvent?.competitions) ? espnEvent.competitions[0] : null) ?? {};
  const compStatus = comp?.status ?? {};
  const compType = compStatus?.type ?? {};
  const espnState = String(compType?.state ?? 'pre');
  const st = mapEspnStatus(compType?.state, compType?.name, compStatus?.period);
  if (!st) {
    return {
      status: 'notstarted', status_code: 0, minute: null,
      score_home: null, score_away: null, events: [],
      poll_active: true, poll_interval: 300, had_penalties: false,
      espn_state: espnState,
    };
  }
  const { scoreHome, scoreAway, homeTeamId } = scoresFor(comp?.competitors, inverted);
  const events = await buildGoalEvents(String(espnEvent?.id ?? ''), comp?.details, inverted, homeTeamId, md5HexAsync);
  return {
    status: st.status,
    status_code: st.code,
    minute: minuteFor(st.status, compStatus?.displayClock),
    score_home: scoreHome,
    score_away: scoreAway,
    events,
    poll_active: st.active,
    poll_interval: pollIntervalFor(st.status),
    had_penalties: String(compType?.name ?? '') === 'STATUS_FINAL_PEN',
    espn_state: espnState,
  };
}
