import { env } from 'cloudflare:workers';
import { getChatGPTUser } from '@/app/chatgpt-auth';
import { applyAction, seedState, type PosState } from '@/lib/pos';
type Secret = {
    salt: string;
    hash: string;
};
type Document = {
    state: PosState;
    pin?: Secret;
    failures: number;
    blockedUntil: number;
    requests: string[];
};
type Row = {
    version: number;
    document: string;
};
const json = (data: unknown, status = 200) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store' } });
function hex(bytes: Uint8Array) { return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join(''); }
async function hash(pin: string, salt: string) { const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(pin), 'PBKDF2', false, ['deriveBits']); return hex(new Uint8Array(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: new TextEncoder().encode(salt), iterations: 100000, hash: 'SHA-256' }, key, 256))); }
async function secret(pin: unknown) { if (typeof pin !== 'string' || !/^\d{4,12}$/.test(pin))
    throw new Error('კოდი უნდა შეიცავდეს 4–12 ციფრს'); const salt = hex(crypto.getRandomValues(new Uint8Array(16))); return { salt, hash: await hash(pin, salt) }; }
async function matches(pin: unknown, stored?: Secret) { if (typeof pin !== 'string' || !stored || pin.length > 12)
    return false; const result = await hash(pin, stored.salt); let mismatch = 0; for (let i = 0; i < result.length; i++)
    mismatch |= result.charCodeAt(i) ^ stored.hash.charCodeAt(i); return mismatch === 0; }
function database() { if (!env.DB)
    throw new Error('მონაცემთა ბაზა მიუწვდომელია'); return env.DB; }
async function read(key: string): Promise<Row> { await database().prepare('INSERT OR IGNORE INTO pos_store (id,version,document) VALUES (?,0,?)').bind(key, JSON.stringify({ state: seedState(), failures: 0, blockedUntil: 0, requests: [] })).run(); const row = await database().prepare('SELECT version, document FROM pos_store WHERE id=?').bind(key).first<Row>(); if (!row)
    throw new Error('მონაცემები მიუწვდომელია'); return row; }
async function save(key: string, version: number, doc: Document) { const result = await database().prepare('UPDATE pos_store SET document=?,version=version+1 WHERE id=? AND version=?').bind(JSON.stringify(doc), key, version).run(); return result.meta.changes === 1; }
const response = (doc: Document, version: number) => json({ state: doc.state, version, configured: !!doc.pin });
export async function GET() { try {
    const user = await getChatGPTUser();
    if (!user)
        return json({ error: 'ავტორიზაცია აუცილებელია' }, 401);
    const row = await read(user.userId);
    return response(JSON.parse(row.document), row.version);
}
catch {
    return json({ error: 'მონაცემთა ბაზასთან დაკავშირება ვერ მოხერხდა' }, 503);
} }
export async function POST(request: Request) {
    try {
        const user = await getChatGPTUser();
        if (!user)
            return json({ error: 'ავტორიზაცია აუცილებელია' }, 401);
        const origin = request.headers.get('origin');
        if (origin && origin !== new URL(request.url).origin)
            return json({ error: 'დაუშვებელი წყარო' }, 403);
        const body = await request.json() as {
            action: string;
            payload: Record<string, unknown>;
            requestId: string;
            version: number;
        };
        if (!body || typeof body.action !== 'string' || !body.payload || typeof body.payload !== 'object' || Array.isArray(body.payload) || typeof body.requestId !== 'string' || body.requestId.length < 8 || body.requestId.length > 100 || !Number.isSafeInteger(body.version))
            return json({ error: 'მოთხოვნა არასწორია' }, 400);
        const row = await read(user.userId);
        const doc: Document = JSON.parse(row.document);
        if (doc.requests.includes(body.requestId))
            return response(doc, row.version);
        if (row.version !== body.version)
            return json({ error: 'მონაცემები შეიცვალა. განაახლეთ და სცადეთ ხელახლა.' }, 409);
        const { action, payload } = body;
        let manager = false;
        if (['discount', 'voidItem', 'changePin', 'saveTable', 'saveZone', 'saveDepartment', 'deleteTable', 'deleteDepartment'].includes(action)) {
            if (!doc.pin)
                return json({ error: 'ჯერ დააყენეთ მენეჯერის კოდი' }, 403);
            if (doc.blockedUntil > Date.now())
                return json({ error: 'კოდი დროებით დაბლოკილია. სცადეთ 5 წუთში.' }, 429);
            manager = await matches(action === 'changePin' ? payload.oldPin : payload.pin, doc.pin);
            if (!manager) {
                doc.failures++;
                if (doc.failures >= 5) {
                    doc.blockedUntil = Date.now() + 300000;
                    doc.failures = 0;
                }
                if (!await save(user.userId, row.version, doc))
                    return json({ error: 'მონაცემები შეიცვალა. განაახლეთ გვერდი.' }, 409);
                return json({ error: 'მენეჯერის კოდი არასწორია', version: row.version + 1 }, 403);
            }
            doc.failures = 0;
            doc.blockedUntil = 0;
        }
        if (action === 'setupPin') {
            if (doc.pin)
                return json({ error: 'კოდი უკვე დაყენებულია' }, 400);
            doc.pin = await secret(payload.pin);
        }
        else if (action === 'changePin') {
            doc.pin = await secret(payload.newPin);
        }
        else
            doc.state = applyAction(doc.state, action, payload, manager);
        doc.requests.push(body.requestId);
        if (!await save(user.userId, row.version, doc))
            return json({ error: 'მონაცემები შეიცვალა. განაახლეთ და სცადეთ ხელახლა.' }, 409);
        return response(doc, row.version + 1);
    }
    catch (error) {
        return json({ error: error instanceof Error ? error.message : 'შეცდომა მოთხოვნის დამუშავებისას' }, 400);
    }
}
