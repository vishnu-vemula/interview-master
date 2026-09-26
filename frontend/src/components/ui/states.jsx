import { AlertTriangle, RotateCw } from 'lucide-react';
import { cn } from '@/utils';
import Button from './button';
import Spinner from './spinner';

export function Skeleton({ className, ...rest }) {
  return <div className={cn('skeleton', className)} aria-hidden="true" {...rest} />;
}

/** A list of skeleton rows inside a card, used for loading lists/tables. */
export function SkeletonList({ rows = 3, className }) {
  return (
    <div className={cn('space-y-3', className)} role="status" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="card flex items-center gap-4 p-5">
          <Skeleton className="h-10 w-10 flex-shrink-0 rounded-r14" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-1/3" />
            <Skeleton className="h-3 w-1/2" />
          </div>
          <Skeleton className="hidden h-8 w-24 rounded-full sm:block" />
        </div>
      ))}
    </div>
  );
}

export function LoadingState({ label = 'Loading…', className }) {
  return (
    <div className={cn('flex min-h-[240px] flex-col items-center justify-center gap-3 text-muted', className)} role="status">
      <Spinner size={22} className="text-brand" />
      <span className="mono-label">{label}</span>
    </div>
  );
}

/**
 * EmptyState — dashed stone panel with an icon tile, title, body and optional action.
 */
export function EmptyState({ icon: Icon, title, description, action, className, compact = false }) {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center rounded-r24 border border-dashed border-line bg-white/60 text-center',
        compact ? 'px-6 py-10' : 'px-6 py-16',
        className,
      )}
    >
      {Icon && (
        <span className="mb-5 grid h-12 w-12 place-items-center rounded-r14 bg-stone text-ink">
          <Icon size={20} aria-hidden="true" />
        </span>
      )}
      <h3 className="text-[19px] font-medium tracking-tight1">{title}</h3>
      {description && <p className="mt-2 max-w-sm text-[14.5px] leading-relaxed text-muted">{description}</p>}
      {action && <div className="mt-6 flex flex-wrap justify-center gap-2">{action}</div>}
    </div>
  );
}

/** ErrorState — coral-tinted panel with retry. */
export function ErrorState({ title = 'Something went wrong', description, onRetry, className, compact = false }) {
  return (
    <div
      role="alert"
      className={cn(
        'flex flex-col items-center justify-center rounded-r24 border border-coral/25 bg-coral-soft text-center',
        compact ? 'px-6 py-8' : 'px-6 py-14',
        className,
      )}
    >
      <span className="mb-4 grid h-11 w-11 place-items-center rounded-r14 bg-coral-bg text-coral">
        <AlertTriangle size={19} aria-hidden="true" />
      </span>
      <h3 className="text-[17px] font-medium tracking-tight1">{title}</h3>
      {description && <p className="mt-1.5 max-w-md text-[14px] leading-relaxed text-muted-strong">{description}</p>}
      {onRetry && (
        <Button variant="outline" size="sm" icon={RotateCw} onClick={onRetry} className="mt-5">
          Try again
        </Button>
      )}
    </div>
  );
}

/** Inline alert banner. tone: info | warn | error | success */
export function Alert({ tone = 'info', title, children, icon: Icon, className, action }) {
  const tones = {
    info: 'border-brand-200 bg-brand-50 text-ink',
    warn: 'border-coral/20 bg-coral-soft text-ink',
    error: 'border-coral/30 bg-coral-bg/60 text-ink',
    success: 'border-lime-ok/20 bg-lime-soft text-ink',
  };
  const iconTone = { info: 'text-brand-600', warn: 'text-coral', error: 'text-coral', success: 'text-lime-ok' };
  return (
    <div role={tone === 'error' ? 'alert' : 'status'} className={cn('flex items-start gap-3 rounded-r18 border px-4 py-3.5', tones[tone], className)}>
      {Icon && <Icon size={18} className={cn('mt-0.5 flex-shrink-0', iconTone[tone])} aria-hidden="true" />}
      <div className="min-w-0 flex-1 text-[14px] leading-relaxed">
        {title && <p className="font-medium">{title}</p>}
        {children && <div className={cn(title && 'mt-0.5', 'text-muted-strong')}>{children}</div>}
      </div>
      {action}
    </div>
  );
}
