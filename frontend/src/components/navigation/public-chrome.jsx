import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/auth-store';
import { Button, Logo, LogoMark } from '@/components/ui';

const NAV_LINKS = [
  { href: '/#how', label: 'How it works' },
  { href: '/#feedback', label: 'Feedback' },
  { href: '/#progress', label: 'Jobs' },
  { href: '/pricing', label: 'Pricing', route: true },
];

/** Header for public pages that are not the landing hero (pricing, 404). Paper background, ink logo. */
export function PublicHeader() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  return (
    <header className="flex justify-center px-2.5 pt-2.5 sm:px-[18px] sm:pt-[18px]">
      <nav className="flex w-full max-w-page items-center justify-between gap-3 rounded-full border border-line-2 bg-white py-2 pl-4 pr-2 sm:gap-4 sm:pl-[18px]">
        <Logo />
        <div className="hidden items-center gap-1 font-mono text-[12px] uppercase tracking-mono md:flex">
          {NAV_LINKS.map((l) =>
            l.route ? (
              <Link key={l.href} to={l.href} className="rounded-full px-3.5 py-[9px] text-ink hover:bg-stone-2">
                {l.label}
              </Link>
            ) : (
              <a key={l.href} href={l.href} className="rounded-full px-3.5 py-[9px] text-ink hover:bg-stone-2">
                {l.label}
              </a>
            ),
          )}
        </div>
        <div className="flex items-center gap-1.5">
          {isAuthenticated ? (
            <Button to="/dashboard" variant="lime">Dashboard</Button>
          ) : (
            <>
              <Button to="/login" variant="ghost" className="hidden text-ink sm:inline-flex">Log in</Button>
              <Button to="/register" variant="lime" className="px-3.5 sm:px-[18px]">Start free</Button>
            </>
          )}
        </div>
      </nav>
    </header>
  );
}

/** Footer from the design; links point at real sections/routes. */
export function PublicFooter() {
  return (
    <footer className="container-page flex flex-wrap items-center justify-between gap-5 pb-[30px] pt-9 text-[14px] text-muted">
      <Link to="/" className="flex items-center gap-2.5 text-ink hover:text-ink">
        <LogoMark tone="footer" size={26} />
        <span className="font-semibold tracking-tight1">Rehearsly</span>
      </Link>
      <div className="flex flex-wrap gap-[22px]">
        <a href="/#privacy" className="text-muted hover:text-brand-600">Privacy</a>
        <a href="/#how" className="text-muted hover:text-brand-600">How it works</a>
        <a href="/#feedback" className="text-muted hover:text-brand-600">How we use AI</a>
        <Link to="/pricing" className="text-muted hover:text-brand-600">Pricing</Link>
      </div>
      <div>© {new Date().getFullYear()} Rehearsly</div>
    </footer>
  );
}

export default function PublicLayout({ children }) {
  return (
    <div className="flex min-h-dvh flex-col bg-paper">
      <PublicHeader />
      <main className="flex-1">{children}</main>
      <PublicFooter />
    </div>
  );
}
