import { Routes, Route } from "react-router";
import HallShell from "@/components/hall/HallShell";
import Play from "@/pages/hall/Play";
import Tables from "@/pages/hall/Tables";
import Ranking from "@/pages/hall/Ranking";
import Counter from "@/pages/hall/Counter";
import Record from "@/pages/hall/Record";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Setup from "@/pages/Setup";
import Game from "@/pages/Game";
import Rules from "@/pages/Rules";
import Results from "@/pages/Results";
import Replay from "@/pages/Replay";
import Online from "@/pages/Online";
import Lobby from "@/pages/Lobby";
import Account from "@/pages/Account";
import Desk from "@/pages/Desk";
import Profile from "@/pages/Profile";
import Comptoir from "@/pages/Comptoir";

export default function App() {
  return (
    <Routes>
      {/* the hall: the site as a game client, its own frame */}
      <Route element={<HallShell />}>
        <Route path="play" element={<Play />} />
        <Route path="tables" element={<Tables />} />
        <Route path="ranking" element={<Ranking />} />
        <Route path="counter" element={<Counter />} />
        <Route path="record" element={<Record />} />
      </Route>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="setup" element={<Setup />} />
        <Route path="game" element={<Game />} />
        <Route path="game/:code" element={<Game />} />
        <Route path="rules" element={<Rules />} />
        <Route path="results" element={<Results />} />
        <Route path="replay" element={<Replay />} />
        <Route path="online" element={<Online />} />
        <Route path="online/:code" element={<Lobby />} />
        <Route path="account" element={<Account />} />
        <Route path="account/verify/:token" element={<Account />} />
        <Route path="account/reset/:token" element={<Account />} />
        <Route path="desk" element={<Desk />} />
        <Route path="office" element={<Desk />} />
        <Route path="profile" element={<Profile />} />
        <Route path="comptoir" element={<Comptoir />} />
      </Route>
    </Routes>
  );
}
