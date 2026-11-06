import { localFetch } from './localApi.js'

const configuredApiBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '')

// VITE_API_MODE:
//   "local"  - always use the in-browser account service (static hosting)
//   "server" - always talk to the Node.js server (server.js)
//   "auto"   - (default) use the server if one answers, otherwise fall back to local
const configuredMode = (import.meta.env.VITE_API_MODE || 'auto').trim().toLowerCase()

// GitHub Pages never has a backend, so skip probing for one there.
const isGitHubPages = typeof window !== 'undefined' && /\.github\.io$/i.test(window.location.hostname)

let mode = configuredMode === 'local' || configuredMode === 'server'
  ? configuredMode
  : (isGitHubPages && !configuredApiBase ? 'local' : 'unknown')

export function apiUrl(path) {
  if (!path.startsWith('/api/')) return path
  return configuredApiBase ? `${configuredApiBase}${path}` : path
}

export function isLocalMode() {
  return mode === 'local'
}

export async function apiFetch(path, options = {}) {
  if (mode === 'local') return localFetch(path, options)

  let response
  try {
    response = await fetch(apiUrl(path), {
      ...options,
      credentials: 'include',
      headers: options.headers
    })
  } catch (error) {
    if (mode === 'unknown') {
      mode = 'local'
      return localFetch(path, options)
    }
    throw error
  }

  if (mode === 'unknown') {
    // A real server always answers /api/* with JSON. HTML (a static host's
    // 404 page) means there is no backend, so use the local service instead.
    const contentType = response.headers.get('content-type') || ''
    if (!contentType.includes('application/json')) {
      mode = 'local'
      return localFetch(path, options)
    }
    mode = 'server'
  }
  return response
}

// Lets separate parts of the app (the login dialog, the admin dashboard and the
// router in App.jsx) stay in sync when someone signs in or out.
const AUTH_EVENT = 'grounded:auth'

export function notifyAuthChange(user) {
  window.dispatchEvent(new CustomEvent(AUTH_EVENT, { detail: { user } }))
}

export function onAuthChange(handler) {
  const listener = (event) => handler(event.detail.user)
  window.addEventListener(AUTH_EVENT, listener)
  return () => window.removeEventListener(AUTH_EVENT, listener)
}
