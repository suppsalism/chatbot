import { warn } from '../utils/warn';

/**
 * Field types the widget renders. All map to a native control, so validation is
 * the browser's job and there is no validation engine to maintain.
 *
 * `password` is deliberately absent. A reply can be described by a server or an
 * LLM, and a password prompt rendered inside a brand's own chat widget is a
 * credible phishing surface with no legitimate use here. An unknown type
 * degrades to `text`, so a spec asking for one renders as a visible text box
 * rather than something that looks like a password field.
 */
const FIELD_TYPES = new Set([
  'text',
  'email',
  'tel',
  'url',
  'number',
  'textarea',
  'select',
  'checkbox',
]);

const DEFAULT_SUBMIT_LABEL = 'Send';

function normalizeOptions(options) {
  if (!Array.isArray(options)) return [];

  return options.flatMap((option) => {
    if (typeof option === 'string') return [{ value: option, label: option }];
    if (!option || typeof option !== 'object') return [];
    if (typeof option.value !== 'string') return [];
    return [{ value: option.value, label: String(option.label ?? option.value) }];
  });
}

function normalizeField(field) {
  if (!field || typeof field !== 'object') {
    warn('form field must be an object — skipping it');
    return null;
  }

  if (typeof field.name !== 'string' || field.name.length === 0) {
    warn('form field needs a non-empty "name" — skipping it');
    return null;
  }

  let type = 'text';
  if (field.type === undefined) {
    type = 'text';
  } else if (FIELD_TYPES.has(field.type)) {
    type = field.type;
  } else {
    warn(`unsupported form field type "${field.type}" — falling back to "text"`);
  }

  const options = type === 'select' ? normalizeOptions(field.options) : [];
  if (type === 'select' && options.length === 0) {
    warn(`select field "${field.name}" has no valid options — skipping it`);
    return null;
  }

  return {
    name: field.name,
    label: typeof field.label === 'string' ? field.label : field.name,
    type,
    placeholder: typeof field.placeholder === 'string' ? field.placeholder : undefined,
    required: field.required === true,
    options,
    value: field.value,
  };
}

/**
 * A reply's `form` → a validated spec, or null if there is nothing renderable.
 *
 * Degrades the way config does: a bad field is dropped with one
 * warning and the rest of the form still renders, rather than throwing and
 * costing the consumer the whole reply.
 *
 * @param {object} spec The raw `form` field off a reply.
 * @param {{messageId: string}} context Supplies the fallback form id.
 * @returns {null | {id: string, title?: string, submitLabel: string, fields: object[], onSubmit?: Function}}
 */
export function normalizeFormSpec(spec, { messageId }) {
  if (spec === undefined || spec === null) return null;

  if (typeof spec !== 'object' || Array.isArray(spec)) {
    warn('reply "form" must be an object — ignoring it');
    return null;
  }

  if (!Array.isArray(spec.fields)) {
    warn('reply "form" needs a "fields" array — ignoring it');
    return null;
  }

  const fields = spec.fields.map(normalizeField).filter(Boolean);

  if (fields.length === 0) {
    warn('reply "form" has no valid fields — ignoring it');
    return null;
  }

  const names = new Set();
  const unique = fields.filter((field) => {
    if (names.has(field.name)) {
      warn(`duplicate form field name "${field.name}" — keeping the first`);
      return false;
    }
    names.add(field.name);
    return true;
  });

  if (typeof spec.onSubmit !== 'function') {
    // Rendered anyway — a form that cannot submit is still better than a reply
    // that silently loses its form — but this is always a mistake, so say so.
    warn('reply "form" has no onSubmit function — submitting it will do nothing');
  }

  return {
    id: typeof spec.id === 'string' && spec.id.length > 0 ? spec.id : messageId,
    title: typeof spec.title === 'string' && spec.title.length > 0 ? spec.title : undefined,
    submitLabel:
      typeof spec.submitLabel === 'string' && spec.submitLabel.length > 0
        ? spec.submitLabel
        : DEFAULT_SUBMIT_LABEL,
    fields: unique,
    onSubmit: typeof spec.onSubmit === 'function' ? spec.onSubmit : undefined,
  };
}
