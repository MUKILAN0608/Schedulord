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
    const isAnalyticsFallbackPath =
      path.startsWith('/analytics/predict') || path.startsWith('/analytics/simulate');
    const hasFallbackPayload =
      body &&
      typeof body === 'object' &&
      (typeof body.demandSignal === 'number' ||
        typeof body.spikeProbability === 'number' ||
        Array.isArray(body.scenarios));

    // Keep UI responsive when backend returns degraded analytics payloads with non-2xx status.
    if (isAnalyticsFallbackPath && hasFallbackPayload) {
      return body;
    }

    throw new Error(body?.error?.message || `API Error (${res.status})`);
  }

  if (res.status === 204) return null;
  return res.json();
}

// Flat Exports (For easier component imports)
export const loginUser = (email: string, password: string, intendedRole: 'admin' | 'user') =>
    apiFetch('/auth/login', { method: 'POST', body: JSON.stringify({ email, password, intendedRole }), skipAuth: true });

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
  delete: (id: string) => apiFetch(`/resources/${id}`, { method: 'DELETE' }),
};

export const requestsApi = {
  list: () => apiFetch('/requests'),
  listWithParams: (status?: string) => apiFetch(`/requests${status ? `?status=${status}` : ''}`),
  get: (id: string) => apiFetch(`/requests/${id}`),
  create: (data: any) => apiFetch('/requests', { method: 'POST', body: JSON.stringify(data) }),
  cancel: (id: string) => apiFetch(`/requests/${id}/cancel`, { method: 'POST' }),
  allocateNow: (id: string) => apiFetch(`/requests/${id}/allocate`, { method: 'POST' }),
  approve: (id: string) => apiFetch(`/requests/${id}/approve`, { method: 'POST' }),
  reject: (id: string, reason?: string) =>
    apiFetch(`/requests/${id}/reject`, { method: 'POST', body: JSON.stringify({ reason }) }),
  myAdminDecisions: () => apiFetch('/requests/decisions/me'),
  clearAll: () => apiFetch('/requests/clear', { method: 'POST' }),
};

export const analyticsApi = {
  dashboard: () => apiFetch('/analytics/dashboard'),
  utilization: () => apiFetch('/analytics/utilization'),
  demandTrends: () => apiFetch('/analytics/demand-trends'),
  allocations: () => apiFetch('/analytics/allocations'),
  events: (limit = 50) => apiFetch(`/analytics/events?limit=${limit}`),
  // Add cache-busting timestamp so prediction/simulation always fetch fresh AI output.
  predict: (resourceType = 'all') => apiFetch(`/analytics/predict?resourceType=${resourceType}&_ts=${Date.now()}`),
  simulate: (resourceType = 'all') => apiFetch(`/analytics/simulate?resourceType=${resourceType}&_ts=${Date.now()}`),
};

export const usersApi = {
  me: () => apiFetch('/users/me'),
  admins: () => apiFetch('/users/admins'),
  list: () => apiFetch('/users'),
  create: (email: string, password: string, role: 'admin' | 'user' = 'admin', name?: string) =>
    apiFetch('/users', { method: 'POST', body: JSON.stringify({ email, password, role, name }) }),
  update: (id: string, data: { role?: string; isActive?: boolean }) =>
    apiFetch(`/users/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
};
