import { Suspense, lazy, useEffect, useState } from "react";
import { hydrateHome } from "@/game/home";
import { hydratePapers } from "@/platform/papers";
import Boundary from "@/components/platform/Boundary";
import { Routes, Route, Navigate } from "react-router";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";

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

/* a line while a page is fetched */
function Arriving() {
  return <p className="mx-auto max-w-[1240px] px-8 py-16 text-center font-serif text-[14px] italic text-paper-300">…</p>;
}

export default function App() {
  /* the register of games at home and the papers that follow the account are
     the office's: both are read once, here, before any page asks what is on
     them. A browser that cannot reach the office simply has none */
  const [read, setRead] = useState(false);
  useEffect(() => {
    /* the papers first: the lift inside `hydrateHome` sends up only the ones
       the office keeps none of, and must know what it keeps */
    void hydratePapers()
      .then(hydrateHome)
      .finally(() => setRead(true));
  }, []);
  if (!read) return <Arriving />;
  return (
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
  );
}
