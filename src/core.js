'use strict';

import composer_component from './lib/component/composer';
import launcher_component from './lib/component/launcher';
import message_component from './lib/component/message';
import message_wrapper_component from './lib/component/message-wrapper';
import signature_component from './lib/component/signature';
import thead_component from './lib/component/thead';
import typing_component from './lib/component/typing';
import wrapper_component from './lib/component/wrapper';

import { API_URL } from './lib/constant';
import { generate_uuid } from './lib/helper';
import signal from './lib/store/signal';

import css from './style.css';

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
      session_id: this.attributes.session_id,
      chatbot_key: this.attributes.chatbot_key,
      display_name: this.attributes.display_name,
      initial_messages: this.attributes.initial_messages,
      suggested_message: this.attributes.suggested_message, // NOT USED YET
      message_placeholder: this.attributes.message_placeholder, // NOT USED YET
      text_footer: this.attributes.text_footer, // NOT USED YET
      brand_color: this.attributes.brand_color,
      brand_name: this.attributes.brand_name,
      brand_logo: this.attributes.brand_logo,
      launcher_logo: this.attributes.launcher_logo,
      theme: this.attributes.theme,
      orientation: this.attributes.orientation,
      signature_visible: this.attributes.signature_visible,
      collect_user_feedback: this.attributes.collect_user_feedback, // NOT USED YET
      regenerate_message: this.attributes.regenerate_message, // NOT USED YET
    });
  }

  init_state() {
    [this.message_state, this.set_message_state] = signal.create_signal('');
    [this.disabled_submit_state, this.set_disabled_submit_state] =
      signal.create_signal(false);
    [this.chat_visible, this.set_chat_visible] = signal.create_signal(false);
    [this.conversation_state, this.set_conversation_state] =
      signal.create_signal(
        this.initial_messages.map((message, index) => ({
          avatar:
            this.initial_messages.length - 1 === index
              ? this.brand_logo
              : undefined,
          message: message,
          position: 'left',
        }))
      );
  }

  init_component() {
    const launcher = launcher_component({
      avatar: this.launcher_logo,
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
        avatar: this.brand_logo,
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
        placeholder: this.message_placeholder,
        message: this.message_state,
        disabled_submit: this.disabled_submit_state,
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

    return fetch(`${API_URL}/qa`, {
      method: 'POST',
      body: JSON.stringify({
        session: this.session_id,
        key: this.chatbot_key,
        query: message,
      }),
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
        { avatar: this.brand_logo, typing: true, position: 'left' },
      ]);
    } else {
      this.set_conversation_state([
        {
          avatar: this.brand_logo,
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
    this.init_node();
    this.init_attribute();

    this.create_meta_viewport();
    this.create_meta_charset();
    this.create_link_css();
    this.create_style_tag();
  }

  init_node() {
    this.head = document.head;
    this.body = document.body;
    this.chat = document.getElementsByTagName('ss-chat')[0];

    this.meta_viewport = null;
    this.meta_charset = null;
    this.link_css = null;
    this.style_tag = null;
    this.container = null;
    this.iframe = null;
  }

  init_attribute() {
    [this.attribute_state, this.set_attribute_state] = signal.create_signal({
      session_id: this.chat.dataset.session || generate_uuid(),
      chatbot_key: this.chat.dataset.key,
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
    this.link_css = document.createElement('style');
    this.link_css.textContent = css;
  }

  create_style_tag() {
    this.style_tag = document.createElement('style');
    this.style_tag.textContent = `
.launcher {
  display: flex;
  align-items: center;
  justify-content: center;
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
    this.container.className = `${this.attribute_state().orientation}`;

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
      `theme-${this.attribute_state().theme}`
    );
    this.iframe.contentWindow.document.head.appendChild(this.meta_charset);
    this.iframe.contentWindow.document.head.appendChild(this.meta_viewport);
    this.iframe.contentWindow.document.head.appendChild(this.link_css);
  }

  setup_config() {
    return fetch(`${API_URL}/chatbot/${this.attribute_state().chatbot_key}`)
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
        this.set_attribute_state({
          ...this.attribute_state(),
          ...attributes,
        });
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
