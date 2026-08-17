import { describe, it, expect, vi, beforeEach } from 'vitest';
import { normalizeFormSpec } from '../../src/core/form-spec';

const ctx = { messageId: 'msg-1' };
const minimal = { fields: [{ name: 'email', label: 'Email', type: 'email' }], onSubmit: () => {} };

describe('normalizeFormSpec', () => {
  beforeEach(() => {
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('returns null when there is no form', () => {
    expect(normalizeFormSpec(undefined, ctx)).toBeNull();
    expect(normalizeFormSpec(null, ctx)).toBeNull();
  });

  it('rejects a non-object form without throwing', () => {
    expect(normalizeFormSpec('form', ctx)).toBeNull();
    expect(normalizeFormSpec([], ctx)).toBeNull();
    expect(console.warn).toHaveBeenCalled();
  });

  it('rejects a form with no fields array', () => {
    expect(normalizeFormSpec({ title: 'Hi' }, ctx)).toBeNull();
    expect(normalizeFormSpec({ fields: 'email' }, ctx)).toBeNull();
  });

  it('applies defaults for id and submitLabel', () => {
    const spec = normalizeFormSpec(minimal, ctx);
    expect(spec.id).toBe('msg-1');
    expect(spec.submitLabel).toBe('Send');
    expect(spec.title).toBeUndefined();
  });

  it('keeps an explicit id, title and submitLabel', () => {
    const spec = normalizeFormSpec(
      { ...minimal, id: 'lead', title: 'Share your email', submitLabel: 'Subscribe' },
      ctx
    );
    expect(spec).toMatchObject({
      id: 'lead',
      title: 'Share your email',
      submitLabel: 'Subscribe',
    });
  });

  it('defaults a field label to its name and its type to text', () => {
    const spec = normalizeFormSpec({ fields: [{ name: 'company' }], onSubmit: () => {} }, ctx);
    expect(spec.fields[0]).toMatchObject({ name: 'company', label: 'company', type: 'text' });
  });

  it('accepts every supported field type', () => {
    const types = ['text', 'email', 'tel', 'url', 'number', 'textarea', 'checkbox'];
    const spec = normalizeFormSpec(
      { fields: types.map((type) => ({ name: type, type })), onSubmit: () => {} },
      ctx
    );
    expect(spec.fields.map((f) => f.type)).toEqual(types);
  });

  it('degrades an unsupported type to text rather than dropping the field', () => {
    const spec = normalizeFormSpec(
      { fields: [{ name: 'secret', type: 'password' }], onSubmit: () => {} },
      ctx
    );
    expect(spec.fields[0].type).toBe('text');
    expect(console.warn).toHaveBeenCalled();
  });

  it('drops a field with no usable name but keeps the rest of the form', () => {
    const spec = normalizeFormSpec(
      {
        fields: [{ name: '' }, { label: 'orphan' }, null, 'nope', { name: 'email' }],
        onSubmit: () => {},
      },
      ctx
    );
    expect(spec.fields.map((f) => f.name)).toEqual(['email']);
  });

  it('returns null when no field survives', () => {
    expect(normalizeFormSpec({ fields: [{ label: 'no name' }] }, ctx)).toBeNull();
  });

  it('de-duplicates field names, keeping the first', () => {
    const spec = normalizeFormSpec(
      {
        fields: [
          { name: 'email', label: 'First' },
          { name: 'email', label: 'Second' },
        ],
        onSubmit: () => {},
      },
      ctx
    );
    expect(spec.fields).toHaveLength(1);
    expect(spec.fields[0].label).toBe('First');
  });

  it('normalizes select options, accepting bare strings', () => {
    const spec = normalizeFormSpec(
      {
        fields: [
          { name: 'plan', type: 'select', options: ['Free', { value: 'pro', label: 'Pro' }] },
        ],
        onSubmit: () => {},
      },
      ctx
    );
    expect(spec.fields[0].options).toEqual([
      { value: 'Free', label: 'Free' },
      { value: 'pro', label: 'Pro' },
    ]);
  });

  it('drops a select with no valid options', () => {
    expect(normalizeFormSpec({ fields: [{ name: 'plan', type: 'select' }] }, ctx)).toBeNull();
  });

  it('treats required as strictly boolean true', () => {
    const spec = normalizeFormSpec(
      {
        fields: [{ name: 'a', required: true }, { name: 'b', required: 'yes' }, { name: 'c' }],
        onSubmit: () => {},
      },
      ctx
    );
    expect(spec.fields.map((f) => f.required)).toEqual([true, false, false]);
  });

  it('still renders a form with no onSubmit, but warns', () => {
    const spec = normalizeFormSpec({ fields: [{ name: 'email' }] }, ctx);
    expect(spec).not.toBeNull();
    expect(spec.onSubmit).toBeUndefined();
    expect(console.warn).toHaveBeenCalled();
  });

  it('never throws on a hostile spec', () => {
    expect(() => normalizeFormSpec({ fields: [{ name: {}, type: 42 }] }, ctx)).not.toThrow();
    expect(() => normalizeFormSpec({ fields: [1, 2, 3], id: 7 }, ctx)).not.toThrow();
  });
});
