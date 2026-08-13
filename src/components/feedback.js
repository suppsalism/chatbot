import { CLASS } from '../constants/class-names';
import { createIcon } from '../dom/icon';

const THUMB_UP_PATH =
  'M2,21H4V9H2V21M23,10C23,9.45 22.55,9 22,9H15.69L16.64,4.43L16.67,4.11C16.67,3.7 16.5,3.32 16.23,3.05L15.17,2L8.59,8.59C8.22,8.95 8,9.45 8,10V19C8,20.1 8.9,21 10,21H18C18.83,21 19.54,20.5 19.84,19.78L22.86,12.73C22.95,12.5 23,12.26 23,12V10Z';
const THUMB_DOWN_PATH =
  'M22,3H20V15H22V3M1,14C1,14.55 1.45,15 2,15H8.31L7.36,19.57L7.33,19.89C7.33,20.3 7.5,20.68 7.77,20.95L8.83,22L15.41,15.41C15.78,15.05 16,14.55 16,14V5C16,3.9 15.1,3 14,3H6C5.17,3 4.46,3.5 4.16,4.22L1.14,11.27C1.05,11.5 1,11.74 1,12V14Z';

/** Thumbs up/down attached to an agent message when config.collectFeedback is on (spec §6.6). */
export class Feedback {
  constructor({ doc, messageId, onSubmit = () => {} }) {
    this.doc = doc;
    this.messageId = messageId;
    this.onSubmit = onSubmit;
    this.listeners = [];
    this.value = null;

    this.build();
  }

  on(node, event, handler) {
    node.addEventListener(event, handler);
    this.listeners.push([node, event, handler]);
  }

  build() {
    const wrapper = this.doc.createElement('div');
    wrapper.className = CLASS.feedbackWrapper;

    const up = this.doc.createElement('button');
    up.className = `${CLASS.feedbackButton} ${CLASS.feedbackUp}`;
    up.setAttribute('aria-label', 'Good response');
    up.appendChild(createIcon(this.doc, { path: THUMB_UP_PATH, size: 16 }));
    wrapper.appendChild(up);

    const down = this.doc.createElement('button');
    down.className = `${CLASS.feedbackButton} ${CLASS.feedbackDown}`;
    down.setAttribute('aria-label', 'Bad response');
    down.appendChild(createIcon(this.doc, { path: THUMB_DOWN_PATH, size: 16 }));
    wrapper.appendChild(down);

    this.on(up, 'click', () => this.submit('up', up, down));
    this.on(down, 'click', () => this.submit('down', down, up));

    this.element = wrapper;
    this.upButton = up;
    this.downButton = down;
  }

  submit(value, activeButton, otherButton) {
    this.value = value;
    activeButton.classList.add(CLASS.feedbackActive);
    otherButton.classList.remove(CLASS.feedbackActive);
    this.onSubmit({ messageId: this.messageId, value });
  }

  destroy() {
    this.listeners.forEach(([node, event, handler]) => node.removeEventListener(event, handler));
    this.element.remove();
  }
}
