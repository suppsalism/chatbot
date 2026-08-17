import { Message } from './message';
import { Typing } from './typing';
import { CLASS } from '../constants/class-names';

export class MessageWrapper {
  constructor({ doc, behavior = 'smooth', block = 'end', inline = 'end' }) {
    this.doc = doc;
    this.behavior = behavior;
    this.block = block;
    this.inline = inline;
    this.children = [];
    this.typing = null;

    this.build();
  }

  build() {
    const wrapper = this.doc.createElement('div');
    wrapper.className = CLASS.messageWrapperWrapper;

    const container = this.doc.createElement('div');
    container.className = CLASS.messageWrapperContainer;
    wrapper.appendChild(container);

    const observer = new this.doc.defaultView.MutationObserver((mutationList) => {
      for (const mutation of mutationList) {
        if (mutation.type === 'childList') this.scrollToBottom();
      }
    });
    observer.observe(container, { attributes: true, childList: true, subtree: true });

    this.element = wrapper;
    this.container = container;
    this.observer = observer;
  }

  scrollToBottom() {
    this.container.scrollIntoView({
      behavior: this.behavior,
      block: this.block,
      inline: this.inline,
    });
  }

  showTyping({ avatar } = {}) {
    if (this.typing) return;
    this.typing = new Typing({ doc: this.doc, avatar });
    this.container.appendChild(this.typing.element);
  }

  hideTyping() {
    if (!this.typing) return;
    this.typing.destroy();
    this.typing = null;
  }

  /** Appends a bubble and returns the Message instance (its setText() drives streaming). */
  appendMessage({ role, text, avatar, brandColor, error, messageId, onFeedback, form }) {
    const message = new Message({
      doc: this.doc,
      role,
      text,
      avatar,
      brandColor,
      error,
      messageId,
      onFeedback,
      form,
    });
    this.children.push(message);
    this.container.appendChild(message.element);
    return message;
  }

  /** Locks every feedback pair in the conversation together (spec: same disable pattern as suggestions). */
  setFeedbackDisabled(disabled) {
    this.children.forEach((child) => child.setFeedbackDisabled(disabled));
  }

  destroy() {
    this.observer.disconnect();
    this.hideTyping();
    this.children.forEach((child) => child.destroy());
    this.element.remove();
  }
}
