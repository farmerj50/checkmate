import { auth, isDemoMode } from './firebase';

const BASE = '/api';

async function getAuthHeaders(): Promise<HeadersInit> {
  const user = auth.currentUser;
  // Real Firebase user: use their ID token
  if (user && !isDemoMode) {
    const token = await user.getIdToken();
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };
  }
  // Demo mode: send the stored demo token (backend accepts it as uid)
  const demoToken = localStorage.getItem('demo_token');
  if (demoToken) {
    return { 'Content-Type': 'application/json', Authorization: `Bearer ${demoToken}` };
  }
  return { 'Content-Type': 'application/json' };
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
  delete: <T>(path: string) => request<T>('DELETE', path),
};
