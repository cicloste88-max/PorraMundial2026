// xi-slot-map.mjs — construye squads.xi (Sprint A2 FIX C).
//
// El once-tipo de FF llega en ORDEN DOM, que NO es orden de slot: el portero
// aparece primero en unas selecciones (JPN) y último en otras (ESP). El único
// dato fiable de posición son las coordenadas data-onceff-x/y de cada titular.
// Aquí:
//   1) assignSlotsByCoords — asigna cada titular FF al slot de FORMATION_COORDS
//      más cercano mediante matching geométrico GLOBAL (greedy-min-edge). El
//      nearest por-jugador NO basta: en ESP Pedri (74,42) cae más cerca del
//      slot de delantero que del de medio; la asignación global lo resuelve.
//   2) buildXi — por slot (en orden POS_BY_FORMATION) matchea el nombre del
//      titular contra el roster con desempate por bucket (homónimos: JPN
//      Suzuki→Zion Suzuki PO, Ito→Hiroki Ito DEF), y toma foto/dorsal/tm/
//      nombre canónico de la entrada del roster.

import { scorePair, normalize, resolveAlias, NON_LATIN_ISO3 } from './name-matcher.mjs';

// Bucket esperado por código de slot, para DESEMPATE de homónimos (no es un
// filtro duro: si ningún homónimo casa el bucket, gana el de mayor score).
// Agrupación según mandato Sprint A2: los MCO/extremos cuentan como Delantero.
export const POS_CODE_BUCKET = {
  PO: 'Portero',
  LD: 'Defensa', LI: 'Defensa', DFC: 'Defensa', CAD: 'Defensa', CAI: 'Defensa',
  MCD: 'Centrocampista', MC: 'Centrocampista',
  MCO: 'Delantero', ED: 'Delantero', EI: 'Delantero', SD: 'Delantero', DC: 'Delantero',
};

// Códigos de slot por formación. DEBE mantenerse en sync con POS_BY_FORMATION
// de supabase/functions/get-squad/index.ts (misma tabla). slot 0 = portero.
export const POS_BY_FORMATION = {
  '4-3-3':   ['PO','LD','DFC','DFC','LI','MCD','MC','MCO','ED','DC','EI'],
  '4-4-2':   ['PO','LD','DFC','DFC','LI','ED','MC','MC','EI','DC','SD'],
  '4-2-3-1': ['PO','LD','DFC','DFC','LI','MCD','MCD','ED','MCO','EI','DC'],
  '3-5-2':   ['PO','DFC','DFC','DFC','CAD','MC','MCD','MC','CAI','DC','SD'],
  '5-3-2':   ['PO','DFC','DFC','DFC','LD','LI','MC','MCD','MC','DC','SD'],
  '4-1-4-1': ['PO','LD','DFC','DFC','LI','MCD','ED','MC','MC','EI','DC'],
  '4-3-2-1': ['PO','LD','DFC','DFC','LI','MCD','MC','MC','MCO','MCO','DC'],
  '3-4-3':   ['PO','DFC','DFC','DFC','CAD','MC','MC','CAI','ED','DC','EI'],
  '5-4-1':   ['PO','DFC','DFC','DFC','LD','LI','ED','MC','MC','EI','DC'],
  '4-4-1-1': ['PO','LD','DFC','DFC','LI','ED','MC','MC','EI','SD','DC'],
  '3-4-2-1': ['PO','DFC','DFC','DFC','CAD','MC','MC','CAI','MCO','MCO','DC'],
  '4-1-3-2': ['PO','LD','DFC','DFC','LI','MCD','MC','MCO','MC','DC','SD'],
};

export function getPosCodes(formacion) {
  return POS_BY_FORMATION[formacion] || POS_BY_FORMATION['4-3-3'];
}

/**
 * Asignación geométrica global de titulares FF → índices de slot.
 * greedy-min-edge: ordena todas las aristas (slot, titular) por distancia² y
 * asigna la más corta cuyos dos extremos sigan libres, hasta agotar.
 *
 * @param {Array<{x:number,y:number}>} ffSlots  titulares con coords FF
 * @param {Array<[number,number]>} coords        FORMATION_COORDS[formacion]
 * @returns {{assigned:Array, maxDist:number, mapped:number, unmappable:number}}
 *   assigned[slot] = ffSlot asignado a ese slot, o null.
 */
export function assignSlotsByCoords(ffSlots, coords) {
  const n = coords.length;
  const assigned = new Array(n).fill(null);
  const pts = ffSlots
    .map((s) => ({ s, x: s.x, y: s.y }))
    .filter((p) => Number.isFinite(p.x) && Number.isFinite(p.y));
  const unmappable = ffSlots.length - pts.length;
  if (pts.length === 0) return { assigned, maxDist: 0, mapped: 0, unmappable };

  const edges = [];
  for (let si = 0; si < n; si++) {
    for (let pi = 0; pi < pts.length; pi++) {
      const dx = coords[si][0] - pts[pi].x;
      const dy = coords[si][1] - pts[pi].y;
      edges.push({ si, pi, d: dx * dx + dy * dy });
    }
  }
  edges.sort((a, b) => a.d - b.d);

  const slotTaken = new Array(n).fill(false);
  const ptTaken = new Array(pts.length).fill(false);
  const target = Math.min(n, pts.length);
  let mapped = 0;
  let maxD = 0;
  for (const e of edges) {
    if (slotTaken[e.si] || ptTaken[e.pi]) continue;
    assigned[e.si] = pts[e.pi].s;
    slotTaken[e.si] = true;
    ptTaken[e.pi] = true;
    mapped++;
    if (e.d > maxD) maxD = e.d;
    if (mapped === target) break;
  }
  return { assigned, maxDist: Math.sqrt(maxD), mapped, unmappable };
}

// Candidatos del roster (no usados) que matchean `name` por encima de minScore.
function scoreRoster(name, roster, usedIdx, { iso3, aliases, simThreshold, minScore }) {
  const resolved = resolveAlias(name, iso3, aliases);
  const out = [];
  for (let i = 0; i < roster.length; i++) {
    if (usedIdx.has(i)) continue;
    const pn = roster[i]?.nombre;
    if (!pn) continue;
    const sc = scorePair(resolved, pn, { simThreshold });
    if (sc >= minScore) out.push({ i, sc, bucket: roster[i]?.posicion || null });
  }
  out.sort((a, b) => b.sc - a.sc);
  return out;
}

// Elige la entrada del roster para un slot, con desempate por bucket.
function pickRosterEntry(titular, alternativa, slotBucket, roster, usedIdx, opts) {
  const margin = 5;
  for (const name of [titular, alternativa]) {
    if (!name) continue;
    const cands = scoreRoster(name, roster, usedIdx, opts);
    if (cands.length === 0) continue;
    const top = cands[0].sc;
    const tied = cands.filter((c) => top - c.sc < margin);
    if (tied.length === 1) return { ...cands[0], via: name === titular ? 'titular' : 'alternativa' };
    // Desempate: preferir bucket del slot; si ninguno casa, mayor score (cands[0]).
    const byBucket = tied.filter((c) => c.bucket === slotBucket);
    const chosen = byBucket.length > 0 ? byBucket[0] : cands[0];
    return { ...chosen, via: name === titular ? 'titular' : 'alternativa' };
  }
  return null;
}

function entryFromRoster(slot, pos, p) {
  return {
    slot,
    pos,
    nombre: p.nombre,
    dorsal: p.dorsal ?? null,
    foto_url: p.foto_url ?? null,
    tm_player_id: p.tm_player_id ?? null,
    posicion_label: p.posicion_tm ?? null,
  };
}

const placeholder = (slot, pos) => ({
  slot, pos, nombre: '—', dorsal: null, foto_url: null, tm_player_id: null, posicion_label: null,
});

/**
 * Construye el array squads.xi (11 entradas en orden de slot).
 * @returns {{xi:Array, warnings:string[], stats:object}}
 */
export function buildXi({ ffSlots, formacion, coords, roster, iso3 = null, aliases = null }) {
  const warnings = [];
  const posCodes = getPosCodes(formacion);
  const { assigned, maxDist, mapped, unmappable } = assignSlotsByCoords(ffSlots, coords);
  if (unmappable > 0) warnings.push(`${unmappable} titular(es) FF sin coords data-onceff-x/y`);

  const usedIdx = new Set();
  const simThreshold = iso3 && NON_LATIN_ISO3.has(iso3) ? 0.7 : 0.75;
  const opts = { iso3, aliases, simThreshold, minScore: 60 };
  const xi = [];
  let matched = 0;

  for (let slot = 0; slot < 11; slot++) {
    const pos = posCodes[slot] || 'MC';
    const bucket = POS_CODE_BUCKET[pos] || null;
    const ff = assigned[slot];
    let entry = null;

    if (ff && ff.titular) {
      const chosen = pickRosterEntry(ff.titular, ff.alternativa || null, bucket, roster, usedIdx, opts);
      if (chosen) {
        usedIdx.add(chosen.i);
        entry = entryFromRoster(slot, pos, roster[chosen.i]);
        matched++;
      } else {
        warnings.push(`slot ${slot} (${pos}) "${ff.titular}" sin match en roster → nombre FF, sin foto`);
        entry = { slot, pos, nombre: ff.titular, dorsal: null, foto_url: null, tm_player_id: null, posicion_label: null };
      }
    }

    if (!entry && pos === 'PO') {
      // FF no publicó portero en el once-tipo: tomar el Portero del roster.
      let gkIdx = -1;
      for (let i = 0; i < roster.length; i++) {
        if (usedIdx.has(i)) continue;
        if ((roster[i]?.posicion || '') === 'Portero') {
          if (gkIdx < 0 || String(roster[i]?.dorsal) === '1') gkIdx = i;
        }
      }
      if (gkIdx >= 0) {
        usedIdx.add(gkIdx);
        entry = entryFromRoster(slot, pos, roster[gkIdx]);
        warnings.push(`slot 0 PO sin once-tipo → roster Portero "${roster[gkIdx].nombre}"`);
      }
    }

    if (!entry) {
      entry = placeholder(slot, pos);
      warnings.push(`slot ${slot} (${pos}) sin once-tipo ni roster → placeholder`);
    }
    xi.push(entry);
  }

  return {
    xi,
    warnings,
    stats: { matched, mapped, unmappable, maxDist: Math.round(maxDist), conFoto: xi.filter((e) => e.foto_url).length },
  };
}
