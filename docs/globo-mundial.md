# Globo Mundial 2026 — arquitectura

Documento de referencia del componente "Globo de selecciones" (cinta + overlay 3D + panel de detalle). Toda la implementación vive en dos archivos: `public/js/ui-globo-equipos.js` (~750 LOC) y `public/css/components/globo-equipos.css` (~590 LOC), namespace CSS `fc-globo-*`.

## Origen

- **PR #54 (06may2026, SHA `8e6681c`)** — MVP. Cinta dorada en `#page-grupos` que abre overlay full-screen con globo 3D + 47 polígonos dorados (UK cubre England+Scotland) + 16 sedes blancas + tooltips on hover.
- **`feature/globo-pr2-pr3` (06may2026, 12 commits desde `99fb581`)** — Enrichment. Leyenda con banderas circulares Supabase + chips de sedes scrollables, panel de detalle país + sede, highlight rojo del país clickado, centroides override, leyenda tipos en lateral, separadores de grupo en carrusel. Pendiente squash-merge a main.

## Stack

- **`globe.gl@2.33.0`** lazy-loaded vía CDN `cdn.jsdelivr.net/npm/globe.gl@2.33.0` al primer click. Cero impacto en bundle inicial.
- **GeoJSON Natural Earth 50m** vía `cdn.jsdelivr.net/gh/nvkelso/natural-earth-vector` (`~3 MB`, fetch externo). Cero archivos de datos en repo.
- **Banderas**: bucket Supabase `cmyfyswystjgzdwbqyyb.supabase.co/storage/v1/object/public/flags/<ISO3>.png`. Source: `EQUIPOS[].flag` (códigos ISO 3-letras).
- **Datos enriquecidos**:
  - `public/js/data/wiki-data-globo.js` — 45 selecciones + 16 sedes (apodo, grupo, confederación, mundiales, mejor resultado, entrenador, estrella + club + posición, frase). Fuente: sport.es.
  - `public/js/data/wiki-bio.js` v3 — 48 selecciones (apodo, formación, frase, bio sport.es, bio_espn ESPN). Fuente: sport.es + ESPN. Las 4 selecciones nuevas v3 (Turkey, Sweden, DR Congo, Iraq) tienen ficha completa.

## Cadena de carga

`js/main-entry.js` carga en orden via `loadScript`:

```
… → ui-groups-mobile.js → data/wiki-data-globo.js → data/wiki-bio.js → ui-globo-equipos.js → ko.js → …
```

`ui-globo-equipos.js` expone `window._mountGloboCinta(container)` — invocado desde `_renderGruposLetterBar` (idempotente vía `_ensureGloboCintaMount`).

## Arquitectura JS — `ui-globo-equipos.js`

### Datos const

| Símbolo | Contenido |
|---|---|
| `GLOBE_GL_CDN`, `GEOJSON_URL` | URLs fuente |
| `ALIAS_NE` | EQUIPOS.name_en → nombre Natural Earth (e.g. `'England' → 'United Kingdom'`) |
| `ALIAS_WIKI` | EQUIPOS.name_en o NE name → key WIKI_SELECCIONES/WIKI_BIO (e.g. `'South Korea' → 'Korea'`, `'Bosnia and Herz.' → 'Bosnia & Herzegovina'`) |
| `SEDES` | 16 sedes (`{ name, lat, lng, nameKey }`). `nameKey` matchea WIKI_SEDES |
| `COUNTRY_LATLNG_OVERRIDE` | 12 países con bounding box engañoso. Override gana sobre EQUIPOS.lat/lng y centroide. Ej: `'United States': { lat: 39.5, lng: -98.5 }` (Kansas, no Pacífico por Alaska) |
| `COL` | Paleta — OCEAN/LAND/GOLD/ATMOS + SEL_CAP/SEL_STROK/SEL_SIDE para highlight rojo |
| `ISO3_TO_FLAG` | Tabla emoji fallback (legacy, ya no se usa para banderas — el flag bucket Supabase es el path principal) |

### Estado

| Variable | Tipo | Significado |
|---|---|---|
| `_libPromise` | `Promise` | Cache del lazy-load de globe.gl |
| `window._globoInstance` | globe.gl instance | Cache para reabrir el overlay sin reconstruir |
| `_selectedNE` | `string \| null` | Nombre NE normalizado del país resaltado en rojo |
| `_selectedSede` | `string \| null` | Nombre de la sede resaltada (rojo elevado) |

### Helpers

| Función | Rol |
|---|---|
| `norm(name)` | Aplica ALIAS_NE para normalizar nombres EQUIPOS → NE 50m |
| `getWikiSel(name_en)` | Lookup WIKI_SELECCIONES con resolución vía ALIAS_WIKI |
| `getWikiKey(name_en)` | Devuelve la key canónica WIKI (alias resuelto) — usada como 3er arg en `renderPanelPais` para que `WIKI_BIO[nameEn]` funcione cuando NE name ≠ WIKI key |
| `getFlagEmoji(equipo)` | (legacy) Emoji directo o ISO3 → emoji o inicial |
| `selectCountry(nameEn, globe)` | Setea `_selectedNE` (vía `norm`) + dispara re-render `globe.polygonsData(globe.polygonsData())` |
| `selectSede(name, globe)` | Setea `_selectedSede` + re-render `globe.pointsData(globe.pointsData())` |
| `resetCountry(globe)` | Limpia banderas/chips `is-active`, resetea `_selectedSede`, re-render points; si había `_selectedNE`, deselecciona + anima `pointOfView` al inicial 5.0/4.2 |
| `hideGlobeTooltip()` | `display:none` + reset `setTimeout 50ms` para tooltips `.scene-tooltip` colgados al cubrirse el cursor con el panel |
| `openDetail(html)` / `closeDetail()` | Mostrar/ocultar el panel `#fc-globo-detail`. `openDetail` llama a `hideGlobeTooltip` primero |
| `renderPanelPais(wikiData, nombrePais, nameEn)` | Build HTML del panel país: header (título + apodo + pill formación) + frase italic + stats (grupo/confed/mundiales/mejor/coach) + estrella + dos `<details>` colapsables (`📖 Sobre el equipo` / `⚽ Análisis táctico`) + botón `🏟 Ver plantilla` (stub PR4) + atribución |
| `renderPanelSede(wikiData, nombreSede)` | Build HTML del panel sede: estadio + país + capacidad + inauguración + equipo local + ronda máxima + dato |
| `renderFlagsLegend(globe)` | Render carrusel banderas (idempotente). `forEach` con separadores A/B/C... cada 4 items + delegation click |
| `renderSedesLegend(globe)` | Render carrusel chips sedes (idempotente) + delegation click |

### Patrón polygonsData re-render

`globe.gl@2.33.0` no tiene API de "redraw with current data". Para forzar re-render de los callbacks de color tras cambiar `_selectedNE`, el patrón es:

```js
globe.polygonsData(globe.polygonsData());
```

Pasar el mismo array re-dispara los callbacks `polygonCapColor`/`StrokeColor`/`SideColor` (que cierran sobre `_selectedNE`). Mismo truco con `pointsData(pointsData())` para sedes.

### Patrón polygonClick coords

`globe.onPolygonClick(feat)` da el feature pero no las coordenadas exactas del click. Para animar `pointOfView` al punto donde el usuario tocó:

```js
canvasEl.addEventListener('click', function (e) {
  if (typeof globe.toGlobeCoords === 'function') {
    var rect = canvasEl.getBoundingClientRect();
    var coords = globe.toGlobeCoords(e.clientX - rect.left, e.clientY - rect.top);
    if (coords) globe._lastClickCoords = coords;
  }
});
```

Luego `onPolygonClick` lee `globe._lastClickCoords` para el target del `pointOfView`. Cross-browser: `getBoundingClientRect` + `clientX/Y` (no `e.offsetX/Y`).

## Arquitectura CSS — `globo-equipos.css`

### Layout overlay

```
.fc-globo-overlay { position: fixed; inset: 0; display: flex; flex-direction: column }
.fc-globo-overlay.is-open { display: flex }   /* NO display:block — flex column requerido */

  .fc-globo-overlay__hdr     { position: absolute; top: 0; … }     /* fuera de flex */
  .fc-globo-overlay__msg     { position: absolute; top:50%; … }    /* fuera de flex */
  .fc-globo-overlay__leg-items { position: absolute; right:12; top:50%; … } /* lateral derecho */
  .fc-globo-overlay__canvas  { flex: 1 1 0; min-height: 0 }        /* crece */
  .fc-globo-overlay__leg     { flex-shrink: 0 }                    /* reserva espacio inferior */
    .fc-globo-flags          { overflow-x: auto; nowrap }           /* carrusel banderas */
    .fc-globo-sedes          { overflow-x: auto; nowrap }           /* carrusel chips sedes */
  .fc-globo-detail           { position: absolute; bottom:0 → translateY(100%) }
    .fc-globo-detail.is-open { transform: translateY(0) }           /* bottom-sheet mobile */
```

### Breakpoint desktop

`@media (min-width: 768px)` → `.fc-globo-detail` pasa de bottom-sheet a sidebar derecho (300px wide, top:60 bottom:16 right:16, `transform: translateX(120%)` cerrado / `translateX(0)` abierto).

### Pill formación

```css
.fc-globo-detail__hdr { display: flex; flex-direction: column; align-items: flex-start }
.fc-globo-detail__pill-formacion {
  display: inline-flex; align-items: center; gap: 4px;
  width: auto; max-width: max-content; flex: 0 0 auto; align-self: flex-start;  /* anti-stretch */
  background: rgba(232,184,48,0.15); border: 1px solid #e8b830; color: #e8b830;
  border-radius: 999px; padding: 2px 10px; font-family: monospace;
}
.fc-globo-detail__pill-label { text-transform: uppercase; font-size: 10px; opacity: 0.8 }
```

Sin `align-items:flex-start` en el padre y `align-self:flex-start` en la pill, el flex column la estira al ancho cross-axis (ERR-41).

## Datos: WIKI_BIO v3

Cada entry tiene 5 fields:

```js
'Mexico': {
  apodo: 'El Tri',
  formacion: '4-2-3-1/4-3-3',
  frase: "El problema del doble '9'",
  bio: 'México es historia viva …',          // sport.es narrativo
  bio_espn: 'Los anfitriones encaran el 2026 …'  // ESPN táctico
}
```

### Proceso de scraping

1. **Fuentes**:
   - sport.es Guía Mundial 2026 (`sport.es/es/futbol/guia-mundial-2026-sh/`) — narrativa + apodo + estrella + datos.
   - ESPN análisis táctico → `bio_espn` (formación + frase + bio táctico).
2. **Versiones**:
   - **v1** (44 entries) — solo apodo + bio, faltaban Turkey/Sweden/DR Congo/Iraq.
   - **v2** (48 entries) — añade formación + frase + bio_espn. Bug regex non-greedy truncaba frases con comillas anidadas (Alemania `"Presionar alto, dejar que los"`). Bug parser tildes (`"Panam á"`).
   - **v3 (estable)** — fix regex greedy + clean_html que normaliza espacios tras vocales acentuadas. Validado en QA mobile.
3. **Validación post-scrape**:
   - `assert "Panam á" not in bio` y similares para entradas conocidas.
   - Conteo par de comillas dobles en cada `frase`.
4. **Atribución**: `Datos: sport.es + ESPN / Wikipedia CC BY-SA` en footer del panel detalle.

ERR relacionados: **ERR-39** (regex non-greedy frases), **ERR-40** (espacios falsos tildes ESPN).

## Triggers de cambio

| Caso | Acción |
|---|---|
| Nueva selección o cambio de squad real | Actualizar `EQUIPOS[]` en `data.js`. Globo se re-construye sólo (Set de PAISES viene de EQUIPOS) |
| Re-tunear bandera con bounding box engañoso | Añadir override en `COUNTRY_LATLNG_OVERRIDE` |
| Nueva versión de WIKI_BIO | Reemplazar `public/js/data/wiki-bio.js` con la nueva versión completa. Validar 5 fields × 48 entries |
| Cambio de bucket de banderas Supabase | Actualizar `SUPABASE_FLAGS` const en `renderFlagsLegend` |
| Cambio de método globe.gl pinneado | Validar contra `unpkg.com/globe.gl@<version>/` antes de implementar (ERR-38) |

## Pendientes

- **PR4 (post-merge)**: screen plantilla con campo de fútbol + 11 titular + convocatoria + entrenador, cuando salgan squads reales (~junio 2026). El stub `window._globoNavPlantilla` ya está en `ui-globo-equipos.js` esperando ser sobreescrito por el módulo real.
- **Limpieza dead code**: `getFlagEmoji` + `ISO3_TO_FLAG` quedaron sin uso tras migrar al bucket Supabase. Candidato a limpieza en sprint de housekeeping si el bucket cubre con confianza los 48 ISO3.
