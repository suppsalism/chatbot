import { resolveConfig } from '../config/resolve';
import { splitOptions } from '../config/split-options';

import { mountShell } from '../dom/shell';
import { mountIframe } from '../dom/iframe';

import { createRoot } from '../reactive/signal';
import { generateUuid } from '../utils/uuid';
import { isAttachedElement } from '../utils/guards';

import { createView } from './view';
import { initState, bindEffects } from './state';
import { submitMessage } from './lifecycle';
import { safeInvoke } from './safe-invoke';

/**
 * @typedef {Object} CreateChatbotOptions
 *
 * -- options (spec §5.1) --
 * @property {Element} [mount=document.body] Must be an attached Element (throws synchronously
 *   otherwise). Decides ownership, not layout — everything created is a descendant of it, and
 *   destroy() tears it down.
 * @property {string} [instanceId] Internal instance id; auto-generated when omitted.
 *
 * -- configuration (spec §4.4) — every field is optional, invalid values fall back to their
 *    default with a console warning rather than throwing --
 * @property {'light'|'dark'} [theme='light'] Sets body.theme-{theme} inside the iframe.
 * @property {'left'|'right'} [orientation='right'] Launcher and panel side.
 * @property {string} [brandColor='#2563eb'] Accent color (hex); text contrast derived automatically.
 * @property {string} [name='Assistant'] Header title.
 * @property {string} [avatar] Header and agent-bubble avatar URL.
 * @property {string} [placeholder='Type a message…'] Composer placeholder.
 * @property {string[]} [initialMessages=[]] Rendered before any interaction.
 * @property {string[]} [suggestedMessages=[]] Suggestion chips.
 * @property {boolean} [signature=true] Show the footer credit.
 * @property {boolean} [autoOpen=false] Open the panel on mount.
 * @property {boolean} [collectFeedback=false] Show thumbs up/down on agent messages.
 * @property {string} [sessionId] Stamped on every lifecycle payload; a UUID is generated when omitted.
 *
 * -- message lifecycle (spec §6) --
 * @property {(draft: {text: string, messageId: string, sessionId: string, timestamp: number}) =>
 *   (object|false|Promise<object|false>)} [beforeSubmitMessage] Transform or cancel (return false)
 *   before the user bubble renders.
 * @property {(message: {text: string, messageId: string, sessionId: string, timestamp: number},
 *   ctx: {history: object[], config: object}) => (SendResult|Promise<SendResult>)}
 *   [onSendMessage] REQUIRED — throws synchronously at construction if omitted. Produces the reply;
 *   core never retries.
 * @property {(message: object, reply: Reply|Reply[]) => (void|Promise<void>)}
 *   [afterSubmitMessage] Fire-and-forget; a throw is caught and routed to onMessageError. Receives
 *   whatever shape onSendMessage returned — an array in, an array out.
 *
 * -- other lifecycle (spec §6.6) — all optional, all fire-and-forget, all wrapped so a throw
 *    cannot break the UI --
 * @property {(bot: ChatbotInstance) => void} [onReady] Widget mounted and interactive.
 * @property {() => void} [onOpen] Panel opened.
 * @property {() => void} [onClose] Panel closed.
 * @property {(text: string) => (boolean|void)} [onSuggestionClick] Return false to prevent auto-submit.
 * @property {(feedback: {messageId: string, value: 'up'|'down'}) => void} [onFeedbackSubmit] Only
 *   fires when collectFeedback is on.
 * @property {(error: Error, message: object) => void} [onMessageError] Called after any lifecycle
 *   error has already been degraded visibly (error bubble rendered, composer unlocked, etc).
 */

/**
 * What onSendMessage — and a form's onSubmit — may return.
 *
 * A bare string is shorthand for `{ text }`. An array renders one agent message
 * per element. An async iterable streams chunks into a single bubble and so
 * carries no form.
 *
 * @typedef {Reply|Reply[]|string|AsyncIterable<string|{text: string}>} SendResult
 */

/**
 * One agent message.
 *
 * @typedef {Object} Reply
 * @property {string} text Required.
 * @property {string[]} [suggestions] Chips for the next turn. The chip row is
 *   single, so across an array of replies the last non-empty set wins.
 * @property {FormSpec} [form] A form rendered inside this message's bubble.
 */

/**
 * A form attached to a reply. Every field maps to a native control, so
 * validation is the browser's. There is no `password` type — see core/form-spec.js.
 *
 * @typedef {Object} FormSpec
 * @property {string} [id] Identifies the form on submit; defaults to the message id.
 * @property {string} [title] e.g. "Please share your name and email so we can follow up."
 * @property {string} [submitLabel='Send']
 * @property {Array<{name: string, label?: string,
 *   type?: 'text'|'email'|'tel'|'url'|'number'|'textarea'|'select'|'checkbox',
 *   placeholder?: string, required?: boolean,
 *   options?: Array<{value: string, label?: string}>, value?: string|boolean}>} fields
 *   An invalid field is dropped with a warning rather than costing the whole reply.
 * @property {(values: Record<string, string|boolean>,
 *   ctx: {formId: string, messageId: string, sessionId: string}) =>
 *   (void|false|SendResult|Promise<void|false|SendResult>)} [onSubmit]
 *   The form's own handler — there is no widget-level equivalent. Return false to leave the form
 *   editable (a server-side rejection); return a reply to answer in the conversation. Any other
 *   return locks the form so it cannot be submitted twice.
 */

/**
 * @typedef {Object} ChatbotInstance
 * @property {string} id
 * @property {() => void} open
 * @property {() => void} close
 * @property {() => void} toggle
 * @property {(text: string) => Promise<void>} submit Programmatic message; runs the full lifecycle.
 * @property {(patch: Partial<CreateChatbotOptions>) => void} updateConfig Re-validates, merges, re-applies DOM effects.
 * @property {() => {open: boolean, messages: object[], pending: boolean}} getState
 * @property {() => void} destroy Removes DOM, unbinds listeners, disposes effects.
 */

/**
 * Wires config → state → mount → view → instance API (guide §2.1). This file
 * creates no DOM of its own: every node comes from ../dom or ./view.
 *
 * @param {CreateChatbotOptions} [options]
 * @returns {ChatbotInstance}
 */
export function createChatbot(options = {}) {
  const { mount = document.body, instanceId = generateUuid(), ...rest } = options;

  if (!isAttachedElement(mount)) {
    throw new Error('[ss-chat] mount must be an attached Element');
  }

  const { config, callbacks } = splitOptions(rest);

  if (typeof callbacks.onSendMessage !== 'function') {
    throw new Error('[ss-chat] onSendMessage is required');
  }

  let resolvedConfig = resolveConfig([config]);
  const getConfig = () => resolvedConfig;

  return createRoot((dispose) => {
    const state = initState(resolvedConfig);
    const shell = mountShell({ mount, instanceId, config: resolvedConfig });
    const iframe = mountIframe({ shell, instanceId, config: resolvedConfig });

    function openChat() {
      if (state.chatVisible()) return;
      state.setChatVisible(true);
      safeInvoke(callbacks.onOpen, callbacks);
    }

    function closeChat() {
      if (!state.chatVisible()) return;
      state.setChatVisible(false);
      safeInvoke(callbacks.onClose, callbacks);
    }

    function toggleChat() {
      if (state.chatVisible()) closeChat();
      else openChat();
    }

    const view = createView({
      doc: iframe.doc,
      shell,
      getConfig,
      state,
      callbacks,
      closeChat,
      toggleChat,
    });

    state.conversation().forEach((entry) => {
      view.appendMessage({ role: entry.role, text: entry.text, messageId: entry.messageId });
    });

    bindEffects({ state, shell, view });

    const bot = {
      id: instanceId,
      open: openChat,
      close: closeChat,
      toggle: toggleChat,

      submit(text) {
        return submitMessage({ text, config: resolvedConfig, view, state, callbacks });
      },

      updateConfig(patch) {
        resolvedConfig = resolveConfig([resolvedConfig, patch]);
        shell.applyConfig(resolvedConfig);
        iframe.applyConfig(resolvedConfig);
        view.applyConfig(resolvedConfig);
      },

      getState() {
        return {
          open: state.chatVisible(),
          messages: state.conversation(),
          pending: state.disabledSubmit(),
        };
      },

      destroy() {
        view.destroy();
        iframe.destroy();
        shell.destroy();
        dispose();
      },
    };

    safeInvoke(callbacks.onReady, callbacks, bot);

    return bot;
  });
}
