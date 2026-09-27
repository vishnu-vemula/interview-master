import axios from 'axios';
import { auth, getFirebaseToken } from './firebase';
import { signOut } from 'firebase/auth';

export const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';
const api = axios.create({ baseURL: API_BASE_URL, timeout: 60_000,
  headers: { 'Content-Type': 'application/json' } });

api.interceptors.request.use(async config => {
  const token = await getFirebaseToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
api.interceptors.response.use(response => response, async error => {
  const original = error.config;
  if (error.response?.status !== 401 || !original || original._retry) return Promise.reject(error);
  original._retry = true;
  try { const token = await getFirebaseToken(true);
    if (!token) throw error;
    original.headers.Authorization = `Bearer ${token}`;
    return api(original);
  } catch { await signOut(auth).catch(() => {}); return Promise.reject(error); }
});

export const SOCKET_URL = /^https?:\/\//.test(API_BASE_URL)
  ? API_BASE_URL.replace(/\/api\/?$/, '') : window.location.origin;
export default api;
