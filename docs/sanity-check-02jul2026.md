# Sanity check 02-jul-2026 — Auditoría de salud del proyecto

Auditoría multi-agente (7 auditores paralelos + verificación adversarial de candidatos
a borrado) sobre repo, código muerto JS/CSS, docs, dependencias/build, Supabase y GitHub.
**52 hallazgos**. Sesión: rama `claude/project-health-cleanup-s0kpjj`.

Convención de estado: ✅ aplicado en esta sesión · 🔶 decisión de San · ⚠️ atención operativa (fase KO en vivo).

---

## 1 · Aplicado en esta sesión (rama de este PR)

1. ✅ **CHANGELOG.md 34.604 → 25.759 bytes** (límite hook 30.720): 6 entradas más antiguas
   (02-jun → 10-jun, 139 líneas, 8.845 bytes) movidas 1:1 a `CHANGELOG-archive-202606.md`
   en orden cronológico. Paridad de bytes exacta, cero pérdida.
2. ✅ **CLAUDE.md 10.264 → ~10.1KB** (límite 10.240; estaba 24 bytes por encima → el
   pre-commit de San habría fallado): eliminadas 3 redundancias internas (línea duplicada
   de `errores_conocidos_porra.md` que además decía "ERR-01..91" stale, comando hooksPath
   duplicado, política retención duplicada). Ninguna regla eliminada.
3. ✅ **Borrados 4 objetos obsoletos** (verificación adversarial: 0 referencias vivas en
   todo el árbol; recuperables desde historial git):
   - `docs/Design System.zip` (105KB, binario): la propia doc (`docs/restyling-mobile.md`
     L5/L246) dice "no entra al repo — archivar en Drive privado". Contiene además font
     propietario `fifa-26.otf`. Componentes ya portados a `public/{css,js}/v3/`.
   - `deploy-and-qa.ps1`: era Netlify (`tumundial.netlify.app`), path Windows hardcodeado,
     y hacía `git push origin main` sin validación (contradice regla CRÍTICA vigente).
   - `qa-login.ps1` + `setup-credentials.ps1`: helpers Windows de credenciales QA de la era
     Netlify (`cmdkey tumundial-porra-app`); `qa-login.ps1` imprimía la password en claro.
     Si San los usa localmente fuera del repo, su copia local no se ve afectada.
4. ✅ **`BRIEF_TM_MARKET_VALUES_SCRAPER.md` (40KB, raíz) → `docs/brief-tm-market-values.md`**:
   sprint entregado (tm-parse-utils, tm-worldcup-market-values existen); movido siguiendo la
   convención de briefs en `docs/`.
5. ✅ **Drift documental corregido**:
   - `.claude/rules/frontend-css.md`: decía "siete enlaces `<link>`" — son 26 (9 raíz +
     11 `components/` + 6 `v3/`).
   - `.claude/rules/edge-functions.md`: el bloque "⚠️ Drift: trigger/sweep/dispatch/
     wc_matches_ko solo en runtime, pendiente backfill" era obsoleto — el backfill existe
     (`supabase/migrations/20260609234824_backfill_live_pipeline_runtime.sql` + versiones
     remotas 20260602\*). Actualizado, incluyendo el estado real del cron jobid 24 (§2.1).
   - `CLAUDE.md` mapa de docs: fila `sanity-check-20abr2026.md` (trigger 11-jun vencido)
     sustituida por este doc.

Verificación post-cambios: `npm run build` OK y suite `npm test` verde (ver §5).

---

## 2 · ⚠️ Atención operativa (fase KO en vivo) — revisar pronto

### 2.1 Cron `dispatch-live-slots` (jobid 24) INACTIVO vs documentación

`cron.job` muestra jobid 24 `dispatch-live-slots` (`*/3`, `SELECT public.dispatch_live_slots()`)
con `active=false`, mientras `edge-functions.md`/`docs/live-scoring.md` lo describían como
parte activa del pipeline. El polling primario real es **jobid 30 `espn-poll-mundial-2026`**
(cada minuto, gated por ventana de partido, 2.880 runs OK / 0 fallos en 48h). Probablemente
la desactivación fue deliberada al migrar a ESPN, pero no hay constancia escrita.
**Acción**: confirmar si es permanente → si sí, `SELECT cron.unschedule(24);` y actualizar
`docs/live-scoring.md`; si no, hay un gap de redundancia del pipeline live en plena fase KO.

### 2.2 Advisor security ERROR: 2 vistas SECURITY DEFINER expuestas

`v_boost_control` y `v_league_member_count` (schema public) aplican permisos del creador,
saltándose el RLS del consultante. `v_boost_control` fue deliberada (migración
`20260608141553`), pero conviene convertir ambas a `security_invoker=true` o documentar la
excepción. Remediación: linter 0010_security_definer_view de Supabase.

### 2.3 5 Edge Functions con `verify_jwt=true` (política del repo: false, ERR-16)

`get-squad` (v13), `porra-tm-photos-sync` (v9), `gh-proxy` (v8), `porra-flag-batch-upload`
(v6), `load-staging-fifa-tmp` (v5). Causa probable: deploys CLI sin `--no-verify-jwt`.
`get-squad` la consume el frontend — con JWT ES256 fallaría. Revisar función por función y
re-deployar con el flag (o toggle en dashboard). Las otras 28 EFs están OK (`false`).

### 2.4 Suite de tests enmascara 1 test rojo conocido

`npm test` verde (349/349) pero `package.json` lleva
`--test-skip-pattern="degrade a low si calendario"`: el test
`tests/parsers/cross-validate.test.mjs:57` sigue rojo si se ejecuta sin el patrón. El fix
está esperando en el **PR #151 (`ci/unskip-cross-validate`), abierto y parado 22 días**,
solo-tests, cuyo body pide merge con permiso explícito de San. Mergearlo cierra esto
(posible conflicto trivial keep-both en `migration-log.md`).

---

## 3 · 🔶 Limpieza pendiente de decisión (runbook)

### 3.1 GitHub — 10 ramas remotas SAFE-DELETE (las borra San; Code recibe 403, ERR-17)

Verificado PR merged/closed o contenido ya en main:

| Rama | Veredicto |
|---|---|
| `claude/fix-xi-pipeline-abc` | PR #109 MERGED 28-may |
| `claude/inspiring-thompson-KigjL` | PR #137 MERGED 08-jun |
| `feat/ff-cheerio-parser` | PR #105 MERGED 27-may |
| `feat/standings-slide-jcard-modal` | PR #63 MERGED 08-may |
| `feat/tm-worldcup-market-values` | PR #82 MERGED 20-may |
| `claude/confident-faraday-a0di9q` | PR #143 CLOSED sin merge 10-jun, sin actividad |
| `claude/css-reskin-directo-jornada-ZK2rl` | PR #87 CLOSED sin merge 27-may |
| `awards-dorsal` | tip `fc18ef2` ES ancestro de main (merge directo `a0cf3d2`) |
| `fix/standings-v121-regla-0-0` | portada vía PR #153 + #154 (verificado en working tree) |
| `claude/great-wozniak-800ly5` | superseded por PR #148 (get-league-highlights EF) |

```bash
git push origin --delete claude/fix-xi-pipeline-abc claude/inspiring-thompson-KigjL \
  feat/ff-cheerio-parser feat/standings-slide-jcard-modal feat/tm-worldcup-market-values \
  claude/confident-faraday-a0di9q claude/css-reskin-directo-jornada-ZK2rl awards-dorsal \
  fix/standings-v121-regla-0-0 claude/great-wozniak-800ly5
```

**KEEP** (documentales intencionadas): `docs/quiniela-design-source-v2`,
`docs/brief-tm-worldcup-market-values`.

### 3.2 GitHub — ramas con TRABAJO NUNCA ATERRIZADO en main (¡no borrar sin decidir!)

1. **`fix/winrate-label-forma`** — fix de 1 línea PERDIDO y visible en producción:
   `public/js/tarjeta-stats.js:223` sigue mostrando `% Victorias · 12m` (label engañoso);
   la rama lo cambia a `· forma`. **Quick-win: rescatar.**
2. **`fix/squads-cross-validate-gating`** — main mantiene `isFinal: true` incondicional en
   `runDetect` (`sync-squads.mjs:514`, escribe FINAL también con confidence='low') y
   `htmlToLines` sin strip de zero-width. Relevancia baja post-listas, pero divergencia real.
3. **`claude/blissful-lovelace-nqy41q`** — `docs/db/saneamiento-supabase-09jun2026.md`
   (incidente Disk IO M1-M8) no existe en main. Ojo: su "ERR-85" colisiona con el ERR-85
   actual. Rescatar la doc renumerando.
4. **`claude/review-scrapling-methodology-8c6Qw`** — `docs/scrapling-methodology.md` no está
   en main. Rescatar o descartar.
5. **`claude/fix-awards-card-mobile-5hBvd`** + **`fix/awards-picker-ios`** — posiblemente
   superseded por el redesign v3; confirmar contra la UI actual antes de borrar.

### 3.3 GitHub — issues (5 abiertos, todos parados 67 días desde el 26-abr)

- **#27** (regla multi-agent-sync): de facto COMPLETADO — la regla existe y cita el issue.
  Cerrable con `state_reason=completed`.
- **#23** (canvas `_boostFire` móvil, priority-high): revalidar si reproduce en v3.
- **#24/#25/#26** (tipografía inline, `.gbadge*` huérfanas, sticker muerto en scoring.js):
  triage → backlog post-Mundial.

### 3.4 Supabase — objetos runtime residuales

- **EFs temporales desplegadas sin código en repo**: `load-staging-fifa-tmp` (v5, ~03-jun) y
  `enrich-photo-tmp` (v5, ~04-jun). One-offs de hace un mes que siguen ACTIVE. Verificar que
  ningún cron/webhook las invoca y borrarlas del dashboard. (`porra-ef-deployer`, ~29-jun,
  parece tooling activo — revisar aparte.)
- **Crons one-shot vencidos** (inactivos, peso muerto): jobids 21 `ia-freeze-snapshot-mundial`,
  22 `ia-compute-groups-mundial`, 26 `cerrar-porras-mundial-2026` (schedules 10/11-jun ya
  pasados). Post-torneo: `SELECT cron.unschedule(21); SELECT cron.unschedule(22); SELECT cron.unschedule(26);`
  Positivo: **0 crons por-partido huérfanos** — `schedule_match_crons` limpia bien.
- **Advisors WARN/INFO**: extensión `unaccent` en schema public (mover a `extensions`);
  `is_porra_abierta` SECURITY DEFINER ejecutable por authenticated (confirmar intención);
  7 tablas RLS-sin-policy (patrón deliberado ERR-58 para tablas service_role — verificar que
  ninguna se lee desde frontend authenticated).
- **Leaked password protection (HaveIBeenPwned) sigue OFF** — pendiente conocido del audit
  28-abr, confirmado. Activable en Auth settings.
- El linter de performance de Supabase falla server-side (error de sintaxis de plataforma) —
  reintentar en unos días.
- Sin bloat de tablas relevante (`predictions` 3.903 live / 551 dead, autovacuum al día).
  `ia_last5_results` quedó 0 live / 48 dead sin autovacuum — VACUUM manual post-torneo basta.

### 3.5 Repo — deuda estructural (post-Mundial salvo urgencia)

- **`base.css` (74KB) y `ko.css` (63KB) contienen DOS bloques históricos concatenados**
  (migrado-inline 19-abr + "reglas originales" post-Vite), ~40-45% de duplicación:
  - `ko.css`: 586 líneas idénticas, **sin contradicciones** — deduplicable, pero es el CSS
    de la fase KO en vivo: NO tocar hasta poder validar en localhost con calma.
  - `base.css`: 490 líneas duplicadas **con 1 contradicción activa**: el bloque stale
    re-aplica `overflow:hidden` a `.card` (L651) deshaciendo el fix de llamas boost
    documentado en el bloque 1 (L24) y `boost.css` — vector de regresión visual real.
  - Colisión cross-file: `body` recibe `font-family: Inter` de `ko.css` pisando el
    `Noto Sans` de `base.css` (probablemente no intencional, sin documentar); `.container`
    1400 vs 1440px ya es deuda asumida (ERR-36).
  - **Recomendación**: sesión dedicada de consolidación CSS post-torneo con smoke visual.
- **36 `console.log/debug` en producción** (0 `debugger`). Parte es diagnóstico operativo
  intencional (live-sync, auth ERR-78); debris claro: bloque koInit `ui-nav.js:456-482` y
  trazas awards `scoring.js:1959-2074`. Limpieza selectiva post-torneo.
- **Módulos EF duplicados byte-a-byte**: `ia-bridge.mjs` + `fetch-all.mjs` idénticos en
  `get-dashboard/` y `get-league-standings/` → consolidar en `_shared/` (requiere redeploy
  de ambas EFs con `--no-verify-jwt`; riesgo actual: divergencia silenciosa al parchear una copia).
- **`migration-log.md` 528KB sin política de retención** (52× el cap del CLAUDE.md).
  Propuesta coherente con el patrón existente: archivar por meses a
  `migration-log-archive-YYYYMM.md`, retener 30-60 días en el vivo, y añadir tercer check
  al pre-commit (p.ej. 64KB).
- **`design/` 492KB tracked en main** contradice la regla §8 de multi-agent-sync (bundles en
  branch dedicada). Solo referencias de procedencia en comentarios. Mover a branch
  `docs/v3-design-source` o asumirlo mientras el porting v3 siga activo.
- **`ESQUEMA_SISTEMA_PORRA2026.xlsx`** desactualizado (pre-KO) pese a tener scripts de
  regeneración (`scripts/update_xlsx*.py`). Regenerar, mover a `docs/`, o congelar como
  snapshot histórico.
- **README.md**: 6 secciones obsoletas (bridge "v4" → real v13; faltan `ko-winner-sync` y
  `get-dashboard`; "ERR-01 a ERR-66" → ERR-100; cobertura squads "10/48" → 48/48; deadlines
  11-jun vencidos con ítems ya hechos sin marcar; pipeline live sin la fuente ESPN).
  Es el escaparate público — actualización curada pendiente.
- **Drift menor en docs/** (rutas movidas o nunca creadas): `bottom-tab.js` referenciado sin
  `components/` en `03-predictor-design-source.md`; `00-app-shell-brief.md` con prefijo `js/`
  en vez de `public/js/` y "ubicación destino" nunca ejecutada; TODOs de reorganización en
  `restyling-mobile.md:242-243`; briefs globo referencian fuentes one-time ya borradas
  (benigno); los 9 ficheros de `sanity-check-20abr2026.md` son propuestas nunca implementadas,
  no rutas rotas.

### 3.6 Optimización de build (prioridad baja, NO aplicada)

Solo `js/main-entry.js` pasa por el bundler (189KB → 49KB gzip); ~1.31MB de `dist/js/` +
~583KB de `dist/css/` se copian verbatim sin minificar (classic scripts de `public/`,
arquitectura deliberada — ERR-18). Mitigado por gzip/brotli en el edge de Vercel. Si algún
día duele: step post-build con esbuild/lightningcss manteniendo nombres de fichero, +
`server.open` condicionado a `!process.env.CI`.

---

## 4 · Checks que salieron LIMPIOS

- **0 ficheros JS huérfanos** bajo `public/js/` (grafo de carga index.html + loadScript completo).
- **0 CSS huérfanos**: 26 enlazados + `porra-dashboard.css` lazy-load legítimo.
- **Migración `<style>` inline → CSS: COMPLETADA** (0 bloques "Archivo destino" pendientes).
- **ERR-01 limpio**: los 5 `DOMContentLoaded` existentes siguen el patrón defensivo.
- **0 bloques grandes de código comentado**; 0 `debugger`; solo 4 TODOs reales.
- **Dependencias**: las 4 declaradas se usan; 0 imports fuera de package.json; 0 majors
  pendientes (2 minors).
- **Build OK sin warnings**; los 26 CSS enlazados presentes en `dist/css/`.
- **Sin tracked-ignorables, sin ficheros vacíos, sin duplicados** (salvo los EF de §3.5).
- **Jobid 31 `ko-winner-sync`**: activo, `*/2`, gated, 0 fallos en 48h. ✅
- **Cron por-partido**: 0 huérfanos.

---

## 5 · Verificación de esta sesión

- `npm run build` → OK, sin warnings, dist/ 2.2MB.
- `npm test` → 349/349 verde (con el skip-pattern conocido, ver §2.4).
- Hook pre-commit activado en el clon (`git config core.hooksPath .githooks`) y tamaños OK.
