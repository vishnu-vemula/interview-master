import { useEffect, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useQueryClient } from '@tanstack/react-query';
import { AlertCircle } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { Alert, Button, Logo, Spinner } from '@/components/ui';
import { safeNext } from './auth-shared';

/** /auth/callback?code=… — exchanges the one-time OAuth code for a session. */
export default function OAuthCallbackPage() {
  const { completeOAuth } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { search } = useLocation();
  const [error, setError] = useState('');
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return; // the code is single-use; guard StrictMode's double effect
    ran.current = true;
    const code = new URLSearchParams(search).get('code');
    if (!code || !completeOAuth) { setError('This sign-in link is incomplete. Please try again.'); return; }
    completeOAuth(code).then((result) => {
      if (result.success) {
        queryClient.clear();
        navigate(safeNext(search), { replace: true });
      } else setError(result.message);
    });
  }, [search, completeOAuth, navigate, queryClient]);

  return (
    <div className="grid min-h-dvh place-items-center bg-paper p-6">
      <div className="w-full max-w-sm text-center">
        <Logo to="/" className="justify-center" />
        {error ? (
          <>
            <Alert tone="error" icon={AlertCircle} className="mt-8 text-left">{error}</Alert>
            <Button to="/login" variant="lime" cta className="mt-6 py-[6px]">Back to log in</Button>
          </>
        ) : (
          <div role="status" className="mt-10 flex flex-col items-center gap-4">
            <Spinner size={24} className="text-brand" />
            <p className="mono-label text-muted">Signing you in…</p>
          </div>
        )}
      </div>
    </div>
  );
}
