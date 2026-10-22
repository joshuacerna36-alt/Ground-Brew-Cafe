import { createServer as createHttpServer } from 'node:http'
import { createReadStream, existsSync, mkdirSync, statSync } from 'node:fs'
import { createHash, randomBytes, randomUUID, scrypt as scryptCallback, timingSafeEqual } from 'node:crypto'
import { promisify } from 'node:util'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { DatabaseSync } from 'node:sqlite'
import { orderCatalog } from './src/menuCatalog.js'

const scrypt = promisify(scryptCallback)
const rootDir = path.dirname(fileURLToPath(import.meta.url))
const production = process.env.NODE_ENV === 'production' || process.argv.includes('--production')
const portArg = process.argv.indexOf('--port')
const hostArg = process.argv.indexOf('--host')
const port = Number(portArg === -1 ? process.env.PORT || 5173 : process.argv[portArg + 1])
const host = hostArg === -1
  ? process.env.HOST || (production ? '0.0.0.0' : '127.0.0.1')
  : process.argv[hostArg + 1]
const databasePath = path.resolve(process.env.DATABASE_PATH || path.join(rootDir, 'data', 'accounts.sqlite'))
const sessionCookie = 'grounded_session'
const sessionDuration = 30 * 24 * 60 * 60
const maxRequestBytes = 16 * 1024
const authLimits = new Map()
const businessLimits = new Map()
const orderStatuses = ['received', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled']
const paymentStatuses = ['unpaid', 'paid', 'refunded']
const orderMethods = new Set(['cash'])
const storeTimeZone = 'Asia/Manila'
const deliveryBasePhp = parseRate(process.env.DELIVERY_BASE_PHP, 100)
const deliveryIncludedKm = parseRate(process.env.DELIVERY_INCLUDED_KM, 5)
const deliveryPerKmPhp = parseRate(process.env.DELIVERY_PER_KM_PHP, 100)
const maxOrderItems = 30

function parseRate(value, fallback) {
  if (value === undefined || value === '') return fallback
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed < 0) throw new Error('Delivery rate settings must be non-negative numbers.')
  return parsed
}

mkdirSync(path.dirname(databasePath), { recursive: true })

const database = new DatabaseSync(databasePath)
database.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    display_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    password_salt TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'customer' CHECK(role IN ('customer', 'staff', 'admin')),
    email_verified INTEGER NOT NULL DEFAULT 1 CHECK(email_verified IN (0, 1)),
    account_status TEXT NOT NULL DEFAULT 'active' CHECK(account_status IN ('active', 'deactivated', 'deleted')),
    created_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS sessions (
    token_hash TEXT PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    expires_at INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS sessions_expires_at ON sessions(expires_at);
  CREATE TABLE IF NOT EXISTS orders (
    id TEXT PRIMARY KEY,
    order_number TEXT NOT NULL UNIQUE,
    customer_id TEXT NOT NULL REFERENCES users(id),
    items_json TEXT NOT NULL,
    fulfillment TEXT NOT NULL CHECK(fulfillment IN ('pickup', 'delivery')),
    scheduled_at TEXT NOT NULL,
    contact_phone TEXT NOT NULL,
    delivery_address TEXT,
    delivery_distance_meters INTEGER,
    subtotal_cents INTEGER NOT NULL,
    delivery_fee_cents INTEGER NOT NULL,
    total_cents INTEGER NOT NULL,
    payment_method TEXT NOT NULL CHECK(payment_method IN ('cash', 'gcash')),
    payment_status TEXT NOT NULL DEFAULT 'unpaid' CHECK(payment_status IN ('unpaid', 'paid', 'refunded')),
    status TEXT NOT NULL DEFAULT 'received' CHECK(status IN ('received', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'completed', 'cancelled')),
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS orders_customer_created ON orders(customer_id, created_at DESC);
  CREATE INDEX IF NOT EXISTS orders_status_created ON orders(status, created_at DESC);
  CREATE TABLE IF NOT EXISTS delivery_quotes (
    id TEXT PRIMARY KEY,
    customer_id TEXT NOT NULL REFERENCES users(id),
    delivery_address TEXT NOT NULL,
    distance_meters INTEGER NOT NULL,
    fee_cents INTEGER NOT NULL,
    expires_at INTEGER NOT NULL,
    used_at INTEGER
  );
  CREATE INDEX IF NOT EXISTS delivery_quotes_customer_expiry ON delivery_quotes(customer_id, expires_at);
`)

const userColumns = database.prepare('PRAGMA table_info(users)').all()
if (!userColumns.some((column) => column.name === 'role')) {
  database.exec("ALTER TABLE users ADD COLUMN role TEXT NOT NULL DEFAULT 'customer'")
}
if (!userColumns.some((column) => column.name === 'email_verified')) {
  database.exec('ALTER TABLE users ADD COLUMN email_verified INTEGER NOT NULL DEFAULT 1 CHECK(email_verified IN (0, 1))')
}
if (!userColumns.some((column) => column.name === 'account_status')) {
  database.exec("ALTER TABLE users ADD COLUMN account_status TEXT NOT NULL DEFAULT 'active' CHECK(account_status IN ('active', 'deactivated', 'deleted'))")
}
database.exec("UPDATE users SET email_verified = 1 WHERE email_verified = 0")
database.exec('DROP TABLE IF EXISTS email_verifications')

const statements = {
  findUserByEmail: database.prepare('SELECT id, display_name, email, password_hash, password_salt, role, account_status FROM users WHERE email = ?'),
  insertUser: database.prepare('INSERT INTO users (id, display_name, email, password_hash, password_salt, role, email_verified, account_status, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'),
  insertSession: database.prepare('INSERT INTO sessions (token_hash, user_id, expires_at, created_at) VALUES (?, ?, ?, ?)'),
  findSession: database.prepare(`
    SELECT users.id, users.display_name, users.email, users.role
    FROM sessions JOIN users ON users.id = sessions.user_id
    WHERE sessions.token_hash = ? AND sessions.expires_at > ? AND users.account_status = 'active'
  `),
  deleteSession: database.prepare('DELETE FROM sessions WHERE token_hash = ?'),
  deleteUserSessions: database.prepare('DELETE FROM sessions WHERE user_id = ?'),
  deleteExpiredSessions: database.prepare('DELETE FROM sessions WHERE expires_at <= ?'),
  insertOrder: database.prepare(`
    INSERT INTO orders (
      id, order_number, customer_id, items_json, fulfillment, scheduled_at, contact_phone,
      delivery_address, delivery_distance_meters, subtotal_cents, delivery_fee_cents,
      total_cents, payment_method, payment_status, status, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'unpaid', 'received', ?, ?)
  `),
  insertDeliveryQuote: database.prepare('INSERT INTO delivery_quotes (id, customer_id, delivery_address, distance_meters, fee_cents, expires_at) VALUES (?, ?, ?, ?, ?, ?)'),
  findDeliveryQuote: database.prepare('SELECT * FROM delivery_quotes WHERE id = ? AND customer_id = ? AND delivery_address = ? AND expires_at > ? AND used_at IS NULL'),
  useDeliveryQuote: database.prepare('UPDATE delivery_quotes SET used_at = ? WHERE id = ? AND used_at IS NULL'),
  findCustomerOrders: database.prepare('SELECT * FROM orders WHERE customer_id = ? ORDER BY created_at DESC LIMIT 100'),
  findStaffOrders: database.prepare("SELECT orders.*, users.display_name AS customer_name, CASE WHEN users.account_status = 'deleted' THEN '' ELSE users.email END AS customer_email FROM orders JOIN users ON users.id = orders.customer_id ORDER BY orders.created_at DESC LIMIT 500"),
  updateOrder: database.prepare('UPDATE orders SET status = ?, payment_status = ?, updated_at = ? WHERE id = ?'),
  listUsers: database.prepare("SELECT id, display_name, email, role, account_status, created_at FROM users WHERE account_status != 'deleted' ORDER BY created_at DESC LIMIT 500"),
  updateUserAccess: database.prepare("UPDATE users SET role = ?, account_status = ? WHERE id = ? AND role != 'admin' AND account_status != 'deleted'"),
  deleteUserQuotes: database.prepare('DELETE FROM delivery_quotes WHERE customer_id = ?'),
  anonymizeUserOrders: database.prepare("UPDATE orders SET contact_phone = '', delivery_address = NULL WHERE customer_id = ?"),
  anonymizeUser: database.prepare("UPDATE users SET display_name = 'Deleted account', email = 'deleted+' || id || '@deleted.invalid', password_hash = ?, password_salt = ?, role = 'customer', account_status = 'deleted' WHERE id = ? AND role != 'admin'"),
  countAdmins: database.prepare("SELECT COUNT(*) AS count FROM users WHERE role = 'admin'")
}

const hashToken = (token) => createHash('sha256').update(token).digest('hex')

function sendJson(response, status, value, extraHeaders = {}) {
  response.writeHead(status, {
    'Cache-Control': 'no-store',
    'Content-Type': 'application/json; charset=utf-8',
    'X-Content-Type-Options': 'nosniff',
    ...extraHeaders
  })
  response.end(JSON.stringify(value))
}

function setSessionCookie(response, token, maxAge = sessionDuration) {
  const secure = production ? '; Secure' : ''
  response.setHeader(
    'Set-Cookie',
    `${sessionCookie}=${token}; Path=/; HttpOnly; SameSite=Strict; Max-Age=${maxAge}${secure}`
  )
}

function clearSessionCookie(response) {
  const secure = production ? '; Secure' : ''
  response.setHeader(
    'Set-Cookie',
    `${sessionCookie}=; Path=/; HttpOnly; SameSite=Strict; Max-Age=0; Expires=Thu, 01 Jan 1970 00:00:00 GMT${secure}`
  )
}

function getSessionToken(request) {
  const cookieHeader = request.headers.cookie || ''
  const cookie = cookieHeader.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${sessionCookie}=`))
  const token = cookie?.slice(sessionCookie.length + 1)
  return token && /^[A-Za-z0-9_-]{40,60}$/.test(token) ? token : null
}

function getSignedInUser(request) {
  const token = getSessionToken(request)
  if (!token) return null
  const row = statements.findSession.get(hashToken(token), Date.now())
  return row ? { id: row.id, name: row.display_name, email: row.email, role: row.role } : null
}

function createLoginSession(user, response) {
  const token = randomBytes(32).toString('base64url')
  const now = Date.now()
  statements.deleteExpiredSessions.run(now)
  statements.insertSession.run(hashToken(token), user.id, now + sessionDuration * 1000, now)
  setSessionCookie(response, token)
}

async function readJsonBody(request) {
  let size = 0
  const chunks = []
  for await (const chunk of request) {
    size += chunk.length
    if (size > maxRequestBytes) throw Object.assign(new Error('Request is too large.'), { status: 413 })
    chunks.push(chunk)
  }
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'))
  } catch {
    throw Object.assign(new Error('Please submit valid form data.'), { status: 400 })
  }
}

function isSameOrigin(request) {
  const origin = request.headers.origin
  if (!origin) return true
  try {
    return new URL(origin).host === request.headers.host
  } catch {
    return false
  }
}

function allowAuthAttempt(request, response) {
  const key = request.socket.remoteAddress || 'unknown'
  const now = Date.now()
  const interval = 15 * 60 * 1000
  const record = authLimits.get(key)
  if (!record || now - record.startedAt >= interval) {
    authLimits.set(key, { startedAt: now, attempts: 1 })
    return true
  }
  if (record.attempts >= 12) {
    const retryAfter = Math.ceil((interval - (now - record.startedAt)) / 1000)
    sendJson(response, 429, { error: 'Too many sign-in attempts. Please wait and try again.' }, { 'Retry-After': String(retryAfter) })
    return false
  }
  record.attempts += 1
  return true
}

function allowBusinessAction(key, maxAttempts, interval, response, message) {
  const now = Date.now()
  const record = businessLimits.get(key)
  if (!record || now - record.startedAt >= interval) {
    businessLimits.set(key, { startedAt: now, attempts: 1 })
    return true
  }
  if (record.attempts >= maxAttempts) {
    const retryAfter = Math.ceil((interval - (now - record.startedAt)) / 1000)
    sendJson(response, 429, { error: message }, { 'Retry-After': String(retryAfter) })
    return false
  }
  record.attempts += 1
  return true
}

async function handleAuth(request, response, pathname) {
  if (pathname === '/api/auth/me' && request.method === 'GET') {
    return sendJson(response, 200, { user: getSignedInUser(request) })
  }

  if (!['/api/auth/login', '/api/auth/register', '/api/auth/logout'].includes(pathname)) {
    return sendJson(response, 404, { error: 'Account endpoint not found.' })
  }

  if (request.method !== 'POST') {
    return sendJson(response, 405, { error: 'Method not allowed.' }, { Allow: 'POST' })
  }

  if (!isSameOrigin(request)) {
    return sendJson(response, 403, { error: 'Cross-origin account requests are not allowed.' })
  }

  if (pathname === '/api/auth/logout') {
    const token = getSessionToken(request)
    if (token) statements.deleteSession.run(hashToken(token))
    clearSessionCookie(response)
    return sendJson(response, 200, { ok: true })
  }

  if (!allowAuthAttempt(request, response)) return

  if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
    return sendJson(response, 415, { error: 'Account forms must be submitted as JSON.' })
  }

  const body = await readJsonBody(request)
  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const password = typeof body.password === 'string' ? body.password : ''

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    return sendJson(response, 400, { error: 'Enter a valid email address.' })
  }
  if (password.length < 8 || password.length > 128) {
    return sendJson(response, 400, { error: 'Password must be between 8 and 128 characters.' })
  }

  if (pathname === '/api/auth/register') {
    const name = typeof body.name === 'string' ? body.name.trim() : ''
    if (name.length < 2 || name.length > 80) {
      return sendJson(response, 400, { error: 'Name must be between 2 and 80 characters.' })
    }
    if (statements.findUserByEmail.get(email)) {
      return sendJson(response, 409, { error: 'An account with that email already exists. Please log in.' })
    }

    const salt = randomBytes(16)
    const passwordHash = await scrypt(password, salt, 64)
    const user = { id: randomUUID(), name, email, role: 'customer' }
    try {
      statements.insertUser.run(user.id, user.name, user.email, passwordHash.toString('base64url'), salt.toString('base64url'), user.role, 1, 'active', Date.now())
    } catch (error) {
      if (error.message?.includes('UNIQUE constraint failed: users.email')) {
        return sendJson(response, 409, { error: 'An account with that email already exists. Please log in.' })
      }
      throw error
    }
    createLoginSession(user, response)
    return sendJson(response, 201, { user })
  }

  const userRow = statements.findUserByEmail.get(email)
  const salt = userRow ? Buffer.from(userRow.password_salt, 'base64url') : Buffer.alloc(16, 17)
  const expectedHash = userRow ? Buffer.from(userRow.password_hash, 'base64url') : Buffer.alloc(64)
  const actualHash = await scrypt(password, salt, expectedHash.length)
  if (!userRow || !timingSafeEqual(actualHash, expectedHash)) {
    return sendJson(response, 401, { error: 'Email or password is incorrect.' })
  }
  if (userRow.account_status !== 'active') {
    return sendJson(response, 403, { error: 'This account has been deactivated. Contact the café administrator for help.' })
  }

  const user = { id: userRow.id, name: userRow.display_name, email: userRow.email, role: userRow.role }
  createLoginSession(user, response)
  return sendJson(response, 200, { user })
}

async function bootstrapAdmin() {
  const email = (process.env.ADMIN_EMAIL || '').trim().toLowerCase()
  const password = process.env.ADMIN_PASSWORD || ''
  if (!email && !password) return
  if (!email || !password) throw new Error('Set both ADMIN_EMAIL and ADMIN_PASSWORD to provision the administrator.')
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || email.length > 254) {
    throw new Error('ADMIN_EMAIL must be a valid email address.')
  }
  if (password.length < 12 || password.length > 128) {
    throw new Error('ADMIN_PASSWORD must be between 12 and 128 characters.')
  }

  const existing = statements.findUserByEmail.get(email)
  if (existing) {
    database.prepare("UPDATE users SET role = 'admin', email_verified = 1, account_status = 'active' WHERE id = ?").run(existing.id)
    console.log(`Administrator account ready for ${email}.`)
    return
  }

  const salt = randomBytes(16)
  const passwordHash = await scrypt(password, salt, 64)
  statements.insertUser.run(
    randomUUID(),
    (process.env.ADMIN_NAME || 'Grounded Brew Administrator').trim().slice(0, 80),
    email,
    passwordHash.toString('base64url'),
    salt.toString('base64url'),
    'admin',
    1,
    'active',
    Date.now()
  )
  console.log(`Initial administrator account created for ${email}.`)
}

function getApplicationConfig() {
  const cafeAddress = (process.env.CAFE_ADDRESS || '').trim()
  const mapsApiKey = (process.env.GOOGLE_MAPS_API_KEY || '').trim()
  return {
    store: { timeZone: storeTimeZone, opensAt: '09:00', closesAt: '21:00', slotMinutes: 30 },
    delivery: {
      enabled: Boolean(cafeAddress && mapsApiKey),
      includedKm: deliveryIncludedKm,
      baseFeeCents: Math.round(deliveryBasePhp * 100),
      perKmCents: Math.round(deliveryPerKmPhp * 100),
      setupMessage: 'Delivery quotes are not available yet. Please contact the café or choose pickup.'
    },
    paymentMethods: [{ id: 'cash', label: 'Cash on pickup/delivery' }],
    onlinePaymentMessage: 'GCash online payment is unavailable until a merchant gateway can verify the exact order amount.',
    paypalEnabled: false
  }
}

function getManilaDateParts(date) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: storeTimeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date)
  return Object.fromEntries(parts.filter((part) => part.type !== 'literal').map(({ type, value }) => [type, Number(value)]))
}

function validateScheduledAt(value) {
  if (typeof value !== 'string' || !/(Z|[+-]\d{2}:\d{2})$/i.test(value)) {
    throw Object.assign(new Error('Choose a pickup or delivery time in Asia/Manila.'), { status: 400 })
  }
  const timestamp = Date.parse(value)
  if (!Number.isFinite(timestamp)) throw Object.assign(new Error('Choose a valid pickup or delivery time.'), { status: 400 })
  if (timestamp < Date.now() + 30 * 60 * 1000 || timestamp > Date.now() + 14 * 24 * 60 * 60 * 1000) {
    throw Object.assign(new Error('Choose a time at least 30 minutes from now and within the next 14 days.'), { status: 400 })
  }
  const parts = getManilaDateParts(new Date(timestamp))
  if (parts.hour < 9 || parts.hour > 20 || (parts.hour === 20 && parts.minute > 30) || ![0, 30].includes(parts.minute) || parts.second !== 0) {
    throw Object.assign(new Error('Pickup and delivery slots are available every 30 minutes from 9:00 AM to 8:30 PM, Asia/Manila time.'), { status: 400 })
  }
  return new Date(timestamp).toISOString()
}

async function getDeliveryRoute(address) {
  const origin = (process.env.CAFE_ADDRESS || '').trim()
  const apiKey = (process.env.GOOGLE_MAPS_API_KEY || '').trim()
  if (!origin || !apiKey) {
    throw Object.assign(new Error('Delivery quotes are not configured yet. Please choose pickup or contact the café.'), { status: 503 })
  }
  let response
  try {
    response = await fetch('https://routes.googleapis.com/directions/v2:computeRoutes', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': 'routes.distanceMeters'
      },
      body: JSON.stringify({
        origin: { address: origin },
        destination: { address },
        travelMode: 'DRIVE',
        routingPreference: 'TRAFFIC_UNAWARE',
        units: 'METRIC',
        regionCode: 'ph'
      }),
      signal: AbortSignal.timeout(10000)
    })
  } catch (error) {
    console.error('Google Routes request failed:', error.message)
    throw Object.assign(new Error('Could not calculate the delivery route. Check the delivery address and try again.'), { status: 502 })
  }
  if (!response.ok) {
    console.error(`Google Routes returned HTTP ${response.status}.`)
    throw Object.assign(new Error('Could not calculate the delivery route. Check the delivery address and try again.'), { status: 502 })
  }
  const result = await response.json()
  const distanceMeters = result.routes?.[0]?.distanceMeters
  if (!Number.isSafeInteger(distanceMeters) || distanceMeters <= 0) {
    throw Object.assign(new Error('No driving route was found for that delivery address.'), { status: 400 })
  }
  return distanceMeters
}

function calculateDeliveryFeeCents(distanceMeters) {
  const distanceKm = distanceMeters / 1000
  return Math.round((deliveryBasePhp + Math.max(0, distanceKm - deliveryIncludedKm) * deliveryPerKmPhp) * 100)
}

function serializeOrder(row) {
  return {
    id: row.id,
    orderNumber: row.order_number,
    customerId: row.customer_id,
    customerName: row.customer_name,
    customerEmail: row.customer_email,
    items: JSON.parse(row.items_json),
    fulfillment: row.fulfillment,
    scheduledAt: row.scheduled_at,
    contactPhone: row.contact_phone,
    deliveryAddress: row.delivery_address,
    deliveryDistanceMeters: row.delivery_distance_meters,
    subtotalCents: row.subtotal_cents,
    deliveryFeeCents: row.delivery_fee_cents,
    totalCents: row.total_cents,
    paymentMethod: row.payment_method,
    paymentStatus: row.payment_status,
    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  }
}

function requireUser(request, response) {
  const user = getSignedInUser(request)
  if (!user) sendJson(response, 401, { error: 'Please sign in to continue.' })
  return user
}

function requireStaff(request, response, adminOnly = false) {
  const user = requireUser(request, response)
  if (!user) return null
  if (user.role !== 'admin' && !(user.role === 'staff' && !adminOnly)) {
    sendJson(response, 403, { error: 'You do not have permission to access this area.' })
    return null
  }
  return user
}

async function handleOrders(request, response, pathname) {
  if (pathname === '/api/config' && request.method === 'GET') {
    return sendJson(response, 200, getApplicationConfig())
  }

  if (pathname === '/api/orders' && request.method === 'GET') {
    const user = requireUser(request, response)
    if (!user) return
    return sendJson(response, 200, { orders: statements.findCustomerOrders.all(user.id).map(serializeOrder) })
  }

  if (pathname === '/api/delivery/quote' && request.method === 'POST') {
    if (!isSameOrigin(request)) return sendJson(response, 403, { error: 'Cross-origin delivery quote requests are not allowed.' })
    const user = requireUser(request, response)
    if (!user) return
    if (!allowBusinessAction(`quote:${user.id}`, 10, 10 * 60 * 1000, response, 'Too many delivery quote requests. Please wait and try again.')) return
    if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
      return sendJson(response, 415, { error: 'Delivery quote requests must be submitted as JSON.' })
    }
    const body = await readJsonBody(request)
    const address = typeof body.address === 'string' ? body.address.trim() : ''
    if (address.length < 8 || address.length > 500) {
      throw Object.assign(new Error('Enter a complete delivery address (8–500 characters).'), { status: 400 })
    }
    const distanceMeters = await getDeliveryRoute(address)
    const quote = {
      id: randomUUID(),
      distanceMeters,
      feeCents: calculateDeliveryFeeCents(distanceMeters),
      expiresAt: Date.now() + 10 * 60 * 1000
    }
    statements.insertDeliveryQuote.run(quote.id, user.id, address, quote.distanceMeters, quote.feeCents, quote.expiresAt)
    return sendJson(response, 200, { quote })
  }

  if (pathname === '/api/orders' && request.method === 'POST') {
    if (!isSameOrigin(request)) return sendJson(response, 403, { error: 'Cross-origin order requests are not allowed.' })
    const user = requireUser(request, response)
    if (!user) return
    if (!allowBusinessAction(`order:${user.id}`, 20, 60 * 60 * 1000, response, 'Too many orders were submitted. Please try again later.')) return
    if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
      return sendJson(response, 415, { error: 'Order forms must be submitted as JSON.' })
    }
    const body = await readJsonBody(request)
    const fulfillment = body.fulfillment
    if (!['pickup', 'delivery'].includes(fulfillment)) throw Object.assign(new Error('Choose pickup or delivery.'), { status: 400 })
    const scheduledAt = validateScheduledAt(body.scheduledAt)
    const contactPhone = typeof body.contactPhone === 'string' ? body.contactPhone.trim() : ''
    if (!/^[+0-9()\s.-]{7,25}$/.test(contactPhone)) {
      throw Object.assign(new Error('Enter a valid contact phone number.'), { status: 400 })
    }
    const deliveryAddress = typeof body.deliveryAddress === 'string' ? body.deliveryAddress.trim() : ''
    if (fulfillment === 'delivery' && (deliveryAddress.length < 8 || deliveryAddress.length > 500)) {
      throw Object.assign(new Error('Enter a complete delivery address (8–500 characters).'), { status: 400 })
    }
    const paymentMethod = body.paymentMethod
    if (paymentMethod === 'gcash') {
      throw Object.assign(new Error('Online GCash is unavailable until a merchant gateway can verify the exact order amount.'), { status: 400 })
    }
    if (!orderMethods.has(paymentMethod)) {
      throw Object.assign(new Error('That payment method is not available. Refresh checkout and choose an available option.'), { status: 400 })
    }
    if (!Array.isArray(body.items) || body.items.length === 0 || body.items.length > maxOrderItems) {
      throw Object.assign(new Error(`Your order must contain between 1 and ${maxOrderItems} different items.`), { status: 400 })
    }

    const itemIds = new Set()
    const items = []
    let subtotalCents = 0
    for (const line of body.items) {
      const id = Number(line.id)
      const quantity = Number(line.quantity)
      const product = orderCatalog.get(id)
      if (!Number.isSafeInteger(id) || !product || product.soldOut) {
        throw Object.assign(new Error('One or more items are unavailable. Refresh the menu and try again.'), { status: 400 })
      }
      if (!Number.isSafeInteger(quantity) || quantity < 1 || quantity > 20 || itemIds.has(id)) {
        throw Object.assign(new Error('Each item quantity must be between 1 and 20.'), { status: 400 })
      }
      itemIds.add(id)
      const lineTotalCents = product.priceCents * quantity
      subtotalCents += lineTotalCents
      items.push({ id, name: product.name, quantity, unitPriceCents: product.priceCents, lineTotalCents })
    }

    let deliveryQuote = null
    let deliveryFeeCents = 0
    if (fulfillment === 'delivery') {
      deliveryQuote = statements.findDeliveryQuote.get(body.deliveryQuoteId, user.id, deliveryAddress, Date.now())
      if (!deliveryQuote) {
        throw Object.assign(new Error('Calculate a new delivery quote before placing your order.'), { status: 400 })
      }
      deliveryFeeCents = deliveryQuote.fee_cents
    }

    const now = Date.now()
    const order = {
      id: randomUUID(),
      orderNumber: `GB-${now.toString(36).toUpperCase()}-${randomBytes(3).toString('hex').toUpperCase()}`,
      customerId: user.id,
      items,
      fulfillment,
      scheduledAt,
      contactPhone,
      deliveryAddress: fulfillment === 'delivery' ? deliveryAddress : null,
      deliveryDistanceMeters: deliveryQuote?.distance_meters ?? null,
      subtotalCents,
      deliveryFeeCents,
      totalCents: subtotalCents + deliveryFeeCents,
      paymentMethod,
      paymentStatus: 'unpaid',
      status: 'received',
      createdAt: now,
      updatedAt: now
    }
    database.exec('BEGIN IMMEDIATE')
    try {
      statements.insertOrder.run(
        order.id,
        order.orderNumber,
        order.customerId,
        JSON.stringify(order.items),
        order.fulfillment,
        order.scheduledAt,
        order.contactPhone,
        order.deliveryAddress,
        order.deliveryDistanceMeters,
        order.subtotalCents,
        order.deliveryFeeCents,
        order.totalCents,
        order.paymentMethod,
        now,
        now
      )
      if (deliveryQuote) statements.useDeliveryQuote.run(now, deliveryQuote.id)
      database.exec('COMMIT')
    } catch (error) {
      database.exec('ROLLBACK')
      throw error
    }
    return sendJson(response, 201, { order })
  }

  if (pathname === '/api/staff/orders' && request.method === 'GET') {
    if (!requireStaff(request, response)) return
    return sendJson(response, 200, { orders: statements.findStaffOrders.all().map(serializeOrder) })
  }

  const orderMatch = /^\/api\/staff\/orders\/([0-9a-f-]+)$/.exec(pathname)
  if (orderMatch && request.method === 'PATCH') {
    if (!isSameOrigin(request)) return sendJson(response, 403, { error: 'Cross-origin order updates are not allowed.' })
    if (!requireStaff(request, response)) return
    if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
      return sendJson(response, 415, { error: 'Order updates must be submitted as JSON.' })
    }
    const body = await readJsonBody(request)
    const current = database.prepare('SELECT status, payment_status, fulfillment FROM orders WHERE id = ?').get(orderMatch[1])
    if (!current) return sendJson(response, 404, { error: 'Order not found.' })
    const nextStatus = body.status ?? current.status
    const nextPaymentStatus = body.paymentStatus ?? current.payment_status
    if (!orderStatuses.includes(nextStatus) || !paymentStatuses.includes(nextPaymentStatus)) {
      throw Object.assign(new Error('Choose a valid order or payment status.'), { status: 400 })
    }
    if (nextStatus !== current.status) {
      const transitions = {
        received: ['confirmed', 'cancelled'],
        confirmed: ['preparing', 'cancelled'],
        preparing: [current.fulfillment === 'delivery' ? 'out_for_delivery' : 'ready', 'cancelled'],
        ready: ['completed', 'cancelled'],
        out_for_delivery: ['completed', 'cancelled'],
        completed: [],
        cancelled: []
      }
      if (!transitions[current.status].includes(nextStatus)) {
        throw Object.assign(new Error('That order status transition is not allowed.'), { status: 409 })
      }
      if ((nextStatus === 'ready' && current.fulfillment !== 'pickup') ||
          (nextStatus === 'out_for_delivery' && current.fulfillment !== 'delivery')) {
        throw Object.assign(new Error('That status does not match the order fulfillment method.'), { status: 409 })
      }
    }
    const paymentTransitions = { unpaid: ['paid'], paid: ['refunded'], refunded: [] }
    if (nextPaymentStatus !== current.payment_status && !paymentTransitions[current.payment_status].includes(nextPaymentStatus)) {
      throw Object.assign(new Error('That payment status transition is not allowed.'), { status: 409 })
    }
    statements.updateOrder.run(nextStatus, nextPaymentStatus, Date.now(), orderMatch[1])
    const updated = database.prepare('SELECT orders.*, users.display_name AS customer_name, users.email AS customer_email FROM orders JOIN users ON users.id = orders.customer_id WHERE orders.id = ?').get(orderMatch[1])
    return sendJson(response, 200, { order: serializeOrder(updated) })
  }

  if (pathname === '/api/staff/users' && request.method === 'GET') {
    if (!requireStaff(request, response, true)) return
    return sendJson(response, 200, { users: statements.listUsers.all() })
  }

  const userMatch = /^\/api\/staff\/users\/([0-9a-f-]+)$/.exec(pathname)
  if (userMatch && ['PATCH', 'DELETE'].includes(request.method)) {
    if (!isSameOrigin(request)) return sendJson(response, 403, { error: 'Cross-origin account changes are not allowed.' })
    if (!requireStaff(request, response, true)) return
    const target = database.prepare('SELECT id, role, account_status FROM users WHERE id = ?').get(userMatch[1])
    if (!target || target.account_status === 'deleted') {
      return sendJson(response, 404, { error: 'Account not found.' })
    }
    if (target.role === 'admin') return sendJson(response, 403, { error: 'Administrator accounts cannot be changed from this dashboard.' })

    if (request.method === 'DELETE') {
      const salt = randomBytes(16)
      const passwordHash = randomBytes(64)
      database.exec('BEGIN')
      try {
        statements.deleteUserSessions.run(target.id)
        statements.deleteUserQuotes.run(target.id)
        statements.anonymizeUserOrders.run(target.id)
        statements.anonymizeUser.run(passwordHash.toString('base64url'), salt.toString('base64url'), target.id)
        database.exec('COMMIT')
      } catch (error) {
        database.exec('ROLLBACK')
        throw error
      }
      return sendJson(response, 200, { ok: true })
    }

    if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) {
      return sendJson(response, 415, { error: 'Account updates must be submitted as JSON.' })
    }
    const body = await readJsonBody(request)
    if (body.role !== undefined && !['customer', 'staff'].includes(body.role)) {
      throw Object.assign(new Error('Choose customer or staff access.'), { status: 400 })
    }
    if (body.active !== undefined && typeof body.active !== 'boolean') {
      throw Object.assign(new Error('Choose whether this account should be active.'), { status: 400 })
    }
    if (body.role === undefined && body.active === undefined) {
      throw Object.assign(new Error('Choose an account role or active status to update.'), { status: 400 })
    }
    const role = body.role ?? target.role
    const accountStatus = body.active === undefined
      ? target.account_status
      : body.active ? 'active' : 'deactivated'
    statements.updateUserAccess.run(role, accountStatus, target.id)
    if (accountStatus !== 'active') statements.deleteUserSessions.run(target.id)
    const updated = database.prepare('SELECT id, display_name, email, role, account_status, created_at FROM users WHERE id = ?').get(target.id)
    return sendJson(response, 200, { user: updated })
  }

  return sendJson(response, 404, { error: 'Order endpoint not found.' })
}

const mimeTypes = {
  '.css': 'text/css; charset=utf-8',
  '.html': 'text/html; charset=utf-8',
  '.ico': 'image/x-icon',
  '.jpeg': 'image/jpeg',
  '.jpg': 'image/jpeg',
  '.js': 'text/javascript; charset=utf-8',
  '.mp4': 'video/mp4',
  '.png': 'image/png',
  '.svg': 'image/svg+xml',
  '.webp': 'image/webp'
}

function serveStatic(request, response) {
  const url = new URL(request.url, 'http://localhost')
  let pathname
  try {
    pathname = decodeURIComponent(url.pathname)
  } catch {
    response.writeHead(400).end('Bad request')
    return
  }
  const distDir = path.join(rootDir, 'dist')
  let requestedPath = pathname === '/' ? '/index.html' : pathname
  let filePath = path.resolve(distDir, `.${requestedPath}`)
  const relativePath = path.relative(distDir, filePath)
  if (relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    response.writeHead(403).end('Forbidden')
    return
  }

  if (!existsSync(filePath) || !statSync(filePath).isFile()) {
    if (request.headers.accept?.includes('text/html')) {
      filePath = path.join(distDir, 'index.html')
    } else {
      response.writeHead(404).end('Not found')
      return
    }
  }

  const stat = statSync(filePath)
  const contentType = mimeTypes[path.extname(filePath).toLowerCase()] || 'application/octet-stream'
  const range = request.headers.range
  if (range && contentType === 'video/mp4') {
    const match = /^bytes=(\d*)-(\d*)$/.exec(range)
    if (!match || (!match[1] && !match[2])) {
      response.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end()
      return
    }
    let start = match[1] ? Number(match[1]) : Math.max(0, stat.size - Number(match[2]))
    let end = match[2] && match[1] ? Math.min(Number(match[2]), stat.size - 1) : stat.size - 1
    if (!match[1]) start = Math.max(0, stat.size - Number(match[2]))
    if (start >= stat.size || start > end) {
      response.writeHead(416, { 'Content-Range': `bytes */${stat.size}` }).end()
      return
    }
    response.writeHead(206, {
      'Accept-Ranges': 'bytes',
      'Content-Length': end - start + 1,
      'Content-Range': `bytes ${start}-${end}/${stat.size}`,
      'Content-Type': contentType
    })
    if (request.method === 'HEAD') return response.end()
    createReadStream(filePath, { start, end }).pipe(response)
    return
  }

  response.writeHead(200, {
    'Accept-Ranges': contentType === 'video/mp4' ? 'bytes' : 'none',
    'Content-Length': stat.size,
    'Content-Type': contentType,
    'X-Content-Type-Options': 'nosniff'
  })
  if (request.method === 'HEAD') return response.end()
  createReadStream(filePath).pipe(response)
}

async function start() {
  await bootstrapAdmin()
  const vite = production ? null : await (await import('vite')).createServer({
    appType: 'spa',
    server: { middlewareMode: true }
  })
  const server = createHttpServer(async (request, response) => {
    try {
      const pathname = new URL(request.url, 'http://localhost').pathname
      if (pathname.startsWith('/api/')) {
        if (pathname.startsWith('/api/auth/')) {
          await handleAuth(request, response, pathname)
        } else {
          await handleOrders(request, response, pathname)
        }
        return
      }
      if (request.method !== 'GET' && request.method !== 'HEAD') {
        response.writeHead(405, { Allow: 'GET, HEAD' }).end('Method not allowed')
        return
      }
      if (vite) {
        vite.middlewares(request, response, (error) => {
          if (error) {
            console.error('Vite request failed:', error)
            if (!response.headersSent) response.writeHead(500).end('Internal server error')
          }
        })
      } else {
        serveStatic(request, response)
      }
    } catch (error) {
      if (error.status) {
        sendJson(response, error.status, { error: error.message })
        return
      }
      console.error('Request failed:', error)
      if (!response.headersSent) sendJson(response, 500, { error: 'An unexpected server error occurred.' })
      else response.destroy(error)
    }
  })

  server.listen(port, host, () => {
    console.log(`Grounded Brew Café listening on http://${host}:${port}${production ? '' : ' (development)'}`)
    console.log(`Accounts database: ${databasePath}`)
  })

  const shutdown = async () => {
    const closed = new Promise((resolve) => server.close(resolve))
    server.closeAllConnections()
    if (vite) await vite.close()
    await closed
    database.close()
  }
  process.once('SIGINT', shutdown)
  process.once('SIGTERM', shutdown)
}

start().catch((error) => {
  console.error('Could not start Grounded Brew Café:', error)
  process.exitCode = 1
})
