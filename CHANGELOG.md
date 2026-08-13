# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). The public surface is the
config fields, the callbacks, the lifecycle payload shapes, and the instance API — none of them
change within a major version.

## [Unreleased]

### Fixed

- **The reactive store was inert in every published bundle.** `notify()` snapshotted its subscriber
  set with `[...subscribers]`, and the build transpiles array spread in loose mode, where `[...x]`
  becomes `[].concat(x)`. `concat` only flattens arrays, so a `Set` came through as a single
  element: the snapshot was `[theSet]`, and `runEffects` then called `.execute()` on the Set itself.
  Every notification threw `TypeError: effect.execute is not a function` and **no effect ever
  re-ran** — the send button never re-enabled after typing, so the composer could not submit at
  all. Inside `batch()` the bad value was queued into `pendingEffects`, so the flush threw too.
  Now uses `Array.from()`, which Babel does not rewrite.

  This only ever affected the built artifacts, never `src/`, which is why the source-level test
  suite passed throughout. Composer-driven tests (typing, Enter, send button, pending lock) have
  been added — they exercise the reactive path that `bot.submit()` bypasses.

- **`defineChatElement`: a tag's own `data-*` attribute now wins over the shared defaults passed at
  registration**, as the README has always documented. Previously the shared config was spread over
  a fully-resolved attribute config, so registration defaults silently beat every per-tag
  attribute, and two tags on one page could not differ. Removing an attribute now also reverts that
  field to the shared default instead of stranding the last value it held.
- **`getTextColorForBackground` no longer returns white for every `rgb()` string.** The `rgb()`
  branch produced an array while the brightness calculation destructured `{ r, g, b }`, yielding
  `NaN` and failing the comparison. Hex input was unaffected, and `brandColor` validates as hex, so
  no shipped configuration could reach this path.

### Changed

- Restructured the repository to conventional npm-package layout. `src/lib/` is gone — `src/` is
  the library. Modules are now grouped by role: `core/`, `components/`, `config/`, `constants/`,
  `dom/`, `reactive/`, `styles/`, `utils/`.
- `helper.js` split by concern into `utils/{warn,uuid,guards,coerce,color}.js` and `dom/icon.js`.
  `echoReply` moved to `src/echo-reply.js` — it is public API, not an internal helper.
- `createChatbot` reduced to wiring: the 160-line `buildComponents()` became `core/view.js`, and
  the callback-safety wrappers became `core/safe-invoke.js`.
- `constants/dom.js` split into `constants/class-names.js` (the `CLASS` map) and `constants/dom.js`
  (tag name, ready event, id builders).

**No public API changed.** Every named export keeps its name, signature, and behavior — the two
entry points resolve to the same surface as before.

### Added

- Test suite: 139 Vitest tests over config resolution, attribute parsing, the reactive store, the
  three-stage message lifecycle, and both entry points end-to-end in jsdom.
- `examples/` — three runnable pages (UMD/CDN, `<ss-chat>`, ESM + streaming), served by
  `npm run examples`.
- `scripts/` — `check-exports.mjs` (every declared path resolves, nothing published makes a network
  call), `check-size.mjs` (gzip budget), `build-css.mjs` (standalone stylesheet),
  `serve-examples.mjs`.
- CI on Node 20 and 22: lint, format, test, build, exports check, size check, tarball contents.
  Release workflow publishes on a `v*` tag with npm provenance.
- ESLint and Prettier. Lint rules enforce the package boundary directly: `fetch`, `XMLHttpRequest`,
  and `WebSocket` are restricted globals in `src/`, and `innerHTML` / `outerHTML` /
  `insertAdjacentHTML` are restricted properties.
- `@suppsalismjs/chatbot/style.css` now resolves — `dist/chatbot.css` is emitted as a real file.
  It was documented in the README but absent from `exports`, so the import threw.
- `repository`, `bugs`, `homepage`, and `engines` in `package.json`.

### Removed

- `.npmignore`, which was redundant with and overridden by `files: ["dist"]`.

## [0.1.0]

Initial package: `createChatbot`, `defineChatElement` / `<ss-chat>`, the schema-driven config
system, the signal store, and the iframe-isolated widget.
