/** Host-half behaviour: the capture server, the queue, and the Harness routes. */
import test from 'node:test'
import assert from 'node:assert/strict'
import QRCode from 'qrcode'
import { apply, Config } from '../index.js'

/**
 * A Host context that records the routes a plugin registers.
 * @returns the fake context, its route table, and the effect disposers.
 */
function createHost() {
  const routes = new Map()
  const disposers = []
  const ctx = {
    logger: { info: () => {}, warn: () => {}, error: () => {} },
    effect: (fn) => {
      const disposer = fn()
      if (typeof disposer === 'function') disposers.push(disposer)
      return disposer
    },
    webServer: {
      register: (route) => {
        routes.set(route.path, route)
        return () => routes.delete(route.path)
      },
    },
  }
  return { ctx, routes, disposers }
}

/**
 * Invoke one registered route and collect its response.
 * @param {object} route - the registered route.
 * @param {object} options - request method and URL.
 * @returns the response status, headers, and body.
 */
function callRoute(route, { method = 'GET', url = '/' } = {}) {
  return new Promise((resolve, reject) => {
    const chunks = []
    const response = {
      statusCode: 200,
      headers: {},
      writeHead(status, headers) {
        this.statusCode = status
        this.headers = headers ?? {}
      },
      write(chunk) {
        chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
      },
      end(chunk) {
        if (chunk !== undefined) chunks.push(typeof chunk === 'string' ? Buffer.from(chunk) : chunk)
        resolve({ status: this.statusCode, headers: this.headers, body: Buffer.concat(chunks).toString('utf8') })
      },
    }
    try {
      const result = route.handler({ method, url, headers: {} }, response)
      if (result instanceof Promise) result.catch(reject)
    } catch (error) {
      reject(error)
    }
  })
}

/**
 * Start the plugin and wait until its capture server is listening.
 * @returns the fake host, the capture base URL, and the capture token.
 */
async function startHost() {
  const host = createHost()
  apply(host.ctx, Config({ port: 0 }))
  let config = null
  for (let attempt = 0; attempt < 50; attempt += 1) {
    await new Promise((resolve) => setTimeout(resolve, 20))
    config = JSON.parse((await callRoute(host.routes.get('/scan/config'))).body)
    if (config.primary !== '') break
  }
  assert.ok(config?.primary, 'the capture server reports its address')
  const token = new URL(config.primary).searchParams.get('k')
  const base = `http://127.0.0.1:${config.port}`
  return { host, config, token, base }
}

test('the config route reports the capture address, port, and queue depth', async () => {
  const { host, config } = await startHost()
  assert.match(config.primary, /^http:\/\/[^:]+:\d+\/\?k=[0-9a-f]{24}$/)
  assert.ok(Array.isArray(config.urls) && config.urls.length > 0)
  assert.equal(config.pending, 0)
  host.disposers.forEach((dispose) => dispose())
})

test('the capture page is served for the scanned address and refused otherwise', async () => {
  const { host, token, base } = await startHost()
  const page = await fetch(`${base}/?k=${token}`)
  assert.equal(page.status, 200)
  assert.match(page.headers.get('content-type') ?? '', /text\/html/)
  const body = await page.text()
  assert.match(body, /投送到电脑/)
  assert.match(body, /capture="environment"/)

  const refused = await fetch(`${base}/?k=wrong-token`)
  assert.equal(refused.status, 403)
  const anonymous = await fetch(base)
  assert.equal(anonymous.status, 403)
  host.disposers.forEach((dispose) => dispose())
})

test('a submission is queued once and claimed exclusively', async () => {
  const { host, token, base } = await startHost()
  const submission = await fetch(`${base}/submit?k=${token}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      text: '来自手机的文字',
      images: [{ name: 'photo.jpg', type: 'image/jpeg', data: Buffer.from('bytes').toString('base64') }],
    }),
  })
  assert.equal(submission.status, 200)
  assert.equal((await submission.json()).ok, true)

  const claim = JSON.parse((await callRoute(host.routes.get('/scan/claim'))).body)
  assert.equal(claim.items.length, 1)
  assert.equal(claim.items[0].text, '来自手机的文字')
  assert.equal(claim.items[0].images.length, 1)
  assert.equal(claim.items[0].images[0].type, 'image/jpeg')

  const second = JSON.parse((await callRoute(host.routes.get('/scan/claim'))).body)
  assert.deepEqual(second.items, [])
  host.disposers.forEach((dispose) => dispose())
})

test('empty submissions and unsupported image types are refused', async () => {
  const { host, token, base } = await startHost()
  const empty = await fetch(`${base}/submit?k=${token}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: '   ' }),
  })
  assert.equal(empty.status, 400)

  // An unsupported image type is dropped, and the text alone still arrives.
  const wrongType = await fetch(`${base}/submit?k=${token}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ text: 'ok', images: [{ name: 'a.svg', type: 'image/svg+xml', data: 'AA==' }] }),
  })
  assert.equal(wrongType.status, 200)
  const claim = JSON.parse((await callRoute(host.routes.get('/scan/claim'))).body)
  assert.equal(claim.items.length, 1)
  assert.deepEqual(claim.items[0].images, [])
  host.disposers.forEach((dispose) => dispose())
})

test('the QR route renders the capture address as SVG', async () => {
  const { host, config } = await startHost()
  const qr = await callRoute(host.routes.get('/scan/qr.svg'))
  assert.equal(qr.status, 200)
  assert.match(qr.headers['content-type'] ?? '', /image\/svg\+xml/)
  assert.match(qr.body, /^<svg/)
  // The rendered code is the QR encoding of the capture address itself.
  const expected = await QRCode.toString(config.primary, { type: 'svg', margin: 1, width: 240 })
  assert.equal(qr.body, expected)
  host.disposers.forEach((dispose) => dispose())
})

test('disposal closes the capture server', async () => {
  const { host, base } = await startHost()
  host.disposers.forEach((dispose) => dispose())
  await assert.rejects(fetch(`${base}/status?k=anything`))
})
