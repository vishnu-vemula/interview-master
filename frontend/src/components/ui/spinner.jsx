import { cn } from '@/utils';

export default function Spinner({ size = 16, className, label }) {
  return (
    <span
      role={label ? 'status' : undefined}
      aria-label={label}
      className={cn('inline-block flex-shrink-0 animate-spin rounded-full border-2 border-current border-r-transparent', className)}
      style={{ width: size, height: size }}
    />
  );
}
