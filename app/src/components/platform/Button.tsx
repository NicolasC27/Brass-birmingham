import { forwardRef, type AnchorHTMLAttributes, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router';
import { cn } from '@/lib/utils';

/* ------------------------------------------------------------------ */
/* Platform buttons (design.md §7.7).                                  */
/* primary = laiton · live = signal · ghost · danger-ghost · icon,     */
/* plus the perforated ticket, so the front page and the panels below  */
/* it order the same journey from one brick.                           */
/* All: active scale .97, platform focus ring (index.css), square      */
/* corners (the register is printed), icon 15px + label Inter 600.     */
/* `size="sm"` is the ear line's cut: 28px high, 10.5px of label.      */
/* ------------------------------------------------------------------ */

export type ButtonVariant = 'primary' | 'live' | 'ghost' | 'danger-ghost' | 'icon' | 'ticket' | 'ticket-brass';

const base =
  'inline-flex select-none items-center justify-center gap-2 font-ui text-[12px] font-semibold uppercase tracking-[0.1em] transition-[background-color,border-color,color,box-shadow,transform] duration-150 ease-out active:scale-[.97] disabled:pointer-events-none [&>svg]:h-[15px] [&>svg]:w-[15px]';

/* the ticket brings its own height, padding and letter-spacing from the
   stylesheet; the base above would only argue with it */
const ticketBase = 'select-none disabled:pointer-events-none';

const variants: Record<ButtonVariant, string> = {
  primary: 'cta-brass text-[rgb(var(--ink-on-brass))]',
  live: 'bg-signal-400 text-[rgb(var(--ink-on-signal))] shadow-[inset_0_0_0_1px_rgba(35,22,3,.25)] hover:halo-signal',
  ghost: 'border border-[var(--gz-line-control)] text-paper-100 hover:border-brass-300 hover:bg-enamel-800',
  'danger-ghost': 'border border-[rgb(var(--rust-400)/.4)] text-rust-400 hover:border-rust-400 hover:bg-[rgb(var(--rust-600)/.1)]',
  icon: 'h-8 w-8 border border-[var(--gz-line-control)] text-paper-300 hover:border-brass-300 hover:bg-enamel-800 hover:text-paper-100',
  ticket: 'gz-ticket',
  'ticket-brass': 'gz-ticket gz-ticket-brass',
};

export type ButtonSize = 'md' | 'sm';

/* the plate's height and margins, for the plated variants; the icon button
   and the tickets carry their own */
const sizes: Record<ButtonSize, string> = {
  md: 'h-9 px-4',
  sm: 'h-7 gap-1.5 px-3 text-[10.5px] [&>svg]:h-[13px] [&>svg]:w-[13px]',
};

const isTicket = (variant: ButtonVariant) => variant === 'ticket' || variant === 'ticket-brass';

const cut = (variant: ButtonVariant, size: ButtonSize) =>
  isTicket(variant) ? cn(ticketBase, variants[variant], size === 'sm' && 'gz-ticket-sm') : cn(base, variants[variant], variant !== 'icon' && sizes[size]);

interface ButtonOwn {
  variant?: ButtonVariant;
  /** md (36px) by default; sm (28px) for the ear line and the timetable */
  size?: ButtonSize;
  /** Lucide icon node (16px) rendered before the label */
  icon?: ReactNode;
}

/** a button, or — when `to` is given — the same plate cut as a router link */
export type ButtonProps =
  | (ButtonOwn & ButtonHTMLAttributes<HTMLButtonElement> & { to?: undefined })
  | (ButtonOwn & Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> & { to: string });

const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(props, ref) {
  const { variant = 'primary', size = 'md', icon, to, className, children, ...rest } = props;

  if (to !== undefined) {
    const anchor = rest as AnchorHTMLAttributes<HTMLAnchorElement>;
    /* the link took none of what it was handed: labels, handlers and titles
       all fell on the floor between the caller and the anchor */
    return (
      <Link {...anchor} to={to} className={cn(cut(variant, size), className)}>
        {icon}
        {children}
      </Link>
    );
  }

  const button = rest as ButtonHTMLAttributes<HTMLButtonElement>;
  /* a command put out is painted, not diluted: `.is-off` swaps the plate for
     the register's off surface instead of halving plate and ink together */
  const classes = cn(cut(variant, size), button.disabled && 'is-off', className);
  return (
    <button {...button} ref={ref} type={button.type ?? 'button'} className={classes}>
      {icon}
      {children}
    </button>
  );
});

export default Button;
