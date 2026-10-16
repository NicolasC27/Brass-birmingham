import { Navigate, Route, Routes } from 'react-router';
import Legal from '@/pages/Legal';
import LandingShell from './LandingShell';
import Front from './Front';
import { Confirm, Leave } from './Answer';
import { PRELAUNCH, PREVIEW } from './office';

/* ------------------------------------------------------------------ */
/* The preview's addresses. Before the line opens (VITE_PRELAUNCH=1)    */
/* they are the whole site: the front page at the root, the law, the   */
/* two pages the letters lead to, and every other address sent back to */
/* the front page. After, the preview stays under /avant-premiere.     */
/* None of them opens the socket: the office is asked over HTTP.       */
/* ------------------------------------------------------------------ */

export default function LandingRoutes() {
  return (
    <Routes>
      <Route element={<LandingShell />}>
        <Route path="avant-premiere" element={<Front />} />
        <Route path="avant-premiere/confirmer/:token" element={<Confirm />} />
        <Route path="avant-premiere/retrait/:token" element={<Leave />} />
        {PRELAUNCH && <Route index element={<Front />} />}
        {PRELAUNCH && <Route path="legal" element={<Legal />} />}
        <Route path="*" element={<Navigate to={PREVIEW} replace />} />
      </Route>
    </Routes>
  );
}
