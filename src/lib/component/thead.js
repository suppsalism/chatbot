import { CLASS } from '../constants/dom';
import { createIcon } from '../helper';

const CLOSE_ICON_PATH =
  'M19 6.41L17.59 5L12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z';

export class Thead {
  constructor({ doc, avatar, name, onClose = () => {} }) {
    this.doc = doc;
    this.avatar = avatar;
    this.name = name;
    this.onClose = onClose;
    this.listeners = [];

    this.build();
  }

  on(node, event, handler) {
    node.addEventListener(event, handler);
    this.listeners.push([node, event, handler]);
  }

  build() {
    const wrapper = this.doc.createElement('div');
    wrapper.className = CLASS.theadWrapper;

    const container = this.doc.createElement('div');
    container.className = CLASS.theadContainer;
    wrapper.appendChild(container);

    const content = this.doc.createElement('div');
    content.className = CLASS.theadContent;
    container.appendChild(content);

    const left = this.doc.createElement('div');
    left.className = CLASS.theadLeft;
    content.appendChild(left);
    this.leftEl = left;
    this.avatarImg = null;

    if (this.avatar) this.setAvatar(this.avatar);

    const name = this.doc.createElement('span');
    name.className = CLASS.theadName;
    name.textContent = this.name;
    left.appendChild(name);
    this.nameEl = name;

    const right = this.doc.createElement('div');
    right.className = CLASS.theadRight;
    content.appendChild(right);

    const closeButton = this.doc.createElement('button');
    closeButton.className = CLASS.theadClose;
    closeButton.setAttribute('aria-label', 'Close chat');
    closeButton.appendChild(createIcon(this.doc, { path: CLOSE_ICON_PATH, size: 20 }));
    right.appendChild(closeButton);

    this.on(closeButton, 'click', () => this.onClose());

    this.element = wrapper;
  }

  setName(name) {
    this.nameEl.textContent = name;
  }

  setAvatar(avatar) {
    if (!avatar) {
      this.avatarImg?.remove();
      this.avatarImg = null;
      return;
    }

    if (!this.avatarImg) {
      this.avatarImg = this.doc.createElement('img');
      this.avatarImg.className = CLASS.theadAvatar;
      this.avatarImg.alt = 'Brand logo';
      this.leftEl.insertBefore(this.avatarImg, this.leftEl.firstChild);
    }
    this.avatarImg.src = avatar;
  }

  destroy() {
    this.listeners.forEach(([node, event, handler]) => node.removeEventListener(event, handler));
    this.element.remove();
  }
}
