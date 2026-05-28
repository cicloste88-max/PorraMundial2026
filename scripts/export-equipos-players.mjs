// Sprint Combos & Awards F3 — exporta EQUIPOS[].players (iso3 → [{key,name}])
// desde public/js/data.js a public/data/equipos-players.json, consumido por
// la EF porra-ia-compute (action update_ia_scorers) para resolver keys
// históricas vía playerToShortKey en TS, sin duplicar el array manualmente.
//
// Se ejecuta automáticamente en `npm run prebuild` (antes de `vite build`).
// Idempotente: si data.js no cambia, el JSON output tampoco.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

const DATA_JS = 'public/js/data.js';
const TARGET = 'public/data/equipos-players.json';

const src = readFileSync(DATA_JS, 'utf8');

// Buscar el bloque "const EQUIPOS = [ ... ];" tolerando los espacios/saltos
// reales del fichero. El array está bracket-balanced y termina con "\n];" en
// data.js. Hago un parse manual contando brackets para no depender de regex
// frágiles con literales multilínea anidados.
const startIdx = src.indexOf('const EQUIPOS =');
if (startIdx < 0) throw new Error('No se encontró "const EQUIPOS =" en ' + DATA_JS);
const arrStart = src.indexOf('[', startIdx);
if (arrStart < 0) throw new Error('No se encontró "[" tras "const EQUIPOS ="');

let depth = 0;
let arrEnd = -1;
let inString = false;
let stringChar = '';
for (let i = arrStart; i < src.length; i++) {
  const ch = src[i];
  const prev = i > 0 ? src[i - 1] : '';
  if (inString) {
    if (ch === stringChar && prev !== '\\') {
      inString = false;
    }
    continue;
  }
  if (ch === '"' || ch === "'" || ch === '`') {
    inString = true;
    stringChar = ch;
    continue;
  }
  if (ch === '[') depth++;
  else if (ch === ']') {
    depth--;
    if (depth === 0) { arrEnd = i; break; }
  }
}
if (arrEnd < 0) throw new Error('No se encontró cierre "]" balanceado del array EQUIPOS');

const literal = src.slice(arrStart, arrEnd + 1);

// Evaluar como expresión JS. El array solo contiene primitivos + objetos
// literales; no hay funciones ni referencias a globals.
const EQUIPOS = Function('return ' + literal)();

const out = {};
for (const e of EQUIPOS) {
  if (!e || !e.flag || !Array.isArray(e.players)) continue;
  out[e.flag] = e.players.map((p) => ({ key: p.key, name: p.name }));
}

mkdirSync(dirname(TARGET), { recursive: true });
writeFileSync(TARGET, JSON.stringify(out, null, 2) + '\n');

const totalPlayers = Object.values(out).reduce((s, arr) => s + arr.length, 0);
console.log(
  `[export-equipos-players] ${Object.keys(out).length} países, ` +
  `${totalPlayers} jugadores → ${TARGET}`,
);
