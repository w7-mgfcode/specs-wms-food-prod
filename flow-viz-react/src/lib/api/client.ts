/**
 * API Client with JWT token management and global error handling
 *
 * Security: Token stored in memory (module closure) for XSS protection.
 * Never stored in localStorage or sessionStorage.
 */

// ============ Token Storage (Module-level for XSS protection) ============

let authToken: string | null = null;

export const tokenManager = {
  getToken: () => authToken,
  setToken: (token: string | null) => { authToken = token; },
  clearToken: () => { authToken = null; },
  hasToken: () => authToken !== null,
};

// ============ Error Class ============

/**
 * Custom error class for API errors with typed properties
 */
export class ApiClientError extends Error {
  constructor(
    public readonly status: number,
    public readonly detail: string,
    public readonly body?: unknown
  ) {
    super(detail);
    this.name = 'ApiClientError';
    // Maintains proper stack trace for V8
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, ApiClientError);
    }
  }

  /** Check if this is an authentication error */
  isAuthError(): boolean {
    return this.status === 401;
  }

  /** Check if this is a permission error */
  isPermissionError(): boolean {
    return this.status === 403;
  }

  /** Check if this is a server error */
  isServerError(): boolean {
    return this.status >= 500;
  }
}

// ============ API Client ============

/**
 * Get base URL for API requests
 * In development: empty (uses Vite proxy)
 * In production: explicit VITE_API_URL
 */
function getBaseUrl(): string {
  return import.meta.env.VITE_API_URL || '';
}

/**
 * Handle global error responses (401, 403, etc.)
 * Called before throwing ApiClientError
 */
function handleGlobalErrors(status: number): void {
  if (status === 401) {
    // Clear token and redirect to login
    tokenManager.clearToken();
    // Use standard router path (react-router-dom v7)
    window.location.href = '/login';
  }
  // 403 is handled at QueryClient level with toast
  // 5xx is handled by error boundary
}

/**
 * Type-safe fetch wrapper with automatic JWT injection
 */
export async function apiFetch<T>(
  path: string,
  options?: RequestInit & { skipAuth?: boolean }
): Promise<T> {
  const { skipAuth, ...fetchOptions } = options || {};
  const headers = new Headers(fetchOptions?.headers);

  // Inject JWT token if available and not skipped
  const token = tokenManager.getToken();
  if (token && !skipAuth) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  // Set content type for JSON requests
  if (fetchOptions?.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const url = `${getBaseUrl()}${path}`;
  const response = await fetch(url, { ...fetchOptions, headers });

  // Handle non-2xx responses
  if (!response.ok) {
    let detail = 'Request failed';
    let body: unknown;

    try {
      body = await response.json();
      detail = (body as { detail?: string })?.detail || detail;
    } catch {
      // Response wasn't JSON
    }

    // Handle global error patterns (401 redirect, etc.)
    handleGlobalErrors(response.status);

    throw new ApiClientError(response.status, detail, body);
  }

  // Return parsed JSON (or empty object for 204)
  if (response.status === 204) {
    return {} as T;
  }

  return response.json();
}
