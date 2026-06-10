// Versionado desde runtime el 10-jun-2026 (v5). Origen: deploy vía MCP sin commit previo.
// Fuente de verdad hasta esta fecha: runtime Supabase. A partir de ahora: este fichero.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL         = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const NON_ADMIN_LEAGUE_LIMIT = 3;

const CORS = {
  'Access-Control-Allow-Origin':  '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

function generateCode(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let codigo = '';
  for (let i = 0; i < 6; i++) codigo += chars[Math.floor(Math.random() * chars.length)];
  return codigo;
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  if (req.method !== 'POST')    return json({ ok: false, error: 'Metodo no permitido' }, 405);

  // Validamos el JWT manualmente (verify_jwt=false en deploy, por compatibilidad ES256)
  const authHeader = req.headers.get('Authorization') ?? '';
  const jwt = authHeader.replace('Bearer ', '').trim();
  if (!jwt) return json({ ok: false, error: 'No autorizado: falta JWT' }, 401);

  const svc = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
  const { data: { user }, error: authErr } = await svc.auth.getUser(jwt);
  if (authErr || !user) return json({ ok: false, error: 'JWT invalido o expirado' }, 401);

  // Parse body
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) {}
  const nombre = (body.nombre as string)?.trim();
  if (!nombre)                return json({ ok: false, error: 'Falta nombre de la liga' }, 400);
  if (nombre.length > 80)     return json({ ok: false, error: 'Nombre demasiado largo (max 80)' }, 400);

  try {
    // Cargar perfil del creador para saber si es admin
    const { data: profile, error: profErr } = await svc
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();
    if (profErr) throw profErr;

    const isAdmin = !!profile?.is_admin;

    // Aplicar limite solo si NO es admin
    if (!isAdmin) {
      const { count, error: cntErr } = await svc
        .from('leagues')
        .select('id', { count: 'exact', head: true })
        .eq('created_by', user.id);
      if (cntErr) throw cntErr;
      if ((count ?? 0) >= NON_ADMIN_LEAGUE_LIMIT) {
        return json({
          ok: false,
          error: `Limite alcanzado: solo puedes crear ${NON_ADMIN_LEAGUE_LIMIT} ligas (ya tienes ${count}).`,
          limit_reached: true,
          current_count: count,
          limit: NON_ADMIN_LEAGUE_LIMIT,
        }, 403);
      }
    }

    // Generar codigo unico (intentos para evitar colisiones improbables)
    let codigo = '';
    let league: { id: string; nombre: string; codigo: string; created_by: string } | null = null;
    let insertErr: unknown = null;
    for (let attempt = 0; attempt < 5; attempt++) {
      codigo = generateCode();
      const { data, error } = await svc
        .from('leagues')
        .insert({ nombre, codigo, created_by: user.id })
        .select('id, nombre, codigo, created_by')
        .single();
      if (!error && data) { league = data; insertErr = null; break; }
      insertErr = error;
      // 23505 = unique_violation (codigo colisiona). Reintentar.
      // @ts-ignore
      if ((error as any)?.code !== '23505') break;
    }
    if (!league) {
      const msg = (insertErr as any)?.message ?? 'No se pudo crear la liga';
      throw new Error(msg);
    }

    // Inscribir al creador como miembro
    const { error: memErr } = await svc
      .from('league_members')
      .insert({ league_id: league.id, user_id: user.id });
    if (memErr) {
      // Si falla la inscripcion, limpiar la liga para no dejar inconsistencia
      await svc.from('leagues').delete().eq('id', league.id);
      throw memErr;
    }

    return json({ ok: true, data: league });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[create-league]', msg);
    return json({ ok: false, error: msg }, 500);
  }
});
