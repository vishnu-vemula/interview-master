import axios from 'axios';
import { auth, getFirebaseToken } from './firebase';
import { signOut } from 'firebase/auth';

const adminApi = axios.create({ baseURL: import.meta.env.VITE_API_URL || '/api',
  timeout: 30_000, headers: { 'Content-Type': 'application/json' } });
export const getAdminAuth = () => ({});
export const setAdminAccessToken = () => {};
export const clearAdminAuth = () => {};
adminApi.interceptors.request.use(async config => {
  const token = await getFirebaseToken();
  if (token) config.headers.Authorization = `Bearer ${token}`;
  return config;
});
adminApi.interceptors.response.use(response => response, async error => {
  const original = error.config;
  if (error.response?.status !== 401 || !original || original._retry) return Promise.reject(error);
  original._retry = true;
  try { const token = await getFirebaseToken(true);
    if (!token) throw error;
    original.headers.Authorization = `Bearer ${token}`;
    return adminApi(original);
  } catch { await signOut(auth).catch(() => {}); return Promise.reject(error); }
});
export default adminApi;
