async function post(url, body) {
  let r;
  try {
    r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  } catch {
    throw new Error('Cannot reach the CareerQuest server. Did you run "npm run dev"?');
  }
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || `Request failed (${r.status})`);
  return j;
}

export const api = {
  health: () => fetch('/api/health').then((r) => r.json()).catch(() => ({ ollama: false, installed: false, server: false })),
  generate: (body) => post('/api/generate', body),
  nodeDetail: (body) => post('/api/node-detail', body),
  paths: (body) => post('/api/paths', body),
};
