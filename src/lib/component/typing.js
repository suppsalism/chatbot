import { CLASS } from '../constants/dom';

export class Typing {
  constructor({ doc, avatar }) {
    this.doc = doc;
    this.avatar = avatar;

    this.build();
  }

  build() {
    const wrapper = this.doc.createElement('div');
    wrapper.className = `${CLASS.messageWrapper} ${CLASS.messageLeft}`;

    const container = this.doc.createElement('div');
    container.className = CLASS.messageContainer;
    wrapper.appendChild(container);

    const group = this.doc.createElement('div');
    group.className = CLASS.messageGroup;
    container.appendChild(group);

    if (this.avatar) {
      const avatarWrapper = this.doc.createElement('div');
      avatarWrapper.className = CLASS.messageAvatarWrapper;

      const img = this.doc.createElement('img');
      img.className = CLASS.messageAvatar;
      img.src = this.avatar;
      img.alt = 'Brand logo';
      avatarWrapper.appendChild(img);

      group.appendChild(avatarWrapper);
    }

    const bubble = this.doc.createElement('span');
    bubble.className = `${CLASS.message} ${CLASS.messageLeft}`;
    group.appendChild(bubble);

    const typing = this.doc.createElement('span');
    typing.className = CLASS.typing;
    bubble.appendChild(typing);

    for (let i = 0; i < 3; i += 1) {
      const dot = this.doc.createElement('span');
      dot.className = CLASS.typingDot;
      typing.appendChild(dot);
    }

    this.element = wrapper;
  }

  destroy() {
    this.element.remove();
  }
}
