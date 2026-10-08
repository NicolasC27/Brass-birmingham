import { Outlet, useLocation } from "react-router";
import Navbar from "@/components/Navbar";
import PlatformShell from "@/components/platform/PlatformShell";
import { usePageTitle } from "@/platform/title";

/**
 * App shell — nested-route (Outlet) pattern, matched by App.tsx.
 *
 * Two variants (refonte « Club Industriel », design.md §6) :
 * - `/game` and `/game/:code` keep the LEGACY shell: no platform component
 *   mounted, and a Navbar that is only scenery. The table covers the whole
 *   window, so the bar sits under it, inert — none of its links can be
 *   reached with Tab — and takes no room at the top of the page.
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
        {/* under the table, out of reach of the pointer, the keyboard and
            the screen reader alike */}
        <div inert aria-hidden="true">
          <Navbar />
        </div>
        <main className="flex-1">
          <Outlet />
        </main>
      </div>
    );
  }

  return <PlatformShell />;
}
