import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth-store';
import { Alert, Button, Field, Input, PasswordInput } from '@/components/ui';
import { AuthFinePrint, AuthHeading, SocialSignIn, safeNext } from './auth-shared';

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

export default function RegisterPage() {
  const { register: registerUser, isLoading } = useAuthStore();
  const navigate = useNavigate();
  const { search } = useLocation();
  const [serverError, setServerError] = useState('');

  const { register, handleSubmit, setError, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { name: '', email: '', password: '' },
  });
  const busy = isLoading || isSubmitting;

  const onSubmit = async (data) => {
    setServerError('');
    const result = await registerUser({ name: data.name.trim(), email: data.email.trim(), password: data.password });
    if (result.success) {
      if (result.verificationRequired) {
        toast.success('Check your email for a verification link, then sign in.');
        navigate('/login', { replace: true });
        return;
      }
      toast.success('Account created — let’s set up your first interview');
      navigate(safeNext(search), { replace: true });
      return;
    }
    // Attach known server errors to the relevant field, otherwise show a form-level alert.
    if (result.status === 409 || /email/i.test(result.message)) {
      setError('email', { type: 'server', message: result.message });
    } else if (/password/i.test(result.message)) {
      setError('password', { type: 'server', message: result.message });
    } else if (/name/i.test(result.message)) {
      setError('name', { type: 'server', message: result.message });
    } else {
      setServerError(result.message);
    }
  };

  return (
    <div className="animate-fade-in">
      <AuthHeading title="Create your account" subtitle="Two free tailored interviews every month. No card needed." />

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

        <Field label="Full name" error={errors.name?.message}>
          <Input
            type="text"
            size="lg"
            autoComplete="name"
            placeholder="Priya Raman"
            {...register('name', {
              required: 'Enter your name',
              minLength: { value: 2, message: 'Name must be at least 2 characters' },
              maxLength: { value: 50, message: 'Name must be 50 characters or fewer' },
            })}
          />
        </Field>

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
          hint="Use 8+ characters with an uppercase letter, a lowercase letter and a number."
        >
          <PasswordInput
            size="lg"
            autoComplete="new-password"
            placeholder="At least 8 characters"
            {...register('password', {
              required: 'Choose a password',
              minLength: { value: 8, message: 'Use at least 8 characters' },
              pattern: { value: PASSWORD_RULE, message: 'Include an uppercase letter, a lowercase letter and a number' },
            })}
          />
        </Field>

        <Button type="submit" variant="lime" cta disabled={busy} className="mt-2 w-full py-[6px] text-[12.5px]">
          {busy ? 'One moment…' : 'Create account'}
        </Button>
      </form>

      <AuthFinePrint />
    </div>
  );
}
