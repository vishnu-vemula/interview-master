import { cn } from '@/utils';

// Literal class names so Tailwind's content scanner emits every tone.
const PILL_TONES = {
  lime: 'pill-lime',
  blue: 'pill-blue',
  stone: 'pill-stone',
  ink: 'pill-ink',
  coral: 'pill-coral',
  ok: 'pill-ok',
  outline: 'pill-outline',
};

/** Pill / badge. tone: lime | blue | stone | ink | coral | ok | outline */
export function Pill({ tone = 'stone', mono = false, className, children, icon: Icon, ...rest }) {
  return (
    <span className={cn('pill', PILL_TONES[tone] || PILL_TONES.stone, mono && 'pill-mono', className)} {...rest}>
      {Icon && <Icon size={12} aria-hidden="true" />}
      {children}
    </span>
  );
}

/** Mono eyebrow with the leading dot (e.g. "● WHY REHEARSLY"). */
export function Eyebrow({ className, children, as: Tag = 'div' }) {
  return <Tag className={cn('eyebrow', className)}>{children}</Tag>;
}

/** Card surface. tone: white | stone | ink | lime */
export function Card({ tone = 'white', className, children, as: Tag = 'div', interactive = false, ...rest }) {
  const base = { white: 'card', stone: 'card-stone', ink: 'card-ink', lime: 'card-lime' }[tone] || 'card';
  return (
    <Tag className={cn(base, interactive && 'card-interactive', className)} {...rest}>
      {children}
    </Tag>
  );
}

/** Page header used across app + admin pages. */
export function PageHeader({ eyebrow, title, description, actions, className }) {
  return (
    <div className={cn('flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between', className)}>
      <div className="min-w-0">
        {eyebrow && <Eyebrow className="mb-3 text-muted">{eyebrow}</Eyebrow>}
        <h1 className="page-title">{title}</h1>
        {description && <p className="mt-2.5 max-w-[620px] text-[15.5px] leading-relaxed text-muted-strong">{description}</p>}
      </div>
      {actions && <div className="flex flex-shrink-0 flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}

/** Stat tile (dashboard metrics). tone: white | stone | ink | lime | blue */
export function StatTile({ label, value, sub, tone = 'white', icon: Icon, loading, className, footer }) {
  const tones = {
    white: 'card',
    stone: 'card-stone',
    ink: 'card-ink',
    lime: 'card-lime',
    blue: 'rounded-r24 bg-brand text-white',
  };
  const subTone = { ink: 'text-on-dark', lime: 'text-lime-ink', blue: 'text-brand-50' }[tone] || 'text-muted';
  return (
    <div className={cn(tones[tone], 'flex flex-col p-5', className)}>
      <div className="flex items-start justify-between gap-3">
        <span className={cn('mono-label', subTone)}>{label}</span>
        {Icon && <Icon size={16} className={cn('flex-shrink-0', subTone)} aria-hidden="true" />}
      </div>
      <div className="mt-4 text-[34px] font-medium leading-none tracking-tight3 tabular">
        {loading ? <span className="skeleton inline-block h-8 w-20 align-middle" /> : value}
      </div>
      {sub && <p className={cn('mt-2 text-[13px]', subTone)}>{sub}</p>}
      {footer}
    </div>
  );
}

/** Horizontal progress bar with the design's soft track. */
export function ProgressBar({ value = 0, max = 100, tone = 'blue', className, label }) {
  const pct = Math.max(0, Math.min(100, (value / (max || 1)) * 100));
  const fill = { blue: 'bg-brand', soft: 'bg-brand-300', coral: 'bg-coral-bar', lime: 'bg-lime', ink: 'bg-ink' }[tone] || 'bg-brand';
  return (
    <div
      className={cn('h-2 overflow-hidden rounded-full bg-stone-3', className)}
      role="progressbar"
      aria-valuenow={Math.round(pct)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={label}
    >
      <div className={cn('h-full rounded-full transition-[width] duration-500', fill)} style={{ width: `${pct}%` }} />
    </div>
  );
}

/** Initial avatar. */
export function Avatar({ name, size = 36, tone = 'lime', className }) {
  const initial = (name || '?').trim().charAt(0).toUpperCase();
  const tones = { lime: 'bg-lime text-ink', ink: 'bg-ink text-lime', blue: 'bg-brand text-white', stone: 'bg-stone text-ink' };
  return (
    <span
      className={cn('grid flex-shrink-0 place-items-center rounded-full font-medium', tones[tone], className)}
      style={{ width: size, height: size, fontSize: size * 0.42 }}
      aria-hidden="true"
    >
      {initial}
    </span>
  );
}

/** Score badge: practice score out of 10 or 100. */
export function ScorePill({ score, outOf = 100, className }) {
  if (score === null || score === undefined) return <Pill tone="stone" className={className}>—</Pill>;
  const pct = outOf === 10 ? score * 10 : score;
  const tone = pct >= 70 ? 'lime' : pct >= 40 ? 'blue' : 'coral';
  return (
    <Pill tone={tone} className={cn('tabular', className)}>
      {outOf === 10 ? `${score}/10` : `${Math.round(score)}%`}
    </Pill>
  );
}
