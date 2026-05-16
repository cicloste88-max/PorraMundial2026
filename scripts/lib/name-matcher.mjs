// Fuzzy matching de nombres: normalización + Levenshtein + scoring por apellido.
// Usado para emparejar nombres del XI titular (futbolfantasy /equipos/<slug>) con la
// lista completa scraped del cuerpo de la noticia, y también para enrich-tm.

export function normalize(s) {
  if (!s) return '';
  return String(s)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/['‘’`´]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function tokens(name) {
  return normalize(name).split(' ').filter(Boolean);
}

export function lastToken(name) {
  const t = tokens(name);
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
//  - igualdad exacta normalizada → 100
//  - último apellido coincide → 80 + bonus si más tokens encajan
//  - cualquier token contiene/contenido → 60 + Levenshtein adjust
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

  // Sustring fuzzy: Levenshtein del último apellido
  if (la && lb) {
    const dist = levenshtein(la, lb);
    const maxLen = Math.max(la.length, lb.length);
    if (maxLen > 0) {
      const sim = 1 - dist / maxLen;
      if (sim >= 0.85) return Math.round(60 + sim * 20);
    }
  }

  return 0;
}

// Empareja una lista de candidatos (e.g. nombres XI) contra un roster grande.
// Devuelve { matches: [{ candidate, match, score }], unmatched: [candidates...] }.
// minScore por defecto 65 (filtra ruido).
export function matchAgainstRoster(candidates, roster, { minScore = 65 } = {}) {
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
