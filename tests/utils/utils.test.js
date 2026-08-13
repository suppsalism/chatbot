import { describe, it, expect, vi, beforeEach } from 'vitest';
import { getTextColorForBackground } from '../../src/utils/color';
import { parseTypedValue } from '../../src/utils/coerce';
import { generateUuid } from '../../src/utils/uuid';
import { isAttachedElement } from '../../src/utils/guards';
import { echoReply } from '../../src/echo-reply';

describe('getTextColorForBackground', () => {
  it('picks black on light backgrounds and white on dark ones', () => {
    expect(getTextColorForBackground('#ffffff')).toBe('#000');
    expect(getTextColorForBackground('#000000')).toBe('#fff');
    expect(getTextColorForBackground('#2563eb')).toBe('#fff');
  });

  it('expands 3-digit hex the same as its 6-digit form', () => {
    expect(getTextColorForBackground('#fff')).toBe(getTextColorForBackground('#ffffff'));
    expect(getTextColorForBackground('#000')).toBe(getTextColorForBackground('#000000'));
  });

  it('accepts an rgb() string', () => {
    expect(getTextColorForBackground('rgb(255, 255, 255)')).toBe('#000');
    expect(getTextColorForBackground('rgb(0, 0, 0)')).toBe('#fff');
  });

  it('weights green most heavily, matching perceived brightness', () => {
    expect(getTextColorForBackground('#00ff00')).toBe('#000');
    expect(getTextColorForBackground('#0000ff')).toBe('#fff');
  });
});

describe('parseTypedValue', () => {
  it('passes strings through untouched', () => {
    expect(parseTypedValue('dark', 'string')).toBe('dark');
    expect(parseTypedValue('dark', 'url')).toBe('dark');
    expect(parseTypedValue('#fff', 'color')).toBe('#fff');
  });

  it('treats only "true" as boolean true', () => {
    expect(parseTypedValue('true', 'boolean')).toBe(true);
    expect(parseTypedValue('false', 'boolean')).toBe(false);
    expect(parseTypedValue('TRUE', 'boolean')).toBe(false);
  });

  it('parses valid JSON and returns undefined for invalid JSON', () => {
    expect(parseTypedValue('["a","b"]', 'json')).toEqual(['a', 'b']);
    expect(parseTypedValue('{bad', 'json')).toBeUndefined();
  });
});

describe('generateUuid', () => {
  it('produces unique v4-shaped ids', () => {
    const ids = new Set(Array.from({ length: 200 }, generateUuid));
    expect(ids.size).toBe(200);
    for (const id of ids) {
      expect(id).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i);
    }
  });

  it('falls back to Math.random when crypto.randomUUID is unavailable', () => {
    const original = crypto.randomUUID;
    crypto.randomUUID = undefined;
    try {
      expect(generateUuid()).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
      );
    } finally {
      crypto.randomUUID = original;
    }
  });
});

describe('isAttachedElement', () => {
  it('is true only for an element attached to the document', () => {
    const detached = document.createElement('div');
    expect(isAttachedElement(detached)).toBe(false);

    document.body.appendChild(detached);
    expect(isAttachedElement(detached)).toBe(true);

    detached.remove();
    expect(isAttachedElement(detached)).toBe(false);
  });

  it('rejects non-elements', () => {
    expect(isAttachedElement(null)).toBe(false);
    expect(isAttachedElement(undefined)).toBe(false);
    expect(isAttachedElement('body')).toBe(false);
    expect(isAttachedElement({ isConnected: true })).toBe(false);
    expect(isAttachedElement(document)).toBe(false);
  });
});

describe('echoReply', () => {
  it('echoes the message text', () => {
    expect(echoReply({ text: 'hello' })).toBe('You said: "hello"');
  });
});

describe('warn', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('prefixes with [ss-chat] and only logs a repeated message once', async () => {
    const { warn } = await import('../../src/utils/warn');

    warn('something odd');
    warn('something odd');
    warn('something else');

    expect(console.warn).toHaveBeenCalledTimes(2);
    expect(console.warn).toHaveBeenCalledWith('[ss-chat] something odd');
  });
});
