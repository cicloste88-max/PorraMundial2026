# Errores conocidos — Porra Mundial 2026

Catálogo histórico de bugs detectados y patrones críticos de prevención.
Cada entrada: **Síntoma**, **Causa**, **Fix aplicado**, **Patrón preventivo**, **Fecha detección**.

Al debuggear un problema nuevo: **consultar primero este catálogo** (ERR-01 a ERR-20) por si coincide con un patrón ya resuelto.

---

## ERR-01 — DOMContentLoaded en classic scripts cargados async

- **Síntoma:** scripts no inicializan, sus handlers nunca corren.
- **Causa:** al cargar un classic script via `loadScript()` de forma asíncrona, el evento `DOMContentLoaded` ya se disparó antes de que el script se ejecute.
- **Fix aplicado:** patrón defensivo en cada módulo classic:
  ```js
  const runInit = () => { /* ... */ };
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', runInit);
  } else {
    runInit();
  }
  ```
  Aplicado en `auth.js`. Red de seguridad adicional en `main-entry.js`.
- **Patrón preventivo:** **NO usar `addEventListener('DOMContentLoaded', ...)`** directo en classic scripts cargados via `loadScript`. Siempre usar el patrón anterior.
- **Fecha detección:** 11 abr 2026.

---

## ERR-02 — `const` top-level no se expone en `window`

- **Síntoma:** `window.PARTIDOS` / `window.EQUIPOS` = `undefined` aunque `data.js` las declara con `const`.
- **Causa:** en classic scripts, **sólo `var` top-level** se añade a `window`. `const` y `let` son accesibles por scope léxico pero no como propiedad de `window`.
- **Fix aplicado:** referenciar directamente `PARTIDOS` / `EQUIPOS` (no `window.PARTIDOS`). Descubierto mientras se escribían `ui-directo.js` y `live-sync.js`.
- **Patrón preventivo:** nunca asumir `window.X` para globals declarados con `const`/`let`. Si se necesita exposición explícita, hacer `window.X = X` al final del módulo.
- **Fecha detección:** 17 abr 2026.

---

## ERR-03 — Vite public collision (dev vs prod sirven ficheros distintos)

- **Síntoma:** dev (`npm run dev`) y producción (Vercel) sirven ficheros distintos bajo la misma URL. Bug reproducible en dev desaparece en prod o al revés.
- **Causa:** Vite, en dev, prioriza la raíz del proyecto sobre `public/`. En build sólo `public/` se copia a `dist/`. Si existe el mismo path en raíz y en `public/`, los entornos divergen.
- **Descubierto con:** `js/bracket-results.js` (versión vieja en raíz) colisionando con `public/js/bracket-results.js` (versión nueva).
- **Fix aplicado:** borrar de la raíz cualquier fichero que colisione con `public/`. Limpieza en sesión 17 abr 2026.
- **Patrón preventivo:** **nada en la raíz del repo que colisione con un path dentro de `public/`**. Al añadir assets, elegir UN solo sitio.
- **Fecha detección:** 17 abr 2026.

---

## ERR-04 — Whitespace invisible en secrets del Vault de Supabase

- **Síntoma:** Twilio devuelve `401 code 20003 'Authentication Error - invalid username'` pese a que las credenciales son correctas.
- **Causa:** al pegar un secret en la UI de Supabase Vault, el campo retiene espacios o saltos de línea invisibles al final.
- **Diagnóstico seguro (sin exponer valor):**
  ```sql
  SELECT name, length(decrypted_secret)
  FROM vault.decrypted_secrets
  WHERE name IN ('TWILIO_ACCOUNT_SID', 'TWILIO_API_KEY', 'TWILIO_API_SECRET');
  ```
  Longitudes esperadas: Account SID = **34**, API Key SID = **34**, Secret = **32**.
- **Fix sin exponer valor:**
  ```sql
  SELECT vault.update_secret(id, trim(decrypted_secret))
  FROM vault.decrypted_secrets
  WHERE name = 'NOMBRE_SECRETO';
  ```
- **Patrón preventivo:** tras pegar cualquier secret en Vault, comprobar `length()` y hacer `trim()` si no coincide con la longitud esperada.
- **Fecha detección:** 17 abr 2026.

---

## ERR-05 — Cadena de fallos SofaScore live scoring (solución arquitectónica)

Tres fallos encadenados que requirieron solución combinada.

### Síntomas por capa
1. **Red:** `403 Cloudflare` en requests directos a `api.sofascore.com` desde servidor (Deno / Node).
2. **Arquitectura de datos:** primer intento con actor Azzouzana `VzKtdb1t0Qnc07X8V` devuelve datos cacheados ~15 min via CDN. Inservible para live.
3. **Infra:** segundo actor propio `sofascore-live-proxy BYLtYcOxYkruVipwr` funciona pero tarda ~44 s; `pg_net` (Postgres) corta a los **30 s**.

### Causas
1. Cloudflare Bot Management bloquea IPs de datacenter.
2. Scraping HTML con CDN → cache de ~15 min.
3. Llamadas síncronas `pg_net` > 30 s simplemente se cancelan.

### Solución arquitectónica conjunta
- **(a)** Actor `sofascore-webshare-proxy N8vUChlhok5JU3cnL` (build 1.0.6) con **proxy Webshare residencial rotativo** + fetch directo a `api.sofascore.com` (~5-10 s, ~$0.001/run, ~$13 torneo total vs $318 estimados previos).
- **(b)** Pipeline **async + webhook**:
  ```
  pg_cron → net.http_post → porra-match-live EF
     → Apify API: lanzar actor ASYNC (no espera)
  Apify termina ~5-10s
     → webhook Apify → porra-apify-webhook EF
         → leer dataset, detectar cambios, Twilio directo, upsert live_scores
  ```

### Patrones preventivos
- Cualquier llamada externa > 30 s **debe** usar async + webhook (no `pg_net` síncrono).
- Evitar scrapers HTML para datos live (caché CDN ~15 min).
- SofaScore requiere **proxy residencial rotativo**; IPs datacenter = 403.

- **Fecha resolución final:** 17 abr 2026.

---

## ERR-06 — `vercel.json` wildcard corrompe MIME types de ES modules

- **Síntoma:** ES modules fallan en producción (Vercel) con errores de MIME type. En dev (Vite) funcionan.
- **Causa:** regla `source: "/(.*)"` en `vercel.json` sobrescribía el `Content-Type` correcto que Vercel asigna por defecto a los `.js`.
- **Fix definitivo:** **eliminar `vercel.json` completo**. Vercel gestiona MIME types correctamente por defecto.
- **Patrón preventivo (regla permanente):** **NO crear ni modificar `vercel.json`** en este repo.
- **Fecha detección:** 11 abr 2026.

---

## ERR-07 — `updateCardUI` race condition tras login

- **Síntoma:** tras login, tarjetas no se actualizan; errores en consola por `pill` / `stxt` = `null`.
- **Causa:** `updateCardUI` se invocaba antes de que el DOM tuviera las tarjetas renderizadas.
- **Fix aplicado:** early return en `main.js` si `pill` / `stxt` no existen; guardar en `auth.js` antes de invocar. Commit **ee2e25a**.
- **Patrón preventivo:** funciones que tocan elementos dependientes del render deben hacer early-return si el nodo aún no existe.
- **Fecha detección:** 11 abr 2026. QA validado en producción con 0 errores consola.

---

## ERR-08 — 404 masivos en consola por `extractUrl(linear-gradient(...))`

- **Síntoma:** cientos de 404 en consola por URLs inválidas.
- **Causa:** `extractUrl()` no filtraba valores `linear-gradient()` extraídos del CSS y los trataba como rutas de imagen.
- **Fix aplicado:** validación previa de URL antes de usar.
- **Patrón preventivo:** `extractUrl` / helpers análogos deben descartar cualquier valor CSS que no empiece por `url(`.
- **Fecha detección:** abril 2026.

---

## ERR-09 — CSS grid-areas roto en Vista Jornada

- **Síntoma:** layout de Vista Jornada aparecía desorganizado.
- **Causa:** definición `grid-areas` inconsistente con los nombres asignados a los hijos.
- **Fix aplicado:** ajuste de `grid-template-areas` y mapeo de `grid-area` de los hijos.
- **Patrón preventivo:** al refactorizar grids nombrados, revisar simultáneamente padre e hijos.
- **Fecha detección:** abril 2026.

---

## ERR-10 — Header eliminatorias no responsive en móvil

- **Síntoma:** cinta de tabs de ronda no se visualizaba completa en móvil.
- **Causa:** estructura de header distinta a la de fase grupos, sin flex wrap ni scroll horizontal.
- **Fix aplicado:** replicar patrón de fase grupos (pill liga arriba, título + puntos, user-bar, sub-bar con tabs + simular).
- **Estado:** parcialmente resuelto; **queda pendiente** la cinta superior en móvil (ver CLAUDE.md bug #2).
- **Patrón preventivo:** headers de módulos hermanos deben compartir estructura base; reutilizar clases en vez de duplicar.
- **Fecha detección:** abril 2026.

---

## ERR-11 — GitHub raw bloqueado por proxy de Claude.ai

- **Síntoma:** Claude.ai no puede hacer fetch directo a `raw.githubusercontent.com`.
- **Workaround permanente:** invocar Edge Functions vía `net.http_post` en SQL (Supabase MCP `execute_sql`), capturar `request_id`, y recuperar la respuesta con:
  ```sql
  SELECT content::text FROM net._http_response WHERE id = <N>;
  ```
- **EF de apoyo:** `porra-fix-encoding` v5 soporta acciones `inspect` y `write` sobre la API de GitHub.
- **Patrón preventivo:** para lectura/escritura de ficheros del repo desde Claude.ai, **siempre pasar por EF + `net.http_post`**, no intentar fetch directo.
- **Fecha detección / workaround:** sesiones previas; formalizado abril 2026.

---

## ERR-12 — Ficheros de persistencia referenciados pero no existentes

- **Síntoma:** `CLAUDE.md` cita «consultar `errores_conocidos_porra.md` (ERR-01 a ERR-20)» y «actualizar `migration-log.md`», pero ambos dan 404 en GitHub.
- **Causa:** la regla se estableció en la memoria / CLAUDE.md, pero el fichero nunca llegó a crearse en el repo.
- **Fix aplicado:** crear este fichero (`errores_conocidos_porra.md`) y `migration-log.md` con el histórico. Commit persistencia 17 abr 2026.
- **Patrón preventivo:** antes de referenciar un fichero de persistencia en una regla, **verificar que existe** en el repo con `porra-fix-encoding action:inspect`. Si no existe, crearlo antes de referenciarlo.
- **Fecha detección:** 17 abr 2026.

---

## ERR-13 — `porra-fix-encoding action:inspect` devuelve 404 para ficheros que sí existen

- **Síntoma:** `inspect` sobre `migration-log.md` desde Claude.ai vía `net.http_post` responde `HTTP 500 {"ok":false,"error":"No se pudo leer: 404"}`, pero el fichero existe en `main` y es accesible vía clone / `git show`.
- **Causa posible (sin diagnosticar todavía):**
  - EF apuntando a rama incorrecta (no `main`).
  - Path-matching sensible a encoding de URL / barras iniciales.
  - BOM u otro encoding raro del fichero que confunda a la API de GitHub.
- **Workaround actual:** pedir a Claude Code que lea el fichero tras clone local (`Read` tool) en lugar de depender de `inspect` desde Claude.ai.
- **Impacto:** bajo. Sólo afecta la verificación de existencia de ficheros desde Claude.ai; no afecta al runtime ni al pipeline live.
- **Patrón preventivo:** no depender de `porra-fix-encoding action:inspect` para confirmar existencia de ficheros. Usar Claude Code (`Read` / `git ls-files`) cuando la verificación sea crítica.
- **Estado:** pendiente de diagnosticar cuando sea relevante (probablemente al tocar `porra-fix-encoding` por otro motivo).
- **Fecha detección:** 17 abr 2026.

---

## ERR-14 — `checkIsAdmin` async no completa y la sección admin-only nunca renderiza

- **Síntoma:** tras login como admin, una sección admin-only (p. ej. **🧪 Simulacros activos** en la vista Directo) no aparece en el DOM, aunque la query directa a BD devuelve `is_admin = true` y forzar `window._isAdminCached = true` + `renderVistaDirecto()` por consola la pinta correctamente.
- **Causa:**
  1. El check admin se llamaba *fire-and-forget* desde `renderVistaDirecto` pero **no disparaba re-render** al completar.
  2. Si el script se ejecutaba antes de que la sesión Supabase estuviese hidratada (común tras refresh), `_porraDb.auth.getUser()` devolvía `null` y el check se abandonaba prematuramente cacheando `false` para siempre.
- **Fix aplicado** (`public/js/ui-directo.js`, commit `0421f0f`):
  - **(a)** Retries del check (cada **500 ms**, hasta **10 intentos** ⇒ 5 s máx) si `_porraDb` no existe o `getUser()` devuelve `null`. No se cachea `false` hasta agotar reintentos.
  - **(b)** Tras completar y actualizar `window._isAdminCached`, dispara `renderVistaDirecto()` de nuevo.
  - **(c)** Guard anti-loop: `_lastRenderAdminValue` se compara con `_isAdminCached`; sólo re-render si cambia.
  - **(d)** Flag `_checkInProgress` para evitar checks paralelos.
  - Logs explícitos `[ui-directo] checkIsAdmin: …` en cada paso (inicio, user, is_admin, cache actualizado, retry, max alcanzado).
- **Patrón preventivo:** cualquier chequeo asíncrono que condicione render debe (1) reintentarse si los recursos *upstream* (auth, BD, librerías) no están listos, (2) disparar re-render al completar, (3) tener guard anti-loop comparando con el último valor renderizado.
- **Fecha:** 17 abr 2026 PM.

---

## ERR-15 — Sobrescritura de `encrypted_password` en QA es destructiva e irreversible

- **Síntoma:** durante un QA de flujo autenticado, se sobrescribe `auth.users.encrypted_password` para poder hacer login como otro usuario. Al terminar, no existe forma de restaurar el hash original → el usuario no puede volver a entrar con su password.
- **Causa:**
  1. `encrypted_password` es un hash **bcrypt** (one-way). La password plaintext original no se guarda en ningún sitio.
  2. Supabase no mantiene un historial/backup por columna. El único mecanismo de rollback es **Point-in-Time Recovery** a nivel proyecto, que revierte **toda** la BD y destruye trabajo posterior (inviable).
  3. Los logs no guardan el hash antiguo; aunque lo hicieran, bcrypt no se revierte a plaintext.
- **Fix aplicado (mitigación, NO restauración):**
  - Invalidar el password temporal usado durante el QA con un hash aleatorio largo: `UPDATE auth.users SET encrypted_password = crypt(gen_random_uuid()::text || gen_random_uuid()::text, gen_salt('bf')) WHERE email = ...`.
  - Comunicar al usuario afectado que use **"Recuperar contraseña"** (flujo estándar de reset vía email).
- **Patrón preventivo (obligatorio para futuros QA):** cuando haya que actuar como otro usuario, **nunca sobrescribir `encrypted_password`**. Opciones válidas:
  1. `auth.admin.generateLink({ type: 'magiclink', email })` → devuelve `action_link` con tokens consumibles que crean sesión directa sin password.
  2. Crear un usuario QA dedicado (`qa_test_<fecha>@dominio`) y eliminarlo al terminar.
  3. Hacer el test llamando a la EF desde SQL con un JWT generado para ese user (requiere firmar manualmente con el JWT secret del proyecto — más complejo pero posible).
- **Fecha detección:** 18 abr 2026 PM, QA feature `create-league` con mavc_999.

---

## ERR-16 — Plataforma Supabase rechaza JWT ES256 cuando `verify_jwt=true` en EFs

- **Síntoma:** una Edge Function recién desplegada con `verify_jwt: true` devuelve **HTTP 401** con `{ "code": "UNAUTHORIZED_UNSUPPORTED_TOKEN_ALGORITHM", "message": "Unsupported JWT algorithm ES256" }` al recibir un JWT válido del frontend (`supabase.auth.getSession().access_token`).
- **Causa:** los proyectos Supabase modernos pueden tener **JWT signing keys ES256** en lugar de HS256. El verificador de la plataforma delante de las EFs **todavía no soporta ES256** cuando `verify_jwt=true`. El mismo JWT, validado dentro de la EF con `supabase.auth.getUser(jwt)`, funciona perfectamente (el SDK sí soporta ES256).
- **Fix aplicado** (`create-league` v1 → v2, 18 abr 2026 PM):
  - Desactivar `verify_jwt` en el deploy (`verify_jwt: false`).
  - Validar el JWT manualmente dentro de la EF creando un cliente con `SUPABASE_SERVICE_ROLE_KEY` y llamando a `supabase.auth.getUser(jwt)`. Si devuelve `authErr` o `user == null`, responder 401.
  - Este es el mismo patrón que usa `admin-actions` desde su origen.
- **Patrón preventivo:**
  - Por defecto, las EFs que dependan de la identidad del usuario en este proyecto se despliegan con **`verify_jwt: false` + validación manual**.
  - Si en el futuro la plataforma soporta ES256 en el verificador, se puede reevaluar.
  - CORS: seguir respondiendo manualmente (`OPTIONS` → headers `Access-Control-Allow-*`) porque al desactivar `verify_jwt` se pierde también el preflight automático que venía con él.
- **Fecha detección:** 18 abr 2026 PM.

---

## ERR-17 — Claude Code no puede borrar ramas remotas (HTTP 403 del proxy git)

- **Síntoma:** `git push origin --delete <rama>` desde la sesión de Claude Code responde **HTTP 403**. También falla cualquier variante (`git push origin :rama`).
- **Causa:** el proxy git del entorno sandbox de Claude Code no autoriza operaciones de **borrado de refs remotas**; sólo permite `push` de nuevos commits.
- **Fix aplicado (18 abr 2026):** borrado ejecutado desde **Claude.ai** vía GitHub REST API con `DELETE /repos/{owner}/{repo}/git/refs/heads/{branch}` usando `GITHUB_TOKEN` del Vault de Supabase + `net.http_post` desde SQL. `HTTP 204` = borrado OK. Las ramas locales las borró después Claude Code sin problema (`git branch -D` sí funciona; sólo falla el `push --delete`).
- **Patrón preventivo:** para limpieza de ramas remotas, **NO intentarlo desde Claude Code**. División de responsabilidades:
  - **Remotas** → Claude.ai (GitHub API + token del Vault).
  - **Locales** → Claude Code (`git branch -D` + `git fetch --prune`).

  Toggle **"Automatically delete head branches"** en Settings del repo automatiza el caso de PRs mergeados (activado 18 abr 2026).
- **Fecha detección:** 18 abr 2026.

---

## ERR-18 — Vite build no incluye `css/*.css` en `dist/` (CSS perdido en producción)

- **Síntoma:** la UI móvil del rediseño de grupos (mobile-collapsed, mobile-focus-layer, etc.) se veía bien en `npm run dev` pero quedaba sin estilos en producción tras merge del PR #9. Los `<link rel="stylesheet" href="/css/xxx.css">` daban 404 en Vercel.
- **Causa:** Vite sólo copia el contenido de `public/` a `dist/` automáticamente. Los ficheros que están en la raíz (`css/`) son ignorados por el build salvo que se importen desde un JS que forme parte del bundle. En dev, el dev-server de Vite sí sirve desde la raíz, lo que enmascara el problema hasta la primera publicación.
- **Fix aplicado (18 abr 2026):** `git mv css/*.css public/css/*.css` (preserva historial). Paths en `index.html` siguen siendo válidos porque Vite sirve `public/` desde la raíz del dominio tanto en dev como en build. Commit `b4a52e6`.
- **Patrón preventivo:** cualquier asset servido bajo `/xxx` en la SPA **debe** vivir en `public/xxx/` o ser importado desde un módulo del bundle. Verificación obligatoria tras cambios que añaden `<link>` nuevos: `npm run build && ls dist/` y `npm run preview` con `curl` al asset esperado.
- **Fecha detección:** 18 abr 2026.

---

## ERR-19 — `openMobileFocus` dejaba `body.overflow=hidden` colgado en iPhone Safari

- **Síntoma:** en iPhone real, al tappear la cabecera de un grupo en la vista móvil, la lista se plegaba pero el focus layer no aparecía y el scroll de toda la pantalla quedaba bloqueado de forma persistente.
- **Causa:** `openMobileFocus` aplicaba `document.body.style.overflow = 'hidden'` **antes** de `layer.classList.add('open')`. Si algo fallaba entre medias (p. ej. `buildSummarySlide` por quirk de Safari iOS), el body se quedaba bloqueado sin que el layer llegase a mostrarse. Sin devtools en iPhone el fallo era invisible.
- **Fix aplicado (19 abr 2026):** envolver `openMobileFocus` entera en `try/catch` con restauración de `body.overflow` en caso de excepción antes de `__openedLayerOk=true`; mover el `body.overflow='hidden'` al final (después de `layer.classList.add('open')`); añadir `showMobileToast('✗ [DEBUG] ...', 'error')` con `err.message.slice(0,60)` para diagnosticar sin devtools. Commit `0aa78a9`.
- **Patrón preventivo:** efectos colaterales sobre el DOM global (`body.style`, `window.scrollTo`, etc.) deben ir **al final** de la función, sólo tras confirmar que el resto ha tenido éxito. En móvil, toda operación que pueda fallar debe contar con visibilidad sin devtools (toast + `console.error` redundantes).
- **Fecha detección:** 19 abr 2026.

---

## ERR-20 — `body.style.overflow='hidden'` bloquea scroll persistente en iPhone Safari (patrón scroll-lock)

- **Síntoma:** incluso tras ERR-19, el scroll de la página de grupos seguía bloqueándose en iPhone Safari al interactuar con la vista móvil de grupos. No en Chrome Android, no en Chrome desktop.
- **Causa:** Safari iOS aplica `overflow:hidden` en `<body>` de forma "pegajosa" — incluso cuando el código lo restaura a `''`, a veces el motor de layout mantiene la restricción de scroll, especialmente si la tab ha estado en background o si la navegación SPA atraviesa estados.
- **Fix aplicado (19 abr 2026):** eliminar por completo el patrón scroll-lock. `openMobileFocus` y `closeMobileFocus` ya no tocan `document.body.style.overflow`. El layer `position:fixed inset:0` cubre visualmente la pantalla sin necesidad de bloquear el scroll del fondo. Añadida recuperación defensiva al cargar el módulo: si se encuentra `body.overflow === 'hidden'` (residuo de ejecuciones anteriores atascadas), se limpia. Commit `40c0fe2`.
- **Patrón preventivo:** NO usar `body.style.overflow='hidden'` como scroll-lock en iOS Safari. Alternativas: layer `position:fixed` cubriendo pantalla completa, o `overscroll-behavior: none` en el propio layer.
- **Fecha detección:** 19 abr 2026.

---

## ERR-21 — `.mobile-focus-layer` dentro del `@media` dejaba layer fantasma en Safari y bloque inline en Chrome

- **Síntoma:** (1) en iPhone Safari el scroll seguía bloqueándose al tappear cabecera de grupo, pese al fix ERR-20. (2) En Chrome Android con viewport CSS >640px aparecían "botones rotos" al final de la página cuando se abría el focus layer.
- **Causa:** las reglas base del `.mobile-focus-layer` (`position:fixed`, `inset:0`, `transform:translateX(100%)`, `opacity:0`, etc.) estaban **dentro** del `@media (max-width: 640px)`. Por tanto:
  - En viewports >640px el layer no tenía `position:fixed` → aparecía como `<div>` inline al final del body con dimensiones enormes.
  - En iPhone Safari con viewport ≤640px el layer cerrado (`transform:translateX(100%)` + `opacity:0`) seguía participando en el hit-testing táctil, bloqueando el scroll del body detrás.
- **Fix aplicado (19 abr 2026):** sacar las reglas base de `.mobile-focus-layer` **fuera** del `@media` para que apliquen siempre (el layer nunca es visible hasta `.open`, da igual el viewport). Añadir `visibility: hidden` + transición con delay `0.32s` en el cierre para que el layer salga del hit-testing táctil cuando está cerrado (y `visibility: visible` con transición `0s` al abrir). Las reglas de contenido (header, dots, carousel, etc.) sí quedan dentro del `@media`. Commit `82b4753`.
- **Patrón preventivo:** cualquier reglas de **posicionamiento/visibilidad** de layers overlay deben aplicar en todos los viewports, no sólo en móvil. El media query debe contener sólo estilos de contenido (tamaños, paddings, fuentes). Para layers cerrados con `opacity:0`/`transform`, añadir siempre `visibility: hidden` explícito para sacarlos del hit-testing.
- **Fecha detección:** 19 abr 2026.
