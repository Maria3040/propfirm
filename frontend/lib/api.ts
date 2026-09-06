const API = process.env.NEXT_PUBLIC_API_BASE || 'http://localhost:6080';

export type AuthSession = {
  userId: string;
  email: string;
  displayName: string;
  role: string;
  accessToken: string;
};

export function getToken(): string | null {
  if (typeof window === 'undefined') return null;
  return localStorage.getItem('propfirm_token');
}

export function saveSession(s: AuthSession) {
  localStorage.setItem('propfirm_token', s.accessToken);
  localStorage.setItem('propfirm_session', JSON.stringify(s));
}

export function clearSession() {
  localStorage.removeItem('propfirm_token');
  localStorage.removeItem('propfirm_session');
}

export function getSession(): AuthSession | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('propfirm_session');
  return raw ? JSON.parse(raw) : null;
}

export async function api<T>(
  path: string,
  opts: RequestInit & { auth?: boolean } = {},
): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(opts.headers as Record<string, string>),
  };
  if (opts.auth !== false) {
    const token = getToken();
    if (token) headers.Authorization = `Bearer ${token}`;
  }
  const res = await fetch(`${API}${path}`, { ...opts, headers });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(text || res.statusText);
  }
  if (res.status === 204) return undefined as T;
  return res.json();
}
