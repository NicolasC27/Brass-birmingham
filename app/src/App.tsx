import { Routes, Route, Navigate } from "react-router";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Setup from "@/pages/Setup";
import Game from "@/pages/Game";
import Rules from "@/pages/Rules";
import Results from "@/pages/Results";
import Replay from "@/pages/Replay";
import Review from "@/pages/Review";
import Report from "@/pages/Report";
import Online from "@/pages/Online";
import Lobby from "@/pages/Lobby";
import Account from "@/pages/Account";
import Desk from "@/pages/Desk";
import Profile from "@/pages/Profile";
import Comptoir from "@/pages/Comptoir";
import Classement from "@/pages/Classement";
import Legal from "@/pages/Legal";
import Cours from "@/pages/Cours";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="setup" element={<Setup />} />
        <Route path="game" element={<Game />} />
        <Route path="game/local/:local" element={<Game />} />
        <Route path="game/:code" element={<Game />} />
        <Route path="rules" element={<Rules />} />
        <Route path="cours" element={<Cours />} />
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
  );
}
