/**
 * lib/axios.js
 *
 * Configured Axios instance:
 *  - Base URL from env
 *  - Request interceptor: attaches Bearer token
 *  - Response interceptor: auto-refresh on 401 with request queue
 *
 * NOTE: reads token from localStorage directly (not the store) to avoid a
 * circular import with store/auth-store.js. Token changes are broadcast with
 * window events that the store listens to:
 *   'auth:token-refreshed' (detail: { accessToken })  and  'auth:logout'.
 */

import axios from 'axios';
import { auth, firebaseMode, getFirebaseToken } from './firebase';
import { signOut } from 'firebase/auth';

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const STORAGE_KEY = 'interviewmaster-auth';

const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 60_000,
  headers: { 'Content-Type': 'application/json' },
});

// ─── Helper: read token from Zustand persisted storage ───────────
// Zustand persist wraps state as: { state: { accessToken, ... }, version: 0 }
const getStoredAuth = () => {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw);
    return parsed?.state ?? parsed;
  } catch {
    return {};
  }
};

const forceLogout = () => {
  localStorage.removeItem(STORAGE_KEY);
  window.dispatchEvent(new Event('auth:logout'));
};

// ─── Request Interceptor ──────────────────────────────────────────
api.interceptors.request.use(
  async (config) => {
    if (firebaseMode) {
      const token = await getFirebaseToken();
      if (token) config.headers.Authorization = `Bearer ${token}`;
      return config;
    }
    const { accessToken } = getStoredAuth();
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// ─── Response Interceptor: silent token refresh ───────────────────
let isRefreshing = false;
let failedQueue  = [];

const processQueue = (error, token = null) => {
  failedQueue.forEach((p) => (error ? p.reject(error) : p.resolve(token)));
  failedQueue = [];
};

// Auth endpoints whose 401 means "bad credentials", not "expired token".
const NO_REFRESH = ['/auth/login', '/auth/register', '/auth/refresh'];

api.interceptors.response.use(
  (response) => response,

  async (error) => {
    const originalRequest = error.config;

    if (firebaseMode) {
      if (error.response?.status !== 401 || !originalRequest || originalRequest._retry) {
        return Promise.reject(error);
      }
      originalRequest._retry = true;
      try {
        const token = await getFirebaseToken(true);
        if (!token) throw error;
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      } catch {
        await signOut(auth).catch(() => {});
        return Promise.reject(error);
      }
    }

    // Only retry once on 401, and never for the credential endpoints themselves
    if (
      error.response?.status !== 401 ||
      !originalRequest ||
      originalRequest._retry ||
      NO_REFRESH.some((path) => originalRequest.url?.includes(path))
    ) {
      return Promise.reject(error);
    }

    // Queue concurrent requests while refresh is in progress
    if (isRefreshing) {
      return new Promise((resolve, reject) => {
        failedQueue.push({ resolve, reject });
      }).then((token) => {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      });
    }

    originalRequest._retry = true;
    isRefreshing = true;

    const { refreshToken } = getStoredAuth();

    if (!refreshToken) {
      forceLogout();
      isRefreshing = false;
      return Promise.reject(error);
    }

    try {
      const { data } = await axios.post(`${API_BASE_URL}/auth/refresh`, { refreshToken });
      const newToken = data.accessToken;

      // Keep the persisted copy and the in-memory store in sync.
      const raw = localStorage.getItem(STORAGE_KEY);
      const zustandStore = raw ? JSON.parse(raw) : { state: {} };
      zustandStore.state = { ...zustandStore.state, accessToken: newToken };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(zustandStore));
      window.dispatchEvent(new CustomEvent('auth:token-refreshed', { detail: { accessToken: newToken } }));

      processQueue(null, newToken);
      originalRequest.headers.Authorization = `Bearer ${newToken}`;
      return api(originalRequest);

    } catch (refreshError) {
      processQueue(refreshError, null);
      forceLogout();
      return Promise.reject(refreshError);

    } finally {
      isRefreshing = false;
    }
  }
);

/** Socket.io origin: the API origin when VITE_API_URL is absolute, else same-origin (Vite proxies /socket.io). */
export const SOCKET_URL = /^https?:\/\//.test(API_BASE_URL)
  ? API_BASE_URL.replace(/\/api\/?$/, '')
  : window.location.origin;

export default api;
