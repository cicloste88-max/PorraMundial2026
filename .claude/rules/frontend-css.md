---
description: Reglas al tocar CSS del frontend
globs:
  - "**/*.css"
  - "public/css/**"
---

# Reglas — Frontend CSS

## Cuándo se carga esta regla

Esta regla se aplica al editar cualquier fichero `.css` del proyecto o al verificar que los estilos se han integrado correctamente en el build de producción.

## CSS vive en `public/css/`

Vite únicamente copia contenidos bajo `public/` hacia `dist/` durante el build. Cualquier fichero CSS ubicado en la raíz del repositorio (como estaba `css/` antes) será ignorado por el proceso de construcción. Esto causa que los estilos no aparezcan en producción incluso si están referenciados en el código.

Referencia: ERR-18.

## Referencias en `index.html`

Existen siete enlaces `<link rel="stylesheet">` en el `<head>` de `index.html`, todos apuntando a rutas con prefijo `/css/fichero.css`. Los estilos inline que estaban dentro de etiquetas `<style>` fueron extraídos a ficheros dedicados en el commit `9e93fe8`. Cualquier nuevo CSS deberá enlazarse siguiendo este mismo patrón.

## Verificación obligatoria post-build

Tras modificar cualquier fichero CSS o antes de mergear cambios de diseño a `main`:

```bash
npm run build && grep -l "selector-esperado" dist/css/*.css
```

Si el selector no aparece en ningún fichero CSS dentro de `dist/css/`, abortar el merge. Un selector ausente en la versión compilada indica que el fichero no fue copiado o no está enlazado correctamente.

Referencia: ERR-22.

**Diagnóstico adicional**: si un elemento no refleja el estilo esperado, usar `getComputedStyle(elemento).propiedad` en la consola del navegador. Un valor `initial` o `auto` sugiere que el CSS no se está aplicando por falta de enlace en `index.html`, no por error lógico en el selector.

## Migración inline pendiente

Si `index.html` contiene etiquetas `<style>` con comentarios de la forma `Archivo destino : X.css`, son migraciones de estilos inline aún sin completar. Ejecutar la migración **antes** de añadir nuevas reglas a los ficheros CSS destino, para evitar duplicación y mantener la coherencia del árbol de estilos.

## `.container` legacy wrapper — paridad de pages

`ko.css` define `.container { max-width: 1440px; margin: 0 auto; padding: 0 20px 60px }` aplicado globalmente a cualquier `<div class="container">`. Pages SPA que están envueltas en este wrapper pierden 40px laterales (20×2) que pages top-level no sufren.

**Diferencia entre pages**:
- `#page-elim` — top-level (sin wrapper). Width útil = `viewport - body padding 32px`.
- `#page-grupos`, `#page-jornada`, `#page-directo`, `#page-predictor` — anidadas en `<div class="container">`. Width útil = `viewport - body padding 32px - container padding 40px = -72px`.

**Si tu page nueva (o existente) requiere paridad visual con Fase Final** (cards al ancho completo, scroll-snap carousels con slots ≥80vw, layouts width-sensitive), aplica override scoped:

```css
#page-{tu-page} > .container {
  padding-left: 0;
  padding-right: 0;
}
```

El padding lateral lo provee entonces el list-padre de la page (e.g. `#groups-container { padding: 0 12px 80px }` réplica de `.fc-elim-list`).

Validar con DOM inspector + `getComputedStyle`: la card o sección principal debe medir aprox `viewport - 32 - 24 = viewport - 56px` (16px body + 12px container interno). Si mide menos, hay padding doble.

Referencia: ERR-36 + Sprint B Grupos redesign (commit `b66aea9`).

## Stale querySelector tras refactor de clase CSS

Cuando se rename/drop de una clase CSS, **grep TODOS los selectores en JS** antes del commit. La clase puede vivir en:

- `document.querySelector('.foo')` / `querySelectorAll`.
- `element.classList.toggle('foo', cond)`, `add('foo')`, `remove('foo')`.
- `element.matches('.foo')`, `closest('.foo')`.
- `MutationObserver` con `attributeFilter: ['class']`.
- Plantillas inline en `innerHTML`/`outerHTML` que generan `class="foo"`.

```bash
# Buscar uso de la clase en cualquier selector JS o template
grep -rn "\.fc-grupos-mini" public/js/ js/
grep -rn "fc-grupos-mini" public/js/ js/ index.html
```

Si hay matches → renombrar/actualizar antes de eliminar la clase. Aplica también a `data-*` attributes y IDs.

Referencia: ERR-35 + Sprint B Grupos redesign (commit `8cad0d3` post drop de `.fc-grupos-mini`).

## Scroll-snap carousels — pattern sibling vs anidado

Carousels con `scroll-snap-type: x mandatory` y slots ≥80vw NO deben anidarse dentro de containers colapsables que tengan padding/margin internos. Margins+padding+borders consumen 60-100px del viewport disponible y los slots desbordan.

**Modelo correcto** (replicado de Fase Final `.fc-elim-row` + `.fc-elim-expanded`):
- Header colapsable como elemento independiente.
- Click → insertar `.expanded-section` como SIBLING después del header via `parentNode.insertBefore(expanded, sectionEl.nextSibling)`.
- Padding lateral lo da el list-padre, NO el container individual.
- Hidden source elements (e.g. tarjetas editables que un modal extrae) pueden vivir dentro del header via `display: none !important` scoped.

Referencia: ERR-37 + Sprint B Grupos redesign (commits `05f5dd4` + `2d8aec8`).
