import { useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { AlertCircle, CreditCard, KeyRound, Trash2, UserRound } from 'lucide-react';
import toast from 'react-hot-toast';
import { userAPI } from '@/services/api';
import { useAuthStore } from '@/store/auth-store';
import { useBillingMe } from '@/hooks/use-billing';
import { Alert, Avatar, Button, Card, Field, Input, PageHeader, PasswordInput, Pill, ProgressBar } from '@/components/ui';
import { formatDate, getErrorMessage } from '@/utils';
import { auth, firebaseMode } from '@/lib/firebase';

const PASSWORD_RULE = /^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/;

export default function ProfilePage() {
  const { user, updateUser, logout, changeFirebasePassword, deleteFirebaseAccount } = useAuthStore();
  const navigate = useNavigate();
  const [profileError, setProfileError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [showDelete, setShowDelete] = useState(false);
  const [deletePassword, setDeletePassword] = useState('');
  const [deleteError, setDeleteError] = useState('');
  const [deleting, setDeleting] = useState(false);
  const billing = useBillingMe();

  // Refresh the stored user with server data (session counts, name changes elsewhere).
  const profile = useQuery({ queryKey: ['profile'], queryFn: () => userAPI.getProfile().then((r) => r.data.user) });
  useEffect(() => {
    if (profile.data) updateUser({ name: profile.data.name, totalSessions: profile.data.totalSessions, createdAt: profile.data.createdAt, role: profile.data.role });
  }, [profile.data]); // eslint-disable-line react-hooks/exhaustive-deps

  const {
    register, handleSubmit, reset, formState: { errors, isSubmitting, isDirty },
  } = useForm({ defaultValues: { name: user?.name || '' } });

  useEffect(() => { if (profile.data?.name) reset({ name: profile.data.name }); }, [profile.data?.name, reset]);

  const {
    register: regPwd, handleSubmit: handlePwd, watch: watchPwd, reset: resetPwd, setError: setPwdError,
    formState: { errors: pwdErrors, isSubmitting: savingPwd },
  } = useForm({ defaultValues: { currentPassword: '', newPassword: '', confirmPassword: '' } });
  const newPassword = watchPwd('newPassword');

  const onProfileSave = async (data) => {
    setProfileError('');
    try {
      const { data: res } = await userAPI.updateProfile({ name: data.name.trim() });
      updateUser({ name: res.user.name });
      reset({ name: res.user.name });
      toast.success('Profile updated');
    } catch (err) {
      setProfileError(getErrorMessage(err, 'Couldn’t update your profile'));
    }
  };

  const onPasswordSave = async (data) => {
    setPasswordError('');
    try {
      if (firebaseMode) await changeFirebasePassword({ currentPassword: data.currentPassword, newPassword: data.newPassword });
      else await userAPI.changePassword({ currentPassword: data.currentPassword, newPassword: data.newPassword });
      toast.success('Password changed');
      resetPwd();
    } catch (err) {
      const message = getErrorMessage(err, 'Couldn’t change your password');
      if (err.response?.status === 401) setPwdError('currentPassword', { type: 'server', message });
      else setPasswordError(message);
    }
  };

  const onDeleteAccount = async (event) => {
    event.preventDefault();
    setDeleteError('');
    setDeleting(true);
    try {
      if (firebaseMode) await deleteFirebaseAccount(deletePassword);
      else await userAPI.deleteAccount(deletePassword);
      await logout();
      navigate('/', { replace: true });
      toast.success('Your account has been deleted');
    } catch (err) {
      setDeleteError(getErrorMessage(err, 'Could not delete your account'));
    } finally {
      setDeleting(false);
    }
  };

  const allowance = billing.data?.allowance;
  const plan = billing.data?.subscription?.planId;
  const passwordAccount = !firebaseMode || auth?.currentUser?.providerData.some((provider) => provider.providerId === 'password');

  return (
    <div className="space-y-8 animate-fade-in">
      <PageHeader eyebrow="Account" title="Profile" description="Your details, password and plan." />

      <div className="grid grid-cols-1 gap-3 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          <Card className="p-6 sm:p-7">
            <div className="flex items-center gap-2"><UserRound size={17} aria-hidden="true" /><h2 className="text-[18px] font-medium tracking-tight1">Personal details</h2></div>
            <form onSubmit={handleSubmit(onProfileSave)} noValidate className="mt-6 space-y-4">
              {profileError && <Alert tone="error" icon={AlertCircle}>{profileError}</Alert>}
              <Field label="Full name" error={errors.name?.message}>
                <Input
                  autoComplete="name"
                  {...register('name', {
                    validate: (v) => v.trim().length >= 2 || 'Name must be at least 2 characters',
                    maxLength: { value: 50, message: 'Name must be 50 characters or fewer' },
                  })}
                />
              </Field>
              <Field label="Email" hint="Your email is your login and can’t be changed here.">
                <Input type="email" value={user?.email || ''} disabled readOnly />
              </Field>
              <div className="flex justify-end">
                <Button type="submit" variant="ink" loading={isSubmitting} disabled={!isDirty}>Save changes</Button>
              </div>
            </form>
          </Card>

          {user?.role === 'candidate' && <Card className="p-6 sm:p-7">
            <div className="flex items-center gap-2"><Trash2 size={17} aria-hidden="true" /><h2 className="text-[18px] font-medium">Delete account</h2></div>
            <p className="mt-3 text-[13.5px] text-muted">This removes your resumes, interviews and answers, and closes your paid pass. Payment records are retained without your contact details for reconciliation.</p>
            {showDelete ? (
              <form onSubmit={onDeleteAccount} className="mt-5 space-y-4">
                {deleteError && <Alert tone="error" icon={AlertCircle}>{deleteError}</Alert>}
                {passwordAccount && <Field label="Current password" hint="Enter your password to confirm account deletion.">
                  <PasswordInput autoComplete="current-password" required value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} />
                </Field>}
                <div className="flex flex-wrap gap-2">
                  <Button type="submit" variant="danger" loading={deleting} disabled={passwordAccount && !deletePassword}>Delete my account</Button>
                  <Button type="button" variant="soft" onClick={() => { setShowDelete(false); setDeletePassword(''); setDeleteError(''); }}>Cancel</Button>
                </div>
              </form>
            ) : <Button type="button" variant="soft" className="mt-5" onClick={() => setShowDelete(true)}>Delete account</Button>}
          </Card>}

          {passwordAccount && <Card className="p-6 sm:p-7">
            <div className="flex items-center gap-2"><KeyRound size={17} aria-hidden="true" /><h2 className="text-[18px] font-medium tracking-tight1">Change password</h2></div>
            <form onSubmit={handlePwd(onPasswordSave)} noValidate className="mt-6 space-y-4">
              {passwordError && <Alert tone="error" icon={AlertCircle}>{passwordError}</Alert>}
              <Field label="Current password" error={pwdErrors.currentPassword?.message}>
                <PasswordInput autoComplete="current-password" {...regPwd('currentPassword', { required: 'Enter your current password' })} />
              </Field>
              <div className="grid gap-4 sm:grid-cols-2">
                <Field label="New password" error={pwdErrors.newPassword?.message} hint="8+ characters with upper, lower and a number.">
                  <PasswordInput
                    autoComplete="new-password"
                    {...regPwd('newPassword', {
                      required: 'Choose a new password',
                      minLength: { value: 8, message: 'Use at least 8 characters' },
                      pattern: { value: PASSWORD_RULE, message: 'Include upper, lower case and a number' },
                    })}
                  />
                </Field>
                <Field label="Confirm new password" error={pwdErrors.confirmPassword?.message}>
                  <PasswordInput
                    autoComplete="new-password"
                    {...regPwd('confirmPassword', {
                      required: 'Confirm your new password',
                      validate: (v) => v === newPassword || 'Passwords don’t match',
                    })}
                  />
                </Field>
              </div>
              <div className="flex justify-end">
                <Button type="submit" variant="ink" loading={savingPwd}>Update password</Button>
              </div>
            </form>
          </Card>}
        </div>

        <aside className="space-y-3">
          <Card tone="ink" className="p-6">
            <Avatar name={user?.name} size={56} />
            <p className="mt-5 text-[22px] font-medium leading-tight tracking-tight1">{user?.name}</p>
            <p className="mt-1 break-all text-[13.5px] text-on-dark">{user?.email}</p>
            <dl className="mt-6 space-y-2.5 border-t border-ink-line pt-5 text-[14px]">
              <div className="flex justify-between"><dt className="text-on-dark">Member since</dt><dd>{formatDate(user?.createdAt)}</dd></div>
              <div className="flex justify-between"><dt className="text-on-dark">Sessions completed</dt><dd className="tabular">{user?.totalSessions ?? 0}</dd></div>
              <div className="flex justify-between"><dt className="text-on-dark">Account</dt><dd className="capitalize">{user?.role === 'candidate' ? 'Candidate' : user?.role?.replace('_', ' ')}</dd></div>
            </dl>
          </Card>

          <Card className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2"><CreditCard size={16} aria-hidden="true" /><p className="text-[16px] font-medium">Plan</p></div>
              <Pill tone={plan ? 'lime' : 'stone'} mono>{plan ? plan.name : 'Free'}</Pill>
            </div>
            {billing.isLoading ? (
              <div className="skeleton mt-4 h-10" />
            ) : allowance ? (
              <>
                <p className="mt-4 text-[14px]"><span className="font-medium tabular">{allowance.remaining}</span> of {allowance.limit} interviews left {plan ? 'on your pass' : 'this month'}</p>
                <ProgressBar className="mt-3" value={allowance.used} max={allowance.limit || 1} label="Interviews used" />
                {billing.data?.subscription?.currentPeriodEnd && (
                  <p className="mt-3 text-[12.5px] text-muted">Pass valid until {formatDate(billing.data.subscription.currentPeriodEnd)}</p>
                )}
              </>
            ) : (
              <p className="mt-4 text-[13.5px] text-muted">Plan details are unavailable right now.</p>
            )}
            <Button to="/pricing" variant="soft" size="sm" className="mt-5 w-full">Plans & billing</Button>
          </Card>
        </aside>
      </div>
    </div>
  );
}
