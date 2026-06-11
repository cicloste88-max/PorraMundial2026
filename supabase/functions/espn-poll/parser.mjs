// Parser PURO del scoreboard ESPN → estado live_scores (formato webhook Apify).
// Sin imports: compartido entre la EF (Deno, index.ts) y la suite Node
// (tests/espn-poll-parser.test.mjs), patrón matcher.mjs de update-results.
//
// Réplica EXACTA del stopgap SQL public.espn_live_poll() (11-jun-2026): el id
// de cada gol debe ser ESTABLE y bit-idéntico al que generaba el SQL —
//   ('x' || substr(md5(evId || displayClock || athlete), 1, 7))::bit(28)::int
// — porque la detección de goles nuevos para WhatsApp deduplica contra los
// events que aquel poller ya escribió en live_scores. Vectores reales
// verificados contra BD (MEX-RSA, espn id 760415): Quiñones → 199794646,
// Jiménez → 139952626. md5 sobre bytes UTF-8 (mismo encoding que Postgres).

export function leadingInt(s) {
  const m = String(s ?? '').match(/^\d+/);
  return m ? parseInt(m[0], 10) : null;
}

// competitions[0].status → { status, code, active } | null (null = 'pre', no escribir).
// post → finished/100; in + STATUS_HALFTIME → halftime/31; resto de in →
// inprogress con code 6 (1ª parte) o 7 (2ª o más).
export function mapEspnStatus(state, typeName, period) {
  if (!state || state === 'pre') return null;
  if (state === 'post') return { status: 'finished', code: 100, active: false };
  if (typeName === 'STATUS_HALFTIME') return { status: 'halftime', code: 31, active: true };
  const p = Number.parseInt(String(period ?? '1'), 10) || 1;
  return { status: 'inprogress', code: p >= 2 ? 7 : 6, active: true };
}

// Dígitos iniciales de status.displayClock ("45'+2'" → 45). En finished sin
// clock parseable, fallback 90 (mismo COALESCE del SQL).
export function minuteFor(statusStr, displayClock) {
  const min = leadingInt(displayClock);
  if (statusStr === 'finished' && min == null) return 90;
  return min;
}

export function pollIntervalFor(statusStr) {
  if (statusStr === 'finished') return 0;
  if (statusStr === 'halftime') return 120;
  return 60;
}

// competitors[] → marcador orientado a proyecto (swap si inverted, p.ej.
// BRA-ESC 24-jun viene invertido en ESPN) + team.id del home ESPN (necesario
// para el XOR de isHome en los goles).
export function scoresFor(competitors, inverted) {
  const list = Array.isArray(competitors) ? competitors : [];
  const home = list.find((c) => c && c.homeAway === 'home');
  const away = list.find((c) => c && c.homeAway === 'away');
  const parse = (c) => {
    const s = c ? c.score : null;
    if (s == null || s === '') return null;
    const n = Number.parseInt(String(s), 10);
    return Number.isFinite(n) ? n : null;
  };
  let scoreHome = parse(home);
  let scoreAway = parse(away);
  if (inverted === true) {
    const t = scoreHome; scoreHome = scoreAway; scoreAway = t;
  }
  return { scoreHome, scoreAway, homeTeamId: String(home?.team?.id ?? '') };
}

// Concat exacto del SQL: id evento + clock.displayValue + athlete (o '').
export function goalIdInput(espnEventId, clockDisplayValue, athleteName) {
  return String(espnEventId) + String(clockDisplayValue ?? '') + String(athleteName ?? '');
}

// 7 primeros hex del md5 → bit(28)::int. Siempre positivo (max 268435455).
export function goalIdFromMd5Hex(hex) {
  return parseInt(String(hex).slice(0, 7), 16);
}

// competitions[0].details → events[] formato webhook: solo scoringPlay=true y
// shootout=false (los penaltis de tanda NO son gol de jugador — premisa del
// bridge), orden por clock.value asc. md5HexAsync: (input) => Promise<hex>
// (inyectado: std/crypto en la EF, node:crypto en tests).
export async function buildGoalEvents(espnEventId, details, inverted, homeTeamId, md5HexAsync) {
  const scoring = (Array.isArray(details) ? details : []).filter(
    (d) => d && d.scoringPlay === true && d.shootout !== true,
  );
  scoring.sort((a, b) =>
    (Number.parseFloat(String(a?.clock?.value ?? '0')) || 0) -
    (Number.parseFloat(String(b?.clock?.value ?? '0')) || 0));
  const out = [];
  for (const d of scoring) {
    const athlete = d?.athletesInvolved?.[0]?.displayName ?? null;
    const clockDv = String(d?.clock?.displayValue ?? '');
    const hex = await md5HexAsync(goalIdInput(espnEventId, clockDv, athlete ?? ''));
    out.push({
      id: goalIdFromMd5Hex(hex),
      incidentType: 'goal',
      incidentClass: d?.ownGoal === true ? 'ownGoal' : (d?.penaltyKick === true ? 'penalty' : 'regular'),
      player: { name: athlete },
      time: leadingInt(clockDv),
      isHome: (String(d?.team?.id ?? '') === String(homeTeamId)) !== (inverted === true),
    });
  }
  return out;
}
