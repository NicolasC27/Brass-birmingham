import { Routes, Route } from "react-router";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Setup from "@/pages/Setup";
import Game from "@/pages/Game";
import Rules from "@/pages/Rules";
import Results from "@/pages/Results";

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="setup" element={<Setup />} />
        <Route path="game" element={<Game />} />
        <Route path="rules" element={<Rules />} />
        <Route path="results" element={<Results />} />
      </Route>
    </Routes>
  );
}
