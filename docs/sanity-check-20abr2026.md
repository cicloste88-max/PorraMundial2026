# Sanity check — Porra Mundial 2026

> Fecha: 20 abr 2026 noche · HEAD en el momento del review: `0d11e13`
> Autor del análisis: Claude Code (Opus 4.7) tras barrido de ~8.600 LOC JS + 4.700 CSS + 1.035 HTML
> Propósito: documentar hallazgos priorizados para invertir ANTES del 11 jun 2026

Este doc consolida el sanity check del 20 abr. Se mantiene como referencia operativa — las acciones priorizadas viven también en `CLAUDE.md` (Pendientes abiertos) y `CONTEXTO_PORRA_2026.md` (Deuda técnica). El detalle completo está aquí.

---

## Índice

1. [Crítico — seguridad y correctness](#crítico)
2. [Alto — mantenibilidad y escala](#alto)
3. [Medio — performance y UX](#medio)
4. [Bajo — cosmético / infraestructura](#bajo)
5. [Plan recomendado antes del 11 jun](#plan)

---

## Crítico — seguridad y correctness <a id="crítico"></a>

### 1. La "IA" del pronóstico NO funciona en producción

`public/js/scoring.js:941` y `public/js/ui-nav.js:49` hacen:

```js
fetch('https://api.anthropic.com/v1/messages', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },   // ⚠ sin x-api-key
  body: JSON.stringify({...})
})
.then(r => r.json())
.catch(() => fallback);                              // ← siempre entra aquí
```

Sin header `x-api-key`, Anthropic responde 401. El `.catch()` devuelve un `fallback` hardcoded de 5 strings. **El usuario cree que la IA predice en vivo — son strings de un array fijo.**

No es un leak de credenciales (no hay credencial en el código). Es peor: la feature IA aparenta funcionar sin funcionar, y si algún día alguien "arregla" poniendo la API key en el cliente, sí sería leak crítico.

**Fix propuesto:** EF nueva `porra-ia-predict` en Supabase que reciba `{matchId, homeTeam, awayTeam, venue}`, llame a Anthropic con `ANTHROPIC_API_KEY` del Vault, y devuelva el JSON. Cache por `matchId + fecha` en tabla `ia_cache` para no gastar tokens en recomputos.

**Esfuerzo:** medio día. **ROI:** altísimo — activas una feature que creías tener + eliminas un landmine de seguridad.

---

### 2. Zero tests en 8.626 LOC de JS

`find -name '*.test.*'` → 0 resultados. El motor de puntuación (`public/js/scoring.js:43-193`) codifica las reglas que decidirán quién gana el bote real entre San y sus amigos:

- `+1` signo, `+3` resultado exacto (no acumula con signo)
- `+2` goleador correcto, `+1` bonus si pronóstico opuesto a IA y aciertas
- `+5 / +5 / +10 / +15 / +20 / +25` por equipo que avanza en cada ronda KO
- `+30 / +20 / +15 / +10` clasificación final
- `+15` Balón/Bota/Guante Oro, `+20` Mejor Joven ≤21
- Overrides admin desde tabla `results` que pueden alterar todo lo anterior

13+ casos con prioridad entre reglas. **Un bug aquí el día de la final y hay disputas reales entre amigos con dinero de por medio.**

**Fix propuesto:** Vitest + 30 tests unitarios cubriendo `calcMatchPoints`, `calcKOMatchPoints`, `calcGroupsAdvancePoints`, `calcClassificationPoints`, `calcAwardPoints`, `calcTotalUserPoints`. Cada test un caso real + un edge case.

**Esfuerzo:** 2 días. **ROI:** máximo — es la capa que más dolor daría si falla en producción.

---

### 3. Sin CI/CD

`ls .github/workflows/` → vacío. Cada `git push origin main` dispara Vercel directamente sin:

- Linter (ESLint no configurado)
- Type-check
- `node --check` sobre los .js
- `npm run build` verificador
- Tests (cuando existan)

La saga v2.1→v2.11 del F5 de ayer (11 iteraciones, varios reverts) es el síntoma directo: sin gates, cualquier regresión llega a producción y se descubre con San refrescando su iPhone.

**Fix propuesto:** GitHub Action mínima en 10-15 líneas:

```yaml
name: CI
on: [push, pull_request]
jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '20' }
      - run: npm ci
      - run: npm run build
      - run: node --check public/js/*.js js/*.js
      # - run: npm test   ← cuando haya tests
```

**Esfuerzo:** 2 horas. **ROI:** bloqueas regresiones obvias antes de merge.

---

## Alto — mantenibilidad y escala <a id="alto"></a>

### 4. Estado global sin contrato — 105 símbolos en `window.*`, 59 escape hatches

Contado con `grep`: 105 globals distintos leídos, 59 asignaciones explícitas `window.X = ...`. No hay un módulo de estado definido; cualquier fichero puede crear o leer globals. Ejemplos reales identificados durante esta sesión:

`_pendingPageRestore`, `_porraDb`, `_porraQueryDb`, `_porraToken`, `_activeLeague`, `_myLeagues`, `groupSaved`, `_liveScoresByMatchKey`, `_simulacrosByKey`, `_isAdminCached`, `_porraCerrada`, `_awPicksSaved`, `_sbPrevPage`, `_pendingCTA`, `_pendingAuth`, `_currentLeagueId`, `_porraSplashed`...

Cada iteración añade uno más. El debug "¿quién cambia esta variable?" tiende a `O(n)` ficheros.

**Fix propuesto:** `public/js/state.js` con un objeto `AppState` que encapsule las globals críticas. No hace falta Redux — un `Proxy` con logging de cambios ya es suficiente:

```js
window.AppState = new Proxy({}, {
  set(target, key, value) {
    if (import.meta?.env?.DEV) console.debug(`[state] ${key} =`, value);
    target[key] = value;
    return true;
  }
});
```

Migración incremental: las vars nuevas entran por `AppState.X`; las existentes se migran cuando toque el fichero por otra razón. No requiere big-bang refactor.

**Esfuerzo:** 1 día crearlo, migración opcional y perezosa. **ROI:** reduce drásticamente el coste de debug en bugs de estado.

---

### 5. 62 `onclick=` inline en `index.html`

`grep -c 'onclick=' index.html` → **62**. Cada uno obliga a que su handler sea global: `doLogin`, `doLogout`, `doRegister`, `openAuthModal`, `closeAuthModal`, `leagueSelectById`, `goToEliminatoria`, `undoKO`, `switchAuthTab`, `handleCTA`, etc. Si renombras uno o rompes uno, el botón se convierte en `ReferenceError` silencioso y el user ve "no pasa nada".

Ya estaba documentado como deuda técnica en `CONTEXTO_PORRA_2026.md` (Prioridad Media). Sigue ahí.

**Fix propuesto:** event delegation con `data-action="doLogin"`. Un listener raíz en `document.body` que rutea. Elimina los 62 `onclick` + ~20 de los globals escape hatches.

```html
<!-- antes -->
<button onclick="doLogin()">Entrar</button>
<!-- después -->
<button data-action="doLogin">Entrar</button>
```

```js
document.body.addEventListener('click', (e) => {
  const btn = e.target.closest('[data-action]');
  if (!btn) return;
  const fn = actionRegistry[btn.dataset.action];
  if (fn) fn(e, btn);
});
```

**Esfuerzo:** 1 tarde cuando haya tests (sin tests, riesgo de romper algo no detectado). **ROI:** elimina una clase entera de bugs (ReferenceError silenciosos).

---

### 6. `scoring.js` 1.438 LOC — mezcla reglas puras con render DOM y fetch IA

Contenido actual:

- `calcMatchPoints`, `calcKOMatchPoints`, `calcGroupsAdvancePoints`, `calcAwardPoints`, `calcClassificationPoints`, `calcTotalUserPoints` — **puras, testeables**
- `calcGroupTableAdvanced`, `getBestThirdsAll`, `renderGroupTableCard` — mezcla (la última escribe DOM)
- `createMatchCard`, `updateCardUI` — render DOM puro
- `KIT_OVERRIDES`, `STICKER_POOL`, `WHITE_KITS`, `TALL_STICKERS`, `WIDE_STICKERS` — datos de configuración
- `kitUrl`, `getStickerForMatch`, `isWhiteKit`, `isTallSticker`, `isWideSticker` — helpers de datos
- `_iaEnqueue` + fetch a Anthropic — la llamada muerta del punto 1

Cinco responsabilidades en un fichero. Cualquier cambio en puntuación te obliga a leer 1.438 líneas para estar seguro de no romper render.

**Fix propuesto (requiere tests del punto 2 como pre-requisito):**

- `public/js/scoring-engine.js` — sólo puras, sin `document`, sin `fetch`. Exporta todo para Vitest.
- `public/js/match-card.js` — `createMatchCard`, `updateCardUI`, handlers de tarjeta.
- `public/js/group-table.js` — `calcGroupTableAdvanced`, `getBestThirdsAll`, `renderGroupTableCard`.
- `public/js/assets-config.js` — `KIT_OVERRIDES`, `STICKER_POOL` y helpers asociados.
- `public/js/ia-client.js` — cliente de IA (llama a la EF `porra-ia-predict` del punto 1).

**Esfuerzo:** 2 días. **ROI:** cada fichero pasa de 1.438 a 200-400 LOC. Testear y modificar scoring deja de ser caro.

---

### 7. `ui-groups.js` + `ui-groups-mobile.js` en paralelo — riesgo de divergencia

17 funciones en uno, 19 en otro. Ambos manipulan `predictions`, renderizan grupos, reaccionan a cambios de boost. El móvil se añadió sin refactor del desktop → lógica duplicada que se desincroniza con facilidad.

Visto dos veces en las últimas 2 sesiones: reglas del móvil (`mobile-collapsed`, `mobile-focus-layer`) tardaron en aparecer porque venían de commits que esperaban CSS que `index.html` no linkeaba (ERR-22). La misma clase de fallo silencioso ocurrirá en la capa JS cuando toque tocar la lógica de boost y alguien olvide actualizar los dos ficheros.

**Fix propuesto:** extraer helpers compartidos a `public/js/groups-shared.js` (`getGroupCompleted`, `hasValidScorer`, `canSaveGroup`, etc. — algunos ya viven en `ui-groups-mobile.js`). Los dos renderers llaman a los mismos helpers. Single source of truth para las validaciones.

**Esfuerzo:** medio día. **ROI:** medio — no urgente pero alto valor a largo plazo.

---

### 8. Saga v2.1 → v2.11 como síntoma meta

11 iteraciones para persistir una página. Varios reverts. El diagnóstico real llegó con MutationObserver en la iteración 11. **Root cause meta:** no había forma rápida de saber "qué cambia `#page-welcome.style.display` y cuándo".

**Fix propuesto — tooling de debug reutilizable:** un helper global `window._trace(selector, attribute)` que instrumenta con MutationObserver + `console.trace` en cada cambio. Se activa en consola durante debug, cero impacto en producción (sólo se ejecuta si el user lo llama explícitamente). Habría ahorrado 8 de los 11 commits de la saga F5.

```js
window._trace = (selector, attr = 'style') => {
  const el = document.querySelector(selector);
  if (!el) return console.warn('no element');
  new MutationObserver(muts => {
    muts.forEach(m => console.trace(`[trace] ${selector}.${m.attributeName} = ${el.getAttribute(m.attributeName)}`));
  }).observe(el, { attributes: true, attributeFilter: [attr] });
  console.log(`[trace] watching ${selector}[${attr}]`);
};
```

**Esfuerzo:** 30 min. **ROI:** ahorra el coste de la próxima saga de debug visual.

---

## Medio — performance y UX <a id="medio"></a>

### 9. Bundle único sin code splitting

`dist/assets/index-Un5jEkqd.js` = **188 kB (49 kB gzip)**. Todo en un chunk: Supabase, admin, KO, live-sync, ui-directo, mobile. Un user que sólo mira el score igual se descarga 188 kB.

**Fix propuesto:** dynamic imports condicionales. Candidatos obvios:

- `admin.js` — sólo si `currentUser.is_admin`
- `ko.js` + `bracket-results.js` — sólo al entrar en Eliminatorias
- `ui-directo.js` + `live-sync.js` — sólo al entrar en Directo

Requiere convertir la `loadScript` chain en `await import('/js/admin.js')` condicional. Complejo porque son classic scripts — pero mezclable con un wrapper que haga `loadScript` bajo demanda cuando el user abre esa pestaña.

**Esfuerzo:** 1 día. **ROI:** bundle inicial ~140 kB vs 188 kB (-26%). Notable en móvil 3G.

---

### 10. `loadScript` chain secuencial — 14 requests HTTP en serie

`js/main-entry.js` encadena `.then(() => loadScript(...))` **14 veces**. Cada loadScript espera al `onload` del anterior antes de pedir el siguiente. En red lenta esto puede ser 2-3 segundos sólo del waterfall.

El orden real de dependencias es:

```
leagues → data → scoring → ui-groups → ui-groups-mobile → ko
       → bracket-results → ui-nav → auth → scoreboard
       → close-porra → admin → ui-directo → live-sync
```

`misc.js` ya se carga en paralelo (correcto). Varios otros son hojas sin interdependencia que podrían paralelizarse:

- `scoreboard`, `close-porra`, `admin`, `bracket-results` → paralelos tras `scoring.js`
- `ui-directo`, `live-sync` → paralelos entre sí (ambos dependen de `ui-nav`)

**Fix propuesto:** reemplazar la chain estricta por una DAG con `Promise.all` por capas. O radicalmente: convertir todos los scripts a ES modules y dejar que Vite los bundlee / code-splittee. Esto último elimina la chain entera pero es más invasivo.

**Esfuerzo:** 1-2 horas la versión conservadora (DAG), 2-3 días la radical (ES modules). **ROI:** tiempo de arranque -30-50% en redes lentas.

---

### 11. `setTimeout(N)` con **27 números mágicos**

`setTimeout(..., 100)`, `..., 200`, `..., 500`, `..., 600`, `..., 2200`, `..., 4000`, `..., 10200`... dispersos. Frágiles frente a redes lentas. Parte del motivo de la saga v2.1→v2.11 fue timings asumidos.

**Fix propuesto:** `public/js/timings.js`:

```js
window.TIMINGS = {
  AUTH_HYDRATION_MS: 100,      // tras INITIAL_SESSION, delay antes de showPage
  CARD_RENDER_DELAY_MS: 200,   // DOM settle tras render
  GROUP_TABLES_REFRESH_MS: 600,// segunda pasada refreshGroupTables
  TOAST_DISMISS_MS: 2200,
  SPLASH_MIN_MS: 4000,
  SPLASH_HARD_CAP_MS: 10200,
  CHECK_ADMIN_RETRY_MS: 500,
  CHECK_ADMIN_MAX_ATTEMPTS: 10,
  // ...
};
```

Al menos los timings son buscables cuando haga falta tuning. Requisito previo a cualquier migración a `Promise`/`await` de los `setTimeout`.

**Esfuerzo:** 1 hora centralizar, migración perezosa. **ROI:** medio.

---

### 12. Splash hardcoded 4s — penaliza al user nuevo

Tras la saga v2.1→v2.11, el splash se skipea si hay `porra_lastPage`. Pero el user anónimo que llega por primera vez ve 4 segundos de animación antes de poder interactuar más allá del botón "Saltar →".

Cuando los amigos de San lleguen por link de invitación el 11 jun, verán 4s obligatorios cada primera visita por dispositivo.

**Fix propuesto (opciones):**

- (a) Mostrar splash sólo en la primera visita absoluta (cookie/localStorage `porra_splashed=1`). Simplísimo.
- (b) Reducir a 1.5s — sigue habiendo animación pero breve.
- (c) Hacer que `splashDone()` se dispare con evento `authReady` real en vez de timer fijo. Más trabajo, UX mejor.

**Esfuerzo:** (a) 15 min, (b) 5 min, (c) medio día. **ROI:** reduce fricción de los amigos nuevos.

---

### 13. Supabase auth tokens en `localStorage`

`auth.js:17-21` custom storage → `localStorage`. Cualquier XSS lee el token y se hace pasar por el user. Para un proyecto de amigos, tolerable. Si crece en features que procesan input externo o embeben contenido third-party, el riesgo sube.

**Fix inmediato:** auditar los ~70 `innerHTML` del código. Verificar que todos pasan por `escapeHtml` cuando incluyen datos del usuario (nombres de liga, nombres de user, quips de IA cuando se activen). Empezar por los campos que leen input directo del usuario.

**Fix mejor (v3 futuro):** migrar a session cookies `httpOnly` via Supabase Auth Helpers. Requiere backend como proxy (Vercel Edge Functions). Sobredimensionado para ahora.

**Esfuerzo:** auditoría 1-2 horas. **ROI:** bajo-medio preventivo.

---

## Bajo — cosmético / infraestructura <a id="bajo"></a>

### 14. `console.log/warn/error` — **56 ocurrencias en producción**

Útil para debug; ruidoso en consola del user. Empresa seria: parece roto aunque no lo esté.

**Fix:** `public/js/logger.js`:

```js
const DEBUG = import.meta?.env?.DEV ?? (location.hostname === 'localhost');
export const log  = (...a) => DEBUG && console.log(...a);
export const warn = (...a) => console.warn(...a);   // warns sí en prod
export const err  = (...a) => console.error(...a);  // errors siempre
```

Migración incremental. No urgente.

---

### 15. Sin CSP / SRI

El `<link>` a Google Fonts no tiene `integrity="sha384-..."`. Sin `Content-Security-Policy` header. Higiene para cuando se haga público.

---

### 16. Sin analytics / error tracking

No hay Sentry, Plausible, ni equivalente. Cuando San reporte "se me ha quedado colgado el móvil" no hay forma de saber qué pasó. Con 10-15 usuarios durante el Mundial, los errores se van a perder en el ruido.

**Fix mínimo:** Sentry gratuito (5k errores/mes) en 15 líneas:

```js
import * as Sentry from "@sentry/browser";
Sentry.init({ dsn: "...", tracesSampleRate: 0.1 });
```

**Esfuerzo:** 2 horas. **ROI:** alto durante los 38 días del Mundial.

---

### 17. Documentación: fortaleza infravalorada

Punto positivo del proyecto. `CLAUDE.md`, `migration-log.md`, `errores_conocidos_porra.md` (ERR-01..ERR-23), `CONTEXTO_PORRA_2026.md`, `ESQUEMA_SISTEMA_PORRA2026.xlsx`, `README.md`. Esta disciplina documental es atípica en proyectos personales.

Mantener el protocolo end-of-session es clave para que el conocimiento no se pierda entre sesiones de Claude.

---

## Plan recomendado antes del 11 jun <a id="plan"></a>

8 semanas disponibles. Ordenado por **ROI** (impacto ÷ esfuerzo):

### Semanas 1-2 — fundamentos (4 días efectivos)

| # | Acción | Esfuerzo | ROI |
|---|---|---|---|
| 1 | **Tests del motor de puntuación** (Vitest, 30 tests de `calc*Points`) | 2 días | Máximo — evita disputas reales por puntos mal calculados |
| 2 | **GitHub Action CI básica** (build + node --check + tests cuando haya) | 2 horas | Bloquea regresiones obvias antes de merge |
| 3 | **EF `porra-ia-predict`** (mueve fetch Anthropic a EF con API key en Vault + cache en tabla) | medio día | Activa feature IA que ahora es fake + elimina landmine de seguridad |

### Semanas 3-4 — escala (3 días)

| # | Acción | Esfuerzo | ROI |
|---|---|---|---|
| 4 | **Code splitting `admin.js`** (dynamic import bajo `is_admin`) | medio día | Bundle -25% para user común |
| 5 | **Logger con gate por env** | 1 hora | Consola limpia en producción |
| 6 | **Sentry error tracking** | 2 horas | Descubres errores móvil reales antes que los reporten |
| 7 | **Auditoría `innerHTML` + `escapeHtml`** | 1-2 horas | Preventivo XSS con nombres de liga / user |

### Semanas 5-6 — refactor opcional (3-4 días)

Pre-requisito: tests del paso 1 completos. Sin ellos NO tocar scoring.

| # | Acción | Esfuerzo | ROI |
|---|---|---|---|
| 8 | **Split `scoring.js`** en engine + render + assets | 2 días | Mantenibilidad a largo plazo |
| 9 | **Consolidación `ui-groups` + `ui-groups-mobile`** (helpers compartidos) | medio día | Menos riesgo divergencia desktop/móvil |
| 10 | **Event delegation** (eliminar 62 onclicks) | 1 tarde | Menos superficie de ReferenceError silenciosos |

### Semanas 7-8 — buffer y herramientas (2-3 días)

| # | Acción | Esfuerzo | ROI |
|---|---|---|---|
| 11 | **`window._trace` helper debug** | 30 min | Ahorra coste de la próxima saga visual |
| 12 | **Splash acortado / condicional** | 15-30 min | UX primera visita amigos |
| 13 | **`AppState` proxy + `TIMINGS`** | 1 día | Higiene de estado y timings |

### Semanas NO hacer antes del Mundial

- Migración a TypeScript (overkill sin tests previos)
- Hash routing / v3 de persistencia página (funciona sin eso)
- Service Worker / PWA offline (no es la fricción real)
- Redux u otro state management completo (`AppState` proxy basta)
- Migración a session cookies `httpOnly` (sobredimensionado)

---

## Resumen en una frase

> El código **funciona para 10 amigos ahora mismo**. Para funcionar sostenidamente durante **38 días del Mundial con 15-30 usuarios concurrentes en los partidos live**, las tres inversiones críticas son: **tests del motor de puntos**, **EF para la IA real** y **CI básica**. Total: 4 días. Sin ellas, el 11 de junio se estará haciendo hot-fix en vez de features.

---

## Seguimiento

Este doc se actualiza conforme se completen acciones. Formato esperado de actualización:

```
### ✅ Completado

- **N. Título** (fecha, commit `abcdef0`): resumen del cambio y validación.
```

Acciones individuales también referenciables desde:
- `CLAUDE.md` → sección "Pendientes abiertos"
- `CONTEXTO_PORRA_2026.md` → sección "Deuda técnica identificada"
- `migration-log.md` → entrada del día en que se completen
