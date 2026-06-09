# Sesión 2026-06-09 — Saneamiento Supabase Porra Mundial 2026

> **Documento de migration log** de la sesión técnica del 8–9 junio 2026.
> Incluye diagnóstico del incidente IO/Auth, optimizaciones de RLS aplicadas,
> hardening de seguridad y crones operativos del Mundial.

---

## Metadata

| Campo | Valor |
|---|---|
| **Proyecto Supabase** | `cmyfyswystjgzdwbqyyb` (eu-west-2, Postgres 17.6) |
| **App deploy** | Vercel — `porramundial2026-seven.vercel.app` |
| **Sesión inicio** | 2026-06-08 ~22:00 UTC (healthcheck) |
| **Incidente** | 2026-06-08 21:50–22:41 UTC |
| **Sesión cierre** | 2026-06-09 ~01:00 UTC |
| **Migraciones aplicadas** | 8 (M1–M8) + healthcheck previo + reactivación crones |
| **Errores resueltos** | 1 ERROR + 8 WARN del Advisor |
| **Errores documentados** | 3 ERROR (intencionales) + 4 WARN (pendientes audit) |

---

## 1. Resumen ejecutivo

El **8-jun-2026 a las 21:50 UTC** la base de datos sufrió un incidente de saturación. El Dashboard de Supabase reportó "Project is using its Disk IO budget and may become unresponsive if fully consumed". Síntomas: queries con timeout, Auth devolviendo `dial tcp [::1]:5432: i/o timeout`, pg_cron con `job startup timeout` (hasta 10 minutos en un solo job), `realtime.list_changes` tardando 11.5s. San hizo un restart de BD a las 22:41 UTC tras upgrade del plan.

El análisis post-incidente identificó que **no había una única query lenta culpable**. La causa raíz fue una combinación de carga + ineficiencias estructurales que se amplificaron mutuamente:

1. **Realtime polling constante** sobre `live_scores` (75.8% del tiempo total de Postgres incluso con BD tranquila)
2. **RLS subóptima** en `live_scores` y `whatsapp_subscribers` (re-evaluación de `auth.<fn>()` por cada row)
3. **Múltiples policies permisivas** en `live_scores` (cada SELECT evaluaba 2 policies redundantes)
4. **Bursts de UPSERTs masivos** en `predictions` (fan-out a 5–6 ligas → 245 rows/save)
5. **Índices duplicados** y configuraciones de seguridad excesivas (grants ALL en views agregadoras)

Tras la sesión de remediación, el Performance Advisor pasó de **5 WARN + 4 INFO de schema** a **0 WARN + 13 INFO** (los 13 INFO son de índices "no usados" cuyo stats se reseteó con el restart; requieren 24–48h de tráfico real para evaluar). El Security Advisor pasó de **4 ERROR + 12 WARN + 4 INFO** a **3 ERROR (intencionales) + 4 WARN (pendientes) + 5 INFO**.

---

## 2. Cronología del incidente (8-jun-2026)

```
21:00–21:45 UTC  → Todo en operación normal. Crones cada 3-5 min en <2s.
21:50:00 UTC     → Primer síntoma: sweep-unbridged-finished falla a los 11s
                   "job startup timeout"
21:51:00 UTC     → dispatch-live-slots falla a los 10s
22:06:00 UTC     → dispatch-live-slots falla a los 25s
22:09:00 UTC     → dispatch-live-slots FALLA con duración 628s (10 minutos)
22:13:57 UTC     → sweep-unbridged-finished FALLA 343s
22:21:00 UTC     → dispatch-live-slots FALLA 426s
22:41:16 UTC     → San hace restart manual de Postgres
22:52:00 UTC     → Conexiones estables, queries respondiendo
```

**Lectura del patrón**: el mensaje `job startup timeout` indica que pg_cron **no pudo obtener una conexión del pool** en el tiempo permitido. No es que el cron sea lento — es que el pool estaba saturado por queries lentas concurrentes que no terminaban.

---

## 3. Diagnóstico final

### 3.1 La pieza que cuesta el 75.8% del tiempo de Postgres

`pg_stat_statements` (incluso post-restart, con BD tranquila) muestra que una sola query consume el 75.8% del tiempo total:

```
realtime.list_changes (parser del WAL)
 calls: 9612 en 1h19m (≈2 calls/segundo, constante)
 total_time: 51.69s acumulados
 % del tiempo total: 75.8%
```

Esta función es invocada por el broker de Realtime polleando el WAL para detectar cambios en tablas suscritas.

### 3.2 Por qué Realtime era tan caro: el efecto multiplicador

El Performance Advisor identificó 3 problemas estructurales en `live_scores` (la única tabla en la publication `supabase_realtime`):

1. **`auth_rls_initplan`**: la policy `live_scores_service_write` re-evaluaba `auth.role()` en cada row procesado
2. **`multiple_permissive_policies`**: existían 2 policies PERMISIVAS para SELECT (`live_scores_read_public` + `live_scores_service_write`), evaluadas ambas en cada lectura
3. **`duplicate_index`**: `live_scores_match_key_uidx` era idéntico a `live_scores_pkey` (sobrecoste en cada write)

**Cálculo del impacto**: cada poll de Realtime sobre `live_scores` aplicaba RLS evaluando 2 policies + función volátil por row + mantenimiento doble de índice unique. Multiplicado por 2 polls/segundo durante 24h × tabla con writes frecuentes = consumo masivo de CPU/IO.

### 3.3 La gota que rompió el budget

El incidente del 21:50 UTC fue una tormenta perfecta:

```
Realtime polling constante (overhead estructural por RLS subóptima)
  +
Bursts de UPSERTs (245 rows/save por fan-out a 5-6 ligas en predictions)
  +
Crones cada 3 min generando WAL (cron.job_run_details + writes en live_scores)
  +
Queries del propio MCP de Claude en net._http_response sin WHERE created
  +
Auth con pool fijo de 10 conexiones (no escala con el resto)
  =
Disk IO budget agotado → cascada de timeouts → conexiones bloqueadas → pg_cron sin pool
```

**Lo que descartamos como causa única**:

- ❌ Las queries de las EFs (`get-squad?mode=awards` tardaba 51s, `get-league-standings` 14s) — eran síntomas, no causa. Con BD restablecida tardan 294ms y 350-450ms respectivamente.
- ❌ `net._http_response` sin índice en `id` — sigue siendo una optimización válida (las queries del MCP la usaban), pero esa tabla es UNLOGGED (no escribe WAL), así que su contribución al IO budget es menor de lo que asumí inicialmente.

---

## 4. Migraciones aplicadas

### 4.1 Healthcheck inicial (pre-incidente, 8-jun 22:00 UTC)

Aplicadas vía sesión anterior antes del incidente:

| # | Cambio | Efecto |
|---|---|---|
| H1 | Índice composite `predictions(league_id, match_id)` | Reduce Seq Scans en queries del scoreboard |
| H2 | `VACUUM ANALYZE predictions` | 281 dead tuples → 0, stats refrescadas |
| H3 | `ALTER TABLE award_picks ADD COLUMN champion text` | Fix de schema bug (24 rows existentes) |
| H4 | `ALTER TABLE ko_predictions ADD COLUMN winner_team text` | Fix de schema bug (786 rows existentes) |
| H5 | Advisory locks en `dispatch_live_slots()` y `sweep_unbridged_finished()` | Anti-solapamiento en concurrencia |
| H6 | Cron `purge_http_response` (jobid 27) creado | Retention 1h en `net._http_response` |
| H7 | Cron 26 (`cerrar-porras-mundial-2026`) creado | One-shot 10-jun 21:59 UTC: cierre porras + emails |

### 4.2 Migraciones de RLS/Índices (9-jun ~00:00 UTC)

#### M1 — `live_scores_drop_useless_service_policy_and_dup_index`

```sql
DROP POLICY IF EXISTS live_scores_service_write ON public.live_scores;
DROP INDEX IF EXISTS public.live_scores_match_key_uidx;
```

**Rationale**:

- `live_scores_service_write` era PERMISSIVE ALL con `USING auth.role() = 'service_role'`. **Inútil** porque (a) `service_role` tiene `rolbypassrls=true` → ignora RLS, (b) para anon/authenticated la condición siempre es false → nunca otorga acceso. Pero sumaba overhead: se evaluaba en cada SELECT junto a la otra policy y re-evaluaba `auth.role()` por cada row.
- `live_scores_match_key_uidx` era idéntico a `live_scores_pkey` (UNIQUE btree sobre `match_key`). Mantenemos el pkey por estar respaldado por el constraint PRIMARY KEY.

**Verificación post-cambio**: 1 policy restante (`live_scores_read_public`), 1 índice (`live_scores_pkey`), PK preservado.

#### M2 — `whatsapp_subscribers_drop_useless_service_policy`

```sql
DROP POLICY IF EXISTS ws_service_all ON public.whatsapp_subscribers;
```

**Rationale**: misma situación que M1 — policy inútil con `auth.role()='service_role'` que solo sumaba overhead. Tras el drop, la tabla queda con RLS habilitado y sin policies (default deny). service_role sigue accediendo (bypassRLS), anon/authenticated no.

#### M3 — `squads_separate_admin_write_from_select`

```sql
DROP POLICY IF EXISTS squads_all_admin ON public.squads;
CREATE POLICY squads_admin_insert ON public.squads
  FOR INSERT TO authenticated
  WITH CHECK ((SELECT auth.uid()) IN (SELECT id FROM public.profiles WHERE is_admin = true));
CREATE POLICY squads_admin_update ON public.squads
  FOR UPDATE TO authenticated
  USING ((SELECT auth.uid()) IN (SELECT id FROM public.profiles WHERE is_admin = true))
  WITH CHECK ((SELECT auth.uid()) IN (SELECT id FROM public.profiles WHERE is_admin = true));
CREATE POLICY squads_admin_delete ON public.squads
  FOR DELETE TO authenticated
  USING ((SELECT auth.uid()) IN (SELECT id FROM public.profiles WHERE is_admin = true));
```

**Rationale**: `squads_all_admin` aplicaba a `ALL` (incluye SELECT), conflictando con `squads_select_authenticated` (que ya da SELECT abierto). Cada SELECT evaluaba ambas policies. Separamos el admin check en 3 policies específicas para INSERT/UPDATE/DELETE, dejando SELECT regulado solo por la policy de lectura abierta.

**Sin pérdida de seguridad**: admin sigue siendo el único que puede modificar squads.

#### M4 — `drop_unused_backup_tables`

```sql
DROP TABLE IF EXISTS public.equipos_players_bak_20260605;
DROP TABLE IF EXISTS public.squads_backup_19may_premigration;
```

**Rationale**: backups vacíos (0 rows), pequeños (24-64 kB), sin FKs apuntando a ellos, no en publication ni en realtime.subscription. Drop seguro. Cierra lints de `no_primary_key`.

#### M5 — `enable_rls_on_h2h_scrape_map`

```sql
ALTER TABLE public._h2h_scrape_map ENABLE ROW LEVEL SECURITY;
```

**Rationale**: tabla interna del scraper (prefijo `_` convencional) estaba expuesta a PostgREST sin RLS. Habilitamos RLS sin policies → default deny. service_role sigue accediendo (bypassRLS); anon/authenticated bloqueados.

#### M6 — `tighten_grants_on_aggregator_views`

```sql
REVOKE ALL ON public.v_user_global_rank FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.v_boost_control FROM anon, authenticated, PUBLIC;
REVOKE ALL ON public.v_league_member_count FROM anon, authenticated, PUBLIC;
GRANT SELECT ON public.v_user_global_rank TO authenticated;
GRANT SELECT ON public.v_boost_control TO authenticated;
GRANT SELECT ON public.v_league_member_count TO authenticated;
```

**Rationale**: las 3 views tenían `INSERT/UPDATE/DELETE/TRUNCATE/REFERENCES/TRIGGER/SELECT` granted a `anon`, `authenticated` y `service_role`. Era exceso flagrante (UPDATE/DELETE/TRUNCATE sobre una view agregadora no tiene sentido).

**Decisión consciente**: las views se mantienen **`SECURITY DEFINER`** porque requieren ver agregados globales (ranking de usuarios, count de miembros, control admin de boosts) que un invoker no vería con su RLS. El lint ERROR `security_definer_view` persiste como excepción documentada; el riesgo real (acceso anon + grants UPDATE/DELETE) queda mitigado por estos REVOKE.

**Resolución completa (post-Mundial)**: refactorizar las views a un schema privado y exponerlas via funciones SECURITY DEFINER que validen permisos explícitamente.

#### M7 — `revoke_execute_on_internal_security_definer_functions`

```sql
REVOKE EXECUTE ON FUNCTION public.dispatch_live_slots()       FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.sweep_unbridged_finished()  FROM anon, authenticated, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.trg_bridge_on_finished()    FROM anon, authenticated, service_role, PUBLIC;
REVOKE EXECUTE ON FUNCTION public.is_porra_abierta(uuid, uuid) FROM anon, PUBLIC;
```

**Rationale**:

- `dispatch_live_slots()` y `sweep_unbridged_finished()`: solo cron las usa. pg_cron las ejecuta como `postgres` → no necesitan grant a anon/authenticated. Revocar elimina riesgo de DoS (cualquier user authenticated podía dispararlas a voluntad via `/rest/v1/rpc/`).
- `trg_bridge_on_finished()`: es función trigger (`RETURNS trigger`), NUNCA debería invocarse vía RPC. Revocamos de TODOS (incluido service_role) por corrección semántica.
- `is_porra_abierta(uuid, uuid)`: usada por RLS policies internas de `predictions`/`ko_predictions`/`award_picks`. **Mantenemos grant a `authenticated`** por si el frontend la usa vía RPC para validar "¿puedo editar?" antes de hacer el upsert. Solo revocamos a `anon`.

#### M8 — `set_search_path_get_user_top_scorers`

```sql
ALTER FUNCTION public.get_user_top_scorers(uuid, uuid, integer)
  SET search_path = 'public', 'pg_temp';
```

**Rationale**: función SECURITY INVOKER (no DEFINER) sin `SET search_path`. Riesgo bajo pero práctica recomendada por Supabase. Cierra el lint `function_search_path_mutable`.

### 4.3 Reactivación de crones (9-jun ~01:00 UTC)

| Acción | Detalle |
|---|---|
| Cron 27 `purge_http_response` reactivado y reconfigurado | Schedule cambiado de `*/10 * * * *` a `*/30 * * * *`. Activo |

```sql
SELECT cron.alter_job(job_id := 27, schedule := '*/30 * * * *', active := true);
```

**Resto de crones quedan PAUSADOS** a fecha de cierre de sesión, pendiente decisión operativa pre-Mundial.

---

## 5. Estado actual de los advisors

### 5.1 Security Advisor

| Severidad | Antes | Después |
|---|---|---|
| ERROR | 4 | 3 (1 resuelto, 3 documentados) |
| WARN | 12 | 4 (8 resueltos) |
| INFO | 4 | 5 (+1 esperado por M5) |

**ERRORS pendientes (3)** — todos `security_definer_view` en `v_user_global_rank`, `v_boost_control`, `v_league_member_count`. **Decisión consciente**: mantener DEFINER por necesidad funcional (agregados globales requieren ver más allá del RLS del invoker). Mitigación real aplicada via M6.

**WARNS pendientes (4)**:

1. `is_porra_abierta` ejecutable por `authenticated` — intencional (probable uso desde frontend)
2. Extension `unaccent` en schema `public` — **pendiente audit del repo**. Mover puede romper queries que llamen `unaccent(text)` sin schema qualifier
3. Bucket `player-photos` permite listing público — bajo riesgo si los nombres son UUID-like, **revisar policy en Dashboard**
4. `auth_leaked_password_protection` disabled — **Dashboard → Auth → Settings** (manual)

**INFOS (5)**: todas `rls_enabled_no_policy` en tablas internas (`_h2h_scrape_map`, `ia_h2h`, `ia_last5_results`, `sent_receipts`, `whatsapp_subscribers`). Default deny intencional para tablas accedidas solo via service_role.

### 5.2 Performance Advisor

| Severidad | Antes | Después |
|---|---|---|
| WARN | 5 | 0 |
| INFO | 17 | 13 |

**Resueltos (WARN)**:

- `auth_rls_initplan` en `live_scores` y `whatsapp_subscribers`
- `multiple_permissive_policies` en `live_scores` (5 roles afectados) y `squads`
- `duplicate_index` en `live_scores`

**Pendientes (INFO)**:

- 13 `unused_index` — **NO tocar**. Stats se reiniciaron con el restart (8-jun 22:41 UTC); requieren 24–48h de tráfico real para evaluar. Algunos como `idx_league_members_user`/`_league` casi seguro se usan en producción (verificado vía EXPLAIN: `idx_boost_picks_league_id` SÍ se usa por `get-league-standings`, contradiciendo el lint).
- 1 `auth_db_connections_absolute` — Dashboard manual (cambiar Auth a estrategia por porcentaje)

---

## 6. Inventario de crones (estado al cierre de sesión)

| jobid | jobname | schedule | active | propósito |
|---|---|---|---|---|
| 20 | ia-snapshots-cleanup | `0 3 * * *` | ❌ pausado | Retention 7d en `ia_predictions` + `ia_snapshots` inactivos |
| 21 | ia-freeze-snapshot-mundial | `0 0 11 6 *` | ❌ pausado | One-shot **11-jun 00:00 UTC** — freeze pre-Mundial via `porra-ia-compute` |
| 22 | ia-compute-groups-mundial | `10 0 11 6 *` | ❌ pausado | One-shot **11-jun 00:10 UTC** — compute_groups via `porra-ia-compute` |
| 24 | dispatch-live-slots | `*/3 * * * *` | ❌ pausado | Llama EF `porra-match-live` durante partidos. Tiene advisory lock |
| 25 | sweep-unbridged-finished | `*/5 * * * *` | ❌ pausado | Llama EF `porra-bridge-results` para finished sin bridge. Tiene advisory lock |
| 26 | cerrar-porras-mundial-2026 | `59 21 10 6 *` | ❌ pausado | One-shot **10-jun 21:59 UTC** — UPDATE league_members + emails via `send-porra-receipt` |
| **27** | **purge_http_response** | `*/30 * * * *` | **✅ activo** | **Retention 1h en `net._http_response`** |

---

## 7. Pendientes operativos (Mundial 2026)

### 🔴 Antes del 10-jun 21:59 UTC (en ~21h)

Decidir cómo manejar el cierre de porras:

- **Opción A**: reactivar cron 26 ahora → se dispara solo + manda emails via `send-porra-receipt`
- **Opción B**: mantener pausado, ejecutar UPDATE manual mañana
- **Opción C** (recomendada): reactivar cron 26 + ya tenemos cron 27 activo

```sql
-- Si vamos con A o C:
SELECT cron.alter_job(job_id := 26, active := true);
```

### 🟡 Antes del 11-jun 00:00 UTC (en ~23h)

Decidir si IA Zayu tendrá predicciones pre-Mundial:

- Reactivar crones 21 y 22 si queremos snapshot + group predictions

```sql
SELECT cron.alter_job(job_id := 21, active := true);
SELECT cron.alter_job(job_id := 22, active := true);
```

### 🟢 Antes del 11-jun 18:00 UTC (primer partido, en ~41h)

Reactivar crones operativos del Mundial:

- Crones 24 (`dispatch-live-slots`) y 25 (`sweep-unbridged-finished`) — ya tienen advisory locks
- Considerar también cron 20 (`ia-snapshots-cleanup`)

```sql
SELECT cron.alter_job(job_id := 20, active := true);
SELECT cron.alter_job(job_id := 24, active := true);
SELECT cron.alter_job(job_id := 25, active := true);
```

### Recomendación: cuándo reactivar

Idealmente, reactivar **24/25 el 11-jun por la mañana** (e.g. 16:00 UTC, 2h antes del primer partido) para ahorrar ~36h de polling vacío.

---

## 8. Pendientes técnicos (post-Mundial)

### Críticos a medio plazo

1. **Refactor del fan-out de UPSERTs en `predictions`**
   - Patrón actual: 1 save de usuario → hasta 245 rows escritos (49 matches × 5 ligas)
   - Propuestas: replicar via trigger en BD, o desnormalizar a `(user_id, match_id)` y resolver `league_id` en read time
2. **Evaluar destino de Realtime**
   - Actualmente subscribe a `live_scores` (1 subscription activa)
   - Si el uso de "marcadores en tiempo real" es opcional, desactivar Realtime libera ~75% del tiempo de Postgres
   - Alternativa: activar/desactivar dinámicamente la tabla de la publication antes/después de cada partido
3. **Cambiar Auth connection strategy a percentage-based** (Dashboard)
   - Actualmente: 10 conexiones absolutas (no escala con el plan)
   - Recomendado: 15-20% del `max_connections` total
4. **Refactor de las 3 views agregadoras** (`v_user_global_rank`, `v_boost_control`, `v_league_member_count`)
   - Mover a schema privado (no expuesto via PostgREST)
   - Crear funciones SECURITY DEFINER en `public` que validen permisos y wrappeen las views

### Limpieza recomendada (no urgente)

5. **Mover extension `unaccent` fuera de `public`**
   - Audit del repo: buscar usos de `unaccent(...)` sin schema qualifier
   - Aplicar: `CREATE EXTENSION unaccent SCHEMA extensions;` (o `pg_catalog`)
   - Actualizar queries afectadas con qualifier
6. **Restringir bucket `player-photos`**
   - Revisar policy `player_photos_public_read` en `storage.objects`
   - Si los nombres de file no son enumerables (UUIDs), riesgo bajo; aun así buena práctica restringir listing
7. **Activar Leaked Password Protection** (Dashboard)
   - Auth → Settings → "Enable leaked password protection"
8. **Revisar 13 índices "unused"** tras 48h de tráfico real
   - Script de validación: ejecutar `pg_stat_user_indexes` con `idx_scan = 0` y `LAST_VACUUM` > 48h después del 11-jun
   - Validar con EXPLAIN para queries críticas antes de dropear cualquiera

---

## 9. Monitoring queries (para detección temprana)

Ejecutar periódicamente durante el Mundial:

### A) Top consumidores de tiempo en Postgres

```sql
SELECT substring(query, 1, 100) AS query, calls,
       round(total_exec_time::numeric / 1000, 1) AS total_sec,
       round((total_exec_time / sum(total_exec_time) OVER ())::numeric * 100, 1) AS pct
FROM pg_stat_statements
ORDER BY total_exec_time DESC LIMIT 10;
```

### B) Replication lag de Realtime (alarma si > 50 MB)

```sql
SELECT slot_name, active,
       pg_size_pretty(pg_wal_lsn_diff(pg_current_wal_lsn(), restart_lsn)) AS lag
FROM pg_replication_slots;
```

### C) Conexiones activas vs límite (alarma si > 40 / 60)

```sql
SELECT state, count(*) FROM pg_stat_activity
WHERE pid != pg_backend_pid()
GROUP BY state;
```

### D) Crones que tardan más de 2s (signo de degradación)

```sql
SELECT j.jobname, jrd.start_time,
       EXTRACT(EPOCH FROM (jrd.end_time - jrd.start_time)) AS sec,
       jrd.status
FROM cron.job_run_details jrd
JOIN cron.job j ON j.jobid = jrd.jobid
WHERE jrd.start_time > now() - interval '1 hour'
  AND EXTRACT(EPOCH FROM (jrd.end_time - jrd.start_time)) > 2
ORDER BY jrd.start_time DESC;
```

### E) Patrón pg_net — lectura correcta de respuestas

⚠️ **SIEMPRE filtrar con `WHERE created`** al leer `net._http_response`:

```sql
-- CORRECTO (usa el índice de created)
SELECT ... FROM net._http_response
 WHERE created > now() - interval '5 minutes' AND id = N;
-- INCORRECTO (Seq Scan completo, puede quemar Disk IO budget)
SELECT ... FROM net._http_response WHERE id = N;
```

`net._http_response` no tiene índice en `id`, solo en `created`. El owner es `supabase_admin` y no se puede añadir índice desde el rol postgres.

---

## 10. Apuntes técnicos relevantes

### service_role bypassa RLS

Confirmado: `service_role` tiene `rolbypassrls = true`. Las EFs que usan `SUPABASE_SERVICE_ROLE_KEY` para `createClient` ignoran completamente las RLS policies. Esto implica:

- Las policies del tipo `USING (auth.role() = 'service_role')` son **inútiles** (nunca otorgan acceso a anon/authenticated, y service_role no las necesita)
- Tablas con RLS habilitado y sin policies = default deny = solo service_role puede acceder. Es un patrón válido para tablas internas

### Tablas `pg_net` son UNLOGGED

`net._http_response` y `net.http_request_queue` son **UNLOGGED**:

- Se vacían automáticamente en cada restart de Postgres
- No escriben al WAL
- Si Postgres crashea, datos se pierden

Su contribución al consumo de IO es menor que la asumida inicialmente, pero las queries `WHERE id = N` sin filtro `WHERE created` siguen siendo problemáticas (Seq Scan + parseo JSONB).

### EFs sanas post-restart (referencia de baseline)

Tiempos típicos en BD restablecida:

| EF | Acción | Tiempo típico |
|---|---|---|
| `get-squad?mode=awards` | Lista jugadores para 4 premios | 294 ms |
| `get-league-standings` | Cálculo scoreboard por liga | 350-450 ms |
| `porra-ia-compute` | `compute_match` con Anthropic quip | 1.5-2 s |
| `porra-ia-compute` | `compute_match` cached hit | <200 ms |
| `porra-ia-compute` | `freeze_snapshot` (3 scrapes serial) | ~60 s |

Cualquier deviación significativa de estos baselines durante el Mundial es signo de degradación.

---

## 11. Convenciones aplicadas en esta sesión

- **`apply_migration` (MCP) en producción** (no `execute_sql`) para que cada cambio quede en migration history
- **Verificación post-cada-migración** con query SELECT antes de pasar a la siguiente
- **Migraciones atómicas y reversibles** — cada DROP/CREATE/ALTER en bloque coherente
- **`get_advisors` ejecutado antes y después** de la sesión de RLS
- **Inspecciones previas obligatorias** antes de DROP (verificar FKs, dependencias, grants)
- **Documentación inline en SQL** explicando rationale en cada migración

---

## 12. Anexo: definiciones de las views agregadoras (para referencia)

### `v_user_global_rank`

```sql
SELECT id AS user_id,
       0 AS total_pts,
       rank() OVER (ORDER BY 0 DESC, created_at) AS rank_global,
       count(*) OVER () AS total_users
FROM profiles p
WHERE COALESCE(is_admin, false) = false;
```

**Nota**: `total_pts = 0` hardcoded sugiere WIP. Si se va a usar para ranking real, hay que reemplazar por cálculo real desde `predictions` + `ko_predictions` + `award_picks` + `results`.

### `v_boost_control`

Vista admin agregada: muestra cuántos boosts ha hecho cada user en cada liga durante los 17 días de partidos del Mundial (11-jun a 27-jun). Calcula `completo = (boosts >= 17)`.

### `v_league_member_count`

```sql
SELECT league_id,
       count(*) FILTER (WHERE NOT COALESCE((SELECT is_admin FROM profiles WHERE id = lm.user_id), false)) AS human_count,
       count(*) AS total_count
FROM league_members lm
GROUP BY league_id;
```

---

## 13. Migration history aplicada (referencia)

Orden cronológico de las migraciones via `apply_migration`:

```
1. live_scores_drop_useless_service_policy_and_dup_index
2. whatsapp_subscribers_drop_useless_service_policy
3. squads_separate_admin_write_from_select
4. drop_unused_backup_tables
5. enable_rls_on_h2h_scrape_map
6. tighten_grants_on_aggregator_views
7. revoke_execute_on_internal_security_definer_functions
8. set_search_path_get_user_top_scorers
```

Sin contar las del healthcheck previo (índice composite, VACUUM, advisory locks, schema fixes) y la reactivación de cron 27.

---

**Fin del documento**

> Autoría: sesión orquestada Claude.ai + MCP Supabase, supervisada por San (cicloste88).
> Para incidentes futuros similares, consultar §9 (monitoring queries) y §10 (apuntes técnicos).
