('use strict');

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

function composer_components({
  message = '',
  disabled = false,
  on_send = () => {},
  on_type = () => {},
}) {
  var [message_state, set_message_state] = signal.create_signal(message);
  var [disabled_state, set_disabled_state] = signal.create_signal(disabled);

  var wrapper_el = document.createElement('div');
  var input_el = document.createElement('input');
  var btn_el = document.createElement('button');

  signal.create_effect(() => {
    btn_el.disabled = disabled_state();
    input_el.textContent = message_state();
  });

  input_el.onkeyup = function (ev) {
    var value = ev.target.value.trim();
    set_disabled_state(value.length === 0);
    set_message_state(value);
    return Promise.all([on_type(message_state())]).then(() => {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        return on_send(message_state());
      }
    });
  };

  btn_el.textContent = 'Send';
  btn_el.onclick =
    !disabled_state() &&
    function () {
      return on_send(message_state());
    };

  wrapper_el.appendChild(input_el);
  wrapper_el.appendChild(btn_el);

  return wrapper_el;
}

class ChatApp {
  constructor(node, attributes) {
    this.node = node;
    this.chat_visible = false;
    this.message_form_disabled = false;
    this.message = '';
    this.init_attributes(attributes);
    this.init_conversation();
    this.init_components();
  }

  init_attributes(attributes) {
    Object.assign(this, {
      brand_color: attributes.brand_color,
      brand_logo_url: attributes.brand_logo_url,
      brand_name: attributes.brand_name,
      chatbot_key: attributes.chatbot_key,
      description: attributes.description,
      headline: attributes.headline,
      hosted_url: attributes.hosted_url,
      input_placeholder: attributes.input_placeholder,
      launcher_logo_url: attributes.launcher_logo_url,
      name: attributes.name,
      orientation: attributes.orientation,
      signature_visible: attributes.signature_visible,
      theme: attributes.theme,
      welcome_message: attributes.welcome_message,
    });
  }

  init_conversation() {
    this.conversation = this.welcome_message.map((msg) => ({
      avatar: this.brand_logo_url,
      message: msg,
      position: 'left',
    }));
  }

  init_components() {
    pub_sub.subscribe('toggle_chat_visibility', () => {
      this.toggle_wrapper_visibility();
    });
    pub_sub.subscribe('update_conversation', () => {
      this.render_conversation();
    });

    const launcher = launcher_component({
      avatar: this.launcher_logo_url,
      color: this.brand_color,
      position: this.orientation,
      on_toggle: () => this.handle_toggle_chat_visibility(),
    });

    // inject launcher layout
    document.body.appendChild(launcher);
  }

  async send_message(value) {
    this.add_message({ message: value, is_response: false });
    this.message = '';
    this.message_form_disabled = true;

    try {
      const response = await fetch('http://127.0.0.1:5000/api/qa', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: value, chatbot_key: this.chatbot_key }),
      });
      const { answer } = await response.json();
      this.add_message({ message: answer, is_response: true });
    } catch (err) {
      console.error('Failed to send message:', err);
    } finally {
      this.message_form_disabled = false;
    }
  }

  add_message({ message, is_response = false }) {
    if (!is_response) {
      this.conversation = [
        ...this.conversation,
        { message: message, position: 'right' },
        { avatar: this.brand_logo_url, typing: true, position: 'left' },
      ];
    } else {
      this.conversation = [
        ...this.conversation.slice(0, -1),
        {
          avatar: this.brand_logo_url,
          message: message,
          position: 'left',
        },
      ];
    }
    this.update_ui();
  }

  update_ui() {
    pub_sub.publish('update_conversation');
  }

  handle_toggle_chat_visibility() {
    this.chat_visible = !this.chat_visible;
    pub_sub.publish('toggle_chat_visibility', this.chat_visible);
  }

  toggle_wrapper_visibility() {
    const wrapper_iframe_node = document.getElementById(
      'suppsalism-messages-iframe-container'
    );
    if (this.chat_visible) {
      this.wrapper_node = this.inject_component();
      this.node.appendChild(this.wrapper_node);
      wrapper_iframe_node.classList.add('visible');
    } else if (this.wrapper_node) {
      this.node.removeChild(this.wrapper_node);
      this.wrapper_node = null;
      wrapper_iframe_node.classList.remove('visible');
    }
  }

  render_conversation() {
    if (!this.wrapper_node) return;
    const message_container = this.wrapper_node.querySelector(
      '.message-wrapper-container'
    );
    message_container.innerHTML = '';

    this.conversation.forEach(({ avatar, message, position, typing }) => {
      message_container.appendChild(
        message_component({
          avatar,
          message,
          position,
          typing,
          color: this.brand_color,
        })
      );
    });
  }

  inject_component() {
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
        on_close: () => this.handle_toggle_chat_visibility(),
      })
    );

    // inject message layout
    const message_wrapper_node = message_wrapper_component({});
    const message_wrapper_slot = message_wrapper_node.querySelector(
      '.message-wrapper-container'
    );
    this.conversation.forEach(({ avatar, message, position, typing }) => {
      message_wrapper_slot.appendChild(
        message_component({
          avatar,
          message,
          position,
          typing,
          color: this.brand_color,
        })
      );
    });
    wrapper_slot.appendChild(message_wrapper_node);

    // inject composer layout
    wrapper_slot.appendChild(
      composer_component({
        placeholder: this.input_placeholder,
        message: '',
        disabled: true,
        on_send: (value) => {
          this.send_message(value);
        },
        on_type: (value) => {
          console.log('Typing...', value);
        },
      })
    );

    // inject signature layout
    if (this.signature_visible) {
      wrapper_slot.appendChild(signature_component());
    }
    return wrapper_node;
  }
}

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

function typing_component() {
  const typing = document.createElement('span');
  typing.className = 'typing';

  for (let i = 1; i <= 3; i++) {
    const dot = document.createElement('span');
    dot.className = 'dot';
    typing.appendChild(dot);
  }

  return typing;
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

function message_component({
  position,
  message,
  avatar,
  typing = false,
  color = '#fff',
}) {
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

  if (typing) {
    const typing_indicator = typing_component();
    message_span.appendChild(typing_indicator);
  } else {
    const textSpan = document.createElement('span');
    textSpan.textContent = message;
    message_span.appendChild(textSpan);
  }

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
  placeholder = '',
  message = '',
  disabled = false,
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

  const [message_state, set_message_state] = signal.create_signal(message);
  const [disabled_state, set_disabled_state] = signal.create_signal(disabled);

  signal.create_effect(() => {
    if (disabled_state()) {
      button.disabled = disabled_state();
      button.classList.add('disabled');
    } else {
      button.disabled = disabled_state();
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
  textarea.innerText = message;
  textarea.setAttribute('placeholder', placeholder);
  textarea.tabIndex = 0;
  textarea.setAttribute('role', 'textbox');
  content.appendChild(textarea);

  action.className = 'action';
  editor.appendChild(action);

  button.classList.add('highlight');
  button.innerHTML = `
    <svg viewBox="0 0 24 24" height="20" width="20" fill="currentColor">
      <path d="M2,21L23,12L2,3V10L17,12L2,14V21Z" />
    </svg>`;
  action.appendChild(button);

  textarea.onkeyup = function (ev) {
    let value = textarea.textContent.trim();
    set_disabled_state(value.length === 0);
    set_message_state(value);

    if (value.length === 0 || disabled_state()) {
      ev.stopPropagation();
      return;
    }

    return Promise.all([on_type(value)]).then(() => {
      if (ev.key === 'Enter' && !ev.shiftKey) {
        ev.preventDefault();
        textarea.textContent = '';
        set_message_state('');
        set_disabled_state(true);
        return on_send(value);
      }
    });
  };

  button.onclick =
    !disabled_state() &&
    function () {
      set_message_state('');
      set_disabled_state(true);
      return on_send(message_state());
    };

  return wrapper;
}

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
