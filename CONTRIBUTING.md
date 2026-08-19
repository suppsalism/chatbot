# Contributing to @suppsalismjs/chatbot

Thanks for your interest in improving the chatbot widget. This document covers the local setup, how
the source is organized, the conventions we follow, and how to submit changes.

## Getting started

1. Fork the repo: [github.com/suppsalism/chatbot](https://github.com/suppsalism/chatbot)
2. Clone your fork and install:
   ```bash
   git clone https://github.com/<you>/chatbot.git
   cd chatbot
   npm install
   ```
3. Build, then try it in a browser:
   ```bash
   npm run build
   npm run examples     # http://localhost:5000/examples/
   ```

`npm run build` produces `dist/` (cjs, module, modern, umd, a standalone stylesheet, and type
declarations generated from JSDoc) via microbundle. `dist/` is gitignored — never commit it.

## The one rule

**This package is UI and state. It makes no network calls.**

No API keys, endpoints, or base URLs belong in its config; producing a reply is the consumer's job,
passed in as `onSendMessage`. A change that crosses this line will not be merged, however
convenient it looks. `fetch`, `XMLHttpRequest`, and `WebSocket` are lint errors inside `src/`, and
`scripts/check-exports.mjs` re-checks the built bundles for them, so the boundary fails loudly
rather than quietly.

The corollary rule decides where a new option goes:

> If it survives `JSON.stringify`, it's **configuration** — add a row to `CONFIG_SCHEMA` and it
> gets a `data-*` attribute for free. If it doesn't — a function, a DOM node — it's an **option**,
> passed in JS only.

## Project structure

```
src/
├── index.js            npm entry — named exports, zero side effects on import
├── umd.js              CDN entry — the only file permitted to touch `window`
├── echo-reply.js       public helper export
├── core/               createChatbot, defineChatElement, the view façade, state, lifecycle
│                       — has an exclusion rule, see below before adding to it
├── components/         one class per UI piece; each owns build() and destroy()
├── config/             CONFIG_SCHEMA and the resolve / parse / split pipeline
├── constants/          every class name, id, tag name and event name the widget writes
├── dom/                the host-page shell, the iframe, style injection, SVG icons
├── reactive/           the signal store (createSignal / createEffect / batch / createRoot)
├── styles/             shell.css (host page) and widget.css (inside the iframe)
└── utils/              warn, uuid, guards, coercion, color contrast

tests/                  Vitest + jsdom, mirroring src/
examples/               runnable pages, loaded from dist/
scripts/                maintainer automation — never run by consumers
assets/                 README images (not shipped in the package)
```

### What belongs in `core/`

"Core" is a magnet: every folder named that eventually rots, because any file can be argued into
it. So it has an exclusion rule, and new files have to pass it.

> `core/` is the code that knows a **chatbot instance** exists — its construction, its state, its
> message pipeline, its view façade, its callback contract. **If a module doesn't need to know a
> chatbot exists, it belongs somewhere else**: `utils/`, `config/`, `dom/`, `reactive/`, or
> `components/`.

The test that keeps this honest is that `core/` stays encapsulated: outside of tests, nothing
imports `view`, `state`, `lifecycle`, `safe-invoke`, or `form-spec`. Only `create-chatbot` and
`define-element` escape, through `index.js`. If a fifth file starts being imported from outside
`core/`, either it was misfiled or the boundary has sprung a leak — check which before adding to it.

Two judgement calls this rule has already settled, recorded so they don't get relitigated:

- **`safe-invoke.js` stays**, despite looking like a util — 26 lines, zero imports. It reads
  `callbacks.onMessageError`, so it encodes a core policy ("an observer may never break the chat"),
  not a generic helper. `utils/` is for modules with no idea a chatbot exists.
- **`form-spec.js` fails the rule** and is knowingly left in place. It is a pure descriptor
  validator — the same job `config/resolve.js` does, for a reply's `form` instead of the widget
  config. Moving it to `config/` would imply it validates widget configuration, and `src/forms/`
  would be a one-file folder. Its only consumer is `view.js`. **Revisit when a second entity type
  arrives**: a `card` or `buttons` reply would give `src/forms/` (or `src/entities/`) enough
  substance to be a real home, and that is the moment to move it.

### `view.js` is the file most likely to need splitting next

Not a rule, a heads-up. `core/view.js` is the largest file in `src/` (~230 lines) and does three
jobs in one closure:

1. **Assembly** — constructing the component tree (lines ~32–72).
2. **Orchestration** — `handleFeedback`, `handleSuggestionClick`, `runFormSubmit`, the handlers that
   sit between a component's event and the rest of core.
3. **The façade** — the `view` object `create-chatbot.js` and `lifecycle.js` talk to.

It is fine at this size, and the seam is obvious: façade on one side, assembly on the other. But
the split is **not free**, which is why it hasn't happened. Every façade method closes over the
component instances created during assembly (`messageWrapper`, `suggestionWrapper`, `thead`,
`composer`, and the reassignable `signature`), and `handleSuggestionClick` closes over `view`
itself, before `view` is defined. Separating them means passing all of that explicitly, which
trades a long file for a wide parameter list.

So: don't split it preemptively. Split it when adding to it starts feeling cramped — and when you
do, move the façade out and leave assembly behind, since the façade is the part with a real
contract. Growing it by a couple of methods is not a reason to reach for this.

A few other conventions that are load-bearing:

- **`CONFIG_SCHEMA` is the single source of truth.** Defaults, the attribute parser, validation,
  and the observed attribute list all derive from it. Adding an option means adding one row there
  and nowhere else.
- **No DOM class, id, or tag literal outside `constants/`.**
- **No `innerHTML`.** Build nodes with `createElement` and `textContent`; icons go through
  `dom/icon.js` and `createElementNS`. The one exception is `createStyleTag`, which sets
  `textContent` on a `<style>` — that is not HTML parsing.
- **Every component owns its teardown.** A `destroy()` must remove its nodes, remove every listener
  it added, and dispose every effect it created. `createRoot` in `core/create-chatbot.js` is what
  makes the instance-wide `destroy()` complete; keep effects inside it.
- **The launcher is deliberately styled by `shell.css`, not `widget.css`,** because it renders on
  the host page rather than inside the iframe. Don't "fix" it.

## Development workflow

| Command                                   | What it does                                                           |
| ----------------------------------------- | ---------------------------------------------------------------------- |
| `npm test`                                | Run the suite once                                                     |
| `npm run test:watch`                      | Watch mode                                                             |
| `npm run test:coverage`                   | Suite plus a coverage report                                           |
| `npm run lint` / `npm run lint:fix`       | ESLint                                                                 |
| `npm run format` / `npm run format:check` | Prettier                                                               |
| `npm run build`                           | Build `dist/`                                                          |
| `npm run dev`                             | Rebuild on change                                                      |
| `npm run examples`                        | Static-serve `examples/` against the current `dist/`                   |
| `npm run check:exports`                   | Every path `package.json` declares resolves; bundles stay network-free |
| `npm run check:size`                      | Gzip budget per bundle                                                 |
| `npm run verify`                          | Everything above, in the order CI runs it                              |

Run `npm run verify` before opening a PR — it is exactly what CI runs, so a green local run means a
green pipeline.

## Testing

Tests live in `tests/`, mirroring `src/`, and run in jsdom. jsdom implements no layout, so
`tests/setup.js` stubs `scrollIntoView` on both the top document and any iframe the widget creates.

Two things are worth knowing when adding tests:

- The widget renders into an iframe, so assertions go through
  `mount.querySelector('iframe').contentWindow.document` — except the launcher and the shell, which
  live on the host page.
- `customElements.define()` is global and irreversible. `tests/core/define-element.test.js`
  generates a unique tag name per test; follow that pattern rather than reusing `ss-chat`.

Cover new behavior where practical, and prefer a test that asserts documented behavior over one
that asserts the current implementation.

## Commit and PR conventions

- One logical change per commit; write what changed and why.
- Open PRs against `master`, and reference the related issue.
- Fill in the PR template, including the boundary checklist.
- Add a `CHANGELOG.md` entry under `Unreleased`.
- Public API changes need JSDoc updates (that is what generates `dist/index.d.ts`) and a README
  update.

## Reporting bugs / requesting features

Open an issue at [github.com/suppsalism/chatbot/issues](https://github.com/suppsalism/chatbot/issues).
The templates ask for the version, how you load the widget, and a minimal reproduction — please
redact anything from inside your own `onSendMessage`.

## Release process (maintainers)

```bash
npm run verify
npm version patch|minor|major
git push --follow-tags
```

Pushing the tag triggers `.github/workflows/publish.yml`, which re-runs every gate, verifies the
tag matches `package.json`, and publishes to npm. Merge any workflow change _before_ tagging — the
run uses the commit the tag points at.

**There is no npm token, and there must not be one.** Publishing is tokenless via npm's trusted
publishing, which is bound to this repository _and the `publish.yml` filename_ — so moving or
renaming that workflow breaks publishing until the trusted publisher is reconfigured on npmjs.com.
Its remaining requirements are commented in the file itself.

## Code of conduct

Be respectful and constructive. We want this to be a welcoming project for contributors of all
experience levels.
