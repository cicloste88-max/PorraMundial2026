# Brief v3: TM World Cup enrich completo

> Claude.ai → Claude Code, 20-may-2026. Sprint medio. Cierra el enrich-tm de verdad,
> la deuda técnica de parseKaderTable y el schema canónico hasta la pizarra.

---

## Orden de ejecución (commits en este orden, mergeable cada uno por separado para reducir riesgo)

| # | Commit | Cierra |
|---|---|---|
| 1 | `feat(scripts): tm-parse-utils.mjs helpers + tests` | Pieza 0 |
| 2 | `feat(scripts): tm-worldcup-market-values.mjs scraper + fixture Nuno` | Pieza A |
| 3 | `fix(scripts): refactor parseKaderTable robusto + fixture Joan García` | Pieza B |
| 4 | `feat(scripts): enrichRosterWithTm fill-missing ID-first` | Pieza C-merge |
| 5 | `fix(edge): get-squad expone posicion + posicion_tm canónico (v7)` | Pieza D |
| 6 | `feat(scripts): --mode=enrich-tm-mw orquesta A+B + report multicampo` | Pieza C-orquestador |
| 7 | `chore(workflows): enrich-tm-mw en sync-squads.yml choices` | Pieza E |

PR único contra main con los 7 commits, NO squash en el merge final (mantener historial limpio facilita rollback granular si algo falla).

---

## Pieza 0 — `scripts/lib/tm-parse-utils.mjs` (NUEVO, helpers compartidos)

A y B comparten ~80% del parseo. Centralizamos para no duplicar.

```js
// scripts/lib/tm-parse-utils.mjs

export function stripTags(s) {
  return String(s || '').replace(/<[^>]+>/g, '');
}

/** Limpia HTML: tags + espacios + saltos + entities básicas. Idempotente. */
export function decodeClean(s) {
  return stripTags(s)
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

/** "https://img.../portrait/medium/616341-1749417164.jpg?lm=1" → ".../616341-1749417164.jpg" */
export function stripTmImageQuery(url) {
  return String(url || '').replace(/\?.*$/, '');
}

/**
 * Extrae { tm_player_id, nombre } del enlace al perfil.
 * Soporta multilinea (Joan García en kader viene con saltos+espacios extra).
 */
export function extractProfileLink(html) {
  const m = html.match(/<a[^>]+href="\/[^"]+\/profil\/spieler\/(\d+)"[^>]*>([\s\S]+?)<\/a>/);
  if (!m) return null;
  return {
    tm_player_id: parseInt(m[1], 10),
    nombre: decodeClean(m[2]),
  };
}

/**
 * Extrae { club, club_id, club_logo_url } del enlace a equipo (skip=1: el segundo
 * <a title> de la fila, el primero suele ser la selección).
 */
export function extractClubLink(html, { skip = 1 } = {}) {
  const matches = [...html.matchAll(/<a\s+title="([^"]+)"\s+href="\/[^"]+\/startseite\/verein\/(\d+)/g)];
  if (matches.length <= skip) return null;
  const m = matches[skip];
  const club_id = parseInt(m[2], 10);
  return {
    club: decodeClean(m[1]),
    club_id,
    club_logo_url: `https://tmssl.akamaized.net/images/wappen/verysmall/${club_id}.png`,
  };
}

/**
 * "75,00 mill. €" → 75000000  ;  "800 mil €" → 800000  ;  "1,5 mill. €" → 1500000
 * Formato europeo .es (coma decimal, punto miles). Nunca usar con .com formato inglés.
 */
export function parseValorEs(numStr, unit) {
  if (numStr == null) return null;
  const clean = String(numStr).trim();
  const n = parseFloat(clean.replace(/\./g, '').replace(',', '.'));
  if (isNaN(n)) return null;
  const u = (unit || '').toLowerCase();
  if (u.startsWith('mill')) return Math.round(n * 1_000_000);
  if (u.startsWith('mil'))  return Math.round(n * 1_000);
  return Math.round(n);
}

/**
 * Mapeo posición específica TM → bucket Porra. Tabla castellano + inglés legacy.
 * TM .es y .com pueden coexistir según endpoint.
 */
const POSITION_TM_TO_BUCKET = {
  // Castellano (.es)
  'Portero': 'Portero',
  'Defensa central': 'Defensa',
  'Lateral derecho': 'Defensa',
  'Lateral izquierdo': 'Defensa',
  'Líbero': 'Defensa',
  'Pivote': 'Centrocampista',
  'Mediocentro': 'Centrocampista',
  'Mediocentro ofensivo': 'Centrocampista',
  'Mediocentro defensivo': 'Centrocampista',
  'Interior derecho': 'Centrocampista',
  'Interior izquierdo': 'Centrocampista',
  'Mediapunta': 'Centrocampista',
  'Extremo derecho': 'Delantero',
  'Extremo izquierdo': 'Delantero',
  'Segundo delantero': 'Delantero',
  'Delantero centro': 'Delantero',
  // Inglés (.com legacy, mantener por compatibilidad)
  'Goalkeeper': 'Portero',
  'Centre-Back': 'Defensa', 'Left-Back': 'Defensa', 'Right-Back': 'Defensa',
  'Defensive Midfield': 'Centrocampista', 'Central Midfield': 'Centrocampista',
  'Attacking Midfield': 'Centrocampista',
  'Left Midfield': 'Centrocampista', 'Right Midfield': 'Centrocampista',
  'Left Winger': 'Delantero', 'Right Winger': 'Delantero',
  'Second Striker': 'Delantero', 'Centre-Forward': 'Delantero',
};

export function positionToBucket(positionTm) {
  if (!positionTm) return null;
  return POSITION_TM_TO_BUCKET[positionTm] || null;
}

/** Concurrencia limitada: ejecuta fn(item) en paralelo de max N a la vez. */
export async function mapConcurrent(items, fn, { concurrency = 4 } = {}) {
  const results = [];
  for (let i = 0; i < items.length; i += concurrency) {
    const batch = items.slice(i, i + concurrency);
    const batchResults = await Promise.all(batch.map(fn));
    results.push(...batchResults);
  }
  return results;
}

/** Sleep helper para throttling */
export const sleep = (ms) => new Promise(r => setTimeout(r, ms));
```

### Tests `scripts/lib/__tests__/tm-parse-utils.test.mjs`

```js
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import {
  decodeClean, stripTmImageQuery, extractProfileLink, extractClubLink,
  parseValorEs, positionToBucket,
} from '../tm-parse-utils.mjs';

test('decodeClean limpia tags + entities + multilinea', () => {
  assert.equal(decodeClean('  <a>Joan&nbsp;García</a>\n  '), 'Joan García');
  assert.equal(decodeClean('<a>Mike\n            Maignan</a>'), 'Mike Maignan');
});

test('stripTmImageQuery quita ?lm=...', () => {
  assert.equal(
    stripTmImageQuery('https://img.a.transfermarkt.technology/portrait/medium/123-456.jpg?lm=1'),
    'https://img.a.transfermarkt.technology/portrait/medium/123-456.jpg'
  );
});

test('extractProfileLink soporta multilinea', () => {
  const html = `<a href="/joan-garcia/profil/spieler/561613">
                Joan García            </a>`;
  const r = extractProfileLink(html);
  assert.equal(r.tm_player_id, 561613);
  assert.equal(r.nombre, 'Joan García');
});

test('extractClubLink skip=1 devuelve el segundo (club, no nación)', () => {
  const html = `
    <a title="España" href="/spanien/startseite/verein/3375">...</a>
    <a title="FC Barcelona" href="/fc-barcelona/startseite/verein/131">...</a>
  `;
  const r = extractClubLink(html, { skip: 1 });
  assert.equal(r.club, 'FC Barcelona');
  assert.equal(r.club_id, 131);
  assert.equal(r.club_logo_url, 'https://tmssl.akamaized.net/images/wappen/verysmall/131.png');
});

test('parseValorEs formatos', () => {
  assert.equal(parseValorEs('75,00', 'mill.'), 75_000_000);
  assert.equal(parseValorEs('1,5', 'mill.'), 1_500_000);
  assert.equal(parseValorEs('150,00', 'mill.'), 150_000_000);
  assert.equal(parseValorEs('800', 'mil'), 800_000);
  assert.equal(parseValorEs('500', null), 500);
  assert.equal(parseValorEs(null, 'mill.'), null);
  assert.equal(parseValorEs('foo', 'mill.'), null);
});

test('positionToBucket castellano + inglés', () => {
  assert.equal(positionToBucket('Lateral derecho'), 'Defensa');
  assert.equal(positionToBucket('Pivote'), 'Centrocampista');
  assert.equal(positionToBucket('Extremo izquierdo'), 'Delantero');
  assert.equal(positionToBucket('Goalkeeper'), 'Portero');  // legacy .com
  assert.equal(positionToBucket(null), null);
  assert.equal(positionToBucket('Inventada'), null);
});
```

---

## Pieza A — `scripts/lib/tm-worldcup-market-values.mjs` (NUEVO)

Scraper página masiva FIWC. 40 páginas × 25 = 1000 jugadores. Concurrencia 4, cache 6h, throttle 200ms entre chunks.

### Estructura del archivo

```js
import fs from 'node:fs/promises';
import path from 'node:path';
import {
  decodeClean, stripTmImageQuery, extractProfileLink, extractClubLink,
  parseValorEs, mapConcurrent, sleep,
} from './tm-parse-utils.mjs';
import tmNationMap from './tm-nation-map.json' with { type: 'json' };

const BASE_URL = 'https://www.transfermarkt.es/weltmeisterschaft/marktwertaenderungen/pokalwettbewerb/FIWC/saison_id/2025/page';
const TOTAL_PAGES = 40;
const CACHE_DIR = 'cache/tm-mw';
const TTL_MS = 6 * 60 * 60 * 1000;
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/124.0 Safari/537.36';

// Regex con lookahead positivo al siguiente <tr class="odd|even"> o </tbody>.
// Resuelve el bug de no-greedy que se trunca en </tr> interior de inline-table anidada.
const ROW_RE = /<tr class="(?:odd|even)">([\s\S]*?)(?=<tr class="(?:odd|even)"|<\/tbody>)/g;
```

### `parseRow` (validado contra fixture Nuno Mendes)

```js
export function parseRow(rowHtml) {
  const profile = extractProfileLink(rowHtml);
  if (!profile) return null;

  // Foto: data-src (NO src — eso es el placeholder gif lazy)
  const photoMatch = rowHtml.match(/data-src="(https:\/\/img\.a\.transfermarkt\.technology\/portrait\/medium\/\d+-\d+\.jpg[^"]*)"/);
  const photo_url_tm = photoMatch ? stripTmImageQuery(photoMatch[1]) : null;

  // Posición: segunda fila de la inline-table
  const posMatch = rowHtml.match(/<tr>\s*<td>\s*([^<]+?)\s*<\/td>\s*<\/tr>\s*<\/table>/);
  const position_tm = posMatch ? decodeClean(posMatch[1]) : null;

  // Selección: PRIMER <a title="X" href="/X/startseite/verein/Y/...">
  const nationMatch = rowHtml.match(/<a\s+title="([^"]+)"\s+href="\/([^/]+)\/startseite\/verein\/(\d+)[^"]*"/);
  if (!nationMatch) return null;
  const nation_name = decodeClean(nationMatch[1]);
  const verein_id = parseInt(nationMatch[3], 10);

  // Edad: primer <td class="zentriert">N</td> con 2 dígitos entre 15-50
  // (defensa contra el rank al principio: 3-4 dígitos)
  const ageMatches = [...rowHtml.matchAll(/<td class="zentriert">(\d{2})<\/td>/g)];
  let age = null;
  for (const m of ageMatches) {
    const n = parseInt(m[1], 10);
    if (n >= 15 && n <= 50) { age = n; break; }
  }

  // Club: SEGUNDO <a title> (skip:1 — el primero es la nación)
  const clubInfo = extractClubLink(rowHtml, { skip: 1 });

  // Valor
  const valorMatch = rowHtml.match(/<td class="rechts hauptlink">\s*([0-9.,]+)\s*(mill\.|mil)?\s*€/i);
  const value_eur = valorMatch ? parseValorEs(valorMatch[1], valorMatch[2]) : null;

  return {
    tm_player_id: profile.tm_player_id,
    name: profile.nombre,
    position_tm,
    age,
    nation_name,
    iso3: tmNationMap[nation_name] || null,
    verein_id,
    club: clubInfo?.club ?? null,
    club_id: clubInfo?.club_id ?? null,
    club_logo_url: clubInfo?.club_logo_url ?? null,
    value_eur,
    photo_url_tm,
  };
}
```

### `fetchAllPages` con concurrencia 4 + validación de conflictos

```js
export async function fetchAllPages({ verbose = false, useCache = true } = {}) {
  const byTmId = new Map();
  const unmappedNations = new Set();
  const duplicates = [];
  const vereinIdConflicts = new Map();  // iso3 → Map<verein_id, count>

  const pageNums = Array.from({ length: TOTAL_PAGES }, (_, i) => i + 1);

  await mapConcurrent(pageNums, async (pageNum) => {
    const html = await fetchPage(pageNum, { verbose, useCache });
    const rows = [...html.matchAll(ROW_RE)];
    if (verbose) console.log(`  page ${pageNum}: ${rows.length} rows`);

    for (const r of rows) {
      const player = parseRow(r[1]);
      if (!player) continue;

      // Punto 5: NO descartar si falla iso3. Guardar igual para ID-first lookup.
      if (!player.iso3) unmappedNations.add(player.nation_name);

      // Punto 6: validar duplicados tm_player_id
      if (byTmId.has(player.tm_player_id)) {
        const existing = byTmId.get(player.tm_player_id);
        if (existing.value_eur !== player.value_eur || existing.club_id !== player.club_id) {
          duplicates.push({
            tm_player_id: player.tm_player_id,
            name: player.name,
            first: { value_eur: existing.value_eur, club_id: existing.club_id },
            dup:   { value_eur: player.value_eur,   club_id: player.club_id   },
          });
        }
        continue;
      }
      byTmId.set(player.tm_player_id, player);

      // Punto 6: contar conflictos verein_id por iso3 (solo si iso3 mapeado)
      if (player.iso3 && player.verein_id) {
        if (!vereinIdConflicts.has(player.iso3)) vereinIdConflicts.set(player.iso3, new Map());
        const counts = vereinIdConflicts.get(player.iso3);
        counts.set(player.verein_id, (counts.get(player.verein_id) || 0) + 1);
      }
    }
    await sleep(200);
  }, { concurrency: 4 });

  // Resolver byNation: ganador es el verein_id más frecuente. Warning si hay conflict.
  const byNation = new Map();
  for (const [iso3, counts] of vereinIdConflicts) {
    if (counts.size > 1) {
      console.warn(
        `WARN: ${iso3} con múltiples verein_id TM: ${[...counts].map(([id, c]) => `${id}(×${c})`).join(', ')}`
      );
    }
    const winner = [...counts].sort((a, b) => b[1] - a[1])[0][0];
    byNation.set(iso3, winner);
  }

  // Logs finales
  if (verbose) {
    console.log(`  byTmId: ${byTmId.size}, byNation: ${byNation.size}, duplicates: ${duplicates.length}`);
  }
  if (unmappedNations.size > 0) {
    console.warn(`WARN: ${unmappedNations.size} selecciones sin mapping ISO3:`);
    for (const n of unmappedNations) console.warn(`  - "${n}"`);
  }

  return { byTmId, byNation, unmappedNations, duplicates };
}

async function fetchPage(pageNum, { verbose, useCache }) {
  const cacheFp = path.join(CACHE_DIR, `page-${pageNum}.html`);
  if (useCache) {
    try {
      const stat = await fs.stat(cacheFp);
      if (Date.now() - stat.mtimeMs < TTL_MS) {
        if (verbose) console.log(`  cache hit page ${pageNum}`);
        return fs.readFile(cacheFp, 'utf8');
      }
    } catch {}
  }
  const url = `${BASE_URL}/${pageNum}`;
  if (verbose) console.log(`  GET page ${pageNum}`);
  const r = await fetch(url, {
    headers: { 'User-Agent': UA, 'Accept-Language': 'es-ES,es;q=0.9,en;q=0.8' },
  });
  if (!r.ok) throw new Error(`page ${pageNum} HTTP ${r.status}`);
  const html = await r.text();
  try {
    await fs.mkdir(CACHE_DIR, { recursive: true });
    await fs.writeFile(cacheFp, html);
  } catch {}
  return html;
}
```

### Mapping `scripts/lib/tm-nation-map.json` (NUEVO)

48 selecciones + alias por si TM cambia nombre. Si Code encuentra `country-map.json` previo en el repo, extender en lugar de duplicar.

```json
{
  "Alemania": "GER", "Arabia Saudí": "KSA", "Argelia": "ALG",
  "Argentina": "ARG", "Australia": "AUS", "Austria": "AUT",
  "Bélgica": "BEL", "Bosnia-Herzegovina": "BIH", "Brasil": "BRA",
  "Cabo Verde": "CPV", "Canadá": "CAN", "Catar": "QAT",
  "Chequia": "CZE", "Colombia": "COL", "Corea del Sur": "KOR",
  "Costa de Marfil": "CIV", "Croacia": "CRO", "Curazao": "CUW",
  "Ecuador": "ECU", "Egipto": "EGY", "Escocia": "SCO",
  "España": "ESP", "Estados Unidos": "USA", "Francia": "FRA",
  "Ghana": "GHA", "Haití": "HAI", "Inglaterra": "ENG",
  "Irak": "IRQ", "Irán": "IRN", "Japón": "JPN",
  "Jordania": "JOR", "Marruecos": "MAR", "México": "MEX",
  "Noruega": "NOR", "Nueva Zelanda": "NZL", "Países Bajos": "NED",
  "Panamá": "PAN", "Paraguay": "PAR", "Portugal": "POR",
  "República Democrática del Congo": "COD", "Senegal": "SEN",
  "Sudáfrica": "RSA", "Suecia": "SWE", "Suiza": "SUI",
  "Túnez": "TUN", "Turquía": "TUR", "Uruguay": "URU",
  "Uzbekistán": "UZB"
}
```

### Tests `scripts/lib/__tests__/tm-worldcup-market-values.test.mjs`

```js
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseRow } from '../tm-worldcup-market-values.mjs';

// Fixture A: Nuno Mendes (page 40, marktwertaenderungen) — HTML real capturado 20-may
const NUNO_FIXTURE = `<tr class="odd">
<td class="zentriert">976</td><td>    <table class="inline-table">
        <tr>
            <td rowspan="2">
                <img src="data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==" data-src="https://img.a.transfermarkt.technology/portrait/medium/616341-1749417164.jpg?lm=1" title="Nuno Mendes" alt="Nuno Mendes" class="bilderrahmen-fixed lazy lazy" />            </td>
            <td class="hauptlink">
                <a title="Nuno Mendes" href="/nuno-mendes/profil/spieler/616341">Nuno Mendes</a>                            </td>
        </tr>
        <tr>
            <td>Lateral izquierdo</td>
        </tr>
    </table>
</td><td class="zentriert"><a title="Portugal" href="/portugal/startseite/verein/3300/saison_id/2025"><img src="https://tmssl.akamaized.net//images/flagge/verysmall/136.png" title="Portugal" alt="Portugal" class="flaggenrahmen" /></a></td><td class="zentriert">23</td><td class="zentriert"><a title="París Saint-Germain FC" href="/fc-paris-saint-germain/startseite/verein/583/saison_id/2025"><img src="https://tmssl.akamaized.net//images/wappen/verysmall/583.png" title="París Saint-Germain FC" alt="París Saint-Germain FC" class="" /></a></td><td class="rechts hauptlink">75,00 mill. €&nbsp;<span title="Valor de mercado previo: 75,00 mill. €; Valor máximo de carrera: 75,00 mill. €" class="icons_sprite grey-block-ten">&nbsp;</span></td>`;

test('parseRow extrae todos los campos de Nuno Mendes', () => {
  const p = parseRow(NUNO_FIXTURE);
  assert.equal(p.tm_player_id, 616341);
  assert.equal(p.name, 'Nuno Mendes');
  assert.equal(p.position_tm, 'Lateral izquierdo');
  assert.equal(p.nation_name, 'Portugal');
  assert.equal(p.iso3, 'POR');
  assert.equal(p.verein_id, 3300);
  assert.equal(p.age, 23);
  assert.equal(p.club, 'París Saint-Germain FC');
  assert.equal(p.club_id, 583);
  assert.equal(p.club_logo_url, 'https://tmssl.akamaized.net/images/wappen/verysmall/583.png');
  assert.equal(p.value_eur, 75000000);
  assert.equal(p.photo_url_tm, 'https://img.a.transfermarkt.technology/portrait/medium/616341-1749417164.jpg');
});

test('parseRow con iso3 desconocido devuelve player sin descartar', () => {
  // Modificamos el fixture cambiando "Portugal" por "Atlántida"
  const fake = NUNO_FIXTURE.replace('title="Portugal"', 'title="Atlántida"');
  const p = parseRow(fake);
  assert.ok(p, 'player no debe ser null');
  assert.equal(p.iso3, null);
  assert.equal(p.nation_name, 'Atlántida');
  assert.equal(p.tm_player_id, 616341);  // sigue siendo util para ID-first
});
```

---

## Pieza B — `scripts/lib/tm-scraper.mjs` (REFACTOR completo de `parseKaderTable`)

Bugs documentados (lista de Code + análisis Claude.ai):

1. `rowRe` con `[\s\S]*?` se trunca en `</tr>` interior de inline-table
2. Foto en `data-src=`, no `src=`
3. DOB regex busca formato inglés `Month D, YYYY`, real es `DD/MM/YYYY (NN)`
4. Valor regex con mojibake `â‚¬`, real es `€`
5. `parseValor('40.00','m')` devuelve 4_000_000_000 (el `.replace(/\./g,'')` come decimal inglés). Y de hecho TM .es da `40,00 mill. €`, no formato inglés.
6. Posición regex no tolera saltos de línea en inline-table

### Estrategia: el mismo patrón que pieza A

Usar el `ROW_RE` con lookahead positivo + helpers de pieza 0 (`extractProfileLink`, `extractClubLink`, `parseValorEs`, `positionToBucket`, `stripTmImageQuery`, `decodeClean`).

```js
// scripts/lib/tm-scraper.mjs (refactor)

import {
  decodeClean, stripTmImageQuery, extractProfileLink, extractClubLink,
  parseValorEs, positionToBucket,
} from './tm-parse-utils.mjs';

const ROW_RE = /<tr class="(?:odd|even)">([\s\S]*?)(?=<tr class="(?:odd|even)"|<\/tbody>)/g;

export function parseKaderTable(html) {
  const players = [];
  const rows = [...html.matchAll(ROW_RE)];

  for (const r of rows) {
    const rowHtml = r[1];

    // tm_player_id + nombre (soporta multilinea)
    const profile = extractProfileLink(rowHtml);
    if (!profile) continue;

    // Dorsal: <div class=rn_nummer>18</div>
    const dorsalMatch = rowHtml.match(/<div\s+class=rn_nummer[^>]*>(\d+)<\/div>/);
    const dorsal = dorsalMatch ? parseInt(dorsalMatch[1], 10) : null;

    // Foto desde data-src
    const photoMatch = rowHtml.match(/data-src="(https:\/\/img\.a\.transfermarkt\.technology\/portrait\/medium\/\d+-\d+\.jpg[^"]*)"/);
    const foto_url_tm = photoMatch ? stripTmImageQuery(photoMatch[1]) : null;

    // Posición: segunda fila de la inline-table
    const posMatch = rowHtml.match(/<tr>\s*<td>\s*([^<]+?)\s*<\/td>\s*<\/tr>\s*<\/table>/);
    const posicion_tm = posMatch ? decodeClean(posMatch[1]) : null;
    const posicion = positionToBucket(posicion_tm);

    // DOB + edad: formato español "04/05/2001 (25)"
    const dobMatch = rowHtml.match(/<td class="zentriert">(\d{2}\/\d{2}\/\d{4})\s*\((\d{1,2})\)<\/td>/);
    const dob = dobMatch ? dobMatch[1] : null;
    const edad = dobMatch ? parseInt(dobMatch[2], 10) : null;

    // Club: PRIMER <a title="X" href="/X/startseite/verein/Y"> después de DOB.
    // En kader hay un solo <a title> tipo club (no aparece nación).
    const clubInfo = extractClubLink(rowHtml, { skip: 0 });

    // Valor: <td class="rechts hauptlink"><a href="...marktwertverlauf...">40,00 mill. €</a>
    const valorMatch = rowHtml.match(/<td class="rechts hauptlink">[^>]*>?\s*(?:<a[^>]*>)?\s*([0-9.,]+)\s*(mill\.|mil)?\s*€/i);
    const valor_eur = valorMatch ? parseValorEs(valorMatch[1], valorMatch[2]) : null;

    players.push({
      tm_player_id: profile.tm_player_id,
      nombre: profile.nombre,
      dorsal,
      foto_url_tm,
      posicion_tm,
      posicion,
      dob,
      edad,
      club: clubInfo?.club ?? null,
      club_id: clubInfo?.club_id ?? null,
      club_logo_url: clubInfo?.club_logo_url ?? null,
      valor_eur,
    });
  }

  return players;
}
```

### Tests `scripts/lib/__tests__/tm-scraper.test.mjs`

Fixture Joan García capturado por Claude.ai 20-may del HTML real `/spanien/kader/verein/3375/plus/1`:

```js
import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseKaderTable } from '../tm-scraper.mjs';

// Fixture B: Joan García (España, portero, dorsal 18, 25 años, 40M €) — HTML real
const JOAN_FIXTURE = `<table class="items"><tbody>
<tr class="odd">
<td class="zentriert rueckennummer bg_Torwart" title="Portero"><div class=rn_nummer>18</div></td><td class="">
<table class="inline-table">
    <tr>
        <td rowspan="2">
            <img src="data:image/gif;base64,R0lGODlhAQABAIAAAMLCwgAAACH5BAAAAAAALAAAAAABAAEAAAICRAEAOw==" data-src="https://img.a.transfermarkt.technology/portrait/medium/561613-1747386081.jpg?lm=1" title="Joan García" alt="Joan García" class="bilderrahmen-fixed lazy lazy" />        </td>
        <td class="hauptlink">
            <a href="/joan-garcia/profil/spieler/561613">
                Joan García            </a>
        </td>
    </tr>
    <tr>
        <td>
            Portero        </td>
    </tr>
</table>
</td><td class="zentriert">04/05/2001 (25)</td><td class="zentriert"><a title="FC Barcelona" href="/fc-barcelona/startseite/verein/131"><img src="https://tmssl.akamaized.net//images/wappen/verysmall/131.png?lm=1406739548" title="FC Barcelona" alt="FC Barcelona" class="" /></a></td><td class="zentriert">1,94m</td><td class="zentriert">Derecho</td><td class="zentriert">1</td><td class="zentriert">-</td><td class="zentriert">31/03/2026</td><td class="rechts hauptlink"><a href="/joan-garcia/marktwertverlauf/spieler/561613">40,00 mill. €</a></td></tr>
</tbody></table>`;

test('parseKaderTable extrae Joan García (kader layout)', () => {
  const players = parseKaderTable(JOAN_FIXTURE);
  assert.equal(players.length, 1);
  const j = players[0];
  assert.equal(j.tm_player_id, 561613);
  assert.equal(j.nombre, 'Joan García');
  assert.equal(j.dorsal, 18);
  assert.equal(j.dob, '04/05/2001');
  assert.equal(j.edad, 25);
  assert.equal(j.posicion_tm, 'Portero');
  assert.equal(j.posicion, 'Portero');
  assert.equal(j.valor_eur, 40_000_000);
  assert.equal(j.club, 'FC Barcelona');
  assert.equal(j.club_id, 131);
  assert.equal(j.club_logo_url, 'https://tmssl.akamaized.net/images/wappen/verysmall/131.png');
  assert.equal(j.foto_url_tm, 'https://img.a.transfermarkt.technology/portrait/medium/561613-1747386081.jpg');
});
```

### Función `fetchTmKader` (mantener existente, ajustar URL si necesario)

La actual usa `.com/.../kader/verein/{id}/plus/1`. Cambiar a `.es` para consistencia con tm-nation-map.json en castellano:

```js
const TM_BASE = 'https://www.transfermarkt.es';
// ...
const url = `${TM_BASE}/${slug}/kader/verein/${tmId}/plus/1`;
```

Mantener cache 24h existente. Concurrencia per-país queda en el orquestador.

---

## Pieza C-merge — `enrichRosterWithTm` fill-missing ID-first

**Núcleo del cambio**: A y B aportan información DIFERENTE. No se excluyen, se complementan.

| Campo | Pieza A trae | Pieza B trae |
|---|---|---|
| `tm_player_id` | ✅ | ✅ |
| `valor_eur` | ✅ | ✅ |
| `edad` | ✅ | ✅ |
| `posicion_tm` | ✅ | ✅ |
| `posicion` (bucket) | ✅ | ✅ |
| `club` | ✅ | ✅ |
| `club_id` + `club_logo_url` | ✅ | ✅ |
| `foto_url_tm` | ✅ | ✅ |
| **`dorsal`** | ❌ NO disponible | ✅ |
| **`dob`** | ❌ NO disponible | ✅ |

Por tanto: incluso si A matchea 100% un país, **B sigue aportando dorsal+dob**.

```js
// scripts/lib/enrich-merge.mjs (NUEVO)

import { normalize as normalizeName } from './name-matcher.mjs';

const ENRICH_FIELDS = [
  'tm_player_id', 'valor_eur', 'edad', 'posicion_tm',
  'dorsal', 'dob', 'club', 'club_id', 'club_logo_url', 'foto_url_tm',
];

/**
 * Aplica enrich a un roster con datos de TM (de A o B).
 * Reglas:
 *  - ID-first: si player.tm_player_id existe, lookup por ID en tmByIdMap.
 *  - Fallback por nombre: solo si player no tiene tm_player_id Y tmPlayer.iso3 coincide con squad.iso3.
 *  - FILL-MISSING: solo escribe campos null/undefined del player. Nunca pisa valor existente.
 *  - PERSIST-BACK tm_player_id: si match fue por nombre, escribir tm_player_id en player para
 *    que la próxima ejecución sea ID-first directo.
 *
 * Devuelve { roster, stats } donde stats es un objeto con por-campo counts:
 *   { matched, with_tm_id, with_value, with_photo, with_dob, with_dorsal, with_club_logo }
 *
 * Tanto A como B usan esta misma función — diferencia es solo el contenido del Map.
 */
export function applyEnrich(roster, tmByIdMap, { iso3, sourceLabel }) {
  // Construir lookup secundario por nombre+iso3 desde tmByIdMap
  const tmByNameInNation = new Map();
  for (const tm of tmByIdMap.values()) {
    if (tm.iso3 === iso3 || tm.iso3 == null) {
      tmByNameInNation.set(normalizeName(tm.name || tm.nombre), tm);
    }
  }

  const stats = { matched: 0 };
  for (const f of ENRICH_FIELDS) stats[`with_${f}`] = 0;

  for (let i = 0; i < roster.length; i++) {
    const p = roster[i];
    let tm = null;
    let matchedByName = false;

    // ID-first
    if (p.tm_player_id) {
      tm = tmByIdMap.get(p.tm_player_id);
    }

    // Fallback por nombre+iso3
    if (!tm) {
      tm = tmByNameInNation.get(normalizeName(p.nombre));
      if (tm) matchedByName = true;
    }

    if (!tm) continue;
    stats.matched++;

    // Fill-missing: solo escribe campos null/undefined. Persist-back tm_player_id si match por nombre.
    const tmId = tm.tm_player_id;
    const newPlayer = { ...p };

    // tm_player_id: persist-back si match fue por nombre, mantener si ya existía
    if (newPlayer.tm_player_id == null && tmId != null) {
      newPlayer.tm_player_id = tmId;
    }

    // Resto de campos: solo si player no tiene valor
    const tmFields = {
      valor_eur:     tm.value_eur ?? tm.valor_eur,
      edad:          tm.age ?? tm.edad,
      posicion_tm:   tm.position_tm ?? tm.posicion_tm,
      dorsal:        tm.dorsal,
      dob:           tm.dob,
      club:          tm.club,
      club_id:       tm.club_id,
      club_logo_url: tm.club_logo_url,
      foto_url_tm:   tm.photo_url_tm ?? tm.foto_url_tm,
    };
    for (const [k, v] of Object.entries(tmFields)) {
      if (newPlayer[k] == null && v != null) newPlayer[k] = v;
    }

    roster[i] = newPlayer;
  }

  // Stats por campo después del enrich
  for (const p of roster) {
    if (p.tm_player_id != null) stats.with_tm_id++;
    if (p.valor_eur != null) stats.with_value_eur++;
    if (p.foto_url != null || p.foto_url_tm != null) stats.with_photo++;
    if (p.dob != null) stats.with_dob++;
    if (p.dorsal != null) stats.with_dorsal++;
    if (p.club_logo_url != null) stats.with_club_logo++;
    if (p.club != null) stats.with_club++;
    if (p.edad != null) stats.with_edad++;
    if (p.posicion_tm != null) stats.with_posicion_tm++;
  }

  return { roster, stats };
}
```

Tests `__tests__/enrich-merge.test.mjs`:

```js
test('applyEnrich fill-missing no pisa campos buenos', () => {
  const roster = [
    { nombre: 'Mike Maignan', tm_player_id: 182906, foto_url: 'https://...storage/...182906.jpg', edad: 30 },
  ];
  const tmMap = new Map([[182906, {
    tm_player_id: 182906, name: 'Mike Maignan',
    value_eur: 25000000, age: 31, dorsal: 16,
    photo_url_tm: 'https://img.../182906-new.jpg',
  }]]);
  const { roster: out, stats } = applyEnrich(roster, tmMap, { iso3: 'FRA', sourceLabel: 'A' });
  assert.equal(out[0].edad, 30);  // NO pisa el 30 con el 31 nuevo
  assert.equal(out[0].foto_url, 'https://...storage/...182906.jpg');  // NO pisa Storage
  assert.equal(out[0].valor_eur, 25000000);  // SÍ rellena lo que faltaba
  assert.equal(out[0].dorsal, 16);
  assert.equal(stats.matched, 1);
  assert.equal(stats.with_dorsal, 1);
});

test('applyEnrich persist-back tm_player_id cuando match es por nombre', () => {
  const roster = [{ nombre: 'Théo Hernández' }];  // sin tm_player_id
  const tmMap = new Map([[123, { tm_player_id: 123, name: 'Theo Hernandez', iso3: 'FRA' }]]);
  const { roster: out } = applyEnrich(roster, tmMap, { iso3: 'FRA' });
  assert.equal(out[0].tm_player_id, 123);  // persisted
});
```

---

## Pieza D — fix EF `supabase/functions/get-squad/index.ts` (v6 → v7)

Sin esto, la pizarra muestra "Defensa/Defensa/Defensa" donde antes mostraba "Lateral derecho/Defensa central/Lateral izquierdo".

Cambios:

```typescript
// Interfaz row de squads.jugadores (alinear con schema canónico)
type SquadJugadorRow = {
  nombre: string
  club: string | null
  club_logo_url: string | null
  posicion: string                    // ← bucket (Portero|Defensa|Centrocampista|Delantero)
  posicion_tm: string | null          // ← específica TM (Centre-Back, Lateral derecho...)
  es_titular: boolean
  dob: string | null
  edad: number | null
  valor_eur: number | null
  dorsal: number | null
  tm_player_id: number | null
  foto_url: string | null
};

// Render del XI: mostrar la específica si existe, fallback a bucket
function renderXIRow(j: SquadJugadorRow, pos: string, i: number): XIPlayer {
  return {
    dorsal: typeof j.dorsal === 'number' ? j.dorsal : (i + 1),
    nombre: typeof j.nombre === 'string' ? j.nombre : '—',
    posicion: (typeof j.posicion_tm === 'string' && j.posicion_tm.length > 0)
      ? j.posicion_tm                              // ← TM específica si existe
      : (typeof j.posicion === 'string' && j.posicion.length > 0)
        ? j.posicion                                // ← bucket fallback
        : pos,                                      // ← posición de formación si nada
  };
}

// Row mapping (lo que la EF devuelve a la pizarra)
function mapRow(r: any): SquadJugadorRow {
  return {
    nombre: typeof r.nombre === 'string' ? r.nombre : '',
    club: typeof r.club === 'string' ? r.club : null,
    club_logo_url: typeof r.club_logo_url === 'string' ? r.club_logo_url : null,
    posicion: typeof r.posicion === 'string' ? r.posicion : '',
    posicion_tm: typeof r.posicion_tm === 'string' ? r.posicion_tm : null,
    es_titular: !!r.es_titular,
    dob: typeof r.dob === 'string' ? r.dob : null,
    edad: typeof r.edad === 'number' ? r.edad : null,
    valor_eur: typeof r.valor_eur === 'number' ? r.valor_eur : null,
    dorsal: typeof r.dorsal === 'number' ? r.dorsal : null,
    tm_player_id: typeof r.tm_player_id === 'number' ? r.tm_player_id : null,
    foto_url: typeof r.foto_url === 'string' ? r.foto_url : null,
  };
}
```

**Retrocompatibilidad para frontend que aún lea `posicion_bucket`**: si después de auditar `ui-pizarra-tactica.js` y `ui-globo-equipos.js` el frontend ya no usa `posicion_bucket`, eliminar. Si todavía lo usa: añadir `posicion_bucket: r.posicion` como alias para no romper. Auditar antes de decidir.

Bumpear versión EF: v6 → v7. Updatear CLAUDE.md con la nueva versión.

---

## Pieza C-orquestador — `--mode=enrich-tm-mw` en `sync-squads.mjs`

```js
async function runEnrichTmMw({ iso3Filter, dryRun, verbose, full = false }) {
  // ───── FASE 1: PIEZA A ─────
  console.log('Phase 1/2: TM marktwert masivo (40 páginas)...');
  const { byTmId, byNation, unmappedNations, duplicates } = await fetchAllPages({ verbose });
  console.log(`  ${byTmId.size} jugadores, ${byNation.size} selecciones, ${duplicates.length} duplicados`);

  // Auto-fill tm-ids.json (Punto 2: NO escribir en dry-run, solo log)
  await maybeUpdateTmIds(byNation, { dryRun });

  // ───── FASE 2: enrich por país ─────
  const squads = await listAllSquads();
  const reportRows = [];

  for (const squad of squads) {
    if (iso3Filter && !iso3Filter.includes(squad.iso3)) continue;
    if (!squad.jugadores) continue;

    let roster = [...squad.jugadores];
    const totalRoster = roster.length;

    // ── 2a: Pieza A applyEnrich ──
    const aResult = applyEnrich(roster, byTmId, { iso3: squad.iso3, sourceLabel: 'A' });
    roster = aResult.roster;
    const fromA = aResult.stats.matched;

    // ── 2b: Pieza B applyEnrich (fill-missing dob+dorsal y completar tier-4) ──
    // Decisión: ejecutar B si --full=true OR cobertura A baja OR faltan dob/dorsal en >X jugadores
    const coverageA = fromA / totalRoster;
    const missingDobDorsal = roster.filter(p => p.dob == null || p.dorsal == null).length;
    const shouldRunB = full || coverageA < 0.5 || missingDobDorsal > totalRoster * 0.3;

    let fromB = 0;
    if (shouldRunB && byNation.has(squad.iso3)) {
      const vereinId = byNation.get(squad.iso3);
      if (verbose) console.log(`  ${squad.iso3}: fase B (coverageA=${(coverageA*100).toFixed(0)}%, missing dob/dorsal=${missingDobDorsal})`);
      try {
        const tmKaderPlayers = await fetchTmKader(vereinId, getSlug(squad.iso3), { verbose });
        const tmKaderMap = new Map(tmKaderPlayers.map(p => [p.tm_player_id, { ...p, iso3: squad.iso3 }]));
        const bResult = applyEnrich(roster, tmKaderMap, { iso3: squad.iso3, sourceLabel: 'B' });
        roster = bResult.roster;
        fromB = bResult.stats.matched;
      } catch (e) {
        if (verbose) console.warn(`  ${squad.iso3} kader fetch failed: ${e.message}`);
      }
    }

    // ── 2c: upload fotos a Storage (solo real run) ──
    if (!dryRun) {
      for (let i = 0; i < roster.length; i++) {
        const p = roster[i];
        if (p.foto_url_tm && p.tm_player_id && !p.foto_url) {
          try {
            roster[i].foto_url = await uploadPlayerPhoto(squad.iso3, p.tm_player_id, p.foto_url_tm);
          } catch (e) {
            if (verbose) console.warn(`  upload ${p.nombre}: ${e.message}`);
          }
          await new Promise(r => setTimeout(r, 200));
        }
        delete roster[i].foto_url_tm;  // limpiar temporal
      }
    } else {
      for (const p of roster) delete p.foto_url_tm;
    }

    // ── 2d: persist via upsertSquad (mergeJugadores ya en upsertSquad por PR #81) ──
    const newFuente = (squad.jugadores_fuente || '').includes('tm-mw')
      ? squad.jugadores_fuente
      : `${squad.jugadores_fuente || ''}+tm-mw`.replace(/^\+/, '');
    await upsertSquad(squad.iso3, roster, {
      isFinal: squad.jugadores_is_final,
      fuente: newFuente,
      dryRun,
    });

    // ── 2e: report (todos los campos del schema canónico para auditoría) ──
    const stats = {
      total: totalRoster,
      with_tm_id: roster.filter(p => p.tm_player_id != null).length,
      with_value: roster.filter(p => p.valor_eur != null).length,
      with_photo: roster.filter(p => p.foto_url != null).length,
      with_club: roster.filter(p => p.club != null).length,
      with_logo: roster.filter(p => p.club_logo_url != null).length,
      with_dob: roster.filter(p => p.dob != null).length,
      with_dorsal: roster.filter(p => p.dorsal != null).length,
      fromA,
      fromB,
    };
    reportRows.push({ iso3: squad.iso3, ...stats });
  }

  // ───── REPORT FINAL — una línea por país, todos los campos relevantes ─────
  console.log('\n=== REPORT FINAL ===');
  for (const r of reportRows.sort((a,b) => a.iso3.localeCompare(b.iso3))) {
    console.log(
      `${r.iso3}: ${r.with_tm_id}/${r.total} | value ${r.with_value} | ` +
      `photo ${r.with_photo} | club ${r.with_club} | logo ${r.with_logo} | ` +
      `dob ${r.with_dob} | dorsal ${r.with_dorsal} | A=${r.fromA} B=${r.fromB}`
    );
  }
}

async function maybeUpdateTmIds(byNation, { dryRun }) {
  const fp = 'scripts/lib/tm-ids.json';
  const current = JSON.parse(await fs.readFile(fp, 'utf8'));
  const newEntries = [];
  for (const [iso3, vereinId] of byNation) {
    if (current[iso3] == null) {
      newEntries.push([iso3, vereinId]);
      current[iso3] = vereinId;
    }
  }
  if (newEntries.length === 0) return;

  if (dryRun) {
    console.log(`  [dry-run] would add ${newEntries.length} entries to tm-ids.json:`);
    for (const [iso3, id] of newEntries) console.log(`    ${iso3} = ${id}`);
    return;
  }
  await fs.writeFile(fp, JSON.stringify(current, null, 2) + '\n');
  console.log(`  tm-ids.json updated: +${newEntries.length} entries`);
}
```

CLI flags nuevos: `--full` para forzar B siempre.

---

## Pieza E — `.github/workflows/sync-squads.yml`

```yaml
inputs:
  mode:
    type: choice
    options:
      - detect
      - scrape
      - enrich-tm        # legacy (mantener una semana, después borrar)
      - enrich-tm-mw     # NUEVO ← el que usaremos
    default: detect
  full:
    description: '[enrich-tm-mw] forzar fase B siempre (rellena dob+dorsal en países top)'
    type: boolean
    default: false
```

---

## Test plan post-merge

### 1. Unit tests `node --test`
`tm-parse-utils.test.mjs`, `tm-worldcup-market-values.test.mjs`, `tm-scraper.test.mjs`, `enrich-merge.test.mjs`. Target: **40+ tests** pasando.

### 2. Smoke dry-run con 4 países (sugerencia San)

```bash
node scripts/sync-squads.mjs --mode=enrich-tm-mw --iso3=FRA,QAT,CUW,COD --verbose --dry-run
```

Esperado:
- **FRA**: matched 22+/26, with_value 22+, with_dob 22+ (B aporta), A=22 B=22
- **QAT**: matched 18+/30, A=11 B=18+ (fallback B necesario)
- **CUW**: matched <5/26 con A solo, matched >20 tras B (rescate completo)
- **COD**: NO en `tm-nation-map.json` con el nombre "República Democrática del Congo"? Validar que el WARN aparece y que iso3 funciona via fallback (puede que TM use otro nombre, ajustar mapping)

### 3. Real run completo (38+ países)

```bash
# Via GHA dispatch
mode=enrich-tm-mw, iso3_filter=, full=false
```

Validar **cobertura ≥80% en TODOS los 48 países**, `tm-ids.json` con 48 entries.

### 4. Validación visual

- Pizarra Táctica: tokens muestran "Lateral derecho"/"Central"/"Pivote" (no "Defensa/Defensa/Pivote")
- Screen "plantillas" nueva: foto + escudo club + valor formateado

### 5. Verificar schema en BBDD

```sql
-- Toda squad debe tener al menos 1 jugador con tm_player_id + foto_url + valor_eur
SELECT iso3,
  count(*) FILTER (WHERE j ? 'tm_player_id' AND (j->>'tm_player_id') IS NOT NULL) AS con_tm,
  count(*) FILTER (WHERE (j->>'foto_url') IS NOT NULL) AS con_foto,
  count(*) FILTER (WHERE (j->>'valor_eur') IS NOT NULL) AS con_valor,
  count(*) FILTER (WHERE (j->>'dorsal') IS NOT NULL) AS con_dorsal,
  count(*) FILTER (WHERE (j->>'dob') IS NOT NULL) AS con_dob
FROM public.squads, jsonb_array_elements(jugadores) j
GROUP BY iso3
ORDER BY iso3;
```

---

## Rollback granular

PR sin squash → 7 commits independientes. Si pieza X falla en producción:
- Revert solo ese commit con `git revert <sha>` sin tocar el resto
- Tabla backup `squads_backup_19may_premigration` sigue disponible para restore por iso3

---

_Generado por Claude.ai 20-may-2026, v3 tras challenge de San con 10 ajustes integrados._
