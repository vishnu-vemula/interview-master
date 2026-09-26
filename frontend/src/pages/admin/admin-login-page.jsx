/**
 * AdminLoginPage — /admin/login. Authenticates through AdminAuthContext (separate from candidates).
 */

import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { AlertCircle, ShieldCheck } from 'lucide-react';
import { useAdminAuth } from '@/context';
import { Alert, Button, Field, Input, LogoMark, PasswordInput } from '@/components/ui';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { adminLogin, clearError, isAdminAuthenticated } = useAdminAuth();
  const [serverError, setServerError] = useState('');
  const { register, handleSubmit, formState: { errors, isSubmitting } } = useForm({
    defaultValues: { email: '', password: '' },
  });

  useEffect(() => {
    if (isAdminAuthenticated) navigate('/admin', { replace: true });
  }, [isAdminAuthenticated, navigate]);

  const onSubmit = async (data) => {
    setServerError('');
    clearError();
    const result = await adminLogin({ email: data.email.trim(), password: data.password });
    if (result.success) navigate('/admin', { replace: true });
    else setServerError(result.message);
  };

  return (
    <div className="grid min-h-dvh grid-cols-1 gap-2.5 bg-paper p-2.5 lg:grid-cols-2">
      <section className="relative flex flex-col overflow-hidden rounded-r28 bg-ink p-6 text-white sm:p-7 lg:min-h-[560px]">
        <div className="pointer-events-none absolute -bottom-[30%] -right-[20%] h-[70%] w-[80%] rounded-full bg-brand/25 blur-[80px]" />
        <div className="relative flex items-center gap-2.5">
          <LogoMark size={30} />
          <span className="text-[19px] font-semibold tracking-tight1">Rehearsly</span>
          <span className="ml-1 rounded-full bg-lime px-2 py-1 font-mono text-[10px] uppercase tracking-mono text-ink">Admin</span>
        </div>

        <div className="relative hidden flex-1 flex-col justify-center gap-3 py-10 lg:flex">
          {[
            ['Platform health', 'Sign-ups, sessions and revenue at a glance'],
            ['Content & jobs', 'Plans, prompts, job board and scraper controls'],
            ['Audit trail', 'Every privileged action is logged'],
          ].map(([t, d], i) => (
            <div key={t} className="flex max-w-[380px] items-start gap-3 rounded-r18 border border-ink-line bg-ink-2 px-4 py-3.5" style={{ marginLeft: i * 28 }}>
              <span className="mt-1 h-2 w-2 flex-shrink-0 rounded-full bg-lime" />
              <div>
                <p className="text-[15px] font-medium">{t}</p>
                <p className="mt-0.5 text-[13px] text-on-dark">{d}</p>
              </div>
            </div>
          ))}
        </div>

        <p className="relative mt-10 max-w-[440px] text-[26px] font-medium leading-[1.1] tracking-[-0.035em] lg:mt-0 lg:text-[clamp(26px,2.6vw,36px)]">
          Run the practice platform behind every better answer.
        </p>
      </section>

      <section className="flex flex-col px-5 py-6 sm:px-[clamp(20px,5vw,72px)] sm:py-7">
        <div className="flex items-center justify-between gap-3">
          <Link to="/" className="py-2 font-mono text-[11.5px] uppercase tracking-mono text-muted hover:text-ink">← Back to site</Link>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-stone px-3 py-[7px] font-mono text-[10.5px] uppercase tracking-mono text-muted">
            <ShieldCheck size={13} aria-hidden="true" /> Restricted
          </span>
        </div>

        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-10 sm:py-12">
          <h1 className="text-[40px] font-medium leading-none tracking-tight2 sm:text-[44px]">Admin sign in</h1>
          <p className="mt-3 text-[16px] leading-normal text-muted-strong">Use your administrator account. Candidate accounts can’t access the console.</p>

          <form onSubmit={handleSubmit(onSubmit)} noValidate className="mt-8 flex flex-col gap-3.5" id="admin-login-form">
            {serverError && <Alert tone="error" icon={AlertCircle}>{serverError}</Alert>}
            <Field label="Admin email" error={errors.email?.message}>
              <Input
                type="email"
                size="lg"
                autoComplete="email"
                autoFocus
                placeholder="admin@company.com"
                {...register('email', {
                  required: 'Enter your admin email',
                  pattern: { value: /^\S+@\S+\.\S+$/, message: 'Enter a valid email address' },
                })}
              />
            </Field>
            <Field label="Password" error={errors.password?.message}>
              <PasswordInput size="lg" autoComplete="current-password" placeholder="Your admin password" {...register('password', { required: 'Enter your password' })} />
            </Field>
            <Button type="submit" variant="ink" cta disabled={isSubmitting} className="mt-2 w-full py-[6px] text-[12.5px] [&_.btn-cta-disc]:bg-lime [&_.btn-cta-disc]:text-ink">
              {isSubmitting ? 'Checking…' : 'Sign in to console'}
            </Button>
          </form>

          <p className="mt-[22px] text-[12.5px] leading-[1.55] text-muted-2">
            Access is limited to authorised administrators and every privileged action is recorded in the audit log.
          </p>
        </div>
      </section>
    </div>
  );
}
