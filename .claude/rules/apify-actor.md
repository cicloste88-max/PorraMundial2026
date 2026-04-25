---
description: Reglas al tocar Apify actors
globs:
  - "apify-actors/**"
---

# Reglas — Apify Actors

## Cuándo se carga esta regla

Al modificar cualquier fichero bajo `apify-actors/`. Cubre desarrollo local, validación del contrato I/O, deployment a producción y troubleshooting en runtime.

## Actor principal vs fallback

**Principal en producción**: `sofascore-webshare-proxy` (ID `N8vUChlhok5JU3cnL`, build 1.0.7). Proxy Webshare residencial rotativo, fetch directo a `api.sofascore.com/api/v1/event/{id}` y `/incidents`. Cookies de SofaScore reutilizables (no IP-bound). Latencia ~5–10s, coste ~$0.001/run.

**Fallback**: `sofascore-live-proxy` (ID `BYLtYcOxYkruVipwr`) basado en Playwright + proxy Apify residencial. Más caro (~$0.03/run) y lento (~30–44s) pero robusto si Webshare falla. Detalle del pipeline en `docs/live-scoring.md`.

## Contrato I/O del actor Webshare

**Input**: `{ "eventId": "15832749" }` (identificador numérico SofaScore).

**Output**: dataset Apify con dos items:
- `item.event` = `{ status, ok, data: { event: {...} } }` con el evento completo (homeTeam, awayTeam, scores, status).
- `item.incidents` = `{ status, ok, data: { incidents: [...] } }` con timeline de incidencias (goles, tarjetas, sustituciones).

Ambas respuestas llevan campos `status: "ok"` para manejo de errores.

## Build y push del actor

Tras modificar código del actor Webshare:

```bash
cd apify-actors/sofascore-webshare-proxy
apify push --actor-id N8vUChlhok5JU3cnL
```

Para pruebas manuales antes de push:

```bash
apify call N8vUChlhok5JU3cnL -i '{"eventId":"15832749"}' -t 90
```

`-t 90` define timeout de 90s.

## Workflow descubrimiento eventId nuevo

SofaScore no expone API pública para obtener el ID por equipos + fecha. Procedimiento manual validado:

1. **Web search**: `site:sofascore.com <home> <away> <fecha>` en Google. El snippet contiene `#id:XXXXXXX` en la URL.
2. **Validar ID**: `apify call N8vUChlhok5JU3cnL -i '{"eventId":"XXXXXXX"}' -t 30`. Confirmar que `event.homeTeam.name` y `event.awayTeam.name` cuadran.
3. **Registrar**: añadir el ID a `worldcup-2026-sofascore-ids.json` y a `live_scores`. Programar crons con `SELECT schedule_match_crons(...)` (ver `docs/db-schema.md`).

Detalle completo en `docs/live-scoring.md`.

## Cloudflare 403

Cloudflare Bot Management rechaza con 403 las solicitudes desde IPs de datacenter. El proxy residencial rotativo de Webshare bypasa el bloqueo. **Nunca** hacer `fetch` directo a `api.sofascore.com` desde Edge Functions de Supabase u otros servicios en servidor — siempre invocar el actor como intermediario.

Referencia: ERR-05.

## Actor Azzouzana — NO usar

Actor `VzKtdb1t0Qnc07X8V` tiene caché CDN ~15min. **No usar** para datos live; reservado para consultas de catálogo estático (si fuera necesario).
