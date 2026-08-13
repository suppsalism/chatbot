import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createChatbot } from '../../src/core/create-chatbot';

const noopSend = () => 'ok';

describe('createChatbot — construction', () => {
  let mount;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mount = document.createElement('div');
    document.body.appendChild(mount);
  });

  afterEach(() => {
    mount.remove();
    document.body.innerHTML = '';
  });

  it('throws when onSendMessage is missing', () => {
    expect(() => createChatbot({ mount })).toThrow(/onSendMessage is required/);
  });

  it('throws when onSendMessage is not a function', () => {
    expect(() => createChatbot({ mount, onSendMessage: 'https://api.example.com' })).toThrow(
      /onSendMessage is required/
    );
  });

  it('throws when mount is not an attached element', () => {
    expect(() =>
      createChatbot({ mount: document.createElement('div'), onSendMessage: noopSend })
    ).toThrow(/mount must be an attached Element/);
    expect(() => createChatbot({ mount: null, onSendMessage: noopSend })).toThrow();
  });

  it('builds everything as a descendant of mount and nowhere else', () => {
    const bot = createChatbot({ mount, onSendMessage: noopSend });

    expect(mount.children.length).toBeGreaterThan(0);
    expect(mount.querySelector('iframe')).not.toBeNull();

    bot.destroy();
  });

  it('returns the documented instance API', () => {
    const bot = createChatbot({ mount, onSendMessage: noopSend });

    expect(bot.id).toBeTypeOf('string');
    for (const method of [
      'open',
      'close',
      'toggle',
      'submit',
      'updateConfig',
      'getState',
      'destroy',
    ]) {
      expect(bot[method], method).toBeTypeOf('function');
    }

    bot.destroy();
  });

  it('uses the supplied instanceId for its DOM ids', () => {
    const bot = createChatbot({ mount, instanceId: 'fixed-id', onSendMessage: noopSend });

    expect(bot.id).toBe('fixed-id');
    expect(mount.querySelector('#ss-chat-shell-fixed-id')).not.toBeNull();
    expect(mount.querySelector('#ss-chat-iframe-fixed-id')).not.toBeNull();

    bot.destroy();
  });

  it('gives two instances on one page distinct ids', () => {
    const first = createChatbot({ mount, onSendMessage: noopSend });
    const second = createChatbot({ mount, onSendMessage: noopSend });

    expect(first.id).not.toBe(second.id);

    first.destroy();
    second.destroy();
  });

  it('fires onReady once with the instance', () => {
    const onReady = vi.fn();
    const bot = createChatbot({ mount, onSendMessage: noopSend, onReady });

    expect(onReady).toHaveBeenCalledTimes(1);
    expect(onReady).toHaveBeenCalledWith(bot);

    bot.destroy();
  });

  it('survives a throwing onReady', () => {
    let bot;
    expect(() => {
      bot = createChatbot({
        mount,
        onSendMessage: noopSend,
        onReady: () => {
          throw new Error('boom');
        },
      });
    }).not.toThrow();

    bot.destroy();
  });

  it('makes no network call while constructing', () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);

    const bot = createChatbot({ mount, onSendMessage: noopSend });
    expect(fetchSpy).not.toHaveBeenCalled();

    bot.destroy();
    vi.unstubAllGlobals();
  });

  it('renders initialMessages before any interaction', () => {
    const bot = createChatbot({
      mount,
      onSendMessage: noopSend,
      initialMessages: ['Hi there!'],
    });

    const doc = mount.querySelector('iframe').contentWindow.document;
    expect(doc.body.textContent).toContain('Hi there!');
    expect(bot.getState().messages).toHaveLength(1);

    bot.destroy();
  });

  it('renders suggestion chips from suggestedMessages', () => {
    const bot = createChatbot({
      mount,
      onSendMessage: noopSend,
      suggestedMessages: ['Pricing', 'Docs'],
    });

    const doc = mount.querySelector('iframe').contentWindow.document;
    const chips = [...doc.querySelectorAll('.ss-suggestion')].map((el) => el.textContent);
    expect(chips).toEqual(['Pricing', 'Docs']);

    bot.destroy();
  });
});

describe('createChatbot — open/close', () => {
  let mount;
  let bot;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mount = document.createElement('div');
    document.body.appendChild(mount);
  });

  afterEach(() => {
    bot?.destroy();
    mount.remove();
  });

  it('starts closed and opens on demand', () => {
    bot = createChatbot({ mount, onSendMessage: noopSend });
    const shell = mount.querySelector('.ss-shell');

    expect(bot.getState().open).toBe(false);
    expect(shell.classList.contains('ss-visible')).toBe(false);

    bot.open();
    expect(bot.getState().open).toBe(true);
    expect(shell.classList.contains('ss-visible')).toBe(true);

    bot.close();
    expect(shell.classList.contains('ss-visible')).toBe(false);
  });

  it('starts open when autoOpen is set', () => {
    bot = createChatbot({ mount, onSendMessage: noopSend, autoOpen: true });
    expect(bot.getState().open).toBe(true);
  });

  it('toggles', () => {
    bot = createChatbot({ mount, onSendMessage: noopSend });
    bot.toggle();
    expect(bot.getState().open).toBe(true);
    bot.toggle();
    expect(bot.getState().open).toBe(false);
  });

  it('fires onOpen and onClose only on an actual transition', () => {
    const onOpen = vi.fn();
    const onClose = vi.fn();
    bot = createChatbot({ mount, onSendMessage: noopSend, onOpen, onClose });

    bot.open();
    bot.open();
    expect(onOpen).toHaveBeenCalledTimes(1);

    bot.close();
    bot.close();
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('opens when the launcher is clicked', () => {
    bot = createChatbot({ mount, onSendMessage: noopSend });
    mount.querySelector('.ss-launcher').click();
    expect(bot.getState().open).toBe(true);
  });

  it('closes when the header close button is clicked', () => {
    bot = createChatbot({ mount, onSendMessage: noopSend, autoOpen: true });
    const doc = mount.querySelector('iframe').contentWindow.document;

    doc.querySelector('.ss-thead-close').click();
    expect(bot.getState().open).toBe(false);
  });
});

describe('createChatbot — submit', () => {
  let mount;
  let bot;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mount = document.createElement('div');
    document.body.appendChild(mount);
  });

  afterEach(() => {
    bot?.destroy();
    mount.remove();
  });

  it('runs the full lifecycle and renders both turns', async () => {
    bot = createChatbot({ mount, onSendMessage: () => 'the reply' });

    await bot.submit('hello');

    const doc = mount.querySelector('iframe').contentWindow.document;
    const bubbles = [...doc.querySelectorAll('.ss-message')].map((el) => el.textContent);
    expect(bubbles).toEqual(['hello', 'the reply']);
    expect(bot.getState().messages.map((m) => m.text)).toEqual(['hello', 'the reply']);
  });

  it('reports pending accurately while a reply is in flight', async () => {
    let release;
    bot = createChatbot({
      mount,
      onSendMessage: () => new Promise((resolve) => (release = () => resolve('done'))),
    });

    const inFlight = bot.submit('hello');
    await Promise.resolve();
    expect(bot.getState().pending).toBe(true);

    release();
    await inFlight;
    expect(bot.getState().pending).toBe(false);
  });

  it('renders an error bubble when onSendMessage throws', async () => {
    const onMessageError = vi.fn();
    bot = createChatbot({
      mount,
      onMessageError,
      onSendMessage: () => {
        throw new Error('boom');
      },
    });

    await bot.submit('hello');

    const doc = mount.querySelector('iframe').contentWindow.document;
    expect(doc.querySelector('.ss-message-error')).not.toBeNull();
    expect(onMessageError).toHaveBeenCalled();
    expect(bot.getState().pending).toBe(false);
  });

  it('submits a suggestion chip on click', async () => {
    const onSendMessage = vi.fn(() => 'ok');
    bot = createChatbot({ mount, onSendMessage, suggestedMessages: ['Pricing'] });
    const doc = mount.querySelector('iframe').contentWindow.document;

    doc.querySelector('.ss-suggestion').click();
    await vi.waitFor(() => expect(onSendMessage).toHaveBeenCalled());

    expect(onSendMessage.mock.calls[0][0].text).toBe('Pricing');
  });

  it('lets onSuggestionClick veto the auto-submit by returning false', async () => {
    const onSendMessage = vi.fn(() => 'ok');
    bot = createChatbot({
      mount,
      onSendMessage,
      onSuggestionClick: () => false,
      suggestedMessages: ['Pricing'],
    });
    const doc = mount.querySelector('iframe').contentWindow.document;

    doc.querySelector('.ss-suggestion').click();
    await Promise.resolve();

    expect(onSendMessage).not.toHaveBeenCalled();
  });
});

describe('createChatbot — updateConfig', () => {
  let mount;
  let bot;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mount = document.createElement('div');
    document.body.appendChild(mount);
  });

  afterEach(() => {
    bot?.destroy();
    mount.remove();
  });

  it('re-applies theme and brand color to the iframe body', () => {
    bot = createChatbot({ mount, onSendMessage: noopSend, theme: 'light' });
    const doc = mount.querySelector('iframe').contentWindow.document;

    expect(doc.body.className).toContain('ss-theme-light');

    bot.updateConfig({ theme: 'dark', brandColor: '#ff0000' });

    expect(doc.body.className).toContain('ss-theme-dark');
    expect(doc.body.style.getPropertyValue('--ss-brand')).toBe('#ff0000');
  });

  it('re-applies orientation to the host-page shell', () => {
    bot = createChatbot({ mount, onSendMessage: noopSend });
    const shell = mount.querySelector('.ss-shell');

    expect(shell.classList.contains('ss-right')).toBe(true);

    bot.updateConfig({ orientation: 'left' });

    expect(shell.classList.contains('ss-left')).toBe(true);
    expect(shell.classList.contains('ss-right')).toBe(false);
  });

  it('updates header text and composer placeholder', () => {
    bot = createChatbot({ mount, onSendMessage: noopSend });
    const doc = mount.querySelector('iframe').contentWindow.document;

    bot.updateConfig({ name: 'Sales', placeholder: 'Ask sales…' });

    expect(doc.querySelector('.ss-thead-name').textContent).toBe('Sales');
    expect(doc.querySelector('.ss-composer-textarea').getAttribute('placeholder')).toBe(
      'Ask sales…'
    );
  });

  it('mounts and unmounts the lead form as collectLeads flips', () => {
    bot = createChatbot({ mount, onSendMessage: noopSend });
    const doc = mount.querySelector('iframe').contentWindow.document;

    expect(doc.querySelector('.ss-lead-form-wrapper')).toBeNull();

    bot.updateConfig({ collectLeads: true });
    expect(doc.querySelector('.ss-lead-form-wrapper')).not.toBeNull();

    bot.updateConfig({ collectLeads: false });
    expect(doc.querySelector('.ss-lead-form-wrapper')).toBeNull();
  });

  it('mounts and unmounts the signature as it flips', () => {
    bot = createChatbot({ mount, onSendMessage: noopSend });
    const doc = mount.querySelector('iframe').contentWindow.document;

    expect(doc.querySelector('.ss-signature')).not.toBeNull();

    bot.updateConfig({ signature: false });
    expect(doc.querySelector('.ss-signature')).toBeNull();
  });

  it('keeps unmentioned fields at their current value', () => {
    bot = createChatbot({ mount, onSendMessage: noopSend, name: 'Support' });
    const doc = mount.querySelector('iframe').contentWindow.document;

    bot.updateConfig({ theme: 'dark' });

    expect(doc.querySelector('.ss-thead-name').textContent).toBe('Support');
  });

  it('falls back to the default on an invalid patch instead of throwing', () => {
    bot = createChatbot({ mount, onSendMessage: noopSend, theme: 'dark' });
    const doc = mount.querySelector('iframe').contentWindow.document;

    expect(() => bot.updateConfig({ theme: 'neon' })).not.toThrow();
    expect(doc.body.className).toContain('ss-theme-light');
  });
});

describe('createChatbot — destroy', () => {
  let mount;

  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    mount = document.createElement('div');
    document.body.appendChild(mount);
  });

  afterEach(() => {
    mount.remove();
  });

  it('removes every node it created', () => {
    const bot = createChatbot({ mount, onSendMessage: noopSend });
    expect(mount.children.length).toBeGreaterThan(0);

    bot.destroy();

    expect(mount.innerHTML).toBe('');
    expect(document.querySelector('.ss-shell')).toBeNull();
    expect(document.querySelector('.ss-launcher')).toBeNull();
  });

  it('removes the style tag it injected into the host document', () => {
    const before = document.head.querySelectorAll('style').length;
    const bot = createChatbot({ mount, onSendMessage: noopSend });
    expect(document.head.querySelectorAll('style').length).toBe(before + 1);

    bot.destroy();

    expect(document.head.querySelectorAll('style').length).toBe(before);
  });

  it('leaves a sibling instance untouched', () => {
    const first = createChatbot({ mount, instanceId: 'a', onSendMessage: noopSend });
    const second = createChatbot({ mount, instanceId: 'b', onSendMessage: noopSend });

    first.destroy();

    expect(mount.querySelector('#ss-chat-shell-a')).toBeNull();
    expect(mount.querySelector('#ss-chat-shell-b')).not.toBeNull();

    second.destroy();
  });

  it('is safe to call twice', () => {
    const bot = createChatbot({ mount, onSendMessage: noopSend });
    bot.destroy();
    expect(() => bot.destroy()).not.toThrow();
  });
});
