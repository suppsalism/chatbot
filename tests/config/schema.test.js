import { describe, it, expect } from 'vitest';
import { CONFIG_SCHEMA } from '../../src/config/schema';

describe('CONFIG_SCHEMA', () => {
  it('gives every field a key, an attribute and a type', () => {
    for (const field of CONFIG_SCHEMA) {
      expect(field.key, JSON.stringify(field)).toBeTypeOf('string');
      expect(field.attribute, field.key).toBeTypeOf('string');
      expect(field.type, field.key).toBeTypeOf('string');
    }
  });

  it('keeps keys and attributes unique', () => {
    const keys = CONFIG_SCHEMA.map((f) => f.key);
    const attributes = CONFIG_SCHEMA.map((f) => f.attribute);
    expect(new Set(keys).size).toBe(keys.length);
    expect(new Set(attributes).size).toBe(attributes.length);
  });

  it('names every attribute data-*, so config can never collide with a real HTML attribute', () => {
    for (const field of CONFIG_SCHEMA) {
      expect(field.attribute, field.key).toMatch(/^data-[a-z-]+$/);
    }
  });

  it('accepts its own default for every field that has one', () => {
    for (const field of CONFIG_SCHEMA) {
      if (field.default === undefined) continue;
      expect(field.validate(field.default), `${field.key} rejects its own default`).toBe(true);
    }
  });

  it('keeps every default JSON-serializable — the rule that separates config from options', () => {
    for (const field of CONFIG_SCHEMA) {
      expect(() => JSON.stringify(field.default), field.key).not.toThrow();
      expect(field.default, field.key).not.toBeTypeOf('function');
    }
  });
});
