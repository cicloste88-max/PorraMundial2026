// scripts/lib/parsers/_util.mjs
// Helpers compartidos por los parsers as.mjs / sport.mjs / olympics.mjs /
// marca.mjs / espn.mjs.
//
// Sigue el patrón de `calendar.mjs`: regex + stripTags + decode() de
// html-entities. Sin cheerio (mantener bundle ligero).
//
// Nota: `stripTags` y `normalizeCountryKey` viven también en calendar.mjs.
// Cuando alguien lo crea oportuno, mover ambos a este módulo y exportarlos
// desde allí. De momento duplicar es aceptable (zero dependency between
// parsers y calendar).

import fs from 'node:fs';
import path from 'node:path';
import { decode } from 'html-entities';
import countryMap from './country-map.json' with { type: 'json' };

// ───────────────────────────────────────────────────────────────────────
// Cache loader — Scrapling (Python) pre-fetcha el HTML al directorio
// cache/sources/<source>.html. Los parsers leen de aquí en lugar de hacer
// fetch() directo (bloqueado por Cloudflare/Akamai desde IPs de GH Actions
// — ver ERR-XX en errores_conocidos_porra.md).
// ───────────────────────────────────────────────────────────────────────

const CACHE_DIR = 'cache/sources';
const MIN_HTML_BYTES = 1000;

/**
 * Lee el HTML cacheado de una fuente. Path relativo a cwd (asume process.cwd()
 * es el root del repo, igual que el resto del pipeline).
 *
 * @returns string HTML (>=1KB)
 * @throws  Error si el cache no existe, está vacío, o es muy pequeño (sentinel
 *          de fallo de fetch_sources.py). El caller (parser → runDetect en
 *          sync-squads.mjs) lo cataloga como fuente fallida y sigue con las
 *          demás vía Promise.allSettled.
 */
export function loadCachedHtml(sourceName) {
  const cachePath = path.join(CACHE_DIR, `${sourceName}.html`);
  if (!fs.existsSync(cachePath)) {
    throw new Error(
      `[${sourceName}] cache miss: ${cachePath} (ejecuta scripts/scraping/fetch_sources.py primero)`
    );
  }
  const html = fs.readFileSync(cachePath, 'utf-8');
  if (!html || html.length < MIN_HTML_BYTES) {
    throw new Error(
      `[${sourceName}] cache vacío o demasiado pequeño (${html.length} bytes < ${MIN_HTML_BYTES}); fetch_sources.py marcó esta fuente como fallida`
    );
  }
  return html;
}

// ───────────────────────────────────────────────────────────────────────
// Strip tags + insert newlines en cierres/aperturas de tags block-level
// para preservar la estructura del documento como líneas iterables.
// Esencial: las fuentes (AS, Sport, Olympics) usan <h3>País</h3><p>Bucket: ...</p>.
// ───────────────────────────────────────────────────────────────────────

const BLOCK_TAGS_RE = /<\/?(h[1-6]|p|div|li|ul|ol|article|section|header|main|footer|aside|nav|table|tr|td|th|thead|tbody|tfoot|figure|figcaption|blockquote)\b[^>]*>/gi;

/**
 * Convierte HTML a array de líneas de texto plano. Útil para iterar el
 * documento manteniendo la estructura semántica (un bloque por línea).
 */
export function htmlToLines(html) {
  let s = String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<!--[\s\S]*?-->/g, ' ');
  // Insert \n alrededor de block-level tags (open y close)
  s = s.replace(BLOCK_TAGS_RE, '\n');
  // Strip resto de tags inline
  s = s.replace(/<[^>]+>/g, ' ');
  // Decode entidades HTML
  s = decode(s);
  // Normalize whitespace por línea
  return s
    .split('\n')
    .map((l) => l.replace(/\s+/g, ' ').trim())
    .filter((l) => l.length > 0);
}

/**
 * Plain text limpio (sin saltos de línea). Para detección de calendarios
 * o búsqueda lineal. Equivalente al stripTags de calendar.mjs.
 */
export function stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
}

// ───────────────────────────────────────────────────────────────────────
// País → iso3 (usa country-map.json existente)
// ───────────────────────────────────────────────────────────────────────

/**
 * Normaliza nombre de país para lookup en country-map.json:
 *   "Bélgica  " → "belgica"
 *   "EE.UU."   → "ee uu"
 *   "BOSNIA Y HERZEGOVINA" → "bosnia y herzegovina"
 *
 * Equivalente al normalizeCountryKey de calendar.mjs.
 */
export function normalizeCountryKey(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[.,;:]/g, ' ')     // FIX: punto a espacio (no vacío), para "EE.UU."→"ee uu"
    .replace(/[-_]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const BULLET_PREFIX_RE = /^[\s•·▪▫◦∙⦁⁃►■◆▸▹‣]+/u;

/**
 * Resuelve un texto a iso3 vía country-map.json.
 * Tolera bullets ("• País") y palabras decorativas comunes.
 * Devuelve null si no matchea ningún país conocido.
 */
export function resolveIso3(text) {
  if (!text) return null;
  const cleaned = String(text)
    .replace(BULLET_PREFIX_RE, '')
    .replace(/^(selección de|selección|equipo)\s+/i, '')
    .trim();
  if (!cleaned) return null;
  const key = normalizeCountryKey(cleaned);
  return countryMap[key] || null;
}

// ───────────────────────────────────────────────────────────────────────
// Posición → enum estándar del proyecto (4 categorías)
// ───────────────────────────────────────────────────────────────────────

const POSICION_MAP = {
  // Portero
  portero: 'Portero', porteros: 'Portero',
  arquero: 'Portero', arqueros: 'Portero',
  guardameta: 'Portero', guardametas: 'Portero',
  goalkeeper: 'Portero', goalkeepers: 'Portero',
  // Defensa
  defensa: 'Defensa', defensas: 'Defensa',
  defensor: 'Defensa', defensores: 'Defensa',
  zaguero: 'Defensa', zagueros: 'Defensa',
  defender: 'Defensa', defenders: 'Defensa',
  // Centrocampista
  centrocampista: 'Centrocampista', centrocampistas: 'Centrocampista',
  mediocampista: 'Centrocampista', mediocampistas: 'Centrocampista',
  medio: 'Centrocampista', medios: 'Centrocampista',
  volante: 'Centrocampista', volantes: 'Centrocampista',
  midfielder: 'Centrocampista', midfielders: 'Centrocampista',
  // Delantero
  delantero: 'Delantero', delanteros: 'Delantero',
  atacante: 'Delantero', atacantes: 'Delantero',
  ariete: 'Delantero', arietes: 'Delantero',
  forward: 'Delantero', forwards: 'Delantero',
};

/**
 * Mapea un label de bucket a la enum estándar 'Portero'/'Defensa'/'Centrocampista'/'Delantero'.
 * Acepta el bucket sin dos puntos finales: "Porteros" / "Arqueros" / "Defensores" / ...
 */
export function mapPosicion(label) {
  if (!label) return null;
  const k = String(label)
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[:.,;()]/g, '')
    .trim();
  return POSICION_MAP[k] || null;
}

// Regex que detecta una línea "Bucket: jugadores...". El bucket es el texto
// hasta los dos puntos. La función devuelve {label, listText} o null.
const BUCKET_LINE_RE = /^([A-Za-zÁÉÍÓÚÑáéíóúñ]+)\s*:\s*(.+)$/;

/**
 * Si la línea tiene formato "Bucket: jugadores ...", devuelve {posicion, listText}.
 * En caso contrario, null.
 */
export function detectBucketLine(line) {
  const m = line.match(BUCKET_LINE_RE);
  if (!m) return null;
  const posicion = mapPosicion(m[1]);
  if (!posicion) return null;
  return { posicion, listText: m[2].trim() };
}

// ───────────────────────────────────────────────────────────────────────
// Parser de jugador y lista de jugadores
// ───────────────────────────────────────────────────────────────────────

/**
 * Parsea "Nombre (Club)" o "Nombre (Club, PAIS)" o "Nombre" suelto.
 * @returns {{ nombre: string, club?: string } | null}
 */
export function parsePlayer(raw) {
  const s = String(raw || '').replace(/\s+/g, ' ').trim().replace(/[.,;]+$/, '');
  if (!s) return null;
  const m = s.match(/^(.+?)\s*\(([^)]+)\)\s*$/);
  if (m) {
    const nombre = m[1].trim();
    let club = m[2].trim();
    // "FC Tokyo, JPN" → quitar el ", JPN" si parece código país (2-4 letras todo mayúsculas)
    const parts = club.split(',').map((p) => p.trim());
    if (parts.length >= 2 && /^[A-ZÁ-Ú]{2,4}$/u.test(parts[parts.length - 1])) {
      club = parts.slice(0, -1).join(', ');
    }
    return club ? { nombre, club } : { nombre };
  }
  return { nombre: s };
}

/**
 * Split de "A (X), B (Y) y C (Z)" en [{nombre, club}, ...].
 * Maneja el " y " final típico de AS/Olympics y los paréntesis anidados.
 *
 * SEPARADORES ESPAÑOLES (todos válidos pre-último-elemento):
 *  - " y "  estándar: "Maignan, Samba y Risser"
 *  - " e "  alternativa antes de i/hi: "Kotarski e Ivor Pandur" (Olympics 18-may CRO)
 *  - "yX"   typo Olympics: "Lammens yMike Penders" (BEL Olympics 18-may)
 *
 * RESILIENCIA: si el HTML upstream tiene un paréntesis huérfano (e.g.
 * AS 18-may con typo "Lee Jjae-Sung )Mainz 05)" — paréntesis derecho sin
 * izquierdo), clampeamos depth a 0 para no fundir registros siguientes.
 * El jugador con el typo quedará con `club` raro, pero los siguientes se
 * preservan como entradas independientes.
 */
export function parsePlayerList(text) {
  // Primero normalizar TODOS los separadores conjuntivos a ", "
  let normalized = String(text || '')
    // " e " (alternativa antes de i/hi) — solo si la palabra siguiente empieza por mayúscula
    .replace(/,?\s+e\s+(?=[A-ZÁ-ÚÑ])/g, ', ')
    // " y " estándar
    .replace(/,?\s+y\s+/gi, ', ')
    // "yX" pegado (typo): " y" + Mayúscula sin espacio. Ej "Lammens yMike" → "Lammens, Mike"
    .replace(/\s+y(?=[A-ZÁ-ÚÑ])/g, ', ');
  const tokens = [];
  let depth = 0;
  let buf = '';
  for (const ch of normalized) {
    if (ch === '(') depth++;
    else if (ch === ')') depth = Math.max(0, depth - 1);
    if (ch === ',' && depth === 0) {
      if (buf.trim()) tokens.push(buf);
      buf = '';
    } else {
      buf += ch;
    }
  }
  if (buf.trim()) tokens.push(buf);
  return tokens.map(parsePlayer).filter(Boolean);
}

// ───────────────────────────────────────────────────────────────────────
// Helpers de identificación de grupos (A-L) y headers de selección
// ───────────────────────────────────────────────────────────────────────

const GROUP_LINE_RE = /^Grupo\s+([A-L])\s*$/i;

/**
 * Si la línea es "Grupo X", devuelve la letra. En caso contrario, null.
 */
export function detectGroupLine(line) {
  const m = line.replace(BULLET_PREFIX_RE, '').trim().match(GROUP_LINE_RE);
  return m ? m[1].toUpperCase() : null;
}

/**
 * Si la línea es header de selección con bullet ("• País") O es texto cortito que
 * resuelve a un iso3 conocido, devuelve {iso3, rawName}. En caso contrario, null.
 *
 * Se aplica un límite de longitud (60 chars) para evitar matchear frases largas
 * que contengan un nombre de país por casualidad.
 */
export function detectCountryHeader(line, { requireBullet = false } = {}) {
  if (!line || line.length > 60) return null;
  const hasBullet = BULLET_PREFIX_RE.test(line);
  if (requireBullet && !hasBullet) return null;
  const iso3 = resolveIso3(line);
  if (!iso3) return null;
  return { iso3, rawName: line.replace(BULLET_PREFIX_RE, '').trim() };
}

const TRAINER_LINE_RE = /^(entrenador|coach|DT|director t[eé]cnico|selecciona(dor|dora))\s*[:.\-]\s*(.+)$/i;

/**
 * Si la línea es "Entrenador: Nombre" / "DT: Nombre" / etc., devuelve el nombre.
 * En caso contrario, null.
 */
export function detectCoachLine(line) {
  const m = line.match(TRAINER_LINE_RE);
  return m ? m[3].trim().replace(/[.,;]+$/, '') : null;
}
