// npm entry — named exports only, zero side effects on import (guide §2.1).
export { createChatbot } from './core';
export { defineChatElement } from './element';
export { parseAttributes } from './lib/config/parse-attributes';
export { resolveConfig } from './lib/config/resolve';
export { CONFIG_SCHEMA } from './lib/config/schema';
export { echoReply } from './lib/helper';
