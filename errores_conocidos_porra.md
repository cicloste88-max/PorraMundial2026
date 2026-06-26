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


## ERR-71 — Parser `parsePlayer` no tolera paréntesis malformados (5 patrones reales)

**Síntoma:** 5 entradas corruptas en `squads.jugadores` tras auditoría manual
28-may-2026:
  - EGY `'Ibrahim Ade (Pyramids FC)l'` — letra cortada por mala segmentación
  - ENG `'(Tottenham)'` — nombre VACÍO, sólo club entre paréntesis
  - KOR `'Lee Jjae-Sung )Mainz 05)'` — paréntesis invertido sin `(` apertura
  - SCO `'Ross Stewart (Southampton)Stewart'` — apellido duplicado tras `)`
  - SWE `'Gustaf Nilsson Brujas)'` — club pegado sin paréntesis abierto

**Causa:** regex previa `^(.+?)\s*\(([^)]+)\)\s*$` requería paréntesis
bien formados y end-of-string anclado. Los 5 casos fallaban el match y
caían al fallback `{ nombre: s }` que devolvía la cadena CORRUPTA tal cual
como nombre. La BD acababa con jugadores tipo "(Tottenham)" o "Ross Stewart
(Southampton)Stewart" indistinguibles para el matcher.

**Fix:** dos caminos en `parsePlayer` (`scripts/lib/parsers/_util.mjs`):
  1. Path well-formed: regex original intacta (sin regresión).
  2. Path robusto: secuencia de strips para limpiar parens malformados
     (leading paren, well-formed con leading whitespace, inverted, club
     pegado al final sin `(`) + dedupe de apellido repetido. Devuelve
     `null` si tras limpieza el nombre queda vacío — el llamador
     (`parsePlayerList` con `filter(Boolean)`) descarta. NUNCA inserta
     entrada con nombre vacío o corrupto.

**Patrón:** cuando una regex estricta falla, NO regresar el input crudo
como fallback. Devolver `null` y dejar al caller decidir (filter, warn,
o re-intentar con regex relajada).


## ERR-72 — Name-matcher Levenshtein 0.75 demasiado estricto para transliteración no-latina

**Síntoma:** matcher devolvía `unmatched` para casos verificados manualmente
por San como mismo jugador:
  - KOR `'Kim Tae-hyeon'` (FF) vs `'Kim Tae-Hwan'` (roster) — sim < 0.75
  - EGY `'Fattouh'` (FF) vs `'Ahmed Fotouh'` (roster) — sim ~0.71
  - BIH apellidos -ic/-vic con colisiones (Burnic/Memic).

**Causa:** threshold global de Levenshtein `sim ≥ 0.75` en `scorePair` era
adecuado para nombres latinos pero rechazaba variantes de transliteración
árabe/coreana/eslava donde dos fuentes oficiales discrepan en 1-2 chars
del último apellido sin que sean personas distintas.

**Fix:** threshold adaptativo en `name-matcher.mjs`:
  - `scorePair` acepta opción `simThreshold` (default 0.75 latino).
  - `matchAgainstRoster` baja a 0.70 cuando `iso3 ∈ NON_LATIN_ISO3`
    `{KOR, EGY, KSA, MAR, IRN, IRQ, JOR, SEN, GHA, CIV, COD, TUN, ALG, BIH}`.

Más: diccionario de alias per-iso3 (`scripts/lib/name-aliases.json`)
consultado ANTES de Levenshtein para casos sin patrón regular (apodos
MAR Bono → Yassine Bounou, iniciales HAI Deedson L. → Louicius Deedson).

**Patrón:** scoring fuzzy debe poder calibrarse por dominio. Un único
threshold global produce falsos negativos en idiomas no-latinos y/o
falsos positivos en latinos. Mejor: threshold base + override por contexto
(en este caso iso3 del target).


## ERR-73 — Matcher single-best sin anti-colisión produce falsos positivos en apellidos compartidos

**Síntoma potencial:** un candidato XI con apellido común (e.g. "García",
"Vinicius") matchearía con score idéntico a múltiples jugadores del roster.
El matcher devolvía el PRIMERO en orden DOM, sin avisar de la ambigüedad.

**Causa:** algoritmo greedy `if (sc > bestScore)`. No registraba el
segundo mejor candidato ni detectaba empates.

**Fix:** `matchAgainstRoster` registra `secondBestScore`. Si
`bestScore - secondBestScore < ambiguityMargin` (default 5 sobre 100)
y `secondBestScore > 0`, NO marca el match — devuelve el candidato como
unmatched. Cubre casos como 'García' contra {Joan García, Pablo García}
donde sin contexto adicional el matcher no puede elegir.

`ambiguityMargin=0` desactiva el guard (compat con tests legacy).

**Patrón:** matching fuzzy debe distinguir "match seguro" de "match
ambiguo". Marcar ambiguo es preferible a marcar arbitrariamente — el
fallback humano (Capa C `xi_pinned`) corrige sin riesgo, mientras que
un falso positivo no se detecta sin auditoría externa.


## ERR-74 — Cron sobrescribe correcciones manuales del XI titular

**Síntoma:** San corrige manualmente 33 países a 11/11 titulares via MCP.
El siguiente tick del cron (`mode=detect`) recalcula `es_titular` para
todos los países y revierte las correcciones manuales — al alias dict
no le da tiempo a cubrir todos los apodos/inversiones edge case.

**Causa:** Paso 2 de detect siempre re-mapea XI titular contra el roster,
sin distinguir entre países procesados automáticamente vs corregidos a
mano. No había marcador "este XI ya está validado, no tocar".

**Fix:** Capa C del fix XI pipeline (migración 20260528170000):
  - `squads.xi_pinned boolean DEFAULT false`
  - `squads.xi_pinned_at timestamptz`
  - `sync-squads.mjs` Paso 2 + scrape `--refresh-final` chequean
    `xi_pinned===true` ANTES de recalcular es_titular y saltan.
  - El roster (nombres, club, dorsal, edad, valor, etc.) sigue actualizable
    por detect/enrich-tm vía preserveEnrichment — sólo el flag es_titular
    se congela. Esto permite que la Capa A corrija nombres corruptos del
    roster aunque el XI esté pineado.

Pin manual via MCP:
```sql
UPDATE squads SET xi_pinned=true, xi_pinned_at=NOW() WHERE iso3 IN (...);
```

**Patrón:** cualquier campo que pueda ser corregido manualmente debe tener
un flag "no machacar" (pin). Sin ello, la próxima ejecución del proceso
automático sobrescribe el trabajo humano.


## ERR-75 — XI dudosos en FF: jugadores en pos-0 NO convocados oficialmente

**Síntoma:** FF coloca a veces como titular pos-0 a jugadores que NO
aparecen en la convocatoria oficial. Ejemplo confirmado 28-may: TUN
Aissa Laidouni en pos-0 pero Lamouchi no lo convocó (verificado con
lista DAZN). Esto producía `unmatched` para el slot, no 10/11.

**Causa:** FF actualiza el "Posible once tipo" en tiempo real con
proyecciones tácticas que no siempre coinciden con la convocatoria
final que San importa en BD desde fuentes primarias (AS/Sport/Olympics/
ESPN/Marca).

**Fix:** Capa B punto 4 del fix XI pipeline:
  - `ff-scraper.parseStartingXISlotsFromHtml` extrae tanto pos-0
    (titular) como pos-1 (alternativa) desde `a.juggador.pos-{0,1}`.
  - `matchAgainstRoster` acepta `candidate groups` (array de arrays).
    Por slot: intenta pos-0 primero, si no matchea contra el roster
    intenta pos-1. Si pos-1 SÍ está convocado, marca a ese.
  - Caso TUN: pos-0 Laidouni → unmatched → pos-1 Rani Khedira → match.

Pendiente verificar con fuente oficial 3 dudosos (no se aplica alias ni
fallback ciego):
  - IRN: Kanaanizadegan (FF) vs roster Hossein Kanaani (¿misma persona?)
  - GHA: Kohn (FF) — no casa con roster
  - JOR: Layla portero (FF) — no identificado en roster

Para esos 3 dejar 10/11 (no forzar match incorrecto). San verificará con
fuente oficial y aplicará pin manual cuando confirme.

**Patrón:** un scraper de "posible once" no es fuente de verdad de la
convocatoria — es una predicción. Cuando colisiona con la convocatoria
oficial, manda la convocatoria. El fallback pos-1 es heurístico
pero suficiente para los casos comunes.


## ERR-76 — Vistas de competición real NO leen `resolvedSlots` (son predicciones del usuario)

**Síntoma:** la primera versión del esqueleto KO en la pantalla Jornada
(PR#118, JO-1a) rellenaba las 32 tarjetas del bracket (16avos→Final) con
nombres de selecciones reales si el usuario había pronosticado los grupos
y/o KO en Fase Final. Para un usuario con bracket pronosticado completo
hasta la Final, la pantalla Jornada mostraba "México vs Sudáfrica" en
16avos, "Brasil vs Inglaterra" en cuartos, etc. — pero esas eran SUS
apuestas, no la competición real. Para San (revisando la screen Jornada
del Mundial) eso era un fallo de diseño grave: confundía pronóstico con
realidad.

**Causa:** `_buildJKOCard` reutilizaba `resolvedSlots[slot]` de `ko.js`
con la intención de "ya que el dato existe, lo aprovecho". `resolvedSlots`
se rellena vía `resolveAllSlots()` que itera `predictions` y
`koPredictions` (apuestas del usuario en Fase Final). El primer render
incluso llamaba `resolveAllSlots()` antes de iterar para tener el mapa
fresco. La confusión venía de tratar `resolvedSlots` como si fuera el
bracket REAL en lugar de la PROYECCIÓN del usuario.

**Fix (PR#119):**
- `_joKOSlotLabel(slot)` devuelve constante `'Por definir'` (sin leer
  `resolvedSlots`).
- `_joKOTeamFromSlot(slot)` devuelve `null` (sin lookup en EQUIPOS, sin
  bandera — el `.jv2-flag` cae al gris `--ink-700` por defecto).
- `_buildJKOSectionsHtml()` deja de llamar `resolveAllSlots()`.
- TODO en código: cuando exista pipeline live (post 27-jun 2026), las dos
  funciones se conectarán a resultados oficiales — `PARTIDOS.realHome`/
  `realAway` para deducir clasificados de grupos + `ko_results` para
  ganadores KO. NUNCA a `resolvedSlots`.

**Patrón:** cualquier vista que muestre el calendario/competición REAL
del torneo NO debe leer estructuras que reflejan apuestas del usuario.
Auditar antes de reutilizar:
- `predictions` / `koPredictions` → SIEMPRE apuestas del usuario.
- `resolvedSlots` (derivado de las dos anteriores vía `resolveAllSlots`)
  → SIEMPRE apuestas del usuario.
- `boostPicks` → apuestas del usuario (boost ×2).
- `awPicks` → apuestas del usuario (4 premios).
- Fuentes REALES de competición (todas pre-launch pendientes):
  - `PARTIDOS[].realHome` / `realAway` (grupos, vía `update-results`).
  - `live_scores` (todos, vía Apify webhook).
  - `ko_results` (KO, JSON con clasificados, post 27-jun 2026).

Si una funcionalidad muestra el bracket real, debe degradarse a placeholder
("Por definir", "—") hasta que el dato REAL esté disponible. NO usar las
apuestas como proxy "decorativo" — confunde al usuario.

Aplicado en: `ui-groups.js` (PR#119, JO-1a hotfix). El mismo principio
aplica a cualquier futura vista de calendario, ficha o resumen del torneo
que iteramos sobre el bracket.

## ERR-77 — `renderPanelPais`: match estricto `name_en === nameEn` rompe el roster en 5 selecciones con naming divergente

**Síntoma:** en el overlay del globo 3D (`window._openGloboOverlay()`), al
pulsar el botón "Plantilla" sobre Cape Verde, Czech Republic, Ivory Coast,
Korea o Turkey, el modal de roster se abre vacío con el mensaje "Datos de
plantilla aún no disponibles para esta selección" — aunque la tabla `squads`
tiene los 26 jugadores reales y la query del cliente funciona logueado.
Las otras 43 selecciones funcionan. En consola, `console.warn('[roster] iso3
vacío — no se puede consultar squads')`.

**Causa:** `renderPanelPais(wikiData, nombrePais, nameEn)` en
`public/js/ui-globo-equipos.js` derivaba `iso3` con match estricto:

```js
var eq = EQUIPOS.find(function (t) { return t.name_en === nameEn; });
if (eq) iso3 = eq.flag || '';
```

El 3er argumento `nameEn` es la **key canónica WIKI** (resuelta por
`getWikiKey()` desde `ALIAS_WIKI`), no el `EQUIPOS.name_en`. Para 43
selecciones ambos coinciden, pero 5 divergen:

| WIKI key (nameEn) | EQUIPOS.name_en  | EQUIPOS.name        | flag |
|-------------------|------------------|---------------------|------|
| `Cape Verde`      | `Cabo Verde`     | `Cabo Verde`        | CPV  |
| `Czech Republic`  | `Czechia`        | `República Checa`   | CZE  |
| `Ivory Coast`     | `Côte d'Ivoire`  | `Costa de Marfil`   | CIV  |
| `Korea`           | `South Korea`    | `República de Corea`| KOR  |
| `Turkey`          | `Türkiye`        | `Turquía`           | TUR  |

`find()` devuelve `undefined` → `iso3=''` → el botón
`.fc-globo-detail__btn-roster` se renderiza con `data-iso3=""` →
`openRosterScreen()` corta en `if (!iso3)` y nunca consulta `squads`. El
fallback es el bloque `<div class="fc-roster-empty">Datos de plantilla aún
no disponibles…</div>`, que el usuario interpreta como "BBDD vacía" cuando
en realidad es un fallo de resolución cliente.

**Fix (2 iteraciones sobre la rama `fix/globo-roster-iso3-naming`):**

### Iteración 1 (commit `f92c1af`) — cascada NFD tolerante

Primera aproximación: cascada NFD probando los 3 campos de EQUIPOS
(`name_en`, `name`, `slug`) contra `nameEn` y `nombrePais`, preservando
match exact-match como step 0. QA en preview Vercel reveló que arreglaba
solo **3/5**:

- ✅ Cape Verde / Korea / Turkey casaban — `EQUIPOS.name` (es) o `slug`
  coincide con la WIKI key tras `_norm`.
- ❌ Czech Republic / Ivory Coast fallaban en el escenario donde el
  GeoJSON NE 50m devuelve directamente la WIKI key en `properties.NAME`
  (p.ej. `NAME="Czech Republic"`, `NAME="Ivory Coast"`). En esa rama
  tanto `nameEn` como `nombrePais` llegan iguales a la WIKI key, y
  ningún campo de EQUIPOS contiene esas cadenas tras normalización:
  - CZE: `name_en="Czechia"`, `slug="czech"` — nunca casa con `"czechrepublic"`.
  - CIV: `name_en="Côte d'Ivoire"`, `slug="ivory-coast"` — sin colapsar
    el guión, `_norm("ivory-coast")="ivory-coast"` ≠ `_norm("Ivory Coast")="ivory coast"`.
  
  Además, mi test inicial dio falso positivo (10/10) porque asumió que el
  polygon path siempre pasa `nombrePais` = NE NAME (no la WIKI key); en
  realidad la versión del NE GeoJSON puede devolver el nombre canónico ya
  resuelto en `properties.NAME`, eliminando el "alias hop" intermedio.

### Iteración 2 (este commit) — alias map explícito + cascada como red

Diseño defensivo en 2 capas:

**Vía PRINCIPAL** — mapa explícito `WIKIKEY_TO_ISO3` con las 5 divergencias
conocidas. Conjunto cerrado y conocido (no crece sin nuevas selecciones al
Mundial). Garantiza 5/5 independientemente del path de invocación, del
contenido de NE GeoJSON, o de variaciones futuras en `_norm`:

```js
var WIKIKEY_TO_ISO3 = {
  'Cape Verde':     'CPV',
  'Czech Republic': 'CZE',
  'Ivory Coast':    'CIV',
  'Korea':          'KOR',
  'Turkey':         'TUR'
};
if (nameEn && WIKIKEY_TO_ISO3[nameEn]) {
  iso3 = WIKIKEY_TO_ISO3[nameEn];
}
```

**Vía FALLBACK** — cascada NFD con `_norm` mejorado que también colapsa
separadores comunes (`/[\s\-_'.]/g`). Step 0 preserva exact-match (cero
regresión en las 43 ya operativas); el colapso de separadores blinda
slugs con guiones (`ivory-coast` ↔ `ivorycoast`) y casos similares futuros:

```js
var _DIAC_RE = new RegExp('[\\u0300-\\u036f]', 'g');
var _SEP_RE  = /[\s\-_'.]/g;
var _norm = function (s) {
  return (s || '').normalize('NFD').replace(_DIAC_RE, '')
    .toLowerCase().replace(_SEP_RE, '').trim();
};
// ... cascada igual que iteración 1, preservando step 0 exact-match.
```

Por qué NO heurística de subcadena (descartada): `'korea'⊂'southkorea'`
genera colisiones falsas — `EQUIPOS.find(t => t.name_en.includes('korea'))`
también casaría con North Korea si existiera, y similar para "China" vs
"South China" etc. El alias explícito evita ambigüedad.

**Verificación (iteración 2):** script standalone parseando EQUIPOS REAL
de `data.js` (no datos asumidos). **15/15 escenarios** para los 5 países
divergentes — worst-case (`nameEn === nombrePais` = WIKI key) +
polygon-path (NE name raw) + flag-button-path (Spanish name como
`nombrePais`). Round-trip **48/48** con `EQUIPOS.name_en` raw + **48/48**
simulando `getWikiKey()` (la forma real de invocación en producción).
Cero regresiones.

**Patrón:** cuando una función recibe nombres canónicos derivados de aliases
(WIKI keys, NE polygon names, ISO labels, etc.) y los compara contra
estructuras que usan otros canónicos (EQUIPOS.name_en es un canónico
distinto al WIKI key), NUNCA confiar en `===` estricto, y **NO depender
solo de NFD-normalize tolerante** si el conjunto de divergencias es
cerrado y conocido. Diseño en dos capas:

1. **Mapa explícito `<canónico-input> → <canónico-store>`** como vía
   principal para divergencias conocidas. Garantiza correctness sin
   depender de heurísticas que pueden romperse con cambios futuros en
   `_norm` o en los datos upstream (GeoJSON NE versions).
2. **Cascada NFD + colapso de separadores** como fallback defensivo.
   Cubre los casos no-divergentes (exact-match step 0) y blinda contra
   variantes ligeras (`ivory-coast` ↔ `ivory coast`, acentos, mayúsculas).

Auditar sitios vulnerables:

- `EQUIPOS.find(t => t.name_en === X)` → vulnerable si X viene de
  `getWikiKey()`, `ALIAS_NE[]`, o cualquier otro espacio de naming.
- `EQUIPOS.find(t => t.name === X)` → vulnerable si X es un texto inglés.
- Patrones seguros existentes en repo: comparación contra `e.flag === iso3`
  (iso3 es canónico estable) o `e.slug === slug` (con slug previamente
  derivado del propio EQUIPOS).

Aplicado en: `ui-globo-equipos.js:310-360` (rama `fix/globo-roster-iso3-naming`,
PR #124, 31-may-2026). Único site detectado vía
`grep "name_en === nameEn" public/js`. Otros `EQUIPOS.find` del repo usan
`e.name`, `e.flag` o `e.slug` y no replican el patrón.

### Pendiente separado — TUR `squads` vacío

Tras este fix, la WIKI key "Turkey" resuelve correctamente al ISO3 "TUR",
pero la tabla `squads` para `iso3='TUR'` tiene **0 jugadores** (las
otras 4 selecciones del fix tienen pleno: CPV 26 · CZE 30 · CIV 26 ·
KOR 26). El modal de plantilla seguirá saliendo vacío para Turquía con
el mensaje "Datos de plantilla aún no disponibles" — pero esta vez por
falta real de datos, no por bug de resolución cliente.

Causa probable: la lista oficial de Turquía aún no se ha publicado en
las fuentes que rastrea `scripts/sync-squads.mjs` (`--mode=detect` con
cross-validate 2-of-N), o el detect rechazó las publicaciones por
roster < 22. Acción recomendada cuando la convocatoria se anuncie:

```bash
npm run sync-squads -- --mode=scrape --iso3=TUR --verbose
npm run sync-squads -- --mode=enrich-tm --iso3=TUR --verbose
```

(Ver regla `.claude/rules/sync-squads.md` §"--refresh-final" para el orden
correcto cuando hay enrichment TM previo.) NO requiere cambios de código
en el front — el resolver ya queda correcto.

## ERR-78 — Bootstrap auth congelado tras refresh: `#restore-lock-css` bloquea fallback a welcome + watchdog gateado por loader oculto (iter 1 y 2 atacaron consecuencias, no la causa)

**Síntoma:** tras `F5` o recarga del navegador, la app queda "congelada":
el header global se ve (ADMIN, nombre, "Cerrar sesión"), pero el resto
está vacío — azul liso, sin grupos, sin nav funcional, sin overlay de
login. Reproducido en iPhone y Android. Pasa SOLO cuando el usuario tiene
sesión persistida (login previo); usuarios anónimos ven welcome
correctamente. Workaround del usuario: logout + login → cura porque
reejecuta el flujo por la rama `SIGNED_IN` (que se emite DESPUÉS del
registro del listener, no la `INITIAL_SESSION` original).

En consola: NO hay error visible. `_myLeagues` queda `[]`, `getActiveLeagueId()`
devuelve `null`. **Pero el dato clave** del diagnóstico definitivo (sesión
en preview Vercel + Chrome MCP): suscribir un listener NUEVO Y llamar a
`db.auth.getSession()` manualmente devuelve `{hasSession:true}` con todos
los campos correctos. La sesión EXISTE; solo nadie la procesa.

**Causa REAL (revisada tras QA en preview Vercel):** RACE DE REGISTRO TARDÍO
del listener, NO el fallo transitorio de `leagueLoadMyLeagues` que asumía
la iteración inicial del fix. La iteración inicial (commit `5405ebc`) añadía
retry + timeout + `_navigated` + watchdog DENTRO del handler de
`db.auth.onAuthStateChange` — pero **el handler nunca se ejecutaba** para
el evento `INITIAL_SESSION` en el escenario reproducido, así que ninguna
de esas mejoras corría.

Por qué el listener no recibe el evento:

1. `auth.js` se carga al FINAL de la cadena `loadScript` (es de los últimos
   classic scripts en ejecutarse). Antes de él, supabase-js ya ha sido
   inicializado (`createClient(...)` con `persistSession: true`).
2. Durante `createClient` / restauración de la sesión persistida en
   `localStorage`, supabase-js emite `INITIAL_SESSION` automáticamente.
3. En ese momento NADIE está suscrito (auth.js todavía no ha llegado a
   registrar su `onAuthStateChange`).
4. Cuando auth.js finalmente ejecuta `db.auth.onAuthStateChange(handler)`,
   el evento `INITIAL_SESSION` YA pasó. supabase-js NO reemite eventos
   pasados a listeners nuevos. El handler del bootstrap queda huérfano:
   nunca se invoca para el evento que lo activaría.
5. Consecuencia: retry, timeout, `_navigated`, watchdog — TODO vive dentro
   del handler. Si el handler no corre, ninguno protege. La app queda
   indefinidamente con el shell montado pero hijos a `height:0`.

Por qué logout+login lo cura: `SIGNED_IN` se emite DESPUÉS de
`signInWithPassword`, en un momento donde el listener YA está registrado.
El handler corre, el bootstrap navega, todo bien.

Prueba definitiva en preview Vercel con Chrome MCP:
- Suscribir un listener NUEVO en consola después del refresh → no recibe
  nada (el `INITIAL_SESSION` ya pasó).
- Llamar `db.auth.getSession()` manualmente → devuelve `{data:{session:{...}}}`
  con sesión válida.
- Llamar `leagueLoadMyLeagues()` manualmente → resuelve en ~862ms con
  3 ligas. La red funciona perfectamente; solo nadie la llama.

Tres fallos compuestos del diseño original (que en conjunto producen el
síntoma vacío) — todos relevantes, pero solo (4) es la causa raíz:

1. **`leagueLoadMyLeagues()` sin retry** — añadiría robustez si el handler
   corriera, pero no corre.
2. **Sin timeout en los `await`s** — mismo: relevante solo si el handler
   ejecuta.
3. **Early-return `if (found) {...; return;}`** — mismo.
4. **CAUSA RAÍZ: `INITIAL_SESSION` se emite ANTES de que el listener
   esté suscrito** — el handler nunca ejecuta, así que ninguna de las
   mejoras anteriores tiene efecto.

Adicionalmente: el `localStorage.removeItem('porra_active_league_id')`
en el path "no encontrado" se ejecutaba INCLUSO si la ausencia era
transient — borrando datos legítimos del usuario y forzando recovery
manual aunque la red volviera al siguiente refresh.

**Fix (rama `fix/auth-bootstrap-frozen-refresh`, 2 iteraciones):**

### Iteración 1 (commit `5405ebc`) — retry + timeout + watchdog DENTRO del handler

Primera aproximación: añadir robustez al handler asumiendo que se invocaba
pero que sus awaits internos colgaban. Componentes: `_withTimeout`, retry
con backoff sobre `leagueLoadMyLeagues`, flag `_navigated` + try/finally,
loader gated por `sessionStorage.porra_token`, watchdog de 12s dentro de
un `if (_potentialSession)`.

QA en preview Vercel reveló que **el handler nunca se ejecutaba** en el
escenario problemático. Pasaron MINUTOS sin que el watchdog rescatara,
porque el watchdog también vivía dentro del bloque que dependía de
`sessionStorage.porra_token` (token que solo escribe el HANDLER cuando
ejecuta — circular).

### Iteración 2 (este commit) — `getSession()` explícito + bootstrap extraído + watchdog incondicional

Refactor estructural que ataca la causa raíz (race de listener tardío):

**A) `_bootstrapSession(session, eventType)` extraído** — función reutilizable
con TODO el flujo de bootstrap (profile fetch, retry leagueLoadMyLeagues,
loadUserData, showPage) que se invoca desde DOS puntos de entrada:

1. `onAuthStateChange` handler — cubre cambios FUTUROS (login fresco
   `SIGNED_IN`, o `INITIAL_SESSION` si supabase decide emitirlo después
   del registro — caso teórico).
2. `db.auth.getSession()` EXPLÍCITO tras registrar el listener — cubre
   el race original. El patrón canónico Supabase v2 es:

   ```js
   // Snapshot inicial — cubre sesión ya restaurada
   const { data: { session } } = await supabase.auth.getSession();
   if (session?.user) bootstrap(session, 'INITIAL_SESSION');
   // Listener — cubre cambios futuros
   supabase.auth.onAuthStateChange((event, session) => { ... });
   ```

   En esta codebase el orden es invertido (listener primero, getSession
   después) por consistencia con el handler delegante, pero la semántica
   es la misma: getSession sincroniza el bootstrap con la sesión EXISTENTE
   al cargar, independiente de qué eventos haya emitido supabase antes.

**B) Guard idempotente `window._bootstrapInFlight`** — si `_bootstrapSession`
ya está en vuelo cuando se invoca de nuevo (ambas vías compiten en algunos
timings), la segunda llamada retorna inmediatamente. Más el guard preservado
de `currentUser.id === session.user.id` (mismo usuario ya hidratado →
solo refresca UI bar).

**C) Loader + watchdog 12s armados INCONDICIONALMENTE al inicio de
`runAuthInit`**, FUERA del handler. Antes el gating por
`sessionStorage.porra_token` era circular (el token solo se escribía
desde el handler que no corría). Ahora:

```js
_showBootstrapLoader();
setTimeout(function () {
  if (document.getElementById('_auth-bootstrap-loader')) {
    console.warn('[auth.bootstrap] watchdog 12s: ningún path navegó. Forzando welcome.');
    _hideBootstrapLoader();
    try { if (typeof showPage === 'function') showPage('welcome'); } catch (e) {}
  }
}, 12000);
```

El loader es harmless para usuarios anónimos (welcome path lo oculta
inmediatamente al renderizar). El watchdog rescata cualquier escenario
extremo donde todas las capas fallan.

**D) Helper `_withTimeout(promise, ms, label)`** — preservado del commit
anterior. `Promise.race` aplicado a profile fetch (8s),
`leagueLoadMyLeagues` (8s por intento), `leagueSelectById` (8s),
`loadUserData` (10s), Y al nuevo `db.auth.getSession()` (8s — protege
también contra hangs del cliente Supabase).

**E) Retry con backoff** preservado del commit anterior — 4 intentos
con delays 0/400/800/1600ms sobre `leagueLoadMyLeagues()`.

**F) Flag `_navigated` + try/finally** preservado del commit anterior —
garantiza `showPage` en TODOS los caminos internos del bootstrap.

**G) Preservar `savedLeagueId`** preservado del commit anterior — solo
limpia si `_myLeagues.length > 0` pero la guardada no aparece (stale id
legítimo).

**H) Fallback para getSession sin sesión + `_pendingPageRestore`** — edge
case nuevo: si `getSession()` devuelve null pero `_pendingPageRestore`
estaba seteado (sesión expirada entre tab close y reopen), el `.then`
limpia el pending y navega a welcome.

**Verificación pendiente:** QA en preview Vercel reproduciendo el
refresh real (sesión persistida + F5 donde `INITIAL_SESSION` se emitió
antes del registro del listener). El test que importa NO es "simular
el evento del listener" — ese es justo el que falla y no se invoca.
El test definitivo es: tras refresh, comprobar que `db.auth.getSession()`
explícito arranca igualmente el flow (showPage llamado, shell con
altura, jugadores visibles).

Lección PR#124 (caso roster iso3) reforzada: el test standalone con
asunciones de timing/eventos NO captura la realidad del navegador.
Adicionalmente lección de la iteración 1 de este mismo ERR: validar
que el handler del listener REALMENTE se invoca antes de poner toda
la lógica de robustez dentro de él.

Casos a cubrir en QA:

- **Refresh con sesión persistida + `_pendingPageRestore='grupos'`** —
  caso original del bug. La app debe acabar mostrando grupos.
- **Refresh normal sin `_pendingPageRestore`** — welcome aparece
  inmediatamente; getSession resuelve, _bootstrapSession navega a
  grupos sobreescribiendo welcome. Sin regresión.
- **Refresh anónimo (sin sesión persistida)** — welcome aparece;
  getSession resuelve sin sesión, loader oculto, app navegable.
- **Sesión expirada con `_pendingPageRestore` obsoleto** — fallback
  H del fix limpia pending y muestra welcome.
- **Login fresco (`SIGNED_IN`)** — listener handler dispara
  _bootstrapSession con eventType='SIGNED_IN' → welcome. Sin regresión.
- **Volver de segundo plano (re-emisión SIGNED_IN)** — guard
  `currentUser.id === session.user.id` en _bootstrapSession captura
  esto: _hideBootstrapLoader + renderAuthBar + return. Evita bucle.
- **Race: listener Y getSession ambos disparan _bootstrapSession** —
  guard `_bootstrapInFlight` garantiza solo una ejecución real.

**Patrón:** todo bootstrap async basado en suscripción a eventos
necesita TRES capas, pero la ORDEN importa:

1. **Snapshot inicial vía getter explícito** (`db.auth.getSession()`).
   Cubre la sesión YA EXISTENTE al momento en que se carga el código,
   independiente de si el evento original se emitió antes del registro
   del listener. **Esta es la capa más importante** — sin ella, las
   otras dos solo aplican a cambios futuros.

2. **Listener de cambios** (`onAuthStateChange`) — cubre eventos
   posteriores al snapshot. Login fresco, logout, token refresh,
   sesión expirada por el servidor, etc.

3. **Robustez interna del bootstrap** — retry, timeout, try/finally,
   watchdog. Cubre fallos transitorios DENTRO del flujo de bootstrap
   una vez se invoca.

Sin (1), las capas (2) y (3) son inútiles cuando el evento de interés
ya pasó antes del registro. La iteración 1 de este fix (commit
`5405ebc`) demostró esta lección de manera dolorosa: tenía (2) y (3)
pero no (1), y el bug persistía.

Auditar otros bootstraps que sigan el patrón vulnerable "solo listener
sin snapshot":

- `mundial-shell-v3.js` listener `mundial:leagues-loaded` — dispara
  desde leagueLoadMyLeagues. Como el shell se renderiza tras auth,
  baja prioridad (auth dispara leagueLoadMyLeagues que dispara el
  event); pero si se cambia el orden de carga, se rompería.
- `loadUserData` interno (no auditado en este PR) — si hace varios
  fetches encadenados sin timeout, puede dejar predicciones sin cargar.
  Backlog futuro.

### Iteración 3 (commit nuevo) — `#restore-lock-css` bloqueando welcome era la causa raíz REAL; iter 1+2 atacaban consecuencias

QA de San en preview Vercel (Chrome MCP, leyendo waterfall + DOM inspection
durante el blank state) **iter 2 NO resuelve el bug**. Diagnóstico inicial
(IA Predictor bloqueando) fue descartado tras challenge mutuo:
`loadIAPredictions` está dentro del `Promise.all` de `loadUserData` (auth.js:131),
que en Path 2 ya estaba envuelto en `_withTimeout(..., 10000)`. En Path 1
(`leagueSelect`) es fire-and-forget — no bloquea `showPage`. `showPage()`
es síncrono y `v3GruposMount` también: no hay path que la IA bloquee.

La causa raíz REAL la descubrió Code en grep audit + verificada por San
en consola del browser durante reproducción del blank:

**`#restore-lock-css` bloquea TODOS los fallback `showPage('welcome')` del
bootstrap, Y el watchdog estaba gateado por presencia del loader (que se
oculta en todos los caminos de fallback antes del watchdog disparar).**

#### El lock

En `index.html:36-45` (inline script ejecutado en parse time, ANTES de
cualquier JS bundle):

```js
var lp = localStorage.getItem('porra_lastPage');
if (lp && ['grupos','elim','score','admin','perfil','jornada','directo','predictor'].indexOf(lp) !== -1) {
  window._pendingPageRestore = lp;
  var st = document.createElement('style');
  st.id = 'restore-lock-css';
  st.textContent = '#page-welcome{display:none !important}';
  document.head.appendChild(st);
}
```

Si el usuario tiene `porra_lastPage` guardado (es decir, ha navegado
alguna vez a una página no-welcome), se inyecta un `<style>` con
`#page-welcome { display:none !important }`. Propósito original (v2.9):
evitar flash de welcome al cargar antes de que el handler de auth
ejecutara `showPage(target)`.

En `ui-nav.js:506-508` (showPage):

```js
var _lockCss = document.getElementById('restore-lock-css');
if (_lockCss && page === 'welcome') return;     // <-- early-return si lock+welcome
if (_lockCss && page !== 'welcome') _lockCss.remove();
```

El lock se quita SOLO cuando se llama `showPage(non-welcome)`. Si TODOS
los caminos del bootstrap fallan y caen a `showPage('welcome')`, ese
showPage hace early-return sin renderizar nada. Ninguna `#page-*` queda
en `display:block`. Todas tienen `style="display:none"` inline (HTML
default, ver index.html:303,532,546,...).

Resultado: **pantalla en blanco permanente**. El lock nunca se quita
porque ningún `showPage(non-welcome)` se ejecuta. Verificado por San
durante reproducción:

- `document.getElementById('restore-lock-css')` → existe
- `getComputedStyle(#page-welcome).display` → `'none'`
- Las 8 `#page-*` (welcome/grupos/jornada/directo/predictor/elim/score/admin)
  → TODAS `display:none`
- Test causal: `document.getElementById('restore-lock-css').remove();
  showPage('grupos')` → `#page-grupos` pasa a `display:block` y aparecen
  las 7 cards. Confirma diagnóstico.

#### El watchdog gateado por loader oculto

El watchdog de iter 2 (auth.js:474-480 antes de iter 3):

```js
setTimeout(function () {
  if (document.getElementById('_auth-bootstrap-loader')) {  // <-- trigger frágil
    _hideBootstrapLoader();
    try { if (typeof showPage === 'function') showPage('welcome'); } catch (e) {}
  }
}, 12000);
```

El trigger depende de que el loader siga visible. Pero `_hideBootstrapLoader`
se llama en TODOS los caminos de fallback ANTES del watchdog (en
`_onNoSessionFromGetSession`, en el listener no-session branch, en
`_markNavigated`, en la red final del `try/finally` de
`_bootstrapSession`). Verificado: hay 8 sitios donde se llama
`_hideBootstrapLoader`. Cuando el bug aparece, el loader siempre está
oculto y el watchdog NUNCA dispara.

Y aunque disparara, su `showPage('welcome')` estaría también bloqueado
por el lock.

#### Por qué iter 1 y 2 fallaron

**Iter 1** (`5405ebc`): añadió retry/timeout/`_navigated` DENTRO del
handler de `onAuthStateChange`. No corregía el bug porque el handler ni
siquiera se ejecutaba (race de listener tardío — diagnóstico de iter 2).

**Iter 2** (`1b25ef1`): extrajo `_bootstrapSession`, añadió
`db.auth.getSession()` explícito tras registrar listener, watchdog
incondicional. Hizo que el bootstrap SÍ corriera, pero todos los
fallbacks seguían siendo `showPage('welcome')` directos. El lock los
bloqueaba. El watchdog que debía rescatar estaba gateado por loader
que ya estaba oculto.

**Iter 3** (este commit): ataca la causa raíz real (el lock) Y blinda
el watchdog con trigger semántico ("¿hay alguna `#page-*` visible?").

#### Fix iter 3

**A) Helper `_navigateFallbackWelcome()`** dentro de `runAuthInit`:

```js
const _navigateFallbackWelcome = () => {
  _hideBootstrapLoader();
  const _lock = document.getElementById('restore-lock-css');
  if (_lock && _lock.parentNode) _lock.parentNode.removeChild(_lock);
  try { if (typeof showPage === 'function') showPage('welcome'); } catch (e) {}
};
```

Quita el lock ANTES de `showPage('welcome')`. Reemplaza la combinación
`_hideBootstrapLoader()` + `showPage('welcome')` en los 4 sitios críticos:

1. Fall-through de `_bootstrapSession` Path 2 (admin rejected → finalPage='welcome').
2. Red final del `try/finally` interno (excepción inesperada).
3. Listener `else` branch (sesión nula / SIGNED_OUT durante bootstrap).
4. `_onNoSessionFromGetSession` (getSession sin sesión / timeout).

**B) Watchdog redesignado** con trigger semántico:

```js
setTimeout(function () {
  const _PAGES = ['welcome','grupos','jornada','directo','predictor','elim','score','admin'];
  const anyVisible = _PAGES.some(function (p) {
    const el = document.getElementById('page-' + p);
    return el && el.style.display !== 'none' && el.style.display !== '';
  });
  if (!anyVisible) {
    console.warn('[auth.bootstrap] watchdog 12s: ninguna #page-* visible. Forzando welcome (quita lock).');
    _navigateFallbackWelcome();
  }
}, 12000);
```

Trigger correcto: invariante "ninguna `#page-*` con `style.display:block`".
Cubre TODOS los caminos de fallback presentes y futuros sin enumerarlos.
Las 8 `#page-*` parten con `style="display:none"` inline (HTML default
en index.html:303,532,546,...), por tanto el check `!== 'none'`
distingue páginas activadas vs estado inicial / fallback bloqueado.

Acción: `_navigateFallbackWelcome` (quita lock + welcome). Sustituye
el rol del propuesto B (auto-expire del lock en index.html inline) que
San había planteado — descartado porque quitar el lock sin re-renderizar
no recupera la app (el `showPage('welcome')` ya retornó early antes de
B disparar).

**C) Mejora UX opcional: `loadIAPredictions` con `Promise.race` 6s**
(auth.js:131-145). Acorta la ventana de espera cuando IA cuelga:
si tarda >6s, `iaMap = {}` y el `Promise.all` de `loadUserData`
continúa sin bloquear. NO es el fix del blank (la IA NO bloqueaba
`showPage` en ningún camino), solo polish de tiempo de respuesta en
red lenta.

#### Lecciones acumuladas (3 iteraciones)

1. **Iter 1 → iter 2**: validar que el handler de un listener REALMENTE
   se invoca antes de poner toda la lógica de robustez dentro. Patrón
   Supabase v2: `getSession()` snapshot inicial + `onAuthStateChange`
   para cambios futuros.
2. **Iter 2 → iter 3**: el QA en browser real (Chrome MCP + DOM
   inspection durante el blank) es lo único definitivo. Las hipótesis
   sobre "qué debería bloquear" (IA, fetch, etc.) se confirman SOLO
   leyendo el DOM en el estado del bug. Si la página está oculta,
   inspeccionar TODOS los mecanismos que pueden ocultarla — incluido
   CSS inyectado (lock) que no aparece en grep de showPage.
3. **General**: cuando un watchdog/safety-net no dispara, su trigger
   está mal definido. Usar invariantes semánticos del estado de la
   UI ("¿hay algo visible?") en lugar de proxies (loader presente).

#### Patrón

Cuando una UI tiene un "lock" o "guard" que previene una navegación
default mientras espera un evento async:

1. **El lock DEBE auto-expirar** o ser quitado por un mecanismo
   independiente de los caminos que originalmente lo respetaban.
2. **Cualquier fallback que navegue a la URL/página guardada por el
   lock DEBE quitarlo primero**. Confiar en que la navegación normal
   lo quitará es asumir que la navegación normal sucederá — exactamente
   lo que el lock está condicionando.
3. **El watchdog que rescata del fallo del bootstrap DEBE usar un
   trigger semántico de "estado bloqueado"** (ninguna página visible,
   ningún content interactivo), no un proxy del progreso del bootstrap
   (loader presente, flag interno). El proxy se sincroniza con el
   bootstrap y puede falsear "todo bien" cuando no lo está.

Aplicado en: `public/js/auth.js` (`runAuthInit` con
`_navigateFallbackWelcome` + watchdog re-diseñado + `loadIAPredictions`
con timeout 6s, rama `fix/auth-bootstrap-frozen-refresh`, 31-may-2026,
3 iteraciones: `5405ebc` (retry/timeout/watchdog DENTRO del handler —
insuficiente, handler no corría) → iter 2 `1b25ef1` (extract +
getSession + watchdog incondicional — handler ya corría pero fallbacks
bloqueados por lock) → iter 3 (lock quitado en cada fallback +
watchdog con trigger semántico — blank resuelto pero regresión UX:
app aterriza en welcome en lugar de restaurar grupos).

### Iteración 4 (commit nuevo) — fix regresión UX: app aterriza en welcome en lugar de restaurar la última página

QA de San en preview Vercel (Chrome MCP) iter 3 resolvió el blank
correctamente (`#restore-lock-css` se quita, `#page-welcome` queda
visible). PERO introdujo regresión de UX: tras F5 con sesión + liga
activa + `porra_lastPage='grupos'`, la app SIEMPRE aterriza en
welcome en lugar de restaurar grupos. Medido:

- Pre-refresh: `_activeLeague=8017e591-...`, `#page-grupos` visible
  con 7 cards, `porra_lastPage='grupos'`.
- Post-refresh: `visible_pages=['page-welcome']`, `getActiveLeagueId()=null`,
  `match_cards=0`, `porra_lastPage=null` (cleared por
  showPage('welcome')).
- TODAS las queries Supabase 200 (incluidas `ia_predictions`,
  `league_members`, `leagues`). NO es timing de fetch — las ligas SÍ
  cargan, pero la restauración a grupos no se completa → cae al
  fallback welcome.

**Causa raíz** (combinación de dos issues):

#### 1) Listener fire premature INITIAL_SESSION sin sesión

`supabase-js v2` a veces emite `INITIAL_SESSION` al registrar el
listener ANTES de terminar de restaurar la sesión persistida desde
`localStorage`. El evento llega con `session=null`. El handler en
iter 3:

```js
if (!session?.user) {
  currentUser = null;
  window._porraToken = null;
  try { sessionStorage.removeItem('porra_token'); } catch (e) {}
  _hideBootstrapLoader();
  if (window._pendingPageRestore) {
    window._pendingPageRestore = null;          // <-- BUG: nullify prematuro
    _navigateFallbackWelcome();                 // <-- BUG: welcome prematuro
    try { if (typeof initWelcome === 'function') initWelcome(); } catch (e) {}
  }
  renderAuthBar();
  updateCTAs();
}
```

Trata el null como "no hay sesión", nullifica `_pendingPageRestore`
y muestra welcome. PERO la sesión SÍ existe — supabase aún no la ha
cargado del storage.

#### 2) `leagueSelectById` redundante con timeout vulnerable

Cuando `getSession()` explícito LATER resuelve con sesión válida y
`_bootstrapSession` Path 1 corre con `_foundLeague=true`, el código
de iter 3 hacía:

```js
await _withTimeout(leagueSelectById(savedLeagueId), 8000, '...');
```

`leagueSelectById` internamente (`leagues.js:75`) hace un SEGUNDO
`await leagueLoadMyLeagues()` — redundante porque la retry loop
arriba YA populó `_myLeagues` y `_foundLeague` YA fue validado.
Ese segundo fetch puede colgarse en network jitter → `_withTimeout`
rechaza tras 8s → catch → fall-through a Path 2.

Path 2 lee `target = window._pendingPageRestore`. **Si el listener
prematuro lo nullificó (issue #1), `target=null` → `finalPage='welcome'`
→ `showPage('welcome')`**. App aterriza en welcome aunque tenía
sesión válida + savedLeagueId válido + ligas cargadas.

`_activeLeague=null` porque `leagueSelect` nunca se llamó dentro de
`leagueSelectById` (timed out antes).

#### Fix iter 4 (dos cambios coordinados)

**A) Listener: distinguir eventos prematuros vs acción explícita**

Solo SIGNED_OUT y USER_DELETED disparan clear+welcome. Otros eventos
sin sesión (INITIAL_SESSION sin sesión, USER_UPDATED sin sesión) se
ignoran con `console.debug`. `getSession()` explícito (y
`_onNoSessionFromGetSession`) es la fuente autoritativa de "¿hay
sesión?" — supabase-js v2 `getSession()` SÍ espera a que la
restauración persistida termine antes de resolver, así que su
respuesta es confiable.

```js
if (!session?.user) {
  if (event === 'SIGNED_OUT' || event === 'USER_DELETED') {
    // clear + welcome
  } else {
    console.debug('[auth] evento sin sesión ignorado (esperando getSession): ' + event);
  }
}
```

**B) Path 1 llama `leagueSelect` directo (no `leagueSelectById`)**

`_foundLeague` YA fue validado contra `_myLeagues` poblado por la
retry loop. No hay razón para hacer otro `leagueLoadMyLeagues` dentro
de `leagueSelectById`. Llamamos `leagueSelect(_foundLeague)`
directamente — síncrono, sin timeout, sin riesgo de hang.

```js
if (_foundLeague) {
  try {
    leagueSelect(_foundLeague);  // síncrono, sin _withTimeout
    _markNavigated();
  } catch (err) {
    console.warn('[auth.bootstrap] leagueSelect falló:', err.message);
  }
}
```

**Por qué la combinación A+B**: cualquiera de los dos por separado
podría dejar el bug expuesto en ciertos timings. A elimina el null
prematuro de `_pendingPageRestore`; B elimina la ventana de fallo
del segundo `leagueLoadMyLeagues`. Juntos, blindan la restauración
desde dos ángulos.

#### Verificación pendiente (San en preview)

- F5 con sesión + liga + `porra_lastPage='grupos'` → restaura grupos
  (`page-grupos` visible, cards>0, `getActiveLeagueId()` no null).
  **NO welcome**.
- F5 con IA lenta / fetch simulado timeout → fallback welcome SIN
  blank (preserva fix iter 3, no regresión del lock removal).
- Anónimo (sin `porra_lastPage`) → welcome correcto, sin lock.
- Login fresco (`SIGNED_IN` con sesión) → welcome por semántica
  (sin regresión).
- Logout real (`SIGNED_OUT`) → clear + welcome (sin regresión).
- Background return (re-emisión SIGNED_IN para mismo user) → guard
  `currentUser.id===session.user.id` evita bucle (sin regresión).
- Sin blank en ningún caso (iter 3 preservado).

#### Lección iter 4

**No todos los eventos de "no hay sesión" son iguales**. Distinguir:
- **Eventos definitivos** (SIGNED_OUT, USER_DELETED, sesión expirada
  confirmada): el usuario ya no está autenticado → clear + navegar
  a welcome.
- **Eventos prematuros** (INITIAL_SESSION sin sesión, USER_UPDATED
  sin sesión durante arranque): el cliente aún no ha terminado de
  restaurar la sesión persistida → ignorar, esperar a la fuente
  autoritativa (`getSession()` explícito).

Tratar todos los nulls como "no hay sesión" es una sobre-interpretación
del evento que puede causar navegaciones prematuras a estados que
luego compiten con el bootstrap real.

**Lección adicional**: eliminar awaits redundantes. Si un dato ya
está en memoria (`_myLeagues` poblado por la retry loop), no
re-fetchearlo abre una ventana de timing para fallar. `leagueSelect`
directo es siempre preferible cuando ya tenemos el objeto league.

Aplicado en: `public/js/auth.js` (listener no-session filter +
`leagueSelect` directo en Path 1, rama `fix/auth-bootstrap-frozen-refresh`,
31-may-2026, 4 iteraciones acumuladas).

### Iteración 5 — DESCARTADA tras QA (commit `1da350a` NO mergeado a main)

Tras iter 4, San reportó: "Sigue llevando al selector de ligas el
refresco, independientemente de la pantalla en la que estes." La hipótesis
de iter 5 fue que `js/main-entry.js:114-115` (safety-net welcome del chain
final) **pisaba** el `showPage('grupos')` del bootstrap. Cambio
propuesto: añadir un segundo gate por visibilidad de cualquier `#page-*`.

**QA en preview Vercel demostró que la hipótesis era falsa.** San
instrumentó un wrapper persistente sobre `window.showPage` para registrar
TODAS las llamadas durante el F5. Resultado: **`showPage('grupos')` NI
SIQUIERA SE LLAMA** en el escenario. Por tanto el safety-net de
main-entry no estaba pisando nada. iter 5 atacaba un culprit falso para
ese síntoma.

Razón estructural por la que `showPage('grupos')` no se llama: el
bootstrap (`_bootstrapSession` Path 1) no completa la cadena `getSession()
→ retry leagueLoadMyLeagues → _foundLeague → leagueSelect → showPage('grupos')`
en el orden+timing necesario. Sin escarbar más, queda fuera de la
investigación porque la decisión de producto (abajo) cambió el alcance.

**Lección iter 5: validar empíricamente que el código que asumes corre
realmente corre, antes de teorizar overrides.** Wrapping persistente
sobre funciones críticas (`showPage`, `leagueSelect`, etc.) durante QA
permite descartar hipótesis sin escribir código de fix. Es lo que iter
1-4 deberían haber hecho ANTES de cada commit en lugar de razonar sobre
el flujo desde grep.

### Cierre del saga — decisión de producto

**Bug crítico (la pantalla en blanco tras F5) RESUELTO en producción
vía PR#125 (squash `6e7c966`).** Esa parte es definitiva: iter 3
identificó la causa raíz del BLANK (`#restore-lock-css` + `showPage`
early-return) y aplicó el fix (`_navigateFallbackWelcome` + watchdog
semántico). iter 4 cerró el flanco del listener `INITIAL_SESSION` con
`session=null` prematuro.

**Sub-síntoma "aterriza en selector de ligas tras F5":** persistió
tras iter 4, pero **NO es bug crítico** — es UX accesoria. Decisión
San (producto): el feature de persistir pantalla vía `porra_lastPage`/
`_pendingPageRestore` (nacido `feat(nav)` 20-abr) es frágil. Aterrizar
en el selector de ligas tras refresh es comportamiento ACEPTABLE.
Cuando algún día se retome "restaurar pantalla", será como FEATURE
nuevo con spec limpia, no parcheando el bootstrap.

**Persistencia de DATOS intacta.** Las predicciones (216 grupos + 96
KO verificadas en Supabase) nunca estuvieron en riesgo. Lo único que
se reseteaba al aterrizar en welcome era la `_activeLeague` en memoria,
que se restaura tras re-seleccionar la liga.

**Rama `fix/auth-bootstrap-frozen-refresh` borrada** tras este commit
solo-docs. Los 5 commits de iteración (incluido el iter 5 descartado)
quedan visibles en el historial del PR#125 mergeado.

### Recap completo de las 5 iteraciones (referencia futura)

| Iter | Commit | Hipótesis | Resultado |
|---|---|---|---|
| 1 | `5405ebc` | Transient de `leagueLoadMyLeagues` + falta de timeouts en `await`s | INSUFICIENTE — el handler de `onAuthStateChange` nunca corría (race de registro tardío) |
| 2 | `1b25ef1` | Race del listener: `INITIAL_SESSION` emitido antes del registro. Fix: `getSession()` explícito + bootstrap extraído | INSUFICIENTE — handler ya corría pero fallbacks `showPage('welcome')` bloqueados por lock CSS |
| 3 | `27e732b` | `#restore-lock-css` bloquea `showPage('welcome')` en fallback + watchdog gateado por loader oculto | **CAUSA RAÍZ DEL BLANK — fix definitivo.** Mergeado en `6e7c966` |
| 4 | `7156725` | INITIAL_SESSION con `session=null` prematuro nullifica `_pendingPageRestore` + `leagueSelectById` con leagueLoadMyLeagues redundante | Cierre del flanco listener prematuro. Mergeado en `6e7c966` |
| 5 | `1da350a` | `main-entry.js:114-115` safety-net pisa `showPage('grupos')` del bootstrap | **DESCARTADA tras QA**: `showPage('grupos')` ni se llama. Culprit falso. NO mergeado |

### Patrón general derivado de la saga

**Cuando un bug se vuelve intermitente con `readyState` o timing
async/sync, las hipótesis sobre "qué bloquea" / "qué pisa" / "qué se
ejecuta antes" se confirman SOLO instrumentando el navegador en el
estado del bug**, no leyendo código. Wrappers persistentes sobre
funciones de control (`showPage`, `leagueSelect`, listeners, etc.) +
DOM inspection durante el F5 son obligatorios antes de cada commit
de fix. iter 1-4 razonaron sobre el flujo desde grep y acertaron solo
una vez (iter 3) — el resto fueron correcciones de hipótesis
incorrectas a las dos iteraciones de atrás.

Aplicado en: `public/js/auth.js` (iter 3+4 mergeados en `6e7c966`),
`js/main-entry.js` (iter 5 NO mergeado, descartado), rama
`fix/auth-bootstrap-frozen-refresh` cerrada el 01-jun-2026. ERR-78
es histórico — el bug crítico está resuelto en prod.


## ERR-79 — El motor (`_shared/scoring.mjs`) era correcto; el bug vivía 100% en el ENSAMBLADO de la EF

> Nota: catalogado originalmente como ERR-77 en la rama PR-1 antes del
> merge con main. Renumerado a ERR-79 al integrar (main ya había usado
> 77 para `renderPanelPais` y 78 para auth-bootstrap). Los comentarios
> en `supabase/functions/get-league-standings/index.ts` y
> `tests/scoring.test.mjs` apuntan al número original; coherencia
> textual a tratar en el sprint de reconciliación de motores (CLAUDE.md
> Backlog #5).

**Reformulación (01-jun, sprint B2 / PR#127):** el motor compartido
`_shared/scoring.mjs` NUNCA estuvo mal — su paridad 1:1 con `public/js/scoring.js`
está cubierta por `tests/scoring.test.mjs`. **Todos los fallos de puntuación de
PR-1 fueron de ENSAMBLADO** en `get-league-standings/index.ts` (la capa que lee
de BD y construye los objetos que entrega al motor). El arreglo correcto fue
siempre en la EF, no en el motor. Dos olas:
- **v1.0.1** — `scorer`→`gol` en los 2 mapeos (predsByUser + koByUser); el +2 de
  goleador empieza a sumar.
- **v1.1.0 (B2)** — cierra los huecos de ensamblado restantes **sin tocar el
  motor**: (1) reader *type-tolerant* `asObj()` sustituye los 3 `JSON.parse` →
  acepta TEXT u objeto ya parseado (sobrevive a la migración `results`→jsonb de
  P1); (2) **boost ×2 grupos** desde `boost_picks` (`boostByUser[uid]` = Set de
  `match_id`); (3) **merge de `results.overrides`** ENCIMA del canónico de grupos
  por clave. KO queda sin boost (pendiente backend).

**Síntoma:** PR-1 v1.0.0 — la EF `get-league-standings` devolvía los puntos
de fase de grupos y KO SIN sumar el +2 del goleador acertado. Para un
usuario con muchos goleadores correctos, la diferencia respecto al
cliente legacy (que sí los sumaba) era importante. Detectado por San en
QA del source desplegado.

**Causa:** las tablas `predictions` y `ko_predictions` guardan el goleador
en la columna `scorer`. El motor `_shared/scoring.mjs` lee `pred.gol`
(espejo del browser `public/js/scoring.js`). En `get-league-standings`
v1.0.0 los objetos pred del backend se montaban como
`{ l, v, scorer: row.scorer, saved: true }`, así que el motor nunca
encontraba `pred.gol` y el bloque `if (pred.gol) { ... pts += 2 }` no
disparaba. El cliente original `scoreboard.js` SÍ hacía el mapeo
`{ l, v, gol: p.scorer, saved: true }` (de ahí la divergencia).

**Fix (v1.0.1):** en `index.ts` de la EF, cambiar `scorer:` por `gol:`
en los 2 mapeos (predsByUser + koByUser) y actualizar las interfaces TS.
Bump version 1.0.0 → 1.0.1 + redeploy.

**Test de regresión:** los tests del motor puro (`tests/scoring.test.mjs`
secciones 1-6) NO detectaron este bug porque pasaban `gol:` directamente
al motor — no ejercían el ENSAMBLADO de la EF. Añadida sección 7
"EF ASSEMBLY" con un guard que:
  - Replica `mapPredFromDbRow({local, visitante, scorer}) → {l, v, gol, saved}`.
  - Verifica que con scorer acertado el motor suma +2.
  - **Asserts inverso**: si alguien revierte el mapeo y deja `scorer` raw,
    el motor NO suma goleador → marca el caso explícitamente como
    REGRESIÓN para que sea obvio en el output de fallo.

**Patrón:** cuando un motor consume datos de BD (u otra capa), los tests
del motor puro NO bastan. Necesitan tests de ENSAMBLADO que ejerzan el
mapeo BD→motor (mock de la row + función mapeo + assert sobre el output).
Aplica también a EFs que portan motores compartidos: cualquier mapping
silencioso (rename de campo, tipo distinto, formato distinto) puede
introducir un cero/null que el motor trata como "ausente" sin error.

**Backlog asociado:** reconciliar la **tabla canónica de puntuación**
entre `public/js/scoring.js` (browser) y `supabase/functions/_shared/scoring.mjs`
(server). Repasar cada suceso acertado al 100%:

| Suceso              | Pts | Apila/Solo | Browser ✓ | Shared ✓ |
|---------------------|----:|------------|-----------|----------|
| Signo (1·X·2)       |  +1 | base       | sí        | sí       |
| Exacto              |  +3 | APILA sobre signo | sí | sí    |
| Goleador            |  +2 | apila      | sí        | sí (v1.0.1) |
| Bonus vs IA         |  +1 | apila (solo grupos) | sí | sí |
| Cap por partido     |   7 | (pre-boost) | sí       | sí       |
| Boost ×2            |  ×2 | solo si exacto + boost-day | sí | sí (v1.1.0, grupos; KO pdte) |
| Avance r32          |  +5 | KO        | sí        | sí       |
| Avance r16          | +10 | KO        | sí        | sí       |
| Avance qf           | +15 | KO        | sí        | sí       |
| Avance sf           | +20 | KO        | sí        | sí       |
| Final advance bonus | +25 | extra en sf si avanza | sí | sí |
| Equipo pasa grupos  |  +5 | calcGroupsAdvancePoints | sí | (no usado aún) |
| Premios individuales| 15/15/15/20 | calcAwardPoints | sí | sí |
| Clasificación final | 30/20/15/10 | calcClassificationPoints | sí | sí (no usado aún) |

Acción pendiente (residual tras B2): el ensamblado y la paridad de motores
quedan resueltos — `tests/scoring.test.mjs` extiende la paridad shared↔legacy a
las 3 funciones (`calcMatchPoints`/`calcKOMatchPoints`/`calcAwardPoints`) + casos
de boost exacto ×2, iaBonus y el wiring de ensamblado del boost. Quedan **2
cosas**: (1) **boost ×2 en KO** (backend; hoy solo grupos); (2) trasladar esta
tabla canónica a `docs/scoring-engine.md`. Backlog #5 (CLAUDE.md).


## ERR-80 — `window.currentUser` no expuesto: `let` top-level no crea propiedad en window (myId undefined)

**Síntoma:** PR-1 — la pantalla Clasificación (`page-score`) mostraba el
podio + 9 filas pero el bloque `#sb-my-breakdown` quedaba con
`display:none` y `#sb-breakdown-cards` vacío. Como consecuencia, la
tarjeta "Premios" del desglose nunca se renderizaba → el re-home del
picker de premios desde el botón trofeo del Predictor quedaba sin
entrada accesible con la porra abierta.

**Causa:** en `sbRender` (`public/js/scoreboard.js:138`), el render
Trofeo entregado por San leía `(window.currentUser || {}).id`. Pero
`currentUser` se declara como `let currentUser = null` top-level en
`auth.js:51`. La regla ERR-02 dice que **`let`/`const` top-level en
classic scripts NO se exponen como propiedad de `window`** (sólo `var`
o asignación explícita lo hacen). Grep confirmó que `window.currentUser
=` nunca se asigna en el repo. Resultado runtime:
`window.currentUser → undefined`, `(undefined || {}).id → undefined`,
`myId = undefined`. El bloque `if (myId) { if (me) { ... } }` saltaba
entero — el desglose nunca se pintaba.

Bug oculto adicional: la tabla seguía mostrando la fila propia con
`is-me` por residuo de un render anterior (innerHTML del listado se
sustituye en cada render, pero el resaltado había venido de una sesión
previa con cache del browser). Inducía a pensar que `myId` funcionaba.

**Fix:** Opción B aprobada por San (lookup + degradación elegante).
- `scoreboard.js:138` ahora usa el patrón ya presente en
  `ui-groups-mobile.js:490` y `data.js:256`:
  ```js
  const myId = (typeof currentUser !== 'undefined' && currentUser
    ? currentUser.id : null)
    || (window.currentUser && window.currentUser.id)
    || null;
  ```
  Lee la variable global del scope compartido de classic scripts; el
  fallback a `window.currentUser` cubre el caso de que algún día se
  exponga explícitamente.
- Degradación: el bloque `if (myId) { if (me) { ... } }` queda
  eliminado. El desglose se pinta **siempre** con porra abierta —
  `me = (myId && rows.find(...)) || { grpPts:0, koPts:0, awPts:0, total:0 }`.
  Para usuarios sin pronósticos (`hasPreds=false` → la EF filtra del
  payload), el desglose muestra 0/0/0/0 — display puro, no engañoso. La
  tarjeta "Premios" sigue siendo tappable cuando `!window._porraCerrada`.

**Patrón:** en classic scripts (no module), **NUNCA** asumir que un
`let`/`const` top-level de OTRO fichero está en `window`. Verificar
con grep `window\.<nombre>\s*=` antes de leer. Si el `let` debe estar
disponible globalmente desde una función concreta:
1. Patrón seguro: leer la variable directamente (vive en el scope global
   compartido de classic scripts) con guard `typeof x !== 'undefined'`.
2. Patrón explícito: asignación `window.x = x` tras la declaración.
3. **Antipatrón**: `window.x` confiando en que el `let` se expone (no
   se expone).

Aplica también a `const` (ERR-02). Si el código viene de un entregable
externo (mockup, fichero de diseño aislado) que asume DOM/window
estándar, conviene auditarlo contra la regla ERR-02 al integrarlo —
fue el origen de este bug en PR-1 (el render Trofeo entregado por San
usaba `window.currentUser` esperando que existiera).


## ERR-81 — Clipping de esquinas + box-shadow exterior por `overflow:hidden` en contenedor ancestor

**Síntoma:** PR-1 — la fila #1 (`.tf-row.top1` con borde dorado, o
`.tf-row.is-me` con borde lime) de la "Clasificación completa" mostraba
sus **esquinas superiores recortadas** en todas las ligas. El box-shadow
exterior del resaltado también aparecía truncado en el borde superior.
Diagnóstico inicial mal apuntado a `.tf-hero` (podio top-3) por similitud
visual + a un solape del `.sb-table-header` legacy + a un trazo inset
rectangular incompatible con `border-radius:16px`. Las 3 iteraciones
previas resolvieron problemas tangenciales pero NO el clipping.

**Causa real (runtime QA San):** el contenedor `.sb-table` (legacy del
admin.css scoreboard original) tenía `overflow:hidden` heredado:
```css
.sb-table { background:#111827; border:1px solid #1f2937;
            border-radius:16px; overflow:hidden; }
```
La primera `.tf-row` quedaba pegada al borde superior del `.sb-table`
(sin aire arriba). Como `overflow:hidden` recorta TODO lo que sobresale
del rectángulo padre, las esquinas redondeadas (`border-radius:11px`) y
el `box-shadow` exterior de la fila se cortaban en la línea superior del
contenedor. No era un problema de color/gradiente ni de un selector
hijo — era CONTEXTO del ancestor.

**Fix (CSS, `clasificacion-v3.css`):**
```css
#page-score .sb-table { background:none; border:0; padding:0;
                        overflow:visible; }
#page-score #sb-rows { padding-top:4px; }
```
- `overflow:visible` override del `overflow:hidden` legacy: el contorno
  redondeado + box-shadow exterior dejan de pertenecer al wrapper
  recortado y se pintan completos.
- 4px de `padding-top` en `#sb-rows` da aire arriba para que la esquina
  + box-shadow de la primera fila no se solapen con el borde del
  contenedor (aunque el clip ya no aplique, el píxel de gap visual
  ayuda).
- `gap:6px` entre filas NO se toca.

**Patrón / lección de diagnóstico:** `getComputedStyle(elemento).border`
y `.boxShadow` **NO** revelan si el ancestor está clipando ese mismo
borde/sombra. El selector hijo declara su estilo correcto pero el
ancestor lo recorta silenciosamente en runtime. Diagnóstico correcto:
1. Auditar el **ancestor chain** del elemento con `overflow` ≠ `visible`:
   ```js
   let el = target;
   while (el) {
     const o = getComputedStyle(el).overflow;
     if (o !== 'visible') console.log('clip culprit:', el, o);
     el = el.parentElement;
   }
   ```
2. Usar `document.elementFromPoint(x, y)` sobre el píxel exacto del
   borde "fantasma" — devuelve el elemento que realmente ocupa ese
   píxel (el ancestor recortando, no el hijo declarado).
3. NO sumar opacity/grosor/inset shadows al hijo para "tapar" el
   recorte — eso oculta el síntoma, deja el bug latente en cualquier
   otro elemento que herede el mismo ancestor clipper.

Aplicado en `public/css/clasificacion-v3.css` (PR-1 iter 4, commit
`cc4d2c5`). Iteraciones falsas previas: `4770d18` (border `.tf-hero` a
`#c9a961`, NO era el elemento), `55de970` (eliminar `.sb-table-header`
markup, pista parcial), `cf7567c` (border `.tf-hero` + inset shadow
rectangular, incompatible con radius). Sólo el QA caliente en preview
reveló el clipper real.


## ERR-82 — Puente P4: winner KO explícito (KO por penaltis no puntuaba el avance) + guardas anti-dato-incompleto

Tres decisiones de diseño del **bloque crítico P4** (pipeline `live_scores` →
`results`, 02-jun-2026). Documentadas como patrón, no como bug en producción
(se cazaron en simulacro antes del Mundial). Pipeline completo en
`docs/live-scoring.md` §Bloque crítico.

### A · Winner KO explícito — el motor viejo no puntuaba KO por penaltis

**Síntoma (latente):** un partido de eliminatoria que termina **en empate y se
decide por la tanda de penaltis** no puntuaba el avance de ronda, aunque el
usuario hubiera acertado el clasificador. La card KO **obliga** a indicar quién
pasa, así que ese acierto debería valer `+5/+10/…`.

**Causa:** `calcKOMatchPoints` (`_shared/scoring.mjs` + `public/js/scoring.js`)
derivaba el ganador solo del marcador `l`/`v`. En empate `realWinner=null` → la
comparación contra el classifier del usuario nunca casaba → 0 puntos de avance
para TODOS, incluso quien acertó el clasificador.

**Fix (motor v1.2.0):** `calcKOMatchPoints` acepta `opts.winner`
(`'home'|'away'`) y lo usa si viene, con **fallback** a la derivación `l`/`v`
(retrocompatible). El puente calcula `winner` con `koWinner()` (marcador
no-empate → directo; empate → `score_agg` orientado por `teams_swapped`; sigue
empate → conteo de `penaltyShootout` `incidentClass='scored'` en `events`) y lo
persiste en `results.ko_results["{ko_match_id}"].winner`. `index.ts` pasa
`winner: real.winner`. Grupos no usan `winner` → sin efecto colateral.

**Validado:** simulacro empate 1-1 + tanda 6-2 → `winner:home`; el motor da `+5`
a quien predijo `classifier=home` y `0` a `classifier=away`.

### B · `penaltyShootout` EXCLUIDO de `scorers`

**Decisión de diseño (no bug):** los goles de la **tanda de penaltis** llegan en
`events` de SofaScore como `penaltyShootout`. El puente los usa para determinar
el `winner` (apartado A) pero **NO** los cuenta como goleador de la porra: un gol
en la tanda no es un gol del partido a efectos del `+2` de goleador.
`extractScorers` por tanto **excluye** `penaltyShootout` del array `scorers` (sí
cuenta `goal` + `inGamePenalty` —penalti en juego—; también ignora `ownGoal`).

### C · Guardas anti-dato-incompleto (premisa "no rectificar después")

**Decisión de diseño:** un resultado escrito en `results` es **definitivo** (no
se rectifica luego). Para no escribir resultados provisionales que habría que
corregir, el puente v4 **no escribe** y loguea el motivo en `results.log` cuando
el dato no es fiable:

| Condición | `results.log` |
|---|---|
| `score_home`/`score_away` NULL | `{event:bridge_skip, reason:score_null}` |
| clave sin entrada en ningún diccionario | `{event:bridge_skip, reason:no_dict_entry}` |
| KO empate sin ganador determinable | `{event:bridge_skip, reason:ko_winner_undetermined}` |

**Patrón:** ante un partido `finished` ausente de `match_results`/`ko_results`,
**revisar `results.log`** antes de sospechar del motor — probablemente el puente
lo saltó a propósito por dato incompleto. El barrido `sweep-unbridged-finished`
(`*/5min`) lo reintenta en cuanto el dato se complete (ver §Bloque crítico).

## ERR-83 — Cliente Supabase incorrecto rompe RLS silenciosamente

**Síntoma**: tabla con RLS basada en `auth.uid()` devuelve `[]` en SELECT y falla silenciosamente en INSERT pese a sesión activa. El `catch` solo hace `console.warn`, no propaga.

**Causa**: el proyecto tiene DOS clientes Supabase en `auth.js`:
- `getDb()` / `window._porraDb`: cliente AUTH para login/sesión (NO lleva `accessToken`).
- `getQueryDb()` / `window._porraQueryDb`: cliente QUERY con `accessToken: async () => window._porraToken`.

Si por error se usa el cliente AUTH para `.from(...).select()` o `.upsert()`, `auth.uid()` resuelve a NULL → RLS rechaza pero el error es silencioso en SELECT (devuelve `[]`) e indistinguible de "0 filas legítimas" en INSERT con `onConflict`.

**Fix**: usar siempre `getQueryDb()` para queries de datos (`savePredictions`, `saveKOPredictions`, `saveAwPicks` ya lo hacen). Alternativa robusta: `const db = (typeof getQueryDb === 'function') ? getQueryDb() : window._porraDb;`.

**Patrón detectable**: `const db = window._porraDb;` seguido de `.from(<tabla con RLS>)`. Auditar con grep.

**Caso real**: PR #139 (08-jun), `data.js` L256/L285 (`saveBoostPicks`/`loadBoostPicks`). Bug latente desde lanzamiento; impacto: `boost_picks` vacía para todos los usuarios.

## ERR-84 — `window.currentUser` nunca asignado por declaración `let` en script clásico

**Síntoma**: código que lee `window.currentUser?.id` siempre obtiene `undefined`, aunque la sesión esté activa y `currentUser` (sin `window.`) tenga valor correcto en consola.

**Causa**: `auth.js` declara `let currentUser = null` a nivel top-level. En scripts clásicos (no módulos ES), las declaraciones `let`/`const` van al "script global record" pero NO al objeto `window`. Por tanto:
- `currentUser` directo: accesible cross-script gracias al scope global de script clásico ✓
- `window.currentUser`: siempre `undefined` ✗

Las funciones que asumen lo segundo (`if (!uid) return;` con `uid = window.currentUser?.id`) salen silenciosamente.

**Fix preferido**: asignar `window.currentUser = currentUser` en `auth.js` tras cada mutación de `currentUser`. Un cambio en una función repara todos los call sites afectados.

**Fix alternativo (por call site)**: cambiar `window.currentUser?.id` por `currentUser?.id` (o defensivo: `(typeof currentUser !== 'undefined' && currentUser?.id) || window.currentUser?.id`).

**Patrón detectable**: grep `window.currentUser?.id` y `window.currentUser && window.currentUser.id`. En el repo (post-#139): 3 sitios restantes en `data.js` L435 y `ui-groups.js` L807/L830 — ahora funcionan gracias al espejo pero conviene normalizar.

**Caso real**: PR #139 commit `606ea7f` (08-jun). Bug latente desde el inicio; descubierto al investigar por qué `boost_picks` seguía vacía incluso tras arreglar ERR-83.

## ERR-85 — `package-lock.json` rompe el build del actor Apify (API y `apify push`)

**Síntoma:** el build remoto del actor `sofascore-webshare-proxy` falla en `npm install`
con `exit code 243`. Dos variantes confirmadas:
- **Vía API** (`sourceType=SOURCE_FILES`, build 1.0.10, 02-jun): `operation rejected by OS`.
- **Vía `apify push`** (build 1.0.11, 10-jun): `EACCES: permission denied, open
  '/home/myuser/package-lock.json'` — npm corre como `myuser` e intenta reescribir el
  lockfile copiado como root (lockfile desincronizado → `saveIdealTree` → writeFile).

**Causa raíz común:** un `package-lock.json` presente en el contexto de build que el
builder de Apify no puede regenerar/reescribir.

**Fix permanente** (build 1.0.12+, en el repo): Dockerfile copia SOLO `package.json` y
usa `--no-package-lock`:
```dockerfile
COPY package.json ./
RUN npm install --omit=dev --no-package-lock
```
Con esto el lockfile versionado en el repo deja de afectar al build por cualquier vía.

**Nota histórica:** la primera versión de esta lección (PR #131, como "ERR-82" — número
luego reasignado al puente P4) afirmaba que `apify push` no sufría el problema porque el
deploy de entonces omitía el lockfile manualmente. Refutado el 10-jun: `apify push` con
lockfile en el directorio también falla. El fix de Dockerfile cubre ambos caminos.

**Contexto operativo:** el actor NO está Git-connected — mergear un PR del repo NO
reconstruye el actor; el deploy es siempre manual (`apify push N8vUChlhok5JU3cnL`).

## ERR-86 — Agregado de liga calculado en cliente sobre tablas con RLS own-rows-only (highlights falsos)

**Síntoma**: "DESTACADOS DE TU LIGA" (Predictor) muestra frases falsas para cualquier
usuario y cualquier liga: "Tu liga tiene 0 porras cerradas / 1 pendientes" sea cual sea
el estado real (Gallos vía service_role: 17 miembros, 16 cerradas), y los items
contrarian-KO/campeón nunca o casi nunca encuentran "rivales" porque solo ven 1 fila.

**Causa**: `loadLeagueHighlights` (`data.js`) agregaba con SELECTs de cliente sobre
`ko_predictions`, `award_picks` y `league_members` filtrando por `league_id`. Las
policies de SELECT de esas tablas son `auth.uid() = user_id` → cada query devuelve como
máximo la fila propia. El agregado de liga es estructuralmente irrealizable desde el
cliente: RLS capa el resultset en silencio, indistinguible de "la liga tiene 1 miembro".
NO es bug del flag (lee el canónico `league_members.porra_cerrada`) ni de la query.
Además, el item campeón leía `award_picks.champion`, columna VACÍA (0/36 a 10-jun) —
las 4 dims pobladas son `golden_boot`/`golden_ball`/`golden_glove`/`young_player`.

**Fix** (10-jun-2026, rama `claude/highlights` → `claude/vibrant-turing-qcbhp3`): EF
`get-league-highlights` v1.0.0 (patrón F4 `get-league-predictions`: `verify_jwt=false`
ERR-16 + JWT manual + verja de membresía caller/objetivo + service_role) que computa
hasta 5 insights VERDADEROS sobre el universo real (miembros `porra_cerrada=true`;
ampliado a quien tenga predictions si hay <8 cerradas) y devuelve las frases ya
montadas `{ highlights: [{icon,text}] }` ordenadas por impacto. `loadLeagueHighlights`
reescrito a `functions.invoke` (cliente `getQueryDb`, ERR-83) con fallback genérico;
panel 3→5 tarjetas. Paginación `.range()` en predictions: Gallos 17×72=1224 filas
supera el max-rows 1000 de PostgREST — un SELECT plano habría truncado en silencio.
Nota numeración: en la rama obsoleta great-wozniak este error se anotó como "ERR-85"
(neutralización parcial de los items A/B); renumerado a 86 porque main asignó 85 al
lockfile del actor Apify (PR #146).

**Patrón detectable**: `.from('<tabla own-rows-only>')` desde cliente +
`.filter()`/`.length` pretendiendo agregar sobre TODA la liga. Tablas own-rows-only
confirmadas en SELECT: `league_members`, `predictions`, `ko_predictions`, `boost_picks`,
`award_picks`. Todo agregado de liga va por EF service_role con verja de membresía
(`get-league-standings` / `get-league-predictions` / `get-league-highlights`).

**Fecha detección**: 09-jun-2026 (great-wozniak). **Resuelto**: 10-jun-2026 vía EF.

## ERR-87 — Cache normalizada pierde campos de la row de BD (smoke sintético no valida la forma real)

**Síntoma**: las mini-rows de Directo (y la card expandida) siguen mostrando la hora
de sede (MEX-RSA 15:00, KOR-CZE 22:00, CAN-BIH 15:00) tras desplegar el fix de hora
Madrid del PR #156, en TODOS los partidos. Sin errores en consola: el código nuevo
ejecuta, pero siempre por la rama de fallback `m.date`.

**Causa**: `_kickoffMs(ctx.liveRow)` leía `liveRow.match_start_ts`, pero `liveRow` no
es la row de `live_scores`: es el objeto NORMALIZADO que construye `normalizeRow`
(`live-sync.js`) para `window._liveScoresByMatchKey`, que solo copiaba `match_key`,
`status`, scores, `events`, `minute` y `_teams_swapped` — `match_start_ts` quedaba
únicamente dentro de `.raw`. `undefined` → fallback en silencio. El smoke de Node del
PR pasó porque la row sintética del test llevaba `match_start_ts` a primer nivel: un
smoke con datos sintéticos valida la LÓGICA pero no la FORMA del dato real.

**Fix** (11-jun-2026, PR #156): (1) `normalizeRow` copia `match_start_ts: row.match_start_ts`
a primer nivel (comentario in-situ: todo campo de BD que el front consuma debe copiarse
a la row normalizada); (2) `_kickoffMs` robustecido — lee `liveRow.match_start_ts` y cae
a `liveRow.raw.match_start_ts` antes del fallback `m.date` (cubre cache vieja en
mixed-deploy y rows crudas de simulacros); (3) regresión permanente
`tests/directo-hora-madrid.test.mjs`: pasa rows REALES de `live_scores` (forma exacta
del SELECT, BIGINT segundos) por el `normalizeRow` real extraído de live-sync.js y el
resultado por el `_kickoffHoraLabel` real de ui-directo.js — MEX-RSA `21:00`,
KOR-CZE `04:00 +1`.

**Patrón detectable**: consumir un campo "nuevo" de una row cacheada sin verificar la
forma del objeto EN RUNTIME (`console.log(Object.keys(row))` en el punto de consumo, o
test que reproduzca el pipeline productor→consumidor con la row real de BD). Toda cache
intermedia que normaliza (`normalizeRow` y equivalentes) es una allowlist de campos:
si el campo no está en el objeto retornado, el consumidor ve `undefined` aunque la BD
y el SELECT lo traigan. Ante un fallback que se activa "siempre", sospechar de la forma
del dato antes que de la lógica.

**Fecha detección**: 11-jun-2026 (QA San preview PR #156). **Resuelto**: 11-jun-2026.

## ERR-88 — `liveSyncInit` latcheaba `initialized` antes de tener `_porraDb` (cache live vacía para siempre, intermitente)

**Síntoma**: las horas de Directo vuelven a ser las de sede (fallback `m.date`) en TODOS
los partidos, en una carga concreta, con el código del fix de hora (ERR-87) íntegro en
el deploy — y en la carga anterior funcionaba. Sin marcadores live ni updates realtime
en esa sesión. Re-cargar a veces lo arregla, a veces no.

**Causa**: `liveSyncInit` (live-sync.js) hacía `initialized = true` como primera
instrucción. Su ÚNICO caller es `main-entry.js` al final de la chain de `loadScript`,
UNA sola vez; el comentario del caller decía "si `_porraDb` aún no existe, saltará
silenciosamente el snapshot... auth.js puede llamar manualmente" — pero nadie re-llama
(grep: cero callers más), y aunque lo hicieran, `if (initialized) return` lo convertía
en no-op. Si el bootstrap de auth iba lento en esa carga (frío, red), snapshot y
subscribe se saltaban con un warn y `_liveScoresByMatchKey` quedaba `{}` para siempre:
`_kickoffMs` → fallback, sin live scores, sin realtime. Race dependiente del timing →
intermitente. El mismo problema de arranque que ya documentaba `checkIsAdmin`
(ui-directo.js) para el flag admin. El path `loadMatchesJson` fallido también moría
latcheado (`return` con `initialized=true`).

**Fix** (11-jun-2026, PR #156): `liveSyncInit` solo latchea cuando `window._porraDb`
existe; sin db programa reintento (`setTimeout` 500 ms, máx 20 ≈ 10 s, patrón
`checkIsAdmin`); si `loadMatchesJson` falla, des-latchea (`initialized=false`) y
reintenta. Regresión `tests/live-sync-init-retry.test.mjs`: ejecuta el live-sync.js
REAL completo en sandbox VM (window/fetch/setTimeout stub) y reproduce la race (db
aparece tras 2 reintentos → cache poblada con `match_start_ts` a primer nivel), el
fetch transitorio del JSON y el abandono tras tope con warn.

**Patrón detectable**: módulo con init one-shot (`if (initialized) return; initialized = true`)
cuyo arranque depende de un global creado por OTRO script de la chain (`_porraDb`,
sesión auth, JSON remoto). Todo "skip silencioso" en un init de una sola oportunidad es
un estado terminal encubierto: o reintenta con backoff, o des-latchea antes de salir.
Síntoma gemelo de capa distinta que ERR-87 (allí el dato llegaba pero la cache lo
perdía; aquí la cache entera no llega a poblarse).

**Fecha detección**: 11-jun-2026 (QA San preview PR #156, 2ª regresión de hora). **Resuelto**: 11-jun-2026.

## ERR-89 — Challenge anti-bot per-IP + fingerprint: el 403 global de un scraper con proxy DC no es un bug de parser

**Síntoma**: el actor `sofascore-webshare-proxy` (pipeline live principal) empieza a
recibir 403 challenge de SofaScore en TODOS los runs desde 11-jun-2026 ~18:54Z, sin
cambio de código. El recapture self-healing de cookies (modo `auto`) no lo resuelve:
el reto reaparece request a request.

**Causa**: endurecimiento del anti-bot (Cloudflare Bot Management): scoring por IP
(pool datacenter/proxy identificado) + fingerprint TLS/navegador. El desbloqueo por
cookies deja de ser suficiente porque el challenge se re-evalúa por petición — no hay
estado "bueno" que capturar.

**Fix/mitigación** (12-jun-2026, Item 1 post-J1): cambiar de fuente, no pelear el
anti-bot en caliente: EF `espn-poll` contra `site.api.espn.com` (scoreboard público
sin challenge) como fuente primaria del directo + cron `espn-poll-mundial-2026` con
gate de ventana. `dispatch-live-slots` (Apify) queda activo como vía de recuperación
si SofaScore desbloquea (runs fallidos baratos). Plan futuro BACKLOG: fetches desde
contexto browser con `page.evaluate`; plan B proxy RESIDENTIAL de Apify.

**Patrón detectable**: scraper estable que pasa a fallar 403 EN TODOS los runs a la
vez y el replay manual desde otra IP residencial funciona → challenge per-IP/
fingerprint. La señal clave es "global y simultáneo": un bug de parser rompe campos,
no el transporte entero. Tener SIEMPRE identificada una fuente alternativa del dato.

**Fecha detección**: 11-jun-2026 (~18:54Z, J1 en curso). **Mitigado**: 11-jun (stopgap SQL) / 12-jun (EF productizada).

## ERR-90 — JSON.stringify hacia columnas jsonb vía supabase-js → double-encoded que crashea lectores no defensivos

**Síntoma**: `porra-bridge-results` devolvía 500 MUDO (sin traza en logs) tras correr
update-results v9; el panel Admin (tab Resultados) quedaba vacío con SyntaxError en
consola DESPUÉS de normalizar el dato. Dos caras del mismo error.

**Causa**: pasar `JSON.stringify(obj)` a una columna jsonb con supabase-js guarda un
jsonb de tipo STRING (doble codificación). Los lectores que asumen objeto revientan
de formas distintas: spread/`Object.entries` sobre string → basura `{"0":"{"...}` o
throw; y tras NORMALIZAR la columna a objeto, el lector inverso (`JSON.parse(campo)`,
admin.js) crashea con "[object Object]". update-results v9 stringificaba
match_results/ko_results/classification.

**Fix** (12-jun-2026, Item 2 post-J1): (1) writers: NUNCA stringify hacia jsonb —
objetos JS planos (espn-poll y bridge lo documentan en cabecera); (2) lectores
DEFENSIVOS `asObj` (typeof string → JSON.parse con try/catch) en bridge v8,
live-sync (`loadMatchResults`) y admin.js (`admAsObj` ×5 sites; standings ya lo
tenía desde ERR-79); (3) bridge v8 añade try/catch GLOBAL con stack a console.error
— el 500 nunca más será mudo.

**Patrón detectable**: columna jsonb con MÁS de un writer o con writers históricos →
todo lector debe ser asObj-defensivo. Smoke obligatorio tras tocar un writer:
`select jsonb_typeof(campo)` debe devolver 'object', no 'string'.

**Fecha detección**: 11-jun-2026 (noche, post-J1). **Resuelto**: 12-jun-2026.

## ERR-91 — Parámetro opcional con fallback de semántica distinta: el olvido del caller es invisible

**Síntoma**: el +2 de goleador no se concedía NUNCA en el badge de puntos de Directo
("GANASTE +8 PTS" cuando el motor servidor paga 12; "VAS GANANDO +1" cuando es 3),
sin error ni warning en consola. Dos usuarios lo reportaron con capturas (J1).

**Causa**: `calcMatchPoints(pred, l, v, matchKey, realScorers)` tiene el 5º parámetro
opcional con fallback `realScorers ?? _hf09FallbackScorers(...)` — un placeholder de
pre-producción (primer jugador de plantilla del ganador) pensado para cuando no había
pipeline de scorers. `_getLivePts` (ui-directo) llamaba con 4 argumentos: el motor no
puede distinguir "no me pasaron el dato" de "no hay goles", y el fallback produce un
resultado PLAUSIBLE pero incorrecto — el bug no se ve hasta comparar con el servidor.

**Fix** (12-jun-2026, Items 3+5 post-J1): pasar SIEMPRE la fuente real — finished:
scorers canónicos del bridge (results.match_results vía `window._matchResultsByKey`);
en vivo: `deriveScorersFromEvents` (scoring.js, espejo del extractScorers del bridge
reutilizando `playerToShortKey`). Convención: `[]` significa "aún sin goles" y NO
activa el fallback (solo `undefined` lo hace, y ya ningún caller de producción lo usa).

**Patrón detectable**: parámetro opcional cuyo default NO es neutro (placeholder,
mock, primera-opción) sino semánticamente distinto del dato real. Al añadir un
parámetro así: grep de TODOS los callers en el mismo commit, o hacerlo obligatorio,
o loguear cuando el fallback se active. Pariente del ERR-86 (agregado parcial
silencioso): el sistema "funciona" con datos incorrectos.

**Fecha detección**: 11/12-jun-2026 (capturas usuarios J1). **Resuelto**: 12-jun-2026.

## ERR-92 — Pantalla Jornada asumía CEST en la sede → hora de kickoff 6-9h desplazada

**Síntoma**: la pantalla JORNADA mostraba la hora de la SEDE, no la de Madrid
(MEX-RSA aparecía a las 15:00 en vez de 21:00). Afectaba a TODOS los partidos de
grupos. Directo, en cambio, acertaba.

**Causa**: `renderVistaJornada` (vía `_buildJCard`, `_buildMatchButtons` y el modal
"Ver tarjeta" `_showJcardModal`) formateaba la hora con `_joParseMatchDate(m.date)`,
que añade `+02:00` cuando el string no trae timezone — ASUMIENDO que todo el Mundial
es CEST. Falso: las sedes 2026 están en husos US/Canadá/México y `m.date` (PARTIDOS,
data.js) es hora de SEDE sin TZ. El `+02:00` interpretaba mal el instante (offset
sede↔Madrid de 6-9h). Directo no sufría el bug porque usa el UTC real
(`live_scores.match_start_ts`), no `m.date`.

**Fix** (13-jun-2026, rama `fix/jornada-hora-madrid`): helper compartido
`window.kickoffUtcMsFor(match)` en live-sync.js lee `date_utc` del JSON wc_matches
(= `match_start_ts`, mismo instante que Directo; `date_utc` viene SIN designador de
zona → se fuerza 'Z' para leerlo como UTC). `_joKickoffMs(m)` (ui-groups.js) lo
consume y cae al `_joParseMatchDate` legacy solo si live-sync aún no cargó el JSON
(carga fría — nunca devuelve null si `m.date` existe). Las 3 lecturas de hora real
usan el instante real, y el weekday/día corto se deriva del MISMO instante para no
bailar en partidos de madrugada (02:00Z → 04:00 Madrid del día SIGUIENTE a la fecha
de sede). Anti-flash: `liveSyncInit` repinta Jornada al cargar el JSON (mirror del
bloque Directo). Las etiquetas de fecha ancladas a mediodía (`date + 'T12:00:00'`,
incluida la cabecera de cada jornada) NO se tocan: el mediodía no cruza de día y
siguen correctas.

**Ampliación (brief 2, 13-jun-2026)**: el MISMO bug vivía en dos vistas de
predicciones que formateaban con `new Date(match.date)` + `getHours()/getMinutes()/
getDate()` (hora de SEDE interpretada como LOCAL del navegador → un usuario fuera de
España veía su propia hora, no la de Madrid): `_timeLabel` en
`public/js/v3/porra-jugador-v3.js` y en `public/js/v3/predicciones-liga-v3.js`. Ambas
migradas al instante real (`window.kickoffUtcMsFor`, fallback `new Date(match.date)`)
formateado SIEMPRE con `timeZone:'Europe/Madrid'` (toLocaleDateString/Time, nunca
getHours/getDate), preservando el formato de salida de cada fichero. NO se tocan
`scoreboard.js` ("Actualizado a las HH:MM" = hora actual local, correcto) ni
`next-match-resolver-v3.js` (ya usaba UTC real + Madrid).

**Patrón detectable**: misma fuente de verdad para el mismo dato en dos vistas.
Directo ya tenía el instante UTC canónico; Jornada lo reinventaba desde un campo de
SEDE sin TZ. Cuando dos pantallas pintan "lo mismo", deben compartir helper y fuente,
no derivar cada una por su cuenta. Pariente de ERR-87 (la cache de Directo no exponía
`match_start_ts` a primer nivel y caía al mismo `m.date` de sede).

**Fecha detección**: 13-jun-2026. **Resuelto**: 13-jun-2026.

## ERR-93 — Resolución de goleador por substring estricto + fallback al último token ≠ key canónica

**Síntoma**: el +2 de goleador no puntuaba para ciertos jugadores en NINGUNA
superficie (tabla de liga, tile Predictor, card por partido), aunque el usuario
hubiera acertado el goleador. Caso testigo: Vinicius. Afecta a todo jugador cuyo
último token del nombre del feed ≠ su key canónica.

**Causa**: `playerToShortKey()` en `porra-bridge-results` resolvía el nombre del
feed (SofaScore/ESPN) a key canónica con substring ESTRICTO contra el roster:
`eq.find((p) => p.name.includes(nombre))`, y al fallar caía al ÚLTIMO token. El
feed da `"Vinicius Junior"`; el roster es `name:"7 · Vinicius Jr"` →
`"…Vinicius Jr".includes("Vinicius Junior")` → false (`Junior` ≠ `Jr`) → fallback
→ último token `"Junior"`. Se persistía `"Junior"` en `results.match_results[].scorers`,
pero la predicción guarda la key canónica `"Vinicius"` → ni el matcher de standings
(`_shared/scoring.mjs`, `scorers.includes(pred.gol)`) ni el espejo del frontend
(`public/js/scoring.js`) casaban → 0 puntos de goleador.

**Fix** (14-jun-2026, rama `claude/dreamy-euler-xrpgh4`): módulo compartido
`supabase/functions/_shared/scorer-normalize.mjs` (fuente única):
- `matchPlayerKey(nombre, players)` resuelve por SOLAPAMIENTO DE TOKENS normalizados
  (sin acentos, minúsculas, junior/júnior→jr, sin dorsales/puntuación). Tokens
  distintivos pesan 3; el genérico `jr` pesa 1. Devuelve `{key}` con un único
  ganador, `{ambiguous:true}` si el mejor score empata entre ≥2 jugadores
  (apellido compartido: 2× Rodriguez, Hwang/Heechan) y la key exacta no
  desambigua — **NO se adivina** (bridge loguea `scorer_ambiguous`), o `null` si
  ningún token solapa.
- `fallbackKey(nombre)` (último token, diacríticos/dorsal/puntuación fuera) **CONSERVA
  LA CAJA** (como el bridge v8 y como la key que guarda el picker para jugadores
  fuera del roster curado) → un re-bridge v9 produce la MISMA key fallback que v8,
  así que casa con el matcher exacto viejo **sin lockstep de deploy**. Solo si no
  hay solape; bridge loguea `scorer_unresolved`.
- `scorerMatches(scorers, gol)` compara la key ENTERA normalizada (no por subcadena):
  absorbe drift de caja/acentos/jr-junior entre lo persistido y lo predicho. Con el
  fallback conservando caja, queda como **defensa en profundidad pura** (no es
  imprescindible para evitar regresión al re-bridgear).
Reusado en el bridge (resolución, v9) y en `_shared/scoring.mjs` (matcher);
espejado INLINE en `public/js/scoring.js` (classic script, no ESM) con parity
shared↔legacy en la suite. Tests: `tests/scorer-normalize.test.mjs` (casos raíz
Vinicius + clase-Vinicius Son/DeBruyne/VanDijk/MacAllister + desambiguación por "jr"
+ empate de apellido Rodriguez/Hwang + Jiménez≠Giménez + fallback==v8 + source
guards de las 3 superficies) y sección 10 de `tests/scoring.test.mjs`.

**Dimensión**: la clase-Vinicius (in-roster con key ≠ apellido del feed: Son,
DeBruyne, Bruno, Nico, James, VanDijk, MacAllister, casi toda Corea…) son ~34
jugadores. En J1 quedaron a 0 impacto por suerte del fixture (+ parche manual de
`C_Brasil_Marruecos`→`Vinicius`); en J2+ se denegarían todos bajo v8 → desplegar v9
antes de J2.

**Remediación J1** (post-deploy, gate San): re-bridgear los 8 partidos `finished`
(re-ejecuta `extractScorers`→`playerToShortKey` con el fix) y reseed
`user_points_cache`. Verificado en prod (read-only, 14-jun): hoy 0 usuarios
denegados (el único caso con impacto, Vinicius, ya estaba parcheado a mano).
Las keys fallback de J1 (`Krejci`, `Lukic`, `Larin`, `Khoukhi`, `McGinn`,
`Metcalfe`, `Mauricio`) son de jugadores **ausentes del roster curado** (8/equipo):
el token-fix NO las cambia (caen igual al fallback) y casan porque picker y bridge
coinciden en el último token; arreglarlas de raíz pide completar `equipos_players`
(pendiente "convocatorias reales"). `Irankunda` (roster tiene `Irakunda`) sí es
clase-Vinicius pero nadie lo apostó.

**Sitio relacionado pendiente (gate San)**: `porra-ia-compute/lib/scorer-keys.ts`
tiene una TERCERA copia del mismo `playerToShortKey` (substring + último token) que
genera la key `predictions.scorer`/`ko_predictions.scorer` del bot Zayu (el OTRO
lado de la comparación). NO tocado en este fix (scope bridge+scoring+frontend);
plegar al módulo compartido + recomputar dentro del pendiente "update_ia_scorers".

**Patrón detectable**: dos representaciones del mismo dato (nombre del feed vs key
del roster) reconciliadas por substring/igualdad exacta sobre strings que ya
divergen en formato. Match por tokens normalizados, no por `includes`/`===`. La
misma lógica de matching duplicada en N superficies → extraer a módulo compartido
(aquí 4 copias: bridge, scoring shared, frontend, ia-compute). Pariente de ERR-91
(el +2 que tampoco casaba, por el 5º parámetro opcional).

**Fecha detección**: 12/14-jun-2026. **Resuelto** (código): 14-jun-2026 (deploy + remediación: gate San).

## ERR-94 — Mitad simétrica de ERR-93: la PREDICCIÓN guarda key no-canónica (lado picker)

**Síntoma**: tras desplegar el fix ERR-93 (bridge v9 + standings v12) y re-bridgear,
intermanuel8 (TILÍN) seguía sin cobrar los 12 pts de `C_Brasil_Marruecos` (exacto +
Vinicius + boost). El barrido NO lo resolvió.

**Causa**: ERR-93 corrigió el lado RESULTADO (el bridge escribe `results.scorers`
canónicos, p.ej. `Vinicius`). Pero la **predicción** de intermanuel8 tenía
`predictions.scorer = "Jr"` — el picker (frontend `resolveKeysForSquad`/
`playerToShortKey`) guardó en su día una key no-canónica (último token "Jr" en vez
de "Vinicius"). El bridge **nunca toca las predicciones**, así que ni el re-bridge ni
el matcher normalizado (`normName("Jr")="jr" ≠ "vinicius"`, palabras distintas) podían
casarlo → 0 de goleador. Afecta a predicciones con nombre completo / inicial /
fragmento (`"Cody Gakpo"`, `"E. Valencia"`, `"Heung-Min"`, `"Jr"`…) cuya key ≠ la que
el bridge produce para ese jugador.

**Fix** (15-jun-2026):
- **2 víctimas en partidos jugados** (cerrados) corregidas a mano por San vía MCP:
  `predictions` id `277fe8a1` (intermanuel8·C_Brasil_Marruecos·`Jr`→`Vinicius`),
  `488d9b18` (intermanuel8·C_Brasil_Escocia·`Jr`→`Vinicius`), `b5c4a96f`
  (mavc_999·E_Alemania_Curazao·`Kai Havertz`→`Havertz`) + reseed TILÍN/Gallos.
- **Sweep de canonicalización** (fase de grupos, SOLO partidos NO jugados) con el
  módulo REAL `_shared/scorer-normalize.mjs` (`matchPlayerKey`→`{key}`, si no
  `fallbackKey`; `{ambiguous}` o colisión-de-nombre → SKIP). **112 filas** reescritas
  vía UPDATE (JOIN `match_id`+`btrim(scorer)`, `NOT IN finished`, idempotente). HOLD
  (no escribir): colisiones de nombre de pila (`Isak Hien`→`Isak`, `Luka Vuskovic`→
  `Modric`, `Jhon Córdoba/Lucumí`→`Arias`), ambiguo (`M. Ali`), particle/conflación
  (`Paik Seung-Ho`→`Junho`, `Ibrahim`, `J. Caicedo`=Jordy≠Moisés). NOOP: `David`/
  `Junior`/`Hwang` (ya canónicas, exact-key preference).

**Caveat de raíz**: el roster curado de `equipos_players` (≈8/equipo) hace que
`matchPlayerKey` mal-resuelva nombres FUERA de él que comparten token con un jugador
in-roster (`Isak Hien`→`Isak` porque Hien no está; `Paik Seung-Ho`→`Junho` por la
partícula "ho"). Esto afecta IGUAL al bridge y al sweep (son "bridge-consistentes")
pero conflaciona jugadores. El fix de fondo es completar `equipos_players`. El
surname-guard (la key resuelta debe contener el apellido del pick) caza las colisiones
de nombre de pila para no escribirlas.

**Drift detectado**: `equipos_players` (tabla) vs `public/data/equipos-players.json`
(espejo repo) divergen en **GER** y **MAR** (46 equipos idénticos). El sweep usó la
TABLA (fuente del bridge). Recargar el JSON espejo pendiente (regla espejo
runtime↔JSON, ver `.claude/rules/edge-functions.md`).

**Patrón detectable**: cuando un fix canoniza UN lado de una comparación (resultado),
el OTRO lado (predicción del usuario, generado por otro código) puede seguir
divergente. Barrer ambos lados al mismo espacio de keys. Pendiente future-proof:
picker v3/`resolveKeysForSquad` debe guardar SIEMPRE la key canónica (origen del "Jr");
`porra-ia-compute/lib/scorer-keys.ts` es la 4ª copia del resolvedor. Hermano de ERR-93.

**Fecha detección**: 15-jun-2026. **Resuelto**: 15-jun-2026 (sweep aplicado; KO diferido
hasta poblarse el bracket ~28-jun; picker/ia-compute future-proof pendientes).

---

## ERR-95 — Doble corrección de orientación `live_scores`↔puente tras migrar SofaScore→ESPN (marcador espejo BRA-ESC)

**Síntoma**: Brasil-Escocia (J3, 24-jun, `wc2026_gC_15186861`) acabó 3-0 real pero se imputó **0-3** en `results.match_results["C_Brasil_Escocia"]` → puntos mal a todos los que predijeron Brasil, goleadores de Brasil keyados contra Escocia (Vinícius → fallback "Junior"), y el SPA pintaba 0-3 (Directo, clasificación de grupo, cards de jugador, puntos-preview). ÚNICO partido afectado del torneo.

**Causa**: `wc2026_gC_15186861` es el ÚNICO `wc_matches.teams_swapped=true` (la fuente lista Scotland-home; el proyecto Brasil-home). Al migrar el directo a ESPN (12-jun, ERR-89) se sembró `espn_event_map.inverted=true` para ese fixture → `espn-poll` PRE-orientaba marcador y `events.isHome` a orden-proyecto (`live_scores.score_home=Brasil=3`). Pero el puente (`porra-bridge-results`, rama grupos `teams_swapped`) **y** el frontend (`live-sync.js normalizeRow` + `ui-directo.js`) vuelven a invertir según `teams_swapped` → **doble corrección = espejo**. Bajo SofaScore el invariante era de inversión ÚNICA: el webhook (`porra-apify-webhook`) escribía `live_scores` en orden-fuente crudo y `teams_swapped` corregía 1 vez. ESPN rompió el invariante al pre-orientar (duplicó la responsabilidad de orientar). El backend de standings/IA era correcto; el split-brain era live_scores↔consumidores.

**Fix** (25-jun-2026, dato+config vía MCP, CERO código — NO se tocó el puente):
1. Reparada la fila congelada `live_scores` `wc2026_gC_15186861` a orden-fuente: `score_home=0, score_away=3` + `events.isHome` invertido (×3 `false`). [ROLLBACK: `score_home=3, score_away=0`, isHome=`true`×3.]
2. Re-bridge `porra-bridge-results` **v9** (vía `net.http_post` con secret de Vault, sin tocar código) → `results.match_results["C_Brasil_Escocia"]={l:3,v:0,scorers:["Vinicius","Vinicius","Cunha"]}`, `cache_refresh:7` ligas. Verificado: antonioruem 73→76 (+1 signo +2 Vinicius), javion_89 85→86 (+1 signo).
3. `espn_event_map.inverted=false` para alinear el writer ESPN con orden-fuente (igual que el webhook SofaScore). [ROLLBACK: `true`.]

El partido está `finished` → `espn-poll` no reescribe la fila (guard `.neq('status','finished')` + skip in-memory), por eso la reparación fue manual. `espn_event_map` es **runtime-only** (sin seed en el repo): ante reseed, mantener `inverted=false` en BRA-ESC.

**Patrón preventivo — INVARIANTE DE ORIENTACIÓN**: `live_scores` guarda SIEMPRE el orden de la FUENTE; el writer NUNCA pre-orienta (`espn_event_map.inverted=false`); la corrección a orden-proyecto se aplica UNA sola vez aguas abajo vía `teams_swapped` (puente + frontend). Vale para ambos writers (ESPN y el webhook SofaScore de recuperación) y para grupos+KO. Detalle en `docs/live-scoring.md` §Invariante de orientación. KO (~28-jun): `espn_event_map.inverted=false` + `wc_matches_ko.teams_swapped` según fuente; el puente NO necesita rama distinta. Hermano de ERR-96 (misma raíz, capa frontend/IA).

**Fecha detección**: 25-jun-2026. **Resuelto**: 25-jun-2026.

---

## ERR-96 — Signo IA sin orientar en el load del frontend: +1 anti-IA fantasma en el fixture swapped

**Síntoma**: tras corregir el marcador de BRA-ESC a 3-0 (ERR-95), el card pintaba **"VS IA +1"** a los 37 usuarios que predijeron Brasil (Gallos+Tilín) → total del card inflado +1 sobre la clasificación oficial (`user_points_cache`, correcta). Split-brain card (cliente) ↔ tabla (backend). Antes, con el 0-3 invertido, la condición anti-IA no se cumplía y el bug quedaba ENMASCARADO; el fix de datos lo destapó.

**Causa**: la IA computa en orden SofaScore (`ia_predictions.home_code='SCO'`, sign `'2'`=gana visitante=Brasil). El **backend** voltea el signo en `_shared/ia-bridge.mjs` (`buildIaSignByLegacyKey`, `1↔2` si `home_code!==home_iso3`) → la tabla es correcta. Pero el **frontend** `loadIAPredictions` (`auth.js`) guardaba el `sign` CRUDO → para el front la IA "predijo Escocia" ('2') y, como el usuario predijo Brasil ('1'), "le ganaba" → +1 fantasma. 5 consumidores del signo (`iaBonusWillApply` en data.js, chip "vs IA" en `ui-groups.js`, `v3ComputeIAStandings`, label de `hydrateIABar`, `renderIA`) leían el crudo, aunque varios ya ASUMÍAN el orientado (`renderIA` lo comenta: *"sign ya en orientación de la porra → NO re-voltear"*). La barra "IA PREDICE" (%) NO se veía afectada porque orienta las probabilidades aparte vía `v3IAOrientProbs` (dos rutas con orientaciones distintas).

**Fix** (25-jun-2026, PR #165, rama `claude/determined-curie-oygbbm`): helper puro `iaSignForCard(sign, ia_home_code, wc_home_iso3)` en `auth.js` con la MISMA condición y flip que `buildIaSignByLegacyKey`, aplicado al construir cada entry de `iaPredictions` (opción "orientar 1 vez al cargar"). Todos los consumidores del signo pasan a hablar orden-proyecto sin re-voltear. Las probabilidades siguen crudas y se orientan en presentación (`v3IAOrientProbs`) → la barra no cambia. Solo BRA-ESC afectado (los 71 con `home_code==home_iso3` → passthrough idéntico). +5 tests de paridad front↔backend en `tests/ia-bar-orientation.test.mjs` (`iaSignForCard==buildIaSignByLegacyKey`; X invariante; passthrough; `iaBonusPredicate` sin +1; wiring guard).

**Patrón preventivo**: misma raíz que ERR-95 (orientación del fixture swapped) en la capa frontend/IA. El LOADER del front debe normalizar el signo IA a orden-proyecto UNA vez (espejo de la EF), y los consumidores no re-voltean. Las dos magnitudes que llegan en orden-fuente se orientan en sitios distintos pero coherentes: el **signo** en el load (`iaSignForCard`, dato), las **probabilidades** en presentación (`v3IAOrientProbs`). No convivir orientado/crudo en la misma entry sin marcarlo. Hermano de ERR-95.

**Fecha detección**: 25-jun-2026. **Resuelto**: 25-jun-2026.

## ERR-97 — `matchPlayerKey`: token no distintivo resuelve key erronea

**Detonante (26-jun-2026):** gol de van Hecke (NED) acreditado como van Dijk a 3 usuarios. Auditoria de los 62 partidos finished -> 4 mal-atribuciones, 2 con impacto en puntos.

**Causa raiz:** `matchPlayerKey` (`supabase/functions/_shared/scorer-normalize.mjs`) daba peso 3 a CUALQUIER token solapado salvo `jr`. Cuando el unico token compartido no era distintivo, resolvia una key erronea con falsa confianza:

- **A - Particula nobiliaria:** `Jan Paul van Hecke` -> `VanDijk` ("van" unico token compartido con el unico "van" del roster).
- **B - Nombre de pila:** `Agustin Cano` -> `Canobbio` ("agustin" unico token compartido).
- **C - Apellido cross-team:** `Yasin Ayari` (SUE) acredita a `Khalil Ayari` (TUN); el array `scorers` no lleva equipo.

**Agravantes (frecuencia, no algoritmo):** el matcher lee `equipos_players` (8) y no `squads` (26); spellings divergentes feed/roster (`Irankunda`/`Irakunda`, `Schmid`/`Schimid`).

**Fix (P0, este PR):** set `GENERIC_TOKENS` (particulas + `jr`) con peso 0, y se exige que el apellido del feed (ultimo token distintivo) solape con el candidato. Sin apellido valido -> `null` -> `fallbackKey` (ultimo token, no pickeable, no colisiona). No regresa ERR-93 (`Vinicius Junior` -> `Vinicius`). Backend-only (firma intacta); regresion en `tests/scoring.test.mjs` seccion 11.

**Relacionado:** secuela de ERR-93/ERR-94 y misma clase que ERR-73. Fix 2 (cualificar `scorers` por iso3, resuelve C) y Fix 3 (matchear contra `squads`) van en PR aparte.
**Addendum (review 26-jun, sin debilitar A/B):**

- **KSA / articulo concatenado:** el feed da `Al-Shehri` (tokens `al`+`shehri`) pero `equipos_players` guarda `Saleh Alshehri` (un token `alshehri`). Se acepta `articulo+apellido` (`alshehri`) cuando una particula precede al apellido en el feed -> evita el falso negativo (inverso de van Dijk) en 6/8 pickables saudies. `vanhecke` sigue sin estar en van Dijk y `cano` (sin articulo) sigue rechazado.
- **Feed 100% generico** (p.ej. `Junior` suelto, sin token distintivo): conserva el contrato previo (solape generico unico -> resuelve; empate -> `ambiguous`, no se adivina). El requisito de apellido solo aplica cuando el feed TIENE token distintivo (donde vivia el bug).
- **Latente (Fix 2, no este PR):** KSA tiene dos keys que normalizan igual (`AlDawsari`/`Aldawsari`); `scorerMatches` no las distingue -> requiere cualificacion por equipo.

**Fix 2 (26-jun, PR aparte — cierra el caso C):** un goleador NO pickable cuyo `fallbackKey` coincide con una key PICKABLE del equipo RIVAL hacia falso-match con la prediccion de ese rival (caso Ayari: `Yasin Ayari` SUE no pickable -> fallback `Ayari` == `Khalil Ayari` TUN pickable -> +2 indebido). El fallo NO esta en la prediccion (nadie predice a Yasin) sino en el lado goleador. Nueva export `resolveScorerKey(nombre, iso3, ownRoster, oppRoster)` en `scorer-normalize.mjs`: si cae a fallback Y colisiona con un pickable del rival, cualifica la key con el iso3 del goleador (`SWE__Ayari`), que `normName`->`"swe ayari"` != `"ayari"` -> ya no casa con la prediccion de Khalil. Como Yasin no es pickable, su gol no debe acreditar a nadie: correcto. `scorers` SIGUE siendo `string[]` (cero cambio de contrato); el front solo matchea (`scorerMatches`/`indexOf`), nunca renderiza la key -> la "Goleadores" de Directo pinta `ctx.events` (nombre crudo del feed), no el array del puente. El bridge (`porra-bridge-results`) delega en `resolveScorerKey` pasando ambos rosters (`eqMap[iso3]`/`eqMap[oppIso3]`). Status logueado: `scorer_unresolved_qualified`/`scorer_ambiguous_qualified`. Regresion en `tests/scoring.test.mjs` (seccion ERR-97) + guard actualizado en `tests/scorer-normalize.test.mjs`.

## ERR-98 — Scoring KO sin gate de equipos: marcador puntuado por slot, no por cruce; avance por lado; `final_advance` en ambas semis

**Detonante (26-jun-2026, pre-R32):** lectura en vivo de `get-league-standings` v1.4 / `_shared/scoring.mjs` contra produccion (modelo §1 del brief PR motor KO).

**Causa raiz:** `calcKOMatchPoints` puntuaba cada slot KO comparando marcador/lado pronosticado contra el real **sin saber que equipos habia en el slot**. No reconstruia la malla del bracket. Tres bugs:

- **Marcador sin gate de equipos.** Usuario pronostica slot 73 "Corea 2-1, avanza Corea"; real "Alemania 2-1, avanza Alemania" -> el motor daba +3 exacto + +5 avance = +8 por un cruce con equipos COMPLETAMENTE distintos. Como muchos usuarios fallaron tablas de grupo, sus cruces R32 no cuadraban -> el bug se disparaba en masa.
- **Avance por LADO, no por equipo.** Se decidia con `'home'/'away'`, no comparando el equipo que el usuario marca que avanza (`classifier`) contra el avanzador real. Para empates por penaltis comparaba `classifier` (nombre de equipo) contra `'home'/'away'` -> nunca casaba.
- **Campeon +25 mal colocado.** `final_advance:25` se sumaba en `round==='sf'` (ambas semis cobraban +45) y la Final (slot 104) cobraba +0 de avance. Ademas el podio (30/20/15/10) no se computaba (0 referencias en la EF) y la IA iba apagada (`iaBonus:false` hardcodeado).

**Fix (PR motor KO, Paso 6):** `calcKOMatchPoints` reescrito al modelo normativo (`docs/scoring-engine.md` §Modelo KO). Recibe la **malla** (equipos predichos + reales del slot, en iso3): (a) marcador estilo grupo SOLO si el cruce coincide (igualdad de conjunto de iso3, con orientacion ERR-95/96); (b) avance por EQUIPO (`predAdvancer===realAdvancer`) con `KO_ROUND_PTS[round]` uniforme (`final` renombrado de `final_advance`, aplicado en slot 104 no en semis; `third` ausente -> 3er puesto sin avance); (c) nuevo `calcKoPodiumPoints` (30/20/15/10). `get-league-standings` v1.5.0 reconstruye la malla predicha de cada usuario con `_shared/ko-bracket.mjs` (`resolveBracket`) y la real con `wc_matches_ko` + `ko_results`; puente nombres ES->iso3 desde `wc_matches`. boost KO off. Degradacion limpia si `wc_matches_ko` no tiene el slot. Espejo en `public/js/scoring.js` con paridad 1:1 en `tests/scoring.test.mjs` + integracion en `tests/ko-standings-mesh.test.mjs`.

**DECISION §1.5 (pendiente review San):** campeon = sf 20 + final 25 + champion 30 = **75**. Toggle reversible de 1 linea (borrar la clave `final` de `KO_ROUND_PTS` en ambos motores -> campeon = 50).

**Patron:** puntuar un slot de bracket exige reconstruir QUE hay en el slot, no solo el marcador/lado. La pieza de reconstruccion (cascada grupos->terceros Anexo C->R32->Final) ya vivia en `_shared/ko-bracket.mjs` (levantada para el comprobante PDF); este PR la consume desde el scoring en vez de reimplementarla.