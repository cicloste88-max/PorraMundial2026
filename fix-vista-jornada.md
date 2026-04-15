# Fix vista Jornada — 2 problemas
# 1. jornada-container no aparece al clickar pestaña (display:'' no sobreescribe CSS)
# 2. _sbData no está disponible al entrar a Jornada por primera vez

---

## A · `public/js/ui-groups.js` — setVistaGrupos: display block en lugar de ''

BUSCAR exactamente:
```js
  if (vista === 'grupos') {
    if (gruposContainer)  gruposContainer.style.display  = '';
    if (jornadaContainer) jornadaContainer.style.display = 'none';
```

REEMPLAZAR POR:
```js
  if (vista === 'grupos') {
    if (gruposContainer)  gruposContainer.style.display  = 'block';
    if (jornadaContainer) jornadaContainer.style.display = 'none';
```

Y BUSCAR:
```js
  } else {
    if (gruposContainer)  gruposContainer.style.display  = 'none';
    if (jornadaContainer) jornadaContainer.style.display = '';
```

REEMPLAZAR POR:
```js
  } else {
    if (gruposContainer)  gruposContainer.style.display  = 'none';
    if (jornadaContainer) jornadaContainer.style.display = 'block';
```

---

## B · `public/js/ui-groups.js` — _buildJornadaRanking: cargar sbData si no está disponible

BUSCAR exactamente:
```js
function _buildJornadaRanking() {
  // Usar _sbData si está cargado, si no mostrar mensaje
  if (!window._sbData || window._sbData.length === 0) {
    return '<div class="jornada-ranking">' +
      '<div class="jornada-ranking-title">🏆 Clasificación</div>' +
      '<div style="font-size:11px;color:#4b5563;text-align:center;padding:12px 0">' +
        'Cargando...' +
      '</div></div>';
  }
```

REEMPLAZAR POR:
```js
function _buildJornadaRanking() {
  // Si _sbData no está disponible, disparar carga y devolver placeholder
  if (!window._sbData || window._sbData.length === 0) {
    // Intentar cargar scoreboard si la función existe
    if (typeof sbLoad === 'function') {
      sbLoad().then(() => {
        // Tras cargar, re-renderizar si seguimos en vista jornada
        if (_vistaActual === 'jornada') renderVistaJornada();
      });
    }
    return '<div class="jornada-ranking">' +
      '<div class="jornada-ranking-title">🏆 Clasificación</div>' +
      '<div style="font-size:11px;color:#4b5563;text-align:center;padding:12px 0">' +
        'Cargando clasificación...' +
      '</div></div>';
  }
```

---

## Verificación
```bash
node --check public/js/ui-groups.js && echo "OK"
npm run build 2>&1 | tail -3
```

Consola:
```js
setVistaGrupos('jornada')
// grupos-container debe ocultarse, jornada-container debe aparecer con tarjetas
document.getElementById('jornada-container').style.display  // "block"
```

## Commit
```bash
git add public/js/ui-groups.js
git commit -m "fix: vista Jornada — display block en setVistaGrupos, cargar sbData si ausente"
git push origin main
```
