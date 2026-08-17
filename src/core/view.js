import { Wrapper } from '../components/wrapper';
import { Launcher } from '../components/launcher';
import { Thead } from '../components/thead';
import { MessageWrapper } from '../components/message-wrapper';
import { SuggestionWrapper } from '../components/suggestion-wrapper';
import { Composer } from '../components/composer';
import { Signature } from '../components/signature';

import { submitMessage, renderResult } from './lifecycle';
import { normalizeFormSpec } from './form-spec';
import { safeInvoke, reportError } from './safe-invoke';

/**
 * Builds the component tree inside the iframe document and returns the `view`
 * façade — the single object the rest of core talks to when it needs the DOM
 * to change. Nothing outside this file holds a component reference, which is
 * what keeps createChatbot() pure wiring and makes destroy() a single call.
 *
 * @returns {{
 *   appendMessage: (entry: {role: string, text: string, messageId?: string}) => object,
 *   beginAgentMessage: (entry: {messageId: string}) => {update: (text: string) => void, finish: () => void},
 *   appendError: () => void,
 *   showTyping: () => void,
 *   hideTyping: () => void,
 *   setSuggestions: (list: string[]) => void,
 *   setSubmitDisabled: (disabled: boolean) => void,
 *   applyConfig: (config: object) => void,
 *   destroy: () => void,
 * }}
 */
export function createView({ doc, shell, getConfig, state, callbacks, closeChat, toggleChat }) {
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

  let signature = null;
  if (getConfig().signature) {
    signature = new Signature({ doc });
    wrapper.content.appendChild(signature.element);
  }

  doc.body.appendChild(wrapper.element);

  async function handleFeedback(fb) {
    messageWrapper.setFeedbackDisabled(true);
    try {
      await safeInvoke(callbacks.onFeedbackSubmit, callbacks, fb);
    } catch {
      // already reported via safeInvoke -> onMessageError
    } finally {
      messageWrapper.setFeedbackDisabled(false);
    }
  }

  function handleSuggestionClick(text) {
    const allow = safeInvoke(callbacks.onSuggestionClick, callbacks, text);
    if (allow === false) return;
    submitMessage({ text, config: getConfig(), view, state, callbacks });
  }

  /**
   * Runs a form's own onSubmit and translates what it returned into the one
   * thing the Form component needs to know — whether to close:
   *
   *   false          → leave the form editable, so the consumer can reject it
   *   a reply/replies → rendered as new agent messages, then the form locks
   *   anything else  → the form just locks
   *
   * Locking is what stops the same lead being submitted twice. A returned reply
   * may itself carry a form, which is what makes multi-step flows work: the
   * rendering path is the same one onSendMessage uses, so it composes with no
   * special case here.
   *
   * @returns {Promise<boolean>} true when the form should lock.
   */
  async function runFormSubmit(spec, messageId, values) {
    const context = {
      formId: spec.id,
      messageId,
      sessionId: getConfig().sessionId,
    };

    let result;
    try {
      result = await spec.onSubmit(values, context);
    } catch (error) {
      reportError(callbacks, error);
      return false;
    }

    if (result === false) return false;

    if (result !== undefined && result !== null) {
      try {
        await renderResult(result, { view, state });
      } catch (error) {
        reportError(callbacks, error);
      }
    }

    return true;
  }

  getConfig().suggestedMessages.forEach((text) => {
    suggestionWrapper.addSuggestion({ text, onClick: handleSuggestionClick });
  });

  const view = {
    appendMessage({ role, text, messageId, form }) {
      const config = getConfig();
      const spec = role === 'agent' ? normalizeFormSpec(form, { messageId }) : null;

      // The component gets one `form` object and nothing else. The consumer's
      // handler is swapped for the wired one in the same slot, so there is never
      // a live handler and a dead one in scope at the same time.
      const wired =
        spec && spec.onSubmit
          ? { ...spec, onSubmit: (values) => runFormSubmit(spec, messageId, values) }
          : (spec ?? undefined);

      return messageWrapper.appendMessage({
        role,
        text,
        messageId,
        avatar: role === 'agent' ? config.avatar : undefined,
        brandColor: config.brandColor,
        onFeedback: role === 'agent' && config.collectFeedback ? handleFeedback : undefined,
        form: wired,
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
        onFeedback: config.collectFeedback ? handleFeedback : undefined,
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
    },

    destroy() {
      launcher.destroy();
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
