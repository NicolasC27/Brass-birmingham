import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  disabled?: boolean;
}

/**
 * A choice among a few words, set as headings on a rule: the chosen one in
 * ink with a diamond under it, the others in iron. The journal's own way of
 * a segmented control; props unchanged from the brass pill it replaces.
 *
 * `readOnly` is for the guest at the host's table: the words are still read,
 * but they no longer answer to the hand, the tab or the reader — a command
 * that takes focus and does nothing is worse than none.
 */
export default function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  readOnly = false,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  ariaLabel: string;
  /** the rules are someone else's to set: show them, do not offer them */
  readOnly?: boolean;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("inline-flex items-center gap-4 border-b border-[var(--gz-ink-faint)]", className)}>
      {options.map((o) => {
        const active = o.value === value;
        const off = readOnly || o.disabled === true;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={off}
            aria-disabled={off || undefined}
            onClick={() => onChange(o.value)}
            className={cn(
              "gz-nav-link !py-1.5 !text-[10.5px]",
              active && "is-active",
              /* painted, not diluted: the settled rule keeps its ink, the
                 roads not taken fall back to iron */
              off && "cursor-default",
              off && !active && "!text-iron-400",
            )}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
