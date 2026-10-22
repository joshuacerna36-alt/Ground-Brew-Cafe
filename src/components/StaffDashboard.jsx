import React, { useCallback, useEffect, useState } from 'react'
import styles from './StaffDashboard.module.css'

const currency = (cents) => new Intl.NumberFormat('en-PH', {
  style: 'currency',
  currency: 'PHP'
}).format(cents / 100)

const dateTime = (value) => new Intl.DateTimeFormat('en-PH', {
  dateStyle: 'medium',
  timeStyle: 'short',
  timeZone: 'Asia/Manila'
}).format(new Date(value))

const nextStatuses = {
  received: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: [],
  ready: ['completed', 'cancelled'],
  out_for_delivery: ['completed', 'cancelled'],
  completed: [],
  cancelled: []
}

const statusLabels = {
  received: 'New',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready for pickup',
  out_for_delivery: 'Out for delivery',
  completed: 'Completed',
  cancelled: 'Cancelled'
}

const getNextStatuses = (order) => {
  if (order.status === 'preparing') {
    return [order.fulfillment === 'delivery' ? 'out_for_delivery' : 'ready', 'cancelled']
  }
  return nextStatuses[order.status] || []
}

function StaffDashboard({ user }) {
  const [orders, setOrders] = useState([])
  const [users, setUsers] = useState([])
  const [loading, setLoading] = useState(true)
  const [busyId, setBusyId] = useState('')
  const [error, setError] = useState('')

  const loadDashboard = useCallback(async () => {
    setLoading(true)
    setError('')
    try {
      const orderResponse = await fetch('/api/staff/orders')
      const orderResult = await orderResponse.json()
      if (!orderResponse.ok) throw new Error(orderResult.error || 'Could not load orders.')
      setOrders(orderResult.orders)
      if (user.role === 'admin') {
        const usersResponse = await fetch('/api/staff/users')
        const usersResult = await usersResponse.json()
        if (!usersResponse.ok) throw new Error(usersResult.error || 'Could not load accounts.')
        setUsers(usersResult.users)
      } else {
        setUsers([])
      }
    } catch (loadError) {
      setError(loadError.message || 'Could not load the staff dashboard.')
    } finally {
      setLoading(false)
    }
  }, [user.role])

  useEffect(() => {
    loadDashboard()
  }, [loadDashboard])

  const updateOrder = async (order, changes) => {
    setBusyId(order.id)
    setError('')
    try {
      const response = await fetch(`/api/staff/orders/${encodeURIComponent(order.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes)
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not update this order.')
      await loadDashboard()
    } catch (updateError) {
      setError(updateError.message || 'Could not update this order.')
    } finally {
      setBusyId('')
    }
  }

  const updateAccount = async (account, changes) => {
    setBusyId(account.id)
    setError('')
    try {
      const response = await fetch(`/api/staff/users/${encodeURIComponent(account.id)}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(changes)
      })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not update account access.')
      setUsers((current) => current.map((item) => item.id === result.user.id ? result.user : item))
    } catch (updateError) {
      setError(updateError.message || 'Could not update this account.')
      await loadDashboard()
    } finally {
      setBusyId('')
    }
  }

  const deleteAccount = async (account) => {
    if (!window.confirm(`Delete ${account.display_name}'s account? Their saved contact details will be removed, while order records will remain.`)) return
    setBusyId(account.id)
    setError('')
    try {
      const response = await fetch(`/api/staff/users/${encodeURIComponent(account.id)}`, { method: 'DELETE' })
      const result = await response.json()
      if (!response.ok) throw new Error(result.error || 'Could not delete this account.')
      await loadDashboard()
    } catch (deleteError) {
      setError(deleteError.message || 'Could not delete this account.')
      await loadDashboard()
    } finally {
      setBusyId('')
    }
  }

  return (
    <main className={styles.page}>
      <header className={styles.heading}>
        <div>
          <p className={styles.eyebrow}>Grounded Brew Café</p>
          <h1>Staff Dashboard</h1>
          <p>Welcome, {user.name}. Review scheduled orders and update their progress.</p>
        </div>
        <button type="button" className={styles.refresh} onClick={loadDashboard} disabled={loading}>
          {loading ? 'Refreshing…' : 'Refresh dashboard'}
        </button>
      </header>

      {error && <p className={styles.error} role="alert">{error}</p>}
      {loading ? (
        <p className={styles.empty}>Loading dashboard…</p>
      ) : orders.length === 0 ? (
        <p className={styles.empty}>No orders have been placed yet.</p>
      ) : (
        <section className={styles.orderList} aria-label="Customer orders">
          {orders.map((order) => (
            <article className={styles.orderCard} key={order.id}>
              <div className={styles.orderTop}>
                <div>
                  <p className={styles.orderNumber}>{order.orderNumber}</p>
                  <h2>{order.customerName} <span>· {order.fulfillment}</span></h2>
                  <p>{order.customerEmail} · {order.contactPhone}</p>
                </div>
                <span className={`${styles.status} ${styles[`status_${order.status}`]}`}>
                  {statusLabels[order.status] || order.status}
                </span>
              </div>

              <p className={styles.scheduled}>
                {order.fulfillment === 'pickup' ? 'Pickup' : 'Delivery'} scheduled: {dateTime(order.scheduledAt)}
              </p>
              {order.deliveryAddress && <p className={styles.address}>{order.deliveryAddress}</p>}
              <ul className={styles.items}>
                {order.items.map((item) => (
                  <li key={item.id}>
                    <span>{item.quantity} × {item.name}</span>
                    <span>{currency(item.lineTotalCents)}</span>
                  </li>
                ))}
              </ul>
              <div className={styles.amounts}>
                <p><span>Subtotal</span><span>{currency(order.subtotalCents)}</span></p>
                {order.fulfillment === 'delivery' && (
                  <p><span>Delivery ({(order.deliveryDistanceMeters / 1000).toFixed(1)} km)</span><span>{currency(order.deliveryFeeCents)}</span></p>
                )}
                <p className={styles.total}><span>Total</span><span>{currency(order.totalCents)}</span></p>
              </div>
              <p className={styles.payment}>
                Payment: {order.paymentMethod === 'gcash' ? 'GCash online transfer' : 'Cash'} · {order.paymentStatus}
              </p>
              <div className={styles.actions}>
                {getNextStatuses(order).map((status) => (
                  <button
                    type="button"
                    key={status}
                    className={status === 'cancelled' ? styles.cancel : styles.action}
                    onClick={() => updateOrder(order, { status })}
                    disabled={busyId === order.id}
                  >
                    {status === 'cancelled' ? 'Cancel order' : statusLabels[status]}
                  </button>
                ))}
                {order.paymentStatus === 'unpaid' && (
                  <button
                    type="button"
                    className={styles.action}
                    onClick={() => updateOrder(order, { paymentStatus: 'paid' })}
                    disabled={busyId === order.id}
                  >
                    Mark paid
                  </button>
                )}
                {order.paymentStatus === 'paid' && (
                  <button
                    type="button"
                    className={styles.cancel}
                    onClick={() => updateOrder(order, { paymentStatus: 'refunded' })}
                    disabled={busyId === order.id}
                  >
                    Mark refunded
                  </button>
                )}
              </div>
            </article>
          ))}
        </section>
      )}

      {user.role === 'admin' && (
        <section className={styles.accounts}>
          <h2>Customer and staff access</h2>
          <p>Manage roles and account access. Deactivated accounts cannot sign in; deleted accounts lose contact details while order records are retained.</p>
          {users.length === 0 ? (
            <p className={styles.empty}>No customer accounts yet.</p>
          ) : (
            <div className={styles.accountList}>
              {users.map((account) => (
                <div className={styles.accountRow} key={account.id}>
                  <span><strong>{account.display_name}</strong><small>{account.email}</small></span>
                  {account.role === 'admin' ? (
                    <span className={styles.adminBadge}>Admin</span>
                  ) : (
                    <div className={styles.accountActions}>
                      <label className={styles.roleLabel}>
                        Access
                        <select
                          value={account.role}
                          onChange={(event) => updateAccount(account, { role: event.target.value })}
                          disabled={busyId === account.id}
                          aria-label={`Access for ${account.email}`}
                        >
                          <option value="customer">Customer</option>
                          <option value="staff">Staff</option>
                        </select>
                      </label>
                      <span className={account.account_status === 'active' ? styles.accountStatusActive : styles.accountStatusInactive}>
                        {account.account_status === 'active' ? 'Active' : 'Deactivated'}
                      </span>
                      <button
                        type="button"
                        className={styles.accountButton}
                        onClick={() => updateAccount(account, { active: account.account_status !== 'active' })}
                        disabled={busyId === account.id}
                      >
                        {account.account_status === 'active' ? 'Deactivate' : 'Reactivate'}
                      </button>
                      <button
                        type="button"
                        className={styles.deleteAccountButton}
                        onClick={() => deleteAccount(account)}
                        disabled={busyId === account.id}
                      >
                        Delete
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </section>
      )}
    </main>
  )
}

export default StaffDashboard
