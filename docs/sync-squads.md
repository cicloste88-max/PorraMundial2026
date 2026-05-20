# sync-squads — automatización de plantillas Mundial 2026

> CLI Node 22 + workflow GitHub Actions para sincronizar `squads.jugadores`
> mediante cross-validation 2-of-N sobre 5 fuentes primarias + enrich
> Transfermarkt.

## Visión general

`scripts/sync-squads.mjs` lee las plantillas de las 48 selecciones del Mundial 2026
y mantiene la tabla `squads` de Supabase actualizada. Diseñado para:

- Pre-Mundial: capturar listas según las federaciones las publican (oleada 25 may → 2 jun).
- Snapshot FIFA: ejecución completa el 2-jun.
- Mundial: detectar bajas de última hora.

**Fuentes** (post-refactor `feat/squads-sources-refactor`, PR#72, 18-19 may
2026 — ver ERR-59 + `.claude/rules/sync-squads.md`):

- **Primarias** (`--mode=detect`): AS, Sport.es, Olympics, Eurosport, Marca.
  Parsers homogéneos en `scripts/lib/parsers/<fuente>.mjs`. `crossValidate`
  exige ≥ 2 fuentes con roster ≥ 22 y Jaccard ≥ 0.7 sobre nombres
  normalizados para marcar `is_final=true`.
- **Secundaria FF (`scripts/lib/ff-scraper.mjs`)**: invocada únicamente sobre
  selecciones ya marcadas FINAL por ≥ 2 primarias, **solo para XI titular**.
  FF NO se usa como fuente de detección por el riesgo de cruzar noticias de
  Eurocopa 2024 con Mundial 2026 (ERR-59).
- **Enriquecimiento Transfermarkt** (`--mode=enrich-tm`): edad, dob, valor,
  foto, posición específica, dorsal. Cache local 24h.

**Cobertura actual (20-may-2026)**: 10/48 selecciones operativas. Objetivo
38/48 para el snapshot oficial FIFA del 2-jun y arranque del torneo 11-jun.

## Estructura

```
scripts/
  sync-squads.mjs               # CLI principal (modes detect | scrape | enrich-tm)
  lib/
    parsers/
      as.mjs                    # AS — convocatorias oficiales
      sport.mjs                 # Sport.es — listas convocados
      olympics.mjs              # Olympics — 48 selecciones tracking
      eurosport.mjs             # Eurosport — convocatorias selecciones
      marca.mjs                 # Marca — convocatorias oficiales
      calendar.mjs              # parseCalendar() Olympics → fechas anuncio
      country-map.json          # nombres país por fuente → iso3 canónico
    cross-validate.mjs          # 2-of-N + Jaccard ≥ 0.7 + minPlayers=22
    ff-scraper.mjs              # futbolfantasy (secundaria, solo XI titular)
    tm-scraper.mjs              # Transfermarkt: kader con cache 24h
    name-matcher.mjs            # normalize + Levenshtein + scoring
    squads-db.mjs               # Supabase client + upsert idempotente
    iso3-slugs.json             # 48 mapeos iso3 → ff-slug (legacy XI fetch)
    tm-ids.json                 # iso3 → TM canonical id (6 conocidos)
.github/workflows/
  sync-squads.yml               # CI: schedule cron 6h + workflow_dispatch
docs/
  brief-sync-squads.md          # brief original del script
  sync-squads.md                # este documento
```

## Modos y flags

### `--mode=detect` (recomendado en cron)

Cross-validate 2-of-N sobre AS/Sport.es/Olympics/Eurosport/Marca via
`Promise.allSettled` (tolera fallo hasta 1 fuente). Resultados:
`confidence='high'` (2+ fuentes con Jaccard ≥ 0.7), `'low'` (1 fuente o
degrade por calendario), `'reject'` (rosters < 22). Upsert con
`preserveEnrichment()` para no perder edad/valor/foto TM previa. Para cada
iso3 actualizada FINAL hace paso XI titular vía FF en serie (skippable con
`--no-enrich-xi`). Detalle: `.claude/rules/sync-squads.md` § 9.

### `--mode=scrape` (legacy / dispatch manual)

Scrapea desde futbolfantasy.

| Selector | Comportamiento |
|---|---|
| `--iso3=FRA` (o `FRA,JPN,BEL`) | Países explícitos |
| `--all-missing` | Países sin lista o con `jugadores_is_final=false` |
| `--refresh-final` | Países con `jugadores_is_final=true` (re-marca titulares) |
| `--all` | Las 48 |

### `--mode=enrich-tm`

Enriquece roster ya existente con TM (edad, dob, valor, foto, posición específica).
Cambia `fuente` a `ff+tm`. Selectores `--iso3=...` o `--all`.

### Flags transversales

- `--dry-run` — no aplica UPDATE, loguea diff propuesto.
- `--force` — UPDATE incluso con diff vacío (refresca `synced_at`).
- `--verbose` — log de cada fetch + match.
- `--skip=A,B` — iso3 a saltar (csv, e.g. `--skip=IRN`).
- `--delay=N` — pausa entre fetches en ms (default 1500 ff / 2500 tm).

## Pipeline FF (3 pasos)

### Paso 1 — detectar lista anunciada

GET `https://www.futbolfantasy.com/world-cup/equipos/<slug>/noticias/1`

Regex sobre el HTML buscando `/world-cup/noticias/<id>-<slug>` donde slug contiene
`anuncia-la-lista` | `lista-definitiva` | `convocatoria-oficial`. Si no hay match →
`is_final=false` y se intenta solo paso 3.

### Paso 2 — parsear roster

GET `https://www.futbolfantasy.com/world-cup/noticias/<id>-<slug>`

`htmlToMd()` convierte HTML→markdown-like, luego dos regex:
- `SECTION_RE` extrae bloques `**Porteros**` / `**Defensas**` / `**Centrocampistas**` / `**Delanteros**`.
- `PLAYER_LINE_RE` parsea `Nombre (Club/País)` (`/País` opcional, ignorado).

Cada jugador → objeto con `nombre`, `club`, `posicion`, `posicion_bucket`,
`es_titular=false`, campos null para enrich (`dorsal`, `edad`, `valor`, `dob`, `foto_url`),
`fuente='ff'`.

### Paso 3 — extraer XI titular

GET `https://www.futbolfantasy.com/world-cup/equipos/<slug>`

**Detector de placeholder primero** (ERR-48): si el HTML SSR contiene
`/alineaciones/0.jpg` (imagen del campo vacío que FF sirve cuando no hay XI publicado),
retorna `[]` inmediatamente. El texto "Alineación aún no disponible" lo inyecta JS
post-hidratación → NO se puede detectar server-side.

Si hay XI: localiza anchor `Posible once tipo | Once tipo | Once probable`, captura
los 22 primeros `alt=` de `<img>` filtrando alts genéricos (escudos, banderas, iconos,
Alineación, Formación, Titulares, Banco, Suplent…), dedupe → primeros 11.

Fuzzy match contra el roster del paso 2 (`name-matcher.mjs`): normalización NFD,
last-token + Levenshtein. Marca `es_titular=true` en los 11 matches.

## Pipeline TM enrich

GET `https://www.transfermarkt.com/<slug>/kader/verein/<tmId>/plus/1`

Parser regex sobre filas `<tr class="odd|even">` extrae: nombre, foto, dob, edad,
valor (€80m → 80000000), posición específica, dorsal.

Cache local `cache/tm/<tmId>.json` con TTL 24h. Fuzzy match contra roster scraped,
muta in-place añadiendo solo los campos enrich, sin tocar `nombre` ni `es_titular`.

### TM IDs canónicos conocidos

```
ESP=3375 · ARG=3437 · BIH=3446 · BRA=3439 · MEX=6303 · SWE=3557
```

Los otros 42 están a `null` en `scripts/lib/tm-ids.json`. Descubrirlos a mano vía
`site:transfermarkt.com <pais>` en Google a medida que se vayan necesitando.

## Workflow CI — `.github/workflows/sync-squads.yml`

### Triggers

- **`schedule`** cron `'0 */6 * * *'` (cada 6h UTC). Cubre snapshot 2-jun + bajas
  durante el Mundial. Retraso ~30min en horas pico es aceptable.
- **`workflow_dispatch`** con 4 inputs configurables desde la UI de GitHub Actions:
  - `mode` choice: `scrape` (default) | `enrich-tm`
  - `refresh_final` boolean (default `true`)
  - `iso3_filter` string (default `''`; validado con regex `^[A-Z]{3}(,[A-Z]{3})*$`)
  - `verbose` boolean (default `true`)

### Secrets

`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` configurados a nivel repo. El step
"Write .env from secrets" genera `.env` en el runner efímero para mantener parity
con el flow local (`npm run sync-squads` usa `--env-file=.env`).

### Logs

`actions/upload-artifact@v4` con retention **14 días**. Artifact `sync-squads-log-<run_id>`
disponible aunque el script haya fallado (`if: always()`). Para diagnosticar:
`Actions → run individual → Artifacts → download → tail sync-squads.log`.

### Disparo manual desde la UI

1. `github.com/cicloste88-max/PorraMundial2026/actions`
2. Workflow **Sync Squads**
3. **Run workflow** (esquina derecha)
4. Seleccionar branch (normalmente `main`) + ajustar inputs.

### Disparo vía API (opcional)

```bash
curl -X POST \
  -H "Authorization: Bearer $GH_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/cicloste88-max/PorraMundial2026/actions/workflows/sync-squads.yml/dispatches \
  -d '{"ref":"main","inputs":{"mode":"scrape","iso3_filter":"FRA","refresh_final":"true","verbose":"true"}}'
```

Útil para un botón web → backend → API GitHub (en el futuro).

## Calendario operativo recomendado

| Fecha | Frecuencia | Acción |
|---|---|---|
| 16-may → 24-may | Cada 6h (cron CI) | Detectar listas oleada 1 (FRA/JPN/BEL ya capturadas; resto pendiente) |
| 25-may → 1-jun | Cada 6h (cron CI) | Ventana de máxima publicación FIFA |
| 2-jun | Manual + cron | Snapshot oficial FIFA + verificar todas las 48 con `--mode=scrape --all` |
| 3-jun → 10-jun | Diario manual | Bajas de última hora |
| 11-jun → 18-jul | Diario manual o cron 12h | Mundial: detectar bajas medio-torneo |
| Post-Mundial | Deshabilitar cron | Editar `.github/workflows/sync-squads.yml` y comentar `schedule:` |

## Casos especiales

### Irán (IRN)

Noticia 11-mar reporta renuncia geopolítica al Mundial; San decidió esperar a
confirmación FIFA. Mientras tanto: `--skip=IRN` en runs manuales, o tratado como
"no-list" por defecto (no falla el run completo).

### `--refresh-final` y enrichment TM (ERR-47)

`--refresh-final` siempre preserva el roster + `jugadores_fuente` existentes en
BD. Solo reaplica `es_titular` según el XI scrapeado. Esto bloquea pérdidas de
sufijo `+tm` cuando aparezcan listas FINAL para países ya enriquecidos
(ARG/BRA/ESP/MEX/QAT). Decode HTML in-flight limpia entidades crudas de scrapes
viejos pre-`html-entities` (e.g. BIH `Kola&scaron;inac` → `Kolašinac`).

### Placeholder "Alineación aún no disponible" (ERR-48)

FF sirve `/alineaciones/0.jpg` cuando la federación aún no publica el once tipo
(BEL/JPN/SWE entre 14-may y mid-may). Detección server-side mediante esa URL en
el HTML. El texto "Alineación aún no disponible" solo aparece tras hidratación JS.

### Idempotencia (ERR-49)

Apóstrofos tipográficos `U+2019` (`'`) decodificados de `&rsquo;` provocaban
diff perpetuo contra BD con ASCII `'`. `decodeHtml()` normaliza
`U+2018/U+2019/U+201A/U+2032 → '` y `U+201C/U+201D/U+201E/U+2033 → "`.

## Decisiones de diseño relevantes

- **Lib oficial `html-entities` v2.6+** en lugar de tabla manual: cubre HTML5
  completo (~2000 entidades) incluyendo eslavo-sur/occidental + turco que la
  tabla previa no contemplaba (ERR-46).
- **Defensa en 2 capas** para idempotencia: entidades nombradas `&rsquo;` →
  ASCII en HTML_ENTITIES + chars Unicode directos U+2019 → ASCII en regex final.
- **Cache local TM 24h** evita el rate limit agresivo de Transfermarkt en runs
  consecutivos.
- **Sanity check de input en workflow** (`^[A-Z]{3}(,[A-Z]{3})*$`) bloquea
  caracteres raros en `iso3_filter` antes de interpolarse en el comando shell.
- **Concurrency group `sync-squads`** con `cancel-in-progress: false` evita
  solapes entre cron + dispatch manual.

## Referencias

- Brief original: `docs/brief-sync-squads.md`.
- Errores: ERR-46/47/48/49/50 en `errores_conocidos_porra.md`.
- Sprint changelog: entrada 2026-05-16 en `CHANGELOG.md`.
- Reglas operativas: `.claude/rules/sync-squads.md`.
