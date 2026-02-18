import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import config from './resources/config/config.ts'

// Initialize i18n for multi-language support
import './i18n'

// Production security: block DevTools, right-click, console output
import initDevToolsGuard from './utils/devtools-guard'
initDevToolsGuard()

// ─── App Version ────────────────────────────────────────────────────────────
// Expose version globally so team can check via DevTools console:
//   Type: __HUSHH_VERSION__  →  { version, built }
// This survives production minification (unlike console.log which is stripped)
;(window as any).__HUSHH_VERSION__ = {
  version: __APP_VERSION__,
  built: __BUILD_TIMESTAMP__,
}
// Also update the HTML meta tag dynamically
document.querySelector('meta[name="app-version"]')?.setAttribute('content', __APP_VERSION__)

// Import DM Sans font weights
import "@fontsource/dm-sans/400.css";
import "@fontsource/dm-sans/500.css";
import "@fontsource/dm-sans/600.css";
import "@fontsource/dm-sans/700.css";

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
