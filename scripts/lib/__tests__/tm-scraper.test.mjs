// scripts/lib/__tests__/tm-scraper.test.mjs
// Test parseKaderTable refactor contra fixture real Joan García capturado
// 20-may-2026 del HTML de transfermarkt.es/spanien/kader/verein/3375/plus/1.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseKaderTable } from '../tm-scraper.mjs';

// Fixture B: Joan García (España, portero, dorsal 18, 25 años, 40M €).
// Layout kader: la fila NO tiene <a title="País"> (es página de un solo
// equipo), sólo hay UN <a title="Club"> — extractClubLink usa skip:0.
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
  assert.equal(
    j.club_logo_url,
    'https://tmssl.akamaized.net/images/wappen/verysmall/131.png'
  );
  assert.equal(
    j.foto_url_tm,
    'https://img.a.transfermarkt.technology/portrait/medium/561613-1747386081.jpg'
  );
});

test('parseKaderTable devuelve array vacío para HTML sin tablas', () => {
  assert.deepEqual(parseKaderTable('<div>nada</div>'), []);
});
