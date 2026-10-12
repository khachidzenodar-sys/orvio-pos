import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import ts from 'typescript';
import { webcrypto } from 'node:crypto';

// Run real route/domain code without a network server. D1 and platform auth are
// narrow in-memory doubles; production Cloudflare SQL/auth remain deployment QA.
function evaluate(path, imports = {}) {
  const source = ts.transpileModule(fs.readFileSync(new URL(path, import.meta.url), 'utf8'), { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  new Function('require', 'module', 'exports', 'crypto', source)(name => {
    if (!(name in imports)) throw new Error(`Unexpected import: ${name}`);
    return imports[name];
  }, module, module.exports, webcrypto);
  return module.exports;
}
const domain = evaluate('../lib/pos.ts');
function harness() {
  const rows = new Map();
  let currentUser = { userId: 'cashier-A' };
  const DB = { prepare(sql) { return { bind(...args) { return {
    async run() {
      if (sql.startsWith('INSERT OR IGNORE')) { if (!rows.has(args[0])) rows.set(args[0], { version: 0, document: args[1] }); return { meta: { changes: 1 } }; }
      if (sql.startsWith('UPDATE pos_store')) { const row = rows.get(args[1]); if (!row || row.version !== args[2]) return { meta: { changes: 0 } }; rows.set(args[1], { version: row.version + 1, document: args[0] }); return { meta: { changes: 1 } }; }
      throw new Error(`Unexpected SQL: ${sql}`);
    },
    async first() { assert.match(sql, /^SELECT version, document/); return structuredClone(rows.get(args[0]) ?? null); }
  }; } }; } };
  const api = evaluate('../app/api/pos/route.ts', { 'cloudflare:workers': { env: { DB } }, '@/app/chatgpt-auth': { getChatGPTUser: async () => currentUser }, '@/lib/pos': domain });
  const post = (action, payload = {}, version = rows.get(currentUser?.userId)?.version ?? 0, requestId = webcrypto.randomUUID(), origin = 'https://pos.test') => api.POST(new Request('https://pos.test/api/pos', { method: 'POST', headers: { 'content-type': 'application/json', origin }, body: JSON.stringify({ action, payload, version, requestId }) }));
  return { api, post, rows, setUser(value) { currentUser = value; } };
}

test('GET and POST require authenticated identity before touching D1', async () => {
  const h = harness(); h.setUser(null);
  assert.equal((await h.api.GET()).status, 401);
  assert.equal((await h.post('openOrder', { tableId: 'table-1' })).status, 401);
  assert.equal(h.rows.size, 0);
});
test('tenant states are isolated by authenticated user id', async () => {
  const h = harness(); await h.post('openOrder', { tableId: 'table-1' });
  h.setUser({ userId: 'cashier-B' });
  assert.equal((await (await h.api.GET()).json()).state.orders.length, 0);
  h.setUser({ userId: 'cashier-A' });
  assert.equal((await (await h.api.GET()).json()).state.orders.length, 1);
});
test('cross-origin writes are rejected without mutation', async () => {
  const h = harness();
  assert.equal((await h.post('openOrder', { tableId: 'table-1' }, 0, webcrypto.randomUUID(), 'https://attacker.test')).status, 403);
  assert.equal(h.rows.size, 0);
});
test('PIN setup hashes secret, excludes all secret material from API, rejects replacement', async () => {
  const h = harness(); const response = await h.post('setupPin', { pin: '135790' });
  const body = await response.json(); assert.equal(response.status, 200); assert.equal(body.configured, true);
  assert.deepEqual(Object.keys(body).sort(), ['configured', 'state', 'version']);
  const doc = JSON.parse(h.rows.get('cashier-A').document);
  assert.match(doc.pin.hash, /^[a-f0-9]{64}$/); assert.match(doc.pin.salt, /^[a-f0-9]{32}$/);
  assert.ok(!h.rows.get('cashier-A').document.includes('135790'));
  assert.ok(!JSON.stringify(body).includes(doc.pin.hash));
  assert.equal((await h.post('setupPin', { pin: '2468' })).status, 400);
});
test('wrong PIN never applies discount and fifth failed attempt locks subsequent attempts', async () => {
  const h = harness(); await h.post('setupPin', { pin: '1234' });
  const opened = await (await h.post('openOrder', { tableId: 'table-1' })).json(); const orderId = opened.state.orders[0].id;
  for (let i = 0; i < 5; i++) assert.equal((await h.post('discount', { orderId, percent: 50, pin: '9999' })).status, 403);
  assert.equal((await h.post('discount', { orderId, percent: 50, pin: '1234' })).status, 429);
  assert.equal((await (await h.api.GET()).json()).state.orders[0].discountPercent, 0);
});
test('PIN change requires old PIN; old credential stops authorizing', async () => {
  const h = harness(); await h.post('setupPin', { pin: '1234' });
  assert.equal((await h.post('changePin', { oldPin: '1234', newPin: '5678' })).status, 200);
  assert.equal((await h.post('changePin', { oldPin: '1234', newPin: '9999' })).status, 403);
  assert.equal((await h.post('changePin', { oldPin: '5678', newPin: '9999' })).status, 200);
});
test('request retry is idempotent even with stale original version', async () => {
  const h = harness(); const requestId = webcrypto.randomUUID();
  const first = await (await h.post('openOrder', { tableId: 'table-1' }, 0, requestId)).json();
  const retry = await (await h.post('openOrder', { tableId: 'table-1' }, 0, requestId)).json();
  assert.deepEqual(retry, first); assert.equal(retry.state.orders.length, 1);
});
test('stale writes and concurrent version collisions never overwrite saved state', async () => {
  const h = harness(); await h.api.GET();
  const responses = await Promise.all([h.post('openOrder', { tableId: 'table-1' }, 0), h.post('openOrder', { tableId: 'table-2' }, 0)]);
  assert.deepEqual(responses.map(r => r.status).sort(), [200, 409]);
  assert.equal((await (await h.api.GET()).json()).state.orders.length, 1);
  assert.equal((await h.post('openOrder', { tableId: 'table-3' }, 0)).status, 409);
});
test('malformed action payload fails without committing document', async () => {
  const h = harness(); await h.api.GET(); const before = structuredClone(h.rows.get('cashier-A'));
  assert.equal((await h.post('saveProduct', { name: 'X', category: 'Y', price: -1, departmentIds: ['kitchen'], active: true })).status, 400);
  assert.deepEqual(h.rows.get('cashier-A'), before);
});
test('full route flow routes three tickets, retries safely, prints without payment duplication, mixes payments', async () => {
  const h = harness();
  let body = await (await h.post('saveProduct', { id: 'multi', name: 'სამმაგი', category: 'კერძები', price: 1000, departmentIds: ['kitchen', 'bar', 'pastry'], active: true })).json();
  body = await (await h.post('openOrder', { tableId: 'table-1' })).json(); const orderId = body.state.orders[0].id;
  await h.post('addItem', { orderId, productId: 'multi', quantity: 2, note: 'უშაქროდ' });
  body = await (await h.post('sendOrder', { orderId })).json();
  assert.equal(body.state.tickets.length, 3); assert.equal(domain.orderTotals(body.state.orders[0]).total, 2000);
  body = await (await h.post('sendOrder', { orderId })).json(); assert.equal(body.state.tickets.length, 3);
  const ticketId = body.state.tickets[0].id; await h.post('printTicket', { ticketId });
  body = await (await h.post('printTicket', { ticketId })).json(); assert.equal(body.state.tickets[0].printCount, 2);
  body = await (await h.post('pay', { orderId, method: 'cash', amount: 500 })).json(); assert.equal(domain.orderTotals(body.state.orders[0]).due, 1500);
  body = await (await h.post('pay', { orderId, method: 'card', amount: 1500 })).json();
  assert.equal(body.state.orders[0].status, 'closed'); assert.equal(body.state.orders[0].payments.length, 2);
  assert.equal((await h.post('addItem', { orderId, productId: 'multi', quantity: 1 })).status, 400);
});

test('management writes require manager PIN and archive safely', async () => {
  const h = harness();
  await h.post('setupPin', {pin:'135790'});
  for (const action of ['saveTable','saveZone','saveDepartment','deleteTable','deleteDepartment']) {
    const r = await h.post(action, {});
    assert.equal(r.status,403);
  }
  // Separate harness avoids intentional five-attempt lockout.
  const m = harness(); await m.post('setupPin',{pin:'135790'});
  let r = await m.post('saveDepartment',{name:'ახალი განყოფილება',pin:'135790'});
  assert.equal(r.status,200);
  let state=(await r.json()).state;
  const dep=state.departments.at(-1);
  r=await m.post('deleteDepartment',{id:dep.id,pin:'135790'});
  assert.equal(r.status,200);
  assert.equal((await r.json()).state.departments.find(d=>d.id===dep.id).archived,true);
  r=await m.post('deleteDepartment',{id:'kitchen',pin:'135790'});
  assert.notEqual(r.status,200,'routed products prevent department archive');
  await m.post('openOrder',{tableId:'table-1'});
  assert.notEqual((await m.post('deleteTable',{id:'table-1',pin:'135790'})).status,200);
  state=(await (await m.api.GET()).json()).state;
  await m.post('closeEmptyOrder',{orderId:state.orders[0].id});
  r=await m.post('deleteTable',{id:'table-1',pin:'135790'});
  assert.equal(r.status,200);
  state=(await r.json()).state;
  assert.equal(state.tables.find(t=>t.id==='table-1').archived,true);
  assert.equal(state.orders.length,1,'historical order retained');
  assert.notEqual((await m.post('openOrder',{tableId:'table-1'})).status,200);
});
