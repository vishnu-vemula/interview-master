/**
 * UserMenu — admin avatar menu (profile summary, settings, log out).
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ChevronDown, Crown, LogOut, Settings, Shield } from 'lucide-react';
import { useAdminAuth } from '@/context';
import { Dropdown, MenuItem, Pill } from '@/components/ui';
import { cn } from '@/utils';

const ROLE_LABELS = { super_admin: 'Super admin', admin: 'Admin', support: 'Support', content_manager: 'Content manager' };

export default function UserMenu() {
  const [loggingOut, setLoggingOut] = useState(false);
  const navigate = useNavigate();
  const { admin, isSuperAdmin, adminRole, adminLogout, hasPermission } = useAdminAuth();
  const initial = admin?.name?.[0]?.toUpperCase() ?? 'A';

  const handleLogout = async () => {
    setLoggingOut(true);
    await adminLogout();
    navigate('/admin/login');
  };

  return (
    <Dropdown
      trigger={({ toggle, open }) => (
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-label="Admin account menu"
          className="flex items-center gap-2.5 rounded-full border border-line bg-white py-1 pl-1 pr-3 transition-colors hover:border-ink"
        >
          <span className="grid h-8 w-8 place-items-center rounded-full bg-ink text-[13px] font-medium text-lime">{initial}</span>
          <span className="hidden text-left sm:block">
            <span className="block max-w-[120px] truncate text-[13px] font-medium leading-tight">{admin?.name ?? 'Admin'}</span>
            <span className="block font-mono text-[10px] uppercase tracking-mono text-muted">{ROLE_LABELS[adminRole] ?? 'Admin'}</span>
          </span>
          <ChevronDown size={14} className={cn('text-muted transition-transform', open && 'rotate-180')} />
        </button>
      )}
    >
      {({ close }) => (
        <div>
          <div className="border-b border-line-2 px-4 py-4">
            <p className="truncate text-[14px] font-medium">{admin?.name}</p>
            <p className="truncate text-[12.5px] text-muted">{admin?.email}</p>
            <Pill tone={isSuperAdmin ? 'lime' : 'stone'} mono icon={isSuperAdmin ? Crown : Shield} className="mt-3">
              {ROLE_LABELS[adminRole] ?? 'Admin'}
            </Pill>
          </div>
          <div className="py-1.5">
            {hasPermission('view:settings') && (
              <MenuItem icon={Settings} onClick={() => { close(); navigate('/admin/settings'); }}>
                Settings
              </MenuItem>
            )}
            <MenuItem icon={LogOut} tone="danger" onClick={handleLogout} disabled={loggingOut}>
              {loggingOut ? 'Logging out…' : 'Log out'}
            </MenuItem>
          </div>
        </div>
      )}
    </Dropdown>
  );
}
