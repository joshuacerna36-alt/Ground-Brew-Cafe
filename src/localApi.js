// In-browser stand-in for server.js.
//
// GitHub Pages can only host static files, so there is no Node.js server to
// answer /api/* requests. When the site is running without a backend, api.js
// sends those requests here instead. This module answers them with the same
// URLs, status codes and JSON shapes as server.js, and keeps its data in the
// visitor's own browser (localStorage).
//
// IMPORTANT: this is a demo-grade store. Accounts and orders live only in the
// browser that created them and are not shared between devices. For real,
// shared accounts, deploy server.js to a Node.js host and set VITE_API_BASE_URL.

import { orderCatalog } from './menuCatalog.js'

const USERS_KEY = 'grounded_local_users'
const ORDERS_KEY = 'grounded_local_orders'
const SESSION_KEY = 'grounded_local_session'
const SEEDED_KEY = 'grounded_local_seeded'

// Built-in accounts. Override the admin login at build time with
// VITE_ADMIN_EMAIL / VITE_ADMIN_PASSWORD (note: anything in a static site's
// JavaScript is visible to visitors, so treat this as a demo login).
const ADMIN_EMAIL = (import.meta.env.VITE_ADMIN_EMAIL || 'admin@groundedbrew.local').trim().toLowerCase()
const ADMIN_PASSWORD = import.meta.env.VITE_ADMIN_PASSWORD || 'GroundedBrew123!'
const ADMIN_NAME = 'Grounded Brew Administrator'
const DEMO_EMAIL = 'test@grounded.com'
const DEMO_PASSWORD = '123456'
const DEMO_NAME = 'Grounded Test User'

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const MAX_ORDER_ITEMS = 30
const PBKDF2_ITERATIONS = 120000
const FALLBACK_ROUNDS = 20000

const ORDER_STATUSES = ['received', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled']
const PAYMENT_STATUSES = ['unpaid', 'paid', 'refunded']

// ---------------------------------------------------------------------------
// Storage (localStorage, with an in-memory copy if the browser blocks it)
// ---------------------------------------------------------------------------

const memoryStore = new Map()

const store = {
  get(key, fallback) {
    try {
      const raw = window.localStorage.getItem(key)
      if (raw !== null) return JSON.parse(raw)
    } catch {
      // fall through to memory
    }
    return memoryStore.has(key) ? memoryStore.get(key) : fallback
  },
  set(key, value) {
    memoryStore.set(key, value)
    try {
      window.localStorage.setItem(key, JSON.stringify(value))
    } catch {
      // storage blocked or full: the in-memory copy still works for this visit
    }
  },
  remove(key) {
    memoryStore.delete(key)
    try {
      window.localStorage.removeItem(key)
    } catch {
      // ignore
    }
  }
}

// ---------------------------------------------------------------------------
// Password hashing
// ---------------------------------------------------------------------------

const encoder = new TextEncoder()

const toBase64 = (bytes) => {
  let binary = ''
  for (const byte of bytes) binary += String.fromCharCode(byte)
  return window.btoa(binary)
}

const fromBase64 = (value) => Uint8Array.from(window.atob(value), (char) => char.charCodeAt(0))

const randomBytes = (length) => window.crypto.getRandomValues(new Uint8Array(length))

const randomId = () => (
  typeof window.crypto.randomUUID === 'function'
    ? window.crypto.randomUUID()
    : [...randomBytes(16)].map((byte) => byte.toString(16).padStart(2, '0')).join('')
)

// Plain JS SHA-256, used only when the Web Crypto API is unavailable (it is
// disabled on pages served over plain http:// that are not localhost).
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
])

function sha256(message) {
  const rotr = (x, n) => (x >>> n) | (x << (32 - n))
  const length = message.length
  const paddedLength = (((length + 9 + 63) >> 6) << 6)
  const data = new Uint8Array(paddedLength)
  data.set(message)
  data[length] = 0x80
  const view = new DataView(data.buffer)
  view.setUint32(paddedLength - 8, Math.floor((length * 8) / 0x100000000))
  view.setUint32(paddedLength - 4, (length * 8) >>> 0)
  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
  ])
  const w = new Uint32Array(64)
  for (let offset = 0; offset < paddedLength; offset += 64) {
    for (let i = 0; i < 16; i += 1) w[i] = view.getUint32(offset + i * 4)
    for (let i = 16; i < 64; i += 1) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3)
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10)
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0
    }
    let [a, b, c, d, e, f, g, hh] = h
    for (let i = 0; i < 64; i += 1) {
      const s1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25)
      const ch = (e & f) ^ (~e & g)
      const t1 = (hh + s1 + ch + K[i] + w[i]) >>> 0
      const s0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22)
      const maj = (a & b) ^ (a & c) ^ (b & c)
      const t2 = (s0 + maj) >>> 0
      hh = g; g = f; f = e
      e = (d + t1) >>> 0
      d = c; c = b; b = a
      a = (t1 + t2) >>> 0
    }
    h[0] += a; h[1] += b; h[2] += c; h[3] += d
    h[4] += e; h[5] += f; h[6] += g; h[7] += hh
  }
  const out = new Uint8Array(32)
  const outView = new DataView(out.buffer)
  h.forEach((value, index) => outView.setUint32(index * 4, value))
  return out
}

async function derivePasswordHash(password, saltBase64, algo) {
  const salt = fromBase64(saltBase64)
  if (algo === 'pbkdf2') {
    const key = await window.crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
    const bits = await window.crypto.subtle.deriveBits(
      { name: 'PBKDF2', hash: 'SHA-256', salt, iterations: PBKDF2_ITERATIONS },
      key,
      256
    )
    return toBase64(new Uint8Array(bits))
  }
  const passwordBytes = encoder.encode(password)
  let digest = sha256(new Uint8Array([...salt, ...passwordBytes]))
  for (let round = 0; round < FALLBACK_ROUNDS; round += 1) {
    digest = sha256(new Uint8Array([...digest, ...salt]))
  }
  return toBase64(digest)
}

const canUsePbkdf2 = () => Boolean(window.crypto?.subtle)

async function createPasswordRecord(password) {
  const algo = canUsePbkdf2() ? 'pbkdf2' : 'sha256-iterated'
  const salt = toBase64(randomBytes(16))
  return { password_algo: algo, password_salt: salt, password_hash: await derivePasswordHash(password, salt, algo) }
}

async function passwordMatches(user, password) {
  if (!user?.password_hash) return false
  // A PBKDF2 hash can only be checked where Web Crypto exists.
  if (user.password_algo === 'pbkdf2' && !canUsePbkdf2()) return false
  const actual = await derivePasswordHash(password, user.password_salt, user.password_algo)
  if (actual.length !== user.password_hash.length) return false
  let difference = 0
  for (let i = 0; i < actual.length; i += 1) difference |= actual.charCodeAt(i) ^ user.password_hash.charCodeAt(i)
  return difference === 0
}

// ---------------------------------------------------------------------------
// Data helpers
// ---------------------------------------------------------------------------

const loadUsers = () => store.get(USERS_KEY, [])
const saveUsers = (users) => store.set(USERS_KEY, users)
const loadOrders = () => store.get(ORDERS_KEY, [])
const saveOrders = (orders) => store.set(ORDERS_KEY, orders)

const publicUser = (row) => ({
  id: row.id,
  name: row.display_name,
  email: row.email,
  role: row.role,
  profileImage: row.profile_image || null
})

const fail = (status, message) => Object.assign(new Error(message), { status })

let seedPromise = null

function ensureSeeded() {
  if (!seedPromise) {
    seedPromise = seedAccounts().catch((error) => {
      seedPromise = null
      throw error
    })
  }
  return seedPromise
}

async function seedAccounts() {
  // Clean up the session key used by the previous "mock login" version.
  store.remove('grounded_mock_user')

  const users = loadUsers()
  let changed = false

  // The administrator account is always present and always an admin.
  const admin = users.find((user) => user.email === ADMIN_EMAIL)
  if (!admin) {
    users.push({
      id: randomId(),
      display_name: ADMIN_NAME,
      email: ADMIN_EMAIL,
      role: 'admin',
      account_status: 'active',
      created_at: Date.now(),
      ...(await createPasswordRecord(ADMIN_PASSWORD))
    })
    changed = true
  } else {
    if (admin.role !== 'admin' || admin.account_status !== 'active') {
      admin.role = 'admin'
      admin.account_status = 'active'
      changed = true
    }
    // Keep the stored password in step with the configured admin password.
    if (!(await passwordMatches(admin, ADMIN_PASSWORD))) {
      Object.assign(admin, await createPasswordRecord(ADMIN_PASSWORD))
      changed = true
    }
  }

  // The demo customer is only created once, so deleting it sticks.
  if (!store.get(SEEDED_KEY, false)) {
    if (!users.some((user) => user.email === DEMO_EMAIL)) {
      users.push({
        id: randomId(),
        display_name: DEMO_NAME,
        email: DEMO_EMAIL,
        role: 'customer',
        account_status: 'active',
        created_at: Date.now(),
        ...(await createPasswordRecord(DEMO_PASSWORD))
      })
      changed = true
    }
    store.set(SEEDED_KEY, true)
  }

  if (changed) saveUsers(users)
}

function getSignedInUserRow() {
  const id = store.get(SESSION_KEY, null)
  if (!id) return null
  const row = loadUsers().find((user) => user.id === id)
  return row && row.account_status === 'active' ? row : null
}

function requireUser() {
  const row = getSignedInUserRow()
  if (!row) throw fail(401, 'Please sign in to continue.')
  return row
}

function requireStaff(adminOnly = false) {
  const row = requireUser()
  if (row.role !== 'admin' && !(row.role === 'staff' && !adminOnly)) {
    throw fail(403, 'You do not have permission to access this area.')
  }
  return row
}

function serializeOrder(order, users) {
  const customer = users.find((user) => user.id === order.customerId)
  return {
    ...order,
    customerName: customer?.display_name ?? 'Deleted account',
    customerEmail: customer?.email ?? ''
  }
}

function getManilaParts(timestamp) {
  // Asia/Manila is a fixed UTC+8 with no daylight saving time.
  const shifted = new Date(timestamp + 8 * 60 * 60 * 1000)
  return {
    hour: shifted.getUTCHours(),
    minute: shifted.getUTCMinutes(),
    second: shifted.getUTCSeconds()
  }
}

function validateScheduledAt(value) {
  if (typeof value !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    throw fail(400, 'Choose a pickup or delivery time in Asia/Manila.')
  }
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) throw fail(400, 'Choose a valid pickup or delivery time.')
  if (timestamp < Date.now() + 30 * 60 * 1000 || timestamp > Date.now() + 14 * 24 * 60 * 60 * 1000) {
    throw fail(400, 'Choose a time at least 30 minutes from now and within the next 14 days.')
  }
  const parts = getManilaParts(timestamp)
  if (parts.hour < 9 || parts.hour > 20 || (parts.hour === 20 && parts.minute > 30) || ![0, 30].includes(parts.minute) || parts.second !== 0) {
    throw fail(400, 'Pickup and delivery slots are available every 30 minutes from 9:00 AM to 8:30 PM, Asia/Manila time.')
  }
  return new Date(timestamp).toISOString()
}

// ---------------------------------------------------------------------------
// Route handlers (same URLs and JSON shapes as server.js)
// ---------------------------------------------------------------------------

async function handleAuth(pathname, method, body) {
  if (pathname === '/api/auth/me' && method === 'GET') {
    const row = getSignedInUserRow()
    return { status: 200, body: { user: row ? publicUser(row) : null } }
  }

  if (pathname === '/api/auth/profile' && method === 'PUT') {
    const row = requireUser()
    const image = body.profileImage
    if (image !== null && (typeof image !== 'string' || image.length > 420 * 1024)) {
      throw fail(400, 'Choose a profile image smaller than 300 KB.')
    }
    if (typeof image === 'string') {
      const match = /^data:image\/(jpeg|png|webp);base64,([A-Za-z0-9+/]+={0,2})$/.exec(image)
      if (!match) throw fail(400, 'Choose a JPEG, PNG, or WebP profile image.')
      const bytes = fromBase64(match[2])
      if (!bytes.length || bytes.length > 300 * 1024 || toBase64(bytes) !== match[2]) {
        throw fail(400, 'Choose a profile image smaller than 300 KB.')
      }
      const isJpeg = match[1] === 'jpeg' && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[bytes.length - 2] === 0xff && bytes[bytes.length - 1] === 0xd9
      const isPng = match[1] === 'png' && [137, 80, 78, 71, 13, 10, 26, 10].every((byte, index) => bytes[index] === byte)
      const isWebp = match[1] === 'webp' && String.fromCharCode(...bytes.slice(0, 4)) === 'RIFF' && String.fromCharCode(...bytes.slice(8, 12)) === 'WEBP'
      if (!isJpeg && !isPng && !isWebp) throw fail(400, 'The selected file is not a valid image.')
    }
    row.profile_image = image
    saveUsers(loadUsers().map((user) => user.id === row.id ? row : user))
    return { status: 200, body: { user: publicUser(row) } }
  }

  if (!['/api/auth/login', '/api/auth/register', '/api/auth/logout'].includes(pathname)) {
    return { status: 404, body: { error: 'Account endpoint not found.' } }
  }
  if (method !== 'POST') return { status: 405, body: { error: 'Method not allowed.' } }

  if (pathname === '/api/auth/logout') {
    store.remove(SESSION_KEY)
    return { status: 200, body: { ok: true } }
  }

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!EMAIL_PATTERN.test(email) || email.length > 254) {
    return { status: 400, body: { error: 'Enter a valid email address.' } }
  }

  if (pathname === '/api/auth/register') {
    if (password.length < 8 || password.length > 128) {
      return { status: 400, body: { error: 'Password must be between 8 and 128 characters.' } }
    }
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name.length < 2 || name.length > 80) {
      return { status: 400, body: { error: 'Name must be between 2 and 80 characters.' } }
    }
    const users = loadUsers()
    if (users.some((user) => user.email === email)) {
      return { status: 409, body: { error: 'An account with that email already exists. Please log in.' } }
    }
    const row = {
      id: randomId(),
      display_name: name,
      email,
      role: 'customer',
      account_status: 'active',
      created_at: Date.now(),
      ...(await createPasswordRecord(password))
    }
    users.push(row)
    saveUsers(users)
    store.set(SESSION_KEY, row.id)
    return { status: 201, body: { user: publicUser(row) } }
  }

  // login
  if (password.length < 1 || password.length > 128) {
    return { status: 400, body: { error: 'Enter your password.' } }
  }
  const row = loadUsers().find((user) => user.email === email)
  if (!row || !(await passwordMatches(row, password))) {
    return { status: 401, body: { error: 'Email or password is incorrect.' } }
  }
  if (row.account_status !== 'active') {
    return { status: 403, body: { error: 'This account has been deactivated. Contact the café administrator for help.' } }
  }
  store.set(SESSION_KEY, row.id)
  return { status: 200, body: { user: publicUser(row) } }
}

function getConfig() {
  return {
    store: { timeZone: 'Asia/Manila', opensAt: '09:00', closesAt: '21:00', slotMinutes: 30 },
    delivery: {
      enabled: false,
      includedKm: 5,
      baseFeeCents: 10000,
      perKmCents: 10000,
      setupMessage: 'Delivery quotes are not available yet. Please contact the café or choose pickup.'
    },
    paymentMethods: [{ id: 'cash', label: 'Cash on pickup/delivery' }],
    onlinePaymentMessage: 'GCash online payment is unavailable until a merchant gateway can verify the exact order amount.',
    paypalEnabled: false
  }
}

function placeOrder(user, body) {
  const fulfillment = body.fulfillment
  if (!['pickup', 'delivery'].includes(fulfillment)) throw fail(400, 'Choose pickup or delivery.')
  const scheduledAt = validateScheduledAt(body.scheduledAt)
  const contactPhone = typeof body.contactPhone === 'string' ? body.contactPhone.trim() : ''
  if (!/^[+0-9()\s.-]{7,25}$/.test(contactPhone)) throw fail(400, 'Enter a valid contact phone number.')
  const deliveryAddress = typeof body.deliveryAddress === 'string' ? body.deliveryAddress.trim() : ''
  if (fulfillment === 'delivery') {
    if (deliveryAddress.length < 8 || deliveryAddress.length > 500) {
      throw fail(400, 'Enter a complete delivery address (8–500 characters).')
    }
    // Delivery pricing needs the server-side route lookup, which a static site cannot do.
    throw fail(400, 'Delivery quotes are not available yet. Please contact the café or choose pickup.')
  }
  if (body.paymentMethod === 'gcash') {
    throw fail(400, 'Online GCash is unavailable until a merchant gateway can verify the exact order amount.')
  }
  if (body.paymentMethod !== 'cash') {
    throw fail(400, 'That payment method is not available. Refresh checkout and choose an available option.')
  }
  if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > MAX_ORDER_ITEMS) {
    throw fail(400, `Your order must contain between 1 and ${MAX_ORDER_ITEMS} different items.`)
  }

  const itemIds = new Set()
  const items = []
  let subtotalCents = 0
  for (const line of body.items) {
    const id = Number(line.id)
    const quantity = Number(line.quantity)
    const product = orderCatalog.get(id)
    if (!Number.isSafeInteger(id) || !product || product.soldOut) {
      throw fail(400, 'One or more items are unavailable. Refresh the menu and try again.')
    }
    if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20 || itemIds.has(id)) {
      throw fail(400, 'Each item quantity must be between 1 and 20.')
    }
    itemIds.add(id)
    const lineTotalCents = product.priceCents * quantity
    subtotalCents += lineTotalCents
    items.push({ id, name: product.name, quantity, unitPriceCents: product.priceCents, lineTotalCents })
  }

  const now = Date.now()
  const suffix = [...randomBytes(3)].map((byte) => byte.toString(16).padStart(2, '0')).join('').toUpperCase()
  return {
    id: randomId(),
    orderNumber: `GB-${now.toString(36).toUpperCase()}-${suffix}`,
    customerId: user.id,
    items,
    fulfillment,
    scheduledAt,
    contactPhone,
    deliveryAddress: null,
    deliveryDistanceMeters: null,
    subtotalCents,
    deliveryFeeCents: 0,
    totalCents: subtotalCents,
    paymentMethod: 'cash',
    paymentStatus: 'unpaid',
    status: 'received',
    createdAt: now,
    updatedAt: now
  }
}

function updateOrder(orderId, body) {
  const orders = loadOrders()
  const order = orders.find((item) => item.id === orderId)
  if (!order) return { status: 404, body: { error: 'Order not found.' } }

  const nextStatus = body.status ?? order.status
  const nextPaymentStatus = body.paymentStatus ?? order.paymentStatus
  if (!ORDER_STATUSES.includes(nextStatus) || !PAYMENT_STATUSES.includes(nextPaymentStatus)) {
    throw fail(400, 'Choose a valid order or payment status.')
  }
  if (nextStatus !== order.status) {
    const transitions = {
      received: ['confirmed', 'cancelled'],
      confirmed: ['preparing', 'cancelled'],
      preparing: [order.fulfillment === 'delivery' ? 'out_for_delivery' : 'ready', 'cancelled'],
      ready: ['completed', 'cancelled'],
      out_for_delivery: ['completed', 'cancelled'],
      completed: [],
      cancelled: []
    }
    if (!transitions[order.status].includes(nextStatus)) {
      throw fail(409, 'That order status transition is not allowed.')
    }
    if ((nextStatus === 'ready' && order.fulfillment !== 'pickup')
      || (nextStatus === 'out_for_delivery' && order.fulfillment !== 'delivery')) {
      throw fail(409, 'That status does not match the order fulfillment method.')
    }
  }
  const paymentTransitions = { unpaid: ['paid'], paid: ['refunded'], refunded: [] }
  if (nextPaymentStatus !== order.paymentStatus && !paymentTransitions[order.paymentStatus].includes(nextPaymentStatus)) {
    throw fail(409, 'That payment status transition is not allowed.')
  }
  order.status = nextStatus
  order.paymentStatus = nextPaymentStatus
  order.updatedAt = Date.now()
  saveOrders(orders)
  return { status: 200, body: { order: serializeOrder(order, loadUsers()) } }
}

async function handleBusiness(pathname, method, body) {
  if (pathname === '/api/config' && method === 'GET') {
    return { status: 200, body: getConfig() }
  }

  if (pathname === '/api/orders' && method === 'GET') {
    const user = requireUser()
    const users = loadUsers()
    const orders = loadOrders()
      .filter((order) => order.customerId === user.id)
      .sort((a, b) => b.createdAt - a.createdAt)
    return { status: 200, body: { orders: orders.map((order) => serializeOrder(order, users)) } }
  }

  if (pathname === '/api/delivery/quote' && method === 'POST') {
    requireUser()
    throw fail(503, 'Delivery quotes are not configured yet. Please choose pickup or contact the café.')
  }

  if (pathname === '/api/orders' && method === 'POST') {
    const user = requireUser()
    const order = placeOrder(user, body)
    const orders = loadOrders()
    orders.push(order)
    saveOrders(orders)
    return { status: 201, body: { order: serializeOrder(order, loadUsers()) } }
  }

  if (pathname === '/api/staff/orders' && method === 'GET') {
    requireStaff()
    const users = loadUsers()
    const orders = [...loadOrders()].sort((a, b) => b.createdAt - a.createdAt)
    return { status: 200, body: { orders: orders.map((order) => serializeOrder(order, users)) } }
  }

  const orderMatch = /^\/api\/staff\/orders\/([^/]+)$/.exec(pathname)
  if (orderMatch && method === 'PATCH') {
    requireStaff()
    return updateOrder(decodeURIComponent(orderMatch[1]), body)
  }

  if (pathname === '/api/staff/users' && method === 'GET') {
    requireStaff(true)
    const users = loadUsers()
      .filter((user) => user.account_status !== 'deleted')
      .sort((a, b) => b.created_at - a.created_at)
      .map(({ id, display_name, email, role, account_status, created_at }) => (
        { id, display_name, email, role, account_status, created_at }
      ))
    return { status: 200, body: { users } }
  }

  const userMatch = /^\/api\/staff\/users\/([^/]+)$/.exec(pathname)
  if (userMatch && ['PATCH', 'DELETE'].includes(method)) {
    requireStaff(true)
    const users = loadUsers()
    const target = users.find((user) => user.id === decodeURIComponent(userMatch[1]))
    if (!target || target.account_status === 'deleted') return { status: 404, body: { error: 'Account not found.' } }
    if (target.role === 'admin') {
      return { status: 403, body: { error: 'Administrator accounts cannot be changed from this dashboard.' } }
    }

    if (method === 'DELETE') {
      target.display_name = 'Deleted account'
      target.email = `deleted+${target.id}@deleted.invalid`
      target.role = 'customer'
      target.account_status = 'deleted'
      target.profile_image = null
      Object.assign(target, {
        password_algo: 'sha256-iterated',
        password_salt: toBase64(randomBytes(16)),
        password_hash: toBase64(randomBytes(32))
      })
      saveUsers(users)
      saveOrders(loadOrders().map((order) => (
        order.customerId === target.id ? { ...order, contactPhone: '', deliveryAddress: null } : order
      )))
      return { status: 200, body: { ok: true } }
    }

    if (body.role !== undefined && !['customer', 'staff'].includes(body.role)) {
      throw fail(400, 'Choose customer or staff access.')
    }
    if (body.active !== undefined && typeof body.active !== 'boolean') {
      throw fail(400, 'Choose whether this account should be active.')
    }
    if (body.role === undefined && body.active === undefined) {
      throw fail(400, 'Choose an account role or active status to update.')
    }
    target.role = body.role ?? target.role
    if (body.active !== undefined) target.account_status = body.active ? 'active' : 'deactivated'
    saveUsers(users)
    const { id, display_name, email, role, account_status, created_at } = target
    return { status: 200, body: { user: { id, display_name, email, role, account_status, created_at } } }
  }

  return { status: 404, body: { error: 'Order endpoint not found.' } }
}

// ---------------------------------------------------------------------------
// Entry point: behaves like fetch() for /api/* paths
// ---------------------------------------------------------------------------

export async function localFetch(path, options = {}) {
  let result
  try {
    await ensureSeeded()
    const { pathname } = new URL(path, 'http://local.invalid')
    const method = (options.method || 'GET').toUpperCase()
    let body = {}
    if (typeof options.body === 'string' && options.body) {
      try {
        body = JSON.parse(options.body)
      } catch {
        throw fail(400, 'Please submit valid form data.')
      }
    }
    result = pathname.startsWith('/api/auth/')
      ? await handleAuth(pathname, method, body)
      : await handleBusiness(pathname, method, body)
  } catch (error) {
    if (error?.status) {
      result = { status: error.status, body: { error: error.message } }
    } else {
      console.error('Local account service error:', error)
      result = { status: 500, body: { error: 'Something went wrong. Please try again.' } }
    }
  }
  return new Response(JSON.stringify(result.body), {
    status: result.status,
    headers: { 'Content-Type': 'application/json' }
  })
}
