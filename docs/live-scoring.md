# Live Scoring — Porra Mundial 2026

## Estado del sistema live

| Componente | Versión | Estado |
|---|---|---|
| Actor `sofascore-webshare-proxy` `N8vUChlhok5JU3cnL` | build 1.0.13 | PRODUCCIÓN — proxy Webshare residencial, batch `eventIds[]`, modo `auto` self-healing, 2048MB/300s default |
| Actor `sofascore-live-proxy` `BYLtYcOxYkruVipwr` | build 1.0.19 | FALLBACK — proxies Apify residenciales (~$0.03/run) |
| `porra-match-live` EF | v18 | async + webhook (Webshare principal + fallback automático). Disparada batched por `dispatch-live-slots` (ver §Bloque crítico) |
| `porra-apify-webhook` EF | v9 | logging completo, detecta goles + status, llama Twilio directo. Aún no persiste `home_team_name` / `away_team_name` / `competition` / `match_start_ts` (cosmético — **ya NO bloquea el puente**, que resuelve equipos vía `wc_matches` por `match_key`) |
| `porra-bridge-results` EF | v4 | puente `live_scores`→`results` (grupos + **rama KO**, goleador normalizado, `teams_swapped`, **guardas anti-dato-incompleto**). Disparo automático vía **trigger + barrido** — ver §Bloque crítico + §Puente |
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
**Build**: 1.0.13 (10-jun-2026: reconciliado drift 1.0.7→1.0.10 vía `apify pull` + refactor Nivel 1 — modo `auto`, batch paralelo, timeouts, env vars)

**Técnica**: proxy Webshare residencial rotativo (Playwright + `page.evaluate(fetch)`). Fetch a `api.sofascore.com/api/v1/event/{eventId}` y `/incidents` desde IP residencial. **Modo `auto` (default)**: inyecta cookies del KV Store `sofascore-cookies` SIN cargar sofascore.com (run ~5-6s, mínimo bandwidth Webshare); si no hay cookies o un fetch devuelve 403 → captura cookies frescas (goto + espera de `__cf_bm`) y reintenta solo los ids fallidos (self-healing). Cookies muy longevas (validado reuse con cookies de 2 meses → 200). Modos `capture`/`reuse`/`normal` se mantienen para debug.

**Credenciales**: `WEBSHARE_PROXY_USER` / `WEBSHARE_PROXY_PASS` en env vars secret del actor, pusheadas vía `apify secrets` + referencias `@webshareProxyUser`/`@webshareProxyPass` en `.actor/actor.json` (la referencia es committeable; el valor vive en el CLI local y cifrado en Apify). El user lleva el sufijo de rotación por países (`-US-GB-DE-NL-FR-rotate`). Fail-fast si faltan. **Rotación**: `apify secrets rm` + `apify secrets add` con los valores nuevos + `apify push` (o editar env vars en Console).

**Run options default** (vía API, 10-jun): `memoryMbytes: 2048` (antes 4096 — coste/run a la mitad), `timeoutSecs: 300` (antes 3600 — un run colgado ya no factura 1h). Caveat: si `porra-match-live` pasa `memory`/`timeout` explícitos en su llamada a la API de Apify, esos prevalecen sobre el default.

**Contrato I/O**:

- Input: `{ "eventId": "15832749" }` (single) **o** `{ "eventIds": ["158...", "158..."] }` (batch por slot — así lo invoca `porra-match-live` v18 vía `dispatch-live-slots`) o `{ "matchUrl": "...#id:XXXXX" }`. Opcional `mode: "auto" | "capture" | "reuse" | "normal"` (default `auto`).
- Output: **un item del dataset por eventId**: `{ eventId, event: {status, ok, data: {event: {...}}}, incidents: {status, ok, data: {incidents: [...]}} }`. Si un ID falla, su item lleva `status: 0, ok: false` y el resto del batch continúa. Los ids del batch se fetchean **en paralelo** (1 `page.evaluate`, `AbortSignal.timeout(15s)` por fetch).
- Latencia: ~5-6s por run en camino feliz (reuse), ~15s si toca capture.

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
dispatch-live-slots (cron */3min) → dispatch_live_slots() agrupa partidos por slot
  ↓
porra-match-live EF (v18)  — lanzada batched por slot de match_start_ts
  ↓
Apify API: lanzar actor N8vUChlhok5JU3cnL async (no espera)
  ↓
(Actor completa ~5-10s con Webshare)
  ↓
Apify webhook → porra-apify-webhook EF (v9)
  ↓
├─ leer dataset: { event, incidents }
├─ detectar cambios vs DB (goles + cambios status)
├─ llamar Twilio directo (form-urlencoded fetch)
└─ upsert live_scores
```

El webhook elimina polling síncrono y permite a la EF cron retornar inmediatamente. Si el actor falla o devuelve 5xx, el siguiente slot lo reintenta; el fallback `sofascore-live-proxy` se invoca manualmente si Webshare cae sostenido. La continuación del flujo (`live_scores` → `results` → puntuación) está en §Bloque crítico.

## Bloque crítico: pipeline live→puntuación

Es el **núcleo del torneo**: convierte el estado live crudo de SofaScore en los
resultados canónicos (`results`) que consume el motor de puntuación. Cerrado
end-to-end el **02-jun-2026 (P4)** — el volcado a `results` ya es **automático**
(trigger + barrido); antes el puente se disparaba a mano.

> **Alcance de P4**: cierra SOLO la vía del **puente** (SofaScore → `live_scores`
> → `results`). La vía `update-results` (football-data.org → `results`) es
> **independiente** y sigue pendiente de activar su pg_cron el 11-jun — el puente
> NO la sustituye.

### Diagrama

```
dispatch-live-slots (cron */3min)
  └─ dispatch_live_slots(): agrupa partidos por match_start_ts en slots
     └─ porra-match-live v18 (batched)
        └─ Apify (actor Webshare N8vUChlhok5JU3cnL)
           └─ porra-apify-webhook v9 ──────────────────────────────→ live_scores

live_scores (status→'finished' Y score no-null)
  ├─[TRIGGER bridge_on_finished]─────────→ porra-bridge-results v4 ──→ results
  └─[red de seguridad: cron sweep-unbridged-finished */5min]────────────┘

results ──[on-read]──→ get-league-standings v1.2.0 (motor _shared/scoring.mjs) → puntuación
```

> ⚠️ **Drift runtime↔repo**: el cron `dispatch-live-slots` (`cron.job` jobid 24,
> `*/3min`) y las funciones `dispatch_live_slots()`, `sweep_unbridged_finished()`
> y `trg_bridge_on_finished()` **existen solo en runtime** (creadas vía Supabase
> MCP, sin fichero en `supabase/migrations/`) y **NO están versionadas en el
> repo**. Pendiente backfill a `supabase/migrations/` o docs. Mismo lane que las
> EFs del puente (Claude.ai/MCP).

### Pieza A — Trigger `bridge_on_finished`

Migración `p4_trigger_bridge_on_finished` (vía MCP, 02-jun): función
`trg_bridge_on_finished()` `SECURITY DEFINER` + trigger `bridge_on_finished`
`AFTER UPDATE OF status ON live_scores`. Dispara `porra-bridge-results` vía
`net.http_post` **solo en la transición real** a finished:

```
OLD.status <> 'finished' AND NEW.status = 'finished'
  AND NEW.score_home IS NOT NULL AND NEW.score_away IS NOT NULL
```

Idempotente (la guarda de transición evita re-disparos en updates posteriores
del mismo partido ya finished). **Validado en vivo**: un `UPDATE` de MEX-RSA a
`finished` disparó el puente solo y el resultado apareció en `results` con 3
goleadores normalizados, sin intervención manual.

### Pieza B — Barrido `sweep-unbridged-finished`

Migración `p4_sweep_unbridged_finished` (vía MCP, 02-jun): función
`sweep_unbridged_finished()` `SECURITY DEFINER` + cron `sweep-unbridged-finished`
(`*/5min`). Red de seguridad: detecta partidos `finished` con dato completo cuya
clave **no** está aún en `results` (huérfanos: el trigger falló, o el partido
llegó a finished sin disparar) y **reinvoca el puente sin `match_key`** (procesa
todos, idempotente). Noop barato cuando no hay huérfanos.

> El trigger es el camino feliz (instantáneo); el barrido es la red cada 5 min.
> Juntos garantizan que ningún partido finished se quede sin volcar a `results`.

### Guardas anti-dato-incompleto (premisa "no rectificar después")

El puente v4 **no escribe** si el dato no es fiable, y loguea el motivo en
`results.log` — en vez de escribir un resultado provisional que habría que
corregir luego (rompe la premisa de que un resultado escrito es definitivo):

| Condición | Acción | `results.log` |
|---|---|---|
| `score_home`/`score_away` NULL | skip | `{event:bridge_skip, reason:score_null}` |
| clave no resuelve en ningún diccionario | skip | `{event:bridge_skip, reason:no_dict_entry}` |
| KO empate sin ganador determinable | skip | `{event:bridge_skip, reason:ko_winner_undetermined}` |

**Validado**: la guarda `score_null` no escribió con marcador incompleto.

### Rama KO — `wc_matches_ko` + determinación del winner (penaltis)

- **Resolución de clave**: el puente resuelve el `match_key` de KO contra la tabla
  `wc_matches_ko` (PK `match_key`; esquema en `docs/db-schema.md`). Escribe en
  `results.ko_results["{ko_match_id}"] = {l, v, scorers, winner, round, status}`
  (`ko_match_id` int 73-104, casa `ko_predictions.match_id` y `KO_ROUND_BY_ID`
  del motor). Tabla **vacía** hasta publicarse los IDs SofaScore de KO (~28-jun);
  el código del puente + motor ya la soportan.
- **`koWinner()`** (orden de resolución):
  1. Marcador no-empate → ganador directo.
  2. Empate → `score_agg` (agregado, orientado al proyecto por `teams_swapped`).
  3. Sigue empate → conteo de `penaltyShootout` con `incidentClass='scored'` en
     `events` (tanda de penaltis).
- **`penaltyShootout` EXCLUIDO de `scorers`**: los penaltis de la tanda **no** son
  goleador de la porra (decisión de diseño, no bug — ver ERR-82).
- **Motor `calcKOMatchPoints` (v1.2.0)**: determina el ganador KO por
  `opts.winner` (`'home'|'away'`) si viene, con **fallback** a la derivación
  `l`/`v`. Motivo: un KO que acaba en empate y se decide por penaltis tenía
  `realWinner=null` con el motor viejo → el avance de ronda **no puntuaba** aunque
  el usuario acertara el clasificador (la card KO obliga a indicar quién pasa).
  Con `winner` explícito, quien predice empate + classifier correcto SÍ se lleva
  el `+5/+10/…`. Retrocompatible: grupos no usan `winner`; KO sin penaltis cae al
  fallback. `index.ts` pasa `winner: real.winner` a `calcKOMatchPoints`.

### Validaciones (evidencia 02-jun, runtime)

- **Trigger en vivo**: `UPDATE` MEX-RSA→finished disparó el puente solo →
  `results` con 3 goleadores normalizados.
- **Simulacro KO penaltis**: empate 1-1, ganador por tanda 6-2 → `winner:home`; el
  motor da `+5` (avance) a quien predijo `classifier=home` y `0` a
  `classifier=away`.
- **Guarda score-null**: no escribió con marcador incompleto.
- **Goleadores normalizados** vía `playerToShortKey`: Pedri, Mbappe, Jimenez,
  Lozano, Percy.
- Todos los seeds de simulacro **limpiados** tras validar.

## Puente `live_scores → results` (porra-bridge-results)

EF **`porra-bridge-results` v4** (`verify_jwt=false`, auth por secret igual a
`service_role`). Es el eslabón que convierte el estado live crudo en los
resultados canónicos que consume el scoring: `live_scores` (SofaScore) →
`results` (keyspace del proyecto). Lane Claude.ai/MCP — **no vive en el repo**
(desplegada vía MCP; v3 01-jun, **v4 02-jun**). Su **invocación es automática**
(trigger `bridge_on_finished` + cron `sweep-unbridged-finished`, ver §Bloque
crítico); **no invocar a mano salvo debug**. Esta sección detalla la rama de
**grupos**; la rama **KO** y las **guardas** están en §Bloque crítico.

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

### Invariante de orientación (CRÍTICO — ERR-95/96)

**`live_scores` guarda SIEMPRE el orden de la FUENTE; la corrección a
orden-proyecto se aplica UNA sola vez aguas abajo.** El writer (webhook
SofaScore o `espn-poll`) **NUNCA** pre-orienta:

- **`espn_event_map.inverted` debe ser `false`** (también en BRA-ESC). Si está
  `true`, `espn-poll` pre-orienta marcador + `events.isHome` a orden-proyecto y
  entonces el puente y `live-sync.js`/`ui-directo.js` (que aplican
  `teams_swapped`) RE-invierten → **doble corrección = marcador espejo**
  (3-0 → 0-3). Fue ERR-95: la migración SofaScore→ESPN (12-jun) duplicó la
  responsabilidad de orientar. `espn_event_map` es **runtime-only** (sin seed en
  el repo): ante cualquier reseed/backfill, preservar `inverted=false`.
- **El SIGNO de la IA** sigue la misma regla en el frontend: `loadIAPredictions`
  (`auth.js`) lo orienta UNA vez con `iaSignForCard` (espejo de
  `buildIaSignByLegacyKey` en `_shared/ia-bridge.mjs`); los consumidores
  (`iaBonusWillApply`, chip vs-IA, `v3ComputeIAStandings`, `hydrateIABar`,
  `renderIA`) NO re-voltean. Las **probabilidades** se orientan en presentación
  (`v3IAOrientProbs`), no en el load. Omitir el flip del signo fue ERR-96
  (+1 anti-IA fantasma en el card del fixture swapped).
- **KO (~28-jun)**: al sembrar `wc_matches_ko` + filas `espn_event_map`,
  `inverted=false` + `wc_matches_ko.teams_swapped` según la fuente; el puente
  NO necesita rama distinta grupos/KO bajo este invariante.

### Normalización del goleador

1. **`extractScorers(events)`**: recorre los incidents de SofaScore quedándose
   con los goles válidos e **ignora `ownGoal`** (gol en propia puerta no cuenta
   para el +2 de goleador). **Modelo de incidencias SofaScore**: el gol de
   penalti en juego es `incidentType='goal'` con **`incidentClass='penalty'`**
   (NO existe un tipo `inGamePenalty`); el gol normal es `incidentClass='regular'`;
   la tanda de penaltis KO es `penaltyShootout`. Se ignora el resto
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

> **Reconciliado (10-jun, vía docs del PR #131)**: el cron **`dispatch-live-slots`**
> (`cron.job` jobid 24, `*/3min`) **SUPERSEDE a `schedule_match_crons`** para el flujo
> live de grupos (evita doble polling). El helper se conserva para simulacros/ad-hoc.
> `dispatch_live_slots()` agrupa `live_scores` por `match_start_ts` (slot), filtra vivos
> por ventana `[start-45min, start+window]` (grupos 150min / KO 210min) y hace early-exit
> barato si 0 vivos (auto-gating: no dispara nada hasta el 11-jun T-45 del inaugural).
> **Seed**: `live_scores` sembrada con los 72 partidos de grupos desde `wc_matches` +
> índice único `live_scores_match_key_uidx` (imprescindible para los upserts del webhook).
> **Clustering**: 72 partidos → 60 slots (48 de 1 + 12 de 2 en jornada 3) → concurrencia
> Apify ≤ 2 runs (su límite). **KO ~28-jun pendiente**: sembrar 32 filas con sus eventId +
> resolución de marcador prórroga/penaltis en el webhook. Backfill de
> `dispatch_live_slots()` a `supabase/migrations/` sigue pendiente.

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

1. **Búsqueda web**: `web_search` Google con `site:sofascore.com <home> <away> <fecha>`. **El `#id:` ya NO aparece** (SofaScore migró a URLs `/match/{slug}/{customId}` sin hash). Dos métodos validados para obtener el ID numérico:
   - `web_fetch` de la página del partido y extraer el ID del `<meta og:image>` (apunta a `…/api/v1/event/{ID}/share-image`).
   - **API de búsqueda** (validado 10-jun, Ponte Preta-Cuiabá): `https://api.sofascore.com/api/v1/search/all?q=<equipo1>%20<equipo2>` devuelve los eventos con su `id` numérico directamente. Ojo: el `status` de esta respuesta puede venir cacheado (decía `notstarted` con el partido en el min 65); el dato live real lo da el actor.
2. **Validación**: ejecutar el actor Webshare con ese ID:
   ```
   apify call N8vUChlhok5JU3cnL -i '{"eventId":"XXXXXXX"}' -t 30
   ```
   Si `event.homeTeam.name` y `event.awayTeam.name` cuadran con los equipos esperados, confirmado. Si Cloudflare devuelve 403 (ver ERR-05), reintentar con el fallback `sofascore-live-proxy`.
3. **Registro**: añadir el ID al JSON `worldcup-2026-sofascore-ids.json` + crear fila en `live_scores` con `match_key=wc2026_g{LETRA}_{sofascore_id}` + programar crons con `SELECT schedule_match_crons(match_key, start_ts)`.

URL pública SofaScore (input del workflow, nunca la construimos internamente): `https://www.sofascore.com/match/{slug}/{customId}` (SofaScore retiró el viejo `…#id:{sofascore_id}`). El `sofascore_id` numérico que necesita el actor **NO es** el `{customId}` de la URL — obtenerlo por `og:image` o por la API de búsqueda (ver paso 1).

> **EF `porra-sofascore-proxy` (v9) — MUERTA**: el fetch directo a `api.sofascore.com` desde Supabase devuelve challenge 403 de Cloudflare (ERR-05). El **actor Apify es el único camino** para datos SofaScore server-side; no reintroducir un proxy en EF.

**Nota**: los simulacros (`is_historic=true` en `live_scores`) usan exactamente este mismo workflow. La única diferencia es el flag `is_historic` que filtra de la UI live del Mundial. Detalle de simulacros en `docs/simulacros.md`.
