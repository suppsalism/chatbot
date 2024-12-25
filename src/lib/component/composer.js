import signal from '../store/signal';

export default function composer_component({
  message, // flagged as a bindable state property
  disabled_submit, // flagged as a bindable state property
  placeholder = '',
  on_send = () => {},
  on_type = () => {},
}) {
  const wrapper = document.createElement('div');
  const container = document.createElement('div');
  const editor = document.createElement('div');
  const expanded = document.createElement('div');
  const content = document.createElement('div');
  const textarea = document.createElement('div');
  const action = document.createElement('div');
  const button = document.createElement('button');

  const input_invalid = signal.create_memo(
    () => message().length === 0 || disabled_submit()
  );

  signal.create_effect(() => {
    if (input_invalid()) {
      button.disabled = input_invalid();
      button.classList.add('disabled');
    } else {
      button.disabled = input_invalid();
      button.classList.remove('disabled');
    }
  });

  wrapper.className = 'composer-wrapper';

  container.className = 'composer-container';
  wrapper.appendChild(container);

  editor.className = 'editor';
  container.appendChild(editor);

  expanded.className = 'expanded';
  editor.appendChild(expanded);

  content.className = 'content';
  expanded.appendChild(content);

  textarea.className = 'textarea';
  textarea.contentEditable = true;
  textarea.innerText = message();
  textarea.setAttribute('placeholder', placeholder);
  textarea.tabIndex = 0;
  textarea.setAttribute('role', 'textbox');
  content.appendChild(textarea);

  action.className = 'action';
  editor.appendChild(action);

  button.classList.add('highlight');
  button.disabled = disabled_submit();
  button.innerHTML = `
      <svg viewBox="0 0 24 24" height="20" width="20" fill="currentColor">
        <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z" />
      </svg>`;
  action.appendChild(button);

  textarea.onkeydown = function (ev) {
    on_type(textarea.innerText);

    if (input_invalid()) {
      ev.stopPropagation();
      return;
    }

    if (ev.key === 'Enter' && ev.shiftKey) {
      ev.stopPropagation();
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      textarea.innerText = '';
      return on_send(message());
    }
  };

  button.onclick = function () {
    if (input_invalid()) {
      return;
    }
    textarea.innerText = '';
    return on_send(message());
  };

  return wrapper;
}
