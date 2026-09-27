import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, KeyRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { useAuthStore } from '@/store/auth-store';
import { Alert, Button, Field, PasswordInput } from '@/components/ui';
import { AuthHeading } from './auth-shared';

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

export default function ResetPasswordPage() {
  const { confirmPasswordReset } = useAuthStore();
  const navigate = useNavigate();
  const { search } = useLocation();
  const token = new URLSearchParams(search).get('oobCode') || '';
  const [serverError, setServerError] = useState('');
  const [expired, setExpired] = useState(false);
  const { register, handleSubmit, watch, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { password: '', confirm: '' },
  });
  const password = watch('password');

  // Firebase password reset links provide an action code, never an application token.
  if (!token || !confirmPasswordReset) {
    return (
      <div className="animate-fade-in">
        <AuthHeading title="This link isn’t valid" subtitle="Password reset links come from the email we send. Request a new one to continue." />
        <Button to="/forgot-password" variant="lime" cta className="mt-8 py-[6px]">Request a new link</Button>
      </div>
    );
  }

  const onSubmit = async (data) => {
    setServerError('');
    const result = await confirmPasswordReset({ token, password: data.password });
    if (result.success) {
      toast.success('Password updated. Sign in with your new password.');
      navigate('/login', { replace: true });
      return;
    }
    if (result.status === 400 && /expired|invalid/i.test(result.message)) setExpired(true);
    setServerError(result.message);
  };

  return (
    <div className="animate-fade-in">
      <span className="grid h-12 w-12 place-items-center rounded-r14 bg-stone"><KeyRound size={20} aria-hidden="true" /></span>
      <div className="mt-6">
        <AuthHeading title="Choose a new password" subtitle="Use at least 8 characters with an uppercase letter, a lowercase letter and a number." />
      </div>
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 flex flex-col gap-3.5">
        {serverError && (
          <Alert
            tone="error"
            icon={AlertCircle}
            action={expired ? <Button to="/forgot-password" size="sm" variant="soft">New link</Button> : undefined}
          >
            {serverError}
          </Alert>
        )}
        <Field label="New password" error={errors.password?.message}>
          <PasswordInput
            size="lg"
            autoComplete="new-password"
            autoFocus
            placeholder="At least 8 characters"
            {...register('password', {
              required: 'Choose a new password',
              minLength: { value: 8, message: 'Use at least 8 characters' },
              pattern: { value: PASSWORD_RULE, message: 'Include an uppercase letter, a lowercase letter and a number' },
            })}
          />
        </Field>
        <Field label="Confirm new password" error={errors.confirm?.message}>
          <PasswordInput
            size="lg"
            autoComplete="new-password"
            placeholder="Repeat your new password"
            {...register('confirm', {
              required: 'Confirm your new password',
              validate: (v) => v === password || 'Passwords don’t match',
            })}
          />
        </Field>
        <Button type="submit" variant="lime" cta disabled={isSubmitting} className="mt-2 w-full py-[6px] text-[12.5px]">
          {isSubmitting ? 'One moment…' : 'Update password'}
        </Button>
      </form>
    </div>
  );
}
