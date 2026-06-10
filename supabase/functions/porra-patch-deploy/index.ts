// Versionado desde runtime el 10-jun-2026 (v7). Origen: deploy vía MCP sin commit previo.
// Fuente de verdad hasta esta fecha: runtime Supabase. A partir de ahora: este fichero.
const GITHUB_API = 'https://api.github.com';
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...CORS, 'Content-Type': 'application/json' } });
}

async function getSecrets() {
  const url = Deno.env.get('SUPABASE_URL') ?? '';
  const key = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
  const res = await fetch(`${url}/rest/v1/rpc/get_vault_secrets`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`, 'apikey': key },
    body: JSON.stringify({ secret_names: ['GITHUB_TOKEN', 'GITHUB_REPO'] })
  });
  const rows = res.ok ? await res.json() : [];
  const sm: Record<string, string> = {};
  for (const r of rows ?? []) sm[r.name] = r.secret;
  return { token: sm['GITHUB_TOKEN'] ?? '', repo: sm['GITHUB_REPO'] ?? '' };
}

async function gh(token: string, path: string, method = 'GET', body?: unknown) {
  const r = await fetch(`${GITHUB_API}${path}`, {
    method,
    headers: {
      'Authorization': `Bearer ${token}`,
      'Accept': 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
      'Content-Type': 'application/json',
    },
    ...(body ? { body: JSON.stringify(body) } : {})
  });
  return { status: r.status, data: await r.json() };
}

function decodeBase64UTF8(b64: string): string {
  const clean = b64.replace(/\n/g, '');
  const bytes = Uint8Array.from(atob(clean), c => c.charCodeAt(0));
  return new TextDecoder('utf-8').decode(bytes);
}

function encodeBase64UTF8(str: string): string {
  const bytes = new TextEncoder().encode(str);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary);
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });

  const { token, repo } = await getSecrets();
  if (!token || !repo) return json({ ok: false, error: 'Secrets no encontrados' }, 500);

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) {}
  const action = (body.action as string) ?? '';

  if (action === 'ping') {
    const { status, data } = await gh(token, `/repos/${repo}`);
    if (status !== 200) return json({ ok: false, error: data.message, status });
    return json({ ok: true, repo: data.full_name, default_branch: data.default_branch });
  }

  if (action === 'search') {
    const filePath = (body.file as string) ?? 'index.html';
    const searchTerm = body.search as string;
    const occurrence = (body.occurrence as number) ?? 0; // which occurrence to return (0 = first)
    const { status, data } = await gh(token, `/repos/${repo}/contents/${filePath}`);
    if (status !== 200) return json({ ok: false, error: data.message }, 500);
    const content = decodeBase64UTF8(data.content);

    // Find nth occurrence
    let idx = -1;
    let count = 0;
    let searchFrom = 0;
    while (true) {
      const found = content.indexOf(searchTerm, searchFrom);
      if (found === -1) break;
      if (count === occurrence) { idx = found; break; }
      count++;
      searchFrom = found + 1;
    }

    if (idx === -1) return json({ ok: false, found: false, search: searchTerm, total_occurrences: count });
    const snippet = content.slice(Math.max(0, idx - 40), idx + 120);
    // Return char codes for precise debugging
    const char_codes = [...snippet].map(c => c.codePointAt(0));
    return json({ ok: true, found: true, idx, snippet, char_codes });
  }

  if (action === 'apply_patch') {
    const filePath = (body.file as string) ?? 'index.html';
    const patches  = body.patches as Array<{ search: string; replace: string }>;
    const message  = (body.message as string) ?? 'fix: patch automatico desde claude.ai';
    if (!patches?.length) return json({ ok: false, error: 'No hay patches' }, 400);

    const { status: getS, data: fileData } = await gh(token, `/repos/${repo}/contents/${filePath}`);
    if (getS !== 200) return json({ ok: false, error: `No se pudo leer ${filePath}: ${fileData.message}` }, 500);

    const currentContent = decodeBase64UTF8(fileData.content);
    let patched = currentContent;
    const results: Array<{ search_snippet: string; applied: boolean; occurrences: number }> = [];

    for (const patch of patches) {
      const occurrences = patched.split(patch.search).length - 1;
      if (occurrences > 0) {
        patched = patched.split(patch.search).join(patch.replace);
        results.push({ search_snippet: patch.search.slice(0, 80), applied: true, occurrences });
      } else {
        results.push({ search_snippet: patch.search.slice(0, 80), applied: false, occurrences: 0 });
      }
    }

    const appliedCount = results.filter(r => r.applied).length;
    if (appliedCount === 0) return json({ ok: false, error: 'Ningun patch encontro coincidencias', results }, 422);

    const newContent = encodeBase64UTF8(patched);
    const { status: putS, data: putData } = await gh(token, `/repos/${repo}/contents/${filePath}`, 'PUT', {
      message, content: newContent, sha: fileData.sha,
    });

    const ok = putS === 200 || putS === 201;
    return json({
      ok, file: filePath,
      patches_applied: appliedCount, patches_total: patches.length,
      results,
      commit: ok ? putData.commit?.sha?.slice(0, 7) : null,
      error: ok ? null : putData.message,
    });
  }

  return json({ ok: false, error: `Accion desconocida: "${action}"` }, 400);
});
