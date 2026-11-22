/**
 * `fetch` with the signed-in user's JWT attached, for the views that call the
 * API with fetch rather than the axios client. An expired access token is
 * refreshed once and the request retried, matching the axios interceptor.
 *
 * With no session the call is passed through unchanged, so public pages and
 * test doubles see exactly the arguments they were given.
 */
const API_BASE_URL = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL || '';

let refreshing: Promise<string | null> | null = null;

async function refreshAccessToken(): Promise<string | null> {
  const refresh = localStorage.getItem('dora_refresh_token');
  if (!refresh) return null;
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/api/auth/token/refresh/`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ refresh }),
        });
        if (!res.ok) return null;
        const body = await res.json();
        if (body.access) localStorage.setItem('dora_access_token', body.access);
        if (body.refresh) localStorage.setItem('dora_refresh_token', body.refresh);
        return body.access ?? null;
      } catch {
        return null;
      } finally {
        refreshing = null;
      }
    })();
  }
  return refreshing;
}

function withToken(init: RequestInit | undefined, token: string): RequestInit {
  const headers = new Headers(init?.headers || {});
  if (!headers.has('Authorization')) headers.set('Authorization', `Bearer ${token}`);
  return { ...(init || {}), headers };
}

export async function authFetch(input: string, init?: RequestInit): Promise<Response> {
  const token = localStorage.getItem('dora_access_token');
  if (!token) return init === undefined ? fetch(input) : fetch(input, init);

  const res = await fetch(input, withToken(init, token));
  if (res.status !== 401) return res;

  const fresh = await refreshAccessToken();
  return fresh ? fetch(input, withToken(init, fresh)) : res;
}
