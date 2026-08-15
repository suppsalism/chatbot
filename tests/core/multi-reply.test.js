import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createChatbot } from '../../src/core/create-chatbot';

/**
 * onSendMessage may return one reply or an array of them. An array means one
 * Message component per element — separate bubbles, separate ids.
 */
describe('multi-message replies', () => {
  let mount;
  let bot;
  let doc;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mount = document.createElement('div');
    document.body.appendChild(mount);
  });

  afterEach(() => {
    bot?.destroy();
    mount.remove();
  });

  function boot(options) {
    bot = createChatbot({ mount, ...options });
    doc = mount.querySelector('iframe').contentWindow.document;
  }

  const bubbles = () => [...doc.querySelectorAll('.ss-message')].map((n) => n.textContent);

  it('renders one bubble per array element, in order', async () => {
    boot({
      onSendMessage: () => [
        { text: 'Got it.' },
        { text: "Here's what I found." },
        { text: 'Anything else?' },
      ],
    });

    await bot.submit('hi');

    expect(bubbles()).toEqual(['hi', 'Got it.', "Here's what I found.", 'Anything else?']);
    expect(doc.querySelectorAll('.ss-message-wrapper.ss-left')).toHaveLength(3);
  });

  it('gives every message its own id and conversation entry', async () => {
    boot({ onSendMessage: () => [{ text: 'one' }, { text: 'two' }] });
    await bot.submit('hi');

    const agent = bot.getState().messages.filter((m) => m.role === 'agent');
    expect(agent.map((m) => m.text)).toEqual(['one', 'two']);
    expect(agent[0].messageId).not.toBe(agent[1].messageId);
  });

  it('still accepts a single object', async () => {
    boot({ onSendMessage: () => ({ text: 'just one' }) });
    await bot.submit('hi');
    expect(bubbles()).toEqual(['hi', 'just one']);
  });

  it('still accepts the bare-string shorthand', async () => {
    boot({ onSendMessage: () => 'plain string' });
    await bot.submit('hi');
    expect(bubbles()).toEqual(['hi', 'plain string']);
  });

  it('still streams an async iterable into a single bubble', async () => {
    boot({
      onSendMessage: async function* () {
        yield 'Hel';
        yield 'lo';
      },
    });
    await bot.submit('hi');
    expect(bubbles()).toEqual(['hi', 'Hello']);
  });

  it('lets the last non-empty suggestions win across the array', async () => {
    boot({
      onSendMessage: () => [
        { text: 'one', suggestions: ['A', 'B'] },
        { text: 'two', suggestions: ['C', 'D'] },
        { text: 'three' },
      ],
    });

    await bot.submit('hi');

    expect([...doc.querySelectorAll('.ss-suggestion')].map((n) => n.textContent)).toEqual([
      'C',
      'D',
    ]);
  });

  it('attaches a form to only the element that declared one', async () => {
    boot({
      onSendMessage: () => [
        { text: 'First, some context.' },
        {
          text: 'Now, how do we reach you?',
          form: { fields: [{ name: 'email', type: 'email' }], onSubmit: () => {} },
        },
      ],
    });

    await bot.submit('hi');

    const agentMessages = doc.querySelectorAll('.ss-message-wrapper.ss-left');
    expect(agentMessages[0].querySelector('.ss-form')).toBeNull();
    expect(agentMessages[1].querySelector('.ss-form')).not.toBeNull();
  });

  it('gives every agent message its own feedback pair when collectFeedback is on', async () => {
    boot({
      collectFeedback: true,
      onSendMessage: () => [{ text: 'one' }, { text: 'two' }],
    });

    await bot.submit('hi');

    expect(doc.querySelectorAll('.ss-feedback-wrapper')).toHaveLength(2);
  });

  it('passes the array straight through to afterSubmitMessage', async () => {
    const afterSubmitMessage = vi.fn();
    boot({ onSendMessage: () => [{ text: 'one' }, { text: 'two' }], afterSubmitMessage });

    await bot.submit('hi');

    const [, replies] = afterSubmitMessage.mock.calls[0];
    expect(Array.isArray(replies)).toBe(true);
    expect(replies.map((r) => r.text)).toEqual(['one', 'two']);
  });

  it('keeps afterSubmitMessage receiving a single object for a single reply', async () => {
    const afterSubmitMessage = vi.fn();
    boot({ onSendMessage: () => ({ text: 'one' }), afterSubmitMessage });

    await bot.submit('hi');

    const [, reply] = afterSubmitMessage.mock.calls[0];
    expect(Array.isArray(reply)).toBe(false);
    expect(reply.text).toBe('one');
  });

  it('warns and renders nothing for an empty array', async () => {
    boot({ onSendMessage: () => [] });
    await bot.submit('hi');

    expect(bubbles()).toEqual(['hi']);
    expect(doc.querySelector('.ss-message-error')).toBeNull();
    expect(bot.getState().pending).toBe(false);
  });

  it('degrades a malformed element through the normal error path', async () => {
    const onMessageError = vi.fn();
    boot({ onSendMessage: () => [{ text: 'fine' }, { nope: true }], onMessageError });

    await bot.submit('hi');

    expect(doc.querySelector('.ss-message-error')).not.toBeNull();
    expect(onMessageError).toHaveBeenCalled();
    expect(bot.getState().pending).toBe(false);
  });
});
