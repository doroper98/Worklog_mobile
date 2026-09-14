import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import '@/styles/tokens.css'
import '@/styles/themes.css'
import '@/styles/themes-extra.css'
import '@/styles/yk-aliases.css'
import '@/styles/liquid-glass.css'
import '@/styles/markdown.css'
// After markdown.css so the copied island styles win equal-specificity ties
import '@/styles/islands.css'
import '@/styles/islands-theme.css'
import './index.css'

import { App } from '@/App'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
