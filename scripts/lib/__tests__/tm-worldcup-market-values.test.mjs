// scripts/lib/__tests__/tm-worldcup-market-values.test.mjs
// Test del parseRow contra fixture real Nuno Mendes capturado 20-may-2026
// del HTML de transfermarkt.es/weltmeisterschaft/marktwertaenderungen page 40.

import { test } from 'node:test';
import { strict as assert } from 'node:assert';
import { parseRow } from '../tm-worldcup-market-values.mjs';

// Fixture A: Nuno Mendes (page 40, marktwertaenderungen).
// Layout marktwert: la fila tiene una <a title="País"> (nación) seguida de
// <a title="Club"> — extractClubLink usa skip:1.
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
  assert.ok(p, 'player no debe ser null');
  assert.equal(p.tm_player_id, 616341);
  assert.equal(p.name, 'Nuno Mendes');
  assert.equal(p.position_tm, 'Lateral izquierdo');
  assert.equal(p.nation_name, 'Portugal');
  assert.equal(p.iso3, 'POR');
  assert.equal(p.verein_id, 3300);
  assert.equal(p.age, 23);
  assert.equal(p.club, 'París Saint-Germain FC');
  assert.equal(p.club_id, 583);
  assert.equal(
    p.club_logo_url,
    'https://tmssl.akamaized.net/images/wappen/verysmall/583.png'
  );
  assert.equal(p.value_eur, 75_000_000);
  assert.equal(
    p.photo_url_tm,
    'https://img.a.transfermarkt.technology/portrait/medium/616341-1749417164.jpg'
  );
});

test('parseRow con iso3 desconocido devuelve player sin descartar', () => {
  // Modificamos el fixture cambiando "Portugal" por "Atlántida" para simular
  // selección sin mapping en tm-nation-map.json.
  const fake = NUNO_FIXTURE.replace('title="Portugal"', 'title="Atlántida"');
  const p = parseRow(fake);
  assert.ok(p, 'player no debe ser null');
  assert.equal(p.iso3, null);
  assert.equal(p.nation_name, 'Atlántida');
  assert.equal(p.tm_player_id, 616341); // sigue siendo util para ID-first
});

test('parseRow sin perfil devuelve null', () => {
  const noProfile = `<tr class="odd"><td>nada relevante</td></tr>`;
  assert.equal(parseRow(noProfile), null);
});
