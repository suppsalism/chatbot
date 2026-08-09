import { CLASS } from '../constants/dom';

export class Signature {
  constructor({ doc }) {
    this.doc = doc;
    this.build();
  }

  build() {
    const wrapper = this.doc.createElement('div');
    wrapper.className = CLASS.signatureWrapper;

    const link = this.doc.createElement('a');
    link.className = CLASS.signature;
    link.href = 'https://suppsalism.com';
    link.target = '_blank';
    link.rel = 'noopener noreferrer';
    link.textContent = 'Powered by suppsalism';
    wrapper.appendChild(link);

    this.element = wrapper;
  }

  destroy() {
    this.element.remove();
  }
}
