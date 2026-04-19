const API_BASE = '/api';

interface FetchOptions extends RequestInit {
  skipAuth?: boolean;
}

function getToken(): string | null {
  return localStorage.getItem('schedulord_token');
}

export function setToken(token: string) {
  localStorage.setItem('schedulord_token', token);
}

export function clearToken() {
  localStorage.removeItem('schedulord_token');
}

export function getStoredUser() {
  const raw = localStorage.getItem('schedulord_user');
  return raw ? JSON.parse(raw) : null;
}

export function setStoredUser(user: any) {
  localStorage.setItem('schedulord_user', JSON.stringify(user));
}

async function apiFetch(path: string, options: FetchOptions = {}) {
  const { skipAuth, ...fetchOpts } = options;
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(fetchOpts.headers as Record<string, string> || {}),
  };

  if (!skipAuth) {
    const token = getToken();
    if (token) headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${API_BASE}${path}`, { ...fetchOpts, headers });

  if (res.status === 401) {
    clearToken();
    window.location.href = '/';
    throw new Error('Unauthorized');
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body?.error?.message || `API Error (${res.status})`);
  }

  if (res.status === 204) return null;
  return res.json();
}

// Flat Exports (For easier component imports)
export const loginUser = (email: string, password: string) =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }), skipAuth: true });

// Structured Exports
export const authApi = {
  login: loginUser,
  register: (name: string, email: string, password: string, role?: string) =>
    apiFetch('/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, role }), skipAuth: true }),
};

export const resourcesApi = {
  list: () => apiFetch('/resources'),
  get: (id: string) => apiFetch(`/resources/${id}`),
  create: (data: any) => apiFetch('/resources', { method: 'POST', body: JSON.stringify(data) }),
  update: (id: string, data: any) => apiFetch(`/resources/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
  delete: (id: string) => apiFetch(`/resources/${id}`),
};

export const requestsApi = {
  list: () => apiFetch('/requests'),
  get: (id: string) => apiFetch(`/requests/${id}`),
  create: (data: any) => apiFetch('/requests', { method: 'POST', body: JSON.stringify(data) }),
  cancel: (id: string) => apiFetch(`/requests/${id}/cancel`, { method: 'POST' }),
  allocateNow: (id: string) => apiFetch(`/requests/${id}/allocate`, { method: 'POST' }),
};

export const analyticsApi = {
  dashboard: () => apiFetch('/analytics/dashboard'),
  utilization: () => apiFetch('/analytics/utilization'),
  demandTrends: () => apiFetch('/analytics/demand-trends'),
  allocations: () => apiFetch('/analytics/allocations'),
  events: (limit = 50) => apiFetch(`/analytics/events?limit=${limit}`),
  predict: (resourceType = 'all') => apiFetch(`/analytics/predict?resourceType=${resourceType}`),
  simulate: (resourceType = 'all') => apiFetch(`/analytics/simulate?resourceType=${resourceType}`),
};

export const usersApi = {
  me: () => apiFetch('/users/me'),
  list: () => apiFetch('/users'),
};
