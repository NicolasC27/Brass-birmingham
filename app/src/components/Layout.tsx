import { Outlet, useLocation } from "react-router";
import Navbar from "@/components/Navbar";
import PlatformShell from "@/components/platform/PlatformShell";
import { usePageTitle } from "@/platform/title";

/**
 * App shell — nested-route (Outlet) pattern, matched by App.tsx.
 *
 * Two variants (refonte « Club Industriel », design.md §6) :
 * - `/game` and `/game/:code` keep the LEGACY shell, strictly unchanged —
 *   fixed overlay Navbar, `pt-14` offset, no platform component mounted.
 * - every other route (including `/results` and `/replay`) renders the new
 *   PlatformShell (TopBar + StatusStrip + compact footer + mobile tab bar).
 */
export default function Layout() {
  const { pathname } = useLocation();
  /* every address answers to its own name in the tab, the board included */
  usePageTitle();
  const isGame = pathname === "/game" || pathname.startsWith("/game/");
  /* the departures board stands alone on its screen: no shell at all */
  if (pathname === "/tableau") return <div className="platform-root"><Outlet /></div>;

  if (isGame) {
    return (
      <div className="flex min-h-[100dvh] flex-col bg-coal-900">
        <Navbar />
        <main className="flex-1 pt-14">
          <Outlet />
        </main>
      </div>
    );
  }

  return <PlatformShell />;
}
