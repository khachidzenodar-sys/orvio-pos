import 'server-only';
import { config, serviceFetch, serviceJson, ServiceUnavailable } from './config';

export const SESSION_COOKIE = '__Host-orvio_session';
export function sessionCookie(token: string, maxAge: number) {
  return `${SESSION_COOKIE}=${encodeURIComponent(token)}; Path=/; HttpOnly; Secure; SameSite=Lax; Max-Age=${maxAge}`;
}

// Identity comes only from Supabase's remote token verification. Never trust
// a browser-supplied user id, ChatGPT header, or decoded JWT claims alone.
export async function getUser(request: Request): Promise<{ userId: string } | null> {
  const { url, anonKey, allowedEmails } = config();
  const cookies = (request.headers.get('cookie') ?? '').split(';');
  const matches = cookies.map(c => c.trim()).filter(c => c.startsWith(`${SESSION_COOKIE}=`));
  if (matches.length !== 1) return null;
  let token: string;
  try { token = decodeURIComponent(matches[0].slice(SESSION_COOKIE.length + 1)); } catch { return null; }
  if (!token || token.length > 12000 || /[\r\n]/.test(token)) return null;
  const result = await serviceFetch(`${url}/auth/v1/user`, { headers: { apikey: anonKey, Authorization: `Bearer ${token}` } });
  if ([400, 401, 403].includes(result.status)) return null;
  if (!result.ok) throw new ServiceUnavailable();
  const user = await serviceJson(result);
  if (typeof user?.id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(user.id)) throw new ServiceUnavailable();
  if (typeof user.email !== 'string' || !user.email_confirmed_at || !allowedEmails.includes(user.email.toLowerCase())) return null;
  return { userId: user.id };
}
