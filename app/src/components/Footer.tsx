import { Link } from "react-router";
import { useT } from "@/i18n";

/**
 * Footer (design.md §6.11) — coal-950, top brass rule, three columns.
 * Rendered by Layout on the Home and Rules pages.
 */
export default function Footer() {
  const t = useT();
  return (
    <footer className="relative border-t border-brass-700/50 bg-coal-950">
      <div
        aria-hidden
        className="tex-coal pointer-events-none absolute inset-0 opacity-[0.08]"
      />
      <div className="relative mx-auto grid max-w-[1200px] gap-10 px-6 py-14 md:grid-cols-3">
        <div>
          <div className="flex items-center gap-2.5">
            <img src="/logo-mark.svg" alt="" className="h-8 w-8" />
            <span className="engraved-brass font-display text-lg font-black tracking-wide text-brass-500">
              BRASSWORKS
            </span>
          </div>
          <p className="mt-3 max-w-xs font-fell text-sm text-cream-100/70">
            {t("home.footer.tagline")}
          </p>
        </div>

        <nav aria-label={t("home.footer.navAria")} className="flex flex-col gap-2.5">
          <span className="eyebrow mb-1">{t("home.footer.gameEyebrow")}</span>
          {[
            { to: "/setup", label: t("home.footer.setTable") },
            { to: "/online", label: t("site.nav.desk") },
            { to: "/rules", label: t("home.footer.rulesCodex") },
            { to: "/results", label: t("home.footer.bilan") },
          ].map(({ to, label }) => (
            <Link
              key={to}
              to={to}
              className="w-fit font-sans text-sm text-cream-100/75 transition-colors hover:text-brass-400"
            >
              {label}
            </Link>
          ))}
        </nav>

        <div className="flex flex-col gap-2.5 md:text-right">
          <span className="eyebrow mb-1">{t("home.footer.colophonEyebrow")}</span>
          <p className="font-sans text-[11px] leading-relaxed text-cream-100/50">
            {t("home.footer.colophon1")}
          </p>
          <p className="font-fell text-[11px] text-cream-100/40">
            {t("home.footer.colophon2")}
          </p>
        </div>
      </div>
    </footer>
  );
}
