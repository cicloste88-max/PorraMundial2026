# Porra Mundial 2026 — Prototipo

## Pantallas
- `mundial-2026.html` → Fase de Grupos (12 grupos, zoom de predicción, cálculo de clasificación)
- `eliminatorias-2026.html` → Bracket FIFA M73-M104 (16avos · 8vos · 4tos · Semis · Final con tercer puesto)

## Cómo usarlo
1. Coloca todos los archivos manteniendo la estructura de carpetas.
2. Sirve la carpeta con cualquier servidor estático:
   - `npx serve .`
   - `python3 -m http.server`
   - O abrir los HTML directamente (algunos navegadores requieren servir vía HTTP).
3. Las predicciones se guardan en localStorage del navegador.

## Recursos externos (cargados desde Internet)
- Google Fonts: Saira + Inter (auto-cargadas)
- Imágenes del proyecto (Supabase Storage):
  - Logo Mundial 2026
  - Trofeo
  - Logo FIFA (header)
  - Background del marco

## Estructura
```
porra-mundial-2026/
├── mundial-2026.html          ← Fase de Grupos
├── mundial-2026.css           ← Estilos compartidos
├── groups-app.js              ← Lógica grupos
├── groups-data.js             ← 12 grupos · 48 equipos
├── eliminatorias-2026.html    ← Bracket KO
├── eliminatorias-2026.css     ← Estilos KO + vista Final
├── eliminatorias-app.js       ← Lógica bracket + countdown
├── eliminatorias-data.js      ← Matchups oficiales FIFA M73-M104
└── flags/                     ← 48 banderas SVG con efecto tela
    ├── Argentina.svg
    ├── Spain.svg
    └── ... (48 archivos)
```

## Botones de utilidad
- **Demo · precargar** → rellena pronósticos de ejemplo para ver los estados activos.
- **Borrar pronósticos** → resetea localStorage.

Toca/click en cualquier grupo o cruce → zoom-in para pronosticar.
ESC o ✕ para cerrar.
