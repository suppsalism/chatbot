const warnedMessages = new Set();

/** console.warn, prefixed and de-duplicated so a repeating condition does not spam the console. */
export function warn(message) {
  if (warnedMessages.has(message)) return;
  warnedMessages.add(message);
  console.warn(`[ss-chat] ${message}`);
}
