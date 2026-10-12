import type { ReactNode } from "react";
import { Link } from "react-router";
import { cn } from "@/lib/utils";

/**
 * The notice a page after the table prints when it has nothing to show:
 * the rubric, the title, one sentence saying why, and the ways on. The
 * results, the replay, the review and the report share it, so the four
 * say "nothing here" in the same hand, at the page's own margin, on the
 * register's paper and in its ink, by day as by night.
 */
export default function EmptyNotice({
  eyebrow,
  title,
  children,
  actions,
}: {
  eyebrow: string;
  title: string;
  children: ReactNode;
  /** the ways on: the first is the one the page expects to be taken */
  actions: { to: string; label: string; icon?: ReactNode }[];
}) {
  return (
    <div className="gz-measure pb-16 pt-10">
      <header>
        <p className="eyebrow-fell">{eyebrow}</p>
        <h1 className="display-page mt-2">{title}</h1>
      </header>
      <div aria-hidden className="gz-rule-double mt-5 max-w-[640px]" />
      <p className="mt-5 max-w-[62ch] font-ui text-[15px] leading-relaxed text-paper-300">{children}</p>
      <div className="mt-7 flex flex-wrap items-center gap-3">
        {actions.map((a, i) => (
          <Link key={a.to} to={a.to} className={cn("gz-ticket", i === 0 && "gz-ticket-brass")}>
            {a.icon}
            {a.label}
          </Link>
        ))}
      </div>
    </div>
  );
}
