import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@/styles/tokens.css'
import '@/styles/themes.css'
import '@/styles/liquid-glass.css'
import '@/styles/markdown.css'
import './index.css'

import { App } from '@/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
