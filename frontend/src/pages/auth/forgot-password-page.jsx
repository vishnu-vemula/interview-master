import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Link, useLocation } from 'react-router-dom';
import { AlertCircle, MailCheck } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { firebaseMode } from '@/lib/firebase';
import { Alert, Button, Field, Input } from '@/components/ui';
import { AuthHeading } from './auth-shared';

export default function ForgotPasswordPage() {
  const { resetPassword } = useAuthStore();
  const { search } = useLocation();
  const [sentTo, setSentTo] = useState('');
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, getValues, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { email: new URLSearchParams(search).get('email') || '' },
  });

  const onSubmit = async ({ email }) => {
    setServerError('');
    const result = await resetPassword(email.trim());
    if (result.success) setSentTo(email.trim());
    else setServerError(result.message);
  };

  if (sentTo) {
    return (
      <div className="animate-fade-in">
        <span className="grid h-12 w-12 place-items-center rounded-r14 bg-lime"><MailCheck size={20} aria-hidden="true" /></span>
        <div className="mt-6">
          <AuthHeading title="Check your inbox" subtitle={`If an account exists for ${sentTo}, we’ve sent a link to choose a new password. It expires in 30 minutes.`} />
        </div>
        {import.meta.env.DEV && !firebaseMode && (
          <Alert tone="info" className="mt-6" title="Local development">
            Without an email provider configured, the reset link is printed in the API server log.
          </Alert>
        )}
        <div className="mt-8 flex flex-wrap gap-2">
          <Button to={`/login?email=${encodeURIComponent(sentTo)}`} variant="lime" cta className="py-[6px]">Back to log in</Button>
          <Button variant="ghost" loading={isSubmitting} onClick={() => handleSubmit(onSubmit)()}>Resend link</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="animate-fade-in">
      <AuthHeading title="Reset your password" subtitle="Enter your account email and we’ll send you a link to choose a new one." />
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 flex flex-col gap-3.5">
        {serverError && <Alert tone="error" icon={AlertCircle}>{serverError}</Alert>}
        <Field label="Email" error={errors.email?.message}>
          <Input
            type="email"
            size="lg"
            autoComplete="email"
            autoFocus={!getValues('email')}
            placeholder="you@example.com"
            {...register('email', {
              required: 'Enter your email',
              pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address' },
            })}
          />
        </Field>
        <Button type="submit" variant="lime" cta disabled={isSubmitting} className="mt-2 w-full py-[6px] text-[12.5px]">
          {isSubmitting ? 'One moment…' : 'Send reset link'}
        </Button>
      </form>
      <p className="mt-[22px] text-[13.5px] text-muted">
        Remembered it? <Link to="/login" className="link">Log in</Link>
      </p>
    </div>
  );
}
