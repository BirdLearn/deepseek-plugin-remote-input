# Changelog

All notable changes to this project are documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-08

### Added

- Composer toolbar trigger that opens the capture panel with a QR code.
- Host-side capture server on the local network that serves the phone page,
  queues submissions, and renders the QR code for the capture address.
- Phone capture page with a text field, a camera button (`capture="environment"`),
  a photo picker, thumbnail previews, and client-side downscaling to 1600 px.
- Browser half that claims queued items and places them into the composer of
  the current session: text at the caret, photos as draft attachments.
- Per-run access token in the capture address; capture routes reject requests
  without it.
- Local buffer that keeps incoming content until the composer is free again,
  with the waiting count shown on the trigger.
- Test suite (`npm test`) covering the Host routes, the queue flow, the QR
  rendering, and the rendered client components.
