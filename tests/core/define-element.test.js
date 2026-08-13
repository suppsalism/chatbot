import { describe, it, expect, vi, beforeEach } from 'vitest';
import { defineChatElement } from '../../src/core/define-element';

const noopSend = () => 'ok';

// customElements.define() is global and irreversible, so every test registers
// its own tag name.
let tagCounter = 0;
const nextTag = () => `ss-chat-test-${(tagCounter += 1)}`;

describe('defineChatElement', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    document.body.innerHTML = '';
  });

  it('registers the custom element', () => {
    const tagName = nextTag();
    defineChatElement({ tagName, onSendMessage: noopSend });
    expect(customElements.get(tagName)).toBeTypeOf('function');
  });

  it('observes every schema attribute', () => {
    const tagName = nextTag();
    defineChatElement({ tagName, onSendMessage: noopSend });

    const observed = customElements.get(tagName).observedAttributes;
    expect(observed).toContain('data-theme');
    expect(observed).toContain('data-name');
    expect(observed).toContain('data-collect-leads');
  });

  it('boots an instance the moment the tag is connected', () => {
    const tagName = nextTag();
    defineChatElement({ tagName, onSendMessage: noopSend });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(el.bot).not.toBeNull();
    expect(el.bot.id).toBeTypeOf('string');
    expect(el.querySelector('iframe')).not.toBeNull();

    el.remove();
  });

  it('exposes null on .bot before connection', () => {
    const tagName = nextTag();
    defineChatElement({ tagName, onSendMessage: noopSend });
    expect(document.createElement(tagName).bot).toBeNull();
  });

  it('dispatches ss-chat:ready carrying the instance', () => {
    const tagName = nextTag();
    defineChatElement({ tagName, onSendMessage: noopSend });

    const el = document.createElement(tagName);
    const onReady = vi.fn();
    el.addEventListener('ss-chat:ready', onReady);

    document.body.appendChild(el);

    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady.mock.calls[0][0].detail.bot).toBe(el.bot);

    el.remove();
  });

  it('mounts inside the tag itself, not document.body', () => {
    const tagName = nextTag();
    defineChatElement({ tagName, onSendMessage: noopSend });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    expect(el.querySelector('.ss-shell')).not.toBeNull();
    expect(document.body.children).toHaveLength(1);

    el.remove();
  });

  it('reads per-instance config from data-* attributes', () => {
    const tagName = nextTag();
    defineChatElement({ tagName, onSendMessage: noopSend });

    const el = document.createElement(tagName);
    el.setAttribute('data-name', 'Sales');
    el.setAttribute('data-orientation', 'left');
    document.body.appendChild(el);

    const doc = el.querySelector('iframe').contentWindow.document;
    expect(doc.querySelector('.ss-thead-name').textContent).toBe('Sales');
    expect(el.querySelector('.ss-shell').classList.contains('ss-left')).toBe(true);

    el.remove();
  });

  it('lets a tag attribute win over a shared default', () => {
    const tagName = nextTag();
    defineChatElement({ tagName, onSendMessage: noopSend, name: 'Shared' });

    const plain = document.createElement(tagName);
    const overridden = document.createElement(tagName);
    overridden.setAttribute('data-name', 'Own');
    document.body.append(plain, overridden);

    const nameOf = (el) =>
      el.querySelector('iframe').contentWindow.document.querySelector('.ss-thead-name').textContent;

    expect(nameOf(plain)).toBe('Shared');
    expect(nameOf(overridden)).toBe('Own');

    plain.remove();
    overridden.remove();
  });

  it('passes JS-only callbacks through to every instance', async () => {
    const tagName = nextTag();
    const onSendMessage = vi.fn(() => 'ok');
    defineChatElement({ tagName, onSendMessage });

    const el = document.createElement(tagName);
    document.body.appendChild(el);

    await el.bot.submit('hi');
    expect(onSendMessage).toHaveBeenCalled();

    el.remove();
  });

  it('applies a live attribute change as updateConfig', () => {
    const tagName = nextTag();
    defineChatElement({ tagName, onSendMessage: noopSend });

    const el = document.createElement(tagName);
    document.body.appendChild(el);
    const doc = el.querySelector('iframe').contentWindow.document;

    el.setAttribute('data-name', 'Renamed');

    expect(doc.querySelector('.ss-thead-name').textContent).toBe('Renamed');

    el.remove();
  });

  it('destroys the instance when the tag leaves the DOM', () => {
    const tagName = nextTag();
    defineChatElement({ tagName, onSendMessage: noopSend });

    const el = document.createElement(tagName);
    document.body.appendChild(el);
    const destroy = vi.spyOn(el.bot, 'destroy');

    el.remove();

    expect(destroy).toHaveBeenCalledTimes(1);
    expect(el.bot).toBeNull();
    expect(el.querySelector('iframe')).toBeNull();
  });

  it('re-creates the instance when the tag is reconnected', () => {
    const tagName = nextTag();
    defineChatElement({ tagName, onSendMessage: noopSend });

    const el = document.createElement(tagName);
    document.body.appendChild(el);
    const firstId = el.bot.id;

    el.remove();
    document.body.appendChild(el);

    expect(el.bot).not.toBeNull();
    expect(el.bot.id).not.toBe(firstId);

    el.remove();
  });

  it('ignores an attribute change on a disconnected tag', () => {
    const tagName = nextTag();
    defineChatElement({ tagName, onSendMessage: noopSend });

    const el = document.createElement(tagName);
    expect(() => el.setAttribute('data-name', 'Nobody')).not.toThrow();
  });
});
