/** Client-half behaviour: the lazy module contract, the slot registrations, and the rendered panel. */
import test from 'node:test'
import assert from 'node:assert/strict'
import { createRequire } from 'node:module'
import { pathToFileURL } from 'node:url'

const require = createRequire(import.meta.url)
const React = require('react')
const { renderToString } = require('react-dom/server')
const h = React.createElement

/**
 * Load the browser module the way the Harness does. The module is evaluated
 * once: the ESM loader caches it, so the capture happens at import time.
 * @returns the captured module specifier and the plugin object.
 */
async function loadPlugin() {
  if (specifier === undefined) {
    globalThis.window = { __ModuleLoader__: { load: (spec) => { specifier = spec } } }
    const url = pathToFileURL(new URL('../client.js', import.meta.url).pathname).href
    await import(url)
  }
  return { specifier, plugin: specifier.factory(() => React) }
}

/** The module specifier captured while the client module evaluated. */
let specifier

/**
 * Apply the plugin to a fake browser context and collect its registrations.
 * @param {object} plugin - the loaded plugin object.
 * @returns the registered slot entries.
 */
function register(plugin) {
  const registrations = []
  const ctx = {
    slots: {
      inject: (_name, fn) => { fn() },
      register: (options, Component) => {
        registrations.push({ options, Component })
        return () => {}
      },
    },
    locale: { register: () => () => {}, bind: () => (key) => key },
    conversation: { createDrafts: () => [], releaseDraftAttachments: () => {} },
    effect: (fn) => fn(),
  }
  plugin.apply(ctx)
  return registrations
}

/** Stub props shared by the two entries. */
function props(overrides) {
  const state = {
    open: true,
    urls: ['http://192.168.5.17:8765/?k=abc123'],
    primary: 'http://192.168.5.17:8765/?k=abc123',
    pending: 2,
    waiting: 1,
    received: 3,
  }
  return {
    t: (key) => key,
    sessionId: 'session-1',
    inputActions: {
      captureInsertion: () => ({ start: 0, end: 0, draftRev: 0 }),
      insertText: () => true,
      setDraft: () => {},
      addAttachments: () => true,
    },
    useInput: (selector) => selector({ phase: 'plain', draft: '' }),
    useSession: (selector) => selector({ subagent: null }),
    usePhoneCapture: (selector) => selector(state),
    open: () => {},
    close: () => {},
    refresh: () => {},
    setWaiting: () => {},
    setReceived: () => {},
    createImageDrafts: () => [],
    releaseImageDrafts: () => {},
    ...overrides,
  }
}

test('the module registers under the package name and waits for its services', async () => {
  const { specifier, plugin } = await loadPlugin()
  assert.equal(specifier.id, 'dsh-remote-input')
  assert.deepEqual(plugin.inject, ['slots', 'locale', 'conversation'])
})

test('the plugin registers a composer trigger and a frame overlay', async () => {
  const { plugin } = await loadPlugin()
  const registrations = register(plugin)
  const ids = registrations.map((entry) => entry.options.id)
  assert.deepEqual(ids, ['remote-input.trigger', 'remote-input.overlay'])
  assert.equal(registrations[0].options.name, 'conversation.input.left')
  assert.equal(registrations[1].options.name, 'shell.overlay')
})

test('the trigger renders a compact QR control with the waiting badge', async () => {
  const { plugin } = await loadPlugin()
  const trigger = register(plugin).find((entry) => entry.options.id === 'remote-input.trigger').Component
  const html = renderToString(h(trigger, props()))
  assert.match(html, /class="pc-trigger"/)
  assert.match(html, /aria-label="open"/)
  assert.match(html, /pc-badge/)
})

test('the panel renders the QR code, the address, and the counters', async () => {
  const { plugin } = await loadPlugin()
  const overlay = register(plugin).find((entry) => entry.options.id === 'remote-input.overlay').Component
  const html = renderToString(h(overlay, props()))
  assert.match(html, /class="pc-backdrop"/)
  assert.match(html, /src="\/scan\/qr\.svg"/)
  assert.match(html, /http:\/\/192\.168\.5\.17:8765\/\?k=abc123/)
  assert.match(html, /queued: 2/)
  assert.match(html, /waiting: 1/)
  assert.match(html, /received: 3/)
})

test('the closed panel renders no dialog', async () => {
  const { plugin } = await loadPlugin()
  const overlay = register(plugin).find((entry) => entry.options.id === 'remote-input.overlay').Component
  const closed = props({ usePhoneCapture: (selector) => selector({ ...props().usePhoneCapture((state) => state), open: false }) })
  const html = renderToString(h(overlay, closed))
  assert.doesNotMatch(html, /class="pc-backdrop"/)
})
