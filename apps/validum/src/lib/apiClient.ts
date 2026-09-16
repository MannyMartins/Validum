const API_URL = (import.meta.env.VITE_API_URL || '').trim().replace(/\/$/, '');
const TOKEN_KEY = 'validum-api-token';
export const API_SESSION_EXPIRED_EVENT = 'validum:api-session-expired';

export interface ApiUser {
  id: string;
  email: string;
  fullName: string;
  role: string;
  organizationId: string;
  organizationName: string;
}

export interface WorkspaceSnapshot {
  companies: unknown[];
  employees: unknown[];
  templates: unknown[];
  generatedForms: unknown[];
  stampPresets: unknown[];
  affiliationDrafts: unknown[];
  activeCompanyId?: string | null;
}

export function isApiConfigured(): boolean { return /^https?:\/\//.test(API_URL); }
function getApiToken(): string | null { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY); }
export function hasApiSession(): boolean { return Boolean(getApiToken()); }
export function clearApiSession(): void {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}
export function expireApiSession(): void {
  clearApiSession();
  window.dispatchEvent(new CustomEvent(API_SESSION_EXPIRED_EVENT));
}
export function requireApiSession(): void {
  if (hasApiSession()) return;
  expireApiSession();
  throw new Error('Tu sesión venció. Inicia sesión nuevamente; el borrador está protegido.');
}

export async function apiRequest<T>(path: string, init: RequestInit = {}, authenticated = true): Promise<T> {
  if (!isApiConfigured()) throw new Error('VITE_API_URL no está configurada.');
  const headers = new Headers(init.headers);
  if (!headers.has('Content-Type') && init.body) headers.set('Content-Type', 'application/json');
  if (authenticated) {
    const token = getApiToken();
    if (!token) {
      expireApiSession();
      throw new Error('Tu sesión venció. Inicia sesión nuevamente; el borrador está protegido.');
    }
    headers.set('Authorization', `Bearer ${token}`);
  }
  const response = await fetch(`${API_URL}${path}`, { ...init, headers });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    if (response.status === 401 && authenticated) expireApiSession();
    const message = Array.isArray(payload?.message) ? payload.message.join(' ') : payload?.message;
    throw new Error(message || `El API respondió con estado ${response.status}.`);
  }
  return payload as T;
}

export async function loginApi(email: string, password: string, remember = true): Promise<ApiUser> {
  const result = await apiRequest<{ accessToken: string; user: ApiUser }>('/auth/login', {
    method: 'POST', body: JSON.stringify({ email, password, remember }),
  }, false);
  clearApiSession();
  (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, result.accessToken);
  return result.user;
}
export function currentApiUser(): Promise<ApiUser> { return apiRequest<ApiUser>('/auth/me'); }
export function requestApiPasswordReset(email: string): Promise<{ success: boolean }> {
  return apiRequest('/auth/password-reset', { method: 'POST', body: JSON.stringify({ email }) }, false);
}
export async function completeApiPasswordSetup(token: string, password: string): Promise<ApiUser> {
  const result = await apiRequest<{ accessToken: string; user: ApiUser }>('/auth/password-setup', {
    method: 'POST', body: JSON.stringify({ token, password }),
  }, false);
  localStorage.setItem(TOKEN_KEY, result.accessToken);
  return result.user;
}
export function loadApiWorkspace(): Promise<WorkspaceSnapshot> { return apiRequest('/workspace'); }
export function replaceApiCollection(collection: 'companies' | 'employees', items: unknown[]): Promise<void> {
  return apiRequest(`/workspace/${collection}`, { method: 'PUT', body: JSON.stringify({ items }) });
}
export function setApiActiveCompany(activeCompanyId: string | null): Promise<void> {
  return apiRequest('/workspace/active-company', { method: 'PUT', body: JSON.stringify({ activeCompanyId }) });
}
export function saveApiAffiliationFolio(company: unknown, employee: unknown): Promise<void> {
  return apiRequest('/workspace/affiliation-folios', {
    method: 'POST', body: JSON.stringify({ company, employee }),
  });
}
export function loadApiAffiliationDrafts<T>(): Promise<T[]> {
  return apiRequest('/workspace/affiliation-drafts');
}
export function saveApiAffiliationDraft(id: string, record: Record<string, unknown>): Promise<void> {
  return apiRequest(`/workspace/affiliation-drafts/${encodeURIComponent(id)}`, {
    method: 'PUT', body: JSON.stringify({ record }),
  });
}
export function removeApiAffiliationDraft(id: string): Promise<void> {
  return apiRequest(`/workspace/affiliation-drafts/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
export function saveApiRecord(collection: 'templates' | 'generatedForms' | 'stampPresets', record: Record<string, unknown>): Promise<void> {
  return apiRequest(`/workspace/records/${collection}/${encodeURIComponent(String(record.id))}`, { method: 'PUT', body: JSON.stringify({ record }) });
}
export function removeApiRecord(collection: 'templates' | 'generatedForms' | 'stampPresets', id: string): Promise<void> {
  return apiRequest(`/workspace/records/${collection}/${encodeURIComponent(id)}`, { method: 'DELETE' });
}
