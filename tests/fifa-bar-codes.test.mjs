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

// N2: el slide usa remainingHM REAL (cuenta atrás) + nowMs inyectado.
function makeSlide(win, equipos, nowMsValue) {
  const factory = new Function('window', 'EQUIPOS', 'remainingHM', 'nowMs', `
    ${extractFn('carouselSlideHTML').replace("function carouselSlideHTML", "function carouselSlideHTML")}
    ${extractFn('teamCode')}
    return carouselSlideHTML;
  `);
  const remainingHM = new Function(`
    function pad2(n) { return String(n).padStart(2, '0'); }
    ${extractFn('remainingHM')}
    return remainingHM;
  `)();
  return factory(win, equipos, remainingHM, () => (nowMsValue ?? 0));
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

// ─── N2 post-J1: countdown real contra date_utc (captura San 03:35 Madrid) ───

test('N2: a 25 min del kickoff de madrugada muestra 00 h 25 min — NUNCA la hora del kickoff (04 00)', () => {
  // KOR-CZE kickoff 02:00Z (04:00 Madrid) = 1781229600000; now = 01:35Z.
  const html = makeSlide({ PCShared: { codeFor: () => 'KOR' } }, [], 1781228100000)(KOR_CZE);
  assert.ok(html.includes('>00</span><span class="v3-cd-lbl">h<'));
  assert.ok(html.includes('>25</span><span class="v3-cd-lbl">min<'));
  assert.ok(!html.includes('>04</span>'));
});

test('N2: faltan 3h12m → 03 h 12 min; kickoff vencido → clamp 00 h 00 min', () => {
  const now3h = KOR_CZE.date_utc_ms - (3 * 60 + 12) * 60000;
  const html = makeSlide({ PCShared: { codeFor: () => 'KOR' } }, [], now3h)(KOR_CZE);
  assert.ok(html.includes('>03<') && html.includes('>12<'));
  const past = makeSlide({ PCShared: { codeFor: () => 'KOR' } }, [], KOR_CZE.date_utc_ms + 60000)(KOR_CZE);
  assert.ok(past.includes('>00</span><span class="v3-cd-lbl">h<') && past.includes('>00</span><span class="v3-cd-lbl">min<'));
});

test('N2 wiring: la key del slide incluye los minutos restantes (re-render 1/min pese al dedup)', () => {
  assert.match(SRC, /match\.key \+ \(isLive \? ':live' : ':t' \+ remainingHM\(match\.date_utc_ms, n\)\.totalMin\)/);
});
