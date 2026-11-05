const configuredApiBase = (import.meta.env.VITE_API_BASE_URL || '').trim().replace(/\/$/, '')

export function apiUrl(path) {
  if (!path.startsWith('/api/')) return path
  return configuredApiBase ? `${configuredApiBase}${path}` : path
}

export async function apiFetch(path, options = {}) {
  return fetch(apiUrl(path), {
    ...options,
    credentials: 'include',
    headers: options.headers
  })
}
