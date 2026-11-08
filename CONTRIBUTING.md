# Contributing

Thanks for helping out. This is a small plugin — the bar is "understandable,
tested, and kind to the next reader".

## Development setup

```sh
git clone https://github.com/BirdLearn/deepseek-plugin-remote-input.git
cd deepseek-plugin-remote-input
npm install
npm test
```

There is no build step. The browser half is plain JavaScript in the Harness
lazy-factory format, and the Host half is plain ESM; both files are served
as they are.

## Running it inside DeepSeek Harness

1. In the Harness app open **Settings → Plugins** and install the bundle from
   this directory.
2. Restart the app so the Host half activates.
3. Open a session, click the QR glyph in the composer toolbar, and scan the
   code with a phone on the same network.

The client bundle revision is derived from file mtimes, so a page reload picks
up your edits without a rebuild.

## Conventions

- **Two halves, one package.** `index.js` is the Node/Host entry, `client.js`
  is the browser module. Neither imports the other.
- **No Harness client packages.** The browser half uses only the `slots`,
  `locale`, and `conversation` services the runtime provides; React comes from
  the platform module table. Keep it that way — the plugin must stay
  installable on its own.
- **Theme tokens only.** Every colour in the client half is a `--dsw-*` token.
  The phone page is a standalone document and owns its own styles.
- **Localized copy.** Client UI text lives in the `locale` dictionaries of
  `client.js`; the plugin metadata for the Plugins page lives in `locale/*.json`.
- **Comments explain contracts, not mechanics.** Say what a function guarantees
  and why, not what the next line does.
- **Tests for behaviour.** Add a case to `test/` whenever you change the queue
  flow, the routes, or the rendered panel.

## Pull requests

1. Open an issue first for anything larger than a fix, so the approach can be
   discussed before the work.
2. Keep one topic per pull request.
3. `npm test` must be green.
4. Describe the user-visible effect in the pull request body, and update
   `README.md`, `README.zh-CN.md`, and `CHANGELOG.md` when behaviour changes.

## Reporting bugs

Include the Harness version, the operating system, whether the phone and the
computer share a network, and what the panel showed (the address and the
queue counters). Never paste the access token from a capture address into a
public issue.
