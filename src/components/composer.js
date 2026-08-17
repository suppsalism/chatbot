import { createEffect, createMemo } from '../reactive/signal';
import { CLASS } from '../constants/class-names';
import { createIcon } from '../dom/icon';

const SEND_ICON_PATH = 'M2,21L23,12L2,3V10L17,12L2,14V21Z';

export class Composer {
  constructor({ doc, message, setMessage, disabledSubmit, placeholder = '', onSend = () => {} }) {
    this.doc = doc;
    this.message = message;
    this.setMessage = setMessage;
    this.disabledSubmit = disabledSubmit;
    this.placeholder = placeholder;
    this.onSend = onSend;
    this.listeners = [];
    this.disposeEffects = [];

    this.build();
  }

  on(node, event, handler) {
    node.addEventListener(event, handler);
    this.listeners.push([node, event, handler]);
  }

  build() {
    const wrapper = this.doc.createElement('div');
    wrapper.className = CLASS.composerWrapper;

    const container = this.doc.createElement('div');
    container.className = CLASS.composerContainer;
    wrapper.appendChild(container);

    const editor = this.doc.createElement('div');
    editor.className = CLASS.composerEditor;
    container.appendChild(editor);

    const expanded = this.doc.createElement('div');
    expanded.className = CLASS.composerExpanded;
    editor.appendChild(expanded);

    const content = this.doc.createElement('div');
    content.className = CLASS.composerContent;
    expanded.appendChild(content);

    const textarea = this.doc.createElement('div');
    textarea.className = CLASS.composerTextarea;
    textarea.contentEditable = 'true';
    textarea.setAttribute('placeholder', this.placeholder);
    textarea.tabIndex = 0;
    textarea.setAttribute('role', 'textbox');
    content.appendChild(textarea);

    const action = this.doc.createElement('div');
    action.className = CLASS.composerAction;
    editor.appendChild(action);

    const button = this.doc.createElement('button');
    button.className = CLASS.composerHighlight;
    button.appendChild(createIcon(this.doc, { path: SEND_ICON_PATH, size: 20 }));
    action.appendChild(button);

    const inputInvalid = createMemo(() => this.message().length === 0 || this.disabledSubmit());

    this.disposeEffects.push(
      createEffect(() => {
        button.disabled = inputInvalid();
        button.classList.toggle(CLASS.composerDisabled, inputInvalid());
      })
    );
    this.disposeEffects.push(
      createEffect(() => {
        textarea.contentEditable = this.disabledSubmit() ? 'false' : 'true';
        wrapper.classList.toggle(CLASS.composerDisabled, this.disabledSubmit());
      })
    );

    const send = () => {
      if (inputInvalid()) return;
      const text = this.message();
      textarea.textContent = '';
      this.setMessage('');
      this.onSend(text);
    };

    this.on(textarea, 'input', () => this.setMessage(textarea.textContent));
    this.on(textarea, 'keydown', (event) => {
      if (event.key === 'Enter' && event.shiftKey) return;
      if (event.key === 'Enter') {
        event.preventDefault();
        send();
      }
    });
    this.on(button, 'click', send);

    this.element = wrapper;
    this.textarea = textarea;
  }

  setPlaceholder(placeholder) {
    this.placeholder = placeholder;
    this.textarea.setAttribute('placeholder', placeholder);
  }

  destroy() {
    this.disposeEffects.forEach((dispose) => dispose());
    this.listeners.forEach(([node, event, handler]) => node.removeEventListener(event, handler));
    this.element.remove();
  }
}
