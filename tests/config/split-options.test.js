import { describe, it, expect, vi, beforeEach } from 'vitest';
import { splitOptions } from '../../src/config/split-options';

describe('splitOptions', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('routes schema fields to config and callbacks to callbacks', () => {
    const onSendMessage = () => 'hi';
    const { config, callbacks } = splitOptions({ theme: 'dark', onSendMessage });

    expect(config).toEqual({ theme: 'dark' });
    expect(callbacks.onSendMessage).toBe(onSendMessage);
  });

  it('recognizes every documented callback', () => {
    const names = [
      'beforeSubmitMessage',
      'onSendMessage',
      'onSendSuggestion',
      'afterSubmitMessage',
      'onReady',
      'onOpen',
      'onClose',
      'onFeedbackSubmit',
      'onMessageError',
    ];
    const options = Object.fromEntries(names.map((name) => [name, () => {}]));
    const { callbacks } = splitOptions(options);

    expect(Object.keys(callbacks).sort()).toEqual(names.sort());
    expect(console.warn).not.toHaveBeenCalled();
  });

  it('drops an unrecognized option and warns', () => {
    const { config, callbacks } = splitOptions({ nonsense: 1 });
    expect(config).toEqual({});
    expect(callbacks).toEqual({});
    expect(console.warn).toHaveBeenCalled();
  });

  it('handles an empty options object', () => {
    expect(splitOptions({})).toEqual({ config: {}, callbacks: {} });
  });
});
