# dsh-remote-input

[English](README.md) | [中文](README.zh-CN.md)

**Send text and photos from your phone straight into the DeepSeek Harness composer.**

Type on your phone, snap a photo with the phone camera, and it lands in the
message box on your computer — no cable, no cloud, no app to install. The
plugin shows a QR code in the Harness composer; scan it with the phone and the
phone becomes a second keyboard for the agent.

Built as an out-of-tree [DeepSeek Harness](https://github.com/deepseek-ai/deepseek-harness)
bundle: it installs through the Harness **Plugins** page and adds one control
to the composer toolbar.

## How it works

```
  phone (camera / keyboard)                computer (DeepSeek Harness)
 ┌──────────────────────────┐            ┌────────────────────────────────────┐
 │  capture page            │  POST      │  Host: capture server  :8765      │
 │  ┌────────────────────┐  │ ─────────► │    queue ──► claim ──► composer   │
 │  │ textarea + camera  │  │  /submit   │                                    │
 │  └────────────────────┘  │            │  Browser: polls /scan/claim       │
 └──────────────────────────┘            │    text  ──► insertText()          │
                                         │    photo ──► draft attachment      │
   scan the QR ──► http://<lan-ip>:8765/  └────────────────────────────────────┘
```

1. **Host half** ([index.js](index.js)) starts a small HTTP server on the local
   network and serves the phone capture page. It queues what the phone sends.
2. **Phone page** ([mobile-page.js](mobile-page.js)) collects text and photos,
   shrinks the photos to a sane size, and posts them back to the same origin.
3. **Browser half** ([client.js](client.js)) polls the Host for queued items
   and puts them into the composer of the current session: photos become draft
   attachments, text is inserted at the caret.
4. The QR code is rendered by the Host (`/scan/qr.svg`) and encodes the
   capture address together with a per-run token.

The two halves live in one package: `index.js` is the Node/Host entry,
`client.js` is the browser module the Harness loads lazily.

## Requirements

- DeepSeek Harness (Desktop or Web) with plugin support.
- The phone and the computer on the same network (Wi-Fi or LAN). The plugin
  listens on every interface, so no port forwarding is needed.

## Install

### From a local checkout (Desktop app)

```sh
git clone https://github.com/BirdLearn/deepseek-plugin-remote-input.git
cd deepseek-plugin-remote-input
npm install            # runtime deps: qrcode + @deepseek-ai/schemastery
```

In the DeepSeek Harness app open **Settings → Plugins**, install from the local
path (the directory that holds this `package.json`), and restart the app once
so the Host half activates.

> A local (linked) installation resolves `qrcode` and `@deepseek-ai/schemastery`
> from this directory's `node_modules`, so run `npm install` before installing
> the bundle.

### From npm

```sh
npm install dsh-remote-input
```

Then install `dsh-remote-input` from the Harness **Plugins** page.

## Use

1. Open a session in Harness. A small **QR glyph** appears in the composer
   toolbar, left of the permission and plan controls.
2. Click it. A panel opens with the QR code, the capture address, and the
   queue counters.
3. Scan the code with the phone, type or photograph, press **Send to computer**.
   The text and photos appear in the composer of the session you were looking
   at — press the usual send button when you are ready.

The capture address can also be typed by hand (the panel shows it and offers a
copy button) when the phone camera cannot focus on the screen.

## Configuration

The bundle inserts one Host row; its `config` accepts:

| Config | Default | Description |
|---|---|---|
| `port` | `8765` | TCP port of the capture server. `0` picks a free port. |
| `host` | `0.0.0.0` | Listen address. |
| `maxImages` | `9` | Largest number of images one submission may carry. |
| `maxTextChars` | `8000` | Largest number of characters one submission's text may carry. |
| `maxUploadBytes` | `33554432` | Largest accepted request body in bytes. |

## HTTP routes

The capture server (LAN, token-protected):

| Route | Purpose |
|---|---|
| `GET /?k=<token>` | The phone capture page. |
| `POST /submit?k=<token>` | `{ text, images: [{ name, type, data }] }` — base64 image payloads. |
| `GET /status?k=<token>` | `{ ok, pending }`. |

The Harness web server (local, used by the browser half):

| Route | Purpose |
|---|---|
| `GET /scan/config` | `{ urls, primary, port, pending }` — capture addresses and queue depth. |
| `GET /scan/claim` | `{ items }` — claims queued items (exclusive). |
| `GET /scan/qr.svg` | The QR code of the capture address, as SVG. |

## Security and privacy

- **Nothing leaves the machine.** The capture server binds to the local
  network only, the phone talks to it directly, and images never touch a cloud
  service. They are uploaded once into the Harness attachment store, exactly
  like a file you drop into the composer.
- **Token in the QR code.** The address carries a random per-run token; a
  device that did not scan the code gets `403` from every capture route.
- **One token per run.** The token changes whenever the Host half restarts, so
  an old screenshot of the QR code stops working.
- The Host routes under `/scan/` are registered on the Harness web server and
  are reachable by anything that can reach that server — keep the Harness bound
  to localhost (the default).

## Development

```sh
npm install
npm test            # node --test: Host routes, queue flow, client rendering
```

Layout:

```
index.js          Host half: capture server, queue, Harness routes
config.js         Config schema (schemastery)
mobile-page.js    The phone-facing capture page (one self-contained document)
client.js         Browser half: composer trigger + QR panel
locale/*.json     Plugin metadata for the Plugins page (title, description)
icon.svg          Plugin icon
test/             Node test-runner suites
```

The browser half is a plain-JavaScript module in the Harness lazy-factory
format (`window.__ModuleLoader__.load`), so there is no build step: edit
`client.js`, restart the app (or reload the page) and the new bytes are
served. The client revision is derived from file mtimes, so a reload picks up
your change.

The plugin imports nothing from Harness client packages; it only uses the
`slots`, `locale`, and `conversation` services that the runtime provides.

## Known limitations

- A capture lands in **one** session: with several Harness windows open, the
  first window that polls claims the item.
- While the composer is busy (a message is being sent) incoming content waits
  in a local buffer and is inserted as soon as the composer is free again. The
  trigger shows the number of waiting items.
- Photos are downscaled to 1600 px on the phone (JPEG, quality 0.85) before
  they are sent; very large photos lose some detail.
- The capture page needs a browser that supports `<input type="file" capture>`;
  every current mobile browser does.

## License

[MIT](LICENSE)
