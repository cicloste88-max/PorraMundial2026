import { Actor } from 'apify';
import { chromium } from 'playwright';

await Actor.init();

const input = await Actor.getInput();
const { eventId: directId, matchUrl, mode = 'normal' } = input ?? {};

let eventId = directId;
if (!eventId && matchUrl) {
  eventId = matchUrl.match(/#id:(\d+)/)?.[1];
}
if (!eventId) {
  console.error('Se necesita eventId o matchUrl con #id:XXXXX');
  await Actor.exit({ exitCode: 1 });
}

console.log(`[sofascore-webshare] event=${eventId} mode=${mode}`);

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

const browser = await chromium.launch({ proxy });

try {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  const kvStore = await Actor.openKeyValueStore('sofascore-cookies');

  if (mode === 'capture') {
    // PASO 1: Cargar sofascore.com, capturar cookies, guardarlas
    const page = await context.newPage();
    await page.goto('https://www.sofascore.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await page.waitForTimeout(5000);

    const cookies = await context.cookies();
    console.log(`[sofascore-webshare] CAPTURE: ${cookies.length} cookies obtenidas`);

    // Guardar cookies en KV Store
    await kvStore.setValue('SOFASCORE_COOKIES', {
      cookies,
      capturedAt: new Date().toISOString(),
      cookieNames: cookies.map(c => c.name),
    });

    // Hacer el fetch normal para verificar que funcionan
    const baseUrl = `https://api.sofascore.com/api/v1/event/${eventId}`;
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

    console.log(`[sofascore-webshare] CAPTURE event=${results.event.status} incidents=${results.incidents.status}`);

    let eventData, incidentsData;
    try { eventData = JSON.parse(results.event.text); } catch(_) { eventData = { raw: results.event.text.substring(0, 300) }; }
    try { incidentsData = JSON.parse(results.incidents.text); } catch(_) { incidentsData = { raw: results.incidents.text.substring(0, 300) }; }

    await Actor.pushData({
      eventId, mode: 'capture',
      cookieCount: cookies.length,
      event: { status: results.event.status, ok: results.event.status === 200, data: eventData },
      incidents: { status: results.incidents.status, ok: results.incidents.status === 200, data: incidentsData },
    });

    await page.close();

  } else if (mode === 'reuse') {
    // PASO 2: Leer cookies del KV Store, inyectarlas, fetch directo SIN page.goto
    const stored = await kvStore.getValue('SOFASCORE_COOKIES');
    if (!stored?.cookies?.length) {
      console.error('[sofascore-webshare] REUSE: No hay cookies guardadas. Ejecuta primero con mode=capture');
      await browser.close();
      await Actor.exit({ exitCode: 1 });
    }

    console.log(`[sofascore-webshare] REUSE: ${stored.cookies.length} cookies del ${stored.capturedAt}`);

    // Inyectar cookies en el contexto
    await context.addCookies(stored.cookies);

    // Navegar a about:blank para tener una página donde ejecutar fetch
    const page = await context.newPage();
    await page.goto('about:blank');

    const baseUrl = `https://api.sofascore.com/api/v1/event/${eventId}`;
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

    console.log(`[sofascore-webshare] REUSE event=${results.event.status} incidents=${results.incidents.status}`);

    let eventData, incidentsData;
    try { eventData = JSON.parse(results.event.text); } catch(_) { eventData = { raw: results.event.text.substring(0, 300) }; }
    try { incidentsData = JSON.parse(results.incidents.text); } catch(_) { incidentsData = { raw: results.incidents.text.substring(0, 300) }; }

    await Actor.pushData({
      eventId, mode: 'reuse',
      cookiesCapturedAt: stored.capturedAt,
      event: { status: results.event.status, ok: results.event.status === 200, data: eventData },
      incidents: { status: results.incidents.status, ok: results.incidents.status === 200, data: incidentsData },
    });

    await page.close();

  } else {
    // MODO NORMAL: page.goto + fetch (comportamiento original)
    const page = await context.newPage();
    await page.goto('https://www.sofascore.com/', {
      waitUntil: 'domcontentloaded',
      timeout: 120000,
    });
    await page.waitForTimeout(5000);

    const cookies = await context.cookies();
    console.log(`[sofascore-webshare] cookies=${cookies.length}`);

    const baseUrl = `https://api.sofascore.com/api/v1/event/${eventId}`;
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

    console.log(`[sofascore-webshare] event status=${results.event.status} len=${results.event.text.length}`);
    console.log(`[sofascore-webshare] incidents status=${results.incidents.status} len=${results.incidents.text.length}`);

    let eventData, incidentsData;
    try { eventData = JSON.parse(results.event.text); } catch(_) { eventData = { raw: results.event.text.substring(0, 300) }; }
    try { incidentsData = JSON.parse(results.incidents.text); } catch(_) { incidentsData = { raw: results.incidents.text.substring(0, 300) }; }

    await Actor.pushData({
      eventId,
      event: { status: results.event.status, ok: results.event.status === 200, data: eventData },
      incidents: { status: results.incidents.status, ok: results.incidents.status === 200, data: incidentsData },
    });

    await page.close();
  }

  await browser.close();
} catch (err) {
  await browser.close();
  throw err;
}

await Actor.exit();
