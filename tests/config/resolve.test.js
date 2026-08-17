import { describe, it, expect, vi, beforeEach } from 'vitest';
import { resolveConfig } from '../../src/config/resolve';

describe('resolveConfig', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('fills in schema defaults when given nothing', () => {
    const config = resolveConfig();
    expect(config.theme).toBe('light');
    expect(config.orientation).toBe('right');
    expect(config.brandColor).toBe('#2563eb');
    expect(config.name).toBe('Assistant');
    expect(config.signature).toBe(true);
    expect(config.autoOpen).toBe(false);
    expect(config.initialMessages).toEqual([]);
  });

  it('applies layers lowest-precedence-first', () => {
    const config = resolveConfig([{ theme: 'dark' }, { theme: 'light', name: 'Support' }]);
    expect(config.theme).toBe('light');
    expect(config.name).toBe('Support');
  });

  it('ignores null and undefined so a later layer cannot blank an earlier one', () => {
    const config = resolveConfig([{ name: 'Support' }, { name: undefined, theme: null }]);
    expect(config.name).toBe('Support');
    expect(config.theme).toBe('light');
  });

  it('falls back to the default and warns on an invalid value rather than throwing', () => {
    const config = resolveConfig([{ theme: 'neon' }]);
    expect(config.theme).toBe('light');
    expect(console.warn).toHaveBeenCalled();
  });

  it('never throws on a hostile config object', () => {
    expect(() =>
      resolveConfig([
        { theme: 42, orientation: [], brandColor: 'rgb(1,2,3)', initialMessages: 'nope' },
      ])
    ).not.toThrow();
  });

  it('keeps an unknown field instead of dropping it, so an older build tolerates newer config', () => {
    const config = resolveConfig([{ futureFlag: 'on' }]);
    expect(config.futureFlag).toBe('on');
  });

  it('generates a sessionId when no layer supplies one', () => {
    expect(resolveConfig().sessionId).toBeTypeOf('string');
    expect(resolveConfig().sessionId).not.toBe(resolveConfig().sessionId);
  });

  it('keeps a supplied sessionId', () => {
    expect(resolveConfig([{ sessionId: 'session-1' }]).sessionId).toBe('session-1');
  });

  it('freezes the result so no component can mutate shared config', () => {
    const config = resolveConfig();
    expect(Object.isFrozen(config)).toBe(true);
  });

  it('is idempotent — re-resolving a resolved config changes nothing', () => {
    const once = resolveConfig([{ theme: 'dark', name: 'Support' }]);
    const twice = resolveConfig([once]);
    expect({ ...twice }).toEqual({ ...once });
  });

  it('validates hex brand colors in both 3- and 6-digit form', () => {
    expect(resolveConfig([{ brandColor: '#abc' }]).brandColor).toBe('#abc');
    expect(resolveConfig([{ brandColor: '#AABBCC' }]).brandColor).toBe('#AABBCC');
    expect(resolveConfig([{ brandColor: 'red' }]).brandColor).toBe('#2563eb');
  });

  it('rejects a non-string entry inside initialMessages', () => {
    expect(resolveConfig([{ initialMessages: ['ok', 5] }]).initialMessages).toEqual([]);
    expect(resolveConfig([{ initialMessages: ['ok'] }]).initialMessages).toEqual(['ok']);
  });
});
