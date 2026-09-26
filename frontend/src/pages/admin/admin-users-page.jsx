/**
 * AdminUsersPage — account management.
 *  - Search, role + status filters, server-side sort and pagination (GET /admin/users).
 *  - Profile drawer with counts, resumes and practice sessions (GET /admin/users/:id).
 *  - Edit modal (PATCH /admin/users/:id) — role changes are super-admin only server-side.
 *  - Single delete (DELETE /admin/users/:id, super admin only) and bulk
 *    activate / deactivate / ban / unban / delete (POST /admin/users/bulk, candidates only).
 *  - CSV export of the current page.
 */

import { useEffect, useRef, useState } from 'react';
import { keepPreviousData, useQuery, useQueryClient } from '@tanstack/react-query';
import toast from 'react-hot-toast';
import {
  Search, Download, RefreshCw, Eye, Edit3, Trash2, Star, UserCheck, UserX, Ban, ShieldCheck,
  ChevronDown, ArrowUpDown, ArrowUp, ArrowDown, FileText, ExternalLink, Minus, Plus, Users,
  MessageSquare, Lock,
} from 'lucide-react';
import {
  getAdminUsers, getAdminUser, updateAdminUser, deleteAdminUser, bulkAdminUsersAction,
} from '@/services/admin.service';
import { useAdminAuth } from '@/context';
import {
  Alert, Avatar, Button, Checkbox, Drawer, Dropdown, EmptyState, ErrorState, Field, Input, MenuItem,
  Modal, PageHeader, Pagination, Pill, ScorePill, Segmented, Select, Skeleton, Switch, TableShell, useConfirm,
} from '@/components/ui';
import { cn, formatDate, getErrorMessage, timeAgo } from '@/utils';

const ADMIN_EMAIL = 'admin@interviewmaster.com';
const PAGE_SIZE = 12;

const ROLE_OPTIONS = [
  { value: 'candidate', label: 'Candidate' },
  { value: 'support', label: 'Support' },
  { value: 'content_manager', label: 'Content manager' },
  { value: 'admin', label: 'Admin' },
  { value: 'super_admin', label: 'Super admin' },
];
const ROLE_LABEL = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label]));
const ROLE_TONE = { super_admin: 'ink', admin: 'blue', support: 'outline', content_manager: 'outline', candidate: 'stone' };

const STATUS_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'active', label: 'Active' },
  { value: 'inactive', label: 'Inactive' },
  { value: 'banned', label: 'Banned' },
  { value: 'premium', label: 'Premium' },
];

const SESSION_STATUS = {
  started: { tone: 'blue', label: 'Started' },
  in_progress: { tone: 'blue', label: 'In progress' },
  evaluating: { tone: 'stone', label: 'Evaluating' },
  evaluation_failed: { tone: 'coral', label: 'Evaluation failed' },
  completed: { tone: 'ok', label: 'Completed' },
  abandoned: { tone: 'stone', label: 'Abandoned' },
};

const PARSE_STATUS = {
  parsed: { tone: 'ok', label: 'Parsed' },
  pending: { tone: 'blue', label: 'Pending' },
  failed: { tone: 'coral', label: 'Failed' },
};

/** The platform super admin can never be deleted, banned or re-roled from this screen. */
const isProtectedUser = (u) => u?.email === ADMIN_EMAIL || u?.role === 'super_admin';

const formatBytes = (bytes) => {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
};

function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

function RolePill({ role }) {
  return <Pill tone={ROLE_TONE[role] || 'stone'} mono>{ROLE_LABEL[role] || 'Candidate'}</Pill>;
}

function StatusPill({ user }) {
  if (user?.isBanned) return <Pill tone="coral" mono>Banned</Pill>;
  return user?.isActive ? <Pill tone="ok" mono>Active</Pill> : <Pill tone="stone" mono>Inactive</Pill>;
}

function SortHeader({ field, label, sortBy, sortDir, onSort, className }) {
  const active = sortBy === field;
  const Icon = !active ? ArrowUpDown : sortDir === 'asc' ? ArrowUp : ArrowDown;
  return (
    <th className={className} aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : 'none'}>
      <button
        type="button"
        onClick={() => onSort(field)}
        className={cn('inline-flex items-center gap-1.5 uppercase transition-colors hover:text-ink', active && 'text-ink')}
      >
        {label}
        <Icon size={12} aria-hidden="true" />
      </button>
    </th>
  );
}

// ─── Profile drawer ────────────────────────────────────────────────
function DrawerSection({ title, count, children }) {
  return (
    <section>
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h3 className="text-[15px] font-medium tracking-tight1">{title}</h3>
        {count !== undefined && <span className="mono-label text-muted tabular">{count}</span>}
      </div>
      {children}
    </section>
  );
}

function UserDrawer({ userId, onClose, onEdit, onDelete, canDelete, deletingId }) {
  const { data, isLoading, isError, error, refetch } = useQuery({
    queryKey: ['admin-user', userId],
    queryFn: () => getAdminUser(userId),
    enabled: !!userId,
  });

  const user = data?.user;
  const resumes = user?.resumes ?? [];
  const sessions = user?.sessions ?? [];
  const deletable = !!user && canDelete && !isProtectedUser(user);

  return (
    <Drawer
      open={!!userId}
      onClose={onClose}
      title={user?.name || 'Account details'}
      subtitle={user?.email}
      footer={
        user && (
          <>
            <Button variant="ink" icon={Edit3} onClick={() => onEdit(user)}>
              Edit account
            </Button>
            {deletable && (
              <Button
                variant="danger"
                icon={Trash2}
                loading={deletingId === user._id}
                onClick={() => onDelete(user)}
                className="order-first mr-auto"
              >
                Delete
              </Button>
            )}
          </>
        )
      }
    >
      {isLoading ? (
        <div className="space-y-4" role="status" aria-label="Loading account">
          <Skeleton className="h-16 w-full rounded-r18" />
          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[0, 1, 2, 3].map((i) => <Skeleton key={i} className="h-20 rounded-r18" />)}
          </div>
          <Skeleton className="h-28 w-full rounded-r18" />
          <Skeleton className="h-40 w-full rounded-r18" />
        </div>
      ) : isError ? (
        <ErrorState
          compact
          title="Couldn’t load this account"
          description={getErrorMessage(error, 'The account service did not respond.')}
          onRetry={refetch}
        />
      ) : user ? (
        <div className="space-y-7">
          <div className="flex items-center gap-4 rounded-r18 border border-line-2 bg-white p-4">
            <Avatar name={user.name} size={48} tone={user.role === 'candidate' ? 'lime' : 'ink'} />
            <div className="flex min-w-0 flex-wrap gap-1.5">
              <RolePill role={user.role} />
              <StatusPill user={user} />
              {user.isPremium && <Pill tone="lime" mono icon={Star}>Premium</Pill>}
              {isProtectedUser(user) && <Pill tone="outline" mono icon={Lock}>Protected</Pill>}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ['Credits', user.credits ?? 0],
              ['Interviews', data.interviewCount ?? 0],
              ['Sessions', data.sessionCount ?? 0],
              ['Resumes', data.resumeCount ?? 0],
            ].map(([label, value]) => (
              <div key={label} className="rounded-r18 border border-line-2 bg-white p-4">
                <p className="mono-label text-muted">{label}</p>
                <p className="mt-2 text-[24px] font-medium leading-none tracking-tight2 tabular">{value}</p>
              </div>
            ))}
          </div>

          <DrawerSection title="Account">
            <dl className="divide-y divide-line-2 rounded-r18 border border-line-2 bg-white text-[14px]">
              {[
                ['Joined', formatDate(user.createdAt)],
                ['Last login', user.lastLogin ? `${formatDate(user.lastLogin)} · ${timeAgo(user.lastLogin)}` : 'Never'],
                ['Account ID', <span key="id" className="break-all font-mono text-[12px]">{user._id}</span>],
              ].map(([label, value]) => (
                <div key={label} className="flex items-start justify-between gap-4 px-4 py-3">
                  <dt className="text-muted">{label}</dt>
                  <dd className="min-w-0 text-right">{value}</dd>
                </div>
              ))}
            </dl>
          </DrawerSection>

          <DrawerSection title="Uploaded resumes" count={data.resumeCount ?? resumes.length}>
            {resumes.length === 0 ? (
              <p className="rounded-r18 border border-dashed border-line bg-white/60 px-4 py-5 text-center text-[13.5px] text-muted">
                No resumes uploaded yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {resumes.map((r) => {
                  const parse = PARSE_STATUS[r.parseStatus] || PARSE_STATUS.pending;
                  return (
                    <li key={r._id} className="flex items-center gap-3 rounded-r14 border border-line-2 bg-white px-3.5 py-3">
                      <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-r9 bg-stone-2">
                        <FileText size={15} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium" title={r.originalName || r.fileName}>
                          {r.originalName || r.fileName}
                        </p>
                        <p className="mt-0.5 font-mono text-[10.5px] uppercase tracking-mono text-muted">
                          {formatBytes(r.fileSize)} · {formatDate(r.createdAt)}
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                        <Pill tone={parse.tone} mono>{parse.label}</Pill>
                        {r.fileUrl && (
                          <a
                            href={`https://docs.google.com/viewer?url=${encodeURIComponent(r.fileUrl)}`}
                            target="_blank"
                            rel="noreferrer"
                            className="link inline-flex items-center gap-1 text-[12.5px]"
                          >
                            View <ExternalLink size={11} aria-hidden="true" />
                          </a>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </DrawerSection>

          <DrawerSection title="Practice sessions" count={data.sessionCount ?? sessions.length}>
            {sessions.length === 0 ? (
              <p className="rounded-r18 border border-dashed border-line bg-white/60 px-4 py-5 text-center text-[13.5px] text-muted">
                No interview sessions yet.
              </p>
            ) : (
              <ul className="space-y-2">
                {sessions.map((s) => {
                  const st = SESSION_STATUS[s.status] || { tone: 'stone', label: s.status || 'Unknown' };
                  return (
                    <li key={s._id} className="flex items-center gap-3 rounded-r14 border border-line-2 bg-white px-3.5 py-3">
                      <span className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-r9 bg-brand-50 text-brand-600">
                        <MessageSquare size={15} aria-hidden="true" />
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[14px] font-medium">{s.interviewId?.jobTitle || 'Mock interview'}</p>
                        <p className="mt-0.5 truncate font-mono text-[10.5px] uppercase tracking-mono text-muted">
                          {[s.interviewId?.company, formatDate(s.createdAt)].filter(Boolean).join(' · ')}
                        </p>
                      </div>
                      <div className="flex flex-shrink-0 flex-col items-end gap-1.5">
                        <Pill tone={st.tone} mono>{st.label}</Pill>
                        {s.overallScore !== null && s.overallScore !== undefined && <ScorePill score={s.overallScore} />}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </DrawerSection>
        </div>
      ) : null}
    </Drawer>
  );
}

// ─── Edit modal ────────────────────────────────────────────────────
function ToggleRow({ label, hint, checked, onChange, disabled }) {
  return (
    <div className={cn('flex items-center justify-between gap-4 rounded-r14 border border-line-2 bg-white px-4 py-3', disabled && 'bg-stone-2')}>
      <div className="min-w-0">
        <p className="text-[14px] font-medium">{label}</p>
        {hint && <p className="mt-0.5 text-[12.5px] leading-snug text-muted">{hint}</p>}
      </div>
      <Switch checked={checked} onChange={onChange} disabled={disabled} label={label} />
    </div>
  );
}

function EditUserModal({ user, canAssignRoles, onClose, onSaved }) {
  const locked = isProtectedUser(user);
  const [form, setForm] = useState(() => ({
    name: user.name ?? '',
    role: user.role ?? 'candidate',
    isActive: !!user.isActive,
    isBanned: !!user.isBanned,
    isPremium: !!user.isPremium,
    credits: String(user.credits ?? 10),
  }));
  const [errors, setErrors] = useState({});
  const [serverError, setServerError] = useState('');
  const [saving, setSaving] = useState(false);
  const set = (patch) => setForm((p) => ({ ...p, ...patch }));
  const credits = Number.parseInt(form.credits, 10);

  const validate = () => {
    const next = {};
    const name = form.name.trim();
    if (name.length < 2) next.name = 'Name must be at least 2 characters.';
    else if (name.length > 50) next.name = 'Name cannot exceed 50 characters.';
    if (!/^\d+$/.test(String(form.credits).trim())) next.credits = 'Enter a whole number of 0 or more.';
    return next;
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) return;

    const payload = {
      name: form.name.trim(),
      isActive: form.isActive,
      isBanned: form.isBanned,
      isPremium: form.isPremium,
      credits,
    };
    // The API rejects any `role` field from non-super admins, so only send it when it changed.
    if (form.role !== user.role) payload.role = form.role;

    setSaving(true);
    setServerError('');
    try {
      await updateAdminUser(user._id, payload);
      toast.success('Account changes saved.');
      onSaved?.();
      onClose();
    } catch (err) {
      const msg = getErrorMessage(err, 'Couldn’t save these changes.');
      setServerError(msg);
      toast.error(msg);
    } finally {
      setSaving(false);
    }
  };

  const creditsId = 'admin-edit-user-credits';

  return (
    <Modal
      open
      onClose={saving ? () => {} : onClose}
      title="Edit account"
      description={user.email}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={saving}>Cancel</Button>
          <Button type="submit" form="admin-edit-user" variant="ink" loading={saving}>Save changes</Button>
        </>
      }
    >
      <form id="admin-edit-user" onSubmit={handleSubmit} noValidate className="space-y-5">
        {serverError && <Alert tone="error" title="Changes not saved">{serverError}</Alert>}
        {locked && (
          <Alert tone="info" icon={Lock}>
            This is the protected super admin account. Role, active and ban status can’t be changed here.
          </Alert>
        )}

        <Field label="Full name" required error={errors.name}>
          <Input
            value={form.name}
            onChange={(e) => set({ name: e.target.value })}
            maxLength={50}
            autoComplete="off"
            data-autofocus
          />
        </Field>

        <Field
          label="Role"
          hint={locked ? undefined : !canAssignRoles ? 'Only a super admin can change roles.' : 'Staff roles grant access to this admin console.'}
        >
          <Select value={form.role} onChange={(e) => set({ role: e.target.value })} disabled={locked || !canAssignRoles}>
            {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
          </Select>
        </Field>

        <div className="field-label">
          <label htmlFor={creditsId}>Credits</label>
          <div className="flex items-center gap-2">
            <Button
              variant="soft"
              iconOnly
              icon={Minus}
              aria-label="Remove one credit"
              onClick={() => set({ credits: String(Math.max(0, (Number.isNaN(credits) ? 0 : credits) - 1)) })}
            />
            <Input
              id={creditsId}
              type="number"
              min={0}
              step={1}
              inputMode="numeric"
              value={form.credits}
              onChange={(e) => set({ credits: e.target.value })}
              invalid={!!errors.credits}
              aria-invalid={errors.credits ? true : undefined}
              aria-describedby={`${creditsId}-msg`}
              className="text-center tabular"
            />
            <Button
              variant="soft"
              iconOnly
              icon={Plus}
              aria-label="Add one credit"
              onClick={() => set({ credits: String((Number.isNaN(credits) ? 0 : credits) + 1) })}
            />
          </div>
          {errors.credits ? (
            <span id={`${creditsId}-msg`} role="alert" className="field-error-text">{errors.credits}</span>
          ) : (
            <span id={`${creditsId}-msg`} className="field-hint">Interview credits available to this account.</span>
          )}
        </div>

        <div className="space-y-2">
          <ToggleRow
            label="Account active"
            hint="Inactive accounts can’t sign in."
            checked={form.isActive}
            onChange={(v) => set({ isActive: v })}
            disabled={locked}
          />
          <ToggleRow
            label="Premium membership"
            hint="Grants the paid pass without a payment."
            checked={form.isPremium}
            onChange={(v) => set({ isPremium: v })}
          />
          <ToggleRow
            label="Banned"
            hint="Blocks access entirely. Banning also deactivates the account."
            checked={form.isBanned}
            onChange={(v) => setForm((p) => ({ ...p, isBanned: v, isActive: v ? false : p.isActive }))}
            disabled={locked}
          />
        </div>
      </form>
    </Modal>
  );
}

// ─── Page ──────────────────────────────────────────────────────────
export default function AdminUsersPage() {
  const confirm = useConfirm();
  const queryClient = useQueryClient();
  const { admin, isSuperAdmin } = useAdminAuth();
  const selfId = String(admin?._id ?? admin?.id ?? '');

  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [role, setRole] = useState('all');
  const [status, setStatus] = useState('all');
  const [sortBy, setSortBy] = useState('createdAt');
  const [sortDir, setSortDir] = useState('desc');
  const [selected, setSelected] = useState([]);
  const [drawerUserId, setDrawerUserId] = useState(null);
  const [editUser, setEditUser] = useState(null);
  const [deletingId, setDeletingId] = useState(null);
  const [bulkBusy, setBulkBusy] = useState(null);

  const debouncedSearch = useDebounced(search.trim(), 300);
  const params = { page, limit: PAGE_SIZE, search: debouncedSearch, role, status, sortBy, sortDir };

  const { data, isLoading, isFetching, isPlaceholderData, isError, error, refetch } = useQuery({
    queryKey: ['admin-users', params],
    queryFn: () => getAdminUsers(params),
    placeholderData: keepPreviousData,
  });

  const users = data?.users ?? [];
  const total = data?.total ?? 0;
  const totalPages = data?.pages ?? 0;

  // Selection is per result page — clear it whenever the result set changes.
  useEffect(() => { setSelected([]); }, [page, debouncedSearch, role, status, sortBy, sortDir]);

  // After deletions the current page can fall past the end.
  useEffect(() => {
    if (data && data.pages > 0 && page > data.pages) setPage(data.pages);
  }, [data, page]);

  // Bulk actions only ever apply to candidate accounts (enforced server-side), never to yourself.
  const isSelectable = (u) => u.role === 'candidate' && u.email !== ADMIN_EMAIL && String(u._id) !== selfId;
  const selectable = users.filter(isSelectable);
  const allSelected = selectable.length > 0 && selectable.every((u) => selected.includes(u._id));
  const someSelected = selected.length > 0 && !allSelected;

  const selectAllRef = useRef(null);
  useEffect(() => {
    if (selectAllRef.current) selectAllRef.current.indeterminate = someSelected;
  }, [someSelected]);

  const refreshUsers = () => {
    queryClient.invalidateQueries({ queryKey: ['admin-users'] });
    queryClient.invalidateQueries({ queryKey: ['admin-user'] });
  };

  const resetPage = () => setPage(1);

  const handleSort = (field) => {
    if (sortBy === field) {
      setSortDir((d) => (d === 'desc' ? 'asc' : 'desc'));
    } else {
      setSortBy(field);
      setSortDir('desc');
    }
    resetPage();
  };

  const toggleRow = (id) => setSelected((p) => (p.includes(id) ? p.filter((x) => x !== id) : [...p, id]));
  const toggleAll = (checked) => setSelected(checked ? selectable.map((u) => u._id) : []);

  const handleDelete = async (u) => {
    const ok = await confirm({
      title: 'Delete this account?',
      description: `${u.name} (${u.email}) will be permanently deleted along with their interviews, practice sessions and uploaded resumes. This can’t be undone.`,
      confirmLabel: 'Delete account',
      tone: 'danger',
    });
    if (!ok) return;
    setDeletingId(u._id);
    try {
      await deleteAdminUser(u._id);
      toast.success('Account permanently deleted.');
      if (drawerUserId === u._id) setDrawerUserId(null);
      setSelected((p) => p.filter((id) => id !== u._id));
      refreshUsers();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Couldn’t delete this account.'));
    } finally {
      setDeletingId(null);
    }
  };

  const BULK_CONFIRM = {
    deactivate: {
      title: 'Deactivate selected accounts?',
      description: 'They won’t be able to sign in until reactivated.',
      confirmLabel: 'Deactivate',
      tone: 'danger',
    },
    ban: {
      title: 'Ban selected accounts?',
      description: 'Banned candidates are blocked from Rehearsly until unbanned.',
      confirmLabel: 'Ban accounts',
      tone: 'danger',
    },
    delete: {
      title: 'Delete selected accounts?',
      description: 'Their interviews, practice sessions and uploaded resumes will be permanently deleted. This can’t be undone.',
      confirmLabel: 'Delete accounts',
      tone: 'danger',
    },
  };

  const runBulk = async (action) => {
    if (selected.length === 0) return;
    const n = selected.length;
    const opts = BULK_CONFIRM[action];
    if (opts && !(await confirm({ ...opts, title: opts.title.replace('selected accounts', `${n} ${n === 1 ? 'account' : 'accounts'}`) }))) return;
    setBulkBusy(action);
    try {
      const res = await bulkAdminUsersAction(action, selected);
      toast.success(res?.message || `Bulk ${action} completed.`);
      setSelected([]);
      refreshUsers();
    } catch (err) {
      toast.error(getErrorMessage(err, 'Bulk operation failed.'));
    } finally {
      setBulkBusy(null);
    }
  };

  // Export the accounts on the current page as CSV.
  const exportToCSV = () => {
    if (users.length === 0) {
      toast.error('No data available to export.');
      return;
    }
    const headers = ['ID', 'Name', 'Email', 'Role', 'Status', 'Premium', 'Credits', 'Sessions', 'Last Login'];
    const rows = users.map((u) => [
      u._id,
      u.name,
      u.email,
      u.role,
      u.isBanned ? 'Banned' : u.isActive ? 'Active' : 'Inactive',
      u.isPremium ? 'Yes' : 'No',
      u.credits ?? 10,
      u.totalSessions ?? 0,
      u.lastLogin ? new Date(u.lastLogin).toLocaleDateString() : 'Never',
    ]);
    const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [headers, ...rows].map((r) => r.map(esc).join(',')).join('\n');
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `candidates_export_${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const filtersActive = !!debouncedSearch || role !== 'all' || status !== 'all';
  const clearFilters = () => {
    setSearch('');
    setRole('all');
    setStatus('all');
    resetPage();
  };

  const from = total === 0 ? 0 : (page - 1) * PAGE_SIZE + 1;
  const to = Math.min(page * PAGE_SIZE, total);
  const COLS = 9;

  return (
    <div className="space-y-8">
      <PageHeader
        eyebrow="Admin · Users"
        title="User management"
        description="Search accounts, adjust roles, credits and access, and review each candidate’s practice history."
        actions={
          <>
            <Button variant="soft" icon={RefreshCw} onClick={() => refetch()} loading={isFetching && !isLoading}>
              Refresh
            </Button>
            <Button variant="ink" icon={Download} onClick={exportToCSV} title="Exports the accounts on this page">
              Export CSV
            </Button>
          </>
        }
      />

      <div className="space-y-5">
        {/* Toolbar */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <div className="min-w-0 flex-1 basis-[260px]">
              <Input
                icon={Search}
                type="search"
                value={search}
                onChange={(e) => { setSearch(e.target.value); resetPage(); }}
                placeholder="Search by name or email"
                aria-label="Search users by name or email"
              />
            </div>
            <Select
              aria-label="Filter by role"
              value={role}
              onChange={(e) => { setRole(e.target.value); resetPage(); }}
              className="sm:w-52"
            >
              <option value="all">All roles</option>
              {ROLE_OPTIONS.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
            </Select>
          </div>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <Segmented
              options={STATUS_OPTIONS}
              value={status}
              onChange={(v) => { setStatus(v); resetPage(); }}
              ariaLabel="Filter by account status"
            />
            <span className="mono-label text-muted tabular" aria-live="polite">
              {isLoading ? 'Loading…' : `${total} ${total === 1 ? 'account' : 'accounts'}`}
            </span>
          </div>
        </div>

        {/* Bulk action bar */}
        {selected.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 rounded-r18 bg-ink px-4 py-3 text-white">
            <span className="mono-label text-on-dark-bright tabular">{selected.length} selected</span>
            <Button variant="ghost" size="sm" className="text-on-dark hover:bg-ink-3 hover:text-white" onClick={() => setSelected([])}>
              Clear
            </Button>
            <Dropdown
              className="ml-auto"
              trigger={({ open, toggle }) => (
                <Button
                  variant="lime"
                  size="sm"
                  iconRight={ChevronDown}
                  onClick={toggle}
                  loading={!!bulkBusy}
                  aria-haspopup="menu"
                  aria-expanded={open}
                >
                  Bulk actions
                </Button>
              )}
            >
              {({ close }) => (
                <div className="py-1.5">
                  <MenuItem icon={UserCheck} onClick={() => { close(); runBulk('activate'); }}>Activate accounts</MenuItem>
                  <MenuItem icon={UserX} onClick={() => { close(); runBulk('deactivate'); }}>Deactivate accounts</MenuItem>
                  <div className="my-1.5 border-t border-line-2" />
                  <MenuItem icon={Ban} tone="danger" onClick={() => { close(); runBulk('ban'); }}>Ban accounts</MenuItem>
                  <MenuItem icon={ShieldCheck} onClick={() => { close(); runBulk('unban'); }}>Unban accounts</MenuItem>
                  <div className="my-1.5 border-t border-line-2" />
                  <MenuItem icon={Trash2} tone="danger" disabled={!isSuperAdmin} onClick={() => { close(); runBulk('delete'); }}>
                    {isSuperAdmin ? 'Delete accounts' : 'Delete (super admin only)'}
                  </MenuItem>
                </div>
              )}
            </Dropdown>
          </div>
        )}

        {/* Table */}
        {isError ? (
          <ErrorState
            title="Couldn’t load accounts"
            description={getErrorMessage(error, 'The accounts service did not respond.')}
            onRetry={refetch}
          />
        ) : !isLoading && users.length === 0 ? (
          <EmptyState
            icon={Users}
            title={filtersActive ? 'No accounts match these filters' : 'No accounts yet'}
            description={
              filtersActive
                ? 'Try a different name or email, or clear the role and status filters.'
                : 'Accounts appear here as soon as candidates sign up.'
            }
            action={filtersActive && <Button variant="soft" onClick={clearFilters}>Clear filters</Button>}
          />
        ) : (
          <>
            <TableShell minWidth={980} className={cn(isFetching && isPlaceholderData && 'opacity-60 transition-opacity')}>
              <thead>
                <tr>
                  <th className="w-12">
                    <Checkbox
                      ref={selectAllRef}
                      checked={allSelected}
                      onChange={(e) => toggleAll(e.target.checked)}
                      disabled={selectable.length === 0}
                      aria-label="Select all candidate accounts on this page"
                    />
                  </th>
                  <SortHeader field="name" label="User" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <th>Role</th>
                  <th>Status</th>
                  <th>Credits</th>
                  <th>Sessions</th>
                  <SortHeader field="createdAt" label="Joined" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <SortHeader field="lastLogin" label="Last login" sortBy={sortBy} sortDir={sortDir} onSort={handleSort} />
                  <th className="text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {isLoading
                  ? Array.from({ length: 6 }).map((_, i) => (
                    <tr key={i}>
                      <td><Skeleton className="h-[18px] w-[18px] rounded-[5px]" /></td>
                      <td>
                        <div className="flex items-center gap-3">
                          <Skeleton className="h-[34px] w-[34px] flex-shrink-0 rounded-full" />
                          <div className="space-y-1.5">
                            <Skeleton className="h-3.5 w-32" />
                            <Skeleton className="h-3 w-44" />
                          </div>
                        </div>
                      </td>
                      {Array.from({ length: COLS - 3 }).map((__, j) => (
                        <td key={j}><Skeleton className="h-4 w-16" /></td>
                      ))}
                      <td><Skeleton className="ml-auto h-8 w-24 rounded-full" /></td>
                    </tr>
                  ))
                  : users.map((u) => {
                    const protectedUser = isProtectedUser(u);
                    const selectableRow = isSelectable(u);
                    const checked = selected.includes(u._id);
                    return (
                      <tr key={u._id} className={cn(checked && 'bg-brand-50/70')}>
                        <td>
                          <span title={selectableRow ? undefined : 'Bulk actions apply to candidate accounts only'}>
                            <Checkbox
                              checked={checked}
                              onChange={() => toggleRow(u._id)}
                              disabled={!selectableRow}
                              aria-label={`Select ${u.name}`}
                              className={cn(!selectableRow && 'cursor-not-allowed opacity-40')}
                            />
                          </span>
                        </td>
                        <td>
                          <button
                            type="button"
                            onClick={() => setDrawerUserId(u._id)}
                            className="group flex min-w-0 items-center gap-3 text-left"
                          >
                            <Avatar name={u.name} size={34} tone={u.role === 'candidate' ? 'lime' : 'ink'} />
                            <span className="min-w-0">
                              <span className="flex items-center gap-1.5 font-medium transition-colors group-hover:text-brand-600">
                                <span className="max-w-[220px] truncate">{u.name}</span>
                                {u.isPremium && (
                                  <>
                                    <Star size={12} className="flex-shrink-0 fill-lime text-lime-ok" aria-hidden="true" />
                                    <span className="sr-only">Premium</span>
                                  </>
                                )}
                              </span>
                              <span className="block max-w-[240px] truncate text-[12.5px] text-muted">{u.email}</span>
                            </span>
                          </button>
                        </td>
                        <td><RolePill role={u.role} /></td>
                        <td><StatusPill user={u} /></td>
                        <td className="tabular">{u.credits ?? 10}</td>
                        <td className="tabular">{u.totalSessions ?? 0}</td>
                        <td className="whitespace-nowrap text-[13px] text-muted">{formatDate(u.createdAt)}</td>
                        <td className="whitespace-nowrap text-[13px] text-muted" title={u.lastLogin ? formatDate(u.lastLogin) : undefined}>
                          {u.lastLogin ? timeAgo(u.lastLogin) : 'Never'}
                        </td>
                        <td>
                          <div className="flex items-center justify-end gap-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              iconOnly
                              icon={Eye}
                              title="View profile & activity"
                              aria-label={`View ${u.name}`}
                              onClick={() => setDrawerUserId(u._id)}
                            />
                            <Button
                              variant="ghost"
                              size="sm"
                              iconOnly
                              icon={Edit3}
                              title="Edit account"
                              aria-label={`Edit ${u.name}`}
                              onClick={() => setEditUser(u)}
                            />
                            {isSuperAdmin && !protectedUser && (
                              <Button
                                variant="ghost"
                                size="sm"
                                iconOnly
                                icon={Trash2}
                                title="Delete account"
                                aria-label={`Delete ${u.name}`}
                                loading={deletingId === u._id}
                                className="hover:bg-coral-soft hover:text-coral"
                                onClick={() => handleDelete(u)}
                              />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
              </tbody>
            </TableShell>

            {!isLoading && totalPages > 1 && (
              <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
                <p className="mono-label text-muted tabular">Showing {from}–{to} of {total}</p>
                <Pagination page={page} totalPages={totalPages} onPageChange={setPage} disabled={isFetching} />
              </div>
            )}
          </>
        )}
      </div>

      <UserDrawer
        userId={drawerUserId}
        onClose={() => setDrawerUserId(null)}
        onEdit={(u) => setEditUser(u)}
        onDelete={handleDelete}
        canDelete={isSuperAdmin}
        deletingId={deletingId}
      />

      {editUser && (
        <EditUserModal
          key={editUser._id}
          user={editUser}
          canAssignRoles={isSuperAdmin}
          onClose={() => setEditUser(null)}
          onSaved={refreshUsers}
        />
      )}
    </div>
  );
}
