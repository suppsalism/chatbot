import { getTextColorForBackground } from '../utils/color';
import { CLASS } from '../constants/class-names';
import { Feedback } from './feedback';

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
  }) {
    this.doc = doc;
    this.role = role;
    this.avatar = avatar;
    this.brandColor = brandColor;
    this.error = error;
    this.messageId = messageId;
    this.onFeedback = onFeedback;
    this.children = [];

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

    if (this.onFeedback) {
      const feedback = new Feedback({
        doc: this.doc,
        messageId: this.messageId,
        onSubmit: this.onFeedback,
      });
      this.children.push(feedback);
      container.appendChild(feedback.element);
    }

    this.element = wrapper;
    this.textSpan = textSpan;
  }

  setText(text) {
    this.textSpan.textContent = text;
  }

  destroy() {
    this.children.forEach((child) => child.destroy());
    this.element.remove();
  }
}
