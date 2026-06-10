// Versionado desde runtime el 10-jun-2026 (v4). Origen: deploy vía MCP sin commit previo.
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

async function getSecrets() {
  const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/get_vault_secrets`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SUPABASE_SERVICE_KEY}`,
      'apikey': SUPABASE_SERVICE_KEY,
    },
    body: JSON.stringify({ secret_names: ['TWILIO_ACCOUNT_SID', 'TWILIO_API_KEY', 'TWILIO_API_SECRET'] }),
  });
  const rows = res.ok ? await res.json() : [];
  const sm: Record<string, string> = {};
  for (const r of rows ?? []) sm[r.name] = r.secret;
  return sm;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) {}

  const to = (body.to as string) ?? '';
  const message = (body.message as string) ?? '';
  if (!to || !message) return json({ ok: false, error: 'to y message requeridos' }, 400);

  try {
    const secrets = await getSecrets();
    const accountSid = secrets['TWILIO_ACCOUNT_SID'];
    const apiKey = secrets['TWILIO_API_KEY'];
    const apiSecret = secrets['TWILIO_API_SECRET'];

    if (!accountSid || !apiKey || !apiSecret) throw new Error('Secrets de Twilio no encontrados');

    const credentials = btoa(`${apiKey}:${apiSecret}`);

    const params = new URLSearchParams();
    params.append('From', 'whatsapp:+14155238886');
    params.append('To', `whatsapp:${to}`);
    params.append('Body', message);

    const res = await fetch(
      `https://api.twilio.com/2010-04-01/Accounts/${accountSid}/Messages.json`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${credentials}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: params.toString(),
      }
    );

    const data = await res.json();

    if (!res.ok) {
      return json({ ok: false, status: res.status, error: data.message, code: data.code }, 400);
    }

    return json({ ok: true, sid: data.sid, status: data.status, to: data.to });

  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    return json({ ok: false, error: msg }, 500);
  }
});
