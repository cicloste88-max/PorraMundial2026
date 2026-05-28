// scripts/lib/__tests__/ff-scraper.test.mjs
// Tests del parser cheerio para el XI titular de FF (PR 27-may-2026).
// Resuelve el XI 8/11 sistemático en Tier A: el parser previo extraía
// <img alt> y perdía nombres en texto bajo camisetas. El nuevo lee
// div[class*="jugadores-titulares-"] > div.tipo_campo con datos en
// data-* attrs + <a.camiseta>/<img alt>. Selector validado por San
// contra HTML real ESP (27-may, 11 titulares + 15 suplentes = 26 total).

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { parseStartingXIFromHtml } from '../ff-scraper.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES_DIR = resolve(__dirname, '../../../tests/fixtures/ff');

// Fixture mínimo replicando el patrón observado por San en FF España.
// 11 titulares (XI 4-3-3): 1 PO + 4 DEF + 3 MC + 3 DEL.
// IDs reales sacados del brief de San — útil para verificar que el parser
// extrae lo esperado sin contaminarse con suplentes.
const ESP_FIXTURE = `
<html><body>
<div class="relative campo-wrapper zoom-fix multi-views with-tabs with-lineup-info seleccion liga">
<div class="jugadores-titulares-22208 mod lesionados mb-0">
  <div class="jugador_7279 tipo_campo camiseta-wrapper portero" data-onceff="titular" data-equipo="ESP" style="left:50%;top:87%">
    <a class="camiseta" href="/jugadores/joan-garcia/world-cup-2026"><img alt="Joan Garcia" src="/photo/7279.jpg"/></a>
  </div>
  <div class="jugador_5013 tipo_campo campo" data-onceff="titular" data-equipo="ESP" style="left:11%;top:66%">
    <a class="camiseta" href="/jugadores/marc-cucurella/world-cup-2026"><img alt="Marc Cucurella" src="/photo/5013.jpg"/></a>
  </div>
  <div class="jugador_697 tipo_campo campo" data-onceff="titular" data-equipo="ESP" style="left:32%;top:70%">
    <a class="camiseta" href="/jugadores/aymeric-laporte/world-cup-2026"><img alt="Aymeric Laporte" src="/photo/697.jpg"/></a>
  </div>
  <div class="jugador_11706 tipo_campo campo" data-onceff="titular" data-equipo="ESP" style="left:68%;top:70%">
    <a class="camiseta" href="/jugadores/pau-cubarsi/world-cup-2026"><img alt="Pau Cubarsí" src="/photo/11706.jpg"/></a>
  </div>
  <div class="jugador_1931 tipo_campo campo" data-onceff="titular" data-equipo="ESP" style="left:89%;top:66%">
    <a class="camiseta" href="/jugadores/marcos-llorente/world-cup-2026"><img alt="Marcos Llorente" src="/photo/1931.jpg"/></a>
  </div>
  <div class="jugador_2100 tipo_campo campo" data-onceff="titular" data-equipo="ESP" style="left:26%;top:42%">
    <a class="camiseta" href="/jugadores/fabian-ruiz/world-cup-2026"><img alt="Fabián Ruiz" src="/photo/2100.jpg"/></a>
  </div>
  <div class="jugador_2733 tipo_campo campo" data-onceff="titular" data-equipo="ESP" style="left:50%;top:56%">
    <a class="camiseta" href="/jugadores/rodri-hernandez/world-cup-2026"><img alt="Rodri Hernández" src="/photo/2733.jpg"/></a>
  </div>
  <div class="jugador_7257 tipo_campo campo" data-onceff="titular" data-equipo="ESP" style="left:74%;top:42%">
    <a class="camiseta" href="/jugadores/pedri-gonzalez/world-cup-2026"><img alt="Pedri González" src="/photo/7257.jpg"/></a>
  </div>
  <div class="jugador_8693 tipo_campo campo" data-onceff="titular" data-equipo="ESP" style="left:11%;top:27%">
    <a class="camiseta" href="/jugadores/nico-williams/world-cup-2026"><img alt="Nico Williams" src="/photo/8693.jpg"/></a>
  </div>
  <div class="jugador_2675 tipo_campo campo" data-onceff="titular" data-equipo="ESP" style="left:50%;top:18%">
    <a class="camiseta" href="/jugadores/mikel-oyarzabal/world-cup-2026"><img alt="Mikel Oyarzabal" src="/photo/2675.jpg"/></a>
  </div>
  <div class="jugador_5050 tipo_campo campo" data-onceff="titular" data-equipo="ESP" style="left:89%;top:27%">
    <a class="camiseta" href="/jugadores/ferran-torres/world-cup-2026"><img alt="Ferran Torres" src="/photo/5050.jpg"/></a>
  </div>
</div>

<!-- Suplentes — NO deben aparecer en el XI -->
<div class="jugadores-suplentes-22208 mod">
  <div class="jugador_9999 tipo_campo supl-1" data-onceff="suplente" data-equipo="ESP">
    <a class="camiseta" href="/jugadores/unai-simon/world-cup-2026"><img alt="Unai Simón" src="/photo/9999.jpg"/></a>
  </div>
  <div class="jugador_9998 tipo_campo supl-2" data-onceff="suplente" data-equipo="ESP">
    <a class="camiseta" href="/jugadores/pedro-porro/world-cup-2026"><img alt="Pedro Porro" src="/photo/9998.jpg"/></a>
  </div>
</div>
</div>
</body></html>
`;

const EXPECTED_XI_ESP = [
  'Joan Garcia',
  'Marc Cucurella',
  'Aymeric Laporte',
  'Pau Cubarsí',
  'Marcos Llorente',
  'Fabián Ruiz',
  'Rodri Hernández',
  'Pedri González',
  'Nico Williams',
  'Mikel Oyarzabal',
  'Ferran Torres',
];

test('parseStartingXIFromHtml: extrae los 11 titulares ESP del fixture', () => {
  const xi = parseStartingXIFromHtml(ESP_FIXTURE);
  assert.equal(xi.length, 11, `esperado 11 titulares, fue ${xi.length}: ${xi.join(', ')}`);
  for (const expectedName of EXPECTED_XI_ESP) {
    assert.ok(
      xi.includes(expectedName),
      `falta '${expectedName}' en XI extraído: ${xi.join(', ')}`
    );
  }
});

test('parseStartingXIFromHtml: NO incluye suplentes del contenedor jugadores-suplentes-*', () => {
  const xi = parseStartingXIFromHtml(ESP_FIXTURE);
  // Unai Simón y Pedro Porro están en el bloque jugadores-suplentes-22208,
  // NO deben aparecer en el XI titular.
  assert.ok(!xi.includes('Unai Simón'), 'XI no debe incluir suplente Unai Simón');
  assert.ok(!xi.includes('Pedro Porro'), 'XI no debe incluir suplente Pedro Porro');
});

test('parseStartingXIFromHtml: HTML vacío o muy corto devuelve array vacío', () => {
  assert.deepEqual(parseStartingXIFromHtml(''), []);
  assert.deepEqual(parseStartingXIFromHtml('<html></html>'), []);
  assert.deepEqual(parseStartingXIFromHtml(null), []);
});

test('parseStartingXIFromHtml: placeholder /alineaciones/0.jpg → array vacío', () => {
  // FF sirve esta imagen cuando aún no ha publicado el XI predicho.
  // El parser debe detectarla y devolver [] sin intentar extraer nombres.
  const html = '<html><body><img src="/alineaciones/0.jpg"/><div class="jugadores-titulares-1"><div class="jugador_1 tipo_campo"><a class="camiseta"><img alt="X"/></a></div></div></body></html>';
  const longHtml = html + ' '.repeat(2000); // pad to >1000 bytes
  assert.deepEqual(parseStartingXIFromHtml(longHtml), []);
});

test('parseStartingXIFromHtml: sin contenedor jugadores-titulares-* → array vacío', () => {
  const html = '<html><body>' + 'x'.repeat(2000) + '<div class="otra-cosa"><div class="jugador_1 tipo_campo"><a class="camiseta"><img alt="No XI"/></a></div></div></body></html>';
  assert.deepEqual(parseStartingXIFromHtml(html), []);
});

test('parseStartingXIFromHtml: respeta sufijo numérico variable de jugadores-titulares-{TID}', () => {
  // El sufijo cambia por seleccionador (22208 ESP en este momento). Probamos
  // con otro número para confirmar que el selector por prefijo funciona.
  const html = ESP_FIXTURE.replace(/jugadores-titulares-22208/g, 'jugadores-titulares-99999');
  const xi = parseStartingXIFromHtml(html);
  assert.equal(xi.length, 11);
  assert.ok(xi.includes('Pedri González'));
});

test('parseStartingXIFromHtml: extrae el orden DOM (no posición en campo)', () => {
  // El parser preserva orden de aparición en el HTML; el primer slot es PO,
  // luego defensa derecho/centrales/lateral izquierdo, etc según FF.
  const xi = parseStartingXIFromHtml(ESP_FIXTURE);
  assert.equal(xi[0], 'Joan Garcia', 'PO debe ser el primer slot del fixture');
});

test('parseStartingXIFromHtml: caracteres con acentos y entidades HTML decodificados', () => {
  // Pau Cubarsí, Mikel Oyarzabal, Pedri González, Aymeric Laporte, Fabián Ruiz,
  // Rodri Hernández — todos con caracteres no-ASCII en el fixture. El parser
  // debe devolverlos intactos (no escapados ni con entidades crudas).
  const xi = parseStartingXIFromHtml(ESP_FIXTURE);
  assert.ok(xi.includes('Pau Cubarsí'), 'í preservada');
  assert.ok(xi.includes('Pedri González'), 'á preservada');
  assert.ok(xi.includes('Fabián Ruiz'), 'á preservada');
  assert.ok(xi.includes('Rodri Hernández'), 'é+á preservadas');
});

test('parseStartingXIFromHtml: filtra slots con clase supl-N si caen por error en titulares', () => {
  // Defensa: si por error de marcado un slot supl-N apareciera dentro del
  // contenedor jugadores-titulares-*, el parser lo debe ignorar.
  const corrupted = ESP_FIXTURE.replace(
    /jugador_5050 tipo_campo campo/,
    'jugador_5050 tipo_campo campo supl-99'
  );
  const xi = parseStartingXIFromHtml(corrupted);
  assert.ok(!xi.includes('Ferran Torres'), 'slot con supl-N debe filtrarse');
  assert.equal(xi.length, 10, 'queda con 10 si se filtra el malformado');
});

// ────────────────────────────────────────────────────────────────────────────
// Regresión contra HTML REAL ESP (27-may-2026, 780KB)
// Descargado del artifact sync-squads-log-XXX tras fetch_sources.py Scrapling
// con StealthyFetcher en GH Actions. Caso que descubrió el bug del primer
// img siendo el escudo del club (alt="") → parser extraía "1.81 50%" en vez
// de nombres. Fix: img[alt] filter con alt no-vacío.
// ────────────────────────────────────────────────────────────────────────────

const REAL_ESP_HTML = readFileSync(resolve(FIXTURES_DIR, 'esp.html'), 'utf-8');

test('parseStartingXIFromHtml: HTML REAL ESP devuelve los 11 titulares correctos', () => {
  const xi = parseStartingXIFromHtml(REAL_ESP_HTML);
  assert.equal(xi.length, 11, `esperado 11, fue ${xi.length}: ${xi.join(', ')}`);

  // Validado por San con DOM inspector el 27-may. El XI tipo ESP vs Cabo
  // Verde con seleccionador actual (data-onceff-x/y disposición 4-3-3).
  const expected = [
    'Joan Garcia',
    'Marc Cucurella',
    'Aymeric Laporte',
    'Pau Cubarsí',
    'Marcos Llorente',
    'Fabián Ruiz',
    'Rodri Hernández',
    'Pedri González',
    'Nico Williams',
    'Mikel Oyarzabal',
  ];
  for (const name of expected) {
    assert.ok(
      xi.includes(name),
      `falta '${name}' en XI extraído del HTML real ESP: ${xi.join(', ')}`
    );
  }
  // Ferran Torres puede venir con acento o sin (FF usa "Ferrán Torres")
  assert.ok(
    xi.some((n) => /^Ferr[aá]n Torres$/.test(n)),
    'falta Ferrán Torres'
  );
});

test('parseStartingXIFromHtml: HTML REAL ESP NO devuelve "1.81 50%" tipo widgets', () => {
  // Regresión: el parser inicial extraía "1.81 50%" del widget de probabilidad
  // porque el primer <img> de cada slot es el escudo del club (alt vacío) y
  // caía al fallback de texto del <a>. El fix de img[alt] con alt no-vacío
  // garantiza que sólo se extraen nombres reales de jugador.
  const xi = parseStartingXIFromHtml(REAL_ESP_HTML);
  for (const n of xi) {
    assert.ok(!/^\d+(\.\d+)?%?$/.test(n), `'${n}' parece un número/porcentaje, no nombre`);
    assert.ok(!/\d+\s*\d+%/.test(n), `'${n}' parece "altura X%" del widget`);
  }
});

test('parseStartingXIFromHtml: HTML REAL ESP no incluye suplentes', () => {
  const xi = parseStartingXIFromHtml(REAL_ESP_HTML);
  const knownSuplentesEsp = ['Unai Simón', 'David Raya', 'Eric García', 'Pedro Porro'];
  for (const sup of knownSuplentesEsp) {
    assert.ok(
      !xi.includes(sup),
      `suplente '${sup}' NO debería estar en XI: ${xi.join(', ')}`
    );
  }
});

// ────────────────────────────────────────────────────────────────────────────
// Regresión variante B — JPN-style markup SIN wrapper (28-may-2026)
//
// FF sirve dos variantes de markup para el XI:
//   A) ESP-style: <div class="jugadores-titulares-X"> wrapper + hijos
//      con data-onceff="titular".
//   B) JPN-style: SIN wrapper, players sueltos con data-onceff="titular"
//      directo en el árbol. Detectado tras run 26549858215 cuando FF servía
//      el XI publicado para JPN/BEL/BIH/SWE pero el parser cheerio devolvía
//      [] (selector buscaba sólo el wrapper).
//
// Fix: cambio del selector primario a [data-onceff="titular"] (semántico,
// presente en AMBAS variantes). Wrapper queda como fallback defensivo.
// ────────────────────────────────────────────────────────────────────────────

const JPN_FIXTURE_NO_WRAPPER = `
<html><body>
<div class="campo-wrapper">
  <div class="jugador_0 campo camiseta-wrapper" data-onceff="titular" data-onceff-x="50%" data-onceff-y="87%">
    <a class="camiseta" href="/jugadores/zion-suzuki/world-cup-2026"><img alt="Suzuki" src="/photo/1.jpg"/></a>
  </div>
  <div class="jugador_1 campo camiseta-wrapper" data-onceff="titular" data-onceff-x="80%" data-onceff-y="70%">
    <a class="camiseta" href="/jugadores/tomiyasu/world-cup-2026"><img alt="Tomiyasu" src="/photo/2.jpg"/></a>
  </div>
  <div class="jugador_2 campo camiseta-wrapper" data-onceff="titular" data-onceff-x="65%" data-onceff-y="72%">
    <a class="camiseta" href="/jugadores/hiroki-ito/world-cup-2026"><img alt="H. Ito" src="/photo/3.jpg"/></a>
  </div>
  <div class="jugador_3 campo camiseta-wrapper" data-onceff="titular" data-onceff-x="35%" data-onceff-y="72%">
    <a class="camiseta" href="/jugadores/itakura/world-cup-2026"><img alt="Itakura" src="/photo/4.jpg"/></a>
  </div>
  <div class="jugador_4 campo camiseta-wrapper" data-onceff="titular" data-onceff-x="20%" data-onceff-y="70%">
    <a class="camiseta" href="/jugadores/doan/world-cup-2026"><img alt="Doan" src="/photo/5.jpg"/></a>
  </div>
  <div class="jugador_5 campo camiseta-wrapper" data-onceff="titular" data-onceff-x="60%" data-onceff-y="55%">
    <a class="camiseta" href="/jugadores/wataru-endo/world-cup-2026"><img alt="Endo" src="/photo/6.jpg"/></a>
  </div>
  <div class="jugador_6 campo camiseta-wrapper" data-onceff="titular" data-onceff-x="40%" data-onceff-y="55%">
    <a class="camiseta" href="/jugadores/ao-tanaka/world-cup-2026"><img alt="Ao Tanaka" src="/photo/7.jpg"/></a>
  </div>
  <div class="jugador_7 campo camiseta-wrapper" data-onceff="titular" data-onceff-x="20%" data-onceff-y="40%">
    <a class="camiseta" href="/jugadores/keito-nakamura/world-cup-2026"><img alt="K. Nakamura" src="/photo/8.jpg"/></a>
  </div>
  <div class="jugador_8 campo camiseta-wrapper" data-onceff="titular" data-onceff-x="80%" data-onceff-y="40%">
    <a class="camiseta" href="/jugadores/take-kubo/world-cup-2026"><img alt="Kubo" src="/photo/9.jpg"/></a>
  </div>
  <div class="jugador_9 campo camiseta-wrapper" data-onceff="titular" data-onceff-x="50%" data-onceff-y="30%">
    <a class="camiseta" href="/jugadores/kamada/world-cup-2026"><img alt="Kamada" src="/photo/10.jpg"/></a>
  </div>
  <div class="jugador_10 campo camiseta-wrapper" data-onceff="titular" data-onceff-x="50%" data-onceff-y="15%">
    <a class="camiseta" href="/jugadores/ueda/world-cup-2026"><img alt="Ueda" src="/photo/11.jpg"/></a>
  </div>

  <div class="jugador_99 campo camiseta-wrapper" data-onceff="suplente">
    <a class="camiseta" href="/jugadores/sugawara/world-cup-2026"><img alt="Sugawara" src="/photo/99.jpg"/></a>
  </div>
  <div class="jugador_98 campo camiseta-wrapper" data-onceff="suplente">
    <a class="camiseta" href="/jugadores/watanabe/world-cup-2026"><img alt="Watanabe" src="/photo/98.jpg"/></a>
  </div>
</div>
</body></html>
`;

const EXPECTED_XI_JPN = [
  'Suzuki', 'Tomiyasu', 'H. Ito', 'Itakura', 'Doan',
  'Endo', 'Ao Tanaka', 'K. Nakamura', 'Kubo', 'Kamada', 'Ueda',
];

test('parseStartingXIFromHtml: variante JPN-style SIN wrapper extrae los 11', () => {
  const padded = JPN_FIXTURE_NO_WRAPPER + '<!--' + ' '.repeat(2000) + '-->';
  const xi = parseStartingXIFromHtml(padded);
  assert.equal(xi.length, 11, `esperado 11, fue ${xi.length}: ${xi.join(', ')}`);
  for (const expected of EXPECTED_XI_JPN) {
    assert.ok(xi.includes(expected), `falta '${expected}' en XI: ${xi.join(', ')}`);
  }
});

test('parseStartingXIFromHtml: variante JPN-style excluye data-onceff="suplente"', () => {
  const padded = JPN_FIXTURE_NO_WRAPPER + '<!--' + ' '.repeat(2000) + '-->';
  const xi = parseStartingXIFromHtml(padded);
  assert.ok(!xi.includes('Sugawara'), 'data-onceff=suplente debe excluirse');
  assert.ok(!xi.includes('Watanabe'), 'data-onceff=suplente debe excluirse');
});
