import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { cn } from '@/utils';
import Button from './button';

function useLockBody(open) {
  useEffect(() => {
    if (!open) return undefined;
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { document.body.style.overflow = prev; };
  }, [open]);
}

function useEscape(open, onClose) {
  useEffect(() => {
    if (!open) return undefined;
    const handler = (e) => { if (e.key === 'Escape') onClose?.(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [open, onClose]);
}

/** Focus the first focusable element in the panel on open, and restore focus on close. */
function useInitialFocus(open, ref) {
  useEffect(() => {
    if (!open) return undefined;
    const previous = document.activeElement;
    const t = setTimeout(() => {
      const el = ref.current?.querySelector('[data-autofocus], input, textarea, select, button:not([data-close])');
      (el || ref.current)?.focus?.();
    }, 30);
    return () => {
      clearTimeout(t);
      previous?.focus?.();
    };
  }, [open, ref]);
}

/**
 * Modal — centered dialog. size: sm | md | lg | xl
 */
export function Modal({ open, onClose, title, description, children, footer, size = 'md', className, dismissible = true }) {
  const panelRef = useRef(null);
  useLockBody(open);
  useEscape(open && dismissible, onClose);
  useInitialFocus(open, panelRef);
  if (!open) return null;

  const widths = { sm: 'max-w-md', md: 'max-w-lg', lg: 'max-w-2xl', xl: 'max-w-4xl' };

  return createPortal(
    <div className="fixed inset-0 z-[80] flex items-end justify-center p-0 sm:items-center sm:p-4">
      <div className="absolute inset-0 animate-fade-in bg-ink/45 backdrop-blur-[2px]" onClick={dismissible ? onClose : undefined} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={cn(
          'relative flex max-h-[92dvh] w-full animate-pop-in flex-col overflow-hidden rounded-t-r28 bg-white shadow-pop outline-none sm:rounded-r24',
          widths[size],
          className,
        )}
      >
        {(title || dismissible) && (
          <div className="flex items-start justify-between gap-4 border-b border-line-2 px-6 pb-4 pt-5">
            <div className="min-w-0">
              {title && <h2 className="text-[20px] font-medium tracking-tight1">{title}</h2>}
              {description && <p className="mt-1 text-[14px] leading-relaxed text-muted">{description}</p>}
            </div>
            {dismissible && (
              <button
                type="button"
                data-close
                onClick={onClose}
                aria-label="Close"
                className="-mr-2 grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-stone hover:text-ink"
              >
                <X size={18} />
              </button>
            )}
          </div>
        )}
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-5">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line-2 bg-paper/60 px-6 py-4">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}

/** Drawer — right-side sheet (job details, row details). */
export function Drawer({ open, onClose, title, subtitle, children, footer, width = 'max-w-xl' }) {
  const panelRef = useRef(null);
  useLockBody(open);
  useEscape(open, onClose);
  useInitialFocus(open, panelRef);
  if (!open) return null;

  return createPortal(
    <div className="fixed inset-0 z-[80]">
      <div className="absolute inset-0 animate-fade-in bg-ink/40 backdrop-blur-[2px]" onClick={onClose} aria-hidden="true" />
      <aside
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={typeof title === 'string' ? title : undefined}
        tabIndex={-1}
        className={cn('absolute inset-y-0 right-0 flex w-full flex-col bg-paper shadow-pop outline-none animate-slide-up sm:animate-fade-in', width)}
      >
        <div className="flex items-start justify-between gap-4 border-b border-line bg-white px-6 py-5">
          <div className="min-w-0">
            {title && <h2 className="text-[22px] font-medium leading-tight tracking-tight1">{title}</h2>}
            {subtitle && <div className="mt-1.5 text-[14px] text-muted">{subtitle}</div>}
          </div>
          <button
            type="button"
            data-close
            onClick={onClose}
            aria-label="Close"
            className="-mr-2 grid h-9 w-9 flex-shrink-0 place-items-center rounded-full text-muted transition-colors hover:bg-stone hover:text-ink"
          >
            <X size={18} />
          </button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">{children}</div>
        {footer && <div className="flex flex-wrap justify-end gap-2 border-t border-line bg-white px-6 py-4">{footer}</div>}
      </aside>
    </div>,
    document.body,
  );
}

// ── Confirm dialog (replaces window.confirm) ─────────────────────────
const ConfirmContext = createContext(null);

export function ConfirmProvider({ children }) {
  const [state, setState] = useState(null);
  const resolver = useRef(null);

  const confirm = useCallback((options) => {
    setState({
      title: 'Are you sure?',
      confirmLabel: 'Confirm',
      cancelLabel: 'Cancel',
      tone: 'default',
      ...options,
    });
    return new Promise((resolve) => { resolver.current = resolve; });
  }, []);

  const close = (value) => {
    resolver.current?.(value);
    resolver.current = null;
    setState(null);
  };

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Modal
        open={!!state}
        onClose={() => close(false)}
        title={state?.title}
        size="sm"
        footer={
          <>
            <Button variant="ghost" onClick={() => close(false)}>{state?.cancelLabel}</Button>
            <Button variant={state?.tone === 'danger' ? 'danger' : 'ink'} onClick={() => close(true)} data-autofocus>
              {state?.confirmLabel}
            </Button>
          </>
        }
      >
        <p className="text-[15px] leading-relaxed text-muted-strong">{state?.description}</p>
      </Modal>
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used inside <ConfirmProvider>');
  return ctx;
}

/** Dropdown menu anchored to a trigger; closes on outside click / Escape. */
export function Dropdown({ trigger, children, align = 'right', className, panelClassName }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false); };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className={cn('relative', className)}>
      {trigger({ open, toggle: () => setOpen((o) => !o) })}
      {open && (
        <div
          className={cn(
            'absolute top-full z-50 mt-2 min-w-[220px] animate-pop-in overflow-hidden rounded-r18 border border-line-2 bg-white shadow-pop',
            align === 'right' ? 'right-0' : 'left-0',
            panelClassName,
          )}
          role="menu"
        >
          {typeof children === 'function' ? children({ close: () => setOpen(false) }) : children}
        </div>
      )}
    </div>
  );
}

export function MenuItem({ icon: Icon, children, onClick, tone = 'default', disabled }) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={onClick}
      className={cn(
        'flex w-full items-center gap-3 px-4 py-2.5 text-left text-[14px] transition-colors disabled:opacity-50',
        tone === 'danger' ? 'text-coral hover:bg-coral-soft' : 'text-ink hover:bg-paper',
      )}
    >
      {Icon && <Icon size={16} aria-hidden="true" />}
      {children}
    </button>
  );
}
