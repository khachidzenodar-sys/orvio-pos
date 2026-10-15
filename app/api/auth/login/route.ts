import { config, json, sameOrigin, serviceFetch, serviceJson, ServiceUnavailable } from '@/lib/server/config';
import { sessionCookie } from '@/lib/server/auth';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'დაუშვებელი წყარო' }, 403);
  try {
    const { url, anonKey, allowedEmails } = config();
    const body = await request.json();
    if (typeof body?.email !== 'string' || typeof body?.password !== 'string' || body.email.length > 320 || body.password.length > 1024 || !body.email.trim() || !body.password) return json({ error: 'შეიყვანეთ ელფოსტა და პაროლი' }, 400);
    const result = await serviceFetch(`${url}/auth/v1/token?grant_type=password`, {
      method: 'POST', headers: { apikey: anonKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: body.email.trim(), password: body.password }),
    });
    if (result.status === 429) return json({ error: 'ძალიან ბევრი მცდელობაა. მოგვიანებით სცადეთ.' }, 429);
    if (!result.ok) {
      if (result.status >= 500) throw new ServiceUnavailable();
      return json({ error: 'ელფოსტა ან პაროლი არასწორია' }, 401);
    }
    const session = await serviceJson(result);
    if (typeof session.access_token !== 'string' || !session.access_token || session.access_token.length > 12000 || !Number.isSafeInteger(session.expires_in) || session.expires_in <= 0) throw new ServiceUnavailable();
    if (typeof session.user?.email !== 'string' || !session.user.email_confirmed_at || !allowedEmails.includes(session.user.email.toLowerCase())) return json({ error: 'ელფოსტა ან პაროლი არასწორია' }, 401);
    // Refresh tokens deliberately never leave this handler or get persisted.
    return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie(session.access_token, Math.min(session.expires_in, 86400)) });
  } catch (error) {
    return json({ error: error instanceof ServiceUnavailable ? error.message : 'შესვლა ვერ მოხერხდა' }, error instanceof SyntaxError ? 400 : 503);
  }
}
