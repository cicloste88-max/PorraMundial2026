# Vista Jornada + fix panel CTA
# 3 ficheros: index.html, public/js/ui-groups.js, css/boost.css (nuevo: jornada.css)
# 1 commit

---

## PROBLEMA 1 — Panel CTA inferior se cierra solo

**Causa:** `setInterval` en `initGrupos` llama `checkGroupsComplete` cada 1s,
que hace `boostPendingEl.innerHTML = ...` destruyendo el panel hijo `#cta-boost-panel`.

**Fix:** guardar estado del panel antes de re-renderizar y restaurarlo.

### Fix en `public/js/ui-groups.js` — checkGroupsComplete, bloque CTA inferior

BUSCAR exactamente:
```js
      const boostPendingEl = document.getElementById('cta-boost-pending');
      if(boostPendingEl && filled >= total) {
        const pendientes = diasConPartidos.filter(d => !boostPicks[d]);
        if(pendientes.length > 0) {
          boostPendingEl.style.display = 'flex';
          boostPendingEl.innerHTML =
```

REEMPLAZAR solo la línea `boostPendingEl.innerHTML =` y todo lo que la sigue hasta el `join('')` por esta versión que preserva el panel abierto:

```js
      const boostPendingEl = document.getElementById('cta-boost-pending');
      if(boostPendingEl && filled >= total) {
        const pendientes = diasConPartidos.filter(d => !boostPicks[d]);
        if(pendientes.length > 0) {
          // Guardar qué jornada tiene el panel expandido antes de re-renderizar
          const openDate = document.getElementById('cta-boost-panel')?.dataset.date || null;

          boostPendingEl.style.display = 'flex';
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

          // Mantener el panel expandido si estaba abierto
          const existingPanel = document.getElementById('cta-boost-panel');
          const panelHtml = (openDate && existingPanel)
            ? '<div id="cta-boost-panel" data-date="' + openDate + '" style="width:100%;margin-top:8px;padding:8px;border-top:1px solid rgba(124,45,18,.3);flex-wrap:wrap;gap:6px;align-items:center;display:flex">' + existingPanel.innerHTML + '</div>'
            : '';

          boostPendingEl.innerHTML = label + pills + panelHtml;
```

---

## PROBLEMA 2 — Vista Jornada: nueva pestaña en barra superior

### A · `index.html` — 3 cambios

#### A1 · Añadir selector de vista (Fase de grupos | Jornada) en global-header

BUSCAR exactamente:
```html
      <div id="grupos-user-bar"></div>
    </div>
  </div>
```

REEMPLAZAR POR:
```html
      <div id="grupos-user-bar"></div>
    </div>
  </div>
  <!-- Selector vista grupos/jornada -->
  <div style="display:flex;gap:4px;background:#111318;border:1px solid #27272a;border-radius:10px;padding:3px;margin-bottom:12px">
    <button id="btn-vista-grupos"
      onclick="setVistaGrupos('grupos')"
      style="flex:1;padding:6px 16px;border-radius:8px;border:none;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;font-family:'Inter',sans-serif;background:#27272a;color:#fff">
      ⚽ Fase de grupos
    </button>
    <button id="btn-vista-jornada"
      onclick="setVistaGrupos('jornada')"
      style="flex:1;padding:6px 16px;border-radius:8px;border:none;font-size:12px;font-weight:600;cursor:pointer;transition:all .2s;font-family:'Inter',sans-serif;background:transparent;color:#6b7280">
      📅 Jornada
    </button>
  </div>
```

#### A2 · Añadir contenedor de vista jornada junto a groups-container

BUSCAR exactamente:
```html
  <div id="groups-container" style="min-height:400px"></div>
```

REEMPLAZAR POR:
```html
  <div id="groups-container" style="min-height:400px"></div>
  <!-- Vista jornada -->
  <div id="jornada-container" style="display:none;min-height:400px"></div>
```

#### A3 · Añadir CSS para las tarjetas compactas de jornada — en el `<style>` inline

BUSCAR exactamente:
```css
@keyframes boostPulse{0%,100%{box-shadow:0 0 0 0 rgba(234,88,12,.5)}60%{box-shadow:0 0 0 5px rgba(234,88,12,0)}}
```

INSERTAR DESPUÉS:
```css
/* ── Vista Jornada ── */
#jornada-container{display:none}
.jornada-section{margin-bottom:32px}
.jornada-header{
  display:flex;align-items:center;gap:10px;
  margin-bottom:14px;padding-bottom:10px;
  border-bottom:1px solid #1e293b;
}
.jornada-label{
  font-family:'Inter Tight',sans-serif;font-size:16px;font-weight:900;
  color:#fff;letter-spacing:-.01em;
}
.jornada-date{font-size:12px;color:#6b7280;}
.jornada-boost-badge{
  font-size:10px;font-weight:700;padding:2px 8px;border-radius:20px;
  background:rgba(124,45,18,.4);color:#fb923c;
  border:1px solid rgba(234,88,12,.3);margin-left:auto;
}
.jornada-boost-badge.done{background:rgba(5,46,22,.4);color:#4ade80;border-color:rgba(74,222,128,.3);}
/* Layout jornada: tarjetas compactas + sidebar clasificación */
.jornada-layout{
  display:grid;
  grid-template-columns:1fr 280px;
  gap:20px;
  align-items:start;
}
@media(max-width:900px){.jornada-layout{grid-template-columns:1fr}}
/* Tarjeta compacta de partido */
.jcard{
  background:#1c1c1e;border-radius:14px;
  border:1px solid #27272a;
  overflow:hidden;position:relative;
  transition:border-color .2s;
  margin-bottom:10px;
}
.jcard.boost-active{border-color:rgba(234,88,12,.6);}
.jcard-inner{display:flex;align-items:stretch;min-height:72px;}
/* Franja lateral de color de grupo */
.jcard-group{
  width:6px;flex-shrink:0;
  background:linear-gradient(to bottom,#4ade80,#166534);
}
/* Info del partido */
.jcard-match{
  flex:1;display:flex;align-items:center;gap:10px;
  padding:10px 12px;
}
.jcard-teams{flex:1;}
.jcard-team-row{
  display:flex;align-items:center;gap:6px;
  font-size:12px;font-weight:600;color:#e4e4e7;
  margin-bottom:3px;
}
.jcard-team-row:last-child{margin-bottom:0;}
.jcard-flag{width:16px;height:16px;border-radius:50%;overflow:hidden;border:1px solid rgba(255,255,255,.15);flex-shrink:0;}
.jcard-flag img{width:100%;height:100%;object-fit:cover;}
.jcard-score{
  font-family:'Inter Tight',sans-serif;
  font-size:18px;font-weight:900;
  color:#4ade80;min-width:24px;text-align:center;
  flex-shrink:0;
}
.jcard-score.pending{color:#3a3a3e;}
.jcard-sep{color:#3a3a3e;font-size:14px;margin:0 2px;align-self:center;}
/* Columna de pts */
.jcard-pts{
  display:flex;flex-direction:column;align-items:center;justify-content:center;
  padding:0 12px;border-left:1px solid #27272a;
  min-width:64px;flex-shrink:0;
}
.jcard-pts-num{
  font-family:'Inter Tight',sans-serif;font-size:20px;font-weight:900;
  color:#4ade80;line-height:1;
}
.jcard-pts-num.pending{color:#3a3a3e;}
.jcard-pts-num.boost{color:#fb923c;}
.jcard-pts-label{font-size:9px;color:#6b7280;text-transform:uppercase;letter-spacing:.05em;margin-top:2px;}
/* Chips mini */
.jcard-chips{display:flex;gap:4px;flex-wrap:wrap;margin-top:5px;}
.jcard-chip{
  font-size:9px;font-weight:600;padding:1px 6px;border-radius:10px;
  background:rgba(255,255,255,.05);color:#6b7280;
}
.jcard-chip.on{background:rgba(74,222,128,.12);color:#4ade80;}
.jcard-chip.boost-chip{background:rgba(234,88,12,.15);color:#fb923c;}
/* Boost row compacta */
.jcard-boost{
  display:flex;align-items:center;gap:6px;
  padding:5px 12px 8px 18px;
  border-top:1px solid #222;
}
/* Sidebar clasificación jornada */
.jornada-sidebar{
  position:sticky;top:80px;
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
```

### B · `public/js/ui-groups.js` — añadir funciones de la vista jornada

BUSCAR al final del fichero, justo antes de `function initGrupos() {`:

INSERTAR antes de `function initGrupos() {`:

```js
/* ════════════════════════════════════════════════════════
   VISTA JORNADA — tarjetas compactas ordenadas por día
   ════════════════════════════════════════════════════════ */
let _vistaActual = 'grupos'; // 'grupos' | 'jornada'

function setVistaGrupos(vista) {
  _vistaActual = vista;
  const gruposContainer  = document.getElementById('groups-container');
  const jornadaContainer = document.getElementById('jornada-container');
  const btnGrupos  = document.getElementById('btn-vista-grupos');
  const btnJornada = document.getElementById('btn-vista-jornada');

  if (vista === 'grupos') {
    if (gruposContainer)  gruposContainer.style.display  = '';
    if (jornadaContainer) jornadaContainer.style.display = 'none';
    if (btnGrupos)  { btnGrupos.style.background  = '#27272a'; btnGrupos.style.color  = '#fff'; }
    if (btnJornada) { btnJornada.style.background = 'transparent'; btnJornada.style.color = '#6b7280'; }
  } else {
    if (gruposContainer)  gruposContainer.style.display  = 'none';
    if (jornadaContainer) jornadaContainer.style.display = '';
    if (btnGrupos)  { btnGrupos.style.background  = 'transparent'; btnGrupos.style.color  = '#6b7280'; }
    if (btnJornada) { btnJornada.style.background = '#27272a'; btnJornada.style.color = '#fff'; }
    renderVistaJornada();
  }
}
window.setVistaGrupos = setVistaGrupos;

function renderVistaJornada() {
  const container = document.getElementById('jornada-container');
  if (!container) return;

  // Agrupar PARTIDOS por fecha
  const jornadasMap = {};
  PARTIDOS.forEach((m, idx) => {
    const date = m.date?.substring(0, 10);
    if (!date) return;
    if (!jornadasMap[date]) jornadasMap[date] = [];
    jornadasMap[date].push({ m, idx });
  });
  const dias = Object.keys(jornadasMap).sort();

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
}
window.renderVistaJornada = renderVistaJornada;

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
  const hasPred  = pred.saved;

  // Marcador pronosticado
  const lTxt = hasScore ? pred.l : '—';
  const vTxt = hasScore ? pred.v : '—';
  const scoreCls = hasScore ? 'jcard-score' : 'jcard-score pending';

  // Chips: signo, exacto, goleador, IA
  const ia = iaPredictions[matchKey];
  const mySign = getMySign(pred);
  const showIA = hasScore && ia && mySign && mySign !== ia.sign;
  const chipSign   = hasScore ? '<span class="jcard-chip on">1X2</span>' : '<span class="jcard-chip">1X2</span>';
  const chipExact  = hasScore ? '<span class="jcard-chip on">Exacto</span>' : '';
  const chipGol    = pred.gol ? '<span class="jcard-chip on">Gol</span>' : '';
  const chipIA     = showIA   ? '<span class="jcard-chip on">vsIA</span>' : '';

  // Pts posibles
  let maxPts = 0;
  if (hasScore) {
    maxPts = 4; // signo + exacto
    if (pred.gol) maxPts += 2;
    if (showIA)   maxPts += 1;
  }
  const ptsActual = hasPred && maxPts > 0 ? maxPts : 0;
  const ptsCls = isBoost ? 'jcard-pts-num boost' : (ptsActual > 0 ? 'jcard-pts-num' : 'jcard-pts-num pending');
  const ptsDisp = isBoost ? (ptsActual * 2) + '✕' : (ptsActual || '—');

  // Boost check
  const chkChecked = isBoost ? 'checked' : '';
  const boostRowBg = isBoost ? 'background:rgba(28,14,6,.8);' : '';

  // Color lateral según grupo
  const groupColors = {A:'#4ade80',B:'#60a5fa',C:'#f472b6',D:'#fb923c',E:'#a78bfa',
    F:'#34d399',G:'#fbbf24',H:'#f87171',I:'#38bdf8',J:'#c084fc',K:'#86efac',L:'#fcd34d'};
  const groupColor = groupColors[m.group] || '#4ade80';

  const hora = new Date(m.date).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'});

  return '<div class="jcard' + (isBoost ? ' boost-active' : '') + '" id="jcard-' + idx + '">' +
    '<div class="jcard-inner">' +
    '<div class="jcard-group" style="background:' + groupColor + ';opacity:.6"></div>' +
    '<div class="jcard-match">' +
      '<div class="jcard-teams">' +
        '<div class="jcard-team-row">' +
          '<div class="jcard-flag"><img src="' + hFlag + '" alt=""/></div>' +
          '<span>' + m.home + '</span>' +
          '<span style="margin-left:auto;font-size:10px;color:#6b7280">Local · ' + m.group + '</span>' +
        '</div>' +
        '<div class="jcard-team-row">' +
          '<div class="jcard-flag"><img src="' + aFlag + '" alt=""/></div>' +
          '<span>' + m.away + '</span>' +
          '<span style="margin-left:auto;font-size:9px;color:#4b5563">' + hora + '</span>' +
        '</div>' +
        '<div class="jcard-chips" style="margin-top:4px">' + chipSign + chipExact + chipGol + chipIA + '</div>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:4px;flex-shrink:0;margin:0 8px;">' +
        '<span class="' + scoreCls + '">' + lTxt + '</span>' +
        '<span class="jcard-sep">:</span>' +
        '<span class="' + scoreCls + '">' + vTxt + '</span>' +
      '</div>' +
    '</div>' +
    '<div class="jcard-pts">' +
      '<div class="' + ptsCls + '">' + ptsDisp + '</div>' +
      '<div class="jcard-pts-label">pts</div>' +
    '</div>' +
    '</div>' + // jcard-inner
    // Boost row compacta
    '<div class="jcard-boost" style="' + boostRowBg + '">' +
      '<input type="checkbox" ' + chkChecked + ' ' +
        'onchange="jcardBoostToggle(\'' + matchKey + '\',\'' + date + '\',this)" ' +
        'style="width:16px;height:16px;accent-color:#ea580c;cursor:pointer;flex-shrink:0">' +
      '<span style="font-size:11px;color:' + (isBoost ? '#fb923c' : '#6b7280') + ';font-weight:500">🔥 Boost</span>' +
      '<button onclick="scrollToMatchCard(\'' + matchKey + '\')" ' +
        'style="margin-left:auto;font-size:10px;color:#4b5563;background:none;border:none;cursor:pointer;' +
        'padding:2px 6px;border-radius:6px;border:1px solid #27272a" ' +
        'title="Ver tarjeta completa">↓ Ver tarjeta</button>' +
    '</div>' +
  '</div>'; // jcard
}

function jcardBoostToggle(matchKey, date, checkbox) {
  // Reusar tickerBoostToggle que ya maneja toda la lógica
  if (window.tickerBoostToggle) {
    // Forzar el estado correcto antes de llamar
    const wasActive = boostPicks[date] === matchKey;
    if (checkbox.checked && !wasActive) {
      tickerBoostToggle(matchKey, date);
    } else if (!checkbox.checked && wasActive) {
      tickerBoostToggle(matchKey, date);
    }
  }
  // Re-renderizar la vista jornada para reflejar el cambio
  setTimeout(() => renderVistaJornada(), 50);
}
window.jcardBoostToggle = jcardBoostToggle;

function _buildJornadaRanking() {
  // Usar _sbData si está cargado, si no mostrar mensaje
  if (!window._sbData || window._sbData.length === 0) {
    return '<div class="jornada-ranking">' +
      '<div class="jornada-ranking-title">🏆 Clasificación</div>' +
      '<div style="font-size:11px;color:#4b5563;text-align:center;padding:12px 0">' +
        'Cargando...' +
      '</div></div>';
  }
  const myId = window.currentUser?.id;
  const rows = window._sbData.slice(0, 10); // top 10
  return '<div class="jornada-ranking">' +
    '<div class="jornada-ranking-title">🏆 Clasificación liga</div>' +
    rows.map((u, i) => {
      const isMe = u.uid === myId;
      const ini  = (u.nombre || '?').charAt(0).toUpperCase();
      const posCls = i < 3 ? 'jrank-pos top' : 'jrank-pos';
      const medals = ['🥇','🥈','🥉'];
      const posStr = i < 3 ? medals[i] : (i + 1);
      return '<div class="jrank-row' + (isMe ? ' jrank-me' : '') + '">' +
        '<span class="' + posCls + '">' + posStr + '</span>' +
        '<div class="jrank-avatar">' + ini + '</div>' +
        '<span class="jrank-name">' + escapeHtml(u.nombre) + '</span>' +
        '<span class="jrank-pts">' + u.total + '</span>' +
      '</div>';
    }).join('') +
  '</div>';
}
```

### C · `public/js/ui-groups.js` — re-renderizar vista jornada tras tickerBoostToggle y checkGroupsComplete

En `tickerBoostToggle`, BUSCAR al final:
```js
  saveBoostPicks();
  checkFinalizarReady?.();
  renderBoostTicker();    // re-render ticker superior
  checkGroupsComplete();  // re-render pastillas CTA inferior
```

REEMPLAZAR POR:
```js
  saveBoostPicks();
  checkFinalizarReady?.();
  renderBoostTicker();
  checkGroupsComplete();
  // Re-renderizar vista jornada si está activa
  if (_vistaActual === 'jornada') setTimeout(() => renderVistaJornada(), 50);
```

### D · `public/js/scoreboard.js` — exponer _sbData en window tras cada carga

BUSCAR exactamente:
```js
    _sbData = rows;
    _sbLoaded = true;
    sbRender(rows, realMatchResults);
```

REEMPLAZAR POR:
```js
    _sbData = rows;
    window._sbData = rows; // exponer para vista jornada
    _sbLoaded = true;
    sbRender(rows, realMatchResults);
```

---

## Verificación
```bash
node --check public/js/ui-groups.js  && echo "ui-groups OK"
node --check public/js/scoreboard.js && echo "scoreboard OK"
npm run build 2>&1 | tail -3
```

Consola tras cargar localhost:5173 y entrar a grupos:
```js
typeof setVistaGrupos      // "function"
typeof renderVistaJornada  // "function"
typeof jcardBoostToggle    // "function"
!!document.getElementById('jornada-container')   // true
!!document.getElementById('btn-vista-grupos')    // true
```

## Commit
```bash
git add index.html public/js/ui-groups.js public/js/scoreboard.js
git commit -m "feat: vista Jornada — pestaña tarjetas compactas por día con boost, pts y ranking liga; fix panel CTA"
git push origin main
```

## Notas técnicas
- Fix panel CTA: se guarda `openDate` antes del innerHTML y se re-inserta el panel HTML si estaba abierto
- `_buildJCard` genera tarjeta compacta: flags + marcador pronosticado + chips mini (1X2/Exacto/Gol/vsIA) + pts posibles (×2 si boost) + boost check + botón "Ver tarjeta" que hace scroll
- Color lateral de la jcard indica el grupo (A=verde, B=azul, etc.)
- `_buildJornadaRanking` usa `window._sbData` (expuesto por scoreboard.js) — si no está cargado muestra "Cargando..."
- `jcardBoostToggle` delega en `tickerBoostToggle` para no duplicar lógica, luego re-renderiza la vista
- La vista se re-renderiza completa en cada cambio de boost (50ms debounce) — las 72 tarjetas son ligeras en DOM
- El selector Fase de grupos / Jornada persiste en `_vistaActual` durante la sesión
