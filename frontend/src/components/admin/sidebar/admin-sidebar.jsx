/**
 * AdminSidebar — ink rail in the Rehearsly design language.
 *  - Grouped navigation filtered by the admin's permissions
 *  - Collapsible (icon-only) on desktop with hover tooltips
 */

import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard, Users, Briefcase, MessageSquare, FileText, History,
  ScanSearch, CreditCard, Wallet, BarChart3, Settings, LogOut, RefreshCw,
  Terminal, PenLine, Crown,
} from 'lucide-react';
import { useAdminAuth } from '@/context';
import { LogoMark } from '@/components/ui';
import { cn } from '@/utils';

export const ADMIN_NAV_GROUPS = [
  {
    label: 'Overview',
    items: [
      { to: '/admin', label: 'Dashboard', icon: LayoutDashboard, end: true },
      { to: '/admin/analytics', label: 'Analytics', icon: BarChart3, permission: 'view:analytics' },
    ],
  },
  {
    label: 'People & content',
    items: [
      { to: '/admin/users', label: 'Users', icon: Users, permission: 'view:users' },
      { to: '/admin/interviews', label: 'Interviews', icon: MessageSquare, permission: 'view:templates' },
      { to: '/admin/sessions', label: 'Sessions', icon: History, permission: 'view:templates' },
      { to: '/admin/resumes', label: 'Resumes', icon: FileText, permission: 'view:users' },
      { to: '/admin/ats', label: 'ATS pipeline', icon: ScanSearch, permission: 'view:templates' },
      { to: '/admin/jobs', label: 'Jobs', icon: Briefcase, permission: 'view:jobs' },
    ],
  },
  {
    label: 'Revenue',
    items: [
      { to: '/admin/subscription', label: 'Plans', icon: CreditCard, permission: 'view:settings' },
      { to: '/admin/payments', label: 'Payments', icon: Wallet, permission: 'view:payments' },
    ],
  },
  {
    label: 'System',
    items: [
      { to: '/admin/scraper', label: 'Job scraper', icon: RefreshCw, permission: 'view:scraper' },
      { to: '/admin/prompts', label: 'Prompt editor', icon: PenLine, permission: 'view:prompts' },
      { to: '/admin/logs', label: 'Audit logs', icon: Terminal, permission: 'view:logs' },
      { to: '/admin/settings', label: 'Settings', icon: Settings, permission: 'view:settings' },
    ],
  },
];

function NavItem({ to, label, icon: Icon, end, collapsed, onClick }) {
  return (
    <NavLink
      to={to}
      end={end}
      onClick={onClick}
      aria-label={collapsed ? label : undefined}
      title={collapsed ? label : undefined}
      className={({ isActive }) =>
        cn(
          'relative flex items-center gap-3 rounded-full px-3.5 py-2 text-[14px] transition-colors',
          collapsed && 'justify-center px-0',
          isActive ? 'bg-white/10 text-white' : 'text-on-dark hover:bg-white/5 hover:text-white',
        )
      }
    >
      {({ isActive }) => (
        <>
          <Icon size={17} className={cn('flex-shrink-0', isActive && 'text-lime')} aria-hidden="true" />
          {!collapsed && <span className="truncate">{label}</span>}
        </>
      )}
    </NavLink>
  );
}

export default function AdminSidebar({ collapsed = false, onNavClick }) {
  const { isSuperAdmin, adminLogout, hasPermission } = useAdminAuth();

  const handleLogout = async () => {
    await adminLogout();
    window.location.href = '/admin/login';
  };

  const groups = ADMIN_NAV_GROUPS
    .map((g) => ({ ...g, items: g.items.filter((i) => !i.permission || hasPermission(i.permission)) }))
    .filter((g) => g.items.length > 0);

  return (
    <div className="flex h-full flex-col text-white">
      <div className={cn('flex h-16 flex-shrink-0 items-center gap-2.5 px-3', collapsed && 'justify-center px-0')}>
        <LogoMark size={30} />
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-[17px] font-semibold leading-none tracking-tight1">Rehearsly</p>
            <p className="mt-1 flex items-center gap-1 font-mono text-[10px] uppercase tracking-mono text-lime">
              {isSuperAdmin && <Crown size={10} aria-hidden="true" />}
              {isSuperAdmin ? 'Super admin' : 'Admin console'}
            </p>
          </div>
        )}
      </div>

      <nav className="dark-scroll mt-2 flex-1 space-y-4 overflow-y-auto px-1" aria-label="Admin">
        {groups.map((group) => (
          <div key={group.label}>
            {collapsed ? (
              <div className="mx-3 mb-2 border-t border-ink-line" />
            ) : (
              <p className="mono-label mb-1.5 px-3.5 text-[10px] text-faint">{group.label}</p>
            )}
            <div className="space-y-0.5">
              {group.items.map((item) => (
                <NavItem key={item.to} {...item} collapsed={collapsed} onClick={onNavClick} />
              ))}
            </div>
          </div>
        ))}
      </nav>

      <div className="mt-2 flex-shrink-0 border-t border-ink-line pt-2">
        <button
          type="button"
          onClick={handleLogout}
          aria-label="Log out"
          className={cn(
            'flex w-full items-center gap-3 rounded-full px-3.5 py-2.5 text-[14px] text-on-dark transition-colors hover:bg-coral/15 hover:text-[#FFB59A]',
            collapsed && 'justify-center px-0',
          )}
        >
          <LogOut size={17} aria-hidden="true" />
          {!collapsed && 'Log out'}
        </button>
      </div>
    </div>
  );
}
