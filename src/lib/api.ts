// ============================================================
// API-клиент — тонкая обёртка над fetch
// Все хуки используют эти функции для единообразной обработки
// ошибок, токенов и парсинга ответов.
// ============================================================

import type { ApiResponse } from './types';

// ── Errors ────────────────────────────────────────────────

export class ApiError extends Error {
  constructor(
    message: string,
    public status: number,
    public code?: string,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

// ── Token helpers ─────────────────────────────────────────

export function getAuthToken(): string | null {
  if (typeof window === 'undefined') return null;
  const token = localStorage.getItem('token');
  if (!token) return null;
  // Guests may have a token but should be excluded for protected actions
  return token;
}

export function isGuest(): boolean {
  if (typeof window === 'undefined') return false;
  const user = JSON.parse(localStorage.getItem('user') || '{}');
  return user.isGuest === true;
}

export function isAuthenticated(): boolean {
  return !!getAuthToken();
}

// ── Core fetch wrapper ────────────────────────────────────

interface FetchOptions extends Omit<RequestInit, 'body'> {
  body?: unknown;
  params?: Record<string, string | number | boolean | undefined>;
}

export async function apiFetch<T>(path: string, opts: FetchOptions = {}): Promise<T> {
  const { body, params, headers, ...rest } = opts;

  // Build URL with query params
  const url = new URL(path, typeof window !== 'undefined' ? window.location.origin : 'http://localhost:3000');
  if (params) {
    Object.entries(params).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        url.searchParams.set(key, String(value));
      }
    });
  }

  // Auth header
  const token = getAuthToken();
  const requestHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    ...headers as Record<string, string>,
  };
  if (token) {
    requestHeaders['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url.toString(), {
    ...rest,
    headers: requestHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });

  // Parse JSON
  let json: ApiResponse<T>;
  try {
    json = await response.json();
  } catch {
    throw new ApiError(`Invalid JSON response (${response.status})`, response.status);
  }

  if (!response.ok || !json.success) {
    throw new ApiError(
      json.error || `Request failed with status ${response.status}`,
      response.status,
    );
  }

  return json.data as T;
}

// ── HTTP method shorthands ─────────────────────────────────

export function apiGet<T>(path: string, params?: FetchOptions['params']): Promise<T> {
  return apiFetch<T>(path, { method: 'GET', params });
}

export function apiPost<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, { method: 'POST', body });
}

export function apiPut<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, { method: 'PUT', body });
}

export function apiDelete<T>(path: string, body?: unknown): Promise<T> {
  return apiFetch<T>(path, { method: 'DELETE', body });
}
