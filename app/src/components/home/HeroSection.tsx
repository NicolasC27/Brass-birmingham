import { useRef } from "react";
import { Link } from "react-router";
import gsap from "gsap";
import { ScrollTrigger } from "gsap/ScrollTrigger";
import { useGSAP } from "@gsap/react";
import { ChevronDown } from "lucide-react";
import LogoMark from "@/components/LogoMark";
import { useT } from "@/i18n";

gsap.registerPlugin(ScrollTrigger);

const WORDMARK = "BRASSWORKS".split("");

/** Read any locally saved game (design.md §7.7 — autosave + Resume chip). */
function readSave(): { era: "rail" | "canal"; round: number } | null {
  try {
    const raw =
      localStorage.getItem("brassworks-save") ??
      localStorage.getItem("brassworks:save");
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    return {
      era: parsed?.era === "rail" ? "rail" : "canal",
      round: typeof parsed?.round === "number" ? parsed.round : 1,
    };
  } catch {
    return { era: "canal", round: 1 };
  }
}

/**
 * Section 1 — Hero Diorama ("Open the Box", home.md §1).
 * Full-bleed: opts out of the Layout nav offset with -mt-14 and re-pads itself.
 */
export default function HeroSection() {
  const root = useRef<HTMLElement>(null);
  const save = readSave();
  const t = useT();

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

      // Load sequence (~1.4s, 120ms stagger): black lift → logo → letters → tagline → CTAs
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.to(".hero-blackout", { opacity: 0, duration: reduced ? 0.15 : 0.5 })
        .fromTo(
          ".hero-logo",
          { opacity: 0, scale: 0.85 },
          { opacity: 1, scale: 1, duration: reduced ? 0.15 : 0.4 },
          "-=0.15",
        )
        .fromTo(
          ".hero-letter",
          { opacity: 0, y: 24 },
          { opacity: 1, y: 0, duration: reduced ? 0.15 : 0.5, stagger: 0.045 },
          "-=0.1",
        )
        .fromTo(
          [".hero-eyebrow", ".hero-tagline"],
          { opacity: 0, y: 14 },
          { opacity: 1, y: 0, duration: reduced ? 0.15 : 0.4, stagger: 0.12 },
          "-=0.25",
        )
        .fromTo(
          [".hero-resume", ".hero-ctas", ".hero-scrollhint"],
          { opacity: 0, y: 18 },
          { opacity: 1, y: 0, duration: reduced ? 0.15 : 0.45, stagger: 0.12, ease: "back.out(1.6)" },
          "-=0.1",
        );

      // Parallax: diorama at ~0.35x scroll speed, content fades out by 60% viewport
      gsap.to(".hero-bg", {
        yPercent: 22,
        ease: "none",
        scrollTrigger: { trigger: root.current, start: "top top", end: "bottom top", scrub: true },
      });
      gsap.to(".hero-content", {
        opacity: 0,
        ease: "none",
        scrollTrigger: { trigger: root.current, start: "top top", end: "60% top", scrub: true },
      });
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      className="relative -mt-14 flex min-h-[100svh] items-center justify-center overflow-hidden"
      aria-label={t("home.hero.ariaTitle")}
    >
      {/* Diorama background, darkened 25% */}
      <div className="hero-bg absolute inset-[-12%] will-change-transform">
        <img
          src="/hero-diorama.webp"
          alt={t("home.hero.dioramaAlt")}
          className="h-full w-full object-cover brightness-75"
        />
      </div>
      {/* Soot vignette (white-centre matte, multiply blend) */}
      <img
        src="/hero-vignette.webp"
        alt=""
        aria-hidden
        className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-90 mix-blend-multiply"
      />
      {/* Coal soot atmosphere at 8% */}
      <div aria-hidden className="tex-coal pointer-events-none absolute inset-0 opacity-[0.08]" />

      {/* Ambient smoke drift (single ambient effect) */}
      <div
        aria-hidden
        className="animate-smoke-drift-a pointer-events-none absolute left-[8%] top-[18%] h-[46vh] w-[34vw] rounded-full opacity-25 blur-3xl"
        style={{ background: "radial-gradient(closest-side, rgba(242,234,214,.35), transparent)" }}
      />
      <div
        aria-hidden
        className="animate-smoke-drift-b pointer-events-none absolute right-[6%] top-[38%] h-[52vh] w-[38vw] rounded-full opacity-20 blur-3xl"
        style={{ background: "radial-gradient(closest-side, rgba(166,86,43,.4), transparent)" }}
      />

      {/* Content column */}
      <div className="hero-content relative z-10 mx-auto flex max-w-[900px] flex-col items-center px-6 pb-24 pt-28 text-center">
        <div className="hero-logo opacity-0">
          <LogoMark size={64} />
        </div>

        <p className="hero-eyebrow mt-7 font-sans text-xs font-semibold uppercase tracking-[0.3em] text-brass-400 opacity-0">
          {t("home.hero.eyebrow")}
        </p>

        <h1
          className="mt-3 font-display font-black leading-none tracking-[-0.01em]"
          style={{ fontSize: "clamp(56px, 9vw, 96px)" }}
          aria-label={t("home.hero.wordmark")}
        >
          {WORDMARK.map((ch, i) => (
            <span key={i} aria-hidden className="hero-letter wordmark-gradient inline-block opacity-0">
              {ch}
            </span>
          ))}
        </h1>

        <p className="hero-tagline mt-5 max-w-xl font-fell text-[22px] leading-snug text-cream-100/90 opacity-0">
          {t("home.hero.tagline")}
        </p>

        {save && (
          <Link
            to="/game"
            className="hero-resume mt-7 inline-flex items-center gap-2.5 rounded-full border border-brass-500/70 bg-coal-900/70 px-4 py-1.5 font-sans text-xs font-semibold uppercase tracking-[0.12em] text-brass-400 opacity-0 backdrop-blur-sm transition-colors hover:border-brass-400 hover:text-brass-400"
          >
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-brass-400 opacity-75" />
              <span className="relative inline-flex h-2 w-2 rounded-full bg-brass-500" />
            </span>
            {t("home.hero.resume", {
              era: save.era === "rail" ? t("home.hero.eraRail") : t("home.hero.eraCanal"),
              round: save.round,
            })}
          </Link>
        )}

        <div className="hero-ctas mt-8 flex flex-col items-center gap-4 opacity-0 sm:flex-row">
          <Link
            to="/setup"
            className="btn-strike w-full sm:w-auto"
            style={{ minHeight: 52, fontSize: 18, padding: "14px 34px", letterSpacing: "0.06em" }}
          >
            {t("home.hero.ctaSetup")}
          </Link>
          <Link
            to="/rules"
            className="btn-ledger w-full sm:w-auto"
            style={{ minHeight: 52, fontSize: 15, padding: "14px 30px" }}
          >
            {t("home.hero.ctaRules")}
          </Link>
        </div>
      </div>

      {/* Bottom brass rule + scroll hint */}
      <div className="hero-scrollhint absolute inset-x-0 bottom-0 z-10 flex flex-col items-center gap-2 pb-5 opacity-0">
        <div className="divider-brass w-56" />
        <span className="mt-2 font-sans text-[11px] font-semibold uppercase tracking-[0.24em] text-cream-100/60">
          {t("home.hero.scrollHint")}
        </span>
        <ChevronDown className="animate-chevron-drift h-4 w-4 text-brass-500" aria-hidden />
      </div>

      {/* Load blackout */}
      <div aria-hidden className="hero-blackout pointer-events-none absolute inset-0 z-20 bg-coal-950" />
    </section>
  );
}
