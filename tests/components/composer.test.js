import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createChatbot } from '../../src/core/create-chatbot';

/**
 * The composer is the only component that both reads and writes signals, so it
 * is where a reactivity regression shows up first. These drive it the way a
 * user does — typing, Enter, the send button — rather than calling bot.submit(),
 * which bypasses it entirely.
 */
describe('composer', () => {
  let mount;
  let bot;
  let doc;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mount = document.createElement('div');
    document.body.appendChild(mount);
    bot = createChatbot({
      mount,
      onSendMessage: (message) => `You said: "${message.text}"`,
    });
    doc = mount.querySelector('iframe').contentWindow.document;
  });

  afterEach(() => {
    bot?.destroy();
    mount.remove();
  });

  const textarea = () => doc.querySelector('.ss-composer-textarea');
  const button = () => doc.querySelector('.ss-composer-highlight');
  const bubbles = () => [...doc.querySelectorAll('.ss-message')].map((n) => n.textContent);

  function type(text) {
    textarea().textContent = text;
    textarea().dispatchEvent(new doc.defaultView.Event('input', { bubbles: true }));
  }

  it('starts with the send button disabled', () => {
    expect(button().disabled).toBe(true);
    expect(button().classList.contains('ss-disabled')).toBe(true);
  });

  it('enables the send button once there is text, and disables it again when emptied', () => {
    type('hello');
    expect(button().disabled).toBe(false);
    expect(button().classList.contains('ss-disabled')).toBe(false);

    type('');
    expect(button().disabled).toBe(true);
  });

  it('sends on button click and clears the composer', async () => {
    type('hello');
    button().click();

    await vi.waitFor(() => expect(bubbles()).toEqual(['hello', 'You said: "hello"']));
    expect(textarea().textContent).toBe('');
    expect(button().disabled).toBe(true);
  });

  it('sends on Enter', async () => {
    type('hello');
    textarea().dispatchEvent(
      new doc.defaultView.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );

    await vi.waitFor(() => expect(bubbles()).toHaveLength(2));
  });

  it('does not send on Shift+Enter', async () => {
    type('hello');
    textarea().dispatchEvent(
      new doc.defaultView.KeyboardEvent('keydown', {
        key: 'Enter',
        shiftKey: true,
        bubbles: true,
      })
    );

    await Promise.resolve();
    expect(bubbles()).toEqual([]);
  });

  it('refuses to send an empty composer', async () => {
    button().click();
    textarea().dispatchEvent(
      new doc.defaultView.KeyboardEvent('keydown', { key: 'Enter', bubbles: true })
    );

    await Promise.resolve();
    expect(bubbles()).toEqual([]);
  });

  it('locks the composer while a reply is pending and unlocks it after', async () => {
    bot.destroy();
    let release;
    bot = createChatbot({
      mount,
      onSendMessage: () => new Promise((resolve) => (release = () => resolve('done'))),
    });
    doc = mount.querySelector('iframe').contentWindow.document;
    const wrapper = doc.querySelector('.ss-composer-wrapper');

    type('hi');
    button().click();

    await vi.waitFor(() => expect(wrapper.classList.contains('ss-disabled')).toBe(true));
    expect(textarea().contentEditable).toBe('false');

    release();

    await vi.waitFor(() => expect(wrapper.classList.contains('ss-disabled')).toBe(false));
    expect(textarea().contentEditable).toBe('true');
  });

  it('tracks the placeholder through updateConfig', () => {
    bot.updateConfig({ placeholder: 'Ask away…' });
    expect(textarea().getAttribute('placeholder')).toBe('Ask away…');
  });
});
