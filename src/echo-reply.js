/**
 * A trivial onSendMessage so demos, docs, and tests are not blocked by the
 * requirement that one be supplied.
 *
 * This is public API, not an internal helper — it is exported from the package
 * root and documented in the README.
 */
export function echoReply(message) {
  return `You said: "${message.text}"`;
}
