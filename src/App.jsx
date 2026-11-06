import React, { useEffect, useState } from 'react'
import HeroSection from './components/HeroSection'
import AdminDashboard from './components/AdminDashboard'
import StaffDashboard from './components/StaffDashboard'

function App() {
  const [authUser, setAuthUser] = useState(() => {
    try {
      const storedUser = window.localStorage.getItem('grounded_mock_user')
      return storedUser ? JSON.parse(storedUser) : undefined
    } catch {
      return undefined
    }
  })
  const pathname = window.location.pathname
  const route = window.location.hash.replace(/^#/, '') || pathname

  useEffect(() => {
    let active = true
    fetch('/api/auth/me')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Could not check session')))
      .then(({ user }) => {
        if (!active) return
        setAuthUser(user)
        if (user?.role === 'admin' && pathname === '/') window.location.replace('#admin')
        if (user?.role === 'staff' && pathname === '/') window.location.replace('#staff')
      })
      .catch(() => {
        if (active && authUser === undefined) setAuthUser(null)
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
