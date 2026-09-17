import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router'
/* Platform typefaces (design.md §3) — latin + latin-ext subsets included by default.
   Weights only: Fraunces 500/600 (display), Inter 400/500/600 (UI), Plex Mono 400/500 (data). */
import '@fontsource/fraunces/500.css'
import '@fontsource/fraunces/600.css'
import '@fontsource/inter/400.css'
import '@fontsource/inter/500.css'
import '@fontsource/inter/600.css'
import '@fontsource/ibm-plex-mono/400.css'
import '@fontsource/ibm-plex-mono/500.css'
import './index.css'
import './site.css'
import './site/theme'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <BrowserRouter>
    <App />
  </BrowserRouter>,
)
