# Fix urgente: leyenda del globo — banderas + layout

**Rama:** `feature/globo-pr2-pr3`  
**Un solo commit al final.**

---

## Bug 1 — Canvas 840px cubre toda la pantalla, leyenda invisible

**Causa:** `globe.height(canvasEl.clientHeight)` se llama cuando el canvas ya tiene `height:100%` del overlay → se fija a 840px → empuja la leyenda fuera del viewport.

**Fix en `public/css/components/globo-equipos.css`:**

Buscar `.fc-globo-overlay__canvas` y reemplazar su bloque por:

```css
.fc-globo-overlay__canvas {
  flex: 1 1 0;          /* crece para ocupar espacio disponible */
  min-height: 0;        /* necesario para que flex funcione en columna */
  overflow: hidden;
  position: relative;
}
```

Asegurarse de que `.fc-globo-overlay` tenga:

```css
.fc-globo-overlay {
  /* añadir si no existe: */
  display: flex;
  flex-direction: column;
}
```

Y `.fc-globo-overlay__leg` tenga:

```css
.fc-globo-overlay__leg {
  flex-shrink: 0;       /* no comprime la leyenda */
}
```

**Fix en `public/js/ui-globo-equipos.js`:**

Localizar la función `initGlobo`. Al final, donde aparece:

```js
globe.width(canvasEl.clientWidth);
globe.height(canvasEl.clientHeight);
```

La primera llamada a `globe.height(canvasEl.clientHeight)` se hace ANTES de que el flex layout haya calculado el tamaño real del canvas. Cambiar esas dos líneas por:

```js
globe.width(canvasEl.clientWidth);
globe.height(canvasEl.clientHeight || (window.innerHeight - 200));
```

Y también en la función `onResize` y en `openOverlay` (el bloque de instancia cacheada), reemplazar:

```js
globe.width(canvasEl.clientWidth);
globe.height(canvasEl.clientHeight);
```

por:

```js
// Usar requestAnimationFrame para que el flex layout haya calculado primero
requestAnimationFrame(function() {
  globe.width(canvasEl.clientWidth);
  globe.height(canvasEl.clientHeight || (window.innerHeight - 200));
});
```

Solo en openOverlay (instancia cacheada), NO en initGlobo (ese ya usa el promise chain).

---

## Bug 2 — Banderas muestran código ISO (MEX, BRA) en lugar de emoji

**Causa:** `EQUIPOS[].flag` contiene `"MEX"`, `"BRA"` etc. (código ISO 3 letras), no emoji.  
El código actual usa `e.flag || e.flag_emoji || ''` → muestra el código.

**Fix en `public/js/ui-globo-equipos.js`:**

Añadir esta tabla de conversión justo después de `var ALIAS_WIKI = {...}`:

```js
// ISO 3-letras → emoji de bandera (Regional Indicator symbols)
var ISO3_TO_FLAG = {
  'MEX':'🇲🇽','RSA':'🇿🇦','KOR':'🇰🇷','CZE':'🇨🇿',
  'CAN':'🇨🇦','QAT':'🇶🇦','SUI':'🇨🇭','BIH':'🇧🇦',
  'BRA':'🇧🇷','MAR':'🇲🇦','HAI':'🇭🇹','SCO':'🏴󠁧󠁢󠁳󠁣󠁴󠁿',
  'USA':'🇺🇸','AUS':'🇦🇺','NZL':'🇳🇿','PAR':'🇵🇾',
  'GER':'🇩🇪','ECU':'🇪🇨','CIV':'🇨🇮','CUW':'🇨🇼',
  'NED':'🇳🇱','JPN':'🇯🇵','TUN':'🇹🇳',
  'BEL':'🇧🇪','EGY':'🇪🇬','IRN':'🇮🇷','NZL':'🇳🇿',
  'ESP':'🇪🇸','URU':'🇺🇾','KSA':'🇸🇦','CPV':'🇨🇻',
  'FRA':'🇫🇷','SEN':'🇸🇳','NOR':'🇳🇴','IRQ':'🇮🇶',
  'ARG':'🇦🇷','ALG':'🇩🇿','AUT':'🇦🇹','JOR':'🇯🇴',
  'POR':'🇵🇹','COL':'🇨🇴','UZB':'🇺🇿',
  'ENG':'🏴󠁧󠁢󠁥󠁮󠁧󠁿','CRO':'🇭🇷','GHA':'🇬🇭','PAN':'🇵🇦',
  'KAZ':'🇰🇿','ANG':'🇦🇴'
};

function getFlagEmoji(equipo) {
  if (!equipo) return '⚽';
  // 1. Si ya tiene emoji directo (char con code > 127)
  var f = equipo.flag || equipo.flag_emoji || '';
  if (f && f.codePointAt(0) > 127) return f;
  // 2. Buscar en tabla ISO3
  if (f && ISO3_TO_FLAG[f.toUpperCase()]) return ISO3_TO_FLAG[f.toUpperCase()];
  // 3. Fallback: inicial del nombre
  return (equipo.name || equipo.name_en || '?').charAt(0).toUpperCase();
}
```

Luego en la función `renderFlagsLegend`, localizar la línea:

```js
var flag = e.flag || e.flag_emoji || '';
```

Reemplazarla por:

```js
var flag = getFlagEmoji(e);
```

---

## Verificación rápida antes del commit

En localhost:5173, abrir el globo y confirmar:
1. El canvas no ocupa toda la pantalla — la leyenda es visible dentro del overlay
2. Los botones de bandera muestran emojis de flag, no códigos
3. La fila de banderas es scrollable horizontalmente (48 items)
4. La fila de chips de sedes aparece debajo de las banderas

## Commit
`fix(globo): canvas flex + flag emoji from ISO3 table`  
Push inmediato.
