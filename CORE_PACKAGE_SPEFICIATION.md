# `@suppsalism/chatbot` — Core Package Specification

**Status:** design specification
**Scope:** the base package only. Anything that talks to a network lives in a
separate package (see [§12](#12-what-is-deliberately-not-in-this-package)).

---

## 1. Purpose and scope

`@suppsalism/chatbot` is a **pure UI and state package**. Given a configuration
object, it composes a chat widget, renders it, manages its interaction state,
and exposes a message lifecycle the consuming developer hooks into.

It has **zero runtime dependencies** and knows nothing about HTTP, URLs,
databases, authentication, or any specific chat backend.

### In scope

- Configuration schema, defaults, validation, and `data-*` attribute parsing
- Component composition — building the widget's DOM from config
- Reactive state management (signal store) and DOM effects
- Iframe + shell mounting, style injection
- Conversation state: message list, typing indicator, composer enable/disable
- The message lifecycle callback contract
- The public instance API (`open`, `close`, `submit`, `updateConfig`, `destroy`)
- Optional UI features driven by config: suggestions, feedback, lead capture

### Out of scope

- Fetching configuration from anywhere
- Sending messages anywhere — the consumer supplies that function
- Persisting messages, feedback, or leads
- Retries, backoff, timeouts, authentication, rate limiting
- Any hardcoded URL or endpoint
- Auto-booting from a tag scan (requires a send function, therefore belongs to
  the consuming layer — see [§11](#11-html-tag-usage))

---

## 2. The boundary rule

One rule decides where anything goes:

> **If it survives `JSON.stringify`, it is configuration. If it does not, it is
> an option.**

Themes, copy, feature flags → configuration. Functions, DOM nodes → options.

This is not tidiness. It is a security property: `data-*` attributes and any
remote config a consumer merges in can only ever produce serializable
configuration, so external input can never inject a function or a DOM node into
the widget. It also keeps the schema a flat serializable table that types and
documentation can be generated from.

---

## 3. Distribution and entry points

The package ships in two modes. **The public API is identical in both; only
acquisition and bootstrapping differ.** Everything in [§4](#4-configuration) through [§10](#10-rendering-model) applies
unchanged to either mode.

### 3.1 npm

```bash
npm install @suppsalism/chatbot
```

```js
import { createChatbot } from '@suppsalism/chatbot';
const bot = createChatbot({ … });
```

No side effects on import. Importing in Node, in an SSR render, or in a test
does nothing until a function is called.

| Entry | Export map | Contents |
| --- | --- | --- |
| `@suppsalism/chatbot` | `"."` | `createChatbot`, `defineChatElement`, `parseAttributes`, `resolveConfig`, `CONFIG_SCHEMA`, `echoReply` |
| `@suppsalism/chatbot/style.css` | `"./style.css"` | The standalone stylesheet, for consumers who want to import or override it |

### 3.2 CDN

```html
<script src="https://cdn.jsdelivr.net/npm/@suppsalism/chatbot@1/dist/chatbot.umd.js" defer></script>
```

```js
const bot = SsChat.createChatbot({ … });
```

Every named export above is reachable on `window.SsChat` **under exactly the
same name**. That is the whole difference between the two modes, and it is
deliberate: every example in this document, and every snippet a developer finds
anywhere, works in both worlds with only the acquisition line changed. No
shorthand aliases — a second vocabulary is a second thing to teach and keep in
sync.

CDN-specific mechanics — the global's shape, load ordering, the double-load
guard, and how parity is enforced — are in [§17](#17-cdn-distribution).

The CDN URL is a view of the npm tarball; jsDelivr and unpkg serve *from* the
registry. There is one release process, one version number, and one
`npm publish`. Never hand-upload a build artifact anywhere.

### 3.3 Styles

CSS is inlined into every build format (`microbundle --css inline`), so
JavaScript and CSS are always the same version. `--css inline` is mandatory:
by default `microbundle` inlines into three formats and extracts a separate file
for the fourth, which silently breaks styling for `require()` consumers. The
standalone `style.css` is published for bundler consumers who want to override
it; it is not fetched at runtime in either mode.

---

## 4. Configuration

### 4.1 The schema is the single source of truth

`CONFIG_SCHEMA` is one flat table. Every configuration field is one row:

```js
{
  key:        'brandColor',      // prop name (camelCase)
  attribute:  'data-brand-color', // DOM attribute (kebab-case)
  type:       'color',
  default:    '#2563eb',
  validate:   (v) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v),
}
```

Defaults, the attribute parser, validation, the generated TypeScript
declarations, and the documented options table are all derived from this table.
There is no separate `defaults.js` to drift out of sync. **Adding a new option
means adding one row.**

Keep the schema **flat**. Flat config makes a shallow merge provably correct,
keeps the 1:1 attribute mapping honest (`data-lead-fields` rather than a nested
object), and makes per-field rules trivial. Nested config and DOM attributes
fight each other.

### 4.2 Attributes and props are the same fields

```html
<ss-chat data-theme="dark" data-orientation="left" data-signature="false"></ss-chat>
```

```js
createChatbot({ theme: 'dark', orientation: 'left', signature: false, ... })
```

Both feed the same schema through the same code path. Attribute values are
coerced by the type declared in the schema (`string`, `boolean`, `number`,
`json`).

> **Naming note.** Props are camelCase, attributes kebab-case. If a consuming
> layer receives snake_case fields from an API, that layer normalizes them
> before passing them in. Core recognizes camelCase only.

### 4.3 Resolution rules

`resolveConfig(layers)` merges an array of partial configs, lowest precedence
first, over the schema defaults. Core supplies the defaults layer; the consumer
decides what the other layers are and in what order.

| Situation | Behavior |
| --- | --- |
| Field missing | Schema default applied |
| Field present but invalid | **Fall back to that field's default and warn.** Never throw — a bad value from a dashboard must not blank the widget on a customer's site |
| Unknown key present | **Keep it, warn once, ignore it.** Forward-compatibility valve: a newer config carrying a field an older cached build does not understand must not break |
| `null` / `undefined` value | Stripped before merge, so it cannot clobber a lower layer's good value |

**No configuration field is required.** That is the test that the boundary is
correct — API keys, endpoints, and base URLs never appear in this schema.

The one field core generates for itself is `sessionId`: it needs one to stamp
lifecycle payloads, so it creates a UUID when none is supplied.

### 4.4 Field reference

| Prop | Attribute | Type | Default | Purpose |
| --- | --- | --- | --- | --- |
| `theme` | `data-theme` | `'light' \| 'dark'` | `'light'` | Sets `body.theme-{theme}` inside the iframe |
| `orientation` | `data-orientation` | `'left' \| 'right'` | `'right'` | Launcher and panel side |
| `brandColor` | `data-brand-color` | color | `'#2563eb'` | Accent color; text contrast derived automatically |
| `name` | `data-name` | string | `'Assistant'` | Header title |
| `avatar` | `data-avatar` | url | — | Header and agent-bubble avatar |
| `placeholder` | `data-placeholder` | string | `'Type a message…'` | Composer placeholder |
| `initialMessages` | `data-initial-messages` | json (string[]) | `[]` | Rendered before any interaction |
| `suggestedMessages` | `data-suggested-messages` | json (string[]) | `[]` | Suggestion chips |
| `signature` | `data-signature` | boolean | `true` | Show the footer credit |
| `autoOpen` | `data-auto-open` | boolean | `false` | Open the panel on mount |
| `collectFeedback` | `data-collect-feedback` | boolean | `false` | Show thumbs up/down on agent messages |
| `collectLeads` | `data-collect-leads` | boolean | `false` | Show the lead form (first name, last name, email, message) |
| `sessionId` | `data-session` | string | generated | Stamped on every lifecycle payload |

---

## 5. `createChatbot(options)`

```js
const bot = createChatbot({
  // --- configuration (§4) ---
  theme: 'light',
  orientation: 'right',
  initialMessages: ['Hi! How can I help?'],
  suggestedMessages: ['Pricing', 'Book a demo'],
  signature: true,
  collectFeedback: false,
  collectLeads: false,

  // --- options ---
  mount: document.body,

  // --- message lifecycle (§6) ---
  beforeSubmitMessage: (draft) => draft,
  onSendMessage: async (message, ctx) => reply,   // REQUIRED
  afterSubmitMessage: (message, reply) => {},

  // --- other lifecycle (§6.6) ---
  onReady, onOpen, onClose, onSuggestionClick,
  onFeedbackSubmit, onLeadSubmit, onMessageError,
});
```

### 5.1 `mount` — optional, defaults to `document.body`

`mount` determines **ownership, not layout**. The launcher and panel are
`position: fixed`, so where they appear comes from CSS and the `orientation`
config. What `mount` decides is which document the widget lives in and what
`destroy()` tears down.

Everything core creates is a descendant of `mount`. That is what makes
`destroy()` writable at all — with the launcher going to `document.body` and
style tags to `document.head`, nothing has a single owner and teardown cannot be
correct.

Accept an attached `Element` only, never a selector string. Resolving selectors
is the caller's job, and a silent `null` from a typo is a bad failure mode.
Throw synchronously if it is not an attached element: that is a programmer
error, and programmer errors should fail loudly and immediately, unlike the
runtime conditions in [§4.3](#43-resolution-rules).

---

## 6. Message lifecycle

Three stages. `before` and `after` are observational; the middle one produces
the reply.

```
user submits
      │
      ├─► beforeSubmitMessage(draft) ────► draft | false
      │        false / throw → nothing renders, composer re-enabled
      │
      ├─► render user bubble, lock composer, show typing indicator
      │
      ├─► onSendMessage(message, ctx) ───► reply | AsyncIterable<chunk>
      │        throw → error bubble + onMessageError
      │
      ├─► render reply, hide typing, unlock composer
      │
      └─► afterSubmitMessage(message, reply)
```

### 6.1 `beforeSubmitMessage(draft)` — optional

```js
draft = { text, messageId, sessionId, timestamp }
```

Return a modified draft to transform it, or `false` to cancel. Runs **before**
the bubble renders, so a cancelled message never appears in the conversation.
May be sync or async.

Uses: trimming, length limits, profanity or PII filtering, attaching page
context to `text`.

### 6.2 `onSendMessage(message, ctx)` — **required**

The one function the consumer must supply. Core is pure UI and state, so it
cannot produce a reply; the developer does the work and returns it.

```js
onSendMessage: async (message, { history, config }) => { … }
```

**Arguments**

- `message` — the (possibly transformed) draft from stage 1, same
  `messageId`.
- `ctx.history` — read-only snapshot of the conversation, so a stateless
  consumer can send context without core knowing how a prompt is shaped.
- `ctx.config` — the current frozen config snapshot, so fields like a language
  or model name can be read without closing over a stale value.

**Return** — any of:

| Return | Behavior |
| --- | --- |
| `string` | Rendered as a single agent message |
| `{ text, suggestions? }` | Rendered; `suggestions` replaces the chip row |
| `AsyncIterable<string \| { text }>` | Streamed into one bubble, chunk by chunk |

Core normalizes all three into the same lifecycle, so streaming versus
non-streaming is invisible to everything downstream.

**Do not default this.** A widget that accepts messages and silently does
nothing is a failure invisible in QA. Throw at construction when it is absent.
Ship `echoReply()` so demos, docs, and tests are not blocked by the
requirement.

**Core never retries.** Retries, backoff, and timeouts belong to the consumer,
because only the consumer knows which failures are safe to repeat.

### 6.3 `afterSubmitMessage(message, reply)` — optional

Fires once the reply is fully rendered. Fire-and-forget: core catches anything
it throws and routes it to `onMessageError`. A failed analytics or persistence
call must never break the chat.

For streamed replies this fires after the last chunk. If a consumer needs the
answer row created earlier, it can do the insert inside `onSendMessage` and the
update in `afterSubmitMessage`.

### 6.4 `messageId` — the correlation key

Core generates a UUID for every message in stage 1 and passes the **same
message object** through all three callbacks.

This single field is the difference between a developer being able to link a
question to its answer in their database and having to match on timestamps.
Treat it as part of the public contract.

### 6.5 Composer lock instead of cancellation

While a reply is in flight, core sets `disabledSubmit` and the composer is
locked. This removes the entire cancellation problem — out-of-order replies,
orphaned in-flight requests — using state the widget already has, with no
`AbortSignal` and no new concept.

If a consumer later needs a stop button, they can build it on the instance API.

### 6.6 Other callbacks

All optional, all fire-and-forget, all wrapped so a throw cannot break the UI.

| Callback | Payload | Notes |
| --- | --- | --- |
| `onReady(bot)` | the instance | Widget mounted and interactive |
| `onOpen()` / `onClose()` | — | Panel visibility changed |
| `onSuggestionClick(text)` | chip text | Return `false` to prevent auto-submit |
| `onFeedbackSubmit(fb)` | `{ messageId, value }` | Only when `collectFeedback` is on |
| `onLeadSubmit(fields)` | `{ firstName, lastName, email, message }` | Only when `collectLeads` is on |
| `onMessageError(error, message)` | the thrown error | After the error bubble is rendered |

### 6.7 Error policy

| Failure | Behavior |
| --- | --- |
| `beforeSubmitMessage` returns `false` or throws | Message discarded, composer re-enabled, nothing rendered |
| `onSendMessage` throws | Error bubble rendered, typing hidden, composer unlocked, `onMessageError` called |
| Any observational callback throws | Caught, routed to `onMessageError`, chat continues |
| Invalid config field | Default substituted, `console.warn` |
| Invalid `mount` / missing `onSendMessage` | Throws synchronously at construction |

The rule: **programmer errors throw at construction; runtime errors degrade
visibly.**

---

## 7. Instance API

```js
bot.open()             // show the panel
bot.close()            // hide the panel
bot.toggle()
bot.submit(text)       // programmatic message, runs the full lifecycle
bot.updateConfig(patch)// re-validate, merge, re-apply DOM effects
bot.getState()         // { open, messages, pending }
bot.destroy()          // remove DOM, unbind listeners, dispose effects
```

Two of these exist for specific, non-optional reasons:

- **`destroy()`** — roughly ten lines, and without it every SPA route change
  leaves an orphaned launcher, orphaned style tags, and live effects running
  against detached nodes on someone else's site.
- **`updateConfig()`** — lets a consumer render immediately from attributes and
  apply remotely-fetched config when it arrives, instead of blocking first
  paint on a network round trip.

`open()` / `close()` matter to embedders who want to trigger the chat from
their own "Need help?" button.

---

## 8. State management

A small SolidJS-style push-based signal store, `src/lib/store/signal.js`. No
virtual DOM, no diffing — effects mutate real nodes.

```js
const [read, write] = createSignal(value);
createEffect(fn);   // runs immediately, re-runs when tracked signals change
createMemo(fn);     // derived read-only signal
```

### 8.1 State the widget owns

| Signal | Drives |
| --- | --- |
| `message` | Composer input value |
| `disabledSubmit` | Send button and input lock (see [§6.5](#65-composer-lock-instead-of-cancellation)) |
| `chatVisible` | `.visible` class on the shell container |
| `conversation` | Message list, typing indicator |

### 8.2 Required store properties

These are not optional polish; each one causes a concrete defect if missing.

- **Equality check** — `createSignal(value, { equals })`, skipping the write
  when unchanged. Without it, `setMessage` re-runs effects on every keystroke
  that produces the same value.
- **Batching** — `batch(fn)` so writing `conversation` and `disabledSubmit`
  together causes one effect pass, not two.
- **Disposal** — an ownership scope (`createRoot(dispose => …)`) plus support
  for cleanup functions returned from effects. Without this, a destroyed
  widget's effects keep firing against detached nodes. `destroy()` calls the
  root's dispose.
- **Error isolation** — `try`/`finally` around effect execution so one throwing
  effect cannot corrupt the module-level tracking stack.
- **Conditional dependency tracking** — a signal first read inside an `if`
  branch on a later run must be tracked from then on. This has a dedicated
  regression test.

### 8.3 Lists are appended, not diffed

Do not have one effect read the whole `conversation()` array and infer which
items are new — that is hand-rolled diffing and it is where a no-VDOM design
becomes fragile.

Either implement a keyed list helper (`mapArray`) once in the store and use it
for both messages and suggestions, or keep signals for genuinely declarative
state and let the append path call `messageWrapper.appendMessage()` directly.

**Never use one signal as both state and an event bus.**

---

## 9. Component convention

One class per UI piece, all following the same shape:

```js
class Composer {
  constructor(props) { this.props = props; this.listeners = []; this.build(); }
  build()   { /* create this.element, bind listeners via this.on() */ }
  on(node, event, handler) { node.addEventListener(event, handler); this.listeners.push([node, event, handler]); }
  destroy() { this.listeners.forEach(([n, e, h]) => n.removeEventListener(e, h)); this.element.remove(); }
}
```

Three rules:

1. Constructor takes props, calls `build()`, exposes `this.element` (root node).
2. **Every component implements `destroy()`**, and listeners are registered
   through a bookkeeping helper so they can actually be removed. Handlers bound
   directly in `build()` are never cleaned up.
3. Container components encapsulate their children rather than letting external
   code reach in: `MessageWrapper.appendMessage()` / `.showTyping()` /
   `.hideTyping()`, `SuggestionWrapper.addSuggestion()`.

This is a documented convention, not a base class or framework runtime.

---

## 10. Rendering model

### 10.1 Two documents

The widget spans the host page and an iframe, so its CSS is split accordingly.

| File | Injected into | Covers |
| --- | --- | --- |
| `src/style.css` | The **iframe's** `<head>` | Everything the components render: reset, `.wrapper`, `.thead-*`, `.message-*`, `.composer-*`, `.suggestion-*`, `.signature-*`, `.typing`, and both `body.theme-light` / `body.theme-dark` |
| `src/shell.css` | The **host page** `<head>` | Only the two host-page nodes: `.launcher` (fixed, `.left`/`.right`) and the iframe container (collapsed/`.visible` transition, full-screen on mobile) |

The chat UI renders inside a same-origin iframe, which sandboxes the widget's
DOM **and** its styles from whatever CSS and JS the host page has. That is why
the widget looks the same on every site it is embedded on. Shadow DOM would
isolate CSS but not JS.

### 10.2 Mount sequence

1. Validate options, resolve and freeze config, throw on programmer errors
2. Create the shell container inside `mount`; inject `shell.css`
3. Create the iframe inside the container
4. Wait for `iframe.contentWindow.document`; inject charset meta, viewport
   meta, `style.css`; set `body.theme-{theme}`
5. Create the signal scope and all state
6. Compose components into the iframe body; append the launcher to the shell
   container (**not** `document.body`, so ownership stays under `mount`)
7. Bind visibility and conversation effects
8. Call `onReady(bot)`

Nothing here is asynchronous except step 4, which resolves against a local
document — no network, so mount cannot fail on a slow connection.

### 10.3 Lazy iframe

Create the iframe on first launcher click rather than on mount. On pages where
nobody opens the chat, that avoids building a whole document per page load.

---

## 11. HTML tag usage

**One primitive, thin adapters over it.** `createChatbot()` is the primitive.
The tag is an adapter that reads DOM and calls it. There must never be two
independent boot paths, or every feature gets implemented twice and they drift.

Core owns the tag **contract** — the tag name, `CONFIG_SCHEMA`,
`parseAttributes(element)` — because the schema must live next to the code that
reads the fields.

Core does **not** auto-boot from the tag, because booting requires
`onSendMessage`. Registration is also a global side effect, so core exports the
definition and the consumer registers it:

```js
// core
export function defineChatElement({ onSendMessage, tagName = 'ss-chat', ...rest }) {
  customElements.define(tagName, class extends HTMLElement {
    static get observedAttributes() { return CONFIG_SCHEMA.map(f => f.attribute); }
    connectedCallback()    { this._bot = createChatbot({ ...resolveConfig([parseAttributes(this)]), ...rest, onSendMessage, mount: this }); }
    disconnectedCallback() { this._bot?.destroy(); }
    attributeChangedCallback() { this._bot?.updateConfig(resolveConfig([parseAttributes(this)])); }
  });
}
```

A real custom element rather than a one-time tag scan buys three things:

- Tags added later by an SPA framework boot automatically
- Removal from the DOM triggers `destroy()` — the leak is fixed structurally
  rather than by discipline
- Live attribute edits become `updateConfig()` calls

In CDN mode this is `SsChat.defineChatElement({ onSendMessage })` — the same
call, so a plain `<script>` page with no build step gets the declarative tag
too. Because script order is not guaranteed under `defer`, use the ordering
queue from [§17.2](#172-load-ordering) rather than calling it inline:

```html
<script>
  window.ssChat = window.ssChat || [];
  ssChat.push(['defineChatElement', { onSendMessage: (msg) => myBackend.ask(msg.text) }]);
</script>
<script src="https://cdn.jsdelivr.net/npm/@suppsalism/chatbot@1/dist/chatbot.umd.js" defer></script>
<ss-chat data-theme="dark"></ss-chat>
```

---

## 12. What is deliberately not in this package

Record these so nobody adds them later:

`apiUrl` · `chatbotKey` · `endpoints` · `retries` · `timeout` ·
`onMessageSaved` · `authToken` · any hardcoded hostname

Each would be the first crack in the boundary. Presentation and behavior
settings (`theme`, `orientation`, `autoOpen`, `signature`) are not options
either — they are configuration, per the rule in [§2](#2-the-boundary-rule).

### The consuming layer, in full

Everything a connected product needs, on the flat callbacks above:

```js
import { createChatbot, parseAttributes, resolveConfig } from '@suppsalism/chatbot';

const attrs = parseAttributes(document.querySelector('ss-chat'));

const bot = createChatbot({
  ...resolveConfig([attrs]),

  onSendMessage: (msg) => postChat(attrs.key, msg.text),

  afterSubmitMessage: (msg, reply) => {
    saveMessage({ id: msg.messageId, role: 'user',  text: msg.text });
    saveMessage({ replyTo: msg.messageId, role: 'agent', text: reply.text });
  },

  onLeadSubmit:     (fields) => saveLead(attrs.key, fields),
  onFeedbackSubmit: (fb)     => saveFeedback(attrs.key, fb),
});

// Render first, reconcile when remote config lands — never block first paint
fetchConfig(attrs.key).then(remote => bot.updateConfig(resolveConfig([attrs, remote])));
```

Remote config, merge precedence, persistence, feedback, leads — all of it, and
core still knows no URL.

---

## 13. Package structure

```
src/
├── index.js                 # named exports only — no side effects (npm entry)
├── umd.js                   # CDN entry: imports ./index.js, attaches window.SsChat
│                            #   the ONLY file permitted to touch `window`
├── chatbot.js               # createChatbot: orchestration + instance API
├── config/
│   ├── schema.js            # CONFIG_SCHEMA — single source of truth
│   ├── parse-attributes.js  # DOM → partial config
│   └── resolve.js           # layered merge + validation
├── mount/
│   ├── shell.js             # container + shell.css injection
│   └── iframe.js            # iframe creation + head injection
├── element.js               # defineChatElement
├── lifecycle.js             # callback invocation + error wrapping
├── store/
│   └── signal.js            # createSignal / createEffect / createMemo / batch / createRoot
├── component/               # one class per UI piece, each with .element + destroy()
├── helper.js                # uuid, color contrast, type coercion
├── style.css                # → iframe head
└── shell.css                # → host page head
```

`index.js` re-exporting is the standard shape, not a shim. Splitting is what
makes the config layer independently testable and lets bundler consumers
tree-shake what they do not use. Banner comments marking sections of one large
file are that file asking to be a directory.

**Do not split further yet.** The tempting next cut is a headless core beneath
a DOM layer. Wait until there is a second real consumer of the headless layer —
a React wrapper, a native shell. A package born from a diagram instead of from
a second consumer costs a version boundary and buys nothing.

---

## 14. Build and distribution

Two entries, two `microbundle` runs, one `npm run build`:

```json
"build:lib": "microbundle -i src/index.js --format cjs,es,modern --css inline",
"build:umd": "microbundle -i src/umd.js  --format umd --name SsChat --css inline",
"build":     "npm run build:lib && npm run build:umd"
```

| Output | Built from | `package.json` field | Consumer |
| --- | --- | --- | --- |
| `chatbot.cjs` | `index.js` | `main`, `exports.require` | Node `require()` |
| `chatbot.module.js` | `index.js` | `module` | Bundlers |
| `chatbot.modern.js` | `index.js` | `exports.default` | Modern ES |
| `chatbot.umd.js` | `umd.js` | `unpkg` | CDN `<script>` |

Only the UMD build comes from `src/umd.js`, which is why the three library
formats stay free of `window` access and remain SSR-safe.

Inject the version from `package.json` at build time (`--define` or a plugin) so
`SsChat.version` cannot lie. That value is the first thing to ask for in any
support conversation.

Also required in `package.json`: `sideEffects: false`, an explicit `files`
array, `types`, and `exports` covering `"."` and `"./style.css"`. Keep these
correct from the start even though CDN consumers never use them — they are
awkward to retrofit once versions are pinned in production.

Ship type declarations. TypeScript conversion is not needed — JSDoc plus
`tsc --allowJs --declaration --emitDeclarationOnly` generates them from the
existing JavaScript, and the config half can be generated from
`CONFIG_SCHEMA`.

---

## 15. Testing requirements

**Vitest**, `environment: 'jsdom'`, `setupFiles: ['./tests/setup.js']` (which
polyfills `Element.prototype.scrollIntoView` — jsdom does not implement it and
auto-scroll would throw). Tests live in a top-level `tests/` directory
mirroring `src/`.

Priority order, highest value first:

1. **`store/signal.js`** — read/write/effect/memo, plus dedicated regression
   tests for conditional dependency tracking, equality skipping, batching, and
   disposal.
2. **`config/`** — attribute parsing per type, merge precedence, invalid-value
   fallback, unknown-key retention, `null` stripping.
3. **The lifecycle contract** — the full three-stage flow with a stubbed
   `onSendMessage`: cancellation via `beforeSubmitMessage`, `messageId`
   identity across all three callbacks, streaming and non-streaming replies,
   composer lock and unlock, error path, throwing observers not breaking the
   chat.
4. **`createChatbot` + mount** — jsdom handles same-origin `about:blank` iframe
   `contentWindow.document` well enough to test this, and it is where refactors
   break things.
5. **`destroy()`** — assert no DOM nodes and no live effects remain, and that
   effects do not fire after disposal. This is the test that keeps SPA
   consumers working.
6. **Build smoke test** — load each of the four `dist` artifacts, assert the
   CSS string is present and nothing crashes. The `--css inline` defect was a
   build bug that no unit test would ever have caught. Add `publint` and
   `attw` to CI.
7. **npm/CDN parity test** ([§17.4](#174-enforcing-parity)) — assert the global's key set matches the
   module's named exports. Run against the built artifacts, not the source.

Component unit tests are the lowest priority. Nearly all of them assert that a
`build()` produced the expected nodes, which is the least likely thing to
regress.

---

## 16. Public API surface

Once anything depends on this package, the following are **breaking changes**:

- Renaming or removing a lifecycle callback
- Changing a payload field name or shape (`messageId`, `draft`, `reply`)
- Changing `onSendMessage` return handling
- Removing or renaming an instance method
- Renaming a config field or its attribute
- Changing merge precedence semantics
- Renaming or removing a key on `window.SsChat`, or renaming the global itself

Additive changes — new config fields, new optional callbacks, new accepted
return shapes — are safe. Evolve the lifecycle additively only.

Because one distribution is a CDN script on pages you do not control, version
pinning is part of the contract: publish pinnable exact versions (`@1.2.3`)
alongside a `@1` major alias, and never change behavior within a major.

---

## 17. CDN distribution

Everything in [§4](#4-configuration)–[§10](#10-rendering-model) applies unchanged. This section covers **only** what is
mechanically different about the CDN build. There is no separate structure or
flow: one config schema, one lifecycle, one instance API, documented once.

### 17.1 The global

`src/umd.js` is the whole of it — roughly fifteen lines, and the only file in
the package permitted to touch `window`:

```js
import * as api from './index.js';

if (window.SsChat && window.SsChat.version !== __VERSION__) {
  console.warn(`[ss-chat] ${window.SsChat.version} already loaded; skipping ${__VERSION__}`);
} else {
  window.SsChat = Object.freeze({
    ...api,                 // every named export, same names
    version: __VERSION__,
    instances: [],
    get: (id) => window.SsChat.instances.find(b => b.id === id),
  });
  drainQueue(window.ssChat);
}
```

Spreading `api` rather than listing keys by hand means a new export appears on
the global automatically — the mirroring is mechanical, not maintained.

Three constraints:

- **Freeze it, and attach nothing internal.** On a global, everything reachable
  is public. Attach the signal store or component classes and someone will
  depend on `SsChat._signal`, and you can never refactor.
- **`version` is mandatory.** Every support conversation starts with which
  version is loaded, and the console is the only place to find out.
- **Guard double-load.** Warn and no-op rather than clobber. This happens for
  real when a customer's site has two plugins that each embed a widget.

### 17.2 Load ordering

Script order is not guaranteed under `defer`, so a page cannot assume
`SsChat` exists when its own inline script runs. Push to an array instead —
safe before the bundle loads, drained on init:

```html
<script>
  window.ssChat = window.ssChat || [];
  ssChat.push(['defineChatElement', { onSendMessage: (msg) => myBackend.ask(msg.text) }]);
</script>
<script src="https://cdn.jsdelivr.net/npm/@suppsalism/chatbot@1/dist/chatbot.umd.js" defer></script>
```

Each entry is `[methodName, ...args]` and is applied against the frozen global
in push order. Same pattern as GA and Intercom, so it is already familiar to
anyone who has embedded a widget.

`window.ssChat` (the lowercase queue) and `window.SsChat` (the frozen API) are
distinct on purpose. Do not merge them.

### 17.3 Types without a bundler

CDN consumers still get autocomplete. Ship the declarations, declare the global,
and let them install the package for types only:

```ts
declare global { interface Window { SsChat: SsChatApi } }
```

```bash
npm i -D @suppsalism/chatbot   # types only; runtime comes from the CDN
```

### 17.4 Enforcing parity

Intent is not enough — add an export and forget the global once and the two
modes diverge silently. This test makes divergence a CI failure:

```js
import * as lib from '../dist/chatbot.module.js';
import '../dist/chatbot.umd.js';

test('the window global exposes exactly the module exports', () => {
  const cdnOnly = ['version', 'instances', 'get'];
  expect(Object.keys(window.SsChat).filter(k => !cdnOnly.includes(k)).sort())
    .toEqual(Object.keys(lib).sort());
});
```

### 17.5 What cannot be mirrored

Document these rather than papering over them — a developer expecting total
parity who hits one will assume something is broken.

| Concern | npm | CDN |
| --- | --- | --- |
| Ordering | deterministic: `import`, then call | `window.ssChat.push([...])` queue |
| Version | lockfile | `SsChat.version`, pinned URL |
| Double load | impossible | guard required ([§17.1](#171-the-global)) |
| Tree-shaking | `sideEffects: false` applies | irrelevant, whole bundle ships |
| Types | resolved from the package | same `.d.ts` via `declare global` ([§17.3](#173-types-without-a-bundler)) |
| SSR | safe — no side effects on import | not applicable, browser only |

### 17.6 Documentation policy

Forked getting-started pages are fine. **Forked API reference pages are not** —
that is where drift first becomes visible to users. One options reference, one
lifecycle reference, one set of examples, with the acquisition step shown twice
at the top of the page.

A genuinely separate document is warranted when the *audience* differs, not when
the syntax differs: a copy-paste embed guide for non-developers belongs in the
connected package, where there is no API to document at all.