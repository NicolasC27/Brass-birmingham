import { cn } from "@/lib/utils";

export interface SegmentedOption<T extends string> {
  value: T;
  label: string;
  /** a word said of the option, set in superscript after it (« bêta ») */
  note?: string;
  disabled?: boolean;
}

/**
 * A choice among a few words, set as headings on a rule: the chosen one in
 * full ink, struck through the rule with a 2px bar and a diamond, the others
 * in iron. The rule under the group is printed at a control's weight, so the
 * words read as a command and not as one more label of the sheet. The
 * journal's own way of a segmented control; props unchanged.
 *
 * `readOnly` is for the guest at the host's table: the words are still read,
 * but they no longer answer to the hand, the tab or the reader — a command
 * that takes focus and does nothing is worse than none. It is drawn put out
 * as well: the group's rule falls to a hairline, and the word settled keeps
 * its bar and its diamond in the register's off ink, so it reads as a fact
 * of the table and not as a lever at hand.
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
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      aria-readonly={readOnly || undefined}
      className={cn("inline-flex items-center gap-4 border-b", readOnly ? "border-[var(--gz-ink-faint)]" : "border-[var(--gz-line-control)]", className)}
    >
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
              /* the bar under the word chosen, laid over the group's rule */
              active && "before:absolute before:inset-x-0 before:-bottom-px before:h-[2px] before:bg-[rgb(var(--paper-100))] before:content-['']",
              /* painted, not diluted: the settled rule keeps its ink, the
                 roads not taken fall back to iron */
              off && "cursor-default",
              off && !active && "!text-iron-400",
              readOnly && active && "!text-paper-300 before:!bg-[rgb(var(--state-off-ink))] after:!bg-[rgb(var(--state-off-ink))]",
            )}
          >
            {o.label}
            {o.note && <sup className="ml-1 align-super text-[9px] tracking-[0.12em] text-iron-400">{o.note}</sup>}
          </button>
        );
      })}
    </div>
  );
}
