# Brief Globo PR2 + PR3 — Porra Mundial 2026

**Rama de trabajo:** `feature/globo-pr2-pr3`  
**Base:** `main` (HEAD `aebbd22`)  
**Archivos a tocar:** `public/js/ui-globo-equipos.js`, `public/js/data/wiki-data-globo.js` (nuevo), `public/css/components/globo-equipos.css`, `index.html`, `js/main-entry.js`  
**Restricciones críticas del proyecto:**
- `const` top-level en classic scripts NO se expone en `window.*` — usar `var`
- NO crear `vercel.json`
- Verificar `npm run build` antes de hacer commit
- Push inmediato tras cada commit
- No llamar `DOMContentLoaded` en scripts cargados via `loadScript`

---

## Decisiones de arquitectura (ya tomadas, no cuestionar)

| Decisión | Opción elegida | Motivo |
|---|---|---|
| Datos Wiki | Embebidos en `wiki-data-globo.js` | Cero latencia, cero CORS, sin fetch en runtime |
| Popups país | Panel lateral deslizable (`.fc-globo-detail`) | Tooltips hover no funcionan bien en mobile |
| Popups sede | Mismo panel lateral con template diferente | Reutilizar componente |
| Leyenda banderas | Rejilla scrollable abajo del globo | Mismo overlay existente, no ventana nueva |
| Click bandera | `globe.pointOfView({ lat, lng, altitude: 2.2 }, 800)` animado | Ya previsto en globo MVP |
| Click sede (punto) | `onPointClick` → `pointOfView` + abrir panel | API globe.gl ya disponible |
| Lookup key países | `name_en` de EQUIPOS[] → ALIAS en `WIKI_SELECCIONES` | Mismo patrón que ALIAS_NE existente |
| Carga del data file | `loadScript` en `main-entry.js` antes de `ui-globo-equipos.js` | Mismo patrón que otros scripts |

---

## PR2 — Leyenda de banderas + click navega

### 1. Nuevo archivo de datos

Crear `public/js/data/wiki-data-globo.js` con el contenido exacto del archivo que está en el repositorio del proyecto bajo `docs/wiki-data-globo.js` o bien copiar el contenido completo del archivo generado.

**Contenido:** Ver el archivo adjunto `wiki-data-globo.js` que Claude.ai ha generado y que contiene `WIKI_SELECCIONES` (45 selecciones) y `WIKI_SEDES` (16 estadios). El archivo usa `var` para todas las declaraciones (no `const`/`let`) y está listo para uso como classic script.

### 2. `js/main-entry.js` — añadir carga del data file

Localizar el bloque donde se carga `ui-globo-equipos.js` (buscar `loadScript`) y añadir la carga de `wiki-data-globo.js` **antes**:

```js
// Añadir ANTES de la línea que carga ui-globo-equipos.js
loadScript('/js/data/wiki-data-globo.js').then(function() {
  return loadScript('/js/ui-globo-equipos.js');
});
```

Si la carga actual no usa `.then()` encadenado sino un array/Promise.all, adaptar al patrón existente manteniendo que `wiki-data-globo.js` se resuelve antes que `ui-globo-equipos.js`.

### 3. `ui-globo-equipos.js` — leyenda de banderas y click en sedes

#### A) Ampliar `SEDES` con coordenadas de lookup

Añadir propiedad `nameKey` a cada objeto SEDES para hacer lookup en `WIKI_SEDES`:

```js
var SEDES = [
  { name: 'Los Ángeles',      lat: 34.05, lng: -118.24, nameKey: 'Los Ángeles' },
  { name: 'San Francisco',    lat: 37.35, lng: -121.95, nameKey: 'San Francisco' },
  { name: 'Seattle',          lat: 47.61, lng: -122.33, nameKey: 'Seattle' },
  { name: 'Dallas',           lat: 32.74, lng:  -97.09, nameKey: 'Dallas' },
  { name: 'Houston',          lat: 29.76, lng:  -95.37, nameKey: 'Houston' },
  { name: 'Kansas City',      lat: 39.10, lng:  -94.58, nameKey: 'Kansas City' },
  { name: 'Atlanta',          lat: 33.75, lng:  -84.39, nameKey: 'Atlanta' },
  { name: 'Miami',            lat: 25.96, lng:  -80.24, nameKey: 'Miami' },
  { name: 'Boston',           lat: 42.07, lng:  -71.25, nameKey: 'Boston' },
  { name: 'Nueva York',       lat: 40.82, lng:  -74.07, nameKey: 'Nueva York' },
  { name: 'Filadelfia',       lat: 39.90, lng:  -75.17, nameKey: 'Filadelfia' },
  { name: 'Ciudad de México', lat: 19.43, lng:  -99.13, nameKey: 'Ciudad de México' },
  { name: 'Monterrey',        lat: 25.67, lng: -100.31, nameKey: 'Monterrey' },
  { name: 'Guadalajara',      lat: 20.67, lng: -103.35, nameKey: 'Guadalajara' },
  { name: 'Vancouver',        lat: 49.26, lng: -123.11, nameKey: 'Vancouver' },
  { name: 'Toronto',          lat: 43.65, lng:  -79.38, nameKey: 'Toronto' }
];
```

#### B) Añadir lookup entre `name_en` de EQUIPOS y key de WIKI_SELECCIONES

Después de `var ALIAS_NE` añadir:

```js
// Lookup EQUIPOS.name_en → clave en WIKI_SELECCIONES
var ALIAS_WIKI = {
  'Bosnia & Herzegovina':      'Bosnia & Herzegovina',
  'Bosnia and Herzegovina':    'Bosnia & Herzegovina',
  'Ivory Coast':               'Ivory Coast',
  "Côte d'Ivoire":            'Ivory Coast',
  'Korea':                     'Korea',
  'Republic of Korea':         'Korea',
  'South Korea':               'Korea',
  'USA':                       'USA',
  'United States':             'USA',
  'Netherlands':               'Netherlands',
  'Curaçao':                  'Curaçao',
  'Türkiye':                  'Turkey',
  'England':                   'England',
  'Scotland':                  'Scotland'
};

function getWikiSel(name_en) {
  if (!name_en) return null;
  var key = ALIAS_WIKI[name_en] || name_en;
  var data = (typeof window.WIKI_SELECCIONES !== 'undefined') ? window.WIKI_SELECCIONES : null;
  return data ? (data[key] || null) : null;
}
```

#### C) Añadir panel lateral HTML al `OVERLAY_HTML`

Modificar `OVERLAY_HTML` para añadir el panel de detalle después del canvas:

```js
// Añadir dentro de OVERLAY_HTML, después de fc-globo-overlay__canvas y fc-globo-overlay__leg:
'<div class="fc-globo-detail" id="fc-globo-detail" aria-live="polite">' +
  '<button type="button" class="fc-globo-detail__close" id="fc-globo-detail-close" aria-label="Cerrar detalle">✕</button>' +
  '<div class="fc-globo-detail__body" id="fc-globo-detail-body"></div>' +
'</div>'
```

También añadir en la leyenda actual el div de banderas:

```js
// Reemplazar el fc-globo-overlay__leg existente con versión extendida:
'<div class="fc-globo-overlay__leg">' +
  '<div class="fc-globo-overlay__leg-items">' +
    '<span><span class="fc-globo-overlay__dot fc-globo-overlay__dot--gold"></span>clasificados</span>' +
    '<span><span class="fc-globo-overlay__dot fc-globo-overlay__dot--white"></span>sedes</span>' +
  '</div>' +
  '<div class="fc-globo-flags" id="fc-globo-flags"></div>' +
'</div>'
```

#### D) Funciones de render de los paneles

Añadir después de `hideMsg`:

```js
// ── Panel de detalle ─────────────────────────────────────────
function openDetail(html) {
  var panel = document.getElementById('fc-globo-detail');
  var body  = document.getElementById('fc-globo-detail-body');
  if (!panel || !body) return;
  body.innerHTML = html;
  panel.classList.add('is-open');
}

function closeDetail() {
  var panel = document.getElementById('fc-globo-detail');
  if (panel) panel.classList.remove('is-open');
}

function renderPanelPais(wikiData, nombrePais) {
  var w = wikiData || {};
  var badgeRonda = w.mejor ? '<span class="fc-globo-detail__badge">' + w.mejor + '</span>' : '';
  var coachLine = w.coach ? '<div class="fc-globo-detail__row"><span class="fc-globo-detail__lbl">Entrenador</span><span>' + w.coach + '</span></div>' : '';
  var estrella = w.estrella ? (
    '<div class="fc-globo-detail__estrella">' +
      '<span class="fc-globo-detail__estrella-pos">' + (w.estrella_pos || '') + '</span>' +
      '<span class="fc-globo-detail__estrella-nom">' + w.estrella + '</span>' +
      (w.estrella_club ? '<span class="fc-globo-detail__estrella-club">' + w.estrella_club + '</span>' : '') +
    '</div>'
  ) : '';
  return (
    '<div class="fc-globo-detail__hdr">' +
      '<span class="fc-globo-detail__title">' + nombrePais + '</span>' +
      '<span class="fc-globo-detail__sub">' + (w.apodo || '') + '</span>' +
    '</div>' +
    '<div class="fc-globo-detail__stats">' +
      (w.grupo ? '<div class="fc-globo-detail__row"><span class="fc-globo-detail__lbl">Grupo</span><span>' + w.grupo + '</span></div>' : '') +
      (w.confed ? '<div class="fc-globo-detail__row"><span class="fc-globo-detail__lbl">Confederación</span><span>' + w.confed + '</span></div>' : '') +
      '<div class="fc-globo-detail__row"><span class="fc-globo-detail__lbl">Mundiales</span><span>' + (w.mundiales || '—') + '</span></div>' +
      (w.mejor ? '<div class="fc-globo-detail__row"><span class="fc-globo-detail__lbl">Mejor resultado</span><span>' + w.mejor + '</span></div>' : '') +
      coachLine +
    '</div>' +
    (estrella ? '<div class="fc-globo-detail__section-lbl">Estrella</div>' + estrella : '') +
    (w.frase ? '<p class="fc-globo-detail__frase">"' + w.frase + '"</p>' : '') +
    '<div class="fc-globo-detail__attr">Datos: sport.es / Wikipedia CC BY-SA</div>'
  );
}

function renderPanelSede(wikiData, nombreSede) {
  var w = wikiData || {};
  var isFinal = w.max_ronda && w.max_ronda.includes('FINAL');
  return (
    '<div class="fc-globo-detail__hdr fc-globo-detail__hdr--sede">' +
      '<span class="fc-globo-detail__title">📍 ' + (w.estadio || nombreSede) + '</span>' +
      '<span class="fc-globo-detail__sub">' + (w.pais || '') + '</span>' +
    '</div>' +
    '<div class="fc-globo-detail__stats">' +
      (w.capacidad ? '<div class="fc-globo-detail__row"><span class="fc-globo-detail__lbl">Capacidad</span><span>' + w.capacidad.toLocaleString('es') + '</span></div>' : '') +
      (w.inauguracion ? '<div class="fc-globo-detail__row"><span class="fc-globo-detail__lbl">Inaugurado</span><span>' + w.inauguracion + '</span></div>' : '') +
      (w.equipo_local ? '<div class="fc-globo-detail__row"><span class="fc-globo-detail__lbl">Equipo local</span><span>' + w.equipo_local + '</span></div>' : '') +
      (w.max_ronda ? '<div class="fc-globo-detail__row"><span class="fc-globo-detail__lbl">Hasta</span><span class="' + (isFinal ? 'fc-globo-detail__final' : '') + '">' + w.max_ronda + '</span></div>' : '') +
    '</div>' +
    (w.dato ? '<p class="fc-globo-detail__frase">' + w.dato + '</p>' : '') +
    '<div class="fc-globo-detail__attr">Datos: sport.es</div>'
  );
}
```

#### E) Leyenda de banderas — función de render

Añadir función que construye la rejilla de 48 banderas:

```js
function renderFlagsLegend(globe) {
  var flagsEl = document.getElementById('fc-globo-flags');
  if (!flagsEl) return;
  var arr = (typeof window.EQUIPOS !== 'undefined') ? window.EQUIPOS
          : (typeof EQUIPOS !== 'undefined') ? EQUIPOS : [];
  if (!arr.length) return;

  var html = arr.map(function(e) {
    var flag = e.flag || e.flag_emoji || '';
    var name = e.name || e.name_en || '';
    var nameEn = e.name_en || name;
    // Coordenadas: usar las de EQUIPOS si existen, si no usar centroide aproximado
    var lat = e.lat || 0;
    var lng = e.lng || 0;
    return (
      '<button type="button" class="fc-globo-flag-btn" ' +
        'data-name-en="' + nameEn.replace(/"/g, '&quot;') + '" ' +
        'data-lat="' + lat + '" data-lng="' + lng + '" ' +
        'title="' + name + '">' +
        '<span class="fc-globo-flag-btn__flag">' + flag + '</span>' +
        '<span class="fc-globo-flag-btn__name">' + name + '</span>' +
      '</button>'
    );
  }).join('');

  flagsEl.innerHTML = html;

  // Event delegation
  flagsEl.addEventListener('click', function(e) {
    var btn = e.target.closest('.fc-globo-flag-btn');
    if (!btn || !globe) return;
    var nameEn = btn.dataset.nameEn;
    var lat    = parseFloat(btn.dataset.lat);
    var lng    = parseFloat(btn.dataset.lng);

    // Si no hay coordenadas en EQUIPOS, buscar en el polígono GeoJSON del globo
    // Fallback seguro: navegar al centroide del país desde los polygonsData
    var targetLat = lat;
    var targetLng = lng;
    if (!lat && !lng) {
      // Intentar extraer centroide de los polygons cargados
      var feats = globe.polygonsData ? globe.polygonsData() : [];
      var feat = feats.find(function(f) {
        return f.properties && (f.properties.name === nameEn || f.properties.esMundialName === nameEn);
      });
      if (feat && feat.geometry && feat.geometry.coordinates) {
        // Centroide muy aproximado: promedio de bbox
        var coords = feat.geometry.type === 'Polygon' ? feat.geometry.coordinates[0]
                   : feat.geometry.type === 'MultiPolygon' ? feat.geometry.coordinates[0][0] : [];
        if (coords.length) {
          var lons = coords.map(function(c) { return c[0]; });
          var lats = coords.map(function(c) { return c[1]; });
          targetLng = (Math.min.apply(null, lons) + Math.max.apply(null, lons)) / 2;
          targetLat = (Math.min.apply(null, lats) + Math.max.apply(null, lats)) / 2;
        }
      }
    }

    // Detener autorotate temporalmente
    var ctrl = globe.controls ? globe.controls() : null;
    if (ctrl) { ctrl.autoRotate = false; }

    globe.pointOfView({ lat: targetLat, lng: targetLng, altitude: 2.2 }, 800);

    setTimeout(function() {
      if (ctrl) { ctrl.autoRotate = true; ctrl.autoRotateSpeed = 0.4; }
    }, 3000);

    // Abrir panel de detalle
    var wikiData = getWikiSel(nameEn);
    openDetail(renderPanelPais(wikiData, btn.querySelector('.fc-globo-flag-btn__name').textContent));

    // Highlight visual del botón
    flagsEl.querySelectorAll('.fc-globo-flag-btn').forEach(function(b) { b.classList.remove('is-active'); });
    btn.classList.add('is-active');
  });
}
```

#### F) Conectar `onPolygonClick` y `onPointClick` al globo

Dentro de `initGlobo`, después de `.polygonLabel(...)` y `.pointLabel(...)` existentes, añadir:

```js
// Click en país
globe.onPolygonClick(function(feat) {
  if (!feat || !feat.properties) return;
  var name = feat.properties.name || '';
  // Obtener wiki data
  var wikiData = getWikiSel(name);
  if (!wikiData && !feat.properties.esMundial) return; // ignorar países no clasificados sin datos
  openDetail(renderPanelPais(wikiData, name));
  // Navegar al país clickado
  var ctrl = globe.controls ? globe.controls() : null;
  if (ctrl) ctrl.autoRotate = false;
  var bbox = feat.geometry && feat.geometry.coordinates;
  // pointOfView al centroide aproximado del polígono clickado
  if (globe._lastClickCoords) {
    globe.pointOfView({ lat: globe._lastClickCoords.lat, lng: globe._lastClickCoords.lng, altitude: 2.2 }, 600);
  }
  setTimeout(function() { if (ctrl) { ctrl.autoRotate = true; ctrl.autoRotateSpeed = 0.4; } }, 3000);
});

// Click en sede
globe.onPointClick(function(point) {
  if (!point) return;
  var wikiData = (typeof window.WIKI_SEDES !== 'undefined') ? window.WIKI_SEDES[point.nameKey || point.name] : null;
  openDetail(renderPanelSede(wikiData, point.name));
  var ctrl = globe.controls ? globe.controls() : null;
  if (ctrl) ctrl.autoRotate = false;
  globe.pointOfView({ lat: point.lat, lng: point.lng, altitude: 1.5 }, 800);
  setTimeout(function() { if (ctrl) { ctrl.autoRotate = true; ctrl.autoRotateSpeed = 0.4; } }, 3000);
});

// Guardar coords del último click de ratón para el onPolygonClick
canvasEl.addEventListener('click', function(e) {
  // globe.gl expone toGlobeCoords si está disponible
  if (globe.toGlobeCoords) {
    var coords = globe.toGlobeCoords(e.offsetX, e.offsetY);
    globe._lastClickCoords = coords;
  }
});
```

#### G) Iniciar leyenda de banderas tras cargar el globo

En `openOverlay`, después de `window._globoInstance = g`:

```js
.then(function(g) {
  window._globoInstance = g;
  renderFlagsLegend(g);  // ← AÑADIR ESTA LÍNEA
})
```

Y también en el path de instancia cacheada (cuando el globo ya está inicializado):

```js
if (window._globoInstance) {
  // ... código existente de resize ...
  hideMsg(msg);
  renderFlagsLegend(window._globoInstance); // ← AÑADIR
  return;
}
```

#### H) Cerrar panel de detalle

En `ensureOverlay`, añadir handler para el botón de cierre del panel:

```js
// Añadir después del handler de closeBtn existente:
overlay.addEventListener('click', function(e) {
  if (e.target.id === 'fc-globo-detail-close') closeDetail();
});
```

---

## PR3 — CSS para el panel de detalle y leyenda de banderas

### `public/css/components/globo-equipos.css` — añadir al final

```css
/* ── Leyenda de banderas ──────────────────────────────────────── */
.fc-globo-overlay__leg {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.fc-globo-overlay__leg-items {
  display: flex;
  gap: 16px;
  justify-content: center;
  font-size: 11px;
  color: rgba(255,255,255,0.7);
  padding: 0 12px;
}

.fc-globo-flags {
  display: flex;
  flex-wrap: wrap;
  gap: 4px 6px;
  padding: 8px 12px;
  max-height: 96px;
  overflow-y: auto;
  border-top: 1px solid rgba(232,184,48,0.15);
  -webkit-overflow-scrolling: touch;
  scrollbar-width: thin;
  scrollbar-color: rgba(232,184,48,0.3) transparent;
}

.fc-globo-flag-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 4px 6px;
  border: 1px solid transparent;
  border-radius: 6px;
  background: transparent;
  cursor: pointer;
  transition: background 0.15s, border-color 0.15s;
  color: rgba(255,255,255,0.75);
  font-size: 9px;
  line-height: 1.2;
  text-align: center;
  min-width: 36px;
  max-width: 44px;
}

.fc-globo-flag-btn__flag {
  font-size: 18px;
  line-height: 1;
  display: block;
}

.fc-globo-flag-btn__name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  width: 100%;
  font-size: 8px;
}

.fc-globo-flag-btn:hover,
.fc-globo-flag-btn:focus-visible {
  background: rgba(232,184,48,0.12);
  border-color: rgba(232,184,48,0.35);
  color: #fff;
  outline: none;
}

.fc-globo-flag-btn.is-active {
  background: rgba(232,184,48,0.2);
  border-color: #e8b830;
  color: #e8b830;
}

/* ── Panel de detalle lateral ─────────────────────────────────── */
.fc-globo-detail {
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  background: rgba(12,18,32,0.96);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
  border-top: 1px solid rgba(232,184,48,0.25);
  border-radius: 16px 16px 0 0;
  padding: 16px 16px 24px;
  transform: translateY(100%);
  transition: transform 0.28s cubic-bezier(0.34, 1.1, 0.64, 1);
  z-index: 20;
  max-height: 55%;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
}

.fc-globo-detail.is-open {
  transform: translateY(0);
}

@media (min-width: 768px) {
  .fc-globo-detail {
    left: auto;
    right: 16px;
    bottom: 16px;
    top: 60px;
    width: 300px;
    max-height: calc(100% - 80px);
    border-radius: 12px;
    border: 1px solid rgba(232,184,48,0.25);
    transform: translateX(120%);
  }
  .fc-globo-detail.is-open {
    transform: translateX(0);
  }
}

.fc-globo-detail__close {
  position: absolute;
  top: 10px;
  right: 12px;
  background: transparent;
  border: none;
  color: rgba(255,255,255,0.5);
  font-size: 16px;
  cursor: pointer;
  padding: 4px 6px;
  border-radius: 4px;
  line-height: 1;
  transition: color 0.15s;
}
.fc-globo-detail__close:hover { color: #fff; }

.fc-globo-detail__hdr {
  display: flex;
  flex-direction: column;
  gap: 2px;
  margin-bottom: 12px;
  padding-right: 32px;
}

.fc-globo-detail__title {
  font-size: 15px;
  font-weight: 700;
  color: #e8b830;
  line-height: 1.2;
}

.fc-globo-detail__sub {
  font-size: 11px;
  color: rgba(255,255,255,0.55);
  font-style: italic;
  letter-spacing: 0.04em;
}

.fc-globo-detail__stats {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-bottom: 10px;
}

.fc-globo-detail__row {
  display: flex;
  justify-content: space-between;
  align-items: baseline;
  font-size: 11px;
  color: rgba(255,255,255,0.85);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  padding-bottom: 5px;
}

.fc-globo-detail__lbl {
  color: rgba(255,255,255,0.45);
  font-size: 10px;
  text-transform: uppercase;
  letter-spacing: 0.06em;
}

.fc-globo-detail__final {
  color: #e8b830;
  font-weight: 700;
}

.fc-globo-detail__section-lbl {
  font-size: 9px;
  text-transform: uppercase;
  letter-spacing: 0.08em;
  color: rgba(232,184,48,0.6);
  margin: 10px 0 6px;
}

.fc-globo-detail__estrella {
  display: flex;
  align-items: center;
  gap: 8px;
  background: rgba(232,184,48,0.08);
  border: 1px solid rgba(232,184,48,0.2);
  border-radius: 8px;
  padding: 8px 10px;
  margin-bottom: 10px;
}

.fc-globo-detail__estrella-pos {
  font-size: 9px;
  color: rgba(255,255,255,0.4);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  min-width: 60px;
}

.fc-globo-detail__estrella-nom {
  font-size: 13px;
  font-weight: 700;
  color: #fff;
  flex: 1;
}

.fc-globo-detail__estrella-club {
  font-size: 10px;
  color: rgba(255,255,255,0.45);
}

.fc-globo-detail__frase {
  font-size: 11px;
  color: rgba(255,255,255,0.6);
  line-height: 1.5;
  font-style: italic;
  margin: 8px 0;
  padding: 8px 10px;
  border-left: 2px solid rgba(232,184,48,0.4);
}

.fc-globo-detail__attr {
  font-size: 9px;
  color: rgba(255,255,255,0.25);
  margin-top: 12px;
  text-align: right;
}
```

---

## Verificaciones obligatorias de Code

### Antes de commit
1. `npm run build` — debe completar sin errores
2. `grep -r "fc-globo-detail" dist/` — debe encontrar el CSS en el bundle
3. `grep -r "WIKI_SELECCIONES" dist/` — debe aparecer en el bundle

### QA manual en localhost:5173
1. Abrir Grupos → cinta del globo visible
2. Click cinta → overlay abre
3. Esperar que cargue → aparece leyenda de banderas (rejilla scrollable, ~48 items)
4. Click en una bandera → globo navega (animación `pointOfView`) + panel detalle aparece desde abajo (mobile) o derecha (desktop)
5. Panel muestra: nombre del país, apodo, grupo, confederación, mundiales, mejor resultado, entrenador (si hay), estrella, frase
6. Click en punto blanco (sede) → globo navega + panel con datos del estadio
7. Click ✕ del panel → panel cierra, globo sigue rotando
8. Click ✕ del overlay → todo cierra limpio, `body.overflow` reseteado
9. Resize ventana → panel se adapta (bottom sheet en mobile, sidebar en desktop ≥768px)

### Commits
- Commit 1: `feat: add wiki-data-globo.js with 45 teams + 16 venues`
- Commit 2: `feat(globo): PR2+PR3 flag legend + detail panel`
- Push inmediato tras cada commit

### Al terminar
Reportar a Claude.ai:
- SHA de los dos commits
- Output de `npm run build` (últimas 5 líneas)
- Cualquier desviación del brief (qué y por qué)
- Si `EQUIPOS[].lat/lng` existe o no (determina si el centroide fallback es necesario)

---

## Notas adicionales

**`EQUIPOS[].lat/lng`**: Verificar en `data.js` si los objetos de EQUIPOS tienen coordenadas `lat`/`lng`. Si no las tienen, el fallback de centroide desde `polygonsData()` es el camino correcto (ya está en el brief). Si las tienen, simplificar `renderFlagsLegend` para leer directamente de ahí.

**Tamaño de `wiki-data-globo.js`**: 24 KB. Por debajo del umbral de 70 KB que bloquea el MCP deploy (pero este es JS frontend, no EF — no aplica ese límite).

**Paleta de colores**: Reutilizar exactamente los de `COL` ya definidos en el globo (`COL.GOLD`, `COL.OCEAN`, etc.) en el CSS cuando sea posible via variables CSS. Si no están expuestos como CSS vars, los valores HEX son `#e8b830` (gold), `#1e4d6b` (ocean), `#3d4f2e` (land).

**`globe.onPolygonClick` vs `globe.onPolygonRightClick`**: La API de globe.gl@2.33.0 expone `onPolygonClick(fn)` para click izquierdo — confirmar que está disponible en esa versión antes de usar. Si no existe, usar el event listener de `click` en `canvasEl` + `globe.polygonsData()` + hit testing manual (menos elegante pero funcional).

**Accesibilidad**: Los `<button>` de la leyenda de banderas ya tienen `title` con el nombre del país. Suficiente para el nivel de accesibilidad de una app privada de amigos.
