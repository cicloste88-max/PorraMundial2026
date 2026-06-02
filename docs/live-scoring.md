# Live Scoring — Porra Mundial 2026

## Estado del sistema live

| Componente | Versión | Estado |
|---|---|---|
| Actor `sofascore-webshare-proxy` `N8vUChlhok5JU3cnL` | build 1.0.7 | PRODUCCIÓN — proxy Webshare residencial (~$0.001/run) |
| Actor `sofascore-live-proxy` `BYLtYcOxYkruVipwr` | build 1.0.19 | FALLBACK — proxies Apify residenciales (~$0.03/run) |
| `porra-match-live` EF | v17 | async + webhook (Webshare principal + fallback automático) |
| `porra-apify-webhook` EF | v8 | logging completo, detecta goles + status, llama Twilio directo. Aún no persiste `home_team_name` / `away_team_name` / `competition` / `match_start_ts` (cosmético — **ya NO bloquea el puente P3**, que resuelve equipos vía `wc_matches` por `match_key`) |
| `porra-bridge-results` EF | v3 | puente `live_scores`→`results` (goleador normalizado + `teams_swapped`) — ver §Puente `live_scores → results` |
| `porra-whatsapp-send` EF | v2 | form-urlencoded via fetch |
| `porra-whatsapp-webhook` EF | v5 | OK |
| Actor Azzouzana `VzKtdb1t0Qnc07X8V` | — | NO usar — caché CDN ~15min |

Descripciones extendidas de las EFs en `docs/architecture.md`.

## Costes

Torneo completo (104 partidos):

- Actor Webshare (producción): ~**$13** total
- Fallback anterior (`sofascore-live-proxy`): ~$318 estimados
- Plan Webshare: 1GB gratis/mes + $3.50/mes pagado

Webshare reduce coste ~96% respecto al proxy datacenter porque las IPs residenciales no están en listas negras de Cloudflare Bot Management y las cookies SofaScore son reutilizables entre requests desde IPs distintas.

## Actor principal — sofascore-webshare-proxy

**ID**: `N8vUChlhok5JU3cnL`
**Build**: 1.0.7

**Técnica**: proxy Webshare residencial rotativo. Fetch directo a `api.sofascore.com/api/v1/event/{eventId}` y `/incidents` desde IP residencial; cookies SofaScore reutilizables.

**Contrato I/O**:

- Input: `{ "eventId": "15832749" }` (single, retrocompat) **o** `{ "eventIds": ["15832749","…"] }` (batch por slot). `matchUrl` con `#id:` sigue aceptándose.
- Output JSON: **un item por eventId** en el dataset — cada uno `{ eventId, event: {status, ok, data:{event}}, incidents: {status, ok, data:{incidents:[…]}} }`.
- Un único `context`+cookies por run; `try/catch` por id (un partido que falle no tumba el resto del batch — empuja un item `ok:false` que el webhook ignora).
- Latencia: ~5-10 segundos por run

## Actor fallback — sofascore-live-proxy

| Campo | Valor |
|---|---|
| Actor ID | `BYLtYcOxYkruVipwr` |
| Build | 1.0.19 |
| Imagen Docker | `apify/actor-node-playwright-chrome:20` |
| Repo | `apify-actors/sofascore-live-proxy/` en GitHub |
| Latencia | ~30-44s por run |
| Coste | ~$0.03 por run |
| Técnica | Playwright lanza Chrome + proxy Apify RESIDENTIAL → carga sofascore.com → `page.evaluate(fetch)` llama a `api.sofascore.com` desde contexto browser → bypasea Cloudflare |

**Por qué se mantiene**: fallback robusto si Webshare falla o su plan expira. Más caro pero independiente.

## Flujo async + webhook

```
pg_cron (cada 3 min durante partido)
  ↓
porra-match-live EF (v17)
  ↓
Apify API: lanzar actor N8vUChlhow5JU3cnL async (no espera)
  ↓
(Actor completa ~5-10s con Webshare)
  ↓
Apify webhook → porra-apify-webhook EF (v8)
  ↓
├─ leer dataset: { event, incidents }
├─ detectar cambios vs DB (goles + cambios status)
├─ llamar Twilio directo (form-urlencoded fetch)
└─ upsert live_scores
```

El webhook elimina polling síncrono y permite a la EF cron retornar inmediatamente. Si el actor falla o devuelve 5xx, el siguiente cron lo reintenta; el fallback `sofascore-live-proxy` se invoca manualmente si Webshare cae sostenido.

> **Batching por slot (en preparación, lane MCP)**: el actor ya acepta `eventIds[]`
> (ver Contrato I/O) para leer varios partidos de un slot en un único run. El lanzador,
> el webhook multi-item y el dispatcher que lo orquestan son Edge Functions / cron
> (no viven en el repo) y se documentarán al desplegarse.

## Puente `live_scores → results` (porra-bridge-results)

EF **`porra-bridge-results` v3** (`verify_jwt=false`, auth por secret igual a
`service_role`). Es el eslabón que convierte el estado live crudo en los
resultados canónicos que consume el scoring: `live_scores` (SofaScore) →
`results.match_results` (keyspace del proyecto). Lane Claude.ai/MCP — **no vive
en el repo** (desplegada vía MCP, 01-jun-2026).

### Flujo

```
live_scores (status='finished', is_historic=false)
  ↓  join por match_key
wc_matches  (group_letter, home_es, away_es, teams_swapped, home_iso3, away_iso3)
  ↓  por cada partido finished
results.match_results["{group_letter}_{home_es}_{away_es}"]
   = { l, v, scorers:[...], status:'finished' }     ← vía jsonb_set
```

- **Clave de escritura** = `{grupo}_{home_es}_{away_es}` = `getMatchKey`
  (`data.js`) = `predictions.match_id` (`admin.js`). Mismo keyspace que lee
  `get-league-standings` al puntuar → marcador y goleador casan directo, sin
  reconciliación adicional.
- **`teams_swapped`**: `home_es`/`away_es` son canónicos del proyecto;
  SofaScore puede listar el partido con los equipos invertidos
  (`home_en`/`away_en`). Cuando `wc_matches.teams_swapped=true` el puente
  invierte marcador y orientación del goleador para alinearlos al proyecto
  (igual que `live-sync.js`/`ui-directo.js` tratan `_es` como canónico). En
  fase de grupos solo `wc2026_gC_15186861` (Brasil vs Escocia) está swapped.

### Normalización del goleador

1. **`extractScorers(events)`**: recorre los incidents de SofaScore quedándose
   con los goles válidos e **ignora `ownGoal`** (gol en propia puerta no cuenta
   para el +2 de goleador). **Modelo de incidencias SofaScore**: el gol de
   penalti en juego es `incidentType='goal'` con **`incidentClass='penalty'`**
   (NO un tipo `inGamePenalty`); el gol normal es `incidentClass='regular'`; la
   tanda de penaltis KO es `penaltyShootout`. Se ignora todo lo demás
   (`card`/`substitution`/`period`/`injuryTime`/`varDecision`). El marcador se
   toma de `event.homeScore/awayScore.current`, nunca contando incidents.
2. **iso3 del autor**: derivado de `isHome` del incident combinado con
   `teams_swapped` → resuelve a `home_iso3` / `away_iso3` de `wc_matches`.
3. **`playerToShortKey(name, iso3)`** (port de `scorer-keys.ts`): busca al
   jugador en `equipos_players[iso3]` por `name.includes(...)` (match laxo sobre
   el nombre SofaScore). Si no casa, **fallback** = último token del nombre
   normalizado NFD (sin acentos). Devuelve la *key corta* (p.ej. `Jimenez`,
   `Son`) que coincide con la que el usuario eligió en el picker (mismas keys de
   `equipos-players.json`).

> El motor de puntuación compara `pred.gol` contra `scorers[]`; ambos lados
> deben hablar el mismo vocabulario de *keys cortas*, no el nombre SofaScore
> crudo. De ahí la normalización.

### Tablas de runtime espejo de JSON del repo

El puente lee dos tablas que son **espejo 1:1 de ficheros del repo**, cargadas
vía MCP (sin migration file). Esquema en `docs/db-schema.md`.

| Tabla | Filas | Fuente repo |
|---|---|---|
| `wc_matches` | 72 | `public/data/worldcup-2026-matches.json` |
| `equipos_players` | 48 | `public/data/equipos-players.json` (`iso3`→`[{key,name}]`) |

⚠️ **Dependencia de recarga**: si esos JSON cambian (p.ej. el sync de squads
enriquece `equipos-players.json`, o se añadieron `home_iso3`/`away_iso3` a
`worldcup-2026-matches.json` como en P3c), hay que **RECARGAR la tabla**
correspondiente (`UPDATE … FROM jsonb_each(...)`). Repo y tabla NO se
sincronizan solos: editar el JSON sin recargar deja el puente leyendo datos
viejos.

## Pattern crons live

- **Pre-match**: 1 call a T-45min antes del kickoff para establecer baseline.
- **Durante partido**: polling `*/3 * * * *` (cada 3 min) durante 150min desde `start_ts`.
- **Estados de SofaScore** que el cron sigue: `notstarted` / `inprogress` / `halftime` / `overtime` / `penalties` / `finished`. Al detectar `finished`, parar.

Ambos crons se programan vía `schedule_match_crons(match_key, start_ts)` (helper documentado en `docs/db-schema.md`). Nunca duplicar manualmente.

## SofaScore IDs

| Torneo | tournament | season |
|---|---|---|
| UCL 2025/26 | 7 | 61644 |
| World Cup 2026 | 16 | 58210 |

- 72 partidos de grupos mapeados en `apify-actors/sofascore-webshare-proxy/worldcup-2026-sofascore-ids.json`.
- IDs de eliminatorias disponibles ~28 jun 2026 (tras finalizar fase de grupos).
- Primer partido WC: México vs Sudáfrica · 11 jun 2026 20:00 UTC · Estadio Azteca · `eventId=15186710`.

**Formato `match_key` interno** (nuestro, no de SofaScore): `wc2026_g{LETRA}_{sofascore_id}`. Ej: `wc2026_gA_15186710`. PK en `live_scores` y clave en `public/data/worldcup-2026-matches.json`. El sufijo numérico coincide con `sofascore_id` para cross-lookup rápido.

## Cómo se descubre un eventId nuevo

SofaScore no expone API pública para obtener el ID por equipos + fecha. Workflow manual probado para KO + simulacros:

1. **Búsqueda web**: `web_search` Google con `site:sofascore.com <home> <away> <fecha>`. **El `#id:` ya NO aparece en el snippet** (SofaScore migró a URLs `/match/{slug}/{customId}` sin el hash). Método actual: `web_fetch` de la página del partido y extraer el ID del `<meta og:image>`, que apunta a `…/event/{ID}/share-image`. Copiar ese `{ID}`.
2. **Validación**: ejecutar el actor Webshare con ese ID:
   ```
   apify call N8vUChlhok5JU3cnL -i '{"eventId":"XXXXXXX"}' -t 30
   ```
   Si `event.homeTeam.name` y `event.awayTeam.name` cuadran con los equipos esperados, confirmado. Si Cloudflare devuelve 403 (ver ERR-05), reintentar con el fallback `sofascore-live-proxy`.
3. **Registro**: añadir el ID al JSON `worldcup-2026-sofascore-ids.json` + crear fila en `live_scores` con `match_key=wc2026_g{LETRA}_{sofascore_id}` + programar crons con `SELECT schedule_match_crons(match_key, start_ts)`.

URL pública SofaScore (input del workflow, nunca la construimos internamente): `https://www.sofascore.com/match/{slug}/{customId}` (SofaScore retiró el viejo `…#id:{sofascore_id}`). El `sofascore_id` numérico que necesita el actor **no** es el `{customId}` de la URL: se extrae del `<meta property="og:image">` de la página, que apunta a `…/api/v1/event/{sofascore_id}/share-image`.

> **EF `porra-sofascore-proxy` (v9) — MUERTA**: el fetch directo a `api.sofascore.com` desde Supabase devuelve un challenge 403 de Cloudflare (ERR-05). El **actor Apify es el único camino** para datos SofaScore; no reintroducir un proxy server-side. Marcada OBSOLETA en `docs/architecture.md`.

**Nota**: los simulacros (`is_historic=true` en `live_scores`) usan exactamente este mismo workflow. La única diferencia es el flag `is_historic` que filtra de la UI live del Mundial. Detalle de simulacros en `docs/simulacros.md`.
