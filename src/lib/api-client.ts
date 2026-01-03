/**
 * API client helper with automatic CSRF token injection.
 * Use this for all state-changing API requests from client components.
 */

import { CSRF_CONFIG } from './csrf';

/**
 * Get CSRF token from cookie.
 * Returns null if not in browser or cookie not set.
 */
function getCsrfToken(): string | null {
  if (typeof document === 'undefined') {
    return null;
  }
  const match = document.cookie.match(
    new RegExp(`(?:^|; )${CSRF_CONFIG.cookieName}=([^;]*)`)
  );
  return match ? decodeURIComponent(match[1]) : null;
}

/**
 * Methods that require CSRF token.
 */
const CSRF_METHODS = ['POST', 'PUT', 'DELETE', 'PATCH'];

/**
 * Make an API request with automatic CSRF token injection.
 * @param url - API endpoint URL
 * @param options - Fetch options
 * @returns Fetch response
 */
export async function apiRequest(
  url: string,
  options: RequestInit = {}
): Promise<Response> {
  const headers = new Headers(options.headers);

  // Set Content-Type for JSON if body is provided and not already set
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  // Add CSRF token for state-changing methods
  const method = (options.method || 'GET').toUpperCase();
  if (CSRF_METHODS.includes(method)) {
    const csrfToken = getCsrfToken();
    if (csrfToken) {
      headers.set(CSRF_CONFIG.headerName, csrfToken);
    }
  }

  return fetch(url, {
    ...options,
    headers,
  });
}

/**
 * Make a GET request.
 */
export async function apiGet(
  url: string,
  options: Omit<RequestInit, 'method' | 'body'> = {}
): Promise<Response> {
  return apiRequest(url, { ...options, method: 'GET' });
}

/**
 * Make a POST request with JSON body.
 */
export async function apiPost<T = unknown>(
  url: string,
  data?: T,
  options: Omit<RequestInit, 'method' | 'body'> = {}
): Promise<Response> {
  return apiRequest(url, {
    ...options,
    method: 'POST',
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
}

/**
 * Make a PUT request with JSON body.
 */
export async function apiPut<T = unknown>(
  url: string,
  data?: T,
  options: Omit<RequestInit, 'method' | 'body'> = {}
): Promise<Response> {
  return apiRequest(url, {
    ...options,
    method: 'PUT',
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
}

/**
 * Make a PATCH request with JSON body.
 */
export async function apiPatch<T = unknown>(
  url: string,
  data?: T,
  options: Omit<RequestInit, 'method' | 'body'> = {}
): Promise<Response> {
  return apiRequest(url, {
    ...options,
    method: 'PATCH',
    body: data !== undefined ? JSON.stringify(data) : undefined,
  });
}

/**
 * Make a DELETE request.
 */
export async function apiDelete(
  url: string,
  options: Omit<RequestInit, 'method'> = {}
): Promise<Response> {
  return apiRequest(url, { ...options, method: 'DELETE' });
}
