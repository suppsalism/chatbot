# Core contract

This document specifies the public contract of `@suppsalism/chatbot` as a
**pure UI/state engine**: the factory API, the config shape, the `transport`
port, the lifecycle event system, and the plugin contract. It is written
*before* any implementation change, per the agreed sequencing - everything
in `core.js` should eventually be derived from this document, not the other
way around.

**Out of scope for this package: anything that knows a URL.** That's it -
fetching remote config and calling a chat API (sending/receiving a
message) are the only things that leave. "Pure UI/state engine" does
**not** mean no iframe, no positioning, no launcher, no tag-scanning -
those are UI/DOM composition mechanics, not business logic, and they stay
in this package. Both of the following are part of `@suppsalism/chatbot`
and both trigger the exact same internal composition (iframe, positioning,
launcher, everything):

1. `import { createChatbot } from '@suppsalism/chatbot'; createChatbot({ ... })`
   - programmatic, full control, can supply real functions (`transport`,
   plugins).
2. A `<script>` tag (CDN/UMD build) + a bare `<ss-chat data-*="...">` tag
   in the host's HTML, zero JS required. The script scans for the tag on
   load, builds config via `parseAttributes`/`resolveConfig`, and calls the
   exact same `createChatbot()` internally - see §9.

`transport` is **optional** (§3) specifically so path 2 still produces a
fully working, fully composed widget with zero JS: HTML attributes can't
carry a function, so the zero-JS path necessarily runs without one unless
a companion script also calls `createChatbot()`/`updateConfig()` to attach
one later.

Sections marked **⚠ Decision needed** are still-open judgment calls; **Deferred**
marks something intentionally left out of the current implementation pass,
not forgotten.

---

## 1. Public factory & instance API

```js
import { createChatbot } from '@suppsalism/chatbot';

const bot = createChatbot({
  mount,          // optional: host-page node the launcher/container mount into. Defaults to document.body - createChatbot builds its own iframe internally regardless.
  transport,      // optional: see §3. Omitted -> submit() still runs, emits response:error instead of calling anything.
  config,         // required: a pre-resolved config object, see §2 - core does NOT fetch
  sessionId,      // required: string, identifies the visitor across the widget's lifetime
  conversationId, // optional: string, defaults to sessionId if omitted (see §2.3)
  plugins,        // optional: array, see §5
});
```

Calling `createChatbot()` never makes a network call and never throws for
lack of a `<ss-chat>` tag - there is no tag scanning inside it at all, and
it always builds its own iframe/container/launcher rather than assuming
anything about where it's being called from. Merely *importing*
`@suppsalism/chatbot`'s primary entry does still run a guarded, deferred
auto-init check (§9) - same as it does today - so it assumes a
browser-like `document` global is present at load time; it does not assume
a `<ss-chat>` tag exists.

### Instance API

| Method | Signature | Behavior |
| --- | --- | --- |
| `open()` | `() => void` | Sets visibility true. Emits `chat:open` if it changed. |
| `close()` | `() => void` | Sets visibility false. Emits `chat:close` if it changed. |
| `toggle()` | `() => void` | Flips visibility. Emits `chat:open` or `chat:close` accordingly. |
| `submit(text)` | `(text: string) => Promise<void>` | Runs the full send flow (§4). Resolves once the reply is committed or rejects if `beforeSubmit` blocked it or the transport threw. |
| `updateConfig(patch)` | `(patch: Partial<Config>) => void` | Shallow-merges `patch` into the current config, re-renders whatever changed, emits `config:updated`. |
| `getState()` | `() => ChatbotState` | Returns a **cloned, frozen** snapshot - never a live reference to internal signals. |
| `on(event, fn)` | `(event: string, fn: (payload) => void) => () => void` | Subscribes an observer at runtime (in addition to plugin-registered ones). Returns an unsubscribe function. |
| `destroy()` | `() => void` | Emits `destroy`, disposes every signal effect, removes all DOM nodes this instance created, then calls each plugin's `destroy()` (§5.3). |

```ts
interface ChatbotState {
  open: boolean;
  draft: string;
  submitDisabled: boolean;
  messages: ConversationMessage[];
  config: Config;
}

interface ConversationMessage {
  messageId: string;
  role: 'user' | 'agent';
  text: string;
  avatar?: string;
  typing?: boolean;
  seq: number;
  timestamp: number;
}
```

**Deferred:** `role: 'user' | 'agent'` is the eventual semantic replacement
for today's presentation-only `position: 'left' | 'right'`, but this
specific rename is not part of the current implementation pass (too much
surface area to bundle into an already-large change) - `position` stays as
today's field for now. Documented here so it isn't forgotten as a
follow-up.

---

## 2. Config contract

### 2.1 What moved out of config

`chatbot_key` is **removed from core's config entirely**. It was only ever
used to build an API URL - a pure networking concern that no longer touches
this package. Wherever the host constructs `transport`, it's the host's
job to capture whatever key/credentials that transport needs, as a closure
- core never sees it.

**⚠ Decision needed:** `sessionId` / `conversationId` are **not** part of
`config` - they're separate top-level `createChatbot()` options. Reasoning:
they're identity/correlation concerns for the lifecycle system (§4), not
presentational settings. Keeping them out of `config` also means
`updateConfig(patch)` can never accidentally change a message's session
identity mid-conversation.

### 2.2 `CONFIG_SCHEMA` (presentational fields only)

| Field | Type | Default |
| --- | --- | --- |
| `displayName` | `string` | — |
| `initialMessages` | `string[]` | `[]` |
| `suggestedMessages` | `string[]` | `[]` |
| `messagePlaceholder` | `string` | `''` |
| `textFooter` | `string` | `''` |
| `brandColor` | `string` | — |
| `brandName` | `string` | — |
| `brandLogo` | `string` | — |
| `launcherLogo` | `string` | — |
| `theme` | `'light' \| 'dark'` | `'light'` |
| `orientation` | `'left' \| 'right'` | `'right'` |
| `signatureVisible` | `boolean` | `true` |
| `collectUserFeedback` | `boolean` | `false` |
| `regenerateMessage` | `boolean` | `false` |

`collectUserFeedback` and `regenerateMessage` are **reserved** - they gate
the `feedback:submitted` observer event and a future regenerate-response
UI, neither implemented yet. Their presence in the schema now means the
contract doesn't need a breaking change when they land.

Field names are camelCase, unlike the snake_case config fields in the
current codebase. That earlier snake_case choice existed specifically
because core used to spread a live, unverified API response directly into
its own config - now that core makes no API call at all, that risk is
gone outright, not just mitigated, so the fields follow the rest of the
codebase's camelCase convention with no caveat needed. `suggested_message`
also becomes plural `suggestedMessages`, matching its actual array type.

### 2.3 Exports

```js
export const CONFIG_SCHEMA;                 // field -> { type, default }, no dataset/API knowledge
export function parseAttributes(element);    // DOM element -> partial Config. Given the element - never finds it.
export function resolveConfig(sources);      // sources: Partial<Config>[], low precedence -> high. Returns validated Config.
```

- `resolveConfig` applies `CONFIG_SCHEMA` defaults as the implicit lowest
  layer, then `Object.assign`s each source in the array over it in order -
  the host decides how many sources exist and their order (e.g.
  `resolveConfig([attrs])` for first paint, `resolveConfig([attrs,
  remoteConfig])` once a fetch resolves).
- Validates the result against `CONFIG_SCHEMA` (types, no unknown-required
  gaps) and throws a `ConfigValidationError` with a field-level message on
  failure - this is the one place core throws synchronously, since it's a
  programming-time integration error, not a runtime/network one.
- If `conversationId` is omitted from `createChatbot()`, core defaults it
  to equal `sessionId`. There is no "start a new conversation" API yet;
  the two fields are kept distinct in every payload so that a future
  capability doesn't need a breaking event-shape change.

---

## 3. Transport port

`transport` is **optional**. If `createChatbot()` is called without one
(always true for the zero-JS `<ss-chat>`-tag-only path, §9; possibly true
for a programmatic call too, e.g. a storybook/demo build), the widget still
fully composes, renders, and is interactive - `submit()` still runs
`beforeSubmit` and commits/emits `message:submitted`, then immediately
emits `response:error` with `{ error: { name: 'NoTransportConfiguredError',
message: 'No transport configured' } }` instead of calling anything. No
built-in HTTP of any kind ever runs in its place.

```ts
type Transport = (
  draft: Draft,
  ctx: { signal: AbortSignal }
) => AsyncIterable<string> | Promise<TransportResult>;

interface Draft {
  text: string;
  meta?: Record<string, unknown>; // free-form, e.g. page context a plugin attached in beforeSubmit
  messageId: string;
  conversationId: string;
  sessionId: string;
  seq: number;
  timestamp: number;
}

interface TransportResult {
  text: string;
  [key: string]: unknown; // implementers may attach extra fields; core reads only `text`
}
```

- **Non-streaming:** return a `Promise<TransportResult>`. Core treats the
  resolved `text` as a single chunk followed immediately by completion.
- **Streaming:** return (or `async function*`) an `AsyncIterable<string>`.
  Each yielded string is a chunk of reply text, emitted as `response:chunk`
  and appended live to the message bubble. `response:complete` fires once
  the iterable finishes, with the full concatenated text.
- **Cancellation:** `ctx.signal` is an `AbortSignal`. Core aborts it if the
  widget is destroyed mid-response, or (future) if a "stop generating"
  control is added. A transport implementation should stop yielding/reject
  promptly once `signal.aborted` is true.
- **Errors:** a thrown/rejected transport (sync throw, rejected promise, or
  a stream that throws mid-iteration) is caught by core and turned into
  `response:error` - never an uncaught exception, never a broken UI.
- Correlation ids (`messageId`, `conversationId`, `sessionId`, `seq`) live
  on `draft`, generated by core, and must not be mutated by an interceptor
  - only `text` and `meta` are transformable.

**Non-goal for this version:** structured/rich streaming (citations,
attachments arriving mid-stream). `AsyncIterable<string>` is text-only.
Extending it later (e.g. a final `{ done: true, meta }` sentinel) is an
additive change, not a breaking one, so it's deliberately left out now.

---

## 4. Send flow (what `submit()` actually does)

1. Core builds a `Draft` (new `messageId`, current `conversationId` /
   `sessionId`, next `seq`, `timestamp: Date.now()`, `text`, `meta: {}`).
2. If a `beforeSubmit` interceptor is registered, it's awaited with the
   draft.
   - Returns a `Draft` -> use it (possibly rewritten `text`/`meta`) going
     forward.
   - Returns `false` -> the submit is cancelled. Nothing is added to
     conversation state, transport is never called, `submit()`'s promise
     rejects with a `SubmitBlockedError`. No observer event fires for a
     blocked submit in this version (see open question in §7).
   - Throws -> the submit fails **visibly**: `submit()` rejects, the
     composer's disabled state is not engaged, no message is added.
3. The (possibly transformed) user message is added to conversation state
   and rendered. `message:submitted` fires.
4. `response:start` fires (`replyTo: messageId`). If no `transport` was
   configured, `response:error` fires immediately
   (`NoTransportConfiguredError`, §3) and the flow ends here. Otherwise
   `transport(draft, ctx)` is called.
5. Streaming: each chunk fires `response:chunk` and is appended to a
   pending "typing" bubble. Non-streaming: skipped, straight to step 6.
6. On settlement, the final text runs through `beforeRender` if
   registered, is committed to conversation state, and `response:complete`
   fires.
7. On failure at any point in steps 4-6, `response:error` fires and
   `submit()`'s promise rejects.

---

## 5. Lifecycle events

### 5.1 Base payload

Every event payload includes:

```ts
interface BaseEventPayload {
  sessionId: string;
  conversationId: string;
  timestamp: number;
}
```

Message-scoped events additionally include:

```ts
interface MessageScopedPayload extends BaseEventPayload {
  messageId: string;
  seq: number; // monotonic per conversation, per individual message (not per turn)
}
```

All payloads are deep-frozen and passed as fresh clones per handler - an
observer cannot mutate state that another observer or core itself will
read afterward.

### 5.2 Interceptors (awaited, at most one registrant per stage)

| Stage | Signature | Can cancel? |
| --- | --- | --- |
| `beforeSubmit` | `(draft: Draft) => Draft \| false \| Promise<...>` | Yes - return `false` |
| `beforeRender` | `(message: ConversationMessage) => ConversationMessage \| Promise<...>` | No - transform only |

Registering a second `beforeSubmit` or `beforeRender` across the plugin
array throws at `createChatbot()` time - fail fast rather than silently
overwrite.

**⚠ Decision needed:** `beforeRender` is intentionally non-cancelable.
Blocking a user's *outgoing* message (via `beforeSubmit`) is a
well-understood pattern (spam/PII filters); silently dropping the AI's
*response* via the same falsy-return convention felt like a much easier
footgun to hit by accident. If "suppress this response" turns out to be a
real need, it should be its own explicit capability later, not an overload
of this hook.

### 5.3 Observers (fire-and-forget, many per event, isolated errors)

| Event | Fires when | Payload (beyond base) |
| --- | --- | --- |
| `session:start` | once, when `createChatbot()` finishes constructing | — |
| `chat:open` | visibility becomes `true` | — |
| `chat:close` | visibility becomes `false` | — |
| `message:submitted` | user message committed to state (post-`beforeSubmit`) | `{ text }` |
| `response:start` | transport is about to be called | `{ replyTo: messageId }` |
| `response:chunk` | one streamed chunk (streaming transports only) | `{ replyTo, chunk: string, index: number }` |
| `response:complete` | reply committed to state | `{ replyTo, text: string }` |
| `response:error` | transport failed | `{ replyTo, error: { name?: string, message: string } }` |
| `suggestion:clicked` | a suggestion chip is clicked, before the resulting `submit()` | `{ text }` |
| `feedback:submitted` | *(reserved, gated by `collectUserFeedback`; no UI yet)* | `{ replyTo, rating: 'up' \| 'down', comment?: string }` |
| `lead:submitted` | *(reserved; no UI yet)* | `{ fields: Record<string, string> }` |
| `config:updated` | after `updateConfig(patch)` applies | `{ patch: Partial<Config>, config: Config }` |
| `destroy` | `bot.destroy()` called, before teardown | — |

Errors are never raw `Error` objects on the wire - always `{ name?,
message }`, since observers may serialize/ship payloads over a network.

---

## 6. Error handling summary

| Failure | Behavior |
| --- | --- |
| `beforeSubmit` throws | Send fails visibly; `submit()` rejects; nothing added to state. |
| `beforeSubmit` returns `false` | Send cancelled; `submit()` rejects with `SubmitBlockedError`; nothing added to state. |
| `beforeRender` throws | Treated the same as a transport error: `response:error` fires, the raw (untransformed) text is **not** committed - a broken render hook must not surface unsanitized content. |
| Transport throws/rejects/stream errors | `response:error` fires; `submit()` rejects; UI re-enables the composer. |
| An observer throws | Caught, never propagates. Emits `error` with `{ source: 'observer', event, error }`. All other observers for that event still run. |
| A plugin's setup function throws (the outer `(bot) => ({...})` call) | **Not** caught - `createChatbot()` fails entirely. A broken plugin wiring is a build-time bug, not a runtime one. |
| A plugin's `destroy()` throws | Caught, logged via `error` with `{ source: 'plugin:destroy', pluginIndex, error }`. Other plugins' `destroy()` still run - teardown is best-effort. |

`bot.on('error', fn)` is how a host observes any of the isolated failures
above without them affecting the chat itself.

---

## 7. Plugin contract

```ts
type Plugin = (bot: ChatbotInstance) => {
  interceptors?: {
    beforeSubmit?: Interceptor<Draft>;
    beforeRender?: Interceptor<ConversationMessage>;
  };
  observers?: Partial<Record<ObserverEvent, (payload) => void | Promise<void>>>;
  destroy?: () => void | Promise<void>;
};
```

- `plugins` is an ordered array. Each plugin function is called once,
  synchronously, during `createChatbot()`, with the full instance API
  (§1) - a plugin can call `bot.submit()`/`bot.updateConfig()`, not just
  observe.
- Observers with the same event name from multiple plugins all run, in
  plugin-array order.
- `destroy()` runs in **reverse** plugin-array order on `bot.destroy()`
  (last set up, first torn down) - each plugin's failure to tear down is
  isolated (§6).

---

## 8. Versioning & stability

- This contract is versioned independently of the widget's visual
  components. A breaking change here breaks every host that depends on
  `@suppsalism/chatbot`.
- **Additive-only evolution once this ships:** new events, new optional
  payload fields, and new config fields are non-breaking. Renaming or
  removing an existing event/field/method is breaking, full stop.
- Recommend a contract test suite in this repo (asserting the exact
  payload shape of every event, the exact error-isolation behavior in §6,
  and the plugin ordering rules in §7) that any host package can also run
  against its own integration.

---

## 9. Zero-JS integration path (`<ss-chat>` tag + script)

The CDN/UMD build's entry does this on load, guarded by
`document.readyState` (deferred to `DOMContentLoaded` if the document is
still loading, matching today's `bootstrap`/`autoStart`):

1. Scan for the first `<ss-chat>` element. If none is found, do nothing -
   this must never throw uncaught, since the same build artifact is what
   gets imported by tests.
2. `parseAttributes(element)` -> a partial `Config`.
3. `resolveConfig([attrs])` -> a validated `Config` (no API layer to merge
   in - there's no remote fetch in this path at all).
4. Call `createChatbot({ config, sessionId })` - the **same function**
   §1's programmatic path calls. No `transport` is passed (HTML attributes
   can't carry a function), so this path always runs in the "no transport
   configured" mode from §3 unless something else later attaches one.

This is why both integration methods in the intro section are described as
triggering identical composition: they're not two implementations of the
same idea, they're the same function called from two different places.

---

## Open questions (flagged, not settled)

1. Should a `beforeSubmit`-blocked message emit any observer event (e.g.
   `message:blocked`) so analytics can see it happened? Currently: no
   event fires, only the rejected `submit()` promise.
2. Plugin `destroy()` order is specified as reverse-of-setup here - confirm
   that's the intended convention.
3. `getState()` returns a frozen clone - confirm that's an acceptable cost
   (a deep clone on every call) versus a cheaper shallow-frozen shape.
