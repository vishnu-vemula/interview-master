import { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { SidebarContent } from '@/components/navigation/sidebar';
import { Logo } from '@/components/ui';
import RouteErrorBoundary from '@/components/common/route-error-boundary';

/**
 * DashboardLayout (app shell for signed-in candidates).
 *  - lg+: framed white sidebar card on the paper background (echoes the design's 10px frame + 28px radius)
 *  - < lg: sticky top bar with a slide-in drawer
 * Accepts children so public routes (e.g. /pricing) can render inside the shell when signed in.
 */
export default function DashboardLayout({ children }) {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();

  // Close drawer on navigation and on resize to desktop.
  useEffect(() => { setOpen(false); }, [pathname]);
  useEffect(() => {
    const onResize = () => { if (window.innerWidth >= 1024) setOpen(false); };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);
  useEffect(() => {
    document.body.style.overflow = open ? 'hidden' : '';
    return () => { document.body.style.overflow = ''; };
  }, [open]);

  return (
    <div className="min-h-dvh bg-paper lg:flex lg:gap-2.5 lg:p-2.5">
      {/* Desktop sidebar */}
      <aside className="sticky top-2.5 hidden h-[calc(100dvh-20px)] w-[264px] flex-shrink-0 rounded-r28 border border-line-2 bg-white p-3.5 lg:block">
        <SidebarContent />
      </aside>

      {/* Mobile top bar */}
      <header className="sticky top-0 z-40 flex items-center justify-between border-b border-line bg-paper/90 px-4 py-3 backdrop-blur-md lg:hidden">
        <Logo to="/dashboard" size={28} />
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Open menu"
          aria-expanded={open}
          className="grid h-10 w-10 place-items-center rounded-full border border-line bg-white text-ink"
        >
          <Menu size={18} />
        </button>
      </header>

      {/* Mobile drawer */}
      {open && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <div className="absolute inset-0 animate-fade-in bg-ink/40" onClick={() => setOpen(false)} aria-hidden="true" />
          <aside className="absolute inset-y-2.5 left-2.5 w-[min(300px,calc(100vw-20px))] animate-slide-up rounded-r28 bg-white p-3.5 shadow-pop">
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Close menu"
              className="absolute right-3 top-3 z-10 grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-stone hover:text-ink"
            >
              <X size={18} />
            </button>
            <SidebarContent onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}

      <main className="min-w-0 flex-1 px-4 pb-16 pt-6 sm:px-6 lg:px-8 lg:pb-12 lg:pt-8 xl:px-10">
        <div className="mx-auto w-full max-w-[1120px]">
          <RouteErrorBoundary key={pathname}>{children ?? <Outlet />}</RouteErrorBoundary>
        </div>
      </main>
    </div>
  );
}
