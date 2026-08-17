export function isAttachedElement(value) {
  return typeof Element !== 'undefined' && value instanceof Element && value.isConnected;
}
