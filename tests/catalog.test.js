import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import test from 'node:test'
import { orderCatalog } from '../src/menuCatalog.js'

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')

test('server order prices and availability match every menu item', async () => {
  const source = await readFile(path.join(rootDir, 'src', 'components', 'HeroSection.jsx'), 'utf8')
  const menuSource = source.slice(source.indexOf('const menuData'), source.indexOf('const categories'))
  const menuItems = menuSource.split(/\r?\n/)
    .filter((line) => line.includes('{ id:'))
    .map((line) => {
      const id = Number(line.match(/\{\s*id:\s*(\d+)/)?.[1])
      const nameToken = line.match(/name:\s*("(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*')/)?.[1]
      const name = nameToken?.startsWith('"')
        ? JSON.parse(nameToken)
        : nameToken?.slice(1, -1).replaceAll("\\'", "'")
      const price = Number(line.match(/price:\s*([\d.]+)/)?.[1])
      return { id, name, priceCents: Math.round(price * 100), soldOut: line.includes('soldOut: true') }
    })

  assert.equal(menuItems.length, orderCatalog.size)
  for (const item of menuItems) {
    assert.ok(Number.isSafeInteger(item.id), `Menu item ${item.name} has an id`)
    assert.ok(item.name, `Menu item ${item.id} has a name`)
    assert.ok(Number.isSafeInteger(item.priceCents), `Menu item ${item.name} has a valid price`)
    assert.deepEqual(orderCatalog.get(item.id), {
      name: item.name,
      priceCents: item.priceCents,
      ...(item.soldOut ? { soldOut: true } : {})
    }, `Server catalog matches ${item.name}`)
  }
})
