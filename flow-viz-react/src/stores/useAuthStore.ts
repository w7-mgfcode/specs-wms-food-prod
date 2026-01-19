import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import * as authApi from '../lib/api/auth';
import type { User, UserRole } from '../lib/api/types';

interface AuthState {
  user: User | null;
  role: UserRole | null;
  isLoading: boolean;
  error: string | null;

  // Actions
  login: (email: string, role?: UserRole) => Promise<void>;
  logout: () => void;
  clearError: () => void;
  checkSession: () => Promise<void>;
}

export const useAuthStore = create<AuthState>()(
  devtools(
    (set) => ({
      user: null,
      role: null,
      isLoading: false,
      error: null,

      login: async (email: string, _role?: UserRole) => {
        set({ isLoading: true, error: null });

        try {
          const response = await authApi.login({ email });
          set({
            user: response.user,
            role: response.user.role,
            isLoading: false,
            error: null,
          });
        } catch (e: unknown) {
          const message = e instanceof Error ? e.message : 'Login failed';
          set({ error: message, isLoading: false });
        }
      },

      logout: () => {
        authApi.logout();
        set({ user: null, role: null, error: null });
      },

      clearError: () => {
        set({ error: null });
      },

      checkSession: async () => {
        // With JWT in memory, we don't persist sessions across page reloads
        // This is intentional for security (XSS protection)
        // For now, just mark loading as complete
        set({ isLoading: false });
      },
    }),
    { name: 'AuthStore' }
  )
);
