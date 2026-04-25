# IA Predictor — Porra Mundial 2026

## Resumen

El IA Predictor es un sistema automático de pronóstico por partido que estima la probabilidad de victoria local (`1`), empate (`X`) o victoria visitante (`2`) basándose en señales de ELO FIFA, historial H2H y forma reciente. El frontend consume las predicciones desde una snapshot congelada al inicio del torneo (`ia_predictions`), enriquecida con 9 campos de contexto crudo, para renderizar una barra de confianza visual y aplicar un bonus defensivo de **+1 punto** cuando el usuario acierta contra el pronóstico del motor.

Implementación canónica del motor: `supabase/functions/porra-ia-compute/lib/predictor.ts`. Schemas SQL de tablas `ia_*`: `docs/db-schema.md`. Cronología commit-by-commit Fases A–F: `CHANGELOG.md`.

## Arquitectura 3 capas

```
Capa 1 — Ingesta              Capa 2 — Cómputo            Capa 3 — Consumo (Fase F)
EF porra-ia-compute       →   ia_predictions         →    auth.js  (bootstrap snapshot activo)
 (4 actions scraper)           (log-odds + softmax,        scoring.js (hidrata .ia-bar + bonus +1pt)
                               home advantage,             ko.js    (hint lazy compute_match)
                               fallback sin H2H)
```

**Capa 1 — Ingesta**: cuatro acciones en la EF `porra-ia-compute`:
- `scrape_elo` → Wikipedia Module:SportsRankings → `ia_elo_fifa` (~211 países)
- `scrape_h2h` → 11v11.com/teams/*/tab/stats/ → `ia_h2h` (~815 pares únicos)
- `scrape_last5` → 11v11.com/teams/*/tab/matches/ → `ia_last5_results` (últimos N por equipo)
- `freeze_snapshot` → trigger pre-torneo que congela la snapshot activa

**Capa 2 — Cómputo**: motor log-odds + softmax que consume las tres señales, aplica pesos, home advantage condicional y fallback cuando faltan datos. Genera un registro `ia_predictions` por partido con signo, porcentaje de confianza y desglose de componentes crudos.

**Capa 3 — Consumo**: código frontend (`auth.js`, `scoring.js`, `ko.js`) que lee la snapshot activa al cargar, renderiza la barra visual en grupos y tarjetas KO (lazy compute en sesión vía `compute_match` para KO), y aplica el bonus de +1 punto en el motor de puntuación si la predicción del usuario diverge de la IA y acierta.

## Fórmula del pronóstico

### Pesos por señal

| Señal | Peso (motor Fase E) | Fallback (H2H<5) | Fuente |
|---|---|---|---|
| ELO FIFA | 75% | 85% | Wikipedia Module:SportsRankings |
| H2H histórico | 10% | — | 11v11.com/teams/*/tab/stats/ |
| Racha (últimos N) | 15% | 15% | 11v11.com/teams/*/tab/matches/ |

### Fallback sin H2H

Si el par tiene `h2h_total < 5` partidos históricos:
- ELO sube de 75% a 85%
- Racha mantiene 15%
- H2H se omite

Esto cubre encuentros entre selecciones que nunca se han enfrentado (o muy pocas veces — frecuente en mundialistas africanos/oceánicos).

### Umbrales signo 1/X/2

Sobre `raw_home_pct` (probabilidad bruta post-softmax para el equipo local):

- `> 60%` → `1` (victoria local)
- `40–60%` → `X` (empate)
- `< 40%` → `2` (victoria visitante)

### Profundidad racha dinámica

Default `N=8` (lo que 11v11.com sirve hoy). Ampliable a `N=10` antes del 11 jun cuando se publique el primer amistoso pre-Mundial, vía `{"action":"scrape_last5","limit":10}`. Activación **manual** (no automática). Rango admitido por el endpoint: 1–20.

### Headers obligatorios para 11v11.com

Sin los 3 headers, 11v11.com responde 403 (ver ERR-25):

```ts
const fetchHeaders = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
  "Accept": "text/html,application/xhtml+xml",
  "Accept-Language": "en-US,en;q=0.9",
};
```

## Fórmula del motor (Fase E)

Implementación canónica en `supabase/functions/porra-ia-compute/lib/predictor.ts`. Resumen de comportamiento:

- **Modelo**: log-odds + softmax sobre las tres señales ponderadas → probabilidades normalizadas para `1`/`X`/`2`.
- **Pesos default**: ELO 75% + H2H 10% + Racha 15%.
- **Fallback** (H2H con <5 partidos): ELO 85% + Racha 15% (omite H2H).
- **Home advantage**: +85 base para anfitriones, +95 para México (altitud Azteca). Solo aplica en grupos si `home_code ∈ {MEX, USA, CAN}`. En KO siempre `is_host_match=false` (sedes rotativas/neutras).
- **Margen dudoso**: cuando `margin < 0.08` entre las dos probabilidades más altas, flag `is_dudoso` para UI.

### Snapshot fairness

La IA se congela con `freeze_snapshot` el 11 jun 00:00 UTC y NO se adapta al torneo. Misma predicción para todos los users durante todo el evento. `ia_snapshots` con invariante "1 activo" + FK desde `ia_predictions`.

### Back-test WC2022

Validado contra Qatar 2022 (46 partidos):

- Accuracy: 63.0%
- Log-loss: 0.932
- Brier score: 0.560

Supera el baseline de predicción ingenua. La paridad Python ↔ TS se verifica en 46 casos con tolerancia 1e-3 como gate de merge.

## Fuentes de datos externas

### 1. Wikipedia — Module:SportsRankings (ELO FIFA)

**URL**: `https://en.wikipedia.org/w/api.php?action=parse&page=Module:SportsRankings/data/FIFA_World_Rankings&prop=wikitext&format=json`

**Método**: `GET`. Headers: `User-Agent: pm26-ia-predictor/1.0`, `Accept: application/json`.

**Formato**: JSON con `data.parse.wikitext["*"]` = string Lua. Parseo con dos regex:

1. Fecha de actualización (próxima publicación FIFA: 9 jun 2026):
   ```
   /data\.updated\s*=\s*\{\s*day\s*=\s*(\d+),\s*month\s*=\s*'(\w+)',\s*year\s*=\s*(\d+)/
   ```
   → ISO `YYYY-MM-DD`.

2. Filas (~211 países):
   ```
   /\{\s*"([^"]+)"\s*,\s*(\d+)\s*,\s*(-?\d+)\s*,\s*([\d.]+)\s*\}/g
   ```
   Grupos: `(country_name, rank, movement, points)`.

**Mapping nombre → ISO3**: `team_name` lowercased → `ALIAS_MAP` hardcoded → fallback `slice(0,3).toUpperCase()`. No matched → `unmatched_names` (típicamente microstados no FIFA).

**Frecuencia**: FIFA publica ranking cada ~2 meses. Wikipedia suele reflejar el cambio en horas.

**Consume**: acción `scrape_elo`. **Destino**: tabla `ia_elo_fifa` (~211 filas).

### 2. 11v11.com/teams/{owner_slug}/tab/stats/ (H2H agregado)

**URL patrón**: `https://www.11v11.com/teams/{owner_slug}/tab/stats/`

**owner_slug**: kebab-case de 11v11. Ejemplos: `spain`, `korea-republic`, `bosnia-and-herzegovina`, `congo-dr`, `cape-verde-islands`, `usa`, `ivory-coast`.

**Headers**: los 3 obligatorios (ver ERR-25).

**Formato**: HTML con tabla única de TODOS los rivales históricos de la selección. Regex global:

```
/<td class="opposition">([^<]+)<\/td>\s*<td>(\d+)<\/td>\s*<td>(\d+)<\/td>\s*<td>(\d+)<\/td>\s*<td>(\d+)<\/td>\s*<td>(\d+)<\/td>\s*<td>(\d+)<\/td>/g
```

Grupos: `(opposition_name, P, W, D, L, GF, GA)` desde la perspectiva del `owner_slug`.

**Mapping oponente → ISO3**: lookup por `opposition_name.toLowerCase()` contra `WC2026_TEAMS[2]`. No-mundialistas se ignoran. Sin match → `unmatched_opponents`.

**Fuente subyacente**: RSSSF (incluye amistosos, no filtra por competición).

**Sin fecha**: el agregado no expone `last_played` — `ia_h2h.last_played = null`.

**Validaciones smoke**: ARG-ESP 6W-2D-6L · ARG-BRA 44-27-45 en 116 · ARG-URU 91-46-57 en 194.

**Timing**: loop secuencial 48 teams × 500ms delay (~45s total).

**Consume**: acción `scrape_h2h`. **Destino**: tabla `ia_h2h` (~815 pares únicos, ~72% cobertura).

### 3. 11v11.com/teams/{owner_slug}/tab/matches/ (últimos N partidos)

**URL patrón**: `https://www.11v11.com/teams/{owner_slug}/tab/matches/` — mismo `owner_slug` que la fuente 2.

**Headers**: idénticos a la fuente 2.

**Formato**: HTML, 8 partidos por selección (orden ascendente por fecha). Regex global de 6 grupos (el 6º opcional):

```
/<td[^>]*>\s*([^<]+)<\/td>\s*<td[^>]*>(?:<a[^>]*>)?([^<]+?)(?:<\/a>)?<\/td>\s*<td[^>]*><span[^>]*>([WDL])<\/span><\/td>\s*<td[^>]*>\s*(\d+)-(\d+)[^<]*<\/td>(?:\s*<td[^>]*>([^<]*)<\/td>)?/g
```

Grupos: `(dateStr, matchStr "Home v Away", W|D|L, home_score, away_score, competition?)`.

**Detección owner**: `home_name.toLowerCase() === opposition_name.toLowerCase()` (o `away_name`). Se remapean GF/GA y venue según lado.

**Caveat**: Argentina devuelve 7 partidos en lugar de 8 por caché interno de 11v11.

**Ampliable**: `body.limit` 1-20 (default 8). Bumpear manualmente a 10 cuando salgan amistosos pre-Mundial.

**Consume**: acción `scrape_last5`. **Destino**: tabla `ia_last5_results` (48 filas, `results JSONB` ascendente con `{date, opponent_name, opponent_iso3, venue H/A, result, gf, ga, competition}`).

### 4. SofaScore API

Alimenta la tabla `live_scores` (no las tablas `ia_*`). Pipeline detallado en `docs/live-scoring.md`. Solo referencia cruzada aquí.

## Puntos de rotura conocidos

- **Wikipedia Module:SportsRankings**: si el módulo Lua cambia la estructura `data.updated = {...}` o el formato de fila `{"name", rank, move, points}`, ambos regex rompen silenciosamente. Síntoma: `countries_upserted: 0`. Detectable al siguiente `scrape_elo`.
- **11v11.com — estructura HTML**: si renombran `<td class="opposition">` o reordenan columnas, los regex de las fuentes 2 y 3 rompen. Síntoma: `teams_parsed` cae bruscamente. Sin canary automático — re-lanzar manualmente cada ~2 semanas si se sospecha drift.
- **11v11.com — renombrado de selección** (ej. "Turkey" → "Türkiye"): el match por `opposition_name` falla silenciosamente. El equipo entra en `unmatched_opponents`. Fix: añadir alias o actualizar `WC2026_TEAMS[2]` y redesplegar.
- **Drift de forma reciente**: si varios equipos juegan amistosos no capturados aún por 11v11, la racha desfasa. Mitigación: re-lanzar `scrape_last5` cada 3-5 días pre-torneo.

## Mapping WC2026_TEAMS (48 mundialistas)

Constante global en `supabase/functions/porra-ia-compute/index.ts`. Cada entry es un tuple `[iso3, owner_slug, opposition_name, display_name]`:

- **iso3**: código 3-letras ISO-3166-1.
- **owner_slug**: kebab-lowercase de 11v11 (`bosnia-and-herzegovina`, `korea-republic`, `congo-dr`, `cape-verde-islands`, `usa`).
- **opposition_name**: texto exacto que 11v11 usa en `<td class="opposition">` cuando esa selección aparece como rival ("Korea Republic", "Congo DR", "Cape Verde Islands"). Se lowercase como clave del `Map<name, iso3>` para cruzar rivales entre páginas.
- **display_name**: render al usuario final ("Türkiye", "Côte d'Ivoire", "Curaçao").

**Fuente de verdad**: la constante en `index.ts`. Si 11v11 renombra una selección o FIFA cambia afiliación oficial, actualizar aquí y redesplegar.

## Cleanup

1. **Dos `fetch('api.anthropic.com/...')` muertos** — ✅ resuelto en `87fd454` (PR #19, 24 abr 2026): `scoring.js::fetchIA` y `ui-nav.js::fetchIAforKO` eliminados. `iaPredictions` se puebla desde `loadIAPredictions` (auth.js); `iaKoPredictions` desde `loadKOIAHint` (ko.js) con callback `onDone`. Net -131 líneas.
2. **Tooltip explainer del % en tarjetas KO** (pendiente): Fase F limitó scope a partidos de grupos. Las predicciones KO se computan on-demand (sessionStorage cache), pero el tooltip narrativo aún no se renderiza. Acción: leer `iaKoPredictions` + `findCachedPrediction` con raw context y portarlo a `ko.js`. Baja prioridad post-torneo.
