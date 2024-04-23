'use strict';

const signal = {
  context: [],
  create_signal(value) {
    const subscriptions = new Set();

    const read = () => {
      const observer = this.context[this.context.length - 1];
      if (observer) subscriptions.add(observer);
      return value;
    };
    const write = (newValue) => {
      value = newValue;
      for (const observer of subscriptions) {
        observer.execute();
      }
    };

    return [read, write];
  },
  create_effect(fn) {
    const effect = {
      execute(self) {
        self?.context.push(effect);
        fn();
        self?.context.pop();
      },
    };

    effect.execute(this);
  },
  create_memo(fn) {
    const [signal, set_signal] = this.create_signal();
    this.create_effect(() => set_signal(fn()));
    return signal;
  },
};

function wrapper_component({ type = 'overlay' }) {
  const wrapper = document.createElement('div');
  wrapper.className = `wrapper ${type}`;
  wrapper.innerHTML = `
    <div class="container">
        <div class="content"></div>
    </div>
  `;

  return wrapper;
}

function thead_component({ avatar, name, on_close }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'thead-wrapper';

  wrapper.innerHTML = `
    <div class="thead-container">
        <div class="thead-content">
            <div class="left">
                <img class="avatar" src="${avatar}" alt="Brand logo" />
                <span class="name">${name}</span>
            </div>
            <div class="right">
                <button>
                    <svg viewBox="0 0 24 24" height="20" width="20" fill="currentColor">
                        <path d="M19 6.41L17.59 5L12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"/>
                    </svg>
                </button>
            </div>
        </div>
    </div>
  `;

  const close_button = wrapper.querySelector('button');
  close_button.addEventListener('click', on_close);

  return wrapper;
}

function signature_component() {
  const wrapper = document.createElement('div');
  wrapper.className = 'signature-wrapper';

  wrapper.innerHTML = `
    <span>Powered by suppsalism</span>
  `;

  return wrapper;
}

function message_wrapper_component({
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

function message_component({ position, message, avatar, color = '#fff' }) {
  function hex_to_rgb(hex) {
    let r = 0,
      g = 0,
      b = 0;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
      r = parseInt(hex.substring(1, 3), 16);
      g = parseInt(hex.substring(3, 5), 16);
      b = parseInt(hex.substring(5, 7), 16);
    }
    return { r, g, b };
  }

  function calculate_brightness({ r, g, b }) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  function get_text_color_for_bg(hex_color) {
    const rgb = hex_color.startsWith('#')
      ? hex_to_rgb(hex_color)
      : hex_color.match(/\d+/g).map(Number);
    const brightness = calculate_brightness(rgb);

    return brightness > 128 ? '#000' : '#fff';
  }

  const wrapper = document.createElement('div');
  wrapper.className = `message-wrapper ${position}`;
  wrapper.style.setProperty('--bg-color', color);
  wrapper.style.setProperty('--txt-color', get_text_color_for_bg(color));

  const container = document.createElement('div');
  container.className = 'message-container';
  wrapper.appendChild(container);

  const group_message = document.createElement('div');
  group_message.className = 'group-message';

  if (avatar) {
    const div = document.createElement('div');
    div.className = 'avatar-wrapper';

    const img = document.createElement('img');
    img.className = 'avatar';
    img.src = avatar;
    img.alt = 'Brand logo';
    div.appendChild(img);

    group_message.appendChild(div);
  }

  const message_span = document.createElement('span');
  message_span.className = `message ${position}`;
  group_message.appendChild(message_span);

  const textSpan = document.createElement('span');
  textSpan.textContent = message;
  message_span.appendChild(textSpan);

  container.appendChild(group_message);

  return wrapper;
}

function typing_component({ position, avatar, color = '#fff' }) {
  function hex_to_rgb(hex) {
    let r = 0,
      g = 0,
      b = 0;
    if (hex.length === 4) {
      r = parseInt(hex[1] + hex[1], 16);
      g = parseInt(hex[2] + hex[2], 16);
      b = parseInt(hex[3] + hex[3], 16);
    } else if (hex.length === 7) {
      r = parseInt(hex.substring(1, 3), 16);
      g = parseInt(hex.substring(3, 5), 16);
      b = parseInt(hex.substring(5, 7), 16);
    }
    return { r, g, b };
  }

  function calculate_brightness({ r, g, b }) {
    return 0.299 * r + 0.587 * g + 0.114 * b;
  }

  function get_text_color_for_bg(hex_color) {
    const rgb = hex_color.startsWith('#')
      ? hex_to_rgb(hex_color)
      : hex_color.match(/\d+/g).map(Number);
    const brightness = calculate_brightness(rgb);

    return brightness > 128 ? '#000' : '#fff';
  }

  const typing = document.createElement('span');
  typing.className = 'typing';

  for (let i = 1; i <= 3; i++) {
    const dot = document.createElement('span');
    dot.className = 'dot';
    typing.appendChild(dot);
  }

  const wrapper = document.createElement('div');
  wrapper.className = `message-wrapper ${position}`;
  wrapper.style.setProperty('--bg-color', color);
  wrapper.style.setProperty('--txt-color', get_text_color_for_bg(color));

  const container = document.createElement('div');
  container.className = 'message-container';
  wrapper.appendChild(container);

  const group_message = document.createElement('div');
  group_message.className = 'group-message';

  if (avatar) {
    const div = document.createElement('div');
    div.className = 'avatar-wrapper';

    const img = document.createElement('img');
    img.className = 'avatar';
    img.src = avatar;
    img.alt = 'Brand logo';
    div.appendChild(img);

    group_message.appendChild(div);
  }

  const message_span = document.createElement('span');
  message_span.className = `message ${position}`;
  group_message.appendChild(message_span);

  message_span.appendChild(typing);

  container.appendChild(group_message);

  return wrapper;
}

function launcher_component({
  avatar,
  color,
  position = 'right',
  on_toggle = () => {},
}) {
  const button = document.createElement('button');
  button.className = `launcher ${position}`;
  button.style.setProperty('--color', color);
  button.innerHTML = `<img src="${avatar}" alt="Brand logo" />`;

  button.addEventListener('click', on_toggle);

  return button;
}

function composer_component({
  message_state,
  disabled_submit_state,
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
    () => message_state().length === 0 || disabled_submit_state()
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
  textarea.innerText = message_state();
  textarea.setAttribute('placeholder', placeholder);
  textarea.tabIndex = 0;
  textarea.setAttribute('role', 'textbox');
  content.appendChild(textarea);

  action.className = 'action';
  editor.appendChild(action);

  button.classList.add('highlight');
  button.disabled = disabled_submit_state();
  button.innerHTML = `
    <svg viewBox="0 0 24 24" height="20" width="20" fill="currentColor">
      <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z" />
    </svg>`;
  action.appendChild(button);

  textarea.onkeyup = function (ev) {
    on_type(textarea.textContent);

    if (input_invalid()) {
      ev.stopPropagation();
      return;
    }

    if (ev.key === 'Enter' && ev.shiftKey) {
      ev.stopPropagation();
    } else if (ev.key === 'Enter') {
      ev.preventDefault();
      textarea.textContent = '';
      return on_send(message_state());
    }
  };

  button.onclick = function () {
    if (input_invalid()) {
      return;
    }
    textarea.textContent = '';
    return on_send(message_state());
  };

  return wrapper;
}

class ChatApp {
  constructor(node, attributes) {
    this.node = node;
    this.attributes = attributes;
    this.init_node();
    this.init_attribute();
    this.init_state();
    this.init_component();

    signal.create_effect(() => {
      if (this.chat_visible()) {
        this.wrapper_iframe_node.classList.add('visible');
      } else {
        this.wrapper_iframe_node.classList.remove('visible');
      }
    });

    signal.create_effect(() => {
      this.conversation_state().forEach(
        ({ avatar, message, position, typing }) => {
          if (typing) {
            this.typing = this.node
              .querySelector('.message-wrapper-container')
              .appendChild(
                typing_component({
                  avatar,
                  position,
                  color: this.brand_color,
                })
              );
            return;
          } else {
            if (this.typing) {
              this.typing.remove();
            }
            this.node.querySelector('.message-wrapper-container').appendChild(
              message_component({
                avatar,
                message,
                position,
                typing,
                color: this.brand_color,
              })
            );
          }
        }
      );
    });
  }

  init_node() {
    this.wrapper_iframe_node = document.getElementById(
      'suppsalism-messages-iframe-container'
    );

    this.wrapper_component = null;
    this.thead_component = null;
    this.signature_component = null;
    this.message_wrapper_component = null;
    this.message_component = null;
    this.typing_component = null;
    this.launcher_component = null;
    this.composer_component = null;
  }

  init_attribute() {
    Object.assign(this, {
      brand_color: this.attributes.brand_color,
      brand_logo_url: this.attributes.brand_logo_url,
      brand_name: this.attributes.brand_name,
      chatbot_key: this.attributes.chatbot_key,
      description: this.attributes.description,
      headline: this.attributes.headline,
      hosted_url: this.attributes.hosted_url,
      input_placeholder: this.attributes.input_placeholder,
      launcher_logo_url: this.attributes.launcher_logo_url,
      name: this.attributes.name,
      orientation: this.attributes.orientation,
      signature_visible: this.attributes.signature_visible,
      theme: this.attributes.theme,
      welcome_message: this.attributes.welcome_message,
    });
  }

  init_state() {
    [this.message_state, this.set_message_state] = signal.create_signal('');
    [this.disabled_submit_state, this.set_disabled_submit_state] =
      signal.create_signal(false);
    [this.chat_visible, this.set_chat_visible] = signal.create_signal(false);
    [this.conversation_state, this.set_conversation_state] =
      signal.create_signal(
        this.welcome_message.map((msg) => ({
          avatar: this.brand_logo_url,
          message: msg,
          position: 'left',
        }))
      );
  }

  init_component() {
    const launcher = launcher_component({
      avatar: this.launcher_logo_url,
      color: this.brand_color,
      position: this.orientation,
      on_toggle: () => {
        this.set_chat_visible(!this.chat_visible());
      },
    });

    // inject launcher layout
    document.body.appendChild(launcher);

    const wrapper_node = wrapper_component({});
    const wrapper_slot = wrapper_node.querySelector('.content');

    // inject thead layout
    wrapper_slot.appendChild(
      thead_component({
        avatar: this.brand_logo_url,
        name: this.brand_name,
        on_close: () => {
          this.set_chat_visible(false);
        },
      })
    );

    // inject message layout
    const message_wrapper_node = message_wrapper_component({});
    wrapper_slot.appendChild(message_wrapper_node);

    // inject composer layout
    wrapper_slot.appendChild(
      composer_component({
        placeholder: this.input_placeholder,
        message_state: this.message_state,
        disabled_submit_state: this.disabled_submit_state,
        on_send: (value) => {
          return this.send_message(value);
        },
        on_type: (value) => {
          return this.type_message(value);
        },
      })
    );

    // inject signature layout
    if (this.signature_visible) {
      wrapper_slot.appendChild(signature_component());
    }

    this.node.appendChild(wrapper_node);
  }

  type_message(message) {
    this.set_message_state(message.trim());
  }

  send_message(message) {
    this.add_message({ message: message, is_response: false });
    this.set_disabled_submit_state(true);

    return fetch('http://127.0.0.1:5000/api/qa', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: message, chatbot_key: this.chatbot_key }),
    })
      .then(async (response) => {
        const { answer } = await response.json();
        this.add_message({ message: answer, is_response: true });
      })
      .catch((err) => {
        throw new Error(`Failed to send message: ${err.message}`);
      })
      .finally(() => {
        this.set_disabled_submit_state(false);
      });
  }

  add_message({ message, is_response = false }) {
    if (!is_response) {
      this.set_conversation_state([
        { message: message, position: 'right', typing: false },
        { avatar: this.brand_logo_url, typing: true, position: 'left' },
      ]);
    } else {
      this.set_conversation_state([
        {
          avatar: this.brand_logo_url,
          message: message,
          position: 'left',
          typing: false,
        },
      ]);
    }
  }
}

class DOMInitializer {
  constructor() {
    [this.attribute_state, this.set_attribute_state] = signal.create_signal({
      position: 'right',
      theme: 'light',
    });

    this.head = document.head;
    this.body = document.body;
    this.chat = document.getElementsByTagName('ss-chat')[0];

    this.meta_viewport = null;
    this.meta_charset = null;
    this.link_css = null;
    this.style_tag = null;
    this.container = null;
    this.iframe = null;

    this.create_meta_viewport();
    this.create_meta_charset();
    this.create_link_css();
    this.create_style_tag();

    signal.create_effect(() => {
      this.position = this.attribute_state().orientation;
      this.theme = this.attribute_state().theme;
    });
  }

  create_meta_viewport() {
    this.meta_viewport = document.createElement('meta');
    this.meta_viewport.name = 'viewport';
    this.meta_viewport.content =
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0';
  }

  create_meta_charset() {
    this.meta_charset = document.createElement('meta');
    this.meta_charset.charset = 'utf-8';
  }

  create_link_css() {
    this.link_css = document.createElement('link');
    this.link_css.href = 'http://127.0.0.1:5500/src/style.css';
    this.link_css.rel = 'stylesheet';
    this.link_css.type = 'text/css';
  }

  create_style_tag() {
    this.style_tag = document.createElement('style');
    this.style_tag.textContent = `
.launcher {
  border-radius: 50%;
  border: none;
  height: 64px;
  width: 64px;
  background-color: var(--color);
  cursor: pointer;
  position: absolute;
  bottom: 42px;
}

.launcher.right {
  right: 25px;
}

.launcher.left {
  left: 25px;
}

.launcher img {
  max-width: 40px;
  max-height: 40px;
  width: 100%;
  height: 100%;
}

#suppsalism-messages-iframe-container {
  display: initial;
  z-index: 2147483647;
  position: fixed;
  bottom: -1000px;
  opacity: 0;
  border-radius: 8px;
  box-shadow: 0 2px 5px 0 #c1c1c1;
  overflow: hidden;
}

#suppsalism-messages-iframe-container.visible {
  bottom: 117px;
  min-height: 96px;
  min-width: 100px;
  width: 445px;
  height: 664px;
  opacity: 1;
  animation: fadeInOpacity 0.15s ease-in 1;
}

@keyframes fadeInOpacity {
  0% {
    opacity: 0;
  }
  100% {
    opacity: 1;
  }
}

@media only screen and (max-width: 768px) {
  #suppsalism-messages-iframe-container.visible {
    height: 100%;
    width: 100%;
    right: 0 !important;
    left: 0 !important;
    top: 0;
  }
}

#suppsalism-messages-iframe-container.right {
  right: 25px;
}

#suppsalism-messages-iframe-container.left {
  left: 25px;
}

#suppsalism-iframe {
  display: initial !important;
  width: 100% !important;
  height: 100% !important;
  border: none !important;
  position: absolute !important;
  bottom: 0 !important;
  right: 0 !important;
  background: transparent !important;
}
    `;
  }

  setup_container() {
    this.container = document.createElement('div');
    this.container.setAttribute('role', 'region');
    this.container.setAttribute('aria-label', 'Chat Widget');
    this.container.id = 'suppsalism-messages-iframe-container';
    this.container.className = `${this.position}`;

    this.head.appendChild(this.style_tag);
    this.body.appendChild(this.container);
  }

  setup_iframe() {
    this.iframe = document.createElement('iframe');
    this.iframe.id = 'suppsalism-iframe';
    this.iframe.allowTransparency = 'true';
    this.iframe.style.border = '0';

    this.container.appendChild(this.iframe);

    this.iframe.contentWindow.document.body.setAttribute(
      'class',
      `theme-${this.theme}`
    );
    this.iframe.contentWindow.document.head.appendChild(this.meta_charset);
    this.iframe.contentWindow.document.head.appendChild(this.meta_viewport);
    this.iframe.contentWindow.document.head.appendChild(this.link_css);
  }

  setup_config() {
    return fetch(`http://127.0.0.1:5000/api/chatbot/${this.chat.dataset.key}`)
      .then((response) => response.json())
      .catch((error) => {
        throw new Error(`Failed to fetch chatbot: ${error.message}`);
      });
  }

  build_chatbot() {
    new ChatApp(
      this.iframe.contentWindow.document.body,
      this.attribute_state()
    );
  }

  execute() {
    return this.setup_config()
      .then((attributes) => {
        this.set_attribute_state(attributes);
      })
      .then(() => {
        this.setup_container();
        this.setup_iframe();
      })
      .then(() => {
        this.build_chatbot();
      })
      .catch((err) => {
        console.log(err);
      });
  }
}

const initializer = new DOMInitializer();
initializer.execute();
