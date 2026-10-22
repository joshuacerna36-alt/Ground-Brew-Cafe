import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer as createNetServer } from 'node:net'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

async function reservePort() {
  const server = createNetServer()
  server.listen(0, '127.0.0.1')
  await once(server, 'listening')
  const { port } = server.address()
  await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
  return port
}

async function waitForServer(child, baseUrl) {
  const deadline = Date.now() + 20000
  while (Date.now() < deadline) {
    if (child.exitCode !== null) throw new Error('Order server exited before becoming ready.')
    try {
      const response = await fetch(`${baseUrl}/api/config`)
      if (response.ok) return
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error('Order server did not become ready in time.')
}

async function stopServer(child) {
  if (child.exitCode !== null || child.signalCode !== null) return
  const exited = once(child, 'exit')
  child.kill('SIGTERM')
  const result = await Promise.race([
    exited.then(() => 'exited'),
    new Promise((resolve) => setTimeout(() => resolve('timeout'), 5000))
  ])
  if (result === 'timeout' && child.exitCode === null && child.signalCode === null) {
    child.kill('SIGKILL')
    await exited
  }
}

function nextScheduleSlot() {
  const now = Date.now() + 30 * 60 * 1000
  const firstSlot = Math.ceil(now / (30 * 60 * 1000)) * 30 * 60 * 1000
  for (let offset = 0; offset <= 14 * 24 * 2; offset += 1) {
    const timestamp = firstSlot + offset * 30 * 60 * 1000
    const parts = Object.fromEntries(new Intl.DateTimeFormat('en-GB', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date(timestamp))
      .filter((part) => part.type !== 'literal')
      .map(({ type, value }) => [type, Number(value)]))
    if (parts.hour >= 9 && (parts.hour < 20 || (parts.hour === 20 && parts.minute <= 30)) && parts.second === 0) {
      return new Date(timestamp).toISOString()
    }
  }
  throw new Error('Could not find a valid order time for the integration test.')
}

test('scheduled orders, admin access, and staff order updates work', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'grounded-brew-orders-'))
  const databasePath = path.join(directory, 'accounts.sqlite')
  let child
  let baseUrl
  try {
    const port = await reservePort()
    baseUrl = `http://127.0.0.1:${port}`
    child = spawn(process.execPath, ['server.js', '--host', '127.0.0.1', '--port', String(port)], {
      cwd: rootDir,
      env: {
        ...process.env,
        NODE_ENV: 'test',
        DATABASE_PATH: databasePath,
        ADMIN_EMAIL: 'admin@example.test',
        ADMIN_PASSWORD: 'test-admin-pass-123',
        ADMIN_NAME: 'Test Administrator',
        GCASH_NAME: 'Test Café',
        GCASH_NUMBER: '09170000000',
        TEST_EMAIL_TRANSPORT: ''
      },
      stdio: 'ignore'
    })
    await waitForServer(child, baseUrl)

    const configResponse = await fetch(`${baseUrl}/api/config`)
    const config = await configResponse.json()
    assert.equal(configResponse.status, 200)
    assert.equal(config.store.timeZone, 'Asia/Manila')
    assert.equal(config.delivery.includedKm, 5)
    assert.equal(config.delivery.baseFeeCents, 10000)
    assert.equal(config.delivery.perKmCents, 10000)
    assert.equal(config.delivery.enabled, false)
    assert.equal(config.paypalEnabled, false)
    assert.equal(Object.hasOwn(config, 'emailVerificationEnabled'), false)
    assert.deepEqual(config.paymentMethods.map((method) => method.id), ['cash'])
    assert.match(config.onlinePaymentMessage, /exact order amount/)

    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Order Customer', email: 'customer@example.test', password: 'customer-pass-123' })
    })
    assert.equal(registerResponse.status, 201)
    const registration = await registerResponse.json()
    assert.equal(registration.user.email, 'customer@example.test')
    const customerLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'customer@example.test', password: 'customer-pass-123' })
    })
    assert.equal(customerLoginResponse.status, 200)
    const customerCookie = customerLoginResponse.headers.get('set-cookie').split(';')[0]
    const customer = await customerLoginResponse.json()
    assert.equal(customer.user.role, 'customer')
    const customerHeaders = { 'Content-Type': 'application/json', Cookie: customerCookie }

    const unauthenticated = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    })
    assert.equal(unauthenticated.status, 401)

    const unavailableQuote = await fetch(`${baseUrl}/api/delivery/quote`, {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({ address: '123 Example Street, Manila' })
    })
    assert.equal(unavailableQuote.status, 503)

    const scheduleResponse = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({
        items: [{ id: 103, quantity: 2, price: 1 }],
        fulfillment: 'pickup',
        scheduledAt: nextScheduleSlot(),
        contactPhone: '+639171234567',
        paymentMethod: 'cash'
      })
    })
    assert.equal(scheduleResponse.status, 201)
    const placed = await scheduleResponse.json()
    assert.equal(placed.order.items[0].unitPriceCents, 22000)
    assert.equal(placed.order.subtotalCents, 44000)
    assert.equal(placed.order.totalCents, 44000)
    assert.equal(placed.order.paymentMethod, 'cash')
    assert.equal(placed.order.paymentStatus, 'unpaid')
    assert.equal(placed.order.status, 'received')

    const customerOrdersResponse = await fetch(`${baseUrl}/api/orders`, { headers: { Cookie: customerCookie } })
    const customerOrders = await customerOrdersResponse.json()
    assert.equal(customerOrders.orders.length, 1)
    assert.equal(customerOrders.orders[0].id, placed.order.id)

    const soldOutResponse = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({
        items: [{ id: 101, quantity: 1 }],
        fulfillment: 'pickup',
        scheduledAt: nextScheduleSlot(),
        contactPhone: '+639171234567',
        paymentMethod: 'cash'
      })
    })
    assert.equal(soldOutResponse.status, 400)
    await soldOutResponse.json()

    const unverifiedGcashOrder = await fetch(`${baseUrl}/api/orders`, {
      method: 'POST',
      headers: customerHeaders,
      body: JSON.stringify({
        items: [{ id: 103, quantity: 1 }],
        fulfillment: 'pickup',
        scheduledAt: nextScheduleSlot(),
        contactPhone: '+639171234567',
        paymentMethod: 'gcash'
      })
    })
    assert.equal(unverifiedGcashOrder.status, 400)
    await unverifiedGcashOrder.json()

    const adminLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'admin@example.test', password: 'test-admin-pass-123' })
    })
    assert.equal(adminLoginResponse.status, 200)
    const administrator = await adminLoginResponse.json()
    assert.equal(administrator.user.role, 'admin')
    const adminCookie = adminLoginResponse.headers.get('set-cookie').split(';')[0]
    const adminHeaders = { 'Content-Type': 'application/json', Cookie: adminCookie }
    const protectedAdminDelete = await fetch(`${baseUrl}/api/staff/users/${administrator.user.id}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie }
    })
    assert.equal(protectedAdminDelete.status, 403)
    await protectedAdminDelete.json()

    const staffOrdersResponse = await fetch(`${baseUrl}/api/staff/orders`, { headers: { Cookie: adminCookie } })
    const staffOrders = await staffOrdersResponse.json()
    assert.equal(staffOrdersResponse.status, 200)
    assert.equal(staffOrders.orders.length, 1)
    assert.equal(staffOrders.orders[0].customerEmail, 'customer@example.test')

    const invalidTransition = await fetch(`${baseUrl}/api/staff/orders/${placed.order.id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'completed' })
    })
    assert.equal(invalidTransition.status, 409)
    await invalidTransition.json()

    const confirmResponse = await fetch(`${baseUrl}/api/staff/orders/${placed.order.id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'confirmed' })
    })
    assert.equal(confirmResponse.status, 200)
    assert.equal((await confirmResponse.json()).order.status, 'confirmed')

    const prepareResponse = await fetch(`${baseUrl}/api/staff/orders/${placed.order.id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'preparing' })
    })
    assert.equal(prepareResponse.status, 200)

    const wrongFulfillmentStatus = await fetch(`${baseUrl}/api/staff/orders/${placed.order.id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'out_for_delivery' })
    })
    assert.equal(wrongFulfillmentStatus.status, 409)
    await wrongFulfillmentStatus.json()

    const readyResponse = await fetch(`${baseUrl}/api/staff/orders/${placed.order.id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'ready' })
    })
    assert.equal(readyResponse.status, 200)
    assert.equal((await readyResponse.json()).order.status, 'ready')

    const completeResponse = await fetch(`${baseUrl}/api/staff/orders/${placed.order.id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ status: 'completed', paymentStatus: 'paid' })
    })
    assert.equal(completeResponse.status, 200)
    const completedOrder = (await completeResponse.json()).order
    assert.equal(completedOrder.status, 'completed')
    assert.equal(completedOrder.paymentStatus, 'paid')

    const promoteResponse = await fetch(`${baseUrl}/api/staff/users/${customer.user.id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ role: 'staff' })
    })
    assert.equal(promoteResponse.status, 200)
    assert.equal((await promoteResponse.json()).user.role, 'staff')

    const staffSessionResponse = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: customerCookie } })
    assert.equal((await staffSessionResponse.json()).user.role, 'staff')
    const staffCannotManageUsers = await fetch(`${baseUrl}/api/staff/users`, { headers: { Cookie: customerCookie } })
    assert.equal(staffCannotManageUsers.status, 403)
    const staffCannotDeactivateAccount = await fetch(`${baseUrl}/api/staff/users/${customer.user.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Cookie: customerCookie },
      body: JSON.stringify({ active: false })
    })
    assert.equal(staffCannotDeactivateAccount.status, 403)
    await staffCannotDeactivateAccount.json()

    const deactivateResponse = await fetch(`${baseUrl}/api/staff/users/${customer.user.id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ active: false })
    })
    assert.equal(deactivateResponse.status, 200)
    assert.equal((await deactivateResponse.json()).user.account_status, 'deactivated')
    const deactivatedSession = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: customerCookie } })
    assert.equal((await deactivatedSession.json()).user, null)
    const deactivatedLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: customer.user.email, password: 'customer-pass-123' })
    })
    assert.equal(deactivatedLogin.status, 403)

    const reactivateResponse = await fetch(`${baseUrl}/api/staff/users/${customer.user.id}`, {
      method: 'PATCH',
      headers: adminHeaders,
      body: JSON.stringify({ active: true })
    })
    assert.equal(reactivateResponse.status, 200)
    assert.equal((await reactivateResponse.json()).user.account_status, 'active')

    const deleteResponse = await fetch(`${baseUrl}/api/staff/users/${customer.user.id}`, {
      method: 'DELETE',
      headers: { Cookie: adminCookie }
    })
    assert.equal(deleteResponse.status, 200)
    assert.equal((await deleteResponse.json()).ok, true)
    const deletedAccountLogin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: customer.user.email, password: 'customer-pass-123' })
    })
    assert.equal(deletedAccountLogin.status, 401)
    const staffOrdersAfterDeletion = await fetch(`${baseUrl}/api/staff/orders`, { headers: { Cookie: adminCookie } })
    const retainedOrder = (await staffOrdersAfterDeletion.json()).orders.find((order) => order.id === placed.order.id)
    assert.equal(retainedOrder.customerName, 'Deleted account')
    assert.equal(retainedOrder.customerEmail, '')
    assert.equal(retainedOrder.contactPhone, '')
    const remainingAccounts = await fetch(`${baseUrl}/api/staff/users`, { headers: { Cookie: adminCookie } })
    assert.equal((await remainingAccounts.json()).users.some((account) => account.id === customer.user.id), false)

    const crossOriginUpdate = await fetch(`${baseUrl}/api/staff/orders/${placed.order.id}`, {
      method: 'PATCH',
      headers: { ...adminHeaders, Origin: 'https://not-the-site.example' },
      body: JSON.stringify({ status: 'preparing' })
    })
    assert.equal(crossOriginUpdate.status, 403)
    await crossOriginUpdate.json()
  } finally {
    if (child) await stopServer(child)
    await rm(directory, { recursive: true, force: true })
  }
})
