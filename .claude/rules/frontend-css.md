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
