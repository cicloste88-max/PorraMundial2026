// Versionado desde runtime el 10-jun-2026 (v9). Origen: deploy vía MCP sin commit previo.
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
Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS });
  const { token, repo } = await getSecrets();
  if (!token || !repo) return json({ ok: false, error: 'Secrets no encontrados' }, 500);
  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) {}
  const branch = (body.branch as string) || 'main';
  const action = (body.action as string) || 'inspect';
  const filepath = (body.filepath as string) || 'CLAUDE.md';
  if (action === 'inspect') {
    const rawRes = await fetch(`https://raw.githubusercontent.com/${repo}/${branch}/${filepath}`);
    if (!rawRes.ok) return json({ ok: false, error: `No se pudo leer: ${rawRes.status}` }, 500);
    const rawBytes = new Uint8Array(await rawRes.arrayBuffer());
    const hasBOM = rawBytes[0] === 0xEF && rawBytes[1] === 0xBB && rawBytes[2] === 0xBF;
    const firstBytes = Array.from(rawBytes.slice(0, 8)).map(b => b.toString(16).padStart(2,'0')).join(' ');
    const content = new TextDecoder('utf-8').decode(rawBytes);
    return json({ ok: true, size_bytes: rawBytes.length, has_bom: hasBOM, first_bytes: firstBytes, preview: content.slice(0, 200) });
  }
  if (action === 'write') {
    const newContent = body.content as string;
    if (!newContent) return json({ ok: false, error: 'Falta content' }, 400);
    const message = (body.message as string) || `docs: actualizar ${filepath}`;
    const { status: getS, data: fileData } = await gh(token, `/repos/${repo}/contents/${filepath}?ref=${branch}`);
    const sha = getS === 200 ? fileData.sha : undefined;
    const bytes = new TextEncoder().encode(newContent);
    let binary = '';
    for (const byte of bytes) binary += String.fromCharCode(byte);
    const b64 = btoa(binary);
    const putBody: Record<string,unknown> = { message, content: b64, branch };
    if (sha) putBody.sha = sha;
    const { status: putS, data: putData } = await gh(token, `/repos/${repo}/contents/${filepath}`, 'PUT', putBody);
    const ok = putS === 200 || putS === 201;
    return json({ ok, commit: ok ? putData.commit?.sha?.slice(0,7) : null, error: ok ? null : putData.message });
  }
  if (action === 'write_binary') {
    const contentBase64 = body.content_base64 as string;
    if (!contentBase64) return json({ ok: false, error: 'Falta content_base64' }, 400);
    const message = (body.message as string) || `docs: actualizar ${filepath}`;
    const { status: getS, data: fileData } = await gh(token, `/repos/${repo}/contents/${filepath}?ref=${branch}`);
    const sha = getS === 200 ? fileData.sha : undefined;
    const putBody: Record<string,unknown> = { message, content: contentBase64, branch };
    if (sha) putBody.sha = sha;
    const { status: putS, data: putData } = await gh(token, `/repos/${repo}/contents/${filepath}`, 'PUT', putBody);
    const ok = putS === 200 || putS === 201;
    return json({ ok, commit: ok ? putData.commit?.sha?.slice(0,7) : null, error: ok ? null : putData.message });
  }
  return json({ ok: false, error: 'Accion no reconocida: ' + action });
});
