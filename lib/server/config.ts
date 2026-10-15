import 'server-only';

export class ServiceUnavailable extends Error {
  constructor() { super('სერვისი დროებით მიუწვდომელია'); }
}

export function config() {
  const url = process.env.SUPABASE_URL;
  const anonKey = process.env.SUPABASE_ANON_KEY;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const allowedEmails = (process.env.ORVIO_ALLOWED_EMAILS ?? '').split(',').map(s => s.trim().toLowerCase()).filter(Boolean);
  if (!url || !anonKey || !serviceKey || !allowedEmails.length) throw new ServiceUnavailable();
  let parsed: URL;
  try { parsed = new URL(url); } catch { throw new ServiceUnavailable(); }
  if (parsed.protocol !== 'https:' || parsed.username || parsed.password || parsed.search || parsed.hash || parsed.pathname !== '/') throw new ServiceUnavailable();
  return { url: parsed.origin, anonKey, serviceKey, allowedEmails };
}

export async function serviceFetch(url: string, options: RequestInit): Promise<Response> {
  try { return await fetch(url, { ...options, cache: 'no-store', signal: AbortSignal.timeout(10000) }); }
  catch { throw new ServiceUnavailable(); }
}

export async function serviceJson(response: Response) {
  try { return await response.json(); } catch { throw new ServiceUnavailable(); }
}

export const json = (data: unknown, status = 200, headers: HeadersInit = {}) => Response.json(data, { status, headers: { 'Cache-Control': 'no-store', ...headers } });

export function sameOrigin(request: Request) {
  return request.headers.get('origin') === new URL(request.url).origin;
}
