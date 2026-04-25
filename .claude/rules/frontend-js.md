---
description: Reglas al tocar JS del frontend
globs:
  - "public/js/**"
  - "js/main-entry.js"
---

# Reglas — Frontend JS

## Cuándo se carga esta regla

Aplica al editar cualquier archivo `.js` bajo `public/js/` o el punto de entrada `js/main-entry.js`.

## Patrón DOMContentLoaded defensivo

NO usar `addEventListener('DOMContentLoaded', ...)` directamente en classic scripts cargados vía `loadScript`. En su lugar:

```js
const runInit = () => {
  // lógica de inicialización
};

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', runInit);
} else {
  runInit();
}
```

Esta estructura garantiza que `runInit()` se ejecute tanto si el DOM aún está parseándose como si ya está listo. Red de seguridad adicional en `main-entry.js`.

Referencia: ERR-01.

## var vs const top-level

En classic scripts (no modules), solo `var` declarado a nivel top-level se expone como propiedad de `window`. Declaraciones con `const` y `let` permanecen confinadas a scope léxico y NO son accesibles como `window.nombreVariable`.

```js
var expuestoEnWindow = 'valor';   // window.expuestoEnWindow disponible
const noExpuesto = 'valor';        // window.noExpuesto === undefined
let tampocoExpuesto = 'valor';     // window.tampocoExpuesto === undefined
```

Si un módulo necesita exponerse globalmente (para HTML inline o scripts inyectados dinámicamente), declarar con `var` o asignar explícitamente al final del módulo:

```js
window.miApi = { metodo: () => {} };
```

Nunca asumir `window.X` para globals declarados con `const`/`let`. Referencia: ERR-02.

## Shims inline en index.html

Las líneas 1440–1445 de `index.html` contienen shims inline para `handleCTA()` y `openAuthModal()`. Existen como salvaguarda: si un evento `onclick` HTML se dispara antes de que `auth.js` cargue, los shims previenen error de referencia indefinida.

**No eliminar estos shims.** Son defensa de inicialización de bajo coste contra timing adverso.

## Badge-with-flag-fallback

Patrón permanente para imágenes de equipo (bandera + nombre). Toda `<img>` de bandera debe tener handler `onerror` o clase CSS condicional que aplique fallback (icono genérico o fondo + iniciales) si la imagen falla. Garantiza que la UI permanece funcional aunque el CDN de banderas esté lento o indisponible.

Mantener este patrón en todos los contextos donde se renderizan equipos: tablas, tarjetas, listas, modales.

## dice.js dentro de admin.js

`dice.js` no debe separarse en archivo independiente. Permanece integrado dentro de `admin.js` como utilidad interna. Si la funcionalidad de dados crece, expandir dentro del mismo archivo. NO anticipar refactor.
