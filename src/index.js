// npm entry — named exports only, zero side effects on import (guide §2.1).
export { createChatbot } from './core/create-chatbot';
export { defineChatElement } from './core/define-element';
export { parseAttributes } from './config/parse-attributes';
export { resolveConfig } from './config/resolve';
export { CONFIG_SCHEMA } from './config/schema';
export { echoReply } from './echo-reply';
