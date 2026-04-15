# Mejoras vista Jornada
# Ficheros: index.html (CSS), public/js/ui-groups.js
# 1 commit

---

## CAMBIOS VISUALES Y FUNCIONALES

### 1. Clasificación: única, sticky, no repetida por jornada
### 2. Tarjetas más anchas con texto más grande, estadio+hora centrados, sin "Local A"
### 3. Pts boost: número solo + "PTS Posibles" abajo (sin la X)
### 4. CTA boost: cuando todos asignados → muestra lista editable con check verde

---

## A · `index.html` — reemplazar bloque CSS de jornada

BUSCAR el bloque completo desde:
```css
/* ── Vista Jornada ── */
#jornada-container{display:none}
```
hasta el cierre de:
```css
.jornada-sidebar{
  position:sticky;top:80px;
}
```
y todo lo que sigue hasta la próxima regla CSS que no sea de jornada.

REEMPLAZAR TODO ese bloque por:
```css
/* ── Vista Jornada ── */
#jornada-container{display:none}
.jornada-wrap{
  display:grid;
  grid-template-columns:1fr 260px;
  gap:20px;
  align-items:start;
}
@media(max-width:900px){.jornada-wrap{grid-template-columns:1fr}}
.jornada-main{min-width:0;}
.jornada-section{margin-bottom:28px}
.jornada-header{
  display:flex;align-items:center;gap:10px;
  margin-bottom:12px;padding-bottom:8px;
  border-bottom:1px solid #1e293b;
}
.jornada-label{
  font-family:'Inter Tight',sans-serif;font-size:15px;font-weight:900;
  color:#fff;letter-spacing:-.01em;
}
.jornada-date{font-size:11px;color:#6b7280;}
.jornada-boost-badge{
  font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;
  background:rgba(124,45,18,.4);color:#fb923c;
  border:1px solid rgba(234,88,12,.3);margin-left:auto;
  cursor:pointer;
}
.jornada-boost-badge.done{
  background:rgba(5,46,22,.4);color:#4ade80;
  border-color:rgba(74,222,128,.3);
}
/* Sidebar única fija */
.jornada-sidebar{
  position:sticky;top:72px;
  grid-row:1/99; /* ocupa todas las filas del grid */
}
.jornada-ranking{
  background:#1c1c1e;border-radius:14px;border:1px solid #27272a;
  padding:14px;
}
.jornada-ranking-title{
  font-size:11px;font-weight:700;color:#6b7280;text-transform:uppercase;
  letter-spacing:.06em;margin-bottom:10px;
}
.jrank-row{
  display:flex;align-items:center;gap:8px;
  padding:6px 0;border-bottom:1px solid #1a1a1c;
}
.jrank-row:last-child{border-bottom:none;}
.jrank-pos{font-size:11px;font-weight:700;color:#6b7280;min-width:16px;text-align:center;}
.jrank-pos.top{color:#fbbf24;}
.jrank-avatar{
  width:26px;height:26px;border-radius:50%;
  background:#27272a;display:flex;align-items:center;justify-content:center;
  font-size:11px;font-weight:700;color:#fff;flex-shrink:0;
}
.jrank-name{flex:1;font-size:12px;font-weight:500;color:#e4e4e7;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;}
.jrank-pts{font-size:13px;font-weight:900;color:#4ade80;font-family:'Inter Tight',sans-serif;}
.jrank-me{background:rgba(74,222,128,.06);border-radius:8px;margin:0 -4px;padding:0 4px;}
/* Tarjeta compacta */
.jcard{
  background:#1c1c1e;border-radius:12px;
  border:1px solid #27272a;
  overflow:hidden;position:relative;
  transition:border-color .2s,box-shadow .2s;
  margin-bottom:8px;
}
.jcard:hover{border-color:#3a3a3e;box-shadow:0 4px 20px rgba(0,0,0,.4)}
.jcard.boost-active{border-color:rgba(234,88,12,.5);box-shadow:0 0 12px rgba(234,88,12,.15);}
.jcard-main{
  display:grid;
  grid-template-columns:4px 1fr auto;
  min-height:80px;
}
.jcard-stripe{width:4px;background:var(--gc,#4ade80);opacity:.5;flex-shrink:0;}
.jcard-body{padding:10px 14px;display:flex;flex-direction:column;gap:6px;min-width:0;}
/* Fila equipos */
.jcard-teams-row{
  display:flex;align-items:center;gap:8px;
}
.jcard-team{
  display:flex;align-items:center;gap:6px;flex:1;min-width:0;
}
.jcard-team-name{
  font-size:14px;font-weight:700;color:#e4e4e7;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
.jcard-vs{
  font-size:11px;font-weight:600;color:#4b5563;
  flex-shrink:0;padding:0 4px;
}
.jcard-flag{width:20px;height:20px;border-radius:50%;overflow:hidden;border:1px solid rgba(255,255,255,.15);flex-shrink:0;}
.jcard-flag img{width:100%;height:100%;object-fit:cover;}
/* Score entre los equipos */
.jcard-score-wrap{
  display:flex;align-items:center;gap:4px;flex-shrink:0;margin:0 10px;
}
.jcard-score{
  font-family:'Inter Tight',sans-serif;font-size:22px;font-weight:900;
  color:#4ade80;min-width:22px;text-align:center;line-height:1;
}
.jcard-score.pending{color:#3a3a3e;}
.jcard-score-sep{color:#3a3a3e;font-size:16px;margin:0 2px;}
/* Info estadio+hora */
.jcard-venue{
  font-size:10px;color:#4b5563;
  display:flex;align-items:center;gap:6px;
  white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
}
/* Chips */
.jcard-chips{display:flex;gap:4px;flex-wrap:wrap;}
.jcard-chip{font-size:9px;font-weight:600;padding:1px 6px;border-radius:10px;background:rgba(255,255,255,.05);color:#4b5563;}
.jcard-chip.on{background:rgba(74,222,128,.12);color:#4ade80;}
/* Columna de pts */
.jcard-pts{
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:0 16px;border-left:1px solid #27272a;min-width:70px;flex-shrink:0;
}
.jcard-pts-num{
  font-family:'Inter Tight',sans-serif;font-size:26px;font-weight:900;
  color:#4ade80;line-height:1;
}
.jcard-pts-num.pending{color:#3a3a3e;}
.jcard-pts-num.boost{color:#fb923c;}
.jcard-pts-label{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-top:3px;text-align:center;}
/* Boost row */
.jcard-boost{
  display:flex;align-items:center;gap:8px;
  padding:5px 14px 7px;
  border-top:1px solid #222;
  background:rgba(0,0,0,.15);
}
.jcard-boost.active{background:rgba(28,14,6,.7);}
```

---

## B · `public/js/ui-groups.js` — 3 cambios

### B1 · renderVistaJornada: layout único con sidebar a la derecha

BUSCAR exactamente la función `_renderVistaJornadaSync` (o `renderVistaJornada` si no se aplicó el split):

Dentro de ella, BUSCAR el bloque que genera el HTML completo:
```js
  let html = '';
  dias.forEach((date, dIdx) => {
```

Y al inicio de la función, ANTES del `let html = ''`, INSERTAR:
```js
  // Wrapper con sidebar única a la derecha
  const sidebarHtml = _buildJornadaRanking();
```

Luego BUSCAR:
```js
  let html = '';
  dias.forEach((date, dIdx) => {
    const jNum = dIdx + 1;
    const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
    const boostKey  = boostPicks[date];
    const boostDone = !!boostKey;
    const badgeCls  = boostDone ? 'jornada-boost-badge done' : 'jornada-boost-badge';
    const badgeTxt  = boostDone ? '🔥 Boost asignado' : '🔥 Boost pendiente';

    html += '<div class="jornada-section" id="jornada-' + date + '">';
    html += '<div class="jornada-header">';
    html += '<span class="jornada-label">J' + jNum + '</span>';
    html += '<span class="jornada-date">' + dayLabel + '</span>';
    html += '<span class="' + badgeCls + '">' + badgeTxt + '</span>';
    html += '</div>';

    // Layout: tarjetas + sidebar ranking
    html += '<div class="jornada-layout">';
    html += '<div class="jornada-cards">';

    jornadasMap[date].forEach(({ m, idx }) => {
      html += _buildJCard(m, idx, date, boostKey);
    });

    html += '</div>'; // jornada-cards
    html += '<div class="jornada-sidebar">' + _buildJornadaRanking() + '</div>';
    html += '</div>'; // jornada-layout
    html += '</div>'; // jornada-section
  });

  container.innerHTML = html;
```

REEMPLAZAR POR:
```js
  let sectionsHtml = '';
  dias.forEach((date, dIdx) => {
    const jNum = dIdx + 1;
    const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('es-ES', {
      weekday: 'long', day: 'numeric', month: 'long'
    });
    const boostKey  = boostPicks[date];
    const boostDone = !!boostKey;
    const badgeCls  = boostDone ? 'jornada-boost-badge done' : 'jornada-boost-badge';
    const badgeTxt  = boostDone ? '✅ Boost asignado' : '🔥 Pendiente';

    sectionsHtml += '<div class="jornada-section" id="jornada-' + date + '">';
    sectionsHtml += '<div class="jornada-header">';
    sectionsHtml += '<span class="jornada-label">J' + jNum + '</span>';
    sectionsHtml += '<span class="jornada-date">' + dayLabel + '</span>';
    sectionsHtml += '<span class="' + badgeCls + '">' + badgeTxt + '</span>';
    sectionsHtml += '</div>';

    jornadasMap[date].forEach(({ m, idx }) => {
      sectionsHtml += _buildJCard(m, idx, date, boostKey);
    });

    sectionsHtml += '</div>'; // jornada-section
  });

  // Layout: columna de jornadas + sidebar única sticky
  container.innerHTML =
    '<div class="jornada-wrap">' +
      '<div class="jornada-main">' + sectionsHtml + '</div>' +
      '<div class="jornada-sidebar">' + sidebarHtml + '</div>' +
    '</div>';
```

### B2 · _buildJCard: rediseño completo

BUSCAR la función completa:
```js
function _buildJCard(m, idx, date, boostKey) {
```

REEMPLAZAR TODO el cuerpo de la función (hasta su `}` de cierre) por:
```js
function _buildJCard(m, idx, date, boostKey) {
  const matchKey = getMatchKey(m);
  const pred = predictions[matchKey] || {};
  const isBoost = boostKey === matchKey;

  // Equipos y banderas
  const hTeam = EQUIPOS.find(e => e.name === m.home);
  const aTeam = EQUIPOS.find(e => e.name === m.away);
  const hFlag = hTeam ? SB + '/flags/' + hTeam.flag + '.png' : '';
  const aFlag = aTeam ? SB + '/flags/' + aTeam.flag + '.png' : '';

  // Estado del pronóstico
  const hasScore = pred.l !== null && pred.l !== undefined && pred.v !== null && pred.v !== undefined;

  // Marcador pronosticado
  const lTxt = hasScore ? pred.l : '—';
  const vTxt = hasScore ? pred.v : '—';
  const scoreCls = hasScore ? 'jcard-score' : 'jcard-score pending';

  // Chips
  const ia = iaPredictions[matchKey];
  const mySign = getMySign(pred);
  const showIA = hasScore && ia && mySign && mySign !== ia.sign;
  const chips =
    (hasScore ? '<span class="jcard-chip on">1X2</span>' : '<span class="jcard-chip">1X2</span>') +
    (hasScore ? '<span class="jcard-chip on">Exacto</span>' : '') +
    (pred.gol ? '<span class="jcard-chip on">⚽ ' + pred.gol + '</span>' : '') +
    (showIA   ? '<span class="jcard-chip on">vs IA</span>' : '');

  // Pts posibles
  let maxPts = 0;
  if (hasScore) {
    maxPts = 4;
    if (pred.gol) maxPts += 2;
    if (showIA)   maxPts += 1;
  }
  const ptsVal  = isBoost ? maxPts * 2 : maxPts;
  const ptsCls  = isBoost ? 'jcard-pts-num boost' : (maxPts > 0 ? 'jcard-pts-num' : 'jcard-pts-num pending');
  const ptsDisp = ptsVal || '—';

  // Hora y estadio
  const hora = new Date(m.date).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'});
  const stadium = m.stadium ? m.stadium.replace(' Stadium','').replace(' Estadio','') : '';

  // Color lateral por grupo
  const gc = {A:'#4ade80',B:'#60a5fa',C:'#f472b6',D:'#fb923c',E:'#a78bfa',
    F:'#34d399',G:'#fbbf24',H:'#f87171',I:'#38bdf8',J:'#c084fc',K:'#86efac',L:'#fcd34d'}[m.group] || '#4ade80';

  // Boost row
  const chkChecked = isBoost ? 'checked' : '';
  const boostRowCls = isBoost ? 'jcard-boost active' : 'jcard-boost';
  const boostLabel  = isBoost
    ? '<span style="font-size:11px;color:#fb923c;font-weight:600">🔥 Boost activo</span>'
    : '<span style="font-size:11px;color:#6b7280">🔥 Boost a este partido</span>';

  return (
    '<div class="jcard' + (isBoost ? ' boost-active' : '') + '" id="jcard-' + idx + '">' +
      '<div class="jcard-main">' +
        '<div class="jcard-stripe" style="--gc:' + gc + ';background:' + gc + '"></div>' +
        '<div class="jcard-body">' +
          // Fila equipos con marcador en medio
          '<div class="jcard-teams-row">' +
            '<div class="jcard-team">' +
              '<div class="jcard-flag"><img src="' + hFlag + '" loading="lazy"></div>' +
              '<span class="jcard-team-name">' + m.home + '</span>' +
            '</div>' +
            '<div class="jcard-score-wrap">' +
              '<span class="' + scoreCls + '">' + lTxt + '</span>' +
              '<span class="jcard-score-sep">:</span>' +
              '<span class="' + scoreCls + '">' + vTxt + '</span>' +
            '</div>' +
            '<div class="jcard-team" style="justify-content:flex-end">' +
              '<span class="jcard-team-name" style="text-align:right">' + m.away + '</span>' +
              '<div class="jcard-flag"><img src="' + aFlag + '" loading="lazy"></div>' +
            '</div>' +
          '</div>' +
          // Estadio y hora centrados
          '<div class="jcard-venue">' +
            '<span>🏟️ ' + stadium + '</span>' +
            '<span style="color:#3a3a3e">·</span>' +
            '<span>⏰ ' + hora + '</span>' +
            '<span style="color:#3a3a3e">·</span>' +
            '<span style="color:#4b5563">Grupo ' + m.group + '</span>' +
          '</div>' +
          // Chips
          (chips ? '<div class="jcard-chips">' + chips + '</div>' : '') +
        '</div>' +
        // Columna pts
        '<div class="jcard-pts">' +
          '<div class="' + ptsCls + '">' + ptsDisp + '</div>' +
          '<div class="jcard-pts-label">' + (isBoost ? 'PTS ×2' : 'PTS posibles') + '</div>' +
        '</div>' +
      '</div>' +
      // Boost row
      '<div class="' + boostRowCls + '">' +
        '<input type="checkbox" ' + chkChecked + ' ' +
          'onchange="jcardBoostToggle(\'' + matchKey + '\',\'' + date + '\',this)" ' +
          'style="width:16px;height:16px;accent-color:#ea580c;cursor:pointer;flex-shrink:0">' +
        boostLabel +
        '<button onclick="scrollToMatchCard(\'' + matchKey + '\')" ' +
          'style="margin-left:auto;font-size:10px;color:#4b5563;background:none;border:none;' +
          'cursor:pointer;padding:2px 8px;border-radius:6px;border:1px solid #27272a;' +
          'transition:all .15s" ' +
          'onmouseover="this.style.borderColor=\'#4ade80\';this.style.color=\'#4ade80\'" ' +
          'onmouseout="this.style.borderColor=\'#27272a\';this.style.color=\'#4b5563\'">↓ Ver tarjeta</button>' +
      '</div>' +
    '</div>'
  );
}
```

### B3 · checkGroupsComplete: CTA boost — estado "todos asignados" editable

BUSCAR exactamente:
```js
          boostPendingEl.style.display = 'flex';
          const label = '<span style="font-size:11px;font-weight:700;color:#fb923c;white-space:nowrap;flex-shrink:0">🔥 Boosts pendientes:</span>';
          const pills = pendientes.map(d => {
```

REEMPLAZAR todo el bloque hasta el `boostPendingEl.innerHTML = label + pills + panelHtml;` por:

```js
          boostPendingEl.style.display = 'flex';

          if (pendientes.length === 0) {
            // Todos los boosts asignados — mostrar estado "completo" editable
            const asignados = diasConPartidos.map(d => {
              const mKey = boostPicks[d];
              const match = PARTIDOS.find(m => getMatchKey(m) === mKey);
              const jNum = diasConPartidos.indexOf(d) + 1;
              const label = match
                ? match.home.split(' ')[0] + ' vs ' + match.away.split(' ')[0]
                : '?';
              return '<button onclick="ctaExpandJornada(\'' + d + '\')" style="' +
                'display:inline-flex;align-items:center;gap:4px;' +
                'padding:3px 10px;border-radius:20px;font-size:10px;font-weight:600;' +
                'border:1px solid rgba(74,222,128,.3);' +
                'background:rgba(5,46,22,.3);color:#4ade80;' +
                'cursor:pointer;white-space:nowrap;' +
                '">✅ J' + jNum + ' · ' + label + '</button>';
            }).join('');

            const panelHtml = (openDate && existingPanel)
              ? '<div id="cta-boost-panel" data-date="' + openDate + '" style="width:100%;margin-top:8px;padding:8px;border-top:1px solid rgba(74,222,128,.15);flex-wrap:wrap;gap:6px;align-items:center;display:flex">' + existingPanel.innerHTML + '</div>'
              : '';

            boostPendingEl.innerHTML =
              '<span style="font-size:11px;font-weight:700;color:#4ade80;white-space:nowrap;flex-shrink:0">✅ Boosts completos — editar:</span>' +
              asignados + panelHtml;

          } else {
            // Quedan boosts pendientes
            const label = '<span style="font-size:11px;font-weight:700;color:#fb923c;white-space:nowrap;flex-shrink:0">🔥 Boosts pendientes:</span>';
            const pills = pendientes.map(d => {
              const dayLabel = new Date(d + 'T12:00:00').toLocaleDateString('es-ES', {day:'numeric', month:'short'});
              const nM = PARTIDOS.filter(m => m.date?.substring(0,10) === d).length;
              const jNum = diasConPartidos.indexOf(d) + 1;
              return '<button onclick="ctaExpandJornada(\'' + d + '\')" style="' +
                'display:inline-flex;align-items:center;gap:4px;' +
                'padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;' +
                'border:1.5px solid rgba(234,88,12,.5);' +
                'background:rgba(124,45,18,.35);color:rgb(251,146,60);' +
                'cursor:pointer;white-space:nowrap;' +
                'animation:boostPulse 1.5s ease-in-out infinite;' +
                '">🔥 J' + jNum + ' · ' + dayLabel + ' (' + nM + ')</button>';
            }).join('');

            const panelHtml = (openDate && existingPanel)
              ? '<div id="cta-boost-panel" data-date="' + openDate + '" style="width:100%;margin-top:8px;padding:8px;border-top:1px solid rgba(124,45,18,.3);flex-wrap:wrap;gap:6px;align-items:center;display:flex">' + existingPanel.innerHTML + '</div>'
              : '';

            boostPendingEl.innerHTML = label + pills + panelHtml;
          }
```

Y eliminar la línea suelta que quedaba antes:
```js
          boostPendingEl.innerHTML = label + pills + panelHtml;
```
(ya está incluida en el nuevo bloque de arriba, ya no debe existir suelta)

---

## Verificación
```bash
node --check public/js/ui-groups.js && echo "ui-groups OK"
npm run build 2>&1 | tail -3
```

Comprobar en localhost:5173:
1. Vista Jornada: una sola clasificación a la derecha sticky
2. Tarjetas: equipos grandes, marcador centrado, estadio+hora, sin "Local A"
3. Pts: número grande + "PTS posibles" o "PTS ×2" abajo, sin X
4. CTA cuando todos los boosts asignados: pastillas verdes "✅ J1 · México vs Sudan"

## Commit
```bash
git add index.html public/js/ui-groups.js
git commit -m "feat: vista Jornada rediseño — jcards anchas, sidebar única sticky, boost CTA editable"
git push origin main
```
