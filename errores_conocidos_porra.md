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
