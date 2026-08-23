import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createChatbot } from '../../src/core/create-chatbot';

/**
 * Rich text end to end, through the widget rather than the parser.
 *
 * The parser has its own file; what matters here is the boundary — which text
 * gets parsed and which does not: agent-authored text is rich, everything the
 * user wrote is literal. There is no switch — this is the widget's behavior.
 */
describe('rich text in the message bubble', () => {
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
  const agentBubble = () => doc().querySelector('.ss-message.ss-left');
  const userBubble = () => doc().querySelector('.ss-message.ss-right');

  it('renders markers in an agent reply as elements', async () => {
    bot = createChatbot({ mount, onSendMessage: () => '**Total:** $9' });
    await bot.submit('price');

    expect(agentBubble().querySelector('strong')).not.toBeNull();
    expect(agentBubble().querySelector('strong').textContent).toBe('Total:');
    expect(agentBubble().textContent).toBe('Total: $9');
  });

  it('renders a list in an agent reply', async () => {
    bot = createChatbot({ mount, onSendMessage: () => 'Plans:\n* Free\n* Pro' });
    await bot.submit('plans');

    const items = [...agentBubble().querySelectorAll('li')].map((li) => li.textContent);
    expect(agentBubble().querySelector('ul')).not.toBeNull();
    expect(items).toEqual(['Free', 'Pro']);
  });

  // The headline guarantee: what the user typed is what the user sees.
  it('leaves the user message literal', async () => {
    bot = createChatbot({ mount, onSendMessage: () => 'ok' });
    await bot.submit('is **this** bold?');

    expect(userBubble().querySelector('strong')).toBeNull();
    expect(userBubble().textContent).toBe('is **this** bold?');
  });

  it('leaves a user message that looks like a list literal', async () => {
    bot = createChatbot({ mount, onSendMessage: () => 'ok' });
    await bot.submit('* not a bullet');

    expect(userBubble().querySelector('ul')).toBeNull();
    expect(userBubble().textContent).toBe('* not a bullet');
  });

  it('renders initialMessages rich', () => {
    bot = createChatbot({
      mount,
      onSendMessage: () => 'ok',
      initialMessages: ['Hi! I can help with **billing**.'],
    });

    expect(agentBubble().querySelector('strong').textContent).toBe('billing');
  });

  it('renders a form reply rich, and keeps the form', async () => {
    bot = createChatbot({
      mount,
      onSendMessage: () => ({
        text: 'Enter your **email**:',
        form: { id: 'lead', fields: [{ name: 'email', type: 'email' }], onSubmit: () => 'thanks' },
      }),
    });
    await bot.submit('contact');

    expect(agentBubble().querySelector('strong').textContent).toBe('email');
    expect(doc().querySelector('form')).not.toBeNull();
  });

  it('renders each reply of an array rich', async () => {
    bot = createChatbot({
      mount,
      onSendMessage: () => [{ text: '**one**' }, { text: '*two*' }],
    });
    await bot.submit('go');

    expect(doc().querySelectorAll('.ss-message strong')).toHaveLength(1);
    expect(doc().querySelectorAll('.ss-message em')).toHaveLength(1);
  });

  it('re-parses a streamed reply on every chunk', async () => {
    async function* stream() {
      yield '**bo';
      yield 'ld**';
    }
    bot = createChatbot({ mount, onSendMessage: () => stream() });
    await bot.submit('stream');

    // Mid-stream the marker was literal; by the end it is an element, and the
    // partial text left nothing behind.
    expect(agentBubble().querySelector('strong').textContent).toBe('bold');
    expect(agentBubble().textContent).toBe('bold');
  });

  it('renders a reply with no markers exactly as sent', async () => {
    bot = createChatbot({ mount, onSendMessage: () => 'Just a normal sentence.' });
    await bot.submit('hi');

    // The bubble always holds a text <span>; what must be absent is any element
    // the parser could have introduced.
    expect(agentBubble().querySelector('strong, em, ul, ol, li')).toBeNull();
    expect(agentBubble().textContent).toBe('Just a normal sentence.');
  });

  it('renders a line break in a reply as a <br>', async () => {
    bot = createChatbot({ mount, onSendMessage: () => 'one\ntwo' });
    await bot.submit('hi');

    expect(agentBubble().querySelectorAll('br')).toHaveLength(1);
    expect(agentBubble().textContent).toBe('onetwo');
  });

  // The user's own newline is still a literal `\n` rendered by pre-wrap —
  // nothing parses it, so the two paths reach the same visual result by
  // different means.
  it('keeps a line break in a user message literal', async () => {
    bot = createChatbot({ mount, onSendMessage: () => 'ok' });
    await bot.submit('one\ntwo');

    expect(userBubble().querySelector('br')).toBeNull();
    expect(userBubble().textContent).toBe('one\ntwo');
  });

  it('never renders an agent reply as markup', async () => {
    bot = createChatbot({ mount, onSendMessage: () => '<img src=x onerror=alert(1)>' });
    await bot.submit('xss');

    expect(agentBubble().querySelector('img')).toBeNull();
    expect(agentBubble().textContent).toBe('<img src=x onerror=alert(1)>');
  });
});
