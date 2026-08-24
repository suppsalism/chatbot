import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createChatbot } from '../../src/core/create-chatbot';

/**
 * The handover from the typing indicator to a streamed bubble, asserted in the
 * real iframe rather than against a fake view — the bug this covers was purely
 * visual: both were on screen at once, the indicator sitting above the text as
 * it streamed in.
 */
describe('typing indicator and streaming', () => {
  let mount;
  let bot;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mount = document.createElement('div');
    document.body.appendChild(mount);
  });

  afterEach(() => {
    bot?.destroy();
    bot = undefined;
    mount.remove();
    document.body.innerHTML = '';
  });

  const doc = () => mount.querySelector('iframe').contentWindow.document;
  const typing = () => doc().querySelector('.ss-typing');
  const agentBubbles = () => [...doc().querySelectorAll('.ss-message.ss-left')];

  function gate() {
    let release;
    const promise = new Promise((resolve) => (release = resolve));
    return { promise, release };
  }

  it('shows the indicator alone until the first chunk arrives', async () => {
    const first = gate();

    bot = createChatbot({
      mount,
      onSendMessage: async function* () {
        await first.promise;
        yield 'Hello';
      },
    });

    const inFlight = bot.submit('hi');
    await vi.waitFor(() => expect(typing()).not.toBeNull());

    // Nothing but the indicator: no bubble has been opened yet.
    expect(agentBubbles()).toHaveLength(0);

    first.release();
    await inFlight;
  });

  it('replaces the indicator with the bubble on the first chunk', async () => {
    const second = gate();

    bot = createChatbot({
      mount,
      onSendMessage: async function* () {
        yield 'Hel';
        await second.promise;
        yield 'lo';
      },
    });

    const inFlight = bot.submit('hi');

    // Mid-stream: the bubble is up and the indicator is gone. Both being
    // present here is the bug.
    await vi.waitFor(() => expect(agentBubbles()).toHaveLength(1));
    expect(typing()).toBeNull();
    expect(agentBubbles()[0].textContent).toBe('Hel');

    second.release();
    await inFlight;

    expect(typing()).toBeNull();
    expect(agentBubbles()[0].textContent).toBe('Hello');
  });

  it('leaves no bubble behind when the stream fails before its first chunk', async () => {
    bot = createChatbot({
      mount,
      // eslint-disable-next-line require-yield
      onSendMessage: async function* () {
        throw new Error('upstream died');
      },
      onMessageError: () => {},
    });

    await bot.submit('hi');

    expect(typing()).toBeNull();
    // One bubble only — the error. Not an empty one plus the error.
    expect(agentBubbles()).toHaveLength(1);
    expect(doc().querySelector('.ss-message-error')).not.toBeNull();
  });

  it('clears the indicator for a stream that yields nothing', async () => {
    bot = createChatbot({
      mount,
      onSendMessage: async function* () {},
    });

    await bot.submit('hi');

    expect(typing()).toBeNull();
    expect(agentBubbles()).toHaveLength(0);
    expect(bot.getState().pending).toBe(false);
  });

  it('still clears the indicator for a non-streamed reply', async () => {
    bot = createChatbot({ mount, onSendMessage: () => 'plain reply' });
    await bot.submit('hi');

    expect(typing()).toBeNull();
    expect(agentBubbles()).toHaveLength(1);
  });
});
