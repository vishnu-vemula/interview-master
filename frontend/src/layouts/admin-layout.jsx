/**
 * AdminLayout — shell for all /admin pages.
 *  - Desktop: framed ink sidebar (collapsible, persisted) + sticky topbar + scrollable content
 *  - Mobile: topbar with menu button and a slide-in drawer
 */

import { Suspense, useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { ChevronsLeft, ChevronsRight } from 'lucide-react';

import AdminSidebar from '@/components/admin/sidebar/admin-sidebar';
import MobileDrawer from '@/components/admin/sidebar/mobile-drawer';
import AdminTopbar from '@/components/admin/topbar/admin-topbar';
import SuspenseLoader from '@/components/admin/suspense-loader';
import RouteErrorBoundary from '@/components/common/route-error-boundary';
import { cn } from '@/utils';

const getStored = (key, fallback) => {
  try {
    const v = localStorage.getItem(key);
    return v !== null ? JSON.parse(v) : fallback;
  } catch {
    return fallback;
  }
};

export default function AdminLayout() {
  const [collapsed, setCollapsed] = useState(() => getStored('admin-sidebar-collapsed', false));
  const [mobileOpen, setMobileOpen] = useState(false);
  const { pathname } = useLocation();

  useEffect(() => {
    localStorage.setItem('admin-sidebar-collapsed', JSON.stringify(collapsed));
  }, [collapsed]);

  useEffect(() => { setMobileOpen(false); }, [pathname]);
  useEffect(() => {
    const handler = () => { if (window.innerWidth >= 1024) setMobileOpen(false); };
    window.addEventListener('resize', handler);
    return () => window.removeEventListener('resize', handler);
  }, []);

  return (
    <div className="flex min-h-dvh bg-paper lg:p-2.5">
      <aside
        className={cn(
          'sticky top-2.5 hidden h-[calc(100dvh-20px)] flex-shrink-0 rounded-r28 bg-ink p-3 transition-[width] duration-300 lg:block',
          collapsed ? 'w-[80px]' : 'w-[256px]',
        )}
      >
        <AdminSidebar collapsed={collapsed} />
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          title={collapsed ? 'Expand' : 'Collapse'}
          className="absolute -right-3 top-[70px] z-10 grid h-6 w-6 place-items-center rounded-full border border-line bg-white text-muted shadow-card transition-colors hover:text-ink"
        >
          {collapsed ? <ChevronsRight size={13} /> : <ChevronsLeft size={13} />}
        </button>
      </aside>

      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        <AdminTopbar onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pt-8">
          <div className="mx-auto w-full max-w-[1400px]">
            <RouteErrorBoundary key={pathname} home="/admin" homeLabel="Admin dashboard">
              <Suspense fallback={<SuspenseLoader />}>
                <Outlet />
              </Suspense>
            </RouteErrorBoundary>
          </div>
        </main>
      </div>
    </div>
  );
}
