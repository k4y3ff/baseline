import './assets/main.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { installBaseline } from './lib/baseline'

// Install the correct window.baseline bridge, then render.
// Awaiting ensures the Capacitor bridge is ready before any component mounts.
// On Electron and browser dev this resolves immediately.
installBaseline().then(() => {
  ReactDOM.createRoot(document.getElementById('root')!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  )
})
