import { Actor } from 'apify';
import { chromium } from 'playwright';

await Actor.init();

const input = (await Actor.getInput()) ?? {};
// mode: 'auto' (default) = reuse cookies del KV + self-healing recapture si 403.
//       'capture' / 'reuse' / 'normal' se mantienen para debug manual.
const { eventId: directId, eventIds: directIds, matchUrl, mode = 'auto' } = input;

let ids = [];
if (Array.isArray(directIds)) ids = directIds;
else if (directId != null) ids = [directId];
else if (matchUrl) {
  const m = matchUrl.match(/#id:(\d+)/)?.[1];
  if (m) ids = [m];
}
ids = ids.map((x) => String(x).trim()).filter(Boolean);

if (ids.length === 0) {
  console.error('Se necesita eventId, eventIds[] o matchUrl con #id:XXXXX');
  await Actor.exit({ exitCode: 1 });
}

console.log(`[sofascore-webshare] events=[${ids.join(',')}] mode=${mode}`);

// Credenciales en env vars secret del actor (Apify Console → Environment variables,
// pusheadas vía .actor/actor.json + apify secrets). WEBSHARE_PROXY_USER debe incluir
// el sufijo de rotación por países (e.g. xxxx-US-GB-DE-NL-FR-rotate).
const proxyUser = process.env.WEBSHARE_PROXY_USER;
const proxyPass = process.env.WEBSHARE_PROXY_PASS;
if (!proxyUser || !proxyPass) {
  console.error('[sofascore-webshare] Faltan WEBSHARE_PROXY_USER / WEBSHARE_PROXY_PASS en env vars del actor');
  await Actor.exit({ exitCode: 1 });
}

const proxy = {
  server: 'http://p.webshare.io:80',
  username: proxyUser,
  password: proxyPass,
};

const FETCH_TIMEOUT_MS = 15000;

// Fetch de TODOS los ids en paralelo dentro del browser (1 evaluate, 2 fetches por id).
async function fetchEvents(page, idList) {
  const raw = await page.evaluate(async ({ list, timeoutMs }) => {
    const doFetch = async (url) => {
      try {
        const res = await fetch(url, {
          headers: { 'Accept': 'application/json', 'Referer': 'https://www.sofascore.com/' },
          signal: AbortSignal.timeout(timeoutMs),
        });
        const text = await res.text();
        return { status: res.status, text };
      } catch (e) {
        return { status: 0, text: '', error: e && e.message ? e.message : String(e) };
      }
    };
    return Promise.all(list.map(async (id) => {
      const base = `https://api.sofascore.com/api/v1/event/${id}`;
      const [event, incidents] = await Promise.all([doFetch(base), doFetch(`${base}/incidents`)]);
      return { id, event, incidents };
    }));
  }, { list: idList, timeoutMs: FETCH_TIMEOUT_MS });

  const parse = (r) => {
    if (r.error) return { status: 0, ok: false, data: { error: r.error } };
    let data;
    try { data = JSON.parse(r.text); } catch (_) { data = { raw: r.text.substring(0, 300) }; }
    return { status: r.status, ok: r.status === 200, data };
  };

  return raw.map(({ id, event, incidents }) => ({ id, event: parse(event), incidents: parse(incidents) }));
}

// Carga sofascore.com, espera la cookie Cloudflare (__cf_bm) con polling corto
// (máx 6s, antes era un waitForTimeout fijo de 5s) y persiste cookies en el KV Store.
async function captureCookies(context, kvStore) {
  const page = await context.newPage();
  await page.goto('https://www.sofascore.com/', { waitUntil: 'domcontentloaded', timeout: 120000 });
  let cookies = [];
  for (let i = 0; i < 12; i++) {
    cookies = await context.cookies();
    if (cookies.some((c) => c.name === '__cf_bm')) {
      // gracia extra para que asiente el resto del set de cookies
      await page.waitForTimeout(1500);
      cookies = await context.cookies();
      break;
    }
    await page.waitForTimeout(500);
  }
  console.log(`[sofascore-webshare] CAPTURE: ${cookies.length} cookies obtenidas`);
  await kvStore.setValue('SOFASCORE_COOKIES', {
    cookies,
    capturedAt: new Date().toISOString(),
    cookieNames: cookies.map((c) => c.name),
  });
  await page.close();
  return cookies;
}

const browser = await chromium.launch({ proxy });

try {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  const kvStore = await Actor.openKeyValueStore('sofascore-cookies');

  let extra = {};
  let capturedThisRun = false;

  if (mode === 'capture' || mode === 'normal') {
    const cookies = await captureCookies(context, kvStore);
    capturedThisRun = true;
    extra = { mode, cookieCount: cookies.length };
  } else {
    // auto | reuse: inyectar cookies guardadas si existen
    const stored = await kvStore.getValue('SOFASCORE_COOKIES');
    if (stored?.cookies?.length) {
      await context.addCookies(stored.cookies);
      console.log(`[sofascore-webshare] REUSE: ${stored.cookies.length} cookies del ${stored.capturedAt}`);
      extra = { mode, cookiesCapturedAt: stored.capturedAt };
    } else if (mode === 'reuse') {
      console.error('[sofascore-webshare] REUSE: No hay cookies guardadas. Ejecuta primero con mode=capture');
      await browser.close();
      await Actor.exit({ exitCode: 1 });
    } else {
      console.log('[sofascore-webshare] AUTO: sin cookies guardadas → capture inicial');
      const cookies = await captureCookies(context, kvStore);
      capturedThisRun = true;
      extra = { mode: 'auto+capture', cookieCount: cookies.length };
    }
  }

  const page = await context.newPage();
  await page.goto('about:blank');

  let results = await fetchEvents(page, ids);

  // Self-healing: si algún id falló (403 Cloudflare / timeout) y aún no hemos
  // capturado cookies frescas en este run → recapture + retry SOLO de los fallidos.
  const failedIds = results.filter((r) => !r.event.ok).map((r) => r.id);
  if (failedIds.length > 0 && !capturedThisRun) {
    console.log(`[sofascore-webshare] ${failedIds.length} fallo(s) [${failedIds.join(',')}] → recapture + retry`);
    await captureCookies(context, kvStore); // navega en el mismo context: cookies ya quedan activas
    const retried = await fetchEvents(page, failedIds);
    const byId = new Map(retried.map((r) => [r.id, r]));
    results = results.map((r) => byId.get(r.id) ?? r);
    extra = { ...extra, recaptured: true };
  }

  for (const r of results) {
    console.log(`[sofascore-webshare] event=${r.id} event=${r.event.status} incidents=${r.incidents.status}`);
    await Actor.pushData({ eventId: r.id, ...extra, event: r.event, incidents: r.incidents });
  }

  await page.close();
  await browser.close();
} catch (err) {
  await browser.close();
  throw err;
}

await Actor.exit();
