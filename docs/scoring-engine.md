# Motor de puntuación — Porra Mundial 2026

## Resumen

El motor de puntuación calcula automáticamente la puntuación de cada participante en función de sus pronósticos sobre partidos, avances de equipos en fase KO y premios individuales. La lógica de evaluación reside en `public/js/scoring.js` y se ejecuta tras cada actualización de resultados reales, comparando predicciones contra marcadores, goleadores y pronóstico de la IA.

## Puntos por partido

| Criterio | Puntos |
|----------|--------|
| Signo correcto (1/X/2) | +1 |
| Resultado exacto | +3 (apila sobre el +1 del signo) |
| Goleador correcto | +2 |
| Bonus vs IA (opuesto a IA y aciertas) | +1 |
| **Máximo por partido** | **7** |
| **Con boost ×2 activado** | **13** |

### Regla del +2 goleador (F2.9 HF-09)

El **+2 por goleador correcto** se aplica cuando `pred.gol` acierta a **cualquier goleador real** del partido, independientemente de:

- El **marcador final** (incluido 0-0 si por algún motivo se registra un goleador).
- El **equipo** del goleador (ganador, perdedor o empatado).

**Justificación**: equipara oportunidades de puntos entre usuarios. Si un usuario pronostica 0-0 sin goleador y otro pronostica 0-0 con goleador, ambos pueden tener acceso al +2.

### Regla 0-0 — goleador opcional (canónica, confirmada por San 10-jun-2026)

Al pronosticar **0-0**, el goleador es **opcional**: dejarlo vacío es la apuesta a **"sin goleador"**.

| Pronóstico | Real | Puntos |
|---|---|---|
| 0-0 **sin** goleador | 0-0 | 1 (signo) + 3 (exacto) + **2 (goleador "sin goleador" acertado)** = **6** |
| 0-0 **con** goleador | 0-0 | 1 + 3 = **4** (la apuesta de goleador falla: no hubo goles) |
| 0-0 sin goleador, **con boost** | 0-0 | (1+3+2) × 2 = **12** |
| 1-1 sin goleador | 0-0 | **1** (solo signo X; la regla exige pred 0-0 exacto) |

El **cap 7** se aplica igual que siempre. El ×2 del boost requiere exacto **y** goleador (ver regla canónica abajo); en el caso 0-0 clavado sin goleador, el slot de goleador acertado CUENTA para el ×2. Las rondas KO heredan la regla vía `calcKOMatchPoints` (que delega los puntos de marcador en `calcMatchPoints`).

### Regla del boost ×2 (CANÓNICA — confirmada por San, product owner, 12-jun-2026)

El **×2 del boost SOLO aplica cuando se aciertan RESULTADO EXACTO y GOLEADOR a la vez**.

| Con boost activado | ¿Dobla? | Puntos |
|---|---|---|
| Solo exacto (goleador fallado/ausente) | NO | 1+3 = **4** |
| Solo goleador (exacto fallado) | NO | (1)+2 = **2-3** |
| Exacto + goleador | **SÍ** | (1+3+2)×2 = **12** |
| Ninguno | NO | 0-1 |
| 0-0 clavado sin goleador | **SÍ** (slot goleador acertado) | (1+3+2)×2 = **12** |

**Interacción con el +1 anti-IA** (default ajustable, pendiente confirmación de San): el +1 queda **FUERA del multiplicador** y se suma después → máximo por partido **13** = (1+3+2)×2 + 1. Flag `BOOST_INCLUYE_IA` en `_shared/scoring.mjs` (espejo `window.BOOST_INCLUYE_IA` en `scoring.js`); con `true` el +1 entra en el ×2 (máx 14, comportamiento pre-R3).

> Historia (R3 post-J1, 12-jun-2026): el motor doblaba con solo exacto e infló 8↔4 los puntos J1 de 3 usuarios (javion_89, daniel.castan20, josempurullena); corregido y re-sembrada `user_points_cache`. Los 12 de exacto+goleador+boost eran correctos.

**Implementación con paridad obligatoria**: `supabase/functions/_shared/scoring.mjs` (motor compartido, lo consume la EF `get-league-standings`) y `public/js/scoring.js` (frontend). Casos canónicos en `tests/scoring.test.mjs`.

**Excepción en rondas KO**: los goles en **tanda de penaltis** NO cuentan como goles del partido. El array `realScorers` que alimenta al motor debe contener solo goleadores de 90' + prórroga. Es responsabilidad del pipeline que llena `ko_results` / `live_scores` (porra-apify-webhook + EF `update-results`).

**Estado actual del pipeline**: `realScorers` aún no se hidrata desde producción. El motor usa un **fallback placeholder** (`_hf09FallbackScorers` en `scoring.js`: `players[0]` de los equipos relevantes del partido) hasta que la hidratación real se implemente. Esto mantiene backwards compat: si `realScorers` no se pasa, el motor sigue funcionando con la heurística placeholder pero ya **no bloquea empates** (regresión pre-HF-09 corregida). Trabajo aguas arriba pendiente fuera de F2.9.

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
4. **Orden de aplicación** (default `BOOST_INCLUYE_IA=false`, R3): el bonus se suma DESPUÉS del cap y del ×2 del boost — queda fuera del multiplicador (máx 13). Con el flag a `true`, se aplica antes del cap y del ×2 (máx 14).

Detalle del motor IA y fórmula del pronóstico en `docs/ia-predictor.md`.

## Estructura del torneo

- **48 equipos** distribuidos en **12 grupos** (A–L) de 4 equipos cada uno.
- **Fase de grupos**: 72 partidos en 17 jornadas.
- **Clasificación a KO**: 2 primeros de cada grupo + 8 mejores terceros = **32 equipos**.
- **Fase KO**: R32 → R16 → QF → SF → 3er puesto → Final = 32 partidos.
- **Total torneo**: **104 partidos**.

**Inicio**: 11 jun 2026 — México vs Sudáfrica en el Estadio Azteca (`eventId=15186710`).

## Desempate fase de grupos — Art. 13 FIFA 2026

Cuando dos o más equipos terminan empatados en puntos dentro del mismo grupo,
se aplica el siguiente orden de criterios (Art. 13 Reglamento FIFA 2026):

| Paso | Criterio | Implementado |
|------|----------|-------------|
| 1 | Puntos (todos los partidos del grupo) | ✅ |
| 2 | Diferencia de goles (todos los partidos) | ✅ |
| 3 | Goles a favor (todos los partidos) | ✅ |
| 4 | Puntos en partidos H2H entre los empatados | ✅ v3BreakTieH2H |
| 5 | Diferencia de goles H2H entre los empatados | ✅ v3BreakTieH2H |
| 6 | Goles a favor H2H entre los empatados | ✅ v3BreakTieH2H |
| 7 | Puntos disciplinarios (amarillas/rojas) | ⚠️ sin datos → fallback alfabético |
| 8 | Ranking FIFA / sorteo | ⚠️ sin datos → fallback alfabético |

### Notas de implementación

**Pasos 4-6 (H2H):** Implementados mediante un algoritmo de dos fases en
`v3ComputeStandings()` (`grupos-v3.js`) y `calcGroupStandings()` (`porra-ia-compute`).
Los equipos se agrupan primero por (pts, gd, gf) globales; dentro de cada
subgrupo empatado se calcula una mini-clasificación H2H con solo los partidos
entre ellos. El algoritmo es correcto para subgrupos de 2, 3 y 4 equipos.

**Pasos 7-8 (fair play / ranking):** No implementables sin datos de tarjetas ni
acceso a ranking FIFA en tiempo real. El fallback documentado es orden alfabético
(`localeCompare`), que es predecible y reproducible. La probabilidad de llegar a
este desempate es extremadamente baja en una porra de predicciones.

**Paridad EF:** `calcGroupStandings()` en `porra-ia-compute` implementa el mismo
algoritmo. Si se modifica la lógica de desempate, actualizar ambos ficheros.

### Mejor clasificación de terceros (8 mejores)

Los 8 mejores terceros clasificados para R32 se ordenan por:
`pts → gd → gf → localeCompare` (implementado en `v3ComputeBestThirds()`).
Este orden es el estándar FIFA para la selección de mejores terceros; no aplica
H2H entre terceros de grupos distintos.
