import { Actor } from 'apify';
import { chromium } from 'playwright';

await Actor.init();

const input = await Actor.getInput();
const { eventId } = input ?? {};

if (!eventId) {
  console.error('eventId requerido');
  await Actor.exit({ exitCode: 1 });
}

console.log(`[sofascore-proxy] event=${eventId}`);

const proxyConfiguration = await Actor.createProxyConfiguration({
  groups: ['RESIDENTIAL'],
});

const proxyUrl = await proxyConfiguration.newUrl();
const parsed = new URL(proxyUrl);

const browser = await chromium.launch({
  proxy: {
    server: `http://${parsed.hostname}:${parsed.port}`,
    username: parsed.username,
    password: decodeURIComponent(parsed.password),
  },
});

try {
  const context = await browser.newContext({
    userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  });

  const page = await context.newPage();

  // Cargar sofascore.com y esperar a que Cloudflare resuelva el challenge
  await page.goto('https://www.sofascore.com/', {
    waitUntil: 'domcontentloaded',
    timeout: 60000,
  });
  await page.waitForTimeout(5000);

  const cookies = await context.cookies();
  console.log(`[sofascore-proxy] cookies=${cookies.length}`);

  const baseUrl = `https://api.sofascore.com/api/v1/event/${eventId}`;

  // Fetch event + incidents en paralelo desde dentro del browser
  const results = await page.evaluate(async (base) => {
    const doFetch = async (url) => {
      const res = await fetch(url, {
        headers: {
          'Accept': 'application/json',
          'Referer': 'https://www.sofascore.com/',
        },
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

  console.log(`[sofascore-proxy] event status=${results.event.status} len=${results.event.text.length}`);
  console.log(`[sofascore-proxy] incidents status=${results.incidents.status} len=${results.incidents.text.length}`);

  let eventData, incidentsData;
  try { eventData = JSON.parse(results.event.text); } catch(_) { eventData = { raw: results.event.text.substring(0, 300) }; }
  try { incidentsData = JSON.parse(results.incidents.text); } catch(_) { incidentsData = { raw: results.incidents.text.substring(0, 300) }; }

  await Actor.pushData({
    eventId,
    event: { status: results.event.status, ok: results.event.status === 200, data: eventData },
    incidents: { status: results.incidents.status, ok: results.incidents.status === 200, data: incidentsData },
  });

  await browser.close();
} catch (err) {
  await browser.close();
  throw err;
}

await Actor.exit();
