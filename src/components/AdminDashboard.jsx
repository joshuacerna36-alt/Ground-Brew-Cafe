import React, { useState } from 'react'
import StaffDashboard from './StaffDashboard'
import styles from './AdminDashboard.module.css'

const menu = [
  { label: 'Transactions', items: ['Orders', 'Payments'] },
  { label: 'Users', items: ['Accounts', 'Access roles'] },
  { label: 'Menu / Inventory', items: ['Menu catalog', 'Availability'] }
]

function AdminDashboard({ user }) {
  const [openMenu, setOpenMenu] = useState('')
  const [section, setSection] = useState('Orders')

  const selectSection = (label) => {
    setSection(label)
    setOpenMenu('')
  }

  const logout = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // Static GitHub Pages deployments have no logout API.
    }
    window.localStorage.removeItem('grounded_mock_user')
    window.location.replace(import.meta.env.BASE_URL)
  }

  return (
    <div className={styles.shell}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span>GB</span>
          <div>
            <strong>Grounded Brew</strong>
            <small>Administration</small>
          </div>
        </div>
        <nav className={styles.nav} aria-label="Admin navigation">
          {menu.map((group) => (
            <div className={styles.navGroup} key={group.label}>
              <button
                type="button"
                className={styles.navTrigger}
                aria-expanded={openMenu === group.label}
                onClick={() => setOpenMenu(openMenu === group.label ? '' : group.label)}
              >
                {group.label}<span aria-hidden="true">⌄</span>
              </button>
              {openMenu === group.label && (
                <div className={styles.submenu}>
                  {group.items.map((item) => (
                    <button
                      type="button"
                      className={section === item ? styles.submenuActive : ''}
                      key={item}
                      onClick={() => selectSection(item)}
                    >
                      {item}
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </nav>
        <button type="button" className={styles.logout} onClick={logout}>Sign out</button>
      </aside>

      <main className={styles.content}>
        <header className={styles.mobileHeader}>
          <strong>Grounded Brew Admin</strong>
          <button type="button" onClick={logout}>Sign out</button>
        </header>
        <section className={styles.mobileNav} aria-label="Admin modules">
          <label htmlFor="admin-section">Module</label>
          <select id="admin-section" value={section} onChange={(event) => setSection(event.target.value)}>
            {menu.flatMap((group) => group.items.map((item) => <option key={item}>{item}</option>))}
          </select>
        </section>
        <StaffDashboard user={user} section={section} embedded />
      </main>
    </div>
  )
}

export default AdminDashboard
