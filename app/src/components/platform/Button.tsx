import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Platform buttons (design.md §7.7).                                  */
/* primary = laiton · live = signal · ghost · danger-ghost · icon,     */
/* plus the perforated ticket, so the front page and the panels below  */
/* it order the same journey from one brick.                           */
/* All: active scale .97, platform focus ring (index.css), icon 16px   */
/* + label Inter 600 14px.                                             */
/* ------------------------------------------------------------------ */

export type ButtonVariant = 'primary' | 'live' | 'ghost' | 'danger-ghost' | 'icon' | 'ticket' | 'ticket-brass';

const base =
  'inline-flex select-none items-center justify-center gap-2 rounded-lg font-ui text-[12px] font-semibold uppercase tracking-[0.1em] transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:scale-[.97] disabled:pointer-events-none [&>svg]:h-[15px] [&>svg]:w-[15px]';

/* the ticket brings its own height, padding and letter-spacing from the
   stylesheet; the base above would only argue with it */
const ticketBase = 'select-none disabled:pointer-events-none';

const variants: Record<ButtonVariant, string> = {
  primary: 'cta-brass h-9 px-4 text-[rgb(var(--ink-on-brass))]',
  live: 'h-9 bg-signal-400 px-4 text-[rgb(var(--ink-on-signal))] shadow-[inset_0_0_0_1px_rgba(35,22,3,.25)] hover:halo-signal',
  ghost: 'h-9 border border-[var(--gz-line-control)] px-4 text-paper-100 hover:border-brass-300 hover:bg-enamel-800',
  'danger-ghost': 'h-9 border border-[rgb(var(--rust-400)/.4)] px-4 text-rust-400 hover:border-rust-400 hover:bg-[rgb(var(--rust-600)/.1)]',
  icon: 'h-8 w-8 border border-[var(--gz-line-control)] text-paper-300 hover:border-brass-300 hover:bg-enamel-800 hover:text-paper-100',
  ticket: 'gz-ticket',
  'ticket-brass': 'gz-ticket gz-ticket-brass',
};

const isTicket = (variant: ButtonVariant) => variant === 'ticket' || variant === 'ticket-brass';

interface ButtonOwn {
  variant?: ButtonVariant;
  /** Lucide icon node (16px) rendered before the label */
  icon?: ReactNode;
}

/** a button, or — when `to` is given — the same plate cut as a router link */
export type ButtonProps =
  | (ButtonOwn & ButtonHTMLAttributes<HTMLButtonElement> & { to?: undefined })
  | (ButtonOwn & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string });

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(props, ref) {
  const { variant = 'primary', icon, to, className, children, ...rest } = props;

  if (to !== undefined) {
    const anchor = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    /* the link took none of what it was handed: labels, handlers and titles
       all fell on the floor between the caller and the anchor */
    return (
      <Link {...anchor} to={to} className={cn(isTicket(variant) ? ticketBase : base, variants[variant], className)}>
        {icon}
        {children}
      </Link>
    );
  }

  const button = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  /* a command put out is painted, not diluted: `.is-off` swaps the plate for
     the register's off surface instead of halving plate and ink together */
  const classes = cn(isTicket(variant) ? ticketBase : base, variants[variant], button.disabled && 'is-off', className);
  return (
    <button {...button} ref={ref} type={button.type ?? 'button'} className={classes}>
      {icon}
      {children}
    </button>
  );
});

export default Button;
