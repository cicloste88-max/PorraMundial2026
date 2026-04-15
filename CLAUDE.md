# Porra Mundial 2026 — Contexto para Claude Code

## Proyecto
App de pronósticos del Mundial 2026. Stack: HTML+CSS+JS vanilla, Supabase, Vite, Vercel.
**Producción: porramundial2026-seven.vercel.app**
Repo: github.com/cicloste88-max/PorraMundial2026
Rama activa: **main** | Último commit: **18ae20a**

---

## ⚠️ PENDIENTE URGENTE — Próxima sesión

1. **Migrar WhatsApp sandbox → producción** (número Business aprobado por Meta) — CRÍTICO antes del 11 jun. Error 63016: Twilio sandbox expira ventana 24h, no entrega mensajes iniciados por el negocio fuera de esa ventana.
2. **Fix parpadeo botón envío porra**
3. **Fix barra inferior boost** (ya en commit ea6c621, verificar en prod)

---

## 📊 Estado del sistema live

| Componente | Versión | Estado |
|---|---|---|
| Actor sofascore-webshare-proxy `N8vUChlhok5JU3cnL` | build 1.0.6 | ✅ EN PRODUCCIÓN |
| Actor sofascore-live-proxy FALLBACK `BYLtYcOxYkruVipwr` | build 1.0.19 | ✅ FALLBACK activo |
| `porra-apify-webhook` EF | v7 | ✅ FUNCIONA — logging completo, detecta goles, llama Twilio |
| `porra-match-live` EF | v13 | ✅ lanza actor async |
| `porra-whatsapp-send` EF | v1 | ✅ |
| `porra-whatsapp-webhook` EF | v4 | ✅ |
| WhatsApp notificaciones | — | ⚠️ ERROR 63016 — sandbox Twilio, ventana 24h expirada |

### Validación Bayern-Real Madrid 15/04 (4-3)
- Datos SofaScore: ✅ llegaron en tiempo real
- DB actualizada correctamente (score, events, status finished) ✅
- Detección goles: ✅ (Olise 90', newGoals=1 detectado)
- Twilio acepta envío: ✅ (HTTP 200)
- WhatsApp entrega: ❌ error 63016 (ventana 24h sandbox)

---

## 📁 Estructura ficheros JS

```
js/
  main-entry.js       <- entry point Vite (type=module)

public/js/
  data.js             <- datos torneo + estado global + boostPicks
  scoring.js          <- motor puntos + tarjetas + premios
  ui-groups.js        <- grupos + vista Jornada completa
  ko.js               <- bracket KO + IA pronósticos
  ui-nav.js           <- SPA nav + modal + welcome
  auth.js             <- auth Supabase
  leagues.js          <- ligas y selección de porra
  misc.js             <- utils UI
  scoreboard.js       <- clasificación multi-usuario
  close-porra.js      <- cierre de pronósticos
  admin.js            <- panel admin + dados/simulador
  bracket-results.js  <- vista resultados reales bracket KO

public/css/
  bracket-results.css
  boost.css
```

---

## ⚙️ Edge Functions Supabase

| EF | Versión | Estado |
|---|---|---|
| `admin-actions` | v7 | ✅ |
| `update-results` | v2 | ⏳ activar pg_cron 11 jun |
| `porra-orchestrator` | v3 | ✅ |
| `porra-patch-deploy` | v4 | ✅ |
| `porra-fix-encoding` | v4 | ✅ |
| `porra-match-live` | v13 | ✅ lanza actor async |
| `porra-apify-webhook` | v7 | ✅ logging completo |
| `porra-whatsapp-send` | v1 | ✅ |
| `porra-whatsapp-webhook` | v4 | ✅ |

---

## 🔄 Flujo live scores (actual, validado)

```
pg_cron (cada 3min durante partido)
  → net.http_post → porra-match-live EF
      → Apify: lanzar actor N8vUChlhok5JU3cnL async (Webshare)
         fallback: BYLtYcOxYkruVipwr (RESIDENTIAL)
      → Apify webhook → porra-apify-webhook EF v7
          → leer dataset Apify
          → detectar goles nuevos (por ID)
          → detectar cambio de status
          → sendWhatsApp → Twilio → WhatsApp
          → upsert live_scores
```

---

## 📱 WhatsApp — Twilio sandbox ⚠️

- Número: +14155238886
- Código: join load-herd
- **Error 63016:** sandbox solo permite freeform dentro de ventana 24h tras último mensaje entrante
- **SOLUCIÓN PRODUCCIÓN:** migrar a número WhatsApp Business aprobado por Meta antes del 11 jun

---

## 🏆 Motor de puntuación

- Partido: +1 signo / +3 exacto / +2 goleador / +1 bonus vs IA (máx 7pts)
- Boost x2: si exacto + partido es el boost del día → pts ×2 (máx 14pts)
- KO avance: grupos+5, r32+5, r16+10, qf+15, sf+20, campeón+25
- Clasificación final: campeón+30, subcampeón+20, 3º+15, 4º+10

---

## Comandos útiles

```bash
npm run dev     # localhost:5173
npm run build
git add -A && git commit -m "..." && git push origin main
```

---

## Reglas CRÍTICAS

- NUNCA push a main sin validar en localhost:5173 primero
- Push inmediato tras cada commit
- NO crear ni modificar vercel.json
- NO usar addEventListener DOMContentLoaded en classic scripts cargados via loadScript
- Actor Azzouzana VzKtdb1t0Qnc07X8V tiene caché CDN — NO usar para datos live

---

## ⏳ Pendientes antes del 11 junio 2026

| # | Tarea | Estado |
|---|---|---|
| 0 | **Migrar WhatsApp sandbox → producción** (Meta Business) | 🔴 CRÍTICO |
| 1 | Fix parpadeo botón envío porra | 🔴 |
| 2 | Activar pg_cron update-results el 11 jun | ⏳ |
| 3 | Actualizar EQUIPOS[].players con convocatorias reales | ⏳ |
| 4 | Desactivar signup público | ⏳ |
| 5 | Email confirmación al cerrar porra | ⏳ |
| 6 | Verificar ko_results con update-results real | ⏳ 11 jun |
| 7 | README — actualizar URL Vercel | ⏳ |
| 8 | IDs KO Mundial en SofaScore (~28 jun) | ⏳ |

---

## Log de cambios (OBLIGATORIO)

Añadir línea a migration-log.md tras cada acción:
```
[HH:MM] ACCION: descripción — ficheros afectados
```
