# Brief — `scripts/sync-squads.mjs` (sincronización de plantillas Mundial 2026)

> Origen: Claude.ai, 16-may-2026. Para Claude Code, sesión nueva.

## Contexto rápido

- Tabla `squads` (Supabase `cmyfyswystjgzdwbqyyb`) tiene 48 selecciones.
- A 16-may, 10 selecciones con datos (5 FINAL, 5 pre-lista). 38 sin datos.
- Fuente primaria: futbolfantasy.com. Enrich opcional: Transfermarkt.
- Snapshot final FIFA: **2-jun-2026**. Las federaciones van anunciando listas en oleadas hasta entonces.
- Hoy 16-may aplicado por Claude.ai vía MCP: **FRA, JPN, BEL** (las 3 que se anunciaron 14-15 may).

### Estado actual de squads (verificado 16-may 00:00 CEST)

| iso3 | Estado    | Players | Titulares | Fuente   |
| ---- | --------- | ------- | --------- | -------- |
| FRA  | FINAL     | 26      | 11 ✓      | ff       |
| JPN  | FINAL     | 26      | 0 ⚠️      | ff       |
| BEL  | FINAL     | 26      | 0 ⚠️      | ff       |
| BIH  | FINAL     | 26      | 0 ⚠️      | as+tm    |
| SWE  | FINAL     | 26      | 0 ⚠️      | ff+tm    |
| ARG  | pre-lista | 55      | 0         | ff+tm    |
| BRA  | pre-lista | 51      | 0         | 365+tm   |
| ESP  | pre-lista | 53      | 0         | ff       |
| MEX  | pre-lista | 55      | 0         | 365+tm   |
| QAT  | pre-lista | 33      | 0         | infobae  |

**Bug latente**: 4 selecciones FINAL (JPN, BEL, BIH, SWE) tienen `jugadores_is_final=true` pero 0 jugadores con `es_titular=true` → la EF `get-squad v6` devuelve XI con placeholders "—" → Pizarra Táctica no renderiza el XI. Solo FRA tiene los 11 titulares marcados. Arreglable en el primer run del script con modo `--refresh-final` (re-fetchear la página `/equipos/<slug>` y marcar `es_titular`).

## Objetivo del script

CLI Node.js (`scripts/sync-squads.mjs`) reutilizable, **idempotente**, ejecutable manualmente o en cron del 25-may al 2-jun.

### Modos

```bash
# Scraping desde futbolfantasy
node scripts/sync-squads.mjs --mode=scrape --iso3=FRA            # solo Francia
node scripts/sync-squads.mjs --mode=scrape --all-missing         # las que no tengan lista
node scripts/sync-squads.mjs --mode=scrape --refresh-final       # rescrape FINAL para fix titulares
node scripts/sync-squads.mjs --mode=scrape --all                 # todas las 48 (cuidado)

# Enrich con Transfermarkt
node scripts/sync-squads.mjs --mode=enrich-tm --iso3=FRA
node scripts/sync-squads.mjs --mode=enrich-tm --all
```

### Flags útiles

- `--dry-run`: no aplica UPDATE, solo loguea el diff propuesto
- `--force`: aplica UPDATE incluso si el diff es vacío (refresca `synced_at`)
- `--verbose`: log de cada fetch y match
- `--skip=A,B,C`: iso3 a saltar (csv)
- `--delay=1500`: pausa entre fetches en ms (default 1500 ff, 2500 tm)

## Schema esperado por EF `get-squad v6`

Cada elemento del array `jugadores` (jsonb) — formato igual al de BIH/SWE actual:

```json
{
  "nombre": "Mike Maignan",
  "club": "AC Milan",
  "posicion": "Portero",
  "posicion_bucket": "Portero",
  "es_titular": true,
  "dorsal": null,
  "edad": null,
  "valor": null,
  "dob": null,
  "foto_url": null,
  "fuente": "ff"
}
```

- `posicion_bucket`: `Portero | Defensa | Centrocampista | Delantero`
- `posicion`: igual a `posicion_bucket` por defecto; TM enriquece a específica (Pivote, Lateral derecho...)
- `es_titular=true` solo para los 11 jugadores del XI titular extraídos de la página `/equipos/<slug>` de futbolfantasy

Columnas de la tabla `squads` a actualizar:

```sql
jugadores = <jsonb array>
jugadores_is_final = true   -- true si la fuente fue "anuncia la lista"; false si solo "once tipo"
jugadores_fuente = 'ff'      -- pasa a 'ff+tm' tras enrich
jugadores_synced_at = NOW()
updated_at = NOW()
```

## Mapeo `iso3` → slug futbolfantasy (48 confirmados)

```javascript
export const ISO3_TO_SLUG = {
  ALG:'argelia', ARG:'argentina', AUS:'australia', AUT:'austria',
  BEL:'belgica', BIH:'bosnia-herzegovina', BRA:'brasil', CAN:'canada',
  CIV:'costa-de-marfil', COD:'rd-congo', COL:'colombia', CPV:'cabo-verde',
  CRO:'croacia', CUW:'curazao', CZE:'republica-checa', ECU:'ecuador',
  EGY:'egipto', ENG:'inglaterra', ESP:'espana', FRA:'francia',
  GER:'alemania', GHA:'ghana', HAI:'haiti', IRN:'iran',
  IRQ:'irak', JOR:'jordania', JPN:'japon', KOR:'corea-del-sur',
  KSA:'arabia-saudi', MAR:'marruecos', MEX:'mexico', NED:'holanda',
  NOR:'noruega', NZL:'nueva-zelanda', PAN:'panama', PAR:'paraguay',
  POR:'portugal', QAT:'catar', RSA:'sudafrica', SCO:'escocia',
  SEN:'senegal', SUI:'suiza', SWE:'suecia', TUN:'tunez',
  TUR:'turquia', URU:'uruguay', USA:'estados-unidos', UZB:'uzbekistan',
};
```

Persistido en `scripts/lib/iso3-slugs.json` para consumo del CLI.

> **Nota IRN**: hay noticia 11-mar diciendo "Irán renuncia al Mundial por motivos geopolíticos". San decidió esperar para verificar. Mientras tanto el script debe permitir `--skip=IRN` o tratarlo como sin lista para no fallar.

## Pipeline de scraping por país

### Paso 1: detectar si hay lista publicada

GET `https://www.futbolfantasy.com/world-cup/equipos/<slug>/noticias/1`

Buscar primer enlace que contenga `anuncia-la-lista` o `lista-definitiva`. Extraer el ID y construir URL completa de la noticia.

Si no hay match → `jugadores_is_final=false` y solo scrapear once tipo (paso 3 únicamente).

### Paso 2: parsear lista oficial

GET `https://www.futbolfantasy.com/world-cup/noticias/<id>-<slug-noticia>`

El cuerpo de la noticia tiene esta estructura (verificada en FRA/JPN/BEL):

```
**Porteros**
Mike Maignan (AC Milan)
Robin Risser (Racing Club de Lens)
Brice Samba (Stade Rennais)
**Defensas**
Lucas Digne (Aston Villa)
...
```

Regex sugeridos:

```javascript
const SECTION_RE = /\*\*(Porteros|Defensas|Mediocampistas|Centrocampistas|Delanteros)\*\*\s*\n([\s\S]*?)(?=\n\s*\*\*[A-Z]|\n\s*Ver comentarios|\n\s*####|$)/g;
const PLAYER_LINE_RE = /^([^()]+?)\s+\(([^/)]+?)(?:\/[^)]+)?\)\s*$/;
// $1 = nombre, $2 = club (sin "/País" si lo hay)

const SECTION_TO_BUCKET = {
  'Porteros':'Portero',
  'Defensas':'Defensa',
  'Mediocampistas':'Centrocampista',
  'Centrocampistas':'Centrocampista',
  'Delanteros':'Delantero',
};
```

### Paso 3: extraer XI titular (mode `--refresh-final` o cuando hay lista)

GET `https://www.futbolfantasy.com/world-cup/equipos/<slug>`

Tras `## Posible once tipo y mapa rotacional` el HTML renderiza los 11 nombres en formato:

```
[![Maignan](...)](<>)
[Maignan](<>)
[![Koundé](...)](...)
[Koundé](...)
```

Patrón regex: capturar los 11 primeros nombres tras la sección de once tipo. Si hay alternativos (ej. "Konaté" tras "Upamecano"), el primero es el titular.

Tras extraer los 11 nombres, hacer **matching fuzzy** contra la lista del paso 2:

- Normalizar: lowercase, NFD + strip accents, sin guiones, sin caracteres especiales
- Match por último apellido o nombre+apellido completo
- En FRA: "Théo" del XI → match con "Théo Hernandez" de la lista
- Marcar `es_titular=true` en los matches

### Paso 4: UPSERT a Supabase

```javascript
const { data, error } = await supabase
  .from('squads')
  .update({
    jugadores: playersArray,
    jugadores_is_final: hasFinalList,
    jugadores_fuente: 'ff',
    jugadores_synced_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  })
  .eq('iso3', iso3)
  .select();
```

Usar `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY` desde `.env` (ya están configuradas en el repo).

## Modo `enrich-tm`

TM canonical IDs ya conocidos (de `userMemories`):

```
ESP=3375, ARG=3437, BIH=3446, BRA=3439, MEX=6303, SWE=3557
```

Para los 42 restantes hay que descubrir los TM IDs. Sub-tarea inicial: poblar `lib/tm-ids.json` con `{iso3: tmId}` para los 48. Puede hacerse manualmente la primera vez (búsqueda Google por país) o automatizarlo con un fallback (buscar en Transfermarkt API si la tienen, o scrape de la página de búsqueda).

Una vez con TM IDs poblados:

1. Fetch página TM `https://www.transfermarkt.com/<slug>/kader/verein/<id>`
2. Matching fuzzy nombres scraped ↔ nombres TM (mismo helper que el paso 3 de scrape)
3. Actualizar campos `edad`, `valor`, `dob`, `foto_url`, `posicion` (específica) de cada jugador match
4. Cambiar `jugadores_fuente` de `'ff'` a `'ff+tm'`

## Idempotencia y manejo de errores

- **Antes de UPDATE**: `SELECT jugadores FROM squads WHERE iso3=...` y comparar con scraped via deep-equal. Si igual, no-op (log `FRA: up-to-date, skipped`)
- Si el fetch falla (timeout, 404), continuar con siguiente país, log error
- **Rate limiting**: pausa de 1-2s entre fetches a futbolfantasy para no quemar la IP
- Output final: tabla resumen

```
  iso3 | status   | n  | titulares | fuente | error
  FRA  | updated  | 26 | 11        | ff     | -
  JPN  | updated  | 26 | 11        | ff     | -
  BEL  | updated  | 26 | 11        | ff     | -
  GER  | no-list  | 0  | 0         | -      | -
  IRN  | skipped  | 0  | 0         | -      | manual review
  ...
```

## Estructura sugerida del repo

```
scripts/
  sync-squads.mjs              # CLI principal con yargs/commander
  lib/
    ff-scraper.mjs             # fetch + parse futbolfantasy (paso 1, 2, 3)
    tm-scraper.mjs             # fetch + parse transfermarkt
    name-matcher.mjs           # matching fuzzy nombres (normalize + Levenshtein)
    squads-db.mjs              # supabase client + idempotent upsert
    iso3-slugs.json            # mapping iso3 → slug ff (las 48)
    tm-ids.json                # mapping iso3 → tm canonical id
```

Optional: añadir `package.json` script `npm run sync-squads -- --mode=scrape --all-missing`.

## Test de aceptación post-primer-run

```sql
-- Esperado tras --refresh-final: 5 selecciones FINAL con 26 jugadores y 11 titulares
SELECT iso3,
  jsonb_array_length(jugadores) AS n,
  (SELECT count(*) FROM jsonb_array_elements(jugadores) j
   WHERE (j->>'es_titular')::boolean) AS titulares,
  jugadores_is_final, jugadores_fuente
FROM squads
WHERE jugadores_is_final = true
ORDER BY iso3;
```

Resultado esperado:

| iso3 | n   | titulares | is_final | fuente                                          |
| ---- | --- | --------- | -------- | ----------------------------------------------- |
| BEL  | 26  | 11        | true     | ff                                              |
| BIH  | 26  | 11        | true     | as+tm *(sin tocar, solo añadir titulares)*      |
| FRA  | 26  | 11        | true     | ff                                              |
| JPN  | 26  | 11        | true     | ff                                              |
| SWE  | 26  | 11        | true     | ff+tm *(sin tocar, solo añadir titulares)*      |

## Plan de ejecución sugerido (calendario)

| Fecha              | Acción                                                                                                          |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| Hoy/mañana         | Code escribe `sync-squads.mjs` + `lib/`, prueba con `--iso3=FRA --dry-run`, valida que el dry-run reproduce el estado actual de FRA |
| Hoy/mañana         | Run `--mode=scrape --refresh-final` para arreglar BIH/SWE/JPN/BEL (`es_titular`)                                 |
| 17-may a 24-may    | San ejecuta `--mode=scrape --all-missing` 1-2 veces, captura las nuevas listas que se vayan anunciando         |
| 25-may a 1-jun     | Barridos diarios, ventana de máxima publicación de listas                                                       |
| 2-jun              | Run completo + verificar coincidencia con snapshot oficial FIFA                                                 |
| 3-jun en adelante  | Solo updates si hay bajas de última hora                                                                        |

## Notas finales

- **Manualidades = errors**: el script tiene que ser ejecutable sin intervención humana. Cualquier decisión (Irán, sustituciones de última hora) se resuelve por flag CLI, no editando código.
- **Logs claros**: cada run debe dejar trazabilidad de qué cambió, para poder revertir vía git si hay regresión.
- **Migration log**: tras el primer run productivo (no dry-run), añadir entry a `migration-log.md` con el resumen.
- **TM rate limits**: Transfermarkt es agresivo con scraping. Usar `User-Agent` decente, pausas 2-3s, considerar cache local en `cache/tm/<id>.json` con TTL 24h.
