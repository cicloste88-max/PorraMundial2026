# Parsers — fuentes primarias de listas de convocados

Cada parser de fuente primaria expone el mismo contrato I/O para que
`scripts/sync-squads.mjs --mode=detect` pueda combinarlos sin lógica
condicional por fuente.

## Contrato

```js
// scripts/lib/parsers/<source>.mjs

export const SOURCE_NAME = 'as'; // identificador corto, usado en logs y en jugadores_fuente
export const SOURCE_URL  = 'https://as.com/...';

/**
 * fetchAndParse — orquesta GET + parse de la fuente.
 * @param {Object} opts
 * @param {boolean} [opts.verbose=false]
 * @param {string}  [opts.html]   HTML ya descargado (test fixtures); si se pasa, se evita el fetch.
 * @returns {Promise<ParseResult>}
 */
export async function fetchAndParse({ verbose = false, html = null } = {}) { ... }

/**
 * parseHtml — pura, sin side-effects. Recibe HTML, devuelve estructura.
 * @param {string} html
 * @returns {ParseResult}
 */
export function parseHtml(html) { ... }
```

### `ParseResult`

```ts
type ParseResult = {
  source: 'as' | 'sport' | 'olympics';
  fetchedAt: string;       // ISO timestamp; en parseHtml() se omite
  byIso3: {
    [iso3: string]: {
      group?: 'A' | 'B' | ... | 'L';   // grupo Mundial 2026
      coach?: string;                   // 'Entrenador' / 'DT', opcional
      players: Array<{
        nombre: string;       // string ya decodificado (sin entidades HTML)
        posicion: 'Portero' | 'Defensa' | 'Centrocampista' | 'Delantero';
        dorsal?: number | null;
        club?: string;        // opcional, raras fuentes lo incluyen
      }>;
    };
  };
};
```

### Reglas de implementación

1. **Decodificar HTML in-flight** con `html-entities` (`decode`) — ver patrón en
   `scripts/lib/ff-scraper.mjs`. No emitir `&scaron;`, `&aacute;`, etc.
2. **Mapeo de posición** unificado al vocabulario del proyecto:
   - "Porteros" / "Arqueros" / "Guardametas" → `Portero`
   - "Defensas" / "Defensores" / "Zagueros" → `Defensa`
   - "Mediocampistas" / "Centrocampistas" / "Volantes" → `Centrocampista`
   - "Delanteros" / "Atacantes" / "Arietes" → `Delantero`
3. **Nombre del país → iso3**: usar `scripts/lib/iso3-slugs.json` como referencia
   (las claves son los iso3). Mapping de "España"→ESP, "EE.UU."→USA, etc. vive en
   `scripts/lib/parsers/country-map.json`.
4. **Conteo mínimo viable**: si una selección aparece nombrada pero con `<22`
   jugadores, igual la devuelves (la decide el cross-validate, no el parser).
5. **Si una sección entera falla** (timeout, 403, parse incompleto): lanzar
   excepción. El orquestador la captura y degrada a "2 fuentes activas".

## Implementación pendiente

Los 3 ficheros de fuente (`as.mjs`, `sport.mjs`, `olympics.mjs`) están en estado
**stub** — exponen el contrato y validan el shape pero `parseHtml()` devuelve
`{ byIso3: {} }`. El parser real lo aporta San en commit aparte sobre esta misma
rama, una vez consolidados los HTML samples del 18-may.

`calendar.mjs` y `cross-validate.mjs` sí están implementados — son agnósticos al
HTML específico.
