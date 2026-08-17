import { describe, it, expect, vi, beforeEach } from 'vitest';
import { submitMessage } from '../../src/core/lifecycle';
import { initState } from '../../src/core/state';
import { resolveConfig } from '../../src/config/resolve';

/** A recording stand-in for the real view — lifecycle only ever talks to this shape. */
function createFakeView() {
  const calls = [];
  const record =
    (name) =>
    (...args) => {
      calls.push([name, ...args]);
    };

  return {
    calls,
    names: () => calls.map(([name]) => name),
    appendMessage: vi.fn(record('appendMessage')),
    appendError: vi.fn(record('appendError')),
    showTyping: vi.fn(record('showTyping')),
    hideTyping: vi.fn(record('hideTyping')),
    setSuggestions: vi.fn(record('setSuggestions')),
    setSubmitDisabled: vi.fn(record('setSubmitDisabled')),
    beginAgentMessage: vi.fn(({ messageId }) => {
      calls.push(['beginAgentMessage', { messageId }]);
      return {
        update: vi.fn(record('update')),
        finish: vi.fn(record('finish')),
      };
    }),
  };
}

function setup(callbacks, configPatch = {}) {
  const config = resolveConfig([{ sessionId: 'session-1', ...configPatch }]);
  const state = initState(config);
  const view = createFakeView();
  return {
    config,
    state,
    view,
    run: (text) => submitMessage({ text, config, view, state, callbacks }),
  };
}

describe('submitMessage — happy path', () => {
  it('renders the user bubble, locks the composer, then renders the reply', async () => {
    const { view, state, run } = setup({ onSendMessage: () => 'hello back' });

    await run('hi');

    expect(view.names()).toEqual(['appendMessage', 'showTyping', 'appendMessage', 'hideTyping']);
    expect(view.appendMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ role: 'user', text: 'hi' })
    );
    expect(view.appendMessage).toHaveBeenNthCalledWith(
      2,
      expect.objectContaining({ role: 'agent', text: 'hello back' })
    );
    expect(state.disabledSubmit()).toBe(false);
  });

  it('threads one messageId through all three stages', async () => {
    const seen = {};
    const { run } = setup({
      beforeSubmitMessage: (draft) => {
        seen.before = draft.messageId;
        return draft;
      },
      onSendMessage: (message) => {
        seen.send = message.messageId;
        return 'ok';
      },
      afterSubmitMessage: (message) => {
        seen.after = message.messageId;
      },
    });

    await run('hi');

    expect(seen.before).toBeTypeOf('string');
    expect(seen.send).toBe(seen.before);
    expect(seen.after).toBe(seen.before);
  });

  it('stamps sessionId and a timestamp on the message', async () => {
    const onSendMessage = vi.fn(() => 'ok');
    const { run } = setup({ onSendMessage });

    await run('hi');

    expect(onSendMessage.mock.calls[0][0]).toMatchObject({ text: 'hi', sessionId: 'session-1' });
    expect(onSendMessage.mock.calls[0][0].timestamp).toBeTypeOf('number');
  });

  it('passes the conversation so far and the resolved config as context', async () => {
    const onSendMessage = vi.fn(() => 'ok');
    const { run, config } = setup({ onSendMessage }, { initialMessages: ['greeting'] });

    await run('hi');

    const ctx = onSendMessage.mock.calls[0][1];
    expect(ctx.config).toBe(config);
    expect(ctx.history.map((m) => m.text)).toEqual(['greeting', 'hi']);
  });

  it('records both turns in the conversation', async () => {
    const { state, run } = setup({ onSendMessage: () => 'hello back' });

    await run('hi');

    expect(state.conversation().map((m) => [m.role, m.text])).toEqual([
      ['user', 'hi'],
      ['agent', 'hello back'],
    ]);
  });

  it('accepts a { text, suggestions } reply and renders the chips', async () => {
    const { view, run } = setup({
      onSendMessage: () => ({ text: 'Which plan?', suggestions: ['Free', 'Pro'] }),
    });

    await run('hi');

    expect(view.appendMessage).toHaveBeenLastCalledWith(
      expect.objectContaining({ text: 'Which plan?' })
    );
    expect(view.setSuggestions).toHaveBeenCalledWith(['Free', 'Pro']);
  });

  it('leaves existing suggestions alone when a reply carries none', async () => {
    const { view, run } = setup({ onSendMessage: () => 'plain' });
    await run('hi');
    expect(view.setSuggestions).not.toHaveBeenCalled();
  });
});

describe('submitMessage — streaming', () => {
  it('opens one bubble and updates it cumulatively per chunk', async () => {
    const { view, run } = setup({
      onSendMessage: async function* () {
        yield 'Hel';
        yield 'lo ';
        yield { text: 'world' };
      },
    });

    await run('hi');

    expect(view.beginAgentMessage).toHaveBeenCalledTimes(1);
    const handle = view.beginAgentMessage.mock.results[0].value;
    expect(handle.update.mock.calls.map(([text]) => text)).toEqual([
      'Hel',
      'Hello ',
      'Hello world',
    ]);
    expect(handle.finish).toHaveBeenCalledTimes(1);
  });

  it('records the fully assembled text in the conversation', async () => {
    const { state, run } = setup({
      onSendMessage: async function* () {
        yield 'a';
        yield 'b';
      },
    });

    await run('hi');

    expect(state.conversation().at(-1)).toMatchObject({ role: 'agent', text: 'ab' });
  });

  it('unlocks the composer after the last chunk', async () => {
    const { state, view, run } = setup({
      onSendMessage: async function* () {
        yield 'a';
      },
    });

    await run('hi');

    expect(state.disabledSubmit()).toBe(false);
    expect(view.hideTyping).toHaveBeenCalled();
  });
});

describe('submitMessage — beforeSubmitMessage', () => {
  it('renders the transformed draft, not the original', async () => {
    const onSendMessage = vi.fn(() => 'ok');
    const { view, run } = setup({
      beforeSubmitMessage: (draft) => ({ ...draft, text: draft.text.trim() }),
      onSendMessage,
    });

    await run('  hi  ');

    expect(view.appendMessage).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({ role: 'user', text: 'hi' })
    );
    expect(onSendMessage.mock.calls[0][0].text).toBe('hi');
  });

  it('renders nothing at all when it returns false', async () => {
    const onSendMessage = vi.fn();
    const { view, state, run } = setup({
      beforeSubmitMessage: () => false,
      onSendMessage,
    });

    await run('hi');

    expect(view.calls).toEqual([]);
    expect(onSendMessage).not.toHaveBeenCalled();
    expect(state.conversation()).toEqual([]);
    expect(state.disabledSubmit()).toBe(false);
  });

  it('proceeds with the original draft when it returns undefined', async () => {
    const { view, run } = setup({
      beforeSubmitMessage: () => undefined,
      onSendMessage: () => 'ok',
    });

    await run('hi');

    expect(view.appendMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ text: 'hi' }));
  });

  it('cancels and reports when it throws, without rendering an error bubble', async () => {
    const onMessageError = vi.fn();
    const onSendMessage = vi.fn();
    const { view, run } = setup({
      beforeSubmitMessage: () => {
        throw new Error('nope');
      },
      onSendMessage,
      onMessageError,
    });

    await run('hi');

    expect(view.calls).toEqual([]);
    expect(onSendMessage).not.toHaveBeenCalled();
    expect(onMessageError).toHaveBeenCalledWith(
      expect.any(Error),
      expect.objectContaining({ text: 'hi' })
    );
  });

  it('awaits an async transform', async () => {
    const { view, run } = setup({
      beforeSubmitMessage: async (draft) => ({ ...draft, text: `${draft.text}!` }),
      onSendMessage: () => 'ok',
    });

    await run('hi');

    expect(view.appendMessage).toHaveBeenNthCalledWith(1, expect.objectContaining({ text: 'hi!' }));
  });
});

describe('submitMessage — failure', () => {
  it('renders an error bubble, hides typing and unlocks the composer', async () => {
    const onMessageError = vi.fn();
    const { view, state, run } = setup({
      onSendMessage: () => {
        throw new Error('network down');
      },
      onMessageError,
    });

    await run('hi');

    expect(view.appendError).toHaveBeenCalled();
    expect(view.hideTyping).toHaveBeenCalled();
    expect(state.disabledSubmit()).toBe(false);
    expect(onMessageError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'network down' }),
      expect.objectContaining({ text: 'hi' })
    );
  });

  it('handles a rejected promise the same way', async () => {
    const onMessageError = vi.fn();
    const { view, run } = setup({
      onSendMessage: () => Promise.reject(new Error('timeout')),
      onMessageError,
    });

    await run('hi');

    expect(view.appendError).toHaveBeenCalled();
    expect(onMessageError).toHaveBeenCalled();
  });

  it('degrades an undefined reply through the normal error path', async () => {
    const onMessageError = vi.fn();
    const { view, run } = setup({ onSendMessage: () => undefined, onMessageError });

    await run('hi');

    expect(view.appendError).toHaveBeenCalled();
    expect(onMessageError).toHaveBeenCalled();
  });

  it('keeps the user turn in the conversation but records no agent turn', async () => {
    const { state, run } = setup({
      onSendMessage: () => {
        throw new Error('boom');
      },
      onMessageError: () => {},
    });

    await run('hi');

    expect(state.conversation().map((m) => m.role)).toEqual(['user']);
  });

  it('never retries', async () => {
    const onSendMessage = vi.fn(() => {
      throw new Error('boom');
    });
    const { run } = setup({ onSendMessage, onMessageError: () => {} });

    await run('hi');

    expect(onSendMessage).toHaveBeenCalledTimes(1);
  });

  it('survives a throwing onMessageError', async () => {
    const { run } = setup({
      onSendMessage: () => {
        throw new Error('boom');
      },
      onMessageError: () => {
        throw new Error('observer exploded');
      },
    });

    await expect(run('hi')).resolves.toBeUndefined();
  });
});

describe('submitMessage — afterSubmitMessage', () => {
  it('receives the message and the rendered reply', async () => {
    const afterSubmitMessage = vi.fn();
    const { run } = setup({ onSendMessage: () => 'hello back', afterSubmitMessage });

    await run('hi');

    expect(afterSubmitMessage).toHaveBeenCalledWith(
      expect.objectContaining({ text: 'hi' }),
      expect.objectContaining({ text: 'hello back' })
    );
  });

  it('routes its throw to onMessageError without breaking the chat', async () => {
    const onMessageError = vi.fn();
    const { view, run } = setup({
      onSendMessage: () => 'ok',
      afterSubmitMessage: () => {
        throw new Error('persist failed');
      },
      onMessageError,
    });

    await expect(run('hi')).resolves.toBeUndefined();

    expect(view.appendError).not.toHaveBeenCalled();
    expect(onMessageError).toHaveBeenCalledWith(
      expect.objectContaining({ message: 'persist failed' }),
      expect.anything()
    );
  });

  it('fires after the last chunk of a streamed reply', async () => {
    const order = [];
    const { run } = setup({
      onSendMessage: async function* () {
        yield 'a';
        order.push('chunk');
      },
      afterSubmitMessage: () => order.push('after'),
    });

    await run('hi');

    expect(order).toEqual(['chunk', 'after']);
  });
});

describe('submitMessage — no network', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('makes no fetch call of its own', async () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    const { run } = setup({ onSendMessage: () => 'ok' });

    await run('hi');

    expect(fetchSpy).not.toHaveBeenCalled();
    vi.unstubAllGlobals();
  });
});
