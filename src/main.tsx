import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App'
import { registerServiceWorker } from './sw-register'
import { registerPaintWorklets } from './engine/HoudiniPaint'

// Seed the phase attribute so body CSS vars apply immediately (avoids FOUC)
document.body.setAttribute('data-phase', 'boot')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)

// Service worker — production only. Registers after window.load so it
// never competes with the first paint. Second visit becomes instant.
registerServiceWorker()

// Register CSS Houdini paint worklets (cyberPattern circuit grid).
// No-op on Safari/Firefox — CSS gradient fallback in the consuming
// rules handles those browsers.
void registerPaintWorklets()
