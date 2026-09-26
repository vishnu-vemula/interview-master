import { Link, NavLink, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, ClipboardList, History, FileText, Briefcase, Sparkles,
  UserRound, CreditCard, LogOut, Plus,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { useQueryClient } from '@tanstack/react-query';
import { useAuthStore } from '@/store/auth-store';
import { useBillingMe } from '@/hooks/use-billing';
import { Avatar, Button, Logo, ProgressBar } from '@/components/ui';
import { cn } from '@/utils';

export const NAV_GROUPS = [
  {
    label: 'Practice',
    items: [
      { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard', end: true },
      { to: '/interviews', icon: ClipboardList, label: 'Interviews', end: true },
      { to: '/sessions', icon: History, label: 'History' },
    ],
  },
  {
    label: 'Prepare',
    items: [
      { to: '/resumes', icon: FileText, label: 'Resumes' },
      { to: '/jobs', icon: Briefcase, label: 'Job board', end: true },
      { to: '/jobs/recommended', icon: Sparkles, label: 'Recommended' },
    ],
  },
  {
    label: 'Account',
    items: [
      { to: '/profile', icon: UserRound, label: 'Profile' },
      { to: '/pricing', icon: CreditCard, label: 'Plans & billing' },
    ],
  },
];

function UsageCard({ onNavigate }) {
  const { data, isLoading, isError } = useBillingMe();
  const allowance = data?.allowance;
  const plan = data?.subscription?.planId;

  if (isError) return null;

  return (
    <div className="rounded-r20 bg-stone p-4">
      <div className="flex items-center justify-between gap-2">
        <span className="mono-label text-muted">{plan ? `${plan.name} pass` : 'Free plan'}</span>
        {allowance && (
          <span className="font-mono text-[11px] text-muted tabular">
            {allowance.used}/{allowance.limit}
          </span>
        )}
      </div>
      {isLoading ? (
        <div className="mt-3 space-y-2">
          <div className="skeleton h-4 w-3/4" />
          <div className="skeleton h-2 w-full" />
        </div>
      ) : allowance ? (
        <>
          <p className="mt-2 text-[14px] leading-snug">
            <span className="font-medium tabular">{allowance.remaining}</span> interview
            {allowance.remaining === 1 ? '' : 's'} left {plan ? 'on this pass' : 'this month'}
          </p>
          <ProgressBar
            className="mt-3"
            value={allowance.used}
            max={allowance.limit || 1}
            tone={allowance.remaining === 0 ? 'coral' : 'blue'}
            label="Interview allowance used"
          />
          {!plan && (
            <Link
              to="/pricing"
              onClick={onNavigate}
              className="mt-3 inline-flex font-mono text-[10.5px] uppercase tracking-mono text-brand-600 hover:text-ink"
            >
              See passes ↗
            </Link>
          )}
        </>
      ) : null}
    </div>
  );
}

export function SidebarContent({ onNavigate }) {
  const { user, logout } = useAuthStore();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const handleLogout = () => {
    logout();
    queryClient.clear();
    toast.success('Logged out');
    navigate('/login');
  };

  return (
    <div className="flex h-full flex-col">
      <div className="px-3 pb-5 pt-2">
        <Logo to="/dashboard" onClick={onNavigate} />
      </div>

      <div className="px-1">
        <Button to="/interviews/new" variant="lime" icon={Plus} className="w-full" onClick={onNavigate}>
          New interview
        </Button>
      </div>

      <nav className="mt-6 flex-1 space-y-6 overflow-y-auto px-1 scroll-thin" aria-label="Main">
        {NAV_GROUPS.map((group) => (
          <div key={group.label}>
            <p className="mono-label mb-2 px-3 text-faint">{group.label}</p>
            <ul className="space-y-0.5">
              {group.items.map(({ to, icon: Icon, label, end }) => (
                <li key={to}>
                  <NavLink
                    to={to}
                    end={end}
                    onClick={onNavigate}
                    className={({ isActive }) =>
                      cn(
                        'flex items-center gap-3 rounded-full px-3.5 py-2.5 text-[14.5px] transition-colors',
                        isActive ? 'bg-ink text-white' : 'text-muted-strong hover:bg-stone-2 hover:text-ink',
                      )
                    }
                  >
                    {({ isActive }) => (
                      <>
                        <Icon size={17} className={isActive ? 'text-lime' : ''} aria-hidden="true" />
                        <span className="flex-1">{label}</span>
                      </>
                    )}
                  </NavLink>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </nav>

      <div className="mt-4 space-y-3 px-1">
        <UsageCard onNavigate={onNavigate} />
        <div className="flex items-center gap-3 rounded-r18 px-2 py-1.5">
          <Avatar name={user?.name} size={36} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[14px] font-medium">{user?.name}</p>
            <p className="truncate text-[12px] text-muted">{user?.email}</p>
          </div>
          <button
            type="button"
            onClick={handleLogout}
            aria-label="Log out"
            title="Log out"
            className="grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-coral-soft hover:text-coral"
          >
            <LogOut size={17} />
          </button>
        </div>
      </div>
    </div>
  );
}

export default SidebarContent;
