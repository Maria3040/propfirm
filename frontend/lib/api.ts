import { store } from '@/store';
import { clearUser, setUser } from '@/store/authSlice';

/**
 * Same-origin by default (Next rewrites → Nest) so httpOnly cookies stay first-party.
 * Override with NEXT_PUBLIC_API_BASE only for direct cross-origin debugging.
 * Never use :5080 — PropFirm API is :6080.
 */
function resolveApiBase(): string {
  const raw = (process.env.NEXT_PUBLIC_API_BASE || '').trim();
  if (!raw) return '';
  if (/:5080\b/.test(raw)) {
    console.warn(
      `[propfirm] Ignoring NEXT_PUBLIC_API_BASE=${raw} (wrong port). Using same-origin rewrites → :6080.`,
    );
    return '';
  }
  return raw.replace(/\/$/, '');
}

const API = resolveApiBase();

export type AuthSession = {
  userId: string;
  email: string;
  displayName: string;
  role: string;
};

/** @deprecated Token is httpOnly — always null on the client. */
export function getToken(): string | null {
  return null;
}

export function saveSession(s: AuthSession) {
  store.dispatch(
    setUser({
      userId: s.userId,
      email: s.email,
      displayName: s.displayName,
      role: s.role,
    }),
  );
}

export function clearSession() {
  store.dispatch(clearUser());
}

export function getSession(): AuthSession | null {
  const user = store.getState().auth.user;
  if (!user) return null;
  return {
    userId: user.userId,
    email: user.email,
    displayName: user.displayName,
    role: user.role,
  };
}

export async function logoutSession() {
  try {
    await api('/api/auth/logout', { method: 'POST', auth: false });
  } catch {
    /* still clear client state */
  }
  clearSession();
}

export async function api<T>(
  path: string,
  opts: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string>),
  };
  // JWT is sent automatically via httpOnly cookie (credentials: 'include').
  void opts.auth;

  let res: Response;
  try {
    res = await fetch(`${API}${path}`, {
      ...opts,
      headers,
      credentials: 'include',
    });
  } catch {
    const base = API || '(same-origin via Next rewrite)';
    throw new Error(
      `Failed to reach API at ${base}${path}. Ensure Nest is on :6080 and open http://localhost:3100.`,
    );
  }
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
