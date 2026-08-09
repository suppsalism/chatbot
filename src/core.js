import { Wrapper } from './lib/component/wrapper';
import { Launcher } from './lib/component/launcher';
import { Thead } from './lib/component/thead';
import { MessageWrapper } from './lib/component/message-wrapper';
import { SuggestionWrapper } from './lib/component/suggestion-wrapper';
import { Composer } from './lib/component/composer';
import { Signature } from './lib/component/signature';
import { LeadForm } from './lib/component/lead-form';

import { resolveConfig } from './lib/config/resolve';
import { splitOptions } from './lib/config/split-options';

import { mountShell } from './lib/mount/shell';
import { mountIframe } from './lib/mount/iframe';

import { initState, bindEffects } from './lib/state';
import { submitMessage } from './lib/lifecycle';
import { createRoot } from './lib/store/signal';
import { generateUuid, isAttachedElement } from './lib/helper';

function reportError(callbacks, error, message) {
  try {
    callbacks.onMessageError?.(error, message);
  } catch {
    // an observer is never allowed to break the chat (spec §6.7)
  }
}

/** Invokes an optional, fire-and-forget callback; a throw or rejection is routed to onMessageError. */
function safeInvoke(fn, callbacks, ...args) {
  if (!fn) return undefined;
  try {
    const result = fn(...args);
    if (result && typeof result.catch === 'function') {
      result.catch((error) => reportError(callbacks, error));
    }
    return result;
  } catch (error) {
    reportError(callbacks, error);
    return undefined;
  }
}

function buildComponents({ doc, shell, getConfig, state, callbacks, closeChat, toggleChat }) {
  const wrapper = new Wrapper({ doc });

  const launcher = new Launcher({
    doc: shell.doc,
    avatar: getConfig().avatar,
    orientation: getConfig().orientation,
    onToggle: toggleChat,
  });
  shell.element.appendChild(launcher.element);

  const thead = new Thead({
    doc,
    avatar: getConfig().avatar,
    name: getConfig().name,
    onClose: closeChat,
  });
  wrapper.content.appendChild(thead.element);

  const messageWrapper = new MessageWrapper({ doc });
  wrapper.content.appendChild(messageWrapper.element);

  const suggestionWrapper = new SuggestionWrapper({ doc });
  wrapper.content.appendChild(suggestionWrapper.element);

  const composer = new Composer({
    doc,
    message: state.message,
    setMessage: state.setMessage,
    disabledSubmit: state.disabledSubmit,
    placeholder: getConfig().placeholder,
    onSend: (text) => submitMessage({ text, config: getConfig(), view, state, callbacks }),
  });
  wrapper.content.appendChild(composer.element);

  let leadForm = null;
  if (getConfig().collectLeads) {
    leadForm = new LeadForm({
      doc,
      onSubmit: (fields) => safeInvoke(callbacks.onLeadSubmit, callbacks, fields),
    });
    wrapper.content.appendChild(leadForm.element);
  }

  let signature = null;
  if (getConfig().signature) {
    signature = new Signature({ doc });
    wrapper.content.appendChild(signature.element);
  }

  doc.body.appendChild(wrapper.element);

  function handleSuggestionClick(text) {
    const allow = safeInvoke(callbacks.onSuggestionClick, callbacks, text);
    if (allow === false) return;
    submitMessage({ text, config: getConfig(), view, state, callbacks });
  }

  getConfig().suggestedMessages.forEach((text) => {
    suggestionWrapper.addSuggestion({ text, onClick: handleSuggestionClick });
  });

  const view = {
    appendMessage({ role, text, messageId }) {
      const config = getConfig();
      return messageWrapper.appendMessage({
        role,
        text,
        messageId,
        avatar: role === 'agent' ? config.avatar : undefined,
        brandColor: config.brandColor,
        onFeedback:
          role === 'agent' && config.collectFeedback
            ? (fb) => safeInvoke(callbacks.onFeedbackSubmit, callbacks, fb)
            : undefined,
      });
    },

    beginAgentMessage({ messageId }) {
      const config = getConfig();
      const message = messageWrapper.appendMessage({
        role: 'agent',
        text: '',
        messageId,
        avatar: config.avatar,
        brandColor: config.brandColor,
        onFeedback: config.collectFeedback
          ? (fb) => safeInvoke(callbacks.onFeedbackSubmit, callbacks, fb)
          : undefined,
      });
      return {
        update: (text) => message.setText(text),
        finish: () => {},
      };
    },

    appendError() {
      const config = getConfig();
      messageWrapper.appendMessage({
        role: 'agent',
        text: 'Something went wrong. Please try again.',
        error: true,
        avatar: config.avatar,
        brandColor: config.brandColor,
      });
    },

    showTyping() {
      messageWrapper.showTyping({ avatar: getConfig().avatar });
    },

    hideTyping() {
      messageWrapper.hideTyping();
    },

    setSuggestions(list) {
      suggestionWrapper.setSuggestions(list, handleSuggestionClick);
    },

    setSubmitDisabled(disabled) {
      suggestionWrapper.setDisabled(disabled);
    },

    applyConfig(config) {
      thead.setName(config.name);
      thead.setAvatar(config.avatar);
      composer.setPlaceholder(config.placeholder);
      launcher.setAvatar(config.avatar);

      if (config.signature && !signature) {
        signature = new Signature({ doc });
        wrapper.content.appendChild(signature.element);
      } else if (!config.signature && signature) {
        signature.destroy();
        signature = null;
      }

      if (config.collectLeads && !leadForm) {
        leadForm = new LeadForm({
          doc,
          onSubmit: (fields) => safeInvoke(callbacks.onLeadSubmit, callbacks, fields),
        });
        wrapper.content.appendChild(leadForm.element);
      } else if (!config.collectLeads && leadForm) {
        leadForm.destroy();
        leadForm = null;
      }
    },

    destroy() {
      launcher.destroy();
      leadForm?.destroy();
      signature?.destroy();
      composer.destroy();
      suggestionWrapper.destroy();
      messageWrapper.destroy();
      thead.destroy();
      wrapper.destroy();
    },
  };

  return view;
}

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
 * @property {boolean} [collectLeads=false] Show the lead form (first name, last name, email, message).
 * @property {string} [sessionId] Stamped on every lifecycle payload; a UUID is generated when omitted.
 *
 * -- message lifecycle (spec §6) --
 * @property {(draft: {text: string, messageId: string, sessionId: string, timestamp: number}) =>
 *   (object|false|Promise<object|false>)} [beforeSubmitMessage] Transform or cancel (return false)
 *   before the user bubble renders.
 * @property {(message: {text: string, messageId: string, sessionId: string, timestamp: number},
 *   ctx: {history: object[], config: object}) =>
 *   (string|{text: string, suggestions?: string[]}|AsyncIterable<string|{text: string}>|Promise<any>)}
 *   [onSendMessage] REQUIRED — throws synchronously at construction if omitted. Produces the reply;
 *   core never retries.
 * @property {(message: object, reply: {text: string, suggestions?: string[]}) => (void|Promise<void>)}
 *   [afterSubmitMessage] Fire-and-forget; a throw is caught and routed to onMessageError.
 *
 * -- other lifecycle (spec §6.6) — all optional, all fire-and-forget, all wrapped so a throw
 *    cannot break the UI --
 * @property {(bot: ChatbotInstance) => void} [onReady] Widget mounted and interactive.
 * @property {() => void} [onOpen] Panel opened.
 * @property {() => void} [onClose] Panel closed.
 * @property {(text: string) => (boolean|void)} [onSuggestionClick] Return false to prevent auto-submit.
 * @property {(feedback: {messageId: string, value: 'up'|'down'}) => void} [onFeedbackSubmit] Only
 *   fires when collectFeedback is on.
 * @property {(fields: {firstName: string, lastName: string, email: string, message: string}) => void}
 *   [onLeadSubmit] Only fires when collectLeads is on.
 * @property {(error: Error, message: object) => void} [onMessageError] Called after any lifecycle
 *   error has already been degraded visibly (error bubble rendered, composer unlocked, etc).
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
 * Wires config → state → mount → components → instance API (guide §2.1).
 * Every piece it touches is already trusted; this file creates no DOM of its
 * own beyond delegating to lib/mount and lib/component.
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

    const view = buildComponents({
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
