import { describe, it, expect, vi } from 'vitest';
import { initState, bindEffects } from '../../src/core/state';
import { resolveConfig } from '../../src/config/resolve';

describe('initState', () => {
  it('starts empty and closed by default', () => {
    const state = initState(resolveConfig());
    expect(state.message()).toBe('');
    expect(state.disabledSubmit()).toBe(false);
    expect(state.chatVisible()).toBe(false);
    expect(state.conversation()).toEqual([]);
  });

  it('opens immediately when autoOpen is set', () => {
    expect(initState(resolveConfig([{ autoOpen: true }])).chatVisible()).toBe(true);
  });

  it('seeds the conversation from initialMessages as agent turns', () => {
    const state = initState(resolveConfig([{ initialMessages: ['Hi!', 'How can I help?'] }]));
    const conversation = state.conversation();

    expect(conversation).toHaveLength(2);
    expect(conversation.map((m) => m.role)).toEqual(['agent', 'agent']);
    expect(conversation.map((m) => m.text)).toEqual(['Hi!', 'How can I help?']);
    for (const entry of conversation) {
      expect(entry.messageId).toBeTypeOf('string');
      expect(entry.timestamp).toBeTypeOf('number');
    }
  });

  it('gives each seeded message a distinct id', () => {
    const state = initState(resolveConfig([{ initialMessages: ['a', 'a'] }]));
    const [first, second] = state.conversation();
    expect(first.messageId).not.toBe(second.messageId);
  });

  it('appends immutably — the previous array is not mutated', () => {
    const state = initState(resolveConfig());
    const before = state.conversation();

    state.appendToConversation({ role: 'user', text: 'hi' });

    expect(before).toEqual([]);
    expect(state.conversation()).toHaveLength(1);
  });
});

describe('bindEffects', () => {
  it('mirrors chatVisible onto the shell and disabledSubmit onto the view', () => {
    const state = initState(resolveConfig());
    const shell = { setVisible: vi.fn() };
    const view = { setSubmitDisabled: vi.fn() };

    bindEffects({ state, shell, view });

    expect(shell.setVisible).toHaveBeenLastCalledWith(false);
    expect(view.setSubmitDisabled).toHaveBeenLastCalledWith(false);

    state.setChatVisible(true);
    expect(shell.setVisible).toHaveBeenLastCalledWith(true);

    state.setDisabledSubmit(true);
    expect(view.setSubmitDisabled).toHaveBeenLastCalledWith(true);
  });
});
