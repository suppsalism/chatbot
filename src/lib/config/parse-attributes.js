import { CONFIG_SCHEMA } from './schema';
import { parseTypedValue } from '../helper';

/** DOM element → partial config, coerced per CONFIG_SCHEMA (spec §4.2). */
export function parseAttributes(element) {
  const config = {};

  for (const field of CONFIG_SCHEMA) {
    if (!element.hasAttribute(field.attribute)) continue;

    const raw = element.getAttribute(field.attribute);
    const parsed = parseTypedValue(raw, field.type);
    if (parsed !== undefined) config[field.key] = parsed;
  }

  return config;
}
