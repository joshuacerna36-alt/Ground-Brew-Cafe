import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './styles/index.css'
import { apiUrl } from './api.js'

const originalFetch = window.fetch.bind(window)
window.fetch = (input, options) => {
  if (typeof input === 'string' && input.startsWith('/api/')) {
    return originalFetch(apiUrl(input), { ...options, credentials: 'include' })
  }
  return originalFetch(input, options)
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
