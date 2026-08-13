import { createChatbot } from './create-chatbot';
import { CONFIG_SCHEMA } from '../config/schema';
import { resolveConfig } from '../config/resolve';
import { parseAttributes } from '../config/parse-attributes';
import { splitOptions } from '../config/split-options';
import { CHAT_TAG_NAME, CHAT_READY_EVENT } from '../constants/dom';

/**
 * Registers the <ss-chat> custom element. A real registration rather than a
 * one-time tag scan (spec §11): tags added later by an SPA framework boot
 * automatically, DOM removal triggers destroy(), and live attribute edits
 * become updateConfig() calls.
 *
 * Registration is a global side effect, so it only happens when the
 * consumer calls this — never at module scope.
 *
 * The instance API is still reachable from a tag two ways: the element's
 * `.bot` getter (reliable once the element is connected — connectedCallback
 * runs synchronously on insertion), or the `ss-chat:ready` event it
 * dispatches with `{ detail: { bot } }`, for callers who want to react to a
 * specific node becoming ready rather than assume timing.
 */
export function defineChatElement({ onSendMessage, tagName = CHAT_TAG_NAME, ...rest }) {
  // Split once at registration: config fields become the low-precedence layer
  // that each tag's own data-* attributes override, while callbacks pass
  // straight through. Spreading `rest` wholesale would let a shared default
  // beat a per-tag attribute, which is backwards.
  const { config: sharedConfig, callbacks: sharedCallbacks } = splitOptions(rest);

  customElements.define(
    tagName,
    class extends HTMLElement {
      static get observedAttributes() {
        return CONFIG_SCHEMA.map((field) => field.attribute);
      }

      get bot() {
        return this._bot ?? null;
      }

      connectedCallback() {
        this._bot = createChatbot({
          ...sharedCallbacks,
          ...resolveConfig([sharedConfig, parseAttributes(this)]),
          onSendMessage,
          mount: this,
        });
        this.dispatchEvent(
          new CustomEvent(CHAT_READY_EVENT, { detail: { bot: this._bot }, bubbles: true })
        );
      }

      disconnectedCallback() {
        this._bot?.destroy();
        this._bot = null;
      }

      attributeChangedCallback() {
        // Re-resolved from both layers rather than from the attributes alone,
        // so removing an attribute reverts to the shared default rather than
        // stranding the last value it held.
        this._bot?.updateConfig(resolveConfig([sharedConfig, parseAttributes(this)]));
      }
    }
  );
}
