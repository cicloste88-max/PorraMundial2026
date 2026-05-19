# Brief: Sprint Bracket KO — Porra Mundial 2026
> Generado por Claude.ai — 19-may-2026. Para Claude Code, sesión nueva.
> Branch base: main post-PR (Reglamento FIFA).

---

## GIT WORKFLOW

```bash
git fetch origin && git checkout main && git pull origin main
git checkout -b feat/bracket-ko
# Verificar SHA de main via GitHub API antes de empezar.
# Al final: git push -u origin feat/bracket-ko + PR hacia main.
```

---

## Estado actual del bracket (inventario)

### Lo que ya existe
- `public/js/v3/eliminatoria-v3.js` (~900 LOC): bracket UI completo para
  R32/R16/QF/SF/Final. Renderiza partidos con slots, banderas, predicciones KO.
- `public/js/ko.js`: `resolveAllSlots()` calcula 36 slots de grupos (1A-4L),
  8 mejores terceros (T_XXXX slots), y propaga W/L por rondas en cascada.
- Gate HF-Gate-Groups: bloquea acceso al bracket si grupos incompletos.
- Predicciones KO: tabla `ko_predictions` (clasificador por slot).

### Gaps confirmados

#### G1 — Slot mapping FIFA 2026 para mejores 3eros (P1)
FIFA 2026 asigna los 8 mejores terceros a slots R32 específicos según
**qué combinación de 12 grupos** aportó los 8 clasificados. La tabla oficial:

Los 8 mejores terceros provienen siempre de 8 de los 12 grupos (A-L).
FIFA publicará la tabla de asignación oficial antes del torneo. Hasta entonces,
el placeholder actual (`T_XXXX` slots genéricos en ko.js) es aceptable para la
porra. **Acción:** cuando FIFA publique la tabla, actualizar `resolveAllSlots()`
en `ko.js` con el mapping exacto. Pendiente confirmación oficial.

#### G2 — Goleador KO (F1, P0 blocker para 11-jun) (~280 LOC)
La UI del bracket no tiene picker de goleador para partidos KO.
Scope: overlay inline sobre cada match-card con lista de jugadores del equipo
clasificado (de `squads.jugadores`). Guarda en `ko_predictions.scorer`.
Ver brief anterior `outputs/BRIEF_SPRINT_COMPLETION_FLOW.md` para detalle.

#### G3 — Lock duro grupos→elim (F3, P0 blocker)
HF-Gate-Groups es un gate básico (banner). La regla final debe ser:
si el usuario intenta navegar a bracket sin grupos completos, redirigir
directamente al modal del primer grupo incompleto (overlay, no solo banner).
Implementar en `eliminatoria-v3.js::v3ElimMount()`.

---

## Scope de este sprint (ordenado por prioridad)

### P0 — F1: Goleador KO picker
**Ficheros:** `public/js/v3/eliminatoria-v3.js`, `public/css/` (nuevo bloque .ko-scorer)

Flujo:
1. Cada match-card KO muestra botón "Goleador" si el partido tiene clasificador asignado.
2. Click abre un overlay inline (no modal global) con la lista de jugadores del equipo
   predicho como ganador (via `resolvedSlots` + `squads.jugadores`).
3. Selección guarda `scorer` en `ko_predictions` via `supabase.from('ko_predictions').upsert`.
4. Si aún no hay clasificador asignado (slot no resuelto), el botón está deshabilitado.

Datos disponibles:
- `resolvedSlots[slot]` → nombre del equipo clasificado
- `squads` cargado en `data.js` o fetch lazy desde Supabase
- `ko_predictions` ya tiene columna `scorer` (verificar schema antes de asumir)

Verificar antes de implementar:
```sql
SELECT column_name, data_type
FROM information_schema.columns
WHERE table_name = 'ko_predictions'
ORDER BY ordinal_position;
```

### P1 — F3: Lock duro grupos→bracket
**Fichero:** `public/js/v3/eliminatoria-v3.js` función `v3ElimMount()`

Reemplazar el banner informativo actual por:
- Si grupos incompletos Y porra no cerrada: redirigir directamente al modal
  del primer grupo incompleto via `v3OpenZoomGrupos(letter)` + `showPage('grupos')`.
- El usuario ve el grupo a completar, no un mensaje de bloqueo.

### P2 — Slot mapping FIFA — ✅ RESUELTO (sprint Annex-C, 19-may-2026)
Implementado en `public/js/ko.js`: objeto `ANNEX_C` (495 combinaciones) consultado
desde `resolveAllSlots()` via clave de 8 letras sorted. Generador en
`scripts/gen-annex-c.mjs` (lee Wikipedia). Fallback secuencial legacy si la
clave no aparece o `ANNEX_C` está vacío. ERR-61.

> Nota F1/F3: ambos gaps ya estaban resueltos en código previo a este sprint
> (`v3OpenGoleadorPickerKO` en `eliminatoria-v3.js`, redirect a `v3OpenZoomGrupos`
> en `v3ElimMount`). No reabrir.

---

## Pre-implementación obligatorio

1. Leer `public/js/ko.js` para entender `resolveAllSlots()` y estructura de `BRACKET`.
2. Verificar schema `ko_predictions` en Supabase (columnas, RLS).
3. Screenshot de la UI actual del bracket en producción antes de tocar nada.
4. Comprobar que `squads.jugadores` tiene datos para los equipos de las selecciones
   con lista FINAL antes de implementar el picker (si no hay jugadores, el picker
   muestra placeholder genérico).

---

## Test de aceptación post-sprint

- [ ] Con grupos completos y clasificador asignado: botón "Goleador" activo en match-card.
- [ ] Picker muestra jugadores del equipo clasificado (no placeholders).
- [ ] Selección persiste tras refresh (ko_predictions.scorer guardado).
- [ ] Con grupos incompletos: navegar a bracket redirige a modal del primer grupo incompleto.
- [ ] Con porra cerrada: bracket en modo read-only (sin pickers, sin CTA de guardar).
