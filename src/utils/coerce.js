/**
 * Generic string -> typed value coercion, used to read config out of dataset
 * (data-*) attributes, which are always plain strings.
 */
export function parseTypedValue(rawValue, type) {
  switch (type) {
    case 'json':
      try {
        return JSON.parse(rawValue);
      } catch {
        return undefined;
      }
    case 'boolean':
      return rawValue === 'true';
    default:
      return rawValue;
  }
}
