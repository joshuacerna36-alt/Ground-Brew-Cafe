import React, { useEffect, useState } from 'react'
import HeroSection from './components/HeroSection'
import AdminDashboard from './components/AdminDashboard'
import StaffDashboard from './components/StaffDashboard'

function App() {
  const [authUser, setAuthUser] = useState(undefined)
  const pathname = window.location.pathname

  useEffect(() => {
    let active = true
    fetch('/api/auth/me')
      .then((response) => response.ok ? response.json() : Promise.reject(new Error('Could not check session')))
      .then(({ user }) => {
        if (!active) return
        setAuthUser(user)
        if (user?.role === 'admin' && pathname === '/') window.location.replace('/admin')
        if (user?.role === 'staff' && pathname === '/') window.location.replace('/staff')
      })
      .catch(() => {
        if (active) setAuthUser(null)
      })
    return () => { active = false }
  }, [pathname])

  if (authUser === undefined) return null

  if (pathname === '/admin') {
    if (authUser?.role !== 'admin') return <HeroSection />
    return <AdminDashboard user={authUser} />
  }

  if (pathname === '/staff') {
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
