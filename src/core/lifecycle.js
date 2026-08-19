import { generateUuid } from '../utils/uuid';
import { warn } from '../utils/warn';
import { batch } from '../reactive/signal';

function report(onMessageError, error, message) {
  try {
    onMessageError?.(error, message);
  } catch {
    // an observer is never allowed to break the chat
  }
}

function isAsyncIterable(value) {
  return Boolean(value) && typeof value[Symbol.asyncIterator] === 'function';
}

/**
 * Every accepted return shape → a plain array of replies, so exactly one code
 * path renders. A bare string is the documented shorthand for `{ text }`.
 */
function toReplyList(result) {
  if (typeof result === 'string') return [{ text: result }];
  if (Array.isArray(result)) return result;
  return [result];
}

/**
 * Renders a list of replies as one agent message each, and records them in the
 * conversation. Suggestion chips are a single row, so when several replies
 * carry them the last non-empty set wins.
 *
 * @returns {object[]} the rendered replies, each stamped with its messageId.
 */
function renderReplyList(replies, { view, state }) {
  const rendered = [];
  let suggestions = null;

  for (const reply of replies) {
    if (!reply || typeof reply !== 'object' || typeof reply.text !== 'string') {
      throw new TypeError('[ss-chat] each reply must be an object with a string "text"');
    }

    const messageId = generateUuid();
    view.appendMessage({
      role: 'agent',
      text: reply.text,
      messageId,
      form: reply.form,
    });

    if (Array.isArray(reply.suggestions) && reply.suggestions.length > 0) {
      suggestions = reply.suggestions;
    }

    rendered.push({ ...reply, messageId });
  }

  batch(() => {
    if (suggestions) view.setSuggestions(suggestions);
  });

  for (const reply of rendered) {
    state.appendToConversation({
      messageId: reply.messageId,
      role: 'agent',
      text: reply.text,
      timestamp: Date.now(),
    });
  }

  return rendered;
}

/**
 * Renders whatever `onSendMessage` (or a form's `onSubmit`) returned.
 *
 * Mirrors the caller's shape back: an array in, an array out; a single reply
 * in, a single reply out. That keeps `afterSubmitMessage` unchanged for anyone
 * who was already using it.
 *
 * @returns {object|object[]} the rendered reply, or replies.
 */
export async function renderResult(result, { view, state }) {
  // A streamed reply is always one bubble — chunks have no room to say "start a
  // new message", and overloading them to mean that would make chunk semantics
  // ambiguous. Streaming therefore carries no form.
  if (isAsyncIterable(result)) {
    const messageId = generateUuid();
    const handle = view.beginAgentMessage({ messageId });
    let text = '';

    for await (const chunk of result) {
      text += typeof chunk === 'string' ? chunk : chunk.text;
      handle.update(text);
    }

    handle.finish();
    state.appendToConversation({ messageId, role: 'agent', text, timestamp: Date.now() });
    return { messageId, text };
  }

  const wasArray = Array.isArray(result);

  if (wasArray && result.length === 0) {
    warn('onSendMessage returned an empty array — nothing to render');
    return [];
  }

  const rendered = renderReplyList(toReplyList(result), { view, state });
  return wasArray ? rendered : rendered[0];
}

/**
 * The three-stage message lifecycle:
 *   beforeSubmitMessage → onSendMessage → afterSubmitMessage
 * correlated across all three by messageId. No fetch, no retry, no timeout,
 * no abort — that boundary is held here at the code level.
 *
 * `source` names where the turn came from. `'suggestion'` routes stage 2 to
 * `onSendSuggestion` when the consumer registered one; everything else — a
 * typed message, `bot.submit()` — always goes to `onSendMessage`.
 */
export async function submitMessage({ text, source, config, view, state, callbacks }) {
  const { beforeSubmitMessage, onSendMessage, afterSubmitMessage, onMessageError } = callbacks;

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

  const entry = { ...message, role: 'user' };

  // A chip click is answered by onSendSuggestion when one is registered, so it
  // is called here rather than at stage 2 proper: this is the last moment at
  // which nothing has rendered, and a synchronous `false` has always cancelled
  // the turn outright. Waiting for a promise first would delay the user's own
  // bubble, so an async handler resolving to `false` is handled later, where it
  // can only end the turn rather than erase it.
  //
  // The history it sees already includes this message, exactly as onSendMessage's
  // does — the entry is passed in rather than committed to state, because a
  // cancelled turn must leave nothing behind.
  let produced;
  let producerError;

  if (source === 'suggestion' && typeof callbacks.onSendSuggestion === 'function') {
    try {
      produced = callbacks.onSendSuggestion(message, {
        history: state.conversation().concat(entry),
        config,
      });
    } catch (error) {
      producerError = error;
    }
    if (produced === false) return;
  }

  batch(() => {
    view.appendMessage({ role: 'user', text: message.text, messageId: message.messageId });
    state.setDisabledSubmit(true);
    view.showTyping();
  });
  state.appendToConversation(entry);

  // stage 2 — the consumer produces the reply
  let reply;
  try {
    if (producerError) throw producerError;

    // Only awaited when there is something to await: on the ordinary path
    // `produced` is undefined, and an `await undefined` would still cost a
    // microtask before onSendMessage is even called.
    let result = produced === undefined ? undefined : await produced;

    // Nothing (or `true`) back from onSendSuggestion means it declined this
    // chip, so the turn falls through to onSendMessage. `true` counts as
    // declining only so the callback's original boolean contract still holds.
    if (result === undefined || result === null || result === true) {
      result = await onSendMessage(message, {
        history: state.conversation(),
        config,
      });
    }

    // A `false` that arrived from a promise is too late to cancel — the message
    // is on screen — so it ends the turn with no reply instead of erasing it.
    if (result !== false) {
      reply = await renderResult(result, { view, state });
    }
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
  });

  // stage 3 — observational; never allowed to break the chat
  try {
    await afterSubmitMessage?.(message, reply);
  } catch (error) {
    report(onMessageError, error, message);
  }
}
