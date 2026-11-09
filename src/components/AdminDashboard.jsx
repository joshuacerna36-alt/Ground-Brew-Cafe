import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import StaffDashboard from './StaffDashboard'
import styles from './AdminDashboard.module.css'
import { apiFetch, notifyAuthChange } from '../api'

const navigation = [
  { section: 'Overview', group: 'Workspace', icon: 'overview' },
  { section: 'Analytics', group: 'Workspace', icon: 'analytics' },
  { section: 'Orders', group: 'Transactions', icon: 'orders' },
  { section: 'Payments', group: 'Transactions', icon: 'payments' },
  { section: 'Accounts', group: 'Management', icon: 'users' },
  { section: 'Access roles', group: 'Management', icon: 'roles' },
  { section: 'Menu catalog', group: 'Management', icon: 'menu' },
  { section: 'Availability', group: 'Management', icon: 'availability' },
  { section: 'Settings', group: 'System', icon: 'settings' }
]

const currency = (cents) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP',
  maximumFractionDigits: 0
}).format((cents || 0) / 100)

const number = (value) => new Intl.NumberFormat('en-PH').format(value)

const dateLabel = (timestamp, options = { month: 'short', day: 'numeric' }) => (
  new Intl.DateTimeFormat('en-PH', { ...options, timeZone: 'Asia/Manila' }).format(new Date(timestamp))
)

const statusNames = {
  received: 'New',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'On the way',
  completed: 'Completed',
  cancelled: 'Cancelled'
}

function AdminIcon({ name }) {
  const paths = {
    overview: <><rect x="3" y="3" width="8" height="8" rx="2" /><rect x="13" y="3" width="8" height="5" rx="2" /><rect x="13" y="10" width="8" height="11" rx="2" /><rect x="3" y="13" width="8" height="8" rx="2" /></>,
    analytics: <><path d="M3 3v18h18" /><path d="m7 14 4-4 4 3 6-7" /></>,
    orders: <><path d="M5 4h14l1 17H4L5 4Z" /><path d="M9 8a3 3 0 0 0 6 0" /></>,
    payments: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18m-13 5h4" /></>,
    users: <><path d="M16 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" /><circle cx="10" cy="7" r="4" /><path d="M20 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75" /></>,
    roles: <><path d="M12 22s8-4 8-11V5l-8-3-8 3v6c0 7 8 11 8 11Z" /><path d="m9 12 2 2 4-4" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="7" cy="6" r="1" fill="currentColor" /><circle cx="7" cy="12" r="1" fill="currentColor" /><circle cx="7" cy="18" r="1" fill="currentColor" /></>,
    availability: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
    settings: <><circle cx="12" cy="12" r="3" /><path d="m19.4 15 .1.1 1.4 1.1-1.4 2.4-1.7-.6a8 8 0 0 1-1.6.9l-.3 1.8h-2.8l-.3-1.8a8 8 0 0 1-1.6-.9l-1.7.6-1.4-2.4L7.5 15a8 8 0 0 1 0-1.9L6.1 12l1.4-2.4 1.7.6a8 8 0 0 1 1.6-.9l.3-1.8h2.8l.3 1.8a8 8 0 0 1 1.6.9l1.7-.6 1.4 2.4-1.4 1.1a8 8 0 0 1-.1 1.9Z" /></>
  }

  return (
    <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      {paths[name]}
    </svg>
  )
}

function MiniSparkline({ values }) {
  const points = values.map((value, index) => {
    const max = Math.max(...values, 1)
    const min = Math.min(...values, 0)
    const y = 28 - ((value - min) / (max - min || 1)) * 22
    return `${(index / Math.max(values.length - 1, 1)) * 100},${y}`
  }).join(' ')
  return <svg className={styles.sparkline} viewBox="0 0 100 32" preserveAspectRatio="none" aria-hidden="true"><polyline points={points} /></svg>
}

function AnalyticsDashboard({ orders, users, onRefresh, loading, searchTerm }) {
  const [range, setRange] = useState('Week')
  const [sortKey, setSortKey] = useState('createdAt')
  const [sortDirection, setSortDirection] = useState('desc')
  const [page, setPage] = useState(0)
  const validOrders = useMemo(() => orders.filter((order) => order.status !== 'cancelled'), [orders])
  const now = Date.now()
  const rangeDays = { Day: 1, Week: 7, Month: 30, Year: 365 }[range]
  const currentStart = now - rangeDays * 86400000
  const previousStart = currentStart - rangeDays * 86400000
  const currentOrders = validOrders.filter((order) => order.createdAt >= currentStart)
  const previousOrders = validOrders.filter((order) => order.createdAt >= previousStart && order.createdAt < currentStart)
  const totalSales = (rows) => rows.reduce((total, order) => total + order.totalCents, 0)
  const sales = totalSales(currentOrders)
  const previousSales = totalSales(previousOrders)
  const salesTrend = previousSales ? ((sales - previousSales) / previousSales) * 100 : null
  const outstanding = orders.filter((order) => order.paymentStatus === 'unpaid' && order.status !== 'cancelled')
    .reduce((total, order) => total + order.totalCents, 0)
  const collected = orders.filter((order) => order.paymentStatus === 'paid')
    .reduce((total, order) => total + order.totalCents, 0)
  const activeCustomers = users.filter((account) => account.role === 'customer' && account.account_status === 'active').length
  const currentNewCustomers = users.filter((account) => account.role === 'customer' && account.created_at >= currentStart).length
  const previousNewCustomers = users.filter((account) => account.role === 'customer' && account.created_at >= previousStart && account.created_at < currentStart).length
  const customerChange = previousNewCustomers ? Math.round(((currentNewCustomers - previousNewCustomers) / previousNewCustomers) * 100) : null

  const chartData = useMemo(() => {
    const bins = Array.from({ length: 12 }, (_, index) => ({
      label: range === 'Year'
        ? dateLabel(now - (11 - index) * 30 * 86400000, { month: 'short' })
        : range === 'Day'
          ? dateLabel(now - (11 - index) * 2 * 3600000, { hour: 'numeric' })
          : dateLabel(now - (11 - index) * (rangeDays / 12) * 86400000, { month: 'short', day: 'numeric' }),
      value: 0
    }))
    const start = range === 'Year' ? now - 365 * 86400000 : now - rangeDays * 86400000
    validOrders.forEach((order) => {
      if (order.createdAt < start || order.createdAt > now) return
      const ratio = (order.createdAt - start) / Math.max(now - start, 1)
      const index = Math.min(bins.length - 1, Math.floor(ratio * bins.length))
      bins[index].value += order.totalCents / 100
    })
    return bins
  }, [validOrders, range, rangeDays, now])
  const maxChartValue = Math.max(...chartData.map((item) => item.value), 1)
  const chartPoints = chartData.map((item, index) => ({
    x: 42 + (index / (chartData.length - 1)) * 676,
    y: 205 - (item.value / maxChartValue) * 166,
    ...item
  }))
  const linePoints = chartPoints.map(({ x, y }) => `${x},${y}`).join(' ')
  const areaPoints = `42,205 ${linePoints} 718,205`
  const venuePickup = validOrders.filter((order) => order.fulfillment === 'pickup').length
  const venueDelivery = validOrders.filter((order) => order.fulfillment === 'delivery').length
  const venueTotal = venuePickup + venueDelivery
  const pickupPercent = venueTotal ? Math.round((venuePickup / venueTotal) * 100) : 0
  const donutStyle = { '--pickup-percent': `${pickupPercent}%` }
  const filteredOrders = useMemo(() => {
    const query = searchTerm.trim().toLowerCase()
    return [...orders]
      .filter((order) => !query || [order.orderNumber, order.customerName, order.customerEmail, order.status].some((value) => String(value || '').toLowerCase().includes(query)))
      .sort((left, right) => {
        const comparison = left[sortKey] > right[sortKey] ? 1 : left[sortKey] < right[sortKey] ? -1 : 0
        return comparison * (sortDirection === 'asc' ? 1 : -1)
      })
  }, [orders, searchTerm, sortKey, sortDirection])
  const pageSize = 6
  const pageCount = Math.max(1, Math.ceil(filteredOrders.length / pageSize))
  const visibleOrders = filteredOrders.slice(page * pageSize, (page + 1) * pageSize)

  const changeSort = (key) => {
    setPage(0)
    if (sortKey === key) setSortDirection((direction) => direction === 'asc' ? 'desc' : 'asc')
    else {
      setSortKey(key)
      setSortDirection('desc')
    }
  }
  const trendLabel = salesTrend === null
    ? 'No previous-period baseline'
    : `${salesTrend >= 0 ? '+' : ''}${salesTrend.toFixed(1)}% vs previous ${range.toLowerCase()}`

  return (
    <div className={styles.analytics}>
      <div className={styles.analyticsHeading}>
        <div>
          <p>Business snapshot</p>
          <h2>{range} overview</h2>
        </div>
        <div className={styles.analyticsActions}>
          <div className={styles.rangeToggle} aria-label="Analytics time range">
            {['Day', 'Week', 'Month', 'Year'].map((item) => (
              <button type="button" className={range === item ? styles.rangeActive : ''} key={item} onClick={() => { setRange(item); setPage(0) }}>{item}</button>
            ))}
          </div>
          <button type="button" className={styles.refresh} onClick={onRefresh} disabled={loading}>{loading ? 'Updating…' : 'Refresh'}</button>
        </div>
      </div>

      <div className={styles.metricGrid}>
        <article className={styles.metricCard}>
          <div className={styles.metricTop}><span>Gross sales</span><i className={styles.metricIcon}>₱</i></div>
          <strong>{currency(sales)}</strong>
          <p><span className={salesTrend !== null && salesTrend >= 0 ? styles.positive : styles.neutral}>{salesTrend === null ? '—' : `${salesTrend >= 0 ? '↑' : '↓'} ${Math.abs(salesTrend).toFixed(1)}%`}</span> {trendLabel.replace(/^[+-]?\d+(\.\d+)?% /, '')}</p>
          <MiniSparkline values={chartData.map((item) => item.value)} />
        </article>
        <article className={styles.metricCard}>
          <div className={styles.metricTop}><span>Outstanding balance</span><i className={styles.metricIcon}>◷</i></div>
          <strong>{currency(outstanding)}</strong>
          <p><span className={outstanding ? styles.warning : styles.positive}>{number(orders.filter((order) => order.paymentStatus === 'unpaid' && order.status !== 'cancelled').length)}</span> unpaid orders</p>
          <MiniSparkline values={orders.slice(0, 12).map((order) => order.paymentStatus === 'unpaid' ? order.totalCents : 0)} />
        </article>
        <article className={styles.metricCard}>
          <div className={styles.metricTop}><span>Payments received</span><i className={styles.metricIcon}>✓</i></div>
          <strong>{currency(collected)}</strong>
          <p><span className={styles.positive}>{number(orders.filter((order) => order.paymentStatus === 'paid').length)}</span> paid orders</p>
          <MiniSparkline values={orders.slice(0, 12).map((order) => order.paymentStatus === 'paid' ? order.totalCents : 0)} />
        </article>
        <article className={styles.metricCard}>
          <div className={styles.metricTop}><span>Active customers</span><i className={styles.metricIcon}>◎</i></div>
          <strong>{number(activeCustomers)}</strong>
          <p><span className={customerChange !== null && customerChange >= 0 ? styles.positive : styles.neutral}>{customerChange === null ? '—' : `${customerChange >= 0 ? '↑' : '↓'} ${Math.abs(customerChange)}%`}</span> {number(currentNewCustomers)} new in period</p>
          <MiniSparkline values={users.slice(0, 12).map((account) => account.role === 'customer' ? account.created_at : 0)} />
        </article>
      </div>

      <div className={styles.widgetGrid}>
        <section className={styles.chartCard} aria-label="Sales analytics chart">
          <div className={styles.widgetHeading}>
            <div><h3>Sales performance</h3><p>Order value over the selected period</p></div>
            <span className={styles.chartLegend}><i /> Sales</span>
          </div>
          <div className={styles.chartWrap}>
            <svg className={styles.salesChart} viewBox="0 0 760 250" role="img" aria-label={`${range} sales chart`}>
              <defs><linearGradient id="salesGradient" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="#6366f1" stopOpacity=".34" /><stop offset="100%" stopColor="#6366f1" stopOpacity="0" /></linearGradient></defs>
              {[39, 80, 122, 164, 205].map((y) => <line key={y} x1="42" x2="718" y1={y} y2={y} className={styles.chartGridLine} />)}
              <polygon points={areaPoints} fill="url(#salesGradient)" />
              <polyline points={linePoints} className={styles.chartLine} />
              {chartPoints.map(({ x, y, label, value }, index) => <circle key={`${label}-${index}`} cx={x} cy={y} r="3.5" className={styles.chartPoint}><title>{label}: {currency(Math.round(value * 100))}</title></circle>)}
              {chartPoints.filter((_, index) => index % 2 === 0).map(({ x, label }, index) => <text key={`${label}-${index}`} x={x} y="232" className={styles.chartLabel}>{label}</text>)}
            </svg>
          </div>
        </section>

        <section className={styles.venueCard}>
          <div className={styles.widgetHeading}><div><h3>Order venue</h3><p>Pickup and delivery mix</p></div><AdminIcon name="orders" /></div>
          <div className={styles.venueBody}>
            <div className={styles.donut} style={donutStyle}><span>{number(venueTotal)}<small>orders</small></span></div>
            <div className={styles.venueLegend}>
              <p><i className={styles.pickupDot} />Pickup <strong>{number(venuePickup)}</strong><small>{venueTotal ? pickupPercent : 0}%</small></p>
              <p><i className={styles.deliveryDot} />Delivery <strong>{number(venueDelivery)}</strong><small>{venueTotal ? 100 - pickupPercent : 0}%</small></p>
            </div>
          </div>
          <div className={styles.collectedNote}><span>Collected balance</span><strong>{currency(collected)}</strong></div>
        </section>
      </div>

      <section className={styles.activityCard}>
        <div className={styles.widgetHeading}>
          <div><h3>Recent transactions</h3><p>Latest orders and payment status</p></div>
          <span className={styles.activityCount}>{number(filteredOrders.length)} orders</span>
        </div>
        <div className={styles.tableScroll}>
          <table className={styles.activityTable}>
            <thead><tr>
              <th><button type="button" onClick={() => changeSort('orderNumber')}>Order</button></th>
              <th>Customer</th>
              <th><button type="button" onClick={() => changeSort('createdAt')}>Date</button></th>
              <th>Venue</th>
              <th>Status</th>
              <th>Payment</th>
              <th><button type="button" onClick={() => changeSort('totalCents')}>Amount</button></th>
            </tr></thead>
            <tbody>
              {visibleOrders.map((order) => (
                <tr key={order.id}>
                  <td><strong>{order.orderNumber}</strong></td>
                  <td>{order.customerName || 'Customer'}</td>
                  <td>{dateLabel(order.createdAt, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })}</td>
                  <td>{order.fulfillment === 'pickup' ? 'Pickup' : 'Delivery'}</td>
                  <td><span className={`${styles.tableStatus} ${styles[`status_${order.status}`] || ''}`}>{statusNames[order.status] || order.status}</span></td>
                  <td>{order.paymentStatus === 'paid' ? 'Paid' : order.paymentStatus === 'refunded' ? 'Refunded' : 'Due'}</td>
                  <td className={styles.amountCell}>{currency(order.totalCents)}</td>
                </tr>
              ))}
              {visibleOrders.length === 0 && <tr><td className={styles.tableEmpty} colSpan="7">No matching transactions yet.</td></tr>}
            </tbody>
          </table>
        </div>
        <div className={styles.pagination}>
          <span>Showing {filteredOrders.length ? page * pageSize + 1 : 0}–{Math.min((page + 1) * pageSize, filteredOrders.length)} of {filteredOrders.length}</span>
          <div>
            <button type="button" onClick={() => setPage((current) => Math.max(0, current - 1))} disabled={page === 0}>Previous</button>
            <button type="button" onClick={() => setPage((current) => Math.min(pageCount - 1, current + 1))} disabled={page >= pageCount - 1}>Next</button>
          </div>
        </div>
      </section>
      <p className={styles.dataFootnote}>Analytics are calculated from the latest orders and account records available to this dashboard.</p>
    </div>
  )
}

function AdminDashboard({ user }) {
  const [section, setSection] = useState('Overview')
  const [collapsed, setCollapsed] = useState(false)
  const [theme, setTheme] = useState(() => {
    try {
      return window.localStorage.getItem('grounded_admin_theme') === 'light' ? 'light' : 'dark'
    } catch {
      return 'dark'
    }
  })
  const [orders, setOrders] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [search, setSearch] = useState('')
  const [showNotifications, setShowNotifications] = useState(false)
  const [showProfile, setShowProfile] = useState(false)
  const searchRef = useRef(null)
  const loadAnalytics = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const requests = [apiFetch('/api/staff/orders'), apiFetch('/api/staff/users')]
      const [ordersResponse, usersResponse] = await Promise.all(requests)
      const [orderResult, userResult] = await Promise.all([ordersResponse.json(), usersResponse.json()])
      if (!ordersResponse.ok) throw new Error(orderResult.error || 'Could not load analytics orders.')
      if (!usersResponse.ok) throw new Error(userResult.error || 'Could not load analytics accounts.')
      setOrders(orderResult.orders)
      setUsers(userResult.users)
    } catch (loadError) {
      setError(loadError.message || 'Could not load analytics.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { loadAnalytics() }, [loadAnalytics])

  useEffect(() => {
    const handleShortcut = (event) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault()
        searchRef.current?.focus()
      }
      if (event.key === 'Escape') {
        setShowNotifications(false)
        setShowProfile(false)
      }
    }
    window.addEventListener('keydown', handleShortcut)
    return () => window.removeEventListener('keydown', handleShortcut)
  }, [])

  useEffect(() => {
    try {
      window.localStorage.setItem('grounded_admin_theme', theme)
    } catch {
      setError('Theme preference could not be saved in this browser.')
    }
  }, [theme])

  const logout = async () => {
    try {
      await apiFetch('/api/auth/logout', { method: 'POST' })
    } catch {
      // Signing out locally remains the correct outcome if the server is unreachable.
    }
    notifyAuthChange(null)
    window.location.replace(import.meta.env.BASE_URL)
  }

  const selectSection = (nextSection) => {
    setSection(nextSection)
    setShowNotifications(false)
    setShowProfile(false)
  }

  const newOrders = orders.filter((order) => order.status === 'received')
  const showAnalytics = section === 'Overview' || section === 'Analytics'
  const moduleSection = section === 'Orders' || section === 'Payments'
    ? section
    : ['Accounts', 'Access roles', 'Menu catalog', 'Availability'].includes(section)
      ? section
      : ''
  const sectionTitle = section === 'Overview' ? 'Overview' : section === 'Analytics' ? 'Analytics' : section

  return (
    <div className={`${styles.shell} ${theme === 'dark' ? styles.dark : styles.light} ${collapsed ? styles.collapsed : ''}`} data-theme={theme}>
      <aside className={styles.sidebar}>
        <div className={styles.brand}>
          <span className={styles.brandMark}>G</span>
          <div><strong>Grounded Brew</strong><small>ADMIN CONSOLE</small></div>
        </div>
        <button type="button" className={styles.collapseButton} onClick={() => setCollapsed((value) => !value)} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>
          {collapsed ? '›' : '‹'}
        </button>
        <nav className={styles.nav} aria-label="Admin navigation">
          {['Workspace', 'Transactions', 'Management', 'System'].map((group) => (
            <div className={styles.navGroup} key={group}>
              <p className={styles.navGroupLabel}>{group}</p>
              {navigation.filter((item) => item.group === group).map((item) => (
                <button
                  type="button"
                  key={item.section}
                  className={`${styles.navItem} ${section === item.section ? styles.navItemActive : ''}`}
                  onClick={() => selectSection(item.section)}
                  aria-current={section === item.section ? 'page' : undefined}
                  title={collapsed ? item.section : undefined}
                >
                  <AdminIcon name={item.icon} />
                  <span>{item.section}</span>
                  {item.section === 'Orders' && newOrders.length > 0 && <b>{newOrders.length}</b>}
                </button>
              ))}
            </div>
          ))}
        </nav>
        <button type="button" className={styles.logout} onClick={logout}><span aria-hidden="true">↪</span><span>Sign out</span></button>
      </aside>

      <main className={styles.main}>
        <header className={styles.topbar}>
          <div className={styles.mobileBrand}><span className={styles.brandMark}>G</span><strong>Grounded Brew</strong></div>
          <div className={styles.breadcrumb}><span>Workspace</span><i>/</i><strong>{sectionTitle}</strong></div>
          <div className={styles.topbarActions}>
            <label className={styles.searchBox}>
              <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="11" cy="11" r="7" /><path d="m16 16 4 4" /></svg>
              <input ref={searchRef} value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search orders, customers…" aria-label="Search orders and customers" />
              <kbd>{navigator.platform?.toLowerCase().includes('mac') ? '⌘K' : 'Ctrl K'}</kbd>
            </label>
            <div className={styles.popoverAnchor}>
              <button type="button" className={styles.iconButton} onClick={() => { setShowNotifications((value) => !value); setShowProfile(false) }} aria-label={`${newOrders.length} new order notifications`} aria-expanded={showNotifications}>
                <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" /><path d="M10 21h4" /></svg>
                {newOrders.length > 0 && <i>{Math.min(newOrders.length, 9)}</i>}
              </button>
              {showNotifications && <div className={styles.popover}>
                <strong>Notifications</strong>
                {newOrders.length ? newOrders.slice(0, 4).map((order) => <button key={order.id} type="button" onClick={() => selectSection('Orders')}><span>New order {order.orderNumber}</span><small>{order.customerName} · {currency(order.totalCents)}</small></button>) : <p>You’re all caught up.</p>}
              </div>}
            </div>
            <button type="button" className={styles.themeButton} onClick={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`} title={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>
              {theme === 'dark' ? '☼' : '☾'}
            </button>
            <div className={styles.popoverAnchor}>
              <button type="button" className={styles.profileButton} onClick={() => { setShowProfile((value) => !value); setShowNotifications(false) }} aria-expanded={showProfile}>
                <span className={styles.profileAvatar}>{user.profileImage ? <img src={user.profileImage} alt="" /> : (user.name || 'A').charAt(0).toUpperCase()}</span>
                <span className={styles.profileName}>{user.name}</span>
                <span aria-hidden="true">⌄</span>
              </button>
              {showProfile && <div className={`${styles.popover} ${styles.profilePopover}`}><strong>{user.name}</strong><small>{user.email}</small><button type="button" onClick={logout}>Sign out</button></div>}
            </div>
          </div>
        </header>

        <div className={styles.content}>
          <div className={styles.pageHeading}>
            <div><p>{new Intl.DateTimeFormat('en-PH', { weekday: 'long', month: 'long', day: 'numeric', timeZone: 'Asia/Manila' }).format(new Date())}</p><h1>{section === 'Overview' ? `Welcome back, ${user.name?.split(' ')[0] || 'Admin'}` : sectionTitle}</h1></div>
            <span className={styles.liveIndicator}><i />Live operations</span>
          </div>
          {error && <p className={styles.error} role="alert">{error}</p>}
          {section === 'Settings' ? (
            <section className={styles.settingsCard}>
              <div><h2>Appearance</h2><p>Choose the dashboard theme for this browser.</p></div>
              <button type="button" className={styles.themeSelect} onClick={() => setTheme((value) => value === 'dark' ? 'light' : 'dark')}>{theme === 'dark' ? 'Dark mode' : 'Light mode'} <span>{theme === 'dark' ? '☾' : '☼'}</span></button>
            </section>
          ) : showAnalytics ? (
            <AnalyticsDashboard orders={orders} users={users} onRefresh={loadAnalytics} loading={loading} searchTerm={search} />
          ) : moduleSection ? (
            <StaffDashboard user={user} section={moduleSection} embedded searchTerm={search} />
          ) : null}
        </div>
      </main>
      <nav className={styles.mobileNav} aria-label="Admin modules">
        {navigation.slice(0, 4).map((item) => <button key={item.section} className={section === item.section ? styles.mobileNavActive : ''} type="button" onClick={() => selectSection(item.section)}><AdminIcon name={item.icon} /><span>{item.section}</span></button>)}
        <select value={section} onChange={(event) => selectSection(event.target.value)} aria-label="More admin modules">
          <option value="Accounts">Accounts</option><option value="Access roles">Access roles</option><option value="Menu catalog">Menu catalog</option><option value="Availability">Availability</option><option value="Settings">Settings</option><option value="Payments">Payments</option>
        </select>
      </nav>
    </div>
  )
}

export default AdminDashboard
