import React, { useEffect, useState } from 'react'
import HeroSection from './components/HeroSection'
import AdminDashboard from './components/AdminDashboard'
import StaffDashboard from './components/StaffDashboard'
import { apiFetch, onAuthChange } from './api'

const getRoute = () => window.location.hash.replace(/^#\/?/, '') || window.location.pathname

const isStaticSite = () => window.location.hostname.endsWith('github.io')
  || !['localhost', '127.0.0.1'].includes(window.location.hostname)

function App() {
  // undefined = still checking, null = signed out, object = signed in
  const [authUser, setAuthUser] = useState(undefined)
  const [route, setRoute] = useState(getRoute)
  const pathname = window.location.pathname
  useEffect(() => {
    const updateRoute = () => setRoute(getRoute())
    window.addEventListener('hashchange', updateRoute)
    return () => window.removeEventListener('hashchange', updateRoute)
  }, [])

  // Keep in step with sign-ins and sign-outs that happen in the login dialog or dashboards.
  useEffect(() => onAuthChange((user) => setAuthUser(user)), [])

  useEffect(() => {
    let active = true
    apiFetch('/api/auth/me')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Could not check session')))
      .then(({ user }) => {
        if (!active) return
        setAuthUser(user)
        const atSiteRoot = pathname === '/' || pathname === import.meta.env.BASE_URL
        if (atSiteRoot && !window.location.hash) {
          if (user?.role === 'admin') window.location.replace('#admin')
          if (user?.role === 'staff') window.location.replace('#staff')
        }
      })
      .catch(() => {
        if (active) setAuthUser((current) => current === undefined ? null : current)
      })
    return () => { active = false }
  }, [pathname])

  if (authUser === undefined) return null

  if (route === 'admin' || pathname === '/admin' || pathname.endsWith('/admin')) {
    if (authUser?.role !== 'admin') return <HeroSection />
    return <AdminDashboard user={authUser} />
  }

  if (route === 'staff' || pathname === '/staff' || pathname.endsWith('/staff')) {
    if (!['admin', 'staff'].includes(authUser?.role)) return <HeroSection />
    return <StaffDashboard user={authUser} />
  }

  return (
    <div>
      <HeroSection />
    </div>
  )
}

export default App
