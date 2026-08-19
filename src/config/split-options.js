import { CONFIG_SCHEMA } from './schema';
import { warn } from '../utils/warn';

const CALLBACK_KEYS = [
  'beforeSubmitMessage',
  'onSendMessage',
  'onSendSuggestion',
  'afterSubmitMessage',
  'onReady',
  'onOpen',
  'onClose',
  'onFeedbackSubmit',
  'onMessageError',
];

const CONFIG_KEYS = new Set(CONFIG_SCHEMA.map((field) => field.key));

/**
 * A flat createChatbot(options) object → { config, callbacks }. Anything in
 * neither set warns once and is dropped.
 */
export function splitOptions(options) {
  const config = {};
  const callbacks = {};

  for (const [key, value] of Object.entries(options)) {
    if (CONFIG_KEYS.has(key)) {
      config[key] = value;
    } else if (CALLBACK_KEYS.includes(key)) {
      callbacks[key] = value;
    } else {
      warn(`unknown option "${key}" — ignoring`);
    }
  }

  return { config, callbacks };
}
