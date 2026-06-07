// Auth helpers para send-porra-receipt.
//
// COPIA SELF-CONTAINED de supabase/functions/porra-ia-compute/lib/auth.ts.
// La lógica es idéntica (requireAdminOrCron + readVaultSecret sobre el secreto
// Vault IA_CRON_KEY) — se copia dentro de la carpeta de la función para que el
// deploy vía MCP (`deploy_edge_function`) empaquete con imports `./` y no
// dependa de resolución cruzada entre carpetas de funciones. La versión
// canónica vive en porra-ia-compute/lib/auth.ts; si se cambia el contrato de
// auth, sincronizar ambas.
//
// Contexto: verify_jwt=false a nivel de deploy (ERR-16 — Supabase no acepta
// JWT ES256 automáticamente). La validación se hace manualmente aquí usando
// el service_role client para cruzar el user_id extraído del JWT contra
// profiles.is_admin.
//
// Bypasses que otorgan nivel admin:
//   - Bearer == SUPABASE_SERVICE_ROLE_KEY (flow desde Claude.ai / SQL).
//   - Header X-Cron-Key == IA_CRON_KEY del Vault (para pg_cron). trim() previo
//     para evitar ERR-04 (whitespace en Vault).

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface AuthContext {
  user_id: string; // "cron:system" si el caller es el cron; "service:system" si service_role
  is_admin: boolean;
  is_cron: boolean;
}

// ─── Constant-time string compare ──────────────────────────────────────────
function constantTimeEq(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

// ─── Extraer user_id del JWT del header Authorization ──────────────────────
async function extractUserId(
  req: Request,
  supa: SupabaseClient,
): Promise<string | null> {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return null;
  }
  const token = authHeader.slice(7).trim();
  if (!token) return null;
  try {
    const { data, error } = await supa.auth.getUser(token);
    if (error || !data?.user?.id) return null;
    return data.user.id;
  } catch {
    return null;
  }
}

async function checkIsAdmin(
  supa: SupabaseClient,
  userId: string,
): Promise<boolean> {
  const { data, error } = await supa
    .from("profiles")
    .select("is_admin")
    .eq("id", userId)
    .limit(1)
    .maybeSingle();
  if (error || !data) return false;
  return data.is_admin === true;
}

// ─── Service role bypass ───────────────────────────────────────────────────
export function isServiceRole(req: Request): boolean {
  const authHeader = req.headers.get("authorization");
  if (!authHeader || !authHeader.toLowerCase().startsWith("bearer ")) {
    return false;
  }
  const token = authHeader.slice(7).trim();
  const srk = (Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "").trim();
  if (!token || !srk) return false;
  return constantTimeEq(token, srk);
}

// Cualquier user logueado (o service_role). Lanza "unauthorized" si no.
export async function requireAuth(
  req: Request,
  supa: SupabaseClient,
): Promise<string> {
  if (isServiceRole(req)) return "service:system";
  const userId = await extractUserId(req, supa);
  if (!userId) throw new Error("unauthorized");
  return userId;
}

// Admin JWT O cron key correcto O service role. Devuelve AuthContext con flags.
export async function requireAdminOrCron(
  req: Request,
  supa: SupabaseClient,
): Promise<AuthContext> {
  // Cron path primero (más barato si viene con header).
  const cronHeader = req.headers.get("x-cron-key");
  if (cronHeader) {
    // trim() obligatorio (patrón ERR-04 whitespace en Vault secrets).
    const vaultKey = await readVaultSecret(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
      "IA_CRON_KEY",
    );
    if (vaultKey && constantTimeEq(cronHeader.trim(), vaultKey.trim())) {
      return { user_id: "cron:system", is_admin: true, is_cron: true };
    }
  }
  if (isServiceRole(req)) {
    return { user_id: "service:system", is_admin: true, is_cron: false };
  }
  const userId = await requireAuth(req, supa);
  const isAdmin = await checkIsAdmin(supa, userId);
  if (!isAdmin) throw new Error("forbidden");
  return { user_id: userId, is_admin: true, is_cron: false };
}

// Lee un secreto del Vault vía RPC `get_vault_secrets(secret_names text[])`.
// fetch directo con apikey + Authorization = SERVICE_ROLE_KEY (mismo patrón
// que porra-ia-compute / porra-fix-encoding). Devuelve null si no existe.
export async function readVaultSecret(
  supabaseUrl: string,
  serviceRoleKey: string,
  name: string,
): Promise<string | null> {
  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/rpc/get_vault_secrets`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "apikey": serviceRoleKey,
        "Authorization": `Bearer ${serviceRoleKey}`,
      },
      body: JSON.stringify({ secret_names: [name] }),
    });
    if (!res.ok) return null;
    const data = await res.json();
    // deno-lint-ignore no-explicit-any
    const row = Array.isArray(data) ? data.find((r: any) => r.name === name) : null;
    return row ? (row.secret as string).trim() : null;
  } catch {
    return null;
  }
}
