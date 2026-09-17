/**
 * context/index.js — Barrel file
 *
 * Single import point for all contexts and their hooks:
 *   import { AuthProvider, useAuthContext, AppProvider, useAppContext } from '@/context';
 *   import { AdminAuthProvider, useAdminAuth }                          from '@/context';
 */

export { AuthContext,      AuthProvider,      useAuthContext } from './auth-context';
export { AppContext,       AppProvider,       useAppContext  } from './app-context';
export { AdminAuthContext, AdminAuthProvider, useAdminAuth   } from './admin-auth-context';
