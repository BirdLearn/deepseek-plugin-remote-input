/** Host half: the LAN capture server the phone posts to, and the Harness routes the browser polls. */
import { createServer } from 'node:http'
import { randomBytes, randomUUID } from 'node:crypto'
import { networkInterfaces } from 'node:os'
import QRCode from 'qrcode'
import { Config } from './config.js'
import { mobilePage } from './mobile-page.js'

export { Config }

/** Required service keys. */
export const inject = ['webServer']

/** Image media types the capture server accepts. */
const IMAGE_TYPES = new Set(['image/png', 'image/jpeg', 'image/webp', 'image/gif'])

/**
 * Every non-internal IPv4 address of this machine, in interface order.
 * @returns the reachable LAN addresses.
 */
function lanAddresses() {
  const found = []
  for (const entries of Object.values(networkInterfaces())) {
    for (const entry of entries ?? []) {
      if (entry.family !== 'IPv4' && entry.family !== 4) continue
      if (entry.internal) continue
      found.push(entry.address)
    }
  }
  return found
}

/**
 * Keep a submitted file name free of path separators and control characters.
 * @param name - name the phone sent.
 * @returns a safe display name.
 */
function safeName(name) {
  if (typeof name !== 'string') return 'photo.jpg'
  const cleaned = [...name]
    .filter((character) => character.charCodeAt(0) > 31 && character !== '/' && character !== '\\')
    .join('')
    .trim()
  return cleaned === '' ? 'photo.jpg' : cleaned.slice(0, 120)
}

/**
 * Write one JSON response.
 * @param res - response to write.
 * @param status - HTTP status code.
 * @param body - JSON-serializable payload.
 */
function sendJson(res, status, body) {
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8' })
  res.end(JSON.stringify(body))
}

/**
 * Read a JSON request body under a byte budget.
 * @param req - incoming request.
 * @param limit - largest accepted body in bytes.
 * @returns the parsed body.
 */
async function readJson(req, limit) {
  const chunks = []
  let total = 0
  for await (const chunk of req) {
    total += chunk.length
    if (total > limit) throw new Error('payload too large')
    chunks.push(chunk)
  }
  return JSON.parse(Buffer.concat(chunks).toString('utf8'))
}

/**
 * Start the capture server and expose its state to the browser half.
 * @param ctx - Host context.
 * @param config - validated plugin configuration.
 */
export function apply(ctx, config) {
  const token = randomBytes(12).toString('hex')
  const queue = []
  let urls = []
  let primary = ''
  let listeningPort = config.port

  const composeUrls = (port) => {
    const hosts = lanAddresses()
    const list = hosts.length > 0 ? hosts : ['127.0.0.1']
    urls = list.map((host) => `http://${host}:${port}/?k=${token}`)
    primary = urls[0] ?? ''
  }

  const toItem = (body) => {
    const text = typeof body?.text === 'string' ? body.text.slice(0, config.maxTextChars) : ''
    const images = []
    for (const entry of Array.isArray(body?.images) ? body.images : []) {
      if (images.length >= config.maxImages) break
      const type = typeof entry?.type === 'string' ? entry.type : ''
      const data = typeof entry?.data === 'string' ? entry.data : ''
      if (!IMAGE_TYPES.has(type) || data === '') continue
      images.push({ name: safeName(entry?.name), type, data })
    }
    if (text.trim() === '' && images.length === 0) return undefined
    return { id: randomUUID(), text, images, receivedAt: Date.now() }
  }

  const handleCapture = async (req, res) => {
    const url = new URL(req.url ?? '/', 'http://phone.local')
    if (url.searchParams.get('k') !== token) {
      res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' })
      res.end('forbidden')
      return
    }
    if (req.method === 'GET' && url.pathname === '/') {
      res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
      res.end(mobilePage())
      return
    }
    if (req.method === 'GET' && url.pathname === '/status') {
      sendJson(res, 200, { ok: true, pending: queue.length })
      return
    }
    if (req.method === 'POST' && url.pathname === '/submit') {
      let body
      try {
        body = await readJson(req, config.maxUploadBytes)
      } catch (error) {
        sendJson(res, 400, { ok: false, error: error instanceof Error ? error.message : 'invalid payload' })
        return
      }
      const item = toItem(body)
      if (item === undefined) {
        sendJson(res, 400, { ok: false, error: 'empty submission' })
        return
      }
      queue.push(item)
      ctx.logger.info('remote-input: received %s image(s), %s character(s)', item.images.length, item.text.length)
      sendJson(res, 200, { ok: true, id: item.id, pending: queue.length })
      return
    }
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
    res.end('not found')
  }

  ctx.effect(() => {
    const server = createServer((req, res) => {
      handleCapture(req, res).catch((error) => {
        ctx.logger.warn('remote-input: request failed: %s', error instanceof Error ? error.message : String(error))
        if (!res.headersSent) sendJson(res, 500, { ok: false, error: 'capture failed' })
      })
    })
    server.on('error', (error) => {
      ctx.logger.error('remote-input: capture server error: %s', error.message)
    })
    server.listen(config.port, config.host, () => {
      const address = server.address()
      const port = typeof address === 'object' && address !== null ? address.port : config.port
      listeningPort = port
      composeUrls(port)
      ctx.logger.info('remote-input: capture server listening on %s', primary)
    })
    return () => {
      // Keep-alive sockets would otherwise hold the listener open past disposal.
      server.closeAllConnections()
      server.close()
    }
  }, 'remote-input: capture server')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/scan/config',
    handler: (req, res) => {
      sendJson(res, 200, { urls, primary, port: listeningPort, pending: queue.length })
    },
  }), 'remote-input: config route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/scan/claim',
    handler: (req, res) => {
      const items = queue.splice(0, config.maxImages)
      sendJson(res, 200, { items })
    },
  }), 'remote-input: claim route')

  ctx.effect(() => ctx.webServer.register({
    kind: 'exact',
    path: '/scan/qr.svg',
    handler: async (req, res) => {
      if (primary === '') {
        res.writeHead(503, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('capture server not ready')
        return
      }
      try {
        const svg = await QRCode.toString(primary, { type: 'svg', margin: 1, width: 240 })
        res.writeHead(200, { 'content-type': 'image/svg+xml; charset=utf-8', 'cache-control': 'no-store' })
        res.end(svg)
      } catch (error) {
        ctx.logger.warn('remote-input: qr render failed: %s', error instanceof Error ? error.message : String(error))
        res.writeHead(500, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('qr failed')
      }
    },
  }), 'remote-input: qr route')
}
