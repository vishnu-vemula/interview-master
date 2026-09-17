/**
 * hooks/index.js — Barrel file
 *
 * Single import point for all custom hooks:
 *   import { useAuth, useFetch, useApi, useLocalStorage } from '@/hooks';
 */

export { default as useAuth          } from './use-auth';
export { default as useFetch         } from './use-fetch';
export { default as useApi           } from './use-api';
export { default as useLocalStorage  } from './use-local-storage';
