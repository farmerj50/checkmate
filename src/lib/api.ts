import { auth, isDemoMode } from './firebase';

const BASE = (import.meta.env.VITE_API_URL as string | undefined) ?? '/api';

export async function getAccessToken(): Promise<string | null> {
  if (!isDemoMode) return auth.currentUser ? auth.currentUser.getIdToken() : null;
  return localStorage.getItem('demo_token');
}

async function getAuthHeaders(): Promise<HeadersInit> {
  const token = await getAccessToken();
  return { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) };
}

async function request<T>(
  method: string,
  path: string,
  body?: unknown
): Promise<T> {
  const headers = await getAuthHeaders();
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : {};
  if (!res.ok) {
    const err = Object.assign(
      new Error(data.error ?? `Request failed (${res.status})`),
      { status: res.status, ...data }
    );
    throw err;
  }
  return data as T;
}

export const api = {
  get: <T>(path: string) => request<T>('GET', path),
  post: <T>(path: string, body: unknown) => request<T>('POST', path, body),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  // body is optional — DELETE /social/posts/:id/reactions needs one (which
  // emoji to remove); every existing DELETE call site keeps working unchanged.
  delete: <T>(path: string, body?: unknown) => request<T>('DELETE', path, body),
};
