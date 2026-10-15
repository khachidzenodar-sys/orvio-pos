import 'server-only';
import { config, serviceFetch, serviceJson, ServiceUnavailable } from './config';

export type StoreRow = { version: number; document: string };

function headers() {
  const { serviceKey } = config();
  return { apikey: serviceKey, Authorization: `Bearer ${serviceKey}`, 'Content-Type': 'application/json' };
}

export async function readStore(userId: string, initialDocument: string): Promise<StoreRow> {
  const { url } = config();
  const insert = await serviceFetch(`${url}/rest/v1/pos_store?on_conflict=id`, {
    method: 'POST', headers: { ...headers(), Prefer: 'resolution=ignore-duplicates,return=minimal' },
    body: JSON.stringify({ id: userId, version: 0, document: initialDocument }),
  });
  if (!insert.ok) throw new ServiceUnavailable();
  const result = await serviceFetch(`${url}/rest/v1/pos_store?id=eq.${encodeURIComponent(userId)}&select=version,document`, { headers: headers() });
  if (!result.ok) throw new ServiceUnavailable();
  const rows = await serviceJson(result);
  if (!Array.isArray(rows) || rows.length !== 1 || !Number.isSafeInteger(rows[0].version) || typeof rows[0].document !== 'string') throw new ServiceUnavailable();
  return rows[0];
}

export async function saveStore(userId: string, version: number, document: string): Promise<boolean> {
  const { url } = config();
  if (!Number.isSafeInteger(version) || version < 0 || !Number.isSafeInteger(version + 1)) throw new ServiceUnavailable();
  // One conditional SQL UPDATE in PostgREST: only the client holding the
  // current version may write. Zero returned rows means a concurrent change.
  const result = await serviceFetch(`${url}/rest/v1/pos_store?id=eq.${encodeURIComponent(userId)}&version=eq.${version}&select=version`, {
    method: 'PATCH', headers: { ...headers(), Prefer: 'return=representation' },
    body: JSON.stringify({ version: version + 1, document }),
  });
  if (!result.ok) throw new ServiceUnavailable();
  const rows = await serviceJson(result);
  if (!Array.isArray(rows) || rows.length > 1) throw new ServiceUnavailable();
  return rows.length === 1;
}
