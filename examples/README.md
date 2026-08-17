# Examples

Each page loads the widget from `../dist/`, so build first:

```bash
npm run build
npm run examples     # serves this folder at http://localhost:5000
```

`npm run examples` runs a static server rather than opening the files directly, because
`custom-element.html` and `esm-streaming.html` use `<script type="module">`, which browsers
refuse to load over `file://`.

| Page                                           | Shows                                                                                                                          |
| ---------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------ |
| [`cdn-umd.html`](./cdn-umd.html)               | The `<script src>` + `window.ssChat.push([...])` queue, `SsChat.instances`, feedback buttons                                   |
| [`custom-element.html`](./custom-element.html) | `defineChatElement()`, per-tag `data-*` overriding shared defaults, live attribute edits, auto-destroy on removal              |
| [`reply-forms.html`](./reply-forms.html)       | A `form` on a reply with its own `onSubmit`, select/checkbox/textarea fields, server-side rejection, and multi-message replies |
| [`esm-streaming.html`](./esm-streaming.html)   | `createChatbot()` into your own container, a streamed async-generator reply, all three lifecycle stages                        |

None of them make a network call — every `onSendMessage` produces its reply locally, which is the
whole point of the package boundary.
