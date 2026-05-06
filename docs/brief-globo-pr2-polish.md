# Brief Globo PR2 Polish — 5 mejoras UX

**Rama:** `feature/globo-pr2-pr3` (ya existe en remoto, hacer pull antes)  
**Base:** HEAD actual de la rama  
**Restricciones:** var no const, no DOMContentLoaded en loadScript, npm run build antes de commit, push inmediato.

---

## Contexto de estado actual

El overlay del globo tiene:
- `.fc-globo-flags` — rejilla de botones con bandera emoji + nombre de país truncado
- `.fc-globo-detail` — panel deslizable con datos del país/sede
- `.fc-globo-overlay__leg` — leyenda con dots "clasificados / sedes"

---

## Cambio 1 — Banderas prominentes, sin texto de país en el botón

**Archivo:** `public/css/components/globo-equipos.css`

Problema: el nombre truncado a 8px hace que parezca "iniciales". La bandera emoji es suficiente + el `title` attr ya tiene el nombre completo como tooltip.

Reemplazar los estilos de `.fc-globo-flag-btn` y `.fc-globo-flag-btn__name` por:

```css
.fc-globo-flag-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1.5px solid transparent;
  border-radius: 8px;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, transform 0.1s;
  padding: 2px;
  pointer-events: auto;
  flex-shrink: 0;
}

.fc-globo-flag-btn__flag {
  font-size: 22px;
  line-height: 1;
  display: block;
}

/* Ocultar el nombre — el title attr sirve de tooltip */
.fc-globo-flag-btn__name {
  display: none;
}

.fc-globo-flag-btn:hover,
.fc-globo-flag-btn:focus-visible {
  background: rgba(232,184,48,0.15);
  border-color: rgba(232,184,48,0.4);
  transform: scale(1.15);
  outline: none;
}

.fc-globo-flag-btn.is-active {
  background: rgba(232,184,48,0.25);
  border-color: #e8b830;
  transform: scale(1.1);
}
```

---

## Cambio 2 — Leyenda horizontal con scroll, aprovecha más ancho

**Archivo:** `public/css/components/globo-equipos.css`

Cambiar `.fc-globo-flags` de flex-wrap a scroll horizontal compacto:

```css
.fc-globo-flags {
  display: flex;
  flex-wrap: nowrap;          /* scroll horizontal, no wrap */
  flex-direction: row;
  gap: 4px;
  padding: 8px 12px;
  max-height: none;           /* quitar max-height anterior */
  overflow-x: auto;
  overflow-y: hidden;
  border-top: 1px solid rgba(232,184,48,0.15);
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;      /* ocultar scrollbar en Firefox */
  -ms-overflow-style: none;   /* ocultar en IE */
}

.fc-globo-flags::-webkit-scrollbar {
  display: none;              /* ocultar en Chrome/Safari */
}
```

Esto crea una fila única scrollable de 48 banderas sin texto, compacta y aprovechando todo el ancho.

---

## Cambio 3 — Chips de sedes en la leyenda

**Archivos:** `public/js/ui-globo-equipos.js` + `public/css/components/globo-equipos.css`

### JS: añadir función `renderSedesLegend` junto a `renderFlagsLegend`

```js
function renderSedesLegend(globe) {
  var sedesEl = document.getElementById('fc-globo-sedes');
  if (!sedesEl || sedesEl._fcRendered) return;
  sedesEl._fcRendered = true;

  var html = SEDES.map(function(s) {
    return (
      '<button type="button" class="fc-globo-sede-chip" ' +
        'data-name="' + s.name + '" ' +
        'data-lat="' + s.lat + '" data-lng="' + s.lng + '" ' +
        'title="' + s.name + '">' +
        '📍 ' + s.name +
      '</button>'
    );
  }).join('');

  sedesEl.innerHTML = html;

  sedesEl.addEventListener('click', function(e) {
    var btn = e.target.closest('.fc-globo-sede-chip');
    if (!btn || !globe) return;
    var name = btn.dataset.name;
    var lat = parseFloat(btn.dataset.lat);
    var lng = parseFloat(btn.dataset.lng);
    var wikiData = (typeof window.WIKI_SEDES !== 'undefined') ? window.WIKI_SEDES[name] : null;

    var ctrl = globe.controls ? globe.controls() : null;
    if (ctrl) ctrl.autoRotate = false;
    globe.pointOfView({ lat: lat, lng: lng, altitude: 1.5 }, 800);
    setTimeout(function() {
      if (ctrl) { ctrl.autoRotate = true; ctrl.autoRotateSpeed = 0.4; }
    }, 3000);

    openDetail(renderPanelSede(wikiData, name));

    sedesEl.querySelectorAll('.fc-globo-sede-chip').forEach(function(b) { b.classList.remove('is-active'); });
    btn.classList.add('is-active');
  });
}
```

### JS: añadir `<div id="fc-globo-sedes">` al OVERLAY_HTML

En el OVERLAY_HTML, dentro de `.fc-globo-overlay__leg`, después del `<div class="fc-globo-flags">` ya existente:

```js
'<div class="fc-globo-sedes" id="fc-globo-sedes"></div>'
```

### JS: llamar `renderSedesLegend` donde se llama `renderFlagsLegend`

En los dos sitios donde aparece `renderFlagsLegend(g)` y `renderFlagsLegend(window._globoInstance)`, añadir justo debajo:

```js
renderSedesLegend(g);          // o window._globoInstance según el caso
```

### CSS: chips de sedes

```css
.fc-globo-sedes {
  display: flex;
  flex-wrap: nowrap;
  gap: 4px;
  padding: 4px 12px 8px;
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  border-top: 1px solid rgba(255,255,255,0.06);
  pointer-events: auto;
}

.fc-globo-sedes::-webkit-scrollbar { display: none; }

.fc-globo-sede-chip {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border: 1px solid rgba(255,255,255,0.15);
  border-radius: 20px;
  background: rgba(255,255,255,0.05);
  color: rgba(255,255,255,0.7);
  font-size: 10px;
  white-space: nowrap;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s, color 0.15s;
  pointer-events: auto;
  flex-shrink: 0;
}

.fc-globo-sede-chip:hover,
.fc-globo-sede-chip:focus-visible {
  background: rgba(232,184,48,0.12);
  border-color: rgba(232,184,48,0.4);
  color: #e8b830;
  outline: none;
}

.fc-globo-sede-chip.is-active {
  background: rgba(232,184,48,0.18);
  border-color: #e8b830;
  color: #e8b830;
}
```

---

## Cambio 4 — Bio colapsable en el panel de país

**Archivos:** `public/js/ui-globo-equipos.js` + `js/main-entry.js` + nuevo `public/js/data/wiki-bio.js`

### Paso 4A: Crear `public/js/data/wiki-bio.js`

Copiar el contenido COMPLETO de `docs/wiki-bio.js` (que Claude.ai acaba de subir a GitHub) a `public/js/data/wiki-bio.js`. Sin modificar ninguna línea.

### Paso 4B: `js/main-entry.js` — cargar wiki-bio.js

En la chain de loadScript, añadir la carga de wiki-bio.js ANTES de ui-globo-equipos.js y DESPUÉS de wiki-data-globo.js:

```js
// El orden debe ser: wiki-data-globo.js → wiki-bio.js → ui-globo-equipos.js
.then(() => loadScript('/js/data/wiki-data-globo.js'))
.then(() => loadScript('/js/data/wiki-bio.js'))
.then(() => loadScript('/js/ui-globo-equipos.js'))
```

### Paso 4C: `ui-globo-equipos.js` — modificar `renderPanelPais`

Localizar la función `renderPanelPais` y REEMPLAZARLA por completa con esta versión:

```js
function renderPanelPais(wikiData, nombrePais, nameEn) {
  var w = wikiData || {};
  var bio = (typeof window.WIKI_BIO !== 'undefined' && nameEn && window.WIKI_BIO[nameEn])
    ? window.WIKI_BIO[nameEn].bio : '';
  var apodoDisplay = (typeof window.WIKI_BIO !== 'undefined' && nameEn && window.WIKI_BIO[nameEn])
    ? window.WIKI_BIO[nameEn].apodo : (w.apodo || '');
  var coachLine = w.coach
    ? '<div class="fc-globo-detail__row"><span class="fc-globo-detail__lbl">Entrenador</span><span>' + w.coach + '</span></div>'
    : '';
  var estrella = w.estrella ? (
    '<div class="fc-globo-detail__estrella">' +
      '<span class="fc-globo-detail__estrella-pos">' + (w.estrella_pos || '') + '</span>' +
      '<span class="fc-globo-detail__estrella-nom">' + w.estrella + '</span>' +
      (w.estrella_club ? '<span class="fc-globo-detail__estrella-club">' + w.estrella_club + '</span>' : '') +
    '</div>'
  ) : '';
  var bioSection = bio ? (
    '<details class="fc-globo-detail__bio">' +
      '<summary class="fc-globo-detail__bio-toggle">Más sobre este equipo ▸</summary>' +
      '<p class="fc-globo-detail__bio-text">' + bio + '</p>' +
    '</details>'
  ) : '';
  var btnPlantilla = (
    '<button type="button" class="fc-globo-detail__btn-plantilla" ' +
      'onclick="window._globoNavPlantilla && window._globoNavPlantilla(\'' + (nameEn || '') + '\')">' +
      '🏟 Ver plantilla' +
    '</button>'
  );
  return (
    '<div class="fc-globo-detail__hdr">' +
      '<span class="fc-globo-detail__title">' + nombrePais + '</span>' +
      (apodoDisplay ? '<span class="fc-globo-detail__sub">' + apodoDisplay + '</span>' : '') +
    '</div>' +
    '<div class="fc-globo-detail__stats">' +
      (w.grupo ? '<div class="fc-globo-detail__row"><span class="fc-globo-detail__lbl">Grupo</span><span>' + w.grupo + '</span></div>' : '') +
      (w.confed ? '<div class="fc-globo-detail__row"><span class="fc-globo-detail__lbl">Confederación</span><span>' + w.confed + '</span></div>' : '') +
      '<div class="fc-globo-detail__row"><span class="fc-globo-detail__lbl">Mundiales</span><span>' + (w.mundiales || '—') + '</span></div>' +
      (w.mejor ? '<div class="fc-globo-detail__row"><span class="fc-globo-detail__lbl">Mejor resultado</span><span>' + w.mejor + '</span></div>' : '') +
      coachLine +
    '</div>' +
    (estrella ? '<div class="fc-globo-detail__section-lbl">Estrella</div>' + estrella : '') +
    bioSection +
    btnPlantilla +
    '<div class="fc-globo-detail__attr">Datos: sport.es / Wikipedia CC BY-SA</div>'
  );
}
```

**IMPORTANTE:** Ahora `renderPanelPais` recibe un tercer argumento `nameEn`. Actualizar TODOS los call sites:

1. En el handler de `renderFlagsLegend` (click en bandera):
   ```js
   openDetail(renderPanelPais(wikiData, btn.querySelector('.fc-globo-flag-btn__name').textContent, nameEn));
   ```
   Como `.fc-globo-flag-btn__name` ahora tiene `display:none`, el textContent puede estar vacío. Cambiar a:
   ```js
   openDetail(renderPanelPais(wikiData, btn.title, nameEn));
   ```

2. En `onPolygonClick`:
   ```js
   openDetail(renderPanelPais(wikiData, name, name));
   ```

---

## Cambio 5 — CSS para bio colapsable + botón plantilla

**Archivo:** `public/css/components/globo-equipos.css` — añadir al final

```css
/* ── Bio colapsable ───────────────────────────────────────── */
.fc-globo-detail__bio {
  margin: 10px 0;
  border: 1px solid rgba(232,184,48,0.15);
  border-radius: 8px;
  overflow: hidden;
}

.fc-globo-detail__bio-toggle {
  padding: 8px 12px;
  font-size: 11px;
  color: rgba(232,184,48,0.8);
  cursor: pointer;
  list-style: none;
  user-select: none;
  display: flex;
  align-items: center;
  gap: 6px;
  background: rgba(232,184,48,0.05);
  transition: background 0.15s;
}

.fc-globo-detail__bio-toggle::-webkit-details-marker { display: none; }

.fc-globo-detail__bio[open] .fc-globo-detail__bio-toggle {
  background: rgba(232,184,48,0.10);
  color: #e8b830;
}

.fc-globo-detail__bio-text {
  font-size: 11px;
  color: rgba(255,255,255,0.7);
  line-height: 1.6;
  padding: 10px 12px 12px;
  margin: 0;
  border-top: 1px solid rgba(232,184,48,0.1);
}

/* ── Botón Ver Plantilla ──────────────────────────────────── */
.fc-globo-detail__btn-plantilla {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  margin: 12px 0 4px;
  padding: 10px 16px;
  background: rgba(232,184,48,0.1);
  border: 1px solid rgba(232,184,48,0.3);
  border-radius: 8px;
  color: #e8b830;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  letter-spacing: 0.04em;
}

.fc-globo-detail__btn-plantilla:hover {
  background: rgba(232,184,48,0.2);
  border-color: rgba(232,184,48,0.6);
}
```

---

## Cambio 6 — Stub de navegación a plantilla

**Archivo:** `public/js/ui-globo-equipos.js`

Al final del IIFE, antes de `window._mountGloboCinta = _mountGloboCinta;`, añadir:

```js
// Stub de navegación a plantilla — se implementará en PR4
// Cuando el módulo de plantilla esté listo, sobreescribirá esta función
if (!window._globoNavPlantilla) {
  window._globoNavPlantilla = function(nameEn) {
    // Por ahora: navegar a la vista de grupos con el equipo seleccionado
    // En PR4 esto irá a la screen de plantilla
    console.log('[globo] navPlantilla →', nameEn, '(stub — PR4 pendiente)');
    // Cerrar overlay y dejar nota visual
    closeOverlay();
  };
}
```

---

## Verificaciones obligatorias

1. `npm run build` — sin errores
2. `grep -l "fc-globo-sede-chip" dist/css/components/*.css` — debe existir
3. `grep -l "WIKI_BIO" dist/` — debe aparecer en el bundle
4. En localhost:5173 verificar:
   - Leyenda: fila de banderas sin texto (solo emoji 22px), scroll horizontal
   - Leyenda: segunda fila de chips de sedes scrollable
   - Click bandera → panel → bio colapsable → desplegar → texto completo
   - Click "Ver plantilla" → cierra overlay (stub PR4)
   - Click sede chip → panel sede con datos

## Commits
- Único commit: `feat(globo): UX polish — flag-only legend, venue chips, bio expand, squad stub`
- Push inmediato

## Al terminar
Reportar:
- SHA del commit
- Últimas 5 líneas de `npm run build`
- Desviaciones si las hay
