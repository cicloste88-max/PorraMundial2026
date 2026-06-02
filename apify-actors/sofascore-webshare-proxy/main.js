import { Actor } from 'apify';
import { chromium } from 'playwright';

await Actor.init();

const input = (await Actor.getInput()) ?? {};
const { eventId: directId, eventIds: directIds, matchUrl, mode = 'normal' } = input;

// Normalizar la entrada a un array de eventIds (string).
// Retrocompat: `eventId` único o `matchUrl` con #id: siguen funcionando → [id].
// Batching: `eventIds: string[]` lee N partidos en un solo run (un único
// context+cookies) y empuja N items independientes al dataset.
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

const proxy = {
  server: 'http://p.webshare.io:80',
  username: 'nkbtcztk-US-GB-DE-NL-FR-rotate',
  password: '6b1lhjc8eou2',
};

// Fetch /event + /incidents para UN eventId desde una page ya preparada
// (cookies/contexto reutilizados entre ids del mismo run). Devuelve el mismo
// shape que consume porra-apify-webhook: { event:{status,ok,data}, incidents:{...} }.
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

  // Preparar UNA sola page con cookies según modo. Un único context+cookies
  // sirve para todo el batch (clave para no relanzar Chromium por partido).
  let page;
  let extra = {}; // campos extra que cada modo añade al pushData

  if (mode === 'capture') {
    // PASO 1: cargar sofascore.com, capturar cookies y guardarlas en KV Store.
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
    // PASO 2: leer cookies del KV Store, inyectarlas, fetch directo SIN page.goto.
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
    // MODO NORMAL: page.goto + fetch (comportamiento original).
    page = await context.newPage();
    await page.goto('https://www.sofascore.com/', { waitUntil: 'domcontentloaded', timeout: 120000 });
    await page.waitForTimeout(5000);
    const cookies = await context.cookies();
    console.log(`[sofascore-webshare] cookies=${cookies.length}`);
  }

  // UN item por eventId. El dataset resultante tiene N items, cada uno
  // interpretable de forma independiente por porra-apify-webhook (v9+).
  // try/catch por id: un partido que falle NO tumba el resto del batch;
  // se empuja un item con ok:false que el webhook ignora.
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
