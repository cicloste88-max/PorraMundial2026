#!/usr/bin/env node
// gen-annex-c.mjs — Genera el objeto ANNEX_C (495 entradas) leyendo el
// artículo "2026 FIFA World Cup knockout stage" de Wikipedia.
//
// Uso: node scripts/gen-annex-c.mjs
// Salida: scripts/ANNEX_C_output.js  (bloque listo para pegar en ko.js)
//
// Si la red bloquea wikipedia.org, descargar el wikitext a mano:
//   curl -L 'https://en.wikipedia.org/w/index.php?title=2026_FIFA_World_Cup_knockout_stage&action=raw' > /tmp/wiki.txt
// y ejecutar:
//   ANNEX_C_INPUT=/tmp/wiki.txt node scripts/gen-annex-c.mjs

import { readFileSync, writeFileSync } from 'node:fs';

// Orden fijo de columnas del Anexo C → slots T_ en BRACKET.r32
const COL_TO_SLOT = [
  'T_CEFHI', // 1A vs
  'T_EFGIJ', // 1B vs
  'T_BEFIJ', // 1D vs
  'T_ABCDF', // 1E vs
  'T_AEHIJ', // 1G vs
  'T_CDFGH', // 1I vs
  'T_DEIJL', // 1K vs
  'T_EHIJK', // 1L vs
];

const CONSTRAINTS = {
  T_CEFHI: new Set(['C', 'E', 'F', 'H', 'I']),
  T_EFGIJ: new Set(['E', 'F', 'G', 'I', 'J']),
  T_BEFIJ: new Set(['B', 'E', 'F', 'I', 'J']),
  T_ABCDF: new Set(['A', 'B', 'C', 'D', 'F']),
  T_AEHIJ: new Set(['A', 'E', 'H', 'I', 'J']),
  T_CDFGH: new Set(['C', 'D', 'F', 'G', 'H']),
  T_DEIJL: new Set(['D', 'E', 'I', 'J', 'L']),
  T_EHIJK: new Set(['E', 'H', 'I', 'J', 'K']),
};

const WIKI_URL =
  'https://en.wikipedia.org/w/index.php?title=2026_FIFA_World_Cup_knockout_stage&action=raw';

async function loadSource() {
  if (process.env.ANNEX_C_INPUT) {
    return readFileSync(process.env.ANNEX_C_INPUT, 'utf8');
  }
  const res = await fetch(WIKI_URL, {
    headers: { 'user-agent': 'PorraMundial2026/1.0 (gen-annex-c.mjs)' },
  });
  if (!res.ok) throw new Error(`Wikipedia ${res.status}`);
  return await res.text();
}

// Una fila Anexo C en wikitext típicamente:
//   | 1 || E,F,G,H,I,J,K,L || 3E || 3J || 3I || 3F || 3H || 3G || 3L || 3K
// Tolerante: separadores ",", ";", espacios, y "vs"/"v" entre grupos.
function parseRows(raw) {
  const rows = [];
  const seen = new Set();
  // Bloque clave: grupos qualifiers (8 letras A-L separadas) + 8 asignaciones 3X
  const re =
    /([A-L])[\s,;|]+([A-L])[\s,;|]+([A-L])[\s,;|]+([A-L])[\s,;|]+([A-L])[\s,;|]+([A-L])[\s,;|]+([A-L])[\s,;|]+([A-L])[\s\S]{0,40}?3([A-L])[\s\S]{0,20}?3([A-L])[\s\S]{0,20}?3([A-L])[\s\S]{0,20}?3([A-L])[\s\S]{0,20}?3([A-L])[\s\S]{0,20}?3([A-L])[\s\S]{0,20}?3([A-L])[\s\S]{0,20}?3([A-L])/g;
  let m;
  while ((m = re.exec(raw)) !== null) {
    const qualifiers = m.slice(1, 9);
    const uniq = new Set(qualifiers);
    if (uniq.size !== 8) continue; // los 8 deben ser distintos
    const key = [...qualifiers].sort().join('');
    if (seen.has(key)) continue;
    const assignments = m.slice(9, 17);
    const slotMap = {};
    let valid = true;
    COL_TO_SLOT.forEach((slot, i) => {
      slotMap[slot] = assignments[i];
      if (!CONSTRAINTS[slot].has(assignments[i])) valid = false;
      if (!uniq.has(assignments[i])) valid = false;
    });
    if (!valid) continue;
    seen.add(key);
    rows.push({ key, slotMap });
  }
  return rows;
}

function emit(rows) {
  const lines = [
    '// ANNEX_C — Tabla FIFA 2026 Reglamento Anexo C (495 combinaciones)',
    '// Clave: 8 letras de grupos clasificados terceros, ordenadas A-Z',
    '// Valor: qué grupo va a cada slot T_ del R32',
    '// Fuente: https://en.wikipedia.org/wiki/2026_FIFA_World_Cup_knockout_stage',
    `// Generado: ${new Date().toISOString().slice(0, 10)}`,
    'const ANNEX_C = {',
  ];
  for (const { key, slotMap } of rows) {
    const vals = COL_TO_SLOT.map((s) => `${s}:'${slotMap[s]}'`).join(',');
    lines.push(`  "${key}":{${vals}},`);
  }
  lines.push('};');
  return lines.join('\n') + '\n';
}

(async () => {
  const raw = await loadSource();
  const rows = parseRows(raw);
  console.log(`Parsed ${rows.length} rows (expected 495)`);
  if (rows.length !== 495) {
    console.error('ERROR: número de filas inesperado. Revisar regex o fuente.');
    process.exit(1);
  }
  writeFileSync('scripts/ANNEX_C_output.js', emit(rows), 'utf8');
  console.log('OK → scripts/ANNEX_C_output.js');
  rows.slice(0, 3).forEach((r) => console.log(' ', r.key, '→', JSON.stringify(r.slotMap)));
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
