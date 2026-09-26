import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import { useAuthStore } from '@/store/auth-store';

export const BILLING_ME_KEY = ['billing', 'me'];
export const BILLING_PLANS_KEY = ['billing', 'plans'];

/** Current pass + interview allowance for the signed-in user (GET /billing/me). */
export function useBillingMe(options = {}) {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return useQuery({
    queryKey: BILLING_ME_KEY,
    queryFn: () => api.get('/billing/me').then((r) => r.data),
    enabled: isAuthenticated,
    staleTime: 60_000,
    ...options,
  });
}

/** Published plans (public; GET /billing/plans). */
export function usePlans(options = {}) {
  return useQuery({
    queryKey: BILLING_PLANS_KEY,
    queryFn: () => api.get('/billing/plans').then((r) => r.data.plans || []),
    staleTime: 5 * 60_000,
    ...options,
  });
}
