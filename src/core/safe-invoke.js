/**
 * Routes an error to the consumer's observer without ever letting the observer
 * itself break the chat (spec §6.7).
 */
export function reportError(callbacks, error, message) {
  try {
    callbacks.onMessageError?.(error, message);
  } catch {
    // an observer is never allowed to break the chat (spec §6.7)
  }
}

/** Invokes an optional, fire-and-forget callback; a throw or rejection is routed to onMessageError. */
export function safeInvoke(fn, callbacks, ...args) {
  if (!fn) return undefined;
  try {
    const result = fn(...args);
    if (result && typeof result.catch === 'function') {
      result.catch((error) => reportError(callbacks, error));
    }
    return result;
  } catch (error) {
    reportError(callbacks, error);
    return undefined;
  }
}
