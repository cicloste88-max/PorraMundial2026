// Fuzzy matching de nombres: normalización + Levenshtein + scoring por apellido.
// Usado para emparejar nombres del XI titular (futbolfantasy /equipos/<slug>) con la
// lista completa scraped del cuerpo de la noticia, y también para enrich-tm.
//
// 20-may-2026 — normalize() canónica: strip diacríticos/apóstrofes/guiones (uni
// + ascii) + tokens ordenados alfabéticamente. Hace la clave order-invariant
// para que 'Son Heung-min' (DB, orden coreano) y 'Heung-min Son' (TM, orden
// occidental) colisionen en la misma clave del Map de applyEnrich. Los guiones
// se ELIMINAN (joiners), no se reemplazan por espacio: 'Kang-in' → 'kangin'
// como token único. Esto evita la colisión 'Lee Kang-in' ↔ 'Kang Lee'.
//
// tokens()/lastToken() mantienen orden ORIGINAL — scorePair sigue usando "último
// token = apellido" para evitar falsos positivos tipo 'João Félix' vs 'João
// Cancelo'. La sort es solo en normalize() (la salida del hash).

// Hyphens (ascii + unicode): ELIMINADOS para tratar compuestos como un token único.
const HYPHENS_RE = /[-‐‑‒–—―−]/g;
// Apostrofes (ascii + unicode + acentos sueltos): ELIMINADOS.
const APOSTROPHES_RE = /['‘’ʼ`´]/g;
// Combining diacritical marks (NFD).
const DIACRITICS_RE = /[̀-ͯ]/g;

// 23-may-2026 — Transliteración árabe→latín varía entre fuentes (medio español
// vs TM). Para que `Mousa Al-Tamari` matchee `Mousa Tamari`, `Ibrahim Sadeh`
// matchee `Ibrahim Saadeh` y `Mohammed Al-Dawoud` matchee `Mohammad Al-Dawoud`,
// añadimos 3 normalizaciones extra:
//   R1: strip prefijo `al-`/`el-` (con hyphen explícito) ANTES del hyphen strip
//   R2: colapsar doble vocal (aa/ee/ii/oo/uu → vocal simple)
//   R3: dict canónico para Mohammed/Mohammad/Muhammad → mohamed
// Safe para europeos: ningún apellido europeo usa "Al-"/"El-" con hyphen,
// nombres como Aaron/Aaltonen colapsan consigo mismos (la regla se aplica a
// ambos lados del match), y R3 solo afecta a 4 spellings explícitos.
// R2 NO toca consonantes dobles (ll, rr, nn, ss, etc) — preserva Pellegrini,
// Hernandez, etc. intactos.
const ARABIC_FIRSTNAME_MAP = {
  mohammed: 'mohamed',
  mohammad: 'mohamed',
  muhammad: 'mohamed',
  muhammed: 'mohamed',
};

function rawTokens(s) {
  if (!s) return [];
  return String(s)
    .normalize('NFD')
    .replace(DIACRITICS_RE, '')
    .toLowerCase()
    .replace(APOSTROPHES_RE, '')
    .replace(/\b(?:al|el)-/g, '')          // R1: strip Al-/El- prefix
    .replace(HYPHENS_RE, '')
    .replace(/([aeiou])\1+/g, '$1')        // R2: collapse doubled vowels
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
    .map((t) => ARABIC_FIRSTNAME_MAP[t] || t); // R3: canonical Arabic firstnames
}

// Salida canónica: tokens ordenados alfabéticamente, joined con espacio.
// Order-invariant: 'Son Heung-min' y 'Heung-min Son' producen 'heungmin son'.
export function normalize(s) {
  const toks = rawTokens(s);
  if (toks.length === 0) return '';
  return [...toks].sort().join(' ');
}

// Tokens en orden ORIGINAL — preserva semántica "último token = apellido".
export function tokens(name) {
  return rawTokens(name);
}

export function lastToken(name) {
  const t = rawTokens(name);
  return t.length ? t[t.length - 1] : '';
}

function levenshtein(a, b) {
  if (a === b) return 0;
  if (!a.length) return b.length;
  if (!b.length) return a.length;
  const prev = new Array(b.length + 1);
  const curr = new Array(b.length + 1);
  for (let j = 0; j <= b.length; j++) prev[j] = j;
  for (let i = 1; i <= a.length; i++) {
    curr[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      curr[j] = Math.min(curr[j - 1] + 1, prev[j] + 1, prev[j - 1] + cost);
    }
    for (let j = 0; j <= b.length; j++) prev[j] = curr[j];
  }
  return prev[b.length];
}

// Score 0..100 (mayor = mejor match). Considera:
//  - igualdad normalizada (canónica, order-invariant) → 100
//  - último apellido coincide (orden original) → 80 + bonus por overlap
//  - subset 1-token (un nombre es un único token presente en el otro) → 75
//  - token-set parcial (≥2 tokens significativos solapan) → 78-92
//  - Levenshtein del último apellido (typos) → 60-80
function scorePair(a, b) {
  const na = normalize(a);
  const nb = normalize(b);
  if (!na || !nb) return 0;
  if (na === nb) return 100;

  const ta = tokens(a);
  const tb = tokens(b);
  const la = ta[ta.length - 1] || '';
  const lb = tb[tb.length - 1] || '';

  if (la && la === lb) {
    const overlap = ta.filter((tok) => tb.includes(tok)).length;
    return 80 + Math.min(15, overlap * 5);
  }

  // a es un único token (ej. "Théo") y aparece como token en b ("Théo Hernández")
  if (ta.length === 1 && tb.includes(ta[0])) return 75;
  if (tb.length === 1 && ta.includes(tb[0])) return 75;

  // Token-set fallback: cubre nombres de 2+ tokens donde el "último token"
  // diverge pero hay solape significativo en otras posiciones (ej. nombres
  // con orden mixto que no son swap exacto, segundo apellido extra, etc.).
  // Requiere ≥2 tokens en intersección para evitar emparejar 'Lee Kang-in'
  // con 'Kang Lee' (overlap=1 'lee' tras strip-hyphen no basta).
  if (ta.length >= 2 && tb.length >= 2) {
    const setA = new Set(ta);
    const setB = new Set(tb);
    let overlap = 0;
    for (const t of setA) if (setB.has(t)) overlap++;
    if (overlap >= 2) {
      const maxSize = Math.max(setA.size, setB.size);
      const minSize = Math.min(setA.size, setB.size);
      if (overlap === maxSize) return 92; // todos los tokens del mayor matchean
      if (overlap === minSize) return 85; // el menor es subset estricto del mayor
      // Parcial 2-de-3 según spec: 'A B C' vs 'A B D' → overlap=2, max=min=3.
      if (overlap * 3 >= maxSize * 2) return 78;
    }
  }

  // Sustring fuzzy: Levenshtein del último apellido (con orden original).
  // 23-may-2026 — Bajado threshold sim 0.85 → 0.75 para cubrir variantes árabes
  // donde R1+R2+R3 dejan resto del nombre con typo aún (e.g. "hashesh" vs
  // "hashish" sim=0.857 — match; previo a R2 era "hasheesh" vs "hashish" sim=0.75).
  if (la && lb) {
    const dist = levenshtein(la, lb);
    const maxLen = Math.max(la.length, lb.length);
    if (maxLen > 0) {
      const sim = 1 - dist / maxLen;
      if (sim >= 0.75) return Math.round(60 + sim * 20);
    }
  }

  return 0;
}

// Empareja una lista de candidatos (e.g. nombres XI) contra un roster grande.
// Devuelve { matches: [{ candidate, match, score }], unmatched: [candidates...] }.
// 23-may-2026 — minScore por defecto bajado 65 → 60 tras añadir normalizaciones
// árabes en rawTokens (R1+R2+R3). Filtra ruido pero permite que casos como
// "Mohammad Abu Taha ↔ Mohannad Abu Taha" (token-set overlap 2/3 → score 78)
// y casos Levenshtein de apellidos transliterados scoren ≥60.
export function matchAgainstRoster(candidates, roster, { minScore = 60 } = {}) {
  const matches = [];
  const unmatched = [];
  const usedIdx = new Set();

  for (const cand of candidates) {
    let bestIdx = -1;
    let bestScore = 0;
    for (let i = 0; i < roster.length; i++) {
      if (usedIdx.has(i)) continue;
      const player = roster[i];
      const playerName = typeof player === 'string' ? player : player?.nombre;
      if (!playerName) continue;
      const sc = scorePair(cand, playerName);
      if (sc > bestScore) {
        bestScore = sc;
        bestIdx = i;
      }
    }
    if (bestIdx >= 0 && bestScore >= minScore) {
      usedIdx.add(bestIdx);
      matches.push({ candidate: cand, match: roster[bestIdx], matchIdx: bestIdx, score: bestScore });
    } else {
      unmatched.push(cand);
    }
  }
  return { matches, unmatched };
}

export { scorePair, levenshtein };
