export const BACKEND = 'https://oxier-backend-production.up.railway.app';

export function getToken(): string {
  try {
    const user = JSON.parse(localStorage.getItem('ox_user') || 'null');
    return user?.token || '';
  } catch {
    return '';
  }
}

export function authHeaders(): Record<string, string> {
  const token = getToken();
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function apiFetch(path: string, options: RequestInit = {}): Promise<Response> {
  const token = getToken();
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> || {}),
  };
  if (token) headers['Authorization'] = `Bearer ${token}`;
  return fetch(`${BACKEND}${path}`, { ...options, headers });
}
