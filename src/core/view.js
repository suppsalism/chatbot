import { Wrapper } from '../components/wrapper';
import { Launcher } from '../components/launcher';
import { Thead } from '../components/thead';
import { MessageWrapper } from '../components/message-wrapper';
import { SuggestionWrapper } from '../components/suggestion-wrapper';
import { Composer } from '../components/composer';
import { Signature } from '../components/signature';
import { LeadForm } from '../components/lead-form';

import { submitMessage } from './lifecycle';
import { safeInvoke } from './safe-invoke';

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
        onFeedback: role === 'agent' && config.collectFeedback ? handleFeedback : undefined,
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
