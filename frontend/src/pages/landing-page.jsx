import { Fragment, useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Menu, X } from 'lucide-react';
import { useAuthStore } from '@/store/auth-store';
import { usePlans } from '@/hooks/use-billing';
import { Logo } from '@/components/ui';
import { PublicFooter } from '@/components/navigation/public-chrome';
import { cn, formatINR } from '@/utils';

const SECTION_LINKS = [
  { href: '#how', label: 'How it works' },
  { href: '#feedback', label: 'Feedback' },
  { href: '#progress', label: 'Jobs' },
  { href: '#pricing', label: 'Pricing' },
];

function useWindowWidth() {
  const [w, setW] = useState(() => (typeof window === 'undefined' ? 1400 : window.innerWidth));
  useEffect(() => {
    const on = () => setW(window.innerWidth);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return w;
}

const mono = 'font-mono uppercase tracking-mono';

/* ── Hero nav (glass pill) ───────────────────────────────────────── */
function HeroNav({ isAuthenticated }) {
  const [open, setOpen] = useState(false);
  return (
    <header className="relative z-10 flex justify-center px-[18px] pt-[18px]">
      <nav className="glass-nav relative flex w-full max-w-page items-center justify-between gap-4 rounded-full py-2 pl-[18px] pr-2">
        <Logo tone="light" />
        <div className={cn('hidden flex-wrap items-center justify-center gap-1 text-[12px] md:flex', mono)}>
          {SECTION_LINKS.map((l) => (
            <a key={l.href} href={l.href} className="rounded-full px-3.5 py-[9px] text-white hover:bg-white/15 hover:text-white">
              {l.label}
            </a>
          ))}
        </div>
        <div className="flex items-center gap-1.5">
          {isAuthenticated ? (
            <Link to="/dashboard" className={cn('whitespace-nowrap rounded-full bg-lime px-3.5 py-[11px] text-[11.5px] font-medium text-ink hover:bg-lime-hover hover:text-ink sm:px-[18px] sm:text-[12px]', mono)}>
              Dashboard
            </Link>
          ) : (
            <>
              <Link to="/login" className={cn('hidden rounded-full px-4 py-[11px] text-[12px] text-white hover:bg-white/15 hover:text-white sm:inline-flex', mono)}>
                Log in
              </Link>
              <Link to="/register" className={cn('whitespace-nowrap rounded-full bg-lime px-3.5 py-[11px] text-[11.5px] font-medium text-ink hover:bg-lime-hover hover:text-ink sm:px-[18px] sm:text-[12px]', mono)}>
                Start free
              </Link>
            </>
          )}
          <button
            type="button"
            onClick={() => setOpen((o) => !o)}
            aria-label={open ? 'Close menu' : 'Open menu'}
            aria-expanded={open}
            className="grid h-10 w-10 place-items-center rounded-full text-white hover:bg-white/15 md:hidden"
          >
            {open ? <X size={18} /> : <Menu size={18} />}
          </button>
        </div>

        {open && (
          <div className="absolute inset-x-0 top-[calc(100%+8px)] animate-pop-in rounded-r24 bg-white p-2 shadow-float md:hidden">
            {SECTION_LINKS.map((l) => (
              <a key={l.href} href={l.href} onClick={() => setOpen(false)} className={cn('block rounded-r14 px-4 py-3 text-[12px] text-ink hover:bg-stone-2', mono)}>
                {l.label}
              </a>
            ))}
            {!isAuthenticated && (
              <Link to="/login" className={cn('block rounded-r14 px-4 py-3 text-[12px] text-ink hover:bg-stone-2', mono)}>
                Log in
              </Link>
            )}
          </div>
        )}
      </nav>
    </header>
  );
}

/* ── Arc of product cards (decorative illustration from the design) ── */
function ProductArc({ scale }) {
  const label = 'font-mono uppercase tracking-[0.06em]';
  return (
    <div
      aria-hidden="true"
      className="relative z-[2] flex min-h-[220px] flex-1 items-end justify-center pb-7 pt-8 [perspective:1500px] sm:min-h-[360px] sm:pt-14"
    >
      <div className="flex items-center gap-3.5 [transform-style:preserve-3d]" style={{ transform: `scale(${scale})`, transformOrigin: '50% 100%' }}>
        {/* Streak */}
        <div className="h-[170px] w-[120px] flex-shrink-0 rounded-[14px] bg-white/[0.92] p-3 shadow-float-sm" style={{ transform: 'rotateY(38deg) translateZ(-60px)' }}>
          <div className={cn(label, 'text-[8.5px] text-muted')}>Streak</div>
          <div className="mt-1.5 text-[28px] font-medium tracking-tight3">9<span className="text-[13px] text-muted"> days</span></div>
          <div className="mt-3.5 grid grid-cols-5 gap-1">
            {['#1B82EC', '#1B82EC', '#9ACDF8', '#1B82EC', '#1B82EC', '#9ACDF8', '#1B82EC', '#1B82EC', '#1B82EC', '#E3E6EA'].map((c, i) => (
              <div key={i} className="aspect-square rounded-[3px]" style={{ background: c }} />
            ))}
          </div>
        </div>

        {/* Resume parsed */}
        <div className="flex h-[220px] w-[170px] flex-shrink-0 flex-col gap-2 rounded-r18 bg-white p-3.5 shadow-float-sm" style={{ transform: 'rotateY(26deg) translateZ(-20px)', borderRadius: 16 }}>
          <div className={cn(label, 'text-[9px] text-muted')}>Resume · parsed</div>
          <div className="text-[14px] font-semibold tracking-[-0.01em]">Priya Raman</div>
          <div className="h-px bg-line-3" />
          <div className="flex flex-col gap-1.5 text-[11px] text-ink-soft">
            {['Led checkout redesign', 'SQL · Looker', 'A/B testing'].map((t) => (
              <div key={t} className="flex justify-between"><span>{t}</span><span className="text-brand-600">●</span></div>
            ))}
            <div className="flex justify-between text-faint"><span>Mentored 2 interns</span><span>○</span></div>
          </div>
          <div className="mt-auto text-[10px] text-muted">4 experiences matched</div>
        </div>

        {/* Question */}
        <div className="flex h-[250px] w-[190px] flex-shrink-0 flex-col rounded-r18 bg-ink p-4 text-white shadow-float-lg" style={{ transform: 'rotateY(14deg)' }}>
          <div className={cn(label, 'flex items-center gap-1.5 text-[9px] text-lime')}>
            <span className="h-1.5 w-1.5 rounded-full bg-lime" />Question 3 of 8
          </div>
          <div className="mt-3.5 text-[16px] leading-[1.3] tracking-[-0.01em]">“Tell me about the checkout redesign. How did you decide what to test first?”</div>
          <div className="mt-auto flex gap-1.5">
            <span className="rounded-full bg-white/10 px-[9px] py-[5px] text-[10px]">Behavioral</span>
            <span className="rounded-full bg-white/10 px-[9px] py-[5px] text-[10px]">From resume</span>
          </div>
        </div>

        {/* Feedback (center) */}
        <div className="flex h-[290px] w-[250px] flex-shrink-0 flex-col gap-3 rounded-r20 bg-white p-[18px] shadow-float-lg" style={{ transform: 'translateZ(30px)' }}>
          <div className="flex items-center justify-between">
            <div className={cn(label, 'text-[9.5px] text-muted')}>Answer feedback</div>
            <span className="rounded-full bg-brand-50 px-2 py-1 text-[10px] text-brand-600">Practice score</span>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-[40px] font-medium tracking-tight2">7.4</span>
            <span className="text-[13px] text-muted">/10 · +1.2 vs last try</span>
          </div>
          <div className="flex flex-col gap-2 text-[12px]">
            <div className="flex items-start gap-2"><span className="grid h-4 w-4 flex-shrink-0 place-items-center rounded-full bg-lime text-[9px]">✓</span><span><b className="font-semibold">Convincing:</b> clear situation and your role</span></div>
            <div className="flex items-start gap-2"><span className="grid h-4 w-4 flex-shrink-0 place-items-center rounded-full bg-coral-bg text-[9px] text-coral">!</span><span><b className="font-semibold">Lacked evidence:</b> no result metric</span></div>
            <div className="flex items-start gap-2"><span className="grid h-4 w-4 flex-shrink-0 place-items-center rounded-full bg-brand-100 text-[9px] text-brand-600">→</span><span><b className="font-semibold">Next try:</b> name the conversion lift</span></div>
          </div>
          <div className="mt-auto grid grid-cols-4 gap-1">
            {[1, 1, 1, 0].map((on, i) => <div key={i} className={cn('h-[5px] rounded-[3px]', on ? 'bg-brand' : 'bg-[#E3E6EA]')} />)}
          </div>
          <div className={cn(label, 'flex justify-between text-[8.5px] tracking-[0.05em] text-faint')}>
            <span>Situation</span><span>Task</span><span>Action</span><span>Result</span>
          </div>
        </div>

        {/* Speaking */}
        <div className="flex h-[250px] w-[190px] flex-shrink-0 flex-col rounded-r18 border border-white/35 bg-blue-card p-4 text-white shadow-float-lg" style={{ transform: 'rotateY(-14deg)' }}>
          <div className={cn(label, 'text-[9px] text-[#E6F2FF]')}>Speaking…</div>
          <div className="mt-4 flex h-11 items-center gap-[3px]">
            {[14, 28, 40, 22, 34, 18, 30, 12, 26, 36, 16, 24, 10, 8].map((h, i) => (
              <div
                key={i}
                className="w-1 origin-center animate-wave rounded-sm"
                style={{
                  height: h,
                  background: i === 11 ? '#D7F94B' : i > 11 ? 'rgba(255,255,255,0.5)' : '#fff',
                  animationDelay: `${(i % 7) * 0.12}s`,
                }}
              />
            ))}
          </div>
          <div className="mt-3.5 text-[12px] leading-[1.4]">“…so I started with the shipping step, because that’s where most people dropped off.”</div>
          <div className="mt-auto text-[10px] text-[#E6F2FF]">01:42 · follow-up ready</div>
        </div>

        {/* Progress */}
        <div className="flex h-[220px] w-[170px] flex-shrink-0 flex-col bg-white p-3.5 shadow-float-sm" style={{ transform: 'rotateY(-26deg) translateZ(-20px)', borderRadius: 16 }}>
          <div className={cn(label, 'text-[9px] text-muted')}>Progress · 6 sessions</div>
          <div className="mt-3 flex flex-1 items-end gap-[7px]">
            {[['30%', '#DCEBFF'], ['42%', '#DCEBFF'], ['38%', '#9ACDF8'], ['58%', '#9ACDF8'], ['66%', '#1B82EC'], ['84%', '#1B82EC']].map(([h, c], i) => (
              <div key={i} className="flex-1 rounded" style={{ height: h, background: c }} />
            ))}
          </div>
          <div className="mt-2.5 text-[11px] text-ink-soft">Results in answers: <b className="font-semibold">up 3 sessions in a row</b></div>
        </div>

        {/* Role match */}
        <div className="flex h-[170px] w-[120px] flex-shrink-0 flex-col rounded-[14px] bg-lime p-3 shadow-float-sm" style={{ transform: 'rotateY(-38deg) translateZ(-60px)' }}>
          <div className={cn(label, 'text-[8.5px] text-lime-ink')}>Role match</div>
          <div className="mt-1.5 text-[28px] font-medium tracking-tight3">82%</div>
          <div className="mt-auto text-[10.5px] leading-[1.35]">Product Analyst · Fintech</div>
        </div>
      </div>
    </div>
  );
}

function Dot({ tone = 'ink' }) {
  return <span className={cn('h-[5px] w-[5px] rounded-full', tone === 'lime' ? 'bg-lime' : 'bg-ink')} />;
}

function SectionEyebrow({ children, tone = 'ink', center = false }) {
  return (
    <div className={cn('flex items-center gap-2 font-mono text-[11.5px] uppercase tracking-eyebrow', center && 'justify-center', tone === 'lime' && 'text-lime')}>
      <Dot tone={tone} />{children}
    </div>
  );
}

/* ── Pricing (free allowance + real published passes) ───────────── */
function PricingSection({ isAuthenticated }) {
  const { data: plans, isLoading, isError } = usePlans();
  const plan = plans?.[0];
  const planHref = isAuthenticated ? '/pricing' : '/register?next=%2Fpricing';

  return (
    <section id="pricing" data-screen-label="Pricing" className="mx-auto max-w-page scroll-mt-6 px-6 pb-[120px]">
      <div className="text-center">
        <SectionEyebrow center>Pricing</SectionEyebrow>
        <h2 className="mt-[18px] text-[clamp(34px,4vw,54px)] font-medium leading-[1.05] tracking-tight2">Start free. Upgrade when you’re interviewing.</h2>
      </div>
      <div className="mx-auto mt-[50px] grid max-w-[860px] grid-cols-[repeat(auto-fit,minmax(min(100%,320px),1fr))] gap-3.5">
        <div className="flex flex-col rounded-r24 border border-line-2 bg-white p-[30px]">
          <div className="text-[16px] font-medium">Free</div>
          <div className="mt-3.5 text-[48px] font-medium tracking-tight2">₹0</div>
          <div className="mt-[22px] flex flex-col gap-2.5 text-[14.5px] text-ink-soft">
            <div>✓ 2 tailored interviews / month</div>
            <div>✓ Per-answer feedback</div>
            <div>✓ Text and voice answers</div>
          </div>
          <Link
            to={isAuthenticated ? '/dashboard' : '/register'}
            className={cn('mt-auto block rounded-full border border-ink bg-white p-[15px] text-center text-[12px] text-ink hover:bg-ink hover:text-white', mono)}
            style={{ marginTop: 30 }}
          >
            {isAuthenticated ? 'Open dashboard' : 'Create free account'}
          </Link>
        </div>

        <div className="flex flex-col rounded-r24 bg-ink p-[30px] text-white">
          <div className="flex items-center justify-between gap-3">
            <div className="text-[16px] font-medium">{plan?.name || 'Pro pass'}</div>
            <span className={cn('rounded-full bg-lime px-[9px] py-[5px] text-[10.5px] text-ink', mono)}>For active job searches</span>
          </div>
          {isLoading ? (
            <div className="mt-4 h-12 w-40 animate-pulse rounded-lg bg-white/10" />
          ) : plan ? (
            <div className="mt-3.5 text-[48px] font-medium tracking-tight2">
              {formatINR(plan.amountMinor / 100)}
              <span className="text-[16px] tracking-normal text-on-dark"> / {plan.durationDays} days</span>
            </div>
          ) : (
            <div className="mt-3.5 text-[20px] font-medium leading-snug tracking-tight1 text-on-dark-soft">
              {isError ? 'Pass pricing is unavailable right now.' : 'Paid passes appear here once they’re published.'}
            </div>
          )}
          <div className="mt-[22px] flex flex-col gap-2.5 text-[14.5px] text-on-dark-bright">
            {plan ? (
              <>
                <div>✓ {plan.credits} tailored interviews on the pass</div>
                {(plan.features || []).slice(0, 3).map((f) => <div key={f}>✓ {f}</div>)}
              </>
            ) : (
              <>
                <div>✓ More tailored interviews</div>
                <div>✓ Deeper feedback on every answer</div>
                <div>✓ Full progress history and job matching</div>
              </>
            )}
          </div>
          <Link
            to={planHref}
            className={cn('block rounded-full bg-lime p-[15px] text-center text-[12px] font-medium text-ink hover:bg-lime-hover hover:text-ink', mono)}
            style={{ marginTop: 30 }}
          >
            {plans && plans.length > 1 ? 'Compare passes' : 'Go Pro'}
          </Link>
        </div>
      </div>
    </section>
  );
}

export default function LandingPage() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const width = useWindowWidth();
  const arcScale = Math.max(0.45, Math.min(1, (width - 20) / 1260));
  const { hash } = useLocation();
  const primaryTo = isAuthenticated ? '/interviews/new' : '/register';

  // Support deep links such as /#pricing from other pages.
  useEffect(() => {
    if (!hash) return;
    const t = setTimeout(() => document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth' }), 60);
    return () => clearTimeout(t);
  }, [hash]);

  return (
    <div className="overflow-x-hidden bg-paper text-ink">
      {/* ── HERO (full-bleed: edge to edge, full viewport height) ── */}
      <section data-screen-label="Hero" className="relative flex min-h-dvh w-full flex-col overflow-hidden bg-hero">
        <div className="cloud bottom-[4%] left-[-8%] h-[34%] w-[48%] blur-[8px]" />
        <div className="cloud bottom-[10%] right-[-10%] h-[30%] w-[52%] opacity-90 blur-[10px]" />
        <div className="cloud bottom-[-8%] left-[25%] h-[30%] w-[55%] blur-[6px]" style={{ background: 'radial-gradient(closest-side,rgba(255,255,255,1),rgba(255,255,255,0))' }} />
        <div className="cloud left-[6%] top-[30%] h-[12%] w-[22%] opacity-40 blur-[10px]" />
        <div className="cloud right-[8%] top-[22%] h-[14%] w-[26%] opacity-30 blur-[12px]" />

        <HeroNav isAuthenticated={isAuthenticated} />

        <div className="relative z-[3] flex flex-col items-center px-6 pt-[9vh] text-center">
          <div className="mb-7 flex max-w-full items-center gap-2 rounded-full border border-white/25 bg-white/[0.14] py-1.5 pl-1.5 pr-3.5 text-[13px] text-white">
            <span className={cn('flex-shrink-0 rounded-full bg-lime px-2 py-1 text-[10.5px] text-ink', mono)}>New</span>
            <span className="truncate">Voice answers with live follow-ups</span>
          </div>
          <h1 className="max-w-[1000px] text-balance text-[clamp(40px,6.4vw,92px)] font-medium leading-[0.98] tracking-display text-white">
            Practice for the role you want,<span className="text-white/[0.72]"> using the experience you have.</span>
          </h1>
          <p className="mt-[26px] max-w-[560px] text-pretty text-[17px] leading-[1.5] text-[#EAF4FF] sm:text-[18px]">
            Upload your resume, paste a job description, and rehearse a mock interview built for that exact role — then get feedback that shows you how to answer better.
          </p>
          <div className="mt-[34px] flex flex-wrap justify-center gap-2.5">
            <a
              href="#how"
              className={cn('flex items-center gap-2.5 whitespace-nowrap rounded-full border border-white/[0.22] bg-[rgba(8,40,90,0.35)] px-[22px] py-4 text-[12.5px] text-white hover:bg-[rgba(8,40,90,0.5)] hover:text-white', mono)}
            >
              <span className="h-0 w-0 border-y-[5px] border-l-8 border-y-transparent border-l-white" aria-hidden="true" />
              Watch a session
            </a>
            <Link
              to={primaryTo}
              className={cn('flex items-center gap-3.5 whitespace-nowrap rounded-full bg-lime py-1.5 pl-[22px] pr-1.5 text-[12.5px] font-medium text-ink hover:bg-lime-hover hover:text-ink', mono)}
            >
              Start your first interview
              <span className="grid h-10 w-10 flex-shrink-0 place-items-center rounded-full bg-ink text-[17px] text-lime" aria-hidden="true">↗</span>
            </Link>
          </div>
        </div>

        <ProductArc scale={arcScale} />

        <div className={cn('relative z-[3] px-6 pb-[26px] text-center text-[11px] text-[#1F4C80]', mono)}>
          Scores are practice feedback — never a hiring prediction
        </div>
      </section>

      <div className="p-2.5">
      {/* ── ROLE STRIP ───────────────────────────────────────── */}
      <section className="overflow-hidden py-[30px]">
        <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-3 whitespace-nowrap px-6 text-[16px] tracking-[-0.01em] text-muted-2 sm:gap-x-10 sm:gap-y-3.5 sm:text-[17px]">
          <span className={cn('text-[11px] text-ink', mono)}>Rehearse for</span>
          {['Product Analyst', 'Backend Engineer', 'UX Designer', 'Data Scientist', 'Marketing Lead'].map((r) => (
            <Fragment key={r}><span>{r}</span><span className="text-faint-3" aria-hidden="true">✳</span></Fragment>
          ))}
          <span>Your next role</span>
        </div>
      </section>

      {/* ── STATEMENT ────────────────────────────────────────── */}
      <section className="mx-auto max-w-page px-6 pb-[70px] pt-[90px] text-center">
        <SectionEyebrow center>Why Rehearsly</SectionEyebrow>
        <h2 className="mx-auto mt-[22px] max-w-[960px] text-balance text-[clamp(34px,4.4vw,60px)] font-medium leading-[1.08] tracking-tight2">
          You know your skills. We help you{' '}
          <span className="inline-flex h-[0.9em] w-[1.1em] items-center justify-center rounded-full bg-brand align-[-0.08em]" aria-hidden="true">
            <span className="h-[0.32em] w-[0.32em] rounded-full bg-white" />
          </span>{' '}
          explain them clearly <span className="text-faint-2">under</span>{' '}
          <span className="inline-flex h-[0.9em] w-[1.1em] items-center justify-center rounded-full bg-lime align-[-0.08em]" aria-hidden="true">
            <span className="h-[0.3em] w-[0.3em] rotate-45 bg-ink" />
          </span>{' '}
          <span className="text-faint-2">real pressure.</span>
        </h2>
      </section>

      {/* ── BENTO ────────────────────────────────────────────── */}
      <section className="mx-auto grid max-w-page grid-cols-[repeat(auto-fit,minmax(min(100%,280px),1fr))] gap-3.5 px-6 pb-[120px]">
        <div className="relative flex min-h-[380px] flex-col justify-between overflow-hidden rounded-r24 bg-sky p-[22px]">
          <div className="flex items-center justify-between text-white">
            <span className="text-[17px] font-semibold tracking-tight1">Grounded in you</span>
            <span className="grid h-[34px] w-[34px] place-items-center rounded-[10px] bg-white"><span className="h-3 w-2.5 rounded-sm border-2 border-ink" /></span>
          </div>
          <div className="rounded-r18 bg-white p-5">
            <div className="text-[15px] leading-[1.45] text-ink-soft">
              Every question comes from <b className="font-semibold text-ink">your resume</b> and <b className="font-semibold text-ink">the job description</b> you paste — not a generic list.
            </div>
          </div>
        </div>
        <div className="flex min-h-[380px] flex-col rounded-r24 bg-stone p-[22px]">
          <div className="text-[14px] text-muted">Feedback you can act on</div>
          <div className="mt-2.5 text-[30px] font-medium leading-[1.1] tracking-tight3">What worked. What lacked proof. What to say next.</div>
          <div className="mt-auto flex flex-col gap-2 pt-6">
            {[['Context', 'Strong', 'text-brand-600'], ['Actions you took', 'Strong', 'text-brand-600'], ['Measurable result', 'Missing', 'text-coral']].map(([k, v, c]) => (
              <div key={k} className="flex justify-between rounded-xl bg-white px-3.5 py-3 text-[13px]"><span>{k}</span><span className={c}>{v}</span></div>
            ))}
          </div>
        </div>
        <div className="grid min-h-[380px] grid-rows-[1fr_auto] gap-3.5">
          <div className="flex flex-col rounded-r24 bg-lime p-[22px]">
            <div className="text-[14px] text-lime-ink">Pick up where you left off</div>
            <div className="mt-2.5 text-[30px] font-medium leading-[1.1] tracking-tight3">Pause any session. Resume without losing a word.</div>
          </div>
          <div className="flex items-center justify-between gap-3 rounded-r24 bg-ink p-[22px] text-white">
            <span className="text-[14px] text-on-dark-soft">Answer by</span>
            <span className="flex gap-1.5">
              <span className="rounded-full bg-white/10 px-3.5 py-2 text-[13px]">Voice</span>
              <span className="rounded-full bg-white/10 px-3.5 py-2 text-[13px]">Text</span>
            </span>
          </div>
        </div>
      </section>

      {/* ── HOW IT WORKS ─────────────────────────────────────── */}
      <section id="how" data-screen-label="How it works" className="scroll-mt-2.5 rounded-r28 bg-ink px-6 py-[100px] text-white">
        <div className="mx-auto max-w-page">
          <div className="flex flex-wrap items-end justify-between gap-6">
            <div>
              <SectionEyebrow tone="lime">How it works</SectionEyebrow>
              <h2 className="mt-[18px] max-w-[640px] text-[clamp(34px,4vw,56px)] font-medium leading-[1.04] tracking-tight2">From resume to a better answer in four steps.</h2>
            </div>
            <p className="max-w-[340px] text-[16px] leading-[1.5] text-on-dark">Most sessions take 20–30 minutes. You can stop at any question and come back later.</p>
          </div>
          <div className="mt-14 grid grid-cols-[repeat(auto-fit,minmax(min(100%,240px),1fr))] gap-3">
            {[
              ['01', 'Upload your resume', 'PDF, up to 5 MB. Stored privately; only you can see it.', 'border border-ink-line bg-ink-2', 'text-lime', 'text-on-dark'],
              ['02', 'Paste the job description', 'We map role requirements to the experience you already have.', 'border border-ink-line bg-ink-2', 'text-lime', 'text-on-dark'],
              ['03', 'Answer out loud or in text', 'Technical and behavioral questions, with follow-ups when an answer is thin.', 'bg-brand', 'text-white', 'text-[#EAF4FF]'],
              ['04', 'Review, revise, retry', 'A per-answer report shows exactly what to change before your next attempt.', 'bg-lime text-ink', 'text-ink', 'text-lime-ink'],
            ].map(([n, t, d, bg, numC, pC]) => (
              <div key={n} className={cn('flex min-h-[260px] flex-col rounded-r20 p-6', bg)}>
                <span className={cn('font-mono text-[12px]', numC)}>{n}</span>
                <div className="mt-auto text-[22px] font-medium tracking-tight1">{t}</div>
                <p className={cn('mt-2.5 text-[14.5px] leading-[1.5]', pC)}>{d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FEEDBACK REPORT ──────────────────────────────────── */}
      <section id="feedback" data-screen-label="Feedback report" className="mx-auto grid max-w-page scroll-mt-2.5 grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] items-center gap-14 px-6 py-[120px]">
        <div>
          <SectionEyebrow>The report</SectionEyebrow>
          <h2 className="mt-[18px] text-balance text-[clamp(34px,4vw,54px)] font-medium leading-[1.05] tracking-tight2">A report that helps you rewrite — not just a score.</h2>
          <p className="mt-[22px] max-w-[460px] text-[17px] leading-[1.55] text-muted-strong">
            For behavioral answers we flag missing context, actions, or results. For technical answers we show where your reasoning needs more detail. Then you try again.
          </p>
          <div className="mt-[30px] flex flex-col border-t border-line">
            <div className="flex justify-between gap-4 border-b border-line py-4 text-[15px]"><span>Behavioral</span><span className="text-right text-muted">Situation · Task · Action · Result</span></div>
            <div className="flex justify-between gap-4 border-b border-line py-4 text-[15px]"><span>Technical</span><span className="text-right text-muted">Reasoning · Trade-offs · Depth</span></div>
          </div>
        </div>
        <div className="rounded-r28 bg-report p-4 sm:p-7">
          <div className="rounded-r20 bg-white p-6 shadow-float">
            <div className="flex items-center justify-between gap-3">
              <div className={cn('text-[10.5px] text-muted', mono)}>Q3 · Behavioral · Attempt 2</div>
              <span className="whitespace-nowrap rounded-full bg-brand-50 px-2.5 py-[5px] text-[11.5px] text-brand-600">7.4 practice score</span>
            </div>
            <div className="mt-3.5 text-[19px] font-medium leading-[1.3] tracking-tight1">“How did you decide what to test first in the checkout redesign?”</div>
            <div className="mt-4 rounded-r14 bg-paper px-4 py-3.5 text-[14px] leading-[1.55] text-ink-soft">
              “I started with shipping because it had the highest drop-off. <span className="rounded bg-coral-bg px-[3px]">We shipped the new flow and it went well.</span>”
            </div>
            <div className="mt-4 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-2.5">
              <div className="rounded-r14 border border-[#E6E9EC] p-3.5"><div className={cn('text-[10px] tracking-[0.06em] text-lime-ok', mono)}>Convincing</div><div className="mt-2 text-[13.5px] leading-[1.45]">Data-led reason for prioritising shipping.</div></div>
              <div className="rounded-r14 border border-[#E6E9EC] p-3.5"><div className={cn('text-[10px] tracking-[0.06em] text-coral', mono)}>Lacked evidence</div><div className="mt-2 text-[13.5px] leading-[1.45]">“Went well” — no metric or outcome.</div></div>
            </div>
            <div className="mt-2.5 flex items-start gap-3 rounded-r14 bg-ink p-4 text-white">
              <span className="grid h-[22px] w-[22px] flex-shrink-0 place-items-center rounded-full bg-lime text-[12px] text-ink">→</span>
              <div className="text-[13.5px] leading-[1.5]">Try: “…checkout completion rose from 61% to 68% in four weeks, so we rolled it out to all markets.”</div>
            </div>
            <Link
              to={primaryTo}
              className={cn('mt-3.5 block w-full rounded-full border border-ink bg-white p-3.5 text-center text-[12px] text-ink hover:bg-ink hover:text-white', mono)}
            >
              Retry this answer
            </Link>
          </div>
        </div>
      </section>

      {/* ── PROGRESS + JOBS ──────────────────────────────────── */}
      <section id="progress" data-screen-label="Progress and jobs" className="mx-auto grid max-w-page scroll-mt-6 grid-cols-[repeat(auto-fit,minmax(min(100%,420px),1fr))] gap-3.5 px-6 pb-[120px]">
        <div className="rounded-r28 border border-line-2 bg-white p-[30px]">
          <div className={cn('text-[11px] tracking-eyebrow text-muted', 'font-mono uppercase')}>Dashboard</div>
          <div className="mt-2.5 max-w-[420px] text-[30px] font-medium leading-[1.1] tracking-tight3">See your recurring weak spots — and watch them shrink.</div>
          <div className="mt-[30px] flex flex-col gap-3.5">
            {[['Quantifying results', 'improving', 'text-brand-600', '72%', '#1B82EC'], ['Explaining trade-offs', 'steady', 'text-muted', '54%', '#9ACDF8'], ['Concise openings', 'needs work', 'text-coral', '31%', '#F2A27E']].map(([k, v, c, w, bg]) => (
              <div key={k}>
                <div className="mb-[7px] flex justify-between text-[13.5px]"><span>{k}</span><span className={c}>{v}</span></div>
                <div className="h-2 rounded-full bg-stone-3"><div className="h-full rounded-full" style={{ width: w, background: bg }} /></div>
              </div>
            ))}
          </div>
        </div>
        <div className="flex flex-col rounded-r28 bg-stone p-[30px]">
          <div className="font-mono text-[11px] uppercase tracking-eyebrow text-muted">Job board</div>
          <div className="mt-2.5 max-w-[420px] text-[30px] font-medium leading-[1.1] tracking-tight3">Find a role, see what it asks for, practice for it.</div>
          <div className="mt-auto flex flex-col gap-2 pt-7">
            {[['Product Analyst', 'Fintech · Remote', '82% match', 'bg-lime'], ['Growth Analyst', 'Marketplace · Hybrid', '74% match', 'bg-brand-50 text-brand-600'], ['BI Developer', 'Health tech · On-site', '61% match', 'bg-stone-2 text-muted']].map(([t, s, m, c]) => (
              <div key={t} className="flex items-center justify-between gap-3 rounded-r18 bg-white px-4 py-3.5" style={{ borderRadius: 16 }}>
                <div><div className="text-[15px] font-medium">{t}</div><div className="mt-0.5 text-[12.5px] text-muted">{s}</div></div>
                <span className={cn('whitespace-nowrap rounded-full px-2.5 py-1.5 text-[12px]', c)}>{m}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── TRUST ────────────────────────────────────────────── */}
      <section id="privacy" data-screen-label="Privacy" className="mx-auto max-w-page scroll-mt-6 px-6 pb-[120px]">
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,300px),1fr))] gap-10 rounded-r28 border border-line p-[clamp(28px,4vw,56px)]">
          <div>
            <SectionEyebrow>Your data</SectionEyebrow>
            <h2 className="mt-[18px] text-[clamp(30px,3.4vw,44px)] font-medium leading-[1.08] tracking-[-0.035em]">Your resume and answers stay yours.</h2>
          </div>
          <div className="grid grid-cols-[repeat(auto-fit,minmax(200px,1fr))] gap-6">
            {[
              ['Private files', 'Resumes are never public or shared with employers.'],
              ['Download or delete', 'Download or delete any resume from your account at any time.'],
              ['Clear AI disclosure', 'Questions and feedback are generated by an AI provider from your resume and the job description.'],
              ['Practice, not prediction', 'Scores guide practice. They don’t forecast hiring outcomes.'],
            ].map(([t, d]) => (
              <div key={t}><div className="text-[16px] font-medium">{t}</div><p className="mt-1.5 text-[14.5px] leading-[1.5] text-muted-strong">{d}</p></div>
            ))}
          </div>
        </div>
      </section>

      <PricingSection isAuthenticated={isAuthenticated} />

      {/* ── CTA ──────────────────────────────────────────────── */}
      <section className="relative overflow-hidden rounded-r28 bg-cta px-6 pb-[110px] pt-[120px] text-center">
        <div className="cloud bottom-[-20%] left-[10%] h-[60%] w-[80%] opacity-90 blur-[10px]" />
        <div className="relative">
          <h2 className="mx-auto max-w-[900px] text-balance text-[clamp(40px,5.4vw,78px)] font-medium leading-none tracking-display text-white">Walk into the real conversation ready.</h2>
          <Link
            to={primaryTo}
            className={cn('mt-9 inline-flex items-center gap-3.5 rounded-full bg-lime py-1.5 pl-[22px] pr-1.5 text-[12.5px] font-medium text-ink hover:bg-lime-hover hover:text-ink', mono)}
          >
            Start practicing free
            <span className="grid h-10 w-10 place-items-center rounded-full bg-ink text-[17px] text-lime" aria-hidden="true">↗</span>
          </Link>
        </div>
      </section>

      <PublicFooter />
      </div>
    </div>
  );
}
