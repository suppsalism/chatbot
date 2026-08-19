// Exception to "components are styled by widget.css": this one
// renders into the host page — via the shell container, not document.body —
// because it must stay visible while the panel is collapsed. Its color comes
// from the --ss-brand custom property set on the shell container it lives
// inside; do not move its rules into widget.css.
import { CLASS } from '../constants/class-names';

export class Launcher {
  constructor({ doc, avatar, orientation = 'right', onToggle = () => {} }) {
    this.doc = doc;
    this.avatar = avatar;
    this.orientation = orientation;
    this.onToggle = onToggle;
    this.listeners = [];

    this.build();
  }

  on(node, event, handler) {
    node.addEventListener(event, handler);
    this.listeners.push([node, event, handler]);
  }

  build() {
    const orientationClass = this.orientation === 'left' ? CLASS.shellLeft : CLASS.shellRight;

    const button = this.doc.createElement('button');
    button.className = `${CLASS.launcher} ${orientationClass}`;
    button.setAttribute('aria-label', 'Open chat');

    this.element = button;
    this.avatarImg = null;
    if (this.avatar) this.setAvatar(this.avatar);

    this.on(button, 'click', () => this.onToggle());
  }

  setAvatar(avatar) {
    this.avatar = avatar;

    if (!avatar) {
      this.avatarImg?.remove();
      this.avatarImg = null;
      return;
    }

    if (!this.avatarImg) {
      this.avatarImg = this.doc.createElement('img');
      this.avatarImg.alt = 'Brand logo';
      this.element.appendChild(this.avatarImg);
    }
    this.avatarImg.src = avatar;
  }

  destroy() {
    this.listeners.forEach(([node, event, handler]) => node.removeEventListener(event, handler));
    this.element.remove();
  }
}
