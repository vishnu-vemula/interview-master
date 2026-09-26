import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth-store';
import { Alert, Button, Field, Input, PasswordInput } from '@/components/ui';
import { AuthFinePrint, AuthHeading, OAUTH_ERRORS, SocialSignIn, safeNext } from './auth-shared';

export default function LoginPage() {
  const { login, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const { search } = useLocation();
  const params = new URLSearchParams(search);
  const oauthError = params.get('oauthError');
  const [serverError, setServerError] = useState(oauthError ? OAUTH_ERRORS[oauthError] || OAUTH_ERRORS.provider_error : '');

  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { email: params.get('email') || '', password: '' },
  });
  const busy = isLoading || isSubmitting;
  const email = watch('email');

  const onSubmit = async (data) => {
    setServerError('');
    const result = await login({ email: data.email.trim(), password: data.password });
    if (result.success) {
      toast.success('Welcome back');
      navigate(safeNext(search), { replace: true });
    } else {
      setServerError(result.message);
    }
  };

  return (
    <div className="animate-fade-in">
      <AuthHeading title="Welcome back" subtitle="Your paused session is saved right where you left it." />

      <SocialSignIn
        next={safeNext(search)}
        onError={setServerError}
        onSuccess={() => navigate(safeNext(search), { replace: true })}
      />

      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex flex-col gap-3.5">
        {serverError && (
          <Alert tone="error" icon={AlertCircle}>
            {serverError}
          </Alert>
        )}

        <Field label="Email" error={errors.email?.message}>
          <Input
            type="email"
            size="lg"
            autoComplete="email"
            placeholder="you@example.com"
            {...register('email', {
              required: 'Enter your email',
              pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address' },
            })}
          />
        </Field>

        <Field
          label="Password"
          error={errors.password?.message}
          labelRight={
            <Link
              to={`/forgot-password${email ? `?email=${encodeURIComponent(email.trim())}` : ''}`}
              className="text-[13.5px] font-normal text-brand-600 hover:text-ink"
            >
              Forgot?
            </Link>
          }
        >
          <PasswordInput
            size="lg"
            autoComplete="current-password"
            placeholder="At least 8 characters"
            {...register('password', { required: 'Enter your password' })}
          />
        </Field>

        <Button type="submit" variant="lime" cta disabled={busy} className="mt-2 w-full py-[6px] text-[12.5px]">
          {busy ? 'One moment…' : 'Log in'}
        </Button>
      </form>

      <AuthFinePrint />
    </div>
  );
}
