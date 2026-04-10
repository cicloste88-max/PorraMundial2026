# Porra Mundial 2026

App de pronósticos para el Mundial 2026. Permite a grupos de amigos crear ligas privadas, hacer predicciones de partidos (fase de grupos + eliminatorias + premios individuales), y competir en un scoreboard en tiempo real.

**Demo:** [porrafutbol2026.netlify.app](https://porrafutbol2026.netlify.app)

---

## Stack

| Capa | Tecnología |
|------|-----------|
| Frontend | HTML + CSS + JS vanilla (monolítico · sin build step) |
| Backend | Supabase (Postgres + Auth + Storage + Edge Functions) |
| Deploy | Netlify (drag & drop · pendiente CI/CD con GitHub) |
| Agentes | Claude Haiku via Anthropic API + porra-orchestrator (EF) |

---

## Estructura del proyecto

```
porra-mundial-2026/
│
├── index.html                        ← App completa (checkpoint v15c)
│
├── css/                              ← Módulos CSS extraídos
│   ├── base.css                      · Reset, variables, layout principal
│   ├── welcome.css                   · Welcome screen + auth modal
│   ├── ko.css                        · Bracket KO + modal de partido + awards
│   └── admin.css                     · Responsive + panel admin + dado
│
├── js/                               ← Módulos JS extraídos
│   ├── data/
│   │   └── main.js                   · Módulo principal (data+scoring+ui+ko+nav)
│   ├── auth.js                       · Autenticación y sesión Supabase
│   ├── leagues.js                    · Sistema de ligas (crear/unirse/seleccionar)
│   ├── scoreboard.js                 · Clasificación multi-usuario
│   ├── close-porra.js                · Cierre y finalización de pronósticos
│   ├── admin.js                      · Panel de administración
│   ├── misc.js                       · Utilidades UI (popovers, responsive)
│   └── utils.js                      · Stubs pre-Supabase (absorber en auth.js)
│
├── supabase/
│   └── functions/
│       ├── admin-actions/            · Gestión privilegiada (usuarios, ligas, overrides)
│       │   └── index.ts              · v6 — requiere JWT de admin
│       ├── update-results/           · Sincronización con football-data.org
│       │   └── index.ts              · v1 — pg_cron activa el 11 jun 2026
│       └── porra-orchestrator/       · Orquestador de agentes de refactorización
│           └── index.ts              · v3 — usa ANTHROPIC_API_KEY del vault
│
└── docs/
    ├── porra_bloque_map_v15b.json    · Mapa de 21 bloques con deps/expone/fase
    └── porra_roadmap_refactorizacion.html · Dashboard de progreso de refactorización
```

---

## Base de datos (Supabase)

**Proyecto:** `cmyfyswystjgzdwbqyyb`

| Tabla | Descripción |
|-------|-------------|
| `profiles` | Usuarios registrados (`is_admin`, `nombre`) |
| `leagues` | Ligas creadas (`nombre`, `codigo`, `created_by`) |
| `league_members` | Membresías (`porra_cerrada`, `cerrada_at`) |
| `predictions` | Pronósticos de grupos por `(user_id, league_id, match_id)` |
| `ko_predictions` | Pronósticos KO por `(user_id, league_id, match_id)` |
| `award_picks` | Premios individuales por `(user_id, league_id)` |
| `results` | Resultados del torneo + overrides manuales (JSON) |
| `orchestrator_jobs` | Historial de ejecuciones de agentes de refactorización |

RLS habilitado en todas las tablas. Sin recursión en políticas.

---

## Edge Functions

### `admin-actions` (v6)
Operaciones privilegiadas del panel admin. Requiere JWT de usuario con `is_admin = true`.

Acciones: `get_stats`, `get_users`, `get_leagues`, `get_results`, `set_override`, `reopen_prediction`, `reopen_ko_prediction`, `reset_porra_cerrada`, `force_sync`, `cron_pause`, `cron_resume`

### `update-results` (v1)
Sincroniza resultados desde [football-data.org](https://football-data.org). Activar pg_cron el 11 de junio de 2026 (inicio del torneo).

```sql
SELECT cron.schedule('update-results-job', '*/5 * * * *', $$
  SELECT net.http_post(
    url := 'https://cmyfyswystjgzdwbqyyb.supabase.co/functions/v1/update-results',
    ...
  )
$$);
```

### `porra-orchestrator` (v3)
Orquestador de agentes de refactorización. Lanza N llamadas a Claude Haiku en paralelo, guarda resultados en `orchestrator_jobs`.

Acciones: `ping`, `status`, `run_fase`, `get_job`, `run_single`

---

## Variables de entorno (Supabase Vault)

| Secret | Descripción |
|--------|-------------|
| `SUPABASE_URL` | Auto-inyectado |
| `SUPABASE_SERVICE_ROLE_KEY` | Auto-inyectado |
| `SUPABASE_ANON_KEY` | Auto-inyectado |
| `ANTHROPIC_API_KEY` | Añadir manualmente en Settings → Vault |

---

## Desarrollo local

Abre `index.html` directamente en el navegador o usa un servidor local:

```bash
# Con Python
python3 -m http.server 5500

# Con VS Code Live Server
# → http://127.0.0.1:5500
```

No requiere build step. La app funciona directamente desde el HTML.

---

## Roadmap técnico

### Completado
- [x] Sistema de ligas multijugador (`league_id` en todas las tablas)
- [x] Panel admin con selector de liga
- [x] Flujo reabrir porra → finalizar → cerrada validado end-to-end
- [x] Anotación completa de bloques (Usa/Expone/Deps) — 26 agentes
- [x] Extracción física de módulos CSS y JS
- [x] Globales implícitas convertidas a `window.X` explícitos

### Pendiente (antes del torneo — 11 jun 2026)
- [ ] Deploy Netlify con v15c
- [ ] Activar pg_cron el 11 de junio
- [ ] Seguridad auth: autoconfirm off, pwd min 8, enable_signup: false
- [ ] Email de confirmación al cerrar porra (Resend + Edge Function)

### Pendiente (post-torneo)
- [ ] Migración a Vite (estructura de módulos ya preparada)
- [ ] Reemplazar CDN Supabase por `npm install @supabase/supabase-js`
- [ ] Netlify CI/CD desde GitHub (reemplazar drag & drop)
- [ ] Pestaña admin "Ligas" con gestión completa
- [ ] Notificaciones personalizadas y email con resumen de pronósticos

---

## Arquitectura de agentes

El proyecto incluye una red de agentes Claude para automatizar tareas de refactorización y mantenimiento:

```
Supervisor (Claude en conversación)
    └── porra-orchestrator (Edge Function en Supabase)
            └── N agentes Claude Haiku en paralelo
                    └── Resultados en orchestrator_jobs (Postgres)
```

Tiempo de ejecución de las 5 fases de anotación: ~40 segundos total.
Coste total de API: < $0.01.

---

*Proyecto personal · Mundial 2026 · cicloste88*
