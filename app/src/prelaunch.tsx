import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
import { MotionConfig } from 'framer-motion'
/* the faces the preview sets: Fraunces for the titles, Spectral and Fell for
   the journal's hand, Inter and Plex Mono for the forms and the desk */
import '@fontsource/fraunces/300.css'
import '@fontsource/fraunces/400.css'
import '@fontsource/fraunces/400-italic.css'
import '@fontsource/fraunces/500.css'
import '@fontsource/fraunces/500-italic.css'
import '@fontsource/fraunces/600.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import '@fontsource/ibm-plex-mono/600.css'
import '@fontsource/spectral/400.css'
import '@fontsource/spectral/400-italic.css'
import '@fontsource/im-fell-english-sc/400.css'
import './index.css'
import LandingRoutes from './landing/LandingRoutes'

/* ------------------------------------------------------------------ */
/* The preview's own entry. Built with VITE_PRELAUNCH=1, it is the      */
/* whole site before the line opens: the landing, the letters' pages,   */
/* a two-round taste of the game (/demo, fetched on a click), the law   */
/* and the direction's desk. No other room of the site is reachable.    */
/* ------------------------------------------------------------------ */

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <MotionConfig reducedMotion="user">
      <LandingRoutes />
    </MotionConfig>
  </BrowserRouter>,
)
