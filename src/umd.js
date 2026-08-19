// The only file in the package permitted to touch `window`.
import * as api from './index.js';
import { version } from '../package.json';

// Wrapped only on the CDN global, so `SsChat.get(id)` has something
// to search — the npm export of createChatbot stays untouched.
function createTrackedChatbot(options) {
  const bot = api.createChatbot(options);
  window.SsChat.instances.push(bot);
  return bot;
}

function drainQueue(pending) {
  if (!Array.isArray(pending)) return;
  pending.forEach(([method, ...args]) => {
    window.SsChat[method]?.(...args);
  });
}

if (window.SsChat) {
  // Guard double-load: warn and no-op rather than clobber — this
  // happens for real when a customer's site has two plugins that each embed
  // the widget.
  if (window.SsChat.version !== version) {
    console.warn(`[ss-chat] ${window.SsChat.version} already loaded; skipping ${version}`);
  }
} else {
  const queue = window.ssChat;

  window.SsChat = Object.freeze({
    ...api, // every named export, same names — mirroring is mechanical, not maintained
    createChatbot: createTrackedChatbot,
    version,
    instances: [],
    get: (id) => window.SsChat.instances.find((bot) => bot.id === id),
  });

  drainQueue(queue);
}
