import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import { once } from 'node:events'
import { createServer as createNetServer } from 'node:net'
import { DatabaseSync } from 'node:sqlite'
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
    if (child.exitCode !== null) throw new Error('Auth server exited before becoming ready.')
    try {
      const response = await fetch(`${baseUrl}/api/auth/me`)
      if (response.ok) {
        await response.json()
        return
      }
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 200))
  }
  throw new Error('Auth server did not become ready in time.')
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

test('registration without email delivery, login, logout, and database-backed sessions work', async () => {
  const directory = await mkdtemp(path.join(tmpdir(), 'grounded-brew-auth-'))
  const databasePath = path.join(directory, 'accounts.sqlite')
  let child
  let port
  let baseUrl
  const startServer = async () => {
    port = await reservePort()
    baseUrl = `http://127.0.0.1:${port}`
    child = spawn(process.execPath, ['server.js', '--host', '127.0.0.1', '--port', String(port)], {
      cwd: rootDir,
      env: {
        ...process.env,
        DATABASE_PATH: databasePath,
        NODE_ENV: 'test'
      },
      stdio: 'ignore'
    })
    await waitForServer(child, baseUrl)
  }

  try {
    await startServer()
    const registerResponse = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Customer', email: 'Test@example.invalid', password: 'secure-pass-123' })
    })
    assert.equal(registerResponse.status, 201)
    const registration = await registerResponse.json()
    assert.equal(registration.user.email, 'test@example.invalid')
    const registrationCookie = registerResponse.headers.get('set-cookie')
    assert.match(registrationCookie, /HttpOnly/)
    assert.match(registrationCookie, /SameSite=Strict/)
    const registeredSession = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: registrationCookie.split(';')[0] } })
    assert.equal((await registeredSession.json()).user.email, 'test@example.invalid')
    const database = new DatabaseSync(databasePath)
    const storedCredentials = database.prepare('SELECT password_hash, password_salt, email_verified, account_status FROM users WHERE email = ?').get('test@example.invalid')
    assert.ok(storedCredentials.password_hash.length > 40)
    assert.notEqual(storedCredentials.password_hash, 'secure-pass-123')
    assert.equal(storedCredentials.email_verified, 1)
    assert.equal(storedCredentials.account_status, 'active')
    database.close()

    const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.invalid', password: 'secure-pass-123' })
    })
    assert.equal(loginResponse.status, 200)
    const initialCookie = loginResponse.headers.get('set-cookie')
    assert.match(initialCookie, /HttpOnly/)
    assert.match(initialCookie, /SameSite=Strict/)
    const initialSession = initialCookie.split(';')[0]
    const signedIn = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: initialSession } })
    assert.equal((await signedIn.json()).user.email, 'test@example.invalid')

    const duplicate = await fetch(`${baseUrl}/api/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: 'Test Customer', email: 'test@example.invalid', password: 'secure-pass-123' })
    })
    assert.equal(duplicate.status, 409)
    await duplicate.json()

    const wrongPassword = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.invalid', password: 'incorrect-pass' })
    })
    assert.equal(wrongPassword.status, 401)
    await wrongPassword.json()

    const crossOrigin = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Origin: 'https://not-the-site.example' },
      body: JSON.stringify({ email: 'test@example.invalid', password: 'secure-pass-123' })
    })
    assert.equal(crossOrigin.status, 403)
    await crossOrigin.json()

    const logout = await fetch(`${baseUrl}/api/auth/logout`, {
      method: 'POST',
      headers: { Cookie: initialSession }
    })
    assert.equal(logout.status, 200)
    await logout.json()
    assert.equal((await (await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: initialSession } })).json()).user, null)

    const persistentLoginResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: 'test@example.invalid', password: 'secure-pass-123' })
    })
    assert.equal(persistentLoginResponse.status, 200)
    const persistentCookie = persistentLoginResponse.headers.get('set-cookie').split(';')[0]
    await stopServer(child)
    await startServer()

    const persistedSession = await fetch(`${baseUrl}/api/auth/me`, { headers: { Cookie: persistentCookie } })
    assert.equal((await persistedSession.json()).user.email, 'test@example.invalid')
  } finally {
    if (child) await stopServer(child)
    await rm(directory, { recursive: true, force: true })
  }
})
