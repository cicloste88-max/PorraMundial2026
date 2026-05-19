// Tests de los parsers de fuente primaria (as, sport, olympics).
//
// Ejecutar: `node --test scripts/lib/parsers/__tests__/sources.test.mjs`
//
// Requiere html-entities (ya en deps por calendar.mjs). NO requiere cheerio.

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

import * as asSrc from '../as.mjs';
import * as sportSrc from '../sport.mjs';
import * as olympicsSrc from '../olympics.mjs';
import * as eurosportSrc from '../eurosport.mjs';
import {
  parsePlayer,
  parsePlayerList,
  mapPosicion,
  resolveIso3,
  normalizeCountryKey,
  htmlToLines,
} from '../_util.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURES = resolve(__dirname, '../../../../tests/fixtures/squads');

function loadFixture(name) {
  return readFileSync(resolve(FIXTURES, name), 'utf8');
}

// ───────────────────────────────────────────────────────────────────────
// Util tests
// ───────────────────────────────────────────────────────────────────────

test('util: normalizeCountryKey strip acentos + lowercase + puntuación', () => {
  assert.equal(normalizeCountryKey('México'), 'mexico');
  assert.equal(normalizeCountryKey(' Bélgica '), 'belgica');
  assert.equal(normalizeCountryKey('EE.UU.'), 'ee uu');
  assert.equal(normalizeCountryKey('Bosnia-Herzegovina'), 'bosnia herzegovina');
});

test('util: resolveIso3 acepta variantes de country-map.json', () => {
  assert.equal(resolveIso3('Bélgica'), 'BEL');
  assert.equal(resolveIso3('• Bosnia'), 'BIH');
  assert.equal(resolveIso3('Bosnia y Herzegovina'), 'BIH');
  assert.equal(resolveIso3('Corea del Sur'), 'KOR');
  assert.equal(resolveIso3('EE.UU.'), 'USA');
  assert.equal(resolveIso3('Estados Unidos'), 'USA');
  assert.equal(resolveIso3('Inexistania'), null);
});

test('util: mapPosicion mapea variantes de AS y Olympics', () => {
  assert.equal(mapPosicion('Porteros'), 'Portero');
  assert.equal(mapPosicion('Arqueros'), 'Portero');
  assert.equal(mapPosicion('Defensas'), 'Defensa');
  assert.equal(mapPosicion('Defensores'), 'Defensa');
  assert.equal(mapPosicion('Centrocampistas'), 'Centrocampista');
  assert.equal(mapPosicion('Mediocampistas'), 'Centrocampista');
  assert.equal(mapPosicion('Delanteros'), 'Delantero');
  assert.equal(mapPosicion('Atacantes'), 'Delantero');
  assert.equal(mapPosicion('algo raro'), null);
});

test('util: parsePlayer maneja "Nombre (Club)" y "Nombre (Club, PAIS)"', () => {
  assert.deepEqual(parsePlayer('Maignan (AC Milan)'), { nombre: 'Maignan', club: 'AC Milan' });
  // Código país al final se descarta del club
  assert.deepEqual(parsePlayer('Vasilj (FC St. Pauli, ALE)'),
    { nombre: 'Vasilj', club: 'FC St. Pauli' });
  // Sin paréntesis → sólo nombre
  assert.deepEqual(parsePlayer('Mbappé'), { nombre: 'Mbappé' });
  // Punto final se limpia
  assert.deepEqual(parsePlayer('A (X).'), { nombre: 'A', club: 'X' });
});

test('util: parsePlayerList split respeta paréntesis y " y " final', () => {
  const out = parsePlayerList('A (X), B (Y) y C (Z)');
  assert.equal(out.length, 3);
  assert.equal(out[0].nombre, 'A');
  assert.equal(out[2].nombre, 'C');
  assert.equal(out[2].club, 'Z');
});

test('util: htmlToLines preserva block-level boundaries y decodifica entidades', () => {
  const html = '<article><h3>Bosnia</h3><p>Porteros: Vasilj (FC St. Pauli, ALE)</p><p>Bola&ntilde;o</p></article>';
  const lines = htmlToLines(html);
  assert.ok(lines.includes('Bosnia'));
  assert.ok(lines.some((l) => l.includes('Porteros: Vasilj')));
  // Entity decodificada
  assert.ok(lines.some((l) => l.includes('Bolaño')));
});

// ───────────────────────────────────────────────────────────────────────
// AS parser
// ───────────────────────────────────────────────────────────────────────

test('AS: parseHtml respeta contrato { source, byIso3 }', () => {
  const html = loadFixture('as.html');
  const out = asSrc.parseHtml(html);
  assert.equal(out.source, 'as');
  assert.ok(out.byIso3);
  assert.equal(typeof out.byIso3, 'object');
});

test('AS: extrae KOR, BIH y FRA con plantilla completa (fixture 18-may)', () => {
  const out = asSrc.parseHtml(loadFixture('as.html'));
  assert.ok(out.byIso3.KOR, 'KOR debe estar');
  assert.ok(out.byIso3.BIH, 'BIH debe estar');
  assert.ok(out.byIso3.FRA, 'FRA debe estar');

  // KOR: 3+10+10+3 = 26
  assert.equal(out.byIso3.KOR.players.length, 26);
  // Grupo A capturado
  assert.equal(out.byIso3.KOR.group, 'A');

  // BIH grupo B
  assert.equal(out.byIso3.BIH.group, 'B');
  // BIH: 3+8+10+5 = 26
  assert.equal(out.byIso3.BIH.players.length, 26);

  // FRA grupo I
  assert.equal(out.byIso3.FRA.group, 'I');
  // FRA: 3+9+5+9 = 26
  assert.equal(out.byIso3.FRA.players.length, 26);
});

test('AS: player schema = { nombre, posicion, club? } (sin extras)', () => {
  const out = asSrc.parseHtml(loadFixture('as.html'));
  const mbappe = out.byIso3.FRA.players.find((p) => p.nombre.includes('Mbapp'));
  assert.ok(mbappe);
  assert.equal(mbappe.posicion, 'Delantero');
  assert.equal(mbappe.club, 'Real Madrid');
  // No campos extra
  const allowedKeys = ['nombre', 'posicion', 'club', 'dorsal'];
  for (const k of Object.keys(mbappe)) {
    assert.ok(allowedKeys.includes(k), `Campo no permitido: ${k}`);
  }
});

test('AS: selecciones sin plantilla (México, RCheca) NO aparecen en byIso3 sin players', () => {
  const out = asSrc.parseHtml(loadFixture('as.html'));
  // México aparece como header pero sin <p> de jugadores
  // Aceptamos AMBOS: que esté con players=[] o que no esté.
  if (out.byIso3.MEX) {
    assert.equal(out.byIso3.MEX.players.length, 0);
  }
  if (out.byIso3.CZE) {
    assert.equal(out.byIso3.CZE.players.length, 0);
  }
});

test('AS: ignora "Grupo X" como header de selección', () => {
  const out = asSrc.parseHtml(loadFixture('as.html'));
  // Ninguna entry debe corresponder a un grupo
  for (const iso3 of Object.keys(out.byIso3)) {
    assert.ok(iso3.length === 3, `iso3 "${iso3}" no parece ISO 3166-1 alpha-3`);
  }
});

test('AS: entidades HTML decodificadas (Mbappé, Tchouaméni)', () => {
  const out = asSrc.parseHtml(loadFixture('as.html'));
  const mbappe = out.byIso3.FRA.players.find((p) => /Mbapp/i.test(p.nombre));
  assert.ok(mbappe, 'Mbappé debe existir');
  assert.ok(/é/.test(mbappe.nombre), `Esperaba "Mbappé", recibí "${mbappe.nombre}"`);
});

test('AS: fetchAndParse acepta `html` y devuelve metadata', async () => {
  const html = loadFixture('as.html');
  const r = await asSrc.fetchAndParse({ html, verbose: false });
  assert.equal(r.source, 'as');
  assert.ok(r.fetchedAt);
  assert.ok(r.byIso3.FRA);
});

// ───────────────────────────────────────────────────────────────────────
// Sport.es parser
// ───────────────────────────────────────────────────────────────────────

test('Sport: parseHtml devuelve source="sport" con misma lógica que AS', () => {
  const out = sportSrc.parseHtml(loadFixture('sport.html'));
  assert.equal(out.source, 'sport');
  assert.ok(out.byIso3.FRA);
  assert.ok(out.byIso3.BIH);
  assert.equal(out.byIso3.FRA.players.length, 26);
  assert.equal(out.byIso3.BIH.players.length, 26);
});

// ───────────────────────────────────────────────────────────────────────
// Olympics parser
// ───────────────────────────────────────────────────────────────────────

test('Olympics: extrae BIH con buckets Olympics-style (Arqueros/Defensores/Mediocampistas)', () => {
  const out = olympicsSrc.parseHtml(loadFixture('olympics.html'));
  assert.equal(out.source, 'olympics');
  assert.ok(out.byIso3.BIH);

  const bih = out.byIso3.BIH;
  // 3+9+9+5 = 26
  assert.equal(bih.players.length, 26);

  const porteros = bih.players.filter((p) => p.posicion === 'Portero');
  const defensas = bih.players.filter((p) => p.posicion === 'Defensa');
  const centros = bih.players.filter((p) => p.posicion === 'Centrocampista');
  const delanteros = bih.players.filter((p) => p.posicion === 'Delantero');
  assert.equal(porteros.length, 3);
  assert.equal(defensas.length, 9);
  assert.equal(centros.length, 9);
  assert.equal(delanteros.length, 5);

  // Entrenador capturado
  assert.equal(bih.coach, 'Sergej Barbarez');
});

test('Olympics: strip código país del club "FC St. Pauli, ALE" → "FC St. Pauli"', () => {
  const out = olympicsSrc.parseHtml(loadFixture('olympics.html'));
  const vasilj = out.byIso3.BIH.players.find((p) => /Vasilj/.test(p.nombre));
  assert.ok(vasilj);
  assert.equal(vasilj.club, 'FC St. Pauli');
});

test('Olympics: variante "República de Corea" → KOR', () => {
  const out = olympicsSrc.parseHtml(loadFixture('olympics.html'));
  assert.ok(out.byIso3.KOR, 'KOR debe estar (variante "República de Corea")');
  assert.equal(out.byIso3.KOR.players.length, 26);
});

test('Olympics: NO incluye países del calendario en byIso3 (corte en frontera)', () => {
  const out = olympicsSrc.parseHtml(loadFixture('olympics.html'));
  // Austria/Brasil/COD/Portugal/Australia/Croacia aparecen SOLO en el bloque
  // de calendario. NO deben aparecer en byIso3 como selecciones.
  assert.ok(!out.byIso3.AUT, 'AUT no debe estar (sólo en calendario)');
  assert.ok(!out.byIso3.BRA, 'BRA no debe estar (sólo en calendario)');
  assert.ok(!out.byIso3.POR, 'POR no debe estar (sólo en calendario)');
  assert.ok(!out.byIso3.CRO, 'CRO no debe estar (sólo en calendario)');
});

test('Olympics: jugadores SIN paréntesis (sólo nombre) se incluyen', () => {
  // En el fixture KOR hay jugadores con club abreviado, todos parsean OK
  const out = olympicsSrc.parseHtml(loadFixture('olympics.html'));
  const son = out.byIso3.KOR.players.find((p) => /\bSon\b/.test(p.nombre));
  assert.ok(son, 'Heung-min Son debe estar');
  assert.equal(son.posicion, 'Delantero');
});

test('Olympics: continuación huérfana de bucket se atribuye al lastBucket', () => {
  // Caso real BEL Olympics 18-may: "Defensas: ... Meunier," termina en coma
  // y los 3 jugadores finales viven en el siguiente <p> sin prefijo de bucket.
  const html = `<article>
    <h3>Bélgica</h3>
    <p>Porteros: Courtois, Lammens y Mike Penders</p>
    <p>Defensas: Castagne, Debast, De Cuyper, De Winter, Mechele, Meunier,</p>
    <p>Nathan Ngoy, Joaquín Seys y Teatro Arthur</p>
    <p>Centrocampistas: De Bruyne, Onana y Tielemans</p>
  </article>`;
  const out = olympicsSrc.parseHtml(html);
  // 3 porteros + 6 defensas + 3 continuación (también Defensa) + 3 centros = 15
  assert.equal(out.byIso3.BEL.players.length, 15);
  const defensas = out.byIso3.BEL.players.filter((p) => p.posicion === 'Defensa');
  assert.equal(defensas.length, 9, 'Defensas deben incluir continuación');
  assert.ok(defensas.find((p) => p.nombre === 'Nathan Ngoy'), 'Nathan Ngoy de continuación');
});

test('Olympics: prosa decorativa post-coach NO se interpreta como continuación', () => {
  // Caso real CUW Olympics 19-may: tras "Entrenador: Dick Advocaat*" aparece
  // una nota "*Regresa tras dos meses... y que con 78 años..." con comas y "y".
  // Sin la guard de trailing-comma + reset post-coach, esos 2 fragmentos
  // entraban como Delanteros falsos.
  const html = `<article>
    <h3>Curazao</h3>
    <p>Porteros: Eloy Room y Tyrick Bodak</p>
    <p>Delanteros: Tahith Chong, Kenji Gorré y Sontje Hansen</p>
    <p>Entrenador: Dick Advocaat*</p>
    <p>*Regresa tras dos meses de haber renunciado a su cargo y que con 78 años será histórico.</p>
    <h3>Croacia</h3>
    <p>Porteros: Dominik Livakovic, Dominik Kotarski y Ivor Pandur</p>
  </article>`;
  const out = olympicsSrc.parseHtml(html);
  assert.equal(out.byIso3.CUW.players.length, 5, 'CUW no debe absorber prosa post-coach');
  assert.equal(out.byIso3.CRO.players.length, 3);
});

test('Olympics: lastBucket se resetea al cambiar de selección (no leak)', () => {
  // Doble guard: aunque BEL terminara su bucket en coma, el cambio de país
  // resetea lastBucket → continuación queda neutralizada para FRA.
  const html = `<article>
    <h3>Bélgica</h3>
    <p>Delanteros: De Ketelaere, Doku, Lukaku,</p>
    <h3>Francia</h3>
    <p>Línea de prosa entre headers: Mbappé, Griezmann, Dembelé.</p>
  </article>`;
  const out = olympicsSrc.parseHtml(html);
  // BEL queda con 3 (no se le añaden X/Y/Z porque lastBucket se reseteó al cambiar header).
  assert.equal(out.byIso3.BEL.players.length, 3);
  // FRA: lastBucket=null para FRA → la línea "Mbappé..." se ignora.
  // (Aunque "Línea de prosa entre headers:" técnicamente matchea BUCKET_LINE_RE,
  //  el label "Línea" no resuelve en POSICION_MAP → detectBucketLine devuelve null.)
  const fraCount = out.byIso3.FRA ? out.byIso3.FRA.players.length : 0;
  assert.equal(fraCount, 0, 'FRA no debe heredar el bucket de BEL');
});

// ───────────────────────────────────────────────────────────────────────
// Eurosport.es parser
// ───────────────────────────────────────────────────────────────────────

test('Eurosport: parseHtml reusa lógica AS y devuelve source="eurosport"', () => {
  // Fixture mínimo inline (estructura validada 19-may en eurosport.es)
  const html = `<article>
    <p><b>• BÉLGICA</b></p>
    <p><b>Porteros:</b> Courtois (Real Madrid), Lammens (Antwerp) y Mike Penders (Genk)</p>
    <p><b>Defensas:</b> Castagne (Fulham), Debast (Sporting), De Cuyper (Brujas), De Winter (Juventus), Mechele (Brujas), Meunier (Lille), Ngoy (Hertha), Seys (Brujas) y Arthur (Sturm)</p>
    <p><b>Centrocampistas:</b> De Bruyne (Napoles), Onana (Aston Villa), Raskin (Rangers), Tielemans (Aston Villa), Vanaken (Brujas) y Witsel (Girona)</p>
    <p><b>Delanteros:</b> De Ketelaere (Atalanta), Doku (Man. City), Fernández Pardo (Lille), Lukaku (Napoles), Lukebakio (Sevilla), Moreira (Estrasburgo), Saelemaekers (Milan) y Trossard (Arsenal)</p>
  </article>`;
  const out = eurosportSrc.parseHtml(html);
  assert.equal(out.source, 'eurosport');
  assert.ok(out.byIso3.BEL);
  assert.equal(out.byIso3.BEL.players.length, 26);
});
