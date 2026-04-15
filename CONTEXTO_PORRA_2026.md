# CONTEXTO MAESTRO — Porra Mundial 2026
> Actualizado: 2026-04-15 02:00 | Fuente: sesión activa
> Cargar este fichero al inicio de cada sesión para contexto completo inmediato.

---

## 🌐 URLs y accesos

| Recurso | Valor |
|---|---|
| **Producción** | porramundial2026-seven.vercel.app |
| **Repo** | github.com/cicloste88-max/PorraMundial2026 |
| **Rama activa** | `main` |
| **Supabase proyecto** | `cmyfyswystjgzdwbqyyb` |
| **Último commit** | `8e8ac44` |

---

## 🔴 PENDIENTE URGENTE — Próxima sesión

**Bug:** pg_net timeout en `porra-match-live`. El actor tarda ~44s y pg_net corta antes.

**Fix propuesto — arquitectura async en 2 pasos:**
1. Cron lanza el actor de Apify de forma **async** (sin esperar respuesta)
2. Apify llama a un **webhook** en Supabase cuando el actor termina
3. El webhook procesa los datos, detecta cambios y envía WhatsApp

```
pg_cron → net.http_post (lanzar actor, no esperar)
Apify actor termina → webhook → EF procesa → WhatsApp
```

---

## 🏗️ Stack

| Capa | Tecnología |
|---|---|
| Frontend | Vite + vanilla JS/CSS, SPA |
| DB + Auth | Supabase (Postgres + Auth + Storage + Edge Functions) |
| Hosting | Vercel (autodeploy desde `main`) |
| Live scores | Apify actor propio (Playwright + proxy residencial) |
| Notificaciones | Twilio WhatsApp sandbox |

---

## 📊 Estado del sistema live — tabla resumen

| Componente | Versión | Estado | Notas |
|---|---|---|---|
| **Actor sofascore-live-proxy** | build 1.0.19 | ✅ FUNCIONA | Playwright + RESIDENTIAL + page.evaluate. ~44s. Devuelve event+incidents en tiempo real |
| **porra-match-live EF** | v9 | ⚠️ PARCIAL | Lógica correcta pero pg_net hace timeout (44s > límite) |
| **porra-whatsapp-send EF** | v1 | ✅ FUNCIONA | Twilio sandbox, form-urlencoded |
| **porra-whatsapp-webhook EF** | v4 | ✅ FUNCIONA | Captura WaId del suscriptor |
| **pg_cron poll_atletico_barcelona** | jobid 6 | ✅ COMPLETADO | Partido terminado, ya no activo |
| **pg_cron prematch_atletico_barcelona** | jobid 5 | ✅ COMPLETADO | Partido terminado, ya no activo |
| **WhatsApp notificaciones** | — | ⚠️ CON RETRASO | Llegan pero con ~15min de retraso (caché CDN actor Azzouzana) |
| **Actor VzKtdb1t0Qnc07X8V (Azzouzana)** | — | ❌ NO USAR LIVE | Scrappea HTML web con caché CDN ~15min. Solo válido para datos históricos |
| **Proxy residencial Apify** | RESIDENTIAL | ✅ FUNCIONA | En actor propio. En EF Deno da "unsuccessful tunnel" |
| **porra-sofascore-proxy EF** | v8 | ❌ OBSOLETA | Sustituida por actor propio. Siempre 403 desde Deno |

---

## 🔄 Flujo de llamadas actual

```
pg_cron (cada minuto)
  → net.http_post → porra-match-live EF
      → Apify API (lanzar actor BYLtYcOxYkruVipwr)
          → Playwright browser + proxy RESIDENTIAL
              → sofascore.com (cargar página, establecer contexto)
              → page.evaluate(fetch) → api.sofascore.com/event/{id}
              → page.evaluate(fetch) → api.sofascore.com/event/{id}/incidents
          → Apify dataset (event + incidents JSON)
      → EF parsea datos → detecta cambios → porra-whatsapp-send
          → Twilio API → WhatsApp usuario
      → upsert live_scores (status, score, events)
```

**Problema actual:** pg_net timeout antes de que el actor complete (~44s vs límite pg_net ~30s)

---

## 🗄️ Base de datos Supabase

| Tabla | Descripción |
|---|---|
| `profiles` | Usuarios (`is_admin`, `nombre`) |
| `leagues` | Ligas (`nombre`, `codigo`, `created_by`) |
| `league_members` | Membresías (`porra_cerrada`, `cerrada_at`) |
| `predictions` | Pronósticos grupos `(user_id, league_id, match_id)` |
| `ko_predictions` | Pronósticos KO `(user_id, league_id, match_id)` |
| `award_picks` | Premios individuales `(user_id, league_id)` |
| `boost_picks` | Boosts diarios `(user_id, league_id, match_id, match_date)` |
| `results` | Resultados reales + overrides manuales (JSON, id=1) |
| `orchestrator_jobs` | Historial ejecuciones agentes |
| `live_scores` | Estado partidos en vivo (status, score, events, sofascore_event_id) |
| `whatsapp_subscribers` | Teléfonos activos para notificaciones |

**Campos clave `live_scores`:**
- `match_key` — identificador único del partido (PK)
- `sofascore_event_id` — ID numérico del evento en SofaScore API
- `sofascore_url` — URL completa del partido en sofascore.com
- `status` — notstarted/inprogress/halftime/overtime/penalties/finished
- `score_home`, `score_away` — marcador actual
- `events` — array JSON de incidents (goles, tarjetas, sustituciones)
- `poll_active` — si el cron debe seguir llamando
- `had_overtime`, `had_penalties` — para contextualizar mensaje de fin

---

## ⚙️ Edge Functions Supabase

| EF | Versión | Estado | Descripción |
|---|---|---|---|
| `admin-actions` | v7 | ✅ | Gestión admin. Requiere JWT admin |
| `update-results` | v2 | ⏳ | Sync football-data.org → `results`. Activar pg_cron el 11 jun 2026 |
| `porra-orchestrator` | v3 | ✅ | N agentes Haiku en paralelo → `orchestrator_jobs` |
| `porra-patch-deploy` | v4 | ✅ | Patches search/replace + commit GitHub |
| `porra-fix-encoding` | v4 | ✅ | Write/inspect ficheros en GitHub via API |
| `porra-match-live` | v9 | ⚠️ | Live scores + WhatsApp. Usa actor BYLtYcOxYkruVipwr. Problema pg_net timeout |
| `porra-whatsapp-send` | v1 | ✅ | Envía mensajes WhatsApp via Twilio |
| `porra-whatsapp-webhook` | v4 | ✅ | Webhook entrada WhatsApp, captura WaId |
| `porra-sofascore-proxy` | v8 | ❌ | Obsoleta, sustituida por actor propio |
| `porra-github-pusher` | v6 | ❌ | PLACEHOLDER — ignorar |

---

## 🤖 Actor Apify propio — sofascore-live-proxy

| Campo | Valor |
|---|---|
| **Actor ID** | `BYLtYcOxYkruVipwr` |
| **Build** | 1.0.19 |
| **Imagen Docker** | `apify/actor-node-playwright-chrome:20` |
| **Repo** | `apify-actors/sofascore-live-proxy/` en GitHub |
| **Input** | `{ "eventId": "15832749" }` |
| **Output** | `{ eventId, event: {data:{event}}, incidents: {data:{incidents:[]}} }` |
| **Latencia** | ~30-44s por run |
| **Coste** | ~$0.03 por run |
| **Técnica** | Playwright lanza Chrome + proxy RESIDENTIAL → carga sofascore.com → page.evaluate(fetch) llama a api.sofascore.com desde contexto browser → bypasea Cloudflare |

**Por qué funciona:** el fetch se ejecuta desde dentro del browser con el mismo origen que sofascore.com. Cloudflare lo trata como petición legítima del navegador.

**Por qué el proxy residencial es clave:** las IPs residenciales no están en las listas negras de Cloudflare Bot Management.

---

## 📱 Sistema WhatsApp

| Campo | Valor |
|---|---|
| **Twilio sandbox** | +14155238886 |
| **Código de acceso** | join load-herd |
| **Suscriptores activos** | +34618874646 |
| **Secrets en Vault** | TWILIO_ACCOUNT_SID, TWILIO_API_KEY, TWILIO_API_SECRET |

**Notificaciones configuradas:**
- 🟢 Arranca el partido
- ⏸ Descanso (con marcador)
- 🟢 Segunda parte
- ⚽ Gol (jugador, minuto, marcador)
- ⚡ Prórroga
- 🤽 Penaltis
- 🏁 Fin del partido

---

## 🏆 Motor de puntuación

**Por partido:**
| Acierto | Puntos |
|---|---|
| Signo correcto (1/X/2) | +1 |
| Resultado exacto | +3 (no acumula con signo) |
| Goleador correcto | +2 |
| Pronóstico opuesto a IA y aciertas | +1 bonus |
| **Máximo por partido** | **7 pts** |
| **Con boost x2 si exacto** | **14 pts** |

**KO:** grupos+5 / r32+5 / r16+10 / qf+15 / sf+20 / campeón+25
**Clasificación final:** Campeón+30 / Subcampeón+20 / 3º+15 / 4º+10
**Premios individuales:** Balón/Bota/Guante Oro 15pts, Mejor Joven ≤21 20pts

---

## 🌍 Estructura del torneo
- 48 equipos, 12 grupos (A-L) de 4, 72 partidos grupos, 17 jornadas
- 2 primeros + 8 mejores terceros = 32 equipos
- R32 → R16 → QF → SF → 3er puesto → Final — **104 partidos total**

---

## 🔧 Herramientas disponibles en Claude.ai

**Supabase MCP** (`cmyfyswystjgzdwbqyyb`):
- `execute_sql` — ejecutar SQL
- `get_logs` — logs de Edge Functions
- `deploy_edge_function` — desplegar EFs
- `get_edge_function` — leer código de EFs

**Claude in Chrome:**
- QA visual en localhost:5173 y producción
- Login producción: `_porraDb.auth.signInWithPassword({email:'cicloste88@gmail.com', password:'910500'})`

---

## 🚦 Flujo de trabajo (reglas de oro)
1. San describe bug/mejora
2. Claude analiza y genera fix
3. Fix se prueba en **LOCAL** (`npm run dev` → localhost:5173)
4. Claude in Chrome hace QA visual autónomo
5. Solo cuando validado: `commit + push` a `main` → Vercel autodeploy
6. Claude verifica en producción

**NUNCA push sin validación local previa.**
**NO tocar vercel.json.**

---

## ⏳ Pendientes antes del 11 junio 2026

| # | Tarea | Estado |
|---|---|---|
| 0 | **Fix pg_net timeout en porra-match-live** (arquitectura async+webhook) | 🔴 URGENTE |
| 1 | Crear crons Bayern-Real Madrid y futuros partidos | 🔴 |
| 2 | Activar `pg_cron` para `update-results` el 11 jun | ⏳ |
| 3 | Actualizar `EQUIPOS[].players` con convocatorias reales | ⏳ jun |
| 4 | Desactivar signup público cuando entren todos los amigos | ⏳ |
| 5 | Email confirmación al cerrar porra (Resend + EF) | ⏳ |
| 6 | Verificar estructura JSON `_results.ko_results` con update-results real | ⏳ 11 jun |
| 7 | README — actualizar con URL Vercel | ⏳ |

---

## 📅 Historial de sesiones

| Fecha | Hitos | Commit |
|---|---|---|
| 2026-04-11 | Migración Vite completa, merge a main, fix vercel.json MIME | — |
| 2026-04-12 AM | Extracción main.js en 5 módulos, fixes race condition | ee2e25a |
| 2026-04-12 PM | Bracket Fase 1 SVG overlay. Fix dado/undo Object.assign | 187a764 |
| 2026-04-13 AM | Bracket de resultados reales — bracket-results.js + CSS | cd4afa2 |
| 2026-04-13 PM | Splash screen — inline script, hero/scroll-cue | 3473c76 |
| 2026-04-13 tarde | Boost x2 completo — Canvas fuego, Supabase, ticker | 6c3d30b |
| 2026-04-13 noche | Vista Jornada — pestaña, tarjetas compactas, sidebar | ef39b3d |
| 2026-04-14 | Vista Jornada fixes (sidebar, chips, móvil). WhatsApp live scores sistema completo | 8e8ac44 |
| 2026-04-15 | Actor propio BYLtYcOxYkruVipwr build 1.0.19 — datos SofaScore en tiempo real. porra-match-live v9. Pendiente: fix pg_net timeout | — |

---

## 🐛 Patrones críticos

**DOMContentLoaded en scripts dinámicos:**
```js
if (document.readyState === 'loading') { addEventListener('DOMContentLoaded', fn) } else { fn() }
```

**SofaScore API — por qué 403 desde servidor:**
Cloudflare Bot Management detecta peticiones no-browser. Solución: Playwright con proxy RESIDENTIAL + page.evaluate(fetch) desde contexto del browser.

**pg_net timeout:** llamadas que tardan >30s deben usar patrón async (lanzar + no esperar) y recoger resultado en siguiente ciclo.

**boost_picks upsert:** `onConflict:'user_id,league_id,match_date'` — no DELETE.

**vercel.json:** NO crear ni modificar. Vercel gestiona MIME types correctamente por defecto.
