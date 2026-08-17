import { getTextColorForBackground } from '../utils/color';
import { CLASS } from '../constants/class-names';
import { Feedback } from './feedback';
import { Form } from './form';

export class Message {
  constructor({
    doc,
    role, // 'user' | 'agent'
    text,
    avatar,
    brandColor = '#2563eb',
    error = false,
    messageId,
    onFeedback,
    form, // normalized spec, its onSubmit already wired by core/view
  }) {
    this.doc = doc;
    this.role = role;
    this.avatar = avatar;
    this.brandColor = brandColor;
    this.error = error;
    this.messageId = messageId;
    this.onFeedback = onFeedback;
    this.formSpec = form;
    this.children = [];
    // Kept as a field because setFeedbackDisabled() reaches for it later; the
    // Form needs no such handle, so it lives only in `children` for teardown.
    this.feedback = null;

    this.build(text);
  }

  build(text) {
    const position = this.role === 'user' ? CLASS.messageRight : CLASS.messageLeft;

    const wrapper = this.doc.createElement('div');
    wrapper.className = `${CLASS.messageWrapper} ${position}`;
    wrapper.style.setProperty('--ss-bg-color', this.brandColor);
    wrapper.style.setProperty('--ss-txt-color', getTextColorForBackground(this.brandColor));

    const container = this.doc.createElement('div');
    container.className = CLASS.messageContainer;
    wrapper.appendChild(container);

    const group = this.doc.createElement('div');
    group.className = CLASS.messageGroup;
    container.appendChild(group);

    if (this.role === 'agent') {
      const avatarWrapper = this.doc.createElement('div');
      avatarWrapper.className = CLASS.messageAvatarWrapper;

      if (this.avatar) {
        const img = this.doc.createElement('img');
        img.className = CLASS.messageAvatar;
        img.src = this.avatar;
        img.alt = 'Brand logo';
        avatarWrapper.appendChild(img);
      }

      group.appendChild(avatarWrapper);
    }

    const bubble = this.doc.createElement('span');
    bubble.className = `${CLASS.message} ${position}${this.error ? ` ${CLASS.messageError}` : ''}`;
    group.appendChild(bubble);

    const textSpan = this.doc.createElement('span');
    textSpan.textContent = text;
    bubble.appendChild(textSpan);

    // A form belongs to the bubble it arrived with, so it sits inside the
    // message rather than in a shared region of the panel.
    if (this.formSpec) {
      const form = new Form({ doc: this.doc, spec: this.formSpec });
      this.children.push(form);
      container.appendChild(form.element);
    }

    if (this.onFeedback) {
      const feedback = new Feedback({
        doc: this.doc,
        messageId: this.messageId,
        onSubmit: this.onFeedback,
      });
      this.feedback = feedback;
      this.children.push(feedback);
      container.appendChild(feedback.element);
    }

    this.element = wrapper;
    this.textSpan = textSpan;
  }

  setText(text) {
    this.textSpan.textContent = text;
  }

  /** No-op when this message has no feedback pair (user messages, or collectFeedback off). */
  setFeedbackDisabled(disabled) {
    this.feedback?.setDisabled(disabled);
  }

  destroy() {
    this.children.forEach((child) => child.destroy());
    this.element.remove();
  }
}
