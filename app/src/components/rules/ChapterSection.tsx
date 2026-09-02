import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

interface ChapterSectionProps {
  id: string;
  numeral: string;
  title: string;
  children: ReactNode;
  className?: string;
}

/**
 * One chapter of the codex. The H2 is split into word spans so the page's
 * GSAP pass can give it a word-level rise; the brass rule under it draws
 * (scaleX 0→1). Direct children of `.rules-body` receive the 16px
 * fade-rise, 60ms stagger. All animation initial states are applied by
 * GSAP (never CSS), so reduced-motion readers simply see the content.
 */
export default function ChapterSection({
  id,
  numeral,
  title,
  children,
  className,
}: ChapterSectionProps) {
  const words = title.split(" ");
  return (
    <section
      id={id}
      aria-labelledby={`${id}-heading`}
      className={cn("scroll-mt-24 pt-14", className)}
      data-chapter={id}
    >
      <header className="rules-chapter-head">
        <span className="font-fell text-sm tracking-[0.2em] text-copper-500">
          {numeral}
        </span>
        <h2
          id={`${id}-heading`}
          className="mt-1 overflow-hidden font-display text-[28px] font-black leading-[1.15] text-ink-900 md:text-[34px]"
        >
          {words.map((w, i) => (
            <span key={i} className="rules-h2w inline-block will-change-transform">
              {w}
              {i < words.length - 1 ? " " : ""}
            </span>
          ))}
        </h2>
        <div
          aria-hidden
          className="rules-h2line mt-3 h-px origin-left bg-gradient-to-r from-brass-700/80 via-brass-500/60 to-transparent"
        />
      </header>
      <div className="rules-body mt-6 space-y-5 font-sans text-[15px] leading-[1.65] text-ink-900/85">
        {children}
      </div>
    </section>
  );
}
