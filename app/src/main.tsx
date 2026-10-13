import { createRoot } from 'react-dom/client'

/* the porter: once built, the shell and the pictures are kept for the road */
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => void navigator.serviceWorker.register('/sw.js').catch(() => undefined))
}
import { BrowserRouter } from 'react-router'
/* Platform typefaces (design.md §3) — latin + latin-ext subsets included by default.
   Weights only: Fraunces 500/600 (display), Inter 400/500/600 (UI), Plex Mono 400/500/600
   (data — the 600 was drawn from the Google sheet, which asked for a face already held here). */
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
/* the journal's own hands, kept here rather than asked of Google: Spectral
   400 and its italic (the body and the standfirst — no heavier weight is
   set anywhere), IM Fell English SC (the eyebrows and the plates' titles).
   Playfair Display and Archivo still come from Google for /game */
import '@fontsource/spectral/400.css'
import '@fontsource/spectral/400-italic.css'
import '@fontsource/im-fell-english-sc/400.css'
import './index.css'
import App from './App.tsx'
import { installDesktopZoom } from './desktop/zoom'
import { installFaultReports } from './platform/errors'

installFaultReports()

void installDesktopZoom()

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
)
