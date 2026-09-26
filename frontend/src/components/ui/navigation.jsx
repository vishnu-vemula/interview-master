import { ChevronLeft, ChevronRight } from 'lucide-react';
import { cn } from '@/utils';

/**
 * Segmented control — the design's stone track with an ink active pill
 * (Log in / Sign up switch). options: [{ value, label, count? }]
 */
export function Segmented({ options, value, onChange, className, size = 'md', ariaLabel }) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn('inline-flex max-w-full gap-0.5 overflow-x-auto rounded-full bg-stone p-1 no-scrollbar', className)}
    >
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(opt.value)}
            className={cn(
              'inline-flex flex-shrink-0 items-center gap-1.5 whitespace-nowrap rounded-full font-mono uppercase tracking-mono transition-colors',
              size === 'sm' ? 'px-3 py-[7px] text-[10.5px]' : 'px-4 py-[9px] text-[11px]',
              active ? 'bg-ink text-white' : 'text-muted hover:text-ink',
            )}
          >
            {opt.icon && <opt.icon size={13} aria-hidden="true" />}
            {opt.label}
            {opt.count !== undefined && (
              <span className={cn('rounded-full px-1.5 py-px text-[10px]', active ? 'bg-white/15' : 'bg-white')}>{opt.count}</span>
            )}
          </button>
        );
      })}
    </div>
  );
}

/** Pagination — Previous / Page X of Y / Next. */
export function Pagination({ page, totalPages, onPageChange, className, disabled }) {
  if (!totalPages || totalPages <= 1) return null;
  return (
    <nav aria-label="Pagination" className={cn('flex items-center justify-center gap-3', className)}>
      <button
        type="button"
        onClick={() => onPageChange(page - 1)}
        disabled={disabled || page <= 1}
        className="btn btn-soft btn-sm"
      >
        <ChevronLeft size={14} aria-hidden="true" /> Prev
      </button>
      <span className="min-w-[110px] text-center font-mono text-[11px] uppercase tracking-mono text-muted tabular" aria-live="polite">
        Page {page} of {totalPages}
      </span>
      <button
        type="button"
        onClick={() => onPageChange(page + 1)}
        disabled={disabled || page >= totalPages}
        className="btn btn-soft btn-sm"
      >
        Next <ChevronRight size={14} aria-hidden="true" />
      </button>
    </nav>
  );
}

/** Table shell — horizontal scroll on small screens, design typography. */
export function TableShell({ children, className, minWidth = 720 }) {
  return (
    <div className={cn('card overflow-hidden', className)}>
      <div className="relative overflow-x-auto scroll-thin">
        <table className="table-base" style={{ minWidth }}>
          {children}
        </table>
      </div>
    </div>
  );
}
