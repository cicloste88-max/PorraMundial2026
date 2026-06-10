// Versionado desde runtime el 10-jun-2026 (v5). Origen: deploy vía MCP sin commit previo.
// Fuente de verdad hasta esta fecha: runtime Supabase. A partir de ahora: este fichero.
// STUB: EF temporal usada el 25-may-2026 para recrop de los 48 WebPs flags-sm/
// Trabajo completado vía curl directo. Función deshabilitada (verify_jwt=true + stub 410).
// Puede borrarse físicamente desde el Dashboard.
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

serve(() => new Response(JSON.stringify({ error: 'Gone. EF temporal de upload de flags. Deshabilitada.' }), {
  status: 410, headers: { 'Content-Type': 'application/json' }
}))