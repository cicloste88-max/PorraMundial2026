// Versionado desde runtime el 10-jun-2026 (v7). Origen: deploy vía MCP sin commit previo.
// Fuente de verdad hasta esta fecha: runtime Supabase. A partir de ahora: este fichero.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const TWILIO_NUMBER = '+14155238886';

function twiml(message: string) {
  return new Response(
    `<?xml version="1.0" encoding="UTF-8"?><Response><Message>${message}</Message></Response>`,
    { headers: { 'Content-Type': 'text/xml' } }
  );
}

Deno.serve(async (req) => {
  let body: Record<string, string> = {};
  try {
    const text = await req.text();
    const params = new URLSearchParams(text);
    params.forEach((v, k) => { body[k] = v; });
  } catch (_) {}

  console.log('[webhook] body completo:', JSON.stringify(body));

  const from = body['From'] ?? '';
  const to = body['To'] ?? '';
  const waId = body['WaId'] ?? '';
  const msgBody = (body['Body'] ?? '').trim().toLowerCase();

  // Determinar cual es el numero del usuario:
  // En sandbox a veces From=Twilio y To=usuario
  // Usamos WaId si existe (siempre es el usuario), si no miramos cual NO es Twilio
  let phone = '';
  if (waId) {
    phone = '+' + waId;
  } else {
    const fromClean = from.replace('whatsapp:', '');
    const toClean = to.replace('whatsapp:', '');
    phone = fromClean !== TWILIO_NUMBER ? fromClean : toClean;
  }

  console.log(`[webhook] phone=${phone} From=${from} To=${to} WaId=${waId} Body=${msgBody}`);

  if (!phone || phone === TWILIO_NUMBER) {
    console.error('[webhook] No se pudo determinar el numero del usuario');
    return twiml('Error: numero no detectado');
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

  if (msgBody === 'stop') {
    await supabase
      .from('whatsapp_subscribers')
      .update({ active: false, updated_at: new Date().toISOString() })
      .eq('phone', phone);
    console.log(`[webhook] Baja: ${phone}`);
    return twiml('Te has dado de baja de las notificaciones de la Porra Mundial 2026. Hasta pronto!');
  }

  const { error } = await supabase
    .from('whatsapp_subscribers')
    .upsert(
      { phone, active: true, updated_at: new Date().toISOString() },
      { onConflict: 'phone' }
    );

  if (error) {
    console.error('[webhook] Error upsert:', error.message);
    return twiml('Error interno. Intentalo de nuevo.');
  }

  console.log(`[webhook] Suscriptor registrado: ${phone}`);
  return twiml('Bienvenido a la Porra Mundial 2026! Recibiras notificaciones de goles en tiempo real. Envia STOP para darte de baja.');
});
