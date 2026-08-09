/**
 * CONFIG_SCHEMA — the single source of truth (spec §4.1, §4.4). One row per
 * field. Defaults, the attribute parser, validation, and the documented
 * options table are all derived from this table. Adding an option means
 * adding one row here and nowhere else (guide §4).
 */
export const CONFIG_SCHEMA = [
  {
    key: 'theme',
    attribute: 'data-theme',
    type: 'string',
    default: 'light',
    validate: (v) => v === 'light' || v === 'dark',
  },
  {
    key: 'orientation',
    attribute: 'data-orientation',
    type: 'string',
    default: 'right',
    validate: (v) => v === 'left' || v === 'right',
  },
  {
    key: 'brandColor',
    attribute: 'data-brand-color',
    type: 'color',
    default: '#2563eb',
    validate: (v) => /^#([0-9a-f]{3}|[0-9a-f]{6})$/i.test(v),
  },
  {
    key: 'name',
    attribute: 'data-name',
    type: 'string',
    default: 'Assistant',
    validate: (v) => typeof v === 'string' && v.length > 0,
  },
  {
    key: 'avatar',
    attribute: 'data-avatar',
    type: 'url',
    default: undefined,
    validate: (v) => typeof v === 'string' && v.length > 0,
  },
  {
    key: 'placeholder',
    attribute: 'data-placeholder',
    type: 'string',
    default: 'Type a message…',
    validate: (v) => typeof v === 'string',
  },
  {
    key: 'initialMessages',
    attribute: 'data-initial-messages',
    type: 'json',
    default: [],
    validate: (v) => Array.isArray(v) && v.every((m) => typeof m === 'string'),
  },
  {
    key: 'suggestedMessages',
    attribute: 'data-suggested-messages',
    type: 'json',
    default: [],
    validate: (v) => Array.isArray(v) && v.every((m) => typeof m === 'string'),
  },
  {
    key: 'signature',
    attribute: 'data-signature',
    type: 'boolean',
    default: true,
    validate: (v) => typeof v === 'boolean',
  },
  {
    key: 'autoOpen',
    attribute: 'data-auto-open',
    type: 'boolean',
    default: false,
    validate: (v) => typeof v === 'boolean',
  },
  {
    key: 'collectFeedback',
    attribute: 'data-collect-feedback',
    type: 'boolean',
    default: false,
    validate: (v) => typeof v === 'boolean',
  },
  {
    key: 'collectLeads',
    attribute: 'data-collect-leads',
    type: 'boolean',
    default: false,
    validate: (v) => typeof v === 'boolean',
  },
  {
    // The one field core generates for itself (spec §4.3) — resolveConfig
    // stamps a UUID here when no layer supplies one.
    key: 'sessionId',
    attribute: 'data-session',
    type: 'string',
    default: undefined,
    validate: (v) => typeof v === 'string' && v.length > 0,
  },
];
