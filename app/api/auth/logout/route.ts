import { json, sameOrigin } from '@/lib/server/config';
import { sessionCookie } from '@/lib/server/auth';

export const runtime = 'nodejs';
export async function POST(request: Request) {
  if (!sameOrigin(request)) return json({ error: 'დაუშვებელი წყარო' }, 403);
  return json({ ok: true }, 200, { 'Set-Cookie': sessionCookie('', 0) });
}
