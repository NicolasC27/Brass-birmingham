import { Suspense, lazy, useEffect, useState } from "react";
import { MotionConfig } from "framer-motion";
import { hydrateHome } from "@/game/home";
import { hydratePapers } from "@/platform/papers";
import { onlineWire } from "@/online/net";
import Unreachable from "@/components/platform/Unreachable";
import Boundary from "@/components/platform/Boundary";
import { Routes, Route, Navigate, useLocation } from "react-router";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import { PRELAUNCH } from "@/landing/office";

/* the front page and the shell come with the paper; every other page is
   fetched when first opened, so the journal opens light */
const Setup = lazy(() => import("@/pages/Setup"));
const Game = lazy(() => import("@/pages/Game"));
const Rules = lazy(() => import("@/pages/Rules"));
const Results = lazy(() => import("@/pages/Results"));
const Replay = lazy(() => import("@/pages/Replay"));
const Review = lazy(() => import("@/pages/Review"));
const Report = lazy(() => import("@/pages/Report"));
const Online = lazy(() => import("@/pages/Online"));
const Lobby = lazy(() => import("@/pages/Lobby"));
const Account = lazy(() => import("@/pages/Account"));
const Desk = lazy(() => import("@/pages/Desk"));
const Profile = lazy(() => import("@/pages/Profile"));
const Comptoir = lazy(() => import("@/pages/Comptoir"));
const Classement = lazy(() => import("@/pages/Classement"));
const Legal = lazy(() => import("@/pages/Legal"));
const Cours = lazy(() => import("@/pages/Cours"));
const Almanach = lazy(() => import("@/pages/Almanach"));
const Defis = lazy(() => import("@/pages/Defis"));
const Tableau = lazy(() => import("@/pages/Tableau"));
const Glossaire = lazy(() => import("@/pages/Glossaire"));
const Services = lazy(() => import("@/pages/Services"));
/* the preview and its waiting list: a sheet of its own, which never opens the socket */
const LandingRoutes = lazy(() => import("@/landing/LandingRoutes"));
/* the test bench, for the developer's own builds: the route does not exist
   in a production build, and the import goes with it */
const Admin = import.meta.env.DEV ? lazy(() => import("@/admin/AdminPage")) : null;

/* a line while a page is fetched */
function Arriving() {
  return <p className="mx-auto max-w-[1240px] px-8 py-16 text-center font-serif text-[14px] italic text-paper-300">…</p>;
}

/* before the line opens, every address is the preview's but the direction's
   own way in: its desk, and the account page it signs in on */
const BACKSTAGE = /^\/(direction|account)(\/|$)/;

export default function App() {
  const { pathname } = useLocation();
  const preview = pathname === "/avant-premiere" || pathname.startsWith("/avant-premiere/") || (PRELAUNCH && !BACKSTAGE.test(pathname));
  if (preview) {
    return (
      <MotionConfig reducedMotion="user">
        <Boundary>
          <Suspense fallback={<Arriving />}>
            <LandingRoutes />
          </Suspense>
        </Boundary>
      </MotionConfig>
    );
  }
  return <Journal />;
}

function Journal() {
  /* the register of games at home and the papers that follow the account are
     the office's: both are read once, here, before any page asks what is on
     them. A browser that cannot reach the office simply has none */
  const [read, setRead] = useState<'reading' | 'ready' | 'unreachable'>('reading');
  useEffect(() => {
    /* the papers first: the lift inside `hydrateHome` sends up only the ones
       the office keeps none of, and must know what it keeps */
    const wire = onlineWire();
    void (async () => {
      /* the line first: an office that does not answer is said so in a few
         seconds, rather than waited on until every request has timed out.
         No office configured at all is the same answer — the games are kept
         there, and a build that cannot reach one cannot play */
      if (!wire || !(await wire.ready())) {
        setRead('unreachable');
        return;
      }
      await hydratePapers();
      await hydrateHome();
      setRead('ready');
    })();
  }, []);
  if (read === 'reading') return <Arriving />;
  if (read === 'unreachable') return <Unreachable />;
  return (
    /* a reader who has asked for stillness gets it everywhere: the stylesheet
       can only quiet what CSS animates, never the frames Framer writes itself */
    <MotionConfig reducedMotion="user">
    <Boundary>
    <Suspense fallback={<Arriving />}>
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="setup" element={<Setup />} />
        <Route path="game" element={<Game />} />
        <Route path="game/local/:local" element={<Game />} />
        <Route path="game/:code" element={<Game />} />
        <Route path="rules" element={<Rules />} />
        <Route path="cours" element={<Cours />} />
        <Route path="almanach" element={<Almanach />} />
        <Route path="defis" element={<Defis />} />
        <Route path="tableau" element={<Tableau />} />
        <Route path="glossaire" element={<Glossaire />} />
        <Route path="services" element={<Services />} />
        <Route path="legal" element={<Legal />} />
        <Route path="results" element={<Results />} />
        <Route path="replay" element={<Replay />} />
        <Route path="review" element={<Review />} />
        <Route path="report" element={<Report />} />
        <Route path="online" element={<Online />} />
        <Route path="online/:code" element={<Lobby />} />
        <Route path="account" element={<Account />} />
        <Route path="account/verify/:token" element={<Account />} />
        <Route path="account/reset/:token" element={<Account />} />
        <Route path="desk" element={<Desk />} />
        <Route path="office" element={<Desk />} />
        <Route path="profile" element={<Profile />} />
        <Route path="comptoir" element={<Comptoir />} />
        <Route path="classement" element={<Classement />} />
        {Admin && <Route path="admin" element={<Admin />} />}
        {/* the hall's old addresses lead to the club's rooms */}
        <Route path="play" element={<Navigate to="/online" replace />} />
        <Route path="tables" element={<Navigate to="/online#tables" replace />} />
        <Route path="ranking" element={<Navigate to="/classement" replace />} />
        <Route path="counter" element={<Navigate to="/comptoir" replace />} />
        <Route path="record" element={<Navigate to="/profile" replace />} />
      </Route>
    </Routes>
    </Suspense>
    </Boundary>
    </MotionConfig>
  );
}
