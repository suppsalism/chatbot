export default function message_wrapper_component({
  behavior = 'smooth',
  block = 'end',
  inline = 'end',
}) {
  const wrapper = document.createElement('div');
  wrapper.className = 'message-wrapper-wrapper';

  const container = document.createElement('div');
  container.className = 'message-wrapper-container';
  wrapper.appendChild(container);

  const config = { attributes: true, childList: true, subtree: true };

  function scroll_to_bottom() {
    container.scrollIntoView({ behavior, block, inline });
  }

  function callback(mutationList) {
    for (const mutation of mutationList) {
      if (mutation.type === 'childList') {
        scroll_to_bottom();
      }
    }
  }

  const observer = new MutationObserver(callback);
  observer.observe(container, config);

  return wrapper;
}
