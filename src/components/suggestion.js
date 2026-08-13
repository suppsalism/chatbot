import { CLASS } from '../constants/class-names';

export class Suggestion {
  constructor({ doc, text, disabled = false, onClick = () => {} }) {
    this.doc = doc;
    this.text = text;
    this.onClick = onClick;
    this.listeners = [];

    this.build();
    this.setDisabled(disabled);
  }

  on(node, event, handler) {
    node.addEventListener(event, handler);
    this.listeners.push([node, event, handler]);
  }

  build() {
    const button = this.doc.createElement('button');
    button.className = CLASS.suggestion;
    button.textContent = this.text;

    this.on(button, 'click', () => {
      if (button.disabled) return;
      this.onClick(this.text);
    });

    this.element = button;
  }

  setDisabled(disabled) {
    this.element.disabled = disabled;
    this.element.classList.toggle(CLASS.suggestionDisabled, disabled);
  }

  destroy() {
    this.listeners.forEach(([node, event, handler]) => node.removeEventListener(event, handler));
    this.element.remove();
  }
}
