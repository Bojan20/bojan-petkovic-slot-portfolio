import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './styles/index.css'
import App from './App'

// Seed the phase attribute so body CSS vars apply immediately (avoids FOUC)
document.body.setAttribute('data-phase', 'boot')

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
