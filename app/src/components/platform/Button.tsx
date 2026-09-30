import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Platform buttons (design.md §7.7).                                  */
/* primary = laiton · live = signal · ghost · danger-ghost · icon.     */
/* All: active scale .97, platform focus ring (index.css), icon 16px   */
/* + label Inter 600 14px.                                             */
/* ------------------------------------------------------------------ */

export type ButtonVariant = 'primary' | 'live' | 'ghost' | 'danger-ghost' | 'icon';

const base =
  'inline-flex select-none items-center justify-center gap-2 rounded-lg font-ui text-[12px] font-semibold uppercase tracking-[0.1em] transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:scale-[.97] disabled:pointer-events-none disabled:opacity-50 [&>svg]:h-[15px] [&>svg]:w-[15px]';

const variants: Record<ButtonVariant, string> = {
  primary: 'cta-brass h-9 px-4 text-[rgb(var(--ink-on-brass))]',
  live: 'h-9 bg-signal-400 px-4 text-[rgb(var(--ink-on-signal))] shadow-[inset_0_0_0_1px_rgba(35,22,3,.25)] hover:halo-signal',
  ghost: 'h-9 border border-brass-hairline-strong px-4 text-paper-100 hover:border-brass-300 hover:bg-enamel-800',
  'danger-ghost': 'h-9 border border-[rgb(var(--rust-400)/.4)] px-4 text-rust-400 hover:border-rust-400 hover:bg-[rgb(var(--rust-600)/.1)]',
  icon: 'h-8 w-8 border border-brass-hairline-strong text-paper-300 hover:border-brass-300 hover:bg-enamel-800 hover:text-paper-100',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  /** Lucide icon node (16px) rendered before the label */
  icon?: ReactNode;
  /** render as a router link instead of a button */
  to?: string;
}

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = 'primary', icon, to, className, children, type, ...rest },
  ref,
) {
  const classes = cn(base, variants[variant], className);
  if (to !== undefined) {
    return (
      <Link to={to} className={classes}>
        {icon}
        {children}
      </Link>
    );
  }
  return (
    <button ref={ref} type={type ?? 'button'} className={classes} {...rest}>
      {icon}
      {children}
    </button>
  );
});

export default Button;
