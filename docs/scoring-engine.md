# Motor de puntuación — Porra Mundial 2026

## Resumen

El motor de puntuación calcula automáticamente la puntuación de cada participante en función de sus pronósticos sobre partidos, avances de equipos en fase KO y premios individuales. La lógica de evaluación reside en `public/js/scoring.js` y se ejecuta tras cada actualización de resultados reales, comparando predicciones contra marcadores, goleadores y pronóstico de la IA.

## Puntos por partido

| Criterio | Puntos |
|----------|--------|
| Signo correcto (1/X/2) | +1 |
| Resultado exacto | +3 (no acumula con signo) |
| Goleador correcto | +2 |
| Bonus vs IA (opuesto a IA y aciertas) | +1 |
| **Máximo por partido** | **7** |
| **Con boost x2 activado** | **14** |

## Puntos por avance KO

Por cada equipo del que el usuario pronostica avance correctamente:

| Transición | Puntos |
|-----------|--------|
| Grupos → R32 | +5 |
| R32 → R16 | +5 |
| R16 → Cuartos | +10 |
| Cuartos → Semifinales | +15 |
| Semifinales → Final | +20 |
| Campeón | +25 |

## Clasificación final

| Posición | Puntos |
|----------|--------|
| Campeón | +30 |
| Subcampeón | +20 |
| Tercero | +15 |
| Cuarto | +10 |

## Premios individuales (AWARDS_CFG)

| Premio | Puntos |
|--------|--------|
| Balón de Oro | +15 |
| Bota de Oro | +15 |
| Guante de Oro | +15 |
| Mejor Joven (≤21 años) | +20 |

## Bonus +1pt vs IA

El bonus se aplica cuando el pronóstico del usuario diverge del signo de la IA y el usuario acierta. Orden de evaluación:

1. **Guard `iaBonusWillApply`**: la IA debe tener un signo válido (`ia.sign ∈ {'1','X','2'}`).
2. Comparación: si el signo del usuario coincide con el de la IA, no hay bonus.
3. Si divergen Y el signo del usuario es el correcto del partido, suma +1.
4. **Orden de aplicación**: el bonus se aplica DESPUÉS de signo/exacto/goleador y ANTES del cap `Math.min(pts, 7)` y del boost ×2.

Detalle del motor IA y fórmula del pronóstico en `docs/ia-predictor.md`.

## Estructura del torneo

- **48 equipos** distribuidos en **12 grupos** (A–L) de 4 equipos cada uno.
- **Fase de grupos**: 72 partidos en 17 jornadas.
- **Clasificación a KO**: 2 primeros de cada grupo + 8 mejores terceros = **32 equipos**.
- **Fase KO**: R32 → R16 → QF → SF → 3er puesto → Final = 32 partidos.
- **Total torneo**: **104 partidos**.

**Inicio**: 11 jun 2026 — México vs Sudáfrica en el Estadio Azteca (`eventId=15186710`).
