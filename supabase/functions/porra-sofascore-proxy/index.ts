// Versionado desde runtime el 10-jun-2026 (v11). Origen: deploy vía MCP sin commit previo.
// Fuente de verdad hasta esta fecha: runtime Supabase. A partir de ahora: este fichero.
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status, headers: { ...CORS, 'Content-Type': 'application/json' },
  });
}

async function getProxyUrl(): Promise<string> {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_vault_secrets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'apikey': SUPABASE_SERVICE_KEY,
    },
    body: JSON.stringify({ secret_names: ['PROXY_URL'] }),
  });
  const rows = res.ok ? await res.json() : [];
  const proxyUrl = rows?.find((r: any) => r.name === 'PROXY_URL')?.secret ?? '';
  if (!proxyUrl) throw new Error('PROXY_URL no encontrado en Vault');
  return proxyUrl;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) {}

  const eventId = (body.event_id as string) ?? '';
  const endpoint = (body.endpoint as string) ?? 'incidents';
  if (!eventId) return json({ ok: false, error: 'event_id requerido' }, 400);

  try {
    const proxyUrl = await getProxyUrl();
    const parsed = new URL(proxyUrl);
    const password = decodeURIComponent(parsed.password);
    const proxyAuth = btoa(`${parsed.username}:${password}`);

    // Apify proxy no soporta CONNECT tunnel para HTTPS
    // Usamos HTTP (no HTTPS) para que el proxy pueda hacer forward proxy
    const targetUrl = `http://api.sofascore.com/api/v1/event/${eventId}/${endpoint}`;

    // Llamada directa al proxy con la URL absoluta como destino (forward proxy)
    const proxyEndpoint = `http://${parsed.hostname}:${parsed.port}`;

    const response = await fetch(targetUrl, {
      headers: {
        'Host': 'api.sofascore.com',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Referer': 'https://www.sofascore.com/',
        'Accept': 'application/json',
        'Accept-Language': 'es-ES,es;q=0.9',
        'Proxy-Authorization': `Basic ${proxyAuth}`,
      },
    });

    const text = await response.text();
    let data;
    try { data = JSON.parse(text); } catch(_) { data = { raw: text.substring(0, 500) }; }

    console.log(`[sofascore-proxy] HTTP status=${response.status}`);

    return json({ ok: response.ok, status: response.status, event_id: eventId, endpoint, data });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[porra-sofascore-proxy]', msg);
    return json({ ok: false, error: msg }, 500);
  }
});
