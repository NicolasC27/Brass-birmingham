import { Suspense, lazy } from 'react';
import { Navigate, Route, Routes } from 'react-router';
import Legal from '@/pages/Legal';
import LandingShell from './LandingShell';
import Front from './Front';
import { Confirm, Leave } from './Answer';
import { PRELAUNCH, PREVIEW } from './office';

/* the direction's desk rides with the preview only before the line opens:
   after, the journal carries it */
/* the game itself, fetched only when a visitor asks to play */
const Demo = lazy(() => import('./Demo'));
const Direction = PRELAUNCH ? lazy(() => import('@/pages/Direction')) : null;
const DirectionVerify = PRELAUNCH ? lazy(() => import('@/pages/Direction').then((m) => ({ default: m.DirectionVerify }))) : null;

/* ------------------------------------------------------------------ */
/* The preview's addresses. Before the line opens (VITE_PRELAUNCH=1)   */
/* they are the whole site: the front page at the root, the law, the   */
/* two pages the letters lead to, the direction's desk, and every      */
/* other address sent back to the front page. After, the preview stays */
/* under /avant-premiere. Only the desk opens the socket; the rest     */
/* asks the office over HTTP.                                          */
/* ------------------------------------------------------------------ */

export default function LandingRoutes() {
  return (
    <Routes>
      <Route
        path="demo"
        element={
          <Suspense fallback={null}>
            <Demo />
          </Suspense>
        }
      />
      <Route element={<LandingShell />}>
        <Route path="avant-premiere" element={<Front />} />
        <Route path="avant-premiere/confirmer/:token" element={<Confirm />} />
        <Route path="avant-premiere/retrait/:token" element={<Leave />} />
        {PRELAUNCH && <Route index element={<Front />} />}
        {PRELAUNCH && <Route path="legal" element={<Legal />} />}
        {DirectionVerify && (
          <Route
            path="account/verify/:token"
            element={
              <Suspense fallback={null}>
                <DirectionVerify />
              </Suspense>
            }
          />
        )}
        {Direction && (
          <Route
            path="direction"
            element={
              <Suspense fallback={null}>
                <Direction />
              </Suspense>
            }
          />
        )}
        <Route path="*" element={<Navigate to={PREVIEW} replace />} />
      </Route>
    </Routes>
  );
}
