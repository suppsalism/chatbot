# Changelog

All notable changes to this project are documented here.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/), and this project
adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html). The public surface is the
config fields, the callbacks, the lifecycle payload shapes, and the instance API — none of them
change within a major version.

## [v2.0.0] - 2026-08-19

### Changed

- **`onSuggestionClick` is now `onSendSuggestion`, and it answers the chip rather than merely
  observing it.** When it is set, a suggestion chip is routed to it in place of `onSendMessage` —
  same arguments, same return shapes, same error handling. Typed messages and `bot.submit()` are
  unaffected and still go to `onSendMessage`.

  A chip is a question you wrote, so you already know which answer it wants. Previously answering
  one meant an `if` at the top of `onSendMessage` re-deriving which chip had been clicked; now that
  dispatch happens once, in the package. Answering directly is the common case, but the handler is
  `async` like any other, so a chip whose answer depends on the user can still call an API first.

  Returning nothing hands that chip to `onSendMessage` after all, so handling one chip does not
  oblige you to handle them all — including chips that arrive later inside a reply's `suggestions`.
  Returning `false` synchronously still cancels the turn outright.

  **Migrating.** Rename the key, and read `message.text` where you read `text`: the signature was
  `(text: string)` and is now `(message, ctx)` — the same pair `onSendMessage` receives, since the
  two are now interchangeable. `ctx.history` already includes the chip's own message, matching
  `onSendMessage`. Returning `false` is unchanged and `true` still means "go ahead", so the old
  boolean contract keeps working once renamed. An `onSuggestionClick` key left in place is reported
  by the usual unknown-option warning and ignored.

  Two smaller consequences: the callback now runs _after_ `beforeSubmitMessage` rather than before
  it, so a cancelled turn no longer fires it; and a throw is now degraded like a failed reply — an
  error bubble plus `onMessageError` — rather than being swallowed. It does not fall through, since
  a handler that failed is not a handler that declined.

### Removed

- **The `docs/` folder.** Its four files documented the package as it was being designed, and had
  drifted well past that: `CONTRACT.md` specified a `transport` port and a plugin contract that
  were never built, `STRUCTURE_FLOW.md` described the pre-1.0.0 `src/lib/` layout, and the spec
  still listed `collectLeads`. The README is the consumer contract and `CONTRIBUTING.md` is the
  contributor one; a third, stale account of the same package was worse than none. The `spec §x` /
  `guide §x` citations that referenced them have been removed from the source comments — the
  explanation each comment carries stayed, only the dangling pointer went. Nothing published
  changes: `docs/` was never in the tarball.

## [v1.0.1] - 2026-08-18

### Changed

- Publishing is now tokenless. `release.yml` became `publish.yml` — npm's trusted publishing binds
  to a specific workflow filename, and that is the one registered — and the `NODE_AUTH_TOKEN` /
  `NPM_TOKEN` pair is gone in favour of a short-lived OIDC token GitHub mints per run. Nothing
  long-lived is stored in repository secrets any more. No effect on the published package.

## [v1.0.0] - 2026-08-17

### Added

- **A reply can carry a `form`**, rendered inside that message's bubble, so a widget can ask for
  whatever it needs at the point in the conversation where it makes sense. Fields are described
  declaratively (`name`, `label`, `type`, `required`, `options`, `placeholder`, `value`) alongside
  an optional `title` and `submitLabel`, and every field maps to a native control — validation is
  the browser's, so there is no validation engine here.

  The handler lives on the form as `form.onSubmit(values, ctx)`, not at widget level: the code that
  consumes the values sits next to the fields that produce them. It receives values keyed by field
  name (checkboxes as booleans) and `ctx` of `{ formId, messageId, sessionId }`. Returning a reply
  — or an array of them — answers in the conversation and locks the form; returning `false` leaves
  it editable for a server-side rejection; anything else just locks it. Locking is what prevents a
  double submission.

  The descriptor is data, never markup. Nothing is ever passed to `innerHTML`, so a form described
  by a backend or a model cannot inject script into the host page — which matters, because the
  widget's iframe is same-origin and isolates CSS, not privilege. There is no `password` field
  type for the same reason; an unknown type degrades to `text` with a warning.

- **`onSendMessage` may return an array of replies**, rendering one agent message per element —
  each with its own bubble, `messageId`, feedback pair, and conversation entry. Suggestion chips
  are a single row, so across an array the last non-empty set wins. The single-object shape, the
  bare-string shorthand, and streaming via async iterable are all unchanged; a streamed reply is
  still one bubble and carries no form.

### Removed

- **`collectLeads`, `onLeadSubmit`, and the built-in lead form.** It hardcoded
  `firstName / lastName / email / message` — the package deciding what a business wants to know
  about its customers, which is business logic in a UI library — and it could only ever render as
  a permanent form pinned below the composer, never contextually. `reply.form` replaces it with
  strictly more capability. To reproduce the old form, describe those four fields on a reply.

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

## 0.1.0 — never published

Listed for context only; this version does not exist on npm, which is why the 1.0.0 entries above
read as changes rather than as an initial release.

The package as it stood before 1.0.0: `createChatbot`, `defineChatElement` / `<ss-chat>`, the
schema-driven config system, the signal store, and the iframe-isolated widget.
