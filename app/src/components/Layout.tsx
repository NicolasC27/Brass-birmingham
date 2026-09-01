import { Outlet, useLocation } from "react-router";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

/**
 * App shell — nested-route (Outlet) pattern, matched by App.tsx.
 *
 * The Navbar is a fixed overlay nav (design.md §6.1 / home.md), so Layout owns
 * the offset: the content slot carries `pt-14` (56px nav height) so every page
 * starts below the bar. Full-bleed hero sections opt out inside the page
 * (e.g. `-mt-14` + own top padding), never by removing this offset.
 *
 * Footer appears on Home and Rules only (design.md §6.11).
 */
export default function Layout() {
  const { pathname } = useLocation();
  const showFooter = pathname === "/" || pathname === "/rules";

  return (
    <div className="flex min-h-[100dvh] flex-col bg-coal-900">
      <Navbar />
      <main className="flex-1 pt-14">
        <Outlet />
      </main>
      {showFooter && <Footer />}
    </div>
  );
}
