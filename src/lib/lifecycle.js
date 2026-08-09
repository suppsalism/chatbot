import { generateUuid } from './helper';
import { batch } from './store/signal';

function report(onMessageError, error, message) {
  try {
    onMessageError?.(error, message);
  } catch {
    // an observer is never allowed to break the chat (spec §6.7)
  }
}

/**
 * Collapses the three accepted onSendMessage return shapes (spec §6.2) into
 * one rendered reply: a string wraps to { text }, an object passes through,
 * an async iterable streams chunks into a single bubble.
 */
async function normalizeReply(result, view) {
  const messageId = generateUuid();

  if (result && typeof result[Symbol.asyncIterator] === 'function') {
    const handle = view.beginAgentMessage({ messageId });
    let text = '';

    for await (const chunk of result) {
      text += typeof chunk === 'string' ? chunk : chunk.text;
      handle.update(text);
    }

    handle.finish();
    return { messageId, text };
  }

  const reply = typeof result === 'string' ? { text: result } : result;
  view.appendMessage({ role: 'agent', text: reply.text, messageId });
  return { ...reply, messageId };
}

/**
 * The three-stage message lifecycle (spec §6):
 *   beforeSubmitMessage → onSendMessage → afterSubmitMessage
 * correlated across all three by messageId. No fetch, no retry, no timeout,
 * no abort — that boundary is held here at the code level (spec §6.2).
 */
export async function submitMessage({ text, config, view, state, callbacks }) {
  const {
    beforeSubmitMessage,
    onSendMessage,
    afterSubmitMessage,
    onMessageError,
    onSuggestionClick,
  } = callbacks;

  let message = {
    text,
    messageId: generateUuid(),
    sessionId: config.sessionId,
    timestamp: Date.now(),
  };

  // stage 1 — may transform or cancel; nothing has rendered yet
  try {
    const result = await beforeSubmitMessage?.(message);
    if (result === false) return;
    if (result) message = result;
  } catch (error) {
    report(onMessageError, error, message);
    return;
  }

  batch(() => {
    view.appendMessage({ role: 'user', text: message.text, messageId: message.messageId });
    state.setDisabledSubmit(true);
    view.showTyping();
  });
  state.appendToConversation({ ...message, role: 'user' });

  // stage 2 — the consumer produces the reply
  let reply;
  try {
    const result = await onSendMessage(message, {
      history: state.conversation(),
      config,
    });
    reply = await normalizeReply(result, view);
  } catch (error) {
    batch(() => {
      view.hideTyping();
      view.appendError();
      state.setDisabledSubmit(false);
    });
    report(onMessageError, error, message);
    return;
  }

  batch(() => {
    view.hideTyping();
    state.setDisabledSubmit(false);
    if (reply.suggestions) view.setSuggestions(reply.suggestions, onSuggestionClick);
  });
  state.appendToConversation({
    messageId: reply.messageId,
    role: 'agent',
    text: reply.text,
    timestamp: Date.now(),
  });

  // stage 3 — observational; never allowed to break the chat
  try {
    await afterSubmitMessage?.(message, reply);
  } catch (error) {
    report(onMessageError, error, message);
  }
}
