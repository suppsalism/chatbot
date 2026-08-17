import { Suggestion } from './suggestion';
import { CLASS } from '../constants/class-names';

export class SuggestionWrapper {
  constructor({ doc }) {
    this.doc = doc;
    this.listeners = [];
    this.children = [];

    this.build();
  }

  on(node, event, handler) {
    node.addEventListener(event, handler);
    this.listeners.push([node, event, handler]);
  }

  build() {
    const wrapper = this.doc.createElement('div');
    wrapper.className = CLASS.suggestionWrapperWrapper;

    const container = this.doc.createElement('div');
    container.className = CLASS.suggestionWrapperContainer;
    wrapper.appendChild(container);

    const content = this.doc.createElement('div');
    content.className = CLASS.suggestionWrapperContent;
    container.appendChild(content);

    this.element = wrapper;
    this.content = content;
  }

  addSuggestion({ text, onClick }) {
    const suggestion = new Suggestion({ doc: this.doc, text, onClick });
    this.children.push(suggestion);
    this.content.appendChild(suggestion.element);
  }

  /** Replaces the whole chip row — used when a reply carries new suggestions (spec §6.2). */
  setSuggestions(list, onClick) {
    this.children.forEach((child) => child.destroy());
    this.children = [];
    list.forEach((text) => this.addSuggestion({ text, onClick }));
  }

  setDisabled(disabled) {
    this.children.forEach((child) => child.setDisabled(disabled));
  }

  destroy() {
    this.children.forEach((child) => child.destroy());
    this.listeners.forEach(([node, event, handler]) => node.removeEventListener(event, handler));
    this.element.remove();
  }
}
