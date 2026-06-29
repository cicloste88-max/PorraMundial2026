# Bracket KO — Porra Mundial 2026

Estructura del cuadro de eliminatorias (R32 → Final), **verificada 1:1 contra el
bracket oficial FIFA 2026**. Documenta los slots, los *feeders* (de dónde sale
cada equipo) y cómo se resuelve la malla predicha de cada usuario.

> Derivado en la sesión KO del 29-jun-2026 (San lo pidió expreso). Verificación:
> resolviendo la clasificación real de los 12 grupos contra `wc_matches_ko`, los
> 16 cruces reales de R32 cuadran con la plantilla aplicada a la clasificación.

## Fuente de verdad

`supabase/functions/_shared/ko-data.mjs` → `export const BRACKET` (+ `ANNEX_C` y
`GRUPOS`). Es **copia 1:1** de `public/js/ko.js` (`const BRACKET`) — los dos
espejos deben mantenerse sincronizados. El front renderiza desde `ko.js`; las
Edge Functions (`get-league-standings`, `porra-bridge-results`) leen el espejo
`_shared/ko-data.mjs`.

No modificar uno sin el otro. Cualquier cambio de cuadro toca **ambos**.

## Slots (`ko_match_id` / `id`)

| Ronda | Slots | Nº cruces |
|---|---|---|
| R32 (dieciseisavos) | **73–88** | 16 |
| R16 (octavos) | 89–96 | 8 |
| QF (cuartos) | 97–100 | 4 |
| SF (semifinales) | 101–102 | 2 |
| 3.er y 4.º puesto | **103** | 1 |
| Final | **104** | 1 |

El `match_key` de runtime es `wc2026_ko_<slot>` (p.ej. `wc2026_ko_104` = Final).
Mapea 1:1 a `ko_match_id` en `wc_matches_ko` y a la clave string de
`results.ko_results` (`"73"`, `"104"`, …).

## Semántica de los *feeders* (`home`/`away`)

- **R32 (73–88)**: posición de grupo.
  - `1X` / `2X` = 1.º / 2.º del grupo X (`1E`, `2C`, …).
  - `T_XXXXXX` = **tercero comodín** (uno de los 8 mejores terceros) cuya
    asignación al slot depende de QUÉ grupos clasificaron sus terceros, vía el
    Anexo C FIFA (`ANNEX_C`). Ej. `T_ABCDF` = el tercero que salga del conjunto
    {A,B,C,D,F} según la combinación real.
- **R16 → Final**: ganador/perdedor de un slot anterior.
  - `W<slot>` = ganador (avanzador) del slot. Ej. `W74` = quien gane el slot 74.
  - `L<slot>` = perdedor del slot. **Solo aparece en el slot 103** (3.er puesto):
    `L101`/`L102` = perdedores de las dos semis.

En el frontend Directo, un lado sin resolver se rotula con la etiqueta del
feeder (estilo bracket oficial): `W74`, `RU101`/`RU102` (runner-up = `L101`/
`L102`), o la posición legible (`2A`→"2.º A", `T_ABCDF`→"3.º (A/B/C/D/F)"). Ver
`_koSeedLabel` en `public/js/ui-directo.js`.

## Plantilla R32 (slots 73–88)

| Slot | home | away | Slot | home | away |
|---|---|---|---|---|---|
| 73 | 2A | 2B | 81 | 1D | T_BEFIJ |
| 74 | 1E | T_ABCDF | 82 | 1G | T_AEHIJ |
| 75 | 1F | 2C | 83 | 2K | 2L |
| 76 | 1C | 2F | 84 | 1H | 2J |
| 77 | 1I | T_CDFGH | 85 | 1B | T_EFGIJ |
| 78 | 2E | 2I | 86 | 1J | 2H |
| 79 | 1A | T_CEFHI | 87 | 1K | T_DEIJL |
| 80 | 1L | T_EHIJK | 88 | 2D | 2G |

## Feeders R16 → Final (NO secuenciales — por cuadrante)

El emparejamiento de octavos **no** es `89←73,74`; sigue los cuadrantes del
cuadro oficial:

| Slot | feeders | Slot | feeders |
|---|---|---|---|
| **R16** 89 | W74, W77 | 93 | W83, W84 |
| 90 | W73, W75 | 94 | W81, W82 |
| 91 | W76, W78 | 95 | W86, W88 |
| 92 | W79, W80 | 96 | W85, W87 |
| **QF** 97 | W89, W90 | 99 | W91, W92 |
| 98 | W93, W94 | 100 | W95, W96 |
| **SF** 101 | W97, W98 | 102 | W99, W100 |
| **3.º** 103 | L101, L102 | **Final** 104 | W101, W102 |

## Resolución de la malla predicha — `resolveBracket`

`supabase/functions/_shared/ko-bracket.mjs` reconstruye la malla de cada usuario
en cascada a partir de sus predicciones de grupos + KO, usando esta misma
estructura:

1. `resolveGroupSlots(predsByKey)` resuelve `1A`…`2L` desde las tablas de grupo
   predichas, y los `T_XXXXXX` (terceros) vía `ANNEX_C` (Anexo C FIFA, 495
   combinaciones de qué 8 terceros clasifican y a qué slot van).
2. Cascada `W<slot>`/`L<slot>` por las predicciones KO del usuario hasta el
   campeón y el podio.

Es el equivalente headless de `resolveKO` / `resolveAllSlots` en `public/js/ko.js`
(mismo algoritmo, sin globals). La malla **real** (no la predicha) NO usa
`resolveBracket`: sale de `wc_matches_ko` (equipos por slot en iso3) +
`ko_results` (`winner` por slot). Ver `docs/scoring-engine.md` §Modelo KO.

## ⚠️ Orientación / `teams_swapped`

`wc_matches_ko` se sembró ya orientado a la malla (home/away = seed, casi siempre
`teams_swapped=false`). Pero una query ad-hoc que reconstruya la clasificación
**real** desde `live_scores` debe respetar `wc_matches.teams_swapped`: cuando es
`true`, el marcador de `live_scores` está en orientación OPUESTA a los nombres
home/away. Ver **ERR-99** en `errores_conocidos_porra.md` (crítico para la futura
EF `get-ko-crosses`).

## Referencias

- `supabase/functions/_shared/ko-data.mjs` — `BRACKET` + `ANNEX_C` (fuente).
- `supabase/functions/_shared/ko-bracket.mjs` — `resolveBracket` y helpers.
- `docs/scoring-engine.md` — §Modelo KO (avance, podio, anti-IA).
- `docs/REGLAMENTO_FIFA_2026.md` — reglamento y Anexo C.
- `errores_conocidos_porra.md` — ERR-99 (`teams_swapped` en standings reales).
