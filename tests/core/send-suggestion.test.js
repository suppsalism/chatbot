import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createChatbot } from '../../src/core/create-chatbot';

/**
 * `onSendSuggestion` answers a chip in place of `onSendMessage`. These tests
 * pin the four outcomes it can produce — reply, decline, cancel, throw — plus
 * the guarantee that nothing else about the turn changes.
 */
describe('onSendSuggestion', () => {
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

  const iframeDoc = () => mount.querySelector('iframe').contentWindow.document;
  const clickChip = (index = 0) => iframeDoc().querySelectorAll('.ss-suggestion')[index].click();
  const bubbles = () =>
    [...iframeDoc().querySelectorAll('.ss-message')].map((el) => el.textContent);

  it('answers the chip instead of onSendMessage', async () => {
    const onSendMessage = vi.fn(() => 'from onSendMessage');
    const onSendSuggestion = vi.fn(() => 'from onSendSuggestion');

    bot = createChatbot({
      mount,
      onSendMessage,
      onSendSuggestion,
      suggestedMessages: ['Pricing'],
    });
    clickChip();
    await vi.waitFor(() => expect(bubbles()).toContain('from onSendSuggestion'));

    expect(onSendMessage).not.toHaveBeenCalled();
    expect(bubbles()).toEqual(['Pricing', 'from onSendSuggestion']);
  });

  it('receives the same (message, ctx) onSendMessage would, history included', async () => {
    const onSendSuggestion = vi.fn(() => 'ok');

    bot = createChatbot({
      mount,
      onSendMessage: () => 'unused',
      onSendSuggestion,
      sessionId: 'sess-1',
      initialMessages: ['Hi there'],
      suggestedMessages: ['Pricing'],
    });
    clickChip();
    await vi.waitFor(() => expect(onSendSuggestion).toHaveBeenCalled());

    const [message, ctx] = onSendSuggestion.mock.calls[0];
    expect(message.text).toBe('Pricing');
    expect(message.sessionId).toBe('sess-1');
    expect(typeof message.messageId).toBe('string');

    // The history must already contain the chip's own message, exactly as
    // onSendMessage's does — otherwise the two handlers see different worlds.
    expect(ctx.history.map((m) => m.text)).toEqual(['Hi there', 'Pricing']);
    expect(ctx.history.at(-1).role).toBe('user');
    expect(ctx.config.sessionId).toBe('sess-1');
  });

  it('does not run for a typed message or for bot.submit()', async () => {
    const onSendMessage = vi.fn(() => 'ok');
    const onSendSuggestion = vi.fn(() => 'chip reply');

    bot = createChatbot({
      mount,
      onSendMessage,
      onSendSuggestion,
      suggestedMessages: ['Pricing'],
    });
    await bot.submit('typed');

    expect(onSendSuggestion).not.toHaveBeenCalled();
    expect(onSendMessage).toHaveBeenCalledTimes(1);
  });

  it('falls through to onSendMessage when it returns nothing', async () => {
    const onSendMessage = vi.fn(() => 'from onSendMessage');
    const onSendSuggestion = vi.fn(() => {});

    bot = createChatbot({
      mount,
      onSendMessage,
      onSendSuggestion,
      suggestedMessages: ['Pricing'],
    });
    clickChip();
    await vi.waitFor(() => expect(onSendMessage).toHaveBeenCalled());

    expect(onSendSuggestion).toHaveBeenCalledTimes(1);
    expect(bubbles()).toEqual(['Pricing', 'from onSendMessage']);
  });

  it('falls through when an async handler resolves to undefined', async () => {
    const onSendMessage = vi.fn(() => 'from onSendMessage');
    const onSendSuggestion = vi.fn(async () => undefined);

    bot = createChatbot({
      mount,
      onSendMessage,
      onSendSuggestion,
      suggestedMessages: ['Pricing'],
    });
    clickChip();
    await vi.waitFor(() => expect(onSendMessage).toHaveBeenCalled());

    expect(bubbles()).toEqual(['Pricing', 'from onSendMessage']);
  });

  // `true` used to mean "go ahead and auto-submit" under the old boolean
  // contract, so it has to keep meaning that rather than being read as a reply.
  it('falls through when it returns true', async () => {
    const onSendMessage = vi.fn(() => 'from onSendMessage');

    bot = createChatbot({
      mount,
      onSendMessage,
      onSendSuggestion: () => true,
      suggestedMessages: ['Pricing'],
    });
    clickChip();
    await vi.waitFor(() => expect(onSendMessage).toHaveBeenCalled());

    expect(bubbles()).toEqual(['Pricing', 'from onSendMessage']);
  });

  it('handles some chips itself and hands the rest to onSendMessage', async () => {
    const onSendMessage = vi.fn(() => 'from the backend');
    const onSendSuggestion = (message) =>
      message.text === 'Pricing' ? 'Plans start at $9.' : undefined;

    bot = createChatbot({
      mount,
      onSendMessage,
      onSendSuggestion,
      suggestedMessages: ['Pricing', 'Docs'],
    });

    clickChip(0);
    await vi.waitFor(() => expect(bubbles()).toContain('Plans start at $9.'));
    expect(onSendMessage).not.toHaveBeenCalled();

    clickChip(1);
    await vi.waitFor(() => expect(onSendMessage).toHaveBeenCalled());
    expect(bubbles()).toEqual(['Pricing', 'Plans start at $9.', 'Docs', 'from the backend']);
  });

  it('cancels the whole turn on a synchronous false — nothing renders', async () => {
    const onSendMessage = vi.fn(() => 'ok');

    bot = createChatbot({
      mount,
      onSendMessage,
      onSendSuggestion: () => false,
      suggestedMessages: ['Pricing'],
    });
    clickChip();
    await Promise.resolve();

    expect(onSendMessage).not.toHaveBeenCalled();
    expect(bubbles()).toEqual([]);
    expect(bot.getState().messages).toEqual([]);
  });

  // An async handler cannot un-render the user's own message, so a late `false`
  // is downgraded to "no reply" rather than being mistaken for one.
  it('ends the turn with no reply on an async false', async () => {
    const onSendMessage = vi.fn(() => 'ok');
    const onSendSuggestion = vi.fn(async () => false);

    bot = createChatbot({
      mount,
      onSendMessage,
      onSendSuggestion,
      suggestedMessages: ['Pricing'],
    });
    clickChip();
    // Both halves matter: the handler having run rules out passing before the
    // turn started, and the typing indicator renders its own `.ss-message`
    // bubble, so waiting for it to clear is what makes the bubble list mean
    // anything.
    await vi.waitFor(() => {
      expect(onSendSuggestion).toHaveBeenCalled();
      expect(iframeDoc().querySelector('.ss-typing')).toBeNull();
    });

    expect(onSendMessage).not.toHaveBeenCalled();
    expect(bubbles()).toEqual(['Pricing']);
    expect(bot.getState().pending).toBe(false);
  });

  it('renders an array of replies, a form, and suggestions like onSendMessage', async () => {
    const onSubmit = vi.fn(() => 'thanks');

    bot = createChatbot({
      mount,
      onSendMessage: () => 'unused',
      onSendSuggestion: () => [
        { text: 'One moment.' },
        {
          text: 'Where can we reach you?',
          form: { id: 'lead', fields: [{ name: 'email', type: 'email' }], onSubmit },
          suggestions: ['Later'],
        },
      ],
      suggestedMessages: ['Contact'],
    });
    clickChip();
    await vi.waitFor(() => expect(bubbles()).toContain('Where can we reach you?'));

    const doc = iframeDoc();
    expect(doc.querySelectorAll('.ss-message')).toHaveLength(3);
    expect(doc.querySelector('form')).toBeTruthy();
    expect([...doc.querySelectorAll('.ss-suggestion')].map((el) => el.textContent)).toEqual([
      'Later',
    ]);
  });

  it('degrades visibly and reports when it throws', async () => {
    const onMessageError = vi.fn();
    const onSendMessage = vi.fn(() => 'ok');
    const boom = new Error('handler exploded');

    bot = createChatbot({
      mount,
      onSendMessage,
      onMessageError,
      onSendSuggestion: () => {
        throw boom;
      },
      suggestedMessages: ['Pricing'],
    });
    clickChip();
    await vi.waitFor(() => expect(onMessageError).toHaveBeenCalled());

    // A throw is a failed reply, not a decline: it must not silently fall
    // through to onSendMessage.
    expect(onSendMessage).not.toHaveBeenCalled();
    expect(onMessageError.mock.calls[0][0]).toBe(boom);
    expect(iframeDoc().querySelector('.ss-message-error')).toBeTruthy();
    expect(bot.getState().pending).toBe(false);
  });

  it('degrades visibly when an async handler rejects', async () => {
    const onMessageError = vi.fn();

    bot = createChatbot({
      mount,
      onSendMessage: () => 'ok',
      onMessageError,
      onSendSuggestion: async () => {
        throw new Error('nope');
      },
      suggestedMessages: ['Pricing'],
    });
    clickChip();
    await vi.waitFor(() => expect(onMessageError).toHaveBeenCalled());

    expect(iframeDoc().querySelector('.ss-message-error')).toBeTruthy();
    expect(bot.getState().pending).toBe(false);
  });

  it('still runs beforeSubmitMessage and afterSubmitMessage around the chip', async () => {
    const beforeSubmitMessage = vi.fn((draft) => ({ ...draft, text: `${draft.text}!` }));
    const afterSubmitMessage = vi.fn();

    bot = createChatbot({
      mount,
      onSendMessage: () => 'unused',
      onSendSuggestion: () => 'chip reply',
      beforeSubmitMessage,
      afterSubmitMessage,
      suggestedMessages: ['Pricing'],
    });
    clickChip();
    await vi.waitFor(() => expect(afterSubmitMessage).toHaveBeenCalled());

    expect(beforeSubmitMessage).toHaveBeenCalledTimes(1);
    // The transform applies to the chip too — onSendSuggestion sees the
    // rewritten message, not the raw chip text.
    expect(bubbles()).toEqual(['Pricing!', 'chip reply']);
    expect(afterSubmitMessage.mock.calls[0][0].text).toBe('Pricing!');
    expect(afterSubmitMessage.mock.calls[0][1].text).toBe('chip reply');
  });

  it('is skipped entirely when beforeSubmitMessage cancels', async () => {
    const onSendSuggestion = vi.fn(() => 'chip reply');

    bot = createChatbot({
      mount,
      onSendMessage: () => 'ok',
      onSendSuggestion,
      beforeSubmitMessage: () => false,
      suggestedMessages: ['Pricing'],
    });
    clickChip();
    await Promise.resolve();

    expect(onSendSuggestion).not.toHaveBeenCalled();
    expect(bubbles()).toEqual([]);
  });

  it('also answers chips that arrived with a reply, not just configured ones', async () => {
    const onSendMessage = vi.fn(() => ({ text: 'Pick one', suggestions: ['Plan A'] }));
    const onSendSuggestion = vi.fn(() => 'Plan A it is.');

    bot = createChatbot({ mount, onSendMessage, onSendSuggestion });
    await bot.submit('hello');
    await vi.waitFor(() => expect(iframeDoc().querySelector('.ss-suggestion')).toBeTruthy());

    clickChip();
    await vi.waitFor(() => expect(bubbles()).toContain('Plan A it is.'));

    expect(onSendMessage).toHaveBeenCalledTimes(1);
  });
});
