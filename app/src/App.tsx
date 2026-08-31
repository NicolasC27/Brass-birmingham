import { lazy, Suspense } from "react";
import { Routes, Route } from "react-router";
import Layout from "@/components/Layout";
import Home from "@/pages/Home";
import Setup from "@/pages/Setup";
import Game from "@/pages/Game";
import Rules from "@/pages/Rules";
import Results from "@/pages/Results";

/* WebGL proof-of-concept — lazy so pixi.js stays out of the main bundle */
const GlLab = lazy(() => import("@/pages/GlLab"));

export default function App() {
  return (
    <Routes>
      <Route element={<Layout />}>
        <Route index element={<Home />} />
        <Route path="setup" element={<Setup />} />
        <Route path="game" element={<Game />} />
        <Route
          path="game-gl"
          element={
            <Suspense fallback={<div className="flex min-h-[60vh] items-center justify-center font-fell text-brass-400">Chargement du moteur WebGL…</div>}>
              <GlLab />
            </Suspense>
          }
        />
        <Route path="rules" element={<Rules />} />
        <Route path="results" element={<Results />} />
      </Route>
    </Routes>
  );
}
