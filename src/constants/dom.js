/**
 * Single source of truth for the tag name, the events, and every DOM id the
 * widget generates. No other module may write these literals.
 * Class names live in ./class-names.js.
 */

export const CHAT_TAG_NAME = 'ss-chat';

/** Dispatched from a <ss-chat> element once its bot instance is created (or re-created). */
export const CHAT_READY_EVENT = 'ss-chat:ready';

export const shellId = (instanceId) => `ss-chat-shell-${instanceId}`;
export const iframeId = (instanceId) => `ss-chat-iframe-${instanceId}`;
