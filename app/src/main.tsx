import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
/* Platform typefaces (design.md §3) — latin + latin-ext subsets included by default.
   Weights only: Fraunces 500/600 (display), Inter 400/500/600 (UI), Plex Mono 400/500 (data). */
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
import './index.css'
import App from './App.tsx'
import { installDesktopZoom } from './desktop/zoom'

void installDesktopZoom()

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
)
