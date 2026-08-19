import { CONFIG_SCHEMA } from './schema';
import { generateUuid } from '../utils/uuid';
import { warn } from '../utils/warn';

const SCHEMA_BY_KEY = new Map(CONFIG_SCHEMA.map((field) => [field.key, field]));

function stripNullish(layer) {
  const cleaned = {};
  for (const [key, value] of Object.entries(layer || {})) {
    if (value === null || value === undefined) continue;
    cleaned[key] = value;
  }
  return cleaned;
}

/**
 * Merges partial configs, lowest precedence first, over the schema defaults.
 * Never throws — a bad or unrecognized field degrades instead of blanking the
 * widget.
 */
export function resolveConfig(layers = []) {
  const defaults = {};
  for (const field of CONFIG_SCHEMA) defaults[field.key] = field.default;

  const merged = Object.assign({}, defaults, ...layers.map(stripNullish));
  const resolved = {};

  for (const field of CONFIG_SCHEMA) {
    const value = merged[field.key];
    if (value === undefined) {
      resolved[field.key] = field.default;
    } else if (field.validate && !field.validate(value)) {
      warn(`invalid "${field.key}": ${JSON.stringify(value)} — using default`);
      resolved[field.key] = field.default;
    } else {
      resolved[field.key] = value;
    }
  }

  for (const key of Object.keys(merged)) {
    if (SCHEMA_BY_KEY.has(key)) continue;
    warn(`unknown config field "${key}" — ignoring`);
    resolved[key] = merged[key];
  }

  if (!resolved.sessionId) resolved.sessionId = generateUuid();

  return Object.freeze(resolved);
}
