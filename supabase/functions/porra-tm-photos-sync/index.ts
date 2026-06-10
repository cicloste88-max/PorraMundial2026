// Versionado desde runtime el 10-jun-2026 (v8). Origen: deploy vía MCP sin commit previo.
// Fuente de verdad hasta esta fecha: runtime Supabase. A partir de ahora: este fichero.
// supabase/functions/porra-tm-photos-sync/index.ts
// v6: matcher mejorado
//   1) normalize() agresivo: chars precompuestos bosnios/turcos/polacos antes de NFD
//   2) singleWordMatch: TM "Pedri"/"Rodri" matchea BBDD "Pedri González"/"Rodri Hernández"
//   3) subsetMatch: TM "Lindelöf" matchea BBDD "Nilsson Lindelöf" (apellido subset)
//   4) homonymBucketAssign: Brasil tiene 2 Danilo TM y 2 Danilo BBDD → asigna 1:1 por bucket

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0';

const TM_IDS: Record<string, number | null> = {
  ESP: 3375, ARG: 3437, BIH: 3446, BRA: 3439, MEX: 6303, SWE: 3557,
  FRA: 3377,
  ALG: null, AUS: null, AUT: null, BEL: null, CAN: null, CIV: null,
  COD: null, COL: null, CPV: null, CRO: null, CUW: null, CZE: null,
  ECU: null, EGY: null, ENG: null, GER: null, GHA: null, HAI: null,
  IRN: null, IRQ: null, JOR: null, JPN: null, KOR: null, KSA: null,
  MAR: null, NED: null, NOR: null, NZL: null, PAN: null, PAR: null,
  POR: null, QAT: null, RSA: null, SCO: null, SEN: null, SUI: null,
  TUN: null, TUR: null, URU: null, USA: null, UZB: null,
};

const TM_SLUGS: Record<string, string> = {
  FRA: 'frankreich', ESP: 'spanien', ARG: 'argentinien',
  BIH: 'bosnien-und-herzegowina', BRA: 'brasilien', MEX: 'mexiko', SWE: 'schweden',
};

const TM_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
};
const IMG_HEADERS = { ...TM_HEADERS, 'Referer': 'https://www.transfermarkt.es/' };
const STORAGE_BUCKET = 'player-photos';

function normalize(name: string): string {
  return String(name || '')
    .replace(/[žŽ]/g, 'z').replace(/[ćĆ]/g, 'c').replace(/[čČ]/g, 'c')
    .replace(/[šŠ]/g, 's').replace(/[đĐ]/g, 'd').replace(/[ńŃ]/g, 'n')
    .replace(/[łŁ]/g, 'l').replace(/[şŞ]/g, 's').replace(/[ğĞ]/g, 'g')
    .replace(/[ıİ]/g, 'i').replace(/[øØ]/g, 'o').replace(/[æÆ]/g, 'ae')
    .replace(/[ßẞ]/g, 'ss')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\b(jr|sr|junior|senior|i{2,3}|iv)\b\.?/gi, '')
    .replace(/[^a-z\s'-]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function lastName(n: string): string {
  const parts = n.replace(/-/g, '').split(' ');
  return parts[parts.length - 1] || '';
}
function firstName(n: string): string {
  return n.split(' ')[0] || '';
}
function nameTokens(n: string): string[] {
  return n.replace(/-/g, ' ').split(/\s+/).filter(t => t.length >= 2);
}

function levenshtein(a: string, b: string): number {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const v0 = new Array(b.length + 1);
  const v1 = new Array(b.length + 1);
  for (let i = 0; i <= b.length; i++) v0[i] = i;
  for (let i = 0; i < a.length; i++) {
    v1[0] = i + 1;
    for (let j = 0; j < b.length; j++) {
      const cost = a[i] === b[j] ? 0 : 1;
      v1[j + 1] = Math.min(v1[j] + 1, v0[j + 1] + 1, v0[j] + cost);
    }
    for (let j = 0; j <= b.length; j++) v0[j] = v1[j];
  }
  return v1[b.length];
}

function tmPositionToBucket(tmPos: string): string {
  const p = normalize(tmPos);
  if (/portero|guarda/.test(p)) return 'Portero';
  if (/defensa|lateral|central|libero/.test(p)) return 'Defensa';
  if (/pivote|mediocentro|interior|medio|centrocampista|enganche|mediapunta/.test(p)) return 'Centrocampista';
  if (/delantero|extremo|punta|atacante/.test(p)) return 'Delantero';
  return '';
}

interface TmPlayer {
  tm_player_id: number;
  nombre: string;
  posicion_bucket: string;
  posicion_raw: string;
  photo_url: string;
}

function parseTmSquadHtml(html: string): TmPlayer[] {
  const photoRe1 = /(?:src|data-src)="https?:\/\/[^"]*portrait\/medium\/(\d+)-(\d+)\.jpg[^"]*"[^>]*?\btitle="([^"]+)"/g;
  const photoRe2 = /\btitle="([^"]+)"[^>]*?(?:src|data-src)="https?:\/\/[^"]*portrait\/medium\/(\d+)-(\d+)\.jpg[^"]*"/g;

  const matches: Array<{tm_player_id: number, photo_url: string, nombre: string, offset: number}> = [];
  const seenIds = new Set<number>();

  let m: RegExpExecArray | null;
  while ((m = photoRe1.exec(html)) !== null) {
    const tm_player_id = parseInt(m[1], 10);
    if (seenIds.has(tm_player_id)) continue;
    seenIds.add(tm_player_id);
    matches.push({ tm_player_id, photo_url: `https://img.a.transfermarkt.technology/portrait/medium/${tm_player_id}-${m[2]}.jpg`, nombre: m[3].trim(), offset: m.index });
  }
  while ((m = photoRe2.exec(html)) !== null) {
    const tm_player_id = parseInt(m[2], 10);
    if (seenIds.has(tm_player_id)) continue;
    seenIds.add(tm_player_id);
    matches.push({ tm_player_id, photo_url: `https://img.a.transfermarkt.technology/portrait/medium/${tm_player_id}-${m[3]}.jpg`, nombre: m[1].trim(), offset: m.index });
  }

  const players: TmPlayer[] = [];
  for (const item of matches) {
    const window = html.slice(item.offset, item.offset + 1200);
    const tdRe = /<td[^>]*>\s*([A-Za-z\u00C0-\u017F\s]+)\s*<\/td>/g;
    let posMatch: RegExpExecArray | null;
    let posicion_raw = '';
    let count = 0;
    while ((posMatch = tdRe.exec(window)) !== null) {
      const candidate = posMatch[1].trim();
      if (candidate.length < 3 || candidate.length > 35) continue;
      if (/\d/.test(candidate)) continue;
      if (candidate === item.nombre) continue;
      const bucket = tmPositionToBucket(candidate);
      if (bucket) { posicion_raw = candidate; break; }
      count++;
      if (count > 5) break;
    }
    players.push({ tm_player_id: item.tm_player_id, nombre: item.nombre, posicion_raw, posicion_bucket: tmPositionToBucket(posicion_raw), photo_url: item.photo_url });
  }
  return players;
}

interface BbddPlayer {
  nombre: string;
  posicion?: string;
  posicion_bucket?: string;
  foto_url?: string | null;
  tm_player_id?: number | null;
  [k: string]: unknown;
}

interface NormP {
  full: string; first: string; last: string; tokens: string[]; bucket: string;
}

interface MatchResult {
  matched: Map<number, BbddPlayer>;
  ambiguities: Array<{ bbdd_index: number, bbdd_nombre: string, candidates: TmPlayer[] }>;
  unmatched_bbdd: number[];
  unmatched_tm: TmPlayer[];
}

function matchPlayers(bbddPlayers: BbddPlayer[], tmPlayers: TmPlayer[]): MatchResult {
  const matched = new Map<number, BbddPlayer>();
  const ambiguities: MatchResult['ambiguities'] = [];
  const usedTmIds = new Set<number>();
  const usedBbddIdx = new Set<number>();

  const bbddNorm: NormP[] = bbddPlayers.map(p => {
    const n = normalize(p.nombre || '');
    return { full: n, first: firstName(n), last: lastName(n), tokens: nameTokens(n),
             bucket: (p.posicion_bucket || p.posicion || '') as string };
  });
  const tmNorm: NormP[] = tmPlayers.map(t => {
    const n = normalize(t.nombre);
    return { full: n, first: firstName(n), last: lastName(n), tokens: nameTokens(n),
             bucket: t.posicion_bucket };
  });

  function commit(bbddIdx: number, tmIdx: number) {
    const tmPlayer = tmPlayers[tmIdx];
    matched.set(bbddIdx, { ...bbddPlayers[bbddIdx], tm_player_id: tmPlayer.tm_player_id, photo_url: tmPlayer.photo_url });
    usedTmIds.add(tmPlayer.tm_player_id);
    usedBbddIdx.add(bbddIdx);
  }

  for (let i = 0; i < bbddPlayers.length; i++) {
    if (usedBbddIdx.has(i)) continue;
    const bbdd = bbddNorm[i];
    if (!bbdd.last && !bbdd.first) continue;

    const cands: Array<{idx: number, dist: number, full_dist: number}> = [];
    for (let j = 0; j < tmPlayers.length; j++) {
      if (usedTmIds.has(tmPlayers[j].tm_player_id)) continue;
      const tm = tmNorm[j];
      const bucketMatch = bbdd.bucket && tm.bucket && bbdd.bucket === tm.bucket;
      const allowDiffBucket = !bbdd.bucket || !tm.bucket;
      const dLast = levenshtein(bbdd.last, tm.last);
      const dFull = levenshtein(bbdd.full, tm.full);
      const exactOver = dFull === 0;
      if (dLast <= 2 && dFull <= 4 && (bucketMatch || allowDiffBucket || exactOver)) {
        cands.push({ idx: j, dist: dLast, full_dist: dFull });
      }
    }
    cands.sort((a, b) => a.dist - b.dist || a.full_dist - b.full_dist);
    if (cands.length === 0) continue;
    if (cands.length === 1 ||
        cands[0].dist < cands[1].dist ||
        cands[0].full_dist + 1 < cands[1].full_dist) {
      commit(i, cands[0].idx);
    }
  }

  for (let i = 0; i < bbddPlayers.length; i++) {
    if (usedBbddIdx.has(i)) continue;
    const bbdd = bbddNorm[i];

    const cands: Array<{idx: number, score: number}> = [];
    for (let j = 0; j < tmPlayers.length; j++) {
      if (usedTmIds.has(tmPlayers[j].tm_player_id)) continue;
      const tm = tmNorm[j];
      const bucketOk = !bbdd.bucket || !tm.bucket || bbdd.bucket === tm.bucket;
      if (!bucketOk) continue;

      if (tm.tokens.length === 1 && tm.tokens[0].length >= 4 && bbdd.tokens.includes(tm.tokens[0])) {
        cands.push({ idx: j, score: 0 }); continue;
      }
      if (bbdd.tokens.length === 1 && bbdd.tokens[0].length >= 4 && tm.tokens.includes(bbdd.tokens[0])) {
        cands.push({ idx: j, score: 0 }); continue;
      }
      if (tm.last.length >= 4 && bbdd.tokens.includes(tm.last)) {
        const fnDist = levenshtein(bbdd.first, tm.first);
        if (fnDist <= 3 || !bbdd.first || !tm.first) cands.push({ idx: j, score: 1 + fnDist });
      } else if (bbdd.last.length >= 4 && tm.tokens.includes(bbdd.last)) {
        const fnDist = levenshtein(bbdd.first, tm.first);
        if (fnDist <= 3 || !bbdd.first || !tm.first) cands.push({ idx: j, score: 1 + fnDist });
      }
    }
    cands.sort((a, b) => a.score - b.score);
    if (cands.length === 0) continue;
    if (cands.length === 1 || cands[0].score < cands[1].score) {
      commit(i, cands[0].idx);
    }
  }

  const bbddByFull = new Map<string, number[]>();
  for (let i = 0; i < bbddPlayers.length; i++) {
    if (usedBbddIdx.has(i)) continue;
    const k = bbddNorm[i].full;
    if (!bbddByFull.has(k)) bbddByFull.set(k, []);
    bbddByFull.get(k)!.push(i);
  }
  const tmByFull = new Map<string, number[]>();
  for (let j = 0; j < tmPlayers.length; j++) {
    if (usedTmIds.has(tmPlayers[j].tm_player_id)) continue;
    const k = tmNorm[j].full;
    if (!tmByFull.has(k)) tmByFull.set(k, []);
    tmByFull.get(k)!.push(j);
  }
  for (const [name, bbddIdxs] of bbddByFull) {
    const tmIdxs = tmByFull.get(name);
    if (!tmIdxs || bbddIdxs.length === 0 || tmIdxs.length === 0) continue;
    const tmAvail = [...tmIdxs];
    for (const bIdx of bbddIdxs) {
      const bucket = bbddNorm[bIdx].bucket;
      let pick = tmAvail.findIndex(j => tmNorm[j].bucket === bucket);
      if (pick < 0 && tmAvail.length > 0) pick = 0;
      if (pick < 0) continue;
      const tmJ = tmAvail.splice(pick, 1)[0];
      commit(bIdx, tmJ);
    }
  }

  const unmatched_bbdd: number[] = [];
  for (let i = 0; i < bbddPlayers.length; i++) if (!usedBbddIdx.has(i)) unmatched_bbdd.push(i);
  const unmatched_tm = tmPlayers.filter(t => !usedTmIds.has(t.tm_player_id));
  return { matched, ambiguities, unmatched_bbdd, unmatched_tm };
}

async function uploadPhoto(supabase: ReturnType<typeof createClient>, iso3: string, tmPlayerId: number, photoUrl: string): Promise<string> {
  const path = `${iso3}/${tmPlayerId}.jpg`;
  const { data: existing } = await supabase.storage.from(STORAGE_BUCKET).list(iso3, { limit: 1, search: `${tmPlayerId}.jpg` });
  if (existing && existing.length > 0 && existing[0].name === `${tmPlayerId}.jpg`) {
    return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
  }
  const resp = await fetch(photoUrl, { headers: IMG_HEADERS });
  if (!resp.ok) throw new Error(`Photo fetch ${tmPlayerId} HTTP ${resp.status}`);
  const blob = await resp.blob();
  const { error: uploadErr } = await supabase.storage.from(STORAGE_BUCKET).upload(path, blob, { contentType: 'image/jpeg', upsert: true });
  if (uploadErr) throw new Error(`Upload ${path}: ${uploadErr.message}`);
  return supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path).data.publicUrl;
}

async function processIso3(supabase: ReturnType<typeof createClient>, iso3: string, dryRun: boolean) {
  const tmId = TM_IDS[iso3];
  const slug = TM_SLUGS[iso3];
  if (!tmId || !slug) return { iso3, ok: false, reason: `Missing TM_ID o slug para ${iso3}` };

  const { data: squadRow, error: dbErr } = await supabase.from('squads').select('iso3, equipo, jugadores').eq('iso3', iso3).single();
  if (dbErr) return { iso3, ok: false, reason: `DB: ${dbErr.message}` };
  if (!squadRow?.jugadores || squadRow.jugadores.length === 0) return { iso3, ok: false, reason: 'No hay jugadores en BBDD' };
  const bbddPlayers: BbddPlayer[] = squadRow.jugadores;

  const url = `https://www.transfermarkt.es/${slug}/startseite/verein/${tmId}`;
  const tmResp = await fetch(url, { headers: TM_HEADERS });
  if (!tmResp.ok) return { iso3, ok: false, reason: `TM HTTP ${tmResp.status}` };
  const html = await tmResp.text();

  const tmPlayers = parseTmSquadHtml(html);
  if (tmPlayers.length === 0) return { iso3, ok: false, reason: 'TM parse: 0 jugadores' };

  const match = matchPlayers(bbddPlayers, tmPlayers);

  let nUploaded = 0;
  if (!dryRun) {
    const updatedPlayers = [...bbddPlayers];
    for (const [idx, player] of match.matched) {
      const pid = (player as any).tm_player_id as number;
      const tmPlayer = tmPlayers.find(t => t.tm_player_id === pid)!;
      try {
        if (bbddPlayers[idx].foto_url && (bbddPlayers[idx] as any).tm_player_id === pid) continue;
        const publicUrl = await uploadPhoto(supabase, iso3, pid, tmPlayer.photo_url);
        updatedPlayers[idx] = { ...updatedPlayers[idx], tm_player_id: pid, foto_url: publicUrl };
        nUploaded++;
        await new Promise(r => setTimeout(r, 200));
      } catch (err) {
        console.error(`[${iso3}] Upload ${pid} failed: ${(err as Error).message}`);
      }
    }
    const { error: updErr } = await supabase.from('squads').update({ jugadores: updatedPlayers, updated_at: new Date().toISOString() }).eq('iso3', iso3);
    if (updErr) console.error(`[${iso3}] DB update: ${updErr.message}`);
  }

  return {
    iso3, ok: true,
    n_tm_players: tmPlayers.length,
    n_matched: match.matched.size,
    n_ambiguities: match.ambiguities.length,
    n_unmatched_bbdd: match.unmatched_bbdd.length,
    n_unmatched_tm: match.unmatched_tm.length,
    n_photos_uploaded: nUploaded,
    ambiguities: match.ambiguities.map(a => ({ bbdd: a.bbdd_nombre, candidates: a.candidates.map(c => `${c.nombre} (TM:${c.tm_player_id})`) })),
    unmatched_bbdd: match.unmatched_bbdd.map(i => bbddPlayers[i].nombre),
    unmatched_tm: match.unmatched_tm.map(t => t.nombre),
  };
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('Use POST', { status: 405 });

  let body: { iso3?: string; dry_run?: boolean };
  try { body = await req.json(); } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON' }), { status: 400, headers: { 'Content-Type': 'application/json' } });
  }

  const iso3 = body.iso3;
  const dryRun = body.dry_run === true;
  if (!iso3) return new Response(JSON.stringify({ error: 'iso3 required' }), { status: 400, headers: { 'Content-Type': 'application/json' } });

  const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
  const supabase = createClient(supabaseUrl, supabaseKey);

  if (iso3 === 'all') {
    const candidates = Object.keys(TM_IDS).filter(k => TM_IDS[k] && TM_SLUGS[k]);
    const results = [];
    for (const code of candidates) {
      const r = await processIso3(supabase, code, dryRun);
      results.push(r);
      await new Promise(r => setTimeout(r, 1000));
    }
    return new Response(JSON.stringify({ dry_run: dryRun, results }, null, 2), { status: 200, headers: { 'Content-Type': 'application/json' } });
  }

  const result = await processIso3(supabase, iso3, dryRun);
  return new Response(JSON.stringify({ dry_run: dryRun, result }, null, 2), { status: result.ok ? 200 : 500, headers: { 'Content-Type': 'application/json' } });
});
