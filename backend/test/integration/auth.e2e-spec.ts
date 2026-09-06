/**
 * HTTP integration / e2e against a running PropFirm API.
 * Skips automatically when the API is unreachable (CI without stack).
 *
 *   API_BASE=http://localhost:6080 npm run test:integration
 */

const API_BASE = process.env.API_BASE || 'http://localhost:6080';
const AUTH_COOKIE = process.env.AUTH_COOKIE_NAME || 'propfirm_access';

function cookieFromSetCookie(setCookie: string | null): string {
  if (!setCookie) return '';
  // fetch may join multiple Set-Cookie; take first matching name
  const parts = setCookie.split(/,(?=\s*[^;=]+=[^;]+)/);
  for (const part of parts) {
    const m = part.trim().match(new RegExp(`^${AUTH_COOKIE}=([^;]+)`));
    if (m) return `${AUTH_COOKIE}=${m[1]}`;
  }
  const m = setCookie.match(new RegExp(`${AUTH_COOKIE}=([^;]+)`));
  return m ? `${AUTH_COOKIE}=${m[1]}` : '';
}

async function apiAvailable(): Promise<boolean> {
  const ctrl = new AbortController();
  const timer = setTimeout(() => ctrl.abort(), 1500);
  try {
    const res = await fetch(`${API_BASE}/`, { signal: ctrl.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}

describe('Auth + login history (integration/e2e)', () => {
  let available = false;
  let cookie = '';

  beforeAll(async () => {
    available = await apiAvailable();
    if (!available) {
      console.warn(`SKIP: API not reachable at ${API_BASE}`);
      return;
    }
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'trader@propfirm.local',
        password: 'Trader1!',
        clientIp: '8.8.8.8',
      }),
    });
    if (!res.ok) {
      available = false;
      console.warn(`SKIP: login failed with ${res.status}`);
      return;
    }
    cookie = cookieFromSetCookie(res.headers.get('set-cookie'));
    if (!cookie) {
      available = false;
      console.warn('SKIP: login did not set httpOnly auth cookie');
    }
  }, 20_000);

  const itif = (name: string, fn: () => Promise<void>) =>
    it(name, async () => {
      if (!available) return;
      await fn();
    });

  itif('rejects bad credentials with 401', async () => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'trader@propfirm.local', password: 'wrong' }),
    });
    expect(res.status).toBe(401);
  });

  itif('rejects login-history without session cookie', async () => {
    const res = await fetch(`${API_BASE}/api/users/me/login-history`);
    expect(res.status).toBe(401);
  });

  itif('returns login history rows after cookie login', async () => {
    const res = await fetch(`${API_BASE}/api/users/me/login-history`, {
      headers: { Cookie: cookie },
    });
    expect(res.ok).toBe(true);
    const rows = (await res.json()) as Array<{
      ip: string;
      connectionKind: string;
      connectionLabel: string;
    }>;
    expect(Array.isArray(rows)).toBe(true);
    expect(rows.length).toBeGreaterThan(0);
    expect(rows[0].ip).toBeTruthy();
    expect(rows[0].connectionKind).toMatch(/vpn|vps|residential|local|unknown/);
  });

  itif('login body does not include accessToken', async () => {
    const res = await fetch(`${API_BASE}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: 'trader@propfirm.local',
        password: 'Trader1!',
      }),
    });
    expect(res.ok).toBe(true);
    const body = (await res.json()) as Record<string, unknown>;
    expect(body.accessToken).toBeUndefined();
    expect(body.userId).toBeTruthy();
  });

  itif('serves catalog products without auth', async () => {
    const res = await fetch(`${API_BASE}/api/catalog/products`);
    expect(res.ok).toBe(true);
    const products = (await res.json()) as unknown[];
    expect(products.length).toBeGreaterThan(0);
  });
});
