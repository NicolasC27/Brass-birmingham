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
 */
export default function Segmented<T extends string>({
  value,
  onChange,
  options,
  ariaLabel,
  className,
}: {
  value: T;
  onChange: (value: T) => void;
  options: SegmentedOption<T>[];
  ariaLabel: string;
  className?: string;
}) {
  return (
    <div role="radiogroup" aria-label={ariaLabel} className={cn("inline-flex items-center gap-4 border-b border-[var(--gz-ink-faint)]", className)}>
      {options.map((o) => {
        const active = o.value === value;
        return (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={active}
            disabled={o.disabled}
            onClick={() => onChange(o.value)}
            className={cn("gz-nav-link !py-1.5 !text-[10.5px]", active && "is-active", o.disabled && "cursor-not-allowed opacity-40")}
          >
            {o.label}
          </button>
        );
      })}
    </div>
  );
}
