import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api, { API_BASE_URL } from '@/lib/axios';
import { getErrorMessage } from '@/utils';

export const useAuthStore = create(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,
      isLoading: false,

      // ── Actions ──────────────────────────────────────────
      setAccessToken: (token) => set({ accessToken: token }),

      login: async ({ email, password }) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/login', { email, password });
          set({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });
          return { success: true };
        } catch (err) {
          set({ isLoading: false });
          return { success: false, status: err.response?.status, message: getErrorMessage(err, 'Login failed') };
        }
      },

      register: async ({ name, email, password }) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/register', { name, email, password });
          set({
            user: data.user,
            accessToken: data.accessToken,
            refreshToken: data.refreshToken,
            isAuthenticated: true,
            isLoading: false,
          });
          return { success: true };
        } catch (err) {
          set({ isLoading: false });
          return { success: false, status: err.response?.status, message: getErrorMessage(err, 'Registration failed') };
        }
      },

      logout: () => {
        // Server logout is stateless (JWT); fire-and-forget while a token still exists.
        // `_retry` stops the interceptor from refreshing (and re-persisting) a token we are discarding.
        if (get().accessToken) api.post('/auth/logout', null, { _retry: true }).catch(() => {});
        set({
          user: null,
          accessToken: null,
          refreshToken: null,
          isAuthenticated: false,
        });
      },

      updateUser: (updatedUser) => {
        set({ user: { ...get().user, ...updatedUser } });
      },

      // ── Account recovery & social sign-in (same interface as the Firebase store) ──
      /** Request a password-reset link for `email` (always succeeds unless the request fails). */
      resetPassword: async (email) => {
        try {
          await api.post('/auth/forgot-password', { email });
          return { success: true };
        } catch (err) {
          return { success: false, status: err.response?.status, message: getErrorMessage(err, 'Couldn’t send a reset link') };
        }
      },

      /** Complete a reset from the emailed link; signs the user in on success. */
      confirmPasswordReset: async ({ token, password }) => {
        set({ isLoading: true });
        try {
          const { data } = await api.post('/auth/reset-password', { token, password });
          set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken, isAuthenticated: true, isLoading: false });
          return { success: true };
        } catch (err) {
          set({ isLoading: false });
          return { success: false, status: err.response?.status, message: getErrorMessage(err, 'Couldn’t reset your password') };
        }
      },

      /** Full-page redirect into the provider's OAuth flow (Google / LinkedIn). */
      oauthLogin: (provider, next = '/dashboard') => {
        window.location.assign(`${API_BASE_URL}/auth/oauth/${provider}/start?next=${encodeURIComponent(next)}`);
        return { success: true, redirecting: true };
      },
      googleLogin: async (next) => get().oauthLogin('google', next),

      /** Exchange the one-time code from /auth/callback for a session. */
      completeOAuth: async (code) => {
        try {
          const { data } = await api.post('/auth/oauth/exchange', { code });
          set({ user: data.user, accessToken: data.accessToken, refreshToken: data.refreshToken, isAuthenticated: true, isLoading: false });
          return { success: true };
        } catch (err) {
          return { success: false, status: err.response?.status, message: getErrorMessage(err, 'Sign-in didn’t complete') };
        }
      },
    }),
    {
      name: 'interviewmaster-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);

// Keep the store in sync with the axios refresh interceptor (lib/axios.js).
if (typeof window !== 'undefined') {
  window.addEventListener('auth:token-refreshed', (e) => {
    if (e.detail?.accessToken) useAuthStore.setState({ accessToken: e.detail.accessToken });
  });
  window.addEventListener('auth:logout', () => {
    useAuthStore.setState({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
  });
}
