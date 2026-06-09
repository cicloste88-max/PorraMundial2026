import { Actor } from 'apify';
import { chromium } from 'playwright';

await Actor.init();

const input = (await Actor.getInput()) ?? {};
const { eventId: directId, eventIds: directIds, matchUrl, mode = 'normal' } = input;

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

// Credenciales en env vars secret del actor (Apify Console → Environment variables).
// WEBSHARE_PROXY_USER debe incluir el sufijo de rotación por países (e.g. xxxx-US-GB-DE-NL-FR-rotate).
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

async function fetchEventData(page, id) {
  const baseUrl = `https://api.sofascore.com/api/v1/event/${id}`;
  const results = await page.evaluate(async (base) => {
    const doFetch = async (url) => {
      const res = await fetch(url, {
        headers: { 'Accept': 'application/json', 'Referer': 'https://www.sofascore.com/' },
      });
      const text = await res.text();
      return { status: res.status, text };
    };
    const [event, incidents] = await Promise.all([
      doFetch(base),
      doFetch(`${base}/incidents`),
    ]);
    return { event, incidents };
  }, baseUrl);

  let eventData, incidentsData;
  try { eventData = JSON.parse(results.event.text); } catch (_) { eventData = { raw: results.event.text.substring(0, 300) }; }
  try { incidentsData = JSON.parse(results.incidents.text); } catch (_) { incidentsData = { raw: results.incidents.text.substring(0, 300) }; }

  return {
    event:     { status: results.event.status,     ok: results.event.status === 200,     data: eventData },
    incidents: { status: results.incidents.status, ok: results.incidents.status === 200, data: incidentsData },
  };
}

const browser = await chromium.launch({ proxy });

try {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  const kvStore = await Actor.openKeyValueStore('sofascore-cookies');

  let page;
  let extra = {};

  if (mode === 'capture') {
    page = await context.newPage();
    await page.goto('https://www.sofascore.com/', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(5000);
    const cookies = await context.cookies();
    console.log(`[sofascore-webshare] CAPTURE: ${cookies.length} cookies obtenidas`);
    await kvStore.setValue('SOFASCORE_COOKIES', {
      cookies,
      capturedAt: new Date().toISOString(),
      cookieNames: cookies.map((c) => c.name),
    });
    extra = { mode: 'capture', cookieCount: cookies.length };

  } else if (mode === 'reuse') {
    const stored = await kvStore.getValue('SOFASCORE_COOKIES');
    if (!stored?.cookies?.length) {
      console.error('[sofascore-webshare] REUSE: No hay cookies guardadas. Ejecuta primero con mode=capture');
      await browser.close();
      await Actor.exit({ exitCode: 1 });
    }
    console.log(`[sofascore-webshare] REUSE: ${stored.cookies.length} cookies del ${stored.capturedAt}`);
    await context.addCookies(stored.cookies);
    page = await context.newPage();
    await page.goto('about:blank');
    extra = { mode: 'reuse', cookiesCapturedAt: stored.capturedAt };

  } else {
    page = await context.newPage();
    await page.goto('https://www.sofascore.com/', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(5000);
    const cookies = await context.cookies();
    console.log(`[sofascore-webshare] cookies=${cookies.length}`);
  }

  for (const id of ids) {
    try {
      const r = await fetchEventData(page, id);
      console.log(`[sofascore-webshare] event=${id} event=${r.event.status} incidents=${r.incidents.status}`);
      await Actor.pushData({ eventId: id, ...extra, event: r.event, incidents: r.incidents });
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error(`[sofascore-webshare] event=${id} FALLO:`, msg);
      await Actor.pushData({
        eventId: id,
        ...extra,
        event:     { status: 0, ok: false, data: { error: msg } },
        incidents: { status: 0, ok: false, data: { incidents: [] } },
      });
    }
  }

  await page.close();
  await browser.close();
} catch (err) {
  await browser.close();
  throw err;
}

await Actor.exit();
