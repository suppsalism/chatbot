export default function suggestion_wrapper_component({}) {
  const wrapper = document.createElement('div');
  const container = document.createElement('div');
  const content = document.createElement('div');

  wrapper.className = 'suggestion-wrapper-wrapper';
  wrapper.appendChild(container);

  container.className = 'suggestion-wrapper-container';
  container.appendChild(content);

  content.className = 'suggestion-wrapper-content';

  return wrapper;
}
