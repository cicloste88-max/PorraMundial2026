# Scrapling — evaluación y metodología extrapolable a Porra Mundial 2026

Análisis de [`D4Vinci/Scrapling`](https://github.com/D4Vinci/Scrapling) (v0.4.7, 17 abr 2026, BSD-3, 44.6k stars, último push 5 may 2026) frente al stack de scraping actual del proyecto. Objetivo: decidir si sustituir, complementar o solo extraer patrones.

## TL;DR

- **NO sustituir** el actor `sofascore-webshare-proxy`. El caso de uso (GET a `api.sofascore.com/...` tras pasar Webshare residencial) ya está resuelto a 5–10 s y $0.001/run. Cambiar a Scrapling no aporta capacidad nueva y obliga a reescribir JS→Python.
- **SÍ adoptar** Scrapling para un nuevo Apify actor Python que cubra los scrapers HTTP que hoy viven dentro del EF `porra-ia-compute` (Wikipedia ELO + 11v11.com H2H + 11v11.com last5). Razón: `Fetcher` con `impersonate='chrome'` + `stealthy_headers=True` resuelve el patrón de ERR-25 (3 headers manuales) sin necesidad de browser y deja la EF Deno limpia.
- **Imposible** correr Scrapling dentro de las EF actuales — es Python puro; las EF son Deno. Cualquier integración pasa por un Apify actor intermediario, igual que hoy con Webshare.
- **Aprendizajes extrapolables sin migrar código**: §4 de este doc (10 patrones aplicables ahora mismo a `handleScrapeH2h`/`handleScrapeLast5` y al actor Webshare).

## 1. Por qué se evalúa

Tres errores conocidos con la misma raíz (fingerprint del cliente HTTP no es de "browser real"):

| ERR | Síntoma | Workaround actual |
|---|---|---|
| **ERR-05** | SofaScore 403 desde IP datacenter | Apify actor + Webshare residencial (Playwright) |
| **ERR-24** | Wikipedia inadecuada para H2H masivo (3% cobertura) | Migrado a 11v11.com |
| **ERR-25** | 11v11.com 403 sin 3 headers (UA + Accept + Accept-Language) | Headers manuales en `fetch()` Deno |

A esto se suma backlog `CLAUDE.md`: cargar convocatorias reales (squads) y posibles fuentes adicionales para enriquecer `predictions.scorer` del bot IA Zayu — todas ellas requieren scraping nuevo de fuentes que probablemente bloquearán por fingerprint.

## 2. ¿Qué es Scrapling?

Framework Python (≥3.10) que combina:

1. **Parser** estilo Parsel/Scrapy con **adaptive selectors** (`auto_match=True` localiza elementos cuando el DOM cambia, sin reescribir CSS/XPath).
2. **Fetchers unificados** bajo una sola API:
   - `Fetcher` — `curl_cffi` con TLS/JA3/HTTP2 impersonation (`impersonate='chrome131'` produce un ClientHello byte-exacto a Chrome 131).
   - `DynamicFetcher` — Playwright Chromium puro.
   - `StealthyFetcher` — `patchright` (Playwright parcheado a nivel binario) con auto-solve de Cloudflare Turnstile.
3. **Spider** concurrente con `start_urls`, `parse()` async, **multi-session routing** y **checkpoint pause/resume**.
4. **MCP server** integrado (utilizable desde Claude Code u otro LLM).

Performance del parser: 2.02 ms para 5 000 elementos anidados — **paridad con Parsel**, ~784× más rápido que BS4+lxml ([benchmarks.py](https://github.com/D4Vinci/Scrapling/blob/main/benchmarks.py)).

## 3. Stack actual — recordatorio rápido

Tres scrapers operativos, cada uno con perfil distinto:

| Scraper | Where | Stack | Latencia | Coste | Anti-bot |
|---|---|---|---|---|---|
| **SofaScore live** | actor `sofascore-webshare-proxy` (Apify) | Node + Playwright + Webshare residencial | 5–10 s | $0.001/run | Browser real + IP residencial |
| **ELO Wikipedia** | EF `porra-ia-compute` action `scrape_elo` | Deno `fetch()` | 1–2 s | $0 | UA propio + Accept JSON |
| **H2H + last5 11v11.com** | EF `porra-ia-compute` actions `scrape_h2h` / `scrape_last5` | Deno `fetch()` con regex sobre HTML | ~45 s (48 teams secuencial) | $0 | 3 headers manuales (UA Chrome real + Accept + Accept-Language) |

Detalle en `docs/live-scoring.md`, `docs/ia-predictor.md`, `.claude/rules/apify-actor.md`. Código de los scrapers HTTP en `supabase/functions/porra-ia-compute/index.ts:244-645`.

## 4. Aprendizajes y patrones extrapolables (independientes de migrar)

Estos diez patrones se pueden aplicar al código actual sin instalar Scrapling — son metodología, no librería.

### 4.1 Fetcher unificado en lugar de `fetch()` ad-hoc por sitio

**Patrón Scrapling:** una clase `FetcherSession` que abstrae headers, cookies, retries, proxy y rate limit, con sub-clases por intensidad (HTTP simple → DynamicSession → StealthySession). Cada scraper sólo declara el sitio + su selector.

**Aplicación al EF:** `handleScrapeElo`, `handleScrapeH2h` y `handleScrapeLast5` repiten el mismo objeto `fetchHeaders` y la misma lógica de error (`if (!res.ok) missing_pages.push(...); await delay(500)`). Extraer una función `fetchWithStealth(url, opts)` a `lib/fetcher.ts` colapsa 3 implementaciones a 1 y centraliza el día que un sitio nuevo añada CF.

### 4.2 TLS impersonation con `curl_cffi` (cuando los headers ya no bastan)

ERR-25 dice "11v11 requiere 3 headers". Funciona hoy. **Cuando deje de funcionar** (rotación CF Bot Management), el siguiente escalón es TLS fingerprint: el `ClientHello` de Deno/`fetch` no se parece al de Chrome real aunque los headers sí. `curl_cffi` (la dep que usa `Fetcher`) replica el ClientHello byte-exacto.

**Aplicación:** si 11v11 vuelve a 403 con headers correctos, no perder 2 días buscando el header faltante — es señal de TLS check. Plan B documentado: empaquetar el scraper en un Apify actor Python (Scrapling `Fetcher` + Webshare). Estimación: 1 día.

### 4.3 Adaptive selectors (`auto_match`) — relocate when DOM changes

El regex actual de `handleScrapeH2h` (`<td class="opposition">([^<]+)</td>...`) se rompe el día que 11v11 renombre la clase o reordene columnas. Scrapling guarda un fingerprint del elemento y lo reencuentra por similitud (tag + atributos + posición + texto vecino).

**Aplicación incluso sin Scrapling:** sustituir regex `<td class="opposition">` por parser HTML real (`deno-dom` o `linkedom` ya disponibles en Deno) + selectores semánticos por **posición de columna en `<table>`** en lugar de por `class`. La columna oposición es siempre la primera; eso no cambia con un rename. El parser HTML añade ~30 ms de latencia por página, despreciable frente a los 500 ms de delay por team.

### 4.4 `stealthy_headers=True` — generar headers reales por User-Agent

Scrapling, dado un `impersonate='chrome131'`, genera **toda la cascada** de headers que Chrome 131 envía (`sec-ch-ua`, `sec-fetch-*`, `accept-encoding`, etc.), no solo los 3 obvios. Usa el dataset `apify-fingerprint-datapoints` (real-world fingerprints).

**Aplicación:** los 3 headers actuales (UA + Accept + Accept-Language) son el mínimo viable. Si 11v11 endurece detección, la cascada completa es ~12 headers. Mantener una constante `CHROME_124_HEADERS` en `lib/fetcher.ts` con la cascada, no copiar 3 headers en cada call.

### 4.5 Session reuse (cookies persistentes) — el patrón "capture/reuse" del actor Webshare

El actor `sofascore-webshare-proxy/main.js` ya implementa este patrón a mano: modo `capture` carga la página + guarda cookies en KV Store; modo `reuse` las inyecta y hace `fetch` directo desde `about:blank`. Scrapling lo formaliza con `FetcherSession` (incognito off por defecto desde v0.3.14, cookies persisten entre requests).

**Aplicación:** está bien hecho. **Aprendizaje cruzado:** la lógica de invalidación de cookies (cuándo re-capturar) **no está documentada en el actor**. Scrapling también la deja al usuario. Decisión pendiente: TTL fijo (e.g. 6 h) vs detección de 401/403 → re-capture. Recomendado: detección reactiva, con backoff a TTL fijo si el sitio no devuelve 401 explícito.

### 4.6 Pause / resume con checkpoint (Spider)

Si `scrape_h2h` falla a mitad (team 30 de 48), hoy se reintenta desde 0 — son 15 s perdidos. Scrapling Spider guarda checkpoint por URL (`crawldir="./crawl_data"`) y reanuda donde se quedó.

**Aplicación al EF:** persistir el progreso en una tabla `ia_scrape_progress (job, last_team_iso3, started_at)` antes de cada request. Si la EF se reinicia (timeout 60 s en plan free), siguiente run lee el checkpoint y continúa. Coste: 1 query extra por team. Beneficio: idempotencia real.

### 4.7 Spider concurrente con multi-session routing

Scrapling Spider permite declarar varias sesiones (`fast`, `stealth`) y enrutar requests a la apropiada según el dominio. Útil cuando un crawl mezcla dominios protegidos y abiertos.

**Aplicación si se diversifican fuentes IA:** si añadimos H2H de RSSSF (libre) + 11v11 (header-protected) + posible 4ª fuente Cloudflare-protected, una sola función `scrapeAllH2H()` con routing por dominio evita branchear en `if (source === 'rsssf')` por todas partes.

### 4.8 ProxyRotator

`ProxyRotator(['url1', 'url2'])` con cyclic strategy. Simple pero no trivial cuando hay rate limits por IP.

**Aplicación:** Webshare ya rota IPs internamente (`p.webshare.io` rotativo). El actor actual no necesita ProxyRotator. **Sí lo necesitaría** si se contrata un segundo proveedor para failover (BrightData, IPRoyal). Hoy no es prioridad.

### 4.9 Fingerprints estadísticamente realistas (`browserforge`)

Scrapling usa `browserforge` + `apify-fingerprint-datapoints` para generar combinaciones (UA + screen + canvas + audio + WebGL) que existen en el wild. Un UA Chrome 124 + screen 4K + macOS es plausible; UA Chrome 124 + screen 800x600 + Linux ARM, no.

**Aplicación a actor Webshare:** el `userAgent` actual es estático Chrome 124. El sitio puede correlacionar UA con resolution (Playwright default 1280×720) para detectar headless. Setear `viewport: { width: 1920, height: 1080 }` y rotarlo entre 3-4 valores comunes endurece el actor en ~1 LOC.

### 4.10 robots.txt compliance + ad blocking

v0.4.4 añade `robots_txt_obey=True` con caché por dominio. v0.4.6 trae ad blocking (~3 500 dominios) que reduce ancho de banda 20-40 % en sitios con tracking pesado.

**Aplicación:** Wikipedia, 11v11 y SofaScore no tienen anuncios pesados, no aplica directamente. **Sí aplica** legalmente: documentar en `docs/ia-predictor.md` que se respeta robots.txt de cada fuente (verificar Wikipedia OK, 11v11 OK, SofaScore — la API no es pública pero el TOS del cliente browser lo permite vía actor).

## 5. Aplicabilidad concreta caso por caso

### 5.1 SofaScore live scoring → mantener stack actual

| Criterio | Stack actual | Si migráramos a Scrapling |
|---|---|---|
| Latencia | 5–10 s | 5–10 s (`Fetcher`) o 30–60 s (`StealthyFetcher`) |
| Coste | $0.001/run × 104 partidos = $13 torneo | igual o mayor (mismo Apify, mismo Webshare) |
| Mantenimiento | Node + Playwright (lo que ya conocemos) | Python + Scrapling (nuevo stack) |
| Anti-bot | Browser real + residencial — funciona hoy | Idem si `Fetcher` con cookies de pre-warmup, equivalente |

**Veredicto:** no migrar. Coste de oportunidad alto, beneficio cero. Re-evaluar si SofaScore añade Cloudflare Turnstile: ahí `StealthyFetcher` con `solve_cloudflare=True` (resuelve los 3 tipos automáticamente) es la única opción open-source viable.

### 5.2 H2H + last5 11v11.com → migrar a actor Python con Scrapling

Hoy estos scrapers viven en la EF Deno. Problemas:

- **48 fetch secuenciales × 500 ms delay** = 45 s. Cerca del timeout de EF (depende del plan; en free es 60 s).
- **Regex-based HTML parsing** — frágil ante cambios de markup.
- **Cualquier endurecimiento de 11v11** (TLS check, CF) requiere migrar a actor de todas formas; mejor hacerlo proactivamente.

**Plan propuesto:**

1. Crear `apify-actors/scrapling-h2h-historical/` con Python + Scrapling + Apify SDK.
2. Input: `{ teams: ["ARG","BRA",...] }` (subset opcional, default 48).
3. Usar `FetcherSession(impersonate='chrome', stealthy_headers=True)` con `proxy=Webshare` (mismo proxy ya pagado).
4. Parser semántico: `page.css('table.stats tr td:first-child::text')` — sobrevive a renames.
5. `Actor.push_data()` con el mismo schema que ya escribe `handleScrapeH2h`/`handleScrapeLast5` en BD.
6. EF `porra-ia-compute` deja de tener `handleScrapeH2h`/`handleScrapeLast5`; pasa a triggear el actor (fire-and-forget) y leer el resultado del KV Store o webhook.

**Esfuerzo:** ~1 día. **Beneficios:** idempotencia, paralelización (Scrapling AsyncStealthySession con `max_pages=4` baja los 45 s a ~12 s), parser robusto, EF más liviana (–250 LOC).

### 5.3 ELO Wikipedia → mantener (con micro-mejora)

`scrape_elo` consume la API JSON de MediaWiki (`api.php?action=parse&page=Module:SportsRankings/...`). No hay anti-bot. Funciona en Deno fetch sin problemas. Latencia 1–2 s.

**No migrar.** Única mejora aplicable del aprendizaje Scrapling: extraer la regex de parsing del wikitext a `lib/wikitext-parser.ts` con un par de tests. Cualquier futuro scraper de Wikipedia (e.g. squads de selecciones del backlog) reusa.

### 5.4 Cargar convocatorias reales (`EQUIPOS[].players`)

Pendiente abierto en `CLAUDE.md`. Las fuentes candidatas (Wikipedia per-team rosters, Transfermarkt, FBref) tienen perfiles distintos:

| Fuente | Anti-bot esperado | Recomendación |
|---|---|---|
| Wikipedia (rosters) | Ninguno (API JSON) | Deno fetch directo, sin Scrapling |
| Transfermarkt | CF Bot Management medio | Actor Python + Scrapling `StealthyFetcher` |
| FBref (StatsBomb) | Datacenter-blocked + rate limit | Actor Python + Scrapling + Webshare |

Si se elige Transfermarkt o FBref, esto **dispara la migración del 5.2** — un único actor `scrapling-football-data` cubre H2H + squads + (futuro) lineup-pre-partido.

## 6. Limitaciones objetivas de Scrapling

- **Beta** (Development Status :: 4). API ha cambiado en v0.4 (Spider framework introducido, `auto_match` renombrado de `automatch`). Pin de versión exacto en `pyproject.toml`.
- **Bus factor 1**: Karim Shoair es el único mantenedor humano principal. Mitigación: BSD-3 permite fork.
- **No corre en Deno / Node / Edge runtime**. Cualquier integración pasa por Apify u otro container Python.
- **`StealthyFetcher` no es gratis**: ~300–500 MB RAM y timeout mínimo 60 s con `solve_cloudflare=True`. No usar para casos donde `Fetcher` (HTTP simple impersonado) basta.
- **No resuelve reCAPTCHA visual ni hCaptcha hard** — solo Cloudflare Turnstile. Para los primeros, combinar con CapSolver / 2Captcha externos.
- **Stack ML pesado para anti-bot enterprise** (DataDome, Akamai Bot Manager): efectividad <40 % incluso con residencial. Mismo techo que cualquier alternativa open-source.

## 7. Plan recomendado priorizado

| Sprint | Acción | Esfuerzo | ROI |
|---|---|---|---|
| Inmediato (sin código) | Aplicar §4.4 (cascada de 12 headers Chrome) y §4.9 (rotar viewport actor Webshare) preventivos | 30 min | Alto — endurece sin coste |
| Inmediato (sin código) | Documentar en `errores_conocidos_porra.md` el patrón "si headers correctos y sigue 403 → es TLS, plan B = Scrapling actor" | 15 min | Alto — atajo para futura sesión |
| Pre-Mundial (opcional) | §5.2: migrar H2H+last5 a actor Python Scrapling | 1 día | Medio — solo si 11v11 endurece o si se añade Transfermarkt/FBref |
| Post-Mundial | §4.6: checkpoint progress en tabla `ia_scrape_progress` | 0.5 día | Bajo — solo importa si se rescraping en bulk |

No se recomienda ningún cambio en SofaScore live scoring.

## 8. Referencias externas

- [GitHub D4Vinci/Scrapling](https://github.com/D4Vinci/Scrapling) — repo principal, README, ejemplos.
- [PyPI v0.4.7](https://pypi.org/project/scrapling/) — versión más reciente.
- [Read the Docs (latest)](https://scrapling.readthedocs.io/en/latest/) — API completa.
- [DeepWiki Scrapling overview](https://deepwiki.com/D4Vinci/Scrapling/1-overview) — explorador de código indexado.
- [pim97 — anti-detect-browser-tools comparison](https://github.com/pim97/anti-detect-browser-tools-tech-comparison) — Scrapling vs Patchright vs Camoufox vs Botasaurus.
- [ScrapingBee — Scrapling adaptive Python framework](https://www.scrapingbee.com/blog/scrapling-adaptive-python-web-scraping/).
- [RoundProxies — How to web scrape with Scrapling 2026](https://roundproxies.com/blog/scrapling/).
- [Scrapfly — How to bypass Cloudflare 2026](https://scrapfly.io/blog/posts/how-to-bypass-cloudflare-anti-scraping).
- [curl_cffi (lexiforest/curl_cffi)](https://github.com/lexiforest/curl_cffi) — TLS impersonation underlying lib.
