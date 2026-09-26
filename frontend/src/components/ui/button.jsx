import { forwardRef } from 'react';
import { Link } from 'react-router-dom';
import { cn } from '@/utils';
import Spinner from './spinner';

const VARIANTS = {
  lime: 'btn-lime',
  ink: 'btn-ink',
  blue: 'btn-blue',
  outline: 'btn-outline',
  soft: 'btn-soft',
  ghost: 'btn-ghost',
  danger: 'btn-danger',
  glass: 'btn-glass',
};

const SIZES = { sm: 'btn-sm', md: '', lg: 'btn-lg' };

/**
 * Button — mono uppercase pill from the design.
 *
 * Props:
 *  variant  lime | ink | blue | outline | soft | ghost | danger | glass
 *  size     sm | md | lg
 *  cta      renders the ink "↗" disc on the right (design hero / auth submit)
 *  loading  shows spinner, sets aria-busy and disables
 *  icon / iconRight  lucide component rendered before / after the label
 *  to       renders a router <Link>; href renders <a>
 *  iconOnly square icon button (requires aria-label)
 */
const Button = forwardRef(function Button(
  {
    variant = 'ink',
    size = 'md',
    cta = false,
    loading = false,
    disabled,
    icon: Icon,
    iconRight: IconRight,
    iconOnly = false,
    to,
    href,
    className,
    children,
    type = 'button',
    ...rest
  },
  ref,
) {
  const classes = cn(
    'btn',
    VARIANTS[variant] ?? VARIANTS.ink,
    SIZES[size],
    cta && 'btn-cta justify-between',
    iconOnly && 'btn-icon',
    className,
  );

  const iconSize = size === 'sm' ? 14 : 16;
  const content = (
    <>
      {loading ? <Spinner size={iconSize} /> : Icon ? <Icon size={iconSize} aria-hidden="true" /> : null}
      {children}
      {!loading && IconRight ? <IconRight size={iconSize} aria-hidden="true" /> : null}
      {cta && (
        <span className="btn-cta-disc" aria-hidden="true">
          ↗
        </span>
      )}
    </>
  );

  if (to && !disabled) {
    return (
      <Link ref={ref} to={to} className={classes} {...rest}>
        {content}
      </Link>
    );
  }
  if (href && !disabled) {
    return (
      <a ref={ref} href={href} className={classes} {...rest}>
        {content}
      </a>
    );
  }

  return (
    <button
      ref={ref}
      type={type}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {content}
    </button>
  );
});

export default Button;
