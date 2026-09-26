import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import api from '@/lib/axios';
import { firebaseMode } from '@/lib/firebase';
import { useAuthStore } from '@/store/auth-store';
import { cn } from '@/utils';

/** Only allow same-app relative redirects (prevents open redirects via ?next=). */
export function safeNext(search, fallback = '/dashboard') {
  const next = new URLSearchParams(search).get('next');
  return next && next.startsWith('/') && !next.startsWith('//') ? next : fallback;
}

export const OAUTH_ERRORS = {
  not_configured: 'That sign-in option isn’t configured on this server yet. Use email instead.',
  cancelled: 'Sign-in was cancelled.',
  invalid_state: 'That sign-in link expired. Please try again.',
  email_unverified: 'Your provider account needs a verified email address.',
  account_unavailable: 'This account is deactivated or banned. Contact support.',
  provider_error: 'The sign-in provider returned an error. Please try again.',
};

export function AuthHeading({ title, subtitle }) {
  return (
    <div>
      <h1 className="text-[40px] font-medium leading-none tracking-tight2 sm:text-[44px]">{title}</h1>
      <p className="mt-3 text-[16px] leading-normal text-muted-strong">{subtitle}</p>
    </div>
  );
}

export function AuthFinePrint() {
  return (
    <p className="mt-[22px] text-[12.5px] leading-[1.55] text-muted-2">
      By continuing you agree to our Terms and{' '}
      <Link to="/#privacy" className="underline hover:text-ink">
        Privacy Policy
      </Link>
      . Your resume stays private and you can delete your data at any time.
    </p>
  );
}

/** Which sign-in options this deployment supports (GET /auth/providers; Firebase mode = Google popup). */
export function useAuthProviders() {
  return useQuery({
    queryKey: ['auth-providers'],
    queryFn: () => api.get('/auth/providers').then((r) => r.data),
    enabled: !firebaseMode,
    staleTime: 5 * 60_000,
    retry: false,
  });
}

function GoogleMark() {
  // Design mark: blue ring with a lime segment.
  return <span className="h-4 w-4 flex-shrink-0 rounded-full border-[3px] border-brand border-r-lime" aria-hidden="true" />;
}
function LinkedInMark() {
  return <span className="h-3.5 w-3.5 flex-shrink-0 rounded-[3px] bg-ink" aria-hidden="true" />;
}

/**
 * The design's two social buttons + "or with email" divider.
 * onError(message) surfaces failures in the page's alert.
 */
export function SocialSignIn({ next = '/dashboard', onError, onSuccess }) {
  const store = useAuthStore();
  const providers = useAuthProviders();
  const [pending, setPending] = useState('');

  const enabled = {
    google: firebaseMode ? true : !!providers.data?.google,
    linkedin: firebaseMode ? false : !!providers.data?.linkedin,
  };

  const start = async (provider) => {
    onError?.('');
    setPending(provider);
    const result = firebaseMode ? await store.googleLogin() : store.oauthLogin(provider, next);
    if (result?.redirecting) return; // full-page redirect to the provider
    setPending('');
    if (result?.success) onSuccess?.();
    else if (result) onError?.(result.message);
  };

  const buttons = [
    { key: 'google', label: 'Google', mark: <GoogleMark /> },
    { key: 'linkedin', label: 'LinkedIn', mark: <LinkedInMark /> },
  ];

  return (
    <>
      <div className="mt-8 grid grid-cols-2 gap-2">
        {buttons.map((b) => {
          const off = !enabled[b.key] || !!pending;
          return (
            <button
              key={b.key}
              type="button"
              onClick={() => start(b.key)}
              disabled={off}
              title={!enabled[b.key] ? `${b.label} sign-in isn’t configured on this server` : `Continue with ${b.label}`}
              aria-label={`Continue with ${b.label}`}
              className={cn(
                'flex items-center justify-center gap-2.5 rounded-r14 border border-line bg-white p-3.5 font-sans text-[14.5px] transition-colors',
                off ? 'cursor-not-allowed opacity-50' : 'hover:border-ink',
              )}
            >
              {pending === b.key ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-ink border-r-transparent" /> : b.mark}
              {b.label}
            </button>
          );
        })}
      </div>
      <div className="divider-label my-6">or with email</div>
    </>
  );
}
