/** Client half: the composer trigger and the capture panel that shows the QR code. */
window.__ModuleLoader__.load({
  id: 'dsh-remote-input',
  factory(require) {
    const React = require('react')
    const h = React.createElement

    /**
     * A minimal observable snapshot store: the panel state the trigger and
     * the overlay share.
     * @param {object} initial - initial snapshot.
     * @returns the store handle.
     */
    function createStore(initial) {
      let snapshot = initial
      const listeners = new Set()
      return {
        getSnapshot: () => snapshot,
        subscribe: (listener) => {
          listeners.add(listener)
          return () => { listeners.delete(listener) }
        },
        update: (mutator) => {
          const draft = { ...snapshot }
          mutator(draft)
          snapshot = draft
          for (const listener of [...listeners]) listener()
        },
      }
    }

    /** English copy of the capture panel. */
    const EN = {
      open: 'Phone capture',
      title: 'Send from your phone',
      hint: 'Scan the code with your phone, type text or take a photo, and it lands in this composer.',
      close: 'Close',
      qrAlt: 'QR code of the capture address',
      qrMissing: 'The capture server is not reachable.',
      waiting: 'Waiting for the composer',
      queued: 'Waiting on the server',
      received: 'Received',
      copy: 'Copy address',
      copied: 'Copied',
    }
    /** Chinese copy of the capture panel. */
    const ZH = {
      open: '手机投送',
      title: '从手机发送到电脑',
      hint: '用手机扫描二维码，输入文字或拍照，内容会直接进入这个输入框。',
      close: '关闭',
      qrAlt: '投送地址的二维码',
      qrMissing: '投送服务没有启动。',
      waiting: '等待输入框接收',
      queued: '服务器待取',
      received: '已接收',
      copy: '复制地址',
      copied: '已复制',
    }

    const CSS = `
.pc-trigger { position: relative; display: inline-flex; align-items: center; justify-content: center;
  width: 26px; height: 26px; padding: 0; border: none; border-radius: 8px; background: transparent;
  color: var(--dsw-alias-label-tertiary); cursor: pointer; }
.pc-trigger:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-secondary); }
.pc-badge { position: absolute; top: -3px; right: -4px; min-width: 14px; height: 14px; padding: 0 3px;
  border-radius: 7px; background: var(--dsw-alias-brand-primary); color: var(--dsw-alias-bg-base);
  font-size: 9px; line-height: 14px; text-align: center; pointer-events: none; }
.pc-backdrop { position: absolute; inset: 0; z-index: 30; display: flex; align-items: center;
  justify-content: center; padding: 16px; background: var(--dsw-alias-bg-mask-3); }
.pc-card { box-sizing: border-box; width: min(340px, 100%); max-height: 100%; overflow: auto; padding: 16px;
  border-radius: 14px; background: var(--dsw-specific-menu); color: var(--dsw-alias-label-primary);
  box-shadow: var(--dsw-elevation-prominent); font-size: 13px; line-height: 1.5; }
.pc-head { display: flex; align-items: center; gap: 8px; }
.pc-title { flex: 1; font-size: 14px; font-weight: 600; color: var(--dsw-alias-label-primary); }
.pc-close { width: 24px; height: 24px; padding: 0; border: none; border-radius: 8px; background: transparent;
  color: var(--dsw-alias-label-tertiary); font-size: 16px; line-height: 1; cursor: pointer; }
.pc-close:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-secondary); }
.pc-hint { margin: 8px 0 12px; color: var(--dsw-alias-label-secondary); }
.pc-qr { display: flex; justify-content: center; padding: 10px; border-radius: 12px;
  background: var(--dsw-alias-bg-layer-1); }
.pc-qr img { display: block; width: 200px; height: 200px; }
.pc-missing { padding: 24px 12px; text-align: center; color: var(--dsw-alias-label-tertiary); }
.pc-urls { margin-top: 10px; display: flex; flex-direction: column; gap: 4px; }
.pc-url { display: block; padding: 6px 8px; border-radius: 8px; background: var(--dsw-alias-bg-layer-2);
  color: var(--dsw-alias-label-secondary); font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 11px; word-break: break-all; user-select: all; }
.pc-status { margin-top: 12px; display: flex; flex-wrap: wrap; gap: 10px; color: var(--dsw-alias-label-tertiary);
  font-size: 11px; }
.pc-copy { margin-top: 10px; width: 100%; padding: 7px 10px; border: 1px solid var(--dsw-alias-border-l2);
  border-radius: 9px; background: transparent; color: var(--dsw-alias-label-secondary); font: inherit;
  font-size: 12px; cursor: pointer; }
.pc-copy:hover { background: var(--dsw-alias-interactive-bg-hover); color: var(--dsw-alias-label-primary); }
`

    /**
     * Decode one base64 image payload into bytes.
     * @param data - base64 text without a data URL prefix.
     * @returns the decoded bytes.
     */
    function decodeBase64(data) {
      const binary = atob(data)
      const bytes = new Uint8Array(binary.length)
      for (let index = 0; index < binary.length; index += 1) bytes[index] = binary.charCodeAt(index)
      return bytes
    }

    /** The trigger glyph: a QR corner set. */
    function glyph() {
      return h('svg', { width: 15, height: 15, viewBox: '0 0 16 16', 'aria-hidden': 'true' },
        h('rect', { x: 1, y: 1, width: 5, height: 5, rx: 1, fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 }),
        h('rect', { x: 10, y: 1, width: 5, height: 5, rx: 1, fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 }),
        h('rect', { x: 1, y: 10, width: 5, height: 5, rx: 1, fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 }),
        h('rect', { x: 8, y: 8, width: 2, height: 2, fill: 'currentColor' }),
        h('rect', { x: 11, y: 8, width: 2, height: 2, fill: 'currentColor' }),
        h('rect', { x: 8, y: 11, width: 2, height: 2, fill: 'currentColor' }),
        h('rect', { x: 11, y: 11, width: 4, height: 4, rx: 0.5, fill: 'none', stroke: 'currentColor', strokeWidth: 1.3 }))
    }

    /**
     * The composer trigger: one compact control that opens the capture panel.
     * @param props - slot props and the plugin's injected face.
     * @returns the trigger element.
     */
    function PhoneTrigger(props) {
      const { t, sessionId, inputActions, useInput, useSession, open, usePhoneCapture,
        createImageDrafts, releaseImageDrafts, setWaiting, setReceived } = props
      const phase = useInput((state) => state.phase)
      const draft = useInput((state) => state.draft)
      const uploadImages = useSession((state) => state.subagent === null)
      const waiting = usePhoneCapture((state) => state.waiting)
      const draftRef = React.useRef(draft)
      draftRef.current = draft
      const buffer = React.useRef([])

      const applyEntry = React.useCallback(async (entry) => {
        if (entry.kind === 'text') {
          const span = inputActions.captureInsertion()
          if (inputActions.insertText(entry.text, span)) return true
          const current = draftRef.current
          inputActions.setDraft(current === '' ? entry.text : current + '\n' + entry.text)
          return true
        }
        const files = entry.images.map((image) => new File(
          [decodeBase64(image.data)],
          image.name || 'photo.jpg',
          { type: image.type || 'image/jpeg' },
        ))
        const ids = createImageDrafts(sessionId, files, uploadImages)
        if (ids.length === 0) return false
        if (inputActions.addAttachments(ids)) return true
        releaseImageDrafts(ids)
        return false
      }, [inputActions, sessionId, uploadImages, createImageDrafts, releaseImageDrafts])

      const flush = React.useCallback(async () => {
        if (buffer.current.length === 0) return
        if (phase !== 'plain') { setWaiting(buffer.current.length); return }
        const remaining = []
        for (const entry of buffer.current) {
          const applied = await applyEntry(entry)
          if (!applied) remaining.push(entry)
        }
        buffer.current = remaining
        setWaiting(remaining.length)
      }, [phase, applyEntry, setWaiting])

      React.useEffect(() => {
        let cancelled = false
        let timer
        const poll = async () => {
          try {
            const response = await fetch('/scan/claim', { headers: { accept: 'application/json' } })
            if (!response.ok) throw new Error('claim failed')
            const body = await response.json()
            const items = Array.isArray(body?.items) ? body.items : []
            for (const item of items) {
              if (cancelled) break
              if (Array.isArray(item?.images) && item.images.length > 0) {
                buffer.current.push({ kind: 'images', images: item.images })
              }
              if (typeof item?.text === 'string' && item.text !== '') {
                buffer.current.push({ kind: 'text', text: item.text })
              }
            }
            if (!cancelled && items.length > 0) setReceived(items.length)
            if (!cancelled) await flush()
          } catch (error) {
            // The capture server may be restarting; the next tick retries.
          } finally {
            if (!cancelled) timer = setTimeout(poll, 1200)
          }
        }
        poll()
        return () => { cancelled = true; clearTimeout(timer) }
      }, [flush])

      return h('button', {
        type: 'button',
        className: 'pc-trigger',
        title: t('open'),
        'aria-label': t('open'),
        onClick: open,
      }, glyph(), waiting > 0 ? h('span', { className: 'pc-badge' }, String(waiting)) : null)
    }

    /**
     * The capture panel: the QR code, the addresses, and the queue counters.
     * @param props - slot props and the plugin's injected face.
     * @returns the panel element.
     */
    function PhoneOverlay(props) {
      const { t, close, refresh, usePhoneCapture } = props
      const view = usePhoneCapture((state) => state)
      const [qrFailed, setQrFailed] = React.useState(false)
      const [copied, setCopied] = React.useState(false)

      React.useEffect(() => {
        if (!view.open) return undefined
        refresh()
        const timer = setInterval(() => { refresh() }, 2000)
        return () => clearInterval(timer)
      }, [view.open, refresh])

      React.useEffect(() => {
        if (!view.open) return undefined
        const onKeyDown = (event) => { if (event.key === 'Escape') close() }
        document.addEventListener('keydown', onKeyDown)
        return () => document.removeEventListener('keydown', onKeyDown)
      }, [view.open, close])

      React.useEffect(() => {
        setQrFailed(false)
      }, [view.primary])

      const copy = async () => {
        if (view.primary === '') return
        try {
          await navigator.clipboard.writeText(view.primary)
          setCopied(true)
          setTimeout(() => { setCopied(false) }, 1500)
        } catch (error) {
          setCopied(false)
        }
      }

      return h(React.Fragment, null,
        h('style', null, CSS),
        view.open ? h('div', {
          className: 'pc-backdrop',
          onClick: (event) => { if (event.target === event.currentTarget) close() },
        }, h('div', { className: 'pc-card', role: 'dialog', 'aria-modal': 'true', 'aria-label': t('title') },
          h('div', { className: 'pc-head' },
            h('span', { className: 'pc-title' }, t('title')),
            h('button', { type: 'button', className: 'pc-close', 'aria-label': t('close'), onClick: close }, '×')),
          h('p', { className: 'pc-hint' }, t('hint')),
          view.primary === '' || qrFailed
            ? h('div', { className: 'pc-missing' }, t('qrMissing'))
            : h('div', { className: 'pc-qr' }, h('img', {
              src: '/scan/qr.svg',
              alt: t('qrAlt'),
              onError: () => { setQrFailed(true) },
            })),
          view.urls.length > 0 ? h('div', { className: 'pc-urls' },
            view.urls.map((url) => h('code', { key: url, className: 'pc-url' }, url))) : null,
          h('div', { className: 'pc-status' },
            h('span', null, t('queued') + ': ' + String(view.pending)),
            h('span', null, t('waiting') + ': ' + String(view.waiting)),
            h('span', null, t('received') + ': ' + String(view.received))),
          h('button', { type: 'button', className: 'pc-copy', onClick: () => { void copy() } },
            copied ? t('copied') : t('copy')))) : null)
    }

    return {
      inject: ['slots', 'locale', 'conversation'],
      /**
       * Register the capture trigger and its panel.
       * @param ctx - browser plugin context.
       */
      apply(ctx) {
        const state = createStore({
          open: false,
          urls: [],
          primary: '',
          pending: 0,
          waiting: 0,
          received: 0,
        })
        ctx.effect(() => ctx.locale.register('phoneCapture.ui', { en: EN, zh: ZH }), 'remote-input: dictionaries')

        const setWaiting = (waiting) => { state.update((draft) => { draft.waiting = waiting }) }
        const setReceived = (count) => { state.update((draft) => { draft.received += count }) }
        const open = () => { state.update((draft) => { draft.open = true }) }
        const close = () => { state.update((draft) => { draft.open = false }) }

        const refresh = async () => {
          try {
            const response = await fetch('/scan/config', { headers: { accept: 'application/json' } })
            if (!response.ok) throw new Error('config failed')
            const body = await response.json()
            state.update((draft) => {
              draft.urls = Array.isArray(body?.urls) ? body.urls : []
              draft.primary = typeof body?.primary === 'string' ? body.primary : ''
              draft.pending = typeof body?.pending === 'number' ? body.pending : 0
            })
          } catch (error) {
            state.update((draft) => {
              draft.urls = []
              draft.primary = ''
              draft.pending = 0
            })
          }
        }

        const createImageDrafts = (sessionId, files, uploadImages) => {
          const conversation = ctx.conversation
          if (typeof conversation?.createDrafts !== 'function') return []
          const drafts = conversation.createDrafts(sessionId, files, uploadImages)
          return drafts.map((draft) => draft.id)
        }

        const releaseImageDrafts = (ids) => {
          const conversation = ctx.conversation
          if (typeof conversation?.releaseDraftAttachments !== 'function') return
          conversation.releaseDraftAttachments(ids)
        }

        ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
          name: 'conversation.input.left',
          id: 'remote-input.trigger',
          order: 20,
          locale: 'phoneCapture.ui',
          inject: () => ({
            open,
            setWaiting,
            setReceived,
            createImageDrafts,
            releaseImageDrafts,
            hooks: { phoneCapture: state },
          }),
        }, PhoneTrigger))

        ctx.slots.inject('shell.overlay', () => ctx.slots.register({
          name: 'shell.overlay',
          id: 'remote-input.overlay',
          order: 20,
          locale: 'phoneCapture.ui',
          inject: () => ({ close, refresh, hooks: { phoneCapture: state } }),
        }, PhoneOverlay))
      },
    }
  },
})
