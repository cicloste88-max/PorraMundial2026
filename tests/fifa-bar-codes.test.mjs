// Item 8 post-J1 — banner FIFA: nombres largos rompían el carrusel.
//
// carouselSlideHTML (mundial-shell-v3.js) pintaba home_es/away_es completos:
// "República de Corea" vs "República Checa" truncaba ilegible junto al
// countdown a 360px. Ahora códigos ISO3 (KOR-CZE) vía window.PCShared.codeFor
// (comunidad-shared-v3, mismo helper que porra-jugador-v3) con fallback inline
// a EQUIPOS por nombre (PCShared carga DESPUÉS de mundial-shell en main-entry)
// y 3 letras en último término. Aplica a AMBOS estados del slide (countdown y
// EN VIVO): home/away son comunes a las dos ramas.

import assert from 'node:assert';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';

const SRC = readFileSync(new URL('../public/js/v3/mundial-shell-v3.js', import.meta.url), 'utf8');

function extractFn(name) {
  const start = SRC.indexOf(`function ${name}(`);
  assert.ok(start > -1, `función ${name} no encontrada`);
  const end = SRC.indexOf('\n  }', start);
  return SRC.slice(start, end + 4);
}

function makeSlide(win, equipos) {
  const factory = new Function('window', 'EQUIPOS', 'madridHM', `
    ${extractFn('teamCode')}
    ${extractFn('carouselSlideHTML')}
    return carouselSlideHTML;
  `);
  return factory(win, equipos, () => ({ h: '02', m: '00' }));
}

const EQUIPOS_FIXTURE = [
  { name: 'República de Corea', flag: 'KOR' },
  { name: 'República Checa', flag: 'CZE' },
];
const KOR_CZE = { home_es: 'República de Corea', away_es: 'República Checa', date_utc_ms: 1781229600000 };

test('countdown: códigos ISO3 en vez de nombres completos', () => {
  const html = makeSlide({ PCShared: { codeFor: (n) => (n.includes('Corea') ? 'KOR' : 'CZE') } }, [])(KOR_CZE);
  assert.ok(html.includes('>KOR<') && html.includes('>CZE<'));
  assert.ok(!html.includes('República'));
});

test('estado EN VIVO: también códigos', () => {
  const html = makeSlide({ PCShared: { codeFor: (n) => (n.includes('Corea') ? 'KOR' : 'CZE') } }, [])(
    { ...KOR_CZE, isLive: true },
  );
  assert.ok(html.includes('EN VIVO'));
  assert.ok(html.includes('>KOR<') && html.includes('>CZE<'));
  assert.ok(!html.includes('República'));
});

test('fallback sin PCShared (carga posterior en main-entry): EQUIPOS por nombre → flag', () => {
  const html = makeSlide({}, EQUIPOS_FIXTURE)(KOR_CZE);
  assert.ok(html.includes('>KOR<') && html.includes('>CZE<'));
});

test('último fallback: 3 primeras letras en mayúscula', () => {
  const html = makeSlide({}, [])({ home_es: 'Atlantis', away_es: 'Wakanda', date_utc_ms: 0 });
  assert.ok(html.includes('>ATL<') && html.includes('>WAK<'));
});
