# Errores conocidos — Porra Mundial 2026

Catálogo histórico de bugs detectados y patrones críticos de prevención.
Cada entrada: **Síntoma**, **Causa**, **Fix aplicado**, **Patrón preventivo**, **Fecha detección**.

Al debuggear un problema nuevo: **consultar primero este catálogo** (ERR-01 a ERR-27) por si coincide con un patrón ya resuelto.

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
- **(a)** Actor `sofascore-webshare-proxy N8vUChlhok5JU3cnL` (build 1.0.6 al aplicar este fix; actualmente 1.0.7, sin romper el patrón) con **proxy Webshare residencial rotativo** + fetch directo a `api.sofascore.com` (~5-10 s, ~$0.001/run, ~$13 torneo total vs $318 estimados previos).
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
- **⚠️ RESUELTO 19 abr noche via refactor CSS (commit `9e93fe8`, ver ERR-22).** El fix inicial (`css/` → `public/css/`) no era suficiente — el problema real era que `index.html` nunca había enlazado esos ficheros porque tenía los 4 bloques `<style>` inline sin migrar (ver ERR-22). La cadena de fixes ERR-18/19/20/21 atacaba síntomas; la causa raíz era ERR-22.
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

---

## ERR-22 — `index.html` con `<style>` inline nunca migrados a ficheros CSS (causa raíz real de ERR-18/19/20/21)

- **Síntoma:** la feature móvil de grupos (rediseño PR #9, 4 commits con reglas `mobile-collapsed`, `mobile-focus-layer`, `slide-summary`, etc. añadidas a `public/css/base.css`) no aplicaba ninguno de esos estilos en producción. En iPhone Safari el layer aparecía sin formato y el scroll se bloqueaba; en Chrome Android salían elementos como bloque inline al final del body. La cascada de fixes ERR-19/20/21 tocaba código JS/CSS pero los estilos afectados simplemente nunca se servían al navegador.
- **Diagnóstico definitivo:** `getComputedStyle(document.querySelector('.mobile-focus-layer')).position` devolvía `'static'` (valor por defecto) cuando debería ser `'fixed'`. **Eso prueba que ninguna regla CSS con esa clase estaba aplicándose**. Inspección de `<head>`: sólo 3 `<link rel="stylesheet">` (bracket-results, boost, directo). `base.css`, `welcome.css`, `ko.css`, `admin.css` NO estaban enlazados.
- **Causa:** `index.html` tenía 4 bloques `<style>` inline gigantes (~1925 LOC total) con comentarios `<!-- Archivo destino : X.css -->` desde el refactor Vite inicial, pero la migración real nunca se ejecutó. Los comentarios eran TODOs sin acción. Por tanto:
  - Los estilos originales seguían vivos vía `<style>` inline en el HTML.
  - Los ficheros `public/css/base.css`, `welcome.css`, `ko.css`, `admin.css` existían pero no tenían efecto (ningún `<link>` los traía).
  - Cualquier regla añadida a esos ficheros (como las del rediseño móvil) se perdía silenciosamente en producción.
- **Fix aplicado (19 abr 2026 noche, commit `9e93fe8`):**
  1. Prepend del contenido de cada `<style>` a su fichero destino (al principio, para que las reglas nuevas del rediseño móvil queden al final y ganen por cascada si algún selector coincidiese).
  2. Eliminar los 4 bloques `<style>` de `index.html` (reemplazados por comentarios marcadores `<!-- CSS externo: X.css -->`).
  3. Añadir los 4 `<link rel="stylesheet">` faltantes en `<head>`: base → welcome → ko → admin → (3 existentes: bracket-results, boost, directo).
  - `index.html` pasó de 2970 a 1008 líneas. `dist/index.html` de 169 kB a 60 kB gzipeado.
- **Lección (meta-patrón):** los fixes ERR-19/20/21 atacaban síntomas de un problema cuyo root cause estaba dos capas más arriba. Se podrían haber ahorrado 3 commits con un `getComputedStyle()` inicial en producción: si devuelve el valor default/initial, **el CSS no está llegando al elemento** — no es fallo de lógica JS ni de reglas CSS incorrectas, es fallo de entrega.
- **Patrón preventivo (obligatorio tras este commit):**
  - Tras modificar CSS, verificar en producción con `getComputedStyle(elementoAfectado).propiedadRelevante`. Valor default/initial = CSS no aplicándose.
  - Antes de mergear cambios de diseño a `main`: `npm run build && ls dist/css/ && grep -l "<selector-esperado>" dist/css/*.css` — si el selector no aparece en ningún CSS del `dist/`, abortar merge.
  - Si `index.html` tiene `<style>` inline con comentarios `Archivo destino : X.css`, significa que hay migración pendiente — ejecutar ANTES de añadir reglas nuevas a los ficheros destino.
- **Fecha detección:** 19 abr 2026 noche.

---

## ERR-23 — Flash de welcome al refrescar (F5) con sesión válida + restore de página

- **Síntoma:** al pulsar F5/Ctrl+R en cualquier página de la SPA estando logado, durante ~500ms aparecía la pantalla de welcome (botón "Iniciar sesión" → "Elegir liga") antes de volver a la página real (Grupos / Eliminatorias / Score / Admin). Confundible con "parpadeo del botón de envío de porra" reportado por el user.
- **Causas (capa por capa, descubiertas iterativamente en saga v2.1 → v2.11):**
  1. **`<div id="page-welcome">` sin `style="display:none"` inline.** Las otras 4 páginas (`page-grupos`, `page-elim`, `page-score`, `page-admin`) sí tenían inline. Welcome era visible por defecto del browser desde T=0 del HTML parse, antes de que cualquier script corriera. **Fix v2.4** (commit `caaf0a0`).
  2. **Splash screen interno de 4 segundos hardcoded** corría incluso cuando había restore en marcha, alargando el flash hasta que el splash terminaba. **Fix v2.6** (commit `e28f447`): script inline en `<head>` lee `localStorage.porra_lastPage` y, si existe, salta el splash + lo elimina del DOM antes de que el module bundle siquiera empiece a cargar.
  3. **Module bundle (Vite) carga deferred (después de scripts classic).** Si `main-entry.js` setea `window._pendingPageRestore` a partir de `localStorage`, el guard de `auth.js` que lo lee puede ejecutarse ANTES de que el bundle haya corrido. **Fix v2.8** (commit `5ef545f`): replicar el `setItem` también en script inline `<head>` síncrono, antes del bundle.
  4. **`main-entry.js:74` safety-net `showPage('welcome')` corría sin guard** después del chain de carga, mientras `await loadUserData()` seguía pendiente en el handler de `INITIAL_SESSION`. Confirmado con MutationObserver: `#page-welcome.style.display = 'block'` en T=612ms, vuelta a `'none'` en T=1115ms. 503ms de flash. **Fix v2.11** (commit `d4a0047`): añadir guard `if (!window._pendingPageRestore) showPage('welcome')` también ahí.
  5. **CSS lock se retiraba al primer `showPage` sin importar el target.** v2.9 parte 2 quitaba `#restore-lock-css` en cualquier `showPage()`, incluido `showPage('welcome')` rogue del safety-net → welcome quedaba con `display:block` inline + sin `!important` que lo anulara → visible. **Fix v2.10** (commit `4214bfe`): el `showPage` se convierte en muro: `if (lock && page==='welcome') return; if (lock && page!=='welcome') lock.remove()`. Lock self-healing: ningún `showPage('welcome')` puede romperlo, y `showPage(target)` sí lo retira al pintar la página real.
- **Solución consolidada (3 capas + plus, "belt & suspenders"):** ver entrada de `migration-log.md` del 20 abr noche para detalle completo. La defensa actúa en 3 niveles independientes: HTML script inline (Capa 0), `main-entry.js` safety-net guard (Capa 1), `ui-nav.js showPage()` lock guard (Capa 2). Más `auth.js onAuthStateChange` consume `_pendingPageRestore` solo en `INITIAL_SESSION` (no en `SIGNED_IN`).
- **Patrón preventivo / lecciones aprendidas:**
  - **Parche capa por capa con MutationObserver.** Cuando un flash visual no responde a parches JS, instrumentar con `new MutationObserver(...)` sobre el atributo `style` del nodo afectado. Te da el T exacto y descarta hipótesis falsas. Fue lo que llevó al diagnóstico definitivo tras 10 iteraciones que no convergían.
  - **Module bundle vs scripts inline:** los `<script>` inline en `<head>` corren SÍNCRONOS antes del module bundle deferred. Si necesitas que un flag esté presente al inicio del bundle, setealo desde el `<head>` inline. NO confíes en que el bundle setee y los classic scripts subsiguientes lo lean a tiempo.
  - **Locks defensivos a CSS son resistentes a JS rogue.** Un `<style>...!important</style>` es mucho más difícil de romper accidentalmente que un flag de JavaScript. Combina con guard de JS si quieres dos capas.
  - **`localStorage` keys con prefijo `porra_`** (underscore) entran en el barrido de `doLogout` (`auth.js:286`, `.includes('porra_')`). Cualquier key nueva debe respetar la convención.
  - **No dramatizar la historia git ruidosa.** 11 iteraciones con varios reverts es ruido aceptable cuando el problema es una cascada de causas. Los reverts documentan qué hipótesis fueron falsas — útil para futuros debug. NO squashear.
- **Fecha detección + resolución:** 20 abr 2026 (sesión noche). HEAD final `8bc7f30`.

---

## ERR-24 — Wikipedia inadecuada como fuente de H2H masivo entre selecciones

- **Síntoma:** al construir la Fase D del IA Predictor (scrape_h2h tirando de `[País]_national_football_team_all-time_record` vía MediaWiki API), el smoke test devolvió `teams_with_section: 3`, `empty_wikitext: 31`, `missing_sections: 14`, `pairs_upserted: 37` sobre 1.128 pares teóricos. Cobertura ~3%.
- **Causas (concurrentes):**
  1. **Página `_all-time_record` no existe** para la mayoría de selecciones (~3 de 48). El resto redirige a `_records_and_statistics` o directamente no tienen página.
  2. **Encabezado `==Head-to-head record==` no es estándar.** Algunas páginas usan `== Head-to-head record ==` (con espacios), `Head-to-head records` (plural), `All-time record`, o estructuras totalmente distintas.
  3. **Formato de fila wikitext inconsistente** entre países. Unos usan ISO-3 en `{{fb|XXX}}`, otros usan nombre completo, otros usan subtablas por competición.
- **Fix aplicado:** abandonar Wikipedia para H2H y migrar a **11v11.com/stats** (Fase D.2). 11v11 sirve una tabla agregada P/W/D/L/GF/GA por rival en UN solo HTML consistente para las 48 selecciones mundialistas, con fuente subyacente RSSSF (incluye amistosos). Smoke test v2: `teams_parsed 48/48`, `pairs_upserted 815`, cobertura real ~72%. Ver commits `cba5dcc` (Wikipedia, deprecada) y `bbad657` (11v11.com, vigente). Fase D queda en historial como lección aprendida.
- **Patrón preventivo:** **antes de elegir una fuente para scraping masivo, validar formato en ≥5 muestras heterogéneas** (no solo en España y Argentina, por ejemplo). Si 1 de esas 5 tiene encabezado diferente o sección ausente, la fuente no es apta para scraping secuencial — buscar alternativa con formato uniforme garantizado (sites deportivos agregadores tipo 11v11, soccerway, transfermarkt, que mantienen templates consistentes).
- **Fecha detección:** 21 abr 2026 AM (smoke test Fase D v4).

---

## ERR-25 — 11v11.com devuelve 403 sin los 3 headers obligatorios

- **Síntoma:** `fetch()` a `www.11v11.com/teams/{slug}/tab/stats/` desde la EF Supabase devuelve **HTTP 403** pese a que la URL abre sin problema desde un navegador.
- **Causa:** 11v11 tiene anti-bot básico que exige tres headers simultáneamente. Faltar cualquiera devuelve 403:
  - `User-Agent`: string de Chrome real (ej. `Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36`). Un UA custom tipo `pm26-ia-predictor/1.0` no vale.
  - `Accept: text/html,application/xhtml+xml`.
  - `Accept-Language: en-US,en;q=0.9`.
- **Fix aplicado:** constante `fetchHeaders` top-level con los 3 headers en `handleScrapeH2h` (Fase D.2) y `handleScrapeLast5` (Fase C). Ver `supabase/functions/porra-ia-compute/index.ts`. Con los 3 → 200 OK con HTML ~33-46KB según endpoint.
- **Patrón preventivo:** si un endpoint devuelve 403 en servidor y 200 en navegador, el primer debug es copiar los 3 headers principales del navegador (UA + Accept + Accept-Language) al fetch del servidor. La mayoría del anti-bot básico se satisface con eso sin necesidad de proxy residencial ni Playwright.
- **Fecha detección:** 21 abr 2026 AM (descubrimiento Fase D.2 durante pruebas desde Supabase vía `net.http_get`).

---

## ERR-26 — `pg_net` no soporta HTTP PUT (bloqueador para merge PR vía GitHub API)

- **Síntoma:** intentar mergear un PR desde Supabase (ej. vía SQL + `net.http_post` contra `PUT /repos/:owner/:repo/pulls/:n/merge`) falla. `pg_net` no expone helper para PUT y forzar `POST` sobre el endpoint de merge devuelve `404 Not Found` o `405 Method Not Allowed`.
- **Causa:** [`pg_net`](https://github.com/supabase/pg_net) solo expone `net.http_get`, `net.http_post` y `net.http_delete`. La API de merge de GitHub requiere **PUT** (`PUT /repos/:owner/:repo/pulls/:pull_number/merge`). Sin PUT, no se puede completar el flow desde dentro de Postgres.
- **Workaround aplicado en Fase C:** tras code-review de la rama `claude/fase-c-last-n` vía `net.http_get` a `api.github.com/repos/:owner/:repo/contents/<path>?ref=<branch>`, se **desplegó la EF directamente** con el código del branch usando `deploy_edge_function` del MCP Supabase (evita el PUT de merge). El PR #15 se mantiene abierto hasta que se pueda mergear por otra vía (MCP GitHub reconectado, UI GitHub, o `gh` CLI si está disponible).
- **Patrón preventivo:**
  - Desde Supabase/SQL solo se puede leer/postear/borrar vía HTTP — para PUT/PATCH hay que salir a otro entorno (Claude Code con MCP GitHub, cliente `gh`, UI web, o EF en Deno que sí soporta todos los métodos).
  - Cuando el MCP GitHub esté disponible, mergear el PR pendiente como cierre. Si el despliegue previo ya subió el código, el merge es administrativo (ya está en producción).
- **Fecha detección:** 21 abr 2026 PM (durante cierre Fase C, con MCP GitHub desconectado y necesidad de desplegar la EF antes de que alguien tocase la rama).

---

## ERR-27 — `supabase-js` no enruta `from("vault.x")` al schema `vault`; `.schema("vault")` tampoco porque el schema no está expuesto vía PostgREST

- **Síntoma:** `freeze_snapshot` (y toda action que llame `requireAdminOrCron`) devuelve **401** incluso cuando el header `X-Cron-Key` es correcto. Root cause: `readVaultSecret` devuelve `null` silenciosamente → el compare vs el valor del Vault falla → el flow cae a `requireAuth` sin JWT → 401.
- **Causas en cascada (dos intentos fallidos antes del fix):**
  1. Código inicial: `supa.from("vault.decrypted_secrets").select(...)`. PostgREST interpreta `"vault.decrypted_secrets"` como **nombre literal de tabla** en el schema `public` (que no existe), no como `decrypted_secrets` en schema `vault`. Devuelve `null`/`error`, no rompe el 200 OK de la llamada genérica, y `readVaultSecret` cae al `return null`.
  2. Primer fix (`36ba6b3`): cambio a `supa.schema("vault").from("decrypted_secrets")`. `supabase-js` v2 sí soporta `.schema()` en Deno runtime. Pero **el schema `vault` no está expuesto en `api.schemas`** del proyecto Supabase, así que PostgREST responde `PGRST106 schema_not_exposed_via_api`. Mismo resultado: null, 401.
- **Fix aplicado (`a210598`):** tirar del RPC `get_vault_secrets(secret_names text[])` ya existente en el proyecto (creado y consumido por `porra-fix-encoding` v6) vía `fetch` directo a `/rest/v1/rpc/get_vault_secrets` con headers `apikey` + `Authorization: Bearer` (ambos = `SUPABASE_SERVICE_ROLE_KEY`). Cambio de firma: `readVaultSecret(supa, name)` → `readVaultSecret(supabaseUrl, serviceRoleKey, name)`. Body: `{"secret_names": [name]}`. Respuesta: array con objetos `{name, secret}` — se busca por nombre y se devuelve `.trim()` (patrón ERR-04).
- **Patrón preventivo:**
  - Para leer Vault secrets desde una Edge Function, **usar RPC público explícito** (`get_vault_secrets` o similar) en lugar de `.from(...)` o `.schema("vault").from(...)`. Solo exponer el schema `vault` vía `api.schemas` si realmente quieres pagar ese blast radius (todos los endpoints REST pueden entonces hablarle a `vault`).
  - Un auth path que depende de `readVaultSecret` debe **fail-loud al menos en dev/test**: añadir log warning cuando devuelve `null` para un secret que debería existir. Aquí el fallo silencioso retrasó el diagnóstico de 401 varios minutos.
  - EF secrets vs Vault: **EF secrets via `Deno.env.get(...)`** es el patrón del proyecto para API keys externas (`ANTHROPIC_API_KEY`, `FOOTBALL_DATA_API_KEY`). **Vault** es para secrets operacionales (tokens GitHub, cron keys, credenciales Twilio). No mezclar.
- **Fecha detección:** 21 abr 2026 noche (smoke tests post-deploy v7 → 401 en `freeze_snapshot` con X-Cron-Key correcto). Resuelto en v9 con RPC fix.

---

## ERR-28 — RLS sobre `ia_snapshots` bloqueaba bootstrap del frontend (policy `ia_snapshots_public_read_active` requerida)

- **Síntoma:** durante el bootstrap del frontend (Fase F del IA Predictor), `auth.js::loadIAPredictions` consulta `ia_snapshots.where(is_active=true)` para obtener el snapshot activo y luego cruzar con `ia_predictions`. La query devolvía array vacío desde el cliente Supabase aunque la fila existía en DB y era visible para `service_role`. <!-- TODO: confirmar con San si el síntoma exacto era array vacío silencioso vs error RLS explícito en la respuesta -->
- **Causa:** las 4 tablas `ia_*` se crearon con RLS enabled en la migración Fase A. `ia_predictions` recibió la policy `ia_predictions_public_read` que permite `SELECT` al rol consumido por el frontend. Pero `ia_snapshots` no recibió policy análoga en el mismo migration, por lo que cualquier cliente que no fuera `service_role` veía 0 filas (RLS deny-by-default). El frontend usa el cliente Supabase con la `anon`/`authenticated` key, no `service_role`.
- **Fix aplicado:** crear policy `ia_snapshots_public_read_active` que expone únicamente la fila con `is_active=true` al rol consumidor del frontend. <!-- TODO: confirmar con San si la policy aplica a `authenticated`, `anon`, o ambos, y la SQL exacta del USING clause (probablemente `USING (is_active = true)`) + commit donde se aplicó -->
- **Patrón preventivo:**
  - Al crear tablas con RLS enabled, definir las policies de `SELECT` para los roles consumidores **en el mismo migration** que crea la tabla. Olvidar la policy es equivalente a `DENY ALL` para clientes no-service_role.
  - Si una tabla expone solo una "fila activa" (singleton lógico — como `ia_snapshots` con invariante "1 activo"), la policy debe reflejarlo: `USING (is_active = true)` minimiza el blast radius vs `USING (true)`.
  - Smoke test obligatorio post-RLS: lanzar la query objetivo desde un cliente público (no `service_role`) antes de declarar la tabla "lista para frontend". Aquí el RLS mal configurado solo apareció al wiring de Fase F, no en las pruebas de Fase A.
- **Fecha detección:** ~21-24 abr 2026 (durante wiring frontend Fase F del IA Predictor, antes de cerrar la fase). <!-- TODO: confirmar fecha exacta y commit del fix con San -->

---

## ERR-29 — MCP `deploy_edge_function` rompe con payloads >70 KB (EFs con múltiples ficheros lib/)

- **Síntoma:** al intentar deployar `porra-ia-compute` v10 (6 ficheros: `index.ts` 36 KB + `lib/{predictor,repository,auth,quipGenerator,wc2026}.ts` ~35 KB; total 77 KB), el MCP `deploy_edge_function` devuelve `API Error: Stream idle timeout - partial response received` tras ~100-250 s **tanto desde Claude Code como desde Claude.ai** (dos superficies distintas con transportes MCP distintos). El primer intento directo en Code también falló, y dos sub-agentes dedicados (uno lean con el payload ya pre-dumpeado a `/tmp/deploy_files.json`) hicieron timeout a los 23 tool uses sin completar.
- **Causa:** el transporte MCP (al menos el que usan los dos clientes probados) no trocea/streamea bodies grandes al endpoint `/functions/v1/projects/{ref}/functions` de Supabase Management API. El pipe se satura antes de que Supabase acepte el body completo, devolviendo partial response. El límite empírico observado está por debajo de los ~77 KB totales de este deploy. Deploys previos de porra-ia-compute (v1-v9) cabían porque eran versiones más pequeñas o monofichero.
- **Fix aplicado:** San deployó v10 desde su máquina local con `npx supabase functions deploy porra-ia-compute --no-verify-jwt --project-ref cmyfyswystjgzdwbqyyb`. La CLI oficial sí trocea el upload correctamente y subió los 6 ficheros en un solo comando. Confirmado v10 ACTIVE con ezbr_sha256 nuevo, `verify_jwt=false` preservado, `compute_groups` reejecutado con éxito (72/72 filas upserted en 23.6 s, breakdown enriquecido con los 9 campos nuevos). Ver `CLAUDE.md` → "Stack infraestructura" y `migration-log.md` entry `[23-04-2026 POST-F COMMIT 1]`.
- **Patrón preventivo:**
  - **Para cambios en EFs con múltiples ficheros `lib/` (o cualquier EF cuyo payload total supere ~50 KB), el deploy va vía `supabase CLI` local, NO vía MCP**. La CLI es la fuente de verdad — los MCP son útiles para EFs pequeñas monofichero y para introspección (`list_edge_functions`, `get_edge_function`, `get_logs`).
  - Asume que cualquier EF que importa ≥3 ficheros internos va a exceder el límite tarde o temprano. Si el proyecto va a seguir creciendo (nuevos ficheros lib o dependencias), **define CLI como canal primario desde el principio** para evitar el descubrimiento ruidoso del blocker a mitad de sesión.
  - Workflow recomendado para San tras hacer cambios grandes a una EF: (1) Claude Code comitea el código al branch; (2) San hace `git pull` + `npx supabase functions deploy <name> --no-verify-jwt --project-ref <ref>`; (3) verificación vía `list_edge_functions` desde Code o Claude.ai.
  - El MCP `deploy_edge_function` sigue siendo el camino cómodo para monofichero; no lo deprecamos, sólo lo capamos por tamaño. Si falla con Stream idle timeout, NO reintentar en loop — saltar a CLI.
- **Fecha detección:** 23 abr 2026 noche (intento de deploy v10 tras Commit 1 de post-F; dos surfaces MCP fallaron idéntico). Resuelto vía `supabase CLI` en la misma sesión.

---

## ERR-30 — `mobile-locked` persiste tras Deshacer en focus mobile (✅ FIXED en PR #32, commit `1a7a9b9`)

- **Síntoma:** en mobile-focus de page-grupos, si el grupo está marcado como guardado (`window.groupSaved[letra] === true`) y el usuario abre el focus + pulsa Deshacer en una card, la card queda con la clase `mobile-locked`. La regla CSS `.card.mobile-locked .sbn, .card.mobile-locked .gsel, .card.mobile-locked .boost-row { pointer-events: none; opacity: 0.6 }` (`base.css:1155`) bloquea **todos** los botones interactivos (steppers ▲▼, goleador, boost-row) → la card queda inutilizable hasta navegar fuera y volver.
- **Causa:** `openMobileFocus` (`public/js/ui-groups-mobile.js:233`) llama a `lockCardsInFocus(letra)` cuando `groupSaved[letra]`. El handler de `btn-undo` en `public/js/scoring.js:1177-1192` ejecutaba `pred.saved = false` + `savePredictions()` y re-habilitaba `.sbn` con `disabled=false` pero **NO** llamaba a `unlockCardsInFocus(match.group)` ni reseteaba `window.groupSaved[match.group]`. Resultado: la regla CSS seguía aplicándose con datos stale en próximas aperturas del focus.
- **Fix aplicado** (`scoring.js`, handler `btn-undo`, tras re-habilitar steppers y antes de `savePredictions()`):
  ```js
  // ERR-30: re-habilitar interacción tras deshacer en focus mobile.
  if (window.groupSaved) delete window.groupSaved[match.group];
  if (typeof window.unlockCardsInFocus === 'function') window.unlockCardsInFocus(match.group);
  ```
  - **`delete` (no `= false`):** coherente con patrón canónico en `unsaveGroup` (`ui-groups-mobile.js:524`) y error-rollback (línea 509). Funcionalmente equivalente para checks `if (window.groupSaved[letra])` (ambos falsy).
  - **`unlockCardsInFocus` null-safe:** `ui-groups-mobile.js:552` hace `if (!body) return` — no-op si no hay focus mobile abierto.
- **Deuda aceptada — gap BD sync:** el handler NO sincroniza con `league_members.groups_saved` en BD. Tras reload, `loadUserData` rehidrata `window.groupSaved` desde BD y el bug puede reaparecer si `groups_saved.A=true` persiste en BD aunque la card individual ya tenga `predictions[X].saved=false`. El fix arregla el caso principal "deshacer + abrir focus de nuevo en la misma sesión"; el caso post-reload es edge raro (user cierra app entre Deshacer y nuevo focus). F7.4-F rediseñará el flujo entero. Si aparece regresión real se eleva a ERR-30b con BD sync.
- **Patrón preventivo:**
  - Handlers que mutan estado individual de un item dentro de un grupo "saved" deben invalidar el flag de grupo (`groupSaved[letra]`) para mantener consistencia con la lógica de locking visual.
  - `unlockCardsInFocus(letra)` puede invocarse defensivamente desde cualquier handler que cambie estado de cards — el guard `if (!body) return` evita errores cuando no hay focus mobile abierto.
- **Verificación de pre-existencia (smoke F7.4-D-1):** scoring.js MD5 idéntico main pre-F7.4-D-1 vs post-F7.4-D-1, `lockCardsInFocus` callsites iguales, reproducido en producción `porramundial2026-seven.vercel.app` antes del fix.
- **Fecha detección:** 27 abr 2026 (smoke F7.4-D-1). **Fecha fix:** 27 abr 2026 (PR #32 mini-PR aparte, commit `1a7a9b9`).

---

## ERR-31 — `btnRow` residual tras Deshacer

- **Síntoma:** en cualquier card guardada (no solo dentro de mobile-focus), pulsar Deshacer hace que el `btnRow` mantenga el HTML "✓ Guardado + ↩ Deshacer" en vez de regresar al botón "Guardar" original. La interfaz sigue mostrando el row de "guardado" aunque el dato ya está en estado borrador (`pred.saved=false`).
- **Causa:** el handler `btn-undo` en `public/js/scoring.js:1177-1192` ejecuta `pred.l/v/gol=null` + `pred.saved=false` + `savePredictions()` + `updateCardUI` + `renderGroupTableCard` + `updateGlobalPoints` + `checkGroupsComplete` (el fix de ERR-30 añadió `delete groupSaved` + `unlockCardsInFocus`), pero **NO** restaura `btnRow.innerHTML` al estado pre-saved. La interfaz no se entera del cambio de estado del row de botones.
- **Fix candidato:** tras `pred.saved = false`, restaurar `btnRow.innerHTML` con el HTML del botón Guardar original, o invocar la función que renderiza el row inicial (probablemente `_buildSaveBtnRow` o equivalente — auditar). Acoplar al fix de ERR-30 sería natural si se reabriera; alternativa: nuevo mini-PR aparte.
- **Verificación de pre-existencia:** misma lógica de auditoría que ERR-30/32 (scoring.js MD5 idéntico main pre-F7.4-D-1 vs post-F7.4-D-1). Reproducido en producción `porramundial2026-seven.vercel.app`.
- **Estado:** documentado, NO arreglado. Cosmético — no bloquea uso, solo confunde visualmente al usuario porque el row sigue mostrando "Guardado". Prioridad menor que ERR-30 (que sí bloqueaba interacción) y ERR-32 (que rompía el toggle del boost).
- **Fecha detección:** 27 abr 2026 (smoke F7.4-D-1).

---

## ERR-32 — Boost check desincronizado con `boostPicks` en focus mobile (✅ FIXED en PR #33)

- **Síntoma:** en mobile-focus de page-grupos, una card podía mostrar `chk.checked=true` (input boost marcado) mientras la card NO tenía clase `boost-active` (apagada visualmente) ni `boostPicks[date]` lo respaldaba. Estado capturado en smoke ERR-30: `boostPicks={}` vacío, `localStorage.boostPicks_default` con 16 entradas pero ninguna del día del partido, card sin `boost-active`, `chk.checked=true` residual sin razón. Al pulsar la boost-row, la card se encendía pero el check seguía marcado igual que antes (sin reflejar el toggle correctamente).
- **Causa:** `attachEvents` (`scoring.js`) lee `boostPicks` y marca `chk.checked` al renderizar inicialmente la card. Algún flow posterior (loadUserData sin sesión, deshacer guardado, race con `saveBoostPicks`) limpia `boostPicks` SIN tocar el DOM del chk → estado residual donde el check queda marcado pero sin coherencia visual ni con el modelo. `refreshBoostRowsInFocus` (`ui-groups-mobile.js:601`) solo gestionaba `.boost-blocked` y NO reconciliaba `chk.checked`, `boost-active`, `boost-on` con `boostPicks`.
  - Click en boost-row: `__mobileBoostRowClickHandler` (capture phase) intercepta con `stopImmediatePropagation()` + `preventDefault()` → bloquea el cambio nativo del check. Llama a `tickerBoostToggle(matchKey, date)`. Como `boostPicks[date] === undefined`, entra en rama ELSE (ACTIVAR), marca `chk.checked=true` (ya estaba) y añade `boost-active`. Resultado: tarjeta enciende, check sigue marcado igual.
- **Fix aplicado** (`refreshBoostRowsInFocus` en `ui-groups-mobile.js:622`, dentro del forEach de rows, ANTES de la lógica `boost-blocked` existente):
  ```js
  const chk = card.querySelector('.boost-chk');
  const isThisMatch = boostedKey === matchKey;
  if (chk) {
    chk.checked = isThisMatch;
    chk.disabled = !!(boostedKey && !isThisMatch);
  }
  if (isThisMatch) {
    card.classList.add('boost-active');
    row.classList.add('boost-on');
  } else {
    card.classList.remove('boost-active');
    row.classList.remove('boost-on');
  }
  ```
  La función ya se invoca tras `openMobileFocus(letra)` (línea 237) y tras `tickerBoostToggle` desde el handler delegado (línea 669), por lo que la reconciliación corre en cada momento donde el state visual y `boostPicks` deben coincidir.
- **Patrón preventivo (single source of truth):**
  - `boostPicks` es **la fuente de verdad por diseño** (se persiste a `localStorage.boostPicks_default` y a BD vía `saveBoostPicks`). Cualquier discrepancia entre el DOM (`chk.checked`, `.boost-active`, `.boost-on`) y `boostPicks` es un bug, no un estado intencional.
  - Al añadir nuevos handlers que muten `boostPicks`, asegurar que se invoca `refreshBoostRowsInFocus` después (o equivalente para vista no-focus) para reconciliar el DOM. NO mutar el DOM en paralelo a `boostPicks` desde varios sitios.
  - `chk.disabled = !!(boostedKey && !isThisMatch)` reproduce la lógica de `attachEvents` (`scoring.js`): el check está disabled si hay boost del día asignado a OTRA card. Mantener simétrico al render inicial.
- **Follow-up (mismo PR #33):** smoke parcial OK tras el fix inicial, pero quedaba un caso edge cuando el dedo impactaba directamente el `<input class="boost-chk">` (no la `<span class="boost-txt">`). Trace con interceptor del setter `chk.checked` confirmó que la default action del checkbox nativo invertía `chk` DESPUÉS de los syncs síncronos (no pasa por el setter JS, no aparece en interceptores). El `e.preventDefault()` en capture phase del body NO cancela el toggle nativo cuando el target es el input directo (quirk de `<label for=...>` + checkbox). Fix: 1 línea adicional en `__mobileBoostRowClickHandler` (post `renderBoostTicker()`): `setTimeout(refreshBoostRowsInFocus, 0);`. La reconciliación diferida corre en next tick, después de la default action del navegador, garantizando coherencia final.
- **Verificación de pre-existencia (smoke F7.4-D-1):** reproducido en producción `porramundial2026-seven.vercel.app` antes del fix con el mismo síntoma.
- **Fecha detección:** 27 abr 2026 (smoke F7.4-D-1). **Fecha fix:** 27 abr 2026 (PR #33 mini-PR aparte, fix inicial + follow-up para click en input directo).

---

## ERR-33 — `REVOKE FROM PUBLIC` en función usada por RLS rompe `authenticated`

- **Síntoma:** tras aplicar `REVOKE EXECUTE ... FROM PUBLIC` + `GRANT TO service_role` siguiendo el advisor de Supabase, los `INSERT`/`UPDATE` de usuarios `authenticated` en una tabla con RLS empiezan a fallar con error `42501 permission denied for function <fn>`.
- **Causa:** la función está invocada desde el bloque `USING` o `WITH CHECK` de una policy. Cuando `authenticated` intenta operar sobre la tabla, Postgres evalúa la policy con los permisos del rol activo. Sin `EXECUTE` para `authenticated`/`PUBLIC`, la evaluación falla. `SECURITY DEFINER` no salva la situación porque el filtro de grants se aplica antes de la elevación.
- **Fix aplicado:** mantener `GRANT EXECUTE TO PUBLIC` (o al menos a `authenticated`). La protección real ya viene de `SECURITY DEFINER` + lógica interna de filtrado por `user_id` dentro del cuerpo de la función. Sobre `is_porra_abierta(uuid, uuid)` solo se aplicó `SET search_path = public, pg_temp`, dejando los grants intactos.
- **Patrón preventivo:** verificación previa antes de aplicar el patrón "función de control" del advisor:
  ```sql
  SELECT schemaname, tablename, policyname FROM pg_policies
  WHERE qual LIKE '%<funcname>%' OR with_check LIKE '%<funcname>%';
  ```
  Si devuelve filas → **NO** revocar de `PUBLIC`. Aplicar solo `SET search_path = public, pg_temp`.
- **Caso conocido:** `is_porra_abierta(uuid, uuid)` en sesión audit Postgres 28abr2026 — usada en 8 policies (`predictions`/`ko_predictions`/`award_picks`/`boost_picks` × INSERT/UPDATE).
- **Fecha detección:** 28 abr 2026 (sesión audit Postgres, atajado pre-apply gracias a verificación de Claude.ai vía MCP).

---

## ERR-34 — `seed_ia_user` race condition: auth.users creado pero INSERT a profiles falla

- **Síntoma:** primera invocación de `seed_ia_user` action en EF `porra-ia-compute` v11 (rid 1778, F7.7-IA C1+C2) responde con HTTP 500 internal error. Inspección DB: el usuario fue creado en `auth.users` (id `17ab3b59-...`) pero NO existe entry correspondiente en `profiles` (FK target).
- **Causa:** race condition entre el `auth.admin.createUser({ email, password })` y el INSERT a `profiles`. El trigger automático de Supabase que replica auth.users → profiles aún no había completado cuando la EF ejecutó el INSERT manual a profiles. La FK `profiles.id → auth.users.id` ya existía pero el trigger interno tarda algunos ms en correr → segundo INSERT con el mismo id colisiona.
- **Fix aplicado (recovery):** INSERT manual idempotente en `profiles` + `league_members` desde SQL editor:
  ```sql
  INSERT INTO profiles (id, nombre, is_admin, is_bot)
  VALUES ('17ab3b59-...', 'IA Zayu', false, true)
  ON CONFLICT (id) DO NOTHING;
  ```
  Bot quedó funcional sin re-deploy de EF.
- **Pendiente (deuda):** retry/backoff en la propia EF — esperar 200ms tras `auth.admin.createUser` antes del INSERT a profiles, o usar `getUserById` con polling hasta confirmar que el trigger replicó. No urgente porque el seed es operación one-shot manual.
- **Fecha detección:** 04 may 2026 (F7.7-IA C1+C2, primera ejecución `seed_ia_user`).

---

## ERR-35 — Stale querySelector tras refactor de clase CSS

- **Síntoma:** tras editar pronóstico en modal de Grupos + pulsar Deshacer + cerrar modal, la compact card en el carrusel sigue mostrando el marcador y goleador anteriores. El estado limpio NO se refleja aunque `predictions[matchKey]` ya está mutado a empty.
- **Causa:** en commit `98f4550` del Sprint B se dropeó la clase `.fc-grupos-mini` de la compact card (rompía el `:hover` original de `.ko-card`). El listener de `jcard:updated` en `ui-groups.js` seguía buscando esa clase obsoleta:
  ```js
  document.querySelector('.fc-grupos-mini[data-match-key="' + mk + '"]')  // → null
  ```
  El `replaceWith(fresh)` nunca corría → preview congelado en el render anterior. Todo lo demás del flow (Deshacer, savePredictions, jcard:updated dispatch, pred lectura fresca) funcionaba correctamente.
- **Fix aplicado (commit `8cad0d3`):** actualizar selector a `.fc-grupos-carousel .ko-card[data-match-key="..."]`. Scope a `.fc-grupos-carousel` evita matching accidental con KO cards de Fase Final si compartieran attr.
- **Patrón preventivo:** cuando se rename/drop de clase CSS, **grep TODOS los selectores en JS** antes del commit:
  ```bash
  # Buscar uso de la clase en cualquier selector JS
  grep -rn "\.fc-grupos-mini" public/js/ js/
  # También en MutationObserver, classList, matches, closest
  grep -rn "fc-grupos-mini" public/js/ js/
  ```
  Si hay matches → renombrar/actualizar antes de eliminar la clase del HTML. Aplica también a `data-*` attributes y IDs.
- **Fecha detección:** 05 may 2026 (Sprint B Grupos redesign — bug post-merge oleadas de clases).

---

## ERR-36 — `.container` legacy padding rompe paridad de pages

- **Síntoma:** la pantalla Grupos se ve visualmente más estrecha que Fase Final (cards 287px vs 343-347px de Fase Final). Cards comprimidas y carrusel scroll-snap con slots desbordando lateralmente. Discrepancia de ~64px no atribuible a margins de la propia card.
- **Causa:** `ko.css:55` define `.container { max-width: 1440px; margin: 0 auto; padding: 0 20px 60px }` que aplica como wrapper global. `#page-grupos` está envuelto en `<div class="container">` (legacy de la migración Vite) → consume 40px lateral (20×2) que `#page-elim` NO sufre porque está top-level (sin wrapper).
  ```
  Cadena medida con DOM inspector:
    body padding 32 (16×2)
  + .container padding 40 (20×2)   ← legacy wrapper
  + #groups-container 24 (12×2)    ← padding propio del list
  + .fc-grupos-expanded border 2
  = 98px perdidos
  Viewport 375 - 98 = 277px (ancho real medido en screenshot 287×340)
  ```
- **Fix aplicado (commit `b66aea9`):** override scoped que neutraliza el padding legacy solo para Grupos:
  ```css
  #page-grupos > .container {
    padding-left: 0;
    padding-right: 0;
  }
  ```
  El padding lateral lo provee ahora `#groups-container { padding: 0 12px 80px }` (réplica exacta de `.fc-elim-list`).
- **Patrón preventivo:** verificar en futuras pages nuevas si dependen del wrapper `.container` o están top-level. Si dependen, el padding lateral 40px aplicará automáticamente y romperá la paridad visual con Fase Final. Para pages nuevas con scroll-snap carousels o layouts width-sensitive, **usar el mismo override scoped** o mover la page a top-level.
- **Caso conocido:** `#page-grupos` en Sprint B. `#page-elim` está top-level (correcto). `#page-jornada`, `#page-directo`, `#page-predictor` requieren auditoría para confirmar paridad.
- **Fecha detección:** 05 may 2026 (Sprint B Grupos redesign — root cause encontrada por San con DOM inspector + getComputedStyle).

---

## ERR-37 — Scroll-snap carousel anidado en container colapsable → overflow

- **Síntoma:** carrusel con slots `width: 86vw` (~322px) renderizado dentro de un container colapsable (.fc-grupos-card > .collap-body) consume el ancho disponible vía margins + padding internos. Slots desbordan o se comprimen visualmente. Compact cards "cortadas" al lado derecho del viewport.
- **Causa:** anidamiento crea overhead de padding:
  ```
  .fc-grupos-card { margin: 0 14px 10px; border: 1px solid }     → 30px
  .fc-grupos-card .collap-body                                    → 0
  .fc-grupos-card .collap-body-inner { padding-toggle 14px×2 }    → 28px
  .fc-grupos-card border ×2                                        → 2px
  Total consumido: ~60-100px
  Carousel ancho útil: viewport - body - container - card overhead ≈ 249px
  Slot pedía: 322px → overflow → compresión visual
  ```
- **Fix aplicado (commit `05f5dd4` + `2d8aec8`):** replicar patrón de Fase Final donde `.fc-elim-expanded` vive como **SIBLING** del `.fc-elim-row`, no como hijo. La card del grupo solo contiene el header (toggle + banderas + dado), y al hacer click se inserta un `<section class="fc-grupos-expanded">` después de la card via `parentNode.insertBefore(expanded, sectionEl.nextSibling)`. El padding lateral lo da el container padre (`#groups-container { padding: 0 12px 80px }`), NO la card individual. La card y el expanded ambos ocupan `width: 100%` del container.
  ```js
  // Patrón correcto (commit 05f5dd4 _toggleGruposExpanded):
  if (sectionEl.parentNode) {
    sectionEl.parentNode.insertBefore(expanded, sectionEl.nextSibling);
  }
  ```
- **Patrón preventivo:** scroll-snap carousels con slots ≥80vw NO deben anidarse dentro de containers colapsables con padding interno. Modelo correcto: el carousel/expanded como hermano del header. Si necesitas hidden source elements (e.g. tarjetas editables que el modal extrae), pueden vivir dentro del card via `display: none !important` scoped, pero el carousel como sibling.
- **Caso conocido:** Sprint B Grupos redesign — primera iteración (commits `26d2658` → `1d35651`) anidaba el carousel dentro de `.collap-body-inner`, refactorizada en `05f5dd4` a sibling pattern.
- **Fecha detección:** 05 may 2026 (Sprint B Grupos redesign — root cause encontrada por San con DOM inspector tras varias iteraciones de fix superficiales).

---

## ERR-38 — globe.gl@2.33.0 · API surface clave (factory + controls + atmosphere)

- **Síntoma:** `TypeError: X is not a function` o la app falla al inicializar el globo. Métodos alucinados por LLMs (DeepSeek caso documentado en intentos previos al PR#54): `graticuleLabels()`, `rendererConfig().chain()`, `autoRotate()`, `zoom()`, `minZoom()`, `maxZoom()`. Otra variante: `Globe is not a constructor` al invocar con `new Globe()`.
- **Causa:** la API de `globe.gl@2.33.0` NO incluye esos métodos. La librería usa **factory pattern** (`Globe()` sin `new`) y expone los controles vía `globe.controls()` (devuelve la instancia de Three.js OrbitControls, sobre la que se setean propiedades — no hay setters fluent en el chain del globo). La atmósfera se configura con un color HEX puro; pasar `rgba(...)` con alpha rompe `THREE.Color`.
- **Patrón correcto:**
  ```js
  // Factory + attach a un DOM node:
  const globe = Globe();
  globe(domNode);

  // Configuración fluent del globo:
  globe.atmosphereColor('#7eb6d8')   // HEX puro, NO rgba con alpha
       .atmosphereAltitude(0.10)
       .showGraticules(false);

  // Controles via método separado:
  const ctrl = globe.controls();
  if (ctrl) {                         // defensivo: en algunas builds devuelve undefined
    ctrl.autoRotate = true;
    ctrl.autoRotateSpeed = 0.4;
    ctrl.enableZoom = true;
  }

  // Cámara:
  globe.pointOfView({ lat: 20, lng: 0, altitude: 4.2 });
  ```
- **Fix aplicado:** PR #54 (`8e6681c`, sprint Globo MVP) implementa `ui-globo-equipos.js` siguiendo el patrón canónico, validado contra `docs/globo-mundial-2026-REFERENCIA.html` que San curó con la API 2.33.0 ya verificada en su local.
- **Patrón preventivo:** cuando una librería esté **pinneada** a una versión específica, leer la API en `unpkg.com/<lib>@<version>/` (browse del paquete tal cual fue publicado) o el README de esa versión exacta en GitHub releases. **NO fiarse del README del default branch** del repo de la librería: puede corresponder a una versión más reciente con APIs distintas o a un próximo major. Cuando un LLM inventa métodos, contrastar con el ejemplo canónico de la versión pinneada antes de implementar.
- **Caso conocido:** dos sprints previos rotos (intentos pre-PR#54) por inventar `graticuleLabels()`, encadenar `rendererConfig().chain()`, llamar `globe.autoRotate(true)` (no existe — hay que ir vía `globe.controls()`). El HTML referencia que San subió a `docs/globo-mundial-2026-REFERENCIA.html` (commit `0edd40e`) sirve como fuente de verdad para la API 2.33.0.
- **Fecha detección:** 06 may 2026 (Sprint Globo MVP — patrón cristalizado tras dos iteraciones rotas previas).

## ERR-39 — ESPN scraping con regex non-greedy corta frases con comillas anidadas

- **Síntoma:** en `wiki-bio.js` v2 generado por scraper ESPN, frases con comillas dobles internas quedaban truncadas en la primera comilla cerrada. Ejemplo Alemania: `frase: "Presionar alto, dejar que los"` (truncada). Bio_espn arrancaba con basura post-truncamiento (`"números 10\" creen". Julian...`).
- **Causa:** regex `/"(.+?)"/` (non-greedy) en el parser tomaba la primera comilla cerrada disponible, ignorando que la frase completa tenía comillas anidadas tipo `"Presionar alto, dejar que los \"números 10\" creen"`.
- **Fix:** v3 con regex greedy `/"(.+)"/` desde la primera `"` hasta la última `"` opcionalmente seguida de `[.?!]`. La greediness es segura porque el campo `frase:` está en una línea propia y solo tiene un par de comillas externas.
- **Patrón preventivo:** para campos JSON con strings que pueden contener delimitadores anidados, preferir regex greedy + ancla (final-de-línea, comilla final + delimitador `,` o `}`). Validación post-scrape: contar pares de `"` en cada frase y reportar entradas impares.
- **Fix aplicado:** `wiki-bio v3` (commit `010b189` en `feature/globo-pr2-pr3`).
- **Fecha detección:** 06 may 2026 (Sprint Globo Polish v2 — al revisar Alemania en QA mobile).

## ERR-40 — ESPN HTML inserta espacios falsos tras vocales con tilde

- **Síntoma:** `wiki-bio.js` v2 mostraba `"Bajo la dirección del exdelantero del Barcelona Thomas Christiansen, Panam á ha evolucionado..."` con un espacio espurio entre `m` y `á` que parte la palabra `Panamá`. Mismo patrón potencial en `Núñez`, `Ramón`, `Sánchez`, etc.
- **Causa:** el HTML de origen de ESPN inyecta un `<span>` o un `&nbsp;` invisible alrededor de ciertos caracteres UTF-8 multibyte (ñ, á, é, í, ó, ú, Ñ, Á…) durante el rendering server-side. Al hacer `.text` o `.get_text()` ingenuo, esos wrappers convierten en espacio normal y la palabra queda partida.
- **Fix:** `clean_html` que normaliza con regex `re.sub(r'([áéíóúÁÉÍÓÚñÑ])\s+(\w)', r'\1\2', text)` — colapsa "letra-acentuada + espacio + letra" en "letra-acentuada + letra". La regex es defensiva: solo aplica si el espacio sigue inmediatamente a una vocal acentuada y va seguido de otro carácter de palabra.
- **Patrón preventivo:** post-scrape, validar con `assert "Panam á" not in bio` y similares para entradas conocidas. Otra opción: parsear con `BeautifulSoup` y `.get_text(separator='', strip=False)` para que no inserte separadores artificiales entre nodos.
- **Fix aplicado:** `wiki-bio v3` (commit `010b189`).
- **Fecha detección:** 06 may 2026 (Sprint Globo Polish v2 — al revisar Panamá en QA).

## ERR-41 — Pill flex hijo en flex column hereda align-items:stretch → ancho completo

- **Síntoma:** el chip `.fc-globo-detail__pill-formacion` se estiraba al 100% del ancho del header del panel, dejando aire vacío a los lados del texto `Formación: 4-3-3`.
- **Causa:** el contenedor `.fc-globo-detail__hdr` tenía `display:flex; flex-direction:column`, y `align-items` por defecto es `stretch` en flex containers. Por tanto cualquier hijo (incluyendo `<span>` con `display:inline-flex` o `inline-block`) se estiraba al ancho del cross-axis.
- **Fix doble:**
  1. `align-items: flex-start` en `.fc-globo-detail__hdr` → cancela el stretch para todos los hijos.
  2. `width: auto; max-width: max-content; flex: 0 0 auto; align-self: flex-start` en la propia pill → safeguard si algún ancestro futuro vuelve a forzar stretch.
- **Patrón preventivo:** cuando un hijo de flex column debe ajustar su ancho al contenido (típico en pills, badges, chips), aplicar `align-self: flex-start` en el hijo o `align-items: flex-start` en el padre. La 2ª opción afecta a TODOS los hijos; la 1ª es scoped al hijo concreto.
- **Fix aplicado:** commit `6d058b2` en `feature/globo-pr2-pr3`.
- **Fecha detección:** 06 may 2026 (Sprint Globo Polish v2 — al inspeccionar el panel en localhost).

## ERR-42 — Cuadro de Honor invisible tras F7.4-F (cajas 2+3 huérfanas en `#view-cinematic` legacy)

- **Síntoma:** en la pestaña Fase Final no aparecían el bloque Campeón ni el Podio (puestos 2/3/4) bajo la fila "F · Final". Caja 4 (Awards) sí estaba accesible vía botón "Premios" del header.
- **Causa:** la migración F7.4-F al nuevo App Shell `fc-elim-list` solo trasladó la Caja 4 al nuevo `#fc-elim-awards-pane`. Las Cajas 2 (Campeón) y 3 (Podio) seguían siendo emitidas por `buildFinalSection` en `ko.js`, que rendea dentro de `#view-cinematic` (el panel legacy ahora con `display:none`, ancho/altura 0). Diagnosticado vía Chrome MCP DOM inspection: `panels[0]=view-cinematic` activo pero invisible; `row2` con `final-box4 + final-box3` existían pero no llegaban al usuario.
- **Fix aplicado:**
  1. Nueva función pública `window.buildChampionPodium(matchFinal)` en `ko.js` (insertada justo antes de `buildFinalSection` sin tocar la original) que devuelve un único bloque DOM con cajas 2+3 apiladas mobile-first.
  2. Hook en `ui-elim-shell.js#_renderList`: tras procesar la fila `r.key === 'final'` invoca `window.buildChampionPodium(BRACKET.final[0])` y `appendChild` al mount, **siempre visible** (no condicional a expanded ni locked).
- **Patrón preventivo:** al migrar arquitectura UI legacy → nueva, hacer auditoría DOM completa con Chrome MCP de todos los paneles del componente origen (no solo el visible). Si un panel queda en `display:none` pero su lógica sigue ejecutándose, los outputs son fantasma. Validar visualmente cada caja del componente legacy antes de marcar la migración como completa.
- **Fix aplicado:** commits `533ec15` en `claude/pizarra-tactica-modal-kmTEw`.
- **Fecha detección:** 08 may 2026 (Sprint Cuadro Honor Restore — diagnóstico Chrome MCP).

## ERR-43 — Overlay / sub-overlay con `pointer-events` no gateado por `.is-open`

- **Síntoma:** tras la 1ª apertura+cierre de un overlay v3 (modal zoom o sub-overlay tipo squad picker), la página queda bloqueada — clicks en cualquier zona del viewport no responden. Los handlers de otros pickers, botones close del modal padre, tabs, e incluso el backdrop oscuro dejan de funcionar.
- **Causa raíz:** la regla CSS base de `.X-overlay-panel__inner` tenía `pointer-events: auto` sin scope a `.X-overlay.is-open ~`. Aunque `opacity: 0` y la animación oculta visualmente el panel, **el inner sigue ocupando fullscreen** (via `position: fixed; inset: 0` heredado del wrapper panel) **y captura todos los clicks** porque pointer-events lo permite. Solo se manifiesta tras la 1ª apertura porque `inner.innerHTML` está vacío antes y no hay descendientes que interceptar; tras renderizar la lista (e.g. squad players), los hijos quedan en DOM y consumen los pointer events.
- **Confirmación runtime:** `document.elementFromPoint(window.innerWidth/2, window.innerHeight/2)` post-cierre devuelve un descendiente del overlay invisible (e.g. `.v3-squad-picker-player__name`), no el `body` o page activo.
- **Fix:**
  1. `.X-overlay-panel__inner { pointer-events: none; }` por default.
  2. `.X-overlay.is-open ~ .X-overlay-panel .X-overlay-panel__inner { pointer-events: auto; }` — solo cuando `.is-open` activo (mismo selector sibling que ya gateaba `opacity`).
  3. JS defensivo: tras `overlay.classList.remove('is-open')`, hacer `inner.innerHTML = ''` para garantizar que no quedan hijos clicables en DOM (belt + suspenders).
- **Patrón preventivo:** cualquier overlay/sub-overlay con pattern `fixed inset:0 + opacity-gated visibility` debe gatear **también** `pointer-events` por la misma clase `.is-open`. Verificar el zoom-overlay del modal principal (mundial-shell-v3.css L355) como referencia canónica de gating correcto.
- **Test post-fix obligatorio:** tras cerrar el overlay programáticamente, click en OTRO elemento de la página (modal padre, tab adyacente, botón close, backdrop) — verificar que el handler responde. Single-event tests NO capturan este bug. Ver patrón E14 en `CLAUDE.md`.
- **Fix aplicado:** commit `5b87645` en `claude/port-world-cup-design-FvZpD` (F2.8.2). Afectado: `.v3-squad-picker-panel__inner` del sub-overlay del goleador picker.
- **Fecha detección:** 14 may 2026 (sandbox v3-pages-smoke, F2.8.1 → F2.8.2 — diagnóstico Chrome MCP runtime de San).

## ERR-44 — Simuladores legacy KO escriben classifier="home"|"away" literal

- **Síntoma:** En el bracket v3 aparece texto `home` o `away` literal en lugar del nombre del equipo ganador en cards KO con empate (visible en QF/SF cuando hay penaltis simulados).
- **Causa:** `diceSimulateKOMatch()` en `admin.js` y `v3SimulateDice()` en `eliminatoria-v3.js`, en lugar de resolver el equipo ganador en penaltis, escriben directamente `pred.classifier = "home"` o `"away"` (la cadena literal, no el nombre del equipo). `resolveKO()` en `ko.js` entonces hace `resolvedSlots['W'+id] = pred.classifier` → bracket v3 renderiza el texto literal `"away"` como label del slot.
- **Fix aplicado:** HF-09 (commit `66db0fe`, 16-may) — blindaje defensivo en `resolveKO()` bloque empate: si `classifier === 'home'` → `hTeam`; `'away'` → `aTeam`; otros valores (nombres reales) → tal cual. Cubre predicciones pasadas y futuras sin tocar simuladores legacy.
- **Patrón preventivo:** validar OUTPUT semántico en consumer cuando datos vienen de fuentes heterogéneas (simuladores legacy + prediccions UI). Resolver en el punto de consumo, no asumir que todos los productores siguen el mismo contrato.
- **Pendiente:** corregir los simuladores en origen (escribir nombre de equipo, no `"home"`/`"away"`) en sprint futuro.
- **Fecha detección:** 16 may 2026 (smoke HF-08, sesión sprint F3-I1.6.x + KO bracket).

## ERR-45 — `data-user-mount` fantasma en fifa-bar v3 interceptado por `renderAuthBar`

- **Síntoma:** Avatar "C" + nombre + botón "Cerrar sesión" reaparecen tras unos segundos en la fifa-bar del shell v3, pese a defensas activas (`F3-I1.6.2` CSS `body.fc-shell-active #wc-auth-bar { display: none !important }` y `F3-I1.6.4` JS toggle defensivo en `refreshShellUserChips`). Vuelve a aparecer tras login state change, refresh de leagues, o cualquier re-render del shell.
- **Causa:** Las defensas apuntaban al elemento equivocado. `#wc-auth-bar` legacy del welcome estaba bien oculto en SHELL_PAGES, pero `mundial-shell-v3.js:67` tenía un mount NUEVO dentro de la fifa-bar:
  ```html
  <div class="v3-fifa-bar__user" data-user-mount></div>
  ```
  Y `renderAuthBar()` en `auth.js:225-235` busca **todos** los `[data-user-mount]` del DOM con `document.querySelectorAll` y les inyecta `adminBtn + wc-user-badge` (avatar + nombre + "Cerrar sesión"). El mount fantasma se recreaba en cada re-render del shell y se llenaba en cada llamada a `renderAuthBar()`.
- **Fix aplicado:** HF-13 (commit `5d07913`, 16-may) — eliminar la línea 67 del shell-v3 entera. Los chips ⚙ ADMIN + ↩ del stage-row F3-I1.6 ya cubren ADMIN + logout en el shell. Avatar + nombre San decidió quitarlos (duplicaban funcionalidad sin valor añadido).
- **Patrón preventivo:** cuando un bug visual persiste pese a defensas, **buscar TODOS los mount points relacionados** en el repo, no solo el sospechoso obvio. Greps útiles: `data-user-mount`, `wc-user-badge`, `do-logout`, etc. Usar Chrome MCP DOM inspection en runtime para verificar qué elemento realmente vive en pantalla. F1.1f-v3 había añadido el mount como bridge transitorio mientras los chips no existían en el shell — debe limpiarse cuando el bridge ya no es necesario.
- **Lección sister:** los comentarios de la función relevante (`renderAuthBar` en `auth.js:217-220`) ya advertían explícitamente "F4 cleanup elimina los 3 viejos" — leer comentarios de código antes de bordear el síntoma con defensas paralelas.
- **Fecha detección:** 16 may 2026 (smoke HF-12, root cause encontrado tras 2 intentos fallidos en F3-I1.6.2 y F3-I1.6.4).

## ERR-46 — HTML entities centroeuropeas/turcas no decodificadas con tabla manual

- **Síntoma:** roster BIH en BD con nombres tipo `Sead Kola&scaron;inac`, `Ivan &Scaron;unjić`, `Ivan Ba&scaron;ić`. El matcher posterior comparaba `Kolašinac` del XI scrape (alt= UTF-8 directo) contra la entidad cruda del roster → 9/11 matches en vez de 11/11. Para TUR, CRO, CZE: entidades equivalentes (`&cacute; &dstrok; &rcaron; &gbreve; &Lstrok;` etc., ~28 entidades faltantes).
- **Causa:** `scripts/lib/ff-scraper.mjs` tenía una tabla manual `HTML_ENTITIES` con ~70 entradas (Latin-1 + escandinavas + tipográficas). No cubría eslavo-sur, eslavo-occidental ni turco. Cada vez que aparecía un idioma nuevo había que parchear la tabla — frágil por construcción.
- **Fix aplicado:** sustituir tabla manual + función `decodeHtmlEntities()` por el paquete NPM `html-entities` v2.6+ que cubre HTML5 completo (~2000 entidades). Wrapper `decodeHtml(s) = decode(s) + normalización ASCII tipográficas` para preservar idempotencia (ver ERR-49). Commit `0d51fa4` (16-may, sprint sync-squads).
- **Patrón preventivo:** para parsers de fuentes HTML, **usar lib oficial maintained**, no tabla manual. Si la fuente añade un idioma nuevo, la lib ya lo cubre sin patches.
- **Fecha detección:** 16 may 2026 (round 6 del sprint sync-squads, revisando los 48 países antes de extender ejecución).

## ERR-47 — `--refresh-final` pisaba enrichment TM cuando había noticia nueva

- **Síntoma:** tras correr `npm run sync-squads -- --mode=scrape --refresh-final --verbose` sobre BIH/SWE, ambos perdieron `jugadores_fuente=as+tm` / `ff+tm` pasando a `ff`. BIH bajó de 26 a 25 jugadores (uno del enrichment AS desapareció); SWE mantuvo 26 pero perdió todos los `edad/valor/foto` del enrich TM. Recuperado parcialmente con `--mode=enrich-tm` (19/25 BIH, 25/26 SWE).
- **Causa:** el predicado en `scripts/sync-squads.mjs` runScrape era `if (refreshFinal && (players.length === 0 || !isFinal))` — solo preservaba roster existente cuando NO había noticia nueva. Cuando BIH/SWE tenían noticia FF (IDs 143918 / 143784), el scrape devolvía `players.length>0` e `isFinal=true` → flujo normal con `fuente='ff'` hardcoded → pisaba.
- **Fix aplicado:** commit `58979b5` (16-may) — semantizar `--refresh-final` como SIEMPRE conservador. Si existe roster en BD se preserva tal cual con `nombre`/`club`/`jugadores_fuente` intactos. Solo se reaplica `es_titular` según `scrape.xi_names`. Decode HTML in-flight de `nombre` + `club` para limpiar entidades crudas heredadas (ver ERR-46) sin re-scrapear.
- **Patrón preventivo:** flags con nombre tipo `preserve` / `refresh` / `keep-` deben preservar **incondicionalmente**, no solo en cierto branch del if. El nombre del flag promete una propiedad — el código debe cumplirla en todos los caminos. Cuando hay duda, **leer el flag como contrato** y razonar qué pasaría en el caso adversarial.
- **Fecha detección:** 16 may 2026 (round 5 del sprint, San reportó pérdida tras primer `--refresh-final` masivo).

## ERR-48 — `parseStartingXI` extraía escudos de rivales cuando página no tenía XI publicado

- **Síntoma:** `parseStartingXI('belgica' | 'japon' | 'suecia')` devolvía `["Eurocopa","Francia","Bélgica","Ucrania","Rumanía","Eslovaquia","Amistoso","Luxemburgo","Mundial","Egipto","Irán"]` en lugar de apellidos de jugadores. BIH funcionaba (devolvía apellidos correctos).
- **Causa raíz (tras 2 diagnósticos fallidos):** futbolfantasy renderiza el campo placeholder "Alineación aún no disponible" cuando la federación no ha publicado el once tipo, pero **ese texto se inyecta por JavaScript tras hidratación del cliente** y NO aparece en el HTML SSR (`html.indexOf('disponible') === -1`). El widget lateral "Próximos partidos" sí está en SSR y sus `<img alt="Eurocopa" / "Francia">` quedaban como los primeros 11 alts capturados.
- **Diagnósticos intermedios fallidos (referenciados como ERR-50):**
  - Hipótesis "rival shields entre anchor y XI" → fix con `END_MARKERS_RE` cortando el slice. Inviable: cortar el slice eliminaba alts legítimos cuando los marcadores estaban antes del XI real.
  - Hipótesis "detector regex de texto 'Alineación aún no disponible'" → no disparaba porque el texto no está en HTML SSR.
- **Fix definitivo:** commit `b54fff8` (16-may). Detector binario al inicio de `parseStartingXI`: `if (/\/alineaciones\/0\.jpg/i.test(html)) return [];`. La imagen del campo vacío SÍ está en HTML SSR como `src` de una `<img>` cuando FF no tiene XI publicado. Marcador robusto frente a cambios de copy.
- **Patrón preventivo:** para parsing server-side, **preferir marcadores SSR** (imágenes, atributos `data-*`, clases CSS estáticas) sobre marcadores que dependen de hidratación (textos visibles, contenido inyectado). Antes de escribir un regex de texto, verificar con `curl -s <url> | grep <texto>` que el texto está en el HTML servido. Si no, buscar otro marcador.
- **Fecha detección:** 16 may 2026 (rounds 4-5 del sprint, San aportó screenshot del campo placeholder real tras 2 fixes especulativos fallidos).

## ERR-49 — Apóstrofos tipográficos U+2019 rompen idempotencia ASCII en BD

- **Síntoma:** `npm run sync-squads -- --mode=scrape --iso3=FRA --dry-run` reportaba diff perpetuo en jugadores con apellido tipo `N'Golo Kanté`. 25/26 jugadores idénticos a BD + 1 diff (Kanté). La idempotencia rota generaba un UPDATE en cada run, rompiendo el `synced_at` como marcador de "última vez que algo cambió de verdad".
- **Causa:** `decodeHtml()` decodificaba `&rsquo;` → `'` (U+2019, apóstrofo tipográfico Unicode). La BD tenía `'` ASCII (U+0027) porque San tecleó los SQL iniciales con teclado normal. Mismo carácter visualmente, código distinto. Deep-equal byte a byte detectaba diff.
- **Fix aplicado:** commit `e81e058` (16-may, defensa en 2 capas):
  1. `HTML_ENTITIES.{lsquo,rsquo,ldquo,rdquo}` mapean directo a ASCII en lugar de Unicode tipográfico (cubre vía habitual: entidad nombrada).
  2. Dos `.replace` finales en `decodeHtml()`: `[‘’‚′] → '` y `[“”„″] → "` (cubre Unicode directo en HTML servido).
- **Patrón preventivo:** cuando un dato sale de un parser y se compara con dato manual del operador, **normalizar a ASCII**. Apóstrofos, comillas, espacios (NBSP), guiones (em/en-dash) tienen variantes Unicode que rompen igualdad byte a byte aunque el ojo no las distinga.
- **Fecha detección:** 16 may 2026 (round 3 del sprint, tras primer dry-run real de FRA contra BD).

## ERR-50 — `END_MARKERS_RE` corte de slice overzealous (intervención contraproducente)

- **Síntoma:** intento de fix de ERR-48 cortando el slice de `parseStartingXI` en markers de secciones ruidosas (`Próximos partidos`, `Historial`, `Calendario`...) empeoró el problema. BEL/JPN/SWE pasaron de 11 alts basura a 8 alts basura (cortábamos antes del XI legítimo en algunas estructuras).
- **Causa:** diagnóstico inicial asumió que la sección de partidos venía **después** del XI en HTML → cortar antes de ella protegería el XI. Realidad descubierta luego: BEL/JPN/SWE **no tienen XI publicado** (ERR-48 root cause); los escudos basura venían de un widget lateral inline, no de una sección posterior. El corte por markers eliminaba alts legítimos en estructuras donde sí había XI pero con marker cerca.
- **Fix:** commit `89e5d51` revierte completamente el `END_MARKERS_RE`. Vuelta a `const slice = anchor >= 0 ? html.slice(anchor) : html;` simple. El problema real (placeholder) se resuelve con detector de imagen (ERR-48).
- **Patrón preventivo:** **no especular sobre estructura HTML sin screenshot del UI real**. Antes de un fix de parsing, pedir / capturar la página servida con `curl` y verificar la hipótesis. Si un fix funciona contra una estructura sintética pero rompe en producción, la sintética no refleja la realidad — descartarla, no doblar la apuesta. Lección hermana: el README del módulo y los tests sintéticos no garantizan correctitud contra fuentes reales; siempre validar con el operador.
- **Fecha detección:** 16 may 2026 (round 4 del sprint, dispatch tras reporte de San del nuevo comportamiento erróneo).

---

## ERR-51 — RLS DELETE policies ausentes → false-positive éxito (rows no se borran)

- **Síntoma:** `db.from(tabla).delete().eq(...)` devuelve `{ data: null, error: null }` (éxito aparente, sin excepción). La memoria del cliente coincide con la expectativa (predictions/koPredictions vaciadas en RAM), pero al recargar la página los datos antiguos reaparecen porque NUNCA se borraron en BD.
- **Causa:** RLS habilitado en la tabla pero sin política con `FOR DELETE`. Postgres aplica un filter implícito que descarta TODAS las filas (porque no hay policy que las haga visibles para DELETE), no produce error. PostgREST tampoco propaga el caso porque desde su POV el query completó "correctamente" (0 rows afectadas == 0 rows matched). Diferente a una violación de policy en INSERT/UPDATE, que sí lanza `42501 row violates row-level security policy`.
- **Fix aplicado:** crear `CREATE POLICY <tabla>_delete ON public.<tabla> FOR DELETE USING (...)` con el mismo predicado que UPDATE (en este caso `auth.uid()=user_id AND (league_id IS NULL OR is_porra_abierta(...))`). Aplicado vía MCP el 17may2026 sobre 4 tablas críticas (predictions, ko_predictions, award_picks, boost_picks) y documentado retroactivamente en `supabase/migrations/20260517000001_*.sql` + `20260517000002_*.sql`.
- **Patrón preventivo:** auditar siempre que las **4 operaciones** (SELECT/INSERT/UPDATE/DELETE) tengan policy cuando el cliente las usa. Query de auditoría:
  ```sql
  SELECT tablename, array_agg(cmd ORDER BY cmd) AS policies
  FROM pg_policies WHERE schemaname='public' GROUP BY tablename;
  ```
  Si una tabla acepta DELETEs del cliente y NO aparece `DELETE` en su array, falta policy. Validar también con un `delete().eq('id', X).select()` que devuelva el row borrado — si devuelve `[]` sin error, hay false-positive.
- **Fecha detección:** 17 may 2026 (QA in-vivo via Chrome MCP durante validación de HF-Reset-02; reset visual reflejaba 0/0 en RAM pero F5 traía predictions de vuelta).

## ERR-52 — Scoring fantasma con solo goleador en grupos (PR #66 / HF-BUG-05)

- **Síntoma:** usuario elige solo goleador en un partido de grupos (sin tocar el marcador) y `scoring.js` puntúa el partido como 0-0 válido (+3 exact o +1 signo si el resultado real es 0-0 o empate) cuando debería puntuar únicamente +2 por goleador acertado.
- **Causa:** `v3SaveGoleadorGrupos` inicializaba `predictions[key] = {l:0, v:0, saved:true, ...}` cuando el registro no existía. `scoring.js` interpretaba el `0/0` como pronóstico real de empate 0-0.
- **Fix aplicado:** inicializar con `{l:null, v:null, saved:false, ...}`. La línea 783 de la misma función sigue marcando `saved=true` al final del path normal de persistencia, pero `scoring.js` descarta el marcador con `l===null` (`pred.l===realL` da false, signo da `NaN`). El goleador, si se acierta, sí puntúa (+2 pts) — comportamiento deseado. Path `null + delta` cuando el usuario añade marcador después defendido por `Number.isInteger` guard en `v3AdjustScoreGrupos:802`.
- **Patrón preventivo:** usar `null` (no `0`) para valores no introducidos por el usuario. `0` es un valor legítimo del dominio (marcador real); `null` señaliza "sin pronóstico" sin colisionar con el dominio. Cualquier comparación `===` con `null` falla de forma predecible.
- **Deuda residual:** **HF-BUG-05-bis** — `scoring.js:60` evalúa signo del pronóstico por delta `pred.l - pred.v`; `null - null === 0`, `Math.sign(0) === 0`, coincide con el signo de empate real → +1pt fantasma cuando pred es `null-null` Y el resultado es empate. Cubre 90% del bug, no el caso empate. One-liner pendiente (guard `pred.l!==null && pred.v!==null` antes del check de signo).
- **Fecha detección:** 17 may 2026.

## ERR-53 — Acumulación de listeners ESC/backdrop tras re-mount del gate KO (PR #66 / HF-BUG-08+01)

- **Síntoma:** tras N navegaciones del ciclo `gate-locked → unlocked` en la página KO, la tecla ESC dispara N veces `v3CloseZoomKO()` y el click en el backdrop puede no responder o responder múltiples veces. El bug solo aparece tras al menos un ciclo lock/unlock (no en navegación normal).
- **Causa:** `v3BindButtonsAndSwitcher` registraba `document.addEventListener('keydown', ...)` sin guard de idempotencia. La rama `gate-locked` de `v3ElimMount` hace `_v3ElimInited = false`, lo que provoca que el siguiente mount vuelva a llamar a `v3BindButtonsAndSwitcher` y registre otro listener encima.
- **Fix aplicado:** flag `_v3ElimGlobalListenersBound` declarada como `var` module-scope, nunca reseteada por ninguna rama. Ambos listeners (`keydown` ESC y `click` backdrop delegado en `document`) viven dentro del bloque `if (!_v3ElimGlobalListenersBound) { ... }`. El click delegado verifica `e.target.classList.contains('v3-zoom-overlay')` para no depender del lifecycle del overlay (que el shell crea lazy).
- **Patrón preventivo:** cualquier `addEventListener` sobre `document`/`window` desde una función invocada múltiples veces requiere un flag de idempotencia INDEPENDIENTE del flag de mount. El flag de mount puede resetearse (gate, error recovery, etc.); el de listeners no debe. Naming: que el nombre del flag refleje el scope real (`*GlobalListenersBound`, no `*MountInited`).
- **Relacionado:** ERR-43 (pointer-events overlay no gateado).
- **Fecha detección:** 17 may 2026.

## ERR-54 — admin.js invocaba v3RenderBoardGrupos() directo (PR #66 / HF-BUG-09)

- **Síntoma:** al "Simular todos los grupos" desde el panel admin legacy, el board v3 quedaba stale hasta navegar (acoplamiento implícito + sin signal). Inversamente, una llamada directa cross-módulo desde admin a v3 hacía throw si v3 no estaba montado, o renderizaba innecesariamente si el usuario estaba en otra página del shell.
- **Causa:** llamada directa `v3RenderBoardGrupos()` desde admin asume que v3 está montado y visible — asunción inválida.
- **Fix aplicado:** `document.dispatchEvent(new CustomEvent('mundial:predictions-changed', { detail: { source: 'groups' } }))` tras `savePredictions()` en `diceSimulateAllGroups`. Listener registrado dentro del bloque init-once de `v3GruposMount` con doble guard: `_v3GruposInited === true` Y `page-grupos` con `display !== 'none'`. Si grupos no está visible, no renderiza — el render ocurrirá en el próximo `v3GruposMount()` al navegar.
- **Patrón preventivo:** comunicación cross-módulo vía `CustomEvent` dispatched en `document`, no llamadas directas. El listener consumidor decide actuar o no según su propio estado (visibility, init flag). Idempotente por registro único en bloque init-once. Payload con `detail.source` extensible para que otros emisores (KO, importadores, etc.) sigan el mismo patrón sin colisionar.
- **Deuda residual:** **HF-BUG-09-bis** — el path KO sigue con `setTimeout(v3RenderBoardGrupos, 100)` en `v3SimulateDice` (`eliminatoria-v3.js`) y en `diceSimulateAllKO`. Migrar al mismo `CustomEvent` post-launch para completar el patrón I3.
- **Fecha detección:** 17 may 2026.

## ERR-55 — Tiebreaker arbitrario en standings con empate completo (PR #66 / HF-BUG-11)

- **Síntoma:** dos equipos con mismos `pts`/`gd`/`gf` aparecen en orden inestable entre re-renders. Inestabilidad puramente visual (no afecta puntuación) pero confusa para el usuario que compara dos pestañas o ve el orden cambiar tras un dispatch.
- **Causa:** `stats.sort((a,b) => ... || a.teamIdx - b.teamIdx)`. `teamIdx` es la posición del equipo dentro del array `EQUIPOS` del grupo — orden arbitrario sin significado deportivo.
- **Fix aplicado:** insertar `a.name.localeCompare(b.name)` antes de `a.teamIdx - b.teamIdx`. Determinista y predecible. FIFA real usa head-to-head + fair play + sorteo (no implementables sin datos), pero un orden alfabético es al menos consistente entre renders.
- **Patrón preventivo:** cualquier `sort` cuyo resultado se muestre al usuario debe terminar con un comparador determinista basado en datos del propio item (nombre, ID estable) — nunca en índices del contenedor (`array.indexOf`, `teamIdx`, etc.) que dependen de orden de inserción.
- **Fecha detección:** 17 may 2026.

## ERR-56 — is-qualified ausente para el 3º en tabla detallada del grupo (PR #66 / HF-BUG-12)

- **Síntoma:** el 3º clasificado de un grupo aparece marcado en verde (`is-qualified`) en el board principal pero blanco en la tabla detallada expandida del mismo grupo. Inconsistencia visual.
- **Causa:** la condición de la tabla detallada era `idx < 2 ? 'is-qualified' : ''` — solo top-2. El board principal sí consultaba `_v3BestThirdsCache` para marcar al 3º si entraba entre los 8 mejores 3os del Mundial 2026.
- **Fix aplicado:** factorizar el mismo predicado en ambas vistas: `idx < 2 || (idx === 2 && _v3BestThirdsCache && _v3BestThirdsCache.has(row.name))`. Defensa `_v3BestThirdsCache &&` evita `TypeError` si la cache aún no se computó (caso de tabla detallada abierta antes que el board principal renderice).
- **Patrón preventivo:** factorizar el predicado de estilo entre vistas que representan la misma información para evitar drift visual. Refactor menor candidato post-launch para extraer `v3IsRowQualified(row, idx)` y compartir entre board y tabla detallada.
- **Fecha detección:** 17 may 2026.

## ERR-57 — Check de signo en scoring.js sin null guard (PR #68 / HF-BUG-05-bis)

- **Síntoma:** tras el fix HF-BUG-05 (PR #66), un pronóstico con `pred.l=null` y `pred.v=null` (situación creada cuando usuario solo elige goleador en grupos, sin marcador) y resultado real empate (0-0, 1-1, 2-2, ...) puntuaba +1 pt fantasma de "signo" cuando debería puntuar solo +2 por goleador acertado (total 2 en lugar de 3).
- **Causa:** `scoring.js:60` chequeaba `Math.sign(pred.l - pred.v) === Math.sign(realL - realR)` sin guard de null. En JS, `null - null === 0`, y `Math.sign(0) === 0`, que coincide con el signo de un empate real. HF-BUG-05 (PR #66) cubrió el caso exact (`pred.l === realL` con `null === 2` falla en línea 55) pero no el caso signo (línea 60).
- **Fix aplicado:** añadir guard `pred.l !== null && pred.v !== null &&` al inicio del check de signo. One-liner. Test sanity Node + in-runtime localhost confirma T1/T4 pasan de 3 → 2 sin regresión en casos de control (exact, signo normal, solo goleador con no-empate real).
- **Patrón preventivo:** cualquier check aritmético con coerción implícita de null (resta, comparación numérica, `Math.sign`, etc.) debe llevar guard explícito de null antes. Patrón canónico en este repo: `getMySign(pred)` en `data.js:250` (`if (pred.l===null || pred.v===null) return null` + consumidor `if (!mySign) return false`).
- **Path IA verificado:** `iaBonusWillApply` (`data.js:262`) usa `getMySign(pred)` que ya bloquea null-null → no hay BUG-05-ter latente.
- **Fecha detección:** 17 may 2026 (PR #66 QA matriz Claude.ai). **Fecha fix:** 17 may 2026 (PR #68).

## ERR-58 — Tabla con RLS enabled SIN policy SELECT → queries devuelven 0 filas silenciosamente (PR #71 / Fix DB)

- **Síntoma:** `db.from('ia_elo_fifa').select(...)` devuelve `{ data: [], error: null }` para `authenticated` user (y para anon, y para JWT con claim `role: authenticated`). No es violación de permisos (no hay error), pero el resultado se filtra a 0 filas. Frontend ve listado vacío sin pista de la causa. Detectado en PR #71 Fix Pack 2 durante desarrollo de `getAwardCandidates` (BD-driven): cache se poblaba con array vacío y picker mostraba "Cargando jugadores…" → empty state, sin error en consola, sin error en Network tab (200 OK con body `[]`).
- **Causa:** Postgres aplica RLS por defecto en modo **deny-all si no hay policy explícita**. No emite error porque RLS funciona filtrando filas a partir del row check, no como denegación de acceso al recurso. Con `RLS enabled + 0 policies`, ninguna fila pasa el filtro → SELECT devuelve [] sin error. Las EFs (service_role) bypassean RLS, por eso los pipelines del IA Predictor funcionaban; solo el frontend (authenticated) sufría la regresión.
- **Tabla afectada (19-may):** `ia_elo_fifa` (creada en migración `20260421_create_ia_predictor_tables.sql` con `ENABLE ROW LEVEL SECURITY` pero sin policies). `ia_predictions` tenía policy pública (`ia_predictions_public_read`), pero `ia_elo_fifa`/`ia_h2h`/`ia_last5_results` no — diseño original asumía consumo solo desde EFs.
- **Fix aplicado:** migración `20260519103959_fix_rls_ia_elo_fifa_select_authenticated.sql` con `CREATE POLICY ia_elo_fifa_select_authenticated ON ia_elo_fifa FOR SELECT TO authenticated USING (true)`. Idempotente: `DROP POLICY IF EXISTS` antes de `CREATE` para que `db push`/`db reset` reapliquen sin error. Aplicada via `execute_sql` MCP el 19-may + versionada en commit `ff070c7` (incluido en squash PR #71).
- **Patrón preventivo:**
  1. **TODA tabla con `ENABLE ROW LEVEL SECURITY` necesita policies SELECT+INSERT+UPDATE+DELETE explícitas** para cada role esperado (authenticated, anon si aplica). Si la tabla es solo lectura desde frontend, mínimo policy SELECT.
  2. **Lint MCP `get_advisors`** detecta este patrón como `rls_enabled_no_policy` — incluir el chequeo en el flujo post-migración.
  3. **Migrations RLS siempre idempotentes**: `DROP POLICY IF EXISTS <name> ON <table>;` antes de `CREATE POLICY` para que el `supabase db push` y `supabase db reset` reproduzcan estado consistente sin error de duplicado.
  4. **Smoke test post-migración**: query desde JWT authenticated (no service_role) para verificar que la policy permite el acceso esperado. Una query desde Postgres directa (psql/MCP execute_sql como superuser) NO sirve porque bypassea RLS.
- **Pendientes hardening post-launch:** `ia_h2h` (head-to-head) y `ia_last5_results` (forma reciente) siguen sin policy SELECT. No bloquean nada hoy porque el frontend no las consume directamente (datos derivados llegan via `ia_predictions.breakdown` JSONB). Apuntadas a sprint security hardening post-Mundial.
- **Fecha detección:** 19 may 2026 (durante desarrollo Fix Pack 2 PR #71). **Fecha fix:** 19 may 2026 (commit `ff070c7` + migración aplicada en BD remota).

## ERR-59 — sync-squads detectaba listas FINAL falsas desde noticias FF de Eurocopa 2024

- **Síntoma:** dispatch manual de `--mode=scrape --all-missing` el 18-may-2026 detectó 3 "nuevas FINAL" (CRO, NED, POR) cuyas rosters venían de noticias publicadas en 2024 sobre la Eurocopa de Alemania, no del Mundial 2026. BD escrita con datos falsos antes de ser limpiada manualmente con UPDATE.
- **Causa:** `scripts/lib/ff-scraper.mjs` (Paso 1) buscaba la noticia "anuncia la lista" en `/world-cup/equipos/<slug>/noticias/1` y aceptaba la primera coincidencia sin verificar que la noticia perteneciera al torneo Mundial 2026. Los IDs internos de noticias en FF son monotónicos: las del Mundial 2026 son `143xxx`, las de Eurocopa 2024 son `115xxx`. Algunos slugs (CRO, NED, POR) tenían noticia de plantilla Eurocopa 2024 todavía indexada bajo la ruta `/world-cup/equipos/.../noticias/1` por orden cronológico desfavorable.
- **Fix aplicado (PR feat/squads-sources-refactor):** introducir `--mode=detect` con 5 fuentes primarias (AS + Sport.es + Olympics.com + Eurosport + Marca) con cross-validation 2-of-N + Jaccard ≥ 0.7. FF queda como fuente **secundaria** y solo se invoca para enriquecer XI titular de selecciones ya confirmadas FINAL por las primarias. Se elimina toda dependencia del scrape FF para *detectar* nuevas listas — eliminando la clase entera del bug.
- **Patrón preventivo:** cuando un scraper depende de un orden cronológico de noticias para identificar el evento "más reciente", incluir verificación cruzada con metadata estable (URL canónica del torneo, slug del año, ID de competición) antes de aceptar el resultado. Si esa metadata no existe o es ambigua, NO usar la fuente para detección de eventos — solo para enriquecimiento sobre eventos ya confirmados por otra vía.
- **Caveat operacional:** las URLs de noticias FF de Eurocopa 2024 seguirán reapareciendo en `/world-cup/equipos/<slug>/noticias/1` durante semanas/meses según el ritmo de publicación de nuevas noticias de Mundial 2026 por país. La defensa estructural (no usar FF para detección) cierra el vector permanentemente.
- **Fecha detección:** 18 may 2026 (e2e test post PR #69). **Fecha fix:** 18-19 may 2026 (PR feat/squads-sources-refactor).

## ERR-60: H2H tiebreaker ausente en v3ComputeStandings (HF-BUG-11)

**Fecha:** 19-may-2026
**Síntoma:** La clasificación de grupos saltaba de goles a favor (paso 3) directamente
a orden alfabético, omitiendo el desempate H2H (pasos 4-6 del Art. 13 FIFA 2026).
**Causa:** Comentario en HF-BUG-11 afirmaba erróneamente que los datos H2H no eran
accesibles; los datos estaban disponibles en el scope de la función (`matchesInGroup` +
`predictions`). El mismo gap existía en `calcGroupStandings` de `porra-ia-compute`.
**Fix:** Sprint Reglamento FIFA (19-may-2026). Algoritmo bifásico: sort global
(pts→gd→gf), luego `v3BreakTieH2H` por subgrupos empatados. Paridad en EF.
**Patrón:** Cuando se documenta una limitación técnica ("no implementable sin datos"),
verificar primero que los datos no estén ya disponibles en el scope.

## ERR-61: resolveAllSlots() asignaba terceros R32 en orden secuencial ignorando Anexo C

**Fecha:** 19-may-2026
**Síntoma:** Los 8 partidos de R32 con terceros (slots `T_*` en `BRACKET.r32`)
mostraban emparejamientos incorrectos. El mejor tercero en puntos se asignaba al
primer slot `T_ABCDF` independientemente de su grupo de origen, violando las
constraints del Anexo C (e.g. el tercero del grupo G no puede ir a `T_ABCDF`).
**Causa:** `resolveAllSlots()` en `public/js/ko.js` recorría `thirdSlots` y
`bestThirdsAvailable` en paralelo con `forEach((slot,i) => ...)`. La FIFA define
una tabla de lookup de 495 combinaciones (Anexo C, Art. 12.6 Reglamento WC2026)
que no tiene forma cerrada.
**Fix:** Sprint Annex-C (19-may-2026). Objeto `const ANNEX_C` generable desde
`scripts/gen-annex-c.mjs` (fuente: Wikipedia). `resolveAllSlots()` ahora reconstruye
`thirdEntries` con `{group, name}` desde `GRUPOS + tables`, calcula la clave
(8 letras sorted) y asigna cada slot según `ANNEX_C[key]`. Fallback secuencial
legacy si la clave no aparece o `ANNEX_C` está vacío (boot inicial).
**Patrón:** Cuando FIFA define una tabla de lookup oficial, implementarla
directamente — no intentar derivarla algorítmicamente. Mantener el fallback
secuencial es defensa contra dataset incompleto o regresiones en la generación.


## ERR-65 — iOS Safari: scroll touch bloqueado en hijo `overflow:auto` cuando padre tiene `pointer-events:none`

**Síntoma:** Modal con scroll vertical funciona en Chrome desktop (mouse wheel) pero NO en iPhone Safari con gestos touch.

**Caso de referencia:** `.v3-zoom-panel` + `.v3-zoom-panel__inner` (modal "Pronostica el Grupo X") en producción iPhone Safari, 20-may-2026. Tab Marcadores no scrolleaba hasta JORNADA 3 aunque el contenido desbordaba con creces el viewport.

**Causa:** Patrón anti-iOS específico. Cuando un contenedor scrollable
(`overflow-y:auto`) tiene `pointer-events:none` (común en patrones de
modal-con-backdrop para que clicks pasen al overlay de cierre — ERR-43
redux, F2.9 HOTFIX-03), iOS Safari bloquea la entrega del touch event a
ese contenedor. Chrome desktop con mouse wheel funciona porque el wheel
se procesa a nivel de viewport y propaga, pero touch no.

**Fix:** Mover el `overflow-y:auto` al contenedor hijo más interno que SÍ
recibe pointer events (`pointer-events:auto` aplicado vía `.is-open`).
Añadir:
- `-webkit-overflow-scrolling: touch` para momentum scroll iOS.
- `overscroll-behavior: contain` para aislar el scroll del body (evita
  chained scroll que desplaza la página detrás).
- `max-height` calculado en `dvh` con fallback `vh` para limitar la altura
  del scroller a viewport menos elementos fijos.

**Patrón:** Si un modal tiene `pointer-events:none` en su panel exterior
(para clicks de cierre vía backdrop), el scroll DEBE ir al children, nunca
al panel. Aplica a cualquier patrón overlay+inner que use el truco del
backdrop transparente.

**Validación:** PR #76 (squash `f1f55d4`) probó la solución incorrecta
(scroll en el panel); PR #77 (squash `7d8b706`) lo corrigió moviendo el
scroll al inner. QA iPhone Safari real validó el fix.


## ERR-66 — `.v3-zoom-panel__inner` cubierto por `.fc-tabbar` fija sin descuento en `max-height`

**Síntoma:** Tras arreglar el scroll iOS (ERR-65), el contorno verde del
modal termina parcialmente tapado por la bottom tabbar fija de la app.
Footer del modal "6 DE 6 MARCADORES · CLASIFICACIÓN →" solapado.

**Causa:** `max-height: calc(100dvh - 24px)` solo descuenta los margins
del modal (12 top + 12 bottom) pero no la `.fc-tabbar`
(`position:fixed; bottom:0`, 56px de alto). El modal extiende su contorno
hasta debajo de la tabbar, donde queda visualmente cortado.

**Fix:** `max-height: calc(100dvh - 80px)` con fallback `calc(100vh - 80px)`.
80px = 24px de margins + 56px de tabbar. No añadir buffer adicional para
`safe-area-inset-bottom` porque ya se aplica a la tabbar por separado.

**Patrón:** Cualquier modal o overlay que usa `100dvh` (o `100vh`) debe
descontar TODOS los elementos `position:fixed` que cubren parte del
viewport (tabbars, headers fijos, FABs persistentes, etc.). Auditar
cualquier max-height sobre dvh contra el inventario de elementos fixed.

**Validación:** PR #78 (squash `0e49612`). QA iPhone Safari real con
screenshot aprobado por San.


## ERR-67 — `calcMatchPoints` `else if` impedía apilar +1 signo sobre +3 exacto

**Síntoma:** predicciones con exacto + (goleador o bonus IA) devolvían 1 pt
menos del esperado. Máximo efectivo por partido era 6 (3+2+1), no 7. El cap
`Math.min(pts, 7)` en L79 nunca se disparaba — pista de que la lógica
upstream estaba mal o el cap era vestigial.

**Causa:** `scoring.js` L58-63 usaba `if(isExact){...} else if(<signo>){...}`.
El `else if` cortocircuitaba el branch del signo cuando ya habías entrado al
del exacto. Resultado: exacto daba SOLO +3, no +1+3=+4. Comentario L39
("incluye el signo, no acumula con +1") describía esta ramificación pero
contradice L42 ("Máximo: 7 pts") y la regla canónica.

**Fix:** rama `fix/scoring-exacto-apila-sobre-signo` — `else if` partido en
dos `if` independientes: signo siempre evalúa primero, exacto suma +3
ADICIONALES si además acierta. Comentario L39 corregido, `docs/scoring-engine.md`
tabla actualizada. Smoke tests en `tests/scoring.test.mjs` cubren los 4 casos
canónicos. Detectado por Claude.ai auditando código para implementar chips de
aciertos en card expandida del Directo (item 6 del feedback PR#88), 21-may-2026.

**Patrón:** cuando un cap (`Math.min(pts, 7)`) parece nunca dispararse con
la lógica que tienes upstream, sospecha que la lógica está mal o el cap es
vestigial. Comentarios contradictorios sobre la misma regla (L39 "no acumula"
vs L42 "Máximo 7") son síntoma clásico — la suma simple de los componentes
debe igualar el techo declarado, si no, una de las dos afirmaciones miente.


## ERR-68 — HTTP 403 sistemático en 4/5 fuentes desde IPs USA de GH Actions

**Síntoma:** workflow `sync-squads.yml` step `detect` falla en runs cron
consecutivos. `as.com`, `olympics.com`, `marca.com`, `eurosport.es`
devuelven HTTP 403 con `node fetch()` puro. Sport.es responde 200 OK
fiable. Reproducible en 6 runs cron consecutivos (mayo 2026). Localmente
(IP residencial) las mismas URLs respondían 200.

**Causa:** TLS fingerprint de `node fetch()` (ja3/ja4 hash de undici) es
identificable como bot por Cloudflare/Akamai. Las IPs de GH Actions
(Azure US) están en listas de bloqueo agresivo. Headers + User-Agent
realista NO bastan — Cloudflare inspecciona TLS handshake.

**Fix:** Scrapling como step previo (Python). Pre-fetcha las 5 URLs a
`cache/sources/<source>.html` y los parsers Node leen del filesystem.
Scrapling usa `curl_cffi` (TLS fingerprint de Chrome real) para Sport/
Olympics/Marca y `Playwright stealth` para AS/ESPN. PR
`feat/scrapling-integration-opt-a` (22-may-2026). Validado con 4 probe
runs concluyentes.

**Patrón:** cualquier scraping desde GH Actions/Azure debe usar
fingerprint de browser real, no `fetch()`/`undici`. Mismo problema
aplicaría a Apify Cloud, Vercel Edge, etc. si la fuente tiene
Cloudflare/Akamai activado.


## ERR-69 — Eurosport geoblock 307 → /geoblocking.shtml irresoluble client-side

**Síntoma:** Scrapling `Fetcher.get(impersonate=chrome)` y
`StealthyFetcher.fetch()` retornan ambos redirect 307 a
`/geoblocking.shtml` (5.7KB sin contenido) desde IPs USA. 4/4 métodos
probados fallan.

**Causa:** server-side IP geoblock (Eurosport bloquea acceso desde USA a
páginas de mercado europeo). NO es Cloudflare client-fingerprint — es
política de routing del CDN aplicada antes de servir contenido. Tampoco
se puede bypasar con headers (Accept-Language, Referer, geolocation API).

**Fix:** descartar Eurosport como fuente primaria. Sustituida por
ESPN Deportes (Disney/Hearst, id 16715015, cobertura latinoamericana
con HTML 200 OK ~618KB). PR `feat/scrapling-integration-opt-a`. Si se
quisiera recuperar Eurosport en el futuro: necesitaría proxy residencial
EU (Webshare, Bright Data) — coste y complejidad >> beneficio marginal.


## ERR-70 — `actions/setup-python@v5` con `cache: pip` exige requirements.txt

**Síntoma:** workflow step `Setup Python` falla con
`Error: No file in /home/runner/work/.../PorraMundial2026 matched to
[**/requirements.txt or **/pyproject.toml]`.

**Causa:** el repo no tiene `requirements.txt` (Python solo se usa para
Scrapling en un step efímero — `pip install scrapling[fetchers]` se
ejecuta inline). `cache: pip` requiere un fichero de manifests para
calcular cache key.

**Fix:** omitir la directiva `cache: pip` en `setup-python@v5`. El install
tarda ~30s adicional por run, aceptable para un cron 6h.

**Patrón:** las directivas `cache:` de las setup-* actions exigen archivos
manifest específicos. Si el proyecto no los tiene, no añadirlas — el
overhead es marginal.
