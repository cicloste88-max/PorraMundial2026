// Parser del bloque "Calendario de anuncios" de Olympics.com.
//
// Estructura típica (validada 18-may):
//   "18 de mayo"
//      Austria, Brasil, RD Congo
//   "19 de mayo"
//      Portugal
//   ...
//
// Salida: cache/squads-calendar.json — el cron lo usa para saber qué iso3 ESPERAR
// cada día. Si hoy es "18 de mayo" y BRA aparece como FINAL detectado, perfecto.
// Si CRO aparece marcada FINAL por AS pero el calendario dice "1 de junio", el
// cross-validate puede rebajar la confianza incluso con 2 fuentes.

import { decode } from 'html-entities';

const MES_ES = {
  enero: '01', febrero: '02', marzo: '03', abril: '04', mayo: '05', junio: '06',
  julio: '07', agosto: '08', septiembre: '09', setiembre: '09', octubre: '10',
  noviembre: '11', diciembre: '12',
};

function normalizeCountryKey(s) {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[.,]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extrae el calendario de anuncios desde el HTML de Olympics.
 *
 * Heurística:
 *  1. Buscar líneas del tipo "<dd> de <mes>" (con o sin año explícito).
 *  2. Coger el segmento de texto hasta la siguiente fecha.
 *  3. Hacer greedy longest-match contra `countryMap` con ventanas de 1-3 tokens
 *     (necesario porque Olympics serializa cada país en un `<li>` distinto y
 *     `stripTags` los une con espacios → "Alemania Marruecos Noruega" se
 *     convertiría en un solo token si solo splitáramos por comas/"y").
 *  4. Strippear sufijos editoriales tipo "(definitiva)" o "(provisional)".
 *
 * @param {string} html
 * @param {Record<string,string>} countryMap  Mapa de nombre normalizado → iso3.
 * @param {Object} [opts]
 * @param {number} [opts.year=2026]  Año a asumir si no aparece en la línea.
 * @returns {{ entries: Array<{ date: string, iso3s: string[] }>, raw: Array<{ date: string, countries: string[] }> }}
 */
export function parseCalendar(html, countryMap, opts = {}) {
  const year = opts.year || 2026;
  const text = decode(stripTags(html));

  const dateRe = /\b(\d{1,2})\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/gi;

  const entries = [];
  const raw = [];
  const seen = new Set();

  let m;
  while ((m = dateRe.exec(text)) !== null) {
    const day = String(m[1]).padStart(2, '0');
    const month = MES_ES[m[2].toLowerCase()];
    if (!month) continue;
    const date = `${year}-${month}-${day}`;

    const tail = text.slice(dateRe.lastIndex, dateRe.lastIndex + 240);
    // Stop al próximo "dd de mes" (otra fecha de calendario) o al rango del
    // torneo "dd mes - dd mes" (sin "de", marca fin del bloque calendario).
    const stop = tail.search(/\b\d{1,2}\s+(?:de\s+)?(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/i);
    const segment = stop > -1 ? tail.slice(0, stop) : tail;

    const { iso3s, matched } = extractCountries(segment, countryMap);
    if (iso3s.length === 0) continue;

    const dedupeKey = `${date}|${iso3s.slice().sort().join(',')}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    entries.push({ date, iso3s });
    raw.push({ date, countries: matched });
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));
  return { entries, raw };
}

// Greedy longest-match: walk tokens, intenta ventana de 3 → 2 → 1, consume.
// Strippea sufijos editoriales "(definitiva)", "(provisional)", paréntesis sueltos.
function extractCountries(segment, countryMap) {
  const cleaned = segment
    .replace(/\([^)]*\)/g, ' ')           // strip "(definitiva)", "(provisional)", etc.
    .replace(/[,•\n:;.\-—–]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const tokens = cleaned.split(/\s+/).filter((t) => /^[A-Za-zÁÉÍÓÚÑáéíóúñ.\-]+$/.test(t));

  const iso3s = [];
  const matched = [];
  let i = 0;
  while (i < tokens.length) {
    let consumed = 0;
    for (let win = Math.min(3, tokens.length - i); win >= 1 && consumed === 0; win--) {
      const candidate = tokens.slice(i, i + win).join(' ');
      // Filtrar conectores que no son países válidos por sí solos
      if (win === 1 && /^(y|e|o|u|de|del|la|el|los|las)$/i.test(candidate)) continue;
      const key = normalizeCountryKey(candidate);
      const iso3 = countryMap[key];
      if (iso3) {
        if (!iso3s.includes(iso3)) {
          iso3s.push(iso3);
          matched.push(candidate);
        }
        consumed = win;
      }
    }
    i += consumed > 0 ? consumed : 1;
  }
  return { iso3s, matched };
}

function stripTags(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ');
}

/**
 * Helper para el orquestador: dado el calendario y la fecha de hoy (ISO),
 * devuelve los iso3 cuya FECHA "(definitiva)" del calendario es ESTRICTAMENTE
 * FUTURA. El cross-validate los degrada a 'low' aunque 2+ fuentes coincidan,
 * porque la lista actual probablemente sea provisional y Olympics anuncia que
 * la definitiva llega más tarde.
 *
 * iso3 ausentes del calendario o ya vencidos (date ≤ today) → NO degraden.
 */
export function pendingDefinitiveByDate(entries, todayIso) {
  const out = new Set();
  for (const e of entries) {
    if (e.date > todayIso) for (const i of e.iso3s) out.add(i);
  }
  return out;
}

/**
 * @deprecated Mantén compatibilidad con tests/llamadores antiguos. Devuelve los
 * iso3 con fecha ≤ today (lo opuesto al uso actual de cross-validate).
 */
export function expectedByDate(entries, todayIso) {
  const out = new Set();
  for (const e of entries) {
    if (e.date <= todayIso) for (const i of e.iso3s) out.add(i);
  }
  return out;
}
