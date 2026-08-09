# `@suppsalism/chatbot` — Implementation Guide

**Companion to:** `chatbot-core-spec.md`, which defines *what* the package does.
This document defines *how to build it* — file structure, coding conventions,
build order, and the rules that keep the boundary intact once several people are
committing.

When the two documents disagree, the spec wins on behavior and this one wins on
structure.

---

## 1. How to use this document

Build **bottom-up**, in the order of §5. Each step is independently testable
before the next one exists, and each has a "done when" you can check against.
The two hardest things to test — the iframe and custom-element registration —
land last, deliberately, so that a mistake in the design surfaces at step 3
rather than step 7.

Do not build top-down from `core.js`. Orchestration written before the pieces it
orchestrates ends up shaping those pieces around whatever the orchestrator
guessed.

---

## 2. File structure

```
src/
├── index.js                    # named exports only — ZERO side effects (npm entry)
├── umd.js                      # attaches window.SsChat — ONLY file touching window
├── core.js                     # createChatbot: orchestration + instance API
├── element.js                  # defineChatElement
│
├── lib/
│   ├── config/
│   │   ├── schema.js           # CONFIG_SCHEMA — the single source of truth
│   │   ├── parse-attributes.js # DOM element → partial config
│   │   ├── resolve.js          # layered merge + validation
│   │   └── split-options.js    # flat options object → { config, callbacks }
│   │
│   ├── mount/
│   │   ├── shell.js            # host-page container + launcher slot; injects shell.css
│   │   ├── iframe.js           # creates the iframe; injects widget.css + metas + theme
│   │   └── styles.js           # createStyleTag(css, { nonce }) — one injection path
│   │
│   ├── lifecycle.js            # the three-stage submit flow + error policy
│   ├── state.js                # signal creation + the two DOM effects
│   │
│   ├── component/              # one class per UI piece, each with .element + destroy()
│   │   ├── wrapper.js
│   │   ├── launcher.js
│   │   ├── thead.js
│   │   ├── message-wrapper.js
│   │   ├── message.js
│   │   ├── typing.js
│   │   ├── suggestion-wrapper.js
│   │   ├── suggestion.js
│   │   ├── composer.js
│   │   ├── feedback.js
│   │   ├── lead-form.js
│   │   └── signature.js
│   │
│   ├── constants/
│   │   └── dom.js              # tag name, id builders, class names
│   ├── helper.js               # uuid, color contrast, type coercion
│   └── store/
│       └── signal.js
│
├── shell.css                   # host-page nodes
└── widget.css                  # iframe nodes
```

### 2.1 Why the top level is thin

Four files, each with one job:

| File | Job | Constraint |
| --- | --- | --- |
| `index.js` | re-export the public API | no logic, no side effects |
| `umd.js` | attach `window.SsChat` | the only file that may reference `window` |
| `core.js` | wire config → state → mount → components → instance API | no DOM creation of its own |
| `element.js` | custom element definition | calls `core.js`, adds nothing |

`index.js` and `core.js` are deliberately separate. The npm entry must be
side-effect-free while the UMD entry attaches a global, so they cannot be one
file. A barrel entry also means `core.js` can be split or renamed later without
that being a breaking change, since nobody imports it directly.

### 2.2 Files that must not exist

- **`constants/defaults.js`** — defaults belong in `config/schema.js`, one row
  per field. Two tables describing the same fields is the drift the spec rules
  out.
- **`constants/api.js`** — no URLs in this package. That file existing at all is
  the boundary leaking.
- **`lib/mount/widget.js`** — `iframe.js` prepares a second *document*; it never
  builds a component. Naming it `widget.js` invites someone to put component
  construction in it, which is `core.js`'s job.

### 2.3 The document boundary

The CSS split is **by document, not by time**. `shell.css` is not "before the
chat appears" — it is active the whole time, including the open panel's size and
transition and the launcher while the chat is open.

| Node | Document | Styled by | Created in |
| --- | --- | --- | --- |
| Launcher button | host page | `shell.css` | `component/launcher.js`, mounted into shell |
| Container / panel box | host page | `shell.css` | `mount/shell.js` |
| `<iframe>` element | host page | `shell.css` | `mount/iframe.js` |
| Everything inside the iframe | iframe | `widget.css` | `mount/iframe.js` injects; components build |

**A stylesheet inside the iframe cannot style the iframe element or anything in
the host page.** Thinking in before/after terms leads to putting "panel when
open" rules in `widget.css`, where they silently do nothing. Ask which document
the node lives in — that is the only question.

**The launcher is the one exception** to "components are styled by
`widget.css`": it is a component like any other, but it renders into the host
page because it must stay visible while the panel is collapsed. Put a comment
saying so at the top of `launcher.js`, or a future contributor will "fix" it by
moving its rules into `widget.css`.

---

## 3. Coding conventions

### 3.1 Module rules

- **ES modules, named exports only.** No default exports anywhere — they make
  the barrel and the UMD spread ambiguous, and they make renames invisible in
  diffs.
- **No side effects at module scope.** No `document.` or `window.` access, no
  `customElements.define`, no timers, nothing but declarations. The only
  exception is `umd.js`. This is what makes the package importable in Node and
  under SSR.
- **`window` appears in exactly one file** (`umd.js`) and **`document` appears
  in exactly two** (`mount/shell.js` for the host page, and wherever the
  entry receives it). Everything else receives a document reference.

### 3.2 Pass the document, never assume it

Components render into the iframe, not the host page, so `document.createElement`
inside a component is a bug that happens to work in tests.

```js
// component/message.js
export class Message {
  constructor({ doc, text, role, avatar }) {
    this.doc = doc;
    this.build();
  }
  build() {
    this.element = this.doc.createElement('div');
    // …
  }
}
```

Every component takes `doc` as a prop. This is also what makes them unit-testable
against a bare jsdom document with no iframe.

### 3.3 Classes for UI, functions for everything else

- **Classes** only in `component/`. They own state and a DOM subtree.
- **Plain functions** everywhere else: config, lifecycle, mount, store, helpers.
  Stateless functions are testable without constructing anything.
- No inheritance between components. No base class. The convention below is
  documented, not enforced by a superclass — a base class becomes the place
  people hang things that only some components need.

### 3.4 The component contract

Every component, without exception:

```js
export class Composer {
  constructor(props) {
    this.props = props;
    this.doc = props.doc;
    this.listeners = [];
    this.children = [];
    this.build();                    // must set this.element
  }

  on(node, event, handler) {         // ALWAYS bind through this
    node.addEventListener(event, handler);
    this.listeners.push([node, event, handler]);
  }

  build() { /* create this.element, bind via this.on() */ }

  destroy() {
    this.children.forEach(c => c.destroy());
    this.listeners.forEach(([n, e, h]) => n.removeEventListener(e, h));
    this.element.remove();
  }
}
```

1. Constructor takes a props object, calls `build()`, exposes `this.element`.
2. **Never call `addEventListener` directly** — always `this.on()`. A handler
   bound directly is a handler that is never removed.
3. Containers own their children and destroy them: `MessageWrapper` builds and
   holds its own `Message` / `Typing` instances and exposes
   `appendMessage()` / `showTyping()` / `hideTyping()`. External code never
   reaches into a component's subtree.
4. `destroy()` is mandatory even when it looks trivial. A component without one
   becomes the leak that `bot.destroy()` cannot fix.

### 3.5 DOM construction: no HTML strings

`createElement` and `textContent` only. No `innerHTML`, no template strings
containing markup, no `insertAdjacentHTML`.

```js
// wrong — config comes from outside; this is an injection vector
el.innerHTML = `<span>${config.name}</span>`;

// right
const span = doc.createElement('span');
span.textContent = config.name;
el.append(span);
```

Config fields reach the DOM from attributes and, in consuming layers, from a
network response. `textContent` makes that safe by construction rather than by
remembering to sanitize.

The single exception is the inlined CSS string assigned to a `<style>` tag's
`textContent` — which is not HTML parsing.

### 3.6 No magic strings

Every class name, id, tag name, and attribute name comes from `constants/dom.js`.
Ids are **builders**, not constants, because instances must be namespaced:

```js
export const CHAT_TAG_NAME = 'ss-chat';
export const CLASS = { wrapper: 'ss-wrapper', launcher: 'ss-launcher', /* … */ };
export const shellId  = (instanceId) => `ss-chat-shell-${instanceId}`;
export const iframeId = (instanceId) => `ss-chat-iframe-${instanceId}`;
```

CSS class prefix is `ss-` throughout. Two widgets on one page must not collide.

### 3.7 Error style

The rule from the spec, restated as code:

```js
// programmer error → throw synchronously, at construction
if (!callbacks.onSendMessage) throw new Error('[ss-chat] onSendMessage is required');
if (!isAttachedElement(mount)) throw new Error('[ss-chat] mount must be an attached Element');

// runtime condition → degrade visibly, never throw
if (!schema.validate(value)) {
  warn(`invalid ${key}: ${value} — using default`);
  value = schema.default;
}
```

- Every message is prefixed `[ss-chat]`. On a host page full of other scripts,
  an unprefixed console message is unattributable.
- `warn()` is a helper that de-duplicates: the same message never logs twice per
  instance. Config validation runs on every `updateConfig()`, and a repeating
  warning trains people to ignore the console.
- **Never swallow silently.** Every catch either renders something the user can
  see or calls `onMessageError`.

### 3.8 Async discipline

- `async` / `await` appears in **`lifecycle.js` and `mount/iframe.js` only**.
- Components are synchronous. A component that awaits is a component whose
  `destroy()` can race its own construction.
- No `setTimeout` for sequencing. The one legitimate deferral is waiting for
  `iframe.contentWindow.document`, and that uses the iframe's `load` event, not
  a timer.
- No `fetch`, no `XMLHttpRequest`, no `AbortController` anywhere in this
  package. If you are reaching for one, the code belongs in a consuming layer.

### 3.9 Naming

| Thing | Convention | Example |
| --- | --- | --- |
| Files | kebab-case | `parse-attributes.js`, `message-wrapper.js` |
| Classes | PascalCase, matching the file | `MessageWrapper` |
| Factories | `create*` | `createChatbot`, `createStyleTag` |
| Mount functions | `mount*`, returning `{ …, destroy }` | `mountShell`, `mountIframe` |
| Booleans | `is*` / `has*` / `should*` | `isAttachedElement` |
| Signal pairs | `[value, setValue]` | `[chatVisible, setChatVisible]` |
| Config fields | camelCase | `brandColor` |
| Attributes | `data-` + kebab-case | `data-brand-color` |
| Callback props | `on*` / `before*` / `after*` | `onSendMessage` |

Private class fields use `#`. Anything not `#` is reachable and will be depended
on.

### 3.10 JSDoc on every export

Not for readers — for `tsc --allowJs --declaration --emitDeclarationOnly`, which
is how the package ships types without being written in TypeScript. An export
without JSDoc produces an `any` in the published `.d.ts`.

### 3.11 Zero dependencies

No runtime dependencies, ever. No polyfills — target evergreen browsers and say
so in the README. `microbundle` is the only devDependency that matters.

Before adding a devDependency, ask whether it is worth the supply-chain surface
on a package that runs on other people's sites.

---

## 4. Where a new feature goes

A decision table, so this does not get relitigated per feature:

| You are adding | It goes in |
| --- | --- |
| A config option | one row in `config/schema.js` — and nowhere else |
| A new UI piece | one class in `component/`, plus rules in `widget.css` |
| A lifecycle callback | `lifecycle.js`, plus a row in the spec's §6.6 table |
| An instance method | `core.js`, in the returned object |
| Something needing a URL | **a different package** |
| A host-page visual change | `shell.css` |
| An in-iframe visual change | `widget.css` |
| A reusable pure utility | `helper.js` |
| A reactive primitive | `store/signal.js` |

If a feature does not fit a row, that is the signal to discuss it before writing
it, not to add a fifth top-level file.

---

## 5. Build order

Seven steps. Do not start one before the previous one's tests pass.

### Step 1 — `lib/store/signal.js`

Everything depends on this, and bugs here surface three layers up as
inexplicable UI behavior. Build it first and completely.

Required surface:

```js
createSignal(value, { equals })   // → [read, write]; write accepts a value or an updater fn
createEffect(fn)                  // fn may return a cleanup function
createMemo(fn)                    // derived read-only signal
batch(fn)                         // one effect pass for many writes
createRoot(fn)                    // fn(dispose) — ownership scope
```

Non-negotiable properties:

- **Equality check** — skip the write when unchanged, so composer keystrokes
  producing the same value do not re-run effects.
- **Batching** — writing `conversation` and `disabledSubmit` together causes one
  pass, not two.
- **Disposal** — `createRoot` tracks every effect created inside; `dispose()`
  unsubscribes them all and runs their cleanups. This is what makes
  `bot.destroy()` complete.
- **Error isolation** — `try` / `finally` around effect execution so a throwing
  effect cannot corrupt the module-level tracking stack.
- **Conditional dependency tracking** — a signal first read inside an `if`
  branch on a later run is tracked from then on.
- **Re-entrancy guard** — an effect writing a signal it reads must not loop
  forever. Cap the depth and warn.

**Done when:** all six properties have a dedicated failing-then-passing test,
including the conditional-dependency regression test.

### Step 2 — `lib/config/`

Pure functions, no DOM, fast tests. Order: `schema.js`, then `resolve.js`, then
`parse-attributes.js`, then `split-options.js`.

`schema.js` is one flat table. One row per field:

```js
export const CONFIG_SCHEMA = [
  { key: 'theme', attribute: 'data-theme', type: 'string', default: 'light',
    validate: (v) => v === 'light' || v === 'dark' },
  { key: 'brandColor', attribute: 'data-brand-color', type: 'string', default: '#2563eb',
    validate: (v) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v) },
  // …
];
```

Keep it flat. Flat config makes a shallow merge provably correct and keeps the
1:1 attribute mapping honest.

`resolve.js` behavior, from the spec's §4.3: strip `null` / `undefined` from
every layer, shallow-merge lowest precedence first over defaults, substitute the
default for any field failing `validate` and warn, keep unknown keys and warn
once, generate `sessionId` if absent. Freeze the result.

`split-options.js` takes the flat options object and separates it using
`CONFIG_SCHEMA` and the known callback list. Anything in neither warns once and
is dropped. This one function is what makes "config and callbacks in one flat
object" unambiguous.

**Done when:** each resolution rule from §4.3 has a test, and round-tripping
every schema type through `parse-attributes` produces the right JS value.

### Step 3 — `lib/lifecycle.js`

Build this **before any component exists**, against a fake view. It is your
public contract, it encodes the whole error policy, and this is where you find
out whether the design holds together — much cheaper now than at step 7.

```js
export async function submitMessage({ text, config, view, state, callbacks }) {
  const { beforeSubmitMessage, onSendMessage, afterSubmitMessage, onMessageError } = callbacks;

  let message = { text, messageId: uuid(), sessionId: config.sessionId, timestamp: Date.now() };

  // stage 1 — may transform or cancel; nothing has rendered yet
  try {
    const result = await beforeSubmitMessage?.(message);
    if (result === false) return;
    if (result) message = result;
  } catch (error) {
    report(onMessageError, error, message);
    return;
  }

  batch(() => {
    view.appendMessage({ ...message, role: 'user' });
    state.setDisabledSubmit(true);        // lock instead of abort
    view.showTyping();
  });

  // stage 2 — the consumer produces the reply
  let reply;
  try {
    reply = await normalizeReply(
      onSendMessage(message, { history: state.conversation(), config }),
      view
    );
  } catch (error) {
    batch(() => { view.hideTyping(); view.appendError(); state.setDisabledSubmit(false); });
    report(onMessageError, error, message);
    return;
  }

  batch(() => { view.hideTyping(); state.setDisabledSubmit(false); });

  // stage 3 — observational; never allowed to break the chat
  try { await afterSubmitMessage?.(message, reply); }
  catch (error) { report(onMessageError, error, message); }
}
```

`normalizeReply` is where the three accepted return shapes collapse into one
path: a string wraps to `{ text }`, an object passes through, an async iterable
streams chunks into a single bubble via `view.appendChunk()`. Everything
downstream sees the same thing, which is why streaming is invisible to
`afterSubmitMessage`.

Note what this function never does: no `fetch`, no retry, no timeout, no abort.
That is the boundary holding at the code level.

**Done when:** tested with a fake `view` and `state` — plain objects recording
calls — covering cancellation, `messageId` identity across all three callbacks,
all three reply shapes, the error path, and a throwing observer not breaking the
flow. No DOM involved.

### Step 4 — `lib/component/`

Port each class to the contract in §3.4, adding `doc`, `this.on()`, and
`destroy()` as you go. Build leaves before containers: `Message`, `Typing`,
`Suggestion` before `MessageWrapper`, `SuggestionWrapper`.

`Launcher` renders into the host page — see §2.3.

**Done when:** every component has a `destroy()` test asserting its element is
removed and its listeners are gone (spy on `removeEventListener` or assert a
handler no longer fires).

### Step 5 — `lib/mount/`

`styles.js` first (one injection path, used by both), then `shell.js`, then
`iframe.js`.

Both return `{ …, destroy }`. Theme and brand color must be applied to **both
roots** — the shell container and the iframe body — or a dark-theme launcher is
impossible, since the iframe's `<body>` class cannot reach a host-page node:

```js
// shell.js
container.className = `ss-shell theme-${config.theme}`;
container.style.setProperty('--ss-brand', config.brandColor);

// iframe.js
doc.body.className = `theme-${config.theme}`;
doc.body.style.setProperty('--ss-brand', config.brandColor);
```

`updateConfig()` must update both. This is one of the easier things to
half-implement.

`iframe.js` waits on the iframe's `load` event for `contentWindow.document` —
never a timer. Nothing here touches the network, so mount cannot fail on a slow
connection.

**Done when:** a jsdom test mounts a shell and an iframe, asserts both style
tags landed in the right documents, and asserts `destroy()` leaves neither
document modified.

### Step 6 — `src/core.js`

Wiring only. Every piece it touches is already trusted.

```js
export function createChatbot(options) {
  const { mount = document.body, instanceId = uuid(), ...rest } = options;
  const { config, callbacks } = splitOptions(rest);

  assertElement(mount);
  if (!callbacks.onSendMessage) throw new Error('[ss-chat] onSendMessage is required');

  const resolved = resolveConfig([config]);

  return createRoot((dispose) => {
    const state  = initState(resolved);
    const shell  = mountShell({ mount, instanceId, config: resolved });
    const iframe = mountIframe({ shell, instanceId, config: resolved });
    const view   = buildComponents({ doc: iframe.doc, config: resolved, state, callbacks });
    bindEffects({ state, shell, view });

    const bot = {
      id: instanceId,
      open:   () => state.setChatVisible(true),
      close:  () => state.setChatVisible(false),
      toggle: () => state.setChatVisible(v => !v),
      submit: (text) => submitMessage({ text, config: resolved, view, state, callbacks }),
      updateConfig: (patch) => { /* re-resolve, re-apply both roots, emit */ },
      getState: () => ({ /* … */ }),
      destroy: () => { view.destroy(); iframe.destroy(); shell.destroy(); dispose(); },
    };

    callbacks.onReady?.(bot);
    return bot;
  });
}
```

The `createRoot` wrapper is what makes `destroy()` complete: `dispose()` tears
down every effect created inside, so nothing survives to fire against detached
nodes. `core.js` creates no DOM of its own — it delegates to `mount/` and
`component/`.

**Done when:** a full mount-and-destroy test passes, plus a test asserting two
instances on one page do not collide on ids or state.

### Step 7 — `element.js`, `index.js`, `umd.js`

`element.js` registers the custom element; `connectedCallback` mounts,
`disconnectedCallback` destroys, `attributeChangedCallback` calls
`updateConfig`. Registration is a global side effect, so it happens when the
consumer calls `defineChatElement`, never at module scope.

`index.js` re-exports and nothing else. `umd.js` spreads those exports onto a
frozen `window.SsChat`, adds `version` / `instances` / `get`, guards
double-load, and drains the `window.ssChat` queue.

**Done when:** the parity test passes against the built artifacts, plus the
build smoke test loading all four `dist` files.

---

## 6. Testing approach by layer

| Layer | Environment | Approach |
| --- | --- | --- |
| `store/signal.js` | none | Pure. Highest value in the package |
| `config/` | none | Pure. Table-driven over `CONFIG_SCHEMA` |
| `lifecycle.js` | none | Fake `view` / `state` objects recording calls |
| `component/` | jsdom | Bare document as `doc`; assert nodes and `destroy()` |
| `mount/` | jsdom | Real `about:blank` iframe; assert both documents |
| `core.js` | jsdom | Mount, interact, destroy, assert nothing remains |
| `index` / `umd` | jsdom, built files | Parity + smoke tests |

`tests/` mirrors `src/`. `tests/setup.js` polyfills
`Element.prototype.scrollIntoView`, which jsdom does not implement and
`MessageWrapper`'s auto-scroll would otherwise throw on.

Two tests earn more than any component test:

- **`destroy()` leaves nothing** — no nodes in either document, no live effects,
  no effects firing after disposal. This is the test that keeps SPA consumers
  working.
- **Parity + build smoke** — the `--css inline` defect was a build bug no unit
  test would ever have caught.

Component unit tests are the lowest priority. Most of them assert that `build()`
produced the expected nodes, which is the least likely thing to regress.

---

## 7. Review checklist

Before merging anything:

- [ ] No new runtime dependency
- [ ] No `window` outside `umd.js`; no `document` assumed inside a component
- [ ] No side effects at module scope
- [ ] No `innerHTML`, no HTML in template strings
- [ ] No `fetch`, no URL, no hostname
- [ ] Every listener bound through `this.on()`
- [ ] Every new component has `destroy()`, and its container destroys it
- [ ] New config option is one row in `schema.js` and nowhere else
- [ ] New class name / id comes from `constants/dom.js`
- [ ] Console messages prefixed `[ss-chat]` and de-duplicated
- [ ] Programmer errors throw at construction; runtime conditions degrade
- [ ] Theme / brand changes applied to both roots
- [ ] JSDoc on every export
- [ ] If a public name changed: the spec's §16 list was consulted

---

## 8. Common pitfalls

**Styling a host-page node from `widget.css`.** It silently does nothing. Ask
which document the node lives in (§2.3).

**`document.createElement` inside a component.** Works in tests, renders into
the wrong document at runtime. Always use the injected `doc`.

**A listener bound directly in `build()`.** Never removed. `destroy()` looks
correct and leaks anyway.

**One effect reading the whole `conversation()` array to find new items.** That
is hand-rolled diffing and it is where a no-VDOM design becomes fragile. Either
add a keyed list helper to the store, or let the append path call
`view.appendMessage()` directly. **Never use one signal as both state and an
event bus.**

**Adding a config field to two places.** If you touched `schema.js` and
something else, the something else is wrong.

**Retrying inside `lifecycle.js`.** Retries, backoff, and timeouts belong to the
consumer, who alone knows which failures are safe to repeat.

**Forgetting `--css inline`.** `microbundle` extracts a separate CSS file for
one of the four formats by default, which silently breaks styling for
`require()` consumers.