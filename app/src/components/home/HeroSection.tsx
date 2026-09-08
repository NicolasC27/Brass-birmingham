import { useCallback, useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router";
import gsap from "gsap";
import { useGSAP } from "@gsap/react";
import { BookOpen, Play, RotateCcw, Users, Wifi } from "lucide-react";
import LogoMark from "@/components/LogoMark";
import ShutterWipe from "@/components/setup/ShutterWipe";
import { quickSetup, readResume, startQuickGame, startTutorial } from "@/game/quickplay";
import { isOnline } from "@/online/lobby";
import { useSession } from "@/online/session";
import { useT } from "@/i18n";

const WORDMARK = "BRASSWORKS".split("");

/**
 * The title screen — one viewport, and the board one click away.
 * Full-bleed: opts out of the Layout nav offset with -mt-14 and re-pads itself.
 */
export default function HeroSection() {
  const root = useRef<HTMLElement>(null);
  const navigate = useNavigate();
  const t = useT();
  const [starting, setStarting] = useState(false);
  const [save] = useState(readResume);
  const session = useSession();
  const rivals = quickSetup()
    .players.filter((p) => p.type === "bot")
    .map((p) => p.name);

  /* play now: dress the table and drop the shutter; the board opens behind it */
  const play = useCallback(() => {
    if (starting) return;
    startQuickGame();
    setStarting(true);
  }, [starting]);

  /* Enter plays (or resumes) — a title screen should answer the keyboard */
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Enter" || e.metaKey || e.ctrlKey || e.altKey) return;
      const tag = (e.target as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "BUTTON" || tag === "A") return;
      if (isOnline) navigate(session ? "/desk" : "/account");
      else if (save) navigate("/game");
      else play();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [save, play, navigate]);

  useGSAP(
    () => {
      const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
      const d = (n: number) => (reduced ? 0.15 : n);

      // Load sequence: black lift → logo → letters → tagline → the deck
      const tl = gsap.timeline({ defaults: { ease: "power3.out" } });
      tl.to(".hero-blackout", { opacity: 0, duration: d(0.5) })
        .fromTo(".hero-logo", { opacity: 0, scale: 0.85 }, { opacity: 1, scale: 1, duration: d(0.4) }, "-=0.15")
        .fromTo(".hero-letter", { opacity: 0, y: 24 }, { opacity: 1, y: 0, duration: d(0.5), stagger: 0.04 }, "-=0.1")
        .fromTo([".hero-eyebrow", ".hero-tagline"], { opacity: 0, y: 14 }, { opacity: 1, y: 0, duration: d(0.4), stagger: 0.1 }, "-=0.25")
        .fromTo(".hero-deck", { opacity: 0, y: 22 }, { opacity: 1, y: 0, duration: d(0.45), ease: "back.out(1.4)" }, "-=0.15")
        .fromTo(".hero-facts", { opacity: 0 }, { opacity: 1, duration: d(0.4) }, "-=0.2");
    },
    { scope: root },
  );

  return (
    <section
      ref={root}
      className="relative -mt-14 flex min-h-[100svh] items-center justify-center overflow-hidden"
      aria-label={t("home.hero.ariaTitle")}
    >
      {/* Diorama background, darkened, under a soot vignette */}
      <div className="hero-bg absolute inset-0">
        <img src="/hero-diorama.webp" alt={t("home.hero.dioramaAlt")} className="h-full w-full object-cover brightness-[0.7]" />
      </div>
      <img src="/hero-vignette.webp" alt="" aria-hidden className="pointer-events-none absolute inset-0 h-full w-full object-cover opacity-90 mix-blend-multiply" />
      <div aria-hidden className="tex-coal pointer-events-none absolute inset-0 opacity-[0.08]" />
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
      <div className="hero-content relative z-10 mx-auto flex w-full max-w-[760px] flex-col items-center px-6 pb-14 pt-24 text-center">
        <div className="hero-logo opacity-0">
          <LogoMark size={52} />
        </div>

        <p className="hero-eyebrow mt-5 font-sans text-[11px] font-semibold uppercase tracking-[0.3em] text-brass-400 opacity-0">{t("home.hero.eyebrow")}</p>

        <h1 className="mt-2 font-display font-black leading-none tracking-[-0.01em]" style={{ fontSize: "clamp(52px, 8vw, 84px)" }} aria-label={t("home.hero.wordmark")}>
          {WORDMARK.map((ch, i) => (
            <span key={i} aria-hidden className="hero-letter wordmark-gradient inline-block opacity-0">
              {ch}
            </span>
          ))}
        </h1>

        <p className="hero-tagline mt-3 max-w-lg font-fell text-[19px] leading-snug text-cream-100/85 opacity-0">{t("home.hero.tagline")}</p>

        {/* The command deck: play now, or pick your table */}
        <div className="hero-deck mt-8 w-full max-w-[560px] rounded-xl border border-brass-700/50 bg-coal-950/70 p-4 opacity-0 shadow-e3 backdrop-blur-md">
          {isOnline ? (
            <>
              <Link
                to={session ? "/desk" : "/account"}
                className="btn-strike w-full !rounded-lg !font-display !text-[22px] !font-bold normal-case !tracking-normal"
                style={{ minHeight: 64 }}
              >
                <Wifi className="h-5 w-5" aria-hidden />
                {session ? t("home.hero.desk", { name: session.name }) : t("home.hero.online")}
              </Link>
              <p className="mt-2.5 font-sans text-[12px] text-cream-100/60">{t("home.hero.onlineNote")}</p>
            </>
          ) : save ? (
            <>
              <Link
                to="/game"
                className="btn-strike w-full !rounded-lg !font-display !text-[20px] !font-bold normal-case !tracking-normal"
                style={{ minHeight: 60 }}
              >
                <Play className="h-5 w-5 fill-current" aria-hidden />
                {t("home.hero.resume", { era: save.era === "rail" ? t("home.hero.eraRail") : t("home.hero.eraCanal"), round: save.round })}
              </Link>
              <button
                type="button"
                onClick={play}
                className="mt-2 inline-flex items-center gap-1.5 font-sans text-[12px] font-semibold uppercase tracking-[0.12em] text-cream-100/60 transition-colors hover:text-brass-400"
              >
                <RotateCcw className="h-3.5 w-3.5" aria-hidden />
                {t("home.hero.quickNew")}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={play}
                disabled={starting}
                className="btn-strike w-full !rounded-lg !font-display !text-[22px] !font-bold normal-case !tracking-normal"
                style={{ minHeight: 64 }}
              >
                <Play className="h-5 w-5 fill-current" aria-hidden />
                {t("home.hero.quick")}
              </button>
              <p className="mt-2.5 font-sans text-[12px] text-cream-100/60">{t("home.hero.quickNote", { a: rivals[0] ?? "", b: rivals[1] ?? "" })}</p>
            </>
          )}

          <div className="mt-4 grid grid-cols-3 gap-2">
            <Link to="/setup" className="btn-ledger !px-2 !text-[11px] !tracking-[0.06em]">
              <Users className="h-3.5 w-3.5" aria-hidden />
              {t("home.hero.ctaSetup")}
            </Link>
            {isOnline ? (
              <button type="button" onClick={play} disabled={starting} className="btn-ledger !px-2 !text-[11px] !tracking-[0.06em]">
                <Play className="h-3.5 w-3.5" aria-hidden />
                {t("home.hero.practice")}
              </button>
            ) : (
              <Link to="/online" className="btn-ledger !px-2 !text-[11px] !tracking-[0.06em]">
                <Wifi className="h-3.5 w-3.5" aria-hidden />
                {t("home.hero.ctaOnline")}
              </Link>
            )}
            <Link to="/rules" className="btn-ledger !px-2 !text-[11px] !tracking-[0.06em]">
              <BookOpen className="h-3.5 w-3.5" aria-hidden />
              {t("home.hero.ctaRules")}
            </Link>
          </div>

          <button
            type="button"
            onClick={() => {
              if (starting) return;
              startTutorial();
              setStarting(true);
            }}
            className="mt-3 font-sans text-[11px] font-semibold uppercase tracking-[0.12em] text-cream-100/55 underline decoration-brass-700/60 underline-offset-4 transition-colors hover:text-brass-400"
          >
            {t("home.hero.tutorial")}
          </button>
          <p className="mt-3 font-sans text-[10px] uppercase tracking-[0.16em] text-cream-100/40">
            <kbd className="mr-1.5 rounded border border-brass-700/60 bg-coal-900 px-1.5 py-0.5 font-mono text-[10px] normal-case tracking-normal text-brass-400">↵</kbd>
            {t(isOnline ? "home.hero.enterDesk" : save ? "home.hero.enterResume" : "home.hero.enterPlay")}
          </p>
        </div>

        {/* what kind of game this is, in one line */}
        <ul className="hero-facts mt-6 flex flex-wrap items-center justify-center gap-x-5 gap-y-1 font-sans text-[11px] font-semibold uppercase tracking-[0.16em] text-cream-100/55 opacity-0">
          {(["players", "time", "solo", "online"] as const).map((k) => (
            <li key={k} className="flex items-center gap-2">
              <span aria-hidden className="h-1 w-1 rounded-full bg-brass-500" />
              {t(`home.hero.facts.${k}`)}
            </li>
          ))}
        </ul>
      </div>

      {/* Load blackout */}
      <div aria-hidden className="hero-blackout pointer-events-none absolute inset-0 z-20 bg-coal-950" />

      <ShutterWipe active={starting} onDone={() => navigate("/game")} />
    </section>
  );
}
