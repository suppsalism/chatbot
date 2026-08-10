# @suppsalism/chatbot

A pure UI and state engine for a chat widget. Give it a config and an
`onSendMessage` function, and it composes the widget, renders it, manages
every interaction, and hands you a message lifecycle to hook your own
backend into.

It has **zero runtime dependencies** and knows nothing about HTTP, URLs,
databases, authentication, or any specific chat backend. You bring the
model or API call — this package brings the UI, the state, and the
plumbing between them.

## Table of contents

- [Why this package](#why-this-package)
- [Install](#install)
- [Quick start](#quick-start)
- [The HTML tag](#the-html-tag)
- [Configuration](#configuration)
- [The message lifecycle](#the-message-lifecycle)
- [Other callbacks](#other-callbacks)
- [Instance API](#instance-api)
- [Styling](#styling)
- [CDN usage](#cdn-usage)
- [TypeScript](#typescript)
- [What's deliberately not in this package](#whats-deliberately-not-in-this-package)
- [Browser support](#browser-support)
- [Development](#development)
- [Versioning](#versioning)
- [License](#license)

## Why this package

Most chat widgets bundle a UI *and* a backend integration together, so
adopting one means adopting its network layer, its auth model, and its
opinions about where your data lives. This package draws a hard line
instead:

> If it survives `JSON.stringify`, it's configuration. If it doesn't
> (a function, a DOM node), it's an option you pass in.

That means themes, copy, and feature flags are plain serializable config —
safe to generate from a dashboard or `data-*` attributes — while sending a
message, persisting it, and authenticating the request are entirely your
code, supplied as a callback. No API keys, endpoints, or base URLs ever
appear in this package's config, and it never makes a network call of any
kind.

## Install

```bash
npm install @suppsalism/chatbot
```

```js
import { createChatbot } from '@suppsalism/chatbot';
```

Importing has no side effects — it's safe under Node, SSR, and in tests.
Nothing renders until you call `createChatbot()`.

## Quick start

```js
import { createChatbot } from '@suppsalism/chatbot';

const bot = createChatbot({
  name: 'Assistant',
  initialMessages: ['Hi! How can I help?'],
  suggestedMessages: ['Pricing', 'Book a demo'],

  // The one function you must supply — core is pure UI, it can't produce
  // a reply on its own.
  onSendMessage: async (message, { history, config }) => {
    const response = await fetch('/api/chat', {
      method: 'POST',
      body: JSON.stringify({ text: message.text, history }),
    });
    const { reply } = await response.json();
    return reply;
  },
});
```

That's it — a launcher and panel are mounted into `document.body`, and
every submitted message runs through `onSendMessage`. No demo blocked on
writing a backend first: swap in the bundled `echoReply` while you build
the real one:

```js
import { createChatbot, echoReply } from '@suppsalism/chatbot';

createChatbot({ onSendMessage: echoReply });
```

## The HTML tag

For a no-build, declarative setup, register the `<ss-chat>` custom
element once and drop the tag anywhere in your markup:

```js
import { defineChatElement } from '@suppsalism/chatbot';

defineChatElement({
  onSendMessage: (message) => fetch('/api/chat', { /* ... */ }).then((r) => r.json()),
});
```

```html
<ss-chat data-theme="dark" data-orientation="left" data-name="Assistant"></ss-chat>
```

Every config field has a matching `data-*` attribute (see the table
below). Tags added later by a framework boot automatically, removing a
tag from the DOM calls `destroy()`, and editing an attribute live calls
`updateConfig()` — it's a real custom element, not a one-time page scan.

`defineChatElement()` is the only thing that requires `onSendMessage` up
front; it isn't auto-registered on import, since registering a custom
element is a global side effect.

## Configuration

Every field below is optional — passed as a camelCase prop to
`createChatbot()`, or as a kebab-case `data-*` attribute on `<ss-chat>`.
An invalid value falls back to its default and logs a warning; it never
throws or blanks the widget.

| Prop | Attribute | Type | Default | Purpose |
| --- | --- | --- | --- | --- |
| `theme` | `data-theme` | `'light' \| 'dark'` | `'light'` | Color theme inside the panel |
| `orientation` | `data-orientation` | `'left' \| 'right'` | `'right'` | Launcher and panel side |
| `brandColor` | `data-brand-color` | color (hex) | `'#2563eb'` | Accent color; text contrast derived automatically |
| `name` | `data-name` | string | `'Assistant'` | Header title |
| `avatar` | `data-avatar` | url | — | Header and agent-bubble avatar |
| `placeholder` | `data-placeholder` | string | `'Type a message…'` | Composer placeholder |
| `initialMessages` | `data-initial-messages` | `string[]` (JSON) | `[]` | Rendered before any interaction |
| `suggestedMessages` | `data-suggested-messages` | `string[]` (JSON) | `[]` | Suggestion chips |
| `signature` | `data-signature` | boolean | `true` | Show the footer credit |
| `autoOpen` | `data-auto-open` | boolean | `false` | Open the panel on mount |
| `collectFeedback` | `data-collect-feedback` | boolean | `false` | Thumbs up/down on agent messages |
| `collectLeads` | `data-collect-leads` | boolean | `false` | Show a lead capture form |
| `sessionId` | `data-session` | string | generated | Stamped on every lifecycle payload |

Merging several config sources yourself (e.g. attributes plus a remote
config fetched later)? Use the same resolver core uses internally:

```js
import { resolveConfig, parseAttributes } from '@suppsalism/chatbot';

const attrs = parseAttributes(document.querySelector('ss-chat'));
const config = resolveConfig([attrs, remoteConfig]); // lowest precedence first
```

Unknown fields are kept (not stripped) so a newer remote config doesn't
break an older cached build; `null`/`undefined` values are stripped so
they can't clobber a lower-precedence layer.

## The message lifecycle

Three stages. `before` and `after` are observational; the middle one
produces the reply.

```
user submits
      │
      ├─► beforeSubmitMessage(draft) ────► draft | false
      │        false or throw → nothing renders, composer re-enabled
      │
      ├─► render user bubble, lock composer, show typing indicator
      │
      ├─► onSendMessage(message, ctx) ───► reply | AsyncIterable<chunk>
      │        throw → error bubble rendered, onMessageError called
      │
      ├─► render reply, hide typing, unlock composer
      │
      └─► afterSubmitMessage(message, reply)
```

```js
createChatbot({
  beforeSubmitMessage: (draft) => {
    // draft = { text, messageId, sessionId, timestamp }
    if (draft.text.length > 2000) return false; // cancel — nothing renders
    return { ...draft, text: draft.text.trim() };
  },

  onSendMessage: async (message, { history, config }) => {
    // Return any of:
    //   a string                              → rendered as one message
    //   { text, suggestions? }                → suggestions replace the chip row
    //   an AsyncIterable<string | { text }>   → streamed into one bubble, chunk by chunk
    return 'Thanks for reaching out!';
  },

  afterSubmitMessage: (message, reply) => {
    // Fire-and-forget — a throw here is caught and routed to onMessageError,
    // it can never break the chat. Good place for persistence/analytics.
    saveMessage({ id: message.messageId, text: message.text });
  },
});
```

`onSendMessage` is the only required option — `createChatbot()` throws
synchronously if it's missing, so a broken integration fails loudly in
development instead of silently doing nothing in front of a user.

Every message gets a `messageId` generated in stage one, and the same
message object is threaded through all three callbacks — that's your
correlation key for linking a question to its answer, and for streaming
updates.

Core never retries a failed send. Retries, backoff, and timeouts belong
to your `onSendMessage`, since only you know which failures are safe to
repeat.

## Other callbacks

All optional, all fire-and-forget — a throw inside any of them is caught
and routed to `onMessageError` instead of breaking the UI.

| Callback | Payload | Fires when |
| --- | --- | --- |
| `onReady(bot)` | the instance | The widget is mounted and interactive |
| `onOpen()` / `onClose()` | — | The panel's visibility changes |
| `onSuggestionClick(text)` | chip text | A suggestion chip is clicked — return `false` to stop it auto-submitting |
| `onFeedbackSubmit(fb)` | `{ messageId, value }` | A thumbs up/down is clicked (`collectFeedback: true`) |
| `onLeadSubmit(fields)` | `{ firstName, lastName, email, message }` | The lead form is submitted (`collectLeads: true`) |
| `onMessageError(error, message)` | the thrown error | After any lifecycle error has already been degraded visibly |

## Instance API

```js
bot.open();               // show the panel
bot.close();               // hide the panel
bot.toggle();
bot.submit('Hello!');      // programmatic message — runs the full lifecycle
bot.updateConfig(patch);   // re-validate, merge, re-apply to the DOM
bot.getState();            // { open, messages, pending }
bot.destroy();             // remove all DOM, unbind listeners, dispose effects
```

Always call `destroy()` when you're done with an instance — on an SPA
route change, for example. Without it you're left with an orphaned
launcher, orphaned style tags, and live effects running against detached
nodes.

`updateConfig()` is what lets you render immediately from `data-*`
attributes and apply a remotely-fetched config the moment it arrives,
instead of blocking first paint on a network round trip:

```js
const attrs = parseAttributes(document.querySelector('ss-chat'));
const bot = createChatbot({ ...resolveConfig([attrs]), onSendMessage });

fetchRemoteConfig().then((remote) => {
  bot.updateConfig(resolveConfig([attrs, remote]));
});
```

## Styling

The widget spans two documents: the host page and a same-origin iframe
that the whole panel renders inside, so its CSS and JS are sandboxed from
whatever the host page has loaded. That's why it looks identical on every
site it's embedded on.

If you want to reference or override the stylesheet:

```js
import '@suppsalism/chatbot/style.css';
```

Every class name is prefixed `ss-`, so it won't collide with your own
styles.

## CDN usage

Same public API, no build step:

```html
<script>
  // Safe to call before the bundle has loaded — queued and drained on init.
  window.ssChat = window.ssChat || [];
  ssChat.push(['defineChatElement', { onSendMessage: (msg) => myBackend.ask(msg.text) }]);
</script>
<script src="https://cdn.jsdelivr.net/npm/@suppsalism/chatbot@1/dist/chatbot.umd.js" defer></script>
<ss-chat data-theme="dark"></ss-chat>
```

Or call it directly once the script has loaded:

```js
const bot = SsChat.createChatbot({ onSendMessage: SsChat.echoReply });
SsChat.version;          // which version is loaded — the first thing to check when debugging
SsChat.get(bot.id);       // look up a running instance by id
```

`window.SsChat` mirrors every npm export under the exact same name, so any
snippet in this README works in both worlds — only the acquisition line
changes. Loading the script twice (two plugins on the same page each
embedding the widget, for example) warns and no-ops rather than clobbering
the first instance's state.

## TypeScript

Type declarations ship with the package, generated from JSDoc — no
separate `@types` package needed, and no need to write the library in
TypeScript to get autocomplete. CDN consumers can install the package for
types only:

```bash
npm i -D @suppsalism/chatbot   # types only — the runtime comes from the CDN
```

```ts
declare global {
  interface Window {
    SsChat: typeof import('@suppsalism/chatbot');
  }
}
```

## What's deliberately not in this package

If you're looking for one of these, it belongs in the layer that connects
this widget to your backend — not here, and not ever:

`apiUrl` · `chatbotKey` · `endpoints` · `retries` · `timeout` ·
`authToken` · any hardcoded hostname · fetching config from anywhere ·
persisting messages, feedback, or leads

Presentation and behavior settings (`theme`, `orientation`, `autoOpen`,
`signature`, ...) aren't options either — they're configuration, per the
rule above.

## Browser support

Evergreen browsers only — no polyfills are shipped or required. There are
no runtime dependencies at all; the only thing this package needs from
your app is a modern JS environment.

## Development

```bash
npm install
npm run build       # builds both the npm entry (cjs/es/modern) and the CDN/UMD bundle
npm run dev          # watches and rebuilds the npm entry
npm test             # runs the test suite (vitest + jsdom)
npm run test:watch
```

The codebase is organized bottom-up: a signal-based reactive store
(`src/lib/store/signal.js`), a pure config layer (`src/lib/config/`), the
lifecycle contract (`src/lib/lifecycle.js`), one class per UI piece under
`src/lib/component/` (each with `.element` and `.destroy()`), and the
host-page/iframe mount layer (`src/lib/mount/`) — all wired together by
`src/core.js`. If you're contributing, changes to the message lifecycle
or the config schema are the two places to be most careful: both are part
of the package's public contract.

## Versioning

This package publishes pinnable exact versions (`@1.2.3`) alongside a
`@1` major alias for the CDN build, and behavior never changes within a
major version. Renaming or removing a lifecycle callback, a config field,
an instance method, or a key on `window.SsChat` is a breaking change;
adding a new optional one is not.

## License

[MIT](./LICENSE.md)
