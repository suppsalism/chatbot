# Structure & Flow

This document explains how `@suppsalism/chatbot` is put together: the file
layout, the design approach behind it, the exact execution path from the
moment the script loads to a fully built `Chatbot` instance, what each
stylesheet is responsible for, and how the test suite targets the codebase.

## 1. Directory structure

```
js.lib.chatbot/
├── package.json              # dual distribution: cjs/module/unpkg/exports, build & test scripts
├── vitest.config.js          # test runner config (jsdom environment, tests/ include, setup file)
├── README.md
│
├── src/
│   ├── core.js                        # ENTRY POINT - config resolution, API client, DOM bootstrap,
│   │                                   # the Chatbot class, and the bootstrap/autoStart orchestration
│   ├── style.css                      # styles for the widget's own UI, injected into the <iframe>
│   ├── shell.css                      # styles for the host-page launcher/container/iframe shell
│   │
│   └── lib/
│       ├── helper.js                  # generic, non-chatbot-specific utilities (uuid, color contrast, type coercion)
│       │
│       ├── constants/                 # every static value, one file per concern
│       │   ├── api.js                 # API_BASE_URL, API_ENDPOINTS
│       │   ├── dom.js                 # tag name, DOM ids, CSS class names
│       │   ├── defaults.js            # DEFAULT_CONFIG fallback values
│       │   └── attribute-schema.js    # ATTRIBUTE_SCHEMA: config field -> data-* attribute + type
│       │
│       ├── store/
│       │   └── signal.js              # the reactive primitive: createSignal / createEffect / createMemo
│       │
│       └── component/                 # one class per UI piece, each exposing `.element`
│           ├── wrapper.js             # Wrapper       - outer shell + `.content` slot
│           ├── launcher.js            # Launcher      - floating toggle button (host page)
│           ├── thead.js               # Thead         - header bar (avatar, name, close button)
│           ├── message-wrapper.js     # MessageWrapper- scrollable message list (owns Message/Typing)
│           ├── message.js             # Message       - a single chat bubble
│           ├── typing.js              # Typing        - the "..." typing indicator bubble
│           ├── suggestion-wrapper.js  # SuggestionWrapper - suggestion chip row (owns Suggestion)
│           ├── suggestion.js          # Suggestion    - a single suggestion chip/button
│           ├── composer.js            # Composer      - text input + send button
│           └── signature.js           # Signature     - "Powered by suppsalism" footer link
│
├── tests/                     # mirrors src/, kept separate rather than colocated
│   ├── setup.js                       # jsdom polyfills, loaded before every test file
│   ├── core/                          # targets the plain functions exported from src/core.js
│   │   ├── resolve-attribute-config.test.js
│   │   ├── merge-config.test.js
│   │   └── api-client.test.js
│   └── lib/
│       ├── helper.test.js
│       ├── store/
│       │   └── signal.test.js
│       └── component/
│           ├── launcher.test.js
│           ├── suggestion.test.js
│           ├── suggestion-wrapper.test.js
│           └── message-wrapper.test.js
│
└── dist/                      # build output (generated, not committed to source control by hand)
    ├── core.cjs               # CommonJS build      -> package.json "main" / exports."require"
    ├── core.module.js         # ES module build     -> package.json "module"
    ├── core.modern.js         # modern ES build      -> package.json exports."default"
    └── core.umd.js            # UMD build             -> package.json "unpkg" (CDN <script> tag)
```

## 2. Architecture & design approach

**Pattern: OOP composition, no framework.** A small orchestration function
(`bootstrap`, triggered by `autoStart`) wires together two kinds of building
blocks:

- **Plain, stateless functions** for anything that doesn't need to remember
  state between calls: config resolution (`resolveAttributeConfig`,
  `mergeConfig`), the API client (`fetchChatbotConfig`, `sendChatMessage`),
  and DOM bootstrap (`findChatElement`, `mountContainer`, `mountIframe`,
  `injectIframeHead`). Being plain functions, each is independently
  unit-testable without a live DOM, a real API, or a `Chatbot` instance.
- **ES classes** for anything that owns state or a piece of UI: `Chatbot`
  itself, and one class per UI piece in `src/lib/component/`. Every
  component class follows the same shape - constructor takes props, calls
  `build()`, exposes `this.element` (the root DOM node) - a lightweight
  "component" convention with zero framework runtime involved. A couple of
  components go further and encapsulate their own child DOM instead of
  letting external code reach into them: `MessageWrapper.appendMessage()` /
  `.showTyping()` / `.hideTyping()` and `SuggestionWrapper.addSuggestion()`
  build and append their own `Message`/`Typing`/`Suggestion` instances
  internally.

**State management: a from-scratch signal store**
(`src/lib/store/signal.js`), not a virtual DOM and not any external
framework. It is a small, SolidJS-style push-based reactive primitive:

- `createSignal(value)` returns a `[read, write]` pair.
- `createEffect(fn)` runs `fn` immediately, tracking which signals it read
  via a module-level execution-context stack, then automatically re-runs
  `fn` whenever any of those signals are written to - including signals
  that are only read conditionally on a later run.
- `createMemo(fn)` is a derived, read-only signal built on top of
  `createEffect`.

Every piece of UI-affecting state in the widget (`message`, `disabledSubmit`,
`chatVisible`, `conversation` on `Chatbot`, plus the `Composer`'s internal
`inputInvalid` memo) flows through this store. Effects mutate real DOM nodes
directly - there is no diffing step.

**Why `core.js` stays a single file.** Config resolution, the API client,
and the DOM-bootstrap helpers could each live in their own module, but they
are intentionally kept in `core.js` alongside the `Chatbot` class, organized
into banner-commented sections that read top-to-bottom in the same order
execution actually happens (config resolution -> API client -> DOM
bootstrap -> `Chatbot` -> `bootstrap`/`autoStart`). This keeps `core.js`
itself as the literal, single package entry point rather than a thin shim
that re-exports a scattered module tree.

**Packageability.**

- Zero runtime dependencies - `microbundle` is the only dependency, and it's
  a dev-time build tool.
- `microbundle --css inline` builds four output formats from the single
  `src/core.js` entry: `core.cjs` (Node `require`), `core.module.js` (ES
  module, for bundlers reading `"module"`), `core.modern.js` (modern ES
  output, `exports.default`), and `core.umd.js` (UMD, used by the `unpkg`
  CDN field). `--css inline` guarantees `style.css` and `shell.css` are
  embedded as JS string literals in _all four_ formats identically - by
  default `microbundle` only inlines CSS into three of the four and
  extracts a separate `.css` file for the fourth, which silently broke
  styling for anyone consuming the package via `require()`.
- Because the widget self-initializes (`autoStart()` runs the instant the
  module is evaluated), the primary distribution model needs zero
  consumer-side JavaScript: a host page includes the built script via a
  `<script>` tag (typically from a CDN such as jsDelivr) and drops a
  `<ss-chat data-key="...">` tag in the body. The `main`/`module`/`unpkg`/
  `exports` fields also make the same build resolvable as a normal npm
  dependency for bundler-based consumption.
- The actual chat UI renders inside a same-origin `<iframe>`
  (`mountIframe`), which sandboxes the widget's DOM and styles from
  whatever CSS/JS the host page happens to have, so it renders consistently
  regardless of which site it's embedded on.

## 3. Execution flow: from `autoStart` to a built `Chatbot`

All of this happens in `src/core.js`, top to bottom, in this order:

1. **`autoStart()`** runs the moment the module is evaluated (the last line
   of the file). It checks `document.readyState`:
   - `'loading'` -> defers by registering `bootstrap` on
     `DOMContentLoaded` (`{ once: true }`).
   - otherwise -> calls `bootstrap()` immediately.

2. **`bootstrap()`** runs the whole flow as a single promise chain - nothing
   in it throws synchronously, so a missing `<ss-chat>` tag or a failed
   fetch is always caught at the end rather than crashing the host page (or
   a test importing this module):

   a. **`findChatElement()`** - looks up
   `document.getElementsByTagName(CHAT_TAG_NAME)[0]` (`'ss-chat'`) and
   throws `'Chat element not found!'` if it's missing.

   b. **`resolveAttributeConfig(chatElement)`** - walks `ATTRIBUTE_SCHEMA`
   and, for every field with a matching `data-*` attribute present on
   the tag, reads `element.dataset[datasetKey]` and coerces it via
   `parseTypedValue` (string / json / boolean). If no `data-session` was
   given, generates one with `generateUuid()`. Produces a partial config
   object sourced entirely from the tag.

   c. **`fetchChatbotConfig(attributeConfig.chatbot_key)`** - `GET`s
   `${API_BASE_URL}${API_ENDPOINTS.chatbotConfig(key)}`
   (`https://api.suppsalism.com/chatbot/:key`) and parses the JSON
   response.

   d. **`mergeConfig(attributeConfig, apiConfig)`** - combines
   `{ ...DEFAULT_CONFIG, ...attributeConfig, ...apiConfig }`. Precedence,
   lowest to highest: built-in defaults, tag attributes, then the API
   response - the API always wins when both sources supply a field.

   e. **`mountContainer({ orientation })`** - creates
   `<div id="suppsalism-messages-iframe-container">` in the _host page_,
   appends the shell style tag (`shell.css` content) to
   `document.head`, and appends the container to `document.body`.

   f. **`mountIframe(container)`** - creates `<iframe id="suppsalism-iframe">`
   and appends it into that container.

   g. **`injectIframeHead(iframe, { theme })`** - waits (via a deferred
   callback) for `iframe.contentWindow.document` to exist, then appends
   the charset meta, viewport meta, and the widget style tag
   (`style.css` content) into the _iframe's_ `<head>`, and sets
   `<body class="theme-{theme}">` on the iframe document. Resolves with
   the iframe's `<body>`.

   h. **`new Chatbot(iframeBody, config)`** - constructs the widget itself,
   passing the iframe's body as its mount node and the fully resolved
   config.

   i. **`.catch((error) => console.log(error))`** - anything that failed
   anywhere above (missing tag, network failure, etc.) is logged here;
   `bootstrap()` still resolves rather than rejecting or throwing.

3. **`new Chatbot(node, config)` constructor** - builds and wires up the
   entire widget, in this order:

   - **`initNode()`** - grabs `this.wrapperIframeNode`, the _host page's_
     container div created in step (e), which visibility toggling will
     later target. `this.config` (set at the top of the constructor) is the
     single source of truth for every config field - the rest of the class
     reads it directly (`this.config.brand_color`, `this.config.session_id`,
     etc.).
   - **`initState()`** - creates the four signal pairs that drive the whole
     UI: `[this.message, this.setMessage]`,
     `[this.disabledSubmit, this.setDisabledSubmit]`,
     `[this.chatVisible, this.setChatVisible]`,
     `[this.conversation, this.setConversation]` (seeded from
     `this.config.initial_messages`, tagging the last one with the brand
     avatar).
   - **`initComponents()`** - builds the component tree and mounts it:
     `Wrapper` (outer shell) -> `Launcher` (appended straight to
     `document.body`, since it must stay visible even when the chat window
     is collapsed) -> `Thead`, `MessageWrapper`, `SuggestionWrapper`
     (populated via `addSuggestion` for each `suggested_message`),
     `Composer`, and optionally `Signature`, all appended into
     `wrapper.content`. Finally `wrapper.element` is appended into
     `this.node` (the iframe body from step 2h).
   - **`bindVisibilityEffect()`** - a `createEffect` that toggles the
     `.visible` class on `wrapperIframeNode` based on `chatVisible()`.
   - **`bindConversationEffect()`** - a `createEffect` that reacts to
     `conversation()` changes: shows/hides the typing indicator via
     `messageWrapper.showTyping()`/`.hideTyping()`, and appends real message
     bubbles via `messageWrapper.appendMessage()`.

At the end of the constructor the chatbot is fully built and interactive:
the launcher button is in the host page, the chat window (collapsed by
default, since `chatVisible` starts `false`) is mounted inside the iframe,
and every further interaction - typing (`typeMessage`), sending
(`sendMessage` -> `sendChatMessage` -> `addMessage`) - flows through signal
writes, which the two bound effects turn back into DOM updates.

## 4. Styles: `style.css` vs `shell.css`

The widget spans **two separate documents** (the host page and the iframe),
so its CSS is deliberately split into two files that get injected into two
different places:

- **`src/style.css`** - styles the widget's own UI, injected into the
  **iframe's** `<head>` by `createWidgetStyleTag()` (called from
  `injectIframeHead`). Covers everything `Chatbot`'s child components
  render inside the iframe: global reset/typography, `.wrapper`,
  `.thead-*`, `.message-*`, `.composer-*`, `.suggestion-*`,
  `.signature-*`, `.typing`, and both `body.theme-light` /
  `body.theme-dark` variants (selected via the `theme-{theme}` class set on
  the iframe's `<body>` in step 2g above).

- **`src/shell.css`** - styles only the two DOM nodes that live directly in
  the **host page**, outside the iframe, injected into `document.head` by
  `createShellStyleTag()` (called from `mountContainer`). Covers `.launcher`
  (the floating toggle button - size, position, per-orientation
  `.left`/`.right` placement) and
  `#suppsalism-messages-iframe-container`/`#suppsalism-iframe` (the
  fixed-position wrapper around the iframe: its collapsed/`.visible`
  transition, and full-screen behavior on mobile viewports).

Both files are pulled in as plain string imports (`import css from
'./style.css'`) and inlined as JS string literals into every build format
by `microbundle --css inline` - see the Packageability note above.

## 5. Tests: tool and coverage mapping

**Tool:** [Vitest](https://vitest.dev), configured in `vitest.config.js`
with `environment: 'jsdom'` (since almost everything under test creates or
reads real DOM nodes) and `setupFiles: ['./tests/setup.js']`, which
polyfills `Element.prototype.scrollIntoView` - jsdom doesn't implement it,
and `MessageWrapper`'s auto-scroll would otherwise throw during tests.
Run with `npm test` (`vitest run`) or `npm run test:watch`.

Tests live in a **top-level `tests/` directory that mirrors `src/`**,
rather than being colocated with source files, matched to source by name:

| Source file                                             | Test file                                        |
| ------------------------------------------------------- | ------------------------------------------------ |
| `src/core.js` (`resolveAttributeConfig`)                | `tests/core/resolve-attribute-config.test.js`    |
| `src/core.js` (`mergeConfig`)                           | `tests/core/merge-config.test.js`                |
| `src/core.js` (`fetchChatbotConfig`, `sendChatMessage`) | `tests/core/api-client.test.js`                  |
| `src/lib/helper.js`                                     | `tests/lib/helper.test.js`                       |
| `src/lib/store/signal.js`                               | `tests/lib/store/signal.test.js`                 |
| `src/lib/component/launcher.js`                         | `tests/lib/component/launcher.test.js`           |
| `src/lib/component/suggestion.js`                       | `tests/lib/component/suggestion.test.js`         |
| `src/lib/component/suggestion-wrapper.js`               | `tests/lib/component/suggestion-wrapper.test.js` |
| `src/lib/component/message-wrapper.js`                  | `tests/lib/component/message-wrapper.test.js`    |

`signal.test.js` is the most important one: alongside basic read/write/
effect/memo behavior, it has a dedicated regression test for a conditional
dependency (a signal only read once an `if` branch flips) - the exact
tracking bug that was fixed in this store.

**Known coverage gaps** (not yet covered by a dedicated test file): the
remaining component classes (`message.js`, `thead.js`, `composer.js`,
`signature.js`, `typing.js`, `wrapper.js`), and the DOM-bootstrap/
orchestration functions in `core.js` (`findChatElement`, `mountContainer`,
`mountIframe`, `injectIframeHead`, `bootstrap`, `autoStart`) and the
`Chatbot` class itself - exercising those fully would mean mocking a real
iframe and its `contentWindow.document`, which is heavier than a unit test;
today they're covered by manual/build-level verification instead.
