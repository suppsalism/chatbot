import { CLASS } from '../constants/dom';

export class Wrapper {
  constructor({ doc }) {
    this.doc = doc;
    this.build();
  }

  build() {
    const wrapper = this.doc.createElement('div');
    wrapper.className = CLASS.wrapper;

    const container = this.doc.createElement('div');
    container.className = CLASS.wrapperContainer;
    wrapper.appendChild(container);

    const content = this.doc.createElement('div');
    content.className = CLASS.wrapperContent;
    container.appendChild(content);

    this.element = wrapper;
    this.content = content;
  }

  destroy() {
    this.element.remove();
  }
}
