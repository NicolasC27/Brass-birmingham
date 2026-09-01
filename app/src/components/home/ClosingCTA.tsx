import { useRef } from "react";
import { Link } from "react-router";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { useT } from "@/i18n";

gsap.registerPlugin(ScrollTrigger);

/** Section 5 — Closing CTA ("Take Your Seat", home.md §5). */
export default function ClosingCTA() {
  const root = useRef<HTMLElement>(null);
  const t = useT();

  useGSAP(
    () => {
      gsap.fromTo(
        ".closing-plaque",
        { opacity: 0, scale: 0.94, y: 30 },
        {
          opacity: 1,
          scale: 1,
          y: 0,
          duration: 0.7,
          ease: "power3.out",
          scrollTrigger: { trigger: root.current, start: "top 60%" },
        },
      );
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      className="relative flex min-h-[70vh] items-center justify-center overflow-hidden"
      aria-label={t("home.closing.aria")}
    >
      {/* Mahogany table, darkened 55%, with heavy soot vignette */}
      <div aria-hidden className="tex-wood absolute inset-0 brightness-[0.45]" />
      <div
        aria-hidden
        className="absolute inset-0"
        style={{
          background:
            "radial-gradient(ellipse 70% 60% at 50% 45%, transparent 30%, rgba(16,13,11,.88) 100%)",
        }}
      />

      <div className="closing-plaque plaque plaque-rivets relative z-10 mx-6 w-full max-w-[480px] overflow-hidden px-10 py-12 text-center opacity-0">
        {/* Slow brass sheen loop across the plaque */}
        <div
          aria-hidden
          className="pointer-events-none absolute inset-y-[-20%] left-0 w-[45%] animate-[sheen-sweep_8s_ease-in-out_infinite]"
          style={{
            background:
              "linear-gradient(100deg, transparent, rgba(242,234,214,.14), transparent)",
            transform: "skewX(-18deg)",
          }}
        />
        <h2 className="engraved-brass font-display text-[40px] font-black leading-tight">
          {t("home.closing.title")}
        </h2>
        <p className="mt-3 font-fell text-lg text-ink-900/85">
          {t("home.closing.body")}
        </p>
        <div className="mt-8 flex flex-col items-center gap-4">
          <Link
            to="/setup"
            className="btn-strike animate-pulse-glow"
            style={{ minHeight: 52, fontSize: 16, padding: "14px 34px", animationIterationCount: "infinite" }}
          >
            {t("home.closing.ctaSetup")}
          </Link>
          <Link
            to="/rules"
            className="font-sans text-sm font-semibold text-ink-900/80 underline decoration-brass-700/60 underline-offset-4 transition-colors hover:text-ink-900"
          >
            {t("home.closing.ctaRules")}
          </Link>
        </div>
      </div>
    </section>
  );
}
