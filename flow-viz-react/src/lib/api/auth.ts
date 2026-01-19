import { apiFetch, tokenManager } from './client';
import type { LoginRequest, LoginResponse } from './types';

/**
 * Login with email (passwordless for demo)
 * Stores JWT token in memory on success
 */
export async function login(credentials: LoginRequest): Promise<LoginResponse> {
  const response = await apiFetch<LoginResponse>('/api/login', {
    method: 'POST',
    body: JSON.stringify(credentials),
    skipAuth: true, // Login doesn't need auth
  });

  // Store token in memory
  tokenManager.setToken(response.token);

  return response;
}

/**
 * Logout - clears token from memory
 */
export function logout(): void {
  tokenManager.clearToken();
}

/**
 * Check if user is authenticated
 */
export function isAuthenticated(): boolean {
  return tokenManager.hasToken();
}
