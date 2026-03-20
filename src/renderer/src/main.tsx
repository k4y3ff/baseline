import './assets/main.css'
import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import { installDevMock } from './lib/devMock'

// Install browser mock when running outside Electron (dev preview / testing)
if (import.meta.env.DEV) {
  installDevMock()
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
)
