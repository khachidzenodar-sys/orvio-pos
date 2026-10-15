import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';

function evaluate(path, imports = {}, globals = {}) {
  const source = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', ...Object.keys(globals), source)(name => {
    if (name === 'server-only') return {};
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
    return imports[name];
  }, module, module.exports, ...Object.values(globals));
  return module.exports;
}
const userId = '12345678-1234-1234-1234-123456789abc';
const environment = { SUPABASE_URL: 'https://example.supabase.co', SUPABASE_ANON_KEY: 'public-key', SUPABASE_SERVICE_ROLE_KEY: 'private-server-key', ORVIO_ALLOWED_EMAILS: 'owner@example.com' };
function harness(responder, env = environment) {
  const calls = [];
  const config = evaluate('../lib/server/config.ts', {}, { process: { env }, fetch: async (url, options) => { calls.push({ url, options }); return responder(url, options); } });
  const auth = evaluate('../lib/server/auth.ts', { './config': config });
  const store = evaluate('../lib/server/store.ts', { './config': config });
  const login = evaluate('../app/api/auth/login/route.ts', { '@/lib/server/config': config, '@/lib/server/auth': auth });
  const logout = evaluate('../app/api/auth/logout/route.ts', { '@/lib/server/config': config, '@/lib/server/auth': auth });
  return { calls, config, auth, store, login, logout };
}
const request = (path, body, origin = 'https://pos.test') => new Request(`https://pos.test${path}`, { method: 'POST', headers: { origin, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('spoofed identity and bearer headers without cookie never authenticate or access network', async () => {
  const h = harness(() => { throw new Error('must not fetch'); });
  const result = await h.auth.getUser(new Request('https://pos.test/api/pos', { headers: { 'x-user-id': userId, 'x-chatgpt-user-id': userId, Authorization: 'Bearer fabricated' } }));
  assert.equal(result, null); assert.equal(h.calls.length, 0);
});
test('cookie is verified remotely using public key; user must be confirmed and allowlisted', async () => {
  let user = { id: userId, email: 'owner@example.com', email_confirmed_at: '2026-01-01' };
  const h = harness(() => Response.json(user));
  const r = new Request('https://pos.test/api/pos', { headers: { cookie: '__Host-orvio_session=verified-token' } });
  assert.deepEqual(await h.auth.getUser(r), { userId });
  assert.equal(h.calls[0].url, 'https://example.supabase.co/auth/v1/user');
  assert.equal(h.calls[0].options.headers.Authorization, 'Bearer verified-token');
  assert.equal(h.calls[0].options.headers.apikey, 'public-key');
  user = { ...user, email: 'stranger@example.com' }; assert.equal(await h.auth.getUser(r), null);
  user = { ...user, email: 'owner@example.com', email_confirmed_at: null }; assert.equal(await h.auth.getUser(r), null);
});
test('invalid/expired token is unauthorized and auth service outage fails closed', async () => {
  const r = new Request('https://pos.test/api/pos', { headers: { cookie: '__Host-orvio_session=expired' } });
  const denied = harness(() => new Response('', { status: 401 })); assert.equal(await denied.auth.getUser(r), null);
  const down = harness(() => new Response('', { status: 500 })); await assert.rejects(down.auth.getUser(r), down.config.ServiceUnavailable);
  const missing = harness(() => { throw new Error('must not fetch'); }, {}); await assert.rejects(missing.auth.getUser(r), missing.config.ServiceUnavailable); assert.equal(missing.calls.length, 0);
});
test('login sets secure server-only cookie and never returns access/refresh tokens', async () => {
  const h = harness(() => Response.json({ access_token: 'secret-access-token', refresh_token: 'secret-refresh-token', expires_in: 3600, user: { email: 'owner@example.com', email_confirmed_at: '2026-01-01' } }));
  const r = await h.login.POST(request('/api/auth/login', { email: 'owner@example.com', password: 'secret-password' }));
  assert.equal(r.status, 200); assert.deepEqual(await r.json(), { ok: true });
  assert.match(r.headers.get('set-cookie'), /__Host-orvio_session=secret-access-token; Path=\/; HttpOnly; Secure; SameSite=Lax; Max-Age=3600/);
  assert.equal(h.calls[0].options.headers.apikey, 'public-key');
  assert.equal(h.calls[0].options.cache, 'no-store');
});
test('login/logout reject cross-origin or missing origin; logout expires session', async () => {
  const h = harness(() => { throw new Error('must not fetch'); });
  assert.equal((await h.login.POST(request('/api/auth/login', {}, 'https://evil.test'))).status, 403);
  assert.equal((await h.logout.POST(request('/api/auth/logout', {}, 'https://evil.test'))).status, 403);
  assert.equal((await h.login.POST(new Request('https://pos.test/api/auth/login', { method: 'POST' }))).status, 403);
  const result = await h.logout.POST(request('/api/auth/logout', {}));
  assert.equal(result.status, 200); assert.match(result.headers.get('set-cookie'), /Max-Age=0/); assert.equal(h.calls.length, 0);
});
test('login honors Supabase rate limits and hides provider error details', async () => {
  for (const [status, expected] of [[429, 429], [400, 401], [500, 503]]) {
    const h = harness(() => Response.json({ error: 'provider secret debug' }, { status }));
    const result = await h.login.POST(request('/api/auth/login', { email: 'owner@example.com', password: 'x' }));
    assert.equal(result.status, expected); assert.ok(!(await result.text()).includes('provider secret')); assert.equal(result.headers.get('set-cookie'), null);
  }
});
test('storage initialization ignores duplicate ids and reads only verified-user key', async () => {
  const h = harness((url, options) => options.method === 'POST' ? new Response(null, { status: 201 }) : Response.json([{ version: 2, document: 'existing document' }]));
  assert.deepEqual(await h.store.readStore(userId, 'seed'), { version: 2, document: 'existing document' });
  assert.equal(h.calls[0].options.headers.Prefer, 'resolution=ignore-duplicates,return=minimal');
  assert.deepEqual(JSON.parse(h.calls[0].options.body), { id: userId, version: 0, document: 'seed' });
  assert.match(h.calls[1].url, new RegExp(`id=eq.${userId}&select=version,document`));
  assert.equal(h.calls[1].options.headers.Authorization, 'Bearer private-server-key');
});
test('storage CAS updates match both user id and version; collision does not count as success', async () => {
  let rows = [{ version: 8 }];
  const h = harness(() => Response.json(rows));
  assert.equal(await h.store.saveStore(userId, 7, 'new document'), true);
  assert.equal(h.calls[0].options.method, 'PATCH');
  assert.match(h.calls[0].url, new RegExp(`id=eq.${userId}&version=eq.7&select=version`));
  assert.deepEqual(JSON.parse(h.calls[0].options.body), { version: 8, document: 'new document' });
  rows = []; assert.equal(await h.store.saveStore(userId, 7, 'stale document'), false);
});
