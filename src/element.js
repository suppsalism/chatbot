import { createChatbot } from './core';
import { CONFIG_SCHEMA } from './lib/config/schema';
import { resolveConfig } from './lib/config/resolve';
import { parseAttributes } from './lib/config/parse-attributes';
import { CHAT_TAG_NAME } from './lib/constants/dom';

/**
 * Registers the <ss-chat> custom element. A real registration rather than a
 * one-time tag scan (spec §11): tags added later by an SPA framework boot
 * automatically, DOM removal triggers destroy(), and live attribute edits
 * become updateConfig() calls.
 *
 * Registration is a global side effect, so it only happens when the
 * consumer calls this — never at module scope.
 */
export function defineChatElement({ onSendMessage, tagName = CHAT_TAG_NAME, ...rest }) {
  customElements.define(
    tagName,
    class extends HTMLElement {
      static get observedAttributes() {
        return CONFIG_SCHEMA.map((field) => field.attribute);
      }

      connectedCallback() {
        this._bot = createChatbot({
          ...resolveConfig([parseAttributes(this)]),
          ...rest,
          onSendMessage,
          mount: this,
        });
      }

      disconnectedCallback() {
        this._bot?.destroy();
        this._bot = null;
      }

      attributeChangedCallback() {
        this._bot?.updateConfig(resolveConfig([parseAttributes(this)]));
      }
    }
  );
}
