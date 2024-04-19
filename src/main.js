'use strict';

// START: store patterns
const pub_sub = {
  events: {},
  subscribe(event, callback) {
    if (!this.events[event]) this.events[event] = [];
    this.events[event].push(callback);
  },
  publish(event, data) {
    if (this.events[event])
      this.events[event].forEach((callback) => callback(data));
  },
};

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
// END: store patterns

// START: core class chat app
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

    const wrapper_node = wrapper_component({
      position: this.orientation,
      mode: this.theme,
    });
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
    this.set_message_state(message);
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
// END: core class chat app

// START: components
function wrapper_component({
  type = 'overlay',
  position = 'right',
  mode = 'light',
}) {
  document.body.className = `theme-${mode}`;

  function quad_in(t, b, c, d) {
    t /= d;
    return c * t * t + b;
  }

  const wrapper = document.createElement('div');
  wrapper.className = `wrapper ${type} ${position}`;
  wrapper.innerHTML = `
    <div class="container">
        <div class="content"></div>
    </div>
  `;

  wrapper.style.opacity = 0;
  setTimeout(() => {
    wrapper.style.transition = `opacity 150ms ${quad_in(0, 0, 1, 1)}`;
    wrapper.style.opacity = 1;
  }, 0);

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

function message_wrapper_component({ behavior = 'auto' }) {
  const wrapper = document.createElement('div');
  wrapper.className = 'message-wrapper-wrapper';

  const container = document.createElement('div');
  container.className = 'message-wrapper-container';
  wrapper.appendChild(container);

  function scrollToBottom() {
    container.scroll({ top: container.scrollHeight, behavior: behavior });
  }

  const observer = new MutationObserver((mutations) => {
    const hasNewMessages = mutations.some(
      (mutation) => mutation.addedNodes.length > 0
    );
    if (hasNewMessages) {
      scrollToBottom();
    }
  });

  const config = { childList: true };

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
  container.appendChild(group_message);

  if (avatar) {
    const img = document.createElement('img');
    img.className = 'avatar';
    img.src = avatar;
    img.alt = 'Brand logo';
    group_message.appendChild(img);
  }

  const message_span = document.createElement('span');
  message_span.className = `message ${position}`;
  group_message.appendChild(message_span);

  const textSpan = document.createElement('span');
  textSpan.textContent = message;
  message_span.appendChild(textSpan);

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
  container.appendChild(group_message);

  if (avatar) {
    const img = document.createElement('img');
    img.className = 'avatar';
    img.src = avatar;
    img.alt = 'Brand logo';
    group_message.appendChild(img);
  }

  const message_span = document.createElement('span');
  message_span.className = `message ${position}`;
  group_message.appendChild(message_span);

  message_span.appendChild(typing);

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
// END: components

// START: utils
function find_chatbot(key) {
  return fetch(`http://127.0.0.1:5000/api/chatbot/${key}`)
    .then((response) => {
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      return response.json();
    })
    .catch((err) => {
      throw new Error(`Failed to fetch chatbot: ${err.message}`);
    });
}

function create_link_element(href, rel, type) {
  const link = document.createElement('link');
  link.href = href;
  link.rel = rel;
  link.type = type;
  return link;
}

function create_meta_element(attributes) {
  const meta = document.createElement('meta');
  for (const key in attributes) {
    meta.setAttribute(key, attributes[key]);
  }
  return meta;
}

function create_style_element(css) {
  const style = document.createElement('style');
  style.innerHTML = css;
  return style;
}

function create_element(tagName, attributes) {
  const element = document.createElement(tagName);
  for (const key in attributes) {
    element.setAttribute(key, attributes[key]);
  }
  return element;
}

function append_to_parent(parent, child) {
  parent.appendChild(child);
}
// END: utils

// START: init DOM elements
function initialize_DOM_elements() {
  const css_link = create_link_element(
    'http://127.0.0.1:5500/src/style.css',
    'stylesheet',
    'text/css'
  );
  const meta_view_port = create_meta_element({
    name: 'viewport',
    content:
      'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0,',
  });
  const meta_utf = create_meta_element({ charset: 'utf-8' });
  const style = create_style_element(`
  .launcher {
    border-radius: 50%;
    border: none;
    height: 64px;
    width: 64px;
    background-color: var(--color);
    cursor: pointer;
    position: absolute;
    bottom: 42px;
    right: 25px;
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
    visibility: hidden;
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
    visibility: visible;
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
  }`);

  append_to_parent(document.head, style);

  const container = create_element('div', {
    role: 'region',
    'aria-label': 'Chat Widget',
    id: 'suppsalism-messages-iframe-container',
    class: 'right',
  });

  append_to_parent(document.body, container);

  const iframe = create_element('iframe', {
    id: 'suppsalism-iframe',
    allowTransparency: 'true',
  });
  iframe.style.border = '0';
  append_to_parent(container, iframe);

  setTimeout(() => {
    append_to_parent(iframe.contentWindow.document.head, meta_utf);
    append_to_parent(iframe.contentWindow.document.head, meta_view_port);
    append_to_parent(iframe.contentWindow.document.head, css_link);
    iframe.contentWindow.document.body.setAttribute('class', 'theme-light');

    new ChatApp(iframe.contentWindow.document.body, {
      account_id: '660d3ac198327d2fc8c5ba43',
      headline: 'Chat with our AI',
      description: 'Ask any question and our AI will answer!',
      welcome_message: [
        "Hello Ilyass,\nI'm Deel's virtual assistant 👋\n\nHow can I help you today?",
      ],
      brand_color: '#c4b1f9',
      brand_name: 'Virtal assistant',
      brand_logo_url:
        'https://core-files.chatbotize.com/creator/d1522a8c1bfe4090aa82a221f735aa51/836ff4d8656940a5a1dce16c97df7ae1.png?GoogleAccessId=cbt-prod-creator-file-service%40maximal-arcade-267011.iam.gserviceaccount.com&Expires=2026827458&Signature=CD/k9%2B/13pXUF4Ba6qdDZ9IqBeLCgrGwy3LEw4CsiEaAJTWqfmDv/%2BJ3eVUmpdWPoEIEdUF5rNjiAefnUtp5pMiU25CT93slaPIV2f4yTYyQ6TLOb1DfBqK97UWXOXL8BlxCYk8da/9n18CsGOf4/7fE8G5sGXBy2FJCdPAi3l7RzGAAFRoaPe1etBjxyNMUoWgf0pbJpFYiZsTpx0qvofjvJFlQYMPILBzmYRGRtEizNWrY2i6PicFaaI8C7UCuuPZM%2BHd8J4cFj3nz/rGfLnJufk/URJzZQFhaS3A4lzL1HREmBsYlW%2BXu7d6bPVEPiiW3R6KjOhzbbOklL/V48Q%3D%3D&serveFromGCP=true',
      launcher_logo_url:
        'https://storage.googleapis.com/suppsalism-docs/1be13055-9d27-481e-a190-d5149177ba6a-mingcute--chat-2-fill-(1).svg',
      theme: 'light',
      orientation: 'right',
      signature_visible: true,
      input_placeholder: 'Type your message...',
      name: "Deel's AI Assistant",
      chatbot_id: 'c68b7bb7-9a08-434d-a448-12c7da339afb',
      hosted_url: 'cdn.ai.chat.suppsalism.com/5f5b3b4b4f6b4d0001f3b3b4',
      chatbot_key: '5f5b3b4b4f6b4d0001f3b3b4',
    });
  }, 0);
}

initialize_DOM_elements();
// END: init DOM elements
