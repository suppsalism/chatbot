import { describe, it, expect } from 'vitest';
import { parseAttributes } from '../../src/config/parse-attributes';

function elementWith(attributes) {
  const el = document.createElement('div');
  for (const [name, value] of Object.entries(attributes)) el.setAttribute(name, value);
  return el;
}

describe('parseAttributes', () => {
  it('returns an empty object for an element with no data-* attributes', () => {
    expect(parseAttributes(elementWith({}))).toEqual({});
  });

  it('omits absent fields entirely rather than emitting undefined', () => {
    const config = parseAttributes(elementWith({ 'data-name': 'Support' }));
    expect(config).toEqual({ name: 'Support' });
    expect('theme' in config).toBe(false);
  });

  it('reads string fields verbatim', () => {
    const config = parseAttributes(
      elementWith({ 'data-theme': 'dark', 'data-placeholder': 'Ask me…' })
    );
    expect(config).toEqual({ theme: 'dark', placeholder: 'Ask me…' });
  });

  it('coerces booleans, treating only the literal string "true" as true', () => {
    expect(parseAttributes(elementWith({ 'data-auto-open': 'true' })).autoOpen).toBe(true);
    expect(parseAttributes(elementWith({ 'data-auto-open': 'false' })).autoOpen).toBe(false);
    expect(parseAttributes(elementWith({ 'data-auto-open': '' })).autoOpen).toBe(false);
    expect(parseAttributes(elementWith({ 'data-auto-open': '1' })).autoOpen).toBe(false);
  });

  it('parses JSON fields', () => {
    const config = parseAttributes(elementWith({ 'data-initial-messages': '["hi","there"]' }));
    expect(config.initialMessages).toEqual(['hi', 'there']);
  });

  it('drops a malformed JSON field instead of throwing, leaving the default to apply', () => {
    let config;
    expect(() => {
      config = parseAttributes(elementWith({ 'data-initial-messages': '[oops' }));
    }).not.toThrow();
    expect('initialMessages' in config).toBe(false);
  });

  it('never produces a function or a DOM node from an attribute', () => {
    const config = parseAttributes(
      elementWith({ 'data-name': 'Support', 'data-suggested-messages': '["a"]' })
    );
    for (const value of Object.values(config)) {
      expect(value).not.toBeTypeOf('function');
      expect(value instanceof Element).toBe(false);
    }
  });
});
