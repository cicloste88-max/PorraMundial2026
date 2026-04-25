# Live Scoring — Porra Mundial 2026

## Estado del sistema live

| Componente | Versión | Estado |
|---|---|---|
| Actor `sofascore-webshare-proxy` `N8vUChlhok5JU3cnL` | build 1.0.7 | PRODUCCIÓN — proxy Webshare residencial (~$0.001/run) |
| Actor `sofascore-live-proxy` `BYLtYcOxYkruVipwr` | build 1.0.19 | FALLBACK — proxies Apify residenciales (~$0.03/run) |
| `porra-match-live` EF | v16 | async + webhook (Webshare principal + fallback automático) |
| `porra-apify-webhook` EF | v7 | logging completo, detecta goles + status, llama Twilio directo. Bug pendiente v8: no persiste `home_team_name` / `away_team_name` / `competition` / `match_start_ts` |
| `porra-whatsapp-send` EF | v1 | form-urlencoded via fetch |
| `porra-whatsapp-webhook` EF | v4 | OK |
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

- Input: `{ "eventId": "15832749" }`
- Output JSON: `item.event = {status, ok, data: {event: {...}}}` + `item.incidents = {status, ok, data: {incidents: [...]}}`
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
porra-match-live EF (v16)
  ↓
Apify API: lanzar actor N8vUChlhow5JU3cnL async (no espera)
  ↓
(Actor completa ~5-10s con Webshare)
  ↓
Apify webhook → porra-apify-webhook EF (v7)
  ↓
├─ leer dataset: { event, incidents }
├─ detectar cambios vs DB (goles + cambios status)
├─ llamar Twilio directo (form-urlencoded fetch)
└─ upsert live_scores
```

El webhook elimina polling síncrono y permite a la EF cron retornar inmediatamente. Si el actor falla o devuelve 5xx, el siguiente cron lo reintenta; el fallback `sofascore-live-proxy` se invoca manualmente si Webshare cae sostenido.

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

1. **Búsqueda web**: `web_search` Google con `site:sofascore.com <home> <away> <fecha>`. En el snippet aparece el hash `#id:XXXXXXX` de la URL pública — copiar el número.
2. **Validación**: ejecutar el actor Webshare con ese ID:
   ```
   apify call N8vUChlhok5JU3cnL -i '{"eventId":"XXXXXXX"}' -t 30
   ```
   Si `event.homeTeam.name` y `event.awayTeam.name` cuadran con los equipos esperados, confirmado. Si Cloudflare devuelve 403 (ver ERR-05), reintentar con el fallback `sofascore-live-proxy`.
3. **Registro**: añadir el ID al JSON `worldcup-2026-sofascore-ids.json` + crear fila en `live_scores` con `match_key=wc2026_g{LETRA}_{sofascore_id}` + programar crons con `SELECT schedule_match_crons(match_key, start_ts)`.

URL pública SofaScore (input del workflow, nunca la construimos internamente): `https://www.sofascore.com/{home-slug}-{away-slug}/{match-code}#id:{sofascore_id}`. Solo importa el número tras `#id:`.

**Nota**: los simulacros (`is_historic=true` en `live_scores`) usan exactamente este mismo workflow. La única diferencia es el flag `is_historic` que filtra de la UI live del Mundial. Detalle de simulacros en `docs/simulacros.md`.
