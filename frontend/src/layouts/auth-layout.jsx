import { Link, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { Logo, Segmented } from '@/components/ui';

/**
 * AuthLayout — the design's split screen:
 *  left: blue sky panel with floating "session" cards + tagline
 *  right: back link, Log in / Sign up segmented switch, form (<Outlet/>)
 */
export default function AuthLayout() {
  const { pathname, search } = useLocation();
  const navigate = useNavigate();
  const mode = pathname.startsWith('/register') ? 'signup' : 'signin';

  return (
    <div className="grid min-h-dvh grid-cols-1 gap-2.5 bg-paper p-2.5 lg:grid-cols-2">
      {/* ── Sky panel ───────────────────────────────────────── */}
      <section
        aria-hidden="false"
        className="relative flex flex-col overflow-hidden rounded-r28 bg-auth p-6 sm:p-7 lg:min-h-[560px]"
      >
        <div className="cloud -bottom-[6%] -left-[10%] h-[36%] w-[70%] blur-[8px]" />
        <div className="cloud bottom-[8%] -right-[14%] h-[28%] w-[60%] opacity-90 blur-[10px]" />

        <Logo tone="light" className="relative self-start" />

        <div className="relative hidden flex-1 flex-col items-center justify-center gap-3.5 py-10 [perspective:1200px] lg:flex">
          <div className="w-[min(100%,340px)] rounded-r20 bg-ink p-5 text-white shadow-[0_30px_60px_-28px_rgba(8,40,90,0.7)] [transform:rotateY(10deg)_rotateX(4deg)]">
            <div className="flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.06em] text-lime">
              <span className="h-1.5 w-1.5 rounded-full bg-lime" />
              Resuming · Question 4 of 8
            </div>
            <p className="mt-3 text-[18px] leading-[1.3] tracking-[-0.01em]">
              “Walk me through a time you changed a stakeholder’s mind with data.”
            </p>
          </div>
          <div className="flex w-[min(100%,300px)] items-center justify-between gap-3 rounded-r18 bg-white px-[18px] py-4 shadow-[0_26px_50px_-26px_rgba(8,40,90,0.6)] [transform:rotateY(-8deg)_translateX(40px)]">
            <div>
              <div className="font-mono text-[9.5px] uppercase tracking-[0.06em] text-muted">Last session</div>
              <div className="mt-1 text-[15px] font-medium">Product Analyst · Fintech</div>
            </div>
            <div className="text-[24px] font-medium tracking-tight3 text-brand-600">+1.2</div>
          </div>
        </div>

        <p className="relative mt-10 max-w-[440px] text-[26px] font-medium leading-[1.1] tracking-[-0.035em] text-ink lg:mt-0 lg:text-[clamp(26px,2.6vw,36px)]">
          Practice for the role you want, using the experience you have.
        </p>
      </section>

      {/* ── Form panel ──────────────────────────────────────── */}
      <section className="flex flex-col px-5 py-6 sm:px-[clamp(20px,5vw,72px)] sm:py-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <Link
            to="/"
            className="py-2 font-mono text-[11.5px] uppercase tracking-mono text-muted transition-colors hover:text-ink"
          >
            ← Back to site
          </Link>
          <Segmented
            ariaLabel="Choose log in or sign up"
            value={mode}
            onChange={(v) => navigate({ pathname: v === 'signin' ? '/login' : '/register', search })}
            options={[
              { value: 'signin', label: 'Log in' },
              { value: 'signup', label: 'Sign up' },
            ]}
          />
        </div>

        <div className="mx-auto flex w-full max-w-[420px] flex-1 flex-col justify-center py-10 sm:py-12">
          <Outlet />
        </div>
      </section>
    </div>
  );
}
