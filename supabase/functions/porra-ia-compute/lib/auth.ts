// Auth helpers para las actions del EF (spec §8.5).
//
// Contexto: verify_jwt=false a nivel de deploy (ERR-16 — Supabase no acepta
// JWT ES256 automáticamente). La validación se hace manualmente aquí usando
// el service_role client para cruzar el user_id extraído del JWT contra
// profiles.is_admin.
//
// Cron auth: header `X-Cron-Key` vs `IA_CRON_KEY` del Vault, comparado con
// constant-time equality para evitar timing attacks.

// deno-lint-ignore no-explicit-any
type SupabaseClient = any;

export interface AuthContext {
  user_id: string;     // "cron:system" si el caller es el cron
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
// Sin validar firma (verify_jwt=false). Usamos el service_role client de
// Supabase para traducir el access_token → user.id, lo que valida implícitamente
// que el token es legítimo (Supabase lo rechaza si está caducado/malformado).
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

// ─── Exports ────────────────────────────────────────────────────────────────

// Cualquier user logueado. Devuelve user_id. Lanza "unauthorized" si no.
export async function requireAuth(
  req: Request,
  supa: SupabaseClient,
): Promise<string> {
  const userId = await extractUserId(req, supa);
  if (!userId) throw new Error("unauthorized");
  return userId;
}

// User con profiles.is_admin = true. Lanza "forbidden" si no.
export async function requireAdmin(
  req: Request,
  supa: SupabaseClient,
): Promise<string> {
  const userId = await requireAuth(req, supa);
  const isAdmin = await checkIsAdmin(supa, userId);
  if (!isAdmin) throw new Error("forbidden");
  return userId;
}

// Admin JWT O cron key correcto. Devuelve AuthContext con flags.
// Primero comprueba cron key (path barato), si no cae al flow admin.
export async function requireAdminOrCron(
  req: Request,
  supa: SupabaseClient,
): Promise<AuthContext> {
  const cronHeader = req.headers.get("x-cron-key");
  if (cronHeader) {
    // trim() obligatorio (patrón ERR-04 whitespace en Vault secrets).
    const vaultKey = await readVaultSecret(supa, "IA_CRON_KEY");
    if (vaultKey && constantTimeEq(cronHeader.trim(), vaultKey.trim())) {
      return { user_id: "cron:system", is_admin: true, is_cron: true };
    }
  }
  // Fallback: JWT de admin.
  const userId = await requireAuth(req, supa);
  const isAdmin = await checkIsAdmin(supa, userId);
  if (!isAdmin) throw new Error("forbidden");
  return { user_id: userId, is_admin: true, is_cron: false };
}

// Lee un secreto del Vault. Aplica trim() (ERR-04). Devuelve null si no existe.
export async function readVaultSecret(
  supa: SupabaseClient,
  name: string,
): Promise<string | null> {
  const { data, error } = await supa
    .from("vault.decrypted_secrets")
    .select("decrypted_secret")
    .eq("name", name)
    .limit(1)
    .maybeSingle();
  if (error || !data) return null;
  return (data.decrypted_secret || "").trim();
}
