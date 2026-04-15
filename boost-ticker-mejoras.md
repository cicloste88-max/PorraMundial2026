# Boost ticker — 3 mejoras en 2 ficheros
# 1. Ticker superior: partidos desplegables con scroll a tarjeta + label Jornada
# 2. CTA inferior: panel expandible propio con partidos y scroll a tarjeta
# 3. Bug fix: al desmarcar boost desde check de tarjeta, el ticker no se re-activaba

---

## A · `public/js/ui-groups.js` — 3 cambios

### A1 · tickerExpandJornada — añadir scroll a tarjeta y label Jornada

BUSCAR exactamente:
```js
/* Expande/colapsa los partidos de una jornada en el ticker */
function tickerExpandJornada(date) {
  const panel = document.getElementById('boost-ticker-panel');
  if (!panel) return;

  // Si ya estaba expandido para esta fecha, colapsar
  if (panel.dataset.date === date && panel.style.display !== 'none') {
    panel.style.display = 'none';
    panel.dataset.date = '';
    return;
  }

  panel.dataset.date = date;
  panel.style.display = 'flex';

  const matchesOfDay = PARTIDOS.filter(m => m.date?.substring(0,10) === date);
  const boostedKey = boostPicks[date];
  const hora = (m) => new Date(m.date).toLocaleTimeString('es-ES',{hour:'2-digit',minute:'2-digit'});

  panel.innerHTML = matchesOfDay.map(m => {
    const key = getMatchKey(m);
    const isActive = boostedKey === key;
    return `<button
      onclick="tickerBoostToggle('${key}','${date}')"
      style="
        display:inline-flex;align-items:center;gap:5px;
        padding:4px 12px;border-radius:20px;font-size:11px;font-weight:600;
        border:1px solid ${isActive ? 'rgb(234,88,12)' : 'rgba(255,255,255,.1)'};
        background:${isActive ? 'rgba(124,45,18,.7)' : 'rgba(255,255,255,.04)'};
        color:${isActive ? 'rgb(251,191,36)' : 'rgba(255,255,255,.55)'};
        cursor:pointer;white-space:nowrap;transition:all .2s;
      "
    >${isActive ? '🔥 ' : ''}${m.home} vs ${m.away}
    <span style="opacity:.45;font-size:10px">${hora(m)}</span></button>`;
  }).join('');
}
window.tickerExpandJornada = tickerExpandJornada;
```

REEMPLAZAR POR:
```js
/* Scroll suave a la tarjeta de un partido */
function scrollToMatchCard(matchKey) {
  const idx = PARTIDOS.findIndex(m => getMatchKey(m) === matchKey);
  if (idx === -1) return;
  const card = document.querySelector('.card[data-match-idx="' + idx + '"]');
  if (!card) return;
  card.scrollIntoView({ behavior: 'smooth', block: 'center' });
  // Flash visual para identificar la tarjeta
  card.style.transition = 'box-shadow .3s';
  card.style.boxShadow = '0 0 0 3px rgb(251,146,60), 0 0 40px rgba(234,88,12,.6)';
  setTimeout(() => { card.style.boxShadow = ''; }, 1800);
}
window.scrollToMatchCard = scrollToMatchCard;

/* Expande/colapsa los partidos de una jornada — usado por ticker superior y CTA inferior */
function _buildMatchButtons(date, onClickFn) {
  const matchesOfDay = PARTIDOS.filter(m => m.date?.substring(0,10) === date);
  const boostedKey = boostPicks[date];
  const hora = (m) => new Date(m.date).toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'});
  const jNum = [...new Set(PARTIDOS.map(m => m.date?.substring(0,10)).filter(Boolean))].sort().indexOf(date) + 1;
  const dayLabel = new Date(date + 'T12:00:00').toLocaleDateString('es-ES', {weekday:'short', day:'numeric', month:'short'});

  const header = '<div style="width:100%;display:flex;align-items:center;gap:8px;margin-bottom:4px;">' +
    '<span style="font-size:10px;font-weight:700;color:#fb923c;background:rgba(124,45,18,.4);padding:2px 8px;border-radius:20px;border:1px solid rgba(234,88,12,.3)">J' + jNum + '</span>' +
    '<span style="font-size:10px;color:#6b7280">' + dayLabel + '</span>' +
    '</div>';

  const buttons = matchesOfDay.map(m => {
    const key = getMatchKey(m);
    const isActive = boostedKey === key;
    return '<div style="display:inline-flex;align-items:center;gap:4px;">' +
      '<button onclick="' + onClickFn + '(\'' + key + '\',\'' + date + '\')" style="' +
        'display:inline-flex;align-items:center;gap:5px;' +
        'padding:4px 12px;border-radius:20px 0 0 20px;font-size:11px;font-weight:600;' +
        'border:1px solid ' + (isActive ? 'rgb(234,88,12)' : 'rgba(255,255,255,.1)') + ';border-right:none;' +
        'background:' + (isActive ? 'rgba(124,45,18,.7)' : 'rgba(255,255,255,.04)') + ';' +
        'color:' + (isActive ? 'rgb(251,191,36)' : 'rgba(255,255,255,.55)') + ';' +
        'cursor:pointer;white-space:nowrap;transition:all .2s;' +
      '">' + (isActive ? '🔥 ' : '') + m.home + ' vs ' + m.away +
      ' <span style="opacity:.45;font-size:10px">' + hora(m) + '</span></button>' +
      '<button onclick="scrollToMatchCard(\'' + key + '\')" title="Ir a la tarjeta" style="' +
        'display:inline-flex;align-items:center;justify-content:center;' +
        'padding:4px 8px;border-radius:0 20px 20px 0;font-size:10px;' +
        'border:1px solid ' + (isActive ? 'rgb(234,88,12)' : 'rgba(255,255,255,.1)') + ';border-left:none;' +
        'background:' + (isActive ? 'rgba(124,45,18,.5)' : 'rgba(255,255,255,.03)') + ';' +
        'color:rgba(255,255,255,.4);cursor:pointer;transition:all .2s;' +
        '" onmouseover="this.style.color=\'rgba(255,255,255,.8)\'" onmouseout="this.style.color=\'rgba(255,255,255,.4)\'">↓</button>' +
      '</div>';
  }).join('');

  return header + buttons;
}

function tickerExpandJornada(date) {
  // Buscar o crear panel en el ticker superior
  const ticker = document.getElementById('boost-ticker');
  if (!ticker) return;

  let panel = document.getElementById('boost-ticker-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'boost-ticker-panel';
    panel.style.cssText = 'width:100%;padding:8px 0 4px;border-top:1px solid rgba(124,45,18,.3);margin-top:4px;flex-wrap:wrap;gap:6px;align-items:center';
    ticker.appendChild(panel);
  }

  // Toggle: colapsar si ya está abierto para esta fecha
  if (panel.dataset.date === date && panel.style.display !== 'none') {
    panel.style.display = 'none';
    panel.dataset.date = '';
    return;
  }

  panel.dataset.date = date;
  panel.style.display = 'flex';
  panel.innerHTML = _buildMatchButtons(date, 'tickerBoostToggle');
}
window.tickerExpandJornada = tickerExpandJornada;

/* Expande panel de jornada dentro del CTA inferior */
function ctaExpandJornada(date) {
  const container = document.getElementById('cta-boost-pending');
  if (!container) return;

  let panel = document.getElementById('cta-boost-panel');
  if (!panel) {
    panel = document.createElement('div');
    panel.id = 'cta-boost-panel';
    panel.style.cssText = 'width:100%;margin-top:8px;padding:8px;border-top:1px solid rgba(124,45,18,.3);flex-wrap:wrap;gap:6px;align-items:center;display:flex';
    container.appendChild(panel);
  }

  // Toggle
  if (panel.dataset.date === date && panel.style.display !== 'none') {
    panel.style.display = 'none';
    panel.dataset.date = '';
    return;
  }

  panel.dataset.date = date;
  panel.style.display = 'flex';
  panel.innerHTML = _buildMatchButtons(date, 'tickerBoostToggle');

  // Scroll suave al panel
  setTimeout(() => panel.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 50);
}
window.ctaExpandJornada = ctaExpandJornada;
```

### A2 · checkGroupsComplete — pastillas del CTA inferior usan ctaExpandJornada

BUSCAR dentro del bloque de pastillas pendientes en checkGroupsComplete:
```js
              return '<button onclick="tickerExpandJornada(\'' + d + '\')" style="' +
```

REEMPLAZAR POR:
```js
              return '<button onclick="ctaExpandJornada(\'' + d + '\')" style="' +
```

### A3 · tickerBoostToggle — añadir renderBoostTicker + checkGroupsComplete al final

BUSCAR exactamente al final de tickerBoostToggle:
```js
  saveBoostPicks();
  checkFinalizarReady?.();
  renderBoostTicker(); // re-render ticker con nuevo estado
}
window.tickerBoostToggle = tickerBoostToggle;
```

REEMPLAZAR POR:
```js
  saveBoostPicks();
  checkFinalizarReady?.();
  renderBoostTicker();    // re-render ticker superior
  checkGroupsComplete();  // re-render pastillas CTA inferior
  // Re-renderizar panel expandido si sigue abierto
  const openPanel = document.getElementById('boost-ticker-panel');
  if (openPanel && openPanel.dataset.date && openPanel.style.display !== 'none') {
    openPanel.innerHTML = _buildMatchButtons(openPanel.dataset.date, 'tickerBoostToggle');
  }
  const ctaPanel = document.getElementById('cta-boost-panel');
  if (ctaPanel && ctaPanel.dataset.date && ctaPanel.style.display !== 'none') {
    ctaPanel.innerHTML = _buildMatchButtons(ctaPanel.dataset.date, 'tickerBoostToggle');
  }
}
window.tickerBoostToggle = tickerBoostToggle;
```

---

## B · `public/js/scoring.js` — fix bug 3: check de tarjeta no re-activaba ticker

BUSCAR en el listener del boost-chk dentro de `attachEvents`:
```js
      saveBoostPicks();
      checkFinalizarReady?.();
    });
  }
```

REEMPLAZAR POR:
```js
      saveBoostPicks();
      checkFinalizarReady?.();
      // Re-activar ticker y CTA tras cambio desde check de tarjeta
      if (typeof renderBoostTicker === 'function') renderBoostTicker();
      if (typeof checkGroupsComplete === 'function') checkGroupsComplete();
    });
  }
```

---

## Verificación
```bash
node --check public/js/ui-groups.js && echo "ui-groups OK"
node --check public/js/scoring.js   && echo "scoring OK"
npm run build 2>&1 | tail -3
```

Consola tras recargar localhost:5173 y entrar a grupos:
```js
typeof scrollToMatchCard    // "function"
typeof ctaExpandJornada     // "function"
typeof tickerExpandJornada  // "function"
```

## Commit
```bash
git add public/js/ui-groups.js public/js/scoring.js
git commit -m "feat: boost ticker — scroll a tarjeta, label Jornada, panel CTA propio, fix re-activación tras desmarcar desde tarjeta"
git push origin main
```

## Notas
- Cada partido tiene dos botones soldados: [Partido · hora][↓]
  El primero asigna/desasigna boost. El segundo hace scroll a la tarjeta.
- _buildMatchButtons es función privada compartida por ticker superior y CTA inferior
  → garantiza consistencia visual entre ambos paneles
- ctaExpandJornada crea su propio panel dentro de #cta-boost-pending independiente
  del panel del ticker superior — los dos pueden estar abiertos a la vez
- Bug 3 fix: el change listener del boost-chk en scoring.js ahora llama
  renderBoostTicker() y checkGroupsComplete() para mantener sincronizados
  ticker superior, CTA inferior y estado del botón eliminatorias
