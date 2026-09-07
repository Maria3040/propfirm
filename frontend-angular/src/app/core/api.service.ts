import { Injectable } from '@angular/core';

/** Same-origin via Angular proxy → :6080 so httpOnly cookies stay first-party. */
const API = '';

@Injectable({ providedIn: 'root' })
export class ApiService {
  async request<T>(
    path: string,
    opts: RequestInit & { auth?: boolean } = {},
  ): Promise<T> {
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      ...(opts.headers as Record<string, string>),
    };
    void opts.auth;

    let res: Response;
    try {
      res = await fetch(`${API}${path}`, {
        ...opts,
        headers,
        credentials: 'include',
      });
    } catch (e) {
      if (e instanceof DOMException && e.name === 'AbortError') throw e;
      throw new Error(
        `Failed to reach API at ${API || '(same-origin via proxy)'}${path}. Ensure the PropFirm API is on :6080 and open http://localhost:3200.`,
      );
    }

    if (!res.ok) {
      const text = await res.text();
      let message = text || res.statusText || `HTTP ${res.status}`;
      try {
        const j = JSON.parse(text) as
          | { detail?: unknown; title?: unknown; message?: unknown }
          | string;
        if (typeof j === 'string' && j.trim()) message = j;
        else if (j && typeof j === 'object') {
          if (typeof j.detail === 'string') message = j.detail;
          else if (Array.isArray(j.detail)) {
            message = j.detail
              .map((d) =>
                typeof d === 'object' && d && 'msg' in d
                  ? String((d as { msg: string }).msg)
                  : String(d),
              )
              .join('; ');
          } else if (typeof j.message === 'string') message = j.message;
          else if (typeof j.title === 'string') message = j.title;
        }
      } catch {
        /* keep raw */
      }
      if (res.status === 404 && (!message || /^not\s*found$/i.test(message.trim()))) {
        message = `Not found: ${path} — this API route is missing or the backend needs a restart.`;
      } else if (res.status >= 500 && (!message || message === res.statusText)) {
        message = `Server error (${res.status}) on ${path}`;
      }
      throw new Error(message);
    }

    if (res.status === 204) return undefined as T;
    return res.json() as Promise<T>;
  }
}
