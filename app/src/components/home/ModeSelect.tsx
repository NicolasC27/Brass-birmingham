import { useRef } from "react";
import { Link } from "react-router";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { Mail } from "lucide-react";
import { cn } from "@/lib/utils";
import { useT } from "@/i18n";

gsap.registerPlugin(ScrollTrigger);

type Mode = {
  title: string;
  copy: string;
  cta: string;
  to?: string;
  icon: React.ReactNode;
  tag?: string;
  disabled?: boolean;
  tooltip?: string;
};

/** Section 2 — Mode Select ("Choose Your Game", home.md §2). */
export default function ModeSelect() {
  const root = useRef<HTMLElement>(null);
  const t = useT();

  const MODES: Mode[] = [
    {
      title: t("home.modes.solo.title"),
      copy: t("home.modes.solo.copy"),
      cta: t("home.modes.solo.cta"),
      to: "/setup?mode=solo",
      icon: <img src="/icon-develop.svg" alt="" className="h-9 w-9 text-ink-900" />,
    },
    {
      title: t("home.modes.hotseat.title"),
      copy: t("home.modes.hotseat.copy"),
      cta: t("home.modes.hotseat.cta"),
      to: "/setup?mode=hotseat",
      icon: <img src="/icon-loan.svg" alt="" className="h-9 w-9 text-ink-900" />,
      tag: t("home.modes.hotseat.tag"),
    },
    {
      title: t("home.modes.correspondence.title"),
      copy: t("home.modes.correspondence.copy"),
      cta: t("home.modes.inTheWorks"),
      icon: <Mail className="h-9 w-9 text-ink-900" strokeWidth={1.8} />,
      disabled: true,
      tooltip: t("home.modes.correspondence.tooltip"),
    },
  ];

  useGSAP(
    () => {
      gsap.fromTo(
        ".mode-card",
        { opacity: 0, y: 40, rotate: 1.5 },
        {
          opacity: 1,
          y: 0,
          rotate: 0,
          duration: 0.7,
          ease: "power3.out",
          stagger: 0.12,
          scrollTrigger: { trigger: root.current, start: "top 75%" },
        },
      );
    },
    { scope: root },
  );

  return (
    <section ref={root} className="relative bg-coal-900" aria-label={t("home.modes.aria")}>
      <div aria-hidden className="tex-coal pointer-events-none absolute inset-0 opacity-[0.06]" />
      <div className="relative mx-auto max-w-[1200px] px-6 py-24">
        <header className="text-center">
          <p className="eyebrow">{t("home.modes.eyebrow")}</p>
          <h2 className="mt-3 font-display text-[34px] font-bold text-cream-100">
            {t("home.modes.title")}
          </h2>
          <div className="divider-brass mt-6 w-64" />
        </header>

        <div className="mt-14 grid gap-6 md:grid-cols-3">
          {MODES.map((mode) => (
            <article
              key={mode.title}
              className={cn(
                "mode-card group relative flex h-[340px] flex-col items-center overflow-hidden rounded-lg border border-brass-700/50 bg-coal-700 px-7 pb-7 pt-9 text-center shadow-e2 transition-all duration-300",
                mode.disabled
                  ? "opacity-60"
                  : "hover:-translate-y-2 hover:border-brass-500 hover:shadow-e3-hover",
              )}
            >
              {mode.disabled && <span className="beta-ribbon">{t("home.modes.inTheWorks")}</span>}

              {/* Engraved medallion */}
              <div className="sheen plaque relative flex h-[72px] w-[72px] items-center justify-center rounded-full">
                {mode.icon}
              </div>

              <h3 className="mt-5 font-fell text-lg uppercase tracking-[0.06em] text-cream-100">
                {mode.title}
              </h3>
              <p className="mt-3 flex-1 text-sm leading-relaxed text-cream-100/80">
                {mode.copy}
              </p>

              {mode.tag && !mode.disabled && (
                <span className="mb-3 rounded-sm border border-bottle-600 bg-bottle-800 px-2.5 py-1 font-sans text-[10px] font-semibold uppercase tracking-[0.14em] text-cream-100/85">
                  {mode.tag}
                </span>
              )}

              {mode.disabled ? (
                <span className="btn-ledger cursor-not-allowed opacity-60" aria-disabled>
                  {mode.cta}
                </span>
              ) : (
                <Link to={mode.to!} className="btn-ledger">
                  {mode.cta}
                </Link>
              )}

              {/* Tooltip for the disabled card */}
              {mode.disabled && mode.tooltip && (
                <div
                  role="tooltip"
                  className="pointer-events-none absolute inset-x-6 top-6 z-10 translate-y-2 rounded-lg border border-brass-700/70 bg-coal-900/95 p-3 text-left font-sans text-xs leading-relaxed text-cream-100/90 opacity-0 shadow-e3 transition-all duration-150 group-hover:translate-y-0 group-hover:opacity-100"
                >
                  {mode.tooltip}
                </div>
              )}
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
