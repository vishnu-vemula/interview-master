import { forwardRef, useId, useState, cloneElement, isValidElement } from 'react';
import { cn } from '@/utils';

/**
 * Field — label + control + hint/error, matching the design's stacked label.
 * Passes id / aria-invalid / aria-describedby to a single child control.
 */
export function Field({ label, hint, error, htmlFor, required, className, labelRight, children }) {
  const autoId = useId();
  const id = htmlFor || children?.props?.id || autoId;
  const describedBy = error ? `${id}-error` : hint ? `${id}-hint` : undefined;

  const control = isValidElement(children)
    ? cloneElement(children, {
        id,
        'aria-invalid': error ? true : undefined,
        'aria-describedby': describedBy,
        // Custom controls (Input, Select…) take `invalid`; native elements must not receive it.
        ...(typeof children.type !== 'string' ? { invalid: !!error } : {}),
      })
    : children;

  return (
    <div className={cn('field-label', className)}>
      {label && (
        <span className="flex items-center justify-between gap-3">
          <label htmlFor={id}>
            {label}
            {required && <span className="ml-0.5 text-coral" aria-hidden="true">*</span>}
          </label>
          {labelRight}
        </span>
      )}
      {control}
      {error ? (
        <span id={`${id}-error`} role="alert" className="field-error-text">
          {error}
        </span>
      ) : hint ? (
        <span id={`${id}-hint`} className="field-hint">
          {hint}
        </span>
      ) : null}
    </div>
  );
}

export const Input = forwardRef(function Input({ className, invalid, size, icon: Icon, ...props }, ref) {
  const input = (
    <input
      ref={ref}
      className={cn('field', size === 'lg' && 'field-lg', invalid && 'field-error', Icon && 'pl-11', className)}
      {...props}
    />
  );
  if (!Icon) return input;
  return (
    <span className="relative flex">
      <Icon size={17} className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-faint" aria-hidden="true" />
      {input}
    </span>
  );
});

export const Textarea = forwardRef(function Textarea({ className, invalid, ...props }, ref) {
  return <textarea ref={ref} className={cn('field', invalid && 'field-error', className)} {...props} />;
});

export const Select = forwardRef(function Select({ className, invalid, children, ...props }, ref) {
  return (
    <select ref={ref} className={cn('field', invalid && 'field-error', className)} {...props}>
      {children}
    </select>
  );
});

/** Password input with the design's mono "Show / Hide" chip inside the field. */
export const PasswordInput = forwardRef(function PasswordInput({ className, invalid, size, ...props }, ref) {
  const [show, setShow] = useState(false);
  return (
    <span className="relative flex">
      <input
        ref={ref}
        type={show ? 'text' : 'password'}
        className={cn('field flex-1 pr-[72px]', size === 'lg' && 'field-lg', invalid && 'field-error', className)}
        {...props}
      />
      <button
        type="button"
        onClick={() => setShow((s) => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-r9 bg-stone-2 px-2.5 py-[7px] font-mono text-[10.5px] uppercase tracking-[0.06em] text-ink-soft transition-colors hover:bg-stone"
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </span>
  );
});

/** Accessible switch (settings toggles). */
export function Switch({ checked, onChange, disabled, label, id, className }) {
  return (
    <button
      id={id}
      type="button"
      role="switch"
      aria-checked={!!checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange?.(!checked)}
      className={cn(
        'relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full border transition-colors duration-200',
        checked ? 'border-ink bg-ink' : 'border-line bg-stone',
        disabled && 'cursor-not-allowed opacity-50',
        className,
      )}
    >
      <span
        className={cn(
          'inline-block h-[18px] w-[18px] rounded-full shadow-sm transition-transform duration-200',
          checked ? 'translate-x-[21px] bg-lime' : 'translate-x-[2px] bg-white',
        )}
      />
    </button>
  );
}

/** Checkbox styled to the design (ink when checked). */
export const Checkbox = forwardRef(function Checkbox({ className, label, ...props }, ref) {
  return (
    <label className={cn('inline-flex cursor-pointer items-center gap-2.5 text-[14px] text-ink', className)}>
      <input
        ref={ref}
        type="checkbox"
        className="h-[18px] w-[18px] cursor-pointer rounded-[5px] border-line accent-ink"
        {...props}
      />
      {label}
    </label>
  );
});
