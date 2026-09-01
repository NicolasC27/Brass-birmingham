import { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router";
import { Volume2, VolumeX, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLang, useT, setLang } from "@/i18n";

const NAV_LINKS = [
  { to: "/", key: "common.nav.title" },
  { to: "/setup", key: "common.nav.setup" },
  { to: "/game", key: "common.nav.game" },
  { to: "/rules", key: "common.nav.rules" },
  { to: "/results", key: "common.nav.results" },
];

/**
 * Top Bar (design.md §6.1) — 56px, fixed overlay nav.
 * Transparent over the hero, gains coal-900 + engraved brass rule after 40px
 * of scroll (and is always solid off the title screen).
 * Layout owns the matching top offset; pages do not compensate.
 */
export default function Navbar() {
  const [scrolled, setScrolled] = useState(false);
  const [muted, setMuted] = useState(true);
  const t = useT();
  const lang = useLang();
  const { pathname } = useLocation();
  const solid = scrolled || pathname !== "/";

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 40);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <header
      className={cn(
        "fixed top-0 z-50 h-14 w-full transition-colors duration-300",
        solid
          ? "border-b border-brass-700/50 bg-coal-900/95 backdrop-blur-sm"
          : "border-b border-transparent bg-transparent",
      )}
    >
      {/* paper-grain on the bar at 6% */}
      <div
        aria-hidden
        className="tex-paper pointer-events-none absolute inset-0 opacity-[0.06]"
      />
      <div className="relative mx-auto flex h-full max-w-[1440px] items-center justify-between px-6">
        {/* Wordmark */}
        <Link to="/" className="group flex items-center gap-2.5">
          <img
            src="/logo-mark.svg"
            alt=""
            className="h-7 w-7 transition-transform duration-500 group-hover:rotate-45"
          />
          <span className="engraved-brass font-display text-lg font-black tracking-wide text-brass-500">
            BRASSWORKS
          </span>
        </Link>

        {/* Center nav */}
        <nav aria-label="Primary" className="absolute left-1/2 hidden -translate-x-1/2 items-center gap-7 md:flex">
          {NAV_LINKS.map(({ to, key }) => (
            <NavLink
              key={to}
              to={to}
              end={to === "/"}
              className={({ isActive }) =>
                cn(
                  "font-sans text-xs font-semibold uppercase tracking-[0.12em] transition-colors",
                  isActive
                    ? "text-brass-400"
                    : "text-cream-100/70 hover:text-brass-500",
                )
              }
            >
              {t(key)}
            </NavLink>
          ))}
        </nav>

        {/* Right chrome */}
        <div className="flex items-center gap-2">
          {/* FR / EN switch */}
          <div
            role="group"
            aria-label={t("common.chrome.language")}
            className="flex items-center overflow-hidden rounded-md border border-brass-700/60"
          >
            {(["fr", "en"] as const).map((l) => (
              <button
                key={l}
                type="button"
                aria-pressed={lang === l}
                onClick={() => setLang(l)}
                className={cn(
                  "px-2 py-1.5 font-sans text-[10px] font-bold uppercase tracking-[0.12em] transition-colors",
                  lang === l ? "bg-brass-400 text-ink-900" : "text-cream-100/60 hover:text-brass-400",
                )}
              >
                {l}
              </button>
            ))}
          </div>
          <button
            type="button"
            aria-label={muted ? t("common.chrome.unmute") : t("common.chrome.mute")}
            aria-pressed={!muted}
            onClick={() => setMuted((m) => !m)}
            className="rounded-md p-2 text-cream-100/70 transition-colors hover:text-brass-400"
          >
            {muted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            aria-label={t("common.chrome.settings")}
            className="rounded-md p-2 text-cream-100/70 transition-colors hover:text-brass-400"
          >
            <Settings className="h-4 w-4" />
          </button>
        </div>
      </div>
    </header>
  );
}
