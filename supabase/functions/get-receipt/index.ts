// get-receipt — Proxy público del comprobante de porra alojado en Storage.
//
// Por qué existe: Supabase Storage sirve los objetos públicos con
// Content-Type: text/plain + X-Content-Type-Options: nosniff + CSP sandbox
// (política anti-phishing del producto, NO configurable por bucket). Un enlace
// directo al .html del bucket se muestra como CÓDIGO, no renderizado. Esta EF
// hace de proxy: resuelve el `code` → URL de Storage (guardada en
// sent_receipts.meta.receipt_url), descarga el HTML y lo devuelve con
// Content-Type: text/html para que el navegador lo renderice.
//
// Auth: verify_jwt=false (público). El `code` (12 hex = ~48 bits) es la auth de
// facto: enlace no enumerable, validado contra sent_receipts.meta.code.
//
// Uso: GET /functions/v1/get-receipt?code=XXXXXXXXXXXX

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CODE_RE = /^[A-F0-9]{12}$/;

function htmlResponse(
  body: string,
  status: number,
  extraHeaders: Record<string, string> = {},
): Response {
  return new Response(body, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "X-Content-Type-Options": "nosniff",
      ...extraHeaders,
    },
  });
}

serve(async (req: Request) => {
  if (req.method !== "GET" && req.method !== "HEAD") {
    return new Response("method_not_allowed", { status: 405 });
  }

  // Code: normalizado a mayúsculas y validado estricto (no enumerable + barato).
  const code = (new URL(req.url).searchParams.get("code") || "").trim().toUpperCase();
  if (!CODE_RE.test(code)) {
    return htmlResponse(
      "<!doctype html><meta charset='utf-8'><p>Código de comprobante inválido.</p>",
      400,
    );
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!SUPABASE_URL || !SERVICE_KEY) {
    return htmlResponse(
      "<!doctype html><meta charset='utf-8'><p>Error de configuración.</p>",
      500,
    );
  }

  // deno-lint-ignore no-explicit-any
  let supa: any;
  try {
    supa = createClient(SUPABASE_URL, SERVICE_KEY);
  } catch {
    return htmlResponse("<!doctype html><meta charset='utf-8'><p>Error interno.</p>", 500);
  }

  // Lookup por code en sent_receipts.meta (jsonb, sintaxis PostgREST meta->>code).
  // limit(1): el code es un hash del contenido del pronóstico — dos usuarios con
  // picks idénticos colisionarían; cualquiera de esas filas sirve el mismo HTML,
  // así que tomamos la primera (evita el throw de .single() ante colisión).
  const { data, error } = await supa
    .from("sent_receipts")
    .select("meta")
    .eq("meta->>code", code)
    .limit(1);
  if (error) {
    return htmlResponse("<!doctype html><meta charset='utf-8'><p>Error de consulta.</p>", 500);
  }
  const row = Array.isArray(data) ? data[0] : data;
  const fileUrl: string | undefined = row?.meta?.receipt_url;
  if (!fileUrl) {
    return htmlResponse(
      "<!doctype html><meta charset='utf-8'><p>Comprobante no encontrado.</p>",
      404,
    );
  }

  // Descargar el HTML de Storage. El bucket es público (fetch sin auth basta),
  // pero pasamos apikey + Authorization por consistencia/resiliencia.
  let upstream: Response;
  try {
    upstream = await fetch(fileUrl, {
      headers: { "apikey": SERVICE_KEY, "Authorization": `Bearer ${SERVICE_KEY}` },
    });
  } catch {
    return htmlResponse(
      "<!doctype html><meta charset='utf-8'><p>No se pudo recuperar el comprobante.</p>",
      502,
    );
  }
  if (!upstream.ok) {
    return htmlResponse(
      "<!doctype html><meta charset='utf-8'><p>No se pudo recuperar el comprobante.</p>",
      502,
    );
  }
  const html = await upstream.text();

  // Servir con el Content-Type CORRECTO (las respuestas de EF NO sufren el
  // override anti-phishing de Storage). nosniff es buena práctica: con text/html
  // explícito el navegador lo respeta y renderiza.
  return htmlResponse(html, 200, { "Cache-Control": "private, max-age=300" });
});
