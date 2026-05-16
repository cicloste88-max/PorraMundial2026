# Reglas — sync-squads

## Cuándo se carga esta regla

Al editar `scripts/sync-squads.mjs`, ficheros bajo `scripts/lib/**`, o el workflow
`.github/workflows/sync-squads.yml`.

## 1 · `--refresh-final` vs `--mode=scrape` sin él

- **`--refresh-final` SIEMPRE preserva el roster existente** (nombres + `jugadores_fuente`
  con sufijo `+tm` intactos) y solo reaplica `es_titular` según el XI scrapeado.
  Decode HTML in-flight de `nombre` + `club` limpia entidades crudas heredadas
  (e.g. `Kola&scaron;inac` → `Kolašinac`).
- **`--mode=scrape` sin `--refresh-final`** **SÍ sustituye** el roster por el
  scrapeado. Si el país ya tenía enrichment TM, lo perdería. Solo usarlo cuando
  el roster en BD está vacío o desactualizado vs la noticia más reciente.
- Para países pre-listas (ARG/BRA/ESP/MEX/QAT) cuando publiquen FINAL: usar
  `--mode=scrape --iso3=<iso3>` (sin `--refresh-final`) **una vez** para
  refrescar el roster, luego `--mode=enrich-tm --iso3=<iso3>` para recuperar
  edad/dob/valor/foto. Saltar el orden inverso → `--refresh-final` no hará nada
  útil hasta que el roster esté en sync con la lista anunciada.

Detalle: ERR-47 + `docs/sync-squads.md` §"--refresh-final y enrichment TM".

## 2 · Añadir un nuevo país

Si FIFA confirma un repechaje o expansión de plazas:

1. **`scripts/lib/iso3-slugs.json`** — añadir `"NEW": "slug-en-futbolfantasy"`.
   El slug debe coincidir con la URL en `futbolfantasy.com/world-cup/equipos/<slug>`.
2. **`scripts/lib/tm-ids.json`** — añadir `"NEW": null` (placeholder). Luego buscar
   el TM ID y reemplazar (ver §3).
3. **`squads` table** — INSERT row para `iso3='NEW'` con `jugadores=[]`,
   `jugadores_is_final=false`, `jugadores_fuente=null`. El script no hace INSERT,
   solo UPDATE.

Verificar: `node scripts/sync-squads.mjs --mode=scrape --iso3=NEW --dry-run --verbose`.

## 3 · Actualizar / descubrir TM IDs canónicos

TM no expone API pública para search. Procedimiento manual:

1. Google: `site:transfermarkt.com <país> seleccion nacional`.
2. URL formato `https://www.transfermarkt.com/<slug>/startseite/verein/<id>`.
   Capturar el `<id>` (numérico, e.g. `3375` para España).
3. Verificar con un dry-run: `node scripts/sync-squads.mjs --mode=enrich-tm --iso3=<XXX> --dry-run --verbose`.
   Comprobar que el log muestra `TM cache hit` o `GET https://...kader/...` (no error 404).
4. Editar `scripts/lib/tm-ids.json` reemplazando `null` por el ID.

**6 IDs ya conocidos** (no tocar sin razón): `ESP=3375 · ARG=3437 · BIH=3446 · BRA=3439 · MEX=6303 · SWE=3557`.

## 4 · Añadir una fuente nueva (ESPN, AS, Marca...)

El parser actual asume el formato de futbolfantasy. Para sumar una fuente alternativa:

1. **Crear nuevo módulo** `scripts/lib/<fuente>-scraper.mjs` con función equivalente
   a `scrapeCountry(slug, opts)` que devuelva `{ roster, is_final, xi_names, titulares }`.
2. **Reusar `decodeHtml()` y `matchAgainstRoster()`** existentes en `ff-scraper.mjs`
   y `name-matcher.mjs` — no duplicar lógica de entidades ni de matching.
3. **NO tocar `sync-squads.mjs`** sin discutir con San: el CLI es un contrato
   estable. Si la fuente nueva es opcional, añadirla detrás de un flag
   `--source=ff|espn|as` con default `ff`.
4. **Probar fuera del flujo CI primero**. La fuente nueva no debe pisar el cron
   activo hasta validar idempotencia con al menos 2 países.

## 5 · Manejo del cron schedule del workflow

Frecuencia actual: `'0 */6 * * *'` (cada 6h UTC).

### Cambios recomendados según fase

- **Pre-snapshot FIFA (hasta 2-jun)**: dejar 6h.
- **Durante el Mundial (11-jun → 18-jul)**: bajar a `'0 0,12 * * *'` (cada 12h)
  para reducir runs innecesarios — solo importan las bajas, no listas nuevas.
- **Post-Mundial**: comentar la sección `schedule:` entera o eliminarla. Dejar
  `workflow_dispatch` para mantener la opción manual.

### Cambiar la frecuencia

Editar `.github/workflows/sync-squads.yml` línea con `cron:` y commit + push.
GitHub respeta el nuevo cron en máximo 1 ciclo del antiguo.

### Deshabilitar temporalmente sin tocar YAML

UI: `Actions → Sync Squads → ⋯ → Disable workflow`. Para reactivar: `Enable workflow`.

## 6 · Patrón decode in-flight (preservación de datos)

Cuando un cambio de schema o de parser cambia cómo se almacenan los datos, **NO
pisar el dato existente** con el output del nuevo parser. Aplicar decode/normalize
in-flight al cargar desde BD para limpiar el dato existente sin perder enrichment.

Caso de referencia: tras migrar a `html-entities` v2.6, el roster BIH en BD tenía
`Sead Kola&scaron;inac` (entidad cruda del scrape pre-html-entities). En lugar de
re-scrapear (perdería `as+tm`), el bloque `--refresh-final` en `sync-squads.mjs`
aplica `decode()` a `nombre` + `club` al cargar de BD, antes de pasar al matcher.
El UPDATE final tiene los nombres limpios y preserva `jugadores_fuente='as+tm'`.

```javascript
const { decode } = await import('html-entities');
const decodeName = (s) => decode(String(s ?? ''))
  .replace(/[‘’‚′]/g, "'").replace(/[“”„″]/g, '"');
players = existing.jugadores.map((p) => ({
  ...p,
  nombre: decodeName(p.nombre),
  club: decodeName(p.club),
  es_titular: false,  // matcher la reaplica
}));
```

## 7 · Caveats operacionales

- **Rate limits**: FF 1.5s entre fetches (default `--delay=1500`), TM 2.5s con
  cache 24h. No bajar sin razón: TM banea IPs agresivamente.
- **Cache TM `cache/tm/<id>.json`** está en `.gitignore`. El runner CI nunca lo
  reusa entre runs (filesystem efímero); siempre re-fetchea TM.
- **`SUPABASE_SERVICE_ROLE_KEY`** debe estar en `.env` local (gitignored) y en
  GitHub Secrets para el workflow. Nunca en código ni en logs.
- **Logs del workflow** retención 14d. Si necesitas histórico más largo,
  descargar y guardar como artifact persistente en otro sitio.
- **Cron retraso**: GitHub Actions retrasa ~30min en horas pico. No alarmarse
  si `synced_at` no coincide al minuto con el cron.

## Referencias

- `docs/sync-squads.md` — operacional completo.
- `docs/brief-sync-squads.md` — brief original (snapshot 16-may del diseño).
- ERR-46/47/48/49/50 — bugs cerrados durante el sprint inicial.
- `CHANGELOG.md` entrada 2026-05-16 — sprint commits + lecciones.
