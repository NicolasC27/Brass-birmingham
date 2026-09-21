import { Routes, Route, Navigate } from "react-router";
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
import Classement from "@/pages/Classement";
import Forum, { ForumBoard, ForumModeration, ForumThread } from "@/pages/Forum";
import Legal from "@/pages/Legal";

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
        <Route path="legal" element={<Legal />} />
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
        <Route path="classement" element={<Classement />} />
        <Route path="forum" element={<Forum />} />
        <Route path="forum/moderation" element={<ForumModeration />} />
        <Route path="forum/t/:id" element={<ForumThread />} />
        <Route path="forum/:board" element={<ForumBoard />} />
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
