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
 *  2. La línea siguiente al match suele contener los países separados por coma o "y".
 *  3. Mapear cada país a iso3 vía country-map.json (la importa el llamador y lo
 *     pasa como `countryMap` para evitar I/O acoplado a parseo).
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
    const stop = tail.search(/\b\d{1,2}\s+de\s+(enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|setiembre|octubre|noviembre|diciembre)\b/i);
    const segment = stop > -1 ? tail.slice(0, stop) : tail;

    const countries = segment
      .split(/[,•\n]|(?:\s+y\s+)/i)
      .map((s) => s.replace(/[:;.\-—–]/g, ' ').trim())
      .map((s) => s.replace(/^(y|e)\s+/i, '').trim())
      .filter((s) => s.length >= 3 && s.length <= 30 && /^[A-Za-zÁÉÍÓÚÑáéíóúñ. \-]+$/.test(s));

    const iso3s = [];
    const matchedCountries = [];
    for (const c of countries) {
      const key = normalizeCountryKey(c);
      const iso3 = countryMap[key];
      if (iso3 && !iso3s.includes(iso3)) {
        iso3s.push(iso3);
        matchedCountries.push(c);
      }
    }
    if (iso3s.length === 0) continue;

    const dedupeKey = `${date}|${iso3s.sort().join(',')}`;
    if (seen.has(dedupeKey)) continue;
    seen.add(dedupeKey);

    entries.push({ date, iso3s });
    raw.push({ date, countries: matchedCountries });
  }

  entries.sort((a, b) => a.date.localeCompare(b.date));
  return { entries, raw };
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
 * devuelve los iso3 que se esperan publicar HOY o ya están vencidos.
 */
export function expectedByDate(entries, todayIso) {
  const out = new Set();
  for (const e of entries) {
    if (e.date <= todayIso) for (const i of e.iso3s) out.add(i);
  }
  return out;
}
