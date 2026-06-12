// gen-ko-data.mjs — genera supabase/functions/_shared/ko-data.mjs extrayendo
// los literales BRACKET y ANNEX_C de public/js/ko.js y GRUPOS de
// public/js/data.js. La fuente única de verdad es el frontend: NO editar
// ko-data.mjs a mano; regenerar con
//   node scripts/gen-ko-data.mjs
// tras cualquier cambio en los literales fuente.
//
// Consumidores: _shared/ko-bracket.mjs (bracket dinámico compartido por las
// EFs backfill-ko-classifiers y send-porra-receipt).

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

function extract(src, decl, closer) {
  const start = src.indexOf(decl);
  if (start === -1) throw new Error(`No se encontró "${decl}"`);
  const end = src.indexOf(`\n${closer}`, start);
  if (end === -1) throw new Error(`Sin cierre "${closer}" para "${decl}"`);
  return src.slice(start, end + 1 + closer.length);
}

const ko = readFileSync('public/js/ko.js', 'utf8');
const data = readFileSync('public/js/data.js', 'utf8');

const bracket = extract(ko, 'const BRACKET = {', '};');
const annexC = extract(ko, 'const ANNEX_C = {', '};');
const grupos = extract(data, 'const GRUPOS = [', '];');

const out = `// ko-data.mjs — GENERADO por scripts/gen-ko-data.mjs. NO editar a mano.
// Copia 1:1 de BRACKET + ANNEX_C (public/js/ko.js) y GRUPOS (public/js/data.js).
// Regenerar tras cambios en los literales fuente.

export ${bracket}

export ${annexC}

export ${grupos}
`;

mkdirSync('supabase/functions/_shared', { recursive: true });
writeFileSync('supabase/functions/_shared/ko-data.mjs', out);
console.log(`_shared/ko-data.mjs generado (BRACKET ${bracket.length}ch, ANNEX_C ${annexC.length}ch, GRUPOS ${grupos.length}ch)`);
