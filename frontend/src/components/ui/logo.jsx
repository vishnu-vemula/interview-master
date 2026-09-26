import { Link } from 'react-router-dom';
import { cn } from '@/utils';

/**
 * Rehearsly logo mark — lime tile with the ink "double dot" from the design.
 * tone: 'light' (white wordmark, for blue hero) | 'dark' (ink wordmark) | 'footer' (ink tile, lime dot)
 */
export function LogoMark({ size = 30, tone = 'dark', className }) {
  if (tone === 'footer') {
    return (
      <span
        className={cn('grid flex-shrink-0 place-items-center bg-ink', className)}
        style={{ width: size, height: size, borderRadius: size * 0.3 }}
        aria-hidden="true"
      >
        <span className="rounded-full bg-lime" style={{ width: size * 0.38, height: size * 0.38 }} />
      </span>
    );
  }
  const dot = size * 0.4;
  return (
    <span
      className={cn('grid flex-shrink-0 place-items-center bg-lime', className)}
      style={{ width: size, height: size, borderRadius: size * 0.3 }}
      aria-hidden="true"
    >
      <span
        className="rounded-full bg-ink"
        style={{
          width: dot,
          height: dot,
          marginLeft: -dot / 2,
          boxShadow: `${dot * 0.58}px 0 0 -${dot * 0.17}px #0E1116`,
        }}
      />
    </span>
  );
}

export default function Logo({ to = '/', tone = 'dark', size = 30, className, onClick }) {
  const content = (
    <>
      <LogoMark size={size} tone={tone === 'footer' ? 'footer' : 'dark'} />
      <span
        className={cn(
          'font-semibold tracking-tight1',
          tone === 'light' ? 'text-white' : 'text-ink',
        )}
        style={{ fontSize: size * 0.63 }}
      >
        Rehearsly
      </span>
    </>
  );

  if (!to) {
    return <span className={cn('inline-flex items-center gap-2.5', className)}>{content}</span>;
  }

  return (
    <Link
      to={to}
      onClick={onClick}
      aria-label="Rehearsly home"
      className={cn('inline-flex items-center gap-2.5 rounded-xl hover:text-inherit', className)}
    >
      {content}
    </Link>
  );
}
